using System.Security.Claims;
using RDrive.Backend.Models;
using RDrive.Backend.Services;
using RDrive.Backend.Data;
using Microsoft.EntityFrameworkCore;
using Swashbuckle.AspNetCore.SwaggerGen;

var builder = WebApplication.CreateBuilder(args);

// Configure Kestrel limits
builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = null; // Unlimited
    options.Limits.MinRequestBodyDataRate = null; // Allow slow uploads
    options.Limits.KeepAliveTimeout = TimeSpan.FromMinutes(10);
    options.Limits.RequestHeadersTimeout = TimeSpan.FromMinutes(10);
});

// Add services to the container.
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173") // Frontend URL
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configure FormOptions for large file uploads
builder.Services.Configure<Microsoft.AspNetCore.Http.Features.FormOptions>(options =>
{
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartBodyLengthLimit = long.MaxValue; // Allow unlimited file size
    options.MultipartHeadersLengthLimit = int.MaxValue;
});

// Rclone Services
builder.Services.Configure<RcloneOptions>(builder.Configuration.GetSection("Rclone"));
builder.Services.AddHostedService<RcloneBackgroundService>();
builder.Services.AddHostedService<JobQueueService>();
builder.Services.AddHttpClient<RcloneService>(client =>
{
    client.Timeout = TimeSpan.FromHours(1); // Allow long running requests for large files
});
builder.Services.AddScoped<RclonePathResolver>();

// Database
var dbPath = Path.Combine(AppContext.BaseDirectory, "data", "rdrive.db");
Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite($"Data Source={dbPath}"));

// Authentication (optional OIDC)
var authEnabled = !string.IsNullOrEmpty(builder.Configuration["Authentication:Authority"]);
if (authEnabled)
{
    builder.Services.AddAuthentication("Bearer")
        .AddJwtBearer("Bearer", options =>
        {
            options.Authority = builder.Configuration["Authentication:Authority"];
            options.Audience = builder.Configuration["Authentication:Audience"];
            options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
            options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
            {
                ValidateAudience = !string.IsNullOrEmpty(builder.Configuration["Authentication:Audience"]),
                ValidateIssuer = true,
            };
            // Support token from query string for WebSocket connections
            options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
            {
                OnMessageReceived = context =>
                {
                    var accessToken = context.Request.Query["access_token"];
                    if (!string.IsNullOrEmpty(accessToken) && context.HttpContext.WebSockets.IsWebSocketRequest)
                    {
                        context.Token = accessToken;
                    }
                    return Task.CompletedTask;
                }
            };
        });

    var requiredRole = builder.Configuration["Authentication:RequiredRole"] ?? "rdrive-user";
    builder.Services.AddAuthorization(options =>
    {
        options.DefaultPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .RequireRole(requiredRole)
            .Build();
    });
}
else
{
    // No-op auth: all requests are allowed
    builder.Services.AddAuthorization(options =>
    {
        options.DefaultPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
            .RequireAssertion(_ => true)
            .Build();
    });
}

var app = builder.Build();

// Auto-migrate database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
}

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseSwaggerUI();
}

var wsOptions = new WebSocketOptions();
if (app.Environment.IsDevelopment())
{
    wsOptions.AllowedOrigins.Add("http://localhost:5173");
}
app.UseWebSockets(wsOptions);

app.UseCors();

// Serve frontend SPA in production — before auth so static files are served without tokens
if (!app.Environment.IsDevelopment())
{
    app.UseDefaultFiles();
    app.UseStaticFiles();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseAuthentication();
app.UseAuthorization();

// Auth info endpoint (public, no auth required)
app.MapGet("/api/auth/config", () => Results.Ok(new
{
    enabled = authEnabled,
    authority = authEnabled ? app.Configuration["Authentication:Authority"] : null,
    clientId = authEnabled ? app.Configuration["Authentication:ClientId"] : null,
    requiredRole = authEnabled ? (app.Configuration["Authentication:RequiredRole"] ?? "rdrive-user") : null,
})).AllowAnonymous();

app.MapControllers();

// SPA fallback — serves index.html for client-side routes like /callback
if (!app.Environment.IsDevelopment())
{
    app.MapFallbackToFile("index.html").AllowAnonymous();
}

app.Run();
