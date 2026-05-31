using Cronos;

namespace RDrive.Backend.Services;

/// <summary>
/// Shared cron parsing helpers. Supports both standard 5-field cron expressions
/// (e.g. "0 2 * * *") and 6-field expressions that include seconds.
/// All computations are in UTC to match the rest of the codebase.
/// </summary>
public static class CronHelper
{
    /// <summary>Parse a cron expression. Throws <see cref="CronFormatException"/> on invalid input.</summary>
    public static CronExpression Parse(string cron)
    {
        if (string.IsNullOrWhiteSpace(cron))
            throw new CronFormatException("Cron expression is empty.");

        var fields = cron.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var format = fields.Length >= 6 ? CronFormat.IncludeSeconds : CronFormat.Standard;
        return CronExpression.Parse(cron.Trim(), format);
    }

    /// <summary>Next occurrence strictly after <paramref name="fromUtc"/>, or null if the expression never fires again.</summary>
    public static DateTime? ComputeNext(string cron, DateTime fromUtc)
    {
        var expr = Parse(cron);
        var from = DateTime.SpecifyKind(fromUtc, DateTimeKind.Utc);
        return expr.GetNextOccurrence(from, inclusive: false);
    }
}
