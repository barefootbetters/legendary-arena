<#
.SYNOPSIS
    PowerShell environment and tooling check for Legendary Arena.

.DESCRIPTION
    Verifies local dev tools, .env configuration, rclone config, and npm
    packages without requiring Node.js or network access. Run this first
    on any new machine before anything else.

.EXAMPLE
    pwsh scripts/Check-Env.ps1
#>

$ErrorActionPreference = 'Continue'

Write-Host ""
Write-Host "=== Legendary Arena — PowerShell Environment Check ===" -ForegroundColor Cyan
Write-Host ""

# ── Section A — PATH and Tool Verification ────────────────────────────────────

Write-Host "PATH entries searched:" -ForegroundColor DarkGray
$env:PATH -split ';' | Where-Object { $_ } | ForEach-Object {
    Write-Host "  $_" -ForegroundColor DarkGray
}
Write-Host ""

Write-Host "── TOOLS ON PATH ──────────────────────────────────────────────────────────────" -ForegroundColor White

$toolsMissing = 0

# why: Get-Command is PowerShell-native, handles both .exe and .cmd extensions,
# and returns a structured object with the resolved source path.
# where.exe is a legacy Win32 command that can produce wrong results when
# multiple versions of a tool are installed at different locations.

function Test-ToolOnPath {
    param(
        [string]$ToolCommand,
        [string]$MinVersion,
        [string]$RemediationMessage
    )

    $toolInfo = Get-Command $ToolCommand -ErrorAction SilentlyContinue

    if (-not $toolInfo) {
        Write-Host "  ✗ $($ToolCommand.PadRight(10)) NOT FOUND on PATH." -ForegroundColor Red
        Write-Host "    $RemediationMessage" -ForegroundColor Yellow
        $script:toolsMissing++
        return
    }

    $resolvedPath = $toolInfo.Source
    try {
        $versionOutput = & $ToolCommand --version 2>&1 | Select-Object -First 1
        $versionString = ($versionOutput -replace '[^0-9.]', '' -split '\.' | Select-Object -First 3) -join '.'

        if ($MinVersion) {
            $installedMajor = [int]($versionString.Split('.')[0])
            $requiredMajor = [int]($MinVersion.Split('.')[0])

            if ($installedMajor -lt $requiredMajor) {
                Write-Host "  ⚠ $($ToolCommand.PadRight(10)) v$versionString — below required v$MinVersion" -ForegroundColor Yellow
                Write-Host "    $RemediationMessage" -ForegroundColor Yellow
                return
            }
        }

        Write-Host "  ✓ $($ToolCommand.PadRight(10)) v$versionString   ($resolvedPath)" -ForegroundColor Green
    } catch {
        Write-Host "  ✓ $($ToolCommand.PadRight(10)) (version unknown)   ($resolvedPath)" -ForegroundColor Green
    }
}

Test-ToolOnPath -ToolCommand "node" -MinVersion "22" `
    -RemediationMessage "Install Node.js v22+ from https://nodejs.org"

Test-ToolOnPath -ToolCommand "npm" -MinVersion "" `
    -RemediationMessage "npm is bundled with Node.js. Reinstall Node.js."

Test-ToolOnPath -ToolCommand "pnpm" -MinVersion "8" `
    -RemediationMessage "Run: npm install -g pnpm"

# why: dotenv-cli v11+ does not support --version. Detect via npm list instead.
$dotenvInfo = Get-Command dotenv -ErrorAction SilentlyContinue
if (-not $dotenvInfo) {
    Write-Host "  ✗ $('dotenv'.PadRight(10)) NOT FOUND on PATH." -ForegroundColor Red
    Write-Host "    Run: npm install -g dotenv-cli" -ForegroundColor Yellow
    $toolsMissing++
} else {
    $dotenvVersion = "unknown"
    try {
        $npmListOutput = npm list -g dotenv-cli --depth=0 2>&1 | Out-String
        if ($npmListOutput -match 'dotenv-cli@([\d.]+)') {
            $dotenvVersion = $Matches[1]
        }
    } catch { }
    Write-Host "  ✓ $('dotenv'.PadRight(10)) v$dotenvVersion   ($($dotenvInfo.Source))" -ForegroundColor Green
}

Test-ToolOnPath -ToolCommand "git" -MinVersion "" `
    -RemediationMessage "Install from https://git-scm.com"

Test-ToolOnPath -ToolCommand "rclone" -MinVersion "" `
    -RemediationMessage "Install from https://rclone.org/downloads/ and add the install directory to your Windows PATH."

Write-Host ""

# ── Section B — .env File Check ───────────────────────────────────────────────

Write-Host "── .ENV FILE ──────────────────────────────────────────────────────────────" -ForegroundColor White

$envPath = Join-Path (Get-Location) '.env'
$placeholderCount = 0

if (-not (Test-Path $envPath)) {
    Write-Host "  ⚠ .env file not found at $envPath" -ForegroundColor Yellow
    Write-Host "    Copy .env.example to .env and fill in real values." -ForegroundColor Yellow
} else {
    Write-Host "  ✓ .env found at $envPath" -ForegroundColor Green

    $envLines = Get-Content $envPath

    foreach ($line in $envLines) {
        $trimmedLine = $line.Trim()

        if ($trimmedLine -eq '' -or $trimmedLine.StartsWith('#')) {
            continue
        }

        if ($trimmedLine -match '^([^=]+)=(.*)$') {
            $varName = $Matches[1].Trim()
            $varValue = $Matches[2].Trim()

            $status = "SET"
            $statusColor = "Green"
            $statusIcon = "✓"

            if ($varValue -eq '' -or
                $varValue -match '^your-' -or
                $varValue -match '^change-me$' -or
                $varValue -match '^REPLACE_' -or
                $varValue -match '^<.*>$') {

                $status = "PLACEHOLDER"
                $statusColor = "Yellow"
                $statusIcon = "✗"
                $placeholderCount++
            }

            # Never print the actual value — only the status
            Write-Host "  $($varName.PadRight(22)): $status $statusIcon" -ForegroundColor $statusColor
        }
    }
}

Write-Host ""

# ── Section C — rclone Config Check ───────────────────────────────────────────

Write-Host "── RCLONE CONFIG ──────────────────────────────────────────────────────────" -ForegroundColor White

# why: rclone on Windows stores its config under %APPDATA%\rclone\rclone.conf,
# not ~/.config/rclone as it does on Linux/macOS. Using $env:APPDATA resolves
# correctly across all Windows user account names without hardcoding a path.
$rcloneConfigPath = Join-Path $env:APPDATA 'rclone' 'rclone.conf'
$configMissing = $false

if (-not (Test-Path $rcloneConfigPath)) {
    Write-Host "  ✗ Config not found at $rcloneConfigPath" -ForegroundColor Red
    Write-Host "    Run: rclone config  (see docs/rclone-setup.md)" -ForegroundColor Yellow
    $configMissing = $true
} else {
    Write-Host "  ✓ Config found at $rcloneConfigPath" -ForegroundColor Green

    $configContent = Get-Content $rcloneConfigPath -Raw
    if ($configContent -match '\[r2\]') {
        Write-Host "  ✓ [r2] remote section found in config" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ [r2] remote section NOT found in rclone config." -ForegroundColor Yellow
        Write-Host "    Run: rclone config  and create an 'r2' remote for Cloudflare R2." -ForegroundColor Yellow
    }
}

Write-Host ""

# ── Section D — npm Package Check ─────────────────────────────────────────────

Write-Host "── NPM PACKAGES ───────────────────────────────────────────────────────────" -ForegroundColor White

$packagesMissing = 0

function Test-NpmPackage {
    param(
        [string]$PackageName,
        [string]$RemediationMessage
    )

    $packageJsonPath = Join-Path "node_modules" $PackageName "package.json"

    if (-not (Test-Path $packageJsonPath)) {
        Write-Host "  ✗ $($PackageName.PadRight(16)) NOT FOUND in node_modules." -ForegroundColor Red
        Write-Host "    $RemediationMessage" -ForegroundColor Yellow
        $script:packagesMissing++
        return
    }

    try {
        $packageData = Get-Content $packageJsonPath | ConvertFrom-Json
        Write-Host "  ✓ $($PackageName.PadRight(16)) v$($packageData.version)   (node_modules/$PackageName)" -ForegroundColor Green
    } catch {
        Write-Host "  ⚠ $($PackageName.PadRight(16)) Found but package.json is unreadable." -ForegroundColor Yellow
    }
}

Test-NpmPackage -PackageName "boardgame.io" `
    -RemediationMessage "Run: pnpm install (once game-engine package exists with boardgame.io dependency)"

Test-NpmPackage -PackageName "zod" `
    -RemediationMessage "Run: pnpm install (zod is a registry package dependency)"

Write-Host ""

# ── Summary ───────────────────────────────────────────────────────────────────

Write-Host "── SUMMARY ────────────────────────────────────────────────────────────────" -ForegroundColor White

$summaryItems = @()
if ($toolsMissing -gt 0)    { $summaryItems += "Tools missing  : $toolsMissing" }
if ($placeholderCount -gt 0) { $summaryItems += "Placeholders   : $placeholderCount" }
if ($configMissing)          { $summaryItems += "Config missing : rclone" }
if ($packagesMissing -gt 0)  { $summaryItems += "Packages       : $packagesMissing missing" }

if ($summaryItems.Count -eq 0) {
    Write-Host "  All checks passed." -ForegroundColor Green
} else {
    foreach ($item in $summaryItems) {
        Write-Host "  $item" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "  Next: fix the above, then run network checks with: pnpm check" -ForegroundColor Cyan
Write-Host ""
