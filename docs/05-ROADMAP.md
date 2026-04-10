# Legendary Arena -- Development Roadmap

> A modern multiplayer evolution of the Marvel Legendary deck-building card game.
> Built with **boardgame.io**, **TypeScript**, and **Cloudflare R2**.

**Last updated:** 2026-04-10 (after WP-008A) -- **Authoritative source:** [`docs/ai/work-packets/WORK_INDEX.md`](ai/work-packets/WORK_INDEX.md)

---

## Current Status

**Foundation Prompts**
`00.4` ✅ `00.5` ✅ `01` ✅ `02` ✅

**Work Packets**
`WP-001` ✅ `WP-002` ✅ `WP-003` ✅ `WP-004` ✅ `WP-005A` ✅ `WP-005B` ✅ `WP-006A` ✅ `WP-006B` ✅ `WP-007A` ✅ `WP-007B` ✅ `WP-008A` ✅ -- **WP-008B..047** ⬜

**Overall Progress**
15 / 52 items complete (4 FPs + 11 WPs) -- **Next up:** WP-008B (Core Moves Implementation)

---

## Foundation Layer

Infrastructure that everything else builds on.

| #       | Name                                | What It Establishes                                | Status      |
|---------|-------------------------------------|----------------------------------------------------|-------------|
| FP-00.4 | Connection & Environment Health Check | `pnpm check` / `pnpm check:env`                 | ✅ Complete |
| FP-00.5 | R2 Data & Image Validation          | `pnpm validate` -- 4-phase integrity check (40 sets) | ✅ Complete |
| FP-01   | Render.com Backend                  | Server scaffold, PostgreSQL, `render.yaml`         | ✅ Complete |
| FP-02   | Database Migrations                 | Migration runner + seed pipeline                   | ✅ Complete |

---

## Phase 0 -- Coordination & Contracts

Establishes repo-as-memory system and locks contracts.

| WP      | Name                             | Layer              | What It Produces                               | Status      |
|---------|----------------------------------|--------------------|-------------------------------------------------|-------------|
| 001     | Foundation & Coordination System | Documentation      | REFERENCE docs, WORK_INDEX, override hierarchy  | ✅ Complete |
| 002     | boardgame.io Game Skeleton       | Game Engine        | `LegendaryGame`, 4 phases, `validateSetupData`  | ✅ Complete |
| 003     | Card Registry Verification       | Registry           | Fix 2 defects + smoke test                      | ✅ Complete |
| 004     | Server Bootstrap                 | Server             | Wire engine + registry into `Server()`           | ✅ Complete |
| 043-047 | Governance Packets               | Docs / Coordination| Align all foundation prompts with framework      | ⬜ Pending  |

---

## Phase 1 -- Game Setup Contracts & Determinism ✅

Defines *what* a match is before *how* it plays.

| WP     | Name                             | Layer   | What It Produces                                  | Status      |
|--------|----------------------------------|---------|----------------------------------------------------|-------------|
| 005A/B | Match Setup & Deterministic Init | Engine  | `MatchSetupConfig`, `shuffleDeck`, `Game.setup()`  | ✅ Complete |
| 006A/B | Player State & Zones             | Engine  | `PlayerZones`, `GlobalPiles`, validators            | ✅ Complete |

---

## Phase 2 -- Core Turn Engine (In Progress)

First playable (but incomplete) game loop.

| WP     | Name                 | Layer   | What It Produces                       | Status      |
|--------|----------------------|---------|----------------------------------------|-------------|
| 007A/B | Turn Structure & Loop | Engine | `MATCH_PHASES`, `advanceTurnStage`      | ✅ Complete |
| 008A   | Core Moves Contracts | Engine  | `MoveResult`, `MOVE_ALLOWED_STAGES`, validators | ✅ Complete |
| 008B   | Core Moves Implementation | Engine | `drawCards`, `playCard`, `endTurn` mutations | ⬜ Next    |

---

## Phase 3 -- MVP Multiplayer Infrastructure

Minimum viable multiplayer loop.

| WP      | Name                       | Layer   | What It Produces                            |
|---------|----------------------------|---------|----------------------------------------------|
| 009A/B  | Rule Hooks                 | Engine  | 5 triggers, 4 effect types                   |
| 010     | Victory & Loss Conditions  | Engine  | `evaluateEndgame`                             |
| 011-013 | Lobby, Join, Persistence   | Server  | Match creation, list, reconnect, snapshots    |

---

## Phase 4 -- Core Gameplay Loop

The game finally plays like Legendary.

| WP      | Name                        | Layer   | What It Produces                                 |
|---------|-----------------------------|---------|---------------------------------------------------|
| 014-020 | Villain Deck through VP Scoring | Engine | City, HQ, Fight, Recruit, Mastermind, Economy |

---

## Phase 5 -- Card Mechanics & Abilities

Individual cards come alive.

| WP      | Name                          | Layer   | What It Produces                      |
|---------|-------------------------------|---------|----------------------------------------|
| 021-026 | Hero Hooks through Scheme Setup | Engine | Abilities, keywords, board rules      |

---

## Phase 6 -- Verification, UI & Production

Making the game safe to ship.

| WP          | Name                               | Layer          | What It Produces                                |
|-------------|-------------------------------------|----------------|-------------------------------------------------|
| 027-035, 042 | Replay through Deployment Checklists | Engine + Ops | Determinism, UIState, versioning, ops playbook  |

---

## Phase 7 -- Beta, Launch & Live Ops

Ship it and keep it alive.

| WP      | Name                                  | Layer            | What It Produces                            |
|---------|---------------------------------------|------------------|---------------------------------------------|
| 036-041 | AI Playtesting through Architecture Audit | Simulation + Ops | Beta strategy, metrics, growth governance |

---

## Dependency Overview

```mermaid
flowchart TD
    FP["Foundation Prompts\n00.4 ✅ 00.5 ✅ 01 ✅ 02 ✅"] --> WP001["WP-001 ✅\nCoordination"]
    WP001 --> WP002["WP-002 ✅\nGame Skeleton"]
    WP001 --> WP003["WP-003 ✅\nCard Registry"]
    WP002 --> WP004["WP-004 ✅\nServer Bootstrap"]
    WP003 --> WP004
    WP004 --> Phase1["Phase 1 ✅\nGame Setup"]
    Phase1 --> Phase2["Phase 2 🔨\nTurn Engine"]
    Phase2 --> Phase3["Phase 3\nMVP Multiplayer"]
    Phase3 --> Phase4["Phase 4\nCore Gameplay"]
    Phase4 --> Phase5["Phase 5\nCard Abilities"]
    Phase5 --> Phase6["Phase 6\nProduction"]
    Phase6 --> Phase7["Phase 7\nBeta & Launch"]
    style FP fill:#10b981,color:#fff
    style WP001 fill:#10b981,color:#fff
    style WP002 fill:#10b981,color:#fff
    style WP003 fill:#10b981,color:#fff
    style WP004 fill:#10b981,color:#fff
    style Phase1 fill:#10b981,color:#fff
```

**Parallel-safe packets:** WP-003 (alongside 002), WP-005A/B (no dep on 004), WP-030 (parallel to 031).

---

## Architectural Invariants

- Determinism is non-negotiable -- randomness only via `ctx.random.*`
- Engine owns truth -- clients send intents, never outcomes
- `G` is never persisted -- only `MatchSnapshot` is saved
- Moves never throw -- only `Game.setup()` is allowed to
- Zones store only `CardExtId` strings
- Every phase/transition has a `// why:` comment

---

## Governance System

| Document | Role |
|----------|------|
| `.claude/CLAUDE.md` | Root coordination (loaded every session) |
| `docs/ai/ARCHITECTURE.md` | Architectural decisions & boundaries |
| `docs/ai/work-packets/WORK_INDEX.md` | Execution order & status |
| `.claude/rules/*.md` | 7 layer-specific enforcement rules |
| `docs/ai/execution-checklists/EC-*.md` | 51 execution contracts (3 Done, 48 Draft) |
| `docs/ai/DECISIONS.md` | 28 immutable decisions |

*Last updated: 2026-04-10 (after WP-008A commit)*
