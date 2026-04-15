WP-030 is complete (commits 5be83f4 SPEC + 94d947b EC-030). Key context
for WP-031:

- 348 engine tests passing, 93 suites, 0 fail
- 10 moves unchanged: drawCards, playCard, revealVillainCard, fightVillain,
  fightMastermind, recruitHero, advanceStage, endTurn, setPlayerReady,
  startMatchIfReady
- LegendaryGameState UNCHANGED by WP-030 — no new fields, no shape change
- Phase 6 (Verification, UI & Production) continues
- WP-031 is the next unblocked WP (depends on WP-029, parallel to WP-030
  in the dependency graph but WP-030 landed first)
- WP-031: Production Hardening & Engine Invariants — runtime assertion
  utility (`assertInvariant`), five non-overlapping invariant categories
  (structural, gameRules, determinism, security, lifecycle), pure check
  functions, wired into setup and optionally move lifecycle; implements
  D-0001 and D-0102

WP-030 artifacts (additive, do NOT need to be consumed by WP-031):
- `packages/game-engine/src/campaign/campaign.types.ts` — 7 data-only
  type contracts (`ScenarioOutcome`, `ScenarioOutcomeCondition`,
  `ScenarioReward`, `ScenarioDefinition`, `CampaignUnlockRule`,
  `CampaignDefinition`, `CampaignState`)
- `packages/game-engine/src/campaign/campaign.logic.ts` — 3 pure
  helpers (`applyScenarioOverrides`, `evaluateScenarioOutcome`,
  `advanceCampaignState`) plus one internal helper
  (`isConditionSatisfied`) with exhaustive switch + never branch
- `packages/game-engine/src/campaign/campaign.logic.test.ts` — 8
  contract-enforcement tests
- `types.ts` / `index.ts` re-exports of the new campaign types and
  helpers (purely additive — `interface LegendaryGameState` unchanged)
- Campaign code is NEVER wired into `game.ts`, moves, or phase hooks.
  It is pure meta-orchestration external to the engine lifecycle.

UIState + audience filter contract still in effect (WP-028 + WP-029):
- `UIState` interface with 9 sub-types in `src/ui/uiState.types.ts`
- `buildUIState(gameState, ctx)` pure function in `src/ui/uiState.build.ts`
- `filterUIStateForAudience(uiState, audience)` pure filter
- `UIAudience` discriminated union
- WP-031 security/visibility invariants are declared out-of-scope for
  this MVP (require WP-028/029 integration testing, deferred per WP-031
  §Out of Scope). The existing UIState filter already enforces
  visibility at the projection layer — WP-031 does not re-enforce it.

Key architectural patterns still in effect:
- D-0301 (UI Consumes Projections Only) — WP-028
- D-0302 (Single UIState, Multiple Audiences) — WP-029
- D-0501 (Campaigns Are Meta-Orchestration Only) — WP-030
- D-0502 (Campaign State Lives Outside the Engine) — WP-030
- D-0603 (Representation Before Execution) — governs data-only
  contracts; WP-031 follows this pattern for invariant check results
- D-1235 (loss-before-victory evaluation order) — WP-031's
  `evaluateScenarioOutcome` implementation of this pattern may be
  reviewed as precedent if WP-031 introduces any evaluation ordering
- D-2706 (`src/replay/` engine category) — WP-027
- D-2801 (`src/ui/` engine category) — WP-028
- D-3001 (`src/campaign/` engine category) — WP-030
  **→ WP-031 will introduce `src/invariants/` as a new subdirectory.
  This is the fourth instance of the "new engine subdirectory requires
  DECISIONS.md classification" pattern. Pre-flight must catch as PS-#
  and resolve by creating a new decision (suggested D-3101 or next
  available ID) following the D-2706 / D-2801 / D-3001 template.**

WP-030 lessons already propagated to 01.4 (commit pending):
- P6-7: Code-category classification as pre-flight PS-# — **directly
  applicable to WP-031's `src/invariants/` introduction**
- P6-8: Pre-flight refinement back-sync gap — if WP-031 pre-flight
  locks any API refinement, back-sync the WP-031 text immediately
- P6-9: Named union for related function parameters — **applies to
  WP-031's `InvariantCategory = 'structural' | 'gameRules' | 'determinism'
  | 'security' | 'lifecycle'` union which is used by `assertInvariant`,
  `InvariantViolation`, and each check function**
- P6-10: Explicit "01.5 NOT INVOKED" declaration for purely additive
  WPs — **does NOT apply to WP-031**. WP-031 modifies `game.ts` to
  wire `runAllInvariantChecks` into the setup lifecycle (and optionally
  the move lifecycle). This is runtime wiring and 01.5 DOES apply —
  the session prompt should explicitly INVOKE 01.5 with the specific
  files and structural changes enumerated. See §Runtime Wiring
  Allowance note below.
- P6-11: Reserved parameter pattern (`void parameter;`) — may apply
  if WP-031 defines any locked API parameters that are not yet used
- P6-12: External reviewer findings verification — standard pre-flight
  practice
- P6-13: Full 9-step workflow precedent — WP-030 established the
  complete governance chain (pre-flight → session prompt → execution
  → post-mortem → pre-commit review → commit → lessons → session
  context). WP-031 should follow the same pattern.

WP-031 key design tension: invariant throw vs move return void
- `assertInvariant` **throws** on violation — this is intentional and
  is the ONE EXCEPTION to the "moves never throw" rule outside
  `Game.setup()`. Per the WP: invariant violations indicate structural
  corruption that must not be silently ignored.
- Gameplay conditions (insufficient attack, empty pile, no valid
  target) are NOT invariant violations. They remain safe no-ops per
  D-0102 clarification.
- WP-031 must NOT flag gameplay conditions as invariant violations.
  Test 9 and Test 10 specifically verify this: insufficient attack
  points does NOT trigger any invariant; empty wounds pile does NOT
  trigger any invariant.
- The `runAllInvariantChecks` wiring into `game.ts` must preserve
  this distinction. If `assertInvariant` throws during a move, the
  boardgame.io framework will surface the error — this is intentional
  observable failure, not silent corruption.

Runtime Wiring Allowance (01.5) — WILL BE INVOKED for WP-031
- WP-031 modifies `packages/game-engine/src/game.ts` to wire
  `runAllInvariantChecks` into `Game.setup()` completion and
  optionally into move lifecycle points. This is a **structural
  runtime integration** and triggers the 01.5 conditions:
  - Adds runtime wiring to `game.ts` (explicit 01.5 trigger)
  - May add runtime checks to `LegendaryGame.moves` contexts (conditional
    trigger depending on the configuration decision)
- Pre-flight must explicitly INVOKE 01.5 in the session prompt with
  the exact files and structural changes enumerated. This is the
  inverse of WP-030, which explicitly declared 01.5 NOT INVOKED.
- WP-031 Section H (`src/game.ts` — modified) already documents the
  wiring intent. Pre-flight must also decide: run checks after every
  move (performance cost), or only in dev/test mode (configuration
  gate). Document the decision in DECISIONS.md (WP-031 DoD requires
  this).

Files WP-031 will need to read or depend on:
- `packages/game-engine/src/state/zones.types.ts` — `PlayerZones`,
  `CardExtId` for zone structure invariants
- `packages/game-engine/src/board/city.types.ts` — `CityZone` as a
  fixed 5-tuple (structural invariant: city size check)
- `packages/game-engine/src/endgame/endgame.types.ts` — `ENDGAME_CONDITIONS`
  canonical counter keys (game-rules invariant: counter validity)
- `packages/game-engine/src/turn/turnPhases.types.ts` — `MATCH_PHASES`,
  `TURN_STAGES` canonical arrays (lifecycle invariant: phase/stage
  validity)
- `packages/game-engine/src/types.ts` — `LegendaryGameState` full shape
  (structural invariants: field existence, array types)
- `packages/game-engine/src/game.ts` — wiring site for
  `runAllInvariantChecks`
- `packages/game-engine/src/test/mockCtx.ts` — `makeMockCtx` for test
  fixtures
- `docs/ai/ARCHITECTURE.md` — "MVP Gameplay Invariants" section (this
  is the source of the invariants WP-031 formalizes)
- `docs/ai/DECISIONS.md` — D-0001, D-0002, D-0102 (including the
  clarification distinguishing invariant violations from gameplay
  conditions)

WP-031 scope key files (from WP-031 §Files Expected to Change):
- `packages/game-engine/src/invariants/` — new directory (requires
  D-# classification per PS-# during pre-flight)
- `packages/game-engine/src/invariants/invariants.types.ts` — new
- `packages/game-engine/src/invariants/assertInvariant.ts` — new
- `packages/game-engine/src/invariants/structural.checks.ts` — new
- `packages/game-engine/src/invariants/gameRules.checks.ts` — new
- `packages/game-engine/src/invariants/determinism.checks.ts` — new
- `packages/game-engine/src/invariants/lifecycle.checks.ts` — new
- `packages/game-engine/src/invariants/runAllChecks.ts` — new
- `packages/game-engine/src/invariants/invariants.test.ts` — new (10 tests)
- `packages/game-engine/src/game.ts` — **modified** (01.5 wiring)
- `packages/game-engine/src/types.ts` — modified (re-export)
- `packages/game-engine/src/index.ts` — modified (export API)

EC and WP files exist for WP-031:
- `docs/ai/work-packets/WP-031-production-hardening-engine-invariants.md`
  (391 lines, reviewed)
- EC-031 checklist file: verify existence during pre-flight. If
  missing, pre-flight must flag as a blocking finding before session
  prompt generation.

Test baseline for WP-031:
- Current: 348 tests, 93 suites, 0 fail
- Expected after WP-031: 348 + 10 = **358 tests**, suites count
  depends on describe-block organization (likely 93 + 1 or 93 + N)
- Existing 348 tests must continue to pass **unchanged**. If any
  existing test breaks because of runtime invariant wiring in
  `game.ts`, that break must be diagnosed — a test may be reading
  intentionally invalid state that the new invariant checks flag.
  Pre-flight should identify this risk and either scope-lock the
  invariant checks to dev/test mode or locate and pre-fix the
  offending test fixtures.

Governance precedents from WP-030 workflow to reuse:
- `docs/ai/invocations/preflight-wpNNN-<name>.md` — pre-flight artifact
- `docs/ai/invocations/session-wpNNN-<name>.md` — session execution prompt
- `docs/ai/invocations/postmortem-wpNNN-<name>.md` — 01.6 post-mortem
- `docs/ai/invocations/precommit-review-wpNNN-<name>.md` — 01.3 gatekeeper review
- Two-commit split: `SPEC:` for governance + artifacts, `EC-###:` for
  code (matches WP-029 and WP-030 precedent)

Steps completed for WP-030:
0: session-context-wp030.md (loaded)
1: pre-flight (2026-04-14, READY — conditional on PS-1 for D-3001
   code category classification; resolved pre-execution)
2: session-wp030-campaign-framework.md (generated, 1011 lines, with
   explicit "01.5 NOT INVOKED" declaration)
3: execution (2026-04-14, same session as pre-flight per user
   authorization — deviation from step-3-fresh-session convention,
   logged in execution summary; 348 tests, 0 fail)
4: post-mortem (2026-04-14, clean — no code fixes required; formal
   10-section 01.6 artifact at
   docs/ai/invocations/postmortem-wp030-campaign-framework.md)
5: pre-commit review (2026-04-14, Safe to commit as-is, 2
   non-blocking nits — Nit 1 applied before commit; formal 01.3
   gatekeeper artifact at
   docs/ai/invocations/precommit-review-wp030-campaign-framework.md)
6: commit (5be83f4 SPEC: add WP-030 pre-flight, session prompt, and
   post-execution governance + 94d947b EC-030: implement campaign
   and scenario framework contracts; two-commit split matching
   WP-029 precedent)
7: lessons learned (7 new Precedent Log entries P6-7 through P6-13,
   4 new Established Patterns, 4 new Risk examples, added to 01.4
   — commit pending; file now 2856 lines, +336 from WP-030 lessons)
8: this file

Run pre-flight for WP-031 next.
