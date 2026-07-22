# Motif Generator — Entity Leitmotifs

Deterministic generator for the **motif matrix** (per-entity three-note
leitmotifs) described in
[Music Authoring](https://ewiki.legendary-arena.com/music-authoring/#motif-matrix).
Unlike the Suno theme pipeline (`../MUSIC-AUTHORING.md`), motifs are **not**
cropped from a human-selected master — they are generated from data, so this
one script (plus a fixed renderer) is the complete provenance: running it
regenerates every output byte.

## What it produces

For each requested `(team × class)` pair, three sibling files:

| File | Role |
|---|---|
| `<team-slug>_<class>.mid` | Portable score — **the master**. Re-render at any fidelity later; the notes never change. |
| `<team-slug>_<class>.wav` | Rendered audio, trimmed. |
| `<team-slug>_<class>.mp3` | 320 kbps distribution encode, loudnorm `I=-13` (matches theme-sting loudness). |

Example: `x-men_strength.mp3` — the X-Men (D major) motif on brass.

## Two renderers (MIDI → audio)

The `.mid` is the invariant; only the timbre differs, so any batch can be
re-rendered at higher fidelity without touching the notes.

- **MuseScore (default).** MuseScore 4's headless CLI renders the MIDI through
  its bundled **MS Basic** sampled instruments — real orchestral timbres. The
  whole batch renders in a single MuseScore boot (`-j` job file), then ffmpeg
  trims MuseScore's reverb/measure tail and encodes the MP3. Install MuseScore
  4 (`winget install -e --id Musescore.Musescore`); the script auto-detects the
  standard install path, or pass `--musescore <path>` / set `MUSESCORE_BIN`.
- **Synth (`--synth` fallback).** A dependency-free Node oscillator bank — one
  voice per class. Recognizable and distinct, but not sampled. Used
  automatically when MuseScore is not found, or forced with `--synth` for a
  build environment with no external tools.

## The grammar it encodes

Read from `C:\pcloud\LA\audio\audio-motif-map.json` (the authoritative map):

- **team → key.** The phrase is written on the team's root note.
- **class → instrument + register.** Each class maps to a General MIDI patch
  (written into the `.mid`, so MuseScore and any sampler pick the right voice)
  and a register shift so a family's instruments stack without mud (Instinct
  low, Ranged high).
- **side → mode + direction.** Hero = major arpeggio **rising** (root–3rd–5th);
  villain / grey = minor arpeggio **falling** (5th–♭3rd–root). The two are exact
  inversions — the audible third carries major vs. minor.
- **power → interval size.** This generator uses the **standard-card default**
  (the root–third–fifth arpeggio). Wider power intervals (a Master Strike's
  octave leap) are a **play-time modifier**, not baked into the stored file.

Neutral **Unaffiliated** has no home key, so it gets no motif (skipped).

## Running it

```bash
# MVP set (default): X-family + Avengers-family × 5 classes = 35 motifs, MuseScore
node generate-motifs.mjs

# Full grid: all 25 keyed teams × 5 classes = 125 motifs
node generate-motifs.mjs --all

# Force the dependency-free synth (no MuseScore needed)
node generate-motifs.mjs --synth

# Overrides
node generate-motifs.mjs --musescore "C:\Program Files\MuseScore 4\bin\MuseScore4.exe"
node generate-motifs.mjs --map <path-to-audio-motif-map.json> --out <dir>
```

Requires `ffmpeg` on PATH. MuseScore 4 for the default renderer (otherwise it
falls back to synth). Node only, no npm deps.

## Storage (per D-24219)

- **This script + this README** are the only tracked artifacts (git,
  `content/media/motifs/`). They are complete provenance. The `.mjs` is
  force-added because `content/media/**` is otherwise gitignored.
- **All `.mid` / `.wav` / `.mp3` outputs** are working audio — they live on
  pCloud (`C:\pcloud\LA\audio\motifs\`), never committed, never in the repo
  tree.
- **Delivery:** the published MP3s (or, more likely, a packed **SFX sprite**
  assembled from them) go to R2 under an `audio/motifs/` prefix on the
  `legendary-images` bucket — the sole audio delivery surface. Motifs are tiny,
  so the client keeps them in the sprite alongside the discrete SFX rather than
  fetching each one.

## Upgrading fidelity further

MuseScore's MS Basic soundfont is solid GM, but not a premium orchestral
library. To go further without changing the grammar: render the committed
`.mid` files through a higher-quality sampled set (MuseScore's MuseSounds, or a
DAW with a commercial library — one patch per class), then re-encode with the
same `silenceremove … loudnorm=I=-13:LRA=11:TP=-1 -b:a 320k` settings. The
`.mid` note data is the invariant; only the timbre improves.
