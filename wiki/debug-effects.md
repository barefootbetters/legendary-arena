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
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\debug-effects.md (this page — https://ewiki.legendary-arena.com/debug-effects/)
  - ../scripts/build-effect-implementation-index.mjs
  - ../scripts/coverage/tactic-provenance.json
  - ../scripts/build-card-mechanics-metadata.mjs
  - ../scripts/hero-mechanic-ledger.mjs
  - ../scripts/villain-mechanic-ledger.mjs
  - ../packages/game-engine/src/diagnostics/hollowEffect.record.ts
  - ../packages/game-engine/src/diagnostics/effectTrace.record.ts
  - ../packages/game-engine/src/diagnostics/hollowEffect.types.ts
  - ../packages/game-engine/src/rules/villainAbility.types.ts
  - ../apps/dashboard/src/pages/debug/EffectsPage.vue
  - ../apps/dashboard/src/composables/useEffectIndex.ts
  - ../apps/arena-client/src/diagnostics/effectProvenance.ts
  - ../apps/dashboard/src/pages/coverage/CoveragePage.vue
  - ../docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md
  - ../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md
  - ../docs/ai/DESIGN-EFFECT-MODEL-DECISION.md
  - ../docs/ai/ARCHITECTURE.md
last-reviewed: 2026-09-10
---

# Debug Effects

## Summary

Debug Effects is the answer to one recurring question: *"card X's printed
ability didn't do what it says — where do I look?"* (the canonical example:
*"Mystique's Escape didn't fire a Scheme Twist"*). That answer used to be
spread across several surfaces with no single place to start. It no longer is:
the **generated effect-implementation index** (WP-484 / D-24289), the
**`/debug/effects` viewer** that renders it (WP-487, on the operator Dashboard),
and **runtime effect tracing** (WP-488 / D-24294, `G.diagnostics.traces`) all
shipped in early August 2026, realizing the index-plus-trace direction this page
used to record as a proposal. The older per-surface tools — the coverage
ledgers, the generated `card-mechanics.json` index, the hollow-effect detector,
and the client-side [Play Diagnostics](play-diagnostics.md) provenance block —
still exist and still answer their own narrower questions; the effect index now
sits over the top of them as the single searchable entry point. This page maps
what each surface answers and how they fit together.

## Mechanics

### The question this answers

A misfired effect has a small, fixed set of causes, and each surface answers a
different one:

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
- *Which handler runs this card's effect, and under which decision?* — the
  generated **effect-implementation index** answers this for every card ×
  mechanic across all three scopes, joining status + handler + WP + governing
  DECISION into one row. The `/debug/effects` viewer is the search-and-filter
  surface over it.
- *What actually happened when this card's effect dispatched — including any
  secondary fire site?* — a **runtime effect trace** records each dispatch's
  primitive, params, the handler label that ran, the outcome, and the emitting
  fire site. This is the surface that distinguishes a deliberate no-op handler
  from a real misfire.
- *What did this seat actually see when it played the card?* — Play
  Diagnostics' `recentlyPlayedCards` records each played card's engine-authored
  `outcome` (`resolved` / `hollow` / `awaitingChoice` / `conditionNotMet`).

The recurring failure mode — Mystique's Escape — is a good worked example,
because it is a **fire-site** primitive: `become-scheme-twist`'s executor
handler is a deliberate no-op, and the actual Scheme Twist fires at the
[Villain Deck](villain-deck.md) escape site, not in the villain executor's
mutation surface (D-24287). A reachability check alone ("did a handler run?")
would read *applied* while the Twist never fired — which is exactly why the
runtime **trace** records a `fireSite`: it names the code site that emitted the
effect, so the escape-time Twist is visible as a distinct fire site rather than
hidden behind a no-op executor. See [Card Effect System](card-effect-system.md#villain-effects-parameterized-descriptors).

### What exists today (shipped)

| Surface | Answers | Where it lives |
|---|---|---|
| **Effect-implementation index** (`pnpm effect-index`) | For every card × mechanic across hero / villain / mastermind scopes: status · handler · WP · governing decision. The three-scope data backbone the viewer reads | [`build-effect-implementation-index.mjs`](../scripts/build-effect-implementation-index.mjs) (WP-484 / D-24289; mastermind-tactic feed WP-507 / D-24313) → `data/metadata/effect-implementation-index.json` |
| **`/debug/effects` viewer** | The index rendered as a searchable, scope/status/set-filterable table, with a per-status summary; a blank handler/WP/decision (—) is the honest "no handler ran" signal, never fabricated | [`EffectsPage.vue`](../apps/dashboard/src/pages/debug/EffectsPage.vue) (WP-487) + [`useEffectIndex.ts`](../apps/dashboard/src/composables/useEffectIndex.ts); set filter WP-536, design-name search WP-491 |
| **Runtime effect tracing** | Per-dispatch trace (`cardId`, `scope`, `timing`, `effect`, `handler`, `status`, `fireSite`, `params`, `turn`) written to `G.diagnostics.traces` — the "handler reached but which fire site, and did it no-op?" record | [`effectTrace.record.ts`](../packages/game-engine/src/diagnostics/effectTrace.record.ts) (WP-488 / D-24294) |
| **Mechanic ledgers** (`pnpm ledger:heroes` / `ledger:villains`) | Per card × mechanic status: `executable` · `deferred` · `condition` · `unsupported` (code gap) · `unmarked` (data gap) · `subsystem` (implemented ELSEWHERE — done, not a TODO) | [`hero-mechanic-ledger.mjs`](../scripts/hero-mechanic-ledger.mjs), [`villain-mechanic-ledger.mjs`](../scripts/villain-mechanic-ledger.mjs) → `docs/ai/coverage/*.json` |
| **Generated mechanic index** (`card-mechanics.json`) | A published, viewer-safe, per-card **hero**-mechanic index — derived from the hero ledger, validated against a registry schema, CI-gated for freshness | [`build-card-mechanics-metadata.mjs`](../scripts/build-card-mechanics-metadata.mjs) (WP-269 / D-24046) → `data/metadata/card-mechanics.json` |
| **Hollow-effect detector** | "declared but reached no handler" at runtime (reachability, not a state diff) | [`hollowEffect.record.ts`](../packages/game-engine/src/diagnostics/hollowEffect.record.ts) → `docs/ai/coverage/runtime-observed-hollows.json` |
| **`unresolvedMarkers`** | A mis-authored `[effect:X]` marker, detectable at the fire site | [`villainAbility.types.ts`](../packages/game-engine/src/rules/villainAbility.types.ts) (WP-257 / D-24034) |
| **Play Diagnostics provenance** | What one live seat saw: `awaitingPlayerInput` + `recentlyPlayedCards.outcome` | [`effectProvenance.ts`](../apps/arena-client/src/diagnostics/effectProvenance.ts) |
| **`/coverage` dashboard** | The ledger rendered as a by-mechanic worklist + by-card index | [`CoveragePage.vue`](../apps/dashboard/src/pages/coverage/CoveragePage.vue) (see [Dashboard](dashboard.md)) |

The load-bearing property shared by all of them: every one is **derived from
the real engine parser or a runtime hook** over `data/cards/*.json` — none is a
hand-maintained lookup that can silently disagree with the engine. The effect
index is a **verbatim join** of the hero and villain mechanic ledgers plus the
mastermind-tactic feed; it computes no new provenance and runs no second parser.

### How the effect index is built (generated, never authored)

The index is the "generated, never authored" artifact this page always argued
for. `build-effect-implementation-index.mjs` (WP-484):

1. Reads the hero and villain mechanic ledgers verbatim (the two derivation
   sources), and enumerates every mastermind tactic's IDENTITY (extId / name /
   set / mechanic) straight from `data/cards/*.json` (WP-507). Tactic
   status/handler/wp/decision comes from the curated overlay
   [`tactic-provenance.json`](../scripts/coverage/tactic-provenance.json) or the
   `unmarked` default — **never fabricated** (the WP-493 generated-identity /
   curated-provenance split).
2. Normalizes every ledger row and tactic into a scope-tagged entry
   (`hero` | `villain` | `mastermind`), passing status/handler/wp/decision
   through verbatim.
3. Sorts by (extId, mechanic), builds the per-card `cards{}` join, and computes
   the summary (counts by scope + status).
4. Validates the assembled artifact against `EffectImplementationIndexSchema`
   (the same registry schema the viewer parses with), so the artifact and the
   contract cannot drift apart.

It is **CI-gated for freshness** exactly like the mechanic ledgers: `pnpm
effect-index:check` regenerates in memory and fails if the committed
`effect-implementation-index.json` is stale. A card-data, keyword, or provenance
edit that shifts the index must be regenerated in the same change — the same
"regenerate the derived artifact" discipline as the coverage ledgers.

> **Curated-provenance gotcha.** A tactic (or any row) whose handler shipped but
> whose provenance overlay was never updated renders as `unmarked` — the honest
> "no handler ran" default, applied because the overlay is silent, not because
> the code is missing. Red Skull's three core Mastermind Tactics hit exactly
> this (handlers shipped in WP-567 / D-24376, overlay rows missing) and read
> `unmarked` on the viewer until the `tactic-provenance.json` rows were added and
> the index regenerated. When a shipped effect reads `unmarked`, check the
> provenance overlay before suspecting the handler.

### How the viewer reads it (build-time bundle)

`/debug/effects` (`EffectsPage.vue` + `useEffectIndex.ts`) renders the index
**verbatim** — it computes no provenance and runs no second parser, reusing
WP-484's schema contract. Two properties worth knowing:

- **The index is bundled at build time.** A dashboard prebuild step copies
  `data/metadata/effect-implementation-index.json` into the app's (gitignored)
  `src/data/` and the page statically imports it. So the **deployed** viewer
  reflects the index as of the **last dashboard deploy** — a freshly-regenerated
  index shows up only after the dashboard rebuilds and redeploys, not the moment
  the artifact changes on `main`.
- **A bad bundle degrades to empty, never crashes.** The bundle is parsed
  through `EffectImplementationIndexSchema` and a validation failure renders an
  empty index plus a load-error banner (the `/coverage` precedent), so a
  corrupt or stale-stub artifact fails visibly rather than white-screening.

The operator Dashboard sits behind Cloudflare Access (WP-197), so the viewer is
operator-reachable only.

### Runtime effect tracing (`G.diagnostics.traces`)

WP-488 / D-24294 added `recordEffectTrace`, the single seam the effect caller
loops call to append one `EffectTrace` per dispatch to the runtime-only
`G.diagnostics.traces` channel. It mirrors the hollow detector's discipline —
lazy-init `G.diagnostics` (never in `Game.setup()`), append, bound by
`EFFECT_TRACES_CAP` with a dropped-counter, never throw — with one deliberate
divergence: it writes **no** `G.messages` log line (a trace fires on every
dispatch, and `G.messages` is a hashed, fixture-covered field, so per-dispatch
logging would spam the log and churn the sentinels). A trace records the
dispatched primitive, its params, the handler label that ran (`""` when none),
the outcome status, and the **`fireSite`** — the code site that emitted it,
which is what makes a secondary fire site (the Mystique / escape-Twist case)
visible rather than hidden behind a deliberate no-op executor.

Traces are a diagnostic side-channel: **runtime-only, hash-excluded from both
oracles, never persisted, never a save-game, and never read as gameplay input**
by any move / rule / `endIf` / bot / scoring path ([ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md)
Persistence Boundaries — the same posture as `G.diagnostics` hollow records).

### What this deliberately avoids

The realized design still rules out a **hand-curated `card-effects-lookup.json`**
that lists every card → effect text → code location. It would become a second
source of truth and drift the moment someone adds a marker and forgets the
lookup — the exact failure mode the marker + descriptor + coverage system was
built to avoid ([DESIGN-EFFECT-MODEL-DECISION.md](../docs/ai/DESIGN-EFFECT-MODEL-DECISION.md),
D-24029; the drift-detection posture in
[Card Effect System](card-effect-system.md)). The same reasoning rules out
putting handler function references or code paths **into the card JSON itself**,
and building the debugger as a **second parser** that can disagree with the real
setup-time parser. The boundary the effect system enforces — *data* (markers →
descriptors) versus *code* (closed executors) — is the boundary the debugging
surface respects: the generated index maps across it (a verbatim join of
already-derived ledgers); it never duplicates either side by hand. This is why
the handler column holds a string **label**, not a function reference, and why a
missing provenance row shows `unmarked` rather than a guessed attribution.

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
  `onSchemeTwistRevealed` through this pipeline, which a trace records as a
  distinct `fireSite`.
- **[Dashboard](dashboard.md).** Hosts the shipped `/coverage` page, the
  `/debug` page, and the `/debug/effects` viewer described here.
- **[Master Strike](master-strike.md) / [Villain Deck](villain-deck.md).** The
  mastermind and villain fire sites whose per-mastermind hand-coded dispatch and
  escape-time Twist trigger are the cases a static status map handles worst and a
  runtime trace handles best.

## Edge Cases

- **The viewer shows the static index, not live traces.** `/debug/effects`
  renders the generated effect-implementation index. Runtime traces
  (`G.diagnostics.traces`) are a per-match engine-side channel surfaced through
  the engine / Play Diagnostics path, **not** joined into the dashboard viewer
  today — a card's last live traces are not displayed alongside its index row.
- **The deployed viewer lags the artifact.** Because the index is bundled at
  dashboard build time, a regenerated index reaches the live page only on the
  next dashboard deploy. `pnpm effect-index:check` is the authoritative
  freshness signal on `main`; the deployed viewer is not.
- **`unmarked` can mean "handler shipped, overlay stale."** A blank
  handler/WP/decision is an honest "no handler ran" signal for genuinely
  unmarked or unsupported rows — but for mastermind tactics (and any
  overlay-curated row) it can instead mean the provenance overlay was never
  updated for a shipped handler. Check `tactic-provenance.json` / the ledgers
  before concluding the code is missing (the Red Skull WP-567 case).
- **The generated `card-mechanics.json` index is hero-only.** Distinct from the
  three-scope effect-implementation index: `card-mechanics.json` is the older
  "filter heroes by mechanic" feed (WP-269 / D-24046), hero-scoped and without
  handler mapping. The effect-implementation index is the superset the viewer
  reads.
- **Reachability ≠ correctness.** The hollow detector reports whether a handler
  ran, not whether it produced the right state change. A deliberate no-op
  handler (Mystique's `become-scheme-twist`, D-24287) reads as *applied* even
  though the real work happens elsewhere — the case a trace's `fireSite`, not a
  static reachability check, resolves.
- **Traces are runtime-only.** A trace is a diagnostic side channel, never part
  of the hashed determinism surface — `G` stays JSON-serializable and
  `G.diagnostics` is hash-excluded from both oracles ([ARCHITECTURE.md](../docs/ai/ARCHITECTURE.md)
  Persistence Boundaries). Nothing here authorizes a hashed-`G` shape change.

## Code Touchpoints

- [`scripts/build-effect-implementation-index.mjs`](../scripts/build-effect-implementation-index.mjs)
  — the generated three-scope effect-implementation index producer
  (`data/metadata/effect-implementation-index.json`), CI-gated via
  `effect-index:check` (WP-484 / D-24289; tactic feed WP-507 / D-24313).
- [`scripts/coverage/tactic-provenance.json`](../scripts/coverage/tactic-provenance.json)
  — the curated mastermind-tactic status/handler/wp/decision overlay the index
  reads (identity comes from the card data, provenance from here).
- [`apps/dashboard/src/pages/debug/EffectsPage.vue`](../apps/dashboard/src/pages/debug/EffectsPage.vue),
  [`apps/dashboard/src/composables/useEffectIndex.ts`](../apps/dashboard/src/composables/useEffectIndex.ts)
  — the `/debug/effects` viewer (WP-487) and the composable that validates and
  renders the bundled index (set filter WP-536, design-name search WP-491).
- [`packages/game-engine/src/diagnostics/effectTrace.record.ts`](../packages/game-engine/src/diagnostics/effectTrace.record.ts),
  [`hollowEffect.types.ts`](../packages/game-engine/src/diagnostics/hollowEffect.types.ts)
  — runtime effect tracing (`recordEffectTrace` → `G.diagnostics.traces`) and
  the `EffectTrace` contract (WP-488 / D-24294).
- [`packages/game-engine/src/diagnostics/hollowEffect.record.ts`](../packages/game-engine/src/diagnostics/hollowEffect.record.ts)
  — the runtime hollow (reachability) detector.
- [`scripts/build-card-mechanics-metadata.mjs`](../scripts/build-card-mechanics-metadata.mjs),
  [`scripts/hero-mechanic-ledger.mjs`](../scripts/hero-mechanic-ledger.mjs),
  [`scripts/villain-mechanic-ledger.mjs`](../scripts/villain-mechanic-ledger.mjs)
  — the hero-mechanic index and the per-card × mechanic ledgers the effect index
  joins.
- [`packages/game-engine/src/rules/villainAbility.types.ts`](../packages/game-engine/src/rules/villainAbility.types.ts)
  — `unresolvedMarkers` and the descriptor vocabulary a trace names.
- [`apps/arena-client/src/diagnostics/effectProvenance.ts`](../apps/arena-client/src/diagnostics/effectProvenance.ts)
  — the shipped client-side per-seat outcome provenance.
- [`apps/dashboard/src/pages/coverage/CoveragePage.vue`](../apps/dashboard/src/pages/coverage/CoveragePage.vue)
  — the sibling `/coverage` render.

## Data Files

- `data/metadata/effect-implementation-index.json` — the generated, CI-gated
  three-scope effect-implementation index the `/debug/effects` viewer reads.
- `scripts/coverage/tactic-provenance.json` — the curated mastermind-tactic
  provenance overlay.
- `data/metadata/card-mechanics.json` — the generated, CI-gated hero-mechanic
  index (the older hero-only feed).
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
  `villain-mechanic-ledger.{json,csv}` — the committed mechanic ledgers.
- `docs/ai/coverage/runtime-observed-hollows.json` — the committed runtime
  hollow-effect record.

## Open Questions

- **Live traces are not surfaced in the dashboard viewer.** `/debug/effects`
  renders the static index; the runtime `G.diagnostics.traces` channel (WP-488)
  is engine-side and reaches operators only through the engine / Play
  Diagnostics path. Joining "the last live traces for a card" into the viewer
  alongside its index row remains unbuilt — a future WP + DECISIONS entry would
  govern it.
- **The generated `card-mechanics.json` remains hero-only.** The
  three-scope effect-implementation index supersedes it for the viewer, but the
  older hero-mechanic feed is still produced and consumed independently; whether
  to retire or fold it into the effect index is unresolved.

## References

- WP-484 / D-24289 (EC-519) — Effect Implementation Index (contract + transform
  + CI gate). WP-507 / D-24313 (EC-542) — the mastermind-tactic feed. WP-493
  (EC-528) / WP-495 (EC-530) — the provenance WP/Decision backfill.
- WP-487 (EC-522) — the `/debug/effects` viewer. WP-536 (EC-571) — the set
  filter. WP-491 (EC-526) — hero-ledger design attribution (design-name search).
- WP-488 / D-24294 (EC-523) — runtime effect tracing (`G.diagnostics.traces`).
- WP-548 / D-24357 (villains), WP-559 / D-24368 (heroes) — the `subsystem`
  status; WP-269 / D-24046 — the `card-mechanics.json` hero index it mirrors.
- [`scripts/build-effect-implementation-index.mjs`](../scripts/build-effect-implementation-index.mjs),
  [`apps/dashboard/src/pages/debug/EffectsPage.vue`](../apps/dashboard/src/pages/debug/EffectsPage.vue),
  [`packages/game-engine/src/diagnostics/effectTrace.record.ts`](../packages/game-engine/src/diagnostics/effectTrace.record.ts)
  — the index producer, the viewer, and the trace writer.
- [`docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md`](../docs/ai/DESIGN-EFFECT-AUTHORING-SCALE.md),
  [`DESIGN-HOLLOW-EFFECT-DETECTION.md`](../docs/ai/DESIGN-HOLLOW-EFFECT-DETECTION.md),
  [`DESIGN-EFFECT-MODEL-DECISION.md`](../docs/ai/DESIGN-EFFECT-MODEL-DECISION.md)
  — the authoring-at-scale strategy, the coverage / hollow-detection spine, and
  the composable-primitive decision (D-24029) whose drift posture the "avoid a
  hand-maintained lookup" rule follows.
- [`docs/ai/ARCHITECTURE.md`](../docs/ai/ARCHITECTURE.md) — determinism and
  persistence boundaries: traces and diagnostics are runtime-only, never in the
  hashed `G` surface.
- [Card Effect System](card-effect-system.md),
  [Play Diagnostics](play-diagnostics.md),
  [Rule Execution Pipeline](rule-execution-pipeline.md),
  [Dashboard](dashboard.md) — related wiki pages.
