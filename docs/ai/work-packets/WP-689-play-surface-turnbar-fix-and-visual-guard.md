# WP-689 — Play-Surface TurnActionBar Overlap Fix + Playwright Visual-Regression Guard

**Status:** Ready
**Primary Layer:** App (`apps/arena-client`) presentation for the fix + **Shared Tooling** (a Playwright devDependency + a runnable visual check) for the guard + ewiki docs. **Zero engine / registry / server / determinism / persistence footprint.**
**User-Visible Surface:** `play.legendary-arena.com` — the desktop play surface (`<PlayDesktop>`). The fix is directly observable; the guard is a dev/test artifact.

> Baseline: re-baseline to current `origin/main` at execution and cite `git rev-parse origin/main`.

---

## Session Context

WP-688 / EC-725 / D-24505 (#1992) made `<PlayDesktop>` fit the 1280×720 floor by wrapping the board in a `transform: scale()` fit stage (`.play-desktop__stage`, `position: absolute`). A **full-resolution 1280×720 Playwright screenshot taken after merge** revealed a regression the browser pane's downscaled (~800px) preview hid during WP-688 live-verify: the `TurnActionBar` (`position: sticky; bottom: 0; z-index: 100`) **lifts out of place and overlaps the cockpit** — the "PLAYED THIS TURN" row, the economy readout, and the Your Victory Pile all render *behind* the floating turn bar. Root cause: a `position: sticky` element inside a `transform`ed, absolutely-positioned ancestor resolves its sticky containing block against that transformed ancestor, so `bottom: 0` pins it mid-stage instead of at the page bottom. This WP fixes that **and** adds a Playwright visual-regression guard so a full-resolution overlap can no longer slip past a downscaled preview.

---

## Goal

After this session: (1) the `TurnActionBar` sits in normal flow at the bottom of the cockpit on the desktop fit stage — no overlap with the played / economy / victory zones, at every supported width; (2) the repo carries a **runnable Playwright visual-regression guard** for the desktop play surface that asserts the D-24505 fit invariants (no page scroll in either axis; the turn bar is below the cockpit, not overlapping it; the board fits its container) at 1280×720 / 1366×768 / 1920×1080 and captures the full-resolution frames as artifacts; (3) Playwright + the check are documented on the ewiki (`wiki/testing.md`) as the play-surface visual-verification step, and Playwright is adopted as an `apps/arena-client` **devDependency** under the Shared-Tooling posture. No engine/registry/server change; no `<PlayMobile>` change; no CI gate is added in this WP (CI-wiring is a documented follow-on).

---

## User-Visible Impact

On the desktop play surface, the phase-step / Pass-priority / Heal-Wounds bar sits cleanly at the bottom of your cockpit again; the played-this-turn row, the Attack/Recruit economy, and your victory-pile summary are fully visible instead of being covered by the floating bar. No other visible change.

---

## Assumes

- WP-688 / EC-725 / D-24505 is on `main`: `apps/arena-client/src/pages/PlayDesktop.vue` renders `.play-desktop__stage` (`position: absolute; transform: scale(var(--play-fit-scale))`) wrapping the board, with `TurnActionBar` at the bottom of `.play-desktop__main`.
- `apps/arena-client/src/components/play/TurnActionBar.vue` styles `.turn-action-bar` as `position: sticky; bottom: 0; z-index: 100` (the sticky is the overlap cause inside the scaled stage).
- `apps/arena-client/package.json` has a `preview` script (`vite preview`) — the visual guard runs against a built preview server for stability (per the tooling-recon of `main`).
- No Playwright / e2e / visual-regression setup exists anywhere in the repo today (Playwright appears only as a *detector string* in `scripts/architecture-inventory.mjs`).
- `.claude/rules/architecture.md` Shared-Tooling layer: dev/test tooling lives in `apps/*` **devDependencies** only, never production `dependencies`.
- `pnpm -r build` exits 0 and `pnpm --filter @legendary-arena/arena-client typecheck` passes on the baseline.

If any of the above is false, this packet is **BLOCKED**.

---

## Context (Read First)

- `docs/ai/DECISIONS.md` — **D-24505** (the fit mechanism; this WP fixes a corollary defect + guards it), **D-24502** (the geometry locks), **D-12909** (the 767 split, untouched).
- `apps/arena-client/src/pages/PlayDesktop.vue` — the `.play-desktop__stage` scoped `<style>` where the `:deep(.turn-action-bar)` override lands.
- `apps/arena-client/src/components/play/TurnActionBar.vue` — read the `.turn-action-bar` sticky rule (do NOT edit it — the override is stage-scoped so the bar keeps sticky behavior anywhere else it is used).
- `apps/arena-client/package.json` — `dev` / `build` / `preview` / `test` scripts; devDependencies (jsdom, @vue/test-utils, vue-sfc-loader — the Shared-Tooling precedent Playwright joins).
- `wiki/testing.md` + `wiki/SCHEMA.md` — the canonical Testing guide (docs home) and its front-matter / section rules.
- `.claude/rules/architecture.md §Layer Boundary` — the Shared-Tooling devDeps-only rule.
- `scripts/architecture-inventory.mjs` — reads package.json to detect adopted tooling (already lists `playwright`); the committed report `wiki/architecture-inventory.md` refreshes via the weekly cron with `--external`, so it is **not** hand-edited here.

---

## Non-Negotiable Constraints

**Engine-wide:** full file contents for every new/modified file; ESM only; Node v22+; Vue 3 SFCs; `*.test.ts` for node:test units; human-style code per `00.6`.

**Packet-specific:**
- **Fix is stage-scoped.** Neutralize the sticky ONLY within `.play-desktop__stage` (`:deep(.turn-action-bar){ position: static; }`). Do NOT edit `TurnActionBar.vue` — the bar must keep `position: sticky` anywhere else it renders (e.g. `<PlayMobile>`, which is untouched). A `// why:` / `/* why: */` cites D-24505/D-24506.
- **Playwright is a devDependency, never production.** It goes in `apps/arena-client/devDependencies` (Shared-Tooling posture, like `vue-sfc-loader`/`jsdom`). It must NOT appear in `dependencies` or any production bundle/import.
- **The guard is assertion-based, not pixel-diff.** It asserts geometry invariants (no page scroll in either axis; `.turn-action-bar` does not vertically overlap the played-row / economy / victory zones; `.play-desktop__stage` fits inside `.play-desktop__fit`) and captures the full-res PNG per width as an artifact. No committed golden images / pixel baselines (avoids cross-platform font-render flake).
- **Pure presentation for the fix; no engine surface.** No `G`/`ctx`, no `UIState` field, no persistence, no `finalStateHash`, no HTTP endpoint. The guard reads DOM geometry only.
- **`<PlayMobile>` / `useViewport` / D-12909 untouched.** The fix is desktop-stage-scoped; the guard drives the desktop viewport.
- **No CI gate added here.** The guard is a runnable script + npm script + docs. Wiring it into `ci.yml` (a new Playwright job on the Linux runner) is a documented follow-on — this WP must not add an unverified PR-blocking check.

**Locked values:**
- Fix: `.play-desktop__stage :deep(.turn-action-bar) { position: static; }`.
- Guard viewports: `1280×720`, `1366×768`, `1920×1080`. Route: `?fixture=mid-turn&play=1`. Invariants: `documentElement.scrollHeight <= clientHeight` AND `scrollWidth <= clientWidth` (no page scroll); `turnBar.getBoundingClientRect().top >= cockpitBottom - 1` (turn bar not overlapping the played/economy/victory zones); `.play-desktop__stage` visual box fits within `.play-desktop__fit`.
- Playwright devDep in `apps/arena-client`, invoked by a `test:visual` script; the check runs against `vite preview`.

---

## Scope (In)

### A) Fix — `apps/arena-client/src/pages/PlayDesktop.vue` (**modified**)
- Add, in the `<style scoped>` stage block, `.play-desktop__stage :deep(.turn-action-bar) { position: static; }` with a `/* why: */` explaining the sticky-in-transformed-stage overlap (cite D-24505 / D-24506). No template change; `TurnActionBar.vue` untouched.

### B) Guard — `apps/arena-client/visual/play-surface.visual.mjs` (**new**) + `apps/arena-client/package.json` (**modified**)
- A standalone Playwright script (raw `playwright` lib + `node:assert`, matching the repo's node:test ethos — no new test-runner framework). It launches chromium, and for each locked viewport: navigates the fixture route, waits for `.play-desktop__stage`, asserts the invariants, and writes `visual/__screenshots__/play-desktop-<w>x<h>.png`. Non-zero exit on any failed invariant. Reads a `PLAY_URL` env (default the `preview` port) so it runs against `vite preview`.
- `package.json`: add `playwright` to `devDependencies`; add scripts — `test:visual` (build + preview + run the check + teardown, cross-platform) and a bare `test:visual:run` (the check against an already-running `PLAY_URL`). Screenshots dir gitignored.

### C) Docs — `wiki/testing.md` (**modified**)
- Add a "Play-surface visual regression (Playwright)" subsection under the testing-layers model: what it guards (the D-24505 fit invariants + the turn-bar overlap it caught), how to run it (`pnpm --filter @legendary-arena/arena-client test:visual`, or the two-step preview + `test:visual:run`), the one-time `npx playwright install chromium`, and the expected pass output. Bump `last-reviewed`. SCHEMA-compliant (no new page; a section + date bump).

---

## Out of Scope

- **A CI job for the visual guard** — a new Playwright job on the Linux runner (build → `vite preview` → `playwright install --with-deps chromium` → run) is the recommended follow-on, sketched in `wiki/testing.md`; not added here (must not ship a PR-blocking check unverified on the CI runner).
- **Committed golden/baseline images or pixel-diffing** — the guard is assertion-based.
- **Editing `wiki/architecture-inventory.md`** — it is generated (sole writer `architecture-inventory.mjs`) and refreshes via the weekly cron with `--external`; hand-editing / local regen without the external repo would strip SaaS detections (the contamination trap). Adding Playwright to devDeps makes the next cron regen surface it automatically.
- **`TurnActionBar.vue`, `<PlayMobile>`, `useViewport`, any engine/registry/server file.**
- Refactors not listed in Scope (In).

---

## Files Expected to Change

- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — the stage-scoped `:deep(.turn-action-bar){position:static}` fix.
- `apps/arena-client/visual/play-surface.visual.mjs` — **new** — the Playwright visual-regression guard.
- `apps/arena-client/package.json` — **modified** — `playwright` devDependency + `test:visual` / `test:visual:run` scripts.
- `apps/arena-client/.gitignore` (or the repo root `.gitignore`) — **modified** — ignore the guard's `visual/__screenshots__/` output.
- `wiki/testing.md` — **modified** — the play-surface visual-regression section + `last-reviewed` bump.

Governance (not code): `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24506), `docs/ai/work-packets/WORK_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md`.

`TurnActionBar.vue`, every `<PlayMobile>` file, `useViewport.ts`, `wiki/architecture-inventory.md`, `.github/workflows/**`, and `packages/**` / `apps/server/**` are **NOT** in scope.

---

## Contract

- **Fix:** on the desktop fit stage the `TurnActionBar` is in normal flow (`position: static`), below the cockpit, overlapping nothing. It keeps `position: sticky` everywhere else (`TurnActionBar.vue` unchanged).
- **Guard:** `pnpm --filter @legendary-arena/arena-client test:visual` exits 0 iff, at 1280×720 / 1366×768 / 1920×1080, the fixture play surface has no page scroll (either axis), the turn bar does not overlap the played/economy/victory zones, and the board fits its container; it writes a full-res PNG per width. Playwright is a devDependency only.
- **Invariant:** `<PlayMobile>` and D-12909 are byte-unchanged; the guard drives desktop widths only.

---

## Vision Alignment

**Clauses touched:** §17 (accessibility/readability). **Conflict assertion:** `No conflict` — a bug fix + a test guard improve readability and prevent regressions; no i18n change. **Non-Goal proximity:** NG-1..7 uncrossed (no monetization/pay-to-win). **Determinism:** N/A / preserved — pure presentation + a DOM-geometry test; no engine state (Vision §22).

## Funding Surface Gate

N/A — no funding affordance/channel/copy.

## API Catalog

N/A — no HTTP endpoint, no `apps/server/src/**` library function.

---

## Acceptance Criteria

### Fix
- [ ] On the desktop fit stage at 1280×720, the `TurnActionBar` renders **below** the cockpit and does **not** overlap the played-this-turn row, the economy readout, or the Your Victory Pile (verified by DOM geometry: `turnBar.top >= cockpitBottom - 1`).
- [ ] `TurnActionBar.vue` is **not modified** (`git diff --name-only`); the bar keeps `position: sticky` outside `.play-desktop__stage`.

### Guard
- [ ] `apps/arena-client/visual/play-surface.visual.mjs` exists and, run against a preview server, asserts the locked invariants at all three viewports and writes a PNG per width; a violated invariant exits non-zero.
- [ ] `playwright` is in `apps/arena-client` **devDependencies**, NOT `dependencies` (`git diff` of package.json); `test:visual` + `test:visual:run` scripts present.
- [ ] The screenshot output dir is gitignored (no PNGs committed).

### Docs + gates
- [ ] `wiki/testing.md` has the play-surface visual-regression section (SCHEMA-compliant) + bumped `last-reviewed`.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0; `pnpm --filter @legendary-arena/arena-client test` passes; `pnpm -r build` exits 0.
- [ ] No files outside `## Files Expected to Change` were modified.

---

## Verification Steps

```pwsh
# 1 — build + typecheck + unit suite
pnpm -r build
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: all exit 0 (the fix is CSS-only; no unit test changes needed).

# 2 — the fix, verified by DOM geometry (resolution-independent — the check the
#     downscaled preview could not show). Run the dev/preview server, open
#     ?fixture=mid-turn&play=1 at 1280x720, and confirm in the console:
#       const bar = document.querySelector('.turn-action-bar').getBoundingClientRect();
#       const hand = document.querySelector('[data-testid="play-hand-row"]').getBoundingClientRect();
#       bar.top >= hand.bottom - 1   // => true (bar below the cockpit, no overlap)
#     and documentElement.scrollHeight <= clientHeight (no page scroll).

# 3 — scope + boundary
git diff --name-only
# Expected: only the Files Expected to Change. NO TurnActionBar.vue, NO PlayMobile*,
# NO useViewport.ts, NO wiki/architecture-inventory.md, NO .github/workflows/**.
Select-String -Path "apps\arena-client\package.json" -Pattern '"playwright"'
# Expected: the match is under devDependencies, never dependencies.

# 4 — the Playwright guard (run on a host where chromium can execute; Linux CI or a dev box)
npx playwright install chromium   # one-time
pnpm --filter @legendary-arena/arena-client test:visual
# Expected: exits 0; prints per-viewport {pageScrollsY:false,pageScrollsX:false,
# turnBarOverlaps:false} and writes visual/__screenshots__/play-desktop-1280x720.png etc.
```

---

## Definition of Done

> Run every command in `## Verification Steps` before checking any item.

- [ ] All acceptance criteria pass.
- [ ] The fix is verified by DOM geometry at 1280×720 (turn bar below the cockpit, no overlap, no page scroll) — the resolution-independent check.
- [ ] `pnpm -r build` / arena-client `typecheck` / arena-client `test` all green.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/DECISIONS.md` — **D-24506** landed (the fix corollary to D-24505 + the Playwright-guard adoption).
- [ ] `docs/ai/STATUS.md` updated — the turn-bar overlap fixed; the play-surface visual guard added.
- [ ] `wiki/testing.md` — the visual-regression section present, `last-reviewed` bumped.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-689 checked off with the date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-689 node `📝 → ✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

> **User-Visible Surface = `play.legendary-arena.com`** ⇒ **D-24026 live-verification REQUIRED** for the fix — confirmed by the DOM-geometry check at 1280×720 (the Playwright guard's full-res PNG is the durable evidence, produced on a chromium-capable host).

---

## Lint Gate Self-Review (00.3)

- **§1 Structure** — PASS (all sections; Out of Scope lists ≥2: CI job, golden images, architecture-inventory edit, TurnActionBar/PlayMobile/engine).
- **§2 Constraints** — PASS (stage-scoped fix, devDeps-only Playwright, assertion-not-pixel guard, pure presentation, mobile untouched, no CI gate).
- **§3 Assumes** — PASS (WP-688 on main, TurnActionBar sticky, `preview` script, no existing Playwright, Shared-Tooling rule, green baseline — each cited).
- **§4 Context** — PASS (D-24505/24502/12909 + PlayDesktop.vue + TurnActionBar.vue + package.json + wiki/testing.md + SCHEMA.md + architecture rules + architecture-inventory.mjs).
- **§5 Files** — PASS (5 surfaces: 1 fix + 1 new script + package.json + .gitignore + wiki; TurnActionBar/PlayMobile/useViewport/architecture-inventory/workflows excluded).
- **§6 Naming** — PASS (full-word; `test:visual`, `play-surface.visual.mjs`).
- **§7 Dependency discipline** — PASS with a **declared new dependency**: `playwright` as an `apps/arena-client` **devDependency** under the Shared-Tooling posture (the vue-sfc-loader/jsdom precedent) — justified (it is the only cross-browser layout engine that can verify the fit/overlap invariants the jsdom unit tests cannot), scoped devDeps-only.
- **§8 Architectural boundaries** — PASS (App presentation + Shared-Tooling test tooling; no engine/registry/server/`G`/`UIState`; the guard reads DOM geometry only).
- **§9 Windows** — PASS (pwsh `Select-String` + `git diff`; the `test:visual` orchestration is cross-platform).
- **§10 Env** — the guard reads an optional `PLAY_URL` (documented default); no product env var. N/A for production.
- **§11 Auth** — N/A.
- **§12 Tests** — PASS. The fix is a CSS layout change jsdom cannot assert (no layout engine), so the *test* for it IS the Playwright guard (real layout) + the DOM-geometry live check; the unit suite stays green unchanged. The guard itself is the new test artifact.
- **§13 Verification** — PASS (build/typecheck/test + DOM-geometry fix check + `git diff` scope + the Playwright guard run on a chromium-capable host).
- **§14 Acceptance criteria** — PASS (binary: overlap gone by geometry, TurnActionBar untouched, guard exists + devDeps-only + gitignored screenshots, docs, gates, scope).
- **§15 Definition of Done** — PASS (DECISIONS D-24506 / STATUS / wiki / WORK_INDEX / mindmap + scope; §15.1 D-24026 REQUIRED for the fix, met by the geometry check + the guard PNG).
- **§16 Code style** — PASS (`/* why: */` on the fix citing D-24505/24506; the guard script has JSDoc + `// why:` on the invariants; full-word names).
- **§17 Vision** — PASS (§17.1 accessibility trigger; No conflict; NG-1..7 uncrossed; determinism N/A).
- **§18 Prose-vs-grep** — PASS (the one verification grep — `"playwright"` in package.json — is file-scoped, not a forbidden-token prose grep).
- **§19 Bridge-vs-HEAD** — N/A.
- **§20 Funding** — N/A.
- **§21 API Catalog** — N/A.

**Lint verdict: PASS (all 21 resolved; §7 new devDependency declared + justified + scoped).**

---

## Pre-Flight Verdict (01.4)

**Verdict: READY TO EXECUTE (2026-09-10).**

- **Dependencies:** WP-688 / D-24505 (the fit stage + the bug) on `main`; `preview` script present; no existing Playwright to conflict. App-layer + Shared-Tooling only.
- **Scope lock:** 5 files + governance; `git diff` gate excludes TurnActionBar/PlayMobile/useViewport/architecture-inventory/workflows.
- **Empirical scaffold — N/A.** Not a validation-tightening WP. The fix is CSS; its correctness is a layout assertion verified live (DOM geometry) + by the guard, not by jsdom.
- **Contract fidelity:** the fix (`position: static` in the stage) and the guard invariants are locked; the guard's orchestration details (port, teardown) are implementation, not contract.
- **RS-1 (non-blocking):** the executor cannot run chromium in the drafting/exec environment; the *fix* is verified by resolution-independent DOM geometry there, and the *Playwright guard* is run-verified on a chromium-capable host (documented expected output). This is disclosed, not gamed — no CI gate is claimed green unverified.
- **RS-2 (non-blocking):** `test:visual` cross-platform orchestration (spawn `vite preview`, wait for port, run, teardown) — implementation detail; the split `test:visual:run` (against an already-running `PLAY_URL`) is the fallback if the orchestrator is fiddly on a given OS.
- **PS items:** none.

## Copilot Check (01.7)

**PASS (2026-09-10).**
- **Contract source:** fixes a corollary of an already-landed decision (D-24505); the new D-24506 records the corollary + the tooling adoption, not an invented mechanic.
- **Boundary:** the fix is stage-`:deep`-scoped so `TurnActionBar.vue` and `<PlayMobile>` keep sticky; Playwright is devDeps-only (Shared-Tooling) — the one real risk (a prod-dep leak) is an explicit acceptance criterion.
- **Reward-integrity:** the honest hazard is shipping an unverifiable check — mitigated by (a) not adding a CI gate here, (b) verifying the fix by DOM geometry in-environment, (c) disclosing that the Playwright run is host-delegated. No check is claimed green that was not run.
- **Test reality:** jsdom cannot assert layout, so the guard (real chromium layout) is the correct home for the invariant; the unit suite is unaffected.
- **Disposition: CONFIRM.** Execution authorized.

---

## See Also
- **D-24505 / WP-688** — the fit stage this WP fixes a defect in + guards.
- **D-24506** — this WP's decision (fix corollary + Playwright guard adoption).
- **D-24502** — the geometry locks the guard asserts.
- `.claude/rules/architecture.md §Layer Boundary` — the Shared-Tooling devDeps-only rule Playwright follows.
- `wiki/testing.md` — the docs home for the visual check.
