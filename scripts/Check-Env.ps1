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
        if ($versionOutput -match '(\d+\.\d+\.\d+)') {
            $versionString = $Matches[1]
        } else {
            $versionString = "unknown"
        }

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

$repoRoot = git rev-parse --show-toplevel 2>$null
if (-not $repoRoot) { $repoRoot = Get-Location }
$envPath = Join-Path $repoRoot '.env'
$placeholderCount = 0
# why: R2 / credential SHAPE violations (e.g. R2_ACCOUNT_ID holding a full URL
# instead of the bare 32-hex account id — the cause of the WP-106 avatar-upload
# outage) are tracked separately from placeholders and force a non-zero exit.
$formatErrors = 0

if (-not (Test-Path $envPath)) {
    Write-Host "  ⚠ .env file not found at $envPath" -ForegroundColor Yellow
    Write-Host "    Copy .env.example to .env and fill in real values." -ForegroundColor Yellow
} else {
    Write-Host "  ✓ .env found at $envPath" -ForegroundColor Green

    $envLines = Get-Content $envPath
    # why: collect name -> value in memory so the format-validation pass below
    # can shape-check specific credential vars. Values are never printed.
    $envVars = @{}

    foreach ($line in $envLines) {
        $trimmedLine = $line.Trim()

        if ($trimmedLine -eq '' -or $trimmedLine.StartsWith('#')) {
            continue
        }

        if ($trimmedLine -match '^([^=]+)=(.*)$') {
            $varName = $Matches[1].Trim()
            $varValue = $Matches[2].Trim()
            $envVars[$varName] = $varValue

            $status = "SET"
            $statusColor = "Green"
            $statusIcon = "✓"

            if ($varValue -eq '' -or
                $varValue -match '^your-' -or
                $varValue -match '^change-me$' -or
                $varValue -match '^REPLACE_' -or
                $varValue -match '^<.*>$' -or
                $varValue -match '^X{4,}$') {

                $status = "PLACEHOLDER"
                $statusColor = "Yellow"
                $statusIcon = "✗"
                $placeholderCount++
            }

            # Never print the actual value — only the status
            Write-Host "  $($varName.PadRight(22)): $status $statusIcon" -ForegroundColor $statusColor
        }
    }

    # ── R2 / credential shape validation (never prints values) ──────────────
    # why: the WP-106 avatar-upload outage was caused by R2_ACCOUNT_ID being set
    # to the full S3 endpoint URL instead of the bare 32-hex Cloudflare account
    # id. The server interpolates it into
    # `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, so a full-URL value
    # double-wraps into a dead endpoint and every R2 write fails with a generic
    # error. These checks catch that class of mistake (and malformed keys after
    # a token rotation) before it reaches a deploy. Local .env stores the R2
    # token under AWS_* names; R2_ACCOUNT_ID usually lives only on the Render
    # deploy, but is validated here whenever it is present.
    $hex32 = '^[0-9a-f]{32}$'
    $hex64 = '^[0-9a-f]{64}$'

    if ($envVars.ContainsKey('R2_ACCOUNT_ID')) {
        $accountId = $envVars['R2_ACCOUNT_ID']
        if ($accountId -match '^https?://' -or $accountId -notmatch $hex32) {
            Write-Host "  ✗ R2_ACCOUNT_ID is malformed — expected the bare 32-hex account id, not a URL." -ForegroundColor Red
            Write-Host "    The server builds https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com; a URL here double-wraps and breaks every R2 write." -ForegroundColor Yellow
            $formatErrors++
        } else {
            Write-Host "  ✓ R2_ACCOUNT_ID shape looks correct (bare 32-hex)." -ForegroundColor Green
        }
    }

    if ($envVars.ContainsKey('AWS_ACCESS_KEY_ID') -and $envVars['AWS_ACCESS_KEY_ID'] -ne '' -and $envVars['AWS_ACCESS_KEY_ID'] -notmatch $hex32) {
        Write-Host "  ⚠ AWS_ACCESS_KEY_ID does not look like a Cloudflare R2 access key id (expected 32-hex)." -ForegroundColor Yellow
    }
    if ($envVars.ContainsKey('AWS_SECRET_ACCESS_KEY') -and $envVars['AWS_SECRET_ACCESS_KEY'] -ne '' -and $envVars['AWS_SECRET_ACCESS_KEY'] -notmatch $hex64) {
        Write-Host "  ⚠ AWS_SECRET_ACCESS_KEY does not look like a Cloudflare R2 secret (expected 64-hex)." -ForegroundColor Yellow
    }
    if ($envVars.ContainsKey('R2_PUBLIC_URL') -and $envVars['R2_PUBLIC_URL'] -notmatch '^https://') {
        Write-Host "  ⚠ R2_PUBLIC_URL should be an https:// URL." -ForegroundColor Yellow
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

        # why: validate the endpoint host is a single, well-formed R2 S3 URL —
        # https://<32-hex-account-id>.r2.cloudflarestorage.com. Catches the same
        # double-wrap / full-URL-in-account-id mistake that took down avatar
        # upload (WP-106). The endpoint carries only the non-secret account id,
        # and is not printed here regardless.
        if ($configContent -match '(?m)^\s*endpoint\s*=\s*(\S+)') {
            $rcloneEndpoint = $Matches[1]
            if ($rcloneEndpoint -match '^https://[0-9a-f]{32}\.r2\.cloudflarestorage\.com/?$') {
                Write-Host "  ✓ [r2] endpoint is well-formed" -ForegroundColor Green
            } else {
                Write-Host "  ✗ [r2] endpoint is malformed — expected https://<32-hex-account-id>.r2.cloudflarestorage.com" -ForegroundColor Red
                $formatErrors++
            }
        }
        # why: this remote uses env_auth (credentials read from AWS_ACCESS_KEY_ID
        # / AWS_SECRET_ACCESS_KEY at runtime), so there is no stored secret in
        # rclone.conf to rotate — rotating the .env values covers rclone too.
        if ($configContent -match '(?m)^\s*env_auth\s*=\s*true') {
            Write-Host "  ✓ [r2] uses env_auth (creds from AWS_* env vars; nothing to rotate in rclone.conf)" -ForegroundColor DarkGray
        }
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
if ($formatErrors -gt 0)     { $summaryItems += "Cred/format err: $formatErrors" }
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

# ── Hard exit for automation ──────────────────────────────────────────────────

$criticalFailure =
    ($toolsMissing -gt 0) -or
    ($configMissing)      -or
    ($placeholderCount -gt 0) -or
    ($formatErrors -gt 0)

if ($criticalFailure) {
    exit 1
}
