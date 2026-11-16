# EC-805 — Indestructible Man Mastermind (Execution Checklist)

**Source:** docs/ai/work-packets/WP-768-indestructible-man-mastermind.md
**Layer:** Game Engine
**Risk Tier:** MEDIUM — ranked integrity: closes a free leaderboard win
**Reconciled:** 2026-11-16 on `main` `b93e6d6ca` (see the WP's Reconciliation header). The WP wins any conflict.

## Before Starting
- [ ] WORK_INDEX shows WP-497, WP-687, WP-692, WP-736, WP-750, WP-757, WP-765, WP-830, WP-838, WP-846, WP-867, WP-873, WP-840 `[x]`; WP-768 `[ ]`; WP-769 not started (it edits `fightMastermind` after this packet).
- [ ] D-24601 / EC-805 / WP-768 are still reserved and unconsumed in `docs/ai/NUMBER-LEDGER.md`.
- [ ] `pnpm install`, `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail (baseline: game-engine 7262, arena-client 2726).
- [ ] Re-read every WP Assumes anchor (1-10). Target files = §Files to Produce (scope lock). In particular:
  - `fightMastermind` step order (Haunt `:157`, guard `:167`, price `:176-189`, stage `:194`, heal `:253`, Enigma `:259-262`, Step 3 `:280-337`);
  - the four MOVE_MAPs already pass `args`;
  - `mastermindStrikeHandler` (`:1524`) and its hollow `else`;
  - `dispatchTacticOnFight` (`:1564`), `freeRecruitFromHqByFilter` (`:1095`);
  - `playTopVillainDeckCards` (`villainDeck.reveal.ts:1228`), `shuffleDeck` (`setup/shuffle.ts:28`);
  - the per-turn deletes in `game.ts` onBegin (`:1065-1100`) and `applyOnBeginParity`;
  - `UIMastermindState.fortifiedReason` and its build / filter lines.
- [ ] Run the T13 engine-runner baseline (scratch scenario) and keep the output.

## Locked Values (do not re-derive)
- Mastermind `bkwd/indestructible-man`; Assassin prefix `bkwd-villain-elite-assassins-`; count 2.
- Lock reason, verbatim: `You can't use Attack to fight Indestructible Man. Shuffle two Elite Assassins from your Victory Pile into the Villain Deck to fight him.`
- `mastermind/indestructibleMan.logic.ts` exports `INDESTRUCTIBLE_MAN_MASTERMIND_ID`, `ELITE_ASSASSIN_EXT_ID_PREFIX`, `SHUFFLE_FIGHT_ASSASSIN_COUNT`, `INDESTRUCTIBLE_MAN_ATTACK_LOCK_REASON`, `isIndestructibleMan`, `listEligibleAssassins`, `canShuffleFight`, `isValidShuffleFightPick`, `selectLowestVpAssassins`, `shuffleIntoVillainDeck(G, playerId, cardIds, ShuffleProvider | null)`, `isShuffleFightOpen`. No boardgame.io import. `shuffleIntoVillainDeck` calls `shuffleDeck` once on `[...deck, ...cards]`; a null provider is a logged `'blocked'` no-op that moves nothing; returns whether it moved; never throws.
- `fightMastermind({ shuffleAssassinIds?: readonly CardExtId[] })` (exactly 2 distinct at runtime), for Indestructible Man only:
  - After the Haunt and guard returns: no `shuffleAssassinIds` → return; `!isValidShuffleFightPick(G, ctx.currentPlayer, ids)` → return; `!canShuffleFight` → return. Skip the price / spendable check.
  - Step 2 unchanged (stage, block-all, heal); the existing Enigma block `:259-262` is gated `!isIndestructibleMan(G)` so his guess settles once, in his Step 3.
  - Step 3, in order: Enigma well-formed check (return) → `shuffleIntoVillainDeck(..., { random })` + set the flag + log → Enigma settle (false → return; cost stays paid) → `isFinalBlow ? awardMastermindOnFinalBlow : defeatMastermindTacticCore(G, ctx, { random }, events)` → no Size-Changing line, no spend, no EV → `G.hasActedThisTurn = true` + the Diamond Form edge.
  - Step 3 for him is the module-private sub-function `resolveIndestructibleManShuffleFight`.
  - Every other Mastermind: byte-identical; the argument is ignored.
- Flag `G.indestructibleManShuffleUsedThisTurn?: true`, never seeded; guarded `delete` in **both** `game.ts` onBegin and `applyOnBeginParity`.
- **Strike** (`mastermindHandlers.ts`, module-private `resolveIndestructibleManStrike`, arm before the hollow `else`): current player has an Assassin → shuffle in `selectLowestVpAssassins(G, player, 1)` via `resolveShuffleFunction` wrapped as a `ShuffleProvider` (null when absent). Otherwise / null player → each player, current first then clockwise (`seatsInTurnOrderFrom`), `gainWoundToDiscard` + `describeStrikeWound`; empty supply → logged no-op. No capture. Log prefix `[Indestructible Man Master Strike]`.
- **Secrets of Indestructibility:** KO up to 2 Wounds, hand first then discard (`koCard` + `recordOwnedCardKoed`); 0 → `'blocked'` log.
- **International Arms Dealer:** `freeRecruitFromHqByFilter(G, currentPlayer, { kind: 'hero-class', values: ['tech'] }, false, 'International Arms Dealer', 'gain')`; then each other player clockwise (`otherSeatsClockwiseFrom`) reveals a Tech Hero from hand (`offPlayCardTraits` either class) or `gainWoundWithOutcome` (Finding Zemo log shapes); solo → one `'neutral'` line; then the play-two clause. When the gain parks, the reveal-or-Wound and play-two resolve before it is answered. After the play-two, if the parked entry is still queued with 0 eligible Heroes, remove it with the `'blocked'` line `Fight effect: no Tech Hero is left in the HQ to gain (International Arms Dealer).`
- **Unveil Project Four:** each other player clockwise discards via `discardFromHand` every hand card where `String(cardStats.cost|attack|recruit)` or a defined `String(cardVictoryPoints[id])` contains `'4'`; no `cardStats` entry → kept; collect the matching ids first, then discard; log ends "(approximate)"; then the play-two clause.
- **Play-two clause:** `G.mastermind.tacticsDeck.length > 0` → log `Fight effect: <tactic> plays the top 2 card(s) of the Villain Deck.`, then `RevealContext { random: shuffleContext.random, ctx: { currentPlayer, turn } }` + `playTopVillainDeckCards(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, 2)`; last Tactic → nothing.
- **Mad Monk:** not the last Tactic → `recordHollowEffect(G, { cardId, cardType: 'mastermind', timing: 'onFight', mechanic: 'tactic-becomes-villain', reason: 'unsupported-keyword', turn })`; last → nothing.
- `freeRecruitFromHqByFilter(..., verb: 'recruit' | 'gain' = 'recruit')` returns the entry it parked (or null), which the Arms Dealer stale-gain drop looks up by identity; the verb changes its three log lines (`:1106`, `:1117`, `:1141`).
- **Projection:** `UIMastermindState.shuffleFight?: { requiredCount; isUsedThisTurn; isAvailable; eligibleAssassins: UIDisplayEntry[] }` (built by `buildDisplayEntries`) (JSDoc: `isAvailable` = board + flag conditions only; the client keeps its stage / heal / pending gates), only for Indestructible Man, read for the active player (`isAvailable` = `isShuffleFightOpen`). `fortifiedReason` = the guard reason, else the lock reason while tactics remain or the Final Blow is available. Filter: conditional spread, `deepCopyDisplayEntries`; public to every audience. Update the `isMastermindGuarded` JSDoc and `uiState.build.ts:808-811` comment: `fortifiedReason` = guarded **or** the IM lock. `fightCost` stays the unchanged price read (never charged for him).
- **Bot (step 4, same commit as the move gate):** inside the stage / tactics / Haunt / guard condition and **before** the price check; Indestructible Man → no plain intent, no price check; `canShuffleFight` → one intent `{ shuffleAssassinIds: selectLowestVpAssassins(G, active, 2) }` (+ `enigmaGuess` as the plain branch does; none when the guess is null).
- **Feeds:** `tactic-provenance.json` Secrets / Arms Dealer `executable`, Project Four `deferred` (WP-768, D-24601); `strike-provenance.json` the strike `executable`; regenerate the effect index; Mad Monk stays `unmarked`.

## Guardrails
- The move gate, the bot and the projection read the same helpers in `indestructibleMan.logic.ts`.
- The only new randomness is the shuffle-in through `shuffleDeck`.
- No new key, log line, intent or projection key without Indestructible Man; hash oracles (`finalStateHash`, `PRE_WP080_HASH`, local-spike `initialStateHash`) unchanged. STOP if one moves.
- Engine only. No client or server change. No Epic face. No `.reduce()`. Moves never throw.
- Sanctioned existing-test edits: the WP-853 KO-site `LOCKED_TABLE` row `'rules/tacticHandlers.ts#koWoundsFromZone': { koSites: 1, ownedRecords: 1 }` (`hero/ownedCardKoTrigger.test.ts`), and `rules/mastermindStrike.unresolved.test.ts:274` `checkedCount` 15 → 16 with "+ Indestructible Man (WP-768 / D-24601) = 16" appended to its `// why:`. Every other existing assertion passes unedited (the Dark Technology / Bitter Captor log lines are byte-identical).
- `tacticHandlers.ts` reads `DEFAULT_IMPLEMENTATION_MAP` only inside the function body (import cycle via `villainDeck.reveal` → `defeatChoice.resolve` → `fightMastermind` → `tacticHandlers`), with a `// why:`.

## Required `// why:` Comments
- Attack can never fight him (card text); a plain call returns.
- The player chooses the Assassins as move args (operator decision, WP-757 pattern).
- The cost is paid before the Enigma guess (card order: shuffle, then "fight").
- The shuffle-in follows D-24771 (seeded Shuffle).
- The omit-when-absent turn flag (both reset sites).
- The strike's lowest-VP auto-pick (not a choice) and its D-24780 wound order.
- The Project Four approximation (operator decision).
- The Arms Dealer clause order and the Haunted-gain residual.
- The Mad Monk not-last-only hollow (D-24033).
- `fortifiedReason` precedence (guard reason first) and why the lock reuses it.

## Files to Produce
- `packages/game-engine/src/mastermind/indestructibleMan.logic.ts` + test — **new**
- `moves/fightMastermind.ts` (+ test), `types.ts`, `game.ts`, `simulation/onBeginParity.ts` (+ `onBeginParity.test.ts`) — **modified**
- `rules/mastermindHandlers.ts` (+ test), `rules/tacticHandlers.ts` (+ test) — **modified**
- `ui/uiState.types.ts`, `ui/uiState.build.ts` (+ test), `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — **modified**
- `simulation/ai.legalMoves.ts` (+ test) — **modified**
- `board/besideMastermind.logic.ts` (JSDoc only); `rules/mastermindStrike.unresolved.test.ts` (the 15 → 16 pin); `hero/ownedCardKoTrigger.test.ts` (one `LOCKED_TABLE` row) — **modified**
- `scripts/coverage/tactic-provenance.json`, `scripts/coverage/strike-provenance.json`, `data/metadata/effect-implementation-index.json` (+ `docs/ai/coverage/runtime-observed-hollows.json` / `scripts/coverage/hero-effect-coverage.baseline.json` only if their `:check` moves) — **modified / regenerated**
- Governance: `docs/ai/DECISIONS.md` (D-24601), `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md`, 01.6 post-mortem — **modified / new**

## After Completing
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail, every package's totals pasted.
- [ ] `effect-index:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `gauntlet:loadouts:check` → 0; hash oracles unchanged.
- [ ] T13 engine-runner run on the branch: no turn-1 win (baseline output beside it).
- [ ] D-24601 Active; STATUS; WORK_INDEX `[x]` + `[live-verify: pending]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check`, `workindex:liveverify:check` 0; 01.6 post-mortem.
- [ ] Allowlist-only diff; two-commit topology (`EC-805:` then `SPEC:`).
- [ ] D-24026 live-verify after the deploy (WP-768 alone), incl. the Play Diagnostics `uiStateSnapshot` showing `mastermind.shuffleFight` + `fortifiedReason`; recorded as its own `SPEC:` PR.

## Common Failure Smells
- The bot still wins on turn 1 → the plain intent is still emitted, or the move isn't refusing attack.
- The bot never shuffle-fights in the sim → `applyOnBeginParity` never clears the flag.
- A second shuffle-fight in the same turn succeeds → the flag isn't set, or `canShuffleFight` doesn't read it.
- Another player's Assassin is accepted → validation reads the wrong Victory Pile.
- Deck order unchanged after the shuffle → `shuffleDeck` was not called.
- A core hash moved → the flag was seeded, or a branch isn't gated on `isIndestructibleMan`.
- The live Fight button still enables for him → `fortifiedReason` was built but not passed through the filter.
- Dark Technology's log changed → the `verb` default is wrong.
