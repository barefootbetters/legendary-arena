# EC-180 — Autoplay Playback Controls / Server (Execution Checklist)

**Source:** [WP-163](../work-packets/WP-163-autoplay-playback-server.md)
**Layer:** Server

> **Numbering note (2026-05-19):** earlier drafts reserved EC-178 / EC-179
> but those slots were already taken — EC-178 by the image-URL CI fix
> (PR #95), EC-179 by the wiki link-integrity check on an in-flight branch.
> EC-180 / EC-181 are the first genuinely-free pair.

## Before Starting
- [ ] WP-163 reviewed; D-16301..D-16309 appended to DECISIONS.md (D-16304 reflects augmented envelope w/ `mode`; D-16309 locks single-consumer concurrency)
- [ ] `pnpm -r build` exits 0 on `main`
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 on `main`
- [ ] `apps/server/src/autoplay/autoplay.mjs` reviewed end-to-end; current `submitMove` audience pattern noted (for rewind `filterUIStateForAudience` parity)
- [ ] `docs/ai/MOVE_LOG_FORMAT.md` Class 1 Runtime State rules re-read
- [ ] `docs/ai/REFERENCE/api-endpoints.md` row format confirmed (D-11804)

## Locked Values (do not re-derive)
- `maxHistory = 100` (D-16302)
- Endpoint paths: `/api/match/:matchId/autoplay/{pause,resume,step-forward,step-back,restart,go-to-end}`
- Response envelope keys (D-16304): `ok`, `paused`, `historyLength`, `cursor`, `mode`, `uiState?`, `error?` — `mode` is present on every response (200 and error)
- `mode` values (D-16304): `'live' | 'rewind'`; computed as `cursor === stateHistory.length - 1 ? 'live' : 'rewind'`
- `StepForwardResult` (D-16302): `{ type: 'cursor', snapshot } | { type: 'live-move' }` — closed discriminated union; `'live-move'` branch does NOT itself call `submitMove`
- Snapshot ctx keys (D-16305): `phase`, `turn`, `currentPlayer`
- `playbackDelayOverride` for go-to-end: `10` ms (D-16307; renamed from `delayOverride` for disambiguation)
- Endpoint Behavior Matrix (D-16304) — endpoints returning `uiState`: `step-back` (always), `restart` (always), `step-forward` (only on `'cursor'` result). All others: NO
- HTTP status rules (locked): `200` success, `404` controller-not-found, `409` invalid-state-transition (incl. step-back at `cursor === 0`), `500` unexpected — every non-200 still returns the envelope
- API Catalog row: `Status: Wired`, `Auth: guest` (D-11804 closed sets)

## Guardrails
- No `Math.random()` anywhere in new code
- No `boardgame.io` import in `playbackController.mjs` (pure helper)
- No persistence path for the playback buffer — no DB / Redis / file / log writes (Class 1 Runtime State)
- Controller MUST be removed from the `Map` on every exit path of `runBotMatch` (success, max-turn, error catch)
- Step-back / restart MUST NOT call `submitMove` or mutate boardgame.io state
- Rewind delivery is REST-only; do NOT use `transport.pubSub` for rewind responses
- **Cursor reconciliation (D-16301): `pushState()` is the ONLY mutator of `cursor` to `stateHistory.length - 1`.** No endpoint or external caller writes `cursor` directly. Every real-move boundary in the bot loop calls `pushState()`, which discards rewind state by writing the new entry.
- **Initial snapshot rule (D-16302 corollary):** bot loop calls `pushState()` ONCE immediately after match init, BEFORE the first `waitIfPaused()` gate. No `pushState()` after the final `submitMove`.
- **Single-consumer concurrency (D-16309):** only one in-flight `waitIfPaused()` Promise at a time; last-write-wins for concurrent state-mutating calls; no mutex, no queue.
- **Snapshot immutability (D-16305):** `PlaybackStateSnapshot` instances are treated as immutable after `pushState()`. No deep-mutation, no field reassignment by the controller or its callers.
- **Audience filtering (D-16303):** `uiState` in rewind responses is `filterUIStateForAudience(buildUIState(G, ctx), audience)`. Skipping the filter is a hidden-info leak. Audience MUST match the existing spectator broadcast pattern in `autoplay.mjs`.
- Whole-row replace in `api-endpoints.md` per D-11804 — no partial-column updates
- New endpoints registered WITHOUT `koaBody()` (they accept no body)

## Required `// why:` Comments
- `playbackController.mjs::waitIfPaused` — explain race-safety of the single `resumeResolver` AND the single-consumer invariant (D-16309)
- `playbackController.mjs::pushState` — explain the 100-entry cap (D-16302) AND that this is the only cursor-reconciliation site (D-16301)
- `playbackController.mjs::stepForward` — explain the discriminated-union return and why the `'live-move'` branch does NOT call `submitMove`
- `autoplay.mjs::runBotMatch` initial-push site — cite D-16302 corollary (history must be ≥ 1 before any pause)
- `autoplay.mjs::runBotMatch` exit cleanup — explain memory leak risk if `Map` entry is leaked (D-16308)
- `autoplay.mjs::step-forward` handler — explain why `uiState` is returned only on `result.type === 'cursor'`
- `autoplay.mjs::buildResponse` helper — explain why `mode` is always computed by the controller, never inline by the handler

## Files to Produce
- `apps/server/src/autoplay/playbackController.mjs` — **new** — factory + state
- `apps/server/src/autoplay/playbackController.test.mjs` — **new** — `node:test` coverage
- `apps/server/src/autoplay/autoplay.mjs` — **modified** — controller map, 6 endpoints, bot-loop integration
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — 6 new whole rows (D-11804)
- `docs/ai/DECISIONS.md` — **modified** — D-16301..D-16309
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**

## After Completing
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0 — including the new lifecycle leak / race-edge / cursor-boundary / fast-forward-interrupt tests
- [ ] `Select-String -Pattern "router\.post\(.*/api/match/:matchId/autoplay/"` returns exactly 6 unique matches
- [ ] `Select-String -Pattern "autoplayControllers\.delete"` returns at least 1 match
- [ ] `api-endpoints.md` has 6 new rows with `Status: Wired` and `Auth: guest`
- [ ] No occurrence of `getDelayOverride` (renamed to `getPlaybackDelayOverride`); no occurrence of `delayOverride` outside `playbackDelayOverride`
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` has D-16301..D-16309 (note: D-16304 reflects augmented envelope; D-16309 is new)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with today's date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` row marked complete

## Common Failure Smells
- Step-back ever calls `submitMove` → server-side rollback was introduced; revert (violates D-16301)
- Cursor written directly anywhere outside `pushState()` → D-16301 reconciliation mechanism bypassed; the cursor will diverge from `historyLength - 1` after the next real move
- `'live-move'` branch of `stepForward` invokes `submitMove` itself → D-16302 / D-16307 violation; the bot loop (already awaiting `waitIfPaused`) is the only legitimate executor of a real move
- Response missing `mode` field on any path → D-16304 violation; the client cannot derive rewind-vs-live without it
- `uiState` returned without `filterUIStateForAudience` → D-16303 hidden-info leak; the rewound snapshot may expose another player's hand or hidden zones
- Initial `pushState()` skipped → `historyLength === 0` at first pause; `restart` and `step-back` 409 unexpectedly
- Response envelope drift (e.g., `paused: undefined` instead of `false` after pause) → state-machine bug
- Map size grows monotonically across test runs → cleanup path missed an exit branch
- `transport.pubSub` invoked from a rewind handler → D-16303 violation; remove and return `uiState` inline
- `api-endpoints.md` rows differ in column count from existing rows → D-11804 whole-row replace was treated as partial-update
- `koaBody()` applied to a new endpoint → unnecessary; the new endpoints accept no body
- Two concurrent `pause()` calls leave a stale `resumeResolver` → D-16309 single-consumer invariant violated; the second pause's promise replaces the first but the first await may never resolve (verify by inspecting the resume / step paths)
