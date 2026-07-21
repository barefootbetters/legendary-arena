---
title: Music Authoring
type: Guide
tags:
  - audio
  - music
  - motif
  - themes
  - suno
  - r2
  - designer-reference
related:
  - sound-effects.md
  - data-file-locations.md
  - ewiki-authoring.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\music-authoring.md (this page — https://ewiki.legendary-arena.com/music-authoring/)
  - ../content/themes/age-of-apocalypse.json
  - ../content/themes/CATALOG.md
  - ../content/themes/THEME-INDEX.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-07-21
---

# Music Authoring

## Summary

Music Authoring is the repeatable pipeline for producing per-theme and
per-hero background music and event stings for Legendary Arena. One Suno
seed per theme yields **eight derivatives** — four music tracks
(`MT01`–`MT04`) and four event stings (`ES01`–`ES04`) — cropped from a
single master so every asset shares one musical identity. WAV masters
stay local on pCloud; 320 kbps MP3s are the distribution format, and
**R2 is their sole delivery surface**, referenced from
`themeSchemaVersion: 2` theme JSON. No audio is committed to git. This
page is `draft`: the runtime contract (theme JSON music fields) is
settled and tracked, but production is in progress and the working audio
lives on pCloud, not in the repo (see Edge Cases). Beyond those
scenario-level assets, this page also specs the **motif matrix** (below) —
a per-entity leitmotif grammar that gives every hero, mastermind, and
scheme its own short signature phrase, keyed to class, team, and alignment.

## Mechanics

### The asset set (per theme)

Two prefix families group the eight assets so filenames sort and
self-document: **`MT`** = Music Track, **`ES`** = Event Sting.

| Prefix | Asset | Duration | Role |
|---|---|---|---|
| `MT01` | preview-intro | 3–6 s | Iconic downbeat fragment |
| `MT02` | match-start | 6–20 s | Highest-energy reveal |
| `MT03` | ambient-loop | 60–240 s | Seamless in-match bed |
| `MT04` | main-theme | 45–120 s | Full theme statement |
| `ES01` | scheme-twist | 1–3 s | Plot-twist stab / swell |
| `ES02` | master-strike | 1–3 s | Decisive percussion hit |
| `ES03` | villain-ambush | 0.75–2 s | Sharp attack transient |
| `ES04` | bystander | 0.75–1.5 s | Soft incidental flourish |

**Hero themes get `MT01`–`MT04` only.** Event stings are match-level,
not character-level, so heroes skip `ES01`–`ES04` unless a design reason
is logged in [DECISIONS.md](../docs/ai/DECISIONS.md).

### One seed, eight derivatives

The golden rule: **one prompt, eight derivatives.** A single Suno seed
(the `_MASTER`) is generated from the theme's `musicAIPrompt`, then every
other asset is *cropped or extended* from it — never regenerated
separately. Generating per-cue takes would produce eight mismatched
identities and break the consistent-musical-DNA rule.

### Two pipelines

- **Non-generative (Crop only)** — maximum fidelity, exact audio
  preservation. Used for short cues and **all** event stings.
- **Lightly generative (Extend → Crop)** — for length; extend a quiet
  mid-track texture, then crop on bar boundaries. Used for
  `ambient-loop` (and occasionally `main-theme`).

Remix, Mashup, and "Use as Inspiration" are forbidden — they break
continuity.

### Formats and loudness

- **Authoring master:** WAV (44.1/48 kHz, 16–24 bit) — source of truth,
  kept local, **never uploaded**.
- **Distribution:** MP3 320 kbps, encoded from the WAV, uploaded to R2.
- Loudness normalized to **−14 to −12 LUFS** (a post-export step, not
  Suno's job).
- Instrumental only; no silence or fades at start/end (the engine adds
  any crossfades).

### File naming

Both the local WAV master and the R2 MP3 share one base name; only the
extension differs. Pattern: `<theme-id>_<prefix>_<name>.{wav,mp3}` —
e.g. `age-of-apocalypse_ES03_villain-ambush.mp3`. Hero assets use the
`hero-<slug>_` prefix (e.g. `hero-black-widow_MT04_main-theme.mp3`). The
prefix→asset mapping in the table above is locked.

### The crop scripts

Three matched bash (`.sh`) + PowerShell (`.ps1`) script pairs drive the
crops (all require `ffmpeg` + `ffprobe`):

- **`crop-theme`** — scenario 8-asset batch (4 tracks + 4 stings).
- **`crop-hero`** — hero 4-asset batch (`MT01`–`MT04` only).
- **`crop-one`** — single interactive crop, for timestamp discovery and
  ambient-loop experiments.

Crops use `ffmpeg -c copy` (sample-accurate, lossless), then encode to
320 kbps MP3 with locked loudness (`loudnorm=I=-13:LRA=11:TP=-1 -b:a 320k`)
inline. The committed crop script documents exactly how each theme's
derivatives were produced from its master.

### Theme JSON wiring (the runtime contract)

Music lives on `themeSchemaVersion: 2` (per
[D-5509](../docs/ai/DECISIONS.md)). Three top-level fields — `musicTheme`,
`musicAIPrompt`, `musicAssets` — are **all optional**, and within
`musicAssets` every URL field is individually optional, so partial
coverage is valid while a theme is in progress. Casing follows the
schema convention: **`Url`** (lowercase `rl`), never `URL`. The tracked
[age-of-apocalypse.json](../content/themes/age-of-apocalypse.json) is the
worked example — it carries the `musicAIPrompt` seed and the eight
`musicAssets.*Url` fields pointing at `music.barefootbetters.com`.

### Working layout, delivery, and tracked runtime

Audio spans three storage surfaces, one job each (see
[Workspace Map](workspace-map.md) for the surface rules):

- **Working binaries (pCloud, `C:\pcloud\LA\audio\`):** the WAV masters,
  their local MP3 derivatives, and cover images (`*.jpg`) are working
  files kept on pCloud — **never committed to git and never in the repo
  tree.** An MP3 is not diffable, so it fails the git test regardless of
  size (there is no short-sting-in-git exception); large binaries are
  pCloud's job.
- **Delivery (R2):** the published 320 kbps MP3 derivatives are the
  **sole audio surface** the app fetches — the `audio/themes/` and
  `audio/heroes/` prefixes on the `legendary-images` bucket. Masters are
  never uploaded. See
  [Data & File Locations](data-file-locations.md).
- **Tracked in git (`content/media/`):** only the authoring guide, the
  per-theme/hero research `.md`, and the committed crop scripts — all
  version-controlled text, no audio.
- **Tracked runtime (`content/themes/*.json`):** the `musicAssets.*Url`
  references the app consumes, kept in sync with the research `.md`
  (alongside [CATALOG.md](../content/themes/CATALOG.md) /
  [THEME-INDEX.md](../content/themes/THEME-INDEX.md)).

To avoid a per-cue R2 round-trip on time-critical stings (e.g.
`ES02` master-strike), the arena client **prefetches a theme's stings
into decoded audio buffers at match start** rather than bundling audio
into the build.

### The motif matrix (per-entity leitmotifs) {#motif-matrix}

Separate from the eight scenario assets above is a second, finer authoring
track: a **leitmotif grammar** that gives every *entity* — each hero,
mastermind, scheme, and villain group — a short signature phrase (a handful
of notes) that plays the instant that entity acts. Where `MT01`–`ES04` are
**scenario-level** (one identity per theme), motifs are **entity-level**:
the cue you hear on a Master Strike, a Scheme Twist, or a hero's play is
assembled from *who* is on the board, not just *which* scenario is loaded.

The grammar is a matrix — pick a value on each axis and the motif nearly
writes itself:

| Axis | Drives | Example |
|---|---|---|
| **Alignment** (hero vs. villain) | **major** key = heroes; **minor** key = villains / masterminds / schemes | A hero's phrase resolves bright; a Mastermind's lands dark |
| **Hero class** (Strength, Instinct, Covert, Tech, Ranged, …) | **which instrument** carries the phrase | Strength → low brass; Covert → muted / pizzicato strings; Tech → synth |
| **Hero team** (X-Men, X-Factor, Avengers, …) | **which key** the phrase is written in | X-Men in one key, Avengers in another — so teammates harmonize |
| **Power / magnitude** | the **interval size** of the phrase | A small step for a minor effect; a wide leap for a big one |
| **Per-entity fill** | the **actual notes** | Each hero, scheme, and mastermind gets its specific phrase written into the cell |

The locked rules, in one line: **major for heroes, minor for villains,
class picks the instrument, team picks the key, interval size signals
power** — then you go cell by cell and fill in the notes for each hero,
scheme, and mastermind.

Because two heroes on the same team share a key, their motifs
**harmonize** when they combo — the score itself tells you a synergy
landed. That musical harmony is the bespoke-music counterpart to the
client-side [tiered combo cue](sound-effects.md#tiered-combo).

**Production note — motifs are authored, not cropped.** Unlike the Suno
derivatives above, a motif is a two-to-five-note phrase best sequenced from
a small, consistent sampled instrument set (one instrument per class, one
key per team) so every motif shares tuning and timbre. They are tiny, so
they can live in the client SFX sprite rather than as separate R2 tracks —
see [Sound Effects](sound-effects.md#motif-cues). The per-theme **`ES02`
master-strike sting** and a Mastermind's **minor motif** cover the same
instant; whether they layer (theme sting + entity motif) or the motif
supersedes the generic sting is an open reconciliation (below).

### Listen: a produced theme

The one derivative produced so far — the *Age of Apocalypse*
preview-intro (Suno seed in the style of John Williams), embedded with
the `audio` shortcode (see [Ewiki Authoring](ewiki-authoring.md)):

{{< audio src="https://images.legendary-arena.com/audio/themes/age-of-apocalypse_MT01_preview-intro.mp3" caption="Age of Apocalypse — MT01 preview-intro (Suno, style of John Williams)" >}}

## Interactions

- **[Sound Effects](sound-effects.md).** The companion page covers
  client-side SFX and the adaptive-music *design* (the danger-meter
  tiers that would crossfade `MT03` ambient loops). The four event
  stings here (`ES01` scheme-twist, `ES02` master-strike, `ES03`
  villain-ambush, `ES04` bystander) are the bespoke-music counterpart to
  the notable-event sounds catalogued there — same moments, different
  source (per-theme Suno crops vs generic CC0 clips).
- **Themes.** Each theme JSON in `content/themes/` optionally carries the
  music fields; the pipeline's output is exactly what fills
  `musicAssets`. Hero themes are the per-character parallel (research
  done for Black Widow; runtime JSON not yet created — see Edge Cases).
- **[Data & File Locations](data-file-locations.md).** The locator map
  for where theme data and media live in the tree.

## Edge Cases

- **No audio in git — masters live on pCloud.** The WAV masters, their
  local MP3 derivatives, and cover images live on pCloud
  (`C:\pcloud\LA\audio\`), not in the repo tree; only the authoring
  guide, hero research, template, index, and crop scripts under
  `content/media/` are tracked and version-controlled, and the runtime
  theme JSON in `content/themes/` is tracked as before. The ~141 MB
  produced so far has been moved out of `content/media/` to
  `C:\pcloud\LA\audio\` and the crop scripts repointed to run against it.
  This split is locked by D-24219 — see [Workspace Map](workspace-map.md).
- **Masters are never uploaded.** Only the MP3 derivatives ship to R2;
  the `_MASTER.wav` seed stays local. Batch-encode recipes guard against
  encoding the master as a distribution asset.
- **Heroes have no event stings.** `ES01`–`ES04` are match-level; hero
  themes stop at `MT01`–`MT04`.
- **Partial `musicAssets` is valid.** Ship one track at a time; the
  engine must tolerate missing URLs. A theme with no music fields at all
  is still valid.
- **The production music domain is not live yet.** Theme JSON references
  `music.barefootbetters.com/themes/…` (and `…/heroes/…` for heroes),
  but that host does not currently serve. The demo above is hosted on the
  existing `images.legendary-arena.com` bucket as an interim.
- **Never generate per-cue seeds.** Every asset must derive from the one
  `_MASTER` or the theme loses its single musical identity.

## Data Files

- [`content/themes/age-of-apocalypse.json`](../content/themes/age-of-apocalypse.json)
  — worked example: `themeSchemaVersion: 2`, `musicTheme`,
  `musicAIPrompt`, and the eight `musicAssets.*Url` fields.
- [`content/themes/CATALOG.md`](../content/themes/CATALOG.md),
  [`content/themes/THEME-INDEX.md`](../content/themes/THEME-INDEX.md)
  — the tracked theme catalog and index.
- `content/media/MUSIC-AUTHORING.md` — the authoritative authoring guide
  (tracked in git; this wiki page summarizes it).
- `content/media/heroes/HERO-INDEX.json` — generated hero index (279
  heroes across 40 sets) driving hero-theme research (gitignored).

## Open Questions

- **Client consumption.** Which WP wires `musicAssets.*Url` into the
  arena-client playback layer — including the match-start **prefetch of a
  theme's stings into decoded audio buffers** that keeps time-critical
  cues off the R2 round-trip — and how it maps to the adaptive
  danger-meter tiers on [Sound Effects](sound-effects.md) is not yet
  documented here.
- **Production R2 domain.** When `music.barefootbetters.com` goes live,
  the demo above should be re-pointed at the canonical theme URL.
- **Sting vs SFX reconciliation.** The `ES01`–`ES04` stings and the
  notable-event SFX cover the same in-game moments; whether both play,
  or the theme sting supersedes the generic clip, is an open design
  question.
- **Motif matrix — data home and layering.** The grammar is settled
  (class → instrument, team → key, alignment → major/minor, interval →
  power), but two things are open: (1) *where the lookup tables live* — a
  class→instrument map, a team→key map, and the per-entity note phrases
  are new data that needs a home (theme JSON is scenario-level and the
  wrong scope; a dedicated registry data file is the likelier fit); and
  (2) *how a motif and the per-theme `ES02` master-strike sting combine* —
  layer both, or let the entity motif supersede the generic sting. Both
  are unresolved and want a D-entry before production.
- **Motif matrix — playback WP.** Which WP produces the motif sampler and
  wires motif *selection* (from the acting entity's class / team /
  alignment) into the arena-client audio layer is unscoped — see the
  playback side on [Sound Effects](sound-effects.md#motif-cues).

## References

- [`content/themes/age-of-apocalypse.json`](../content/themes/age-of-apocalypse.json)
  — music fields on a real theme (`themeSchemaVersion: 2`).
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-5509 (Theme Schema v2 adds
  the optional `musicTheme` / `musicAIPrompt` / `musicAssets` fields);
  D-22101 (later additive fields kept v2 without a bump); D-24219 (audio
  storage lock: R2 is the sole delivery surface, masters live on
  `C:\pcloud\LA\audio\`, nothing audio in git).
- [Sound Effects](sound-effects.md) — the SFX + adaptive-music-design
  companion page.
- `content/media/MUSIC-AUTHORING.md` — the full authoring guide (Suno
  workflow, per-asset methods, quality checklist, crop scripts); lives
  in the gitignored working area.
- [Suno](https://suno.com/) — the generative tool used for seeds.
