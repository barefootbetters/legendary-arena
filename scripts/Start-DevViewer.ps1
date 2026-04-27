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
    $stalePorts = @(5173, 5174, 5175, 5176)
    Write-Host "Killing stale listeners on $($stalePorts -join ', ')..." -ForegroundColor Yellow

    # why: per-port loop with explicit diagnostics so failures are visible.
    # Mirrors the pattern in Start-SmokeTest.ps1 (see that file's same
    # block for full rationale). The previous one-liner suppressed all
    # errors with `-ErrorAction SilentlyContinue`, masking permission
    # denials, missing PIDs, and process-already-exited cases.
    $killedPids = New-Object 'System.Collections.Generic.HashSet[int]'
    foreach ($port in $stalePorts) {
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($null -eq $connections) {
            Write-Host "  port $port : free" -ForegroundColor DarkGray
            continue
        }
        foreach ($conn in @($connections)) {
            $procId = $conn.OwningProcess
            if ($procId -eq 0 -or $procId -eq 4) {
                Write-Host "  port $port : held by SYSTEM PID $procId (cannot kill)" -ForegroundColor Red
                continue
            }
            if ($killedPids.Contains([int]$procId)) {
                Write-Host "  port $port : already killed PID $procId" -ForegroundColor DarkGray
                continue
            }
            try {
                $proc = Get-Process -Id $procId -ErrorAction Stop
                Write-Host "  port $port : killing PID $procId ($($proc.ProcessName))..." -ForegroundColor Yellow -NoNewline
                Stop-Process -Id $procId -Force -ErrorAction Stop
                $null = $killedPids.Add([int]$procId)
                Write-Host " ok" -ForegroundColor Green
            }
            catch {
                Write-Host " Stop-Process failed: $($_.Exception.Message)" -ForegroundColor Red
                Write-Host "  port $port : retrying via taskkill PID $procId..." -ForegroundColor Yellow -NoNewline
                $tkOutput = & taskkill /F /PID $procId 2>&1
                if ($LASTEXITCODE -eq 0) {
                    $null = $killedPids.Add([int]$procId)
                    Write-Host " ok (taskkill)" -ForegroundColor Green
                }
                else {
                    Write-Host " taskkill failed: $tkOutput" -ForegroundColor Red
                }
            }
        }
    }

    # 2-second wait so Windows can release LISTENING sockets after kill.
    Start-Sleep -Seconds 2

    # Post-kill verification — Vite picks the first free port starting at
    # 5173, so a stuck process on an early port silently bumps the viewer
    # higher. This warning surfaces the cause instead of leaving the user
    # to wonder why the viewer is on 5176 instead of 5173.
    $stillHeld = @()
    foreach ($port in $stalePorts) {
        $check = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($null -ne $check) {
            $stillHeld += $port
        }
    }
    if ($stillHeld.Count -gt 0) {
        Write-Host ""
        Write-Host "WARNING: ports still held after kill: $($stillHeld -join ', ')" -ForegroundColor Red
        Write-Host "Inspect with: Get-NetTCPConnection -LocalPort $($stillHeld[0]) | Select-Object OwningProcess" -ForegroundColor DarkGray
        Write-Host "And:          Get-Process -Id <PID>" -ForegroundColor DarkGray
        Write-Host "If owned by a process you don't recognize, reboot if Stop-Process / taskkill won't release it." -ForegroundColor DarkGray
        Write-Host ""
    }
    else {
        Write-Host "  all ports verified free." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "=== Legendary Arena — Registry Viewer Dev ===" -ForegroundColor Cyan
Write-Host "  Viewer : http://localhost:5173 (or next free port if 5173 is held)" -ForegroundColor Gray
Write-Host "  Stop   : Ctrl+C" -ForegroundColor Gray
Write-Host ""
Write-Host "Watch the startup banner for the actual port Vite selected." -ForegroundColor DarkGray
Write-Host ""

pnpm --filter registry-viewer dev
