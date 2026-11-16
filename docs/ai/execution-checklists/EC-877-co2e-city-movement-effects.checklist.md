# EC-877 — co2e City movement: Green Goblin, Speed Demon, Boomerang, Ymir (Execution Checklist)

**Source:** docs/ai/work-packets/WP-839-co2e-city-movement-effects.md
**Risk Tier:** MEDIUM
**Layer:** Game Engine (+ card-data markers, derived feeds, the local-spike bundle, one arena-client heading)
**Reconciled 2026-11-15** on `4c228213b` (after WP-874 #3405): Speed Demon reuses WP-874's `charge` (D-24820 RS-6); the narrative follows D-24854; bridged no-ops trace per D-24824.

## Before Starting
- [ ] WP-874 is on `main` (WORK_INDEX `[x]`): `VILLAIN_CHARGE_PUSH_CONSEQUENCES`, `board/villainCharge.logic.ts`, `chargeAmbushVillain` before the executor, the exhaustive consequence `switch`es in `resolveChargePushConsequence` and `composeChargeClause`. If not, STOP (BLOCKED).
- [ ] Record `VILLAIN_EFFECT_PRIMITIVES.length` (60 at re-gate) and its last member (`'charge'`). Append after it, and after any primitive WP-840 landed first.
- [ ] Siblings: WP-835..838 are merged, so merge this packet's keys into their objects and never replace a key (`ymir-frost-giant-king.fight` stays). WP-840: The Blob is not in `G.city` (else STOP); its primitives come first if it landed.
- [ ] The reveal villain branch is still push → entry log → escape → Ambush block (flag, charge bridge, executor, … stack-entry bridge). `defeatCityVillainCore` still ends with `runVillainFightFireSiteBridges`. The escape opener still tail-calls `openEscapeEffectDiscardIfNeeded`, with WP-837's `traitFilter` branch.
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; record the engine and arena-client test totals.

## Locked Values (do not re-derive; every log string is copied verbatim from WP §Locked Values)
- **Primitives**, appended in this order: `move-self-to-city-space`, `reveal-villain-deck-top-swap-self`, `enter-city-from-victory-pile` (61-63).
  - New charge consequence: `'discard-if-pushed'`, appended to `VillainChargePushConsequence`, `VILLAIN_CHARGE_PUSH_CONSEQUENCES` and the script copy. There is no new Charge primitive, step helper or bridge.
  - New descriptor fields, none in `descriptorKey`: `destinationCitySpace?` and `victoryVillainCard?`. `victoryVillainGroup` is reused with its JSDoc widened.
  - Sanctioned pin edits:
    - in `villainAbility.types.test.ts`: the ordered list (append three), the title / length / message 60 → 63, the last member → `'enter-city-from-victory-pile'` (position 63), the eight `length, 60` lines → 63, the parity `Record` +3, WP-874's `slice(57)` → `slice(57, 60)`, and WP-874's consequence pin `Record` + deep-equal → `['demolish-if-pushed', 'discard-if-pushed']`;
    - in `villainAbility.setup.test.ts`: WP-874's `reject-charge-discard` flips to positive (slug → `charge-discard`, token kept, `// why:` → WP-839, plus a positive `deepStrictEqual` in the Locked-Values `it`; the row is never deleted);
    - in `ambushNarrative.keywordless.test.ts`: the RS-5 set 18 → 20 (+`enter-city-from-victory-pile`, +`move-self-to-city-space`), and `FIXTURE_GROUP_IDS` + `co2e/sinister-syndicate`.
- **Grammar** (parser and script identical):
  - `move-self-to-city-space:<CITY_SPACE_NAMES member>`;
  - `charge:<N>:discard-if-pushed` (WP-874's parser, unchanged);
  - `reveal-villain-deck-top-swap-self` (no params);
  - `enter-city-from-victory-pile:<group>:<card>` (slugs `^[a-z0-9]+(-[a-z0-9]+)*$`);
  - anything else → null. The bare 1-part forms of the two parameterized primitives also → null.
- **Markers**:
  - Goblin ambush `["captureBystander", "move-self-to-city-space:bridge"]`;
  - Speed Demon ambush `["charge:2:discard-if-pushed"]`;
  - Boomerang fight `["koHeroCurrentPlayer", "reveal-villain-deck-top-swap-self"]`;
  - Ymir ambush `["enter-city-from-victory-pile:enemies-of-asgard:frost-giant-warrior"]`;
  - provenance for the three new primitives → WP-839 / D-24772 (`charge` stays WP-874 / D-24820);
  - four `live-verify.json` pending rows.
- **City names**: `describeCitySpace(i)` moves verbatim from `villainDeck.reveal.ts` to `board/citySpaceNames.ts` (exported): `the Sewers` … `the Bridge`, else `` `city space ${i}` ``. The reveal imports it.
- **Executor**:
  - `findVillainHookDescriptor(G, cardId, timing, primitive)` returns the first match, or null; a gated descriptor → null.
  - The two bridged primitives get no-op handlers, are added to `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`, and are appended to `recordVillainSecondarySiteTrace`'s unions (`enterCityFromVictoryPile`, `swapFoughtVillainWithVillainDeckTop`). `move-self-to-city-space` is not allowlisted.
  - The Goblin handler: index 4 = Bridge; it swaps, never pushes. Its blocked cases, in order: no destination, not in the City, `index >= G.city.length`, already there. Each case returns `narrativeClause` equal to its logged clause.
- **Charge consequence**: `resolveChargePushConsequence` `case 'discard-if-pushed'`: not pushed → `pushed no Villains forward, so no one discards.` `'blocked'`, null; pushed → `enqueueAnyCardEffectDiscard(G, cardId, 'Ambush')` then `pushed Villains forward, so each player must discard a card.` `'threat'`. `composeChargeClause` `case 'discard-if-pushed'` → `', then each player must discard a card'`.
- **Reveal**:
  - Extract `resolveVillainCityEntry(G, context, implementationMap, cardId, entryPhrase)` (push through the end of the Ambush block, verbatim except the entry line); the reveal passes `'revealed and entered the city'`.
  - Before the event, compute Ymir's `entrant` and the clause `` `brought ${entrantName} back into the city` ``. It is `composeAmbushNarrative`'s 7th argument, `victoryPileEntryClause`, after `chargeClause`.
  - After the stack-entry bridge, record the secondary-site trace, then call `enterCityFromVictoryPile(…, entrant)`.
- **Ymir**: `selectVictoryPileCityEntrant` derives `setAbbr` from the `-villain-` infix, matches the anchored prefix `${setAbbr}-villain-${group}-${card}-` plus `^[0-9]{2}$`, walks `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)`, and takes the first match in pile order. It removes the Warrior via `moveCardFromZone(victory, [], id)`; if `found` is false it logs the `is no longer in Player ${seat}'s Victory Pile` line (`'blocked'`) and returns. Otherwise the Warrior enters through `resolveVillainCityEntry`.
- **Names**: `ref` / `topRef` / `sourceRef` / `entrantRef` = `formatCardRef`; `entrantName` = `resolveCardDisplayName(G, entrant.cardId)`. The Warrior enters but is not revealed (no `onCardRevealed`).
- **Boomerang**: the last step of `runVillainFightFireSiteBridges` (so a Nightbringer Villain Deck defeat swaps too, D-24817). It builds its own-scope `RevealContext` like the sibling bridges, records the trace, then calls `swapFoughtVillainWithVillainDeckTop`.
  - Checks, in order: not in the fighter's Victory Pile; empty deck; top not `villain` / `henchman`.
  - Otherwise: remove him from the Victory Pile, set `deck = [top, foughtCardId, ...rest]`, then `performVillainReveal`.
- **Owed discard** (no new `G` field):
  - `PendingEffectDiscardAnyHandCard { effectLabel: 'Ambush' }` (a literal; `enqueueAnyCardEffectDiscard(G, sourceCardId, effectLabel: 'Ambush')` too) on `PendingEscapeEffectDiscard.anyHandCard?`, with `eligibleCosts: []`;
  - kind `villain-effect-any-card-discard`;
  - entries are pushed at the BACK of `G.pendingEscapeEffectDiscards`;
  - `openEscapeEffectDiscardIfNeeded` routes `anyHandCard` entries (checked before `traitFilter`) to `buildVillainEffectAnyCardDiscardChoice` (every hand card, hand order, default 0); apply is `applyVillainEffectAnyCardDiscard` through `discardFromHand`, seats ascending;
  - also: the dispatch arm, the bot least-valuable branch, and the heading `A Villain's effect — choose a card to discard`.

## Guardrails
- One Charge implementation (D-24820): `grep -rn "charge-forward\|chargeCityCardOneSpace" packages/` stays empty.
- The reveal path stays byte-identical for unmarked cards and for Bulldozer. No existing reveal / enterCity / charge / WP-817 / WP-837 assertion is edited, and neither are the drop-set / busy-guard drift tests. The only existing-test edits are the sanctioned pins listed above, with their `it` titles and messages.
- No-UX-freeze: the any-card discard reuses `G.pendingSeatChoice` with its existing projection, prompt, `resolveSeatChoice` move and kind-dispatched timeout default. No new move, `pending*` queue, block-all guard, UIState field or `UiMoveName`.
- `G.city` only, and every loop reads `G.city.length`.
- Use the helpers: `resolveVillainEscape`, `resolveVillainCityEntry`, `performVillainReveal`, `discardFromHand`, `moveCardFromZone`.
- The hash oracles stay unchanged (STOP if one moves). No English parsing; never run `convert-cards-v15.mjs`. Frozen: `VillainEffectKeyword`, the reverse-map, `EFFECT_KEYWORD_LABELS`.

## Required `// why:` Comments
- The no-op handlers and their allowlist and trace-union entries: the work fires at the Ambush / Fight bridge (D-24772, D-24351, D-24824 §7).
- The Goblin swap: D-24664 swap; no Bridge → no move (rules L1478-1484); henchmen are Villains (D-24607); the narrative clause is the logged clause (D-24854 §6).
- The `'discard-if-pushed'` cases: D-24820's extension rule; the discard is owed after the move (D-24750 / D-24770 class); the back-of-FIFO enqueue.
- `resolveVillainCityEntry`: a mechanical extraction, kept whole as a byte-identity exception to the 00.6 function-length rule recorded in D-24772; re-entry follows normal entry (L1458-1463, L1824-1830, L2831-2837).
- `describeCitySpace`: moved verbatim for its second caller.
- `selectVictoryPileCityEntrant`: the deterministic stand-in for "Choose" (F1); anchored prefix (D-24299 Path B); seats from `seatsInTurnOrderFrom` (D-24780).
- `buildVillainEffectAnyCardDiscardChoice` / `applyVillainEffectAnyCardDiscard` seat loops: ascending under D-24780 §6 / D-24501.
- The Boomerang deck write; the `victoryPileEntryClause` trailing parameter (D-24854).

## Files to Produce
- Engine, each with its test, **modified**: `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `board/citySpaceNames.ts`, `villain/villainEffects.execute.ts`, `villainDeck/villainDeck.reveal.ts` (+ `villainCharge.reveal.test.ts`), `moves/fightVillain.ts`, `events/notableEvents.compose.ts`, `villainDeck/villainEscapeProcedure.ts`, `simulation/ai.seatChoice.ts`.
- Engine, **modified**: `types.ts`, `moves/seatChoice.resolve.ts`, `villain/ambushNarrative.keywordless.test.ts`.
- Client, **modified**: `components/play/PendingSeatChoicePrompt.vue` + test; **regenerated**: `fixtures/localSpike/featuredSetupBundle.json`.
- Scripts, **modified**: `apply-effect-markers.mjs`, `inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json`.
- **Regenerated**: `data/cards/co2e.json`, `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`; **modified**: `docs/ai/coverage/live-verify.json`.
- ewiki: `wiki/card-effect-system.md`.
- Governance close: `DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `NUMBER-LEDGER.md` if it tracks D-24772, and `docs/ai/post-mortems/01.6-WP-839-co2e-city-movement-effects.md` (**new**).

## After Completing
- [ ] T1-T31 pass. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; the arena-client `typecheck` → 0.
- [ ] `co2e.json — 6 new marker(s) this run`, then a re-run gives 0; 4 lines changed. The T4 rejections are hand-checked and recorded in the commit body.
- [ ] Rebuild, then `pnpm ledger:villains && pnpm effect-index && pnpm spike:local-bundle` (`initialStateHash` unchanged). The new rows are `executable`. The seven feed checks (incl. `cards:count-markers:check`) and `wiki-viewer:check-links` → 0; `check:wiki` (probes the deployed ewiki) runs post-merge.
- [ ] Seven revert proofs: the `'discard-if-pushed'` enqueue; push instead of swap; FIFO front-push; Boomerang left in victory; Ymir from seat 0; the hard-coded entry phrase; one primitive dropped from the no-op allowlist (T11).
- [ ] Hash oracles unchanged; allowlist-only diff; commits `EC-877:` then `SPEC:`.
- [ ] D-24772 Active. STATUS gets the reuse follow-up and RS-8. WORK_INDEX `[x]` with `[live-verify: pending]`, EC_INDEX Done, mindmap `✅` + `pnpm roadmap:counts:write`; the 01.6 post-mortem is written; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` → 0.
- [ ] Live-verify (D-24026) post-deploy, one check per card (WP DoD), and `pnpm check:wiki` → 0 once the ewiki deploy for the merge commit lands.

## Common Failure Smells
- The Warrior is in the City and still in a pile → the `moveCardFromZone` result was not assigned back.
- Boomerang still scores → the Victory Pile removal was skipped.
- Speed Demon's prompt lists only 2/3/5/7 cards → the `anyHandCard` entry fell through to the cost builder.
- The traces show `fired` for the two bridged no-ops, or no `secondary-site` record → the allowlist or the trace call was missed.
- Ymir picks nothing in tests → a short `ymir` fixture id (no `-villain-` infix).
- `tsc` fails in `resolveChargePushConsequence` / `composeChargeClause` → a `'discard-if-pushed'` case is missing (the exhaustive `never`).
