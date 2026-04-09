# Prompt 10 — Lobby UI

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. No game logic in lobby components. No silent API failures.
> All polling intervals must be cleared on unmount. No new server endpoints besides
> those already defined in Prompts 06–07.
> Human-style code: explicit, readable, junior-maintainable. See `00.6-code-style.md`.

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

## Code Style Mandate

All output must follow `00.6-code-style.md`. Key rules for this prompt:

- **Each async handler is a named function** — write `async function handleJoinGame()`
  in `<script setup>`, not inline as an `@click` attribute value.
- **Loading and error state is explicit** — every view has `isLoading` and
  `errorMessage` as separate `ref()` variables. No combined status enum.
  ```js
  // BAD — status enum requires knowing all valid states
  const status = ref('idle'); // 'idle' | 'loading' | 'error' | 'success'

  // GOOD — two booleans, easy to read in the template
  const isLoading = ref(false);
  const errorMessage = ref('');
  ```
- **Polling is a named `setInterval` stored in a `ref`** — not an anonymous
  function. The `onUnmounted` cleanup is always directly below the `setInterval` call.
- **Form field refs are one per field** — `playerNameInput`, `selectedMastermindsSlug`,
  not a single reactive form object.
- **No conditional logic in the template** beyond simple `v-if`/`v-show` toggling
  named boolean refs. Move all computed logic to `<script setup>`.
- **`// why:` comments** on polling intervals, the auto-transition to game board,
  and the seat 0 host check.
- **Error display uses `GameError.vue` component always** — never an inline
  `<p v-if="error">` string in a view.

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

Form fields (each a separate `ref()`):
- `playerNameInput` (pre-filled from auth store if set)
- `selectedMastermindsSlug` (select, populated from cached R2 mastermind list)
- `selectedSchemeSlug` (select, populated from cached R2 scheme list)
- `selectedPlayerCount` (1–5, default 2)
- `isMastermindsRandom` toggle (disables dropdown, sends null)
- `isSchemeRandom` toggle (disables dropdown, sends null)

On submit:
1. `lobbyApi.createGame()` → `{ matchID, joinCode }`
2. Auto-join as seat 0 with entered player name
3. Store identity
4. Navigate to waiting room `/play/:matchID`

Show `isLoading` state during API call. Show `GameError` on failure.

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

The host check must be a named computed property:
```js
const isCurrentPlayerTheHost = computed(() => gameStore.playerID === 0);
```

---

## Deliverables

- `LobbyView.vue`
- `CreateGameView.vue`
- `WaitingRoomView.vue`
- `PlayerNameModal.vue` — reusable modal, emits `{ name }` on confirm,
  "Continue" button disabled if `playerNameInput` is empty or over 20 characters,
  the `isConfirmDisabled` check is a named computed property
- `GameError.vue` — props: `{ message: String, required: true, retryFn: Function, default: null }`,
  shows message + optional "Try Again" button, used consistently across all three screens

---

## Hard Constraints

- All API calls must show `isLoading` state while pending — as a named `ref()`
- All errors must surface to the user via `GameError.vue` — no silent failures,
  no inline `<p>` error strings
- Polling intervals must be cleared on component unmount — the `clearInterval`
  call must appear in `onUnmounted`, directly below the `setInterval` setup
- Mastermind and scheme lists come from existing R2 JSON cache — do not add
  new server endpoints
- No game logic in lobby UI
- **Each async handler is a named function** declared in `<script setup>`
- **Form fields are separate `ref()` variables** — no single reactive form object
- **`isLoading` and `errorMessage` are separate `ref()` variables** in every view
- **Host check is a named computed property** — not an inline expression in `v-if`
- **All props typed explicitly** with `type`, `required`, and `default`
- **All `emits` listed explicitly** in the `emits` option
- **No abbreviated variable names**
- **No nested ternaries**
- **`// why:` comments** on polling, auto-transition, host check, and JWT/no-JWT branching
- **All error messages passed to `GameError.vue` are full sentences**
