# WP-745 — Unmarked "If …, you get +N" grants: gate 12 free conditional cards on their printed condition (Engine + card data)

**Status:** Draft 2026-09-22; **reconciled and re-gated 2026-11-16** on `main` `b93e6d6ca` (after WP-743, WP-744, WP-777, WP-861 / D-24798 and D-24746). EC-782; **D-24568** reserved (NUMBER-LEDGER, #2290). See §Gate Record.
**Reconciliation (2026-11-16):** five of the draft's 17 lines are already gated on `main`, and the draft's play-history field is superseded by a shipped view.
- **Already gated, dropped from scope.** Elektra's First Strike (dkcy) and Wasp's Follow My Lead line 1 (amwp) read `firstHeroPlayedThisTurn` through `[keyword:first-hero-condition]` (WP-861 / D-24798, live-verified). Winter Soldier's KGB Training (ca75), Iron Man's Repulsor Rays (co2e) and Cannonball's Human Cannon (xmen) read `playedThisTurn` N + 1 through the `PLAYED_OTHER_CARDS_THRESHOLD_PATTERN` text arm (D-24746, live-verified). A fresh probe at `b93e6d6ca` confirms all five hooks carry their gate.
- **No new play-history field.** `playedCardIdsThisTurn(G, inPlay)` (`hero/splitCard.logic.ts:227`) is the shipped "cards played this turn" view: `inPlay` (Penumbra-expanded) plus the cards that went Out of Time, Sidekicks returned to the stack and used Ritual Artifacts (WP-780 / WP-803 / WP-842 / WP-858). `playedThisTurn` and `firstHeroPlayedThisTurn` both read it. The draft's `G.cardsPlayedThisTurn`, its two `coreMoves.impl.ts` appends, its turn-start delete and `matchReadsPlayHistory` are **deleted**: the four play-history conditions here read the same view, so "cards you played this turn" keeps one definition across Winter Soldier, Elektra, Dr. Octopus and Invisible Woman. A card KO'd out of play mid-turn still drops out of that view; D-24798 §5 already accepts that residual for the same family, and it stays one shared follow-up (§Out of Scope E), not a second history.
- **Follow-up D is done.** `G.turnEconomy.cardsDrawn` now increments at ~20 draw sites (Dodge, Do-Over, tactic, villain, Diving Block, Sidekick recruit, smash, seat choices, …), not only `draw:N`. The draft's "draw lines under-grant" caveat is gone.
- **One lockstep site added** that the draft predates: `HERO_PARSER_RECOGNIZED_MARKER_NAMES` (`setup/heroAbility.setup.ts:426`), which `scripts/hero-effect-coverage.mjs` reads so a resolved marker is not counted unsupported. Plus `scripts/coverage/mechanic-provenance.json` rows (the WP-777 / WP-856 practice) and a `live-verify.json` pending row per mechanic (WP-895 / WP-896, D-24852 / D-24853).
- **Feed pins** are measured, not predicted. The dashboard in-play pin now lives at `apps/dashboard/src/composables/useInPlayCoverage.test.ts:753-755` (`totalObs` 8717, `resolvedObs` 1213, `percentResolved` 13.9 at baseline).

**Primary Layer:** Game Engine (`packages/game-engine/src/**`) + card data (`data/cards/*.json` via the curated hero-ability-marker map)
**Dependencies:** all merged on `main` `b93e6d6ca`: WP-743 / D-24566 (`matchReadsConditionType`, the gated-lazy turn-flag pattern and its `onBegin` / `applyOnBeginParity` sites), WP-744 / D-24567 (rebuilt loops resolve and clear deferred grants), WP-777 / D-24616 (`discard-threshold`, the marker→condition template this WP copies), WP-861 / D-24798, D-24746, WP-568 / D-24377, WP-656 / D-24467, WP-665 / D-24476, WP-653 / D-24464, WP-780 / D-24619, WP-803 / D-24692.
**Parallel session:** WP-768 (Indestructible Man, Mastermind fight code) runs alongside. The two share only derived feeds and governance files (`hero-mechanic-ledger`, `effect-implementation-index`, `card-mechanics`, `runtime-observed-hollows`, the dashboard pin, `live-verify.json`, WORK_INDEX, DECISIONS, STATUS, NUMBER-LEDGER, mindmap). Whichever lands second rebases, regenerates every feed from the merged tree and re-measures the pin.
**User-Visible Surface:** play.legendary-arena.com (the in-match economy + game log)
**Risk Tier:** MEDIUM (scoring input: removes unearned Attack / Recruit from 12 cards)
**Lane:** Standard (two-session). One new optional `G` field, four new on-play conditions, one new wait-and-see condition, six marker arms, card data.

> Baseline: reconciled on `origin/main` `b93e6d6ca` (#3414). Every line anchor below was read there.

---

## Goal

As a player, I want every hero card whose text reads "If <condition>, you get +N Attack/Recruit" to pay out only when the condition is true, so a match plays the way the cards read and a score is not inflated by bonuses nobody earned. Today these 12 lines ignore their condition and grant the bonus on every play.

| Card (set / hero / card #line) | Printed line (verbatim, `data/cards/<set>.json`) | Today | After |
|---|---|---|---|
| `msis/wanda-vision/rage#0` (face B of the Grief/Rage split card) | `If a Hero was put into the KO pile this turn you get +2[icon:attack].` | +2 every play | +2 once a Hero has entered the KO pile this turn; played before that, it waits for the rest of the turn |
| `vill/dr-octopus/eighth-times-a-charm#0` | `If this is the eighth card you played this turn, you get +2[icon:attack].` | +2 every play | +2 only as the 8th card played |
| `anni/fantastic-four-united/invisible-woman#0` | `If you played any other cards that cost 4 this turn, you get +2[icon:recruit].` | +2 Recruit every play | +2 only after another 4-cost card was played |
| `ff04/invisible-woman/four-of-a-kind#0` | `If you played any other cards that cost 4 this turn, you get +2[icon:attack].` | +2 every play | same gate |
| `vnom/venomized-dr-strange/complete-the-grand-ritual#0` | `If you played a 4-cost card and a 2-cost card this turn, you get +2[icon:attack].` | +2 every play | +2 only after both a 4-cost and a 2-cost play |
| `asrd/warriors-three-the/three-stand-as-one#0` | `If you played at least three other non-grey Heroes with different card names this turn, you get +3[icon:attack].` | +3 every play | +3 only after three other non-grey Heroes with three different names |
| `co2e/hawkeye/trick-arrow#0` | `If you drew any cards this turn, you get +2[icon:attack].` | +2 every play | +2 once a card has been drawn this turn (waits) |
| `dkcy/wolverine/sudden-ambush#0` | `If you drew any extra cards this turn, you get +2[icon:attack].` | +2 every play | same |
| `rvlt/captain-marvel-agent-of-shield/radiant-blast#0` | `If you drew any extra cards this turn, you get +1[icon:attack].` | +1 every play | same |
| `mgtg/gamora/guardians-escape#0` | `If you drew at least two cards this turn, you get +2[icon:attack].` | +2 every play | +2 once two cards have been drawn (waits) |
| `co2e/black-widow/covert-operation#0` | `If you have at least 4 Bystanders in your Victory Pile, you get +2[icon:attack].` | +2 every play | +2 only with 4+ Bystanders there at play |
| `wtif/apocalyptic-black-widow/humanitys-final-hope#0` | `If you have at least 4 Bystanders in your Victory Pile, you get +2[icon:recruit].` | +2 Recruit every play | same |

---

## User-Visible Impact

- The 12 lines above stop granting their bonus when the condition is false. The log shows the existing `[blocked]` line with the failed-condition reason (§Locked Values: describe text) instead of `+N from <card>`.
- Rage and the four draw lines get the same wait-and-see window as Spring the Trap / Gamma-Draining Nanites: played early, they log that they are waiting, and fire once when the event lands later that turn.
- Matches with these cards score lower when the condition was not met, because the bonus was never earned.

---

## Assumes

All verified at `b93e6d6ca`.

1. **All 12 lines are free grants today.** A probe ran `buildHeroAbilityHooks` on each line's hero deck from the committed `data/cards/<set>.json` (one-set registry reader, the `firstCardPlayed.test.ts` pattern). Each in-scope line's hook has effects and **no** `conditions` (e.g. `msis/wanda-vision/rage#` → `{"effects":[{"type":"attack","magnitude":2}]}`; `asrd/warriors-three-the/three-stand-as-one#` hook 0 → `attack:3`, no conditions). No line carries a `[keyword:…]` marker.
2. **The five dropped lines are gated** (same probe): First Strike and Follow My Lead line 1 → `firstHeroPlayedThisTurn`; KGB Training → `playedThisTurn:8`, Repulsor Rays → `:9`, Human Cannon → `:7`.
3. **`playedCardIdsThisTurn(G, inPlay)`** (`hero/splitCard.logic.ts:227-262`) returns a fresh array of the active player's played cards: `playedCardIdsStillInPlay` (Penumbra both-sides → two face ids) plus `sidekicksReturnedThisTurn` × `SIDEKICK_EXT_ID`, `outOfTimePlayedCardIds` and `ritualUsedPlayedCardIds` (de-duplicated). It is active-player-scoped, which every hero condition is. `applyCardPlay` (`moves/coreMoves.impl.ts`) appends the played card to `inPlay` before `executeHeroEffects`, so the playing card is in the view when its own conditions read it (D-24746 §2). A card removed from play mid-turn by a KO, transform or villain effect is not in the view (D-24798 §5 accepted residual).
4. **In-play card data.** `playedThisTurn` / `firstHeroPlayedThisTurn` read the view; `countDistinctHeroCostsInHandOrPlay` (`heroConditions.evaluate.ts:878`) reads `G.cardStats[id]?.cost` for in-play cards; `distinctHeroClassesAtLeast` reads `G.cardTraits[id]` `heroClass` / `heroClass2` (S.H.I.E.L.D. and Sidekick tokens have no class). In play, a split card is the face it was played as (its `inPlay` entry is relabeled to the face id by `resolveSplitFaceChoice`), so the raw maps keyed by the view's ids are the right reads. Display names are `G.cardDisplayData[id]?.name` (setup-static, `resolveCardName` in `log/logDisplay.ts:29`).
5. **The KO pile is append-only.** `G.ko` is written only by `G.ko = koCard(G.ko, id)` (36 sites) and three `moveCardFromZone(<zone>, G.ko, id)` appends (`moves/operatorSetters.ts:272`, `rules/tacticHandlers.ts:993`, `villain/villainEffects.execute.ts:1493`). No site removes from it. So "a card entered the KO pile this turn" is exactly "its index ≥ the KO pile's length at turn start".
6. **A "Hero" in the KO pile** is a card with a `G.cardTraits` entry (every hero-deck card) or one of the basic tokens `SHIELD_AGENT_EXT_ID`, `SHIELD_TROOPER_EXT_ID`, `SHIELD_OFFICER_EXT_ID`, `SIDEKICK_EXT_ID` (`setup/pilesInit.ts:28-43`). Wounds, Bystanders, Villains and Henchmen have neither.
7. **Rage is face B of a split card.** `msis` `wanda-vision` `physicalCards` `p1` has `sides: ["grief", "rage"]`, count 2. Its hook resolves under the face-B id after `resolveSplitFaceChoice`. Rage's condition reads the KO pile, not play history.
8. **Reused conditions.**
   - `cardsDrawnThisTurnAtLeast` (WP-665 / D-24476) reads `G.turnEconomy.cardsDrawn`, is in `WAIT_AND_SEE_CONDITION_TYPES`, and `[keyword:draw-threshold:N]` already produces it (`heroAbility.setup.ts:2004`). The counter increments at every hand-draw site (Assumes reconciled; `grep "cardsDrawn +="` lists 20 sites in `hero/`, `moves/`, `rules/`, `villain/`); the end-of-turn new-hand draw is not counted, which is right for "this turn".
   - `bystandersInVictoryAtLeast` (WP-653 / D-24464, Savior) is on-play; the Savior arm pushes it with the literal value `'3'` (`heroAbility.setup.ts:2049-2052`); the evaluator (`heroConditions.evaluate.ts:409`) parses any `N`.
9. **Marker plumbing** (the WP-777 `discard-threshold` template): the parser arm in `parseAbilityText` (`heroAbility.setup.ts:2019`), `HERO_PARSER_RECOGNIZED_MARKER_NAMES` (`:426-450`), the apply script's per-token `// why:` + `VALID_TOKEN_PATTERN` (`scripts/convert-cards/apply-hero-ability-markers.mjs:118-160`) and its error-message token list (`:378`), the ledger's marker→condition map (`scripts/hero-mechanic-ledger.mjs:200-225`), and `scripts/coverage/mechanic-provenance.json`. The apply script handles several tokens on one line (WP-667) and writes `co2e.json` (which `cards:check` excludes).
10. **Turn-start sites.** `game.ts` play-phase `turn.onBegin` holds the WP-743 guarded deletes (`:1077-1085`) after `clearDeferredConditionalGrants` (`:1028`); `simulation/onBeginParity.ts` `applyOnBeginParity` mirrors them (`:125-136`) for the simulation runner, PAR aggregator and fixture runner. `onBegin` runs before any move of the turn, including `revealVillainCard`.
11. **Hash oracles** contain no in-scope card: sentinel `sentinel-core-doom-2p` plays `core/black-widow` + `core/captain-america`; `PRE_WP080_HASH` uses `test/test-hero-deck-00{1,2}`. A field written only when a hook reads its condition leaves both byte-unchanged (D-24467 / D-24566 posture).
12. **No test pins an in-scope card id** (grep of `packages/`, `apps/`, `scripts/` for the 12 card slugs finds only same-slug **core** cards such as `core/black-widow/covert-operation`).
13. **No typecheck gate on engine tests** (D-24372). Drift pins are runtime assertions.

If any is false, this packet is **BLOCKED**: STOP and reconcile.

---

## Context (Read First)

- `docs/ai/DECISIONS.md`: D-24377 (wait-and-see; `[hc:X]` class gates stay on-play), D-24467 (event gate + gated lazy field), D-24476 (`draw-threshold`), D-24464 (Savior), D-24566 (WP-743 turn flags), D-24616 (`discard-threshold`, `matchReadsConditionType`), D-24746 and D-24798 (the same family, already gated; the played-view residual), D-24619 / D-24692 (what the played view counts), D-24372.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 (Ability Text Markup Language): the new `[keyword:…]` tokens use the §5.1 token form.
- Source: `hero/heroConditions.evaluate.ts` (`evaluateCondition` L210, `describeFailedCondition` L1016, `SEQUENCE_GATE_CONDITION_TYPES` L1189), `hero/deferredConditionalGrants.ts` (`WAIT_AND_SEE_CONDITION_TYPES` L79), `hero/splitCard.logic.ts` (`playedCardIdsThisTurn`), `setup/heroAbility.setup.ts` (L426, L2004-2032, L2049), `game.ts` (~L1028-1090), `simulation/onBeginParity.ts`, `hero/firstCardPlayed.test.ts` and `hero/playedOtherCardsThreshold.test.ts` (test precedent), `hero/masterStrikeOrAmbushCondition.test.ts` (WP-743 turn-flag tests).

**Why play-history gates evaluate on play.** D-24377 gave the whole-turn window to numeric accumulators that play order cannot change: Recruit made, cards drawn, distinct classes. It kept `[hc:X]` class gates on-play because their point is play order. "Eighth card", "another 4-cost card", "a 4-cost and a 2-cost card" and "three other non-grey Heroes" all ask what was played **before** this card, and D-24746 / D-24798 already read "at least N other cards" and "first card" on play. Under a whole-turn window, Dr. Octopus would pay out played first. So the four new play-history conditions stay **on-play**. D-24377 §1 states its boundary as "is it a numeric threshold", and all four take a number (an ordinal, a cost or a count), so D-24568 §1 **amends D-24377 §1**: the seam becomes "a numeric threshold that play order cannot manufacture". It also names `playedThisTurn` and `firstHeroPlayedThisTurn` as members of the same on-play group, which they already are.

**Why Rage and the draw lines wait.** "A Hero was put into the KO pile this turn" is a sticky, monotonic event: once true it stays true for the turn, and play order cannot manufacture it. That is the D-24566 shape #1 (one-shot). The draw lines reuse `cardsDrawnThisTurnAtLeast`, already a wait-and-see member.

**Why Bystanders-in-VP stays on-play.** "If you **have** at least 4 Bystanders" is a present-state check, not a "this turn" clause. It reuses Savior's on-play `bystandersInVictoryAtLeast`.

**Why a KO-pile snapshot for Rage, not flags at every KO site.** The KO pile is append-only (Assumes 5), so its length when the turn began answers "did a Hero enter it this turn" by scanning the tail. Flags would need 39 write sites. WP-853 / WP-856's `recordOwnedCardKoed` covers only the 25 owned-card sites, consumes per resolve and is per-owner; Rage counts any Hero from anywhere (HQ, other players), so it cannot reuse that counter.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full English words, `is`/`has`/`can` booleans, JSDoc on every function, `// why:` on non-obvious choices, no `.reduce()` with branching.
- Determinism: no `Math.random()` or wall-clock. Moves never throw. The evaluator never throws: an absent field or unparseable value reads `false`.
- Error messages are full sentences.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and ask.

**Packet-specific:**
- **One new `G` field, one write site pair.** `G.koPileLengthAtTurnStart` is written only in the play-phase `turn.onBegin` and in `applyOnBeginParity`, and only when `matchReadsConditionType(G, HERO_KOED_THIS_TURN_CONDITION_TYPE)`. Otherwise it is absent. No other write anywhere. The sentinel `finalStateHash` and `PRE_WP080_HASH` stay byte-unchanged; a moved oracle is a gating bug, never a re-pin.
- **Play-history conditions read `playedCardIdsThisTurn(G, playerZones.inPlay)`**, never raw `inPlay` and never a new history. No `coreMoves.impl.ts` change.
- **Play-history conditions stay on-play.** Only `heroPutIntoKoPileThisTurn` joins `WAIT_AND_SEE_CONDITION_TYPES`. `SEQUENCE_GATE_CONDITION_TYPES` is unchanged.
- **`firstHeroPlayedThisTurn`, `playedThisTurn` and `bystandersInVictoryAtLeast` are unchanged** (evaluator case, describe text, existing arms, the D-24746 text arm).
- **Card data is regenerated, never hand-edited:** the curated map plus `apply-hero-ability-markers.mjs`, co2e included.
- **Drift pins are runtime assertions** (D-24372). Never `any`, `@ts-ignore`, or a loosened type.
- **No new move, no `onMove` change, no UIState field, no client change.** The new tokens are lowercase-hyphenated (`:N`-segmented or bare), which the shape test hides from players (`isEngineOnlyKeyword` / `ENGINE_EFFECT_MARKER_SHAPE`, D-24496); no raw marker reaches a player.
- **Card-name identity** (Warriors Three) reads `G.cardDisplayData[id]?.name`, falling back to the id with its `#<copy>` suffix removed. It never reads a UIState projection. D-24568 §5 records this first rules read of that snapshot.

---

## Locked Values

**Condition types** (exported constants in `hero/heroConditions.evaluate.ts`):

| Constant | Type string | Timing | Marker |
|---|---|---|---|
| `CARD_PLAY_ORDINAL_CONDITION_TYPE` | `'cardPlayOrdinalEquals'` | on-play | `[keyword:card-play-ordinal:N]` |
| `OTHER_CARD_OF_COST_PLAYED_CONDITION_TYPE` | `'otherCardOfCostPlayedThisTurn'` | on-play | `[keyword:played-other-cost:N]` |
| `CARD_OF_COST_PLAYED_CONDITION_TYPE` | `'cardOfCostPlayedThisTurn'` | on-play | `[keyword:played-cost:N]` (twice on one line) |
| `OTHER_DISTINCT_HEROES_PLAYED_CONDITION_TYPE` | `'otherDistinctNonGreyHeroesPlayedThisTurnAtLeast'` | on-play | `[keyword:played-other-distinct-heroes:N]` |
| `HERO_KOED_THIS_TURN_CONDITION_TYPE` | `'heroPutIntoKoPileThisTurn'` | wait-and-see (shape #1) | `[keyword:hero-koed-this-turn]` (bare; pushes `value: '1'`, unused) |
| — (Savior's literal) | `'bystandersInVictoryAtLeast'` | on-play | `[keyword:bystanders-threshold:N]` |
| — (existing) | `'cardsDrawnThisTurnAtLeast'` | wait-and-see | `[keyword:draw-threshold:N]` (no parser change) |

`PLAY_HISTORY_CONDITION_TYPES: readonly string[]` = the four new on-play types, in table order.

**Evaluate** (`played` = `playedCardIdsThisTurn(G, playerZones.inPlay)`; `N` = `parseInt(condition.value, 10)`, `NaN` → `false`; "other" = entries `!== triggeringCardId`):
- `cardPlayOrdinalEquals` → `played.length === N`
- `otherCardOfCostPlayedThisTurn` → some other entry has `G.cardStats?.[id]?.cost === N`
- `cardOfCostPlayedThisTurn` → some entry (self included) has `G.cardStats?.[id]?.cost === N`
- `otherDistinctNonGreyHeroesPlayedThisTurnAtLeast` → the number of distinct names among other entries whose `G.cardTraits?.[id]` has a non-empty string `heroClass` or `heroClass2` is `>= N`; name = `G.cardDisplayData?.[id]?.name`, else the id without its `#<copy>` suffix
- `heroPutIntoKoPileThisTurn` → `start = G.koPileLengthAtTurnStart`; absent → `false`; else true iff some `G.ko[i]`, `i >= start`, satisfies `isHeroCardId(G, id)` (a `G.cardTraits` entry, or one of the four basic token ids)

Each case body lives in a named module-local helper with JSDoc (the `countDistinctHeroCostsInHandOrPlay` precedent), so `evaluateCondition` gains one-line `case` arms only.

**Describe text** (`describeFailedCondition`, verbatim; `${…}` interpolated):
- `cardPlayOrdinalEquals` → `it needs to be card number ${value} you played this turn — it was card number ${played.length}`
- `otherCardOfCostPlayedThisTurn` → `it needs another card costing ${value} played this turn`
- `cardOfCostPlayedThisTurn` → `it needs a card costing ${value} played this turn`
- `otherDistinctNonGreyHeroesPlayedThisTurnAtLeast` → `it needs ${value} other non-grey Heroes with different names played this turn`
- `heroPutIntoKoPileThisTurn` → `it needs a Hero put into the KO pile this turn`

The "other" strings carry no running count: `describeFailedCondition(G, playerID, condition)` takes no `triggeringCardId` (`heroConditions.evaluate.ts:1016`), and widening that export is out of scope.

**Apply entries** (`scripts/convert-cards/inputs/hero-ability-markers.json`; 13 entries on 12 lines):

| Set | heroSlug | cardSlug | abilityIndex | markupToken |
|---|---|---|---|---|
| msis | wanda-vision | rage | 0 | `[keyword:hero-koed-this-turn]` |
| vill | dr-octopus | eighth-times-a-charm | 0 | `[keyword:card-play-ordinal:8]` |
| anni | fantastic-four-united | invisible-woman | 0 | `[keyword:played-other-cost:4]` |
| ff04 | invisible-woman | four-of-a-kind | 0 | `[keyword:played-other-cost:4]` |
| vnom | venomized-dr-strange | complete-the-grand-ritual | 0 | `[keyword:played-cost:4]` |
| vnom | venomized-dr-strange | complete-the-grand-ritual | 0 | `[keyword:played-cost:2]` |
| asrd | warriors-three-the | three-stand-as-one | 0 | `[keyword:played-other-distinct-heroes:3]` |
| co2e | hawkeye | trick-arrow | 0 | `[keyword:draw-threshold:1]` |
| dkcy | wolverine | sudden-ambush | 0 | `[keyword:draw-threshold:1]` |
| rvlt | captain-marvel-agent-of-shield | radiant-blast | 0 | `[keyword:draw-threshold:1]` |
| mgtg | gamora | guardians-escape | 0 | `[keyword:draw-threshold:2]` |
| co2e | black-widow | covert-operation | 0 | `[keyword:bystanders-threshold:4]` |
| wtif | apocalyptic-black-widow | humanitys-final-hope | 0 | `[keyword:bystanders-threshold:4]` |

---

## Scope (In)

### A) `packages/game-engine/src/types.ts` (**modified**)
`LegendaryGameState` gains `koPileLengthAtTurnStart?: number` with a `// why:` (WP-745 / D-24568): `G.ko.length` when the current turn began; written only when a hook reads `heroPutIntoKoPileThisTurn`; overwritten every turn start; exact because the KO pile is append-only.

### B) `packages/game-engine/src/hero/heroConditions.evaluate.ts` (**modified**)
- The five constants and `PLAY_HISTORY_CONDITION_TYPES` (§Locked Values), each with a `// why:`; the array's `// why:` names D-24568 §1 (play-order gates, amends D-24377 §1).
- Five `evaluateCondition` case arms delegating to named helpers (one of them `isHeroCardId(G, id)`; its `// why:` names the 30-line function rule), and five `describeFailedCondition` cases. The `default` fallback stays.
- Imports `playedCardIdsThisTurn` (already imported) and the four basic token ids from `setup/pilesInit.js`.

### C) `packages/game-engine/src/hero/deferredConditionalGrants.ts` (**modified**)
- Append `HERO_KOED_THIS_TURN_CONDITION_TYPE` to `WAIT_AND_SEE_CONDITION_TYPES` with a `// why:`: a sticky per-turn event is a count ≥ 1 threshold (D-24566 shape #1, one-shot).
- Extend the module doctrine comment by one sentence each: shape #1 names Rage's event; the play-history types are deliberately **not** members (play-order gates, D-24568 §1).

### D) `packages/game-engine/src/setup/heroAbility.setup.ts` (**modified**)
- Six new parser arms in `parseAbilityText`, beside the `discard-threshold` arm and before the unresolved-marker fallback, each with a `// why:` citing WP-745 / D-24568 and its on-play / wait-and-see timing. Five push `{ type: <EXPORTED_CONSTANT>, value }` (never a literal); `bystanders-threshold` pushes Savior's `'bystandersInVictoryAtLeast'` literal (the Savior arm's literal, and the `discard-threshold` arm's literal-with-comment precedent). A parameterized arm whose `:N` capture is absent pushes nothing (the `recruit-threshold` guard). `played-cost` may fire twice on one line and pushes one condition each time.
- `HERO_PARSER_RECOGNIZED_MARKER_NAMES` gains the six names (`card-play-ordinal`, `played-other-cost`, `played-cost`, `played-other-distinct-heroes`, `hero-koed-this-turn`, `bystanders-threshold`), one `// why:` for the group.
- The line's printed `+N[icon:…]` grant stays on the same hook (the unchanged Step 2b icon read).

### E) `packages/game-engine/src/game.ts` + `packages/game-engine/src/simulation/onBeginParity.ts` (**modified**)
In the play-phase `turn.onBegin`, beside the WP-743 deletes, add with a `// why:`:
`if (matchReadsConditionType(G, HERO_KOED_THIS_TURN_CONDITION_TYPE)) { G.koPileLengthAtTurnStart = G.ko.length; }`
`applyOnBeginParity` gets the same statement with a `// why:` naming the `game.ts` mirror (the rebuilt loops never run `onBegin`; without it the snapshot stays at game start and every later-turn KO counts as "this turn"), and its module / function JSDoc lists the new field. `onBegin` runs before any move, so a KO during that turn's villain reveal counts as this turn.

### F) Card data + scripts (**modified**; regenerated)
- `scripts/convert-cards/inputs/hero-ability-markers.json`: the 13 entries in §Locked Values.
- `scripts/convert-cards/apply-hero-ability-markers.mjs`: the six new token forms in `VALID_TOKEN_PATTERN` (`hero-koed-this-turn` bare; the other five `:[1-9]\d*`), one house `// why:` per token, and the error-message token list.
- `scripts/hero-mechanic-ledger.mjs`: six marker→condition entries in the map.
- `scripts/coverage/mechanic-provenance.json`: six rows `{ "wp": "WP-745", "decision": "D-24568" }`.
- `data/cards/{msis,vill,anni,ff04,vnom,asrd,co2e,dkcy,rvlt,mgtg,wtif}.json` (11 files) regenerated by apply mode: exactly the 12 ability lines change.

### G) Derived artifacts (**regenerated** by their sanctioned commands; run every `:check` even with no diff)
Order: `ledger:heroes` → `effect-index` → `mechanics:metadata` → `sim:runtime-observed` (the two middle feeds read the committed hero ledger, `build-effect-implementation-index.mjs:56`, `build-card-mechanics-metadata.mjs:51`).
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`: certain (new marker slugs).
- `docs/ai/coverage/runtime-observed-hollows.json`: regenerate; commit only if `sim:runtime-observed:check` fails.
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` L753-755: re-pin `totalObs` / `resolvedObs` / `percentResolved` to the measured values **only if** the regenerated feed moves them, with a `// why:` line in the house format and a `Tests-changed:` trailer (the documented feed-regen pairing, not a weakened test).
- `scripts/coverage/hero-effect-coverage.baseline.json`: `sim:coverage --update-baseline` only if `sim:coverage --check` exits non-zero.
- `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json`: certain. It embeds every set's hero ability text (it already holds all 12 lines), so `node scripts/build-local-spike-bundle.mjs` regenerates it and `--check` then exits 0. Its `initialStateHash` may move only if a featured-setup hook gains a condition; record the before / after hash in the commit body either way.
- Each diff touches only the in-scope cards and tokens.

### H) Tests (**new / modified**)
**New `packages/game-engine/src/hero/unmarkedConditionalGrants.test.ts`** (`node:test`; no boardgame.io import), covering at least:
1. **Parse** (from the committed `data/cards` JSON, the `firstCardPlayed.test.ts` reader; never literals; co2e included): each of the 12 lines' hook carries its condition beside the unchanged grant and no `unresolvedMarkers` entry; Dr. Strange carries **two** `cardOfCostPlayedThisTurn` conditions (`'4'`, `'2'`); the two Black Widow lines carry `bystandersInVictoryAtLeast:'4'`.
2. **Ordinal** (Dr. Octopus through `applyCardPlay`): 8th play → +2; 7th and 9th → none.
3. **Cost.** Invisible Woman (ff04) after another 4-cost play → +2; when the only 4-cost card played is herself → none; a second Invisible Woman copy (a different `#N`) counts as the other. Dr. Strange after a 4-cost and a 2-cost → +2; after only a 4-cost → none. A 4-cost card that went Out of Time this turn (in `outOfTimePlayedCardIds`) still counts (the shared view).
4. **Distinct Heroes** (Warriors Three): three other non-grey, differently named Heroes → +3; two copies of one card count once; a S.H.I.E.L.D. Agent does not count; Warriors Three itself does not count.
5. **Rage**, driven the real way: `playCard` on a Grief/Rage card, then `resolveSplitFaceChoice` face `'b'` (never `applyCardPlay` on a Rage id).
   - A Hero KO'd earlier this turn → +2 on play.
   - Only a Wound or Bystander KO'd → none, and a deferred grant is recorded.
   - Rage played first, then a Hero KO'd → the deferred grant fires **once** on the next resolution; a second KO does not grant again.
   - A Hero KO'd before the turn-start snapshot → none.
6. **Reused conditions.** Hawkeye with no draw → none, deferred; after a draw → the deferred grant fires. Gamora needs 2. Black Widow (co2e) with 4 Bystanders in VP → +2; with 3 → none and no deferral recorded.
7. **Oracle safety.** With no Rage hook, `koPileLengthAtTurnStart` never appears on `G` after `turn.onBegin` and `applyOnBeginParity`.
8. **Turn reset.** The real `LegendaryGame` play-phase `turn.onBegin` (the `game.test.ts` pattern, never a hand-written assignment) sets `koPileLengthAtTurnStart` to `G.ko.length` when a Rage hook exists; `applyOnBeginParity` does the same.

**`hero/deferredConditionalGrants.test.ts`** (modified, certain): the keyset `deepEqual` and `TRUTHY_FIXTURE` gain `heroPutIntoKoPileThisTurn` (value-only; the fixture `G` has `koPileLengthAtTurnStart: 0` and one hero-deck card in `G.ko`).
**`hero/heroConditions.evaluate.test.ts`** (modified, certain): a runtime drift pin: every `PLAY_HISTORY_CONDITION_TYPES` member has an `evaluateCondition` case (a truthy fixture) and a non-default `describeFailedCondition` string; the set is disjoint from `WAIT_AND_SEE_CONDITION_TYPES` and `SEQUENCE_GATE_CONDITION_TYPES`.
**`rules/heroAbility.setup.test.ts` / `setup/heroAbility.setup.test.ts`**: modified **only if** an existing runtime pin enumerates `HERO_PARSER_RECOGNIZED_MARKER_NAMES` or the wait-and-see set (value-only extension). The existing `SEQUENCE_GATE_CONDITION_TYPES` disjointness pin stays green unchanged.

---

## Out of Scope

- **The five already-gated lines** (§Reconciliation). Not touched.
- **A. Board / collection-state predicates** (one future WP; new on-play conditions): `mgtg/drax/xandar-is-invincible#0`, `mgtg/rocket-groot/tricky#0`, `msis/black-panther/avengers-reassembled#0`, `co2e/nick-fury/weapon-bank#0`, `cvwr/speedball/bounce-around#0`, `bkpt/white-wolf/secret-assignment#1`; `asrd/lady-sif/weapons-master#0` needs the Artifact mechanic.
- **B. Most-recent-Hero icon branch:** `rvlt/darkhawk/travel-to-nullspace#0`, `ssw1/proxima-midnight/master-combatant#0`.
- **C. Discard event:** done by WP-777 / D-24616.
- **D. Draw counting:** done (Assumes 8).
- **E. Cards KO'd out of play still count as "played this turn"** (rules v23 L3441-3453). The shared view drops them; the fix is one more ledger inside `playedCardIdsThisTurn`, which fixes `playedThisTurn`, `firstHeroPlayedThisTurn` and this WP's four conditions together. D-24798 §5 already accepts the residual; this WP inherits it.
- **Copy Powers / Steal Abilities copying an in-scope line.** "Other" and the ordinal follow `triggeringCardId`, as every existing condition does.
- **The other Sweep Ledger families** (optional cost, reveal-branch, Patrol, Focus, Tactical Formation, guess, KO-Wound-or-gain, Shards, Artifacts, Endgame, Galactus): each is its own mechanic.
- No UIState field, no client change, no bot-valuation change, no new move. Refactors not listed in Scope (In).

---

## Files Expected to Change

- `packages/game-engine/src/types.ts` — **modified** — one optional lazy field
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — 5 constants, `PLAY_HISTORY_CONDITION_TYPES`, helpers, 5 evaluate + 5 describe cases
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` — **modified** — one wait-and-see member + doctrine sentences
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — six marker arms + six recognized names
- `packages/game-engine/src/game.ts` — **modified** — `onBegin` snapshot
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — the mirror + JSDoc
- `packages/game-engine/src/hero/unmarkedConditionalGrants.test.ts` — **new**
- `packages/game-engine/src/hero/deferredConditionalGrants.test.ts` — **modified** — keyset + truthy fixture
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified** — drift pin
- `packages/game-engine/src/rules/heroAbility.setup.test.ts`, `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified only if** an existing pin enumerates an extended set
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json` — **modified**
- `data/cards/{msis,vill,anni,ff04,vnom,asrd,co2e,dkcy,rvlt,mgtg,wtif}.json` — **modified** — regenerated (12 lines, 11 files)
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json` — **modified** — regenerated
- `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` — **modified** — regenerated (certain)
- `docs/ai/coverage/runtime-observed-hollows.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts`, `scripts/coverage/hero-effect-coverage.baseline.json` — **modified only if** their `:check` fails after the regen (the dashboard re-pin carries a `Tests-changed:` trailer)

No other file in the `EC-782:` commit. The governance close `SPEC:` commit (same PR) edits DECISIONS (D-24568 Active), STATUS, WORK_INDEX (`[x]` + `[live-verify: pending]`), EC_INDEX, NUMBER-LEDGER (LANDED), the mindmap + `roadmap:counts:write`, `docs/ai/coverage/live-verify.json` (one `pending` entry per new hero mechanic row) and `docs/ai/post-mortems/01.6-WP-745-unmarked-conditional-icon-grants.md`.

---

## Contract

- **`LegendaryGameState.koPileLengthAtTurnStart?: number`**: `G.ko.length` at turn start; present only when a hook reads `heroPutIntoKoPileThisTurn`.
- **Conditions** as in §Locked Values: four on-play play-history conditions over `playedCardIdsThisTurn`; `heroPutIntoKoPileThisTurn` whole-turn wait-and-see, shape #1 one-shot.
- **Markers:** parameterized `card-play-ordinal:N`, `played-other-cost:N`, `played-cost:N`, `played-other-distinct-heroes:N`, `bystanders-threshold:N`; bare `hero-koed-this-turn`.
- **`isHeroCardId(G, id)`** is a module-local pure read.
- **Hash oracles** unchanged.

---

## Vision Alignment

- **Vision clauses touched:** §1 (rules authenticity), §2 (card semantics), §3 (no hidden modifiers: 12 unearned bonuses removed), §8 / §22 / §26 (deterministic engine; feeds regenerate through sanctioned commands). NG-1 untouched.
- **Conflict assertion:** No conflict. The change removes unearned bonuses that inflate scores and restores the play-order skill several cards reward.
- **Non-Goal proximity:** NG-1..8 not crossed.
- **Determinism:** the snapshot is written at deterministic turn-start sites from deterministic inputs; the play-history reads are pure. Hash oracles unchanged by construction.
- **Upgrade / replay story.** No migration. `G.heroAbilityHooks` is built once at setup and travels in `initialState`, so a match in flight at deploy keeps its old, condition-free hooks until it ends, and no hook in it reads the new field. A D-24119 reduction of a stored blob reproduces the original match. Only a replay that re-runs setup from the configuration builds the new hooks and may diverge (the D-24467 / D-24566 posture); competitive scores are verified at submit time. PAR profiles are unchanged (`HERO_POOL` is core-only).

## Funding Surface Gate

N/A — engine + card data only; no funding affordance, channel, or copy.

## API Catalog

N/A (§21). No `apps/server` endpoint or `Library-only` server function changes.

---

## Acceptance Criteria

All binary pass/fail.

1. All 12 in-scope hooks carry their condition (re-run the probe: 0 of them free, no `unresolvedMarkers` on them); the five already-gated hooks are byte-identical to baseline.
2. Dr. Octopus grants only as the exact 8th card played.
3. Invisible Woman does not count herself; Dr. Strange needs both a 4-cost and a 2-cost play.
4. Warriors Three counts distinct names of other non-grey Heroes only.
5. Rage grants only after a **Hero** entered the KO pile this turn; played before the KO, it fires once when the KO lands.
6. The four draw lines wait for the draw count; the two Black Widow lines need 4 Bystanders at play.
7. With no Rage hook, `koPileLengthAtTurnStart` never exists on `G`; the sentinel `finalStateHash` and `PRE_WP080_HASH` are byte-unchanged (no re-pin).
8. `cards:check` passes and an apply re-run is zero-diff (co2e included).
9. `pnpm -r build` exits 0; `pnpm -r --no-bail test` is 0 fail (per-package totals in the commit body); every coverage / ledger `:check` exits 0.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm -r --no-bail test
# Expected: exit 0; unmarkedConditionalGrants.test.ts passes; no sentinel / PRE_WP080 failure

node scripts/convert-cards/apply-hero-ability-markers.mjs
git diff --stat data/cards
# Expected (first run): 11 files changed, 12 insertions(+), 12 deletions(-); a re-run is zero-diff

pnpm cards:check; pnpm cards:count-markers:check; pnpm ledger:heroes:check; pnpm effect-index:check; pnpm mechanics:metadata:check
pnpm sim:coverage --check; pnpm sim:runtime-observed:check
node scripts/build-local-spike-bundle.mjs --check
# Expected: all exit 0 (after the Scope G regens and any paired re-pin)

Select-String -Path "packages\game-engine\src\**\*.ts" -Pattern "koPileLengthAtTurnStart =" 
# Expected: exactly two matches (game.ts, simulation/onBeginParity.ts)

git diff --name-only
# Expected (implementation commit): within ## Files Expected to Change
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] All acceptance criteria pass.
- [ ] No files outside `## Files Expected to Change` in the `EC-782:` commit.
- [ ] `docs/ai/DECISIONS.md`: D-24568 Active; NUMBER-LEDGER row LANDED.
- [ ] `docs/ai/STATUS.md` entry; `WORK_INDEX.md` WP-745 `[x]` ending `[live-verify: pending]`; `EC_INDEX.md` EC-782 Done; `docs/05-ROADMAP-MINDMAP.md` node `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check`, `workindex:liveverify:check` exit 0.
- [ ] `docs/ai/coverage/live-verify.json`: one `pending` entry per new hero ledger mechanic row, `wp: "WP-745"`.
- [ ] 01.6 post-mortem committed.
- [ ] **Live verification (D-24026)** on play.legendary-arena.com after deploy, on an operator match created after the server boot: one card from each family (Rage; Dr. Octopus; Invisible Woman or Dr. Strange; Warriors Three; a draw line; a Black Widow line). The log shows `[blocked]` with the §Locked Values reason when the condition was false and the grant when it held (or the deferred grant firing later, for Rage and the draw lines). Recorded as its own `SPEC:` PR: live-verify.json entries `verified`, the WORK_INDEX token `[live-verify: verified]` with the date, D-24568 and STATUS amended.

---

## Reserved Decision (lands at execution)

- **D-24568 (reserved; Drafted 2026-09-22; reconciled 2026-11-16): unmarked "If <condition>, you get +N" lines are gated through marker→condition arms; play-history predicates read the shared played view on play.**
  1. **Play-history conditions** (`cardPlayOrdinalEquals`, `otherCardOfCostPlayedThisTurn`, `cardOfCostPlayedThisTurn`, `otherDistinctNonGreyHeroesPlayedThisTurnAtLeast`, with the shipped `playedThisTurn` and `firstHeroPlayedThisTurn`) are **play-order gates**: they evaluate on play and never join `WAIT_AND_SEE_CONDITION_TYPES`. **Amends D-24377 §1:** the wait-and-see seam is "a numeric threshold that play order cannot manufacture".
  2. **They read `playedCardIdsThisTurn`**, the one "cards you played this turn" view, not a second history and not raw `inPlay`. A card KO'd out of play mid-turn drops out of it (the D-24798 §5 residual), to be fixed once inside the view (Out of Scope E).
  3. **"A Hero was put into the KO pile this turn"** is a sticky event: wait-and-see, shape #1, one-shot. It reads a gated turn-start snapshot `G.koPileLengthAtTurnStart` over the append-only KO pile. A Hero is a `cardTraits` entry or a basic S.H.I.E.L.D. / Sidekick token.
  4. **Reuse over new conditions.** The draw lines reuse `cardsDrawnThisTurnAtLeast` (wait-and-see). The "have at least N Bystanders" lines reuse `bystandersInVictoryAtLeast` via `[keyword:bystanders-threshold:N]` (on-play, like Savior).
  5. **Card-name identity for a rules check** ("different card names") reads the setup-static `G.cardDisplayData[id].name`, falling back to the id without its `#copy` suffix; never a projection.
  6. **The new field is gated and lazy.** Games without a Rage hook are byte-unchanged.

---

## Sweep Ledger (appendix)

The 2026-09-22 probe covered 121 hero ability lines matching `/\bif\b[^.]*?you get \+\d+\[icon:(attack|recruit)\]/i`; 87 hooks had effects and no conditions. Disposition at `b93e6d6ca`:

| Disposition | Lines |
|---|---|
| **This WP (12)** | §Locked Values apply table |
| **Done since the draft (7)** | WP-743: `vnom/venom-rocket/spring-the-trap#0`, `msis/wanda-vision/grief#0`. WP-861 / D-24798: `dkcy/elektra/first-strike#0`, `amwp/wasp/follow-my-lead#1`. D-24746: `ca75/winter-soldier/kgb-training#0`, `co2e/iron-man/repulsor-rays#0`, `xmen/cannonball/human-cannon#1` |
| **Done since the draft: discard event (2)** | WP-777 / D-24616: `bkwd/falcon-winter-soldier/new-wings#0`, `vill/green-goblin/pumpkin-bombs#1` |
| **Follow-up A: board / collection state (7)** | `mgtg/drax/xandar-is-invincible#0`, `mgtg/rocket-groot/tricky#0`, `msis/black-panther/avengers-reassembled#0`, `asrd/lady-sif/weapons-master#0`\*, `co2e/nick-fury/weapon-bank#0`, `cvwr/speedball/bounce-around#0`, `bkpt/white-wolf/secret-assignment#1` |
| **Follow-up B: most-recent-Hero icon (2)** | `rvlt/darkhawk/travel-to-nullspace#0`, `ssw1/proxima-midnight/master-combatant#0` |
| **Other mechanic families (not conditions)** | optional cost ("You may X. If you do"), handler-backed reward keywords (D-24570 suppression shipped), reveal / discard-top branch, guess a card, KO-a-Wound-or-gain-one, Patrol, Focus / Tactical Formation, Shards / Artifacts / Endgame / Galactus — the draft's per-line list stands; several have shipped since under their own WPs |

\* needs the Artifact mechanic.

---

## Gate Record

Filled at the re-gate (2026-11-16): 01.4 pre-flight, 01.7 copilot, 00.3 lint, each by an independent subagent against `b93e6d6ca`.

## Lint Gate Self-Review (00.3)

Draft rounds (2026-09-22): R1 FAIL (numbering collision → renumbered via #2290; card count; `playFromUndercover` retired; grep form; describe counts; name source), R2 PASS, R3 PASS, final confirm PASS. Re-gate rounds: §Gate Record.

## Pre-Flight Verdict (01.4)

Draft: READY 2026-09-22 (r4), blocked on WP-743, which has since executed. Re-gate: §Gate Record.

## Copilot Check (01.7)

Draft: PASS r2 (30 modes) 2026-09-22. Re-gate: §Gate Record.

---

## See Also

- WP-743 / D-24566 — Spring the Trap / Grief (turn flags; sibling)
- WP-861 / D-24798, D-24746 — the already-gated first-card and N-other-cards lines
- WP-777 / D-24616 — `discard-threshold` (the marker template)
- WP-656 / D-24467, WP-568 / D-24377, WP-665 / D-24476, WP-653 / D-24464
