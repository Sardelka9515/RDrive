using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace RDrive.Backend.Services;

/// <summary>
/// Implements the built-in single-user password authentication mode. Validates the
/// configured password and issues short-lived HS256 JWTs which the JwtBearer middleware
/// then validates on every request — the same bearer-token flow used for OIDC, so the
/// rest of the app (downloads, WebSocket terminal) needs no special handling.
/// </summary>
public class AuthTokenService
{
    public const string SubjectId = "single-user";
    public const string UserName = "admin";

    private readonly byte[] _passwordHash;
    private readonly byte[] _key;

    public AuthTokenService(string password, byte[] signingKey)
    {
        _passwordHash = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        _key = signingKey;
    }

    public SymmetricSecurityKey SigningKey => new(_key);

    /// <summary>Constant-time comparison of the supplied password against the configured one.</summary>
    public bool ValidatePassword(string? candidate)
    {
        if (string.IsNullOrEmpty(candidate)) return false;
        var candidateHash = SHA256.HashData(Encoding.UTF8.GetBytes(candidate));
        return CryptographicOperations.FixedTimeEquals(candidateHash, _passwordHash);
    }

    public string IssueToken(TimeSpan lifetime)
    {
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            claims: new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, SubjectId),
                new Claim(ClaimTypes.NameIdentifier, SubjectId),
                new Claim(ClaimTypes.Name, UserName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            },
            notBefore: now,
            expires: now.Add(lifetime),
            signingCredentials: new SigningCredentials(SigningKey, SecurityAlgorithms.HmacSha256));
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    /// <summary>
    /// Resolves the JWT signing key. Derives it from the configured secret when one is set;
    /// otherwise generates a random key persisted under the data directory so issued tokens
    /// remain valid across restarts.
    /// </summary>
    public static byte[] ResolveSigningKey(string? configuredSecret, string dataDir)
    {
        if (!string.IsNullOrWhiteSpace(configuredSecret))
            return SHA256.HashData(Encoding.UTF8.GetBytes(configuredSecret));

        var keyPath = Path.Combine(dataDir, "jwt-signing.key");
        if (File.Exists(keyPath))
            return File.ReadAllBytes(keyPath);

        var key = RandomNumberGenerator.GetBytes(32);
        Directory.CreateDirectory(dataDir);
        File.WriteAllBytes(keyPath, key);
        return key;
    }
}
