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
public class ScheduledJobsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly RclonePathResolver _resolver;

    public ScheduledJobsController(AppDbContext db, RclonePathResolver resolver)
    {
        _db = db;
        _resolver = resolver;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var jobs = await _db.ScheduledJobs.OrderByDescending(j => j.CreatedAt).ToListAsync();
        return Ok(jobs.Select(ToDto));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] ScheduledJobRequest request)
    {
        // Validate remotes exist
        try
        {
            await _resolver.GetFsForRemoteAsync(request.SourceRemote);
            await _resolver.GetFsForRemoteAsync(request.DestRemote);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }

        DateTime? nextRun;
        try
        {
            nextRun = CronHelper.ComputeNext(request.CronExpression, DateTime.UtcNow);
        }
        catch (Exception)
        {
            return BadRequest(new { error = "Invalid cron expression" });
        }
        if (nextRun == null)
            return BadRequest(new { error = "Cron expression never fires" });

        var job = new ScheduledJob
        {
            Id = Guid.NewGuid(),
            Name = string.IsNullOrWhiteSpace(request.Name) ? null : request.Name.Trim(),
            Type = request.Type,
            IsDir = request.IsDir,
            SourceRemote = request.SourceRemote,
            SourcePath = (request.SourcePath ?? "").TrimStart('/'),
            DestRemote = request.DestRemote,
            DestPath = (request.DestPath ?? "").TrimStart('/'),
            CronExpression = request.CronExpression.Trim(),
            Transfers = request.Transfers,
            BwLimit = string.IsNullOrWhiteSpace(request.BwLimit) ? null : request.BwLimit.Trim(),
            Enabled = request.Enabled,
            NextRunAt = nextRun,
            CreatedAt = DateTime.UtcNow
        };

        _db.ScheduledJobs.Add(job);
        await _db.SaveChangesAsync();
        return Ok(ToDto(job));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] ScheduledJobRequest request)
    {
        var job = await _db.ScheduledJobs.FindAsync(id);
        if (job == null) return NotFound();

        try
        {
            await _resolver.GetFsForRemoteAsync(request.SourceRemote);
            await _resolver.GetFsForRemoteAsync(request.DestRemote);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }

        var newCron = request.CronExpression.Trim();
        var cronChanged = newCron != job.CronExpression;
        if (cronChanged)
        {
            DateTime? nextRun;
            try
            {
                nextRun = CronHelper.ComputeNext(newCron, DateTime.UtcNow);
            }
            catch (Exception)
            {
                return BadRequest(new { error = "Invalid cron expression" });
            }
            if (nextRun == null)
                return BadRequest(new { error = "Cron expression never fires" });
            job.NextRunAt = nextRun;
            job.CronExpression = newCron;
        }

        job.Name = string.IsNullOrWhiteSpace(request.Name) ? null : request.Name.Trim();
        job.Type = request.Type;
        job.IsDir = request.IsDir;
        job.SourceRemote = request.SourceRemote;
        job.SourcePath = (request.SourcePath ?? "").TrimStart('/');
        job.DestRemote = request.DestRemote;
        job.DestPath = (request.DestPath ?? "").TrimStart('/');
        job.Transfers = request.Transfers;
        job.BwLimit = string.IsNullOrWhiteSpace(request.BwLimit) ? null : request.BwLimit.Trim();
        job.Enabled = request.Enabled;

        await _db.SaveChangesAsync();
        return Ok(ToDto(job));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var job = await _db.ScheduledJobs.FindAsync(id);
        if (job == null) return NotFound();
        _db.ScheduledJobs.Remove(job);
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost("{id}/toggle")]
    public async Task<IActionResult> Toggle(Guid id)
    {
        var job = await _db.ScheduledJobs.FindAsync(id);
        if (job == null) return NotFound();

        job.Enabled = !job.Enabled;
        if (job.Enabled && (job.NextRunAt == null || job.NextRunAt <= DateTime.UtcNow))
        {
            try { job.NextRunAt = CronHelper.ComputeNext(job.CronExpression, DateTime.UtcNow); }
            catch { /* leave NextRunAt as-is; scheduler will disable on invalid cron */ }
        }

        await _db.SaveChangesAsync();
        return Ok(ToDto(job));
    }

    [HttpPost("{id}/run-now")]
    public async Task<IActionResult> RunNow(Guid id)
    {
        var job = await _db.ScheduledJobs.FindAsync(id);
        if (job == null) return NotFound();

        if (ScheduledJobRunner.IsPreviousRunActive(_db, job))
            return Conflict(new { error = "Previous run is still active" });

        var task = ScheduledJobRunner.Spawn(_db, job, DateTime.UtcNow);
        await _db.SaveChangesAsync();
        return Ok(new { taskId = task.Id });
    }

    private static ScheduledJobDto ToDto(ScheduledJob j) => new()
    {
        Id = j.Id,
        Name = j.Name,
        Type = j.Type,
        IsDir = j.IsDir,
        SourceRemote = j.SourceRemote,
        SourcePath = j.SourcePath,
        DestRemote = j.DestRemote,
        DestPath = j.DestPath,
        CronExpression = j.CronExpression,
        Transfers = j.Transfers,
        BwLimit = j.BwLimit,
        Enabled = j.Enabled,
        LastRunAt = j.LastRunAt.HasValue ? DateTime.SpecifyKind(j.LastRunAt.Value, DateTimeKind.Utc) : null,
        NextRunAt = j.NextRunAt.HasValue ? DateTime.SpecifyKind(j.NextRunAt.Value, DateTimeKind.Utc) : null,
        LastTaskId = j.LastTaskId,
        CreatedAt = DateTime.SpecifyKind(j.CreatedAt, DateTimeKind.Utc)
    };
}

public class ScheduledJobRequest
{
    public string? Name { get; set; }
    public string Type { get; set; } = "Sync";
    public bool IsDir { get; set; } = true;
    public string SourceRemote { get; set; } = "";
    public string SourcePath { get; set; } = "";
    public string DestRemote { get; set; } = "";
    public string DestPath { get; set; } = "";
    public string CronExpression { get; set; } = "";
    public int? Transfers { get; set; }
    public string? BwLimit { get; set; }
    public bool Enabled { get; set; } = true;
}

public class ScheduledJobDto
{
    public Guid Id { get; set; }
    public string? Name { get; set; }
    public string Type { get; set; } = "";
    public bool IsDir { get; set; }
    public string SourceRemote { get; set; } = "";
    public string SourcePath { get; set; } = "";
    public string DestRemote { get; set; } = "";
    public string DestPath { get; set; } = "";
    public string CronExpression { get; set; } = "";
    public int? Transfers { get; set; }
    public string? BwLimit { get; set; }
    public bool Enabled { get; set; }
    public DateTime? LastRunAt { get; set; }
    public DateTime? NextRunAt { get; set; }
    public Guid? LastTaskId { get; set; }
    public DateTime CreatedAt { get; set; }
}
