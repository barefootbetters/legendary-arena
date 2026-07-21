#!/usr/bin/env bash
# crop-one.sh — Crop ONE named derivative asset from a Suno _MASTER WAV.
# Interactive / single-crop sibling of crop-hero.sh (which batches all 4).
# Use this for timestamp discovery and MT03 loop experiments (--loop N).
#
# why: MUSIC-AUTHORING.md §Step 2 lists 4 crops per hero theme. This
# automates one-at-a-time crops outside Suno.com using ffmpeg with
# -c copy (lossless PCM; no re-encoding, sample-accurate).
#
# Usage — run from a hero's pCloud audio folder (e.g.
# C:/pcloud/LA/audio/heroes/black-widow/, see Workspace Map), pointing at
# this repo-tracked script:
#   bash "$REPO/content/media/heroes/crop-one.sh" <asset> <start> <end> [--loop N]
#   ( $REPO = your legendary-arena checkout )
#
# Asset tokens map to locked filenames and duration spec:
#   MT01 → preview-intro   (spec: 3–6s)
#   MT02 → match-start     (spec: 6–20s)
#   MT03 → ambient-loop    (spec: 60–240s; use --loop to stitch if crop is too short)
#   MT04 → main-theme      (spec: 45–120s)
#
# Time format: HH:MM:SS, MM:SS, SS.mmm, or plain seconds.
#
# --loop N:    concatenate the cropped result N times (total playbacks).
#              Useful for MT03 when a 30s beat-aligned loop needs to reach
#              the 60s+ target. Note: loop seams may be audible unless the
#              crop starts/ends on matching bar boundaries.
# --skip-mp3:  skip the R2-bound MP3 encode (loudnorm + 320 kbps). Default
#              produces both WAV and MP3 — use this flag for fast iteration.
#
# Examples:
#   ./crop-one.sh MT01 0:02 0:07                # 5s preview-intro + MP3
#   ./crop-one.sh MT04 0:15 1:15                # 60s main-theme + MP3
#   ./crop-one.sh MT03 30 210                   # 180s ambient-loop + MP3
#   ./crop-one.sh MT03 30 60 --loop 4           # crop 30s, loop 4× → 120s ambient + MP3
#   ./crop-one.sh MT01 0:02 0:07 --skip-mp3     # WAV only (fast iteration)

set -euo pipefail

loop_count=1
skip_mp3=0
positional=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --loop)
      loop_count="${2:-}"
      if ! [[ "$loop_count" =~ ^[0-9]+$ ]] || [[ "$loop_count" -lt 1 ]]; then
        echo "Error: --loop requires a positive integer (>=1)." >&2
        exit 2
      fi
      shift 2
      ;;
    --skip-mp3)
      skip_mp3=1
      shift
      ;;
    -h|--help)
      grep -E '^# ' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      positional+=("$1")
      shift
      ;;
  esac
done
set -- "${positional[@]:-}"

asset="${1:-}"
start="${2:-}"
end="${3:-}"

if [[ -z "$asset" || -z "$start" || -z "$end" ]]; then
  cat >&2 <<USAGE
Usage: $(basename "$0") <asset> <start> <end> [--loop N] [--skip-mp3]
  asset:      MT01 | MT02 | MT03 | MT04
  start:      HH:MM:SS, MM:SS, or seconds
  end:        same format as start
  --loop N:   optional — repeat the crop N times total (MT03 helper)
  --skip-mp3: optional — produce WAV only (skip the R2-bound MP3 encode)
Examples:
  $(basename "$0") MT01 0:02 0:07          # 5s preview-intro (WAV + MP3)
  $(basename "$0") MT04 0:15 1:15          # 60s main-theme (WAV + MP3)
  $(basename "$0") MT03 30 60 --loop 4     # 30s × 4 → 120s ambient (WAV + MP3)
  $(basename "$0") MT01 0:02 0:07 --skip-mp3   # WAV only
USAGE
  exit 2
fi

case "$asset" in
  MT01) name="preview-intro"; min=3;  max=6   ;;
  MT02) name="match-start";   min=6;  max=20  ;;
  MT03) name="ambient-loop";  min=60; max=240 ;;
  MT04) name="main-theme";    min=45; max=120 ;;
  *)
    echo "Error: unknown asset '$asset'. Must be MT01, MT02, MT03, or MT04." >&2
    exit 2
    ;;
esac

slug="$(basename "$PWD")"
master="hero-${slug}_MASTER.wav"
output="hero-${slug}_${asset}_${name}.wav"

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

echo "Cropping $master [$start → $end] → $output"
ffmpeg -y -hide_banner -loglevel error -i "$master" -ss "$start" -to "$end" -c copy "$output"

if [[ "$loop_count" -gt 1 ]]; then
  tmp="${output%.wav}_unlooped.wav"
  mv "$output" "$tmp"
  # -stream_loop N: plays input 1 + N times. For total playbacks = loop_count, pass loop_count - 1.
  ffmpeg -y -hide_banner -loglevel error \
    -stream_loop $((loop_count - 1)) -i "$tmp" -c copy "$output"
  rm "$tmp"
  echo "  Looped ${loop_count}× (watch for audible seams at bar-misaligned loop points)"
fi

duration="$(ffprobe -v error -show_entries format=duration \
  -of default=noprint_wrappers=1:nokey=1 "$output")"

printf 'Done. Output: %s (%.2fs)\n' "$output" "$duration"

awk -v d="$duration" -v min="$min" -v max="$max" -v asset="$asset" 'BEGIN {
  if (d+0 < min+0)      printf "  WARNING: %.2fs is BELOW the %ds minimum for %s\n", d, min, asset
  else if (d+0 > max+0) printf "  WARNING: %.2fs is ABOVE the %ds maximum for %s\n", d, max, asset
  else                  printf "  OK: duration %.2fs is within spec (%d–%ds)\n", d, min, max
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
