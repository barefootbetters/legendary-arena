<#
.SYNOPSIS
    Starts the Registry Viewer Vite dev server for local smoke tests.

.DESCRIPTION
    Runs `pnpm --filter registry-viewer dev`. Vite picks the first
    available port starting at 5173 and bumps if held — typically lands
    on 5174 when arena-client (Start-DevClient.ps1) is also running on
    the strict 5173 binding.

    The Registry Viewer is the authoring surface for cards, themes, and
    (post-WP-091) MATCH-SETUP loadout JSON. Unlike the arena-client, it
    has no CORS coupling to the game server, so port bumping is harmless.
    It also doesn't read DATABASE_URL, so no env-var clearing is needed.

    Pass -KillStaleListeners to first reclaim ports 5173-5176 from zombie
    processes before starting (use sparingly — kills any process holding
    those ports without confirmation).

    For a full local smoke test combining game server + arena-client + viewer:

      Window A:  pwsh scripts/Start-SmokeTest.ps1 -ServerOnly
      Window B:  pwsh scripts/Start-DevClient.ps1
      Window C:  pwsh scripts/Start-DevViewer.ps1

.EXAMPLE
    pwsh scripts/Start-DevViewer.ps1

.EXAMPLE
    pwsh scripts/Start-DevViewer.ps1 -KillStaleListeners
#>

[CmdletBinding()]
param(
    [switch] $KillStaleListeners
)

$ErrorActionPreference = 'Stop'

# Resolve repo root (this script lives at <repo>/scripts/Start-DevViewer.ps1).
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

if ($KillStaleListeners) {
    Write-Host "Killing stale listeners on 5173-5176..." -ForegroundColor Yellow
    $stalePorts = @(5173, 5174, 5175, 5176)
    Get-NetTCPConnection -LocalPort $stalePorts -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Milliseconds 500
}

Write-Host ""
Write-Host "=== Legendary Arena — Registry Viewer Dev ===" -ForegroundColor Cyan
Write-Host "  Viewer : http://localhost:5173 (or next free port if 5173 is held)" -ForegroundColor Gray
Write-Host "  Stop   : Ctrl+C" -ForegroundColor Gray
Write-Host ""
Write-Host "Watch the startup banner for the actual port Vite selected." -ForegroundColor DarkGray
Write-Host ""

pnpm --filter registry-viewer dev
