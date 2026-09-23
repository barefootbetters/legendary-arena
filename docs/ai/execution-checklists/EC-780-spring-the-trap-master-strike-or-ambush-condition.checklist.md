# EC-780 — Spring the Trap / Grief: Master Strike (or Ambush) this-turn gate (Execution Checklist)

**Source:** docs/ai/work-packets/WP-743-spring-the-trap-master-strike-or-ambush-condition.md
**Layer:** Game Engine (`packages/game-engine/src/**`) + card data via the curated hero-ability-marker map
**Status:** Pending

## Before Starting
- [ ] Fresh worktree off `origin/main`. Run `pnpm install` then `pnpm -r build` (exit 0). Record the engine-suite baseline (`pnpm --filter @legendary-arena/game-engine test`).
- [ ] Re-confirm the two cards are free grants: `buildHeroAbilityHooks` gives `spring-the-trap#0` and `grief#0` with **no** `conditions`.
- [ ] Read:
  - `villainDeck/villainDeck.reveal.ts` L195–720
  - `hero/heroConditions.evaluate.ts` (the `defeatedVillainOrMastermindThisTurn` cases)
  - `hero/deferredConditionalGrants.ts` L1–80
  - `setup/heroAbility.setup.ts` ~L1225–1296
  - `game.ts` ~L798–818
  - `simulation/onBeginParity.ts`
  - `diamondForm.overfire.test.ts`
- [ ] Scope lock: only the files in Files to Produce. The conditional files are touched only when their named `:check` reports drift. Anything else → STOP.

## Locked Values (do not re-derive)
- **G fields** (optional, lazy): `masterStrikePlayedThisTurn?: boolean`, `ambushVillainPlayedThisTurn?: boolean`. They are never written as `false`.
- **Condition types:** `masterStrikePlayedThisTurn` (Grief) and `masterStrikeOrAmbushPlayedThisTurn` (Spring the Trap). Exported constants:
  - `MASTER_STRIKE_THIS_TURN_CONDITION_TYPE`
  - `MASTER_STRIKE_OR_AMBUSH_THIS_TURN_CONDITION_TYPE`

  `value` is `'1'`, and it is unused.
- **Evaluate:**
  - Grief → `G.masterStrikePlayedThisTurn === true`
  - Spring → `G.masterStrikePlayedThisTurn === true || G.ambushVillainPlayedThisTurn === true`
- **Describe text:**
  - `it needs a Master Strike played this turn`
  - `it needs a Master Strike or a Villain with an Ambush ability played this turn`
- **Markers:** `[keyword:master-strike-this-turn]` (msis `wanda-vision`/`grief`, abilityIndex 0) and `[keyword:master-strike-or-ambush-this-turn]` (vnom `venom-rocket`/`spring-the-trap`, abilityIndex 0). Both are single-segment.
- **Helper:** `matchReadsConditionType(G, conditionType: string): boolean` in `heroConditions.evaluate.ts`: an explicit `for…of` over `G.heroAbilityHooks ?? []` and each hook's `conditions ?? []`.
- **Write sites:** both are in `performVillainReveal` only.
  - Ambush: inside `if (cardHasAmbush)` (~L466), **before** The Leader's `playTopVillainDeckCards`, when the match reads `masterStrikeOrAmbushPlayedThisTurn`.
  - Master Strike: **immediately after** the `strikePile` append (~L672), when the match reads **either** type.
- **Wait-and-see:** both types are appended to `WAIT_AND_SEE_CONDITION_TYPES` (shape #1, one-shot).
- **Reset:** guarded `delete` of both flags in the play-phase turn `onBegin` (beside the WP-656 delete) **and** in `applyOnBeginParity` (`simulation/onBeginParity.ts`), so the three rebuilt turn loops reset them too.

## Guardrails
- **Hash oracles stay byte-unchanged.** A moved sentinel `finalStateHash` or `PRE_WP080_HASH` is a gating bug to fix. Never re-pin.
- **Only the two write sites.** No flag writes in moves, scheme resolvers, or mastermind handlers.
- **No new move and no new `onMove` resolve call.** The existing deferred-grant resolution fires the grant.
- **Card data is regenerated through apply mode**, never hand-edited. `cards:check` reproduces the bytes.
- **Class gates keep on-play evaluation.** Only the two new types join `WAIT_AND_SEE_CONDITION_TYPES`.
- **Runtime drift pins only** (D-24372). No `any`, `@ts-ignore`, or widened production type. Any existing-pin edit is a value-only extension.
- **A regenerated derived artifact** is committed only when its `:check` reports drift. The `useInPlayCoverage.test.ts` `totalObs` re-pin is paired with the feed regen and carries a `Tests-changed:` trailer.

## Required `// why:` Comments
- Each new `G` field on `LegendaryGameState`: WP-743 / D-24566; the lazy/gated lifecycle and the oracle-safety reason.
- Each write site in `performVillainReveal`: why it is gated (games without a reading hook stay byte-unchanged, the D-24467 posture). These comments must **not** contain the literal `PlayedThisTurn = true`, or the exactly-2 grep miscounts.
- The `onBegin` and `applyOnBeginParity` guarded deletes: the per-turn window, why they are guarded, and (in parity) that they mirror `game.ts` for the rebuilt loops.
- Each marker arm in `heroAbility.setup.ts`: the marker→condition precedent (D-24467).
- The `WAIT_AND_SEE_CONDITION_TYPES` entries: a sticky per-turn predicate is a count ≥ 1 threshold (extends D-24377).

## Files to Produce
- `packages/game-engine/src/types.ts` — **modified** — two lazy flags
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified** — gated writes
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — constants, cases, helper
- `packages/game-engine/src/hero/deferredConditionalGrants.ts` — **modified** — wait-and-see members
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — two marker arms
- `packages/game-engine/src/game.ts` — **modified** — `onBegin` deletes
- `packages/game-engine/src/simulation/onBeginParity.ts` — **modified** — the same deletes, plus the module/function JSDoc naming them
- `packages/game-engine/src/hero/masterStrikeOrAmbushCondition.test.ts` — **new** — the WP §I 1–8 cases
- `packages/game-engine/src/hero/deferredConditionalGrants.test.ts` — **modified** — keyset + `TRUTHY_FIXTURE` extension
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts`, `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified only if** a pin enumerates the extended set
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `scripts/convert-cards/apply-hero-ability-markers.mjs`, `scripts/hero-mechanic-ledger.mjs` — **modified**
- `data/cards/vnom.json`, `data/cards/msis.json` — **modified** — regenerated
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `scripts/coverage/hero-effect-coverage.baseline.json` — **modified** — regenerated (the new marker tokens are certain universe growth; confirm the diff is only these two cards)
- **Conditional (drift only):**
  - `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`
  - `docs/ai/coverage/runtime-observed-hollows.json` plus the paired `apps/dashboard/src/composables/useInPlayCoverage.test.ts` pin

## After Completing
- [ ] `pnpm -r build` exits 0. The engine suite is green; record baseline → new counts in the `EC-780:` commit body.
- [ ] Every one of these exits 0:
  - `cards:check`
  - `ledger:heroes:check`
  - `effect-index:check`
  - `mechanics:metadata:check`
  - `sim:coverage --check`
  - `sim:runtime-observed:check`
- [ ] A re-run of `apply-hero-ability-markers.mjs` is zero-diff. The `PlayedThisTurn = true` grep in `villainDeck.reveal.ts` returns exactly 2.
- [ ] Live (D-24026): a Venom Rocket match's log shows Spring the Trap granting only on a Master Strike or Ambush turn. Record it in STATUS.
- [ ] Governance:
  - STATUS updated
  - DECISIONS D-24566 Active
  - WORK_INDEX `[x]`; EC_INDEX Done
  - mindmap `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- **The sentinel hash test fails.** A flag was written ungated, or written as `false`.
- **Spring the Trap still grants on a Bystander-only turn.** The marker arm is missing or sits after the unresolved-marker fallback. Also check the apply entry's `abilityIndex`.
- **Flags leak across turns in the sim / PAR** (Spring the Trap grants every turn after the first strike). `applyOnBeginParity` is missing the deletes.
- **The reset test passes but `game.ts` has no delete.** The test hand-deletes the flags instead of invoking the real `turn.onBegin`.
- **Mid-turn strike never grants.** The type is not in `WAIT_AND_SEE_CONDITION_TYPES`, or the Master Strike write is gated on only one of the two types.
- **It grants twice on two strikes.** A re-arm was added, as if this were the WP-656 repeatable shape. This one is shape #1.
- **`cards:check` fails.** The data was hand-edited, or the token is missing from the apply-script allowlist.
