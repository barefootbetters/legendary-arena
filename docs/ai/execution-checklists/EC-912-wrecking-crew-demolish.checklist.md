# EC-912 — Wrecking Crew Demolish: The Wrecker, Bulldozer and Thunderball (Execution Checklist)

**Source:** docs/ai/work-packets/WP-874-wrecking-crew-demolish.md
**Risk Tier:** MEDIUM — gameplay logic (City positions, escapes, Hero Deck order, every player's hand); no new `G` field, no auth,
money, persistence or server surface
**Layer:** Game Engine (resolver seat scope, three villain primitives, one Ambush fire-site bridge, one pure City step) + card data
**Re-baselined:** 2026-11-15 on `origin/main` `3b16b5b11` (D-24854, D-24824; the one Charge primitive, WP RS-6).

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] The WP-874 / EC-912 / D-24820 reservation (#3218) is on `main`; every WP hard-dep (incl. WP-877, WP-897, WP-838) is `[x]`.
- [ ] `pnpm -r build`, then game-engine and dashboard `test`, exit 0; record the counts (game-engine 7139 / 0 per D-24854 at
      `842aeb5fc`; re-record).
- [ ] Re-read at HEAD: `demolishEachPlayer` and its two callers plus `composeDemolishNarrativeClause`; `VILLAIN_EFFECT_PRIMITIVES`
      (57, last `shuffle-bystanders-into-villain-deck`) and its pins incl. WP-838 T1 `slice(52)`; `parseLocationGatedEffect` /
      `parseUngatedEffect`; the `onAmbush` block of `performVillainReveal` (`executeVillainAbilitiesWithNarrative`, the
      `composeAmbushNarrative` call with `narrativeClauses` fifth); `composeAmbushNarrative` (5 params);
      `recordVillainSecondarySiteTrace` and its unions; `resolveVillainGroupPrefix`; `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`; the
      WP-897 RS-5 walk in `villain/ambushNarrative.keywordless.test.ts` (16).
- [ ] If WP-839 executed first, it built `charge` in the WP RS-6 shape: reuse it and add only this packet's consequence member,
      and apply the WP RS-6 "If WP-839 executes first" list; the Locked Values primitive positions, pins (including the
      consequence drift pin and the `charge:1:discard-if-pushed` negative case), provenance rows and "new" file markers then follow
      that list. If it built a separate `charge-forward`, STOP and reconcile (D-24820 / RS-6).

## Locked Values (do not re-derive; verify at HEAD)
- **Resolver:** `export type DemolishSeatScope = 'each' | 'each-other'`; `demolishEachPlayer(G, currentPlayer, logPrefix, seatScope:
  DemolishSeatScope = 'each')`. `'each-other'` skips a non-null `currentPlayer`; an empty remaining list logs `${logPrefix} there is
  no other player to discard.` (`blocked`) after the reveal. Every D-24807 line, the single reveal and the rebind are unchanged.
- **Clause mirror:** `composeDemolishNarrativeClause(G, currentPlayer, demolishResult, seatScope: DemolishSeatScope = 'each')`:
  `'each-other'` skips a non-null current seat; no remaining seat → the clause `there is no other player to discard` after the
  reveal clause. Default scope byte-identical (the WP-897 test unchanged).
- **Primitives** appended in order after `shuffle-bystanders-into-villain-deck` (58-60 at `3b16b5b11`): `demolish-each-other-player`,
  `demolish-each-player-per-group-villain-in-city`, `charge`. Another packet landing first → append after it, record an inline
  Execution Amendment.
- **Thunderball:** handler `villainEffectDemolishEachOtherPlayer` → `demolishEachPlayer(G, currentPlayer, label, 'each-other')`,
  returning `narrativeClause: composeDemolishNarrativeClause(G, currentPlayer, demolishResult, 'each-other')`; marker `fight:
  ["demolish-each-other-player@sewers+bank"]` (the D-24295 gate; no new gate code).
- **The Wrecker:** handler `villainEffectDemolishEachPlayerPerGroupVillainInCity`; each logged line is `` `${label} ${clause}.` ``
  from one `clause` variable. `resolveVillainGroupPrefix` → `null`: clause `the Villain's group is not among this match's Villain
  Groups, so no one is Demolished` (`blocked`); `count` = non-null `G.city` ids with the prefix, taken once; `0`: clause `no
  ${groupSlug} Villain is in the City, so no one is Demolished` (`blocked`); else header clause `Demolish each player ${count}
  time(s), once for each ${groupSlug} Villain in the City` (`neutral`; `(s)` literal), then `count` calls, collecting
  `composeDemolishNarrativeClause(G, currentPlayer, result)` per call. `narrativeClause` = the blocked clause, or `[header,
  ...demolishClauses].join('; ')`. Marker `ambush: ["demolish-each-player-per-group-villain-in-city"]`. `label` =
  `${villainEffectTimingLabel(timing)} effect:`.
- **Charge grammar:** `charge:<N>` → `{ primitive: 'charge', magnitude: N }`; `charge:<N>:<consequence>` adds
  `chargePushConsequence`, where `export type VillainChargePushConsequence = 'demolish-if-pushed'` and `export const
  VILLAIN_CHARGE_PUSH_CONSEQUENCES: readonly VillainChargePushConsequence[] = ['demolish-if-pushed'] as const;` (contract file;
  append-only `// why:` naming WP-839's `'discard-if-pushed'`; the `VILLAIN_CAPTURE_PILES` precedent). The arm accepts `parts[2]`
  only by looping that array. `N` by `parsePositiveInteger`; anything else → `null`, bare `charge` and `charge:1:discard-if-pushed`
  included (the arm returns before the terminal no-param branch). New optional `VillainEffectDescriptor` field
  `chargePushConsequence?: VillainChargePushConsequence`, outside `descriptorKey`, omitted when absent. Same validator and a
  hand-synced `VILLAIN_CHARGE_PUSH_CONSEQUENCES` copy in the marker script. Marker Bulldozer `ambush: ["charge:1:demolish-if-pushed"]`.
- **Charge executor:** `villainEffectCharge` returns `{ targets: [] }`, mutates nothing, sets no `narrativeClause`; `charge` is in
  `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`. `villainCardChargeEffect(G, cardId, timing): { spaces: number; pushConsequence:
  VillainChargePushConsequence | null } | null` (first `charge` descriptor; the `villainCardReenterSewersKinds` guards; `spaces:
  magnitude ?? 1`, `pushConsequence: chargePushConsequence ?? null`); returns `null` when that descriptor carries `requireCitySpaces`
  or `requireCondition` (a gated `charge` is inert, as the executor fails it closed; tested).
- **Trace (D-24824, unconditional):** inside the `villainCardChargeEffect(G, cardId, 'onAmbush') !== null` guard, immediately before
  the bridge: `recordVillainSecondarySiteTrace(G, cardId, 'onAmbush', 'charge', 'chargeAmbushVillain', 'villain-ambush-bridge', {
  magnitude: chargeEffect.spaces }, readRevealContextTurn(context))`; append `'charge'` / `'chargeAmbushVillain'` to the helper's
  `effect` / `handler` unions. Trace order for the real Bulldozer hook: `secondary-site` first, `no-op` (executor) last (the
  ordering-proof hook adds the Wrecker primitive's `fired` after the `no-op`).
- **Pure step** `board/villainCharge.logic.ts` (no boardgame.io / registry; type-only imports from `rules/`, `state/`, `board/city.types.ts`) exports types `ChargeStepResult`,
  `ChargeOutcome` and `chargeCityVillainOneSpace(city, fromIndex): ChargeStepResult { city; hasPushedVillain; escapedCardId;
  hasChargerEscaped }`: invalid index / null space → unchanged copy; last space → charger out, `escapedCardId` = charger,
  `hasChargerEscaped`; empty destination → move; occupied → `hasPushedVillain`, the contiguous block shifts to the first empty space
  after it, none empty → the last card is `escapedCardId`; charger takes `fromIndex + 1`, its old space null. Input never mutated.
  `ChargeOutcome { spacesMoved; hasPushedAnyVillain; hasChargerEscaped; triggeredPushConsequence: VillainChargePushConsequence | null }`;
  `spacesMoved` counts steps the charger survives in the City; an exit step sets only `hasChargerEscaped`.
- **Bridge** `chargeAmbushVillain(G, context, implementationMap, cardId, chargeEffect): ChargeOutcome` in `villainDeck.reveal.ts`,
  called after the WP-743 flag write and BEFORE the `onAmbush` executor call. Per step: `indexOf` (stop on -1) → step →
  `logChargeStep` → `resolveVillainEscape` for an `escapedCardId` → stop if `hasChargerEscaped`. Then (also after an escape), a
  non-null `pushConsequence` goes through a `switch` with a `const unhandled: never` default: `'demolish-if-pushed'` → pushed →
  `demolishEachPlayer(G, context.ctx.currentPlayer, 'Ambush effect:')` and `triggeredPushConsequence = 'demolish-if-pushed'`, else its
  no-push line. A pushed-out Villain's HQ KO and Bystander steps stay queued after the move (D-24656 §4; asserted). State in locals only; a nested reveal inside `resolveVillainEscape` finishes its own
  bridge (and pushes its own `ambushResolved`) first. `ambushResolved.citySpace` is read after the charge.
- **Charge logs** (`threat` unless noted; `<name>` = `resolveCardName(G.cardDisplayData, cardId)`; `<space>` = `the <Name>` from
  `citySpaceNameForIndex(to)` capitalized, else `city space <to>`): `Ambush effect: <name> charged forward one space to <space>.`;
  `Ambush effect: <name> charged forward one space to <space>, pushing the Villains ahead of it forward.`; `Ambush effect: <name>
  charged forward out of the city.`; `Ambush effect: <name> pushed no Villains forward, so no one is Demolished.` (`blocked`).
- **Narrative:** `composeChargeClause(outcome)`: escaped → `charged out of the city`; `spacesMoved === 1` → `charged forward one
  space`; `> 1` → `charged forward ${spacesMoved} spaces`; else `undefined`; then `, pushing Villains forward` if pushed, then a `switch`
  on a non-null `triggeredPushConsequence` (`never` default): `'demolish-if-pushed'` → `, then Demolished each player`. `composeAmbushNarrative(cardName, effectResults,
  villainDeckPlayCount = 0, stackVillainClause?, descriptorClauses = [], chargeClause?)` pushes it after the stack clause; the
  reveal passes `ambushExecution.narrativeClauses` fifth and the charge clause sixth.
- **Pins / provenance (sanctioned, each citing WP-874 / D-24820):**
  - `rules/villainAbility.types.test.ts`: ordered-list comment + 3 entries and title 57 → 60; "exactly 57 entries" → 60; last-entry
    assert → `charge` "(position 60)"; the seven `length, 57` → 60 and the comment-only totals (all values follow any amended
    positions); WP-838 T1 `slice(52)` → `slice(52, 57)`; the `T5` `Record` gains the 3 keys; a new runtime pin `slice(57)` = the 3
    new names in order; a new runtime drift pin: `Record<VillainChargePushConsequence, true>` keys deep-equal
    `VILLAIN_CHARGE_PUSH_CONSEQUENCES`, which deep-equals `['demolish-if-pushed']` (D-24372).
  - `villain/ambushNarrative.keywordless.test.ts` (also citing D-24854 §6): `FIXTURE_GROUP_IDS` gains `chmp/wrecking-crew`; the
    RS-5 sorted set gains `charge` and `demolish-each-player-per-group-villain-in-city`, title 16 → 18; a Wrecker
    overlay-equals-log case.
  - `mechanic-provenance.json` 3 rows `{ "wp": "WP-874", "decision": "D-24820" }`; pending `live-verify.json` rows for The
    Wrecker, Bulldozer, Thunderball.

## Guardrails
- One Demolish implementation: all three lines call `demolishEachPlayer`; no second reveal or discard loop. One clause mirror:
  `composeDemolishNarrativeClause` with the call's own `seatScope`.
- One Charge primitive for villain-card Ambush Charge lines: never add `charge-forward` or a second step helper / bridge (WP RS-6).
  A new consequence touches only the type, the array + drift pin, the marker-script copy, one `case` in each `switch` (with its own
  no-push line) and its marker token. Master Strike / Twist charges and cosm's Runner are outside the lock.
- Every escape (pushed card or charger) goes through `resolveVillainEscape`; `G.city` is rebound, never mutated in place.
- No new `G` field, move, pending queue, UIState field, client or server code; `replay.execute.ts` and `pushVillainIntoCity`
  untouched. The local-spike bundle is regenerated by `pnpm spike:local-bundle`, never hand-edited.
- STOP if a sentinel / golden hash, a WP-864 Demolish test, the WP-897 Demolish clause test, or an existing reveal / escape test
  changes (the sanctioned edits above excepted), or if a module cycle appears.
- No per-card engine special-casing: the cards are reached only through markers. The printed Charge cards stay out of scope.
- Moves and handlers never throw. No `.reduce()`, no nested ternaries, no `any` / `@ts-ignore`. Never edit a test to pass. Never
  `git stash`. `narrativeClause` is set only with a non-empty string (`exactOptionalPropertyTypes`).

## Required `// why:` Comments
- `demolish.logic.ts`: the `seatScope` default keeps D-24807 callers byte-identical; the solo reveal (D-24820 reading).
- `villainEffects.execute.ts`: the own-group count (D-24770 prefix, itself included, counted once); `charge` as a deliberate no-op;
  the reader; the gated Thunderball marker relies on D-24295; the clause mirror's `seatScope` (it must match the resolver call);
  each `narrativeClause` (D-24854 §6); the trace unions (D-24824 §7).
- `villainCharge.logic.ts`: the contiguous-block push (mirrors `pushVillainIntoCity`); the charger escaping from the last space.
- `villainDeck.reveal.ts`: the bridge runs after entry escapes and before the executor, which is printed order for every marked carrier
  (Charge is an Ambush effect, rules v23 L571-575 / L1117-1119; a real-data test pins charge-first), so its trace precedes the
  executor's `no-op`; escapes via `resolveVillainEscape`; the consequence reads the push; locals-only state (reentrant through a
  nested reveal). `notableEvents.compose.ts`: the sixth-slot clause (D-24703, D-24854 §6).
- `villainAbility.types.ts` / `villainAbility.setup.ts` / marker script: the appended primitives, the `charge` grammar and the
  closed consequence type with its append-only canonical array, the one Charge primitive (D-24820).

## Files to Produce
- Engine: `board/demolish.logic.ts`, `board/villainCharge.logic.ts` (new), `rules/villainAbility.types.ts`,
  `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts`, `villainDeck/villainDeck.reveal.ts`,
  `events/notableEvents.compose.ts` (all under `packages/game-engine/src/`).
- Data: `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`,
  `data/cards/chmp.json` (generated), `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` (regenerated).
- Generated / provenance: `villain-mechanic-ledger.{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json` (expected unchanged), `hero-effect-coverage.baseline.json` (only if it moves),
  `mechanic-provenance.json`, `live-verify.json`; `in-play-hollow-baseline.json` + `useInPlayCoverage.test.ts` only if the pin moves.
- Tests: `board/villainCharge.logic.test.ts` (new), `villainDeck/villainCharge.reveal.test.ts` (new), `board/demolish.logic.test.ts`,
  `rules/villainAbility.types.test.ts`, `events/notableEvents.compose.test.ts`, `setup/villainAbility.setup.test.ts` (parser cases),
  `villain/ambushNarrative.keywordless.test.ts` (sanctioned).
- Close: `docs/ai/post-mortems/01.6-WP-874-wrecking-crew-demolish.md` (new, mandatory 01.6: a long-lived extension seam),
  `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24820), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine and dashboard `test` 0; engine delta recorded from 7139 (expect at least +28). Sentinels
      byte-unchanged.
- [ ] Provenance + pending live-verify rows added BEFORE the ledgers. Then each exits 0: `cards:check` (only `chmp.json` changed),
      `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`,
      `cards:count-markers:check`; `pnpm --filter @legendary-arena/dashboard prebuild:coverage` 0; `pnpm spike:local-bundle` 0.
- [ ] Govern-close 0: `workindex:rows:check`, `workindex:executed:check`, `workindex:liveverify:check`,
      `node scripts/check-number-ledger.mjs --check`; `git diff --name-only origin/main...HEAD` inside `## Files to Produce`.
- [ ] The 01.6 post-mortem written (WP COMPLETE).
- [ ] D-24820 → Active covering every clause of the WP's Reserved Decision (incl. the one Charge primitive); STATUS; WORK_INDEX
      checked with its live-verify token; EC_INDEX Done; mindmap ✅ + `roadmap:counts:write` + `roadmap:counts:check` 0; ledger
      LANDED.
- [ ] Live-on-surface (D-24026) on a Wrecking Crew match created after the deploy, or operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- The Wrecker still logs `unmarked-ability`: the marker key is not `wrecking-crew/the-wrecker`, or `chmp.json` was not regenerated.
- The Wrecker's overlay reads "its Ambush effect resolved (see the log)": the handler returned no `narrativeClause`.
- Thunderball's clause names the fighter: `composeDemolishNarrativeClause` was called without `'each-other'`.
- Thunderball Demolishes in the Rooftops: the `@sewers+bank` suffix was dropped, or the Fight site lost its `cityIndex`.
- Bulldozer stays in the Sewers, or its overlay says "no Ambush effect": the bridge is missing, after the executor, or the clause
  argument was not passed in the sixth slot.
- The trace test sees `no-op` before `secondary-site`: the trace was recorded after the executor, or outside the guard.
- The Escape Pile misses a pushed-off Villain, or its Escape effect never fires: the bridge wrote `G.escapedPile` directly.
- `cards:check` red: `chmp.json` hand-edited, or the marker script lacks a primitive / the `charge` validator.
- The RS-5 walk fails with 18 names: the sanctioned set edit was skipped.
