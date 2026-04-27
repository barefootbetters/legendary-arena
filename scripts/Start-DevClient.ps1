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

    # Post-kill verification — strict-port mode below will fail loudly
    # if 5173 is still held, but a friendly heads-up here saves a step.
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
Write-Host "=== Legendary Arena — Arena Client Dev (strict 5173) ===" -ForegroundColor Cyan
Write-Host "  Client : http://localhost:5173  (CORS-aligned with the game server)" -ForegroundColor Gray
Write-Host "  Stop   : Ctrl+C" -ForegroundColor Gray
Write-Host ""
Write-Host "If startup fails with EADDRINUSE, re-run with -KillStaleListeners." -ForegroundColor DarkGray
Write-Host ""

pnpm --filter '@legendary-arena/arena-client' dev --port 5173 --strictPort
