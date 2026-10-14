# EC-846 — Hidden, unguessable match seeds (Execution Checklist)

**Source:** docs/ai/work-packets/WP-809-match-seed-entropy.md
**Layer:** Server

## Before Starting
- [ ] Baseline `origin/main` includes the reserve (#2777) and the WP-809 draft. `pnpm install`, `pnpm -r build` → 0; `pnpm --filter @legendary-arena/server test` → 1767 tests, 0 fail, 207 skipped.
- [ ] Re-read the anchors (all `~`):
  - boardgame.io `dist/cjs/server.js`:
    - seed: `Random.seed` `:~150`, random `setup` `:~271`, `IsProcessed` `:~1885`, `InitializeGame` `:~1977`, `createMetadata` `:~2025`, `createMatch` `:~2045`
    - sync: `onSync` `:~3544-3594`, filter `case 'sync'` `:~3707`, `TransportAPI.send` `:~3793`, socket `sync` `:~3905`
    - processing: `Master` ctor `:~3393`, `Server` `games.map` `:~3996`
  - `server.mjs` `:~97` (import), `:~791` (`Server({ games })`), `:~869` (guard call)
  - `botAllyRoutes.mjs` `:~63` / `:~888` / `:~1026`; `autoplay.mjs` `:~50` / `:~327`
  - `server.mjs.test.ts` `:~100-121` (the D-24701 pinned string)
  - `clientActionGuard.mjs` / `.test.ts` (the namespace-middleware and real-socket precedents)
- [ ] Confirm every server create path still loops back to the native create (`matchGate.routes.ts`, `autoplay.mjs`, `botAllyRoutes.mjs`, `guestSoloRoutes.mjs`), and that no `apps/arena-client/src` code reads `initialState` / `getInitialState`. A new hit → STOP and amend the WP + D-24715.

## Locked Values (do not re-derive)
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
- **Docs** (WP Locked Values verbatim):
  - `DESIGN-SEED-CHALLENGES.md` §3, §7(a), §8 item 1
  - `wiki/seed-challenges.md` `:~165-166` and `:~191`
  - `api-endpoints.md`: `create` and `playAgain` rows replaced whole with the one seed sentence, plus a footer line

## Guardrails
- No edit under `packages/game-engine/**` or any client; `LegendaryGame` gains no `seed`. No boardgame.io patch, bump or new dependency. `node:crypto` only.
- No route, status, body or auth change. The `GET` lobby routes still return `createdAt` / `setupData`.
- No `ProcessGameConfig(LegendaryGame)` left in non-test `apps/server/src`; remove the now-unused imports.
- Never create matches from a bare spread `{ ...serverLegendaryGame }`; it freezes one seed.
- Gate-safe prose: comments and JSDoc in non-test `apps/server/src` never spell the game-processing call with its parenthesis or the server-game spread. They cite D-24715 instead, because the Verification 5 greps are literal-string gates.
- The redaction drops only `initialState` from `sync` and never mutates the source object; every other event passes through. Tests assert the frame's exact key set `['filteredMetadata', 'log', 'state']`, not just the absence of `initialState`.
- `server.mjs.test.ts`: change only the D-24701 pinned string and title, and add the new `describe` (two tests). Its ordering assertions stay.
- Do not edit WP-808's files; D-24715 carries the supersession.
- Any server test failure beyond `server.mjs.test.ts` = STOP and diagnose (the scaffold observed none).

## Required `// why:` Comments
- The `createRequire` bridge (`/internal` is CJS-only).
- `MATCH_SEED_BYTE_LENGTH`: 128 bits; hex keeps an ASCII seed.
- `defineProperty`: no per-match hook in 0.50; `game.seed` is read once per `InitializeGame`; the getter must sit on the processed object; `enumerable`; the pinned override; the two-bundle duck-typed seam (WP Assumes 5).
- The emit wrap: `sync` is only sent through the requesting socket's `emit`, and the middleware runs before boardgame.io's `connection` listener.
- The `server.mjs` install call (D-24715).
- Both exposure-pin tests: they document boardgame.io behaviour and fail on an upgrade that changes it.

## Files to Produce
- `apps/server/src/game/matchSeed.mjs`, `matchSeed.test.ts`, `syncRedaction.mjs`, `syncRedaction.test.ts` — **new** (6 + 6 tests)
- `apps/server/src/server.mjs`, `bot-ally/botAllyRoutes.mjs`, `autoplay/autoplay.mjs` — **modified**
- `apps/server/src/server.mjs.test.ts` — **modified** (pinned string + new `describe`, two tests)
- `docs/ai/DESIGN-SEED-CHALLENGES.md`, `wiki/seed-challenges.md`, `docs/ai/REFERENCE/api-endpoints.md` — **modified**
- `docs/ai/DECISIONS.md` (D-24715), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-809-match-seed-entropy.md` — **governance close**

## After Completing
- [ ] `pnpm -r build` → 0; server suite → 1781 tests, 0 fail; `pnpm -r --no-bail test` → 0 fail.
- [ ] Revert proofs (a)–(d) per WP AC 8, each restored.
- [ ] `git grep -n --untracked "ProcessGameConfig(" -- apps/server/src ':!*.test.ts'` → exactly one hit (`game/matchSeed.mjs`); `git grep -n --untracked -F '...serverLegendaryGame' -- apps/server/src ':!*.test.ts'` → none. Allowlist-only diff; revert `lagn-v1.json` CRLF churn.
- [ ] D-24715 Active (every WP DoD clause). 01.6 post-mortem. STATUS. WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅`. `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-846:` then `SPEC:`) with a `Tests-changed:` trailer for `server.mjs.test.ts`.
- [ ] D-24026 live-verify after deploy (WP DoD steps 1–4):
  - one spectator match and one seated match
  - the seed query keyed on their match ids
  - no `initialState` in either `sync` frame, and on the seated match the board renders and a move commits

## Common Failure Smells
- **Seeds still timestamps in prod:** `Server()` got bare `LegendaryGame`, or the getter went on `LegendaryGame` (`ProcessGameConfig`'s spread froze it).
- **Two matches share a seed:** a create path spread `serverLegendaryGame` once and reused the copy.
- **Seed or decks still visible in DevTools:** `installSyncRedaction` was not installed, or was installed after `server.run`, or it wrapped `emit` on the namespace instead of the socket.
- **The client stalls after connect:** the redaction dropped or mangled `state` / `log`; only `initialState` may go.
- **Test 3 (seed) fails:** the object was re-processed or cloned before `Server()`; `IsProcessed` changed in a boardgame.io upgrade.
- **A socket test hangs:** a `Server` or socket was not closed in `after`, or a fixed port was used.
- **A replay or capture test fails:** something re-ran `InitializeGame` instead of using the persisted initial state; this packet must not touch replay.
