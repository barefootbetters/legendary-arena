# EC-891 — "Whenever a card you own is KO'd this turn": Bishop's Absorb Energies (Execution Checklist)

**Source:** docs/ai/work-packets/WP-853-owned-card-ko-trigger.md
**Layer:** Game Engine (wait-and-see condition + KO-site owner signal) + card data

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` — any edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `d0ab7724` (WP-853 reserve #3090).
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test` exit 0 (record the count).
- [ ] Read the models: `hero/deferredConditionalGrants.ts`, `resolveDeferredHeroGrants` +
      `hookHasRepeatableDefeatCondition`, the `defeated-villain-or-mastermind` parser arm,
      `moves/discardFromHand.ts` `recordCardDiscardedThisTurn`, the WP-498 drift-guard in
      `moves/discardFromHand.test.ts`.
- [ ] Re-count KO sites at HEAD with the drift-pin matcher: expect 34 matching the table below. A
      different count is a STOP — classify the new site in the WP first.
- [ ] Jeff's RS-1 answer (Victory Pile) at the go; default = not counted.

## Locked Values (do not re-derive; verify at HEAD)
- **Marker:** `[keyword:owned-card-koed]`; `VALID_TOKEN_PATTERN` arm `^\[keyword:owned-card-koed\]$`;
  `hero-ability-markers.json` → `dkcy`: `{ "heroSlug": "bishop", "cardSlug": "absorb-energies",
  "abilityIndex": 0, "markupToken": "[keyword:owned-card-koed]" }`. ssw1's `absorb-energies` untouched.
- **Condition:** `export const OWNED_CARD_KOED_CONDITION_TYPE = 'ownedCardKoedThisTurn'` in
  `hero/heroConditions.evaluate.ts` (NOT `deferredConditionalGrants.ts` — load-order cycle), imported
  by `deferredConditionalGrants.ts` (appended to `WAIT_AND_SEE_CONDITION_TYPES`) and the parser, which
  pushes `{ type: OWNED_CARD_KOED_CONDITION_TYPE, value: '1' }`; `owned-card-koed` joins
  `HERO_PARSER_RECOGNIZED_MARKER_NAMES` after `defeated-villain-or-mastermind`.
- **Evaluate:** `return (G.ownedCardsKoedSinceResolve?.[playerID] ?? 0) > 0;`
  **Describe:** `'it needs a card you own to be KO\'d this turn'`.
- **Field:** `ownedCardsKoedSinceResolve?: Record<string, number>` on `LegendaryGameState`, beside
  `villainOrMastermindDefeatedSinceResolve`; never set in `Game.setup`.
- **Recorder:** `export function recordOwnedCardKoed(G: LegendaryGameState, ownerPlayerID: string): void`
  in `deferredConditionalGrants.ts` — return unless some `G.deferredConditionalGrants` entry's hook
  (`G.heroAbilityHooks[entry.hookIndex]`) has a condition of `OWNED_CARD_KOED_CONDITION_TYPE`; else
  create `{}` lazily and add 1 for `ownerPlayerID`. One call per KO'd card.
- **Always defer at play (owned-KO ONLY):** in `executeHeroEffects`'s hook loop, after
  `isCountableConditionalClause`, before `if (!evaluateAllConditions(…))`: when the hook has an
  `OWNED_CARD_KOED_CONDITION_TYPE` condition AND `evaluateAllConditions` passes on its OTHER conditions
  → `recordDeferredConditionalGrant(G, playerID, cardId, G.heroAbilityHooks.indexOf(hook))`, the
  existing waiting line (`'neutral'`, same tail) with reason `describeFailedCondition(G, playerID,
  <owned-KO condition>)`, then `continue` as the existing wait-and-see branch does. Else today's path.
  Defeat-family hooks are NOT included (Snarling Fangs Sunlight pin, D-24598).
- **Firing:** `hookHasConditionType(hook, conditionType)` replaces `hookHasRepeatableDefeatCondition`.
  Fire callback: `repeatCount = hookHasConditionType(hook, OWNED_CARD_KOED_CONDITION_TYPE) ?
  Math.max(1, G.ownedCardsKoedSinceResolve?.[entry.playerId] ?? 0) : 1`; `for` loop of
  `runHookEffects`; re-arm when the hook has the defeat OR owned-KO type. After
  `resolveDeferredConditionalGrants`, guarded `delete G.ownedCardsKoedSinceResolve` beside the defeat-flag delete.
- **Owner per OWNED site** (x/1 below): `playerID` in scope, except applyRevealKo + koSingleTarget
  (new owner param from callers), healWounds (`ctx.currentPlayer`, per Wound), melter +
  revealTopDispose (`args.ownerPlayerID`), Crush Pacifist (`seat`), Red Skull + koOneHeroForPlayer +
  koHeroesFromZoneForPlayer (`playerId`), most-Wounds (`chosenPlayer`, per Wound), the other villain
  effects (`currentPlayer`), koFromPlayerZone (`from.playerId`, hand/deck/discard/inPlay only).
  x/0 sites are NOT OWNED (HQ / Villain Deck / Victory Pile) and stay unchanged.
- **Drift pin** (in `hero/ownedCardKoTrigger.test.ts`; `deepEqual(scannedMap, LOCKED_TABLE)` over every
  non-test `.ts` under `packages/game-engine/src/`, key `path#function` (nearest preceding `function
  <name>(`), value `koSites/ownedRecords`, 0/0 omitted): heroEffects.execute# heroEffectKo,
  applyRevealKo, heroEffectKoWoundReward, heroEffectKoWound 1/1 each; exorciseHauntedHero 1/0;
  healWounds 1/1; resolveKoDiscardChoice 1/1; resolveKoHeroChoice 2/2; resolveMelterKoChoice 1/1;
  resolveOptionalKoReward 1/1; applyRevealThreeDisposition 1/1; resolveRevealTopDispose 1/1;
  resolveRuthlessDictatorChoice 1/1; resolveScryKoChoice 1/1; seatChoiceTactics#
  applyVanishingIllusionsKo 1/0, applyCrushPacifistResistanceKo 1/1; operatorSetters#koFromPlayerZone
  1/1; mastermindHandlers# resolveRedSkullStrike 1/1, resolveBaronZemoStrike 1/0; koFromHq 1/0;
  tacticHandlers# resolveWhispersAndLies 1/0, resolveFindingZemo 1/0; sweepPurgedHeroesFromHq 1/0;
  villainEffects.execute# villainEffectKoBystanderEachVictoryPile 1/0, villainEffectScryKoOwnDeck,
  villainEffectRevealTopKoGreyOrDrawByClass, villainEffectKoWoundsCurrentHandAndDiscard,
  villainEffectKoHeroesCurrentByTrait, koHeroesFromZoneForPlayer, koSingleTarget 1/1 each,
  koOneHeroForPlayer 2/2; koHqHeroForEscape 1/0 (total 34/25). Strip comments, skip the two
  definitions, multi-line `moveCardFromZone(`; non-vacuous incl. multi-line, commented-out, and a
  wrong-function recorder. (RS-1 "Victory Pile counts" → the four Victory-Pile entries become 1/1.)

## Guardrails
- No new hero keyword, handler, pending choice, move, `CORE_MOVE_NAMES` entry, or UIState field.
- `WAIT_AND_SEE_CONDITION_TYPES` entry + `evaluateCondition` case land together (D-24467 lockstep pin).
- Recorder gated, field consumed every resolve (live + sim/PAR/fixture mirrors; `replay.execute.ts`
  accumulates by design, D-24322 — leave it). A sentinel / `finalStateHash` moving is a STOP, never a re-pin.
- Owner is the player whose zone the card left — never `ctx.currentPlayer` by default.
- Moves never throw; no `.reduce()`; RUNTIME pins, not `satisfies` (D-24372).
- `dkcy.json` regenerated from the marker map; never hand-edited. No per-card special-casing.

## Required `// why:` Comments
- `recordOwnedCardKoed`: the gate (consumed in-move → no hash surface) and why per-owner.
- Always-defer branch; fire callback's per-KO repeat; generalised re-arm; counter delete (D-24467 edge, now a count).
- Each threaded owner parameter (`applyRevealKo`, `koSingleTarget`) and each OWNED site whose owner
  is not the active player (melter, revealTopDispose, Red Skull loop, most-Wounds, each-player loops).
- Parser arm + `VALID_TOKEN_PATTERN` arm (WP-853 / D-24789).

## Files to Produce
- `packages/game-engine/src/hero/{deferredConditionalGrants,heroConditions.evaluate,heroEffects.execute}.ts`,
  `setup/heroAbility.setup.ts`, `types.ts`, `game.ts` (01.5 onBegin delete), `simulation/onBeginParity.ts` — modified.
- KO sites — modified: `moves/{healWounds,koDiscardChoice.resolve,koHeroChoice.resolve,melterKoChoice.resolve,optionalKoReward.resolve,revealThreeAssign.resolve,revealTopDispose.resolve,ruthlessDictatorChoice.resolve,scryKoChoice.resolve,seatChoiceTactics,operatorSetters}.ts`,
  `rules/mastermindHandlers.ts`, `villain/villainEffects.execute.ts`.
- `scripts/hero-mechanic-ledger.mjs` (`KNOWN_CONDITIONS['owned-card-koed'] = 'ownedCardKoedThisTurn'`),
  `scripts/convert-cards/apply-hero-ability-markers.mjs`, `inputs/hero-ability-markers.json` — modified;
  `data/cards/dkcy.json` — generated.
- Generated / provenance: hero ledger `{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json`, `mechanic-provenance.json`,
  `live-verify.json` (pending `dkcy/bishop|owned-card-koed`), dashboard data copies + `useInPlayCoverage.test.ts` only if it moves.
- Tests: `hero/ownedCardKoTrigger.test.ts` (new; WP Scope cases incl. `resolveOptionalKoReward`, the
  pre-resolve counter asserts on Red Skull / HQ / Victory Pile, and the drift pin),
  `hero/deferredConditionalGrants.test.ts` (list `deepEqual` + `TRUTHY_FIXTURE`), `simulation/onBeginParity.test.ts`,
  `game.test.ts` (real `turn.onMove` / `turn.onBegin`); `heroConditions.evaluate.test.ts`,
  `setup/heroAbility.setup.test.ts` only if a pin moves.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24789), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; game-engine + dashboard `test` 0; sentinels byte-unchanged (no pin edited).
- [ ] Ledger row `dkcy/bishop` `owned-card-koed` reads `condition`.
- [ ] Provenance + pending live-verify rows added BEFORE `pnpm ledger:heroes`; regenerated, then 0: `cards:check`, `ledger:heroes:check`, `effect-index:check`,
      `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`.
- [ ] D-24789 → Active; STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ +
      `pnpm roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) confirmed, or operator-pending in STATUS with the `live-verify.json` row.

## Common Failure Smells
- +2 on play still — the marker did not reach the parser, or the hook kept an unconditional `recruit`.
- +2 on every move after the first KO — counter not deleted; only +2 for three KOs in one move — no per-count loop.
- `ReferenceError` on engine import — the const was put in `deferredConditionalGrants.ts`.
- Ledger row `unsupported` — `KNOWN_CONDITIONS` lacks the marker. Sentinel moved — recorder ungated.
