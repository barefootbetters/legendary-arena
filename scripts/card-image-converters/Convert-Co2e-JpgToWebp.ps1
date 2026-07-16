# How to run
# Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
# .\Convert-Co2e-JpgToWebp.ps1
#
# Convert-Co2e-JpgToWebp.ps1
# Converts all .jpg/.jpeg in original-jpeg\co2e to .webp and saves to original\co2e
# Requires ImageMagick (magick.exe). Assumes magick is on PATH; falls back to known install path.

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- Paths ---
# why: resolve the staging root from the script's own location so the script is
# portable across machines. The older Convert-*.ps1 scripts hardcode a
# per-machine $StagingRoot (e.g. C:\GISE\...) and break when moved.
$StagingRoot = $PSScriptRoot
$InputDir    = Join-Path $StagingRoot "original-jpeg\co2e"
$OutputDir   = Join-Path $StagingRoot "original\co2e"

# --- WebP settings ---
$Quality     = 80              # 0-100 (higher = larger file / better quality)
$Recurse     = $true           # process subfolders
$SkipExisting = $true          # don't overwrite existing .webp
$StripMeta   = $true           # remove metadata for smaller output

# --- Resolve ImageMagick executable ---
function Resolve-MagickPath {
    $cmd = Get-Command magick -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    $fallback = "C:\Program Files\ImageMagick-7.1.2-Q16-HDRI\magick.exe"
    if (Test-Path -LiteralPath $fallback) { return $fallback }

    throw "ImageMagick not found. Ensure 'magick' is on PATH or installed at: $fallback"
}

$Magick = Resolve-MagickPath

# --- Ensure output directory exists ---
if (-not (Test-Path -LiteralPath $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

# --- Get files ---
$gciParams = @{
    LiteralPath = $InputDir
    File        = $true
    Include     = @("*.jpg","*.jpeg","*.JPG","*.JPEG")
}
if ($Recurse) { $gciParams.Recurse = $true }

$files = Get-ChildItem @gciParams
Write-Host "Found $($files.Count) JPG/JPEG files under: $InputDir"
Write-Host "Output directory: $OutputDir"
Write-Host "Using ImageMagick: $Magick"

# --- Convert ---
foreach ($f in $files) {

    # Preserve subfolder structure under OutputDir
    $relative = $f.FullName.Substring($InputDir.Length).TrimStart("\")
    $relativeDir = Split-Path $relative -Parent
    $targetDir = if ([string]::IsNullOrWhiteSpace($relativeDir)) { $OutputDir } else { Join-Path $OutputDir $relativeDir }

    if (-not (Test-Path -LiteralPath $targetDir)) {
        New-Item -ItemType Directory -Path $targetDir | Out-Null
    }

    $outFile = Join-Path $targetDir ($f.BaseName + ".webp")

    if ($SkipExisting -and (Test-Path -LiteralPath $outFile)) {
        Write-Host "SKIP (exists): $outFile"
        continue
    }

    Write-Host "CONVERT: $($f.FullName) -> $outFile"

    $args = @()
    $args += $f.FullName
    if ($StripMeta) { $args += "-strip" }
    $args += "-quality"
    $args += "$Quality"
    $args += $outFile

    & $Magick @args | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Conversion failed (exit $LASTEXITCODE) for file: $($f.FullName)"
    }
}

Write-Host "Done. WebP files written to: $OutputDir"
