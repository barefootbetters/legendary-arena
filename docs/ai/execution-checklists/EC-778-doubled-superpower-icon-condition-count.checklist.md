# EC-778 — Doubled Superpower icons need that many OTHER matching cards (Execution Checklist)

**Source:** docs/ai/work-packets/WP-741-doubled-superpower-icon-condition-count.md
**Layer:** Game Engine

## Before Starting
- [ ] **WP-803 / EC-840 (#2734) has merged to `main`.** The two share production files and execute sequentially (01.0b), and AC 6 consumes WP-803's ledger. Fetch, then branch off that `main`.
- [ ] Run `pnpm install`, then `pnpm -r build` first: a stale `dist` fakes results. Record the counts:
  - engine suite: expect about 5136 / 0
  - runtime-observed: expect about 7834
  - dashboard pin: expect about `totalObs 8755` / `percentResolved 14.1`
- [ ] Re-read the WP §Assumes anchors by **symbol**:
  - `countOtherInPlayMatchingCondition`
  - `bothConditionCount?`
  - `countRepeatedBothCondition` and both of its fusion callers
  - `isDigestBothConditionMet` and its import
  - `LEADING_GATE_PREFIX_PATTERN` / `leadingGatePrefixMatch`
  - the concat
  - the Empowered splices
  - `describeFailedCondition`

  For this anchor check, STOP only on a missing or changed symbol or signature; line movement alone is fine. The WP §Session-protocol STOP triggers still apply.
- [ ] Baseline green: the engine suite, `cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `sim:runtime-observed:check` and `sim:coverage --check`.
- [ ] Scope lock: the touched files must be ⊆ `Files to Produce`. Anything else is a FAIL — surface it.

## Locked Values (do not re-derive)
- **`HeroCondition.requiredMatches?: number`.** Absent ≡ 1. Emitted only when ≥ 2.
- **Prefix source.** Use the existing D-24628 match, `leadingGatePrefixMatch?.[0] ?? ''`, where `LEADING_GATE_PREFIX_PATTERN = /^\s*(?:\[(?:hc|team):[^\]]+\]\s*)+:/`. Add no new prefix regex, and do not widen this one.
- **New pure fn `collapseLeadingRepeatedIconConditions(gatePrefix, conditions): HeroCondition[]`.**
  - Module-private; tested via `buildHeroAbilityHooks`.
  - Called right after the class-then-team concat.
  - Tokenizes with **fresh** `new RegExp(HERO_CLASS_PATTERN.source, 'g')` / `TEAM_PATTERN` instances (or `matchAll`). The shared `/g` constants carry `lastIndex`.
- **Token map.** `hc` → `heroClassMatch`, `team` → `requiresTeam`. Values go through `normalizeTraitSlug`.
- **Evaluator.**
  - Only `heroClassMatch` / `requiresTeam` count: `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId) >= effectiveRequired`.
  - `effectiveRequired` is `requiredMatches` if it is an integer > 1, else 1.
  - Widen the helper parameter to `triggeringCardId?: CardExtId` (undefined → skip nothing).
  - Counts read `playedCardIdsThisTurn`, never `playedCardIdsStillInPlay`.
- **`isDigestBothConditionMet`** becomes `effect.bothCondition !== undefined && evaluateAllConditions(G, playerID, [effect.bothCondition], cardId)`.
- **Failed-gate copy (count > 1):** `` `it needs ${n} other ${condition.value} Heroes played this turn` ``. The count-1 strings and the "Its effect is not supported yet." tail are byte-unchanged.
- **Fused effects.** Neither carries a `bothConditionCount` key; all other keys are unchanged.
  - Play to the Crowd: `bothCondition: {type:'requiresTeam', value:'venomverse', requiredMatches:2}`
  - Nanite: `bothCondition: {type:'requiresTeam', value:'x-men', requiredMatches:4}`
- **Real-data sweep:** expects **35** leading-repeat lines. Each is built ALONE as a single-ability synthetic card, and the test carries its own literal copy of the prefix pattern.
- **Parse table:** WP §Contract, 8 rows. Each row becomes a unit test that uses its full printed line. The Victoria Hand row is ONE count-3 condition.
- **D-24563 locks 1–6:** as in WP §Contract "D-24563", including the Penumbra two-faces reading (for Jeff to confirm at close).

## Guardrails
- **Prefix only.** Multiplicity is read from the leading icon run, NEVER from the condition array. These still-doubling landmines keep two plain identical conditions: Arc Reactor (core + msp1), Absorb Energies, Radiation Focus Array, and the Cyber-Mod lines.
- **Collapse rule.**
  - The first emitted matching condition gets `requiredMatches: m`.
  - The next m − 1 emitted identical conditions are dropped.
  - Extra mid-sentence ones stay.
  - If fewer than m are emitted, leave them untouched.
  - Survivors keep their relative order.
  - Never synthesize a condition that was not emitted.
- **Ordering.** The collapse runs before the Empowered splices. If a repeated-prefix line has Empowered, STOP.
- **Omit-when-one.** Every hook without a repeated prefix is byte-identical to baseline (sweep-asserted).
- **Distinct conditions are independent** (Multiclass). Self-exclusion is by exact instance id; a second `#N` copy counts.
- **Retire `bothConditionCount` everywhere.** That covers:
  - the type field
  - `countRepeatedBothCondition` and both fusion uses
  - the digest count branch and its import
  - both handler JSDocs (day-night is JSDoc-only)
  - the `heroKeywords.ts` comment and the two allowlist comments

  The `evaluateAllConditions` / `findFailedCondition` signatures stay untouched.
- **Tests change only for the representation change.** Exactly the five WP AC 9 migrations:
  1. the fused deep-equal
  2. the mixed "both" test (retitled)
  3. `crowdHook()`
  4. the Nanite fusion assert and its title
  5. `bodyTeamTokenGate.test.ts` Reassign

  Never weaken an assertion. The commit carries a `Tests-changed:` trailer naming all five.
- **Determinism.** No new `G` field.
  - A hash pin that moves → find which affected hero reached the fixture, then dual re-pin with provenance.
  - Runtime-observed falls or holds; a rise is diagnosed, not re-pinned.
  - Re-pin the dashboard only if its suite fails after the full prebuild chain.

## Required `// why:` Comments
- **`requiredMatches` field:** D-24563 — a printed repeated icon means that many OTHER matching cards (rulebook L683–696).
- **Collapse fn:** D-24563 — the prefix is the only source of multiplicity (reusing the D-24628 match). Mid-sentence repeats are prose, not gates.
- **Evaluator count cases:** D-24563 — shared helper; distinct conditions are independent; set-aside Out of Time cards count (L3443–3446).
- **`countOtherInPlayMatchingCondition` JSDoc:** `triggeringCardId` is optional (undefined → nothing skipped). Drop the "answers only 'at least one'" claim.
- **Both fusions + handlers:** D-24563 — the count now rides `bothCondition.requiredMatches`; the old WP-740 descriptor count field is retired. Never spell the retired field name in source or tests (AC 10's grep must stay empty).

## Files to Produce
- `packages/game-engine/src/rules/heroAbility.types.ts`, `setup/heroAbility.setup.ts`, `hero/heroConditions.evaluate.ts`, `hero/heroEffects.execute.ts` — **modified**
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified (comment-only)**
- `packages/game-engine/src/hero/doubledSuperpowerIcon.test.ts` — **new**
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts`, `setup/heroAbility.setup.test.ts`, `rules/heroAbility.setup.test.ts`, `hero/heroEffects.execute.test.ts`, `hero/bodyTeamTokenGate.test.ts` — **modified**
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated** (conditional; expected)
- (conditional) `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (expected), the sentinel fixture, `PRE_WP080_HASH`, `scripts/coverage/hero-effect-coverage.baseline.json` — only if their check fails
- `docs/ai/post-mortems/01.6-WP-741-doubled-superpower-icon-condition-count.md` — **new** (mandatory 01.6)
- Governance close (`SPEC:` commit): `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## After Completing
- [ ] `pnpm -r build` → 0. Engine suite green. `pnpm -r --no-bail test` → 0 fail. Dashboard `test:coverage` + `typecheck` green after the prebuild chain. `sequenceTeacher.logic.test.ts` green. All six card/coverage `:check`s → 0.
- [ ] `grep -rn "bothConditionCount" packages/game-engine/src` → empty. Hash pins unchanged, or dual-re-pinned with provenance.
- [ ] Governance close:
  - the 01.6 post-mortem
  - `docs/ai/STATUS.md`
  - D-24563 Active, plus annotations on D-24562 / D-24598 / D-24628 / D-24692 (lock 10)
  - WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` → 0
- [ ] `git diff --name-only` ⊆ Files to Produce. Two-commit topology: `EC-778:` + `SPEC:`.
- [ ] D-24026 live-verify: a post-deploy STATUS-flip, in a match CREATED AFTER the deploy. Bishop's Concussive Blast: one other Ranged → no +3 plus the count message; two → +3.

## Common Failure Smells
- Arc Reactor or Absorb Energies now needs two others → multiplicity came from the condition array.
- Cyber-Mod or Size-Changing hooks changed → a non-leading run matched.
- Sweep count ≠ 35 → a data change or a re-implemented prefix match. Explain it before touching the number.
- A card counts itself, or a second `#N` copy is not counted → exclusion by name instead of by exact id.
- A mixed `[hc:tech][hc:strength]` card stops firing with one dual-class other → distinct conditions were pooled.
- Play to the Crowd or Nanite "both" fires off one card → a fusion still reads repeated conditions.
- Core-4 digest or other day-night hooks changed shape → `requiredMatches` was emitted at m = 1.
- A collapse result differs between two otherwise identical calls → a shared `/g` regex was reused.
