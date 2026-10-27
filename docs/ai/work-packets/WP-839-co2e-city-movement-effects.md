# WP-839 — co2e City movement: Green Goblin to the Bridge, Speed Demon charges, Boomerang takes a revealed Villain's place, Ymir returns a Frost Giant Warrior (Game Engine + card data)

**Status:** Draft 2026-10-25 — 01.4 pre-flight READY (PS-1..7 applied); 01.7 RISK → fixes 1-5 applied; 00.3 PASS (EC-877; **D-24772** reserved (#3010)). See §Gate Record. **Amended 2026-10-27 (pre-execution):** WP-831 merged (#3001 `6482b05d`, 2026-10-25), which clears the drafted execution block (Assumes 1); Ymir's seat walk uses WP-846's `seatsInTurnOrderFrom` (same order as drafted), and the any-card builder / apply carry D-24780 §6 `// why:` notes. No behavior or test change.
**Primary Layer:** Game Engine (`villain/` executor, `villainDeck/` reveal + escape opener, `moves/fightVillain.ts` defeat core, `board/` City helpers, `events/` narrative) plus card-data markers, the derived coverage feeds and one arena-client heading.
**Dependencies:** **WP-831 (hard, merged #3001 `6482b05d`; WP-829 and WP-830 beneath it are merged)** — `CityZone` becomes an array of 1-6 spaces; names stay on engine indices (D-24764). Builds on WP-523 / D-24336 + D-24607 (City swap, henchmen are Villains), WP-795 / D-24664 (Spinning Cyclone swap-if-occupied), WP-542 / D-24351 (the secondary-fire-site play pattern), WP-757 / D-24587 (the extracted `resolveVillainEscape`), WP-793 / D-24656 + WP-817 / D-24750 (the post-move escape opener and its every-player discard), WP-684 / D-24501 (multi-seat seat choice), D-24703 (Ambush narrative names fire-site effects). Soft: WP-835 (same co2e marker block), WP-837 (drafted in parallel; it also rides WP-817's owed-discard FIFO, with a `traitFilter`; see Operator fork F3), WP-840 (The Blob held outside `G.city` in `G.villainsBesideMastermind`).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It changes a contract file (`rules/villainAbility.types.ts`: four primitives and three descriptor fields), adds one optional field to WP-817's owed-discard entry and a seat-choice kind, extracts the reveal path's City-entry block into a shared helper, and widens one narrative composer.
**Arc:** co2e villain fidelity (WP-835..840), packet 5 of 6 (inventory rows #14, #27, #35, #37).

> Baseline: `origin/main` at `677c4109` (the #3010 reserve on top of `5e045fa9`). Line anchors below are at that SHA. Re-read every anchor, the primitive count (31 at draft) and the test totals at execution.
>
> `origin/main` has since moved to `e580d801`.
> - WP-829 merged as `461ed924`. It shifts these anchors: `types.ts` (`PendingEscapeEffectDiscard` L1616), `seatChoice.resolve.ts` (WP-817 arm L543), `ai.seatChoice.ts` (L142) and `PendingSeatChoicePrompt.vue` (L125). Its `game.ts` purge sweep sits around the escape opener; there is no interaction.
> - WP-830 (#2998) merged as `e580d801`. It touches `fightVillain.ts`, `seatChoice.resolve.ts`, `ai.seatChoice.ts`, `PendingSeatChoicePrompt.vue`, `types.ts`, `game.ts`, the drop set and the busy guard. These are anchor shifts only; the rebase rule covers them.
> - WP-831 (#3001) merged as `6482b05d`, from head `0585f811`, which is tree-identical to the `a6e8dfa5` the gates verified (`git diff a6e8dfa5 0585f811` is empty), so no cited anchor changed (amendment 2026-10-27).
> - WP-832 (#3004) merged as `fe24c19a`; it shifts more anchors, so re-read them on `main`.
>
> The packet holds whether sibling WP-835..838 / 840 are present on `main` or absent.

---

## Goal

As a player facing the Sinister Spider-Foes, the Sinister Syndicate and the Enemies of Asgard from Core 2E, I want four villains that move cards around the City to do what they print, so these groups play like the tabletop game instead of entering the City and doing nothing.

| Card (`co2e`, 2 copies each) | Printed line (verbatim, `data/cards/co2e.json`) | Today | After this session |
|---|---|---|---|
| Green Goblin (`sinister-spider-foes`) | `Ambush: Green Goblin captures a Bystander. Put him on the Bridge. If there's another Villain there, swap them.` | No marker. Nothing happens (D-24266 `unmarked-ability` breadcrumb). | He captures a Bystander and moves to the Bridge; a Villain already there swaps into his old space. No Bridge in a smaller City: he stays put. |
| Speed Demon (`sinister-syndicate`) | `Ambush: Speed Demon moves two extra spaces forward. If this pushes any other Villains forward, each player discards a card.` | No marker. | He charges two spaces forward, pushing Villains ahead of him (they can escape). If he pushed anyone, every player discards a card of their choice. |
| Boomerang (`sinister-syndicate`) | `Fight: KO one of your Heroes. Then reveal the top card of the Villain Deck. If it's a Villain, put Boomerang in its place and play that Villain.` | No marker. The fighter keeps Boomerang's 2 VP and nothing else happens. | The fighter KOs a Hero; the Villain Deck's top card is revealed. A Villain there is played, and Boomerang goes on top of the Villain Deck in its place (out of the fighter's Victory Pile). Anything else stays on top. |
| Ymir, Frost Giant King (`enemies-of-asgard`) | `Ambush: Choose a Frost Giant Warrior from any player's Victory Pile to enter the city.` | No marker. | A Frost Giant Warrior leaves a Victory Pile and enters the City like a newly played Villain: it pushes, can cause an escape and does its own Ambush. |

## User-Visible Impact

- Green Goblin's reveal logs `Ambush effect: Green Goblin moved to the Bridge.` (or the swap line), then the composed `Ambush effect:` capture line. The move self-narrates inside the executor, so it lands first. The board shows him on the Bridge holding the Bystander.
- Speed Demon's reveal logs `Ambush effect: Speed Demon charges 2 spaces forward.`. Villains he pushes off the last space escape as usual. If he pushed anyone, every player who holds a card gets an "A Villain's effect — choose a card to discard" prompt (the seat-choice prompt WP-793 / WP-817 use). A bot-ally seat discards its least valuable card; autoplay, sim and PAR take the first card in hand order.
- Fighting Boomerang logs the KO, then the revealed card. A Villain enters the City as if just played (Ambush included), and Boomerang is back on top of the Villain Deck, so the next turn's reveal brings him back. The fighter does not keep his 2 VP.
- Ymir's reveal brings a Frost Giant Warrior back into the Sewers, pushing Ymir forward. The Warrior's own Ambush resolves (WP-837 marks it; until then it shows the existing `unmarked-ability` breadcrumb).
- The center-screen Ambush overlay names Speed Demon's charge and Ymir's returned Warrior instead of "entered the city with no Ambush effect" (D-24703 class).

---

## Assumes

1. **WP-831 is merged to `main`** (PR #3001, head `0585f811`; #2995 and #2998 beneath it are merged; #3004 stacks on it). After it:
   - `board/city.types.ts`: `CityZone = CitySpace[]`, `CITY_DEFAULT_SIZE = 5`, `CITY_MIN_SIZE = 1`, `CITY_MAX_SIZE = 6`;
   - `pushVillainIntoCity` escapes `city[length - 1]`;
   - `validateCityShape` accepts lengths 1-6;
   - names stay on engine indices: 0 Sewers … 4 Bridge (`board/citySpaceNames.ts`, unchanged by WP-831). A City of 4 or fewer has no Bridge; a sixth space (index 5) is unnamed and beyond the Bridge.
   Verify `CITY_MAX_SIZE` is exported from `board/city.types.ts` on `main` before coding. If WP-831 is not merged, this packet is BLOCKED.
2. **Rules text** (`docs/legendary-universal-rules-v23.md`):
   - L541-575: a Villain enters the Sewers; one Villain per space; an occupant is pushed one space toward escape, in a chain; a Villain pushed off the final space escapes (HQ KO, Bystander discard, Escape effect); then the new Villain's Ambush, after all escape effects.
   - L1117-1122 (Charge): "(After this Villain enters the Sewers,) it charges forward an extra space, pushing other Villains forward." "This might cause more escapes." "Some Villains charge multiple spaces!"
   - L1458-1463 (Fateful Resurrection) and L1824-1830 (Rise of the Living Dead): a Villain that re-enters the City from elsewhere follows the normal entry rules: it pushes into the Sewers, escapes resolve, then it does its Ambush.
   - L2831-2837: a Villain that enters the City at an unusual time or in an unusual space still does its Ambush; only City entry triggers Ambush.
   - L1478-1484: "If a city space like the Rooftops is destroyed, act as if that city space no longer exists … card effects won't do anything that say … 'Move a Villain to the Rooftops…'."
   - L2880-2884: a card effect that makes a Villain escape makes it escape "from whatever space it's in, without pushing any other Villains."
   - L2927: "Henchman Villain cards are indeed Villains." (D-24603 / D-24607.)
   - L628: Villains don't push forward when the revealed card is a Bystander, Twist or Strike.
3. **Card text and markers on the baseline.** The four lines in §Goal are verbatim in `data/cards/co2e.json`. On draft `main`:
   - `scripts/convert-cards/inputs/villain-effect-markers.json` `villains.co2e` holds only `masters-of-evil` and `skulls/paibok-the-power-skrull`;
   - the ledger rows `co2e-villain-sinister-syndicate-boomerang`, `co2e-villain-sinister-spider-foes-green-goblin`, `co2e-villain-sinister-syndicate-speed-demon` and `co2e-villain-enemies-of-asgard-ymir-frost-giant-king` are `(unmarked)` (`docs/ai/coverage/villain-mechanic-ledger.csv` L127 / L133 / L148 / L159).
   If any sibling WP-835..838 / 840 merged first, its rows sit beside these. That is expected (EC Before Starting). In particular, Ymir may already carry WP-836's `fight` marker, and its ledger row may already be `executable`. What must hold: none of *this packet's* four lines (Goblin / Speed Demon Ambush, Boomerang Fight, Ymir Ambush) carries an `[effect:]` marker. Frost Giant Warrior instance ids are `co2e-villain-enemies-of-asgard-frost-giant-warrior-00` / `-01`.
4. **Primitive vocabulary.** `VillainEffectPrimitive` (`rules/villainAbility.types.ts` L335-366) and `VILLAIN_EFFECT_PRIMITIVES` (L434-483) hold **31** members, last `discard-hero-each-player-by-cost`. `rules/villainAbility.types.test.ts` pins them in five places:
   - the L360-391 ordered list;
   - the L393-397 length;
   - the L398-402 last-member literal;
   - the L619 length;
   - the L651-652 length.
   `villain/villainEffects.execute.ts` `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (L720) is the allowlist that labels a no-op handler's trace `no-op`; a no-op handler missing from it is traced `fired`. `VillainEffectDescriptor` is L575-649 (`victoryVillainGroup?: string` L642, `eligibleCosts` L648); `descriptorKey` (L679) is `primitive|target|magnitude|selector`. WP-836 / WP-837 / WP-838 (drafted in parallel) may append primitives first; this packet appends after whatever is last at execution.
5. **Marker parser** (`setup/villainAbility.setup.ts`): `parseParameterizedEffect` (L388) splits `!` then `@` (`parseLocationGatedEffect` L429); `parseUngatedEffect` (L490) has one arm per parameterized primitive and a no-param tail (L836) that returns `{ primitive }` for a 1-part token. `parsePositiveInteger` (L225) and `isCitySpaceName` (L347) exist. `extractEffects` reads only `[effect:…]`.
6. **Executor** (`villain/villainEffects.execute.ts`): `executeVillainAbilities` (L134) dispatches each descriptor through `applyVillainEffect` (L4008) and `VILLAIN_EFFECT_HANDLERS` (L3951, `Record<VillainEffectPrimitive, VillainEffectHandler>`); a keyword-less descriptor records no result, so a new handler self-narrates via `pushLog`. Precedents:
   - `villainEffectSwapTwoCityVillains` (L3664) swaps two City indices by direct assignment; `collectCityVillainIndices` (L3625) counts villains and henchmen (D-24607).
   - `villainEffectPlayVillainDeckCards` (L1746) is a deliberate no-op; its detector `villainCardPlaysVillainDeckCards` (L1774) and `villainCardEscapeTriggersSchemeTwist` (L1674) scan `getVillainHooksForCard(...)` with the `!G.villainAbilityHooks` guard.
   - `villainEffectCaptureBystander` (L1402) attaches the supply's top Bystander to `cardId` (the uncounted variant reverse-maps to `captureBystander` and narrates through the generic line).
   - Viper's handler (~L3826) derives `setAbbr` from the source card's own ext_id through the `-villain-` infix (D-24299 Path B).
   - `villainEffectTimingLabel` (L1812) and `resolveCardDisplayName` (L372) label log lines.
7. **The reveal path** (`villainDeck/villainDeck.reveal.ts`): `performVillainReveal` (L219) validates the City shape, removes the card from the deck (L276), then pushes (L278), logs the entry line (L296-308), resolves an escape through `resolveVillainEscape` (L310-315) and runs the Ambush block (L335-416). The Ambush block runs, in order:
   - the `onAmbush` executor call;
   - the `Ambush effect:` line;
   - The Leader's count (`villainCardPlaysVillainDeckCards`);
   - the `ambushResolved` event, with `composeAmbushNarrative(name, results, playCount)` (`events/notableEvents.compose.ts` L338);
   - `playTopVillainDeckCards` (L767).
   `resolveVillainEscape` (L595) is the shared escape procedure. `enterCityIgnoringAmbush` (`villainDeck/villainDeck.enterCity.ts`) is the no-Ambush entry; it imports from this module.
8. **The Fight fire site.** `moves/fightVillain.ts` `defeatCityVillainCore` (L509), shared with Silent Sniper's free defeat:
   - nulls the City space and pushes the card onto the fighter's Victory Pile (L566);
   - awards Bystanders and captured Heroes;
   - runs `onFight` (L608) and the log lines;
   - pushes `fightResolved`;
   - then runs The Leader-style play block for Endless Armies (L688-715). That block builds a `RevealContext` from `shuffleContext.random` + `readTurnNumber(ctx)` and calls `playTopVillainDeckCards(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, n)`.
   `moves/zoneOps.ts` `moveCardFromZone` (L54) returns new arrays.
9. **The escape opener** (`villainDeck/villainEscapeProcedure.ts`): `openEscapeProcedureSeatChoiceIfNeeded` (L272) drains `G.pendingEscapeProcedures`, then calls `openEscapeEffectDiscardIfNeeded` (WP-817). That function loops while its queue exists, returns on `hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined` or `evaluateEndgame(G) !== null`, and parks with the step-2 ride rule. Its callers are `game.ts` `turn.onMove` (L891), `simulation/simulation.runner.ts` (L703, L805), `simulation/par.aggregator.ts` (L778, L861) and `test/fixtures/runFixture.ts` (L419). `buildEscapeBystanderDiscardChoice` builds one option per hand card for every seat with a card. `applyEscapeEffectCostDiscard` discards through `discardFromHand` in ascending seat order. The queue `G.pendingEscapeEffectDiscards` is already in the end-of-game drop set (`endgame/mastermindVictory.logic.ts` L99) and the operator board-busy guard (`moves/operatorSetters.logic.ts` L85). WP-837 (drafted in parallel) adds an optional `traitFilter` to its entry, widens `escapedCardId` to "the Villain whose Escape or Ambush effect owes the discard" and routes trait entries to its own kind.
10. **Seat-choice consumers**:
    - `moves/seatChoice.resolve.ts` dispatches by `kind` (~L527-540);
    - `simulation/ai.seatChoice.ts` sends the discard kinds to `indexOfLeastValuableCard` (L131-142);
    - `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` maps `kind` to a heading (L116-128).
    `PendingSeatChoice.kind` is a free `string` (`types.ts` L1407). `PendingEscapeEffectDiscard` is `types.ts` L1601 and `pendingEscapeEffectDiscards` L2386.
11. **Zone invariant.** `invariants/gameRules.checks.ts` `checkNoCardInMultipleZones` (L74) scans Victory Piles, the City and `villainDeck.deck`, so a card moved between them must leave its source.
12. **Marker script** (`scripts/convert-cards/apply-effect-markers.mjs`) keeps hand-synced copies: `VILLAIN_EFFECT_PRIMITIVES` (L175), `CITY_SPACE_NAMES` (L223) and `isValidParameterizedEffectToken` (L271). `validateAndOrderKeywords` (L517) emits legacy keywords first, then parameterized tokens in input order, so `captureBystander` / `koHeroCurrentPlayer` precede the new tokens on their lines.
13. **No hashed fixture or PAR artifact plays these groups.** The engine fixtures and `data/par` never name `co2e/sinister-spider-foes`, `co2e/sinister-syndicate` or `co2e/enemies-of-asgard`. The sim matrix (`docs/ai/coverage/runtime-observed-hollows.json`) is core-only. The groups do appear in `packages/registry/src/gauntletLoadouts.generated.ts`.
14. **The Blob (WP-840)** is held outside `G.city` (a "left of the Mastermind" slot that nothing moves). Every primitive here reads and writes `G.city` only. If WP-840 executed first and keeps The Blob in `G.city`, STOP and reconcile.
15. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline (after WP-831).

If any item is false, this packet is **BLOCKED**: STOP and reconcile (update this WP and D-24772) before coding.

## Context (Read First)

- **Four primitives, two placements.**
  - Green Goblin's move needs no escape and no reveal, so it runs in the executor like Whirlwind's swap.
  - Speed Demon's charge can push Villains off the City, so it needs `resolveVillainEscape`.
  - Ymir's Warrior entry needs the full City-entry path, Ambush included.
  - Boomerang's play needs `performVillainReveal`.
  The executor has none of the reveal context, so these three use the WP-481 / WP-542 secondary-fire-site pattern: a reachable no-op handler (no hollow record), plus the real work at the Ambush fire site (`villainDeck.reveal.ts`) or the Fight fire site (`defeatCityVillainCore`).
- **Why the City-entry block is extracted.** Ymir's Warrior must enter "like any other Villain" (Assumes 2): push, escape, entry log, Ambush, the `ambushResolved` event. That is exactly `performVillainReveal`'s villain branch after the deck removal. WP-757 extracted `resolveVillainEscape` the same way. The extraction is mechanical, and the reveal path stays byte-identical; the existing reveal tests are the oracle.
- **Speed Demon is a Charge.** The rulebook's Charge keyword (Assumes 2) is the same move: forward one space at a time, each step pushing the block ahead of him, possibly off the end. "If this pushes any other Villains forward" reads the charge steps only. Speed Demon's own entry push is the ordinary reveal, not "this". The primitive is named for the keyword (`charge-forward:<N>`) so the six `[keyword:Charge] N spaces` Ambush lines in other sets can reuse it later (Out of Scope).
- **Why Speed Demon's discard rides WP-817's owed-discard FIFO.** "Each player discards a card" is every player's own pick, and WP-793 / WP-817 already give every player that pick as a seat choice opened after the move. The Ambush fires inside a reveal that has no `events`, so the charge records the owed discard. It goes on the same lazy FIFO Primus's Escape uses (`G.pendingEscapeEffectDiscards`), as WP-837 does for Mystique: one queue, no new `G` field, and the drop set and busy guard already cover it. The entry gains an optional `anyHandCard` marker, routed to its own unfiltered builder and kind. Rule order holds by construction:
  - escape steps 1-2 drain before the FIFO opens;
  - an Escape effect of a Villain the charge pushed out (inline step 3) records before the charge's own entry.
  Like D-24656 point 4 / D-24750, the discard resolves after the move, a recorded deviation.
- **Green Goblin swaps, he does not push.** "Put him on the Bridge. If there's another Villain there, swap them." is the Spinning Cyclone swap-if-occupied shape (D-24664). Nothing escapes. The Bridge is engine index 4 (Assumes 1). In a City of 4 or fewer spaces the Bridge does not exist, and rules L1478-1484 say a "move a Villain to [that space]" effect does nothing. In a 6-space City the Bridge is index 4, one space short of the edge.
- **Boomerang returns to the Villain Deck.** "Put Boomerang in its place" means the revealed Villain's place on top of the Villain Deck, and "play that Villain" is the normal reveal of that card. So the fire site moves Boomerang from the fighter's Victory Pile to just under the revealed Villain and calls `performVillainReveal`. That function plays the top card (Villain to the City, `onCardRevealed` hooks, Ambush) and leaves Boomerang on top. Boomerang's rescued Bystanders stay rescued (they were awarded before the Fight effect). The fighter loses his 2 VP: the card text moves him, so that is faithful.
- **Ymir's chooser.** "Choose a Frost Giant Warrior from any player's Victory Pile" names a choice, but the Warriors are identical. The choice only decides whose Victory Pile loses 2 VP, and the team outcome is the same either way. Like D-24335's collapsed KO-or-gift, this packet locks a deterministic pick that never takes VP from another player when the current player can pay it: the current player's pile first, then the other seats in ascending seat order, wrapping. The interactive alternative is Operator fork F1.
- **Henchmen are Villains** (D-24603 / D-24607): any City occupant counts as "another Villain" for Goblin's swap and Speed Demon's push, and a henchman on top of the Villain Deck counts for Boomerang.
- **Soft ordering with the sibling drafts.**
  - WP-835..838 and WP-840 append to the same union, array, handler map, script copy, count pins and `villains.co2e` marker blocks; whichever lands later rebases those blocks, and this packet's primitives are "the next four after `main`'s last".
  - WP-837 also gates `play-villain-deck-cards` with an optional reveal tail and adds a `currentPlayer?` parameter to `villainCardPlaysVillainDeckCards`. The extracted `resolveVillainCityEntry` must keep calling it exactly as `main` does at execution.
  - WP-837 ordering, either way. If WP-837 landed first, its 4-argument `villainCardPlaysVillainDeckCards(G, cardId, 'onAmbush', ctx.currentPlayer)` call moves into `resolveVillainCityEntry` unchanged (it reads `context.ctx.currentPlayer`). If this packet lands first, WP-837's reveal-site edit lands in the extracted helper.
  - WP-840 adds `G.villainsBesideMastermind` to the uniqueness invariant; nothing here reads it.
  - WP-840 also moves `defeatCityVillainCore`'s defeat half into `defeatVillainCardCore`. If WP-840 landed first, the Boomerang block goes after the Endless Armies block in `defeatVillainCardCore`. If this packet lands first, WP-840 carries the block verbatim.
- **No-UX-freeze.** The any-card discard reuses `G.pendingSeatChoice` and everything already built around it:
  - its existing UIState projection;
  - `PendingSeatChoicePrompt` (unknown kinds render `Your choice`);
  - the registered `resolveSeatChoice` move;
  - the kind-dispatched timeout default.
  It adds no move, `pending*` queue, block-all guard, UIState field or `UiMoveName` entry. A missed dispatch arm silently skips the discard (T18 fails); it never freezes.
- **Split vs one WP.** The parent reserved one packet for these four lines. They share the marker block, the parser, the executor and the City helpers, and Ymir and Speed Demon share the extracted entry block. A split would duplicate the extraction across two packets. The file count is above the ~10 guideline (see §Files Expected to Change).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (villain group shape), §5 (`[effect:]` markers are pipeline-appended).
- `docs/ai/ARCHITECTURE.md`: §Zone & Pile Structure (CardExtId-only zones), §The Rule Execution Pipeline, Persistence Boundaries (`G` runtime-only), §Architectural Principles #1 (determinism).
- `docs/ai/DECISIONS.md`: scan D-24023, D-24034, D-24081, D-24160, D-24266, D-24287, D-24299, D-24335, D-24336, D-24351, D-24587, D-24603, D-24607, D-24656, D-24664, D-24703, D-24750, D-24764 before coding.
- User memory: `reference_villain_effect_vocabulary_extension`, `reference_bot_legalmoves_moveguard_divergence`, `reference_card_data_pipeline`, `reference_engine_tests_never_typechecked`, `reference_setup_hook_change_replay_compat`, `reference_fightvillain_defeats_henchmen_too`.

### Operator forks (drafted with the recommended default)

- **F1 — Ymir's chooser.** Default: the deterministic pick above. Alternative: an active-seat-only seat choice opened after the move, listing every player who holds a Warrior; it is only needed when Warriors sit in two or more piles. That adds a queue, a builder, an apply arm and a bot pick. Recommend the default: identical cards, and the outcome is VP attribution only.
- **F2 — Speed Demon's discard.** Default: an every-player seat choice (the WP-817 pattern). Alternative: the D-24284 split, where the current player parks the existing discard choice and other players auto-discard their least valuable card. Recommend the default: every human picks their own card.
- **F3 — one queue with WP-837.** Both drafts ride WP-817's FIFO with an optional, presence-tested field on the entry: WP-837's `traitFilter`, this packet's `anyHandCard`. Each routes to its own builder and kind. Default: whichever executes second adds its branch beside the other one's in `openEscapeEffectDiscardIfNeeded`, the dispatch, the bot branch and the prompt, and keeps the other's tests green. Alternative: one discriminated `discardKind` field for all three entry shapes. That renames WP-817's shape, so it is not recommended.
- **F4 — Boomerang's KO before the reveal.** `koHeroCurrentPlayer` may park an interactive KO, and the reveal fires in the same move, before the pick resolves (the Endless Armies posture, D-24351). Default: accept and record it. Alternative: a deferral queue. Recommend the default: the KO targets hand and play, which the played Villain's reveal does not change.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.
- Tests use `node:test` + `node:assert`, with no `boardgame.io` import.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24772) before coding. One WP per session.

**Packet-specific:**
- **Byte-identical reveal path.** The extraction changes no log line, event, field or order for any card without the new markers. The existing `villainDeck.reveal.test.ts` assertions are not edited.
- **`G.city` only.** No primitive reads or writes a slot outside `G.city` (The Blob, Assumes 14). Every City loop uses `G.city.length`, never 5.
- **Data, not English.** Behavior comes only from the six markers in Locked Values.
- **Markers only.** Regenerate card data with `apply-effect-markers.mjs` alone. Never run `convert-cards-v15.mjs`.
- **Self-narrate.** Every new outcome logs through `pushLog` (hash-excluded `G.messages`, D-24081). `VillainEffectKeyword`, the legacy reverse-map and `EFFECT_KEYWORD_LABELS` stay frozen; no new field enters `descriptorKey`.
- **Zone moves through helpers.** Victory Pile removals use `moveCardFromZone`. Hand discards use `discardFromHand`. City entry uses the extracted helper; escapes use `resolveVillainEscape`; the Boomerang play uses `performVillainReveal`.
- **No new `G` key.** The owed discard reuses the lazy `G.pendingEscapeEffectDiscards` FIFO (WP-817); the new entry field is optional and present only on Speed Demon's entries.

## Locked Values

**Types (`rules/villainAbility.types.ts`):**
- Primitives appended to the union **and** the end of `VILLAIN_EFFECT_PRIMITIVES`, in this order: `'move-self-to-city-space'`, `'charge-forward'`, `'reveal-villain-deck-top-swap-self'`, `'enter-city-from-victory-pile'` (positions 32-35 at draft; 31 → 35, re-read at execution). The pins in `villainAbility.types.test.ts` (Assumes 4) change as follows; re-read the line numbers if siblings landed first:
  - L360-391 ordered list: the four names are appended;
  - L393-397 length → 35;
  - L398-402 last-member literal → `'enter-city-from-victory-pile'` / `(position 35)`;
  - L619 and L652 lengths → 35.
- `VillainEffectDescriptor` gains, none in `descriptorKey`:
  - `destinationCitySpace?: CitySpaceName` (`move-self-to-city-space` only);
  - `chargePushConsequence?: 'discard-each'` (`charge-forward` only);
  - `victoryVillainCard?: string` (`enter-city-from-victory-pile` only, beside the reused `victoryVillainGroup`). The `victoryVillainGroup` JSDoc widens from Viper-only to name both carriers. The Viper value stays normalized; this packet's value is the validated slug.
  `charge-forward` carries its space count in `magnitude`.

**Marker grammar (engine parser and `apply-effect-markers.mjs`, identical):**
- `move-self-to-city-space:<space>`: exactly 2 parts; `<space>` ∈ `CITY_SPACE_NAMES` (case-sensitive) → `{ primitive, destinationCitySpace }`.
- `charge-forward:<N>` or `charge-forward:<N>:discard-each`: `<N>` per `parsePositiveInteger` → `{ primitive, magnitude: N }`, plus `chargePushConsequence: 'discard-each'` for the 3-part form; any other third part or a fourth part → null.
- `reveal-villain-deck-top-swap-self`: no params (the existing no-param tail).
- `enter-city-from-victory-pile:<groupSlug>:<cardSlug>`: exactly 3 parts; each slug matches `^[a-z0-9]+(-[a-z0-9]+)*$` → `{ primitive, victoryVillainGroup, victoryVillainCard }`.
- Anything else for these four → null → `unresolvedMarkers`.

**Data (marker map `villains.co2e`):** merge these keys into any group or card object a sibling created (WP-835..838; e.g. WP-836's `enemies-of-asgard.ymir-frost-giant-king.fight` sits on the same card object as this packet's `ambush`). Never replace a sibling's key.
- `sinister-spider-foes.green-goblin.ambush: ["captureBystander", "move-self-to-city-space:bridge"]`
- `sinister-syndicate.speed-demon.ambush: ["charge-forward:2:discard-each"]`
- `sinister-syndicate.boomerang.fight: ["koHeroCurrentPlayer", "reveal-villain-deck-top-swap-self"]`
- `enemies-of-asgard.ymir-frost-giant-king.ambush: ["enter-city-from-victory-pile:enemies-of-asgard:frost-giant-warrior"]`
- `mechanic-provenance.json`: the four primitives → `{ "wp": "WP-839", "decision": "D-24772" }`.

**Pure helpers:**
- `board/citySpaceNames.ts` `describeCityIndex(index: number): string`: 0..4 → `the Sewers` / `the Bank` / `the Rooftops` / `the Streets` / `the Bridge`; any other integer → `` `space ${index + 1}` ``.
- `board/city.logic.ts` `chargeCityCardOneSpace(city: CityZone, fromIndex: number): ChargeStepResult`, with `export interface ChargeStepResult { city: CityZone; escapedCard: CardExtId | null; pushedCount: number; isChargerOffCity: boolean; }`. The input is never mutated.
  - Empty or out-of-range `fromIndex`: an unchanged copy, `pushedCount: 0`.
  - `fromIndex === length - 1`: the space empties and `isChargerOffCity: true`.
  - Otherwise: the charger leaves `fromIndex` for `target = fromIndex + 1`. The occupied block from `target` advances one space up to the leftmost empty space at or after `target` (`pushedCount = k - target`). With no empty space there, `city[length - 1]` becomes `escapedCard` and `pushedCount = length - target`.

**Executor (`villain/villainEffects.execute.ts`):**
- `export function findVillainHookDescriptor(G, cardId, timing, primitive): VillainEffectDescriptor | null` returns the first descriptor of that primitive among the card's hooks at that timing. It has the `!G.villainAbilityHooks` guard and iterates `hook.effects ?? []`.
- No-op handlers returning `{ targets: [] }`: `villainEffectChargeForward`, `villainEffectRevealVillainDeckTopSwapSelf`, `villainEffectEnterCityFromVictoryPile`.
- Add `'charge-forward'`, `'reveal-villain-deck-top-swap-self'` and `'enter-city-from-victory-pile'` to `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (`villainEffects.execute.ts` L720), with a `// why:` naming D-24772 and the fire site. `move-self-to-city-space` is NOT added: it mutates `G.city`.
- `villainEffectMoveSelfToCitySpace` (label = `villainEffectTimingLabel(timing)`, names via `resolveCardDisplayName`). Destination index = `CITY_SPACE_NAMES.indexOf(destinationCitySpace)`; from index = `G.city.indexOf(cardId)`. In order:
  1. Destination missing → `` `${label} effect: ${name} has no destination space; it does not move.` `` `'blocked'`.
  2. `from < 0` → `` `${label} effect: ${name} is not in the City, so it does not move.` `` `'blocked'`.
  3. `destination >= G.city.length` → `` `${label} effect: ${describeCityIndex(destination)} is not part of the City right now, so ${name} stays where it is.` `` `'blocked'`.
  4. `from === destination` → `` `${label} effect: ${name} is already on ${describeCityIndex(destination)}.` `` `'blocked'`.
  5. Otherwise `other = G.city[destination]`, then `G.city[destination] = cardId` and `G.city[from] = other` (null when the space was empty). Empty → `` `${label} effect: ${name} moved to ${describeCityIndex(destination)}.` ``; occupied → `` `${label} effect: ${name} moved to ${describeCityIndex(destination)}, and ${otherName} moved to ${describeCityIndex(from)}.` ``, both `'applied'`.
  Returns `{ targets: [] }`.

**Reveal path (`villainDeck/villainDeck.reveal.ts`):**
- Extract `export function resolveVillainCityEntry(G, context, implementationMap, cardId, entryPhrase: string): void`: the push, entry log, escape and Ambush block (L278-416). The entry line becomes `` `[Ambush] ${ref} ${entryPhrase}!` `` / `` `${ref} ${entryPhrase}.` ``. `performVillainReveal` keeps validation + deck removal and calls it with `'revealed and entered the city'`.
- Inside the Ambush block, before the event, read `chargeDescriptor = findVillainHookDescriptor(G, cardId, 'onAmbush', 'charge-forward')` and `entryDescriptor = findVillainHookDescriptor(G, cardId, 'onAmbush', 'enter-city-from-victory-pile')`. When `entryDescriptor` is non-null, compute `entrant = selectVictoryPileCityEntrant(G, cardId, entryDescriptor, ctx.currentPlayer)`. Pass `composeAmbushNarrative(name, results, playCount, fireSiteClauses)` with the clauses, in order:
  - `` `charged ${N} ${unit} forward` `` when `chargeDescriptor` is non-null (unit `space` / `spaces`);
  - `` `brought ${entrantName} back into the city` `` when `entrant` is non-null (name with the `ambushCardName` fallback).
  After the event, in order: The Leader's play (unchanged); `chargeVillainForward(...)` when `chargeDescriptor` is non-null; `enterCityFromVictoryPile(..., entrant)` when `entryDescriptor` is non-null.
- `chargeVillainForward(G, context, implementationMap, cardId, descriptor): void`:
  - Not in the City → `` `Ambush effect: ${ref} is not in the City, so it does not charge.` `` `'blocked'`, return.
  - Log `` `Ambush effect: ${ref} charges ${N} ${unit} forward.` `` `'threat'`.
  - Loop N times on `chargeCityCardOneSpace(G.city, G.city.indexOf(cardId))`: `pushedCount > 0` sets `hasPushedOthers`; an `escapedCard` → `resolveVillainEscape` inside that step. `isChargerOffCity` → `` `Ambush effect: ${ref} charged off the end of the City and escaped.` `` `'threat'`, then `resolveVillainEscape(..., cardId)`, then `break` out of the step loop. It is `break`, not `return`, so the consequence below still evaluates. A mid-loop `indexOf === -1` is the harmless out-of-range step.
  - With `chargePushConsequence === 'discard-each'`: pushed → `enqueueAnyCardEffectDiscard(G, cardId, 'Ambush')` + `` `Ambush effect: ${ref} pushed other Villains forward, so each player must discard a card.` `` `'threat'`; not pushed → `` `Ambush effect: ${ref} pushed no other Villains forward, so no one discards.` `` `'blocked'`.
- `export function selectVictoryPileCityEntrant(G, sourceCardId, descriptor, currentPlayer): { seat: string; cardId: CardExtId } | null`:
  - `setAbbr` comes from `sourceCardId` through the `-villain-` infix (none → null);
  - prefix = `` `${setAbbr}-villain-${victoryVillainGroup}-${victoryVillainCard}-` ``, and the remainder matches `^[0-9]{2}$`;
  - seats are `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)` (`turn/seatOrder.logic.js`, WP-846 / D-24780; amended 2026-10-27): the sorted seats starting at `currentPlayer` and wrapping, sorted when it is absent — the same order as drafted, through the one shared helper instead of a second hand-rolled rotation (a new import in `villainDeck/villainDeck.reveal.ts`; pure, no cycle);
  - the first match in pile order wins.
- `enterCityFromVictoryPile(G, context, implementationMap, sourceCardId, entrant: { seat: string; cardId: CardExtId } | null)` (the entrant computed above, so the narrative and the entry name the same card):
  - null → `` `Ambush effect: no matching Villain is in any player's Victory Pile, so nothing enters the city.` `` `'blocked'`;
  - else log `` `Ambush effect: ${sourceRef} brings ${entrantRef} back from Player ${seat}'s Victory Pile.` `` `'threat'`, then `const removal = moveCardFromZone(zones.victory, [], cardId)`.
    - `removal.found` false → `` `Ambush effect: ${entrantRef} is no longer in Player ${seat}'s Victory Pile, so nothing enters the city.` `` `'blocked'`, return. This is defensive: the pick precedes The Leader's play and the charge.
    - Otherwise set `zones.victory = removal.from` and call `resolveVillainCityEntry(G, context, implementationMap, cardId, `entered the city from Player ${seat}'s Victory Pile`)`.
- `export function swapFoughtVillainWithVillainDeckTop(G, context, implementationMap, foughtCardId, currentPlayer): void`, checked in this order:
  1. Not in that player's Victory Pile → `` `Fight effect: ${ref} is not in Player ${currentPlayer}'s Victory Pile, so it cannot take a Villain's place.` `` `'blocked'`.
  2. Empty deck → `` `Fight effect: the Villain Deck is empty, so ${ref} reveals nothing.` `` `'blocked'`.
  3. Top type (`G.villainDeckCardTypes[top]`) not `'villain'` / `'henchman'` → `` `Fight effect: ${ref} revealed ${topRef} from the Villain Deck; it is not a Villain, so it stays on top.` `` `'blocked'`.
  4. Otherwise log `` `Fight effect: ${ref} revealed ${topRef} and takes its place on top of the Villain Deck; ${topRef} is played.` `` `'applied'`, remove the fought card from the Victory Pile (`moveCardFromZone`), set `G.villainDeck.deck = [top, foughtCardId, ...rest]`, then `performVillainReveal(G, context, implementationMap)`.

**Fight site (`moves/fightVillain.ts` `defeatCityVillainCore`):** after the Endless Armies block, when `findVillainHookDescriptor(G, cardId, 'onFight', 'reveal-villain-deck-top-swap-self')` is non-null, build a `RevealContext` exactly as that block builds it (in its own scope: the existing one lives inside `if (fightPlayCount > 0)`, and the Endless Armies block is not hoisted or edited). Then call `swapFoughtVillainWithVillainDeckTop(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, cardId, currentPlayer)`. If WP-840 landed first, this block sits after Endless Armies in `defeatVillainCardCore`.

**Narrative (`events/notableEvents.compose.ts`):** `composeAmbushNarrative(cardName, effectResults, villainDeckPlayCount = 0, fireSiteClauses: readonly string[] = [])` appends the clauses after the play clause. With no clauses the output is byte-identical.

**State (`types.ts`):** `export interface PendingEffectDiscardAnyHandCard { effectLabel: 'Ambush'; }`. The JSDoc reads: an owed every-player discard of any one hand card; `effectLabel` is the literal `'Ambush'`, the only record site; widen it, and carry the label into the choice the WP-837 way, when a second record site lands. `PendingEscapeEffectDiscard.anyHandCard?: PendingEffectDiscardAnyHandCard`; an any-card entry carries `eligibleCosts: []`. No new `LegendaryGameState` field. The `PendingEscapeEffectDiscard.escapedCardId` JSDoc widens to "the Villain whose Escape or Ambush effect owes the discard" (WP-837's wording, whichever lands first): Speed Demon's entry carries a Villain that did not escape.

**Any-card owed discard (`villainDeck/villainEscapeProcedure.ts`):**
- `export const VILLAIN_EFFECT_ANY_CARD_DISCARD_KIND = 'villain-effect-any-card-discard';`
- `export function enqueueAnyCardEffectDiscard(G, sourceCardId, effectLabel: 'Ambush'): void` pushes `{ escapedCardId: sourceCardId, eligibleCosts: [], anyHandCard: { effectLabel } }` onto `G.pendingEscapeEffectDiscards`, creating it lazily. It goes at the back: FIFO, never the front.
- `openEscapeEffectDiscardIfNeeded` keeps its loop, early returns and ride rule. After the shift, an entry with `anyHandCard !== undefined` is built by `buildVillainEffectAnyCardDiscardChoice(G, entry)`; every other entry routes exactly as on `main` (WP-817's cost builder, plus WP-837's trait builder if it landed first).
- `buildVillainEffectAnyCardDiscardChoice(G, entry)`: seats ascending (stays sorted under D-24780 §13: the builder of a simultaneous prompt, D-24780 §6 / D-24501, as WP-817's cost builder; a `// why:` says so); a seat with an empty hand → `` `${effectLabel} effect: Player ${seat} has no card to discard.` `` `'blocked'`; otherwise one option per hand card in hand order, labelled `resolveCardName(G.cardDisplayData, cardId)` with `cardId`. No seat → undefined. `defaultOptionIndex: 0`. The kind is `VILLAIN_EFFECT_ANY_CARD_DISCARD_KIND`.
- `applyVillainEffectAnyCardDiscard(G, choice)`: ascending seats (a simultaneous seat-choice apply, D-24780 §6 / D-24501, as `applyEscapeEffectCostDiscard`; a `// why:` says so), `discardFromHand`, on success `` `Player ${seat} discarded ${formatCardRef(G.cardDisplayData, cardId)} (Ambush effect).` `` `'applied'`. The label is the literal `Ambush`, the only record site in this packet; a later record site with another label carries it in the choice the WP-837 way.
- Wiring:
  - the dispatch arm in `seatChoice.resolve.ts` beside the WP-817 arm;
  - `ai.seatChoice.ts` adds the kind to the `indexOfLeastValuableCard` branch.
  The drop set and the busy guard already cover the queue (Assumes 9).
- Client heading (`PendingSeatChoicePrompt.vue`): `case 'villain-effect-any-card-discard': return 'A Villain\'s effect — choose a card to discard';`.

---

## Scope (In)

- **A)** `rules/villainAbility.types.ts` + test: four primitives, three descriptor fields, count pins 31 → 35.
- **B)** `setup/villainAbility.setup.ts` + test: three parser arms (the swap-self primitive uses the no-param tail); the grammar doc list.
- **C)** `board/citySpaceNames.ts` + test (`describeCityIndex`); `board/city.logic.ts` + test (`chargeCityCardOneSpace`).
- **D)** `villain/villainEffects.execute.ts` + test: the Goblin handler, three no-op handlers, `findVillainHookDescriptor`, the map entries.
- **E)** `villainDeck/villainDeck.reveal.ts` + test: the `resolveVillainCityEntry` extraction, the charge, the Victory-Pile entry, the Boomerang swap, the Ambush fire-site calls and clauses.
- **F)** `moves/fightVillain.ts` + test: the Boomerang fire site.
- **G)** `events/notableEvents.compose.ts` + test: the optional clause list.
- **H)** `types.ts`; `villainDeck/villainEscapeProcedure.ts` + test; `moves/seatChoice.resolve.ts`; `simulation/ai.seatChoice.ts` + test: the owed any-card discard on WP-817's FIFO.
- **I)** Client: `PendingSeatChoicePrompt.vue` + test (one heading).
- **J)** Card data: marker map + script, `co2e.json` regenerated (4 lines, 6 markers), `mechanic-provenance.json`, regenerated villain ledger + effect index. The ewiki `wiki/card-effect-system.md` gets the City-movement paragraph and WP list line, and its stale primitive count and list (L177 says "nineteen entries") are corrected to the real total at execution.

## Out of Scope

- **Ymir's Fight line** ("You may KO a grey Hero…", WP-836) and **Frost Giant Warrior's Ambush** (WP-837). The Warrior's Ambush fires when it enters, with whatever hooks it has.
- **The other Charge cards** (six `[keyword:Charge] N spaces` Ambush lines in other sets) and **Bulldozer** ("moves an extra space forward … Demolish each player"). `charge-forward` and its consequence slot are their append point.
- **The "Choose a Henchman from any player's Victory Pile to enter the city" family** (six lines, mostly Fight-timed) and **Immortus** ("put Immortus in its place", a defeat, not a play). They need a type selector, a Fight-timed entry site and another swap variant.
- **An interactive Ymir pick** (F1) and **deferring Boomerang's reveal** behind its KO (F4).
- **Variable-Attack passives** of these groups: Hydro-Man's +2 in the Sewers / Bridge stays a follow-up; Venom's +1 per captured Hero is WP-838's (`attackPerCaptured`).
- **Galactus-style destroyed named spaces** (WP-831 out of scope); Goblin reads only "does index 4 exist".
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts` — modified
- `setup/villainAbility.setup.ts`, `setup/villainAbility.setup.test.ts` — modified
- `board/citySpaceNames.ts`, `board/citySpaceNames.test.ts` — modified
- `board/city.logic.ts`, `board/city.logic.test.ts` — modified
- `villain/villainEffects.execute.ts`, `villain/villainEffects.execute.test.ts` — modified
- `villainDeck/villainDeck.reveal.ts`, `villainDeck/villainDeck.reveal.test.ts` — modified
- `moves/fightVillain.ts`, `moves/fightVillain.test.ts` — modified
- `events/notableEvents.compose.ts`, `events/notableEvents.compose.test.ts` — modified
- `types.ts` — modified (one interface, one optional field on `PendingEscapeEffectDiscard`)
- `villainDeck/villainEscapeProcedure.ts`, `villainDeck/villainEscapeProcedure.test.ts` — modified
- `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts` — modified (one arm each)
- `simulation/ai.seatChoice.test.ts` — modified

**Client (`apps/arena-client/src/`)**
- `components/play/PendingSeatChoicePrompt.vue`, `components/play/PendingSeatChoicePrompt.test.ts` — modified

**Scripts and data**
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json` — modified
- `scripts/coverage/mechanic-provenance.json` — modified
- `data/cards/co2e.json` — regenerated (4 lines gain markers)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`, `data/metadata/effect-implementation-index.json` — regenerated

**ewiki:** `wiki/card-effect-system.md` — modified (City-movement paragraph, WP list line, and the primitive count + list corrected to the real total).

**Governance:** `docs/ai/DECISIONS.md` (D-24772), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-839-co2e-city-movement-effects.md` — new. The 01.6 post-mortem is mandatory (`01.6-post-mortem-checklist.md` L42-51): this packet adds new primitives and a seat-choice kind.

That is 22 engine files (12 production, 2 of them one-arm edits, + 10 tests), 2 client files, 3 script/input files, 1 card-data file, 3 generated feeds and 1 ewiki page. It is above the ~10 guideline because four cards touch two fire sites, the executor, the parser and the escape opener (Context, Split vs one WP). Every file named above exists on the baseline.

## Contract

- The Locked Values above:
  - the four primitives, their grammar and the three descriptor fields;
  - `describeCityIndex`, `chargeCityCardOneSpace` / `ChargeStepResult`, `findVillainHookDescriptor`, `resolveVillainCityEntry`, `selectVictoryPileCityEntrant`, `swapFoughtVillainWithVillainDeckTop`;
  - the `composeAmbushNarrative` clause parameter;
  - `PendingEffectDiscardAnyHandCard`, `PendingEscapeEffectDiscard.anyHandCard?`, `enqueueAnyCardEffectDiscard` and the `villain-effect-any-card-discard` kind;
  - the exact log strings and the client heading.
- `executeVillainAbilities`, `resolveVillainEscape`, `performVillainReveal`, `playTopVillainDeckCards`, `enterCityIgnoringAmbush`, `parkSeatChoice`, every existing handler and `descriptorKey` keep their signatures and behavior.
- Fire sites: the charge and the Victory-Pile entry are read only at the Ambush fire site; the Boomerang swap only at the Fight fire site (`defeatCityVillainCore`). At any other timing their handlers are reachable no-ops.

## Test Contract

Minimal-`G` fixtures in each file's existing style (`messages: []`, `villainDeckCardTypes` and `cardKeywords` entries for every City card, `villainAbilityHooks` hand-built or from the parser). Ids:
- `gg` (Green Goblin), `sd` (Speed Demon), `boom` (Boomerang);
- `ymir` = `co2e-villain-enemies-of-asgard-ymir-frost-giant-king-00`. A full instance id is required in T22-T25, because `setAbbr` comes from the `-villain-` infix and a short id makes the pick return null for the wrong reason;
- `fgw-00` / `fgw-01` (`co2e-villain-enemies-of-asgard-frost-giant-warrior-00` / `-01`);
- `v1`..`v5` villains, `h1` a henchman.
Each T-case is at least one `it`, grouped under one `describe('WP-839 …')` per file. T1 edits the five pins in Locked Values (types): a value change from an intended product change, said so in the commit body. Every reveal / fight case also runs `checkNoCardInMultipleZones`.

| # | File | Input | Expected | Must NOT / invariant |
|---|---|---|---|---|
| T1 | types | `VILLAIN_EFFECT_PRIMITIVES` | 35 members, the four locked names last in locked order; parity passes | |
| T2 | types | `descriptorToLegacyKeyword` of each new descriptor (with its fields) | `undefined` each | new fields not in the key |
| T3 | setup | `move-self-to-city-space:bridge`, `…:sewers`, `charge-forward:2`, `charge-forward:2:discard-each`, `reveal-villain-deck-top-swap-self`, `enter-city-from-victory-pile:enemies-of-asgard:frost-giant-warrior` | the locked descriptors | |
| T4 | setup | `move-self-to-city-space`, `…:`, `…:moon`, `…:Bridge`, `…:bridge:x`, `charge-forward`, `…:0`, `…:x`, `…:2:wound`, `…:2:discard-each:x`, `reveal-villain-deck-top-swap-self:1`, `enter-city-from-victory-pile`, `…:a`, `…:a:`, `…::b`, `…:A:b`, `…:a:b:c` | each unresolved | never a silent accept |
| T5 | setup | `buildVillainAbilityHooks` over the four lines copied **verbatim** from the regenerated `co2e.json` | Goblin onAmbush `[captureBystander, move-self-to-city-space bridge]`; Speed Demon onAmbush `[charge-forward 2 discard-each]`; Boomerang onFight `[ko-hero current, reveal-villain-deck-top-swap-self]`; Ymir onAmbush `[enter-city-from-victory-pile …]`; no `unresolvedMarkers` | |
| T6 | city.logic | `chargeCityCardOneSpace`: `[sd,_,_,_,_]` from 0; `[sd,v1,_,v2,_]` from 0; `[sd,v1,v2,v3,v4]` from 0; `[v1,v2,v3,v4,sd]` from 4; a 6-space `[sd,v1,v2,v3,v4,v5]` from 0; a 3-space `[_,sd,v1]` from 1 | `[_,sd,_,_,_]` 0 pushed; `[_,sd,v1,v2,_]` 1; `[_,sd,v1,v2,v3]` esc `v4` 4; `[v1,v2,v3,v4,_]` charger off; `[_,sd,v1,v2,v3,v4]` esc `v5` 5; `[_,_,sd]` esc `v1` 1 | input not mutated |
| T7 | citySpaceNames | `describeCityIndex(0..5)` | `the Sewers` … `the Bridge`, `space 6` | |
| T8 | executor | Goblin onAmbush on `[gg,_,_,_,_]` | `[_,_,_,_,gg]`; `Ambush effect: Green Goblin moved to the Bridge.` `applied` | |
| T9 | executor | `[gg,_,_,_,v1]`, `v1` holds a Bystander, `gg` holds one | `[v1,_,_,_,gg]`; both Bystander lists unchanged (keyed by id); the swap line | no push, no escape |
| T10 | executor | `[gg,_,_,_,h1]`; 3-space `[gg,_,_]`; 6-space `[gg,_,_,_,_,v5]`; `gg` not in the City; `gg` already at 4 | `h1` swapped (henchmen are Villains); 3-space unchanged + `the Bridge is not part of the City right now…` `blocked`; 6-space `[_,_,_,_,gg,v5]`; the two blocked lines | |
| T11 | executor | the three no-op primitives dispatched | `executeVillainAbilities` returns `[]`; no hollow record; each primitive's trace has `status: 'no-op'`; `G` minus `diagnostics` deep-equal before/after | reachable no-op (allowlisted) |
| T12 | executor | `findVillainHookDescriptor` with hooks / wrong timing / no hooks field | the descriptor / null / null | never throws |
| T13 | reveal | reveal `sd` into `[_,v1,_,_,_]` | `[_,_,sd,v1,_]`; `pendingEscapeEffectDiscards` `[{ escapedCardId: 'sd', eligibleCosts: [], anyHandCard: { effectLabel: 'Ambush' } }]`; the `charges 2 spaces forward` and `pushed other Villains forward` lines; narrative `"Speed Demon" ambushed: charged 2 spaces forward.` | |
| T14 | reveal | reveal `sd` into `[_,_,_,_,_]` | `[_,_,sd,_,_]`; no queue; `pushed no other Villains forward` `blocked` | |
| T15 | reveal | reveal `sd` into a full `[v1,v2,v3,v4,v5]` | entry escapes `v5`; the charge escapes `v4` then `v3`; final `[_,_,sd,v1,v2]`; `escapedPile` order `v5, v4, v3`; three `pendingEscapeProcedures` in that order; one any-card entry; escaped counter +3 | rule order |
| T16 | reveal | reveal `sd` into a 2-space `[_,v1]` | step 1 escapes `v1`; step 2: `charged off the end of the City and escaped`; city `[_,_]`; `escapedPile` `v1, sd`; one discard entry | WP-831 array City |
| T17 | escape | `enqueueAnyCardEffectDiscard(G, 'sd', 'Ambush')` on an empty FIFO; hands `0 [a, b]`, `1 []`, `2 [c]`; opener | one seat choice, kind `villain-effect-any-card-discard`, seats `['0','2']`, every hand card in hand order (a Wound included); `Ambush effect: Player 1 has no card to discard.`; queue field deleted | |
| T18 | escape | T17's choice with `0 → 1`, `2 → 0` via the resolve dispatch | `b`, `c` discarded; two `(Ambush effect)` lines ascending | `discardFromHand` |
| T19 | escape | a bystander-carrying escape (`isHqKoResolved: true`) owed; push the Primus cost entry, then call `enqueueAnyCardEffectDiscard(G, 'sd', 'Ambush')` (the array is not hand-written) | the openings come in order: the Bystander discard, then Primus, then the any-card discard | FIFO + rule order |
| T20 | escape | an open seat choice; and `evaluateEndgame` non-null | nothing opened; the FIFO still length 1 | |
| T21 | bot | `ai.seatChoice` for a `villain-effect-any-card-discard` seat holding a Wound | the Wound's index | |
| T22 | reveal | Ymir revealed; current player 0 victory `[fgw-00, byst-1]`, player 1 `[fgw-01]`; empty City; `fgw-00` has an onAmbush hook (`gainWoundEachPlayer`) | `[fgw-00, ymir, _,_,_]`; player 0 victory `[byst-1]`; player 1 unchanged; the Warrior's Ambush fired; two `ambushResolved` events (Ymir, then the Warrior); entry line `[Ambush] … entered the city from Player 0's Victory Pile!` | |
| T23 | reveal | `selectVictoryPileCityEntrant`, seats `0,1,2`, current `1`, Warriors in seats 0 and 2 | seat 2 | wraps from current |
| T24 | reveal | no Warrior anywhere; a pile with only `core-villain-enemies-of-asgard-frost-giant-00`, `co2e-villain-enemies-of-asgard-destroyer-00` and `co2e-villain-enemies-of-asgard-frost-giant-warrior-x1` | null; the `no matching Villain` `blocked` line; the City holds only Ymir | anchored prefix + `^[0-9]{2}$` suffix |
| T25 | reveal | Ymir revealed into a full City, a Warrior in a Victory Pile | Ymir's entry escapes `v5`; the Warrior's entry escapes `v4`; final `[fgw, ymir, v1, v2, v3]` | |
| T26 | fight | Boomerang at City 0 with a Bystander; deck `[v1, x]` (`v1` villain); fight affordable; the fighter holds exactly one KO-able Hero | Boomerang's Bystander in victory, Boomerang not; deck `[boom, x]`; `v1` in the City (entered, Ambush hooks fired); the KO auto-resolved on that Hero; log order: fought → KO → `revealed … takes its place` → `v1` entry | `villainRevealedThisTurn` unchanged |
| T27 | fight | deck `[twist, x]`; deck `[]`; deck `[h1, x]` | twist: deck unchanged, Boomerang in victory, `not a Villain` `blocked`, no twist resolved; empty: the `reveals nothing` line; henchman: swapped and played | |
| T28 | compose | `composeAmbushNarrative('Speed Demon', [], 0, ['charged 2 spaces forward'])`; the existing cases with no fourth argument | `"Speed Demon" ambushed: charged 2 spaces forward.`; every existing expectation unchanged | |
| T29 | reveal | a non-Ambush villain and an Ambush villain revealed (existing suite) | entry lines byte-identical (`X revealed and entered the city.` / `[Ambush] X revealed and entered the city!`) | the extraction oracle |
| T30 | Prompt | kind `villain-effect-any-card-discard` | heading `A Villain's effect — choose a card to discard` | |

T13 arithmetic: the Sewers is empty, so `sd` enters space 0 with no entry push (`[sd,v1,_,_,_]`). Charge step 1 moves `sd` to 1 and pushes `v1` to 2; step 2 moves `sd` to 2 and pushes `v1` to 3.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** the three groups appear in published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`). Speed Demon's charge causes extra escapes and a discard. Boomerang costs the fighter his VP and replays a Villain. Ymir brings a Warrior back. So those legs get harder. No committed `data/par` artifact references the groups, so nothing is re-pinned; a future PAR run picks up the behavior.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (card fidelity; no paid or persuasive surface).

**Determinism preservation:**
- No randomness: every pick is positional or seat-ordered. No new `G` field: the owed discard rides the lazy `G.pendingEscapeEffectDiscards`, and `anyHandCard` appears only on Speed Demon's entries.
- The reveal path is byte-identical for every card without the new markers (T29); `getLegalMoves` is untouched.
- Narration goes to hash-excluded `G.messages` (D-24081). The `ambushResolved` narrative gains clauses only for Speed Demon and Ymir.
- `finalStateHash` and `PRE_WP080_HASH` are expected unchanged (Assumes 13); if either moves, STOP and explain before any re-pin.
- **Replay-compat:** stored matches replay from their bgio `initialState`, which holds the setup-time hooks, so pre-WP-839 matches (no markers) replay identically. Only a new match sees the markers (auto-memory `reference_setup_hook_change_replay_compat`). Recorded in D-24772.

## Funding Surface Gate

§20 **N/A**: engine, card data and one prompt heading. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Grammar.** T3-T5 pass. The marker script accepts the six Locked-Values tokens. Its rejection side is checked by hand (it runs `main()` on import): put each T4 token into the marker map one at a time, run the script, observe a loud failure, revert. Record the observed failures in the EC-877 commit body.
2. **Types and helpers.** T1-T2, T6-T7 and T12 pass as runtime assertions.
3. **Green Goblin.** T8-T10 pass, including the 3-space and 6-space Cities.
4. **Speed Demon.** T13-T16 pass; T15's escape order and T16's charger escape hold.
5. **Owed discard.** T17-T21 pass; the existing WP-817 escape-effect tests and the drop-set / busy-guard drift tests pass unedited.
6. **Ymir.** T22-T25 pass.
7. **Boomerang.** T26-T27 pass; Boomerang never stays in two zones.
8. **Reveal byte-identity.** T29 and every pre-existing `villainDeck.reveal.test.ts` / `villainDeck.enterCity.test.ts` assertion pass unedited. T11 passes.
9. **Narrative + client.** T28 and T30 pass; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
10. **Data.** `apply-effect-markers.mjs` prints `co2e.json — 6 new marker(s) this run` and re-runs at 0. `git diff data/cards/` touches only `co2e.json`, and only those 4 lines, each gaining its trailing markers.
11. **Gates.** `pnpm -r build` exits 0. `pnpm -r --no-bail test` 0 fail. After the regeneration in Verification Steps, `cards:check`, `effect-index:check`, `ledger:villains:check`, `mechanics:metadata:check`, `sim:runtime-observed:check` and `sim:coverage --check` exit 0; the last three need no regeneration. `check:wiki` and `wiki-viewer:check-links` exit 0.
12. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.
13. **Ledger rows.** In the regenerated `villain-mechanic-ledger.json`, the four cards' new mechanics are `executable` with a handler and WP-839 / D-24772 provenance. Ymir's Fight line belongs to WP-836: it is already `executable` if WP-836 landed first, and unmarked otherwise. No other card's rows change, except those a sibling already marked.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record before / after totals.
3. `node scripts/convert-cards/apply-effect-markers.mjs`; re-run → 0 new markers. `git diff --stat -- data/cards/` → only `co2e.json`.
4. `pnpm -r build` again (the ledger reads the engine dist), then `pnpm ledger:villains && pnpm effect-index`.
5. `pnpm cards:check && pnpm effect-index:check && pnpm ledger:villains:check && pnpm mechanics:metadata:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0. If one of the last three flags, STOP: Assumes 13 is false.
6. `pnpm check:wiki && pnpm wiki-viewer:check-links` → exit 0.
7. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0.
8. After governance close: `pnpm roadmap:counts:check && pnpm ledger:numbers:check && pnpm workindex:rows:check && pnpm workindex:executed:check` → exit 0. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
9. Revert proofs. Make each change one at a time; each must fail at least one T-case:
   - drop the `chargeVillainForward` call (T13);
   - make the Goblin handler push instead of swap (T9);
   - push Speed Demon's entry at the front of the FIFO (T19);
   - leave Boomerang in the Victory Pile (T26);
   - start Ymir's seat order at seat 0 (T23);
   - drop one primitive from `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (T11);
   - restore the hard-coded entry phrase so Ymir's entry line reads "revealed" (T22).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the seven revert proofs were observed.
- [ ] D-24772 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated, including the follow-up line: the Charge-keyword cards, Bulldozer, the "Choose a Henchman … to enter the city" family and Immortus can reuse these primitives. A second line records RS-8: Boomerang's Fight overlay does not name the swap.
- [ ] `docs/ai/post-mortems/01.6-WP-839-co2e-city-movement-effects.md` written per `01.6-post-mortem-checklist.md` (mandatory: new primitives and a seat-choice kind).
- [ ] `pnpm workindex:rows:check && pnpm workindex:executed:check` → exit 0.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-877:` then `SPEC:`.
- [ ] **Hash oracles:** `finalStateHash` / `PRE_WP080_HASH` unchanged; no fixture plays the three groups (Assumes 13).
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). Run new matches on `play.legendary-arena.com` with the deployed gitSha checked, driven via the operator setter pane or `/api/match/autoplay` setupData:
  - `co2e/doctor-octopus` leads `sinister-spider-foes`: Green Goblin captures a Bystander and moves to the Bridge; a Bridge occupant swaps into the Sewers.
  - `villainGroupIds` include `co2e/sinister-syndicate`: Speed Demon charges two spaces; with a Villain ahead of him every player gets the discard prompt. Fighting Boomerang with a Villain on top of the Villain Deck plays that Villain, Boomerang reappears on the next reveal, and the fighter's VP excludes him.
  - `co2e/loki` leads `enemies-of-asgard`: with a Frost Giant Warrior in a Victory Pile, Ymir's reveal returns it to the Sewers.
  - The Ambush overlay names Speed Demon's charge and Ymir's Warrior.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24772 — co2e-city-movement-effects.** It locks:
- the authorized contract change to `rules/villainAbility.types.ts`: primitives `move-self-to-city-space`, `charge-forward`, `reveal-villain-deck-top-swap-self`, `enter-city-from-victory-pile` (appended in that order), plus the descriptor fields `destinationCitySpace`, `chargePushConsequence`, `victoryVillainCard`, all outside `descriptorKey`;
- placement: Goblin's move runs in the executor; the charge and the Victory-Pile entry run at the Ambush fire site, and Boomerang's swap at the Fight fire site (`defeatCityVillainCore`), behind reachable no-op handlers (the D-24287 / D-24351 pattern);
- Green Goblin: swap-if-occupied, never a push (D-24664). The Bridge is engine index 4 (D-24764). With no Bridge he stays (rules v23 L1478-1484). Any City occupant counts as a Villain (D-24603 / D-24607);
- Speed Demon is a Charge of 2 (rules v23 L1117-1122). One step at a time, each step pushes the block ahead and can cause an escape that resolves in that step. A charger on the last space escapes. Only the charge's own pushes count for "if this pushes"; the entry push does not. The discard is an owed every-player seat choice: an `anyHandCard` entry at the back of WP-817's FIFO (`G.pendingEscapeEffectDiscards`), kind `villain-effect-any-card-discard`, opened after the escape procedures. It resolves after the move, extending D-24750's after-the-move class to an Ambush effect (WP-837's `traitFilter` entries share the same FIFO);
- Boomerang: a Villain or henchman on top → Boomerang leaves the fighter's Victory Pile for the deck top, and that Villain is played through `performVillainReveal`. Any other card stays on top, revealed. An empty deck does nothing. The reveal may precede an interactive KO's resolution (D-24351 posture);
- Ymir: a deterministic pick (the current player's Victory Pile first, then seats in ascending order wrapping; the first match in pile order, by anchored instance-id prefix). The Warrior enters through the extracted `resolveVillainCityEntry` with push, escape and Ambush (rules v23 L1458-1463, L1824-1830, L2831-2837);
- the `resolveVillainCityEntry` extraction keeps the reveal path byte-identical;
- the `composeAmbushNarrative` fire-site clauses (extends D-24703);
- primitives here touch only `G.city`; The Blob's off-City slot (WP-840) is never moved;
- the no-UX-freeze reuse of `G.pendingSeatChoice` (no new move, queue, guard or UIState field), and the `'Ambush'` literal label;
- the replay-compat note; the operator forks F1-F4 and their defaults.

---

## Gate Record

- **01.4 pre-flight (independent):** READY — BLOCKED ON WP-831 after PS-1..7 applied (2026-10-25). Report: `docs/ai/invocations/preflight-wp839-co2e-city-movement-effects.md` (scratchpad). PS-1..PS-7 are scope-neutral, so there is no re-run:
  - PS-1: the no-op trace allowlist;
  - PS-2: T11 contract;
  - PS-3: full `ymir` id;
  - PS-4: T19 uses `enqueueAnyCardEffectDiscard`, and the five pins;
  - PS-5: WP-840 `defeatVillainCardCore`;
  - PS-6: WP-829 merged, and the rebase rule;
  - PS-7: Goblin log order, `break`, the JSDoc widenings, the scoped `RevealContext`, T26 single KO, counts and line numbers.
- **01.7 copilot (independent):** RISK → fixes 1-5 applied (2026-10-25). Report: `docs/ai/invocations/copilot-wp839-co2e-city-movement-effects.md` (scratchpad). The fixes:
  1. #4: the EC test-edit guardrail names the five pins as the only intended existing-test edits;
  2. #9: the no-UX-freeze bullet in Context and the EC Guardrails;
  3. #21: `effectLabel` typed as the literal `'Ambush'`;
  4. #22: Ymir's `found === false` blocked log + return;
  5. #30: the session prompt's five-pin wording, and the 7 revert proofs in §13.
  Also in scope: the ewiki primitive count + list correction, and the mandatory 01.6 post-mortem plus the `workindex:*` close gates. The pre-flight verdict stands.
- **00.3 lint (independent):** PASS (2026-10-25).

**Recorded residuals (accepted):**
- **RS-8:** Boomerang's `fightResolved` narrative does not name the swap (the D-24703 class on the Fight side). The played Villain gets its own `ambushResolved` when it has Ambush. One STATUS line at close.
- **RS-10:** the three groups are in ranked gauntlet rows. New matches get harder (Boomerang's VP loss, Speed Demon's escapes and discard); stored matches replay unchanged. WP-834 (#3011) would deprioritize Core 2E groups in ranked fill. Release timing is Jeff's call; no packet change.
- **RS-9 (minor):** `describeCityIndex(5)` reads `space 6`, while WP-831's attack-target label reads "an unnamed City space". Only tests reach index 5 here, so the wording is accepted as is.

## Lint Gate Self-Review (00.3)

Drafter's self-review; the independent 00.3 run supersedes it.

| § | Result |
|---|---|
| §1 | PASS — all required sections present; Out of Scope has 7 items |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS — 15 Assumes with file / line anchors at `677c4109`, the WP-831 hard dependency first, the BLOCKED rule |
| §4 | PASS — rules v23 lines, 00.2 §1.4 / §5, ARCHITECTURE sections, DECISIONS scan list, memory |
| §5 | PASS — 32 files (22 engine, 2 client, 3 script/input, 1 card data, 3 feeds, 1 ewiki), each marked modified or regenerated; the count is justified |
| §6 | PASS — card / group slugs and instance ids match `co2e.json`; `CitySpaceName`, `CardExtId`, `victoryVillainGroup` reuse canonical names |
| §7 | PASS — no new package dependency; WP-831 hard, WP-835 / 837 / 840 soft, each stated |
| §8 | PASS — engine decides; the client only gains a heading; `G` stays JSON; no I/O or randomness; no layer crossing |
| §9 | PASS — pnpm / node commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — node:test, minimal-`G` fixtures, the zone invariant on every move case; hash oracles stand in for the golden test |
| §13 | PASS — exact commands with exit-0 / literal-output expectations, diff-scope step, 7 revert proofs |
| §14 | PASS — 13 binary criteria tied to T1-T30 |
| §15 / §15.1 | PASS — STATUS (+ the reuse follow-up), DECISIONS, indexes in DoD; D-24026 live-verify on `play.legendary-arena.com` per card |
| §16 | PASS — 00.6 mandated; one shared descriptor finder replaces a fifth hand-copied detector (third-copy rule) |
| §17 | PASS — §1 / §8 / §22-24 / NG-1 cited; conflict line; determinism + replay-compat |
| §18 | N/A — no forbidden-token grep step |
| §19 | N/A at draft — applies to the STATUS entry at close |
| §20 | PASS — N/A with reason (no funding surface) |
| §21 | PASS — N/A with reason; no `apps/server/src` surface |
