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

      Phase 4 -- Core Gameplay Loop ✅
        ["WP-014A/B ✅\nVillain Deck & Reveal"]
        ["WP-015 ✅\nCity & HQ Zones"]
        ["WP-016 ✅\nFight & Recruit"]
        ["WP-017 ✅\nKO, Wounds, Bystanders"]
        ["WP-018 ✅\nAttack/Recruit Economy"]
        ["WP-019 ✅\nMastermind & Tactics"]
        ["WP-020 ✅\nVP Scoring & Win Summary"]

      Content Layer
        ["WP-055 ⬜\nTheme Data Model"]
        ["WP-060 ⬜\nKeyword & Rule Glossary"]

      Phase 5 -- Card Mechanics ✅
        ["WP-021 ✅ Hero Hooks"]
        ["WP-022 ✅ Hero Keywords"]
        ["WP-023 ✅ Conditional Effects"]
        ["WP-024 ✅ Scheme/Mastermind Exec"]
        ["WP-025 ✅ Board Keywords"]
        ["WP-026 ✅ Scheme Setup"]

      Phase 6 -- Verification & Production
        ["WP-027..035, 042 ⬜\nReplay / UI / Hardening\nVersioning / Ops (10)"]
        ["WP-048 ⬜\nPAR Scoring & Leaderboards"]

      UI Implementation Chain (Phase 6)
        ["WP-065 ⬜\nVue SFC Test Transform\npackages/vue-sfc-loader/\n(prerequisite for all UI test packets)"]
        ["WP-061 ⬜\nGameplay Client Bootstrap\napps/arena-client/ skeleton"]
        ["WP-062 ⬜\nArena HUD & Scoreboard\nTurn/phase, PAR delta, panels"]
        ["WP-063 ⬜\nReplay Snapshot Producer\nEngine helper + CLI app"]
        ["WP-064 ⬜\nGame Log & Replay Inspector\nLog panel + step/scrub"]

      Phase 7 -- Beta, Launch & PAR
        ["WP-036..041 ⬜\nAI Testing / Beta\nLaunch / Live Ops (6)"]
        ["WP-049 ⬜\nPAR Simulation Engine"]
        ["WP-050 ⬜\nPAR Artifact Storage"]
        ["WP-051 ⬜\nPAR Server Gate"]

      Scoring & PAR Pipeline
        ["12-SCORING-REFERENCE.md\nFormula & Invariants"]
        ["12.1-PAR-ARTIFACT-INTEGRITY.md\nHashing Trust Model"]
        ["WP-048 → 049 → 050 → 051\nSimulation → Storage → Gate"]

      Registry Viewer
        ["cards.barefootbetters.com\nCard + Theme browser"]
        ["Keyword/Rule tooltips\n102 keywords, 18 rules"]
        ["Hero class tooltips\n5 superpower descriptions"]

      Governance
        [".claude/CLAUDE.md\nRoot coordination"]
        ["56 Execution Checklists\n2 Done, 54 Draft"]
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
| Phase 4 | WP-014A/B..020 | 8/8 | -- |
| Content | WP-055, 060 | 0/2 | ⬜ |
| Phase 5 | WP-021..026 | 6/6 | -- |
| Phase 6 | WP-027..035, 042, 048 | 0/11 | ⬜ |
| UI Chain | WP-061..065 | 0/5 | ⬜ (lint-gate passed 2026-04-16) |
| Phase 7 | WP-036..041, 049..051 | 0/9 | ⬜ |
| **Total** | | **41/66** | **25** |

**Next unblocked:** WP-027 (Replay Determinism Proof), WP-055, WP-060, WP-065 (Vue SFC Test Transform — no deps). The UI Implementation Chain (WP-065 → WP-061 → WP-062 / WP-063 → WP-064) waits on WP-028 (UIState), which in turn waits on WP-027. WP-065 itself has no dependencies and can be executed immediately.

*Last updated: 2026-04-16 (UI Implementation Chain drafted + lint-gate passed: WP-061 Gameplay Client Bootstrap, WP-062 Arena HUD, WP-063 Replay Snapshot Producer, WP-064 Game Log & Replay Inspector, WP-065 Vue SFC Test Transform Pipeline — all Ready; WP-065 is the hard prerequisite that makes `node:test` compatible with `.vue` SFCs)*
