# WP-788 — Guest solo client: a signed-out Enter Arena plays the featured table as a guest

**Status:** Draft 2026-09-28 · **EC:** EC-825 · **Reserves:** D-24636
**Primary Layer:** Arena Client (App)
**User-Visible Surface:** play.legendary-arena.com (the WP-785 entrance, signed out)
**Lane:** standard two-session. Not lightweight: 5 code/test files, an identity-adjacent surface
(guest play), and a D-entry that supersedes D-24633 §4. **BLOCKED on WP-785 and WP-787**: unblocks
when the EC-822 and EC-824 commits are on `main` **and** WP-787's D-24026 live verify is recorded in
STATUS.md **as passing** (network B → 200 and the key-source line reads `cf-connecting-ip`), or the
follow-up WP-787 names for a failed check has landed.
**Baseline:** `origin/main` @ `ccb50dc6` (2026-09-28). The arena-client suite is re-observed at
execution (2189 after WP-785; +9 if WP-786 landed).

## Goal

Make the entrance deliver the vision's promise of one free solo match without an account (D-24092).
After WP-785, a signed-out visitor who presses **Enter Arena** is sent to sign in. After this WP, the
same click calls WP-787's `POST /api/match/create-guest-solo` and seats them at the featured table as a
guest. The entrance tells them they are playing as a guest and offers sign-in to save results; the
existing gameover prompt ("Sign in to save your results") is the conversion point. Signed-in behavior
is unchanged.

## User-Visible Impact

- Signed out: the helper under Enter Arena reads "You’ll play as a guest. Sign in to save your
  results." with **Sign in** as a link. Enter Arena opens a guest solo match (Magneto + Brotherhood +
  Sentinel vs Midtown Bank Robbery) on the play route in the lobby phase.
- Signed out, when guest play is throttled or full: a plain message offering sign-in or a retry, and
  the button re-enables.
- Signed in: unchanged (the WP-785 authed create).
- At gameover (a real one, not an ended-early match), a guest sees the existing sign-in prompt;
  nothing is saved or scored.

## Assumes

- **WP-785 ✅ (hard dependency)** — `apps/arena-client/src/lobby/ArenaEntrance.vue` exists with the
  locked copy, test ids (`arena-enter`, `arena-enter-error`, …), the `isEntering` latch, and the
  signed-out branch (`token === null` → `window.location.search = '?route=login'`, no request).
  `ArenaEntrance.test.ts` has 7 tests; test 3 is "signed out: a click sends no request, shows no error,
  and leaves the button enabled", and it asserts the old helper text. `src/lobby/featuredTable.ts`
  exports `FEATURED_TABLE`; `featuredTable.test.ts` has 5 tests.
- **WP-787 ✅ (hard dependency)** — `POST /api/match/create-guest-solo` (Auth `guest`, bodyless) returns
  `200 { matchId, seat: '0', credentials }`, `429` over the per-connection limit, `503` at capacity,
  `502` when the game server is unreachable, and passes a native failure status through; every error
  body is `{ error: '<sentence>' }`. `GUEST_SOLO_FEATURED_TABLE` is exported from
  `apps/server/src/match/guestSoloRoutes.mjs` and is identical to `FEATURED_TABLE`.
- **Guest precedent** (`apps/arena-client/src/lobby/lobbyApi.ts`): `joinAsGuest` POSTs with **no**
  Authorization header and throws `Object.assign(new Error('<full sentence>'), { status })` on a
  non-2xx; `buildGuestPlayUrl(matchId, seat, credentials)` returns a full absolute URL, navigated with
  `window.location.href = …` (LobbyView's join-as-guest). The live route is unguarded and seats a guest
  from `?match&player&credentials`.
- **CORS:** a bodyless POST with no custom headers is a CORS simple request (no preflight); the server's
  `origins` include `https://play.legendary-arena.com`.
- **Gameover:** `useCompetitiveSubmitOnGameover` sets `'guest'` when `authStore.token === null` and never
  POSTs (`endedEarly` is checked first); `EndgameSummary.vue` renders "Sign in to save your results"
  with a `?route=login` link. If PR #2483 (D-24630, open at drafting) has landed, its `session-expired`
  status requires a token, so a guest seat never reaches it.
- **Session hydration:** on the entrance route `isAuthBootstrapping` starts `false` and the token
  hydrates in the background (App.vue). `token === null` therefore means "signed out **or** not yet
  hydrated" — see Limitations.
- **jsdom** ignores navigation; tests observe requests and rendered text (WP-785 precedent).

## Context (Read First)

- WP-785, WP-787, D-24633 (§4 is superseded here), D-24635, D-24092 (Access Model), D-24093.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §7 Match Configuration — the composition fields the
  drift test compares.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary + `.claude/rules/architecture.md`: arena-client never
  imports `apps/server`. The featured-table drift test reads the server file as **text** in a test (no
  runtime or bundle edge), like `featuredTable.test.ts` reads `data/cards/core.json`. A root
  `scripts/*.test.ts` would not run under `pnpm -r test`, so the pin stays in arena-client.
- `docs/ai/REFERENCE/api-endpoints.md` — the WP-787 row (consumed unchanged).
- ewiki [Play Lobby UX Direction](../../../wiki/play-lobby-ux-direction.md) — the entrance mockups.
- **Why status-mapped copy, not the server's message.** The server's sentences are written for any
  caller and the thrown message includes the endpoint URL; the entrance is a player surface. The
  join-as-guest path maps statuses the same way.
- **Why keep a sign-in offer on the entrance.** Account capture is the conversion point (Access Model:
  the account "captures the verified email"). The guest line names the trade plainly.

## Non-Negotiable Constraints

**Engine-wide (do not remove):** ESM only, Node v22+, `node:` prefix. Vue SFCs compile via
`vue-sfc-loader` (test-only devDep). Full file contents, no diffs. Human-style code per
`docs/ai/REFERENCE/00.6-code-style.md` (no nested ternaries, full-word names, JSDoc on every function,
functions ≲ 30 lines).

**Packet-specific:**
- Client-only: no `packages/**`, no `apps/server/**`, no engine change, no new endpoint.
- No import of any `apps/server` module; the drift test reads it as text.
- `createGuestSoloMatch` sends **no** headers object and **no** body (a CORS simple request).
- The signed-in path (`launchMatchFromComposition`) is byte-for-byte unchanged.
- Guest credentials are never logged and never written to storage; they travel only in the play URL.
- `LobbyView.vue`, `App.vue`, and the gameover components are unchanged.
- 01.5 NOT INVOKED. vue-tsc is gated **Before** and **After**.

**Session protocol:** if WP-785's signed-out branch, test ids, or test 3, or WP-787's route path,
response shape, or status codes differ from Assumes, STOP. Stop and ask on any item not locked here.

## Locked Contract Values

- **`createGuestSoloMatch()`** (exported from `src/lobby/lobbyApi.ts`, JSDoc): `POST
  ${serverUrl}/api/match/create-guest-solo`, `method: 'POST'`, no headers object, no body. On a non-2xx
  it throws `Object.assign(new Error('Failed to start a guest match at <endpoint>: server returned HTTP
  <status>. <response text>'), { status })`. On 2xx it returns `{ matchId, seat, credentials }` from the
  JSON body.
- **Signed-out click** (`token === null`), in a helper `enterAsGuest()`: if `isEntering`, return; set
  `isEntering = true`; call `createGuestSoloMatch()`; on success
  `window.location.href = buildGuestPlayUrl(matchId, seat, credentials)` and the latch stays set; on
  failure clear the latch and show `guestErrorMessage(status)` in `arena-enter-error`.
- **`guestErrorMessage(status: number | undefined): string`** (`if / else if / else`):
  - `429` → `Too many guest games were started from this connection. Sign in to play now, or try again in a minute.`
  - `503` → `Guest play is full right now. Sign in to play now, or try again in a few minutes.`
  - any other status, or `undefined` → `The guest game could not be started. Sign in to play, or try again.`
- **Signed-out helper** (replaces WP-785's `Sign in to take your seat. Your account is free.`):
  `You’ll play as a guest. ` (curly apostrophe, matching LobbyView / EndgameSummary copy) followed by a
  link `Sign in` (`href="?route=login"`, `data-testid="arena-sign-in-link"`) and ` to save your
  results.` Rendered only when `token === null`.
- **Supersedes (signed-out branch only):** WP-785 Contract bullet 2 ("never through a new endpoint"),
  WP-785 AC5, and EC-822 Guardrails "Enter Arena goes only through `launchMatchFromComposition`" and
  "Signed out → `window.location.search = '?route=login'`, no request", plus the old helper copy. The
  signed-in branch remains bound by all of them.
- The button label, heading, encounter / roster lines, art, workshop link, and signed-in behavior are
  unchanged from WP-785.

## Scope (In)

- `src/lobby/lobbyApi.ts` — add `createGuestSoloMatch` (the locked shape), with a `// why:` on the
  headerless, bodyless POST (a CORS simple request; JSON headers with no body would force a preflight).
- `src/lobby/lobbyApi.test.ts` — exactly **+2** tests in the existing `describe('lobbyApi (WP-090)')`:
  (a) POSTs to `/api/match/create-guest-solo` with `calls[0].init?.headers === undefined` and
  `calls[0].init?.body === undefined`, and returns `{ matchId, seat, credentials }`; (b) a 429 throws a
  full-sentence error with `status: 429` attached.
- `src/lobby/ArenaEntrance.vue` — `enterAsGuest()` and `guestErrorMessage()` helpers; the signed-out
  branch calls `enterAsGuest()`; the new helper and sign-in link replace the old helper.
- `src/lobby/ArenaEntrance.test.ts` — test 3 **rewritten** (intentional behavior change, named in the
  commit): signed out → exactly one request, a POST to `/api/match/create-guest-solo`, and **no**
  request to `/api/match/create` or `/api/match/join`; a second click sends nothing more. **+4** tests:
  (8) signed out renders the guest helper and `arena-sign-in-link` with `href="?route=login"`; signed in
  renders neither; (9) a 429 shows the 429 copy and re-enables the button; (10) a 503 shows the 503 copy;
  (11) a 500 shows the generic copy, and a rejected `fetch` (no `status`) shows the generic copy too.
- `src/lobby/featuredTable.test.ts` — **+1** test (6), the drift pin. Read
  `new URL('../../../server/src/match/guestSoloRoutes.mjs', import.meta.url)` with `node:fs`; find
  `export const GUEST_SOLO_FEATURED_TABLE` (assert found, with a full-sentence message naming both
  files); strip `//` and `/* */` comments from the text after it; slice from the first `{` to the first
  `}` (the table holds only arrays, so there are no nested braces); collect every quoted string, sort,
  and `deepEqual` against the sorted 7 ids of `FEATURED_TABLE`; for each of the 4 counts match
  `\b<field>\s*:\s*<value>\b`. **Negative (non-vacuous):** a test-local compare helper, run on the
  extracted literal with `core/wolverine` replaced by `core/storm`, must report a mismatch. A `// why:`
  names the layer rule (text read, never an import).

## Out of Scope

- Any server change (WP-787 owns the route, limits, and messages).
- Changing gameover, the battle brief, the Battle Plan guest path, LobbyView, or App.vue.
- A session-hydration flag for the entrance (see Limitations; a follow-up WP).
- A "continue as guest" choice screen, guest profiles, or saving a guest result after sign-in.
- Retrying after 429 / 503 automatically.

## Limitations (accepted)

- **Hydration race.** A signed-in visitor who clicks before their session hydrates is seen as signed
  out and gets a Casual guest match (and briefly sees the guest helper). At gameover their submit is
  refused as `not_owner`. Fixing it needs an `isSessionHydrating` flag from `App.vue`: a follow-up WP.
- Guest credentials travel in the play URL (the WP-787 / add-guest precedent).
- Throttle and capacity limits surface as the 429 / 503 copy; nothing retries.
- A guest's result cannot be saved after signing in.

## Files Expected to Change

- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** (`createGuestSoloMatch`)
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** (+2 tests)
- `apps/arena-client/src/lobby/ArenaEntrance.vue` — **modified** (guest helpers, error mapping, helper copy)
- `apps/arena-client/src/lobby/ArenaEntrance.test.ts` — **modified** (test 3 rewritten; +4 tests)
- `apps/arena-client/src/lobby/featuredTable.test.ts` — **modified** (+1 cross-table drift test)
- Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24636 → Active; a one-line "§4
  superseded by D-24636" pointer on D-24633), `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

No other files may be modified.

## Contract

- Signed out, Enter Arena creates a guest solo match through `POST /api/match/create-guest-solo` only,
  and navigates to its play URL. It never calls the authed create or join.
- Throttle, capacity, and other failures show player copy that offers sign-in, and re-enable the button.
- Signed in, nothing changes.
- The client's `FEATURED_TABLE` and the server's `GUEST_SOLO_FEATURED_TABLE` are pinned equal by test.

## Acceptance Criteria

1. `createGuestSoloMatch` POSTs to the locked path with no headers object and no body, and returns
   `{ matchId, seat, credentials }`.
2. A non-2xx from it throws a full-sentence error with `status` attached.
3. Signed out, one click sends exactly one request (the guest-solo POST) and none to `/api/match/create`
   or `/api/match/join`; a second click sends nothing more.
4. Signed out, the guest helper and the `Sign in` link (`?route=login`) render; signed in, they do not.
5. 429, 503, other statuses, and a status-less failure show their locked copy and re-enable the button.
6. The WP-785 tests 1, 2, 4–7 pass unchanged.
7. The drift test passes: the server table's ids equal `FEATURED_TABLE`'s (sorted) and its four counts
   match; the synthetic drifted table is reported as a mismatch.
8. vue-tsc exits 0; the arena-client suite has 0 failures and grows by exactly +7.

## Verification Steps

```pwsh
pnpm --filter "@legendary-arena/arena-client^..." build
pnpm --filter @legendary-arena/arena-client typecheck
# Expected: exits 0 (Before AND After)
pnpm --filter @legendary-arena/arena-client test
# Expected: observed baseline + 7, 0 fail (lobbyApi +2, ArenaEntrance +4 with test 3 rewritten, featuredTable +1)
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All acceptance criteria pass. vue-tsc exits 0. Counts recorded before and after.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED, post-deploy):** in a private window (signed out), open
      `play.legendary-arena.com/` → the guest helper shows → Enter Arena → a Magneto / Brotherhood /
      Midtown match opens in the lobby phase → play to a real gameover → the "Sign in to save your
      results" prompt shows. Signed in → the authed path, unchanged. Record the matchId in STATUS.md.
- [ ] `docs/ai/DECISIONS.md` D-24636 Active + the D-24633 §4 pointer.
- [ ] `docs/ai/STATUS.md` updated. WORK_INDEX WP-788 `[x]` with date. EC_INDEX EC-825 → Done.
      Mindmap `📝`→`✅`. `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:** Access Model (a guest plays one solo match without an account; the account wall
  stays on save / score / multiplayer), §3 Player Trust & Fairness and §23 (a guest result never reaches
  a leaderboard), §17 Accessibility (a real link and visible error text), Financial Sustainability (the
  entrance and gameover both offer sign-in; account capture stays the conversion point). NG-1 / NG-4 /
  NG-6 not crossed: no timer, no urgency, no purchase surface, no dark pattern.
- **Conflict assertion:** No conflict. D-24636 supersedes D-24633 §4 (the signed-out bounce), as D-24633
  itself anticipated.
- **Determinism preservation:** N/A. Client-only.

## Lint Gate Self-Review (00.3)

All 21 sections satisfied or N/A:
- **§1 structure:** every required section present, plus `## User-Visible Impact` and `## Limitations`.
  Baseline `origin/main` @ `ccb50dc6`; BLOCKED on WP-785 + WP-787 (and WP-787's live verify passing).
- **§2 constraints:** engine-wide (ESM, Node 22, `node:`, full files, 00.6), packet-specific (client-only,
  no `apps/server` import, headerless bodyless POST, signed-in path byte-identical, credentials never
  logged or stored), session protocol (WP-785 / WP-787 shape STOP), locked values; 01.5 NOT INVOKED.
- **§3 / §4:** Assumes pins WP-785's entrance / tests / latch, WP-787's route and table, `joinAsGuest` /
  `buildGuestPlayUrl`, LobbyView's `location.href` precedent, CORS, hydration, and the gameover guest
  path; Context cites 00.2 §7, ARCHITECTURE §Layer Boundary + `.claude/rules/architecture.md`, the
  WP-787 catalog row, D-24092 / D-24093 / D-24633 / D-24635.
- **§5 / §7:** 5 modified files plus governance, each with a one-line description. No new deps (built-in
  fetch, `node:fs`).
- **§6 naming:** `{ matchId, seat, credentials }` per add-guest / join-as-guest; 00.2 §7 composition
  fields verbatim in the drift test.
- **§8 layer:** arena-client only; the server table is read as text in a test, never imported (no runtime
  or bundle edge); no engine or registry runtime import.
- **§9 Windows:** `pwsh` verification. **§10:** N/A — no new env var; reuses `VITE_SERVER_URL` via
  `serverUrl`.
- **§11 auth:** signed out → credentials-only guest seat (bgio credential in the play URL, no
  Authorization header); signed in → WP-160 bearer path unchanged. `## Limitations` names the hydration
  race, URL credentials, throttle / cap copy, and no retroactive save.
- **§12 tests:** `node:test` + vue-sfc-loader; fetch stubbed, no network or DB; the drift test reads a
  local repo file; negatives (signed out never calls create / join; a second click sends nothing; the drift
  compare fails on a synthetic drifted table).
- **§13 / §14 / §15:** exact commands, observed baseline + 7; 8 binary ACs; DoD with the `git status` scope
  check, D-24636 flip + D-24633 §4 pointer, and a D-24026 live verify (private window → guest match →
  gameover sign-in prompt).
- **§16 code style:** status → copy via `if / else if / else`; handler split (`enterAsGuest`,
  `guestErrorMessage`); JSDoc on every function; full-sentence thrown error; `// why:` on the headerless
  POST, the copy map, `location.href`, and the text read.
- **§17 Vision:** present (Access Model, §3, §17, §23, Financial Sustainability; NG-1 / NG-4 / NG-6 not
  crossed; D-24636 supersedes D-24633 §4). Determinism N/A — client-only. **§18:** N/A — no grep-based
  verification. **§19:** N/A (commit-time).
- **§20 Funding:** N/A — the only new copy is the guest helper, a Sign in link, and three error lines; no
  donate, support, or tournament-funding copy and no nav funding affordance.
- **§21 API Catalog:** N/A — client-only; consumes WP-787's `POST /api/match/create-guest-solo` row
  unchanged; no `apps/server` endpoint or `Library-only` function touched.

## Gate Verdicts

- **Pre-flight (01.4), run 1: READY TO EXECUTE (conditional on WP-785 + WP-787)** after doc fixes: the
  dependency gate now requires WP-787's live verify to have *passed* (PS-1); the hydration race is
  recorded as a Limitation with a follow-up, option (a), no scope change (PS-2); the drift test is an
  exact, non-vacuous equality with locked extraction mechanics; the superseded WP-785 values are named;
  test (a) asserts an absent headers object; D-24630 is cited as an open PR; 00.2 §7 cited; EC verbatim.
  Optional items taken: the `enterAsGuest` / `guestErrorMessage` split, a status-less failure case in
  test 11, the CORS `// why:`, Vision §23, D-24093, the curly apostrophe, baseline `ccb50dc6`.
- **Copilot (01.7), run 1: RISK → HOLD** (#4, #11, #25, #26, #29, #30), all addressed above.
- **Lint (00.3), run 1: FAIL §4 / §11 → PASS** after the fixes (block above).
- **Re-gate, run 2: 01.4 READY TO EXECUTE (conditional); 01.7 PASS → CONFIRM; 00.3 PASS**, after three
  wording fixes (EC Supersedes + helper bullets verbatim; D-24636 curly apostrophe; WP-787 §21 lint
  line). The WP-787 catalog correction was confirmed scope-neutral (no re-gate).
