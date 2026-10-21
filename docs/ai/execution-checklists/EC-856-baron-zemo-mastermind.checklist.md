# EC-856 — Baron Heinrich Zemo Mastermind (Execution Checklist)

**Source:** docs/ai/work-packets/WP-818-baron-zemo-mastermind.md
**Layer:** Game Engine (+ the tactic provenance overlay and the regenerated effect index)

## Before Starting
- [ ] `resolveMastermindFightCost(G)` still sums base + portal + Abomination − reduction with a 0 floor (`economy.resolve.ts` ~L331-347); its four callers are `fightMastermind.ts` ~L155, `ai.legalMoves.ts` ~L1116, `uiState.build.ts` ~L986, `heroEffects.execute.ts` ~L4748.
- [ ] `board/bystanders.logic.ts` exports `SAVIOR_BYSTANDER_THRESHOLD`, `countVictoryPileBystanders`, `findFirstVictoryPileBystander` (WP-816; ~L26 / L54 / L74 after #2940, which changed only comments and tests).
- [ ] `mastermindStrikeHandler` has no `ca75/*` branch; `dispatchTacticOnFight` has no Zemo branch.
- [ ] If WP-817 executed first, its `seatChoice.resolve.ts` / `ai.seatChoice.ts` / `ai.legalMoves.ts` branches are on main: keep them and add beside them.
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; record the engine test total.

## Locked Values (do not re-derive)
- `BARON_ZEMO_MASTERMIND_ID = 'ca75/baron-heinrich-zemo'` (private), `export const BARON_ZEMO_NON_SAVIOR_BONUS = 9`.
- `mastermindNonSaviorBonus(G, fightingPlayerId?)`: not Zemo → 0; fighter omitted or without zones → 9; `countVictoryPileBystanders(victory) >= SAVIOR_BYSTANDER_THRESHOLD` → 0, else 9. Victory Pile only: Bystanders Zemo holds never count (T3b).
- `resolveMastermindFightCost(G, fightingPlayerId?)` = `max(0, base + portal + abomination + nonSavior − reduction)`. Callers pass `ctx.currentPlayer` / `activePlayer` / `ctx.currentPlayer` / `fightingPlayerId`.
- Strike: `MASTERMIND_BARON_ZEMO = 'ca75/baron-heinrich-zemo'`; sorted seats; first Victory-Pile Bystander → `gameState.ko`, else `gainWoundToDiscard`. Lines: `` `[Baron Zemo Master Strike] Player ${playerId} KO'd a Bystander from their Victory Pile.` `` / `` `[Baron Zemo Master Strike] Player ${playerId} had no Bystander in their Victory Pile and ${describeStrikeWound(outcome)}.` `` / `` `[Baron Zemo Master Strike] Player ${playerId} had no Bystander in their Victory Pile and the Wound supply is empty — no effect.` ``.
- Tactic ids `ca75-mastermind-baron-heinrich-zemo-{fallen-idols|finding-zemo|hatred-for-the-avengers|prisoners-of-war}`; `FINDING_ZEMO_REVEAL_COUNT = 5`; `TEAM_AVENGERS = 'avengers'`.
- `countXMenHeroesYouHave` → `countTeamHeroesYouHave(G, inPlay, hand, team)`; Xavier's Nemesis passes `TEAM_X_MEN`, strings unchanged. Update the ~L1304 comment naming the old function and the header's "No `ctx.random.*`" line (Finding Zemo shuffles via `shuffleContext`).
- Fallen Idols: other seats; Savior seat → `` `Fight effect: Player ${seat} is a Savior and discards nothing (Fallen Idols).` `` `neutral`; non-Savior empty hand → `` `Fight effect: Player ${seat} has no card to discard (Fallen Idols).` `` `neutral` (sorted order); no extra seat-choice guard (callers are behind the block-all guard); `buildFallenIdolsDiscardChoice(G, nonSaviorSeats)` → `parkSeatChoice(G, events, choice)` + `` `Fight effect: each other player who is not a Savior must discard a card (Fallen Idols).` `` `neutral`; undefined → `` `Fight effect: no other player who is not a Savior has a card to discard (Fallen Idols).` `` `neutral`; solo → `` `Fight effect: there is no other player to discard a card (Fallen Idols).` `` `neutral`.
- `FALLEN_IDOLS_DISCARD_KIND = 'fallen-idols-discard'`; option label `` `Discard ${resolveCardName(G.cardDisplayData, cardId)}` ``; `defaultOptionIndex: 0`; apply line `` `Player ${seat} discarded ${resolveCardName(G.cardDisplayData, cardId)} (Fallen Idols).` `` `applied`, via `discardFromHand`, ascending seats.
- Finding Zemo: reveal `min(5, deck.length)`; `villainDeckCardTypes[id] === 'bystander'` → `G.ko` in revealed order; Shuffle the rest only when `rest.length >= 2`; deck = `[...rest, ...deck.slice(revealCount)]`; per-seat Wounds in `dealFindingZemoWounds(G, currentPlayer)`. Lines (WP §Locked Values verbatim): empty deck `blocked`; no Bystanders `blocked`; KO'd `applied`; then per other seat `gained` `applied` / `would gain … Diving Block can prevent it` `neutral` / `gained no Wound — the Wound supply is empty` `blocked`; solo `there is no other player to gain a Wound` `neutral`.
- Hatred: Xavier's structure, `TEAM_AVENGERS`, "Avengers Hero(es)" / "(Hatred for the Avengers)" strings as the WP locks.
- Prisoners: hand reveal via `offPlayCardTraits(G, id)?.team === TEAM_AVENGERS` → `neutral` reveal line; else `findFirstVictoryPileBystander` → the fighter's Victory Pile, `applied`; else `blocked`; solo `neutral`.
- Provenance rows: 4 × `executable`, `tacticHandlers.ts#resolve<Name>`, WP-818, D-24752.

## Guardrails
- The Zemo term lives only in `resolveMastermindFightCost`; callers change only by the passed fighter.
- Import the WP-816 Savior helpers; never write a new two-arm Bystander id test (coordinated with #2940).
- Other masterminds' strikes and every other tactic stay byte-identical (T11, T22).
- Sorted seat iteration; no `.reduce()`; nothing throws; every no-op logs its locked line (exemption: a missing current-player zone in Hatred / Prisoners is a silent defensive return).
- `ctx.random` only through the tactic's `shuffleContext.random.Shuffle`.
- No client file, no UIState field, no `G` field, no contract file.
- Hash oracles byte-identical; if one moves, STOP and explain before any re-pin.

## Required `// why:` Comments
- The non-Savior term: rules v23 L1844-1853; the fighter's Savior status; an omitted fighter pays the +9 (D-24752).
- `BARON_ZEMO_MASTERMIND_ID`: id-keyed like the strike dispatch (D-24300); the only "+N unless Savior" Mastermind.
- The strike's pile-order pick: every Victory-Pile Bystander is worth the same (D-24749 Executioner precedent).
- Fallen Idols' "Discard <card>" label: the generic prompt heading needs no client change.
- Finding Zemo: Killbots in the deck are villains (D-24324); one Wound per other player; Shuffle only when 2+ go back.
- Prisoners of War: a free reveal beats giving up a Bystander (D-24312), so the pick is player-optimal.
- `countTeamHeroesYouHave`: the second team use of the Xavier's Nemesis count (D-24645).

## Files to Produce
- `packages/game-engine/src/economy/economy.resolve.ts` + test — **modified**
- `packages/game-engine/src/moves/fightMastermind.ts`, `simulation/ai.legalMoves.ts`, `ui/uiState.build.ts`, `hero/heroEffects.execute.ts` — **modified** (one argument each)
- `packages/game-engine/src/moves/fightMastermind.test.ts`, `simulation/ai.legalMoves.test.ts`, `ui/uiState.build.test.ts`, `hero/pureFury.logic.test.ts` — **modified** (additions only); `moves/electromagneticBubbleChoice.resolve.test.ts` — **modified** (comment-only rename, ~L145)
- `packages/game-engine/src/rules/mastermindHandlers.ts` + test, `rules/tacticHandlers.ts` + test — **modified**
- `packages/game-engine/src/moves/seatChoiceTactics.ts` + test, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts` + test — **modified**
- `scripts/coverage/tactic-provenance.json` — **modified**; `data/metadata/effect-implementation-index.json` — **regenerated**
- `docs/ai/NUMBER-LEDGER.md` (D-24752 line, corrected at drafting); `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] T1-T24, T3b and T8b pass (T6 uses a dummy tactic id). `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail.
- [ ] `pnpm effect-index` changes only the four Zemo tactic rows; `effect-index:check`, `ledger:villains:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `cards:check`, `sim:runtime-observed:check`, `sim:coverage --check` → 0.
- [ ] Revert proofs observed (term dropped; `>` for `>=`; no Wound fallback; Saviors addressed; no reshuffle).
- [ ] `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] D-24752 Active. STATUS updated (+ the passive follow-up link or line). WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅` + `pnpm roadmap:counts:write`. `roadmap:counts:check`, `ledger:numbers:check` → 0.
- [ ] Allowlist-only diff. Two-commit topology `EC-856:` then `SPEC:`.
- [ ] Live-verify (D-24026) post-deploy STATUS-flip.

## Common Failure Smells
- The tile still shows `Fight 9` for a non-Savior → `uiState.build.ts` does not pass `ctx.currentPlayer`.
- The bot offers `fightMastermind` the move refuses → `ai.legalMoves.ts` does not pass `activePlayer`.
- A Savior with exactly 3 Bystanders still pays 18 → `>` used for `>=`.
- Zemo costs 9 to a 2-Bystander fighter while he holds a Bystander → the term counted `G.mastermind.attachedBystanders`.
- A final turn or Chthon transform after Finding Zemo / the strike → intended (D-24752); do not suppress it.
- Xavier's Nemesis log or count changed → the `countTeamHeroesYouHave` refactor altered its body.
- Fallen Idols' prompt reads Monarch's Decree → the Monarch's kind or applier was reused.
- Finding Zemo shuffles the whole deck, or puts the rest on the bottom → only the revealed non-Bystanders go back, on top.
- An unrelated tactic now fires → a dispatch branch matched a prefix instead of the exact id.
