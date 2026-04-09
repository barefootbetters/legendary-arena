# EC-004 — Server Bootstrap (Execution Checklist)

**Source:** docs/ai/work-packets/WP-004-server-bootstrap.md
**Layer:** Server

**Execution Authority:**
This EC is the authoritative execution checklist for WP-004.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-004.

---

## Before Starting

- [ ] WP-002 complete: `@legendary-arena/game-engine` builds and exports `LegendaryGame`
- [ ] WP-003 complete: `@legendary-arena/registry` builds and exports `createRegistryFromLocalFiles`
- [ ] Foundation Prompt 01 complete: `apps/server/src/server.mjs` exists with health endpoint
- [ ] Foundation Prompt 02 complete: `data/migrations/` exists, `pnpm migrate` succeeds
- [ ] `data/metadata/` and `data/cards/` exist with real card data
- [ ] `pnpm install` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-004.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `legendary.*` schema namespace for all PostgreSQL tables
- Rules table: `legendary.rules`
- PKs use `bigserial`; cross-service IDs use `ext_id text`
- Registry factory: `createRegistryFromLocalFiles` (NOT `createRegistryFromHttp`)
- Game import: `LegendaryGame` from `@legendary-arena/game-engine`
- Entrypoint: `apps/server/src/index.mjs`

---

## Guardrails

- Server is a wiring layer — must NEVER contain game logic, implement rules, or define `Game()`
- `LegendaryGame` imported from `@legendary-arena/game-engine` — not from a local file
- `apps/server/src/rules/loader.mjs` must NOT be modified
- `packages/game-engine/` and `packages/registry/` must NOT be modified
- No custom WebSocket, Express, or HTTP routing beyond boardgame.io `Server()` defaults
- ESM only — no `require()`; no `import * as`
- Preserve existing health endpoint, CORS origins, and PORT handling exactly

---

## Required `// why:` Comments

- `createRegistryFromLocalFiles` call: why local files at startup, not HTTP/R2 loader
- `game/legendary.mjs`: kept for backwards compatibility only; source of truth is the package
- `index.mjs`: why it is the entrypoint and `server.mjs` is the configuration module

---

## Files to Produce

- `apps/server/src/server.mjs` — **modified** — import real game engine + registry
- `apps/server/src/game/legendary.mjs` — **modified** — thin re-export
- `apps/server/package.json` — **modified** — add workspace deps
- `apps/server/src/index.mjs` — **new** — process entrypoint with SIGTERM
- `render.yaml` — **modified** — update `startCommand` to `index.mjs`

---

## After Completing

- [ ] `GET /health` returns HTTP 200 with `{"status":"ok"}`
- [ ] `POST /games/legendary-arena/create` returns a `matchID`
- [ ] Server startup logs show rules count AND registry summary
- [ ] `game/legendary.mjs` contains no `Game(` definition
- [ ] `render.yaml` startCommand is `node apps/server/src/index.mjs`
- [ ] No `require()` or `import * as` in any modified file
- [ ] `rules/loader.mjs` was NOT modified; no files in `packages/` modified
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated
      (why `createRegistryFromLocalFiles`)
- [ ] `docs/ai/work-packets/WORK_INDEX.md`
      WP-004 checked off with date
