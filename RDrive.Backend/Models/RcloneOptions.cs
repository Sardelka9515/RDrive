namespace RDrive.Backend.Models;

public class RcloneOptions
{
    public string Path { get; set; } = "rclone";
    public string Address { get; set; } = "http://127.0.0.1:5572";
    public string User { get; set; } = "admin";
    public string Password { get; set; } = "securepass";
}
