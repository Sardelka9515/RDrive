using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RDrive.Backend.Data;
using RDrive.Backend.Models;
using System.Security.Claims;

namespace RDrive.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class SharesController : ControllerBase
{
    private readonly AppDbContext _db;

    public SharesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetShares()
    {
        // For now, no strict user ownership, or assume single user
        // If auth enabled, filter by creator? 
        // Plan said "Store Creator ID/Email". 
        // We'll rely on Claims, but if no auth, Creator might be empty or "Anonymous".
        
        string? currentUser = User.Identity?.Name ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        var shares = await _db.Shares
            .Include(s => s.Recipients)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

        if (!string.IsNullOrEmpty(currentUser))
        {
            // If we enforce ownership, filter here. 
            // For now, let's return all shares for simplicity unless user is explicitly restricted.
        }

        return Ok(shares.Select(MapToResponse));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetShare(Guid id)
    {
        var share = await _db.Shares.Include(s => s.Recipients).FirstOrDefaultAsync(s => s.Id == id);
        if (share == null) return NotFound();
        return Ok(MapToResponse(share));
    }

    [HttpPost]
    public async Task<IActionResult> CreateShare([FromBody] CreateShareRequest request)
    {
        if (string.IsNullOrEmpty(request.Remote) || string.IsNullOrEmpty(request.Path))
            return BadRequest("Remote and Path are required.");

        var share = new Share
        {
            Id = Guid.NewGuid(),
            Remote = request.Remote,
            Path = request.Path,
            Name = request.Name,
            Description = request.Description,
            Password = request.Password, // TODO: Hash password
            Expiration = request.Expiration,
            MaxDownloads = request.MaxDownloads,
            IsPublic = request.IsPublic,
            Creator = User.Identity?.Name ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "Anonymous",
            CreatedAt = DateTime.UtcNow,
            Recipients = request.Recipients.Select(r => new ShareRecipient
            {
                Email = r.Email,
                Permission = r.Permission
            }).ToList()
        };

        _db.Shares.Add(share);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetShare), new { id = share.Id }, MapToResponse(share));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateShare(Guid id, [FromBody] UpdateShareRequest request)
    {
        var share = await _db.Shares.Include(s => s.Recipients).FirstOrDefaultAsync(s => s.Id == id);
        if (share == null) return NotFound();

        share.Name = request.Name;
        share.Description = request.Description;
        share.Password = request.Password; // TODO: handle partial updates or empty password to clear? 
                                           // For now assume full update or only update if not null?
                                           // Let's assume if sent, update.
        share.Expiration = request.Expiration;
        share.MaxDownloads = request.MaxDownloads;
        share.IsPublic = request.IsPublic;

        // Sync recipients
        _db.ShareRecipients.RemoveRange(share.Recipients);
        share.Recipients = request.Recipients.Select(r => new ShareRecipient
        {
            ShareId = share.Id,
            Email = r.Email,
            Permission = r.Permission
        }).ToList();

        await _db.SaveChangesAsync();
        return Ok(MapToResponse(share));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteShare(Guid id)
    {
        var share = await _db.Shares.FindAsync(id);
        if (share == null) return NotFound();

        _db.Shares.Remove(share);
        await _db.SaveChangesAsync();
        return Ok();
    }

    private static ShareResponse MapToResponse(Share s)
    {
        return new ShareResponse
        {
            Id = s.Id,
            Remote = s.Remote,
            Path = s.Path,
            Name = s.Name,
            Description = s.Description,
            HasPassword = !string.IsNullOrEmpty(s.Password),
            Creator = s.Creator,
            CreatedAt = s.CreatedAt,
            Expiration = s.Expiration,
            Views = s.Views,
            MaxDownloads = s.MaxDownloads,
            IsPublic = s.IsPublic,
            Recipients = s.Recipients.Select(r => new ShareRecipientDto
            {
                Email = r.Email,
                Permission = r.Permission
            }).ToList()
        };
    }
}
