using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using RDrive.Backend.Data;
using RDrive.Backend.Models;
using RDrive.Backend.Services;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace RDrive.Backend.Controllers;

[ApiController]
[Route("api/p/shares")]
public class PublicSharesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly RcloneService _rclone;
    private readonly RclonePathResolver _resolver;
    private static readonly byte[] _secretKey = RandomNumberGenerator.GetBytes(32); // specific to this instance run

    public PublicSharesController(AppDbContext db, RcloneService rclone, RclonePathResolver resolver)
    {
        _db = db;
        _rclone = rclone;
        _resolver = resolver;
    }

    [HttpGet("{id}/info")]
    public async Task<IActionResult> GetInfo(Guid id)
    {
        var share = await _db.Shares.FindAsync(id);
        if (share == null) return NotFound("Share not found.");

        // Handle expiration
        if (share.Expiration.HasValue && share.Expiration < DateTime.UtcNow)
            return NotFound("Share expired.");

        // We do NOT require auth to see basic info (like "Password Required")
        // But if it is user-restricted, maybe we should hide it?
        // For now, minimal info leak.

        return Ok(new PublicShareInfo
        {
            Id = share.Id,
            Name = share.Name,
            Description = share.Description,
            HasPassword = !string.IsNullOrEmpty(share.Password),
            Expiration = share.Expiration,
            Writeable = share.AllowWrite
        });
    }

    [HttpPost("{id}/auth")]
    public async Task<IActionResult> Authenticate(Guid id, [FromBody] ShareAuthRequest request)
    {
        var share = await _db.Shares.FindAsync(id);
        if (share == null) return NotFound();

        if (share.Expiration.HasValue && share.Expiration < DateTime.UtcNow)
            return BadRequest("Share expired.");

        if (string.IsNullOrEmpty(share.Password))
            return Ok(new ShareAuthResponse { Token = GenerateToken(id) }); // No password needed

        if (share.Password != request.Password) // Simple comparison for now (TODO: Hash)
            return Unauthorized("Invalid password.");

        return Ok(new ShareAuthResponse { Token = GenerateToken(id) });
    }

    [HttpGet("{id}/files/{*path}")]
    public async Task<IActionResult> ListFiles(Guid id, string? path = "")
    {
        if (!AuthorizeAccess(id, out var share)) return Unauthorized();

        // Verify path traversal
        path = path?.TrimStart('/') ?? "";
        if (path.Contains("..")) return BadRequest("Invalid path.");

        // Construct full path
        var remotePath = string.IsNullOrEmpty(share!.Path) ? path : $"{share.Path}/{path}".Trim('/');
        // Ensure we don't end with slash if it's empty, but ListFilesAsync handles directories.
        // If path is empty, we list share.Path.

        try
        {
            var files = await _rclone.ListFilesAsync(await _resolver.GetFsForRemoteAsync(share.Remote), remotePath);
            return Ok(files);
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to list files: {ex.Message}");
        }
    }

    [HttpGet("{id}/download/{*path}")]
    public async Task<IActionResult> DownloadFile(Guid id, string path)
    {
        if (!AuthorizeAccess(id, out var share)) return Unauthorized();

        if (share!.MaxDownloads > 0)
        {
            // Check downloads count strictly? This is racy without locking but fine for soft limits.
            // Also "Views" vs "Downloads". Let's assume MaxDownloads applies to file downloads.
            // Ideally we track this in DB.
            // For now, let's just increment Views as proxy or ignore for this MVP.
        }

        path = path.TrimStart('/');
        if (path.Contains("..")) return BadRequest("Invalid path.");

        var remotePath = string.IsNullOrEmpty(share.Path) ? path : $"{share.Path}/{path}".TrimStart('/');

        try
        {
            var fs = await _resolver.GetFsForRemoteAsync(share.Remote);
            var response = await _rclone.DownloadFileAsync(fs, remotePath, Request.Headers["Range"].ToString());
            
            if (!response.IsSuccessStatusCode) return StatusCode((int)response.StatusCode);

            var stream = await response.Content.ReadAsStreamAsync();
            
            return File(stream, 
                response.Content.Headers.ContentType?.ToString() ?? "application/octet-stream", 
                enableRangeProcessing: true,
                fileDownloadName: Path.GetFileName(path));
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to get file: {ex.Message}");
        }
    }

    [HttpPost("{id}/upload/{*path}")]
    public async Task<IActionResult> UploadFile(Guid id, string path, IFormFile file)
    {
        if (!AuthorizeAccess(id, out var share, requireWrite: true)) return Unauthorized();

        path = path.TrimStart('/');
        if (path.Contains("..")) return BadRequest("Invalid path.");

        var remotePath = string.IsNullOrEmpty(share!.Path) ? path : $"{share.Path}/{path}".TrimStart('/');
        // remotePath here is the DIRECTORY or the FILE? 
        // path parameter usually implies directory for upload, or we use the file name?
        // Let's assume `path` is the target directory. The filename comes from IFormFile.

        var dir = remotePath; // We upload TO this directory.

        try
        {
            using var stream = file.OpenReadStream();
            var fs = await _resolver.GetFsForRemoteAsync(share.Remote);
            
            await _rclone.UploadToRemoteAsync(fs, dir, file.FileName, stream, file.ContentType);
            
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to upload: {ex.Message}");
        }
    }

    [HttpDelete("{id}/files/{*path}")]
    public async Task<IActionResult> DeleteItem(Guid id, string path)
    {
        if (!AuthorizeAccess(id, out var share, requireWrite: true)) return Unauthorized();

        path = path.TrimStart('/');
        if (path.Contains("..")) return BadRequest("Invalid path.");

        var remotePath = string.IsNullOrEmpty(share!.Path) ? path : $"{share.Path}/{path}".TrimStart('/');

        try
        {
            var fs = await _resolver.GetFsForRemoteAsync(share.Remote);
            // Try deleting as a file first; fall back to purging a directory.
            try
            {
                await _rclone.DeleteFileAsync(fs, remotePath);
                return Ok();
            }
            catch
            {
                await _rclone.PurgeAsync(fs, remotePath);
                return Ok();
            }
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to delete: {ex.Message}");
        }
    }

    [HttpPost("{id}/rename/{*path}")]
    public async Task<IActionResult> RenameItem(Guid id, string path, [FromBody] RenameRequest request)
    {
        if (!AuthorizeAccess(id, out var share, requireWrite: true)) return Unauthorized();

        path = path.TrimStart('/');
        var newPath = request.NewPath.TrimStart('/');
        if (path.Contains("..") || newPath.Contains("..")) return BadRequest("Invalid path.");

        var srcPath = string.IsNullOrEmpty(share!.Path) ? path : $"{share.Path}/{path}".TrimStart('/');
        var dstPath = string.IsNullOrEmpty(share.Path) ? newPath : $"{share.Path}/{newPath}".TrimStart('/');

        try
        {
            var fs = await _resolver.GetFsForRemoteAsync(share.Remote);
            if (request.IsDir)
            {
                await _rclone.StartMoveAsync($"{fs}/{srcPath}", $"{fs}/{dstPath}");
            }
            else
            {
                await _rclone.MoveFileAsync(fs, srcPath, fs, dstPath);
            }
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to rename: {ex.Message}");
        }
    }

    [HttpPost("{id}/mkdir/{*path}")]
    public async Task<IActionResult> CreateDirectory(Guid id, string path)
    {
        if (!AuthorizeAccess(id, out var share, requireWrite: true)) return Unauthorized();

        path = path.TrimStart('/');
        if (path.Contains("..")) return BadRequest("Invalid path.");

        var remotePath = string.IsNullOrEmpty(share!.Path) ? path : $"{share.Path}/{path}".TrimStart('/');

        try
        {
            var fs = await _resolver.GetFsForRemoteAsync(share.Remote);
            await _rclone.MkdirAsync(fs, remotePath);
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to create directory: {ex.Message}");
        }
    }

    private bool AuthorizeAccess(Guid shareId, out Share? share, bool requireWrite = false)
    {
        share = _db.Shares.Include(s => s.Recipients).FirstOrDefault(s => s.Id == shareId);
        if (share == null) return false;

        if (share.Expiration.HasValue && share.Expiration < DateTime.UtcNow) return false;

        // 1. Check Token (if password protected or strict)
        // Check "X-Share-Token" header
        if (!string.IsNullOrEmpty(share.Password))
        {
            if (!Request.Headers.TryGetValue("X-Share-Token", out var tokenVals)) return false;
            var token = tokenVals.ToString();
            if (!ValidateToken(token, shareId)) return false;
        }

        // 2. Read gate — restricted (non-public) shares require a logged-in recipient.
        if (!share.IsPublic)
        {
            if (share.Recipients.Any())
            {
                // Note: this controller is not [Authorize]; we read the ambient bearer identity if present.
                var userEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? User.Identity?.Name;
                if (string.IsNullOrEmpty(userEmail)) return false; // Not logged in

                var recipient = share.Recipients.FirstOrDefault(r => r.Email.Equals(userEmail, StringComparison.OrdinalIgnoreCase));
                if (recipient == null) return false; // Not on the list
            }
            else
            {
                return false; // Not public, no recipients -> no access
            }
        }

        // 3. Write gate — editing is allowed whenever the share is marked editable.
        // Anyone who passes the read gate above (incl. the password token, when set) may write.
        if (requireWrite && !share.AllowWrite) return false;

        return true;
    }

    private string GenerateToken(Guid shareId)
    {
        var expiry = DateTime.UtcNow.AddHours(24).Ticks;
        var data = $"{shareId}|{expiry}";
        using var hmac = new HMACSHA256(_secretKey);
        var signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(data)));
        return Convert.ToBase64String(Encoding.UTF8.GetBytes($"{data}|{signature}"));
    }

    private bool ValidateToken(string token, Guid shareId)
    {
        try
        {
            var parts = Encoding.UTF8.GetString(Convert.FromBase64String(token)).Split('|');
            if (parts.Length != 3) return false;

            var sid = Guid.Parse(parts[0]);
            var expiry = long.Parse(parts[1]);
            var sig = parts[2];

            if (sid != shareId) return false;
            if (DateTime.UtcNow.Ticks > expiry) return false;

            using var hmac = new HMACSHA256(_secretKey);
            var computedSig = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes($"{sid}|{expiry}")));

            return sig == computedSig;
        }
        catch
        {
            return false;
        }
    }
}
