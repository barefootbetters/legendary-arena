<#
.SYNOPSIS
    Starts the arena-client Vite dev server on port 5173 with strict-port
    enforcement.

.DESCRIPTION
    Runs `pnpm --filter @legendary-arena/arena-client dev --port 5173
    --strictPort`. The strict-port flag makes Vite fail fast if 5173 is
    already held by another process rather than silently bumping to 5174,
    5175, etc. — important because the boardgame.io server's CORS
    allow-list permits only `http://localhost:5173`; a bumped port would
    silently break every fetch and WebSocket from the browser.

    Pass -KillStaleListeners to first reclaim ports 5173-5176 from zombie
    processes before starting (use sparingly — kills any process holding
    those ports without confirmation).

    This script does NOT touch the boardgame.io server. Pair it with
    Start-SmokeTest.ps1 -ServerOnly in another window when running a
    full smoke test.

.EXAMPLE
    pwsh scripts/Start-DevClient.ps1

.EXAMPLE
    pwsh scripts/Start-DevClient.ps1 -KillStaleListeners
#>

[CmdletBinding()]
param(
    [switch] $KillStaleListeners
)

$ErrorActionPreference = 'Stop'

# Resolve repo root (this script lives at <repo>/scripts/Start-DevClient.ps1).
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
Write-Host "=== Legendary Arena — Arena Client Dev (strict 5173) ===" -ForegroundColor Cyan
Write-Host "  Client : http://localhost:5173  (CORS-aligned with the game server)" -ForegroundColor Gray
Write-Host "  Stop   : Ctrl+C" -ForegroundColor Gray
Write-Host ""
Write-Host "If startup fails with EADDRINUSE, re-run with -KillStaleListeners." -ForegroundColor DarkGray
Write-Host ""

pnpm --filter '@legendary-arena/arena-client' dev --port 5173 --strictPort
