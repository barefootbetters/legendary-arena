# EC-827 — Location-restricted attack (Execution Checklist)

**Source:** docs/ai/work-packets/WP-790-location-restricted-attack.md
**Layer:** Game Engine + App arena-client

## Before Starting
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` and `pnpm --filter @legendary-arena/arena-client test` exit 0 (record baselines)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (Before; the client reads the engine's built dist types)
- [ ] Confirm on `main`: `getSpendableAttack` is `attack - spentAttack` (+ recruit when flagged); both fight moves gate and spend through it; no "usable only" handling exists in `heroAbility.setup.ts`
- [ ] EXACT target file set = `## Files to Produce`; any file outside it is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- `export type AttackTargetName = CitySpaceName | 'mastermind';`
- `export interface RestrictedAttackGrant { remaining: number; targets: AttackTargetName[]; sourceCardId: CardExtId }`.
  `targets` is in `CITY_SPACE_NAMES` order, then `'mastermind'`. `TurnEconomy.restrictedAttack?: RestrictedAttackGrant[]` is LAZY.
- `HeroEffectDescriptor.attackRestriction?: { targets: AttackTargetName[]; widenToMastermindWhen?: HeroCondition[] }` (attack effects only).
- Helpers (`economy.logic.ts`, exported from `index.ts`):
  - `addRestrictedAttack(economy, amount, targets, sourceCardId)` — `attack += amount` and appends a grant.
  - `getRestrictedAttackRemaining(economy)`.
  - `getSpendableAttack` = `max(0, attack - spentAttack - getRestrictedAttackRemaining(economy))` (+ recruit when the WP-580 flag is set).
  - `sumRestrictedAttackForTarget(grants, target)`; `getSpendableAttackForTarget(economy, target)`.
  - `spendFightCostForTarget(economy, cost, target)`:
    1. eligible grants narrowest-first (fewest targets, tie by index; decrement `remaining`, add to `spentAttack`);
    2. plain `min(costLeft, attack - spentAttack - getRestrictedAttackRemaining(after step 1))`;
    3. the rest from recruit only when the WP-580 flag is set.
    It NEVER delegates to `spendFightCost`. Invariant `attack - spentAttack >= remaining`. It builds new arrays and
    keeps zero-remaining grants. `spendFightCost` is unchanged. `CarriedTurnFields` gains `restrictedAttack`.
  - `formatAttackTargets(targets)`: `Sewers`/`Bank`/`Rooftops`/`Streets`/`Bridge`/`Mastermind` joined with `" or "`.
- Moves: `fightVillain` target = `citySpaceNameForIndex(cityIndex)` (undefined → silent return); `fightMastermind`
  target = `'mastermind'`. The gate, the EV `+1` check and the spend all use the target-aware helpers.
- Bot: the City loop and the Mastermind check use `getSpendableAttackForTarget` per target.
- Parser:
  - The clause parse is in `parseAbilityText`, only on an attack effect with a Step 2b magnitude. The widen fusion is
    in the `buildHeroAbilityHooks` per-instance line loop (~L3920), after `coalesceCountScaledChooseOne`, against
    `abilityLines[lineIndex - 1]`'s hook.
  - That hook is tracked as `previousLineHook` (set after each per-line push, `null` on every `continue`), never
    `hooks[hooks.length - 1]`. `widenToMastermindWhen` is a fresh copied array, never the follow-up's `conditions`.
  - Clause `/,?\s*usable only against (.+?)\.?$/i`. Targets are `\b(sewers|bank|rooftops|streets|bridge)\b`, plus
    `'mastermind'` for `\b(mastermind|commander)\b`. No target, or the word `other`, means no restriction.
  - Widen (a): `/^\[hc:[a-z]+\]:\s*You may use this bonus \[icon:attack\] against the Mastermind instead\.?$/i`.
  - Widen (b): `/^\[hc:[a-z]+\]:\s*Instead you may get \+(\d+)\[icon:attack\] usable only against the (Mastermind|Commander)\.?$/i`.
    It applies only when N equals the preceding grant's magnitude.
  - A widen applies only when the IMMEDIATELY preceding line of the same card made an `attackRestriction` attack
    effect. It sets `widenToMastermindWhen` to a copy of the follow-up line's conditions. For BOTH (a) and (b), the follow-up
    hook's `attack` effect and keyword are removed (conditions kept), so there is no second grant and no hollow.
- Executor: targets + `'mastermind'` when `evaluateAllConditions(G, playerID, widenToMastermindWhen, cardId)` is
  true. Log `Player ${playerID} gained +${N} attack (only against: ${label}) from ${cardRef}.` (`applied`, card id).
- Projection: `UITurnEconomyState.restrictedAttack?: { remaining: number; targets: AttackTargetName[]; label: string }[]` holds the `remaining > 0`
  grants in grant order, is omitted when empty, and reaches the ACTIVE player only (beside
  `recruitSpendableAsAttack`). Build and filter copy `[...grant.targets]`.
- Client:
  - `canFight(cost, economy, target?)` / `canFightWithExcessiveViolence(cost, economy, target?)` compare against
    `availableAttack + sumRestrictedAttackForTarget(economy.restrictedAttack ?? [], target)`; the reason text uses
    that figure.
  - CityRow passes `citySpaceNameForIndex(cell.cityIndex)` at all three calls (~L119 enable / ~L140 cost-short badge /
    EV ~L169). MastermindTile passes `'mastermind'` at all three (~L119 / ~L145 / EV ~L213).
  - EconomyBar chip: `data-testid="economy-restricted-attack"`, text `+{{ remaining }} only against: {{ label }}`.

## Guardrails
- Lazy field: absent until granted, carried only when present, never in `resetTurnEconomy` / `REDACTED_ECONOMY`.
- One eligibility definition: the engine helpers. The client calls the exported `sumRestrictedAttackForTarget`, never its own rule.
- Parser fails closed: an unrecognized clause or `other` parses as today (Karma unchanged).
- Existing tests pass WITHOUT edits, EXCEPT the one authorized edit: `heroEffects.dispatchable.test.ts` ~L242 (Storm
  Tidal Wave). Its magnitude assertion becomes "no `attack` effect" and its header comment (~L7–8, ~L18) is updated;
  the fixture and the two `=== false` assertions are kept. Say so in the EC commit body. The dashboard totalObs pin
  may move ONLY if the sweep feed regenerates. Any other failing existing test → STOP and report.
- Sentinel `finalStateHash` / `PRE_WP080_HASH` byte-unchanged; a moved oracle is a leak, never a re-pin.
- Session protocol: a restricted parse outside the WP Context table (or a table line that fails to parse) → STOP and report.
- No `.reduce()` in the spend/sum helpers; explicit `for...of`.

## Required `// why:` Comments
- `restrictedAttack` field + `addRestrictedAttack`: printed "usable only against" attack (rules v23 Liberate entry); it stays inside `attack`, so totals and "attack made" conditions count it (D-24652).
- `getSpendableAttack` exclusion and the `max(0, …)` clamp.
- `spendFightCostForTarget` narrowest-first order: keeps the flexible attack for later fights; deterministic, so no prompt.
- The clause parse + fail-closed rule; each widen fusion (Electro "Instead" is one grant, not two; the split approximation, D-24652).
- `fightVillain` target from `citySpaceNameForIndex` (fail closed on an unknown index).
- The projection build + the active-only filter pass-through (Board-Visible Field Rule).
- The client target pass-through (the served figure must match the engine gate).

## Files to Produce
- `packages/game-engine/src/economy/{economy.types,economy.logic}.ts` — **modified** — types, lazy field, helpers
- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified** — `attackRestriction`
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — clause parse + widen fusion
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — restricted grant branch
- `packages/game-engine/src/moves/{fightVillain,fightMastermind}.ts` — **modified** — target-aware gate/spend
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — **modified** — per-target affordability
- `packages/game-engine/src/ui/{uiState.types,uiState.build,uiState.filter}.ts` — **modified** — `restrictedAttack`
- `packages/game-engine/src/index.ts` — **modified** — exports incl. `citySpaceNameForIndex` / `CitySpaceName`
- `apps/arena-client/src/composables/useCardCostGating.ts`, `components/play/{CityRow,MastermindTile,EconomyBar}.vue` — **modified**
- Tests **new**: `packages/game-engine/src/economy/economy.restrictedAttack.test.ts`, `packages/game-engine/src/hero/heroEffects.restrictedAttack.test.ts`
- Tests **modified**: `packages/game-engine/src/{setup/heroAbility.setup,moves/fightVillain,moves/fightMastermind,simulation/ai.legalMoves,ui/uiState.build,ui/uiState.filter,ui/uiState.types.drift,hero/heroEffects.dispatchable}.test.ts` (the last one: the authorized ~L242 edit only),
  `apps/arena-client/src/composables/useCardCostGating.test.ts`, `apps/arena-client/src/components/play/{CityRow,MastermindTile,EconomyBar}.test.ts`
- Generated, ONLY with a real gate diff: `scripts/coverage/hero-effect-coverage.baseline.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `data/metadata/{effect-implementation-index,card-mechanics}.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (totalObs pin only, after `prebuild:coverage` regenerates the feed)
- `docs/ai/{STATUS,DECISIONS}.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] Engine + client suites 0 fail; before/after counts recorded; arena-client vue-tsc exits 0 (After)
- [ ] 7/7 revert proofs: (a) clause parse, (b) widen fusion, (c) spendable exclusion, (d) per-target spend order, (e) fight-move target wiring, (f) projection build/pass-through, (g) client target pass-through
- [ ] `replayFixtures.test.ts` green + `git diff --exit-code -- packages/game-engine/src/test/fixtures/games` exits 0
- [ ] `sim:runtime-observed:check`, `sim:coverage --check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check` OK (or regenerated, diff explained)
- [ ] Run the engine suite right after the parser change (the empirical scaffold); record the result
- [ ] `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 failures; `git status --porcelain` ⊆ Files to Produce
- [ ] Live (D-24026): co2e Storm Lightning Bolt shows `+2 only against: Rooftops`; Rooftops Fight enables, Sewers/Mastermind stay disabled; diagnostics `uiStateSnapshot` carries `economy.restrictedAttack`; matchId in STATUS.md
- [ ] STATUS.md updated; D-24652 authored in DECISIONS.md as Active with the WP §D-24652 Content five points
- [ ] WORK_INDEX WP-790 `[x]` with date; EC_INDEX EC-827 → Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write` + `:check` exit 0

## Common Failure Smells
- Fusion lands on a digest/EV/day-night hook → `hooks[hooks.length - 1]` used instead of `previousLineHook`.
- Fight button enabled but the click does nothing → the client passes no target (or the wrong index mapping) while the engine gate is target-aware.
- Shocking Robbery still gives +6, or a Ranged Storm/Electro play logs a hollow line → the follow-up hook's attack effect was not removed.
- Invariant walk fails, or a grant for another target shrinks while recruit pays less → step 2 used `attack - spentAttack` without subtracting `remaining`.
- Storm's bonus never reaches the Mastermind → the widen conditions are not evaluated at grant time.
- Sentinel hash moved → `restrictedAttack` materialized on a non-restricted grant or in `resetTurnEconomy`.
- Opponents see your restricted chips → the filter copied the field outside the active-player branch.
- Bot FAULTs or never fights with restricted attack → `ai.legalMoves` still uses one global `spendableAttack`.
