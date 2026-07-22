---
title: Visual Effects Framework
type: Guide
tags:
  - layer-engine
  - trigger
  - phase-play
  - visual
  - vfx
  - juice
  - animation
  - arena-client
  - research
related:
  - design-system-overview.md
  - sound-effects.md
  - music-authoring.md
  - master-strike.md
  - scheme-twist.md
  - turn-system.md
  - villain-deck.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\visual-effects.md (this page — https://ewiki.legendary-arena.com/visual-effects/)
  - ../packages/game-engine/src/events/notableEvents.types.ts
  - ../packages/game-engine/src/events/notableEvents.compose.ts
  - ../packages/game-engine/src/ui/uiState.types.ts
  - ../packages/game-engine/src/ui/uiState.build.ts
  - ../packages/game-engine/src/moves/coreMoves.impl.ts
  - ../packages/game-engine/src/endgame/endgame.types.ts
  - ../apps/arena-client/src/composables/useComboCue.ts
  - ../apps/arena-client/src/composables/useNotableEventStream.ts
  - ../apps/arena-client/src/components/play/NotableEventOverlay.vue
  - ../apps/arena-client/src/pages/PlayViewport.vue
  - ../docs/ai/ARCHITECTURE.md
last-reviewed: 2026-07-22
---

# Visual Effects Framework

## Summary

This page is the **design reference** for the in-game "juice" layer on
`play.legendary-arena.com` — the visual half of the sensory feedback
system whose audio half is specced on
[Sound Effects](sound-effects.md). It catalogs the escalating flashes,
particle bursts, screen-shakes, and card-motion cues that should fire
when the game does something worth celebrating: a Master Strike lands, a
villain is defeated, a bystander is rescued, and — the flagship case —
when one card's effect **chains** into another and another, so a bigger
synergy chain literally *looks* bigger.

The whole framework hangs off the **same shared trigger spine** the
audio layer uses (the canonical event vocabulary catalogued on the
[Design System Overview](design-system-overview.md#shared-trigger-spine)).
That is deliberate: a Master Strike firing a red vignette *and* a
dramatic sting are two reactions to the one `mastermindStrikeResolved`
event, so the visual and audio pages cross-reference through the engine's
own vocabulary rather than through a hand-maintained index. That is what
keeps this layer from siloing away from the audio, dopamine, and
narrative work.

**The chain-reaction "combo flash" is buildable today.** When
[Sound Effects](sound-effects.md#tiered-combo) was written it flagged the
tiered combo cue as *"a proposal, not buildable"* — nothing projected a
chain-depth count to the client. That gap is now **closed**: the engine
projects `UIState.game.lastPlayEffectsFired` (D-24221, WP-409), and the
audio combo cue already consumes it (D-24228, WP-413). The visual combo
flash mirrors that shipped audio composable exactly — same scalar, same
tier map, different output. That note on the Sound Effects page is
superseded for the visual layer.

No VFX ships today — this page is `draft` research, not an implementation
contract. The effect mappings and library picks are proposals; only the
event vocabulary, the projected `UIState` signals, the shipped audio
precedent, and the architectural boundaries are sourced to code.

## Mechanics

### The trigger surface

Visual effects are a **client-side presentation concern**, exactly like
audio. They can only react to what the client actually receives — fields
on the projected `UIState` — **not** engine-internal `G` and **not** the
game log. `G.messages` is *not* projected to clients, so any effect built
on the log would work in the engine and silently do nothing in the
browser. The candidate signals, in decreasing order of readiness:

#### Surface 1 — Notable events (the primary, ready-made hook)

`NotableGameEvent` is the engine's append-only record of high-level
player-visible outcomes. Six variants are locked, and — unlike the game
log — they **are** projected as `UIState.notableEvents`. The arena client
already streams them through
[`useNotableEventStream.ts`](../apps/arena-client/src/composables/useNotableEventStream.ts)
and renders them in
[`NotableEventOverlay.vue`](../apps/arena-client/src/components/play/NotableEventOverlay.vue)
— which is, today, the **only** real visual effect in the whole client (a
single opacity-scale fade transition). A juice layer rides this exact
stream — one effect per event type — with zero new engine work.

| Event (`NotableGameEventType`) | Fires when | Suggested visual character |
|---|---|---|
| `mastermindStrikeResolved` | A Mastermind Strike card is revealed and resolved | **Screen-shake** + red edge-vignette pulse + dark shard particles — the signature "uh-oh" jolt |
| `schemeTwistResolved` | A Scheme Twist is revealed and resolved | A darker, subtler **desaturation ripple** radiating from the scheme tile; less violent than a Strike |
| `ambushResolved` | A villain with an `Ambush:` marker enters the City | Menacing **edge-glow** + a hard card-slam settle as the villain drops into its City space |
| `fightResolved` | A player defeats a villain or henchman in the City | **Impact burst** at the card's City space; a coin/star flourish layered on when `bystandersRescued > 0` |
| `mastermindDefeated` | All tactics defeated — the Mastermind is vanquished (win) | The biggest positive payoff: a full-screen **victory bloom** + confetti storm |
| `healResolved` | A player uses the Wound Healing ability | Soft green **restorative shimmer** rising off the hand |

#### Surface 1b — Sub-effects inside a fight or ambush (`appliedEffects`)

`FightResolvedEvent` and `AmbushResolvedEvent` each carry
`appliedEffects: VillainEffectKeyword[]` (the villain-effect keywords
that actually fired, in dispatch order) and a human-readable `narrative`.
That lets the juice layer play **finer, themed flashes nested inside** a
fight/ambush without any new engine event — the burst can take the colour
of the mechanic that fired.

| Game moment | Client signal | Suggested visual |
|---|---|---|
| **Wound gained** | `appliedEffects` contains `gainWoundEachPlayer` / `gainWoundCurrentPlayer`; also a delta on `UIState.players[id].woundCount`; scheme wounds show as `schemeTwistResolved` with `resolverKey === 'woundAll'` | A dull red **damage flash** on the afflicted player panel |
| **Hero KO'd** | `appliedEffects` contains `koHeroCurrentPlayer` / `koHeroEachPlayer` / `koHeroEachPlayerMag2`; the KO'd heroes are named in `narrative` | A sharp **shatter / dissolve** on the KO'd card as it slides to the KO pile |
| **Bystander captured** | `appliedEffects` contains `captureBystander` | An ominous **pull-away** — the bystander token yanked toward the villain |
| **Bystander rescued** | `FightResolvedEvent.bystandersRescued > 0` (and `MastermindDefeatedEvent.bystandersRescued`) | A bright **rescue sparkle** / coin arc into the victory pile |

> **Precision limit.** `appliedEffects` carries the **keyword only** — not
> which bystander was captured or how many wounds each player took. A
> keyword is enough to trigger an effect; per-target detail is not
> available without new event fields (see Edge Cases). This is the same
> precision limit the audio layer lives with.

#### Surface 2 — The combo / chain-reaction signal (the flagship, now live) {#combo-signal}

This is the effect Jeff asked for — the Candy-Crush-style cascade where
one play visibly detonates a chain. The engine already computes the chain
size and projects it:

- The `playCard` / `playFromUndercover` move counts how many hero-ability
  effects fired for the just-played card and writes it to
  `G.lastPlayEffectsFired`
  ([`coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)),
  reset to `0` each turn in the play-phase `onBegin`.
- It is projected as `UIState.game.lastPlayEffectsFired`
  ([`uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts))
  and is **observability-only, excluded from the determinism hash**
  (D-24221) — pure presentation, zero engine footprint.
- The audio combo cue already tiers it and the visual layer mirrors that
  tier map one-for-one:

| `lastPlayEffectsFired` | Tier | Suggested visual (ascending intensity) |
|---|---|---|
| `<= 0` | none | No effect (silent play) |
| `1` | small | A brief **spark** at the played card |
| `2` | medium | A larger **burst** — brighter, wider, a satisfying pop |
| `>= 3` | big | A full-screen ascending **flourish** — the game cheering you on |

The tier boundaries are locked to the shipped audio cue
(`comboTierForCount`: `<=0 → none`, `1 → small`, `2 → medium`,
`>=3 → big`; D-24228). Pitch the *visual* intensity to ascend in lockstep
with the audio so a 3-chain's flash and its flourish sting peak together —
that synchrony is most of the "juice."

> **Mirror the shipped composable, don't reinvent it.** The audio side is
> [`useComboCue.ts`](../apps/arena-client/src/composables/useComboCue.ts):
> a scalar-change consumer that keeps its own `lastSeen` value, seeds it
> on the first valid frame (so no effect fires for the pre-mount value),
> and fires once per audible value-change. A `useComboVfx` composable is
> the same shape with a particle burst in place of the clip, mounted at
> the same [`PlayViewport.vue`](../apps/arena-client/src/pages/PlayViewport.vue)
> root beside `useComboCue`.

#### Surface 3 — Player action moves (tactile local feedback)

The client dispatches these moves, so it can fire a small effect on the
local action for immediate tactile feedback, independent of the
authoritative result.

| Action (move) | Fires when | Suggested visual |
|---|---|---|
| `playCard` | A card is played from hand | A card **trail** + a soft place-ripple where it lands |
| `recruitHero` | A hero is recruited from HQ | An HQ-slot **glow** that pulls toward the hand/discard |
| `fightVillain` | A player attacks a City villain | A directional **slash / impact streak** toward the target |
| `drawCards` | Start-of-turn draw / any draw | A quick **deal / fan** motion into the hand |
| `dodgeCard` | Dodge — discard to draw a replacement | A fast card **flick** out and a replacement slide in |
| `endTurn` | The player ends their turn | A soft **sweep** clearing the played row |

> **Recruit has no result event.** `recruitHero` emits no notable event;
> the only signals are the local move dispatch and the resulting
> `UIState.hq` slot / `discardCount` deltas. The move-dispatch hook is the
> simplest place to fire a recruit effect.

#### Surface 4 — Outcome / endgame {#endgame}

[`evaluateEndgame`](../packages/game-engine/src/endgame/endgame.evaluate.ts)
resolves every match to exactly one of **three** outcomes —
`EndgameOutcome` is `'heroes-win' | 'scheme-wins' | 'tie'`. Each deserves
its own full-screen finale:

| Outcome | Triggers (counter) | Finale character |
|---|---|---|
| **`heroes-win`** | `mastermindDefeated` ≥ 1 (also Surface 1's notable event) | The biggest positive moment in the game — **victory bloom + confetti storm + slow-motion hero beat** |
| **`scheme-wins`** | `escapedVillains` ≥ `ESCAPE_LIMIT` (8) — *the city is overrun*; **or** `schemeLoss` ≥ 1 — *the scheme completes* | A dark, **deflating collapse** — desaturate to ash; the two reasons can take distinct treatments (an escape stampede vs. the scheme snapping shut) |
| **`tie`** | `finalTurnTie` ≥ 1 — a deck emptied and the final turn ended with no win or loss (WP-367 / D-24159) | Something **wry and suspended** — a held, unresolved shimmer; neither bloom nor collapse |

> **The tie is real, and deck-exhaustion is *not* a loss.** An emptied
> Hero or Villain deck latches the final turn; if nobody has won or lost
> by its end the match is a first-class **`tie`** (`finalTurnTie`). Give it
> its own suspended finale — don't fold it into the loss collapse. (Same
> note as the audio layer's tie sting.)

### The builder / destroyer narrative lens {#playstyle-lens}

Some players want to *build* — a hero, a team, a rescued city. Others
want the villain power-fantasy — to *overrun* it. The same engine events
can be framed either way without building two games: a preference toggle
picks a **narrative lens** over the identical trigger spine. A
`fightResolved` reads as a heroic rescue in builder mode and a conquest
in destroyer mode — same burst geometry, re-themed palette and copy. This
is where the visual layer, the
[Narrative Psychology Framework](narrative-psychology.md),
and the [Playstyle Modes](narrative-psychology.md#playstyle-modes)
preference converge; the toggle lives in player preferences beside the
reduced-motion control (below). The lens changes *theming*, never the
signal — so it adds zero engine footprint and cannot affect an outcome.

### Where a visual-effects layer would live

VFX belongs entirely in `arena-client` (the Vue app at
`play.legendary-arena.com`). Per
[ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md), the engine owns truth and
the UI consumes read-only projections — so the juice layer reads
`UIState` (notable events, `lastPlayEffectsFired`, progress counters) and
renders effects. It never writes `G`, never influences an outcome, and
adds **zero** engine or determinism footprint. Bot-vs-bot simulations,
replays, and determinism proofs are unaffected because none of them
render.

Concretely, mirroring the shipped audio wiring:

- A `useComboVfx` composable (mirror of
  [`useComboCue.ts`](../apps/arena-client/src/composables/useComboCue.ts))
  watching `UIState.game.lastPlayEffectsFired`, plus a
  `useNotableEventVfx` mirror of the notable-event stream, both mounted at
  the shared [`PlayViewport.vue`](../apps/arena-client/src/pages/PlayViewport.vue)
  root beside their audio siblings.
- A full-bleed overlay layer in
  [`PlayDesktop.vue`](../apps/arena-client/src/pages/PlayDesktop.vue) /
  `PlayMobile.vue`, sitting over the mat the way
  [`NotableEventOverlay.vue`](../apps/arena-client/src/components/play/NotableEventOverlay.vue)
  already does, that hosts the bursts and full-screen finales.

### Library & performance posture (commercial-safe, GPU-cheap first)

There is **no animation library installed today** — the only motion in
the client is one CSS fade on `NotableEventOverlay.vue` and a few hover
`transform` transitions. So the library choice is greenfield. Mirroring
the audio layer's CC0-first licensing posture, the default is
**permissively-licensed (MIT), code-first** VFX rather than heavyweight
dependencies:

- **[`canvas-confetti`](https://github.com/catdad/canvas-confetti)** (MIT)
  — tiny, one-file, purpose-built for celebratory bursts and confetti.
  The natural pick for combo bursts and the win finale.
- **[`tsparticles`](https://github.com/tsparticles/tsparticles)** (MIT) —
  heavier but far more configurable if the particle work grows beyond
  bursts (ambient motes, trails).
- **CSS transitions / [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)**
  (no dependency) — the right tool for card motion, ripples, screen-shake,
  and vignette pulses. Keep these hand-rolled; they're cheap and
  dependency-free.
- **GSAP** — powerful for complex timelines, **but confirm its current
  license before adopting.** GSAP's licensing terms have changed over time;
  do not assume it is free for commercial use — verify against its live
  license page at adoption time and prefer the MIT options above unless a
  timeline genuinely needs it.

**Performance is the VFX analog of the audio layer's "asset weight."** A
web card game runs on phones; unbounded particles will drop frames and
drain batteries. The disciplines:

- Animate **`transform` and `opacity` only** (GPU-composited); avoid
  animating layout properties.
- **Cap concurrent effects** — a burst pool with a hard ceiling, dropping
  the oldest, so a rapid combo storm can't spawn thousands of particles.
- Prefer a **single shared canvas** overlay to many DOM nodes for particle
  work; tear down finished effects.
- **Lazy-load** the particle library so it isn't in the critical
  first-paint path.

## Interactions

- **[Design System Overview](design-system-overview.md).** The parent
  map. Its [Shared Trigger Spine](design-system-overview.md#shared-trigger-spine)
  is the canonical event vocabulary this page reacts to; that shared table
  is the cross-link that ties visual ↔ audio ↔ dopamine ↔ narrative
  together.
- **[Sound Effects](sound-effects.md).** The audio twin. Every effect
  here should be paired with its sibling cue there — a combo *flash* and a
  combo *sting* fire off the one `lastPlayEffectsFired` change and must
  peak together. This page supersedes that page's "tiered combo cue is not
  buildable" note (the signal now exists, D-24221 / D-24228).
- **[Master Strike](master-strike.md).** `mastermindStrikeResolved` is the
  highest-drama visual candidate — the screen-shake moment — and the
  overlay it drives already exists.
- **[Scheme Twist](scheme-twist.md).** `schemeTwistResolved` is the
  sibling darker flash; each twist also advances `scheme.twistCount`, a
  candidate for a rising ambient-menace visual treatment.
- **[Villain Deck](villain-deck.md).** The reveal pipeline produces the
  Ambush, Scheme Twist, and Master Strike events and the escape count — the
  source of most visual triggers.
- **[Turn System](turn-system.md).** Supplies the turn boundaries that gate
  when action-move effects are legal.
- **[Music Authoring](music-authoring.md).** The composed-motif layer; a
  combo flourish written in the acting hero's team key harmonizes with the
  motif that spawned it, so visual timing should align to the motif beat.

## Edge Cases

- **Villain escape has no client signal.** When a villain escapes the City
  it can carry a captured bystander away, but the escape path is
  **log-only** — it emits *no* notable event (deferred `escapeResolved`,
  WP-186 / D-20001). So "a villain broke through" and "a bystander was
  carried off" cannot be shown today without adding that event. This is the
  one dramatic moment with no ready hook — identical to the audio gap.
- **`appliedEffects` is keyword-only.** For wound / KO / bystander-capture
  flashes, the event tells you the *kind* of effect but not the target or
  count. A keyword is enough to fire an effect; anything richer needs new
  event fields. Hero-KO is the exception — the KO'd heroes are named in
  `narrative`.
- **Do not drive effects off the game log.** `G.messages` is **not**
  projected to clients (D-20008). Only `notableEvents` and typed `UIState`
  surfaces reach the browser. Effects built on the log would work in the
  engine and do nothing in production.
- **`lastPlayEffectsFired` is a scalar, not a stream.** It is overwritten
  each play and reset to `0` each turn — so the combo consumer must track
  its own last-seen value and fire on *change* (as `useComboCue` does), not
  treat it as a monotonic counter or an append-only event list.
- **Accessibility is not optional — and does not exist yet.** There is
  **no `prefers-reduced-motion` handling anywhere in the client today.**
  Bake it in from day one: honour the OS reduced-motion setting, expose an
  in-app intensity/off control (localStorage, so it persists), and gate
  screen-shake and full-screen flashes behind it. Juice that can't be
  turned down is an accessibility bug and a nausea/photosensitivity
  complaint waiting to happen — retrofitting it later is the wrong order.
- **Determinism is untouched, and must stay that way.** VFX is pure
  presentation: it must never read into or write out of `G`/`ctx`, never
  affect move validation, and never branch engine logic. The determinism
  invariant is a non-issue precisely because effects stay client-side.
- **Effect weight on mobile.** Particle counts and concurrent animations
  are the perf budget — cap them, pool them, and compose on the GPU (see
  Performance posture).

## Code Touchpoints

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — the six `NotableGameEventType` variants and their payloads
  (`appliedEffects`, `bystandersRescued`, `narrative`, `resolverKey`)
- [`packages/game-engine/src/events/notableEvents.compose.ts`](../packages/game-engine/src/events/notableEvents.compose.ts)
  — where `appliedEffects` keyword labels (wound / KO / capture) are composed
- [`packages/game-engine/src/moves/coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)
  — sets `G.lastPlayEffectsFired` (the combo count) in `applyCardPlay`
- [`packages/game-engine/src/ui/uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts)
  — projects `lastPlayEffectsFired` onto `UIState.game`
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts)
  — `UIState` contract: `notableEvents`, `game.lastPlayEffectsFired`,
  `players[].woundCount`, `progress.escapedVillains`, `scheme.twistCount`
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome`, `ENDGAME_CONDITIONS`, `ESCAPE_LIMIT`
- [`apps/arena-client/src/composables/useComboCue.ts`](../apps/arena-client/src/composables/useComboCue.ts)
  — the shipped audio combo composable to mirror for `useComboVfx`
- [`apps/arena-client/src/composables/useNotableEventStream.ts`](../apps/arena-client/src/composables/useNotableEventStream.ts)
  — existing client stream of notable events; the attach point for
  event-driven effects
- [`apps/arena-client/src/components/play/NotableEventOverlay.vue`](../apps/arena-client/src/components/play/NotableEventOverlay.vue)
  — the existing overlay (and only current effect); the model for the VFX
  overlay layer
- [`apps/arena-client/src/pages/PlayViewport.vue`](../apps/arena-client/src/pages/PlayViewport.vue)
  — the shared composable-mount host where the audio composables live and
  the VFX ones would join

## Open Questions

- **No Work Packet is scoped yet.** This page is pre-design research.
  Implementation would need a WP chain mirroring the audio arc
  (WP-412 foundation → WP-413 combo cue): a VFX foundation + overlay layer,
  a `useComboVfx` combo flash, the notable-event effect set, and the
  reduced-motion / intensity preference UX.
- **Library pick.** `canvas-confetti` (MIT) for bursts + hand-rolled
  CSS/WAAPI for motion is the recommended v1; revisit `tsparticles` only if
  ambient particle work grows. Confirm any GSAP license terms before
  reaching for it.
- **Same three engine gaps the audio layer wants.** (1) `escapeResolved`
  (WP-186) so villain escapes — including a bystander carried off — can be
  shown; (2) a `heroRecruited` signal so recruit doesn't rely on
  delta-watching; (3) richer `appliedEffects` payload (target / count) for
  per-target flashes. All optional; v1 juice proceeds without them.
- **Combo-flash ceiling.** `lastPlayEffectsFired` is unbounded above; the
  tier map caps the *cue* at `>=3 → big`, but decide whether the *visual*
  keeps scaling density past 3 (a 6-chain vs a 3-chain) or hard-caps for
  perf.
- **Builder/destroyer lens scope.** Ship the effects with a single default
  theme first; the [narrative-lens toggle](#playstyle-lens) is a follow-on
  that re-palettes, not a v1 blocker.
- **Playstyle / dopamine / narrative pages.** The sibling frameworks are
  drafted: [Dopamine Trigger Framework](dopamine-triggers.md) and
  [Narrative Psychology Framework](narrative-psychology.md) (which houses
  the [Playstyle Modes](narrative-psychology.md#playstyle-modes) lens).

## References

- [`packages/game-engine/src/events/notableEvents.types.ts`](../packages/game-engine/src/events/notableEvents.types.ts)
  — `NotableGameEventType` (6 locked variants) + payloads; header notes
  `G.messages` is not projected and `escapeResolved` is deferred
- [`packages/game-engine/src/ui/uiState.types.ts`](../packages/game-engine/src/ui/uiState.types.ts),
  [`uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts)
  — `game.lastPlayEffectsFired`, `progress.escapedVillains`,
  `scheme.twistCount`, `players[].woundCount`, `notableEvents`
- [`packages/game-engine/src/moves/coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)
  — the combo count's origin in `applyCardPlay`
- [`packages/game-engine/src/endgame/endgame.types.ts`](../packages/game-engine/src/endgame/endgame.types.ts)
  — `EndgameOutcome` (3 outcomes), `ESCAPE_LIMIT`
- [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) — engine owns truth / UI
  consumes read-only projections; determinism invariant
- [DECISIONS.md](../docs/ai/DECISIONS.md) — D-24221 (`lastPlayEffectsFired`
  as an observability-only, hash-excluded `UIState` signal — the combo
  count), D-24228 (the shipped tiered combo cue: tiers
  `0→none/1→small/2→medium/≥3→big`, scalar-change consumer — the audio
  pattern this page mirrors), D-20001 (minimal notable-event payload;
  deferred `escapeResolved`), D-20008 (`mastermindDefeated` added because
  `G.messages` is not projected), D-24159 / WP-367 (the deck-exhaustion
  final-turn **tie**)
- VFX / animation libraries (confirm each license at adoption):
  - [canvas-confetti](https://github.com/catdad/canvas-confetti) (MIT)
  - [tsparticles](https://github.com/tsparticles/tsparticles) (MIT)
  - [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
    (no dependency)
  - [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
    — the accessibility gate this layer must honour
