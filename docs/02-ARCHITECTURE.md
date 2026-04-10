# Legendary Arena -- Architecture Overview

> Human-facing summary of the system architecture.
> The **authoritative source** is [`docs/ai/ARCHITECTURE.md`](ai/ARCHITECTURE.md).
> If this file and the authoritative source conflict, the authoritative source wins.
>
> **Last updated:** 2026-04-09 (after WP-004)

---

## System Layers

```
                    +-----------------------+
                    |   Client UI (future)  |
                    |   intents only        |
                    +-----------+-----------+
                                |
                    +-----------v-----------+
                    |   apps/server/        |
                    |   Wiring layer only   |
                    |   boardgame.io Server()|
                    +-----------+-----------+
                                |
              +-----------------+------------------+
              |                                    |
  +-----------v-----------+          +-------------v-----------+
  |  packages/game-engine |          |  packages/registry      |
  |  ALL game logic       |          |  Card data loading      |
  |  LegendaryGame        |          |  Zod validation         |
  |  boardgame.io ^0.50.0 |          |  Immutable CardRegistry |
  +----------+------------+          +-------------+-----------+
             |                                     |
             |  setup-time only                    |
             +-------------------------------------+
                                |
                    +-----------v-----------+
                    |   data/               |
                    |   Card JSON + metadata|
                    |   PostgreSQL schema   |
                    +-----------------------+
```

---

## Package Boundaries

| Package | Responsibility | May Import | Must NOT Import |
|---------|---------------|------------|-----------------|
| `game-engine` | All gameplay logic (phases, moves, rules, endgame) | Node built-ins only | registry, server, pg |
| `registry` | Card data loading and Zod validation | Node built-ins, zod | game-engine, server, pg |
| `apps/server` | Wiring: loads registry + rules, runs Server() | game-engine, registry, pg | UI packages, browser APIs |
| `apps/registry-viewer` | Read-only card browser SPA | registry, Vue | game-engine, server, pg |

**Violations are bugs.** Dependencies flow strictly downward. No layer may reach upward or sideways.

---

## Server Startup (implemented in WP-004)

Two independent tasks must both succeed before the server accepts requests:

1. **Card Registry** -- `createRegistryFromLocalFiles({ metadataDir, cardsDir })`
   - Loads `data/metadata/sets.json` + `data/cards/*.json`
   - Validates against Zod schemas
   - Returns immutable `CardRegistry`
   - Log: `[server] registry loaded: 40 sets, 288 heroes, 2620 cards`

2. **Rules Text** -- `loadRules()` from `apps/server/src/rules/loader.mjs`
   - Reads from PostgreSQL `legendary.rules` table
   - Caches in memory via `getRules()`
   - Log: `[server] rules loaded: N rules`

If either fails, the server exits. The server uses `createRequire` to bridge boardgame.io's CJS-only server bundle (D-1206).

---

## Architectural Principles

1. **Determinism is non-negotiable** -- all randomness via `ctx.random.*`, never `Math.random()`
2. **Engine owns truth** -- clients send intents, never outcomes
3. **Data outlives code** -- persisted data is versioned and migrated explicitly
4. **Growth is constrained** -- immutable surfaces protected by versioning

---

## Game State (`G`)

- JSON-serializable at all times (no functions, Maps, Sets, classes)
- Mutated via Immer drafts (boardgame.io 0.50.x) -- moves return void
- **Never persisted** to any database, file, or cache
- Managed entirely by boardgame.io in memory

---

## Persistence Classes

| Class | Examples | Persist? |
|-------|----------|----------|
| **Runtime** (never persist) | `G`, `ctx`, `ImplementationMap`, socket data | No |
| **Configuration** (safe) | `MatchSetupConfig`, player names, timestamps | Yes |
| **Snapshot** (immutable records) | `MatchSnapshot` (zone counts only, never contents) | Yes |

---

## Phases and Turn Stages

```
Phases:   lobby -> setup -> play -> end     (locked names)
Stages:   start -> main -> cleanup          (within play phase only)
```

- Phase transitions via `ctx.events.setPhase()` only (with `// why:` comment)
- Turn transitions via `ctx.events.endTurn()` only (with `// why:` comment)
- `G.currentStage` tracks turn stage in `G`, not `ctx`

---

## Move Contract

Every move follows this exact sequence:
1. **Validate args** -- return void if invalid (never throw)
2. **Check stage gate** -- return void if blocked
3. **Mutate G** -- via `zoneOps.ts` helpers, return void

Only `Game.setup()` may throw. Moves never throw.

---

## Key Data Locations

| Data | Location | Mutable |
|------|----------|---------|
| Card metadata & images | R2 / `data/` local files | No |
| Live game state (`G`) | boardgame.io in-memory | Yes (moves only) |
| Rules text | PostgreSQL `legendary.rules` | No (seeded at deploy) |
| Card registry | Server in-memory | No (read-only after load) |
| Match setup config | boardgame.io matchData | No (input) |

---

## For Full Details

- **Authoritative architecture:** [`docs/ai/ARCHITECTURE.md`](ai/ARCHITECTURE.md)
- **Layer enforcement rules:** `.claude/rules/*.md` (7 files)
- **Decisions log:** [`docs/ai/DECISIONS.md`](ai/DECISIONS.md) (26 decisions)
- **Data contracts:** [`docs/ai/REFERENCE/00.2-data-requirements.md`](ai/REFERENCE/00.2-data-requirements.md)

*Last updated: 2026-04-09 (after WP-004)*
