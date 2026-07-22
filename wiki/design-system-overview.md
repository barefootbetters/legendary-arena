---
title: Design System Overview
type: Guide
tags:
  - design-system
  - visual
  - audio
  - psychology
  - narrative
  - juice
  - arena-client
  - research
related:
  - visual-effects.md
  - sound-effects.md
  - music-authoring.md
  - turn-system.md
  - villain-deck.md
  - vision.md
  - monetization-model.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\design-system-overview.md (this page — https://ewiki.legendary-arena.com/design-system-overview/)
  - ../packages/game-engine/src/events/notableEvents.types.ts
  - ../packages/game-engine/src/ui/uiState.types.ts
  - ../packages/game-engine/src/moves/coreMoves.impl.ts
  - ../packages/game-engine/src/endgame/endgame.types.ts
  - ../docs/ai/ARCHITECTURE.md
last-reviewed: 2026-07-22
---

# Design System Overview

## Summary

This page is the **north star** for the sensory-and-feel layer of
`play.legendary-arena.com` — the umbrella that ties together how the game
*feels* to play: what you see (juice), what you hear (audio), why it's
satisfying (reward psychology), and what it *means* (narrative). It exists
to answer one organizing question Jeff raised: **how do these framework
docs stay interconnected instead of siloing into a pile of pages nobody
cross-references?**

The answer is a **shared trigger spine**. Every framework — visual, audio,
dopamine, narrative — reacts to the *same* small vocabulary of engine
events the client already receives (a Master Strike resolved, a villain
defeated, a synergy chain fired). Because all four hang off that one
vocabulary, the cross-links write themselves: a Master Strike firing a red
screen-shake, a dramatic sting, a dopamine "threat" spike, and a
good-versus-evil story beat are four reactions to the *one*
`mastermindStrikeResolved` event. The pages point at each other **through
the engine's own event names**, not through a hand-maintained index that
rots. Kill the silo at the vocabulary, not with a table of contents.

This page catalogs that shared spine once, canonically, and links out to
each framework. No feel-layer code ships today beyond the shipped audio
foundation and combo cue — this is `draft` research. Only the event
vocabulary, the projected `UIState` signals, and the architectural
boundaries are sourced to code; the framework treatments are proposals on
their own pages.

## Mechanics

### The design principle: react to the engine, not to each other

Per [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md), the engine owns truth
and the UI consumes **read-only projections**. Every feel-layer framework
is therefore a *pure client-side reaction* to `UIState`: it reads what the
engine already decided, and renders/plays/frames a response. None of them
write `G`, influence an outcome, or add any engine or determinism
footprint. That single constraint is what makes them composable — they all
speak the same input language (`UIState`), so they can all react to the
same moment independently and in sync.

This is already proven, not theoretical: the **audio layer shipped** on
exactly this pattern — a client-only, `UIState`-reading foundation
(WP-412) and a tiered combo cue (WP-413) — with zero engine changes. The
visual layer mirrors it. The psychology and narrative layers are lenses
*over* the same signals.

### The shared trigger spine {#shared-trigger-spine}

This is the canonical event vocabulary every framework references. It is
projected on `UIState` and reaches the browser today (unless noted). Each
framework page maps these same rows to its own medium — this table is the
**single place** the vocabulary is defined; the framework pages point
here rather than re-listing it.

| Trigger (engine signal) | Client source | The moment | Visual | Audio | Dopamine | Narrative |
|---|---|---|---|---|---|---|
| `mastermindStrikeResolved` | `UIState.notableEvents` | The Mastermind strikes back | screen-shake + red vignette | dramatic stinger | **threat spike** | evil asserts itself |
| `schemeTwistResolved` | `UIState.notableEvents` | The villains' plan advances | desaturation ripple | ominous low sting | dread / rising stakes | the plot thickens |
| `ambushResolved` | `UIState.notableEvents` | A villain crashes into the City | edge-glow + card slam | menacing whoosh | surprise threat | a new foe arrives |
| `fightResolved` | `UIState.notableEvents` (+ `bystandersRescued`, `appliedEffects`) | You defeat a villain / free a bystander | impact burst + coin flourish | triumphant hit | **reward hit** | a heroic rescue |
| `mastermindDefeated` | `UIState.notableEvents` | The Mastermind is vanquished (win) | victory bloom + confetti | victory fanfare | **peak reward** | good triumphs |
| `healResolved` | `UIState.notableEvents` | You heal wounds | green shimmer | restorative chime | relief | recovery |
| `lastPlayEffectsFired` (1 / 2 / 3+) | `UIState.game.lastPlayEffectsFired` | A synergy **chain** cascades | escalating combo flash | escalating combo cue | **escalating reward** | mastery / momentum |
| `playCard` / `recruitHero` / `fightVillain` / `drawCards` / `dodgeCard` / `endTurn` | local move dispatch | Your own actions | card motion / glow | tactile clicks | agency / flow | you act on the world |
| `onTurnStart` / `onTurnEnd` | turn boundary in `UIState` | Turn hand-off | subtle sweep | soft "your turn" | anticipation | your moment |
| Endgame: `heroes-win` / `scheme-wins` / `tie` | `EndgameOutcome` | The match resolves | full-screen finale | fanfare / dirge / wry sting | **resolution** | the story ends |

**Signal readiness, in brief** (the frameworks share these limits):

- **Ready today:** the six `notableEvents`, `lastPlayEffectsFired` (the
  combo chain count — the flagship "cascade" signal, D-24221), the
  local-move dispatches, and the three endgame outcomes.
- **Keyword-only precision:** `appliedEffects` tells you *what kind* of
  sub-effect fired (wound / KO / capture) but not the target or count.
- **No hook today:** villain **escape** is log-only (deferred
  `escapeResolved`, WP-186 / D-20001) — a dramatic moment none of the
  frameworks can react to until that event is added.
- **Never usable:** `G.messages` (the game log) is **not** projected to
  clients (D-20008). No framework may build on it.

### The four frameworks {#planned-pages}

Each is (or will be) its own page. All four react to the spine above; this
overview is the hub that keeps them discoverable and consistent.

1. **[Visual Effects Framework](visual-effects.md)** — *drafted.* The
   "juice": escalating combo flashes, particle bursts, screen-shake, card
   motion, and full-screen finales. Its flagship is the chain-reaction
   combo flash off `lastPlayEffectsFired` — buildable today, mirroring the
   shipped audio combo cue.
2. **[Sound Effects](sound-effects.md)** — *drafted, foundation shipped.*
   The audio twin: discrete event cues, an adaptive danger-meter score, and
   the shipped tiered combo cue. Companion:
   [Music Authoring](music-authoring.md) (the composed-motif / leitmotif
   grammar).
3. **[Dopamine Trigger Framework](dopamine-triggers.md)** — *drafted.* Why
   the loop is satisfying: which moments are *reward* hits (defeat, rescue,
   combo) versus *threat* spikes (Strike, Twist, Ambush), variable-reward
   pacing, and how the visual + audio cues are timed to land the dopamine
   beat. Maps the spine's "Dopamine" column to reward psychology.
   **Guardrail:** this is engagement-quality craft, not manipulation — it
   stays inside the [Vision](vision.md) bright lines (never pay-to-win,
   never dark-pattern compulsion loops); see
   [Monetization Model](monetization-model.md).
4. **[Narrative Psychology Framework](narrative-psychology.md)** —
   *drafted.* Meaning and emotional resonance: Marvel lore, hero
   archetypes, good-versus-evil mythology, and nostalgia — the hooks that
   make players invested beyond mechanics. Ties each spine row to a story
   beat. Houses the **[Playstyle Modes](narrative-psychology.md#playstyle-modes)**
   concept — the builder-versus-destroyer *lens* (a preference toggle that
   re-frames the same events as heroic rescue or villain conquest without
   building two games; the visual mechanics of the re-theme are specced
   under [Visual Effects → narrative lens](visual-effects.md#playstyle-lens)).

### How the cross-links stay healthy

The anti-silo mechanism, stated plainly:

- **One vocabulary, defined once.** The [shared trigger spine](#shared-trigger-spine)
  lives here and nowhere else. Framework pages reference a row by its
  engine name (`fightResolved`), so a reader on the Visual page can jump to
  the same row's Audio or Narrative treatment.
- **Twin moments cite each other.** A combo *flash* (Visual) and a combo
  *cue* (Audio) both fire off the one `lastPlayEffectsFired` change and are
  written to peak together — each page links the other at that row.
- **The engine is the source of truth for "what happened."** Because every
  framework reads the same `UIState`, they can never disagree about whether
  a Master Strike occurred — only about how to dramatize it. That shared
  ground truth is the cross-reference.

## Interactions

- **[Visual Effects Framework](visual-effects.md)** and
  **[Sound Effects](sound-effects.md)** — the two shipped-or-drafted
  sensory frameworks; they must stay in lockstep at each spine row (a
  flash and its sting peak together).
- **[Music Authoring](music-authoring.md)** — the composed-motif layer that
  colours audio (and, via team key, harmonizes combo flourishes) by *who*
  is acting.
- **[Vision](vision.md)** and **[Monetization Model](monetization-model.md)**
  — the guardrails: the feel layer is a retention / perceived-quality lever,
  never a revenue gate and never a pay-to-win or dark-pattern surface. Polish
  is free to all players.
- **[Turn System](turn-system.md)** and **[Villain Deck](villain-deck.md)**
  — the engine subsystems that emit most of the spine's triggers.

## Edge Cases

- **The spine is a client-side reaction surface, not an engine contract.**
  Nothing here changes the engine; all four frameworks are pure
  `UIState`-reading presentation. If a framework ever needs the engine to
  emit something new (e.g. `escapeResolved`), that is an engine WP with its
  own `DECISIONS.md` entry — not a change to this page.
- **The three sensory-expansion senses are out of browser scope.** Smell
  and taste (essential-oil / snack pairings) and physical haptics were
  raised in design discussion and are correctly **deferred** — they belong
  to the physical STEM-kit / diorama product
  ([Legendary Forge](legendary-forge.md)), not to the web feel layer. This
  overview scopes only what a browser can deliver: visual, audio, and (where
  a device supports it) light haptic feedback.
- **All four frameworks are drafted, none are built.** Visual, Audio,
  Dopamine, and Narrative pages exist as `draft` research referenced from
  the [spine](#shared-trigger-spine); their columns in the trigger table are
  design intent, not a built spec (only the audio foundation + combo cue
  have shipped code).
- **Keep psychology inside the bright lines.** The Dopamine framework
  documents *why the game is fun*, not *how to make it compulsive*. Any
  mechanic that would gate play, pressure spend, or exploit a compulsion
  loop is out of scope by [Vision](vision.md) rule — flag it there, don't
  encode it here.

## Code Touchpoints

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — the six `NotableGameEventType` variants that make up most of the spine
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — the `UIState` contract every framework reads (`notableEvents`,
  `game.lastPlayEffectsFired`, `progress`, `scheme`, `players`)
- [`packages/game-engine/src/moves/coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)
  — the combo chain count's origin (`lastPlayEffectsFired`)
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome` (the three finales)
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — engine owns truth / UI
  consumes read-only projections; the constraint that makes the frameworks
  composable

## Open Questions

- **No Work Packet is scoped yet.** This overview and its framework pages
  are pre-design research. Implementation of the visual layer would follow
  the audio arc's WP pattern (foundation → combo cue → event coverage).
- **Write the two planned pages.** The Dopamine Trigger Framework and
  Narrative Psychology Framework (with its Playstyle Modes sibling) are
  referenced but unwritten; drafting them completes the four-framework set.
- **Sensory expansion appendix.** Capture the deferred smell/taste/haptic
  ideas as an explicit appendix pointing at [Legendary Forge](legendary-forge.md)
  so the idea isn't lost, without polluting the browser-scoped frameworks.
- **Preference surface.** The reduced-motion / effect-intensity control and
  the builder/destroyer narrative-lens toggle both live in player
  preferences — decide whether that's one settings panel or split across the
  sensory and narrative frameworks.

## References

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — `NotableGameEventType` (6 locked variants); header notes `G.messages`
  is not projected and `escapeResolved` is deferred
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — the projected signals every framework reads
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome`, `ESCAPE_LIMIT`
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — engine owns truth / UI
  consumes read-only projections
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-24221 (`lastPlayEffectsFired`,
  the combo chain signal), D-24228 (shipped tiered combo cue), D-24224
  (client-only audio foundation), D-20001 / D-20008 (notable-event payload;
  log not projected), D-24159 / WP-367 (the deck-exhaustion tie)
- Companion framework pages: [Visual Effects](visual-effects.md),
  [Sound Effects](sound-effects.md), [Music Authoring](music-authoring.md)
