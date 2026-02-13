# ── Stage 1: Build frontend ────────────────────────
FROM node:22-alpine AS frontend-build
WORKDIR /src/frontend

COPY RDrive.Frontend/package.json RDrive.Frontend/package-lock.json* ./
RUN npm ci

COPY RDrive.Frontend/ ./
RUN npm run build

# ── Stage 2: Build backend ─────────────────────────
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS backend-build
WORKDIR /src

COPY RDrive.Backend/ ./RDrive.Backend/
COPY RDrive.slnx ./
RUN dotnet publish RDrive.Backend/RDrive.Backend.csproj -c Release -o /app/publish

# ── Stage 3: Runtime ───────────────────────────────
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS runtime

# Install rclone
RUN apk add --no-cache rclone

WORKDIR /app
COPY --from=backend-build /app/publish ./
COPY --from=frontend-build /src/frontend/dist ./wwwroot/

ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "RDrive.Backend.dll"]
