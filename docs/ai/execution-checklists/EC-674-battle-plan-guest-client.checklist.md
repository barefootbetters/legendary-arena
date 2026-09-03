# EC-674 — Battle Plan Guest Client Credential-Passing (Arena Client) (Execution Checklist)

**Source:** docs/ai/work-packets/WP-639-battle-plan-guest-client.md
**Layer:** App (`apps/arena-client`)

## Before Starting

- [ ] On `main`, clean, fast-forward synced; `origin/main` baseline recorded in the WP.
- [ ] Confirm WP-638 on `main`: `PUT`/`GET /api/match/:matchId/battle-plan` authorize a guest via `X-Guest-Player-Id` + `X-Guest-Credentials` headers (`apps/server/src/match/battlePlan.routes.ts`).
- [ ] Read the files to modify: `apps/arena-client/src/lib/api/battlePlanApi.ts` (`authHeaders`, the two wrappers) + `apps/arena-client/src/composables/useBattlePlan.ts` (the `authStore.token` calls at ~154/176) + their `.test.ts`.
- [ ] `pnpm --filter @legendary-arena/arena-client build` / `test` / `typecheck` exit 0 (baseline).

## Locked Values (do not re-derive)

- `BattlePlanAuth = { kind: 'session'; token: string } | { kind: 'guest'; playerId: string; credentials: string }`.
- `buildAuthHeaders(auth: BattlePlanAuth | null)`: session → `{ Authorization: \`Bearer ${token}\` }`; guest → `{ 'X-Guest-Player-Id': playerId, 'X-Guest-Credentials': credentials }`; null → `{}`. Header names WP-638-verbatim.
- `fetchBattlePlan(matchId, auth)` + `updateBattlePlanPhase(matchId, phase, text, auth)` take `BattlePlanAuth | null` (replacing `authToken: string | null`).
- `resolveBattlePlanAuth()` in `useBattlePlan`: **session token wins** — `authStore.token !== null` → `{kind:'session', token}`; else `new URLSearchParams(window.location.search)` `player` + `credentials` both present → `{kind:'guest', playerId, credentials}`; else `null`.
- No server change; no new D (realizes D-24451); error union + drift test + `Result<T>` transport behaviour unchanged.

## Guardrails

- arena-client ONLY — no server/contract change; no `G`/`ctx`; never `bgioClient.submitMove`.
- **Precedence:** a session token ALWAYS wins; guest params are consulted ONLY when `authStore.token === null` (mirrors the server gate). A test pins that a present token ignores the URL params. NOT only anti-spoof: an account holder on the live route also carries `?player=`/`?credentials=`, so without session-wins the server would stamp `editorId = guest:<playerId>` instead of their `ext_id`.
- **Resolve per-request:** call `resolveBattlePlanAuth()` inside each `pollOnce`/`savePhase` (reading `authStore.token` + the URL at call time), like today's inline `authStore.token` reads — never memoized once at setup.
- Guest credentials are read from the URL the guest already holds and sent in a **header** — never re-appended to a URL/query the client constructs.
- URL read: mirror `App.vue`'s guarded idiom `typeof window !== 'undefined' ? window.location.search : ''` (`resolveBattlePlanAuth` may be evaluated in a non-browser import context, unlike a mounted panel) — do NOT cite `WaitingForPlayersPanel`, which reads it unguarded.
- Do NOT touch `BattlePlanPanel.vue` or the `useBattlePlan(matchId)` signature — auth is resolved inside the composable.
- Leave the error-code union, its drift test, the poll interval, the length cap, and the lifecycle gating untouched.

## Required `// why:` Comments

- `resolveBattlePlanAuth` precedence: why a session token wins over guest URL params — mirrors the server, AND stops an account holder (who also carries the live-route params) from being authorized+stamped as a `guest:<playerId>` seat instead of their `ext_id`.
- The guest URL-param read: why `?player=`/`?credentials=` is the source (the same live-route params `App.vue` feeds `createLiveClient`, WP-628) and why the credential goes in a header, not a URL.
- `buildAuthHeaders` guest branch: the header names are WP-638's contract, verbatim.

## Files to Produce

- `apps/arena-client/src/lib/api/battlePlanApi.ts` — **modified** — `BattlePlanAuth` type + `buildAuthHeaders`; both wrappers take the descriptor
- `apps/arena-client/src/composables/useBattlePlan.ts` — **modified** — `resolveBattlePlanAuth` (per-request) + pass it to the two calls
- `apps/arena-client/src/lib/api/battlePlanApi.test.ts` — **modified** — **rewrite the existing ~7 session call sites from the raw-string arg to `{kind:'session',token}`** (else `vue-tsc` fails), then add the guest→X-Guest-* + null→none cases (assert the captured request headers)
- `apps/arena-client/src/composables/useBattlePlan.test.ts` — **modified** — token-present→session (params ignored) / token-null+params→guest / token-null+no-params→null; inject the guest params via `window.location.search` under jsdom — mirror `BattlePlanPanel.test.ts`'s `setSearch` helper

## After Completing

- [ ] `pnpm --filter @legendary-arena/arena-client` `build` / `test` / `typecheck` exit 0
- [ ] `Select-String` confirms `X-Guest-Player-Id` + `X-Guest-Credentials` present in `battlePlanApi.ts`; no server file touched
- [ ] `docs/ai/STATUS.md` updated; `WORK_INDEX.md` WP-639 checked off (realizes D-24451, no new D); `EC_INDEX.md` EC-674 → Done
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝 → ✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0
- [ ] **D-24026 live-verify** (guest writes a phase, it persists + reloads) — pending post-deploy

## Common Failure Smells

- A guest still 401s → `resolveBattlePlanAuth` returned `null` (URL params missing/misnamed) or the guest branch didn't emit the `X-Guest-*` headers.
- An account holder authenticates as a guest → the precedence is wrong (URL params consulted while a token exists).
- A test passes against a real bearer but the guest header case isn't asserted → assert the CAPTURED request headers, not just the response.
- `vue-tsc` fails → the `BattlePlanAuth` union wasn't threaded through both wrappers + the composable consistently.
