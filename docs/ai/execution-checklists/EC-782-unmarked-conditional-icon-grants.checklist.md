# EC-782 — Unmarked "If …, you get +N" conditional grants (Execution Checklist)

**Source:** docs/ai/work-packets/WP-745-unmarked-conditional-icon-grants.md
**Layer:** Game Engine (`packages/game-engine/src/**`) + card data via the curated hero-ability-marker map
**Status:** Pending — reconciled and re-gated 2026-11-16 on `main` `b93e6d6ca` (12 lines; the five already-gated lines and the draft's play-history field are dropped, WP §Reconciliation)

## Before Starting
- [ ] Worktree off `origin/main`; `pnpm install`, `pnpm -r build` exit 0; record `pnpm -r --no-bail test` per-package baseline.
- [ ] If WP-768 landed first, start from the merged tree; every feed below is regenerated from it.
- [ ] Re-run the probe: the 12 WP §Locked Values lines build hooks with effects and **no** `conditions`; the five dropped lines carry `firstHeroPlayedThisTurn` / `playedThisTurn`. Any drift → STOP.
- [ ] Read WP §Context sources, WP-743's `onBegin` / `applyOnBeginParity` deletes, and WP-777's `discard-threshold` arm + script entries (the template).
- [ ] Scope lock: only WP §Files Expected to Change. Anything else → STOP.

## Locked Values (do not re-derive)
- **G field** (optional, lazy, gated): `koPileLengthAtTurnStart?: number`. No other new `G` field. No `coreMoves.impl.ts` change.
- **Condition constants** (`heroConditions.evaluate.ts`): `CARD_PLAY_ORDINAL_CONDITION_TYPE = 'cardPlayOrdinalEquals'`, `OTHER_CARD_OF_COST_PLAYED_CONDITION_TYPE = 'otherCardOfCostPlayedThisTurn'`, `CARD_OF_COST_PLAYED_CONDITION_TYPE = 'cardOfCostPlayedThisTurn'`, `OTHER_DISTINCT_HEROES_PLAYED_CONDITION_TYPE = 'otherDistinctNonGreyHeroesPlayedThisTurnAtLeast'` (these four = `PLAY_HISTORY_CONDITION_TYPES`, on-play), `HERO_KOED_THIS_TURN_CONDITION_TYPE = 'heroPutIntoKoPileThisTurn'` (wait-and-see, `value` `'1'` unused).
- **Evaluate:** `played = playedCardIdsThisTurn(G, playerZones.inPlay)`; "other" = `!== triggeringCardId`; `N` parsed with the NaN guard → `false`.
  - ordinal: `played.length === N`
  - other-cost: some other entry `G.cardStats?.[id]?.cost === N`; cost: some entry (self included)
  - distinct: distinct names (`G.cardDisplayData?.[id]?.name`, else id without `#copy`) among other entries whose `G.cardTraits?.[id]` has a non-empty `heroClass` or `heroClass2`, `>= N`
  - Rage: `G.koPileLengthAtTurnStart` absent → `false`; else some `G.ko[i]`, `i >= start`, passes `isHeroCardId` (a `cardTraits` entry, or `SHIELD_AGENT_EXT_ID` / `SHIELD_TROOPER_EXT_ID` / `SHIELD_OFFICER_EXT_ID` / `SIDEKICK_EXT_ID`)
- **Describe text:** verbatim WP §Locked Values (five strings); signature unchanged; the two "other" strings carry no count.
- **Markers:** `card-play-ordinal:N`, `played-other-cost:N`, `played-cost:N`, `played-other-distinct-heroes:N` → the four constants; `hero-koed-this-turn` (bare) → Rage; `bystanders-threshold:N` → Savior's `'bystandersInVictoryAtLeast'` literal; `draw-threshold:N` unchanged. All six new names join `HERO_PARSER_RECOGNIZED_MARKER_NAMES`.
- **Apply entries:** the 13 entries on 12 lines in WP §Locked Values, verbatim.
- **Write sites:** `koPileLengthAtTurnStart = G.ko.length` exactly twice, gated on `matchReadsConditionType(G, HERO_KOED_THIS_TURN_CONDITION_TYPE)`: play-phase `turn.onBegin` and `applyOnBeginParity`.
- **Wait-and-see:** only `heroPutIntoKoPileThisTurn` joins `WAIT_AND_SEE_CONDITION_TYPES`.

## Guardrails
- **Hash oracles stay byte-unchanged** (sentinel `finalStateHash`, `PRE_WP080_HASH`). A move is a gating bug. Never re-pin.
- **Play-history conditions evaluate on play** (D-24568 §1 amends D-24377 §1). Never in `WAIT_AND_SEE_CONDITION_TYPES` or `SEQUENCE_GATE_CONDITION_TYPES`.
- **Read the played view, never raw `inPlay`, never a new history.**
- `firstHeroPlayedThisTurn`, `playedThisTurn`, `bystandersInVictoryAtLeast` and the D-24746 text arm are unchanged.
- **Card data only via apply mode**, co2e included. `cards:check` and an apply re-run are zero-diff.
- Each new evaluator case body is a named module-local helper with JSDoc; `evaluateCondition` gains one-line arms.
- Card-name identity reads `G.cardDisplayData`, never a projection.
- **Runtime drift pins only** (D-24372). Existing-pin edits are value-only.
- Feed pins (dashboard, coverage baseline) move only with a regenerated feed, carry a `// why:` and a `Tests-changed:` trailer.

## Required `// why:` Comments
- The `G` field: WP-745 / D-24568, gated lazy lifecycle, why a snapshot is exact (append-only KO pile).
- `onBegin` and `applyOnBeginParity`: before any move of the turn; parity = the `game.ts` mirror for the rebuilt loops.
- Each marker arm: the marker→condition precedent and its timing.
- `WAIT_AND_SEE_CONDITION_TYPES` entry (sticky event, shape #1); `PLAY_HISTORY_CONDITION_TYPES` (play-order gates; amends D-24377 §1; reads the shared played view, D-24798 §5 residual).

## Files to Produce
- `packages/game-engine/src/types.ts`, `hero/heroConditions.evaluate.ts`, `hero/deferredConditionalGrants.ts`, `setup/heroAbility.setup.ts`, `game.ts`, `simulation/onBeginParity.ts` — **modified**
- `packages/game-engine/src/hero/unmarkedConditionalGrants.test.ts` — **new** — WP §H cases 1–8
- `hero/deferredConditionalGrants.test.ts` (keyset + `TRUTHY_FIXTURE`), `hero/heroConditions.evaluate.test.ts` (drift pin) — **modified**; `rules/heroAbility.setup.test.ts`, `setup/heroAbility.setup.test.ts` — **only if** a pin enumerates an extended set
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json` — **modified**
- `data/cards/{msis,vill,anni,ff04,vnom,asrd,co2e,dkcy,rvlt,mgtg,wtif}.json` — regenerated
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` — regenerated (certain; order `ledger:heroes` → `effect-index` → `mechanics:metadata` → `sim:runtime-observed`, then the bundle)
- `docs/ai/coverage/runtime-observed-hollows.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts`, `scripts/coverage/hero-effect-coverage.baseline.json` — **only if** their `:check` fails after the regen

## After Completing
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail; per-package baseline → new counts in the `EC-782:` body.
- [ ] Exit 0: `cards:check`, `cards:count-markers:check`, `ledger:heroes:check`, `effect-index:check`, `mechanics:metadata:check`, `sim:coverage --check`, `sim:runtime-observed:check`, `build-local-spike-bundle.mjs --check`.
- [ ] Apply re-run zero-diff; `koPileLengthAtTurnStart =` grep returns exactly 2.
- [ ] Revert proofs recorded: (a) drop the `onBegin`/parity snapshot → Rage tests fail; (b) put a play-history type in `WAIT_AND_SEE_CONDITION_TYPES` → the drift pin fails; (c) read raw `inPlay` instead of the played view in the other-cost helper → the Out-of-Time cost case fails.
- [ ] `SPEC:` close (same PR): D-24568 Active; STATUS; WORK_INDEX `[x]` + `[live-verify: pending]`; EC_INDEX Done; NUMBER-LEDGER LANDED; mindmap `✅` + `roadmap:counts:write`; `live-verify.json` pending rows; 01.6 post-mortem; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:*:check` 0.
- [ ] Live (D-24026), its own `SPEC:` PR: one card per family on an operator match created after the deploy.

## Common Failure Smells (Optional)
- **Sentinel hash fails.** The snapshot was written ungated.
- **Rage never fires live.** The snapshot is taken outside `onBegin` (e.g. in a move) or is not gated in.
- **Rage fires on a KO'd Wound.** `isHeroCardId` accepts any id.
- **Every KO counts as "this turn" in the sim.** `applyOnBeginParity` is missing the snapshot.
- **Dr. Strange grants on a 4-cost alone.** Only one `played-cost` token landed; the second apply entry must target the same line.
- **`cards:check` passes but co2e is wrong.** co2e is excluded from `cards:check`; check Hawkeye / Black Widow by the apply re-run and the probe.
- **Rage tests pass but the live card never gates.** The test called `applyCardPlay` on a Rage id; drive `playCard` + `resolveSplitFaceChoice('b')`.
- **`sim:coverage` lists a new marker as unsupported.** It is missing from `HERO_PARSER_RECOGNIZED_MARKER_NAMES`.
