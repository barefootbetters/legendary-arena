# EC-453 — "New Version — Refresh" Prompt + Reconnect-Gap Audit (Client) (Execution Checklist)

> **Status:** PROPOSED — number pending governance allocation (WP-418 / EC-453).
> **Source WP:** [WP-418](../work-packets/WP-418-deploy-refresh-prompt.md).
> **Lane:** Standard client WP (arena-client only), single-session draft+execute per the invocation.

**Layer:** App (`apps/arena-client/src/` + the app's own Vite build config)

## Scope (read first)
IN scope: a Fork-A `version.json` build emit + dev serve (`vite.config.ts`), a pure
`isNewerBuildAvailable` + fail-soft `fetchDeployedSha` (`lib/deployVersion.ts`), a
`useDeployVersionCheck` composable (poll + focus + reconnect + backstop + Fork-B
`vite:preloadError`), an `UpdateAvailableBanner.vue` read-only notice with a
user-initiated **Refresh now** + dismiss, and wiring both at the `PlayViewport`
play-root (01.5 host). OUT of scope: auto-reload, any engine/server/registry change,
and any refactor/duplication of the reconnect/resync/watchdog stack.

## Before Starting
- [ ] `git rev-parse origin/main` matches local `main` HEAD; record it (baseline `6a4ee748`)
- [ ] WP-418 allocated; §Pre-Flight Verdict = READY (no hard-dep WP in flight)
- [ ] `PlayViewport.vue` is the D-16501 play-root host (WP-410/412/415 wiring precedent)
- [ ] `ConnectionStatusBanner.vue` reviewed as the read-only banner precedent (role/`aria-live`/prop-drilled action)
- [ ] `stores/connection.ts` reviewed — `isConnected` false→true is the reconnect signal
- [ ] `vite.config.ts` reviewed — the `gitSha` capture the emit reuses (no second git call, no npm dep)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `... test` runs

## Locked Values (do not re-derive)
- `version.json` shape: `{ "gitSha": "<short git sha>" }`, emitted into the build output; the sha equals the baked `__GIT_SHA__`
- Fetch: `GET /version.json` from the page origin (client static asset, NOT `apps/server`), `cache: 'no-store'` (the cache-bust)
- `isNewerBuildAvailable(baked, fetched)` = `true` iff both are non-empty strings AND differ; any empty/null/undefined ⇒ `false`
- `fetchDeployedSha()` fail-soft: a reject / non-200 / unparseable / sha-less body ⇒ `null` (never throws, never a spurious sha)
- Triggers: on mount · `visibilitychange`→visible · `connection.isConnected` false→true · `DEPLOY_VERSION_POLL_MS = 60_000` backstop · `window` `vite:preloadError`
- `vite:preloadError` handler: `event.preventDefault()` (block the white-screen) + set `updateAvailable = true`
- Banner shows iff `updateAvailable`; glyph ("↻") + text "A new version is available."; **Refresh now** → prop-drilled `refresh` (`window.location.reload()`); a dismiss control
- Reload is USER-INITIATED only — never automatic, never mid-turn
- Mount host: `PlayViewport.vue` (01.5 runtime-wiring host)

## Guardrails
- Read-only status surface — the banner never mutates match state and never gates a move the engine would accept
- No forced/auto reload — the reload is a user button; an auto-reload-when-safe path is a deferred sub-fork
- Fail-soft detection — a failed / missing `version.json` fetch is a silent no-op, never a false "update available"
- No new runtime dependency; `version.json` reuses the existing `gitSha` capture (no new git call, no npm dep)
- Do NOT duplicate the reconnect/resync/watchdog stack — reuse the `connection` store's reconnect edge; add no second socket listener
- No runtime `@legendary-arena/registry` or `server` import — the client reaches nothing over an app HTTP endpoint here (static asset only)
- a11y — `role="status"`, glyph + text (not colour-only), keyboard-reachable buttons
- Leak discipline — the backstop timer is `unref`'d and cleared, and every listener removed, on unmount (the WP-415 node:test gotcha)

## Required `// why:` Comments
- `deployVersion.ts` — why `cache: 'no-store'` is the cache-bust; why empty/missing shas are fail-soft false
- `useDeployVersionCheck.ts` — why the reconnect check reuses the `connection` store (no second socket listener); why the backstop timer is `unref`'d
- `useDeployVersionCheck.ts` — why `vite:preloadError` `preventDefault`s (block the white-screen)
- `UpdateAvailableBanner.vue` — why the reload is user-initiated, never auto (a forced mid-turn reload discards an in-progress action)
- `PlayViewport.vue` wiring — 01.5 play-root host: why the composable mounts once here (WP-410/412/415 precedent)

## Files to Produce
- `apps/arena-client/vite.config.ts` — **modified** — `emitVersionJsonPlugin` (generateBundle emit + configureServer dev serve), reusing `gitSha`
- `apps/arena-client/src/lib/deployVersion.ts` — **new** — `isNewerBuildAvailable` (pure) + `fetchDeployedSha` (fail-soft)
- `apps/arena-client/src/lib/deployVersion.test.ts` — **new** — truth table + fail-soft I/O
- `apps/arena-client/src/composables/useDeployVersionCheck.ts` — **new** — poll + focus + reconnect + backstop + `vite:preloadError`; fail-soft; leak-clean
- `apps/arena-client/src/composables/useDeployVersionCheck.test.ts` — **new** — all triggers + fail-soft + unmount leak
- `apps/arena-client/src/components/UpdateAvailableBanner.vue` — **new** — read-only notice; Refresh + dismiss; `role="status"`, glyph+text
- `apps/arena-client/src/components/UpdateAvailableBanner.test.ts` — **new** — hidden until available; Refresh calls action; dismiss hides
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** (01.5 host) — mount `useDeployVersionCheck`; render `UpdateAvailableBanner`; own `reloadForUpdate`
- `docs/ai/DECISIONS.md` — **modified** — **D-24238** lands (Active)
- `docs/ai/STATUS.md` — **modified** — deploy-refresh note
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-418
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-453 status
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — WP-418 node `📝` → `✅`; `pnpm roadmap:counts:write`

## After Completing
- [ ] `pnpm -r build` exits 0 AND `apps/arena-client/dist/version.json` exists with the baked short sha (AC-2)
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` passes (deployVersion + composable + banner)
- [ ] `pnpm -r --no-bail test` green repo-wide (server DB-gated tests skip)
- [ ] `rg "visibilitychange|vite:preloadError|isConnected" apps/arena-client/src/composables/useDeployVersionCheck.ts` → all triggers present
- [ ] `rg "unref|onUnmounted|clearInterval|removeEventListener" apps/arena-client/src/composables/useDeployVersionCheck.ts` → leak discipline present
- [ ] `rg "useDeployVersionCheck|UpdateAvailableBanner" apps/arena-client/src/pages/PlayViewport.vue` → wired
- [ ] `rg "@legendary-arena/registry|@legendary-arena/server" apps/arena-client/src/composables/useDeployVersionCheck.ts apps/arena-client/src/lib/deployVersion.ts` → zero (layer boundary)
- [ ] Integration (D-24026, post-deploy): a mid-match deploy surfaces the refresh banner; **Refresh now** reloads and recovers the tab
- [ ] D-24238 Active; WORK_INDEX/EC_INDEX/mindmap updated; STATUS note
- [ ] Commit prefix `EC-453:` (staged files under `apps/arena-client/`, `docs/`)

## Common Failure Smells
- Banner flashes on a network blip → `fetchDeployedSha` not fail-soft (a reject/non-200 leaked a truthy compare)
- A forced reload discards a move → an auto-reload path slipped in; reload must be a user button
- Two socket listeners / a resync duplicate → the reconnect trigger reinvented instead of reading the `connection` store
- node:test hangs → the backstop `setInterval` not `unref`'d or not cleared on unmount
- White-screen still reaches the user → `vite:preloadError` not caught / not `preventDefault`'d
- Colour-only banner → no glyph/text pairing (a11y)
- `version.json` 404s in prod → the emit plugin not in the build (only `configureServer` present); check `generateBundle`
