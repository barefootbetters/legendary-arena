# Prompt 08 — Vue 3 Client Integration

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. No React — use boardgame.io framework-agnostic JS client.
> Pinia only (no Vuex/Redux). Existing card browser routes and stores must be untouched.

## Assumes
- Prompts 01–06 complete: server and lobby exist
- Prompt 07 (identity) is OPTIONAL:
  - If implemented: join returns `{ token, playerCredentials }`
  - If skipped: join returns `{ playerCredentials }` only
- Existing Vite + Vue 3 SPA at `apps/registry-viewer/`
- SPA currently displays card data — no game functionality yet
- boardgame.io client packages not yet installed in frontend

---

## Role
Add boardgame.io client connectivity to a Vue 3 app without React. Use the
framework-agnostic boardgame.io client API. Keep the client in a service
module — not embedded in component logic.

---

## Deliverables

### 1. boardgame.io client service (`apps/registry-viewer/src/game/client.js`)

Must:
- Create a boardgame.io `Client` for `LegendaryGame` with SocketIO multiplayer:
  `multiplayer: SocketIO({ server: import.meta.env.VITE_GAME_SERVER_URL })`
- Export `createGameClient(matchID, playerID, credentials)` factory function
- Export `disconnectClient(client)` for cleanup on unmount
- No Vue imports in this file

Show the exact boardgame.io v0.50.x import paths for the vanilla JS client.

### 2. Game store (Pinia) (`apps/registry-viewer/src/stores/game.js`)

State: `{ matchID, playerID, credentials, G, ctx, moves, isConnected }`

Expose:
- `joinGame(matchID, playerID, credentials)`:
  - Create client
  - Subscribe: `client.subscribe(({ G, ctx, isActive }) => { ... })`
  - Set `isConnected` when first state arrives
- `leaveGame()` — disconnect client, clear store
- `move(moveName, ...args)` — delegate to client moves

### 3. Identity store (Pinia) (`apps/registry-viewer/src/stores/auth.js`)

Two modes depending on whether Prompt 07 was implemented:
- **With JWT**: persist `{ playerName, token }` to `localStorage`
- **Without JWT**: persist `{ playerName }` only

Expose:
- `setIdentity(...)`, `clearIdentity()`
- `isIdentified` computed:
  - JWT mode: token exists and `exp` is in the future (decode without verifying signature)
  - No-JWT mode: `playerName` is non-empty

### 4. Lobby API service (`apps/registry-viewer/src/game/lobbyApi.js`)

Wrap lobby REST endpoints:
- `createGame({ mastermindsSlug, schemeSlug, playerCount })` → `{ matchID, joinCode }`
- `joinGame(matchID, playerName, seat)` →
  - JWT mode: `{ token, playerCredentials }`
  - No-JWT mode: `{ playerCredentials }`
- `listGames()` → array of waiting games
- `getGame(matchID)` → single game details
- `startGame(matchID, authHeader?)` → `{ status: 'active' }`

Normalize all errors to `{ message, status }`.

### 5. Vue Router setup (`apps/registry-viewer/src/router/index.js`)

Add without breaking existing card browser routes:
- `/play` → `LobbyView`
- `/play/new` → `CreateGameView`
- `/play/:matchID` → `GameBoardView`

Stub the three view components with a single `<h1>` placeholder each.
Implement them in Prompts 09 and 10.

### 6. Environment variable

Add `.env.example` in `apps/registry-viewer/`:
```ini
# boardgame.io server URL — no trailing slash
# Local dev: http://localhost:8000
VITE_GAME_SERVER_URL=https://legendary-arena.onrender.com
```

---

## Hard Constraints

- `boardgame.io/react` is FORBIDDEN — use the framework-agnostic JS client only
- Pinia only — no Vuex or Redux
- Existing card browser stores and routes must remain untouched
- boardgame.io client instance must be disconnected on component unmount
  to avoid memory leaks across route transitions
