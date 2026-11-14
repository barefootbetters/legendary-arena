# EC-928 — Local match spike (Execution Checklist)

**Source:** docs/ai/work-packets/WP-890-local-match-spike.md
**Layer:** Cross-cutting (arena-client flag-gated dev route and client factory + root tooling `scripts/`)
**Risk Tier:** LOW — no production code path changes behaviour: the route, its chunk and the bundle fixture are compiled out unless the flag is set. No server, persistence, auth, money or engine surface is touched, and the spike's own code persists nothing.

## Before Starting
- [ ] Baseline `origin/main` includes #3313 (reserve) and the WP-890 draft SPEC.
- [ ] `pnpm install` → 0; `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client test` → 0 fail (record the count); `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
- [ ] Re-read WP §Assumes 4 and 7 in the installed bundle: `master-*.js` still creates an unknown match with `setupData: undefined`, and `Local()` still keys masters by game object. A different boardgame.io version means STOP.
- [ ] Anchors unchanged: `game.ts` `:110`, `:768-769`; `matchSetup.validate.ts` `:47`; `index.ts` `:2-3`, `:29-30`, `:375`, `:629-630`; `ai.legalMoves.ts` `:113-118`; `matchReplay.logic.ts` `:43`, `:73-74`, `:236`; `bgioClient.ts` `:33-74`, `:164-176`, `:487-499`; `BattleBrief.vue` `:155-171`; `App.vue` `:156-166`, `:187-230`, `:494-548`; `PlayViewport.vue` `:160`; `featuredTable.ts` `:19-32`; `vite.config.ts` `:136`.
- [ ] Scope lock: the target file set is exactly §Files to Produce; anything else needs an inline amendment (01.5).

## Locked Values (do not re-derive)

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

## Guardrails
- No engine, registry, server, card-data, `UIState`, `00.2`, `bgioClient.ts`, live-route or analytics change.
- Flag unset → no route, no chunk, no fixture in `dist/` (AC 6).
- The spike's own code persists nothing: no IndexedDB, Web Storage, Cache Storage or service worker.
- The engine's AI runs only in `localSpikeClient.test.ts`, never in the page.
- `validateSetupData` is bypassed only after `validateMatchSetup` passes; a failure throws before any client exists.
- The test's network stubs throw; never loosen them to get a pass.
- No existing assertion is edited to go green.
- Full-sentence errors; `try/catch` on every I/O call; `for...of`, no branching `.reduce()`.

## Required `// why:` Comments
- The game copy: boardgame.io 0.50.2 passes no `setupData` to a local match, and fails silently (WP §Assumes 4); `validateSetupData` is replaced only after `validateMatchSetup` passes.
- A fresh game object per client: `Local()` keys its master by game object (WP §Assumes 7).
- `setRegistryForSetup` in the browser: the module-level holder (`game.ts:96-112`); no other browser code reads it.
- The `Client` / `Local` / `internal.js` namespace-import fallback (the `bgioClient.ts` precedent).
- `resync` as a no-op: there is no server to re-anchor to.
- The `typeof` flag form: the bare form throws under tsx, and the `?.` form survives Vite's dead-code elimination (WP §Assumes 13).
- The recorder's inlined game copy: a root script can't import arena-client `.ts`; it mirrors `createLocalSpikeGame`.
- The recorder keeps the whole `listCards()` result and every set: setup reads them (WP §Context); trimming is slice 3's.
- The test's reference reducer: the D-24119 `CreateGameReducer` pattern, so equality means the local master behaves as the server's reducer does.
- Replay with `writesStores: false`: a replay must not move the live board.
- The sorted `cards`: `readdir` order differs between Windows and Linux, so `--check` would depend on the machine.

## Files to Produce
- `apps/arena-client/src/client/setupBundleReader.ts` + `.test.ts` — **new** — plain-data `CardRegistryReader`
- `apps/arena-client/src/client/localSpikeClient.ts` + `.test.ts` — **new** — game copy, local client, replay
- `apps/arena-client/src/lib/localSpikeRoute.ts` + `.test.ts` — **new** — route predicate
- `apps/arena-client/src/pages/LocalSpikePage.vue` — **new** — the flag-gated page
- `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` — **new** — generated by the recorder
- `scripts/build-local-spike-bundle.mjs` — **new** — the recorder
- `apps/arena-client/src/App.vue`, `App.test.ts`, `env.d.ts`, `.env.example` — **modified** — flag, route, lazy page, one test
- `package.json` — **modified** — `spike:local-bundle`
- `wiki/airplane-mode.md` — **modified** — WP Scope H
- `docs/ai/DECISIONS.md` (D-24842), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance close

## After Completing
- [ ] arena-client `test` and `typecheck` → 0 fail; every WP Scope G case present.
- [ ] `pnpm spike:local-bundle` lines recorded; `--check` → 0.
- [ ] Cases 3 (reference equality, gameover reached), 4 (record round-trip replay), 5 (hash, image count, config, seed) and 6 (no aliasing) pass; move count recorded.
- [ ] Default build: the AC 6 search finds nothing. Flagged build: every match is the spike chunk or its `.map`, and the spike chunk matches; spike chunk raw / gzip recorded.
- [ ] AC 7 done in Chrome: gameover or 20 turns, no Socket.IO, only the analytics `/api/` POST, replay matches, record downloads.
- [ ] `git grep -n "VITE_LOCAL_SPIKE"` → only the WP Verification step 7 files.
- [ ] `pnpm wiki:lint` → no finding on `airplane-mode.md`; `ledger:numbers:check` 0; allowlist-only `git diff --name-only`.
- [ ] D-24842 Active, covering every WP DoD bullet, including the "Engine Owns Truth" exception and "does not authorize a production device-hosted match". STATUS ("No user-observable change — infrastructure only (development-only spike behind `VITE_LOCAL_SPIKE`)" + measurements). WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `pnpm roadmap:counts:write` then `roadmap:counts:check` 0. Ledger LANDED. Two-commit topology: `EC-928:` → `SPEC:` close.

## Common Failure Smells
- The client's state stays `null` with no error → the game copy's `validateSetupData` wasn't replaced; `requestSync` drops the refusal silently (WP §Assumes 4).
- `LegendaryGame.setup() requires a MatchConfiguration argument` → `setup` wasn't closed over the config.
- An empty board with no error → `setRegistryForSetup` wasn't called, so setup fell back to the empty registry.
- New seed or replay shows the old, finished match → a game object was reused; `Local()` cached its master.
- The board jumps during **Replay record** → the replay client wrote the stores.
- `has no recorded answer for …` → the fixture is stale for this setup; re-run `pnpm spike:local-bundle`.
- Every App test fails on import → the flag used bare `import.meta.env.VITE_LOCAL_SPIKE` (undefined under tsx).
- The marker appears in a default build → the flag used `import.meta.env?.`, or something statically imports the fixture.
- The driver's first move is rejected → it skipped `setPlayerReady` / `startMatchIfReady`; `getLegalMoves` covers only the play phase.
- `Client is not a function` or `Local is undefined` under `node --test` → the namespace-import fallback was dropped.
- A test passes only with real network → a stub was loosened; restore it.
- The page shows a blank board → an error from setup or the bundle wasn't caught; the panel must show its message.
- `typecheck` TS2769 on `components` → `LocalSpikePage` was registered directly; use the conditional spread.
