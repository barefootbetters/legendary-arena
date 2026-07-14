# EC-405 — Solo Bot-Ally Lobby Affordance (Client) (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation. Renumbered
> EC-404 → EC-405 to clear the EC-403 collision with WP-374.
> **Source design:** `docs/ai/DESIGN-SOLO-BOT-ALLY.md` §4c.
> **Source WP:** [WP-376](../work-packets/WP-376-solo-bot-ally-lobby-client.md) (proposed number, pending allocation).
> **Depends on:** EC-404 (server `POST /api/match/create-with-bot` + driver) landed.
> **Blocked by:** EC-406 (ranked-eligibility seat-count guard) — this client
> affordance MUST NOT reach production until EC-406 is Active, or the DESIGN §5b
> ranked-farm vector is exposed.

**Layer:** Client (`apps/arena-client/src/lobby/`)

## Scope
Add a "Play with a bot ally" affordance to the lobby: choose seat count + bot
count + policy, create a bot-ally match via the EC-404 endpoint, join **your own**
seat 0, and land on the play surface. Co-op framing only. OUT of scope: the
server endpoint/driver (EC-404), the ranked guard (EC-406), in-match bot-seat
badge rendering beyond the lobby (fold into the play-surface work if not trivial
here).

## The one distinction that matters (read first)
Unlike **autoplay** (`startAutoplay`, `LobbyView.vue:518-553`), where the human
navigates in as a **spectator** using a **server-returned** credential
(`result.credentials['0']`), a bot-ally human is a **real player** and MUST
**join seat 0 themselves** via `joinMatch(matchId, '0', name, authToken)` — the
same authed path `createAndJoin` uses (`:299-308`). That authed join is what
writes seat 0's `match_seat_accounts` row and hands back the human's own
credential. If the client instead reused a server credential (autoplay-style),
seat 0 would have **no account row** → EC-406's seat-count guard would (correctly)
flag the human's own match as Casual and attribution would break. **Join seat 0;
never accept a server seat-0 credential.**

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it
- [ ] EC-404 Done: `POST /api/match/create-with-bot` returns `{ matchId }` (seat 0 left OPEN; bot seats joined + readied server-side)
- [ ] EC-406 scheduled/Active — record its status; production exposure of this affordance is gated on EC-406 Active
- [ ] Confirm the reusable helpers in `LobbyView.vue` setup: `buildConfig()`, `numPlayers` ref, `parsePositiveInteger`, `persistMatchSetup`, `joinMatch` (`lobbyApi.ts:178`), `requireAuthTokenOrRedirectToLogin`, `serverUrl`, `errorMessage`, `isSubmitting`
- [ ] Confirm the navigation idiom: `window.location.search = ?match=&player=0&credentials=<joined.playerCredentials>` (`:305-309`)
- [ ] Confirm `WaitingForPlayersPanel` auto-hides when `openSeats === 0` (`WaitingForPlayersPanel.vue:72-78`) — EC-404's join-before-return ordering should make seats full on arrival
- [ ] `pnpm -r build` exits 0; `pnpm --filter @legendary-arena/arena-client test` runs

## Locked Values (do not re-derive)
- New setup fn `createWithBotAlly()` in `LobbyView.vue`, modeled on `createAndJoin` (`:290-318`), flow:
  1. auth: `requireAuthTokenOrRedirectToLogin()` (a signed-in human is required; guest → redirect, never an unauthed bot-ally create)
  2. `config = buildConfig()`; `seatCount = parsePositiveInteger(numPlayers.value, 'numPlayers')`
  3. `POST ${serverUrl}/api/match/create-with-bot` with `Content-Type: application/json`, Bearer `authToken`, body `{ numPlayers: seatCount, botCount, policy, setupData: config }`
  4. on `{ matchId }`: `persistMatchSetup(matchId, config)` (best-effort, client-local) → `joined = await joinMatch(matchId, '0', playerName.value.trim(), authToken)` → navigate `?match=&player=0&credentials=${joined.playerCredentials}`
- New reactive inputs: `botAllyBotCount` (default `1`, integer `1..seatCount-1`), `botAllyPolicy` (default `'competent'`, ∈ `{'competent','random'}`). Seat count REUSES the existing `numPlayers` field.
- Client-side validation BEFORE the POST: `seatCount >= 2` and `1 <= botCount <= seatCount - 1` (the server also `400`s; the client check is UX, not the authority)
- **Human seat is ALWAYS `"0"`, joined via `joinMatch(..., authToken)`** — the client NEVER navigates using a server-returned seat-0 credential (contrast `startAutoplay:542`)
- Co-op copy only (§23(b)): e.g. "Play with a bot ally", "Add a bot to your table", "Your bot ally fills the other seat" — NEVER "vs", "opponent", "beat", "win against"
- New API helper `createMatchWithBot(config, seatCount, botCount, policy, authToken)` in `lobbyApi.ts`, mirroring `createMatch` (`:50`) — returns `{ matchId }`; keep the `fetch` out of the SFC for testability/symmetry
- Error handling mirrors `createAndJoin`: on failure set `errorMessage.value = 'Failed to create the bot-ally match. ' + cause`; `isSubmitting` toggled in `try/finally`

## Guardrails
- The human ALWAYS joins seat 0 through `joinMatch(..., authToken)`; the client MUST NOT navigate on a server-supplied seat-0 credential (would leave seat 0 accountless → EC-406 Casual + broken attribution)
- The client MUST NOT ready or start the match, and MUST NOT touch the bot seats — bot seats are readied server-side (EC-404); the human readying seat 0 on the play surface starts the match
- Copy is co-op only (§23(b)) — no PvP/versus framing anywhere in the new block or helper strings
- The affordance is behind the authed-session gate (`requireAuthTokenOrRedirectToLogin`) — never expose an unauthenticated bot-ally create
- Reuse `buildConfig()` — a bot-ally match still needs a real `MatchSetupConfig`; do not ship a second setup-selection path
- No new bot policies beyond `competent` / `random` (matches EC-404's locked set)
- No change to `WaitingForPlayersPanel.vue` logic — only VERIFY it stays hidden for a bot-filled match; if a flash is observed, the fix belongs in EC-404's ordering, not a client patch here

## Required `// why:` Comments
- `createWithBotAlly` — why the human joins seat 0 itself with `authToken` (seat→account row + own credential), NOT a server-returned credential (contrast the autoplay spectator model); this is what keeps EC-406 ranked/attribution correct
- co-op copy site(s) — §23(b) framing (bot is an ally, not an opponent)
- `botAllyBotCount` bound — `1..seatCount-1` client validation mirrors the server `400`

## Files to Produce
- `apps/arena-client/src/lobby/LobbyView.vue` — **modified** — `botAllyBotCount` / `botAllyPolicy` refs, `createWithBotAlly()`, the "Play with a bot ally" form block in `<template>` (seat count reuses `numPlayers`; bot count + policy selectors; co-op copy), wired to `buildConfig()`
- `apps/arena-client/src/lobby/lobbyApi.ts` — **modified** — `createMatchWithBot(config, seatCount, botCount, policy, authToken)` helper (mirror `createMatch`)
- `apps/arena-client/src/lobby/LobbyView.test.ts` — **modified/new cases** — see After Completing
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **modified/new cases** — `createMatchWithBot` posts the right body/headers, returns `{ matchId }`, throws on non-ok
- `docs/ai/STATUS.md` — **modified** — bot-ally lobby affordance note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off the WP
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — add EC-405 (note it is blocked by EC-406 for production)
- (api-endpoints.md row is owned by EC-404 — do NOT duplicate here)

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` passes, incl. new cases:
  - [ ] `createWithBotAlly` POSTs `/api/match/create-with-bot` with `{ numPlayers, botCount, policy, setupData }` + Bearer auth
  - [ ] on `{ matchId }` it calls `joinMatch(matchId, '0', name, authToken)` and navigates `?player=0` with the **joined** credential (a mock server credential is NOT used)
  - [ ] `botCount` validation: `botCount >= seatCount` and `botCount < 1` are rejected client-side before any POST
  - [ ] guest path redirects to login (no unauthed POST)
  - [ ] the new block's copy contains a co-op phrase and NO `vs` / `opponent` / `beat`
- [ ] `rg -i "\bvs\b|opponent|beat the bot|versus" apps/arena-client/src/lobby/LobbyView.vue` → zero in the new block (§23(b))
- [ ] `rg "credentials\['0'\]|credentials\[\"0\"\]" apps/arena-client/src/lobby/LobbyView.vue` → zero (no server seat-0 credential reuse; contrast autoplay)
- [ ] **Browser verify** (per project verify workflow): create a 1-human + 1-bot match → the human lands on the play surface and NEVER sees "Waiting for players — 1 of 2"; after the human readies seat 0 the match starts; the bot takes its turn. Capture a screenshot of the started board as proof.
- [ ] STATUS/WORK_INDEX/EC_INDEX updated; EC-405 marked blocked-by-EC-406 for production
- [ ] Commit prefix `EC-405:` (staged files under `apps/arena-client/` + `docs/`)

## Common Failure Smells
- Human sees "1 of 2" → EC-404 join-before-return ordering regressed, OR the client wrongly created a plain match instead of the bot-ally endpoint (bot seats never joined)
- Human's own match shows as Casual / not attributed → client navigated on a server seat-0 credential instead of `joinMatch(..., authToken)` (seat 0 has no `match_seat_accounts` row)
- "vs the bot" / "opponent" copy shipped → §23(b) violation (bot is an ally)
- A guest reached the bot-ally create → auth gate skipped
- `botCount >= numPlayers` accepted → client validation missing (server 400 surfaces as a raw error to the user)
- Match never starts after the human readies → the client wrongly tried to ready/start bot seats (bot readiness is server-owned; the client only readies seat 0 on the play surface)
- Second setup-selection UI drifted from the normal create → `buildConfig()` not reused
