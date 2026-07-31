# EC-500 — Honest Per-Reason Copy for the Score-Submission Banner (Execution Checklist)

**Source:** docs/ai/work-packets/WP-465-score-submit-rejection-copy.md
**Layer:** Arena Client (presentation-only, zero-API)

## Before Starting
- [ ] On `origin/main` ≥ `a76892d2` (WP-464 Core-coverage-matrix merged).
- [ ] `pnpm --filter @legendary-arena/arena-client test` + `vue-tsc` + `build` green.
- [ ] Confirm `SubmitScoreResult.error` already carries the reason (no API change needed).

## Locked Values (do not re-derive)
- New `SubmissionStatus` value: `'ineligible'` (terminal, NON-error, no retry).
- Mapping (in `submitOnce`, the non-200 branch): `result.error === 'par_not_published'`
  → `'ineligible'`; EVERY other non-200 (network `status: 0`, `500`, other reasons) →
  `'failed'`. 200 → `'submitted'`/`'already'` unchanged; null token → `'guest'` unchanged.
- Copy (final, verbatim):
  - `ineligible`: `This match isn't part of a ranked gauntlet, so it isn't scored to the leaderboard.`
  - `failed` (reworded, retry-NEUTRAL): `Couldn't submit your score to the leaderboard.`
    (NOT "please try again later" — the `failed` bucket mixes permanent reasons like
    `not_owner`/`visibility_not_eligible`/`replay_verification_failed` with transient
    ones, so any retry promise is dishonest for the permanent members.)
- `SUBMISSION_MESSAGES` type → `Record<Exclude<SubmissionStatus, 'idle'>, string>`
  (idle stays message-less — the banner is hidden while idle).
- New CSS class: `.score-submission-status--ineligible` — a **neutral blue/slate**
  background, explicitly distinct from `--submitted` (green), `--failed` (red), and
  `--guest` (amber); it must not read as success or error. Override only `background`.

## Guardrails
- **Client-only.** Do NOT touch `apps/server/**`, `competitionApi.ts`, `readErrorCode`,
  or the server `SubmissionRejectionReason` union / its canonical array. The reason is
  already on `SubmitScoreResult.error`.
- Map `par_not_published` by string value against `result.error`; do not import server
  types. Only `par_not_published` maps to `'ineligible'` in v1 — the other rejection
  reasons keep `'failed'` (Scope Out).
- Preserve the fire-once (`hasSubmitted`) guard and the guest short-circuit exactly.
- The `ineligible` status is NOT a failure — its CSS + copy must not read as an error
  (the user did nothing wrong; the match simply isn't ranked).
- Reword `failed` to drop "may still be counted shortly" — there is no retry, so the
  old copy is a false promise.

## Required `// why:` Comments
- The `par_not_published` → `'ineligible'` mapping: why this reason is permanent
  ineligibility (casual, non-ranked-gauntlet match), distinct from a retriable failure.
  State that this is an **intentional cross-layer string couple** mirroring
  `apps/server/src/competition/competition.types.ts` `SubmissionRejectionReason` (the
  client cannot import the server enum across the layer boundary), and that an
  unmatched / renamed reason **degrades to `'failed'` by design** (safe, no throw).
- The `SUBMISSION_MESSAGES` type tightening: why `Exclude<…, 'idle'>` (idle has no
  banner, every other status must have copy — compile-enforced).

## Files to Produce
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts` — `'ineligible'` in the union + `result.error` mapping in `submitOnce`.
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.test.ts` — `par_not_published`→`'ineligible'`; `internal_error` 500 + `status:0` network →`'failed'`; the 200 + guest paths still pass.
- `apps/arena-client/src/pages/PlayViewport.vue` — `ineligible` message + reworded `failed` + tightened `SUBMISSION_MESSAGES` type + `--ineligible` CSS variant.

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client test` + `vue-tsc` + `build` exit 0; `pnpm -r build` exit 0.
- [ ] `git diff --name-only` = exactly the three arena-client files (no server churn).
- [ ] `WORK_INDEX.md` row `[x]`; `EC_INDEX.md` → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅` + `pnpm roadmap:counts:write`; `:check` exits 0.
- [ ] `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify operator-pending.

## Common Failure Smells
- `vue-tsc` fails on `SUBMISSION_MESSAGES` → you added `'ineligible'` to the union but not its message (that is the tightened type doing its job — add the copy).
- The `ineligible` banner is styled red like a failure → wrong CSS variant; it is an info note, not an error.
- A server file appears in `git diff` → out of scope; the reason is already client-side.
- `par_not_published` still shows the old failure copy → `submitOnce` still ignores `result.error`.
