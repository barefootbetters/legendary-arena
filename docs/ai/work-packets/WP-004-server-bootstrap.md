# WP-004 — Server Bootstrap (Game Engine + Registry Integration)

**Status:** Ready
**Primary Layer:** Server
**Dependencies:** WP-002, WP-003

---

## Session Context

WP-002 created `@legendary-arena/game-engine` and exported `LegendaryGame`.
WP-003 verified and fixed `@legendary-arena/registry`. Foundation Prompt 01
created a minimal `apps/server/` with a placeholder game definition,
`loadRules()`, and a health endpoint. This packet replaces the placeholder with
the real packages — the server becomes a working boardgame.io runtime that can
accept match creation requests. No game logic enters the server layer; it wires
packages together and nothing more.

---

## Goal

Fully bootstrap `apps/server/` so that:
- `LegendaryGame` is imported from `@legendary-arena/game-engine` (not from a
  local placeholder)
- The card registry is loaded at startup via `createRegistryFromLocalFiles`
- The process has a clean entrypoint (`src/index.mjs`) with SIGTERM graceful
  shutdown
- `GET /health` returns HTTP 200
- `POST /games/legendary-arena/create` returns a `matchID`
- Server startup logs show both rules count and registry summary

After this session the server is fully runnable end-to-end and ready for the
CLI scripts added in WP-011 and WP-012.

---

## Assumes

- WP-002 complete: `@legendary-arena/game-engine` builds and exports `LegendaryGame`
- WP-003 complete: `@legendary-arena/registry` builds, smoke test passes, and
  exports `createRegistryFromLocalFiles`
- Foundation Prompt 01 complete — these files exist:
  - `apps/server/package.json`
  - `apps/server/src/server.mjs` (placeholder server with health endpoint and
    `loadRules()`)
  - `apps/server/src/rules/loader.mjs` (exports `loadRules` and `getRules`)
  - `apps/server/src/game/legendary.mjs` (placeholder minimal game — this
    packet replaces its contents)
  - `render.yaml` (startCommand currently points to `server.mjs`)
- Foundation Prompt 02 complete: `data/migrations/` exists and `pnpm migrate`
  succeeds
- `data/metadata/` and `data/cards/` exist with real card data
- `pnpm install` has been run
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 1` — the `apps/server` package boundary.
  The server is a wiring layer: "Must NOT: contain game logic, implement rules,
  or define moves." Read the full entry including the `game/legendary.mjs`
  backwards-compat note and the `legendary.*` database namespace.
- `docs/ai/ARCHITECTURE.md §Section 2` — "Server Startup Sequence". Documents
  the two parallel startup tasks (registry load + rules load) that must both
  complete before `Server()` accepts requests, and the expected log messages
  for each.
- `apps/server/src/server.mjs` — read it entirely before modifying. Understand
  what `loadRules()` is already doing, what CORS origins are configured, and
  where `Server()` is initialised. The health endpoint, CORS origins, and PORT
  handling must all be preserved.
- `apps/server/src/rules/loader.mjs` — read it to understand what `loadRules`
  and `getRules` do. This file must NOT be modified — rules loading is already
  correct.
- `packages/game-engine/src/index.ts` — confirm the exact export name before
  writing any import statement.
- `packages/registry/src/index.ts` — confirm the exact factory function name
  (`createRegistryFromLocalFiles`) before writing any import statement.
- `docs/ai/REFERENCE/00.2-data-requirements.md §4.2` — what belongs in-memory
  at the server layer vs. what must stay out of it. The registry is loaded into
  memory at startup, not stored in PostgreSQL.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.2` — match runtime state:
  `G` and `ctx` live in boardgame.io memory, never in the server layer.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable
  constraints: CORS origins, PORT handling, no WebSocket logic outside
  boardgame.io.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` comments on the registry loader choice),
  Rule 9 (`node:` prefix for built-ins), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Applicable engine-wide constraints:**
- ESM only, Node v22+ — all files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:process`, etc.)
- No `import * as` in any modified file
- Full file contents for every new or modified file in the output — no diffs,
  no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- The server is a wiring layer — it must never contain game logic, implement
  rules, or define a boardgame.io `Game()` object directly
- `LegendaryGame` must be imported from `@legendary-arena/game-engine` — not
  from a local file
- Registry must be loaded using `createRegistryFromLocalFiles` from
  `@legendary-arena/registry` — NOT the HTTP/R2 loader (`createRegistryFromHttp`)
- `apps/server/src/rules/loader.mjs` must NOT be modified — rules loading is
  already correct
- `packages/game-engine/` and `packages/registry/` must NOT be modified
- No custom WebSocket, Express, or HTTP routing beyond boardgame.io `Server()`
  defaults
- No database access beyond `loadRules()` (already in `server.mjs` from
  Foundation Prompt 01)
- Every `// why:` comment must explain a non-obvious decision (e.g., why
  `createRegistryFromLocalFiles` is used instead of the HTTP loader)

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, type shapes, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **legendary.\* namespace** (server's `loadRules()` queries PostgreSQL using
  this namespace — do not use bare table names):
  All PostgreSQL tables live in the `legendary.*` schema (e.g.,
  `legendary.rules`, `legendary.sets`). PKs use `bigserial`. Cross-service
  identifiers use `ext_id text`. The rules table is `legendary.rules`.

---

## Scope (In)

### A) Modify `apps/server/src/server.mjs`
- Replace the placeholder local import of `./game/legendary.mjs` with a direct
  import of `LegendaryGame` from `@legendary-arena/game-engine`
- Import `createRegistryFromLocalFiles` from `@legendary-arena/registry`
- Load the registry at startup:
  `createRegistryFromLocalFiles({ metadataDir: 'data/metadata', cardsDir: 'data/cards' })`
- Register `LegendaryGame` with `Server()` as the authoritative game
- Log registry load summary (`registry.info()` or equivalent) at startup
  alongside the existing rules load log — format: `[server] registry loaded:
  X sets, Y heroes, Z cards`
- Preserve the existing health endpoint, CORS origins, and PORT handling exactly
- Add a `// why:` comment on the `createRegistryFromLocalFiles` call explaining
  why local files are used at startup rather than the HTTP/R2 loader

### B) Modify `apps/server/src/game/legendary.mjs`
- Replace the placeholder `Game()` definition with a single thin re-export:
  `export { LegendaryGame } from '@legendary-arena/game-engine';`
- Add a `// why:` comment explaining this file is kept for backwards
  compatibility only — the source of truth is the package

### C) Modify `apps/server/package.json`
- Add `"@legendary-arena/game-engine": "workspace:*"` to `dependencies`
- Add `"@legendary-arena/registry": "workspace:*"` to `dependencies`

### D) Create `apps/server/src/index.mjs` — new process entrypoint
- Import and start the configured server
- Handle process lifecycle: SIGTERM graceful shutdown
- Add a `// why:` comment explaining why `index.mjs` is the entrypoint and
  `server.mjs` is the configuration module

### E) Modify `render.yaml`
- Update `startCommand` from `node apps/server/src/server.mjs` to
  `node apps/server/src/index.mjs`

---

## Out of Scope

- No gameplay logic — the server wires things together, it does not implement
  rules
- No authentication or authorization
- No custom WebSocket, Express, or HTTP routing beyond boardgame.io defaults
- No matchmaking or lobby UI
- No changes to `apps/server/src/rules/loader.mjs` — rules loading is already
  correct
- No changes to `packages/game-engine/` or `packages/registry/`
- No changes to `data/` or migration files
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `apps/server/src/server.mjs` — **modified** — import real game engine +
  registry; log registry summary
- `apps/server/src/game/legendary.mjs` — **modified** — replace with thin
  re-export; add `// why:` comment
- `apps/server/package.json` — **modified** — add game-engine + registry
  workspace deps
- `apps/server/src/index.mjs` — **new** — process entrypoint with SIGTERM
  shutdown
- `render.yaml` — **modified** — update `startCommand` to `index.mjs`

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Dependencies and Imports
- [ ] `apps/server/package.json` lists `@legendary-arena/game-engine` and
      `@legendary-arena/registry` in `dependencies`
- [ ] `apps/server/src/server.mjs` contains no local import of
      `./game/legendary.mjs` — confirmed with `Select-String`
- [ ] `LegendaryGame` import in `server.mjs` comes from
      `@legendary-arena/game-engine` — confirmed with `Select-String`

### game/legendary.mjs
- [ ] `apps/server/src/game/legendary.mjs` contains no `Game(` definition
      (confirmed with `Select-String`)
- [ ] It contains a re-export of `LegendaryGame` from
      `@legendary-arena/game-engine`
- [ ] It has a `// why:` comment explaining backwards-compatibility purpose

### Runtime Verification
- [ ] `GET http://localhost:8000/health` returns HTTP 200 and `{"status":"ok"}`
- [ ] `POST http://localhost:8000/games/legendary-arena/create` with body
      `{"numPlayers": 2}` returns HTTP 200 with a JSON body containing `matchID`
- [ ] Server startup logs show registry load summary (set count, hero count)
      alongside the existing rules load message

### render.yaml
- [ ] `render.yaml` `startCommand` is `node apps/server/src/index.mjs`

### Scope Enforcement
- [ ] No `require()` in any modified file (confirmed with `Select-String`)
- [ ] No `import * as` in any modified file (confirmed with `Select-String`)
- [ ] `apps/server/src/rules/loader.mjs` was not modified
      (confirmed with `git diff --name-only`)
- [ ] No files in `packages/` were modified
      (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — install updated dependencies (picks up workspace links)
pnpm install
# Expected: packages resolved, @legendary-arena/game-engine and
#           @legendary-arena/registry linked, no errors

# Step 2 — start the server
node --env-file=.env apps/server/src/index.mjs
# Expected output includes (in any order):
#   [server] rules loaded: N rules
#   [server] registry loaded: X sets, Y heroes, Z cards
#   [server] listening on port 8000

# --- run Steps 3-4 in a second terminal while server is running ---

# Step 3 — health check
curl http://localhost:8000/health
# Expected: {"status":"ok"}

# Step 4 — match creation (boardgame.io default API)
curl -X POST http://localhost:8000/games/legendary-arena/create `
  -H "Content-Type: application/json" `
  -d '{"numPlayers": 2}'
# Expected: {"matchID": "<alphanumeric ID>"}

# Step 5 — confirm game/legendary.mjs has no Game() definition
Select-String -Path "apps\server\src\game\legendary.mjs" -Pattern "Game("
# Expected: no output

# Step 6 — confirm LegendaryGame is imported from the package, not locally
Select-String -Path "apps\server\src\server.mjs" -Pattern "game-engine"
# Expected: at least one match on the import line

# Step 7 — confirm no require() in any modified file
Select-String -Path "apps\server\src" -Pattern "require(" -Recurse
# Expected: no output

# Step 8 — confirm rules/loader.mjs and packages/ were not modified
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
- [ ] `GET /health` returns HTTP 200
- [ ] `POST /games/legendary-arena/create` returns a `matchID`
- [ ] Server startup logs show both rules count and registry summary
- [ ] `apps/server/src/game/legendary.mjs` contains no `Game(` definition
      (confirmed with `Select-String`)
- [ ] `render.yaml` `startCommand` is `node apps/server/src/index.mjs`
- [ ] No `require()` in any modified file (confirmed with `Select-String`)
- [ ] `apps/server/src/rules/loader.mjs` was not modified
      (confirmed with `git diff --name-only`)
- [ ] No files in `packages/` were modified
      (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what is now runnable end-to-end
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why `createRegistryFromLocalFiles`
      is used at server startup rather than the HTTP/R2 loader
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-004 checked off with today's date
