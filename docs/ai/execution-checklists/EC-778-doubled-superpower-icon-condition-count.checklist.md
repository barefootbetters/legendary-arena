# EC-778 — Doubled Superpower icons need that many OTHER matching cards (Execution Checklist)

**Source:** docs/ai/work-packets/WP-741-doubled-superpower-icon-condition-count.md
**Layer:** Game Engine

## Before Starting
- [ ] WP-740 / D-24562 landed (`93514f86`). Its surface matches WP §Assumes line refs: `countOtherInPlayMatchingCondition` (evaluate L356, `triggeringCardId` required), `bothConditionCount?` (types L200–206), `countRepeatedBothCondition` (setup ~L2938), `isDigestBothConditionMet` (execute L4853, import L35). Drift: STOP and reconcile the WP.
- [ ] Baseline `origin/main` ≥ `1475218f`; worktree clean; `pnpm install`; then `pnpm -r build` FIRST (stale `dist` fakes results).
- [ ] Baseline green: engine suite, `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check`. Record the engine test count.
- [ ] Scope lock: touched files = `Files to Produce`. Anything else is a FAIL — surface it.

## Locked Values (do not re-derive)
- `HeroCondition.requiredMatches?: number` — absent ≡ 1; emitted only when ≥ 2.
- `LEADING_ICON_PREFIX_PATTERN = /^\s*((?:\[(?:hc|team):[^\]]+\]\s*)+):/` (module constant in `setup/heroAbility.setup.ts`).
- New pure fn `collapseLeadingRepeatedIconConditions(abilityText, conditions): HeroCondition[]`, module-private (tested via `buildHeroAbilityHooks`), called where `conditions` is built (L934, after the heroClass-then-team concat).
- Token map: `hc` → `heroClassMatch`, `team` → `requiresTeam`; values through `normalizeTraitSlug`.
- Evaluator: `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId) >= effectiveRequired`, `effectiveRequired` = `requiredMatches` if integer > 1, else 1. Only `heroClassMatch` / `requiresTeam`. Widen the helper param to `triggeringCardId?: CardExtId` (undefined → skip nothing).
- `isDigestBothConditionMet` becomes `effect.bothCondition !== undefined && evaluateAllConditions(G, playerID, [effect.bothCondition], cardId)`.
- Failed-gate copy (count > 1): `` `it needs ${n} other ${condition.value} Heroes played this turn` ``. Count-1 strings byte-unchanged.
- Play to the Crowd: `bothCondition: {type:'requiresTeam', value:'venomverse', requiredMatches:2}`, NO `bothConditionCount` key; all other WP-740 keys unchanged.
- Real-data sweep expects **35** leading-repeat lines (32 identical + 3 mixed-with-repeats), each built ALONE as a single-ability synthetic card (a lone line has no Digest fusion).
- Parse-example table: WP §Contract (7 rows) — reproduce each as a unit test.
- D-24563 locks 1–6: WP §Contract "D-24563".

## Guardrails
- **Prefix only.** Multiplicity is read from the leading icon run, NEVER from the condition array. Mid-sentence repeats (Arc Reactor, A Day Unlike Any Other, X-Men United, Absorb Energies — 61 lines) stay two plain identical conditions.
- **Collapse rule:** first emitted matching condition gets `requiredMatches: m`; drop the next m − 1 emitted identical ones; extra (mid-sentence) ones stay. Never synthesize a condition the Step 1a/1b suppression flags did not emit.
- **Collapse ordering:** runs right after the L934 concat, before the Empowered param splices (L1027 / L1150, `findFirstHeroClassMatchIndex`). No current repeated-prefix line has Empowered (AC 1 sweep); if one appears, STOP.
- **Omit-when-one:** every hook without a repeated prefix is byte-identical to baseline (sweep-asserted).
- **Distinct conditions are independent:** a multiclass / dual-class / Size-Changing / copied-team card counts toward each distinct icon it matches. Mixed `[X][Y]` behavior unchanged.
- **Self-exclusion by exact instance id** (the helper's existing rule); a second `#N` copy counts.
- **Retire `bothConditionCount` completely** — type field, `countRepeatedBothCondition` + its fusion use, the `isDigestBothConditionMet` count branch + the L35 import (if unused), handler JSDoc, `heroKeywords.ts` L89 comment, `DIGEST_INDIGESTION_CARDS` comment (~L513). `evaluateAllConditions` / `findFailedCondition` signatures untouched.
- **Tests change only for the intended representation change** — exactly WP AC 8's three edits (setup-test L2468 deep-equal; L2472–2482 mixed test retitled, asserting `bothCondition?.requiredMatches === undefined`; execute-test L7271 `crowdHook()`). Never weaken an assertion. The commit body says so.
- **Determinism:** no new G field. Hash pins expected unchanged; if one moves, find which affected hero reached the fixture, then dual re-pin honestly with provenance (`reference_hashed_g_field_dual_repin`). Regenerate `runtime-observed-hollows.json` only if its check fails; re-pin dashboard `totalObs` only if the dashboard suite fails.

## Required `// why:` Comments
- `requiredMatches` field: D-24563 — printed repeated icon = that many OTHER matching cards (rulebook "Critical Hit" L683–696).
- `LEADING_ICON_PREFIX_PATTERN` / collapse fn: D-24563 — prefix-only multiplicity; mid-sentence repeats are prose, not gates (the 61-line guard).
- Evaluator count cases: D-24563 — count via the shared helper; distinct conditions independent (Multiclass).
- `countOtherInPlayMatchingCondition` JSDoc rewritten: optional `triggeringCardId` (undefined → nothing skipped); drop "evaluateCondition answers only 'at least one'" — it is now the caller (D-24563).
- Fusion + handler: D-24563 retires D-24562's `bothConditionCount`; the parser now carries the count on `bothCondition`.

## Files to Produce
- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified**
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified**
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified**
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified (comment-only)**
- `packages/game-engine/src/hero/doubledSuperpowerIcon.test.ts` — **new**
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified**
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** (WP-740 migration)
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** (WP-740 migration)
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated** (conditional; expected)
- (conditional) `apps/dashboard/src/composables/useInPlayCoverage.test.ts`, sentinel fixture, `PRE_WP080_HASH`, `scripts/coverage/hero-effect-coverage.baseline.json` — only if their check fails

## After Completing
- [ ] `pnpm -r build` 0; engine suite green (baseline count + new tests); dashboard + `sequenceTeacher.logic.test.ts` green
- [ ] The six card/coverage `:check`s exit 0
- [ ] `grep -rn "bothConditionCount" packages/game-engine/src` → empty
- [ ] Hash pins unchanged (or dual-re-pinned with provenance)
- [ ] `docs/ai/STATUS.md`; D-24563 Active in `DECISIONS.md` + D-24562 annotated "lock 1 and lock 4's evaluator-untouched clause superseded by D-24563; lock 5 narrowed to mixed distinct-icon lines"; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0
- [ ] `git diff --name-only` ⊆ Files to Produce; two-commit topology (`EC-778:` + `SPEC:`)
- [ ] D-24026 live-verify (post-deploy STATUS-flip), in a match CREATED AFTER the deploy (blobs keep setup-time hooks): Bishop Concussive Blast — one other Ranged → no +3 + count message; two → +3

## Common Failure Smells
- Arc Reactor / A Day Unlike Any Other now needs two others → multiplicity read from the condition array, not the prefix.
- Cyber-Mod or Size-Changing hooks changed → the prefix regex matched a non-leading run (anchor lost).
- Sweep count ≠ 35 → regex drift or a data change; explain before touching the number.
- Card counts itself → self-exclusion dropped; a second copy NOT counted → exclusion by card name instead of `#N` id.
- A mixed `[hc:tech][hc:strength]` card stopped firing with one dual-class other → distinct conditions were pooled instead of counted independently.
- Play to the Crowd "both" fires on one Venomverse → the fusion still reads two conditions or the handler bypasses `evaluateCondition`.
- Core-4 digest hooks changed shape → `requiredMatches` emitted when m = 1.
