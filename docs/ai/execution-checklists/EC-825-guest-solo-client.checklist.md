# EC-825 — Guest solo client (Execution Checklist)

**Source:** docs/ai/work-packets/WP-788-guest-solo-client.md
**Layer:** Arena Client (App)

## Before Starting
- [ ] EC-822 (WP-785) and EC-824 (WP-787) commits are on `main`, and WP-787's D-24026 live verify is recorded in STATUS.md **as passing**
      (network B → 200 and the key-source line reads `cf-connecting-ip`), or the follow-up WP-787 names for a failed check has landed; else STOP (BLOCKED)
- [ ] `ArenaEntrance.vue` has the WP-785 signed-out branch, test ids, and `isEntering` latch; `ArenaEntrance.test.ts` test 3 is
      "signed out: a click sends no request, shows no error, and leaves the button enabled"; else STOP
- [ ] WP-785 tests 1, 2, 4–7 assert neither the old signed-out helper copy nor a signed-out no-request; else STOP
- [ ] `apps/server/src/match/guestSoloRoutes.mjs` exports `GUEST_SOLO_FEATURED_TABLE`; the route returns `{ matchId, seat, credentials }` / 429 / 503 / 502; else STOP
- [ ] `pnpm --filter "@legendary-arena/arena-client^..." build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (Before)
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (record the baseline count)
- [ ] EXACT target files: `lobbyApi.ts`, `lobbyApi.test.ts`, `ArenaEntrance.vue`, `ArenaEntrance.test.ts`, `featuredTable.test.ts` + governance; anything else is a FAIL, surfaced as a blocker.

## Locked Values (do not re-derive)
- **`createGuestSoloMatch()`** (exported from `src/lobby/lobbyApi.ts`, JSDoc): `POST ${serverUrl}/api/match/create-guest-solo`, `method: 'POST'`,
  no headers object, no body. On a non-2xx it throws `Object.assign(new Error('Failed to start a guest match at <endpoint>: server returned HTTP
  <status>. <response text>'), { status })`. On 2xx it returns `{ matchId, seat, credentials }` from the JSON body.
- **Signed-out click** (`token === null`), in a helper `enterAsGuest()`: if `isEntering`, return; set `isEntering = true`; call `createGuestSoloMatch()`;
  on success `window.location.href = buildGuestPlayUrl(matchId, seat, credentials)` and the latch stays set; on failure clear the latch and show
  `guestErrorMessage(status)` in `arena-enter-error`.
- **`guestErrorMessage(status: number | undefined): string`** (`if / else if / else`):
  - `429` → `Too many guest games were started from this connection. Sign in to play now, or try again in a minute.`
  - `503` → `Guest play is full right now. Sign in to play now, or try again in a few minutes.`
  - any other status, or `undefined` → `The guest game could not be started. Sign in to play, or try again.`
- **Signed-out helper** (replaces WP-785's `Sign in to take your seat. Your account is free.`): `You’ll play as a guest. ` (curly apostrophe, matching LobbyView / EndgameSummary copy) followed
  by a link `Sign in` (`href="?route=login"`, `data-testid="arena-sign-in-link"`) and ` to save your results.` Rendered only when `token === null`.
- **Supersedes (signed-out branch only):** WP-785 Contract bullet 2 ("never through a new endpoint"),
  WP-785 AC5, and EC-822 Guardrails "Enter Arena goes only through `launchMatchFromComposition`" and
  "Signed out → `window.location.search = '?route=login'`, no request", plus the old helper copy. The
  signed-in branch remains bound by all of them.
- The button label, heading, encounter / roster lines, art, workshop link, and signed-in behavior are unchanged from WP-785.

## Guardrails
- Client-only; no `packages/**`, `apps/server/**`, or engine change; no import of any `apps/server` module (the drift test reads it as text). 01.5 NOT INVOKED.
- The signed-in branch is byte-for-byte unchanged (see the Supersedes value above).
- WP-785 tests 1, 2, 4–7 pass WITHOUT edits.
- Drift test: find `export const GUEST_SOLO_FEATURED_TABLE` (assert found, full-sentence message); strip comments; slice first `{` to first `}`;
  sorted quoted strings `deepEqual` the sorted 7 `FEATURED_TABLE` ids; each count matches `\b<field>\s*:\s*<value>\b`; the same helper reports
  a mismatch for `core/wolverine` → `core/storm` (non-vacuous).
- Guest credentials are never logged or stored. `LobbyView.vue`, `App.vue`, gameover components unchanged.
- No nested ternaries; JSDoc on every function; handlers ≲ 30 lines; full-word names.

## Required `// why:` Comments
- `createGuestSoloMatch`: a headerless, bodyless POST is a CORS simple request (no preflight); the route is public and bodyless (WP-787 / D-24635).
- `guestErrorMessage`: player copy instead of the server's generic sentence (join-as-guest precedent); every branch offers sign-in.
- `window.location.href`: `buildGuestPlayUrl` returns a full absolute URL (not a relative query).
- The drift test's text read: arena-client may never import `apps/server` (layer rule), so the tables are compared as source text.

## Files to Produce
- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** (`createGuestSoloMatch`)
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified** (+2 tests in `describe('lobbyApi (WP-090)')`; test (a) asserts `init?.headers === undefined`)
- `apps/arena-client/src/lobby/ArenaEntrance.vue` — **modified** (guest helpers, error mapping, helper copy)
- `apps/arena-client/src/lobby/ArenaEntrance.test.ts` — **modified** (test 3 rewritten; +4 tests, test 11 includes a status-less failure)
- `apps/arena-client/src/lobby/featuredTable.test.ts` — **modified** (+1 cross-table drift test)
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## After Completing
- [ ] vue-tsc exits 0 (After); arena-client observed baseline + 7, 0 fail (lobbyApi +2, ArenaEntrance +4, featuredTable +1)
- [ ] The test 3 rewrite is named in the commit body as an intentional behavior change
- [ ] `git status --porcelain` ⊆ Files to Produce
- [ ] D-24636 Active + a one-line "§4 superseded by D-24636" pointer on D-24633; `docs/ai/STATUS.md` updated
- [ ] Live (D-24026, post-deploy): private window → guest helper → Enter Arena → guest Magneto / Brotherhood / Midtown match in the lobby phase →
      a real gameover shows "Sign in to save your results"; signed in → authed path unchanged; matchId in STATUS.md
- [ ] WORK_INDEX WP-788 `[x]` with date; EC_INDEX EC-825 → Done; mindmap `📝`→`✅`; `pnpm roadmap:counts:write` + `:check` exit 0

## Common Failure Smells
- A signed-out click still lands on login → the old `?route=login` branch was left in place of `enterAsGuest()`.
- Guest create is preflighted or 401s → a headers object (even `Content-Type` or `Bearer null`) was sent.
- Navigation goes to `https://…/https://…` → `buildGuestPlayUrl`'s absolute URL was assigned to `location.search`.
- The drift test passes after editing only one table → it compared the client constant with itself, or the negative case is missing.
- Raw "Failed to start a guest match at http://…" shows to a player → the thrown message was rendered instead of `guestErrorMessage`.
- A signed-in tester gets a guest match on a fast click → the documented hydration race (Limitations); record it, do not work around it here.
