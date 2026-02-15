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
    
    public string Remote { get; set; } = string.Empty;
    
    public string Path { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;
    
    public string? Password { get; set; } // Hashed or plain (simple for now per plan)

    public string Creator { get; set; } = string.Empty; // User ID/Email

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? Expiration { get; set; } // Renamed from ExpiresAt in plan to match existing Expiration or vice versa? Plan said ExpiresAt but existing was Expiration. Let's stick to Expiration to match existing.

    public int Views { get; set; }

    public int MaxDownloads { get; set; } // 0 = unlimited
    
    public bool IsPublic { get; set; }

    public List<ShareRecipient> Recipients { get; set; } = new();
}

public class ShareRecipient
{
    public Guid Id { get; set; }
    
    public Guid ShareId { get; set; }
    public Share Share { get; set; } = null!; // Navigation property
    
    public string Email { get; set; } = string.Empty;
    
    public string Permission { get; set; } = "Read"; // Read, Write
}
