# Legendary Arena — Development Roadmap

> A modern multiplayer evolution of the Marvel Legendary deck-building card game.
> Built with boardgame.io, TypeScript, and Cloudflare R2.
>
> This roadmap reflects the actual Work Packet execution plan.
> Status is tracked in `docs/ai/work-packets/WORK_INDEX.md`.

---

## Current Status

```
Foundation Prompts:  00.4 ✅  00.5 ✅  01 ⬜  02 ⬜
Work Packets:        WP-001 ✅  |  WP-002 through WP-047: pending
```

---

## Foundation Layer

Infrastructure that all Work Packets build on. Executed once, in order.

| # | Name | What It Establishes | Status |
|---|---|---|---|
| FP-00.4 | Connection & Environment Health Check | `pnpm check` / `pnpm check:env` — developer machine validation | ✅ Complete |
| FP-00.5 | R2 Data & Image Validation | `pnpm validate` — 4-phase card data integrity check across 40 sets | ✅ Complete |
| FP-01 | Render.com Backend | Server scaffold, PostgreSQL schema, `render.yaml` | ⬜ Pending |
| FP-02 | Database Migrations | Migration runner, `data/migrations/`, seed pipeline | ⬜ Pending |

---

## Phase 0 — Coordination & Contracts

Establishes the repo-as-memory system. Locks contracts before any code.

| WP | Name | Layer | What It Produces | Status |
|---|---|---|---|---|
| 001 | Foundation & Coordination System | Documentation | REFERENCE docs, override hierarchy, WORK_INDEX | ✅ Complete |
| 002 | boardgame.io Game Skeleton | Game Engine | `LegendaryGame`, `MatchConfiguration`, 4 phases, JSON-serializability test | ⬜ Pending |
| 003 | Card Registry Verification | Registry | Fix 2 confirmed defects, add smoke test | ⬜ Pending |
| 004 | Server Bootstrap | Server | Wire game-engine + registry into `Server()`, process entrypoint | ⬜ Pending |
| 043 | Data Contracts Reference | Registry / Docs | Migrate 00.2 into governed reference doc | ⬜ Pending |
| 044 | Prompt Lint Governance | Coordination / Docs | Align 00.3 lint checklist terminology | ⬜ Pending |
| 045 | Connection Health Governance | Coordination / Docs | Align 00.4 with governance framework | ⬜ Pending |
| 046 | R2 Validation Governance | Coordination / Docs | Align 00.5 with governance framework | ⬜ Pending |
| 047 | Code Style Governance | Coordination / Docs | Align 00.6 code style reference | ⬜ Pending |

---

## Phase 1 — Game Setup Contracts & Determinism

Defines *what* a match is before implementing *how* it plays.

| WP | Name | Layer | What It Produces |
|---|---|---|---|
| 005A | Match Setup Contracts | Engine / Contracts | `MatchSetupConfig` (9 fields), `validateMatchSetup` |
| 005B | Deterministic Setup | Engine / Setup | `shuffleDeck`, `buildInitialGameState`, `Game.setup()` |
| 006A | Player State & Zones Contracts | Engine / Contracts | `PlayerZones` (5), `GlobalPiles` (4), validators |
| 006B | Player State Initialization | Engine / Setup | `buildPlayerState`, `buildGlobalPiles` |

---

## Phase 2 — Core Turn Engine

Creates the first playable (but incomplete) game loop.

| WP | Name | Layer | What It Produces |
|---|---|---|---|
| 007A | Turn Structure Contracts | Engine / Contracts | `MATCH_PHASES`, `TURN_STAGES`, `getNextTurnStage` |
| 007B | Turn Loop Implementation | Engine / Turn Loop | `advanceTurnStage`, `G.currentStage`, play phase wiring |
| 008A | Core Moves Contracts | Engine / Contracts | `MoveResult`/`MoveError`, `CORE_MOVE_NAMES`, stage gating |
| 008B | Core Moves Implementation | Engine / Moves | `drawCards`, `playCard`, `endTurn`, `zoneOps.ts` |

---

## Phase 3 — MVP Multiplayer Infrastructure

Completes the minimum viable multiplayer loop.

| WP | Name | Layer | What It Produces |
|---|---|---|---|
| 009A | Rule Hooks Contracts | Engine / Contracts | `HookDefinition`, 5 triggers, 4 effect types |
| 009B | Rule Execution | Engine / Rules | `ImplementationMap`, `executeRuleHooks`, `applyRuleEffects` |
| 010 | Victory & Loss Conditions | Engine / Endgame | `evaluateEndgame`, `ENDGAME_CONDITIONS`, `endIf` wiring |
| 011 | Match Creation & Lobby | Server + Engine | `G.lobby`, lobby moves, `create-match.mjs` CLI |
| 012 | Match List, Join, Reconnect | Server | `list-matches.mjs`, `join-match.mjs` CLI scripts |
| 013 | Persistence Boundaries | Architecture | `PERSISTENCE_CLASSES`, `MatchSnapshot`, `ARCHITECTURE.md` |

---

## Phase 4 — Core Gameplay Loop

Makes the game play like Legendary for the first time.

| WP | Name | Layer | What It Produces |
|---|---|---|---|
| 014 | Villain Deck & Reveal | Engine / Core | `G.villainDeck`, reveal pipeline, `REVEALED_CARD_TYPES` |
| 015 | City & HQ Zones | Engine / Board | `G.city` (5-tuple), `G.hq`, villain movement, escapes |
| 016 | Fight & Recruit | Engine / Actions | `fightVillain`, `recruitHero` moves |
| 017 | KO, Wounds, Bystanders | Engine / Effects | `G.ko`, `G.attachedBystanders`, wound penalties |
| 018 | Attack & Recruit Economy | Engine / Economy | `G.turnEconomy`, `G.cardStats`, `parseCardStatValue` |
| 019 | Mastermind Tactics | Engine / Boss | `G.mastermind`, tactics deck, `fightMastermind` |
| 020 | VP Scoring & Win Summary | Engine / Scoring | `computeFinalScores`, VP constants |

---

## Phase 5 — Card Mechanics & Abilities

Makes individual cards do things.

| WP | Name | Layer | What It Produces |
|---|---|---|---|
| 021 | Hero Hooks (Data Only) | Engine / Rules | `HeroAbilityHook`, `HeroKeyword` union, `G.heroAbilityHooks` |
| 022 | Hero Execution (Unconditional) | Engine / Rules | Execute 4 keywords: draw, gainAttack, gainRecruit, koCard |
| 023 | Conditional Hero Effects | Engine / Rules | 4 condition types, AND logic, pure predicates |
| 024 | Scheme & Mastermind Abilities | Engine / Rules | Scheme twist + mastermind strike handlers |
| 025 | Board Keywords | Engine / Board | Patrol, Ambush, Guard — structural City rules |
| 026 | Scheme Setup Instructions | Engine / Setup | `SchemeSetupInstruction`, city modifiers |

---

## Phase 6 — Verification, UI & Production

Makes the game safe to ship.

| WP | Name | Layer | What It Produces |
|---|---|---|---|
| 027 | Replay Verification | Engine / Infra | `ReplayInput`, `replayGame`, `verifyDeterminism` |
| 028 | UI State Contract | Engine / UI Boundary | `UIState`, `buildUIState` — read-only projection |
| 029 | Spectator Views | Engine / UI Boundary | `UIAudience`, `filterUIStateForAudience` |
| 030 | Campaign Framework | Orchestration | `CampaignState` — external to engine |
| 031 | Production Hardening | Engine / Safety | 5 invariant categories, `assertInvariant` |
| 032 | Network Sync | Multiplayer | `ClientTurnIntent`, desync detection |
| 033 | Content Authoring Toolkit | Engine / Content | `validateContent`, `validateContentBatch` |
| 034 | Versioning & Migration | Engine / Versioning | 3 version axes, `VersionedArtifact` |
| 035 | Release & Ops Playbook | Operations | Release artifacts, rollback strategy, `docs/ops/` |
| 042 | Deployment Checklists | Operations | R2 + PostgreSQL deployment procedures |

---

## Phase 7 — Beta, Launch & Live Ops

Ships the game and keeps it running.

| WP | Name | Layer | What It Produces |
|---|---|---|---|
| 036 | AI Playtesting | Engine / Simulation | `AIPolicy`, `RandomPolicy`, `runSimulation` |
| 037 | Public Beta Strategy | Strategy / Docs | `BetaFeedback` type, cohorts, exit criteria |
| 038 | Launch Readiness | Operations | 4 readiness gates, launch day procedure |
| 039 | Post-Launch Metrics | Operations | `MetricEntry` type, 4 metric categories |
| 040 | Growth Governance | Product | 5 change categories, `ChangeBudget` type |
| 041 | Architecture Audit | Architecture / Docs | Field Classification audit, authority hierarchy |

---

## Dependency Chain

```
Foundation Prompts: 00.4 ✅ → 00.5 ✅ → 01 → 02
                                              │
WP-001 ✅                                     │
                                              ▼
                        WP-002 ──────────── WP-003
                           │                  │
                           └────── WP-004 ────┘
                                      │
                        WP-005A → 005B → 006A → 006B
                                                  │
                        WP-007A → 007B → 008A → 008B
                                                  │
                        WP-009A → 009B → 010 → 011 → 012 → 013
                                                                │
                        WP-014 → 015 → 016 → 017 → 018 → 019 → 020
                                                                  │
                        WP-021 → 022 → 023 → 024 → 025 → 026
                                                              │
                        WP-027 → 028 → 029 → 030
                                          │
                        WP-031 → 032 → 033 → 034 → 035
                                                        │
                        WP-036 → 037 → 038 → 039 → 040
```

**Parallel-safe packets:**
- WP-003 can run alongside WP-002
- WP-005A/005B have no dependency on WP-004
- WP-030 is parallel to WP-031

---

## Architectural Invariants

These rules apply to every phase and every Work Packet.

- **Determinism is non-negotiable** — all randomness via `ctx.random.*`, never `Math.random()`
- **The engine owns truth** — clients submit intents, not outcomes
- **`G` is never persisted** — runtime state stays in boardgame.io memory
- **Moves never throw** — only `Game.setup()` may throw
- **Zones store `CardExtId` strings only** — never full card objects
- **No `.reduce()` in zone operations** — explicit `for...of` loops
- **Every phase/turn transition needs a `// why:` comment**
- **Registry is available at setup time only** — moves operate on resolved data

---

## Governance System

| Document | Role |
|---|---|
| `.claude/CLAUDE.md` | Root coordination — loaded every session |
| `docs/ai/ARCHITECTURE.md` | Architectural decisions and boundaries |
| `.claude/rules/*.md` | Per-layer enforcement rules (7 files) |
| `docs/ai/work-packets/WORK_INDEX.md` | Execution order and status |
| `docs/ai/execution-checklists/EC-*.md` | 51 execution contracts (EC-mode active) |
| `docs/ai/DECISIONS.md` | 24 permanent architectural decisions |

---

*Last updated: 2026-04-09*
*Authoritative source: `docs/ai/work-packets/WORK_INDEX.md`*
