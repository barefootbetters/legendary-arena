# WP-899 — "Cards you played this turn" keeps a card that left play mid-turn (Game Engine)

**Status:** Draft 2026-11-16. Gates: pre-flight (01.4) READY TO EXECUTE (round 2, reconfirmed in rounds 3-4); copilot (01.7) RISK → HOLD, then PASS → CONFIRM (round 2); lint (00.3) PASS (runs 3-4). EC-937; **D-24856** reserved (#3423). See §Gate Record.
**Primary Layer:** Game Engine (seven source files, two of them comment-only, plus two test files)
**Dependencies:** WP-745 ✅ (D-24568, the residual pin), WP-861 ✅ (D-24798), WP-780 ✅ (D-24619, the view), WP-803 ✅ (D-24692), WP-842 ✅ (D-24776), WP-858 ✅ (D-24794), WP-853 ✅ (D-24789, the owned-KO chokepoint and its site pin), WP-855 ✅ (D-24791), WP-876 ✅ (D-24823), WP-806 ✅ (D-24713, operator "Move a card" / `operatorMoveCard`), WP-871 ✅ (D-24816, Squirrel Girl's fight restriction). No open packet edits the allowlist at drafting.
**User-Visible Surface:** play.legendary-arena.com (scoring input: hero bonuses grant or are withheld differently after a card is KO'd out of play)
**Risk Tier:** MEDIUM — engine rules fidelity on a scoring input, plus one optional, lazily written `G.turnEconomy` field (hash oracles proven unchanged at drafting); no auth, money, persistence, server or client surface.
**Lane:** Standard (two-session). The lightweight lane (D-24028) does not fit: a contract file gains a field (criterion 4), and the surface is scoring and determinism (criterion 6).
**Arc:** WP-745 Out of Scope E, the follow-up named by D-24568 §2 and D-24798 §5.

> Baseline: `origin/main` at `4099ec03a` (the reserve commit #3423; WP-768 live-verify #3421 is the last code-adjacent merge). game-engine 7343 / 0. Re-read the line anchors and test totals at execution.

---

## Goal

Rules v23 L3441-3453: a card you played this turn that then moved somewhere else **still counts** as one of "the cards you played this turn". It does **not** count as "your Heroes" / "Heroes you have" (L3443-3447).

The engine's one "cards you played this turn" view, `playedCardIdsThisTurn`, already keeps cards that left play through Out of Time, a used Ritual Artifact and a returned Sidekick. Every **other** exit drops the card. Most of those are KOs from play. After this session the view also keeps a card that was KO'd out of play or moved out of play by the operator setter, exactly once per physical play. Every reader is fixed together, inside the view; no reader changes. "Heroes you have" readers stay exactly as they are.

## User-Visible Impact

In a match created after the deploy, once a card you played is KO'd out of play:
- Dr. Octopus's Eighth Time's a Charm grants on the true 8th card played, and no longer on the 9th.
- First Strike, Follow My Lead, Surprise Attack and Deadpool's Do-Over no longer treat your second card as your first.
- "At least N other cards played" (Winter Soldier, Iron Man, Cannonball), Invisible Woman's other-4-cost check, Warriors Three's distinct names and every "for each card you played this turn" count include the KO'd card.
- Class and team superpowers ("[class]: …", "[team]: …"), `requiresKeyword` synergy and the Size-Changing discount see the KO'd card as played.
- Squirrel Girl ("You can't fight … if you played more than one card this turn", D-24816) stays unfightable after one play plus one KO'd-out play. Today the KO'd card stops counting and she becomes fightable.

---

## Assumes

1. **The view.** `hero/splitCard.logic.ts:227` `playedCardIdsThisTurn(G, inPlay)` starts from `playedCardIdsStillInPlay(G, inPlay)` (L280, the Penumbra expansion over `turnEconomy.bothSidesPlayedCardIds`). It then appends, in this order:
   - `pile-sidekick` × `turnEconomy.sidekicksReturnedThisTurn` (a count, never de-duplicated)
   - each `outOfTimePlayedCardIds` entry not already present (`includes`)
   - each `ritualUsedPlayedCardIds` entry not already present (`includes`)
2. **Readers.** Production callers of `playedCardIdsThisTurn(`:
   - `hero/heroConditions.evaluate.ts` (9)
   - `hero/heroCountSource.resolve.ts` (14, including `collectCardsYouHave`, which reads the played view on purpose: D-24823)
   - `hero/sizeChanging.logic.ts` (1)
   - `moves/villainDefeatRequirement.logic.ts` (1)

   "Heroes you have" readers call `playedCardIdsStillInPlay` instead (`heroConditions.evaluate.ts` L444, L490, L903, L950, L1212; `heroCountSource.resolve.ts`).
3. **The ledger pattern.** `economy/economy.types.ts` holds three lazily written, active-player-scoped turn ledgers, each optional and absent until first written: `sidekicksReturnedThisTurn`, `outOfTimePlayedCardIds` and `ritualUsedPlayedCardIds` (L281). Every lazy turn field is:
   - listed in `CarriedTurnFields` and carried by `carryConversionFlag` (`economy/economy.logic.ts` L529)
   - written by a helper that rebuilds the economy from an explicit literal plus `...carryConversionFlag(economy)` (`recordOutOfTimePlayed` L1274 is the template)
   - dropped by `resetTurnEconomy` (L1516), which returns the bare shape

   `resetTurnEconomy` runs in the play-phase `turn.onBegin` (`game.ts` L1161), beside `applyOnBeginParity` in both rebuilt loops (`simulation/simulation.runner.ts` L935, `simulation/par.aggregator.ts` L975), and in the fixture loop (`test/fixtures/runFixture.ts` L447). `replay/replay.execute.ts` never resets `turnEconomy`; that is pre-existing for every lazy ledger and out of scope.
4. **The owned-KO chokepoint.** `hero/deferredConditionalGrants.ts:208` `recordOwnedCardKoed(G, ownerPlayerID, cardId, fromZone)` is called at every site that KOs a card from a player's zone, with the zone it left. WP-853's `ownedCardKoTrigger.test.ts` `LOCKED_TABLE` (L373) pins the call sites. Every KO from `inPlay` reaches it with `'inPlay'`. The dynamic-zone sites that can take `inPlay` are `koHeroChoice.resolve.ts` L117 / L172, `optionalKoReward.resolve.ts` L183-195, `seatChoiceTactics.ts` L776 (Crush) and L1391 (Zarathos), `villainEffects.execute.ts` L6739 `koSingleTarget`, and the operator KO route (`moves/operatorSetters.ts` L269 `koFromPlayerZone`). (`communeSpiritWorld.logic.ts` L339 and `huntForVictims.logic.ts` L581 reject `inPlay`.)
5. **The literal `inPlay` write sites (closed set at drafting).** Scanning every non-test `.ts` under `packages/game-engine/src` (comments stripped) for `moveCardFromZone(<…>.inPlay, …)` and for `.inPlay =` assignments whose right side does not start with `[...` finds 22 writes in 13 functions:

   | `<path>#<function>` | Writes | What it is | Disposition |
   |---|---|---|---|
   | `hero/heroEffects.execute.ts#heroEffectKo` | 2 | generic self-KO from play | KO: recorded through `recordOwnedCardKoed` |
   | `villain/villainEffects.execute.ts#koOneHeroForPlayer` | 2 | villain KO from play | KO: recorded through `recordOwnedCardKoed` |
   | `villain/villainEffects.execute.ts#villainEffectKoHeroesCurrentByTrait` | 1 | villain KO of matching Heroes | KO: recorded through `recordOwnedCardKoed` |
   | `hero/heroEffects.execute.ts#heroEffectOutOfTime` | 2 | Out of Time set-aside | own ledger (`outOfTimePlayedCardIds`) |
   | `moves/outOfTime.logic.ts#replayOutOfTimeCards` | 2 | turn-2 replay, then discard | own ledger (`outOfTimePlayedCardIds`) |
   | `moves/ritualArtifact.ts#useRitualArtifact` | 2 | Ritual used from play | own ledger (`ritualUsedPlayedCardIds`) |
   | `moves/communeSpiritWorld.logic.ts#applyCommuneCostResolvedSeatChoice` | 2 | Artifact discarded from play | own ledger (`ritualUsedPlayedCardIds`) |
   | `moves/recruitSidekick.ts#returnPlayedSidekick` | 1 | Sidekick returned to the stack | own count (`sidekicksReturnedThisTurn`) |
   | `hero/heroTransform.logic.ts#applyHeroTransform` | 3 | base card out, second form appended to `inPlay` | **not recorded** (Context) |
   | `moves/splitFaceChoice.resolve.ts#resolveSplitFaceChoice` | 1 | relabels the entry to the chosen face | not an exit |
   | `moves/endOfTurnCleanup.logic.ts#keepControlledArtifacts` | 1 | end of turn | not mid-turn |
   | `moves/endOfTurnCleanup.logic.ts#applyEndOfTurnCleanup` | 1 | end of turn | not mid-turn |
   | `moves/deferredHandInjection.logic.ts#pullCardIntoHand` | 2 | end of turn (called only from `endOfTurnCleanup.logic.ts`) | not mid-turn |

   The one non-KO, dynamic-zone exit from `inPlay` is the operator route `moves/operatorSetters.ts` L296 `moveBetweenPlayerZones` (`from.zone` may be `'inPlay'`; D-24713 §6 makes `inPlay` a source only). It is recorded directly.
6. **The residual pin.** `hero/unmarkedConditionalGrants.test.ts` L307, WP-745 case 2: "residual pin: one earlier play KO'd out of play, then the 9th physical play reads as the 8th → +2". It removes the card with a raw `inPlay` filter plus `koCard`, so it never reaches a KO path.
7. **Turn scope.** Only the active player's `inPlay` is non-empty mid-turn: `applyEndOfTurnCleanup` moves it all to discard (or to `G.controlledArtifacts`) at every turn end.
8. **Hash oracles.** `PRE_WP080_HASH = 'dae75521'` (`replay/replay.execute.test.ts` L188), the replay sentinel, `replay/replay.hash.test.ts`, and every `finalStateHash` pin. **Scaffold-measured at drafting:** the locked change (Locked Values, without the new tests) on `4099ec03a` gave game-engine 7343 / 0 with every hash oracle green, and `sim:runtime-observed:check` and `sim:coverage --check` both OK (measured by the drafter and again by pre-flight). No pinned run KOs a card out of play, so Scope (In) H is expected to be empty.
9. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.
10. **Test scaffolding.** `test/fixtureBuilders.ts` exists (the fixture builders the Test Contract uses). `hero/deckCardKoTrigger.test.ts` holds `stripComments` (L436) and `enclosingFunction` (L482), which T15 copies; `hero/ownedCardKoTrigger.test.ts` holds the second copy.
11. **WP-901 has not landed.** No `inPlay` caller of `sendCardUndercover` exists. Today the calls are in `heroEffects.execute.ts` L3414 / L3457 and `undercover.resolve.ts` L107, from the hand and the Officer pile only.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why an exit-side ledger, not an entry-side play history (design fork 1, measured).** An entry-side history (append at `applyCardPlay` and the split-card branches) has 3 entry sites plus the split-face relabel. But it is written on **every** play, so it would materialize a hashed `G.turnEconomy` field in every match and move both hash oracles. That is a re-pin of every replay, for no rules gain. The exit-side ledger is written only when a played card actually leaves play. Its write sites are small because the KO family already funnels through `recordOwnedCardKoed` (Assumes 4): one write there covers every KO-from-play site, present and future, and WP-853's pin already forces new KO sites through it. With the operator route that makes **two write sites**. The three existing ledgers stay as they are; folding them would rename hashed fields for no behavior gain.
- **Order does not matter to any reader.** `firstHeroPlayedThisTurn` asks "is any other card in the view". `cardPlayOrdinalEquals` and the thresholds read the view's length. The others are existence or count checks. So appending the ledger after `inPlay` is enough.
- **Multiset (fork 2).** The basic tokens share one id (`starting-shield-agent`, `starting-shield-trooper`, `pile-sidekick`, `pile-shield-officer`), so the new ledger is never de-duplicated, either against itself or against `inPlay`. A card can leave play only once per play, and a card back in play took a new play, so one entry per exit is exactly one count per physical play. The new entries go in **before** the Sidekick count and the Out of Time / Ritual loops. A card in both the new ledger and one of theirs (an Out of Time replay KO'd out on turn 2) is then absorbed by their `includes` and counts once. That holds for the same physical card. For shared ids the `includes` absorption also crosses ledgers: a KO'd-out Sidekick plus a **different** Sidekick set aside Out of Time counts once. That is no regression (it counted 1 before), and it is recorded beside the D-24776 residual.
- **Penumbra.** The same `playedCardIdsStillInPlay` expansion runs over the ledger, so a both-sides card KO'd out of play still counts as both faces.
- **Transform (rules v23 L2050-2062).** The rules move the second form to your hand, and "you still count as having played the transforming card". The engine instead removes the base card from `inPlay` and appends the second form to `inPlay`, applying its icons as if played (`heroTransform.logic.ts` L101-121). The second form stands in for the play, so the view already counts one card for that one physical play. Recording the base card would count two. (No reader depends on order.) So a Transform is not recorded. The recorded residual: trait readers see the second form's traits, not the base card's. If the second form is later KO'd out of play, that KO is recorded like any other.
- **Hash posture (fork 3).** The field is optional and lazily written, like the three ledgers. It is absent until the first record and omitted by `JSON.stringify`, so a match in which no played card leaves play serializes byte-identically. Assumes 8 shows the pinned runs do not move.
- **Turn boundary (fork 4).** The field lives on `G.turnEconomy`, so every `resetTurnEconomy` site drops it (Assumes 3). No `onBegin` or `applyOnBeginParity` edit is needed.
- **Active-player scope (fork 5).** The ledger is turn-scoped and active-player-scoped like its siblings. Assumes 7 means a KO from `inPlay` always removes the active player's card, so `recordOwnedCardKoed`'s `ownerPlayerID` needs no check. A villain or another seat removing the active player's card records through the same chokepoint.
- **The operator route records** because D-24713 §6 makes `inPlay` reachable only by playing a card. A card moved out of `inPlay` is a played card leaving play, which is what live staging must reproduce.
- **Later exits (coordination with WP-901, bkwd "send one of your Heroes Undercover").** A packet that adds a new mid-turn exit from `inPlay` records it as follows:
  - A KO records itself through `recordOwnedCardKoed(…, 'inPlay')`.
  - Any other exit calls `G.turnEconomy = recordPlayedCardLeftPlay(G.turnEconomy, cardId)` at the site, unless a ledger of its own already covers it. WP-901's Undercover-from-play (`moves/undercover.resolve.ts`, the `zone: 'inPlay'` branch through `sendCardUndercover`) is the first case.
  - If WP-901 lands first, STOP before coding and reconcile first. Amend this WP and D-24856, then re-run the gates:
    - Files Expected to Change gains `moves/undercover.resolve.ts`.
    - A third write site is added, with its T-case and a third `LOCKED_LEFT_PLAY_RECORD_TABLE` row.
    - Verification Step 4 expects 4 lines.
  - T15 sees literal `.inPlay` writes, including `zones.inPlay = helper(…, zones.inPlay)` (`sendCardUndercover` returns the new source and its caller assigns it, so such a branch would trip the write table). It is blind only to dynamic-zone writes (`zones[zone] = …`) and helpers that mutate the array in place. The packet adding an exit still names its record in its own Locked Values and tests it.
- **"Cards you have" (D-24823) is a played-view reader on purpose.** Putting a Crew Together's distinct-costs source counts hand plus the cards played this turn. It gains the KO'd card, consistent with its own D-entry. It is not a "Heroes you have" reader.
- `docs/ai/ARCHITECTURE.md` §Persistence Boundaries (turn-scoped `G` fields) and §The Move Validation Contract (no move change here).
- `docs/ai/DECISIONS.md`: read D-24568 (§2), D-24798 (§5), D-24619, D-24692, D-24776, D-24794, D-24789, D-24791, D-24713 (§6), D-24795, D-24816 (§4), D-24823, D-24746 and D-24372 before coding (and D-24858, WP-901's reservation).
- User memory: `reference_heroes_you_have_hand_plus_play` (hand + play, never moved cards), `reference_injected_seam_hides_missing_wiring` (prove each write site through a real path, not a hand-built ledger), `reference_engine_tests_never_typechecked`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24856) before coding. One WP per session.

**Packet-specific:**
- **No reader changes.** No caller of `playedCardIdsThisTurn` or `playedCardIdsStillInPlay` is edited, apart from the comment-only edits in Scope (In) E (`heroConditions.evaluate.ts`, `villainDefeatRequirement.logic.ts`).
- **`playedCardIdsStillInPlay` is unchanged**, and so is every "Heroes you have" result.
- **Exactly two write sites:** inside `recordOwnedCardKoed` and inside `operatorSetters.ts` `moveBetweenPlayerZones`. Not at `applyHeroTransform`, the own-ledger sites, the end-of-turn sites or the split relabel.
- **Hash oracles are not re-pinned.** If one moves, STOP: a pinned run KOs a card out of play, which is a re-pin decision for Jeff (Assumes 8).
- **Sanctioned test edit, one only:** the Assumes 6 residual pin flips (Scope (In) F). No other existing test is edited, except the feed pins in Scope (In) H, which move only with the regenerated feed.

## Locked Values

- **Field** on `TurnEconomy` (`economy/economy.types.ts`), placed after `ritualUsedPlayedCardIds`:

  ```ts
  leftPlayPlayedCardIds?: CardExtId[];
  ```

  Its JSDoc says: WP-899 / D-24856; rules v23 L3441-3453; a **multiset**, never de-duplicated; one entry per exit; which exits record (KOs through `recordOwnedCardKoed`, the operator move) and which do not (Out of Time, Ritual, Commune Artifact, returned Sidekick, Transform, end-of-turn); active-player-scoped; lazily materialized, dropped by `resetTurnEconomy`, carried by `carryConversionFlag`, omitted when absent so neither hash oracle moves.
- **Helper** in `economy/economy.logic.ts`, beside `recordOutOfTimePlayed`, with the same body shape:

  ```ts
  export function recordPlayedCardLeftPlay(economy: TurnEconomy, cardId: CardExtId): TurnEconomy
  ```

  It returns the explicit seven-field literal, then `...carryConversionFlag(economy)`, then `leftPlayPlayedCardIds: [...(economy.leftPlayPlayedCardIds ?? []), cardId]`. `'leftPlayPlayedCardIds'` joins `CarriedTurnFields`. `carryConversionFlag` carries it only when present, after the `ritualUsedPlayedCardIds` carry, by reference like `outOfTimePlayedCardIds` (append-only: only `recordPlayedCardLeftPlay` writes it, always as a new array).
- **Write site 1.** It is the first statement of `recordOwnedCardKoed`, before every existing gate:

  ```ts
  if (fromZone === 'inPlay' && G.turnEconomy !== undefined) {
    G.turnEconomy = recordPlayedCardLeftPlay(G.turnEconomy, cardId);
  }
  ```

  It is ungated (no hook scan): it is written only when a card is KO'd from play. The `G.turnEconomy !== undefined` guard stays because existing tests call `recordOwnedCardKoed` on minimal `G` slices with no economy.
- **Write site 2.** A private `recordOperatorLeftPlay(G, from, cardId)` in `moves/operatorSetters.ts` runs `G.turnEconomy = recordPlayedCardLeftPlay(G.turnEconomy, cardId);` (unguarded: operator moves run on a full match state) when `from.zone === 'inPlay'`. It is called after each successful move in `moveBetweenPlayerZones` (the deck-top branch and the general branch). `koFromPlayerZone` gets no call: it already reaches write site 1. It is a helper with two calls rather than two inlined records because `moveBetweenPlayerZones` is 27 lines today and two inlined 3-line records would take it past the 30-line cap (00.6 Rule 2, lint §16.4); its JSDoc says so.
- **The view.** In `playedCardIdsThisTurn`, directly after `const played = playedCardIdsStillInPlay(G, inPlay);` and before the Sidekick loop:

  ```ts
  const leftPlayPlayed = G.turnEconomy?.leftPlayPlayedCardIds;
  if (leftPlayPlayed !== undefined) {
    played.push(...playedCardIdsStillInPlay(G, leftPlayPlayed));
  }
  ```

  Nothing else in the function changes. Its JSDoc names the new ledger.
- **Drift pin `LOCKED_IN_PLAY_WRITE_TABLE`** (T15). It locks the Assumes 5 table as `<path>#<function>` → write count, with these values: `heroEffectKo` 2, `koOneHeroForPlayer` 2, `villainEffectKoHeroesCurrentByTrait` 1, `heroEffectOutOfTime` 2, `replayOutOfTimeCards` 2, `useRitualArtifact` 2, `applyCommuneCostResolvedSeatChoice` 2, `returnPlayedSidekick` 1, `applyHeroTransform` 3, `resolveSplitFaceChoice` 1, `keepControlledArtifacts` 1, `applyEndOfTurnCleanup` 1, `pullCardIntoHand` 2 (22 writes). Each row carries its disposition as a trailing comment. The scan:
  - strips comments (copy `stripComments` / `enclosingFunction` from `hero/deckCardKoTrigger.test.ts`: a third copy; extracting a shared helper would edit two existing test files, which this packet forbids)
  - counts `moveCardFromZone(` calls whose first argument ends in `.inPlay`
  - counts `.inPlay =` assignments (not `==`) whose right side does not start with `[...`
  - keys each hit by the enclosing `function` declaration

  The failure message says: "A function gained or lost an inPlay write. If it moves a played card out of play mid-turn, record it (recordOwnedCardKoed for a KO, else recordPlayedCardLeftPlay) or give the reason it does not, then update LOCKED_IN_PLAY_WRITE_TABLE (WP-899 / D-24856)."
- **Record-site pin `LOCKED_LEFT_PLAY_RECORD_TABLE`** (T15, a second runtime table from the same scan). It counts the `recordPlayedCardLeftPlay(` calls (definitions excluded) by enclosing function: `hero/deferredConditionalGrants.ts#recordOwnedCardKoed` 1, `moves/operatorSetters.ts#recordOperatorLeftPlay` 1. The same table also counts `recordOperatorLeftPlay(` calls (definition excluded) by function: `moves/operatorSetters.ts#moveBetweenPlayerZones` 2. This makes AC 2's "exactly two production calls" a test.
- **Test totals (expected, recorded in the commit).** The new file holds 19 `it` cases: T1-T14, T7b, T13b, and T15 as three (the write table, the record table, the non-vacuous fixture). `unmarkedConditionalGrants.test.ts` gains 1 (the sibling). game-engine is expected to go from 7343 to 7363. Any difference is explained in the commit body.

---

## Scope (In)

- **A)** `economy/economy.types.ts`: the field and its JSDoc.
- **B)** `economy/economy.logic.ts`: `CarriedTurnFields` member, the `carryConversionFlag` carry, `recordPlayedCardLeftPlay`.
- **C)** `hero/deferredConditionalGrants.ts`: write site 1 and its `// why:`; import the helper.
- **D)** `moves/operatorSetters.ts`: `recordOperatorLeftPlay` and its two calls; import the helper.
- **E)** `hero/splitCard.logic.ts`: the view union and JSDoc. **Comments only:**
  - `hero/heroConditions.evaluate.ts`: the `PLAY_HISTORY_CONDITION_TYPES` block (~L223-231) loses the "drops out of it (the D-24798 §5 residual …)" clause and says the view keeps KO'd plays (D-24856).
  - `moves/villainDefeatRequirement.logic.ts`: the `at-most-one-card-played` `// why:` (~L359-362) loses "Inherited residual (D-24692): a played card that left play another way (e.g. a self-KO) stops counting" and says a KO'd-out play counts (D-24856).
- **F)** `hero/unmarkedConditionalGrants.test.ts`: the Assumes 6 residual pin becomes "one earlier play KO'd out of play, then the 9th physical play → none". Its KO goes through the real chokepoint: `moveCardFromZone` out of `inPlay`, then `koCard`, then `recordOwnedCardKoed(G, '0', id, 'inPlay')`. A sibling case covers the true 8th physical play after a KO'd-out card (+2). The `// why:` cites D-24856 and says the residual is gone.
- **G)** `hero/playedCardLeftPlay.test.ts` (new): T1-T15, T7b, T13b.
- **H)** Feeds, only if they move: `docs/ai/coverage/runtime-observed-hollows.json` (regenerate with `pnpm sim:runtime-observed`), then `apps/dashboard` `prebuild:coverage`, then re-measure the in-play pin in `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (~L753). Each moved number is recorded in the commit body and D-24856.

## Out of Scope

- **The three existing ledgers** (fold or rename). They stay; Context says why.
- **The shared-id collapse inside the Out of Time / Ritual `includes` loops** (D-24776's residual: two Sidekicks in one turn, one set aside by a granted Out of Time). The new ledger is a multiset; those loops are not touched.
- **Transform traits.** The view keeps reading the second form's traits for a transformed play (Context). The rules-faithful "transformed card goes to hand" model is its own packet.
- **Any reader change**, including the "Heroes you have" readers, the bot's valuation and the UI. No `UIState` field changes. The bot reader is named: `simulation/ai.competent.ts` `isFirstHeroCardPlayableFirst` reads the raw `inPlayCount`, so it still scores a first-Hero card as first after a KO'd-out play. That was already true for Out of Time, Ritual and returned Sidekicks.
- **The coach sequence teacher** (`apps/server/src/coach/sequenceTeacher.logic.ts`, WP-710 / D-24533) reproduces gates over the captured raw `inPlay`. A gate that now holds through a KO'd-out play reads `fails` there and can yield a false reorder tip. This is a recorded residual; WP-900 (D-24857) or a follow-up owns it.
- **Other per-turn "this turn" histories** (KO pile, discards, draws, recruits). They are separate accumulators.
- **Card data, the overlay, PAR and the client.**

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `economy/economy.types.ts` — modified (contract file; D-24856) — the `leftPlayPlayedCardIds` field
- `economy/economy.logic.ts` — modified — carry plus `recordPlayedCardLeftPlay`
- `hero/deferredConditionalGrants.ts` — modified — write site 1
- `moves/operatorSetters.ts` — modified — write site 2
- `hero/splitCard.logic.ts` — modified — the view union
- `hero/heroConditions.evaluate.ts` — modified, comments only — the stale residual note
- `moves/villainDefeatRequirement.logic.ts` — modified, comments only — the stale Squirrel Girl residual note
- `hero/unmarkedConditionalGrants.test.ts` — modified — the residual pin flips, plus the true-8th sibling case
- `hero/playedCardLeftPlay.test.ts` — **new** — T1-T15, T7b, T13b

**Feeds (only if they move; Scope (In) H)**
- `docs/ai/coverage/runtime-observed-hollows.json` — modified — regenerated by `pnpm sim:runtime-observed`, only if `sim:runtime-observed:check` fails
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — modified — the in-play pin (~L753) re-measured, only if the feed moved

**Governance close:**
- `docs/ai/post-mortems/01.6-WP-899-played-this-turn-left-play.md` — **new** — mandatory: a contract-file field (01.6 trigger)
- `docs/ai/DECISIONS.md` — modified — D-24856; "Amended by D-24856" lines on D-24798, D-24568 and D-24816
- `docs/ai/STATUS.md` — modified
- `docs/ai/work-packets/WORK_INDEX.md` — modified
- `docs/ai/execution-checklists/EC_INDEX.md` — modified
- `docs/05-ROADMAP-MINDMAP.md` — modified
- `docs/ai/NUMBER-LEDGER.md` — modified — the three reservation lines gain `; LANDED YYYY-MM-DD`
- `docs/ai/coverage/live-verify.json` — modified — the pending rows (D-24853)

That is 9 code / test files (1 new, 8 modified), plus up to 2 feed files.

## Contract

- `TurnEconomy.leftPlayPlayedCardIds?: CardExtId[]` (a contract-file field; optional, lazy, active-player-scoped, a multiset).
- `recordPlayedCardLeftPlay(economy, cardId): TurnEconomy`, exported from `economy/economy.logic.ts`.
- `playedCardIdsThisTurn` gains the ledger union. Its signature and every other input are unchanged. `playedCardIdsStillInPlay` is unchanged.
- `recordOwnedCardKoed`'s signature is unchanged; it now also records a KO from `'inPlay'`.

## Test Contract

All cases use `node:test` / `node:assert/strict` only, with no boardgame.io import. Fixtures use `test/fixtureBuilders.ts`; the gated-hook cases reuse the hook-building pattern from `unmarkedConditionalGrants.test.ts` (a local copy). T6-T13 and T7b take each card out of play through `moveCardFromZone` out of `inPlay`, then `koCard`, then `recordOwnedCardKoed(G, '0', id, 'inPlay')` (the Scope (In) F shape), or through a real KO move or effect. No test assigns `leftPlayPlayedCardIds` directly.

| # | Input | Expected | Invariant / must NOT |
|---|---|---|---|
| T1 | `recordOwnedCardKoed(G, '0', id, 'inPlay')` on a fresh economy | `leftPlayPlayedCardIds` is `[id]` | write site 1 |
| T2 | `recordOwnedCardKoed` with `'hand'`, `'discard'` and `'deck'` | `leftPlayPlayedCardIds` stays absent (`'leftPlayPlayedCardIds' in G.turnEconomy` is false) | lazy; only `inPlay` records |
| T3 | After T1: `addResources`, `spendAttack`, `recordOutOfTimePlayed`; then `resetTurnEconomy()` | carried through every rebuild; absent after reset | carry chokepoint; turn boundary |
| T4 | A real KO from play: `resolveKoHeroChoice` with `zone: 'inPlay'` on a parked entry | the card is in `G.ko` and in the ledger; `playedCardIdsThisTurn` still lists it | a real move reaches write site 1 |
| T5 | A real self-KO: play a card whose hook carries the generic `ko` effect | the view length is unchanged by its own KO | `heroEffectKo` through the chokepoint |
| T6 | First card: play A, KO A out of play, then evaluate `firstHeroPlayedThisTurn` for card B | `false` | the over-grant is gone |
| T7 | Winter Soldier's count: three plays, one KO'd out, evaluate `playedThisTurn` with value `'3'` | `true` (it was `false` before) | thresholds count the KO'd card |
| T7b | Squirrel Girl: one play plus one play KO'd out of play; `isFightRestrictionBlocking(G, '0', index, { kind: 'at-most-one-card-played' })` | `true` (it was `false` before) | the fight restriction reads the view |
| T8 | Invisible Woman: a 4-cost play KO'd out, then `otherCardOfCostPlayedThisTurn` `'4'` for the resolving card | `true` | the KO'd 4-cost still counts |
| T9 | Warriors Three: three other non-grey names, one KO'd out; `otherDistinctNonGreyHeroesPlayedThisTurnAtLeast` `'3'` | `true` | distinct names include the KO'd card |
| T10 | A count source: `resolveCountSource(G, '0', 'avengers-played-this-turn', resolvingId)` with two other Avengers played and one KO'd out | `2` (it was `1` before) | count sources read the view |
| T11 | Two S.H.I.E.L.D. Agents played, one KO'd out (shared id) | `playedCardIdsThisTurn` lists `starting-shield-agent` twice; with both KO'd, still twice | multiset, no collapse |
| T12 | "Heroes you have" control: empty hand; a Covert Hero still in play and a Tech Hero KO'd out of play | `playedCardIdsStillInPlay` is the one in-play id; `countDistinctHeroClassesYouHave` is `1` (Covert only), the same with or without the ledger; `playedCardIdsThisTurn` has both | L3443-3447 kept |
| T13 | No double count: an Out of Time replay KO'd out of play on turn 2 (in both ledgers); a Penumbra both-sides card KO'd out | the replay counts once; the both-sides card counts as both faces | absorption order; expansion |
| T14 | Operator: `operatorMoveCard` from `inPlay` to the discard pile, from `inPlay` to the top of the deck, then from `inPlay` to the KO pile | each records exactly one entry (the KO route not twice) | write site 2; `koFromPlayerZone` via site 1 |
| T15 | Drift pins over `packages/game-engine/src` | the scan equals `LOCKED_IN_PLAY_WRITE_TABLE` and `LOCKED_LEFT_PLAY_RECORD_TABLE`; a non-vacuous fixture proves a write or call in the wrong function changes the map and a comment never counts | the closed exit set and the two record sites |

Also: Transform is not recorded. Under T5's setup, a card that transforms leaves the view at one entry for its play (the second form) and the ledger stays absent. This is asserted inside T13's suite, as T13b.

## Vision Alignment

**Vision clauses touched:** §1 (rules authenticity, the primary clause), §8 / §22 (determinism), §23 / §24 (competitive integrity: scores follow the printed rules), NG-1.

**Conflict assertion:** No conflict. This WP preserves all touched clauses and crosses none of NG-1..NG-8. It is an engine rules-fidelity fix with no paid or persuasive surface.

**Determinism preservation:**
- The ledger is written only from inside moves and effects, from `G` state alone. No randomness, clock or I/O.
- Hash oracles are unchanged (Assumes 8, measured). The field is absent in every match where no played card leaves play.
- **Replay-compat:** the change is runtime logic, not setup. A stored match whose log KOs a played card out of play and later reads the view re-executes differently from `initialState + log` (D-24119). The same is true of every rules-fidelity packet. D-24856 records it.

## Funding Surface Gate

§20 **N/A**: engine rules fix. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Ledger.** T1-T3 pass. The field is absent until a KO from play and dropped at turn start.
2. **Write sites.** T4, T5 and T14 pass through real moves and effects. Exactly two production calls to `recordPlayedCardLeftPlay` exist (Verification Step 4).
3. **Readers.** T6-T10 and T7b pass. The flipped residual pin and its sibling pass in `unmarkedConditionalGrants.test.ts`.
4. **Multiset and controls.** T11-T13 (with T13b) pass. "Heroes you have" results are unchanged.
5. **Closed set.** T15 passes against `LOCKED_IN_PLAY_WRITE_TABLE` and `LOCKED_LEFT_PLAY_RECORD_TABLE`.
6. **No collateral.** No other existing test changes, apart from the Scope (In) H feed pins. Hash oracles are untouched and green.
7. **Revert proofs.** Each Verification Step 7 mutation fails at least one named case, then is restored.
8. **Gates.** `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. `sim:runtime-observed:check`, `sim:coverage --check` and `effect-index:check` exit 0 after any regeneration.

## Verification Steps

1. `pnpm -r build` → exit 0. Record the game-engine total before any edit (7343 at drafting).
2. `pnpm --filter @legendary-arena/game-engine test` after the change → 0 fail. Record the total.
3. `pnpm sim:runtime-observed:check`. If it fails, run `pnpm sim:runtime-observed`, then `pnpm --filter @legendary-arena/dashboard prebuild:coverage`, then re-measure the in-play pin. Record the before → after numbers.
4. `Get-ChildItem packages/game-engine/src -Recurse -Filter *.ts -Exclude *.test.ts | Select-String -Pattern 'recordPlayedCardLeftPlay\(' | Select-Object Path, LineNumber, Line` → exactly 3 lines: the definition in `economy/economy.logic.ts` and one call each in `hero/deferredConditionalGrants.ts` and `moves/operatorSetters.ts`.
5. `pnpm -r --no-bail test` → 0 fail; paste the per-package totals.
6. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` line-ending churn.
7. Revert proofs, one at a time, each failing at least one named case, then restored:
   - drop write site 1 (T1, T4, T6, T7, T7b, T10)
   - de-duplicate the ledger with `includes` (T11)
   - drop the Penumbra expansion over the ledger (T13)
   - drop the operator call (T14)
   - also record inside `applyHeroTransform` (T13b; T15's record table)
8. `pnpm sim:coverage --check` and `pnpm effect-index:check` → 0.

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the five revert proofs were observed.
- [ ] D-24856 appended to `DECISIONS.md` as Active, with the Reserved Decision content. D-24798 §5, D-24568 §2 and D-24816 §4 each gain an "Amended by D-24856 (the residual is retired)" line.
- [ ] `docs/ai/STATUS.md` entry: user-visible in a match created after the deploy (the User-Visible Impact list).
- [ ] The 01.6 post-mortem `docs/ai/post-mortems/01.6-WP-899-played-this-turn-left-play.md` is written (verdict WP COMPLETE).
- [ ] WORK_INDEX `[x]` with the Done date, the `EC-937:` commit and game-engine totals before → after, ending ` [live-verify: pending]`. Also: EC_INDEX Done; mindmap `✅`; the ledger lines `; LANDED YYYY-MM-DD`; `live-verify.json` pending rows. After `pnpm roadmap:counts:write`, each of these exits 0: `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` and `workindex:liveverify:check`.
- [ ] Two-commit topology: `EC-937:` then `SPEC:`.
- [ ] Live-verify (D-24026) after the deploy, on an operator match staged with setters. Record the result as its own `SPEC:` PR.
  - Play a card, KO it with "Move a card" → KO pile, then play Dr. Octopus as the true 8th card: it grants.
  - Repeat with Dr. Octopus as the 9th physical card: it does not grant.
  - First Strike played second after a KO'd-out first card is `[blocked]`.

## Reserved Decision (lands at execution)

**D-24856 — played-this-turn-left-play.** It locks:
- `TurnEconomy.leftPlayPlayedCardIds`, the exit-side multiset ledger, and why it beats an entry-side history (the per-play write would move both hash oracles in every match).
- The two write sites, and the closed exit table (Assumes 5) with each row's disposition, pinned by T15.
- The view order (in-play expansion, then the ledger expanded, then the Sidekick count, then the Out of Time / Ritual loops) and the no-de-duplication rule.
- **Transform is not recorded:** the engine's second form stands in for the play in `inPlay`. Rules v23 L2059 is satisfied by count; trait reads of the second form are the recorded residual.
- The operator route records (D-24713 §6).
- The rule for later exits: a KO goes through `recordOwnedCardKoed`; any other mid-turn exit from `inPlay` calls `recordPlayedCardLeftPlay` at its site. WP-901 Undercover-from-play is the first named case.
- The retired residuals: D-24798 §5, D-24568 §2 and D-24816 §4 (Squirrel Girl), with "Amended by" lines on all three. The D-24776 shared-id collapse in the Out of Time loop stays, by name, now including its cross-ledger form (Context).
- Recorded divergences outside the view: the coach sequence teacher (raw captured `inPlay`; WP-900 / D-24857 or a follow-up) and the bot's `isFirstHeroCardPlayableFirst` (raw `inPlayCount`).
- Code-style exception: T15 holds the third copy of the comment-strip and enclosing-function scan helpers. Extracting a shared helper is deferred because it would edit the two frozen KO-trigger test files.
- The determinism harness (`replay/replay.execute.ts`) does not reset `turnEconomy`, so `leftPlayPlayedCardIds` accumulates across turns there. A future hash-pinned run that KOs a played card pins that state; re-pinning is Jeff's call.
- The recorded gap: T15 pins literal `.inPlay` writes only. A dynamic-zone write (`zones[zone] = …`) or an in-place-mutating helper is invisible to it; the KO pin (WP-853) covers dynamic KOs, and any non-KO one must name its record in its own packet (WP-901 Undercover-from-play is the first).
- Hash posture (lazy, measured unchanged); turn boundary via `resetTurnEconomy`; replay-compat (runtime change; stored matches that KO a played card out of play may re-execute differently, D-24119).

---

## Gate Record

Each gate was run by an independent subagent. Pre-flight and lint ran first, in parallel. Copilot ran after pre-flight was READY. After every edit, every gate re-confirmed on the final text.

**Pre-flight (01.4), round 1: NOT READY.**
- The agent applied the prototype patch on `4099ec03a` and ran it: game-engine 7343 / 0, hash oracles green, `sim:runtime-observed:check` and `sim:coverage --check` OK. It then restored the worktree.
- Its independent scan reproduced the 13-function / 22-write table.
- Its dynamic-zone sweep found no missed exit.
- **PS-1 (fixed):** Squirrel Girl's `at-most-one-card-played` restriction (`villainDefeatRequirement.logic.ts` L359-362, D-24816 §4) carried the same residual. It joined Scope as a comment-only edit, with User-Visible Impact, T7b and a D-24816 Amended-by line.
- **PS-2 (fixed):** the Step 4 command did not run (`Select-String` has no `-Recurse`).
- **PS-3 (fixed):** revert proof 5 named a test that could not fail. `LOCKED_LEFT_PLAY_RECORD_TABLE` was added.
- **RS-1..13 (applied):**
  - the Assumes 4 dynamic-site list
  - a T15 dynamic-zone gap note
  - User-Visible Impact widened
  - the dependency is WP-806, not WP-802
  - exact T12 values
  - locked totals
  - Vision §1
  - the cross-ledger shared-id note
  - Transform wording
  - the `runFixture.ts` reset site
  - the write-site-2 guard form
  - the re-measured baseline

  RS-13 was declined: the code comments use the L3441-3453 anchor.

**Pre-flight round 2: READY TO EXECUTE**, with five wording and index-sync items (RS-A..E), all applied:
- the T15 blind-spot wording
- WP-901-first is a STOP-and-amend
- the totals arithmetic (19 cases, 7343 → 7363)
- the WORK_INDEX / EC_INDEX rows synced
- Transform and Primary Layer wording

Rounds 3 and 4 reconfirmed READY on the final text.

**Copilot (01.7), round 1: RISK → HOLD, six findings, all applied:**
1. The coach sequence teacher diverges (raw captured `inPlay`). It is now in Out of Scope and D-24856, owned by WP-900 / D-24857 or a follow-up.
2. The bot's `isFirstHeroCardPlayableFirst` reads the raw `inPlayCount`. It is named the same way.
3. The operator deck-top branch was unpinned. T14 now covers it, and the record table counts `recordOperatorLeftPlay(` calls.
4. T6-T13 could hand-build the ledger. The Test Contract now requires the chokepoint KO.
5. The carry aliasing wording was wrong. It now says by reference, like `outOfTimePlayedCardIds`.
6. Two exceptions were unrecorded: the third-copy code-style exception and the replay harness not resetting `turnEconomy`. Both are now in D-24856.

**Copilot round 2: PASS → CONFIRM.** `origin/main` since `4099ec03a` holds only the WP-900 / WP-901 reservations. Open PR #3425 touches `heroCountSource.resolve.ts`, which is outside the allowlist, so it affects merge order only.

**Coordination:** WP-901 (Undercover-from-play) records its in-play exit through `recordPlayedCardLeftPlay`, and its WP names the record-table row. Whichever packet executes second wires it (Context, Later exits).

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

These results come from the independent 00.3 runs.

**Run 1: FAIL.** Fixes applied:
- §3: Assumes 10, the test scaffolding
- §5: the feed tags
- §13: the Step 4 command
- §16.1: the reason for the two-call operator helper

**Run 2: FAIL.** Fixes applied:
- §2 / §5: the WP-901-first clause contradicted the two-write-site lock; it is now a STOP-and-amend, with Assumes 11
- §13: the totals arithmetic
- the EC Before Starting sync

**Runs 3 and 4: PASS**, run 4 on the final text after the copilot edits.

| § | Result |
|---|---|
| §1 | PASS — all required sections; 6 Out of Scope items; 8 ACs |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS after fixes — Assumes 1-11 verified against the repo |
| §4 | PASS — ARCHITECTURE sections, the cited D-ids (D-24816 included), memory refs; 00.2 does not cover `TurnEconomy` |
| §5 | PASS after fix — 9 code / test files (2 comment-only), each tagged and described; feeds and governance tagged |
| §6 | PASS — names and paths verified |
| §7 | PASS — no new dependencies |
| §8 | PASS — a JSON-serializable `CardExtId[]` on `G.turnEconomy`; no move-contract change |
| §9 | PASS — pwsh / pnpm / node commands |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — `node:test`, no boardgame.io / network / DB |
| §13 | PASS after fixes — exact commands and expected outputs; totals add up |
| §14 | PASS — 8 binary ACs tied to the T-cases, both tables, Step 4 and the revert proofs |
| §15 | PASS — DoD covers DECISIONS (three Amended-by lines), STATUS, indexes, ledger, post-mortem, check scripts |
| §15.1 | PASS — surface play.legendary-arena.com; User-Visible Impact; operator live-verify; `[live-verify: pending]` |
| §15.2 | PASS — Risk Tier MEDIUM, byte-identical in the WP and the EC |
| §16 | PASS after fix — helper justified (§16.4 cap); third test-helper copy recorded |
| §17 | PASS — §1, §8 / §22, §23 / §24, NG-1; conflict, determinism and replay-compat lines |
| §18 | PASS — Step 4 count-bounded; the EC guardrail keeps the call-paren form out of `src` prose |
| §19 | N/A — commit-time discipline |
| §20 | PASS — N/A with reason (engine rules fix) |
| §21 | PASS — N/A with reason (no HTTP endpoint or `apps/server/src` surface) |

**Verdict:** PASS.
