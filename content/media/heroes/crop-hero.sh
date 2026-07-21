#!/usr/bin/env bash
# crop-hero.sh — TEMPLATE. Copy into a hero's folder (rename to crop.sh),
# edit timestamps, and commit alongside the audio as provenance of how
# the derivative WAVs were produced from hero-<slug>_MASTER.wav.
#
# why: per MUSIC-AUTHORING.md golden rule — one prompt, four hero
# derivatives from a single master. Committing the filled-in copy makes
# the crop points reproducible months later without re-listening.
#
# Sibling: crop-one.sh (single-crop interactive, good for timestamp
# discovery and MT03 loop experiments via --loop N).
#
# Usage — hero audio lives on pCloud (C:/pcloud/LA/audio/heroes/<slug>/,
# see Workspace Map); this template stays tracked in the repo.
#   1. Copy this template into the hero's pCloud folder as crop.sh:
#        cd /c/pcloud/LA/audio/heroes/black-widow/
#        cp "$REPO/content/media/heroes/crop-hero.sh" crop.sh   # $REPO = your checkout
#   2. Edit the `crops` array below with timestamps from listening to the master.
#   3. Run:
#        bash ./crop.sh
#   4. Commit crop.sh + the produced WAVs.
#
# Values below are PLACEHOLDERS.

set -euo pipefail

# --skip-mp3: produce only WAVs (faster during iteration). Default produces both.
skip_mp3=0
for arg in "$@"; do
  case "$arg" in
    --skip-mp3) skip_mp3=1 ;;
    *) echo "Unknown flag: $arg (supported: --skip-mp3)" >&2; exit 2 ;;
  esac
done

slug="$(basename "$PWD")"
master="hero-${slug}_MASTER.wav"

# Format: "start end name"  — name must start with the locked asset token.
# Spec bounds (MUSIC-AUTHORING.md):
#   MT01 preview-intro   3–6s
#   MT02 match-start     6–20s
#   MT03 ambient-loop    60–240s
#   MT04 main-theme      45–120s
crops=(
  # PLACEHOLDER TIMESTAMPS — replace after listening to your master.
  "0.0   5.0   MT01_preview-intro"
  "8.0   20.0  MT02_match-start"
  "30.0  150.0 MT03_ambient-loop"
  "0.0   60.0  MT04_main-theme"
)

if [[ ! -f "$master" ]]; then
  echo "Error: master WAV not found at $PWD/$master" >&2
  echo "Run this script from a hero's pCloud audio folder (e.g. C:/pcloud/LA/audio/heroes/black-widow/)." >&2
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
    MT01) echo "3 6"    ;;
    MT02) echo "6 20"   ;;
    MT03) echo "60 240" ;;
    MT04) echo "45 120" ;;
    *)    echo "0 99999" ;;
  esac
}

for crop in "${crops[@]}"; do
  read -r start end name <<< "$crop"
  output="hero-${slug}_${name}.wav"
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
  echo "Done. 4 WAV derivatives written to $PWD/."
  echo "Next: re-run without --skip-mp3, or encode MP3s per MUSIC-AUTHORING.md §Pro Tips."
else
  echo "Done. 4 WAV masters + 4 MP3 derivatives written to $PWD/."
  echo "Next: upload MP3s to R2 (music.barefootbetters.com/heroes/) and paste URLs into content/themes/heroes/${slug}.json -> musicAssets.*Url."
fi
