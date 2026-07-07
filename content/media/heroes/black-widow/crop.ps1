#Requires -Version 5.1

<#
.SYNOPSIS
    TEMPLATE. Crop a hero _MASTER WAV into all 4 derivative tracks in one pass.

.DESCRIPTION
    PowerShell equivalent of crop-hero.sh. Produces the 4 hero music
    tracks (MT01-MT04) from a single Suno master, per MUSIC-AUTHORING.md
    golden rule: "one prompt, four hero derivatives." Event stings
    (ES01-ES04) are match-level, not character-level, so they are
    intentionally omitted for hero themes.

    Uses ffmpeg -c copy (sample-accurate lossless PCM; no re-encoding).

    Sibling: crop-one.ps1 (single-crop interactive, good for timestamp
    discovery and MT03 ambient-loop experiments via -Loop N).

.EXAMPLE
    Workflow for a hero theme (e.g. black-widow):

      1. cd content/media/heroes/black-widow/
      2. Listen to hero-black-widow_MASTER.wav and note the 4 crop
         ranges (MT01 preview-intro, MT02 match-start, MT03 ambient-loop,
         MT04 main-theme).
      3. Copy this template into the hero folder as crop.ps1:
           Copy-Item ..\crop-hero.ps1 .\crop.ps1
         Then edit the $crops array in your per-hero copy. Committing
         that copy alongside the WAVs documents provenance (how the
         derivatives were produced from the master) and makes future
         re-crops reproducible without re-listening.
      4. Run:  pwsh .\crop.ps1
      5. Review the OK / WARNING lines before committing.

.NOTES
    Requires ffmpeg + ffprobe on PATH.
    Windows install:  winget install -e --id Gyan.FFmpeg
    (Restart the terminal after install so PATH picks it up.)

    If PowerShell execution policy blocks the script, invoke with:
      pwsh -ExecutionPolicy Bypass -File .\crop.ps1
#>

[CmdletBinding()]
param(
    [switch]$SkipMp3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$slug   = Split-Path -Leaf (Get-Location)
$master = "hero-${slug}_MASTER.wav"

# Edit these timestamps per master. Durations must fit MUSIC-AUTHORING.md spec:
#   MT01 preview-intro   3-6s
#   MT02 match-start     6-20s
#   MT03 ambient-loop    60-240s
#   MT04 main-theme      45-120s
$crops = @(
    # PLACEHOLDER TIMESTAMPS -- replace after listening to your master.
    @{ Start = '2:23.0';  End = '2:30.5';   Name = 'MT01_preview-intro' },
    @{ Start = '2:23.0';  End = '2:40.0';  Name = 'MT02_match-start'   },
    @{ Start = '1:00.0'; End = '2:10.0'; Name = 'MT03_ambient-loop'  },
    @{ Start = '0.0';  End = '3:04.12';  Name = 'MT04_main-theme'    }
)

if (-not (Test-Path -LiteralPath $master)) {
    Write-Error "master WAV not found at $PWD\$master. Run this script from a hero's subfolder (e.g. content/media/heroes/black-widow/)."
    exit 1
}

foreach ($dep in @('ffmpeg', 'ffprobe')) {
    if (-not (Get-Command $dep -ErrorAction SilentlyContinue)) {
        Write-Error "$dep not found on PATH. Install ffmpeg and retry (ffprobe ships with ffmpeg). Windows: winget install -e --id Gyan.FFmpeg"
        exit 1
    }
}

function Get-AudioDuration {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $raw = & ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $Path 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $raw -or $raw.Trim() -eq 'N/A') { return $null }
    try { return [double]$raw.Trim() } catch { return $null }
}

# Sanity-check master duration before cropping — catches the "I saved a
# short preview over the real master" failure mode early.
$masterDuration = Get-AudioDuration -Path $master
if ($null -eq $masterDuration) {
    Write-Error "Could not determine duration of $master. The file may be malformed or empty. Check manually with: ffprobe -i $master"
    exit 1
}
if ($masterDuration -lt 30) {
    Write-Error "master $master is only $($masterDuration.ToString('F2'))s — too short to be a Suno master. Did a preview clip overwrite it? The full Suno master should be 45s or longer."
    exit 1
}
Write-Host "Master duration: $($masterDuration.ToString('F2'))s"
Write-Host ""

$specs = @{
    MT01 = @{ Min = 3;  Max = 6   }
    MT02 = @{ Min = 6;  Max = 20  }
    MT03 = @{ Min = 60; Max = 240 }
    MT04 = @{ Min = 45; Max = 120 }
}

foreach ($crop in $crops) {
    $start  = $crop.Start
    $end    = $crop.End
    $name   = $crop.Name
    $output = "hero-${slug}_${name}.wav"
    $token  = $name.Split('_')[0]

    Write-Host "Cropping [$start -> $end] -> $output"
    & ffmpeg -y -hide_banner -loglevel error -i $master -ss $start -to $end -c copy $output
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  WARNING: ffmpeg crop failed for $output (exit code $LASTEXITCODE) — skipping."
        continue
    }

    $duration = Get-AudioDuration -Path $output
    if ($null -eq $duration) {
        $outSize = if (Test-Path -LiteralPath $output) { (Get-Item -LiteralPath $output).Length } else { 0 }
        Write-Host "  WARNING: $output has no measurable duration (size $outSize bytes). The crop range [$start -> $end] likely exceeds master length ($($masterDuration.ToString('F2'))s)."
        continue
    }
    $durStr = $duration.ToString('F2')
    $bounds = $specs[$token]

    if ($null -eq $bounds) {
        Write-Host "  OK: $output (${durStr}s, no spec for token $token)"
    }
    elseif ($duration -lt $bounds.Min) {
        Write-Host "  WARNING: $output ${durStr}s BELOW $($bounds.Min)s min"
    }
    elseif ($duration -gt $bounds.Max) {
        Write-Host "  WARNING: $output ${durStr}s ABOVE $($bounds.Max)s max"
    }
    else {
        Write-Host "  OK: $output (${durStr}s, spec $($bounds.Min)-$($bounds.Max)s)"
    }

    if (-not $SkipMp3) {
        $mp3 = $output -replace '\.wav$', '.mp3'
        # why: MUSIC-AUTHORING.md locks loudnorm I=-13 LRA=11 TP=-1 @ 320 kbps MP3 for R2 distribution.
        & ffmpeg -y -hide_banner -loglevel error -i $output -af 'loudnorm=I=-13:LRA=11:TP=-1' -b:a 320k $mp3
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  WARNING: MP3 encode failed for $mp3 (exit code $LASTEXITCODE)"
        }
        else {
            Write-Host "  Encoded: $mp3 (320 kbps, loudnorm -13 LUFS)"
        }
    }
}

Write-Host ""
if ($SkipMp3) {
    Write-Host "Done. 4 WAV derivatives written to $PWD."
    Write-Host "Next: re-run without -SkipMp3, or encode MP3s per MUSIC-AUTHORING.md Pro Tips."
}
else {
    Write-Host "Done. 4 WAV masters + 4 MP3 derivatives written to $PWD."
    Write-Host "Next: upload MP3s to R2 (music.barefootbetters.com/heroes/) and paste the 4 URLs into content/themes/heroes/${slug}.json -> musicAssets.*Url."
}
