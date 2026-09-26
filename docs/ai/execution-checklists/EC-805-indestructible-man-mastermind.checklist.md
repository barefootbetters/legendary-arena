# EC-805 — Indestructible Man Mastermind (Execution Checklist)

**Source:** docs/ai/work-packets/WP-768-indestructible-man-mastermind.md
**Layer:** Game Engine

## Before Starting
- [ ] Baseline `origin/main` includes #2412.
- [ ] If WP-757 or WP-769 merged first, rebase onto it and keep every `fightMastermind` branch and projection field.
- [ ] `pnpm install` and `pnpm -r build` → 0. Engine suite green.
- [ ] Anchors unchanged:
  - `fightMastermind` gate, guards and `defeatMastermindTacticCore`;
  - `resolveMastermindFightCost`;
  - `dispatchTacticOnFight` (`:1300`);
  - `mastermindStrikeHandler` (`:1204`);
  - the `villainRevealedThisTurn` reset (`game.ts:~860`);
  - `playTopVillainDeckCards`;
  - `freeRecruitFromHqByFilter`;
  - `victoryPointValueForCard`.
- [ ] Verify the 4 tactic ids against `mastermind.setup.ts:279`.

## Locked Values (do not re-derive)
- Mastermind `bkwd/indestructible-man`. Assassin prefix `bkwd-villain-elite-assassins-`.
- `fightMastermind({ shuffleAssassinIds?: [CardExtId, CardExtId] })`.
  - For Indestructible Man, a call without it is a silent return at any attack value. Excessive Violence is ignored.
  - With it, validate in order:
    1. exactly 2 distinct ids;
    2. each is an eligible Assassin in the **acting** player's Victory Pile;
    3. `canShuffleFight`;
    4. stage `main`;
    5. the block-all guards;
    6. the tactics / Final Blow gate.
  - Skip the spendable-attack check. Keep `hasHealedThisTurn`.
  - Then mutate:
    1. Shuffle the pair in.
    2. Set the flag.
    3. Branch: `isFinalBlow` → `awardMastermindOnFinalBlow`; otherwise `defeatMastermindTacticCore(G, ctx, { random }, events)`. No attack is spent.
    4. Set `G.hasActedThisTurn` and the Diamond Form edge, as the attack path does.
- `mastermind/indestructibleMan.logic.ts` exports `isIndestructibleMan`, `listEligibleAssassins`, `canShuffleFight`, and `shuffleIntoVillainDeck(G, playerId, cardIds, shuffle | null)`. It has no boardgame.io import. A `null` shuffle means append + log, and never throws.
  - The move passes `random.Shuffle`.
  - The strike passes `resolveShuffleFunction(strikeContext)`.
  - The tactics pass `shuffleContext.random.Shuffle`.
- Flag: `G.indestructibleManShuffleUsedThisTurn?: true`. It is omit-when-absent. A guarded `delete` clears it in **both** `game.ts` onBegin and `simulation/onBeginParity.ts` `applyOnBeginParity`.
- MOVE_MAPs: `simulation.runner.ts`, `par.aggregator.ts`, `test/fixtures/runFixture.ts` and `replay/replay.execute.ts` all change to `(context, args) => fightMastermind(context as never, args as never)`.
- **Strike:** shuffle the current player's lowest-VP Assassin in (ties by `extId`). If there is none, each player (ascending) gains a Wound via `gainWoundForPlayer`.
- **Secrets of Indestructibility:** auto-KO up to 2 Wounds, hand first, then discard.
- **International Arms Dealer:**
  - `freeRecruitFromHqByFilter(..., { kind: 'hero-class', values: ['tech'] })` for a `[hc:tech]` Hero (parks if ≥2 are eligible).
  - Then each other player reveals a tech Hero from hand or gains a Wound (the `resolveCrushingShockwave` precedent).
  - The synchronous clauses resolve before a parked gain is answered.
- **Unveil Project Four:** each other player discards every hand card where `String(cardStats.cost|attack|recruit)` or a defined `String(cardVictoryPoints[id])` contains `'4'`. Keep cards with no `cardStats` entry. The log says "(approximate)".
- **Those three tactics, when not the last tactic** (`tacticsDeck.length > 0`): build `RevealContext { random: shuffleContext.random, ctx: { currentPlayer } }` and call `playTopVillainDeckCards(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, 2)`.
- **Mad Monk:** `recordHollowEffect` with `{ cardId, cardType: 'villain', timing: 'onFight', mechanic: 'tactic-becomes-villain', reason: 'unsupported-keyword', turn: G.logMeta?.turn ?? 0 }`.
- **Projection:** `UIMastermindState.shuffleFight?: { requiredCount; isUsedThisTurn; eligibleAssassins: { extId; display }[] }`. Present only for Indestructible Man, listing the active player's cards. Passed through the filter with a conditional spread.
- **Bot:** no plain `fightMastermind` for Indestructible Man. When `canShuffleFight`, one intent using the lowest-VP pair (`victoryPointValueForCard`, ties by `extId`).

## Guardrails
- The move gate, the bot and the projection all read the one set of helpers in `indestructibleMan.logic.ts`, so they cannot diverge.
- The only randomness is `random.Shuffle` on the shuffle-in. No other reshuffle.
- The flag is never seeded. Core `finalStateHash` and the PAR oracles stay unchanged.
- Engine only. No client change and no Epic face.
- Moves never throw. No `.reduce()`.

## Required `// why:` Comments
- Attack can never fight him (card text); a normal call returns silently.
- The operator decision that the player chooses the Assassins, passed as move args (the WP-757 pattern).
- The mid-game Villain Deck shuffle-in: a first, beside D-24160, with its `random.Shuffle` rationale.
- The omit-when-absent turn flag.
- The strike's lowest-VP auto-pick, which is not a choice.
- The Project Four approximation (operator decision).
- The Mad Monk hollow.

## Files to Produce
- `packages/game-engine/src/mastermind/indestructibleMan.logic.ts` + test — **new**
- `moves/fightMastermind.ts` (+ test), `types.ts`, `game.ts`, `simulation/onBeginParity.ts` — **modified**
- `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, `test/fixtures/runFixture.ts`, `replay/replay.execute.ts` — **modified** (MOVE_MAP args)
- `rules/mastermindHandlers.ts` (+ test), `rules/tacticHandlers.ts` (+ test) — **modified**
- `ui/uiState.types.ts`, `ui/uiState.build.ts` (+ test), `ui/uiState.filter.ts` (deep-copies `display`), `ui/uiState.filter.test.ts` — **modified**
- `simulation/ai.legalMoves.ts` (+ test) — **modified**
- `scripts/coverage/tactic-provenance.json`, `data/metadata/effect-implementation-index.json` — **modified / regenerated**
- `docs/ai/DECISIONS.md` (D-24601), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0.
- [ ] Engine suite passes; `pnpm -r --no-bail test` → 0 fail.
- [ ] A seeded 1p Indestructible Man sim terminates with no turn-1 win.
- [ ] `effect-index:check`, `sim:runtime-observed:check` and `sim:coverage --check` → 0.
- [ ] Core oracles unchanged.
- [ ] D-24601 Active. STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026) together with WP-770.

## Common Failure Smells
- The bot still wins on turn 1 → the plain `fightMastermind` intent is still emitted, or the move isn't refusing attack.
- The bot never shuffle-fights in sim → a MOVE_MAP still drops `args`, or `onBeginParity` never clears the flag.
- A second shuffle-fight in the same turn succeeds → the flag isn't set, or isn't read by `canShuffleFight`.
- Another player's Assassin is accepted → validation checks existence, not the acting player's Victory Pile.
- The Villain Deck order is unchanged after the shuffle → the cards were appended without calling `random.Shuffle`.
- A core hash moved → the flag was seeded, or the branch isn't gated on the Mastermind id.
