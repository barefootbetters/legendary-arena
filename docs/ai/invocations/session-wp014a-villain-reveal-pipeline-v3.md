# Session Execution Prompt — WP-014A v3 (Mode B Invariants Audit + 01.5 Wiring)

> **This is a session execution prompt.** Open a new Claude Code session and
> paste this prompt to execute the audit. Do not execute in the session that
> generated this prompt.

---

## Session Identity

**Work Packet:** WP-014A — Villain Reveal & Trigger Pipeline
**Audit Mode:** Mode B — Invariants Audit (current mainline)
**Pre-Flight:** `docs/ai/invocations/preflight-wp014a-villain-reveal-pipeline-v2.md`
**EC:** `docs/ai/execution-checklists/EC-014A-villain-reveal-pipeline.checklist.md`
**Wiring Clause:** `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`

---

## Read Order (Mandatory — Do Not Skip)

Read these documents **in this exact order** before writing any code:

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md`
3. `docs/ai/execution-checklists/EC-014A-villain-reveal-pipeline.checklist.md`
4. `docs/ai/work-packets/WP-014A-villain-reveal-pipeline.md`
5. `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`
6. `docs/ai/invocations/preflight-wp014a-villain-reveal-pipeline-v2.md`

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

---

## Supersession Rules

The following WP-014A behaviors are **intentionally superseded** and must
NOT be treated as violations:

- `buildInitialGameState` empty defaults (superseded by WP-014B's real
  `buildVillainDeck` call)
- Villain/henchman discard routing (superseded by WP-015 City routing;
  D-1408 documents this)
- Tests using `city`/`hq` fields in mock G states (required by current
  `LegendaryGameState` shape after WP-015)

See WP-014A "Supersession Awareness" for the full Mode A vs Mode B
explanation.

---

## Runtime Wiring Allowance

WP-014A adds `villainDeck: VillainDeckState` and
`villainDeckCardTypes: Record<CardExtId, RevealedCardType>` to
`LegendaryGameState`, and adds `revealVillainCard` to
`LegendaryGame.moves`. Per
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring
edits to the following files are permitted **solely to restore type and
assertion correctness**:

- `src/setup/buildInitialGameState.ts` — provide `villainDeck` and
  `villainDeckCardTypes` in the returned `LegendaryGameState` object
  (currently: real `buildVillainDeck` call, superseding empty defaults)
- `src/game.test.ts` — structural assertion update for move count
  (currently: 5 moves including `revealVillainCard`)

**No new behavior may be introduced** under this allowance. Only
value-level assertion updates and required-field provisioning are
permitted.

### What 01.5 Does NOT Allow

- No new logic, branching, or helpers in `buildInitialGameState.ts`
- No new test cases in `game.test.ts`
- No behavioral changes to existing test assertions
- No modifications to files not listed above
- No cleanup, refactoring, or reformatting of surrounding code

### Reporting Requirement

If any file is modified under this clause during the audit, the
execution summary must explicitly state:

1. Which file was modified
2. Why the modification was required (trace to the new field/move)
3. What structural change was applied
4. Confirmation that no new gameplay or runtime behavior was introduced

---

## Task: Validate All Active Invariants

Verify each invariant below holds in the current code. For each one,
record PASS or FAIL with a file:line reference.

### Type Contracts (villainDeck.types.ts)

1. `RevealedCardType` = exactly
   `'villain' | 'henchman' | 'bystander' | 'scheme-twist' | 'mastermind-strike'`
2. `REVEALED_CARD_TYPES` canonical array contains all 5 values
3. `VillainDeckState` = `{ deck: CardExtId[]; discard: CardExtId[] }`
4. `// why:` comment on `G.villainDeckCardTypes` design present

### Game State (types.ts)

5. `LegendaryGameState` has `villainDeck: VillainDeckState`
6. `LegendaryGameState` has
   `villainDeckCardTypes: Record<CardExtId, RevealedCardType>`

### Registry Boundary

7. No `@legendary-arena/registry` import in `villainDeck.reveal.ts`
8. No `@legendary-arena/registry` import in `villainDeck.types.ts`

### Reveal Pipeline (villainDeck.reveal.ts)

9. Stage gating: early-return unless `G.currentStage === 'start'`
   (first line of move body, no side effects on mismatch)
10. Top-of-deck: draws `deck[0]`
11. Fail-closed: missing `cardType` -> message + return, card stays in deck
12. Reshuffle: empty deck + non-empty discard -> `shuffleDeck`
13. Empty + empty: message + return, no state changes
14. `onCardRevealed` always fires with `{ cardId, cardTypeSlug }`
15. `onSchemeTwistRevealed` fires only for `'scheme-twist'`
16. `onMastermindStrikeRevealed` fires only for `'mastermind-strike'`
17. Trigger emission uses `executeRuleHooks` (no inline effect logic)
18. `applyRuleEffects` called with collected effects
19. Deck removal deferred until destination confirmed (WP-015A)

### Prohibitions

20. `revealVillainCard` is NOT in `CoreMoveName`, `CORE_MOVE_NAMES`,
    or `MOVE_ALLOWED_STAGES`

### Code Quality

21. No `Math.random()` in villainDeck files
22. No `.reduce()` in logic (JSDoc comment mentions OK)
23. No `require()` in any villainDeck file
24. All required `// why:` comments present per EC-014A:
    - `G.villainDeckCardTypes` design (types.ts)
    - Stage gating rationale (reveal.ts)
    - Reshuffle rationale (reveal.ts)
    - Discard/City routing rationale (reveal.ts)
    - Deck removal deferral rationale (reveal.ts, WP-015A)

### Runtime Wiring (01.5 Allowance Scope)

25. `buildInitialGameState` provides `villainDeck` and
    `villainDeckCardTypes` in the returned state
    (currently via `buildVillainDeck` — supersedes empty defaults)
26. `game.test.ts` move-count assertion reflects `revealVillainCard`
    (currently: 5 moves)
27. `revealVillainCard` is registered in `game.ts` `play` phase
    top-level `moves`

### Exports (index.ts)

28. `VillainDeckState` exported (type)
29. `RevealedCardType` exported (type)
30. `REVEALED_CARD_TYPES` exported (value)
31. `revealVillainCard` exported (value)

### Tests

32. `REVEALED_CARD_TYPES` drift-detection test exists and passes
33. Reveal tests cover all 11 cases: draw, routing, triggers (3),
    negative trigger, reshuffle, empty-empty, serialization,
    fail-closed, stage gating
34. All test files use `node:test`, `node:assert`, `makeMockCtx`
    (no `boardgame.io` imports)
35. Trigger tests use observable hooks in `G.hookRegistry`
    (no monkeypatching of `executeRuleHooks` or `applyRuleEffects`)
36. `pnpm --filter @legendary-arena/game-engine build` exits 0
37. `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## If Any Invariant Fails

1. Record which invariant failed and why
2. Fix the code to satisfy the invariant
3. If the fix touches a file under 01.5 wiring scope, document it per
   the Reporting Requirement above
4. Ensure the fix does not violate any other invariant or supersession
   rule
5. Re-run build + tests
6. Document the fix in the audit output

---

## Completion

When all invariants pass:

1. Record the audit results (invariant # -> PASS with file:line)
2. Report total test count and confirm 0 failures
3. Note any fixes applied (with 01.5 reporting if applicable)
4. Do NOT modify governance docs (WP, EC, WORK_INDEX, DECISIONS,
   ARCHITECTURE) unless a fix requires it — this is an audit, not a
   full execution

---

## Constraints (Non-Negotiable)

- Do not revert WP-014B, WP-015, or WP-015A changes
- Do not modify `CoreMoveName`, `CORE_MOVE_NAMES`, or `MOVE_ALLOWED_STAGES`
- Do not add `@legendary-arena/registry` imports to engine move/type files
- Do not use `Math.random()`, `.reduce()` in logic, or `require()`
- Moves never throw; only `Game.setup()` may throw
- `G` must remain JSON-serializable at all times
- All zones store `CardExtId` strings only
- `// why:` comment required on every `ctx.events.setPhase()` and
  `ctx.events.endTurn()` call
- 01.5 wiring changes must be minimal and introduce no new behavior
