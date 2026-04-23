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
        ["WP-060 ✅\nKeyword & Rule Glossary R2 Migration\nShipped 2026-04-21 (EC-106, commit 412a31c) — moves keyword + rule glossary from hardcoded useRules maps to R2; retargets useRules + useGlossary; non-blocking fetch with console.warn + empty-Map fallback; 123 keywords + 20 rules after the migration"]

      Pre-Planning System (parallel-safe with Phase 4+)
        ["WP-056 ✅\nState Model & Lifecycle (types-only core)\npackages/preplan/\nShipped 2026-04-20 (EC-056, execution eade2d0; governance close cff16e1; 01.6 template-gap-closure addendum 5bce4a2) — D-5601 new `preplan` code category; RS-2 zero-test lock; §1 Binary Health verified + §7 Test Adequacy N/A per Skip Rule + §9 Forward-Safety all YES"]
        ["WP-057 ✅\nSandbox Execution (first runtime consumer of WP-056 types)\npackages/preplan/\nShipped 2026-04-20 (EC-057, pre-flight bundle f12c796; execution 8a324f0; governance close 7414656) — client-local Fisher-Yates PRNG (speculativePrng.ts), sandbox creation (preplanSandbox.ts), five speculative operations (speculativeOperations.ts), and PREPLAN_STATUS_VALUES canonical readonly array + drift-detection (preplanStatus.ts) deferred from WP-056; full-spread aliasing discipline (WP-028 precedent) on every return; uniform null-on-inactive contract for all five operations; preplan 0/0/0 → 23/4/0; 01.6 post-mortem at docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md"]
        ["WP-058 ✅\nDisruption Pipeline (Detect → Invalidate → Rewind → Notify)\npackages/preplan/\nShipped 2026-04-20 (EC-058, pre-flight bundle 29c66d2; execution bae70e7; governance close 00687c5; A-058-01..05 amendments) — isPrePlanDisrupted + invalidatePrePlan + computeSourceRestoration + buildDisruptionNotification + executeDisruptionPipeline across disruption.types.ts + disruptionDetection.ts + disruptionPipeline.ts; PREPLAN_EFFECT_TYPES canonical readonly array + compile-time drift-check (preplanEffectTypes.ts) deferred from WP-056; first implementation of DESIGN-CONSTRAINT #3 ledger-sole rewind authority; first-mutation-wins status guard; full-spread 42/42 aliasing discipline on invalidation; preplan 23/4/0 → 52/7/0; 01.6 post-mortem at docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md"]
        ["WP-059 ⏸ Deferred\nUI Integration\n(blocked on WP-028 and UI framework decision)"]

      Post-Phase-6 Hygiene (Landed 2026-04-20..22)
        ["WP-081 ✅\nRegistry Build Pipeline Cleanup\nSubtractive — delete 3 broken scripts + trim package.json/ci.yml/README/03-DATA-PIPELINE.md\nShipped 2026-04-20 (EC-081, execution commit ea5cfdd; PS-2 9fae043; PS-3 aab002f; close 61ceb71; post-mortem ba48982; PRE-COMMIT-REVIEW d6911e8) — D-8101 + D-8102; first green `pnpm --filter @legendary-arena/registry build` since WP-003; engine 436/109/0 UNCHANGED; repo-wide 536/0 UNCHANGED"]
        ["WP-085 ✅\nVision Alignment Audit (Detection, Classification & Gating)\nShipped 2026-04-22 (EC-085, execution c836b29; session prompt a3e67bb; governance close — STATUS.md + WORK_INDEX.md + EC_INDEX.md + DECISIONS.md D-8502/8503/8504) — audit-tooling bundle; no engine modifications, no gameplay logic, no runtime behavior. scripts/audit/vision/run-all.mjs orchestrator combining four domain greps (determinism, monetization, registry, engine-boundary) into one PASS/FAIL verdict + dated combined report under docs/audits/; two-channel DET-001 model (script-channel executable count post comment-aware filter + orchestrator-channel allowlist verification against six packages/game-engine/src/ doc-comment file:line pairs); DET-007 single-channel with four-pair allowlist diff; same-day re-run refusal (audit-history immutability); calibrated baseline 6 DET-001 / 4 DET-007 / 0 / 0 / 0 at INFRA 24996a9 consumed as locked acceptance contract (any deviation = FAIL; re-calibration requires superseding WP per AC-6); scripts/audit/vision/determinism.greps.mjs adds isDocCommentLine(rawLine) helper + DET-001-only filter; first audit report docs/audits/vision-alignment-2026-04-22.md VERDICT PASS at 604eaaa; §17 Vision Alignment now enforced by executable orchestrator (supersedes D-8501 pre-execution queued-instrument framing for operational assertions while D-8501 remains immutable historical record)"]
        ["WP-082 ✅\nGlossary Schema, Labels, and Rulebook Deep-Links\nShipped 2026-04-21 (EC-107, commit 752fcca; close 0acdf3c) — KeywordGlossary{Entry,}Schema + RuleGlossary{Entry,}Schema in packages/registry/src/schema.ts (first `.strict()` use); adds required `label` + optional `pdfPage` to 123 keywords and 20 rules; uploads Marvel Legendary Universal Rules v23 (hyperlinks).pdf (44 MB) to R2 at version-pinned URL; adds rulebookPdfUrl to viewer config; glossaryClient retrofitted to `.safeParse(...)` at fetch boundary with `[Glossary] Rejected …` warning + empty-Map fallback; deletes `titleCase()` heuristic + introduces explicit HERO_CLASS_LABELS; D-8201..D-8206 + A-082-01 (`./schema` subpath export); 596/0 baseline"]
        ["EC-110 ✅\nValidate Registry CI Path Fix (ad-hoc INFRA, not a WP)\nShipped 2026-04-21 (commit 4e53e9f) — validate.ts resolves defaults via fileURLToPath(import.meta.url); env overrides win; HEALTH_OUT intentionally CWD-relative. Surfaced two data defects (msp1 sentinel ids; shld stringified attack/recruit) repaired upstream."]
        ["WP-084 ✅\nDelete Unused Auxiliary Metadata Schemas and Files\nShipped 2026-04-21 (EC-109, commit b250bf1; close 4cc9ded; A-084-01 SPEC amendment) — subtractive: five auxiliary Zod schemas (CardType/HeroClass/HeroTeam/Icon/Leads) + five data/metadata/*.json + card-types-old.json + Phase-2 validate block deleted; viewer dead-code localRegistry drifted duplicate deleted; 00.2-data-requirements rewritten; current-state docs sweep; legacy Validate-R2-old.ps1 deleted; D-8401..D-8407 + D-6002 historical-neighbor note; 596/0 baseline preserved"]
        ["WP-083 ✅\nFetch-Time Schema Validation (Viewer Config + Themes)\nShipped 2026-04-21 (EC-108, commit 601d6fc; close 7f054e1; A-083-01..04 SPEC amendments) — adds ViewerConfigSchema (.strict()) + ThemeIndexSchema + inferred types; registryClient + themeClient retrofitted to `.safeParse(...)` with first-Zod-issue rendering; `[RegistryConfig] Rejected …` throws; `[Themes] Rejected …` throws on index / warns+skips on individual themes per D-8303 severity; four inline TS interfaces deleted; A-083-04 adds `./theme.schema` subpath export (D-8305 locks precedent); D-8301..D-8305; theme.schema.ts + theme.validate.ts untouched; 596/0 baseline preserved; 69 shipped themes validate"]

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
        ["WP-036 ✅\nAI Playtesting & Balance Simulation\nShipped 2026-04-21 (EC-036, execution 539b543; close 61df4c0; A-036-02 amendment) — D-3601 simulation code category + D-3602 same-pipeline-as-humans + D-3603 random-policy MVP baseline + D-3604 two-independent-PRNG-domain seed reproducibility"]
        ["WP-037 ✅\nPublic Beta Strategy\nShipped 2026-04-22 (EC-037, execution 160d9b9; A0 SPEC bundle a4f5574 pre-landed D-3701 + 02-CODE-CATEGORIES.md update) — new packages/game-engine/src/beta/ subdirectory (D-3701 engine code category, 10th instance) exporting BetaFeedback (6 required + 1 optional fields) + BetaCohort (closed 3-member literal union: expert-tabletop / general-strategy / passive-observer) + FeedbackCategory (closed 5-member literal union: rules / ui / balance / performance / confusion) — all pure type contracts, never persisted in G; docs/beta/BETA_STRATEGY.md (8 sections: objectives, scope, cohorts, access control, feedback collection model, timeline, exit summary, related docs) + docs/beta/BETA_EXIT_CRITERIA.md (4 binary pass/fail categories: rules correctness, UX clarity, balance perception, stability — every criterion cites a specific source signal); D-3702 invitation-only signal-quality + D-3703 three cohorts by expertise/role + D-3704 beta uses the same release gates as production; engine 436→444 (+8) / suites 109→110 (+1); repo-wide 588→596"]
        ["WP-038 ✅\nLaunch Readiness & Go-Live Checklist\nShipped 2026-04-22 (EC-038, execution 2134f33; governance close d4fe447) — documentation-only, no engine modifications. docs/ops/LAUNCH_READINESS.md: 17 binary pass/fail readiness gates across 4 categories (Engine & Determinism 4, Content & Balance 4 + warning-acceptance discipline requiring non-invariant + non-competitive + non-exploitable classification, Beta Exit Criteria 4 consumed from BETA_EXIT_CRITERIA.md per D-3803, Ops & Deployment 5); single launch authority model with 3 non-override clauses (MAY NOT waive failing gates; MAY ONLY decide once all gates pass; exists to prevent deadlock, not to override invariants) + 4 required sign-offs (engine integrity, replay determinism, content safety, operations readiness); GO/NO-GO decision record schema; boolean aggregation rule (any false short-circuits launch verdict). docs/ops/LAUNCH_DAY.md: T-1h Final Build Verification → T-0 Soft Launch with explicit PAUSE-vs-ROLLBACK distinction → Go-Live Signal (first clean session + replay-matches-live + zero critical alerts) → T+0 to T+72h Post-Launch Guardrails (72h change freeze + bugfix criteria deterministic + backward compatible + roll-forward safe + Freeze Exception Record's 5 required fields: triggering condition, proof of determinism, proof of backward compatibility, roll-forward safety analysis, launch authority approval timestamp + 4 rollback triggers verbatim: invariant violation spike, replay hash divergence, migration failure, client desync). D-3801 single-launch-authority + D-3802 72h-stability-observation-window + D-3803 launch-gates-inherit-from-beta-exit-gates. Three-commit topology: A0 SPEC pre-flight bundle (9ecbe70) → A EC-038 content + 01.6 post-mortem (2134f33) → B SPEC governance close (d4fe447). Engine 444/110/0 + repo-wide 596/0 UNCHANGED through both commits (zero new tests)."]
        ["WP-039..041 ⬜\nPost-Launch Metrics / Live Ops / Architecture Audit (3)"]
        ["WP-049 ⬜\nPAR Simulation Engine"]
        ["WP-050 ⬜\nPAR Artifact Storage"]
        ["WP-051 ⬜\nPAR Server Gate"]

      Scoring & PAR Pipeline
        ["12-SCORING-REFERENCE.md\nFormula & Invariants"]
        ["12.1-PAR-ARTIFACT-INTEGRITY.md\nHashing Trust Model"]
        ["WP-048 → 049 → 050 → 051\nSimulation → Storage → Gate"]

      Registry Viewer
        ["cards.barefootbetters.com\nCard + Theme browser"]
        ["Keyword/Rule tooltips\n123 keywords (118 with pdfPage) + 20 rules (19 with pdfPage) — fetched from R2 via glossaryClient.ts per WP-060/EC-106; schemas + labels + pdfPage added by WP-082/EC-107"]
        ["Fetch-time Zod validation on all four R2 fetchers (registry config, themes, keyword glossary, rule glossary) — WP-082/083; `./schema` + `./theme.schema` subpath exports (A-082-01 / A-083-04) keep browser bundles free of Node-only imports"]
        ["Rulebook PDF deep-links (📖 Rulebook p. N) — version-pinned URL on R2, RFC 3778 `#page=N` with mandatory target=_blank + rel=noopener (D-8205)"]
        ["Hero class tooltips\n5 superpower descriptions (HERO_CLASS_GLOSSARY + HERO_CLASS_LABELS, hardcoded per D-6006)"]

      Governance
        [".claude/CLAUDE.md\nRoot coordination"]
        ["Execution Checklists\nWP-backed (EC-001..051, 060s+) + R-EC hygiene + EC-101+ viewer\nDone: EC-FP01, EC-001, EC-048 (WP-048), EC-065 (WP-065), EC-067 (WP-061), EC-068 (WP-067), EC-069 (WP-062), EC-071 (WP-063), EC-072 (WP-080), EC-073 (WP-079), EC-074 (WP-064), EC-103, EC-104, R-EC-02\nDeferred: R-EC-01, R-EC-03\nSee EC_INDEX.md"]
        ["7 Rule Files\n(.claude/rules/)"]
        ["Immutable Decisions\nDECISIONS.md\nPhase-6-era: D-4801..4806 PAR scoring spec set, D-6301 cli-producer-app category, D-6303 version-bump policy, D-6305 ReplayInputsFile naming, D-6401 keyboard focus pattern, D-6512/P6-30 vue-sfc-loader defineComponent rule, D-6701 PAR safe-skip, D-3401 versioning code category, D-3501..D-3504 ops playbook, D-4201..D-4203 deployment-checklist scope + form-(2)/form-(1) invariants, D-5601 preplan code category, D-8101/D-8102 registry-pipeline hygiene.\n2026-04-21 drop: D-6001..D-6007 glossary R2 migration (WP-060); D-8201..D-8206 glossary schema + rulebook deep-links (WP-082); D-3601..D-3604 AI playtesting + two-independent-PRNG-domain determinism (WP-036); D-8401..D-8407 auxiliary-metadata deletion + `*-old.*` repo-smell rule + viewer drifted-duplicate rule (WP-084); D-8301..D-8305 viewer fetch-boundary validation + ViewerConfig-vs-RegistryConfig naming lock + severity policy + `./theme.schema` subpath precedent (WP-083)"]
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
| Content | WP-055, 060 | **2/2** ✅ | — |
| Phase 5 | WP-021..026 | 6/6 | -- |
| Phase 6 | WP-027..035, 042, 048, 067, 079, 080 | **14/14** ✅ | — (tagged `phase-6-complete` at `c376467`) |
| UI Chain | WP-061..065 | 5/5 | ✅ all (WP-061, 062, 063, 064, 065) |
| Phase 7 | WP-036..041, 049..051 | **3/9** | ⬜ WP-039..041, WP-049..051 (WP-036/037/038 done 2026-04-21..22) |
| Pre-Plan | WP-056..058 | **3/3** ✅ | — (WP-059 deferred on UI framework decision; parallel-safe with Phase 4+) |
| Post-Phase-6 Hygiene | WP-081, 082, 083, 084, 085 (+ EC-110 INFRA) | **5/5** ✅ | — (landed 2026-04-20..22) |
| Carry-forward | WP-042.1, WP-066 | 1/2 | ⏸ WP-042.1 blocked on FP-03 revival per D-4201; ✅ WP-066 closed 2026-04-22 at `8c5f28f` |
| **Total** | | **73/80** | **7** (plus 1 carry-forward — WP-042.1 deferred) |

**Phase 6 closed on 2026-04-19 — tag `phase-6-complete` at `c376467`.** Engine baseline 436/109/0; repo-wide **596/0** (grew from 536/0 through the 2026-04-20..21 hygiene pass — see last-updated footer for test deltas per WP).

**Next unblocked (dependencies met, no active work):**
- **Phase 7 main sequence:** WP-039 (Post-Launch Metrics & Live Ops) → WP-040 (Growth Governance) → WP-041 (Architecture Audit). WP-036/037/038 trio done 2026-04-21..22 (WP-036 `539b543` → WP-037 `160d9b9` → WP-038 `2134f33`); the launch-readiness pillar is in place. WP-049..051 (PAR Simulation / Storage / Gate) remain pending.
- **Carry-forward backlog:** WP-042.1 (unblocks when Foundation Prompt 03 is revived). WP-066 ✅ closed 2026-04-22 at `8c5f28f` — no longer carry-forward.
- **Known OOS follow-up (not yet a WP):** trim `packages/registry/.env.example` lines 13-17 + clean `upload-r2.ts` stale docstring and closing `console.log` references — explicitly OOS per WP-081 §Scope (Out); harmless at runtime but misleading. Can be bundled as a single operator-tooling cleanup WP.

**Ops chain closed:** `WP-034 → WP-035 → WP-042` landed sequentially on 2026-04-19 (`5139817` → `d5935b5` → `c964cf4`) and the phase was governance-closed at `c376467`. Both the scoring side (WP-048 → WP-067 → WP-062) and the replay side (WP-079 → WP-080 → WP-063 → WP-064) also landed. **All three Phase 6 sub-chains shipped within 24 hours on 2026-04-19.**

**Post-Phase-6 delivery (2026-04-20):** five WPs landed on the governance trunk after the `phase-6-complete` tag — WP-055 (content), WP-056 (pre-planning types), WP-057 (pre-plan sandbox execution), WP-058 (pre-plan disruption pipeline), WP-081 (registry build hygiene) — all without reopening Phase 6. Engine baseline held at 436/109/0; repo-wide went 526 → 536 on WP-055 (+10 theme-schema tests) → 536 through WP-056 (zero-test) → 559 on WP-057 (+23 preplan-runtime tests across four `describe` blocks) → 588 on WP-058 (+29 preplan-pipeline tests across three `describe` blocks) → 588 through WP-081 (zero-test; subtractive). End-of-day 2026-04-20 baseline: 588 passing / 0 failing.

**2026-04-21 delivery wave** (five WPs + one ad-hoc INFRA commit): **WP-060** glossary R2 migration (EC-106, `412a31c`) + **WP-082** glossary schema/labels/rulebook deep-links (EC-107, `752fcca`; ten new registry-package tests took repo-wide 536 → 596) + **EC-110** ad-hoc Validate-Registry CI path fix (`4e53e9f`, surfaced and repaired upstream msp1/shld data defects via three `INFRA:` commits) + **WP-036** AI playtesting & balance simulation (EC-036, `539b543`) + **WP-084** auxiliary-metadata deletion (EC-109, `b250bf1`; subtractive; 596/0 preserved) + **WP-083** viewer-fetch-boundary Zod validation (EC-108, `601d6fc`; retrofit; 596/0 preserved). Phase-6 tag `phase-6-complete` at `c376467` still stands — all 2026-04-21 work is hygiene, content, or Phase-7 entry and does not retroactively reopen Phase 6.

*Last updated: 2026-04-22 (**Phase 7 launch-readiness trio back-sync** — WP-037 ✅ public beta strategy at `160d9b9` (EC-037; new `packages/game-engine/src/beta/` D-3701 engine code category 10th instance; `BetaFeedback` + `BetaCohort` + `FeedbackCategory` pure type contracts; `docs/beta/BETA_STRATEGY.md` + `docs/beta/BETA_EXIT_CRITERIA.md` strategy-doc-pair with 4 binary pass/fail exit categories; D-3702 invitation-only signal-quality + D-3703 three-cohorts-by-expertise-and-role + D-3704 beta-uses-the-same-release-gates-as-production; engine 436→444 / suites 109→110; repo-wide 588→596) + **WP-038** ✅ launch readiness & go-live checklist at `2134f33` (EC-038, governance close `d4fe447`; documentation-only — `docs/ops/LAUNCH_READINESS.md` 8 top-level sections covering 4 readiness gate categories + 17 binary pass/fail gates + single launch authority model with 3 non-override clauses + 4 required sign-offs + GO/NO-GO boolean aggregation rule; `docs/ops/LAUNCH_DAY.md` T-1h Final Build Verification + T-0 Soft Launch with PAUSE-vs-ROLLBACK distinction + Go-Live Signal + T+0 to T+72h Post-Launch Guardrails with 5-field Freeze Exception Record and 4 verbatim rollback triggers — invariant violation spike, replay hash divergence, migration failure, client desync; D-3801 single-launch-authority + D-3802 72h-stability-observation-window + D-3803 launch-gates-inherit-from-beta-exit-gates; three-commit topology A0 SPEC pre-flight bundle `9ecbe70` → A EC-038 content + 01.6 post-mortem `2134f33` → B SPEC governance close `d4fe447`; engine 444/110/0 + repo-wide 596/0 UNCHANGED through both commits — zero new tests). **Tally updates:** Phase 7 row 1/9 → 3/9; Carry-forward row 0/2 → 1/2 (WP-066 ✅ closed 2026-04-22 at `8c5f28f` — no longer carry-forward); grand total 70/79 → 72/79; remaining 9 → 7 (plus 1 deferred WP-042.1). Phase 6 tag `phase-6-complete` at `c376467` still stands. Mindmap Phase 7 node block gained `WP-037 ✅` and `WP-038 ✅` cards with full execution detail; `WP-037..041 ⬜` row replaced with `WP-039..041 ⬜` (3-item pending). Back-sync-only edit; no underlying work changed. **Original 2026-04-21 footer preserved below for context.** ---- **2026-04-21 delivery wave**: five WPs + one ad-hoc INFRA landed atop the 2026-04-20 Post-Phase-6 pass. **WP-060** ✅ at `412a31c` (EC-106, close `cd811eb`) — migrates 123-entry keyword glossary + 20-entry rule glossary from hardcoded useRules maps to R2; retargets useRules + useGlossary to fetched Maps; non-blocking fetch with console.warn + empty-Map fallback; D-6001..D-6007 (including D-6002 historical-neighbor glossary-wiring lock); repo-wide 536/0 UNCHANGED. **WP-082** ✅ at `752fcca` (EC-107, close `0acdf3c`; A-082-01..03 amendments) — authors KeywordGlossary{Entry,}Schema + RuleGlossary{Entry,}Schema in packages/registry/src/schema.ts (first `.strict()` use in that file); backfills required `label` + optional `pdfPage` onto all 123 keywords + 20 rules; uploads Marvel Legendary Universal Rules v23 hyperlinks.pdf to R2 at version-pinned URL; adds rulebookPdfUrl to viewer config; glossaryClient retrofitted to `.safeParse(...)` at fetch boundary with `[Glossary] Rejected …` full-sentence warning + empty-Map fallback; deletes `titleCase()` heuristic + introduces explicit HERO_CLASS_LABELS; D-8201..D-8206; A-082-01 locks `./schema` subpath export precedent that A-083-04 later mirrors for themes; +10 tests in registry package → repo-wide 536 → 596. **EC-110** ✅ at `4e53e9f` (ad-hoc INFRA, not a WP) — validate.ts defaults resolve via fileURLToPath(import.meta.url); surfaced two pre-existing data errors (msp1 sentinel ids, shld stringified attack/recruit) repaired upstream in modern-master-strike and regenerated via three `INFRA:` commits; baseline 596/0 preserved. **WP-036** ✅ at `539b543` (EC-036, close `61df4c0`; A-036-02 amendment) — AI playtesting & balance simulation framework; D-3601 simulation code category + D-3602 same-pipeline-as-humans + D-3603 random-policy MVP baseline + D-3604 two-independent-PRNG-domain seed reproducibility; first Phase-7 WP to land. **WP-084** ✅ at `b250bf1` (EC-109, close `4cc9ded`; A-084-01 amendment) — subtractive: five auxiliary Zod schemas (CardType/HeroClass/HeroTeam/Icon/Leads) + five data/metadata/*.json + card-types-old.json + Phase-2 validate block deleted; viewer drifted-duplicate `localRegistry.ts` deleted; 00.2-data-requirements rewritten; current-state docs sweep; legacy Validate-R2-old.ps1 deleted; D-8401..D-8407 (incl. D-8403 `*-old.*` repo-smell rule, D-8406 viewer drifted-duplicate rule, D-8407 legacy-ps1 deletion); 596/0 preserved. **WP-083** ✅ at `601d6fc` (EC-108, close `7f054e1`; A-083-01..04 amendments) — adds ViewerConfigSchema (.strict()) + ThemeIndexSchema + inferred types to packages/registry/src/schema.ts; retrofits registryClient + themeClient to `.safeParse(...)` at the fetch boundary with first-Zod-issue rendering (`[RegistryConfig] Rejected …` throws; `[Themes] Rejected …` throws on index / warns + skips on individual themes per D-8303 severity policy); four inline TS interfaces deleted; A-083-04 adds `./theme.schema` subpath export to packages/registry/package.json (D-8305 locks precedent); D-8301..D-8305; theme.schema.ts + theme.validate.ts untouched (empty git diff); 69 shipped themes validate against ThemeDefinitionSchema with fail = 0; 596/0 preserved. **Totals:** Content row 1/2 → 2/2; Phase 7 row 0/9 → 1/9; Post-Phase-6 Hygiene row 1/1 → 4/4 (new denominator absorbed WP-082, WP-083, WP-084); repo-wide grand total 63/76 → 68/79. Phase 6 tag `phase-6-complete` at `c376467` still stands. Prior 2026-04-19 Phase 6 closure history preserved: ops chain WP-034 → WP-035 → WP-042, replay sub-chain WP-027 → WP-079 → WP-080 → WP-063 → WP-064, scoring side WP-048 → WP-067 → WP-062. Precedent-log entries through P6-51 live in `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`. **2026-04-22 roadmap back-sync:** WP-057 ✅ and WP-058 ✅ rows updated from ⬜ — authoritative status per `WORK_INDEX.md:1431, :1445` has been Done since 2026-04-20 executions `8a324f0` + `bae70e7` (governance closes `7414656` + `00687c5`); Pre-Plan row bumped 1/3 → 3/3; grand total 68/79 → 70/79 with 11 → 9 remaining; Post-Phase-6 delivery paragraph updated from three → five WPs with 2026-04-20 test-count arithmetic reconciled 526 → 588. Back-sync-only edit; no underlying work changed.)*
