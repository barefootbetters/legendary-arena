# EC-090 — Live Match Client Wiring (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-090-live-match-client-wiring.md`
**Layer:** Client UI (`apps/arena-client/`)

> **Status: DRAFT.** Do not execute until (a) WP-011, WP-032, WP-061,
> and WP-089 are merged on `main`; (b) WP-090 is registered in
> `WORK_INDEX.md` (done — line 1556); (c) the 00.3 lint gate has been
> re-run against the amended WP-090 and recorded passing; (d) this EC
> is registered in `EC_INDEX.md`.

## Before Starting

> **STOP** if any checkbox below is false. Execution is not permitted
> until every item is satisfied.

- [ ] WP-011 merged: `apps/server/scripts/{create-match,list-matches,join-match}.mjs` exist and target the lobby endpoints
- [ ] WP-032 merged: `ClientTurnIntent`, `validateIntent`, `computeStateHash` exported from `@legendary-arena/game-engine`
- [ ] WP-061 merged: `apps/arena-client/` bootstrap present; `useUiStateStore().setSnapshot(next: UIState | null)` is the store's sole mutation
- [ ] WP-089 merged: `LegendaryGame.playerView` wired; every `state.G` observed by a boardgame.io client is `UIState`
- [ ] Baseline captured: `pnpm --filter @legendary-arena/arena-client build` exits 0; `pnpm --filter @legendary-arena/arena-client test` exits 0 on `main` with test count noted
- [ ] `grep -rn "from '@legendary-arena/game-engine'" apps/arena-client/src` shows only `import type` hits (zero runtime engine imports pre-session)
- [ ] Session Protocol resolved: join endpoint request body and response field name verified against a running server; outcome recorded in the session invocation (pre-coding)

## Locked Values (do not re-derive)

- **MatchSetupConfig fields (exactly these nine, verbatim):** `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`
- **Lobby HTTP endpoints (exactly these three, canonical shapes):**
  - `POST {VITE_SERVER_URL}/games/legendary-arena/create` — body `{ numPlayers, setupData: MatchSetupConfig }` (matches `create-match.mjs:84-87`)
  - `GET  {VITE_SERVER_URL}/games/legendary-arena` — returns boardgame.io match list
  - `POST {VITE_SERVER_URL}/games/legendary-arena/:matchID/join` — body `{ playerID, playerName }` (both required; seat is deterministic)
- **Phase names:** `'lobby'` | `'setup'` | `'play'` | `'end'`
- **Default server URL (dev-only fallback):** `http://localhost:8000`
- **MoveError shape (engine-authored, not client-derived):** `{ code: string; message: string; path: string }`
- **Route discriminator precedence:** `fixture` > `live` > `lobby`
- **Live-route admission gate:** all three of `?match=<non-empty>`, `?player=<non-empty>`, `?credentials=<non-empty>`; any missing/empty falls back to `lobby`
- **Subscribe snippet (exact):** `client.subscribe((state) => { useUiStateStore().setSnapshot((state?.G ?? null) as UIState | null) })` — `?? null` coalesces `undefined` first-frames
- **Factory surface:** `createLiveClient(...)` returns exactly `{ start, stop, submitMove }` — no other keys
- **`LobbyMatchSummary` shape (exact):** `{ matchID: string; players: { id: string; name?: string }[]; setupData: MatchSetupConfig | null; gameover: unknown | null }` — `players` is per-seat, never collapsed to a count

## Guardrails

- **`bgioClient.ts` is the ONLY runtime engine-import site in `apps/arena-client/src/`.** Every other file stays `import type` only. Verify with `Select-String` over the tree.
- **Client never derives `UIState`.** No call to `buildUIState` or `filterUIStateForAudience` anywhere; subscribe writes `state.G` verbatim and `snapshot === null` is the sole empty-state branch.
- **Intent-only transport.** `submitMove(name, ...args)` delegates to `client.moves[name](...args)`. No raw `WebSocket`, no `boardgame.io/react`, no alt HTTP client (`axios`, `node-fetch`, `ky`), no Vue Router, no browser storage (`localStorage`/`sessionStorage`/`IndexedDB`) — credentials live in the URL for MVP (WP-052 defers durable identity).
- **Fixture path is a zero-network regression guard.** `?fixture=<name>` short-circuits the live client; test asserts zero `fetch` calls and zero `Client` instantiation.
- **Scope edges are rigid.** No changes under `packages/game-engine/**` or `apps/server/**` — even to fix the pre-existing CLI `credentials` / `playerCredentials` drift (defer to a follow-up WP placeholder in `WORK_INDEX.md`).
- **`VITE_SERVER_URL` is module-resolved once.** `lobbyApi.ts` exports `serverUrl`; `App.vue` imports it rather than re-reading `import.meta.env` inline.
- **Lobby errors are full-sentence strings in `<LobbyView />`.** No `alert()`, no silent swallow; `console.warn` permitted for dev diagnostics only.

## Required `// why:` Comments

- `lobbyApi.ts` — `serverUrl` fallback is dev-only; production `VITE_SERVER_URL` is set in the Cloudflare Pages build env
- `bgioClient.ts` — on `state.G` cast: WP-089's `playerView` reshapes the client-visible G to `UIState`; the runtime contract is enforced engine-side
- `bgioClient.ts` — on `submitMove` pass-through: client submits intent via boardgame.io's move API, never raw WebSocket messages; the server dispatches to the engine
- `App.vue` — on route discriminator: precedence `fixture > live > lobby`; fixture short-circuits live wiring so offline/test UX and the dev bug-report mechanism are preserved
- `App.vue` — on partial-live-param fallback: missing/empty `match`/`player`/`credentials` falls back to lobby silently (matches WP-061's fixture silent-no-op precedent); never half-mount the live branch

## Files to Produce

- `apps/arena-client/package.json` — **modified** — add `"boardgame.io": "^0.50.0"` to `dependencies` (range matches `apps/server/package.json`); no other dep churn
- `apps/arena-client/.env.example` — **new** — single `VITE_SERVER_URL=http://localhost:8000` entry + header comment naming purpose and per-environment source
- `apps/arena-client/src/lobby/lobbyApi.ts` — **new** — `createMatch` / `listMatches` / `joinMatch` + `LobbyMatchSummary` type + exported `serverUrl`; browser-native `fetch` only
- `apps/arena-client/src/lobby/lobbyApi.test.ts` — **new** — `node:test` coverage; `globalThis.fetch` stubbed; full-sentence error assertions include endpoint + status code
- `apps/arena-client/src/lobby/LobbyView.vue` — **new** — create-match form (9 `MatchSetupConfig` fields + `numPlayers`); list-and-join section; error region
- `apps/arena-client/src/client/bgioClient.ts` — **new** — `createLiveClient(...)`; the single runtime engine-import site in arena-client
- `apps/arena-client/src/client/bgioClient.test.ts` — **new** — `describe('createLiveClient')` + `describe('App routing')`; fixture regression guard lives here
- `apps/arena-client/src/App.vue` — **modified** — query-string route between `<LobbyView />`, inline live branch (`<ArenaHud />` + bgioClient lifecycle), and existing fixture path
- `docs/ai/STATUS.md` — **modified** — WP-090 complete note
- `docs/ai/DECISIONS.md` — **modified** — `D-90xx` entries: query-string-over-Vue-Router, single runtime engine-import site, credentials in URL (WP-052 deferral), `VITE_SERVER_URL` as sole server-origin var, join endpoint contract (with CLI drift follow-up reference)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-090 with today's date; replace the `future lobby client WP (+ WP-011)` placeholder (≈line 1645) with `WP-090 (+ WP-011, WP-032, WP-061, WP-089)`; add a new placeholder for the CLI `credentials` field-drift follow-up
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — mark EC-090 Done with date

## After Completing

- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0 with zero new TS errors or warnings
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 with test count equal to baseline + new tests
- [ ] Smoke-boot end-to-end succeeds: create → join → live HUD renders with server-authored state (documented in session invocation)
- [ ] `Select-String -Path "apps\arena-client\src" -Pattern "from '@legendary-arena/game-engine'" -Recurse | Where-Object { $_.Line -notmatch "import type" }` shows exactly one match, in `src/client/bgioClient.ts`
- [ ] `Select-String -Path "apps\arena-client\src" -Pattern "boardgame.io/react" -Recurse` shows no match
- [ ] `Select-String -Path "apps\arena-client\src" -Pattern "axios\|node-fetch\|from ['\"]ky['\"]" -Recurse` shows no match
- [ ] `Select-String -Path "apps\arena-client\src" -Pattern "localStorage\|sessionStorage\|indexedDB" -Recurse` shows no match
- [ ] `Select-String -Path "apps\arena-client\src\lobby\LobbyView.vue" -Pattern "schemeId\|mastermindId\|villainGroupIds\|henchmanGroupIds\|heroDeckIds\|bystandersCount\|woundsCount\|officersCount\|sidekicksCount"` shows ≥ 9 matches
- [ ] `git diff --name-only packages/game-engine/ apps/server/` returns empty
- [ ] `git diff --name-only` lists only files under `## Files to Produce`

## Common Failure Smells

- Subscribe crashes with `Cannot read properties of undefined` on first frame → missed the `?? null` coalesce before `playerView` has produced a frame
- URL becomes `?credentials=undefined` after Join → helper locked the wrong credentials field without the pre-coding verification step; re-check the live-server response and `DECISIONS.md D-90xx`
- `?match=abc` with no `?player=` renders a blank page → route admission gate was lax; all three of `match`/`player`/`credentials` must be non-empty
- Join UI can't disambiguate open vs filled seats → `LobbyMatchSummary.players` was collapsed to `number` per the CLI summary instead of the per-seat `{id,name?}[]` locked shape
- Fixture regression test fails because `createLiveClient` ran → route precedence inverted; `live` won over `fixture` in at least one branch
- Browser bundle pulls engine runtime from a file other than `bgioClient.ts` → a mixed `import { type UIState, LegendaryGame }` masked a runtime import; split into separate `import type` / `import` statements
