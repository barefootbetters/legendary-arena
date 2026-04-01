# Prompt 10 — Lobby UI

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. No game logic in lobby components. No silent API failures.
> All polling intervals must be cleared on unmount. No new server endpoints besides
> those already defined in Prompts 06–07.

## Assumes
- Prompts 08–09 complete: stores exist, router is set up, card registry is accessible
- `lobbyApi.js` exists with all methods from Prompt 08
- R2 JSON already fetched/cached by the SPA (mastermind/scheme display names available)
- Prompt 07 may be present (JWT) or skipped (credentials-only) — handle both

---

## Role
Build the pre-game lobby screens: list games, create game, waiting room.
Clear and functional — not polished. Handle async states (loading, errors,
waiting for players) explicitly.

---

## Screen A — Lobby List (`/play`)

Display:
- List of waiting games: join code, mastermind name, player count (filled/total)
- "Join by Code" text input (6-char) with submit button
- "Create New Game" button → navigate to `/play/new`
- Empty state: "No open games. Create one!"
- Auto-refresh every 10 seconds (clear interval on unmount)

Join flow (for both list click and code submit):
1. Prompt player name if not set in auth store (show `PlayerNameModal`)
2. Show available seats for that match
3. Call `lobbyApi.joinGame()` → store identity (token if present)
4. Navigate to `/play/:matchID`

## Screen B — Create Game (`/play/new`)

Form fields:
- Player name (pre-filled from auth store if set)
- Mastermind (select, populated from cached R2 mastermind list)
- Scheme (select, populated from cached R2 scheme list)
- Player count (1–5, default 2)
- "Random" toggle for mastermind (disables dropdown, sends null)
- "Random" toggle for scheme (disables dropdown, sends null)

On submit:
1. `lobbyApi.createGame()` → `{ matchID, joinCode }`
2. Auto-join as seat 0 with entered player name
3. Store identity
4. Navigate to waiting room `/play/:matchID`

Show loading state during API call. Show error on failure.

## Screen C — Waiting Room (`/play/:matchID` before game is active)

Display:
- Game details: mastermind name, scheme name, player count
- Seat grid: each seat shows player name or "Empty"
- Poll `lobbyApi.getGame(matchID)` every 3 seconds (clear on unmount)
- "Leave Game" button → navigate back to `/play`
- "Start Game" button — visible only to seat 0 (host), enabled when ≥ 1 player joined
  - JWT mode: include `Authorization: Bearer <token>` header
  - No-JWT mode: include `{ playerID: 0, playerCredentials }` in request body
- Auto-transition to `GameBoardView` when status becomes `'active'`

---

## Deliverables

- `LobbyView.vue`
- `CreateGameView.vue`
- `WaitingRoomView.vue`
- `PlayerNameModal.vue` — reusable modal, emits `{ name }` on confirm,
  "Continue" disabled if input is empty, 20-character limit
- `GameError.vue` — props: `{ message, retryFn? }`, shows message + optional
  "Try Again" button, used consistently across all three screens

---

## Hard Constraints

- All API calls must show loading state while pending
- All errors must surface to the user via `GameError.vue` — no silent failures
- Polling intervals must be cleared on component unmount
- Mastermind and scheme lists come from existing R2 JSON cache — do not add
  new server endpoints
- No game logic in lobby UI
