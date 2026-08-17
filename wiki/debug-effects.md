---
title: Debug Effects
type: Tool
tags:
  - diagnostics
  - tooling
  - effect
  - coverage
  - drift-detection
  - layer-engine
related:
  - card-effect-system.md
  - play-diagnostics.md
  - rule-execution-pipeline.md
  - dashboard.md
  - master-strike.md
  - villain-deck.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\debug-effects.md (this page — https://ewiki.legendary-arena.com/debug-effects/)
  - ../scripts/build-card-mechanics-metadata.mjs
  - ../scripts/hero-mechanic-ledger.mjs
  - ../scripts/villain-mechanic-ledger.mjs
  - ../packages/game-engine/src/diagnostics/hollowEffect.record.ts
  - ../packages/game-engine/src/rules/villainAbility.types.ts
  - ../apps/arena-client/src/diagnostics/effectProvenance.ts
  - ../apps/dashboard/src/pages/coverage/CoveragePage.vue
  - ../docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md
  - ../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md
  - ../docs/ai/DESIGN-EFFECT-MODEL-DECISION.md
  - ../docs/ai/ARCHITECTURE.md
last-reviewed: 2026-08-01
---

# Debug Effects

## Summary

Debug Effects is the answer to one recurring question: *"card X's printed
ability didn't do what it says — where do I look?"* (the canonical example:
*"Mystique's Escape didn't fire a Scheme Twist"*). Today that answer is spread
across several **shipped** surfaces — the coverage ledgers, the generated
`card-mechanics.json` index, the hollow-effect detector, and the client-side
[Play Diagnostics](play-diagnostics.md) provenance block. The recommended
direction — **not yet a landed decision** — is to unify them behind a single
**generated** effect-implementation index plus **runtime effect traces**, so a
developer or a future AI agent has one place to look. This page maps what
exists now and records that proposed direction; it is `draft` because the
unified surface is not built.

## Mechanics

### The question this answers

A misfired effect has a small, fixed set of causes, and each shipped surface
answers a different one:

- *Is the card even marked?* — a card whose ability text carries no recognized
  marker parses to an empty effect list and silently no-ops (the `unmarked`
  data-gap status). See [Card Effect System → Edge Cases](card-effect-system.md#edge-cases).
- *Did the declared effect reach a handler?* — the hollow-effect detector is a
  handler-**reachability** check: it records a mechanic a card *declared* that
  reached no executable handler during play.
- *Is it actually unimplemented, or implemented somewhere the ledger does not
  look?* — a card implemented by a subsystem OTHER than the `[effect:X]`
  pipeline has no effect marker to find, so a status-only reading calls it
  `unsupported` and it renders as a TODO that nobody will ever close. The
  `subsystem` status (WP-548 / D-24357 for villains, WP-559 / D-24368 for
  heroes) exists for exactly that case: it means **implemented, done**, with the
  owning subsystem named in the handler column. Villain entries are card-keyed;
  hero entries are keyed (card × mechanic), because one card can legitimately
  mix an implemented mechanic and a genuinely unimplemented one. Both read from
  the curated allowlist [`subsystem-coverage.json`](../scripts/coverage/subsystem-coverage.json),
  which records MERGED coverage only.
- *Did the parser choke on the marker?* — a villain hook can carry
  `unresolvedMarkers`: raw `[effect:X]` tokens the parser saw but resolved to
  neither a legacy keyword nor a descriptor.
- *What did this seat actually see when it played the card?* — Play
  Diagnostics' `recentlyPlayedCards` records each played card's engine-authored
  `outcome` (`resolved` / `hollow` / `awaitingChoice` / `conditionNotMet`).

The recurring failure mode — Mystique's Escape — is a good worked example,
because it is a **fire-site** primitive: `become-scheme-twist`'s executor
handler is a deliberate no-op, and the actual Scheme Twist fires at the
[Villain Deck](villain-deck.md) escape site, not in the villain executor's
mutation surface (D-24287). A reachability check alone ("did a handler run?")
would read *applied* while the Twist never fired — which is exactly why a
runtime **trace** that records the secondary fire site is more useful than a
static map. See [Card Effect System](card-effect-system.md#villain-effects-parameterized-descriptors).

### What exists today (shipped)

| Surface | Answers | Where it lives |
|---|---|---|
| **Mechanic ledgers** (`pnpm ledger:heroes` / `ledger:villains`) | Per card × mechanic status: `executable` · `deferred` · `condition` · `unsupported` (code gap) · `unmarked` (data gap) · `subsystem` (implemented ELSEWHERE - done, not a TODO) | [`hero-mechanic-ledger.mjs`](../scripts/hero-mechanic-ledger.mjs), [`villain-mechanic-ledger.mjs`](../scripts/villain-mechanic-ledger.mjs) → `docs/ai/coverage/*.json` |
| **Generated mechanic index** (`card-mechanics.json`) | A published, viewer-safe, per-card mechanic index — **derived** from the hero ledger, validated against a registry schema, CI-gated for freshness | [`build-card-mechanics-metadata.mjs`](../scripts/build-card-mechanics-metadata.mjs) (WP-269 / D-24046) → `data/metadata/card-mechanics.json` |
| **Hollow-effect detector** | "declared but reached no handler" at runtime (reachability, not a state diff) | [`hollowEffect.record.ts`](../packages/game-engine/src/diagnostics/hollowEffect.record.ts) → `docs/ai/coverage/runtime-observed-hollows.json` |
| **`unresolvedMarkers`** | A mis-authored `[effect:X]` marker, detectable at the fire site | [`villainAbility.types.ts`](../packages/game-engine/src/rules/villainAbility.types.ts) (WP-257 / D-24034) |
| **Play Diagnostics provenance** | What one live seat saw: `awaitingPlayerInput` + `recentlyPlayedCards.outcome` | [`effectProvenance.ts`](../apps/arena-client/src/diagnostics/effectProvenance.ts) |
| **`/coverage` dashboard** | The ledger rendered as a by-mechanic worklist + by-card index | [`CoveragePage.vue`](../apps/dashboard/src/pages/coverage/CoveragePage.vue) (see [Dashboard](dashboard.md)) |

The load-bearing property shared by all of them: every one is **derived from
the real engine parser or a runtime hook** over `data/cards/*.json` — none is a
hand-maintained lookup that can silently disagree with the engine. The
`card-mechanics.json` index already embodies the "generated, never authored"
half of the recommended direction; it is just narrower than the target (hero
mechanics only, no descriptor → handler mapping, no runtime traces).

### The recommended direction (proposed — not a decision)

The recorded recommendation is **a generated effect-implementation index plus
runtime effect tracing**, not a hand-maintained card → effect JSON. Three
pieces, each an extension of something already shipped rather than new
architecture:

1. **A generated Effect Implementation Index.** Extend the existing
   `card-mechanics.json` producer (or a sibling) so each row also carries the
   resolved descriptor(s), the handler function name / file that executes it,
   and the governing DECISIONS / WP id — one row per card × ability line ×
   descriptor. It reuses the same setup-time parsers that build
   `G.villainAbilityHooks` / `G.heroAbilityHooks`, so it stays a **derived**
   artifact, CI-gated for freshness exactly like the mechanic ledgers.
2. **Runtime effect tracing.** A structured trace, emitted only when a
   descriptor is actually dispatched, recording the primitive, its params,
   which handler-map entry ran, which zone helpers mutated state, and any
   **secondary** fire site (the Mystique / escape-Twist case). The hollow
   detector already has most of this plumbing; the extension is to make
   "handler reached but no mutation" and "handler never reached" both visible
   in one trace.
3. **A `/debug/effects` viewer.** A searchable view of the generated index plus
   the last live traces for a card — the single place the *"Mystique's Escape
   didn't fire a Twist"* question gets answered. It does **not** exist yet
   ([Dashboard](dashboard.md) ships `/debug`, not `/debug/effects`).

The rationale, sourcing, and any go/no-go for these belong in the effect design
docs and DECISIONS.md, not this page — see
[DESIGN-EFFECT-AUTHORING-SCALE.md](../docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md)
and [DESIGN-HOLLOW-EFFECT-DETECTION.md](../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md).

### What to avoid

The recommendation explicitly rules out a **hand-curated `card-effects-lookup.json`**
that lists every card → effect text → code location. It would become a second
source of truth and drift the moment someone adds a marker and forgets the
lookup — the exact failure mode the marker + descriptor + coverage system was
built to avoid ([DESIGN-EFFECT-MODEL-DECISION.md](../docs/ai/DESIGN-EFFECT-MODEL-DECISION.md),
D-24029; the drift-detection posture in
[Card Effect System](card-effect-system.md)). The same reasoning rules out
putting handler function references or code paths **into the card JSON itself**,
and building the debugger as a **second parser** that can disagree with the real
setup-time parser. The boundary the effect system already enforces — *data*
(markers → descriptors) versus *code* (closed executors) — is the boundary the
debugging surface must respect: a generated index maps across it; it never
duplicates either side by hand.

## Interactions

- **[Card Effect System](card-effect-system.md).** The system this debugs. Its
  data ↔ code boundary, closed executor sets, and coverage tooling are the
  substrate every surface here reads. The generated index and traces are
  derived from its setup-time parsers.
- **[Play Diagnostics](play-diagnostics.md).** The client-side, per-seat half:
  a "froze after I played X" report already names its own cause via
  `effectProvenance`. Runtime traces are the server/engine-side complement — a
  full descriptor-level record rather than a projected outcome class.
- **[Rule Execution Pipeline](rule-execution-pipeline.md).** The scheme /
  mastermind effect path; a `become-scheme-twist` escape fires
  `onSchemeTwistRevealed` through this pipeline, which a trace must record as a
  secondary fire site.
- **[Dashboard](dashboard.md).** Hosts the shipped `/coverage` page and the
  existing `/debug` page; the proposed `/debug/effects` viewer would live here.
- **[Master Strike](master-strike.md) / [Villain Deck](villain-deck.md).** The
  mastermind and villain fire sites whose per-mastermind hand-coded dispatch and
  escape-time Twist trigger are the cases a static map handles worst and a
  runtime trace handles best.

## Edge Cases

- **No single surface exists yet.** "Debug Effects" is a *practice* spread
  across the six shipped surfaces above, not one tool. Until the `/debug/effects`
  viewer lands, answering a misfire means reading the ledgers, the generated
  index, `runtime-observed-hollows.json`, and a Play Diagnostics export
  separately.
- **The generated index is hero-only today.** `card-mechanics.json` is produced
  from the *hero* ledger and is a "filter heroes by mechanic" feed
  (WP-269 / D-24046). A villain ledger exists (`ledger:villains`) but is not yet
  folded into the published index, and neither carries descriptor → handler
  mapping. The proposed index widens both.
- **Reachability ≠ correctness.** The hollow detector reports whether a handler
  ran, not whether it produced the right state change. A deliberate no-op
  handler (Mystique's `become-scheme-twist`, D-24287) reads as *applied* even
  though the real work happens elsewhere — the case that motivates a trace over
  a static map.
- **Traces would be runtime-only.** Any trace is a diagnostic side channel,
  never part of `G` — `G` stays JSON-serializable and hash-excluded diagnostics
  stay out of the determinism surface (the same posture as `G.diagnostics` /
  hollow records; [ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md) Persistence
  Boundaries). This page does not authorize any `G` shape change.

## Code Touchpoints

- [`scripts/build-card-mechanics-metadata.mjs`](../scripts/build-card-mechanics-metadata.mjs)
  — the existing generated-index producer (`data/metadata/card-mechanics.json`);
  the extension point for the proposed Effect Implementation Index.
- [`scripts/hero-mechanic-ledger.mjs`](../scripts/hero-mechanic-ledger.mjs),
  [`scripts/villain-mechanic-ledger.mjs`](../scripts/villain-mechanic-ledger.mjs)
  — the per-card × mechanic ledgers the index derives from.
- [`packages/game-engine/src/diagnostics/hollowEffect.record.ts`](../packages/game-engine/src/diagnostics/hollowEffect.record.ts)
  — the runtime hollow (reachability) detector; the plumbing a full trace would
  extend.
- [`packages/game-engine/src/rules/villainAbility.types.ts`](../packages/game-engine/src/rules/villainAbility.types.ts)
  — `unresolvedMarkers` and the descriptor vocabulary a trace would name.
- [`apps/arena-client/src/diagnostics/effectProvenance.ts`](../apps/arena-client/src/diagnostics/effectProvenance.ts)
  — the shipped client-side per-seat outcome provenance.
- [`apps/dashboard/src/pages/coverage/CoveragePage.vue`](../apps/dashboard/src/pages/coverage/CoveragePage.vue)
  — the `/coverage` render; a sibling `/debug/effects` viewer would mirror it.

## Data Files

- `data/metadata/card-mechanics.json` — the generated, CI-gated hero-mechanic
  index (the existing "generated index").
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
  `villain-mechanic-ledger.{json,csv}` — the committed mechanic ledgers.
- `docs/ai/coverage/runtime-observed-hollows.json` — the committed runtime
  hollow-effect record.

## Open Questions

- **The unified `/debug/effects` surface is unbuilt.** No route, no generated
  Effect Implementation Index with descriptor → handler mapping, and no runtime
  effect trace exist yet. This page records the recommended direction; a Work
  Packet + DECISIONS entry would govern any build. Do not rely on this page as a
  spec.
- **Where the design decision lives.** The go/no-go, scope, and shape for the
  index-plus-trace direction are not yet recorded in DECISIONS.md or a dedicated
  design doc. Until they are, treat every *(proposed)* item here as a direction,
  not a commitment — check WORK_INDEX / DECISIONS before implementing.

## References

- [`scripts/build-card-mechanics-metadata.mjs`](../scripts/build-card-mechanics-metadata.mjs)
  — WP-269 / D-24046, the generated hero-mechanic index producer.
- [`scripts/hero-mechanic-ledger.mjs`](../scripts/hero-mechanic-ledger.mjs),
  [`scripts/villain-mechanic-ledger.mjs`](../scripts/villain-mechanic-ledger.mjs)
  — the mechanic ledgers.
- [`packages/game-engine/src/diagnostics/hollowEffect.record.ts`](../packages/game-engine/src/diagnostics/hollowEffect.record.ts)
  — the hollow (reachability) detector.
- [`apps/arena-client/src/diagnostics/effectProvenance.ts`](../apps/arena-client/src/diagnostics/effectProvenance.ts)
  — client-side per-seat effect provenance.
- [`docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md`](../docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md),
  [`DESIGN-HOLLOW-EFFECT-DETECTION.md`](../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md),
  [`DESIGN-EFFECT-MODEL-DECISION.md`](../docs/ai/DESIGN-EFFECT-MODEL-DECISION.md)
  — the authoring-at-scale strategy, the coverage / hollow-detection spine, and
  the composable-primitive decision (D-24029) whose drift posture the "avoid a
  hand-maintained lookup" rule follows.
- [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) — determinism and
  persistence boundaries: traces and diagnostics are runtime-only, never in `G`.
- [Card Effect System](card-effect-system.md),
  [Play Diagnostics](play-diagnostics.md),
  [Rule Execution Pipeline](rule-execution-pipeline.md),
  [Dashboard](dashboard.md) — related wiki pages.
