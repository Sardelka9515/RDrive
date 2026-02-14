using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RDrive.Backend.Data;
using RDrive.Backend.Models;
using RDrive.Backend.Services;
using System;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using Microsoft.Net.Http.Headers;

namespace RDrive.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/remotes/{remoteName}/files")]
public class FilesController : ControllerBase
{
    private readonly RcloneService _rclone;
    private readonly RclonePathResolver _resolver;
    private readonly HttpClient _httpClient;
    private readonly AppDbContext _db;

    public FilesController(RcloneService rclone, RclonePathResolver resolver, IHttpClientFactory clientFactory, AppDbContext db)
    {
        _rclone = rclone;
        _resolver = resolver;
        _httpClient = clientFactory.CreateClient();
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> ListFiles([FromRoute] string remoteName, [FromQuery] string path = "")
    {
        try
        {
            var fs = await _resolver.GetFsForRemoteAsync(remoteName);
            // Ensure path doesn't start with slash
            var remotePath = path.TrimStart('/');
            var files = await _rclone.ListFilesAsync(fs, remotePath);
            return Ok(files);
        }
        catch (KeyNotFoundException)
        {
            return NotFound("Remote not found");
        }
    }

    [HttpGet("{*path}")]
    public async Task<IActionResult> DownloadFile([FromRoute] string remoteName, [FromRoute] string path)
    {
        try
        {
            var fs = await _resolver.GetFsForRemoteAsync(remoteName);
            var filePath = Uri.UnescapeDataString(path).TrimStart('/');
            
            // Construct internal URL
            // Rclone rc-serve serves at [fs]/[path]
            string internalUrl = $"{_rclone.Client.BaseAddress}[{fs}]/{filePath}";
            
            var request = new HttpRequestMessage(HttpMethod.Get, internalUrl);
            
            // Forward Range header
            if (Request.Headers.TryGetValue("Range", out var range))
            {
                request.Headers.Add("Range", range.ToString());
            }

            request.Headers.Authorization = _rclone.Client.DefaultRequestHeaders.Authorization;

            var response = await _httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            
            if (!response.IsSuccessStatusCode) return StatusCode((int)response.StatusCode);

            var stream = await response.Content.ReadAsStreamAsync();
            
            return File(stream, 
                response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream", 
                enableRangeProcessing: true);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("upload/{*path}")]
    [DisableRequestSizeLimit]
    [RDrive.Backend.Attributes.DisableFormValueModelBinding]
    public async Task<IActionResult> UploadFile([FromRoute] string remoteName, [FromRoute] string path)
    {
        path = Uri.UnescapeDataString(path);
        Console.WriteLine($"Starting Streaming Upload: {path}");
        try
        {
            var fs = await _resolver.GetFsForRemoteAsync(remoteName);
            var dir = Path.GetDirectoryName(path)?.Replace("\\", "/") ?? "";
            var targetFileName = Path.GetFileName(path);

            if (!MultipartRequestHelper.IsMultipartContentType(Request.ContentType))
            {
                return BadRequest($"Unsupported media type: {Request.ContentType}");
            }

            var mediaTypeHeader = Microsoft.Net.Http.Headers.MediaTypeHeaderValue.Parse(Request.ContentType);
            var boundary = MultipartRequestHelper.GetBoundary(mediaTypeHeader, int.MaxValue);
            var reader = new Microsoft.AspNetCore.WebUtilities.MultipartReader(boundary, Request.Body);
            
            var section = await reader.ReadNextSectionAsync();

            while (section != null)
            {
                var hasContentDispositionHeader = Microsoft.Net.Http.Headers.ContentDispositionHeaderValue.TryParse(
                    section.ContentDisposition, out var contentDisposition);

                if (hasContentDispositionHeader)
                {
                    if (MultipartRequestHelper.HasFileContentDisposition(contentDisposition))
                    {
                        var url = $"operations/uploadfile?fs={Uri.EscapeDataString(fs)}&remote={Uri.EscapeDataString(dir)}";
                        
                        using var content = new MultipartFormDataContent();
                        
                        // STREAMING: Pass the section.Body stream directly to HttpClient
                        // rclone rcd via HttpClient needs to read from this stream.
                        using var streamContent = new StreamContent(section.Body);
                        
                        if (section.ContentType != null)
                        {
                            if (System.Net.Http.Headers.MediaTypeHeaderValue.TryParse(section.ContentType, out var contentType))
                            {
                                streamContent.Headers.ContentType = contentType;
                            }
                        }
                        
                        content.Add(streamContent, "file", targetFileName);

                        Console.WriteLine($"Streaming to Rclone: {url}");
                        
                        // Important: Use HttpCompletionOption.ResponseHeadersRead to avoid buffering response, 
                        // but here we are sending *request* body. HttpClient usually streams request bodies by default when using StreamContent.
                        var response = await _rclone.Client.PostAsync(url, content);

                        if (!response.IsSuccessStatusCode)
                        {
                             var error = await response.Content.ReadAsStringAsync();
                             Console.WriteLine($"Rclone error: {response.StatusCode} - {error}");
                             return StatusCode((int)response.StatusCode, error);
                        }
                        
                        Console.WriteLine("Streaming upload successful");
                        return Ok();
                    }
                }

                // Drain any remaining section body (if not the file we wanted, or if we processed it)
                // Actually if we found the file and returned Ok, we don't need to drain.
                // But if we continue looking:
                section = await reader.ReadNextSectionAsync();
            }

            return BadRequest("No file found in request");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Upload Streaming Exception: {ex}");
            return StatusCode(500, ex.Message);
        }
    }
    [HttpDelete("{*path}")]
    public async Task<IActionResult> DeleteItem([FromRoute] string remoteName, [FromRoute] string path)
    {
        try
        {
            var fs = await _resolver.GetFsForRemoteAsync(remoteName);
            var remotePath = Uri.UnescapeDataString(path).TrimStart('/');
            
            // Try deleting as file first
            try 
            {
                await _rclone.DeleteFileAsync(fs, remotePath);
                return Ok();
            }
            catch
            {
                // If failed, try purging as directory
                try
                {
                    await _rclone.PurgeAsync(fs, remotePath);
                    return Ok();
                }
                catch (Exception ex)
                {
                     return BadRequest($"Failed to delete: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("copy/{*path}")]
    public async Task<IActionResult> CopyItem([FromRoute] string remoteName, [FromRoute] string path, [FromBody] FileOperationRequest request)
    {
        try
        {
            var srcPath = Uri.UnescapeDataString(path).TrimStart('/');
            var dstPath = request.DestinationPath.TrimStart('/');
            
            // Validate remotes exist
            await _resolver.GetFsForRemoteAsync(remoteName);
            await _resolver.GetFsForRemoteAsync(request.DestinationRemote);
            
            var task = new RTask
            {
                Id = Guid.NewGuid(),
                Type = "Copy",
                Status = "Queued",
                IsDir = request.IsDir,
                SourceRemote = remoteName,
                SourcePath = srcPath,
                DestRemote = request.DestinationRemote,
                DestPath = dstPath,
                CreatedAt = DateTime.UtcNow
            };
            
            _db.Tasks.Add(task);
            await _db.SaveChangesAsync();
            
            return Ok(task);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("move/{*path}")]
    public async Task<IActionResult> MoveItem([FromRoute] string remoteName, [FromRoute] string path, [FromBody] FileOperationRequest request)
    {
        try
        {
            var srcPath = Uri.UnescapeDataString(path).TrimStart('/');
            var dstPath = request.DestinationPath.TrimStart('/');
            
            // Validate remotes exist
            await _resolver.GetFsForRemoteAsync(remoteName);
            await _resolver.GetFsForRemoteAsync(request.DestinationRemote);
            
            var task = new RTask
            {
                Id = Guid.NewGuid(),
                Type = "Move",
                Status = "Queued",
                IsDir = request.IsDir,
                SourceRemote = remoteName,
                SourcePath = srcPath,
                DestRemote = request.DestinationRemote,
                DestPath = dstPath,
                CreatedAt = DateTime.UtcNow
            };
            
            _db.Tasks.Add(task);
            await _db.SaveChangesAsync();
            
            return Ok(task);
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("rename/{*path}")]
    public async Task<IActionResult> RenameItem([FromRoute] string remoteName, [FromRoute] string path, [FromBody] RenameRequest request)
    {
        try
        {
            var fs = await _resolver.GetFsForRemoteAsync(remoteName);
            var srcPath = Uri.UnescapeDataString(path).TrimStart('/');
            var dstPath = request.NewPath.TrimStart('/');
            
            if (request.IsDir)
            {
                // For directories, use the async job-based move
                var srcFull = $"{fs}/{srcPath}";
                var dstFull = $"{fs}/{dstPath}";
                await _rclone.StartMoveAsync(srcFull, dstFull);
            }
            else
            {
                // For files, use the synchronous move
                await _rclone.MoveFileAsync(fs, srcPath, fs, dstPath);
            }
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("mkdir/{*path}")]
    public async Task<IActionResult> CreateDirectory([FromRoute] string remoteName, [FromRoute] string path)
    {
        try
        {
            var fs = await _resolver.GetFsForRemoteAsync(remoteName);
            var remotePath = Uri.UnescapeDataString(path).TrimStart('/');
            
            await _rclone.MkdirAsync(fs, remotePath);
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest(ex.Message);
        }
    }
}

public class FileOperationRequest
{
    public string DestinationRemote { get; set; } = "";
    public string DestinationPath { get; set; } = "";
    public bool IsDir { get; set; }
}

public class RenameRequest
{
    public string NewPath { get; set; } = "";
    public bool IsDir { get; set; }
}

public static class MultipartRequestHelper
{
    public static string GetBoundary(Microsoft.Net.Http.Headers.MediaTypeHeaderValue contentType, int lengthLimit)
    {
        var boundary = Microsoft.Net.Http.Headers.HeaderUtilities.RemoveQuotes(contentType.Boundary).Value;
        if (string.IsNullOrWhiteSpace(boundary))
        {
            throw new InvalidDataException("Missing content-type boundary.");
        }

        if (boundary.Length > lengthLimit)
        {
            throw new InvalidDataException($"Multipart boundary length limit {lengthLimit} exceeded.");
        }

        return boundary;
    }

    public static bool IsMultipartContentType(string contentType)
    {
        return !string.IsNullOrEmpty(contentType) && contentType.IndexOf("multipart/", StringComparison.OrdinalIgnoreCase) >= 0;
    }

    public static bool HasFileContentDisposition(Microsoft.Net.Http.Headers.ContentDispositionHeaderValue contentDisposition)
    {
        return contentDisposition != null
               && contentDisposition.DispositionType.Equals("form-data")
               && (!Microsoft.Extensions.Primitives.StringSegment.IsNullOrEmpty(contentDisposition.FileName)
                   || !Microsoft.Extensions.Primitives.StringSegment.IsNullOrEmpty(contentDisposition.FileNameStar));
    }
}
