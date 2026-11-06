# WP-864 — Demolish: Fin Fang Foom's Master Strike, Trull the Unhuman, Zzutak and Piledriver (Game Engine + card data)

**Status:** Draft 2026-11-05 (EC-902; D-24807 reserved, PR #3172)
**Layer:** Game Engine (one shared Demolish resolver, one Master Strike arm, one villain primitive) + card data
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay logic (Hero Deck order, every player's hand); no new `G` field, no auth, money, persistence or
server surface
**Hard-deps:** WP-821 / D-24754 (the each-player cost discard at strike timing: `selectDefaultCostDiscardCard`, Arnim Zola's
`discardCardOfCostForEachPlayer`) ✅, WP-846 / D-24780 (each-player loops start with the current player, `seatsInTurnOrderFrom`) ✅,
WP-668 / D-24481 (reveal the Hero Deck top and rotate it to the bottom by rebind) ✅, WP-252 / D-24023 (parameterized villain
primitives; the no-param terminal parse branch) ✅, WP-862 / D-24804 (the last appended primitive, position 39) ✅

## Goal

Demolish does nothing today. In operator match `vZXSkk4xJNC` (2-player, Fin Fang Foom vs Midtown Bank Robbery) both Master
Strikes (log 9.1.1 and 14.1.1) only logged "Mastermind strike revealed — strike count incremented." The rulebook (Universal
Rules v23 p.24; `data/metadata/keywords-full.json` key `demolish`) says "Demolish each player" means: reveal the top card of the
Hero Deck, note its cost, put it on the bottom of the Hero Deck; each player reveals their hand and discards a card with that
cost. One card is revealed in total, not one per player. After this WP:

- **Fin Fang Foom** (chmp mastermind), Master Strike: "[Demolish] each player, then do it again for each Monsters Unleashed
  Villain in the city and Escape Pile." Demolish runs once, plus once per Monsters Unleashed Villain in the City and the Escape
  Pile.
- **Trull the Unhuman** (chmp Monsters Unleashed), Ambush: "Trull captures a Bystander. Then [Demolish] each player." Both halves
  run. The capture does nothing today either: the line is in the marker map's `_unassigned` list.
- **Zzutak** (chmp Monsters Unleashed), Escape: "[Demolish] each player."
- **Piledriver** (chmp Wrecking Crew), Escape: "[Demolish] each player." Same text as Zzutak, so it needs no extra code. Its Fight
  line keeps its current marker.

## User-Visible Impact

`play.legendary-arena.com`: when a Fin Fang Foom Master Strike resolves, the log names the revealed Hero and its cost, says it
went to the bottom of the Hero Deck, and lists what each player discarded ("Player 0 discarded Repulsor Rays (cost 3)", by seat id), or says
a player had no card of that cost. This repeats once per Monsters Unleashed Villain in the City and Escape Pile. Each repeat
reveals the new top card. Trull's Ambush captures a Bystander, then Demolishes. Zzutak's and Piledriver's Escapes Demolish.
Players' hands lose the named cards. Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` `adbe8c14` (2026-11-05, the WP-864 reservation #3172 merged on top of D-24806 #3169; re-recorded at
  commit). `pnpm -r build` 0; game-engine 6299 / 0 at draft (measured on `260af872`; #3172 is ledger-only).
- `rules/mastermindHandlers.ts`: `mastermindStrikeHandler(gameState, strikeContext, payload, _implementationMap)` (~1356)
  branches on `gameState.selection.mastermindId`. A mastermind that matches no branch "takes no branch and the strike is generic
  bookkeeping only" (~1367). That fall-through is why Fin Fang Foom logged only the counter line. `resolveCurrentPlayer(context)`
  (~211) returns the active player, or `null` in stub contexts. `discardCardFromHand` (~622) wraps the `discardFromHand`
  chokepoint. `resolveArnimZolaStrike` / `discardCardOfCostForEachPlayer` (~943 / ~993) are the closest existing shape: each
  player auto-picks one card of a cost through `selectDefaultCostDiscardCard`.
- `G.selection.mastermindId` for Fin Fang Foom is `chmp/fin-fang-foom` (the match LAGN `setup.mastermind.id`). Mastermind setup
  takes the first non-tactic face, and the Epic face is unreachable until an opt-in exists (D-24193).
- Hero Deck: `G.heroDeck[0]` is the top (`board/city.logic.ts` `refillHqSlot` ~229). The bottom is the end of the array
  (`moves/resolvePutAnyNumberBottomHQ.ts` ~91). `heroEffectRevealHeroDeckAttack` (`hero/heroEffects.execute.ts` ~3336-3355)
  rotates by rebind, `G.heroDeck = [...G.heroDeck.slice(1), topCardId]`, and never uses `.shift()`. `offPlayCardStats(G,
  cardId)` (`hero/splitCard.logic.ts` ~140-156) gives an off-play card's printed cost (a split card's cost counts once, face a's;
  only its Attack / Recruit are totalled, D-24604).
- `moves/villainDefeatRequirement.logic.ts`: `selectDefaultCostDiscardCard(state, playerId, eligibleCosts)` (~237) returns the
  hand card of a listed cost, earliest in hand order on a tie (every eligible card has the same cost here, so it is the earliest
  one), or `null`. It reads `isHandCardCostOneOf` → `offPlayCardStats(...).cost`; a card with no stats is never eligible.
  `moves/discardFromHand.ts` `discardFromHand(G, playerId, cardId)` (~198) is the hand-discard chokepoint; it fires the WP-498
  return-on-discard reaction. `turn/seatOrder.logic.ts` `seatsInTurnOrderFrom(seatIds, currentPlayer)` (~33) gives the D-24780
  order (a `null` current player keeps sorted order).
- City and Escape Pile: `G.city` is `CitySpace[]` (default 5 spaces, can grow; null when empty; `city.types.ts` ~42), so the count
  loops `G.city.length`. `G.escapedPile: CardExtId[]` (`types.ts` ~2814) is the append-only Escape Pile. Villain instance ids follow
  `{setAbbr}-villain-{groupSlug}-{cardSlug}-{NN}` (`villainDeck.setup.ts` ~515), so every Monsters Unleashed card starts with
  `chmp-villain-monsters-unleashed-` (`rules/clashMonsterPit.logic.ts` ~31-33, a module-private constant). The Escape Pile's other
  contents (Bystanders, captured Heroes) never match it.
- Villain timings: the escape path pushes the card to `G.escapedPile` (`villainDeck.reveal.ts` ~614), then runs `onEscape` inline
  (~664). The executor runs a hook's descriptors in order (`villainEffects.execute.ts` ~216-244), so Trull's capture happens before
  its Demolish. But the generic `Ambush effect:` line for the capture is pushed only after the executor returns (`villainDeck.reveal.ts`
  ~375-382), so in the log the Demolish lines appear before the capture line.
- Villain primitives: `VillainEffectPrimitive` + `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts` ~381 / ~526; 39 at
  HEAD, last `hq-hero-gains-size-changing`). The parser `setup/villainAbility.setup.ts` accepts any listed primitive with no
  params through the terminal `parts.length === 1` branch (~985), so a no-param primitive needs no grammar arm. The handler table
  is in `villain/villainEffects.execute.ts` (~4690-4726). Its type is `VillainEffectHandler(G, currentPlayer, cardId, timing,
  descriptor, …)` (~981), and `villainEffectTimingLabel(timing)` (~2023) gives `Ambush` / `Fight` / `Escape`. A keyword-less
  primitive self-narrates and returns `{ targets: [] }`. The executor writes no generic `<timing> effect:` line for it. The
  executor already imports `discardFromHand`, `seatsInTurnOrderFrom`, `offPlayCardStats` and
  `moves/villainDefeatRequirement.logic.ts`, so a new board helper importing those modules adds no cycle.
- Length 39 is pinned only in `rules/villainAbility.types.test.ts`: the ordered list (~363-403), the length assert (~407), the
  last-entry assert (~412), and the totals at ~633, ~668, ~694, ~746. The WP-837 `slice(34, 38)` pin (~747) is unaffected by an
  append.
- Marker pipeline: `scripts/convert-cards/apply-effect-markers.mjs` keeps a hand-synced primitive list (~186-228). Its terminal
  no-param validator is `return parts.length === 1` (~501). Legacy keywords append first, then primitives in authored order
  (~623-634), so `["captureBystander", "demolish-each-player"]` appends in printed order. `inputs/villain-effect-markers.json`
  `villains.chmp` holds `monsters-unleashed/goom`, `/sporr` and `wrecking-crew/piledriver` (`fight: ["koHeroCurrentPlayer"]`).
  `_unassigned` holds the Trull Ambush row (`reason: "other"`, ~444). `data/cards/chmp.json` is GENERATED (`cards:check`).
- Coverage: the villain ledger lists Piledriver `koHeroCurrentPlayer` executable and Trull and Zzutak `(unmarked)`
  (`docs/ai/coverage/villain-mechanic-ledger.json` ~1271 / ~1326 / ~1337). `effect-implementation-index.json` tracks mastermind
  **tactics** only, with no Master Strike rows, so the dropped strike was invisible to coverage. `runtime-observed-hollows.json`
  is swept on a core sentinel board (no chmp villain or mastermind); its `demolish` row is the fear Nul hero cards
  (`parse-unrecognized`) and stays unchanged.
- The only `finalStateHash` sentinel (`packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`) uses core cards only.

## Context (Read First)

- **Why one resolver.** About two dozen printed lines across chmp, fear and vill say Demolish (Fin Fang Foom, Pagliacci and its three
  tactics, five Wrecking Crew / Monsters Unleashed villains, Gwenpool, Nul, Uru-Enchanted Iron Man, Nick Fury, four vill Avengers).
  They differ only in who is Demolished, how many times, and what follows. So the rule lives once in `board/demolish.logic.ts`
  and returns what it did. The strike, the villain primitive and later readers ("for each player that discards a card this way";
  Epic Fin Fang Foom's "KO all the Heroes Demolished this way") call it. Nothing parses the word `Demolish`. Card lines reach it
  through the strike arm or an `[effect:demolish-each-player]` marker.
- **Scope settled.**
  - *Trull and Zzutak are in.* They are in Fin Fang Foom's Always-Leads group, so they are in every Fin Fang Foom match.
    Piledriver prints the identical Escape and costs one marker.
  - *The hollow flag is out (follow-up WP).* A Master Strike with no branch should be flagged, but doing it widens the locked
    `HollowEffectRecord.cardType` union in `diagnostics/hollowEffect.types.ts` (`hero | villain | henchman`). It also touches every
    unimplemented mastermind in 41 sets. `recordHollowEffect` writes a `G.messages` line, and `computeStateHash` hashes `G.messages`
    (`replay/replay.hash.ts` ~49-59), so replay hashes and sim baselines move for every such match. And it wants Master Strike rows
    in the effect index, which tracks tactics only. That is a diagnostics-surface WP of its own, not card fidelity.
  - *Fin Fang Foom's tactic Fight effects are out.* They belong to the tactic-Fight arc (WP-497+); Alien Dragon Technology shipped
    in WP-862. Sporr's grant is WP-862.
- **Interpretation (RS-2, flagged in D-24807).** "Do it again for each Monsters Unleashed Villain in the city and Escape Pile" is
  read as `1 + count` Demolishes, with the count taken once when the strike starts (a Demolish moves no Villain). Each repeat is a
  full Demolish: it reveals the then-top card, so the card a prior repeat bottomed is not revealed again unless the deck is that
  short.
- **The discard is auto-picked (RS-3).** The rulebook lets each player choose which card of that cost to discard. This WP
  auto-picks the earliest card of that cost in hand order for every player, the current player included, through the shared
  `selectDefaultCostDiscardCard`. That is the WP-821 Arnim Zola strike precedent ("an interactive pick is out of scope"). Every
  candidate has the same cost, so the pick only decides which same-cost card goes. An interactive pick (the WP-817 every-player
  seat choice) is a follow-up.
- **Determinism / hash.** No new `G` field and no randomness: the rotation and the discards are deterministic functions of `G`.
  The strike arm is dispatcher code, not a setup hook, so an in-flight Fin Fang Foom match gets it after deploy. The three villain
  lines are setup-built hooks from card data, so their live-verify needs a match created after the deploy. Replays of pre-WP-864
  matches that hit a Fin Fang Foom strike, Trull's Ambush, or a Zzutak / Piledriver escape diverge on re-execution. Stored
  `competitive_scores` rows stay frozen (D-24616 §5). No sentinel uses chmp.
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, §Rule Execution Pipeline, Principle #1. Scan D-24754, D-24780, D-24481,
  D-24023, D-24193, D-24654 and D-24804 in `docs/ai/DECISIONS.md` before coding. `docs/ai/REFERENCE/00.6-code-style.md`.

### RS-1 — The Demolish resolver (default locked)

New `board/demolish.logic.ts` (no boardgame.io, no registry, no `.reduce()`, never throws):

`demolishEachPlayer(G, currentPlayer: string | null, logPrefix: string): DemolishResult`, with `DemolishResult { revealedCardId:
CardExtId | null; cost: number | null; discards: DemolishDiscard[] }` and `DemolishDiscard { playerId: string; cardId: CardExtId }`.

1. `const revealedCardId = G.heroDeck[0]`. If it is `undefined`: log `${logPrefix} the Hero Deck is empty, so nothing is
   Demolished.` (`blocked`) and return `{ revealedCardId: null, cost: null, discards: [] }`.
2. Rotate it to the bottom by rebind, `G.heroDeck = [...G.heroDeck.slice(1), revealedCardId]`.
3. `cost = offPlayCardStats(G, revealedCardId)?.cost`. If it is `undefined`: log `${logPrefix} Demolish revealed <name> and put it
   on the bottom of the Hero Deck, but it has no cost, so no one discards.` (`blocked`) and return `{ revealedCardId, cost: null,
   discards: [] }`.
4. Log `${logPrefix} Demolish revealed <name> (cost N) and put it on the bottom of the Hero Deck.` (`applied`).
5. For each `playerId` in `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)`: `cardId =
   selectDefaultCostDiscardCard(G, playerId, [cost])`. If it is `null`: log `${logPrefix} Player P has no card that costs N to
   discard.` (`blocked`). Otherwise call `discardFromHand(G, playerId, cardId)`, log `${logPrefix} Player P discarded <name> (cost
   N).` (`applied`) and push `{ playerId, cardId }`.

`<name>` is `resolveCardName(G.cardDisplayData, id)` (`log/logDisplay.ts`); `P` is the raw `${playerId}` (the Arnim Zola strike
precedent, `mastermindHandlers.ts` ~1005 / ~1011); `N` is `${cost}`. No `card` argument is passed to `pushLog` (`G.messages` is
hashed, so this choice is locked). The one reveal per call is the rulebook's "Reveal only
one card".

### RS-2 — Fin Fang Foom's Master Strike (default locked)

In `rules/mastermindHandlers.ts`, add constants `MASTERMIND_FIN_FANG_FOOM = 'chmp/fin-fang-foom'` and
`MONSTERS_UNLEASHED_EXT_ID_PREFIX = 'chmp-villain-monsters-unleashed-'`, then `resolveFinFangFoomStrike(gameState,
currentPlayer)`:

- `count` = the non-null `G.city` spaces whose id starts with the prefix, plus the `G.escapedPile` entries that start with it.
- `total = 1 + count`. Log `[Fin Fang Foom Master Strike] Demolish each player ${total} time(s): once, plus once for each of the
  ${count} Monsters Unleashed Villain(s) in the city and Escape Pile.` (`neutral`).
- Call `demolishEachPlayer(gameState, currentPlayer, '[Fin Fang Foom Master Strike]')` `total` times in a `for` loop.

Dispatcher arm: `else if (mastermindId === MASTERMIND_FIN_FANG_FOOM) { resolveFinFangFoomStrike(gameState,
resolveCurrentPlayer(strikeContext)); }`, placed before the existing terminal `mastermindStrikeResolved` emission, which stays.
The Epic face ("KO all the Heroes Demolished this way") is unreachable (D-24193) and out of scope; `DemolishResult.discards`
leaves room for it.

### RS-3 — The discard pick (default locked)

Every player, the current player included, discards `selectDefaultCostDiscardCard(G, playerId, [cost])`: the earliest card of
that cost in hand order. Demolish parks no seat choice of its own, so it never blocks a move. The WP-498 / WP-705 reactions that
`discardFromHand` queues for a discarded card that has one (`G.pendingReturnOnDiscard`, `G.pendingTeleportReturns`) are expected and
left as they are. A player with no card of that cost logs the
RS-1 `blocked` line. A revealed card costing 0 makes 0-cost cards (S.H.I.E.L.D. starters) eligible, as printed.

### RS-4 — The villain primitive (default locked)

Append `'demolish-each-player'` last (position 40) to `VillainEffectPrimitive` and `VILLAIN_EFFECT_PRIMITIVES`. It has no params
and no descriptor fields; the existing terminal branch parses it. Handler `villainEffectDemolishEachPlayer(G, currentPlayer,
cardId, timing)` → `demolishEachPlayer(G, currentPlayer, `${villainEffectTimingLabel(timing)} effect:`)`, returning `{ targets: [] }`
(keyword-less, so it self-narrates). Table entry `'demolish-each-player': villainEffectDemolishEachPlayer`. The marker script's
primitive list gains the same entry. Markers (`villain-effect-markers.json`, `villains.chmp`):

| Card | Key | Timing | Markers |
|---|---|---|---|
| Trull the Unhuman | `monsters-unleashed/trull-the-unhuman` | `ambush` | `["captureBystander", "demolish-each-player"]` |
| Zzutak | `monsters-unleashed/zzutak` | `escape` | `["demolish-each-player"]` |
| Piledriver | `wrecking-crew/piledriver` | `escape` | `["demolish-each-player"]` (its `fight` entry unchanged) |

The Trull row is removed from `_unassigned`.

**Ordering (accepted, no change to `villainDeck.reveal.ts`).** Trull: the state order is capture, then Demolish (printed order).
The log shows the Demolish lines before the generic `Ambush effect:` capture line, because the reveal path pushes that line after
the executor returns. Zzutak / Piledriver: the Demolish resolves inline at `onEscape`, before the deferred escape procedure
(HQ KO, Bystander-carry discard). That is the accepted D-24656 deviation, the same as every other inline Escape effect.

## Scope (In)

- **New module** `packages/game-engine/src/board/demolish.logic.ts`: `demolishEachPlayer`, `DemolishResult`, `DemolishDiscard`
  (RS-1).
- **Strike** (`rules/mastermindHandlers.ts`): the two constants, `resolveFinFangFoomStrike`, the dispatcher arm (RS-2).
- **Primitive** (`rules/villainAbility.types.ts`, a contract file, D-24807): union member and array entry (RS-4).
- **Handler** (`villain/villainEffects.execute.ts`): `villainEffectDemolishEachPlayer` plus its table entry.
- **Data:** marker-script primitive list, the three marker entries, the `_unassigned` removal, regenerated `data/cards/chmp.json`.
- **Coverage:** a `mechanic-provenance.json` row `demolish-each-player` → `{ wp: "WP-864", decision: "D-24807" }`; pending
  `live-verify.json` rows (Fin Fang Foom strike, Trull, Zzutak, Piledriver); regenerated `ledger:villains`, `effect-index`,
  `mechanics:metadata`, `sim:runtime-observed`, `sim:coverage` (baseline only if it moves) and the dashboard coverage copies (`prebuild:coverage`).
- **Tests** (new `board/demolish.logic.test.ts`; villain hooks from the real parser on the committed `chmp.json`):
  - RS-1: one reveal per call; the revealed card ends at the bottom and the deck length is unchanged; each player discards their
    earliest card of that cost; a player without one logs `blocked` and keeps their hand; current-player-first order (D-24780,
    visible in log order); an empty Hero Deck logs `blocked` and changes nothing; a revealed card with no `G.cardStats` entry rotates, logs the no-cost
    line, and nobody discards; a 0-cost reveal discards a 0-cost hand card; the returned `discards` list.
  - RS-2 through the real `mastermindStrikeHandler` with `selection.mastermindId = 'chmp/fin-fang-foom'`: no Monsters Unleashed
    Villain → exactly one Demolish; two in the City and one in the Escape Pile → four Demolishes, four distinct top cards
    revealed in deck order; a non-Monsters-Unleashed Villain in the City is not counted; the `mastermindStrikeResolved` notable
    event is still emitted.
  - RS-4: Trull's Ambush line parses to `captureBystander` then `{ primitive: 'demolish-each-player' }`; Zzutak's and Piledriver's
    Escape lines parse to the primitive (Piledriver's Fight is unchanged); a synthetic `[effect:demolish-each-player:2]` line lands in the hook's `unresolvedMarkers` (the
    synthetic-registry precedent in `setup/villainAbility.setup.test.ts` ~250); executing
    Trull's Ambush attaches a Bystander to Trull and then Demolishes. Assert the state (the attached Bystander, the discards, the
    deck rotation), not the log order.
  - Pins: `rules/villainAbility.types.test.ts` list append plus length 39 → 40 at every site above, the last-entry assert →
    `demolish-each-player`, and the "39" / "position 39" strings in the `it()` title (~363) and assert messages (~408, ~413), and the `// why:` comments above the length asserts at ~632 / ~667 / ~692 (add "WP-864 (D-24807) 40",
    total → 40).
  - Expected unchanged: every `finalStateHash` sentinel, the Arnim Zola / other strike tests, `runtime-observed-hollows.json`.

## Out of Scope

- **Flagging an unresolved Master Strike** in the hollow detector / Play Diagnostics, and Master Strike rows in the effect index:
  a separate diagnostics WP (Context).
- **Epic Fin Fang Foom** (unreachable, D-24193) and its "KO all the Heroes Demolished this way".
- **Other Demolish lines:** Pagliacci's numbered strikes and its three tactics; Bulldozer, Thunderball and The Wrecker (conditional
  or counted); Gwenpool's I'm the Best at Board Games, Nul's two cards, Uru-Enchanted Iron Man, Nick Fury; and the four vill
  Avengers (Captain America / Iron Man / Thor Overrun, Hulk "twice"). vill has no curated villain markers yet, and its
  Ally / Lair / Bindings vocabulary needs its own check. Each is a follow-up that reuses `demolishEachPlayer`.
- An interactive "which card of that cost" pick (RS-3); Fin Fang Foom's tactic Fight effects (WP-497+ arc); Sporr / Alien Dragon
  Technology (WP-862).
- Any new `G` field, pending queue, move, UIState field, client or server change; `replay/replay.execute.ts`.

## Files Expected to Change

- `packages/game-engine/src/board/demolish.logic.ts`: **new**, RS-1.
- `packages/game-engine/src/rules/mastermindHandlers.ts`: **modified**, RS-2.
- `packages/game-engine/src/rules/villainAbility.types.ts`: **modified**, the primitive (contract file; D-24807).
- `packages/game-engine/src/villain/villainEffects.execute.ts`: **modified**, handler plus table entry.
- `scripts/convert-cards/apply-effect-markers.mjs` and `scripts/convert-cards/inputs/villain-effect-markers.json`: **modified**.
  `data/cards/chmp.json`: **generated**.
- Generated / provenance: `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json` (expected unchanged),
  `scripts/coverage/hero-effect-coverage.baseline.json` (only if it moves), `scripts/coverage/mechanic-provenance.json`,
  `docs/ai/coverage/live-verify.json`. The `apps/dashboard/src/data/*` coverage copies are gitignored (never in the diff); only
  the tracked `apps/dashboard/src/data/in-play-hollow-baseline.json` and `apps/dashboard/src/composables/useInPlayCoverage.test.ts`
  change, and only if the in-play pin moves.
- Tests: `packages/game-engine/src/board/demolish.logic.test.ts` (**new**), `packages/game-engine/src/rules/villainAbility.types.test.ts`.
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24807), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code; see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O. Use `for` loops; no `.reduce()`, no nested ternaries. Moves and handlers never throw.
- Every hand discard goes through `discardFromHand`. The Hero Deck is rotated by rebind, never `.shift()` / `.splice()`.
- Card data changes only through the marker sources plus a reproducible regen (`cards:check`); never hand-edit generated card JSON.
  No per-card special-casing beyond the Fin Fang Foom strike arm.

**Session protocol:** STOP and report if any sentinel or golden hash moves; if a Demolish reveals more than one card per call; if
the regen changes any card file other than `chmp.json`; or if any other mastermind's strike test changes.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `demolishEachPlayer(G, currentPlayer, logPrefix): DemolishResult` (RS-1), exported from `board/demolish.logic.ts`.
- Villain primitive `demolish-each-player` (no params, position 40).
- `mastermindStrikeHandler` gains the `chmp/fin-fang-foom` arm; its signature and terminal emission are unchanged.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).
- **No conflict:** a printed keyword that does nothing today now resolves as the rulebook defines it.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched; these are printed card abilities and nothing is bought.
- **Determinism preservation:** no randomness and no new state; the Hero Deck rotation and the discards are pure functions of `G`.
  Pre-WP-864 replays that hit these effects diverge on re-execution; stored competitive rows stay frozen (D-24616 §5).

## Funding Surface Gate

N/A: no nav, pricing or funding surface. The only output is log lines.

## API Catalog Update

N/A: no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. A Fin Fang Foom Master Strike Demolishes each player `1 + N` times, where N is the number of Monsters Unleashed Villains in
   the City and Escape Pile at the strike. Each Demolish reveals one Hero Deck card, puts it on the bottom and has each player
   discard a card of that cost (RS-1, RS-2).
2. A player with no card of that cost discards nothing and the log says so. An empty Hero Deck logs and changes nothing.
3. Trull's Ambush captures a Bystander, then Demolishes. Zzutak's and Piledriver's Escapes Demolish. Piledriver's Fight is
   unchanged.
4. Discards run current player first, then clockwise (D-24780), each through `discardFromHand`.
5. `cards:check` reproduces the card data. The villain ledger lists Trull, Zzutak and Piledriver's Escape executable under
   `demolish-each-player`. Every feed `:check` exits 0.
6. Engine and dashboard suites are green; `pnpm -r build` exits 0; `finalStateHash` sentinels are unchanged.

## Verification Steps

Regenerate, in this order, after the engine change builds:

- Add the provenance row and the pending `live-verify.json` rows first.
- `node scripts/convert-cards/apply-effect-markers.mjs`: exits 0, and only `data/cards/chmp.json` changes.
- `pnpm -r build`: exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:villains`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`, `pnpm sim:coverage --check`
  (`--update-baseline` only if it reports a move), `pnpm --filter @legendary-arena/dashboard prebuild:coverage`: each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test`: green. The baseline is 6299; record the exact delta and expect at least +12.
- `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`,
  `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`, `pnpm cards:count-markers:check`.
- At govern-close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check` and
  `node scripts/check-number-ledger.mjs --check`.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine and dashboard suites green; `pnpm -r build` exits 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance row added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** in a Fin Fang Foom match **created after the deploy** (`isMatchOlderThanServer: false`), a
      Master Strike logs the Demolish reveal and each player's discard, repeated once per Monsters Unleashed Villain in the City
      and Escape Pile. Check it from the Demolish log lines and the hand sizes in Play Diagnostics (Hero Deck order is not in
      UIState; an operator debug match's `heroDeckTopFirst` shows it, D-24689). Plus
      Trull's Ambush or a Zzutak escape, confirmed live, or operator-pending in `STATUS.md` with the pending `live-verify.json`
      rows.
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24807 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap
      ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified; checked with `git diff --name-only origin/main...HEAD`.

## Reserved Decision (lands at execution)

D-24807: "Demolish each player" (rules v23 p.24) is one shared engine resolver, `demolishEachPlayer` in
`board/demolish.logic.ts`. It reveals `G.heroDeck[0]` once, rotates it to the bottom, and has each player in D-24780 order discard
the earliest card of its printed off-play cost through `discardFromHand`. The pick is automatic for every player (the WP-821
Arnim Zola precedent; an interactive pick is deferred). It returns what it revealed and who discarded what. Fin Fang Foom's Master
Strike calls it `1 + N` times, where N is the Monsters Unleashed Villains (id prefix `chmp-villain-monsters-unleashed-`) in the City
and Escape Pile at the strike: an interpretation of "do it again for each", flagged for the operator. Each repeat reveals the
then-top card. A no-param villain primitive, `demolish-each-player` (position 40), runs it for Trull the Unhuman's Ambush (after
its Bystander capture; its log shows the Demolish lines before the generic capture line), Zzutak's Escape and Piledriver's Escape
(inline at `onEscape`, before the deferred D-24656 escape procedure). Flagging a Master Strike that reaches no branch is deferred to a
diagnostics WP (it widens `HollowEffectRecord.cardType` and shifts hashed `G.messages` for every unimplemented mastermind).
Replays of pre-WP-864 matches with these effects diverge; stored competitive rows stay frozen (D-24616 §5).

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1:** READY TO EXECUTE, no PS items. Every Assumes bullet and all five hard-deps were verified at HEAD. The
  five RS items were folded as wording, with no change to scope or contract: (1) Trull's log order (the generic capture line is
  pushed after the executor returns) is locked as accepted, and the RS-4 test asserts state, not log order; (2) the DoD
  live-verify no longer asks Play Diagnostics for Hero Deck order, which UIState does not carry, and points to the log lines or an
  operator debug match instead; (3) the baseline was re-recorded to `adbe8c14`; (4) Assumes corrections: the ledger line order,
  `G.city` is `CitySpace[]` (default 5), and a split card's cost counts once; (5) the Escape Demolish resolves inline before the
  deferred D-24656 procedure, stated in RS-4 and D-24807.
- **Copilot round 1:** RISK → HOLD, five wording / test-plan findings, all folded (no scope or contract change, so no pre-flight
  re-run): (26/22) the EC guardrail "no pending queue is touched" contradicted the `discardFromHand` chokepoint's WP-498 / WP-705
  reaction queues, now expected and left as they are (RS-3, EC); (11/4) the `:2` parse case is now tested through
  `unresolvedMarkers` (the parser is module-private), plus tests for the no-cost branch and a 0-cost reveal, and the "39" title and
  message strings join the sanctioned pins; (26/27) the log tokens are locked as raw seat id and cost, with no `card` argument to
  `pushLog`; (12/20) the EC close-out gains `prebuild:coverage`, the govern-close checks, the diff allowlist check, the test-delta
  floor and the strike-test STOP; (12) the dashboard data copies are gitignored, so only the tracked in-play files are listed.
  The other 25 modes were verified clean.
- **Round 2 (both gates, after the folds):** pre-flight **READY TO EXECUTE**, copilot **PASS**. All ten round-1 items were confirmed
  folded consistently in the WP and EC, with no new contradiction and an EC of 84 content lines. One P2 wording fold was applied:
  the three `// why:` comments above the primitive length asserts join the sanctioned pin edits.

## Lint Gate Self-Review (00.3)

- **§1 structure:** every required section is present and non-empty. Out of Scope names the hollow flag, Epic Fin Fang Foom,
  Pagliacci, three Wrecking Crew villains, Gwenpool, Nul, Uru-Enchanted Iron Man, Nick Fury, the vill Avengers, an interactive
  pick, Fin Fang Foom's tactics, and new state / client / server surfaces. Acceptance Criteria has six binary checks. **PASS.**
- **§2 constraints:** full-file output, ESM, Node v22+, `00.6-code-style.md` cited; determinism, the chokepoint and rebind rules,
  the marker-regen rule and no special-casing; a session protocol with four STOP triggers; locked values → EC. **PASS.**
- **§3 Assumes:** five hard-deps, each marked ✅ in WORK_INDEX, plus every helper, type, pin, timing order and generated-data fact
  the change reads, with file and line, verified by two pre-flight rounds. **PASS.**
- **§4 Context:** why one resolver; the scope decisions (Trull / Zzutak / Piledriver in; the hollow flag out, with why); the
  `1 + N` interpretation; the auto-pick; determinism; RS-1..RS-4 locked; ARCHITECTURE sections, a DECISIONS scan list and 00.6.
  **PASS.**
- **§5 files:** every file listed with role and full path: 4 engine source files, 2 script / input files, 1 card-data file,
  generated / provenance files (gitignored dashboard copies called out), 2 test files, governance. **PASS.**
- **§6 naming:** full words (`demolishEachPlayer`, `DemolishResult`, `resolveFinFangFoomStrike`,
  `MONSTERS_UNLEASHED_EXT_ID_PREFIX`); data slugs verbatim; no 00.2 field renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine + card data only; no registry import in the engine; no boardgame.io
  import in the new helper; no client or server change. **PASS.**
- **§9 Windows:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var; no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`; hooks built from the real parser on committed card data; the real
  `mastermindStrikeHandler`; runtime pins (D-24372); the malformed-marker case through `unresolvedMarkers`. **PASS.**
- **§13 verification:** exact regen and check commands with expected exits; engine baseline 6299 recorded. **PASS.**
- **§14 / §15:** six binary criteria. The DoD names STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap / ledger, the diff
  allowlist check, and the D-24026 live check (§15.1, with the operator-pending fallback via `live-verify.json`). **§15.2:**
  `**Risk Tier:** MEDIUM` is in the WP header and verbatim in the EC (not HIGH, so no threat-model section). **PASS.**
- **§16 code-style:** reuses `selectDefaultCostDiscardCard`, `discardFromHand`, `seatsInTurnOrderFrom` and the rebind idiom; one
  resolver with no second copy; `for` loops, no `.reduce()`, no nested ternaries; `// why:` locations listed in the EC. **PASS.**
- **§17 Vision:** clauses §1 / §2 / §8 / §10 / §22, a no-conflict line, an NG-1 line, and a determinism line. **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** the baseline SHA and counts are re-recorded at execution. **PASS.**
  Contract file: `villainAbility.types.ts` gains one appended primitive, covered by D-24807.
- **§20 funding:** N/A, with the statement above. **§21 API catalog:** N/A (no endpoint). **PASS.**
