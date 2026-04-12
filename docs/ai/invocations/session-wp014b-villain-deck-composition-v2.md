# Session Execution Prompt — WP-014B v2 (Mode B Invariants Audit)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute the audit. Do not execute in the session that
> generated this prompt.

---

## Session Identity

**Work Packet:** WP-014B — Villain Deck Composition Rules & Registry Integration
**Audit Mode:** Mode B — Invariants Audit (current mainline)
**Pre-Flight:** `docs/ai/invocations/preflight-wp014b-villain-deck-composition-v2.md`
**EC:** None (WP-014B intentionally has no EC — decisions D-1410 through D-1413
are the executable contract)

---

## Read Order (Mandatory — Do Not Skip)

Read these documents **in this exact order** before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/ai/work-packets/WP-014B-villain-deck-composition.md`
4. `docs/ai/invocations/preflight-wp014b-villain-deck-composition-v2.md`
5. `docs/ai/DECISIONS.md` — entries D-1410 through D-1413

---

## Context

This is a **Mode B invariants audit**, not a historical re-execution.
The current codebase already contains a complete `buildVillainDeck`
implementation (WP-014B) and all downstream packets (WP-015, WP-015A).

Your job is to **validate that all WP-014B invariants hold** in the
current code, then fix any that don't.

---

## Task: Validate All 20 Active Invariants

Verify each invariant below holds in the current code. For each one,
record PASS or FAIL with a file:line reference.

### Pure Function Contract (villainDeck.setup.ts)

1. `buildVillainDeck` is a pure function -- no I/O, no `Math.random()`
2. Only `shuffleDeck` used for randomness (via `context.random`)
3. No `@legendary-arena/registry` import (only JSDoc mentions OK)
4. No `.reduce()` in logic (JSDoc mentions OK)

### Registry Interface

5. `VillainDeckRegistryReader` defined locally in game-engine
6. Interface has `listCards()`, `listSets()`, `getSet()` methods
7. Satisfied structurally by real `CardRegistry` (no import needed)
8. Narrow test mocks (missing listSets/getSet) produce empty deck gracefully

### Ext-ID Conventions (D-1410 through D-1413)

9. Villain cards: use `FlatCard.key` as ext_id, classified `'villain'`
10. Henchman: `henchman-{groupSlug}-{NN}`, 10 per group, classified `'henchman'`
11. Scheme twists: `scheme-twist-{schemeSlug}-{NN}`, 8 per scheme, `'scheme-twist'`
12. Bystanders: `bystander-villain-deck-{NN}`, count = `numPlayers`, `'bystander'`
13. Mastermind strikes: `{setAbbr}-mastermind-{mmSlug}-{cardSlug}`, `tactic !== true`, `'mastermind-strike'`

### Determinism

14. Lexical sort before shuffle ensures stable pre-shuffle ordering
15. `shuffleDeck` provides deterministic shuffle via `ctx.random.Shuffle`

### Integration

16. `buildInitialGameState` calls `buildVillainDeck` with real registry
17. `G.villainDeck` and `G.villainDeckCardTypes` populated from result
18. `buildVillainDeck` exported from `index.ts`
19. `VillainDeckRegistryReader` exported from `index.ts`

### Code Quality

20. Config-to-registry mapping documented in `// why:` comments
21. All `// why:` comments present per WP-014B spec
22. No `require()` in any file
23. `pnpm --filter @legendary-arena/game-engine build` exits 0
24. `pnpm --filter @legendary-arena/game-engine test` exits 0

### Tests (villainDeck.setup.test.ts)

25. Non-empty deck for valid config
26. Every card has cardTypes entry
27. Deck shuffled (order differs from sorted)
28. cardTypes keys = unique deck IDs (bijection)
29. Henchman: 10 copies, correct ext_id format
30. Scheme twists: 8 copies, correct ext_id format
31. Bystanders: count = numPlayers
32. Mastermind strikes: non-tactic only
33. JSON.stringify succeeds (serialization proof)
34. All cardTypes values are valid REVEALED_CARD_TYPES members

---

## If Any Invariant Fails

1. Record which invariant failed and why
2. Fix the code to satisfy the invariant
3. Ensure the fix does not violate any other invariant
4. Re-run build + tests
5. Document the fix in the audit output

---

## Completion

When all invariants pass:

1. Record the audit results (invariant # -> PASS with file:line)
2. Report total test count and confirm 0 failures
3. Note any fixes applied
4. Do NOT modify governance docs unless a fix requires it

---

## Constraints (Non-Negotiable)

- Do not import `@legendary-arena/registry` in game-engine
- Do not use `Math.random()`, `.reduce()` in logic, or `require()`
- `buildVillainDeck` must remain a pure function
- `G` must remain JSON-serializable
- Do not modify WP-014A reveal pipeline behavior
- Do not modify ext_id conventions without updating DECISIONS.md
