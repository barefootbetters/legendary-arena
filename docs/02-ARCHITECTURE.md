# Legendary Arena -- Architecture Overview

> Human-facing summary of the system architecture.
> The **authoritative source** is [`docs/ai/ARCHITECTURE.md`](ai/ARCHITECTURE.md).
> If this file and the authoritative source conflict, the authoritative source wins.
>
> **Last updated:** 2026-04-14 (Phase 5 complete, 314 engine tests)

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
  |  314 tests, 83 suites |          |  Themes (WP-055)        |
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

  +---------------------------+
  |  packages/preplan (future) |
  |  Speculative planning     |
  |  Types only from engine   |
  +---------------------------+
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

## Game State (`G`) -- `LegendaryGameState`

- JSON-serializable at all times (no functions, Maps, Sets, classes)
- Mutated via Immer drafts (boardgame.io 0.50.x) -- moves return void
- **Never persisted** to any database, file, or cache
- Managed entirely by boardgame.io in memory

Key fields (21 total):

| Field | Purpose | Built at |
|-------|---------|----------|
| `matchConfiguration` | Immutable match config (9 fields) | setup |
| `playerZones` | Per-player deck/hand/discard/inPlay/victory | setup |
| `piles` | Shared bystanders/wounds/officers/sidekicks | setup |
| `villainDeck` | Deck + discard for villain reveals | setup |
| `villainDeckCardTypes` | Card type classification (O(1) lookup) | setup |
| `city` | 5-space villain zone (fixed tuple) | setup |
| `hq` | 5-slot hero recruit zone | setup |
| `mastermind` | Tactics deck + defeated list | setup |
| `cardStats` | Attack/recruit/cost per card | setup |
| `cardKeywords` | Board keywords (Patrol/Ambush/Guard) per card | setup |
| `heroAbilityHooks` | Hero ability declarations (data-only) | setup |
| `schemeSetupInstructions` | Scheme setup instructions (empty at MVP) | setup |
| `hookRegistry` | Rule hook definitions (data-only) | setup |
| `turnEconomy` | Per-turn attack/recruit tracking | turn start |
| `currentStage` | Turn stage: start/main/cleanup | turn start |
| `counters` | Named endgame counters | runtime |
| `messages` | Deterministic event log | runtime |
| `ko` | Knocked-out cards | runtime |
| `attachedBystanders` | Bystanders attached to villains | runtime |
| `lobby` | Player readiness + match start flag | setup |
| `selection` | Selected scheme/mastermind/group IDs | setup |

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

## Moves (8 total)

| Move | Stage | What It Does |
|------|-------|--------------|
| `drawCards` | start, main | Draw N cards from deck to hand |
| `playCard` | main | Move card from hand to inPlay, trigger hero effects |
| `revealVillainCard` | start | Draw from villain deck, route by card type, City placement |
| `fightVillain` | main | Fight a City villain (Patrol cost, Guard blocking) |
| `fightMastermind` | main | Fight mastermind, defeat tactic, check victory |
| `recruitHero` | main | Recruit from HQ, spend recruit points |
| `advanceStage` | any | Advance turn stage (start -> main -> cleanup) |
| `endTurn` | cleanup | Discard hand + inPlay, end turn |

All moves follow the three-step contract: validate args, check stage gate, mutate G.

---

## Rule Execution Pipeline

Two-step declarative + deterministic execution (D-2601):

1. **`executeRuleHooks(G, trigger, payload)`** -- reads G + hookRegistry, returns `RuleEffect[]`, never mutates G
2. **`applyRuleEffects(G, effects)`** -- applies effects via `for...of`, unknown types warn and skip

Triggers: `onCardRevealed`, `onSchemeTwistRevealed`, `onMastermindStrikeRevealed`, `onTurnStart`, `onTurnEnd`

Effect types: `queueMessage`, `modifyCounter`, `drawCards`, `discardHand`

Hero effects use a parallel path: `executeHeroEffects` fires keyword-based effects (draw, attack, recruit, ko) with optional conditions (requiresKeyword, playedThisTurn, heroClassMatch, requiresTeam).

---

## Setup-Time Resolution Pattern

The engine resolves all registry data during `Game.setup()` and stores results in G. Moves never access the registry.

| Builder | Source | G Field | WP |
|---------|--------|---------|-----|
| `buildVillainDeck` | Registry villain/henchman data | `villainDeck`, `villainDeckCardTypes` | WP-014B |
| `buildCardStats` | Registry card stat fields | `cardStats` | WP-018 |
| `buildMastermindState` | Registry mastermind data | `mastermind` | WP-019 |
| `buildHeroAbilityHooks` | Registry hero ability text | `heroAbilityHooks` | WP-021 |
| `buildCardKeywords` | Registry villain ability text | `cardKeywords` | WP-025 |
| `buildSchemeSetupInstructions` | Registry scheme data (MVP: `[]`) | `schemeSetupInstructions` | WP-026 |

All builders use `registry: unknown` with local structural interfaces to respect the layer boundary.

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
- **Decisions log:** [`docs/ai/DECISIONS.md`](ai/DECISIONS.md) (133+ decisions)
- **Data contracts:** [`docs/ai/REFERENCE/00.2-data-requirements.md`](ai/REFERENCE/00.2-data-requirements.md)
- **Code categories:** [`docs/ai/REFERENCE/02-CODE-CATEGORIES.md`](ai/REFERENCE/02-CODE-CATEGORIES.md)
- **Testing:** [`docs/06-TESTING.md`](06-TESTING.md) (314 engine tests, 10 drift-detection arrays)

*Last updated: 2026-04-14 (Phase 5 complete)*
