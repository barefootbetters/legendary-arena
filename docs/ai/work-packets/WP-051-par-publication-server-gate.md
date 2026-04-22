# WP-051 — PAR Publication & Server Gate Contract

**Status:** Draft
**Primary Layer:** Server / Enforcement (Read-Only)
**Dependencies:** WP-050, WP-004

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

- WP-050 complete. Specifically:
  - `ParIndex` type is exported from `@legendary-arena/game-engine`
  - `lookupParFromIndex` is exported and returns `{ path, parValue, artifactHash } | null`
  - `data/par/v1/index.json` structure is defined (may not exist yet —
    the server must handle the missing-index case gracefully)
- WP-004 complete. Specifically:
  - Server startup sequence exists (`apps/server/src/index.mjs`)
  - Registry loading and rules loading are established startup tasks
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

- **Startup task (PAR index loading):**
  - Reads `data/par/{activeVersion}/index.json`
  - Active version is configured (e.g., environment variable or config file).
    The active PAR version is configuration-driven and treated as read-only
    by the server. Changing the active PAR version is an operational decision,
    not a runtime or per-request decision.
  - On success: log `[server] PAR index loaded: N scenarios (vX)`
  - On failure: log warning, set PAR index to `null` (fail closed — all
    competitive checks return false)
  - PAR index is **optional** for server startup — the server may start
    without it (casual play is unaffected), but competitive features are
    disabled

- **Gate check function:**
  ```
  checkParPublished(scenarioKey: string): { parValue: number; parVersion: string } | null
  ```
  - Returns PAR data if published, `null` if not
  - Lookup via index only — never probes filesystem
  - Pure read-only, no side effects
  - The server must not interpret, transform, or reason about `parValue`;
    it is returned only for recording and display purposes
  - Gate evaluation is strictly binary: published or not published.
    Probabilistic, heuristic, or partial acceptance is forbidden.

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

- `loadParIndex(basePath, parVersion)` — reads and parses `index.json`
  - Returns `ParIndex` object or `null` on failure
  - Logs success with scenario count, or warning on failure
  - Read-only — never writes or modifies files
  - `// why:` comment: PAR index is optional for startup; missing index
    disables competitive features but does not prevent casual play

- `checkParPublished(parIndex, scenarioKey)` — checks PAR existence via index
  - Returns `{ parValue, parVersion }` or `null`
  - Lookup is index-only — never probes artifact files
  - `// why:` comment: index is the canonical oracle; filesystem probing
    is forbidden to prevent race conditions and integrity bypass

- `createParGate(basePath, parVersion)` — factory that loads index once and
  returns a bound `checkParPublished` function
  - Used at startup to create the gate instance
  - `// why:` comment: load once at startup, check many times per request —
    same pattern as registry loading

### B) `apps/server/src/index.mjs` — modified

- Add PAR index loading as a third startup task (after registry + rules)
- PAR index loading is **non-blocking** — server starts even if PAR is missing
  (casual play continues; competitive gate returns `null` for all scenarios)
- Log the PAR loading result
- Pass the PAR gate to the server wiring

### C) Tests — `apps/server/src/par/parGate.test.mjs` — new

- Uses `node:test` and `node:assert` only
- Eight tests:
  1. `loadParIndex` returns parsed index for valid `index.json`
  2. `loadParIndex` returns `null` for missing file
  3. `loadParIndex` returns `null` for invalid JSON
  4. `checkParPublished` returns PAR data for published scenario
  5. `checkParPublished` returns `null` for unpublished scenario
  6. `checkParPublished` returns `null` when index is `null` (fail closed)
  7. `createParGate` returns a working gate function
  8. Gate check does not access filesystem (only uses in-memory index)
  9. Gate check does not return PAR for a scenario published only in a
     different PAR version than the active version (version isolation)

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

- `apps/server/src/par/parGate.mjs` — **new** — loadParIndex,
  checkParPublished, createParGate
- `apps/server/src/index.mjs` — **modified** — add PAR index loading to
  startup sequence
- `apps/server/src/par/parGate.test.mjs` — **new** — 9 tests

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### PAR Index Loading
- [ ] `loadParIndex` reads and parses `index.json` successfully
- [ ] Returns `null` on missing or invalid index (fail closed)
- [ ] Logs scenario count on success, warning on failure
- [ ] Read-only — never writes or modifies files

### Gate Check
- [ ] `checkParPublished` returns PAR data for published scenarios
- [ ] Returns `null` for unpublished scenarios
- [ ] Returns `null` when index is `null` (fail closed)
- [ ] Uses index only — never probes artifact files or filesystem
- [ ] Pure read-only, no side effects

### Startup Integration
- [ ] PAR index loaded at startup alongside registry and rules
- [ ] Server starts even if PAR index is missing (non-blocking)
- [ ] Competitive features disabled when PAR is unavailable

### Layer Boundaries
- [ ] No engine files modified (confirmed with `git diff`)
- [ ] No WP-050 contract files modified (confirmed with `git diff`)
- [ ] No game logic in server PAR files
- [ ] Server does not generate, modify, or repair PAR data

### Tests
- [ ] All 8 PAR gate tests pass
- [ ] Tests use `node:test` and `node:assert` only
- [ ] Test files use `.test.mjs` extension (server convention)

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — run server tests
pnpm --filter legendary-arena-server test
# Expected: all tests passing, 0 failing

# Step 3 — confirm no engine modifications
git diff --name-only packages/game-engine/
# Expected: no output

# Step 4 — confirm no WP-050 artifact storage modifications
git diff --name-only packages/game-engine/src/simulation/par.storage.ts
# Expected: no output

# Step 5 — confirm no game logic in PAR gate
Select-String -Path "apps\server\src\par\parGate.mjs" -Pattern "boardgame.io|LegendaryGame|ctx\."
# Expected: no output

# Step 6 — confirm read-only (no fs.writeFile or fs.mkdir in gate)
Select-String -Path "apps\server\src\par\parGate.mjs" -Pattern "writeFile|mkdir|unlink|rename"
# Expected: no output

# Step 7 — no files outside scope
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
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
