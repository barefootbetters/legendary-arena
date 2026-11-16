# WP-839 — co2e City movement: Green Goblin to the Bridge, Speed Demon charges, Boomerang takes a revealed Villain's place, Ymir returns a Frost Giant Warrior (Game Engine + card data)

**Status:** Draft 2026-10-25; **reconciled and re-gated 2026-11-15** on `main` `4c228213b` (after WP-874 #3405, WP-897, WP-898). EC-877; **D-24772** reserved (#3010). See §Gate Record.
**Reconciliation (2026-11-15):** WP-874 RS-6 / D-24820 made `charge` the engine's one Charge primitive. Speed Demon reuses it as `charge:2:discard-if-pushed`. The draft's `charge-forward`, `chargeCityCardOneSpace` / `ChargeStepResult`, post-event `chargeVillainForward` and `chargePushConsequence: 'discard-each'` are deleted. The Ambush narrative follows D-24854: the executor-run Goblin move sets `narrativeClause`, and Ymir's bridged entry clause is a new trailing parameter after WP-874's `chargeClause`. The two remaining bridged no-ops record a D-24824 `secondary-site` trace. Boomerang's bridge goes in WP-872's `runVillainFightFireSiteBridges` (D-24817). The draft's `describeCityIndex` is replaced by WP-874's `describeCitySpace`, which moves to `board/citySpaceNames.ts` unchanged. This retires RS-9. The primitives are re-baselined to positions 61-63.
**Risk Tier:** MEDIUM
**Primary Layer:** Game Engine (`villain/` executor, `villainDeck/` reveal + escape opener, `moves/fightVillain.ts` Fight bridges, `board/` City names, `events/` narrative), plus card-data markers, the derived coverage feeds, the local-spike bundle and one arena-client heading.
**Dependencies:** **WP-874 (hard, merged #3405 `4c228213b`)**, which provides `charge`, `chargeAmbushVillain`, `ChargeOutcome`, `composeChargeClause` and the exhaustive consequence switches. **WP-831 (hard, merged #3001)**: `CityZone` is an array of 1-6 spaces; names stay on engine indices (D-24764). **WP-897 (merged)**: the D-24854 narrative channel. **WP-877 (merged)**: the D-24824 secondary-site trace. **WP-837 (merged)**: the `traitFilter` branch on WP-817's owed-discard FIFO. **WP-872 (merged)**: `runVillainFightFireSiteBridges`. Builds on WP-523 / D-24336 + D-24607 (City swap; henchmen are Villains), WP-795 / D-24664 (swap-if-occupied), WP-542 / D-24351 (the secondary-fire-site pattern), WP-757 / D-24587 (`resolveVillainEscape`), WP-793 / D-24656 + WP-817 / D-24750 (the post-move escape opener and its every-player discard), WP-684 / D-24501, WP-846 / D-24780 (seat order), D-24703. Soft: WP-840 (The Blob, held outside `G.city`; it appends to the same lockstep files, so the two run one after another).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). Changes a contract file (`rules/villainAbility.types.ts`: three primitives, one charge consequence, two descriptor fields), adds one optional field to WP-817's owed-discard entry and a seat-choice kind, extracts the reveal path's City-entry block into a shared helper, and widens one narrative composer by a trailing parameter.
**Arc:** co2e villain fidelity (WP-835..840), packet 5 of 6 (inventory rows #14, #27, #35, #37).

> Baseline: `origin/main` at `4c228213b` (EC-912, WP-874). Line anchors below are at that SHA; re-read every anchor, the primitive count (60) and the test totals at execution. If WP-840 lands first, rebase onto its appended primitives and its `defeatVillainCardCore` split (Assumes 14).

---

## Goal

As a player facing the Sinister Spider-Foes, the Sinister Syndicate and the Enemies of Asgard from Core 2E, I want four villains that move cards around the City to do what they print, so these groups play like the tabletop game instead of entering the City and doing nothing.

| Card (`co2e`, 2 copies each) | Printed line (verbatim, `data/cards/co2e.json`) | Today | After this session |
|---|---|---|---|
| Green Goblin (`sinister-spider-foes`) | `Ambush: Green Goblin captures a Bystander. Put him on the Bridge. If there's another Villain there, swap them.` | No marker: nothing happens (D-24266 `unmarked-ability` breadcrumb). | He captures a Bystander and moves to the Bridge; a Villain already there swaps into his old space. No Bridge in a smaller City: he stays put. |
| Speed Demon (`sinister-syndicate`) | `Ambush: Speed Demon moves two extra spaces forward. If this pushes any other Villains forward, each player discards a card.` | No marker. | He charges two spaces forward (WP-874's `charge`), pushing Villains ahead of him; they can escape. If he pushed anyone, every player discards a card of their choice. |
| Boomerang (`sinister-syndicate`) | `Fight: KO one of your Heroes. Then reveal the top card of the Villain Deck. If it's a Villain, put Boomerang in its place and play that Villain.` | No marker. The fighter keeps Boomerang's 2 VP and nothing else happens. | The fighter KOs a Hero, then the Villain Deck's top card is revealed. If it is a Villain, it is played and Boomerang goes on top of the Villain Deck in its place (out of the fighter's Victory Pile). Anything else stays on top. |
| Ymir, Frost Giant King (`enemies-of-asgard`) | `Ambush: Choose a Frost Giant Warrior from any player's Victory Pile to enter the city.` | No Ambush marker (his Fight line is WP-836's). | A Frost Giant Warrior leaves a Victory Pile and enters the City like a newly played Villain: it pushes, can cause an escape, and does its own Ambush (WP-837's trait discard). |

## User-Visible Impact

- **Green Goblin.** His reveal logs `Ambush effect: Green Goblin moved to the Bridge.` (or the swap line), then the `Ambush effect:` capture line: the move logs inside the executor, and the legacy capture result is logged after it. The board shows him on the Bridge holding the Bystander. The overlay reads `"Green Goblin" ambushed: <capture clause>; Green Goblin moved to the Bridge.`
- **Speed Demon.** His reveal logs WP-874's per-step lines (`Ambush effect: Speed Demon charged forward one space to the Bank, pushing the Villains ahead of it forward.`). Villains pushed off the last space escape as usual. If he pushed anyone, `Ambush effect: Speed Demon pushed Villains forward, so each player must discard a card.` follows, and every player who holds a card then gets an "A Villain's effect — choose a card to discard" prompt (the WP-793 / WP-817 seat-choice prompt). A bot-ally seat discards its least valuable card; autoplay, sim and PAR take the first card in hand order. The overlay names the charge and the owed discard.
- **Boomerang.** Fighting him logs the KO, then the revealed card. A Villain enters the City as if just played (Ambush included), and Boomerang is back on top of the Villain Deck, so the next reveal brings him back. The fighter does not keep his 2 VP.
- **Ymir.** His reveal brings a Frost Giant Warrior back into the Sewers, pushing Ymir forward. The Warrior's own Ambush (WP-837) resolves. The overlay names the returned Warrior instead of saying "entered the city with no Ambush effect" (D-24703 class).

---

## Assumes

1. **WP-874 is merged** (#3405, `4c228213b`). On `main`:
   - `rules/villainAbility.types.ts` has `VillainChargePushConsequence = 'demolish-if-pushed'` (L689) and `VILLAIN_CHARGE_PUSH_CONSEQUENCES` (L698).
   - `VillainEffectDescriptor.chargePushConsequence?` exists (L965).
   - `board/villainCharge.logic.ts` exports `chargeCityVillainOneSpace`, `ChargeStepResult` and `ChargeOutcome` (whose `triggeredPushConsequence` JSDoc already allows "owed after the move").
   - `villain/villainEffects.execute.ts` has `villainCardChargeEffect` (L2389), which returns `{ spaces, pushConsequence }` and fails a gated descriptor closed, and lists `'charge'` in `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (L1020).
   - In `villainDeck/villainDeck.reveal.ts`, `performVillainReveal` (L268) runs `chargeAmbushVillain` (L1054) inside the Ambush block, after the entry escape and **before** the onAmbush executor, with its trace first. `resolveChargePushConsequence` (L1140) has an exhaustive `switch` whose `default` names WP-839's `'discard-if-pushed'`. The private `describeCitySpace` (L1209) returns `the Sewers` … `the Bridge`, else `city space ${index}`.
   - `events/notableEvents.compose.ts` `composeChargeClause` (L438) has the same exhaustive `switch`. `composeAmbushNarrative` (L492) is `(cardName, effectResults, villainDeckPlayCount = 0, stackVillainClause?, descriptorClauses = [], chargeClause?)`.
   - `apply-effect-markers.mjs` holds the hand-synced `VILLAIN_CHARGE_PUSH_CONSEQUENCES` copy (L329) and the `charge` validator (~L666).
   - `setup/villainAbility.setup.test.ts` L2551 has the negative case `reject-charge-discard` (`charge:1:discard-if-pushed`), commented as flipping to positive when WP-839 appends.
   If WP-874 is not merged, this packet is BLOCKED.
2. **WP-831's City** (`board/city.types.ts`): `CityZone = CitySpace[]`, `CITY_MIN_SIZE = 1`, `CITY_MAX_SIZE = 6`. `pushVillainIntoCity` escapes `city[length - 1]`. Names stay on engine indices, 0 Sewers … 4 Bridge (`board/citySpaceNames.ts`: `CITY_SPACE_NAMES` L24, `citySpaceNameForIndex` L48). A City of 4 or fewer spaces has no Bridge.
3. **Rules text** (`docs/legendary-universal-rules-v23.md`):
   - L541-575: entry into the Sewers, push chain, escapes, then the new Villain's Ambush.
   - L1117-1122: Charge.
   - L1458-1463 and L1824-1830: re-entry follows normal entry rules.
   - L2831-2837: an unusual entry still does its Ambush.
   - L1478-1484: an effect that moves a Villain to a space that does not exist does nothing.
   - L2927: Henchmen are Villains.
   - L628: no push on a Bystander, Twist or Strike reveal.
4. **Card text and markers.** The four lines are verbatim in `data/cards/co2e.json`. In `scripts/convert-cards/inputs/villain-effect-markers.json` `villains.co2e`:
   - `enemies-of-asgard.ymir-frost-giant-king` holds only `fight` (WP-836); `frost-giant-warrior` holds `ambush` + `fight` (WP-836 / WP-837);
   - `sinister-spider-foes` has no `green-goblin` key;
   - `sinister-syndicate` has no `speed-demon` or `boomerang` key.
   None of this packet's four lines carries an `[effect:]` marker. Frost Giant Warrior instance ids are `co2e-villain-enemies-of-asgard-frost-giant-warrior-00` / `-01`.
5. **Primitive vocabulary.** `VillainEffectPrimitive` (L343) and `VILLAIN_EFFECT_PRIMITIVES` (L489) hold **60** members, the last `'charge'`. `rules/villainAbility.types.test.ts` pins them in these places:
   - the L388 ordered list (title "exactly the 60") and its L452-455 length / message;
   - the L456-460 last-member literal `'charge'` / `(position 60)`;
   - eight `assert.equal(VILLAIN_EFFECT_PRIMITIVES.length, 60)` lines (L685, L724, L753, L809, L869, L954, L979, L1019);
   - the L873 parity `Record<VillainEffectPrimitive, true>`;
   - WP-874's L1020 `slice(57)`;
   - WP-874's L1027-1033 consequence pin (`Record<VillainChargePushConsequence, true>` and the deep-equal `['demolish-if-pushed']`).
   `VillainEffectDescriptor` is L836; `victoryVillainGroup?: string` is L903 (Viper). The `descriptorKey` key set is `primitive|target|magnitude|selector`.
6. **Executor** (`villain/villainEffects.execute.ts`):
   - `VILLAIN_EFFECT_HANDLERS` (L5364) is a `Record<VillainEffectPrimitive, VillainEffectHandler>`, dispatched by `applyVillainEffect` (L6087).
   - A keyword-less handler self-narrates via `pushLog` and returns `narrativeClause` equal to the clause it logged (D-24854 §6; `villainEffectSwapTwoCityVillains` ~L5069 is the City-swap precedent, `collectCityVillainIndices` counts henchmen).
   - `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (L1020) labels a no-op handler's trace `no-op` and keeps it out of the D-24854 fallback clause.
   - `recordVillainSecondarySiteTrace` (L1125) has closed `effect` / `handler` unions that each new bridge appends to (D-24824 §7).
   - Viper's handler (~L5226) derives `setAbbr` through the `-villain-` infix (D-24299 Path B).
   - `villainEffectTimingLabel` and `resolveCardDisplayName` label log lines.
7. **The reveal path** (`villainDeck/villainDeck.reveal.ts` `performVillainReveal` L268). It validates the City shape, removes the card from the deck, then runs one contiguous block:
   1. `pushVillainIntoCity`;
   2. the entry log (`[Ambush] … revealed and entered the city!` / `… revealed and entered the city.`);
   3. `resolveVillainEscape`;
   4. the Ambush block (`if (cardHasAmbush)` L384), which runs, in order: the WP-743 flag; the WP-874 charge bridge; `executeVillainAbilitiesWithNarrative`; the `Ambush effect:` line; The Leader's count + line; the WP-869 stack-entry count; the `ambushResolved` push; The Leader's play bridge; the stack-entry bridge.
   `resolveVillainEscape` (L733) and `enterStackCardsAsVillains` (L916) live here. `villainDeck.enterCity.ts` imports this module, so the shared entry helper lives here.
8. **The Fight bridges.** `moves/fightVillain.ts` `defeatCityVillainCore` (L602) ends by calling `runVillainFightFireSiteBridges(G, ctx, cardId, shuffleContext)` (call L831, definition L982, WP-872 / D-24817). That function runs Endless Armies' play, Mr. Immortal's reenter and the WP-869 stack entry. Each builds its own `RevealContext` `{ random: shuffleContext.random, ctx: { currentPlayer, turn: readTurnNumber(ctx) } }` and records its secondary-site trace before the bridge. `resolveVillainDeckDefeatFightEffect` (Nightbringer's Villain Deck defeat) calls the same function. `moves/zoneOps.ts` `moveCardFromZone` returns new arrays.
9. **The escape opener** (`villainDeck/villainEscapeProcedure.ts`). `openEscapeEffectDiscardIfNeeded` (L339) drains `G.pendingEscapeEffectDiscards`. It stops on a pending choice or a decided endgame, shifts one entry, routes `traitFilter` entries to `prepareVillainEffectTraitDiscardChoice` (WP-837) and all others to `buildEscapeEffectCostDiscardChoice`, then parks with the ride rule. `PendingEscapeEffectDiscard` (`types.ts` L1957) already says "the Villain whose Escape or Ambush effect owes the discard". The queue is in the end-of-game drop set and the operator busy guard.
10. **Seat-choice consumers.**
    - `moves/seatChoice.resolve.ts`: the WP-837 trait arm L828.
    - `simulation/ai.seatChoice.ts`: the discard kinds → `indexOfLeastValuableCard`, L214.
    - `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue`: the kind → heading switch (`'villain-effect-trait-discard'` L129).
11. **Zone invariant.** `invariants/gameRules.checks.ts` `checkNoCardInMultipleZones` (L75) scans Victory Piles, the City and the Villain Deck.
12. **Marker script** (`scripts/convert-cards/apply-effect-markers.mjs`) keeps hand-synced copies: `VILLAIN_EFFECT_PRIMITIVES` (L230), `CITY_SPACE_NAMES` (L315), `VILLAIN_CHARGE_PUSH_CONSEQUENCES` (L329) and `isValidParameterizedEffectToken` (L431). Legacy keywords are emitted first, then parameterized tokens in input order.
13. **No hashed fixture or PAR artifact plays these groups.** The engine fixtures and `data/par` never name `co2e/sinister-spider-foes`, `co2e/sinister-syndicate` or `co2e/enemies-of-asgard`, and the sim matrix is core-only. `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` embeds co2e card text, so it regenerates (`pnpm spike:local-bundle`) with its `initialStateHash` unchanged, as WP-874 did.
14. **The Blob (WP-840)** is not on `main`. Every primitive here reads and writes `G.city` only. If WP-840 lands first, it adds primitives (append after them) and may split `defeatCityVillainCore`; the Boomerang bridge still lives in `runVillainFightFireSiteBridges`. If WP-840 keeps The Blob in `G.city`, STOP and reconcile.
15. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile (update this WP and D-24772) before coding.

## Context (Read First)

- **Three new primitives, one reused.**
  - Green Goblin's move needs no escape and no reveal, so it runs in the executor like Whirlwind's swap and reports its clause through `narrativeClause`.
  - Speed Demon is a Charge (rules L1117-1122), so he reuses WP-874's `charge` and its Ambush bridge. Only the push consequence is new (RS-6 / D-24820 list every touch-point).
  - Ymir's Warrior entry needs the full City-entry path, Ambush included.
  - Boomerang's play needs `performVillainReveal`.
  Ymir and Boomerang use the WP-542 secondary-fire-site pattern: a reachable no-op handler (allowlisted, so no hollow record and no fallback clause), the real work at the Ambush fire site or in `runVillainFightFireSiteBridges`, and a D-24824 `secondary-site` trace recorded just before the bridge.
- **Speed Demon's discard is owed after the move.** "Each player discards a card" is every player's own pick. WP-793 / WP-817 already give that as a seat choice opened after the move. The charge bridge runs inside a reveal that has no `events`, so `resolveChargePushConsequence`'s new `'discard-if-pushed'` case records the owed discard on the FIFO Primus's Escape and WP-837's trait discards use (`G.pendingEscapeEffectDiscards`). The entry gains an optional `anyHandCard` marker, routed to its own unfiltered builder and kind. Rule order holds by construction:
  - escape steps 1-2 drain before the FIFO opens;
  - an Escape effect of a Villain the charge pushed out records before the charge's own entry, because the bridge enqueues after its steps.
  As with D-24656 point 4 / D-24750, the discard resolves after the move, a recorded deviation. WP-874's `ChargeOutcome.triggeredPushConsequence` already covers a consequence "owed after the move".
- **"If this pushes" reads the charge steps only.** WP-874's bridge already counts only its own steps (`hasPushedAnyVillain`); Speed Demon's entry push is the ordinary reveal.
- **Why the City-entry block is extracted.** Ymir's Warrior must enter "like any other Villain" (Assumes 3): push, entry log, escape, the whole Ambush block (WP-874's charge bridge included) and the `ambushResolved` event. That is exactly `performVillainReveal`'s villain branch after the deck removal (Assumes 7). WP-757 extracted `resolveVillainEscape` the same way. The extraction is mechanical, and the reveal path stays byte-identical, with the existing reveal, charge and keyword-less narrative tests as the oracle. The Warrior enters; it is not revealed: no `onCardRevealed` / scheme reveal triggers fire for it and `villainRevealedThisTurn` is untouched. Ymir's own `onCardRevealed` runs after the Warrior's entry, as after The Leader's play.
- **Green Goblin swaps, he does not push.** "Put him on the Bridge. If there's another Villain there, swap them." is the Spinning Cyclone swap-if-occupied shape (D-24664), so nothing escapes. The Bridge is engine index 4. In a City of 4 or fewer spaces it does not exist, and rules L1478-1484 say the move does nothing. In a 6-space City the Bridge is index 4, one space short of the edge.
- **Boomerang returns to the Villain Deck.** "Put Boomerang in its place" means the revealed Villain's place on top of the Villain Deck, and "play that Villain" is the normal reveal of that card. So the bridge moves Boomerang from the fighter's Victory Pile to just under the revealed Villain and calls `performVillainReveal`, which plays the top card and leaves Boomerang on top. His rescued Bystanders stay rescued, because they were awarded before the Fight effect. The fighter loses his 2 VP; the card text moves him, so that is faithful. Defeated from the Villain Deck through Nightbringer (WP-872), he is routed to the fighter's Victory Pile and the same bridge runs with `currentPlayer` = the fighter (D-24817), so the swap happens there too, the Endless Armies precedent.
- **Ymir's chooser.** "Choose a Frost Giant Warrior from any player's Victory Pile" names a choice, but the Warriors are identical; the choice only decides whose Victory Pile loses 2 VP. As with D-24335's collapsed KO-or-gift, this packet locks a deterministic pick: the current player's pile first, then the other seats in turn order (`seatsInTurnOrderFrom`, D-24780). The interactive alternative is Operator fork F1.
- **Henchmen are Villains** (D-24603 / D-24607). Any City occupant counts as "another Villain" for Goblin's swap and Speed Demon's push, and a henchman on top of the Villain Deck counts for Boomerang.
- **One space describer.** WP-874's private `describeCitySpace` already names a City index for log text. The Goblin handler needs the same label, so the function moves verbatim to `board/citySpaceNames.ts` (exported) and both sites import it. It is the second use, so this is a move, not a new abstraction, and the charge lines stay byte-identical.
- **No-UX-freeze.** The any-card discard reuses `G.pendingSeatChoice` and everything already built around it: its UIState projection, `PendingSeatChoicePrompt` (unknown kinds render `Your choice`), the registered `resolveSeatChoice` move and the kind-dispatched timeout default. It adds no move, `pending*` queue, block-all guard, UIState field or `UiMoveName` entry. A missed dispatch arm silently skips the discard (T18 fails); it never freezes.
- **Split vs one WP.** The four lines share the marker block, the parser, the executor and the City helpers, and Ymir needs the extracted entry block. The file count is above the ~10 guideline (§Files Expected to Change).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (villain group shape), §5 (`[effect:]` markers are pipeline-appended).
- `docs/ai/ARCHITECTURE.md`: §Zone & Pile Structure, §The Rule Execution Pipeline, Persistence Boundaries, §Architectural Principles #1.
- `docs/ai/DECISIONS.md`: scan D-24023, D-24081, D-24266, D-24287, D-24299, D-24335, D-24336, D-24351, D-24587, D-24603, D-24607, D-24656, D-24664, D-24703, D-24750, D-24764, D-24770, D-24780, D-24817, D-24820, D-24824, D-24854 before coding.
- User memory: `reference_villain_effect_vocabulary_extension`, `reference_bot_legalmoves_moveguard_divergence`, `reference_card_data_pipeline`, `reference_engine_tests_never_typechecked`, `reference_setup_hook_change_replay_compat`, `reference_fightvillain_defeats_henchmen_too`.

### Operator forks (drafted with the recommended default)

- **F1 — Ymir's chooser.** Default: the deterministic pick above. Alternative: an active-seat seat choice listing every player who holds a Warrior. Recommend the default: identical cards; the outcome is VP attribution only.
- **F2 — Speed Demon's discard.** Default: an every-player seat choice (the WP-817 pattern). Alternative: the D-24284 split. Recommend the default.
- **F3 — one FIFO with WP-837.** WP-837 landed with `traitFilter`. This packet adds `anyHandCard` beside it as a second optional, presence-tested field, each routed to its own builder and kind. Alternative: one discriminated `discardKind` field. That renames WP-817's and WP-837's shape, so it is not recommended.
- **F4 — Boomerang's KO before the reveal.** `koHeroCurrentPlayer` may park an interactive KO, and the reveal fires in the same move, before the pick resolves (the Endless Armies posture, D-24351). Default: accept and record it.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.
- Tests use `node:test` + `node:assert`, with no `boardgame.io` import.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24772) before coding. One WP per session.

**Packet-specific:**
- **One Charge implementation** (D-24820). Speed Demon adds a consequence, not a primitive, a step helper or a bridge.
- **Byte-identical reveal path.** `resolveVillainCityEntry` takes the ~200-line block verbatim; its `// why:` names it a byte-identity exception to the 00.6 function-length rule. The extraction and the `describeCitySpace` move change no log line, event, trace, field or order for any card without the new markers. No existing `villainDeck.reveal.test.ts`, `villainDeck.enterCity.test.ts` or `villainCharge.reveal.test.ts` assertion is edited.
- **`G.city` only.** No primitive reads or writes a slot outside `G.city`. Every City loop uses `G.city.length`, never 5.
- **Data, not English.** Behavior comes only from the six markers in Locked Values.
- **Markers only.** Regenerate card data with `apply-effect-markers.mjs` alone. Never run `convert-cards-v15.mjs`.
- **Self-narrate.** Every new outcome logs through `pushLog` (hash-excluded `G.messages`, D-24081). `VillainEffectKeyword`, the legacy reverse-map and `EFFECT_KEYWORD_LABELS` stay frozen; no new field enters `descriptorKey`.
- **Zone moves through helpers.** Victory Pile removals use `moveCardFromZone`; hand discards use `discardFromHand`; City entry uses the extracted helper; escapes use `resolveVillainEscape`; the Boomerang play uses `performVillainReveal`.
- **No new `G` key.** The owed discard reuses the lazy `G.pendingEscapeEffectDiscards` FIFO; the new entry field is optional and present only on Speed Demon's entries.

## Locked Values

**Types (`rules/villainAbility.types.ts`):**
- Primitives appended to the union **and** the end of `VILLAIN_EFFECT_PRIMITIVES`, in this order: `'move-self-to-city-space'`, `'reveal-villain-deck-top-swap-self'`, `'enter-city-from-victory-pile'`. They take positions 61-63 (60 → 63; re-read at execution and append after whatever is last).
- `VillainChargePushConsequence = 'demolish-if-pushed' | 'discard-if-pushed'`; `VILLAIN_CHARGE_PUSH_CONSEQUENCES` gains `'discard-if-pushed'` at the end (append-only, D-24820). The JSDoc names Speed Demon.
- `VillainEffectDescriptor` gains two fields, neither in `descriptorKey`:
  - `destinationCitySpace?: CitySpaceName` (`move-self-to-city-space` only);
  - `victoryVillainCard?: string` (`enter-city-from-victory-pile` only), beside the reused `victoryVillainGroup`. The `victoryVillainGroup` JSDoc widens from Viper-only to name both carriers; the Viper value stays normalized, and this packet's value is the validated slug.
- **Sanctioned existing-test edits** in `rules/villainAbility.types.test.ts`, each a value change from an intended product change, stated in the commit body:
  - append the three names to the ordered list; title, length and message 60 → 63;
  - the last-member literal → `'enter-city-from-victory-pile'` `(position 63)`;
  - the eight `length, 60` lines → 63;
  - the parity `Record` gains three keys;
  - WP-874's `slice(57)` → `slice(57, 60)`;
  - WP-874's consequence pin: its `Record` gains `'discard-if-pushed': true`, and the deep-equal → `['demolish-if-pushed', 'discard-if-pushed']`.
  WP-874's `setup/villainAbility.setup.test.ts` case `reject-charge-discard` (`charge:1:discard-if-pushed`) flips to a positive case, as its comment says: rename the slug to `charge-discard`, keep the token, change its `// why:` to WP-839 (D-24772), and add `assert.deepStrictEqual(hookFor('charge-discard').effects, [{ primitive: 'charge', magnitude: 1, chargePushConsequence: 'discard-if-pushed' }])` to the `parses every Locked-Values marker` `it`. The row is never deleted. Each change gets a `// why: WP-839 (D-24772)` note.

**Marker grammar (engine parser and `apply-effect-markers.mjs`, identical):**
- `move-self-to-city-space:<space>`: exactly 2 parts; `<space>` ∈ `CITY_SPACE_NAMES` (case-sensitive) → `{ primitive, destinationCitySpace }`.
- `charge:<N>:discard-if-pushed`: accepted by WP-874's existing `parseChargeEffect` membership loop once the array grows (no parser edit) → `{ primitive: 'charge', magnitude: N, chargePushConsequence: 'discard-if-pushed' }`. The script's validator reads its hand-synced copy, which gains the member.
- `reveal-villain-deck-top-swap-self`: no params (the existing no-param tail).
- `enter-city-from-victory-pile:<groupSlug>:<cardSlug>`: exactly 3 parts; each slug matches `^[a-z0-9]+(-[a-z0-9]+)*$` → `{ primitive, victoryVillainGroup, victoryVillainCard }`.
- Anything else for these primitives → null → `unresolvedMarkers`.

**Data (marker map `villains.co2e`).** Merge these keys into any group or card object that already exists, and never replace a sibling's key. `ymir-frost-giant-king` keeps its `fight`.
- `sinister-spider-foes.green-goblin.ambush: ["captureBystander", "move-self-to-city-space:bridge"]`
- `sinister-syndicate.speed-demon.ambush: ["charge:2:discard-if-pushed"]`
- `sinister-syndicate.boomerang.fight: ["koHeroCurrentPlayer", "reveal-villain-deck-top-swap-self"]`
- `enemies-of-asgard.ymir-frost-giant-king.ambush: ["enter-city-from-victory-pile:enemies-of-asgard:frost-giant-warrior"]`
- `mechanic-provenance.json`: the three new primitives → `{ "wp": "WP-839", "decision": "D-24772" }`. `charge` keeps WP-874 / D-24820, the primitive's owner. Speed Demon's ledger row is `executable` through `charge`'s existing handler.
- `docs/ai/coverage/live-verify.json`: four `pending` rows, one per card line (the WP-874 row shape, `wp: "WP-839"`).

**City names (`board/citySpaceNames.ts`):**
- `export function describeCitySpace(cityIndex: number): string`, moved verbatim from `villainDeck/villainDeck.reveal.ts` with its JSDoc. A named space returns `the Sewers` … `the Bridge`; any other index returns `` `city space ${cityIndex}` ``. `villainDeck.reveal.ts` deletes its copy and imports this one; its `citySpaceNameForIndex` import (L65) goes if nothing else in the file uses it. The `citySpaceNames.ts` header's stale "fixed 5-tuple" wording is corrected to WP-831's 1-6 array in the same edit.

**Executor (`villain/villainEffects.execute.ts`):**
- `export function findVillainHookDescriptor(G, cardId, timing, primitive): VillainEffectDescriptor | null` returns the first descriptor of that primitive among the card's hooks at that timing. It has the `!G.villainAbilityHooks` guard and iterates `hook.effects ?? []`. A gated descriptor (`requireCitySpaces` or `requireCondition` set) returns null, the `villainCardChargeEffect` rule: the bridge never fires an effect the executor would fail closed. No marked carrier is gated.
- No-op handlers returning `{ targets: [] }`: `villainEffectRevealVillainDeckTopSwapSelf` and `villainEffectEnterCityFromVictoryPile`. Both are added to `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` with a `// why:` naming D-24772 and the bridge. `move-self-to-city-space` is NOT added, because it mutates `G.city`.
- `recordVillainSecondarySiteTrace`'s unions gain `'enter-city-from-victory-pile'` / `'enterCityFromVictoryPile'` and `'reveal-villain-deck-top-swap-self'` / `'swapFoughtVillainWithVillainDeckTop'` (D-24824 §7 forward rule).
- `villainEffectMoveSelfToCitySpace` computes `label = villainEffectTimingLabel(timing)` and names cards via `resolveCardDisplayName`. Destination index = `CITY_SPACE_NAMES.indexOf(destinationCitySpace)`; from index = `G.city.indexOf(cardId)`. Each case logs `` `${label} effect: ${clause}.` `` and returns `{ targets: [], narrativeClause: clause }` (D-24854 §6). The cases, in order:
  1. Destination missing: clause `` `${name} has no destination space; it does not move` ``, `'blocked'`.
  2. `from < 0`: clause `` `${name} is not in the City, so it does not move` ``, `'blocked'`.
  3. `destination >= G.city.length`: clause `` `${describeCitySpace(destination)} is not part of the City right now, so ${name} stays where it is` ``, `'blocked'`.
  4. `from === destination`: clause `` `${name} is already on ${describeCitySpace(destination)}` ``, `'blocked'`.
  5. Otherwise `other = G.city[destination] ?? null` (`noUncheckedIndexedAccess`); set `G.city[destination] = cardId` and `G.city[from] = other` (null when the space was empty). Empty: clause `` `${name} moved to ${describeCitySpace(destination)}` ``. Occupied: clause `` `${name} moved to ${describeCitySpace(destination)}, and ${otherName} moved to ${describeCitySpace(from)}` ``. Both `'applied'`.

**Charge consequence (WP-874's `switch`es, one `case` each):**
- `villainDeck.reveal.ts` `resolveChargePushConsequence`, `case 'discard-if-pushed'`:
  - not pushed → `` `Ambush effect: ${resolveCardName(G.cardDisplayData, cardId)} pushed no Villains forward, so no one discards.` `` `'blocked'`, return null;
  - pushed → `enqueueAnyCardEffectDiscard(G, cardId, 'Ambush')`, then `` `Ambush effect: ${resolveCardName(G.cardDisplayData, cardId)} pushed Villains forward, so each player must discard a card.` `` `'threat'`, return `'discard-if-pushed'`.
  A charger that escaped still evaluates its consequence (WP-874's loop already does).
- `notableEvents.compose.ts` `composeChargeClause`, `case 'discard-if-pushed'`: `clause += ', then each player must discard a card'`.

**Reveal path (`villainDeck/villainDeck.reveal.ts`):**
- Names in the log strings below: `ref` / `topRef` / `sourceRef` / `entrantRef` = `formatCardRef(G.cardDisplayData, id)`; `entrantName` = `resolveCardDisplayName(G, entrant.cardId)`, which falls back to the entrant's own id, never Ymir's.
- The extracted block stays one function, moved verbatim (the WP-757 `resolveVillainEscape` precedent); splitting it is out of scope. Ymir's additions are the pre-event lookup (`findVillainHookDescriptor`, `selectVictoryPileCityEntrant`, the clause), the 7th `composeAmbushNarrative` argument, and the trace + `enterCityFromVictoryPile` call after the stack-entry bridge; nothing else in the block changes.
- Extract `export function resolveVillainCityEntry(G, context, implementationMap, cardId, entryPhrase: string): void`. It holds the contiguous block from `pushVillainIntoCity` through the end of the Ambush block (Assumes 7), moved verbatim except for the entry line, which becomes `` `[Ambush] ${ref} ${entryPhrase}!` `` / `` `${ref} ${entryPhrase}.` ``. `performVillainReveal` keeps the validation and deck removal and calls it with `'revealed and entered the city'`.
- Inside the Ambush block, before the `ambushResolved` push: `entryDescriptor = findVillainHookDescriptor(G, cardId, 'onAmbush', 'enter-city-from-victory-pile')`. When it is non-null, compute `entrant = selectVictoryPileCityEntrant(G, cardId, entryDescriptor, ctx.currentPlayer)`. When `entrant` is non-null, the clause is `` `brought ${entrantName} back into the city` `` (`entrantName`, above). It is passed as `composeAmbushNarrative`'s new 7th argument.
- After the stack-entry bridge (the block's last step), when `entryDescriptor` is non-null: `recordVillainSecondarySiteTrace(G, cardId, 'onAmbush', 'enter-city-from-victory-pile', 'enterCityFromVictoryPile', 'villain-ambush-bridge', {}, readRevealContextTurn(context))`, then `enterCityFromVictoryPile(G, context, implementationMap, cardId, entrant)`.
- `export function selectVictoryPileCityEntrant(G, sourceCardId, descriptor, currentPlayer): { seat: string; cardId: CardExtId } | null`:
  - `setAbbr` comes from `sourceCardId` through the `-villain-` infix (no infix → null);
  - prefix = `` `${setAbbr}-villain-${victoryVillainGroup}-${victoryVillainCard}-` ``, and the remainder must match `^[0-9]{2}$`;
  - seats come from `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)` (`turn/seatOrder.logic.js`, D-24780);
  - the first match in pile order wins.
- `enterCityFromVictoryPile(G, context, implementationMap, sourceCardId, entrant: { seat: string; cardId: CardExtId } | null)`:
  - null → `` `Ambush effect: no matching Villain is in any player's Victory Pile, so nothing enters the city.` `` `'blocked'`;
  - otherwise log `` `Ambush effect: ${sourceRef} brings ${entrantRef} back from Player ${seat}'s Victory Pile.` `` `'threat'`, then `const removal = moveCardFromZone(zones.victory, [], cardId)`:
    - `removal.found` false → `` `Ambush effect: ${entrantRef} is no longer in Player ${seat}'s Victory Pile, so nothing enters the city.` `` `'blocked'`, return (defensive: The Leader's play and the stack entry run between the pick and the entry);
    - otherwise set `zones.victory = removal.from` and call `resolveVillainCityEntry(G, context, implementationMap, cardId, ` `` `entered the city from Player ${seat}'s Victory Pile` `` `)`.
- `export function swapFoughtVillainWithVillainDeckTop(G, context, implementationMap, foughtCardId, currentPlayer): void`, checked in this order:
  1. Not in that player's Victory Pile → `` `Fight effect: ${ref} is not in Player ${currentPlayer}'s Victory Pile, so it cannot take a Villain's place.` `` `'blocked'`.
  2. Empty deck → `` `Fight effect: the Villain Deck is empty, so ${ref} reveals nothing.` `` `'blocked'`.
  3. Top type (`G.villainDeckCardTypes[top]`) is not `'villain'` / `'henchman'` → `` `Fight effect: ${ref} revealed ${topRef} from the Villain Deck; it is not a Villain, so it stays on top.` `` `'blocked'`.
  4. Otherwise log `` `Fight effect: ${ref} revealed ${topRef} and takes its place on top of the Villain Deck; ${topRef} is played.` `` `'applied'`, remove the fought card from the Victory Pile (`moveCardFromZone`), set `G.villainDeck.deck = [top, foughtCardId, ...rest]`, then call `performVillainReveal(G, context, implementationMap)`.

**Fight bridge (`moves/fightVillain.ts` `runVillainFightFireSiteBridges`):** add a last step after the WP-869 stack entry. When `findVillainHookDescriptor(G, cardId, 'onFight', 'reveal-villain-deck-top-swap-self')` is non-null, build a `RevealContext` the way the sibling bridges do (in its own scope). Record `recordVillainSecondarySiteTrace(G, cardId, 'onFight', 'reveal-villain-deck-top-swap-self', 'swapFoughtVillainWithVillainDeckTop', 'villain-fight-bridge', {}, readTurnNumber(ctx))`, then call `swapFoughtVillainWithVillainDeckTop(G, revealContext, DEFAULT_IMPLEMENTATION_MAP, cardId, currentPlayer)`. The sibling bridges are not edited.

**Narrative (`events/notableEvents.compose.ts`):** `composeAmbushNarrative(cardName, effectResults, villainDeckPlayCount = 0, stackVillainClause?, descriptorClauses = [], chargeClause?, victoryPileEntryClause?: string)` appends `victoryPileEntryClause` after `chargeClause`. With it undefined, the output is byte-identical. This is the D-24854 trailing-parameter channel for bridged clauses.

**State (`types.ts`):** `export interface PendingEffectDiscardAnyHandCard { effectLabel: 'Ambush'; }`. Its JSDoc says: an owed every-player discard of any one hand card; `effectLabel` is the literal `'Ambush'`, the only record site; widen it, and carry the label into the choice the WP-837 way, when a second record site lands. Add `PendingEscapeEffectDiscard.anyHandCard?: PendingEffectDiscardAnyHandCard`; an any-card entry carries `eligibleCosts: []`. The interface JSDoc gains a WP-839 / D-24772 line beside WP-837's. No new `LegendaryGameState` field.

**Any-card owed discard (`villainDeck/villainEscapeProcedure.ts`):**
- `export const VILLAIN_EFFECT_ANY_CARD_DISCARD_KIND = 'villain-effect-any-card-discard';`
- `export function enqueueAnyCardEffectDiscard(G, sourceCardId, effectLabel: 'Ambush'): void` pushes `{ escapedCardId: sourceCardId, eligibleCosts: [], anyHandCard: { effectLabel } }` onto `G.pendingEscapeEffectDiscards`, creating the queue lazily. The entry goes at the back (FIFO, never the front).
- `openEscapeEffectDiscardIfNeeded` keeps its loop, early returns and ride rule. After the shift, an entry with `anyHandCard !== undefined` is built by `buildVillainEffectAnyCardDiscardChoice(G, entry)`, checked before the `traitFilter` branch. Every other entry routes exactly as on `main`.
- `buildVillainEffectAnyCardDiscardChoice(G, entry)`:
  - seats ascending (a simultaneous prompt builder stays sorted under D-24780 §6 / D-24501; a `// why:` says so);
  - a seat with an empty hand → `` `${effectLabel} effect: Player ${seat} has no card to discard.` `` `'blocked'`;
  - otherwise one option per hand card in hand order, labelled `resolveCardName(G.cardDisplayData, cardId)`, with `cardId`;
  - no addressed seat → undefined;
  - `defaultOptionIndex: 0`, kind `VILLAIN_EFFECT_ANY_CARD_DISCARD_KIND`.
- `applyVillainEffectAnyCardDiscard(G, choice)`: seats ascending (D-24780 §6), `discardFromHand`; on success `` `Player ${seat} discarded ${formatCardRef(G.cardDisplayData, cardId)} (Ambush effect).` `` `'applied'`.
- Wiring: the dispatch arm in `seatChoice.resolve.ts` beside the WP-837 arm; `ai.seatChoice.ts` adds the kind to the `indexOfLeastValuableCard` branch. The drop set and the busy guard already cover the queue.
- Client heading (`PendingSeatChoicePrompt.vue`): `case 'villain-effect-any-card-discard': return 'A Villain\'s effect — choose a card to discard';`.

**Keyword-less Ambush set (`villain/ambushNarrative.keywordless.test.ts`, WP-897 RS-5):** the real-parser set gains `'enter-city-from-victory-pile'` and `'move-self-to-city-space'`, 18 → 20, in sorted position. `'charge'` is already there. The ordering assertion (no keyword-less descriptor precedes a legacy one) holds: Goblin's `captureBystander` comes first. Add `co2e/sinister-syndicate` to `FIXTURE_GROUP_IDS` for the Speed Demon narrative case. Both are sanctioned edits (D-24854 §6, the WP-874 precedent).

---

## Scope (In)

- **A)** `rules/villainAbility.types.ts` + test: three primitives, one charge consequence, two descriptor fields, the pins (60 → 63).
- **B)** `setup/villainAbility.setup.ts` + test: two parser arms (`move-self-to-city-space`, `enter-city-from-victory-pile`); the swap-self primitive uses the no-param tail; `charge` needs no parser edit; WP-874's negative case flips; the grammar doc list.
- **C)** `board/citySpaceNames.ts` + test: `describeCitySpace` moved in (exported); the header's stale "fixed 5-tuple" wording corrected.
- **D)** `villain/villainEffects.execute.ts` + test: the Goblin handler, two no-op handlers, `findVillainHookDescriptor`, the map entries, the allowlist and the trace unions.
- **E)** `villainDeck/villainDeck.reveal.ts` + tests: the `resolveVillainCityEntry` extraction, the `describeCitySpace` import, the `'discard-if-pushed'` case, the Victory-Pile entry and its trace, and the Boomerang swap.
- **F)** `moves/fightVillain.ts` + test: the Boomerang bridge step.
- **G)** `events/notableEvents.compose.ts` + test: the `'discard-if-pushed'` charge clause and the trailing `victoryPileEntryClause`.
- **H)** `types.ts`; `villainDeck/villainEscapeProcedure.ts` + test; `moves/seatChoice.resolve.ts`; `simulation/ai.seatChoice.ts` + test: the owed any-card discard.
- **I)** Client: `PendingSeatChoicePrompt.vue` + test (one heading).
- **J)** Card data: the marker map and script; `co2e.json` regenerated (4 lines, 6 markers); `mechanic-provenance.json`; regenerated villain ledger, effect index and local-spike bundle; four `live-verify.json` pending rows. In the ewiki `wiki/card-effect-system.md`, add the City-movement paragraph and the WP list line, and correct the stale primitive count and list to the real total.
- **K)** `villain/ambushNarrative.keywordless.test.ts`: the RS-5 set (18 → 20) and the fixture group.

## Out of Scope

- **Ymir's Fight line** (WP-836) and **Frost Giant Warrior's lines** (WP-836 / WP-837). The Warrior's Ambush fires when it enters, with whatever hooks it has.
- **Other Charge cards** (the six ssw2 `[keyword:Charge] N spaces` Ambush lines, King Hyperion's Master Strike, Charge the Wall's Twist, cosm Runner). They are data-only on `charge` or need their own site (WP-874 STATUS follow-ups).
- **The "Choose a Henchman from any player's Victory Pile to enter the city" family** (six lines, mostly Fight-timed) and **Immortus** ("put Immortus in its place", a defeat, not a play).
- **An interactive Ymir pick** (F1) and **deferring Boomerang's reveal** behind its KO (F4).
- **Variable-Attack passives** of these groups (Hydro-Man, Venom's per-captured, which is WP-838's).
- **Galactus-style destroyed named spaces**; Goblin reads only "does index 4 exist".
- **Boomerang's Fight overlay** naming the swap (RS-8; the Fight narrative channel is a D-24854 follow-up).
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts` — modified (Scope A)
- `setup/villainAbility.setup.ts`, `setup/villainAbility.setup.test.ts` — modified (Scope B)
- `board/citySpaceNames.ts`, `board/citySpaceNames.test.ts` — modified (Scope C)
- `villain/villainEffects.execute.ts`, `villain/villainEffects.execute.test.ts` — modified (Scope D)
- `villain/ambushNarrative.keywordless.test.ts` — modified (Scope K: RS-5 set + fixture group)
- `villainDeck/villainDeck.reveal.ts`, `villainDeck/villainDeck.reveal.test.ts`, `villainDeck/villainCharge.reveal.test.ts` — modified (Scope E; new `describe` blocks only in the two tests)
- `moves/fightVillain.ts`, `moves/fightVillain.test.ts` — modified (Scope F)
- `events/notableEvents.compose.ts`, `events/notableEvents.compose.test.ts` — modified (Scope G)
- `types.ts` — modified (Scope H: one interface, one optional field)
- `villainDeck/villainEscapeProcedure.ts`, `villainDeck/villainEscapeProcedure.test.ts` — modified (Scope H)
- `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts` — modified (Scope H: one arm each)
- `simulation/ai.seatChoice.test.ts` — modified (Scope H)

**Client (`apps/arena-client/src/`)**
- `components/play/PendingSeatChoicePrompt.vue`, `components/play/PendingSeatChoicePrompt.test.ts` — modified (Scope I)
- `fixtures/localSpike/featuredSetupBundle.json` — regenerated (Scope J)

**Scripts and data**
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json` — modified (Scope J)
- `scripts/coverage/mechanic-provenance.json` — modified (Scope J)
- `data/cards/co2e.json` — regenerated (Scope J: 4 lines gain markers)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`, `data/metadata/effect-implementation-index.json` — regenerated (Scope J)
- `docs/ai/coverage/live-verify.json` — modified (Scope J: four pending rows)

**ewiki:** `wiki/card-effect-system.md` — modified (Scope J).

**Governance:** `docs/ai/DECISIONS.md` (D-24772), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (D-24772 consumed, if the ledger tracks it) and `docs/ai/post-mortems/01.6-WP-839-co2e-city-movement-effects.md` (new). The 01.6 post-mortem is mandatory: new primitives and a seat-choice kind.

That is 22 engine files (11 production, 2 of them one-arm edits, + 11 tests), 3 client files, 3 script/input files, 1 card-data file, 4 generated or coverage feeds and 1 ewiki page (34), plus 7 governance files. It is above the ~10 guideline because four cards touch two fire sites, the executor, the parser and the escape opener. Every file named above exists on the baseline except the new post-mortem.

## Contract

- The Locked Values above:
  - the three primitives, `'discard-if-pushed'`, their grammar and the two descriptor fields;
  - `describeCitySpace` (moved), `findVillainHookDescriptor`, `resolveVillainCityEntry`, `selectVictoryPileCityEntrant`, `swapFoughtVillainWithVillainDeckTop`;
  - the `composeAmbushNarrative` trailing parameter and the charge clause case;
  - `PendingEffectDiscardAnyHandCard`, `PendingEscapeEffectDiscard.anyHandCard?`, `enqueueAnyCardEffectDiscard` and the `villain-effect-any-card-discard` kind;
  - the two secondary-site trace pairs;
  - the exact log strings and the client heading.
- `executeVillainAbilities`, `resolveVillainEscape`, `performVillainReveal`, `playTopVillainDeckCards`, `enterCityIgnoringAmbush`, `enterStackCardsAsVillains`, `chargeAmbushVillain`, `chargeCityVillainOneSpace`, `parkSeatChoice`, every existing handler and `descriptorKey` keep their signatures and behavior.
- Fire sites: the charge and the Victory-Pile entry are read only at the Ambush fire site, and the Boomerang swap only in `runVillainFightFireSiteBridges`. At any other timing their handlers are reachable no-ops.

## Test Contract

Minimal-`G` fixtures in each file's existing style (`messages: []`, `villainDeckCardTypes` and `cardKeywords` entries for every City card, `villainAbilityHooks` hand-built or from the parser). Ids:
- `gg` (Green Goblin), `sd` (Speed Demon), `boom` (Boomerang);
- `ymir` = `co2e-villain-enemies-of-asgard-ymir-frost-giant-king-00`. A full instance id is required in T22-T25, because `setAbbr` comes from the `-villain-` infix; a short id makes the pick return null for the wrong reason;
- `fgw-00` / `fgw-01` (`co2e-villain-enemies-of-asgard-frost-giant-warrior-00` / `-01`);
- `v1`..`v5` villains, `h1` a henchman.
Each T-case is at least one `it`, grouped under one `describe('WP-839 …')` per file. Every reveal / fight case also runs `checkNoCardInMultipleZones`.

| # | File | Input | Expected | Must NOT / invariant |
|---|---|---|---|---|
| T1 | types | `VILLAIN_EFFECT_PRIMITIVES`; `VILLAIN_CHARGE_PUSH_CONSEQUENCES` | 63 members, the three locked names last in locked order; consequences `['demolish-if-pushed', 'discard-if-pushed']`; parity passes; the sanctioned pins | |
| T2 | types | `descriptorToLegacyKeyword` of each new descriptor (with its fields) and of `{ charge, 2, discard-if-pushed }` | `undefined` each | new fields not in the key |
| T3 | setup | `move-self-to-city-space:bridge`, `…:sewers`, `charge:2:discard-if-pushed`, `charge:1:discard-if-pushed` (WP-874's flipped case), `reveal-villain-deck-top-swap-self`, `enter-city-from-victory-pile:enemies-of-asgard:frost-giant-warrior` | the locked descriptors | |
| T4 | setup | `move-self-to-city-space`, `…:`, `…:moon`, `…:Bridge`, `…:bridge:x`, `charge:2:discard-each`, `charge:2:discard-if-pushed:x`, `reveal-villain-deck-top-swap-self:1`, `enter-city-from-victory-pile`, `…:a`, `…:a:`, `…::b`, `…:A:b`, `…:a:b:c` | each unresolved | never a silent accept |
| T5 | setup | `buildVillainAbilityHooks` over the four lines copied **verbatim** from the regenerated `co2e.json` | Goblin onAmbush `[captureBystander, move-self-to-city-space bridge]`; Speed Demon onAmbush `[charge 2 discard-if-pushed]`; Boomerang onFight `[ko-hero current, reveal-villain-deck-top-swap-self]`; Ymir onAmbush `[enter-city-from-victory-pile …]` and onFight unchanged; no `unresolvedMarkers` | |
| T6 | executor | `villainCardChargeEffect` over Speed Demon's real hook | `{ spaces: 2, pushConsequence: 'discard-if-pushed' }` | |
| T7 | citySpaceNames | `describeCitySpace(0..5)` | `the Sewers` … `the Bridge`, `city space 5` | byte-identical to WP-874's lines |
| T8 | executor | Goblin onAmbush on `[gg,_,_,_,_]` | `[_,_,_,_,gg]`; `Ambush effect: Green Goblin moved to the Bridge.` `applied`; `narrativeClauses` `['Green Goblin moved to the Bridge']` | |
| T9 | executor | `[gg,_,_,_,v1]`, `v1` holds a Bystander, `gg` holds one | `[v1,_,_,_,gg]`; both Bystander lists unchanged (keyed by id); the swap line | no push, no escape |
| T10 | executor | `[gg,_,_,_,h1]`; 3-space `[gg,_,_]`; 6-space `[gg,_,_,_,_,v5]`; `gg` not in the City; `gg` already at 4 | `h1` swapped; 3-space unchanged + `the Bridge is not part of the City right now…` `blocked`; 6-space `[_,_,_,_,gg,v5]`; the two blocked lines | |
| T11 | executor | the two no-op primitives dispatched | `executeVillainAbilities` returns `[]`; no hollow record; no fallback narrative clause; each trace `status: 'no-op'`; `G` minus `diagnostics` deep-equal before/after | allowlisted |
| T12 | executor | `findVillainHookDescriptor` with hooks / wrong timing / no hooks field / a gated descriptor | the descriptor / null / null / null | never throws |
| T13 | charge reveal | reveal `sd` into `[_,v1,_,_,_]` | `[_,_,sd,v1,_]`; `pendingEscapeEffectDiscards` `[{ escapedCardId: 'sd', eligibleCosts: [], anyHandCard: { effectLabel: 'Ambush' } }]`; WP-874's two step lines, then `pushed Villains forward, so each player must discard a card.`; narrative `"Speed Demon" ambushed: charged forward 2 spaces, pushing Villains forward, then each player must discard a card.` | |
| T14 | charge reveal | reveal `sd` into `[_,_,_,_,_]` | `[_,_,sd,_,_]`; no queue; `pushed no Villains forward, so no one discards.` `blocked`; narrative `"Speed Demon" ambushed: charged forward 2 spaces.` | |
| T15 | charge reveal | reveal `sd` into a full `[v1,v2,v3,v4,v5]` | the entry escapes `v5`; the charge escapes `v4` then `v3`; final `[_,_,sd,v1,v2]`; `escapedPile` order `v5, v4, v3`; three `pendingEscapeProcedures` in that order; one any-card entry; escaped counter +3 | rule order |
| T16 | charge reveal | reveal `sd` into a 2-space `[_,v1]` | step 1 escapes `v1`; step 2 `charged forward out of the city.`; city `[_,_]`; `escapedPile` `v1, sd`; one discard entry | the charger's escape still evaluates the consequence |
| T17 | escape | `enqueueAnyCardEffectDiscard(G, 'sd', 'Ambush')` on an empty FIFO; hands `0 [a, b]`, `1 []`, `2 [c]`; opener | one seat choice, kind `villain-effect-any-card-discard`, seats `['0','2']`, every hand card in hand order (a Wound included); `Ambush effect: Player 1 has no card to discard.`; queue field deleted | |
| T18 | escape | T17's choice with `0 → 1`, `2 → 0` via the resolve dispatch | `b`, `c` discarded; two `(Ambush effect)` lines ascending | `discardFromHand` |
| T19 | escape | a bystander-carrying escape (`isHqKoResolved: true`) owed; push the Primus cost entry, then a WP-837 trait entry, then call `enqueueAnyCardEffectDiscard(G, 'sd', 'Ambush')` (not hand-written) | the openings come in order: Bystander discard, Primus, the trait discard, the any-card discard | FIFO + rule order |
| T20 | escape | an open seat choice; and `evaluateEndgame` non-null | nothing opened; the FIFO still length 1 | |
| T21 | bot | `ai.seatChoice` for a `villain-effect-any-card-discard` seat holding a Wound | the Wound's index | |
| T22 | reveal | Ymir revealed; current player 0 victory `[fgw-00, byst-1]`, player 1 `[fgw-01]`; empty City; `fgw-00` has an onAmbush hook (`gainWoundEachPlayer`) | `[fgw-00, ymir, _,_,_]`; player 0 victory `[byst-1]`; player 1 unchanged; the Warrior's Ambush fired; two `ambushResolved` events (Ymir's narrative ends `brought Frost Giant Warrior back into the city.`, then the Warrior's); entry line `[Ambush] … entered the city from Player 0's Victory Pile!`; Ymir's traces: executor `no-op`, then `secondary-site` `enterCityFromVictoryPile` | no `onCardRevealed` rule hook fires for `fgw-00` |
| T23 | reveal | `selectVictoryPileCityEntrant`, seats `0,1,2`, current `1`, Warriors in seats 0 and 2 | seat 2 | wraps from current |
| T24 | reveal | no Warrior anywhere; a pile with only `core-villain-enemies-of-asgard-frost-giant-00`, `co2e-villain-enemies-of-asgard-destroyer-00` and `co2e-villain-enemies-of-asgard-frost-giant-warrior-x1` | null; the `no matching Villain` `blocked` line; the City holds only Ymir; Ymir's narrative has no entry clause | anchored prefix + `^[0-9]{2}$` |
| T25 | reveal | Ymir revealed into a full City, a Warrior in a Victory Pile | Ymir's entry escapes `v5`; the Warrior's entry escapes `v4`; final `[fgw, ymir, v1, v2, v3]` | |
| T26 | fight | Boomerang at City 0 with a Bystander; deck `[v1, x]` (`v1` villain); fight affordable; the fighter holds exactly one KO-able Hero | Boomerang's Bystander in victory, Boomerang not; deck `[boom, x]`; `v1` in the City (entered, Ambush hooks fired); the KO auto-resolved on that Hero; log order: fought → KO → `revealed … takes its place` → `v1` entry; a `secondary-site` trace `swapFoughtVillainWithVillainDeckTop` before `v1`'s traces | `villainRevealedThisTurn` unchanged |
| T27 | fight | deck `[twist, x]`; deck `[]`; deck `[h1, x]` | twist: deck unchanged, Boomerang in victory, `not a Villain` `blocked`, no twist resolved; empty: the `reveals nothing` line; henchman: swapped and played; Nightbringer path: `resolveVillainDeckDefeatFightEffect(G, { currentPlayer: '0', turn }, boom, shuffle)` with `boom` routed to player 0's Victory Pile and deck `[v1, x]` → deck `[boom, x]`, `v1` in the City, `boom` not in victory | |
| T28 | compose | `composeAmbushNarrative('Ymir', [], 0, undefined, [], undefined, 'brought Frost Giant Warrior back into the city')`; `composeChargeClause({ spacesMoved: 2, hasPushedAnyVillain: true, hasChargerEscaped: false, triggeredPushConsequence: 'discard-if-pushed' })`; the existing cases with no new argument | `"Ymir" ambushed: brought Frost Giant Warrior back into the city.`; `charged forward 2 spaces, pushing Villains forward, then each player must discard a card`; every existing expectation unchanged | |
| T29 | reveal | a non-Ambush villain, an Ambush villain and Bulldozer revealed (existing suites) | entry lines, charge lines and traces byte-identical | the extraction oracle |
| T30 | Prompt | kind `villain-effect-any-card-discard` | heading `A Villain's effect — choose a card to discard` | |
| T31 | keywordless | the RS-5 real-parser walk; a Green Goblin and a Speed Demon real-data narrative case | the 20-primitive set; Goblin `"Green Goblin" ambushed: <capture clause>; Green Goblin moved to the Bridge.`; Goblin `G.messages` order: entry line, move line, capture line | |

T13 arithmetic: the Sewers is empty, so `sd` enters space 0 with no entry push (`[sd,v1,_,_,_]`). Charge step 1 moves `sd` to 1 and pushes `v1` to 2; step 2 moves `sd` to 2 and pushes `v1` to 3.

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** the three groups appear in published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`). Speed Demon's charge causes extra escapes and a discard, Boomerang costs the fighter his VP and replays a Villain, and Ymir brings a Warrior back. Those legs get harder. No committed `data/par` artifact references the groups, so nothing is re-pinned.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (card fidelity; no paid or persuasive surface).

**Determinism preservation:**
- No randomness: every pick is positional or seat-ordered. No new `G` field: the owed discard rides the lazy `G.pendingEscapeEffectDiscards`, and `anyHandCard` appears only on Speed Demon's entries.
- The reveal path is byte-identical for every card without the new markers (T29); `getLegalMoves` is untouched.
- Narration goes to hash-excluded `G.messages` (D-24081); traces go to hash-excluded `G.diagnostics` (D-24294). The `ambushResolved` narrative gains clauses only for the three marked Ambush cards.
- `finalStateHash`, `PRE_WP080_HASH` and the local-spike `initialStateHash` are expected unchanged (Assumes 13); if one moves, STOP and explain before any re-pin.
- **Replay-compat:** stored matches replay from their bgio `initialState`, which holds the setup-time hooks, so pre-WP-839 matches replay identically. Only a new match sees the markers (auto-memory `reference_setup_hook_change_replay_compat`). Recorded in D-24772.

## Funding Surface Gate

§20 **N/A**: engine, card data and one prompt heading. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Grammar.** T3-T5 pass. The marker script accepts the six Locked-Values tokens. Its rejection side is checked by hand, because the script runs `main()` on import: put each T4 token into the marker map one at a time, run the script, observe a loud failure, revert. Record the observed failures in the EC-877 commit body.
2. **Types and helpers.** T1-T2, T6-T7 and T12 pass as runtime assertions.
3. **Green Goblin.** T8-T10 pass, including the 3-space and 6-space Cities, and the narrative clause.
4. **Speed Demon.** T13-T16 pass on WP-874's `charge`; no second Charge primitive, step helper or bridge exists (`grep -rn "charge-forward\|chargeCityCardOneSpace" packages/` → empty).
5. **Owed discard.** T17-T21 pass; the existing WP-817 and WP-837 tests and the drop-set / busy-guard drift tests pass unedited.
6. **Ymir.** T22-T25 pass.
7. **Boomerang.** T26-T27 pass; Boomerang is never in two zones.
8. **Reveal byte-identity.** T29 and every pre-existing `villainDeck.reveal.test.ts`, `villainDeck.enterCity.test.ts` and `villainCharge.reveal.test.ts` assertion pass unedited. T11 passes.
9. **Narrative + client.** T28, T30 and T31 pass; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
10. **Data.** `apply-effect-markers.mjs` prints `co2e.json — 6 new marker(s) this run` and re-runs at 0. `git diff data/cards/` touches only `co2e.json`, and only those 4 lines, each gaining its trailing markers.
11. **Gates and hashes.** `pnpm -r build` exits 0 and `pnpm -r --no-bail test` has 0 fail. After the regeneration in Verification Steps, `cards:check`, `effect-index:check`, `ledger:villains:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check` and `cards:count-markers:check` exit 0; `sim:runtime-observed:check` and `sim:coverage --check` need no regeneration. `wiki-viewer:check-links` exits 0 (`check:wiki` runs post-merge). `finalStateHash`, `PRE_WP080_HASH` and the local-spike `initialStateHash` are byte-unchanged.
12. **Ledger rows.** In the regenerated `villain-mechanic-ledger.json`, the four lines are `executable` with a handler; the three new primitives carry WP-839 / D-24772 provenance, and Speed Demon's row carries `charge`'s. No other card's rows change.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record before / after totals.
3. `node scripts/convert-cards/apply-effect-markers.mjs`; re-run → 0 new markers. `git diff --stat -- data/cards/` → only `co2e.json`.
4. `pnpm -r build` again (the ledger reads the engine dist), then `pnpm ledger:villains && pnpm effect-index && pnpm spike:local-bundle`.
5. `pnpm cards:check && pnpm effect-index:check && pnpm ledger:villains:check && pnpm mechanics:metadata:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check && pnpm cards:count-markers:check` → each exits 0. If `mechanics:metadata:check`, `sim:runtime-observed:check` or `sim:coverage --check` flags, STOP: Assumes 13 is false.
6. `pnpm wiki-viewer:check-links` → exit 0. (`pnpm check:wiki` probes the deployed ewiki on `origin/main`, so it runs post-merge, beside the live-verify.)
7. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0.
8. After governance close: `pnpm roadmap:counts:check && pnpm ledger:numbers:check && pnpm workindex:rows:check && pnpm workindex:executed:check` → exit 0. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
9. Revert proofs. Make each change one at a time; each must fail at least one T-case:
   - drop the `enqueueAnyCardEffectDiscard` call from the `'discard-if-pushed'` case (T13);
   - make the Goblin handler push instead of swap (T9);
   - push Speed Demon's entry at the front of the FIFO (T19);
   - leave Boomerang in the Victory Pile (T26);
   - start Ymir's seat order at seat 0 (T23);
   - drop one primitive from `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (T11);
   - restore the hard-coded entry phrase so Ymir's entry line reads "revealed" (T22).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the seven revert proofs were observed.
- [ ] D-24772 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated with the follow-up line (the "Choose a Henchman … to enter the city" family and Immortus can reuse these primitives; further Ambush Charge lines reuse `charge` per D-24820) and RS-8 (Boomerang's Fight overlay does not name the swap).
- [ ] `docs/ai/post-mortems/01.6-WP-839-co2e-city-movement-effects.md` written per `01.6-post-mortem-checklist.md`.
- [ ] `pnpm workindex:rows:check && pnpm workindex:executed:check` → exit 0.
- [ ] WORK_INDEX `[x]` with a `[live-verify: pending]` state token (WP-896 / D-24853), EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-877:` then `SPEC:`.
- [ ] **Hash oracles:** unchanged (Assumes 13).
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). Run new matches on `play.legendary-arena.com` with the deployed gitSha checked, driven by a Workshop paste loadout and the operator setter pane:
  - `sinister-spider-foes`: Green Goblin captures a Bystander and moves to the Bridge; a Bridge occupant swaps into his space.
  - `sinister-syndicate`: Speed Demon charges two spaces; with a Villain ahead of him every player gets the discard prompt. Fighting Boomerang with a Villain on top of the Villain Deck plays that Villain, Boomerang reappears on the next reveal, and the fighter's VP excludes him.
  - `enemies-of-asgard`: with a Frost Giant Warrior in a Victory Pile, Ymir's reveal returns it to the Sewers.
  - The Ambush overlay names Goblin's move, Speed Demon's charge and Ymir's Warrior.
  `pnpm check:wiki` → 0 once the ewiki deploy for the merge commit lands. Record it as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24772 — co2e-city-movement-effects.** It locks:
- the authorized contract change to `rules/villainAbility.types.ts`: primitives `move-self-to-city-space`, `reveal-villain-deck-top-swap-self`, `enter-city-from-victory-pile` (appended in that order), the `'discard-if-pushed'` member of `VillainChargePushConsequence` (D-24820's extension rule), and the descriptor fields `destinationCitySpace` and `victoryVillainCard`, all outside `descriptorKey`;
- placement: Goblin's move runs in the executor (narrative through `narrativeClause`, D-24854 §6); Speed Demon reuses WP-874's Ambush charge bridge; the Victory-Pile entry runs at the Ambush fire site and Boomerang's swap in `runVillainFightFireSiteBridges` (D-24817). Both are behind reachable no-op handlers with D-24824 `secondary-site` traces (the D-24351 pattern);
- Green Goblin: swap-if-occupied, never a push (D-24664). The Bridge is engine index 4 (D-24764); with no Bridge he stays (rules v23 L1478-1484). Any City occupant counts as a Villain (D-24607);
- Speed Demon: `charge:2:discard-if-pushed`. Only the charge's own pushes count. The discard is an owed every-player seat choice: an `anyHandCard` entry at the back of WP-817's FIFO, kind `villain-effect-any-card-discard`, opened after the escape procedures and resolved after the move (extends D-24750 / D-24770);
- Boomerang: a Villain or henchman on top → Boomerang leaves the fighter's Victory Pile for the deck top and that Villain is played through `performVillainReveal`; any other card stays on top, revealed; an empty deck does nothing; a Nightbringer Villain Deck defeat routes him to the fighter's Victory Pile and runs the same bridge, so the swap happens there too (D-24817); the reveal may precede an interactive KO's resolution (D-24351 posture);
- Ymir: a deterministic pick (the current player's Victory Pile first, then seats in turn order via `seatsInTurnOrderFrom`, D-24780; the first match in pile order, by anchored instance-id prefix). The Warrior enters through the extracted `resolveVillainCityEntry` with push, escape and Ambush (rules v23 L1458-1463, L1824-1830, L2831-2837);
- the `resolveVillainCityEntry` extraction and the `describeCitySpace` move keep the reveal path byte-identical; the extracted block stays one function moved verbatim (the D-24587 `resolveVillainEscape` precedent), a recorded exception to 00.6 Rule 5 / `.claude/rules/code-style.md` §Functions, and splitting it is a follow-up; `buildVillainEffectAnyCardDiscardChoice` deliberately parallels `buildEscapeBystanderDiscardChoice` (a different kind, log label and apply), the duplicate-first rule;
- the `composeAmbushNarrative` `victoryPileEntryClause` trailing parameter (D-24854) and the `'discard-if-pushed'` charge clause;
- primitives here touch only `G.city`;
- the no-UX-freeze reuse of `G.pendingSeatChoice` and the `'Ambush'` literal label;
- the replay-compat note; the operator forks F1-F4 and their defaults; the supersession of the 2026-10-25 draft's `charge-forward` (D-24820 RS-6).

---

## Gate Record

- **2026-10-25 draft gates (superseded by the re-gate below):** 01.4 READY (PS-1..7 applied), 01.7 RISK → fixes 1-5 applied, 00.3 PASS. Reports: `docs/ai/invocations/preflight-wp839-*.md` / `copilot-wp839-*.md` (scratchpad).
- **2026-11-15 re-gate after WP-874 (#3405), each an independent subagent:** see §Re-gate 2026-11-15 below.

**Recorded residuals (accepted):**
- **RS-8:** Boomerang's `fightResolved` narrative does not name the swap (the D-24703 class on the Fight side; the Fight channel is a D-24854 follow-up). The played Villain gets its own `ambushResolved` when it has Ambush. One STATUS line at close.
- **RS-10:** the three groups are in ranked gauntlet rows. New matches get harder; stored matches replay unchanged. Release timing is Jeff's call; no packet change.
- **RS-9 (retired 2026-11-15):** the draft's `describeCityIndex` label is replaced by WP-874's `describeCitySpace`, so there is one label for an unnamed space.

### Re-gate 2026-11-15

Each gate ran as an independent subagent against `4c228213b` with the working-tree text; reports in the session scratchpad (`preflight-wp839-regate.md`, `copilot-wp839-regate.md`, `lint-wp839-regate.md`), not committed.
- **01.4 pre-flight:** READY TO EXECUTE, conditional on PS-1 (record the `resolveVillainCityEntry` function-length exception in D-24772, not only the EC) and PS-2 (T28's full `ChargeOutcome` input); both folded, scope-neutral, no re-run. Advisories folded: `check:wiki` moved post-merge (A1), the parallel any-card builder recorded in D-24772 (A2), the dead `citySpaceNameForIndex` import (A3), `?? null` in the Goblin swap (A4), the stale "fixed 5-tuple" header (A5).
- **01.7 copilot:** round 1 RISK → HOLD (ten scope-neutral findings): Boomerang via Nightbringer does swap (D-24817) and T27 tests it; Goblin log order; the `reject-charge-discard` flip spelled out (rename, positive assert, never deleted); the log-string name helpers; the Warrior is not revealed (no `onCardRevealed`); the WORK_INDEX / EC_INDEX rows; file counts; the extracted block stays one function; the Assumes 8 anchor; `cards:count-markers:check`. Round 2 CONFIRM after two wording folds (R2-1 Ymir's additions enumerated, R2-2 `check:wiki` in the DoD).
- **00.3 lint:** run 1 FAIL (§5 file count / Scope letters, §14 13 criteria); run 2 PASS after the folds (plus `Risk Tier: MEDIUM`, the §18 row, the Scope C header note).

## Lint Gate Self-Review (00.3)

Drafter's self-review; the independent 00.3 run supersedes it.

| § | Result |
|---|---|
| §1 | PASS — all required sections present; Out of Scope has 8 items |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS — 15 Assumes with file / line anchors at `4c228213b`, the WP-874 hard dependency first, the BLOCKED rule |
| §4 | PASS — rules v23 lines, 00.2 §1.4 / §5, ARCHITECTURE sections, DECISIONS scan list, memory |
| §5 | PASS — 34 files + 7 governance, each marked with its Scope letter; the count is justified |
| §6 | PASS — card / group slugs and instance ids match `co2e.json`; `CitySpaceName`, `CardExtId`, `victoryVillainGroup`, `chargePushConsequence` reuse canonical names |
| §7 | PASS — no new package dependency; WP-874 / WP-831 hard, WP-840 soft |
| §8 | PASS — engine decides; the client only gains a heading; `G` stays JSON; no I/O or randomness |
| §9 | PASS — pnpm / node commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — node:test, minimal-`G` fixtures, the zone invariant on every move case; hash oracles stand in for the golden test |
| §13 | PASS — exact commands with exit-0 / literal-output expectations, diff-scope step, 7 revert proofs |
| §14 | PASS — 12 binary criteria tied to T1-T31 |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes in DoD; D-24026 live-verify per card |
| §16 | PASS — 00.6 mandated; one shared descriptor finder; one Charge primitive (D-24820) |
| §17 | PASS — §1 / §8 / §22-24 / NG-1 cited; conflict line; determinism + replay-compat |
| §18 | PASS — the AC4 / EC grep over `packages/` is clean at baseline; prose naming the superseded identifiers lives under `docs/` and cites D-24820 |
| §19 | N/A at draft — applies to the STATUS entry at close |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason |
