# EC-393 — In-Match "View Loadout in Registry Viewer" Link (WP-363)

**Pairs with:** WP-363 · **Reserves:** D-24155 · **Lane:** standard two-session · **Status:** executed 2026-07-12
**Layer:** Arena Client (`apps/arena-client`).

> **EC number note:** WP-363 reserved `EC-393` at draft; **WP-366 double-booked it**
> (its inviter-trigger/join packet also cites EC-393). WP-363 executed first and
> kept EC-393 — WP-366 must renumber when it executes.

## Before Starting
- [x] Baseline `origin/main` @ `6f9a3475` (WP-361 + WP-362 both merged). WP-361 endpoint + WP-362 `?lagn=` ingest live. WP-228 (`DiagnosticExportButton` mount idiom), WP-301 (`buildApiUrl`+Bearer), WP-160 (`useAuthStore().token`) on `main`.
- [x] Isolated worktree off `origin/main`; `pnpm install` + `pnpm -r build` (arena-client vue-tsc/test consume the game-engine dist).

## Locked Values
- **Source:** `GET /api/match/:matchId/lagn` (WP-361), `Authorization: Bearer` from `useAuthStore().token`.
- **Encoding:** `base64url(UTF-8 JSON.stringify(lagn))` — the **exact inverse** of WP-362's decoder (D-24154); round-trip test asserts parsed-value equality via the base64url standard (Node `Buffer`, no cross-app import).
- **Link:** `${REGISTRY_VIEWER_ORIGIN}/?lagn=<b64url>` — one `/`, no `//?`; `REGISTRY_VIEWER_ORIGIN = 'https://cards.barefootbetters.com'` (no trailing slash; the served viewer origin). `window.open(url, '_blank', 'noopener')`; a `null` return → pop-up-blocked message.
- **matchId:** `new URLSearchParams(window.location.search).get('match')`; absent ⇒ control **not rendered**.
- **Auth short-circuit:** a null `authToken` ⇒ sign-in message with **no** fetch.
- **In-flight guard:** a single `isLoading` ref — a click while loading is ignored.
- **fetch:** `fetchMatchLagn` **never throws** — non-200 → `{ ok:false, status }`; a thrown fetch OR a bad 200 body (in-guard `json()`) → `{ ok:false, status:0 }`.
- **Failure map:** `401`→sign-in / `403`→participants-only / `404`→not-available-yet / else→try-again (full sentences).

## Guardrails
- [x] No `boardgame.io` / `@legendary-arena/game-engine` / `@legendary-arena/registry` import in the new files. Opaque `lagn` (`unknown`) — never validated or inspected.
- [x] No bearer/credentials in the opened URL — only the non-secret loadout payload (asserted by test).
- [x] SFC uses `defineComponent({ setup })` (D-6512, vue-sfc-loader separate-compile); mounted ONCE in `PlayViewport.vue` beside `DiagnosticExportButton` (covers PlayMobile + PlayDesktop).
- [x] `noopener` mandatory on `window.open`.

## Required Comments (`// why:`)
- [x] `REGISTRY_VIEWER_ORIGIN` = served viewer origin, no trailing slash.
- [x] `TextEncoder`→`btoa`→base64url (multi-byte names + `+`-free URL); the status-0 mapping + in-guard `json()`.
- [x] The null-token short-circuit, the in-flight guard, and `noopener` (no reverse `window.opener`; bearer stays in the header).

## Files Produced
- `apps/arena-client/src/lib/lagnShareLink.ts` (pure encoder + `REGISTRY_VIEWER_ORIGIN`) + `lagnShareLink.test.ts`
- `apps/arena-client/src/lib/api/matchLagnApi.ts` (never-throws fetch) + `matchLagnApi.test.ts`
- `apps/arena-client/src/components/ViewLoadoutButton.vue` + `ViewLoadoutButton.test.ts`
- `apps/arena-client/src/pages/PlayViewport.vue` (mount once)

## After Completing
- [x] `pnpm -r build` 0; arena-client `typecheck` (vue-tsc) 0; `test` **884 pass / 0 fail** (867 baseline + 17 new).
- [x] D-24155 → Active; WORK_INDEX WP-363 `[x]`; EC_INDEX + STATUS + `wiki/lagn-v1.md`. **Completes the WP-361/362/363 arc.**
- [ ] **D-24026:** APPLIES — operator-pending on deploy: in a real match on play.legendary-arena.com, click "View loadout in Registry Viewer" → a new tab opens the viewer Loadout tab pre-filled; a non-participant context shows the participants-only message.
