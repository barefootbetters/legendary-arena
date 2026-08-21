# EC-613 — Surface the Competitive Score on the Endgame Screen (Execution Checklist)

**Source:** docs/ai/work-packets/WP-578-surface-competitive-score-on-endgame.md
**Layer:** App (`apps/arena-client`)

## Before Starting
- [ ] Preconditions A–D in WP-578 all pass (submit returns the record; composable discards it; `buildParBreakdown` still deferred; EndgameSummary mounted by the play surfaces)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (baseline)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (baseline)

## Locked Values (do not re-derive)
- Score source: the `record: MyCompetitiveScore | null` on `SubmitScoreResult` returned by `submitCompetitiveScore` — **already in hand at gameover**; NO new fetch, NO `/api/me/scores` call.
- Fields rendered: `finalScore` (headline — the ranked, lower-is-better value) and `rawScore`; rendered verbatim, never recomputed. `parScore` is NOT re-derived.
- `submittedScore` is `null` for guest / non-200 / network-failure / `par_not_published`.
- D-6701 premise stands: `UIGameOverState.par` is NOT populated; `buildParBreakdown` stays `undefined`.

## Guardrails
- Do NOT touch `packages/game-engine` — any engine file in the diff is a STOP.
- Do NOT add a projection field or a new API call; consume the existing submit result.
- Do NOT change the submit trigger — it fires at most once per match on `gameOver`.
- Guest / pending / failed submit → render the existing outcome + VP summary with NO score and NO error (never a crash).
- Casual/unranked matches still submit and still show the score (`is_ranked_eligible` is orthogonal to display).
- The new `EndgameSummary` prop is OPTIONAL — existing mounts that do not pass it render unchanged.
- These are numbers — do NOT route any value through `AbilityText.vue`.

## Required `// why:` Comments
- On the record-exposure in the composable: why the record (not just the status) is surfaced — it feeds the endgame panel.
- On the graceful-absence branch in `EndgameSummary`: why a `null` score renders the unchanged summary, not an error.

## Files to Produce
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts` — **modified** — expose `submittedScore` from `result.record`
- `apps/arena-client/src/components/hud/EndgameSummary.vue` — **modified** — optional `competitiveScore` prop + render block
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — composable host: surface `submittedScore`, prop it to PlayDesktop/PlayMobile (`01.5` wiring)
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — accept the prop, pass to EndgameSummary (`01.5`)
- `apps/arena-client/src/pages/PlayMobile.vue` — **modified** — accept the prop, pass to EndgameSummary (`01.5`)
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.test.ts` — **modified** — record-surfaced / null-path assertions
- `apps/arena-client/src/components/hud/EndgameSummary.test.ts` — **modified** — render-when-present / omit-when-absent

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm -r build && pnpm -r --no-bail test` — no new failures
- [ ] No `packages/game-engine` file modified; no `UIState` field added
- [ ] Live-on-surface (D-24026): finish a ranked match signed in on play.legendary-arena.com → the endgame panel shows the competitive final score; a guest sees the unchanged summary
- [ ] `docs/ai/STATUS.md` updated (names WP-578; D-24026 operator-pending)
- [ ] `docs/ai/DECISIONS.md` D-24387 landed Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` WP-578 node `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells (Optional)
- An engine file in the diff → someone tried to populate `par`; the score is server-side, not engine-side. Revert and consume the submit result.
- A new `fetch`/`/api/me/scores` call → the record is already on the submit result; the extra call is unnecessary.
- The endgame panel erroring for a guest → the graceful-absence branch is missing.
