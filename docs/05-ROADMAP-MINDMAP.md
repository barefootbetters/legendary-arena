# Legendary Arena -- Development Roadmap (Mindmap)

```mermaid
mindmap
  root((Legendary Arena))
    ["Multiplayer Deck-Builder\nboardgame.io + TypeScript + R2"]

      Foundation
        ["FP-00.4 ✅\nEnvironment Check"]
        ["FP-00.5 ✅\nR2 Validation"]
        ["FP-01 ✅\nRender.com Backend"]
        ["FP-02 ✅\nDatabase Migrations"]

      Phase 0 -- Coordination ✅
        ["WP-001 ✅\nCoordination System"]
        ["WP-002 ✅\nGame Skeleton"]
        ["WP-003 ✅\nCard Registry"]
        ["WP-004 ✅\nServer Bootstrap"]
        ["WP-043..047 ✅\nGovernance Alignment (5)"]

      Phase 1 -- Game Setup ✅
        ["WP-005A/B ✅\nMatch Setup & Determinism"]
        ["WP-006A/B ✅\nPlayer Zones & Global Piles"]

      Phase 2 -- Core Turn Engine ✅
        ["WP-007A/B ✅\nTurn Structure & Loop"]
        ["WP-008A ✅\nCore Moves Contracts"]
        ["WP-008B ✅\nCore Moves Implementation"]

      Phase 3 -- MVP Multiplayer ✅
        ["WP-009A/B ✅\nRule Hooks & Execution"]
        ["WP-010 ✅\nVictory & Loss"]
        ["WP-011 ✅\nLobby Flow"]
        ["WP-012 ✅\nMatch List & Join"]
        ["WP-013 ✅\nPersistence Boundaries"]

      Phase 4 -- Core Gameplay Loop
        ["WP-014..020 ⬜\nVillain / City / Fight\nEconomy / VP (7)"]

      Phase 5 -- Card Mechanics
        ["WP-021..026 ⬜\nHero / Scheme / Mastermind\nAbilities & Keywords (6)"]

      Phase 6 -- Verification & Production
        ["WP-027..035, 042 ⬜\nReplay / UI / Hardening\nVersioning / Ops (10)"]
        ["WP-048 ⬜\nPAR Scoring & Leaderboards"]

      Phase 7 -- Beta, Launch & PAR
        ["WP-036..041 ⬜\nAI Testing / Beta\nLaunch / Live Ops (6)"]
        ["WP-049 ⬜\nPAR Simulation Engine"]
        ["WP-050 ⬜\nPAR Artifact Storage"]
        ["WP-051 ⬜\nPAR Server Gate"]

      Scoring & PAR Pipeline
        ["12-SCORING-REFERENCE.md\nFormula & Invariants"]
        ["12.1-PAR-ARTIFACT-INTEGRITY.md\nHashing Trust Model"]
        ["WP-048 → 049 → 050 → 051\nSimulation → Storage → Gate"]

      Governance
        [".claude/CLAUDE.md\nRoot coordination"]
        ["55 Execution Checklists\n1 Done, 54 Draft"]
        ["7 Rule Files\n(.claude/rules/)"]
        ["Immutable Decisions\nDECISIONS.md"]
        ["Phase 3 Gate\nClosed (D-1320)"]
```

## Progress Summary

| Phase | Packets | Done | Remaining |
|-------|---------|------|-----------|
| Foundation | FP-00.4, 00.5, 01, 02 | 4/4 | -- |
| Phase 0 | WP-001..004, 043..047 | 9/9 | -- |
| Phase 1 | WP-005A/B, 006A/B | 4/4 | -- |
| Phase 2 | WP-007A/B, 008A/B | 4/4 | -- |
| Phase 3 | WP-009A/B, 010..013 | 6/6 | -- |
| Phase 4 | WP-014..020 | 0/7 | ⬜ |
| Phase 5 | WP-021..026 | 0/6 | ⬜ |
| Phase 6 | WP-027..035, 042, 048 | 0/11 | ⬜ |
| Phase 7 | WP-036..041, 049..051 | 0/9 | ⬜ |
| **Total** | | **27/56** | **29** |

**Next unblocked:** WP-014 (Villain Deck & Reveal Pipeline)

*Last updated: 2026-04-11 (Phase 3 complete, Phase 4 approved)*
