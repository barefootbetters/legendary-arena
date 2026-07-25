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
last-reviewed: 2026-07-24
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

**And the chain gets a name.** On top of the flash, this page specs a
*Candy-Crush*-style **synergy call-out** — an escalating word that pops
on-screen as the chain grows (**Combo! → Team-Up! → Unstoppable!**), the
way *Candy Crush* shouts "Sweet! → Tasty! → Delicious! → Divine!" at a
cascade. It is a **second renderer on the one locked combo scalar**, not
a new signal — the word, the burst, and the sting all fire off the same
`lastPlayEffectsFired` change and peak together. This page owns *that a
label renders, keyed to the locked tier*; the wording, the apex rung, and
the announcer voice live on the
[Narrative Psychology Framework → synergy call-outs](narrative-psychology.md#synergy-callouts).

**How to read this page.** It separates three document types on purpose:
the [VFX Trigger Contract](#vfx-trigger-contract) below is the **fixed
governance layer** (a future Work Packet implements against it, and it is
not free to drift); the [Mechanics](#mechanics) are **design detail** (the
per-event *character* — which flash, which colour — is proposal-level and
free to evolve); and [Decisions Pending](#decisions-pending) /
[Deferred](#deferred) are the **roadmap**. No VFX ships today — this page
is `draft` research. Only the event vocabulary, the projected `UIState`
signals, the shipped audio precedent, and the architectural boundaries are
sourced to code; the effect character and library picks are proposals.

## VFX Trigger Contract

This section is the **immovable governance layer** of the page. Everything
below it may evolve; this may not without a `DECISIONS.md` entry. A future
Work Packet is judged against this contract, not against the flavor text.

### Allowed input surfaces

The only signals VFX may read — all already projected onto `UIState`:

- `UIState.notableEvents` — the six locked event variants ([Surface 1](#surface-1)).
- `UIState.game.lastPlayEffectsFired` — the combo chain count ([Surface 2](#combo-signal)).
- **Local move dispatch** — the client's own `playCard` / `recruitHero` /
  `fightVillain` / `drawCards` / `dodgeCard` / `endTurn` ([Surface 3](#surface-3)).
- `UIState` outcome / progress fields — `EndgameOutcome`,
  `progress.escapedVillains`, `scheme.twistCount`, `players[].woundCount`
  ([Surface 4](#endgame)).

### Forbidden input surfaces

- `G` / `ctx` — engine-internal state is never read by VFX.
- `G.messages` — the game log is **not** projected to clients (D-20008);
  any effect built on it works in the engine and silently does nothing in
  the browser.
- **Any server round-trip** — VFX derives entirely from the
  already-projected `UIState`.

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
  audio sting (`combo-legendary.mp3`) ships with WP-425; the visual
  `LEGENDARY!` call-out consumes the same boundary when the VFX layer is built.

### Accessibility requirements (mandatory)

- Honour the OS `prefers-reduced-motion` setting.
- Expose an in-app intensity / off control, persisted (localStorage).
- Screen-shake and full-screen flashes are gated behind both.
- The layer degrades cleanly to **no effects** when disabled — never a
  loss of game functionality.

### Determinism requirements (mandatory)

- VFX reads only projected `UIState`; it never reads into or writes out of
  `G` / `ctx`.
- It never affects move validation or branches engine logic.
- It is absent from the determinism hash — bot-vs-bot sims, replays, and
  determinism proofs render no VFX and are unaffected.

## Mechanics

### Priority tiers {#priority-tiers}

Not every trigger earns the same investment, and a Work Packet should
build in this order rather than attempting twenty effects at once:

**Tier 1 — Required** (the majority of player excitement):

- Combo chains (`lastPlayEffectsFired`)
- `mastermindStrikeResolved`
- `mastermindDefeated`
- `fightResolved`

**Tier 2 — Recommended**:

- `ambushResolved`
- `schemeTwistResolved`
- `healResolved`
- `recruitHero`
- `drawCards`

**Tier 3 — Future**:

- Escape effects (blocked on `escapeResolved`; see [Edge Cases](#edge-cases))
- Narrative-lens variants (see [Future direction](#playstyle-lens))
- Ambient menace layer (`escapedVillains` / `scheme.twistCount` rising)
- Per-target sub-effect visuals (blocked on richer `appliedEffects`)

### The trigger surface

Visual effects are a **client-side presentation concern**, exactly like
audio. They can only react to what the client actually receives — fields
on the projected `UIState` — **not** engine-internal `G` and **not** the
game log (per the [contract](#forbidden-input-surfaces) above). The
candidate signals, in decreasing order of readiness:

#### Surface 1 — Notable events (the primary, ready-made hook) {#surface-1}

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

| Event (`NotableGameEventType`) | Priority | Fires when | Suggested visual character (proposal) |
|---|---|---|---|
| `mastermindStrikeResolved` | T1 | A Mastermind Strike card is revealed and resolved | **Screen-shake** + red edge-vignette pulse + dark shard particles — the signature "uh-oh" jolt |
| `mastermindDefeated` | T1 | All tactics defeated — the Mastermind is vanquished (win) | The biggest positive payoff: a full-screen **victory bloom** + confetti storm |
| `fightResolved` | T1 | A player defeats a villain or henchman in the City | **Impact burst** at the card's City space; a coin/star flourish layered on when `bystandersRescued > 0` |
| `ambushResolved` | T2 | A villain with an `Ambush:` marker enters the City | Menacing **edge-glow** + a hard card-slam settle as the villain drops into its City space |
| `schemeTwistResolved` | T2 | A Scheme Twist is revealed and resolved | A darker, subtler **desaturation ripple** radiating from the scheme tile; less violent than a Strike |
| `healResolved` | T2 | A player uses the Wound Healing ability | Soft green **restorative shimmer** rising off the hand |

**Animated mocks of each row.** The clips below are *illustrative proposal
mocks* of the "suggested visual character" for each Surface-1 event, each
layered over a themed sample card. Every one is a hand-built, CSS-only animated
SVG (no JavaScript, so they animate on the JS-free wiki) that loops and honours
`prefers-reduced-motion` by holding a single static frame instead of animating.
Nothing here ships — the effect *character* is proposal-level, exactly as this
section's intro says. (`mastermindDefeated`'s character is a *full-screen*,
card-less finale — a victory bloom + confetti storm — so its mock below is a
viewport-scale scene rather than a card overlay; the same full-screen treatment
recurs at [Surface 4](#endgame).)

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

*All six are CSS-only animated SVGs; each loops and drops to a static frame
under `prefers-reduced-motion`. Sample card art is illustrative only. Animation
source: [surface1-effects.py](../ewiki/visual-effects/surface1-effects.py) —
regenerate with `python surface1-effects.py`.*

#### Surface 1b — Sub-effects inside a fight or ambush (`appliedEffects`)

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
| **Bystander captured** | `appliedEffects` contains `captureBystander` | An ominous **pull-away** — the bystander token yanked toward the villain |
| **Bystander rescued** | `FightResolvedEvent.bystandersRescued > 0` (and `MastermindDefeatedEvent.bystandersRescued`) | A bright **rescue sparkle** / coin arc into the victory pile |

**Animated mocks of each sub-effect.** The same *illustrative proposal mock*
treatment as the [Surface 1](#surface-1) gallery — CSS-only animated SVGs that
loop and hold a static frame under `prefers-reduced-motion` — for the four
`appliedEffects` sub-effects. These are **Tier-3 fidelity** (see the precision
limit below); the mocks show the *character*, not shipped behaviour.

![Animated mock of the wound-gained sub-effect: a Wound card takes a dull red damage flash with a small recoil, pulsing twice then settling. Loops.](/visual-effects/surface1b-wound-gained.svg "width=33%")

*Wound gained (`gainWound*`) — a dull red **damage flash** with a small recoil. Sample card: Bindings (Wound).*

![Animated mock of the hero-KO'd sub-effect: a KO'd hero card cracks with a white flash, breaks into dark shards, and slides down toward the KO pile while dissolving. Loops.](/visual-effects/surface1b-hero-ko.svg "width=33%")

*Hero KO'd (`koHero*`) — a sharp **shatter / dissolve** as the card cracks, breaks into shards, and slides to the KO pile. Sample card: Kree Starforce Demon Druid (Villain).*

![Animated mock of the bystander-captured sub-effect: a captured bystander card is yanked toward the villain, sliding off to the right, shrinking and fading under an ominous dark pull, then resets. Loops.](/visual-effects/surface1b-bystander-captured.svg "width=33%")

*Bystander captured (`captureBystander`) — an ominous **pull-away** as the card is yanked toward the villain under a dark grab. Sample card: Photographer (Bystander).*

![Animated mock of the bystander-rescued sub-effect: a rescued bystander card lifts with a bright golden sparkle burst while twinkles shimmer and gold coins arc up toward the victory pile. Loops.](/visual-effects/surface1b-bystander-rescued.svg "width=33%")

*Bystander rescued (`bystandersRescued > 0`) — a bright **rescue sparkle** with coins arcing to the victory pile. Sample card: Stan Lee (Bystander).*

*All four are CSS-only animated SVGs (same generator as the Surface-1 gallery:
[surface1-effects.py](../ewiki/visual-effects/surface1-effects.py)); sample card
art is illustrative only.*

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

**Animated mocks — the flash *and* the word, per tier.** These pair each
Surface-2 visual tier with the [synergy call-out](#synergy-callout) that peaks
with it: the burst and the word fire off the one `lastPlayEffectsFired` change
and crest together (the naming ladder lives on the
[Narrative Psychology Framework](narrative-psychology.md#synergy-callouts)).
Card-less, CSS-only, looping, `prefers-reduced-motion`-aware — and each tier is
drawn bigger than the last, so a bigger chain literally *looks* bigger.

![Animated mock of the tier-1 combo cue: a brief blue spark bursts as the word Combo! pops on-screen, then fades. Loops.](/visual-effects/surface2-combo-spark.svg "width=33%")

*T1 (`1`) — a brief blue **spark** + **Combo!** — "that worked."*

![Animated mock of the tier-2 combo cue: a larger gold burst with an expanding shockwave ring as the word Team-Up! pops, then fades. Loops.](/visual-effects/surface2-combo-burst.svg "width=46%")

*T2 (`2`) — a larger gold **burst** with a shockwave ring + **Team-Up!** — "oh, it *linked*."*

![Animated mock of the tier-3 combo cue: a full-screen golden bloom with rotating rays and ascending streaks of light as the word Unstoppable! pops, then loops.](/visual-effects/surface2-combo-flourish.svg "width=72%")

*T3 (`3–4`) — a full-screen ascending **flourish** + **Unstoppable!** — "I *built* this." The apex **`LEGENDARY!`** rung above it (`>= 5`) is the locked 4th tier (D-24246): WP-425 ships its audio sting; the visual finale follows — see the [call-out note](#synergy-callout).*

*Card-less CSS-only animated SVGs; source:
[surface2-combo.py](../ewiki/visual-effects/surface2-combo.py). The words are the
narrative page's proposal; the tier boundaries are the locked
[Combo Tier Contract](#combo-tier-contract).*

> **Mirror the shipped composable, don't reinvent it.** The audio side is
> [`useComboCue.ts`](../apps/arena-client/src/composables/useComboCue.ts):
> a scalar-change consumer that keeps its own `lastSeen` value, seeds it
> on the first valid frame (so no effect fires for the pre-mount value),
> and fires once per audible value-change. A `useComboVfx` composable is
> the same shape with a particle burst in place of the clip, mounted at
> the same [`PlayViewport.vue`](../apps/arena-client/src/pages/PlayViewport.vue)
> root beside `useComboCue`.

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
and **peak together**. The naming, the announcer persona, and the meaning
rationale live on the
[Narrative Psychology Framework → synergy call-outs](narrative-psychology.md#synergy-callouts)
(which carries an [animated mock of the escalating ladder](narrative-psychology.md#synergy-callouts));
this page owns only *that a label renders, keyed to the locked tier.*

The proposed default ladder — the tier column is the locked contract; the
words are a naming proposal owned by the narrative page:

| `lastPlayEffectsFired` | Tier (`comboTierForCount`) | Call-out (proposal) | Feel |
|---|---|---|---|
| `<= 0` | `none` | — (no label) | silent play |
| `1` | `small` | **Combo!** | "that worked" |
| `2` | `medium` | **Team-Up!** | "oh — it *linked*" |
| `3–4` | `big` | **Unstoppable!** | "I *built* this" |
| `>= 5` | `legendary` | **LEGENDARY!** | the rare, brag-worthy crescendo |

> **The apex rung is now a locked shared tier (WP-425 / D-24246).** *Candy
> Crush*'s "Divine" is a fourth, rarer rung above the top cascade; the
> equivalent here — a **LEGENDARY!** call-out gated on a bigger chain
> (`>= 5`) — added a **fourth boundary** to `comboTierForCount`. Because the
> [Combo Tier Contract](#combo-tier-contract) locks that mapping *and*
> requires the audio and visual renderers to consume the **identical**
> tiers, the 4th rung landed as a `DECISIONS.md` change (D-24246) that adds
> the tier for **both** layers at once — never a visual-only threshold that
> silently diverges from the audio. **What shipped:** WP-425 ships the
> **audio** side now — a `combo-legendary.mp3` sting on the `>= 5` tier. The
> **visual** `LEGENDARY!` call-out is the future consumer of the same locked
> boundary (it renders when the VFX layer is built). This resolved the
> former "combo-scaling-beyond-T3" open question; the apex label is where
> that decision cashed out.

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
*not* a synergy — the [dopamine page](dopamine-triggers.md) reads `1` as
mere "that worked") or start at `medium` is a copy/restraint
call flagged in [Decisions Pending](#decisions-pending); the
[contrast-through-restraint pacing invariant](dopamine-triggers.md#dopamine-contract)
argues for starting the *word* at `medium` even though the *flash* starts
at `small`.

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

**Animated mocks of the action moves.** Local tactile cues for four moves —
same CSS-only, looping, `prefers-reduced-motion`-aware treatment as the other
galleries, but drawn with **abstract card shapes** since the cue is the *motion*
(pull, deal, slash, flick), not the art. Proposal-level. (`playCard` and
`endTurn` aren't mocked here.)

![Animated mock of recruitHero: a hero card in an HQ slot glows gold, then is pulled down into the hand, and the cycle repeats. Loops.](/visual-effects/surface3-recruit.svg "width=44%")

*`recruitHero` (T2) — an HQ-slot **glow** that pulls the card down into the hand.*

![Animated mock of drawCards: cards deal one after another off a deck and fan out into a hand at the bottom, then reset. Loops.](/visual-effects/surface3-draw.svg "width=44%")

*`drawCards` (T2) — a quick **deal / fan** off the deck into the hand.*

![Animated mock of fightVillain: a bright slash streak sweeps in from the upper-left and lands on a villain card with an impact burst and recoil, then resets. Loops.](/visual-effects/surface3-fight.svg "width=44%")

*`fightVillain` (T2) — a directional **slash / impact streak** into the target, with a recoil.*

![Animated mock of dodgeCard: the hand card flicks out to the right with a spin while a replacement card slides in from the deck into the slot, then repeats. Loops.](/visual-effects/surface3-dodge.svg "width=44%")

*`dodgeCard` (T3) — a fast card **flick** out and a replacement **slide** in.*

*Card-less CSS-only animated SVGs (abstract card shapes); source:
[surface3-moves.py](../ewiki/visual-effects/surface3-moves.py).*

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

**Animated mocks of the three finales.** Full-screen, card-less endgame moments
— same CSS-only, looping, `prefers-reduced-motion`-aware treatment as the other
galleries. Proposal-level (the `heroes-win` bloom is the finale-scale sibling of
the Surface-1 [`mastermindDefeated`](#surface-1) mock).

![Animated mock of the heroes-win finale: a full-screen golden victory bloom with rotating rays, a slow light sweep, and a storm of colourful confetti. Loops.](/visual-effects/surface4-heroes-win.svg "width=66%")

*`heroes-win` — a triumphant **victory bloom**: rotating rays, a slow light sweep, and a confetti storm (the game's biggest positive beat).*

![Animated mock of the scheme-wins finale: a grey glow deflates and a ring collapses inward while ash drifts down and a dark vignette closes in. Loops.](/visual-effects/surface4-scheme-wins.svg "width=66%")

*`scheme-wins` — a dark **deflating collapse**: a grey glow deflates and a ring caves inward while ash drifts down and the vignette closes in (desaturating to ash).*

![Animated mock of the tie finale: a warm orb and a cool orb hover in balance, gently see-sawing while a neutral shimmer holds between them, never resolving. Loops.](/visual-effects/surface4-tie.svg "width=66%")

*`tie` — **wry and suspended**: a warm orb and a cool orb hover in balance, gently see-sawing under a neutral shimmer that never resolves — neither bloom nor collapse.*

*Card-less CSS-only animated SVGs; source:
[surface4-finales.py](../ewiki/visual-effects/surface4-finales.py).*

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
the [Narrative Psychology Framework](narrative-psychology.md#playstyle-modes),
not here. It is explicitly **Tier 3 / out of scope for v1** (see
[Priority tiers](#priority-tiers)); the v1 layer ships a single default
theme.

### Where a visual-effects layer would live

VFX belongs entirely in `arena-client` (the Vue app at
`play.legendary-arena.com`). Per
[ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md), the engine owns truth and
the UI consumes read-only projections — so the juice layer reads
`UIState` and renders effects, within the [contract](#vfx-trigger-contract)
above. Concretely, mirroring the shipped audio wiring:

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
  already does, that hosts the bursts and full-screen finales (the single
  overlay canvas of the [performance budget](#performance-budget)).

### Library posture (commercial-safe, GPU-cheap first) {#library-posture}

There is **no animation library installed today** — the only motion in
the client is one CSS fade on `NotableEventOverlay.vue` and a few hover
`transform` transitions. So the library choice is greenfield (and open —
see [Decisions Pending](#decisions-pending)). Mirroring the audio layer's
CC0-first licensing posture, the default lean is **permissively-licensed
(MIT), code-first** VFX rather than heavyweight dependencies:

- **[`canvas-confetti`](https://github.com/catdad/canvas-confetti)** (MIT)
  — tiny, one-file, purpose-built for celebratory bursts and confetti.
  The natural pick for combo bursts and the win finale.
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
  audio side — see the [announcer persona](narrative-psychology.md#arena-announcer).
- **[Dopamine Trigger Framework](dopamine-triggers.md).** The *why and when*
  behind these effects; its
  [visual–audio pairing table](dopamine-triggers.md#visual-audio-pairing) is
  the shared per-event signature this page and Sound Effects both implement,
  and its [flow-channel map](dopamine-triggers.md#flow-channel) shows where
  each moment sits across a match.
- **[Master Strike](master-strike.md).** `mastermindStrikeResolved` is the
  highest-drama visual candidate — the Tier-1 screen-shake moment — and the
  overlay it drives already exists.
- **[Scheme Twist](scheme-twist.md).** `schemeTwistResolved` is the
  sibling darker flash; each twist also advances `scheme.twistCount`, a
  candidate for the Tier-3 ambient-menace layer.
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
  one dramatic moment with no ready hook — identical to the audio gap, and
  the reason escape effects are Tier 3.
- **`appliedEffects` is keyword-only.** For wound / KO / bystander-capture
  flashes, the event tells you the *kind* of effect but not the target or
  count. A keyword is enough to fire an effect; anything richer needs new
  event fields. Hero-KO is the exception — the KO'd heroes are named in
  `narrative`.
- **Do not drive effects off the game log.** `G.messages` is **not**
  projected to clients (D-20008). Only `notableEvents` and typed `UIState`
  surfaces reach the browser. Effects built on the log would work in the
  engine and do nothing in production. (Restated as a hard rule in the
  [contract](#forbidden-input-surfaces).)
- **`lastPlayEffectsFired` is a scalar, not a stream.** It is overwritten
  each play and reset to `0` each turn — so the combo consumer must track
  its own last-seen value and fire on *change* (as `useComboCue` does), not
  treat it as a monotonic counter or an append-only event list. This is why
  the [Acceptance Criteria](#acceptance-criteria) require correct behaviour
  across a reconnect / full `UIState` refresh.
- **Accessibility is not optional — and does not exist yet.** There is
  **no `prefers-reduced-motion` handling anywhere in the client today.**
  The [contract](#accessibility-requirements-mandatory) makes it a day-one
  requirement, not a retrofit. Juice that can't be turned down is an
  accessibility bug and a nausea/photosensitivity complaint waiting to
  happen.
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

## Acceptance Criteria

No Work Packet is scoped yet; when one is, a VFX **foundation** is complete
when all of the following hold (each objectively checkable):

- Combo VFX triggers from `UIState.game.lastPlayEffectsFired`, using the
  locked [Combo Tier Contract](#combo-tier-contract) mapping.
- Event VFX triggers from `UIState.notableEvents` for the Tier-1 set
  (`mastermindStrikeResolved`, `mastermindDefeated`, `fightResolved`).
- Effects continue functioning after a reconnect and a full `UIState`
  refresh (no dependence on client history beyond the documented
  scalar-change tracking).
- Effects do not alter game outcomes — verified by bot-vs-bot determinism
  proofs passing unchanged with the layer mounted.
- Effects do not participate in determinism hashing.
- Effects respect `prefers-reduced-motion` and the in-app intensity / off
  control.
- Effects degrade cleanly to none when disabled — no loss of game
  functionality.
- Mobile and desktop clients render within the
  [performance budget](#performance-budget) with no functionality loss.

## Decisions Pending

Open choices a Work Packet must resolve (these are questions, not
recommendations):

- **Library selection** — `canvas-confetti` vs `tsparticles` vs hand-rolled
  CSS/WAAPI per effect class (the [posture](#library-posture)
  leans MIT-first; the pick is not yet locked). Confirm GSAP's current
  license if it is considered.
- **Combo density scaling past T4** — `lastPlayEffectsFired` is unbounded
  above; decide whether the visual keeps scaling particle *density* past the
  apex `>= 5` tier or hard-caps at T4 for the performance budget. (Tier
  *boundaries* stay locked either way.) The **apex `LEGENDARY!` rung itself is
  now resolved:** WP-425 / D-24246 added the fourth shared `comboTierForCount`
  tier (`>= 5 → legendary`) and shipped its audio sting; the visual call-out
  consumes the same locked boundary when the VFX layer is built (see
  [synergy call-out](#synergy-callout)). A *fifth* tier would be a further
  `DECISIONS.md` change adding it for both layers at once.
- **The synergy call-out label** — the named popup per tier
  ([synergy call-out](#synergy-callout)). Two open calls beyond the apex
  rung above: (a) does the word announce at `small` or start at `medium`
  (the [contrast-through-restraint](dopamine-triggers.md#dopamine-contract)
  question — the *flash* starts at `small` regardless); and (b) the
  label *wording* itself, which is owned by the
  [narrative page](narrative-psychology.md#synergy-callouts) and gets an
  IP pass with the rest of the narrative copy.
- **Performance-budget figures** — ratify or retune the numbers above
  against real mobile hardware.
- **`escapeResolved` event** (WP-186) — required before escape effects
  (Tier 3) are possible.
- **`heroRecruited` result event** — would replace client-side
  delta-watching for the recruit effect.

## Deferred

Explicitly out of scope for v1:

- **Narrative-lens variants** (builder/destroyer re-theme) — Tier 3; design
  rationale on the [Narrative Psychology Framework](narrative-psychology.md#playstyle-modes).
- **Ambient menace layer** — a rising visual dread driven by
  `escapedVillains` / `scheme.twistCount` (the visual analog of the audio
  danger meter).
- **Per-target sub-effect fidelity** — blocked on a richer `appliedEffects`
  payload (target / count).

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
