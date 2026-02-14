using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RDrive.Backend.Data;
using RDrive.Backend.Models;
using RDrive.Backend.Services;

namespace RDrive.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TasksController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly RcloneService _rclone;
    private readonly RclonePathResolver _resolver;
    
    public TasksController(AppDbContext db, RcloneService rclone, RclonePathResolver resolver)
    {
        _db = db;
        _rclone = rclone;
        _resolver = resolver;
    }
    
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var tasks = await _db.Tasks.OrderByDescending(t => t.CreatedAt).ToListAsync();
        
        // Fetch per-job stats for each running task using rclone's job/{jobid} group
        var jobStats = new Dictionary<long, RcloneStatsResponse>();
        
        // Poll rclone for running tasks to refresh status
        foreach (var task in tasks.Where(t => t.Status == "Running"))
        {
            try
            {
                var status = await _rclone.GetJobStatusAsync(task.RcloneJobId);
                if (status != null && status.Finished)
                {
                    task.Status = status.Success ? "Completed" : "Failed";
                    task.FinishedAt = DateTime.UtcNow;
                    if (!status.Success && !string.IsNullOrEmpty(status.Error))
                        task.Error = status.Error;
                    _db.Tasks.Update(task);
                }
                else
                {
                    // Fetch per-job stats using group name "job/{jobid}"
                    try
                    {
                        var stats = await _rclone.GetTransferStatsAsync($"job/{task.RcloneJobId}");
                        if (stats != null) jobStats[task.RcloneJobId] = stats;
                    }
                    catch { }
                }
            }
            catch
            {
                // Job may have expired from rclone's memory
                task.Status = "Unknown";
            }
        }
        
        await _db.SaveChangesAsync();
        
        // Build response with per-job stats
        var result = tasks.Select(t => new TaskWithStats
        {
            Id = t.Id,
            RcloneJobId = t.RcloneJobId,
            Type = t.Type,
            Status = t.Status,
            IsDir = t.IsDir,
            SourceRemote = t.SourceRemote,
            SourcePath = t.SourcePath,
            DestRemote = t.DestRemote,
            DestPath = t.DestPath,
            Error = t.Error,
            CreatedAt = DateTime.SpecifyKind(t.CreatedAt, DateTimeKind.Utc),
            StartedAt = t.StartedAt.HasValue ? DateTime.SpecifyKind(t.StartedAt.Value, DateTimeKind.Utc) : null,
            FinishedAt = t.FinishedAt.HasValue ? DateTime.SpecifyKind(t.FinishedAt.Value, DateTimeKind.Utc) : null,
            Stats = jobStats.TryGetValue(t.RcloneJobId, out var s) ? s : null
        });
        
        return Ok(result);
    }
    
    [HttpPost("sync")]
    public async Task<IActionResult> StartSync([FromBody] SyncRequest request)
    {
        try {
            // Validate remotes exist
            await _resolver.GetFsForRemoteAsync(request.SourceRemote);
            await _resolver.GetFsForRemoteAsync(request.DestRemote);
            
            var task = new RTask
            {
                Id = Guid.NewGuid(),
                Type = "Sync",
                Status = "Queued",
                IsDir = true, // Sync is always directory-level
                SourceRemote = request.SourceRemote,
                SourcePath = request.SourcePath,
                DestRemote = request.DestRemote,
                DestPath = request.DestPath,
                CreatedAt = DateTime.UtcNow
            };
            
            _db.Tasks.Add(task);
            await _db.SaveChangesAsync();
            
            return Ok(task);
        } catch (Exception ex) { return BadRequest(ex.Message); }
    }
    
    [HttpGet("{id}")]
    public async Task<IActionResult> GetStatus(Guid id)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task == null) return NotFound();
        
        if (task.Status == "Running")
        {
            try
            {
                var status = await _rclone.GetJobStatusAsync(task.RcloneJobId);
                if (status != null && status.Finished)
                {
                    task.Status = status.Success ? "Completed" : "Failed";
                    task.FinishedAt = DateTime.UtcNow;
                    if (!status.Success && !string.IsNullOrEmpty(status.Error))
                        task.Error = status.Error;
                    _db.Tasks.Update(task);
                    await _db.SaveChangesAsync();
                }
            }
            catch
            {
                // Job may have expired
            }
        }
        
        return Ok(task);
    }
    
    [HttpPost("{id}/stop")]
    public async Task<IActionResult> Stop(Guid id)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task == null) return NotFound();
        
        if (task.Status == "Running")
        {
            await _rclone.StopJobAsync(task.RcloneJobId);
        }
        
        task.Status = "Stopped";
        task.FinishedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        
        return Ok(task);
    }
    
    [HttpPost("{id}/restart")]
    public async Task<IActionResult> Restart(Guid id)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task == null) return NotFound();
        
        // Only allow restarting stopped, failed, or unknown tasks
        if (task.Status != "Stopped" && task.Status != "Failed" && task.Status != "Unknown")
        {
            return BadRequest($"Cannot restart a task with status '{task.Status}'");
        }
        
        // Reset task to Queued so JobQueueService picks it up
        task.Status = "Queued";
        task.RcloneJobId = 0;
        task.Error = null;
        task.StartedAt = null;
        task.FinishedAt = null;
        
        await _db.SaveChangesAsync();
        
        return Ok(task);
    }
    
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var task = await _db.Tasks.FindAsync(id);
        if (task == null) return NotFound();
        
        // Stop running jobs before removing
        if (task.Status == "Running" && task.RcloneJobId > 0)
        {
            try { await _rclone.StopJobAsync(task.RcloneJobId); } catch { }
        }
        
        _db.Tasks.Remove(task);
        await _db.SaveChangesAsync();
        
        return Ok();
    }
    
    [HttpDelete]
    public async Task<IActionResult> ClearCompleted()
    {
        var completed = await _db.Tasks
            .Where(t => t.Status == "Completed" || t.Status == "Failed" || t.Status == "Stopped" || t.Status == "Unknown")
            .ToListAsync();
        
        _db.Tasks.RemoveRange(completed);
        await _db.SaveChangesAsync();
        
        return Ok();
    }
}

public class SyncRequest
{
    public string SourceRemote { get; set; } = "";
    public string SourcePath { get; set; } = "";
    public string DestRemote { get; set; } = "";
    public string DestPath { get; set; } = "";
}

public class TaskWithStats
{
    public Guid Id { get; set; }
    public long RcloneJobId { get; set; }
    public string Type { get; set; } = "";
    public string Status { get; set; } = "";
    public bool IsDir { get; set; }
    public string SourceRemote { get; set; } = "";
    public string SourcePath { get; set; } = "";
    public string DestRemote { get; set; } = "";
    public string DestPath { get; set; } = "";
    public string? Error { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public RcloneStatsResponse? Stats { get; set; }
}
