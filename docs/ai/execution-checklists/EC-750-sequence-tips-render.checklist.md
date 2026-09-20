# EC-750 — Synergy Realization: sequence-tips client render

**WP:** WP-713 · **Layer:** Arena Client only (render an already-served coach-report field) · **Lane:** Standard two-session (lightweight-lane eligible — the execution session MAY collapse to one session if the confirmed criteria hold) · **Status:** Pending

Governs execution of WP-713: render the WP-710/D-24533 server-computed
`CoachReport.sequenceTips` in the endgame coach panel as a forward "Opportunities"
block — one `<li>` per tip, verbatim, hidden when absent/empty. The deferred Option-B
client-render half of WP-710. No engine/server/UIState/persistence/hash surface.

## Before Starting

- [ ] Baseline `origin/main` @ `89150ae0`; arena-client suite + `vue-tsc --noEmit` green pre-change.
- [ ] Confirm on `main`: `GET /api/me/scores/:replayHash/coach` returns `CoachReport.sequenceTips?` (WP-710 #2185; the fresh AND cache-hit paths carry it; a pre-WP-710 cached report returns it `undefined`).
- [ ] Confirm the client surface: `coachApi.ts` declares its OWN `CoachReport` interface (no server-type import); `EndgameCoachPanel.vue` renders `report.report.suggestions` in a `v-for` under "Next time" (mirror this); `useEndgameCoach.ts` stores the `StoredCoachReport` in the `report` ref.
- [ ] Confirm NO coach-panel copy-lint exists (the only one, `EndgameSummary.test.ts`, scans `[data-testid="arena-hud-per-player"]`, not the coach panel) — this EC adds one.

## Locked Values

- Client type: add `readonly sequenceTips?: readonly string[]` to the `CoachReport` interface in `apps/arena-client/src/lib/api/coachApi.ts` — additive OPTIONAL (structural mirror of the server field; the header forbids importing server types). Do NOT touch `StoredCoachReport` (it already wraps `CoachReport`).
- Render site: `EndgameCoachPanel.vue`, inside the existing coach-report block, AFTER the model "Next time" `suggestions` block. Label "Opportunities"; `v-for="tip in report.report.sequenceTips" :key="tip"`; reuse the `.coach-report-tips` / `.coach-report-label` / `.coach-report-block` classes (no new styles required).
- Visibility guard: render the block only when `report.report.sequenceTips` is a non-empty array (`&& report.report.sequenceTips.length > 0`) — correct for the no-tip common case AND the pre-WP-710 `undefined` shape. Keep the panel's `defineComponent` form.
- Test hook: `data-testid="arena-hud-coach-opportunities"` on the block root.
- Copy-lint banned words (verbatim, lowercased scan of the rendered opportunities block): `whiff`, `failed`, `error`, `missed`, `wasted`.

## Guardrails

- **Verbatim render, never composition (D-20105).** Iterate + display the server strings; compose no tip text, re-evaluate no condition, resolve no card name on the client.
- **Client-only, additive.** NO `apps/server/**`, NO `packages/**`, no UIState/persistence/hash surface, no scoring/PAR/grade. `git diff --name-only` = the 3 arena-client files + governance.
- **Hidden when empty/absent.** The block is NOT in the DOM for an empty array or an omitted field — assert both (the omitted case is the pre-WP-710 cached report).
- **Opportunity voice.** Add the two-vocabulary copy-lint for the new block (none exists for the coach panel today); never `whiff`/`failed`/`error`/`missed`/`wasted`.
- **Off-ranking, display-only** (NG-1) — the tips never enter `finalScore`/PAR/grade.
- **App standing rules.** `.claude/rules/code-style.md` + `00.6`; `.test.ts` on `node:test` via the app's `vue-sfc-loader/register` runner; `vue-tsc --noEmit` clean; keep `EndgameCoachPanel.vue` in `defineComponent` form (its vue-sfc-loader `// why` note).

## Required Comments (`// why:`)

- On the visibility guard: why non-empty-array (no-tip common case + the pre-WP-710 `undefined` cached-report shape).
- On the client `sequenceTips` mirror field: why a structural mirror, not a server-type import (the coachApi header rule).

## Files to Produce

Mirror WP-713 §Files Expected to Change exactly (3 files, arena-client only):
- `apps/arena-client/src/lib/api/coachApi.ts` — `+ sequenceTips?: readonly string[]` on `CoachReport`.
- `apps/arena-client/src/components/hud/EndgameCoachPanel.vue` — the "Opportunities" block (guarded, `data-testid`, reused styling).
- `apps/arena-client/src/components/hud/EndgameCoachPanel.test.ts` — render / hidden-empty / hidden-omitted / copy-lint.

`coachApi.test.ts` is NOT required (the field is a compile-time mirror; the render + fixture live in the panel test). `EndgameSummary.test.ts`'s per-player copy-lint is NOT touched.

## After Completing

- [ ] Arena-client suite green (record delta); `vue-tsc --noEmit` clean; `pnpm -r build` 0.
- [ ] Both hidden cases proven (empty array AND omitted field → no block); render case proven; copy-lint green.
- [ ] `git diff --name-only` = the 3 arena-client files + governance (NO engine/server/packages).
- [ ] Flip WORK_INDEX `[ ]→[x]`, EC_INDEX `Pending→Done`, mindmap `📝→✅`, `roadmap:counts:check` 0; D-24536 Active; NUMBER-LEDGER landed; STATUS.
- [ ] Two-commit topology (`EC-750:` impl + `SPEC:` close) — or the lightweight-lane single-PR two-commit topology if lane eligibility is confirmed at govern-close.
- [ ] D-24026 live-verify (post-deploy): the real Red Skull match's endgame coach panel shows the turn-36.2 "play Perfect Teamwork before Marvelous Strength" opportunity and none for the turn-33.2 mutually-enabling pairs (freshly-generated report — a pre-WP-710 cached report has no `sequenceTips`).

## Common Failure Smells

- Rendering the block for an empty/omitted `sequenceTips` (a stray empty "Opportunities" header) — guard on `.length > 0`.
- Importing the server `CoachReport` type into `coachApi.ts` (the header forbids it — mirror structurally).
- Composing or re-wording tip text on the client (must be verbatim; D-20105).
- Forgetting the copy-lint for the new block (no coach-panel copy-lint exists to inherit).
- A trivial copy-lint fixture — use realistic tip prose (e.g. the real "Next time, play Perfect Teamwork before Marvelous Strength — you'd have landed its strength synergy bonus." shape), not a bare `"Tip one"`, so the banned-word scan isn't vacuously green (matches the `EndgameSummary.test.ts` precedent).
- Editing `apps/server/**` or `packages/**` (the field is already served — client render only).
