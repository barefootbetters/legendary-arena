# WP-732 — Mastermind Defeat: Finish the Turn Before the Game Ends (Game Engine)

**Status:** Draft 2026-09-21
**Primary Layer:** Game Engine (only)
**User-Visible Surface:** play.legendary-arena.com (the win no longer cuts the turn short; the winning player keeps scoring Victory Points to end of turn)
**Dependencies:** none blocking — all cited systems are on `main` (WP-367/D-24159 final-turn latch, WP-411/D-24223 top-level `endIf`, WP-502/D-24306 End-Game-early, WP-687/D-24504 Final Blow, D-24518 [no WP — a direct bug fix] vanquish pending-choice drop)
**Baseline:** drafted against `origin/main` @ `78c624de`

---

## Goal

After this session, defeating the Mastermind no longer ends the match
**immediately mid-turn**. Per the Universal Rules v23 "End of the Game: Players
Win" box, when the final Mastermind Tactic is defeated the current player still
resolves that Tactic's Fight ability and **"may finish the rest of their turn in
case they want to fight a few more Villains"** — accruing more Victory Points
(defeated Villains, rescued Bystanders) before the game ends. Victory is
**assured** at the moment of the vanquish (a scheme-loss or a deck running out
during the remainder of that turn does not take the win away), but the game
actually ends at the **end of the winning player's turn**, resolving
heroes-win. The default (non–Final-Blow) 4th-Tactic vanquish and the optional
Final Blow 5th fight both defer identically. "Evil Wins" is unchanged and
remains immediate ("Don't finish the turn").

---

## Assumes

- `packages/game-engine/src/endgame/endgame.types.ts` declares
  `ENDGAME_CONDITIONS` (a plain const object; **no** canonical-array drift test
  pins its keyset — verified: only `endgame.evaluate`, `finalTurn.logic`,
  `game.ts`, `gameRules.checks`, `endMatchEarly`, and tests reference it by
  member, none enumerate its keys). Members incl. `MASTERMIND_DEFEATED`,
  `SCHEME_LOSS`, `MATCH_ENDED_EARLY`, `FINAL_TURN_TRIGGERED`, `FINAL_TURN_TIE`.
- `packages/game-engine/src/endgame/endgame.evaluate.ts` `evaluateEndgame(G)` is
  the **sole** endgame authority; the top-level `LegendaryGame.endIf`
  (`game.ts:452`) returns `evaluateEndgame(G) ?? undefined`, so a `null` return
  keeps the game running and a non-null return sets `ctx.gameover`. Confirmed at
  `game.ts:433-452`.
- `packages/game-engine/src/moves/fightMastermind.ts`:
  `defeatMastermindTacticCore` sets
  `G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1` in its
  `areAllTacticsDefeated` **else** (non–Final-Blow) branch (`:354`) and emits the
  `mastermindDefeated` notable event (`:373`); `awardMastermindOnFinalBlow` sets
  the same counter on the Final Blow 5th fight (`:544`). The D-24518
  `dropAllPendingPlayerChoices(G)` call is guarded on
  `G.counters[MASTERMIND_DEFEATED] === 1` (`:421`).
- `packages/game-engine/src/game.ts` play-phase `turn.onEnd` (`:900`) runs the
  onTurnEnd rule pipeline then `resolveFinalTurnTieIfUnresolved(G)` (`:919`);
  `turn.onMove` runs `latchFinalTurnIfDeckExhausted` + `applyPileDepletionResourceLoss`.
- `packages/game-engine/src/endgame/finalTurn.logic.ts` is the precedent for a
  latch-then-resolve-at-turn-end pair: `latchFinalTurnIfDeckExhausted` sets a
  non-terminal counter mid-turn, `resolveFinalTurnTieIfUnresolved` promotes it at
  `turn.onEnd` **only if `evaluateEndgame(G) === null`** (so a win/loss during
  the final turn pre-empts the tie).
- **Three** engine harnesses reimplement the bgio turn loop and each decides
  termination from `evaluateEndgame` — ALL three must resolve the deferred win
  identically or they diverge:
  - `packages/game-engine/src/simulation/simulation.runner.ts` — terminates when
    `evaluateEndgame(G)` returns non-null (`:589`) and manually mirrors
    `turn.onEnd` at its endTurn boundary (`:695-719`); already mirrors
    `turn.onMove`'s `applyPileDepletionResourceLoss` at `:660`.
  - `packages/game-engine/src/test/fixtures/runFixture.ts` — the fixture/replay
    oracle: reads `evaluateEndgame` after each move (`~:447`), asserts no moves
    past a non-null endgame (`~:427-434`), and rotates turns via
    `rotateToNextTurn` (`~:293-323`, onBegin resets only). `scripts/record-game-fixture.mjs`
    records sentinels THROUGH `runFixture`, so its `finalStateHash` is what §G
    re-pins — a deferred win it does not resolve would bake a WRONG non-terminal
    hash.
  - `packages/game-engine/src/replay/replay.execute.ts` — the determinism/hash
    harness; deliberately skips `turn.onMove`/`onEnd` effects (header `~:21-31`),
    rotates turns without the promotion.
  The sim↔runFixture round-trip outcome-equality contract is asserted in
  `simulation.captureMoves.test.ts` (`~:302-306`) — green today only because its
  mock registry never reaches a real endgame.
- No committed replay/sentinel fixture defeats a Mastermind:
  `sentinel-core-doom-2p.replay.json` contains no `fightMastermind` and no
  `mastermindDefeated`/`schemeLoss` token (verified). PAR baselines and the
  coop-win-rate harness DO exercise Mastermind wins via simulation.

If any of the above is false, re-verify against `main` before proceeding.

---

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` §"End of the Game: Players Win"
  (lines ~817-838) — the authoritative behavior source (cite it in D-24553):
  - "When the Mastermind has no more Tactic cards under them, the players win
    the game!"
  - "When fighting the final Mastermind Tactic, the current player still does
    that Tactic's 'Fight' ability. That player may finish the rest of their turn
    in case they want to fight a few more Villains."
  - "As soon as the Mastermind has no more Tactics under them, victory is
    assured, and players will win the game even if the final Tactic's 'Fight'
    ability would achieve the Scheme's 'Evil Wins' condition or cause the Hero
    Deck or Villain Deck to run out."
  - Contrast §"Evil Wins" (~line 847): "the Mastermind immediately wins the game
    for evil, and all players lose. Don't finish the turn." — the asymmetry is
    deliberate: a loss is immediate; the Mastermind win finishes the turn.
- `docs/ai/ARCHITECTURE.md` §Architectural Principles #1 (determinism), #2
  (engine owns truth) and §Persistence Boundaries (snapshots are counts-only —
  the new latch is a `G.counters` key, compliant).
- `.claude/rules/architecture.md` §Phase & Turn Transitions (no direct
  `ctx.phase`; `// why:` on transitions), §G and ctx Are Runtime-Only.
- `.claude/skills/legendary-game-engine/SKILL.md` — engine enforcement.
- `docs/ai/DECISIONS.md` — D-24159 (final-turn latch), D-24223 (top-level
  endIf → ctx.gameover), D-24306 (End-Game-early supersession), D-24504 (Final
  Blow), D-24518 (vanquish pending-choice drop). Reserved **D-24553** lands at
  execution.
- `packages/game-engine/src/moves/fightMastermind.ts`,
  `endgame/endgame.evaluate.ts`, `endgame/finalTurn.logic.ts`,
  `simulation/simulation.runner.ts` — read in full before editing.
- User memory `reference_hashed_g_field_dual_repin` — the dual-oracle re-pin
  discipline (record-game-fixture sentinel + `PRE_WP080_HASH`).

---

## Scope (In) — Game Engine only

### A) New endgame latch constant

- `packages/game-engine/src/endgame/endgame.types.ts` — **modified** — add
  `MASTERMIND_DEFEATED_PENDING: 'mastermindDefeatedPending'` to
  `ENDGAME_CONDITIONS`, with a `// why:` (mirroring `FINAL_TURN_TRIGGERED`)
  explaining it is the **victory-assured** latch: set the instant the last
  Tactic (or the Final Blow) is defeated, NOT a game-ending condition on its own
  (`evaluateEndgame` does not terminate on it), promoted to the terminal
  `MASTERMIND_DEFEATED` at `turn.onEnd`.

### B) Defer the win at the vanquish

- `packages/game-engine/src/moves/fightMastermind.ts` — **modified**:
  - `defeatMastermindTacticCore`, the `areAllTacticsDefeated` **else** branch
    (non–Final-Blow, `:354`): set
    `G.counters[MASTERMIND_DEFEATED_PENDING] = 1` **instead of**
    `MASTERMIND_DEFEATED`. Keep the "victory assured" log line and the
    `mastermindDefeated` notable event (the win IS assured — announce it), but do
    NOT terminate. `// why:` cites the Players-Win rule + D-24553.
  - `awardMastermindOnFinalBlow` (`:544`): set `MASTERMIND_DEFEATED_PENDING = 1`
    instead of `MASTERMIND_DEFEATED`. Keep the Mastermind-card Victory-Pile award,
    the bystander rescue, the clear of `finalBlowPending`, the log + notable event.
  - **D-24518 pending-choice drop (relocate to turn-end):** the `if (G.counters[
    MASTERMIND_DEFEATED] === 1) dropAllPendingPlayerChoices(G)` guard (`:421`)
    now never fires at the vanquish (the terminal counter is not set there). This
    is **correct and intended**: the game no longer ends at the vanquish, so a
    pending choice parked by the final Tactic's Fight ability is legitimately
    resolvable during the rest of the winning player's turn (it was previously
    silently dropped — a latent bug this fix also cures). **Remove the
    vanquish-site drop** from `fightMastermind.ts` and **MOVE the whole
    `dropAllPendingPlayerChoices` helper** (currently module-private at `:445`,
    sole call `:422`) **into the new `mastermindVictory.logic.ts`** (§D): it is
    pure (touches only `pending*` fields), so it belongs with the promotion
    helper and keeps that module boardgame.io-free — do NOT merely export it from
    `fightMastermind.ts` (that would drag the move module's runtime import graph
    into an endgame helper). Its docstring + the "add any new `pending*` field
    here too" pointer, and the complete-pending-field-set drift test (today in
    `fightMastermind.test.ts`), move WITH the function (§F).

### C) Endgame evaluator precedence (the victory-assured window)

- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **modified** — new
  fixed precedence (a `// why:` block explains the inversion — once victory is
  assured the rulebook's normal loss-before-win order no longer applies for the
  remainder of that turn):
  1. `MATCH_ENDED_EARLY >= 1` → `tie` + `endedEarly` (unchanged, still first —
     a player-ended match supersedes even an assured win).
  2. `MASTERMIND_DEFEATED >= 1` (terminal) → `heroes-win`. **Moved above
     `SCHEME_LOSS`:** the terminal counter is only ever set at `turn.onEnd`
     promotion, i.e. only when victory was already assured, so it must win over
     a `SCHEME_LOSS` that also latched during the finished turn.
  3. `MASTERMIND_DEFEATED_PENDING >= 1` → **return `null`** (game continues) and
     therefore **suppress** the scheme-loss and tie branches below for the rest
     of the turn — the "victory is assured even if Evil Wins / a deck-out would
     trigger" clause.
  4. `SCHEME_LOSS >= 1` → `scheme-wins` (unchanged; the immediate "Evil Wins /
     Don't finish the turn" path when NO Mastermind latch is set).
  5. `FINAL_TURN_TIE >= 1` → `tie` (unchanged, last).

### D) Promote the latch at turn end (the new real end-of-game moment)

- `packages/game-engine/src/endgame/mastermindVictory.logic.ts` — **new** — a
  pure helper module (no boardgame.io import, side-effects limited to
  `G.counters` / `G.messages` / the pending-choice fields, independently
  unit-testable, mirroring `finalTurn.logic.ts`), holding BOTH:
  - `promoteMastermindVictoryIfPending(G)`: if `MASTERMIND_DEFEATED_PENDING >= 1`
    and the terminal `MASTERMIND_DEFEATED` is not yet set, set
    `MASTERMIND_DEFEATED = 1`, call `dropAllPendingPlayerChoices(G)` (any choice
    still parked at the true end of game — the relocated D-24518 invariant), and
    push a "the turn ends — the Mastermind is vanquished, heroes win" log line.
    Idempotent.
  - `dropAllPendingPlayerChoices(G)`: moved here verbatim from
    `fightMastermind.ts` (with its docstring + the "add any new `pending*` field
    here too" pointer).

- `packages/game-engine/src/game.ts` — **modified** — play-phase `turn.onEnd`:
  call `promoteMastermindVictoryIfPending(G)` **before**
  `resolveFinalTurnTieIfUnresolved(G)`, so the promoted terminal makes
  `evaluateEndgame(G) !== null` and the deck-exhaustion tie correctly skips (the
  existing `evaluateEndgame === null` guard in `resolveFinalTurnTieIfUnresolved`).

### E) Turn-loop-harness parity — ALL THREE harnesses must promote (PS-1)

The engine has **three** bgio-bypassing turn loops that decide termination from
`evaluateEndgame`. A deferred win they do not resolve leaves them disagreeing on
the single most common outcome (a Mastermind win) and would bake a WRONG
non-terminal `finalStateHash` when §G re-records a sentinel. **Patch all three**
(patch-none leaves the sim running Mastermind wins to `maxTurns`; patch-one makes
the sim and the replay oracle disagree):

- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — at
  the endTurn boundary (the manual `turn.onEnd` mirror, `:695-719`), call
  `promoteMastermindVictoryIfPending(gameState)` — mirroring the existing
  `applyPileDepletionResourceLoss` `turn.onMove` parity at `:660`. Without it a
  Mastermind-win game runs to `maxTurns` and is mis-recorded as stuck.
- `packages/game-engine/src/test/fixtures/runFixture.ts` — **modified** — call
  `promoteMastermindVictoryIfPending` at its turn-end rotation
  (`rotateToNextTurn`, `~:293-323`) so a recorded Mastermind-win move list
  terminates faithfully here too (this is the oracle `record-game-fixture.mjs`
  re-records through — §G depends on it).
- `packages/game-engine/src/replay/replay.execute.ts` — **modified** —
  `replayGame` is a flat dispatch loop (`~:256-258`) with **no** turn-end
  rotation site (unlike `runFixture`/the sim), so call
  `promoteMastermindVictoryIfPending(gameState)` **once after the move loop,
  before `computeStateHash(gameState)` (`~:260-261`)**. Confirm it is a no-op on
  non-Mastermind fixtures so `PRE_WP080_HASH` stays stable (lowest-stakes of the
  three: no committed fixture defeats a Mastermind, and it feeds only
  `replay.verify`'s self-check).

### F) Tests

- `packages/game-engine/src/endgame/endgame.evaluate.test.ts` — **modified** —
  new precedence cases: pending-latch alone → `null`; pending + `SCHEME_LOSS` →
  `null` (suppressed); terminal `MASTERMIND_DEFEATED` + `SCHEME_LOSS` →
  `heroes-win`; pending + `MATCH_ENDED_EARLY` → `tie`/`endedEarly` (early still
  first); terminal alone → `heroes-win`. **INVERT (do not delete) the existing
  test** `'loss takes priority when both schemeLoss and mastermindDefeated are
  set'` (`~:66-75`): its expected outcome flips `scheme-wins` → `heroes-win`
  under the new terminal-before-`SCHEME_LOSS` order, because the terminal counter
  is only ever set post-promotion (victory already assured). Add a `// why:`
  citing the rulebook + D-24553 so the change reads as an intentional
  product-behavior change, not grader-gaming (Reward Integrity).
- `packages/game-engine/src/moves/fightMastermind.test.ts` — **modified** — the
  vanquish now sets `MASTERMIND_DEFEATED_PENDING` (not the terminal counter) and
  `evaluateEndgame` returns `null` right after (game not over); a choice parked
  by the final Tactic's Fight ability **survives** the vanquish. The
  complete-`pending*`-field-set drift test (today asserting "cleared on the
  vanquish") **moves to `mastermindVictory.logic.test.ts`** with the
  `dropAllPendingPlayerChoices` function and now asserts "cleared on the turn-end
  promotion." The Final Blow 5th fight sets pending, not terminal.
- `packages/game-engine/src/endgame/mastermindVictory.logic.test.ts` — **new** —
  promotion sets terminal only when pending is latched, is idempotent, drops a
  still-pending choice, and is a no-op when pending is unset; plus the relocated
  complete-`pending*`-field-set drift test.
- `packages/game-engine/src/simulation/simulation.captureMoves.test.ts` —
  **modified** — add a **real-registry** Mastermind-win round-trip asserting
  `runFixture` outcome === sim outcome === `heroes-win` (the existing
  `~:302-306` equality contract is currently green only under a mock registry
  that never reaches endgame — this proves PS-1's fix).
- `packages/game-engine/src/game.test.ts` — **modified (if needed)** — an
  integration assertion that a vanquish + a full turn-end yields `ctx.gameover`
  heroes-win (only if an existing game-level test pins the immediate end).

### G) Determinism re-pin (EMPIRICAL — verify, re-pin honestly if a pin moves)

- Mastermind-win games now terminate **later** (at `turn.onEnd`, after the
  winning turn's remaining plays + hand-discard/draw-6 cleanup), so any pinned
  fixture/replay OR PAR/coop baseline whose outcome depends on a Mastermind
  defeat WILL shift. **Expectation:** the sentinel `finalStateHash` +
  `PRE_WP080_HASH` do **not** move (no committed replay defeats a Mastermind —
  verified), but **PAR baselines and coop-win-rate baselines re-pin** (the sim's
  Mastermind-win turn-count / outcome distribution changes once the win resolves
  at turn end). Run the suites; re-pin **honestly** per
  `reference_hashed_g_field_dual_repin` (record-game-fixture sentinel +
  `PRE_WP080_HASH` constant) and regenerate the PAR/coop baselines through their
  documented generators. **Never edit a pin to force green; never re-route a
  counter to a non-hashed channel to dodge a pin.** If a replay/sentinel hash
  moves unexpectedly, STOP and confirm the fixture genuinely defeats a
  Mastermind before re-pinning.

### H) Governance

- `docs/ai/DECISIONS.md` — **modified** — land **D-24553**.
- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` —
  **modified** — close-out (WP-732 → done/✅, EC-769 → Done, counts).

---

## Out of Scope

- **No change to "Evil Wins" / scheme-loss immediacy.** A `SCHEME_LOSS` with NO
  Mastermind latch set still ends the game immediately (Don't finish the turn) —
  pinned by a regression case.
- **No change to the Final Blow setup flag or its plumbing** (WP-686/687). This
  WP only changes *when the win counter goes terminal* for both the normal and
  Final Blow vanquish.
- **No new UIState field / no client change.** The assured win is already
  surfaced by the existing `mastermindDefeated` notable event and, at turn end,
  by `ctx.gameover`. A dedicated "victory assured — finish your turn" client
  affordance is a separate, optional follow-up WP, not this fix.
- **No scoring-weight / PAR-formula change.** VP scoring is unchanged; the
  winning player simply accrues more of it by finishing the turn.
- **No deck-exhaustion final-turn mechanic change** beyond the `evaluateEndgame`
  precedence ordering.
- Refactors or cleanups outside Scope (In).

---

## Files Expected to Change

- `packages/game-engine/src/endgame/endgame.types.ts` — **modified** — add `MASTERMIND_DEFEATED_PENDING`
- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **modified** — new precedence (terminal + pending branches)
- `packages/game-engine/src/endgame/mastermindVictory.logic.ts` — **new** — `promoteMastermindVictoryIfPending` + the moved `dropAllPendingPlayerChoices`
- `packages/game-engine/src/moves/fightMastermind.ts` — **modified** — vanquish sets pending; REMOVE the vanquish-site drop call + the `dropAllPendingPlayerChoices` helper (moved to `mastermindVictory.logic.ts`)
- `packages/game-engine/src/game.ts` — **modified** — play-phase `turn.onEnd` promotion call (before the final-turn-tie resolve)
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — endTurn-boundary promotion (sim parity)
- `packages/game-engine/src/test/fixtures/runFixture.ts` — **modified** — turn-end-rotation promotion (fixture/record oracle parity, PS-1)
- `packages/game-engine/src/replay/replay.execute.ts` — **modified** — turn-end-rotation promotion (replay/hash harness parity, PS-1)
- `packages/game-engine/src/endgame/endgame.evaluate.test.ts` — **modified** — precedence cases + inverted loss-vs-win regression
- `packages/game-engine/src/endgame/mastermindVictory.logic.test.ts` — **new** — promotion helper + relocated pending-field drift test
- `packages/game-engine/src/moves/fightMastermind.test.ts` — **modified** — pending-not-terminal + parked-choice-survives; drop-drift test moves out
- `packages/game-engine/src/simulation/simulation.captureMoves.test.ts` — **modified** — real-registry Mastermind-win sim↔runFixture round-trip parity (PS-1)
- `packages/game-engine/src/game.test.ts` — **modified if needed** — turn-end vanquish → gameover integration pin
- engine state-hash oracles + PAR/coop baselines — **verify; re-pin/regenerate ONLY where a Mastermind-defeat fixture actually shifts** — expected: no sentinel/replay move (none defeat a Mastermind); PAR + coop baselines re-pin

This set is a single layer (Game Engine) and ~13 code/test files; heavyweight
and two-session because it touches endgame precedence, the fight move, the
turn-end hook, ALL THREE bgio-bypassing turn loops (sim + fixture-runner +
replay), and a determinism/PAR re-pin.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Never `Math.random()` — all randomness via `ctx.random.*`. This WP adds none.
- Moves never throw; `fightMastermind` still returns void. Only `Game.setup()` throws.
- Never persist `G`/`ctx`; the new latch is a `G.counters` integer key —
  snapshots stay counts-only.
- No `.reduce()` in the new logic; explicit `for...of` / `if`.
- Every `ctx.events.setPhase()` / `endTurn()` needs a `// why:` — this WP adds
  neither (it reads/writes counters at the existing `turn.onEnd`).
- ESM only, Node v22+, `node:` prefix; `.test.ts` only; full file contents.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`; `mastermindVictory.logic.ts`
  has no boardgame.io import (a pure helper, like `finalTurn.logic.ts`).

**Packet-specific:**
- **The vanquish sets `MASTERMIND_DEFEATED_PENDING`, never the terminal
  `MASTERMIND_DEFEATED`.** The terminal counter is set at exactly ONE new site:
  `promoteMastermindVictoryIfPending` at `turn.onEnd` (+ the sim mirror).
- **Victory-assured suppression:** while pending is latched, `evaluateEndgame`
  returns `null` and MUST NOT return `scheme-wins` or `tie`. Terminal
  `MASTERMIND_DEFEATED` is checked before `SCHEME_LOSS`.
- **`MATCH_ENDED_EARLY` stays highest priority** — checked before both the
  terminal and pending Mastermind branches.
- **Relocate, do not delete, the D-24518 invariant:** a WON final state carries
  no dangling pending choice — the drop moves from the vanquish site to the
  turn-end promotion. The vanquish must leave a parked choice resolvable.
- **Turn-loop parity is mandatory across ALL THREE harnesses** (PS-1):
  `simulation.runner.ts`, `test/fixtures/runFixture.ts`, and
  `replay/replay.execute.ts` each promote at their turn-end rotation. Patching
  only the sim makes the sim and the replay/record oracle disagree on Mastermind
  wins and would bake a wrong non-terminal `finalStateHash` at §G re-record time.
- **Determinism:** re-pin honestly and only where a Mastermind-defeat fixture
  actually shifts; never edit a pin to force green.

**Session protocol (STOP conditions):**
- If a sentinel/replay `finalStateHash` or `PRE_WP080_HASH` moves, STOP and
  confirm the fixture defeats a Mastermind before re-pinning — an off-path move
  means the latch leaked into a non-Mastermind fixture.
- If the sim reports Mastermind-win games as stuck/maxTurns, OR a real-registry
  `runFixture` round-trip of a Mastermind win yields a different outcome than the
  sim, STOP — a turn-loop harness (§E: sim / runFixture / replay) is missing the
  promotion.
- If removing the vanquish-site drop makes a parked choice dangle on the victory
  screen, STOP — the turn-end promotion must run the relocated drop.

**Locked contract values (paste verbatim — do not paraphrase):**
- New latch: `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED_PENDING = 'mastermindDefeatedPending'`
- Terminal (unchanged value): `ENDGAME_CONDITIONS.MASTERMIND_DEFEATED = 'mastermindDefeated'`
- `evaluateEndgame` precedence: `MATCH_ENDED_EARLY` → `MASTERMIND_DEFEATED`
  (heroes-win) → `MASTERMIND_DEFEATED_PENDING` (return `null`, suppress below) →
  `SCHEME_LOSS` (scheme-wins) → `FINAL_TURN_TIE` (tie)
- Turn-end promotion helper: `promoteMastermindVictoryIfPending(G)` in
  `packages/game-engine/src/endgame/mastermindVictory.logic.ts`, called in
  play-phase `turn.onEnd` BEFORE `resolveFinalTurnTieIfUnresolved(G)` and at the
  sim endTurn boundary
- DECISIONS entry: D-24553

---

## Vision Alignment

**Vision clauses touched:** §1/§2 (card/rules semantics — a rulebook-faithful
win-timing fix), §3 (player trust & fairness — the winning player is no longer
robbed of end-of-turn Victory Points), §8/§3 (determinism / RNG — none added),
§22 (replay faithfulness), NG-1 (no pay-to-win).

**Conflict assertion:** No conflict — this WP restores rulebook-faithful
behavior and preserves every touched clause.

- §1/§2 — Behavior now matches Universal Rules v23 "Players Win" verbatim
  (cited in D-24553); "Evil Wins" immediacy is preserved.
- §3 — Every seat finishes its turn symmetrically; the fix never advantages one
  seat and sells no outcome. The engine stays the sole authority on when the win
  fires.
- §8/§3 — No `Math.random()`, no wall-clock; the latch and promotion are pure
  deterministic counter writes.
- §22 — Off-path (no Mastermind defeat) is byte-identical; the sentinel/replay
  fixtures don't defeat a Mastermind so no oracle is expected to move. A
  Mastermind-win game genuinely ends later by design; the transition is
  deterministic and replay-faithful. PAR/coop baselines re-pin honestly.
- NG-1 — A rules-fidelity fix, never a paid advantage.

**Non-Goal proximity check:** none of NG-1..7 crossed.

**Determinism preservation:** All new state transitions are deterministic pure
`G.counters` writes; no RNG, no I/O. The non-Mastermind path is byte-identical.
Re-pin is empirical and honest (documented in D-24553).

## Funding Surface Gate

N/A — this WP fixes an engine win-timing rule; it touches no global-nav /
registry-viewer / profile funding affordance, no donation or tournament-funding
copy, and no funding channel.

---

## Acceptance Criteria

- [ ] Defeating the last Tactic (Final Blow OFF) sets
      `MASTERMIND_DEFEATED_PENDING = 1`, NOT `MASTERMIND_DEFEATED`;
      `evaluateEndgame(G)` returns `null` immediately after (game continues).
- [ ] While `MASTERMIND_DEFEATED_PENDING` is latched, a `SCHEME_LOSS` set during
      the remainder of the turn does NOT end the game (`evaluateEndgame` returns
      `null`).
- [ ] At `turn.onEnd`, `promoteMastermindVictoryIfPending` sets terminal
      `MASTERMIND_DEFEATED`; `evaluateEndgame` then returns `heroes-win` even
      when `SCHEME_LOSS` is also set.
- [ ] `MATCH_ENDED_EARLY` still supersedes an assured win (`tie` + `endedEarly`).
- [ ] The Final Blow 5th fight sets `MASTERMIND_DEFEATED_PENDING`, awards the
      Mastermind card once, and the win resolves at turn end.
- [ ] A pending choice parked by the final Tactic's Fight ability survives the
      vanquish (resolvable during the turn) and is cleared at the turn-end
      promotion (no dangling choice on the victory screen).
- [ ] A `SCHEME_LOSS` with no Mastermind latch still ends the game immediately
      (regression: "Evil Wins" is not deferred).
- [ ] The simulation harness terminates a Mastermind-win game at the end of the
      winning turn (not `maxTurns`/stuck); coop-win-rate + PAR record a win. A
      real-registry Mastermind-win round-trip yields the SAME `heroes-win`
      outcome through the sim, `runFixture`, and the replay/hash harness (all
      three promote).
- [ ] `pnpm -r build` and `pnpm -r test` exit 0. Determinism/PAR/coop pins are
      re-pinned honestly where a Mastermind-defeat fixture actually shifts, and
      the change is documented in D-24553; `git diff --name-only` shows only
      files in `## Files Expected to Change`.
- [ ] D-24026 live verification: on play.legendary-arena.com, defeating the
      Mastermind lets the current player keep playing to end of turn (fight
      Villains / rescue Bystanders for VP), and the match ends heroes-win at the
      end of that turn (evidence recorded in STATUS.md). Confirm the client does
      NOT treat the `mastermindDefeated` notable event (fired at the vanquish) as
      end-of-match — no premature freeze / gameover overlay before `ctx.gameover`
      arrives at turn end (RS-5; verification-only — a client affordance is a
      separate follow-up per Out of Scope).

---

## Verification Steps

```pwsh
# 1 — engine builds + endgame/fight/promotion/sim tests
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
# Expected: exits 0; precedence + pending-not-terminal + promotion + parked-choice cases pass

# 2 — target the endgame precedence + promotion
pnpm --filter @legendary-arena/game-engine test -- --test-name-pattern "mastermind|endgame|promote|pending"
# Expected: victory-assured suppression + turn-end promotion asserted

# 3 — determinism: no off-path move (no committed fixture defeats a Mastermind)
Select-String -Path "packages\game-engine\src\**\*hash*.test.ts" -Pattern "PRE_WP080|finalStateHash"
# Expected: sentinel/replay pins unchanged; inspect the diff

# 4 — PAR / coop baselines (re-pin only if a Mastermind-win distribution shifts)
pnpm --filter @legendary-arena/game-engine test -- --test-name-pattern "coopWinRate|par"
# Expected: green after honest baseline regeneration (documented in D-24553)

# 5 — whole-repo scope confirmation
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` exits 0; `pnpm -r test` exits 0
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] `docs/ai/STATUS.md` updated — includes the D-24026 live-on-surface
      verification (a Mastermind win finishes the turn, then ends heroes-win,
      observed on play.legendary-arena.com)
- [ ] `docs/ai/DECISIONS.md` has D-24553 (incl. the empirical PAR/coop re-pin note)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-732 row checked off with the date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-769 flipped Pending → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-732 node `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

---

## Lint Gate Self-Review (00.3)

- **§1 Structure** — PASS. All required sections present and non-empty; Out of
  Scope lists 6 exclusions, once, before Files Expected to Change.
- **§2 Constraints** — PASS. Engine-wide + packet-specific + session-protocol
  STOP clauses + locked values; full-file-contents required; 00.6 cited.
- **§3 Assumes** — PASS. Every touched system with a confirmed line anchor
  (`fightMastermind.ts:354/421/544`, `game.ts:452/900/919`, `simulation.runner.ts:589/660/695`);
  the "no fixture defeats a Mastermind" fact stated; re-verify-if-false stated.
- **§4 Context** — PASS. The rulebook passage quoted with line anchors, the
  Evil-Wins contrast, ARCHITECTURE/rules/DECISIONS/source cited.
- **§5 Files** — PASS. Every file marked new/modified with a one-line change; the
  ~13-file single-layer count (incl. all three bgio-bypassing turn loops per
  PS-1) justifies heavyweight/two-session.
- **§6 Naming** — PASS. `MASTERMIND_DEFEATED_PENDING` / `MASTERMIND_DEFEATED` /
  `promoteMastermindVictoryIfPending` / `SCHEME_LOSS` / `MATCH_ENDED_EARLY` used
  verbatim; boolean/counter naming per source.
- **§7 Dependency** — PASS. No new dependency; `mastermindVictory.logic.ts`
  imports no boardgame.io (pure helper, `finalTurn.logic.ts` precedent).
- **§8 Boundaries** — PASS. Engine decides the win; no client/registry/server
  change; snapshots stay counts-only (a `G.counters` key); no DB.
- **§9 Windows** — PASS. `pwsh` + `Select-String` verification.
- **§10 Env vars** — N/A. None added or read.
- **§11 Auth** — N/A. No authentication surface.
- **§12 Tests** — PASS. `node:test`; no boardgame.io import in the pure helper;
  regression pin for the immediate Evil-Wins path; negative/idempotent promotion
  assertions.
- **§13 Verification** — PASS. Exact `pnpm` commands with expected output; the
  determinism grep scoped to `*hash*.test.ts`.
- **§14 Acceptance** — PASS. 9 binary, observable items incl. live-verify.
- **§15 Definition of Done** — PASS. STATUS/DECISIONS/WORK_INDEX/EC_INDEX +
  scope + roadmap; `User-Visible Surface` = play.legendary-arena.com; the
  live-on-surface item is present and not test-satisfiable.
- **§16 Code Style** — PASS. `promoteMastermindVictoryIfPending` is a single
  small pure helper co-located with `finalTurn.logic.ts` (its latch-then-resolve
  sibling); explicit control flow; `// why:` on each counter-write site and the
  precedence inversion. No premature abstraction — one helper, four call sites
  (live `turn.onEnd` + the three bgio-bypassing harness mirrors: sim,
  `runFixture`, `replay.execute`), the same single-source rationale as the
  final-turn resolver.
- **§17 Vision Alignment** — PASS. Clause numbers (§1/§2, §3, §8, §22, NG-1),
  no-conflict assertion, NG proximity, determinism line.
- **§18 Prose-vs-Grep** — PASS. Verification step 3 greps hash-pin tokens in
  `*hash*.test.ts` only; this WP file is outside that path; no forbidden-token
  enumeration in code prose is introduced.
- **§19 Bridge-vs-HEAD** — N/A (no repo-state-snapshot artifact authored here).
- **§20 Funding Surface** — N/A with justification (Funding Surface Gate above).
- **§21 API Catalog** — N/A with justification: no HTTP endpoint and no
  `apps/server/src/**` library function is added, modified, or removed.
