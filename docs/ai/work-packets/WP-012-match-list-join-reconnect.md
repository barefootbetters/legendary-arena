# WP-012 — Match Listing, Join & Reconnect (Minimal MVP)

**Status:** Ready
**Primary Layer:** Server / Match Access
**Dependencies:** WP-011

---

## Session Context

WP-011 established `G.lobby`, the lobby moves, and the `create-match.mjs` CLI
script — completing the match creation flow. This packet adds the remaining half
of the minimal multiplayer loop: `list-matches.mjs` and `join-match.mjs` CLI
scripts. No game engine changes are made here — this packet is server CLI
tooling only. Unit tests stub `fetch` rather than spinning up a test server;
the full end-to-end flow (create → list → join → ready → play) is verified
manually in Verification Steps.

---

## Goal

Enable players to list available matches, join an existing match by ID, and
reconnect to a match in progress using stored credentials — using only
boardgame.io's built-in lobby mechanisms, without persisting live game state
or adding custom networking logic.

After this session:
- Two CLI scripts (`list-matches.mjs`, `join-match.mjs`) are runnable against
  the live server
- Both scripts use Node built-in `fetch`, print structured JSON output, and
  exit non-zero on failure with a full-sentence error message
- The listing, joining, and reconnect flows are manually verified end-to-end
- CLI script argument parsing and error handling are covered by `node:test`

This completes the minimum viable multiplayer loop:
**create → list → join → ready → play → reconnect**

---

## Assumes

- WP-011 complete. Specifically:
  - `apps/server/src/server.mjs` is running with `LegendaryGame` registered and
    the health endpoint responding (WP-004)
  - `apps/server/scripts/create-match.mjs` exists (WP-011)
  - `packages/game-engine/src/lobby/lobby.moves.ts` exports `setPlayerReady`
    and `startMatchIfReady` wired into the `lobby` phase (WP-011)
  - `G.lobby` has `requiredPlayers`, `ready`, `started` in `LegendaryGameState`
    (WP-011)
  - `apps/server/src/index.mjs` starts the server on `PORT` from `.env` (WP-004)
- The boardgame.io server exposes these endpoints by default (no custom routes
  needed for this packet):
  - `GET /games/legendary-arena` — lists matches
  - `POST /games/legendary-arena/<matchID>/join` — joins a match seat
- `docs/ai/DECISIONS.md` exists (created in WP-002)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013; if this packet runs
  before WP-013, use `00.1` and `00.2` as the architectural references instead)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 1` — read the `apps/server/scripts/`
  entry under the server package boundary. The CLI scripts rule is documented
  there: Node v22 built-in `fetch` only, no axios; exit 1 on failure with a
  full-sentence message to stderr; ESM modules; no credentials stored to disk.
  Also read `§Section 5` for the prohibition on storing credentials.
  (If ARCHITECTURE.md does not yet exist, `00.1` and `00.2` cover the same
  constraints.)
- `apps/server/scripts/create-match.mjs` — read it entirely. The two new
  scripts follow the same pattern: Node built-in `fetch`, CLI argument parsing
  with `process.argv`, exits non-zero on failure. Maintain consistency in style.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable:
  no custom WebSocket or REST logic outside `boardgame.io Server()`; do not
  persist live `G`/`ctx`; this packet adds no game logic.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.2` — runtime state
  boundaries. Joining and reconnecting must not touch `G` directly — they go
  through boardgame.io's built-in credential and seat mechanisms.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no abbreviations
  — `matchIdentifier` not `mid`, `playerCredentials` not `creds`), Rule 6
  (`// why:` on any non-obvious boardgame.io API choices), Rule 9 (`node:`
  prefix for built-ins), Rule 11 (full-sentence error messages), Rule 13
  (ESM only).

**Note on testing scope:** Listing, joining, and reconnecting are HTTP operations
against a running boardgame.io server. There is no pure-function equivalent —
they cannot be tested with `makeMockCtx` alone. The `node:test` coverage tests
CLI script logic (argument parsing, error output format, exit codes) using
mocked `fetch` responses. Full end-to-end flow is verified manually in
Verification Steps 3–6. This is documented honestly in the Definition of Done
rather than overstating test coverage.

---

## Non-Negotiable Constraints

**Applicable engine-wide constraints:**
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`,
  `node:process`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside boardgame.io moves or hooks (not
  applicable to this packet — no game logic — but retained for completeness)
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Both CLI scripts use Node v22 built-in `fetch` exclusively — no axios, no
  node-fetch
- Both scripts exit 1 on failure with a full-sentence message to stderr
- Unit tests stub `fetch` — no live server required for tests
- No game engine files (`packages/game-engine/`) may be modified in this packet
- `apps/server/src/` files may not be modified unless a bug is discovered; if
  so, document and justify in `DECISIONS.md` before proceeding
- Credentials printed to stdout — never stored to disk or logged to a file

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **boardgame.io default endpoint paths** (these are the exact paths the
  server exposes — do not invent alternate paths; a wrong path produces a 404
  that only appears during manual verification):
  List matches: `GET /games/legendary-arena`
  Join match:   `POST /games/legendary-arena/<matchID>/join`
  Body for join: `{ playerName: string }`

- **boardgame.io join response shape** (what the server returns on a successful
  join — print this exact shape to stdout):
  `{ playerID: string, credentials: string }`
  (Some boardgame.io versions also return `matchID` — include it if present)

---

## Scope (In)

### A) `apps/server/scripts/list-matches.mjs` — new CLI script
- Fetches `GET http://<serverUrl>/games/legendary-arena` using Node built-in
  `fetch` — no axios, no node-fetch
- Prints JSON array of available matches to stdout
- Each match shows: `matchID`, `players` (slot count), `setupData` presence,
  `gameover` status
- Accepts `--server <url>` flag; defaults to `http://localhost:8000`
- Exits 1 on network failure with a full-sentence error to stderr

### B) `apps/server/scripts/join-match.mjs` — new CLI script
- Accepts `--match <matchID>` and `--name <playerName>` flags
- POSTs to `http://<serverUrl>/games/legendary-arena/<matchID>/join` with
  `{ playerName }` body
- Prints `{ matchID, playerID, credentials }` to stdout — the caller stores
  these for reconnect
- Exits 1 if match is full, match has started, or network failure — with a
  full-sentence error to stderr
- Accepts `--server <url>` flag; defaults to `http://localhost:8000`
- Credentials are printed to stdout only — never written to disk

### C) `apps/server/scripts/list-matches.test.ts` — new
- Uses `node:test` and `node:assert` only; stubs `fetch`; does not require a
  running server
- Tests:
  1. `--server` flag overrides default URL
  2. Network failure produces a full-sentence stderr message
  3. Exits 1 on a mocked `fetch` rejection

### D) `apps/server/scripts/join-match.test.ts` — new
- Uses `node:test` and `node:assert` only; stubs `fetch`; does not require a
  running server
- Tests:
  1. Missing `--match` flag exits 1 with a clear error message
  2. Missing `--name` flag exits 1 with a clear error message
  3. HTTP 409 response produces a full-sentence stderr message and exits 1

---

## Out of Scope

- No matchmaking, auto-assignment, or ranking
- No persistence of credentials to disk or database
- No custom REST or WebSocket routes
- No spectating — a separate Work Packet
- No authentication beyond boardgame.io's built-in credentials
- No game logic changes — this packet adds only CLI tooling
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `apps/server/scripts/list-matches.mjs` — **new** — CLI match listing script
- `apps/server/scripts/join-match.mjs` — **new** — CLI join and credentials
  script
- `apps/server/scripts/list-matches.test.ts` — **new** — `node:test` CLI unit
  tests
- `apps/server/scripts/join-match.test.ts` — **new** — `node:test` CLI unit
  tests

No game engine files may be modified. No `apps/server/src/` files may be
modified unless a bug is discovered — if so, document and justify in
`DECISIONS.md` before proceeding.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### `list-matches.mjs`
- [ ] Script exists and is valid ESM
- [ ] Fetches `GET /games/legendary-arena` using built-in `fetch` — no axios
      (confirmed with `Select-String` for `axios|node-fetch`)
- [ ] Prints JSON array to stdout on success
- [ ] Exits 1 on network failure with a message to stderr
- [ ] Accepts `--server <url>` flag; defaults to `http://localhost:8000`

### `join-match.mjs`
- [ ] Script exists and is valid ESM
- [ ] Accepts `--match` and `--name` flags; exits 1 with a clear message if
      either is missing
- [ ] POSTs to `/games/legendary-arena/<matchID>/join` using built-in `fetch`
- [ ] Prints `{ matchID, playerID, credentials }` JSON to stdout on success
- [ ] Exits 1 on HTTP 409 (match full or started) with a full-sentence message
- [ ] Does not write credentials to disk

### Unit Tests
- [ ] `pnpm --filter server test` exits 0 (confirm test runner setup with
      `apps/server/package.json` before writing tests)
- [ ] `list-matches.test.ts` passes: `--server` flag, network failure exit code
- [ ] `join-match.test.ts` passes: missing flag exit codes, HTTP error exit code
- [ ] Neither test file imports `boardgame.io` or requires a running server
- [ ] Both test files use `node:test` and `node:assert` only

### Scope Enforcement
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No game engine files were modified (confirmed with `git diff --name-only`)
- [ ] No `apps/server/src/` files were modified unless bug-justified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — confirm scripts use no external HTTP packages
Select-String -Path "apps\server\scripts\list-matches.mjs","apps\server\scripts\join-match.mjs" -Pattern "axios|node-fetch"
# Expected: no output

# Step 2 — run unit tests
pnpm --filter server test
# Expected: TAP output — all tests passing, 0 failing

# Steps 3–6 require the server to be running (manual verification)

# Step 3 — start the server
node --env-file=.env apps/server/src/index.mjs
# Expected: server logs on port 8000

# Step 4 — list matches (initially empty)
node apps/server/scripts/list-matches.mjs
# Expected: [] or array of existing matches

# Step 5 — create then join a match (two-player flow)
node apps/server/scripts/create-match.mjs --players 2 --setup ./tmp/match-setup.json
# Expected: prints { matchID: "<id>" }

node apps/server/scripts/join-match.mjs --match <matchID> --name Alice
# Expected: prints { matchID, playerID: "0", credentials: "<token>" }

node apps/server/scripts/join-match.mjs --match <matchID> --name Bob
# Expected: prints { matchID, playerID: "1", credentials: "<token>" }

# Step 6 — confirm join fails when match is full
node apps/server/scripts/join-match.mjs --match <matchID> --name Charlie
# Expected: exits 1, prints "Match <matchID> is full." to stderr

# Step 7 — confirm no require() in any generated file
Select-String -Path "apps\server\scripts" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — confirm no files outside scope were changed
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
- [ ] Unit tests pass (`pnpm --filter server test` exits 0)
- [ ] Steps 3–6 of Verification Steps verified manually against a running
      server
- [ ] Both scripts use no external HTTP packages
      (confirmed with `Select-String`)
- [ ] No `require()` in any generated file (confirmed with `Select-String`)
- [ ] No game engine or server source files outside `## Files Expected to Change`
      were modified (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — the minimum viable multiplayer loop is
      now complete (create → list → join → ready → play → reconnect)
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why listing and joining
      use boardgame.io's built-in endpoints rather than custom REST routes;
      why unit tests stub `fetch` rather than spinning up a test server;
      why credentials are printed to stdout (not stored to disk) for security
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-012 checked off with today's date
