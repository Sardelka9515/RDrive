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
builder.Services.AddHostedService<JobSchedulerService>();
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

// Authentication. Three mutually-exclusive modes:
//   - "oidc":     external OpenID Connect provider (when Authentication:Authority is set)
//   - "password": built-in single user (when Auth:Password is set and OIDC is not)
//   - "none":     no authentication (default)
var oidcEnabled = !string.IsNullOrEmpty(builder.Configuration["Authentication:Authority"]);
var singleUserPassword = builder.Configuration["Auth:Password"];
var passwordAuthEnabled = !oidcEnabled && !string.IsNullOrEmpty(singleUserPassword);
var authEnabled = oidcEnabled || passwordAuthEnabled;

// Media tokens let browser <img>/<video>/download requests (which can't send an
// Authorization header) stream a single file via a short-lived, read-only ?media_token=.
// Available in every auth mode; signed with the same key resolution as the bearer JWTs.
var mediaSigningKey = AuthTokenService.ResolveSigningKey(
    builder.Configuration["Auth:JwtSecret"], Path.GetDirectoryName(dbPath)!);
builder.Services.AddSingleton(new MediaTokenService(mediaSigningKey));

// Support a bearer token supplied via the query string for WebSocket connections.
static Task ReadTokenFromQueryString(Microsoft.AspNetCore.Authentication.JwtBearer.MessageReceivedContext context)
{
    var accessToken = context.Request.Query["access_token"];
    if (!string.IsNullOrEmpty(accessToken) && context.HttpContext.WebSockets.IsWebSocketRequest)
    {
        context.Token = accessToken;
    }
    return Task.CompletedTask;
}

if (oidcEnabled)
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
            options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
            {
                OnMessageReceived = ReadTokenFromQueryString
            };
        });

    var requiredRole = builder.Configuration["Authentication:RequiredRole"];
    builder.Services.AddAuthorization(options =>
    {
        var policyBuilder = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser();

        if (!string.IsNullOrEmpty(requiredRole))
        {
            policyBuilder.RequireRole(requiredRole);
        }

        options.DefaultPolicy = policyBuilder.Build();
    });
}
else if (passwordAuthEnabled)
{
    var dataDir = Path.GetDirectoryName(dbPath)!;
    var signingKey = AuthTokenService.ResolveSigningKey(builder.Configuration["Auth:JwtSecret"], dataDir);
    var tokenService = new AuthTokenService(singleUserPassword!, signingKey);
    builder.Services.AddSingleton(tokenService);

    builder.Services.AddAuthentication("Bearer")
        .AddJwtBearer("Bearer", options =>
        {
            options.TokenValidationParameters = new Microsoft.IdentityModel.Tokens.TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = tokenService.SigningKey,
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = true,
                ClockSkew = TimeSpan.FromMinutes(1),
            };
            options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
            {
                OnMessageReceived = ReadTokenFromQueryString
            };
        });

    builder.Services.AddAuthorization(options =>
    {
        options.DefaultPolicy = new Microsoft.AspNetCore.Authorization.AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
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
    mode = oidcEnabled ? "oidc" : passwordAuthEnabled ? "password" : "none",
    authority = oidcEnabled ? app.Configuration["Authentication:Authority"] : null,
    clientId = oidcEnabled ? app.Configuration["Authentication:ClientId"] : null,
})).AllowAnonymous();

// Single-user password login: exchanges the configured password for a bearer token.
if (passwordAuthEnabled)
{
    app.MapPost("/api/auth/login", (LoginRequest request, AuthTokenService auth) =>
    {
        if (!auth.ValidatePassword(request.Password))
            return Results.Unauthorized();

        var lifetime = TimeSpan.FromDays(7);
        return Results.Ok(new
        {
            token = auth.IssueToken(lifetime),
            expiresIn = (int)lifetime.TotalSeconds,
        });
    }).AllowAnonymous();
}

// Mint a short-lived, read-only token scoped to a single file, for streaming it from a URL
// (media preview / download) where an Authorization header can't be sent. Requires auth.
app.MapPost("/api/auth/media-token", (MediaTokenRequest request, MediaTokenService media) =>
{
    if (string.IsNullOrEmpty(request.Remote) || string.IsNullOrEmpty(request.Path))
        return Results.BadRequest("Remote and path are required");

    var ttl = TimeSpan.FromHours(4);
    var token = media.Issue(request.Remote, request.Path.TrimStart('/'), ttl);
    return Results.Ok(new { token, expiresIn = (int)ttl.TotalSeconds });
}).RequireAuthorization();

app.MapControllers();

// SPA fallback — serves index.html for client-side routes like /callback
if (!app.Environment.IsDevelopment())
{
    app.MapFallbackToFile("index.html").AllowAnonymous();
}

app.Run();

record LoginRequest(string? Password);
record MediaTokenRequest(string? Remote, string? Path);
