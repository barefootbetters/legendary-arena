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
        ["WP-055 ✅\nTheme Data Model\nShipped 2026-04-20 (EC-055, commit dc7010e)"]
        ["WP-060 ⬜\nKeyword & Rule Glossary"]

      Pre-Planning System (parallel-safe with Phase 4+)
        ["WP-056 ✅\nState Model & Lifecycle (types-only core)\npackages/preplan/\nShipped 2026-04-20 (EC-056, commit eade2d0) — D-5601 new `preplan` code category; RS-2 zero-test lock"]
        ["WP-057 ⬜\nSandbox Execution\nClient-local PRNG + sandbox creation + speculative operations"]
        ["WP-058 ⬜\nDisruption Pipeline\nDetection + invalidation + rewind + notification"]
        ["WP-059 ⏸ Deferred\nUI Integration\n(blocked on WP-028 and UI framework decision)"]

      Post-Phase-6 Hygiene (Landed 2026-04-20)
        ["WP-081 ✅\nRegistry Build Pipeline Cleanup\nSubtractive — delete 3 broken scripts + trim package.json/ci.yml/README/03-DATA-PIPELINE.md\nShipped 2026-04-20 (EC-081, execution commit ea5cfdd; PS-2 9fae043; PS-3 aab002f; close 61ceb71; post-mortem ba48982; PRE-COMMIT-REVIEW d6911e8) — D-8101 + D-8102; first green `pnpm --filter @legendary-arena/registry build` since WP-003; engine 436/109/0 UNCHANGED; repo-wide 536/0 UNCHANGED"]

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
        ["Immutable Decisions\nDECISIONS.md\nNew: D-4801..4806 PAR scoring spec set, D-6301 cli-producer-app category, D-6303 version-bump policy, D-6305 ReplayInputsFile naming, D-6401 keyboard focus pattern, D-6512/P6-30 vue-sfc-loader defineComponent rule, D-6701 PAR safe-skip, D-3401 versioning code category, D-3501..D-3504 ops playbook, D-4201..D-4203 deployment-checklist scope + form-(2)/form-(1) invariants, D-5601 preplan code category, D-8101 registry-pipeline delete-not-rewrite, D-8102 single-CI-validate-step"]
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
| Content | WP-055, 060 | **1/2** | ⬜ WP-060 |
| Phase 5 | WP-021..026 | 6/6 | -- |
| Phase 6 | WP-027..035, 042, 048, 067, 079, 080 | **14/14** ✅ | — (tagged `phase-6-complete` at `c376467`) |
| UI Chain | WP-061..065 | 5/5 | ✅ all (WP-061, 062, 063, 064, 065) |
| Phase 7 | WP-036..041, 049..051 | 0/9 | ⬜ |
| Pre-Plan | WP-056..058 | **1/3** | ⬜ WP-057, WP-058 (WP-059 deferred; parallel-safe) |
| Post-Phase-6 Hygiene | WP-081 | **1/1** | — (landed 2026-04-20) |
| Carry-forward | WP-042.1, WP-066 | 0/2 | ⏸ WP-042.1 blocked on FP-03 revival per D-4201; ⬜ WP-066 standalone registry-viewer feature (not yet reviewed) |
| **Total** | | **63/76** | **13** (plus 2 carry-forward) |

**Phase 6 closed on 2026-04-19 — tag `phase-6-complete` at `c376467`.** Engine baseline 436/109/0; repo-wide 536/0 (post-WP-055 test count; was 526/0 at Phase 6 close).

**Next unblocked (dependencies met, no active work):**
- **Phase 7 entry (main sequence):** WP-036 (AI Playtesting) → WP-037..041; WP-049..051 (PAR Simulation/Storage/Gate).
- **WP-060** — keyword & rule glossary, parallel-safe with any engine work.
- **WP-057** — Pre-Plan Sandbox Execution (unblocked by WP-056 landing 2026-04-20).
- **WP-058** — Pre-Plan Disruption Pipeline (after WP-057).
- **Carry-forward backlog:** WP-042.1 (unblocks when Foundation Prompt 03 is revived), WP-066 (independent UI feature).
- **Known OOS follow-up (not yet a WP):** trim `packages/registry/.env.example` lines 13-17 + clean `upload-r2.ts` stale docstring and closing `console.log` references — explicitly OOS per WP-081 §Scope (Out); harmless at runtime but misleading. Can be bundled as a single operator-tooling cleanup WP.

**Ops chain closed:** `WP-034 → WP-035 → WP-042` landed sequentially on 2026-04-19 (`5139817` → `d5935b5` → `c964cf4`) and the phase was governance-closed at `c376467`. Both the scoring side (WP-048 → WP-067 → WP-062) and the replay side (WP-079 → WP-080 → WP-063 → WP-064) also landed. **All three Phase 6 sub-chains shipped within 24 hours on 2026-04-19.**

**Post-Phase-6 delivery (2026-04-20):** three more WPs landed on the governance trunk after the `phase-6-complete` tag — WP-055 (content), WP-056 (pre-planning types), WP-081 (registry build hygiene) — all without reopening Phase 6. Engine baseline held at 436/109/0 through all three; repo-wide went 526 → 536 on WP-055 (ten new theme-schema tests) and held at 536 through WP-056 and WP-081 (both zero-test).

*Last updated: 2026-04-20 (**Post-Phase-6 content + pre-planning + hygiene pass** — three WPs landed 2026-04-20 on the governance-trunk branch chain: WP-055 content, WP-056 pre-planning types-only core, WP-081 build-hygiene. **WP-055** ✅ at `dc7010e` under EC-055 — `ThemeDefinitionSchema` + sub-schemas; 10 new theme-schema tests; registry 3→13, repo-wide 526→536. **WP-056** ✅ at `eade2d0` under EC-056 — new `packages/preplan/` package (types-only core: `PrePlan` + `PrePlanSandboxState` + `RevealRecord` + `PrePlanStep`); D-5601 new `preplan` code category; RS-2 zero-test lock; engine consumed via `import type` only; 536/0 UNCHANGED. **WP-081** ✅ at `ea5cfdd` under EC-081 — subtractive cleanup: 3 deletions + 4 modifications (`package.json`, `ci.yml`, `docs/03-DATA-PIPELINE.md`, `README.md`); D-8101 delete-not-rewrite + D-8102 single-CI-validate-step; first green `pnpm --filter @legendary-arena/registry build` since WP-003; 01.6 post-mortem (verdict WP COMPLETE) + PRE-COMMIT-REVIEW retrospective artifact (verdict Safe to commit as-is); 536/0 UNCHANGED. Pre-Plan row bumped 0/3 → 1/3. Content row bumped 0/2 → 1/2. New row "Post-Phase-6 Hygiene" 1/1 added. Total 60/74 → 63/76. Phase 6 tag `phase-6-complete` at `c376467` still stands — post-tag work is hygiene + Phase 7 entry, does not retroactively reopen Phase 6. Prior 2026-04-19 Phase 6 closure history preserved: ops chain WP-034 → WP-035 → WP-042, replay sub-chain WP-027 → WP-079 → WP-080 → WP-063 → WP-064, scoring side WP-048 → WP-067 → WP-062. Precedent-log entries through P6-51 live in `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`.)*
