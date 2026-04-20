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

      Phase 6 ✅ Verification & Production (tagged phase-6-complete at c376467, 2026-04-19)
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
        ["WP-034 ✅ Versioning & Save Migration\n(2026-04-19, EC-034, commit 5139817)"]
        ["WP-035 ✅ Release & Ops Playbook\n(2026-04-19, EC-035, commit d5935b5)"]
        ["WP-042 ✅ Deployment Checklists\n(2026-04-19, EC-042, commit c964cf4 — scope-reduced per D-4201)"]
        ["WP-042.1 ⏸ Deferred PostgreSQL Seeding Sections\n(blocked on FP-03 revival per D-4201)"]
        ["WP-066 ⬜ Registry Viewer Image-to-Data Toggle (not yet reviewed)"]

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
        ["Immutable Decisions\nDECISIONS.md\nNew: D-4801..4806 PAR scoring spec set, D-6301 cli-producer-app category, D-6303 version-bump policy, D-6305 ReplayInputsFile naming, D-6401 keyboard focus pattern, D-6512/P6-30 vue-sfc-loader defineComponent rule, D-6701 PAR safe-skip, D-3401 versioning code category, D-3501..D-3504 ops playbook, D-4201..D-4203 deployment-checklist scope + form-(2)/form-(1) invariants"]
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
| Phase 6 | WP-027..035, 042, 048, 067, 079, 080 | **14/14** ✅ | — (tagged `phase-6-complete` at `c376467`) |
| UI Chain | WP-061..065 | 5/5 | ✅ all (WP-061, 062, 063, 064, 065) |
| Phase 7 | WP-036..041, 049..051 | 0/9 | ⬜ |
| Pre-Plan | WP-056..058 | 0/3 | ⬜ (parallel-safe) |
| Carry-forward | WP-042.1, WP-066 | 0/2 | ⏸ WP-042.1 blocked on FP-03 revival per D-4201; ⬜ WP-066 standalone registry-viewer feature (not yet reviewed) |
| **Total** | | **60/74** | **14** (plus 2 carry-forward) |

**Phase 6 closed on 2026-04-19 — tag `phase-6-complete` at `c376467`.** Engine baseline 436/109/0; repo-wide 526/0.

**Next unblocked (dependencies met, no active work):**
- **Phase 7 entry (main sequence):** WP-036 (AI Playtesting) → WP-037..041; WP-049..051 (PAR Simulation/Storage/Gate).
- **WP-055** / **WP-060** — content / data, parallel-safe with any engine work.
- **WP-056** — Pre-Plan State Model & Lifecycle (parallel-safe with Phase 4+).
- **Carry-forward backlog:** WP-042.1 (unblocks when Foundation Prompt 03 is revived), WP-066 (independent UI feature).

**Ops chain closed:** `WP-034 → WP-035 → WP-042` landed sequentially on 2026-04-19 (`5139817` → `d5935b5` → `c964cf4`) and the phase was governance-closed at `c376467`. Both the scoring side (WP-048 → WP-067 → WP-062) and the replay side (WP-079 → WP-080 → WP-063 → WP-064) also landed. **All three Phase 6 sub-chains shipped within 24 hours on 2026-04-19.**

*Last updated: 2026-04-19 (**Phase 6 closure pass** — ops chain WP-034 → WP-035 → WP-042 all landed 2026-04-19, phase tagged `phase-6-complete` at `c376467`. **WP-034** ✅ at `5139817` under EC-034 — `packages/game-engine/src/versioning/` subtree (D-3401); engine 427→436. **WP-035** ✅ at `d5935b5` under EC-035 — `packages/game-engine/src/ops/` types + `docs/ops/` playbook (D-3501..D-3504). **WP-042** ✅ at `c964cf4` under EC-042 — `docs/ai/deployment/` R2 + PostgreSQL checklists scope-reduced per **D-4201**; new **D-4202** (UI-rendering-layer exclusion back-pointer) + **D-4203** (Documentation-class invariant). Phase 6 row 11/14 → 14/14; Total 57/74 → 60/74; Carry-forward row added for WP-042.1 (deferred per D-4201) + WP-066 (unreviewed). Prior 2026-04-19 replay-sub-chain history preserved: WP-079 ✅ at `1e6de0b` under EC-073, WP-080 ✅ at `dd0e2fd` under EC-072, WP-063 ✅ at `97560b1` under EC-071, WP-064 ✅ at `76beddc` under EC-074 with D-6401 keyboard focus pattern. Prior correction-pass history preserved: WP-048 ✅ at `2587bbb` under EC-048 (2026-04-17), WP-067 ✅ at `1d709e5` under EC-068 (2026-04-17), WP-062 ✅ at `7eab3dc` under EC-069 (2026-04-18, merged at `3307b12`). Precedent-log entries through P6-51 live in `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`.)*
