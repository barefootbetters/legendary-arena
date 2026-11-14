# EC-931 — Put to the Torch: gain a Wound for Rooftops Conqueror 4 (Execution Checklist)

**Source:** docs/ai/work-packets/WP-893-put-to-the-torch-conqueror-reward.md
**Layer:** Game Engine + Card Data
**Risk Tier:** MEDIUM — gameplay rules on one hero card (a hollow line starts working), one reward arm and bot answer, a comment-only contract-file edit, card data and derived feeds; no auth, money, persistence or server surface

## Before Starting
- [ ] Baseline `origin/main` includes #3344 (the reserve), the WP-893 draft SPEC, WP-885 (#3321) and WP-886 (#3297).
- [ ] `pnpm install` and `pnpm -r build` → 0. Engine suite green (7037 / 0 at draft). `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
- [ ] Anchors: `heroAbility.setup.ts` seeded sets `:499` / `:509`, Step 2g `:2320-2345`, descriptor arm `:2934`, fallback `:3101`; `heroAbility.types.ts` `rewardComposition` `:152-157`; stale comments `heroAbility.setup.ts:932-938`, `heroKeywords.ts:125`, `heroEffects.execute.ts:7479-7482`, `gainWoundRewardGrant.ts:10-14`; `types.ts` `GainWoundReward` `:1662` (`rewardType` `:1667`).
- [ ] Anchors: `gainWoundReward.logic.ts` sets `:45` / `:54`, choice `:68`, builder `:252`; `gainWoundRewardGrant.ts` phrases `:60`, grant `:130` (switch `:161`), forfeit `:324`; `heroConditions.evaluate.ts` constant `:80`, `evaluateCondition` `:210`, `describeFailedCondition` `:1016`; bot `ai.seatChoice.ts:352` (switch `:361`); tests `heroAbility.setup.test.ts:2773`, `ai.seatChoice.test.ts:573`.
- [ ] Re-probe Put to the Torch line 2: today an empty hook with `unresolvedMarkers ['rooftops-conqueror']`.
- [ ] Scope lock: the file set is exactly §Files to Produce; anything else needs an inline amendment (01.5).

## Locked Values (do not re-derive)
- Marker `anni/super-skrull/put-to-the-torch`[2] `[keyword:gain-wound-reward:rooftops-conqueror:4]` (new row at the top of the `anni` array). No validator change.
- `GainWoundReward.rewardType` adds `'rooftops-conqueror'`; no field added.
- `GAIN_WOUND_REWARD_SEEDED_CONQUEROR_REWARDS: ReadonlySet<string> = new Set<string>(['rooftops-conqueror'])` in the parser and `gainWoundReward.logic.ts`.
- Step 2g third arm (after the composition arm): seeded + n ≥ 1 → push `gain-wound-reward`, set magnitude, `gainWoundRewardComposition = candidate`. Descriptor `{ type: 'gain-wound-reward', magnitude: 4, rewardComposition: 'rooftops-conqueror' }`. No pre-scan change.
- `rewardComposition` comment: names a `gain-wound-reward` reward that is not a `HeroKeyword` (composition marker, D-24031; Conqueror bonus, D-24850). Type stays `string`.
- Builder composition path: `GAIN_WOUND_REWARD_SEEDED_COMPOSITIONS.has(rewardComposition) && rewardComposition === 'berserk'` (unchanged) or `GAIN_WOUND_REWARD_SEEDED_CONQUEROR_REWARDS.has(rewardComposition) && rewardComposition === 'rooftops-conqueror'` → `{ rewardType: 'rooftops-conqueror', magnitude, sourceCardId }`; restructure the `:271` early return so the branch is reachable. No `as` casts.
- Phrases: label `you get Rooftops Conqueror {N}`; log `get Rooftops Conqueror {N}`. No `G` read.
- Grant arm (after N4 / N7): condition `{ type: CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE, value: 'rooftops' }` (fresh literal); `evaluateCondition(G, recipientID, condition)` true → `G.turnEconomy = addResources(G.turnEconomy, reward.magnitude, 0)` + C1 `Player {p} got +{N} Attack — a Villain is in the Rooftops ({card}).` [applied]; false → C2 `Player {p} got no Attack — {describeFailedCondition(G, recipientID, condition)} ({card}).` [blocked]. The Wound is kept either way. Then add a `default: { const unhandledReward: never = reward.rewardType; return; }` exhaustiveness guard to the `grantGainWoundReward` non-Attack `switch` (today a missing arm would log N4 and grant nothing), with a `// why:`.
- Bot case: condition false → `GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX`; else `break` into the `attack` fight-count rule. Imports `evaluateCondition` + `CONQUEROR_SPACE_HAS_VILLAIN_CONDITION_TYPE` from `../hero/heroConditions.evaluate.js`.
- Comment-only edits: the `CONQUEROR_LINE_PATTERN` `// why:`, `heroKeywords.ts:125`, the `heroEffects.execute.ts` §8 note (revisit = D-24850, moot here), the grant-leaf header (five rewards).
- Dashboard in-play pins: `totalObs` 8724 → 8717, `resolvedObs` 1220 → 1213, `percentResolved` 14 → 13.9 (observed; other values → STOP).

## Guardrails
- "If you do" stays honest: no Attack without a Wound gained and kept; the WP-883 keep-or-forfeit paths are reused unchanged.
- The prompt opens even with the Rooftops empty; the condition is read at grant time, never snapshotted into the reward.
- The grant leaf never imports `heroEffects.execute.ts`, `divingBlock.logic.ts`, `flyingShieldBlock.logic.ts` or `seatChoice.resolve.ts`; `heroConditions.evaluate.ts` reaches none of them.
- No new `HeroKeyword`, seat-choice kind, move, `UIState` field; pins stay 101 / 80. No code token changes in `heroEffects.execute.ts` or `heroKeywords.ts` (comments only; `heroKeywords.ts:125` is a trailing comment on the `| 'gain-wound-reward'` line, so that token stays byte-identical); the two interception modules, `heroConditions.evaluate.ts`, `hero-mechanic-ledger.mjs` and the arena-client are not edited.
- Every Attack label / log line and every other non-Attack line is byte-identical. Every WP-883 / WP-885 / WP-886 test passes unedited except the migrated `heroAbility.setup.test.ts:2773` Put to the Torch assertions (intentional; say so in the `EC-931:` body).
- Tests build hooks with `buildHeroAbilityHooks` from the regenerated card data; the synthetic Diving Block hook and the `ca75/captain-america-falcon` deck follow `gainWoundRewardNonAttack.test.ts`; grant cases build the recipient's `playerZones`. Moves and effects never throw. No `.reduce()` for branching. No `git stash`.

## Required `// why:` Comments
- The member (`types.ts`): the space lives in the member (D-24834 §11).
- Both seeded-set copies: duplicate-first, naming the other copy.
- `rewardComposition` / `gainWoundRewardComposition`: non-`HeroKeyword` rewards travel here.
- Grant arm: grant-time read equals play time (board frozen); `evaluateCondition` so the Firelord follow-up carries over.
- The new grant-leaf and bot imports: why they add no cycle.
- Bot case: decline with the Rooftops empty, else the Attack rule.

## Files to Produce
- `packages/game-engine/src/types.ts`, `rules/heroAbility.types.ts` (comment only), `rules/heroKeywords.ts` (comment only), `hero/heroEffects.execute.ts` (comment only) — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.ts` + `setup/heroAbility.setup.test.ts` — **modified**
- `packages/game-engine/src/hero/gainWoundReward.logic.ts`, `hero/gainWoundRewardGrant.ts` — **modified**
- `packages/game-engine/src/hero/gainWoundRewardConqueror.test.ts` — **new**
- `packages/game-engine/src/simulation/ai.seatChoice.ts` + `ai.seatChoice.test.ts` — **modified**
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `docs/ai/coverage/live-verify.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **modified**
- `data/cards/anni.json`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**
- `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json` — **only if their gates flag**
- `docs/ai/DECISIONS.md` (D-24850 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. Marker idempotent; `--validate` 0. `data/cards` diff = Put to the Torch line 2 only.
- [ ] Nine gates → 0 (`cards`, `cards:count-markers`, `effect-index`, `mechanics:metadata`, `ledger:heroes`, `sim:runtime-observed`, `sim:coverage`, `registry:validate`, `ledger:numbers`).
- [ ] `pnpm --filter @legendary-arena/game-engine test` passes every WP §Scope F case; `pnpm -r --no-bail test` → 0 fail; dashboard `typecheck` 0; core `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] Ledger `anni/super-skrull|gain-wound-reward` executable, `conqueror` still `condition`; `rooftops-conqueror` hitCount before → after in the `EC-931:` body.
- [ ] D-24850 Active (amends D-24836 §2 / §12, D-24837 §5 / §11(a), D-24834 §8 / §11). STATUS. WORK_INDEX checked off with date. EC_INDEX Done. Mindmap `✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` → 0.
- [ ] Allowlist-only diff. Two-commit topology. Live-verify (D-24026) post-deploy on a NEW match.

## Common Failure Smells
- Put to the Torch still records `rooftops-conqueror` → the marker did not land or Step 2g rejected the member.
- L0 "not yet supported" at play → the builder's composition path lacks the conqueror branch.
- +4 with the Rooftops empty → the arm skipped `evaluateCondition`.
- No +4 even with the Rooftops occupied → the condition value is `'Rooftops'` (capitalized), which `patrolSpaceIndex` treats as unknown (−1).
- A compile error in `describeGainWoundRewardPhrases` → its exhaustive `switch` lacks the member. The grant `switch` (without the `never` guard) and the bot `switch` do NOT fail to compile: a missing grant arm logs N4 and grants nothing, a missing bot case ignores the Rooftops. Scope F cases 2 / 3 and the bot tests catch them.
