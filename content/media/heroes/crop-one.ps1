#Requires -Version 5.1

<#
.SYNOPSIS
    Crop ONE named derivative asset from a Suno _MASTER WAV.

.DESCRIPTION
    PowerShell equivalent of crop-one.sh. Interactive / single-crop
    sibling of crop-hero.ps1 (which batches all 4 at once). Use this
    for timestamp discovery and MT03 ambient-loop experiments via
    the -Loop parameter.

    Automates one-at-a-time crops outside Suno.com using ffmpeg with
    -c copy (lossless PCM; no re-encoding, sample-accurate).

    Asset tokens map to locked filenames and duration spec:
      MT01 -> preview-intro   (spec: 3-6s)
      MT02 -> match-start     (spec: 6-20s)
      MT03 -> ambient-loop    (spec: 60-240s; use -Loop to stitch if crop too short)
      MT04 -> main-theme      (spec: 45-120s)

    Time format accepted by ffmpeg: HH:MM:SS, MM:SS, SS.mmm, or plain seconds.

    -Loop N concatenates the cropped result N times total. Useful for
    MT03 when a 30s beat-aligned loop needs to reach the 60s+ target.
    Note: loop seams may be audible unless the crop starts and ends on
    matching bar boundaries.

.PARAMETER Asset
    One of MT01, MT02, MT03, MT04.

.PARAMETER Start
    Start time (HH:MM:SS, MM:SS, or seconds).

.PARAMETER End
    End time (same format as Start).

.PARAMETER Loop
    Optional. Repeat the cropped result N times total. Defaults to 1 (no loop).

.EXAMPLE
    pwsh ..\crop-one.ps1 -Asset MT01 -Start 0:02 -End 0:07
    Crops a 5s preview-intro.

.EXAMPLE
    pwsh ..\crop-one.ps1 MT04 0:15 1:15
    Positional args. Crops a 60s main-theme.

.EXAMPLE
    pwsh $Repo\content\media\heroes\crop-one.ps1 MT03 30 60 -Loop 4   ($Repo = your checkout)
    Crops a 30s section, then loops it 4x -> 120s ambient-loop.

.NOTES
    Requires ffmpeg + ffprobe on PATH.
    Windows install:  winget install -e --id Gyan.FFmpeg

    Run from a hero's pCloud audio folder so the script can infer the
    slug from the folder name (e.g. C:\pcloud\LA\audio\heroes\black-widow\).
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateSet('MT01', 'MT02', 'MT03', 'MT04')]
    [string]$Asset,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$Start,

    [Parameter(Mandatory = $true, Position = 2)]
    [string]$End,

    [Parameter()]
    [ValidateRange(1, 2147483647)]
    [int]$Loop = 1,

    [Parameter()]
    [switch]$SkipMp3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$specs = @{
    MT01 = @{ Name = 'preview-intro'; Min = 3;  Max = 6   }
    MT02 = @{ Name = 'match-start';   Min = 6;  Max = 20  }
    MT03 = @{ Name = 'ambient-loop';  Min = 60; Max = 240 }
    MT04 = @{ Name = 'main-theme';    Min = 45; Max = 120 }
}
$spec = $specs[$Asset]

$slug   = Split-Path -Leaf (Get-Location)
$master = "hero-${slug}_MASTER.wav"
$output = "hero-${slug}_${Asset}_$($spec.Name).wav"

if (-not (Test-Path -LiteralPath $master)) {
    Write-Error "master WAV not found at $PWD\$master. Run this script from a hero's pCloud audio folder (e.g. C:\pcloud\LA\audio\heroes\black-widow\)."
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

$masterDuration = Get-AudioDuration -Path $master
if ($null -eq $masterDuration) {
    Write-Error "Could not determine duration of $master. The file may be malformed or empty."
    exit 1
}
if ($masterDuration -lt 30) {
    Write-Error "master $master is only $($masterDuration.ToString('F2'))s — too short to be a Suno master. Did a preview clip overwrite it?"
    exit 1
}

Write-Host "Cropping $master [$Start -> $End] -> $output"
& ffmpeg -y -hide_banner -loglevel error -i $master -ss $Start -to $End -c copy $output
if ($LASTEXITCODE -ne 0) {
    Write-Error "ffmpeg crop failed for $output (exit code $LASTEXITCODE)"
    exit 1
}

if ($Loop -gt 1) {
    $tmp = $output -replace '\.wav$', '_unlooped.wav'
    Move-Item -LiteralPath $output -Destination $tmp -Force
    # -stream_loop N: plays input 1 + N times. For total playbacks = Loop, pass Loop - 1.
    & ffmpeg -y -hide_banner -loglevel error -stream_loop ($Loop - 1) -i $tmp -c copy $output
    if ($LASTEXITCODE -ne 0) {
        Write-Error "ffmpeg loop-stitch failed for $output (exit code $LASTEXITCODE)"
        exit 1
    }
    Remove-Item -LiteralPath $tmp
    Write-Host "  Looped ${Loop}x (watch for audible seams at bar-misaligned loop points)"
}

$duration = Get-AudioDuration -Path $output
if ($null -eq $duration) {
    $outSize = if (Test-Path -LiteralPath $output) { (Get-Item -LiteralPath $output).Length } else { 0 }
    Write-Error "Output $output has no measurable duration (size $outSize bytes). The crop range [$Start -> $End] likely exceeds master length ($($masterDuration.ToString('F2'))s)."
    exit 1
}
$durStr = $duration.ToString('F2')

Write-Host "Done. Output: $output (${durStr}s)"

if ($duration -lt $spec.Min) {
    Write-Host "  WARNING: ${durStr}s is BELOW the $($spec.Min)s minimum for $Asset"
}
elseif ($duration -gt $spec.Max) {
    Write-Host "  WARNING: ${durStr}s is ABOVE the $($spec.Max)s maximum for $Asset"
}
else {
    Write-Host "  OK: duration ${durStr}s is within spec ($($spec.Min)-$($spec.Max)s)"
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
