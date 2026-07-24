# WP-418 — "New Version — Refresh" Prompt + Reconnect-Gap Audit (Client)

**Status:** Draft 2026-07-24 · **PROPOSED (WP-418; highest landed WP is 417)** · **Standard client WP** (arena-client only) · single-session draft+execute per the invocation. Pairs with **EC-453** (authored). Reserves **D-24238** (lands at execution).
**Primary Layer:** App (`apps/arena-client/src/` + the app's own Vite build config)
**User-Visible Surface:** `play.legendary-arena.com` play surface — when a deploy lands mid-match, an already-open tab is offered a **Refresh** instead of silently freezing on a stale JS bundle. **D-24026 live-verify APPLIES** (after a mid-match deploy the refresh banner surfaces, and clicking it recovers the tab).
**Dependencies:** WP-311 `ConnectionStatusBanner` precedent ✅; the D-16501 `PlayViewport` play-root wiring host ✅ (WP-410/412/415 precedent); the `__GIT_SHA__` Vite `define` ✅ (build-id capture already in `vite.config.ts`). No hard-dep WP is in flight.
**Baseline:** `origin/main` @ `6a4ee748` (WP-417 / D-24237 + PR #980/#981 merged; capture `git rev-parse origin/main` at execution).

---

## Goal

Kill the deploy-mid-match freeze. When a new client build deploys while a tab is
open, Cloudflare Pages swaps the hashed asset chunks the running tab references;
any lazy-loaded chunk then 404s and the board can freeze or paint blank tiles.
The reconnect / resync stack re-anchors **match state** but cannot fix a stale JS
**bundle** — only a page reload does. This packet adds the missing layer: the
play surface detects that a newer build is deployed (a build-stamped `version.json`
poll, plus a `vite:preloadError` catch) and offers a user-initiated **"Refresh
now"** banner. It never force-reloads (that would discard an in-progress action).

---

## User-Visible Impact

A player mid-match when a deploy lands no longer stares at a frozen or blank
board wondering what broke. A small notice appears — "A new version is available."
with a **Refresh now** button (and a dismiss control) — and one click reloads the
tab onto the fresh bundle. A session with no deploy, or a failed version check,
shows nothing.

---

## Assumes

- **The client bakes its own build id** at build time via Vite `define`
  (`__GIT_SHA__`, `apps/arena-client/vite.config.ts`), consumed today by
  `VersionBadge.vue` / `DiagnosticExportButton.vue`. (Verified — `vite.config.ts`
  `define` block; `env.d.ts` declares the global; `jsdom-setup.ts` stubs it in tests.)
- **The `PlayViewport` root is the D-16501 single play-surface wiring host** where
  a once-per-match composable / banner mounts (the WP-410/412/415 precedent).
  (Verified.)
- **`ConnectionStatusBanner.vue` is the read-only banner precedent** — role/styling
  + a prop-drilled action (`resync`); `BotAllyStallBanner.vue` mirrors it with
  `returnToLobby`. (Verified.)
- **The WP-311 `connection` Pinia store** exposes `isConnected` — a false→true edge
  is the reconnect signal, so the deploy check can re-run on reconnect without a
  second socket listener (no duplication of the resync stack). (Verified —
  `stores/connection.ts`.)
- **The arena-client may not import `@legendary-arena/registry` or the server at
  runtime;** `version.json` is the client's own build-emitted static asset fetched
  from the page origin. (Verified — layer boundary.)

---

## Context (Read First)

- `apps/arena-client/vite.config.ts` — the build-id `define` block + the Fork-A
  `version.json` emit is added here (reusing the existing `gitSha` capture).
- `apps/arena-client/src/components/ConnectionStatusBanner.vue` — the read-only
  banner precedent (role/`aria-live` + prop-drilled action).
- `apps/arena-client/src/pages/PlayViewport.vue` — the D-16501 play-root mount host.
- `apps/arena-client/src/stores/connection.ts` — the WP-311 transport store the
  reconnect trigger reads (`isConnected`).
- `apps/arena-client/src/client/bgioClient.ts` — the reconnect / resync / watchdog
  stack (D-24232 / WP-311 / WP-312 / D-24234). **Read-only for this WP** — the
  reconnect-gap audit confirms a stale bundle is out of its reach by design; do
  NOT refactor or duplicate it.

---

## Non-Negotiable Constraints

**Always apply:**
- Human-style code — `docs/ai/REFERENCE/00.6-code-style.md`; full file contents for
  every new/modified file; ESM `.js` import specifiers; `// why:` on non-obvious bits.
- Vue SFC `typecheck` is the load-bearing gate; no runtime `registry`/`server` import.

**Packet-specific:**
- **Read-only status surface** — the banner never mutates match state and never
  gates a move the engine would accept (the `ConnectionStatusBanner` contract).
- **No forced reload** during the viewer's turn or a pending move — the reload is
  user-initiated (a button), never automatic. (An auto-reload-when-safe path is a
  named sub-fork; default manual-only for v1.)
- **Fail-soft detection** — a `version.json` fetch error or a missing file is a
  silent no-op, never a spurious "update available".
- **No new runtime dependency** — `version.json` is a build-time emit reusing the
  existing git-sha capture (no new git call, no npm dep).
- **a11y** — `role="status"`, glyph + text (not colour-only), keyboard-reachable buttons.
- **Do not duplicate the reconnect/resync stack** — reuse the `connection` store's
  reconnect signal; add no second socket listener.

---

## Scope (In)

### A) `version.json` build emit + pure compare (`apps/arena-client/vite.config.ts`, `src/lib/deployVersion.ts`, new)
- A small Vite plugin (`emitVersionJsonPlugin`) emits `version.json` (`{ gitSha }`)
  into the build output via `generateBundle`, reusing the `gitSha` already captured
  in `vite.config.ts`; `configureServer` serves the same file in dev so the poll is
  exercisable locally.
- `deployVersion.ts`: a pure, unit-tested `isNewerBuildAvailable(baked, fetched)`
  (true only when both non-empty and differ) + a fail-soft `fetchDeployedSha()`
  (any error / missing / unparseable ⇒ `null`).

### B) `useDeployVersionCheck` composable (`apps/arena-client/src/composables/useDeployVersionCheck.ts`, new)
- Raises a reactive `updateAvailable` flag. Triggers: on mount, on tab-focus
  (`visibilitychange`→visible), on socket reconnect (`connection.isConnected`
  false→true), a ~60s backstop `setInterval`, and a `vite:preloadError` window
  event (Fork B — flips the flag immediately and `preventDefault`s the white-screen).
- Fail-soft; latches once true; clears its timer + listeners on unmount (leak
  discipline, the WP-415 `unref` gotcha).

### C) `UpdateAvailableBanner.vue` (`apps/arena-client/src/components/UpdateAvailableBanner.vue`, new)
- Renders only when `updateAvailable`. Glyph + "A new version is available." + a
  **Refresh now** button (prop-drilled `refresh` → `window.location.reload()`) + a
  dismiss control. Mirrors `ConnectionStatusBanner` role/`aria-live`/styling.

### D) Wiring at `PlayViewport.vue` (`apps/arena-client/src/pages/PlayViewport.vue`, modified — 01.5 play-root host)
- Mount `useDeployVersionCheck()` once and render `UpdateAvailableBanner` bound to
  its flag; own the `reloadForUpdate` (`window.location.reload()`) site here and
  prop-drill it (the `ConnectionStatusBanner`/`resync` pattern).

### E) Tests
- `deployVersion.test.ts`: `isNewerBuildAvailable` truth table incl. empty/undefined;
  `fetchDeployedSha` fail-soft on non-200 / reject / bad body / sha-less.
- `useDeployVersionCheck.test.ts`: no-mismatch silent; mismatch flags; fail-soft;
  backstop poll; tab-focus; reconnect; `vite:preloadError` (+ `preventDefault`);
  unmount clears timer + listeners.
- `UpdateAvailableBanner.test.ts`: hidden until available; Refresh calls the action;
  dismiss hides without reloading.

### F) Reconnect-gap audit (documentation only)
- The D-24232 resync still covers the pure transport-drop case; a stale **bundle**
  is out of resync's reach by design — this WP's reload prompt is that missing
  layer. Recorded in D-24238. No refactor of the resync logic.

---

## Out of Scope

- **Auto-reloading the page.** Reload is user-initiated; never force a reload
  mid-turn. An auto-reload-when-safe path (only when it is NOT the viewer's turn
  and no move is pending) is a named **sub-fork**, deferred to a follow-up.
- **Any engine / server / registry change** — pure arena-client + one build-config emit.
- **Replacing or refactoring the reconnect/resync/watchdog stack** (D-24232 / WP-311 /
  WP-312 / D-24234).
- **Site-wide mounting beyond the play surface** — noted as a follow-up (the freeze
  pain is on the play surface; App.vue-wide coverage is a later WP).

---

## Files Expected to Change

- `apps/arena-client/vite.config.ts` — **modified** (Fork-A `version.json` emit; same-layer build-config wiring)
- `apps/arena-client/src/lib/deployVersion.ts` — **new**
- `apps/arena-client/src/lib/deployVersion.test.ts` — **new**
- `apps/arena-client/src/composables/useDeployVersionCheck.ts` — **new**
- `apps/arena-client/src/composables/useDeployVersionCheck.test.ts` — **new**
- `apps/arena-client/src/components/UpdateAvailableBanner.vue` — **new**
- `apps/arena-client/src/components/UpdateAvailableBanner.test.ts` — **new**
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** (01.5 play-root wiring host)
- `docs/ai/STATUS.md` — **modified** (deploy-refresh note)
- Governance: `WORK_INDEX.md` (WP-418) + `DECISIONS.md` (**D-24238**) + `EC_INDEX.md`/EC-453 + `docs/05-ROADMAP-MINDMAP.md` node, at execution.

> No `api-endpoints.md` change — `version.json` is a static build asset served from
> the client origin, not an `apps/server` HTTP endpoint (§21 N/A).

---

## Contract

| Key | Value |
|---|---|
| Detection A (proactive) | poll `version.json` (`{ gitSha }`, `cache: 'no-store'`) vs baked `__GIT_SHA__` |
| Detection B (reactive) | `window` `vite:preloadError` ⇒ flag + `preventDefault` (belt-and-suspenders) |
| Compare | `isNewerBuildAvailable(baked, fetched)` — true iff both non-empty and differ |
| Triggers | mount · tab-focus · socket reconnect (`connection.isConnected` false→true) · ~60s backstop |
| Fail-soft | a failed / missing `version.json` fetch ⇒ `null` ⇒ no flag; never a false positive |
| Banner | renders iff `updateAvailable`; glyph + text; **Refresh now** (`location.reload()`) + dismiss |
| Reload posture | user-initiated only; never auto-reload mid-turn |
| Mount host | `PlayViewport.vue` (D-16501 play-root, 01.5 wiring) |
| Layer | pure arena-client; no runtime `registry`/`server` import; no new npm dep |

---

## Acceptance Criteria

1. `isNewerBuildAvailable` returns true only when the fetched sha differs from the baked sha and both are non-empty (asserted, incl. the fail-soft empty/undefined cases) (**AC-1**).
2. The build emits a `version.json` carrying the same short git sha as `__GIT_SHA__` (**AC-2**).
3. When the fetched `version.json` sha differs from the baked sha, the `UpdateAvailableBanner` renders on the play surface with a working **Refresh now** button that calls `location.reload()` (**AC-3**).
4. A `vite:preloadError` (or a rejected dynamic import) also surfaces the banner (**AC-4**).
5. The banner never gates a move and never auto-reloads; a failed version fetch shows nothing (**AC-5**).
6. The check re-runs on tab-focus and on socket reconnect (asserted at the composable level) (**AC-6**).
7. `pnpm --filter @legendary-arena/arena-client test` green; `pnpm -r build` clean; `pnpm -r --no-bail test` green repo-wide (**AC-7**).
8. No files outside this WP's `## Files Expected to Change` modified; no `lagn-v1.json` schema drift (**AC-8**).

---

## Verification Steps

```pwsh
pnpm -r build                                           # emits apps/arena-client/dist/version.json
Get-Content apps\arena-client\dist\version.json          # { "gitSha": "<short sha>" } == __GIT_SHA__
pnpm --filter @legendary-arena/arena-client typecheck    # 0
pnpm --filter @legendary-arena/arena-client test         # green (deployVersion + composable + banner)
pnpm -r --no-bail test                                   # green repo-wide
Select-String -Path "apps\arena-client\src\composables\useDeployVersionCheck.ts" -Pattern "visibilitychange|vite:preloadError|isConnected"  # all triggers present
Select-String -Path "apps\arena-client\src\pages\PlayViewport.vue" -Pattern "useDeployVersionCheck|UpdateAvailableBanner"                  # wired
git diff --name-only
```

Dev DOM-verify: `pnpm --filter @legendary-arena/arena-client dev`, open `?fixture=mid-turn`,
dispatch `window.dispatchEvent(new Event('vite:preloadError'))` → banner renders; **Refresh now** is keyboard-reachable.

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `version.json` emitted at build with the baked short git sha (AC-2)
- [ ] Composable raises `updateAvailable` on mount / focus / reconnect / backstop / `vite:preloadError`; fail-soft; timer + listeners cleared on unmount
- [ ] Banner renders only when available; **Refresh now** reloads; dismissible; a11y (`role="status"`, glyph+text, keyboard-reachable)
- [ ] No forced/auto reload; no engine/server/registry change; no new npm dep; no runtime `registry`/`server` import
- [ ] `arena-client` typecheck 0 + test green; `pnpm -r build` 0; `pnpm -r --no-bail test` green repo-wide
- [ ] `DECISIONS.md` **D-24238** landed; `WORK_INDEX` (WP-418) + `EC_INDEX`/EC-453 + mindmap node updated; `docs/ai/STATUS.md` note
- [ ] Live-verify (D-24026, operator-pending on deploy): a mid-match deploy surfaces the refresh banner; clicking it recovers the tab
- [ ] No files outside `## Files Expected to Change` were modified; no `lagn-v1.json` schema drift

---

## Vision Alignment

**Vision clauses touched:** §11 (read-only client surface), §14 (observability — the
player is told a new build exists). **Conflict assertion:** No conflict — a read-only
client notice + a user-initiated reload; no scoring / variant / determinism /
persistence change. **Non-Goal check:** NG — no engine or gameplay change.
**Determinism:** none touched (pure client presentation reading a static asset + a
window event).

## Lint Gate Self-Review (00.3)

§1–§21 PASS or N/A-with-reason. Highlights — §5 standard client lane (new lib + composable
+ component + build-config emit + play-root wiring; 4 code + 3 test + 2 wiring files); §8
App boundary (client-origin static asset; no runtime registry/server import; no new npm
dep); §11/§21 N/A (no `apps/server` HTTP endpoint — `version.json` is a static build
asset); §15.1 APPLIES (D-24026 refresh-banner-on-deploy vs silent); §17 §11/§14 (no
conflict). §22 determinism N/A (client presentation).

## Pre-Flight / Copilot (drafter self-review, standard lane)

**Pre-flight: READY.** Dependencies on `main` (`PlayViewport` host, `ConnectionStatusBanner`
precedent, `connection` store, `__GIT_SHA__` define); scope locked; no hard-dep WP in
flight; not a validation-tightening change (strictly additive — no existing test fixture is
invalidated, confirmed by the scaffold: arena-client 1082/0 with the additions).

**Copilot: PASS.** Failure modes pinned: (a) a network blip flashes a false banner →
**fail-soft, `fetchDeployedSha` ⇒ null, AC-5**; (b) a forced reload discards a move →
**user-initiated only, never auto, AC-5 / §Out of scope**; (c) duplicating the resync stack
→ **reuse the `connection` store's reconnect edge, no new socket listener**; (d) a leaked
poll timer keeps node:test alive → **`unref` + unmount clear, AC-6/leak test**; (e) a
stale-bundle white-screen slips through the poll → **`vite:preloadError` catch + preventDefault,
AC-4**; (f) colour-only signal → **glyph + text, a11y AC**.

## Decision (reserved, lands at execution)

Reserves **D-24238**: the play surface detects a newer deployed client build (a build-stamped
`version.json` poll compared against the baked `__GIT_SHA__`, plus a `vite:preloadError`
catch) and offers a **user-initiated** reload via `UpdateAvailableBanner` — because the
reconnect/resync stack (D-24232 / WP-311 / WP-312 / D-24234) re-anchors match state but
**cannot** fix a stale JS bundle, which only a page reload resolves. Detection is fail-soft;
the reconnect re-check reuses the WP-311 `connection` store (no new socket listener); reload
is never automatic mid-turn. Drafted 2026-07-24; not yet landed.
