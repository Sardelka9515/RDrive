using Microsoft.AspNetCore.Mvc;
using RDrive.Backend.Models;
using RDrive.Backend.Services;

namespace RDrive.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RemotesController : ControllerBase
{
    private readonly RcloneService _rclone;

    public RemotesController(RcloneService rclone)
    {
        _rclone = rclone;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var remotes = await _rclone.ListRemotesAsync();
        return Ok(remotes);
    }

    /// <summary>List available provider types (s3, drive, sftp, etc.)</summary>
    [HttpGet("providers")]
    public async Task<IActionResult> GetProviders()
    {
        var providers = await _rclone.GetProvidersAsync();
        return Ok(providers);
    }

    /// <summary>Get config for a specific remote</summary>
    [HttpGet("{name}/config")]
    public async Task<IActionResult> GetRemoteConfig(string name)
    {
        try
        {
            var config = await _rclone.GetRemoteConfigAsync(name);
            return Ok(config);
        }
        catch (Exception ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    /// <summary>Dump all remote configs</summary>
    [HttpGet("dump")]
    public async Task<IActionResult> DumpConfig()
    {
        var dump = await _rclone.ConfigDumpAsync();
        return Ok(dump);
    }

    /// <summary>Create a new remote</summary>
    [HttpPost]
    public async Task<IActionResult> CreateRemote([FromBody] CreateRemoteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name) || string.IsNullOrWhiteSpace(request.Type))
            return BadRequest(new { error = "Name and Type are required" });

        try
        {
            await _rclone.CreateRemoteAsync(request.Name, request.Type, request.Parameters);
            return Ok(new { message = "Remote created successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>Update an existing remote's config</summary>
    [HttpPut("{name}")]
    public async Task<IActionResult> UpdateRemote(string name, [FromBody] UpdateRemoteRequest request)
    {
        try
        {
            await _rclone.UpdateRemoteAsync(name, request.Parameters);
            return Ok(new { message = "Remote updated successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }

    /// <summary>Delete a remote</summary>
    [HttpDelete("{name}")]
    public async Task<IActionResult> DeleteRemote(string name)
    {
        try
        {
            await _rclone.DeleteRemoteAsync(name);
            return Ok(new { message = "Remote deleted successfully" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = ex.Message });
        }
    }
}
