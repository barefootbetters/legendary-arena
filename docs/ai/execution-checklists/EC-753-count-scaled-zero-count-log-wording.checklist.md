# EC-753 — Count-scaled zero-count log wording (Execution Checklist)

**Source:** docs/ai/work-packets/WP-716-count-scaled-zero-count-log-wording.md
**Layer:** Game Engine (game-log `messages` text)
**Status:** Pending

## Before Starting
- [ ] Read `heroEffects.execute.ts` L695–748 — the condition-failed branch that emits the
      "ability did not activate — <reason>" line at outcome `'blocked'` (WP-295/WP-702 wording)
- [ ] Confirm the resolving hook's effect descriptor exposes the count-scaled keyword +
      `countSource` at that site (so the reword is scoped to attack/recruit/kidnap-per-count)
- [ ] Read the shipped count ≥ 1 line ("Count-scaled attack/recruit: +N (…)") — it stays
- [ ] `pnpm -r build` 0; engine suite green (record baseline count)

## Locked Values (do not re-derive)
- [ ] Reword scope: the count-scaled family ONLY — `attack-per-count`, `recruit-per-count`,
      `kidnap-per-count` (WP-714). Flat-gated non-count abilities keep the existing wording
- [ ] New count-0 phrasing (neutral/instructive, NO whiff/failed/missed): the line conveys the
      card scaled to **+0** because **no other <class/team> Hero was played yet this turn** —
      lock the exact string in this EC at draft-execution and snapshot-test it verbatim
- [ ] Outcome stays an existing `LOG_OUTCOMES` member (no new value, no drift-array change)

## Guardrails
- [ ] **Behavior byte-unchanged** — only `G.messages` text differs; grant math + conditions +
      `finalStateHash` unchanged; the `messages`/replay oracle re-pins ONLY the text delta, honestly
- [ ] Scope the reword to the count-scaled family; DO NOT broaden the generic condition-failed
      wording used by flat-gated abilities (Repulsor Rays "Ranged: +1 attack") — regression-pin it
- [ ] Two-vocabulary copy-lint: the new wording never says whiff/failed/missed/error/wasted
- [ ] No new keyword, no `LOG_OUTCOMES` drift, no `.reduce()` in the branch; pure/total; no throw

## Required `// why:` Comments
- [ ] The count-scaled zero-scale reword cites WP-716 / D-24539 and the "+0 is not a failure" rationale
- [ ] Why the reword is family-scoped (count-scaled only) and flat-gated wording is preserved

## Files to Produce
- [ ] `packages/game-engine/src/hero/heroEffects.execute.ts` — the family-scoped count-0 reword
      (+ a pure phrasing helper if warranted; inline if single-use)
- [ ] `packages/game-engine/src/hero/heroEffects.execute.test.ts` (or the conditional test) —
      count-0 new wording; flat-gated wording UNCHANGED (regression); count ≥ 1 line unchanged
- [ ] Honest re-pin of any committed replay/log-oracle fixture whose count-0 text changed (state which)

## After Completing
- [ ] engine suite green; `pnpm -r build` 0
- [ ] gameplay `finalStateHash` unchanged; only `messages`-text fixtures re-pinned (named in PR)
- [ ] D-24539 Active; WORK_INDEX `[x]` + EC_INDEX row flipped; roadmap mindmap 📝→✅
- [ ] PR squash-merged when green

## Common Failure Smells
- The reword also changes flat-gated (non-count) blocked lines → over-broad; scope to the count-scaled family.
- A gameplay `finalStateHash` fixture flips → you changed behavior, not just text; revert and reword text only.
- New wording uses "failed"/"whiff" → copy-lint violation; keep it neutral/instructive.
