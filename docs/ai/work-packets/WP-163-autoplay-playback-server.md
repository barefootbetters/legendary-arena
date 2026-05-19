# WP-163 — Autoplay Playback Controls (Server)

**Status:** Draft
**Primary Layer:** Server (apps/server)
**Dependencies:** None (parallel-safe with WP-164 until the client wires the endpoints; WP-164 hard-depends on this packet)
**EC:** [EC-180](../execution-checklists/EC-180-autoplay-playback-server.checklist.md)
**Baseline:** `origin/main` at time of execution
**Source invocation:** `session-autoplay-pause.md` (worktree `eloquent-wu-aba150`, 2026-05-19)

---

## Session Context

WP-118 locked the HTTP API Surface Catalog with D-11804 (whole-row replace; closed `Status`/`Auth` sets). This packet adds six new endpoints to `apps/server/src/autoplay/autoplay.mjs` and is the first WP to introduce a transient in-process playback buffer holding `structuredClone`'d copies of `G` and `ctx` — classified Class 1 Runtime State per `docs/ai/MOVE_LOG_FORMAT.md` (it is NOT a `MatchSnapshot`, NOT a `ReplayInput`, NOT a `LogEntry`).

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`.

**§17 N/A.** WP-163 is a server-side UX enhancement to the existing autoplay (bot-vs-bot) bot loop. None of the §17.1 trigger surfaces are touched:

- Not scoring / PAR / leaderboards (§20–26) — no scoring artifact produced or read.
- Not replays (§18) — explicitly disclaimed; the playback buffer is NOT a replay system, NOT a `ReplayInput`, NOT a `LogEntry`. See D-16306.
- Not identity / accounts (§3, §11) — no identity surface touched; new endpoints inherit `Auth: guest` from the existing `/api/match/autoplay` endpoint.
- Not multiplayer sync (§4) — autoplay is server-driven; no human-player synchronization is altered.
- Not determinism / RNG (§3, §8) — the playback buffer reads `G` and `ctx` via `structuredClone` (read-only); no `ctx.random.*` mutation, no `Math.random()`, no engine-state writes during rewind. The bot loop's existing determinism contract is preserved unchanged.
- Not card data, monetization, live ops, accessibility, or registry viewer.

**Determinism preservation:** Confirmed. Rewind operations never call `submitMove`, never mutate `G` or `ctx`, and never invoke `ctx.random.*`. The bot loop continues from its real position when the user resumes after a rewind (D-16301).

---

## Funding Surface Gate (§20)

**§20 N/A.** WP-163 adds six server-side REST endpoints that return JSON envelopes with no user-visible copy, no funding affordances, no donate / support references, and no monetization concepts. The endpoints are consumed by WP-164's spectator control bar (also funding-surface-free). None of the §20.1 trigger surfaces are touched.

---

## API Catalog Update Obligation (`00.3 §21` + D-11804)

**§21 FIRES.** WP-163 adds six new HTTP endpoints to `apps/server`. Per D-11804, `docs/ai/REFERENCE/api-endpoints.md` MUST be updated in the same commit with six new whole rows. Required column values are locked:

- `Status: Wired` (closed set per D-11804).
- `Auth: guest` (closed set per D-9905; inherits posture from `/api/match/autoplay`).
- `Authorizing WP: WP-163`.
- Request/response schema field names are local to the playback envelope (`ok`, `paused`, `historyLength`, `cursor`, `uiState?`, `error?` — D-16304); no canonical-name collision with `00.2-data-requirements.md`.

See `## Files Expected to Change` for the catalog file entry; see `## Acceptance Criteria — API Catalog (D-11804)` for the binary checks.

---

## Goal

After this packet, `apps/server` exposes six REST endpoints driving media-player-style playback over the existing autoplay bot loop: `POST /api/match/:matchId/autoplay/{pause,resume,step-forward,step-back,restart,go-to-end}`. A per-match `PlaybackController` (held in a module-level `Map<string, PlaybackController>`) gates the bot loop via an `await waitIfPaused()` call between moves, maintains a cursor-based history of up to 100 state snapshots, and serves rewind responses inline via REST (no Socket.IO broadcast for rewind actions). The controller is created on autoplay match start and destroyed on match completion, error, or max-turn exit. No boardgame.io state is mutated by rewind operations; step-back and restart are visual-only.

---

## Assumes

- `apps/server/src/autoplay/autoplay.mjs` exists with `registerAutoplayRoutes()` and `runBotMatch()` (verified at current head).
- `@legendary-arena/game-engine` exports `buildUIState` and `filterUIStateForAudience` (already imported in `autoplay.mjs:21-22`).
- `koa-body` is loaded via `createRequire` and applied **per-route** (verified at `autoplay.mjs:30,62`). The new bodyless POSTs do NOT need `koaBody()`.
- `pnpm -r build` and `pnpm -r test` exit 0 against `main`.
- `docs/ai/REFERENCE/api-endpoints.md` exists and uses the D-11804 row format.
- `docs/ai/DECISIONS.md` exists.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — server is wiring only.
- `docs/ai/ARCHITECTURE.md §Persistence Boundaries` — playback buffer is runtime-only.
- `docs/ai/MOVE_LOG_FORMAT.md §Known Gaps #1, §Three Canonical Artifacts` — why the buffer is none of `LogEntry` / `ReplayInput` / `MatchSnapshot`.
- `.claude/rules/architecture.md` — Server Layer section.
- `.claude/skills/legendary-server/SKILL.md` — server enforcement rules.
- `.claude/skills/legendary-persistence/SKILL.md` — Class 1 Runtime State rules.
- `.claude/rules/work-packets.md §API Catalog Update Obligation (D-11804)` — whole-row replace, closed sets.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6 (`// why:`), Rule 9 (`node:` prefix), Rule 11 (full-sentence errors), Rule 13 (ESM-only).
- `apps/server/src/autoplay/autoplay.mjs` — current bot-loop implementation.
- `docs/ai/REFERENCE/api-endpoints.md` — row format and closed sets for the catalog update.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- ESM only, Node v22+
- `node:` prefix on Node built-ins
- Full file contents for every new or modified file — no diffs, no snippets
- Human-style code per `00.6-code-style.md`
- No `Math.random()`; no DB/network/filesystem inside helpers

**Packet-specific (locked design decisions — pinned via D-16301..D-16309):**
- Server is the ONLY source of truth for match progression (D-16301).
- Step-back and restart are CLIENT-SIDE visual rewinds only — no rollback of boardgame.io state (D-16301).
- **Cursor ↔ live-state reconciliation (D-16301, enforcement point locked):** the cursor is reset to `stateHistory.length - 1` inside `pushState()`. Because `pushState()` is invoked by the bot loop immediately before every `submitMove`, every real move boundary forces the cursor back to latest. Implicit "rewind mode" is discarded by the same write. Subsequent `step-back` calls therefore start from the new latest position. **There is exactly one mechanism for cursor reset: `pushState()` writing the new entry. No endpoint and no caller mutates the cursor directly.**
- History is **cursor-based**, not pop-based: `stateHistory: PlaybackStateSnapshot[]`, `cursor: number`, `maxHistory = 100` (D-16302).
- Step-back never destroys history — it only moves the cursor (D-16302).
- Step-forward executes a real bot move ONLY when `cursor === stateHistory.length - 1`; otherwise it advances the cursor only (D-16302).
- **`stepForward()` returns a discriminated union (D-16302) — closed-set, exhaustive:**
  ```ts
  type StepForwardResult =
    | { type: 'cursor'; snapshot: PlaybackStateSnapshot }
    | { type: 'live-move' };
  ```
  Endpoint handler maps the result to the response: `type === 'cursor'` → include `uiState`, set `mode: 'rewind'` or `'live'` per cursor position; `type === 'live-move'` → omit `uiState`, set `mode: 'live'`. The `live-move` branch does NOT itself submit the move — it signals the bot loop (already awaiting `waitIfPaused()`) to advance exactly one step.
- Rewind delivery: step-back and restart MUST return `uiState` in the REST response body. Do NOT use `transport.pubSub` for rewind (D-16303).
- Standardized response envelope (D-16304):
  ```ts
  type AutoplayControlResponse = {
    ok: boolean;
    paused: boolean;
    historyLength: number;
    cursor: number;
    mode: 'live' | 'rewind';
    uiState?: UIState;
    error?: string;
  };
  ```
  `mode` is computed as `cursor === stateHistory.length - 1 ? 'live' : 'rewind'` — present on EVERY response (200 and error), regardless of whether `uiState` is included. Eliminates the client's need to compute the same predicate.
- Endpoint Behavior Matrix (D-16304 — verbatim, do not paraphrase):

  | Endpoint       | Returns `uiState` | `mode` after success |
  |----------------|-------------------|----------------------|
  | `pause`        | No                | unchanged from prior |
  | `resume`       | No                | `'live'` (cursor forced to latest) |
  | `step-forward` | Conditional (YES on cursor move, NO on real move) | derived from cursor |
  | `step-back`    | Yes               | `'rewind'` (cursor < latest) |
  | `restart`      | Yes               | `'rewind'` (cursor = 0, latest > 0) |
  | `go-to-end`    | No                | `'live'` |

- Snapshot shape (D-16305 — strict):
  ```ts
  type PlaybackStateSnapshot = {
    G: any;
    ctx: { phase: string; turn: number; currentPlayer: string };
  };
  ```
  Snapshots MUST use `structuredClone`, MUST include only the fields above, MUST be treated as **immutable** after creation (never reassigned-into, never deep-mutated), and MUST NEVER be persisted to DB / Redis / files / logs (D-16306; Class 1 Runtime State per `.claude/skills/legendary-persistence/SKILL.md`).
- **Audience filtering on rewind responses (D-16303):** `uiState` returned by `step-back`, `restart`, and the cursor-branch of `step-forward` MUST be produced via `filterUIStateForAudience(buildUIState(snapshot.G, syntheticCtx), audience)`. The `audience` matches whatever the spectator's existing Socket.IO connection uses (spectator audience for all-bot autoplay; verify against the existing `submitMove` broadcast pattern in `autoplay.mjs` before writing). Skipping the filter is a hidden-information leak.
- Pause is race-safe via a single `resumeResolver` promise; `stepMode` flips `isPaused` back to true after exactly one move (D-16307).
- **Controller concurrency: single-consumer (D-16309).** Only one `waitIfPaused()` promise may be in-flight at a time. Concurrent HTTP requests touching the same controller (e.g., a rapid pause→stepForward→resume burst from a flaky network) follow last-write-wins semantics: the most recent state-mutating call overwrites the prior intent. No mutex, no queue. `goToEnd()` while paused cancels any pending step-mode behavior; `pause()` cancels `playbackDelayOverride`.
- Controller lifecycle (D-16308): created at autoplay match start, destroyed on match completion / error / max-turn exit. Failure to clean up the `Map` entry is a memory leak.
- **Initial snapshot requirement (D-16302 corollary):** the bot loop MUST call `controller.pushState(...)` once immediately after match initialization (before the first delay / `waitIfPaused()` gate), so that `historyLength === 1, cursor === 0` is reachable before any pause can occur. The final move's snapshot is NOT pushed after submission — the final state arrives at the client via the normal `submitMove` broadcast path.
- API Catalog (D-11804): every new endpoint adds a whole row to `docs/ai/REFERENCE/api-endpoints.md` in the same commit. `Status: Wired`. `Auth: guest` (consistent with existing `/api/match/autoplay`).
- **HTTP status rules (locked):**
  - `200` — success; envelope `ok: true`, `error` omitted.
  - `404` — controller not found for `matchId`; envelope `ok: false`, `error: "<sentence>"`.
  - `409` — invalid state transition; envelope `ok: false`, `error: "<sentence>"`. Triggers: (a) step-forward / step-back / restart while not paused; (b) step-back at `cursor === 0`; (c) restart when `historyLength < 1` (unreachable if initial-snapshot rule holds, but defended); (d) any state-machine precondition failure.
  - `500` — unexpected error; envelope `ok: false`, `error: "<sentence>"` — envelope MUST still be returned (no bare error strings).

**Session protocol:**
- If any locked design decision above conflicts with `ARCHITECTURE.md` or `.claude/rules/*.md`, stop and ask — the higher-authority document wins.

---

## Scope (In)

### A) PlaybackController factory (new file)
- `apps/server/src/autoplay/playbackController.mjs` — **new**:
  - `createPlaybackController()` returns an object exposing:
    - `isPaused: boolean` — read-only state flag.
    - `getCursor(): number` — explicit getter (NOT a property accessor; prevents accidental mutation assumptions).
    - `getHistoryLength(): number` — explicit getter.
    - `getMode(): 'live' | 'rewind'` — derives from cursor / history length; centralizes the predicate so endpoint handlers never recompute it.
    - `pause(): void`, `resume(): void`, `goToEnd(): void`.
    - `stepForward(): StepForwardResult` — returns the discriminated union locked in §Non-Negotiable Constraints.
    - `stepBack(): PlaybackStateSnapshot | null` — null when `cursor === 0` (endpoint maps null → 409).
    - `restart(): PlaybackStateSnapshot | null` — null when `historyLength === 0` (defensive; the initial-snapshot rule prevents this in practice).
    - `waitIfPaused(): Promise<void>`.
    - `pushState(snapshot: PlaybackStateSnapshot): void` — appends, enforces `maxHistory = 100` shift-out, sets `cursor = stateHistory.length - 1`. This write IS the cursor-reconciliation mechanism (D-16301).
    - `getAtCursor(): PlaybackStateSnapshot | null`.
    - `getPlaybackDelayOverride(): number | null` — renamed from `getDelayOverride` to avoid confusion with engine / bot-loop delay semantics.
  - Internal state: `stateHistory`, `cursor`, `resumeResolver`, `stepMode`, `playbackDelayOverride`.
  - `// why:` on `waitIfPaused` explaining the `resumeResolver` race-safety pattern + single-consumer invariant (D-16309).
  - `// why:` on `pushState` explaining the 100-snapshot cap (D-16302) **and** that this write is the only cursor-reconciliation site (D-16301).
  - `// why:` on `stepForward` explaining the discriminated-union return and why the `'live-move'` branch does NOT itself call `submitMove`.

### B) Endpoint wiring + controller map (modify)
- `apps/server/src/autoplay/autoplay.mjs` — **modified**:
  - Module-level `autoplayControllers = new Map()`.
  - `registerAutoplayRoutes` registers six new endpoints listed in §Goal — registered WITHOUT `koaBody()` since they accept no body.
  - Helper `getController(koaContext)` returns the controller or sets 404 + error envelope `{ ok: false, paused: false, historyLength: 0, cursor: -1, mode: 'live', error: 'No active autoplay controller for this matchId.' }`.
  - Helper `buildResponse(controller, options): AutoplayControlResponse` centralizes envelope construction — pulls `paused`, `getHistoryLength()`, `getCursor()`, `getMode()` from the controller and merges in `uiState`/`error` from `options`. Endpoint handlers never construct the envelope inline.
  - All six handlers return the standardized `AutoplayControlResponse` envelope, including `mode` on every response (200 and error).
  - `step-back` and `restart`: build `uiState` via `filterUIStateForAudience(buildUIState(snapshot.G, { phase, turn, currentPlayer }), audience)` (D-16303). Audience matches the existing spectator broadcast pattern in `autoplay.mjs` — verify against the current `submitMove` call site before writing.
  - `step-forward`: switch on `StepForwardResult.type` — `'cursor'` branch returns filtered `uiState`; `'live-move'` branch omits `uiState` (the bot loop, already awaiting `waitIfPaused()`, will produce and broadcast the real state).
  - `runBotMatch` receives the controller and:
    - **Initial snapshot:** calls `controller.pushState({ G: structuredClone(state.G), ctx: { phase, turn, currentPlayer } })` ONCE immediately after match initialization, before entering the move loop. `// why:` comment cites the D-16302 corollary (historyLength must be ≥ 1 before any pause can occur, so step-back / restart never see an empty buffer).
    - **Per-move snapshot:** calls `controller.pushState(...)` BEFORE each subsequent `submitMove`. This is the cursor-reconciliation site per D-16301 — the act of writing a new entry forces `cursor = stateHistory.length - 1`, discarding any rewind state.
    - **Delay override:** replaces `await delay(delayMs)` with `await delay(controller.getPlaybackDelayOverride() ?? delayMs)`.
    - **Wait gate:** calls `await controller.waitIfPaused()` after each delay.
    - **No final-state push:** does NOT call `pushState` after the last `submitMove`; the final state arrives at the client via the normal `submitMove` broadcast path.
  - On `runBotMatch` exit (game over / max-turn / error / catch), deletes the controller from the map. `// why:` on cleanup explaining memory leak risk (D-16308).

### C) API Catalog rows (modify)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified**: six new rows (one per endpoint). Per D-11804 replace-whole-row semantics. `Status: Wired`. `Auth: guest`. Request/response schemas reference the standardized envelope.

### D) Tests
- `apps/server/src/autoplay/playbackController.test.mjs` — **new** — `node:test`. State-machine and lifecycle coverage:
  - `pause()` sets `isPaused = true`; `waitIfPaused()` blocks until `resume()`.
  - `pushState` past `maxHistory` shifts the oldest entry; `cursor` stays at latest.
  - **Cursor-reset on real move (D-16301):** after a `stepBack`, the next `pushState` resets `cursor` to `stateHistory.length - 1`. `getMode()` reads `'rewind'` before the push and `'live'` after.
  - **Cursor boundary:** `stepBack` at `cursor === 0` returns `null`; `stateHistory` is not mutated.
  - `stepForward` at `cursor < latest` returns `{ type: 'cursor', snapshot }` and advances cursor only.
  - `stepForward` at `cursor === latest && isPaused` returns `{ type: 'live-move' }` and does NOT mutate `stateHistory`.
  - **Race-edge (D-16307 / D-16309):** `pause()` → `stepForward()` → `resume()` in rapid succession resolves cleanly and does not advance the bot loop twice (verified by counting awaited `waitIfPaused()` releases).
  - **Fast-forward interrupt (D-16307):** `goToEnd()` sets `playbackDelayOverride = 10`; a subsequent `pause()` clears it back to `null`.
  - `restart` sets cursor to 0; returns first snapshot.
  - **Initial-snapshot rule (D-16302 corollary):** `restart()` called on a freshly-created controller with one `pushState` returns the only snapshot and sets `cursor = 0`.
  - **`getMode()` predicate:** `'live'` iff `cursor === historyLength - 1`; `'rewind'` otherwise; never undefined.
  - **Snapshot immutability (D-16305):** the snapshot returned by `getAtCursor()` is reference-equal to what `pushState` stored (no defensive clone in the read path); deep-freeze check on the stored snapshot confirms no mutation has occurred.
  - **Audience filter applied:** mock `filterUIStateForAudience` and assert it was called for the rewind responses but NOT for `pause` / `resume` / `go-to-end`.
  - Drift test: `AutoplayControlResponse` keys are exactly `{ ok, paused, historyLength, cursor, mode, uiState?, error? }` (D-16304).
  - Drift test: `StepForwardResult.type` values are exactly `{ 'cursor', 'live-move' }` (D-16302).
  - Drift test: `PlaybackStateSnapshot.ctx` keys are exactly `{ phase, turn, currentPlayer }` (D-16305).
  - **Lifecycle leak test (D-16308):** run N=10 autoplay matches sequentially (each create-controller / push-many-states / cleanup); assert `autoplayControllers.size === 0` at end. A simple in-test simulator (not the full bot loop) is acceptable for this — the test isolates cleanup, not match execution.

---

## Out of Scope

- Client UI — separate WP (`WP-164-client`).
- Persistence of any kind for the playback buffer — see D-16306 / Class 1 Runtime State.
- Replay system integration (`replayGame()`) — see invocation §Non-Goals.
- Seed-accurate rewind — out of scope; see MOVE_LOG_FORMAT.md Gap #4.
- Timeline scrubber, diff-based compression, persisted replay — see invocation §Future Considerations.
- Modifying `packages/game-engine` — except for type-only imports of `UIState` if needed.
- Refactoring `runBotMatch` beyond the three insertion points listed in Scope §B.

---

## Files Expected to Change

- `apps/server/src/autoplay/playbackController.mjs` — **new** — factory + state machine + history cursor.
- `apps/server/src/autoplay/playbackController.test.mjs` — **new** — `node:test` coverage.
- `apps/server/src/autoplay/autoplay.mjs` — **modified** — controller map, 6 endpoints, bot-loop integration, cleanup.
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — 6 new rows (D-11804 whole-row).
- `docs/ai/DECISIONS.md` — **modified** — D-16301 through D-16308.
- `docs/ai/STATUS.md` — **modified** — note what autoplay can do after this packet.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — add WP-163 row + EC-180 cross-ref.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — add EC-180 row.

No other files may be modified.

---

## Acceptance Criteria

### Controller
- [ ] `playbackController.mjs` exports `createPlaybackController()` with exactly the methods listed in Scope §A — including `getCursor()`, `getHistoryLength()`, `getMode()`, `getPlaybackDelayOverride()` (renamed from prior draft's `cursor` getter / `getDelayOverride`).
- [ ] `stepForward()` returns a `StepForwardResult` discriminated union (`{ type: 'cursor', snapshot }` or `{ type: 'live-move' }`); the `'live-move'` branch does NOT call `submitMove` directly.
- [ ] No `Math.random()` in `playbackController.mjs` (confirmed with `Select-String`).
- [ ] No `boardgame.io` import in `playbackController.mjs` (pure helper).
- [ ] `pushState` enforces `maxHistory = 100` exactly.
- [ ] `pushState` is the ONLY mechanism that mutates `cursor` to `stateHistory.length - 1` (D-16301). No endpoint or external caller writes `cursor` directly.
- [ ] `cursor` is never negative after the first `pushState`; `getCursor()` returns `-1` only on a freshly-constructed controller with zero pushes.
- [ ] Snapshots returned by `getAtCursor()` are not deep-mutated by the controller after `pushState` (D-16305 immutability rule).

### Endpoints
- [ ] All six endpoints return the standardized envelope shape **including `mode`** on every response (200 and error).
- [ ] `step-back` and `restart` include `uiState`; `pause`, `resume`, `go-to-end` do NOT.
- [ ] `step-forward` includes `uiState` IFF the result was `{ type: 'cursor' }`; omits it on `{ type: 'live-move' }`.
- [ ] `uiState` is produced via `filterUIStateForAudience(buildUIState(G, ctx), audience)` — never via raw `buildUIState` alone (D-16303).
- [ ] HTTP status codes follow the locked rules: `200` success, `404` controller-not-found, `409` invalid state transition (including step-back at `cursor === 0`), `500` unexpected — every non-200 response still carries the envelope (no bare error strings).
- [ ] New endpoints are registered without `koaBody()` (verified by reading the registration block).

### Bot loop
- [ ] `controller.pushState(...)` is called ONCE immediately after match initialization (initial snapshot), BEFORE the first `waitIfPaused()` gate.
- [ ] `controller.pushState(...)` is called exactly once per subsequent move boundary, BEFORE `submitMove`.
- [ ] `controller.pushState(...)` is NOT called after the final `submitMove`.
- [ ] `await delay(controller.getPlaybackDelayOverride() ?? delayMs)` replaces every prior bare `await delay(delayMs)`.
- [ ] `await controller.waitIfPaused()` is called after every delay.
- [ ] Controller is removed from the `Map` on every exit path (success, max-turn, error).

### API Catalog (D-11804)
- [ ] `api-endpoints.md` has 6 new rows in the same commit.
- [ ] `Status` is one of `{ Wired, Shipped-but-unwired, Library-only, Pending }`.
- [ ] `Auth` is one of `{ guest, handle-required, authenticated-session-required }`.
- [ ] Request/response field names match `00.2-data-requirements.md` (none of the new endpoints reuse those names; envelope is local).

### Tests
- [ ] `pnpm --filter @legendary-arena/server test` exits 0.
- [ ] Drift tests for `AutoplayControlResponse` keys (including `mode`), `StepForwardResult.type` values, and `PlaybackStateSnapshot.ctx` keys all pass.
- [ ] Race-edge test (`pause` → `stepForward` → `resume`) confirms no double-advance of the bot loop.
- [ ] Cursor-boundary test (`stepBack` at `cursor === 0`) confirms history is unmutated and result is `null`.
- [ ] Fast-forward interrupt test (`goToEnd` → `pause`) confirms `playbackDelayOverride` resets to `null`.
- [ ] Lifecycle leak test runs N=10 sequential matches and asserts `autoplayControllers.size === 0` at end.

### Scope enforcement
- [ ] `git diff --name-only` matches §Files Expected to Change exactly.

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm -r build
# Expected: exits 0

# Step 2 — server tests
pnpm --filter @legendary-arena/server test
# Expected: TAP — all passing

# Step 3 — no Math.random in playback controller
Select-String -Path "apps\server\src\autoplay\playbackController.mjs" -Pattern "Math\.random"
# Expected: no output

# Step 4 — no boardgame.io import in playback controller
Select-String -Path "apps\server\src\autoplay\playbackController.mjs" -Pattern "boardgame\.io"
# Expected: no output

# Step 5 — exactly six unique route registrations (router.post-scoped)
Select-String -Path "apps\server\src\autoplay\autoplay.mjs" -Pattern "router\.post\(.*/api/match/:matchId/autoplay/"
# Expected: exactly 6 matches — one router.post per endpoint, no comment / docstring hits, no duplicates

# Step 6 — controller cleanup present
Select-String -Path "apps\server\src\autoplay\autoplay.mjs" -Pattern "autoplayControllers\.delete"
# Expected: at least 1 match (cleanup on exit)

# Step 7 — api-endpoints.md has 6 new rows
Select-String -Path "docs\ai\REFERENCE\api-endpoints.md" -Pattern "autoplay/(pause|resume|step-forward|step-back|restart|go-to-end)"
# Expected: 6 matches

# Step 8 — scope enforcement
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter @legendary-arena/server test` exits 0.
- [ ] Pause freezes the bot loop deterministically (no extra moves slip through after the pause request returns).
- [ ] Resume continues without drift (no double-move, no state corruption).
- [ ] Step-back does NOT destroy history (cursor-only navigation).
- [ ] Restart returns the earliest saved snapshot.
- [ ] Step-forward executes exactly one real move when at history latest and paused; otherwise advances cursor only.
- [ ] Go-to-end runs to completion at `delayOverride = 10` ms.
- [ ] No mutation of boardgame.io state during rewind operations.
- [ ] No persistence path introduced for the playback buffer.
- [ ] Controller cleaned up on every exit path — verified by inspecting `Map.size` in a teardown test.
- [ ] `docs/ai/STATUS.md` updated — note that autoplay now supports playback controls.
- [ ] `docs/ai/DECISIONS.md` has D-16301 through D-16309 appended (D-16304 reflects the augmented envelope with `mode`; D-16309 locks the single-consumer concurrency model).
- [ ] `docs/ai/REFERENCE/api-endpoints.md` has 6 new rows (D-11804 whole-row replace).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-163 checked off with today's date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-180 marked complete.

---

## Lint Gate Self-Review

> Per `01.0a §Step 5` and `00.3-prompt-lint-checklist.md`. All 21 sections walked. PASS or explicit N/A with justification — bare N/A is FAIL per 00.3.

| § | Title | Verdict | Note |
|---|---|---|---|
| 1 | Work Packet Structure | PASS | All 10 required sections present in order |
| 2 | Non-Negotiable Constraints Block | PASS | Engine-wide + packet-specific + session protocol + locked values; full-file-contents rule present; 00.6 referenced |
| 3 | Prerequisites (Assumes) | PASS | Verified states: Pinia setter at `uiState.ts:35`, koa-body per-route at `autoplay.mjs:30,62` |
| 4 | Context References | PASS | ARCHITECTURE.md §Layer Boundary, .claude/rules/architecture.md, .claude/skills/legendary-{server,persistence}/, .claude/rules/work-packets.md §API Catalog, 00.6-code-style.md, MOVE_LOG_FORMAT.md all cited with section anchors |
| 5 | Files Expected to Change | PASS | 8 files; each marked new/modified with one-line description; no ambiguous output language |
| 6 | Naming Consistency | PASS | `matchId` per 00.2; envelope field names local (no MatchSetupConfig collision); no abbreviations |
| 7 | Dependency Discipline | PASS | No new npm deps; no forbidden packages (`fetch` is Node built-in for endpoint testing if needed) |
| 8 | Architectural Boundaries | PASS | Server is wiring; `G`/`ctx` never persisted; no DB queries in moves (no moves touched); no `Math.random()`; pure-helper boundary on `playbackController.mjs` |
| 9 | Windows Compatibility | PASS | All verification steps use `pwsh` Select-String; no bash assumptions |
| 10 | Environment Variable Hygiene | N/A | No new env vars introduced |
| 11 | Authentication Clarity | N/A | No new identity model; new endpoints inherit `Auth: guest` from existing `/api/match/autoplay` |
| 12 | Test Quality | PASS | `node:test` only; no `boardgame.io/testing` import; deterministic state-machine tests; drift tests included |
| 13 | Commands and Verification | PASS | `pnpm`-only; each command shows expected output as inline comment; Step 5 scoped to `router.post(` per review tightening |
| 14 | Acceptance Criteria Quality | PASS | Binary, observable, specific — grouped by sub-task (Controller / Endpoints / Bot loop / API Catalog / Tests / Scope) per established WP-157/WP-160 practice. Count exceeds nominal 6–12 because grouping increases granularity; tradeoff is intentional. |
| 15 | Definition of Done | PASS | STATUS / DECISIONS / WORK_INDEX / EC_INDEX / scope-boundary checks all present |
| 16 | Code Style (Junior Maintainability) | PASS | No premature abstraction; explicit control flow; full English names (`getCursor()` not `cursor` getter, `playbackDelayOverride` not `delayOverride`); `// why:` comments specified at non-obvious sites; full-sentence error messages required |
| 17 | Vision Alignment | N/A (justified) | Explicit `## Vision Alignment` section in WP body; no §17.1 trigger surface touched (autoplay UX; not scoring, replay, identity, multiplayer sync, determinism, card data, monetization, live ops, accessibility, registry viewer); determinism preservation explicitly confirmed |
| 18 | Prose-vs-Grep Discipline | PASS | Grep targets are code files (`autoplay.mjs`, `playbackController.mjs`, `api-endpoints.md`); WP body prose lives outside those grep paths; no false-positive risk |
| 19 | Bridge-vs-HEAD Staleness | N/A | Not a session-context bridge document; this is a forward-looking WP, not a repo-state snapshot |
| 20 | Funding Surface Gate | N/A (justified) | Explicit `## Funding Surface Gate` section; six REST endpoints with no user-visible copy; no §20.1 trigger surface |
| 21 | API Catalog Update | FIRES — handled | Explicit `## API Catalog Update Obligation` section; six new whole rows per D-11804; `Status: Wired`, `Auth: guest`; closed-set values verified |

**Result:** all 21 sections PASS or explicit N/A with justification. Gate satisfied for Step 6 / Step 7 authorization.

---

## Pre-Flight Verdict (`01.4`)

> Full report at `docs/ai/invocations/preflight-wp163-wp164-autoplay-playback.md` (scratchpad).

**Verdict: READY TO EXECUTE.**

- All dependencies verified (none — parallel-safe).
- Repo green at `origin/main = f878b46` (baseline recorded at draft time).
- Scope locked (8 files, allowlist enumerated).
- Locked values enumerated in `## Non-Negotiable Constraints` (envelope, snapshot shape, `maxHistory = 100`, HTTP rules, endpoint paths, Matrix).
- No outstanding PS-items. No clarifying RS-items.

## Copilot Check Verdict (`01.7`)

> Full report at `docs/ai/invocations/copilot-wp163-wp164-autoplay-playback.md` (scratchpad).

**Verdict: PASS.**

WP iterated through three review rounds with substantive design tightening at each pass:

1. Initial review (10 items) — cursor↔live reconciliation, `StepForwardResult` union, concurrency, lifecycle leak, initial snapshot, empty-history, audience filter, HTTP rules, `mode` field, verification step #5.
2. Additional tests (race / boundary / interrupt).
3. Minor renames (`getCursor()`, `playbackDelayOverride`, snapshot immutability).

All items integrated into WP-163, EC-180, and DECISIONS.md (D-16304 augmented, D-16309 added). No outstanding RISK or BLOCK items.

---

## DECISIONS.md stubs (append at queue time)

> Each stub is a single paragraph; expand with full rationale before appending.

- **D-16301 — Server is sole source of match progression; rewinds are client-side visual only.** No server-side rollback of boardgame.io state. Any real server broadcast overwrites client rewind state. Prevents dual-authority bugs and persistence-rule violations.
- **D-16302 — Cursor-based history (not pop-based); `maxHistory = 100`.** Step-back never destroys history; it moves the cursor. Step-forward at history latest executes a real move; otherwise advances cursor. Enables non-destructive rewind/replay UX without re-running the engine.
- **D-16303 — Rewind delivery via REST response body, never via `transport.pubSub`.** Standardizes a single client-side ingestion path; eliminates dual-path desync risk identified during invocation review.
- **D-16304 — Standardized `AutoplayControlResponse` envelope; closed Endpoint Behavior Matrix.** Every endpoint returns `{ ok, paused, historyLength, cursor, mode, uiState?, error? }`. The Matrix defines exactly which endpoints return `uiState` and the post-success `mode`. Locked verbatim; do not paraphrase. `mode` is present on every response (200 and error) and is computed by the controller via `getMode()` — never by endpoint handlers inline.
- **D-16305 — `PlaybackStateSnapshot` shape locked to `{ G, ctx: { phase, turn, currentPlayer } }`.** No other ctx fields. Snapshots are `structuredClone`'d at push time.
- **D-16306 — Playback buffer is Class 1 Runtime State.** MUST NOT be written to DB / Redis / files / logs. Lost on process restart (acceptable; consistent with `InMemory` adapter). Not a `MatchSnapshot`, `ReplayInput`, or `LogEntry`.
- **D-16307 — Race-safe pause via single `resumeResolver` promise; `stepMode` flag.** Bot loop awaits a fresh promise on each pause; resume / step resolves it. Step mode flips `isPaused` back to true after exactly one move.
- **D-16308 — Controller lifecycle bound to `runBotMatch`.** Created on match start, destroyed on every exit path. Cleanup is a non-negotiable invariant — missed cleanup is a memory leak in production.
- **D-16309 — Single-consumer controller concurrency model.** Only one `waitIfPaused()` promise may be in-flight at a time. Concurrent HTTP requests touching the same controller (rapid pause / step / resume bursts from a flaky network) follow last-write-wins semantics: the most recent state-mutating call overwrites the prior intent. No mutex, no queue. Avoids over-engineering at the cost of accepting that concurrent abuse cannot produce a coherent ordering — acceptable because each controller has exactly one logical consumer (the spectating UI). Rejected alternatives: a per-controller `async-mutex` (rejected — adds a dep for a problem solvable by the single-Promise pattern); a queue of pending intents (rejected — introduces ordering ambiguity worse than last-write-wins, since "queue order" diverges from "request arrival order" under retries).
