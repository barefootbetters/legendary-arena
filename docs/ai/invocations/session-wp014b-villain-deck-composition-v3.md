# Session Execution Prompt — WP-014B v3 (Mode B Invariants Audit)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute the audit. Do not execute in the session that
> generated this prompt.

---

## Session Identity

**Work Packet:** WP-014B — Villain Deck Composition Rules & Registry Integration
**Audit Mode:** Mode B — Invariants Audit (current mainline)
**Pre-Flight:** `docs/ai/invocations/preflight-wp014b-villain-deck-composition-v3.md`
**EC:** None (intentionally — D-1410 through D-1413 are the executable contract)

---

## Read Order (Mandatory — Do Not Skip)

Read these documents **in this exact order** before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/ai/work-packets/WP-014B-villain-deck-composition.md`
4. `docs/ai/DECISIONS.md` — entries D-1410, D-1411, D-1412, D-1413
5. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`
6. `docs/ai/invocations/preflight-wp014b-villain-deck-composition-v3.md`

---

## Context

This is a **Mode B invariants audit**, not a historical re-execution.
The current codebase already contains a complete `buildVillainDeck`
implementation (WP-014B) plus downstream packets (WP-015, WP-015A).

Your job is to **validate that all WP-014B invariants hold** in the
current code, then fix any that don't.

---

## Runtime Wiring Allowance

WP-014B replaces the empty-default villain deck fields in
`buildInitialGameState` with a real `buildVillainDeck` call. Per
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to the following files are permitted **solely to restore type and
assertion correctness**:

- `src/setup/buildInitialGameState.ts` — replace empty defaults with
  `buildVillainDeck(config, registry, context)` result assignment
- `src/index.ts` — export `buildVillainDeck` and `VillainDeckRegistryReader`

**No new behavior may be introduced** under this allowance beyond the
wiring itself.

---

## Task: Validate All Active Invariants

Verify each invariant below holds in the current code. For each one,
record PASS or FAIL with a file:line reference.

### Pure Function Contract (villainDeck.setup.ts)

1. `buildVillainDeck` is a pure function — no I/O, no `Math.random()`
2. Only `shuffleDeck` used for randomness (via `context.random`)
3. No `from '@legendary-arena/registry'` import (JSDoc mentions OK)
4. No `.reduce()` in logic (JSDoc mentions OK)
5. No `require()` anywhere

### Registry Interface (villainDeck.setup.ts)

6. `VillainDeckRegistryReader` defined locally in game-engine
7. Interface has `listCards()`, `listSets()`, `getSet()` methods
8. Structurally satisfied by real `CardRegistry` (no import needed)
9. `isVillainDeckRegistryReader` runtime guard exists
10. Narrow test mocks (missing listSets/getSet) produce empty deck gracefully

### Ext-ID Conventions — D-1410 (Henchmen)

11. Ext_id format: `henchman-{groupSlug}-{NN}` (zero-padded, hyphens)
12. Count: 10 per group (`HENCHMAN_COPIES_PER_GROUP` constant)
13. Classification: `'henchman'` in `cardTypes`
14. `config.henchmanGroupIds` -> `SetData.henchmen[].slug` mapping documented

### Ext-ID Conventions — D-1411 (Scheme Twists)

15. Ext_id format: `scheme-twist-{schemeSlug}-{NN}` (zero-padded, hyphens)
16. Count: 8 (`SCHEME_TWIST_COUNT` constant)
17. Classification: `'scheme-twist'` in `cardTypes`
18. `config.schemeId` -> `SetData.schemes[].slug` mapping documented

### Ext-ID Conventions — D-1412 (Bystanders)

19. Ext_id format: `bystander-villain-deck-{NN}` (zero-padded)
20. Count: `context.ctx.numPlayers` (1 per player, derived, not config)
21. Classification: `'bystander'` in `cardTypes`
22. Separate from `config.bystandersCount` (bystander pile supply)

### Ext-ID Conventions — D-1413 (Mastermind Strikes)

23. `tactic !== true` filter identifies strikes (registry schema contract)
24. Ext_id: `{setAbbr}-mastermind-{mastermindSlug}-{cardSlug}`
25. Classification: `'mastermind-strike'` in `cardTypes`
26. `config.mastermindId` -> `SetData.masterminds[].slug` mapping documented
27. `// why:` comment on `tactic !== true` explaining it's a schema contract

### Villain Cards (FlatCard-backed)

28. Villain cards resolved via `listCards()` filtered by `cardType === 'villain'`
29. Ext_id: `FlatCard.key` (already canonical format)
30. Classification: `'villain'` in `cardTypes`
31. `config.villainGroupIds` -> group slug extracted from FlatCard.key

### Determinism

32. Lexical sort (`[...deck].sort()`) before shuffle
33. `shuffleDeck(sortedDeck, context)` for deterministic shuffle
34. `// why:` comments on both sort and shuffle rationale

### Count Constants

35. `HENCHMAN_COPIES_PER_GROUP = 10` (game-engine constant, not config)
36. `SCHEME_TWIST_COUNT = 8` (game-engine constant, not config)
37. Bystander count = `context.ctx.numPlayers` (derived, not constant)

### Runtime Wiring (01.5 Scope)

38. `buildInitialGameState` calls `buildVillainDeck(config, registry, context)`
39. `registry` parameter (not `_registry`) consumed by `buildVillainDeck`
40. `villainDeckResult.state` assigned to `G.villainDeck`
41. `villainDeckResult.cardTypes` assigned to `G.villainDeckCardTypes`

### Exports (index.ts)

42. `buildVillainDeck` exported (value)
43. `VillainDeckRegistryReader` exported (type)

### Code Quality

44. All `// why:` comments present (12 in setup.ts covering: registry
    boundary, count constants, config-to-registry mappings x4, bystander
    format, sort rationale, shuffle rationale, tactic filter, narrow mock
    handling)
45. All helper functions use `for...of` (no `.reduce()`)

### Tests (villainDeck.setup.test.ts)

46. Non-empty deck for valid config
47. Every card has cardTypes entry
48. Deck shuffled (order differs from sorted — proves `makeMockCtx` reversal)
49. cardTypes keys = unique deck IDs (bijection)
50. Henchman: 10 copies, correct ext_id format
51. Scheme twists: 8 copies, correct ext_id format
52. Bystanders: count = numPlayers
53. Mastermind strikes: non-tactic only
54. JSON.stringify succeeds (serialization proof)
55. All cardTypes values are valid REVEALED_CARD_TYPES members
56. All tests use `node:test`, `node:assert`, `makeMockCtx` (no boardgame.io)

### Build & Tests

57. `pnpm --filter @legendary-arena/game-engine build` exits 0
58. `pnpm --filter @legendary-arena/game-engine test` exits 0 (all pass)

---

## If Any Invariant Fails

1. Record which invariant failed and why
2. Fix the code to satisfy the invariant
3. If the fix touches a file under 01.5 wiring scope, document it per
   the Reporting Requirement in 01.5
4. Ensure the fix does not violate any other invariant
5. Re-run build + tests
6. Document the fix in the audit output

---

## Completion

When all invariants pass:

1. Record the audit results (invariant # -> PASS with file:line)
2. Report total test count and confirm 0 failures
3. Note any fixes applied (with 01.5 reporting if applicable)
4. Do NOT modify governance docs unless a fix requires it

---

## Constraints (Non-Negotiable)

- Do not import `@legendary-arena/registry` in game-engine
- Do not use `Math.random()`, `.reduce()` in logic, or `require()`
- `buildVillainDeck` must remain a pure function
- `G` must remain JSON-serializable at all times
- Do not modify WP-014A reveal pipeline behavior
- Do not modify ext_id conventions without updating DECISIONS.md
- Count constants must not be moved to `MatchSetupConfig`
- Moves never throw; `buildVillainDeck` may throw (called from `Game.setup()`)
