# To Run
# Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
# .\download-legendarycardgame-co2e.ps1

# =========================
# Configuration
# =========================
$PageUrl   = "https://www.legendarycardgame.com/core-set-at-a-glace-2ndedition"
$OutputDir = "co2e"

# =========================
# Setup
# =========================
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$base = [System.Uri]$PageUrl
$response = Invoke-WebRequest $PageUrl

# =========================
# Collect image URLs
# =========================
$imgUrls = @()

# <img> tags
$imgUrls += $response.Images | Select-Object -ExpandProperty src

# Background / inline images (regex)
$imgUrls += [regex]::Matches(
    $response.Content,
    'https?://[^"''\)]+?\.(jpg|jpeg|png|webp)'
).Value

$imgUrls = $imgUrls | Where-Object { $_ } | Sort-Object -Unique

# =========================
# Download images
# =========================
foreach ($src in $imgUrls) {

    $url = if ($src -match '^https?://') {
        $src
    } else {
        (New-Object System.Uri($base, $src)).AbsoluteUri
    }

    $fileName = Split-Path $url -Leaf
    $outFile  = Join-Path $OutputDir $fileName

    if (-not (Test-Path $outFile)) {
        Write-Host "Downloading $fileName"
        Invoke-WebRequest $url -OutFile $outFile
    }
}
