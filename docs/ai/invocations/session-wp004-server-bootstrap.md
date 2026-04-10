# Session Prompt — Execute WP-004 (Server Bootstrap: Game Engine + Registry Integration)

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

---

## What You Are Doing

Execute WP-004 to bootstrap `apps/server/` so it uses the real game engine
and card registry packages instead of placeholders. The server is a **wiring
layer only** — it must never contain game logic, implement rules, or define
a boardgame.io `Game()` object directly.

---

## Authority Chain (Read in This Order)

Before writing any code, read these files in order:

1. `.claude/CLAUDE.md` — root coordination, EC-mode rules, governance set
2. `docs/ai/ARCHITECTURE.md` — layer boundaries, server layer rules,
   server startup sequence, package import rules
3. `.claude/rules/server.md` — server layer enforcement rules
4. `.claude/rules/code-style.md` — code style enforcement rules
5. `docs/ai/work-packets/WP-004-server-bootstrap.md` — **THE WORK PACKET**
   (authoritative spec for what to build)
6. `docs/ai/execution-checklists/EC-004-server-bootstrap.checklist.md` —
   **THE EXECUTION CHECKLIST** (every item must be satisfied exactly)
7. `docs/ai/REFERENCE/00.2-data-requirements.md §4.2` — what belongs in
   server memory vs what stays out
8. `docs/ai/REFERENCE/00.2-data-requirements.md §8.2` — match runtime state:
   `G` and `ctx` live in boardgame.io memory, never in the server layer
9. `docs/ai/REFERENCE/00.6-code-style.md` — code style rules

**Then read the actual source files you will modify or reference:**

10. `apps/server/src/server.mjs` — **will be modified** — current placeholder
    server with health endpoint, CORS, and loadRules()
11. `apps/server/src/game/legendary.mjs` — **will be modified** — current
    placeholder Game() definition (replace with thin re-export)
12. `apps/server/src/rules/loader.mjs` — reference only (do NOT modify) —
    exports loadRules() and getRules()
13. `apps/server/src/index.mjs` — **does it exist?** If not, create it.
    If FP-01 already created one, read it before modifying.
14. `apps/server/package.json` — **will be modified** — add workspace deps
15. `render.yaml` — **will be modified** — update startCommand
16. `packages/game-engine/src/index.ts` — reference only — confirm exact
    export name of `LegendaryGame`
17. `packages/registry/src/index.ts` — reference only — confirm exact
    factory function name (`createRegistryFromLocalFiles`)

---

## Pre-Execution Checks

Before writing a single line, confirm:

- [ ] WP-002 complete: `@legendary-arena/game-engine` builds and exports
      `LegendaryGame`
- [ ] WP-003 complete: `@legendary-arena/registry` smoke test passes and
      exports `createRegistryFromLocalFiles`
- [ ] FP-01 complete: `apps/server/src/server.mjs` exists with health endpoint
- [ ] FP-02 complete: `pnpm migrate` exits 0
- [ ] `data/metadata/` and `data/cards/` exist with real card data
- [ ] `pnpm install` succeeds

---

## Execution Rules

1. **One Work Packet per session** — only WP-004
2. **Read the full WP and EC** before writing code
3. **EC is the execution contract** — every checklist item must be satisfied
4. **If the EC and WP conflict, the WP wins**
5. **ESM only** — no `require()`, `node:` prefix on all built-ins
6. **Code style**: `docs/ai/REFERENCE/00.6-code-style.md` — all rules apply
7. **Server is wiring only** — no game logic, no rules, no `Game()` definition
8. **Immutable files** — do NOT modify `rules/loader.mjs` or anything in
   `packages/`

---

## Locked Values (Copy Verbatim — Do Not Re-derive)

- **Registry factory:** `createRegistryFromLocalFiles` (NOT `createRegistryFromHttp`)
- **Game import:** `LegendaryGame` from `@legendary-arena/game-engine`
- **Process entrypoint:** `apps/server/src/index.mjs`
- **PostgreSQL namespace:** `legendary.*` (e.g., `legendary.rules`)
- **Health endpoint:** `GET /health` returns `{"status":"ok"}`
- **Match creation:** `POST /games/legendary-arena/create` with
  `{"numPlayers": 2}` returns `{"matchID": "..."}`
- **Registry log format:** `[server] registry loaded: X sets, Y heroes, Z cards`

---

## Files Expected to Change

- `apps/server/src/server.mjs` — **modified** — import real game engine +
  registry; log registry summary at startup
- `apps/server/src/game/legendary.mjs` — **modified** — replace placeholder
  with thin re-export of `LegendaryGame`
- `apps/server/package.json` — **modified** — add `@legendary-arena/game-engine`
  and `@legendary-arena/registry` as workspace dependencies
- `apps/server/src/index.mjs` — **new or modified** — process entrypoint with
  SIGTERM graceful shutdown
- `render.yaml` — **modified** — update `startCommand` to
  `node apps/server/src/index.mjs`

No other files may be modified except:
- `docs/ai/STATUS.md` — **update** (add WP-004 section)
- `docs/ai/DECISIONS.md` — **update** (add decision for local registry loader)
- `docs/ai/work-packets/WORK_INDEX.md` — **update** (check off WP-004)

---

## Current Environment State

- WP-002 committed: `packages/game-engine/` builds and tests pass (5/5)
- WP-003 committed: `packages/registry/` smoke test passes (3/3),
  defects fixed, types corrected
- Local PostgreSQL is running with `legendary_arena` database
- All 3 migrations applied (`pnpm migrate` exits 0)
- `data/metadata/` has `sets.json` (40 sets), `card-types.json` (37 types)
- `data/cards/` has 40 per-set JSON files
- `apps/server/` exists with placeholder server from FP-01
- `pnpm install` is clean (lockfile up to date)
- Registry build has pre-existing TS errors in immutable files (out of scope)

---

## Important Notes

- **STATUS.md and DECISIONS.md already exist** — add new sections to the
  existing files rather than creating them from scratch.
- **The server already has a working health endpoint and CORS config** — do
  not change the health response shape or CORS origins. Preserve them exactly.
- **`loadRules()` is already called in `server.mjs`** — read how it works
  before modifying the file. You need to add registry loading alongside it,
  not replace it.
- **`game/legendary.mjs` currently defines a placeholder `Game()`** — replace
  its entire contents with a thin re-export from the package. Keep the file
  for backwards compatibility (other code may import from it).
- **`index.mjs` may or may not exist** — FP-01 may have created a basic
  entrypoint. Check first. If it exists, modify it; if not, create it.
- **The WP says `.mjs` extension** for all server files — this is the
  established convention in `apps/server/` (ESM via file extension, not
  package.json `"type": "module"`). Follow it.
- **Registry loading uses local files, not HTTP** — the server loads card
  data from `data/metadata/` and `data/cards/` at startup. The HTTP/R2
  loader is for browser clients, not the server.

---

## Verification After Execution

Run these in order (from the WP's Verification Steps):

```pwsh
# 1. Install updated dependencies
pnpm install
# Expected: packages resolved, workspace links created

# 2. Start the server (in background or separate terminal)
node --env-file=.env apps/server/src/index.mjs
# Expected output includes:
#   [server] rules loaded: N rules
#   [server] registry loaded: X sets, Y heroes, Z cards
#   [server] listening on port 8000

# 3. Health check (while server is running)
curl http://localhost:8000/health
# Expected: {"status":"ok"}

# 4. Match creation
curl -X POST http://localhost:8000/games/legendary-arena/create -H "Content-Type: application/json" -d "{\"numPlayers\": 2}"
# Expected: {"matchID": "<alphanumeric ID>"}

# 5. Confirm game/legendary.mjs has no Game() definition
Select-String -Path "apps\server\src\game\legendary.mjs" -Pattern "Game\("
# Expected: no output

# 6. Confirm LegendaryGame imported from the package
Select-String -Path "apps\server\src\server.mjs" -Pattern "game-engine"
# Expected: at least one match

# 7. Confirm no require() in modified files
Select-String -Path "apps\server\src" -Pattern "require\(" -Recurse
# Expected: no output

# 8. Confirm render.yaml startCommand
Select-String -Path "render.yaml" -Pattern "index.mjs"
# Expected: at least one match

# 9. Confirm immutable files untouched
git diff --name-only apps/server/src/rules/loader.mjs
# Expected: no output

# 10. Confirm no packages/ files modified
git diff --name-only packages/
# Expected: no output

# 11. Confirm no files outside scope were changed
git diff --name-only
```

---

## Post-Execution Updates

- [ ] `docs/ai/STATUS.md` — add WP-004 section
- [ ] `docs/ai/DECISIONS.md` — add decision:
      Why `createRegistryFromLocalFiles` is used at server startup instead
      of the HTTP/R2 loader (next available D-ID after D-1204)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — mark WP-004 complete with date
