using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RDrive.Backend.Data;
using RDrive.Backend.Models;

namespace RDrive.Backend.Services;

/// <summary>
/// Background service that picks up Queued tasks and launches them via rclone.
/// Runs with a configurable max concurrency (default: 2 simultaneous jobs).
/// </summary>
public class JobQueueService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<JobQueueService> _logger;
    private const int MaxConcurrentJobs = 1;
    private const int PollIntervalMs = 2000;

    public JobQueueService(IServiceScopeFactory scopeFactory, ILogger<JobQueueService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Wait a bit for rclone to start
        await Task.Delay(3000, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessQueueAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing job queue");
            }

            await Task.Delay(PollIntervalMs, stoppingToken);
        }
    }

    private async Task ProcessQueueAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var rclone = scope.ServiceProvider.GetRequiredService<RcloneService>();
        var resolver = scope.ServiceProvider.GetRequiredService<RclonePathResolver>();

        // Count currently running jobs
        var runningCount = await db.Tasks.CountAsync(t => t.Status == "Running", ct);
        if (runningCount >= MaxConcurrentJobs) return;

        var slotsAvailable = MaxConcurrentJobs - runningCount;

        // Get oldest queued tasks up to available slots
        var queuedTasks = await db.Tasks
            .Where(t => t.Status == "Queued")
            .OrderBy(t => t.CreatedAt)
            .Take(slotsAvailable)
            .ToListAsync(ct);

        foreach (var task in queuedTasks)
        {
            try
            {
                var srcFs = await resolver.GetFsForRemoteAsync(task.SourceRemote);
                var dstFs = await resolver.GetFsForRemoteAsync(task.DestRemote);

                long jobId = 0;

                switch (task.Type)
                {
                    case "Copy":
                        if (task.IsDir)
                        {
                            var srcFull = srcFs + "/" + task.SourcePath;
                            var dstFull = dstFs + "/" + task.DestPath;
                            jobId = await rclone.StartCopyAsync(srcFull, dstFull);
                        }
                        else
                        {
                            jobId = await rclone.StartCopyFileAsync(srcFs, task.SourcePath, dstFs, task.DestPath);
                        }
                        break;

                    case "Move":
                        if (task.IsDir)
                        {
                            var srcFull = srcFs + "/" + task.SourcePath;
                            var dstFull = dstFs + "/" + task.DestPath;
                            jobId = await rclone.StartMoveAsync(srcFull, dstFull);
                        }
                        else
                        {
                            jobId = await rclone.StartMoveFileAsync(srcFs, task.SourcePath, dstFs, task.DestPath);
                        }
                        break;

                    case "Sync":
                        {
                            var srcFull = srcFs + "/" + task.SourcePath;
                            var dstFull = dstFs + "/" + task.DestPath;
                            jobId = await rclone.StartSyncAsync(srcFull, dstFull);
                        }
                        break;

                    default:
                        _logger.LogWarning("Unknown task type: {Type}", task.Type);
                        task.Status = "Failed";
                        task.Error = $"Unknown task type: {task.Type}";
                        task.FinishedAt = DateTime.UtcNow;
                        continue;
                }

                task.RcloneJobId = jobId;
                task.Status = "Running";
                task.StartedAt = DateTime.UtcNow;
                task.Error = null;
                task.FinishedAt = null;

                _logger.LogInformation("Started {Type} job {Id} (rclone job {JobId})", task.Type, task.Id, jobId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to start queued task {Id}", task.Id);
                task.Status = "Failed";
                task.Error = ex.Message;
                task.FinishedAt = DateTime.UtcNow;
            }
        }

        if (queuedTasks.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
