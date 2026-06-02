using System.Security.Cryptography;
using System.Text;

namespace RDrive.Backend.Services;

/// <summary>
/// Issues short-lived, read-only tokens scoped to a single remote+path so that
/// browser media elements (&lt;img&gt;/&lt;video&gt;) and download anchors — which cannot
/// send an Authorization header — can stream a file directly from its URL via a
/// <c>?media_token=…</c> query parameter. The long-lived bearer JWT never appears in a URL.
///
/// The token is an HMAC over the exact (remote, path, expiry) it was issued for, so it
/// cannot be replayed against any other file, and grants no write/list/admin access — only
/// the file download endpoint validates it.
/// </summary>
public class MediaTokenService
{
    private readonly byte[] _key;

    public MediaTokenService(byte[] signingKey)
    {
        _key = signingKey;
    }

    /// <summary>Issues a token bound to <paramref name="remote"/>/<paramref name="path"/>, valid for <paramref name="ttl"/>.</summary>
    public string Issue(string remote, string path, TimeSpan ttl)
    {
        var expiryTicks = DateTime.UtcNow.Add(ttl).Ticks;
        var sig = ComputeSignature(remote, path, expiryTicks);
        return $"{Base64UrlEncode(BitConverter.GetBytes(expiryTicks))}.{Base64UrlEncode(sig)}";
    }

    /// <summary>Returns true if <paramref name="token"/> is a valid, unexpired token for this exact remote+path.</summary>
    public bool Validate(string remote, string path, string? token)
    {
        if (string.IsNullOrEmpty(token)) return false;

        var parts = token.Split('.');
        if (parts.Length != 2) return false;

        byte[] expiryBytes, providedSig;
        try
        {
            expiryBytes = Base64UrlDecode(parts[0]);
            providedSig = Base64UrlDecode(parts[1]);
        }
        catch
        {
            return false;
        }

        if (expiryBytes.Length != sizeof(long)) return false;
        var expiryTicks = BitConverter.ToInt64(expiryBytes);
        if (DateTime.UtcNow.Ticks > expiryTicks) return false;

        var expectedSig = ComputeSignature(remote, path, expiryTicks);
        return CryptographicOperations.FixedTimeEquals(providedSig, expectedSig);
    }

    private byte[] ComputeSignature(string remote, string path, long expiryTicks)
    {
        // Newline-delimited canonical form; expiry is bound in so the signature also gates the lifetime.
        var canonical = $"{remote}\n{path}\n{expiryTicks}";
        using var hmac = new HMACSHA256(_key);
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(canonical));
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] Base64UrlDecode(string value)
    {
        var s = value.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4)
        {
            case 2: s += "=="; break;
            case 3: s += "="; break;
        }
        return Convert.FromBase64String(s);
    }
}
