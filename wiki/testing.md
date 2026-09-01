---
title: Testing
type: Guide
tags:
  - testing
  - determinism
  - drift-detection
  - ci
  - governance
  - node-test
related:
  - complete-game-fixtures.md
  - development-workflow.md
  - debug-effects.md
  - dashboard.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\testing.md (this page — https://ewiki.legendary-arena.com/testing/)
  - ../docs/06-TESTING.md
  - ../.claude/CLAUDE.md
  - ../.claude/rules/code-style.md
  - ../docs/ai/REFERENCE/complete-game-tests.md
  - ../docs/ai/execution-checklists/EC-598-engine-test-typecheck-gate.checklist.md
  - ../apps/dashboard/docs/jarvis-command-center.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-08-31
---

# Testing

## Summary

Testing in Legendary Arena is **determinism-first and architecture-authoritative**:
if a test contradicts an architectural invariant, the test is wrong, not the
architecture ([06-TESTING.md](../docs/06-TESTING.md)). The runner is native
`node:test`; tests never touch the network, a database, a live boardgame.io
server, `Math.random()`, or the wall clock. This page is the **map**: what is
tested, what is *deliberately* not tested or not CI-gated, and how to run the
suite locally. It cites the authoritative testing doc and rules; it does not
redefine them.

> **Authority** — This page is informational. The authoritative requirements
> live in [06-TESTING.md](../docs/06-TESTING.md), [CLAUDE.md](../.claude/CLAUDE.md),
> [code-style.md](../.claude/rules/code-style.md), and the cited decisions and
> execution checklists. If anything here conflicts with those, **they win** and
> this page is the thing to fix.

## Mechanics

### Testing model

Four layers, lowest to highest. Higher layers **supplement** lower ones; they
never replace them — a finding from a higher layer should, where possible, be
reproduced as a deterministic test in a lower one.

| Layer | What it is | Deterministic? | Part of the test suite? |
|---|---|---|---|
| **1 · Unit + Contract** | Pure logic — zone ops, parsers, validators, type/field shapes. No I/O, no framework. | Yes | Yes |
| **2 · Integration + Framework** | Multiple engine surfaces together; framework-owned surfaces (e.g. `ctx.gameover`) via boardgame.io's own `InitializeGame`. | Yes | Yes |
| **3 · Replay / Complete-Game** | Recorded matches replayed through three oracle layers; detects gameplay drift and behavioral regressions. | Yes | Yes |
| **4 · Operational Validation (QA)** | Simulation sweeps, dashboard anomaly detection, nightly triage. | Reproducible, not a pass/fail gate | **No — QA, not the formal suite** |

> **Tests vs QA.** Layers 1–3 are the deterministic, CI-gated test suite. Layer
> 4 (the [Simulation Loop](dashboard.md) and dashboard anomaly detection) is a
> **QA instrument** — it surfaces candidates, but does not pass or fail a build.
> A simulation finding earns its keep only once it is reproduced as a
> deterministic test at Layer 1–3.

The rest of this section expands Layers 1–3 in detail: the runner, the per-type
table, drift detection, and the deliberate boundaries.

### Runner and conventions

The runner and its hard conventions are locked in
[CLAUDE.md](../.claude/CLAUDE.md) and
[code-style.md](../.claude/rules/code-style.md); the full detail is in
[06-TESTING.md](../docs/06-TESTING.md):

| Setting | Value |
|---|---|
| Runner | `node:test` (native Node.js) |
| Assertions | `node:assert` (native Node.js) |
| File extension | `.test.ts` — **never** `.test.mjs` |
| Node version | v22+ (built-in test runner + `fetch`) |
| Module system | ESM only — no CommonJS |
| Mock context | `makeMockCtx` (`packages/game-engine/src/test/mockCtx.ts`); its `ctx.random.Shuffle` **reverses** arrays to prove a shuffle ran |

**Forbidden:** Vitest / Jest / Mocha, `boardgame.io/testing`, the `.test.mjs`
extension, and any live server or database connection inside a unit test.

### What's tested

Coverage spans the engine, registry, and server. The engine carries the bulk of
it, one test type per architectural surface
([06-TESTING.md § Test Types](../docs/06-TESTING.md)):

| Type | File pattern | Purpose |
|---|---|---|
| Unit | `*.logic.test.ts` | Pure-function correctness (zone ops, parsers, validators) |
| Contract | `*.validate.test.ts` | Type shapes, field presence, error accumulation |
| Move | `moves/*.test.ts` | Move validation + stage gating |
| Setup | `setup/*.test.ts` | `Game.setup()`, `validateMatchSetup` |
| Rule Pipeline | `rules/*.test.ts` | Hook execution + effect application |
| Endgame | `endgame/*.test.ts` | Victory / loss condition evaluation |
| Persistence | `persistence/*.test.ts` | Snapshot purity, JSON-serializability, zone counts |
| Hero / Board / Scheme | `hero/*`, `board/*`, `scheme/*` | Keyword execution, conditional evaluation |
| Integration | `*.integration.test.ts` | Cross-system verification |
| Drift Detection | inline | Canonical arrays match union types (below) |
| Replay / Complete-Game | `replay/*`, fixtures | Full-game replay from recorded moves |

The **complete-game regression** layer replays whole recorded matches through
three oracle layers; authoring and re-recording those fixtures has its own
walkthrough in [Complete-Game Fixtures](complete-game-fixtures.md) and the
operator reference [complete-game-tests.md](../docs/ai/REFERENCE/complete-game-tests.md).

### Drift-detection tests

A recurring test shape guards the **canonical readonly arrays** against their
TypeScript union types — adding a phase, stage, move, trigger, effect, or card
type requires updating **both**, and a drift test fails loudly if they diverge
([code-style.md § Drift Detection](../.claude/rules/code-style.md)). The pinned
arrays include `MATCH_PHASES`, `TURN_STAGES`, `CORE_MOVE_NAMES`,
`RULE_TRIGGER_NAMES`, `RULE_EFFECT_TYPES`, `REVEALED_CARD_TYPES`, `LOG_OUTCOMES`,
and `MENACE_TIERS`.

The design rule: **every architecture-controlled union type has exactly one
matching canonical array and exactly one drift-detection test.** New engine
drift pins must be **runtime** assertions — see the callout below.

> **Runtime Assertion Rule** — Because engine test files are **not**
> CI-typechecked (see the boundary below):
>
> - A **new** engine drift pin MUST be a **runtime** assertion (a `Object.keys`
>   keyset check or a value comparison) — never a bare `satisfies`, because
>   nothing compiles it on every run.
> - An **optional-field** addition can never be caught by a type-level pin (an
>   optional field satisfies `satisfies` by definition); pin it with a keyset
>   assertion on a **built** projection.
> - Type-only safeguards are documentation, not enforcement, until the
>   `typecheck:tests` gate is required.
>
> See [EC-598](../docs/ai/execution-checklists/EC-598-engine-test-typecheck-gate.checklist.md)
> and [DECISIONS.md](../docs/ai/DECISIONS.md) D-24372.

### What's deliberately NOT tested (or not CI-gated)

Naming the boundaries, so a gap is not mistaken for an oversight:

- **No I/O in unit tests — by design.** Unit tests never reach the network, a
  database, or a live boardgame.io server, and never use `Math.random()` or real
  time. A test that needs any of those is testing the wrong thing
  ([06-TESTING.md § Test Rules](../docs/06-TESTING.md)).
- **Engine test files are not typechecked in CI — deliberately, for now.**
  - *Current state:* the engine's `tsconfig.json` excludes `src/**/*.test.ts`;
    `build` (`tsc`) honours that exclusion and `test` (`tsx`) transpiles without
    checking — so engine test files historically never compiled. WP-563 added a
    `typecheck:tests` script, but it is **not a required CI check yet**: the
    suite still carries a large pre-existing error backlog, and a red required
    gate would block every unrelated PR.
  - *Consequence:* type-level pins are unenforced. New drift pins and
    optional-field guards must be **runtime** assertions — see the Runtime
    Assertion Rule above.
  - *References:*
    [EC-598](../docs/ai/execution-checklists/EC-598-engine-test-typecheck-gate.checklist.md),
    [DECISIONS.md](../docs/ai/DECISIONS.md) D-24372.
- **DB-backed server tests run locally and serialized — not in the default unit
  sweep.** Tests that exercise the Postgres-backed server share one local
  database, so `node:test`'s file-level concurrency races them; they must run
  with `--test-concurrency=1`, against a `TEST_DATABASE_URL` the operator
  provisions. They are not part of the pure, no-I/O unit tier.
- **The simulation harness bypasses boardgame.io — a known gap.** The headless
  `simulation/` bot-vs-bot harness (and `apps/engine-runner`) reimplements the
  turn loop directly and does **not** run inside the framework, so it cannot
  exercise framework-owned surfaces such as `ctx.gameover` wiring; a genuine
  framework-level test uses boardgame.io's own `InitializeGame` instead. Treat
  simulation output as a determinism / coverage instrument, not a replacement for
  framework tests.

### Running the suite locally

> Reference commands, not a checklist. The authoritative build-then-test rule is
> in [CLAUDE.md](../.claude/CLAUDE.md); this restates it.

**Build before you test.** Apps and cross-package tests import the built `dist`
of the packages they depend on, not their `src`. A package edit is invisible
until that package is rebuilt — which cuts both ways: a `src` fix that never
rebuilt yields a **false green**, and a stale/missing `dist` crashes a test file
at *import*, which `node:test` reports as a **false red** (the tests in that file
never register, so totals shrink at the same time). So the order is always:

```bash
pnpm install
pnpm -r build && pnpm -r test
```

Two traps worth knowing:

- `pnpm -r test` **bails on the first failing package**, masking every package
  after it. For whole-repo totals, use `pnpm -r --no-bail test`.
- The repo **root has no `test` script** — a bare `pnpm test` exits 1 with no
  output. Always use `pnpm -r test` (or `--filter <pkg>`).

A build may rewrite a CI-gated generated artifact (e.g. the LAGN JSON schema);
check `git status` after building and confirm a real diff — line-ending-only
churn is noise.

To run the engine test typecheck locally (not a CI gate — see above):

```bash
pnpm --filter @legendary-arena/game-engine typecheck:tests
```

### Healthy test environment

Binary acceptance criteria. A repo test environment is healthy when **all** of
these hold — if any fails, treat the environment as suspect until it is resolved
or explained:

- [ ] `pnpm -r build` succeeds.
- [ ] `pnpm -r test` succeeds (and `pnpm -r --no-bail test` for whole-repo totals).
- [ ] Drift-detection tests pass.
- [ ] Test totals are stable and expected — a **shrinking** total signals a
  stale `dist` import-crash, not a real pass.
- [ ] No import-crash failures (a stale/missing `dist` reported as a false red).
- [ ] Generated artifacts are unchanged or intentionally updated — judged by
  `git diff --numstat`, not a bare ` M` in `git status`.
- [ ] Replay / complete-game fixtures reproduce their recorded outcomes.

## Interactions

- **[Complete-Game Fixtures](complete-game-fixtures.md)** — the authoring
  Tutorial for the whole-game replay regression tests this page summarizes; its
  three oracle layers are the strongest determinism proof in the suite.
- **[Development Workflow](development-workflow.md)** — the CI and deploy loop
  the suite runs inside: merge to `main` triggers the gates, and a **nightly CI
  triage agent** turns sweep results into new work packets.
- **[Dashboard](dashboard.md) / the Jarvis Command Center** — the operator
  surface for the overnight **Simulation Loop** (bot-vs-bot sweeps, the anomaly
  oracle, the Inspector triage / handoff queue). The framework write-up lives at
  [`apps/dashboard/docs/jarvis-command-center.md`](../apps/dashboard/docs/jarvis-command-center.md)
  and its companions (`dashboard-operating-system.md`,
  `code-checks-and-balances.md`) — the natural home for the Jarvis testing/QA
  framework docs, linked from here so the wiki routes to them.
- **[Debug Effects](debug-effects.md)** — where a *card-level* "its ability did
  nothing" question goes: the hollow-effect detector and coverage ledger are the
  effect-authoring analogue of the drift tests here.

## Edge Cases

- **Stale `dist` fakes both directions.** A `src` fix with no rebuild passes
  against old `dist` (false green); a stale/missing `dist` import-crashes a test
  file (false red) — and the crash *shrinks* the total count, so a shrinking
  total is itself a stale-build signal. Rebuild before diagnosing any
  cross-package failure ([CLAUDE.md](../.claude/CLAUDE.md)).
- **First-failure bail hides later packages.** `pnpm -r test` stops at the first
  broken package; use `pnpm -r --no-bail test` when you need honest whole-repo
  totals.
- **DB suites race unless serialized.** They share one local Postgres; without
  `--test-concurrency=1` the files interleave and fail nondeterministically —
  which looks like a flaky test but is a concurrency artifact.
- **Engine `src/test/` ships in `dist`.** The engine test-support helpers under
  `src/test/` are compiled into the published `dist` — they are not stripped as
  a test-only tree, so treat them as shipped code, not throwaway fixtures.
- **A build can dirty a CI-gated artifact.** Rebuilding may regenerate a tracked
  generated file; judge drift by `git diff --numstat`, not by a ` M` in
  `git status` (generated artifacts often show a modified flag for line-ending
  churn alone).

## Open Questions

- **When does `typecheck:tests` become a required CI gate?** The engine test
  suite's pre-existing typecheck backlog must clear first; until then only
  runtime assertions gate on every run (D-24372). Errors the local gate surfaces
  are fixed **in the test file** — never with `any`, `@ts-ignore`,
  `@ts-expect-error`, a loosened base tsconfig, or a widened production type.
- **Where do the Jarvis QA-framework docs ultimately live?** Today they sit under
  `apps/dashboard/docs/`; this page links them, but whether they graduate into a
  dedicated wiki entity page is unsettled.

## References

- Authoritative testing doc — [06-TESTING.md](../docs/06-TESTING.md)
  (conventions, philosophy, test-type table, drift tests, snapshot rules,
  `makeMockCtx`)
- Locked conventions — [CLAUDE.md](../.claude/CLAUDE.md) (build-before-test,
  runner, `.test.ts`, `pnpm -r build && test`, `--no-bail`, root has no `test`
  script), [code-style.md](../.claude/rules/code-style.md) (canonical arrays +
  drift detection; the engine runtime-assertion rule)
- Complete-game regression —
  [Complete-Game Fixtures](complete-game-fixtures.md),
  [complete-game-tests.md](../docs/ai/REFERENCE/complete-game-tests.md)
- Engine test typecheck gate —
  [EC-598](../docs/ai/execution-checklists/EC-598-engine-test-typecheck-gate.checklist.md),
  [DECISIONS.md](../docs/ai/DECISIONS.md) (D-24372, `typecheck:tests` not yet a
  required check)
- Overnight simulation / QA framework —
  [`apps/dashboard/docs/jarvis-command-center.md`](../apps/dashboard/docs/jarvis-command-center.md),
  [Dashboard](dashboard.md)
- Related surfaces — [Development Workflow](development-workflow.md),
  [Debug Effects](debug-effects.md)
