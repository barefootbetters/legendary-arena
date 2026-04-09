# Prompt 08 — Vue 3 Client Integration

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. No React — use boardgame.io framework-agnostic JS client.
> Pinia only (no Vuex/Redux). Existing card browser routes and stores must be untouched.
> Human-style code: explicit, readable, junior-maintainable. See `00.6-code-style.md`.

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

## Code Style Mandate

All output must follow `00.6-code-style.md`. Key rules for this prompt:

- **Store actions are named functions** — declare each Pinia action with a
  named `function` or explicit method name. No anonymous arrow functions
  as action values.
- **API calls are step-by-step** — in `lobbyApi.js`, each function fetches,
  checks `response.ok`, parses JSON, and returns — written as sequential
  `await` statements, not chained `.then()`.
  ```js
  // BAD — chained, hard to add a console.log
  const game = await fetch(url).then(r => r.json()).then(data => data.game);

  // GOOD — readable steps, easy to debug
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load game ${matchID}. Server returned: ${response.status}`);
  }
  const responseBody = await response.json();
  return responseBody;
  ```
- **No generic error normalizer factory** — the `{ message, status }` shape
  is built explicitly in each `catch` block.
- **Readable names** — `matchIdentifier`, `playerCredentials`, `authorizationHeader`,
  not `id`, `creds`, `header`.
- **`// why:` comments** on the client disconnect, the subscriber pattern,
  and the localStorage usage for identity.
- **Router additions are explicit** — add each new route as a separate object
  in the routes array. Do not loop over a route config object.

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

Expose as explicitly named actions:
- `joinGame(matchID, playerID, credentials)`:
  - Create client
  - Subscribe: `client.subscribe(({ G, ctx, isActive }) => { ... })`
  - Set `isConnected` when first state arrives
- `leaveGame()` — disconnect client, clear store
- `move(moveName, ...args)` — delegate to client moves

Each action is a named function in the Pinia `actions` block — not an
anonymous arrow function.

### 3. Identity store (Pinia) (`apps/registry-viewer/src/stores/auth.js`)

Two modes depending on whether Prompt 07 was implemented:
- **With JWT**: persist `{ playerName, token }` to `localStorage`
- **Without JWT**: persist `{ playerName }` only

Expose as explicitly named actions:
- `setIdentity(...)`, `clearIdentity()`
- `isIdentified` computed:
  - JWT mode: token exists and `exp` is in the future (decode without verifying signature)
  - No-JWT mode: `playerName` is non-empty

The `exp` check must be written as an explicit `if` block, not a ternary.

### 4. Lobby API service (`apps/registry-viewer/src/game/lobbyApi.js`)

Wrap lobby REST endpoints as plain named async functions (not a class, not a
factory, not a default-export object):

- `async function createGame({ mastermindsSlug, schemeSlug, playerCount })` → `{ matchID, joinCode }`
- `async function joinGame(matchID, playerName, seat)` →
  - JWT mode: `{ token, playerCredentials }`
  - No-JWT mode: `{ playerCredentials }`
- `async function listGames()` → array of waiting games
- `async function getGame(matchID)` → single game details
- `async function startGame(matchID, authorizationHeader)` → `{ status: 'active' }`

Each function: fetch → check `response.ok` → parse JSON → return.
Each `catch` builds `{ message, status }` explicitly without a shared helper.

### 5. Vue Router setup (`apps/registry-viewer/src/router/index.js`)

Add without breaking existing card browser routes. Each new route is its own
object in the `routes` array — no looping over a route config:
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
- **All store actions are named functions** — no anonymous arrow functions as action values
- **API calls are sequential `await` statements** — no `.then()` chains
- **No generic error normalizer** — build `{ message, status }` explicitly in each catch
- **No abbreviated variable names** — full English words
- **No nested ternaries** — use `if/else` for the `exp` check and JWT mode branching
- **`// why:` comments** on client disconnect, subscriber, localStorage
- **Router routes are explicit objects** — no generated from a config loop
- **All error messages are full sentences** including the HTTP status and what failed
