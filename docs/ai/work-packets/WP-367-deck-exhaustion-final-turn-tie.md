# WP-367 — Deck-Exhaustion Final Turn → Tie (Game Engine)

**Status:** Done
**Primary Layer:** Game Engine / Implementation
**Dependencies:** WP-010 (ENDGAME_CONDITIONS counter contract + evaluateEndgame), WP-014A (villain-deck reveal), WP-135 (shared hero-deck reservoir), WP-067 (UIState progress projection)
**User-Visible Surface:** play.legendary-arena.com

---

## Session Context

WP-010 locked the `ENDGAME_CONDITIONS` counter contract and made boardgame.io's `endIf` delegate entirely to the pure `evaluateEndgame`; WP-135 added the shared `G.heroDeck` reservoir (depletes permanently, no reshuffle, D-13503); WP-014A's `performVillainReveal` reshuffled the villain discard back into the deck on exhaustion — this packet adds a latched deck-exhaustion end condition on top of those without redefining their outputs.

---

## Goal

After this session the engine implements the rulebook's deck-exhaustion end condition: the moment the Hero Deck **or** Villain Deck reaches zero cards, a sticky "final turn" latch is set; the current turn is played out as a last chance to win or lose; if neither side has won or lost by the end of that turn, the game ends in a **tie**. The villain deck no longer reshuffles from its discard (so exhaustion is terminal). A new `'tie'` value joins the canonical `EndgameOutcome` set, `evaluateEndgame` returns it (ranked last, after all win/loss conditions), and a new optional `UIState.finalTurn` projection carries the warning data for the HUD. The latch never ends the game on its own, and a card effect that refills an emptied deck does not cancel the final turn.

---

## User-Visible Impact

A player at play.legendary-arena.com sees two new things. First, when a shared deck runs out, the game log announces the **final turn** ("The villain deck is empty — this is the final turn…"); the current player can still win (defeat the Mastermind) or lose (complete the Scheme / 8th escape) on that turn. Second, if the final turn ends with no winner, the match ends on the existing endgame screen with a **tie** result ("A deck ran out and the final turn ended with no winner — the game is a tie between good and evil."). Previously the villain deck reshuffled forever, so a deck could never end the game. (The dedicated "final turn" warning banner UI is a follow-on client WP; this packet ships the engine behavior and the projection data it will render.)

---

## Assumes

- WP-010 complete. Specifically:
  - `packages/game-engine/src/endgame/endgame.types.ts` exports `ENDGAME_CONDITIONS` and `EndgameOutcome`
  - `packages/game-engine/src/endgame/endgame.evaluate.ts` exports `evaluateEndgame(gameState)`
- WP-135 complete: `G.heroDeck: CardExtId[]` exists and depletes without reshuffle (D-13503)
- WP-014A complete: `performVillainReveal` owns the villain-deck draw/route pipeline
- WP-067 complete: `UIState.progress` exists; `buildUIState` projects `gameOver` from `evaluateEndgame`
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/DECISIONS.md` and `docs/ai/ARCHITECTURE.md` exist

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Persistence Boundary` and §"The Rule Execution Pipeline" — endgame state is counter-driven; `endIf` delegates to `evaluateEndgame`; no inline counter logic in `game.ts`.
- `packages/game-engine/src/endgame/endgame.evaluate.ts` + `endgame.types.ts` — read entirely; the evaluation order (loss before victory) is contractual.
- `packages/game-engine/src/game.ts` (play-phase `turn` config) — read the `onBegin`/`onEnd` hooks and the phase `endIf` before adding `onMove`.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — read the empty-deck/reshuffle branch that is being removed.
- `packages/game-engine/src/ui/uiState.build.ts` (§14 game-over projection) + `ui/uiState.types.ts` — the omit-when-absent optional-field pattern (`gameOver`, `pendingHeroChoice`).
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:` comments), Rule 9 (`node:` prefix), Rule 13 (ESM only).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+; `node:` prefix on all Node.js built-in imports
- Test files use `.test.ts` — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- The final-turn latch is **sticky**: once `FINAL_TURN_TRIGGERED` is set it is never cleared, even if a deck is refilled.
- The latch alone must **never** end the game — only the resolved `FINAL_TURN_TIE` counter (set at turn end) makes `evaluateEndgame` return a result.
- `evaluateEndgame` checks the tie **last**, after every win/loss condition — a win/loss that fired during the final turn must win/lose, never tie.
- All endgame counter references use `ENDGAME_CONDITIONS.*` constants — never string literals.
- `MatchSnapshotOutcome.result` and any other outcome-typed field must reference `EndgameOutcome` (not a re-spelled literal union) so the outcome set stays single-sourced.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask — never guess.

**Locked contract values:**
- **ENDGAME_CONDITIONS keys** (extended by this packet):
  `ESCAPED_VILLAINS = 'escapedVillains'`, `SCHEME_LOSS = 'schemeLoss'`,
  `MASTERMIND_DEFEATED = 'mastermindDefeated'`,
  `FINAL_TURN_TRIGGERED = 'finalTurnTriggered'`, `FINAL_TURN_TIE = 'finalTurnTie'`
- **EndgameOutcome** (extended by this packet): `'heroes-win' | 'scheme-wins' | 'tie'`
- **Phase names:** `'lobby' | 'setup' | 'play' | 'end'`
- **TurnStage values:** `'start' | 'main' | 'cleanup'`

---

## Debuggability & Diagnostics

- The latch and tie are fully reproducible from identical setup + ordered moves — both are deterministic reads of `G.villainDeck.deck.length` / `G.heroDeck.length` and counter state.
- Both the latch and the tie append a human-readable `G.messages` line for replay inspection.
- Runtime state remains JSON-serializable (two new integer counters; one optional projection object built from primitives).
- Failures localize via the two new counters and the `finalTurn` projection.

---

## Scope (In)

### A) Endgame types & evaluator
- **`src/endgame/endgame.types.ts`** — modified:
  - Add `'tie'` to `EndgameOutcome`.
  - Add `FINAL_TURN_TRIGGERED: 'finalTurnTriggered'` and `FINAL_TURN_TIE: 'finalTurnTie'` to `ENDGAME_CONDITIONS`, each with a `// why:` comment.
- **`src/endgame/endgame.evaluate.ts`** — modified: add a tie branch ranked **last**, reading `FINAL_TURN_TIE`, returning `{ outcome: 'tie', reason: … }`.

### B) Final-turn logic (pure helper)
- **`src/endgame/finalTurn.logic.ts`** — new: `latchFinalTurnIfDeckExhausted(gameState)` (sticky latch on either deck reaching zero) and `resolveFinalTurnTieIfUnresolved(gameState)` (sets the tie counter at turn end iff latched and `evaluateEndgame` is null). No boardgame.io import; JSDoc + `// why:` comments.

### C) Wire the hooks
- **`src/game.ts`** — modified: add `turn.onMove` → `latchFinalTurnIfDeckExhausted(G)`; extend `turn.onEnd` to call `resolveFinalTurnTieIfUnresolved(G)` after the existing onTurnEnd effects. `// why:` comments at both sites.

### D) Stop the villain-deck reshuffle
- **`src/villainDeck/villainDeck.reveal.ts`** — modified: remove the discard→deck reshuffle; an empty villain deck is a no-op reveal that logs a skip message. Drop the now-unused `shuffleDeck` import.

### E) Final-turn projection
- **`src/ui/uiState.types.ts`** — modified: add `UIFinalTurnState { reason; heroDeckRemaining; villainDeckRemaining }` and optional `finalTurn?: UIFinalTurnState` on `UIState`.
- **`src/ui/uiState.build.ts`** — modified: build `finalTurn` only while latched AND not yet game-over; conditional-spread it (omit-when-absent).
- **`src/index.ts`** — modified: re-export `UIFinalTurnState`.

### F) Outcome-typed consumers accept `'tie'`
- **`src/persistence/persistence.types.ts`** — modified: `MatchSnapshotOutcome.result` typed as `EndgameOutcome`.
- **`src/test/fixtures/fixtureSchema.ts`** — modified: fixture `winner` whitelist accepts `'tie'`.
- **`src/simulation/sweep.analyze.ts`** — modified: manifest `winner` validator accepts `'tie'`; tie counts in the non-decisive (`null`) winner bucket with a `// why:`.
- **`apps/server/src/competition/competition.logic.ts`** — modified: map `'tie' → null` for `CompetitiveOutcome` (a tie is not a decisive competitive result; no gauntlet leg), with a `// why:`.

### G) Tests
- `src/endgame/endgame.evaluate.test.ts` — tie branch, tie ranked below win/loss, latch-alone returns null.
- `src/endgame/finalTurn.logic.test.ts` — new: latch on each deck, sticky (refill), idempotent; resolve ties, does-not-tie on win/loss, idempotent, sticky-refill still ties.
- `src/ui/uiState.build.finalTurn.test.ts` — new: absent unlatched; present with per-deck reason; generic reason on refill; suppressed once game-over (tie).
- `src/villainDeck/villainDeck.reveal.test.ts` — replace the reshuffle test with a no-reshuffle assertion.

---

## Out of Scope

- No dedicated "final turn" warning **banner UI** — that is a follow-on arena-client WP; this packet ships only the `UIState.finalTurn` projection data.
- No change to `CompetitiveOutcome`, the `competitive_scores.outcome` DB column, or any migration — a tie maps to the existing SQL `NULL` disposition; whether ties earn ranked/gauntlet credit is a separate ranked-design decision, deferred.
- No new sweep `winnerCounts` tie bucket — ties fall in the existing non-decisive bucket for now.
- No change to the escape limit (8), scheme-twist threshold, or any other existing end condition's timing (all remain immediate).
- No database, network, or filesystem access in any helper; no server or UI-rendering changes beyond the projection + the competition mapping.
- Refactors or "while I'm here" cleanups outside the list above.

---

## Files Expected to Change

- `packages/game-engine/src/endgame/endgame.types.ts` — **modified** — `'tie'` outcome + two counter keys
- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **modified** — tie branch (ranked last)
- `packages/game-engine/src/endgame/finalTurn.logic.ts` — **new** — latch + tie-resolution helpers
- `packages/game-engine/src/endgame/finalTurn.logic.test.ts` — **new** — helper coverage
- `packages/game-engine/src/endgame/endgame.evaluate.test.ts` — **modified** — tie coverage
- `packages/game-engine/src/game.ts` — **modified** — `turn.onMove` latch + `turn.onEnd` tie resolution
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — remove reshuffle
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified** — no-reshuffle test
- `packages/game-engine/src/ui/uiState.types.ts` — **modified** — `UIFinalTurnState` + optional field
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** — build `finalTurn`
- `packages/game-engine/src/ui/uiState.build.finalTurn.test.ts` — **new** — projection coverage
- `packages/game-engine/src/index.ts` — **modified** — re-export `UIFinalTurnState`
- `packages/game-engine/src/persistence/persistence.types.ts` — **modified** — `result: EndgameOutcome`
- `packages/game-engine/src/test/fixtures/fixtureSchema.ts` — **modified** — accept `'tie'`
- `packages/game-engine/src/simulation/sweep.analyze.ts` — **modified** — accept `'tie'`
- `apps/server/src/competition/competition.logic.ts` — **modified** — `'tie' → null`

No other files may be modified.

---

## Vision Alignment

**Vision clauses touched:** §3 (determinism), §22 (replay-faithful scoring), §24 (competitive integrity), §25 (skill measurement), NG-1.

**Conflict assertion:** No conflict: this WP preserves all touched clauses. The tie is a deterministic, counter-driven outcome reproduced identically under replay; it introduces no pay-to-win or persuasive surface (NG-1 untouched).

**Non-Goal proximity check:** None of NG-1..7 are crossed — a tie is a rules outcome, not a monetization or competitive-advantage surface. Competitive scoring is deliberately left unchanged (tie → SQL NULL, no gauntlet leg).

**Determinism preservation:** The latch and tie are pure functions of deck lengths and counters; both are set through `G.counters` (hashed, replay-faithful) and reproduced exactly by the faithful reducer. The removed villain-deck reshuffle used `ctx.random` — removing it reduces, never adds, nondeterminism. Verified: engine build 0, full suite green, `sim:coverage --check` sentinel `finalStateHash` unchanged.

## Funding Surface Gate

§20 N/A — this is a game-rules/engine change; it touches no funding navigation, no registry-viewer or profile funding affordance, no tournament funding channel, and adds no user-visible "donate/support" copy.

---

## Acceptance Criteria

### Endgame types & evaluator
- [x] `EndgameOutcome` includes exactly `'heroes-win' | 'scheme-wins' | 'tie'`
- [x] `ENDGAME_CONDITIONS` includes `FINAL_TURN_TRIGGERED` and `FINAL_TURN_TIE`
- [x] `evaluateEndgame` returns `{ outcome: 'tie', … }` when `FINAL_TURN_TIE ≥ 1` and no win/loss counter is set
- [x] `evaluateEndgame` returns a win/loss (not tie) when a win/loss counter is set alongside `FINAL_TURN_TIE`
- [x] `evaluateEndgame` returns `null` when only `FINAL_TURN_TRIGGERED` is set

### Latch & tie
- [x] `latchFinalTurnIfDeckExhausted` sets `FINAL_TURN_TRIGGERED` when either deck length is 0, is sticky, and logs once
- [x] `resolveFinalTurnTieIfUnresolved` sets `FINAL_TURN_TIE` only when latched and `evaluateEndgame` is null
- [x] No `boardgame.io` import in `finalTurn.logic.ts`

### Villain reshuffle removed
- [x] `performVillainReveal` no longer reshuffles the discard into the deck; an empty deck is a no-op reveal
- [x] `shuffleDeck` import removed from `villainDeck.reveal.ts`

### Projection
- [x] `UIState.finalTurn` is present only while latched and not yet game-over, and is omitted otherwise

### Consumers
- [x] `MatchSnapshotOutcome.result` is typed `EndgameOutcome`
- [x] Fixture and sweep `winner` validators accept `'tie'`
- [x] `competition.logic.ts` maps `'tie' → null`

### Tests
- [x] `pnpm --filter @legendary-arena/game-engine test` exits 0 (1922 pass)
- [x] Test files import `node:test`/`node:assert` only; no `boardgame.io`

### Scope Enforcement
- [x] No files outside `## Files Expected to Change` were modified

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: all tests passing, 0 failing (1922 pass)

# Step 3 — confirm no reshuffle remains in the reveal
Select-String -Path "packages\game-engine\src\villainDeck\villainDeck.reveal.ts" -Pattern "shuffleDeck"
# Expected: no output

# Step 4 — confirm the pure helper has no boardgame.io import
Select-String -Path "packages\game-engine\src\endgame\finalTurn.logic.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 5 — downstream builds + typechecks
pnpm -r build
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exit 0

# Step 6 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [x] **User-visible verification (CONDITIONAL):** surface is `play.legendary-arena.com` — **D-24026 operator-pending on deploy** (in a real match, exhaust a deck → final-turn log line, then a tie result on the endgame screen if no one wins).
- [x] All acceptance criteria above pass
- [x] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [x] `pnpm --filter @legendary-arena/game-engine test` exits 0 (1922 pass)
- [x] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; arena-client test 884 pass
- [x] No `boardgame.io` import in `finalTurn.logic.ts` (confirmed with `Select-String`)
- [x] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)
- [x] `docs/ai/STATUS.md` updated
- [x] `docs/ai/DECISIONS.md` updated — D-24159 (final-turn latch + tie outcome), D-24160 (stop villain reshuffle), D-24161 (competition tie→null)
- [x] `docs/ai/work-packets/WORK_INDEX.md` has WP-367 checked off with today's date
