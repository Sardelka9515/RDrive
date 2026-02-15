using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Moq;
using Moq.Protected;
using RDrive.Backend.Controllers;
using RDrive.Backend.Data;
using RDrive.Backend.Models;
using RDrive.Backend.Services;
using System.Net;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Xunit;

namespace RDrive.Backend.Tests;

public class PublicSharesControllerTests
{
    private readonly AppDbContext _db;
    private readonly Mock<HttpMessageHandler> _httpHandlerMock;
    private readonly PublicSharesController _controller;

    public PublicSharesControllerTests()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;
        _db = new AppDbContext(options);

        _httpHandlerMock = new Mock<HttpMessageHandler>();
        var httpClient = new HttpClient(_httpHandlerMock.Object) { BaseAddress = new Uri("http://test-rclone/") };
        
        var rcloneOptions = Options.Create(new RcloneOptions { Address = "http://test-rclone", User = "u", Password = "p" });
        var rcloneService = new RcloneService(httpClient, rcloneOptions);
        var resolver = new RclonePathResolver(rcloneService);
        
        _controller = new PublicSharesController(_db, rcloneService, resolver);
        _controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
    }

    [Fact]
    public async Task GetInfo_ReturnsOk_WhenShareExists()
    {
        var share = new Share { Id = Guid.NewGuid(), Name = "Test Share", IsPublic = true };
        _db.Shares.Add(share);
        await _db.SaveChangesAsync();

        var result = await _controller.GetInfo(share.Id);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var info = Assert.IsType<PublicShareInfo>(okResult.Value);
        Assert.Equal("Test Share", info.Name);
    }

    [Fact]
    public async Task GetInfo_ReturnsNotFound_WhenShareDoesNotExist()
    {
        var result = await _controller.GetInfo(Guid.NewGuid());
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task ListFiles_ReturnsUnauthorized_WhenPasswordRequiredAndNoToken()
    {
        var share = new Share { Id = Guid.NewGuid(), Password = "pass", IsPublic = true };
        _db.Shares.Add(share);
        await _db.SaveChangesAsync();

        var result = await _controller.ListFiles(share.Id);

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task Authenticate_ReturnsToken_WhenPasswordCorrect()
    {
        var share = new Share { Id = Guid.NewGuid(), Password = "pass", IsPublic = true };
        _db.Shares.Add(share);
        await _db.SaveChangesAsync();

        var result = await _controller.Authenticate(share.Id, new ShareAuthRequest { Password = "pass" });

        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = Assert.IsType<ShareAuthResponse>(okResult.Value);
        Assert.NotNull(response.Token);
    }

    [Fact]
    public async Task ListFiles_ReturnsFiles_WhenAuthorizedAndRcloneReturnsData()
    {
        var share = new Share { Id = Guid.NewGuid(), Remote = "myremote:", Path = "data", IsPublic = true };
        _db.Shares.Add(share);
        await _db.SaveChangesAsync();

        // Mock Rclone response
        var rcloneResponse = new RcloneListResponse
        {
            List = new List<RcloneFileItem>
            {
                new RcloneFileItem { Name = "file1.txt", Size = 100 }
            }
        };
        
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(JsonSerializer.Serialize(rcloneResponse))
            });

        var result = await _controller.ListFiles(share.Id);

        var okResult = Assert.IsType<OkObjectResult>(result);
        var files = Assert.IsType<List<RcloneFileItem>>(okResult.Value);
        Assert.Single(files);
        Assert.Equal("file1.txt", files[0].Name);
    }

    [Fact]
    public async Task DownloadFile_ReturnsFileStream_WhenAuthorized()
    {
        var share = new Share { Id = Guid.NewGuid(), Remote = "myremote:", Path = "data", IsPublic = true };
        _db.Shares.Add(share);
        await _db.SaveChangesAsync();

        var fileContent = "File Content";
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(req => req.RequestUri != null && 
                    (req.RequestUri.ToString().Contains("[myremote:]/data/file.txt") || 
                     req.RequestUri.ToString().Contains("%5Bmyremote:%5D/data/file.txt"))),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK,
                Content = new StringContent(fileContent)
            });

        var result = await _controller.DownloadFile(share.Id, "file.txt");

        var fileResult = Assert.IsType<FileStreamResult>(result);
        using var reader = new StreamReader(fileResult.FileStream);
        var content = await reader.ReadToEndAsync();
        Assert.Equal(fileContent, content);
    }
    [Fact]
    public async Task UploadFile_ReturnsOk_WhenAuthorizedAndWriteable()
    {
        var share = new Share { Id = Guid.NewGuid(), Remote = "myremote:", Path = "data", IsPublic = true };
        var recipient = new ShareRecipient { Email = "test@example.com", Permission = "Write", ShareId = share.Id };
        share.Recipients.Add(recipient);
        _db.Shares.Add(share);
        await _db.SaveChangesAsync();

        // Simulate authorized user
        var user = new ClaimsPrincipal(new ClaimsIdentity(new Claim[] {
            new Claim(ClaimTypes.Email, "test@example.com")
        }, "TestAuth"));
        _controller.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext { User = user } };

        // Mock Rclone Upload response
        _httpHandlerMock.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.Is<HttpRequestMessage>(req => req.Method == HttpMethod.Post && req.RequestUri.ToString().Contains("operations/uploadfile")),
                ItExpr.IsAny<CancellationToken>()
            )
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = HttpStatusCode.OK
            });

        var content = "File Content";
        var stream = new MemoryStream(Encoding.UTF8.GetBytes(content));
        var file = new FormFile(stream, 0, stream.Length, "file", "test.txt")
        {
            Headers = new HeaderDictionary(),
            ContentType = "text/plain"
        };

        var result = await _controller.UploadFile(share.Id, "test.txt", file);

        Assert.IsType<OkResult>(result);
    }
}
