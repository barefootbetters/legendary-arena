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
  - ../docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md
  - ../packages/game-engine/src/simulation/sweep.runner.ts
  - ../packages/game-engine/src/simulation/ai.competent.ts
  - ../packages/game-engine/src/simulation/par.aggregator.ts
last-reviewed: 2026-07-01
---

# Windows Engine Exe

> **Status: planning, not shipped.** This page describes an effort that has
> **not landed in `main`**. It is a descriptive companion to the strategy
> document at
> [`docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md`](../docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md),
> which is authoritative for scope, decisions, work packets, and the
> Definition of Done. This page cites that document; it does not restate its
> decisions. It will be promoted from `draft` to `canonical` once the Phase 1
> binary exists and can be verified.

## Summary

The Windows Engine Exe is a proposed standalone `.exe` that runs the Legendary
Arena game engine on a Windows machine **without a Node.js install, without a
database, and without the server**. Its Phase 1 target is a *headless engine
runner*: it hosts the engine's existing simulation harness to play bot-vs-bot
matches, replay fixtures, and prove determinism as a single distributable
binary. It is a packaging and distribution effort — no gameplay rule, move,
phase, or determinism contract changes.

## Mechanics

`packages/game-engine` is a **library**: its `main` is `dist/index.js` and it
exports `LegendaryGame`. It has no process entrypoint and cannot run by itself —
something has to *host* it. The strategy document identifies three possible
hosts and recommends the smallest one for the first binary:

- **Target A — headless engine runner (the Phase 1 target).** Hosts the
  engine's `simulation/` harness only. No network, no database, no native
  modules. This is the truest reading of "an exe of the game engine," and it is
  already substantially built: the same harness is driven headlessly today by
  the repo's simulation scripts.
- **Target B — local self-contained server.** Packages `apps/server`
  (the boardgame.io host), which pulls in native `sharp`, `pg`/PostgreSQL, and
  boardgame.io's CJS-only server bundle. Deferred.
- **Target C — full production server.** Recommended to stay on Render rather
  than ship as a binary.

The packaging constraints the strategy document works within are all properties
of the current codebase: the monorepo is **ESM-only on Node ≥22**; the engine
and registry already compile to `dist/` via `tsc`, but `apps/server` runs
TypeScript through the `tsx` loader at runtime and has no build step; the card
registry reads its JSON from the **filesystem** at startup, so any binary must
carry that data as an asset or sidecar folder. These are the facts that make
Target A cheap (pure JS, no native deps, no DB) and Targets B/C expensive.

The classic `vercel/pkg` packager is archived; the strategy document evaluates
the maintained `@yao-pkg/pkg` fork, Node's built-in Single Executable
Applications (SEA), and `bun --compile`, and treats a byte-identical
determinism-hash replay (binary vs `node` on the same `dist/` and seed) as the
load-bearing acceptance test.

## Interactions

- **[PAR Simulation Calibration](par-simulation-calibration.md).** This is the
  closest neighbour. The Windows Engine Exe and the PAR pipeline **host the same
  headless substrate** — the engine's `simulation/` harness
  ([`sweep.runner.ts`](../packages/game-engine/src/simulation/sweep.runner.ts),
  the T2 competent policy in
  [`ai.competent.ts`](../packages/game-engine/src/simulation/ai.competent.ts),
  and the per-game Monte-Carlo loop in
  [`par.aggregator.ts`](../packages/game-engine/src/simulation/par.aggregator.ts)).
  PAR Calibration uses that harness to *derive a scenario's PAR value*; the
  Windows exe would *package that harness as a distributable binary*. They are
  neighbours, not the same concern: one is a calibration methodology, the other
  a distribution vehicle. Any new engine move must be added to that harness's
  `MOVE_MAP` regardless of which host runs it — the same drift hazard both this
  binary and calibration inherit.
- **[Complete-Game Fixtures](complete-game-fixtures.md).** Fixture replay is one
  of the Phase 1 runner's modes; the exe would replay recorded games through the
  same duplicated move-dispatch path the fixture harness uses, and its
  determinism check compares the resulting `finalStateHash` against `node`.
- **[Scoring](scoring.md).** Bot matches run under the same Raw Score formula;
  the exe changes nothing about scoring, it only relocates where the harness
  executes.
- **[Wiki Viewer](wiki-viewer.md).** This page is authored under the wiki schema
  and projected read-only to `ewiki.legendary-arena.com`, like every other page.

## Edge Cases

- **This is a plan, not a shipped tool.** Per the wiki schema, pages for
  features not yet in `main` are `draft`. Treat every forward-looking claim here
  as *proposed in the strategy document*, not as established engine behaviour.
- **"Game engine exe" is ambiguous until scope is fixed.** The engine library
  cannot run alone. A headless runner (Target A), a local server (Target B), and
  a production server (Target C) are three very different binaries with very
  different dependency surfaces; the strategy document exists to force that
  choice before any work packet is cut.
- **Native modules cannot be embedded.** `sharp` and `pg` (Targets B/C) ship as
  sidecar `.node` files next to the binary, never inside the V8 snapshot. Target
  A avoids the hazard entirely by having no native dependencies.
- **Packed Node binaries are commonly antivirus-flagged.** Windows
  Defender/SmartScreen routinely flags pkg/SEA output; code-signing is the
  documented mitigation if the binary is distributed to end users.
- **Determinism is the whole point.** If the packaged binary does not replay to a
  byte-identical `finalStateHash` for a given seed, it has no value as an engine
  mirror. The strategy document makes that parity the first acceptance gate.

## References

- [`docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md`](../docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md)
  — authoritative strategy: scope fork, packaging-tool comparison, build
  pipeline, testing matrix, work-packet breakdown, and Definition of Done
- [PAR Simulation Calibration](par-simulation-calibration.md) — the sibling
  consumer of the same headless simulation harness
- [`packages/game-engine/src/simulation/sweep.runner.ts`](../packages/game-engine/src/simulation/sweep.runner.ts)
  — batch host over the scenario matrix; the harness Phase 1 would package
- [`packages/game-engine/src/simulation/ai.competent.ts`](../packages/game-engine/src/simulation/ai.competent.ts)
  — the T2 competent policy that drives bot-vs-bot play
- [`packages/game-engine/src/simulation/par.aggregator.ts`](../packages/game-engine/src/simulation/par.aggregator.ts)
  — the per-game Monte-Carlo loop and `MOVE_MAP` the runner reuses
