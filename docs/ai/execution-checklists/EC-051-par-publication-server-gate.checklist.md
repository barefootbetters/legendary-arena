# EC-051 — PAR Publication & Server Gate (Execution Checklist)

**Source:** docs/ai/work-packets/WP-051-par-publication-server-gate.md
**Layer:** Server / Enforcement (Read-Only)
**A0 amendment date:** 2026-04-23 — resolves pre-flight PS-1..PS-12 and
copilot-check RISK items (29, 17, 21, 11, 26, 30).

## Before Starting
- [ ] WP-050 complete — including **A1 amendment** (2026-04-23) that
      exports `loadParIndex(basePath, parVersion, source): Promise<ParIndex | null>`
- [ ] `ParIndex`, `ParArtifactSource`, `PAR_ARTIFACT_SOURCES`,
      `lookupParFromIndex`, `ParStoreReadError` all present on the
      `@legendary-arena/game-engine` exported surface
- [ ] WP-004 complete — `startServer()` in `apps/server/src/server.mjs`
      awaits `Promise.all([loadRegistry(), loadRules()])`
- [ ] `.claude/rules/server.md` read — server is wiring layer only
- [ ] DECISIONS entries D-5101 (dual-index load), D-5102 (`PAR_VERSION`
      env var), D-5103 (existence-based trust) present
- [ ] `pnpm -r build` exits 0
- [ ] Pre-WP-051 test baseline (post-A0 bundle): game-engine 506/113/0,
      server 6/2/0, repo-wide 658/126/0. Re-measure at session start
      with `pnpm -r test`.

## Locked Values (do not re-derive)

### Source of PAR
- Index files are the sole oracle of PAR publication — filesystem
  probing of artifact files forbidden at request time
- Both source classes (`seed` and `simulation`) are loaded at startup
  via the engine's `loadParIndex` helper. Per-request filesystem IO
  is forbidden.
- Hash validation is **CI-time only** via WP-050 `validateParStore`;
  the server trusts indices verbatim per D-5103 (server does not
  reimplement `validateParStore` or recompute `artifactHash`)

### Configuration
- Active PAR version from env var `PAR_VERSION`, with fallback
  `?? 'v1'` per D-5102. Read once at startup; stable for process
  lifetime. No runtime reload. No SIGHUP support.
- No validation of `PAR_VERSION` format — a bad value surfaces as
  missing-index warnings, not a startup crash (fail-soft per
  D-5102)
- `basePath` is the literal `'data/par'` (matches `loadRegistry`'s
  `'data/metadata'` / `'data/cards'` convention)

### Startup semantics
- PAR gate creation is non-blocking at startup: the server starts
  even if both indices fail to load
- Both-missing → warn-log `[server] PAR index unavailable;
  competitive submissions disabled`; gate returns `null` always
- One-missing → warn-log per class; gate serves from the present
  class only (D-5101 graceful degradation)
- Both-present → info-log `[server] PAR index loaded: N scenarios
  (vX; sim=M, seed=K)` where N = size of the union of scenario keys
- Malformed index (`ParStoreReadError` thrown by `loadParIndex`) →
  caught inside `createParGate`; warn-log the error message; treat
  that class as missing. Server never crashes on PAR-load failure.

### Gate check semantics
- Return shape: `{parValue: number; parVersion: string; source:
  'seed' | 'simulation'} | null`. All three fields required on a hit
  per D-5101. `source` is load-bearing for downstream leaderboard
  records (WP-053, WP-054).
- Precedence rule (D-5101 / D-5003): sim index queried first; if hit,
  returns `source: 'simulation'`. Else seed index queried; if hit,
  returns `source: 'seed'`. Else `null`.
- Must return a **fresh object literal** on every call — never return
  a reference into the index (aliasing guard; test #13 enforces)
- Parameter typed as `ScenarioKey`, not raw `string` (narrow-boundary
  discipline per copilot-check #21)
- Synchronous, pure, no side effects

### Rejection semantics (contract for future leaderboard endpoints)
- Submission rejected iff `checkParPublished` returns `null`
- Rejection deterministic — no player-specific, hero-dependent, or
  outcome-dependent behavior
- Gate is strictly binary: published or not published; no
  probabilistic / heuristic / partial acceptance
- Casual play never gated — only competitive submissions are gated
- Server must not interpret, transform, or reason about `parValue` —
  it is returned only for recording and display purposes

### Semantic lock
- "Published" means **present in the active-version index** for the
  scenario key. Absence of the on-disk artifact file does NOT
  matter for gate evaluation — the server trusts the index per
  D-5103. This prevents a well-intentioned "let me verify the
  artifact file actually exists" code path.

### Server extension rules
- Server files use `.mjs` extension for runtime code (consistent
  with WP-004)
- **Test files use `.test.ts`** per `.claude/CLAUDE.md` (monorepo
  convention) — never `.test.mjs`

## Guardrails

### Engine boundary
- No engine files modified during Commit A (`git diff --name-only
  packages/game-engine/` returns empty)
- No WP-050 contract file modified during Commit A — the A1
  `loadParIndex` amendment was landed in the A0 SPEC bundle, not
  Commit A
- No `boardgame.io`, `LegendaryGame`, or `ctx.*` imports in
  `parGate.mjs`

### Filesystem boundary
- **No `node:fs` or `node:fs/promises` imports in `parGate.mjs`** —
  PAR file IO is delegated entirely to `loadParIndex` in the engine
  (D-5001 line 8937: server consumes through engine API). Verified
  by grep at Definition of Done.
- No `writeFile`, `mkdir`, `unlink`, `rename`, `truncate`, `rm`
  calls in `parGate.mjs`
- Server does not write to `data/par/**`

### Logic boundary
- No game logic in PAR gate files — existence check only, not
  difficulty computation. No interpretation, transformation, or
  reasoning about `parValue`.
- No `validateParStore` reimplementation on the server — hash /
  coverage validation is CI-time only per D-5103
- No "temporary bypass" flags or silent fallback paths
- No automatic index regeneration on server startup
- No database for PAR enforcement

### Named imports only from engine
- Engine imports in `parGate.mjs` limited to the named surface:
  `loadParIndex`, `lookupParFromIndex`, `ParStoreReadError`, and
  the types `ParIndex`, `ParArtifactSource`, `ScenarioKey`. No
  `import *`; no barrel re-exports. No engine internals
  (`tryLoadIndex`, `tryReadFile`, etc. — those are not exported
  and must not be imported by any means).

## Required `// why:` Comments
- `parGate.mjs` `checkParPublished`: index is canonical oracle;
  filesystem probing forbidden (D-5103); sim-over-seed precedence
  per D-5003 / D-5101 preserves the three-phase PAR derivation
  pipeline at the gate layer
- `parGate.mjs` `checkParPublished` fresh-object construction:
  aliasing guard — the index must not be observable as mutable
  via a caller holding a returned reference
- `parGate.mjs` `createParGate`: load both source classes once at
  startup, check many times per request — same pattern as registry
  loading. `Promise.all` on the two `loadParIndex` calls; catch
  `ParStoreReadError` per class and warn-log rather than crashing.
- `parGate.mjs` `PAR_VERSION` env read: operator-configured per
  D-5102; stable for process lifetime; no runtime reload
- `server.mjs` new `createParGate` call in the `Promise.all`: PAR
  gate is the third independent startup task per WP-051; non-blocking
  failure semantics per EC-051 line 39

## Files to Produce

- `apps/server/src/par/parGate.mjs` — **new** — `checkParPublished` +
  `createParGate` (no `node:fs` imports; delegates PAR file IO to
  engine `loadParIndex`)
- `apps/server/src/server.mjs` — **modified** — add `createParGate`
  as a third task inside `Promise.all` in `startServer()`; read
  `PAR_VERSION` env var with `?? 'v1'` fallback; capture returned
  gate in server-module scope
- `apps/server/src/par/parGate.test.ts` — **new** — exactly **13
  tests** inside one `describe('PAR publication gate (WP-051)', …)`
  block (+1 suite)
- `apps/server/package.json` — **modified** — expand `test` script to
  cover `src/**/*.test.ts` alongside `scripts/**/*.test.ts` (e.g.,
  `node --import tsx --test 'scripts/**/*.test.ts' 'src/**/*.test.ts'`).
  Without this change the new tests are silently skipped.

**Governance docs (always permitted):**
- `docs/ai/STATUS.md` — modified
- `docs/ai/DECISIONS.md` — status entry only (D-5101/D-5102/D-5103
  already added in A0 bundle, not in Commit A)
- `docs/ai/work-packets/WORK_INDEX.md` — flip WP-051 to Completed

## Test Count Lock
- **Exactly 13 tests** in one `describe` block:
  - 3 `loadParIndex` smoke (valid load, missing → null, malformed →
    throws)
  - 3 `checkParPublished` base behavior (sim-only hit, absent → null,
    dual-null → null)
  - 3 `createParGate` integration (bound gate works; no fs IO at
    request time — files can be deleted after construction; version
    isolation)
  - 3 dual-class precedence (sim-only, seed-only, both → sim wins)
  - 1 aliasing guard (two calls return non-identical objects with
    equal fields; mutating result1 must not affect result2 or the
    index)

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` shows 19/3/0
      (+13 tests / +1 suite vs 6/2/0 pre-WP-051 baseline)
- [ ] Repo-wide test count 671/127/0 (658 pre + 13 new)
- [ ] No engine files modified (git diff packages/game-engine/)
- [ ] No game logic in PAR gate files (grep for boardgame.io/
      LegendaryGame/ctx)
- [ ] No `node:fs` imports in `parGate.mjs` (grep)
- [ ] No write operations in PAR gate files (grep for
      writeFile/mkdir/unlink/rename)
- [ ] `docs/ai/STATUS.md` updated — PAR gate check exists at server
      layer; both source-class indices loaded at startup;
      competitive submissions gated with sim-over-seed precedence;
      fail-closed behavior when both indices missing
- [ ] `docs/ai/DECISIONS.md` status entry added (D-5101..D-5103
      already in place from A0 bundle)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date

## Common Failure Smells
- Accepting competitive score because artifact file "exists on
  disk" — must use index only per D-5103
- Computing or inferring PAR on server when index is missing — must
  fail closed
- Falling back to default PAR values — no defaults, no fallbacks
- Player- or hero-dependent gate behavior — gate is scenario-only
- Automatically regenerating index on server startup — server is
  read-only
- Server writing to `data/par/` — layer boundary violation
- Letting a match be ranked "temporarily" without PAR — trust
  violation
- PAR index reloaded or changed during runtime without server
  restart — active PAR version must be stable for a server process
  per D-5102
- Server importing game-engine internals for PAR checks — layer
  boundary violation; only the named public surface is permitted
- Importing `node:fs` or `node:fs/promises` into `parGate.mjs` —
  IO is delegated to engine `loadParIndex` per D-5001 line 8937
- Returning a reference into the index from `checkParPublished`
  (aliasing bug — test #13 enforces fresh-object construction)
- Omitting `source` from the return shape — breaks WP-053 /
  WP-054 downstream leaderboard contracts
- Using `string` instead of `ScenarioKey` for the
  `checkParPublished` parameter — type-widening at the boundary
- Placing the test file at `.test.mjs` — violates `.claude/
  CLAUDE.md` rule; server-runtime files use `.mjs`, test files
  use `.test.ts`
- Forgetting to expand `apps/server/package.json` test glob —
  silent-green: tests exist but never run (pre-flight PS-6)
- Treating one-class-missing as fatal — must degrade gracefully
  per D-5101
- Reimplementing `validateParStore` at startup or at request
  time — hash / coverage validation is CI-time only per D-5103
