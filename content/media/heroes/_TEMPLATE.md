# Hero Theme Research — `<hero-slug>`

> Copy this file to `content/media/heroes/<hero-slug>/<hero-slug>.md`
> (one subfolder per hero — mirrors the `content/media/age-of-apocalypse/`
> layout). Audio masters, WAVs, and derivative MP3s live alongside this
> file in the same subfolder. Keep sections short and concrete — the
> goal is to end with a single high-signal Suno prompt, not an essay.

## 1. Identity

- **Slug:** `<hero-slug>` (matches `HERO-INDEX.json` → `heroes[].slug`)
- **Display name:** `<Hero Name>`
- **Primary team:** `<team>` (from card data; override only if canon disagrees)
- **Appears in sets:** `<abbr list>` (from `HERO-INDEX.json`)
- **Canonical wiki URL:** `<marvel.fandom.com URL>` (Earth-616 preferred)
- **Alias(es) / alternate identities:** `<e.g. "Peter Parker, Spider-Man">`
- **First appearance:** `<Title #Issue, Year>`

## 2. Official Bio

Pull 3–5 sentences max. Prioritize the arc that best defines the character's
*emotional core* — that is what the music has to hit.

- **marvel.fandom.com:** `<URL>`
  > `<paste key 2–3 sentences>`
- **marvel.com/characters:** `<URL>`
  > `<paste key 1–2 sentences>`
- **superherodb.com:** `<URL>`
  > `<paste key 1–2 sentences>`

## 3. Powers & Abilities

Bullet list. Keep to 5–8 items. Note *how the power feels* in parentheses —
that is what the orchestration has to translate.

- `<power>` (`<feel — e.g. "explosive, percussive" or "ethereal, sustained">`)

## 4. Weaknesses & Conflicts

- **Physical / power-level weaknesses:** `<...>`
- **Internal / psychological conflicts:** `<...>`
- **Signature dilemmas:** `<recurring moral or personal tension>`

Weaknesses matter: they are the minor-key passages in the theme.

## 5. Key Story Arcs (max 3)

For each arc, one line only: what happened + the emotional register.

1. `<Arc name (year)>` — `<one-line emotional summary>`
2. `<Arc name (year)>` — `<one-line emotional summary>`
3. `<Arc name (year)>` — `<one-line emotional summary>`

## 6. Cinematic Tone Extraction

These fields feed the Suno prompt directly. Be specific — vague inputs
produce generic output.

| Field | Value | Notes |
|---|---|---|
| **Composer reference** | `<e.g. Alan Silvestri, Hans Zimmer, John Williams, Ludwig Göransson>` | Pick ONE. Must match on-screen canon if possible. |
| **Genre / sub-genre** | `<e.g. Heroic Orchestral, Covert Spy Thriller, Cosmic Sci-Fi, Gothic Horror>` | |
| **Theme type** | `<e.g. Character Leitmotif, Entrance Fanfare, Melancholy Ballad>` | |
| **Tempo family** | `<slow / mid / driving / frantic>` | Approx BPM range if known. |
| **Key / modality** | `<minor / major / modal / shifting>` | |
| **Primary instrumentation** | `<3–5 instruments that carry the melody>` | |
| **Textural layers** | `<percussion, pads, choir, synths, ethnic instruments>` | |
| **Dynamic arc** | `<e.g. quiet → build → climax → resolve>` | |
| **Mood keywords** | `<4–6 adjectives>` | These go verbatim into the prompt. |
| **Era / setting flavor** | `<e.g. 1960s cold-war, far-future cosmic, medieval Asgard>` | |

## 7. Suno Prompt (Draft max 500 characters)

Follow the locked formula from [MUSIC-AUTHORING.md](../MUSIC-AUTHORING.md)
and [age-of-apocalypse.json](../../themes/age-of-apocalypse.json). The
structure is fixed; fill the bracketed slots from §6 above.

**Suno hard cap: 500 characters.** Iterate the Draft block until it fits,
then mirror the locked version into Final (below) and into the hero-theme
JSON's `musicAIPrompt`. When trimming, cut the character-premise sentence
and mood adjectives first — keep the composer-style anchor, instrumentation,
and loopable/instrumental boilerplate.

```
Create a 45-second seamless loopable orchestral film score in the exact
style of <composer>. <Genre> / <Theme type>. <One-sentence character
premise — who they are and the emotional tension that defines them>.
<Primary instrumentation — specific instruments, not generic families>.
<Textural layers>. <Key / modality — include any major/minor shifts>.
<Mood keywords>. Cinematic, wide stereo, instrumental only, perfectly
loopable with no fade in/out.
```

**Final prompt (paste into Suno Custom → Instrumental: ON):**

```
<paste the filled-in prompt here — this is the string that will be
copied into the hero-theme JSON (e.g. content/themes/heroes/<hero-slug>.json)
as musicAIPrompt. DO NOT put it in data/cards/*.json — that's Registry-layer
gameplay data and musicAIPrompt is authoring-time metadata.>
```

## 8. Audio Assets (tracked as produced)

Parallel to scheme themes but scoped to a single character. Start with
`mainTheme` only — derive the others once the seed is strong. Partial
coverage is fine.

- **WAV / MP3 location:** `content/media/heroes/<hero-slug>/` (this file's folder)
- **File naming:** `hero-<hero-slug>_<prefix>_<name>.{wav,mp3}` (see [MUSIC-AUTHORING.md](../MUSIC-AUTHORING.md))
- **Suno master track title:** `<title Suno assigned to the _MASTER seed>` saved as `hero-<hero-slug>_MASTER.wav`
- **Crop script (provenance):** `crop.sh` — copied from [`../crop-hero.sh`](../crop-hero.sh), timestamps filled in, committed alongside the audio. Documents exactly how the 4 derivative WAVs were produced from the master. For one-off single crops or MT03 loop experiments, use [`../crop-one.sh`](../crop-one.sh) instead.
- **R2 public URL base:** `https://music.barefootbetters.com/heroes/`
- **R2 MP3 URLs also land in:** `content/themes/heroes/<hero-slug>.json` → `musicAssets.*Url` (the runtime-consumed artifact — keep in sync)

| Asset | Status | Local WAV | R2 MP3 URL |
|---|---|---|---|
| `MT04_main-theme` | `not-started / in-progress / done` | | |
| `MT01_preview-intro` | `not-started` | | |
| `MT02_match-start` | `not-started` | | |
| `MT03_ambient-loop` | `not-started` | | |

Event stings (`ES01`–`ES04`) are match-level, not hero-level — skip for
hero themes unless a specific design reason is logged in DECISIONS.md.

## 9. Source Links (for re-research)

- `<URL — anything worth re-reading when revising the prompt>`
- `<URL>`

---

_Workflow reminder: research → tone extraction → prompt → single seed →
derive assets. Do not generate multiple Suno seeds per hero — that breaks
the consistent-musical-DNA rule (see MUSIC-AUTHORING.md §Core Rules)._
