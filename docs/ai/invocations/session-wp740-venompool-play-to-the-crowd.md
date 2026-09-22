# Session Prompt — WP-740 / EC-777: Venompool "Play to the Crowd"

**WP:** docs/ai/work-packets/WP-740-venompool-play-to-the-crowd.md
**EC:** docs/ai/execution-checklists/EC-777-venompool-play-to-the-crowd.checklist.md (authoritative execution contract)
**Reserves:** D-24562 (lands Active at govern-close). **Status:** READY TO EXECUTE (01.4 READY after PS-1 fix + 01.7 PASS after re-run).

> Committed via `git add -f` (session-*.md is gitignored) so the brief survives the drafting
> worktree's removal — per `feedback_session_prompt_lost_on_worktree_removal`.

## Invocation intent

Make Play to the Crowd (`vnom/venompool/play-to-the-crowd`) resolve its printed ability through the WP-735 fused `digest-indigestion` hook:
- **Digest 7:** +1 Attack per TWO Victory-Pile Bystanders.
- **Indigestion:** rescue two Bystanders.
- **Both, in order:** only after TWO other Venomverse Heroes. The Digest grant is counted before the rescues.

This removes today's stray flat +1 and the Indigestion hollow. Live anchor (Dr. Doom / Legacy Virus 2p, turn 30): Victory Pile 10 cards / 4 Bystanders with one other Venomverse Hero → **+2 Attack** only. Engine + card-data only.

## Authority chain (read in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` (Game Engine layer; persistence boundary — `G.heroAbilityHooks` is JSON-plain, D-24095)
3. `.claude/rules/architecture.md`, `.claude/rules/code-style.md`, `.claude/skills/legendary-game-engine/SKILL.md`
4. WP-740 (design authority, incl. its `### D-24562` lock block, 01.4 and 01.7 records)
5. EC-777 (execution contract — satisfy every item exactly)
6. `docs/ai/DECISIONS.md` D-24555 (the fusion/handler this extends), D-24016 (`victory-bystanders`), D-24493 (`perEach`)
7. `docs/legendary-universal-rules-v23.md` ~L683-696 ("Critical Hit" two-icon Superpower rule — the source of the count-2 gate)
8. Source anchors (verified by pre-flight):
   - `setup/heroAbility.setup.ts`: `COUNT_SCALED_PATTERN` :192, Step 2d ~:1359-1382, effect build ~:1786-1794, `DIGEST_INDIGESTION_CARDS` ~:507, `buildDigestIndigestionFusion` ~:2884-2961
   - `hero/heroConditions.evaluate.ts`: `evaluateCondition` :40-90, `evaluateAllConditions` ~:347
   - `hero/heroEffects.execute.ts`: `heroEffectDigestIndigestion` ~:4836-4895, `heroEffectAttackPerCount` ~:2077-2106, `heroEffectRescue` ~:1462-1489
   - `rules/heroAbility.types.ts` ~:178-199
   - `rules/heroKeywords.ts` ~:89 (comment)
9. User memory: `reference_hero_ability_marker_curated_map`, `reference_sim_coverage_baseline_gate_distinct`, `reference_hashed_g_field_dual_repin`, `reference_inplay_totalobs_pin_stale_on_feed_regen`

## Pre-execution checks

- Fresh worktree off `origin/main`, then `pnpm install`. Confirm the WP-740 / EC-777 bundle and reserve (#2267) are on main.
- **`pnpm -r build` FIRST** (a stale `dist` fakes results). Then `pnpm --filter @legendary-arena/game-engine test` must be green. **Record the baseline test count.**
- Probe via `node --import tsx` on `src`:
  - A standalone `[keyword:attack-per-count:victory-bystanders:1:2]` line still parses to a flat `attack` 1 (the gap being fixed).
  - `[team:venomverse][team:venomverse]` parses to two identical `requiresTeam` conditions.

## Execution rules (operationalizing WP-740 + EC-777 — no new scope)

- **Parser:**
  - `COUNT_SCALED_PATTERN` → `/\[keyword:attack-per-count:([a-z][a-z-]*):(\d+)(?::(\d+))?\]/g`.
  - Step 2d records group 3; the `attack-per-count` effect build attaches `perEach` ONLY when present (omit-when-absent). A 3-segment marker stays byte-identical.
  - Leave `!processedAsCountScaledChoose` and the recruit/kidnap siblings untouched.
- **Descriptor:** add `bothConditionCount?: number` (absent ≡ 1) with a D-24562 `// why:`. Update the `rules/heroKeywords.ts` ~L89 shape comment and the handler JSDoc to match.
- **Helper:** `countOtherInPlayMatchingCondition(G, playerID, condition, triggeringCardId): number` in `hero/heroConditions.evaluate.ts`.
  - Return 0 when `!G.cardTraits` BEFORE the loop, and on missing zones or other condition types.
  - Skip only the exact `triggeringCardId`, so a second copy (different `#N`) counts.
  - Use `cardCountsAsTeamMember` for `requiresTeam` and `cardHasClassWhenPlayed` for `heroClassMatch`.
  - `for…of`, pure. Note the duplicate-first relation to the private `heroCountSource.resolve.ts` counters.
- **Fusion:**
  - Add `'vnom/venompool/play-to-the-crowd'` to `DIGEST_INDIGESTION_CARDS` and update its deferred-list comment.
  - Set `bothConditionCount` = the condition count ONLY when > 1 AND EVERY "both"-line condition equals `conditions[0]` (type + value). A mixed line stays unset.
  - Replace the stale "double form belongs only to deferred cards" comment.
- **Handler both-select:**
  - `bothConditionCount > 1` → `countOtherInPlayMatchingCondition(...) >= bothConditionCount`.
  - Otherwise the existing `evaluateAllConditions` path.
  - Everything else in D-24555 is unchanged: safe-skip, read-only `victory.length`, exclusivity, Digest-then-Indigestion order, and "both" overriding the Digest 7 gate.
  - Do NOT touch `evaluateCondition` / `evaluateAllConditions`.
- **Card data** (curated map `inputs/hero-ability-markers.json`):
  - Add `venompool/play-to-the-crowd` idx0 `[keyword:attack-per-count:victory-bystanders:1:2]` and idx1 `[keyword:rescue:2]`.
  - Remove the one `_deferred` row (idx1).
  - Ordered regen: apply script (expect `Updated: 2 lines`; re-run 0) → `pnpm ledger:heroes` → `pnpm effect-index` → `pnpm mechanics:metadata` → `cards:check` / `effect-index:check` / `mechanics:metadata:check` / `ledger:heroes:check` / `sim:runtime-observed:check` / `sim:coverage --check`.
  - Commit whatever the regen produces. The `attack-per-count:victory-bystanders:1` coverage WARN is expected; re-baseline only if `--check` exits non-zero.
  - If `runtime-observed-hollows.json` moves, re-pin the `useInPlayCoverage.test.ts` totalObs.
  - Revert CRLF-only `lagn-v1.json` churn.
- **Tests** (WP AC 1-11):
  - The fusion shape, plus a synthetic mixed-line unset test.
  - Standalone 4-segment parse plus the 3-segment no-`perEach` regression.
  - Digest (turn-30: +2, no rescue, VP byte-identical; 5 Bystanders → +2; 1 → +0).
  - Indigestion (rescue 2; short stack → 1, no throw).
  - Both in order (5-card pile / 4 Bystanders + two other Venomverse → +2 then rescue 2).
  - The count gate (one other → no both; self not counted; second copy counts).
  - Helper unit tests.
  - Core-4 unchanged.
  - **Retarget** the WP-735 negative test to `vnom/venom/insatiable-hunger` with both assertions byte-identical. NEVER `hungry-for-action`, and never delete or weaken it.
- **Determinism:** no new G field; vnom is non-core → `finalStateHash` expected unchanged. VERIFY. If a pin moves, investigate first, then dual re-pin honestly — never edit a pin to force green.

## SAFE-KNOBS scope

N/A — no knob surface.

## Session task

Execute WP-740 per EC-777 with a two-commit topology:
1. `EC-777:` implementation.
2. `SPEC:` govern-close: land D-24562 Active (the five WP §D-24562 locks); flip the WORK_INDEX `[x]`; EC_INDEX Done; mindmap ✅; run `roadmap:counts:write` and `ledger:numbers:check`; update STATUS.md.

Open one PR.

**D-24026 live-verify is REQUIRED** post-deploy on `play.legendary-arena.com`, against the deployed `/api/version` gitSha:
- Play to the Crowd grants +1 Attack per two Victory-Pile Bystanders at ≥ 7 VP cards.
- It rescues two below 7.
- It does both only after TWO other Venomverse Heroes.

Record it as a follow-up STATUS-flip, not a merge blocker.

## Post-merge close ritual (REQUIRED)

After the operator merges the PR (GitHub UI):
- Run `node scripts/prune-empty-claude-branch.mjs --verify-current` from the worktree (expect `VERIFY PASS`).
- Run `git branch -D <branch>` + `git push origin --delete <branch>`.
- Run `node scripts/prune-empty-claude-branch.mjs --report` from canonical (expect silent).

## Scope restriction

This prompt restates and operationalizes WP-740 + EC-777 only. It adds no new scope, files, contract elements, locked values, or forbidden patterns. Any new surface goes back into the WP/EC and re-runs the gates.
