using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Options;
using RDrive.Backend.Models;
using System.Text.Json;

namespace RDrive.Backend.Services;

public class RcloneService
{
    private readonly HttpClient _http;
    private readonly RcloneOptions _options;

    public RcloneService(HttpClient http, IOptions<RcloneOptions> options)
    {
        _http = http;
        _options = options.Value;
        
        var rcloneUrl = _options.Address;
        if (!rcloneUrl.EndsWith("/")) rcloneUrl += "/";
        _http.BaseAddress = new Uri(rcloneUrl);
        
        var authToken = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{_options.User}:{_options.Password}"));
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", authToken);
    }
    
    public async Task<HttpResponseMessage> DownloadFileAsync(string fs, string remote, string? range = null)
    {
        remote = remote.TrimStart('/');
        var url = $"[{fs}]/{remote}"; // Rclone RC VFS syntax

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (!string.IsNullOrEmpty(range))
        {
            request.Headers.Add("Range", range);
        }

        var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
        // We do NOT call EnsureSuccessStatusCode here because the caller might want to handle 404 or 416 (Range Not Satisfiable)
        return response;
    }

    public async Task UploadToRemoteAsync(string fs, string remoteDir, string fileName, Stream content, string? contentType = null)
    {
        // Use query parameters for fs and remote to ensure Rclone handles them correctly/immediately
        // and to match the previously working implementation in FilesController.
        // Also ensure form key is "file".
        
        var url = $"operations/uploadfile?fs={Uri.EscapeDataString(fs)}&remote={Uri.EscapeDataString(remoteDir)}";
        
        using var formData = new MultipartFormDataContent();
        
        var streamContent = new StreamContent(content);
        if (!string.IsNullOrEmpty(contentType))
        {
            if (MediaTypeHeaderValue.TryParse(contentType, out var mt))
            {
                streamContent.Headers.ContentType = mt;
            }
        }
        
        formData.Add(streamContent, "file", fileName);
        
        // Important: Rclone might return an error structure if 200 OK is not returned.
        var response = await _http.PostAsync(url, formData);
        
        if (!response.IsSuccessStatusCode)
        {
             var error = await response.Content.ReadAsStringAsync();
             throw new Exception($"Rclone upload failed: {response.StatusCode} - {error}");
        }
    }

    public async Task<List<RcloneFileItem>> ListFilesAsync(string fs, string remote)
    {
        if (!fs.EndsWith(':'))
        {
            throw new ArgumentException("fs should end with ':'", nameof(fs));
        }
        var payload = new
        {
            fs = fs,
            remote = remote,
            opt = new { showMime = true, showTime = true, showSize = true }
        };

        var response = await _http.PostAsJsonAsync("operations/list", payload);
        response.EnsureSuccessStatusCode();
        
        var result = await response.Content.ReadFromJsonAsync<RcloneListResponse>();
        return result?.List ?? new List<RcloneFileItem>();
    }

    public async Task<List<string>> ListRemotesAsync()
    {
        var response = await _http.PostAsJsonAsync("config/listremotes", new { });
        response.EnsureSuccessStatusCode();
        
        var result = await response.Content.ReadFromJsonAsync<RcloneRemotesResponse>();
        return result?.Remotes ?? new List<string>();
    }
    
    public async Task<long> StartSyncAsync(string srcFs, string dstFs)
    {
        var payload = new
        {
            srcFs = srcFs,
            dstFs = dstFs,
            _async = true
        };

        var response = await _http.PostAsJsonAsync("sync/sync", payload);
        response.EnsureSuccessStatusCode();
        
        var result = await response.Content.ReadFromJsonAsync<RcloneJobStartResponse>();
        return result?.JobId ?? 0;
    }
    
    public async Task<long> StartCopyAsync(string srcFs, string dstFs)
    {
        var payload = new
        {
            srcFs = srcFs,
            dstFs = dstFs,
            _async = true
        };

        var response = await _http.PostAsJsonAsync("sync/copy", payload);
        response.EnsureSuccessStatusCode();
        
        var result = await response.Content.ReadFromJsonAsync<RcloneJobStartResponse>();
        return result?.JobId ?? 0;
    }
    
    public async Task<RcloneJobStatusResponse?> GetJobStatusAsync(long jobId)
    {
        var payload = new { jobid = jobId };
        var response = await _http.PostAsJsonAsync("job/status", payload);
        response.EnsureSuccessStatusCode();
        
        return await response.Content.ReadFromJsonAsync<RcloneJobStatusResponse>();
    }
    
    public async Task StopJobAsync(long jobId)
    {
        var payload = new { jobid = jobId };
        await _http.PostAsJsonAsync("job/stop", payload);
    }

    public async Task<RcloneStatsResponse?> GetTransferStatsAsync(string? group = null)
    {
        var payload = group != null ? new { group } : (object)new { };
        var response = await _http.PostAsJsonAsync("core/stats", payload);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<RcloneStatsResponse>();
    }

    public async Task DeleteFileAsync(string fs, string remote)
    {
        var payload = new { fs = fs, remote = remote };
        var response = await _http.PostAsJsonAsync("operations/deletefile", payload);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new Exception($"Rclone delete failed: {error}");
        }
    }

    public async Task PurgeAsync(string fs, string remote)
    {
        var payload = new { fs = fs, remote = remote };
        var response = await _http.PostAsJsonAsync("operations/purge", payload);
        if (!response.IsSuccessStatusCode)
        {
            // rmdir is cleaner if empty, but purge forces it. 
            // If purge fails (e.g. not found), try rmdir? 
            // Let's stick to purge for now as it deletes everything inside.
            var error = await response.Content.ReadAsStringAsync();
            throw new Exception($"Rclone purge failed: {error}");
        }
    }

    public async Task MoveFileAsync(string srcFs, string srcRemote, string dstFs, string dstRemote)
    {
        var payload = new { srcFs = srcFs, srcRemote = srcRemote, dstFs = dstFs, dstRemote = dstRemote };
        var response = await _http.PostAsJsonAsync("operations/movefile", payload);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new Exception($"Rclone move failed: {error}");
        }
    }

    public async Task CopyFileAsync(string srcFs, string srcRemote, string dstFs, string dstRemote)
    {
        var payload = new { srcFs = srcFs, srcRemote = srcRemote, dstFs = dstFs, dstRemote = dstRemote };
        var response = await _http.PostAsJsonAsync("operations/copyfile", payload);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new Exception($"Rclone copy failed: {error}");
        }
    }

    public async Task<long> StartCopyFileAsync(string srcFs, string srcRemote, string dstFs, string dstRemote)
    {
        var payload = new { srcFs = srcFs, srcRemote = srcRemote, dstFs = dstFs, dstRemote = dstRemote, _async = true };
        var response = await _http.PostAsJsonAsync("operations/copyfile", payload);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<RcloneJobStartResponse>();
        return result?.JobId ?? 0;
    }

    public async Task<long> StartMoveFileAsync(string srcFs, string srcRemote, string dstFs, string dstRemote)
    {
        var payload = new { srcFs = srcFs, srcRemote = srcRemote, dstFs = dstFs, dstRemote = dstRemote, _async = true };
        var response = await _http.PostAsJsonAsync("operations/movefile", payload);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<RcloneJobStartResponse>();
        return result?.JobId ?? 0;
    }

    public async Task<long> StartMoveAsync(string srcFs, string dstFs)
    {
        var payload = new { srcFs = srcFs, dstFs = dstFs, _async = true };
        var response = await _http.PostAsJsonAsync("sync/move", payload);
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<RcloneJobStartResponse>();
        return result?.JobId ?? 0;
    }

    public async Task MkdirAsync(string fs, string remote)
    {
        var payload = new { fs = fs, remote = remote };
        var response = await _http.PostAsJsonAsync("operations/mkdir", payload);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new Exception($"Rclone mkdir failed: {error}");
        }
    }

    // --- Config management ---

    public async Task<List<RcloneProvider>> GetProvidersAsync()
    {
        var response = await _http.PostAsJsonAsync("config/providers", new { });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<RcloneProvidersResponse>();
        return result?.Providers ?? new List<RcloneProvider>();
    }

    public async Task<Dictionary<string, string>> GetRemoteConfigAsync(string name)
    {
        var response = await _http.PostAsJsonAsync("config/get", new { name });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<Dictionary<string, string>>();
        return result ?? new Dictionary<string, string>();
    }

    public async Task CreateRemoteAsync(string name, string type, Dictionary<string, string> parameters)
    {
        var payload = new
        {
            name,
            type,
            parameters,
            opt = new { obscure = true, nonInteractive = true }
        };
        var response = await _http.PostAsJsonAsync("config/create", payload);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new Exception($"Rclone config/create failed: {error}");
        }
    }

    public async Task UpdateRemoteAsync(string name, Dictionary<string, string> parameters)
    {
        var payload = new
        {
            name,
            parameters,
            opt = new { obscure = true, nonInteractive = true }
        };
        var response = await _http.PostAsJsonAsync("config/update", payload);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new Exception($"Rclone config/update failed: {error}");
        }
    }

    public async Task DeleteRemoteAsync(string name)
    {
        var response = await _http.PostAsJsonAsync("config/delete", new { name });
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync();
            throw new Exception($"Rclone config/delete failed: {error}");
        }
    }

    public async Task<Dictionary<string, Dictionary<string, string>>> ConfigDumpAsync()
    {
        var response = await _http.PostAsJsonAsync("config/dump", new { });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<Dictionary<string, Dictionary<string, string>>>();
        return result ?? new Dictionary<string, Dictionary<string, string>>();
    }

    // Deprecated/Legacy wrappers
    public async Task<Stream> GetFileStreamAsync(string fs, string remote)
    {
        var response = await DownloadFileAsync(fs, remote);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadAsStreamAsync();
    }

    public async Task UploadFileStreamAsync(string fs, string remotePath, Stream content, string contentType)
    {
         // Legacy adapter: remotePath is full path including filename
         var dir = Path.GetDirectoryName(remotePath)?.Replace("\\", "/") ?? "";
         var filename = Path.GetFileName(remotePath);
         await UploadToRemoteAsync(fs, dir, filename, content, contentType);
    }
    
    // Helper to get raw HttpClient for streaming if needed, or expose specific methods
    public HttpClient Client => _http;
}

