# WP-090 — Live Match Client Wiring

**Status:** Ready
**Primary Layer:** Client UI (arena-client)
**Dependencies:** WP-011 (lobby HTTP endpoints), WP-032 (ClientTurnIntent +
validateIntent), WP-061 (arena-client skeleton + `useUiStateStore`), WP-089
(engine `playerView` wiring — clients receive `UIState`, not raw G)

---

## Session Context

WP-061 created `apps/arena-client/` as a Vue 3 + Pinia SPA that consumes
committed `UIState` fixtures with no networking, WP-011 added the
boardgame.io lobby HTTP endpoints and Node-CLI clients, WP-032 locked the
engine-side `ClientTurnIntent` + `validateIntent` contract, and WP-089
wires `LegendaryGame.playerView` so every state push is already an
audience-filtered `UIState`. This packet is the first browser client to
connect to the boardgame.io game server: it adds a lobby view, a live
match view, and the boardgame.io `Client()` wiring that feeds
`useUiStateStore` from the engine's `playerView` instead of from
fixtures.

**Forward-reference (post-authoring, added 2026-04-24):** the 9-field
create-match form this packet ships is a **locked contract consumed
by WP-092** (Lobby Loadout Intake). WP-092 wraps the form in a
`<details>` titled "Fill in manually (advanced)" and adds a primary
"Create match from loadout JSON (recommended)" affordance above it,
preserving every field ID, `v-model` binding, and submission handler
byte-for-byte. Executors of this packet should treat the form's
internals as downstream-gated: any deviation from the 9-field shape
or submission signature will break WP-092's preservation contract.
WP-091 (loadout builder in registry-viewer) and WP-093 (rule-mode
envelope governance) are siblings registered in the same SPEC
bundle as this packet but do not interact with its scope directly.

---

## Goal

After this session, `apps/arena-client/` runs as a minimal but complete
browser gameplay client that:

- Renders a lobby view listing open matches and exposing "Create match"
  and "Join match" affordances that hit the boardgame.io lobby HTTP API
  at `VITE_SERVER_URL`
- Connects to a running `LegendaryGame` match via
  `boardgame.io/client`'s `Client({ game: LegendaryGame, multiplayer: SocketIO(...) })`
- Subscribes to state frames via `client.subscribe()` and calls
  `useUiStateStore().setSnapshot(state.G)` on each update (`state.G` is
  already `UIState` courtesy of WP-089)
- Submits player actions as boardgame.io moves — `client.moves[moveName](args)` —
  never as raw WebSocket messages, never re-computing `UIState` client-side
- Routes in `App.vue` between a lobby view, a live-match view (rendered
  inline), and the existing fixture path based on a
  `?match=<matchId>&player=<playerId>&credentials=<s>` query string (no
  router library; query-string gating matches the existing `?fixture=`
  precedent in [main.ts](apps/arena-client/src/main.ts:25))
- Preserves the existing fixture dev path — `?fixture=<name>` still
  hydrates the store from committed JSON without contacting the server,
  so tests and offline UX work continue unchanged

No auth, no identity, no reconnect UI, no spectator toggle, no lobby chat,
no rematch, no replay playback integration. Pure wiring.

---

## Assumes

- WP-011 complete. Specifically:
  - `apps/server/scripts/create-match.mjs`, `list-matches.mjs`, and
    `join-match.mjs` exist and hit the boardgame.io lobby endpoints
    `POST /games/legendary-arena/create`,
    `GET /games/legendary-arena`,
    `POST /games/legendary-arena/:matchID/join`
  - The server accepts these endpoints at `VITE_SERVER_URL` (default
    `http://localhost:8000`) and the CORS allow-list in
    [server.mjs](apps/server/src/server.mjs:94) already includes
    `http://localhost:5173`
- WP-032 complete. Specifically:
  - `@legendary-arena/game-engine` exports `ClientTurnIntent`,
    `validateIntent`, and `computeStateHash` (types and runtime)
  - The engine's move names match `CORE_MOVE_NAMES` plus the extended
    set registered on `LegendaryGame.moves` (drawCards, playCard, endTurn,
    advanceStage, revealVillainCard, fightVillain, recruitHero,
    fightMastermind, plus the lobby moves setPlayerReady, startMatchIfReady).
    Note: the arena-client submits `setPlayerReady` from the lobby-ready UX
    (future WP), but **does not** submit `startMatchIfReady` itself — that
    move is server-triggered when the `G.lobby.ready` map is satisfied
    (see Out of Scope). It is listed here only to document that the move
    exists on `LegendaryGame.moves`; the client must not invoke it.
- WP-061 complete. Specifically:
  - `apps/arena-client/package.json` declares `"type": "module"`
  - `apps/arena-client/src/stores/uiState.ts` exports `useUiStateStore`
    with a `setSnapshot(next: UIState | null)` action
  - `apps/arena-client/src/main.ts` mounts the app via `createApp(App)` and
    gates fixture hydration on `import.meta.env.DEV`
  - Engine imports in `apps/arena-client/**` are **type-only** — no runtime
    import from `@legendary-arena/game-engine` exists today (verify with
    `grep -rn "from '@legendary-arena/game-engine'" apps/arena-client/src`
    before starting; every hit must be `import type`)
- WP-089 complete. Specifically:
  - `packages/game-engine/src/game.ts` sets `LegendaryGame.playerView` to
    a function returning `UIState`
  - State frames the client receives via `boardgame.io/client` have
    `state.G` shaped as `UIState`
- `pnpm --filter @legendary-arena/arena-client build` exits 0
- `pnpm --filter @legendary-arena/arena-client test` exits 0
- `boardgame.io ^0.50.0` is installed in the workspace (hoisted via
  `apps/server/package.json`); this packet adds it as a direct dependency
  of `apps/arena-client` pinned to the same version range
- `docs/ai/ARCHITECTURE.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — client apps
  consume engine **types only** in almost every file; this packet introduces
  the single exception — `LegendaryGame` must be imported as a **runtime
  value** in the one file that constructs `Client({ game: LegendaryGame })`,
  because boardgame.io requires the Game object at client-construction
  time to resolve move names and phases. All other arena-client files
  remain type-only consumers.
- `docs/ai/ARCHITECTURE.md §Section 4` — `UIState` is the sole projection
  contract from engine to UI. The client never constructs or derives
  `UIState` on its own — it only ever calls `setSnapshot` with the
  `state.G` it receives from boardgame.io's subscribe callback.
- `apps/arena-client/src/main.ts` — existing fixture-harness pattern
  (URL `?fixture=` gating under `import.meta.env.DEV`). The new
  `?match=` / `?player=` routing follows the same query-string precedent
  to avoid introducing Vue Router.
- `apps/arena-client/src/stores/uiState.ts` — `setSnapshot` is the sole
  mutation; the live client invokes it on every state frame. Do not add
  a parallel action (e.g., `hydrateLive`) — one action, two callers.
- `apps/arena-client/src/App.vue` — currently mounts `<ArenaHud />`
  unconditionally. This packet rewrites App.vue to route between
  `<LobbyView />` (no `?match=`), a live-match branch rendered inline
  (has `?match=` and `?player=`; the live branch hosts the boardgame.io
  client lifecycle and renders `<ArenaHud />` itself), and the existing
  fixture branch (has `?fixture=`). `<ArenaHud />` continues to render
  unchanged in the live branch.
- `apps/server/src/server.mjs` — read the CORS allow-list. Do not add a
  new origin; `http://localhost:5173` is already present.
- `apps/server/scripts/create-match.mjs` — canonical request body shape
  for `POST /games/legendary-arena/create`. The client's `createMatch`
  helper must use the same JSON payload shape and the same response
  parsing.
- `apps/server/scripts/list-matches.mjs` — canonical response shape for
  `GET /games/legendary-arena`. Mirror the parsing on the client side.
- `apps/server/scripts/join-match.mjs` — canonical request body and
  response shape for join. Mirror on the client.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1 Match Configuration`
  — the 9 locked `MatchSetupConfig` fields that must appear verbatim in
  any client-side create-match form: `schemeId`, `mastermindId`,
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`,
  `woundsCount`, `officersCount`, `sidekicksCount`. This packet ships a
  form, not hardcoded defaults — every field is present.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-negotiable
  constraints: client submits intent, not outcomes; engine is the sole
  authority; no client-side rule execution.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 6 (`// why:` comments), Rule 9 (`node:` prefix
  where Node APIs are used), Rule 11 (full-sentence error messages),
  Rule 13 (ESM only), Rule 14 (field names match data contract).
- `docs/ai/DECISIONS.md` — scan for any prior decision about client
  transport, socket URL conventions, or per-client state shape.
- `.claude/rules/architecture.md §Layer Overview` — arena-client is in
  the Client / CLI tier and may only depend on engine types plus the
  explicitly-approved boardgame.io client runtime (added by this packet).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
- Never throw inside boardgame.io move functions — return void on invalid input
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md §Section 3
- `G` must be JSON-serializable at all times — no class instances, Maps, Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`, `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- The client never re-derives `UIState` from raw `G` — `state.G` is
  already `UIState` courtesy of WP-089's `playerView`
- The client never calls `buildUIState` or `filterUIStateForAudience` —
  both live on the engine side of the boundary
- The client never validates intents itself — `validateIntent` is a
  server/engine concern; the client submits and renders rejection
  responses
- Engine imports outside `bgioClient.ts` stay **type-only** — the only
  file permitted to `import { LegendaryGame }` as a runtime value is
  `apps/arena-client/src/client/bgioClient.ts`
- No `boardgame.io/react` import anywhere — this is a Vue app
- No `axios`, `node-fetch`, `ky`, or any HTTP client other than the
  browser-native `fetch` for lobby API calls
- No `localStorage` / `sessionStorage` / `IndexedDB` writes in this packet —
  identity and session persistence is WP-052's scope; the client reads
  `?player=<playerId>&credentials=<string>` from the URL each load
- No WebSocket logic outside boardgame.io's `SocketIO` transport — do not
  open a raw `WebSocket`
- The nine `MatchSetupConfig` fields listed in Locked Contract Values
  below must appear in the create-match form verbatim; abbreviations,
  field drops, or renames are FAIL
- No dev/fixture path regression — `?fixture=<name>` still hydrates the
  store without any network traffic, confirmed by an explicit test

**Session protocol:**
- **Join endpoint shape is contested across CLI scripts and must be
  verified against the running server before the helper is written.**
  `apps/server/scripts/join-match.mjs:95` parses `result.credentials`,
  but `apps/server/scripts/create-match.mjs:131` reads
  `joinResult.playerCredentials`. One of these scripts has a
  pre-existing bug. Before writing `joinMatch` in `lobbyApi.ts`:
  1. Boot the server locally (`node --env-file=.env apps/server/src/index.mjs`).
  2. POST a real join request and inspect the JSON response shape.
  3. Pick the field name that the server actually returns (boardgame.io
     0.50.x returns `playerCredentials` per framework docs, so this is
     the likely outcome — but **verify**, do not assume).
  4. Record the outcome in `DECISIONS.md` as `D-90xx`. The buggy CLI
     script fix is **explicitly out of scope for this packet** (see
     Out of Scope — `apps/server/**` is untouched); file a follow-up
     WP placeholder in `WORK_INDEX.md` titled
     `fix CLI credentials field drift (join-match.mjs vs create-match.mjs)`
     and move on. The client must match server reality, not the buggy
     CLI script.
- Similarly, the join **request body** is contested:
  `create-match.mjs:110-116` sends `{ playerID, playerName }` to the
  join endpoint, while `join-match.mjs:70-74` sends only `{ playerName }`.
  Verify which shape the server actually requires (boardgame.io 0.50.x
  accepts `playerID` as an optional body field — if omitted the server
  assigns the next open seat). The client's `joinMatch` helper **must**
  send `{ playerID, playerName }` explicitly so the creator lands on
  seat `'0'` deterministically and "Join" flows can pick a specific
  seat. Record as part of the same `D-90xx` entry.
- If any other lobby endpoint shape (request body, response shape) does
  not match the three CLI scripts in `apps/server/scripts/`, stop and
  re-read those scripts before writing the client-side API helper. Do
  not guess the payload shape.
- If boardgame.io 0.50.x's `Client({ multiplayer: SocketIO })` API
  signature has drifted from the shape documented in the codebase's
  existing CLI scripts, stop and ask the human before picking a transport
  variant.
- If any form field name in 00.2 §8.1 appears to conflict with what the
  engine's `MatchConfiguration` type expects, stop and re-read 00.2 —
  do not rename the field in the form.

**Locked contract values:**

- **MatchSetupConfig fields** (exactly these nine, in the create-match form):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **Lobby HTTP endpoints** (exactly these three, matching
  `apps/server/scripts/*.mjs`):
  - `POST {VITE_SERVER_URL}/games/legendary-arena/create` → create match
  - `GET  {VITE_SERVER_URL}/games/legendary-arena`        → list matches
  - `POST {VITE_SERVER_URL}/games/legendary-arena/:matchID/join` → join

- **Phase names** (for conditional rendering in the live branch):
  `'lobby'` | `'setup'` | `'play'` | `'end'`

- **Default server URL** (local dev only — production is set at deploy time):
  `http://localhost:8000`

- **MoveError shape** (how rejected moves surface to the client):
  `{ code: string; message: string; path: string }`

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via deterministic
reproduction and state inspection.

- The dev fixture path (`?fixture=<name>`) continues to hydrate the store
  deterministically from committed JSON — no network, no clocks, no RNG.
  This path is the canonical reproduction surface for UI bugs.
- Live match reproduction is via replays, not client logs — the engine's
  replay harness (WP-027/080) is the authoritative replay system; the
  client has no parallel logging.
- Lobby API failures surface as a human-readable string into a
  `<LobbyView />` error region — no `alert()`, no `console.error` for
  user-visible errors. `console.warn` is permitted for dev diagnostics
  that never surface to the UI.
- The boardgame.io `Client.subscribe` callback calls
  `setSnapshot(state.G ?? null)` unconditionally; the `?? null` coalesces
  both `null` and `undefined` (boardgame.io may deliver the first frame
  with `state.G === undefined` before the server's `playerView` has
  run), so the store's `snapshot === null` branch renders the empty
  state in either case. No client-side synthesis of an empty `UIState`
  is permitted.
- Move rejections from the server surface as `G.messages` entries via
  the engine's rule pipeline; the client does not interpret them, it
  renders them in `<GameLogPanel />` (shipped by WP-064).

---

## Vision Alignment

**Vision clauses touched:** §3 (Player Trust & Fairness), §4 (Faithful
Multiplayer Experience).

**Conflict assertion:** No conflict. This packet preserves §3 and §4:

- §3 — The client submits intent via `client.moves[name](args)` and
  renders the engine's response; it never computes outcomes, never
  re-executes rules, and never alters randomness. Server-authored
  rejections (via WP-032's `validateIntent`) are rendered verbatim.
- §4 — Multiplayer correctness is preserved by construction: the engine
  owns state, the server pushes filtered `UIState` (via WP-089's
  `playerView`), and the client's role is to render and submit intent.
  Reconnection handling per boardgame.io's built-in transport is
  inherited; richer reconnect UX is deferred to a future WP.

**Non-Goal proximity check:** None of NG-1..7 are crossed. This packet
adds no monetization surface, no paid tier, no randomized purchases, no
behavioral nudging. It is a wiring packet that puts the existing engine
+ server in the hands of a browser client.

**Determinism preservation:** The client performs no RNG, no wall-clock
read that affects game state, and no replay-affecting I/O. Replay
faithfulness (Vision §22) is unaffected — replays execute against the
server's `G`, never the client projection.

---

## Scope (In)

### A) Dependency update

- **`apps/arena-client/package.json`** — modified:
  - Add `"boardgame.io": "^0.50.0"` to `dependencies` (pinned to the same
    major/minor as `apps/server/package.json`)
  - No other dependency additions or removals
  - `// why:` not applicable in JSON, but note in the commit message that
    this is the single sanctioned runtime engine-adjacent dep in arena-client

### B) Lobby API helper

- **`apps/arena-client/src/lobby/lobbyApi.ts`** — new:
  - `const serverUrl: string` resolved at module load from
    `import.meta.env.VITE_SERVER_URL ?? 'http://localhost:8000'`
    (with a `// why:` comment explaining the fallback is dev-only)
  - `async function createMatch(config: MatchSetupConfig, numPlayers: number): Promise<{ matchID: string }>`
    — POSTs to `/games/legendary-arena/create` with body
    `{ numPlayers, setupData: config }` (shape matches `create-match.mjs:84-87`
    exactly), returns the server's `{ matchID }` response; throws a
    full-sentence `Error` on non-2xx with the server's message included
  - `async function listMatches(): Promise<LobbyMatchSummary[]>`
    — GETs `/games/legendary-arena`, returns the parsed matches array.
    Locked `LobbyMatchSummary` shape (exact fields, enriched beyond the
    CLI summary because the UI needs per-seat occupancy for the Join flow):
    ```
    {
      matchID: string
      players: { id: string; name?: string }[]   // one entry per seat; `name` present if seat is filled
      setupData: MatchSetupConfig | null          // null if the server redacts for unauthenticated listing
      gameover: unknown | null
    }
    ```
    The helper parses boardgame.io's raw match list (seen at
    `list-matches.mjs:56-72`) into this shape; do **not** collapse
    `players` to a numeric count as the CLI does — the UI needs to
    render seat occupancy to let the user pick an open seat.
  - `async function joinMatch(matchID: string, playerID: string, playerName: string): Promise<{ playerCredentials: string }>`
    — POSTs to `/games/legendary-arena/:matchID/join` with body
    `{ playerID, playerName }` (both fields required so the caller picks
    the seat deterministically). **Response shape must be verified per
    Session Protocol** before this helper is written; the return type
    above reflects the expected boardgame.io 0.50.x contract but the
    session must confirm.
  - All three functions use browser-native `fetch`; no other HTTP client
  - Full-sentence error messages on every throw, including the endpoint,
    the observed status code, and what the user should check

### C) boardgame.io Client factory

- **`apps/arena-client/src/client/bgioClient.ts`** — new:
  - Imports `LegendaryGame` (runtime) from `@legendary-arena/game-engine`
    — this is the **single file** in arena-client with a runtime engine
    import
  - Imports `Client` and `SocketIO` from `boardgame.io/client` and
    `boardgame.io/multiplayer` respectively
  - Imports `useUiStateStore` from `../stores/uiState.js`
  - Imports `type { UIState }` from `@legendary-arena/game-engine`
    (type-only, as the engine's public surface)
  - `function createLiveClient({ matchID, playerID, credentials, serverUrl }): { start(): void; stop(): void; submitMove(name, ...args): void }`
    — constructs a `boardgame.io` `Client` with
    `game: LegendaryGame`, `multiplayer: SocketIO({ server: serverUrl })`,
    `matchID`, `playerID`, and `credentials`; wires
    `client.subscribe((state) => { useUiStateStore().setSnapshot((state?.G ?? null) as UIState | null) })`;
    returns a trio of `start()` (`client.start()`), `stop()`
    (`client.stop()`), and `submitMove(name, ...args)` (invokes
    `client.moves[name](...args)`)
  - `// why:` comment on the `state.G as UIState` cast explaining WP-089
    reshapes the client-visible G to UIState, and that the runtime
    contract is maintained by the engine's `playerView`
  - `// why:` comment on the `submitMove` pass-through explaining the
    client submits intent via boardgame.io's move API — never raw
    WebSocket messages — and the server dispatches to the engine

### D) Lobby view

- **`apps/arena-client/src/lobby/LobbyView.vue`** — new:
  - Renders a "Create match" form with the nine `MatchSetupConfig` fields
    listed in Locked Contract Values, plus a numeric `numPlayers` field
    (1..5)
  - Renders a "Join existing match" section that calls `listMatches()`
    on mount and on a "Refresh" button click, displaying each match's
    `matchID`, seats, and current player count
  - "Create" button flow: call `createMatch(config, numPlayers)`, then
    call `joinMatch(matchID, '0', playerName)` to seat the creator,
    then set `window.location.search` to
    `?match=${matchID}&player=0&credentials=${credentials}` so the app
    re-routes into the live branch on reload
  - "Join" button flow: call `joinMatch(matchID, chosenSeat, playerName)`,
    then set `window.location.search` to
    `?match=${matchID}&player=${chosenSeat}&credentials=${credentials}`
  - Error region renders `lobbyApi` throws as full-sentence strings
  - No router library, no `history.pushState` — query-string change +
    natural reload is sufficient for MVP (and matches the fixture
    precedent)

### E) App routing + inline live-match branch

- **`apps/arena-client/src/App.vue`** — modified:
  - Reads `window.location.search` once in `<script setup>` and computes
    a `route: 'fixture' | 'live' | 'lobby'` discriminator with precedence
    `fixture > live > lobby`
  - `live` requires **all three** of `?match=<id>`, `?player=<pid>`, and
    `?credentials=<s>` to be non-empty strings. If any are missing or
    empty the route falls back to `lobby` (never to a half-mounted live
    branch). A `// why:` comment on the fallback notes that partial live
    params are treated as a lobby request rather than an error surface,
    consistent with the fixture branch's silent-no-op behavior for
    unknown fixture names
  - Template uses `v-if` / `v-else-if` / `v-else` on the three branches
    (no router library, no `<component :is>` indirection)
  - Live branch lifecycle: on `onMounted`, reads `VITE_SERVER_URL` via
    the helper from §B (import it, do not duplicate the resolution), calls
    `createLiveClient({ matchID, playerID, credentials, serverUrl })`,
    and calls `.start()`; on `onBeforeUnmount`, calls `.stop()`. Template
    for the live branch renders `<ArenaHud />` unchanged plus a
    dev-only diagnostic footer gated on `import.meta.env.DEV` that
    shows `matchID`, `playerID`, and `snapshot === null` (whether the
    first state frame has arrived)
  - Fixture branch renders `<ArenaHud />` only — no live client is
    constructed, preserving the zero-network dev path
  - Lobby branch renders `<LobbyView />`
  - `// why:` comment on the `route` derivation explaining the
    precedence (fixture > live > lobby) and why fixture short-circuits
    the live client (tests and offline UX continue to work without
    network)

### F) `.env.example`

- **`apps/arena-client/.env.example`** — new:
  - Single entry: `VITE_SERVER_URL=http://localhost:8000`
  - Header comment naming the variable's purpose (boardgame.io game
    server origin consumed by `lobbyApi.ts` and `bgioClient.ts`) and
    where it is set in each environment (local: copied to `.env` by
    the developer; Cloudflare Pages: build-time env var; production
    domain TBD)

### G) Tests

Add `node:test` tests in the following files. All tests use
`jsdom` + the existing `@legendary-arena/vue-sfc-loader/register` loader
path (WP-065) already wired in `apps/arena-client/package.json`'s test
script.

- **`apps/arena-client/src/lobby/lobbyApi.test.ts`** — new:
  - `createMatch` posts to the correct URL with the expected body shape
    (verified by a `globalThis.fetch` stub that captures the request)
  - `listMatches` parses a canonical server response into
    `LobbyMatchSummary[]`
  - `joinMatch` posts to the correct URL and returns
    `{ playerCredentials }`
  - Every function throws a full-sentence error containing the endpoint
    and the status code when the stub returns 500

- **`apps/arena-client/src/client/bgioClient.test.ts`** — new. Two
  `describe` blocks in one file:
  - `describe('createLiveClient')`:
    - `createLiveClient(...)` returns `{ start, stop, submitMove }` —
      all three are functions
    - Calling the returned `submitMove('drawCards', 2)` delegates to
      `client.moves.drawCards(2)` (verified by a test-time stub
      replacing the `Client` factory via dependency injection OR by
      checking that `client.moves.drawCards` was set up by boardgame.io)
    - The subscribe callback, when invoked with a fake state frame
      whose `G` is a `UIState`-shaped object, writes that object into
      the Pinia store via `setSnapshot`
    - `// why:` comment on any test-only stub documenting that the
      test does not contact a live server
  - `describe('App routing')`:
    - Given `window.location.search === ''`, `<App />` renders
      `<LobbyView />` (probe by a `data-testid` attribute)
    - Given `?match=m1&player=0&credentials=abc`, `<App />` renders the
      live branch (`<ArenaHud />` present, `<LobbyView />` absent)
    - Given `?fixture=mid-turn`, `<App />` renders the existing fixture
      path (`<ArenaHud />` present, `<LobbyView />` absent, no
      `createLiveClient` call — verified via the same injection stub
      used for the factory tests)
    - `// why:` comment on the fixture test noting that this is the
      WP-061 dev-path regression guard called out in Acceptance
      Criteria §Fixture regression guard

All test files:
- Use `node:test` and `node:assert` only
- Do not import from `boardgame.io/testing` (arena-client tests use
  `jsdom` + stubbed `fetch`; engine tests use `makeMockCtx` — both
  per the existing conventions)
- Do not contact a live server; `fetch` is stubbed at `globalThis.fetch`
- Do not use `localStorage` / `sessionStorage`

---

## Out of Scope

- No player identity, accounts, or ownership — that is WP-052
- No spectator UI surface — `UIState` already supports spectators via
  WP-089 / WP-029, but rendering a spectator-specific HUD is a future WP
- No replay playback integration — `<ReplayInspector />` from WP-064 is
  unaffected by this packet and remains fixture-driven
- No pre-planning UI — WP-059 remains deferred
- No rematch, lobby chat, or ready-check polling — the "ready" flag is
  the existing `G.lobby.ready` map; the UI shows the seat count and
  lets the server decide when `startMatchIfReady` fires
- No reconnect UX beyond boardgame.io's built-in transport
  retry — a full-page refresh with the same `?match=&player=&credentials=`
  query string re-attaches the client
- No `localStorage` / session persistence of credentials — credentials
  live in the query string for this packet; WP-052 scopes durable
  identity
- No router library (Vue Router, Unhead, etc.) — query-string gating is
  the MVP mechanism, consistent with WP-061's fixture harness
- No changes to `packages/game-engine/**` — WP-089 is the engine-side
  prerequisite and has already landed before this packet starts
- No changes to `apps/server/**` — the server's CORS allow-list already
  includes `http://localhost:5173` and no new endpoint is introduced
- No changes to existing `apps/arena-client/src/fixtures/**` — the
  fixture path is preserved, not modified
- No changes to `apps/arena-client/src/components/hud/**` — `<ArenaHud />`
  and its children render unchanged under live state
- No `boardgame.io/react` import — this is a Vue app
- No MATCH-SETUP envelope emission — this packet's create-match form
  submits the raw `MatchSetupConfig` composition block as `setupData`;
  envelope-wrapped JSON authoring (`schemaVersion`, `setupId`, `seed`,
  `heroSelectionMode`, etc.) is WP-091's scope, and envelope-aware
  intake (JSON upload/paste that extracts the composition block before
  submission) is WP-092's scope. The 9-field manual form in this
  packet is a locked contract consumed by WP-092 byte-for-byte — do
  not anticipate WP-092 by adding envelope fields, JSON controls, or
  loadout-builder affordances here.
- Refactors, cleanups, or "while I'm here" improvements are **out of
  scope** unless explicitly listed in Scope (In) above

---

## Files Expected to Change

- `apps/arena-client/package.json` — **modified** — add `boardgame.io`
  runtime dep
- `apps/arena-client/.env.example` — **new** — documents
  `VITE_SERVER_URL` with its local-dev default and per-environment
  source
- `apps/arena-client/src/lobby/lobbyApi.ts` — **new** — three HTTP
  helpers (`createMatch`, `listMatches`, `joinMatch`) plus
  `LobbyMatchSummary` type
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **new** — `node:test`
  coverage for the lobby helpers
- `apps/arena-client/src/lobby/LobbyView.vue` — **new** — create-match
  form + list-and-join section
- `apps/arena-client/src/client/bgioClient.ts` — **new** —
  `createLiveClient(...)` factory; the single runtime engine import
  site in arena-client
- `apps/arena-client/src/client/bgioClient.test.ts` — **new** —
  `node:test` coverage for the live-client wiring, the subscribe
  callback, and App routing (the fixture regression guard lives in
  this file's `describe('App routing')` block)
- `apps/arena-client/src/App.vue` — **modified** — query-string
  routing between `<LobbyView />`, the inline live branch hosting the
  boardgame.io client lifecycle + `<ArenaHud />`, and the existing
  fixture path

No other files may be modified.

---

## Acceptance Criteria

### Dependency update
- [ ] `apps/arena-client/package.json` declares `"boardgame.io": "^0.50.0"`
      in `dependencies` and the range matches `apps/server/package.json`'s
      pin exactly
- [ ] `pnpm install` succeeds without a lockfile regression outside the
      arena-client sub-tree

### Lobby API
- [ ] `lobbyApi.ts` exports `createMatch`, `listMatches`, `joinMatch`,
      and `LobbyMatchSummary` — no other exports
- [ ] `createMatch` POSTs to `/games/legendary-arena/create` with a body
      containing `setupData` and `numPlayers`
- [ ] `listMatches` GETs `/games/legendary-arena` and returns parsed
      matches
- [ ] `joinMatch` POSTs to `/games/legendary-arena/:matchID/join` with
      the expected body
- [ ] Every function throws a full-sentence `Error` on non-2xx whose
      message contains the endpoint URL and the status code
- [ ] No import from `axios`, `node-fetch`, `ky`, or any non-native HTTP client

### boardgame.io Client factory
- [ ] `bgioClient.ts` is the only file in `apps/arena-client/src/**` with
      a runtime import of `@legendary-arena/game-engine`
      (confirmed by `Select-String` across the tree, allowing
      `import type` hits elsewhere)
- [ ] `createLiveClient(...)` returns `{ start, stop, submitMove }` —
      all three are typed as functions
- [ ] The `client.subscribe` callback calls
      `useUiStateStore().setSnapshot(state.G)` and does not perform
      any other store mutation
- [ ] `submitMove(name, ...args)` calls `client.moves[name](...args)` —
      no raw WebSocket writes
- [ ] No import from `boardgame.io/react`

### Lobby view
- [ ] `<LobbyView />` renders a create-match form containing exactly the
      nine `MatchSetupConfig` fields listed in Locked Contract Values,
      plus `numPlayers`
- [ ] The "Create" action calls `createMatch` then `joinMatch` then sets
      `window.location.search` to `?match=<id>&player=0&credentials=<s>`
- [ ] The "Join" action calls `joinMatch` then sets `window.location.search`
      to `?match=<id>&player=<seat>&credentials=<s>`
- [ ] Lobby API errors surface as full-sentence strings inside a visible
      error region (no `alert()`, no silent swallow)

### App routing + live-match branch
- [ ] `<App />` renders `<LobbyView />` when neither `?match=` nor
      `?fixture=` is present
- [ ] `<App />` renders the live branch (`<ArenaHud />` present, no
      `<LobbyView />`) when `?match=<id>&player=<pid>` is present
- [ ] `<App />` preserves the fixture path when `?fixture=<name>` is
      present — the live branch is not mounted and no
      `createLiveClient(...)` call is issued
- [ ] On live-branch mount, `createLiveClient(...)` is called exactly
      once with the parsed `matchID` / `playerID` / `credentials` and
      `.start()` is invoked; on live-branch unmount, `.stop()` is
      invoked exactly once
- [ ] Route precedence is `fixture > live > lobby` — a URL with both
      `?fixture=` and `?match=` selects fixture (verified by test)
- [ ] Partial live params fall back to lobby — a URL with `?match=`
      but no `?player=` or no `?credentials=` renders `<LobbyView />`,
      never a half-mounted live branch (verified by test)

### Environment
- [ ] `apps/arena-client/.env.example` exists with a single
      `VITE_SERVER_URL=http://localhost:8000` entry and a header
      comment naming the variable's purpose and per-environment source
- [ ] `VITE_SERVER_URL` is read exactly once per module in
      `lobbyApi.ts` and `App.vue` (via a shared `serverUrl` helper in
      `lobbyApi.ts`), never re-read ad-hoc inside a function body

### Fixture regression guard
- [ ] A `node:test` asserts that loading the app with `?fixture=mid-turn`
      does not call `globalThis.fetch` (stub observer) and does not
      instantiate a boardgame.io `Client`

### Tests
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (all
      test files)
- [ ] No test file imports from `boardgame.io/testing`
- [ ] No test file contacts a live server (all `fetch` calls are stubbed)

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] No files under `packages/game-engine/**` or `apps/server/**` were
      modified

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/arena-client build
# Expected: exits 0, no TypeScript errors, Vite build succeeds

# Step 2 — run all tests
pnpm --filter @legendary-arena/arena-client test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm bgioClient.ts is the only runtime engine import site
Select-String -Path "apps\arena-client\src" -Pattern "from '@legendary-arena/game-engine'" -Recurse |
  Where-Object { $_.Line -notmatch "import type" }
# Expected: exactly one match, in src/client/bgioClient.ts

# Step 4 — confirm no boardgame.io/react import
Select-String -Path "apps\arena-client\src" -Pattern "boardgame.io/react" -Recurse
# Expected: no output

# Step 5 — confirm no forbidden HTTP clients
Select-String -Path "apps\arena-client\src" -Pattern "axios|node-fetch|from 'ky'" -Recurse
# Expected: no output

# Step 6 — confirm the boardgame.io dep is pinned in arena-client
Select-String -Path "apps\arena-client\package.json" -Pattern "\"boardgame.io\""
# Expected: exactly one match with the ^0.50.0 range

# Step 7 — confirm the nine MatchSetupConfig fields appear in LobbyView
Select-String -Path "apps\arena-client\src\lobby\LobbyView.vue" -Pattern "schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount"
# Expected: at least 9 matches (one per field)

# Step 7.5 — confirm VITE_SERVER_URL is documented
Select-String -Path "apps\arena-client\.env.example" -Pattern "VITE_SERVER_URL"
# Expected: exactly one match

# Step 8 — smoke-boot end-to-end (manual; not a test gate)
# Terminal A: node --env-file=.env apps/server/src/index.mjs
# Terminal B: pnpm --filter @legendary-arena/arena-client dev
# Open http://localhost:5173, create a match, join it, confirm the HUD
# renders with live state. This is the packet's human-facing smoke test
# and is recorded in the session invocation.

# Step 9 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] Smoke-boot end-to-end per Verification Step 8 succeeds (manually
      verified in the session invocation)
- [ ] `bgioClient.ts` is the only arena-client file with a runtime
      engine import (confirmed with `Select-String`)
- [ ] No `Math.random` in any new or modified file (confirmed with
      `Select-String`)
- [ ] No `boardgame.io/react` import anywhere in arena-client
      (confirmed with `Select-String`)
- [ ] No axios / node-fetch / ky / alternative HTTP clients
      (confirmed with `Select-String`)
- [ ] WP-061 outputs (`main.ts`, `stores/uiState.ts`, `fixtures/**`,
      `components/hud/**`) were not modified
      (confirmed with `git diff`)
- [ ] WP-089 outputs (`packages/game-engine/src/game.ts`,
      `game.playerView.test.ts`) were not modified
      (confirmed with `git diff`)
- [ ] `apps/server/**` is untouched (confirmed with `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — a player can now open
      `http://localhost:5173`, create a match, join it, and play it to
      completion in a browser without CLI tools
- [ ] `docs/ai/DECISIONS.md` updated — at minimum:
  - `D-90xx` — query-string routing is retained over Vue Router as the
    MVP routing mechanism (consistent with WP-061's fixture precedent)
  - `D-90xx` — `bgioClient.ts` is the single runtime engine import site
    in arena-client; all other client files remain type-only engine
    consumers
  - `D-90xx` — credentials live in the URL query string for MVP;
    durable identity and session persistence are explicitly deferred
    to WP-052
  - `D-90xx` — `VITE_SERVER_URL` is the sole server-origin env var;
    local dev defaults to `http://localhost:8000` via `.env.example`;
    production values are set in the Cloudflare Pages build env, not
    committed
  - `D-90xx` — lobby `join` endpoint contract (verified against the
    running server during this session): canonical request body shape,
    canonical response field name for credentials, and which of the
    two CLI scripts (`join-match.mjs` vs `create-match.mjs`) holds the
    pre-existing bug. Fix for the buggy CLI script is deferred to a
    follow-up WP placeholder added to `WORK_INDEX.md` during this
    session; the CLI is not modified here (scope guard)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-090 checked off with
      today's date and the `future lobby client WP` placeholder in the
      Dependency Chain (line ~1645) is replaced with a concrete
      `WP-090 (+ WP-011, WP-032, WP-061, WP-089)` entry
