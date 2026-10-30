# WP-855 — "Whenever a card is KO'd from your deck this turn, you may draw a card": Miek's Endless Appetite (Game Engine + card data)

**Status:** Draft 2026-10-29 (EC-893; D-24791 reserved)
**Layer:** Game Engine (parse marker + wait-and-see condition + deck-KO signal) + card data
**User-Visible Surface:** play.legendary-arena.com
**Hard-deps:** WP-853 / D-24789 (owned-KO count, KO-site recorders, per-KO firing + re-arm, the
always-defer branch, the per-function KO-site pin) ✅, WP-656 / D-24467 (edge signal + re-arm) ✅,
WP-568 / D-24377 (deferred conditional grants) ✅, WP-744 / D-24567 (sim / PAR / fixture harnesses
mirror the onMove resolve and the onBegin clears) ✅

## Goal

Make Miek's **Endless Appetite** (`wwhk/miek-the-unhived/endless-appetite`) do what it prints:
"Whenever a card is KO'd from your deck this turn, you may draw a card." Today the setup parser
builds an empty hook for the line, so the card gives its printed 3 Attack and nothing else. After
this WP, playing it logs a waiting line, and each card KO'd from that player's **deck** later that
turn draws them one card, once per KO, for each Endless Appetite in play. KOs from hand, discard
pile or cards in play do not draw.

## User-Visible Impact

`play.legendary-arena.com` — playing Endless Appetite logs "… ability is waiting — it needs a card
to be KO'd from your deck this turn". Each later KO of a card from that player's deck (Carnage's
Gruesome Feast reveal-and-KO, a Doombot scry-KO, Crystal of Kadavus, a Melter fight, Red Skull's
Ruthless Dictator) draws one card, logged as a draw from Endless Appetite. A turn with no deck KO
draws nothing. Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` = `67d5f4e1` (the WP-856 reserve merge, #3103; WP-855 reserve `df149a8d`, #3101).
- WP-853 shipped (`bf7150b8`, #3093) and is live-verified (D-24789, match `SMOSJHT1Hc8`):
  - `hero/heroConditions.evaluate.ts` exports `OWNED_CARD_KOED_CONDITION_TYPE =
    'ownedCardKoedThisTurn'` with `evaluateCondition` and `describeFailedCondition` cases.
  - `hero/deferredConditionalGrants.ts` lists it in `WAIT_AND_SEE_CONDITION_TYPES` and exports
    `recordOwnedCardKoed(G, ownerPlayerID)`, gated by the private `hasWaitingOwnedKoGrant(G)`, called
    at the 25 owned KO sites (14 files).
  - `hero/heroEffects.execute.ts` `executeHeroEffects` has the owned-KO always-defer branch
    (`findConditionOfType` + `conditionsWithout`, before `if (!evaluateAllConditions(…))`), and
    `resolveDeferredHeroGrants` fires an owned-KO grant `repeatCount` times, re-arms it via
    `hookHasConditionType`, then deletes `G.ownedCardsKoedSinceResolve`.
  - `game.ts` `turn.onBegin` and `simulation/onBeginParity.ts` delete the owned count.
  - `hero/ownedCardKoTrigger.test.ts` holds the per-function KO-site pin (`LOCKED_TABLE`, value
    `{ koSites, ownedRecords }`, 32 keys / 34 sites / 25 owned); it counts `recordOwnedCardKoed(`
    calls, so a parameter added to the call leaves it unchanged.
- `moves/phaseCard.ts` exports `hasAnyPendingChoice(G)` (every parked choice queue plus
  `pendingSeatChoice` and the two put-bottom-HQ queues; NOT the singular `G.pendingHeroChoice`, which
  every other "nothing parked" guard adds by hand: `outOfTimeGrant.logic.ts`,
  `revealOrWoundChoice.logic.ts`, `enigmaCode.logic.ts`, `timestreamPurge.logic.ts`,
  `operatorSetters.logic.ts`). `heroEffects.execute.ts` already reaches `phaseCard.js` transitively
  (through `outOfTimeGrant.logic.ts` and `revealOrWoundChoice.logic.ts`), so a direct import adds no
  new load-order edge.
- The setup parser turns `[keyword:draw:1]` into a `draw` effect on the line's hook, and a
  condition-only marker on the same line gates that hook (observed, §Context). `heroEffectDraw`
  respects the draw lock (D-24552) and adds to `cardsDrawn`.
- `data/cards/wwhk.json` is GENERATED; markers live in
  `scripts/convert-cards/inputs/hero-ability-markers.json` (set `wwhk`, keyed `heroSlug` /
  `cardSlug` / `abilityIndex`; several entries may share one `abilityIndex`, as Venompool's
  Shenanigans does) and are applied by `apply-hero-ability-markers.mjs`, whose
  `VALID_TOKEN_PATTERN` must list every token.
- The engine `tsconfig.json` sets `exactOptionalPropertyTypes: true`; optional `G` fields are
  removed with `delete`.

## Context (Read First)

- **Parse today (observed 2026-10-29, `df149a8d`).** `buildHeroAbilityHooks` on
  `data/cards/wwhk.json` for `wwhk/miek-the-unhived` gives, for each of the 3 Endless Appetite
  copies, `{ timing: 'onPlay', keywords: [] }` — no condition, no effect. The line does nothing; no
  phantom grant. `hero-mechanic-ledger.csv` has no `endless-appetite` row.
- **Scaffold (observed).** The same probe with `[keyword:owned-card-koed] [keyword:draw:1]`
  appended in memory gives one hook per copy: `keywords: ['draw','conditional']`, `conditions:
  [{ type: 'ownedCardKoedThisTurn', value: '1' }]`, `effects: [{ type: 'draw', magnitude: 1 }]`.
  The new `deck-card-koed` arm only swaps the condition type. Without the arm, the marker leaves an
  **unconditional** draw plus an unresolved marker — hence engine first, regen second, and the STOP
  line below.
- **One recorder, told the source zone (coordinated with WP-856).** "A card you own" (D-24789)
  counts hand, deck, discard and play; "a card KO'd from your deck" is a subset. Rather than a second
  recorder at the deck sites, `recordOwnedCardKoed` gains a required `fromZone` parameter
  (`'hand' | 'deck' | 'discard' | 'inPlay'`) at all 25 call sites, and the recorder also bumps a
  per-owner deck count when `fromZone === 'deck'`. The compiler then makes every owned KO site state
  its zone, and a new site cannot skip it. WP-856 (Doctor Voodoo's Possessed by Brother's Spirit,
  D-24792, drafted in parallel) adds the KO'd `cardId` to the same function. Agreed final signature:
  `recordOwnedCardKoed(G, ownerPlayerID, cardId, fromZone)`. If WP-856 executed first, keep its
  `cardId` and append `fromZone`; if this WP executes first the signature is
  `(G, ownerPlayerID, fromZone)` and WP-856 inserts `cardId` before it. Neither WP edits the other's
  count or condition. WP-856's draft also renames the private gate to
  `hasWaitingGrantWithCondition(G, conditionType)` and turns WP-853's early `return` into gated blocks;
  if that has landed, this WP reuses the helper and adds its deck block beside the owned one.
- **Zone per owned site (observed at `df149a8d`; paths under `packages/game-engine/src/`).**
  `'deck'` (9): `hero/heroEffects.execute.ts` `applyRevealKo`; `moves/melterKoChoice.resolve.ts`;
  `moves/revealThreeAssign.resolve.ts` `applyRevealThreeDisposition`;
  `moves/revealTopDispose.resolve.ts`; `moves/ruthlessDictatorChoice.resolve.ts`;
  `moves/scryKoChoice.resolve.ts`; `villain/villainEffects.execute.ts` `villainEffectScryKoOwnDeck`
  (the single-card auto-KO path) and `villainEffectRevealTopKoGreyOrDrawByClass`; plus
  `moves/operatorSetters.ts` `koFromPlayerZone`, which passes `from.zone` (narrowed past
  `'victory'`). The other 16 pass the zone they removed from: `heroEffectKo` `'inPlay'`;
  `heroEffectKoWoundReward` / `heroEffectKoWound` their `targetZone` (`'hand' | 'discard'`);
  `healWounds` `'hand'`; `resolveKoDiscardChoice` `'discard'`; `resolveKoHeroChoice` `args.zone` and
  `forced.zone`; `resolveOptionalKoReward` `targetZone` (its existing `as` narrowing, reused, not new); `applyCrushPacifistResistanceKo`
  `sourceZone`; `resolveRedSkullStrike` `'hand'`; `koOneHeroForPlayer` `'inPlay'` / `'hand'`;
  `koHeroesFromZoneForPlayer` `zone`; `koSingleTarget` `target.zone`;
  `villainEffectKoHeroesCurrentByTrait` `targetZones[index]` (the existing index-aligned list);
  `villainEffectKoWoundsCurrentHandAndDiscard` a new index-aligned `koedWoundZones` list built in its
  two existing scan loops. None of those 16 types admits `'deck'`. Firepower from the Future (WP-850)
  discards the top four and KOs from the **discard pile**, so it is not a deck KO.
- **"You may draw" is auto-applied.** Drawing is pure upside here: a draw costs nothing, a draw lock
  already blocks it, and an empty deck and discard is a logged no-op. The engine auto-resolves a
  pure-upside "may" rather than parking a choice with no real decision (D-24470 §4: "a parked choice
  with no downside would only add a freeze surface"; D-24183 KO-Wound reward; WP-681's officer take).
  The draw goes through the hook's ordinary `draw` effect, so it counts toward `cardsDrawn`. RS-1.
- **The draw waits while a choice is parked (the hold).** The resolve runs after every move,
  including one that leaves a reveal choice open. Several deck-KO sites resolve one card of a
  multi-card deck-top snapshot: Red Skull's Ruthless Dictator tactic (look at the top three, KO one,
  discard one, put one back; its move relies on "the block-all guard guarantees the deck top still
  holds the revealed cards while pending"), Crystal of Kadavus, a queued second scry. A draw right
  after the KO step would take a still-snapshotted card; Ruthless Dictator and scry-KO keep the queue
  intact on a missing card, so the remaining disposition could never resolve (a frozen turn). Gambit's
  Kinetic Card parks the singular `G.pendingHeroChoice` on `deck[0]` and does NOT block play, so a
  deck KO can happen while it is open. The existing `refreshStaleKoOrKeepFront` (D-24581) re-reveals a
  stale single-card KO-or-keep entry, but cannot repair a multi-card snapshot with dispositions
  partly made, so this WP holds instead: while `hasAnyPendingChoice(G) || G.pendingHeroChoice !==
  undefined` at the start of the resolve, a deck-KO grant does not fire and the deck count is kept;
  the draws land after the move that closes the last parked choice, from the deck top as it then
  stands. Absorb Energies (Recruit) never needed this and is unchanged.
- **onMove order.** The seat-choice openers (escape, Purge, reveal-or-wound, Diving / Flying Shield
  Block, Out of Time, Enigma) run after the resolve (`game.ts` onMove), so the hold does not see a
  choice they open that move; none of them snapshots a player's deck, so this is harmless.
- **Accepted edges.**
  - As WP-853: a deck KO earlier in the same move as the play (only via a Steal Abilities / Copy
    Powers pass with a deck-KO grant already waiting) is counted for the new copy too; a deck KO
    caused by a grant fired inside the resolve is consumed by the post-resolve delete.
  - A held draw is lost if the turn ends while one of the two put-bottom-HQ choices is open: those
    queues are in `hasAnyPendingChoice` but `endTurn` does not check them (the D-24629 gap documented
    in `phaseCard.ts`), and `turn.onBegin` then deletes the count. No freeze and no hash leak; the
    draw is simply not paid. Closing that `endTurn` gap is out of scope.
  - A held count can pay a copy played after the KO: `pendingHeroChoice` does not block `playCard`
    (only `endTurn`), so while Gambit's Kinetic Card choice is open a player can KO a deck card (held),
    then play another Endless Appetite, which always defers and, on release, draws for that earlier KO
    too. The WP-853 same-move edge, stretched across the held window; reachable only with a Kinetic
    Card choice left open. Accepted (the alternative is a per-grant baseline, out of scope).
  - Same-resolve ordering: `canFire` is evaluated for every entry before any fires, so a wait-and-see
    grant that would park a deck-snapshot choice and fires before Endless Appetite in the same resolve
    would slip past the start-of-resolve hold. No marker today combines a wait-and-see gate with such a
    park (the marker map was checked); accepted and recorded in D-24791.
- **Feast is not implemented (scope note).** In World War Hulk, Feast means "KO the top card of
  your deck" (`keywords-full.json`). The hero Feast keyword is `unsupported` in the ledger for Miek
  (Devouring Frenzy, Metamorphosis, Hive King Miek), No-Name and Sentry, so in a game whose only
  deck-KO source is Feast, Endless Appetite has nothing to react to until Feast ships. Feast is a new
  hero keyword with its own handler: a follow-up WP. Its KO site will pass `'deck'` to the recorder
  like every other deck site.
- **Neighbours (design consistency only).** Metamorphosis ("if a card with an [icon:attack] icon was
  KO'd from your deck this turn"), Bursting with Life and World-Spanning Hunger ("for each non-grey
  Hero that was KO'd from your deck this turn") read a **turn total with a card filter**, not a
  per-KO trigger. The count here is consumed every resolve, so it cannot serve them; they need a
  turn-scoped record keyed by card and zone (the recorder's `cardId` + `fromZone` parameters are the
  natural place to feed it), with Feast, in their own WP. This WP names its field
  `deckCardsKoedSinceResolve` (the D-24789 naming) so a later turn-total field is not confused with it.
- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline + Principle #1 (determinism);
  `.claude/rules/architecture.md` §Persistence Boundary (G runtime-only).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 Ability Text Markup Language (§5.1 `[keyword:X]`).
- `docs/ai/DECISIONS.md` — scan D-24789, D-24467, D-24377, D-24567, D-24470, D-24552, D-24581,
  D-24629, D-24322, D-24372 before coding.
- `docs/ai/REFERENCE/00.6-code-style.md` — the code-style rules every file follows.

### RS-1 — "You may" (operator ruling, default locked)

Default locked: the draw is automatic, per the pure-upside precedent above. If Jeff rules it must
be a choice, that is a new pending-choice queue, move, prompt and bot default (a different WP
shape); this WP stops and is redrafted. Confirm at the execution go.

## Scope (In)

- **Marker.** `[keyword:deck-card-koed]` (single segment, no magnitude). `VALID_TOKEN_PATTERN` arm
  `^\[keyword:deck-card-koed\]$`. Two `wwhk` entries for `heroSlug: "miek-the-unhived"`,
  `cardSlug: "endless-appetite"`, `abilityIndex: 0`, in this order: `[keyword:deck-card-koed]`, then
  `[keyword:draw:1]`. Regenerate `wwhk.json`.
- **Parser.** `HERO_PARSER_RECOGNIZED_MARKER_NAMES` gains `deck-card-koed` after `owned-card-koed`;
  a parser arm beside the `owned-card-koed` arm pushes `{ type: DECK_CARD_KOED_CONDITION_TYPE,
  value: '1' }`. The line's `[keyword:draw:1]` stays the hook's `draw:1` effect.
- **Condition.** `DECK_CARD_KOED_CONDITION_TYPE = 'deckCardKoedThisTurn'`, exported from
  `hero/heroConditions.evaluate.ts` beside `OWNED_CARD_KOED_CONDITION_TYPE` (same load-order reason),
  imported by `deferredConditionalGrants.ts`, `heroEffects.execute.ts` and the parser. Appended to
  `WAIT_AND_SEE_CONDITION_TYPES` after the owned-KO entry.
  `evaluateCondition` case: `(G.deckCardsKoedSinceResolve?.[playerID] ?? 0) > 0`.
  `describeFailedCondition` case: `'it needs a card to be KO\'d from your deck this turn'`.
- **Signal.** `LegendaryGameState.deckCardsKoedSinceResolve?: Record<string, number>` — KOs from each
  player's deck since the last resolve that fired. `recordOwnedCardKoed` gains
  `fromZone: OwnedKoSourceZone` (exported type `'hand' | 'deck' | 'discard' | 'inPlay'` in
  `deferredConditionalGrants.ts`) as its last parameter and runs two independent gated increments:
  the owned count (unchanged) when an owned-KO grant waits, and the deck count when `fromZone ===
  'deck'` and a deck-KO grant waits. The private gate `hasWaitingOwnedKoGrant(G)` becomes
  `hasWaitingGrantWithCondition(G, conditionType)` and serves both.
- **KO sites.** All 25 owned call sites pass their zone per §Context. `villainEffectKoWoundsCurrentHandAndDiscard`
  builds `koedWoundZones` (index-aligned, pushed in its existing hand and discard loops) and its record
  loop becomes an index loop; `villainEffectKoHeroesCurrentByTrait`'s record loop (`for (const koedId of
  targets)`) also becomes an index loop to read `targetZones[index]`. The engine sets
  `noUncheckedIndexedAccess`, so both read the index-aligned pair with `!` (`targets[index]!`,
  `targetZones[index]!`; `koedWounds[index]!`, `koedWoundZones[index]!`) under a `// why:` (built in the
  same loop, same length) — never a `?? 'hand'` fallback. No KO-site behaviour changes; the 9 non-owned sites are untouched.
- **Always defer at play.** The WP-853 branch in `executeHeroEffects` widens from the owned-KO type
  to "a per-KO trigger": the branch's condition lookup becomes
  `findConditionOfType(hook, OWNED_CARD_KOED_CONDITION_TYPE) ?? findConditionOfType(hook,
  DECK_CARD_KOED_CONDITION_TYPE)` (inline — one use, no new helper, 00.6 Rule 1); the branch's guard, record, log (reason = `describeFailedCondition` of that condition) and `continue`
  are otherwise unchanged. The defeat family still takes today's path.
- **Firing.** In `resolveDeferredHeroGrants`:
  - **Hold.** Before `resolveDeferredConditionalGrants`, `const isDeckKoDrawHeld =
    hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined;` (`hasAnyPendingChoice` imported
    from `moves/phaseCard.ts`). The check callback returns `false` for a hook carrying
    `DECK_CARD_KOED_CONDITION_TYPE` while `isDeckKoDrawHeld`, before its `evaluateAllConditions` call.
  - **Per-KO repeat.** `repeatCount` = the owner's owned count for an owned-KO hook (unchanged), the
    owner's deck count for a deck-KO hook (`Math.max(1, G.deckCardsKoedSinceResolve?.[entry.playerId]
    ?? 0)`), else 1.
  - **Re-arm** when the hook carries the defeat, owned-KO or deck-KO type.
  - **Consume.** After the resolution, `delete G.deckCardsKoedSinceResolve` when it is set and
    `!isDeckKoDrawHeld`, beside the owned-count delete (which stays unconditional).
- **Turn boundary.** `game.ts` `turn.onBegin` and `simulation/onBeginParity.ts` gain a guarded
  `delete` of the field beside the owned-count delete.
- **Deck-zone pin** (in the new test file). It copies the WP-853 scan helpers (`stripComments`,
  `enclosingFunction`, `listSourceFiles`, the scan loop — private to `ownedCardKoTrigger.test.ts`, which
  stays frozen; a second copy, duplicate-first) and the same scan rules (non-test `.ts` under
  `packages/game-engine/src/`, comments stripped, nearest preceding `function <name>(`, the recorder's
  own definition skipped) and maps `<path>#<function>` → the count of `recordOwnedCardKoed(` calls
  whose argument list (to the matching `)`) contains the literal `'deck'`; entries with 0 omitted;
  `deepEqual` to the 8 literal-deck functions (all except `koFromPlayerZone`). Non-vacuous: a
  synthetic `'deck'` call in the wrong function changes the map. The WP-853 `LOCKED_TABLE` is
  unchanged (it counts calls, not arguments).
- **Ledger.** `scripts/hero-mechanic-ledger.mjs` `KNOWN_CONDITIONS` gains `'deck-card-koed':
  'deckCardKoedThisTurn'`.
- **Coverage regen:** `ledger:heroes`, `effect-index`, `mechanics:metadata`, `sim:runtime-observed`,
  `sim:coverage --update-baseline`, the dashboard in-play pin if it moves; a
  `mechanic-provenance.json` row for `deck-card-koed`; a pending `live-verify.json` row keyed
  `wwhk/miek-the-unhived|deck-card-koed` (the WP-853 row shape).
- **Tests.** New `hero/deckCardKoTrigger.test.ts`, **+17** cases in four `describe` blocks (parse +
  play; per-KO draw + routing; hold; deck-zone pin). Hooks come from the setup parser on the committed
  `wwhk.json`, never a hook-less fixture. Cases: (1) parse — the deck-KO condition + only a gated
  `draw:1`, no unconditional effect, 3 copies; (2) play draws nothing and logs the waiting line;
  (3) play, then a `resolveScryKoChoice` KO from the player's deck draws 1 (hand +1); (4) a second deck
  KO in a later move draws 1 more; (5) a non-KO move after a KO draws nothing; (6) a discard KO
  (`resolveKoDiscardChoice`) draws nothing and, before the resolve, `Object.hasOwn(G,
  'deckCardsKoedSinceResolve')` is false; (7) two copies and one deck KO draw 2; (8) a deck KO before
  the play (no choice parked) draws nothing; (9) a Melter KO of Player 1's deck card (`ownerPlayerID: '1'`) draws nothing
  for Player 0 AND, before the resolve, `deepEqual(G.deckCardsKoedSinceResolve, { '1': 1 })`;
  (10) **hold, Ruthless Dictator** — KO step first: after that move's resolve nothing is drawn and the
  count is still `{ '0': 1 }`; after the final disposition the player draws 1, the queue is empty, and
  the drawn card is the one put back; (11) **hold, `pendingHeroChoice`** — a hand-built pending
  discard-or-return choice plus a deck KO draws nothing; after `resolveHeroChoice` with `resolution:
  'discard'` the player draws 1 and the drawn id is the card that lay below the discarded one; (12) Absorb Energies and Endless Appetite both waiting, one deck KO → +2 Recruit and
  1 draw; (13) no deck-KO grant waiting → a deck KO (`G.ko` grew by 1) leaves no
  `deckCardsKoedSinceResolve` key; (14) the turn boundary clears entry and count
  (`applyOnBeginParity`); (15) a count already above 0 at play still records the grant (always-defer);
  (16) the deck-zone pin; (17) its non-vacuous case. Plus `game.test.ts` **+2** (the per-move consume
  through the real `LegendaryGame` play-phase `turn.onMove`; the turn-boundary delete through the real
  `turn.onBegin`) and `simulation/onBeginParity.test.ts` **+1** (deletes the field). In place, no new
  case: `hero/deferredConditionalGrants.test.ts` list `deepEqual` + a `TRUTHY_FIXTURE` entry. The
  `setup/heroAbility.setup.test.ts` file is unchanged, but its per-marker loop generates one more case
  (`deck-card-koed reaches its parser arm`). Expected engine delta **+21**. Unchanged:
  `hero/ownedCardKoTrigger.test.ts` (its failure message's two-argument example goes stale; left for
  WP-856) and the `heroConditions.evaluate.test.ts` disjointness test.

## Out of Scope

- Hero **Feast** (wwhk) and the turn-total "KO'd from your deck this turn" readers (Metamorphosis,
  Bursting with Life, World-Spanning Hunger): a follow-up WP (new keyword + turn-scoped record).
- A pending choice for the "may" (RS-1 default: auto-draw).
- Doctor Voodoo's Possessed by Brother's Spirit (WP-856) and its `cardId` parameter.
- Absorb Energies' behaviour and the owned count (only the call signature changes).
- The `endTurn` put-bottom-HQ guard gap (D-24629) and the stale-snapshot behaviour of other deferred
  draw grants (the hold covers the deck-KO type only).
- New hero keyword, handler, pending choice, move, `CORE_MOVE_NAMES` entry or UIState field.
- `replay/replay.execute.ts` keeps its D-24322 posture (no resolve, no clear).

## Files Expected to Change

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — condition const +
  evaluate + describe cases.
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` — **modified** — list entry,
  `OwnedKoSourceZone`, the recorder's `fromZone` + deck count, shared gate helper.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — per-KO trigger
  always-defer, hold, deck repeat count, re-arm, consume; four owned sites pass their zone.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — marker name + parser arm.
- `packages/game-engine/src/types.ts` — **modified** — `deckCardsKoedSinceResolve?`.
- `packages/game-engine/src/game.ts` — **modified** — onBegin guarded delete (01.5 runtime wiring).
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — mirrored delete.
- Owned KO sites — **modified** — each call gains its zone: `moves/healWounds.ts`,
  `moves/koDiscardChoice.resolve.ts`, `moves/koHeroChoice.resolve.ts`,
  `moves/melterKoChoice.resolve.ts`, `moves/optionalKoReward.resolve.ts`,
  `moves/revealThreeAssign.resolve.ts`, `moves/revealTopDispose.resolve.ts`,
  `moves/ruthlessDictatorChoice.resolve.ts`, `moves/scryKoChoice.resolve.ts`,
  `moves/seatChoiceTactics.ts`, `moves/operatorSetters.ts`, `rules/mastermindHandlers.ts`,
  `villain/villainEffects.execute.ts` (incl. `koedWoundZones`).
- `scripts/hero-mechanic-ledger.mjs` — **modified** — `KNOWN_CONDITIONS` entry.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — **modified** — token arm.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — two wwhk entries.
- `data/cards/wwhk.json` — **modified (generated)**.
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
  `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`,
  `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`,
  `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json`,
  `apps/dashboard/src/data/*` coverage copies the regen rewrites;
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (in-play pin, only if it moves).
- Tests: `packages/game-engine/src/hero/deckCardKoTrigger.test.ts` (new),
  `hero/deferredConditionalGrants.test.ts`, `simulation/onBeginParity.test.ts`, `game.test.ts`.
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24791),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file — no diffs, no snippets, no "changed section
  only" output; ESM only; Node v22+; human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no new randomness source (the draw's reshuffle uses the existing `ctx.random` path);
  no `Math.random()`, clocks or I/O; moves never throw; `for` loops, no `.reduce()`.
- `G` stays JSON: the deck count is a plain `Record<string, number>`, created lazily, written only
  while a deck-KO grant waits; deleted after every unheld resolve and at the turn boundary. While a
  choice is parked it may survive a move boundary; that happens only with a waiting Endless Appetite
  grant. `replay/replay.execute.ts` (D-24322) accumulates by design — leave it.
- A game in which no Endless Appetite grant is waiting never gains the field, so the
  `finalStateHash` sentinels serialize byte-identically — **no re-pin**. If a sentinel moves, STOP.
- Card data via the marker source + reproducible regen (`cards:check`); never hand-edit `wwhk.json`.
- No per-card special-casing in the parser or executor; no new hero keyword.

**Session protocol:** if the parsed Endless Appetite hook carries an unconditional `draw` or an
unresolved marker, or the waiting line reads the generic fallback, or the engine throws a
`ReferenceError` on import (a load-order cycle), STOP and report.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `DECK_CARD_KOED_CONDITION_TYPE = 'deckCardKoedThisTurn'` (wait-and-see, repeatable per KO).
- `recordOwnedCardKoed(G, ownerPlayerID, fromZone: OwnedKoSourceZone): void` — `fromZone` required;
  `(G, ownerPlayerID, cardId, fromZone)` once WP-856 has landed.
- `type OwnedKoSourceZone = 'hand' | 'deck' | 'discard' | 'inPlay'`.
- `G.deckCardsKoedSinceResolve?: Record<string, number>` — per-owner deck-KO count since the last
  resolve that fired; absent when none.
- Marker `[keyword:deck-card-koed]` → that condition on the line's hook.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10,
§22 (Deterministic & Reproducible Evaluation).
- **No conflict:** a printed trigger that does nothing today resolves as printed.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched — a printed hero ability, nothing bought.
- **Determinism preservation:** no new randomness source; the count is consumed inside the move (or
  held only across moves that keep a choice parked) in live play and the sim / PAR / fixture mirrors;
  absent for every game with no waiting Endless Appetite grant, so the sentinels are byte-identical.
  Replays of pre-WP-855 matches that played Endless Appetite and KO'd a deck card diverge on
  re-execution (a draw appears); stored `competitive_scores` rows are frozen, not re-verified
  (D-24616 §5).

## Funding Surface Gate

N/A — no UI, copy, nav or funding surface; a hero ability's engine behaviour and one log line.

## API Catalog Update

N/A — no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. Playing Endless Appetite draws nothing and logs the waiting line naming "KO'd from your deck".
2. Each card KO'd from the player's deck after that, the same turn, draws one card per Endless
   Appetite played.
3. A KO from hand, discard pile or cards in play, a move with no KO, and a KO before the play (outside
   a held `pendingHeroChoice` window) draw nothing.
4. A KO from another player's deck draws nothing for the active player (the count is routed to the
   owner).
5. While any choice (including `pendingHeroChoice`) is parked, the deck-KO draw waits and the count
   survives; the draw happens after the move that closes the last parked choice, and the Ruthless
   Dictator case completes with an empty queue.
6. Absorb Energies is unchanged (its tests pass untouched), and with both cards waiting one deck KO
   pays both.
7. The next turn starts with no waiting grant and no count; with no deck-KO grant waiting a KO
   leaves `G` without `deckCardsKoedSinceResolve`.
8. Every owned KO site passes a typed source zone (build 0); the deck-zone pin matches the 8
   literal-deck functions and its non-vacuous case passes; the WP-853 pin passes unedited.
9. `WAIT_AND_SEE_CONDITION_TYPES` pin and evaluator lockstep updated; the disjoint test still passes.
10. `cards:check` reproduces `wwhk.json`; the ledger lists `deck-card-koed` for
    `wwhk/miek-the-unhived` as `condition`; every feed `:check` exits 0.
11. Engine suite green at baseline +21; `pnpm -r build` 0; `finalStateHash` sentinels unchanged with
    no pin edited.

## Verification Steps

Regenerate (in order, after the engine change builds):

- First add the `deck-card-koed` row to `scripts/coverage/mechanic-provenance.json` and the pending
  `wwhk/miek-the-unhived|deck-card-koed` row to `docs/ai/coverage/live-verify.json`.
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
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance row added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** a real match with Miek and a deck-KO source (Carnage's Gruesome
      Feast, or the operator `ko-from-player` setter from the deck) plays Endless Appetite, then KOs
      a card from the deck; the hand grows by one per KO and not on play — confirmed live, or left
      open as operator-pending in `docs/ai/STATUS.md` with the pending `live-verify.json` row.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24791 → Active;
      `docs/ai/work-packets/WORK_INDEX.md` checked; `docs/ai/execution-checklists/EC_INDEX.md` Done;
      mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0.
- [ ] No files outside `## Files Expected to Change` were modified — `git diff --name-only
      origin/main...HEAD` checked against that list.

## Reserved Decision (lands at execution)

D-24791 — "Whenever a card is KO'd from your deck this turn, <reward>" is the
`deckCardKoedThisTurn` wait-and-see condition (marker `deck-card-koed`) on the line's own reward
effect, a deck-only sibling of D-24789's owned-KO count. `recordOwnedCardKoed` takes the KO'd card's
source zone (`OwnedKoSourceZone`, required at every owned site) and also counts per owner the KOs
from the deck, gated on a waiting deck-KO grant; the resolve fires the grant once per counted KO,
re-arms it and deletes the count. The per-KO trigger always defers at play (D-24789 §5, widened to
both types). "You may draw a card" is auto-applied (pure upside; D-24470 posture). A deck-KO grant is
held, and its count kept, while any choice (`hasAnyPendingChoice` or `pendingHeroChoice`) is parked
at the start of the resolve, so a draw never takes a card a reveal choice still holds. Accepted: a
held draw is lost if the turn ends under an open put-bottom-HQ choice (D-24629 `endTurn` gap); a copy
played while a held `pendingHeroChoice` window is open also draws for the held KO; and a
same-resolve grant that parks a deck snapshot before Endless Appetite fires is not held (none exists
today). Contract: `LegendaryGameState.deckCardsKoedSinceResolve?: Record<string, number>` — lazy,
gated, deleted after each unheld resolve and at `turn.onBegin` / `applyOnBeginParity`, never set in
`Game.setup`; `replay.execute.ts` accumulates by design (D-24322). Coordinated with WP-856 / D-24792:
final recorder signature `(G, ownerPlayerID, cardId, fromZone)`. Hero Feast and the turn-total
"KO'd from your deck this turn" readers stay out (follow-up). Replays of pre-WP-855 Endless Appetite
matches diverge; stored competitive rows stay frozen (D-24616 §5).

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1 (independent subagent):** NOT READY — PS-1: the hold missed the singular
  `G.pendingHeroChoice` (Gambit's Kinetic Card discard-or-return parks on `deck[0]` and does not block
  play) → hold widened, test (11) added. PS-2: "a held count is always paid inside the turn" was false
  (put-bottom-HQ queues are not checked by `endTurn`, D-24629) → restated as an accepted edge. RS-1
  load order a non-issue (transitive edge already exists) → in §Assumes. RS-2 cite
  `refreshStaleKoOrKeepFront` → §Context. RS-3 same-resolve ordering edge → accepted, in D-24791.
  RS-4 onMove order → §Context. RS-5 WP-856 / D-24792 named. RS-6 test count locked (+21 after round 2). All
  folded. Verified correct: the 9 deck sites (every `G.ko =` write maps to a pin entry), the other
  sites' zone types, parse + scaffold, marker shape, draw lock / `cardsDrawn`, no wwhk sentinel.
- **Design change after round 1 (coordination, not a finding):** the WP-856 drafting session proposed
  one recorder with a source-zone parameter instead of a second recorder; adopted (compiler-enforced
  zone at every owned site; one signature for both WPs). Round 2 re-checks the revised design.
- **Pre-flight round 2:** NOT READY — PS-1: the count is +21, not +20 (the `heroAbility.setup.test.ts`
  per-marker loop adds a case) → fixed in WP + EC. RS-1 `resolveKoHeroChoice` passes `args.zone`, not
  `targetZone`; RS-2 the trait site's record loop becomes an index loop too; RS-3 `optionalKoReward`'s
  `as` is pre-existing; RS-4 the pin copies the scan helpers; RS-5 a stale message in the frozen WP-853
  test (left). All folded. Verified: all 25 zones type-check without new casts, the `koFromPlayerZone`
  narrowing, the WP-853 pin unaffected, the 8 literal-deck sites, the WP-856 hand-off is compiler-safe,
  WP/EC lists match. The fix is a locked-count correction, no scope change: **READY TO EXECUTE**.
- **Copilot round 1 (independent subagent):** RISK → HOLD, five scope-neutral fixes, all folded: (1) the
  hold stretches the same-move edge across a held `pendingHeroChoice` window → accepted edge, AC-3 and
  test (8) qualified, D-24791 text; (2) `noUncheckedIndexedAccess` → the two index-loop sites read with
  `!` under a `// why:`, locked in the EC; (3) the WP-856-first path reuses its
  `hasWaitingGrantWithCondition` rather than renaming again; (4) rebased onto the WP-854 close and the
  mindmap counts re-derived; (5) test (11) pins `resolution: 'discard'` and the drawn id. Verified: no
  freeze, no double-pay, no hash leak beyond the stated case, the sim / PAR / fixture mirrors inherit the
  hold, D-24470 §4 quote, +21, all 25 sites. Also folded at the same time (lint §16.1): the single-use
  `findPerKoTriggerCondition` helper became an inline `??` of two `findConditionOfType` calls.

## Lint Gate Self-Review (00.3)

- **§1 structure:** all template sections present; Out of Scope names Feast + the turn-total readers,
  the "may" choice, WP-856, Absorb Energies, the D-24629 gap, replay. **PASS.**
- **§2 constraints:** full-file output, no diffs/snippets, ESM, Node v22+, `00.6-code-style.md` cited;
  packet-specific determinism + `G` constraints; session protocol (STOP lines); locked values → EC. **PASS.**
- **§3 Assumes:** WP-853 artifacts with their exports and shapes, `hasAnyPendingChoice` and its
  `pendingHeroChoice` gap, the draw effect, the marker pipeline, `exactOptionalPropertyTypes`, baseline. **PASS.**
- **§4 Context:** observed parse + scaffold, the per-site zone table, the hold rationale, accepted
  edges, ARCHITECTURE §Rule Execution Pipeline, 00.2 §5 / §5.1, the DECISIONS scan list, 00.6. **PASS.**
- **§5 files:** every file listed `— modified` / `— new` with its role. 13 owned-KO-site files plus
  the hero core exceed ~8: justified in §Context (the compiler-enforced zone has to reach every owned
  site, a mechanical one-argument edit; a split would leave the build red). **PASS (justified).**
- **§6 naming:** full words (`fromZone`, `deckCardsKoedSinceResolve`, `OwnedKoSourceZone`); `KO` per the
  rules text; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new dependency; engine + card data only; no registry import in the
  engine; `G` stays JSON; randomness only via the existing draw path. **PASS.**
- **§9:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`, real parsed hooks, `Object.hasOwn` key checks, no
  `boardgame.io` import, no network / DB; no deck-construction change (golden test N/A). **PASS.**
- **§13 verification:** exact commands, each with its expected exit / output. **PASS.**
- **§14:** 11 binary, observable criteria tied to names and values. **PASS.**
- **§15 / §15.1:** DoD names STATUS / DECISIONS / WORK_INDEX / EC_INDEX, the scope-boundary diff check,
  and the D-24026 live-on-surface item for `play.legendary-arena.com`. **PASS.**
- **§16 code style:** no new single-use helper (the always-defer lookup is inline; the gate helper is a
  rename serving two callers); `for` loops, no `.reduce()`, no nested ternaries; `// why:` locations
  locked in the EC; no thrown errors added. **PASS.**
- **§17 Vision:** §1/§2/§8/§10/§22, no-conflict line, NG-1 line, determinism line. **PASS.**
- **§18:** no literal-grep verification step (the pins are tests). **N/A.** **§19:** commit-time rule. **N/A.**
  Contract files: `types.ts` gains one optional field and `recordOwnedCardKoed` a parameter, both
  covered by D-24791.
- **§20 funding:** N/A with the statement above. **§21 API catalog:** N/A. **PASS.**
