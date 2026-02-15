# Verification Script for Public Shares

$baseUrl = "http://localhost:5000" # Check port in Program.cs/launchSettings or assume default
# Ideally I'd use the running app but I need to start it first?
# The user has the app code. I should try to run it or rely on unit tests?
# Running the full backend might be heavy.
# But I can't verifying without running it.
# Checking existing `docker-compose.yml` might hint at how to run.
# User has `dotnet run` available?

Write-Host "Please ensure the backend is running on $baseUrl"

# 1. Create a Public Share (Mocking the request)
# We need to authenticate to create a share?
# SharesController has [Authorize].
# I might need to bypass auth or generate a token if I want to test properly.
# OR I can temporarily remove [Authorize] from SharesController for testing?
# Or just test PublicSharesController assuming I can inset data into DB?

# Let's insert a share directly into DB using a small C# script or SQL?
# SQLite db is at `d:\repos\RDrive\RDrive.Backend\data\rdrive.db`.
# I can use `sqlite3` if available.

# Alternative: Write a simple TestController that creates a share for me?
# Or just use the API if I can get a token.
# Program.cs shows Auth is optional/JWT.
# If I don't provide Authority, it disables auth?
# "var authEnabled = !string.IsNullOrEmpty(builder.Configuration["Authentication:Authority"]);"
# if not enabled, policy requires assertion true.
# So if I run locally without config, it might be open.

# Let's try to hit /api/shares directly.

$sharePayload = '{"Remote":"myremote:", "Path":"test", "Name":"Test Share", "IsPublic":true}'
Invoke-RestMethod -Uri "$baseUrl/api/shares" -Method Post -Body $sharePayload -ContentType "application/json"
