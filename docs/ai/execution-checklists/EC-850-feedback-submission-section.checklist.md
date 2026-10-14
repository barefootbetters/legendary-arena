# EC-850 — Send Feedback Section on the Player Profile (Execution Checklist)

**Source:** docs/ai/work-packets/WP-813-feedback-submission-section.md
**Layer:** App: `apps/arena-client` (API client + section component + tests + one planned profile mount; 01.5 not invoked)

## Before Starting
- [ ] WP-604 on `origin/main`: `POST /api/feedback` accepts `{ type, title, description }`.
      It returns `201 { id }`, `400 { error }`, or `401 { error }`. A 500
      carries `internal_error`, `session_verifier_not_configured`, or
      `lookup_failed`. The server feedback logic module has
      `MAX_TITLE_LENGTH = 200` and `MAX_DESCRIPTION_LENGTH = 5000`.
- [ ] WP-605 on `origin/main`: new items show `under_review` in the dashboard
      `/feedback` triage page.
- [ ] `MyProfilePage.vue` mounts `FriendsSection` / `BillingSection` with
      `:auth-token="readAuthToken()"`. `lib/api/apiBaseUrl.ts` exports `buildApiUrl`.
- [ ] PR #2794 (the ewiki audit) is merged; the wiki page has §Implementation
      status with a "Player submission UI" row. **BLOCKED until it merges; then
      re-baseline.**
- [ ] Fresh worktree off `origin/main`. Capture the SHA; the WP baseline is `6b982ff9`.
- [ ] Scope lock: EXACTLY 5 code files (§Files to Produce). Any edit outside them
      means STOP. Governance edits go in the separate SPEC govern-close commit.
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/arena-client typecheck` 0; `test` green.

## Locked Values (do not re-derive)
- `POST` `buildApiUrl('/api/feedback')`. Headers: `Content-Type: application/json`,
  `Accept: application/json`, `Authorization: Bearer <token>`.
- Body keys exactly `type`, `title`, `description`; fields trimmed before sending.
- `FEEDBACK_TITLE_MAX_LENGTH = 200`; `FEEDBACK_DESCRIPTION_MAX_LENGTH = 5000`.
- `FEEDBACK_TYPES = ['bug', 'enhancement', 'review']`. Labels in order:
  "Bug report", "Feature idea", "Review". Default `'enhancement'`.
- `FEEDBACK_API_ERROR_CODES = ['invalid_request', 'invalid_type', 'invalid_title',
  'invalid_description', 'internal_error']`. A 401 is handled by status.
- Root: `id="send-feedback"`, `data-testid="feedback-section"`.
- Success, every kind: "Thanks — we received your feedback." For
  `'enhancement'` only, add: "Feature ideas we plan to build appear on the
  public roadmap." The words *public roadmap* link to
  `https://www.legendary-arena.com/roadmap/`.
- Privacy helper, shown while Feature idea is selected: "If we plan this idea,
  its title and description appear on the public roadmap without your name.
  Don't include personal details."
- Counter = `MAX − value.length` (UTF-16 units). Submitting clears old
  messages. Editing after a success hides it, via user `@input` / `@change`
  handlers, never a `watch`.
- `submitFeedback(authToken: string, input)`.
- Signed out: "Sign in to send feedback." On 401: "Please sign in again."
  Generic failure: "Your feedback could not be sent. Please try again." It
  covers any 500, any unknown code, `invalid_type`, `invalid_request`, and a
  network failure.
- Field limits: `invalid_title` → "Your title needs to be between 1 and 200
  characters." `invalid_description` → "Your description needs to be between 1
  and 5000 characters."
- Test floors: `feedbackApi.test.ts` has at least 12 tests;
  `FeedbackSection.test.ts` has at least 13.

## Guardrails
- Full file contents for every new or modified file (no diffs). ESM only,
  Node v22+, `node:test`, `.test.ts`. No new npm dependency.
- **Session protocol:** if an Assumes item is false, an out-of-allowlist edit
  is needed, or a value is unclear, STOP and ask. Never guess.
- **Client only.** No change under `apps/server`, `packages`, `apps/dashboard`, or `www`.
  No import of server, engine, or `boardgame.io` code; the codes and limits are mirrored by hand.
- **Author from the session, never the body.** The body is the three locked keys.
- **Client validation mirrors the server and does not replace it.** Still map the
  server's 400 codes to copy.
- **Text only** (D-24721). No diagnostics payload; no attachments.
- **No status anywhere in the UI** (D-24416). The section writes one item and
  shows a receipt. It has no list.
- `defineComponent({ setup() { return {...} } })`, not `<script setup>` (D-6512).
- `submitFeedback` never throws. A network failure returns `{ ok: false, status: 0, code: null }`.
- On failure, keep the player's typed text. Never render a raw error code.

## Required Comments
- `// why:` on the two length constants. They mirror the server feedback logic
  module, cited **by name, never by path**: no `apps/server` literal in any new
  file. The server stays authoritative.
- `// why:` on `FEEDBACK_API_ERROR_CODES` (hand-mirrored subset; the mirror pin
  catches client edits, not server drift).
- `// why:` on the `submitFeedback` catch (a network failure becomes a result, not a throw).
- `<!-- why: -->` on the `MyProfilePage.vue` mount citing WP-813 / D-24721.

## Files to Produce
- `apps/arena-client/src/lib/api/feedbackApi.ts` — **new** — submit client, `validateFeedbackDraft`, mirrored codes and limits
- `apps/arena-client/src/lib/api/feedbackApi.test.ts` — **new** — validator boundaries, fetch contract (including a 500 `lookup_failed` case), runtime mirror pins
- `apps/arena-client/src/components/FeedbackSection.vue` — **new** — the Send feedback section
- `apps/arena-client/src/components/FeedbackSection.test.ts` — **new** — the jsdom cases listed in WP §Scope (In) D
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — import, register, mount after billing, and add `.profile-feedback` to the card selector (planned in-allowlist edit)

## After Completing
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) 0; suite green.
- [ ] Absence grep (`apps/server|@legendary-arena/game-engine|boardgame\.io`): no match
      in `feedbackApi.ts` / `FeedbackSection.vue`.
- [ ] `git show --name-only --format= <EC-850 sha>`: exactly the 5 files.
- [ ] **Live-on-surface (D-24026):**
  - Signed in as `jefferyjjensen` on `play.legendary-arena.com/?route=me`,
    submit the Feature idea "WP-813 live-verify" and see the success copy.
  - The item shows Under review in `dashboard.legendary-arena.com/feedback`.
  - Decline it with "Live-verification test item".
- [ ] Governance (SPEC commit): `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md`: land D-24721 Active.
- [ ] `WORK_INDEX.md`: WP-813 checked with the date. `EC_INDEX.md`: EC-850 Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md`: node `📝` → `✅`; `pnpm roadmap:counts:write`;
      `roadmap:counts:check` 0.
- [ ] `wiki/user-feedback-and-public-roadmap.md` (cite WP-813 / D-24721):
      the "Player submission UI" row → ✅ Shipped; §Surfaces records the
      `?route=me` intake; §Open Questions moves "Where players submit" to
      resolved.
