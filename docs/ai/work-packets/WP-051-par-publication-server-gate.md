# WP-051 — PAR Publication & Server Gate Contract

**Status:** Reviewed — Pre-Flight READY TO EXECUTE (2026-04-23, A0 SPEC bundle)
**Primary Layer:** Server / Enforcement (Read-Only)
**Dependencies:** WP-050 (including A1 `loadParIndex` amendment, 2026-04-23), WP-004

**A0 amendment history:**
- 2026-04-23 — A0 SPEC bundle lands; resolves pre-flight PS-1..PS-12
  (see [preflight-wp051-par-publication-server-gate.md](../invocations/preflight-wp051-par-publication-server-gate.md)).
  Amendments: §Assumes re-anchored on WP-050 A1 `loadParIndex` export;
  §Non-Negotiable locked on `PAR_VERSION` env var (D-5102);
  `checkParPublished` return shape expanded to `{parValue, parVersion, source}`
  (D-5101); §Scope A rewritten for dual-index load preserving D-5003
  precedence (D-5101); §B target corrected from `index.mjs` to `server.mjs`;
  §C test count moved from 9 to 13 (dual-class tests + aliasing test);
  §Files Expected to Change adds `apps/server/package.json`;
  test file extension flipped from `.test.mjs` to `.test.ts` throughout.

---

## Session Context

WP-050 established PAR artifact storage — immutable, versioned, content-addressed
JSON files with cryptographic hashing and a sorted index. WP-004 established the
server bootstrap sequence (registry + rules loaded before accepting requests).
This packet adds **PAR index loading** as a third startup task and provides a
**gate check function** that determines whether competitive play is allowed for
a given scenario. The server is an **enforcer**, not a calculator — it reads the
index in read-only mode and rejects competitive submissions when PAR is missing.

This packet does NOT implement the leaderboard submission endpoint (future work).
It establishes the gate check that any future submission endpoint must call.

---

## Goal

Introduce PAR index loading at server startup and the competitive gate check.
After this session:

- PAR index is loaded at startup alongside the registry and rules text
- `checkParPublished(scenarioKey)` returns the PAR value and version if
  published, or `null` if not — using the index only, never probing artifact
  files
- The gate check is a pure read-only function with no side effects
- If the PAR index is missing or invalid, all competitive submissions are
  rejected (fail closed)
- The server never generates, modifies, repairs, or rebuilds PAR data
- Leaderboard submission endpoints (future) have a clear, documented contract
  for calling the gate

---

## Assumes

- WP-050 complete, including the A1 amendment (2026-04-23) that exports
  `loadParIndex`. Specifically:
  - `ParIndex` type is exported from `@legendary-arena/game-engine`
    with fields `parVersion`, `source: 'seed' | 'simulation'`,
    `generatedAt`, `scenarioCount`, `scenarios: Record<ScenarioKey, {path,
    parValue, artifactHash}>`
  - `loadParIndex(basePath, parVersion, source): Promise<ParIndex | null>`
    is exported (A1 amendment) — returns `null` for a missing index file,
    throws `ParStoreReadError` for malformed content or source-class
    corruption. This is the startup-time primitive the gate consumes.
  - `lookupParFromIndex(index, scenarioKey)` is exported and returns
    `{ path, parValue } | null` — used per gate check on the already-loaded
    in-memory index
  - `ParArtifactSource` union, `PAR_ARTIFACT_SOURCES` canonical array, and
    `ParStoreReadError` class are exported
  - `data/par/{seed,sim}/{version}/index.json` dual-class structure is
    defined (either or both indices may not exist yet at runtime — the
    server must handle the missing-index case per D-5101)
- WP-004 complete. Specifically:
  - Server startup sequence exists at `apps/server/src/server.mjs`
    (entry point `apps/server/src/index.mjs` only installs SIGTERM and
    calls `startServer()` — the Promise.all of startup tasks lives in
    `server.mjs`)
  - Registry loading and rules loading are established startup tasks
    in `startServer()` via `Promise.all([loadRegistry(), loadRules()])`
  - Server does not accept requests until all startup tasks succeed
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `.claude/rules/server.md` — read the server layer rules. The server is a
  wiring layer only. It must never contain game logic, interpret `G`, or
  compute difficulty. PAR gate enforcement is a read-only existence check —
  this is within the server's authority.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the server
  connects pieces; it does not decide outcomes. PAR loading is analogous to
  registry loading: immutable data loaded at startup.
- `docs/12-SCORING-REFERENCE.md — "Scenario PAR Definition & Derivation"` —
  read the calibration invariants. The index is the canonical oracle for PAR
  existence.
- `docs/12.1-PAR-ARTIFACT-INTEGRITY.md` — read the trust model. The server
  enforces trust but does not create it.
- `apps/server/src/index.mjs` — read the current startup sequence. PAR index
  loading follows the same pattern as registry and rules loading.
- `apps/server/src/server.mjs` — read the current server wiring.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+
- `node:` prefix on all Node.js built-in imports
- No database or network access for PAR gate checks (file-based only)
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **Server is read-only for PAR data** — must not generate, modify, repair,
  rebuild, or revalidate PAR artifacts or index. If data is missing or
  invalid, fail closed.
- **Index is the sole oracle** — the server must not infer PAR existence by
  probing artifact files or filesystem paths. Only `index.json` determines
  publication state.
- **Fail closed** — if the PAR index is missing, unreadable, or invalid, all
  competitive submissions are rejected. Silent fallback is forbidden.
- **Upstream validation assumed** — the server assumes PAR artifacts have been
  validated by `validateParStore` in CI; it does not perform integrity
  validation itself.
- **No game logic in server** — the gate check is an existence check, not
  difficulty computation. The server does not interpret PAR values.
- **No engine modifications** — the gate check consumes types from
  `@legendary-arena/game-engine` but does not modify any engine files.
- **No leaderboard endpoint** — this packet establishes the gate function.
  The submission endpoint is future work that must call this gate.
- Server files use `.mjs` extension (consistent with WP-004)

**Locked contract values:**

- **Startup task (PAR index loading) — locked per D-5101 + D-5102:**
  - Reads **both** `data/par/sim/{PAR_VERSION}/index.json` and
    `data/par/seed/{PAR_VERSION}/index.json` via the engine's
    `loadParIndex(basePath, parVersion, source)` helper
  - `basePath` is the repo-root relative `data/par` (same root registry
    loading already uses in `server.mjs`)
  - `PAR_VERSION` is sourced from the `PAR_VERSION` environment variable,
    defaulting to `'v1'` via `??`, matching the `PORT ?? '8000'` fallback
    pattern in `server.mjs:105`. Stable for process lifetime per D-5102;
    server does not support runtime reload.
  - On success (both indices loaded): log
    `[server] PAR index loaded: N scenarios (vX; sim=M, seed=K)` where N
    is the union-unique scenario count, M and K are the per-class counts
  - On one-class missing: warn-log
    `[server] PAR {seed|sim} index missing at path {…}; continuing with
    {other-class}-only coverage`; the gate operates as a single-class
    gate for the missing side
  - On both-missing: warn-log
    `[server] PAR index unavailable; competitive submissions disabled`;
    the gate returns `null` for every scenario (fail closed)
  - On malformed index (`loadParIndex` throws `ParStoreReadError`):
    treat the malformed class as if missing — warn-log the
    `ParStoreReadError.message`, set that class's index to `null`,
    continue. The server does not crash on PAR-load failures; casual
    play is unaffected.
  - The PAR index load task is **optional** for server startup — the
    server may start with zero indices loaded (casual play continues;
    competitive submissions fail closed)

- **Gate check function — locked per D-5101:**
  ```
  checkParPublished(scenarioKey: ScenarioKey): {
    parValue: number;
    parVersion: string;
    source: 'seed' | 'simulation';
  } | null
  ```
  - Queries the in-memory simulation index first. If the scenario key is
    present, returns `{parValue: entry.parValue, parVersion:
    simIndex.parVersion, source: 'simulation'}`.
  - Else queries the in-memory seed index. If present, returns
    `{parValue: entry.parValue, parVersion: seedIndex.parVersion, source:
    'seed'}`.
  - Else returns `null`.
  - **Must return a fresh object literal on every call** — never return a
    reference into the index. This prevents caller-induced corruption of
    the in-memory index via aliasing. A dedicated test asserts two
    sequential calls with the same key return non-identical (`!==`)
    objects with equal (`===`) field values.
  - Lookup via in-memory indices only — **never probes filesystem** at
    request time
  - Pure read-only, no side effects, synchronous
  - The server must not interpret, transform, or reason about `parValue`;
    it is returned only for recording and display purposes
  - Gate evaluation is strictly binary: published or not published.
    Probabilistic, heuristic, or partial acceptance is forbidden.
  - Parameter typed as `ScenarioKey` (aliased `string` from WP-048
    `parScoring.types.ts`), not raw `string`, to narrow the boundary
    against accidental match-id / player-id misuse.

- **Rejection semantics (contract for future leaderboard endpoints):**
  - If `checkParPublished` returns `null`, competitive submission must be
    rejected with a clear error: "PAR not published for this scenario"
  - The match may still be played casually
  - The result must not be ranked, scored against PAR, or appear on
    competitive leaderboards
  - Rejection must not depend on player identity, hero selection, or
    match outcome

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding

---

## Scope (In)

### A) `apps/server/src/par/parGate.mjs` — new

The PAR gate module exposes exactly three functions. All PAR-file IO
is delegated to the engine via `loadParIndex` (WP-050 A1 amendment);
this server file imports **types and named functions** from
`@legendary-arena/game-engine` only — no `node:fs`, no `node:fs/promises`,
no `boardgame.io`, no `LegendaryGame`, no `ctx`.

- `checkParPublished(simIndex, seedIndex, scenarioKey)` —
  pure synchronous lookup across both in-memory indices per D-5101
  sim-over-seed precedence
  - Signature:
    `(simIndex: ParIndex | null, seedIndex: ParIndex | null,
    scenarioKey: ScenarioKey) => {parValue, parVersion, source} | null`
  - Queries `simIndex` first via `lookupParFromIndex`; if hit, returns
    `{parValue: hit.parValue, parVersion: simIndex.parVersion, source:
    'simulation'}`. Else queries `seedIndex`; if hit, returns
    `{parValue: hit.parValue, parVersion: seedIndex.parVersion, source:
    'seed'}`. Else `null`.
  - Constructs a **fresh object literal** on every hit — never returns a
    reference into the index (aliasing guard; tested in test #13).
  - `// why:` comment: index is the canonical oracle; filesystem probing
    is forbidden to prevent race conditions and integrity bypass.
    Sim-over-seed precedence per D-5003 / D-5101 preserves the
    three-phase PAR derivation pipeline at the gate layer.

- `createParGate(basePath, parVersion)` — async factory that loads **both**
  source-class indices once at startup via `loadParIndex` and returns a
  bound gate
  - Signature:
    `(basePath: string, parVersion: string) => Promise<{
      checkParPublished(scenarioKey: ScenarioKey):
        {parValue, parVersion, source} | null;
      readonly simulationScenarioCount: number;
      readonly seedScenarioCount: number;
    }>`
  - Calls `loadParIndex(basePath, parVersion, 'simulation')` and
    `loadParIndex(basePath, parVersion, 'seed')` in parallel via
    `Promise.all`. Each call returns `ParIndex | null`.
  - On `ParStoreReadError` from either load: catches the error,
    warn-logs the error message, treats that class as missing (sets
    its index to `null`). The gate continues to operate.
  - On one-class missing: warn-logs `[server] PAR {seed|sim} index
    missing at path {…}; continuing with {other-class}-only coverage`.
  - On both-classes missing: warn-logs `[server] PAR index unavailable;
    competitive submissions disabled`.
  - On at least one class loaded: info-logs
    `[server] PAR index loaded: N scenarios (vX; sim=M, seed=K)` where
    N is the size of the union of scenario keys across both indices.
  - The returned gate object exposes a **synchronous** `checkParPublished`
    that is the partial-application of the module-level
    `checkParPublished(simIndex, seedIndex, …)` over the loaded indices.
  - `// why:` comment: load once at startup, check many times per request —
    same pattern as registry loading. Both source classes loaded to
    preserve D-5101 sim-over-seed precedence without per-request
    filesystem IO.

### B) `apps/server/src/server.mjs` — modified

- Add PAR gate creation as a third independent startup task after
  registry and rules. Preferred pattern: extend the existing
  `Promise.all([loadRegistry(), loadRules()])` to
  `Promise.all([loadRegistry(), loadRules(), createParGate(basePath,
  parVersion)])`, destructuring the third result into a `parGate`
  constant.
- `basePath` is the literal `'data/par'` (same root convention as
  `'data/metadata'` / `'data/cards'` already used by `loadRegistry`).
- `parVersion` is sourced from `process.env.PAR_VERSION ?? 'v1'`
  per D-5102.
- PAR index loading is **non-blocking** — the server starts even if
  both indices fail to load (casual play continues; competitive gate
  returns `null` for all scenarios). `createParGate` never throws;
  it handles `ParStoreReadError` internally per Scope A.
- The resulting `parGate` object is **stored in server-module scope**
  (similar to `getRules()` pattern). Future submission / leaderboard
  WPs (WP-053, WP-054) will import an accessor (`getParGate()`) to
  invoke `checkParPublished` from their request handlers. Exposing
  the accessor is out of scope for this packet — `createParGate`'s
  return value is captured and logged; no new exports from
  `server.mjs` are required.

> **Note:** The entry point `apps/server/src/index.mjs` is **not**
> modified. The startup-task Promise.all lives in `server.mjs`; the
> entry point only installs SIGTERM handling and calls `startServer()`.

### C) Tests — `apps/server/src/par/parGate.test.ts` — new

- Uses `node:test` and `node:assert` only (no `boardgame.io/testing`)
- Test file extension is **`.test.ts`** per `.claude/CLAUDE.md` — never
  `.test.mjs`. The `apps/server/package.json` `test` script is expanded
  to cover `src/**/*.test.ts` alongside the existing
  `scripts/**/*.test.ts` pattern (see §Files Expected to Change).
- Test file imports from `./parGate.mjs` — runtime code stays `.mjs`,
  tests use the monorepo-wide `.test.ts` convention.
- **Thirteen tests** inside one `describe('PAR publication gate (WP-051)', …)`
  block:

  **`loadParIndex` smoke (engine-surface verification)**
  1. `loadParIndex` returns a parsed `ParIndex` with the expected
     `source` / `parVersion` / `scenarios` fields for a valid
     hand-authored or `buildParIndex`-produced index
  2. `loadParIndex` returns `null` for a missing index directory
  3. `loadParIndex` throws `ParStoreReadError` for an index file
     whose contents are not valid JSON OR whose `source` stamp
     disagrees with its directory (either acceptable)

  **`checkParPublished` base behavior**
  4. Returns `{parValue, parVersion, source: 'simulation'}` for a
     scenario published only in the simulation index
  5. Returns `null` for a scenario absent from both indices
  6. Returns `null` when both indices are `null` (dual-null fail closed)

  **`createParGate` integration**
  7. Returns a working gate object whose `checkParPublished` matches
     the module-level function's semantics on the loaded indices
  8. Gate check performs zero filesystem IO at request time — asserted
     by constructing the gate with `node:os.tmpdir()`-backed indices,
     then deleting the backing files and confirming multiple
     subsequent `checkParPublished` calls still return the correct
     results (the gate is closed over in-memory data)
  9. Version isolation — a scenario published only under `v1` does
     NOT appear when the gate is constructed with `parVersion: 'v2'`

  **Dual-class precedence (D-5101)**
  10. Sim-only coverage: simulation index has the scenario, seed
      does not → returns `source: 'simulation'`
  11. Seed-only coverage: seed index has the scenario, simulation
      does not → returns `source: 'seed'` (graceful degradation)
  12. Both classes cover the scenario: returns `source: 'simulation'`
      (sim-over-seed precedence per D-5003 / D-5101), and `parValue`
      matches the simulation entry, NOT the seed entry, even when
      the two differ

  **Aliasing guard (copilot check #17)**
  13. Two sequential `checkParPublished(key)` calls for the same
      published `key` return two objects where
      `result1 !== result2` (distinct identity — no shared reference
      into the index) but every field is `===` (equal by value) —
      mutating `result1` must not observably mutate `result2` nor
      the in-memory index

- Tests construct temporary PAR index fixtures under
  `node:os.tmpdir()` workspaces; workspaces are cleaned up in
  `afterEach` / `finally`. No tests depend on `data/par/` content
  from the repo (which is empty at A0 time).

---

## Out of Scope

- **No leaderboard submission endpoint** — the gate function exists; the
  endpoint that calls it is future work
- **No PAR generation or repair** — server is read-only
- **No artifact file loading** — server uses index only
- **No database** — PAR gate is file-based
- **No engine modifications**
- **No UI for PAR display**
- **No WP-050 contract modifications**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`. Server-layer
> enforcement of the pre-release PAR gate — the keystone for §24
> replay-verified integrity entering Phase 7 launch.

**Vision clauses touched:** §3, §22, §24, §25, §26

**Conflict assertion:** No conflict. Casual play continues when PAR is
absent — protects §3 (no opaque difficulty imposed on non-competitive
players). Competitive submissions fail closed when PAR is missing —
protects §24 and §25 (no skill claim on an unpublished baseline).
Server is read-only for PAR data; never derives or mutates it
(preserves §22 and §26 calibration authority).

**Non-Goal proximity:** N/A — server gate; no paid surface. The
fail-closed posture structurally prevents NG-1 (no payer can bypass
the gate by submitting against a missing PAR).

**Determinism preservation:** STRONG. `checkParPublished` is index-only
lookup — no filesystem probing, no derivation. Server is enforcer, not
calculator; any computation is delegated to the engine. The gate's
behavior is fully determined by the published index plus the submitted
scenario key.

---

## Files Expected to Change

- `apps/server/src/par/parGate.mjs` — **new** — `checkParPublished` +
  `createParGate` (consumes `loadParIndex` + `lookupParFromIndex` from
  the engine; no `node:fs` imports)
- `apps/server/src/server.mjs` — **modified** — add PAR gate creation
  as a third independent startup task inside `startServer()` via
  `Promise.all`; read `PAR_VERSION` env var with `?? 'v1'` fallback
- `apps/server/src/par/parGate.test.ts` — **new** — exactly **13 tests**
  inside one `describe('PAR publication gate (WP-051)', …)` block
  (+1 suite)
- `apps/server/package.json` — **modified** — expand the `test` script
  from `"node --import tsx --test scripts/**/*.test.ts"` to cover
  `src/**/*.test.ts` as well (e.g.,
  `"node --import tsx --test 'scripts/**/*.test.ts' 'src/**/*.test.ts'"`).
  Without this change, the new tests in `apps/server/src/par/` are
  silently skipped by the test runner — a silent-green risk flagged
  in pre-flight PS-6.

**Governance documents** (per §Definition of Done, always permitted):
- `docs/ai/STATUS.md` — modified
- `docs/ai/DECISIONS.md` — modified (status entry; D-5101/D-5102/D-5103
  were added during the A0 SPEC bundle, not during Commit A)
- `docs/ai/work-packets/WORK_INDEX.md` — modified (status flip to
  Completed)

No other files may be modified. `git diff --name-only` at Definition of
Done must match this list exactly. "Anything not explicitly allowed is
forbidden."

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### PAR Index Loading (delegated to engine `loadParIndex`)
- [ ] `createParGate` invokes `loadParIndex` for **both** simulation and
      seed source classes (verified by test #1 + #10 + #11 + #12)
- [ ] Missing index directory → `loadParIndex` returns `null`; gate
      degrades to "this class has no coverage" without throwing
      (test #2)
- [ ] Malformed index or source-stamp mismatch → `loadParIndex` throws
      `ParStoreReadError`; `createParGate` catches the throw, warn-logs,
      treats that class as missing (test #3)
- [ ] Startup log on success: `[server] PAR index loaded: N scenarios
      (vX; sim=M, seed=K)`; warning log on each missing / malformed
      class; server starts successfully in all cases
- [ ] No write operations inside `parGate.mjs` (verified with
      `Select-String` in §Verification Steps)

### Gate Check
- [ ] `checkParPublished` returns `{parValue, parVersion, source}` for
      a simulation-only scenario with `source: 'simulation'` (test #4)
- [ ] Returns `{parValue, parVersion, source: 'seed'}` for a
      seed-only scenario (test #11 — PS-2 graceful degradation)
- [ ] Returns `{..., source: 'simulation'}` for a scenario in both
      indices (test #12 — D-5101 / D-5003 precedence)
- [ ] Returns `null` when the scenario is absent from both indices
      (test #5)
- [ ] Returns `null` when both indices are `null` (test #6 —
      dual-null fail closed)
- [ ] Returns a **fresh object literal** on every call (test #13 —
      aliasing guard)
- [ ] Uses in-memory indices only — **no filesystem IO at request
      time** (test #8 — files deleted after gate construction; gate
      still works)
- [ ] Pure, synchronous, no side effects
- [ ] Parameter narrows to `ScenarioKey` (not raw `string`)

### Startup Integration (`server.mjs`)
- [ ] PAR gate created inside `startServer()` alongside
      `loadRegistry()` + `loadRules()` via `Promise.all`
- [ ] `PAR_VERSION` env var read with `?? 'v1'` fallback per D-5102
- [ ] Server starts even when both PAR indices are absent
      (non-blocking — casual play unaffected)
- [ ] Competitive features structurally disabled when both indices
      are `null` (every `checkParPublished` call returns `null`)

### Layer Boundaries
- [ ] No engine files modified (`git diff --name-only
      packages/game-engine/` returns empty)
- [ ] No WP-050 contract files modified
      (`packages/game-engine/src/simulation/par.storage.ts` unchanged
      during execution — A1 amendment landed separately in the A0
      bundle, not in Commit A)
- [ ] No game logic, `boardgame.io` imports, `LegendaryGame` imports,
      or `ctx.*` references in `parGate.mjs` (verified via
      `Select-String`)
- [ ] No `node:fs` or `node:fs/promises` imports in `parGate.mjs` —
      PAR file IO is delegated entirely to `loadParIndex` (verified
      via `Select-String`)
- [ ] Server does not generate, modify, repair, or recompute PAR data;
      hash validation is CI-time only per D-5103

### Tests
- [ ] All **13** PAR gate tests pass
- [ ] Tests use `node:test` and `node:assert` only
- [ ] Test file uses `.test.ts` extension per `.claude/CLAUDE.md` —
      never `.test.mjs`
- [ ] `apps/server/package.json` `test` script covers
      `src/**/*.test.ts` (verified by test-output summary showing
      13 new tests passing, which would not run under the
      pre-expansion `scripts/**/*.test.ts` glob alone)

### Scope Enforcement
- [ ] No files outside §Files Expected to Change were modified
      (confirmed with `git diff --name-only`)
- [ ] The A1 `loadParIndex` amendment to `par.storage.ts` + test file
      was already committed during the A0 SPEC bundle — it must NOT
      appear in Commit A's diff

---

## Verification Steps

```bash
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — run server tests
pnpm --filter @legendary-arena/server test
# Expected: all tests passing, 0 failing. Server baseline was 6/2/0
# pre-WP-051; post-WP-051 expected 19/3/0 (+13 tests / +1 suite).

# Step 3 — confirm no engine modifications during Commit A
git diff --name-only packages/game-engine/
# Expected: no output (the A1 loadParIndex amendment is in the
# A0 bundle commit, NOT in WP-051 Commit A).

# Step 4 — confirm no WP-050 artifact storage modifications during Commit A
git diff --name-only packages/game-engine/src/simulation/par.storage.ts
# Expected: no output

# Step 5 — confirm no game logic in PAR gate
grep -nE "boardgame\.io|LegendaryGame|ctx\." apps/server/src/par/parGate.mjs
# Expected: no output

# Step 6 — confirm read-only (no filesystem write or fs import in gate)
grep -nE "writeFile|mkdir|unlink|rename|from ['\"]node:fs" apps/server/src/par/parGate.mjs
# Expected: no output (fs IO is delegated entirely to loadParIndex
# in the engine)

# Step 7 — confirm no files outside scope
git diff --name-only
# Expected: only files listed in §Files Expected to Change —
#   apps/server/src/par/parGate.mjs
#   apps/server/src/server.mjs
#   apps/server/src/par/parGate.test.ts
#   apps/server/package.json
#   docs/ai/STATUS.md
#   docs/ai/DECISIONS.md
#   docs/ai/work-packets/WORK_INDEX.md
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] Server tests pass with 0 failures
- [ ] No engine files modified (confirmed with `git diff`)
- [ ] No game logic in PAR gate files (confirmed with `Select-String`)
- [ ] No write operations in PAR gate files (confirmed with `Select-String`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — PAR gate check exists at server layer;
      competitive submissions can be gated on PAR existence; fail-closed
      behavior when PAR index is missing
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why PAR loading is
      non-blocking (casual play unaffected); why index-only lookup (no
      filesystem probing); why fail-closed (trust preservation); server as
      enforcer not calculator
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-051 checked off with today's date
