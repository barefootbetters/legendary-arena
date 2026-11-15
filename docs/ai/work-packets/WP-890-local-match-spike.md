# WP-890 — Local match spike: `LegendaryGame` on an in-browser `Local()` master, fed by a recorded setup bundle (arena-client, behind a build-time flag)

**Status:** Draft 2026-11-12
**Primary Layer:** arena-client (a new flag-gated dev route and its client factory), plus one root tooling script that records the setup bundle. No engine, registry, server or card-data change.
**Dependencies (all ✅):**
- WP-090 (arena-client may import the engine's `.` Runtime-Safe Engine Surface at runtime; `bgioClient.ts` is the live client factory this packet sits beside)
- WP-311 / D-24096 (`createLiveClient` feeds `useConnectionStore` with `isConnected` and `_stateID`; the local client feeds it the same way)
- WP-410 / D-24222 (`UIState.matchCardImageUrls`, the per-match image list the spike counts)
- WP-785 / D-24633 (`FEATURED_TABLE`, the composition-legal one-player Core setup the spike plays)
- WP-036 / D-3601 (`createRandomPolicy`, `getLegalMoves`: the engine's own AI, used only by the test driver)
- D-24715 (`matchSeed.mjs`: a caller that needs a specific seed overrides `seed` in a copy of the game)
- D-24119 (`matchReplay.logic.ts`: the `CreateGameReducer` replay pattern the test's reference reducer follows)
- PR #3305, #3306, #3310 (merged): `wiki/airplane-mode.md`, whose §"Candidate build steps" slice 0 this packet builds and whose §"Open Questions › Facts to settle by spike" it answers

**User-Visible Surface:** none — infrastructure (a development-only route behind `VITE_LOCAL_SPIKE`, which no deploy sets).
**Risk Tier:** LOW — no production code path changes behaviour: the route, its chunk and the bundle fixture are compiled out unless the flag is set. No server, persistence, auth, money or engine surface is touched, and the spike's own code persists nothing.
**Lane:** Standard (two-session). Not lightweight-eligible: D-24842 records the first in-browser match host and a new data shape (the setup bundle), and the allowlist is more than four code and test files.

> Baseline: `origin/main` at `2f404fb1` plus the reserve #3313. Code facts were read on 2026-11-12 at that commit. The boardgame.io facts were read from the installed `boardgame.io@0.50.2` CJS bundles under `node_modules/.pnpm/boardgame.io@0.50.2/node_modules/boardgame.io/dist/cjs/`. Pre-flight ran the design end to end in a scratch folder (Gate Record): with `LOCAL_SPIKE_DEFAULT_SEED`, the local client matched the reference reducer after every step and reached gameover after 2 lobby moves plus 175 policy moves (the scheme won on turn 25); the initial state has 31 unique `matchCardImageUrls`; setup reads all 41 sets and 2,882 cards, about 4.3 MB as 2-space JSON and 0.50 MB at gzip level 9.

---

## Goal

Answer, with running code, the questions `wiki/airplane-mode.md` sends to a spike before any shipping airplane-mode work is planned:

1. **Does `LegendaryGame` run unchanged on a `Local()` master in the browser**, with `Game.setup()` reading card data from a plain-data reader instead of the registry package?
2. **Does the local master match the server's reducer?** Driven move for move, does the local client's UIState equal the projection of the same state built by boardgame.io's own reducer, the D-24119 replay pattern?
3. **Does a match record replay identically?** Setup config, seed and move log, replayed on a fresh local master, give the same UIState after every move.
4. **What does it cost?** The setup bundle's bytes (raw and gzip), the spike chunk's bytes, and the featured table's unique card-image count (replacing the page's 40–60 estimate).

**After this session:** a developer can run `VITE_LOCAL_SPIKE=1 pnpm --filter @legendary-arena/arena-client dev`, open `?route=local-spike`, and play the featured table with no game server running. A replay button checks the record. The answers go into D-24842 and the airplane-mode page.

## User-Visible Impact

None. Players see nothing: a production build has no route, no chunk and no fixture. The impact is a decision: whether airplane mode's slices 1 to 5 are worth planning, and on what footing.

## Assumes

1. `LegendaryGame`, `setRegistryForSetup`, `validateMatchSetup`, `createRandomPolicy`, `getLegalMoves` and `computeStateHash` are exported from the engine's `.` surface (`packages/game-engine/src/index.ts:2-3`, `:29`, `:375`, `:629-630`), and `CardRegistryReader` is a type export (`:30`). `packages/game-engine/package.json` maps `.` to `dist/index.js`, so the engine is built before anything resolves it.
2. `CardRegistryReader` (`packages/game-engine/src/matchSetup.validate.ts:47`) is structural: `listCards()`, `listSets()`, `getSet(abbr)`, an optional `playerCountSetup` property, and optional `resolve*` functions. For `FEATURED_TABLE`, setup reads `listCards`, `listSets`, `getSet` (all 41 sets), `playerCountSetup` and three `resolve*` functions, the same set for two seeds (pre-flight). Every member is plain data or a pure function of plain arguments.
3. `setRegistryForSetup` (`game.ts:110`) sets a module-level holder that `Game.setup()` and `validateSetupData` read (`game.ts:96-112`). No browser code reads or sets it today: the server sets it at startup, in its own process.
4. **boardgame.io 0.50.2 never passes `setupData` to a local match.** `Master.onSync` creates an unknown match with `createMatch({ game, numPlayers, setupData: undefined })`, and `createMatch` runs `game.validateSetupData` (`master-9bf9c1d4.js:213-222`). `LegendaryGame.validateSetupData(undefined)` returns an error and `LegendaryGame.setup(context, undefined)` throws (`game.ts:407-414`, `:446-455`). `LocalTransport.requestSync` discards `onSync`'s result, so the failure is silent: the client's state stays `null`. A local match therefore needs a **copy of the game** whose `setup` closes over the `MatchConfiguration` and whose `validateSetupData` accepts `undefined`.
5. A `Local()` client gets its projection only from `LocalMaster`'s `filterPlayerView` (`socketio-638b66b8.js:189-210`). `Client.getState()` applies `playerView` itself only when there is no `multiplayer` (`client-dde37916.js:458-470`). So a local client sees the same `playerView` projection a networked one does. Whether moves registered `client: false` (D-10008) run on a local master is checked by AC 3, not assumed.
6. `LegendaryGame` is a plain object (not frozen, no getters) with keys `name, minPlayers, maxPlayers, disableUndo, validateSetupData, setup, endIf, playerView, moves, phases`. `Client` and `Master` each run `ProcessGameConfig`, which adds `plugins` to the copy only. `matchSeed.mjs:50-62` gives the server's processed game a `seed` getter (D-24715), and its comment says a caller that needs a specific seed "overrides `seed` in a copy". A plain `{ ...LegendaryGame, seed }` therefore pins the seed for a local match.
7. `Local()` keeps one master per game object, in a module-level map keyed by the object passed to `Client` (`socketio-638b66b8.js:293-313`), and the spike's `matchID` is fixed. A reused game object would reuse a finished match.
8. `matchReplay.logic.ts:43` loads `boardgame.io/dist/cjs/internal.js` through a plain namespace import and builds `CreateGameReducer({ game: LegendaryGame, isClient: false })` (`:73-74`, `:236`). `internal.js` also exports `InitializeGame` and no action creators. The reference action is `{ type: 'MAKE_MOVE', payload: { type: <moveName>, args: [<args>], playerID: '0' } }`, matching `matchReplay.logic.ts`'s `payload.args[0]`.
9. `bgioClient.ts:33-74` loads `Client` and the multiplayer namespace from `boardgame.io/dist/cjs/{client,multiplayer}.js` through a namespace import and a `pkg.X ?? pkg.default?.X` fallback, because Node's ESM resolver and Vite disagree on these CJS bundles. The multiplayer bundle also exports `Local`. The local factory and the test use the same fallback for `Client`, `Local`, `InitializeGame` and `CreateGameReducer`.
10. `createLiveClient` returns `{ start, stop, submitMove, resync }` (`bgioClient.ts:164-176`). For each frame it writes `G` with `useUiStateStore().setSnapshot` and calls `useConnectionStore().setConnected(state.isConnected === true, state._stateID)` (`:487-499`). `BattleBrief` sends `startMatchIfReady` only when `connectionStore.lastStateId` advances (`BattleBrief.vue:155-171`). `PlayViewport` takes a `submitMove` prop (`PlayViewport.vue:160`), and the `play-fixture` route mounts it with no `matchId` or `playerId` (`App.vue:518-520`).
11. A match starts in the `lobby` phase (`game.ts:768-769`). `setPlayerReady({ ready: true })` and then `startMatchIfReady({})` move a one-seat match into play. `getLegalMoves` covers only the play phase (`ai.legalMoves.ts:113-118`).
12. `App.vue` is `<script lang="ts">`, so its module-scope constants run when it is imported. It parses `?route=` into named booleans (`:156-166`), resolves a closed `AppRoute` union in `selectRoute` (`:187-230`), and switches on `route` in its template (`:494-548`). `App.test.ts` mounts it under node:test through `mountApp(searchOverride)` and reads `data-route`. Under tsx, `import.meta.env` is `undefined`.
13. **The flag gate.** Vite replaces `import.meta.env.VITE_*` at build time, and Rollup drops a dynamic `import()` in a branch that is constant-false. The form `typeof import.meta.env === 'object' && import.meta.env.VITE_LOCAL_SPIKE === '1'` drops the chunk when the flag is unset, keeps it when set, and is `false` under tsx. The house form `import.meta.env?.VITE_LOCAL_SPIKE` is **not** eliminated: a Vite 5.4 build still emitted the chunk and the marker with the flag unset (pre-flight). `vite.config.ts` has no `manualChunks`, has `sourcemap: true` (`:136`), and fails the build on any `node:*` import (`:24-39`).
14. App.vue's `useAnalyticsCapture()` runs on every route. On mount it POSTs `/api/analytics/events`, and when the snapshot reaches `phase === 'play'` it writes `localStorage` flags (`useAnalyticsCapture.ts:199-210`, `analyticsEmitter.ts:50`, `:129`).
15. `.claude/rules/architecture.md:172`: arena-client may import `@legendary-arena/game-engine` (`.` surface only) at runtime, but not `registry`. A JSON fixture of card records is plain data and imports no package.
16. The server loads the registry with `createRegistryFromLocalFiles({ metadataDir: 'data/metadata', cardsDir: 'data/cards' })` (`apps/server/src/server.mjs`, `loadRegistry`). The root `package.json` depends on `@legendary-arena/game-engine` and `@legendary-arena/registry`, so a root script can load both once `pnpm -r build` has produced their `dist`. boardgame.io isn't a root dependency; a root script reaches `internal.js` through `createRequire` (the `matchSeed.mjs:24-27` bridge), anchored here at `packages/game-engine/package.json`.
17. `FEATURED_TABLE` (`apps/arena-client/src/lobby/featuredTable.ts:19-32`) is `core/midtown-bank-robbery`, `core/magneto`, `core/brotherhood`, `core/sentinel`, and `core/spider-man`, `core/hulk`, `core/wolverine`, with `bystandersCount` 30, `woundsCount` 30, `officersCount` 30, `sidekicksCount` 12, and `FEATURED_PLAYER_COUNT = 1`.
18. `UIState.matchCardImageUrls` lists every card image a match can show (`uiState.build.ts:2723`, WP-410 / D-24222).
19. boardgame.io's `sync` sends `initialState` unfiltered, so a device-hosted match necessarily holds its seed and full initial `G` (pre-flight). D-24715's seed redaction governs server matches only.

If any assumption is false, STOP and reconcile (update this WP and the D-24842 reservation) before coding.

## Context (Read First)

- `wiki/airplane-mode.md`: the design. This packet is its slice 0. It also settles two of the page's questions: whether the reader interface takes plain data without the registry package, and the setup's real image count.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1 Card Data Shapes and §7 Match Configuration: the bundle carries both, unchanged.
- `docs/ai/ARCHITECTURE.md` Section 1 §Package Import Rules, §Layer Boundary (Authoritative), §Card Data Flow: Registry into Game Engine, and §Persistence Boundaries (with D-24095: application code never persists `G`). `.claude/rules/architecture.md` §Layer Boundary.
- **"Engine Owns Truth" (`.claude/rules/architecture.md:47`, ARCHITECTURE Principle #2) says "no client-side rule execution".** The spike's UI still submits intents and reads only `playerView`, but the engine itself runs on a master hosted in the browser. D-24842 records this as a development-only exception behind the flag. A production device host needs an amendment to this invariant: that is the airplane-mode page's decision 1.
- `docs/ai/DESIGN-SOLO-BOT-ALLY.md:100`, `:351`: no client-side bot execution in online play. The engine's AI runs here only inside a test, as a driver, never in the page.
- DECISIONS scanned: D-10008 (`client: false` moves), D-14401 (the Setup-Tooling Surface the client may not import), D-24095 (the framework store), D-24119 (replay), D-24222 (image list), D-24715 (seed), D-24838 (store builds wrap the web client). None conflicts beyond the invariant above.
- **Why a recorded bundle, not `createRegistryFromHttp`:** arena-client may not import `registry` at runtime (Assumes 15), and the page's candidate design is a server-built setup bundle. Recording the reads a real setup makes is the cheapest way to learn what that bundle must contain.
- **Why the whole card list is in the bundle:** setup calls `listCards()` and `getSet` on every set (Assumes 2). A reader that returned only the setup's own cards could build a silently incomplete match, the empty-registry failure the airplane-mode page warns about. The spike records exactly what setup asks for and measures its size; trimming it is slice 3's problem.

## Non-Negotiable Constraints

**Repo-wide (always apply):** full file contents for every new or modified file (no diffs, no snippets); ESM only, Node v22+, `node:` prefixes; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` and `.claude/rules/code-style.md` (full-word names, JSDoc on every function, functions about one screen long, full-sentence error messages, explicit `try/catch` on I/O); `node:test` `.test.ts` suites. The boardgame.io CJS bundles are loaded with a namespace import and the `pkg.X ?? pkg.default?.X` fallback, the `bgioClient.ts` precedent for the §16.6 import rule.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile before coding. One WP per session.

**Packet-specific:**
- No engine, registry, server, card-data, `UIState` or `00.2` change. The engine is consumed through its `.` surface exactly as it is.
- Nothing in a default build changes: with `VITE_LOCAL_SPIKE` unset, `dist/` contains no file holding the bundle marker (AC 6), and the route resolves exactly as today.
- The spike's own code persists nothing: no IndexedDB, Web Storage, Cache Storage or service worker. (App-wide code that already runs on every route, Assumes 14, is unchanged.)
- The page never runs a bot or the engine's AI. The AI appears only in `localSpikeClient.test.ts`.
- `validateSetupData` is bypassed in the game copy only after `validateMatchSetup(matchConfiguration, reader, numPlayers)` has passed; a failed validation throws a full-sentence error before any client exists.
- No existing test is edited to go green.

## Locked Values

- **Flag:** `App.vue` defines `const isLocalSpikeFlagOn = typeof import.meta.env === 'object' && import.meta.env.VITE_LOCAL_SPIKE === '1';`. `VITE_LOCAL_SPIKE` is declared `readonly VITE_LOCAL_SPIKE?: string` in `apps/arena-client/src/env.d.ts` and documented as a commented-out line in `apps/arena-client/.env.example`. No deploy config, workflow or `_headers` file sets it.
- **Route:** `?route=local-spike` resolves to `AppRoute` `'local-spike'` only when the flag is on; with it off, it falls through exactly as an unknown `?route=` value does today. Precedence: after `login`, before `profile`. The predicate is a pure exported helper `isLocalSpikeRoute(routeParam: string | null, isFlagOn: boolean): boolean` in `apps/arena-client/src/lib/localSpikeRoute.ts`.
- **Lazy page:** `const LocalSpikePage = isLocalSpikeFlagOn ? defineAsyncComponent(() => import('./pages/LocalSpikePage.vue')) : null;`. It is registered as `components: { …, ...(LocalSpikePage !== null ? { LocalSpikePage } : {}) }` (a nullable const can't sit in `components` under strict typing), and the template renders `<LocalSpikePage />` only in the `route === 'local-spike'` branch.
- **Seed:** `LOCAL_SPIKE_DEFAULT_SEED = 'local-spike-0001'`. The page's **New seed** button makes a 32-character lowercase hex seed from `crypto.getRandomValues` (16 bytes, the `matchSeed.mjs` length) and restarts the match.
- **Game copy:** `createLocalSpikeGame({ matchConfiguration, seed })` returns `{ ...LegendaryGame, seed, setup: (context) => LegendaryGame.setup(context, matchConfiguration), validateSetupData: () => undefined }`. Every client (page start, New seed, replay, each test) gets a fresh object from it.
- **Client:** `createLocalSpikeClient({ bundle, matchConfiguration, seed, writesStores })` takes a `LocalSpikeSetupBundle` and builds `Client({ game: createLocalSpikeGame(...), numPlayers: 1, multiplayer: Local(), matchID: 'local-spike', playerID: '0' })` and returns `{ start, stop, submitMove, resync, getRecord, getState }`. `resync` is a no-op. `getState(): UIState | null` returns the latest frame's `G`; `getRecord(): LocalSpikeRecord` returns a copy. When `writesStores` is `true`, each frame writes `G` with `useUiStateStore().setSnapshot` and calls `useConnectionStore().setConnected(state.isConnected === true, state._stateID)`, as `createLiveClient` does; when `false`, it writes no store.
- **Setup bundle v1** (`apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json`; compact JSON, LF, one trailing newline; keys in this order):
  `{ schemaVersion: 1, bundleKind: 'local-spike-setup-bundle', numPlayers: 1, matchConfiguration, seed, matchCardImageUrlCount, initialStateHash, cards, sets, setData, playerCountSetup, answers }`, where:
  - `seed` is `LOCAL_SPIKE_DEFAULT_SEED`;
  - `matchCardImageUrlCount` is the unique count of the initial state's `matchCardImageUrls`;
  - `initialStateHash` is `computeStateHash` of the initial `G`;
  - `cards` is the `listCards()` result stably sorted by `key` in code-unit order. The recording reader serves that sorted array to validation and setup, so the bundle reproduces exactly what setup saw;
  - `sets` is the `listSets()` result;
  - `setData` maps each abbr passed to `getSet` during recording to its result, keys sorted by code-unit order;
  - `playerCountSetup` is the registry's table, or `null` if absent;
  - `answers` maps each optional function name called during recording (sorted) to an array of `{ args, result }`, in first-call order, deduplicated by `JSON.stringify(args)`.
  `bundleKind` is the marker AC 6 searches for.
- **Bundle reader:** `createSetupBundleReader(bundle)` in `apps/arena-client/src/client/setupBundleReader.ts` returns a `CardRegistryReader` (type-only import). It serves `listCards`, `listSets`, `getSet` and `playerCountSetup` from the bundle; `listCards()` returns a new shallow copy on each call, matching the registry; `getSet` returns `undefined` for an abbr not in `setData`; when the bundle's `playerCountSetup` is `null`, the property is omitted (conditional construction), never set to `null` or `undefined`. Each recorded optional function answers from `answers` by `JSON.stringify(args)`; an unrecorded call throws `Error('The local spike setup bundle has no recorded answer for <name>(<args>). Re-run pnpm spike:local-bundle for this setup.')`. A function never called during recording is left off the reader, so the engine's own `?.` fallback applies as it did during recording. The same file exports `interface LocalSpikeSetupBundle` and `parseLocalSpikeSetupBundle(value: unknown): LocalSpikeSetupBundle`, which rejects a value whose `schemaVersion` isn't 1 or whose `bundleKind` is wrong, with a full-sentence error. The JSON import is narrowed through it, never cast with `as` (the `fixtures/replay/index.ts` precedent).
- **Recorder script:** `node scripts/build-local-spike-bundle.mjs [--check]`, root script `"spike:local-bundle": "node scripts/build-local-spike-bundle.mjs"`. It needs `pnpm -r build` first.
  - It loads the registry as Assumes 16 does and wraps it in a recording reader over every member Assumes 2 lists.
  - It calls `validateMatchSetup(FEATURED_TABLE, recorder, 1)`, then `setRegistryForSetup(recorder)` and `InitializeGame({ game: { ...LegendaryGame, seed: 'local-spike-0001', setup: (context) => LegendaryGame.setup(context, FEATURED_TABLE), validateSetupData: () => undefined }, numPlayers: 1 })`, the game copy inlined, because a root script can't import an arena-client `.ts` module.
  - Its copied `FEATURED_TABLE` values (all nine fields of Assumes 17) are checked against `featuredTable.ts`'s source text at run time, exiting 1 on a difference.
  - It writes the bundle, then prints exactly: `cards <n>, sets <k>, setData <s>, answers <a>`; `bundle bytes <raw>, gzip <gz>` (`zlib.gzipSync`, level 9, of the written file); `matchCardImageUrls <m> unique`; `initialStateHash <h>`.
  - `--check` writes nothing and exits 1 if the regenerated bytes differ from the committed file.
- **Record v1:** `{ schemaVersion: 1, recordKind: 'local-spike-record', numPlayers: 1, matchConfiguration, seed, moves: [ { playerID, moveName, args } ] }`. `args` is the rest array passed to `submitMove(name, ...args)`, stored as `structuredClone(args)`. `submitMove` appends every call, accepted or not, in call order. **Download record** saves it as `local-spike-record-<seed>.json`.
- **Replay:** `replayLocalSpikeRecord(record, bundle)` builds a fresh client with `writesStores: false` from the record's config and seed, starts it, dispatches each move by spreading its `args`, and after each one reads the latest `getState()`. It is synchronous and returns `string[]`: the UIState after each move, as `JSON.stringify` strings. Delivery is synchronous (the default in-memory storage), and subscribers fire more than once per move, so it reads the latest frame and never counts frames. The page compares that array with the strings it captured during play and shows `Replay matches: <n> of <n> moves` or `Replay differs at move <i>`.

## Scope (In)

- **A) Bundle reader** `apps/arena-client/src/client/setupBundleReader.ts`: `createSetupBundleReader` per Locked Values.
- **B) Local client** `apps/arena-client/src/client/localSpikeClient.ts`: `LOCAL_SPIKE_DEFAULT_SEED`, `createLocalSpikeGame`, `createLocalSpikeClient`, `replayLocalSpikeRecord`. `createLocalSpikeClient` runs `validateMatchSetup` on the bundle reader, calls `setRegistryForSetup(createSetupBundleReader(bundle))`, and builds the client.
- **C) Route helper** `apps/arena-client/src/lib/localSpikeRoute.ts`: `isLocalSpikeRoute`.
- **D) Page** `apps/arena-client/src/pages/LocalSpikePage.vue`:
  - It mounts `PlayViewport` with the local handle's `submitMove` (`writesStores: true`, `matchConfiguration: bundle.matchConfiguration`) and no `matchId` or `playerId`, as `play-fixture` does.
  - It catches errors from `createLocalSpikeClient`, **New seed** and **Replay record**, and shows the error's message in the panel. It never renders a blank board.
  - A small panel shows the seed, the move count, **New seed**, **Download record**, **Replay record** and its result, the bundle's byte count (`new Blob([JSON.stringify(bundle)]).size`), and `matchCardImageUrls`' unique count.
  - It calls `stop()` on unmount.
- **E) App wiring** `App.vue`: `isLocalSpikeFlagOn`, the `AppRoute` member, the `parseQuery` / `selectRoute` branch through `isLocalSpikeRoute`, the lazy component, and the template branch. `env.d.ts`, `.env.example`.
- **F) Recorder** `scripts/build-local-spike-bundle.mjs`, the root `package.json` script, and the generated `featuredSetupBundle.json`.
- **G) Tests** (each in an active Pinia where it touches a store).
  - `setupBundleReader.test.ts`: served members; the `getSet` miss; a recorded answer; the full-sentence error for an unrecorded call; the missing-function fallback; `parseLocalSpikeSetupBundle` rejecting a wrong `schemaVersion` or `bundleKind`; `listCards()` returning a new array on each call; `playerCountSetup` omitted when `null`.
  - `localSpikeRoute.test.ts`: the six combinations of `'local-spike'` / another value / `null` with the flag on and off.
  - `localSpikeClient.test.ts`, using the committed bundle:
    1. `validateMatchSetup` passes for `FEATURED_TABLE` on the bundle reader.
    2. The local client starts and delivers a first UIState with `globalThis.fetch`, `globalThis.WebSocket` and `globalThis.XMLHttpRequest` replaced by functions that throw, so any network use fails the test.
    3. **Reference equality.** A reference reducer (`InitializeGame` + `CreateGameReducer`, Assumes 8) holds the same match from a fresh game copy with the same seed. The driver first submits `setPlayerReady({ ready: true })`, then `startMatchIfReady({})`, as player `'0'` to both sides. Then, for each step until `ctx.gameover` or 400 moves, it takes `getLegalMoves(reference.G, { phase, turn, currentPlayer, numPlayers })` and the reference's `playerView` for player `'0'`, and picks with `createRandomPolicy(LOCAL_SPIKE_DEFAULT_SEED).decideTurn(...)`. It dispatches the pick (`intent.move.name`, `intent.move.args`) with `submitMove` and as a `MAKE_MOVE` action to the reference. After every step, `JSON.stringify(handle.getState())` equals `JSON.stringify` of the reference's `playerView` for player `'0'`, and `useConnectionStore().lastStateId` equals the reference's `_stateID`. The test asserts gameover is reached and records the move count.
    4. **Replay.** `replayLocalSpikeRecord(JSON.parse(JSON.stringify(record)), bundle)` of case 3's record returns strings equal to the strings captured live, at every move.
    5. **Bundle identity.** The reference's initial `G` hashes (`computeStateHash`) to the bundle's `initialStateHash`, so a JSON-round-tripped reader builds the same match as the registry. The initial UIState's unique `matchCardImageUrls` count equals `matchCardImageUrlCount`. `bundle.matchConfiguration` deep-equals `FEATURED_TABLE`, and `bundle.seed === LOCAL_SPIKE_DEFAULT_SEED`.
    6. **No aliasing.** After cases 3 and 4, `JSON.stringify(bundle) + '\n'` equals the committed file's text.
  - `App.test.ts`: one case: `?route=local-spike` with the flag unset gives `data-route` ≠ `'local-spike'`.
- **H) Docs** `wiki/airplane-mode.md`:
  - Slice 0's row gains a **Result** line (WP-890 / D-24842) with the measured numbers.
  - The two §"Facts to settle by spike" bullets on the engine and the image count are answered with those numbers. The third (storage eviction) moves under slice 1, where an installed app is first built.
  - The §Edge Cases "iOS storage eviction" bullet replaces "*(unverified against current iOS; check on a device)*" with WebKit's primary sources:
    - https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ (2020): home-screen web apps "have their own counter of days of use";
    - https://webkit.org/blog/14403/updates-to-storage-policy/ (2023): their quota equals Safari's (up to 60% of disk), and WebKit favours them for `persist()`;
    - the Safari 18.4 release notes (https://developer.apple.com/documentation/safari-release-notes/safari-18_4-release-notes): Wake Lock fixed for them.
    A device check under slice 1 still applies.
  - A new Edge Cases bullet: a device-hosted match holds its seed and full initial state (Assumes 19).
  - The front-matter `source` list gains the new files.

## Out of Scope

- Slice 1 (manifest, service worker, app-shell and image caching, the phone airplane-mode test), slice 2 (on-device save and resume), slice 3 (the setup-bundle endpoint, the download button, the WP-888 `phone` tier), slices 4 to 6: their own WPs, if D-24842's evidence supports them.
- Any production route, lobby entry or UI copy; hot-seat or more than one seat; the bot ally; the engine's AI in the page.
- Trimming the bundle below what setup reads; a registry exception for arena-client.
- Changing `bgioClient.ts`, the live route, or the app-wide analytics capture.

## Files Expected to Change

- `apps/arena-client/src/client/setupBundleReader.ts`, `setupBundleReader.test.ts` — **new**
- `apps/arena-client/src/client/localSpikeClient.ts`, `localSpikeClient.test.ts` — **new**
- `apps/arena-client/src/lib/localSpikeRoute.ts`, `localSpikeRoute.test.ts` — **new**
- `apps/arena-client/src/pages/LocalSpikePage.vue` — **new**
- `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` — **new** (generated)
- `scripts/build-local-spike-bundle.mjs` — **new**
- `apps/arena-client/src/App.vue`, `apps/arena-client/src/App.test.ts`, `apps/arena-client/src/env.d.ts`, `apps/arena-client/.env.example` — **modified**
- `package.json` — **modified** (one script)
- `wiki/airplane-mode.md` — **modified**
- Governance (execution close): `docs/ai/DECISIONS.md` (D-24842 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified**

## Contract

- Setup bundle v1 and record v1, as shapes the spike defines. They are spike formats, not a server contract: slice 3's endpoint and slice 5's verifier may change them under their own D-entries.
- The flag gate: with `VITE_LOCAL_SPIKE` unset, a build is what it would be without this packet, apart from the route predicate's dead branch.

## Vision Alignment

**Vision clauses touched:** §8 (deterministic engine), §11 Stateless Client, §16 Performance & Responsiveness (the measurements), §18 (replay).
**Conflict assertion:** No conflict: this WP preserves all touched clauses. §11: the local master holds state only in memory, for a development-only route, so local state stays disposable. Recoverability (refresh, resume) is slice 2's; the spike's match is lost on refresh. It changes no production behaviour.
**Non-Goal proximity:** not crossed (NG-1, no pay-to-win, untouched).
**Determinism (§22):** no engine, `G` shape, replay contract or hash function changes. The packet *tests* determinism on a new host.

## Funding Surface Gate

§20 **N/A**: no funding affordance, channel, copy or account surface (WP-097 §A/§B/§C) is touched.

## API Catalog

§21 **N/A**: no `apps/server` endpoint or `Library-only` catalog function is added or changed.

---

## Acceptance Criteria

1. `pnpm --filter @legendary-arena/arena-client test` passes, including every Scope G case, with no existing assertion edited.
2. `pnpm spike:local-bundle --check` exits 0 on the committed fixture, and a plain run prints the four locked lines. Their numbers are recorded in the `EC-928:` body and D-24842.
3. `localSpikeClient.test.ts` case 3 passes: the local client's UIState and `_stateID` equal the reference reducer's after every step, which shows the `client: false` moves (D-10008) run on the local master. Gameover is reached (pre-flight: 2 lobby moves plus 175 policy moves, the scheme winning on turn 25); the move count is recorded.
4. `localSpikeClient.test.ts` cases 4, 5 and 6 pass: the JSON-round-tripped record replays to the live UIState strings at every move; the bundle's `initialStateHash`, `matchCardImageUrlCount`, `matchConfiguration` and `seed` hold; and the bundle is unchanged after play.
5. `pnpm --filter @legendary-arena/arena-client typecheck` passes, and `vite build` with `VITE_LOCAL_SPIKE=1` succeeds. The spike chunk's raw and gzip sizes from Vite's output are recorded.
6. A default `vite build` (flag unset) succeeds, and `Get-ChildItem -Path apps/arena-client/dist -Recurse -File | Select-String -Pattern 'local-spike-setup-bundle' -SimpleMatch -List` finds nothing. With the flag set, every match is the spike chunk or its `.map`, and the spike chunk matches.
7. **Manual, in Chrome:** with the flag on and no game server running, open `?route=local-spike` and play to gameover or 20 turns, pressing End Turn as needed. The board renders, the match leaves the lobby, and moves apply. DevTools Network shows no Socket.IO connection, and the only `/api/` request is App's `POST /api/analytics/events` (Assumes 14), which fails with no server. Card images from `images.legendary-arena.com` and the client's own files are expected. **Replay record** shows `Replay matches: <n> of <n> moves`. **Download record** saves a file that parses as record v1.
8. `wiki/airplane-mode.md` carries the slice 0 result line, the answered facts and the two Edge Cases changes; `pnpm wiki:lint` reports no finding on it.
9. `git diff --name-only` ⊆ Files Expected to Change.

## Verification Steps

1. `pnpm install`; `pnpm -r build` (engine and registry `dist/`).
2. `pnpm spike:local-bundle` → record the four lines; `pnpm spike:local-bundle --check` → exit 0.
3. `pnpm --filter @legendary-arena/arena-client test` and `typecheck` → 0 fail.
4. `pnpm --filter @legendary-arena/arena-client build`, then `Get-ChildItem -Path apps/arena-client/dist -Recurse -File | Select-String -Pattern 'local-spike-setup-bundle' -SimpleMatch -List` → nothing.
5. `$env:VITE_LOCAL_SPIKE = '1'; pnpm --filter @legendary-arena/arena-client build` → record the spike chunk sizes; the step 4 search → every match is the spike chunk or its `.map`, and the spike chunk matches. Then `Remove-Item Env:VITE_LOCAL_SPIKE`.
6. `$env:VITE_LOCAL_SPIKE = '1'; pnpm --filter @legendary-arena/arena-client dev` → AC 7 in Chrome. Then `Remove-Item Env:VITE_LOCAL_SPIKE`.
7. `git grep -n "VITE_LOCAL_SPIKE"` → only `apps/arena-client/src/env.d.ts`, `apps/arena-client/.env.example`, `apps/arena-client/src/App.vue`, `docs/ai/work-packets/WP-890-local-match-spike.md`, `docs/ai/execution-checklists/EC-928-local-match-spike.checklist.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` and `wiki/airplane-mode.md`. Any other `.ts` or `.vue` file names the flag only in a comment citing D-24842.
8. `pnpm wiki:lint`; `pnpm ledger:numbers:check`; `pnpm roadmap:counts:check`; `git diff --name-only` against the allowlist.

## Definition of Done

- [ ] All ACs pass; allowlist-only diff.
- [ ] D-24842 Active. It records:
  - the game-copy technique (`seed` pinned, `setup` closed over the config, `validateSetupData` bypassed only after an explicit `validateMatchSetup`) and the boardgame.io 0.50.2 facts that force it (Assumes 4, 7);
  - setup bundle v1, how it was recorded, and its measured size;
  - the AC 3 result (local master equals the reference reducer; D-10008 moves run), the AC 4 result (replay identity and initial-state hash identity), the image count and the spike chunk size;
  - the flag gate and its `typeof` form (Assumes 13);
  - that the spike is a development-only exception to "Engine Owns Truth" (`.claude/rules/architecture.md:47`), and that a device-hosted match holds its seed and initial state (Assumes 19);
  - that this decision does **not** authorize a production device-hosted match. The airplane-mode page's decision 1 stays open and is now answerable on evidence.
- [ ] STATUS: "No user-observable change — infrastructure only (development-only spike behind `VITE_LOCAL_SPIKE`)", plus the measurements. WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `pnpm roadmap:counts:write` then `roadmap:counts:check` 0; ledger LANDED.
- [ ] Two-commit topology: `EC-928:` (code, tests, fixture, root script, wiki), then the `SPEC:` close.

## Reserved Decision (lands at execution)

**D-24842 — local-match-spike.** It records everything in the DoD item above. Reserved in NUMBER-LEDGER (#3313); written Active in the execution `SPEC:` close.

## Settled Design Questions (drafting decisions, 2026-11-12)

1. **A flag-gated route, not a production one.** Jeff approved a spike ("Yes, plan the spike", 2026-11-12, on the studio's phone research). Whether the device may host a production match is the airplane-mode page's decision 1, which this packet informs and doesn't take.
2. **`Local()` master, not a client with no `multiplayer`.** The local master projects through `playerView` exactly as the server does (Assumes 5), so the page renders the projection the live route gets. A bare client would test a path no shipping design uses.
3. **A recorded bundle, not a hand-written one.** Recording what setup really reads (Context) avoids guessing, and the measured size is one of the spike's answers.
4. **No persistence by the spike.** On-device save is slice 2. Keeping the record in memory keeps the spike clear of the persistence boundary and D-24095.
5. **The AI only in the test.** DESIGN-SOLO-BOT-ALLY rejects client-side bots for online play. A test driver isn't a bot, and the page is played by hand.
6. **The phone test moves to slice 1.** It needs an installed app (manifest and service worker), which slice 1 builds. WebKit's primary sources already answer the storage-policy question (Scope H).
7. **The `typeof` flag form, not the house `?.` form** (Assumes 13). The `?.` form survives Vite's dead-code elimination; the bare form throws under tsx.
8. **Compact JSON for the fixture.** It is generated, never hand-edited, and about 4.3 MB as 2-space JSON.

---

## Lint Gate Self-Review (00.3)

Independent subagent runs (2026-11-12).

**Run 1: FAIL** on nine text-only items, all fixed:
- §2: the flag expression threw under node:test; the recorder called an arena-client function. Now the `typeof` form (Assumes 13; pre-flight showed `?.` survives the build) and an inlined game copy.
- §3: Assumes 5 and 8 misdescribed their anchors; Assumes 16's bridge anchor; the research-note dependency. Rewritten, and Scope H now cites WebKit's URLs directly.
- §4: added 00.2 §1 / §7, ARCHITECTURE §1 / Layer Boundary / Card Data Flow, the rules file and the DECISIONS scan.
- §5: `App.test.ts` is now an unconditional modify.
- §13: the AC 6 search now recurses; step 7's allowlist is exact.
- §14: the driver leaves the lobby first; the flagged build expects the chunk and its `.map`.
- §15: `none — infrastructure`; `LOW —`; the STATUS phrase.
- §17: §8, §11, §16, §18 replace §12.
- EC-TEMPLATE: Locked Values now spliced from the WP and checked byte-identical; typecheck added to Before Starting.

**Run 2: PASS.** Advisories applied: the EC layer label, the `index.ts` range, and this record.

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Constraints | PASS |
| §3 Assumes | PASS (19 items) |
| §4 Context | PASS |
| §5 Files | PASS |
| §6 Naming | PASS |
| §7 Dependencies | PASS (no new package) |
| §8 Boundaries | PASS (Engine Owns Truth named as a development-only exception) |
| §9 Windows | PASS |
| §10 Env vars | PASS (`VITE_LOCAL_SPIKE`, local-only, `.env.example` + `env.d.ts`) |
| §11 Auth | N/A: no auth surface |
| §12 Tests | PASS |
| §13 Verification | PASS |
| §14 ACs | PASS |
| §15 / §15.1 / §15.2 | PASS |
| §16 Code style | PASS (the §16.6 namespace-import exception stated) |
| §17 Vision | PASS |
| §18 Prose-vs-grep | PASS (step 7 is an allowlist) |
| §19 Bridge-vs-HEAD | N/A: commit-time rule |
| §20 Funding | N/A, justified |
| §21 API catalog | N/A, justified |
| EC-TEMPLATE | PASS |

## Gate Record

**Pre-flight (01.4), independent subagent.**

**Round 1: NOT READY**, seven PS items, all applied:
- **PS-1:** the bare flag throws under tsx, and the house `?.` form survived a Vite 5.4 build with the flag unset. Now the `typeof` form (Assumes 13, Settled Q7).
- **PS-2:** `Select-String -Path <dir>` searched nothing, so AC 6 passed vacuously. Now `Get-ChildItem -Recurse`.
- **PS-3:** `getLegalMoves` covers only the play phase. The driver now sends `setPlayerReady` and `startMatchIfReady` first (Assumes 11).
- **PS-4:** the recorder couldn't import `createLocalSpikeGame`. The copy is inlined.
- **PS-5:** App's analytics capture POSTs on every route (Assumes 14). AC 7 and the persistence constraint are scoped to the spike's own code.
- **PS-6:** the `_stateID` check had no source, and BattleBrief waits on `lastStateId`. The client now feeds `useConnectionStore` (Assumes 10).
- **PS-7:** "Engine Owns Truth" wasn't addressed. Now in Context, and recorded by D-24842 as a development-only exception.

RS items applied: the Assumes 5 correction; the silent-`null` failure smell; a fresh game object per client (Assumes 7); `writesStores: false` for replay; the driver facts (intent shape, `MAKE_MOVE`, synchronous delivery, Pinia, the `internal.js` fallback); record `args` as the rest array; `matchCardImageUrlCount` and `initialStateHash` in the bundle; compact JSON; the seed-exposure fact (Assumes 19); the App.vue template range.

Verified by the agent, end to end in a scratch folder:
- the engine `dist`, the real registry, `FEATURED_TABLE`, and the game copy on `Local()` against a `CreateGameReducer` reference: equal UIState JSON and `_stateID` after every step;
- 2 lobby moves plus 175 policy moves to gameover (scheme wins, turn 25), 0 rejected moves, about 0.5 s;
- 31 unique `matchCardImageUrls`; setup reads all 41 sets and 2,882 cards, about 4.3 MB as 2-space JSON and 0.50 MB at gzip 9;
- the same initial-state hash from the registry and from a JSON-round-tripped reader;
- that `LegendaryGame` is a plain object, and that `ProcessGameConfig` adds `plugins` to the copy only;
- the silent `null` state with the unmodified game;
- loading from a root script (engine and registry `dist`, `internal.js` via `createRequire`).

**Round 2: READY TO EXECUTE** once one line was locked:
- **PS-1:** a nullable lazy component fails typecheck in `components` (TS2769). Now registered through a conditional spread, with a failure smell. tsc and a Vite 5.4.21 build were both checked with that form.
- RS applied: AC 6's flagged-build wording; Vision §11 recoverability; `args: [<args>]` in Assumes 8.

**Copilot (01.7), independent subagent.**

**Round 1: RISK → HOLD**, eight findings, all scope-neutral:
- **Mode 30:** the governance sections were empty when it read them; they were filled in during the run.
- **Mode 4/27:** `FEATURED_TABLE` has nine fields, not eight. Scope D now passes `bundle.matchConfiguration`, and case 5 asserts the config and seed.
- **Mode 23:** `listCards()` follows `readdir` order, which differs between Windows and Linux. `cards` is now sorted by `key`, with a `// why:`.
- **Mode 17:** aliasing. `listCards()` returns a shallow copy, the record stores `structuredClone(args)`, `getRecord()` returns a copy, and new case 6 checks the bundle is unchanged after play.
- **Mode 21/25:** types and signatures. Locked `LocalSpikeSetupBundle` and `parseLocalSpikeSetupBundle` (no `as` cast; the `fixtures/replay/index.ts` precedent), `getState(): UIState | null`, `getRecord(): LocalSpikeRecord`, and a synchronous `string[]` replay. Case 3 reads `handle.getState()`.
- **Mode 19:** case 4 now replays a JSON round-tripped record.
- **Mode 5:** `playerCountSetup` is omitted when `null` (`exactOptionalPropertyTypes`).
- **Mode 22:** the page shows errors in its panel and never renders a blank board; failure smell added.

Verified by the agent: the export lines and the `CardRegistryReader` shape; `FEATURED_TABLE`'s nine fields; `localRegistry.ts`'s per-call `listCards` rebuild and `readdir` ordering; arena-client's `resolveJsonModule` and `exactOptionalPropertyTypes`; that a 1.4 MB JSON import type-checks in 0.19 s; the `client-app` code category for `src/fixtures/localSpike/`; and the `wiki/airplane-mode.md` anchors.

**Round 2: PASS.** Two cosmetic nits applied with no re-run: AC 4 now names cases 4 to 6, and the reader test names the members added in round 1. 01.0a Step 6 (the session prompt) applies when the execution session's prompt is written.
