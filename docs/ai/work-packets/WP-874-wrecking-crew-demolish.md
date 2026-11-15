# WP-874 — Wrecking Crew Demolish: The Wrecker, Bulldozer and Thunderball (Game Engine + card data)

**Status:** Draft 2026-11-07 (EC-912; D-24820 reserved, PR #3218). **Re-baselined 2026-11-15** on `origin/main` `3b16b5b11`
against D-24854 (WP-897) and D-24824 (WP-877), and made the one Charge primitive shared with WP-839 (RS-6). See §Pre-flight
(01.4) and Copilot (01.7), rounds 3-4.
**Layer:** Game Engine (one resolver seat scope, three villain primitives, one Ambush fire-site bridge, one pure City step helper) +
card data
**User-Visible Surface:** play.legendary-arena.com
**Risk Tier:** MEDIUM — gameplay logic (City positions, escapes, Hero Deck order, every player's hand); no new `G` field, no auth,
money, persistence or server surface
**Hard-deps:** WP-864 / D-24807 (`demolishEachPlayer`, `demolish-each-player`) ✅, WP-252 / D-24023 (parameterized villain
primitives) ✅, WP-489 / D-24295 (the universal `@<space>` location gate) ✅, WP-837 / D-24770 (own-group prefix
`resolveVillainGroupPrefix`) ✅, WP-542 / D-24351 + D-24703 (executor no-op plus reveal fire-site bridge; a bridged Ambush names
itself in the narrative) ✅, WP-757 / D-24587 (`resolveVillainEscape`) ✅, WP-846 / D-24780 (current-player-first order) ✅,
WP-869 / D-24814 (the `composeAmbushNarrative` clause-param precedent) ✅, WP-877 / D-24824 (secondary-site trace,
`recordVillainSecondarySiteTrace`) ✅, WP-897 / D-24854 (keyword-less Ambush narrative channel, `narrativeClause`,
`descriptorClauses`) ✅, WP-838 / D-24771 (the last appended primitive, position 57) ✅

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
times it Demolishes, then each Demolish's reveal and discards, and its Ambush overlay names the same Demolishes (D-24854: the
overlay clause equals the logged lines). Bulldozer's Ambush logs that it charged one space (and pushed the Villains ahead of it),
the City shows it one space further on, any Villain pushed off the Bridge escapes, and a push is followed by a Demolish; the Ambush
overlay names the charge. Fighting Thunderball in the Sewers or Bank Demolishes every other player; elsewhere the log says it had
no effect there (the Fight overlay does not read clauses yet, D-24854 §11). Live-on-surface is operator-pending (D-24026).

## Assumes

- Baseline `origin/main` `3b16b5b11` (2026-11-15; re-baselined from the drafting `0f32bbf4`). `pnpm -r build` 0; game-engine
  7139 / 0 per the D-24854 record at `842aeb5fc` (`3b16b5b11` is docs-only); re-record the count at execution.
- `board/demolish.logic.ts` (WP-864, unchanged since draft): `demolishEachPlayer(G, currentPlayer: string | null, logPrefix:
  string): DemolishResult` (L51-91) reads `G.heroDeck[0]` once (L58), rotates it to the bottom by rebind (L66), logs the reveal,
  then a module-private `discardCardOfCostForEachPlayer` (L102) walks `seatsInTurnOrderFrom(Object.keys(G.playerZones),
  currentPlayer)` (L111) and discards through `selectDefaultCostDiscardCard` + `discardFromHand`. Its two callers are
  `rules/mastermindHandlers.ts` L1180 (Fin Fang Foom) and `villainEffectDemolishEachPlayer` (`villain/villainEffects.execute.ts`
  L5406, call L5412). A third consumer mirrors it: the module-private `composeDemolishNarrativeClause(G, currentPlayer,
  demolishResult)` (L5431-5454, WP-897) re-derives the clause of the lines the resolver logged, walking every seat in the same
  order; a test pins it to the logged lines (D-24854 §3).
- Villain primitives: `VillainEffectPrimitive` (L343) + `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts` L482-649) hold
  **57** at HEAD, the last `shuffle-bystanders-into-villain-deck` (WP-838). `VillainEffectDescriptor` (L798) carries
  primitive-specific optional fields (`magnitude`, `reenterRevealKinds` L902, `stackVillainKind` L915, `capturePiles` L921, …);
  `descriptorKey` is L952. The parser (`setup/villainAbility.setup.ts`) strips the `!<condition>` (~L465-471) then the
  `@<space>[+<space>]` suffix (`parseLocationGatedEffect` L506) before `parseUngatedEffect` (L598), whose terminal
  `parts.length === 1` branch (L1155) accepts any listed no-param primitive; `parsePositiveInteger` (L241) is the magnitude reader.
  The marker script `scripts/convert-cards/apply-effect-markers.mjs` keeps a hand-synced primitive list (L225-283, last entry L282)
  and mirrors the gate (`CITY_SPACE_NAMES` L307, the `@` split L427) and the per-primitive validators (`play-villain-deck-cards`
  L585, `stack-cards-enter-city-as-villains` L576).
- Location gate (D-24295): the executor (`isVillainDescriptorGatedOut`, `villainEffects.execute.ts` L342-353) skips a descriptor
  whose `requireCitySpaces` the fought `cityIndex` does not satisfy and self-narrates "no effect" (`narrateCityGateBlocked` L824);
  it fails closed at the Ambush / Escape sites (no `cityIndex`). Fight sites: `moves/fightVillain.ts` L715 passes the fought
  `cityIndex`; `moves/fortifyFight.ts` L166 and WP-872's Villain-Deck defeat `resolveVillainDeckDefeatFightEffect`
  (`moves/fightVillain.ts` L1119-1125) pass none, so the gate fails closed there (Thunderball is VP 3 and Nightbringer defeats only
  "2VP or less", so the latter is unreachable for it today). `CITY_SPACE_NAMES` index 0 = `sewers`, 1 = `bank`;
  `citySpaceNameForIndex(index)` (`board/citySpaceNames.ts` L48) returns `undefined` past index 4.
- Log helpers: `log/logDisplay.ts` `resolveCardName(cardDisplayData, extId)` (L29; `reveal.ts` already imports `formatCardRef` from
  that module, so no new edge); module-private `villainEffectTimingLabel(timing)` (`villainEffects.execute.ts` L2368) gives
  `Ambush` / `Fight` / `Escape`.
- Own group (D-24770): module-private `resolveVillainGroupPrefix(G, cardId)` (`villainEffects.execute.ts` L936) returns the longest
  selected-group prefix `${set}-villain-${slug}-` and its slug, or `null`. Wrecking Crew instance ids start
  `chmp-villain-wrecking-crew-` (villain ledger rows).
- Narrative channel (D-24854): `executeVillainAbilities` (L212) is a wrapper over `executeVillainAbilitiesWithNarrative` (L241),
  which returns `VillainAbilityExecution { results; narrativeClauses }` (L182). A handler reports its clause through
  `VillainEffectApplication.narrativeClause` (L1226); a keyword-less, non-no-op descriptor that ran without one gets the fallback
  `its Ambush effect resolved (see the log)` (`recordVillainEffectApplication` L379-406). `composeAmbushNarrative(cardName,
  effectResults, villainDeckPlayCount = 0, stackVillainClause?, descriptorClauses = [])` (`events/notableEvents.compose.ts` L446);
  D-24854 §6: a new bridged clause is a trailing parameter after `descriptorClauses`, ordered after the stack clause, and every new
  keyword-less handler sets `narrativeClause`. `villain/ambushNarrative.keywordless.test.ts` L448-510 builds hooks from every
  `data/cards/*.json` group and pins the sorted set of keyword-less `onAmbush` primitives to exactly 16 (L479-496).
- Deliberate no-ops, bridges and traces: `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (L1019, six members) labels a bridged primitive's
  trace `no-op`. `recordVillainSecondarySiteTrace(G, cardId, timing, effect, handler, fireSite, params, turn)` (L1120, D-24824) has
  literal `effect` / `handler` unions (L1126-1135); D-24824 §3 places the record immediately before the bridge call and §7 names
  `charge` as a future member. The exported readers `villainCardPlaysVillainDeckCards` (L2231), `villainCardReenterSewersKinds`
  (L2280) and `villainCardStackVillainEntry` (L2328) scan `getVillainHooksForCard(...)` for the first matching descriptor.
  `villainDeck/villainDeck.reveal.ts` `performVillainReveal` (L259): the card is pushed into the City (L318); `cardHasAmbush`
  (L336) is `hasAmbush(cardId, G.cardKeywords)`; an entry escape goes through `resolveVillainEscape` (L353-355; definition L699);
  then inside `if (cardHasAmbush)` (L375) the WP-743 flag write (L376-382), the `onAmbush` executor call
  `executeVillainAbilitiesWithNarrative` (L390), `ambushCitySpace` (L404-407), the narrative inputs (The Leader count L433, the
  WP-869 stack entry L444), the `ambushResolved` push (L460-475, passing `ambushExecution.narrativeClauses` fifth), then the
  Leader trace + bridge (L487-498) and the stack trace + bridge (L505-518), each through `readRevealContextTurn(context)` (L124).
  `reveal.ts` already imports `villainEffects.execute.ts` (L42-56), which imports `board/demolish.logic.ts` (L86), so importing the
  resolver into `reveal.ts` adds no new module cycle.
- City: `G.city` is `CityZone` (`CitySpace[]`, default 5, may grow, WP-831); `pushVillainIntoCity` (`board/city.logic.ts` L56) pushes
  only the contiguous entry-side block and ejects the last space when no space is empty. No persistent `G` table is keyed by City
  index: bystanders (`G.attachedBystanders`) and every per-villain table key by card id, so moving a card carries its state. The
  pending-choice snapshots that carry a `cityIndex` (defeat targets, `types.ts` L988; `SeatChoiceOption.cityIndex` L1496, including
  the WP-884 / WP-889 hunt option with `huntSource: 'city'` L1539) are frozen by the block-all guards and are shifted the same way
  by any ordinary reveal, so a charge adds no new hazard. `moves/moveVillainChoice.resolve.ts` (Spinning Cyclone) swaps and never
  escapes; it is not the Charge rule.
- Marker data: `scripts/convert-cards/inputs/villain-effect-markers.json` `villains.chmp.wrecking-crew` holds only `piledriver`
  (`fight: koHeroCurrentPlayer`, `escape: demolish-each-player`). Wrecking Crew: Bulldozer VP 2, Piledriver 4, Thunderball 3, The
  Wrecker 5, two copies each; only Piledriver has an `onEscape` hook. `data/cards/chmp.json` is GENERATED (`cards:check`). Only
  `sentinel-core-doom-2p` exists as a `finalStateHash` sentinel (core cards).
- Pins of length 57 in `rules/villainAbility.types.test.ts`: the ordered-list comment (L362-382) and title "contains exactly the 57
  canonical primitives" (L383); the multi-line length assert "exactly 57 entries" (L443-447); the last-entry assert
  `shuffle-bystanders-into-villain-deck` "(position 57)" (L448-452); seven `length, 57` asserts (L676, L714, L742, L797, L856, L936,
  L959); the comment-only totals (L670-675, L709-713, L738-741, L793-796, L852-855, L932-935); the WP-873 `T5` parity `Record`
  (L860-918); and WP-838 T1's `VILLAIN_EFFECT_PRIMITIVES.slice(52)` deep-equal of its five names (L958-965), which any append
  breaks. The WP-869 describe (L931) already reads "is the 45th primitive" (no "and last").
- Competitive surface: `chmp/wrecking-crew` is in published gauntlet loadouts (`packages/registry/src/gauntletLoadouts.generated.ts`,
  9 rows). No `data/par` artifact references the group.
- Local-spike bundle (WP-890 / D-24842): `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` records chmp card
  text, including the four Wrecking Crew `abilities` lines; it is regenerated by `pnpm spike:local-bundle` and is not CI-gated. Its
  `initialStateHash` is unaffected (the featured table is core-only, `scripts/build-local-spike-bundle.mjs` L60-70).

## Context (Read First)

- **One resolver, still.** D-24807 put Demolish in one place. Thunderball's "each other player" is a seat filter on that resolver,
  The Wrecker's count is a loop around it, and Bulldozer's conditional is one call after a charge. No line parses the word Demolish.
- **Why a `charge` primitive, not a Bulldozer special case.** "Moves an extra space forward … pushing" is Charge one space (rules v23
  p.20, L1117-1122: "after this Villain enters the Sewers, it charges forward an extra space, pushing other Villains forward. This
  might cause more escapes."). Charge exists nowhere in the engine. A pushed-off Villain must run the full escape
  (`resolveVillainEscape`, which needs the `RevealContext` and `implementationMap`), so the primitive is an executor no-op bridged at
  the Ambush fire site (D-24351, the Leader / Mr. Immortal / WP-869 shape). `charge:<N>` serves the printed Charge cards later as
  data only; they stay out of scope. It is the one Charge primitive in the engine (RS-6): WP-839's Speed Demon reuses it.
- **Ordering.** Charge is an Ambush effect resolved after entry escapes (rules v23 L571-575, L1117-1119). The bridge runs after
  `resolveVillainEscape` and **before** the `onAmbush` executor, which equals printed order because every carrier this WP or WP-839
  marks prints the charge as its first or only Ambush clause; a real-data test pins that (Scope, Tests). The pushed consequence
  (Bulldozer's Demolish) runs inside the bridge, right after its charge, because it reads whether the charge pushed. cosm's Runner
  (`data/cards/cosm.json` L1248, a conditional charge after a Contest and a discard) does not fit this placement and needs its own
  decision before it is marked.
- **Deferred escape steps.** A Villain the charge pushes out queues its HQ KO and Bystander discard for after the move
  (`enqueueEscapeProcedure`, `villainDeck.reveal.ts` L750, D-24656 §4), so Bulldozer's inline Demolish discards before those
  rulebook steps (rules v23 L556-570). This is the same accepted deviation as an entry escape followed by an Ambush.
- **Narrative (D-24854).** The charge is a bridged effect, so its clause is a new trailing `composeAmbushNarrative` parameter after
  `descriptorClauses` (D-24854 §6). The Wrecker's and Thunderball's Demolish are keyword-less handler-run effects, so each handler
  sets `narrativeClause` to exactly the clause of the lines it logged (D-24854 §1 / §6); the Ambush overlay then names The
  Wrecker's Demolishes, and Thunderball's clause waits for the Fight narrative (D-24854 §11). Thunderball's `'each-other'` scope
  makes `composeDemolishNarrativeClause` take the same `seatScope` (RS-1), so the clause cannot drift from the log.
- **Determinism / hash.** No new `G` field and no randomness. The charge and the Demolishes are deterministic functions of `G`. The
  three hooks are setup-built from card data, so live-verify needs a match created after the deploy. Replays of pre-WP-874 matches
  that reveal Bulldozer or The Wrecker, or fight Thunderball in the Sewers / Bank, diverge on re-execution; stored
  `competitive_scores` rows stay frozen (D-24616 §5), and a pre-deploy `bgio.replay_artifacts` capture with such an event that is
  submitted after the deploy fails closed `replay_verification_failed` (the D-24854 §10 / D-24756 precedent). No sentinel uses chmp.
- Rules line citations (`L…`) are to `docs/legendary-universal-rules-v23.md`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (villain group shape) and §5 (ability markup; `[effect:]` is a
  pipeline-appended engine marker): the packet regenerates `data/cards/chmp.json` ability lines through the marker overlay.
- `docs/ai/ARCHITECTURE.md` §Move Validation Contract, §Rule Execution Pipeline, Principle #1. Scan D-24807, D-24023, D-24295,
  D-24770, D-24351, D-24703, D-24587, D-24656, D-24780, D-24814, D-24824 and D-24854 in `docs/ai/DECISIONS.md`.
  `docs/ai/REFERENCE/00.6-code-style.md`.

### RS-1 — Seat scope on the resolver and its clause (default locked)

`board/demolish.logic.ts` exports `type DemolishSeatScope = 'each' | 'each-other'`, and `demolishEachPlayer` gains a trailing
optional parameter `seatScope: DemolishSeatScope = 'each'`, passed through to the private discard loop. Existing callers are
unchanged. With `'each-other'` and a non-null `currentPlayer`, that seat is skipped (no line for it). If the remaining seat list is
empty (solo), the reveal and rotation still happen and one line logs `${logPrefix} there is no other player to discard.`
(`blocked`); the result's `discards` is `[]`. Reveal, rotation, cost and log lines are otherwise exactly D-24807's.

`composeDemolishNarrativeClause(G, currentPlayer, demolishResult, seatScope: DemolishSeatScope = 'each')` (module-private,
`villainEffects.execute.ts`) gains the same trailing parameter: with `'each-other'` it skips a non-null current seat, and when no
seat remains it emits the clause `there is no other player to discard` after the reveal clause. `villainEffectDemolishEachPlayer`
and its WP-897 test are unchanged (default scope).

### RS-2 — Thunderball (default locked)

Primitive `demolish-each-other-player` (no params). Handler `villainEffectDemolishEachOtherPlayer(G, currentPlayer, cardId, timing)`
→ `const demolishResult = demolishEachPlayer(G, currentPlayer, label, 'each-other')`, where `label` =
`${villainEffectTimingLabel(timing)} effect:`, returning `{ targets: [], narrativeClause: composeDemolishNarrativeClause(G,
currentPlayer, demolishResult, 'each-other') }`. Marker `wrecking-crew/thunderball` `fight:
["demolish-each-other-player@sewers+bank"]`: the D-24295 gate does the "in the Sewers or Bank" part, with no new gate code. A
Thunderball fought through `fortifyFight` or the Villain-Deck defeat (no `cityIndex`) fails the gate closed.

### RS-3 — The Wrecker (default locked)

Primitive `demolish-each-player-per-group-villain-in-city` (no params). Handler
`villainEffectDemolishEachPlayerPerGroupVillainInCity(G, currentPlayer, cardId, timing)`, `label` =
`${villainEffectTimingLabel(timing)} effect:`. Each directly logged line is built once as `clause` and logged as
`` `${label} ${clause}.` `` (the D-24854 §1 directly-logging shape):

0. If an entry-escape side effect has already moved The Wrecker out of the City, step 2 counts only the others (0 → step 3).
1. `group = resolveVillainGroupPrefix(G, cardId)`. If `null`: clause `the Villain's group is not among this match's Villain Groups,
   so no one is Demolished` (`blocked`); return `{ targets: [], narrativeClause: clause }`.
2. `count` = the non-null `G.city` spaces whose id starts with `group.groupPrefix` (the card itself included), taken once.
3. If `count === 0`: clause `no ${group.groupSlug} Villain is in the City, so no one is Demolished` (`blocked`); return with it.
4. Header clause `Demolish each player ${count} time(s), once for each ${group.groupSlug} Villain in the City` (`neutral`; the
   `(s)` is literal, the D-24807 Fin Fang Foom header precedent; the slug is overlay text, the D-24770 Scorpion precedent), then call
   `demolishEachPlayer(G, currentPlayer, label)` `count` times in a `for` loop, collecting
   `composeDemolishNarrativeClause(G, currentPlayer, result)` after each call. Return `{ targets: [], narrativeClause: [header,
   ...demolishClauses].join('; ') }`.

Marker `wrecking-crew/the-wrecker` `ambush: ["demolish-each-player-per-group-villain-in-city"]`. Henchmen and other groups never
match the prefix. The count is fixed at the start: a Demolish moves no Villain.

### RS-4 — Charge and Bulldozer (default locked)

- **Grammar.** Primitive `charge`: `charge:<N>` → `{ primitive: 'charge', magnitude: N }`; `charge:<N>:<consequence>` → the same
  plus `chargePushConsequence: <consequence>`, where `<consequence>` is a member of the closed type
  `VillainChargePushConsequence = 'demolish-if-pushed'` with its canonical array `export const VILLAIN_CHARGE_PUSH_CONSEQUENCES:
  readonly VillainChargePushConsequence[] = ['demolish-if-pushed'] as const;` (contract file, D-24820; an append-only `// why:` names
  WP-839's `'discard-if-pushed'`, RS-6; the `VillainCapturePile` / `VILLAIN_CAPTURE_PILES` precedent, `rules/villainAbility.types.ts`
  L656-662). The parser's `charge` arm accepts `parts[2]` only by looping that array (the `setup/villainAbility.setup.ts` L296-302
  precedent). `N` via `parsePositiveInteger`; any other shape (`charge`, `charge:0`, `charge:x`, `charge:1:other`,
  `charge:1:discard-if-pushed` (not a member yet), a fourth part) → `null` (`unresolvedMarkers`); the arm returns before the terminal
  no-param branch, so bare `charge` is rejected. `VillainEffectDescriptor` gains optional `chargePushConsequence?:
  VillainChargePushConsequence`, outside `descriptorKey`; the parser omits it when absent. The marker script gets the same validator
  and a hand-synced `VILLAIN_CHARGE_PUSH_CONSEQUENCES` copy (the `apply-effect-markers.mjs` L309-314 precedent).
- **Executor.** Handler `villainEffectCharge()` returns `{ targets: [] }` and mutates nothing; `charge` joins
  `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES` (its trace reads `no-op`; no `narrativeClause`, the bridge names it). Exported reader
  `villainCardChargeEffect(G, cardId, timing): { spaces: number; pushConsequence: VillainChargePushConsequence | null } | null`
  returns the first `charge` descriptor at that timing (the `villainCardReenterSewersKinds` guards), with `spaces:
  descriptor.magnitude ?? 1` and `pushConsequence: descriptor.chargePushConsequence ?? null`. It returns `null` when that descriptor
  carries `requireCitySpaces` or `requireCondition` (a `// why:`: the executor fails a gated descriptor closed at the Ambush site,
  so a gated `charge` must not charge either; no carrier is gated). Only the Ambush fire site reads it; a `charge` at another timing
  is inert.
- **Pure step.** New `board/villainCharge.logic.ts` (no boardgame.io, no registry import) exports the types `ChargeStepResult` and
  `ChargeOutcome` (`{ spacesMoved: number; hasPushedAnyVillain: boolean; hasChargerEscaped: boolean; triggeredPushConsequence:
  VillainChargePushConsequence | null }`, the last a type-only import from `rules/villainAbility.types.ts`; both `reveal.ts` and
  `notableEvents.compose.ts` `import type` them, so compose never imports reveal) and `chargeCityVillainOneSpace(city: CityZone,
  fromIndex: number): ChargeStepResult`, `ChargeStepResult { city: CityZone; hasPushedVillain: boolean; escapedCardId: CardExtId |
  null; hasChargerEscaped: boolean }`. Input never mutated; never throws. Rules: an out-of-range `fromIndex` or a null space →
  unchanged copy, all false / null. `fromIndex` is the last space → the charger leaves (`city[fromIndex] = null`), `escapedCardId` =
  the charger, `hasChargerEscaped: true`. Otherwise the destination is `fromIndex + 1`: empty → the charger moves,
  `hasPushedVillain: false`; occupied → `hasPushedVillain: true`, and the contiguous block from the destination shifts one space
  forward up to the first empty space after it; with no empty space the last space's card is `escapedCardId`. Then the charger takes
  the destination and its old space is null. `ChargeOutcome.spacesMoved` counts the steps after which the charger is still in the
  City; an exit step sets only `hasChargerEscaped`.
- **Trace (D-24824).** Inside the `villainCardChargeEffect(G, cardId, 'onAmbush') !== null` guard, immediately before the bridge
  call: `recordVillainSecondarySiteTrace(G, cardId, 'onAmbush', 'charge', 'chargeAmbushVillain', 'villain-ambush-bridge', {
  magnitude: chargeEffect.spaces }, readRevealContextTurn(context))`, with `'charge'` / `'chargeAmbushVillain'` appended to the
  helper's `effect` / `handler` unions (D-24824 §7). Because this bridge runs before the executor, the card's trace order is
  `secondary-site` (bridge), then any pushed-out Villain's escape traces, then the executor's `no-op` (the reverse of the Leader and
  stack bridges, which run after the executor).
- **Bridge.** In `villainDeck.reveal.ts`, module-private `chargeAmbushVillain(G, context, implementationMap, cardId, chargeEffect):
  ChargeOutcome`, called inside `if (cardHasAmbush)` after the WP-743 flag write and **before** the `onAmbush` executor call, when
  `villainCardChargeEffect(G, cardId, 'onAmbush')` is non-null (passed in as `chargeEffect`). For each of `chargeEffect.spaces`
  steps: `fromIndex = G.city.indexOf(cardId)`, stop if `-1`; apply the step to `G.city`; log the step through a private
  `logChargeStep` (below); if `escapedCardId !== null` call `resolveVillainEscape(G, context, implementationMap, escapedCardId)`;
  stop if `hasChargerEscaped`. After the loop (also when the charger escaped), when `chargeEffect.pushConsequence !== null`, a
  `switch` on it with a `const unhandled: never = consequence` default: `'demolish-if-pushed'` → if `hasPushedAnyVillain`,
  `demolishEachPlayer(G, context.ctx.currentPlayer, 'Ambush effect:')` and `triggeredPushConsequence = 'demolish-if-pushed'`; else
  log its no-push line. `triggeredPushConsequence` (JSDoc: the consequence the push triggered, resolved inline or owed after the
  move) stays `null` without a push. **Reentrancy:** the bridge keeps its state in locals (no module-level state). A
  nested reveal reached through `resolveVillainEscape` (e.g. an escape that becomes a Scheme Twist whose resolver reveals) runs its
  own bridge to completion first, and its `ambushResolved` is pushed before the outer card's; the outer loop re-reads `indexOf`
  every step, so escape side effects that move City cards are absorbed.
- **Logs** (`<name>` = `resolveCardName(G.cardDisplayData, cardId)`; `<space>` = `the <Name>` from `citySpaceNameForIndex(to)` with
  a capitalized first letter, else `city space <to>`; category `threat` unless noted):
  - moved: `Ambush effect: <name> charged forward one space to <space>.`
  - moved and pushed: `Ambush effect: <name> charged forward one space to <space>, pushing the Villains ahead of it forward.`
  - charger off the end: `Ambush effect: <name> charged forward out of the city.`
  - no push with `demolish-if-pushed`: `Ambush effect: <name> pushed no Villains forward, so no one is Demolished.` (`blocked`)
- **Narrative.** New `composeChargeClause(outcome: ChargeOutcome): string | undefined` in `events/notableEvents.compose.ts`:
  `hasChargerEscaped` → `charged out of the city`; else `spacesMoved === 1` → `charged forward one space`; else `spacesMoved > 1` →
  `charged forward ${spacesMoved} spaces` (the `composeVillainDeckPlayClause` singular / plural precedent); else `undefined`. Append
  `, pushing Villains forward` when `hasPushedAnyVillain`, then a `switch` on a non-null `triggeredPushConsequence` with a `never`
  default: `'demolish-if-pushed'` → `, then Demolished each player` (a summary, by choice: the Demolish's own reveal and discards are in the log; bridged clauses summarize, the
  play / stack precedent). `composeAmbushNarrative(cardName, effectResults, villainDeckPlayCount = 0, stackVillainClause?,
  descriptorClauses = [], chargeClause?)` pushes the charge clause after the stack clause (D-24854 §6); the call site passes
  `ambushExecution.narrativeClauses` fifth and the charge clause sixth. No charge → no change. The hashed
  `ambushResolved.citySpace` (`G.city.indexOf(cardId)`) is read after the charge: the charger's settled index (Bulldozer in the Bank
  → 1), falling back to 0 when it left the City (the existing fallback, unchanged). On a card with a charge and a handler-run Ambush
  effect, the overlay names the handler-run clause before the charge clause although the charge ran first (no card this WP or
  WP-839 marks has both: Bulldozer and Speed Demon carry only the charge, and the six printed ssw2 Ambush Charge lines have no
  second Ambush clause; cosm's Runner, Ordering above, is unmarked).
- **Marker** `wrecking-crew/bulldozer` `ambush: ["charge:1:demolish-if-pushed"]`.

### RS-5 — Positions (default locked)

Append, in this order, after `shuffle-bystanders-into-villain-deck`: `demolish-each-other-player`,
`demolish-each-player-per-group-villain-in-city`, `charge` (positions 58, 59, 60 at `3b16b5b11`). If another packet appends first,
append after it and record the positions in an inline Execution Amendment (the WP-864 precedent); every pin value below follows the
recorded final positions. The marker script's hand-synced list appends at the same positions.

### RS-6 — The one Charge primitive, shared with WP-839 (default locked)

Drafted WP-839 (EC-877, D-24772) independently specified `charge-forward:<N>[:discard-each]`, a `chargeCityCardOneSpace` step in
`board/city.logic.ts` with its own `ChargeStepResult`, and a bridge after the `ambushResolved` event. Two primitives for one
rulebook keyword, and two exported `ChargeStepResult` types, would diverge. D-24820 locks this packet's `charge` as **the** Charge
primitive for villain-card Ambush Charge lines: its grammar, `board/villainCharge.logic.ts`, `chargeAmbushVillain` before the
executor, `ChargeOutcome`, `composeChargeClause`, the trace and the settled `citySpace`. A later Ambush Charge consequence
(WP-839's Speed Demon: every player owes a discard) touches exactly:
- `VillainChargePushConsequence` and `VILLAIN_CHARGE_PUSH_CONSEQUENCES` (one member each, `'discard-if-pushed'`) and the drift pin;
- the marker script's hand-synced copy (the parser's membership loop needs no edit), and WP-874's `charge:1:discard-if-pushed`
  negative parser case, which flips to a positive case (a deliberate test change);
- one `case` in the bridge's consequence `switch`, including its own no-push line (the `'demolish-if-pushed'` no-push line says
  "so no one is Demolished");
- one `case` in `composeChargeClause`;
- its marker token.

It adds no primitive, step helper or bridge. Charges outside the Ambush site are outside this lock: ssw2 King Hyperion's Master
Strike (`data/cards/ssw2.json` L1855, "he charges three spaces") and Charge the Wall's Twist (L2439, a simultaneous charge of every
Villain) may call `chargeCityVillainOneSpace` from their own sites under their own decisions.

**If WP-839 executes first** (Execution Amendment rule):
- WP-839 builds `charge` in this shape (D-24772 then carries the obligation);
- WP-874 appends only its two Demolish primitives, so the `slice` pin covers two names and the RS-5 walk gains only
  `demolish-each-player-per-group-villain-in-city`;
- `'demolish-if-pushed'` is appended to the existing array; the consequence drift pin deep-equals the landed array in its landed
  order, and the `charge:1:discard-if-pushed` negative parser case is dropped (that token is valid);
- the `charge` provenance row stays WP-839 / D-24772;
- `board/villainCharge.logic.ts` and its tests become "modified";
- the trace and bridge go wherever WP-839 placed the Ambush block (inside `resolveVillainCityEntry` if it extracted one).

WP-839's WORK_INDEX row, WP-839 and EC-877 record this.

## Scope (In)

- **Resolver** (`board/demolish.logic.ts`): `DemolishSeatScope`, the `seatScope` parameter, the solo line (RS-1).
- **Primitives** (`rules/villainAbility.types.ts`, contract file, D-24820): three union members and array entries;
  `VillainChargePushConsequence` and `VILLAIN_CHARGE_PUSH_CONSEQUENCES`; the optional `chargePushConsequence` descriptor field
  (RS-2..RS-6).
- **Parser** (`setup/villainAbility.setup.ts`): the `charge` grammar arm (the two no-param primitives need none).
- **Executor** (`villain/villainEffects.execute.ts`): three handlers (two setting `narrativeClause`), three table entries, `charge`
  in `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`, `villainCardChargeEffect`, the `seatScope` on `composeDemolishNarrativeClause`, and the
  two union members on `recordVillainSecondarySiteTrace`.
- **Pure step** (`board/villainCharge.logic.ts`, new; also the `ChargeStepResult` / `ChargeOutcome` types) and **bridge**
  (`villainDeck/villainDeck.reveal.ts`, the trace + `chargeAmbushVillain` + its call + the clause argument).
- **Narrative** (`events/notableEvents.compose.ts`): `composeChargeClause`, the trailing `chargeClause` parameter.
- **Data:** marker-script primitive list + `charge` validator + consequence set; three marker entries; regenerated
  `data/cards/chmp.json`; the regenerated local-spike bundle.
- **Coverage:** `mechanic-provenance.json` rows for the three primitives (`{ wp: "WP-874", decision: "D-24820" }`); pending
  `live-verify.json` rows (The Wrecker, Bulldozer, Thunderball); regenerated feeds as in WP-864.
- **Tests:**
  - New `board/villainCharge.logic.test.ts` (pure step): empty destination; occupied destination with a gap ahead; a full block to
    the edge ejects the last card; a charger on the last space escapes itself; invalid `fromIndex` / null space is a no-op; the
    input array is not mutated; a grown 6-space City.
  - New `villainDeck/villainCharge.reveal.test.ts` (Bulldozer hook from the real parser on the committed `chmp.json`, through
    `performVillainReveal` with a real `implementationMap`; City given before the reveal, Bulldozer = B, with `'ambush'` in
    `G.cardKeywords` for B so `cardHasAmbush` is true). Every filler (A, B', C, D, X, Y, Z, WC) is a Villain id with no `onEscape`
    hook (Thunderball-00/-01 and The Wrecker-00/-01 are the non-escape Wrecking Crew ids), except the named Piledriver; the
    ordering-proof match selects the Wrecking Crew group so `resolveVillainGroupPrefix` resolves.
    - `[null,null,null,null,null]` → B ends at index 1 (Bank), no Hero Deck rotation, the no-push line,
      `ambushResolved.citySpace === 1`.
    - `[A,null,null,null,null]` → the entry puts A in the Bank, the charge pushes A to index 2 and B to 1; one Demolish (Hero Deck
      rotated once, discards made).
    - `[null,A,B',C,D]` (no entry escape) → the charge pushes D out: escaped counter +1, the Escape Pile gains D, then one Demolish;
      `G.pendingEscapeProcedures` holds D's entry after the Demolish has already run (D-24656 §4).
    - `[null,X,Y,Z,Piledriver]` → Piledriver is pushed out and its Escape `demolish-each-player` fires inside the loop, then
      Bulldozer's Demolish: the Hero Deck rotated twice, and the first Demolish's cost drove the first discards.
    - Ordering proof by state: a hand-built hook `ambush: ['charge:1', 'demolish-each-player-per-group-villain-in-city']` that
      **replaces** the real Bulldozer `onAmbush` hook, on a Wrecking Crew-prefixed charger with `[null,WC,WC,WC,WC]` → 4 Hero Deck
      rotations (bridge first: one WC is pushed out before the count; executor first would give 5). Its narrative names the
      Demolish clause before the charge clause (RS-4 Narrative).
    - `villainCardChargeEffect` returns `null` for a hand-built gated `charge:1@bank` hook, and no charge happens.
    - Real-data invariant: over every `data/cards/*.json` group through the real parser, every `charge` descriptor is the first
      effect of its `onAmbush` hook (the Ordering premise).
    - The `ambushResolved` narrative carries the charge clause in the sixth slot. For the real Bulldozer hook, the card's traces
      read `charge` / `secondary-site` / `villain-ambush-bridge` first and `charge` / `no-op` / `villain-executor` last; for the
      ordering-proof hook, `secondary-site` (charge), then `no-op` (charge), then the Wrecker primitive's `fired`.
  - `board/demolish.logic.test.ts` (extended): `'each-other'` skips the current player and keeps their hand; the solo line; the
    default scope is byte-identical to before (the existing cases unchanged). The Wrecker through the real executor: alone → one
    Demolish; with two more Wrecking Crew Villains → three; a non-Wrecking-Crew Villain is not counted; a match whose selection lacks
    the group → the blocked line; in each case the returned `narrativeClause` equals the logged `Ambush effect:` lines without the
    prefix and final period, joined `; `. Thunderball through the real executor: `cityIndex` 0 and 1 → each-other Demolish, and its
    `narrativeClause` equals its logged lines (fighter's seat absent; solo → `there is no other player to discard`); `cityIndex` 2
    and `undefined` → no reveal and the D-24295 "no effect" line.
  - Parser cases (`setup/villainAbility.setup.test.ts`, the synthetic-registry precedent): `charge:1:demolish-if-pushed`,
    `charge:2`, the gated `demolish-each-other-player@sewers+bank`; `charge`, `charge:0`, `charge:x`, `charge:1:other`,
    `charge:1:discard-if-pushed`, `charge:1:demolish-if-pushed:x` → `unresolvedMarkers`.
  - `events/notableEvents.compose.test.ts`: each `composeChargeClause` branch; the sixth argument lands after the stack clause; no
    clause leaves `composeAmbushNarrative` unchanged.
  - The WP-897 overlay test (`villain/ambushNarrative.keywordless.test.ts`): `FIXTURE_GROUP_IDS` (L38-50) gains
    `chmp/wrecking-crew` so The Wrecker gets its hook and `resolveVillainGroupPrefix` resolves; a Wrecker case in the AC-3 style
    (the overlay equals the log); and the RS-5 real-data walk's sorted set gains `charge` and
    `demolish-each-player-per-group-villain-in-city`, its title "exactly the 16" → "exactly the 18" (all sanctioned, citing WP-874
    / D-24820 / D-24854 §6; the existing pinned logs are unaffected because their cards' hooks do not change).
  - Pins (`rules/villainAbility.types.test.ts`, each citing WP-874 / D-24820): the ordered-list comment + the three entries and the
    title "57" → "60"; "exactly 57 entries" → 60; the last-entry assert → `charge` "(position 60)"; the seven `length, 57` → 60 and
    the comment-only totals → 60; WP-838 T1's `slice(52)` → `slice(52, 57)` (its five names unchanged); the `T5` parity `Record`
    gains the three keys; a new runtime pin that `VILLAIN_EFFECT_PRIMITIVES.slice(57)` deep-equals the three new names in order;
    a new runtime drift pin that the keys of a `Record<VillainChargePushConsequence, true>` deep-equal
    `VILLAIN_CHARGE_PUSH_CONSEQUENCES`, which deep-equals `['demolish-if-pushed']` (D-24372; WP-839's append is a deliberate pin
    change).
  - Expected unchanged: every `finalStateHash` sentinel, the WP-864 Fin Fang Foom / Trull / Zzutak / Piledriver tests, the WP-897
    Demolish clause test (default scope), `runtime-observed-hollows.json`.

## Out of Scope

- **The printed Ambush Charge lines** (the six ssw2 `[keyword:Charge]` Ambush lines in `data/cards`): data-only `charge:<N>`
  follow-ups. The non-Ambush charges (ssw2 King Hyperion's Master Strike, Charge the Wall's Twist) and cosm's conditional Runner
  push are outside the RS-6 lock and need their own decisions.
- **co2e Speed Demon** (WP-839): it reuses `charge` with a `'discard-if-pushed'` consequence in its own packet (RS-6).
- **The Fight overlay narrative** (Thunderball's clause is reported but the Fight narrative does not read clauses; D-24854 §11).
- Pagliacci, Gwenpool, Nul, Uru-Enchanted Iron Man, Nick Fury and the vill Avengers Demolish lines; Epic Fin Fang Foom; an
  interactive "which card of that cost" pick (D-24807).
- Any new `G` field, pending queue, move, UIState field, client or server change; `replay/replay.execute.ts`; `pushVillainIntoCity`.

## Files Expected to Change

- `packages/game-engine/src/board/demolish.logic.ts`: **modified**, RS-1.
- `packages/game-engine/src/board/villainCharge.logic.ts`: **new**, RS-4 pure step.
- `packages/game-engine/src/rules/villainAbility.types.ts`: **modified** (contract file; D-24820).
- `packages/game-engine/src/setup/villainAbility.setup.ts`: **modified**, the `charge` arm.
- `packages/game-engine/src/villain/villainEffects.execute.ts`: **modified**, handlers, table, no-op set, reader, the clause
  `seatScope`, the trace unions.
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts`: **modified**, the trace + bridge (same-layer runtime wiring, `01.5`).
- `packages/game-engine/src/events/notableEvents.compose.ts`: **modified**, the clause.
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`: **modified**;
  `data/cards/chmp.json`: **generated**.
- `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json`: **regenerated** by `pnpm spike:local-bundle` after the
  marker pass (the WP-838 precedent; `initialStateHash` unchanged).
- Generated / provenance: `docs/ai/coverage/villain-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`,
  `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json` (expected unchanged),
  `scripts/coverage/hero-effect-coverage.baseline.json` (only if it moves), `scripts/coverage/mechanic-provenance.json`,
  `docs/ai/coverage/live-verify.json`; `apps/dashboard/src/data/in-play-hollow-baseline.json` +
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` only if the in-play pin moves (other dashboard copies are gitignored).
- Tests: `packages/game-engine/src/board/villainCharge.logic.test.ts` (**new**),
  `packages/game-engine/src/villainDeck/villainCharge.reveal.test.ts` (**new**), `packages/game-engine/src/board/demolish.logic.test.ts`,
  `packages/game-engine/src/rules/villainAbility.types.test.ts`, `packages/game-engine/src/setup/villainAbility.setup.test.ts`
  (parser cases), `packages/game-engine/src/events/notableEvents.compose.test.ts` (clause cases) and
  `packages/game-engine/src/villain/ambushNarrative.keywordless.test.ts` (the Wrecker case and the RS-5 set, sanctioned).
- Governance at close: `docs/ai/post-mortems/01.6-WP-874-wrecking-crew-demolish.md` (**new**, mandatory under
  `01.6-post-mortem-checklist.md` L42-51: `charge`, `VillainChargePushConsequence` and `ChargeOutcome` are a long-lived extension
  seam), `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24820), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note).

## Non-Negotiable Constraints

- Full file contents for every new or modified file: no diffs, no snippets. ESM only, Node v22+, human-style code; see
  `docs/ai/REFERENCE/00.6-code-style.md`.
- Determinism: no randomness, clocks or I/O. `for` loops; no `.reduce()`, no nested ternaries. Moves and handlers never throw.
- One Demolish implementation: every new line calls `demolishEachPlayer`; no second reveal or discard loop. One Demolish clause
  re-derivation: `composeDemolishNarrativeClause`, with the same `seatScope` as the call it describes.
- One Charge implementation: `charge` is the only Charge primitive (RS-6).
- `board/villainCharge.logic.ts` imports no boardgame.io and no registry (type-only imports from `rules/`, `state/` and
  `board/city.types.ts` only). City
  writes rebind `G.city`; the pure step never mutates its input. Every escape goes through `resolveVillainEscape`.
- Card data changes only through the marker sources plus a reproducible regen (`cards:check`); never hand-edit generated card JSON.
  No per-card special-casing in engine code: the three cards are reached only through their markers.

**Session protocol:** STOP and report if any sentinel or golden hash moves; if the regen changes any card file other than
`chmp.json`; if a WP-864 Demolish test, the WP-897 Demolish clause test or an existing reveal / escape test changes (the sanctioned
edits to `ambushNarrative.keywordless.test.ts` and `villainAbility.types.test.ts` listed in Scope are the only exceptions); or if
importing the resolver into `villainDeck.reveal.ts` creates a module cycle.

**Locked contract values:** see the EC `## Locked Values`.

## Contract

- `demolishEachPlayer(G, currentPlayer, logPrefix, seatScope?: DemolishSeatScope): DemolishResult`; `DemolishSeatScope`.
- `chargeCityVillainOneSpace(city, fromIndex): ChargeStepResult`, and the types `ChargeStepResult` / `ChargeOutcome`
  (`board/villainCharge.logic.ts`).
- Villain primitives `demolish-each-other-player`, `demolish-each-player-per-group-villain-in-city` (no params) and
  `charge:<N>[:<VillainChargePushConsequence>]`; type `VillainChargePushConsequence = 'demolish-if-pushed'` and its canonical
  array `VILLAIN_CHARGE_PUSH_CONSEQUENCES`; descriptor field `chargePushConsequence?`; reader `villainCardChargeEffect`.
- `composeChargeClause(outcome)`; `composeAmbushNarrative(cardName, effectResults, villainDeckPlayCount = 0, stackVillainClause?,
  descriptorClauses = [], chargeClause?)`.
- `recordVillainSecondarySiteTrace` unions gain `'charge'` / `'chargeAmbushVillain'`.

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2, §8 (Deterministic Game Engine), §10, §22 (Deterministic & Reproducible
Evaluation).
- **No conflict:** three printed card lines that do nothing today resolve as printed and as the rulebook defines Demolish and Charge.
- **Non-Goal proximity:** NG-1 (no pay-to-win) untouched; printed card abilities only, nothing bought.
- **Determinism preservation:** no randomness and no new state; the charge, escapes and Demolishes are pure functions of `G`.
  Pre-WP-874 replays with these effects diverge; stored competitive rows stay frozen (D-24616 §5), and post-deploy submissions of
  pre-deploy captures with these effects fail closed (D-24854 §10 / D-24756 precedent).

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
5. The Ambush overlay names Bulldozer's charge (sixth composer slot) and The Wrecker's Demolishes; each handler-run clause equals its
   logged lines (D-24854). No other narrative changes.
6. `charge` is the only Charge primitive, and its traces read `secondary-site` before `no-op` (RS-4, RS-6, D-24824).
7. `cards:check` reproduces the card data; the villain ledger lists the three cards executable under their primitives; every feed
   `:check` exits 0. Engine and dashboard suites green; `pnpm -r build` 0; `finalStateHash` sentinels unchanged.

## Verification Steps

Regenerate, in this order, after the engine change builds:

- Add the provenance rows and the pending `live-verify.json` rows first.
- `node scripts/convert-cards/apply-effect-markers.mjs`: exits 0, and only `data/cards/chmp.json` changes.
- `pnpm -r build`: exits 0; `git status` shows no unexpected generated churn.
- `pnpm ledger:villains`, `pnpm effect-index`, `pnpm mechanics:metadata`, `pnpm sim:runtime-observed`, `pnpm sim:coverage --check`
  (`--update-baseline` only if it reports a move), `pnpm --filter @legendary-arena/dashboard prebuild:coverage`,
  `pnpm spike:local-bundle`: each exits 0.

Check (each exits 0):

- `pnpm --filter @legendary-arena/game-engine test`: green; record the exact delta from the 7139 baseline and expect at least +28.
- `pnpm --filter @legendary-arena/dashboard test`.
- `pnpm cards:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`,
  `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`, `pnpm cards:count-markers:check`.
- At govern-close: `pnpm roadmap:counts:check`, `pnpm workindex:rows:check`, `pnpm workindex:executed:check`,
  `pnpm workindex:liveverify:check` and `node scripts/check-number-ledger.mjs --check`.

## Definition of Done

- [ ] All Acceptance Criteria pass.
- [ ] Engine and dashboard suites green; `pnpm -r build` exits 0.
- [ ] Generated feeds regenerated and every `:check` / `--check` above green; provenance rows added.
- [ ] `finalStateHash` sentinels byte-unchanged.
- [ ] **Live-on-surface (D-24026):** in a Wrecking Crew match **created after the deploy** (`isMatchOlderThanServer: false`), at
      least one of The Wrecker's Ambush, Bulldozer's charge (City positions in Play Diagnostics plus its log lines) or a Thunderball
      fight in the Sewers / Bank, confirmed from the log lines and hand sizes, or operator-pending in `STATUS.md` with the
      pending `live-verify.json` rows (the WP-864 precedent: live-verify lands as its own SPEC after the deploy).
- [ ] The 01.6 post-mortem `docs/ai/post-mortems/01.6-WP-874-wrecking-crew-demolish.md` is written (verdict WP COMPLETE).
- [ ] `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24820 → Active; `WORK_INDEX.md` checked, ending with its live-verify
      token (D-24853); `EC_INDEX.md` Done; mindmap ✅ + `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; NUMBER-LEDGER LANDED.
- [ ] No files outside `## Files Expected to Change` were modified; checked with `git diff --name-only origin/main...HEAD`.

## Reserved Decision (lands at execution)

D-24820: three chmp Wrecking Crew lines reuse the D-24807 `demolishEachPlayer` resolver, which gains a trailing `seatScope` (`'each'`
default, `'each-other'` skips the current player; with no other seat the reveal still happens and a "no other player" line logs);
`composeDemolishNarrativeClause` takes the same scope so the overlay clause matches the log. Three villain primitives are appended
after `shuffle-bystanders-into-villain-deck`: `demolish-each-other-player` (Thunderball's Fight, gated `@sewers+bank` by the D-24295
location gate), `demolish-each-player-per-group-villain-in-city` (The Wrecker's Ambush: Demolish once per City Villain of its own
group, found by the D-24770 prefix and counted once, itself included; an unresolved group fails closed) and
`charge:<N>[:<consequence>]` (descriptor field `chargePushConsequence`, closed type `VillainChargePushConsequence` with canonical
array `VILLAIN_CHARGE_PUSH_CONSEQUENCES` and a runtime drift pin, first member `demolish-if-pushed`). Both Demolish handlers set `narrativeClause` (D-24854 §6). Charge is the rulebook keyword (v23 p.20): an
executor no-op bridged at the Ambush fire site (D-24351), traced `secondary-site` before the bridge (D-24824), run **before** the
`onAmbush` executor; each step moves the Villain one space forward, pushing the contiguous block ahead of it, and a card pushed off
the end, or the charger itself from the last space, escapes through `resolveVillainEscape`. Bulldozer
(`charge:1:demolish-if-pushed`) Demolishes once only if a step pushed a Villain. The charge clause is the sixth
`composeAmbushNarrative` parameter (D-24703, D-24854 §6). `charge` is the engine's one Charge primitive for villain-card Ambush
Charge lines: WP-839's Speed Demon reuses it by appending a consequence member to `VILLAIN_CHARGE_PUSH_CONSEQUENCES` (plus its
drift pin, the marker-script copy, one `case` in the bridge's and the clause's exhaustive `switch` with a `never` default, its own
no-push line and its marker token), and the six printed ssw2 Ambush Charge lines reuse it as data-only `charge:<N>` markers;
never a second primitive, step helper or bridge; this supersedes WP-839's drafted `charge-forward`. The bridge runs after entry escapes and before the executor, which is
printed order for every marked carrier (the charge is the first or only Ambush clause; a real-data test pins it); a gated `charge`
descriptor is inert; pushed-out Villains' HQ KO and Bystander steps stay deferred after the move (D-24656 §4). Master Strike and
Twist charges and cosm's conditional Runner push are outside this lock. Replays of pre-WP-874 matches with these effects diverge; stored competitive rows stay
frozen (D-24616 §5); post-deploy submissions of pre-deploy captures with these effects fail closed.

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
  **Final (2026-11-07): pre-flight READY TO EXECUTE; copilot RISK with the concern documented.**
- **Pre-flight round 3 (re-run 2026-11-15 on `3b16b5b11`, independent): NOT READY**, six PS items, all folded in this revision:
  - PS-1: `composeAmbushNarrative`'s fifth slot is now `descriptorClauses` (D-24854); the charge clause is the sixth parameter.
  - PS-2: The Wrecker and Thunderball handlers set `narrativeClause` (D-24854 §6); the "Wrecker overlay still reads no Ambush
    effect" text, the narration Out-of-Scope item and AC 5 were rewritten.
  - PS-3: `composeDemolishNarrativeClause` (WP-897) mirrors the resolver, so it takes the same `seatScope` (RS-1).
  - PS-4: the WP-897 RS-5 real-data walk (`ambushNarrative.keywordless.test.ts`) grows 16 → 18; added to the allowlist and
    exempted from the STOP trigger.
  - PS-5: 57 primitives at HEAD; positions 58-60; the pin inventory re-measured, including WP-838 T1's `slice(52)`.
  - PS-6: the D-24824 trace is mandatory, its call is locked, and its order is `secondary-site` before `no-op`.
  RS folds: every anchor re-baselined (RS-1); the Villain-Deck defeat Fight site (RS-2); the replay-artifact sentence (RS-3); the
  local-spike bundle regen (RS-4); the narrative-order note (RS-5); the summarized Demolish wording in the charge clause, kept by
  choice (RS-6); the reveal-test fixture traps (RS-7); the hunt snapshot (RS-8); the slug in overlay text, kept (RS-9); stale
  governance text and the 7139 baseline (RS-10). The pre-flight also compared this packet's Charge with WP-839's
  `charge-forward`; this revision makes `charge` the one Charge primitive and its consequence a closed type that WP-839 appends to
  (RS-6), replacing `demolishIfPushed?: boolean` with `chargePushConsequence?: VillainChargePushConsequence` and `hasDemolished`
  with an outcome field for the triggered consequence.
- **Pre-flight round 4 (same reviewer, on the folded text): NOT READY as written, READY once two text items fold** (no further
  re-run needed per 01.4 §Pre-Flight Verdict). Every round-3 PS / RS fold verified against `3b16b5b11` and consistent across WP, EC
  and WORK_INDEX; no stale identifier in the live text. Folded: PS-1, the canonical `VILLAIN_CHARGE_PUSH_CONSEQUENCES` array, the
  parser membership loop, the marker-script copy, a runtime drift pin and the `charge:1:discard-if-pushed` negative case; PS-2,
  the WORK_INDEX row claimed "re-confirmed" before this round ran (corrected to the recorded outcome). RS folds: `FIXTURE_GROUP_IDS`
  gains `chmp/wrecking-crew` (RS-1); WP-839 / EC-877 carry the Charge supersession (RS-2, with copilot R8); the trace-order
  expectation is scoped per hook (RS-3); the D-24820 ledger text names the shared Charge primitive.
- **Copilot round 3 (independent, 2026-11-15): RISK → HOLD**, eleven findings, all folded; the Charge-sharing decision judged sound
  for Speed Demon and the six ssw2 Ambush Charge lines:
  - R1: `switch` with a `never` default in the consequence step and `composeChargeClause` (plus the PS-1 array).
  - R2: Ordering reworded to printed order after entry escapes (rules L571-575, L1117-1119); the false "no real card has both"
    claim replaced (cosm Runner named); a real-data test that every `charge` is its hook's first effect.
  - R3: the lock narrowed to villain-card Ambush Charge lines; Master Strike / Twist charges and the Out-of-Scope set list corrected.
  - R4: `villainCardChargeEffect` returns `null` for a gated descriptor, with a test.
  - R5: the deferred escape steps (D-24656 §4) stated and asserted.
  - R6: `appliedPushConsequence` → `triggeredPushConsequence`.
  - R7: RS-6 and D-24820 list every touch-point of a new consequence.
  - R8: a supersession banner and a reciprocal STOP in WP-839 / EC-877.
  - R9: the WP-839-executes-first Execution Amendment rule (RS-6).
  - R10: the mandatory 01.6 post-mortem added to Files, DoD and EC.
  - R11: the gate record (this list) and the WORK_INDEX row now state the real outcomes.
- **Copilot round 4 (same reviewer): RISK → HOLD on one narrow item, then CONFIRM.** R1-R11 all resolved. N1: the WP-839-first
  branch was only in RS-6 while EC-912 locked unconditional pins; folded (EC Before Starting points to the RS-6 list; RS-6 names
  the consequence drift pin's landed value and the flipping `charge:1:discard-if-pushed` parser case). The reviewer limited the
  re-check to those lines and stated CONFIRM stands once applied.
- **00.3 lint run 3 (independent, 2026-11-15): FAIL** on §2 (the pure-step import rule omitted `board/city.types.ts`, which the
  contract's `CityZone` needs), §3 (four anchors: the RS-5 walk L448-510 / L479-496, `ambushCitySpace` L404-407, `huntSource`
  L1539, `recordVillainEffectApplication` L379-406) and §4 (00.2 not cited), plus four false self-review claims below. All folded.
- **00.3 lint run 4 (same reviewer, on the text with every fold above): PASS**, all 21 sections; every new anchor spot-checked
  correct. Should-fix folded: the Reserved Decision no longer says the ssw2 lines append a consequence (they are data-only
  `charge:<N>` markers). Its second should-fix (the EC's WP-839-first counts) is covered by the copilot round-4 N1 fold.
- **Final (2026-11-15): pre-flight READY TO EXECUTE (round 4, after two text folds); copilot CONFIRM (round 4); 00.3 PASS (run 4).**

## Lint Gate Self-Review (00.3)

- **§1 structure:** every required section is present and non-empty. Out of Scope names the printed Charge cards, co2e Speed Demon,
  the Fight overlay narrative, the remaining Demolish lines (Pagliacci, Gwenpool, Nul, Uru-Enchanted Iron Man, Nick Fury, the vill
  Avengers, Epic Fin Fang Foom, an interactive pick), and new state, client, server, replay or `pushVillainIntoCity` changes.
  Acceptance Criteria has seven binary checks. **PASS.**
- **§2 constraints:** full-file output, ESM, Node v22+, and `00.6-code-style.md` are cited, along with determinism, one Demolish
  implementation and clause, one Charge primitive, the rebind and `resolveVillainEscape` rules, the marker regen, and no
  special-casing. The pure step's type-only imports name `board/city.types.ts` (its `CityZone`). A session protocol gives four STOP
  triggers with the sanctioned exceptions, and the locked values are in the EC. **PASS** (after the run-3 fold).
- **§3 Assumes:** eleven hard-deps, each ✅ in WORK_INDEX, plus every helper, type, reader, gate, fire-site order, narrative channel,
  trace helper, pin and generated-data fact the change reads, each with file and line at `3b16b5b11` (four anchors corrected in
  run 3). **PASS** (after the run-3 fold).
- **§4 Context:** covers why one resolver, why a `charge` primitive is bridged at the fire site, ordering, deferred escape steps,
  narrative (D-24854), determinism / replay, and the shared Charge primitive. RS-1 through RS-6 are locked. 00.2 §1.4 / §5,
  ARCHITECTURE sections, a DECISIONS scan list and 00.6 are cited. **PASS** (after the run-3 fold).
- **§5 files:** 7 engine source files (1 new), 2 script / input files, 1 card-data file, 1 regenerated client fixture, the generated
  / provenance files (the gitignored dashboard copies are called out), 7 test files (2 new), and governance. **PASS.**
- **§6 naming:** full words (`demolishEachPlayer`, `DemolishSeatScope`, `chargeCityVillainOneSpace`, `villainCardChargeEffect`,
  `composeChargeClause`, `VillainChargePushConsequence`, `triggeredPushConsequence`). The outcome booleans carry a `has` prefix. No 00.2
  field is renamed. **PASS.**
- **§7 deps / §8 boundaries:** no new npm dependency; engine and card data only (the local-spike fixture is regenerated, not
  edited). The new pure helper imports neither boardgame.io nor the registry. `reveal.ts` gains direct imports of
  `board/demolish.logic.ts`, `board/villainCharge.logic.ts` and `board/citySpaceNames.ts`, but no new module cycle (it already
  reaches `demolish.logic.ts` through `villainEffects.execute.ts`). There is no client or server code change. **PASS.**
- **§9 Windows:** `pnpm` / `node` commands only. **PASS.** **§10 / §11:** no env var and no auth surface. **N/A.**
- **§12 tests:** `node:test`, `.test.ts`. The plan covers a pure-step suite; the Bulldozer hook from the real parser on the
  committed `chmp.json` through `performVillainReveal` with fixed City setups, an escape-inside-the-charge case, a state-based
  ordering proof, the trace order and the sixth narrative slot; The Wrecker and Thunderball through the real executor with their
  clauses pinned to their logs; parser, narrative and overlay cases; runtime pins (D-24372). **PASS.**
- **§13 verification:** the exact regen order and check commands are given with expected exits, and the engine baseline of 7139 is
  recorded. **PASS.**
- **§14 / §15:** seven binary criteria. The DoD names STATUS, DECISIONS, WORK_INDEX (with its live-verify token), EC_INDEX, the
  mindmap and the ledger, plus the diff allowlist check and the D-24026 live check (§15.1, with an operator-pending fallback through
  `live-verify.json`). **§15.2:** `**Risk Tier:** MEDIUM` appears in the WP header and verbatim in the EC; it is not HIGH, so there
  is no threat-model section. **PASS.**
- **§16 code-style:** reuses `demolishEachPlayer`, `composeDemolishNarrativeClause`, `resolveVillainGroupPrefix`,
  `resolveVillainEscape`, `recordVillainSecondarySiteTrace`, the D-24295 gate and the rebind idiom. There is no second Demolish or
  Charge copy, `for` loops replace `.reduce()`, and there are no nested ternaries. The `// why:` locations are listed in the EC.
  **PASS.**
- **§17 Vision:** clauses §1, §2, §8, §10 and §22, a no-conflict line, an NG-1 line and a determinism line. **PASS.**
- **§18:** no literal-grep verification step. **N/A.** **§19:** the baseline SHA and counts are re-recorded. **PASS.**
  Contract file: `villainAbility.types.ts` gains three appended primitives, one closed type with its canonical array and one
  optional descriptor field, covered by D-24820.
- **§20 funding:** N/A, as stated above. **§21 API catalog:** N/A (no endpoint). **PASS.**
