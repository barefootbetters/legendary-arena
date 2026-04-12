# Work Packet Invocation — WP-012 (Match Listing, Join & Reconnect)

**FILE TYPE:** Invocation Prompt
**AUDIENCE:** Claude Code (Execution Mode)
**PURPOSE:** Pre-execution contract setup for a single Work Packet
**SCOPE:** This file defines *what may be done* in the upcoming WP execution

---

## Invocation Header

**Work Packet ID:** `WP-012`
**Work Packet Title:** Match Listing, Join & Reconnect (Minimal MVP)
**Execution Mode:** EC-Mode (Execution Checklist enforced)
**Invocation Type:** Single-WP Execution
**Status:** Ready to Execute
**Pre-Flight Date:** 2026-04-11
**Pre-Flight Verdict:** READY TO EXECUTE

---

## Invocation Intent

You are about to execute **WP-012** in the Legendary Arena codebase.

This invocation defines **exact scope**, **authority order**, **allowed changes**,
and **forbidden behavior** for this Work Packet execution.

WP-012 adds the remaining half of the minimal multiplayer loop: two CLI
scripts (`list-matches.mjs` and `join-match.mjs`) that enable players to
list available matches and join an existing match by ID against a running
boardgame.io server. Both scripts use Node v22 built-in `fetch` exclusively.
Unit tests stub `fetch` — no live server required. Full end-to-end
verification (create → list → join → ready → play) is manual, deferred to
the human.

**No game engine changes are made in this packet.** This is server CLI
tooling only.

You must operate strictly within this contract.

---

## Authority Chain (Must Read In Order)

Before executing any step, you must read and follow these documents **in this order**:

1. `.claude/CLAUDE.md`
   - EC-mode rules
   - Bug handling rules
   - Commit discipline

2. `docs/ai/ARCHITECTURE.md`
   - Section 1: Server package boundary — CLI scripts rules
   - Section 5: Prohibition on storing credentials
   - Layer boundaries (server is wiring only)

3. `.claude/rules/server.md`
   - CLI scripts invariants (Node v22 fetch, exit 1 on failure, stderr errors)
   - Server/engine boundary (CLI scripts are clients, not engine)

4. `.claude/rules/code-style.md`
   - Rule 4 (no abbreviations — `matchIdentifier` not `mid`,
     `playerCredentials` not `creds`)
   - Rule 6 (`// why:` on non-obvious boardgame.io API choices)
   - Rule 9 (`node:` prefix on all Node built-in imports)
   - Rule 11 (full-sentence error messages)
   - Rule 13 (ESM only)

5. `docs/ai/execution-checklists/EC-012-match-join.checklist.md`
   - The governing execution checklist for this WP

6. `docs/ai/work-packets/WP-012-match-list-join-reconnect.md`
   - The formal specification for this Work Packet

Then reference (read-only unless explicitly listed in Files Allowed to Change):

7. `apps/server/scripts/create-match.mjs` — the canonical CLI pattern to
   follow: `parseArgs` from `node:util`, built-in `fetch`, full-sentence
   stderr errors, `process.exit(1)` on failure
8. `apps/server/src/server.mjs` — reference only for understanding server
   structure; do NOT modify
9. `apps/server/src/index.mjs` — reference only; do NOT modify
10. `docs/ai/REFERENCE/00.6-code-style.md` — full style rules with examples
11. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` — NOT applicable
    to this WP (no game engine changes); included for awareness only

If any document conflicts, **higher-authority documents win**.

---

## Pre-Flight Findings (2026-04-11)

Pre-flight validation confirmed readiness. Key findings:

### Prerequisites Verified

- WP-011 complete (2026-04-11, commit `bc055fb`) — lobby moves wired,
  `G.lobby` in `LegendaryGameState`, `create-match.mjs` exists, 120 tests pass
- `apps/server/src/server.mjs` exists (WP-004)
- `apps/server/src/index.mjs` exists (WP-004)
- `apps/server/scripts/create-match.mjs` exists (WP-011)
- No existing `list-matches.mjs` or `join-match.mjs` — will be created fresh
- Build: `pnpm --filter @legendary-arena/game-engine build` exits 0
- Tests: 120/120 passing, 0 failing

### Risks Identified and Resolved

1. **`apps/server/package.json` has no `test` script** — WP-012 verification
   expects `pnpm --filter server test` to exit 0. The execution session is
   authorized to add a `test` script to `apps/server/package.json` as
   infrastructure wiring. Use the same pattern as game-engine:
   `"test": "node --import tsx --test scripts/**/*.test.ts"`. This is `INFRA`
   wiring, not game logic.

2. **`tsx` not a devDependency of the server package** — `tsx` is a
   devDependency of `@legendary-arena/game-engine` (`^4.15.7`) but not of
   `@legendary-arena/server`. The execution session is authorized to add
   `tsx` as a devDependency of the server package to enable `.test.ts`
   execution. This is infrastructure wiring only.

3. **Stubbing `fetch` in tests** — Tests must stub `fetch` without requiring
   a live server. Two valid approaches: (a) extract core HTTP logic into
   testable functions that accept a `fetch`-like dependency, or (b) stub
   `globalThis.fetch` using `node:test` mock capabilities. Either approach
   is acceptable. The pattern must be consistent between both test files.
   Do NOT spin up a real server in tests.

4. **Test file location** — Tests live in `apps/server/scripts/` colocated
   with the scripts. The test script glob must be `scripts/**/*.test.ts`.

5. **CLI argument parsing** — Follow `create-match.mjs` pattern exactly:
   `parseArgs` from `node:util`, `--server` flag with default
   `http://localhost:8000`, full-sentence error messages to stderr,
   `process.exit(1)` on failure.

---

## Critical Context (Post-WP-011 Reality)

- WP-011 is complete. The following are present:
  - `apps/server/scripts/create-match.mjs` — CLI match creation using
    built-in `fetch`, `parseArgs` from `node:util`, full-sentence errors
  - `G.lobby` has `requiredPlayers`, `ready`, `started` in
    `LegendaryGameState`
  - `setPlayerReady` and `startMatchIfReady` wired in lobby phase
  - Server runs with `LegendaryGame` registered, health endpoint responding
  - 120 tests passing across the game-engine package
- `apps/server/package.json` has no `test` script and no `tsx` devDependency
  — both will be added as infrastructure wiring in this session
- boardgame.io default endpoints (no custom routes needed):
  - `GET /games/legendary-arena` — lists matches
  - `POST /games/legendary-arena/<matchID>/join` — joins a match seat

---

## Scope Contract (Read Carefully)

### WP-012 DOES:

- Create `apps/server/scripts/list-matches.mjs` — CLI match listing using
  built-in `fetch`
- Create `apps/server/scripts/join-match.mjs` — CLI join and credentials
  using built-in `fetch`
- Create `apps/server/scripts/list-matches.test.ts` — 3 tests (node:test,
  stubbed fetch)
- Create `apps/server/scripts/join-match.test.ts` — 3 tests (node:test,
  stubbed fetch)
- Modify `apps/server/package.json` — add `test` script and `tsx`
  devDependency (infrastructure wiring)

### WP-012 DOES NOT:

- No game engine files (`packages/game-engine/**`) may be modified
- No `apps/server/src/` files modified unless bug-justified in DECISIONS.md
- No custom REST API routes or WebSocket logic
- No matchmaking, ranking, or player search
- No credential persistence to disk
- No spectating
- No authentication beyond boardgame.io built-in credentials
- No UI changes
- No `require()` — ESM only
- No axios, no node-fetch — built-in `fetch` only
- No boardgame.io imports in scripts (they are HTTP clients)
- No modifications to `create-match.mjs`
- No `.reduce()` or nested ternaries
- No `Math.random()`
- No speculative helpers, convenience abstractions, or "while I'm here"
  improvements

If something feels questionable, it almost certainly belongs in a **later WP**.

---

## Files Allowed to Change (Allowlist)

Only the following files **may be created or modified** during this execution:

    apps/server/scripts/list-matches.mjs                -- new
    apps/server/scripts/join-match.mjs                   -- new
    apps/server/scripts/list-matches.test.ts             -- new
    apps/server/scripts/join-match.test.ts               -- new
    apps/server/package.json                             -- modified (infra)

### Runtime Wiring Allowance (01.5)

**Not applicable to WP-012.** This packet introduces no new fields on
`LegendaryGameState`, no new moves, and no game engine changes. The 01.5
runtime wiring allowance is not exercised.

---

## Files Explicitly Locked (Read-Only)

The following files **must not be changed**:

    packages/game-engine/**                               -- entire package
    apps/server/src/server.mjs                            -- WP-004
    apps/server/src/index.mjs                             -- WP-004
    apps/server/src/rules/loader.mjs                      -- WP-004
    apps/server/scripts/create-match.mjs                  -- WP-011

These are dependencies, not execution targets.

---

## Locked Values (Do Not Re-Derive)

### boardgame.io default endpoint paths (exact)

```
List matches: GET /games/legendary-arena
Join match:   POST /games/legendary-arena/<matchID>/join
Body for join: { playerName: string }
```

### boardgame.io join response shape (exact)

```json
{ "playerID": "string", "credentials": "string" }
```

Include `matchID` in output if present in response.

### CLI output format — list-matches.mjs

Prints JSON array to stdout. Each match shows: `matchID`, `players` (slot
count), `setupData` presence, `gameover` status.

### CLI output format — join-match.mjs

Prints `{ matchID, playerID, credentials }` JSON to stdout on success.

### Default server URL

`http://localhost:8000` — overridable with `--server <url>` flag on both
scripts.

### CLI argument parsing pattern

Use `parseArgs` from `node:util` — match `create-match.mjs` pattern exactly.

---

## Pre-Flight Risk Resolutions (Locked for Execution)

These decisions were made during pre-flight and must not be revisited.

### Risk 1: Server package has no test script

Add `"test": "node --import tsx --test scripts/**/*.test.ts"` to
`apps/server/package.json`. This is infrastructure wiring — no game logic.

### Risk 2: tsx not a server devDependency

Add `"tsx": "^4.15.7"` to `apps/server/package.json` `devDependencies`.
This matches the version used by `@legendary-arena/game-engine`. Run
`pnpm install` after adding.

### Risk 3: Fetch stubbing in tests

Tests must stub `fetch` without a live server. The recommended approach is
to extract the core HTTP logic into testable async functions, then test with
injected or stubbed `fetch`. The exact mechanism (dependency injection vs
`globalThis.fetch` stub) is an implementation choice — both are valid.
The pattern must be consistent between both test files.

### Risk 4: Test file location

Tests live in `apps/server/scripts/` colocated with the scripts, as
specified in WP-012.

### Risk 5: CLI argument parsing

Use `parseArgs` from `node:util` per the `create-match.mjs` precedent.
Both new scripts accept `--server <url>` with default `http://localhost:8000`.

---

## Test Expectations (Locked)

### list-matches tests — `scripts/list-matches.test.ts` (3 tests)

1. `--server` flag overrides default URL
2. Network failure produces a full-sentence stderr message
3. Exits 1 on a mocked `fetch` rejection

### join-match tests — `scripts/join-match.test.ts` (3 tests)

1. Missing `--match` flag exits 1 with a clear error message
2. Missing `--name` flag exits 1 with a clear error message
3. HTTP 409 response produces a full-sentence stderr message and exits 1

**Prior test baseline:** 120 tests pass in game-engine — all must continue
to pass (though game-engine tests are not re-run as part of this WP unless
game-engine files are touched, which they must not be).

**Test boundaries:** no boardgame.io imports in test files; stubbed fetch
(not live server); `node:test` + `node:assert` only; `.test.ts` extension;
no modifications to game-engine test helpers or files.

---

## Behavioral Constraints (Hard Rules)

- One Work Packet only — `WP-012`
- No scope expansion
- No cross-WP implementation
- No convenience abstractions
- Both scripts use Node v22 built-in `fetch` — no axios, no node-fetch
- Both scripts exit 1 on failure with a full-sentence error to stderr
- Credentials printed to stdout — never stored to disk or logged to a file
- No game engine files may be modified
- No `apps/server/src/` files may be modified (unless bug-justified)
- No custom REST or WebSocket routes — use boardgame.io defaults only
- Follow `create-match.mjs` pattern for argument parsing and error handling
- No `require()` — ESM only
- `node:` prefix on all Node built-in imports
- Test files use `.test.ts` extension
- Tests use `node:test` and `node:assert` only
- Tests stub `fetch` — no live server required

---

## EC-Mode Execution Rules

- All code changes must map to **EC-012**
- No commit may be created without passing EC hooks
- Bugs are treated as **EC violations**, not ad-hoc fixes
- If an EC step cannot be satisfied:
  - Stop
  - Report the failure
  - Do not improvise

---

## Execution Outcome Requirements

By the end of WP-012 execution:

- All EC-012 checklist items must pass
- `pnpm --filter server test` exits 0 (new test infrastructure + 6 tests)
- `list-matches.mjs` exists, uses built-in `fetch`, accepts `--server` flag,
  prints JSON to stdout, exits 1 on failure
- `join-match.mjs` exists, uses built-in `fetch`, accepts `--match` and
  `--name` flags, prints credentials JSON to stdout, exits 1 on failure
- Neither script imports axios or node-fetch
- Neither script writes credentials to disk
- No `require()` in any generated file
- No game engine files were modified
- No `apps/server/src/` files were modified
- `apps/server/package.json` has a working `test` script with `tsx`
  devDependency
- Architecture boundaries remain intact
- `create-match.mjs` is untouched

---

## Verification Steps

```bash
# Step 1 — confirm scripts use no external HTTP packages
grep "axios\|node-fetch" apps/server/scripts/list-matches.mjs apps/server/scripts/join-match.mjs
# Expected: no output

# Step 2 — run unit tests
pnpm --filter server test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no require() in any generated file
grep -r "require(" apps/server/scripts/
# Expected: no output

# Step 4 — confirm no game engine files were modified
git diff --name-only packages/game-engine/
# Expected: no output

# Step 5 — confirm no server src files were modified
git diff --name-only apps/server/src/
# Expected: no output

# Step 6 — confirm create-match.mjs was not modified
git diff --name-only apps/server/scripts/create-match.mjs
# Expected: no output

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in allowlist

# Step 8 — (MANUAL) smoke test against a running server
# Deferred to human — not run in automated execution
# node --env-file=.env apps/server/src/index.mjs
# node apps/server/scripts/list-matches.mjs
# node apps/server/scripts/create-match.mjs --players 2 --setup ./tmp/match-setup.json
# node apps/server/scripts/join-match.mjs --match <matchID> --name Alice
# node apps/server/scripts/join-match.mjs --match <matchID> --name Bob
# node apps/server/scripts/join-match.mjs --match <matchID> --name Charlie  # should fail

# Step 9 — confirm no boardgame.io imports in scripts or tests
grep "boardgame.io" apps/server/scripts/*.mjs apps/server/scripts/*.test.ts
# Expected: no output
```

---

## Post-Execution Obligations (Do Not Skip)

After successful execution, but **before committing**:

- Run the **PRE-COMMIT-REVIEW template** (`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`)
- Update:
  - `docs/ai/STATUS.md` — the minimum viable multiplayer loop is now
    complete (create → list → join → ready → play)
  - `docs/ai/DECISIONS.md` — at minimum: why listing and joining use
    boardgame.io's built-in endpoints rather than custom REST routes; why
    unit tests stub `fetch` rather than spinning up a test server; why
    credentials are printed to stdout (not stored to disk) for security
  - `docs/ai/work-packets/WORK_INDEX.md` — mark WP-012 complete with date
- Commit using EC-mode hygiene rules (`EC-012:` prefix)

Execution is not considered complete until these steps are done.

---

## Final Instruction to Claude

This invocation is a **contract**, not a suggestion.

If there is any uncertainty about whether a change belongs in WP-012:

**DO NOT IMPLEMENT IT.**
