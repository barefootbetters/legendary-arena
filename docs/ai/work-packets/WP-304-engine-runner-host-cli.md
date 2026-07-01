# WP-304 — Engine-Runner Host + CLI (Headless Simulation Runner; Phase 1 of the Windows Engine Exe)

**Status:** Draft — ready to execute (drafted 2026-07-01) · **Standard two-session lane** (D-24028 — NOT lightweight: net-new app + a new architectural layer entry (import-rules row) + a reserved D-entry)
**Primary Layer:** App (new `apps/engine-runner`) — a host at the same layer as `apps/server`; consumes the engine's Runtime-Safe surface + the registry loader. No engine or registry source changes.
**User-Visible Surface:** none — developer/ops tooling (a Node CLI). Not a player-facing surface; no `play.legendary-arena.com` payoff.
**Dependencies:** The engine's public simulation surface — `runSimulation`, `createCompetentHeuristicPolicy`, `SimulationConfig`, `SimulationResult`, `AIPolicy` (WP-036 / WP-049, already re-exported from `@legendary-arena/game-engine`) ✅; the registry local loader `createRegistryFromLocalFiles` (`@legendary-arena/registry`, used by `apps/server`) ✅; `MatchSetupConfig` + the registry setup contract (`@legendary-arena/registry/setupContract`) ✅; the design authority `docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md` (Target A, Phase 1).
**Baseline:** `origin/main` @ `b543d08f` (capture `git rev-parse origin/main` at execution). The engine already exposes `runSimulation` + `createCompetentHeuristicPolicy` on its public `.` surface; the registry already loads card data from `data/metadata` + `data/cards`. There is **no** standalone runner app today — the only headless drivers are `scripts/*.mjs` that deep-import `packages/game-engine/dist/simulation/*` (a repo-script shortcut, not a layered app surface).

---

## Goal

Stand up a new `apps/engine-runner` app: a headless, Node-runnable CLI that loads the card registry from local files and drives the engine's **existing** bot-vs-bot simulation harness (`runSimulation` with competent-heuristic policies) for a given scenario and seed, emitting the resulting `SimulationResult` as JSON. It provides a `run` mode (simulate N games, print the aggregate result) and a `verify` mode (a determinism self-check: run the same inputs twice and assert a byte-identical result). This is **Phase 1 / Target A** of the Windows Engine Exe strategy — the runnable, testable core that a later WP will package into a standalone `.exe`. This packet ships **no packaging** and changes **no engine or registry source** (the simulation surface it consumes is already public).

---

## User-Visible Impact

None. This is engineering tooling: a CLI that runs the authoritative engine headlessly on any machine with Node. Its downstream payoff is the Windows `.exe` (a later WP packages this runner) and immediate local value for determinism verification and offline simulation — but there is no player-facing surface in this packet.

---

## Assumes

- **The simulation harness is on the engine's public surface.** `@legendary-arena/game-engine` (the `.` subpath, Runtime-Safe Engine Surface) re-exports `runSimulation`, `createCompetentHeuristicPolicy`, and the `SimulationConfig` / `SimulationResult` / `AIPolicy` types (`packages/game-engine/src/index.ts`). The runner consumes these directly — **no deep `dist/` import, no new engine export subpath.** (Verified at `src/index.ts` lines re: "AI playtesting & balance simulation framework".)
- **`runSimulation` is pure and deterministic.** Its JSDoc locks: "Given identical (config, registry) inputs the returned SimulationResult is byte-identical across runs." The `verify` mode's determinism self-check rests on this contract. (Verified at `packages/game-engine/src/simulation/simulation.runner.ts`.)
- **The registry loads from local files.** `createRegistryFromLocalFiles({ metadataDir, cardsDir })` returns a `CardRegistry` that satisfies the `CardRegistryReader` interface `runSimulation` accepts — `apps/server` already loads it this way (`data/metadata` + `data/cards`). (Verified at `apps/server/src/server.mjs` + `packages/registry/src/impl/localRegistry.ts`.)
- **`SimulationConfig` needs a `MatchSetupConfig`.** `SimulationConfig = { games, seed, setupConfig: MatchSetupConfig, policies: AIPolicy[] }`. The runner accepts the `setupConfig` as JSON input and validates it via the registry setup contract before running. (Verified at `packages/game-engine/src/simulation/ai.types.ts`.)
- **A new app may import the engine + registry.** Per ARCHITECTURE.md §Layer Boundary, an app at the `apps/server` tier imports the Runtime-Safe Engine Surface + `registry` + Node built-ins. `apps/engine-runner` is such a host; its import-rules row is added under D-24088.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

- `docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md` — the authoritative design. This packet is **Target A, Phase 1, WP-A1** (the engine-runner host + CLI). Packaging (esbuild + pkg/SEA/bun → `.exe`), fixture replay, and the exe-vs-node `finalStateHash` parity gate are explicitly **later WPs**.
- `packages/game-engine/src/index.ts` — the public export surface; confirm `runSimulation` + `createCompetentHeuristicPolicy` + the sim types are exported here (they are).
- `packages/game-engine/src/simulation/simulation.runner.ts` (`runSimulation`) + `ai.competent.ts` (`createCompetentHeuristicPolicy`) + `ai.types.ts` (`SimulationConfig` / `SimulationResult`) — the exact call shape.
- `apps/server/src/server.mjs` — the `createRegistryFromLocalFiles({ metadataDir: 'data/metadata', cardsDir: 'data/cards' })` invocation to mirror for registry loading; also the app-conventions precedent (ESM, `.mjs` entrypoint, tsx-run TS, `.js`-extension imports).
- `packages/registry/src/setupContract/` — the registry setup-contract validator the runner uses to reject an invalid `--scenario` before running.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` + `.claude/rules/architecture.md §Import Rules` — where the new `apps/engine-runner` import-rules row lands (both files; the canonical table is in ARCHITECTURE.md, the rules file mirrors it — keep them in lockstep per the D-24086 mirror-sync precedent).

---

## Non-Negotiable Constraints

**Always apply:**
- ESM only, Node v22+; `node:` prefix on built-ins; test files `.test.ts` (never `.test.mjs`).
- The executing session emits **full file contents for every new or modified file** — never a diff, a snippet, or "only the changed section."
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; full-sentence error messages (what failed + what to check); `// why:` on non-obvious choices; JSDoc per function; `for...of` / explicit `if/else` (no branching `.reduce()`); no `import * as` / no barrel re-exports.

**Packet-specific:**
- **No engine or registry source change.** The runner consumes only the already-public engine surface + the registry loader. It MUST NOT add an engine export, deep-import `packages/game-engine/dist/**`, or touch `packages/**` source. If a needed function is not on the public surface, **stop** — that is a different WP.
- **No packaging in this packet.** No esbuild bundle, no `@yao-pkg/pkg` / Node SEA / `bun --compile`, no `.exe` artifact, no CI release job. The runner runs under `node` (via the tsx loader, mirroring `apps/server`). Packaging is the follow-on WP.
- **No fixture-replay / no `finalStateHash`.** Those need exposing `src/test/fixtures/*` utilities on the public surface — out of scope here (a later WP). The determinism story in this packet is the `verify` self-check over `runSimulation`'s public, documented determinism only.
- **Layer-boundary clean.** `apps/engine-runner` may import `@legendary-arena/game-engine` (Runtime-Safe, `.` subpath), `@legendary-arena/registry` (+ `/setupContract`), Node built-ins. It MUST NOT import `boardgame.io` directly, `pg`, `apps/server`, `preplan`, `vue-sfc-loader`, or any browser API.
- **Deterministic + IO-bounded.** No `Math.random()`, no wall-clock in the run path (seeds come from `--seed`). Filesystem IO is confined to: reading the registry (via the loader), reading the `--scenario` JSON, and writing `--out`. No network.
- **Fail cleanly on bad input.** An invalid `--scenario` (fails the setup contract), a missing file, `games < 1`, or an empty seed produce a full-sentence error to stderr and a non-zero exit — never a stack trace as the primary UX, never a silent zeroed result presented as success.

**Session protocol:**
- If the exact `SimulationConfig` shape, the `CardRegistryReader` compatibility, or the setup-contract validator entrypoint is unclear, **stop and read** the cited engine/registry source — do not invent a harness call or a validation path.

---

## Scope (In)

- New `apps/engine-runner/` app:
  - `package.json` (private, `type: module`, deps `@legendary-arena/game-engine` + `@legendary-arena/registry` as `workspace:*`, devDep `tsx`; `engines.node >=22`; a `start` + `test` script mirroring `apps/server`).
  - `src/index.mjs` — process entrypoint: parse argv, dispatch to `run` / `verify`, map errors to stderr + exit code.
  - `src/cli.ts` — **pure** arg parser: argv → a validated `RunnerConfig` (`{ mode, scenarioPath, games, seed, outPath? }`) or a structured parse error. Independently testable.
  - `src/runMatch.ts` — load registry, read + setup-contract-validate the scenario, build `SimulationConfig` (policies = one `createCompetentHeuristicPolicy` per player), call `runSimulation`, return the `SimulationResult`. Plus `verifyDeterminism` (run twice, canonical-JSON compare, return a `{ identical, ... }` verdict).
  - `src/cli.test.ts` + `src/runMatch.test.ts` — `node:test` via tsx.
- Governance: `WORK_INDEX.md` (`[ ]` WP-304 row), `EC_INDEX.md` (EC-334 → WP-304, Pending), `DECISIONS.md` (D-24088 drafted), `STATUS.md` (at execution), and the ARCHITECTURE.md + `.claude/rules/architecture.md` import-rows (at execution).
- `pnpm-lock.yaml` (regenerated by the new app's deps at execution).

## Out of Scope

- **No packaging / no `.exe`** — no esbuild, no `@yao-pkg/pkg` / SEA / bun, no binary artifact, no antivirus/code-signing concerns. (Follow-on WP.)
- **No fixture-replay mode, no `finalStateHash` exposure, no exe-vs-node parity gate** — those require exposing `src/test/fixtures/*` and are a later WP.
- **No engine or registry source change** — no new engine export, no `dist/**` deep import, no `packages/**` edit.
- **No CI job / release workflow** — a later WP (A4) adds the Windows build + parity CI.
- **No change to `apps/server`, no database, no HTTP surface, no network.**
- **No `api-endpoints.md` change** — the runner exposes no HTTP endpoint and is not reachable by import from `apps/server`; D-11804 / `00.3 §21` are **N/A** for this packet.

---

## Files Expected to Change

| File | New/Mod | Note |
|---|---|---|
| `apps/engine-runner/package.json` | new | app manifest; engine + registry workspace deps; tsx devDep |
| `apps/engine-runner/src/index.mjs` | new | CLI entrypoint / dispatch (process concerns) |
| `apps/engine-runner/src/cli.ts` | new | pure arg parser → `RunnerConfig` |
| `apps/engine-runner/src/runMatch.ts` | new | registry load + scenario validate + `runSimulation` + `verifyDeterminism` |
| `apps/engine-runner/src/cli.test.ts` | new | arg-parse matrix |
| `apps/engine-runner/src/runMatch.test.ts` | new | smoke run + determinism verify + invalid-scenario reject |
| `docs/ai/ARCHITECTURE.md` | mod | add the `apps/engine-runner` import-rules row (D-24088) |
| `.claude/rules/architecture.md` | mod | mirror the import-rules row (lockstep with ARCHITECTURE.md) |
| `pnpm-lock.yaml` | mod | new-app deps |
| `WORK_INDEX.md` / `EC_INDEX.md` / `STATUS.md` / `DECISIONS.md` | mod | governance; D-24088 lands Active at execution |

(`apps/engine-runner/src/index.mjs` is the runtime entrypoint — a `01.5` runtime-wiring file, in the allowlist explicitly.)

---

## Contract

**New app — `apps/engine-runner` (import allowances, for the ARCHITECTURE.md row):**
- **May import:** `@legendary-arena/game-engine` (Runtime-Safe Engine Surface; `.` subpath), `@legendary-arena/registry` (incl. `/setupContract`), Node built-ins.
- **Must NOT import:** `boardgame.io` (directly), `pg`, `apps/server`, `preplan`, `vue-sfc-loader`, any `apps/*` UI, browser APIs, `@legendary-arena/game-engine/setup` (Setup-Tooling Surface is not needed by a read-only sim host).

**CLI surface:**
- `engine-runner run --scenario <path.json> --games <n> --seed <string> [--out <path.json>]` — loads the registry, validates the scenario, runs `n` bot-vs-bot games at `seed`, writes the `SimulationResult` JSON to stdout (or `--out`). Exit 0 on success; non-zero + full-sentence stderr on any input/validation failure.
- `engine-runner verify --scenario <path.json> --games <n> --seed <string>` — runs the identical simulation twice and compares the canonical-JSON `SimulationResult`. Exit 0 + `{ identical: true }` when byte-identical; non-zero + a short mismatch summary otherwise.

**Determinism contract:** for identical `(scenario, games, seed)`, two `run` invocations produce byte-identical `SimulationResult` JSON (guaranteed by `runSimulation`'s documented determinism). `verify` asserts exactly this.

**`RunnerConfig` (internal, locked by `cli.ts`):** `{ mode: 'run' | 'verify', scenarioPath: string, games: number, seed: string, outPath?: string }`. `games` must parse to an integer ≥ 1; `seed` must be non-empty; `scenarioPath` required. Any violation → a structured parse error, non-zero exit, no simulation run.

---

## Vision Alignment

- **Vision clauses touched:** §3 (determinism as a first-class property), §8 (RNG sourcing / seed discipline), §22 (deterministic, replay-faithful behavior), §26 (simulation-calibrated PAR — the runner packages the same harness that calibration consumes). The runner is a **read-only host** of the existing simulation surface; it defines no scoring, no PAR, no leaderboard.
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` It adds a new consumer of already-public, already-deterministic engine functions and changes no scoring/PAR/simulation/replay logic.
- **Non-Goal proximity check:** none of NG-1..7 are crossed. The runner is developer/ops tooling — not user-facing, not paid, not persuasive, not a competitive-submission path. No monetization or prestige surface.
- **Determinism preservation:** the runner introduces no `Math.random()`, no wall-clock, and no unseeded state; all randomness flows from the `--seed` argument through the engine's existing `ctx.random.*`-based harness. The `verify` mode explicitly asserts a byte-identical `SimulationResult` across two identical runs — a determinism guard, not a determinism change. §22 replay-faithfulness is preserved (the engine's behavior is untouched).

---

## Acceptance Criteria

- `pnpm -r build` → 0 (the new app has no build step but must not break the graph); `pnpm --filter @legendary-arena/engine-runner test` → all green.
- `cli.ts` parses a valid `run`/`verify` argv into the correct `RunnerConfig`, and rejects: missing `--scenario`, `--games 0` / non-integer, empty `--seed`, unknown mode — each with a full-sentence error and no simulation.
- `run` against a valid scenario + the real local registry emits a well-formed `SimulationResult` JSON (the documented fields: `gamesPlayed`, `winRate`, `averageTurns`, `averageScore`, `escapedVillainsAverage`, `woundsAverage`, `seed`).
- `verify` returns `identical: true` for a repeated identical run (proves the runner preserves engine determinism end-to-end).
- An invalid `--scenario` (fails the registry setup contract) and a missing scenario file each produce a full-sentence stderr error + non-zero exit — never a stack trace as primary UX, never a zeroed result presented as success.
- Grep-clean layer boundary: no `boardgame.io` / `pg` / `apps/server` / `dist/` deep-import in `apps/engine-runner/src/**`.
- ARCHITECTURE.md + `.claude/rules/architecture.md` both carry the identical new `apps/engine-runner` import-rules row; D-24088 is Active.

---

## Verification Steps

1. `pnpm install` then `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/engine-runner test` → all green; `node:test`, boardgame.io-free.
3. From repo root: `node --import ./apps/engine-runner/node_modules/tsx/dist/loader.mjs apps/engine-runner/src/index.mjs run --scenario <fixture.json> --games 5 --seed demo` → prints a `SimulationResult` JSON; exit 0.
4. Same inputs under `verify` → `{ identical: true }`, exit 0.
5. `... run --scenario <malformed.json> ...` → full-sentence stderr, non-zero exit.
6. `grep -rE "boardgame\.io|from 'pg'|apps/server|/dist/" apps/engine-runner/src` → no matches.

---

## Definition of Done

- [ ] `apps/engine-runner` created (manifest + `index.mjs` + `cli.ts` + `runMatch.ts` + two `.test.ts`); runs under `node`+tsx; no packaging.
- [ ] `run` + `verify` modes behave per the Contract; determinism `verify` returns identical for a repeated run.
- [ ] No engine/registry source change; no forbidden import (grep clean); consumes only the public engine + registry surface.
- [ ] ARCHITECTURE.md + `.claude/rules/architecture.md` carry the identical `apps/engine-runner` import row; **D-24088 landed Active**.
- [ ] `pnpm -r build` 0; new-app test suite green; no other suite delta.
- [ ] WORK_INDEX (WP-304) / EC_INDEX (EC-334) / STATUS flipped; commit prefix `EC-334:` (code) + `SPEC:` (governance close).
- [ ] `api-endpoints.md` **N/A** (no HTTP/library-from-server surface) — noted, not edited.
- [ ] Hand off to the follow-on packaging WP (Target A, Phase-1 A2): the runner now exists and is node-runnable; the next packet bundles + packs it into `legendary-engine.exe` and adds the exe-vs-node parity gate.

---

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE.** Checks performed against `origin/main` @ `b543d08f`:
- **Dependencies complete + on `main`:** the simulation surface (`runSimulation`, `createCompetentHeuristicPolicy`, `SimulationConfig`/`SimulationResult`/`AIPolicy`) is re-exported from `packages/game-engine/src/index.ts` (grep-verified); `createRegistryFromLocalFiles` is used by `apps/server`; `MatchSetupConfig` + the registry setup contract exist. WP-036 / WP-049 landed.
- **Contract fidelity:** every engine/registry symbol the WP's Contract names was verified against source this session — no invented API, no `dist/` deep-import in the design.
- **Scope locked:** `Scope (In)` / `Out of Scope` are closed enumerations; the file allowlist is bounded (6 app files + 2 governance-doc modifications + the index/D-entry rows). The one live ambiguity — "does the runner need an engine export change?" — is **resolved NO** (the harness is already public).
- **Repo green at baseline:** the executor confirms `pnpm -r build` → 0 at session start (Before-Starting hard gate in EC-334); the new app adds no build step and cannot break the graph.
- **No blocker:** no hard-dep is draft/in-flight; the numbering (WP-304 / EC-334 / D-24088) is collision-free (302/303 belong to the loadout workstream).

## Copilot Check Verdict (01.7 self-review)

**PASS (with one documented RISK).** Audited against the standard failure lens:
- *Layer violation?* No — public engine/registry surface only, enforced by an EC grep guard and the new import-rules row.
- *Scope creep / over-decomposition?* **RISK (accepted):** the packet deliberately excludes packaging, fixture-replay, and `finalStateHash`. This is intentional decomposition, not padding — packaging is build-tooling/binary work that can't be unit-tested as one unit with the runner, and the fixture/hash modes need new engine surface. Operator-confirmed scope = "engine-runner host + CLI only."
- *Determinism claim sound?* Yes — rests on `runSimulation`'s documented purity; `verify` asserts it; no new RNG/wall-clock introduced.
- *Missing dependency / silent-wrong-output risk?* No — `Assumes` lists each prerequisite with its verification; a false assumption BLOCKS per the WP.
- *Known non-blocking side effect:* adding the `[ ]` WP-304 row makes it a `roadmap-counts --check` mindmap orphan until executed+noded (the established draft pattern; the gate is cron-only, non-blocking).

## Lint Gate Self-Review (00.3 — all 21 sections)

- **§1 Structure:** PASS — Goal, Assumes, Context (Read First), Scope (In), Out of Scope, Files Expected to Change, Non-Negotiable Constraints, Acceptance Criteria, Verification Steps, Definition of Done all present + non-empty; Out of Scope lists ≥ 2 excluded items.
- **§2 Constraints:** PASS — Engine-wide (ESM/Node22, full-file-contents / no-diffs, `00.6` reference) + Packet-specific + Session protocol present; no partial-output permitted.
- **§3 Assumes:** PASS — every file/state dependency listed with its verified shape; out-of-order run BLOCKS, not silently-wrong.
- **§4 Context:** PASS — specific docs cited incl. ARCHITECTURE §Layer Boundary + `.claude/rules/architecture.md` (import-rules touch).
- **§5 Files:** PASS — every file new/modified with a one-line note; bounded (6 app + 2 governance + index rows); no ambiguous output language.
- **§6 Naming:** PASS — canonical names (`SimulationConfig`, `MatchSetupConfig`, `runSimulation`, `SimulationResult`) match source; no field renames.
- **§7 Dependencies:** PASS — no new npm dependency (workspace deps only); forbidden packages not used.
- **§8 Boundaries:** PASS — no DB / `G` / move-function / WebSocket surface; layer boundary respected (public surface only); no `Math.random()`.
- **§9 Windows:** PASS — commands are `pnpm` / cross-platform `node`; no bash-only script in a deliverable.
- **§10 Env vars:** N/A — the runner reads no environment variable (seeds/paths are CLI args); no secret.
- **§11 Auth:** N/A — no authentication surface.
- **§12 Tests:** PASS — `node:test`, boardgame.io-free, no network/DB (registry read is local-file, not DB); determinism `verify` is the golden-style guard.
- **§13 Verification:** PASS — exact `pnpm` + `node` + grep commands with expected output.
- **§14 Acceptance:** PASS — 7 binary, observable, specific criteria aligned to deliverables.
- **§15 Definition of Done:** PASS — includes STATUS / DECISIONS (D-24088) / WORK_INDEX flips + scope-boundary; `**User-Visible Surface:** none — dev/ops tooling` declared with `## User-Visible Impact`; DoD states the infrastructure/no-observable-change posture (D-24026 N/A).
- **§16 Code style:** PASS — the WP mandates small JSDoc'd functions, explicit control flow, full-word names, `// why:` comments, full-sentence errors, named imports.
- **§17 Vision Alignment:** PASS — `## Vision Alignment` present; clauses §3/§8/§22/§26 cited; no-conflict asserted; NG-1..7 not crossed; determinism-preservation line present.
- **§18 Prose-vs-grep:** PASS — the layer grep in Verification targets `boardgame.io`/`pg`/`apps/server`/`dist/`; the WP prose discusses these only as governed rules, and the grep is scoped to `apps/engine-runner/src` (not this doc), so no self-trip.
- **§19 Bridge-vs-HEAD:** N/A — this WP is not a repo-state-summarizing bridge; the baseline SHA is reconciled at commit.
- **§20 Funding Surface Gate:** N/A — no funding surface: dev/ops CLI, no user-visible copy, no navigation/registry/profile funding affordance, no donate/support terms.
- **§21 API Catalog:** N/A — no HTTP endpoint added/changed and no `apps/server/src/**` library function added/modified; the runner is a separate app not reachable by import from `apps/server`.

**Lint verdict: PASS** (all applicable sections PASS; §10/§11/§19/§20/§21 explicitly N/A with justification).
