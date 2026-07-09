# WP-339 — Arena-Client Submit-After-Match + "My Scores" Profile View (WP-5b)

**Status:** Done (executed 2026-07-08)
**Primary Layer:** Client (`apps/arena-client/**`)

> **Execution addendum (2026-07-08).** `MyProfilePage.test.ts` does not exist, so no page
> test was added (the section is covered by vue-tsc + the api/composable unit tests). The
> `matchId` prop is passed to the composable via `toRef(props, 'matchId')` so it stays
> reactive. Gates: `pnpm -r build` 0; `arena-client` `typecheck` 0; `arena-client` `test`
> **760/760**. Live-verify is the deploy-dependent D-24026 pass (see Verification Steps).
**Dependencies:** D-24119 (arc), D-24126 (the WP-338 server surfaces this consumes), WP-338 (`POST /api/competition/scores { matchId }` + `GET /api/me/scores`), WP-160/D-16003 (Pinia auth token), WP-104 (`ownerProfileApi` HTTP pattern), D-16501 (matchId prop-drill to `PlayViewport`)
**EC:** EC-369
**Baseline:** `origin/main` at `46cd3bd3` (2026-07-08)
**User-Visible Surface:** `play.legendary-arena.com` (D-24026 live-verify post-deploy — see note)
**Reserves:** D-24127

---

## Goal

Close the capture→submit→score→leaderboard loop at the **client**, the last piece of the
D-24119 arc. After this packet, when an authenticated player's match reaches gameover, the
arena-client automatically **submits** the match's competitive score (by `matchId` — the
server resolves + captures + verifies + auto-publishes per WP-338), and the player's owner
profile shows a **"My Scores"** list of their submitted competitive scores. Guests are not
submitted (no token). The submission is fire-once-per-match and idempotent server-side; a
small status indicator tells the player what happened.

---

## Assumes

- **WP-338 Done (D-24126 Active).** `POST /api/competition/scores` accepts `{ matchId }`
  (`authenticated-session-required`) → `200 { record, wasExisting }` or `{ error }`
  (`400/401/403/404/409/422/500`); `GET /api/me/scores` (`authenticated-session-required`)
  → `200 { scores: CompetitiveScoreRecord[] }`.
- **The client has `matchId` but never a `replayHash`** — confirmed: the `gameOver` UIState
  projection (`UIGameOverState`) carries no hash; `matchId` is prop-drilled to
  `PlayViewport` (D-16501). The server resolves the hash (WP-338), so the client submits
  `matchId` only.
- **Gameover is observed passively** from the live UIState snapshot
  (`useUiStateStore().snapshot`); `snapshot.gameOver` is defined (and `snapshot.game.phase`
  is `'end'`) at gameover. There is **no** existing watcher that fires a side effect on the
  gameover transition — this packet adds one.
- **The auth bearer token** lives in the Pinia auth store (`useAuthStore().token`,
  WP-160/D-16003); `token === null` for a guest.
- **The HTTP pattern** is a typed `fetch` wrapper in `lib/api/` that attaches
  `Authorization: Bearer <token>` and never throws (network failure → `status: 0`) —
  canonical example `lib/api/ownerProfileApi.ts` (+ its `.test.ts`). Base URL via
  `buildApiUrl` (`apiBaseUrl.ts`, `VITE_API_BASE_URL`).
- `pnpm -r build` exits 0 on `main`; `apps/arena-client` `typecheck` (vue-tsc) + `test`
  (`node:test` + vue-sfc-loader) pass their baseline.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `apps/arena-client/src/lib/api/ownerProfileApi.ts` (+ `.test.ts`) — the never-throw
  Bearer-fetch pattern to mirror; `lib/api/apiBaseUrl.ts` (`buildApiUrl`).
- `apps/arena-client/src/stores/auth.ts` (`useAuthStore().token`);
  `apps/arena-client/src/stores/uiState.ts` (`snapshot`); `bgioClient.ts` (snapshot write).
- `apps/arena-client/src/pages/PlayViewport.vue` (has the `matchId` prop — the watcher
  mount point) and `pages/MyProfilePage.vue` (`<section data-testid="my-profile-*">`
  blocks + `readAuthToken()` — the "My Scores" home).
- The server contract: `apps/server/src/competition/competition.types.ts`
  (`CompetitiveScoreRecord`, the response shape) — mirror the fields the client renders as
  a LOCAL client-side interface (the client must NOT import server types).
- `docs/ai/DECISIONS.md` D-24126 (the server surfaces); D-24026 (live-verify).

---

## Non-Negotiable Constraints

**Engine-wide (client):** ESM only. Vue 3 `<script setup>` / composition API consistent
with the surrounding files. `apps/arena-client` `tsconfig` has `noUncheckedIndexedAccess` —
guard every array/index access. Tests: `node:test` (+ `@legendary-arena/vue-sfc-loader`
for `.vue`), `.test.ts` only. The client imports NOTHING from `apps/server/**` or
`packages/game-engine` runtime — it talks to the server over HTTP only.

**Packet-specific:**
- **`lib/api/competitionApi.ts`** — a new typed HTTP module mirroring `ownerProfileApi.ts`:
  - `submitCompetitiveScore(authToken: string | null, matchId: string)` → POSTs
    `{ matchId }` to `/api/competition/scores`; returns a typed result
    `{ status: number; record?: MyCompetitiveScore; wasExisting?: boolean; error?: string }`
    (never throws; `status: 0` on network failure; `Authorization: Bearer` only when
    `authToken !== null`).
  - `fetchMyScores(authToken: string | null)` → GETs `/api/me/scores` → `{ status: number;
    scores?: MyCompetitiveScore[]; error?: string }`.
  - `MyCompetitiveScore` is a LOCAL interface mirroring the server's `CompetitiveScoreRecord`
    display fields (`submissionId`, `replayHash`, `scenarioKey`, `rawScore`, `finalScore`,
    `parVersion`, `scoringConfigVersion`, `stateHash`, `createdAt`) — no server import.
- **`composables/useCompetitiveSubmitOnGameover.ts`** — watches the live gameover and fires
  submission ONCE:
  - Reads `useUiStateStore().snapshot`; on the first transition where `snapshot.gameOver`
    becomes defined (gameover), if `useAuthStore().token !== null`, calls
    `submitCompetitiveScore(token, matchId)` exactly once (a `hasSubmitted` guard — the
    server is idempotent, but the client fires once per match). A guest (null token) is a
    no-op that sets status `'guest'`.
  - Exposes `submissionStatus: Ref<'idle' | 'submitting' | 'submitted' | 'already' |
    'failed' | 'guest'>` (`'submitted'` on 200 fresh, `'already'` on 200 `wasExisting`,
    `'failed'` on any non-200 or `status: 0`).
  - Takes `matchId` (a `Ref<string>` or getter) so it re-arms if the mounted match changes.
- **`PlayViewport.vue`** — mount the composable with its `matchId` prop, and render a small,
  non-blocking submission-status line ONLY at gameover (e.g., "Submitting your score…",
  "Score submitted to the leaderboard", "Score already submitted", "Sign in to submit your
  score", "Couldn't submit your score"). No deep prop-drill into the HUD — the indicator
  lives at the `PlayViewport` level where the composable does.
- **`MyProfilePage.vue`** — add a `<section class="profile-scores"
  data-testid="my-profile-scores"><h2>Competitive Scores</h2>…</section>` that, on mount
  (and when authenticated), calls `fetchMyScores(readAuthToken())` and renders the list
  (finalScore, scenarioKey, date; empty-state when none). Mirrors the existing
  Saved-Loadouts section's fetch/loading/empty pattern.
- Submission fires for authenticated players only; each authenticated seat's client submits
  its own (the server scores per-account, idempotent) — no client-side "am I player 0" gate.
- No new npm dependency; no engine/server import; no `functions/` edge change (submission is
  a client SPA concern).

**Locked contract values:**
- Submit request body: `{ matchId: string }`; endpoint `POST /api/competition/scores`.
- My-scores read: `GET /api/me/scores` → `{ scores }`.
- `submissionStatus` domain: `'idle' | 'submitting' | 'submitted' | 'already' | 'failed' | 'guest'`.

---

## Scope (In)

### A) API module
- `lib/api/competitionApi.ts` — `submitCompetitiveScore`, `fetchMyScores`, `MyCompetitiveScore`.
- `lib/api/competitionApi.test.ts` — mocked-`fetch` unit tests (200 fresh / 200 wasExisting /
  409 / 401 / network `status: 0`; Bearer header attached only with a token; body `{ matchId }`).

### B) Gameover-submit composable
- `composables/useCompetitiveSubmitOnGameover.ts` — the fire-once watcher + `submissionStatus`.
- `composables/useCompetitiveSubmitOnGameover.test.ts` — transitions (guest no-op → `'guest'`;
  authed → single submit → `'submitted'`/`'already'`/`'failed'`; no double-fire on repeated
  snapshots; re-arm on matchId change).

### C) Play surface
- `pages/PlayViewport.vue` — mount the composable + the gameover status indicator.

### D) My-scores profile view
- `pages/MyProfilePage.vue` — the "Competitive Scores" section (fetch + list + loading/empty).
- `pages/MyProfilePage.test.ts` — extend if present (the section renders; fetch wired).

---

## Out of Scope

- **Any server change** — WP-338 shipped the surfaces; this packet only consumes them.
- **The public `PlayerProfilePage` Rank tab stub** — it is a separate public/guest surface
  ("coming soon WP-054/WP-055"); wiring public ranking is a later WP, not this one.
- **A dedicated leaderboard page / global standings UI** — future; this packet is
  submit-on-gameover + the owner's own scores.
- **Retry/queue for a failed submission** — the server is idempotent and the harvester scan
  is a backstop; a failed client submit surfaces status only (no client retry queue here).
- **The WP-053 co-owner LIMIT-1 hardening** (D-24126 follow-up) — server-side, separate.

---

## Files Expected to Change

- `apps/arena-client/src/lib/api/competitionApi.ts` — **new**
- `apps/arena-client/src/lib/api/competitionApi.test.ts` — **new**
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.ts` — **new**
- `apps/arena-client/src/composables/useCompetitiveSubmitOnGameover.test.ts` — **new**
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount composable + status indicator
- `apps/arena-client/src/pages/MyProfilePage.vue` — **modified** — "Competitive Scores" section
- `apps/arena-client/src/pages/MyProfilePage.test.ts` — **modified** (if present)
- `docs/ai/work-packets/WP-339-arena-submit-my-scores.md` — **new** — this file
- `docs/ai/execution-checklists/EC-369-arena-submit-my-scores.checklist.md` — **new**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**
- `docs/ai/STATUS.md` — **modified** (execution)
- `docs/ai/DECISIONS.md` — **modified** (execution) — D-24127

No server/engine change; no migration; no `functions/` change; no API-catalog change
(the client is a consumer — the endpoints already appear in the catalog from WP-338).

---

## Acceptance Criteria

- [ ] `competitionApi.submitCompetitiveScore` POSTs `{ matchId }` with `Authorization: Bearer`
      (only when a token is present), never throws, and maps 200/`wasExisting`/non-200/network to a typed result.
- [ ] `competitionApi.fetchMyScores` GETs `/api/me/scores` → `{ scores }`, never throws.
- [ ] `useCompetitiveSubmitOnGameover` fires the submit **exactly once** on the gameover
      transition for an authenticated player; is a no-op (`'guest'`) for a guest; does not
      double-fire on repeated identical snapshots.
- [ ] `PlayViewport` mounts the composable with its `matchId` and shows the gameover
      submission status (submitting / submitted / already / guest / failed) without blocking the endgame UI.
- [ ] `MyProfilePage` renders a "Competitive Scores" section that fetches `/api/me/scores`
      when authenticated and lists the scores (with loading + empty states).
- [ ] Guests are never submitted; no client-side engine/server import; no `functions/` change.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` + `test` pass; `pnpm -r build` 0.
- [ ] No files outside `## Files Expected to Change`.

---

## Verification Steps

```pwsh
pnpm -r build                                         # exits 0
pnpm --filter @legendary-arena/arena-client typecheck # vue-tsc 0 (noUncheckedIndexedAccess)
pnpm --filter @legendary-arena/arena-client test      # node:test green (api + composable + page)

# the client submits matchId, never a replayHash
Select-String -Path "apps\arena-client\src\lib\api\competitionApi.ts" -Pattern "replayHash"
# Expected: no match in the REQUEST path (matchId is the submit key; replayHash only appears
#           as a MyCompetitiveScore display field)
Select-String -Path "apps\arena-client\src\lib\api\competitionApi.ts" -Pattern "matchId"
# Expected: >= 1

git diff --name-only apps/server packages/            # no output (client-only)
git diff --name-only                                  # == Files Expected to Change
```

**Live-verify (D-24026, post-deploy):** requires the server (WP-333..338) deployed + migrations
024/025 PROD-applied on Render. After the arena-client deploys, finish an authenticated match on
`play.legendary-arena.com`, confirm the submission status shows "submitted", and confirm the score
appears under "My Scores" and on `legends.legendary-arena.com`. If the server is not yet live, the
client degrades gracefully (status `'failed'`) — the UI must not break.

---

## Vision Alignment

**Vision clauses touched:** §22 (Scoring & Skill Measurement) — completes the user-facing loop
so a finished match produces a competitive score the player can see. §24 (competitive integrity):
the client submits an intent (`matchId`); the server remains the sole authority that reduces,
verifies, and scores (D-5301) — the client never computes or asserts a score.

**Conflict assertion:** No conflict. Consistent with §22/§24 and the WP-338 auto-publish decision
(submitting is opting the replay onto the public leaderboard).

**Non-Goal proximity:** NG-1..7 — none crossed. No pay-to-win; account-gating the submission is
normal commerce (guests see "sign in to submit"), consistent with the business posture.

**Determinism preservation:** N/A to the client — no engine/RNG in the arena-client; submission is
an HTTP intent. The server's deterministic reduce+verify is unchanged.

---

## Funding Surface Gate

**Assessed.** The "sign in to submit your score" affordance is an account-gate on a value action
(putting a score on the public leaderboard) — a standard, on-brand conversion touchpoint, not a
funding/nav surface requiring the WP-097 funding-surface treatment. No global-nav / registry
funding affordance is added. Authority: WP-097, D-9701, D-9801.

---

## API Catalog Update (§21 — D-11804)

**Not triggered.** No `apps/server` endpoint or catalogued library function changes — this is a
client consumer of the endpoints WP-338 already catalogued (`POST /api/competition/scores`,
`GET /api/me/scores`).

---

## Lint Gate Self-Review (00.3)

| § | Verdict | Notes |
|---|---------|-------|
| §1 Structure | PASS | All sections incl. Out of Scope (≥2) |
| §2 Constraints | PASS | Client engine-wide + packet-specific + locked values; noUncheckedIndexedAccess |
| §3 Assumes | PASS | WP-338 surfaces + no-client-replayHash + passive-gameover + auth-token facts explicit |
| §4 Context | PASS | ownerProfileApi + auth/uiState stores + PlayViewport + MyProfilePage + server contract cited |
| §5 Output | PASS | 7 client files + governance; bounded; server/engine excluded |
| §6 Naming | PASS | `matchId`/`submissionStatus`/`MyCompetitiveScore` consistent; canonical field names mirrored |
| §7 Dependencies | PASS | No new npm dep; no engine/server import; no functions/ change |
| §8 Boundaries | PASS | Client-only; HTTP-only to the server; no cross-layer import |
| §9 Windows | PASS | `Select-String` / `pnpm --filter` |
| §10 Env | PASS | `VITE_API_BASE_URL` reused via `buildApiUrl` (existing) |
| §11 Auth | PASS | Bearer token from the auth store; guest → no submit; both endpoints authed server-side |
| §12 Tests | PASS | `node:test` + vue-sfc-loader; mocked fetch; composable fire-once; page render |
| §13 Commands | PASS | Exact `pnpm --filter` typecheck/test + `Select-String` |
| §14 Acceptance | PASS | 8 binary, observable items |
| §15 DoD | PASS | STATUS/DECISIONS/WORK_INDEX + scope-boundary + User-Visible Surface = play.legendary-arena.com |
| §16 Code style | PASS | Composable single-purpose; never-throw wrappers; `// why:` on the fire-once guard |
| §17 Vision | PASS | §22/§24 cited; determinism N/A-to-client noted |
| §18 Prose-vs-grep | PASS | `replayHash` expect-none-in-request / `matchId` ≥1 greps intended |
| §19 Bridge | N/A | no repo-state artifact |
| §20 Funding | PASS | Assessed — account-gate is normal commerce, no funding-nav surface |
| §21 API catalog | PASS | Not triggered (client consumer) — stated + justified |

**Pre-flight self-verdict:** READY — the server surfaces exist (WP-338 Done); the client
patterns (Bearer-fetch, passive gameover, matchId at PlayViewport, MyProfile sections) are
mapped; no operator fork (the product decisions were made for WP-338). One arena-client typecheck
caveat (noUncheckedIndexedAccess) is called out.

**Copilot self-check:** PASS — client-only consumer, HTTP-only, product decisions already
ratified (D-24126), §21 not triggered, User-Visible Surface = play.legendary-arena.com with a
deploy-dependency note.

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `pnpm -r build` 0; `pnpm --filter @legendary-arena/arena-client typecheck` 0; `... test` green
- [ ] `docs/ai/STATUS.md` updated — names the payoff (the capture→submit→score→leaderboard loop is now user-complete; guests prompted to sign in) + the live-verify deploy dependency
- [ ] `docs/ai/DECISIONS.md` — D-24127 (client submit-on-gameover fire-once at PlayViewport, authed-only; `competitionApi`; "My Scores" in MyProfilePage; submission-status indicator) Active
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-339 checked off with date
- [ ] No files outside `## Files Expected to Change` (`git diff --name-only`); no server/engine change
