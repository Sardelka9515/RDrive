using System.Diagnostics;
using System.Net.WebSockets;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using RDrive.Backend.Models;

namespace RDrive.Backend.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class TerminalController : ControllerBase
{
    private readonly RcloneOptions _options;

    public TerminalController(IOptions<RcloneOptions> options)
    {
        _options = options.Value;
    }

    [HttpGet("ws")]
    public async Task HandleWebSocket()
    {
        if (!HttpContext.WebSockets.IsWebSocketRequest)
        {
            HttpContext.Response.StatusCode = 400;
            return;
        }

        using var ws = await HttpContext.WebSockets.AcceptWebSocketAsync();

        var psi = new ProcessStartInfo
        {
            FileName = _options.Path,
            Arguments = "config",
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            Environment =
            {
                ["TERM"] = "xterm-256color",
                ["RCLONE_CONFIG_DIR"] = GetRcloneConfigDir()
            }
        };

        Process? process = null;
        try
        {
            process = Process.Start(psi);
            if (process == null)
            {
                await SendText(ws, "\r\n[Error: Failed to start rclone config]\r\n");
                await ws.CloseAsync(WebSocketCloseStatus.InternalServerError, "Process failed", CancellationToken.None);
                return;
            }

            using var cts = new CancellationTokenSource();
            var token = cts.Token;

            // Relay stdout -> WebSocket
            var stdoutTask = RelayStreamToWs(process.StandardOutput.BaseStream, ws, token);
            // Relay stderr -> WebSocket
            var stderrTask = RelayStreamToWs(process.StandardError.BaseStream, ws, token);
            // Relay WebSocket -> stdin
            var stdinTask = RelayWsToStream(ws, process.StandardInput, process, token);

            // Wait for any to complete (process exits or WebSocket closes)
            await Task.WhenAny(stdoutTask, stderrTask, stdinTask);

            cts.Cancel();

            if (!process.HasExited)
            {
                try { process.Kill(true); } catch { /* ignore */ }
            }

            if (ws.State == WebSocketState.Open)
            {
                await SendText(ws, "\r\n[Process exited]\r\n");
                await ws.CloseAsync(WebSocketCloseStatus.NormalClosure, "Process exited", CancellationToken.None);
            }
        }
        catch (Exception ex)
        {
            if (ws.State == WebSocketState.Open)
            {
                await SendText(ws, $"\r\n[Error: {ex.Message}]\r\n");
                await ws.CloseAsync(WebSocketCloseStatus.InternalServerError, ex.Message, CancellationToken.None);
            }
        }
        finally
        {
            if (process != null && !process.HasExited)
            {
                try { process.Kill(true); } catch { /* ignore */ }
            }
            process?.Dispose();
        }
    }

    private static async Task RelayStreamToWs(Stream stream, WebSocket ws, CancellationToken ct)
    {
        var buffer = new byte[4096];
        try
        {
            while (!ct.IsCancellationRequested && ws.State == WebSocketState.Open)
            {
                var bytesRead = await stream.ReadAsync(buffer, 0, buffer.Length, ct);
                if (bytesRead == 0) break; // Stream closed

                await ws.SendAsync(
                    new ArraySegment<byte>(buffer, 0, bytesRead),
                    WebSocketMessageType.Text,
                    true,
                    ct);
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception) { /* Stream or WS closed */ }
    }

    private static async Task RelayWsToStream(WebSocket ws, StreamWriter stdin, Process process, CancellationToken ct)
    {
        var buffer = new byte[4096];
        try
        {
            while (!ct.IsCancellationRequested && ws.State == WebSocketState.Open && !process.HasExited)
            {
                var result = await ws.ReceiveAsync(new ArraySegment<byte>(buffer), ct);

                if (result.MessageType == WebSocketMessageType.Close)
                    break;

                if (result.MessageType == WebSocketMessageType.Text)
                {
                    var text = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    await stdin.WriteAsync(text);
                    await stdin.FlushAsync();
                }
            }
        }
        catch (OperationCanceledException) { }
        catch (Exception) { /* WS or process closed */ }
    }

    private static async Task SendText(WebSocket ws, string text)
    {
        var bytes = Encoding.UTF8.GetBytes(text);
        await ws.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, CancellationToken.None);
    }

    private string GetRcloneConfigDir()
    {
        // Use the same config directory rclone uses
        var configDir = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(configDir, "rclone");
    }
}
