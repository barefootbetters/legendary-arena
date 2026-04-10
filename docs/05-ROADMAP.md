# Legendary Arena — Development Roadmap

> A modern multiplayer evolution of the Marvel Legendary deck-building card game.  
> Built with **boardgame.io**, **TypeScript**, and **Cloudflare R2**.

**Last updated:** 2026-04-09 • **Authoritative source:** [`docs/ai/work-packets/WORK_INDEX.md`](docs/ai/work-packets/WORK_INDEX.md)

---

## Current Status

**Foundation Prompts**  
`00.4` ✅ `00.5` ✅ `01` ⬜ `02` ⬜

**Work Packets**  
`WP-001` ✅  **WP-002 — WP-047** ⬜

**Overall Progress**  
![Progress](https://img.shields.io/badge/Progress-2%2F47%20Work%20Packets-22b573) ![Foundation](https://img.shields.io/badge/Foundation-Complete-10b981)

---

## Foundation Layer

Infrastructure that everything else builds on.

| #      | Name                              | What It Establishes                              | Status |
|--------|-----------------------------------|--------------------------------------------------|--------|
| FP-00.4 | Connection & Environment Health Check | `pnpm check` / `pnpm check:env`                 | ✅ Complete |
| FP-00.5 | R2 Data & Image Validation        | `pnpm validate` — 4-phase integrity check (40 sets) | ✅ Complete |
| FP-01   | Render.com Backend                | Server scaffold, PostgreSQL, `render.yaml`       | ⬜ Pending |
| FP-02   | Database Migrations               | Migration runner + seed pipeline                 | ⬜ Pending |

---

## Phase 0 — Coordination & Contracts

Establishes repo-as-memory system and locks contracts.

| WP   | Name                              | Layer              | What It Produces                              | Status |
|------|-----------------------------------|--------------------|-----------------------------------------------|--------|
| 001  | Foundation & Coordination System  | Documentation      | REFERENCE docs, WORK_INDEX, override hierarchy | ✅ Complete |
| 002  | boardgame.io Game Skeleton        | Game Engine        | `LegendaryGame`, 4 phases, JSON test          | ⬜ Pending |
| 003  | Card Registry Verification        | Registry           | Fix 2 defects + smoke test                    | ⬜ Pending |
| 004  | Server Bootstrap                  | Server             | Wire engine + registry into `Server()`        | ⬜ Pending |
| 043–047 | Governance Packets             | Docs / Coordination| Align all foundation prompts with framework   | ⬜ Pending |

---

## Phase 1 — Game Setup Contracts & Determinism

Defines *what* a match is before *how* it plays.

| WP     | Name                              | Layer       | What It Produces                              |
|--------|-----------------------------------|-------------|-----------------------------------------------|
| 005A/B | Match Setup & Deterministic Init  | Engine      | `MatchSetupConfig`, `shuffleDeck`, `Game.setup()` |
| 006A/B | Player State & Zones              | Engine      | `PlayerZones`, `GlobalPiles`, validators      |

---

## Phase 2 — Core Turn Engine

First playable (but incomplete) game loop.

| WP     | Name                              | Layer       | What It Produces                              |
|--------|-----------------------------------|-------------|-----------------------------------------------|
| 007A/B | Turn Structure & Loop             | Engine      | `MATCH_PHASES`, `advanceTurnStage`            |
| 008A/B | Core Moves                        | Engine      | `drawCards`, `playCard`, `endTurn`            |

---

## Phase 3 — MVP Multiplayer Infrastructure

Minimum viable multiplayer loop.

| WP     | Name                              | Layer       | What It Produces                              |
|--------|-----------------------------------|-------------|-----------------------------------------------|
| 009A/B | Rule Hooks                        | Engine      | 5 triggers, 4 effect types                    |
| 010    | Victory & Loss Conditions         | Engine      | `evaluateEndgame`                             |
| 011–013| Lobby, Join, Persistence          | Server      | Match creation, list, reconnect, snapshots   |

---

## Phase 4 — Core Gameplay Loop

The game finally plays like Legendary.

| WP   | Name                              | Layer       | What It Produces                              |
|------|-----------------------------------|-------------|-----------------------------------------------|
| 014–020 | Villain Deck → VP Scoring       | Engine      | City, HQ, Fight, Recruit, Mastermind, Economy |

---

## Phase 5 — Card Mechanics & Abilities

Individual cards come alive.

| WP     | Name                              | Layer       | What It Produces                              |
|--------|-----------------------------------|-------------|-----------------------------------------------|
| 021–026| Hero Hooks → Scheme Setup         | Engine      | Abilities, keywords, board rules              |

---

## Phase 6 — Verification, UI & Production

Making the game safe to ship.

| WP     | Name                              | Layer              | What It Produces                              |
|--------|-----------------------------------|--------------------|-----------------------------------------------|
| 027–035| Replay → Deployment Checklists    | Engine + Ops       | Determinism, UIState, versioning, ops playbook|

---

## Phase 7 — Beta, Launch & Live Ops

Ship it and keep it alive.

| WP     | Name                              | Layer              | What It Produces                              |
|--------|-----------------------------------|--------------------|-----------------------------------------------|
| 036–041| AI Playtesting → Architecture Audit| Simulation + Ops   | Beta strategy, metrics, growth governance     |

---

## Dependency Overview

```mermaid
flowchart TD
    FP[Foundation Prompts<br>00.4 ✅ → 00.5 ✅] --> WP001[WP-001 ✅<br>Coordination]
    WP001 --> Phase0[Phase 0–1<br>Contracts & Setup]
    Phase0 --> Phase2[Phase 2<br>Turn Engine]
    Phase2 --> Phase3[Phase 3<br>MVP Multiplayer]
    Phase3 --> Phase4[Phase 4<br>Core Gameplay]
    Phase4 --> Phase5[Phase 5<br>Card Abilities]
    Phase5 --> Phase6[Phase 6<br>Production]
    Phase6 --> Phase7[Phase 7<br>Beta & Launch]
    style FP fill:#10b981,color:#fff
    style WP001 fill:#10b981,color:#fff

Parallel-safe packets: WP-003 (alongside 002), WP-005A/B (no dep on 004), WP-030 (parallel to 031).Architectural InvariantsDeterminism is non-negotiable — randomness only via ctx.random.*
Engine owns truth — clients send intents, never outcomes
G is never persisted — only MatchSnapshot is saved
Moves never throw — only Game.setup() is allowed to
Zones store only CardExtId strings
Every phase/transition has a // why: comment

Governance SystemDocument
Role
.claude/CLAUDE.md
Root coordination (loaded every session)
docs/ai/ARCHITECTURE.md
Architectural decisions & boundaries
docs/ai/work-packets/WORK_INDEX.md
Execution order & status
.claude/rules/*.md
7 layer-specific enforcement rules
docs/ai/execution-checklists/EC-*.md
51 execution contracts (EC-mode active)
