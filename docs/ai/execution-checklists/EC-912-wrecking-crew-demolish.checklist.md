# EC-912 — Wrecking Crew Demolish: The Wrecker, Bulldozer and Thunderball (Execution Checklist)

**Source:** docs/ai/work-packets/WP-874-wrecking-crew-demolish.md
**Risk Tier:** MEDIUM — gameplay logic (City positions, escapes, Hero Deck order, every player's hand); no new `G` field, no auth,
money, persistence or server surface
**Layer:** Game Engine (resolver seat scope, three villain primitives, one Ambush fire-site bridge, one pure City step) + card data

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] The WP-874 / EC-912 / D-24820 reservation (#3218) is on `main`.
- [ ] `pnpm -r build`, then game-engine and dashboard `test`, exit 0; record the counts (game-engine 6611 / 0 on `9a83b196`, before WP-867; re-record).
- [ ] Re-read at HEAD: `demolishEachPlayer` and its two callers; `VILLAIN_EFFECT_PRIMITIVES` (45, last
      `stack-cards-enter-city-as-villains`) and its pins; `parseLocationGatedEffect` / `parseUngatedEffect`; the `onAmbush` block of
      `performVillainReveal`; `composeAmbushNarrative`; `resolveVillainGroupPrefix`; `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`.

## Locked Values (do not re-derive; verify at HEAD)
- **Resolver:** `export type DemolishSeatScope = 'each' | 'each-other'`; `demolishEachPlayer(G, currentPlayer, logPrefix, seatScope:
  DemolishSeatScope = 'each')`. `'each-other'` skips a non-null `currentPlayer`; an empty remaining list logs `${logPrefix} there is
  no other player to discard.` (`blocked`) after the reveal. Every D-24807 line, the single reveal and the rebind are unchanged.
- **Primitives** appended in order after `stack-cards-enter-city-as-villains` (46-48 at draft): `demolish-each-other-player`,
  `demolish-each-player-per-group-villain-in-city`, `charge`. Another packet landing first → append after it, record an inline
  Execution Amendment.
- **Thunderball:** handler `villainEffectDemolishEachOtherPlayer` → `demolishEachPlayer(G, currentPlayer, label, 'each-other')`; marker `fight: ["demolish-each-other-player@sewers+bank"]` (the D-24295 gate; no new gate code).
- **The Wrecker:** handler `villainEffectDemolishEachPlayerPerGroupVillainInCity`; `resolveVillainGroupPrefix` → `null` logs `${label}
  the Villain's group is not among this match's Villain Groups, so no one is Demolished.` (`blocked`); `count` = non-null `G.city`
  ids with the prefix, taken once; `0` logs `${label} no ${groupSlug} Villain is in the City, so no one is Demolished.` (`blocked`);
  else `${label} Demolish each player ${count} time(s), once for each ${groupSlug} Villain in the City.` (`neutral`; `(s)` literal) then `count`
  calls. Marker `ambush: ["demolish-each-player-per-group-villain-in-city"]`. `label` = `${villainEffectTimingLabel(timing)} effect:`.
- **Charge grammar:** `charge:<N>` → `{ primitive: 'charge', magnitude: N }`; `charge:<N>:demolish-if-pushed` adds
  `demolishIfPushed: true`; `N` by `parsePositiveInteger`; anything else → `null`, bare `charge` included (the arm returns before the terminal no-param branch). New optional `VillainEffectDescriptor` field
  `demolishIfPushed?: boolean`. Same validator in the marker script. Marker Bulldozer `ambush: ["charge:1:demolish-if-pushed"]`.
- **Charge executor:** `villainEffectCharge` returns `{ targets: [] }`, mutates nothing; `charge` is in
  `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`. `villainCardChargeEffect(G, cardId, timing): { spaces: number; demolishIfPushed: boolean } |
  null` (first `charge` descriptor; the `villainCardReenterSewersKinds` guards; `spaces: magnitude ?? 1`, `demolishIfPushed: ===
  true`; the parser never writes `false`).
- **Pure step** `board/villainCharge.logic.ts` (no boardgame.io / registry) exports types `ChargeStepResult`, `ChargeOutcome` and
  `chargeCityVillainOneSpace(city, fromIndex): ChargeStepResult { city; hasPushedVillain;
  escapedCardId; hasChargerEscaped }`: invalid index / null space → unchanged copy; last space → charger out, `escapedCardId` = charger,
  `hasChargerEscaped`; empty destination → move; occupied → `hasPushedVillain`, the contiguous block shifts to the first empty space after
  it, none empty → the last card is `escapedCardId`; charger takes `fromIndex + 1`, its old space null. Input never mutated. `spacesMoved` counts steps the charger survives in the
  City; an exit step sets only `hasChargerEscaped`.
- **Bridge** `chargeAmbushVillain(G, context, implementationMap, cardId, chargeEffect): ChargeOutcome { spacesMoved; hasPushedAnyVillain;
  hasChargerEscaped; hasDemolished }` (type from `villainCharge.logic.ts`) in `villainDeck.reveal.ts`, called after the WP-743 flag write and BEFORE the `onAmbush` executor
  call. Per step: `indexOf` (stop on -1) → step → `logChargeStep` → `resolveVillainEscape` for an `escapedCardId` → stop if `hasChargerEscaped`.
  Then `demolishIfPushed`: pushed → `demolishEachPlayer(G, context.ctx.currentPlayer, 'Ambush effect:')`, else the no-push line. State in locals only;
  a nested reveal inside `resolveVillainEscape` finishes its own bridge first. `ambushResolved.citySpace` is read after the charge.
- **Charge logs** (`threat` unless noted; `<name>` = `resolveCardName(G.cardDisplayData, cardId)`; `<space>` = `the <Name>` from
  `citySpaceNameForIndex(to)` capitalized, else `city space <to>`): `Ambush effect: <name> charged forward one space to <space>.`;
  `Ambush effect: <name> charged forward one space to <space>, pushing the Villains ahead of it forward.`; `Ambush effect: <name> charged forward out of the city.`; `Ambush effect:
  <name> pushed no Villains forward, so no one is Demolished.` (`blocked`).
- **Narrative:** `composeChargeClause(outcome)`: escaped → `charged out of the city`; `spacesMoved === 1` → `charged forward one
  space`; `> 1` → `charged forward ${spacesMoved} spaces`; else `undefined`; then `, pushing Villains forward` if pushed, `, then Demolished each player` if
  `hasDemolished`. `composeAmbushNarrative(..., stackVillainClause?, chargeClause?)` pushes it after the stack clause.
- **Pins / provenance (sanctioned, each citing WP-874 / D-24820):** `rules/villainAbility.types.test.ts` ordered list + 3 entries and
  its title 45 → 48; "exactly 45 entries" → 48; the last-entry assert → `charge` "(position 48)"; every `length, 45` → 48 and the
  comment-only totals (all values follow any amended positions); the WP-869 "is the 45th and last primitive" drops "and last" if
  still present; the `T5` `Record` gains
  the 3 keys; a new runtime pin for the 46th-48th entries. `mechanic-provenance.json` 3 rows `{ "wp": "WP-874", "decision":
  "D-24820" }`; pending `live-verify.json` rows for The Wrecker, Bulldozer, Thunderball.

## Guardrails
- One Demolish implementation: all three lines call `demolishEachPlayer`; no second reveal or discard loop.
- Every escape (pushed card or charger) goes through `resolveVillainEscape`; `G.city` is rebound, never mutated in place.
- No new `G` field, move, pending queue, UIState field, client or server file; `replay.execute.ts` and `pushVillainIntoCity` untouched.
- STOP if a sentinel / golden hash, a WP-864 Demolish test, or an existing reveal / escape test changes, or if a module cycle appears.
- No per-card engine special-casing: the cards are reached only through markers. The printed Charge cards stay out of scope.
- Moves and handlers never throw. No `.reduce()`, no nested ternaries, no `any` / `@ts-ignore`. Never edit a test to pass. Never
  `git stash`.

## Required `// why:` Comments
- `demolish.logic.ts`: the `seatScope` default keeps D-24807 callers byte-identical; the solo reveal (D-24820 reading).
- `villainEffects.execute.ts`: the own-group count (D-24770 prefix, itself included, counted once); `charge` as a deliberate no-op;
  the reader; the gated Thunderball marker relies on D-24295.
- `villainCharge.logic.ts`: the contiguous-block push (mirrors `pushVillainIntoCity`); the charger escaping from the last space.
- `villainDeck.reveal.ts`: the bridge runs before the executor (Charge happens on entry, rules v23 p.20); escapes via
  `resolveVillainEscape`; the Demolish reads the push; locals-only state (reentrant through a nested reveal). `notableEvents.compose.ts`: the clause (D-24703).
- `villainAbility.types.ts` / `villainAbility.setup.ts` / marker script: the appended primitives and the `charge` grammar (D-24820).

## Files to Produce
- Engine: `board/demolish.logic.ts`, `board/villainCharge.logic.ts` (new), `rules/villainAbility.types.ts`,
  `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts`, `villainDeck/villainDeck.reveal.ts`,
  `events/notableEvents.compose.ts` (all under `packages/game-engine/src/`).
- Data: `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`,
  `data/cards/chmp.json` (generated).
- Generated / provenance: `villain-mechanic-ledger.{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json` (expected unchanged), `hero-effect-coverage.baseline.json` (only if it moves),
  `mechanic-provenance.json`, `live-verify.json`; `in-play-hollow-baseline.json` + `useInPlayCoverage.test.ts` only if the pin moves.
- Tests: `board/villainCharge.logic.test.ts` (new), `villainDeck/villainCharge.reveal.test.ts` (new), `board/demolish.logic.test.ts`,
  `rules/villainAbility.types.test.ts`, `events/notableEvents.compose.test.ts`, `setup/villainAbility.setup.test.ts` (parser cases).
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24820), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine and dashboard `test` 0; engine delta recorded (expect at least +25). Sentinels byte-unchanged.
- [ ] Provenance + pending live-verify rows added BEFORE the ledgers. Then each exits 0: `cards:check` (only `chmp.json` changed),
      `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`,
      `cards:count-markers:check`; `pnpm --filter @legendary-arena/dashboard prebuild:coverage` 0.
- [ ] Govern-close 0: `workindex:rows:check`, `workindex:executed:check`, `node scripts/check-number-ledger.mjs --check`;
      `git diff --name-only origin/main...HEAD` inside `## Files to Produce`.
- [ ] D-24820 → Active covering every clause of the WP's Reserved Decision; STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ +
      `roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED.
- [ ] Live-on-surface (D-24026) on a Wrecking Crew match created after the deploy, or operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- The Wrecker still logs `unmarked-ability`: the marker key is not `wrecking-crew/the-wrecker`, or `chmp.json` was not regenerated.
- Thunderball Demolishes in the Rooftops: the `@sewers+bank` suffix was dropped, or the Fight site lost its `cityIndex`.
- Bulldozer stays in the Sewers, or its overlay says "no Ambush effect": the bridge is missing, after the executor, or the clause argument was not passed.
- The Escape Pile misses a pushed-off Villain, or its Escape effect never fires: the bridge wrote `G.escapedPile` directly.
- `cards:check` red: `chmp.json` hand-edited, or the marker script lacks a primitive / the `charge` validator.
