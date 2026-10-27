# EC-863 — Stealth Assault Squad Costed S.H.I.E.L.D. Gate (Execution Checklist)

**Source:** docs/ai/work-packets/WP-825-stealth-assault-squad-costed-shield-gate.md
**Layer:** Game Engine (`rules/` contract field, `hero/` evaluator, `setup/` parser)

## Before Starting
- [ ] `HeroCondition` is `{ type; value; requiredMatches? }` (`rules/heroAbility.types.ts` ~L95-104).
- [ ] `countOtherInPlayMatchingCondition` (~L454), `effectiveRequiredMatches` (~L423), `describeFailedCondition` (~L785) and `heroConditionHoldsForInPlay` (~L976) are as WP Assumes 2 describes (`hero/heroConditions.evaluate.ts`).
- [ ] `collapseLeadingRepeatedIconConditions(...)` builds `conditions` at ~L1330 and `PLAYED_OTHER_CARDS_THRESHOLD_PATTERN` is at ~L535 (`setup/heroAbility.setup.ts`).
- [ ] `G.cardStats` has `cost: 0` rows for the Agent / Trooper and `cost: 3` for the Officer (`setup/buildInitialGameState.ts` ~L542-557).
- [ ] `bodyTeamTokenGate.test.ts` ~L94 pins this line's conditions without a floor.
- [ ] The drafting scaffold is evidence only; re-author from Locked Values.
- [ ] Scope lock: §Files to Produce, plus a derived artifact only if its AC 4 `:check` reports stale (record why in D-24758). co2e is in neither sweep, so none is expected; any other file is a blocker.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; record the engine test total.

## Locked Values (do not re-derive)
- **Contract field** (`rules/heroAbility.types.ts`, on `HeroCondition` after `requiredMatches?`): `minimumCost?: number;`.
- **Effective floor** (`hero/heroConditions.evaluate.ts`, beside `effectiveRequiredMatches`): `function effectiveMinimumCost(condition: HeroCondition): number` returns `condition.minimumCost` when it is a number, an integer and `>= 1`, else `0`.
- **Counter** (`countOtherInPlayMatchingCondition`): compute `const minimumCost = effectiveMinimumCost(condition);` before the loop. After the team / class match, `if (isMatch && minimumCost > 0) { const cost = G.cardStats?.[cardId]?.cost ?? 0; isMatch = cost >= minimumCost; }`.
- **Wording** (`describeFailedCondition`, `heroClassMatch` / `requiresTeam` case): compute `const minimumCost = effectiveMinimumCost(condition);` beside `requiredMatches`.
  - Plural branch (`requiredMatches > 1`): `const pluralCostClause = minimumCost > 0 ? \` that cost ${minimumCost} or more\` : '';` then `` `it needs ${requiredMatches} other ${condition.value} Heroes${pluralCostClause} played this turn` ``.
  - Singular: `const costClause = minimumCost > 0 ? \` that costs ${minimumCost} or more\` : '';` then `` `it needs another ${condition.value} Hero${costClause} played this turn` ``.
- **Teacher scope-out** (`heroConditionHoldsForInPlay`, after the size-changing / copy-powers loop): `if (effectiveMinimumCost(condition) > 0) { return 'unsupported'; }`.
- **Parser pattern** (`setup/heroAbility.setup.ts`, after `PLAYED_OTHER_CARDS_THRESHOLD_PATTERN`):
  `const ANOTHER_TEAM_HERO_COST_FLOOR_PATTERN = /\bif you played another\s*\[team:([^\]]+)\]\s*Hero that costs (\d+) or more this turn\b/i;`
- **Parser helper:** `function applyAnotherTeamHeroCostFloor(abilityText: string, conditions: HeroCondition[]): void`.
  - No match → return.
  - `teamSlug = normalizeTraitSlug(match[1])`; `minimumCost = parseInt(match[2], 10)`; not an integer `>= 1` → return.
  - Set `minimumCost` on the FIRST `requiresTeam` condition whose `value === teamSlug`, then return.
  - Called once, right after `const conditions = collapseLeadingRepeatedIconConditions(...)`.
  - It mutates only the array `collapseLeadingRepeatedIconConditions` returned in the same `parseAbilityText` call, before that array is attached to any hook or descriptor. Never call it on `hook.conditions` or on a shared constant.
- **Existing pin:** `bodyTeamTokenGate.test.ts` L94's expected conditions become `[{ type: 'requiresTeam', value: 'shield', minimumCost: 1 }]`.

## Guardrails
- Absent ≡ no floor: no other hook, fixture or consumer changes behavior.
- One counting primitive: the floor lives only in `countOtherInPlayMatchingCondition`.
- No card-data change (`data/cards/*.json`, `hero-ability-markers.json` untouched) and no `apps/server` change.
- Pure read: the evaluator reads `G` only, never mutates, never throws.
- Hash oracles byte-identical; if one moves, STOP and explain before any re-pin.
- `rules/heroAbility.types.ts` is a contract file: the field lands with D-24758.
- The L94 pin stays an exact `assert.deepEqual` on the full conditions array (no partial / `includes` match); the `EC-863:` commit body names it as an intentional behavior change under D-24758.

## Required `// why:` Comments
- `HeroCondition.minimumCost`: WP-825 / D-24758; the printed clause; the starters' cost-0 rows; absent ≡ no floor; only the two gate types honor it.
- The counter floor: the `G.cardStats` read; Agent / Trooper cost 0, Officer cost 3; `?? 0` for no row.
- The wording: the log names why a starter didn't count.
- The teacher scope-out: its slice has no `cardStats` (false whiff otherwise).
- `ANOTHER_TEAM_HERO_COST_FLOOR_PATTERN`: the card, the Step 1b gate it refines, the D-24746 precedent.

## Files to Produce
- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified** (one optional field)
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified**
- `packages/game-engine/src/hero/stealthAssaultSquadCostedGate.test.ts` — **new** (T1-T10)
- `packages/game-engine/src/hero/bodyTeamTokenGate.test.ts` — **modified** (one expected value)
- `docs/ai/post-mortems/01.6-WP-825-stealth-assault-squad-costed-shield-gate.md` — **new** (01.6, a new contract field)
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] T1-T10 pass; engine delta +10 tests / +2 suites.
- [ ] Revert proofs observed: no parser helper call → T1 / T2 / T5 / T6 fail; no counter floor → T2 / T5 / T6 / T7 fail; no teacher scope-out → T10 fails; no cost clause in the wording → T6 / T9 fail; source restored.
- [ ] `pnpm cards:check`, `pnpm cards:count-markers:check`, `pnpm ledger:heroes:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check` → 0 (regenerate only what reports stale; record why).
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.
- [ ] 01.6 post-mortem at `docs/ai/post-mortems/01.6-WP-825-stealth-assault-squad-costed-shield-gate.md`, before the `EC-863:` commit (a new contract field).
- [ ] D-24758 Active. STATUS updated. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅` + `pnpm roadmap:counts:write`. `roadmap:counts:check`, `ledger:numbers:check` → 0.
- [ ] Allowlist-only diff (`git status --porcelain`; revert `lagn-v1.json` CRLF churn). Two-commit topology `EC-863:` then `SPEC:`.
- [ ] Live-verify (D-24026), operator-pending until seen: a NEW 2-player operator match on `play.legendary-arena.com` (gitSha checked; pre-deploy matches keep the old gate) with co2e Nick Fury: the Squad after an Agent gives no +2 and logs the cost floor; after an Officer or another costed S.H.I.E.L.D. Hero it gives +2.

## Common Failure Smells
- The Squad still gets +2 after only starters → the helper isn't called, or the pattern missed the line (check the `\s*` around `[team:shield]`).
- An Officer doesn't unlock it → the floor read the wrong id (not the played `cardId`), or the fixture lacks the Officer's `{ cost: 3 }` row.
- Some other card's gate changed → the floor was applied without `minimumCost > 0`, or `effectiveMinimumCost` returned non-zero for an absent field.
- The coach starts flagging Stealth Assault Squad whiffs → the teacher scope-out is missing.
- A hash oracle moved → STOP; no hashed fixture plays co2e Nick Fury's Squad.
