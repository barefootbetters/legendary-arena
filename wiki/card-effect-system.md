---
title: Card Effect System
type: System
tags:
  - layer-engine
  - effect
  - trigger
  - keyword
  - drift-detection
  - data-shape
  - coverage
related:
  - rule-execution-pipeline.md
  - master-strike.md
  - villain-deck.md
  - board-keywords.md
  - card-type-taxonomy.md
  - cardextid.md
  - scheme-twist.md
  - debug-effects.md
  - play-diagnostics.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\card-effect-system.md (this page — https://ewiki.legendary-arena.com/card-effect-system/)
  - ../packages/game-engine/src/rules/villainAbility.types.ts
  - ../packages/game-engine/src/villain/villainEffects.execute.ts
  - ../packages/game-engine/src/rules/effectPrimitive.types.ts
  - ../packages/game-engine/src/hero/effectPrimitive.interpret.ts
  - ../packages/game-engine/src/rules/heroCompositions.ts
  - ../packages/game-engine/src/rules/heroKeywords.ts
  - ../packages/game-engine/src/setup/heroAbility.setup.ts
  - ../packages/game-engine/src/hero/heroEffects.execute.ts
  - ../packages/game-engine/src/rules/mastermindHandlers.ts
  - ../packages/game-engine/src/diagnostics/hollowEffect.record.ts
  - ../scripts/convert-cards/apply-effect-markers.mjs
  - ../scripts/convert-cards/apply-hero-ability-markers.mjs
  - ../scripts/convert-cards/apply-defeat-requirement-markers.mjs
  - ../scripts/hero-mechanic-ledger.mjs
  - ../scripts/hero-effect-coverage.mjs
  - ../docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md
  - ../docs/ai/DESIGN-EFFECT-MODEL-DECISION.md
  - ../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md
  - ../docs/ai/DESIGN-MASTERMIND-STRIKE-MIGRATION.md
  - ../docs/ai/ARCHITECTURE.md
  - ../docs/10-GLOSSARY.md
last-reviewed: 2026-08-03
---

# Card Effect System

## Summary

The card effect system is how a card's printed ability text becomes an
executable, deterministic state change. Effects are authored as inline
**data markers** in `data/cards/*.json`, parsed **once at setup** into
JSON-serializable descriptor objects stored on `G`, and applied at
runtime by a small closed set of **executors** that dispatch through
handler maps held outside `G`. New cards that reuse an existing mechanic
are data; new mechanics are the closed, drift-tested part that requires
engine code.

## Mechanics

### The data ↔ code boundary

Nothing in `data/cards/*.json` is executable code. A card is JSON whose
abilities are human-readable text carrying inline **markers**:

| Marker | Namespace | Feeds |
|---|---|---|
| `[keyword:draw:3]`, `[keyword:reveal-ko-attack:2]` | hero ability | Hero effect execution |
| `[effect:ko-hero:each:2]`, `[effect:captureBystander]` | villain/henchman effect | Villain effect execution |
| `[require-to-defeat:team:x-men]` | villain fight precondition | Defeat-requirement gate |
| `[hc:covert]`, `[team:x-men]`, `[icon:attack]` | trait / condition / display | Trait resolution, synergy gates |

The boundary runs through **setup**. A setup-time parser reads the
markers and produces descriptor objects — plain data, no functions —
stored on `G` (for example `G.villainAbilityHooks`, `G.heroAbilityHooks`,
`G.villainDefeatRequirements`, `G.hookRegistry`). Handler *functions*
never live in `G`, because `G` must stay JSON-serializable and
deterministic per
[ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) Persistence Boundaries. At
runtime an executor reads a card's descriptors and mutates `G` through
existing zone helpers. So **effects are authored as data; a small closed
set of executors is hand-written TypeScript.**

### The three effect subsystems

The engine carries three parallel effect paths, each sharing the
descriptor-in-`G` + handler-outside-`G` shape but built at different
times for different card kinds:

| Subsystem | Marker source | Descriptor on `G` | Executor | Timings |
|---|---|---|---|---|
| Hero abilities | `[keyword:...]` / composition markers | `G.heroAbilityHooks` | [`heroEffects.execute.ts`](../packages/game-engine/src/hero/heroEffects.execute.ts) | `onPlay` · `onFight` · `onRecruit` · `onKO` · `onReveal` |
| Villain / henchman abilities | `[effect:...]` | `G.villainAbilityHooks` | [`villainEffects.execute.ts`](../packages/game-engine/src/villain/villainEffects.execute.ts) | `onAmbush` · `onFight` · `onEscape` |
| Scheme / mastermind rules | built at setup from the chosen scheme + mastermind | `G.hookRegistry` | [Rule Execution Pipeline](rule-execution-pipeline.md) | 5 `RuleTriggerName` triggers |

The scheme/mastermind path is documented in full on its own page — see
[Rule Execution Pipeline](rule-execution-pipeline.md). This page covers
the hero and villain paths and the shared authoring/coverage machinery.

### Hero effects and the composable-primitive model

The hero path is the most data-driven. Its vocabulary has a **closed
half** and an **open half**, the target model recorded in
[DESIGN-EFFECT-MODEL-DECISION.md](../docs/ai/DESIGN-EFFECT-MODEL-DECISION.md)
(D-24029) and
[DESIGN-EFFECT-AUTHORING-SCALE.md](../docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md).

The **closed half** is a small, versioned, drift-tested primitive AST in
[`effectPrimitive.types.ts`](../packages/game-engine/src/rules/effectPrimitive.types.ts)
(D-24030). Every node carries a `type`; a composition is an explicit
`sequence` node, never a raw array:

- **Effect node types** (`EFFECT_NODE_TYPES`): `sequence` (control) ·
  `move-card` · `gain-resource` (actions).
- **Value expression types** (`VALUE_EXPRESSION_TYPES`):
  `card-printed-stat` · `count-cards-by-class-in-zone` ·
  `max-class-count-in-zone` · `top-deck-card-class-count-in-zone`.
- Parameter unions (`EFFECT_RESOURCE_KINDS`, `EFFECT_ZONE_KINDS`,
  `EFFECT_COUNT_ZONE_KINDS`, `EFFECT_CARD_POSITIONS`,
  `EFFECT_OWNER_KINDS`) are each closed and drift-tested the same way.

The **open half** lives in
[`heroCompositions.ts`](../packages/game-engine/src/rules/heroCompositions.ts):
a card mechanic (Berserk, Empowered, and cousins) is a **data
composition** of the primitives above — a new row plus a unit test, not
new engine control flow. The interpreter that walks the AST is
[`effectPrimitive.interpret.ts`](../packages/game-engine/src/hero/effectPrimitive.interpret.ts),
which dispatches nodes and value expressions through handler maps. Older
hero mechanics predate the AST and run as named `HeroKeyword`s from
[`heroKeywords.ts`](../packages/game-engine/src/rules/heroKeywords.ts)
against the executor's handler map; parsing of both forms happens in
[`heroAbility.setup.ts`](../packages/game-engine/src/setup/heroAbility.setup.ts).

A transient `bind`/`ref` **execution context** threads values between
steps (a `move-card` `bind` stores a moved card id, a value expression
`ref` reads it back). It is a local `Map` created per top-level effect
evaluation and is **never** written to `G` or `ctx` — a load-bearing
determinism invariant (D-24029 §9 / D-24030), because a binding persisted
into `G` would break the runtime-only persistence boundary and risk
double-application on replay.

### Villain effects: parameterized descriptors

The villain/henchman path in
[`villainAbility.types.ts`](../packages/game-engine/src/rules/villainAbility.types.ts)
made the same move from fragmented keywords to parameters. Its executable
vocabulary is the `VillainEffectDescriptor` — a `VillainEffectPrimitive`
plus optional `target` / `magnitude` / `selector` / predicate params
(`VILLAIN_EFFECT_PRIMITIVES`, fifteen entries: `ko-hero` · `gain-wound` ·
`capture-hq-hero` · `hero-deck-top-to-escape` · `capture-bystander` ·
`scry-ko-own-deck` · `gain-attached-hero` · `reveal-or-wound` ·
`become-scheme-twist` · `draw-cards-current` · `ko-heroes-current-by-trait` ·
`rescue-bystanders-current-by-trait-count` ·
`gain-wound-unless-victory-villain-group` · `override-next-hand-size` ·
`ko-wounds-current-hand-and-discard`). A new
target / magnitude / selector variant is a descriptor **param** (a data
marker), not a new keyword plus switch arm plus drift test (D-24023).

**Revealing a Hero counts hand + in play (D-24281).** The
`reveal-or-wound` primitive — Sabretooth's *"Fight: Each player reveals an
X-Men Hero or gains a Wound"* and its core siblings (Frost Giant, Ymir,
Ultron, Zzzax, across Fight / Ambush / Escape) — is a **conditional
each-player** effect keyed by a `{requireKind: team | hero-class,
requireValue}` predicate. It is **auto-resolved**: a player who **has** a
qualifying Hero reveals it and takes no Wound; only a player with none
gains the Wound. "Have" means the Hero is in your **hand *or* already in
play** — a Hero you played earlier this turn still counts. It is *not*
hand-only: a villain's Fight effect resolves **after** you have played
your cards to defeat it, so a hand-only check would wrongly Wound a player
who plainly has (and just played) a qualifying Hero (D-24281, amended
2026-07-31 after a live Sabretooth match). Discard and deck are excluded —
only hand + in-play cards are "revealable." The scan reuses the setup-time
`G.cardTraits` `{team, heroClass}` snapshot (the same source as the
`VillainDefeatRequirement` precondition, D-24076).

**`become-scheme-twist` is a fire-site primitive, not an executor mutation
(D-24287).** Mystique's *"Escape: … becomes a Scheme Twist"* is the ninth
primitive, but its executor handler
(`villainEffectBecomeSchemeTwist`) is a **deliberate no-op** — it exists only
so the line parses to a reachable, recognized effect (the D-24266 unmarked-ability
detector classifies it *applied* rather than a false breadcrumb, and the WP-257
hollow detector sees a handler was reached). The actual Scheme Twist is fired at
the [Villain Deck](villain-deck.md) escape site: after an escaping villain's
`onEscape` abilities resolve, `villainCardEscapeTriggersSchemeTwist(G, cardId)`
checks for the descriptor and, when present, runs the `onSchemeTwistRevealed`
rule pipeline — the same pipeline a `scheme-twist` reveal uses. This is a second
trigger path into `onSchemeTwistRevealed` that does not route through the villain
executor's mutation surface at all.

**KO-ing your own Wounds is a beneficial villain Fight (D-24329).** The
`ko-wounds-current-hand-and-discard` primitive — Ymir, Frost Giant King's
*"Fight: Choose a player. That player KOs any number of Wounds from their hand
and discard pile."* — is a keyword-less, no-param, auto-resolve effect: the
current (fighting) player KOs **every** Wound (the shared `WOUND_EXT_ID`,
`pile-wound`) from their own **hand + discard pile** to the KO pile. Two
narrowings are deliberate. "Choose a player" collapses to the **current player**
and "any number" to **all** in the shipped solo / co-op modes — a rational
chooser KOs all their own Wounds, since it is pure upside — so there is no
player-selection UI and no partial-KO choice. And unlike
`ko-heroes-current-by-trait` (which scans hand **and** in-play, because a Hero
played this turn sits in-play), this scans **hand + discard only**: Wounds enter
a deck via `gainWound` (→ discard) or a draw (→ hand) and are never played into
in-play. It self-narrates via `pushLog` (keyword-less → no reverse-map, no
`VillainEffectResult`).

Ten earlier `VILLAIN_EFFECT_KEYWORDS` are **frozen** as the parser's
legacy-translation input only. `LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR`
maps each to a descriptor so existing card data keeps working unchanged,
and the inverse map reverse-translates a dispatched descriptor back to a
keyword so the applied-effects narrative surface stays byte-identical.
Villain hooks are looked up per card and timing by `getVillainHooksForCard`
and applied left-to-right by `executeVillainAbilities`, which mutates `G`
through existing helpers (`gainWound`, `koCard`, `captureHeroFromHq`, …)
and reports a `VillainEffectResult[]` for the game log.

Villain fight **preconditions** are a distinct shape:
`VillainDefeatRequirement` (`[require-to-defeat:team|hc:<value>]`, D-24076)
gates whether a fight may resolve at all, rather than firing a consequence
after defeat.

### Scheme and mastermind strikes

Scheme twists and Master Strikes run through the two-registry
[Rule Execution Pipeline](rule-execution-pipeline.md), not the hero/villain
executors. Within that pipeline, the Master Strike handler
[`mastermindHandlers.ts`](../packages/game-engine/src/rules/mastermindHandlers.ts)
is a **dispatcher that branches on `G.selection.mastermindId`**: a generic
strike-counter increment and bystander capture run for every mastermind,
and per-mastermind resolver functions implement individual card text
(core Magneto, both Red Skull faces, and four co2e masterminds at this
revision — WP-388/D-24192, WP-389/D-24193, WP-397). Every other
mastermind's printed strike text is data with no resolver and falls
through to the generic bookkeeping. Unlike the hero and villain paths,
this dispatch is hand-coded per mastermind, not marker-driven — see
[Edge Cases](#edge-cases).

### Marker authoring (the overlay scripts)

Markers are written into card JSON by offline, deterministic, idempotent
ops scripts under `scripts/convert-cards/`, upstream of the Registry
layer. Each reads a curated map from `scripts/convert-cards/inputs/*.json`,
validates against a hand-synced copy of the engine vocabulary, and appends
the marker to the matched ability line by surgical text replacement (a
re-run produces a zero-line diff):

- [`apply-effect-markers.mjs`](../scripts/convert-cards/apply-effect-markers.mjs)
  — sole author of `[effect:...]` villain/henchman markers.
- [`apply-hero-ability-markers.mjs`](../scripts/convert-cards/apply-hero-ability-markers.mjs)
  — `[keyword:...]` hero markers.
- [`apply-defeat-requirement-markers.mjs`](../scripts/convert-cards/apply-defeat-requirement-markers.mjs)
  — `[require-to-defeat:...]` fight preconditions.

The vocabulary copy in each script is a hand-maintained mirror of the
engine's canonical union: an ops `.mjs` script must not import from
`packages/`, so any value outside the mirrored set **loud-fails** (non-zero
exit) until the mirror is updated by hand. Drift is intentional and never
silent.

### Coverage tracking

Which printed effects actually execute is measured by tooling driven off
the **real engine parser** over `data/cards/*.json` (built first), not by
hand:

- **Mechanic ledgers** — [`hero-mechanic-ledger.mjs`](../scripts/hero-mechanic-ledger.mjs)
  (`pnpm ledger:heroes`) emits one row per card × mechanic with a status of
  `executable` · `deferred` · `condition` · `unsupported` (a code gap) ·
  `unmarked` (a data gap); a villain sibling exists. Output is committed
  under `docs/ai/coverage/` and CI-gated for freshness. Authoring a new
  effect marker ripples through generated artifacts in order —
  `data/cards/core.json` → `villain-mechanic-ledger.{json,csv}`
  (`pnpm ledger:villains`) → `data/metadata/effect-implementation-index.json`
  (`pnpm effect-index`), plus a hand-added `scripts/coverage/mechanic-provenance.json`
  row for a net-new primitive — so regenerate and re-check the whole chain, not
  just `core.json`.
- **Coverage gate** — [`hero-effect-coverage.mjs`](../scripts/hero-effect-coverage.mjs)
  (`pnpm sim:coverage`) buckets every parsed hero ability line into
  executable / parsed-not-executed / no-effect against a committed
  baseline.
- **Hollow-effect detection** — the runtime detector
  ([`hollowEffect.record.ts`](../packages/game-engine/src/diagnostics/hollowEffect.record.ts),
  [DESIGN-HOLLOW-EFFECT-DETECTION.md](../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md))
  records mechanics that a card *declared* but that reached no executable
  handler during play. It is a handler-reachability detector, not a
  state-diff detector.
- **The `/coverage` dashboard** — [`CoveragePage.vue`](../apps/dashboard/src/pages/coverage/CoveragePage.vue)
  renders the ledger as a by-mechanic worklist plus a by-card index. Its
  in-play headline is obs-weighted and its denominator is a monotonic
  high-water-mark, so fixing a mechanic cannot shrink the denominator and
  inflate the percentage — the metric is a floor, not a census.
- **A generated, derived index** — [`build-card-mechanics-metadata.mjs`](../scripts/build-card-mechanics-metadata.mjs)
  (WP-269 / D-24046) transforms the hero ledger into a published, viewer-safe
  per-card mechanic index at `data/metadata/card-mechanics.json`, validated
  against a registry schema and CI-gated for freshness. It is the "generated,
  never hand-authored" pattern the effect-debugging direction extends.

### Debugging a specific misfired effect

The surfaces above measure coverage in aggregate; when one card's ability
*"didn't do what it says"* the debugging entry point is
[Debug Effects](debug-effects.md). It maps the shipped per-card surfaces (the
generated `card-mechanics.json` index, the [hollow-effect detector](#coverage-tracking),
`unresolvedMarkers`, and the client-side [Play Diagnostics](play-diagnostics.md)
provenance) and records the **proposed** unification — a generated
effect-implementation index with descriptor → handler mapping plus runtime
effect traces behind a `/debug/effects` viewer. The `become-scheme-twist`
fire-site case (D-24287) is why a runtime trace beats a static map: a no-op
handler reads as *applied* while the real Scheme Twist fires elsewhere.

## Interactions

- **[Rule Execution Pipeline](rule-execution-pipeline.md).** The
  scheme/mastermind effect path; the Master Strike dispatcher is a handler
  registered there.
- **[Villain Deck](villain-deck.md).** The Ambush and Escape fire sites
  that call `executeVillainAbilities`; the Fight fire site calls it for
  `onFight`.
- **[Master Strike](master-strike.md).** The mechanic page for the strike
  trigger; the per-mastermind resolvers described here implement its card
  text.
- **[Card Type Taxonomy](card-type-taxonomy.md) / [CardExtId](cardextid.md).**
  Descriptors and hooks reference cards only as `CardExtId` strings; card
  display data is resolved by the UI via the registry, never stored in `G`.
- **[Board Keywords](board-keywords.md).** Structural City keywords
  (`patrol` · `ambush` · `guard`) are distinct from the hero/villain
  ability keywords parsed here.
- **Registry.** Card text and its markers enter the engine once, at setup,
  through registry data — the engine never re-queries the registry at
  runtime (ARCHITECTURE.md Layer Boundary).
- **[Dashboard](dashboard.md).** Consumes the committed coverage ledgers
  as build-time static JSON to render `/coverage`.
- **[Debug Effects](debug-effects.md).** The per-card debugging entry point —
  *"card X's ability didn't fire, why?"* — mapping the shipped surfaces here
  (generated index, hollow detector, `unresolvedMarkers`, Play Diagnostics) and
  the proposed generated-index + runtime-trace unification.
- **[Play Diagnostics](play-diagnostics.md).** The client-side per-seat outcome
  provenance (`recentlyPlayedCards.outcome`) that reads the engine-authored
  `LogEntry.outcome` for a played card.

## Edge Cases

- **Hollow / markerless effects.** A card whose ability text carries no
  recognized marker parses to an empty effect list and silently no-ops at
  runtime. This is the `unmarked` (data gap) status in the ledger and the
  hollow-effect detector's subject; it is invisible without the coverage
  tooling because a missing marker is indistinguishable from a card with
  no effect.
- **Unresolved markers.** A villain hook can carry `unresolvedMarkers` —
  raw `[effect:X]` tokens the parser saw but resolved to neither a legacy
  keyword nor a descriptor (WP-257/D-24034) — so a mis-authored marker is
  detectable at the fire site rather than looking like an unmarked line.
- **Frozen villain keyword union.** `VILLAIN_EFFECT_KEYWORDS` is frozen at
  ten; new villain behaviour is authored as descriptor params, not by
  appending keywords (D-24023). Editing the frozen union is a drift hazard.
- **Hand-synced vocabulary mirrors.** The overlay scripts mirror the engine
  vocabulary by hand and cannot import it. If the engine union changes, the
  script loud-fails on the new value until the mirror is updated — a
  deliberate guardrail, but a required manual step.
- **The mastermind path is not marker-driven, and still auto-picks.** Each
  implemented mastermind strike is a hand-coded branch in `mastermindHandlers.ts`
  keyed on `mastermindId`, and its reveal-and-choose card text is resolved by a
  deterministic auto-pick (D-24192). Note the original D-24192 rationale — "the
  engine has no interactive reveal-and-choose model" — **no longer holds:** the
  hero path now carries a full pending-choice interaction model (`PendingScry`
  WP-470, `PendingDiscard` WP-476, `PendingReorderChoice` WP-479, each with a
  `hasPending*Choice` block-all guard, a `resolve*` move, a UIState projection, and
  a deterministic bot/sim default). Masterminds simply have not been migrated onto
  it yet — the auto-pick is now a *not-yet-adopted* state, not a missing capability
  (see [Known gaps](#known-gaps-and-directions) #1). The mastermind reveal-eight
  strike also tops up a short deck by reshuffling the discard (D-24288; see below).
  This asymmetry with the hero/villain descriptor model is the current state, not a
  rule.
- **Deck exhaustion mid-effect reshuffles the discard.** A reveal / look-at-top
  effect that runs off the end of the deck reshuffles the owner's discard back into
  the deck to continue, matching the tabletop rule — the shared
  `reshuffleDiscardIntoDeck` helper (`ctx.random.Shuffle`, no new `G` field). This
  applies to hero reveal (`heroEffectReveal`, WP-478/D-24285), the `scry-ko-own-deck`
  villain primitive (WP-478), and the Doctor Octopus reveal-eight Master Strike, which
  tops up a short deck to reveal a full eight (WP-482/D-24288). The top-up makes that
  strike **harsher** (more revealed → more Heroes discarded), the faithful reading of
  its printed "reveal the top eight … put the rest back in random order" — not a
  benefit, because the shuffle-back still denies the player any ordering choice. The
  reshuffle no-ops when the discard is empty or no shuffle source is threaded through.
- **Determinism of the primitive interpreter.** The `bind`/`ref` execution
  context is a transient `Map`, never persisted to `G`/`ctx`; bound values
  are re-derived identically on replay (D-24029 §9 / D-24030).
- **Drift hazard on every closed set.** Adding a hero keyword, effect node
  type, value expression, or villain primitive requires updating the union,
  its canonical readonly array, the dispatch/handler map, and a DECISIONS.md
  entry together. Drift-detection tests catch the array-vs-union mismatch;
  the dispatch site is on the reviewer.

## Code Touchpoints

- [`villainAbility.types.ts`](../packages/game-engine/src/rules/villainAbility.types.ts)
  — `VillainEffectDescriptor`, `VILLAIN_EFFECT_PRIMITIVES`, the frozen
  legacy keyword union + translation maps, `VillainAbilityHook`,
  `VillainDefeatRequirement`, `getVillainHooksForCard`
- [`villainEffects.execute.ts`](../packages/game-engine/src/villain/villainEffects.execute.ts)
  — `executeVillainAbilities`
- [`effectPrimitive.types.ts`](../packages/game-engine/src/rules/effectPrimitive.types.ts)
  — the closed primitive AST (`EFFECT_NODE_TYPES`, `VALUE_EXPRESSION_TYPES`,
  parameter unions, `EffectExecutionContext`)
- [`effectPrimitive.interpret.ts`](../packages/game-engine/src/hero/effectPrimitive.interpret.ts)
  — `interpretHeroPrimitiveEffect` and the node/value-expression handler maps
- [`heroCompositions.ts`](../packages/game-engine/src/rules/heroCompositions.ts)
  — the open half: static + builder composition markers
- [`heroKeywords.ts`](../packages/game-engine/src/rules/heroKeywords.ts)
  — `HERO_KEYWORDS` and the hero ability timings
- [`heroAbility.setup.ts`](../packages/game-engine/src/setup/heroAbility.setup.ts)
  — setup-time marker parsing to `G.heroAbilityHooks`
- [`heroEffects.execute.ts`](../packages/game-engine/src/hero/heroEffects.execute.ts)
  — hero effect execution and the handler map
- [`mastermindHandlers.ts`](../packages/game-engine/src/rules/mastermindHandlers.ts)
  — the per-mastermind strike dispatcher
- [`hollowEffect.record.ts`](../packages/game-engine/src/diagnostics/hollowEffect.record.ts)
  — the hollow-effect (handler-reachability) detector

## Data Files

- `data/cards/*.json` — the marked card corpus (the effect source of truth)
- `scripts/convert-cards/inputs/villain-effect-markers.json`,
  `.../inputs/hero-ability-markers.json`,
  `.../inputs/villain-defeat-requirements.json` — the curated marker maps
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` and the villain
  sibling — the committed, CI-gated coverage ledgers

## History

- WP-009A / WP-009B / WP-014A / WP-024 — the two-registry rule pipeline the
  scheme/mastermind path runs on (see [Rule Execution Pipeline](rule-execution-pipeline.md))
- WP-021 / WP-022 — hero ability hooks and execution
- WP-185 / WP-186 — villain/henchman ability timings and the Ambush/Fight/Escape executor
- WP-252 (D-24023) — villain effects reparameterized into `VillainEffectDescriptor`; the ten legacy keywords frozen
- D-24029 / D-24030 — the composable-primitive model and the closed primitive AST registry
- WP-292 (D-24076) — villain defeat-requirement preconditions
- WP-388 (D-24192) / WP-389 (D-24193) / WP-397 — implemented co2e mastermind strikes and the base-face selection rule
- WP-447 (D-24267) / WP-450 (D-24270) — the `scry-ko-own-deck` and `gain-attached-hero` villain primitives
- WP-469 (D-24281) — the `reveal-or-wound` conditional each-player villain primitive (eighth primitive)
- WP-478 (D-24285) / WP-482 (D-24288) — mid-effect deck-exhaustion reshuffle for hero reveal and `scry-ko-own-deck`, and the Doctor Octopus reveal-eight Master Strike top-up
- WP-479 (D-24286) — interactive hero reveal-reorder (`PendingReorderChoice`); the hero-path pending-choice interaction model matured to cover reveal/scry/discard/reorder
- WP-481 (D-24287) — the `become-scheme-twist` villain primitive (ninth primitive; an escaping villain fires a Scheme Twist)
- WP-485 (D-24290) / WP-494 (D-24299) / WP-503 (D-24307) — the auto-resolve `draw-cards-current`, `ko-heroes-current-by-trait`, `rescue-bystanders-current-by-trait-count`, `gain-wound-unless-victory-villain-group`, and `override-next-hand-size` villain primitives (tenth–fourteenth)
- WP-516 (D-24329) — the `ko-wounds-current-hand-and-discard` villain primitive (fifteenth; Ymir's Fight KOs the current player's Wounds from hand + discard)
- The hollow-effect detection and coverage-ledger spine (DESIGN-HOLLOW-EFFECT-DETECTION.md, DESIGN-EFFECT-AUTHORING-SCALE.md)

## Scaling and Open Directions

This section is **forward-looking** — it records where the system is
headed and the known gaps, alongside the shipped mechanics above. Items
already recorded as governed decisions cite their design doc; items
marked *(proposed)* are directions, not yet a landed decision.

### Adding the next ~500 card effects

The cost model, from
[DESIGN-EFFECT-AUTHORING-SCALE.md](../docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md):

- A card that **reuses an existing mechanic** is roughly one line of JSON
  (a curated-map entry the overlay scripts apply) and is batchable per
  set — a whole set's worth of markup is one unit of work, not one per
  card.
- The real cost is **net-new mechanics**. Historically the slowness was
  one WP + EC + DECISIONS cycle per *mechanic*, plus keyword vocabulary
  fragmenting (near-identical `reveal-*` keywords, magnitude-per-keyword
  unions) instead of parameterizing.
- The discipline that keeps 500 effects from becoming spaghetti: reuse
  existing primitives as **data**; a genuinely new mechanic ships as a
  composable primitive / composition row plus a unit test
  ([DESIGN-EFFECT-MODEL-DECISION.md](../docs/ai/DESIGN-EFFECT-MODEL-DECISION.md),
  D-24029 / D-24030), never a new fragmented keyword with its own switch
  arm and drift test.
- **Prioritization surface:** the `/coverage` by-mechanic worklist —
  implementing one mechanic clears every card that uses it — and the
  obs-weighted in-play metric, which ranks the remaining gaps by actual
  player impact rather than raw mechanic count.

### Known gaps and directions

1. **The Master Strike path is not data-driven.** Each implemented
   mastermind is a hand-coded branch in
   [`mastermindHandlers.ts`](../packages/game-engine/src/rules/mastermindHandlers.ts)
   keyed on `mastermindId`, so every new mastermind adds a branch plus a
   bespoke resolver — the fragmentation the hero and villain paths were
   refactored away from. Strikes that ask a player to reveal or choose still
   resolve via a deterministic auto-pick (D-24192), but that is no longer
   *blocked* on a missing capability: the hero path now ships a reusable
   **pending-choice interaction model** (WP-470 scry / WP-476 discard / WP-479
   reorder — block-all guard + resolve move + UIState projection + bot default),
   so wiring a strike to prompt the player is now an adoption step rather than a
   from-scratch build. *(Proposed)* migrate masterminds onto the same
   descriptor / ImplementationMap model the hero and villain paths use —
   or, as a smaller first step, a `mastermindId → resolver` registry that
   removes the `if/else` chain. This is the highest-leverage
   anti-fragmentation move ahead of the incoming sets; the full proposal
   is [DESIGN-MASTERMIND-STRIKE-MIGRATION.md](../docs/ai/DESIGN-MASTERMIND-STRIKE-MIGRATION.md).
2. **The composable-primitive vocabulary is still small.** The AST is at
   its Berserk / Empowered-era size (three node types, four value
   expressions). Absorbing 500 effects — with the large
   `unsupported`-mechanic tail the ledger already quantifies — will
   pressure it toward more node types (KO, rescue, and draw as
   primitives; conditional / choice combinators). This is exactly the
   growth D-24029 anticipates but has not yet built.
3. **The coverage regeneration tax.** A card-data change must regenerate
   four to five committed artifacts (the hero and villain ledgers,
   `card-mechanics.json`, runtime-observed hollows) or CI reddens.
   *(Proposed)* a single "regenerate all coverage artifacts" convenience
   wrapper over the existing per-artifact scripts, to keep card-data PRs
   from reddening the gates piecemeal.
4. **Effect debugging is scattered, not a single surface.** Answering *"card X
   didn't fire, why?"* today means reading the ledgers, the generated
   `card-mechanics.json`, `runtime-observed-hollows.json`, and a Play
   Diagnostics export separately — and the hollow detector reports
   *reachability*, not correctness, so a no-op fire-site handler
   (`become-scheme-twist`, D-24287) reads *applied*. *(Proposed)* a generated
   **Effect Implementation Index** (extend `card-mechanics.json` with
   descriptor → handler-fn/file/decision metadata, widened to villains) plus
   **runtime effect traces** behind a `/debug/effects` viewer — a derived index,
   never a hand-maintained card → effect lookup. Recorded in
   [Debug Effects](debug-effects.md); no design doc or DECISIONS entry governs
   it yet.

### Where the deeper strategy lives

The authoritative strategy and rationale are the three design docs, not
this page:
[DESIGN-EFFECT-AUTHORING-SCALE.md](../docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md)
(the three levers and the per-mechanic-grind diagnosis),
[DESIGN-EFFECT-MODEL-DECISION.md](../docs/ai/DESIGN-EFFECT-MODEL-DECISION.md)
(D-24029, the composable-primitive decision), and
[DESIGN-HOLLOW-EFFECT-DETECTION.md](../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md)
(the coverage / hollow-detection spine). The Master Strike migration
(gap 1) is proposed in
[DESIGN-MASTERMIND-STRIKE-MIGRATION.md](../docs/ai/DESIGN-MASTERMIND-STRIKE-MIGRATION.md)
(draft); no Work Packet exists yet.

## References

- [`packages/game-engine/src/rules/villainAbility.types.ts`](../packages/game-engine/src/rules/villainAbility.types.ts),
  [`villainEffects.execute.ts`](../packages/game-engine/src/villain/villainEffects.execute.ts)
  — villain effect vocabulary and executor
- [`packages/game-engine/src/rules/effectPrimitive.types.ts`](../packages/game-engine/src/rules/effectPrimitive.types.ts),
  [`hero/effectPrimitive.interpret.ts`](../packages/game-engine/src/hero/effectPrimitive.interpret.ts),
  [`rules/heroCompositions.ts`](../packages/game-engine/src/rules/heroCompositions.ts)
  — the composable-primitive model
- [`packages/game-engine/src/rules/mastermindHandlers.ts`](../packages/game-engine/src/rules/mastermindHandlers.ts)
  — the Master Strike dispatcher
- [`scripts/convert-cards/apply-effect-markers.mjs`](../scripts/convert-cards/apply-effect-markers.mjs),
  [`apply-hero-ability-markers.mjs`](../scripts/convert-cards/apply-hero-ability-markers.mjs),
  [`apply-defeat-requirement-markers.mjs`](../scripts/convert-cards/apply-defeat-requirement-markers.mjs)
  — the marker-authoring overlays
- [`scripts/hero-mechanic-ledger.mjs`](../scripts/hero-mechanic-ledger.mjs),
  [`scripts/hero-effect-coverage.mjs`](../scripts/hero-effect-coverage.mjs)
  — coverage tooling
- [`docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md`](../docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md),
  [`DESIGN-EFFECT-MODEL-DECISION.md`](../docs/ai/DESIGN-EFFECT-MODEL-DECISION.md),
  [`DESIGN-HOLLOW-EFFECT-DETECTION.md`](../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md),
  [`DESIGN-MASTERMIND-STRIKE-MIGRATION.md`](../docs/ai/DESIGN-MASTERMIND-STRIKE-MIGRATION.md)
  — the authoring-at-scale strategy, the composable-primitive decision, hollow detection, and the Master Strike migration proposal (draft)
- [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) — determinism and
  persistence boundaries; the Layer Boundary that keeps registry data
  setup-time only
- [`docs/10-GLOSSARY.md`](../docs/10-GLOSSARY.md) — canonical terminology
- [Rule Execution Pipeline](rule-execution-pipeline.md),
  [Master Strike](master-strike.md),
  [Villain Deck](villain-deck.md) — related wiki pages
