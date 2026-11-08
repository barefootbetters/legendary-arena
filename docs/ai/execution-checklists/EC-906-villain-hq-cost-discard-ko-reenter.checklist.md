# EC-906 — Villain Fight hollows: HQ cost change, mandatory KO from discard, Mr. Immortal reenters the Sewers (Execution Checklist)

**Source:** docs/ai/work-packets/WP-868-villain-hq-cost-discard-ko-reenter.md
**Risk Tier:** MEDIUM — gameplay logic (recruit price, discard pile, City entry) plus one chooser-only UIState field and one client
prompt; no auth, money, persistence or server surface
**Layer:** Game Engine (three villain primitives, HQ cost overlay, `minCount`, one Fight bridge) + UIState + arena-client + card data

## Before Starting
- [ ] Scope lock: the target file set is `## Files to Produce`. Any edit outside it is a FAIL; surface it.
- [ ] Reservation #3189 (WP-868 / EC-906 / D-24811) is on `main`; record `git rev-parse origin/main`. #3170 / #3186 are merged
      (cvwr `great-lakes-avengers` holds Big Bertha); if WP-864 merged too, rebase and leave its marker lines as they are.
- [ ] `pnpm -r build`, game-engine / arena-client / dashboard `test` exit 0 (game-engine 6387 / 0 at draft); then 0:
      `pnpm --filter @legendary-arena/arena-client typecheck`
- [ ] Re-read at HEAD: `VILLAIN_EFFECT_PRIMITIVES` (39 at draft; +1 each for WP-864 / WP-869 if landed) and its length pins; the marker script's
      copy and `isValidParameterizedEffectToken`; `resolveRecruitCost`; `matchHasSizeChangingCard`; `resolveKoDiscardChoice`;
      `selectDefaultKoDiscardCardIds`; `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`; the end of `defeatCityVillainCore`.

## Locked Values (do not re-derive; verify at HEAD)
- **Primitives**, appended last in this order to `VillainEffectPrimitive`, `VILLAIN_EFFECT_PRIMITIVES` and the marker script's copy:
  `'hq-heroes-cost-change'`, `'ko-from-discard-current'`, `'reenter-sewers-if-villain-deck-top'`. All keyword-less.
- **Descriptor fields** (optional, outside `descriptorKey`): `costChangeDirection?: 'less' | 'more'`, `costChangeClasses?:
  readonly HeroClass[]`, `reenterRevealKinds?: readonly ('villain' | 'bystander')[]`.
- **Grammar** (colon-parts include the primitive; parser and marker script alike; anything else → `null` / `unresolvedMarkers`):
  `hq-heroes-cost-change:<less|more>:<N>[:<c>[+<c>…]]` 3 or 4 parts, N positive integer → `magnitude`, classes via
  `parseHeroClassList`; `ko-from-discard-current:<N>` exactly 2 parts, N positive integer → `magnitude`;
  `reenter-sewers-if-villain-deck-top:<kinds>` exactly 2 parts, kinds `villain` | `bystander` | `villain+bystander`.
- **HQ overlay:** `types.ts` `export interface HqCostChange { cardId: CardExtId; amount: number }`, `G.hqCostChanges?:
  HqCostChange[]` (lazy). New `hero/hqCostChange.logic.ts`: `addHqCostChange(G, change)`; `getHqCostChange(G, cardId): number`
  (sum for the id, 0 unless `G.hq.includes(cardId)`); `clearHqCostChanges(G)` (`delete G.hqCostChanges`). Handler: each non-null
  `G.hq` slot left to right, skipping an id whose `G.cardTraits[id]` heroClass and heroClass2 are both outside `costChangeClasses`
  (when present); `amount = -N` (less) or `+N` (more).
- **Recruit price:** `const changedCost = Math.max(0, printedCost + getHqCostChange(G, cardId));` then
  `applySizeChangingDiscount(G, playerID, changedCost, …)` as before. `matchHasSizeChangingCard` adds `|| gameState.hqCostChanges
  !== undefined`. Cleanup Step 8 calls `clearHqCostChanges(G)` beside `clearExpiredHqSizeChangingGrants(G)`.
- **Mandatory KO:** `PendingKoDiscardChoice.minCount?: number` (omit-when-absent). `required = Math.min(minCount,
  getEligibleKoDiscardCards(G, playerID, greyFilter, eligibleCardIds).length)` everywhere. Handler, `maxCount = minCount = N`:
  empty discard → `blocked`, no park; `discard.length <= N` or every discard id equal → for each of the first N: `moveCardFromZone`
  discard → out, `G.ko = koCard(G.ko, id)`, `recordOwnedCardKoed(G, currentPlayer, id, 'discard')`; else park `{ choiceType:
  'ko-from-discard', playerID, maxCount: N, minCount: N, sourceCardId }`. Resolve: after the `maxCount` check, reject
  `args.cardIds.length < required`, queue intact. Bot: the two existing passes record each discard index they take; with
  `minCount` the top-up walks the untaken eligible indices in discard order to `required` (ids repeat).
- **UIState:** `UIPendingKoDiscardChoice.minCount?: number`, set in `buildUIState` only when defined; passed through
  `filterUIStateForAudience` for the chooser only.
- **Prompt:** with `minCount`: `canSubmit` needs `selectedIndices.length >= Math.min(minCount, discard.length)` (the projected
  discard is the eligible list); heading `KO ${minCount} ${noun} from your discard pile`; zero-pick label `Choose a card to KO`,
  never `KO None`. Without `minCount`, behavior and text are byte-identical.
- **Reenter:** handler returns `{ targets: [] }`, no log, and is added to `DELIBERATE_NO_OP_VILLAIN_PRIMITIVES`.
  `resolveCardDisplayName` becomes exported. `villainCardReenterSewersKinds(G, cardId, timing)` returns the first matching
  descriptor's `reenterRevealKinds` or `null` (the `villainCardPlaysVillainDeckCards` guards). Bridge
  `reenterSewersOnVillainDeckReveal(G, context, implementationMap, currentPlayer, cardId, kinds)` in
  `villainDeck/villainDeck.enterCity.ts`, the LAST step of `defeatCityVillainCore`. `villain` matches `RevealedCardType` `villain` |
  `henchman`. Order: empty deck → stop; reveal log; type mismatch → stop; not in Victory Pile → stop; `moveCardFromZone` victory →
  out, `pushVillainIntoCity`, log, `resolveVillainEscape` for a pushed-out card. The top card is never moved. No secondary trace.
  `RevealContext` as the Endless Armies block: `{ random: shuffleContext.random, ctx: { currentPlayer, turn: readTurnNumber(ctx) } }`.
- **Logs** (`<src>` = `resolveCardDisplayName(G, cardId)`; `<top>` the revealed card; `<names>` comma-joined; `label` =
  `villainEffectTimingLabel(timing)`):
  - cost: `${label} effect: Heroes in the HQ cost ${N} ${less|more} this turn (<src>): <names>.` (`applied`); none:
    `${label} effect: no matching Heroes in the HQ (<src>).` (`blocked`)
  - KO: direct `${label} effect: KO'd <names> from your discard pile (<src>).` (`applied`); park `${label} effect: KO ${N}
    card(s) from your discard pile (<src>).` (`neutral`); empty `${label} effect: your discard pile is empty (<src>); nothing to
    KO.` (`blocked`)
  - reenter: empty deck `Fight effect: the Villain Deck is empty, so <src> stays defeated.` (`blocked`); reveal `Fight effect:
    <src> revealed <top> from the Villain Deck.` (`neutral`); mismatch `<top> is not a Villain or Bystander, so <src> stays
    defeated.` (`neutral`); gone `Fight effect: <src> is no longer in the Victory Pile, so it cannot reenter the Sewers.`
    (`blocked`); match `<src> reenters the Sewers.` (`threat`)
- **Markers:** the WP RS-4 table verbatim (16 lines, 12 set files).
- **Provenance / pins:** `mechanic-provenance.json` rows for the three primitives → `{ "wp": "WP-868", "decision": "D-24811" }`;
  pending `live-verify.json` rows for Tim Boo Ba, Flatman, Mr. Immortal. `rules/villainAbility.types.test.ts` list, every length
  site, last-entry assert, count strings and the `// why:` comments above the length asserts, citing WP-868 / D-24811.

## Guardrails
- One implementation each: cost read only in `resolveRecruitCost`; the KO minimum only via `required`; re-entry only in the bridge.
- All new `G` state is lazy and omit-when-absent. STOP if a `finalStateHash` sentinel or golden hash moves.
- "Up to" entries (Maniacal Tyrant, Salomé, grey filter, Firepower from the Future) keep accepting `[]`; STOP if their tests change.
- Reentry fires no Ambush and no `onCardRevealed` hook. Groot, Orrgo, Squirrel Girl and the conditional siblings stay unmarked.
- No server, move or pending-queue addition. Moves and handlers never throw. No `.reduce()`, nested ternaries, `any` or
  `@ts-ignore`. Never edit a test to pass, `git stash`, or hand-edit `data/cards/*.json`.

## Required `// why:` Comments
- Each appended primitive (types, executor, marker script) and the no-op set entry: WP-868 / D-24811.
- `hqCostChange.logic.ts` / `sizeChanging.logic.ts` / `matchHasSizeChangingCard`: the HQ snapshot; read only while in the HQ; floor
  then Size-Changing; recruit price only (D-24801 parallel); the presence rule for `recruitCosts`.
- KO handler / resolve / bot / prompt: the mandatory minimum; the direct KO when the pick cannot matter; position-tracked top-up.
- `fightVillain.ts` / `villainDeck.enterCity.ts`: the executor-no-op bridge (D-24351); not a reveal; Henchmen are Villains.

## Files to Produce
- Engine: `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts`, `types.ts`,
  `hero/hqCostChange.logic.ts` (new), `hero/sizeChanging.logic.ts`, `moves/endOfTurnCleanup.logic.ts`,
  `moves/koDiscardChoice.resolve.ts`, `moves/fightVillain.ts`, `villainDeck/villainDeck.enterCity.ts`,
  `simulation/ai.legalMoves.ts`, `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`.
- Client: `apps/arena-client/src/components/play/PendingKoDiscardChoicePrompt.vue`.
- Data: `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`; generated
  `data/cards/{antm,asrd,chmp,cosm,cvwr,mdns,msis,msmc,rvlt,ssw2,vnom,xmen}.json`.
- Generated / provenance: `villain-mechanic-ledger.{json,csv}`, `effect-implementation-index.json`, `card-mechanics.json`,
  `runtime-observed-hollows.json`, `hero-effect-coverage.baseline.json` (only if it moves), `mechanic-provenance.json`,
  `live-verify.json`; `in-play-hollow-baseline.json` + `useInPlayCoverage.test.ts` only if the in-play pin moves.
- Tests: new `hero/hqCostChange.logic.test.ts` (incl. the `buildUIState` `recruitCosts` case), `villain/koFromDiscardMandatory.test.ts`,
  `villain/reenterSewers.test.ts`; modified `rules/villainAbility.types.test.ts`, `ui/uiState.filter.test.ts`,
  `PendingKoDiscardChoicePrompt.test.ts`.
- Close: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24811), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`,
  `docs/ai/NUMBER-LEDGER.md`.

## After Completing
- [ ] `pnpm -r build` 0; engine, arena-client and dashboard `test` 0; engine delta recorded (expect at least +20). Then 0:
      `pnpm --filter @legendary-arena/arena-client typecheck`
      (and `pnpm --filter @legendary-arena/dashboard typecheck` if `useInPlayCoverage.test.ts` moved).
- [ ] Provenance and pending live-verify rows BEFORE the ledgers; then 0: `cards:check` (only the 12 card files changed),
      `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`,
      `sim:coverage --check`, `cards:count-markers:check`, dashboard `prebuild:coverage`.
- [ ] Govern-close 0: `workindex:rows:check`, `workindex:executed:check`, `node scripts/check-number-ledger.mjs --check`;
      `git diff --name-only origin/main...HEAD` inside `## Files to Produce`.
- [ ] D-24811 → Active covering every Reserved Decision clause; STATUS; WORK_INDEX checked; EC_INDEX Done; mindmap ✅ +
      `roadmap:counts:write` + `roadmap:counts:check` 0; ledger LANDED note.
- [ ] Live-on-surface (D-24026) per the WP DoD, including `pendingKoDiscardChoice.minCount` in the Play Diagnostics
      `uiStateSnapshot`, or operator-pending in STATUS + `live-verify.json`.

## Common Failure Smells
- Recruit stays disabled after Tim Boo Ba with no Size-Changing card in the match: the presence rule was not widened. Flatman's prompt shows "KO None", or the bot stalls: `minCount` not projected, or the top-up skipped repeated ids.
