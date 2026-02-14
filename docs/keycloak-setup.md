# Keycloak Setup Guide for RDrive

This guide walks through configuring [Keycloak](https://www.keycloak.org/) as the OIDC identity provider for RDrive.

## 1. Deploy Keycloak

Add Keycloak to your `docker-compose.yml` or run it separately:

```yaml
services:
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    container_name: keycloak
    command: start-dev
    ports:
      - "8180:8080"
    environment:
      - KEYCLOAK_ADMIN=admin
      - KEYCLOAK_ADMIN_PASSWORD=admin
    restart: unless-stopped
```

Access the admin console at **http://localhost:8180**.

## 2. Create a Realm

1. Log in to the Keycloak admin console (`admin` / `admin`).
2. Click the realm dropdown (top-left) → **Create realm**.
3. Set **Realm name** to `rdrive` and click **Create**.

## 3. Create a Client

1. Go to **Clients** → **Create client**.
2. Configure:
   - **Client type**: OpenID Connect
   - **Client ID**: `rdrive`
3. Click **Next**.
4. On the **Capability config** step:
   - **Client authentication**: **Off** (this is a public SPA client)
   - **Authorization**: Off
   - **Authentication flow**: check **Standard flow** only
5. Click **Next**.
6. On the **Login settings** step:
   - **Root URL**: `http://localhost:8080` (your RDrive URL)
   - **Valid redirect URIs**: `http://localhost:8080/*`
   - **Valid post logout redirect URIs**: `http://localhost:8080/*`
   - **Web origins**: `http://localhost:8080`

   > For production, replace `localhost:8080` with your actual domain.

7. Click **Save**.

## 4. Create a User

1. Go to **Users** → **Add user**.
2. Fill in **Username**, **Email**, etc.
3. Click **Create**.
4. Go to the **Credentials** tab → **Set password**.
5. Enter a password, toggle off **Temporary**, and click **Save**.

## 5. Configure RDrive

### Docker Compose

Uncomment and set the authentication environment variables in your `docker-compose.yml`:

```yaml
environment:
  - Authentication__Authority=http://keycloak:8080/realms/rdrive
  - Authentication__Audience=account
  - Authentication__ClientId=rdrive
```

> If Keycloak is on the same Docker network, use the container name (`keycloak`) as the hostname. If it's external, use the full URL (e.g., `https://auth.example.com/realms/rdrive`).

### appsettings.json (development)

```json
{
  "Authentication": {
    "Authority": "http://localhost:8180/realms/rdrive",
    "Audience": "account",
    "ClientId": "rdrive"
  }
}
```

## 6. Verify

1. Restart RDrive.
2. Open RDrive in your browser — you should be redirected to Keycloak's login page.
3. Sign in with the user you created.
4. You'll be redirected back to RDrive, authenticated.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **CORS errors** on login redirect | Ensure **Web origins** in the Keycloak client matches your RDrive URL |
| **Invalid redirect URI** | Ensure **Valid redirect URIs** includes `http://your-rdrive-url/*` |
| **Token validation fails** | Check that `Authority` is reachable from the backend container. Use `docker exec rdrive curl <authority-url>` to test |
| **Auth disabled / no login prompt** | Verify `Authentication__Authority` is set and non-empty |

## Optional: Production Setup

For production deployments:

1. Use HTTPS for both Keycloak and RDrive.
2. Update all URLs to use your domain names.
3. Set **Client authentication** to **On** if you want a confidential client (requires a client secret).
4. Enable **Require HTTPS** in Keycloak realm settings.
5. Consider enabling **email verification** and **password policies** in the realm.
