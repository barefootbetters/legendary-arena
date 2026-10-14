# WP-809 — Hidden, unguessable match seeds: the server mints each seed from crypto and stops sending it to clients (Server)

**Status:** Draft 2026-10-13
**Primary Layer:** Server (`apps/server`: two new modules, wiring in `server.mjs` and the bot-ally / autoplay routes)
**Dependencies:**
- WP-011 / WP-012 (the native boardgame.io lobby create and list routes)
- WP-308 / D-24094, WP-802 / D-24689 §2 (the native-lobby guard; every server create path loops back to the native create)
- WP-334 / WP-336, D-24119 (the faithful replay re-runs the **persisted** initial state, so the seed's source does not matter to it)
- D-24701 (the client action guard: the namespace-middleware precedent, installed on the same `Server()` games list)

**User-Visible Surface:** `play.legendary-arena.com`. Socket `sync` frames, visible in DevTools, no longer carry `initialState`, and new matches get crypto seeds. Boards, rules and timing are unchanged.
**Lane:** Standard (two-session). The surface is RNG and competitive integrity (lightweight-lane criterion 6), and it adds runtime wiring plus a framework seam (01.6 trigger).

> Baseline: `origin/main` at `927314ae` (includes #2777, the WP-809 / EC-846 / D-24715 reserve, and #2776, the WP-808 draft).

---

## Goal

**Today, two leaks let anyone foresee a live match's cards.**

1. **The seed is guessable.** `LegendaryGame` defines no `seed`, so boardgame.io 0.50.2 seeds every match with `Date.now().toString(36)`. The lobby API returns the match metadata to anyone, and its `createdAt` is stamped by `Date.now()` a fraction of a millisecond before the seed.
   - In the draft PoC, 296 of 300 created matches had a seed **equal** to `base36(createdAt)` and the other 4 were `+1 ms`.
   - The repo is public, so anyone can run `Game.setup` offline. From public metadata alone, the first guess reproduced each match's full initial `G` (villain deck, hero deck and HQ refills, every draw pile) in about 7 ms.
   - Even without `createdAt`, a ±60 s guess is about 120k candidates, roughly 15 single-core minutes.
2. **The seed is sent to clients.** boardgame.io answers every socket `sync` with `{ state, log, filteredMetadata, initialState }`. Its player-view filter redacts `state` and `log` but passes `initialState` through raw. Any socket that syncs, including a spectator with no credentials, receives `initialState.plugins.random.data.seed` and the unfiltered initial `G`. A player's own browser already holds both for their match.

**The harm:** a player in a scored match (PAR, Gauntlet, competition boards) can know every upcoming card. Replay verification proves every move was legal; it cannot detect foreknowledge.

**After this session:**
1. Every match any server path creates gets a 128-bit seed from `crypto.randomBytes`, minted fresh per match and unrelated to `createdAt`.
2. No outgoing `sync` frame carries `initialState`. Clients still receive the filtered `state`, `log` and metadata, and play is unchanged.
3. Determinism is unchanged. The seed is still persisted at `initialState.plugins.random.data.seed`, the faithful replay re-runs the persisted initial state, and a caller that pins a seed (`{ ...game, seed }`) still reproduces a board exactly.
4. The engine, the boardgame.io ^0.50 lock and every client are untouched.

## User-Visible Impact

Observable on `play.legendary-arena.com` in DevTools only: a match's `sync` frame no longer contains `initialState` (the seed and the initial `G`). No board, rule or timing change. Existing matches keep their stored seeds and replay as recorded.

---

## Assumes

1. **The default seed** (`boardgame.io@0.50.2`; the live server runs the copies bundled in `dist/cjs/server.js`, mirrored in the `plugin-random-*` / `initialize-*` / `master-*` chunks):
   - `Random.seed()` is `Date.now().toString(36).slice(-10)` (`server.js:~150`; `plugin-random-7425844d.js:~97-99`). At current epoch values base36 is 8 characters, so the slice is a no-op.
   - `RandomPlugin.setup` reads `game.seed` and falls back to `Random.seed()` (`server.js:~271`; `plugin-random:~218-223`).
   - Its `playerView` returns `undefined` (`server.js:~277`). That hides the seed from the `state` sent to clients, **not** from `initialState` (Assumes 2).
   - Plugin setup receives only `{ G, ctx, game }`. `InitializeGame` runs plugin `Setup` **before** `game.setup(…, setupData)` (`server.js:~1977-1995`; `initialize-648ccd94.js:~31-34`; `turn-order-4ab12333.js:~533-542`).
2. **The socket `sync` answer carries `initialState` raw:**
   - `Master.onSync` fetches `initialState: true` (`server.js:~3544-3551`). It checks credentials only when a `playerID` is given (`:~3556`), and sends `syncInfo = { state, log, filteredMetadata, initialState }` (`:~3589-3594`).
   - The filter's `case 'sync'` (`getFilterPlayerView`, `:~3707-3718`) returns `{ ...syncInfo, state: filteredState, log }`, so `initialState` passes through. The SocketIO `sync` handler admits spectators (`:~3905-3916`).
   - `sync` reaches the client only through `TransportAPI.send`, which calls `socket.emit(type, ...args)` on the requesting socket (`:~3793-3806`).
   - `update` and `patch` frames are built from filtered states only (`:~3684-3706`).
   - The bgio client only stores the synced `initialState` (`client-dde37916.js:~288-290`) for `getInitialState()` (`:~430`). No `apps/arena-client/src` code reads `initialState` or calls `getInitialState` / `reset` (non-test grep).
3. **The timestamp is public:**
   - `createMatch` calls `createMetadata` (`createdAt: Date.now()`, and `setupData` copied verbatim; `server.js:~2025-2034`) and then `InitializeGame` (`:~2045-2053`).
   - `createClientMatchData` strips only player credentials (`:~2109-2119`). `GET /games/:name` (listed matches, `:~2180-2225`) and `GET /games/:name/:id` (any match id, `:~2235-2245`) return it.
   - `nativeLobbyGuard.ts:~19-20, ~141-150` passes every GET through. Operator and guest-solo matches are created `unlisted` (`botAllyRoutes.mjs:~606-610`, `guestSoloRoutes.mjs:~120-124`); other matches are listed. The arena-client itself fetches the metadata (`lobby/lobbyApi.ts:~561`).
4. **One game object reaches every create:**
   - `Server()` re-processes its games with `games.map(ProcessGameConfig)` (`server.js:~3996`). `Master` does the same in its constructor (`:~3393`). Both return an already-processed game unchanged: `IsProcessed` is `game.processMove !== undefined` (`:~1885-1887`). Nothing clones or spreads the game object before `InitializeGame` reads `game.seed`.
   - Every server create path reaches the native `POST /games/legendary-arena/create` through a loopback: `matchGate.routes.ts:~325`, `autoplay.mjs:~354`, `botAllyRoutes.mjs:~611`, `guestSoloRoutes.mjs:~121`. `playAgain` (`server.js:~2344`) and the Master's on-demand create on sync (`:~3566`) use the same game object.
   - No other non-test `createMatch` / `InitializeGame` / `db.createMatch` call exists in `apps/server/src`.
   - `server.mjs:~791` passes `LegendaryGame` to `Server()`, and `:~869` passes it to `installClientActionGuard`, which reads only `game.name` (`game/clientActionGuard.mjs:~113-114`).
   - `botAllyRoutes.mjs:~888, ~1026` and `autoplay.mjs:~327` each build their own `ProcessGameConfig(LegendaryGame)` for move submission through `new Master(…)`.
5. **Two boardgame.io bundles, one duck-typed seam.** `ProcessGameConfig` from `boardgame.io/internal` (the chunk copy) produces `flow` / `processMove`, which `server.js`'s separately bundled reducer, Master and Flush drive. Bot-ally and autoplay already rely on this. The pre-flight ran the D-24701 real-socket turn on `serverLegendaryGame`: 10/10 green.
6. **Seed source is irrelevant to replay:**
   - `matchReplay.logic.ts:~206-236` re-runs the persisted `initialState + log` (a fresh `InitializeGame` would mint a new seed).
   - WP-808 (#2776) types the exported seed as `z.string().min(1)`. No code in `apps/` or `packages/` parses the seed's format.
   - D-24119's landmines name the seed location (`DECISIONS.md:~27247`).
7. **`LegendaryGame` defines no `seed`** (the only `seed` hits in `packages/game-engine/src/game.ts` are comments, `:~816, ~827, ~1006`).
8. **A source-shape wiring test pins the old call:** `server.mjs.test.ts:~100-121` asserts the literal `installClientActionGuard(server, [LegendaryGame]);`. It changes with the wiring (Scope C).
9. **Docs that state the old premise:**
   - `DESIGN-SEED-CHALLENGES.md`: §3 ("minted by boardgame.io as a `Date.now()` string"), §7(a) (custom plugin reading `setupData`) and §8 item 1 (custom plugin + create-proxy wiring).
   - `wiki/seed-challenges.md:~165-166` ("boardgame.io mints a `Date.now()` seed") and `:~191` ("the custom random plugin").
   - WP-808 (`:~325`, `:~464`) also says today's seed is `Date.now()`-derived. That is another packet's file, so it is not edited here; D-24715 records the supersession for WP-808's executor.
10. **Baseline:** `pnpm -r build` exits 0. `pnpm --filter @legendary-arena/server test` gives 1767 tests, 0 fail, 207 skipped (DB-gated).

If any item is false, this packet is **BLOCKED**; reconcile the WP and D-24715 first. Line anchors are `~` approximate; re-read at execution.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Server layer: wiring and process concerns), §Persistence Boundaries; `.claude/rules/architecture.md` §Server Layer, §Determinism; `.claude/skills/legendary-server/SKILL.md`.
- `docs/ai/DESIGN-SEED-CHALLENGES.md` §3, §7(a), §8; `wiki/seed-challenges.md` (corrected by this packet, Scope D).
- `docs/ai/DECISIONS.md`: D-24119 (replay from persisted initial state), D-24094 / D-24689 §2 (native create admission), D-24701 (client action guard). WP-808 / D-24714 (drafted, #2776): seeds are emitted only for completed matches.

**Draft PoC and scaffold (observed 2026-10-13; scratchpad, not committed):**
- **PoC.** It used bgio's own `createMatch` with the real `LegendaryGame`, the local registry and a 2-seat Core loadout.
  - 300 creates: seed − `createdAt` = 0 ms ×296 and 1 ms ×4.
  - Brute force from `createdAt + setupData` alone reproduced 6/6 victims' full `G` at δ = 0, about 7.4 ms per `Game.setup`.
- **Scaffold.** Pre-flight PS-1 independently probed the sync leak: a real `Server()` and a socket.io-client spectator with `playerID = null` received `initialState.plugins.random.data.seed` and the full initial `G`. The scaffold implemented the Locked Values below:
  - Server suite: 1767 → **1781 tests, 0 fail**, 207 skipped. The only existing-test edit was the D-24701 pinned string.
  - Revert proofs 4/4 (AC 8).

**Why a getter on the processed game (and the rejected alternatives):**
- **A static `seed` on `LegendaryGame`.** Every match would get the same seed. Rejected.
- **A getter on `LegendaryGame` itself.** `ProcessGameConfig` spreads the game (`{ ...game, flow, … }`), which reads the getter once and freezes one value. Rejected.
- **Koa middleware that sets `game.seed` per request.** `koaBody()` awaits between the middleware and `createMatch`, so concurrent creates race and can share a seed. Rejected.
- **`pnpm patch` of `Random.seed()`.** The same effect, but it patches vendored cjs and esm dist files and survives upgrades badly. Not taken.
- **Hiding or coarsening `createdAt`.** Not a fix: the blind ±60 s search still works. It would also break lobby display and D-24169. Rejected.
- **A custom random plugin** (the old DESIGN-SEED-CHALLENGES §7(a) plan). Engine work, and plugin `setup` cannot see `setupData` (Assumes 1), so §7(a) as written cannot work. Deferred to a seed-challenge WP.

**The getter wins.** It sits on the **processed** object that `Server()` and `Master` pass through unchanged. boardgame.io reads `game.seed` exactly once per `InitializeGame`, so every create gets a fresh value with no race and no framework patch.

**Why the redaction is in this packet, and why outbound.**
- Entropy alone leaves the seed one socket message away, so neither fix closes foreseeability without the other.
- boardgame.io gives no hook to filter `sync`'s extra fields; `game.playerView` sees only `state`.
- A namespace middleware that wraps the connecting socket's `emit` runs before boardgame.io's `connection` listener (the D-24701 precedent) and sees every `sync` answer, since `sync` is only ever sent to the requesting socket.
- Dropping the field (not blanking its contents) keeps the client's stored `initialState` `undefined`. Nothing in the arena-client reads it.

**Seed challenges (forward note, not built here).** A challenge needs a caller-chosen seed. With this packet, the clean seam is a server create path that calls `createMatch({ game: { ...serverLegendaryGame, seed: challengeSeed }, … })` and stores the result directly; the draft PoC confirmed an explicit seed still reproduces. A seed on `setupData` would be public, because `createMetadata` copies `setupData` into the metadata verbatim.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file: no diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.
- Moves and effects never throw. All in-game randomness goes through boardgame.io's seeded `random` (the `ctx.random` family). No `Math.random`, clocks or I/O in engine code.
- `G` stays JSON-serializable. Only `Game.setup()` may throw.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24715) before coding. One WP per session.

**Packet-specific:**
- **No engine change.** `packages/game-engine/**` is not edited; `LegendaryGame` gains no `seed`. `crypto` is used only in `apps/server` (server-layer process concern).
- **No boardgame.io change.** No `pnpm patch`, no version bump, no new dependency.
- **The seed seam.** `serverLegendaryGame = ProcessGameConfig(LegendaryGame)`, then `Object.defineProperty(serverLegendaryGame, 'seed', { get: mintMatchSeed, enumerable: true })`. Nothing else on the object changes.
- **One object everywhere.** `server.mjs` (`Server({ games })`, `installClientActionGuard`, `installSyncRedaction`), `botAllyRoutes.mjs` (both sites) and `autoplay.mjs` use `serverLegendaryGame`. No `ProcessGameConfig(LegendaryGame)` remains in non-test `apps/server/src`, and the now-unused `LegendaryGame` / `ProcessGameConfig` imports in those files are removed.
- **The redaction.** It only deletes `initialState` from the second argument of an outgoing `sync` event. It does not mutate the source object, and every other event passes through unchanged. It is installed after `Server({...})` and before `server.run(...)`.
- **No route, status, body or auth change.** The `GET` lobby routes still return `createdAt` and `setupData` (out of scope).
- **Gate-safe prose (00.3 §18).** Comments and JSDoc in non-test `apps/server/src` files never spell the boardgame.io game-processing call with its opening parenthesis, and never spell the spread of the server game object. Instead they cite D-24715 for the pinned-seed override and the bare-spread hazard. The two Verification 5 greps are literal-string gates.
- **01.5 not invoked.** `server.mjs` is in the allowlist by name.

## Locked Values

- **Seed module:** `apps/server/src/game/matchSeed.mjs`, exporting `mintMatchSeed()` and `serverLegendaryGame`.
- **Seed:** `randomBytes(MATCH_SEED_BYTE_LENGTH).toString('hex')` from `node:crypto`, `MATCH_SEED_BYTE_LENGTH = 16`, i.e. 32 lowercase hex characters (`/^[0-9a-f]{32}$/`).
- **Seam:** `Object.defineProperty(serverLegendaryGame, 'seed', { get: mintMatchSeed, enumerable: true })` on the object `ProcessGameConfig(LegendaryGame)` returns (`ProcessGameConfig` from `boardgame.io/internal` through `createRequire`, the autoplay / bot-ally bridge).
- **Pinned-seed override:** `{ ...serverLegendaryGame, seed: <string> }` reproduces a board exactly.
- **Redaction module:** `apps/server/src/game/syncRedaction.mjs`, exporting:
  - `redactOutgoingSyncArgs(eventName, eventArgs)`: for `eventName === 'sync'` with an object second argument, returns `[matchID, { ...syncInfo } minus initialState, ...rest]`; otherwise returns `eventArgs` itself.
  - `installSyncRedaction(gameServer, games)`: per game, `gameServer.app._io.of(game.name).use(...)` wraps `socket.emit` through `redactOutgoingSyncArgs`. It throws a full-sentence error when `app._io` is missing (the D-24701 shape).
- **Wiring strings** (asserted by `server.mjs.test.ts`):
  - `import { serverLegendaryGame } from './game/matchSeed.mjs';`
  - `import { installSyncRedaction } from './game/syncRedaction.mjs';`
  - `const server = Server({` followed by `games: [serverLegendaryGame]`
  - `installClientActionGuard(server, [serverLegendaryGame]);`
  - `installSyncRedaction(server, [serverLegendaryGame]);`
  - Bot-ally (2 sites) and autoplay (1 site): `const processedGame = serverLegendaryGame;`
- **Doc lines:**
  - **`DESIGN-SEED-CHALLENGES.md`:**
    - §3 "Seed": the server mints it with `crypto.randomBytes` per match and never sends it to clients (WP-809 / D-24715).
    - §7(a) is replaced by the "Seed challenges" forward note above: plugin `setup` never sees `setupData`; `setupData` is public metadata; the seam is `{ ...serverLegendaryGame, seed }` on a server create path that stores the match itself.
    - §8 item 1 becomes "Seed-injection plumbing: a server create path over `{ ...serverLegendaryGame, seed }`, plus surfacing the seed for verification".
  - **`wiki/seed-challenges.md`:**
    - `:~165-166` becomes "the server mints each match's seed from `crypto.randomBytes` and hides it; nothing yet lets a caller choose one".
    - `:~191` "the custom random plugin" becomes "a create path that pins the seed over the server's game object".
  - **`api-endpoints.md`:** the `POST /games/legendary-arena/create` and `/{matchID}/playAgain` rows, each replaced **whole** (D-11804). Each row's Notes gain one sentence: the stored match seed is minted server-side with `crypto.randomBytes` (WP-809 / D-24715), never from the clock. Request, response, Status and Auth are unchanged. Add a footer `*Last updated: WP-809 …*` line.

---

## Scope (In)

- **A) Seed module.** `apps/server/src/game/matchSeed.mjs` (new). It carries the Locked Values, a module JSDoc stating the exposure and D-24715, and `// why:` comments, including the two-bundle duck-typed seam (Assumes 5).
- **B) Redaction module.** `apps/server/src/game/syncRedaction.mjs` (new; the Locked Values and a module JSDoc citing the `sync` filter gap).
- **C) Wiring.**
  - `server.mjs`:
    - the two imports
    - `Server({ games: [serverLegendaryGame] })`
    - `installClientActionGuard(server, [serverLegendaryGame])`
    - `installSyncRedaction(server, [serverLegendaryGame])` right after the guard, with a `// why:` naming D-24715
    - drop the unused `LegendaryGame` import, keeping `setRegistryForSetup`
  - `bot-ally/botAllyRoutes.mjs` and `autoplay/autoplay.mjs`: `processedGame = serverLegendaryGame`, plus the import and unused-import cleanup.
- **D) Tests.**
  - `apps/server/src/game/matchSeed.test.ts` (new):
    1. **Exposure pin:** a stock `ProcessGameConfig({ ...LegendaryGame })` through `createMatch` yields a seed whose base36 value is `createdAt + 0..50 ms`.
    2. `mintMatchSeed()` returns `/^[0-9a-f]{32}$/` and differs across two calls.
    3. `ProcessGameConfig(serverLegendaryGame) === serverLegendaryGame`.
    4. Two `createMatch` calls on `serverLegendaryGame` store two different 32-hex seeds.
    5. `{ ...serverLegendaryGame, seed: 'pinned-seed-001' }` stores that seed, and two `InitializeGame` runs give deep-equal `G`.
    6. A real `Server({ games: [serverLegendaryGame] })` on port 0. Two `POST /games/legendary-arena/create` calls (`numPlayers: 1`, the empty-registry test `SETUP_DATA` of `clientActionGuard.test.ts`) store 32-hex seeds that differ from each other and from `createdAt.toString(36)`.
  - `apps/server/src/game/syncRedaction.test.ts` (new):
    1. `redactOutgoingSyncArgs` drops `initialState` and nothing else. The redacted frame's keys are exactly `['filteredMetadata', 'log', 'state']` (sorted), `redacted.log === syncInfo.log`, and the source object is unmutated.
    2. It returns any non-`sync` event's arguments unchanged (same reference).
    3. **Exposure pin:** with no redaction, a real-socket spectator `sync` (`playerID = null`) receives the stored match's pinned seed in `initialState`.
    4. Redacted spectator `sync`: the frame's keys are exactly `['filteredMetadata', 'log', 'state']` (sorted), `state` is present, `log` is an array, and the serialized frame contains no seed.
    5. Redacted seated `sync` (seat `'0'` + credentials): the same assertions.
    6. **Production wiring:** a `Server({ games: [serverLegendaryGame] })` with `installClientActionGuard` and `installSyncRedaction`, a seated sync with no seed, then `setPlayerReady` and `startMatchIfReady` sent as socket `MAKE_MOVE`s commit, and the match reaches `play`.
  - `apps/server/src/server.mjs.test.ts` (modified):
    - The D-24701 test's pinned string and title become `[serverLegendaryGame]`; its ordering assertions are unchanged.
    - A new `describe` with two tests: the `matchSeed.mjs` import plus `Server({ games: [serverLegendaryGame]`; and the `syncRedaction.mjs` import plus `installSyncRedaction(server, [serverLegendaryGame]);` after `Server({` and before `await server.run(`.
- **E) Docs.** `docs/ai/DESIGN-SEED-CHALLENGES.md` (§3, §7(a), §8 item 1), `wiki/seed-challenges.md` (two lines), `docs/ai/REFERENCE/api-endpoints.md` (two rows + footer), per Locked Values.

## Out of Scope

- **Hiding `createdAt` or `setupData` from the `GET` routes.** Not needed once the seed is unguessable and unsent. The arena-client and D-24169 consume them.
- **The engine and other harnesses.** The sim, PAR and fixture harnesses seed explicitly. The engine-runner, replay and WP-808 re-execution pin their own seeds. The arena-client never mints a server seed.
- **Existing matches.** Stored seeds stay as they are. After deploy, the redaction stops sending them, and a match live at deploy is guessable only through `createdAt` until it ends.
- **WP-808's text.** It is another packet's file. D-24715 tells WP-808's executor that its "`Date.now()`-derived" premise is superseded.
- **Seed challenges** (a caller-chosen, possibly commit-reveal seed). This is a future WP; Context records the seam.
- **The autoplay request field `seed`.** It seeds the bot policy's decisions, not the match. Its `String(Date.now())` default is unchanged.
- **`GET /games/legendary-arena` full-table scan** (`bgioPgStore.js:~448-456`). A separate papercut.

## Files Expected to Change

- `apps/server/src/game/matchSeed.mjs` — **new**
- `apps/server/src/game/matchSeed.test.ts` — **new** (six tests)
- `apps/server/src/game/syncRedaction.mjs` — **new**
- `apps/server/src/game/syncRedaction.test.ts` — **new** (six tests)
- `apps/server/src/server.mjs` — modified (wiring)
- `apps/server/src/bot-ally/botAllyRoutes.mjs` — modified (two sites + imports)
- `apps/server/src/autoplay/autoplay.mjs` — modified (one site + imports)
- `apps/server/src/server.mjs.test.ts` — modified (the D-24701 pin string, plus a new `describe` of two tests)
- `docs/ai/DESIGN-SEED-CHALLENGES.md` — modified (§3, §7(a), §8 item 1)
- `wiki/seed-challenges.md` — modified (two lines)
- `docs/ai/REFERENCE/api-endpoints.md` — modified (two rows, each replaced whole, + footer)
- Governance: `docs/ai/DECISIONS.md` (D-24715), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-809-match-seed-entropy.md`

That is 11 code, test and doc files plus 6 governance files. It is one layer (`apps/server`) plus docs. The split was considered and rejected: neither fix alone closes foreseeability (Context).

## Contract

- The Locked Values.
- `serverLegendaryGame` is the only processed `LegendaryGame` that `apps/server` hands to boardgame.io (`Server`, `Master`). A read of its `seed` returns a fresh 32-hex value.
- A caller that needs a specific seed spreads it with an explicit `seed`. A bare spread `{ ...serverLegendaryGame }` freezes one random value and must never be used to create more than one match.
- No outgoing socket `sync` frame carries `initialState`.

## Vision Alignment

**Vision clauses touched:** §3 (fair, verifiable randomness), §4 (multiplayer synchronization), §8 (determinism), §18 (spectation), §22 / §24 (replay-verified, ranked fairness), NG-1 (no pay-to-win; untouched).
**Conflict assertion:** none; every touched clause is preserved.
- §3: the seed stays persisted and replay-verifiable. It is withheld only from live clients, and WP-808 / D-24714 export it once a match completes.
- §4 / §18: `sync` still delivers the filtered state, log and metadata to seated players and spectators.
- A scored board can no longer be foreseen from public metadata or socket traffic.
**Non-Goal proximity:** not crossed. No purchase, cosmetic or account state touches the seed.
**Determinism:** unchanged. The seed is still persisted per match and replayed from storage; the PRNG, the engine and every hash oracle are untouched. Only the seed's source changes (clock → `crypto`), and one framework field stops being sent to clients.

## Funding Surface Gate

§20 **N/A** (no monetization surface).

## API Catalog

§21 **applies:** two rows (`POST /games/legendary-arena/create`, `POST /games/legendary-arena/{matchID}/playAgain`) are replaced whole, and a footer line is added (Scope E). Status, Auth and the request and response columns are unchanged. The socket `sync` frame is not an HTTP endpoint and is not catalogued.

---

## Acceptance Criteria

1. **Fresh seeds.** Every match created through `serverLegendaryGame` (direct `createMatch` and the real native create route) stores a seed matching `/^[0-9a-f]{32}$/`, and two creates never share one (seed tests 2, 4, 6).
2. **Unrelated to `createdAt`.** The native-route test asserts the stored seed ≠ `createdAt.toString(36)` (seed test 6).
3. **Seam survives the framework.** `ProcessGameConfig(serverLegendaryGame) === serverLegendaryGame` (seed test 3), and real socket moves commit through the production wiring (redaction test 6).
4. **Pinned seeds still reproduce.** `{ ...serverLegendaryGame, seed }` stores that seed and reproduces `G` exactly (seed test 5).
5. **No seed on the wire, nothing else lost.** Redacted spectator and seated `sync` frames carry exactly `filteredMetadata`, `log` and `state`, and no seed anywhere in the frame (redaction tests 1, 4, 5). A mutant that also drops `log` fails 3 tests (observed at draft).
6. **Exposures documented.** Both pins pass on 0.50.2: the clock seed (seed test 1) and the raw `initialState` on an unredacted sync (redaction test 3).
7. **Wiring.** `server.mjs.test.ts` asserts both imports, `Server({ games: [serverLegendaryGame]`, the D-24701 guard call, and the redaction call after `Server({` and before `server.run(`. In non-test `apps/server/src`, `ProcessGameConfig(` appears exactly once (`game/matchSeed.mjs`) and the fixed string `...serverLegendaryGame` appears nowhere (Verification 5).
8. **Revert proofs** (each restored afterwards; all four observed at draft):
   - (a) seed test 6 fails with `Server({ games: [LegendaryGame] })`
   - (b) the seed wiring test fails with `server.mjs` on `[LegendaryGame]`
   - (c) redaction tests 4–5 fail with the install skipped
   - (d) the redaction wiring test fails with the `installSyncRedaction` call removed from `server.mjs`
9. **Build and tests.** `pnpm -r build` → 0. The server suite goes 1767 → 1781 tests with 0 fail (the draft scaffold observed exactly this). `pnpm -r --no-bail test` → 0 fail. No engine or client file changes.

## Verification Steps

1. `pnpm -r build` → 0.
2. `pnpm --filter @legendary-arena/server test` → 1781 tests, 0 fail (207 skipped, DB-gated).
3. Revert proofs (AC 8), each restored afterwards.
4. `pnpm -r --no-bail test` → 0 fail.
5. `git grep -n --untracked "ProcessGameConfig(" -- apps/server/src ':!*.test.ts'` → exactly one hit (`game/matchSeed.mjs`). `git grep -n --untracked -F '...serverLegendaryGame' -- apps/server/src ':!*.test.ts'` → no hits (`--untracked` because the new files are not yet tracked before `git add`).
6. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn from the build.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24715 Active. It records:
  - both exposures: the clock seed against the public `createdAt` (PoC numbers, public repo) and the raw `initialState` in every `sync`, plus the scored-board harm
  - the getter-on-the-processed-game seam and why (no per-match hook in 0.50; a spread freezes the getter; middleware races; the two-bundle duck typing)
  - the outbound `sync` redaction and why outbound (`playerView` never sees `initialState`). It deletes one key from boardgame.io's outbound frame and never reads or interprets the match blob, so no D-24095 carve-out is needed.
  - the dev-only boardgame.io Debug panel's log rewind loses `getInitialState()` on multiplayer matches: expected, not a regression (production never mounts it)
  - the rejected alternatives (static seed, getter on `LegendaryGame`, middleware, `pnpm patch`, hiding `createdAt`, custom plugin, splitting the two fixes)
  - the one-object rule and the bare-spread hazard
  - replay and determinism unchanged (D-24119)
  - the §7(a) / §8 correction and the seed-challenge seam
  - matches live at deploy keep their clock seeds (no longer sent)
  - the supersession of WP-808's "`Date.now()`-derived" premise, with D-24714's completed-matches-only export as defense in depth
  - the API-catalog sentence covering both `create` and `playAgain`
- [ ] 01.6 post-mortem at `docs/ai/post-mortems/01.6-WP-809-match-seed-entropy.md` (new runtime wiring and extension seams).
- [ ] `docs/ai/STATUS.md`; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-846:` then `SPEC:`), with a `Tests-changed:` trailer for `server.mjs.test.ts`.
- [ ] **D-24026 live-verify (post-merge, after deploy):**
  1. Create two matches on `play.legendary-arena.com` after the deploy: one "Watch Bot Play" match (spectator) and one seated match (guest solo or create-with-bot). Note both match ids.
  2. Run a read-only prod query: `SELECT match_id, metadata->>'createdAt' AS created_at, initial_state->'plugins'->'random'->'data'->>'seed' AS seed FROM bgio.matches WHERE match_id IN ('<id1>', '<id2>');`, keyed on the step-1 ids because matches live before the deploy keep clock seeds by design. Both seeds are 32 hex characters and differ. This is an operator diagnostic read, not application code; no D-24095 carve-out is needed.
  3. In browser DevTools → Network → WS, the `sync` frame has no `initialState` on both the spectator match and the seated match. On the seated match the board renders and one move commits.
  4. Recorded as a STATUS flip.

## Reserved Decision (lands at execution)

**D-24715 — match-seed-entropy.** It locks everything listed in the DoD item above.

---

## Lint Gate Self-Review (00.3)

- **§1 Structure:** every required section is present and non-empty. Out of Scope names seven exclusions; there are 9 binary ACs.
- **§2 Constraints:** the engine-wide block is verbatim (full files, no diffs or snippets, ESM, Node v22+, 00.6). The session protocol, packet-specific constraints ("01.5 not invoked", gate-safe prose) and Locked Values are present.
- **§3 Assumes:** 10 items, each cited to file:line, including the boardgame.io 0.50.2 dist. Two independent pre-flight rounds re-verified them against source. A false item → BLOCKED.
- **§4 Context:** names the ARCHITECTURE sections (Layer Boundary, Persistence), `.claude/rules/architecture.md`, the server skill, DESIGN-SEED-CHALLENGES §3/§7(a)/§8, and D-24119 / D-24094 / D-24689 / D-24701 / D-24714. 00.2 is N/A: no card data, schema or `MatchSetupConfig` field is touched (the seed is a boardgame.io framework field).
- **§5 Output completeness:** 11 code, test and doc files plus 6 governance files, each marked new or modified. Above the ~8-file bound, with the reason stated (neither fix alone closes foreseeability). The one forced existing-test edit is in the allowlist.
- **§6 Naming:** `mintMatchSeed`, `serverLegendaryGame`, `MATCH_SEED_BYTE_LENGTH`, `redactOutgoingSyncArgs`, `installSyncRedaction`; full words. No 00.2 name is touched.
- **§7 Dependencies:** no new package, no boardgame.io bump or patch; `node:crypto` is a built-in. The test socket client resolves from boardgame.io's install (the `clientActionGuard.test.ts` precedent). Listed dependencies are Done.
- **§8 Architecture:** server layer only, with no engine edit and no route, auth or body change. The redaction deletes one key from an outbound framework frame and never reads the `bgio` blob, so no D-24095 carve-out is needed. The DoD's prod query is an operator read.
- **§9 Windows:** pnpm and git commands only; the pathspecs are single-quoted, so they work under pwsh.
- **§10 Env vars:** N/A.
- **§11 Auth:** N/A (auth posture unchanged).
- **§12 Tests:** `node:test`, `.test.ts`, no `boardgame.io/testing`. Real `Server()` instances on port 0 with no DB (the D-24701 precedent). Both exposure pins are present, and exact-keyset asserts kill a drop-`log` mutant (observed).
- **§13 Verification:** exact pnpm and git commands with counts (1767 + 6 + 6 + 2 = 1781). Both greps use `--untracked`; the spread gate is fixed-string (`-F`). Both were observed against the applied scaffold.
- **§14 ACs:** 9, binary and observable, each tied to a named test, string or count.
- **§15 DoD:** STATUS, DECISIONS (D-24715), the 01.6 post-mortem, WORK_INDEX, EC_INDEX, mindmap, allowlist-only diff, two-commit topology. **§15.1:** the surface is `play.legendary-arena.com`, and the DoD has a live check: new match ids, a seed query keyed on them, and DevTools `sync` frames on a spectator match and a seated match.
- **§16 Code style:** 00.6 is cited. The emit wrap is a framework-required socket.io middleware (the D-24701 shape). Errors are full sentences, and the `// why:` locations are enumerated in EC-846.
- **§17 Vision:** the block is present. It touches §3, §4, §8, §18, §22 / §24 and NG-1 with no conflict: the seed stays persisted and replay-verifiable, and is exported only for completed matches (D-24714). The determinism line is present.
- **§18 Prose-vs-grep:** both gates are literal-string and scan every non-test `apps/server/src` file, `matchSeed.mjs` included. The gate-safe-prose constraint makes the required `// why:` comments cite D-24715 instead of spelling a gated token.
- **§19 Bridge staleness:** the baseline `927314ae` is an ancestor of `origin/main` (verified 2026-10-13). The drafting commit re-checks it.
- **§20 Funding surface:** N/A.
- **§21 API catalog:** applies. The `create` and `playAgain` rows are replaced whole (D-11804); Status `Wired` and Auth `admin-session-required` are unchanged and inside the closed sets. A footer line is added.

**Verdict: PASS (21 / 21 resolved)** after lint rounds 1–2. Round 1 had four FAILs: §13 malformed grep, §18 gate-tripping prose, §15.1 surface line and §17 clause list. Round 2 had one: the §2 / §18 grep-exclusion contradiction, resolved by dropping the exclusion. All were text fixes with no scope change.

## Gate Record

**Pre-flight (01.4), round 1** (independent subagent, baseline `754f2e09`): **NOT READY**. Two blockers, both folded into this revision:
- **PS-1:** the socket `sync` answer carries the raw `initialState` (seed + initial `G`) to any socket, spectators included. Fixed by Scope B, the redaction tests and wiring, and Assumes 1 / 2.
- **PS-2:** seed docs outside the allowlist (`DESIGN-SEED-CHALLENGES.md` §8 item 1, `wiki/seed-challenges.md` two lines). Added to Scope E.

RS items applied:
- RS-1: rebased to `927314ae`.
- RS-2: the WP-808 supersession goes in D-24715.
- RS-3: the `playAgain` row and the footer.
- RS-4: guest-solo matches are unlisted.
- RS-5: the seed's Locked Value aligned.
- RS-6: a production-wiring move test and the two-bundle `// why:`.

Verified clean in round 1:
- Assumes 3–7, with nothing cloning the game before `InitializeGame`.
- The only create paths are the native loopbacks.
- Replay is untouched.
- The scaffold reproduced at 1767 → 1774 / 0 fail.

**Pre-flight (01.4), round 2** (same reviewer, baseline `927314ae`): **READY TO EXECUTE**, no PS items. Verified against source:
- **Redaction complete.** `sync` is sent only to the requesting socket; `sendAll` / pubsub carry only filtered `patch` / `update`, `matchData` and `chat`; no HTTP route returns raw state.
- **Client unaffected.** The client SYNC reducer uses only `state`. The arena-client never reads `initialState` or calls `reset`. boardgame.io mounts its Debug panel only in non-production builds (hence the DoD bullet).
- **Emit wrap composes.** socket.io 3.1.2's internal emits use `super.emit`, so the wrap sees only user-level emits. It composes with D-24701.
- **Scaffold re-run.** 1781 / 0 fail, revert proofs (c) and (d) observed, grep gate clean, governance checks 0. WP↔EC Locked Values consistent.

RS applied: RS-1 and RS-2 (D-24715 DoD clauses) and RS-3 (wording aligned). RS-4: Steps 6–7 follow.

**Copilot (01.7), round 1** (independent subagent): **RISK → HOLD**, four scope-neutral findings, all applied with no allowlist change:
1. **Test quality.** A mutant redaction that also dropped `log` / `filteredMetadata` passed every test. Redaction tests 1, 4 and 5 now assert the frame's exact key set and `log`; on the tightened scaffold the mutant fails 3 tests (observed).
2. **Grep gate.** It is now `ProcessGameConfig(` with exactly one hit, plus no `...serverLegendaryGame` spread (AC 7, Verification 5, EC).
3. **Live-verify.** Adds a seated match, and keys the seed query on the new match ids.
4. **EC Locked Values** are now a verbatim copy of the WP's.

Verified clean:
- the getter is justified, not clever code
- the redaction is consistent with D-24095 (no blob read)
- the combined scope is justified
- determinism and replay are untouched
- no hidden `seed` / `initialState` consumers

**Copilot (01.7), round 2:** **RISK → HOLD.** F1, F3 and F4 were confirmed, with the tightened scaffold re-run 6/6 and the mutant at 3 fail. New finding F5: the spread gate's pattern matched any reference, and a fixed-string search would hit the required pinned-override `// why:`. Applied, together with a drafter-found gap:
- Both gates now use `--untracked`, because `git grep` skips the new, still-untracked files before `git add`.
- The spread gate is now a fixed-string search (`-F`) that excludes `matchSeed.mjs`.
- On the applied scaffold, gate 1 has exactly one hit (`matchSeed.mjs:46`) and gate 2 has none (observed).

**Copilot (01.7), round 3: PASS, disposition CONFIRM** (2026-10-13). F5 was verified against the applied scaffold: gate 1 has one hit and gate 2 none. The text agrees across AC 7, Verification 5 and the EC. The WP and EC contain no control characters, the Locked Values are still byte-identical, and there are no new findings.

**Lint (00.3):**
- Round 1: FAIL (4), all applied.
- Round 2: FAIL (1). The gate-safe-prose rule contradicted the spread-gate exclusion; option A drops the exclusion.
- Round 3: **PASS (21 / 21)**.

**Copilot delta confirms** after each lint edit: **PASS / CONFIRM** unchanged. On the applied scaffold, gate 1 has one hit and gate 2 none, with no exclusion (observed).
