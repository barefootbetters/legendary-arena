---
title: Windows Engine Exe
type: Tool
tags:
  - layer-engine
  - simulation
  - determinism
  - tooling
  - packaging
related:
  - par-simulation-calibration.md
  - complete-game-fixtures.md
  - scoring.md
  - wiki-viewer.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\windows-engine-exe.md (this page — https://ewiki.legendary-arena.com/windows-engine-exe/)
  - ../docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md
  - ../packages/game-engine/src/simulation/sweep.runner.ts
  - ../packages/game-engine/src/simulation/ai.competent.ts
  - ../packages/game-engine/src/simulation/par.aggregator.ts
last-reviewed: 2026-07-01
---

# Windows Engine Exe

> **Status: planning, not shipped.** This page describes a packaging and
> distribution effort that has **not landed in `main`**. It is a descriptive
> companion to the authoritative strategy document at
> [`docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md`](../docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md)
> — that document owns scope, decisions, work packets, and the Definition of
> Done; this page cites it rather than restating them. It is promoted from
> `draft` to `canonical` once the Phase 1 binary exists and its determinism
> parity test passes.

## Summary

The Windows Engine Exe is a proposed standalone Windows executable that runs the
Legendary Arena game engine **locally — no Node.js install, no database, no
server**. Its Phase 1 target is a *headless engine runner*: play bot-vs-bot
matches, replay complete-game fixtures, and prove determinism, as one
distributable binary. Production multiplayer hosting stays on Render; the exe is
a complementary local verification-and-distribution vehicle, and it changes no
gameplay rule, move, phase, or determinism contract.

## Mechanics

`packages/game-engine` is a **library** (`main` → `dist/index.js`, exports
`LegendaryGame`) with no process entrypoint — something must *host* it. The
monorepo is ESM-only on Node ≥22; the engine and registry compile to `dist/`
via `tsc`, but `apps/server` runs TypeScript through the `tsx` loader at runtime
and has **no build step**, and the card registry reads its JSON from the
**filesystem** at startup. Those facts make Target A cheap (pure JavaScript, no
native dependencies, no database) and Targets B/C expensive.

### The three hosts, and why Target A is Phase 1

The strategy document evaluates three possible hosts and recommends the smallest
viable surface for the first binary.

| Target | What the exe runs | Datastore | Native deps | Phase |
|---|---|---|---|---|
| **A — Headless engine runner** | the existing `simulation/` harness only: bot-vs-bot play, fixture replay, determinism proof | none | none | **Phase 1 (recommended)** |
| **B — Local self-contained server** | `apps/server` (boardgame.io host) | Postgres → SQLite / in-memory | `sharp`, `pg`, boardgame.io CJS bundle | deferred |
| **C — Full production server** | the complete `apps/server` | Postgres (external) | all of B + every route's deps | stays on Render |

Target A goes first because it has the **lowest dependency surface** → the
fastest path to a verifiable binary; it **reuses the exact harness** PAR
calibration and fixture replay already drive headlessly today; it has **zero
native modules** → simpler asset bundling and a lower antivirus surface; and it
delivers **immediate local value** for determinism verification and offline
simulation work.

### Determinism — the acceptance gate

Determinism is the entire point of the binary. The exe must produce a
**byte-identical `finalStateHash`** for a given seed, matching `node` running
the same `dist/` tree. If it does not, it is worthless as an engine mirror. The
strategy document makes this parity check the first, non-negotiable Phase 1
acceptance gate.

### Packaging approach

The classic `vercel/pkg` packager is archived. The strategy document's primary
choice is the maintained `@yao-pkg/pkg` fork, with Node's built-in Single
Executable Applications (SEA) as a parallel spike — now a one-step build via
`--build-sea` (Node ≥25.5), no more `postject` wiring. `bun --compile` yields the
smallest binary but runs **JavaScriptCore instead of V8**, so it is gated on
first proving byte-identical `finalStateHash` parity — the engine-swap is a
determinism risk, not just a library-compat one. Card and theme JSON ship either
embedded as assets or as a verified sidecar `data/` folder beside the binary.

```
  pnpm -r build ──▶ packages/*/dist   (ESM, pure JS)
        │
        ├── + card / theme JSON       (embedded assets or sidecar data/)
        ▼
  esbuild bundle ──▶ engine-runner entry
        ▼
  @yao-pkg/pkg  |  Node SEA  |  bun --compile
        ▼
  legendary-engine.exe
        └── modes:  run-match  ·  replay-fixture  ·  verify-determinism
```

## Interactions

- **[PAR Simulation Calibration](par-simulation-calibration.md).** The nearest
  neighbour. Both drive the same headless `simulation/` harness —
  [`sweep.runner.ts`](../packages/game-engine/src/simulation/sweep.runner.ts),
  the T2 competent policy, and the per-game `MOVE_MAP` loop. Calibration
  *derives PAR values* from the harness; the exe *distributes* it. Any new
  engine move must be added to that `MOVE_MAP` regardless of which host runs it
  — a drift risk both inherit.
- **[Complete-Game Fixtures](complete-game-fixtures.md).** A Phase 1 runner
  mode: the exe replays recorded games through the same move-dispatch path the
  fixture harness uses, and its determinism check compares the resulting
  `finalStateHash` against `node`.
- **[Scoring](scoring.md).** Unchanged — bot matches run under the existing Raw
  Score formula. The exe only relocates where the harness executes.
- **[Wiki Viewer](wiki-viewer.md).** This page follows the wiki schema and is
  projected read-only to `ewiki.legendary-arena.com`, like every other page.

## Edge Cases

The hazards are packaging-environment concerns, not engine-logic ones — the
engine is unchanged. Each is owned by the future Phase 1 work packet, not by
this page.

| Risk | Why it bites | Mitigation / status |
|---|---|---|
| Determinism drift | packaging, the V8 snapshot, a Node-version difference, or a non-V8 runtime (`bun` → JavaScriptCore) can perturb the hash | byte-identical replay is the Phase 1 gate; CI enforces parity; a non-V8 packager must clear it before adoption |
| Antivirus / SmartScreen flags | packed Node binaries (pkg / SEA / bun) are routinely flagged | code-sign the exe; an EV/OV cert for wider distribution |
| Native-module embedding | `sharp` / `pg` cannot live inside a V8 snapshot | Target A has no native deps; B/C ship them as sidecar `.node` files |
| Card data at runtime | the registry reads JSON from disk at startup | embed as assets or ship a verified sidecar `data/` folder |
| Scope ambiguity | "engine exe" could mean runner, local server, or full server | the strategy document forces the choice before any work packet is cut |

- **This is a plan, not a shipped tool.** Per the wiki schema, pages for
  features not yet in `main` are `draft`. Treat every forward-looking claim here
  as *proposed in the strategy document*, not as established engine behaviour.
- **Binary size.** The Node runtime plus the card corpus can push the exe into
  the tens of MB — acceptable for a tool, but noted for distribution.

## Code Touchpoints

- [`packages/game-engine/src/simulation/sweep.runner.ts`](../packages/game-engine/src/simulation/sweep.runner.ts)
  — batch host over the scenario matrix; the harness Phase 1 packages
- [`packages/game-engine/src/simulation/ai.competent.ts`](../packages/game-engine/src/simulation/ai.competent.ts)
  — the T2 competent policy that drives bot-vs-bot play
- [`packages/game-engine/src/simulation/par.aggregator.ts`](../packages/game-engine/src/simulation/par.aggregator.ts)
  — the per-game Monte-Carlo loop and `MOVE_MAP` the runner reuses

## References

- [`docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md`](../docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md)
  — authoritative strategy: scope fork, packaging-tool comparison, build
  pipeline, testing matrix, work-packet breakdown, and Definition of Done
- [PAR Simulation Calibration](par-simulation-calibration.md) — the sibling
  consumer of the same headless simulation harness
- [Complete-Game Fixtures](complete-game-fixtures.md) — the fixture-replay
  harness the runner reuses
- [Scoring](scoring.md) — the Raw Score formula bot matches run under
