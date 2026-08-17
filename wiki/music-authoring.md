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
  - C:\pcloud\LA\audio\audio-motif-map.json (the motif system — team keys, class instruments, rules)
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
mastermind, scheme, and villain group — a short signature phrase (a locked
**three-note** motif) that plays the instant that entity acts. Where `MT01`–`ES04` are
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

#### Team → key: the twelve root notes {#team-keys}

Every team is pinned to one of the **twelve chromatic root notes**, and all
twelve are in use — the 26 teams pack the full circle (C, D♭, D, E♭, E, F,
F♯, G, A♭, A, B♭, B). A team's *side* sets its mode: **major for heroes,
minor for villains**, with the two grey antihero teams (Mercs for Money,
Venomverse) written minor and flippable to major to soften. The neutral
**Unaffiliated** pool has no home key at all — its motif floats on a quartal
cell with no fixed mode.

Two rules make the keys mean something beyond "pick a note":

- **Mirroring.** Each villain group is pinned to the **same root as the hero
  team it opposes, flipped major → minor.** Same home note, opposite mood —
  every hero/villain clash sounds like two sides of one coin: Marvel Knights
  (E♭ major) ↔ Crime Syndicate (E♭ minor); Spider Friends (E major) ↔
  Sinister Six (E minor); S.H.I.E.L.D. (G major) ↔ HYDRA (G minor, the
  corrupted institution); X-Men (D major) ↔ Brotherhood (D minor);
  Illuminati (F♯ major) ↔ Cabal (F♯ minor); Heroes of Asgard (A♭ major) ↔
  Foes of Asgard (A♭ minor).
- **Families.** Related teams share a root and form a musical family, kept
  distinct by instrument (class) and register. The **X-family** orbits **D**
  (X-Men, X-Force, X-Factor Investigations — and their Brotherhood mirror);
  the **Avengers family** orbits **C** (Avengers, New Warriors, Champions);
  the **Guardians family** orbits **F** (Guardians of the Galaxy, Guardians
  of the Multiverse). Family members harmonize by construction — they're
  already in the same key before any two combo.

| Icon | ID | Team | Side | Key (root + mode) | Family |
|---|---|---|---|---|---|
| — | 0 | Unaffiliated | Neutral | — (quartal, no home key) | — |
| ![Avengers](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-avengers.svg "width=28px") | 1 | Avengers | Hero | C major | Avengers |
| ![S.H.I.E.L.D.](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-shield.svg "width=28px") | 2 | S.H.I.E.L.D. | Hero | G major | — |
| ![Spider Friends](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-spider-friends.svg "width=28px") | 3 | Spider Friends | Hero | E major | Spider |
| ![X-Men](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-x-men.svg "width=28px") | 4 | X-Men | Hero | D major | X |
| ![Fantastic Four](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-fantastic-four.svg "width=28px") | 5 | Fantastic Four | Hero | A major | — |
| ![Marvel Knights](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-marvel-knights.svg "width=28px") | 6 | Marvel Knights | Hero | E♭ major | Street |
| ![X-Force](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-x-force.svg "width=28px") | 7 | X-Force | Hero | D major | X |
| ![Crime Syndicate](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-crime-syndicate.svg "width=28px") | 8 | Crime Syndicate | Villain | E♭ minor | Street |
| ![Sinister Six](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-sinister-six.svg "width=28px") | 9 | Sinister Six | Villain | E minor | Spider |
| ![Foes of Asgard](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-foes-of-asgard.svg "width=28px") | 10 | Foes of Asgard | Villain | A♭ minor | Asgard |
| ![Brotherhood](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-brotherhood.svg "width=28px") | 11 | Brotherhood | Villain | D minor | X |
| ![Guardians of the Galaxy](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-guardians-of-the-galaxy.svg "width=28px") | 12 | Guardians of the Galaxy | Hero | F major | Guardians |
| ![HYDRA](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-hydra.svg "width=28px") | 13 | HYDRA | Villain | G minor | — |
| ![Cabal](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-cabal.svg "width=28px") | 14 | Cabal | Villain | F♯ minor | Council |
| ![Illuminati](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-illuminati.svg "width=28px") | 15 | Illuminati | Hero | F♯ major | Council |
| ![New Warriors](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-new-warriors.svg "width=28px") | 16 | New Warriors | Hero | C major | Avengers |
| ![Mercs for Money](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-mercs-for-money.svg "width=28px") | 17 | Mercs for Money | Antihero (grey) | B♭ minor (→ B♭ major to soften) | — |
| ![Champions](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-champions.svg "width=28px") | 18 | Champions | Hero | C major (Lydian ♯4) | Avengers |
| ![Warbound](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-warbound.svg "width=28px") | 19 | Warbound | Hero | B♭ major | — |
| ![Venomverse](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-venomverse.svg "width=28px") | 20 | Venomverse | Antihero (grey) | E minor (Phrygian; → E major to soften) | Spider |
| ![Heroes of Asgard](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-heroes-of-asgard.svg "width=28px") | 21 | Heroes of Asgard | Hero | A♭ major | Asgard |
| ![Inhumans](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-inhumans.svg "width=28px") | 22 | Inhumans | Hero | B major | — |
| ![X-Factor Investigations](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-x-factor-investigations.svg "width=28px") | 23 | X-Factor Investigations | Hero | D major | X |
| ![Heroes of Wakanda](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-heroes-of-wakanda.svg "width=28px") | 24 | Heroes of Wakanda | Hero | D♭ major | — |
| ![Guardians of the Multiverse](https://www.barefootbetters.com/wp-content/uploads/2026/03/team-guardians-of-the-multiverse.svg "width=28px") | 25 | Guardians of the Multiverse | Hero | F major | Guardians |

#### Class → instrument

The team fixes the *key*; the acting card's **class** fixes the *instrument*
that carries the phrase — so a Strength card and a Covert card on the same
team share a key but sound nothing alike. One sampled instrument per class
keeps every motif on the same tuning and timbre.

| Icon | Class | Instrument family | Instrument | Character |
|---|---|---|---|---|
| ![Covert](https://www.barefootbetters.com/wp-content/uploads/2026/03/class-covert.svg "width=28px") | Covert | Strings | Muted / pizzicato violins | Light, plucked, tiptoeing — sneaky and agile |
| ![Instinct](https://www.barefootbetters.com/wp-content/uploads/2026/03/class-instinct.svg "width=28px") | Instinct | Strings | Low cellos & double basses | Prowling low-string ostinato — a rising minor 2nd, John Williams "Jaws" style: slow, tense, accelerating as it closes in |
| ![Ranged](https://www.barefootbetters.com/wp-content/uploads/2026/03/class-ranged.svg "width=28px") | Ranged | Woodwinds | Flute / piccolo | Airy and distant — something in flight, fired from afar |
| ![Strength](https://www.barefootbetters.com/wp-content/uploads/2026/03/class-strength.svg "width=28px") | Strength | Brass | Trumpets & trombones | Powerful, loud, commanding |
| ![Tech](https://www.barefootbetters.com/wp-content/uploads/2026/03/class-tech.svg "width=28px") | Tech | Percussion + synth | Tuned percussion / synth | Mechanical, precise, digital |

#### Direction and interval (the power knob)

Two more axes the one-line summary compresses. Both ride on top of the
key/instrument choice:

- **Resolution direction** — hero motifs **rise** (the final note lifts to a
  bright resolution); villain motifs **fall** (the final note drops to an
  ominous one). Same shape, opposite sign, so a hero and its mirror villain
  in the same root read as inversions of each other.
- **Interval size** = the drama/volume knob for how powerful the card is. A
  gentle **2nd or 3rd** = a minor henchman or small buff; a **4th or 5th** =
  a standard hero or villain card; an **octave or more** = a game-swinging
  power (a big villain plunge or a big hero soar — the Master Strike register).

Because two heroes on the same team share a key, their motifs
**harmonize** when they combo — the score itself tells you a synergy
landed. That musical harmony is the bespoke-music counterpart to the
client-side [tiered combo cue](sound-effects.md#tiered-combo).

**Production note — motifs are generated, not cropped.** Unlike the Suno
derivatives above, a motif is a locked three-note phrase produced
deterministically from the motif map by
[`generate-motifs.mjs`](../content/media/motifs/generate-motifs.mjs)
(D-24225): the `.mid` is the master, rendered to a WAV + a 320 kbps MP3 by
**MuseScore** (the default renderer — its bundled sampled instruments) or a
dependency-free Node **synth** fallback, one instrument per class and one key
per team (see the [team→key](#team-keys) and class→instrument tables above) so
every motif shares tuning and timbre. They are tiny, so they live in the client
SFX sprite rather than as separate R2 tracks — see
[Sound Effects](sound-effects.md#motif-cues). When the per-theme **`ES02`
master-strike sting** and a Mastermind's **minor motif** cover the same instant,
the two **layer** — the theme sting at full level, the entity motif on top at
**−6 to −9 dB** (motif = identity, sting = scenario weight; D-24226).

### Production priority (what improves play first)

The highest-leverage order front-loads emotional payoff and on-team synergy
visibility over breadth:

1. **Age of Apocalypse full set** + wire the match-start sting prefetch.
2. **Master Strike + Scheme Twist stings** for the next 3–4 most-played themes.
3. **Motif matrix** — the five class instruments × team keys. ✅ *Done:* the
   generator (D-24225) has produced the full 25-team × 5-class grid (125 motifs)
   on pCloud; remaining is R2 / SFX-sprite delivery and the playback wiring.
4. **Ambient-loop + danger-meter crossfade** (see [Sound Effects](sound-effects.md)).
5. **Hero themes** — only after the match-level system is solid.

Motifs render fast and deterministically, so breadth there is cheap; the
theme-level assets (1, 2, 4) are the scarce, high-payoff work.

### Listen: hero motifs {#hero-motifs}

Every hero team's motif, one row per class instrument — all in the team's
**major** key, resolving **upward** (the [grammar](#motif-matrix) above),
MuseScore-rendered by the generator (D-24225). Play any row. Because teammates
share a key, two heroes on the same team **harmonize** when they combo — hear
the families: the X-teams all orbit **D**, the Avengers-family teams **C**, the
Guardians teams **F**. Each hero team is the bright, rising inverse of its
[villain mirror](#villain-motifs) below (X-Men D major ↔ Brotherhood D minor;
S.H.I.E.L.D. G major ↔ HYDRA G minor).

{{< motif-table >}}
Avengers|avengers|Hero|C major
S.H.I.E.L.D.|shield|Hero|G major
Spider Friends|spider-friends|Hero|E major
X-Men|x-men|Hero|D major
Fantastic Four|fantastic-four|Hero|A major
Marvel Knights|marvel-knights|Hero|E♭ major
X-Force|x-force|Hero|D major
Guardians of the Galaxy|guardians-of-the-galaxy|Hero|F major
Illuminati|illuminati|Hero|F♯ major
New Warriors|new-warriors|Hero|C major
Champions|champions|Hero|C major (Lydian)
Warbound|warbound|Hero|B♭ major
Heroes of Asgard|heroes-of-asgard|Hero|A♭ major
Inhumans|inhumans|Hero|B major
X-Factor Investigations|x-factor-investigations|Hero|D major
Heroes of Wakanda|heroes-of-wakanda|Hero|D♭ major
Guardians of the Multiverse|guardians-of-the-multiverse|Hero|F major
{{< /motif-table >}}

### Listen: villain motifs {#villain-motifs}

Every villain group's motif, one row per class instrument — all in the group's
**minor** key, resolving **downward** (the [grammar](#motif-matrix) above),
MuseScore-rendered by the generator (D-24225). Play any row. Two pairs to listen
for: **HYDRA (G minor)** is the exact dark inversion of **S.H.I.E.L.D. (G
major)**, and **Brotherhood (D minor)** of the **X-Men (D major)** — same root,
opposite mood. The hero teams follow the identical shape in **major**, rising.

{{< motif-table >}}
Crime Syndicate|crime-syndicate|Villain|E♭ minor
Sinister Six|sinister-six|Villain|E minor
Foes of Asgard|foes-of-asgard|Villain|A♭ minor
Brotherhood|brotherhood|Villain|D minor
HYDRA|hydra|Villain|G minor
Cabal|cabal|Villain|F♯ minor
{{< /motif-table >}}

### Listen: grey antihero motifs {#antihero-motifs}

The two **grey** antihero groups render **minor** like the villains (the map
stores them minor, flippable to major to soften — see the
[grammar](#motif-matrix)), so their motifs resolve **downward** with a wry
menace rather than a hero's bright lift. Venomverse (E minor) shares Sinister
Six's root — Spider-dark either way.

{{< motif-table >}}
Mercs for Money|mercs-for-money|Antihero (grey)|B♭ minor
Venomverse|venomverse|Antihero (grey)|E minor
{{< /motif-table >}}

That completes the roster: [heroes](#hero-motifs) in major/rising,
[villains](#villain-motifs) and these greys in minor/falling — every keyed team
now audible.

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
- `C:\pcloud\LA\audio\audio-motif-map.json` — the authoritative motif
  system: the 26 team→key rows (twelve chromatic roots), the 5
  class→instrument rows, and the locked rules (mode, resolution direction,
  interval weight, mirroring, families). Lives on pCloud alongside the WAV
  masters (D-24219), not in the repo tree.

## Open Questions

- **Client consumption (partly answered).** The **danger-meter tier
  mapping** half is settled: **WP-560** ships the adaptive score on its own
  `musicEngine.ts`, crossfading three CC0 loops keyed to
  `UIState.progress.menaceTier` (D-24369). What remains open is the
  **per-theme** side — which WP wires `musicAssets.*Url` into the playback
  layer, including the match-start **prefetch of a theme's stings into
  decoded audio buffers** that keeps time-critical cues off the R2
  round-trip. WP-560 deliberately did not touch that pipeline; it uses
  generic CC0 beds under `audio/music/`, not theme masters.
- **Production R2 domain.** When `music.barefootbetters.com` goes live,
  the demo above should be re-pointed at the canonical theme URL.
- **Sting vs generic-clip reconciliation.** For a moment covered by both a
  per-theme `ES01`–`ES04` sting *and* a generic CC0 notable-event clip,
  whether both play or the theme sting supersedes the generic one is still
  open. (The narrower motif × theme-sting case is settled — they layer at
  −6/−9 dB, D-24226 — but this theme-vs-generic axis is separate.)
- **Motif matrix — data home & layering (resolved).** The lookup data ships
  as a **slim runtime registry generated into the arena-client build** from
  `audio-motif-map.json`, which stays authoritative on pCloud (D-24227); and a
  motif **layers on top of** the theme `ES02` sting at −6 to −9 dB (D-24226).
  The generator that produces the motifs is D-24225.
- **Motif matrix — playback WP.** Which WP produces the sampler-backed SFX
  sprite and wires motif *selection* (from the acting entity's class / team /
  alignment) into the arena-client audio layer is still unscoped — see the
  playback side on [Sound Effects](sound-effects.md#motif-cues). (The lookup
  *data* home is now settled, D-24227.)

## References

- [`content/themes/age-of-apocalypse.json`](../content/themes/age-of-apocalypse.json)
  — music fields on a real theme (`themeSchemaVersion: 2`).
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-5509 (Theme Schema v2 adds
  the optional `musicTheme` / `musicAIPrompt` / `musicAssets` fields);
  D-22101 (later additive fields kept v2 without a bump); D-24219 (audio
  storage lock: R2 is the sole delivery surface, masters live on
  `C:\pcloud\LA\audio\`, nothing audio in git); D-24225 (the motif generator
  — deterministic MIDI-master + MuseScore-default / synth-fallback render,
  outputs on pCloud); D-24226 (motif layers on the theme sting at −6/−9 dB);
  D-24227 (motif lookup ships as a slim runtime registry generated into the
  client build).
- `C:\pcloud\LA\audio\audio-motif-map.json` — the motif system data
  (team keys, class instruments, rules) this page's [motif matrix](#motif-matrix)
  documents.
- [Sound Effects](sound-effects.md) — the SFX + adaptive-music-design
  companion page (the *playback* side of the motif grammar).
- `content/media/MUSIC-AUTHORING.md` — the full authoring guide (Suno
  workflow, per-asset methods, quality checklist, crop scripts); lives
  in the gitignored working area.
- [Suno](https://suno.com/) — the generative tool used for seeds.
