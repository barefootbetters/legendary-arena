<#
.SYNOPSIS
    Boots the Legendary Arena game server (and optionally the arena-client
    Vite dev server) for a manual smoke test.

.DESCRIPTION
    Clears any process-scope DATABASE_URL override before launch so that
    Node's --env-file=.env can supply the localhost binding. A persistent
    User-scope DATABASE_URL otherwise shadows the .env value (Node's
    --env-file is a fallback only — it never overrides existing process
    env vars).

    By default this script:
      1. Verifies .env exists at the repo root.
      2. Clears DATABASE_URL from the current process env.
      3. Spawns the arena-client Vite dev server in a new PowerShell window.
      4. Runs the boardgame.io server in this window (Ctrl+C to stop).

    Pass -ServerOnly to skip the Vite spawn (useful when you already have
    a Vite window open or want to run the dev server manually).

    Pass -KillStaleListeners to first reclaim ports 8000 and 5173-5176
    from zombie processes before starting (use sparingly — kills any
    process holding those ports without confirmation).

.EXAMPLE
    pwsh scripts/Start-SmokeTest.ps1

.EXAMPLE
    pwsh scripts/Start-SmokeTest.ps1 -ServerOnly

.EXAMPLE
    pwsh scripts/Start-SmokeTest.ps1 -KillStaleListeners
#>

[CmdletBinding()]
param(
    [switch] $ServerOnly,
    [switch] $KillStaleListeners
)

$ErrorActionPreference = 'Stop'

# Resolve repo root (this script lives at <repo>/scripts/Start-SmokeTest.ps1).
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

if (-not (Test-Path '.env')) {
    Write-Error ".env not found at $repoRoot. Copy .env.example and configure it before running this script."
    exit 1
}

if ($KillStaleListeners) {
    Write-Host "Killing stale listeners on 8000, 5173-5176..." -ForegroundColor Yellow
    $stalePorts = @(8000, 5173, 5174, 5175, 5176)
    Get-NetTCPConnection -LocalPort $stalePorts -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
}

# why: --env-file is fallback-only. A pre-set User-scope DATABASE_URL
# overrides the .env value, so Node tries to resolve the wrong host
# (e.g., a remote dev instance) instead of localhost. Clearing process
# scope here lets .env win for the spawned `node` process.
if ($env:DATABASE_URL) {
    Write-Host "Clearing process-scope DATABASE_URL override (so .env wins)" -ForegroundColor Yellow
    Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
}

if (-not $ServerOnly) {
    Write-Host "Spawning arena-client Vite dev server in a new PowerShell window..." -ForegroundColor Cyan
    $viteCommand = "Set-Location '$repoRoot'; pnpm --filter '@legendary-arena/arena-client' dev"
    Start-Process powershell.exe -ArgumentList @('-NoExit', '-Command', $viteCommand) | Out-Null
    # Give the new window a moment to land before the server console starts
    # spamming startup output, so the URLs printed below remain visible.
    Start-Sleep -Milliseconds 750
}

Write-Host ""
Write-Host "=== Legendary Arena — Smoke Test ===" -ForegroundColor Cyan
Write-Host "  Server : http://localhost:8000  (health: /health)" -ForegroundColor Gray
Write-Host "  Client : http://localhost:5173  (Vite bumps to 5174+ if 5173 is held)" -ForegroundColor Gray
Write-Host "  Stop   : Ctrl+C in this window stops the server. Close the Vite window separately." -ForegroundColor Gray
Write-Host ""
Write-Host "Starting boardgame.io server..." -ForegroundColor Cyan

node --env-file=.env apps/server/src/index.mjs
