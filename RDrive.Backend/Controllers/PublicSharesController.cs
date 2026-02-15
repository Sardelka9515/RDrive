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
    private static readonly byte[] _secretKey = RandomNumberGenerator.GetBytes(32); // specific to this instance run

    public PublicSharesController(AppDbContext db, RcloneService rclone)
    {
        _db = db;
        _rclone = rclone;
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
            Writeable = false // TODO: if user is logged in check permissions, or if public share has write
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
        var remotePath = string.IsNullOrEmpty(share!.Path) ? path : $"{share.Path}/{path}".TrimStart('/');
        // Ensure we don't end with slash if it's empty, but ListFilesAsync handles directories.
        // If path is empty, we list share.Path.
        
        try 
        {
            var files = await _rclone.ListFilesAsync(share.Remote, remotePath);
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
            var stream = await _rclone.GetFileStreamAsync(share.Remote, remotePath);
            
            // Try to guess mime type?
            var contentType = "application/octet-stream";
            // Rclone might return it in headers? HttpClient usually has it.
            // But GetFileStreamAsync returns stream. We lost headers.
            // We could update GetFileStreamAsync to return (Stream, ContentType) tuple or similar.
            // For now default.
            
            return File(stream, contentType, Path.GetFileName(path));
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
        
        var fullRemotePath = string.IsNullOrEmpty(remotePath) ? file.FileName : $"{remotePath}/{file.FileName}";

        try
        {
            using var stream = file.OpenReadStream();
            await _rclone.UploadFileStreamAsync(share.Remote, fullRemotePath, stream, file.ContentType);
            return Ok();
        }
        catch (Exception ex)
        {
            return BadRequest($"Failed to upload: {ex.Message}");
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

        // 2. Check Recipients restrictions
        // If recipients exist, user MUST be authenticated via main Auth and match email
        // OR we support "Public" access if IsPublic is true.
        
        if (share.Recipients.Any())
        {
             // If IsPublic is false, we strictly enforce recipient check.
             // If IsPublic is true, maybe recipients are for Write access?
             // Let's stick to: If Recipients exist AND IsPublic is false -> Restricted.
             // If IsPublic is true -> Open to everyone (Recipients ignored for Read, but maybe used for Write?)
             
             if (!share.IsPublic)
             {
                 // User must be logged in
                 // Since this controller is not [Authorize], we need to check User.Identity manually if available.
                 // We might need to mix [Authorize] on specific paths or check HttpContext.User
                 // Note: If the user is authenticated via Bearer token (main app login), User.Identity.Name should be set.
                 
                 var userEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? User.Identity?.Name;
                 if (string.IsNullOrEmpty(userEmail)) return false; // Not logged in
                 
                 var recipient = share.Recipients.FirstOrDefault(r => r.Email.Equals(userEmail, StringComparison.OrdinalIgnoreCase));
                 if (recipient == null) return false; // Not on list
                 
                 if (requireWrite && recipient.Permission != "Write") return false;
             }
             else
             {
                 // Public share, but maybe checking write permission?
                 if (requireWrite)
                 {
                     // Public RW? Unlikely to be safe.
                     // Assume Public is ReadOnly unless specific recipient?
                     // Let's safe default: Public = Read Only. 
                     // Write requires specific recipient permission?
                     // Or separate "Public Write" flag (not in schema).
                     
                     // Check if user is in recipient list with Write
                     var userEmail = User.FindFirst(ClaimTypes.Email)?.Value ?? User.Identity?.Name;
                     if (!string.IsNullOrEmpty(userEmail))
                     {
                         var recipient = share.Recipients.FirstOrDefault(r => r.Email.Equals(userEmail, StringComparison.OrdinalIgnoreCase));
                         if (recipient != null && recipient.Permission == "Write") return true;
                     }
                     return false; // Public write not allowed by default
                 }
             }
        }
        else
        {
            // No recipients.
            if (!share.IsPublic) return false; // Not public, no recipients -> No access (Or creator only? Creator logic not implemented here)
            if (requireWrite) return false; // Public write disabled by default
        }

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
