# EC-923 — Gain-a-Wound non-Attack rewards: Berserk, KO up to two other cards, Transform (Execution Checklist)

**Source:** docs/ai/work-packets/WP-885-gain-wound-nonattack-rewards.md
**Layer:** Game Engine + Card Data + arena-client (one heading)
**Risk Tier:** MEDIUM — gameplay rules on three hero cards (one over-grant stops, two hollow lines start working), one optional-KO target filter, a transform refactor that must stay byte-identical, card data and derived feeds; no auth, money, persistence or server surface

## Before Starting
- [ ] Baseline `origin/main` includes #3289 (the reserve), the WP-885 draft SPEC and WP-883 (#3285).
- [ ] `pnpm install` and `pnpm -r build` → 0. Engine suite green (6930 / 0 at draft). `pnpm --filter @legendary-arena/arena-client typecheck` and `pnpm --filter @legendary-arena/dashboard typecheck` → 0.
- [ ] Anchors, `heroAbility.setup.ts`: pattern `:329`, seeded set `:497`, `SUPPORTED_TRANSFORM_BASES` `:722`, transform arm `:1723`, composition arm `:1881`, Step 2g `:2276`, suppression `:2648`, descriptor arm `:2875`, gate-only `:3060`, `transformSupported` `:5135`.
- [ ] Anchors elsewhere:
  - `heroAbility.types.ts` `rewardType` `:151`; `types.ts` `PendingOptionalKoReward` `:1140` (`koHeroesOnly` `:1174`), `GainWoundReward` `:1626`.
  - `gainWoundReward.logic.ts` `:45` / `:56` / `:92` / `:180`; `gainWoundRewardGrant.ts` `:34` / `:72`.
  - `heroEffects.execute.ts`: `heroEffectTransform` `:6869`, `resolveTransformCardName` `:6994` (callers `:2772`, `:2773`, `:3533`, `:4129`), `formatTransformEconomyClause` `:7012`, `heroEffectGainWoundReward` `:7601` (L1 `:7631`), trace `buildHeroEffectTraceParams` `:1885-1909`, `selectDefaultOptionalKoTarget` `:7990`.
  - Labels `divingBlock.logic.ts:291-305`, `flyingShieldBlock.logic.ts:223-236` (`buildSeatPrompt` `:230`, caller `:296`); KO readers `optionalKoReward.resolve.ts:160`, `uiState.build.ts:1876`, `ai.legalMoves.ts:745`; bot `ai.seatChoice.ts:304` (test callers `:490-505`); client `PendingSeatChoicePrompt.vue:159-160` (test `:408`); `live-verify.json:2203`.
  - Ledger `hero-mechanic-ledger.mjs`: `BY_HOOK_KEYWORDS` `:187`, by-hook return `:375-376`, `cardResolvedKeywords` `:585-593`. `heroKeywords.ts` comments `:74`, `:125`, `:182`, `:233`.
- [ ] Re-probe the three lines (WP Assumes 1): Violent Conditioning two ungated Berserks; Hulk Gets Smashed `gate-only`; Mood Swings `transform` unresolved.
- [ ] Scope lock: the file set is exactly §Files to Produce; anything else needs an inline amendment (01.5).

## Locked Values (do not re-derive)

**Parser + data**
- Card Map: `wpnx/weapon-x-wolverine/violent-conditioning`[0] `[keyword:gain-wound-reward:berserk:2]`; `msis/bruce-banner/hulk-gets-smashed`[0] `[keyword:gain-wound-reward:optional-ko-hand-discard:2]`; `wwhk/skaar-son-of-hulk/mood-swings`[0] `[keyword:gain-wound-reward:transform:1]`. No validator change.
- `GAIN_WOUND_REWARD_SEEDED_REWARDS` = `{ 'attack', 'optional-ko-hand-discard', 'transform' }`; `GAIN_WOUND_REWARD_SEEDED_COMPOSITIONS` = `{ 'berserk' }` (both in the parser and `gainWoundReward.logic.ts`).
- Descriptor: `{ type: 'gain-wound-reward', magnitude, rewardType }` or `{ type: 'gain-wound-reward', magnitude, rewardComposition: 'berserk' }`; `HeroEffectDescriptor.rewardComposition?: string` (contract file, `// why: WP-885 / D-24836`).
- Pre-scan before the Step 2 loop. Berserk line: no `primitiveEffects` push, `resolvedMarkers` keeps `berserk`. Transform line: no `transform` keyword, no unresolved marker, `resolvedMarkers` `transform`. Mood Swings stays OFF `SUPPORTED_TRANSFORM_BASES` (comment updated).

**Reward mechanism**
- `GainWoundReward.rewardType`: `'attack' | 'berserk' | 'optional-ko-hand-discard' | 'transform'`; no new field.
- Phrases (non-attack): berserk `Berserk twice` (N=2, else `Berserk {N} times`); KO label `KO up to {N} other cards from your hand or discard pile`, log `… from their hand or discard pile`; transform `Transform into {second form}` (first `{target}#` copy's display name, else `its second form`).
- Option 0 `Gain a Wound: {label phrase}`; decline suffixes recipient ` (then {label phrase})`, other seat ` (they keep its reward)`. Heading `'Gain a Wound?'` (+ the `co2e/hulk` live-verify note). Every attack label / log byte-identical.
- Signatures: `buildGainWoundRewardChoice(playerID, reward, G?)` (trailing optional `G`, transform name only; no `G` → `its second form`); `buildSeatPrompt` gains `G`. N1 lives in `heroEffectGainWoundReward`.
- `buildGainWoundReward(rewardType, rewardComposition, magnitude, sourceCardId)`: seeded-set membership + an explicit `switch` (keyword path), `GAIN_WOUND_REWARD_SEEDED_COMPOSITIONS.has` + `=== 'berserk'` (composition path); no `as` casts; `rewardType` wins if both are present.
- Ledger: for each hook effect `gain-wound-reward` with a `rewardType`, add it to `cardResolvedKeywords` (Skaar `transform` → executable). Trace copies `rewardComposition`. `heroKeywords.ts`: comment-only edits; pins stay 99 / 78.
- N-lines (4-arg `pushLog`): N1 `Player {p} may gain a Wound to {log phrase} ({card}).` [neutral] · N4 `Player {p} gained a Wound ({card}).` [applied] · N5 `Player {p} would gain a Wound — they {log phrase} if they keep it ({card}).` [neutral] · N6 `Player {p} could not gain a Wound — the Wound supply is empty, so they do not {log phrase} ({card}).` [blocked] · N7 `Player {p} kept the Wound ({card}).` [applied] · N8 `Player {p}'s Wound was prevented, so they do not {log phrase} ({card}).` [blocked] · N10 `Player {p} had no other card in their hand or discard pile to KO ({card}).` [blocked]. L0 / L2 / L3 / L9 unchanged.
- Grant arms (after N4 / N7): berserk → `interpretHeroPrimitiveEffect(G, undefined, recipientID, structuredClone(HERO_COMPOSITION_MARKERS.berserk), sourceCardId)` × magnitude (`for` loop); KO → park `min(magnitude, eligible)` entries `{ playerID, rewardType: 'none', rewardMagnitude: 0, sourceCardId, koZones: ['hand','discard'], koSparesGainedWound: true }` (a fresh `koZones` literal per entry), eligible = non-Wounds + max(0, Wounds − 1), 0 → N10; transform → `applyHeroTransform(G, recipientID, sourceCardId)`.
- `PendingOptionalKoReward.koSparesGainedWound?: true`: a Wound is eligible only while hand ∪ discard hold ≥ 2 Wounds, recounted at the resolve (silent reject), the projection (omit) and the bot `isEligible`.
- Leaf `hero/heroTransform.logic.ts`: `applyHeroTransform`, `resolveTransformCardName`, `formatTransformEconomyClause` moved verbatim (identical code tokens, log strings, event push); `heroEffectTransform` delegates; imports only zoneOps, economy, log, `notableEvents.compose`, types. Only two comments change (`:6840` JSDoc, `:6896-6899` `// why:`), naming the `gain-wound-reward` caller; `composeTransformNarrative`'s import moves with the body.
- Trace params: `effectTraces[].params.rewardComposition` reaches the client through the existing spread; no `UIState` field. `koSparesGainedWound` carries a `// why:` on its `ko*` family name (D-24600).
- Bot (`chooseGainWoundRewardOption`): attack unchanged; berserk → default; KO → gain iff ≥ magnitude cost-0 cards (`cardStats[id]?.cost ?? 0`) in hand ∪ discard; transform → gain iff base in `inPlay` and a `{target}#` copy in `G.transformDeck`. G never written.

## Guardrails
- "If you do" stays honest for every reward: nothing without a Wound gained and kept; WP-883's keep-or-forfeit code paths are reused, not copied.
- No new `HeroKeyword`, seat-choice kind, move, UIState field, `game.ts` / `index.ts` edit; keyword / handler pins do not move.
- Every WP-883 test (`gainWoundReward.test.ts`, the attack parse cases, the ai cases) and every transform / optional-KO test passes unedited. The only edited existing assertion is the `PendingSeatChoicePrompt.test.ts` heading (intentional; say so in the `EC-923:` body), plus dashboard pins only if the feed moved them.
- The bot never emits a KO target the resolve rejects (sim hang; prove it with the WP §H drain-loop test) and never reads the deck top.
- A Diving Block reveal on the Berserk Wound draws its one card as usual; assert that, never "deck untouched".
- The grant leaf never imports `heroEffects.execute.ts`, `divingBlock.logic.ts`, `flyingShieldBlock.logic.ts` or `seatChoice.resolve.ts`.
- Tests build hooks with `buildHeroAbilityHooks` from regenerated card data. Moves and effects never throw. No `.reduce()` for branching. No `git stash`.

## Required `// why:` Comments
- `rewardComposition`: Berserk is a composition marker, not a `HeroKeyword` (D-24031).
- Pre-scan + token consumption: no unconditional Berserk / Transform, no hollow (D-24570 sibling).
- `SUPPORTED_TRANSFORM_BASES` comment: Mood Swings is modelled through `gain-wound-reward`, not the allowlist.
- Spare rule at each reader: "other" excludes the gained Wound; Wounds are fungible, so by count.
- `min(magnitude, eligible)`: every parked entry keeps a legal target (bot never hangs).
- Bot: Berserk declines (hidden top card); KO and transform conditions.
- Each new import in the grant leaf and the transform leaf: why it adds no cycle.

## Files to Produce
- `packages/game-engine/src/setup/heroAbility.setup.ts` + `setup/heroAbility.setup.test.ts`; `rules/heroAbility.types.ts`; `rules/heroKeywords.ts` (comments only); `types.ts` — **modified**
- `scripts/hero-mechanic-ledger.mjs` — **modified** (by-hook `rewardType` branch)
- `packages/game-engine/src/hero/gainWoundReward.logic.ts`, `hero/gainWoundRewardGrant.ts`, `hero/heroEffects.execute.ts` — **modified**
- `packages/game-engine/src/hero/heroTransform.logic.ts`, `hero/gainWoundRewardNonAttack.test.ts` — **new**
- `packages/game-engine/src/moves/divingBlock.logic.ts`, `moves/flyingShieldBlock.logic.ts`, `moves/optionalKoReward.resolve.ts`, `ui/uiState.build.ts`, `simulation/ai.legalMoves.ts`, `simulation/ai.seatChoice.ts` + `ai.seatChoice.test.ts` — **modified**
- `apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` + `.test.ts` — **modified**
- `scripts/convert-cards/inputs/hero-ability-markers.json`, `docs/ai/coverage/live-verify.json` — **modified**; `scripts/coverage/mechanic-provenance.json` — only if its gate flags
- `data/cards/wpnx.json`, `msis.json`, `wwhk.json`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**
- `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json`, `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **only if their gates flag**
- `docs/ai/DECISIONS.md` (D-24836 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0. Markers idempotent; `--validate` 0.
- [ ] Eight gates → 0 (`cards`, `cards:count-markers`, `effect-index`, `mechanics:metadata`, `ledger:heroes`, `sim:runtime-observed`, `sim:coverage`, `ledger:numbers`).
- [ ] Engine suite passes (every WP §Scope H case); `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` and `pnpm --filter @legendary-arena/dashboard typecheck` → 0; core `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] Ledger: `gain-wound-reward` executable for the three heroes, `transform` executable for Skaar; `gate-only` / `transform` / `berserk` hitCounts before / after in the `EC-923:` body.
- [ ] D-24836 Active. STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` → 0.
- [ ] Allowlist-only diff. Two-commit topology. Live-verify (D-24026) post-deploy on a NEW match.

## Common Failure Smells
- Violent Conditioning still Berserks with no prompt → the berserk composition was not consumed on the reward line.
- Mood Swings Transforms with no Wound → it was added to `SUPPORTED_TRANSFORM_BASES` instead of consumed.
- The KO prompt offers the Wound just gained → a reader skipped the spare rule.
- The sim hangs on a KO entry → the bot `isEligible` disagrees with the resolve, or more entries were parked than eligible cards.
- A transform test changes output → the extraction was not verbatim.
- Hulk Smash! labels or logs changed → an attack branch went through the non-attack phrasing.
