---
title: Effect Rulings
type: Concept
tags:
  - layer-engine
  - effect
  - rulings
  - test-corpus
  - reward-integrity
  - lagn
  - drift-detection
related:
  - card-effect-system.md
  - lagn-v1.md
  - reward-integrity.md
  - debug-effects.md
  - rule-execution-pipeline.md
  - play-diagnostics.md
status: canonical
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\effect-rulings.md (this page — https://ewiki.legendary-arena.com/effect-rulings/)
  - ../docs/lagn-architecture-brief.md
  - ../docs/ai/work-packets/WP-704-effect-rulings-corpus.md
  - ../docs/ai/execution-checklists/EC-741-effect-rulings-corpus.checklist.md
  - ../docs/ai/DECISIONS.md
  - ../wiki/card-effect-system.md
last-reviewed: 2026-09-17
---

# Effect Rulings

## Summary

**Effect rulings** are a private, *executable* record of card-effect edge-case
decisions — each entry a **scenario**, the **expected outcome**, and **prose
explaining why** — stored as a structured `docs/ai/rulings/effect-rulings.json`
corpus and run by a `node:test` harness against the **real engine handlers**, so
a ruling can never silently drift from the code it describes. The LAGN
architecture brief calls this its "crown jewel" (layer 5) and the reason is
mercenary, not aesthetic: the architecture is reproducible and the Marvel card IP
is not owned, but the accumulated *analytical work* — the vocabulary decisions and
the messy edge-case rulings — is what is genuinely expensive to reproduce. It is
the one real moat.

> **Status: shipped (first slice).** The corpus exists and runs — **WP-704 /
> EC-741 / D-24524 (Active, 2026-09-17, PR #2092)**. The first slice landed the
> schema, the runtime validator, the executing harness, the per-ruling
> non-vacuity self-test, and a **14-ruling seed set** across D-24281 / D-24329 /
> D-24413 / D-24442 / D-24523; the engine suite runs them green (3558 → 3592/0,
> sentinels byte-identical). What remains is the *grind* of filling the corpus —
> a ruling captured per edge case as future WPs decide them (see
> [Open Questions](#open-questions)). Edge-case rulings still also live as
> `DECISIONS.md` prose, the [Card Effect System](card-effect-system.md) §Edge
> Cases, inline `// why:` comments, and the replay hash-oracle fixtures; the
> corpus is now the single *executable* home that keeps them from drifting.

## Mechanics

### Where the corpus lives (full paths)

All four files live in the **engine repo** (this repo), on `main`. The
repo-relative path is the durable identifier; the absolute path is that path
under whichever checkout you have on `main` (the canonical pCloud checkout is
`C:\pcloud\BB\DEV\legendary-arena\`).

| File | Repo-relative path (canonical) |
|---|---|
| The corpus | `docs/ai/rulings/effect-rulings.json` |
| Authoring guide (actions + kinds) | `docs/ai/rulings/README.md` |
| Runtime validator + closed vocabulary | `packages/game-engine/src/rules/effectRulings.validate.ts` |
| Executing harness (`node:test`) | `packages/game-engine/src/rules/effectRulings.test.ts` |

For example, the corpus in the canonical pCloud checkout on `main` is
`C:\pcloud\BB\DEV\legendary-arena\docs\ai\rulings\effect-rulings.json`. If a
checkout does not show `docs/ai/rulings/`, it is not on `main` (or is behind) —
`git checkout main && git pull` brings the folder in. The harness resolves the
corpus path from its own location via `import.meta.url` (never `process.cwd()`),
so `pnpm --filter @legendary-arena/game-engine test` reads the same JSON
regardless of where the run is launched.

### The entry shape

Each ruling is one JSON object:

```json
{
  "id": "reveal-or-wound-counts-hand-and-in-play",
  "mechanic": "reveal-or-wound",
  "decision": "D-24281",
  "scenario": { "...": "a minimal setup + one action to fire" },
  "expected": { "...": "post-state assertions" },
  "why": "Reveal-or-wound counts hand ∪ in-play, not hand alone, per the 2026-07-31 amendment."
}
```

`id` is unique and kebab-cased; `mechanic` names the effect under test;
`decision` cites the `D-` that settled it; `why` is **mandatory and non-empty** —
a ruling without rationale is a fixture, not a ruling, and the validator rejects
it. `scenario` names the cards in the relevant zones plus the acting player and
one action (an effect / keyword / primitive to fire). `expected` names the
post-state assertions (a zone's contents or counts, a resource delta, a log
line).

### Executed against the real handlers

The point of the format is that structured data can be **run**. The harness
(`packages/game-engine/src/rules/effectRulings.test.ts`) loads and validates the
corpus, and for each ruling builds a minimal `G` (via `buildInitialGameState` +
the engine's own fixture builders), fires the action through the **real handler**
with `makeMockMoveContext`, and asserts the expectation **on the handler's
output** — reusing the proven `ruleRuntime.integration.test.ts` pattern. Because
each ruling exercises production code, a ruling and the handler it describes
cannot drift: change the handler and the ruling reddens.

### Closed, drift-pinned vocabulary — no DSL

The scenario / expectation verbs are a **small, closed** set — canonical readonly
arrays with **runtime** drift pins (per the D-24372 engine-drift-pin rule), like
every other closed set in the engine. Each verb maps to one existing engine
helper in the harness. There is deliberately **no general scenario DSL**: the
union grows one member at a time, together with its harness mapping and the
ruling that needs it. This mirrors the D-24029 effect-primitive discipline —
absorb the real catalog one primitive at a time rather than speculatively
building a universal language up front.

### The reward-integrity core: per-ruling non-vacuity

A standing harness guard programmatically perturbs **every** ruling's `expected`
and asserts **that** ruling's case then fails. This proves each ruling asserts on
the handler's *output*, not on a value the setup already placed — a vacuous
ruling that would pass no matter what the handler does is caught automatically,
not by a one-shot manual flip. This is the [Reward Integrity](reward-integrity.md)
spine of the corpus: a ruling that cannot fail is not evidence of anything.

### Runtime validator, no zod

The ruling validator (`effectRulings.validate.ts`) is a **hand-written runtime
type guard plus closed unions — Node built-ins only, never zod**. The
`game-engine` package may import Node built-ins only; zod is the registry layer's
dependency, and a zod import would both break `pnpm -r build` and cross a layer
boundary. This follows the established engine precedent (a local structural
interface + a runtime guard + a drift-pinned canonical array, exactly the
`VillainEffectPrimitive` / `VILLAIN_EFFECT_PRIMITIVES` shape).

### Where it sits

**Alongside the handlers, not above them.** Nothing calls the corpus at runtime —
it is a test corpus, the specification the handlers are judged against, run in the
standard engine suite. It complements, and does not replace, the two things that
already exist:

- **Replay hash-oracle fixtures** assert *whole-game determinism* through an
  opaque hash — they carry no rationale and cannot isolate a single interaction.
- **The coverage indices** (`effect-implementation-index.json`, the mechanic
  ledgers, `runtime-observed-hollows.json`, surfaced on `/coverage` and
  [Debug Effects](debug-effects.md)) track *implementation status*, not
  *correctness*.

The rulings corpus is the missing middle: **focused single-interaction
correctness with human-readable rationale, executed.**

### Public / private split and naming

The public [LAGN](lagn-v1.md) surface is the verb list plus argument shapes only —
a validator can't check vocabulary it doesn't know. The edge-case rulings and the
analysis behind them are the **private** work product with standalone value, and
they stay in this repo. They are called **"effect rulings"**, never "LAGN
rulings" (which would wrongly imply they are part of the published standard), and
nothing about them lives in `packages/lagn-spec`.

## Interactions

- **[Card Effect System](card-effect-system.md)** — the corpus judges the three
  effect subsystems (hero / villain / scheme-mastermind handlers). It is the
  executable answer to that page's Known-gap #4 ("effect debugging is scattered")
  from the *correctness* side, where `/coverage` and Debug Effects answer the
  *reachability* side.
- **[LAGN Specification](lagn-v1.md)** — the public verb list + arg shapes; effect
  rulings are the private depth behind the same verb names. Same names, different
  visibility.
- **[Reward Integrity](reward-integrity.md)** — the per-ruling non-vacuity
  self-test is the concrete application of "don't game the grader": a ruling that
  cannot fail is exactly the always-pass fixture that discipline forbids.
- **[Rule Execution Pipeline](rule-execution-pipeline.md)** — the pipeline the
  harness drives when it fires each ruling's action through a real handler.
- **[Play Diagnostics](play-diagnostics.md)** — a live match export that captures
  a single interaction is the raw material a new ruling is often distilled from.

## Edge Cases

- **A ruling the harness cannot run is a hard failure, not a skip.** An unmapped
  verb reddens the suite. A non-executing ruling is precisely the drift the corpus
  exists to prevent — there is no `it.skip`, no always-pass fixture.
- **The seed count is subordinate to vocabulary minimalism.** The first slice
  targets **≥ 8** rulings migrated from decided edge cases, but a verb is **never**
  added solely to reach the count. If eight cannot be expressed by the members the
  seeds genuinely need, fewer ship and the rest are listed as deferred.
- **Format is JSON, never Markdown or TypeScript.** Markdown prose drifts from the
  handlers silently; TypeScript tangles the rulings into the codebase and loses the
  ability to hand them over as a document. Only structured data can be executed.
- **The harness's file read is a deliberate exemption.** `src/rules/` is otherwise
  no-I/O; the harness resolves the corpus path via `import.meta.url` (never
  `process.cwd()`) so it works under `pnpm --filter` and CI, and this one read is
  called out as a test-harness exemption.
- **Test corpus only — no gameplay change.** Standing up the corpus modifies no
  production handler, adds no `G` field, and leaves the `finalStateHash` /
  `PRE_WP080` sentinels byte-identical.

## History

- **2026-09-17** — LAGN architecture brief reconciled and committed to `main`
  (PR #2085); the reconciliation identifies the layer-5 rulings corpus as the one
  real gap between the brief's five-layer vision and what is actually built.
- **2026-09-17** — Scoped as **WP-704** (Executable effect-rulings corpus, first
  slice) with **EC-741** and reserved decision **D-24524**. Draft; not executed.
- **2026-09-17** — **Executed and shipped** (PR #2092; D-24524 Active). First
  slice: schema + runtime validator + harness + per-ruling non-vacuity self-test
  + a 14-ruling seed set. Test corpus only — engine suite 3558 → 3592/0,
  `finalStateHash` / `PRE_WP080` sentinels byte-identical.

## Open Questions

- **Seed set shipped.** The first slice landed 14 rulings across D-24281
  (reveal-or-wound counts hand ∪ in-play), D-24329 (KO-own-Wounds beneficial),
  D-24413 (Melter KO-or-keep), D-24442 (`optional-ko-reward` source widened to
  `inPlay`), and D-24523 (dual-class card counts as either printed class).
- **Filling the corpus is the ongoing grind.** Value is proportional to
  completeness: a dozen rulings is a gesture, several hundred covering the messy
  interactions is the moat. The first slice seeds it; a ruling captured per
  edge case as future WPs decide them is the enduring work.
- **A dashboard view** of the rulings is a possible later follow-on, explicitly
  out of scope for WP-704.

## References

- [`docs/lagn-architecture-brief.md`](../docs/lagn-architecture-brief.md) §5
  ("Rulings — the actual crown jewel") — the vision, the format rationale, and the
  public/private split.
- [`docs/ai/work-packets/WP-704-effect-rulings-corpus.md`](../docs/ai/work-packets/WP-704-effect-rulings-corpus.md)
  — the first-slice scope, contract, and non-negotiable constraints.
- [`docs/ai/execution-checklists/EC-741-effect-rulings-corpus.checklist.md`](../docs/ai/execution-checklists/EC-741-effect-rulings-corpus.checklist.md)
  — the execution contract (locked values, guardrails).
- [`docs/ai/DECISIONS.md`](../docs/ai/DECISIONS.md) — D-24524 (reserved; lands at
  execution); D-24281 / D-24329 / D-24413 / D-24442 / D-24523 (the seed rulings).
- [Card Effect System](card-effect-system.md) — the handlers the corpus judges,
  and its Known-gap #4.
- [Reward Integrity](reward-integrity.md) — the non-vacuity discipline.
