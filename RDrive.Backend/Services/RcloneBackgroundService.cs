using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RDrive.Backend.Models;
using System.Diagnostics;

namespace RDrive.Backend.Services;

public class RcloneBackgroundService : BackgroundService
{
    private readonly RcloneOptions _options;
    private readonly ILogger<RcloneBackgroundService> _logger;
    private Process? _process;

    public RcloneBackgroundService(IOptions<RcloneOptions> options, ILogger<RcloneBackgroundService> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var addr = _options.Address.Replace("http://", "").Replace("https://", "").TrimEnd('/');
        
        var startInfo = new ProcessStartInfo
        {
            FileName = _options.Path,
            Arguments = $"rcd --rc-web-gui --rc-addr={addr} --rc-user={_options.User} --rc-pass={_options.Password} --rc-serve --rc-allow-origin=*",
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        try
        {
            _logger.LogInformation("Starting Rclone with args: {Args}", startInfo.Arguments.Replace(_options.Password, "*****"));
            
            _process = new Process { StartInfo = startInfo };
            _process.OutputDataReceived += (sender, args) => { if (args.Data != null) _logger.LogInformation("Rclone: {Data}", args.Data); };
            _process.ErrorDataReceived += (sender, args) => { if (args.Data != null) _logger.LogError("Rclone Error: {Data}", args.Data); };

            if (_process.Start())
            {
                _process.BeginOutputReadLine();
                _process.BeginErrorReadLine();
                _logger.LogInformation("Rclone started with PID {Pid}", _process.Id);
                
                // Wait until the service stops or rclone exits
                try 
                {
                    await _process.WaitForExitAsync(stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // Intentional shutdown
                }
            }
            else
            {
                _logger.LogError("Failed to start rclone process (Start returned false).");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception starting rclone");
        }
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        if (_process != null && !_process.HasExited)
        {
            _logger.LogInformation("Stopping Rclone...");
            try 
            {
                // Kill is harsh but Rclone handles it ok usually. 
                // We could try sending request to core/quit but Kill is reliable for child proc.
                _process.Kill();
                await _process.WaitForExitAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error stopping rclone");
            }
        }
        await base.StopAsync(cancellationToken);
    }

    public override void Dispose()
    {
        _process?.Dispose();
        base.Dispose();
    }
}
