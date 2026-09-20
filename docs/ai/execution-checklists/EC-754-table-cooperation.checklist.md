# EC-754 — Synergy Realization: Table Cooperation recognition

**WP:** WP-717 · **Layer:** Server (a pure derivation over the coach match summary, surfaced on the coach report) · **Lane:** Standard two-session · **Status:** Pending

Governs execution of WP-717: a deterministic, celebration-only **Table Cooperation**
recognition on `CoachReport`, derived from the already-built `CoachMatchSummary`. Phase 3
v1 of `DESIGN-SYNERGY-REALIZATION.md` §3.4. Server-only; no engine/`G`/hash surface. The
client render, explicit gift/assist attribution, and HQ-courtesy are named follow-ups.

## Before Starting

- [ ] Baseline `origin/main` @ `02fa5cae`; server suite green pre-change.
- [ ] Confirm on `main`: the game is cooperative (`evaluateEndgame` → one shared `EndgameOutcome`; `matchLagn.logic.ts` labels multi-seat `'cooperative'`, never `'competitive'`) — so no co-op-mode gate is needed and no seat is a rival.
- [ ] Confirm the coach surface: `CoachMatchSummary` (`coach.types.ts`) carries `outcome`, `team: {victoryPoints, bystandersRescued}`, and `perPlayer: CoachPlayerLine[]` (with `villainsDefeated`/`henchmenDefeated`/`mastermindTacticsDefeated`/`conditionalClausesAssembled`/`conditionalClausesRealizedValue`/`bystandersRescued`); `generateOrGetCoachReport` builds `summary` then merges `{ ...report, sequenceTips }` before `writeCoachReport` (the WP-710 precedent to mirror).
- [ ] Confirm `CoachReport.sequenceTips?: readonly string[]` is the additive-optional precedent for the new field.

## Locked Values

- Field: add `readonly tableCooperation?: readonly string[]` to `CoachReport` in `apps/server/src/coach/coach.types.ts` — additive OPTIONAL (mirror `sequenceTips`; do NOT touch `CoachMatchSummary` — the field is on the served/cached `CoachReport`, not the discarded model input).
- Module: `apps/server/src/coach/tableCooperation.logic.ts` (new) — `computeTableCooperation(summary: CoachMatchSummary): readonly string[]`. Pure; reads `summary.outcome` / `summary.team` / `summary.perPlayer` ONLY. No `G`, no `ctx.random`, no I/O, no replay read, not model-authored.
- Recognition content: (1) shared-outcome team line per `outcome` — `heroes-win` = stopped the Mastermind together, `scheme-wins` = regroup framing (NO blame), `tie` = threat held / deck ran out; (2) standout co-op roles from `perPlayer` — top combat (max `villainsDefeated + henchmenDefeated + mastermindTacticsDefeated`), top synergy (max `conditionalClausesAssembled`, tie-broken by `conditionalClausesRealizedValue`), top rescue (max `bystandersRescued`); OMIT a role line when its metric is zero across the table; (3) combined `team` total as a shared-achievement line.
- Tie-break (determinism, must be pinnable): every role scan is a `for...of` **first-max-wins** over the stable `perPlayer` array (use `>`, not `>=`), so any residual tie — including a full cross-table tie and a synergy tie where `conditionalClausesRealizedValue` also ties — resolves to the **first** seat in `perPlayer` order. A tie still emits exactly ONE role line (never zero, never two).
- Degradation: solo / single-seat / all-zero → a minimal line or `[]` (never a crash, never an empty role line).
- Wiring: in `coach.logic.ts`, `const tableCooperation = computeTableCooperation(summary)` and merge `{ ...report, sequenceTips, tableCooperation }` before `writeCoachReport` (default `[]`).
- Copy-lint banned sets (**word-boundary** scan of the lowercased emitted lines — a substring scan would let `defeated` self-trip `beat`; use `\b<word>\b`): celebration — `whiff`, `failed`, `error`, `missed`, `wasted`; player-vs-player — `opponent`, `beat`, `versus`, `vs`, `winner`, `loser`. The `vs`/`versus` ban applies to `computeTableCooperation`'s **emitted** lines, which by design never use "vs" (team-framing / role / total lines) — so the absolute ban is safe here. The "hero-vs-villain 'vs' is allowed" note (`feedback_pvp_terminology_scope`) is the broader repo rule, NOT an exception this emitted-line lint must carve out. Phrase co-op copy around the banned words (e.g. "carried the combat", "defeated N villains", "stopped the Mastermind together").

## Guardrails

- **Cooperative framing (co-op no-winner/loser-between-teammates rule).** Seats are teammates — never `opponent`/`beat`/`versus`-a-player/`winner`/`loser` between seats. Grounded in the game's co-op design: `EndgameSummary.vue` states "contribution only, no winner/loser between teammates" and `EndgameSummary.test.ts` already asserts the recap excludes `winner`/`loser` — this is the intra-match analogue of Vision §23b's cross-run player-comparison ban. Hero-vs-villain "vs" is allowed (`feedback_pvp_terminology_scope`); a "vs" in the fixture copy must be hero-vs-villain, not seat-vs-seat.
- **Celebration voice.** No `whiff`/`failed`/`error`/`missed`/`wasted`; `scheme-wins` is a regroup, never blame.
- **Server-only, deterministic, additive.** NO `packages/**`, no engine/`G`/`ctx` read, no `ctx.random`, no I/O, no replay read, not model-authored. `git diff --name-only` = the 5 files + governance.
- **Off-ranking, display-only** (NG-1) — never `finalScore`/PAR/grade/Victory Points.
- **On the correct type.** `tableCooperation` on `CoachReport` (served/cached), never `CoachMatchSummary`.
- **No `.reduce()`** in the role scans — explicit `for...of` + descriptive accumulators.
- **No hash/persistence/fixture/card-data change.**
- **App standing rules.** `.claude/rules/code-style.md` + `00.6`; `.test.ts` on `node:test`.

## Required Comments (`// why:`)

- On each role-scan tie-break (why max-by-<field>, and the realized-value tie-break for synergy).
- On the `scheme-wins` regroup framing (why never blame — the celebration/two-vocabulary rule).
- On placing `tableCooperation` on `CoachReport` (why — the served/cached blob; `CoachMatchSummary` is discarded model input).
- On the co-op framing (why teammates never framed as opponents — Vision §23b).

## Files to Produce

Mirror WP-717 §Files Expected to Change exactly (5 files, server only):
- `apps/server/src/coach/coach.types.ts` — `+ tableCooperation?: readonly string[]` on `CoachReport`.
- `apps/server/src/coach/tableCooperation.logic.ts` — **new** — `computeTableCooperation(summary)`.
- `apps/server/src/coach/coach.logic.ts` — compute + merge `tableCooperation` before persist.
- `apps/server/src/coach/tableCooperation.logic.test.ts` — **new** — per-outcome / roles (ties/solo/all-zero) / combined total / both copy-lint vocabularies.
- `apps/server/src/coach/coach.logic.test.ts` — assert served + cached `CoachReport` carries `tableCooperation`.

`coachSummary.logic.ts` is NOT touched (the summary already carries the data).

## After Completing

- [ ] Server suite green (record delta); `pnpm -r build` 0.
- [ ] Both copy-lint vocabularies proven; per-outcome framing + role detection + degradation proven.
- [ ] `tableCooperation` present on both the fresh AND cache-hit served `CoachReport`.
- [ ] `git diff --name-only` = the 5 server files + governance (NO `packages/**`, no fixture/card-data).
- [ ] Flip WORK_INDEX `[ ]→[x]`, EC_INDEX `Pending→Done`, mindmap `📝→✅`, `roadmap:counts:check` 0; D-24540 Active; NUMBER-LEDGER landed; STATUS; `api-endpoints.md` coach-row note (D-11804 — additive field).
- [ ] Two-commit topology (`EC-754:` impl + `SPEC:` close).
- [ ] D-24026 live-verify (payload, post-deploy): a real multi-seat co-op match's `GET /api/me/scores/:replayHash/coach` returns `CoachReport.tableCooperation` framing the shared outcome as a team achievement + the standout roles (freshly-generated report — a pre-WP-717 cached report has no field). On-screen render = follow-up WP.

## Common Failure Smells

- Putting `tableCooperation` on `CoachMatchSummary` (discarded model input — never served/cached; WP-710 PS-1).
- Player-vs-player copy ("you beat Seat 2", "top player") — teammates, not opponents (§23b); use "carried the combat / the most synergy".
- A blame framing for `scheme-wins` (must be a regroup — the two-vocabulary rule).
- A fixture whose "vs" is seat-vs-seat rather than hero-vs-villain (trips or should trip the §23b lint).
- Emitting an empty/zero role line (guard each role on its field being non-zero across the table).
- Reading `G` / the replay / calling the model (v1 is a pure summary derivation — gift attribution + client render are follow-ups).
- Editing `packages/**` (server-only; no engine change).
