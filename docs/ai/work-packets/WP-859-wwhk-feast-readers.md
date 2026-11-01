# WP-859 — "KO'd from your deck this turn": Metamorphosis, Bursting with Life and World-Spanning Hunger (Game Engine + card data)

**Status:** Draft 2026-10-31 (EC-897; D-24795 reserved; pre-flight content READY, copilot PASS → CONFIRM, 00.3 PASS) — **BLOCKED on WP-855 and WP-857 executing**
**Layer:** Game Engine (a turn-scoped record + two wait-and-see conditions + a one-line parse split + a count source + a per-Feast reward) + card data (markers)
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** WP-857 / D-24793 (hero `feast` keyword, `FEAST_CARDS`) — **drafted, not executed**;
WP-855 / D-24791 (`recordOwnedCardKoed` takes `fromZone: OwnedKoSourceZone` at all 25 owned KO
sites) — **drafted, not executed**; WP-856 / D-24792 (the recorder's `cardId` parameter,
`hasWaitingGrantWithCondition`) ✅; WP-665 / D-24476 (a wait-and-see Transform gate,
`SUPPORTED_TRANSFORM_BASES`) ✅; WP-658 / D-24469 (Transform runtime) ✅; D-24016 / WP-673
(`attack-per-count` marker + icon suppression) ✅; WP-754 / D-24581 (reveal-top KO-or-keep queue,
`refreshStaleKoOrKeepFront`) ✅.

## Goal

Make the three World War Hulk hero lines that read "KO'd from your deck this turn" do what they print.
After this WP the engine keeps, for the current turn, a list of which cards left each player's deck to
the KO pile. **Metamorphosis** Feasts, then Transforms into Hive King Miek once a card with an Attack
icon has been KO'd from your deck this turn. **Bursting with Life** Feasts, then Transforms into Torrent
of Broodlings once a non-grey Hero has. **World-Spanning Hunger** Feasts up to three times and gives +2
Attack for each non-grey Hero KO'd from your deck this turn. Today it gives a flat +2 Attack on every
play, whatever was KO'd: that phantom goes away.

## User-Visible Impact

`play.legendary-arena.com`:

- **Metamorphosis.** The Feast prompt opens as today (WP-857). The Transform waits and logs "… is
  waiting — it needs a card with an Attack icon to be KO'd from your deck this turn". KOing such a card
  (through the Feast or any other deck KO that turn) swaps Metamorphosis for Hive King Miek in play and
  gives Hive King Miek's printed 6 Attack.
- **Bursting with Life.** The same, gated on a non-grey Hero. It becomes Torrent of Broodlings (+2
  Attack).
- **World-Spanning Hunger.** It opens three KO-or-keep prompts, one after another, each showing the
  current deck top. Each prompt that KOs a non-grey Hero gives +2 Attack, and the play itself gives +2
  for each non-grey Hero already KO'd from that deck earlier in the turn. It gives no flat +2.
- Hive King Miek and Torrent of Broodlings now reach play through these Transforms. Their own
  abilities fire when they are played on a later turn (D-24469: a second form's hooks do not fire on
  the swap).
- A waiting Transform whose card has left play (KO'd from play, for example) no longer fires. This
  also applies to the two shipped deferring Transforms, She-Hulk's Hurl Legal Objections and
  Gamma-Draining Nanites, which today can hand the player the second form for free in that case.

Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` = `b26ff0d8` (rebased 2026-10-31; drafted on `f4f73de1`; WP-857 draft
  `ff7ccab9`, #3112; WP-856 executed `f88c326b`, #3108; the WP-859 reserve #3114; the WP-858 draft
  `fe3a86d1`, #3116). WP-858 (Ritual Artifacts, drafted) also edits `game.ts`,
  `hero/heroEffects.execute.ts`, `hero/heroConditions.evaluate.ts` and
  `hero/heroCountSource.resolve.ts`. Neither WP depends on the other; whichever executes second
  rebases onto the first.
- **WP-857 executed:** `'feast'` is a `HeroKeyword` whose `HERO_EFFECT_HANDLERS` entry is
  `heroEffectRevealTopMayKo`, listed in `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`; `FEAST_CARDS`
  (five keys, World-Spanning Hunger not among them) gates a `feast` arm in `parseAbilityText` via
  `feastSupported`; `BY_HOOK_KEYWORDS` lists `'feast'`. Metamorphosis and Bursting with Life parse to
  one hook each: `feast` resolved, `transform` unresolved (and on Metamorphosis a magnitude-less
  `attack` leaked from the descriptive `an[icon:attack] icon`).
- **WP-855 executed:** `recordOwnedCardKoed(G, ownerPlayerID, cardId, fromZone)` with
  `type OwnedKoSourceZone = 'hand' | 'deck' | 'discard' | 'inPlay'` exported from
  `hero/deferredConditionalGrants.ts`; the 9 deck sites (8 literal `'deck'` plus `koFromPlayerZone`'s
  `from.zone`) pass `'deck'`, among them `moves/revealTopDispose.resolve.ts` (the Feast KO). The
  recorder runs independent gated blocks, gated by `hasWaitingGrantWithCondition(G, type)`.
  `game.ts` `turn.onBegin` and `simulation/onBeginParity.ts` delete WP-853/855/856 counts with
  guarded `delete`s.
- `hero/heroConditions.evaluate.ts` holds the `evaluateCondition` / `describeFailedCondition` cases
  and the condition-type consts (the load-order home, D-24789 §1); `WAIT_AND_SEE_CONDITION_TYPES`
  (`hero/deferredConditionalGrants.ts`) is the deferral list, pinned by
  `hero/deferredConditionalGrants.test.ts` (`deepEqual` + `TRUTHY_FIXTURE`). A wait-and-see hook that
  fails at play is recorded, re-checked after every move by `resolveDeferredHeroGrants`, fired once
  (shape #1, not re-armed), and dropped at the turn boundary (D-24377).
- `hero/splitCard.logic.ts` exports `matchesGreyHeroFilter(G, cardId, 'non-grey')` (Wounds and
  Bystanders fail; a split card counts as its faces' classes) and `offPlayCardStats(G, cardId)` (the
  split-aware `CardStatEntry`, whose `hasAttackIcon` is `card.attack != null` from setup).
- `setup/heroAbility.setup.ts`: `buildHeroAbilityHooks` runs each card's `abilities[]` through
  `coalesceCountScaledChooseOne` before the per-line loop (a parse-only rewrite; the display text is
  untouched), then emits one hook per line. `SUPPORTED_TRANSFORM_BASES` gates the `transform` arm.
  `COUNT_SCALED_PATTERN` reads `[keyword:attack-per-count:<source>:<perUnit>(:<perEach>)?]` for any
  `HERO_COUNT_SOURCES` member, and the D-24016 icon suppression then drops the line's flat `attack`.
- `rules/heroCountSource.ts`: `HeroCountSource` union + `HERO_COUNT_SOURCES` array, drift-pinned in
  `hero/heroCountSource.resolve.test.ts` (length 17 at `e064d497`). Three `switch (source)` blocks
  read it: `resolveCountSource` and `explainCountSourceInputs` in `hero/heroCountSource.resolve.ts`
  (each has a `default:`, so a missing case silently resolves to 0 / `[]`; the AC-5 pre-play test is
  the guard) and `describeCountSource` in `hero/countSourceLabel.ts` (one hand-written label per
  source, pinned by `countSourceLabel.test.ts`).
- `hero/heroConditions.evaluate.ts` exports `matchReadsConditionType(G, conditionType)` (WP-777 /
  D-24616): true when any hook in `G.heroAbilityHooks` carries a condition of that type, the shipped
  "write a per-turn tracker only when this match can read it" gate.
- `heroEffectTransform` swaps a played base for the first matching second form in `G.transformDeck`,
  routes the base to the side deck and applies the second form's printed attack / recruit; a missing
  second form is a logged `blocked` no-op.
- `RevealedTopEntry` (`types.ts`) carries `ownerPlayerID`, `cardId`, `isKoAllowed?`,
  `isDiscardAllowed?`; `refreshStaleKoOrKeepEntries` re-reveals a stale KO-or-keep entry by assigning
  `entry.cardId` in place, so other entry fields survive a re-reveal.
- `data/cards/wwhk.json` is GENERATED; markers live in
  `scripts/convert-cards/inputs/hero-ability-markers.json` (applied by `apply-hero-ability-markers.mjs`,
  whose `VALID_TOKEN_PATTERN` lists every token).
- Engine `tsconfig.json` sets `exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`.

## Context (Read First)

- **Printed text (`data/cards/wwhk.json`, observed at `f4f73de1`).**
  - `wwhk/miek-the-unhived/metamorphosis` (5 Recruit): "You may [keyword:Feast]. Then, if a card with
    an[icon:attack] icon was KO'd from your deck this turn, [keyword:Transform] this into Hive King
    Miek." Second form `hive-king-miek` (`isTransform`, `transformOf: "metamorphosis"`, 6 Attack).
  - `wwhk/no-name-brood-queen/bursting-with-life` (2 Recruit): "You may [keyword:Feast]. Then, if a
    non-grey Hero was KO'd from your deck this turn, [keyword:Transform] this into Torrent of
    Broodlings." Second form `torrent-of-broodlings` (2 Attack, "Draw a card.").
  - `wwhk/no-name-brood-queen/world-spanning-hunger` (attack `4+`): "Look at the top card of your deck.
    Then [keyword:Feast] up to three times. You get +2[icon:attack] for each non-grey Hero that was
    KO'd from your deck this turn." Today it parses to `unresolvedMarkers: [feast]` and a flat
    `attack:2`: a **live phantom +2 Attack on every play** (WP-857 §Context probe).
- **Why a turn record, not a count.** WP-855's `deckCardsKoedSinceResolve` is a count consumed every
  resolve, so it can serve a per-KO trigger but not a turn total with a card filter. These three
  readers ask "was a card *of this kind* KO'd from your deck *this turn*", including KOs before the
  card was played. The record keeps the KO'd card ids per owner for the whole turn:
  `G.cardsKoedFromDeckThisTurn?: Record<string, CardExtId[]>`. The recorder already receives `cardId`
  (WP-856) and `fromZone` (WP-855), so it is the one feed: a third gated block pushes `cardId` when
  `fromZone === 'deck'`.
- **Gate on a reader hook, not a waiting grant.** A KO before the play counts, so the record cannot
  wait for a deferred grant (the WP-853/855 gate). It is gated instead on whether any hook in
  `G.heroAbilityHooks` reads it: a condition of either new type, or an effect whose `countSource` is
  the new source. Hooks are built at setup and never change, so a game without Metamorphosis, Bursting
  with Life or World-Spanning Hunger in its hero lineup never gains the field and the `finalStateHash`
  sentinels (none uses wwhk) stay byte-identical. This is the D-24616 posture, and its condition half
  reuses `matchReadsConditionType`. `fromZone === 'deck'` is checked first, so the scan runs only at
  the 9 deck sites.
- **The parse split.** A condition gates its whole line's hook. Metamorphosis and Bursting with Life
  print the Feast and the conditional Transform on one line, so a condition marker on that line would
  also gate the Feast (and the Feast is what makes the condition true). Gamma-Draining Nanites
  (D-24476) works because its card data already splits draw and Transform into two `abilities[]`
  lines. For these two cards a parse-only pre-pass (the `coalesceCountScaledChooseOne` precedent,
  display text untouched) splits the line at its `" Then, "` into a Feast line and a Transform line.
  The condition marker is appended to the end of the printed line by the marker pass, so it lands on
  the Transform half. The pre-pass is allowlisted (`FEAST_THEN_TRANSFORM_CARDS`), so no other card's
  hooks change.
- **Ordering inside the play.** Hooks run in array order: the Feast hook parks its KO-or-keep choice
  (no KO yet), then the Transform hook's condition is checked. If a qualifying card was already KO'd
  from that deck this turn, the Transform fires at once; otherwise the hook waits and fires after the
  move that KOs a qualifying card (normally the Feast's own resolve). The swap touches only `inPlay`
  and `G.transformDeck`, so WP-855's parked-choice hold (deck-snapshot safety) does not apply.
- **The descriptive icon.** "a card with an[icon:attack] icon" is the condition's criterion, not a
  grant. On a line carrying `[keyword:deck-koed-attack-icon]` the parser drops the `attack` keyword
  and magnitude the icon produced (the D-24016 / WP-673 descriptive-token suppression shape), so the
  Transform hook carries no stray `attack` effect.
- **World-Spanning Hunger's bonus counts at resolution.** "You get +2 for each non-grey Hero that was
  KO'd from your deck this turn" includes KOs made by this card's own Feasts, which happen in later
  moves (the prompts). So the bonus has two parts, and their sum is exactly the printed count at the
  moment the ability finishes:
  - **At play:** an `attack-per-count` effect over the new count source
    `non-grey-heroes-koed-from-deck-this-turn` (marker `[keyword:attack-per-count:…:2]`) grants 2 × the
    non-grey Heroes already in the record. The D-24016 icon suppression removes the phantom flat
    `attack:2`.
  - **Per Feast:** each of the three parked Feast entries carries `nonGreyHeroKoAttack: 2`. When the
    player KOs that entry's card and it is a non-grey Hero, the resolve adds +2 Attack. Precedent: the
    optional-KO-reward entry that carries its own reward (`rewardType`, WP-681), here an
    omit-when-absent number on the KO-or-keep entry.
  - A deck KO from another source *after* the three Feasts resolve does not add (the ability has
    resolved). A KO from another source *between* the prompts is also not counted. That is accepted:
    nothing can be played while a reveal-top choice is parked (block-all), so only a deferred grant
    fired by the resolve could cause one.
- **Feast up to three times.** WP-857's probe showed three reveal-top-may-ko parks in one play give
  three sequential prompts, each showing the current top (KO a, keep b, KO b). "Up to three times" is
  three KO-or-keep prompts: keeping a card is choosing not to Feast that time. The kept card stays on
  top and is shown again by the next prompt. A per-card repeat count (`FEAST_REPEAT_COUNTS`,
  World-Spanning Hunger → 3) makes the parser emit three `feast` effects; every other `FEAST_CARDS`
  card emits one. "Look at the top card of your deck" has no separate effect: the first prompt shows
  it.
- **The per-Feast reward's parse source.** The parser stamps `nonGreyHeroKoAttack` on each `feast`
  effect of a hook that also carries an `attack-per-count` effect over the new source, with that
  effect's per-unit `magnitude` (the marker's third segment; it has no fourth). So the value comes
  from the card's one marker, not a second literal.
  `heroEffectRevealTopMayKo` (the `feast` handler) copies the field onto the entry it parks when the
  descriptor carries it. Gruesome Feast, Remove His Spine and Electroshock Therapy never carry it, so
  their entries are byte-identical.
- **Accepted edges (pre-flight RS-7..9).**
  - `replay/replay.execute.ts` (D-24322) runs no clear, so in that harness the turn record carries
    into later turns and can fire a Transform at play or inflate World-Spanning Hunger's play-time
    count. That harness already diverges by design; competition scoring uses `reduceReplay`.
  - The bot's reveal-top default KOs only cullable cards (Wounds, S.H.I.E.L.D. starters), so a bot's
    Metamorphosis transforms only on a Trooper, its Bursting with Life never transforms, and its
    World-Spanning Hunger never earns a per-Feast +2. No bot change here; PAR / sim readers note it.
  - The operator setters (D-24689) have no block-all guard: an operator deck KO between World-Spanning
    Hunger prompts is recorded but not paid. Live-verify should not stage deck KOs between its prompts.
- **Data oddity (follow-up, not here).** Setup puts 5 Torrent of Broodlings in the side deck for 3
  Bursting with Life copies. The surplus is harmless; check it against the printed card list.
- **Synergy.** A Feast KO is a deck KO at an owned site, so it also feeds Absorb Energies (WP-853) and
  Endless Appetite (WP-855). World-Spanning Hunger's Feasts can complete a waiting Metamorphosis or
  Bursting with Life Transform the same turn.
- **Second forms.** Hive King Miek (Feast, in `FEAST_CARDS` since WP-857) and Torrent of Broodlings
  ("Draw a card") become reachable. Per D-24469 the swap applies only the printed attack / recruit;
  their abilities fire when they are played later from hand.
- **One WP, not two.** Considered: splitting World-Spanning Hunger into its own WP. Kept together
  because the three readers share the record, its gate and its turn-boundary clear, and the gate's
  reader set (three types) is the WP's contract. A split would land the record with a partial reader
  list and re-open it one WP later. The list is 12 engine source files (above the ~8 guideline,
  00.3 §5): 7 of them are one- to three-line lockstep entries (a type field, a union member + array
  entry, a `switch` case, a label, a `delete`); the substance is in the parser, the recorder, the
  reveal-top resolve and the evaluator. The pre-flight prototype touched no file outside the list.
- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline + Principle #1 (determinism);
  `.claude/rules/architecture.md` §Persistence Boundary (G runtime-only).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (§5.1 `[keyword:X]`).
- `docs/ai/DECISIONS.md`: scan D-24793, D-24791, D-24792, D-24789, D-24476, D-24469, D-24377,
  D-24016, D-24581, D-24558, D-24372, D-24322 before coding. Auto-memory
  `reference_attack_per_count_marker_mechanism` (the count-source recipe).
- `docs/ai/REFERENCE/00.6-code-style.md`: the code-style rules every file follows.

### RS-1 — Whole-turn window for the Transform (operator ruling, default locked)

"Then, if … was KO'd from your deck this turn, Transform" is read on the D-24377 / D-24476 whole-turn
window: the Transform fires the first time the condition holds during the turn. That is usually the
Feast's own KO, but it can also be a later deck KO from another card if the player kept the Feast card.
The stricter reading (check once, right after the Feast resolves) is buildable with the same per-entry
pattern this WP uses for World-Spanning Hunger: a field on the Feast entry, acted on in the `'ko'`
branch. That would add a second entry field, Transform dispatch from inside the resolve, and a
separate path from the shipped Gamma-Draining Nanites Transform. The whole-turn window is chosen for
parity with Gamma-Draining Nanites (live-confirmed on this window) and fewer moving parts. Confirm at the execution go. If Jeff rules for the strict reading, this WP stops and is
redrafted.

### RS-2 — World-Spanning Hunger counts at resolution (operator ruling, default locked)

The +2 counts non-grey Heroes KO'd from your deck before the play plus those KO'd by its three Feasts.
Deck KOs later that turn do not add. Inherited from WP-857 RS-1: each of the three prompts shows the
current deck top before the choice, but the printed Feast is a blind KO. "Look at the top card" covers
the first prompt; prompts 2 and 3 show cards the player would not have seen, on the card whose reward
depends on what is KO'd. Accepted (co-op, the same delta as WP-857). Confirm at the execution go.

## Scope (In)

- **Record.** `LegendaryGameState.cardsKoedFromDeckThisTurn?: Record<string, CardExtId[]>` (`types.ts`):
  the ids KO'd from each player's deck this turn, in KO order. Lazy, never set in `Game.setup`.
- **Recorder.** `recordOwnedCardKoed` gains a third independent block: when `fromZone === 'deck'` and
  `hasDeckKoRecordReader(G)`, push `cardId` onto `G.cardsKoedFromDeckThisTurn[ownerPlayerID]`
  (creating the map and the list lazily; the `fromZone` test runs first). `hasDeckKoRecordReader(G)`
  (private, same file) = `matchReadsConditionType(G, ATTACK_ICON_DECK_KO_CONDITION_TYPE) ||
  matchReadsConditionType(G, NON_GREY_HERO_DECK_KO_CONDITION_TYPE) ||` a loop over
  `G.heroAbilityHooks` effects for `countSource === 'non-grey-heroes-koed-from-deck-this-turn'`. No call
  site changes.
- **Turn boundary.** `game.ts` `turn.onBegin` and `simulation/onBeginParity.ts` gain a guarded
  `delete G.cardsKoedFromDeckThisTurn` beside the WP-855 delete. Not deleted per resolve.
- **Conditions.** In `hero/heroConditions.evaluate.ts`: `ATTACK_ICON_DECK_KO_CONDITION_TYPE =
  'attackIconCardKoedFromDeckThisTurn'` and `NON_GREY_HERO_DECK_KO_CONDITION_TYPE =
  'nonGreyHeroKoedFromDeckThisTurn'`. `evaluateCondition`: true when some id in
  `G.cardsKoedFromDeckThisTurn?.[playerID] ?? []` has `offPlayCardStats(G, id)?.hasAttackIcon === true`
  / passes `matchesGreyHeroFilter(G, id, 'non-grey')`. `describeFailedCondition`: `'it needs a card
  with an Attack icon to be KO\'d from your deck this turn'` / `'it needs a non-grey Hero to be KO\'d
  from your deck this turn'`. Both are appended to `WAIT_AND_SEE_CONDITION_TYPES` (shape #1: fire
  once, not re-armed, no repeat count).
- **Markers.** `[keyword:deck-koed-attack-icon]` on `wwhk` `miek-the-unhived` / `metamorphosis`
  `abilityIndex: 0`; `[keyword:deck-koed-non-grey-hero]` on `no-name-brood-queen` /
  `bursting-with-life` `abilityIndex: 0`;
  `[keyword:attack-per-count:non-grey-heroes-koed-from-deck-this-turn:2]` on `no-name-brood-queen` /
  `world-spanning-hunger` `abilityIndex: 0`. `VALID_TOKEN_PATTERN` gains exactly two arms,
  `^\[keyword:deck-koed-attack-icon\]$` and `^\[keyword:deck-koed-non-grey-hero\]$` (its count-scaled
  arm already accepts the new source; observed). Regenerate `wwhk.json` (exactly 3 lines change).
- **Parser** (`setup/heroAbility.setup.ts`):
  - `HERO_PARSER_RECOGNIZED_MARKER_NAMES` gains `deck-koed-attack-icon`, `deck-koed-non-grey-hero`;
    two arms beside `owned-hero-koed` push `{ type: <const>, value: '1' }`.
  - **Split.** `const FEAST_THEN_TRANSFORM_CARDS: ReadonlySet<string>` = exactly
    `wwhk/miek-the-unhived/metamorphosis`, `wwhk/no-name-brood-queen/bursting-with-life`. For a listed
    card, `splitFeastThenTransformLine(abilityLines)` (after `coalesceCountScaledChooseOne`) replaces
    each line containing both `[keyword:Feast]` and `[keyword:Transform]` with two lines split at the
    first `" Then, "`: `"<text before>"` and `"Then, <text after>"`. A line without that separator is
    kept whole. Each half becomes its own hook in the per-line loop.
  - **Icon.** On a line carrying `[keyword:deck-koed-attack-icon]`, drop the `attack` keyword and its
    magnitude (beside the D-24016 suppression).
  - **Transform.** Both cards join `SUPPORTED_TRANSFORM_BASES` (each with a `// why:` naming its
    condition, the WP-665 entry shape).
  - **Feast.** `wwhk/no-name-brood-queen/world-spanning-hunger` joins `FEAST_CARDS`.
    `const FEAST_REPEAT_COUNTS: ReadonlyMap<string, number>` = exactly
    `[['wwhk/no-name-brood-queen/world-spanning-hunger', 3]]`. `parseAbilityText`'s options gain
    `feastRepeatCount?: number`, resolved at the call site as `FEAST_REPEAT_COUNTS.get(<canonical key>)
    ?? 1` beside `feastSupported` (the parser is text-only and its keywords are de-duplicated, so the
    count cannot come from the text). The effect-builder loop gains a `keyword === 'feast'` branch that
    pushes `{ type: 'feast' }` `feastRepeatCount` times; the hook's `keywords` stay de-duplicated.
  - **Reward stamp.** After the effect-builder loop: if `effects` has an `attack-per-count` effect
    with `countSource === 'non-grey-heroes-koed-from-deck-this-turn'`, every `feast` effect gets
    `nonGreyHeroKoAttack` = that effect's `magnitude`.
- **Count source.** `'non-grey-heroes-koed-from-deck-this-turn'` appended to `HeroCountSource` and
  `HERO_COUNT_SOURCES` (`rules/heroCountSource.ts`). `resolveCountSource` and
  `explainCountSourceInputs` (`hero/heroCountSource.resolve.ts`) gain a case: the count is the
  record's ids for `playerID` passing `matchesGreyHeroFilter(G, id, 'non-grey')`; the collector returns
  those ids. `describeCountSource` (`hero/countSourceLabel.ts`) gains the label
  `'non-grey Hero KO\'d from your deck this turn'`.
- **Transform base guard (pre-existing gap, widened here).** `heroEffectTransform` does not check
  that the base card is still in play. Observed at pre-flight: a waiting Metamorphosis KO'd from play,
  then a later deck KO, put Hive King Miek into play with +6 Attack while the base stayed in the KO
  pile, so the player gained a card. The two shipped bases that can defer, She-Hulk's Hurl Legal
  Objections (recruit-threshold) and Gamma-Draining Nanites (draw-threshold), have had the same window
  since WP-658 / WP-665; this WP adds two more. Fix: when `baseMove.found` is false, log `blocked` "Player N
  could not Transform <card> — it is no longer in play." and return right after `moveCardFromZone`,
  before any zone is assigned. The
  side-deck lookup stays first, so a missing second form still logs its own line.
- **Descriptor + entry.** `HeroEffectDescriptor.nonGreyHeroKoAttack?: number`
  (`rules/heroAbility.types.ts`) and `RevealedTopEntry.nonGreyHeroKoAttack?: number` (`types.ts`), both
  omit-when-absent. `heroEffectRevealTopMayKo` (`_effect` → `effect`) adds the field to the entry it
  parks only when `effect.nonGreyHeroKoAttack !== undefined`.
- **Reward.** `moves/revealTopDispose.resolve.ts` `'ko'` branch: after the recorder call, when the
  resolved entry carries `nonGreyHeroKoAttack` and `matchesGreyHeroFilter(G, args.cardId,
  'non-grey')`, add that much Attack through the existing economy helper and log
  "Player N gets +2 Attack — <KO'd card> was a non-grey Hero KO'd from their deck (reveal-top)."
  (`applied`; the card name via `formatCardRef`, the amount from the entry).
- **Ledger.** `scripts/hero-mechanic-ledger.mjs` `KNOWN_CONDITIONS` gains `'deck-koed-attack-icon':
  'attackIconCardKoedFromDeckThisTurn'` and `'deck-koed-non-grey-hero':
  'nonGreyHeroKoedFromDeckThisTurn'` (the ledger lists no count sources, so nothing else).
- **Coverage regen:** `ledger:heroes`, `effect-index`, `mechanics:metadata`, `sim:runtime-observed`,
  `sim:coverage --update-baseline`, the dashboard in-play pin if it moves; `mechanic-provenance.json`
  rows exactly `deck-koed-attack-icon` and `deck-koed-non-grey-hero` (`attack-per-count` already has
  one); pending `live-verify.json` rows keyed
  `wwhk/miek-the-unhived|transform` and `wwhk/no-name-brood-queen|transform` (the WP-853 row shape).
- **Tests.** New `hero/feastReaders.test.ts` (hooks parsed from the committed `wwhk.json` /
  `vill.json` through a `getSet` stub, never a hand-built hook and no registry-package import, which
  the layer rule forbids; `buildTransformTargets`; the real resolve moves and the real `LegendaryGame`
  play-phase `turn.onMove`): **14** cases in 5
  `describe` blocks, listed in EC-897. `simulation/onBeginParity.test.ts` +1, `game.test.ts` +1 (the
  real `turn.onBegin` delete). The per-marker loop in `setup/heroAbility.setup.test.ts` generates +2
  (file unchanged). In-place pins (no new case): `WAIT_AND_SEE_CONDITION_TYPES` `deepEqual` +
  `TRUTHY_FIXTURE` (`hero/deferredConditionalGrants.test.ts`; the two entries go after the last entry
  at HEAD), the `HERO_COUNT_SOURCES` drift pin 17 → 18 + its ordered list
  (`hero/heroCountSource.resolve.test.ts`). WP-857's `hero/feast.test.ts` case (2) asserts that
  World-Spanning Hunger keeps `feast` unresolved; this WP intentionally changes that. The case drops
  World-Spanning Hunger and keeps The Void Unchained, edited in place with no count change, and the EC
  commit says so. The at-play World-Spanning Hunger case seeds one non-grey Hero **and** one Trooper
  KO'd from the deck before the play, and asserts exactly +2 (the grey filter of the count source).
  **Locked delta: +18 tests / +5 suites** (pre-flight observed
  +17 on a stand-in base, 6100 → 6117, before the guard case was added). At execution: HEAD + 18.

## Out of Scope

- The Void Unchained (Sentry) and every other wwhk Transform card.
- A blind Feast prompt (WP-857 RS-1); the strict "check once after the Feast" Transform (RS-1 here).
- Firing a second form's own abilities on the swap (D-24469).
- Devouring Frenzy's top-or-bottom look and Hive King Miek's look-and-reorder halves.
- Villain / henchman / Mastermind Feast.
- Any new pending queue, move, `CORE_MOVE_NAMES` entry, prompt, UIState field or client change; any
  change to WP-855's count, hold or WP-853's always-defer branch.
- `replay/replay.execute.ts` keeps its D-24322 posture (no clear; the record accumulates there).

## Files Expected to Change

- `packages/game-engine/src/types.ts` — **modified** — `cardsKoedFromDeckThisTurn?`,
  `RevealedTopEntry.nonGreyHeroKoAttack?`.
- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified** — `nonGreyHeroKoAttack?`.
- `packages/game-engine/src/rules/heroCountSource.ts` — **modified** — the count source.
- `packages/game-engine/src/hero/heroCountSource.resolve.ts` — **modified** — two cases.
- `packages/game-engine/src/hero/countSourceLabel.ts` — **modified** — one label case.
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — two consts + cases.
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` — **modified** — list entries,
  recorder block, `hasDeckKoRecordReader`.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — `heroEffectRevealTopMayKo`
  copies the reward field; `heroEffectTransform` base-in-play guard.
- `packages/game-engine/src/moves/revealTopDispose.resolve.ts` — **modified** — the per-Feast reward.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — markers, split, icon,
  allowlists, repeat count, reward stamp.
- `packages/game-engine/src/game.ts` — **modified** — onBegin guarded delete (01.5 runtime wiring).
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — mirrored delete.
- `scripts/hero-mechanic-ledger.mjs` — **modified** — two `KNOWN_CONDITIONS` entries.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — token arms.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — three wwhk entries.
- `data/cards/wwhk.json` — **modified (generated)**.
- Tests: `packages/game-engine/src/hero/feastReaders.test.ts` (new); `hero/feast.test.ts` (WP-857's;
  case (2) drops World-Spanning Hunger, in place); `hero/deferredConditionalGrants.test.ts`, `hero/heroCountSource.resolve.test.ts`,
  `simulation/onBeginParity.test.ts`, `game.test.ts`.
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
  `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`,
  `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`,
  `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json`,
  `apps/dashboard/src/data/*` coverage copies the regen rewrites;
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (in-play pin, only if it moves).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24795),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets, no "changed section
  only" output; ESM only; Node v22+; human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no new randomness (the Feast reveal's reshuffle uses the existing `ctx.random` path); no
  `Math.random()`, clocks or I/O; moves never throw; `for` loops, no `.reduce()`.
- `G` stays JSON: the record is a plain `Record<string, CardExtId[]>`, written only at a deck KO in a
  game whose hooks read it, deleted at `turn.onBegin` / `applyOnBeginParity`. A game with no reader
  hook never gains it, so the `finalStateHash` sentinels serialize byte-identically — **no re-pin**.
  If a sentinel moves, STOP.
- The two new optional fields are omit-when-absent; Gruesome Feast / Remove His Spine / Electroshock
  Therapy entries and every other card's descriptors stay byte-identical.
- Card data via the marker source + reproducible regen (`cards:check`); never hand-edit `wwhk.json`.
- No other card's hooks change: the split, the repeat count, the icon drop and the reward stamp apply
  only to the allowlisted / marked lines.

**Session protocol:** STOP and report if: the Feast hook of Metamorphosis or Bursting with Life carries
a condition; either Transform hook carries an `attack` keyword or an unresolved marker;
World-Spanning Hunger keeps a flat `attack` effect or a `feast` unresolved marker; a non-wwhk card's
parsed hooks change (the whole-registry hook diff in the EC); or the engine throws a `ReferenceError`
on import (a load-order cycle).

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `G.cardsKoedFromDeckThisTurn?: Record<string, CardExtId[]>`: per-owner ids KO'd from that player's
  deck this turn; present only in a game with a reader hook; cleared at the turn boundary.
- `ATTACK_ICON_DECK_KO_CONDITION_TYPE = 'attackIconCardKoedFromDeckThisTurn'`,
  `NON_GREY_HERO_DECK_KO_CONDITION_TYPE = 'nonGreyHeroKoedFromDeckThisTurn'` (wait-and-see, fire once).
- `HeroCountSource` gains `'non-grey-heroes-koed-from-deck-this-turn'`.
- `HeroEffectDescriptor.nonGreyHeroKoAttack?: number`, `RevealedTopEntry.nonGreyHeroKoAttack?: number`.
- Markers `[keyword:deck-koed-attack-icon]`, `[keyword:deck-koed-non-grey-hero]`.
- `FEAST_THEN_TRANSFORM_CARDS`, `FEAST_REPEAT_COUNTS`, and the `SUPPORTED_TRANSFORM_BASES` /
  `FEAST_CARDS` additions as listed.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10,
§22 (Deterministic & Reproducible Evaluation).
- **No conflict:** two Transforms that never fire and a card that grants a phantom +2 resolve as printed
  (RS-1 whole-turn window, RS-2 resolution-time count).
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — printed hero abilities, nothing bought.
- **Determinism preservation:** no new randomness; the record is a pure function of deterministic KOs,
  absent without a reader hook (no wwhk sentinel). **Setup-only:** a replay starts from the stored
  `initialState`, which holds `G.heroAbilityHooks`. No pre-deploy hook carries the two conditions or the
  new count source (World-Spanning Hunger's pre-deploy hook keeps its flat `attack:2`), so pre-deploy
  matches never write the record, and their readers replay identically. Only matches created after the
  deploy get the new readers (the D-24563 §5 / D-24749 §12 posture). **The Transform guard is a runtime
  change:** a pre-deploy match in which a waiting Hurl Legal Objections or Gamma-Draining Nanites left
  play before its Transform fired diverges on re-execution (no second form, no Attack). Stored
  `competitive_scores` rows stay frozen (D-24616 §5).

## Funding Surface Gate

N/A — no UI, copy, nav or funding surface; hero abilities' engine behaviour, the existing prompt and
log lines.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Metamorphosis and Bursting with Life each parse to two hooks: an unconditional Feast hook and a
   Transform hook carrying `transform` + its one new condition, with no `attack` keyword and no
   unresolved marker. No other card's parsed hooks change.
2. Playing Metamorphosis with no qualifying deck KO this turn parks the Feast and logs the waiting
   line; KOing a card with an Attack icon through it swaps Metamorphosis for Hive King Miek and gives +6
   Attack; keeping, or KOing a card with no Attack icon, leaves Metamorphosis in play.
3. With a qualifying deck KO earlier that turn, the Transform fires at play.
4. Bursting with Life transforms on a non-grey Hero KO'd from the deck and not on a grey Hero, Wound or
   Bystander.
5. World-Spanning Hunger parses to three `feast` effects carrying `nonGreyHeroKoAttack: 2`, one
   `attack-per-count` effect over the new source, and no flat `attack`. Its play grants no Attack
   beyond the printed 4 when nothing qualifying was KO'd. It opens three sequential prompts. Each KO
   of a non-grey Hero gives +2; a keep or a grey KO gives nothing. A non-grey Hero and a grey Hero KO'd
   from the deck before the play give exactly +2 at play.
6. A stale-front re-reveal keeps the entry's `nonGreyHeroKoAttack`.
7. With no reader hook in the game, a deck KO leaves `G` without `cardsKoedFromDeckThisTurn`; with one,
   the record routes to the KO'd card's owner and does not record a discard KO (the other non-deck
   zones rest on the `fromZone === 'deck'` gate and WP-855's deck-zone pin); the turn boundary
   deletes it.
8. Electroshock Therapy's parked entry (a play-time `reveal-top-may-ko`) and Metamorphosis's Feast
   entry keep today's shape `{ ownerPlayerID, cardId, isKoAllowed: true, isDiscardAllowed: false }`,
   with no `nonGreyHeroKoAttack` key.
9. `WAIT_AND_SEE_CONDITION_TYPES` and `HERO_COUNT_SOURCES` pins updated; evaluator lockstep and
   disjointness tests pass.
10. `cards:check` reproduces `wwhk.json`; the ledger reads `transform` `executable` on the Miek and
    No-Name rows and `unsupported` on the other wwhk transform heroes; every feed `:check` exits 0.
11. A waiting Transform whose base card has left play does not fire: logged `blocked`, no second form
    moved, no Attack.
12. Engine suite green at HEAD + 18; `pnpm -r build` 0; `finalStateHash` sentinels
    unchanged with no pin edited.

## Verification Steps

Regenerate (in order, after the engine change builds):

- First add the `mechanic-provenance.json` rows and the two pending `live-verify.json` rows.
- `node scripts/convert-cards/apply-hero-ability-markers.mjs` — exits 0; only `wwhk.json` changes.
- `pnpm -r build` — exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:heroes`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`,
  `pnpm sim:coverage --update-baseline`, `pnpm --filter @legendary-arena/dashboard prebuild:coverage`
  — each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test` — green; every `finalStateHash` / sentinel assert
  (`game.test.ts`, `simulation/*Parity.test.ts`, `test/fixtures/replayFixtures.test.ts`,
  `test/fixtures/hashGameState.test.ts`, `simulation/seatChoiceDispatch.test.ts`,
  `simulation/simulation.captureMoves.test.ts`) passes with no pin literal edited.
- `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm ledger:heroes:check`, `pnpm effect-index:check`,
  `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`.
- `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `node scripts/check-number-ledger.mjs --check` — at govern-close.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine + dashboard suites green; `pnpm -r build` 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance rows added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a real match with Miek and No-Name, created after the deploy, plays
      Metamorphosis and Transforms on a Feast KO of an Attack-icon card, plays Bursting with Life and
      Transforms on a non-grey Hero KO, and plays World-Spanning Hunger with three prompts and +2 per
      non-grey Hero KO'd (no flat +2) — confirmed live, or left open as operator-pending in
      `docs/ai/STATUS.md` with the pending `live-verify.json` rows.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24795 → Active;
      `docs/ai/work-packets/WORK_INDEX.md` checked; `docs/ai/execution-checklists/EC_INDEX.md` Done;
      mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` were modified — `git diff --name-only
      origin/main...HEAD` checked against that list.

## Reserved Decision (lands at execution)

D-24795 — "KO'd from your deck this turn" readers read a turn-scoped record,
`G.cardsKoedFromDeckThisTurn?: Record<string, CardExtId[]>`, fed by `recordOwnedCardKoed` when
`fromZone === 'deck'`. The record is gated on a hook in `G.heroAbilityHooks` that reads it (either new
condition type, or the new count source), not on a waiting grant, because KOs before the play count.
So a game without such a hook never gains the field. It is cleared at `turn.onBegin` /
`applyOnBeginParity`, never per resolve, and accumulates in `replay.execute.ts` (D-24322).
Metamorphosis and Bursting with Life: a parse-only split (`FEAST_THEN_TRANSFORM_CARDS`) turns the
one printed "Feast. Then, if …, Transform" line into a Feast hook and a Transform hook. The Transform
hook carries the `attackIconCardKoedFromDeckThisTurn` / `nonGreyHeroKoedFromDeckThisTurn` wait-and-see
condition (markers `deck-koed-attack-icon` / `deck-koed-non-grey-hero`, fire once). Both cards join
`SUPPORTED_TRANSFORM_BASES`, and the descriptive `[icon:attack]` is dropped on the marked line.
RS-1: whole-turn window (D-24377 / D-24476 posture). World-Spanning Hunger joins `FEAST_CARDS` with
three Feasts (`FEAST_REPEAT_COUNTS`). Its +2 per non-grey Hero is the play-time `attack-per-count`
over `non-grey-heroes-koed-from-deck-this-turn` plus a per-Feast-entry `nonGreyHeroKoAttack` paid on
a non-grey Hero KO, stamped from that count effect's magnitude; the phantom flat +2 is suppressed.
RS-2: counted at resolution. `heroEffectTransform` refuses a base no longer in play (logged `blocked`),
closing a free-card gap that the deferring Transforms (Hurl Legal Objections and Gamma-Draining Nanites included) could hit. Accepted:
the replay.execute harness carries the record across turns; the bot only KOs cullable cards, so it
rarely triggers these readers; an operator deck KO between World-Spanning Hunger prompts is not paid.
RS-2 also accepts that prompts 2 and 3 show a deck top the blind printed Feast would not (WP-857
RS-1). The readers are setup-only: pre-deploy matches keep their hooks and replay identically. The
Transform guard is a runtime fix to the shipped Hurl Legal Objections and Gamma-Draining Nanites, so
a pre-deploy match in which a waiting base left play diverges on re-execution. Stored
`competitive_scores` rows stay frozen (D-24616 §5). Contract: `LegendaryGameState.cardsKoedFromDeckThisTurn?`
and `RevealedTopEntry.nonGreyHeroKoAttack?` (`types.ts`), `HeroEffectDescriptor.nonGreyHeroKoAttack?`
(`rules/heroAbility.types.ts`), `HeroCountSource` member `'non-grey-heroes-koed-from-deck-this-turn'`
(`rules/heroCountSource.ts`), the two condition types and markers. Amends D-24793: `FEAST_CARDS` goes
from 5 to 6 (World-Spanning Hunger), and `FEAST_REPEAT_COUNTS` is added. No new move, queue, prompt or
UIState field.

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1 (independent subagent, full prototype on `origin/main` `e064d497` with
  stand-ins for WP-857 and WP-855):** NOT READY. Dependency gate: WP-855 and WP-857 are Draft, so
  NOT READY until they execute (the 01.0a "Blocking drafts" placeholder path; the Status line and the
  EC STOP line carry it). Content findings, all folded:
  - PS-1: `hero/countSourceLabel.ts` was missing (its label switch is test-pinned). Added, label locked.
  - PS-2: the delta was unlocked. Locked at +17 (6100 → 6117 observed; 13 + 2 generated + 1 + 1),
    now +18 with the RS-3 guard case.
  - PS-3: "emit three feasts" could not work through de-duplicated keywords. Locked
    `feastRepeatCount` + a builder branch; the reward stamp runs after the builder loop.
  - PS-4: the drift-pin path was wrong. Now `hero/heroCountSource.resolve.test.ts`.
  - RS-1: switch wording (`default:` branches; a third switch). RS-2: reuse `matchReadsConditionType`
    (D-24616), `fromZone` first. RS-3: the Transform base-in-play gap, observed as a free card, folded
    in as a guard (drafter's call, a fidelity fix in an allowlisted file). RS-4: AC-8 now names
    Electroshock Therapy. RS-5: hedges removed (two token arms, two provenance rows, no ledger source
    list). RS-6: append after the last wait-and-see entry at HEAD. RS-7..9: accepted edges stated.
    RS-10: AC-7 uses a discard KO.
  - Verified by the prototype: the observed parse of all three cards (Metamorphosis / Bursting: Feast
    hook + Transform hook with its condition, no attack, no unresolved marker; World-Spanning Hunger:
    3 × `{feast, nonGreyHeroKoAttack: 2}` then `attack-per-count`, no flat attack); a whole-registry
    hook diff touching exactly those 3 cards (6418 → 6422 hooks); block-all during the prompts; the
    deferred Transform through the real `turn.onMove`; the re-reveal keeps the field; no load-order
    cycle; the record absent in a core-only game; sentinels unedited and green; `pnpm -r build` 0 with
    no churn; every feed `:check` 0; dashboard 584 / 0 with the in-play pin unmoved.
  - Content verdict after the folds: ready, gated on WP-855 and WP-857.
- **Pre-flight round 2 (same subagent, re-prototyped):** every round-1 fold verified in the WP, EC and
  D-24795 text; all 36 allowlist paths exist at the base (one new file). The guard was proven in the
  prototype: a waiting Metamorphosis KO'd from play, then an Attack-icon deck KO, gives nothing in
  play, an untouched side deck, 0 Attack and the `blocked` line. It is non-vacuous: with the guard off,
  exactly that case fails. Engine **6100 / 1380 → 6118 / 1385, 0 fail (+18 / +5, as locked)**; every
  existing Transform suite (WP-658, WP-665, WP-669 / 670, parser resolution) green; sentinels
  unedited. The 14-case list matches the test file and covers AC 1–11. Folded: PS-5 (the tests
  cannot use the registry package from the engine; reworded to a `getSet` stub over the committed
  card JSON), RS-11 (AC-7 names the discard case and the zone gate), RS-12 (the guard's position).
  Text-only, no scope change: **content READY TO EXECUTE; the verdict on record stays NOT READY until
  WP-855 and WP-857 execute** (01.4 §Dependency & Sequencing; 01.0a "Blocking drafts" placeholder).
- **Copilot round 1 (independent subagent, audited against the source):** RISK → **SUSPEND** (one
  allowlist addition). Folded:
  - (1) WP-857's `hero/feast.test.ts` case (2) breaks once World-Spanning Hunger joins `FEAST_CARDS`.
    Added, edited in place (+18 unchanged). The EC now runs the WP-855 / WP-857 test files at the go.
    The EC_INDEX row was stale; fixed.
  - (2) RS-1's "the engine has no continuation" was false (this WP builds one for RS-2). Reworded to the
    real trade-off.
  - (3) The two extra looks on World-Spanning Hunger are now stated in RS-2 and D-24795.
  - (4) The guard is a runtime change to Hurl Legal Objections and Gamma-Draining Nanites, not
    setup-only. Corrected in Impact, Scope, Vision, D-24795 and WORK_INDEX.
  - (5) The marker's third segment is `<perUnit>`, with no fourth; locked in the EC.
  - (6) D-24795 now lists its contract-file edits and amends D-24793.
  - (7) The at-play case adds a grey Trooper and asserts exactly +2.
  - (8) §16.1 justification, below.
  - (9) Rebased onto `b26ff0d8`, the conflicts kept both rows, counts regenerated, WP-858 overlap noted.

  Verified: the reader gate is constant per match (hooks built once at setup); no new freeze surface;
  guard placement; WP-855 / WP-857 interplay; faithfulness; the UIState filter rebuilds
  `UIRevealedTopEntry` field by field, so the new entry field is not client-visible (the five-step
  rule does not apply); the count-source lockstep; +18 coherent.
- **Pre-flight round 3 (SUSPEND re-run, same pre-flight subagent):** copilot folds (1)–(7) and (9) verified
  across the WP, EC, D-24795 and both index rows. The prototype was re-run at the rebased base (no
  code change since `e064d497`) and is still 6100 → **6118, +18 / +5, 0 fail**, sentinels unedited. The
  strengthened at-play case is non-vacuous: it fails when the grey filter is removed. WP-857's
  `feast.test.ts` case (2) was probed: it fails under WP-859 as locked by EC-895 and passes with World-Spanning
  Hunger dropped. WP-858 overlap: no conflict with any locked value, and HEAD + 18 in either landing
  order. Folded: RS-13 (the lint self-review below, incl. §16.1), RS-14 (an EC line), RS-15 (both bases
  named). RS-16 is optional: a read-only count of stored She-Hulk / Amadeus Cho `competitive_scores` rows
  at execution. **Content READY TO EXECUTE; on record NOT READY until WP-855 and WP-857 execute.**
- **Copilot round 2:** **PASS → CONFIRM**. All nine round-1 fixes verified in the WP, EC, D-24795 and both
  index rows. No drift. The EC is 98 content lines (cap 100). The Lint Self-Review covers §1–§21, and its
  §16.1 reasoning holds. Pre-flight's content-READY stands. Execution waits on WP-855 and WP-857, then
  the EC's at-the-go re-confirmation (HEAD count + 18, the wait-and-see order, the WP-855 / WP-857 test
  files under WP-859).

## Lint Gate Self-Review (00.3)

- **§1 structure:** all template sections are present. Out of Scope names:
  - The Void Unchained and the other wwhk Transforms;
  - a blind prompt and the strict Transform reading;
  - second-form abilities;
  - the other card halves;
  - villain Feast;
  - new moves / queues / UIState;
  - WP-855 internals;
  - replay.

  **PASS.**
- **§2 constraints:** full-file output, no diffs/snippets, ESM, Node v22+, `00.6-code-style.md` cited.
  Packet-specific determinism, `G` and card-data constraints are stated. The session protocol (STOP
  lines) is present, and locked values are in the EC. **PASS.**
- **§3 Assumes:** both unexecuted deps are named with the exact artifacts this WP builds on, plus the
  shipped helpers (`matchReadsConditionType`, `matchesGreyHeroFilter`, `offPlayCardStats`, the three
  count-source switches, `heroEffectTransform`, the re-reveal), the marker pipeline, the tsconfig flags,
  the rebased baseline and the WP-858 overlap. **PASS.**
- **§4 Context:** printed text of all three cards; why a record and why gate on a reader (D-24616); the
  split; hook ordering; the descriptive icon; the resolution-time bonus; Feast ×3; the reward's parse
  source; accepted edges; the data oddity; synergy; second forms; the one-vs-two rationale. Also cited:
  ARCHITECTURE, 00.2 §5 / §5.1, the DECISIONS scan list, the attack-per-count memory, 00.6. **PASS.**
- **§5 files:** every file is marked new / modified with its role; paths verified against the tree at
  pre-flight round 2 (37 paths, `feast.test.ts` included). 12 engine source files exceed the ~8 guideline. Justified in §Context:
  7 are one- to three-line lockstep entries; the record, the reader gate and the turn clear are one
  contract with three readers, so a split would ship a partial reader set; the prototype touched
  nothing outside the list. **PASS (justified).**
- **§6 naming:** full words (`cardsKoedFromDeckThisTurn`, `nonGreyHeroKoAttack`,
  `FEAST_THEN_TRANSFORM_CARDS`, `FEAST_REPEAT_COUNTS`, `feastRepeatCount`); condition and marker names
  follow the D-24789 / D-24791 shape; `KO` as in the rules text; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new dependency; engine + card data only; the engine tests use a
  `getSet` stub over committed JSON (no registry-package import); `G` stays JSON; no randomness beyond
  the reused reveal reshuffle. **PASS.**
- **§9:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`, hooks parsed from committed card data, real resolve moves and
  the real `turn.onMove`, `Object.hasOwn` key checks, a non-vacuous guard case; no `boardgame.io/testing`
  and no network / DB. No deck-construction change, so the golden test is N/A. **PASS.**
- **§13 verification:** exact commands in order, each with its expected exit; the observed count
  (6100 → 6118 on the stand-in base; HEAD + 18 at execution). **PASS.**
- **§14:** 12 binary, observable criteria tied to names and values. **PASS.**
- **§15 / §15.1:** the DoD names STATUS / DECISIONS / WORK_INDEX / EC_INDEX, the scope-boundary diff
  check, and a D-24026 live-on-surface item on a match created after the deploy. **PASS.**
- **§16 code style:** `for` loops, no `.reduce()`, no nested ternaries; `// why:` locations locked in the
  EC; no thrown errors; log strings are full sentences.
  - §16.1: two single-caller helpers, each justified. `splitFeastThenTransformLine` is a named
    pre-pass of `buildHeroAbilityHooks`, which already runs about 250 lines; it follows the
    single-caller `coalesceCountScaledChooseOne` precedent (00.6 Rule 5, small functions).
    `hasDeckKoRecordReader` keeps `recordOwnedCardKoed` to three readable gated blocks, the same shape
    as the shipped single-caller `hasWaitingGrantWithCondition`.
  - No other new helper. The repeat count, reward stamp and guard are inline.

  **PASS (justified).**
- **§17 Vision:** §1/§2/§8/§10/§22, the no-conflict line, the NG-1 line, and the determinism line, with
  the readers setup-only and the guard runtime-corrected. **PASS.**
- **§18:** no literal-grep verification step (pins are tests). **N/A.** **§19:** a commit-time rule;
  the baseline was re-derived after the rebase. **N/A.** Contract files: `types.ts`,
  `rules/heroAbility.types.ts` and `rules/heroCountSource.ts` gain optional fields / one union member +
  array entry, all enumerated in D-24795.
- **§20 funding:** N/A, with the statement above. **§21 API catalog:** N/A. **PASS.**
