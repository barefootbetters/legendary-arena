WP-031 is complete (commit eeb9d6c EC-031, pushed to origin/main
2026-04-15). Key context for WP-032:

- 358 engine tests passing, 94 suites, 0 fail
- 10 moves unchanged: drawCards, playCard, revealVillainCard,
  fightVillain, fightMastermind, recruitHero, advanceStage, endTurn,
  setPlayerReady, startMatchIfReady
- LegendaryGameState UNCHANGED by WP-031 — no new fields, no shape
  change. Invariant checks observe G; they do not extend it.
- Phase 6 (Verification, UI & Production) continues
- WP-032 is the next unblocked WP (depends on WP-031)
- WP-032: Network Sync & Turn Validation — `ClientTurnIntent`
  canonical submission format, engine-side `validateIntent`, 5
  rejection codes, desync detection via `computeStateHash` (WP-027),
  transport-agnostic; implements D-0401 (clients submit intents
  only), D-0402 (engine-authoritative resync)

WP-031 artifacts (engine-internal, NOT consumed directly by WP-032
unless WP-032 chooses to wire invariant checks into the network
validation path — which is unlikely at MVP):
- `packages/game-engine/src/invariants/` — new engine subdirectory
  classified as engine code category (D-3101)
- `invariants.types.ts` — `InvariantCategory` closed 5-value union
  (`structural`, `gameRules`, `determinism`, `security`, `lifecycle`),
  canonical `INVARIANT_CATEGORIES` readonly array (drift-pinned by
  Test 1), `InvariantViolation` interface, `InvariantCheckContext`
  local structural interface (no boardgame.io import per D-2801
  precedent)
- `assertInvariant.ts` — throwing assertion utility +
  `InvariantViolationError` companion class with `category` field
- `structural.checks.ts` — `checkCitySize`, `checkZoneArrayTypes`,
  `checkCountersAreFinite`, `checkGIsSerializable`
- `gameRules.checks.ts` — `checkNoCardInMultipleZones` (with
  fungible-token exclusion per D-3103),
  `checkZoneCountsNonNegative`, `checkCountersUseConstants`
- `determinism.checks.ts` — `checkNoFunctionsInG`,
  `checkSerializationRoundtrip`, local `isStructurallyEqual` helper
- `lifecycle.checks.ts` — `checkValidPhase`, `checkValidStage`,
  `checkTurnCounterMonotonic` (exported but NOT called by the
  orchestrator — reserved for future per-turn wiring)
- `runAllChecks.ts` — `runAllInvariantChecks(G, invariantContext)`
  orchestrator, runs checks in fixed category order (structural →
  gameRules → determinism → lifecycle), fail-fast on first violation
- `invariants.test.ts` — 10 tests (1 drift-detection + valid-G,
  2-5 category throw assertions, 6-7 assertInvariant contract,
  8 serialization happy path, 9-10 contract enforcement: gameplay
  conditions do NOT throw)
- `game.ts` — minimal 01.5 wiring: 1 import + 4-line setup-return
  wrap. `runAllInvariantChecks(initialState, { phase, turn })`
  called from `Game.setup()` return path ONLY per D-3102 Option B.
- `types.ts` — additive re-export block (InvariantCategory,
  InvariantViolation, InvariantCheckContext, INVARIANT_CATEGORIES)
- `index.ts` — additive export block (assertInvariant,
  InvariantViolationError, runAllInvariantChecks, all 11 individual
  check functions, the 3 invariant types, INVARIANT_CATEGORIES)

Wiring scope: SETUP-ONLY per D-3102 Option B
- `runAllInvariantChecks` fires once per match, immediately after
  `buildInitialGameState` produces the initial G. No per-move
  wiring, no phase-hook wiring, no turn-boundary wiring.
- Per-move wiring is explicitly deferred to a follow-up WP. That
  follow-up WP must introduce a new throwing-convention exception
  for "assertInvariant inside a move." WP-031 did NOT add any
  new exception to `.claude/rules/game-engine.md §Throwing Convention`.
- WP-032 validation pipeline (`validateIntent`) returns structured
  rejections (never throws) per D-0401/D-0402. This is DIFFERENT
  from the invariant pipeline which throws. WP-032 should NOT wire
  `runAllInvariantChecks` into the validation path — invariant
  checks observe G for structural corruption; intent validation
  checks whether a submitted intent is legal. They are different
  concerns.

Mid-execution amendment precedent from WP-031:
- WP-031 was the first WP to require a mid-execution amendment
  (PS-3). The original `checkNoCardInMultipleZones` spec was
  incompatible with the engine's CardExtId fungibility model
  (card-type IDs, not per-instance IDs). The executor halted at
  §Implementation Task D, escalated, and the user authorized
  Option 1 (fungible-exclusion semantics) via WP-031 §Amendments
  A-031-01/02/03 + new D-3103. This workflow is now a locked
  precedent (P6-15 in 01.4). If WP-032 encounters a spec
  incompatibility during implementation, follow the same pattern:
  halt, escalate with concrete evidence, get user authorization,
  write the amendment + DECISIONS entry + re-confirm pre-flight
  + copilot check, then resume.

WP-031 lessons applicable to WP-032:
- P6-14: Pre-flight must verify "scan-G-and-throw" invariants
  against concrete builder output — **applies if WP-032 introduces
  any validation that scans G**. `validateIntent` reads G to check
  desync status; pre-flight should verify the validation predicate
  against the actual G shape produced by existing tests.
- P6-15: Mid-execution PS-# workflow — **available if needed**.
- P6-16: Verification grep patterns must escape regex specials —
  **applies to WP-032 verification steps**. Use `from ['"]module`
  patterns, not bare `module.name`.
- P6-17: Post-mortem fix as in-allowlist refinement — **applies
  if post-mortem discovers coupling risk**. Fix in-place, record
  in §10.
- P6-18: Setup-only wiring scope — **does NOT apply to WP-032**.
  WP-032 is a network validation layer, not an invariant-check
  pipeline. Its wiring decisions are different.
- P6-19: Full 9-step workflow with mid-execution amendment —
  **reference pattern for WP-032**. Follow the same governance
  pipeline.

WP-031 lessons NOT applicable to WP-032 (but worth being aware of):
- P6-9 (Named union for related function parameters) — applies if
  WP-032 introduces rejection codes as a literal union shared
  between `validateIntent` return type and a consumer. The
  5 rejection codes (`WRONG_PLAYER`, `WRONG_TURN`, `INVALID_MOVE`,
  `MALFORMED_ARGS`, `DESYNC_DETECTED`) should be a named type, not
  inline string literals.
- P6-11 (Reserved parameter pattern) — may apply if WP-032 defines
  locked API parameters not yet used at MVP.

Key architectural patterns still in effect:
- D-0001 (Correctness Over Convenience) — now implemented at MVP
  level by the invariant pipeline
- D-0002 (Determinism Is Non-Negotiable) — enforced by
  `checkNoFunctionsInG` and `checkSerializationRoundtrip`
- D-0102 (Fail Fast on Invariant Violations, with clarification) —
  invariant violations throw; gameplay conditions return void
- D-0301 (UI Consumes Projections Only) — WP-028
- D-0302 (Single UIState, Multiple Audiences) — WP-029
- D-0401 (Clients Submit Intents Only) — **WP-032 implements this**
- D-0402 (Engine-Authoritative Resync) — **WP-032 implements this**
- D-0501 (Campaigns Are Meta-Orchestration Only) — WP-030
- D-0603 (Representation Before Execution) — governs data-only
  contracts; WP-032 should follow this for `ClientTurnIntent`
- D-2706/D-2801/D-3001/D-3101 (engine subdirectory classification
  pattern) — if WP-032 creates a new subdirectory (e.g., `src/network/`
  or `src/sync/`), pre-flight must catch as PS-# and create a
  classification decision
- D-3102 (setup-only invariant wiring) — WP-032 must NOT wire
  invariant checks into additional lifecycle points
- D-3103 (fungible token exclusion) — WP-032 does not need to
  know about this unless it introduces zone mutation logic

Files WP-032 will likely need to read or depend on:
- `packages/game-engine/src/types.ts` — `LegendaryGameState` shape
  for desync detection hash input
- `packages/game-engine/src/replay/replay.hash.ts` —
  `computeStateHash` (WP-027) for desync detection
- `packages/game-engine/src/moves/coreMoves.types.ts` —
  `CoreMoveName`, `CORE_MOVE_NAMES` for valid move name checking
- `packages/game-engine/src/turn/turnPhases.types.ts` —
  `MATCH_PHASES`, `TURN_STAGES` for phase/stage gating
- `packages/game-engine/src/game.ts` — the moves registry
  (`LegendaryGame.moves`) for valid move enumeration
- `packages/game-engine/src/test/mockCtx.ts` — `makeMockCtx` for
  test fixtures
- `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative) now
  exists at line 183 for the canonical five-layer specification

EC and WP files for WP-032:
- `docs/ai/work-packets/WP-032-network-sync-turn-validation.md`
  (reviewed per WORK_INDEX)
- EC-032 checklist file: verify existence during pre-flight. If
  missing, pre-flight must flag as a blocking finding.

Test baseline for WP-032:
- Current: 358 tests, 94 suites, 0 fail
- Expected after WP-032: 358 + N (depends on WP-032 test count)
- Existing 358 tests must continue to pass **unchanged**

Governance state:
- Standardization Completeness Pass: ✅ PASSED (2026-04-15,
  commit 53b4670). All 66 WPs are ✅ Reviewed; DECISIONS_INDEX.md
  is in full 1:1 parity with DECISIONS.md (156 decisions);
  ARCHITECTURE.md §Layer Boundary (Authoritative) exists and is
  correctly referenced by all 7 .claude/rules/*.md files.
- 01.4 Precedent Log through P6-19 (WP-031 lessons propagated)
- Full 9-step workflow demonstrated by WP-030 (Contract-Only) and
  WP-031 (Runtime Wiring) — WP-032 should follow the same pattern

Steps completed for WP-031:
0: session-context-wp031.md (loaded)
1: pre-flight (2026-04-15, READY — conditional on PS-1 D-3101 +
   PS-2 D-3102 resolved pre-execution; mid-execution PS-3 for
   D-3103 added with RS-9/10/11 when executor halted at §D)
1b: copilot check (2026-04-15, HOLD → CONFIRM with FIXes #23 +
    #4 applied in-place; Re-Run 2026-04-15 with Findings #31/32/33
    after mid-execution amendment, CONFIRM)
2: session-wp031-production-hardening.md (generated, 1720 lines,
   with explicit "01.5 IS INVOKED" declaration)
3: execution (2026-04-15, same session as pre-flight per user
   authorization — deviation from step-3-fresh-session convention;
   mid-execution PS-3 amendment applied; 358 tests, 0 fail)
4: post-mortem (2026-04-15, WP COMPLETE — one in-allowlist coupling
   fix applied: gameRules.checks.ts inline literals → named imports;
   formal 01.6 artifact at
   docs/ai/invocations/postmortem-wp031-production-hardening.md)
5: pre-commit review (2026-04-15, Safe to commit as-is; formal
   gatekeeper pass delivered inline in the execution session)
6: commit (eeb9d6c EC-031: implement engine invariant checks with
   setup-only wiring — single commit including code + all 4
   invocation/audit-trail docs; pushed to origin/main)
7: lessons learned (46fd7e8 SPEC: add WP-031 lessons to pre-flight
   template (01.4) — 7 new Established Patterns, 4 new Risk
   examples, 6 new Precedent Log entries P6-14 through P6-19;
   pushed to origin/main)
8: this file

Run pre-flight for WP-032 next.
