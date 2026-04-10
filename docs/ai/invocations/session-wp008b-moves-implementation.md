# Work Packet Invocation — WP-008B (Core Moves Implementation)

**FILE TYPE:** Invocation Prompt
**AUDIENCE:** Claude Code (Execution Mode)
**PURPOSE:** Pre-execution contract setup for a single Work Packet
**SCOPE:** This file defines *what may be done* in the upcoming WP execution

---

## Invocation Header

**Work Packet ID:** `WP-008B`
**Work Packet Title:** Core Moves Implementation (Draw, Play, End Turn)
**Execution Mode:** EC-Mode (Execution Checklist enforced)
**Invocation Type:** Single-WP Execution
**Status:** Ready to Execute
**Pre-Flight Date:** 2026-04-10
**Pre-Flight Verdict:** READY TO EXECUTE

---

## Invocation Intent

You are about to execute **WP-008B** in the Legendary Arena codebase.

This invocation defines **exact scope**, **authority order**, **allowed changes**,
and **forbidden behavior** for this Work Packet execution.

WP-008B implements the *behavioral effects* of the three core moves whose
contracts were locked in WP-008A. It introduces `zoneOps.ts` (pure zone
mutation helpers) and wires `drawCards`, `playCard`, `endTurn` into
`game.ts`. All moves follow the three-step ordering: validate args, check
stage gate, mutate `G`.

You must operate strictly within this contract.

---

## Authority Chain (Must Read In Order)

Before executing any step, you must read and follow these documents **in this order**:

1. `.claude/CLAUDE.md`
   - EC-mode rules
   - Bug handling rules
   - Commit discipline

2. `docs/ai/ARCHITECTURE.md`
   - Section: The Move Validation Contract (three-step ordering)
   - Section: Zone Mutation Rules
   - Layer boundaries, engine vs framework separation

3. `.claude/rules/game-engine.md`
   - Move Validation Contract (validate → gate → mutate)
   - G serialization invariants
   - Zone Mutation Rules (helpers return new arrays)
   - Throwing convention (moves never throw)

4. `.claude/rules/code-style.md`
   - `// why:` comment requirements (Rule 6)
   - No `.reduce()` in zone operations (Rule 8)
   - 30-line function limit — zone ops extracted (Rule 5)
   - Full-sentence error messages (Rule 11)
   - ESM only (Rule 13)

5. `docs/ai/execution-checklists/EC-008B-moves-implementation.checklist.md`
   - The governing execution checklist for this WP

6. `docs/ai/work-packets/WP-008B-core-moves-implementation.md`
   - The formal specification for this Work Packet

Then reference (read-only unless explicitly listed in Files Allowed to Change):

7. `packages/game-engine/src/moves/coreMoves.types.ts` — WP-008A contract;
   import `DrawCardsArgs`, `PlayCardArgs`, `MoveResult`, `MoveError`;
   do NOT modify
8. `packages/game-engine/src/moves/coreMoves.validate.ts` — WP-008A validators;
   import all four validators; do NOT modify
9. `packages/game-engine/src/moves/coreMoves.gating.ts` — WP-008A gating;
   import `isMoveAllowedInStage`; do NOT modify
10. `packages/game-engine/src/setup/shuffle.ts` — `shuffleDeck` and
    `ShuffleProvider`; use for reshuffle in `drawCards`; do NOT modify
11. `packages/game-engine/src/test/mockCtx.ts` — `makeMockCtx`; use as the
    mock-context pattern for tests; do NOT modify
12. `packages/game-engine/src/state/zones.types.ts` — `CardExtId`,
    `PlayerZones`; do NOT modify
13. `packages/game-engine/src/turn/turnPhases.types.ts` — `TurnStage`;
    do NOT modify
14. `packages/game-engine/src/game.ts` — **will be modified** (replace stubs
    with real implementations); read entirely before modifying
15. `packages/game-engine/src/index.ts` — **will be modified** (export helpers)
16. `docs/ai/REFERENCE/00.2-data-requirements.md` section 7.1 — zone arrays
    contain only `CardExtId` strings
17. `docs/ai/REFERENCE/00.6-code-style.md` — full style rules with examples

If any document conflicts, **higher-authority documents win**.

---

## Pre-Flight Findings (2026-04-10)

Pre-flight validation confirmed readiness. Key findings:

### Prerequisites Verified

- WP-008A complete (2026-04-10) — all move contracts, validators, gating exported
- WP-007B complete — `G.currentStage`, `advanceStage` wired in `play` phase
- WP-005B complete — `shuffleDeck`, `makeMockCtx` available
- WP-006A complete — `CardExtId`, `PlayerZones` available
- Build: `pnpm --filter @legendary-arena/game-engine build` exits 0
- Tests: 80/80 passing, 0 failing

### Risks Identified and Mitigations

1. **`makeMockCtx` shape for move tests** — `makeMockCtx` returns a
   `SetupContext` with `{ ctx, random: { Shuffle } }`. Move integration tests
   need `events.endTurn` (spy) and `random.Shuffle` (for reshuffle).
   **Mitigation:** Build a minimal inline mock in the test file that satisfies
   both `ShuffleProvider` and the events interface. Do NOT modify `makeMockCtx`
   (locked file). Follow the pattern established in WP-007B's turn loop test.

2. **`shuffleDeck` parameter type** — `shuffleDeck` expects `ShuffleProvider`
   (`{ random: { Shuffle } }`). boardgame.io's move context has
   `ctx.random.Shuffle` at runtime, so the move can pass the context directly
   via structural typing. No adapter needed.

3. **`game.ts` has `playCard` and `endTurn` stubs but no `drawCards`** — The
   existing stubs must be replaced with imports from `coreMoves.impl.ts`.
   `drawCards` must be added as a new move entry in the `moves` object.
   `advanceStage` must remain untouched.

4. **Immer mutation model** — boardgame.io 0.50.x uses Immer. Move functions
   mutate the `G` draft directly and return `void`. `zoneOps.ts` helpers return
   new arrays, and the move function assigns them back to zone properties
   (e.g., `playerZones[id].hand = result.to`). Immer tracks property
   assignments — this is correct and expected.

5. **`endTurn` move name vs `ctx.events.endTurn()`** — The move named `endTurn`
   in the `moves` object is the player-facing action. It internally calls
   `ctx.events.endTurn()` (the boardgame.io framework function for turn
   advancement). These are distinct — do not conflate them.

---

## Critical Context (Post-WP-008A Reality)

- WP-008A is complete. The following are exported from `@legendary-arena/game-engine`:
  - Types: `CoreMoveName`, `DrawCardsArgs`, `PlayCardArgs`, `EndTurnArgs`,
    `MoveResult`, `MoveError`
  - Arrays: `CORE_MOVE_NAMES`
  - Gating: `MOVE_ALLOWED_STAGES`, `isMoveAllowedInStage`
  - Validators: `validateDrawCardsArgs`, `validatePlayCardArgs`,
    `validateEndTurnArgs`, `validateMoveAllowedInStage`
- `game.ts` currently has:
  - `playCard` stub (no-op, returns void)
  - `endTurn` stub (no-op, returns void)
  - `advanceStage` (delegates to `advanceTurnStage` — must remain untouched)
  - No `drawCards` move yet
  - `MoveContext` type alias defined locally: `FnContext<LegendaryGameState> & { playerID: PlayerID }`
- `shuffleDeck(cards, context: ShuffleProvider)` returns a new shuffled array;
  never mutates input; uses `context.random.Shuffle`
- `ShuffleProvider = { random: { Shuffle: <T>(deck: T[]) => T[] } }`
- `PlayerZones` has 5 keys: `deck`, `hand`, `discard`, `inPlay`, `victory`
- `G.playerZones` is `Record<string, PlayerZones>`, keyed by player ID ("0", "1", etc.)
- `G.currentStage` is `TurnStage` — used for stage gating in every move

---

## Scope Contract (Read Carefully)

### WP-008B DOES:

- Create `src/moves/zoneOps.ts` — `moveCardFromZone` and `moveAllCards`
  (pure helpers, no boardgame.io imports, return new arrays)
- Create `src/moves/coreMoves.impl.ts` — `drawCards`, `playCard`, `endTurn`
  implementations following three-step ordering
- Create `src/moves/coreMoves.integration.test.ts` — 9 integration tests
- Modify `src/game.ts` — replace `playCard` and `endTurn` stubs, add
  `drawCards`, import from `coreMoves.impl.ts`
- Modify `src/index.ts` — export `moveCardFromZone`, `moveAllCards` if needed
- Add required `// why:` comments on `ctx.events.endTurn()`, reshuffle path,
  and `zoneOps.ts` extraction rationale

### WP-008B DOES NOT:

- No card effects (attack, recruit, keywords, costs)
- No HQ, city, KO zone, or villain deck logic
- No buying or fighting mechanics
- No win/loss conditions
- No database, network, or filesystem access in moves
- No UI or server changes
- No modification of WP-008A contract files (types, validate, gating)
- No modification of WP-007A/B files (turnPhases, turnLoop)
- No modification of WP-006A/B files (zones, playerInit, pilesInit)
- No modification of `makeMockCtx` or `shuffleDeck`
- No `Math.random()` anywhere
- No `throw` in any move function
- No `.reduce()` in zone operations
- No `boardgame.io` import in `zoneOps.ts`
- No speculative helpers, convenience abstractions, or "while I'm here"
  improvements

If something feels questionable, it almost certainly belongs in a **later WP**.

---

## Files Allowed to Change (Allowlist)

Only the following files **may be created or modified** during this execution:

    packages/game-engine/src/moves/zoneOps.ts                    — new
    packages/game-engine/src/moves/coreMoves.impl.ts             — new
    packages/game-engine/src/moves/coreMoves.integration.test.ts — new
    packages/game-engine/src/game.ts                              — modified
    packages/game-engine/src/index.ts                             — modified

Any modification outside this list must satisfy the Runtime Wiring Allowance
below, or it is a **hard failure**.

---

## Files Explicitly Locked (Read-Only)

The following files **must not be changed**:

    packages/game-engine/src/moves/coreMoves.types.ts             — WP-008A contract
    packages/game-engine/src/moves/coreMoves.validate.ts          — WP-008A contract
    packages/game-engine/src/moves/coreMoves.gating.ts            — WP-008A contract
    packages/game-engine/src/moves/coreMoves.contracts.test.ts    — WP-008A tests
    packages/game-engine/src/turn/turnPhases.types.ts             — WP-007A contract
    packages/game-engine/src/turn/turnPhases.logic.ts             — WP-007A contract
    packages/game-engine/src/turn/turnPhases.validate.ts          — WP-007A contract
    packages/game-engine/src/turn/turnLoop.ts                     — WP-007B
    packages/game-engine/src/turn/turnLoop.integration.test.ts    — WP-007B tests
    packages/game-engine/src/test/mockCtx.ts                      — shared test helper
    packages/game-engine/src/state/zones.types.ts                 — WP-006A contract
    packages/game-engine/src/state/zones.validate.ts              — WP-006A contract
    packages/game-engine/src/setup/playerInit.ts                  — WP-006B
    packages/game-engine/src/setup/pilesInit.ts                   — WP-006B
    packages/game-engine/src/setup/shuffle.ts                     — WP-005B
    packages/game-engine/src/setup/buildInitialGameState.ts       — WP-005B
    packages/game-engine/src/types.ts                             — WP-005B/006A/007B

These are dependencies, not execution targets.

---

## Runtime Wiring Allowance

This WP adds `drawCards` to `LegendaryGame.moves` and replaces `playCard`
and `endTurn` stubs with real implementations. Per
`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`, minimal wiring edits
to the following files are permitted solely to restore type and assertion
correctness:

- `game.test.ts` — if existing move-count or move-name assertions need
  updating after adding `drawCards`

No new behavior may be introduced. If and only if existing structural test
assertions fail due to the new move entry, those assertions may be updated
to reflect the new count or name list. No other changes are permitted under
this allowance.

Any file modified under this clause must be documented in the execution summary.

---

## Locked Values (Do Not Re-Derive)

### Three-Step Move Ordering (Non-Negotiable)

Every move must follow this exact sequence:
1. Validate args (call validator from WP-008A)
2. Check stage gate (call `isMoveAllowedInStage` from WP-008A)
3. Mutate `G` (via `zoneOps.ts` helpers)

No other ordering is permitted.

### MoveError shape (imported from WP-008A — never redefine)

`{ code: string; message: string; path: string }`

### PlayerZones keys and move-to-zone mapping

- `drawCards`: `deck` → `hand`
- `playCard`: `hand` → `inPlay`
- `endTurn`: `inPlay` + `hand` → `discard`

### Stage gates (from MOVE_ALLOWED_STAGES)

- `drawCards`: allowed in `['start', 'main']`
- `playCard`: allowed in `['main']`
- `endTurn`: allowed in `['cleanup']`

### TurnStage values (use constants, never hardcode in move implementations)

`'start'` | `'main'` | `'cleanup'`

### zoneOps.ts helper signatures

- `moveCardFromZone(fromZone, toZone, cardId)` → `{ from, to, found }`
- `moveAllCards(fromZone, toZone)` → `{ from, to }`

Both return new arrays. Neither mutates inputs.

### Required // why: comments

- `endTurn` `ctx.events.endTurn()`: boardgame.io manages player rotation;
  manual index rotation is forbidden
- `drawCards` reshuffle path: standard Legendary rule when draw pile is
  exhausted; `ctx.random` ensures determinism
- `zoneOps.ts`: extracting zone ops makes them independently testable and
  keeps each move function under 30 lines

---

## Behavioral Constraints (Hard Rules)

- One Work Packet only — `WP-008B`
- No scope expansion
- No cross-WP implementation
- No convenience abstractions beyond `zoneOps.ts` helpers
- Every move follows three-step ordering exactly
- `zoneOps.ts` helpers return new arrays — never mutate inputs
- `zoneOps.ts` must not import `boardgame.io`; no `Math.random`
- No `.reduce()` in zone operations — use `for...of`
- Reshuffle in `drawCards` uses `shuffleDeck` from `shuffle.ts` — never
  `Math.random()`
- `ctx.events.endTurn()` is the only way to end a turn — manual player
  index rotation is forbidden
- Moves never throw — return void on invalid input
- `G` must remain JSON-serializable after every move
- ESM only, `node:` prefix on all Node built-in imports
- Test file uses `.test.ts` extension
- Test uses `node:test` and `node:assert` only — no `boardgame.io/testing`
- Test uses inline mock context (following WP-007B pattern) — do NOT modify
  `makeMockCtx`
- WP-008A contract files must not be modified

---

## EC-Mode Execution Rules

- All code changes must map to **EC-008B**
- No commit may be created without passing EC hooks
- Bugs are treated as **EC violations**, not ad-hoc fixes
- If an EC step cannot be satisfied:
  - Stop
  - Report the failure
  - Do not improvise

---

## Execution Outcome Requirements

By the end of WP-008B execution:

- All EC-008B checklist items must pass
- All tests must pass (80 existing + 9 new = 89 minimum)
- No forbidden files modified
- `zoneOps.ts` exports `moveCardFromZone` and `moveAllCards` (pure, no
  boardgame.io)
- `drawCards` draws cards, reshuffles discard when deck exhausted
- `playCard` moves a card from hand to inPlay
- `endTurn` moves all cards to discard and calls `ctx.events.endTurn()`
- All three moves follow three-step ordering
- `game.ts` wires real implementations (stubs replaced, `drawCards` added)
- `advanceStage` remains untouched in `game.ts`
- Architecture boundaries remain intact

---

## Verification Steps

```bash
# Step 1 — build after wiring implementations
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no Math.random in new files
grep -r "Math.random" packages/game-engine/src/moves/zoneOps.ts packages/game-engine/src/moves/coreMoves.impl.ts
# Expected: no output

# Step 4 — confirm zoneOps.ts has no boardgame.io import
grep "boardgame.io" packages/game-engine/src/moves/zoneOps.ts
# Expected: no output

# Step 5 — confirm WP-008A contract files were not modified
git diff --name-only packages/game-engine/src/moves/coreMoves.types.ts packages/game-engine/src/moves/coreMoves.validate.ts packages/game-engine/src/moves/coreMoves.gating.ts
# Expected: no output (all three files untouched)

# Step 6 — confirm no require() in new files
grep -r "require(" packages/game-engine/src/moves/zoneOps.ts packages/game-engine/src/moves/coreMoves.impl.ts packages/game-engine/src/moves/coreMoves.integration.test.ts
# Expected: no output

# Step 7 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in Files Allowed to Change
#           (plus game.test.ts if runtime wiring allowance was exercised)

# Step 8 — confirm test file has no boardgame.io import
grep "boardgame.io" packages/game-engine/src/moves/coreMoves.integration.test.ts
# Expected: no output
```

---

## Post-Execution Obligations (Do Not Skip)

After successful execution, but **before committing**:

- Run the **PRE-COMMIT-REVIEW template** (`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`)
- Update:
  - `docs/ai/STATUS.md` — what moves are now functional; what a match can do
    (draw, play, end turn in rotation)
  - `docs/ai/DECISIONS.md` — at minimum: why `zoneOps.ts` helpers return new
    arrays rather than mutating `G` directly; why moves return void on
    validation failure rather than throwing
  - `docs/ai/work-packets/WORK_INDEX.md` — mark WP-008B complete with date
- Document any files modified under the Runtime Wiring Allowance
- Commit using EC-mode hygiene rules (`EC-008B:` prefix)

Execution is not considered complete until these steps are done.

---

## Final Instruction to Claude

This invocation is a **contract**, not a suggestion.

If there is any uncertainty about whether a change belongs in WP-008B:

**DO NOT IMPLEMENT IT.**
