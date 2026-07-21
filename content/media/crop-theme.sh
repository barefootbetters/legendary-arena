#!/usr/bin/env bash
# crop-theme.sh — Crop a scenario _MASTER WAV into all 8 derivatives
# (4 music tracks + 4 event stings) in one pass, per MUSIC-AUTHORING.md.
#
# why: golden rule — one prompt, eight derivatives; no per-asset regenerations.
#
# Usage — working audio lives on pCloud (C:/pcloud/LA/audio/<theme>/, see
# Workspace Map); this script stays tracked in the repo. Run it from the
# theme's pCloud folder, pointing back at your checkout:
#   cd /c/pcloud/LA/audio/age-of-apocalypse/
#   bash "$REPO/content/media/crop-theme.sh"   # $REPO = your legendary-arena checkout
#
# Before running: edit the `crops` array below with timestamps from
# listening to <theme>_MASTER.wav. Values below are PLACEHOLDERS.

set -euo pipefail

# --skip-mp3: produce only WAVs (faster during iteration). Default produces both.
skip_mp3=0
for arg in "$@"; do
  case "$arg" in
    --skip-mp3) skip_mp3=1 ;;
    *) echo "Unknown flag: $arg (supported: --skip-mp3)" >&2; exit 2 ;;
  esac
done

theme="$(basename "$PWD")"
master="${theme}_MASTER.wav"

# Format: "start end name"  — name must start with the locked asset token.
# Spec bounds (MUSIC-AUTHORING.md):
#   MT01 preview-intro   3–6s      MT03 ambient-loop    60–240s
#   MT02 match-start     6–20s     MT04 main-theme      45–120s
#   ES01 scheme-twist    1–3s      ES03 villain-ambush  0.75–2s
#   ES02 master-strike   1–3s      ES04 bystander       0.75–1.5s
crops=(
  # PLACEHOLDER TIMESTAMPS — replace after listening to your master.
  "0.0   5.5   MT01_preview-intro"
  "12.3  28.0  MT02_match-start"
  "45.0  180.0 MT03_ambient-loop"
  "0.0   90.0  MT04_main-theme"
  "8.2   10.5  ES01_scheme-twist"
  "22.1  24.0  ES02_master-strike"
  "35.8  37.2  ES03_villain-ambush"
  "48.5  49.8  ES04_bystander"
)

if [[ ! -f "$master" ]]; then
  echo "Error: master WAV not found at $PWD/$master" >&2
  echo "Run this script from a theme's pCloud audio folder (e.g. C:/pcloud/LA/audio/age-of-apocalypse/)." >&2
  exit 1
fi

for cmd in ffmpeg ffprobe; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Error: $cmd not found on PATH. Install ffmpeg and retry (ffprobe ships with ffmpeg)." >&2
    exit 1
  fi
done

spec_bounds() {
  case "$1" in
    MT01) echo "3 6"       ;;
    MT02) echo "6 20"      ;;
    MT03) echo "60 240"    ;;
    MT04) echo "45 120"    ;;
    ES01) echo "1 3"       ;;
    ES02) echo "1 3"       ;;
    ES03) echo "0.75 2"    ;;
    ES04) echo "0.75 1.5"  ;;
    *)    echo "0 99999"   ;;
  esac
}

for crop in "${crops[@]}"; do
  read -r start end name <<< "$crop"
  output="${theme}_${name}.wav"
  token="${name%%_*}"
  echo "Cropping [$start → $end] → $output"
  ffmpeg -y -hide_banner -loglevel error -i "$master" -ss "$start" -to "$end" -c copy "$output"
  duration="$(ffprobe -v error -show_entries format=duration \
    -of default=noprint_wrappers=1:nokey=1 "$output")"
  read -r minv maxv <<< "$(spec_bounds "$token")"
  awk -v d="$duration" -v min="$minv" -v max="$maxv" -v tok="$token" -v out="$output" 'BEGIN {
    if (d+0 < min+0)      printf "  WARNING: %s %.2fs BELOW %ss min\n", out, d, min
    else if (d+0 > max+0) printf "  WARNING: %s %.2fs ABOVE %ss max\n", out, d, max
    else                  printf "  OK: %s (%.2fs, spec %s–%ss)\n", out, d, min, max
  }'

  if [[ "$skip_mp3" != "1" ]]; then
    mp3="${output%.wav}.mp3"
    # why: MUSIC-AUTHORING.md locks loudnorm I=-13 LRA=11 TP=-1 @ 320 kbps MP3 for R2 distribution.
    if ffmpeg -y -hide_banner -loglevel error -i "$output" -af 'loudnorm=I=-13:LRA=11:TP=-1' -b:a 320k "$mp3"; then
      echo "  Encoded: $mp3 (320 kbps, loudnorm -13 LUFS)"
    else
      echo "  WARNING: MP3 encode failed for $mp3" >&2
    fi
  fi
done

echo
if [[ "$skip_mp3" == "1" ]]; then
  echo "Done. 8 WAV derivatives written to $PWD/."
  echo "Next: re-run without --skip-mp3, or encode MP3s per MUSIC-AUTHORING.md §Pro Tips."
else
  echo "Done. 8 WAV masters + 8 MP3 derivatives written to $PWD/."
  echo "Next: upload MP3s to R2 and paste URLs into content/themes/${theme}.json -> musicAssets.*Url."
fi
