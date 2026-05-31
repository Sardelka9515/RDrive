using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RDrive.Backend.Data;
using RDrive.Backend.Models;

namespace RDrive.Backend.Services;

/// <summary>
/// Shared logic for turning a <see cref="ScheduledJob"/> into a queued <see cref="RTask"/>.
/// Used by both the scheduler loop and the controller's "run now" endpoint.
/// </summary>
public static class ScheduledJobRunner
{
    private static readonly string[] ActiveStatuses = { "Queued", "Pending", "Running" };

    /// <summary>True if the schedule's most recently spawned task is still active (overlap).</summary>
    public static bool IsPreviousRunActive(AppDbContext db, ScheduledJob job)
    {
        if (job.LastTaskId is not Guid id) return false;
        var prev = db.Tasks.Find(id);
        return prev != null && ActiveStatuses.Contains(prev.Status);
    }

    /// <summary>Create a queued task from the schedule and record it as the latest run. Does not touch NextRunAt.</summary>
    public static RTask Spawn(AppDbContext db, ScheduledJob job, DateTime now)
    {
        var task = new RTask
        {
            Id = Guid.NewGuid(),
            Type = job.Type,
            Status = "Queued",
            IsDir = job.Type == "Sync" || job.IsDir, // Sync is always directory-level
            SourceRemote = job.SourceRemote,
            SourcePath = job.SourcePath,
            DestRemote = job.DestRemote,
            DestPath = job.DestPath,
            Transfers = job.Transfers,
            BwLimit = job.BwLimit,
            CreatedAt = now
        };
        db.Tasks.Add(task);
        job.LastRunAt = now;
        job.LastTaskId = task.Id;
        return task;
    }
}

/// <summary>
/// Background worker that fires due scheduled jobs by spawning queued tasks (picked up by
/// <see cref="JobQueueService"/>). If a schedule's previous run is still active, the cycle is
/// skipped without advancing NextRunAt, so exactly one catch-up run fires once the slot frees.
/// </summary>
public class JobSchedulerService : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<JobSchedulerService> _logger;
    private const int PollIntervalMs = 15000;

    public JobSchedulerService(IServiceScopeFactory scopeFactory, ILogger<JobSchedulerService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Let rclone and the job queue settle before the first tick.
        await Task.Delay(5000, stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing scheduled jobs");
            }

            await Task.Delay(PollIntervalMs, stoppingToken);
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var now = DateTime.UtcNow;
        var due = await db.ScheduledJobs
            .Where(s => s.Enabled && s.NextRunAt != null && s.NextRunAt <= now)
            .ToListAsync(ct);

        if (due.Count == 0) return;

        foreach (var job in due)
        {
            if (ScheduledJobRunner.IsPreviousRunActive(db, job))
            {
                _logger.LogInformation("Schedule {Id} due but previous run still active — skipping (overlap)", job.Id);
                continue; // NextRunAt left in the past => retried next tick once the slot frees
            }

            var task = ScheduledJobRunner.Spawn(db, job, now);

            try
            {
                job.NextRunAt = CronHelper.ComputeNext(job.CronExpression, now);
            }
            catch (Exception ex)
            {
                // Invalid cron should have been rejected at create/update time; disable defensively.
                _logger.LogError(ex, "Schedule {Id} has invalid cron '{Cron}' — disabling", job.Id, job.CronExpression);
                job.Enabled = false;
                job.NextRunAt = null;
            }

            _logger.LogInformation("Scheduled job {Id} spawned task {TaskId} (next run {Next})", job.Id, task.Id, job.NextRunAt);
        }

        await db.SaveChangesAsync(ct);
    }
}
