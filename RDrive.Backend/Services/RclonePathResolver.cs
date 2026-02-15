using RDrive.Backend.Services;

namespace RDrive.Backend.Services;

public class RclonePathResolver
{
    private readonly RcloneService _rclone;
    
    public RclonePathResolver(RcloneService rclone)
    {
        _rclone = rclone;
    }
    
    public async Task<string> ResolveAsync(string remoteName, string relPath) 
    {
        // Security check: Validate that remoteName exists in configured remotes?
        // For now, we trust the input or we can check against ListRemotesAsync (caching recommended if so)
        // var remotes = await _rclone.ListRemotesAsync();
        // if (!remotes.Contains(remoteName)) throw new KeyNotFoundException($"Remote '{remoteName}' not found.");
        
        // Sanitize relPath
        var safePath = relPath?.Replace("..", "").TrimStart('/').TrimStart('\\') ?? "";
        
        var remotePath = $"{remoteName}:";
        if (!string.IsNullOrEmpty(safePath))
        {
            remotePath += $"/{safePath}";
        }
        
        return remotePath;
    }
    
    public Task<string> GetFsForRemoteAsync(string remoteName)
    {
         if (remoteName.EndsWith(":")) return Task.FromResult(remoteName);
         return Task.FromResult($"{remoteName}:");
    }
}
