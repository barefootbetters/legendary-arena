# WP-117 — Client Routing Strategy (Architecture)

**Status:** Draft (stub — pre-lint, pre-pre-flight; decisions marked `[DECISION REQUIRED]` must be resolved before lint-gate self-review)
**Primary Layer:** Governance / Policy (no runtime code; may add a single npm dependency if Option A is chosen)
**Dependencies:** WP-061 (gameplay-client framework lock: Vue 3 + Vite + Pinia) — establishes the SPA stack on which this routing decision sits.

---

## Session Context

Both shipped Vue 3 SPAs (`apps/arena-client` and `apps/registry-viewer`) use ad-hoc Pinia-driven tab-switching for view state — there is no router, no deep-linking, and no shared URL convention. WP-114 (URL-parameterized loadout preview, drafted) and WP-115 (public leaderboard endpoints, drafted) both exert pressure toward shareable URLs. This packet locks the routing posture for both apps before the next URL-bearing feature WP relitigates the choice.

---

## Goal

After this session, both Vue SPAs have a written, governance-anchored routing decision. Specifically:

- A new section `## Client Routing` exists in [docs/02-ARCHITECTURE.md](../../02-ARCHITECTURE.md) and [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) stating, per app, whether `vue-router` is adopted and at what scope.
- `docs/ai/DECISIONS.md` has 2–4 new `D-NNNN` entries (per-app router decision, history mode, deep-link policy, optional shareable-replay-URL policy).
- If Option A (adopt `vue-router`) is chosen for either app: the relevant `apps/*/package.json` is updated with the locked version, and a follow-up implementation WP is referenced for actually wiring routes.
- If Option B (no router) is chosen for either app: the architecture doc explicitly states "no client router; tab state in Pinia" so future WPs do not relitigate.
- `.claude/rules/architecture.md` import-rules table (Vue layer rows for `apps/arena-client` and `apps/registry-viewer`) is updated if `vue-router` is added to the allowed-imports list.

This WP commits the *decision*; route-table wiring, router guards, and deep-link parsers are deferred to a future implementation WP.

---

## Vision Alignment

> §17 trigger surfaces: §17.1 list does not include "client routing" directly. **However**, if shareable replay URLs are within scope of `[DECISION REQUIRED] D-NNN04`, §17.1 #2 (Replays — Vision §18, §22, §24) is triggered. The packet author resolves §17 N/A or applicable based on D-NNN04 choice.
>
> **Provisional N/A justification (overwrite at lint time):** This WP locks the *routing mechanism*, not any particular feature using it. Replay-URL exposure, profile pages, and leaderboard pages each remain governed by their own WPs (WP-102 public profile, WP-103 replay storage, WP-115 leaderboard). Those WPs carry the §17 obligation. If D-NNN04 commits to a replay-URL *format* in this WP, §17 must be filled in.

**§20 Funding Surface Gate:** N/A — this WP touches no funding affordances per WP-097 §A/§B/§C. Pure architectural mechanism, no user-visible copy referencing donations or tournament funding.

---

## Assumes

- WP-061 complete: Vue 3 + Vite + Pinia locked for `apps/arena-client`.
- `apps/registry-viewer/package.json` exists and currently has no `vue-router` dependency.
- `apps/arena-client/package.json` exists and currently has no `vue-router` dependency.
- Both apps' current view-state lives in Pinia stores or local component state — confirmed by reading `apps/arena-client/src/stores/uiState.ts` and `apps/registry-viewer/src/App.vue`.
- `docs/ai/DECISIONS.md` exists.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §System Layers` — the Vue SPAs row; confirm exact app names and current capabilities.
- `docs/02-ARCHITECTURE.md` — Tech Stack at a Glance + Package Boundaries — note where the new section will land.
- `apps/arena-client/src/App.vue` and `apps/arena-client/src/stores/uiState.ts` — confirm current view-state mechanism.
- `apps/registry-viewer/src/App.vue` — confirm current tab-switching mechanism (Cards / Themes / Loadout per WP-114).
- `docs/ai/work-packets/WP-114-registry-viewer-url-parameterized-setup-preview.md` — read to understand what WP-114 does with URL params *without* a router; the routing decision must not invalidate WP-114's shipped query-param approach.
- `docs/ai/work-packets/WP-115-public-leaderboard-http-endpoints.md` — read to understand whether WP-115 expects client-side leaderboard pages with deep links.
- `.claude/rules/architecture.md` — find the import-rules table; this is what gets updated if `vue-router` is allowed.
- `docs/ai/REFERENCE/00.6-code-style.md` — applies to any prose written into the architecture doc.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`
- Full file contents for every new or modified file — no diffs, no snippets

**Packet-specific:**
- **No route-table wiring.** This WP commits the decision and (if applicable) installs the package; actual `<router-view>` integration is a separate implementation WP.
- **No deletion of existing URL-param handling.** WP-114's `setupUrlParams.ts` (if landed) must remain functional — the router decision does not retroactively rewrite that surface.
- **One decision per app.** The decision for `apps/arena-client` and the decision for `apps/registry-viewer` may differ; both must be stated explicitly.
- **If `vue-router` is adopted:** version is locked at draft time, history mode (`createWebHistory` vs `createWebHashHistory`) is committed, the dependency is added in `dependencies` (not `devDependencies`).
- **If no router:** the architecture doc explicitly states "no client router; tab state in Pinia" with the reasoning so future WPs do not relitigate.

**Session protocol:**
- If any `[DECISION REQUIRED]` block cannot be resolved, STOP and ask.

**Locked contract values:**
- N/A for this WP — no engine constants touched.

**Forbidden packages (per `00.3 §7`):**
- No alternative routers (`@vaadin/router`, `vue-class-component` routing helpers, etc.) — if a router is adopted, it is `vue-router` v4.x.

---

## Decision Points (Must be resolved before lint-gate self-review)

### [DECISION REQUIRED] D-NNN01 — `apps/arena-client` router posture
- **Option A:** Adopt `vue-router@4.x`. Routes: `/lobby`, `/match/:matchId`, `/replay/:replayId` (or similar). History mode TBD in D-NNN03.
- **Option B:** No router. Tab state stays in Pinia (`uiState.ts`). No deep links. URL is always `/`.
- **Option C:** Lightweight in-house router (~50 LOC: parse `window.location.pathname`, dispatch to component). Avoid the dependency without losing deep links.
- *Tradeoff:* A is conventional and unblocks shareable URLs but adds 13KB gzipped + a layer of indirection; B is simplest but blocks every future "share this link" feature; C looks elegant but reinvents a wheel that's been solved 1000 times — usually a trap.

### [DECISION REQUIRED] D-NNN02 — `apps/registry-viewer` router posture
- **Option A:** Adopt `vue-router@4.x`. Routes: `/cards`, `/cards/:cardExtId`, `/themes/:themeId`, `/loadout` (with WP-114 query params preserved as router query).
- **Option B:** No router. Tab + query-param approach already in place. Stay.
- **Option C:** As C above.
- *Tradeoff:* Registry-viewer is public-facing (`cards.barefootbetters.com`); Option A enables proper SEO + shareable card links + browser back-button working as expected. Option B is shipped and working; the cost of switching is non-zero.

### [DECISION REQUIRED] D-NNN03 — History mode (only if any router adopted)
- **Option A:** `createWebHistory()` — clean URLs (`/match/abc123`). Requires server-side fallback (every unknown path returns `index.html`).
- **Option B:** `createWebHashHistory()` — hash URLs (`/#/match/abc123`). No server config needed.
- *Tradeoff:* A is the modern default but means `apps/server` (or the static-host config for `cards.barefootbetters.com`) needs SPA fallback; B sidesteps the server config but gives uglier URLs and known SEO + analytics quirks.

### [DECISION REQUIRED] D-NNN04 — Shareable replay URL format (optional; defer if not yet relevant)
- **Option A:** Lock format now (e.g., `/replay/:replayId` with `:replayId` matching the WP-103 replay-storage convention). Triggers §17 Vision Alignment in this WP.
- **Option B:** Defer to whichever WP first exposes a replay UI.
- *Tradeoff:* A prevents drift across multiple feature WPs; B keeps this WP smaller and lets implementation context shape the format.

---

## Scope (In)

### A) Architecture-doc additions
- **`docs/ai/ARCHITECTURE.md`** — modified: add `## Client Routing` section stating per-app decision, history mode (if applicable), and a one-line policy on shareable URLs.
- **`docs/02-ARCHITECTURE.md`** — modified: mirror section. Update the `Tech Stack at a Glance` table to include `vue-router` row (or explicitly list "no client router" under the relevant apps).

### B) Per-app package.json (only if D-NNN01 or D-NNN02 = Option A)
- **`apps/arena-client/package.json`** — modified (only if Option A): add `"vue-router": "^4.x.x"` to `dependencies`.
- **`apps/registry-viewer/package.json`** — modified (only if Option A): add `"vue-router": "^4.x.x"` to `dependencies`.

### C) DECISIONS entries
- **`docs/ai/DECISIONS.md`** — modified: append `D-NNN01..D-NNN03` (and `D-NNN04` if opted in).

### D) Rules update (only if any router adopted)
- **`.claude/rules/architecture.md`** — modified: update the import-rules table to add `vue-router` to the allowed-import list for the relevant app row(s).

### E) STATUS + WORK_INDEX
- **`docs/ai/STATUS.md`** — modified: one-line capability statement.
- **`docs/ai/work-packets/WORK_INDEX.md`** — modified: check WP-117 off.

---

## Out of Scope

- **No `<router-view>` wiring.** Actual integration into `App.vue` is a separate implementation WP.
- **No route guards / per-route auth.** Auth is governed by WP-099 / WP-112; routing posture does not amend the auth model.
- **No SSR.** Vue SPAs remain client-rendered.
- **No Vue 2 / Nuxt / other framework consideration.** Stack is locked at WP-061.
- **No registry-viewer URL-param refactor.** WP-114's query-param approach stays in place even if Option A is chosen for D-NNN02 — refactor is a follow-up WP.
- **No CDN / static-host configuration changes.** If `createWebHistory()` is chosen, the SPA-fallback wiring is a follow-up infra WP.

---

## Files Expected to Change

Maximum file count varies by decision. Worst case (both apps adopt vue-router, D-NNN04 opted in):

- `docs/ai/ARCHITECTURE.md` — **modified** — add `## Client Routing` section
- `docs/02-ARCHITECTURE.md` — **modified** — mirror section + Tech Stack row
- `docs/ai/DECISIONS.md` — **modified** — append D-NNN01..D-NNN04
- `.claude/rules/architecture.md` — **modified** — import-rules table update
- `apps/arena-client/package.json` — **modified** — add vue-router dependency
- `apps/registry-viewer/package.json` — **modified** — add vue-router dependency
- `docs/ai/STATUS.md` — **modified** — capability line
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off

8 files at worst (at the cap). If both apps choose Option B, only 5 files (no package.json changes, no rules update).

---

## Acceptance Criteria

### Architecture doc
- [ ] `docs/ai/ARCHITECTURE.md` contains a `## Client Routing` section
- [ ] The section states the decision for `apps/arena-client` explicitly (Option A, B, or C)
- [ ] The section states the decision for `apps/registry-viewer` explicitly (Option A, B, or C)
- [ ] If any app adopts a router, history mode is stated
- [ ] If neither app adopts a router, the section explicitly says so

### Package.json (conditional)
- [ ] Only modified if Option A chosen for the corresponding app
- [ ] `vue-router` version pinned to a specific minor (e.g., `^4.4.0`), not `*` or `latest`
- [ ] Listed in `dependencies`, not `devDependencies`

### DECISIONS
- [ ] D-NNN01 (arena-client posture) entry exists with chosen option + rationale
- [ ] D-NNN02 (registry-viewer posture) entry exists with chosen option + rationale
- [ ] D-NNN03 (history mode) entry exists if either app adopts a router; otherwise marked N/A in DECISIONS preamble
- [ ] D-NNN04 (replay URL format) — present if opted in; absent if deferred

### Rules
- [ ] If router adopted, `.claude/rules/architecture.md` import-rules row reflects new allowed-import; otherwise unchanged

### Hygiene
- [ ] STATUS + WORK_INDEX updated
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] If `pnpm install` is run, lockfile updates are committed (only if package.json was modified)

---

## Verification Steps

```pwsh
# Step 1 — confirm architecture section
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "^## Client Routing"
# Expected: one match

# Step 2 — per-app decision present in section
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "arena-client|registry-viewer" -Context 0,2
# Expected: matches inside the new section (visual inspection)

# Step 3 — DECISIONS entries
Select-String -Path "docs\ai\DECISIONS.md" -Pattern "^### D-NNN0[1-4]"
# Expected: 2-4 matches depending on opted-in decisions

# Step 4 — package.json conditional
# (only if Option A chosen for arena-client)
Select-String -Path "apps\arena-client\package.json" -Pattern '"vue-router"'
# Expected: one match if Option A; no match if Option B/C

# Step 5 — pnpm install + build (only if package.json changed)
pnpm install
pnpm -r build
# Expected: exits 0

# Step 6 — no test impact (governance-only)
pnpm -r test
# Expected: exits 0; no test count change

# Step 7 — scope check
git diff --name-only
# Expected: only files in ## Files Expected to Change
```

---

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] All `[DECISION REQUIRED]` blocks resolved with chosen option recorded in DECISIONS
- [ ] `pnpm -r build` exits 0 (verifies no broken deps if package.json modified)
- [ ] `pnpm -r test` exits 0 (verifies no regressions)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated with D-NNN01..D-NNN03 (and D-NNN04 if opted in)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-117 checked off with today's date + commit hash
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] Lint-gate self-review passes (including §17 if D-NNN04 opted in, §20 N/A justified)

---

## Lint Self-Review

> To be filled in by the packet author after `[DECISION REQUIRED]` blocks are resolved and before pre-flight invocation.
