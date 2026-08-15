# EC-587 — Registry Viewer Deploy Version Check (Execution Checklist)

**Source:** docs/ai/work-packets/WP-552-registry-viewer-deploy-version-check.md
**Layer:** App (`apps/registry-viewer`) — single layer

## Before Starting (Hard Gate — run each; STOP if any fails)
- [ ] **Sequencing:** this WP and WP-551 were drafted in one SPEC PR. Their code files are DISJOINT (either order is fine) but they share five governance files plus `pnpm roadmap:counts:write` — execute **sequentially, never in parallel worktrees**. If the other landed first, rebase onto it, re-anchor this WP's `DECISIONS.md` append on the newly-landed entry, and re-run `roadmap:counts:write` before committing
- [ ] `pnpm install` then `pnpm -r build` in this worktree **first** — a fresh worktree has no `node_modules` / `dist`, and an absent `dist` reports as failing tests
- [ ] Baseline green + **record the count**: `pnpm --filter registry-viewer test` exit 0. The filter is **`registry-viewer`**, NOT `@legendary-arena/registry-viewer` (that name matches no project and exits 1)
- [ ] The pattern being ported exists: `ls apps/arena-client/src/lib/deployVersion.ts apps/arena-client/src/composables/useDeployVersionCheck.ts apps/arena-client/src/components/UpdateAvailableBanner.vue` → all three present
- [ ] `grep -n "emitVersionJsonPlugin" apps/arena-client/vite.config.ts` → present (the plugin to mirror), and `grep -n "__GIT_SHA__" apps/arena-client/vite.config.ts` → present (how the sha is baked)
- [ ] The viewer genuinely lacks the PLUGIN: `ls apps/registry-viewer/src/lib/deployVersion.ts` → does not exist, and `grep -c "version.json" apps/registry-viewer/vite.config.ts` → **0**
- [ ] …but ALREADY HAS the sha half — confirm before writing any config: `grep -n "__GIT_SHA__" apps/registry-viewer/vite.config.ts` → **present** (`:24`), and `grep -n "git rev-parse" apps/registry-viewer/vite.config.ts` → **present** (`:13`). Re-adding either produces a duplicate `let gitSha` or a no-op diff
- [ ] **Read `apps/arena-client/src/lib/deployVersion.ts` in full before writing anything.** It is 102 lines and its fail-soft contract is the load-bearing part

## Locked Values (do not re-derive)
- **Emitted asset:** `version.json` at the build-output root, body exactly `{"gitSha":"<short sha>"}` — same shape arena-client emits and `scripts/wait-for-spa-deploy.mjs` already consumes. Do not add fields.
- **Fetched from the page origin** at `/version.json` — the viewer's own asset, never the API server. Cache-bust the poll; the dev middleware sets `Cache-Control: no-store`.
- **`fetchDeployedSha` is FAIL-SOFT BY CONTRACT.** Any of: network rejection, non-200, 404, non-JSON body, or JSON lacking `gitSha` ⇒ **no signal**. Never throw, never surface an error to the user, never treat an unreadable response as "changed". A banner that cries wolf is worse than no banner.
- **`isNewerBuildAvailable` is PURE** — no fetch, no Vue, no I/O; unit-testable in isolation. Missing/empty sha on either side ⇒ `false`.
- **The banner is advisory:** dismissible, never auto-reloads, and does not re-prompt for a sha already dismissed. **Dismissal is IN-TAB PRESENTATION STATE ONLY** — no `localStorage`, no `sessionStorage`, no `src/prefs/` wiring. `02-CODE-CATEGORIES.md:390` permits a `docs-app` localStorage "for view preferences only", which makes persisting it a *defensible* misreading; it is forbidden here because it would drag non-allowlisted files in and change the semantics across tabs. arena-client keeps it local (`UpdateAvailableBanner.vue:36-37`).
- **The composable is NOT a verbatim 151-line copy.** arena-client's imports `useConnectionStore` (`:31`, `:64`) and watches `connection.isConnected` to re-check on reconnect (`:131-138`). `apps/registry-viewer/src/stores/` **does not exist** — no socket, no boardgame.io connection. The viewer variant **KEEPS** the interval poll and the window-focus re-check; it **DROPS** the reconnect watch and the store import entirely. Do NOT introduce pinia or a store to make the copy literal.
- **`isNewerBuildAvailable` takes `bakedSha` as a REQUIRED parameter** — never `= __GIT_SHA__` as a default. Vite's `define` does not apply under `node --import tsx --test`, so a default throws `ReferenceError: __GIT_SHA__ is not defined` the moment a plain `.ts` test imports the module.
- **Reuse the build's existing sha capture.** `apps/registry-viewer/vite.config.ts` ALREADY captures `gitSha` (`:10-15`) and defines `__GIT_SHA__` (`:24`); `src/env.d.ts:5` declares it and `VersionBadge.vue:3` consumes it. **Only the plugin + its registration are new** — no second git invocation, no new dependency, no second capture.
- **DECISIONS reservation:** **D-24361**.

## Guardrails
- **Do NOT touch `apps/arena-client/**`.** Its copy stays exactly as WP-418 shipped it. Any diff under that path is out of scope.
- **Do NOT extract a shared package.** registry-viewer is the SECOND consumer; `.claude/rules/code-style.md §Abstraction` is duplicate-first / abstract-on-third. Extract at a third.
- Do NOT add a service worker, and do NOT force an automatic reload.
- Do NOT change deploy config, Cloudflare Pages settings, cache headers, or `scripts/wait-for-spa-deploy.mjs`.
- Do NOT add telemetry or report stale-bundle occurrences anywhere.
- Do NOT touch `apps/server`, `packages/game-engine`, `packages/registry`, or `packages/lagn-spec`.
- **Poll interval (locked literal): `60_000` ms**, copied from `apps/arena-client/src/composables/useDeployVersionCheck.ts:38` (`DEPLOY_VERSION_POLL_MS`). Do not invent a tighter cadence; do not leave it to be re-derived from a file the gates never require opening.
- **The composable mirrors arena-client's lifecycle shape** — `onMounted` / `onUnmounted` (`useDeployVersionCheck.ts:106`, `:140`), NOT a lifecycle-free `start()/stop()` pair. This matters: `apps/registry-viewer/src/composables/` DOES unit-test composables directly (`useLoadoutDraft.test.ts:28` calls `useLoadoutDraft()` with no mount), so a lifecycle-free shape would look trivially testable and tempt an executor into adding a test file outside the allowlist. The no-unit-test rule below follows from the shape, not from a blanket claim about the app.
- **Testing is scoped to `deployVersion.ts` ONLY.** `apps/registry-viewer` has no `@vue/test-utils`, no `jsdom`, no `vue-sfc-loader`, no `src/testing/`, and no test that controls time; arena-client's composable test needs `mount()` + fake timers + a `jsdom-setup` installing a `__GIT_SHA__` global. **Do NOT build that harness here** — it would add two files and a `package.json` edit to a 6-file WP. Use the existing `globalThis.fetch` stub pattern (`cardTypesClient.test.ts:17-37`) for every fail-soft path, and accept the composable/banner as a live-verify-only gap (the same trade shipped WP-549 made for its own `.vue` wiring).

## Required `// why:` Comments
- On the emit plugin: cite D-24361 — the viewer had no staleness signal, and on 2026-08-15 a correctly-deployed WP-549 change was invisible to an operator on a cached bundle (origin served the fix with `max-age=0, must-revalidate` and `cf-cache-status: DYNAMIC`, so this was browser-side, not the CDN-poisoning pattern).
- On `fetchDeployedSha`'s fail-soft branches: a network blip must never produce a false "update available"; no-signal is always the safe answer.
- On duplicating rather than importing arena-client's copy: second consumer, duplicate-first per §Abstraction; extract at a third.

## Files to Produce
- `apps/registry-viewer/vite.config.ts` — **modified** — the emit plugin + its registration ONLY. The `gitSha` capture (`:10-15`) and `__GIT_SHA__` define (`:24`) already exist — reuse them
- `apps/registry-viewer/src/lib/deployVersion.ts` — **new** — pure comparison + fail-soft fetch
- `apps/registry-viewer/src/lib/deployVersion.test.ts` — **new** — truth table + every fail-soft path
- `apps/registry-viewer/src/composables/useDeployVersionCheck.ts` — **new**
- `apps/registry-viewer/src/components/UpdateAvailableBanner.vue` — **new**
- `apps/registry-viewer/src/App.vue` — **modified** — mount the banner
- `docs/ai/DECISIONS.md` (D-24361 → Active) · `docs/ai/STATUS.md` · `WORK_INDEX.md` · `EC_INDEX.md` · `docs/05-ROADMAP-MINDMAP.md` (WP-552 `📝` → `✅` + `roadmap:counts:write`)

## After Completing
- [ ] **AC-1 (the trap this WP exists to catch):** after `pnpm --filter registry-viewer build`, `node -e "const v=JSON.parse(require('fs').readFileSync('apps/registry-viewer/dist/version.json','utf8')); if(!v.gitSha) process.exit(1)"` → exit 0. If it throws a JSON parse error the file is the SPA fallback HTML, which is exactly the pre-fix symptom
- [ ] AC-2: `isNewerBuildAvailable` truth table — same / different / missing either side
- [ ] AC-3: every fail-soft path returns no-signal — network rejection, 404, non-JSON body, JSON without `gitSha`. Note `cardTypesClient.test.ts` demonstrates only the 404 and bad-schema shapes; the other two are reachable through the same `stubFetch` (its handler returns a promise, so a rejection propagates; `json: async () => { throw … }` covers non-JSON) — you are extending the pattern, not inventing one
- [ ] AC-4 / AC-5 are **live-verify**, not unit tests — the composable and banner have NO unit coverage by design (see the Testing guardrail); confirm them on the deployed viewer
- [ ] AC-6 + scope gate — **range-scoped, allowlist-exact** (a bare `git diff --name-only` lists only UNSTAGED changes and passes vacuously once you commit; and `grep` exiting 1 on "empty" reads as failure in a chained shell, so run it standalone): `git diff --name-only origin/main...HEAD` must equal exactly `vite.config.ts`, `src/lib/deployVersion.ts`, `src/lib/deployVersion.test.ts`, `src/composables/useDeployVersionCheck.ts`, `src/components/UpdateAvailableBanner.vue`, `src/App.vue` (all under `apps/registry-viewer/`) plus the five governance files — and **no path under `apps/arena-client/`**
- [ ] `pnpm --filter registry-viewer test` + `typecheck` + `pnpm -r build` + `pnpm -r --no-bail test` exit 0
- [ ] STATUS/WORK_INDEX/EC_INDEX flipped; ROADMAP `✅` + counts refreshed; D-24361 landed (Active)
- [ ] Commit prefix `EC-587:` + `SPEC:`
- [ ] D-24026 live-verify recorded as pending: post-deploy `curl -s https://cards.legendary-arena.com/version.json` returns JSON (not HTML), and a deliberately-stale tab shows the banner

## Common Failure Smells
- `dist/version.json` parses as HTML → the asset was not emitted and the SPA fallback answered; the plugin's `generateBundle` did not run for this build.
- The banner fires on first load with no deploy → your comparison treats a no-signal fetch as "changed"; no-signal must be `false`.
- The banner fires during local dev on every reload → the dev middleware body and the baked `__GIT_SHA__` disagree; both must come from the same captured sha.
- A test needs the network → the pure comparison must be testable with no fetch at all; if it isn't, the split is wrong.
- You edited `apps/arena-client` "to share the helper" → out of scope, and the extraction is explicitly rejected until a third consumer.
- `pnpm --filter @legendary-arena/registry-viewer test` reports "No projects matched" → wrong filter name; it is `registry-viewer`.
