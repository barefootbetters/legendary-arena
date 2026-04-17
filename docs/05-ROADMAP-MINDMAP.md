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
        ["WP-027 ✅ Replay Harness (2026-04-14)"]
        ["WP-028 ✅ UIState Contract (2026-04-14)"]
        ["WP-029 ✅ Spectator & Permissions (2026-04-14)"]
        ["WP-030 ✅ Campaign Framework (2026-04-14)"]
        ["WP-031 ✅ Production Hardening (2026-04-15)"]
        ["WP-032 ✅ Network Sync (2026-04-15)"]
        ["WP-033 ✅ Content Authoring Toolkit (2026-04-16)"]
        ["WP-034 ⬜ Versioning & Save Migration\n(deps WP-033 ✅ — ready now)"]
        ["WP-035 ⬜ Release & Ops Playbook\n(deps WP-034)"]
        ["WP-042 ⬜ Deployment Checklists\n(deps WP-035)"]
        ["WP-048 ⬜ PAR Scoring & Leaderboards\n(deps WP-020/027/030 ✅ — ready; gates WP-067)"]
        ["WP-067 ⬜ UIState PAR + Progress Projection\n(deps WP-028 ✅ / WP-048 ⬜; EC-068; drafted + lint-reviewed 2026-04-17; gates WP-062)"]

      UI Implementation Chain (Phase 6)
        ["WP-065 ✅ Vue SFC Test Transform\npackages/vue-sfc-loader/\nShipped 2026-04-17 (EC-065, commit bc23913)"]
        ["WP-061 ✅ Gameplay Client Bootstrap\napps/arena-client/ Vue 3 + Pinia + Vite\nShipped 2026-04-17 (EC-067, commit 2e68530)"]
        ["WP-062 ⬜ Arena HUD & Scoreboard\nTurn/phase, PAR delta, panels\n(blocked on WP-067 + base.css allowlist)"]
        ["WP-063 ⬜ Replay Snapshot Producer\nEngine helper + CLI app\n(parallel-safe with WP-067)"]
        ["WP-064 ⬜ Game Log & Replay Inspector\nLog panel + step/scrub\n(deps WP-061 ✅ + WP-063)"]

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
        ["Execution Checklists\nWP-backed (EC-001..051, 060s+) + R-EC hygiene + EC-101+ viewer\nDone: EC-FP01, EC-001, EC-065 (WP-065), EC-067 (WP-061), EC-103, EC-104, R-EC-02\nDraft: EC-068 (WP-067, lint-reviewed 2026-04-17)\nDeferred: R-EC-01, R-EC-03\nSee EC_INDEX.md"]
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
| Phase 6 | WP-027..035, 042, 048, 067 | 7/12 | ⬜ WP-034, 035, 042, 048, 067 |
| UI Chain | WP-061..065 | 2/5 | ✅ WP-061, 065 (2026-04-17); ⬜ WP-062, 063, 064 |
| Phase 7 | WP-036..041, 049..051 | 0/9 | ⬜ |
| Pre-Plan | WP-056..058 | 0/3 | ⬜ (parallel-safe) |
| **Total** | | **50/72** | **22** |

**Next unblocked (dependencies met, no active work):**
- **WP-048** — PAR Scoring & Leaderboards (deps WP-020 / 027 / 030 ✅); **now the gating item for the UI chain's scoring side** — unblocks WP-067 → WP-062. Also unblocks WP-049 / 053 / 054 for Phase 7.
- **WP-034** — Versioning & Save Migration (deps WP-033 ✅); continues WP-030→31→32→33 ops-chain momentum; independent of UI chain.
- **WP-063** — Replay Snapshot Producer (deps WP-027 / 028 / 005B ✅); parallel-safe with WP-067; part of the WP-064 chain.
- **WP-055** / **WP-060** — content / data, parallel-safe with any engine work.
- **WP-056** — Pre-Plan State Model & Lifecycle (parallel-safe with Phase 4+).

**Sequenced UI-chain path:** `WP-048 → WP-067 → WP-062` (scoring side) and `WP-063 → WP-064` (replay side). WP-061 ✅ and WP-065 ✅ have already landed and no longer gate parallel work.

*Last updated: 2026-04-17 (WP-027..033 flipped to complete — all landed between 2026-04-14 and 2026-04-16; WP-065 shipped 2026-04-17 at commit `bc23913` under EC-065; WP-061 shipped 2026-04-17 at commit `2e68530` under EC-067 — note retargeted EC slot, EC-061 historically bound to registry-viewer Rules Glossary; WP-067 drafted + lint-gate reviewed 2026-04-17 under EC-068 as the intermediate engine WP bridging WP-048 into the UIState surface that WP-062 consumes; Phase 6 row updated to include WP-067; UI Chain row flipped to 2/5 complete; Total 48/71 → 50/72 reflects the new WP-067 row plus two completions; "Next unblocked" rewritten — WP-048 now the gating scoring item since WP-065 / WP-061 landed; sequenced UI-chain path added. New precedent-log entries P6-30 / P6-31 / P6-32 live in `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`.)*
