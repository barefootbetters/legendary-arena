# WP-874 — Wrecking Crew Demolish: The Wrecker, Bulldozer and Thunderball (Game Engine + card data)

**Status:** Draft 2026-11-07 (EC-912; D-24820 reserved, PR #3218)
**Layer:** Game Engine (one resolver seat scope, three villain primitives, one Ambush fire-site bridge, one pure City step helper) +
card data
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay logic (City positions, escapes, Hero Deck order, every player's hand); no new `G` field, no auth,
money, persistence or server surface
**Hard-deps:** WP-864 / D-24807 (`demolishEachPlayer`, `demolish-each-player`) ✅, WP-252 / D-24023 (parameterized villain
primitives) ✅, WP-489 / D-24295 (the universal `@<space>` location gate) ✅, WP-837 / D-24770 (own-group prefix
`resolveVillainGroupPrefix`) ✅, WP-542 / D-24351 + D-24703 (executor no-op plus reveal fire-site bridge; a bridged Ambush names
itself in the narrative) ✅, WP-757 / D-24587 (`resolveVillainEscape`) ✅, WP-846 / D-24780 (current-player-first order) ✅,
WP-869 / D-24814 (the last appended primitive, position 45; the `composeAmbushNarrative` clause-param precedent) ✅

## Goal

WP-864 left three chmp Wrecking Crew Demolish lines out of scope, and all three do nothing today. Operator match `5wQp-SYfg7K`
logged The Wrecker's Ambush as an `unmarked-ability` / `onAmbush` / `no-handler` hollow at log 7.1.7 and 11.1.2; Bulldozer and
Thunderball carry no marker either (`docs/ai/coverage/villain-mechanic-ledger.csv`: all three `(unmarked)`). After this WP:

- **The Wrecker**, Ambush: "For each Wrecking Crew Villain in the city (including this one), [Demolish] each player." Demolish
  runs once per Wrecking Crew Villain in the City, The Wrecker included.
- **Bulldozer**, Ambush: "Bulldozer moves an extra space forward. If this pushes any Villains forward, [Demolish] each player."
  Bulldozer moves one more space forward, pushing the Villains ahead of it (a Villain pushed off the end escapes). If it pushed a
  Villain, Demolish runs once. This is the rulebook's Charge keyword (rules v23 p.20, `keywords-full.json` `charge`).
- **Thunderball**, Fight: "If you fight Thunderball in the Sewers or Bank, [Demolish] each other player." Fought in the Sewers or
  the Bank, Demolish runs once and every player except the fighter discards; fought anywhere else, nothing happens.

## User-Visible Impact

`play.legendary-arena.com`, in a match with the Wrecking Crew group created after the deploy: The Wrecker's Ambush logs how many
times it Demolishes, then each Demolish's reveal and discards. Bulldozer's Ambush logs that it charged one space (and pushed the
Villains ahead of it), the City shows it one space further on, any Villain pushed off the Bridge escapes, and a push is followed by
a Demolish; the Ambush overlay names the charge. The Wrecker's Ambush overlay still reads "entered the city with no Ambush effect"
(keyword-less Demolish results are not recorded, as for WP-864's lines; Out of Scope), and its log lines narrate it. Fighting Thunderball in the Sewers or Bank Demolishes every other player; elsewhere
the log says it had no effect there. Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` `0f32bbf4` (2026-11-07, re-recorded at commit: the reservation #3218, WP-869 #3214, the WP-864 live-verify
  #3217 and WP-867 #3219 merged on `39404844`; WP-867 touched none of the files anchored below). `pnpm -r build` 0; game-engine
  6611 / 0 measured on `9a83b196`, before WP-867 added tests; re-record the count at execution.
- `board/demolish.logic.ts` (WP-864): `demolishEachPlayer(G, currentPlayer: string | null, logPrefix: string): DemolishResult` reads
  `G.heroDeck[0]` once, rotates it to the bottom by rebind, logs the reveal, then a module-private `discardCardOfCostForEachPlayer`
  walks `seatsInTurnOrderFrom(Object.keys(G.playerZones), currentPlayer)` and discards through `selectDefaultCostDiscardCard` +
  `discardFromHand`. Its two callers are `rules/mastermindHandlers.ts` (Fin Fang Foom) and `villainEffectDemolishEachPlayer`
  (`villain/villainEffects.execute.ts` ~5095).
- Villain primitives: `VillainEffectPrimitive` + `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts`) hold **45** at HEAD,
  the last `stack-cards-enter-city-as-villains` (WP-869). `VillainEffectDescriptor` (~698) carries primitive-specific optional fields
  (`magnitude`, `reenterRevealKinds` (WP-868), …). The parser (`setup/villainAbility.setup.ts`) strips the `!<condition>` then the
  `@<space>[+<space>]` suffix (`parseLocationGatedEffect` ~469) before `parseUngatedEffect` (~553), whose terminal `parts.length ===
  1` branch accepts any listed no-param primitive; `parsePositiveInteger` (~239) is the magnitude reader. The marker script
  `scripts/convert-cards/apply-effect-markers.mjs` keeps a hand-synced primitive list (~222) and mirrors the gate (`CITY_SPACE_NAMES`
  ~266, the `@` split ~353) and the per-primitive validators (`play-villain-deck-cards` ~515).
- Location gate (D-24295): the executor (`executeVillainAbilities` ~225-236) skips a descriptor whose `requireCitySpaces` the fought
  `cityIndex` does not satisfy and self-narrates "no effect" (`narrateCityGateBlocked`); it fails closed at the Ambush / Escape
  sites (no `cityIndex`). `moves/fightVillain.ts` ~740 passes the fought `cityIndex`; `moves/fortifyFight.ts` ~166 passes
  `undefined`. `CITY_SPACE_NAMES` index 0 = `sewers`, 1 = `bank`; `citySpaceNameForIndex(index)` (`board/citySpaceNames.ts` ~48)
  returns `undefined` past index 4.
- Log helpers: `log/logDisplay.ts` `resolveCardName(cardDisplayData, extId)` (~29; `reveal.ts` already imports `formatCardRef` from
  that module, so no new edge); module-private `villainEffectTimingLabel(timing)` (`villainEffects.execute.ts` ~2129) gives
  `Ambush` / `Fight` / `Escape`.
- Own group (D-24770): module-private `resolveVillainGroupPrefix(G, cardId)` (`villainEffects.execute.ts` ~766) returns the longest
  selected-group prefix `${set}-villain-${slug}-` and its slug, or `null`. Wrecking Crew instance ids start
  `chmp-villain-wrecking-crew-` (villain ledger rows).
- Deliberate no-ops and bridges (D-24351): `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (~845) labels a bridged primitive's trace `no-op`.
  The exported readers `villainCardPlaysVillainDeckCards`, `villainCardReenterSewersKinds` (~2041) and `villainCardStackVillainEntry`
  scan `getVillainHooksForCard(...)` for the first matching descriptor. `villainDeck/villainDeck.reveal.ts` `performVillainReveal`:
  the card is pushed into the City (`pushVillainIntoCity`), an entry escape goes through `resolveVillainEscape(G, context,
  implementationMap, id)` (~635), then inside `if (cardHasAmbush)` the WP-743 flag write, the `onAmbush` executor call (~355), the
  narrative inputs (The Leader count, the WP-869 stack clause), the `ambushResolved` push with `composeAmbushNarrative(cardName,
  results, playCount, stackVillainClause)` (`events/notableEvents.compose.ts` ~443), then the Leader and stack bridges.
  `reveal.ts` already imports `villainEffects.execute.ts`, which imports `board/demolish.logic.ts`, so importing the resolver into
  `reveal.ts` adds no new module cycle.
- City: `G.city` is `CityZone` (`CitySpace[]`, default 5, may grow, WP-831); `pushVillainIntoCity` (`board/city.logic.ts` ~56) pushes
  only the contiguous entry-side block and ejects the last space when no space is empty. No persistent `G` table is keyed by City
  index: bystanders (`G.attachedBystanders`) and every per-villain table key by card id, so moving a card carries its state. The
  pending-choice snapshots that carry a `cityIndex` (defeat targets, `types.ts` ~978; `here-hold-this`, ~1471) are frozen by the
  block-all guards and are shifted the same way by any ordinary reveal, so a charge adds no new hazard.
  `moves/moveVillainChoice.resolve.ts` (Spinning Cyclone) swaps and never escapes; it is not the Charge rule.
- Marker data: `scripts/convert-cards/inputs/villain-effect-markers.json` `villains.chmp.wrecking-crew` holds only `piledriver`.
  `data/cards/chmp.json` is GENERATED (`cards:check`). Only `sentinel-core-doom-2p` exists as a `finalStateHash` sentinel (core cards).
- Length 45 is pinned in `rules/villainAbility.types.test.ts`: the ordered list title / body (~371), the multi-line length assert
  "exactly 45 entries" (~419-423), the last-entry assert `stack-cards-enter-city-as-villains` "(position 45)" (~424-428), six
  `length, 45` asserts (~649, ~685, ~712, ~765, ~822, ~887), the comment-only totals (~647-648, ~684, ~710-711, ~764, ~821), the WP-873 `T5` parity `Record` (~819), and the WP-869 describe "is the 45th and last primitive"
  (~885).

## Context (Read First)

- **One resolver, still.** D-24807 put Demolish in one place. Thunderball's "each other player" is a seat filter on that resolver,
  The Wrecker's count is a loop around it, and Bulldozer's conditional is one call after a charge. No line parses the word Demolish.
- **Why a `charge` primitive, not a Bulldozer special case.** "Moves an extra space forward … pushing" is Charge one space (rules v23
  p.20: "after this Villain enters the Sewers, it charges forward an extra space, pushing other Villains forward. This might cause
  more escapes."). Charge exists nowhere in the engine. A pushed-off Villain must run the full escape (`resolveVillainEscape`, which
  needs the `RevealContext` and `implementationMap`), so the primitive is an executor no-op bridged at the Ambush fire site (D-24351,
  the Leader / Mr. Immortal / WP-869 shape). `charge:<N>` serves the printed Charge cards later as data only; they stay out of scope.
- **Ordering.** The charge bridge runs **before** the `onAmbush` executor call: Charge happens as the Villain enters, so the card's
  other Ambush effects (and The Wrecker's count, if both were ever in one reveal chain) see the settled City. Bulldozer's
  Demolish runs inside the bridge, right after its charge, because it reads whether the charge pushed.
- **Narrative.** D-24703 says a bridged Ambush must not read "entered the city with no Ambush effect"; the charge clause is passed to
  `composeAmbushNarrative` the way WP-869 passes its stack clause. The Wrecker's and Thunderball's Demolish are keyword-less executor
  effects, which the narrative builder ignores (as for WP-864's Zzutak and Piledriver); their log lines narrate them. Naming
  keyword-less effects in the overlay is a general follow-up (Out of Scope).
- **Determinism / hash.** No new `G` field and no randomness. The charge and the Demolishes are deterministic functions of `G`. The
  three hooks are setup-built from card data, so live-verify needs a match created after the deploy. Replays of pre-WP-874 matches
  that reveal Bulldozer or The Wrecker, or fight Thunderball in the Sewers / Bank, diverge on re-execution; stored
  `competitive_scores` rows stay frozen (D-24616 §5). No sentinel uses chmp.
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, §Rule Execution Pipeline, Principle #1. Scan D-24807, D-24023, D-24295,
  D-24770, D-24351, D-24703, D-24587, D-24656, D-24780 and D-24814 in `docs/ai/DECISIONS.md`. `docs/ai/REFERENCE/00.6-code-style.md`.

### RS-1 — Seat scope on the resolver (default locked)

`board/demolish.logic.ts` exports `type DemolishSeatScope = 'each' | 'each-other'`, and `demolishEachPlayer` gains a trailing
optional parameter `seatScope: DemolishSeatScope = 'each'`, passed through to the private discard loop. Existing callers are
unchanged. With `'each-other'` and a non-null `currentPlayer`, that seat is skipped (no line for it). If the remaining seat list is
empty (solo), the reveal and rotation still happen and one line logs `${logPrefix} there is no other player to discard.`
(`blocked`); the result's `discards` is `[]`. Reveal, rotation, cost and log lines are otherwise exactly D-24807's.

### RS-2 — Thunderball (default locked)

Primitive `demolish-each-other-player` (no params). Handler `villainEffectDemolishEachOtherPlayer(G, currentPlayer, cardId, timing)`
→ `demolishEachPlayer(G, currentPlayer, `${villainEffectTimingLabel(timing)} effect:`, 'each-other')`, returning `{ targets: [] }`.
Marker `wrecking-crew/thunderball` `fight: ["demolish-each-other-player@sewers+bank"]`: the D-24295 gate does the "in the Sewers or
Bank" part, with no new gate code. A Thunderball fought through `fortifyFight` (no `cityIndex`) fails the gate closed.

### RS-3 — The Wrecker (default locked)

Primitive `demolish-each-player-per-group-villain-in-city` (no params). Handler
`villainEffectDemolishEachPlayerPerGroupVillainInCity(G, currentPlayer, cardId, timing)`, label `${villainEffectTimingLabel(timing)}
effect:`:

0. If an entry-escape side effect has already moved The Wrecker out of the City, step 2 counts only the others (0 → step 3).
1. `group = resolveVillainGroupPrefix(G, cardId)`. If `null`: log `${label} the Villain's group is not among this match's Villain
   Groups, so no one is Demolished.` (`blocked`), return.
2. `count` = the non-null `G.city` spaces whose id starts with `group.groupPrefix` (the card itself included), taken once.
3. If `count === 0`: log `${label} no ${group.groupSlug} Villain is in the City, so no one is Demolished.` (`blocked`), return.
4. Log `${label} Demolish each player ${count} time(s), once for each ${group.groupSlug} Villain in the City.` (`neutral`; the `(s)` is
   literal, the D-24807 Fin Fang Foom header precedent), then call
   `demolishEachPlayer(G, currentPlayer, label)` `count` times in a `for` loop. Return `{ targets: [] }`.

Marker `wrecking-crew/the-wrecker` `ambush: ["demolish-each-player-per-group-villain-in-city"]`. Henchmen and other groups never
match the prefix. The count is fixed at the start: a Demolish moves no Villain.

### RS-4 — Charge and Bulldozer (default locked)

- **Grammar.** Primitive `charge`: `charge:<N>` → `{ primitive: 'charge', magnitude: N }`; `charge:<N>:demolish-if-pushed` → the
  same plus `demolishIfPushed: true`. `N` via `parsePositiveInteger`; any other shape (`charge`, `charge:0`, `charge:x`,
  `charge:1:other`, a fourth part) → `null` (`unresolvedMarkers`). `VillainEffectDescriptor` gains optional `demolishIfPushed?:
  boolean` (contract file, D-24820). The marker script gets the same validator.
- **Executor.** Handler `villainEffectCharge()` returns `{ targets: [] }` and mutates nothing; `charge` joins
  `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (its trace reads `no-op`). Exported reader `villainCardChargeEffect(G, cardId, timing):
  { spaces: number; demolishIfPushed: boolean } | null` returns the first `charge` descriptor at that timing (the
  `villainCardReenterSewersKinds` guards), with `spaces: descriptor.magnitude ?? 1` and `demolishIfPushed: descriptor.demolishIfPushed ===
  true` (the `villainCardStackVillainEntry` precedent; the parser omits `demolishIfPushed` when absent and never writes `false`).
  Only the Ambush fire site reads it; a `charge` at another timing is inert.
- **Pure step.** New `board/villainCharge.logic.ts` (no boardgame.io, no registry import) exports the types `ChargeStepResult` and
  `ChargeOutcome` (`{ spacesMoved: number; hasPushedAnyVillain: boolean; hasChargerEscaped: boolean; hasDemolished: boolean }`; both
  `reveal.ts` and `notableEvents.compose.ts` `import type` it, so compose never imports reveal) and `chargeCityVillainOneSpace(city: CityZone, fromIndex: number):
  ChargeStepResult`, `ChargeStepResult { city: CityZone; hasPushedVillain: boolean; escapedCardId: CardExtId | null; hasChargerEscaped:
  boolean }`. Input never mutated; never throws. Rules: an out-of-range `fromIndex` or a null space → unchanged copy, all false /
  null. `fromIndex` is the last space → the charger leaves (`city[fromIndex] = null`), `escapedCardId` = the charger,
  `hasChargerEscaped: true`. Otherwise the destination is `fromIndex + 1`: empty → the charger moves, `hasPushedVillain: false`; occupied →
  `hasPushedVillain: true`, and the contiguous block from the destination shifts one space forward up to the first empty space after it;
  with no empty space the last space's card is `escapedCardId`. Then the charger takes the destination and its old space is null.
  `ChargeOutcome.spacesMoved` counts the steps after which the charger is still in the City; an exit step sets only
  `hasChargerEscaped`.
- **Bridge.** In `villainDeck.reveal.ts`, module-private `chargeAmbushVillain(G, context, implementationMap, cardId, chargeEffect):
  ChargeOutcome`, called inside
  `if (cardHasAmbush)` after the WP-743 flag write and **before** the `onAmbush` executor call, when `villainCardChargeEffect(G, cardId,
  'onAmbush')` is non-null (passed in as `chargeEffect`). For each of `chargeEffect.spaces` steps: `fromIndex = G.city.indexOf(cardId)`, stop if `-1`; apply the step to
  `G.city`; log the step through a private `logChargeStep` (below); if `escapedCardId !== null` call `resolveVillainEscape(G, context, implementationMap,
  escapedCardId)`; stop if `hasChargerEscaped`. After the loop, when `chargeEffect.demolishIfPushed`: if `hasPushedAnyVillain`,
  `demolishEachPlayer(G, context.ctx.currentPlayer, 'Ambush effect:')` and `hasDemolished = true`; else log the no-push line.
  **Reentrancy:** the bridge keeps its state in locals (no module-level state). A nested reveal reached through
  `resolveVillainEscape` (e.g. an escape that becomes a Scheme Twist whose resolver reveals) runs its own bridge to completion first;
  the outer loop re-reads `indexOf` every step, so escape side effects that move City cards are absorbed.
- **Logs** (`<name>` = `resolveCardName(G.cardDisplayData, cardId)`; `<space>` = `the <Name>` from `citySpaceNameForIndex(to)` with
  a capitalized first letter, else `city space <to>`; category `threat` unless noted):
  - moved: `Ambush effect: <name> charged forward one space to <space>.`
  - moved and pushed: `Ambush effect: <name> charged forward one space to <space>, pushing the Villains ahead of it forward.`
  - charger off the end: `Ambush effect: <name> charged forward out of the city.`
  - no push with `demolishIfPushed`: `Ambush effect: <name> pushed no Villains forward, so no one is Demolished.` (`blocked`)
- **Narrative.** New `composeChargeClause(outcome: ChargeOutcome): string | undefined` in `events/notableEvents.compose.ts`:
  `hasChargerEscaped` → `charged out of the city`; else `spacesMoved === 1` → `charged forward one space`; else `spacesMoved > 1` →
  `charged forward ${spacesMoved} spaces` (the `composeVillainDeckPlayClause` singular / plural precedent); else `undefined`. Append `, pushing Villains forward` when `hasPushedAnyVillain`, then `, then Demolished each player` when `hasDemolished`.
  `composeAmbushNarrative` gains a trailing optional `chargeClause?: string`, pushed after the stack clause. No charge → no change.
  The hashed `ambushResolved.citySpace` (`G.city.indexOf(cardId)`) is read after the charge: the charger's settled index (Bulldozer
  in the Bank → 1), falling back to 0 when it left the City (the existing fallback, unchanged).
- **Marker** `wrecking-crew/bulldozer` `ambush: ["charge:1:demolish-if-pushed"]`.

### RS-5 — Positions (default locked)

Append, in this order, after `stack-cards-enter-city-as-villains`: `demolish-each-other-player`,
`demolish-each-player-per-group-villain-in-city`, `charge` (positions 46, 47, 48 at the draft HEAD). If another packet appends
first, append after it and record the positions in an inline Execution Amendment (the WP-864 precedent). On an amendment, every pin
value (48, "46th-48th", "(position 48)", the `T5` `Record` keys, the comment totals) uses the recorded final positions, and the
WP-869 describe's "and last" is edited only if it still says that at HEAD. WP-870 is already executed on an open branch and appends to
the same list, so this path is likely.

## Scope (In)

- **Resolver** (`board/demolish.logic.ts`): `DemolishSeatScope`, the `seatScope` parameter, the solo line (RS-1).
- **Primitives** (`rules/villainAbility.types.ts`, contract file, D-24820): three union members and array entries; the optional
  `demolishIfPushed` descriptor field (RS-2..RS-5).
- **Parser** (`setup/villainAbility.setup.ts`): the `charge` grammar arm (the two no-param primitives need none).
- **Executor** (`villain/villainEffects.execute.ts`): three handlers, three table entries, `charge` in
  `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`, `villainCardChargeEffect`.
- **Pure step** (`board/villainCharge.logic.ts`, new; also the `ChargeStepResult` / `ChargeOutcome` types) and **bridge** (`villainDeck/villainDeck.reveal.ts`, `chargeAmbushVillain` +
  its call + the clause argument).
- **Narrative** (`events/notableEvents.compose.ts`): `composeChargeClause`, the `chargeClause` parameter.
- **Data:** marker-script primitive list + `charge` validator; three marker entries; regenerated `data/cards/chmp.json`.
- **Coverage:** `mechanic-provenance.json` rows for the three primitives (`{ wp: "WP-874", decision: "D-24820" }`); pending
  `live-verify.json` rows (The Wrecker, Bulldozer, Thunderball); regenerated feeds as in WP-864.
- **Tests:**
  - New `board/villainCharge.logic.test.ts` (pure step): empty destination; occupied destination with a gap ahead; a full block to the
    edge ejects the last card; a charger on the last space escapes itself; invalid `fromIndex` / null space is a no-op; the input
    array is not mutated; a grown 6-space City.
  - New `villainDeck/villainCharge.reveal.test.ts` (Bulldozer hook from the real parser on the committed `chmp.json`, through
    `performVillainReveal` with a real `implementationMap`; City given before the reveal, Bulldozer = B): every filler (A, B', C, D, X, Y, Z, WC) is a
    Villain id with no `onEscape` hook (e.g. Thunderball instance ids), except the named Piledriver; the ordering-proof match selects
    the Wrecking Crew group so `resolveVillainGroupPrefix` resolves.
    - `[null,null,null,null,null]` → B ends at index 1 (Bank), no Hero Deck rotation, the no-push line, `ambushResolved.citySpace === 1`.
    - `[A,null,null,null,null]` → the entry puts A in the Bank, the charge pushes A to index 2 and B to 1; one Demolish (Hero Deck
      rotated once, discards made).
    - `[null,A,B',C,D]` (no entry escape) → the charge pushes D out: escaped counter +1, the Escape Pile gains D, then one Demolish.
    - `[null,X,Y,Z,Piledriver]` → Piledriver is pushed out and its Escape `demolish-each-player` fires inside the loop, then
      Bulldozer's Demolish: the Hero Deck rotated twice, and the first Demolish's cost drove the first discards.
    - Ordering proof by state: a hand-built hook `ambush: ['charge:1', 'demolish-each-player-per-group-villain-in-city']` on a
      Wrecking Crew-prefixed charger with `[null,WC,WC,WC,WC]` → 4 Hero Deck rotations (bridge first: one WC is pushed out before
      the count; executor first would give 5).
    - The `ambushResolved` narrative carries the charge clause; the `charge` trace is `no-op`.
    - If D-24824 (WP-877) has landed, the `charge` Ambush bridge calls `recordVillainSecondarySiteTrace(…, 'villain-ambush-bridge', …)` inside its guard, before the bridge (extending the helper's `effect` / `handler` unions), and its trace test expects `no-op` then `secondary-site`.
  - `board/demolish.logic.test.ts` (extended): `'each-other'` skips the current player and keeps their hand; the solo line; the
    default scope is byte-identical to before (the existing cases unchanged). The Wrecker through the real executor: alone → one
    Demolish; with two more Wrecking Crew Villains → three; a non-Wrecking-Crew Villain is not counted; a match whose selection lacks
    the group → the blocked line. Thunderball through the real executor: `cityIndex` 0 and 1 → each-other Demolish; `cityIndex` 2 and
    `undefined` → no reveal and the D-24295 "no effect" line.
  - Parser cases (`setup/villainAbility.setup.test.ts`, the synthetic-registry precedent): `charge:1:demolish-if-pushed`, `charge:2`, the
    gated `demolish-each-other-player@sewers+bank`; `charge`, `charge:0`, `charge:x`, `charge:1:other`, `charge:1:demolish-if-pushed:x`
    → `unresolvedMarkers`.
  - `events/notableEvents.compose.test.ts`: each `composeChargeClause` branch, and no clause
    leaves `composeAmbushNarrative` unchanged.
  - Pins: `rules/villainAbility.types.test.ts` ordered list + the three entries; every `length, 45` → 48; the ordered-list title "45"
    → "48"; the "exactly 45 entries" message → 48; the last-entry assert → `charge` "(position 48)"; the comment-only totals → 48;
    the WP-869 describe "is the 45th and last primitive" drops "and last" (still index 44); the `T5` parity `Record` gains the
    three keys; each pin edit cites WP-874 / D-24820. Add a runtime pin that the three are the 46th-48th entries.
  - Expected unchanged: every `finalStateHash` sentinel, the WP-864 Fin Fang Foom / Trull / Zzutak / Piledriver tests,
    `runtime-observed-hollows.json`.

## Out of Scope

- **The printed Charge keyword cards** (ssw2, cvwr, vill, chmp "Ambush: Charge one/two/three space(s)"): data-only `charge:<N>`
  follow-ups; vill has no curated villain markers yet.
- **Naming keyword-less effects in the Ambush / Fight overlay narrative** (The Wrecker, Thunderball, WP-864's Demolish lines,
  Whirlwind's swap): a general narrative follow-up.
- Pagliacci, Gwenpool, Nul, Uru-Enchanted Iron Man, Nick Fury and the vill Avengers Demolish lines; Epic Fin Fang Foom; an interactive
  "which card of that cost" pick (D-24807).
- Any new `G` field, pending queue, move, UIState field, client or server change; `replay/replay.execute.ts`; `pushVillainIntoCity`.

## Files Expected to Change

- `packages/game-engine/src/board/demolish.logic.ts`: **modified**, RS-1.
- `packages/game-engine/src/board/villainCharge.logic.ts`: **new**, RS-4 pure step.
- `packages/game-engine/src/rules/villainAbility.types.ts`: **modified** (contract file; D-24820).
- `packages/game-engine/src/setup/villainAbility.setup.ts`: **modified**, the `charge` arm.
- `packages/game-engine/src/villain/villainEffects.execute.ts`: **modified**, handlers, table, no-op set, reader.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts`: **modified**, the bridge (same-layer runtime wiring, `01.5`).
- `packages/game-engine/src/events/notableEvents.compose.ts`: **modified**, the clause.
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`: **modified**;
  `data/cards/chmp.json`: **generated**.
- Generated / provenance: `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json` (expected unchanged),
  `scripts/coverage/hero-effect-coverage.baseline.json` (only if it moves), `scripts/coverage/mechanic-provenance.json`,
  `docs/ai/coverage/live-verify.json`; `apps/dashboard/src/data/in-play-hollow-baseline.json` +
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` only if the in-play pin moves (other dashboard copies are gitignored).
- Tests: `packages/game-engine/src/board/villainCharge.logic.test.ts` (**new**),
  `packages/game-engine/src/villainDeck/villainCharge.reveal.test.ts` (**new**), `packages/game-engine/src/board/demolish.logic.test.ts`,
  `packages/game-engine/src/rules/villainAbility.types.test.ts`, `packages/game-engine/src/setup/villainAbility.setup.test.ts` (parser cases) and
  `packages/game-engine/src/events/notableEvents.compose.test.ts` (clause cases).
- Governance at close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24820), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code; see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O. `for` loops; no `.reduce()`, no nested ternaries. Moves and handlers never throw.
- One Demolish implementation: every new line calls `demolishEachPlayer`; no second reveal or discard loop.
- `board/villainCharge.logic.ts` imports no boardgame.io and no registry. City writes rebind `G.city`; the pure step never mutates its input. Every escape goes through `resolveVillainEscape`.
- Card data changes only through the marker sources plus a reproducible regen (`cards:check`); never hand-edit generated card JSON.
  No per-card special-casing in engine code: the three cards are reached only through their markers.

**Session protocol:** STOP and report if any sentinel or golden hash moves; if the regen changes any card file other than
`chmp.json`; if a WP-864 Demolish test or an existing reveal / escape test changes; or if importing the resolver into
`villainDeck.reveal.ts` creates a module cycle.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `demolishEachPlayer(G, currentPlayer, logPrefix, seatScope?: DemolishSeatScope): DemolishResult`; `DemolishSeatScope`.
- `chargeCityVillainOneSpace(city, fromIndex): ChargeStepResult`, and the types `ChargeStepResult` / `ChargeOutcome`
  (`board/villainCharge.logic.ts`).
- Villain primitives `demolish-each-other-player`, `demolish-each-player-per-group-villain-in-city` (no params) and
  `charge:<N>[:demolish-if-pushed]`; descriptor field `demolishIfPushed?: boolean`; reader `villainCardChargeEffect`.
- `composeChargeClause(outcome)`; `composeAmbushNarrative(..., stackVillainClause?, chargeClause?)`.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).
- **No conflict:** three printed card lines that do nothing today resolve as printed and as the rulebook defines Demolish and Charge.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched; printed card abilities only, nothing bought.
- **Determinism preservation:** no randomness and no new state; the charge, escapes and Demolishes are pure functions of `G`.
  Pre-WP-874 replays with these effects diverge; stored competitive rows stay frozen (D-24616 §5).

## Funding Surface Gate

N/A: no nav, pricing or funding surface. The output is board state and log lines.

## API Catalog Update

N/A: no HTTP endpoint or `apps/server` library function touched.

## Acceptance Criteria

1. The Wrecker's Ambush Demolishes each player once per Wrecking Crew Villain in the City, itself included (RS-3).
2. Bulldozer's Ambush moves it one space forward, pushing the contiguous Villains ahead of it; a Villain pushed off the end escapes
   through the full escape procedure; a push is followed by exactly one Demolish, no push by the no-push line (RS-4).
3. Fighting Thunderball in the Sewers or Bank Demolishes every player except the fighter; elsewhere nothing is revealed (RS-1, RS-2).
4. Each Demolish reveals one Hero Deck card, bottoms it, and discards through `discardFromHand` in D-24780 order (D-24807 unchanged).
5. The Ambush overlay names Bulldozer's charge; no other narrative changes.
6. `cards:check` reproduces the card data; the villain ledger lists the three cards executable under their primitives; every feed
   `:check` exits 0. Engine and dashboard suites green; `pnpm -r build` 0; `finalStateHash` sentinels unchanged.

## Verification Steps

Regenerate, in this order, after the engine change builds:

- Add the provenance rows and the pending `live-verify.json` rows first.
- `node scripts/convert-cards/apply-effect-markers.mjs`: exits 0, and only `data/cards/chmp.json` changes.
- `pnpm -r build`: exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:villains`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`, `pnpm sim:coverage --check`
  (`--update-baseline` only if it reports a move), `pnpm --filter @legendary-arena/dashboard prebuild:coverage`: each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test`: green; record the exact delta from the draft baseline and expect at least +25.
- `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`,
  `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`, `pnpm cards:count-markers:check`.
- At govern-close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check` and
  `node scripts/check-number-ledger.mjs --check`.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine and dashboard suites green; `pnpm -r build` exits 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance rows added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** in a Wrecking Crew match **created after the deploy** (`isMatchOlderThanServer: false`), at
      least one of The Wrecker's Ambush, Bulldozer's charge (City positions in Play Diagnostics plus its log lines) or a Thunderball
      fight in the Sewers / Bank, confirmed from the log lines and hand sizes, or operator-pending in `STATUS.md` with the
      pending `live-verify.json` rows (the WP-864 precedent: live-verify lands as its own SPEC after the deploy).
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24820 → Active; `WORK_INDEX.md` checked; `EC_INDEX.md` Done; mindmap
      ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified; checked with `git diff --name-only origin/main...HEAD`.

## Reserved Decision (lands at execution)

D-24820: three chmp Wrecking Crew lines reuse the D-24807 `demolishEachPlayer` resolver, which gains a trailing `seatScope` (`'each'`
default, `'each-other'` skips the current player; with no other seat the reveal still happens and a "no other player" line logs).
Three villain primitives are appended after `stack-cards-enter-city-as-villains`: `demolish-each-other-player` (Thunderball's Fight,
gated `@sewers+bank` by the D-24295 location gate), `demolish-each-player-per-group-villain-in-city` (The Wrecker's Ambush: Demolish
once per City Villain of its own group, found by the D-24770 prefix and counted once, itself included; an unresolved group fails
closed) and `charge:<N>[:demolish-if-pushed]` (descriptor field `demolishIfPushed`). Charge is the rulebook keyword (v23 p.20): an
executor no-op bridged at the Ambush fire site (D-24351), run **before** the `onAmbush` executor; each step moves the Villain one
space forward, pushing the contiguous block ahead of it, and a card pushed off the end, or the charger itself from the last space,
escapes through `resolveVillainEscape`. Bulldozer (`charge:1:demolish-if-pushed`) Demolishes once only if a step pushed a Villain.
The charge is named in the `ambushResolved` narrative (D-24703); keyword-less Demolish narration in the overlay is deferred. Replays of
pre-WP-874 matches with these effects diverge; stored competitive rows stay frozen (D-24616 §5).

## Pre-flight (01.4) and Copilot (01.7)

- **Pre-flight round 1:** READY TO EXECUTE, no PS items. Every Assumes bullet and all eight hard-deps were verified at `9a83b196`.
  The five RS items were folded as wording, with no change to scope or contract: (A) `ChargeOutcome` and `ChargeStepResult` are
  exported from `board/villainCharge.logic.ts` and type-imported by reveal and compose, so compose never imports reveal; (B) the pin
  list names the "exactly 45 entries" assert, the last-entry assert and the comment-only totals; (C) the narrative plurals are locked
  (`one space` / `N spaces`; The Wrecker log's `time(s)` is literal); (D) the City-index claim is narrowed to persistent tables, since
  frozen pending snapshots shift under any reveal; (E) the overlay wording in User-Visible Impact, refreshed line anchors, and bare
  `charge` → `null` ahead of the terminal branch.
- **00.3 lint round 1:** four text FAILs, all folded. §3: `resolveCardName` and `villainEffectTimingLabel` were added to Assumes, and
  the bridge reads `context.ctx.currentPlayer`. §16.3: the outcome booleans now carry `has`, and `spec` is now
  `villainCardChargeEffect` / `chargeEffect`. EC: the Thunderball call passed `${label} effect:` on top of a label that already ends in
  `effect:`, which would have logged "Fight effect: effect:"; it is fixed, and the second charge log is now written out in full. §15.1:
  the DoD live check allows operator-pending (the WP-864 precedent).
- **Pre-flight round 2 (after the folds):** READY TO EXECUTE. Every fold was present and consistent, with no stale identifier left.
- **Copilot round 1:** RISK → HOLD, seven findings, all folded as scope-neutral wording or test changes:
  - (11/26) The reveal-test City setups are spelled out.
  - (11) The tests add an escape-inside-the-charge case (Piledriver pushed out) and a state-based proof that the bridge runs before the
    executor.
  - (18/26) The hashed `ambushResolved.citySpace` is locked as read after the charge.
  - (26) `spacesMoved` is defined for an exit step.
  - (5) The reader falls back to `magnitude ?? 1` and `=== true`.
  - (4) The pin values follow any position amendment.
  - (23) Bridge reentrancy through a nested reveal is stated.
- **Copilot round 2:** RISK → HOLD on one mode-11 item. The test fillers must carry no `onEscape` hook, and the ordering-proof match
  must select Wrecking Crew. It was folded, and the line was confirmed (Thunderball's only marker is `fight`). The other 29 modes PASS.
  **Final: pre-flight READY TO EXECUTE; copilot RISK with the concern documented.** The residual risk is RS-5: WP-870 is executed on
  an open branch that appends to the same primitive list, so positions 46-48 will likely move through an inline amendment.

## Lint Gate Self-Review (00.3)

- **§1 structure:** every required section is present and non-empty. Out of Scope names the printed Charge cards, keyword-less
  overlay narration, the remaining Demolish lines (Pagliacci, Gwenpool, Nul, Uru-Enchanted Iron Man, Nick Fury, the vill Avengers,
  Epic Fin Fang Foom, an interactive pick), and new state, client, server, replay or `pushVillainIntoCity` changes. Acceptance
  Criteria has six binary checks. **PASS.**
- **§2 constraints:** full-file output, ESM, Node v22+, and `00.6-code-style.md` are cited, along with determinism, one Demolish
  implementation, the rebind and `resolveVillainEscape` rules, the marker regen, and no special-casing. A session protocol gives four
  STOP triggers, and the locked values are in the EC. **PASS.**
- **§3 Assumes:** eight hard-deps, each ✅ in WORK_INDEX, plus every helper, type, reader, gate, fire-site order, pin and
  generated-data fact the change reads (including `resolveCardName` and `villainEffectTimingLabel`), each with file and line. Two
  pre-flight rounds verified them. **PASS.**
- **§4 Context:** covers why one resolver, why a `charge` primitive is bridged at the fire site, ordering, narrative, and
  determinism / replay. RS-1 through RS-5 are locked. ARCHITECTURE sections, a DECISIONS scan list and 00.6 are cited. **PASS.**
- **§5 files:** 7 engine source files (1 new), 2 script / input files, 1 card-data file, the generated / provenance files (the
  gitignored dashboard copies are called out), 6 test files (2 new), and governance. **PASS.**
- **§6 naming:** full words (`demolishEachPlayer`, `DemolishSeatScope`, `chargeCityVillainOneSpace`, `villainCardChargeEffect`,
  `composeChargeClause`). The outcome booleans carry a `has` prefix. `demolishIfPushed` mirrors its marker token (precedent:
  `reorderRemainder`). No 00.2 field is renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine and card data only. The new pure helper imports neither boardgame.io nor
  the registry, `reveal.ts` gains no new module edge, and there is no client or server change. **PASS.**
- **§9 Windows:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var and no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`. The plan covers:
  - a pure-step suite;
  - the Bulldozer hook from the real parser on the committed `chmp.json`, run through `performVillainReveal` with fixed City setups,
    an escape-inside-the-charge case and a state-based ordering proof;
  - The Wrecker and Thunderball through the real executor;
  - parser and narrative cases;
  - runtime pins (D-24372).
  **PASS.**
- **§13 verification:** the exact regen order and check commands are given with expected exits, and the engine baseline of 6611 is
  recorded. **PASS.**
- **§14 / §15:** six binary criteria. The DoD names STATUS, DECISIONS, WORK_INDEX, EC_INDEX, the mindmap and the ledger, plus the
  diff allowlist check and the D-24026 live check (§15.1, with an operator-pending fallback through `live-verify.json`). **§15.2:**
  `**Risk Tier:** MEDIUM` appears in the WP header and verbatim in the EC; it is not HIGH, so there is no threat-model section. **PASS.**
- **§16 code-style:** reuses `demolishEachPlayer`, `resolveVillainGroupPrefix`, `resolveVillainEscape`, the D-24295 gate and the
  rebind idiom. There is no second Demolish copy, `for` loops replace `.reduce()`, and there are no nested ternaries. The `// why:`
  locations are listed in the EC. **PASS.**
- **§17 Vision:** clauses §1, §2, §8, §10 and §22, a no-conflict line, an NG-1 line and a determinism line. **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** the baseline SHA and counts are re-recorded at commit. **PASS.**
  Contract file: `villainAbility.types.ts` gains three appended primitives and one optional descriptor field, covered by D-24820.
- **§20 funding:** N/A, as stated above. **§21 API catalog:** N/A (no endpoint). **PASS.**
