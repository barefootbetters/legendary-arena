# Session Execution Prompt — WP-014A v2 (Mode B Invariants Audit)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute the audit. Do not execute in the session that
> generated this prompt.

---

## Session Identity

**Work Packet:** WP-014A — Villain Reveal & Trigger Pipeline
**Audit Mode:** Mode B — Invariants Audit (current mainline)
**Pre-Flight:** `docs/ai/invocations/preflight-wp014a-villain-reveal-pipeline-v2.md`
**EC:** `docs/ai/execution-checklists/EC-014A-villain-reveal-pipeline.checklist.md`

---

## Read Order (Mandatory — Do Not Skip)

Read these documents **in this exact order** before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/ai/execution-checklists/EC-014A-villain-reveal-pipeline.checklist.md`
4. `docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md`
5. `docs/ai/invocations/preflight-wp014a-villain-reveal-pipeline-v2.md`

---

## Context

This is a **Mode B invariants audit**, not a historical re-execution. The
current codebase already contains:

- WP-014A (reveal pipeline, types, tests)
- WP-014B (buildVillainDeck, real deck composition)
- WP-015 (City routing for villain/henchman)
- WP-015A (stage gating + malformed city card-drop fix)

Your job is to **validate that all WP-014A active invariants hold** in the
current code, then fix any that don't. You are NOT recreating WP-014A from
scratch or reverting later packets.

### Supersession Rules

The following WP-014A behaviors are **intentionally superseded** and must
NOT be treated as violations:

- `buildInitialGameState` empty defaults (superseded by WP-014B)
- Villain/henchman discard routing (superseded by WP-015 City routing)
- Tests using `city`/`hq` fields (required by current `LegendaryGameState`)

See WP-014A "Supersession Awareness" for full details.

---

## Task: Validate All 20 Active Invariants

Verify each invariant below holds in the current code. For each one,
record PASS or FAIL with a file:line reference.

### Type Contracts (villainDeck.types.ts)

1. `RevealedCardType` = exactly `'villain' | 'henchman' | 'bystander' | 'scheme-twist' | 'mastermind-strike'`
2. `REVEALED_CARD_TYPES` canonical array contains all 5 values
3. `VillainDeckState` = `{ deck: CardExtId[]; discard: CardExtId[] }`
4. `// why:` comment on `G.villainDeckCardTypes` design present

### Game State (types.ts)

5. `LegendaryGameState` has `villainDeck: VillainDeckState`
6. `LegendaryGameState` has `villainDeckCardTypes: Record<CardExtId, RevealedCardType>`

### Registry Boundary

7. No `@legendary-arena/registry` import in `villainDeck.reveal.ts`
8. No `@legendary-arena/registry` import in `villainDeck.types.ts`

### Reveal Pipeline (villainDeck.reveal.ts)

9. Stage gating: early-return unless `G.currentStage === 'start'` (first line)
10. Top-of-deck: draws `deck[0]`
11. Fail-closed: missing `cardType` -> message + return, card stays in deck
12. Reshuffle: empty deck + non-empty discard -> shuffleDeck
13. Empty + empty: message + return, no state changes
14. `onCardRevealed` always fires with `{ cardId, cardTypeSlug }`
15. `onSchemeTwistRevealed` fires only for `scheme-twist`
16. `onMastermindStrikeRevealed` fires only for `mastermind-strike`
17. Trigger emission uses `executeRuleHooks` (no inline effect logic)
18. `applyRuleEffects` called with collected effects
19. Deck removal deferred until destination confirmed (WP-015A)

### Prohibitions

20. `revealVillainCard` is NOT in `CoreMoveName`, `CORE_MOVE_NAMES`, or `MOVE_ALLOWED_STAGES`

### Code Quality

21. No `Math.random()` in villainDeck files
22. No `.reduce()` in logic (JSDoc comments OK)
23. No `require()` in any villainDeck file
24. All required `// why:` comments present per EC-014A

### Tests

25. `REVEALED_CARD_TYPES` drift-detection test exists and passes
26. Reveal tests cover: draw, routing, triggers (3), negative trigger,
    reshuffle, empty-empty, serialization, fail-closed, stage gating
27. All tests use `node:test`, `node:assert`, `makeMockCtx` (no boardgame.io)
28. `pnpm --filter @legendary-arena/game-engine build` exits 0
29. `pnpm --filter @legendary-arena/game-engine test` exits 0 (all pass)

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
4. Do NOT modify governance docs (WP, EC, WORK_INDEX, DECISIONS, ARCHITECTURE)
   unless a fix requires it — this is an audit, not an execution

---

## Constraints (Non-Negotiable)

- Do not revert WP-014B, WP-015, or WP-015A changes
- Do not modify `CoreMoveName`, `CORE_MOVE_NAMES`, or `MOVE_ALLOWED_STAGES`
- Do not add registry imports to engine move/type files
- Do not use `Math.random()`, `.reduce()` in logic, or `require()`
- Moves never throw
- `G` must remain JSON-serializable
