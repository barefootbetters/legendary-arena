# EC-893 — "Whenever a card is KO'd from your deck this turn, you may draw a card": Miek's Endless Appetite (Execution Checklist)

**Source:** docs/ai/work-packets/WP-855-deck-ko-draw.md
**Layer:** Game Engine (wait-and-see condition + deck-KO signal via the owned recorder + hold) + card data

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` — any edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `08b54c23`; WP-853 / D-24789 Active.
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test` exit 0 (record the count).
- [ ] Read the models: `recordOwnedCardKoed` + `hasWaitingOwnedKoGrant`, the owned-KO always-defer
      branch in `executeHeroEffects`, `resolveDeferredHeroGrants`, the `owned-card-koed` parser arm,
      `hasAnyPendingChoice` (`moves/phaseCard.ts`), the WP-853 `LOCKED_TABLE` scanner.
- [ ] **WP-856 check:** if WP-856 / D-24792 has landed, the recorder is `(G, ownerPlayerID, cardId)` —
      keep `cardId` and append `fromZone` (final `(G, ownerPlayerID, cardId, fromZone)`); leave its
      count and condition alone; if `hasWaitingGrantWithCondition` exists, reuse it and add the deck block
      beside its gated owned block (no second rename). Otherwise add `fromZone` as the 3rd parameter.
- [ ] Re-count at HEAD: 34 KO sites / 25 owned (WP-853 pin green). A different set is a STOP —
      classify the new site's zone first.
- [ ] Jeff's RS-1 answer ("may" = auto-draw) at the go.

## Locked Values (do not re-derive; verify at HEAD)
- **Marker:** `[keyword:deck-card-koed]`; `VALID_TOKEN_PATTERN` arm `^\[keyword:deck-card-koed\]$`;
  `hero-ability-markers.json` → `wwhk`, two entries, this order:
  `{ "heroSlug": "miek-the-unhived", "cardSlug": "endless-appetite", "abilityIndex": 0, "markupToken": "[keyword:deck-card-koed]" }`,
  then the same keys with `"markupToken": "[keyword:draw:1]"`.
- **Condition:** `export const DECK_CARD_KOED_CONDITION_TYPE = 'deckCardKoedThisTurn'` in
  `hero/heroConditions.evaluate.ts` (beside the owned const); appended to `WAIT_AND_SEE_CONDITION_TYPES`
  after the owned entry; parser pushes `{ type: DECK_CARD_KOED_CONDITION_TYPE, value: '1' }`;
  `deck-card-koed` joins `HERO_PARSER_RECOGNIZED_MARKER_NAMES` after `owned-card-koed`.
- **Evaluate:** `return (G.deckCardsKoedSinceResolve?.[playerID] ?? 0) > 0;`
  **Describe:** `'it needs a card to be KO\'d from your deck this turn'`.
- **Field:** `deckCardsKoedSinceResolve?: Record<string, number>` on `LegendaryGameState`, beside
  `ownedCardsKoedSinceResolve`; never set in `Game.setup`.
- **Recorder:** `export type OwnedKoSourceZone = 'hand' | 'deck' | 'discard' | 'inPlay'` in
  `deferredConditionalGrants.ts`; `recordOwnedCardKoed(G, ownerPlayerID, fromZone: OwnedKoSourceZone)`
  (required). Two independent gated increments: owned count when
  `hasWaitingGrantWithCondition(G, OWNED_CARD_KOED_CONDITION_TYPE)`; deck count when `fromZone === 'deck'`
  and `hasWaitingGrantWithCondition(G, DECK_CARD_KOED_CONDITION_TYPE)` (the renamed `hasWaitingOwnedKoGrant`).
- **Zones** (all 25 calls): `'deck'` — `applyRevealKo`, `resolveMelterKoChoice`, `applyRevealThreeDisposition`,
  `resolveRevealTopDispose`, `resolveRuthlessDictatorChoice`, `resolveScryKoChoice`, `villainEffectScryKoOwnDeck`,
  `villainEffectRevealTopKoGreyOrDrawByClass`; `from.zone` — `koFromPlayerZone` (inside the `!== 'victory'`
  branch); `'inPlay'` — `heroEffectKo`, `koOneHeroForPlayer` in-play site; `'hand'` — `healWounds`,
  `resolveRedSkullStrike`, `koOneHeroForPlayer` hand site; `'discard'` — `resolveKoDiscardChoice`;
  variable — `heroEffectKoWoundReward` / `heroEffectKoWound` / `resolveOptionalKoReward` `targetZone`,
  `resolveKoHeroChoice` `args.zone` + `forced.zone`, `applyCrushPacifistResistanceKo` `sourceZone`,
  `koHeroesFromZoneForPlayer` `zone`, `koSingleTarget` `target.zone`,
  `villainEffectKoHeroesCurrentByTrait` `targetZones[index]!` with `targets[index]!` (index loop),
  `villainEffectKoWoundsCurrentHandAndDiscard` new index-aligned `koedWoundZones[index]!` with `koedWounds[index]!`
  (`noUncheckedIndexedAccess`; `!` under a `// why:`, never `?? 'hand'`).
- **Always defer:** the WP-853 branch's lookup becomes `findConditionOfType(hook, OWNED_CARD_KOED_CONDITION_TYPE)
  ?? findConditionOfType(hook, DECK_CARD_KOED_CONDITION_TYPE)` (inline, no new helper); guard /
  record / log / `continue` unchanged. Defeat family NOT included (D-24598).
- **Resolve:** `const isDeckKoDrawHeld = hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined;`
  before `resolveDeferredConditionalGrants`. Check callback: deck-KO hook && `isDeckKoDrawHeld` → `false`
  (before `evaluateAllConditions`). `repeatCount`: owned hook → owned count (unchanged); deck hook →
  `Math.max(1, G.deckCardsKoedSinceResolve?.[entry.playerId] ?? 0)`; else 1. Re-arm on defeat OR owned
  OR deck type. After: delete `G.deckCardsKoedSinceResolve` only when set and `!isDeckKoDrawHeld`; the
  owned delete stays unconditional.
- **Deck-zone pin** (new test file): COPY the WP-853 scan helpers (that file stays frozen) and rules; map `path#function` → count of `recordOwnedCardKoed(`
  calls whose argument list contains `'deck'`; 0 omitted; `deepEqual` = the 8 literal-deck functions → 1.
  The WP-853 `LOCKED_TABLE` is NOT edited.
- **Tests:** +17 `deckCardKoTrigger.test.ts`, +2 `game.test.ts`, +1 `onBeginParity.test.ts`, +1 generated by the
  `heroAbility.setup.test.ts` marker loop (file unchanged) = engine +21.

## Guardrails
- No new hero keyword, handler, pending choice, move, `CORE_MOVE_NAMES` entry or UIState field.
- `WAIT_AND_SEE_CONDITION_TYPES` entry + `evaluateCondition` case + `TRUTHY_FIXTURE` land together.
- Absorb Energies' behaviour, the owned count and `ownedCardKoTrigger.test.ts` are untouched.
- Each zone is the zone the card actually left — never a guessed constant; no NEW `as` cast (optionalKoReward's existing one is reused).
- Recorder gated; count deleted every unheld resolve (live + sim/PAR/fixture mirrors); `replay.execute.ts`
  left alone (D-24322). A sentinel / `finalStateHash` moving is a STOP, never a re-pin.
- Moves never throw; no `.reduce()`; RUNTIME pins, not `satisfies` (D-24372).
- `wwhk.json` regenerated from the marker map only; no per-card special-casing.

## Required `// why:` Comments
- The recorder's `fromZone` and deck branch (gate = no hash surface without a waiting grant; per owner).
- The widened always-defer lookup (D-24791, both per-KO types).
- The hold: a draw would take a snapshotted deck-top card (Ruthless Dictator / scry keep the queue on a
  missing card → frozen turn); why `pendingHeroChoice` is added by hand; why the count is kept.
- The deck `repeatCount`, the widened re-arm, the held delete.
- Each `!` index read (index-aligned list built in the same loop); `koFromPlayerZone`'s narrowed `from.zone`.
- Parser arm + `VALID_TOKEN_PATTERN` arm.

## Files to Produce
- `packages/game-engine/src/hero/{heroConditions.evaluate,deferredConditionalGrants,heroEffects.execute}.ts`,
  `setup/heroAbility.setup.ts`, `types.ts`, `game.ts` (01.5 onBegin delete), `simulation/onBeginParity.ts` — modified.
- Owned KO sites — modified: `moves/{healWounds,koDiscardChoice.resolve,koHeroChoice.resolve,melterKoChoice.resolve,optionalKoReward.resolve,revealThreeAssign.resolve,revealTopDispose.resolve,ruthlessDictatorChoice.resolve,scryKoChoice.resolve,seatChoiceTactics,operatorSetters}.ts`,
  `rules/mastermindHandlers.ts`, `villain/villainEffects.execute.ts`.
- `scripts/hero-mechanic-ledger.mjs` (`KNOWN_CONDITIONS['deck-card-koed'] = 'deckCardKoedThisTurn'`),
  `scripts/convert-cards/apply-hero-ability-markers.mjs`, `inputs/hero-ability-markers.json` — modified;
  `data/cards/wwhk.json` — generated.
- Generated / provenance: hero ledger `{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json`, `mechanic-provenance.json`,
  `live-verify.json` (pending `wwhk/miek-the-unhived|deck-card-koed`), dashboard data copies +
  `useInPlayCoverage.test.ts` only if it moves.
- Tests: `hero/deckCardKoTrigger.test.ts` (new), `hero/deferredConditionalGrants.test.ts` (in place),
  `simulation/onBeginParity.test.ts`, `game.test.ts`.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24791), `WORK_INDEX.md`, `EC_INDEX.md`,
  `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; game-engine (+21) + dashboard `test` 0; sentinels byte-unchanged (no pin edited).
- [ ] Ledger row `wwhk/miek-the-unhived` `deck-card-koed` reads `condition`.
- [ ] Provenance + pending live-verify rows added BEFORE `pnpm ledger:heroes`; then 0: `cards:check`,
      `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`,
      `sim:coverage --check`.
- [ ] D-24791 → Active; STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write`
      + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) confirmed, or operator-pending in STATUS with the `live-verify.json` row.

## Common Failure Smells
- A draw on play — the marker did not reach the parser, or the hook kept an unconditional `draw`.
- A draw on a Whatever the Cost hand KO — a site passing `'deck'` that did not take a deck card.
- Ruthless Dictator stuck after the KO step, or Kinetic Card's card drawn — the hold is missing a queue
  or is computed after the grants fire.
- A draw on every move after one KO — count not deleted on an unheld resolve.
- Ledger row `unsupported` — `KNOWN_CONDITIONS` lacks the marker. Sentinel moved — recorder ungated.
