#Requires -Version 5.1

<#
.SYNOPSIS
    Crop a scenario _MASTER WAV into all 8 theme derivatives in one pass.

.DESCRIPTION
    PowerShell equivalent of crop-theme.sh. Produces 4 music tracks
    (MT01-MT04) and 4 event stings (ES01-ES04) from a single Suno
    master, per MUSIC-AUTHORING.md golden rule: "one prompt, eight
    derivatives." Uses ffmpeg -c copy (sample-accurate lossless PCM;
    no re-encoding).

.EXAMPLE
    Workflow for a scenario theme (e.g. age-of-apocalypse):

      1. cd content/media/age-of-apocalypse/
      2. Listen to age-of-apocalypse_MASTER.wav and note the 8 crop
         ranges (one per asset).
      3. Edit the $crops array in this script with those timestamps
         -- OR copy this script into the scenario folder first (as
         crop.ps1) if you don't want to dirty the shared version on
         every pass. A committed per-scenario copy also documents
         provenance (how the derivatives were produced).
      4. Run:  pwsh ..\crop-theme.ps1
      5. Review the OK / WARNING lines before committing.

.NOTES
    Requires ffmpeg + ffprobe on PATH.
    Windows install:  winget install -e --id Gyan.FFmpeg
    (Restart the terminal after install so PATH picks it up.)

    If PowerShell execution policy blocks the script, invoke with:
      pwsh -ExecutionPolicy Bypass -File ..\crop-theme.ps1
#>

[CmdletBinding()]
param(
    [switch]$SkipMp3
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$theme  = Split-Path -Leaf (Get-Location)
$master = "${theme}_MASTER.wav"

# Edit these timestamps per master. Durations must fit MUSIC-AUTHORING.md spec:
#   MT01 preview-intro   3-6s       MT03 ambient-loop    60-240s
#   MT02 match-start     6-20s      MT04 main-theme      45-120s
#   ES01 scheme-twist    1-3s       ES03 villain-ambush  0.75-2s
#   ES02 master-strike   1-3s       ES04 bystander       0.75-1.5s
$crops = @(
    # PLACEHOLDER TIMESTAMPS -- replace after listening to your master.
    @{ Start = '0.0';   End = '5.5';   Name = 'MT01_preview-intro'  },
    @{ Start = '12.3';  End = '28.0';  Name = 'MT02_match-start'    },
    @{ Start = '45.0';  End = '180.0'; Name = 'MT03_ambient-loop'   },
    @{ Start = '0.0';   End = '90.0';  Name = 'MT04_main-theme'     },
    @{ Start = '8.2';   End = '10.5';  Name = 'ES01_scheme-twist'   },
    @{ Start = '22.1';  End = '24.0';  Name = 'ES02_master-strike'  },
    @{ Start = '35.8';  End = '37.2';  Name = 'ES03_villain-ambush' },
    @{ Start = '48.5';  End = '49.8';  Name = 'ES04_bystander'      }
)

if (-not (Test-Path -LiteralPath $master)) {
    Write-Error "master WAV not found at $PWD\$master. Run this script from a scenario folder (e.g. content/media/age-of-apocalypse/)."
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
    Write-Error "Could not determine duration of $master. The file may be malformed or empty."
    exit 1
}
if ($masterDuration -lt 30) {
    Write-Error "master $master is only $($masterDuration.ToString('F2'))s — too short to be a Suno master. Did a preview clip overwrite it?"
    exit 1
}
Write-Host "Master duration: $($masterDuration.ToString('F2'))s"
Write-Host ""

function Get-SpecBounds {
    param([string]$Token)
    switch ($Token) {
        'MT01' { @{ Min = 3;    Max = 6    }; break }
        'MT02' { @{ Min = 6;    Max = 20   }; break }
        'MT03' { @{ Min = 60;   Max = 240  }; break }
        'MT04' { @{ Min = 45;   Max = 120  }; break }
        'ES01' { @{ Min = 1;    Max = 3    }; break }
        'ES02' { @{ Min = 1;    Max = 3    }; break }
        'ES03' { @{ Min = 0.75; Max = 2    }; break }
        'ES04' { @{ Min = 0.75; Max = 1.5  }; break }
        default { @{ Min = 0;   Max = 99999 } }
    }
}

foreach ($crop in $crops) {
    $start  = $crop.Start
    $end    = $crop.End
    $name   = $crop.Name
    $output = "${theme}_${name}.wav"
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
    $bounds = Get-SpecBounds $token

    if ($duration -lt $bounds.Min) {
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
    Write-Host "Done. 8 WAV derivatives written to $PWD."
    Write-Host "Next: re-run without -SkipMp3, or encode MP3s per MUSIC-AUTHORING.md Pro Tips."
}
else {
    Write-Host "Done. 8 WAV masters + 8 MP3 derivatives written to $PWD."
    Write-Host "Next: upload MP3s to R2 and paste URLs into content/themes/${theme}.json -> musicAssets.*Url."
}
