# Phase 3 Readiness Review

**Date:** 2026-04-11
**Reviewed by:** Claude Code (automated audit + manual review)
**Scope:** Phase 2 completion → Phase 3 (MVP Multiplayer Infrastructure) entry gate
**Build status:** 89/89 tests passing, 0 failures

---

## Purpose

Phase 3 introduces networking, persistence, and reconnection. These
permanently harden mistakes. This review confirms the foundation is
correct before multiplayer amplifies any latent faults.

> Phase 3 does not add features — it makes everything permanent.
> Anything unclear now becomes unfixable later.

---

## 1. Determinism Stress Audit — PASS

**Finding:** No non-deterministic functions in game-engine source code.

| Pattern searched | Files found | Status |
|---|---|---|
| `Math.random` | 0 (comments only) | Clean |
| `Date.now` | 0 | Clean |
| `new Date()` | 0 | Clean |
| `performance.now` | 0 | Clean |

All randomization uses `ctx.random` exclusively (`setup/shuffle.ts`).

**Object.keys/values/entries:** One usage found in `zones.validate.ts:148` —
pure validator context, order-irrelevant. No game-state mutations affected.

**Verdict:** Determinism is airtight for single-player. Safe to proceed.

---

## 2. Turn Engine Invariant Review — PASS

All three core moves follow the locked contract exactly:

| Move | Step 1: Validate args | Step 2: Check stage | Step 3: Mutate G |
|---|---|---|---|
| `drawCards` | lines 34-37 | lines 40-43 | lines 46-75 |
| `playCard` | lines 86-89 | lines 92-95 | lines 98-109 |
| `endTurn` | (no args) | lines 122-125 | lines 128-144 |

**Stage transitions:** `start → main → cleanup → endTurn` — verified by
6 turn stage tests and drift-detection tests.

**endTurn authority:** Exactly 2 code paths call `ctx.events.endTurn()`:
1. `endTurn` move in `coreMoves.impl.ts:144` (player-initiated)
2. `advanceTurnStage` in `turnLoop.ts:66` (automatic at cleanup end)

Both are centralized through `getNextTurnStage()` as the single ordering
authority. No client-driven turn advancement possible.

**Verdict:** Turn engine is correctly gated and side-effect free on failure.

---

## 3. Snapshot Boundary Validation — DEFERRED (WP-013)

**Finding:** `MatchSnapshot` type does not yet exist in code.

The required shape is defined in `.claude/rules/persistence.md` (zone counts
only, no CardExtId arrays, no derived data). WP-013 (Persistence Boundaries
& Snapshots) will implement this.

**Impact on Phase 3:** Snapshots are needed for reconnection (WP-013 is in
Phase 3). The type must be defined before WP-013 executes, but does not
block WP-009A/B (Rule Hooks) or WP-010 (Victory & Loss).

**Verdict:** Not blocking Phase 3 entry. Must be implemented before
persistence work begins.

---

## 4. Engine ↔ Server Boundary Audit — PASS

**Server imports only public API:**
- `apps/server/src/game/legendary.mjs` → `export { LegendaryGame }`
- `apps/server/src/server.mjs` → `import { LegendaryGame }`

**No internal path imports found:**
- No `src/moves/`, `src/rules/`, `src/state/`, `src/turn/`, `src/setup/`

**Server responsibilities correctly isolated:**
- Registry: `createRegistryFromLocalFiles()` at startup
- Rules: `loadRules()` from PostgreSQL at startup
- Game: `Server({ games: [LegendaryGame] })` wiring only
- Process: `index.mjs` SIGTERM handling

**Verdict:** Perfect separation. Server is wiring-only.

---

## 5. Rule Hook Contract Readiness — DEFERRED (WP-009A)

**Finding:** Rule hooks system not yet implemented. No `rules/` directory,
no `HookDefinition` type, no `executeRuleHooks()` function.

**Architecture is defined and locked:**
- `G.hookRegistry: HookDefinition[]` (data-only, in G)
- `ImplementationMap` (functions, outside G, runtime-only)
- Execution order: priority (ascending), then id (lexical) — deterministic
- `executeRuleHooks()` returns effects; `applyRuleEffects()` mutates G
- No `.reduce()` — `for...of` only
- Unknown effects emit warnings, never throw

**Critical question answered:** "Could two hooks fire in different orders
on different machines?" — No. Execution order is deterministic
(priority + lexical id). This is defined in ARCHITECTURE.md and enforced
by `.claude/rules/game-engine.md`.

**Verdict:** Contract is well-defined. Implementation is WP-009A (first
Phase 3 packet). No design ambiguity.

---

## 6. Scoring & PAR Status — LOCKED

### Scoring Semantics
- Raw Score formula frozen in `docs/12-SCORING-REFERENCE.md` (v1.1)
- Structural invariants locked (3 invariants, all satisfied by defaults)
- No per-player or per-hero modifiers
- Penalty event taxonomy defined (5 types including `mastermindTacticUntaken`)

### PAR Pipeline
- WP-048 (scoring contracts): Draft, pre-flighted, dependencies blocked
- WP-049 (simulation engine): Draft, T2 policy defined
- WP-050 (artifact storage): Draft, immutable versioned layout
- WP-051 (server gate): Draft, fail-closed enforcement

### Governance
- D-0703 (Difficulty Declared Before Competition): Immutable
- D-1002 (Immutable Surfaces Protected): Immutable
- Vision goals 20-26 aligned with all PAR work

**Verdict:** Scoring is frozen as a trust surface. PAR pipeline is designed
and governed but not yet implementable (depends on WP-020, WP-027, WP-036).

---

## 7. Governance & Drift Controls — PASS

| Control | Status |
|---|---|
| DECISIONS.md | 30 decisions, D-0703 added |
| DECISIONS_INDEX.md | Updated with D-0703 |
| WORK_INDEX.md | 56 WPs, dependency chain current |
| EC_INDEX.md | 55 ECs (1 Done, 54 Draft) |
| `.claude/rules/*.md` | 7 rule files, all current |
| Scoring reference | v1.1, frozen |

**Drift question:** "If a future contributor tried to break trust, would
the system stop them before code review?"

**Answer:** Yes — `.claude/rules/*.md` are loaded automatically by Claude
Code and enforce layer boundaries, determinism, and move contracts at
execution time. ECs enforce locked values at the checklist level. DECISIONS.md
prevents re-litigation of settled choices.

**Verdict:** Governance is operational and protective.

---

## 8. Test Coverage Summary

| Category | Tests | Status |
|---|---|---|
| Setup/state shape | 21 | Pass |
| Move validation & gating | 15 | Pass |
| Turn stage transitions | 6 | Pass |
| Zone operations | 6 | Pass |
| Drift detection (constants match types) | 5 | Pass |
| Determinism (seed reproducibility) | 3 | Pass |
| JSON serialization (G stays serializable) | 2 | Pass |
| Other (game object, integration) | 31 | Pass |
| **Total** | **89** | **100%** |

**Verdict:** Comprehensive for current scope. Phase 3 WPs will add tests
for hooks, endgame, and persistence.

---

## Go / No-Go Summary

| Criterion | Status | Notes |
|---|---|---|
| Determinism under stress | PASS | No entropy sources; ctx.random only |
| Move validation contract | PASS | All 3 moves follow validate → gate → mutate |
| Engine/server boundary | PASS | Public API only; no internal imports |
| Turn authority centralized | PASS | 2 paths, both through getNextTurnStage |
| Snapshot types defined | DEFERRED | WP-013 (not blocking Phase 3 entry) |
| Rule hook contract designed | DEFERRED | WP-009A will implement (contract is locked) |
| Scoring frozen as trust surface | PASS | Formula, invariants, PAR pipeline designed |
| Governance blocks shortcuts | PASS | Rules, ECs, decisions all operational |
| 89/89 tests passing | PASS | Zero failures, zero skipped |

---

## Verdict: READY FOR PHASE 3

All blocking criteria pass. The two deferred items (snapshots, rule hooks)
are Phase 3 work packets with well-defined contracts — they don't represent
foundation gaps.

**Next unblocked:** WP-009A (Rule Hooks Contracts)

**Recommended pre-flight actions before WP-009A:**
1. Run pre-flight invocation (`01.4`) for WP-009A
2. Verify `ARCHITECTURE.md` rule execution pipeline section is current
3. Confirm `G.hookRegistry` field exists in `LegendaryGameState`

---

*This review is an audit artifact, not a governance document. Authority
remains with ARCHITECTURE.md, WORK_INDEX.md, and DECISIONS.md.*
