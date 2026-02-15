using System.Text.Json.Serialization;

namespace RDrive.Backend.Models;

public class CreateShareRequest
{
    public string Remote { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Password { get; set; }
    public DateTime? Expiration { get; set; }
    public int MaxDownloads { get; set; }
    public bool IsPublic { get; set; }
    public List<ShareRecipientDto> Recipients { get; set; } = new();
}

public class UpdateShareRequest
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string? Password { get; set; }
    public DateTime? Expiration { get; set; }
    public int MaxDownloads { get; set; }
    public bool IsPublic { get; set; }
    public List<ShareRecipientDto> Recipients { get; set; } = new();
}

public class ShareRecipientDto
{
    public string Email { get; set; } = string.Empty;
    public string Permission { get; set; } = "Read"; // Read, Write
}

public class ShareResponse
{
    public Guid Id { get; set; }
    public string Remote { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool HasPassword { get; set; }
    public string Creator { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? Expiration { get; set; }
    public int Views { get; set; }
    public int MaxDownloads { get; set; }
    public bool IsPublic { get; set; }
    public List<ShareRecipientDto> Recipients { get; set; } = new();
}

public class PublicShareInfo
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool HasPassword { get; set; }
    public bool Writeable { get; set; } // If the current user/session has write access (or public write)
    public DateTime? Expiration { get; set; }
}

public class ShareAuthRequest
{
    public string Password { get; set; } = string.Empty;
}

public class ShareAuthResponse
{
    public string Token { get; set; } = string.Empty;
}
