<#
.SYNOPSIS
  Validate the Legendary Arena R2 data store against all Checklist A items.

.DESCRIPTION
  Wrapper script for packages/registry/scripts/validate.ts.
  Sets absolute paths for METADATA_DIR and SETS_DIR before calling pnpm,
  because pnpm --filter changes CWD to packages/registry/ and relative
  paths would resolve to the wrong location.

  Directory layout:
    data/metadata/   lookup files (sets.json, card-types.json, etc.)
    data/cards/      per-set card JSON files (core.json, mdns.json, etc.)

  The TypeScript script runs in five phases:
    Phase 1 — Registry manifest (metadata/sets.json)
    Phase 2 — Metadata files (sets.json, card-types.json, etc.)
    Phase 3 — Per-set card JSON (schema, imageUrl domain, data quality)
    Phase 4 — Cross-references (alwaysLeads consistency, slug uniqueness)
    Phase 5 — Image spot-checks (HEAD requests, skipped if -SkipImages)

.PARAMETER R2Mode
  Switch. When present, validates the live R2 bucket at
  https://images.barefootbetters.com instead of local files.
  Enables metadata/sets.json check and image spot-checks.

.PARAMETER SkipImages
  Switch. When present, skips Phase 5 image HEAD checks.
  Useful for fast local validation or when R2 is not reachable.

.PARAMETER ImageDelayMs
  Integer. Milliseconds to wait between image HEAD requests.
  Default: 50. Increase if hitting R2 rate limits.

.PARAMETER HealthOut
  String. Path where the JSON health report is written.
  Default: dist/registry-health.json (relative to packages/registry/).

.EXAMPLE
  # Local validation — fast, no network calls:
  pwsh scripts\Validate-R2.ps1

.EXAMPLE
  # Full R2 validation including image spot-checks:
  pwsh scripts\Validate-R2.ps1 -R2Mode

.EXAMPLE
  # R2 validation, skip images (faster):
  pwsh scripts\Validate-R2.ps1 -R2Mode -SkipImages

.EXAMPLE
  # Slow down image requests if hitting R2 rate limits:
  pwsh scripts\Validate-R2.ps1 -R2Mode -ImageDelayMs 200

.NOTES
  Requires:
    - pnpm installed and on PATH
    - tsx installed in packages/registry/ (run pnpm install first)
    - Node.js v18+
#>

[CmdletBinding()]
param(
    [switch]$R2Mode,
    [switch]$SkipImages,
    [int]$ImageDelayMs = 50,
    [string]$HealthOut = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Resolve paths ─────────────────────────────────────────────────────────────

# why: this script lives in monorepo root /scripts/ so PSScriptRoot's parent
# IS the monorepo root — this keeps the script portable regardless of the
# directory the user invokes it from
$MonoRepoRoot = Split-Path -Parent $PSScriptRoot
$MetadataDir  = Join-Path $MonoRepoRoot "data" "metadata"
$CardsDir     = Join-Path $MonoRepoRoot "data" "cards"
$RegistryDir  = Join-Path $MonoRepoRoot "packages" "registry"

# ── Pre-flight checks ─────────────────────────────────────────────────────────

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Legendary Arena — R2 Validate" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan

if (-not (Test-Path $MetadataDir)) {
    Write-Host ""
    Write-Host "✗ Metadata directory not found: $MetadataDir" -ForegroundColor Red
    Write-Host "  Expected: data\metadata\ containing sets.json, card-types.json, etc." -ForegroundColor Red
    exit 1
}

if (-not $R2Mode -and -not (Test-Path $CardsDir)) {
    Write-Host ""
    Write-Host "✗ Cards directory not found: $CardsDir" -ForegroundColor Red
    Write-Host "  Expected: data\cards\ containing {abbr}.json per set." -ForegroundColor Red
    exit 1
}

$TsxPath = Join-Path $RegistryDir "node_modules" ".bin" "tsx"
if (-not (Test-Path $TsxPath) -and -not (Test-Path "$TsxPath.cmd")) {
    Write-Host ""
    Write-Host "✗ tsx not found at: $TsxPath" -ForegroundColor Red
    Write-Host "  Run 'pnpm install' from the monorepo root first." -ForegroundColor Red
    exit 1
}

$PnpmCommand = Get-Command "pnpm" -ErrorAction SilentlyContinue
if ($null -eq $PnpmCommand) {
    Write-Host ""
    Write-Host "✗ pnpm is not on PATH." -ForegroundColor Red
    Write-Host "  Install pnpm: npm install -g pnpm" -ForegroundColor Red
    exit 1
}

# ── Print run configuration ───────────────────────────────────────────────────

$ModeLabel = if ($R2Mode) { "R2 (https://images.barefootbetters.com)" } else { "Local" }
Write-Host ""
Write-Host "  Mode:     $ModeLabel" -ForegroundColor White
Write-Host "  Metadata: $MetadataDir" -ForegroundColor DarkGray
if (-not $R2Mode) {
    Write-Host "  Sets:     $CardsDir" -ForegroundColor DarkGray
}
Write-Host "  Images:   $(if ($SkipImages) { 'SKIPPED' } else { 'enabled' })" -ForegroundColor DarkGray
if ($ImageDelayMs -ne 50) {
    Write-Host "  Delay:    ${ImageDelayMs}ms between requests" -ForegroundColor DarkGray
}
Write-Host ""

# ── Set environment variables ─────────────────────────────────────────────────

# why: pnpm --filter runs validate.ts with CWD set to packages/registry/
# so we must pass absolute paths — relative paths would resolve incorrectly
$env:METADATA_DIR   = $MetadataDir
$env:SETS_DIR       = $CardsDir
$env:IMAGE_DELAY_MS = $ImageDelayMs.ToString()

if ($R2Mode) {
    $env:R2_BASE_URL = "https://images.barefootbetters.com"
} else {
    # why: clear any stale R2_BASE_URL from a previous session to avoid
    # accidentally running against R2 when local mode is intended
    Remove-Item env:R2_BASE_URL -ErrorAction SilentlyContinue
}

if ($SkipImages) {
    $env:SKIP_IMAGES = "1"
} else {
    Remove-Item env:SKIP_IMAGES -ErrorAction SilentlyContinue
}

if ($HealthOut -ne "") {
    $env:HEALTH_OUT = $HealthOut
} else {
    Remove-Item env:HEALTH_OUT -ErrorAction SilentlyContinue
}

# ── Run validate.ts via pnpm ──────────────────────────────────────────────────

# why: running via pnpm --filter ensures tsx resolves from
# packages/registry/node_modules/.bin — not a globally installed version
$PnpmExitCode = 0
try {
    & pnpm --filter "@legendary-arena/registry" validate
    $PnpmExitCode = $LASTEXITCODE
} catch {
    Write-Host ""
    Write-Host "✗ pnpm encountered an unexpected error: $_" -ForegroundColor Red
    $PnpmExitCode = 1
}

# ── Clean up environment variables ────────────────────────────────────────────

# why: env vars set in this session persist for the process lifetime —
# cleaning up prevents carryover into subsequent commands
Remove-Item env:METADATA_DIR    -ErrorAction SilentlyContinue
Remove-Item env:SETS_DIR        -ErrorAction SilentlyContinue
Remove-Item env:R2_BASE_URL     -ErrorAction SilentlyContinue
Remove-Item env:SKIP_IMAGES     -ErrorAction SilentlyContinue
Remove-Item env:IMAGE_DELAY_MS  -ErrorAction SilentlyContinue
Remove-Item env:HEALTH_OUT      -ErrorAction SilentlyContinue

# ── Exit ──────────────────────────────────────────────────────────────────────

if ($PnpmExitCode -ne 0) {
    Write-Host ""
    Write-Host "  Exit: $PnpmExitCode (validation failed)" -ForegroundColor Red
    exit $PnpmExitCode
}

Write-Host ""
Write-Host "  Exit: 0 (validation passed)" -ForegroundColor Green
exit 0
