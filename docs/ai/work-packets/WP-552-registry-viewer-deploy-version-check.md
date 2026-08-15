# WP-552 — Registry Viewer Deploy Version Check

**Status:** Draft 2026-08-15
**Layer:** App (`apps/registry-viewer`) — single layer
**Depends on:** WP-418 / EC-453 / D-24238 (the arena-client pattern being ported)
**Reserves:** EC-587 · D-24361
**Baseline:** `origin/main` @ `db3100e9460461497d69a12bb4d27f6c2963b37f`
**Lane:** Standard two-session (app-layer only; 6 files).

---

## 1. Goal

Give the Registry Viewer a way to tell an operator their browser is running a
stale bundle, so a shipped-and-deployed change that simply isn't visible stops
looking like a broken feature.

## 2. Assumes

- **WP-418 / EC-453 / D-24238** shipped this exact capability for
  `apps/arena-client`, in four parts:
  `vite.config.ts` `emitVersionJsonPlugin(shortGitSha)` (emits
  `version.json` = `{ gitSha }`, and serves it in dev via `configureServer`),
  `lib/deployVersion.ts` (102 lines — a **pure** `isNewerBuildAvailable` and a
  **fail-soft** `fetchDeployedSha`), `composables/useDeployVersionCheck.ts`
  (151 lines), and `components/UpdateAvailableBanner.vue` (145 lines).
- `arena-client`'s `vite.config.ts` already captures a `gitSha` and defines
  `__GIT_SHA__` (`:131`); the plugin reuses it with **no second git call and no
  new dependency**.
- `registry-viewer` has **none of the four parts**, and
  `cards.legendary-arena.com/version.json` returns the SPA fallback HTML
  (HTTP 200, but it is `index.html`) — no version signal, nothing polling.
- **BUT the sha half is already done.** `apps/registry-viewer/vite.config.ts`
  already captures `gitSha` (`:10-15`, same `execSync` + `catch` guard as
  arena-client) and defines `__GIT_SHA__` (`:24`); `src/env.d.ts:5` declares it
  and `src/components/branding/VersionBadge.vue:3` already consumes it. **Only
  the emit plugin and its registration are new** — do not add a second capture.
- **Category note (D-13807).** `apps/registry-viewer` is classified `docs-app`
  (`02-CODE-CATEGORIES.md:72`), whose named failure mode is "static-build
  determinism breaks (timestamps, git info embedded in output)" — which is
  literally what this WP emits. It is nonetheless in-bounds: the viewer ALREADY
  ships `__GIT_SHA__` and `__BUILD_TIMESTAMP__` via `vite.config.ts:22-24` and
  renders them in `VersionBadge.vue`, so this is an existing build-**identity**
  stamp, not content, and the precedent is in the same file. Note the port
  crosses categories — arena-client is `client-app` — and `docs-app`
  additionally bans `Date.now()` / `performance.now()` in render paths; none of
  the three ported files uses either, so the port is clean.
- `scripts/wait-for-spa-deploy.mjs` already consumes `version.json` as a deploy
  signal — a second app emitting the same shape is consistent with existing
  tooling, though wiring that script to the viewer is **out of scope** here.
- **Sequencing with WP-551.** Both were drafted in one SPEC PR and both touch
  `apps/registry-viewer`. Their **code files are disjoint** (`vite.config.ts` / `App.vue` / new `lib/` + `composables/` + `components/` files vs
  `LoadoutBuilder.vue` + a new `lib/` helper), so they may execute in either order — but they share five
  governance files (`DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`,
  `05-ROADMAP-MINDMAP.md`) and both run `pnpm roadmap:counts:write`. Execute
  **sequentially**; the second to land rebases onto the first, re-anchors its
  `DECISIONS.md` append on the newly-landed prior entry, and re-runs
  `roadmap:counts:write` (a stale derived count reddens the Dashboard gate and
  reads like an unrelated coverage failure).

## 3. Context

Cost a full verification round-trip on 2026-08-15. WP-549 shipped and deployed
correctly — the origin served `index.html` → `index-C58OP4UJ.js` containing the
fix, with `Cache-Control: max-age=0, must-revalidate` and
`cf-cache-status: DYNAMIC`, so this was **not** the CDN-poisoning pattern from
`reference_cdn_edge_cache_poisoning_blank_screen`. But the operator's browser
held a pre-fix bundle, and the new control simply wasn't there. Two exchanges
were spent — and a `curl` of the deployed bundle — before the fix could be shown
live and the staleness traced to the browser.

The viewer had no way to say *"you are looking at an old build."* arena-client
has said exactly that since WP-418. This is the same failure class, one app
short.

**Why port rather than extract.** The tempting move is to lift the four pieces
into a shared package both apps consume. **Rejected:** `registry-viewer` is only
the **second** consumer, and `.claude/rules/code-style.md §Abstraction` is
duplicate-first / abstract-on-third. A shared package would also have to
straddle two apps' differing Vite configs and banner styling for no present
benefit. Extract when a **third** app needs it.

**Not a deploy-pipeline change.** This adds *detection*, not new deploy
behaviour. Nothing about how the viewer builds or publishes changes.

## 4. Scope (In)

- Emit a build-stamped `version.json` (`{ gitSha }`) from the viewer's Vite
  build, and serve it in dev — mirroring `emitVersionJsonPlugin`.
- A pure comparison helper plus a **fail-soft** fetch.
- A composable that polls, and a dismissible banner offering a reload. **The
  composable is NOT a verbatim copy:** arena-client's imports
  `useConnectionStore` (`:31`, `:64`) and adds a reconnect-triggered re-check
  (`:131-138`). `apps/registry-viewer/src/stores/` **does not exist** — the
  viewer has no socket and no boardgame.io connection — so that trigger is
  dropped. The viewer variant keeps the interval poll and the window-focus
  re-check and nothing else; it will be materially shorter than 151 lines.
- Tests for the comparison truth table and every fail-soft path, at the **pure
  helper** level only — see the Test-level note in §8.

## 5. Scope (Out)

- **No change to `apps/arena-client`.** Its copy stays exactly as WP-418 shipped
  it; this WP does not refactor, share, or touch it.
- **No shared package extraction** — see §3. Duplicate-first stands until a
  third consumer.
- No engine, server, registry, or `packages/lagn-spec` change.
- No change to deploy configuration, Cloudflare Pages settings, cache headers,
  or `scripts/wait-for-spa-deploy.mjs`.
- **No service worker** and no forced auto-reload. The banner offers; the
  operator decides.
- No telemetry or reporting of stale-bundle occurrences.

## 6. Files Expected to Change

| File | Change |
|---|---|
| `apps/registry-viewer/vite.config.ts` | add the emit plugin + register it. **The `gitSha` capture and `__GIT_SHA__` define already exist (`:10-15`, `:24`) — reuse them, do not re-add** |
| `apps/registry-viewer/src/lib/deployVersion.ts` | **new** — pure `isNewerBuildAvailable` + fail-soft `fetchDeployedSha` |
| `apps/registry-viewer/src/lib/deployVersion.test.ts` | **new** — truth table + fail-soft paths |
| `apps/registry-viewer/src/composables/useDeployVersionCheck.ts` | **new** — the poll |
| `apps/registry-viewer/src/components/UpdateAvailableBanner.vue` | **new** — the reload prompt |
| `apps/registry-viewer/src/App.vue` | mount the banner |

`01.5` runtime wiring: none anticipated — the plugin's only input (`gitSha`)
already exists in the file.

## 7. Contract

**`version.json`** — served from the page origin at `/version.json`, body
`{ "gitSha": "<short sha>" }`, matching the `__GIT_SHA__` baked into the bundle.
Emitted at build **and** served in dev, so the poll path is exercisable without
a build.

**`isNewerBuildAvailable`** — pure, dependency-free, unit-testable in isolation.

**`fetchDeployedSha`** — **fail-soft by contract**: any error, a missing file,
a non-200, or an unparseable body resolves to "no signal". A network blip must
**never** produce a false "update available". This is the load-bearing property
— a banner that cries wolf is worse than no banner.

**The banner** is advisory and dismissible; it never force-reloads.

## 8. Acceptance Criteria

> **Test-level note (locked).** `apps/registry-viewer` has **no SFC/component
> test harness** — its test script is `node --import tsx --test "src/**/*.test.ts"`
> with no `@vue/test-utils`, no `jsdom`, no `vue-sfc-loader`, no `src/testing/`,
> and no test that controls time. arena-client tests its composable with
> `mount()` + fake timers + a `jsdom-setup` that installs a `__GIT_SHA__` global.
> Building that here would add two files and a `package.json` edit to a WP that
> claims six. **So testing is scoped to `deployVersion.ts` only** — the
> `globalThis.fetch` stub pattern already used by `cardTypesClient.test.ts:17-37`
> covers every AC-3 path. Two consequences, both locked:
>
> 1. `isNewerBuildAvailable` takes `bakedSha` as a **required parameter**, never
>    defaulting to `__GIT_SHA__` — a default would throw
>    `ReferenceError: __GIT_SHA__ is not defined` under `node --test`, since
>    Vite's `define` does not apply there.
> 2. The composable and banner have **no unit coverage**; they are gated by the
>    D-24026 live-verify. This is the same accepted gap shipped WP-549 took for
>    its own `.vue` wiring. **Do not build a component-test harness for this WP.**

- **AC-1** A production build emits `dist/version.json` whose `gitSha` matches
  the bundle's baked `__GIT_SHA__` — and it is **real JSON**, not the SPA
  fallback HTML.
- **AC-2** `isNewerBuildAvailable` truth table: same sha → false; different sha
  → true; missing/empty either side → false.
- **AC-3** `fetchDeployedSha` returns no-signal on each of: network rejection,
  404, non-JSON body, JSON without `gitSha`.
- **AC-4** *(D-24026 live-verify, not a unit test)* The banner appears only on a
  genuinely newer sha and never on an AC-3 path.
- **AC-5** *(D-24026 live-verify)* The banner never auto-reloads; dismissing it
  does not re-prompt for the same sha.
- **AC-6** `apps/arena-client` is untouched — `git diff --name-only` shows no
  file under it.
- **AC-7** `pnpm --filter registry-viewer test` + `typecheck`, `pnpm -r build`
  and `pnpm -r --no-bail test` exit 0.

## 9. Verification Steps

1. `pnpm install && pnpm -r build` first, then `pnpm --filter registry-viewer test`
   — record the pre-change count. **The filter is `registry-viewer`.**
2. `node -e "JSON.parse(require('fs').readFileSync('apps/registry-viewer/dist/version.json','utf8'))"`
   — must parse, and must not be HTML.
3. `pnpm --filter registry-viewer dev`, then fetch `/version.json` — the dev
   middleware must serve the same body.
4. Post-deploy: `curl -s https://cards.legendary-arena.com/version.json` must
   return JSON, not the SPA fallback.

## 10. Definition of Done

- AC-1..AC-7 pass.
- D-24361 landed (Active); STATUS, WORK_INDEX, EC_INDEX flipped; mindmap
  `📝` → `✅` + `pnpm roadmap:counts:write`.
- Commit topology: `EC-587:` + `SPEC:`.
- `User-Visible Surface = the Registry Viewer (cards.legendary-arena.com)` —
  **D-24026 live-verify required**: after deploy, `curl` `/version.json` returns
  JSON; then confirm an intentionally-stale tab surfaces the banner.

## Gate Record (Phase 1)

| Gate | Verdict | Notes |
|---|---|---|
| Pre-flight (`01.4`) | **READY TO EXECUTE** (2026-08-15) | Round 1 NOT READY on three blockers. PS-1: "registry-viewer is missing all four parts" was **false** — `vite.config.ts` already captures `gitSha` (`:10-15`) and defines `__GIT_SHA__` (`:24`), with `env.d.ts:5` declaring it and `VersionBadge.vue:3` already consuming it; executed literally the file table would have produced a duplicate `let gitSha`. Only the emit plugin is new. PS-2: the composable is **not** a verbatim 151-line port — arena-client's hard-imports `useConnectionStore` and watches reconnect, but `apps/registry-viewer/src/stores/` does not exist; the viewer variant keeps the interval poll + focus re-check and drops the reconnect watch. PS-3: the test story required infrastructure this app lacks entirely (no `@vue/test-utils`, `jsdom`, `vue-sfc-loader`, `src/testing/`, or any fake-timer use), and a `bakedSha = __GIT_SHA__` default would throw `ReferenceError` under `node --import tsx --test` since Vite's `define` does not apply — testing is now scoped to `deployVersion.ts` with `bakedSha` a required parameter, and the composable/banner are an accepted live-verify-only gap (the WP-549 precedent). |
| | | Verified clean: the WP-418 pattern exists exactly as cited (102/151/145 lines, `__GIT_SHA__` at `arena-client/vite.config.ts:131`), and `scripts/wait-for-spa-deploy.mjs` is fully parameterized by `--url`/`--sha`, so a second app emitting `version.json` cannot confuse it. |
| Copilot (`01.7`) | **RISK → resolved** (2026-08-15) | Same cross-WP coupling finding as WP-551 — sequential-execution note added to both WP §2 and both EC Before-Starting blocks. |
| Lint gate (`00.3`) | **PASS** | All 21 sections resolved; §17 triggered (Registry Viewer public surface) and answered in `## Vision Alignment`. |

## Vision Alignment

Required by `00.3 §17.1` — this touches a **Registry Viewer
(cards.legendary-arena.com) public surface (Vision §10a)**.

**Vision clauses touched:** §10a (Registry Viewer).

**Conflict assertion:** *No conflict: this WP preserves all touched clauses.*
Vision §10a names the viewer as "a living smoke test for the R2 data pipeline
and content-as-data architecture." A smoke test the operator may be viewing a
stale copy of is a weakened smoke test; telling them so strengthens the clause.
The banner adds a dismissible notice and removes no existing capability.

**Non-Goal proximity check:** none of NG-1..NG-7 are crossed. No monetization,
no gating, no paid surface, no mechanical advantage. The banner is not
persuasive or commercial — it is a staleness notice, dismissible, with no
auto-reload.

**Determinism preservation:** N/A per §17.2's trigger — no scoring, replay, RNG,
or simulation surface. `version.json` reports a build identity and never
participates in gameplay.

## Lint Gate Self-Review (`00.3`, 21 sections)

| § | Title | Verdict |
|---|---|---|
| 1 | Work Packet Structure | PASS |
| 2 | Non-Negotiable Constraints Block | PASS — §5 + EC Guardrails (no arena-client edit, no extraction, fail-soft) |
| 3 | Prerequisites (`## Assumes`) | PASS — §2, WP-418 shipped, file sizes cited |
| 4 | Context References | PASS — §3 cites the live round-trip and the origin headers proving it wasn't CDN |
| 5 | Output Completeness | PASS — §6, six files |
| 6 | Naming Consistency | PASS — names mirror the WP-418 originals exactly |
| 7 | Dependency Discipline | PASS — WP-418 complete |
| 8 | Architectural Boundaries | PASS — `apps/registry-viewer` only; arena-client explicitly out |
| 9 | Windows Compatibility | PASS — no new shell/path work; the git-sha capture reuses arena-client's approach |
| 10 | Environment Variable Hygiene | N/A — no env read; the sha comes from the build |
| 11 | Authentication Clarity | N/A — public unauthenticated surface |
| 12 | Test Quality | PASS — AC-2..AC-5; baseline recorded in §9 step 1 |
| 13 | Commands and Verification | PASS — §9, incl. the dist and dev-middleware checks |
| 14 | Acceptance Criteria Quality | PASS — AC-1 pins "real JSON, not the SPA fallback", the exact trap this WP exists to detect |
| 15 | Definition of Done | PASS — §10 |
| 15.1 | User-visible verification (D-24026) | PASS — §10, post-deploy curl + stale-tab check |
| 16 | Code Style | PASS — pure comparison split from the fetch, per the WP-418 original; no premature abstraction (§3 rejects extraction) |
| 17 | Vision Alignment | PASS — the section above, clause §10a |
| 18 | Prose-vs-Grep Discipline | PASS — no grep-based gate whose token appears in prose |
| 19 | Bridge-vs-HEAD Staleness | PASS — baseline SHA pinned in the header |
| 20 | Funding Surface Gate | N/A |
| 21 | API Catalog Update (D-11804) | N/A — `version.json` is a static build asset served by Pages, not an `apps/server` HTTP endpoint or library function |
