# EC-777 — Venompool "Play to the Crowd" Digest/Indigestion + double-Venomverse "both" (Execution Checklist)

**Source:** docs/ai/work-packets/WP-740-venompool-play-to-the-crowd.md
**Layer:** Game Engine + Card Data

## Before Starting
- [ ] Baseline: `origin/main` @ `93cfc858` or later (incl. reserve commit `3d5b34e3` / PR #2267). Working tree clean and synced. `pnpm install` done in the worktree.
- [ ] WP-735 / D-24555 landed: `DIGEST_INDIGESTION_CARDS` has 4 entries; `buildDigestIndigestionFusion` reads only `conditions[0]` of the "both" line; `heroEffectDigestIndigestion` runs Digest then Indigestion.
- [ ] `victory-bystanders` count source (D-24016) and `perEach` on descriptor + `heroEffectAttackPerCount` (D-24493) exist. No new count source.
- [ ] Run `pnpm -r build` FIRST (a stale `dist` fakes results), or probe via `node --import tsx` on `src`. `COUNT_SCALED_PATTERN` (`setup/heroAbility.setup.ts` L192) is still 3-segment only. Confirm a standalone `…:1:2` marker currently parses to a flat `attack` (the draft-scaffold finding).
- [ ] `pnpm -r build` 0; engine suite + `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check` green on baseline.
- [ ] Scope lock: touched files = `Files to Produce`. Anything else is a FAIL — surface it as a blocker.

## Locked Values (do not re-derive)
- Allowlist add: `'vnom/venompool/play-to-the-crowd'` (exactly one entry).
- Markers (curated map, `setAbbr: vnom`, `heroSlug: venompool`, `cardSlug: play-to-the-crowd`): idx0 `[keyword:attack-per-count:victory-bystanders:1:2]`; idx1 `[keyword:rescue:2]`. Remove the one `_deferred` row (idx1, "D-21602 — keyword timing prefix…").
- `COUNT_SCALED_PATTERN = /\[keyword:attack-per-count:([a-z][a-z-]*):(\d+)(?::(\d+))?\]/g` (attack only; recruit/kidnap untouched).
- Fused effect for the card: `{ type:'digest-indigestion', digestThreshold:7, digestEffects:[{type:'attack-per-count',magnitude:1,countSource:'victory-bystanders',perEach:2}], indigestionEffects:[{type:'rescue',magnitude:2}], bothCondition:{type:'requiresTeam',value:'venomverse'}, bothConditionCount:2 }`.
- New descriptor field `bothConditionCount?: number` (absent ≡ 1). New helper `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId): number` in `hero/heroConditions.evaluate.ts`.
- D-24562 locks (WP §Contract "D-24562"): field, helper, parser, the future global-fix path, and the mixed-condition scope limit.
- Live turn-30 expectation: Victory Pile 10 cards / 4 Bystanders, one other Venomverse Hero → Digest only → **+2 Attack**, no rescue.
- No `HERO_KEYWORDS` / `HERO_EFFECT_HANDLERS` count change (no new keyword or handler).

## Guardrails
- **Parser widening is additive.** A 3-segment marker emits NO `perEach` key (omit-when-absent). The core `victory-bystanders:1` and all other existing per-count cards stay byte-identical. The `!processedAsCountScaledChoose` suppression is unchanged (shld choose-one untouched).
- **Count-aware both is `digest-indigestion`-only.** Do NOT modify `evaluateCondition` / `evaluateAllConditions` or any hook gating. `bothConditionCount` absent or `1` → the existing `evaluateAllConditions` path. `> 1` → the helper count `>= bothConditionCount`.
- **Helper semantics:**
  - Return 0 when `!G.cardTraits` BEFORE the loop (`cardHasClassWhenPlayed` dereferences it unguarded). Missing zones or other condition types also → 0.
  - Skip only the exact `triggeringCardId`; a second copy (different `#N`) counts.
  - Count `requiresTeam` via `cardCountsAsTeamMember` and `heroClassMatch` via `cardHasClassWhenPlayed`.
  - Pure; `for…of`; never throws. It duplicates the private `heroCountSource.resolve.ts` counters on purpose (duplicate-first).
- **Fusion derives the count from the print:** set `bothConditionCount` = the number of conditions ONLY when EVERY condition on the "both" line equals `conditions[0]` (type + value) AND there are > 1. Otherwise leave it unset: single-condition Core-4 hooks stay byte-identical, and a mixed `[hc:X][hc:Y]` line is never counted (D-24562 lock 5; such a card must not be allowlisted here).
- **In order:** Digest first on the PRE-rescue Bystander count, then rescue two. Pin with a test (4 Bystanders → +2, not +3). "Both" overrides the Digest 7 gate (D-24555).
- **Digest stays READ-ONLY:** the Digest branch never mutates `victory`. Only the Indigestion `rescue` adds Bystanders.
- **Retarget, don't delete:** the WP-735 negative test ("does NOT fuse a non-allowlisted Digest card") moves to `vnom/venom/insatiable-hunger` (real 3-line text; `makeHeroRegistry('vnom','venom',…)`), with both assertions byte-identical. It is not weakened or removed. NOT `hungry-for-action`, which has no Indigestion line and no unresolved marker.
- **Feeds (ordered):** apply script → `ledger:heroes` → `effect-index` → `mechanics:metadata` → the six `:check`s. Commit whatever they produce. `runtime-observed-hollows.json` is regenerated only if its check fails. If `runtime-observed-hollows.json` moves, re-pin the `useInPlayCoverage.test.ts` totalObs (`reference_inplay_totalobs_pin_stale_on_feed_regen`). The `attack-per-count:victory-bystanders:1` `sim:coverage` WARN is expected (normalizer quirk). Do NOT re-baseline unless `--check` exits non-zero. Revert CRLF-only `lagn-v1.json` churn.
- **Determinism:** no new G field; `vnom` is non-core → `finalStateHash` expected unchanged. If a pin moves, find out why, then dual re-pin honestly — never hand-edit a pin to force green.

## Required `// why:` Comments
- `bothConditionCount` field: D-24562 — a doubled `[team:X][team:X]` / `[hc:X][hc:X]` "both" line needs that many OTHER matching cards (rulebook "Critical Hit" two-icon rule). Scoped to `digest-indigestion`.
- `COUNT_SCALED_PATTERN` 4th segment + the Step 2d `perEach` read: D-24562 — the "for each two" divisor (D-24493 `perEach`) on a standalone line; absent ≡ 1, omit-when-absent.
- `DIGEST_INDIGESTION_CARDS` entry: D-24562 — play-to-the-crowd un-deferred. Update the list of still-deferred cards in the comment.
- Fusion count derivation: D-24562 — replaces the stale "double form belongs only to deferred cards" comment.
- Handler both-select: D-24562 — the count gate vs the any-one-other evaluator; the global doubled-icon gap is deliberately left untouched.
- `countOtherInPlayMatchingCondition`: self-exclusion + the same membership helpers as `evaluateCondition`.

## Files to Produce
- `packages/game-engine/src/rules/heroAbility.types.ts` — **modified** — `bothConditionCount?`
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified** — pattern + Step 2d + effect build + allowlist + fusion count
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified** — helper
- `packages/game-engine/src/hero/heroEffects.execute.ts` — **modified** — count-aware both-select + import + handler JSDoc `@param effect` shape
- `packages/game-engine/src/rules/heroKeywords.ts` — **modified (comment-only)** — the digest-indigestion descriptor-shape comment (~L89) gains `bothConditionCount?`
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — **modified** — retarget negative test; fusion + 4-seg/3-seg parse tests
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — **modified** — branch tests (WP AC 3–6)
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified** — helper tests
- `scripts/convert-cards/inputs/hero-ability-markers.json` — **modified** — +2 apply rows, −1 `_deferred` row
- `data/cards/vnom.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json` — **regenerated** (ordered regen)
- (conditional, per WP §Files) `runtime-observed-hollows.json` / the totalObs pin / the coverage baseline — only if their check fails

## After Completing
- [ ] `pnpm -r build` 0; engine suite green (baseline + new tests); apply script idempotent (re-run 0)
- [ ] The six card/coverage `:check`s exit 0; the ledger lists `play-to-the-crowd` under venompool `attack-per-count` + `rescue`
- [ ] `finalStateHash` fixtures unchanged (or dual-re-pinned with provenance)
- [ ] `docs/ai/STATUS.md`; D-24562 landed Active in `DECISIONS.md`; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0
- [ ] `git diff --name-only` ⊆ Files to Produce
- [ ] D-24026 live-verify on `play.legendary-arena.com` (post-deploy STATUS-flip): +1 Attack per two VP Bystanders at ≥ 7 VP cards; rescue two below; both only after TWO other Venomverse Heroes

## Common Failure Smells
- Card still grants a flat +1 → the marker didn't parse (pattern not widened) or the fusion didn't consume idx0.
- +4 instead of +2 at 4 Bystanders → `perEach` not attached to the effect (dropped at the effect build).
- "Both" fires with one other Venomverse Hero → the handler still uses `evaluateAllConditions` for the count-2 case, or the fusion didn't set `bothConditionCount`.
- Card counts itself toward the two → the helper skipped the self-exclusion. A second copy NOT counted → the self-exclusion compared by card name, not by exact instance id.
- Both-branch Digest reads +3 at 4 Bystanders → the rescue ran before the Digest grant (order inverted).
- A Core-4 or core `victory-bystanders` test changed shape → `perEach` / `bothConditionCount` emitted when absent (omit-when-absent broken).
- Negative-test count dropped → the WP-735 hollow test was deleted instead of retargeted.
