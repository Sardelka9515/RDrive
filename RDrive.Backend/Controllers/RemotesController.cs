using Microsoft.AspNetCore.Mvc;
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
}
