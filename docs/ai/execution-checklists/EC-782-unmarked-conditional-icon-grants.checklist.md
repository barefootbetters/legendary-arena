# EC-782 — Unmarked "If …, you get +N" conditional grants (Execution Checklist)

**Source:** docs/ai/work-packets/WP-745-unmarked-conditional-icon-grants.md
**Layer:** Game Engine (`packages/game-engine/src/**`) + card data via the curated hero-ability-marker map
**Status:** Pending

## Before Starting
- [ ] **WP-743 / EC-780 is executed on `main`** (`matchReadsConditionType` exists in `hero/heroConditions.evaluate.ts`). If not → STOP: BLOCKED.
- [ ] If WP-744 (sim deferred-grant parity) landed first, rebase onto its `applyOnBeginParity` edits and re-measure the feeds. If WP-744 is still unexecuted, the `SPEC:` govern-close amends WP-744's execution-order note to name WP-745.
- [ ] Fresh worktree off `origin/main`. Run `pnpm install`, then `pnpm -r build` (exit 0). Record the engine-suite baseline.
- [ ] Re-confirm that all 17 WP §G lines are free grants: `buildHeroAbilityHooks` gives each a hook with effects and **no** `conditions`.
- [ ] Read the WP §Context source list, plus WP-743's shipped `onBegin`, `applyOnBeginParity` and marker arms.
- [ ] Scope lock: only the files in Files to Produce. Anything else → STOP.

## Locked Values (do not re-derive)
- **G fields** (optional, lazy, gated): `cardsPlayedThisTurn?: CardExtId[]` and `koPileLengthAtTurnStart?: number`.
- **Condition types** (exported constants in `heroConditions.evaluate.ts`):
  - on-play: `cardPlayOrdinalEquals`, `otherCardsPlayedThisTurnAtLeast`, `otherCardOfCostPlayedThisTurn`, `cardOfCostPlayedThisTurn`, `otherDistinctNonGreyHeroesPlayedThisTurnAtLeast`. These five make up `PLAY_HISTORY_CONDITION_TYPES`.
  - wait-and-see: `heroPutIntoKoPileThisTurn` (`value` `'1'`, unused).
- **Evaluate** uses `history = G.cardsPlayedThisTurn ?? []`, "other" means `!== triggeringCardId`, and `N` is parsed with the NaN guard:
  - ordinal: `history.length === N`
  - other-count: other entries `>= N`
  - other-cost: some other entry has `cardStats.cost === N`
  - cost: some entry has `cost === N` (self included)
  - distinct: distinct `cardDisplayData[id].name` (fallback: id without `#copy`) among other entries whose printed `heroClass`/`heroClass2` is non-empty, `>= N`
  - Rage: `koPileLengthAtTurnStart` absent → `false`; otherwise some `G.ko[i]` with `i >= start` satisfies `isHeroCardId` (a `cardTraits` entry, or `SHIELD_AGENT_EXT_ID`, `SHIELD_TROOPER_EXT_ID`, `SHIELD_OFFICER_EXT_ID`, `SIDEKICK_EXT_ID`)
- **Describe text:** verbatim from WP §C (six strings). The two "other" strings carry **no** running count, and `describeFailedCondition`'s signature is unchanged.
- **Markers → conditions** (the six new-condition arms push the exported Scope C constants, never literals; `bystanders-threshold` reuses Savior's `'bystandersInVictoryAtLeast'` literal):
  - `card-play-ordinal:N`, `played-other-cards:N`, `played-other-cost:N`, `played-cost:N`, `played-other-distinct-heroes:N` → the five on-play types
  - `hero-koed-this-turn` (bare) → Rage
  - `bystanders-threshold:N` → `bystandersInVictoryAtLeast`
  - `draw-threshold:N` is reused unchanged
- **Apply entries:** the 18 entries on 17 lines in WP §G, verbatim (set, heroSlug, cardSlug, abilityIndex, token).
- **Write sites:**
  - play history: exactly two, in `coreMoves.impl.ts`, each right after an `inPlay` append (`applyCardPlay`, and the split branch of `playCard`; `playFromUndercover` no longer exists), gated on `matchReadsPlayHistory(G)`, in the locked WP §B form (create-if-undefined, then `.push(cardId)` in `applyCardPlay` / `.push(args.cardId)` in the split branch)
  - KO snapshot and history delete: play-phase `turn.onBegin` (before any move) and `applyOnBeginParity`
- **Wait-and-see:** only `heroPutIntoKoPileThisTurn` joins `WAIT_AND_SEE_CONDITION_TYPES`.

## Guardrails
- **Hash oracles stay byte-unchanged** (sentinel `finalStateHash`, `PRE_WP080_HASH`). A move is a gating bug to fix. Never re-pin.
- **Play-history conditions evaluate on play** (D-24568 §1 amends D-24377 §1: a numeric threshold that play order can manufacture stays on-play). They are never added to `WAIT_AND_SEE_CONDITION_TYPES` or `SEQUENCE_GATE_CONDITION_TYPES`.
- **Never read `inPlay` for an ordinal or "other played" count.** Read the play history.
- `firstHeroPlayedThisTurn`, `playedThisTurn` and `bystandersInVictoryAtLeast` evaluator cases are unchanged.
- **Card data only via apply mode**, co2e included. `cards:check` and an apply re-run are zero-diff.
- Each new evaluator case body is a named module-local helper with JSDoc; `evaluateCondition` gains one-line arms only.
- Card-name identity reads `G.cardDisplayData[id].name` (fallback: id without `#copy`), never a projection.
- **Runtime drift pins only** (D-24372). No `any`, `@ts-ignore`, or widened production type. Existing-pin edits are value-only.
- The `useInPlayCoverage.test.ts` `totalObs` re-pin is paired with the feed regen and carries a `Tests-changed:` trailer.

## Required `// why:` Comments
- Each new `G` field: WP-745 / D-24568, its gated lazy lifecycle, and why `inPlay` is not an ordinal (it shrinks mid-turn) / why the KO pile's append-only shape makes a snapshot exact.
- Each `coreMoves.impl.ts` append: gated (oracle-safe), and placed before the card's effects so its own conditions see it. The comments must **not** contain the literal `cardsPlayedThisTurn.push`, or the exactly-2 grep miscounts.
- The `onBegin` and `applyOnBeginParity` statements: the per-turn window, in `onBegin` before any move of the turn; in parity, the `game.ts` mirror for the rebuilt loops.
- Each marker arm in `heroAbility.setup.ts`: the marker→condition precedent; on-play vs wait-and-see.
- The `WAIT_AND_SEE_CONDITION_TYPES` entry (sticky event, shape #1) and `PLAY_HISTORY_CONDITION_TYPES` (play-order gates; D-24568 §1 amends D-24377 §1).

## Files to Produce
- `packages/game-engine/src/types.ts` — **modified**
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — two gated appends
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified**
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — seven marker arms
- `packages/game-engine/src/game.ts`, `packages/game-engine/src/simulation/onBeginParity.ts` — **modified**
- `packages/game-engine/src/hero/unmarkedConditionalGrants.test.ts` — **new** — WP §I cases 1–9 (case 1 reads committed `data/cards` strings, never literals)
- `packages/game-engine/src/hero/deferredConditionalGrants.test.ts` — **modified** — keyset + `TRUTHY_FIXTURE`
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified** — `PLAY_HISTORY_CONDITION_TYPES` pin (evaluate + describe case per member; disjoint from WAIT_AND_SEE and SEQUENCE_GATE)
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified only if** a pin enumerates the extended set
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/hero-mechanic-ledger.mjs` — **modified**
- `data/cards/{msis,amwp,dkcy,vill,ca75,co2e,xmen,anni,ff04,vnom,asrd,rvlt,mgtg,wtif}.json` — **modified** — regenerated
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json` — **modified** — regenerated (certain; order `ledger:heroes` → `effect-index` → `mechanics:metadata` → `sim:runtime-observed`)
- `scripts/coverage/hero-effect-coverage.baseline.json` — **modified only if** `sim:coverage --check` exits non-zero
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **modified** — paired `totalObs` re-pin

## After Completing
- [ ] `pnpm -r build` exits 0. Engine and dashboard suites are green; record baseline → new counts in the `EC-782:` body.
- [ ] Every one of these exits 0: `cards:check`, `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:coverage --check`, `sim:runtime-observed:check`.
- [ ] An apply re-run is zero-diff. The `cardsPlayedThisTurn.push` grep in `coreMoves.impl.ts` returns exactly 2.
- [ ] Live (D-24026): an Elektra, Winter Soldier or Rage match log grants only when the condition held. Record it in STATUS.
- [ ] Governance: STATUS; DECISIONS D-24568 Active; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `📝`→`✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Common Failure Smells (Optional)
- **Sentinel hash fails.** A field was written ungated, or the history was created as `[]` on a no-reader match.
- **Elektra grants as the 2nd play after a self-KO.** The ordinal reads `inPlay`, not the history.
- **Winter Soldier grants when played first.** A play-history type leaked into `WAIT_AND_SEE_CONDITION_TYPES`.
- **Every card counts as "first" on turn 2 of a sim.** `applyOnBeginParity` is missing the history delete.
- **Rage fires on a KO'd Wound.** `isHeroCardId` accepts any id; check the `cardTraits` / basic-token test.
- **Rage never fires in a live game.** The snapshot is taken outside `onBegin` (e.g. in a move), or is not gated in.
- **Dr. Strange grants on a 4-cost alone.** Only one `played-cost` token landed. The second apply entry must target the same line (the WP-667 carry-forward).
- **`cards:check` passes but co2e is wrong.** co2e is excluded from `cards:check`; verify the three co2e lines by the apply re-run and the hook probe.
- **Rage tests pass but the live card never gates.** The test called `applyCardPlay` on a Rage id. Rage is face B of the Grief/Rage split card; drive `playCard` + `resolveSplitFaceChoice('b')`.
