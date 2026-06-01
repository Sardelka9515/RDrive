# RDrive

A self-hosted web UI for [rclone](https://rclone.org/). RDrive wraps an rclone daemon behind a modern browser interface so you can browse, transfer, schedule, and share files across any of rclone's 70+ cloud storage backends — without touching the command line.

> Browse your remotes, copy/move/sync between them as background jobs, schedule recurring transfers, and hand out password-protected share links — all from one app.

## Features

- **File browser** — navigate any configured rclone remote with a grid/list view, sorting, drag-and-drop moves, upload, download, rename, delete, and new-folder. Right-click context menu on files, folders, and the current directory.
- **Transfers as jobs** — copy, move, and sync within or across remotes run as background jobs through a server-side queue, with live progress, stop/restart, and per-job stats on the **Jobs** page.
- **Scheduled jobs** — set up recurring sync/copy/move transfers using cron expressions.
- **Shares** — create public or restricted share links (`/s/{id}`) with optional password, expiration, max-download limit, and per-recipient permissions. Recipients browse and download via a dedicated public share view.
- **Remote management** — add and configure rclone remotes from the **Settings** page.
- **Built-in rclone terminal** — an in-browser terminal (xterm.js over WebSocket) for direct rclone access.
- **Optional OIDC authentication** — plug in any OpenID Connect provider (e.g. Keycloak) with an optional required role. Disabled by default for easy local use.

## Architecture

RDrive is a single deployable that bundles a .NET backend and a React frontend.

| Layer | Stack |
| --- | --- |
| **Backend** | ASP.NET Core (.NET 10), Entity Framework Core + SQLite |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, React Router |
| **Engine** | rclone, run as a child `rcd` daemon and driven via its [RC API](https://rclone.org/rc/) |

The backend launches and supervises an `rclone rcd` process (`RcloneBackgroundService`) and talks to it over the rclone remote-control API. Background services handle the job queue (`JobQueueService`) and the cron scheduler (`JobSchedulerService`). Application state — shares, tasks, and scheduled jobs — is stored in a SQLite database (`data/rdrive.db`), with EF Core migrations applied automatically on startup. In production the compiled frontend is served as static files from the same ASP.NET host.

## Quick start (Docker)

The fastest way to run RDrive is with Docker Compose:

```bash
docker compose up -d
```

Then open <http://localhost:8080>.

The provided [`docker-compose.yml`](docker-compose.yml) builds the image locally and persists two volumes:

- `rclone-config` → `/root/.config/rclone` — your rclone remotes
- `rdrive-data` → `/app/data` — the RDrive SQLite database

A prebuilt image is also published to the GitHub Container Registry:

```bash
docker run -d -p 8080:8080 \
  -v rclone-config:/root/.config/rclone \
  -v rdrive-data:/app/data \
  ghcr.io/sardelka9515/rdrive:latest
```

> **Security note:** set a strong `Rclone__Password` and keep the rclone RC port (`5572`) unexposed unless you specifically need direct access to the rclone API / Web GUI.

## Configuration

Configuration is read from `appsettings.json` or environment variables (env vars use `__` as the section separator, e.g. `Rclone__Password`).

### rclone

| Setting | Env var | Default | Description |
| --- | --- | --- | --- |
| `Rclone:Path` | `Rclone__Path` | `rclone` | Path to the rclone binary |
| `Rclone:Address` | `Rclone__Address` | `http://127.0.0.1:5572` | Address the rclone RC daemon listens on |
| `Rclone:User` | `Rclone__User` | `admin` | rclone RC username |
| `Rclone:Password` | `Rclone__Password` | `securepass` | rclone RC password — **change this** |

### Authentication

Authentication has three mutually-exclusive modes, selected automatically by configuration:

1. **None** (default) — no configuration set; every request is allowed.
2. **Single-user password** — set `Auth:Password` to require a password to sign in.
3. **OIDC** — set `Authentication:Authority` to delegate to an external identity provider. OIDC takes precedence if both are configured.

#### Single-user password

The simplest option: one shared password, no external provider.

| Setting | Env var | Description |
| --- | --- | --- |
| `Auth:Password` | `Auth__Password` | The login password. Setting this enables password mode. |
| `Auth:JwtSecret` | `Auth__JwtSecret` | Optional secret for signing session tokens. If unset, a random key is generated and persisted to `data/jwt-signing.key` so sessions survive restarts. |

On login the backend issues a 7-day bearer token (HS256 JWT) that the browser stores and sends with each request.

#### OIDC

| Setting | Env var | Description |
| --- | --- | --- |
| `Authentication:Authority` | `Authentication__Authority` | OIDC issuer URL (e.g. `https://keycloak.example.com/realms/rdrive`) |
| `Authentication:Audience` | `Authentication__Audience` | Expected token audience |
| `Authentication:ClientId` | `Authentication__ClientId` | OIDC client ID used by the frontend |
| `Authentication:RequiredRole` | `Authentication__RequiredRole` | Optional role required to access the app |

See [docs/keycloak-setup.md](docs/keycloak-setup.md) for a full Keycloak walkthrough.

## Local development

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/)
- [Node.js 22+](https://nodejs.org/)
- [rclone](https://rclone.org/downloads/) on your `PATH`

### Run the backend

```bash
cd RDrive.Backend
dotnet run
```

This starts the API (and the supervised rclone daemon) at `http://localhost:5197`. Swagger UI is available at `/swagger` in development.

### Run the frontend

```bash
cd RDrive.Frontend
npm install
npm run dev
```

The Vite dev server runs at <http://localhost:5173> (allowed by the backend's CORS policy). Point it at the backend by setting the API base URL — create `RDrive.Frontend/.env.local`:

```
VITE_API_BASE=http://localhost:5197/api
```

### Tests

```bash
dotnet test
```

## Project layout

```
RDrive/
├── RDrive.Backend/         ASP.NET Core API, rclone integration, background services
│   ├── Controllers/        Files, Tasks, ScheduledJobs, Shares, PublicShares, Remotes, Terminal
│   ├── Services/           Rclone daemon supervision, job queue, scheduler
│   └── Models/             EF Core entities and rclone DTOs
├── RDrive.Backend.Tests/   Backend unit tests
├── RDrive.Frontend/        React + Vite single-page app
│   └── src/                FileBrowser, Jobs, Shares, RemoteConfig, terminal, auth
├── docs/                   Setup guides (Keycloak)
├── Dockerfile              Multi-stage build (frontend → backend → runtime + rclone)
└── docker-compose.yml
```

## License

See the repository for license details.
