# EC-400 — WP-371: Lobby Player-Count Pre-Submit Check (read-only requirements endpoint + warn/disable)

**Pairs with:** [WP-371](../work-packets/WP-371-lobby-player-count-composition-gate.md) · **Lane:** standard two-session · **Baseline:** `origin/main @ 82330d1b` (after WP-370) · **Reserves → Active:** D-24167.

## Before Starting
- Confirm baseline green: arena-client `916`-minus-`8` = **908/0**; server **796 pass / 154 DB-skipped / 0 fail**; `pnpm -r build` 0.
- **Framing (operator "expand it", 2026-07-13):** do NOT add a server composition gate — WP-370's `validateSetupData` already blocks a mismatch and `POST /api/match/create` already propagates it as a 400. Build a read-only requirements endpoint + a lobby pre-check instead.

## Locked Values
- Endpoint: `GET /api/match/setup-requirements` — **guest** (public rules data), `Cache-Control: public, max-age=3600`, body `{ requirements: PLAYER_COUNT_SETUP }` (server imports `@legendary-arena/registry`).
- arena-client imports **no** `@legendary-arena/registry` — requirements arrive as data; the client re-declares the row shape locally.
- Warning copy: `A {N}-player match needs {required} {label} — this loadout has {actual}.` (labels: "villain groups" / "henchmen groups" / "heroes").

## Guardrails
- The endpoint is guidance data, **not** a gate — no game logic on the server; the engine remains the authoritative block.
- The pre-check is **progressive enhancement**: when `setupRequirements` is null (fetch failed / not yet loaded), `computePlayerCountMismatches` returns `[]` — Create is never falsely blocked. `fetchSetupRequirements` throws on a missing/!object `requirements` so a malformed response falls back to null (never stores `undefined`).
- Both create paths gated: JSON (`parsedLoadout.playerCount` + composition) via `canSubmitFromJson`; manual (`numPlayers` ref + CSV lengths) via `canSubmitCreate`.
- No `bgioClient.ts` / transport change; no migration; `POST /api/match/create` / `/join` byte-unchanged.

## Required Comments
- `// why: WP-371 / D-24167` on the endpoint, on `setupRequirements`, and on the mount-time fetch.

## Files to Produce (allowlist — 7 code/test)
- `apps/server/src/match/matchGate.routes.ts` (+ import + `GET /api/match/setup-requirements`)
- `apps/server/src/match/matchGate.routes.test.ts` (fake router `get`; endpoint-list + endpoint tests)
- **new** `apps/arena-client/src/lobby/playerCountRequirements.ts` (types + `computePlayerCountMismatches` + `formatMismatchWarning`)
- **new** `apps/arena-client/src/lobby/playerCountRequirements.test.ts`
- `apps/arena-client/src/lobby/lobbyApi.ts` (`fetchSetupRequirements` + shape guard)
- `apps/arena-client/src/lobby/LobbyView.vue` (mount fetch + mismatch computeds + gate both buttons + warning lists)
- `apps/arena-client/src/lobby/LobbyView.test.ts` (mismatch→disabled+warn; match→enabled; requirements-unavailable→inert)

## After Completing
- arena-client typecheck (vue-tsc) 0 + test **916/0** (+8); server test **797 pass / 154 skipped / 0 fail** (+1); `pnpm -r build` 0.
- api-endpoints.md GET row (D-11804); D-24167 → Active (reframed); WORK_INDEX WP-371 → Done; STATUS; EC_INDEX EC-400 row; mindmap 📝→✅ + `pnpm roadmap:counts --write`.

## Common Failure Smells
- Storing `undefined` in `setupRequirements` (blanket test stubs return `{matches}`) → the always-on manual computed crashes. The wrapper's shape guard prevents it.
- Adding a server gate (redundant with WP-370 — the framing error the amendment corrects).
- Re-typing the count literals in arena-client (they must arrive from the endpoint).
