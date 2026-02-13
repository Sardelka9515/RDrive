using System.Text.Json.Serialization;

namespace RDrive.Backend.Models;

public class RcloneListResponse
{
    [JsonPropertyName("list")]
    public List<RcloneFileItem> List { get; set; } = new();
}

public class RcloneRemotesResponse
{
    [JsonPropertyName("remotes")]
    public List<string> Remotes { get; set; } = new();
}

public class RcloneFileItem
{
    [JsonPropertyName("Path")]
    public string Path { get; set; } = string.Empty;

    [JsonPropertyName("Name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("Size")]
    public long Size { get; set; }

    [JsonPropertyName("MimeType")]
    public string MimeType { get; set; } = string.Empty;

    [JsonPropertyName("ModTime")]
    public DateTime ModTime { get; set; }

    [JsonPropertyName("IsDir")]
    public bool IsDir { get; set; }

    [JsonPropertyName("ID")]
    public string Id { get; set; } = string.Empty;
}

public class RcloneJobStartResponse
{
    [JsonPropertyName("jobid")]
    public long JobId { get; set; }
}

public class RcloneJobStatusResponse
{
    [JsonPropertyName("duration")]
    public double Duration { get; set; }
    
    [JsonPropertyName("endTime")]
    public string EndTime { get; set; } = string.Empty;
    
    [JsonPropertyName("error")]
    public string Error { get; set; } = string.Empty;
    
    [JsonPropertyName("finished")]
    public bool Finished { get; set; }
    
    [JsonPropertyName("id")]
    public long Id { get; set; }
    
    [JsonPropertyName("startTime")]
    public string StartTime { get; set; } = string.Empty;
    
    [JsonPropertyName("success")]
    public bool Success { get; set; }
    
    [JsonPropertyName("output")]
    public object Output { get; set; }
}

public class RcloneStatsResponse
{
    [JsonPropertyName("bytes")]
    public long Bytes { get; set; }
    
    [JsonPropertyName("checks")]
    public long Checks { get; set; }
    
    [JsonPropertyName("deletedDirs")]
    public long DeletedDirs { get; set; }
    
    [JsonPropertyName("deletes")]
    public long Deletes { get; set; }
    
    [JsonPropertyName("elapsedTime")]
    public double ElapsedTime { get; set; }
    
    [JsonPropertyName("errors")]
    public long Errors { get; set; }
    
    [JsonPropertyName("eta")]
    public long? Eta { get; set; }
    
    [JsonPropertyName("fatalError")]
    public bool FatalError { get; set; }
    
    [JsonPropertyName("renames")]
    public long Renames { get; set; }
    
    [JsonPropertyName("retryError")]
    public bool RetryError { get; set; }
    
    [JsonPropertyName("speed")]
    public double Speed { get; set; }
    
    [JsonPropertyName("totalBytes")]
    public long TotalBytes { get; set; }
    
    [JsonPropertyName("totalChecks")]
    public long TotalChecks { get; set; }
    
    [JsonPropertyName("totalTransfers")]
    public long TotalTransfers { get; set; }
    
    [JsonPropertyName("transferTime")]
    public double TransferTime { get; set; }
    
    [JsonPropertyName("transfers")]
    public long Transfers { get; set; }
    
    [JsonPropertyName("transferring")]
    public List<RcloneTransferringItem>? Transferring { get; set; }
}

public class RcloneTransferringItem
{
    [JsonPropertyName("bytes")]
    public long Bytes { get; set; }
    
    [JsonPropertyName("eta")]
    public long? Eta { get; set; }
    
    [JsonPropertyName("group")]
    public string Group { get; set; } = string.Empty;
    
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;
    
    [JsonPropertyName("percentage")]
    public int Percentage { get; set; }
    
    [JsonPropertyName("size")]
    public long Size { get; set; }
    
    [JsonPropertyName("speed")]
    public double Speed { get; set; }
    
    [JsonPropertyName("speedAvg")]
    public double SpeedAvg { get; set; }
}

// --- Config / Provider types ---

public class RcloneProvidersResponse
{
    [JsonPropertyName("providers")]
    public List<RcloneProvider> Providers { get; set; } = new();
}

public class RcloneProvider
{
    [JsonPropertyName("Name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("Description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("Prefix")]
    public string Prefix { get; set; } = string.Empty;

    [JsonPropertyName("Options")]
    public List<RcloneProviderOption> Options { get; set; } = new();
}

public class RcloneProviderOption
{
    [JsonPropertyName("Name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("FieldName")]
    public string FieldName { get; set; } = string.Empty;

    [JsonPropertyName("Help")]
    public string Help { get; set; } = string.Empty;

    [JsonPropertyName("Provider")]
    public string Provider { get; set; } = string.Empty;

    [JsonPropertyName("Default")]
    public object? Default { get; set; }

    [JsonPropertyName("Examples")]
    public List<RcloneOptionExample>? Examples { get; set; }

    [JsonPropertyName("Required")]
    public bool Required { get; set; }

    [JsonPropertyName("IsPassword")]
    public bool IsPassword { get; set; }

    [JsonPropertyName("Advanced")]
    public bool Advanced { get; set; }

    [JsonPropertyName("Exclusive")]
    public bool Exclusive { get; set; }

    [JsonPropertyName("Sensitive")]
    public bool Sensitive { get; set; }

    [JsonPropertyName("Hide")]
    public int Hide { get; set; }

    [JsonPropertyName("NoPrefix")]
    public bool NoPrefix { get; set; }
}

public class RcloneOptionExample
{
    [JsonPropertyName("Value")]
    public string Value { get; set; } = string.Empty;

    [JsonPropertyName("Help")]
    public string Help { get; set; } = string.Empty;

    [JsonPropertyName("Provider")]
    public string Provider { get; set; } = string.Empty;
}

public class CreateRemoteRequest
{
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public Dictionary<string, string> Parameters { get; set; } = new();
}

public class UpdateRemoteRequest
{
    public Dictionary<string, string> Parameters { get; set; } = new();
}
