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
        ["WP-048 ✅ PAR Scoring & Leaderboards (2026-04-17, EC-048, commit 2587bbb)"]
        ["WP-067 ✅ UIState PAR + Progress Projection (2026-04-17, EC-068, commit 1d709e5)"]
        ["WP-079 ✅ Label Replay Harness Determinism-Only (2026-04-19, EC-073, commit 1e6de0b)"]
        ["WP-080 ✅ Replay Harness Step-Level API (2026-04-19, EC-072, commit dd0e2fd)"]
        ["WP-034 ⬜ Versioning & Save Migration\n(deps WP-033 ✅ — ready now)"]
        ["WP-035 ⬜ Release & Ops Playbook\n(deps WP-034)"]
        ["WP-042 ⬜ Deployment Checklists\n(deps WP-035)"]

      UI Implementation Chain (Phase 6)
        ["WP-065 ✅ Vue SFC Test Transform\npackages/vue-sfc-loader/\nShipped 2026-04-17 (EC-065, commit bc23913)"]
        ["WP-061 ✅ Gameplay Client Bootstrap\napps/arena-client/ Vue 3 + Pinia + Vite\nShipped 2026-04-17 (EC-067, commit 2e68530)"]
        ["WP-062 ✅ Arena HUD & Scoreboard\nTurn/phase, PAR delta, player panels, EndgameSummary\nShipped 2026-04-18 (EC-069, commit 7eab3dc; merged at 3307b12) — generalized D-6512 to P6-30/40 vue-sfc-loader pattern"]
        ["WP-063 ✅ Replay Snapshot Producer\nEngine helper + apps/replay-producer/ CLI\nShipped 2026-04-19 (EC-071, commit 97560b1) — first cli-producer-app per D-6301"]
        ["WP-064 ✅ Game Log & Replay Inspector\nparseReplayJson + GameLogPanel + ReplayInspector + ReplayFileLoader\nShipped 2026-04-19 (EC-074, commit 76beddc) — locks D-6401 keyboard focus pattern (tabindex=0 + listeners-on-root, first repo stepper precedent)"]

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
        ["Execution Checklists\nWP-backed (EC-001..051, 060s+) + R-EC hygiene + EC-101+ viewer\nDone: EC-FP01, EC-001, EC-048 (WP-048), EC-065 (WP-065), EC-067 (WP-061), EC-068 (WP-067), EC-069 (WP-062), EC-071 (WP-063), EC-072 (WP-080), EC-073 (WP-079), EC-074 (WP-064), EC-103, EC-104, R-EC-02\nDeferred: R-EC-01, R-EC-03\nSee EC_INDEX.md"]
        ["7 Rule Files\n(.claude/rules/)"]
        ["Immutable Decisions\nDECISIONS.md\nNew: D-4801..4806 PAR scoring spec set, D-6301 cli-producer-app category, D-6303 version-bump policy, D-6305 ReplayInputsFile naming, D-6401 keyboard focus pattern, D-6512/P6-30 vue-sfc-loader defineComponent rule, D-6701 PAR safe-skip"]
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
| Phase 6 | WP-027..035, 042, 048, 067, 079, 080 | 11/14 | ⬜ WP-034, 035, 042 |
| UI Chain | WP-061..065 | 5/5 | ✅ all (WP-061, 062, 063, 064, 065) |
| Phase 7 | WP-036..041, 049..051 | 0/9 | ⬜ |
| Pre-Plan | WP-056..058 | 0/3 | ⬜ (parallel-safe) |
| **Total** | | **57/74** | **17** |

**Next unblocked (dependencies met, no active work):**
- **WP-034** — Versioning & Save Migration (deps WP-033 ✅); continues WP-030→31→32→33 ops-chain momentum.
- **WP-055** / **WP-060** — content / data, parallel-safe with any engine work.
- **WP-056** — Pre-Plan State Model & Lifecycle (parallel-safe with Phase 4+).

**Ops chain path:** `WP-034 → WP-035 → WP-042` is the next sequenced workstream (versioning → release/ops playbook → deployment checklists). UI Chain is now **5/5 complete** — both the scoring side (WP-048 → WP-067 → WP-062) and the replay side (WP-079 → WP-080 → WP-063 → WP-064) landed.

*Last updated: 2026-04-19 (correction pass — discovered three WPs were stale-marked ⬜ in the prior 2026-04-19 update despite WORK_INDEX showing them ✅: **WP-048** ✅ at commit `2587bbb` under EC-048 (2026-04-17), **WP-067** ✅ at commit `1d709e5` under EC-068 (2026-04-17), **WP-062** ✅ at commit `7eab3dc` under EC-069 (2026-04-18, merged at `3307b12`). Root cause: prior update worked from a stale 2026-04-17 footer + an untracked pre-execution `session-context-wp048.md` file rather than re-checking WORK_INDEX `[x]` lines. Phase 6 row now 11/14, UI Chain 5/5 (was 4/5), Total 54/74 → 57/74. "Next unblocked" reduced — WP-048/067/062 removed; WP-034 the next ops-chain item. Prior 2026-04-19 history preserved: WP-079 ✅ at `1e6de0b` under EC-073, WP-080 ✅ at `dd0e2fd` under EC-072, WP-063 ✅ at `97560b1` under EC-071, WP-064 ✅ at `76beddc` under EC-074 with new D-6401 keyboard focus pattern. New precedent-log entries P6-43–P6-49 live in `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`.)*
