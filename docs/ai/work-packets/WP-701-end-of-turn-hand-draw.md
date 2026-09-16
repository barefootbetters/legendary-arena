# WP-701 — End-of-turn hand draw (Game Engine turn flow — determinism re-pin)

**Status:** Draft 2026-09-16 (EC-738; D-24520 reserved)
**Layer:** Game Engine (turn flow / setup / simulation harnesses)
**User-Visible Surface:** play.legendary-arena.com (indirect — game difficulty / fidelity)
**Hard-deps:** D-23605 (`drawCardsIntoHand` + `HAND_SIZE` single draw primitive) ✅, D-22002 (dual turn-end path: `endTurn` move + `advanceStage`→`advanceTurnStage`) ✅, D-24513 (extra-turn `events.endTurn({next})`) ✅, D-24512 (`deferredHandInjection` / Electromagnetic Bubble) ✅, D-24300 (`handSizeOverrides` / Doc Ock) ✅

## Goal

Draw each player's new hand at the **END** of their turn (after the hand + in-play discard),
and deal every player's **initial** hand at setup — instead of the current start-of-turn
`turn.onBegin` auto-draw (the D-10003/D-23605 MVP shortcut, where `endTurn` discards but does
not draw and the next `onBegin` fills). This restores the tabletop between-turns state: a
player holds `HAND_SIZE` (6) cards during opponents' turns, so Master Strikes and every "each
player discards / reveals" effect act on real hands instead of whiffing on the empty hand a
player is left with today. Live-observed: Player 0 sat at 0 cards through both of Magneto's
Master Strikes (log lines 1.1.2 / 13.1.2, `magneto-Legacy-Virus-LOG-2p.txt`).

## User-Visible Impact

`play.legendary-arena.com` — the game becomes **more faithful and harder**: Master Strikes
("each player discards down to N" / "KO a Hero from hand" / etc.) now land on full hands, and
cross-player effects see real hands. Purely a turn-flow correctness fix; no new mechanic, no
UI surface. Live-on-surface is operator-pending (D-24026).

## Assumes

- **`packages/game-engine/src/game.ts`** — the play-phase `turn.onBegin` hook holds the
  auto-draw block (fill to `HAND_SIZE` / `handSizeOverrides`, `deckReshuffled` event, consume
  `handSizeOverrides` + `deferredHandInjections`, `hasDrawnThisTurn = true`); the `turn.onEnd`
  hook and the `advanceStage` move delegating to `advanceTurnStage`.
- **`packages/game-engine/src/moves/coreMoves.impl.ts`** — the `endTurn` move discards
  in-play + hand → discard, then honours a queued extra turn, then `events.endTurn()`.
- **`packages/game-engine/src/turn/turnLoop.ts`** — `advanceTurnStage`: at `cleanup`
  (`getNextTurnStage === null`) it calls `events.endTurn()` (the second turn-end path, D-22002),
  today with **no discard**.
- **`packages/game-engine/src/moves/drawCards.logic.ts`** — `HAND_SIZE = 6` and
  `drawCardsIntoHand(zones, count, shuffleProvider)` (count-based, reshuffle-on-empty).
- **`packages/game-engine/src/setup/{buildInitialGameState,playerInit}.ts`** — setup shuffles
  each starting deck and initializes `hand: []` (no starting draw today). `SetupContext`
  satisfies `ShuffleProvider` (`random.Shuffle`).
- **`packages/game-engine/src/simulation/onBeginParity.ts`** (`applyOnBeginParity`) — the
  shared mirror the three bgio-bypassing harnesses use to replicate the onBegin resets + draw:
  `simulation.runner.ts`, `par.aggregator.ts`, and `test/fixtures/runFixture.ts`.
- **Determinism oracles:** `PRE_WP080_HASH` (`replay/replay.execute.test.ts`), the sentinel
  `sentinel-core-doom-2p.replay.json` `finalStateHash` + `expected` block
  (`test/fixtures/replayFixtures.test.ts`), and `hashGameState.ts`.
- **`packages/game-engine/src/rules/mastermindHandlers.ts`** — every strike resolver loops
  `Object.keys(playerZones).sort()` and reads each player's `hand` (the effect that starts
  landing).
- Baseline: `origin/main` at the D-24520 reserve (`claude/wp-endturn-draw`).

## Context (Read First)

- `docs/ai/DECISIONS.md` — D-10003 / D-23605 (the onBegin auto-draw this WP moves), D-22002
  (dual turn-end path), D-24513 (extra-turn), D-24512 (deferredHandInjection), D-24300
  (handSizeOverrides), D-24081 (messages/logMeta hash exclusion).
- `docs/ai/ARCHITECTURE.md` §Phase & Turn Transitions, §Determinism; `.claude/rules/architecture.md`
  §Determinism (`ctx.random.*` only; replay-identical) + §Phase & Turn Transitions (`// why:`
  on every `events.*`).
- `.claude/skills/legendary-game-engine/SKILL.md` — move contract, turn stages.
- ewiki `wiki/turn-system.md` — the turn-stage / draw narrative (companion; update if it
  describes the onBegin draw).

## Scope (In)

- **New shared helper `applyEndOfTurnCleanup(G, playerID, shuffleProvider)`**
  (`packages/game-engine/src/moves/endOfTurnCleanup.logic.ts`, pure — no boardgame.io import):
  (1) discard `inPlay` + `hand` → `discard` (the sweep moved out of the `endTurn` move); (2)
  fill `hand` to `handSizeOverrides?.[playerID] ?? HAND_SIZE` via `drawCardsIntoHand`; (3) push
  the `deckReshuffled` notable event on a realized reshuffle; (4) consume `handSizeOverrides`;
  (5) consume `deferredHandInjections`. The single end-of-turn cleanup site.
- **`endTurn` move (`coreMoves.impl.ts`):** replace the inline discard sweep with a call to
  `applyEndOfTurnCleanup(G, playerID, { random })` (add `random` to the destructure). Guards,
  extra-turn handling, and `events.endTurn()` unchanged — the cleanup precedes the extra-turn
  branch, so an extra turn begins with the freshly drawn hand.
- **`advanceTurnStage` (`turnLoop.ts`):** at the `cleanup` branch (before the extra-turn /
  normal `events.endTurn()`), call `applyEndOfTurnCleanup(gameState, context.currentPlayer,
  shuffleProvider)`. Widen `TurnLoopContext` with a `shuffleProvider` (`{ random }`); callers
  (`game.ts` `advanceStage`, the three harnesses) pass it. This makes the second turn-end path
  discard **and** draw (fixing its latent no-discard, D-22002).
- **`game.ts` `turn.onBegin`:** REMOVE the auto-draw block (fill + reshuffle event + overrides
  + injection consume + `hasDrawnThisTurn = true`). KEEP every reset (currentStage,
  turnEconomy, villainRevealedThisTurn, hasDrawnThisTurn=false, hasActedThisTurn,
  hasHealedThisTurn, deferred-grant clear, logMeta). The incoming player already holds their
  hand (drawn at their prior end-of-turn, or at setup for their first turn).
- **Setup initial hands (`buildInitialGameState.ts`):** after each `buildPlayerState`, draw
  `HAND_SIZE` into that player's hand via `drawCardsIntoHand(zones, HAND_SIZE, context)` in seat
  order — the tabletop starting-hand deal. `playerInit.ts` still initializes `hand: []`; the
  draw is applied in the setup loop.
- **Harness parity (`onBeginParity.ts` + the three callers):** `applyOnBeginParity` KEEPS the
  onBegin resets and DROPS the draw (the draw now rides `applyEndOfTurnCleanup`, reached via
  the `endTurn` move / `advanceTurnStage` the harnesses already dispatch). Remove the turn-1
  pre-loop `applyOnBeginParity` draw in `simulation.runner.ts` / `par.aggregator.ts` (setup
  deals turn-1 hands); thread `shuffleProvider` into the harnesses' `advanceTurnStage` calls.
- **Determinism re-pin (HONEST):** regenerate `PRE_WP080_HASH` and the sentinel
  `sentinel-core-doom-2p.replay.json` `expected` block (finalStateHash + messages +
  snapshotPerTurn + outcome). Verify the new sentinel state is CORRECT (the core Dr. Doom
  Master Strike now discards full hands) before re-pinning — never accept a hash blindly.
- **Tests:** rewrite the `game.test.ts` onBegin auto-draw tests to onEnd/setup semantics; flip
  the setup shape tests (`buildInitialGameState.shape.test.ts`, `playerInit.shape.test.ts`) to
  `HAND_SIZE`; add an end-of-turn-cleanup unit test (discard then draw to HAND_SIZE; reshuffle
  event; override + injection consume) and a between-turns test (a non-active player holds
  `HAND_SIZE` and a Master Strike discards from it); audit the hand-count tests the harness map
  flags.

## Out of Scope

- **The Hypnotic Charm keyword** (bug #1, sequenced after this WP).
- **Rebalancing** — this WP makes the game harder by restoring fidelity; it does NOT re-tune
  schemes/masterminds to compensate. The PAR fidelity numbers shift (that is the point).
- **The full PAR profile sweep** — `data/par/profile/v1/**` is gitignored and NOT CI-gated
  (ci.yml comment); the diagnostic refreshes separately, not in this PR.
- **The `advanceStage`-as-client-end-turn UX** — the arena-client already has no Pass-Priority
  end-turn button; no client change.

## Files Expected to Change

- `packages/game-engine/src/moves/endOfTurnCleanup.logic.ts` — **new** — the shared helper.
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — `endTurn` uses the helper.
- `packages/game-engine/src/turn/turnLoop.ts` — **modified** — `advanceTurnStage` cleanup calls
  the helper; `TurnLoopContext` gains `shuffleProvider`.
- `packages/game-engine/src/game.ts` — **modified** — remove the onBegin draw block (keep
  resets); pass `shuffleProvider` to `advanceTurnStage` from `advanceStage`.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — deal initial hands.
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — drop the draw, keep resets.
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — remove turn-1
  pre-loop draw; thread `shuffleProvider`.
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — same.
- `packages/game-engine/src/test/fixtures/runFixture.ts` — **modified** — thread `shuffleProvider`;
  `rotateToNextTurn` resets only (no draw).
- `packages/game-engine/src/replay/replay.execute.ts` — **modified iff** it invokes
  `advanceTurnStage` (thread `shuffleProvider`).
- Determinism pins: `packages/game-engine/src/replay/replay.execute.test.ts` (`PRE_WP080_HASH`);
  `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` (+ its test)
  — **re-pinned (generated)**.
- Test files — **modified/new** — the enumerated set the core change forces:
  - `packages/game-engine/src/moves/endOfTurnCleanup.logic.test.ts` — **new** — the helper.
  - `packages/game-engine/src/game.test.ts` — onBegin auto-draw tests → onEnd/setup semantics.
  - `packages/game-engine/src/setup/buildInitialGameState.shape.test.ts` — hand now `HAND_SIZE`.
  - `packages/game-engine/src/setup/playerInit.shape.test.ts` — `buildPlayerState` still `hand: []`
    (setup draws in the loop, not `buildPlayerState`) — confirm/keep.
  - `packages/game-engine/src/simulation/onBeginParity.test.ts` — parity mirror = resets only.
  - `packages/game-engine/src/turn/turnLoop.test.ts` — every `TurnLoopContext` gains the
    `cleanup` closure; the cleanup-branch cases use a zone-bearing state and assert cleanup ran.
  - `packages/game-engine/src/turn/turnLoop.integration.test.ts` — same (`cleanup` closure +
    zone-bearing state on the cleanup-branch case).
  - `packages/game-engine/src/moves/coreMoves.integration.test.ts` — the `endTurn` case now
    expects the post-cleanup DRAWN hand (an honest expectation change, not a weakened test).
  - `packages/game-engine/src/rules/mastermindHandlers.test.ts` + any full-match hand-count
    tests that relied on a 0-card between-turns hand — audited/updated case-by-case.

> Broad but single-layer (game-engine only). The harness parity + determinism re-pin are the
> load-bearing work; the design routes every turn-end (both D-22002 paths, live + all three
> harnesses) through one `applyEndOfTurnCleanup` site so replays stay byte-consistent.

## Non-Negotiable Constraints

- Full file contents for every new/modified file; ESM; Node v22+; human-style code.
- Determinism: the draw uses the existing `drawCardsIntoHand` / `ShuffleProvider` (`ctx.random`)
  — no new randomness source; given identical setup + moves the game replays identically.
- All zone mutations via `zoneOps` / the draw primitive; the helper is a pure function (no
  boardgame.io import); moves never throw.
- Every new `events.endTurn()`-adjacent change keeps its `// why:` comment.
- **Determinism re-pin is honest:** `PRE_WP080_HASH` + the sentinel re-pin because setup now
  deals hands and the draw moved — regenerate them, verify the new state is CORRECT (Master
  Strikes discard full hands), and never edit a fixture to mask an unexpected change. If a hash
  moves in a way the design does not predict, STOP and investigate.
- **Locked contract values:** see the EC `## Locked Values`.

## Contract

- `HAND_SIZE = 6` unchanged; `drawCardsIntoHand(zones, count, shuffleProvider)` unchanged.
- `applyEndOfTurnCleanup(G, playerID, shuffleProvider)`: discard inPlay+hand → fill to
  `handSizeOverrides?.[playerID] ?? HAND_SIZE` → reshuffle event → consume overrides →
  consume injections. Called once per turn-end for the ending player, from the `endTurn` move
  and the `advanceTurnStage` cleanup branch (never both for one turn-end).
- Setup deals `HAND_SIZE` to every seat in seat order.
- `turn.onBegin` performs resets only (no draw). `applyOnBeginParity` performs resets only.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §10.
- **No conflict:** restores the tabletop end-of-turn draw / between-turns hand — strictly more
  faithful.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — a turn-flow rule, nothing bought.
- **Determinism preservation:** deterministic and replay-faithful (same primitive, same RNG
  source). The re-pin is EXPECTED: setup deals hands and the draw moves, so `PRE_WP080_HASH`
  and the sentinel `finalStateHash` regenerate to new, verified-correct values. Seed-PAR is a
  separate competitive surface (Seed-PAR fixtures re-generate if gated — assess at execution).

## Funding Surface Gate

N/A — no funding surface. A turn-flow correctness fix only.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. After setup, every player's hand holds `HAND_SIZE` cards (initial deal).
2. A player who ends their turn discards their hand + in-play, then immediately draws a new
   `HAND_SIZE` hand — so during opponents' turns they hold `HAND_SIZE` cards.
3. `turn.onBegin` no longer draws; a player begins their turn with the hand drawn at their
   prior end-of-turn (or setup for their first turn), and all onBegin resets still fire.
4. A Master Strike ("each player discards") now discards from a non-active player's full hand
   (verified against `resolveMagnetoStrike` / `resolveCoreDoomStrike`); the live 0-card whiff
   is gone.
5. Both turn-end paths (the `endTurn` move and `advanceStage`→`advanceTurnStage` at cleanup)
   discard **and** draw via `applyEndOfTurnCleanup`; an extra turn (D-24513) begins with the
   freshly drawn hand.
6. `handSizeOverrides` (Doc Ock) and `deferredHandInjections` (Electromagnetic Bubble) consume
   at the end-of-turn fill and land on the intended next hand.
7. All three harnesses (`simulation.runner`, `par.aggregator`, `runFixture`) replicate the
   end-of-turn draw; the record→`runFixture` round-trip and the sentinel replay stay consistent.
8. `PRE_WP080_HASH` and the sentinel `finalStateHash` are re-pinned to regenerated,
   verified-correct values; no fixture was edited to hide a change.
9. Engine suite green; `pnpm -r build` exits 0.

## Verification Steps

- `pnpm --filter @legendary-arena/game-engine build` — exits 0.
- `pnpm --filter @legendary-arena/game-engine test` — green (new cleanup/between-turns tests,
  rewritten onBegin tests, re-pinned oracles).
- Confirm the sentinel `finalStateHash` change corresponds to a CORRECT state: the core Dr.
  Doom Master Strike now discards full hands (inspect the regenerated `messages` / snapshots).
- `pnpm -r build && pnpm -r --no-bail test` — whole-repo green (harness/replay parity).
- `pnpm cards:check` / coverage checks — unaffected (no card-data change), confirm still green.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + whole-repo suites green; `pnpm -r build` exits 0.
- [ ] `PRE_WP080_HASH` + sentinel re-pinned to regenerated values, correctness verified.
- [ ] **Live-on-surface (D-24026):** a real match on play.legendary-arena.com shows a player
      holding a full hand during an opponent's turn and a Master Strike making them discard.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` D-24520 flipped to Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node → `✅`; `pnpm roadmap:counts:check` exits 0.
- [ ] ewiki `turn-system.md` updated if it describes the onBegin draw.
- [ ] No files outside `## Files Expected to Change` were modified.

## Reserved Decision (lands at execution)

D-24520 — draw the new hand at end of turn (via `applyEndOfTurnCleanup`, reached from both
D-22002 turn-end paths) and deal initial hands at setup, superseding the D-10003/D-23605 onBegin
auto-draw; the determinism re-pin (PRE_WP080 + sentinel) is expected and honest. See DECISIONS.md.

## Lint Gate Self-Review (00.3)

- **§1 structure / §2 constraints:** all sections present; Out of Scope excludes ≥2 (Hypnotic
  Charm; rebalancing; PAR sweep; client UX); full-files + determinism + honest-re-pin constraints. **PASS.**
- **§3 Assumes / §4 Context:** every touched file + decision cited (D-10003/23605/22002/24513/
  24512/24300); ARCHITECTURE §Phase/Turn + §Determinism. **PASS.**
- **§5 files:** every file new/modified with role; single-layer justified. **PASS.**
- **§6 naming:** `HAND_SIZE`, `handSizeOverrides`, `deferredHandInjections`, zone names per 00.2. **PASS.**
- **§7 deps:** no new npm dependency. **PASS.**
- **§8 boundaries:** game-engine only; helper is pure (no boardgame.io import). **PASS.**
- **§9/§10:** `pnpm` only; no env var. **PASS.**
- **§11 auth:** N/A.
- **§12 tests:** `node:test`; deterministic; new cleanup/between-turns + re-pinned oracles. **PASS.**
- **§13/§14/§15:** exact `pnpm` commands; 9 observable criteria; DoD has STATUS/DECISIONS/
  WORK_INDEX + D-24026 live item + honest re-pin. **PASS.**
- **§16 code-style:** shared helper (three consumers: endTurn move, advanceTurnStage, harnesses)
  — abstraction justified; explicit control flow; `// why:` on the events + the re-pin. **PASS.**
- **§17 Vision:** clause numbers (§1/§2/§10), no-conflict, NG-1 line, determinism/re-pin line. **PASS.**
- **§18 prose-vs-grep / §20 funding / §21 API:** N/A with justification. **PASS.**
