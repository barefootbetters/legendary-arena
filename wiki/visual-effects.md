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
  - ../packages/game-engine/src/ui/uiState.filter.ts
  - ../apps/arena-client/src/components/play/CityRow.vue
  - ../apps/arena-client/src/components/play/MastermindTile.vue
  - ../packages/game-engine/src/moves/coreMoves.impl.ts
  - ../packages/game-engine/src/endgame/endgame.types.ts
  - ../apps/arena-client/src/composables/useComboCue.ts
  - ../apps/arena-client/src/composables/useComboVfx.ts
  - ../apps/arena-client/src/composables/useNotableEventStream.ts
  - ../apps/arena-client/src/components/play/NotableEventOverlay.vue
  - ../apps/arena-client/src/components/play/VfxOverlay.vue
  - ../apps/arena-client/src/components/play/AudioControls.vue
  - ../apps/arena-client/src/vfx/comboVfxManifest.ts
  - ../apps/arena-client/src/vfx/effectIntensity.ts
  - ../apps/arena-client/src/pages/PlayViewport.vue
  - ../docs/ai/ARCHITECTURE.md
last-reviewed: 2026-08-16
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

**The chain-reaction "combo flash" now ships (WP-556 / D-24365).** When
[Sound Effects](sound-effects.md#tiered-combo) was written it flagged the
tiered combo cue as *"a proposal, not buildable"* — nothing projected a
chain-depth count to the client. That gap is closed: the engine projects
`UIState.game.lastPlayEffectsFired` (D-24221, WP-409), the audio combo cue
consumes it (D-24228, WP-413), and **the visual combo flash now consumes it
too** — the first juice layer live on the play surface. It mirrors that
shipped audio composable exactly — same scalar, same
[`comboTierForCount`](#combo-tier-contract), different output. That note on
the Sound Effects page is superseded for the visual layer. See the
[shipped callout](#shipped-combo-vfx) below for exactly what landed.

**And the chain gets a name — also shipped.** On top of the flash, WP-556
ships a *Candy-Crush*-style **synergy call-out** — an escalating word that
pops on-screen as the chain grows (**Team-Up! → Unstoppable! → LEGENDARY!**),
the way *Candy Crush* shouts "Sweet! → Tasty! → Delicious! → Divine!" at a
cascade. It is a **second renderer on the one locked combo scalar**, not
a new signal — the word, the burst, and the sting all fire off the same
`lastPlayEffectsFired` change and peak together. This page owns *that a
label renders, keyed to the locked tier*; the wording, the apex rung, and
the announcer voice live on the
[Design System Overview → narrative meaning](design-system-overview.md#narrative-meaning).

**How to read this page.** It separates three document types on purpose:
the [VFX Trigger Contract](#vfx-trigger-contract) below is the **fixed
governance layer** (implemented against, and not free to drift); the
[Mechanics](#mechanics) are **design detail** (the per-event *character* —
which flash, which colour — is proposal-level and free to evolve); and
[Decisions Pending](#decisions-pending) / [Deferred](#deferred) are the
**roadmap**. **One surface has shipped** — the [combo VFX
foundation](#shipped-combo-vfx) (flash + synergy call-out + the
accessibility gate, WP-556); everything else here — notable-event effects,
endgame finales, fight/ambush sub-effects, action-move cues, faction cries
— is still `draft` design against the same contract. The event vocabulary,
the projected `UIState` signals, the shipped audio precedent, the shipped
combo layer, and the architectural boundaries are sourced to code; the
effect character of the unbuilt surfaces is proposal.

## Shipped: the combo VFX foundation (WP-556 / D-24365) {#shipped-combo-vfx}

The first juice layer is **live on `play.legendary-arena.com`** (WP-556,
verified on-surface 2026-08-16 under D-24026). It implements the
[combo signal (Surface 2)](#combo-signal) and its
[synergy call-out](#synergy-callout) against the contract below — and
nothing else on this page yet. What landed:

- **The combo flash** — a `canvas-confetti` burst whose particle count
  scales by tier (`small 40 → medium 90 → big 140 → legendary 200`), off
  the one [`comboTierForCount`](#combo-tier-contract) both renderers share.
- **The synergy call-out word** — **Team-Up! (medium) → Unstoppable! (big)
  → LEGENDARY! (`>= 5`)**. Deliberately **no word at `small`**: a single
  effect flashes but is not named (the
  [contrast-through-restraint](design-system-overview.md#pacing-invariants)
  call, now resolved — the *flash* still starts at `small`, the *word*
  starts at `medium`).
- **An impact pulse (the screen-shake analog)** at the `big` and `legendary`
  tiers only, bounded to the [performance budget](#performance-budget)'s
  ≤ 500 ms.
- **The [accessibility gate](#accessibility-requirements-mandatory), in
  full** — a persisted, **unified Effect-Intensity control** (`full ✨ /
  low ✦ / off ⊘`) in
  [`AudioControls.vue`](../apps/arena-client/src/components/play/AudioControls.vue),
  plus day-one `prefers-reduced-motion` handling. `shouldRender('shake' |
  'particles' | 'word')` is the single gate: `off` renders nothing, `low`
  keeps the word and particles but drops shake, reduced-motion drops shake
  and particles but keeps the word. The **`off`** master also mutes audio,
  so one control silences the whole feel layer.

Where it lives (mirroring the shipped audio wiring):
[`src/vfx/comboVfxManifest.ts`](../apps/arena-client/src/vfx/comboVfxManifest.ts)
(the tier → burst/word/shake table; imports `comboTierForCount`, never
re-derives it),
[`src/vfx/effectIntensity.ts`](../apps/arena-client/src/vfx/effectIntensity.ts)
(the persisted control + `shouldRender`),
[`useComboVfx.ts`](../apps/arena-client/src/composables/useComboVfx.ts) (the
scalar-change consumer, a mirror of `useComboCue`), and
[`VfxOverlay.vue`](../apps/arena-client/src/components/play/VfxOverlay.vue)
(one canvas + one word layer). The overlay and the control mount **once at
[`PlayViewport.vue`](../apps/arena-client/src/pages/PlayViewport.vue)**
beside `<AudioControls>` — a single fixed overlay for both desktop and
mobile, not one per layout.

**Locked by D-24365:** `canvas-confetti@^1.9.3` (MIT, lazy-loaded off the
first-paint path) for bursts, hand-rolled CSS/WAAPI for the word and impact
pulse (no `tsparticles`, no GSAP). The `src/vfx/` layer carries the same
**determinism exemption** the Cloudflare `functions/` subsurface has
(D-24085) — it may use `Math.random` / timers because it never bears on the
replay hash; recorded in
[`02-CODE-CATEGORIES.md §client-app`](../docs/ai/REFERENCE/02-CODE-CATEGORIES.md).

**Not yet shipped** (still `draft` design against this same contract, each a
follow-up WP): the [Surface 1](#surface-1) notable-event effects (Master
Strike, mastermind-defeated, fight), the [Surface 1b](#surface-1b)
fight/ambush sub-effects, the [Surface 3](#surface-3) action-move cues, the
[Surface 4](#endgame) endgame finales, the [faction battle
cries](#faction-cries) (licensing-gated, D-24259), and the
[event-storm coalescing algorithm](#decisions-pending) (not needed until a
second effect class ships).

## VFX Trigger Contract

This section is the **immovable governance layer** of the page. Everything
below it may evolve; this may not without a `DECISIONS.md` entry. A future
Work Packet is judged against this contract, not against the flavor text.

### Critical Invariants

The load-bearing rules, in one place. Everything else on this page is
detail; these eight do not move without a `DECISIONS.md` entry:

1. **VFX is a pure presentation layer** — it renders, it never decides.
2. **VFX consumes projected `UIState` only** — never `G`, never `ctx`.
3. **VFX never affects gameplay outcomes** — no move validation, no engine
   branching.
4. **VFX never participates in determinism** — it is absent from the state
   hash; replays and bot-vs-bot sims render none.
5. **VFX introduces no new timing authority** — the engine already owns
   every event and its ordering.
6. **VFX invents no new gameplay events** — it is a consumer of the shared
   trigger spine, never a producer.
7. **Audio, visual, narrative, and dopamine consume the identical trigger
   vocabulary** — one signal, many renderers (the
   [Shared Trigger Principle](#shared-trigger-principle)).
8. **Combo-tier boundaries are shared across all renderers** — the single
   [`comboTierForCount`](#combo-tier-contract), never a per-renderer copy.

#### Shared Trigger Principle {#shared-trigger-principle}

> **One engine signal. Many renderers.**
>
> The engine owns trigger generation. Audio, visual, narrative, and dopamine
> systems are **consumers** — none may redefine a trigger, retime it, or
> invent a new gameplay event. This is the architectural heart of every
> "juice" system on the site; the rest of this page is written against it
> rather than re-deriving it per effect.

**Trigger Ownership.** The engine is the sole author of the event vocabulary
(the [shared trigger spine](design-system-overview.md#shared-trigger-spine))
and of the combo scalar. A consumer layer reacts; it never generates.

**Shared Renderer Contract.** When more than one sensory system reacts to the
same event, five things MUST be identical across them:

| Property | Must match across renderers |
|---|---|
| Trigger source | the same `UIState` field / event |
| Tier mapping | the one [`comboTierForCount`](#combo-tier-contract) |
| Fire time | the same `UIState` change — they peak together |
| Suppression rules | the same gating (intensity / off) |
| Accessibility gates | the same `prefers-reduced-motion` handling |

Worked examples: combo *sting* + combo *burst* + synergy *call-out*; Master
Strike *sting* + strike *vignette*; heroes-win *music* + heroes-win *finale*.
Each is one engine signal driving several renderers that crest on the same
frame.

### Input surface authority

Every candidate signal, its authority, and whether VFX may read it — an
audit checklist, not an essay. A future implementation is checked against it
row by row:

| Surface | Authority | VFX may read |
|---|---|---|
| `UIState.notableEvents` (seven locked variants) | Engine (projected) | ✅ — [Surface 1](#surface-1) |
| `UIState.game.lastPlayEffectsFired` (combo count) | Engine (projected) | ✅ — [Surface 2](#combo-signal) |
| `UIState` outcome / progress (`EndgameOutcome`, `progress.escapedVillains`, `scheme.twistCount`, `players[].woundCount`) | Engine (projected) | ✅ — [Surface 4](#endgame) |
| `UIState` captured-card display (`city.spaces[].attachedHeroDisplay` / `attachedBystanderCount`, `mastermind.attachedBystanders`) | Engine (projected, WP-505 / D-24311) | ✅ — a persistent **board anchor** for the capture / rescue sub-effects ([Surface 1b](#surface-1b)); board state, not VFX |
| Local move dispatch (`playCard` / `recruitHero` / `fightVillain` / `drawCards` / `dodgeCard` / `endTurn`) | Client | ✅ — [Surface 3](#surface-3) |
| `G` | Engine-internal | ❌ never |
| `ctx` | Engine-internal | ❌ never |
| `G.messages` (game log) | Not projected (D-20008) | ❌ — works in-engine, silently does nothing in the browser |
| Any server round-trip | External | ❌ — VFX derives entirely from already-projected `UIState` |

### Non-Goals — the VFX layer MUST NOT

- modify game state or write to `G` / `ctx`;
- participate in move validation;
- create new authoritative timing or sequencing logic the engine does not
  already own;
- affect replay or determinism (it is excluded from the state hash);
- require server-side processing.

The VFX layer is a **pure consumer of projected `UIState`.** That is the
hard boundary for every future implementer.

### Tier-1 triggers (the required set)

A minimal implementation MUST cover these four — they generate the
majority of player excitement:

- **Combo chains** (`lastPlayEffectsFired`)
- **`mastermindStrikeResolved`**
- **`mastermindDefeated`**
- **`fightResolved`**

The full three-tier prioritization is in [Priority tiers](#priority-tiers).

### Combo Tier Contract {#combo-tier-contract}

The count → tier mapping is **shared with the audio layer and may not
diverge.** It is the shipped `comboTierForCount` (D-24228, extended with the
apex tier by WP-425 / D-24246):

| `lastPlayEffectsFired` | Tier |
|---|---|
| `<= 0` | none (silent) |
| `1` | T1 |
| `2` | T2 |
| `3–4` | T3 |
| `>= 5` | T4 — apex (`legendary` / **LEGENDARY!**) |

- Visual *implementations* of each tier **may** vary (spark / burst /
  flourish are proposals).
- Tier *boundaries* **may not** vary.
- Audio and visual consumers **must** use the identical tier mapping —
  one `comboTierForCount`, two renderers. This is what prevents future
  divergence between the flash and the sting.
- The **apex T4** tier (`>= 5 → legendary`) is locked by **D-24246**: the
  audio sting (`combo-legendary.mp3`) ships with WP-425, and the visual
  **`LEGENDARY!`** call-out consumes the same boundary — **now shipped**
  (WP-556). Three renderers, one mapping.

### Accessibility gate (mandatory — pass/fail) {#accessibility-requirements-mandatory}

No VFX feature may ship unless **all four** hold; acceptance testing MUST
verify each:

- `prefers-reduced-motion` is honoured (OS setting).
- An in-app intensity / off control exists, persisted (localStorage).
- Screen-shake and full-screen flashes are gated behind both.
- Disabled mode preserves full gameplay parity — the layer degrades to
  **no effects**, never a loss of game functionality.

**Shipped (WP-556 / D-24365).** All four now hold for the live combo layer:
`prefers-reduced-motion` is read in
[`effectIntensity.ts`](../apps/arena-client/src/vfx/effectIntensity.ts), the
persisted **unified Effect-Intensity control** (`full / low / off`) lives in
[`AudioControls.vue`](../apps/arena-client/src/components/play/AudioControls.vue),
and the single `shouldRender('shake' | 'particles' | 'word')` gate enforces
the rest — `off` renders nothing (and mutes audio), reduced-motion drops
shake and particles while keeping the word. When this page was first drafted
there was **no `prefers-reduced-motion` handling anywhere in the client**;
WP-556 built it as the day-one gate, so a future notable-event or endgame WP
inherits the control rather than re-adding it.

### Shipped: game-log outcome colours (static, NOT part of the VFX layer) {#game-log-outcome-colours}

The HUD game log colours each line by its engine-authored
`LogEntry.outcome` (WP-B.3, D-24253): **green** = the effect applied,
**amber** = partial, **red** = blocked / did nothing, **unstyled** =
neutral narration. This is deliberately **not** VFX/juice — it is a
**static, information-carrying** colour (no motion, no trigger, no
intensity toggle), so it lives outside this layer's contract and is
always on. It is included here only because it is the poster-child for
this doc's own accessibility rule:

- **Colour is never the only signal.** Each non-`neutral` line also
  carries a decorative glyph (`✓` / `⚠` / `✕`, `aria-hidden`) and a
  screen-reader-only outcome word, so colour-blind and screen-reader
  users get the outcome without seeing colour.
- **Theme-aware, no hard-coded hex** — it maps to the `--color-par-*`
  tokens (which carry light + dark values), reusing the same
  positive / negative semantic tokens as PAR scoring plus a new
  `--color-par-partial` (→ `--la-color-warning`).
- **Static, reduced-motion-safe by construction** — no transition or
  animation; the log is information, not juice.

The outcome is authored by the engine at push time (B.3a), rendered
here (B.3b), and read back by the freeze diagnostic instead of guessing
(B.3c) — see [Play Diagnostics → Effect provenance](play-diagnostics.md).
The plain-text export tags non-`neutral` lines `[applied]` / `[partial]`
/ `[blocked]`.

### Determinism requirements (mandatory)

- VFX reads only projected `UIState`; it never reads into or writes out of
  `G` / `ctx`.
- It never affects move validation or branches engine logic.
- It is absent from the determinism hash — bot-vs-bot sims, replays, and
  determinism proofs render no VFX and are unaffected.

## Mechanics

> **Illustrative Visual Concepts (Non-Normative).** Everything below the
> [contract](#vfx-trigger-contract) — the "suggested visual character"
> columns here and the animated mocks in [Appendix A](#appendix-mocks) —
> demonstrates *possible* visual character only. None of it is a
> requirement. A future implementation may substitute entirely different
> visuals provided it honours the [trigger contract](#vfx-trigger-contract),
> the [accessibility gate](#accessibility-requirements-mandatory), the
> [performance budget](#performance-budget), and event-priority ordering.
> Read the tables and the mock appendix as mood, not spec — the fixed rules
> all live above.

### Priority tiers {#priority-tiers}

Not every trigger earns the same investment, and a Work Packet should
build in this order rather than attempting twenty effects at once:

| Tier | Priority | Triggers |
|---|---|---|
| **1** | Required (the majority of player excitement) | Combo chains (`lastPlayEffectsFired`), `mastermindStrikeResolved`, `mastermindDefeated`, `fightResolved` |
| **2** | Recommended | `ambushResolved`, `schemeTwistResolved`, `healResolved`, `recruitHero`, `drawCards` |
| **3** | Future | Escape effects (blocked on `escapeResolved`; see [Edge Cases](#edge-cases)); narrative-lens variants (see [Future direction](#playstyle-lens)); per-target sub-effect visuals (blocked on richer `appliedEffects`) |

### The trigger surface

Visual effects are a **client-side presentation concern**, exactly like
audio. They can only react to what the client actually receives — fields
on the projected `UIState` — **not** engine-internal `G` and **not** the
game log (per the [contract](#input-surface-authority) above). The
candidate signals, in decreasing order of readiness:

#### Surface 1 — Notable events (the primary, ready-made hook) {#surface-1}

`NotableGameEvent` is the engine's append-only record of high-level
player-visible outcomes. Seven variants are locked, and — unlike the game
log — they **are** projected as `UIState.notableEvents`. The arena client
already streams them through
[`useNotableEventStream.ts`](../apps/arena-client/src/composables/useNotableEventStream.ts)
and renders them in
[`NotableEventOverlay.vue`](../apps/arena-client/src/components/play/NotableEventOverlay.vue)
— which is, today, the **only** real visual effect in the whole client (a
single opacity-scale fade transition). A juice layer rides this exact
stream — one effect per event type — with zero new engine work.

| Event (`NotableGameEventType`) | Priority | Fires when | Suggested visual character (proposal) |
|---|---|---|---|
| `mastermindStrikeResolved` | T1 | A Mastermind Strike card is revealed and resolved | **Screen-shake** + red edge-vignette pulse + dark shard particles — the signature "uh-oh" jolt |
| `mastermindDefeated` | T1 | All tactics defeated — the Mastermind is vanquished (win) | The biggest positive payoff: a full-screen **victory bloom** + confetti storm |
| `fightResolved` | T1 | A player defeats a villain or henchman in the City | **Impact burst** at the card's City space; a coin/star flourish layered on when `bystandersRescued > 0` |
| `ambushResolved` | T2 | A villain with an `Ambush:` marker enters the City | Menacing **edge-glow** + a hard card-slam settle as the villain drops into its City space |
| `schemeTwistResolved` | T2 | A Scheme Twist is revealed and resolved | A darker, subtler **desaturation ripple** radiating from the scheme tile; less violent than a Strike |
| `healResolved` | T2 | A player uses the Wound Healing ability | Soft green **restorative shimmer** rising off the hand |
| `bystanderRevealed` | T2 | A Bystander card is revealed from the villain deck and captured (by the frontmost City villain, or the Mastermind when the City is empty) | A brief **civilian-blue glint** on the captured bystander as it lands on the captor's stack — the "someone's in danger" beat |

*Animated mocks of the six earlier rows — CSS-only, non-normative — are in
[Appendix A.1](#appendix-surface-1).* The `bystanderRevealed` overlay ships
its chip + narrative today (WP-602); its juice-layer character above is a
proposal like the rest.

#### Surface 1b — Sub-effects inside a fight or ambush (`appliedEffects`) {#surface-1b}

`FightResolvedEvent` and `AmbushResolvedEvent` each carry
`appliedEffects: VillainEffectKeyword[]` (the villain-effect keywords
that actually fired, in dispatch order) and a human-readable `narrative`.
That lets the juice layer play **finer, themed flashes nested inside** a
fight/ambush without any new engine event — the burst can take the colour
of the mechanic that fired. This is **Tier 3** fidelity (see the precision
limit below).

| Game moment | Client signal | Suggested visual (proposal) |
|---|---|---|
| **Wound gained** | `appliedEffects` contains `gainWoundEachPlayer` / `gainWoundCurrentPlayer`; also a delta on `UIState.players[id].woundCount`; scheme wounds show as `schemeTwistResolved` with `resolverKey === 'woundAll'` | A dull red **damage flash** on the afflicted player panel |
| **Hero KO'd** | `appliedEffects` contains `koHeroCurrentPlayer` / `koHeroEachPlayer` / `koHeroEachPlayerMag2`; the KO'd heroes are named in `narrative` | A sharp **shatter / dissolve** on the KO'd card as it slides to the KO pile |
| **Bystander captured** | `appliedEffects` contains `captureBystander` | An ominous **pull-away** — the bystander token yanked toward the villain, **landing on the villain's persistent "N captured" badge** (WP-505) |
| **Bystander rescued** | `FightResolvedEvent.bystandersRescued > 0` (and `MastermindDefeatedEvent.bystandersRescued`) | A bright **rescue sparkle** / coin arc into the victory pile, **pulling off the villain / mastermind's captured stack** (WP-505) |

*Animated mocks of the four Tier-3 sub-effects are in
[Appendix A.2](#appendix-surface-1b).*

> **The capture / rescue anchor now exists on the board (WP-505 / D-24311).**
> Until this shipped, captured cards were **not shown at all** — a "pull-away"
> would have animated a token into nothing. The play board now renders captured
> cards **persistently**: **face-up captured Heroes** as card art
> (`city.spaces[].attachedHeroDisplay`) and **face-down captured Bystanders** as
> a **count-only "N captured" badge** (`attachedBystanderCount`, identity hidden
> = face-down), under each city villain **and** the mastermind
> (`mastermind.attachedBystanders`). That persistent display is **board state,
> not VFX** — it is the static destination the capture pull-away flies *to* and
> the source the rescue sparkle pulls *from*, so these two sub-effects finally
> have a real on-board target. Because the count is a live projected field, a
> capture effect can *also* fire on the count ticking up (e.g. `0 → 1`) as a
> secondary trigger — still bounded by the keyword-only precision limit below
> (the badge is a count, so it never reveals *which* bystander).

> **Precision limit.** `appliedEffects` carries the **keyword only** — not
> which bystander was captured or how many wounds each player took. A
> keyword is enough to trigger an effect; per-target detail is not
> available without new event fields (see [Edge Cases](#edge-cases)). This
> is the same precision limit the audio layer lives with.

#### Surface 2 — The combo / chain-reaction signal (the flagship, now live) {#combo-signal}

This is the flagship — the Candy-Crush-style cascade where one play
visibly detonates a chain. The engine already computes the chain size and
projects it:

- The `playCard` / `playFromUndercover` move counts how many hero-ability
  effects fired for the just-played card and writes it to
  `G.lastPlayEffectsFired`
  ([`coreMoves.impl.ts`](../packages/game-engine/src/moves/coreMoves.impl.ts)),
  reset to `0` each turn in the play-phase `onBegin`.
- It is projected as `UIState.game.lastPlayEffectsFired`
  ([`uiState.build.ts`](../packages/game-engine/src/ui/uiState.build.ts))
  and is **observability-only, excluded from the determinism hash**
  (D-24221) — pure presentation, zero engine footprint.

The count → tier boundaries are **fixed by the
[Combo Tier Contract](#combo-tier-contract)** and shared with the audio
layer; only the per-tier visual below is a proposal:

| `lastPlayEffectsFired` | Tier | Suggested visual (proposal) |
|---|---|---|
| `<= 0` | none | No effect (silent play) |
| `1` | T1 | A brief **spark** at the played card |
| `2` | T2 | A larger **burst** |
| `3–4` | T3 | A full-screen ascending **flourish** |
| `>= 5` | T4 | The apex **`LEGENDARY!`** finale — the rarest, biggest flourish (D-24246) |

The count→tier function (`comboTierForCount`, D-24228) is the single
source both renderers consume. Pitch the visual tiers to ascend in
lockstep with the audio so a T3 chain's flash and its flourish sting peak
together — that synchrony is most of the "juice."

*Animated mocks pairing each tier's flash with its escalating call-out are
in [Appendix A.3](#appendix-surface-2) — each tier drawn bigger than the
last, so a bigger chain literally looks bigger.*

> **Mirrored the shipped composable, didn't reinvent it (WP-556).** The
> audio side is
> [`useComboCue.ts`](../apps/arena-client/src/composables/useComboCue.ts):
> a scalar-change consumer that keeps its own `lastSeen` value, seeds it
> on the first valid frame (so no effect fires for the pre-mount value),
> and fires once per audible value-change. The shipped
> [`useComboVfx.ts`](../apps/arena-client/src/composables/useComboVfx.ts) is
> the same shape with a particle burst in place of the clip, mounted at
> the same [`PlayViewport.vue`](../apps/arena-client/src/pages/PlayViewport.vue)
> root beside `useComboCue` — same seed-on-first-frame, same fire-once-per-change.

##### The synergy call-out — a named label per tier {#synergy-callout}

The combo flash above says *"something big happened."* A **named
call-out** — a word that pops on-screen and escalates with the chain, the
way *Candy Crush* announces **"Sweet! → Tasty! → Delicious! → Divine!"**
as a cascade grows — says *"and here is how big."* It is the cheapest way
to turn an anonymous particle burst into a **legible** reward the player
can name, brag about, and chase.

It is a **second renderer on the one locked signal**, not a new one: the
label reads the same `UIState.game.lastPlayEffectsFired` through the same
`comboTierForCount` (D-24228) the flash and the sting already share, so
the word, the burst, and the combo cue all fire off the one scalar change
and **peak together**. The naming and the meaning rationale live on the
[Design System Overview → narrative meaning](design-system-overview.md#narrative-meaning),
and the announcer voice on [Sound Effects](sound-effects.md#arena-announcer)
(the [animated mock of the escalating ladder](#synergy-callout) is shown in
this section, below); this page owns only *that a label renders, keyed to the
locked tier.*

The **shipped** ladder (WP-556) — the tier column is the locked contract;
the words are the shipped default (the deeper rationale is on the
[narrative-meaning reference](design-system-overview.md#narrative-meaning)):

| `lastPlayEffectsFired` | Tier (`comboTierForCount`) | Call-out (shipped) | Feel |
|---|---|---|---|
| `<= 0` | `none` | — (no label) | silent play |
| `1` | `small` | — (flash only, **no word**) | "that worked" |
| `2` | `medium` | **Team-Up!** | "oh — it *linked*" |
| `3–4` | `big` | **Unstoppable!** | "I *built* this" |
| `>= 5` | `legendary` | **LEGENDARY!** | the rare, brag-worthy crescendo |

WP-556 resolved the "does the word announce at `small`?" question by
**starting the word at `medium`**: a single effect flashes but is not named
(the [contrast-through-restraint](design-system-overview.md#pacing-invariants)
call), so the first *named* synergy is a genuine link, not a lone play. The
earlier **Combo!** proposal for `small` was retired with that decision.

![Animated mock of the synergy call-out ladder: the words Combo!, then Team-Up!, then Unstoppable!, then a gold glowing LEGENDARY! each pop on-screen in turn as a hero-ability chain grows, then the sequence loops.](/visual-effects/synergy-callout-ladder.svg "width=62%")

*Illustrative proposal mock of the heroic ladder escalating with the chain — a CSS-only animated SVG (no JavaScript, so it animates on the JS-free wiki) that loops and holds the apex **LEGENDARY!** as a static frame under `prefers-reduced-motion`. The word is the proposal; the tier boundaries are the locked [Combo Tier Contract](#combo-tier-contract). Alternates in the same register: Synergy!, Rally!, Blitz!, Crescendo! The deeper naming rationale lives on the [narrative-meaning reference](design-system-overview.md#narrative-meaning). Animation source: [synergy-callout.py](../ewiki/visual-effects/synergy-callout.py) — regenerate with `python synergy-callout.py`.*

> **The apex rung is now a locked shared tier (WP-425 / D-24246).** *Candy
> Crush*'s "Divine" is a fourth, rarer rung above the top cascade; the
> equivalent here — a **LEGENDARY!** call-out gated on a bigger chain
> (`>= 5`) — added a **fourth boundary** to `comboTierForCount`. Because the
> [Combo Tier Contract](#combo-tier-contract) locks that mapping *and*
> requires the audio and visual renderers to consume the **identical**
> tiers, the 4th rung landed as a `DECISIONS.md` change (D-24246) that adds
> the tier for **both** layers at once — never a visual-only threshold that
> silently diverges from the audio. **What shipped:** WP-425 shipped the
> **audio** side — a `combo-legendary.mp3` sting on the `>= 5` tier — and
> **WP-556 shipped the visual `LEGENDARY!` call-out** off the same locked
> boundary. This resolved the former "combo-scaling-beyond-T3" open question;
> the apex label is where that decision cashed out, now on both layers.

##### Faction battle cries — the identity overlay {#faction-cries}

The render is unchanged — a text label scaled by the combo tier — but the *words* can come from the **acting card's team / hero identity** instead of the generic ladder: **AVENGERS ASSEMBLE!** for an Avengers chain, **HULK SMASH!** when Hulk is the acting hero. The client already holds that identity (the same signal the [team motif](sound-effects.md#motif-cues) reads), so the overlay needs **no new engine field** — **magnitude** (the combo tier, `comboTierForCount`) drives *presentation* (how big the flash, how loud the sting), and **identity** (the acting team/hero) drives the *words*. The two axes are orthogonal, so a cry rides whatever tier fires, from `small` up to the apex.

**Precedence** (most specific wins; the generic ladder guarantees it is never silent):

1. **Character cry** — the acting hero has a signature line of their own.
2. **Team cry** — the acting card's team has one.
3. **Generic ladder** — the [Combo! / Team-Up! / Unstoppable! / LEGENDARY!](#synergy-callout) fallback for any card whose team/hero has no signature cry yet.

The seed set — the most universally recognizable Marvel cries:

| Faction / hero | Battle cry | Granularity |
|---|---|---|
| Avengers | **Avengers Assemble!** | team |
| X-Men | **To me, my X-Men!** | team |
| Thing (Fantastic Four) | **It's Clobberin' Time!** | character |
| Human Torch | **Flame On!** | character |
| Hulk | **Hulk Smash!** | character |
| Spider-Man | **With great power comes great responsibility** | character |
| Thor | **For Asgard!** | character |
| Namor | **Imperius Rex!** | character |
| Luke Cage | **Sweet Christmas!** | character |

The map is **extensible and sparse**: teams and heroes without a cry fall through to the generic ladder, so coverage grows one entry at a time without gaps. (Spider-Man's line is a full sentence, not a shout — at the `small`/`medium` tiers it likely needs a shortened on-screen form; a display-fit call flagged in [Decisions Pending](#decisions-pending).)

> **These cries are licensing-gated — this *is* the IP pass, not a footnote.** Unlike the generic ladder (original superlatives), the battle cries are **verbatim, famous, and several are registered Marvel trademarks** ("Avengers Assemble," "It's Clobberin' Time," "Flame On," and "Hulk Smash" among them). Legendary Arena is a **licensed** Marvel product (royalties to Marvel and Upper Deck), so the cries live inside the same license as the characters — but *catchphrase* usage in on-screen text/VO can be scoped separately from card-likeness rights, so the seed set ships **only after the Marvel / Upper Deck license scope is confirmed to cover it.** The reconciliation framework plus the licensing gate is recorded as **D-24259**. The render is a no-op either way (same label, different string, no new engine field); the gate is **licensing**, not the engine. The voiced version of these cries is the [Arena Announcer](sound-effects.md#arena-announcer) on the audio side.

**Rendering & accessibility.** The call-out is text, so it degrades
better than any particle effect: under `prefers-reduced-motion` (or the
in-app intensity control at its minimum) the **word still shows** — it
just drops its entrance animation (scale-punch / rise) for a plain fade
and never rides the screen-shake. The reward stays legible for a player
who has turned motion off, satisfying the
[accessibility contract](#accessibility-requirements-mandatory) without
losing the information. It renders in the same single overlay layer as
the bursts (no extra canvas — the [performance budget](#performance-budget)
is unchanged) and, like every effect here, is absent from the determinism
hash.

Whether the label should announce at `small` (a single effect is arguably
*not* a synergy — the [reward-psychology reference](design-system-overview.md#reward-psychology) reads `1` as
mere "that worked") or start at `medium` was the last open copy/restraint
call — **resolved by WP-556 in favour of `medium`**: the
[contrast-through-restraint pacing invariant](design-system-overview.md#pacing-invariants)
won, so the *flash* starts at `small` but the *word* starts at `medium`.

#### Surface 3 — Player action moves (tactile local feedback) {#surface-3}

The client dispatches these moves, so it can fire a small effect on the
local action for immediate tactile feedback, independent of the
authoritative result.

| Action (move) | Priority | Fires when | Suggested visual (proposal) |
|---|---|---|---|
| `recruitHero` | T2 | A hero is recruited from HQ | An HQ-slot **glow** that pulls toward the hand/discard |
| `drawCards` | T2 | Start-of-turn draw / any draw | A quick **deal / fan** motion into the hand |
| `playCard` | T2 | A card is played from hand | A card **trail** + a soft place-ripple where it lands |
| `fightVillain` | T2 | A player attacks a City villain | A directional **slash / impact streak** toward the target |
| `dodgeCard` | T3 | Dodge — discard to draw a replacement | A fast card **flick** out and a replacement slide in |
| `endTurn` | T3 | The player ends their turn | A soft **sweep** clearing the played row |

*Animated mocks of the action-move cues (abstract card shapes — the cue is
the motion, not the art) are in [Appendix A.4](#appendix-surface-3).*

> **Recruit has no result event.** `recruitHero` emits no notable event;
> the only signals are the local move dispatch and the resulting
> `UIState.hq` slot / `discardCount` deltas. The move-dispatch hook is the
> simplest place to fire a recruit effect (see
> [Decisions Pending](#decisions-pending) for the optional result event).

#### Surface 4 — Outcome / endgame {#endgame}

[`evaluateEndgame`](../packages/game-engine/src/endgame/endgame.evaluate.ts)
resolves every match to exactly one of **three** outcomes —
`EndgameOutcome` is `'heroes-win' | 'scheme-wins' | 'tie'`. Each deserves
its own full-screen finale:

| Outcome | Triggers (counter) | Finale character (proposal) |
|---|---|---|
| **`heroes-win`** | `mastermindDefeated` ≥ 1 (also Surface 1's T1 notable event) | The biggest positive moment in the game — **victory bloom + confetti storm + slow-motion hero beat** |
| **`scheme-wins`** | `escapedVillains` ≥ `ESCAPE_LIMIT` (8) — *the city is overrun*; **or** `schemeLoss` ≥ 1 — *the scheme completes* | A dark, **deflating collapse** — desaturate to ash; the two reasons can take distinct treatments (an escape stampede vs. the scheme snapping shut) |
| **`tie`** | `finalTurnTie` ≥ 1 — a deck emptied and the final turn ended with no win or loss (WP-367 / D-24159) | Something **wry and suspended** — a held, unresolved shimmer; neither bloom nor collapse |

*Animated mocks of the three full-screen finales are in
[Appendix A.5](#appendix-surface-4).*

> **The tie is real, and deck-exhaustion is *not* a loss.** An emptied
> Hero or Villain deck latches the final turn; if nobody has won or lost
> by its end the match is a first-class **`tie`** (`finalTurnTie`). Give it
> its own suspended finale — don't fold it into the loss collapse. (Same
> note as the audio layer's tie sting.)

### Future direction — alternate thematic presentations {#playstyle-lens}

The VFX trigger spine is **compatible with alternate thematic
presentations**: a future player-preference system could re-theme effects
(palette, copy, which side's beats are celebrated) **without changing
trigger semantics** — same events, same tier boundaries, same determinism
posture. The builder-versus-destroyer "narrative lens" (some players want
to *build* a rescued city; others want the villain power-fantasy of
overrunning it) is the worked example, and its design rationale lives on
the [Design System Overview → playstyle modes](design-system-overview.md#playstyle-modes),
not here. It is explicitly **Tier 3 / out of scope for v1** (see
[Priority tiers](#priority-tiers)); the v1 layer ships a single default
theme.

### Where the visual-effects layer lives

VFX belongs entirely in `arena-client` (the Vue app at
`play.legendary-arena.com`). Per
[ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md), the engine owns truth and
the UI consumes read-only projections — so the juice layer reads
`UIState` and renders effects, within the [contract](#vfx-trigger-contract)
above. The shipped combo layer (WP-556) wires it this way:

- [`useComboVfx.ts`](../apps/arena-client/src/composables/useComboVfx.ts)
  (mirror of
  [`useComboCue.ts`](../apps/arena-client/src/composables/useComboCue.ts))
  watches `UIState.game.lastPlayEffectsFired`, mounted at the shared
  [`PlayViewport.vue`](../apps/arena-client/src/pages/PlayViewport.vue)
  root beside its audio sibling. A future `useNotableEventVfx` mirror of the
  notable-event stream joins it there.
- **One** full-bleed overlay —
  [`VfxOverlay.vue`](../apps/arena-client/src/components/play/VfxOverlay.vue)
  (the single overlay canvas of the
  [performance budget](#performance-budget)) — mounted **once at
  `PlayViewport.vue`**, above both the desktop and mobile mats. WP-556's
  execution corrected the original draft plan (a copy in each of
  `PlayDesktop.vue` / `PlayMobile.vue`): a single fixed overlay at the shared
  root, the same precedent `<AudioControls>` follows, is simpler and closes
  the "no overlay on mobile" gap the per-layout plan risked.

### Library posture (commercial-safe, GPU-cheap first) {#library-posture}

**Resolved (WP-556 / D-24365): `canvas-confetti` for bursts, hand-rolled
CSS/WAAPI for everything else.** Before WP-556 there was no animation
library at all — just one CSS fade on `NotableEventOverlay.vue` and a few
hover `transform` transitions. Mirroring the audio layer's CC0-first
licensing posture, the pick is **permissively-licensed (MIT), code-first**
VFX rather than heavyweight dependencies:

- **[`canvas-confetti`](https://github.com/catdad/canvas-confetti)** (MIT,
  now installed at `^1.9.3`, lazy-loaded off the first-paint path) — tiny,
  one-file, purpose-built for celebratory bursts and confetti. It drives the
  shipped combo bursts and is the natural pick for the win finale.
- **[`tsparticles`](https://github.com/tsparticles/tsparticles)** (MIT) —
  heavier but far more configurable if the particle work grows beyond
  bursts (ambient motes, trails).
- **CSS transitions / [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)**
  (no dependency) — the right tool for card motion, ripples, screen-shake,
  and vignette pulses. Keep these hand-rolled; they're cheap and
  dependency-free. The [Surface-1 mocks above](#surface-1) are built exactly
  this way — hand-rolled CSS keyframes, no library — and are proof the
  approach covers shakes, vignettes, bursts, drops, ripples, and full-screen
  blooms without a dependency (they animate as plain `<img>` SVGs, which is
  also why they render on this JS-free wiki).
- **GSAP** — powerful for complex timelines, **but confirm its current
  license before adopting.** GSAP's licensing terms have changed over time;
  do not assume it is free for commercial use — verify against its live
  license page at adoption time and prefer the MIT options above unless a
  timeline genuinely needs it.

### Performance budget (hard constraints) {#performance-budget}

Performance is the VFX analog of the audio layer's "asset weight." Without
numbers, "performant" is subjective — so the budget is fixed here and a
Work Packet must hold to it. The exact figures may be retuned via a
`DECISIONS.md` entry against real hardware, but a budget must exist:

| Constraint | Budget |
|---|---|
| Frame rate — desktop | 60 FPS sustained |
| Frame rate — modern mobile | 60 FPS sustained |
| Maximum concurrent particles | 200 |
| Maximum simultaneous bursts | 5 |
| Maximum screen-shake duration | 500 ms |
| Overlay canvas count | 1 |

Holding the budget (the disciplines):

- Animate **`transform` and `opacity` only** (GPU-composited); never
  layout properties.
- **Pool effects with a hard ceiling** — drop the oldest when the particle
  or burst cap is hit, so a rapid combo storm can't blow the budget.
- Use the **single shared overlay canvas** (budget: 1) for particle work;
  tear down finished effects.
- **Lazy-load** the particle library off the first-paint path.

**Performance Invariant.** When an effect would exceed the budget, the
priority order is fixed and non-negotiable:

1. **Retain gameplay** — the mat, inputs, and `UIState` rendering always win.
2. **Drop visual fidelity** — shed particles / bursts before anything else.
3. **Never stall rendering** — VFX yields the frame; it never blocks it.
4. **Never queue a backlog** — drop overflow effects; do not defer them into
   a later storm (see [Multiplayer event storms](#edge-cases)).

## Interactions

- **[Design System Overview](design-system-overview.md).** The parent
  map. Its [Shared Trigger Spine](design-system-overview.md#shared-trigger-spine)
  is the canonical event vocabulary this page reacts to; that shared table
  is the cross-link that ties visual ↔ audio ↔ dopamine ↔ narrative
  together.
- **[Sound Effects](sound-effects.md).** The audio twin. Every effect
  here should be paired with its sibling cue there — a combo *flash* and a
  combo *sting* fire off the one `lastPlayEffectsFired` change and must
  peak together, using the shared [Combo Tier Contract](#combo-tier-contract).
  This page supersedes that page's "tiered combo cue is not buildable"
  note (the signal now exists, D-24221 / D-24228). The
  [synergy call-out](#synergy-callout) label pairs with an optional
  **voiced Arena Announcer** (the *Candy Crush* Mr.-Toffee analog) on the
  audio side — see the [announcer persona](sound-effects.md#arena-announcer).
- **[Design System Overview → reward psychology](design-system-overview.md#reward-psychology).** The *why and when*
  behind these effects; its
  [visual–audio pairing table](design-system-overview.md#visual-audio-pairing) is
  the shared per-event signature this page and Sound Effects both implement,
  and its [flow-channel map](design-system-overview.md#flow-channel) shows where
  each moment sits across a match.
- **[Master Strike](master-strike.md).** `mastermindStrikeResolved` is the
  highest-drama visual candidate — the Tier-1 screen-shake moment — and the
  overlay it drives already exists.
- **[Scheme Twist](scheme-twist.md).** `schemeTwistResolved` is the
  sibling darker flash; each twist also advances the engine's loss-progress
  counter, which the shipped **Danger Meter** reads via
  `UIState.progress.menace` (WP-558).
- **[Villain Deck](villain-deck.md).** The reveal pipeline produces the
  Ambush, Scheme Twist, and Master Strike events and the escape count — the
  source of most visual triggers.
- **[Turn System](turn-system.md).** Supplies the turn boundaries that gate
  when action-move effects are legal.
- **[Music Authoring](music-authoring.md).** The composed-motif layer; a
  combo flourish written in the acting hero's team key harmonizes with the
  motif that spawned it, so visual timing should align to the motif beat.

## Edge Cases

- **Multiplayer event storms — governed by the shared contract.** Several
  notable events can arrive in a single `UIState` update (e.g.
  `fightResolved` + `fightResolved` + `mastermindStrikeResolved` + a T4
  combo, all at once); without a policy they stack into an unreadable,
  budget-blowing pile-up. This is **not** a per-page edge case — it is the
  shared [Event priority & coalescing contract](design-system-overview.md#event-priority)
  on the hub (priority follows the tiers, one crescendo per resolved move,
  the visual and audio layers reach the *identical* decision, and overflow is
  dropped not queued). The VFX layer implements that contract; it is the
  multiplayer corollary of the [Performance Invariant](#performance-budget)'s
  "never queue a backlog." The concrete merge/sequence algorithm is the one
  open piece — see [Decisions Pending](#decisions-pending).
- **Villain escape has no client signal.** When a villain escapes the City
  it can carry a captured bystander away, but the escape path is
  **log-only** — it emits *no* notable event (deferred `escapeResolved`,
  WP-186 / D-20001). So "a villain broke through" and "a bystander was
  carried off" cannot be shown today without adding that event. (Since WP-505
  the villain's captured-card stack is now **visible** on the board, so it
  *disappears* when the villain escapes — a real board change the player can
  see — but there is still no notable *event* to hang a dramatic escape flash
  on.) This is the one dramatic moment with no ready hook — identical to the
  audio gap, and the reason escape effects are Tier 3.
- **`appliedEffects` is keyword-only.** For wound / KO / bystander-capture
  flashes, the event tells you the *kind* of effect but not the target or
  count. A keyword is enough to fire an effect; anything richer needs new
  event fields. Hero-KO is the exception — the KO'd heroes are named in
  `narrative`.
- **Do not drive effects off the game log.** `G.messages` is **not**
  projected to clients (D-20008). Only `notableEvents` and typed `UIState`
  surfaces reach the browser. Effects built on the log would work in the
  engine and do nothing in production. (Restated as a hard rule in the
  [contract](#input-surface-authority).)
- **`lastPlayEffectsFired` is a scalar, not a stream.** It is overwritten
  each play and reset to `0` each turn — so the combo consumer must track
  its own last-seen value and fire on *change* (as `useComboCue` does), not
  treat it as a monotonic counter or an append-only event list. This is why
  the [Acceptance Criteria](#acceptance-criteria) require correct behaviour
  across a reconnect / full `UIState` refresh.
- **Accessibility is not optional — and now exists (WP-556).** The
  [contract](#accessibility-requirements-mandatory) made it a day-one
  requirement, and WP-556 built it: `prefers-reduced-motion` handling plus a
  persisted unified Effect-Intensity control, gated through one
  `shouldRender('shake' | 'particles' | 'word')` seam that every future
  effect class inherits. Juice that can't be turned down is an accessibility
  bug and a nausea/photosensitivity complaint waiting to happen — so the
  gate ships *before* the effects that ride it.
- **Determinism is untouched, and must stay that way.** Restated from the
  [contract](#determinism-requirements-mandatory): VFX is pure
  presentation; it never reads into or writes out of `G`/`ctx`, never
  affects move validation, and never branches engine logic.

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
  — the shipped audio combo composable that `useComboVfx` mirrors
- [`apps/arena-client/src/composables/useComboVfx.ts`](../apps/arena-client/src/composables/useComboVfx.ts)
  — **shipped (WP-556):** the visual combo consumer, scalar-change on
  `lastPlayEffectsFired`
- [`apps/arena-client/src/vfx/comboVfxManifest.ts`](../apps/arena-client/src/vfx/comboVfxManifest.ts)
  — **shipped (WP-556):** the tier → burst/word/shake table; imports
  `comboTierForCount`, never re-derives it
- [`apps/arena-client/src/vfx/effectIntensity.ts`](../apps/arena-client/src/vfx/effectIntensity.ts)
  — **shipped (WP-556):** the persisted unified Effect-Intensity control +
  `prefers-reduced-motion` + `shouldRender`
- [`apps/arena-client/src/components/play/VfxOverlay.vue`](../apps/arena-client/src/components/play/VfxOverlay.vue)
  — **shipped (WP-556):** the single overlay canvas + call-out word layer
- [`apps/arena-client/src/components/play/AudioControls.vue`](../apps/arena-client/src/components/play/AudioControls.vue)
  — **shipped (WP-556):** hosts the unified Effect-Intensity control (its
  `off` also mutes audio)
- [`apps/arena-client/src/composables/useNotableEventStream.ts`](../apps/arena-client/src/composables/useNotableEventStream.ts)
  — existing client stream of notable events; the attach point for
  event-driven effects (the next WP)
- [`apps/arena-client/src/components/play/NotableEventOverlay.vue`](../apps/arena-client/src/components/play/NotableEventOverlay.vue)
  — the pre-existing overlay; the model the VFX overlay layer followed
- [`apps/arena-client/src/pages/PlayViewport.vue`](../apps/arena-client/src/pages/PlayViewport.vue)
  — the shared composable-mount host where the audio and (now) VFX
  composables live and `VfxOverlay` mounts once

## Acceptance Criteria

**WP-556 shipped the combo-flash foundation** and met the combo-scoped,
accessibility, and determinism criteria below (✅). The **notable-event
Tier-1 set** (▫) is the next WP against this same bar:

- ✅ Combo VFX triggers from `UIState.game.lastPlayEffectsFired`, using the
  locked [Combo Tier Contract](#combo-tier-contract) mapping.
- ▫ Event VFX triggers from `UIState.notableEvents` for the Tier-1 set
  (`mastermindStrikeResolved`, `mastermindDefeated`, `fightResolved`) —
  **not yet built; the next WP.**
- ✅ Effects continue functioning after a reconnect and a full `UIState`
  refresh (no dependence on client history beyond the documented
  scalar-change tracking).
- ✅ Effects do not alter game outcomes — verified by bot-vs-bot determinism
  proofs passing unchanged with the layer mounted.
- ✅ Effects do not participate in determinism hashing.
- ✅ Effects respect `prefers-reduced-motion` and the in-app intensity / off
  control.
- ✅ Effects degrade cleanly to none when disabled — no loss of game
  functionality.
- ✅ Mobile and desktop clients render within the
  [performance budget](#performance-budget) with no functionality loss.

## Decisions Pending

Open choices a Work Packet must resolve (these are questions, not
recommendations), split by the kind of decision so each lands with the
right owner.

### Architecture decisions pending

- **Event-storm coalescing algorithm** — the concrete
  **queue / merge / suppress / replace** rule that satisfies the shared
  [Event priority & coalescing contract](design-system-overview.md#event-priority)
  (the contract itself — priority, one-crescendo, cross-renderer determinism,
  no backlog — is locked on the hub; only the algorithm is unpicked, and it is
  shared with the audio layer).
- **`escapeResolved` event** (WP-186) — required before escape effects
  (Tier 3) are possible.
- **`heroRecruited` result event** — would replace client-side
  delta-watching for the recruit effect.

### Implementation decisions pending

- ~~**Library selection**~~ — **resolved (WP-556 / D-24365):**
  `canvas-confetti@^1.9.3` (MIT) for bursts + hand-rolled CSS/WAAPI for the
  word and impact pulse; no `tsparticles`, no GSAP (see
  [library posture](#library-posture)). A later effect class that genuinely
  needs a timeline engine would reopen this with a `DECISIONS.md` entry.
- **Combo density scaling past T4** — `lastPlayEffectsFired` is unbounded
  above; decide whether the visual keeps scaling particle *density* past the
  apex `>= 5` tier or hard-caps at T4 for the performance budget. (Tier
  *boundaries* stay locked either way.) The **apex `LEGENDARY!` rung itself is
  resolved and shipped:** WP-425 / D-24246 added the fourth shared
  `comboTierForCount` tier (`>= 5 → legendary`) and shipped its audio sting,
  and WP-556 shipped the visual call-out off the same boundary (see
  [synergy call-out](#synergy-callout)). What stays open here is only whether
  particle *density* keeps climbing past `>= 5` or the shipped `200`-particle
  cap is the ceiling. A *fifth* tier would be a further `DECISIONS.md` change
  adding it for both layers at once.
- **Performance-budget figures** — ratify or retune the numbers above
  against real mobile hardware.

### Content decisions pending

- **The synergy call-out label** — the named popup per tier
  ([synergy call-out](#synergy-callout)). The timing question is **resolved
  (WP-556): the word starts at `medium`**, not `small` (the
  [contrast-through-restraint](design-system-overview.md#pacing-invariants)
  call — the *flash* still starts at `small`). What remains open is the
  label *wording* itself: WP-556 shipped **Team-Up! / Unstoppable! /
  LEGENDARY!** as the default, but the copy is owned by the
  [Design System Overview → narrative meaning](design-system-overview.md#narrative-meaning) and gets an
  IP pass with the rest of the narrative copy, which may re-word it.
- **Faction battle cries (identity overlay)** — swapping the generic word
  for the acting team/hero's signature shout
  ([faction cries](#faction-cries)). The render is a
  no-op (same label, different string, no new engine field); the open gate
  is **IP / licensing** — the cries are verbatim Marvel catchphrases, so
  the seed set ships only after the Marvel / Upper Deck license scope is
  confirmed to cover on-screen catchphrase use (**D-24259**). Secondary:
  a display-fit call for long cries (e.g. Spider-Man's full-sentence line
  at the smaller tiers).

## Deferred

Explicitly out of scope for v1:

- **Narrative-lens variants** (builder/destroyer re-theme) — Tier 3; design
  rationale on the [Design System Overview → playstyle modes](design-system-overview.md#playstyle-modes).
> **Shipped (WP-558).** The ambient menace layer left this list: the
> **Danger Meter** now renders on the play surface, driven by the engine's
> projected `UIState.progress.menace` / `menaceTier` (WP-557 / D-24366) —
> **not** by `escapedVillains` / `scheme.twistCount`, which were never a
> correct loss signal and are wrong outright since **D-24317** retired the
> generic escape loss. Unlike every other effect on this page, the meter is
> **information, not decoration**: it always renders, and Effect-Intensity /
> `prefers-reduced-motion` gate only its animation (D-24367 §1).
- **Per-target sub-effect fidelity** — blocked on a richer `appliedEffects`
  payload (target / count).

## Appendix A — Illustrative Visual Mocks (Non-Normative) {#appendix-mocks}

> **None of this is a requirement.** Every clip below is an *illustrative
> proposal mock* of a "suggested visual character" from the
> [Mechanics](#mechanics) tables — it demonstrates *possible* character
> only. A future implementation may substitute entirely different visuals
> provided it honours the [trigger contract](#vfx-trigger-contract), the
> [accessibility gate](#accessibility-requirements-mandatory), the
> [performance budget](#performance-budget), and event-priority ordering.
> The mocks live in this appendix — not inline in the governance sections —
> precisely so the fixed rules read first and the mood-boarding reads last.

Every mock is a hand-built, **CSS-only animated SVG** (no JavaScript, so
they animate on the JS-free wiki) that loops and honours
`prefers-reduced-motion` by holding a single static frame instead of
animating. Sample card art is illustrative only. Generators live under
[`ewiki/visual-effects/`](../ewiki/visual-effects/).

### A.1 — Surface 1: notable events {#appendix-surface-1}

Proposal mocks of the [Surface 1](#surface-1) "suggested visual character"
column, each layered over a themed sample card. (`mastermindDefeated`'s
character is a *full-screen*, card-less finale — a victory bloom + confetti
storm — so its mock is a viewport-scale scene rather than a card overlay;
the same full-screen treatment recurs at [Surface 4](#endgame).)

![Animated mock of mastermindStrikeResolved: a Mastermind card jolts with a screen-shake while a red vignette pulses in from the edges and dark shard particles burst outward, then settles. Loops.](/visual-effects/surface1-mastermind-strike.svg "width=33%")

*`mastermindStrikeResolved` (T1) — **screen-shake + red edge-vignette pulse + dark shard burst**, the signature "uh-oh" jolt. Sample card: Galactus (Mastermind).*

![Animated mock of mastermindDefeated: a full-screen golden victory bloom bursts from the centre with radiating light rays and an expanding shockwave ring, while a storm of colourful confetti falls across the screen. Loops.](/visual-effects/surface1-mastermind-defeated.svg "width=66%")

*`mastermindDefeated` (T1) — a **full-screen victory bloom + confetti storm**, the biggest positive payoff in the game. Card-less: a viewport-scale finale, not a card overlay (mirrors the [Surface 4](#endgame) `heroes-win` treatment).*

![Animated mock of fightResolved: a villain card takes a white-gold impact flash and an expanding shockwave ring at the City space while gold coins arc upward, then settles. Loops.](/visual-effects/surface1-fight-resolved.svg "width=33%")

*`fightResolved` (T1) — **impact burst + shockwave ring** at the City space, with a **gold-coin flourish** for a rescued bystander (`bystandersRescued > 0`). Sample card: Sakaar Imperial Guard Lieutenant Caiera (Villain).*

![Animated mock of ambushResolved: a villain card drops hard into its City space with an impact shake and a dust puff, then a sickly green-and-purple edge-glow pulses menacingly. Loops.](/visual-effects/surface1-ambush-resolved.svg "width=33%")

*`ambushResolved` (T2) — a **hard card-slam** drop-in with an impact shake and dust puff, then a **menacing green edge-glow** as the villain settles. Sample card: Spider-Foes — Green Goblin (Villain).*

![Animated mock of schemeTwistResolved: a Scheme Twist card dims under a slow grey desaturation wash while faint ash-grey rings ripple outward from the centre. Loops.](/visual-effects/surface1-scheme-twist-resolved.svg "width=33%")

*`schemeTwistResolved` (T2) — a slow **desaturation ripple**: a grey wash dims the card while ash-grey rings radiate from the tile — darker and subtler than a Strike. Sample card: Scheme Twist.*

![Animated mock of healResolved: a Wound card glows with a soft green light while green motes rise and fade upward off the card. Loops.](/visual-effects/surface1-heal-resolved.svg "width=33%")

*`healResolved` (T2) — a soft green **restorative shimmer**: a gentle green glow with motes rising off the card. Sample card: Wound.*

*Source: [surface1-effects.py](../ewiki/visual-effects/surface1-effects.py) —
regenerate with `python surface1-effects.py`.*

### A.2 — Surface 1b: fight/ambush sub-effects {#appendix-surface-1b}

Proposal mocks of the [Surface 1b](#surface-1b) `appliedEffects`
sub-effects — **Tier-3 fidelity**; the mocks show the *character*, not
shipped behaviour.

![Animated mock of the wound-gained sub-effect: a Wound card takes a dull red damage flash with a small recoil, pulsing twice then settling. Loops.](/visual-effects/surface1b-wound-gained.svg "width=33%")

*Wound gained (`gainWound*`) — a dull red **damage flash** with a small recoil. Sample card: Bindings (Wound).*

![Animated mock of the hero-KO'd sub-effect: a KO'd hero card cracks with a white flash, breaks into dark shards, and slides down toward the KO pile while dissolving. Loops.](/visual-effects/surface1b-hero-ko.svg "width=33%")

*Hero KO'd (`koHero*`) — a sharp **shatter / dissolve** as the card cracks, breaks into shards, and slides to the KO pile. Sample card: Kree Starforce Demon Druid (Villain).*

![Animated mock of the bystander-captured sub-effect: a captured bystander card is yanked toward the villain, sliding off to the right, shrinking and fading under an ominous dark pull, then resets. Loops.](/visual-effects/surface1b-bystander-captured.svg "width=33%")

*Bystander captured (`captureBystander`) — an ominous **pull-away** as the card is yanked toward the villain under a dark grab. Sample card: Photographer (Bystander).*

![Animated mock of the bystander-rescued sub-effect: a rescued bystander card lifts with a bright golden sparkle burst while twinkles shimmer and gold coins arc up toward the victory pile. Loops.](/visual-effects/surface1b-bystander-rescued.svg "width=33%")

*Bystander rescued (`bystandersRescued > 0`) — a bright **rescue sparkle** with coins arcing to the victory pile. Sample card: Stan Lee (Bystander).*

*Source: [surface1-effects.py](../ewiki/visual-effects/surface1-effects.py)
(same generator as A.1).*

### A.3 — Surface 2: the combo cascade {#appendix-surface-2}

Proposal mocks pairing each [Surface 2](#combo-signal) visual tier with the
[synergy call-out](#synergy-callout) that peaks with it — the burst and the
word fire off the one `lastPlayEffectsFired` change and crest together.
Card-less, and each tier is drawn bigger than the last, so a bigger chain
literally *looks* bigger.

> **These mocks pre-date the shipped ladder.** The T1 mock below pairs the
> `small` burst with a **Combo!** word; WP-556 shipped the `small` tier as a
> **flash with no word** (the word starts at `medium`), so treat the T1
> caption as historical mood. The authoritative ladder is the [shipped
> table](#synergy-callout).

![Animated mock of the tier-1 combo cue: a brief blue spark bursts as the word Combo! pops on-screen, then fades. Loops.](/visual-effects/surface2-combo-spark.svg "width=33%")

*T1 (`1`) — a brief blue **spark** + **Combo!** — "that worked."*

![Animated mock of the tier-2 combo cue: a larger gold burst with an expanding shockwave ring as the word Team-Up! pops, then fades. Loops.](/visual-effects/surface2-combo-burst.svg "width=46%")

*T2 (`2`) — a larger gold **burst** with a shockwave ring + **Team-Up!** — "oh, it *linked*."*

![Animated mock of the tier-3 combo cue: a full-screen golden bloom with rotating rays and ascending streaks of light as the word Unstoppable! pops, then loops.](/visual-effects/surface2-combo-flourish.svg "width=72%")

*T3 (`3–4`) — a full-screen ascending **flourish** + **Unstoppable!** — "I *built* this." The apex **`LEGENDARY!`** rung above it (`>= 5`) is the locked 4th tier (D-24246): WP-425 shipped its audio sting and WP-556 shipped the visual `LEGENDARY!` call-out — see the [call-out note](#synergy-callout).*

*Source: [surface2-combo.py](../ewiki/visual-effects/surface2-combo.py). The
words are the [synergy call-out](#synergy-callout) naming proposal; the tier
boundaries are the locked [Combo Tier Contract](#combo-tier-contract).*

### A.4 — Surface 3: action-move cues {#appendix-surface-3}

Proposal mocks of the [Surface 3](#surface-3) local tactile cues, drawn with
**abstract card shapes** since the cue is the *motion* (pull, deal, slash,
flick), not the art. (`playCard` and `endTurn` aren't mocked.)

![Animated mock of recruitHero: a hero card in an HQ slot glows gold, then is pulled down into the hand, and the cycle repeats. Loops.](/visual-effects/surface3-recruit.svg "width=44%")

*`recruitHero` (T2) — an HQ-slot **glow** that pulls the card down into the hand.*

![Animated mock of drawCards: cards deal one after another off a deck and fan out into a hand at the bottom, then reset. Loops.](/visual-effects/surface3-draw.svg "width=44%")

*`drawCards` (T2) — a quick **deal / fan** off the deck into the hand.*

![Animated mock of fightVillain: a bright slash streak sweeps in from the upper-left and lands on a villain card with an impact burst and recoil, then resets. Loops.](/visual-effects/surface3-fight.svg "width=44%")

*`fightVillain` (T2) — a directional **slash / impact streak** into the target, with a recoil.*

![Animated mock of dodgeCard: the hand card flicks out to the right with a spin while a replacement card slides in from the deck into the slot, then repeats. Loops.](/visual-effects/surface3-dodge.svg "width=44%")

*`dodgeCard` (T3) — a fast card **flick** out and a replacement **slide** in.*

*Source: [surface3-moves.py](../ewiki/visual-effects/surface3-moves.py).*

### A.5 — Surface 4: endgame finales {#appendix-surface-4}

Proposal mocks of the three full-screen, card-less [Surface 4](#endgame)
finales (the `heroes-win` bloom is the finale-scale sibling of the A.1
`mastermindDefeated` mock).

![Animated mock of the heroes-win finale: a full-screen golden victory bloom with rotating rays, a slow light sweep, and a storm of colourful confetti. Loops.](/visual-effects/surface4-heroes-win.svg "width=66%")

*`heroes-win` — a triumphant **victory bloom**: rotating rays, a slow light sweep, and a confetti storm (the game's biggest positive beat).*

![Animated mock of the scheme-wins finale: a grey glow deflates and a ring collapses inward while ash drifts down and a dark vignette closes in. Loops.](/visual-effects/surface4-scheme-wins.svg "width=66%")

*`scheme-wins` — a dark **deflating collapse**: a grey glow deflates and a ring caves inward while ash drifts down and the vignette closes in (desaturating to ash).*

![Animated mock of the tie finale: a warm orb and a cool orb hover in balance, gently see-sawing while a neutral shimmer holds between them, never resolving. Loops.](/visual-effects/surface4-tie.svg "width=66%")

*`tie` — **wry and suspended**: a warm orb and a cool orb hover in balance, gently see-sawing under a neutral shimmer that never resolves — neither bloom nor collapse.*

*Source: [surface4-finales.py](../ewiki/visual-effects/surface4-finales.py).*

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
- [DECISIONS.md](../docs/ai/DECISIONS.md) — **D-24365 / WP-556 / EC-591 (the
  shipped combo VFX foundation: `canvas-confetti` + hand-rolled CSS/WAAPI,
  unified Effect-Intensity control, `src/vfx/` determinism exemption)**,
  D-24221 (`lastPlayEffectsFired` as an observability-only, hash-excluded
  `UIState` signal — the combo count), D-24228 (the shipped tiered combo cue:
  tiers `0→none/1→small/2→medium/≥3→big`, scalar-change consumer — the audio
  pattern this page mirrors), D-24246 (the apex `>= 5 → legendary` tier,
  shared audio + visual), D-24085 (the `functions/` determinism exemption
  D-24365 mirrors), D-20001 (minimal notable-event payload; deferred
  `escapeResolved`), D-20008 (`mastermindDefeated` added because `G.messages`
  is not projected), D-24159 / WP-367 (the deck-exhaustion final-turn
  **tie**)
- VFX / animation libraries (confirm each license at adoption):
  - [canvas-confetti](https://github.com/catdad/canvas-confetti) (MIT)
  - [tsparticles](https://github.com/tsparticles/tsparticles) (MIT)
  - [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
    (no dependency)
  - [MDN — prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
    — the accessibility gate this layer must honour
