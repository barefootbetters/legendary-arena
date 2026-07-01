# EC-334 — Engine-Runner Host + CLI (Headless Simulation Runner) — Execution Checklist

**Source:** docs/ai/work-packets/WP-304-engine-runner-host-cli.md
**Layer:** App (`apps/engine-runner`, new) · **Standard two-session lane** (D-24028)

## Before Starting (Hard Gate)
- [ ] Sim surface public: `grep -cE "runSimulation|createCompetentHeuristicPolicy" packages/game-engine/src/index.ts` ≥ 2 (consumed via `@legendary-arena/game-engine`, NOT a `dist/` deep import)
- [ ] `SimulationConfig` shape confirmed at `packages/game-engine/src/simulation/ai.types.ts` = `{ games, seed, setupConfig: MatchSetupConfig, policies: AIPolicy[] }`
- [ ] Registry loader pattern present: `grep -c "createRegistryFromLocalFiles" apps/server/src/server.mjs` ≥ 1 (`metadataDir: 'data/metadata'`, `cardsDir: 'data/cards'`)
- [ ] Strategy authority on `main`: `docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md` present (this packet = Target A, Phase-1 A1)
- [ ] Baseline: `pnpm -r build` → 0. At close: same, plus `pnpm --filter @legendary-arena/engine-runner test` green; **no other suite delta**

## Locked Values (do not re-derive)
- App name: `@legendary-arena/engine-runner` (private, `type: module`, `engines.node >=22`); deps `@legendary-arena/game-engine` + `@legendary-arena/registry` (`workspace:*`); devDep `tsx`
- `RunnerConfig` = `{ mode: 'run' | 'verify', scenarioPath: string, games: number, seed: string, outPath?: string }`
- `games` must parse to an **integer ≥ 1**; `seed` must be **non-empty**; `--scenario` **required** — any violation → structured parse error + non-zero exit, **no simulation run**
- Registry load: `createRegistryFromLocalFiles({ metadataDir: 'data/metadata', cardsDir: 'data/cards' })` (mirror `apps/server`)
- Policies: one `createCompetentHeuristicPolicy(seed)` **per player** in the scenario; the competent (T2) tier is the only policy this packet wires
- Determinism contract: identical `(scenario, games, seed)` → **byte-identical `SimulationResult` JSON** across runs (rests on `runSimulation`'s documented purity); `verify` runs twice + canonical-JSON compares
- `SimulationResult` fields (emit verbatim): `gamesPlayed`, `winRate`, `averageTurns`, `averageScore`, `escapedVillainsAverage`, `woundsAverage`, `seed`
- Import allowances (ARCHITECTURE.md row): MAY import `@legendary-arena/game-engine` (Runtime-Safe `.` subpath) + `@legendary-arena/registry` (+ `/setupContract`) + Node built-ins; MUST NOT import `boardgame.io`, `pg`, `apps/server`, `preplan`, `vue-sfc-loader`, `game-engine/setup`, browser APIs

## Guardrails
- **No engine/registry source change** — consume the public surface only; NO `packages/game-engine/dist/**` deep import, NO new engine export, NO `packages/**` edit. If a needed fn isn't public → STOP (different WP)
- **No packaging** — no esbuild/pkg/SEA/bun/`.exe`/CI-release in this packet; the runner runs under `node`+tsx like `apps/server`
- **No fixture-replay / no `finalStateHash`** — those need `src/test/fixtures/*` exposed = a later WP
- **Fail cleanly** — invalid `--scenario` (setup-contract reject), missing file, `games < 1`, empty seed → full-sentence stderr + non-zero exit; never a raw stack trace as primary UX, never a zeroed result presented as success
- **Deterministic run path** — no `Math.random()`, no wall-clock; seeds come from `--seed`; IO limited to registry read + scenario read + `--out` write; no network
- **Validate the scenario before running** — reject an invalid `MatchSetupConfig` via the registry setup contract up front (the sim path does not re-validate like `Game.setup`)
- `for...of` / explicit `if/else`; full-word names; JSDoc per function; `.test.ts` only

## Required `// why:` Comments
- On consuming `runSimulation` from `@legendary-arena/game-engine` (public surface, NOT a `dist/` deep import — the layer rule)
- On the determinism `verify` (two identical runs must byte-match; rests on `runSimulation`'s documented purity)
- On the up-front scenario setup-contract validation (the sim path skips `Game.setup`'s `validateMatchSetup`, so bad input would otherwise fault mid-run)
- On the competent-policy-per-player construction (T2 is the calibration-grade tier; one policy instance per seat)

## Files to Produce
- `apps/engine-runner/package.json` (new)
- `apps/engine-runner/src/index.mjs` (new — entrypoint / dispatch; `01.5` runtime-wiring)
- `apps/engine-runner/src/cli.ts` (new — pure arg parser) / `runMatch.ts` (new — load+validate+run+verify)
- `apps/engine-runner/src/cli.test.ts` + `runMatch.test.ts` (new)
- `docs/ai/ARCHITECTURE.md` + `.claude/rules/architecture.md` (modify — identical `apps/engine-runner` import row; D-24088)
- `pnpm-lock.yaml` (modify); `WORK_INDEX.md` + `EC_INDEX.md` + `STATUS.md` + `DECISIONS.md` (D-24088 lands Active)

## File Responsibilities (no logic duplication)
- `cli.ts` — the SINGLE arg→`RunnerConfig` parser + validation; no IO, no engine import (pure, unit-testable)
- `runMatch.ts` — registry load + scenario validate + `runSimulation` + `verifyDeterminism`; the only file importing the engine/registry
- `index.mjs` — process concerns only (argv in, dispatch, error→stderr+exit); no business logic

## Required Test Matrix (every row required)
- `cli.ts`: valid `run` argv → correct `RunnerConfig`; valid `verify` argv → correct config; missing `--scenario` / `--games 0` / non-integer games / empty `--seed` / unknown mode → structured error, no run
- `runMatch`: `run` on a valid fixture scenario + real registry → well-formed `SimulationResult` (all 7 fields)
- `verify`: repeated identical run → `identical: true` (end-to-end determinism)
- invalid scenario (fails setup contract) → full-sentence error, non-zero; missing scenario file → full-sentence error, non-zero
- layer grep: `grep -rE "boardgame\.io|from 'pg'|apps/server|/dist/" apps/engine-runner/src` → no matches

## After Completing
- [ ] App created; `run` + `verify` per Contract; determinism `verify` green; no packaging present
- [ ] No engine/registry source change; grep-clean imports; only public surface consumed
- [ ] ARCHITECTURE.md + `.claude/rules/architecture.md` carry the identical import row; **D-24088 landed Active**
- [ ] `pnpm -r build` 0; new-app suite green; no other suite delta
- [ ] WORK_INDEX (WP-304) / EC_INDEX (EC-334) / STATUS flipped; commit `EC-334:` (code) + `SPEC:` (governance)
- [ ] `api-endpoints.md` **N/A** (no HTTP / no library-from-server surface) — noted, not edited; D-24026 N/A (no player surface)
- [ ] Hand off to the packaging WP (Target A / A2): runner exists + node-runnable; next packet bundles+packs → `legendary-engine.exe` + exe-vs-node parity gate

## Common Failure Smells
- `dist/simulation/*` deep import appears → use the public `@legendary-arena/game-engine` surface (the layer rule; scripts deep-import, apps must not)
- `verify` ever returns non-identical for a repeated run → a wall-clock / `Math.random` / unseeded path leaked into the runner (the engine is deterministic; the leak is in the app)
- A malformed scenario faults mid-run with a stack trace → the up-front setup-contract validation was skipped
- `pnpm -r build` fails resolving the engine/registry → workspace deps not declared in `apps/engine-runner/package.json`
- Typecheck/import error pulling `boardgame.io` or `pg` → the runner reached past the public surface; keep to engine `.` + registry
- ARCHITECTURE.md updated but `.claude/rules/architecture.md` not (or vice-versa) → the import row must land in BOTH in the same commit (the D-24086 mirror-drift lesson)
