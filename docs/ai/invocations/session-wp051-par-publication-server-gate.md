# Session Prompt — WP-051 PAR Publication & Server Gate Contract

**Work Packet:** [docs/ai/work-packets/WP-051-par-publication-server-gate.md](../work-packets/WP-051-par-publication-server-gate.md) (amended 2026-04-23 via A0 SPEC bundle; PS-1..PS-12 resolved)
**Execution Checklist:** [docs/ai/execution-checklists/EC-051-par-publication-server-gate.checklist.md](../execution-checklists/EC-051-par-publication-server-gate.checklist.md) (rewritten 2026-04-23 via A0 SPEC bundle)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp051.md](../session-context/session-context-wp051.md)
**Pre-Flight Report:** [docs/ai/invocations/preflight-wp051-par-publication-server-gate.md](preflight-wp051-par-publication-server-gate.md)
**Pre-flight verdict:** READY TO EXECUTE (A0 bundle landed 2026-04-23; all 12 PS findings resolved; all 6 copilot-check RISK items locked).
**Commit prefix:** `EC-051:` on every code-changing commit; `SPEC:` on governance/close commits outside the allowlist; `WP-051:` is **forbidden** (commit-msg hook rejects per P6-36).
**WP Class:** Runtime Wiring. Server-layer enforcement of the pre-release PAR gate. **No engine gameplay changes. No `G` mutation. No moves added. No phase hooks. No new `LegendaryGameState` fields. No `buildInitialGameState` shape change.**
**Primary layer:** Server (`apps/server/src/par/**` — new; `apps/server/src/server.mjs` — modified).

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-051:` on code commits inside the allowlist; `SPEC:` on governance close. `WP-051:` forbidden.

2. **A0 bundle landed.** Confirm the A0 SPEC commit is HEAD (or present in the current branch). A0 contains:
   - `packages/game-engine/src/simulation/par.storage.ts` — **A1 amendment**: exports `loadParIndex(basePath, parVersion, source): Promise<ParIndex | null>`
   - `packages/game-engine/src/simulation/par.storage.test.ts` — +1 drift test for `loadParIndex` (test count 34 → 35)
   - `packages/game-engine/src/index.ts` — `loadParIndex` added to re-export block
   - `docs/ai/work-packets/WP-050-par-artifact-storage.md` — A1 amendment notes (§B, §D, §Files Expected to Change; test count 34 → 35)
   - `docs/ai/execution-checklists/EC-050-par-artifact-storage.checklist.md` — A1 amendment notes (Test Count Lock, Files to Produce, After Completing baseline)
   - `docs/ai/DECISIONS.md` — **D-5101** (dual-index in-memory load with D-5003 precedence), **D-5102** (`PAR_VERSION` env var), **D-5103** (existence-based trust; CI-time integrity validation only)
   - `docs/ai/work-packets/WP-051-par-publication-server-gate.md` — amended
   - `docs/ai/execution-checklists/EC-051-par-publication-server-gate.checklist.md` — rewritten
   - `docs/ai/session-context/session-context-wp051.md` — new
   - `docs/ai/invocations/preflight-wp051-par-publication-server-gate.md` — verdict flipped to READY
   - This prompt

   If the A0 bundle is not landed, STOP — execution is blocked on pre-flight governance.

3. **Upstream baseline.** Run:
   ```bash
   pnpm -r test
   ```
   Expect **658 tests / 126 suites / 0 fail** repo-wide (post-A0 bundle):
   - registry `13 / 2 / 0`
   - vue-sfc-loader `11 / 0 / 0`
   - **game-engine `506 / 113 / 0`** (post-A1 amendment — +1 drift test over the 505 WP-050 baseline)
   - **apps/server `6 / 2 / 0` (MUST shift to `19 / 3 / 0` post-Commit A — exactly +13 tests, +1 suite)**
   - replay-producer `4 / 2 / 0`
   - preplan `52 / 7 / 0`
   - arena-client `66 / 0 / 0`
   - **Post-Commit A repo-wide: `671 / 127 / 0`.**

   If the repo baseline diverges, STOP and reconcile before writing code.

4. **Upstream contract surface verification.** Before writing any file, grep-verify every dependency export at HEAD:

   ```bash
   grep -n "export async function loadParIndex"        packages/game-engine/src/simulation/par.storage.ts
   grep -n "export function lookupParFromIndex"        packages/game-engine/src/simulation/par.storage.ts
   grep -n "export class ParStoreReadError"            packages/game-engine/src/simulation/par.storage.ts
   grep -n "export interface ParIndex"                 packages/game-engine/src/simulation/par.storage.ts
   grep -n "export type ParArtifactSource"             packages/game-engine/src/simulation/par.storage.ts
   grep -n "export const PAR_ARTIFACT_SOURCES"         packages/game-engine/src/simulation/par.storage.ts
   grep -n "loadParIndex,"                             packages/game-engine/src/index.ts
   grep -n "export type ScenarioKey"                   packages/game-engine/src/scoring/parScoring.types.ts
   grep -n "export async function startServer"         apps/server/src/server.mjs
   grep -nE "loadRegistry.*loadRules"                  apps/server/src/server.mjs
   ```

   Each MUST return at least one line (exact count varies by file). If any returns zero, STOP — the Assumes gate is violated.

5. **WP-050 contract files MUST be unchanged during Commit A.** Before and after Commit A, run:
   ```bash
   git diff main -- packages/game-engine/src/simulation/par.storage.ts \
                    packages/game-engine/src/simulation/par.storage.test.ts \
                    packages/game-engine/src/index.ts \
                    packages/game-engine/src/simulation/ai.types.ts \
                    packages/game-engine/src/simulation/ai.random.ts \
                    packages/game-engine/src/simulation/ai.legalMoves.ts \
                    packages/game-engine/src/simulation/simulation.runner.ts \
                    packages/game-engine/src/simulation/ai.competent.ts \
                    packages/game-engine/src/simulation/ai.tiers.ts \
                    packages/game-engine/src/simulation/par.aggregator.ts \
                    packages/game-engine/src/scoring/parScoring.types.ts \
                    packages/game-engine/src/scoring/parScoring.logic.ts
   ```
   Expect **zero output**. The A1 amendment landed in A0; no further engine changes are permitted during WP-051 Commit A. Any modification to these files is a Hard Stop.

6. **`apps/server/src/rules/loader.mjs` and `apps/server/src/game/legendary.mjs` MUST be unchanged.** These are stable server-layer files outside WP-051 scope.

7. **Working-tree hygiene (P6-27).** `git status --short` should show only `?? .claude/worktrees/` and any in-flight untracked files not part of this session. Stage by exact filename only — `git add .` / `-A` / `-u` are forbidden.

8. **Branch discipline.** Cut a fresh topic branch from `main` (after A0 bundle merges to main):
   ```bash
   git checkout -b wp-051-par-publication-server-gate main
   ```

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

WP-051 is a server-layer wiring change that touches **zero** engine contract surface:

| 01.5 Trigger Criterion | Applies to WP-051? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | `G` is not touched. Zero new game-state fields. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildInitialGameState` never called in new files. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | Zero moves added. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook. |

**Conclusion:** 01.5 is **NOT INVOKED**. The only existing file modified (`apps/server/src/server.mjs`) is in the WP-051 explicit allowlist — its modification is driven by the WP itself, not by a ripple effect on unrelated files. The only other existing file modified (`apps/server/package.json` test-glob expansion) is also in the explicit allowlist.

If an unanticipated structural break appears mid-execution — e.g., an existing arena-client test asserts on a server response shape that changes — **STOP and escalate**. Do NOT force-fit the change under 01.5; WP-051 must be split or its allowlist revised.

**Lifecycle prohibition.** Functions introduced by WP-051 (`checkParPublished`, `createParGate`) MUST NOT be called from:
- `game.ts` or any `LegendaryGame.moves` entry
- Any phase hook (`onBegin`, `onEnd`, `endIf`, phase `onBegin`)
- Any file under `packages/game-engine/**`
- Any file under `packages/registry/**`, `packages/preplan/**`
- Any file under `apps/arena-client/**`, `apps/replay-producer/**`, `apps/registry-viewer/**`

They are consumed exclusively by server startup (`server.mjs` via `createParGate` in the startup `Promise.all`) and, in future WPs (WP-053 submission, WP-054 public leaderboards), from server request handlers. No engine / UI / client consumer.

---

## Post-Mortem (01.6) — MANDATORY

Per [01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). WP-051 triggers these mandatory conditions:

| 01.6 Trigger | Applies? | Justification |
|---|---|---|
| New long-lived abstraction | **Yes** | `createParGate` factory + `checkParPublished` signature anchor WP-053 (submission endpoint) and WP-054 (public leaderboards). The `{parValue, parVersion, source}` return shape is load-bearing downstream. |
| New contract consumed by future WPs | **Yes** | WP-053 and WP-054 will import the gate accessor. Field names + return-shape are locked per D-5101. |
| New canonical readonly array | No | Reuses `PAR_ARTIFACT_SOURCES` from WP-050 — no new array. |
| New setup artifact in `G` | No | Zero G involvement. |
| New filesystem surface | **Partial** | First server-layer consumer of `data/par/` tree — but PAR IO is delegated entirely to the engine's `loadParIndex`; the server file must not import `node:fs`. Post-mortem asserts this via grep. |

**Post-mortem file path:** `docs/ai/post-mortems/01.6-WP-051-par-publication-server-gate.md`. Template = `docs/ai/post-mortems/01.6-WP-050-par-artifact-storage.md` (if present; otherwise use the WP-049 post-mortem as structural template).

**Post-mortem must cover (minimum):**

1. **Layer-boundary audit.** `grep -nE "from ['\"]boardgame\.io" apps/server/src/par/parGate.*` returns zero. Same for `from ['\"]LegendaryGame`, `ctx\.`, and — critically — `from ['\"]node:fs` / `from ['\"]node:fs/promises`. The server gate file must not import any filesystem API; all PAR file IO is delegated to the engine `loadParIndex`.
2. **Aliasing audit.** Two sequential `checkParPublished(key)` calls for the same published key return objects where `result1 !== result2` (identity-distinct) but all field values are `===` (value-equal). Mutating `result1.parValue = 99` must not observably change `result2.parValue` nor the in-memory index. Test #13 asserts this.
3. **Fail-closed audit.** `checkParPublished(null, null, anyKey) === null` for any string `anyKey`. Both-null, sim-null-seed-null, and empty-indices cases all fail closed.
4. **No-fs-at-request-time audit.** Gate constructed over tmpdir-backed indices. Delete the backing directory. Multiple subsequent `checkParPublished` calls still return the correct results. Test #8 asserts this.
5. **Precedence audit.** Scenario published in both classes with *different* `parValue` — gate returns the simulation value, not the seed value (D-5003 / D-5101). Test #12 asserts this.
6. **Config audit.** Gate constructed without setting `PAR_VERSION` env var resolves to `v1`. Setting `PAR_VERSION=v2` resolves to `v2`. Env var read happens exactly once at startup (not on every request).
7. **`// why:` comment completeness.** EC-051 §Required `// why:` Comments fully populated in `parGate.mjs` and the `server.mjs` startup-task diff. Grep verification: `grep -c "// why:" apps/server/src/par/parGate.mjs` returns the expected count.
8. **Test-glob audit.** `apps/server/package.json` test script runs all 13 new tests. If the script still uses the pre-expansion glob `scripts/**/*.test.ts`, the new tests in `src/par/` are silently skipped — a PS-6 regression. Verified by confirming server test output shows 19 tests (6 existing + 13 new), not 6.

Post-mortem runs in the **same session** as Commit A execution, before Commit B (governance close). Fixes applied during post-mortem are strict in-allowlist refinements — they do NOT require 01.5 invocation.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline, **test file extension rule (line 11): `.test.ts` never `.test.mjs`**
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary (authoritative)
3. [.claude/rules/server.md](../../../.claude/rules/server.md) — **server is a wiring layer only; no game logic; startup task pattern**
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — ESM only, `.test.ts` extension, full-sentence error messages, JSDoc required on every function
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary; §Persistence Boundaries
6. [docs/ai/execution-checklists/EC-051-par-publication-server-gate.checklist.md](../execution-checklists/EC-051-par-publication-server-gate.checklist.md) — **primary execution authority** (Locked Values + Guardrails + Required `// why:` Comments + Files to Produce + Test Count Lock + After Completing + Common Failure Smells)
7. [docs/ai/work-packets/WP-051-par-publication-server-gate.md](../work-packets/WP-051-par-publication-server-gate.md) — authoritative WP specification
8. [docs/ai/session-context/session-context-wp051.md](../session-context/session-context-wp051.md) — bridge from WP-050 closure + A0 bundle
9. [docs/ai/invocations/preflight-wp051-par-publication-server-gate.md](preflight-wp051-par-publication-server-gate.md) — READY TO EXECUTE verdict; PS-1..PS-12 resolved
10. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D-5001 line 8937** (server consumes PAR via engine API, not raw `node:fs`), **D-5002** (dual source classes), **D-5003** (sim-over-seed precedence), **D-5101** (dual-index in-memory load), **D-5102** (`PAR_VERSION` env var), **D-5103** (existence-based trust)
11. [docs/12.1-PAR-ARTIFACT-INTEGRITY.md](../../12.1-PAR-ARTIFACT-INTEGRITY.md) — explanatory; trust model; CI-time integrity responsibility

**Implementation anchors (read before coding — paths verified at pre-flight time):**

12. [packages/game-engine/src/simulation/par.storage.ts](../../../packages/game-engine/src/simulation/par.storage.ts) — `loadParIndex`, `lookupParFromIndex`, `ParIndex`, `ParArtifactSource`, `ParStoreReadError`. **Immutable during Commit A** (A1 amendment already landed in A0).
13. [packages/game-engine/src/index.ts](../../../packages/game-engine/src/index.ts) — re-export surface. **Immutable during Commit A.**
14. [apps/server/src/server.mjs](../../../apps/server/src/server.mjs) — existing `startServer()` with `Promise.all([loadRegistry(), loadRules()])`. **Modified during Commit A** (add `createParGate` as the third Promise.all task).
15. [apps/server/src/rules/loader.mjs](../../../apps/server/src/rules/loader.mjs) — module-level `loadRules()` + `getRules()` pattern. **Precedent for where the gate instance is captured post-startup.** Read but do NOT modify.
16. [apps/server/scripts/join-match.test.ts](../../../apps/server/scripts/join-match.test.ts) — existing `.test.ts` precedent. Imports from `.mjs` runtime code via `// @ts-ignore` comment. **Read for pattern; do NOT modify.**
17. [apps/server/package.json](../../../apps/server/package.json) — existing `test` script `node --import tsx --test scripts/**/*.test.ts`. **Modified during Commit A** — expand glob to include `src/**/*.test.ts`.

If any conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, the server exposes a functioning pre-release PAR gate. Specifically:

1. **`apps/server/src/par/parGate.mjs`** exists and exports exactly two functions: `checkParPublished(simIndex, seedIndex, scenarioKey)` and `createParGate(basePath, parVersion)`. The file imports only from `@legendary-arena/game-engine` (named imports: `loadParIndex`, `lookupParFromIndex`, `ParStoreReadError`, plus type imports `ParIndex`, `ParArtifactSource`, `ScenarioKey`) and has **zero** `node:fs` imports and zero `boardgame.io` imports.
2. **`apps/server/src/par/parGate.test.ts`** exists with exactly **13 tests** inside one `describe('PAR publication gate (WP-051)', …)` block. Tests cover `loadParIndex` smoke (3), `checkParPublished` base (3), `createParGate` integration (3), dual-class precedence (3), aliasing guard (1). All 13 pass.
3. **`apps/server/src/server.mjs`** is modified — `startServer()`'s `Promise.all` is extended to call `createParGate('data/par', process.env.PAR_VERSION ?? 'v1')` as the third parallel task. The returned gate is captured in a server-module scope constant.
4. **`apps/server/package.json`** is modified — the `test` script glob is expanded from `scripts/**/*.test.ts` to cover `src/**/*.test.ts` as well, so the new gate tests actually run.
5. **Server baseline shift: `6 / 2 / 0` → `19 / 3 / 0`.** Repo-wide: `658 → 671` tests; `126 → 127` suites. Zero existing tests modified. Engine baseline unchanged at `506 / 113 / 0` (A1 amendment already applied in A0 bundle).
6. **Governance closed in Commit B:** `docs/ai/STATUS.md` records the PAR gate availability; `docs/ai/work-packets/WORK_INDEX.md` flips WP-051 `[ ]` → `[x]` with today's date + Commit A hash; `docs/ai/execution-checklists/EC_INDEX.md` flips EC-051 Draft → Done; `docs/ai/post-mortems/01.6-WP-051-par-publication-server-gate.md` written (mandatory per 01.6).

No engine gameplay changes. No registry changes. No arena-client changes. No preplan changes. No `pnpm-lock.yaml` edits. No modifications to WP-050 A1 surface during Commit A.

---

## Locked Values (Do Not Re-Derive)

All Locked Values below are copied from EC-051 (post-A0) + WP-051 §Non-Negotiable Constraints + pre-flight findings.

### Commit topology (two commits — A0 already landed)

- **Commit A0 (`SPEC:`)** — pre-flight bundle. **Already landed.** Contains WP-050 A1 amendment (`loadParIndex` + drift test), DECISIONS D-5101/5102/5103, WP-051 + EC-051 amendments, session-context-wp051.md, pre-flight verdict flip, this prompt. No further changes permitted to these governance artifacts during Commit A.
- **Commit A (`EC-051:`)** — execution. Contains **exactly 4 files**:
  - `apps/server/src/par/parGate.mjs` (new)
  - `apps/server/src/par/parGate.test.ts` (new; 13 tests in 1 suite)
  - `apps/server/src/server.mjs` (modified — startup task added)
  - `apps/server/package.json` (modified — test glob expanded)
- **Commit B (`SPEC:`)** — governance close. Contains **exactly 4 files**:
  - `docs/ai/work-packets/WORK_INDEX.md` (WP-051 `[ ]` → `[x]` with date + Commit A hash)
  - `docs/ai/execution-checklists/EC_INDEX.md` (EC-051 Draft → Done)
  - `docs/ai/STATUS.md` (record PAR gate availability)
  - `docs/ai/post-mortems/01.6-WP-051-par-publication-server-gate.md` (new — mandatory per 01.6)

### `checkParPublished` — module-level signature (locked per D-5101)

```ts
/**
 * Pure synchronous lookup across both in-memory PAR indices, applying
 * D-5003 / D-5101 simulation-over-seed precedence. Returns a fresh
 * object literal on every hit (aliasing guard — never a reference into
 * the index). Returns null when the scenario is absent from both
 * indices or when both indices are null (fail-closed).
 */
export function checkParPublished(
  simIndex: ParIndex | null,
  seedIndex: ParIndex | null,
  scenarioKey: ScenarioKey,
): { parValue: number; parVersion: string; source: ParArtifactSource } | null;
```

- Parameter `scenarioKey` typed as `ScenarioKey` (aliased `string` from WP-048 `parScoring.types.ts`), **not** raw `string` — narrow-boundary discipline per copilot check #21.
- Sim queried first via `lookupParFromIndex(simIndex, scenarioKey)`; if hit, return `{parValue: hit.parValue, parVersion: simIndex.parVersion, source: 'simulation'}`. Else seed; else `null`.
- **Must construct a fresh object literal** on every hit (no direct return of `lookupParFromIndex`'s result, no `{...entry}` spread that could share nested references). Test #13 asserts identity-distinctness.
- Pure, synchronous, zero IO, zero side effects.
- `// why:` comment required at the top of this function: index is canonical oracle; filesystem probing forbidden (D-5103); sim-over-seed precedence per D-5003 / D-5101 preserves three-phase PAR derivation pipeline.
- `// why:` comment required at the fresh-object-construction line: aliasing guard — index must not be observable as mutable through a caller-held reference.

### `createParGate` — factory signature (locked per D-5101 + D-5102)

```ts
/**
 * Async factory that loads both source-class indices once at startup
 * via the engine's loadParIndex helper, then returns a bound gate
 * object whose checkParPublished is the partial-application over the
 * loaded indices.
 *
 * Non-blocking: catches ParStoreReadError per class, warn-logs, treats
 * the malformed / missing class as null (gate continues with the other
 * class or with both null = fail-closed).
 */
export async function createParGate(
  basePath: string,
  parVersion: string,
): Promise<{
  readonly checkParPublished: (scenarioKey: ScenarioKey) =>
    { parValue: number; parVersion: string; source: ParArtifactSource } | null;
  readonly simulationScenarioCount: number;
  readonly seedScenarioCount: number;
}>;
```

- Two concurrent `loadParIndex` calls via `Promise.all([...])`:
  ```ts
  const [simIndex, seedIndex] = await Promise.all([
    loadParIndex(basePath, parVersion, 'simulation').catch(handleParLoadError('simulation', ...)),
    loadParIndex(basePath, parVersion, 'seed').catch(handleParLoadError('seed', ...)),
  ]);
  ```
- `handleParLoadError` is an internal helper that catches `ParStoreReadError`, `console.warn`-logs a full-sentence diagnostic, and returns `null`. Other error classes re-throw (non-structural failures should not be silently swallowed).
- Logging rules (full sentences per code-style Rule 11):
  - Both loaded (either non-null): `[server] PAR index loaded: N scenarios (v{parVersion}; sim={M}, seed={K})` where N is the size of the union of scenario keys across both indices.
  - One missing / malformed: `[server] PAR {sim|seed} index unavailable at data/par/{sim|seed}/{parVersion}/index.json; continuing with {seed|sim}-only coverage` OR, on read error, `[server] PAR {sim|seed} index failed to load: {ParStoreReadError.message}; continuing with {seed|sim}-only coverage`.
  - Both missing: `[server] PAR index unavailable at both data/par/sim/{parVersion}/index.json and data/par/seed/{parVersion}/index.json; competitive submissions disabled`.
- The returned object is a frozen factory closure — `Object.freeze` is acceptable but not required. The `checkParPublished` on the returned object is a thin wrapper:
  ```ts
  checkParPublished: (scenarioKey) =>
    checkParPublished(simIndex, seedIndex, scenarioKey),
  ```
  (i.e., module-level `checkParPublished` partially applied over the loaded indices).
- `simulationScenarioCount` and `seedScenarioCount` are `simIndex?.scenarioCount ?? 0` and `seedIndex?.scenarioCount ?? 0`, useful for observability / monitoring hooks in future WPs.
- `// why:` comment required: load once at startup, check many times per request — same pattern as registry loading; both source classes loaded to preserve D-5101 sim-over-seed precedence without per-request filesystem IO.
- `// why:` comment required on the `PAR_VERSION` env read site (if the read happens inside this function rather than at the call site in `server.mjs`): operator-configured per D-5102; stable for process lifetime; no runtime reload.

### `server.mjs` startup wiring (locked)

Modify `startServer()` in `apps/server/src/server.mjs`:

```ts
// existing line 78:
// await Promise.all([
//   loadRegistry(),
//   loadRules(),
// ]);

// becomes:
// why: PAR gate is the third independent startup task per WP-051 /
// D-5101. Non-blocking: createParGate handles all failure modes
// internally (warn-log + continue with partial or empty coverage).
// PAR_VERSION env var read per D-5102; ?? 'v1' fallback matches the
// PORT ?? '8000' pattern below.
const [/* registry, rules, */, , parGate] = await Promise.all([
  loadRegistry(),
  loadRules(),
  createParGate('data/par', process.env.PAR_VERSION ?? 'v1'),
]);
```

- Import added at top of file: `import { createParGate } from './par/parGate.mjs';`
- `parGate` is captured in a server-module scope constant (exactly analogous to how `getRules()` accesses the loaded rules). Exposing a `getParGate()` accessor is **out of scope** for WP-051 — the `parGate` binding is simply held for future WPs (WP-053) to wire into request handlers when those land.
- The startup log for the gate is emitted by `createParGate` itself; `server.mjs` does not duplicate log lines. After `Promise.all` resolves, the existing `[server] listening on port ...` log already covers the success path for the whole startup.
- **Do NOT re-order** the existing `loadRegistry()` / `loadRules()` calls. **Do NOT** change the `rulesCount` computation. **Do NOT** change the CORS origins array. **Do NOT** change the SIGTERM handling (which lives in `index.mjs` and is out of scope).

### `apps/server/package.json` test-glob expansion (locked per PS-6)

Pre-WP-051 `scripts.test`:
```json
"test": "node --import tsx --test scripts/**/*.test.ts"
```

Post-WP-051 `scripts.test` (locked form):
```json
"test": "node --import tsx --test 'scripts/**/*.test.ts' 'src/**/*.test.ts'"
```

- Two glob arguments, each individually quoted (shell-safe).
- This is the **only** change to `package.json`. Do NOT bump the version, do NOT add dependencies, do NOT reorder keys.
- Cross-platform note: the test runner must pick up `src/**/*.test.ts` on Windows + Linux. `tsx` + Node's native `--test` flag handle both. Verified smoke-test precedent: the existing `scripts/**/*.test.ts` glob already works.

### Test count lock (13 — per PS-2 + PS-5 + copilot-check #17)

Exactly **13 tests** in one `describe('PAR publication gate (WP-051)', …)` block:

**`loadParIndex` smoke (engine-surface verification) — 3 tests**
1. Returns a parsed `ParIndex` with expected `source` / `parVersion` / `scenarios` fields for a valid index written via `buildParIndex`
2. Returns `null` for a missing index directory
3. Throws `ParStoreReadError` for an index whose content is invalid JSON OR whose `source` stamp disagrees with its directory

**`checkParPublished` base behavior — 3 tests**
4. Returns `{parValue, parVersion, source: 'simulation'}` for a scenario published only in the simulation index
5. Returns `null` for a scenario absent from both indices
6. Returns `null` when both indices are `null` (dual-null fail closed)

**`createParGate` integration — 3 tests**
7. Returns a working gate object whose `checkParPublished` matches the module-level function's semantics on the loaded indices
8. Gate check performs zero filesystem IO at request time — construct gate with tmpdir-backed indices, delete the backing directory, confirm multiple subsequent `checkParPublished` calls still return the correct results
9. Version isolation — scenario published only under `v1` does NOT appear when gate is constructed with `parVersion: 'v2'`

**Dual-class precedence (D-5101 / D-5003) — 3 tests**
10. Sim-only: simulation index has the scenario, seed does not → returns `source: 'simulation'`
11. Seed-only: seed index has the scenario, simulation does not → returns `source: 'seed'` (graceful degradation)
12. Both-present with different `parValue` values: returns `source: 'simulation'` AND `parValue` matches sim entry, not seed (precedence)

**Aliasing guard (copilot check #17) — 1 test**
13. Two sequential `checkParPublished(key)` calls for the same published key return objects where `result1 !== result2` (identity-distinct) AND all fields `===` equal (value-equal). Mutating `result1.parValue = -1` does NOT mutate `result2.parValue` or the in-memory index.

### Fixture strategy (locked)

Tests construct temporary PAR index fixtures under `node:os.tmpdir()` workspaces:
- Use `mkdtemp(join(tmpdir(), 'wp051-gate-'))` per test
- Write hand-authored `index.json` OR call WP-050's `buildParIndex` + `writeSeedParArtifact` / `writeSimulationParArtifact` to produce realistic fixtures
- Every test cleans up its workspace via `try { ... } finally { await rm(workspace, { recursive: true, force: true }); }` or `afterEach` hook
- **No tests depend on `data/par/` content from the repo** — that directory is empty at A0 time and will remain empty until seed/sim authoring lands as separate content work

### Test file precedent (locked)

- File: `apps/server/src/par/parGate.test.ts` (**`.test.ts`** per CLAUDE.md line 11; **never `.test.mjs`**)
- Imports from `./parGate.mjs` via `// @ts-ignore` comment pattern (matches the existing `apps/server/scripts/join-match.test.ts` precedent)
- Imports from `@legendary-arena/game-engine` for types + `buildParIndex` / `writeSeedParArtifact` / `writeSimulationParArtifact` fixtures
- Imports from `node:test`, `node:assert/strict`, `node:fs/promises` (tests can use fs directly — tests are NOT bound by the D-5001 engine carve-out; tests are server-layer and may use fs freely), `node:os`, `node:path`

### Hard-locked prohibitions (repeated from EC-051 for clarity)

- **No `node:fs` or `node:fs/promises` imports in `parGate.mjs`** — filesystem IO is delegated entirely to `loadParIndex` in the engine (D-5001 line 8937). Tests MAY import `node:fs` for fixture setup.
- No `boardgame.io`, `LegendaryGame`, or `ctx.*` references in `parGate.mjs`
- No `writeFile`, `mkdir`, `unlink`, `rename`, `truncate`, `rm` calls in `parGate.mjs`
- No engine internals imported (`tryLoadIndex`, `tryReadFile`, etc. are not exported — any attempt to import them fails at build time; do not work around)
- No `Math.random()`, no `Date.now()`, no `.reduce()` with branching
- No `import *`, no barrel re-exports — use named imports exactly

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `import ... from 'boardgame.io'` or `from '@legendary-arena/game-engine/internal/*'` in any new file
- Any `import ... from 'node:fs'` or `from 'node:fs/promises'` in `parGate.mjs` (tests are exempt)
- Any `import ... from 'node:net'` / `node:http` / `node:https` / `node:child_process` / `node:dns` in `parGate.mjs` or `parGate.test.ts`
- Any modification to engine files (`packages/game-engine/**`) during Commit A (A1 amendment is already landed in A0)
- Any modification to `packages/registry/**`, `packages/preplan/**`, `apps/arena-client/**`, `apps/replay-producer/**`, `apps/registry-viewer/**`
- Any modification to `apps/server/src/index.mjs`, `apps/server/src/rules/loader.mjs`, or `apps/server/src/game/legendary.mjs`
- Any `.reduce()` with branching
- Any `Math.random()` or `Date.now()` in any new file
- Any `require()` in any file
- Any gameplay logic introduced to the server layer
- Any test file using `.test.mjs` extension (rule violation per CLAUDE.md line 11)
- Any attempt to reimplement `validateParStore` or recompute `artifactHash` at the server (D-5103 violation)
- Any per-request filesystem IO from the gate (D-5101 violation)
- Any attempt to make `checkParPublished` async (it MUST be synchronous; the indices are already in memory post-startup)
- Any expansion of scope beyond WP-051 (no "while I'm here" improvements to unrelated server code)
- Any attempt to expose a `getParGate()` accessor on `server.mjs` (out of scope; future WP-053 will add this)

---

## AI Agent Warning (Strict)

The PAR gate is the **trust surface for competitive leaderboards**. Every decision here — fail-closed on missing indices, in-memory lookups only, existence-based trust per D-5103, sim-over-seed precedence per D-5101, fresh-object-literal return per copilot #17 — exists because leaderboards must be defensible against both accidental bugs and intentional gaming.

**Do NOT:**
- Import `node:fs` in `parGate.mjs`. Ever. The engine's `loadParIndex` is the ONLY path PAR file bytes enter the server. If you feel tempted to `readFile(indexPath)` yourself — STOP, that is a D-5001/D-5103 violation.
- Validate artifact hashes on the server. That is CI's job via `validateParStore` (D-5103).
- Call `resolveParForScenario` at request time. It is per-call async fs IO; D-5101 explicitly rejects that pattern. Use `createParGate` + the module-level synchronous `checkParPublished`.
- Return `lookupParFromIndex`'s result directly from `checkParPublished`. The engine helper returns a reference into the index. You MUST construct a fresh object literal so callers cannot mutate the in-memory index via aliasing.
- Use `.test.mjs` extension. The CLAUDE.md rule is absolute — tests are `.test.ts` across the entire monorepo.
- Add "while I'm here" refactors to `server.mjs`. Exactly one surgical `Promise.all` expansion + one `import` line. Nothing else.
- Add `PAR_VERSION` validation (regex, format, etc.) on the server. Per D-5102, operator errors surface as missing-index warnings, not a startup crash — that is intentional fail-soft.
- Add SIGHUP handling for PAR reload. Per D-5102, the active PAR version is stable for process lifetime; any future reload support requires a separate DECISIONS entry.

**Instead:**
- Consume `loadParIndex`, `lookupParFromIndex`, `ParStoreReadError` from `@legendary-arena/game-engine` via named imports
- Use `Promise.all` for the two `loadParIndex` calls inside `createParGate` — they are independent and parallelize freely
- Catch `ParStoreReadError` per class via a per-call `.catch(...)` or a helper; warn-log the full sentence; return `null` for that class; let the gate continue
- Construct fresh object literals in `checkParPublished`: `{ parValue: entry.parValue, parVersion: index.parVersion, source: index.source }` — never spread the engine result
- Use `for...of` everywhere; never `.reduce()` with branching
- Write `// why:` comments explaining D-5001 / D-5101 / D-5102 / D-5103 at the relevant call sites, citing decisions by ID

---

## Implementation Tasks (Authoritative)

### A) Create `apps/server/src/par/parGate.mjs` (new)

**Imports (allowed):**

```js
import {
  loadParIndex,
  lookupParFromIndex,
  ParStoreReadError,
} from '@legendary-arena/game-engine';

/** @typedef {import('@legendary-arena/game-engine').ParIndex} ParIndex */
/** @typedef {import('@legendary-arena/game-engine').ParArtifactSource} ParArtifactSource */
/** @typedef {import('@legendary-arena/game-engine').ScenarioKey} ScenarioKey */
```

(The file is `.mjs`, not `.ts`, per WP-004 server-runtime convention. JSDoc `@typedef` imports give type-checking without introducing `.ts`.)

**Forbidden imports:** `boardgame.io`, `@legendary-arena/registry`, `@legendary-arena/preplan`, `node:fs`, `node:fs/promises`, `node:net`, `node:http`, `node:child_process`.

**Exports (functions):**

- `checkParPublished(simIndex, seedIndex, scenarioKey)` — see Locked Values §checkParPublished
- `createParGate(basePath, parVersion)` — see Locked Values §createParGate

**Internal helpers (do NOT export):**

- `handleParLoadError(source, indexPath)` — returns a `.catch()` handler. Full-sentence warn-logs `ParStoreReadError`; re-throws any other error (non-`ParStoreReadError` shouldn't happen, but guard explicitly).
- `countUnionScenarios(simIndex, seedIndex)` — computes the size of the union of scenario keys across both indices for the startup log. Pure function; uses a `Set`.

**JSDoc every exported function** with a "Forbidden behaviors" block citing the relevant DECISIONS entries (D-5101 / D-5103).

### B) Create `apps/server/src/par/parGate.test.ts` (new — 13 tests)

Structure:

```ts
import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  buildParIndex,
  writeSeedParArtifact,
  writeSimulationParArtifact,
  // fixture-construction helpers from WP-050 surface; tests may use fs freely
} from '@legendary-arena/game-engine';

// @ts-ignore — importing .mjs from .ts; tsx handles this at runtime
import { checkParPublished, createParGate } from './parGate.mjs';
// @ts-ignore
import { loadParIndex } from '@legendary-arena/game-engine';

describe('PAR publication gate (WP-051)', () => {
  // ... 13 tests per Locked Values §Test count lock

  // loadParIndex smoke (3)
  test('loadParIndex returns a parsed ParIndex for a valid written index', async () => { /* ... */ });
  test('loadParIndex returns null for a missing index directory', async () => { /* ... */ });
  test('loadParIndex throws ParStoreReadError for an invalid JSON or cross-class source index', async () => { /* ... */ });

  // checkParPublished base (3)
  test('checkParPublished returns {parValue, parVersion, source: "simulation"} for a sim-only scenario', async () => { /* ... */ });
  test('checkParPublished returns null for a scenario absent from both indices', async () => { /* ... */ });
  test('checkParPublished returns null when both indices are null (dual-null fail closed)', () => { /* ... */ });

  // createParGate integration (3)
  test('createParGate returns a working gate whose checkParPublished matches module-level semantics', async () => { /* ... */ });
  test('gate check performs zero filesystem IO at request time (delete fixtures; gate still works)', async () => { /* ... */ });
  test('version isolation: v1 scenario does not appear when gate constructed with v2', async () => { /* ... */ });

  // dual-class precedence (3)
  test('sim-only: gate returns source: "simulation"', async () => { /* ... */ });
  test('seed-only: gate returns source: "seed" (graceful degradation)', async () => { /* ... */ });
  test('both-present with differing parValue: gate returns sim parValue and source: "simulation" (D-5101 precedence)', async () => { /* ... */ });

  // aliasing guard (1)
  test('two sequential calls return identity-distinct objects; mutating result1 does not affect result2 or the index', async () => { /* ... */ });
});
```

Exactly **13 tests in 1 `describe` block** → +1 suite. Tests use `mkdtemp(join(tmpdir(), 'wp051-gate-'))` for isolation; every test cleans up via `try { ... } finally { await rm(workspace, { recursive: true, force: true }); }`.

### C) Modify `apps/server/src/server.mjs`

Exactly two diff sites:

1. **Add the import** near the top of the file, alongside the existing `loadRules` import:

```js
import { createParGate } from './par/parGate.mjs';
```

2. **Extend the `Promise.all` inside `startServer()`** (currently at line 78):

```js
// why: PAR gate is the third independent startup task per WP-051 /
// D-5101. Non-blocking: createParGate handles all failure modes
// internally (warn-log + continue with partial or empty coverage).
// PAR_VERSION env var read per D-5102; ?? 'v1' fallback matches the
// PORT ?? '8000' pattern below.
const parGate = (await Promise.all([
  loadRegistry(),
  loadRules(),
  createParGate('data/par', process.env.PAR_VERSION ?? 'v1'),
]))[2];
```

OR equivalently (destructuring form, slightly cleaner):

```js
// why: same as above
const [, , parGate] = await Promise.all([
  loadRegistry(),
  loadRules(),
  createParGate('data/par', process.env.PAR_VERSION ?? 'v1'),
]);
```

Either form is acceptable; pick one and stay consistent.

- The `parGate` binding is held in the enclosing `startServer` scope. Since WP-051 does not yet expose an accessor, `parGate` is essentially "parked" in memory — future WP-053 will add a `getParGate()` equivalent to `getRules()`. The key correctness property is: **the gate IS constructed** and its startup log fires. Unused-variable lint may warn on `parGate`; add `// eslint-disable-next-line no-unused-vars` or rename to `_parGate` if necessary (prefer underscore rename).

Do NOT modify:
- The `loadRegistry()` function body
- The `registerHealthRoute` function
- The `Server({...})` configuration (CORS origins, games list)
- The `PORT` read or the `server.run` call
- The `registry.info()` logging

### D) Modify `apps/server/package.json`

Exactly one diff site — the `scripts.test` value:

```diff
-    "test": "node --import tsx --test scripts/**/*.test.ts"
+    "test": "node --import tsx --test 'scripts/**/*.test.ts' 'src/**/*.test.ts'"
```

Do NOT modify:
- The package name, version, type, main, description, engines
- The dependencies or devDependencies
- The key ordering

---

## Governance Decisions (Already Landed in A0)

No new DECISIONS entries are added during Commit A. The three relevant entries — **D-5101** (dual-index in-memory load), **D-5102** (`PAR_VERSION` env var), **D-5103** (existence-based trust) — were landed in the A0 SPEC bundle. Commit A cites them; Commit B does not add new ones.

If mid-execution an architectural ambiguity surfaces that isn't covered by D-5101/5102/5103 or by the pre-flight findings PS-1..PS-12, **STOP and escalate** — do NOT invent new decisions inline.

---

## Scope Lock (Authoritative)

### Commit A (EC-051) — exactly 4 files

- `apps/server/src/par/parGate.mjs` — NEW
- `apps/server/src/par/parGate.test.ts` — NEW
- `apps/server/src/server.mjs` — MODIFIED (import + Promise.all extension only)
- `apps/server/package.json` — MODIFIED (test glob only)

### Commit B (SPEC) — exactly 4 files

- `docs/ai/work-packets/WORK_INDEX.md` — flip WP-051 `[ ]` → `[x]` with date + Commit A hash
- `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-051 Draft → Done
- `docs/ai/STATUS.md` — record PAR gate availability
- `docs/ai/post-mortems/01.6-WP-051-par-publication-server-gate.md` — NEW post-mortem file (mandatory per 01.6)

### Files explicitly forbidden to touch (any of these = Hard Stop)

- Any file under `packages/game-engine/**` (A1 amendment already landed; engine is frozen during Commit A)
- Any file under `packages/registry/**`, `packages/preplan/**`, `packages/vue-sfc-loader/**`
- Any file under `apps/arena-client/**`, `apps/replay-producer/**`, `apps/registry-viewer/**`
- `apps/server/src/index.mjs`, `apps/server/src/rules/loader.mjs`, `apps/server/src/game/legendary.mjs`
- Any file under `apps/server/scripts/**` (existing CLI scripts are stable)
- `pnpm-lock.yaml`, `package.json` at repo root, `tsconfig*.json`
- `.claude/rules/**`, `docs/ai/REFERENCE/**`, `docs/ai/DECISIONS.md` (decisions already landed in A0)
- Any test fixture in `data/**`

If the implementation uncovers a structural problem requiring any of these files, **STOP and escalate** — do not force-fit under 01.5 (NOT INVOKED).

---

## Verification Steps

Run after Commit A is drafted but BEFORE committing. All must pass.

### Build + test

```bash
pnpm -r build
# Expected: exit 0

pnpm -r test
# Expected: exit 0; 671 tests / 127 suites / 0 fail total.
# apps/server specifically: 19 / 3 / 0.
# packages/game-engine: 506 / 113 / 0 (unchanged from A0 baseline).
```

### Layer-boundary grep gates

```bash
grep -nE "from ['\"]boardgame\.io" apps/server/src/par/parGate.mjs apps/server/src/par/parGate.test.ts
# Expected: no output.

grep -nE "from ['\"]node:fs" apps/server/src/par/parGate.mjs
# Expected: no output. (Tests may use node:fs; production file must not.)

grep -nE "from ['\"]node:(net|http|https|child_process|dns)" apps/server/src/par/parGate.mjs apps/server/src/par/parGate.test.ts
# Expected: no output.

grep -nE "LegendaryGame|ctx\." apps/server/src/par/parGate.mjs
# Expected: no output.

grep -nE "Math\.random|Date\.now" apps/server/src/par/parGate.mjs apps/server/src/par/parGate.test.ts
# Expected: no output.

grep -nE "\.reduce\(" apps/server/src/par/parGate.mjs
# Expected: no output (accumulation uses for...of).

grep -nE "require\(" apps/server/src/par/parGate.mjs apps/server/src/par/parGate.test.ts
# Expected: no output.

grep -nE "writeFile|mkdir|unlink|rename|truncate" apps/server/src/par/parGate.mjs
# Expected: no output (gate is read-only; IO is delegated to engine loadParIndex).
```

### Engine immutability gate

```bash
git diff main -- packages/game-engine/
# Expected: no output (A1 amendment is already on main; Commit A must not touch engine).
```

### Server-file discipline

```bash
git diff main -- apps/server/src/index.mjs apps/server/src/rules/loader.mjs apps/server/src/game/legendary.mjs apps/server/scripts/
# Expected: no output.
```

### `// why:` comment completeness

```bash
grep -c "// why:" apps/server/src/par/parGate.mjs
# Expected: >= 4 (checkParPublished oracle/precedence; checkParPublished aliasing; createParGate load-once; PAR_VERSION env read).

grep -c "// why:" apps/server/src/server.mjs
# Expected: existing count + 1 (the new Promise.all line)
```

### Test-glob expansion verified

```bash
pnpm --filter @legendary-arena/server test 2>&1 | grep "ℹ tests"
# Expected: "ℹ tests 19" — not 6 (which would mean the new tests weren't picked up)

pnpm --filter @legendary-arena/server test 2>&1 | grep "ℹ suites"
# Expected: "ℹ suites 3" — exactly +1 from baseline 2.
```

If `ℹ tests` is 6, the test glob expansion did not take effect — check `apps/server/package.json` `scripts.test` value.

### Scope lock — only expected files changed

```bash
git diff --name-only main | sort
# Expected for Commit A (exactly 4 lines):
#   apps/server/package.json
#   apps/server/src/par/parGate.mjs
#   apps/server/src/par/parGate.test.ts
#   apps/server/src/server.mjs
```

### Suite count discipline (P6-54)

```bash
pnpm -r test 2>&1 | grep -E "apps/server test: ℹ suites"
# Expected: "apps/server test: ℹ suites 3" — exactly +1 from baseline 2.
```

If the suite count is 2 or 4, the test file is missing the wrapping `describe()` or has an extra one.

### No-fs-at-request-time proof (manual spot-check)

After test #8 passes, manually confirm its semantics by reading the test body:
- Gate constructed over a tmpdir workspace
- Workspace `rm -rf`'d while the gate is held in memory
- Subsequent `checkParPublished` calls still return the pre-deletion PAR values

This proves the gate is closed over in-memory data, not backed by filesystem.

---

## Definition of Done

Every item below MUST be true before Commit A is committed:

- [ ] `pnpm -r build` exits 0
- [ ] `pnpm -r test` exits 0 with `671 / 127 / 0` total; `19 / 3 / 0` for apps/server
- [ ] Engine baseline unchanged at `506 / 113 / 0` (A1 amendment already applied in A0)
- [ ] All **13** PAR gate tests pass (3 loadParIndex smoke + 3 checkParPublished base + 3 createParGate integration + 3 dual-class precedence + 1 aliasing guard)
- [ ] Every test file uses `.test.ts` — never `.test.mjs`
- [ ] No `boardgame.io`, `LegendaryGame`, `ctx.*`, `node:fs`, or `node:fs/promises` imports in `parGate.mjs` (grep-verified)
- [ ] No `Math.random()`, `Date.now()`, `.reduce()` with branching, or `require()` in any new file
- [ ] No engine / registry / preplan / arena-client / replay-producer / registry-viewer files modified
- [ ] No `apps/server/src/index.mjs`, `rules/loader.mjs`, or `game/legendary.mjs` modifications
- [ ] `apps/server/package.json` test glob covers `src/**/*.test.ts` (proven by the new tests actually running — Commit A verification shows 19 server tests, not 6)
- [ ] `checkParPublished` returns a fresh object literal on every hit (test #13)
- [ ] `checkParPublished` parameter typed as `ScenarioKey`, not raw `string` (JSDoc or type import)
- [ ] `createParGate` loads both source classes via `Promise.all` on two `loadParIndex` calls
- [ ] `createParGate` catches `ParStoreReadError` per class, warn-logs, returns `null` for that class
- [ ] Startup log format matches Locked Values §createParGate (all four variants: both-loaded, sim-missing, seed-missing, both-missing)
- [ ] `server.mjs` `Promise.all` extended with `createParGate('data/par', process.env.PAR_VERSION ?? 'v1')` as the third task
- [ ] `server.mjs` NOT otherwise modified (registry load, rules load, CORS origins, PORT, server.run all unchanged)
- [ ] `// why:` comments present at all four required sites in `parGate.mjs` + one in `server.mjs`
- [ ] Post-mortem written at `docs/ai/post-mortems/01.6-WP-051-par-publication-server-gate.md` covering all 8 mandatory checks (pre-Commit B)
- [ ] Commit A subject line starts with `EC-051:`; Commit B subject line starts with `SPEC:`
- [ ] `git diff --name-only main` for Commit A shows exactly 4 lines (parGate.mjs, parGate.test.ts, server.mjs, package.json)

---

## Final Instruction

WP-051 is the moment PAR becomes **enforceable**. WP-050 made PAR persistent; WP-051 makes it authoritative at the pre-submission gate. Every constraint here — the fresh-object-literal return, the `Promise.all` of both `loadParIndex` calls, the in-memory-only request path, the `PAR_VERSION` env var with `?? 'v1'` fallback, the `.test.ts` extension, the expanded test glob, the grep-verified absence of `node:fs` in the gate — exists because a single trust violation at the leaderboard gate corrupts every competitive record downstream.

The pre-flight recovered 6 BLOCKING and 6 non-blocking findings; the A0 bundle resolved all 12 plus 6 copilot-check RISK items. The WP-051 surface is now small, locked, and unambiguous: 4 files, 13 tests, zero engine changes, zero gameplay changes. If anything feels underdefined, re-read EC-051 (primary execution authority) and the pre-flight (rationale). If still unclear — STOP and ask. Do not guess.
