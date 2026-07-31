# WP-465 — Honest Per-Reason Copy for the Score-Submission Banner (Arena Client)

**User-Visible Surface:** the post-match score-submission status banner on
`play.legendary-arena.com`. Today every non-200 from `POST /api/competition/scores`
shows *"Couldn't submit your score. It may still be counted shortly."* — misleading
on two counts: there is **no retry** (a fire-once guard prevents re-submission), and
the dominant real cause is `par_not_published` (an ad-hoc, non-ranked-gauntlet match
is **permanently ineligible** for the leaderboard, not a transient failure). Jeff hit
this repeatedly on solo Magneto matches (2026-07-30).

---

## Goal

After this session, the banner distinguishes a **permanent ineligibility** from a
**genuine failure**. A `par_not_published` rejection shows an honest, non-alarming
message ("This match isn't part of a ranked gauntlet, so it isn't scored…"); every
other non-200 keeps a failure message reworded to drop the false "may still be counted
shortly" promise. The fix is **client-only, zero-API** — `SubmitScoreResult.error`
already carries the server's rejection reason; the composable simply reads it instead
of blanket-mapping to `'failed'`.

---

## Assumes

- **WP-339 / EC-369 ✅ (submit-after-match + my-scores).** `useCompetitiveSubmitOnGameover`
  fires `submitCompetitiveScore(token, matchId)` once on the gameover transition and
  maps the result to a `SubmissionStatus` the `PlayViewport` banner renders. Source:
  `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts`;
  `apps/arena-client/src/pages/PlayViewport.vue`.
- **`SubmitScoreResult.error` already surfaces the reason.** `submitCompetitiveScore`
  returns `{ status, wasExisting, record, error }` where `error` is the server's
  `{ error: <code> }` body string on a non-200 (`readErrorCode`). **No API-layer change
  is needed** — the composable already receives the reason, it just ignores it today
  (maps any non-200 → `'failed'`). Source:
  `apps/arena-client/src/lib/api/competitionApi.ts` (`SubmitScoreResult.error`,
  `submitCompetitiveScore`, `readErrorCode`).
- **The server rejection-reason set is a closed union.** `SubmissionRejectionReason` =
  `replay_not_found | not_owner | guest_not_eligible | visibility_not_eligible |
  par_not_published | replay_verification_failed | match_not_finished` (plus the
  route-level `invalid_request` / `forbidden` / `internal_error`). This WP reads
  `par_not_published` by value; it does **not** modify the server union or its
  drift-detection array. Source:
  `apps/server/src/competition/competition.types.ts` (`SUBMISSION_REJECTION_REASONS`).
- **The composable is unit-testable** against a stubbed `globalThis.fetch`
  (`installFetchStub(status, jsonBody)`) + real Pinia stores. A test stubbing
  `(422, { error: 'par_not_published' })` asserts `'ineligible'`; `(500, { error:
  'internal_error' })` asserts `'failed'`. Source:
  `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.test.ts`.
- **Baseline:** `origin/main` @ `a76892d2` (`git rev-parse origin/main` at draft time —
  the WP-464 Core-coverage-matrix merge). Ledger next-free confirmed WP-465 / EC-500;
  **no D-number** (presentation-only, like WP-459 / WP-464).

---

## Context (Read First)

- `.claude/rules/architecture.md` — Layer Boundary (`apps/arena-client` consumes
  read-only projections; UI presentation only). `docs/ai/ARCHITECTURE.md §Engine Owns
  Truth` — the client never decides scoring; it only displays the server's verdict.
- **Why now:** Jeff reported the "Couldn't submit your score. It may still be counted
  shortly." banner recurring on ad-hoc matches (2026-07-30). Investigation showed the
  cause is `par_not_published` (casual matches aren't ranked-gauntlet loadouts), a
  permanent state the copy mislabels as transient — and the `hasSubmitted` guard means
  the promised "shortly" retry never happens.
- **Design choice — client-only, no server change.** The reason is already on the
  wire (`SubmitScoreResult.error`); nothing about the server or the scoring contract
  changes. The WP is a UX-copy + status-mapping fix confined to the two arena-client
  files that own the banner.
- **Design choice — one new `'ineligible'` status, not per-reason granularity.**
  `par_not_published` is the one rejection with a common, user-meaningful explanation
  (casual play), so it earns a dedicated honest message. The other reasons
  (`not_owner`, `visibility_not_eligible`, `replay_not_found`, `match_not_finished`,
  `replay_verification_failed`) are rare on a player's own just-finished match; they
  keep the (reworded, honest) `'failed'` copy. Finer per-reason copy is a clean
  follow-on (Scope Out), avoiding a copy explosion for states users almost never hit.

---

## Scope (In)

- Add `'ineligible'` to the `SubmissionStatus` union in
  `useCompetitiveSubmitOnGameover.ts`.
- In `submitOnce`, on a non-200 result, map `result.error === 'par_not_published'`
  → `'ineligible'`; every other non-200 (including `status: 0` network, `500`, other
  reasons) → `'failed'` (byte-unchanged branch behavior for the failure case).
- `PlayViewport.vue`: add the `ineligible` message; **reword** the `failed` message to
  a retry-neutral honest line (drops the false "may still be counted shortly" — no
  retry exists, and the bucket mixes permanent + transient reasons); **harden**
  `SUBMISSION_MESSAGES` from `Record<string, string>` to
  `Record<Exclude<SubmissionStatus, 'idle'>, string>` so a future status without copy
  is a compile error; add a `.score-submission-status--ineligible` CSS variant with a
  **neutral blue/slate** background — explicitly distinct from `--submitted` (green),
  `--failed` (red), and `--guest` (amber), so it never falsely reads as success; each
  `--variant` overrides only `background`, so existing variants are untouched.
- A `useCompetitiveSubmitOnGameover.test.ts` case: `par_not_published` → `'ineligible'`;
  a genuine failure (`internal_error` 500, and `status: 0` network) → `'failed'`.

## Scope (Out)

- **Any server / API-layer change.** `submitCompetitiveScore`, `competitionApi.ts`,
  `readErrorCode`, and the server route/logic/reason-union are untouched — the reason
  is already surfaced.
- **Per-reason copy for the rare permanent reasons** (`not_owner`,
  `visibility_not_eligible`, `replay_not_found`, `match_not_finished`). They keep the
  reworded `'failed'` copy; distinct messages are a deferred follow-on.
- **The `'guest'` path.** A null-token caller is still short-circuited to `'guest'`
  before any POST (unchanged).
- **The MyProfile / my-scores surface** (`MyProfilePage.vue`) — a different read; not
  the post-match banner.
- **Any retry mechanism.** This WP makes the copy honest about the absence of a retry;
  it does not add one (that would be its own WP touching the fire-once guard).

---

## Files Expected to Change

- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts` — **modified** —
  `SubmissionStatus` gains `'ineligible'`; `submitOnce` reads `result.error`.
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.test.ts` —
  **modified** — the `par_not_published` → `'ineligible'` + failure cases.
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — `ineligible` message,
  reworded `failed` message, tightened `SUBMISSION_MESSAGES` type, new CSS variant.

---

## Contract

- **New `SubmissionStatus` value:** `'ineligible'` — a terminal, **non-error** status
  meaning the finished match is not eligible to be scored (permanent, no retry).
- **Reason mapping (client, presentation-only):** on a non-200 submit result,
  `result.error === 'par_not_published'` → `'ineligible'`; all other non-200 → `'failed'`.
  200 → `'submitted'` / `'already'` (unchanged). This mirrors — never redefines — the
  server's `SubmissionRejectionReason` contract.
- **Copy (final):**
  - `ineligible`: "This match isn't part of a ranked gauntlet, so it isn't scored to
    the leaderboard."
  - `failed` (reworded): "Couldn't submit your score to the leaderboard." — a
    **retry-neutral** honest line. The `failed` bucket is mixed: some members are
    transient (network, 500, `match_not_finished`) and some are permanent (`not_owner`,
    `visibility_not_eligible`, `replay_verification_failed`), so the copy must NOT
    promise a retry ("please try again later" would re-introduce the same false promise
    this WP removes). A retry hint for only the transient subset would need a third
    bucket — deferred (Scope Out).
- **`SUBMISSION_MESSAGES` typing:** `Record<Exclude<SubmissionStatus, 'idle'>, string>`
  — every non-idle status must have copy (compile-enforced). `'idle'` remains
  message-less (the banner is hidden while idle).
- **No server, scoring, or persistence surface changes.** No new `G`/`ctx`/DB/endpoint.

---

## Acceptance Criteria

1. `SubmissionStatus` includes `'ineligible'`.
2. Composable: a submit result `{ status: 422, error: 'par_not_published' }` sets
   `submissionStatus` to `'ineligible'`; `{ status: 500, error: 'internal_error' }` sets
   `'failed'`; `{ status: 200, wasExisting: false }` still sets `'submitted'` and
   `{ wasExisting: true }` `'already'`; a null token still short-circuits to `'guest'`
   with no POST. (The `status: 0` network branch is the SAME `else` path as the 500
   case — `result.error !== 'par_not_published'` → `'failed'`; the existing
   `installFetchStub` always resolves a Response and cannot force a throw, so a separate
   network-throw test is optional, not required — the branch is already covered.)
3. `PlayViewport.vue` renders an honest `ineligible` message (no "may still be counted
   shortly") and the reworded `failed` message; `SUBMISSION_MESSAGES` is typed
   `Record<Exclude<SubmissionStatus, 'idle'>, string>` (adding a status without copy
   fails `vue-tsc`).
4. A `.score-submission-status--ineligible` CSS variant exists with a neutral blue/slate
   background, distinct from `--submitted` (green), `--failed` (red), and `--guest`
   (amber) — it must not read as success or error.
5. `pnpm --filter @legendary-arena/arena-client test` + `vue-tsc` + `build` green;
   `pnpm -r build` green.

---

## Verification Steps

1. `pnpm --filter @legendary-arena/arena-client test` (the new composable cases),
   `pnpm --filter @legendary-arena/arena-client vue-tsc` (the tightened Record type),
   `pnpm --filter @legendary-arena/arena-client build`, then `pnpm -r build`.
2. Dev-server / play-fixture smoke (optional): drive a finished match whose submit
   returns `par_not_published` (or stub it) and confirm the banner shows the ranked-
   gauntlet message with the info (not error) styling.
3. Confirm `git diff` touches only the three arena-client files (no server / API churn).

---

## Definition of Done

- [ ] All 5 Acceptance Criteria pass.
- [ ] `git diff --name-only` = exactly the three arena-client files (no server change).
- [ ] arena-client test + `vue-tsc` + build green; `pnpm -r build` green.
- [ ] `WORK_INDEX.md` row `[x]`; `EC_INDEX.md` → Done; `docs/05-ROADMAP-MINDMAP.md`
      node `✅` + `roadmap:counts:check` green.
- [ ] `User-Visible Surface = play.legendary-arena.com` — **D-24026 live-verify
      operator-pending** on the next CF Pages client deploy.

---

## Lint Gate Self-Review (`00.3`)

All 21 sections resolved at draft (full verdict in the SPEC commit body). Load-bearing:

- **§ Layer boundary:** single layer (`apps/arena-client`), presentation-only. Reads
  the already-surfaced `SubmitScoreResult.error`; imports no server code, changes no
  contract. PASS.
- **§ Determinism / persistence:** none — no `G`/`ctx`, no DB, no endpoint, no scoring
  logic. A client display mapping only. PASS.
- **§ Contract / drift:** does NOT touch the server `SubmissionRejectionReason` union or
  its canonical array; it reads one member (`par_not_published`) by value. The client
  `SubmissionStatus` is a local UI type (not a drift-gated canonical array). PASS.
- **§ Canonical field names:** reuses `error` / the server reason string
  `par_not_published` verbatim; the new status value is `ineligible`. PASS.
- **§ Scope closed:** In/Out enumerated; server changes, per-reason granularity, the
  guest path, my-scores, and any retry mechanism explicitly Out. PASS.
- **§17 vision:** honest post-match feedback; supports (does not gate) competitive
  scoring. No conflict.
- **§20 N/A** (no funding surface — this is score-*display* honesty, not monetization).
  **§21 N/A** — no `apps/server` HTTP endpoint or catalogued library-only function
  added or changed (the server surface is untouched).
- Remaining sections: PASS / N/A as recorded in the commit body.

**Gate verdicts (recorded inline per 01.0a Step 5):**
- **Pre-flight (01.4):** `READY TO EXECUTE` (independent subagent, no blocking PS-items;
  confirmed `SubmitScoreResult.error` already carries the reason so the fix is
  client-only, and that `Exclude<…, 'idle'>` is satisfiable — `idle` genuinely has no
  banner message). RS-item folded into AC-2 (the `status: 0` network branch shares the
  `else` path, so a separate throwing-stub test is optional).
- **Copilot (01.7):** `RISK`, all three concerns resolved in-place before commit —
  (1) **the load-bearing copy fix:** the reworded `failed` line is now retry-neutral
  ("Couldn't submit your score to the leaderboard."), because the `failed` bucket mixes
  permanent + transient reasons and "please try again later" would re-introduce the same
  false promise this WP removes; (2) the `par_not_published` string couple is documented
  as an intentional cross-layer mirror that degrades to `'failed'` on rename (EC
  `// why:`); (3) the `--ineligible` CSS is pinned to neutral blue/slate, distinct from
  green/red/amber. No scope, allowlist, or mutation-boundary change — pre-flight `READY`
  stands.
