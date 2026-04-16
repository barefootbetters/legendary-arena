WP-032 is complete (commit bcd1671 EC-032, pushed to origin/main
2026-04-15). Key context for WP-033:

- 367 engine tests passing, 95 suites, 0 fail
- 10 moves unchanged: drawCards, playCard, revealVillainCard,
  fightVillain, fightMastermind, recruitHero, advanceStage, endTurn,
  setPlayerReady, startMatchIfReady
- LegendaryGameState UNCHANGED by WP-032 — no new fields, no shape
  change. Intent validation observes G via computeStateHash; it does
  not extend G.
- Phase 6 (Verification, UI & Production) continues
- WP-033 is the next unblocked WP (depends on WP-031, which is complete)
- WP-033: Content Authoring Toolkit — author-facing JSON schemas for
  hero, villain, mastermind, scheme, scenario; `validateContent` +
  `validateContentBatch`; structural, enum, cross-reference, and hook
  consistency checks; returns structured results (never throws);
  implements D-0601, D-0602

WP-032 artifacts (engine-category, network validation layer):
- `packages/game-engine/src/network/` — new engine subdirectory
  classified as engine code category (D-3201)
- `intent.types.ts` — `ClientTurnIntent` (canonical move submission
  format), `IntentValidationResult` (discriminated union:
  `{ valid: true } | { valid: false; reason: string; code: IntentRejectionCode }`),
  `IntentRejectionCode` (5-member closed union: WRONG_PLAYER,
  WRONG_TURN, INVALID_MOVE, MALFORMED_ARGS, DESYNC_DETECTED),
  `IntentValidationContext` (local structural interface for ctx subset:
  `readonly currentPlayer: string`, `readonly turn: number`)
- `intent.validate.ts` — `validateIntent(intent, gameState, context,
  validMoveNames)` pure function. Caller injects the valid move name
  list (transport-agnostic). Sequential validation: player -> turn ->
  move name -> args structure -> desync hash. Short-circuits on first
  failure. Never mutates, never throws.
- `desync.detect.ts` — `detectDesync(clientHash, gameState)` pure
  function. Uses `computeStateHash(G)` from WP-027. If client hash
  differs from engine hash, engine wins (D-0402).
- `intent.validate.test.ts` — 9 contract enforcement tests in 1
  `describe` block covering all 5 rejection codes + valid intent +
  desync (matching/mismatching/absent hash) + non-mutation invariant
- `types.ts` — additive re-exports: ClientTurnIntent,
  IntentValidationResult, IntentRejectionCode, IntentValidationContext
- `index.ts` — additive exports: all 4 types + validateIntent +
  detectDesync

WP-032 does NOT directly block WP-033. WP-033 depends on WP-031
(which is complete). WP-032's network validation contract is consumed
by future server-layer wiring WPs, not by content authoring.

Key pre-flight discovery from WP-032 (may apply to WP-033 if it
validates against canonical arrays):
- P6-20: `CORE_MOVE_NAMES` contains only 3 of 10 registered moves.
  Canonical arrays may be incomplete for validation scope. Pre-flight
  must verify the actual membership of any canonical array used for
  validation. If incomplete, inject the valid set as a parameter
  instead of importing the incomplete constant.
- WP-033 validates against canonical unions (HERO_KEYWORDS,
  BOARD_KEYWORDS) per its WORK_INDEX notes. Pre-flight should verify
  those unions contain all values that WP-033's validators need to
  accept.

Key architectural patterns still in effect:
- D-0001 (Correctness Over Convenience)
- D-0002 (Determinism Is Non-Negotiable)
- D-0101 (Engine Is the Sole Authority)
- D-0102 (Fail Fast on Invariant Violations)
- D-0401 (Clients Submit Intents Only) — implemented by WP-032
- D-0402 (Engine-Authoritative Resync) — implemented by WP-032
- D-0601 (Content Validation as Pre-Engine Gate) — **WP-033 implements**
- D-0602 (Schemas Reference Canonical Unions) — **WP-033 implements**
- D-0603 (Representation Before Execution) — governs data-only contracts
- D-3201 (Network directory as engine code category) — WP-032

Files WP-033 will likely need to read or depend on:
- `packages/game-engine/src/rules/heroKeywords.ts` — `HERO_KEYWORDS`,
  `HERO_ABILITY_TIMINGS` for schema cross-reference
- `packages/game-engine/src/board/boardKeywords.types.ts` —
  `BOARD_KEYWORDS` for schema cross-reference
- `packages/game-engine/src/rules/heroAbility.types.ts` —
  `HeroAbilityHook`, `HeroCondition`, `HeroEffectDescriptor`
- `packages/game-engine/src/rules/ruleHooks.types.ts` —
  `RULE_TRIGGER_NAMES`, `RULE_EFFECT_TYPES` for hook consistency checks
- `packages/game-engine/src/matchSetup.types.ts` — `MatchSetupConfig`
  for scenario schema cross-reference
- `packages/game-engine/src/types.ts` — all re-exported types
- `packages/game-engine/src/test/mockCtx.ts` — `makeMockCtx` for tests
- `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative)

EC and WP files for WP-033:
- `docs/ai/work-packets/WP-033-content-authoring-toolkit.md`
- EC-033 checklist file: verify existence during pre-flight. If
  missing, pre-flight must flag as a blocking finding.

Test baseline for WP-033:
- Current: 367 tests, 95 suites, 0 fail
- Expected after WP-033: 367 + N (depends on WP-033 test count)
- Existing 367 tests must continue to pass **unchanged**

Governance state:
- Standardization Completeness Pass: still valid (2026-04-15)
- 01.4 Precedent Log through P6-21 (WP-032 lessons propagated)
- Full 9-step workflow demonstrated by WP-030 (Contract-Only),
  WP-031 (Runtime Wiring), WP-032 (Contract-Only, clean execution)

Steps completed for WP-032:
0: session-context-wp032.md (loaded)
1: pre-flight (2026-04-15, READY — PS-1 D-3201 resolved, PS-2
   WP back-sync resolved)
1b: copilot check (2026-04-15, CONFIRM — 2 scope-neutral FIXes
    #4 EC signature and #13 code-category directory list applied)
2: session-wp032-network-sync.md (generated)
3: execution (2026-04-15, same session as pre-flight per user
   authorization; 367 tests, 0 fail; zero deviations)
4: post-mortem (2026-04-15, WP COMPLETE — zero fixes applied;
   formal 01.6 artifact at
   docs/ai/invocations/postmortem-wp032-network-sync.md)
5: pre-commit review (2026-04-15, Safe to commit as-is; zero
   nits; formal gatekeeper pass at
   docs/ai/invocations/precommit-review-wp032-network-sync.md)
6: commit (bcd1671 EC-032: implement intent validation and desync
   detection contract — single commit including code + all 5
   invocation/audit-trail docs; pushed to origin/main)
7: lessons learned (2026-04-15 — 1 new Established Pattern
   (caller-injected dependency arrays), 1 new Risk example
   (canonical array incomplete for validation scope), 2 new
   Precedent Log entries P6-20 and P6-21)
8: this file

Run pre-flight for WP-033 next.
