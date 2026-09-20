# EC-755 — Synergy Realization: Table Cooperation client render

**WP:** WP-718 · **Layer:** Arena Client only · **Lane:** Lightweight (single session) · **Status:** Done

Governs WP-718: render the WP-717/D-24540 server-computed `CoachReport.tableCooperation`
in the endgame coach panel as a "Table Cooperation" block. The deferred client-render half
of WP-717 (mirrors WP-713). No engine/server/UIState/hash surface.

## Before Starting

- [x] Baseline `origin/main` @ `90b9a575`; arena-client suite + `vue-tsc` green pre-change (after a dist build).
- [x] Confirm on `main`: `GET /api/me/scores/:replayHash/coach` returns `CoachReport.tableCooperation?` (WP-717 #2197); the client `coachApi.ts` declares its own `CoachReport` (no server-type import) with `sequenceTips?` as the additive-optional precedent; `EndgameCoachPanel.vue` renders the WP-713 Opportunities block to mirror.

## Locked Values

- Client type: add `readonly tableCooperation?: readonly string[]` to `CoachReport` in `coachApi.ts` (additive OPTIONAL; mirror `sequenceTips`; no server-type import).
- Render site: `EndgameCoachPanel.vue`, FIRST in the coach-report block (after the model headline, before "Hero fit") so the shared-win framing leads. `v-for="line in report.report.tableCooperation" :key="line"`; label "Table Cooperation"; reuse `.coach-report-block` / `.coach-report-label` / `.coach-report-tips`; `data-testid="arena-hud-coach-table-cooperation"`.
- Visibility guard: render only when `report.report.tableCooperation && report.report.tableCooperation.length > 0` (hides the pre-WP-717 `undefined` shape). Keep the panel's `defineComponent` form.

## Guardrails

- **Verbatim render, never composition (D-20105).** Iterate + display the server strings; compose nothing, re-evaluate nothing. No client copy-lint needed — the two-vocabulary copy is enforced at the source (WP-717 `computeTableCooperation` + its server tests).
- **Client-only, additive.** NO `apps/server/**`, NO `packages/**`; no UIState/persistence/hash surface. `git diff --name-only` = the 3 arena-client files + governance.
- **Hidden when empty/absent** — assert both (empty array AND omitted field).
- **Off-ranking, display-only** (NG-1).
- **Build before typecheck:** `pnpm -r build` before `vue-tsc` — the client typechecks against the engine dist, and a parallel WP added `UIGameOverState.synergyContributions`; a stale dist surfaces false `EndgameSummary.vue` errors.
- App standing rules; `.test.ts` on `node:test` via the app's `vue-sfc-loader/register` runner.

## Required Comments (`// why:`)

- On the visibility guard: why non-empty-array (hides the pre-WP-717 `undefined` cached-report shape).
- On the client `tableCooperation` mirror field: why a structural mirror, not a server-type import.

## Files to Produce

Mirror WP-718 §Files (3 files, arena-client only): `coachApi.ts` (+ field), `EndgameCoachPanel.vue` (the block), `EndgameCoachPanel.test.ts` (render / hidden-empty / hidden-omitted).

## After Completing

- [x] Arena-client suite green (EndgameCoachPanel 11/11 +3; full 1864/0); `vue-tsc` clean; `pnpm -r build` 0.
- [x] `git diff --name-only` = the 3 files + governance (no engine/server/packages).
- [x] Lightweight-lane two-commit topology (`EC-755:` impl + `SPEC:` close); WORK_INDEX `[x]`; EC_INDEX `Done`; roadmap `✅`; `roadmap:counts:check` 0; NUMBER-LEDGER landed; STATUS.
- [ ] D-24026 live-verify (post-deploy): the real 2p Red Skull match's coach panel leads with the Table Cooperation block (freshly-generated report).

## Common Failure Smells

- Running `vue-tsc` against a stale engine dist (false `synergyContributions` errors) — `pnpm -r build` first.
- Importing the server `CoachReport` type into `coachApi.ts` (the header forbids it).
- Rendering the block for an empty/omitted array (guard on `.length > 0`).
- Editing `apps/server/**` or `packages/**` (the field is already served — client render only).
