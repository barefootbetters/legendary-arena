---
title: Sound Effects
type: Guide
tags:
  - layer-engine
  - trigger
  - phase-play
  - audio
  - arena-client
  - research
related:
  - master-strike.md
  - scheme-twist.md
  - villain-deck.md
  - turn-system.md
  - rule-execution-pipeline.md
  - monetization-model.md
status: draft
source:
  - ../packages/game-engine/src/events/notableEvents.types.ts
  - ../packages/game-engine/src/rules/ruleHooks.types.ts
  - ../packages/game-engine/src/moves/coreMoves.types.ts
  - ../packages/game-engine/src/endgame/endgame.types.ts
  - ../packages/game-engine/src/turn/turnPhases.types.ts
  - ../docs/ai/ARCHITECTURE.md
last-reviewed: 2026-07-07
---

# Sound Effects

## Summary

This page is a **design reference** for adding sound effects to
`play.legendary-arena.com`. It catalogs the engine events that are the
best candidates to trigger a sound (Master Strike, Scheme Twist,
defeating a villain, and so on), maps each to a suggested sound
character, and records where royalty-free, commercially-safe source
audio can be found. No sounds ship today — this page is `draft`
research, not an implementation contract. The sound-to-event mappings
and library picks are proposals; only the event vocabulary and the
architectural boundaries are sourced to code.

## Mechanics

### The trigger surface

Sound is a **client-side presentation concern**. The engine already
emits every game moment worth scoring with audio; a sound layer in
`arena-client` only has to listen to signals the client already
receives and play a clip. There are four candidate signal surfaces,
in decreasing order of how ready they are to drive sound.

#### Surface 1 — Notable events (the primary, ready-made hook)

`NotableGameEvent` is the engine's append-only record of high-level
player-visible outcomes. Five variants are locked, and — unlike the
game log — they **are** projected to the client as
`UIState.notableEvents`. The arena client already streams them through
[`useNotableEventStream.ts`](../apps/arena-client/src/composables/useNotableEventStream.ts)
and renders them in
[`NotableEventOverlay.vue`](../apps/arena-client/src/components/play/NotableEventOverlay.vue).
A sound layer would ride this exact stream — one clip per event type —
with zero new engine work.

| Event (`NotableGameEventType`) | Fires when | Suggested sound character | Candidate CC0 source |
|---|---|---|---|
| `mastermindStrikeResolved` | A Mastermind Strike card is revealed and resolved | Big dramatic orchestral **stinger** — the signature "uh-oh" moment | OpenGameArt CC0 Cinematic (danger / "Sinister Boss Appears") |
| `schemeTwistResolved` | A Scheme Twist is revealed and resolved | Ominous low sting; darker/subtler than a Strike | OpenGameArt CC0 Cinematic |
| `ambushResolved` | A villain with an `Ambush:` marker enters the City | Menacing whoosh / short threat sting | Kenney Impact Sounds; OpenGameArt CC0 Cinematic |
| `fightResolved` | A player defeats a villain or henchman in the City | Triumphant impact/hit, optionally a coin/bystander flourish when `bystandersRescued > 0` | Kenney Impact Sounds; OpenGameArt 80 CC0 RPG SFX (coins/gems) |
| `mastermindDefeated` | All tactics defeated — the Mastermind is vanquished (win) | Victory fanfare — the biggest positive cue in the game | OpenGameArt CC0 Cinematic; Kenney RPG Audio |

#### Surface 2 — Player action moves (tactile local feedback)

The client dispatches these moves, so it can play a sound on the local
action for immediate tactile feedback (independent of the authoritative
result). The three core moves are `drawCards`, `playCard`, and
`endTurn`; the card-specific moves add fight/recruit/dodge.

| Action (move) | Fires when | Suggested sound character | Candidate CC0 source |
|---|---|---|---|
| `playCard` | A card is played from hand | Card whoosh / place | OpenGameArt Card Game Sounds ("Play card") |
| `recruitHero` | A hero is recruited from HQ | Positive "purchase" chime | Kenney Interface Sounds; OpenGameArt Card Game Sounds |
| `fightVillain` | A player attacks a City villain | Sword/impact swing | Kenney Impact Sounds; OpenGameArt 80 CC0 RPG SFX (blade) |
| `drawCards` | Start-of-turn draw / any draw | Card draw / short shuffle | OpenGameArt Card Game Sounds ("Draw card" / "Shuffle") |
| `dodgeCard` | Dodge — discard a card to draw a replacement | Quick card flick | OpenGameArt Card Game Sounds ("Tap" / "Untap") |
| `endTurn` | The player ends their turn | Soft confirm / pass-turn notification | OpenGameArt Card Game Sounds ("Notification"); Kenney UI Audio |

#### Surface 3 — Turn lifecycle (rule triggers)

`onTurnStart` and `onTurnEnd` are two of the five `RuleTriggerName`
values. These are engine-side triggers; the client sees the effect as
a turn boundary in `UIState`. A subtle "your turn" cue is the main
candidate here — used sparingly to avoid fatigue.

#### Surface 4 — Outcome / endgame

The three `ENDGAME_CONDITIONS` counters decide the match. The win side
(`mastermindDefeated`) is already covered by Surface 1's notable event.
The two loss conditions — `escapedVillains` reaching `ESCAPE_LIMIT` (8)
and `schemeLoss` reaching its threshold — are candidates for a single
somber "heroes lose" sting.

### Where a sound layer would live

Audio belongs entirely in `arena-client` (the Vue app at
`play.legendary-arena.com`). Per
[ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md), the engine owns truth and
the UI consumes read-only projections — so a sound layer reads
`UIState` (chiefly `notableEvents`) and plays clips. It never writes
`G`, never influences an outcome, and adds **zero** engine or
determinism footprint. Bot-vs-bot simulations, replays, and the
determinism proofs are unaffected because none of them render audio.

### Licensing posture (commercial-safe first)

`legendary-arena.com` is a commercial site, so the default is **CC0**
(public-domain dedication): no attribution, unrestricted commercial
use, no redistribution limits, and therefore no ongoing obligation that
could surface later. In order of fit:

- **Kenney.nl** — CC0, no attribution. Consistent, game-ready packs
  (Interface Sounds, Impact Sounds, RPG Audio, UI Audio). The safest
  base layer.
- **OpenGameArt.org CC0 packs** — CC0, no attribution. Card Game
  Sounds, 80 CC0 RPG SFX, CC0 Cinematic Music (boss/danger stingers).
  Verify each asset's license per download page — OpenGameArt hosts
  non-CC0 licenses too.
- **Freesound.org** — mixed licenses; a real API exists for
  programmatic search/download. Filter strictly to CC0 (or track CC-BY
  attribution). Use for one-off gaps, not the base layer.
- **Zapsplat** — large library, but the free tier **requires crediting
  "ZapSplat"** in-project and forbids redistribution of the raw sounds.
  Workable as a fallback if the credit obligation is tracked; not the
  default.

**Avoid CC-BY-NC entirely** — the "NC" (non-commercial) clause makes it
unusable on a revenue-generating site.

## Interactions

- **[Master Strike](master-strike.md).** The `mastermindStrikeResolved`
  notable event is the highest-drama sound candidate. The overlay it
  drives already exists; sound rides the same event.
- **[Scheme Twist](scheme-twist.md).** `schemeTwistResolved` is the
  sibling stinger candidate; the same overlay/stream carries it.
- **[Villain Deck](villain-deck.md).** The reveal pipeline is what
  ultimately produces the Ambush, Scheme Twist, and Master Strike
  notable events; escapes flow through here too (see Edge Cases).
- **[Turn System](turn-system.md).** Supplies the `onTurnStart` /
  `onTurnEnd` lifecycle cues and the stage boundaries that gate when
  action-move sounds are legal.
- **[Rule Execution Pipeline](rule-execution-pipeline.md).** Emits the
  rule triggers; a sound layer never touches it — it observes results,
  not the pipeline.
- **[Monetization Model](monetization-model.md).** Audio polish is a
  retention/perceived-quality lever, not a revenue vector in itself.
  Sound never gates play and never becomes pay-to-win; a cosmetic
  "sound pack" would only ever be an optional flourish.

## Edge Cases

- **Villain escape has no notable event yet.** There is no
  `escapeResolved` variant — it is deferred (WP-186 / D-20001, noted in
  [`notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)).
  A "villain escaped the City" sound therefore has no ready client
  signal today; it would need that event added, or a different
  `UIState` field to key off.
- **Do not drive sound off the game log.** `G.messages` is **not**
  projected to clients (per the `notableEvents.types.ts` header and
  D-20008). Only `notableEvents` and the typed `UIState` surfaces reach
  the browser. Building sound on the log would work in the engine and
  silently do nothing in production.
- **Browser autoplay policy.** Browsers block audio until the first
  user gesture. Any sound layer needs an interaction-gated "audio
  unlock" (e.g., first click/tap) before clips will play, plus a
  persistent mute/volume control (localStorage) so returning players
  keep their preference.
- **Determinism is untouched, and must stay that way.** Audio is pure
  presentation. It must never read into or write out of `G`/`ctx`,
  never affect move validation, and never branch engine logic. The
  determinism invariant ([ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md))
  is a non-issue precisely because audio stays client-side.
- **Attribution obligations travel with the asset.** A CC0 clip is
  free-and-clear forever; a Zapsplat/CC-BY clip carries a credit (and,
  for Zapsplat, a no-redistribution) obligation that must be tracked
  per-asset if mixed in. Prefer CC0 to avoid a growing credits ledger.
- **Asset weight.** Keep clips small and web-friendly (short OGG/MP3/
  WebM), and decide bundle-vs-CDN delivery deliberately (see Open
  Questions) so the audio layer does not bloat the arena-client bundle.

## Code Touchpoints

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — the five `NotableGameEventType` variants (Surface 1); the primary
  sound-trigger vocabulary
- [`packages/game-engine/src/rules/ruleHooks.types.ts`](../packages/game-engine/src/rules/ruleHooks.types.ts)
  — `RuleTriggerName` (`onTurnStart` / `onTurnEnd` lifecycle cues,
  Surface 3)
- [`packages/game-engine/src/moves/coreMoves.types.ts`](../packages/game-engine/src/moves/coreMoves.types.ts)
  — `CoreMoveName` (`drawCards` / `playCard` / `endTurn`, Surface 2)
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `ENDGAME_CONDITIONS` and `ESCAPE_LIMIT` (Surface 4 outcomes)
- [`packages/game-engine/src/turn/turnPhases.types.ts`](../packages/game-engine/src/turn/turnPhases.types.ts)
  — match phases and turn stages that gate when action sounds are legal
- [`apps/arena-client/src/composables/useNotableEventStream.ts`](../apps/arena-client/src/composables/useNotableEventStream.ts)
  — existing client stream of notable events; the natural place for a
  sound layer to attach
- [`apps/arena-client/src/components/play/NotableEventOverlay.vue`](../apps/arena-client/src/components/play/NotableEventOverlay.vue)
  — existing overlay driven by the same stream

## Open Questions

- **No Work Packet is scoped yet.** This page is pre-design research.
  Before implementation, a WP would define the sound layer's contract,
  the mute/volume UX, and the initial event coverage.
- **Asset delivery — bundle vs CDN.** Ship clips inside the
  arena-client bundle, or host them on R2 (the `images.legendary-arena.com`
  precedent suggests a `sounds.` / R2 path could work)? Undecided.
- **Escape coverage.** Whether to add the deferred `escapeResolved`
  notable event (WP-186) so villain escapes can be sounded, or leave
  escapes silent for v1.
- **Accessibility.** Respect a reduced-motion / reduced-audio
  preference, and default volume conservatively.
- **Scope: SFX only.** This page covers discrete sound *effects*.
  Background music is a separate concern and out of scope here.

## References

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — `NotableGameEventType` (5 locked variants), projected as
  `UIState.notableEvents`; header notes `G.messages` is not projected
- [`packages/game-engine/src/rules/ruleHooks.types.ts`](../packages/game-engine/src/rules/ruleHooks.types.ts)
  — `RULE_TRIGGER_NAMES` (5 triggers)
- [`packages/game-engine/src/moves/coreMoves.types.ts`](../packages/game-engine/src/moves/coreMoves.types.ts)
  — `CORE_MOVE_NAMES` (3 core moves)
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `ENDGAME_CONDITIONS`, `ESCAPE_LIMIT`
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — engine owns truth /
  UI consumes read-only projections; determinism invariant
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-20001 (minimal notable-event
  payload; deferred `escapeResolved`), D-20008 (`mastermindDefeated`
  added because `G.messages` is not projected)
- External sound libraries (verify each asset's license on its page):
  - [Kenney.nl — Interface Sounds](https://kenney.nl/assets/interface-sounds) (CC0)
  - [Kenney.nl — Impact Sounds](https://kenney.nl/assets/impact-sounds) (CC0)
  - [Kenney.nl — RPG Audio](https://kenney.nl/assets/rpg-audio) (CC0)
  - [OpenGameArt — Card Game Sounds](https://opengameart.org/content/card-game-sounds) (CC0)
  - [OpenGameArt — 80 CC0 RPG SFX](https://opengameart.org/content/80-cc0-rpg-sfx) (CC0)
  - [OpenGameArt — CC0 Cinematic Music](https://opengameart.org/content/cc0-cinematic-music) (CC0)
  - [Freesound.org](https://freesound.org/) (mixed licenses; API available — filter to CC0)
  - [Zapsplat — Standard License](https://www.zapsplat.com/license-type/standard-license/) (free tier requires "ZapSplat" credit; no redistribution)
