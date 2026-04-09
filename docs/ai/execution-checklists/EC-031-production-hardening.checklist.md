# EC-031 — Production Hardening & Engine Invariants (Execution Checklist)

**Source:** docs/ai/work-packets/WP-031-production-hardening-engine-invariants.md
**Layer:** Engine Safety / Invariants / Fail-Fast Guarantees

**Execution Authority:**
This EC is the authoritative execution checklist for WP-031.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-031.

---

## Before Starting

- [ ] WP-029 complete: all MVP gameplay + UIState + audience views in place
- [ ] `LegendaryGameState` stable; `CityZone` (WP-015), `ENDGAME_CONDITIONS` (WP-010) exist
- [ ] D-0001, D-0002, D-0102 (with clarification) recorded in DECISIONS.md
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-031.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **Five invariant categories:**
  1. Structural -- zone shapes, array types, field existence
  2. Game Rules -- card uniqueness, counter validity, zone exclusivity
  3. Determinism -- serialization roundtrip, no functions in G
  4. Security/Visibility -- no hidden state leakage in UIState
  5. Lifecycle -- phase/stage validity, turn counter monotonicity

- `type InvariantCategory = 'structural' | 'gameRules' | 'determinism' | 'security' | 'lifecycle'`
- `assertInvariant(condition: boolean, category: InvariantCategory, message: string): void` -- **throws** on violation

---

## Guardrails

- `assertInvariant` throws on invariant violation -- fail fast per D-0102
- Invariant violations vs gameplay conditions are **distinct**: only violations throw
- Insufficient attack, empty piles, no valid target are **NOT** invariant violations -- safe no-ops
- All check functions are **pure** -- read G, return boolean or throw, no I/O, no mutations
- Error messages are **full sentences** identifying what failed and where (Rule 11)
- Five categories are non-overlapping -- each check belongs to exactly one
- No gameplay logic changes -- checks observe, do not alter behavior
- No `.reduce()` in check logic; no boardgame.io import in invariant files

---

## Required `// why:` Comments

- Each invariant check: what it prevents
- `assertInvariant`: invariant violations must fail fast (D-0102); gameplay conditions use move return void
- Five categories: prevents classification ambiguity
- `runAllInvariantChecks` ordering: fail-fast on first violation

---

## Files to Produce

- `packages/game-engine/src/invariants/invariants.types.ts` -- **new** -- InvariantCategory, InvariantViolation
- `packages/game-engine/src/invariants/assertInvariant.ts` -- **new** -- assertion utility
- `packages/game-engine/src/invariants/structural.checks.ts` -- **new** -- structural checks
- `packages/game-engine/src/invariants/gameRules.checks.ts` -- **new** -- game rules checks
- `packages/game-engine/src/invariants/determinism.checks.ts` -- **new** -- determinism checks
- `packages/game-engine/src/invariants/lifecycle.checks.ts` -- **new** -- lifecycle checks
- `packages/game-engine/src/invariants/runAllChecks.ts` -- **new** -- orchestrator
- `packages/game-engine/src/game.ts` -- **modified** -- wire invariant checks
- `packages/game-engine/src/types.ts` -- **modified** -- re-export types
- `packages/game-engine/src/index.ts` -- **modified** -- export API
- `packages/game-engine/src/invariants/invariants.test.ts` -- **new** -- 10 tests

---

## Common Failure Smells (Optional)

- Gameplay condition (empty pile) flagged as invariant -- violation/condition distinction lost
- assertInvariant returns instead of throwing -- fail-fast contract broken
- Check function mutates G -- purity violation
- Error message is terse or single-word -- Rule 11 violated

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Gameplay conditions (insufficient attack, empty pile) confirmed NOT flagged as invariants
- [ ] `docs/ai/STATUS.md` updated (invariant checks exist; five categories; D-0001 and D-0102 implemented)
- [ ] `docs/ai/DECISIONS.md` updated (checks after every move or dev/test only; lifecycle trigger points; gameplay conditions excluded)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-031 checked off with date
