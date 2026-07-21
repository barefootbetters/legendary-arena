# Suno Music Authoring Guide – Theme Exports (Suno Pro)

**Audience:** Legendary Arena theme authors using Suno Pro
**Goal:** Produce all purpose-built, engine-safe audio assets per theme with consistent musical identity and zero surprises.

---

## Purpose
Standardize creation of **all** audio assets per theme for Legendary Arena and Registry Viewer using a repeatable, low-risk pipeline.

### Assets per Theme

**Music Tracks**
- `previewIntro` — 3–6 seconds
- `matchStart` — 6–20 seconds
- `ambientLoop` — minimum 60 seconds; target 90–240 seconds
- `mainTheme` — 45–120 seconds

**Event Stings (Short-Form)**
- `schemeTwist` — 1–3 seconds
- `masterStrike` — 1–3 seconds
- `villainAmbush` — 0.75–2 seconds
- `bystander` — 0.75–1.5 seconds

---

## Core Rules (All Assets)
- **Authoring format (local master):** WAV (44.1 kHz or 48 kHz, 16–24 bit) — the source-of-truth file, kept locally and never uploaded
- **Distribution format (R2):** MP3 (320 kbps) — encoded from the WAV master, uploaded to Cloudflare R2, and referenced from theme JSON `musicAssets.*Url` fields
- No silence at start or end; no fade-in/out (unless the game engine adds crossfades)
- Purely instrumental (no vocals)
- Consistent musical DNA: same key, tempo family, orchestration, and tone across **every** asset
- Loudness target (post-export): –14 to –12 LUFS integrated
- Prefer **Editor (Pro)** for all derivative work; avoid Studio unless composing entirely new music

**Important:** Loudness normalization is a post-export step (use a DAW or batch tool). Do not rely on Suno to hit exact LUFS.

---

## Two Supported Pipelines
**A) Non-Generative (Maximum Fidelity)** — Recommended for short cues & stings
- Uses **Crop** only
- No prompts, no regeneration
- Guarantees exact audio preservation
- **Best for:** `previewIntro`, `matchStart`, and **all Event Stings**

**B) Lightly Generative (Controlled)** — Recommended for long ambience
- Uses **Extend** → then **Crop** from a stable mid-section
- **Best for:** `ambientLoop` (and occasionally `mainTheme`)

---

## Recommended Workflow (Best Practice)

### Step 0 — Protect the Original (Mandatory)
Duplicate the song **before any edits**.
Use Workspace Duplicate or Download → Upload.
Name it: `<theme-id>_MASTER`

### Step 1 — Create the mainTheme (Seed)
1. Go to **Create** → **Custom** tab.
2. Paste the exact `musicAIPrompt` from your theme's JSON.
3. Set **Instrumental: ON**.
4. Set length to 45–60 seconds.
5. Generate and select the best take.

All 8 assets must originate from this single seed (the golden rule — see Step 2).

### Step 2 — Derive the Remaining 7 Assets

**Golden rule: one prompt, eight derivatives.** Never generate separate Suno
takes for individual cues — that breaks the consistent-musical-DNA rule
(Core Rules, above) and produces eight mismatched identities. All seven
non-main assets are cropped or extended from the single `_MASTER` seed.

**Optimized order — start the longest operation first, then run the rest in parallel:**

1. **Kick off the ambient-loop Extend first** (longest op; runs in the background).
   - Open **Editor (Pro)** on `_MASTER`.
   - Identify a quiet mid-track texture section.
   - Click **Extend** and append:
     `extend with steady ambient texture, no vocals, smooth continuation`
   - Target 120–300 s output. Leave it running.

2. **While the Extend runs, perform all 7 Crops from `_MASTER`.**
   - Each Crop in Suno creates a new song automatically — no per-asset
     duplicate required. `_MASTER` stays intact.
   - Suggested Crop order:
     - `MT01_preview-intro` (3–6 s — iconic downbeat fragment)
     - `MT02_match-start` (6–20 s — highest-energy reveal)
     - `MT04_main-theme` (45–120 s — seed as-is, or lightly trim)
     - `ES01_scheme-twist` (1–3 s — orchestral stab or swell)
     - `ES02_master-strike` (1–3 s — strongest percussion hit)
     - `ES03_villain-ambush` (0.75–2 s — sharp attack transient)
     - `ES04_bystander` (0.75–1.5 s — soft incidental flourish)

3. **Return to the ambient-loop Extend.** Crop on bar boundaries; loop-test
   10+ times; name it `MT03_ambient-loop`.

4. **Export all 8 as WAV** (local masters; see File Naming below).

5. **Batch post-process in one pass** (DAW macro or `ffmpeg` — see Pro Tips):
   - Normalize each WAV to –14 to –12 LUFS.
   - Encode to 320 kbps MP3.
   - Output filenames match the R2-hosted pattern (`<theme-id>_<prefix>_<name>.mp3`).

**Quick reference:**

| Output MP3                           | Duration          | Method                  | Action on `_MASTER`                |
|--------------------------------------|-------------------|-------------------------|------------------------------------|
| `<theme-id>_MT04_main-theme.mp3`     | 45–120 s          | Seed-first / light Crop | Use seed as-is or lightly trim     |
| `<theme-id>_MT01_preview-intro.mp3`  | 3–6 s             | Crop                    | Iconic downbeat fragment           |
| `<theme-id>_MT02_match-start.mp3`    | 6–20 s            | Crop                    | Highest-energy reveal              |
| `<theme-id>_MT03_ambient-loop.mp3`   | 90–240 s (min 60) | Extend → Crop           | Mid-texture + Extend (start first) |
| `<theme-id>_ES01_scheme-twist.mp3`   | 1–3 s             | Crop                    | Orchestral stab / swell            |
| `<theme-id>_ES02_master-strike.mp3`  | 1–3 s             | Crop                    | Strongest percussion hit           |
| `<theme-id>_ES03_villain-ambush.mp3` | 0.75–2 s          | Crop                    | Sharp attack transient             |
| `<theme-id>_ES04_bystander.mp3`      | 0.75–1.5 s        | Crop                    | Soft incidental flourish           |

**Time savings:** Editor opens only twice (once for Extend, once for all
Crops) instead of eight separate sessions. Per-asset detail follows below.

---

## Track Types & Correct Methods

### Music Tracks

#### 1. `previewIntro` (3–6 seconds)
**Method:** Non-Generative (Crop only)
**Steps:** Duplicate seed → Editor → Crop a punchy iconic fragment (on a downbeat) → Export.

#### 2. `matchStart` (6–20 seconds)
**Method:** Non-Generative (Crop preferred)
**Steps:** Duplicate → Editor → Crop high-energy reveal section.

#### 3. `ambientLoop` (minimum 60 s; target 90–240 s)
**Method:** Lightly Generative (Extend → Crop)
**Steps:** Duplicate → Editor → Identify mid-track texture section → **Extend** with `extend with steady ambient texture, no vocals, smooth continuation` → Crop on bar boundaries → Loop-test 10+ times.

#### 4. `mainTheme` (45–120 seconds)
**Method:** Seed-first; Extend only if necessary
Export initial 45–60 s as-is or lightly Extend then Crop to polished structure.

### Event Stings (Short-Form)

**Method for all stings:** Non-Generative (Crop only) — maximum fidelity required.

**Steps (same for every sting):**
1. Duplicate the `_MASTER` seed → name it `<theme-id>_<sting-name>_WORKING`
2. Open in **Editor (Pro)** → **Crop**
3. Select the shortest, most impactful fragment (start on a strong downbeat or transient)
4. Export as WAV (local master), then encode to MP3 320 kbps for R2 upload

#### Specific Stings
- **`schemeTwist`** (1–3 s) — Sudden plot twist or scheme reveal
- **`masterStrike`** (1–3 s) — Decisive master-level attack or power moment
- **`villainAmbush`** (0.75–2 s) — Villain surprise/ambush hit
- **`bystander`** (0.75–1.5 s) — Innocent bystander reaction or incidental sting

**Tip:** Because these are extremely short, always choose the most musically dense 0.75–2 seconds from the seed.

---

## File Naming (Exact)

Filenames use two prefix families for grouping and alphabetical sort:
- **`MT01`–`MT04`** — **M**usic **T**rack (preview, match, ambient, main)
- **`ES01`–`ES04`** — **E**vent **S**ting (twist, strike, ambush, bystander)

The numeric prefix is followed by the semantic slug so filenames stay
self-documenting — reading `MT03_ambient-loop` tells you both the sort
position and the role. Both WAV masters and R2-hosted MP3s share identical
base names; only the extension differs.

**Locked prefix-to-asset mapping:**

| Prefix | Asset          | | Prefix | Asset           |
|--------|----------------|---|--------|-----------------|
| MT01   | preview-intro  | | ES01   | scheme-twist    |
| MT02   | match-start    | | ES02   | master-strike   |
| MT03   | ambient-loop   | | ES03   | villain-ambush  |
| MT04   | main-theme     | | ES04   | bystander       |

**Local WAV masters** (kept on disk, not uploaded):
```
<theme-id>_MT01_preview-intro.wav
<theme-id>_MT02_match-start.wav
<theme-id>_MT03_ambient-loop.wav
<theme-id>_MT04_main-theme.wav

<theme-id>_ES01_scheme-twist.wav
<theme-id>_ES02_master-strike.wav
<theme-id>_ES03_villain-ambush.wav
<theme-id>_ES04_bystander.wav
```

**R2-hosted MP3s** (uploaded; URLs referenced from theme JSON):
```
<theme-id>_MT01_preview-intro.mp3
<theme-id>_MT02_match-start.mp3
<theme-id>_MT03_ambient-loop.mp3
<theme-id>_MT04_main-theme.mp3

<theme-id>_ES01_scheme-twist.mp3
<theme-id>_ES02_master-strike.mp3
<theme-id>_ES03_villain-ambush.mp3
<theme-id>_ES04_bystander.mp3
```

**Example:** local master `age-of-apocalypse_ES03_villain-ambush.wav` → R2-hosted `age-of-apocalypse_ES03_villain-ambush.mp3`.

---

## Repository Layout & Tooling

Audio spans **two surfaces** (see the wiki [Workspace Map] and
[Data & File Locations] for the surface rules):

- **Tooling + research — git (`content/media/`).** The crop-script
  templates, this guide, per-hero research `.md`, `HERO-INDEX.json`, and
  each hero's committed `crop.ps1` provenance copy are version-controlled
  text. **No audio lives here.**
- **Working audio — pCloud (`C:\pcloud\LA\audio\`).** The WAV masters,
  their local MP3 derivatives, and cover images live here, in per-theme /
  per-hero subfolders that mirror the tooling layout by name. These are
  working binaries: never committed, never in the repo tree. Only the
  published 320 kbps MP3s go to R2 (the sole audio delivery surface);
  masters are never uploaded.

```
content/media/  (git — tooling + research, no audio)
├── MUSIC-AUTHORING.md
├── crop-theme.sh / crop-theme.ps1           ← scenario template (8 crops)
└── heroes/
    ├── HERO-INDEX.json
    ├── _TEMPLATE.md
    ├── crop-hero.sh / crop-hero.ps1         ← hero template (4 crops)
    ├── crop-one.sh  / crop-one.ps1          ← single-crop interactive (MT03 loop experiments)
    └── black-widow/
        ├── black-widow.md
        └── crop.ps1                          ← committed provenance (the actual crop points)

C:\pcloud\LA\audio\  (pCloud — working binaries, gitignored/never in repo)
├── age-of-apocalypse/
│   ├── age-of-apocalypse_MASTER.wav          ← Suno master (never uploaded)
│   ├── age-of-apocalypse_MT01_preview-intro.{wav,mp3}   … (8 derivatives)
│   └── suno-...jpg                           ← cover image
└── heroes/
    └── black-widow/
        └── hero-black-widow_MASTER.wav       ← + 4 MT derivatives
```

All three crop scripts ship as matched **bash (`.sh`) and PowerShell (`.ps1`) pairs** with identical behavior — pick whichever fits your shell. Both variants require `ffmpeg` + `ffprobe` on PATH. They are **CWD-relative**: run them from the theme's / hero's pCloud audio folder and they read `<name>_MASTER.wav` from there and write derivatives beside it. `$Repo` below is your `legendary-arena` checkout.

**Crop scripts:**

- `crop-theme` — scenario 8-asset batch template. Run against a theme's pCloud folder `C:\pcloud\LA\audio\<scenario>\` (or copy the script in as `crop.ps1` first to record provenance), edit the crops array with listened timestamps, run.
- `crop-hero` — hero 4-asset batch template (MT01–MT04 only; event stings `ES01`–`ES04` are match-level, not character-level). Copy into `C:\pcloud\LA\audio\heroes\<hero-slug>\` as `crop.sh` / `crop.ps1`, edit timestamps, run; commit the filled-in copy back to `content/media/heroes/<hero-slug>/` as provenance.
- `crop-one` — hero single-crop interactive sibling. Useful for timestamp discovery and MT03 ambient-loop experiments via the loop flag. Invoked from a hero folder with `<asset> <start> <end>` and an optional loop count.

**Invocation (`cd` into the pCloud audio folder first, then):**

| Task | bash | PowerShell |
|---|---|---|
| Scenario batch | `bash "$Repo/content/media/crop-theme.sh"` | `pwsh $Repo\content\media\crop-theme.ps1` |
| Hero batch (after copy to `crop.sh` / `crop.ps1`) | `bash ./crop.sh` | `pwsh .\crop.ps1` |
| Hero single crop | `bash "$Repo/content/media/heroes/crop-one.sh" MT01 0:02 0:07` | `pwsh $Repo\content\media\heroes\crop-one.ps1 MT01 0:02 0:07` |
| Hero single + loop (MT03) | `bash "$Repo/content/media/heroes/crop-one.sh" MT03 30 60 --loop 4` | `pwsh $Repo\content\media\heroes\crop-one.ps1 MT03 30 60 -Loop 4` |

All crops use `-c copy` — sample-accurate lossless PCM, no re-encoding. MP3 encoding + loudness normalization happens in a separate batch pass (see Pro Tips below).

[Workspace Map]: https://ewiki.legendary-arena.com/workspace-map/
[Data & File Locations]: https://ewiki.legendary-arena.com/data-file-locations/

Install ffmpeg on Windows with `winget install -e --id Gyan.FFmpeg`, then restart the terminal so PATH picks it up. If PowerShell execution policy blocks a `.ps1`, invoke with `pwsh -ExecutionPolicy Bypass -File <script>.ps1`.

---

## Theme JSON Structure

Music fields live on `themeSchemaVersion: 2` (see D-5509). The three top-level
music fields — `musicTheme`, `musicAIPrompt`, and `musicAssets` — are **all
optional**. A theme without them is valid; themes populate them as audio is
produced. Within `musicAssets`, every URL field is **individually optional**
too, so partial coverage is fine while a theme is in progress.

Field casing follows the existing themes-schema convention (`comicImageUrl`,
`externalUrl`, `externalIndexUrls`): **`Url`** with a lowercase `rl`, never
`URL`.

```json
{
  "themeSchemaVersion": 2,
  "themeId": "age-of-apocalypse",
  "name": "Age of Apocalypse",
  "description": "In a world where Charles Xavier was murdered before founding the X-Men, Apocalypse rose to conquer North America. Magneto leads a ragged band of mutant survivors against the ancient tyrant's Four Horsemen.",
  "setupIntent": {
    "mastermindId": "apocalypse",
    "schemeId": "nuclear-armageddon",
    "villainGroupIds": ["four-horsemen", "marauders"],
    "henchmanGroupIds": ["phalanx"],
    "heroDeckIds": ["bishop", "jean-grey", "nightcrawler", "wolverine", "storm", "gambit"]
  },
  "playerCount": {
    "recommended": [3, 4],
    "min": 2,
    "max": 6
  },
  "tags": ["x-men", "alternate-reality", "apocalypse", "1990s"],
  "references": {
    "primaryStory": {
      "issue": "X-Men Alpha #1 + tie-ins",
      "year": 1995,
      "externalUrl": "https://marvel.fandom.com/wiki/Age_of_Apocalypse",
      "externalIndexUrls": [
        "https://comicvine.gamespot.com/age-of-apocalypse/4045-40752/"
      ]
    }
  },
  "flavorText": "In the Age of Apocalypse, only the strong survive.",
  "comicImageUrl": "https://comicvine.gamespot.com/a/uploads/original/11125/111254576/5632591-x-men_alpha_vol_1_1.jpg",

  "musicTheme": "Epic Battle / Confrontation",
  "musicAIPrompt": "Create a 45-second seamless loopable orchestral film score in the exact style of John Williams. Epic Battle / Confrontation. Dystopian mutant resistance against Apocalypse's Four Horsemen in a conquered North America. Sweeping heroic strings, thunderous brass fanfares, low ominous strings, pounding timpani and choral Latin chanting. Dark yet hopeful major-to-minor shifts. High cinematic energy, wide stereo, instrumental only, perfectly loopable with no fade in/out.",

  "musicAssets": {
    "previewIntroUrl": "https://music.barefootbetters.com/themes/age-of-apocalypse_MT01_preview-intro.mp3",
    "matchStartUrl":   "https://music.barefootbetters.com/themes/age-of-apocalypse_MT02_match-start.mp3",
    "ambientLoopUrl":  "https://music.barefootbetters.com/themes/age-of-apocalypse_MT03_ambient-loop.mp3",
    "mainThemeUrl":    "https://music.barefootbetters.com/themes/age-of-apocalypse_MT04_main-theme.mp3",
    "schemeTwistUrl":   "https://music.barefootbetters.com/themes/age-of-apocalypse_ES01_scheme-twist.mp3",
    "masterStrikeUrl":  "https://music.barefootbetters.com/themes/age-of-apocalypse_ES02_master-strike.mp3",
    "villainAmbushUrl": "https://music.barefootbetters.com/themes/age-of-apocalypse_ES03_villain-ambush.mp3",
    "bystanderUrl":     "https://music.barefootbetters.com/themes/age-of-apocalypse_ES04_bystander.mp3"
  }
}
```

**How to use the music fields:**
- Copy the exact value of `"musicAIPrompt"` into Suno Custom mode to generate your seed.
- After exporting each file, upload it and fill in the corresponding URL in `"musicAssets"`.
- Partial `musicAssets` is valid — ship one track at a time as audio is produced; the engine must tolerate missing URLs.

---

## Quality Checklist (Before Upload)
- [ ] All 8 audio assets (4 tracks + 4 stings) exist and share identical musical DNA
- [ ] `ambientLoop` repeats seamlessly (no clicks/jumps)
- [ ] No silence or fades at start/end of any file
- [ ] All durations are within spec
- [ ] Loudness normalized to –14 to –12 LUFS (post-export)
- [ ] Filenames match the exact pattern above
- [ ] Theme JSON `musicAssets` URLs are filled in for every uploaded file (partial coverage is allowed)

---

## Pro Tips
- **Seed quality first:** Listen to the full `_MASTER` before any Extend or Crop. If the motif or energy is weak, regenerate the seed — every derivative inherits its DNA, so a weak seed wastes the entire downstream pipeline.
- Always work in **Editor (Pro)** for derivatives.
- **Crop** = maximum fidelity (never use prompts on stings).
- **Extend → Crop** only when you need length.
- Never use Remix, Mashup, or "Use as Inspiration" — they break continuity.
- Duplicate `_MASTER` once at Step 0 and pin it in your Suno workspace. Each subsequent **Crop** creates its own new song, so you don't need per-asset duplicates.
- **MP3 encoding is inline.** As of the current crop scripts, loudnorm + 320 kbps MP3 encoding happens automatically after each successful WAV crop using the locked settings: `loudnorm=I=-13:LRA=11:TP=-1 -b:a 320k`. Both scopes are covered:
  - Scenario batch (`crop-theme.sh` / `.ps1`) — produces 8 WAV + 8 MP3 per run.
  - Hero batch (`crop-hero.sh` / `.ps1`) — produces 4 WAV + 4 MP3 per run.
  - Hero single-crop (`crop-one.sh` / `.ps1`) — produces 1 WAV + 1 MP3 per run.

  Opt-out via `--skip-mp3` (bash) or `-SkipMp3` (PowerShell) during iteration to skip the encode and keep only WAVs.

- **Retro batch-encode recipe** (retrofit old themes where only WAVs exist, or re-encode all MP3s after a settings change). Run from the folder holding the `.wav` files:
  ```bash
  for f in *.wav; do
    [[ "$f" == *_MASTER.wav ]] && continue   # skip the master seed
    ffmpeg -y -i "$f" -af loudnorm=I=-13:LRA=11:TP=-1 -b:a 320k "${f%.wav}.mp3"
  done
  ```

  The `_MASTER.wav` guard prevents accidentally encoding the seed as a distribution asset.
