using System.ComponentModel.DataAnnotations;

namespace RDrive.Backend.Models;

public class RTask 
{
    public Guid Id { get; set; }
    
    public long RcloneJobId { get; set; }
    
    public string Type { get; set; } = "Sync"; // Sync, Copy, Move
    
    public string Status { get; set; } = "Pending"; // Queued, Pending, Running, Completed, Failed, Stopped
    
    public bool IsDir { get; set; }
    
    public string SourceRemote { get; set; } = string.Empty;
    public string SourcePath { get; set; } = string.Empty;
    public string DestRemote { get; set; } = string.Empty;
    public string DestPath { get; set; } = string.Empty;
    
    public string? Error { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
}

public class Share
{
    public Guid Id { get; set; }
    
    public int SpaceId { get; set; }
    
    public string Path { get; set; } = string.Empty;
    
    public DateTime? Expiration { get; set; }
    
    public bool IsPublic { get; set; }
}
