# Legendary Arena — Development Roadmap (Mindmap)

```
                              LEGENDARY ARENA
                          Multiplayer Deck-Builder
                                    │
            ┌───────────────────────┼───────────────────────┐
            │                       │                       │
      FOUNDATION               GAME ENGINE              OPERATIONS
      (Infrastructure)         (Core Logic)             (Ship & Run)
            │                       │                       │
    ┌───────┴───────┐       ┌───────┴───────┐       ┌───────┴───────┐
    │               │       │               │       │               │
  ENV CHECK     DATA CHECK  CONTRACTS   GAMEPLAY    RELEASE     LIVE OPS
  FP-00.4 ✅   FP-00.5 ✅     │           │        │              │
    │               │         │           │        │              │
  ┌─┴─┐         ┌──┴──┐      │           │        │              │
  │   │         │     │      │           │        │              │
 .env  Tools   R2    Sets    │           │        │              │
 check check  valid  40     │           │        │              │
    │               │        │           │        │              │
  SERVER        DB SETUP     │           │        │              │
  FP-01 ⬜     FP-02 ⬜      │           │        │              │
                             │           │        │              │
                             ▼           │        │              │
                                         │        │              │
         ┌───────────────────────────────┘        │              │
         │                                        │              │
    Phase 0─1                                     │              │
    CONTRACTS                                     │              │
         │                                        │              │
    ┌────┴─────────────────────┐                  │              │
    │                          │                  │              │
  WP-001 ✅               WP-002→004             │              │
  Coordination            Game Skeleton           │              │
  System                  + Registry              │              │
    │                     + Server                │              │
    │                          │                  │              │
    │                    WP-005A→006B             │              │
    │                    Match Setup              │              │
    │                    Player Zones             │              │
    │                    Global Piles             │              │
    │                          │                  │              │
    │                          ▼                  │              │
    │                                             │              │
    │                    Phase 2                   │              │
    │                    TURN ENGINE               │              │
    │                          │                  │              │
    │                    WP-007A→008B             │              │
    │                    Turn Stages              │              │
    │                    Core Moves               │              │
    │                    Stage Gating             │              │
    │                          │                  │              │
    │                          ▼                  │              │
    │                                             │              │
    │                    Phase 3                   │              │
    │                    MVP MULTIPLAYER           │              │
    │                          │                  │              │
    │               ┌──────────┼──────────┐      │              │
    │               │          │          │      │              │
    │          WP-009A/B   WP-010     WP-011→013 │              │
    │          Rule Hooks  Endgame    Lobby Flow  │              │
    │          5 triggers  3 conditions  Match    │              │
    │          4 effects   Loss > Victory Create  │              │
    │               │          │          │      │              │
    │               └──────────┼──────────┘      │              │
    │                          │                  │              │
    │                          ▼                  │              │
    │                                             │              │
    │                    Phase 4                   │              │
    │                    CORE GAMEPLAY             │              │
    │                          │                  │              │
    │          ┌───────┬───────┼───────┬───────┐  │              │
    │          │       │       │       │       │  │              │
    │       WP-014  WP-015  WP-016  WP-018  WP-020              │
    │       Villain  City   Fight   Economy  VP   │              │
    │       Deck     & HQ   Recruit  Attack  Score│              │
    │       Reveal   Zones  Moves   Points   ing  │              │
    │          │       │       │       │       │  │              │
    │          └───────┴───────┼───────┴───────┘  │              │
    │                          │                  │              │
    │                          ▼                  │              │
    │                                             │              │
    │                    Phase 5                   │              │
    │                    CARD MECHANICS            │              │
    │                          │                  │              │
    │          ┌───────────────┼───────────────┐  │              │
    │          │               │               │  │              │
    │       WP-021→023     WP-024          WP-025→026            │
    │       Hero Abilities  Scheme/MM      Board Keywords        │
    │       Hooks→Execute  Ability Exec    Patrol/Ambush         │
    │       Conditional    Twist/Strike    City Modifiers        │
    │          │               │               │  │              │
    │          └───────────────┼───────────────┘  │              │
    │                          │                  │              │
    │                          ▼                  │              │
    │                                             │              │
    │                    Phase 6                   │              │
    │                    PRODUCTION                │              │
    │                          │                  │              │
    │     ┌────────┬───────────┼───────────┬──────┤              │
    │     │        │           │           │      │              │
    │  WP-027   WP-028→029 WP-031→032  WP-033→034              │
    │  Replay   UI State   Hardening   Content   │              │
    │  Verify   Spectator  Network     Version   │              │
    │  Harness  Views      Sync       Migration  │              │
    │     │        │           │           │      │              │
    │     └────────┴───────────┼───────────┘      │              │
    │                          │                  │              │
    │                          ▼                  ▼              │
    │                                                           │
    │                                        Phase 7            │
    │                                        SHIP IT            │
    │                                             │             │
    │                              ┌──────────────┼──────────┐  │
    │                              │              │          │  │
    │                           WP-036        WP-037→038  WP-039→040
    │                           AI Play-      Beta         Metrics
    │                           testing       Strategy     Growth
    │                           Balance       Launch       Governance
    │                           Simulation    Readiness    Change Budget
    │                              │              │          │
    │                              └──────────────┼──────────┘
    │                                             │
    │                                             ▼
    │                                        🎮 LAUNCH
    │
    │
    └── GOVERNANCE LAYER (active throughout)
              │
        ┌─────┼─────────────────────────┐
        │     │                         │
     CLAUDE.md    51 Execution       7 Rules
     (root)       Checklists         Files
        │         (EC-mode active)      │
        │              │                │
        │         EC-TEMPLATE      architecture
        │         EC_INDEX         code-style
        │         01.1 workflow    game-engine
        │         01.2 bug handling registry
        │         01.3 commit hooks server
        │                          persistence
        │                          work-packets
        │
     24 Decisions (DECISIONS.md)
     Immutable architectural constraints
```

---

## Legend

```
✅  Complete
⬜  Pending
→   Dependency (left must complete before right)
│   Contains / groups
```

## Key Numbers

```
Foundation Prompts:    4  (2 complete, 2 pending)
Work Packets:         47  (1 complete, 46 pending)
Execution Checklists: 51  (all tightened, EC-mode active)
Architectural Rules:   7  (.claude/rules/*.md)
Locked Decisions:     24  (DECISIONS.md — immutable)
Card Sets:            40  (validated against R2)
```
