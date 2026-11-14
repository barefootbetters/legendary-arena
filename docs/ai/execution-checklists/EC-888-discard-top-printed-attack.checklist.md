# EC-888 — Discard-top printed Attack + KO any of those cards (Execution Checklist)

**Source:** docs/ai/work-packets/WP-850-discard-top-printed-attack.md
**Layer:** Game Engine + Arena Client (reuses the KO-from-discard pending choice)

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce` — any edit outside it is a FAIL; surface it.
- [ ] Baseline `origin/main` at or after `452956c5` (WP-850 reserve #3074, WP-851 reserve #3075).
- [ ] `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test` exit 0;
      `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
- [ ] Read the models: `heroEffectStealAbilities` (deck-top discard), `heroEffectRevealTopDisposeKo`
      (later clause acts on the earlier clause), `moves/koDiscardChoice.resolve.ts` + the WP-836
      `greyFilter` path, `selectDefaultKoDiscardCardIds`.
- [ ] Re-read every drift-pin literal at HEAD (a sibling hero-keyword WP may have bumped them).

## Locked Values (do not re-derive; verify at HEAD)
- **Keywords:** `discard-top-printed-attack` (magnitude = cards to discard; NOT in
  `NO_MAGNITUDE_KEYWORDS`; joins `SELF_COMPUTED_ATTACK_KEYWORDS`) and `ko-discarded-this-way`
  (no magnitude; IN `NO_MAGNITUDE_KEYWORDS`). Tokens: `[keyword:discard-top-printed-attack:4]`
  on dkcy bishop/firepower-from-the-future `abilityIndex` 0; `[keyword:ko-discarded-this-way]` on
  `abilityIndex` 1 (beside its existing `[team:x-men]:` gate).
- **`VALID_TOKEN_PATTERN` arms:** `^\[keyword:discard-top-printed-attack:[1-9]\d*\]$` and
  `^\[keyword:ko-discarded-this-way\]$`.
- **Handler 1** `heroEffectDiscardTopPrintedAttack`: loop `magnitude` times — deck empty →
  `reshuffleDiscardIntoDeck(zones, ctx as ShuffleProvider)`; still empty → `break` (never `return`);
  else `const moved = moveCardFromZone(zones.deck, zones.discard, topId); zones.deck = moved.from;
  zones.discard = moved.to;`, `total += offPlayCardStats(G, topId)?.attack ?? 0`, push topId (a
  re-discard after a reshuffle counts again). After the loop, on EVERY path (`cardIds: []` if none,
  so line 2 never reads an earlier play's record): `addResources(G.turnEconomy, total, 0)`, one log
  line, `G.lastDeckTopDiscard = { playerID, sourceCardId: cardId, cardIds }`.
- **Handler 2** `heroEffectKoDiscardedThisWay`: record absent / `playerID` or `sourceCardId`
  mismatch → `blocked` log, no park. Eligible = recorded ids still in discard, multiset-capped.
  Empty → `neutral` log, no park. Else push `{ choiceType: 'ko-from-discard', playerID, maxCount:
  eligible.length, sourceCardId: cardId, eligibleCardIds: eligible }` onto lazily-initialised
  `G.pendingKoDiscardChoices`. `delete G.lastDeckTopDiscard` in EVERY branch (engine tsconfig has
  `exactOptionalPropertyTypes`; assigning `undefined` is TS2412). A gated-out line 2 never runs, so
  the record lingers unread until the next line-1 play overwrites it — expected.
- **Types (house `?: T | undefined` form):** `PendingKoDiscardChoice.eligibleCardIds?: CardExtId[] | undefined`;
  `LegendaryGameState.lastDeckTopDiscard?: { playerID: string; sourceCardId: CardExtId; cardIds: CardExtId[] } | undefined`;
  `UIPendingKoDiscardChoice.isLimitedToDiscardedThisWay?: boolean`. All omit-when-absent.
- **`getEligibleKoDiscardCards(G, playerID, greyFilter?, eligibleCardIds?)`:** discard order; a card
  is kept only while its remaining multiset allowance > 0; `greyFilter` then applies on top.
  `buildUIState` passes `frontChoice.eligibleCardIds` as the 4th argument at its existing call.
- **Resolve:** with `front.eligibleCardIds` set, reject (silent `void`, queue intact) unless the
  selection is a sub-multiset of it (inline, beside the `greyFilter` check); all existing checks unchanged.
- **Bot:** `selectDefaultKoDiscardCardIds` drops its inline grey filter and picks from
  `getEligibleKoDiscardCards(G, front.playerID, front.greyFilter, front.eligibleCardIds)` — one
  shared filter with the projection; Loki / Salomé / grey picks unchanged.
- **Heading:** `KO any number of the ${count} ${count === 1 ? 'card' : 'cards'} you just discarded`
  with `count` = the LISTED cards (`discard.length`) when `isLimitedToDiscardedThisWay`; others unchanged.
- **Drift pins (READ HEAD, bump by exactly 2):** `HERO_KEYWORDS` 85→**87** at all three sites
  (`rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts` list + count,
  `setup/heroAbility.setup.test.ts` X-Gene count); `HERO_EFFECT_HANDLERS` 67→**69** (both asserts in
  `hero/heroEffects.execute.test.ts`). No move-count change (no new move).

## Guardrails
- Union and `HERO_KEYWORDS` array change together; RUNTIME pins (D-24372), never `satisfies`.
- No new queue, move, guard site, vanquish-drop entry, or sim `MOVE_MAP` key — reuse WP-693's.
- Loki / Salomé / Destroyer / Frost Giant Warrior / Ymir entries project and resolve byte-identically.
- Five-step UIState for `isLimitedToDiscardedThisWay`, including the `filterUIStateForAudience`
  field-by-field pass-through and its audience test.
- Bot default mirrors the filter, or the block-all guard never lifts in a sim.
- Only randomness: the D-24285 reshuffle via the threaded `ctx`. Moves never throw.
- `dkcy.json` regenerated from the marker map; never hand-edited.
- Optional fields → no `finalStateHash` re-pin. A sentinel hash moving is a STOP.

## Required `// why:` Comments
- Handler 1: the per-card reshuffle (D-24285 — reshuffled cards may include this play's discards);
  why the record is written (line 2 is a separate hook with no return channel).
- Handler 2: why the record is cleared in every branch; why eligibility is recomputed against the
  live discard (a reshuffle may have moved "those cards" back into the deck).
- `heroEffects.execute.ts`: why `ko-discarded-this-way` is in `NO_MAGNITUDE_KEYWORDS` and
  `discard-top-printed-attack` is not.
- `heroAbility.setup.ts`: why `discard-top-printed-attack` joins `SELF_COMPUTED_ATTACK_KEYWORDS`.
- `koDiscardChoice.resolve.ts` + `ai.legalMoves.ts`: why the multiset filter (WP-850 / D-24786).

## Files to Produce
- `packages/game-engine/src/rules/heroKeywords.ts` — modified — two keywords.
- `packages/game-engine/src/hero/heroEffects.execute.ts` — modified — sets + two handlers.
- `packages/game-engine/src/setup/heroAbility.setup.ts` — modified — `SELF_COMPUTED_ATTACK_KEYWORDS`.
- `packages/game-engine/src/types.ts` — modified — `eligibleCardIds?` + `lastDeckTopDiscard?`.
- `packages/game-engine/src/moves/koDiscardChoice.resolve.ts` — modified — eligible helper + resolve check.
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — modified — bot default calls the shared filter.
- `packages/game-engine/src/ui/uiState.{types,build,filter}.ts` — modified — five-step field.
- `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.vue` — modified — heading.
- `scripts/convert-cards/apply-hero-ability-markers.mjs` — modified — two token arms.
- `scripts/convert-cards/inputs/hero-ability-markers.json` — modified — two dkcy entries.
- `data/cards/dkcy.json` — modified (generated).
- Generated / provenance: `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`,
  `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`,
  `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`,
  `scripts/coverage/mechanic-provenance.json`; `docs/ai/coverage/live-verify.json` (pending rows `dkcy/bishop|discard-top-printed-attack`, `dkcy/bishop|ko-discarded-this-way`);
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (in-play pin, expected to move).
- Tests (under `packages/game-engine/src/`; cases + assertions per WP Scope Tests — real parsed hooks,
  stale-record overwrite, bot skips a non-eligible Wound, `Object.hasOwn` key checks):
  `hero/discardTopPrintedAttack.test.ts` (new), `rules/heroKeywords.test.ts`,
  `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`,
  `moves/koDiscardChoice.resolve.test.ts`, `simulation/ai.legalMoves.test.ts`, `ui/uiState.build.test.ts`,
  `ui/uiState.filter.test.ts`; plus `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.test.ts`.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24786), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; game-engine + arena-client + dashboard `test` 0; arena-client `typecheck` 0.
- [ ] Regenerated, then 0: `cards:check`, `ledger:heroes:check`, `effect-index:check`,
      `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`; both keywords
      `executable`.
- [ ] The no-hollow unit test passes (no `Unhandled effect observed` for Firepower, gate met or not);
      shared mechanic hit counts may drop, rows stay.
- [ ] `finalStateHash` sentinels byte-unchanged (no pin literal edited).
- [ ] D-24786 → Active; STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ + `pnpm roadmap:counts:write`
      + `roadmap:counts:check` 0.
- [ ] Live-on-surface (D-24026) confirmed in a real match (diagnostics export shows the flag), or explicitly left open as operator-pending
      in STATUS with the `live-verify.json` pending row.

## Common Failure Smells
- Freeze after Firepower with an X-Men Hero out — bot / prompt / resolve filters disagree.
- Attack is base + 4 + printed — `SELF_COMPUTED_ATTACK_KEYWORDS` lacks the keyword.