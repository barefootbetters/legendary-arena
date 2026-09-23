# WP-745 — Unmarked "If …, you get +N" grants: gate 17 free conditional cards on their printed condition (Engine + card data)

**Status:** Draft 2026-09-22 (EC-782; D-24568 reserved) — READY TO EXECUTE once WP-743 executes (pre-flight READY r4, copilot PASS r2, lint PASS r3 + confirm)
**Primary Layer:** Game Engine (`packages/game-engine/src/**`) + card data (`data/cards/*.json` via the curated hero-ability-marker map)
**Dependencies:** **WP-743 / D-24566 (hard, sequencing — spec merged #2286, not yet executed at draft time)**; WP-744 / D-24567 (soft, sequencing — sim turn-loop deferred-grant parity, drafted on `main` #2292 `b510d3c9`, unexecuted; touches `simulation/onBeginParity.ts` and the rebuilt loops); WP-568 / D-24377 ✅, WP-656 / D-24467 ✅, WP-665 / D-24476 ✅, WP-653 / D-24464 ✅, WP-681 / D-24498 ✅
**User-Visible Surface:** play.legendary-arena.com (the in-match economy + game log)
**Baseline:** `origin/main` @ `03c69f7d` (probe + scaffold run on `a0c1697f`; nothing between touches engine or card data). Renumbered from WP-744 / EC-781 / D-24567 after a reservation collision with #2287; reserve PR #2290.

---

## Goal

As a player, I want every hero card whose text reads "If <condition>, you get +N Attack/Recruit"
to pay out only when the condition is true, so a match plays the way the cards read. Today, 17
such cards (beyond WP-743's two) ignore their condition and grant the bonus on every play.

---

## User-Visible Impact

The bug class is the same one WP-743 fixes for Spring the Trap and Grief. The ability line has
no `[keyword:…]` marker, so the Step 2b icon-magnitude read in `setup/heroAbility.setup.ts` turns
`+N[icon:attack|recruit]` into an **unconditional** grant.

After this WP:

- **Rage** (`msis/wanda-vision/rage`) grants +2 Attack only if a Hero was put into the KO pile
  this turn. If none has been KO'd when you play it, it waits for the rest of the turn.
- **First card / eighth card** (Wasp's *Follow My Lead*, Elektra's *First Strike*, Dr. Octopus's
  *Eighth Time's a Charm*) grant only when the card is literally the 1st / 8th card played this
  turn.
- **"Played at least N other cards"** (Winter Soldier, co2e Iron Man, Cannonball), **"played
  another 4-cost card"** (both Invisible Woman cards), **"a 4-cost and a 2-cost card"**
  (Venomized Dr. Strange) and **"three other non-grey Heroes with different names"** (Warriors
  Three) grant only when that play history is true at the moment the card is played.
- **"If you drew any (extra) cards / at least two cards this turn"** (co2e Hawkeye, Wolverine,
  rvlt Captain Marvel, Gamora) grant only once the turn's effect draws reach the count. They get
  the same wait-and-see window as Gamma-Draining Nanites.
- **"If you have at least 4 Bystanders in your Victory Pile"** (co2e Black Widow, wtif
  Apocalyptic Black Widow) grant only with 4+ Bystanders there, the way Savior does.

---

## Assumes

All verified at baseline `a0c1697f` unless marked otherwise.

- **Every in-scope line is a free grant today.** A probe ran `buildHeroAbilityHooks` against
  every hero ability line in `data/cards/*.json` matching `/\bif\b[^.]*?you get \+\d+\[icon:(attack|recruit)\]/i`
  (121 lines). It built each line in isolation through a one-card synthetic set, using the real
  set/hero/card slugs so the per-card allowlists resolve. **87 hooks have effects and no
  `conditions`**; all 17 in-scope lines are among them, for example:
  - `msis/wanda-vision/rage#0` → `{"keywords":["attack"],"effects":[{"type":"attack","magnitude":2}]}`
  - `vill/dr-octopus/eighth-times-a-charm#0` → `{"keywords":["attack"],"effects":[{"type":"attack","magnitude":2}]}`

  The full disposition of all 87, plus the partially gated COND lines, is the **Sweep Ledger**
  appendix.
- **WP-743 lands first (hard dependency).** At draft time its spec is merged on `main` (PR #2286,
  identical to `d7df43ce`) but not executed. This WP reuses three things WP-743 adds:
  - `matchReadsConditionType(G, conditionType)` in `hero/heroConditions.evaluate.ts`
  - the gated-lazy-`G`-field pattern with guarded deletes in the play-phase turn `onBegin` and
    in `applyOnBeginParity`
  - its edits to the same lockstep sites (`types.ts`, `game.ts`, `onBeginParity.ts`,
    `deferredConditionalGrants.ts`, `heroAbility.setup.ts`, the apply-script allowlist, the
    ledger map)

  Executing before WP-743 would conflict on every one of those files. **If WP-743 has not landed
  on `main` when this WP opens, this WP is BLOCKED.** If WP-743 shipped the helper under a
  different name, use the shipped name and record it in the EC commit body.
- **WP-744 (sim turn-loop deferred-grant parity)** is drafted on `main` (#2292, `b510d3c9`) and
  unexecuted. It wires `resolveDeferredHeroGrants` / `clearDeferredConditionalGrants` into the
  rebuilt loops and edits `simulation/onBeginParity.ts` and the loop files. It is not a hard
  dependency, since neither WP reads the other's code. The two collide on the same dashboard
  pin: WP-744's scaffold moves `totalObs` 3012 → 3011, and this WP's moves it 3012 → 3013.
  Whichever lands second rebases onto the other's `applyOnBeginParity` edits, regenerates the
  feed, and re-pins from its own post-rebase measurement. WP-744's execution-order note names
  only WP-743; if WP-744 is still unexecuted at this WP's govern-close, that `SPEC:` commit
  amends WP-744's note to name WP-745.
- **`replay/replay.execute.ts` has no turn rotation**, so no parity call is needed there
  (D-24322; the WP-743 posture).
- **Existing conditions reused as-is** (`hero/heroConditions.evaluate.ts`):
  - `cardsDrawnThisTurnAtLeast` reads `G.turnEconomy.cardsDrawn` (WP-665 / D-24476). It is
    already in `WAIT_AND_SEE_CONDITION_TYPES`, and `[keyword:draw-threshold:N]` already parses to
    it. **`cardsDrawn` counts only the hero `draw:N` path** (`heroEffectDraw`,
    `hero/heroEffects.execute.ts:1366`). Other hand draws do not increment it:
    - Dodge (`moves/dodgeCard.ts:175`)
    - Do-Over (`moves/doOver.resolve.ts:131`)
    - tactic draws (`rules/tacticHandlers.ts:513`)
    - villain and rule draws (`villain/villainEffects.execute.ts:1689`,
      `rules/ruleRuntime.effects.ts:85`)
    - `heroEffects.execute.ts:2670` and `:4538`

    So the four draw lines under-grant when the only draw came from one of those. That is
    accepted here and named as Follow-up D.
  - `bystandersInVictoryAtLeast` (WP-653 / D-24464, Savior) is on-play and counts
    `BYSTANDER_EXT_ID` plus villain-deck Bystanders in the Victory Pile.
- **No play-ordinal primitive exists, and `inPlay` is not one.** `G` has no per-turn play count or
  play log (grep for `cardsPlayed|playsThisTurn`: none). `playerZones.inPlay` shrinks mid-turn:
  - self-KO (`heroEffectKo`, `hero/heroEffects.execute.ts:1442`)
  - KO-from-play choices (D-24442 `koHeroChoice`)
  - the villain KO-hero effect (`villain/villainEffects.execute.ts:2167`)
  - transform (`heroEffects.execute.ts:4724`)
  - deferred hand injection (`moves/deferredHandInjection.logic.ts:45`)

  So `inPlay.length` undercounts plays, and "no other card in `inPlay`" (the
  `firstHeroPlayedThisTurn` test) can be true for a 2nd or later card. The existing
  `playedThisTurn` condition (`inPlay.length >= N`, WP-023) has **no parser producer** today.
- **There are two play chokepoints**, both in `moves/coreMoves.impl.ts`:
  - `applyCardPlay` (L274–285): the `inPlay` append, before the card's effects run
    (`executeHeroEffects`, ~L320). Its single caller is `playCard` (~L555);
    `playFromUndercover` was retired by WP-678 / D-24494.
  - the split-card branch of `playCard` (~L542): the `inPlay` append before
    `parkSplitFaceChoice`
- **The KO pile is append-only.** `G.ko` is written only through `koCard(G.ko, id)` (24 callers),
  `heroCapture.logic.ts:192` (`push`) and `tacticHandlers.ts:735` (a `moveCardFromZone`
  append). A grep for `.ko = `, `splice`, `pop`, `shift` or `filter` on `ko` finds no removal.
  So "a card entered the KO pile this turn" is exactly "its index ≥ the KO pile's length at
  turn start".
- **Rage is face B of a split card.** In `msis` `physicalCards`, sides `['grief','rage']` (WP-724
  / D-24545). Its effects fire from `resolveSplitFaceChoice` (`splitFaceChoice.resolve.ts:222`)
  under the face-B id, while the play history holds the face-A id from the play. Rage's
  condition is not play-history, so this does not affect it. Grief (face A) is WP-743's.
- **"Hero" in the KO pile** has these representations:
  - hero-deck cards (HQ and player decks) carry a `G.cardTraits` entry (`setup/buildCardTraits.ts`)
  - basic S.H.I.E.L.D. and Sidekick tokens are `SHIELD_AGENT_EXT_ID`, `SHIELD_TROOPER_EXT_ID`,
    `SHIELD_OFFICER_EXT_ID` and `SIDEKICK_EXT_ID` (`setup/pilesInit.ts`)

  Wounds, Bystanders, Villains and Henchmen have neither.
- **Card cost and name** come from `G.cardStats[id].cost` and `G.cardDisplayData[id].name`. Both
  are built at setup and read-only.
- **Hook conditions AND together** (`evaluateAllConditions`, `heroConditions.evaluate.ts:406`).
  So two conditions on one hook both must hold.
- **Hash-safe lazy fields.** Neither hash oracle contains an in-scope card:
  - sentinel `sentinel-core-doom-2p`: `core/black-widow`, `core/captain-america`
  - `PRE_WP080_HASH`: `test/test-hero-deck-00{1,2}`

  So a field written only when a reading hook exists leaves both byte-unchanged (the D-24467 /
  WP-743 posture).
- **Marker plumbing is proven.** The curated map covers every in-scope set:
  `scripts/convert-cards/inputs/hero-ability-markers.json`, applied surgically and idempotently
  by `apply-hero-ability-markers.mjs`, which supports several tokens on one line (WP-667
  carry-forward, L377–384).
  - `cards:check` compares the 40 pipeline sets and **excludes co2e** (hand-authored,
    `check-card-data-regen.mjs`). The apply script still writes `co2e.json`.
- **No test pins an in-scope card.** A grep of `packages/`, `apps/` and `scripts/` for the 17
  slugs finds only same-slug **core** cards (e.g. `core/iron-man/repulsor-rays`,
  `core/black-widow/covert-operation`), which are different cards.
- **Draft-time scaffold (observed, not reasoned), 2026-09-22.** The four draw-threshold markers
  were applied on `a0c1697f`, then reverted:
  - the probe shows each hook gains `cardsDrawnThisTurnAtLeast`
  - `cards:check`, `effect-index:check` and `mechanics:metadata:check` exit 0 (the last two ran
    against the stale ledger they read; both drift once it is regenerated, see Scope H)
  - `ledger:heroes:check` and `sim:runtime-observed:check` go **stale** (main was green before)
  - `sim:runtime-observed` regen moves `totalObservations` 2528 → 2530
  - `useInPlayCoverage.test.ts` then fails `actual: 3013, expected: 3012`

  So the ledger, effect-index, mechanics-metadata and runtime-observed regens and the dashboard
  re-pin are **certain**, not conditional. Their final values are measured after the full change.
- **No typecheck gate on engine tests** (D-24372). Drift pins are runtime assertions.

If any is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md`:
  - D-24377 (whole-turn wait-and-see, numeric thresholds; `[hc:X]` class gates kept on-play
    to preserve play-order skill)
  - D-24467 (event gate plus gated lazy `G` field)
  - D-24476 (`draw-threshold`)
  - D-24464 (Savior `bystandersInVictoryAtLeast`)
  - D-24498 (`first-hero-condition`)
  - D-24372 (runtime drift pins)
  - D-24566 (WP-743, lands first)
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 (Ability Text Markup Language): the new
  `[keyword:…]` tokens use the §5.1 token form.
- `docs/ai/work-packets/WP-743-spring-the-trap-master-strike-or-ambush-condition.md`: the
  sibling WP. This one follows its shape.
- Source:
  - `hero/heroConditions.evaluate.ts` (`evaluateCondition`, `describeFailedCondition`,
    `SEQUENCE_GATE_CONDITION_TYPES`)
  - `hero/deferredConditionalGrants.ts`
  - `setup/heroAbility.setup.ts` ~L1225–1335 (marker arms, then the unresolved fallback)
  - `moves/coreMoves.impl.ts` L274–290 and ~L530–548
  - `game.ts` ~L798–818
  - `simulation/onBeginParity.ts`

**Why play-order gates evaluate on play (not wait-and-see).** D-24377 gave the whole-turn window
to numeric *accumulators*: recruit made, effect draws, distinct classes. Reordering hero plays
cannot change those totals. It kept `[hc:X]` class gates on-play because their whole point is
play order. "First card", "eighth card", "at least N **other** cards", "another 4-cost card", "a
4-cost and a 2-cost card" and "three other non-grey Heroes" all ask what was played **before**
this card. Playing Winter Soldier last is the skill the card rewards. Under a whole-turn window it
would pay out played first, and "first card" would lose its meaning. So all five play-history
conditions stay **on-play**, and none joins `WAIT_AND_SEE_CONDITION_TYPES`.

This is an amendment, not an extension. D-24377 §1 states its boundary as "is it a numeric
threshold", and all five of these conditions take a number (a count, a cost or an ordinal), so
that test would admit them. D-24568 §1 therefore **amends D-24377 §1**:
play-history predicates join the `[hc:X]`/team on-play exception, and the wait-and-see seam
becomes "a numeric threshold that play order cannot manufacture". Recruit made, effect draws,
distinct classes in play and Rage's KO event stay on the wait-and-see side.

**Why Rage and the draw lines get the window.** "A Hero was put into the KO pile this turn" is a
**sticky, monotonic** event predicate: once true it stays true for the turn, and play order
cannot manufacture it. That is the WP-743 / D-24566 shape #1 (one-shot). The draw lines reuse
`cardsDrawnThisTurnAtLeast`, which is already a wait-and-see member.

**Why Bystanders-in-VP stays on-play.** "If you **have** at least 4 Bystanders" is a present-state
check, not a "this turn" clause. It reuses Savior's `bystandersInVictoryAtLeast`, which is on-play
(D-24464). Parameterizing the threshold changes nothing about its timing.

**Why a play-history record, not a counter and not `inPlay`.**
- `inPlay` shrinks mid-turn (Assumes), so it is not a play ordinal.
- A bare counter answers "first" and "eighth" but not "another 4-cost card" or "different card
  names".
- A per-turn list of the `CardExtId`s played, in order, answers all five from one write site.

It holds `CardExtId` strings only (a history record, not a zone). It is written only when a
reading hook exists, and deleted at the turn boundary. This is the Deadpool
`first-hero-condition` distinction the brief flags. `firstHeroPlayedThisTurn` reads `inPlay`
presence ("no other Hero in play"), which is the right shape for its "first **Hero**" Do-Over
text. The new ordinal reads the play history ("the Nth **card** played"). The two are not
merged, and `firstHeroPlayedThisTurn` is unchanged.

**Why a KO-pile snapshot for Rage, not 26 flag writes.** The KO pile is append-only, so recording
its length when the turn begins answers "did a Hero enter it this turn" by scanning the tail. The
alternative is a flag at all 26 KO write sites (24 `koCard` callers + 2 direct), which would leave
26 places to forget. The snapshot is written only when a Rage-style hook exists.

**Why one WP, not four.** All 17 cards share one parse path (a marker arm before the unresolved
fallback) and one evaluator switch. The new state (two lazy fields) is written at one play
chokepoint file and one turn-start pair. That is 7 production files, one D-entry and one layer
plus card data. Splitting would triple the WP-743-style sequencing on the same hot files.

**Why the rest of the sweep is out.** Of the other 70 free hooks, 2 are WP-743's and 8 are
predicate gates that need new event or board state (Follow-ups A–C). The remaining 60 are
optional costs ("You may X. If you do"), reveal-then-branch, Patrol, Focus, Tactical Formation,
guess-a-card, KO-a-Wound-or-gain-one, Shards, Artifacts, Endgame and Galactus. Each is its own
mechanic family and needs a handler, not a condition (Sweep Ledger).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:`-prefixed imports.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`:
  - full English words
  - `is`/`has`/`can` booleans
  - JSDoc on every function
  - `// why:` on non-obvious choices
  - no `.reduce()` with branching
- Determinism: no `Math.random()` or wall-clock. Moves never throw. The evaluator never throws:
  an absent field reads `false`.
- Error messages are full sentences.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and ask.

**Packet-specific:**
- **Two write sites for the play history, one for the KO snapshot.**
  - `G.cardsPlayedThisTurn` is appended only in `moves/coreMoves.impl.ts`: `applyCardPlay`, right
    after the `inPlay` append, and the split-card branch of `playCard`, right after its `inPlay`
    append.
  - `G.koPileLengthAtTurnStart` is written only in the play-phase turn `onBegin` and in
    `applyOnBeginParity`.
  - No other writes anywhere.
- **Gated, lazy.** Each field is written only when `G.heroAbilityHooks` carries a condition that
  reads it:
  - play history: any `PLAY_HISTORY_CONDITION_TYPES` member
  - KO snapshot: `HERO_KOED_THIS_TURN_CONDITION_TYPE`

  Otherwise it is absent. The play history is deleted (guarded) at turn start. The sentinel
  `finalStateHash` and `PRE_WP080_HASH` stay **byte-unchanged**. No re-pin is permitted; a moved
  oracle means a gating bug.
- **Play-history conditions stay on-play.** Only `heroPutIntoKoPileThisTurn` joins
  `WAIT_AND_SEE_CONDITION_TYPES`. `SEQUENCE_GATE_CONDITION_TYPES` is unchanged.
- **`firstHeroPlayedThisTurn` and `playedThisTurn` are untouched** (behavior, evaluator case,
  marker).
- **Card data is regenerated, never hand-edited:** the curated map plus
  `apply-hero-ability-markers.mjs`. The same applies to `co2e.json`, even though `cards:check`
  excludes it.
- **Drift pins are runtime assertions** (D-24372). Never `any`, `@ts-ignore`, or a loosened type.
- **No new move, no new `onMove` resolve call, no UIState field, no client change.** No client
  change is safe because the new tokens are lowercase-hyphenated or `:N`-segmented, which
  `isEngineOnlyKeyword` (arena-client `abilityMarkers.ts`, registry-viewer `useRules.ts`, D-24496)
  already hides. No raw marker reaches a player.
- **`bystandersInVictoryAtLeast`'s evaluator and describe cases are unchanged.** Only a marker arm
  is added.
- **Card-name identity** (Warriors Three) reads the setup-static `G.cardDisplayData[id].name`
  snapshot, falling back to the id without `#copy`. It never reads a UIState projection. This is
  the first rules read of that snapshot, and D-24568 records it.

---

## Scope (In)

### A) `packages/game-engine/src/types.ts` (**modified**)
`LegendaryGameState` gains two optional fields, each with a `// why:` (WP-745 / D-24568):
- `cardsPlayedThisTurn?: CardExtId[]`: the `CardExtId`s the current player played this turn, in
  play order (`playCard`, including a split card at its play). Gated and lazy.
  Deleted at turn start.
- `koPileLengthAtTurnStart?: number`: `G.ko.length` when the current turn began. Gated and lazy.
  Overwritten each turn start.

### B) `packages/game-engine/src/moves/coreMoves.impl.ts` (**modified**)
- In `applyCardPlay`, immediately after `playerZones.inPlay = [...playerZones.inPlay, cardId];`,
  and in `playCard`'s split-card branch, immediately after its `inPlay` append, add the same
  gated append:
  - when `matchReadsPlayHistory(G)` is true, append `cardId` in exactly this form (locked, so
    the Verification grep is exact):
    `if (G.cardsPlayedThisTurn === undefined) { G.cardsPlayedThisTurn = []; }` then
    `G.cardsPlayedThisTurn.push(cardId);` in `applyCardPlay`, and
    `G.cardsPlayedThisTurn.push(args.cardId);` in the split branch (its in-scope variable)
- Each site gets a `// why:`. The append precedes the card's effects, so the card's own
  conditions see it as the latest entry.

### C) `packages/game-engine/src/hero/heroConditions.evaluate.ts` (**modified**)
- New exported condition-type constants:

  | Constant | Type string | Timing |
  |---|---|---|
  | `CARD_PLAY_ORDINAL_CONDITION_TYPE` | `'cardPlayOrdinalEquals'` | on-play |
  | `OTHER_CARDS_PLAYED_CONDITION_TYPE` | `'otherCardsPlayedThisTurnAtLeast'` | on-play |
  | `OTHER_CARD_OF_COST_PLAYED_CONDITION_TYPE` | `'otherCardOfCostPlayedThisTurn'` | on-play |
  | `CARD_OF_COST_PLAYED_CONDITION_TYPE` | `'cardOfCostPlayedThisTurn'` | on-play |
  | `OTHER_DISTINCT_HEROES_PLAYED_CONDITION_TYPE` | `'otherDistinctNonGreyHeroesPlayedThisTurnAtLeast'` | on-play |
  | `HERO_KOED_THIS_TURN_CONDITION_TYPE` | `'heroPutIntoKoPileThisTurn'` | wait-and-see |

- `PLAY_HISTORY_CONDITION_TYPES: readonly string[]` holds the first five, with a `// why:`.
- `matchReadsPlayHistory(G): boolean` is `true` iff `matchReadsConditionType(G, type)` holds for
  any member. It uses an explicit `for…of`.
- Each new case body lives in a named module-local helper (the `countBystandersInVictory` /
  `countDistinctHeroCostsInHandOrPlay` precedent), so `evaluateCondition` gains only one-line
  `case` arms. Each helper has JSDoc and a `// why:` naming the 30-line function rule. That also
  covers the single-use `isHeroCardId`.
- `evaluateCondition` cases. `history` is `G.cardsPlayedThisTurn ?? []`, `N` is
  `parseInt(condition.value, 10)` with the house NaN guard (return `false`), and "other" means
  entries `!== triggeringCardId`:
  - `cardPlayOrdinalEquals` → `history.length === N`
  - `otherCardsPlayedThisTurnAtLeast` → (count of other entries) `>= N`
  - `otherCardOfCostPlayedThisTurn` → some other entry has `G.cardStats[id]?.cost === N`
  - `cardOfCostPlayedThisTurn` → some entry (self included) has `G.cardStats[id]?.cost === N`
  - `otherDistinctNonGreyHeroesPlayedThisTurnAtLeast` → the count of distinct names among other
    entries that are non-grey is `>= N`
    - non-grey: `G.cardTraits[id]?.heroClass` or `heroClass2` is a non-empty string (printed
      class only)
    - name: `G.cardDisplayData[id]?.name`, falling back to the id with its `#<copy>` suffix
      removed
  - `heroPutIntoKoPileThisTurn` → with `start = G.koPileLengthAtTurnStart`:
    - absent → `false`
    - otherwise, some `G.ko[i]` for `i >= start` is a Hero: it has a `G.cardTraits` entry, or it
      is one of `SHIELD_AGENT_EXT_ID`, `SHIELD_TROOPER_EXT_ID`, `SHIELD_OFFICER_EXT_ID`,
      `SIDEKICK_EXT_ID`
    - a module-local helper `isHeroCardId(G, id)` implements this
- `describeFailedCondition` cases (locked text; `${…}` is interpolated):
  - `cardPlayOrdinalEquals` → `it needs to be card number ${value} you played this turn — it was card number ${history.length}`
  - `otherCardsPlayedThisTurnAtLeast` → `it needs ${value} other cards played this turn`
  - `otherCardOfCostPlayedThisTurn` → `it needs another card costing ${value} played this turn`
  - `cardOfCostPlayedThisTurn` → `it needs a card costing ${value} played this turn`
  - `otherDistinctNonGreyHeroesPlayedThisTurnAtLeast` → `it needs ${value} other non-grey Heroes with different names played this turn`
  - `heroPutIntoKoPileThisTurn` → `it needs a Hero put into the KO pile this turn`
  - The `default` fallback stays.
  - The two "other" strings carry no running count on purpose. `describeFailedCondition(G,
    playerID, condition)` takes no `triggeringCardId` (`heroConditions.evaluate.ts:706`, caller
    `heroEffects.execute.ts:750`), so an "other" count cannot be computed there faithfully.
    Widening that export is out of scope.
- `bystandersInVictoryAtLeast` needs **no** evaluate or describe change; only its new marker
  arm (Scope E) is added.

### D) `packages/game-engine/src/hero/deferredConditionalGrants.ts` (**modified**)
- Append `HERO_KOED_THIS_TURN_CONDITION_TYPE` to `WAIT_AND_SEE_CONDITION_TYPES` with a `// why:`:
  a sticky per-turn event is a count ≥ 1 threshold (shape #1, one-shot).
- Extend the module doctrine comment by one sentence each:
  - shape #1 names Rage's event
  - the play-history types are deliberately **not** members: they are play-order gates, the same
    reason the class gates stay on-play

### E) `packages/game-engine/src/setup/heroAbility.setup.ts` (**modified**)
Seven new marker arms, placed before the unresolved-marker fallback, beside the WP-743 arms: six
feed the new conditions and one feeds Savior's existing condition. Each has a `// why:` citing
WP-745 / D-24568. The six new-condition arms push `{ type: <EXPORTED_CONSTANT>, … }` using the Scope C
constants, never a literal. The `bystanders-threshold` arm pushes the same `'bystandersInVictoryAtLeast'`
literal the Savior arm uses (`heroAbility.setup.ts:1272`); no constant is added for it. The table
shows the resolved strings for reference:

| Marker | Pushes |
|---|---|
| `[keyword:card-play-ordinal:N]` | `{ type: 'cardPlayOrdinalEquals', value: N }` |
| `[keyword:played-other-cards:N]` | `{ type: 'otherCardsPlayedThisTurnAtLeast', value: N }` |
| `[keyword:played-other-cost:N]` | `{ type: 'otherCardOfCostPlayedThisTurn', value: N }` |
| `[keyword:played-cost:N]` | `{ type: 'cardOfCostPlayedThisTurn', value: N }` (may appear twice on one line) |
| `[keyword:played-other-distinct-heroes:N]` | `{ type: 'otherDistinctNonGreyHeroesPlayedThisTurnAtLeast', value: N }` |
| `[keyword:hero-koed-this-turn]` | `{ type: 'heroPutIntoKoPileThisTurn', value: '1' }` (single segment) |
| `[keyword:bystanders-threshold:N]` | `{ type: 'bystandersInVictoryAtLeast', value: N }` (reuses the Savior condition) |

- A parameterized arm whose `:N` capture is absent pushes nothing. That is the
  `recruit-threshold` arm's guard.
- The line's printed `+N[icon:…]` grant stays on the same hook (the unchanged Step 2b path).
- `[keyword:draw-threshold:N]` needs no parser change.

### F) `packages/game-engine/src/game.ts` + `packages/game-engine/src/simulation/onBeginParity.ts` (**modified**)
In the play-phase turn `onBegin`, beside the WP-656 / WP-743 guarded deletes, add each with a
`// why:`:
- a guarded `delete G.cardsPlayedThisTurn`
- when `matchReadsConditionType(G, HERO_KOED_THIS_TURN_CONDITION_TYPE)`, set
  `G.koPileLengthAtTurnStart = G.ko.length`

`onBegin` runs before any move of the turn, including `revealVillainCard`, so a KO during that
reveal counts as this turn.

Add the **same two statements** to `applyOnBeginParity`, with a `// why:` naming the `game.ts`
mirror. The simulation runner, the PAR aggregator and the fixture runner never run `game.ts`
`onBegin`. Without the mirror, the play history would span turns and the KO snapshot would stay
stale. Update the module and function JSDoc to name them.

### G) Card data (**modified**; regenerated)
`scripts/convert-cards/inputs/hero-ability-markers.json`, 18 apply entries on 17 lines (Dr. Strange
takes two):

| Set | heroSlug / cardSlug | idx | markupToken |
|---|---|---|---|
| msis | wanda-vision / rage | 0 | `[keyword:hero-koed-this-turn]` |
| amwp | wasp / follow-my-lead | 1 | `[keyword:card-play-ordinal:1]` |
| dkcy | elektra / first-strike | 0 | `[keyword:card-play-ordinal:1]` |
| vill | dr-octopus / eighth-times-a-charm | 0 | `[keyword:card-play-ordinal:8]` |
| ca75 | winter-soldier / kgb-training | 0 | `[keyword:played-other-cards:7]` |
| co2e | iron-man / repulsor-rays | 0 | `[keyword:played-other-cards:8]` |
| xmen | cannonball / human-cannon | 1 | `[keyword:played-other-cards:6]` |
| anni | fantastic-four-united / invisible-woman | 0 | `[keyword:played-other-cost:4]` |
| ff04 | invisible-woman / four-of-a-kind | 0 | `[keyword:played-other-cost:4]` |
| vnom | venomized-dr-strange / complete-the-grand-ritual | 0 | `[keyword:played-cost:4]` then `[keyword:played-cost:2]` |
| asrd | warriors-three-the / three-stand-as-one | 0 | `[keyword:played-other-distinct-heroes:3]` |
| co2e | hawkeye / trick-arrow | 0 | `[keyword:draw-threshold:1]` |
| dkcy | wolverine / sudden-ambush | 0 | `[keyword:draw-threshold:1]` |
| rvlt | captain-marvel-agent-of-shield / radiant-blast | 0 | `[keyword:draw-threshold:1]` |
| mgtg | gamora / guardians-escape | 0 | `[keyword:draw-threshold:2]` |
| co2e | black-widow / covert-operation | 0 | `[keyword:bystanders-threshold:4]` |
| wtif | apocalyptic-black-widow / humanitys-final-hope | 0 | `[keyword:bystanders-threshold:4]` |

- `scripts/convert-cards/apply-hero-ability-markers.mjs`: add the seven new token forms to
  `VALID_TOKEN_PATTERN`, with the house `// why:` line. `hero-koed-this-turn` is bare; the other
  six take `:[1-9]\d*`.
- `scripts/hero-mechanic-ledger.mjs`: add the seven marker→condition entries to the map at
  ~L173–182.
- `data/cards/{msis,amwp,dkcy,vill,ca75,co2e,xmen,anni,ff04,vnom,asrd,rvlt,mgtg,wtif}.json` (14
  files) are regenerated by apply mode. It is surgical: exactly the 17 ability lines change.

### H) Derived artifacts (**modified**; regenerated by their sanctioned commands)
Run every `:check` even when it shows no diff.
- **Certain.** Run in this order, because `effect-index` and `mechanics:metadata` read the
  committed hero ledger (`build-effect-implementation-index.mjs:56`,
  `build-card-mechanics-metadata.mjs:51`), not the card data:
  `ledger:heroes` → `effect-index` → `mechanics:metadata` → `sim:runtime-observed`.
  The scaffold proved the ledger and runtime-observed drift; the two ledger readers follow from
  it (the new marker slugs are absent from both today).
  - `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`: `ledger:heroes`
  - `docs/ai/coverage/runtime-observed-hollows.json`: `sim:runtime-observed`
  - `apps/dashboard/src/composables/useInPlayCoverage.test.ts`: re-pin the one `totalObs`
    constant to the fresh value in the same commit. This is the documented feed-regen pairing,
    not a weakened test; it needs a `Tests-changed:` trailer.
  - `data/metadata/effect-implementation-index.json`: `effect-index`
  - `data/metadata/card-mechanics.json`: `mechanics:metadata`
- **Conditional.** `scripts/coverage/hero-effect-coverage.baseline.json`:
  `sim:coverage --update-baseline`, only if `--check` exits non-zero (it hard-fails only when
  `noEffect` rises; a new mechanic only warns).
- Confirm that each diff touches only the in-scope cards and tokens.

### I) Tests (**new/modified**)
**New** `packages/game-engine/src/hero/unmarkedConditionalGrants.test.ts`, covering at least:
1. **Parse.** The case reads the 17 committed ability strings from `data/cards/*.json` (read via a
   path resolved from `import.meta.url` + `readFileSync`, the `rules/effectRulings.test.ts:123`
   precedent; this is the first engine test to read `data/cards` at runtime), never literals, co2e included. For each it
   asserts that the condition sits on the same hook as the grant, the grant is unchanged, and
   there is no `unresolvedMarkers` entry. The Dr. Strange line carries **two**
   `cardOfCostPlayedThisTurn` conditions (4 and 2).
2. **Ordinal.**
   - Elektra as the 1st play → +1 Attack. As the 2nd → none.
   - **KO-shrink case:** play card A, KO A from play, then play Elektra. `inPlay` holds only
     Elektra, but she is the 2nd play → **no** grant. This case is the reason for the play
     history.
   - Dr. Octopus as the 8th play → +2. As the 7th or the 9th → none.
3. **Other-count.** Winter Soldier after 7 other plays → +2. After 6 → none. Played first, then
   7 more → **none** (on-play, no deferral recorded).
4. **Cost.**
   - Invisible Woman after another 4-cost play → grant. When the only 4-cost play is herself →
     none. A second copy of Invisible Woman (a different `#N`) counts as the other 4-cost card.
   - Dr. Strange after a 4-cost and a 2-cost → +2. After only a 4-cost → none.
5. **Distinct Heroes.** Warriors Three after three other non-grey, differently named Heroes →
   +3. Two copies of the same card count once. A S.H.I.E.L.D. Agent does not count.
6. **Rage.** Drive it the real way: `playCard` on the Grief/Rage split card, then
   `resolveSplitFaceChoice` with face `'b'`. Never call `applyCardPlay` on a Rage id directly.
   - With a play-history reader present, that split play leaves exactly **one**
     `cardsPlayedThisTurn` entry.
   - A Hero KO'd earlier this turn → +2 on play.
   - A Wound or Bystander KO'd → none, and a deferred grant is recorded.
   - Rage played first, then a Hero KO'd → the deferred grant fires **once** on the next
     resolution. A second KO does not grant again.
   - A Hero KO'd **last** turn → none (the snapshot resets).
7. **Reused conditions.**
   - Hawkeye with no effect draw → none. After a draw → the deferred grant fires.
   - Gamora needs 2.
   - Black Widow with 4 Bystanders in VP → +2. With 3 → none, and no deferral recorded.
8. **Oracle safety.** With no reading hook, neither `cardsPlayedThisTurn` nor
   `koPileLengthAtTurnStart` exists on `G` after plays and a turn boundary.
9. **Turn reset.**
   - The real `LegendaryGame` play-phase `turn.onBegin` (the `game.test.ts` ~L279 pattern, never
     a hand-written `delete`) deletes the history and re-snapshots the KO pile.
   - `applyOnBeginParity` does the same.
   - Both are no-ops without a reading hook.

**`deferredConditionalGrants.test.ts` (modified, certain).** Its keyset `deepEqual` and its
`TRUTHY_FIXTURE` gain `heroPutIntoKoPileThisTurn`, or the drift pin fails. This is a value-only
extension. The fixture needs a `G` with a snapshot of `0` and one hero-deck card in `G.ko`.

**`heroConditions.evaluate.test.ts` (modified, certain)** gains a runtime drift pin:
- every `PLAY_HISTORY_CONDITION_TYPES` member has an `evaluateCondition` case and a
  non-default `describeFailedCondition` string
- the set is disjoint from both `WAIT_AND_SEE_CONDITION_TYPES` and
  `SEQUENCE_GATE_CONDITION_TYPES`

`rules/heroAbility.setup.test.ts` is modified **only if** an existing runtime pin enumerates the
extended sets. The existing `SEQUENCE_GATE_CONDITION_TYPES` disjointness pin must stay green
unchanged.

---

## Out of Scope

- **WP-743's two cards** (Spring the Trap, Grief). They are fixed there.
- **Follow-up A: board or collection-state predicates** (new on-play conditions; one WP). Six
  lines: the first three are free today, and the last three are gated only by their `[hc:X]` class
  prefix, with the "If …" clause ignored. (`asrd/lady-sif/weapons-master#0` also reads board
  state, but it needs the unmodeled Artifact mechanic; see the Sweep Ledger.)
  - `mgtg/drax/xandar-is-invincible#0` ("no Villains in the city")
  - `mgtg/rocket-groot/tricky#0` ("you have at least five different card names")
  - `msis/black-panther/avengers-reassembled#0` ("you have all five Hero Classes"; "have" means
    hand + play, D-24497)
  - `co2e/nick-fury/weapon-bank#0` ("the Bank is empty")
  - `cvwr/speedball/bounce-around#0` ("Bystanders in the city or KO pile")
  - `bkpt/white-wolf/secret-assignment#1` ("a Villain or Mastermind has any Wounds")
- **Follow-up B: discard event.** `bkwd/falcon-winter-soldier/new-wings#0`,
  `vill/green-goblin/pumpkin-bombs#1` ("If you discarded any cards this turn"). These need a
  discard signal across many discard sites, and end-of-turn cleanup must be excluded.
- **Follow-up C: most-recent-Hero icon branch.** `rvlt/darkhawk/travel-to-nullspace#0`,
  `ssw1/proxima-midnight/master-combatant#0`. Two grants, each gated on an icon of the last
  Hero played. The play history added here is their natural input.
- **Follow-up D: count every hand draw toward `cardsDrawn`.** Today only the hero `draw:N` path
  counts (Assumes). Until that lands, the four draw lines here and Gamma-Draining Nanites
  under-grant on draws from other sources.
- **Every other free hook in the Sweep Ledger** belongs to a different mechanic family:
  optional-cost, reveal-branch, Patrol, Focus, Tactical Formation, guess, KO-Wound-or-gain,
  Shards, Artifacts, Endgame, Galactus.
- **Split cards (face-B relabel and latent hazard).** `resolveSplitFaceChoice` relabels the `inPlay`
  entry to face B, but the play history keeps the primary-face id; `moves/splitFaceChoice.resolve.ts`
  is not touched. All 39 split cards share one printed cost across faces (verified), so only a
  name-based count could differ, and a future face-B card with an "other" play-history condition
  would count its own face-A entry. Warriors Three is name-based, so it counts a split card under
  its primary-face name even when face B was chosen. That imprecision is accepted and recorded in
  D-24568 §6. Rage is face B but not play-history. No guard is added.
- **Copy Powers or Steal Abilities copying an in-scope line.** Ordinal and "other" semantics
  follow `triggeringCardId`, as every existing condition does. There is no special case.
- **`firstHeroPlayedThisTurn`'s `inPlay`-shrink imprecision** (Deadpool Do-Over). Its "first
  Hero" text and the existing tests are unchanged. Moving it onto the play history is a possible
  later refinement, not this WP.
- **The rebuilt loops never resolve deferred grants** (the pre-existing WP-568 / 656 gap). That
  gap is WP-744's to fix, not this WP's. Until WP-744 lands, a Rage or draw line played in the sim
  before its event never grants later, which is conservative. Once WP-744 has landed, those lines
  also fire later in the sim. On-play grants work in the sim either way.
- No UIState field, no client change, no bot-valuation change, no new move.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `packages/game-engine/src/types.ts` — **modified** — two optional lazy fields
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — two gated play-history appends
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — 6 constants, `PLAY_HISTORY_CONDITION_TYPES`, `matchReadsPlayHistory`, `isHeroCardId`, 6 evaluate + 6 describe cases
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` — **modified** — one wait-and-see member + doctrine sentences
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — seven marker arms
- `packages/game-engine/src/game.ts` — **modified** — `onBegin` delete + snapshot
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — the same, plus JSDoc
- `packages/game-engine/src/hero/unmarkedConditionalGrants.test.ts` — **new**
- `packages/game-engine/src/hero/deferredConditionalGrants.test.ts` — **modified** — keyset + truthy-fixture extension
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified** — `PLAY_HISTORY_CONDITION_TYPES` drift pin
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified only if** an existing runtime pin enumerates the extended set
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — 18 apply entries on 17 lines
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — token allowlist
- `scripts/hero-mechanic-ledger.mjs` — **modified** — marker→condition map
- `data/cards/{msis,amwp,dkcy,vill,ca75,co2e,xmen,anni,ff04,vnom,asrd,rvlt,mgtg,wtif}.json` — **modified** — regenerated marker lines (17 lines, 14 files)
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json` — **modified** — regenerated (certain)
- `scripts/coverage/hero-effect-coverage.baseline.json` — **modified only if** `sim:coverage --check` exits non-zero
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **modified** — the paired `totalObs` re-pin (`Tests-changed:` trailer)

No other files may be modified in the `EC-782:` commit. The governance close `SPEC:` commit edits
STATUS, DECISIONS (D-24568 Active), WORK_INDEX, EC_INDEX and the mindmap.

---

## Contract

- **`LegendaryGameState.cardsPlayedThisTurn?: CardExtId[]`**
  - holds the current player's plays this turn, in order, as written at the two `coreMoves`
    append sites
  - present only when a hook in the match reads a `PLAY_HISTORY_CONDITION_TYPES` member
  - deleted at turn start
- **`LegendaryGameState.koPileLengthAtTurnStart?: number`**
  - holds `G.ko.length` at turn start
  - present only when a hook reads `heroPutIntoKoPileThisTurn`
- **Conditions** (as in Scope C):
  - `cardPlayOrdinalEquals`, `otherCardsPlayedThisTurnAtLeast`, `otherCardOfCostPlayedThisTurn`,
    `cardOfCostPlayedThisTurn` and `otherDistinctNonGreyHeroesPlayedThisTurnAtLeast` are
    **on-play**
  - `heroPutIntoKoPileThisTurn` is **whole-turn wait-and-see**, shape #1 one-shot
- **Markers** (as in Scope E):
  - parameterized: `card-play-ordinal:N`, `played-other-cards:N`, `played-other-cost:N`,
    `played-cost:N`, `played-other-distinct-heroes:N`, `bystanders-threshold:N`
  - bare: `hero-koed-this-turn`
- **`matchReadsPlayHistory(G)`** and **`isHeroCardId(G, id)`** are pure reads.
- **Hash oracles.** The sentinel `finalStateHash` and `PRE_WP080_HASH` are unchanged.

---

## Vision Alignment

- **Vision clauses touched:**
  - §1 (rules authenticity: each printed condition is enforced)
  - §2 (content authenticity: card semantics)
  - §3 (no hidden modifiers: 17 unearned bonuses removed)
  - §8, §22, §26 (deterministic engine; PAR and sim feeds regenerate through their sanctioned
    commands)
  - NG-1 (untouched)
- **Conflict assertion:** No conflict. The change removes unearned bonuses and restores the
  play-order skill several cards were designed around.
- **Non-Goal proximity:** NG-1..8 are not crossed.
- **Determinism:** the new state is deterministic: written at deterministic play and turn-start
  sites, from deterministic inputs. The hash oracles are unchanged by construction (gated lazy
  fields).
  - Matches with these cards legitimately change outcome, because the bonuses were wrong.
  - The committed sim feeds regenerate (Scope H).
- **Upgrade / replay story.** No migration. No persisted shape changes, and both fields are lazy
  and optional.
  - `G.heroAbilityHooks` is built once at setup (`buildInitialGameState.ts:387`) and travels with
    the match. So a match in flight at deploy keeps its old, condition-free hooks and the old free
    grants until it ends. No hook in it reads the new fields, so they are never written, and no
    mixed state arises. Accepted.
  - The same holds for a D-24119 reduction of a stored blob: its `initialState` carries the old
    hooks, so it reproduces the original match. Only a replay that re-runs setup from the match
    configuration builds the new hooks and applies the corrected grants (the D-24467 / D-24566
    posture). Such a replay may diverge, for example when a fight was paid with a removed bonus.
    Competitive scores are verified only at submit time.
  - PAR profiles are unchanged, because `HERO_POOL` is core-only
    (`generate-par-profiles.mjs:57–64`).

## Funding Surface Gate

N/A — no funding affordance, channel, or donate/support copy (engine + card-data only; no UI or copy changes).

## API Catalog

N/A (§21). No `apps/server` endpoint or `Library-only` server function changes. Engine-only.

---

## Acceptance Criteria

All binary pass/fail.

- [ ] All 17 in-scope hooks carry their condition. Re-running the draft probe (or an equivalent
  `buildHeroAbilityHooks` check) shows **0** of them in the FREE bucket, and no
  `unresolvedMarkers` on them.
- [ ] Elektra played 2nd, after the 1st card was KO'd from play, grants **no** Attack.
- [ ] Dr. Octopus grants only as the exact 8th play.
- [ ] Winter Soldier played before its 7 others grants **no** Attack and records no deferred
  grant.
- [ ] Invisible Woman does not count herself. Dr. Strange needs both a 4-cost and a 2-cost play.
- [ ] Warriors Three counts distinct names of non-grey Heroes only.
- [ ] Rage grants only after a **Hero** entered the KO pile this turn. Played before the KO, it
  fires once when the KO lands.
- [ ] The four draw lines wait for the effect-draw count. The two Black Widow lines need 4
  Bystanders at play.
- [ ] With no reading hook, neither new key exists on `G`. The sentinel `finalStateHash` and
  `PRE_WP080_HASH` are byte-unchanged (no re-pin).
- [ ] `cards:check` passes, and a re-run of the apply script is zero-diff (co2e included).
- [ ] `pnpm -r build` exits 0. The engine suite is green at baseline plus the new cases (counts in
  the commit body). Every Coverage & Ledger `:check` exits 0, and so does the dashboard suite.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/game-engine test
# Expected: exit 0; unmarkedConditionalGrants.test.ts passes; no sentinel/PRE_WP080 failure

node scripts/convert-cards/apply-hero-ability-markers.mjs
git diff --stat data/cards
# Expected (first run): 14 files changed, 17 insertions(+), 17 deletions(-); a re-run is zero-diff

pnpm cards:check; pnpm ledger:heroes:check; pnpm effect-index:check; pnpm mechanics:metadata:check
pnpm sim:coverage --check; pnpm sim:runtime-observed:check
pnpm --filter @legendary-arena/dashboard test
# Expected: all exit 0 (after the Scope H regens and the paired re-pin)

Select-String -Path "packages\game-engine\src\moves\coreMoves.impl.ts" -Pattern "cardsPlayedThisTurn.push"
# Expected: exactly two matches (the two gated appends)

git diff --name-only
# Expected (implementation commit): within ## Files Expected to Change
```


---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **Live verification (D-24026), on play.legendary-arena.com:** start a match whose hero
  pool includes one of these cards: Elektra (dkcy), Winter Soldier (ca75) or Wanda & Vision
  (msis). Use a bot-ally or `POST /api/match/autoplay` match with a chosen setup. Read the log:
  - a first-card, Nth-card or Rage play grants **only** when its condition held
  - a play where it did not hold shows no "+N from <card>" line
- [ ] `docs/ai/STATUS.md` updated, with the live observation.
- [ ] All acceptance criteria pass.
- [ ] No files outside `## Files Expected to Change` are modified in the `EC-782:` commit.
- [ ] `docs/ai/DECISIONS.md`: D-24568 landed Active.
- [ ] `WORK_INDEX.md` WP-745 is `[x]`, and `EC_INDEX.md` EC-782 is Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝` → `✅`, then `pnpm roadmap:counts:write`;
  `roadmap:counts:check` exits 0.

---

## Reserved Decision (lands at execution)

- **D-24568 (reserved; Drafted 2026-09-22): unmarked "If <condition>, you get +N" lines are gated
  through marker→condition arms, with play-history predicates evaluated on play.**
  1. **Play-history conditions** (`cardPlayOrdinalEquals`, `otherCardsPlayedThisTurnAtLeast`,
     `otherCardOfCostPlayedThisTurn`, `cardOfCostPlayedThisTurn`,
     `otherDistinctNonGreyHeroesPlayedThisTurnAtLeast`) are **play-order gates**. They evaluate
     on play and never join `WAIT_AND_SEE_CONDITION_TYPES`. **Amends D-24377 §1:** all five
     take a number (a count, a cost or an ordinal), yet they join the `[hc:X]`/team on-play
     exception. The wait-and-see seam becomes "a numeric threshold that play order cannot
     manufacture".
  2. **A card-play ordinal** reads a gated, lazy, per-turn play history `G.cardsPlayedThisTurn`,
     never `inPlay` (which shrinks mid-turn). `firstHeroPlayedThisTurn` keeps its `inPlay`
     "first Hero" reading, unchanged.
  3. **"A Hero was put into the KO pile this turn"** is a sticky event: wait-and-see, shape #1,
     one-shot. It reads a gated turn-start snapshot `G.koPileLengthAtTurnStart` over the
     append-only KO pile. A Hero is a `cardTraits` entry or a basic S.H.I.E.L.D. / Sidekick token.
  4. **Reuse over new conditions.** The "drew N cards this turn" lines reuse
     `cardsDrawnThisTurnAtLeast` (wait-and-see). The "have at least N Bystanders" lines reuse
     `bystandersInVictoryAtLeast` via `[keyword:bystanders-threshold:N]` (on-play, like Savior).
     The four draw lines inherit the `draw:N`-only count; draws from other sources under-grant
     until Follow-up D.
  5. **Both new fields are gated and lazy.** Games without a reading hook are byte-unchanged.
  6. **Card-name identity for a rules check** ("different card names") reads the setup-static
     `G.cardDisplayData[id].name`, falling back to the id without its `#copy` suffix. It never
     reads a projection. A split card counts under its primary-face name even when face B was
     chosen (accepted).

---

## Sweep Ledger (appendix)

The probe covered 121 hero ability lines matching the regex in Assumes. 87 hooks had effects and
no conditions (FREE); 34 carried some condition (COND). Every FREE hook, plus the COND hooks
whose condition is only a class/team prefix while the "If …" clause is ignored, is dispositioned
below.

| Disposition | Lines |
|---|---|
| **This WP (17)** | Listed in Scope G |
| **WP-743 (2)** | `vnom/venom-rocket/spring-the-trap#0`, `msis/wanda-vision/grief#0` |
| **Follow-up A: board/collection state (7)** | `mgtg/drax/xandar-is-invincible#0`, `mgtg/rocket-groot/tricky#0`, `msis/black-panther/avengers-reassembled#0`, `asrd/lady-sif/weapons-master#0`\*, and the partially gated COND lines `co2e/nick-fury/weapon-bank#0`, `cvwr/speedball/bounce-around#0`, `bkpt/white-wolf/secret-assignment#1` |
| **Follow-up B: discard event (2)** | `bkwd/falcon-winter-soldier/new-wings#0`, `vill/green-goblin/pumpkin-bombs#1` |
| **Follow-up C: most-recent-Hero icon (2)** | `rvlt/darkhawk/travel-to-nullspace#0`, `ssw1/proxima-midnight/master-combatant#0` |
| **Follow-up D: draw counting (0 new lines)** | Widens `cardsDrawn` to every hand draw; affects the 4 in-scope draw lines + Gamma-Draining Nanites |
| **Optional cost, "You may X. If you do" (no handler)** | `2099/ghost-rider-2099/hell-ride#0`, `2099/doctor-doom-2099/subvert-this-new-future#0`, `shld/sharon-carter/sharon-carter#0`, `dkcy/ghost-rider/blazing-hellfire#0`, `ssw1/thanos/transdimensional-overlord#1`, `vill/venom/devour#0`, `vill/magneto/magnetic-levitation#1`, `wwhk/sentry/golden-guardian-of-good#0`, `dkcy/domino/specialized-ammunition#0`, `mdns/morbius/scalded-by-sunlight#0`, `#1`, `nmut/sunspot/solar-powered#0` |
| **Handler-backed reward keywords (hook also carries a plain icon effect; see note)** | `ko-wound-reward` on `{3dtc,core,msp1,co2e}/hulk/*`, `cvwr/hulkling/cellular-regeneration#1`, `ff04/human-torch/call-for-backup#0`, `msis/bruce-banner/hulkbuster-armor#0`; `put-bottom-hq-icon-reward` on `antm/wonder-man/absorb-ambient-power#0`, `xmen/kitty-pryde/intangible-qualities#0`; `shuffle-discard-empty-reward` on `antm/jocasta/*` |
| **Reveal / discard-top then branch** | `fear/kuurth-breaker-of-stone/reach-for-power#0`, `pttr/symbiote-spider-man/dark-strength#1`, `noir/daredevil-noir/hitting-rock-bottom#0`, `cvwr/wiccan/astral-projection#1`, `dkcy/daredevil/radar-sense#0`, `cosm/moondragon/lunar-dragon-form#1`, `vill/mysterio/shifting-decoy#0` |
| **Guess a card** | `nmut/karma/temporary-possession#0`, `rvlt/hellcat/demon-sight#0` |
| **KO-a-Wound-or-gain-one** | `chmp/totally-awesome-hulk/growing-pains#1`, `dead/deadpool/itll-grow-back#0`, `msmc/m/penance-form#2` |
| **Patrol** | `mdns/*` (4 lines), `ssw2/*` (10 lines) |
| **Focus / Tactical Formation** | `anni/psi-lord/*` (4), `msmc/stepford-cuckoos/*` (2) |
| **Shards / Artifacts / Endgame / Galactus** | `cosm/phyla-vell/*` (2), `fear/greithoth-breaker-of-wills/absorb-metal#0`, `msis/captain-marvel/turning-point#1`, `anni/heralds-of-galactus/galactus-hungers#0` |

\* `asrd/lady-sif/weapons-master#0` ("If you control any Artifacts") needs the Artifact mechanic,
which is not modeled. It is listed under A only because its predicate is board state.

**Note (not in scope; flagged for a separate check):** the `ko-wound-reward`,
`put-bottom-hq-icon-reward` and `shuffle-discard-empty-reward` hooks list the handler effect
**and** a plain `attack`/`recruit` effect with the same magnitude. If the executor does not
suppress the plain effect, those cards grant the reward even when the cost is not paid. The
draft did not confirm either way.

---

## Lint Gate Self-Review (00.3)

All rounds were run by an independent reviewer.

**Round 1: FAIL.** The collisions and gaps it found, all fixed:
- **P0: numbering.** WP-744 / EC-781 / D-24567 had already been reserved on `main` by #2287.
  Renumbered to WP-745 / EC-782 / D-24568 through reserve #2290; #2288 was closed.
- **P1: facts and spec gaps.**
  - The card count was 17, not 16.
  - `playFromUndercover` was retired by WP-678.
  - The `.push` grep did not match the house append style; the append form is now locked.
  - The "other" describe counts could not be computed; the running counts were dropped.
  - The card-name source was not locked; it is now `cardDisplayData.name` (D-24568 §6).
- **P2:**
  - The KO-site count is 24 callers + 2 direct.
  - New evaluator case bodies go in named helpers.
  - The EC now uses exact constant names.
  - Regens are labeled certain or conditional.
  - The "71 non-predicate" prose was corrected.
  - The client no-leak line was added.

**Round 2: PASS**, with four wording cleanups applied: the WP-744 bullet placement, the merged
split-card bullets, the `onBegin` / reveal wording, and the EC Before-Starting order.

**Round 3: PASS**, with six fixes applied:
- the in-flight-match and replay story, since `heroAbilityHooks` is setup-time
- EC comment wording
- A–D follow-up order
- "all five take a number"
- two reflows

**Final confirm: PASS** after the pre-flight PS fix (the bystanders literal) and the
test-precedent citation.

§10, §11 and §19 are N/A. §20 and §21 are N/A, justified: engine and card data only, with no
funding surface and no `apps/server` surface.

## Pre-Flight Verdict (01.4)

**READY TO EXECUTE (2026-09-22)**, blocked only on WP-743 / EC-780 executing on `main`. The EC
Before-Starting hard gate enforces that.

Four independent rounds:
- **Round 1: NOT READY.**
  - PS-1: the number collision with #2287. Renumbered, and WP-744 was recorded as a sequencing
    sibling.
  - PS-2: the "other" describe counts needed `triggeringCardId`. The counts were dropped
    (option a).
  - RS-1..5 applied:
    - `playFromUndercover` is retired
    - Rage is face B of the Grief/Rage split card, so its tests drive `resolveSplitFaceChoice('b')`
    - the grep self-trip guard
    - the KO-site count
    - the bystanders arm needs no evaluator change
- **Round 2: NOT READY.**
  - PS-1: the index rebuild onto the new `main` had dropped WP-743's rows. Rebuilt from HEAD,
    additions only.
  - RS-1: `effect-index` and `mechanics:metadata` read the hero ledger, so their regens are
    certain; the order is locked.
  - RS-2: the split branch appends `args.cardId`.
- **Round 3: NOT READY.**
  - PS-1: the "every arm pushes a constant" rule had no constant for `bystanders-threshold`. It
    now keeps Savior's literal.
  - RS-1: the test-precedent citation now points to `effectRulings.test.ts:123`.
- **Round 4: READY.**

Verified in code:
- the two play chokepoints (`coreMoves.impl.ts:285`, `:542`); `resolveSplitFaceChoice` never
  re-appends
- the KO pile is append-only
- `onBegin` runs before any move, and parity runs at game start and on every rotation
- all 17 lines and their `abilityIndex`
- `cardsDrawn` increments only at `heroEffects.execute.ts:1366`
- the hash oracles contain no in-scope hero
- no other marker or condition lockstep site

## Copilot Check (01.7)

**Round 1: RISK / HOLD** on modes #4, #10, #11, #18, #20, #26, #28 and #30. The eight fixes:
1. D-24568 §1 now explicitly **amends** D-24377 §1 (option A: ratify on-play). The operator's
   brief for this WP set "play-order gates evaluate on play", and a count of cards played is
   manufactured by play order.
2. `cardsDrawn` counts only the `draw:N` path; this is recorded, with Follow-up D.
3. The Warriors Three split-name imprecision is recorded (D-24568 §6).
4. Tests: case 1 reads the committed `data/cards` strings; a split play leaves exactly one
   history entry; a second Invisible Woman copy counts.
5. A certain `PLAY_HISTORY_CONDITION_TYPES` drift pin.
6. Exported constants in the marker arms.
7. A corrected and expanded upgrade/replay story.
8. WP-744 (#2292) sequencing and the `totalObs` 3011-vs-3013 collision.

**Round 2: PASS on all 30 modes.** The upgrade claim was checked against
`buildInitialGameState.ts:387` and `matchReplay.logic.ts:5, 84`.

---

## See Also

- WP-743 / D-24566 — Spring the Trap / Grief (sibling; lands first)
- WP-656 / D-24467 — Diamond Form (event gate; gated lazy `G` field)
- WP-568 / D-24377 — the wait-and-see window
- WP-665 / D-24476 — `draw-threshold`
- WP-653 / D-24464 — Savior / Outwit / Worthy / Antics conditions
- WP-681 / D-24498 — `first-hero-condition`
