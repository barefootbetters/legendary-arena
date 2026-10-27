# WP-813 — Send Feedback Section on the Player Profile

**Status:** Draft — BLOCKED on PR #2794 (ewiki audit) merging; then re-baseline
**Primary Layer:** `apps/arena-client` (one API client + one section component + their tests + one mount)
**Dependencies:** WP-604 / EC-639 / D-24414 (`POST /api/feedback`), WP-605 / EC-640 / D-24416 (operator triage), WP-104 (`MyProfilePage` at `?route=me`), WP-160 (Hanko bearer token), WP-161 (`buildApiUrl`), WP-352 (the `FriendsSection` profile-section pattern), PR #2794 (the ewiki audit this packet's DoD updates)
**User-Visible Surface:** `play.legendary-arena.com` (`?route=me`, signed in)

> Baseline: `origin/main` at commit `6b982ff9` (SPEC: WP-811 / EC-848 promote `bgio.replay_artifacts.gameover`, #2789).

---

## Session Context

The D-24414 feedback system shipped every part except the front door. WP-604
built the intake store and `POST /api/feedback`, WP-605 built the operator triage
page, and marketing WP-043 / WP-045 put a votable board at
`www.legendary-arena.com/roadmap/`. **Nothing calls `POST /api/feedback`** — not
the play client, the dashboard, the registry viewer, or `www`. On 2026-10-14 the
public `GET /api/feedback` returned `{"items":[]}`, so the board has shown "The
roadmap is empty for now" since launch (ewiki *User Feedback and Public Roadmap*
§Implementation status, audited 2026-10-14). This packet is that front door.

---

## Goal

A signed-in player on `play.legendary-arena.com/?route=me` sees a **Send
feedback** section. They pick a kind (Bug report, Feature idea, or Review), enter
a title and a description, and submit. The section posts to the existing
`POST /api/feedback`, confirms receipt in a full sentence, and clears the form.
The item lands in the operator's `dashboard.legendary-arena.com/feedback` queue
as `under_review`. Feature ideas reach the public `/roadmap/` board once the
operator moves them to Planned, In progress, or Shipped. No server, engine, or
dashboard code changes.

---

## User-Visible Impact

Players can, for the first time, report a bug, suggest a feature, or leave a
review from inside the game. Nothing changes for signed-out visitors or guests:
`?route=me` already sends them to sign-in.

---

## Assumes

- WP-604 on `main`: `POST /api/feedback` (`authenticated-session-required`)
  accepts `{ type, title, description }` with `type ∈ { 'bug', 'enhancement',
  'review' }`, title trimmed 1–200 chars, description trimmed 1–5000 chars
  (`apps/server/src/feedback/feedback.logic.ts` `MAX_TITLE_LENGTH` /
  `MAX_DESCRIPTION_LENGTH`). It returns `201 { id }`, or `400 { error:
  'invalid_request' | 'invalid_type' | 'invalid_title' | 'invalid_description' }`,
  or `401 { error: <SessionValidationCode> }`. A 500 carries one of three
  codes: `{ error: 'internal_error' }` from the insert, or
  `'session_verifier_not_configured'` / `'lookup_failed'` from
  `statusForSessionValidationCode` (`feedback.routes.ts`, around line 170). The
  `api-endpoints.md` `POST /api/feedback` row lists only `internal_error`; that
  is existing catalog drift, outside this packet.
- The route parses its own JSON body (`ensureJsonBodyParsed`), so a client
  `Content-Type: application/json` POST reaches the validator.
- WP-605 on `main`: new items appear in `dashboard.legendary-arena.com/feedback`
  as `under_review`, and only the dashboard sets status (D-24416).
- `MyProfilePage.vue` mounts profile sections as children that take an
  `:auth-token="readAuthToken()"` prop (the `FriendsSection` / `BillingSection`
  precedent, around line 1870).
- `apps/arena-client/src/lib/api/apiBaseUrl.ts` exports `buildApiUrl(path)`.
- `apps/arena-client/src/lib/api/friendsApi.ts` is the client-API shape to
  mirror: a hand-mirrored closed-set error-code array pinned by a test, plus
  `{ ok: true, value } | { ok: false, status, code }` results. Like the friends
  precedent, the pin compares the mirror against a hand-written list. It catches an accidental client edit, not server drift, so a server
  change still needs a lockstep edit.
- PR #2794 (ewiki audit, `infra/ewiki-roadmap-audit`) is merged. It adds the
  §Implementation status table, with the "Player submission UI" row, to
  `wiki/user-feedback-and-public-roadmap.md`, and renames §The feedback item to
  "(as built)". This packet cites both, and its DoD updates that page.
  **BLOCKED until #2794 merges; then re-baseline** off the new `origin/main`.
- `pnpm -r build` exits 0. On `6b982ff9`, `pnpm --filter @legendary-arena/arena-client typecheck`
  exits 0 and `test` passes.

If any of these is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `wiki/user-feedback-and-public-roadmap.md` (as of #2794) — the design authority:
  §Implementation status (why this is next), §Stage 1, §The feedback item (as
  built), §Surfaces and authority.
- `docs/ai/DECISIONS.md` D-24414 (build custom) and D-24416 (dashboard is the
  sole status writer).
- `apps/server/src/feedback/feedback.routes.ts` (the `POST /api/feedback`
  handler) and `feedback.types.ts` (`FeedbackType`, `FeedbackErrorCode`).
- `apps/arena-client/src/lib/api/friendsApi.ts` + `friendsApi.test.ts` — the
  client API module and mirror-pin pattern to follow.
- `apps/arena-client/src/components/FriendsSection.vue` + `.test.ts` — the
  profile-section pattern: `defineComponent` + `setup()` returning bindings
  (D-6512), and full-sentence error copy per code.
- `apps/arena-client/src/pages/MyProfilePage.vue` — the profile-section mount
  block (`<section class="profile-friends">` … `<section class="profile-billing">`).
- `MyProfilePage.vue` is a **planned, in-allowlist edit**, not a 01.5
  runtime-wiring allowance. 01.5 covers forced edits *outside* the allowlist
  that add no behavior; this mount adds a UI behavior, so it is listed
  explicitly. 01.5 is **not invoked** by this packet.

---

## Non-Negotiable Constraints

**Always apply:**
- Output the full file contents for every new or modified file: no diffs, no
  snippets. ESM only, Node v22+; tests use `node:test` / `node:assert` in
  `.test.ts` files. No new npm dependency.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`. Every
  function has JSDoc. No nested ternaries, no `.reduce()` with branching.
- `defineComponent({ setup() { return {...} } })`, not `<script setup>` (D-6512 /
  the vue-sfc-loader test pipeline).
- The arena-client may not import `apps/server/**`. The error-code union and
  length limits are hand-mirrored and pinned by tests, never imported.
- Full-sentence user-facing error copy (00.6 Rule 11). Never show a raw error code.

**Packet-specific:**
- **No server, engine, dashboard, or `www` change.** The API contract is fixed by
  WP-604; this packet only consumes it.
- **The author comes from the session, never the body.** The request body is
  exactly `{ type, title, description }`.
- **Client validation mirrors the server and never replaces it.** Trim, then
  check 1–200 / 1–5000 before sending. The server's 400 codes still map to
  copy, because the server is authoritative.
- **Text only.** No diagnostics payload or attachment (D-24721). The API has no
  field for one.
- **Players never see or set status.** The section writes one item and shows a
  receipt; it does not list submissions or show status (D-24416).

**Locked values:**
- Endpoint: `POST` `buildApiUrl('/api/feedback')`, headers `Content-Type:
  application/json`, `Accept: application/json`, `Authorization: Bearer <token>`.
- `FEEDBACK_TITLE_MAX_LENGTH = 200`, `FEEDBACK_DESCRIPTION_MAX_LENGTH = 5000`.
- Kind labels, in display order: `'bug'` → "Bug report", `'enhancement'` →
  "Feature idea", `'review'` → "Review". Default selection: `'enhancement'`.
- `FEEDBACK_API_ERROR_CODES` = `['invalid_request', 'invalid_type',
  'invalid_title', 'invalid_description', 'internal_error']`. These are the
  WP-604 submit-path subset of the server's `FeedbackErrorCode`. A 401 is
  handled by HTTP status, not by code.
- Section anchor: the section root has `id="send-feedback"` and
  `data-testid="feedback-section"`.
- Success copy depends on the kind that was submitted:
  - Every kind: "Thanks — we received your feedback."
  - Only `'enhancement'` adds a second sentence: "Feature ideas we plan to
    build appear on the public roadmap." The words *public roadmap* link to
    `https://www.legendary-arena.com/roadmap/`.
  - Bug reports and reviews never show the roadmap sentence.
- Privacy helper, shown under the description only while Feature idea is
  selected: "If we plan this idea, its title and description appear on the
  public roadmap without your name. Don't include personal details."
- Remaining-characters counter: `MAX − value.length`. The count is in UTF-16
  code units, which matches the `maxlength` attribute and the server's
  `.length` check.
- Message lifecycle:
  - Submitting clears any previous success or error message.
  - Editing any field after a success hides the success message. Do this from
    the fields' user `@input` / `@change` handlers, **never a `watch`**. The
    post-success form reset would fire a watcher and hide the message at once.
- Signed-out copy (`authToken === null`): "Sign in to send feedback."
- Field-limit copy: `invalid_title` → "Your title needs to be between 1 and 200
  characters." `invalid_description` → "Your description needs to be between 1
  and 5000 characters."
- 401 copy: "Please sign in again."
- Generic copy: "Your feedback could not be sent. Please try again." It covers
  any 500 (including `session_verifier_not_configured` / `lookup_failed`), any
  code outside `FEEDBACK_API_ERROR_CODES`, `invalid_type`, `invalid_request`,
  and a network failure (`status: 0`).

**Session protocol:** STOP and ask, never guess, if any of these happens:
- an Assumes item is false;
- a file outside `## Files Expected to Change` would need to change;
- a locked value is unclear.

---

## Scope (In)

### A) `apps/arena-client/src/lib/api/feedbackApi.ts` (**new**)
- `FEEDBACK_TYPES` (`['bug', 'enhancement', 'review'] as const`) and the
  `FeedbackType` type.
- `FEEDBACK_TITLE_MAX_LENGTH` and `FEEDBACK_DESCRIPTION_MAX_LENGTH`, each with
  a `// why:` saying it mirrors the server feedback logic module's limits. Cite
  the module **by name, never by path**. No new file may contain the literal
  `apps/server`: it would trip the absence grep. Follow `friendsApi.ts`.
- `FEEDBACK_API_ERROR_CODES`, the `FeedbackApiErrorCode` type, and a private
  `narrowFeedbackApiCode`.
- `validateFeedbackDraft(draft)`, a pure function. It returns
  `{ ok: true, value: { type, title, description } }` with trimmed fields, or
  `{ ok: false, field: 'title' | 'description' }` for the first field that is
  empty or too long.
- `submitFeedback(authToken: string, input)`. The token is always a non-null
  string, because the section never calls it while signed out. It returns `{ ok: true, value: { id } }`
  on 201, or `{ ok: false, status, code }` otherwise. A network failure returns
  `status: 0, code: null`. It never throws: a `try/catch` around `fetch` and
  the JSON parse carries a `// why:`.

### B) `apps/arena-client/src/lib/api/feedbackApi.test.ts` (**new** — at least 12 tests)
- `validateFeedbackDraft` cases: trims; rejects an empty or whitespace-only
  title or description; accepts exactly 200 and 5000 chars; rejects 201 and
  5001.
- `submitFeedback` with a stubbed `globalThis.fetch`, covering:
  - The request is a POST to the `/api/feedback` URL, with the three headers
    and the exact body keys `type`, `title`, `description`.
  - A 201 returns `{ ok: true, value: { id } }`.
  - A 400 `invalid_title` returns `code: 'invalid_title'`.
  - A 401 returns `status: 401`.
  - A 500 `lookup_failed` returns `{ status: 500, code: null }`.
  - A rejected fetch returns `{ status: 0, code: null }`.
- **Mirror pins (runtime assertions).** These catch an accidental client edit,
  not server drift:
  - `FEEDBACK_API_ERROR_CODES` set-equals the hand-written submit-path subset
    listed in this WP.
  - `FEEDBACK_TYPES` equals `['bug', 'enhancement', 'review']`.
  - The two length constants equal 200 and 5000.

### C) `apps/arena-client/src/components/FeedbackSection.vue` (**new**)
- Prop `authToken: string | null`. When it is null, render only the signed-out
  line.
- A kind `<select>` (or radio group) with the three locked labels; default
  `'enhancement'`.
- A title `<input maxlength="200">` and a description
  `<textarea maxlength="5000">` with a live remaining-characters count.
- A Submit button. It is disabled while a request is in flight, or when
  `validateFeedbackDraft` fails.
- The locked privacy helper shows while Feature idea is selected.
- On success, show the kind-dependent success copy, then reset title,
  description, and kind (back to `'enhancement'`).
- On failure, show the locked copy for the outcome (field-limit, 401, or
  generic) and keep what the player typed.
- `data-testid` hooks on the root (`feedback-section`), kind, title,
  description, submit, success, and error elements.
- A file-level comment cites D-24414, D-24416, and D-24721.

### D) `apps/arena-client/src/components/FeedbackSection.test.ts` (**new** — at least 13 tests)
jsdom tests with a stubbed `fetch`:
- With a null token, only the signed-out line renders.
- With a valid description entered: Submit is disabled for an empty title and
  for a whitespace-only title, and enabled for a valid one.
- The root has `id="send-feedback"`. The kind options are, in order, Bug
  report / Feature idea / Review, with Feature idea selected by default.
- The privacy helper shows for Feature idea and is absent for Bug report.
- A happy-path Feature idea submit sends the trimmed body, shows both success
  sentences and the roadmap link, and resets the form.
- A Bug report submit (select `bug` first) shows only "Thanks — we received
  your feedback." with no roadmap sentence. Afterwards the kind is back to
  `enhancement`.
- A 400 `invalid_description` shows the description-limit sentence and keeps
  the typed text.
- A 400 `invalid_title` shows the title-limit sentence.
- A rejected `fetch` (network failure) shows the generic sentence and keeps
  the typed text.
- After a success, typing in the title hides the success message.
- A 401 shows "Please sign in again." and keeps the typed text.
- A 500 `lookup_failed` shows the generic sentence, and no raw code appears in
  the DOM.
- In-flight: use a deferred `fetch` stub. Assert the button is disabled
  before the stub resolves. Resolve it with a 500, then assert the button is
  re-enabled and the typed text is still present.

### E) `apps/arena-client/src/pages/MyProfilePage.vue` (**modified — planned in-allowlist mount**)
- Import `FeedbackSection`, register it in `components`, and mount
  `<section class="profile-feedback"><FeedbackSection :auth-token="readAuthToken()" /></section>`
  after the billing section. Add a `<!-- why: -->` comment citing WP-813 and
  D-24721.
- Add `.profile-feedback` to the existing card-treatment selector list (the
  `.profile-form, … .profile-billing` rule), so the section gets the same card
  styling as its siblings.
- Nothing else on the page changes.

---

## Out of Scope

- **Any server change.** That covers a rate limit on `POST /api/feedback`, a
  diagnostics field on bug reports, and gating reviews to accounts that have
  played a match. Each is a separate server WP citing D-24414.
- **A "My feedback" list or status view for the submitting player.** No API
  returns a player's own items. Closing the loop for the submitter is a
  follow-on that needs a new server route.
- **A link to this section from `www.legendary-arena.com/roadmap/`.** That is
  the marketing repo, which has its own governance and WP.
- **A dashboard "create item" action** for operator seeding (WP-605 surface).
- **The player changelog and the monthly recap post** (D-24414 Stage 4 follow-ons).
- **An in-match entry point** (a play-surface button). The play surface is
  crowded (WP-610 precedent); the profile page comes first.
- **The `api-endpoints.md` `POST /api/feedback` row drift.** The row omits
  the 500 `session_verifier_not_configured` / `lookup_failed` codes. This is
  existing catalog drift and gets a separate small `INFRA:` fix.
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/feedbackApi.ts` — **new** — submit client, draft validator, mirrored codes and limits
- `apps/arena-client/src/lib/api/feedbackApi.test.ts` — **new** — validator, fetch, and mirror-pin tests
- `apps/arena-client/src/components/FeedbackSection.vue` — **new** — the Send feedback section
- `apps/arena-client/src/components/FeedbackSection.test.ts` — **new** — jsdom section tests
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — mount the section and add `.profile-feedback` to the card selector (planned in-allowlist edit; 01.5 not invoked)

- Governance, in the separate `SPEC:` govern-close commit:
  - `docs/ai/STATUS.md`
  - `docs/ai/DECISIONS.md` (D-24721)
  - `docs/ai/work-packets/WORK_INDEX.md`
  - `docs/ai/execution-checklists/EC_INDEX.md`
  - `docs/05-ROADMAP-MINDMAP.md`
  - `wiki/user-feedback-and-public-roadmap.md`

No other **code** files may be modified. The `EC-850:` implementation commit
touches exactly these 5. The STATUS / DECISIONS / WORK_INDEX / EC_INDEX /
mindmap / ewiki-status edits go in the separate `SPEC:` govern-close commit.

---

## Contract

Client-side only. The section consumes the WP-604 `POST /api/feedback` contract
unchanged. The new exports are client-internal (`feedbackApi.ts`):
`FEEDBACK_TYPES`, `FeedbackType`, `FEEDBACK_TITLE_MAX_LENGTH`,
`FEEDBACK_DESCRIPTION_MAX_LENGTH`, `FEEDBACK_API_ERROR_CODES`,
`FeedbackApiErrorCode`, `validateFeedbackDraft`, and `submitFeedback`. No
contract file (`.types.ts` / `.validate.ts` / `.gating.ts`) is created.

---

## Limitations

- **Spam.** `POST /api/feedback` has no per-account rate limit (WP-604). One
  signed-in account can submit many items. Two things contain the risk: the
  account requirement, and the operator, who sees everything in triage before
  anything goes public. Nothing reaches the public board without an operator
  status change. If volume becomes a problem, add a server rate limit
  (follow-on).
- **No authenticity check for reviews.** A review is accepted from any
  signed-in account, including one that has never finished a match. The design
  page's "match-having account" fence is a server follow-on.
- **No receipt history, and no closing of the loop for the submitter.** After a
  reload, the player cannot see what they sent or its status. A Declined item
  is invisible both publicly and to its author, so the ewiki §Success metrics
  goal "A player can see their request accepted, declined, or completed" is not
  met for the submitter in v1. Closing the loop needs a player-scoped read route
  (follow-on).
- **Feature-idea text is published verbatim.** `GET /api/feedback` returns the
  `description` as submitted, and triage can set only status and reason, so
  the operator cannot redact. The operator can publish the text as written or
  Decline it. The privacy helper warns the player before they submit. A
  redaction or "edit before publish" triage action is a follow-on.
- **Reviews are text only.** The Review kind collects a title and a
  description. It has no star rating and no check that the author has played
  a match, unlike the ewiki §Reviews sketch. Reviews have no display surface
  yet, so they serve as operator-visible input only.
- **The profile mount has no unit test.** `MyProfilePage.vue` has no test file.
  The mount is verified by the presence grep and the live check. This is
  accepted, because adding a page-level harness would exceed the packet.

---

## Vision Alignment

Touches player accounts (Vision §3 *Player Trust & Fairness*, §7a *Identity
Boundary*). Submission is gated on the existing authenticated session; it adds
no new identity, progression, or account field, and the author is the session
account, never the body. No scoring, PAR, leaderboard, RNG, replay, card-data,
or monetization surface. No engine, `G`, `ctx`, or hash surface.

**Vision clauses touched:** §3, §7a.

**No conflict:** this WP preserves all touched clauses.

**Non-Goal proximity:** this WP adds no monetization surface, so NG-1..7
are not engaged. NG-8 is not crossed: this surface adds no upvote, follower,
or reputation signal. Whether WP-604 roadmap voting sits within NG-8 is
outside this packet.

Feedback is a signal, not authority (ewiki principle 1): nothing a player
submits changes gameplay or what ships without the operator acting on it.

## Funding Surface Gate

N/A — no funding affordance, channel, or donate/support copy. The success copy
links to the public roadmap only.

## API Catalog

N/A. The packet consumes `POST /api/feedback` unchanged, adds no endpoint, and
changes no row's status or shape. The row is already `Wired`. This WP adds its
first client consumer, which is not a catalog column (D-11804).

---

## Acceptance Criteria

All binary pass/fail.

- [ ] A signed-in `?route=me` renders `[data-testid="feedback-section"]` with
  `id="send-feedback"`. A null token renders only "Sign in to send feedback."
- [ ] The kind control offers exactly Bug report / Feature idea / Review, in
  that order, with Feature idea selected by default.
- [ ] `validateFeedbackDraft` trims and enforces title 1–200 and description
  1–5000. The boundary tests (200/201 and 5000/5001) pass.
- [ ] `submitFeedback` sends a POST to `/api/feedback` with the bearer,
  `Content-Type`, and `Accept` headers, and a body whose keys are exactly
  `type`, `title`, `description`.
- [ ] A 201 shows "Thanks — we received your feedback." For Feature idea it
  also shows the roadmap sentence, linked to
  `https://www.legendary-arena.com/roadmap/`; a Bug report or Review never
  shows it. The form resets.
- [ ] The privacy helper shows only while Feature idea is selected.
- [ ] A 400 per-field code, a 401, a 500 (any code), and a network failure each
  show their locked full-sentence message. No raw code is rendered, and the
  typed text is kept.
- [ ] Submit is disabled while a request is in flight and while the draft is
  invalid.
- [ ] Runtime mirror pins hold: the error-code subset, `FEEDBACK_TYPES`, 200,
  and 5000. `feedbackApi.test.ts` has at least 12 tests, and
  `FeedbackSection.test.ts` has at least 13.
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/arena-client typecheck` 0;
  the arena-client suite is green.
- [ ] The `EC-850:` implementation commit (`git show --name-only <sha>`) is exactly the 5 files in §Files
  Expected to Change. No file under `apps/server`, `packages`, or
  `apps/dashboard` is touched.

---

## Verification Steps

```pwsh
pnpm -r build
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: all exit 0; the new feedbackApi + FeedbackSection tests pass

Select-String -Path "apps\arena-client\src\pages\MyProfilePage.vue" -Pattern "FeedbackSection"
# Expected: the import, the components registration, and the mount

Select-String -Path "apps\arena-client\src\lib\api\feedbackApi.ts","apps\arena-client\src\components\FeedbackSection.vue" -Pattern "apps/server|@legendary-arena/game-engine|boardgame\.io"
# Expected: no matches (layer boundary)

git show --name-only --format= <EC-850 sha>
# Expected (run on the EC-850: implementation commit): exactly the 5 files above
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] **User-visible verification (surface = `play.legendary-arena.com`,
  D-24026).** On the deployed client, signed in as the operator account
  (`jefferyjjensen`):
  - `?route=me` shows the Send feedback section.
  - Submitting a Feature idea titled `WP-813 live-verify` shows the success
    copy.
  - The item appears in `dashboard.legendary-arena.com/feedback` as Under
    review.
  - The operator then Declines it with the reason "Live-verification test
    item", so it never reaches the public board.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/arena-client typecheck` 0; suites green.
- [ ] No **code** files outside `## Files Expected to Change` modified.
- [ ] `docs/ai/STATUS.md` updated. `docs/ai/DECISIONS.md`: land D-24721 Active.
- [ ] `docs/ai/work-packets/WORK_INDEX.md`: WP-813 checked off with the date.
  `docs/ai/execution-checklists/EC_INDEX.md`: EC-850 Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md`: node `📝` → `✅`, then `pnpm roadmap:counts:write`;
  `pnpm roadmap:counts:check` exits 0.
- [ ] `wiki/user-feedback-and-public-roadmap.md`, citing WP-813 / D-24721:
  - §Implementation status: the "Player submission UI" row flips to ✅
    Shipped.
  - §Surfaces and authority: the intake surface is recorded as the play
    client's `?route=me` section.
  - §Open Questions: "Where players submit" moves to the resolved list.

---

## Lint Gate Self-Review (00.3)

Ran 00.3 (all 21 sections) as an **independent subagent** (2026-10-14).

**Round 1: FAIL.** Three sections failed:
- §2: missing the full-file / Node v22+ / session-protocol items.
- §5: governance and wiki files were not listed.
- §17: no conflict assertion and no NG-proximity line.

All three are fixed in place. Round 1 also corrected this self-review's own
claims:
- the Out of Scope count;
- §7's implicit "no new dependency", now explicit in §2;
- §19, which is a commit-time rule and so N/A;
- §21, where the catalog column set comes from D-11801, not D-11804.

**Round 2: PASS** (2026-10-14, independent subagent; all 21 sections). The
per-section record below matches the round-2 report.

- §1 Structure — PASS. All required sections are present. Out of Scope has 8
  bullets.
- §2 Constraints — PASS. Always-apply covers full-file output, ESM, Node v22+,
  `node:test` and no new dependency. Packet-specific rules, locked values and
  the session protocol are present.
- §3 Assumes — PASS. Every line is cited. #2794 is a hard BLOCKED dependency.
- §4 Context — PASS.
- §5 Files — PASS. 5 code files, plus governance files listed by path for the
  SPEC commit. 01.5 is not invoked.
- §6 Naming — PASS. Matches the WP-604 `SubmitFeedbackInput`.
- §7 Deps — PASS. No new npm dependency (stated in §2).
- §8 Boundaries — PASS. Client only, with an absence grep.
- §9 Windows — PASS.
- §10 Env — N/A. No new env var.
- §11 Auth — PASS. Consumes the existing Hanko bearer; `## Limitations` is
  present.
- §12 Tests — PASS. Floors of 12 and 13 against at least 13 listed cases each.
- §13 Commands — PASS.
- §14 Acceptance — PASS. 11 binary items.
- §15 / §15.1 — PASS. Surface header, User-Visible Impact, and a D-24026 live
  step with cleanup.
- §16 Code style — PASS.
- §17 Vision — PASS. Clauses §3 and §7a; no conflict; NG proximity stated.
- §18 Prose-vs-grep — PASS.
- §19 Bridge-vs-HEAD — N/A. Commit-time rule; re-baseline is required after
  #2794.
- §20 Funding — N/A, with the reason given.
- §21 API catalog — N/A. A consumer of an existing endpoint is not a §21.1
  trigger, and no column changes (D-11801 column set).

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-10-14, independent subagent; five passes).**

- **Pass 1: NOT READY.** Three PS-items, all fixed:
  - PS-1: the cited ewiki sections exist only on unmerged #2794, so #2794 is
    now a hard Assumes.
  - PS-2: the `MyProfilePage.vue` mount was mislabelled as 01.5 wiring. It is
    now a planned in-allowlist edit, and 01.5 is not invoked.
  - PS-3: the 500 contract omitted `session_verifier_not_configured` /
    `lookup_failed`. The generic copy is now locked for any 500, with tests.
  - RS-1 through RS-6 were applied. RS-7 was withdrawn: the Step 7 commit
    follows the gates by design.
- **Passes 2 and 3: READY TO EXECUTE.** The two leftover wording slips (RS-A,
  RS-B) were fixed and confirmed.
- **Pass 4 (after the copilot fixes): READY TO EXECUTE.** Its items were
  applied:
  - AC7 tests: `invalid_title` in the DOM, and a network failure.
  - RS-C: hide the success message from user input events, never a watcher,
    with a test.
  - RS-D: the EC was collapsed.
  - RS-E: this record was corrected.
- **Pass 5: READY TO EXECUTE.** It confirmed the pass-4 items.
- **Dependencies verified:**
  - Server contract: the codes are reachable on the submit path; limits are
    200/5000; the route parses its own body; it is registered at
    `server.mjs:1131`.
  - CORS: `play.legendary-arena.com` is allowlisted, and `sendFriendRequest`
    is a working authenticated JSON POST precedent.
  - `buildApiUrl` and `readAuthToken` exist.
  - WP-604/605/104/160/161/352 are all `[x]`.
- **Baseline:** observed by the drafting session, not by the read-only
  pre-flight, on this branch (`6b982ff9` + draft docs). `pnpm -r build` 0;
  arena-client `typecheck` 0; arena-client `test` 2351 / 2351 pass.

---

## Copilot Check (01.7)

**Verdict: PASS (2026-10-14, independent subagent; three rounds).** In round 1,
the verdict was RISK / HOLD. Round 2 (re-audit after the fixes) was PASS, plus
one optional wording fix: the Limitations misquoted ewiki principle 5. That
line now quotes §Success metrics verbatim.

Round 1: It found
nothing architectural (#1, #12, #29 PASS), and the mirror is complete (#10
PASS). Findings applied in place:

1. The success copy over-promised (Declined ideas never appear, and bugs and
   reviews have no public surface). It is now kind-dependent.
2. Players weren't told their idea text may go public verbatim. Added the
   privacy helper and a Limitations bullet.
3. The DoD left the design page contradicting D-24721. It now also updates
   §Surfaces and §Open Questions.
4. The Assumes contradicted itself. It now says BLOCKED until #2794 merges.
5. Some tests were vacuous or unobservable. Fixed: the empty-title case gets a
   valid description first; the in-flight test uses a deferred stub; the
   kind-reset test selects `bug` first. Added tests for the order/default/id
   ACs, and raised the floor to 10 (13 after pre-flight pass 4).
6. The counter and message lifecycle were unlocked. Both are now locked.
7. The token type was unlocked. It is now `authToken: string`.
8. D-24721 is trimmed to the decision itself.

**Round 3 (delta after the lint fixes): RISK, then fixed in place, with no
re-check needed; lint round 2 confirmed the rewording.** The NG-proximity
line overreached: NG-1..7 are monetization
non-goals, and NG-8 lists "upvote / endorsement counters" with no item
carve-out. It is reworded to make no claim about WP-604 voting.

**Documented concerns (accepted for v1):** no loop closure for the submitter;
verbatim publication of idea text (no redaction); reviews are text only with
no match check. See `## Limitations`.

---

## Reserved Decisions (land at execution)

- **D-24721 (reserved 2026-10-14 in #2795; not yet landed).** The player
  intake surface for the D-24414 feedback system lives in the play client's
  signed-in profile page (`?route=me`, a "Send feedback" section), not on
  `www`. Reasons:
  - The play client already holds the player's session and a
    profile-section pattern.
  - It keeps the marketing site a read-only projection plus voting, which is
    the WP-043 posture.

  v1 posts **text only**: the WP-604 API has no diagnostics field. Unthrottled
  intake is accepted for v1, because every item passes operator triage before
  anything goes public.

---

## See Also

- [WP-604](WP-604-feedback-intake-and-voting-api.md) / D-24414 — the API this consumes
- [WP-605](WP-605-feedback-triage-panel.md) / D-24416 — where submissions land
- ewiki [User Feedback and Public Roadmap](../../../wiki/user-feedback-and-public-roadmap.md) — the design authority
- Marketing repo WP-043 / WP-045 — the `/roadmap/` board these submissions feed
