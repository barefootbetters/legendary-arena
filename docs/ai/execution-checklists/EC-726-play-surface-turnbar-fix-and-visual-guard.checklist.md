# EC-726 — Play-Surface TurnActionBar Fix + Playwright Visual Guard (Execution Checklist)

**Source:** docs/ai/work-packets/WP-689-play-surface-turnbar-fix-and-visual-guard.md
**Layer:** App (`apps/arena-client`) presentation (fix) + Shared Tooling (Playwright devDep + guard) + ewiki docs

## Before Starting
- [ ] WP-688 / EC-725 / D-24505 on `main`: `.play-desktop__stage` (`position:absolute; transform:scale(--play-fit-scale)`) exists in `PlayDesktop.vue`; `TurnActionBar` is at the bottom of `.play-desktop__main`.
- [ ] `TurnActionBar.vue` styles `.turn-action-bar` `position:sticky; bottom:0; z-index:100` (the overlap cause inside the scaled stage).
- [ ] `apps/arena-client/package.json` has `preview` (`vite preview`); no `playwright`/e2e/visual setup exists yet.
- [ ] `.claude/rules/architecture.md` Shared-Tooling: dev/test tooling = `apps/*` devDependencies ONLY, never production `dependencies`.
- [ ] `pnpm -r build` + arena-client `typecheck` green on baseline.
- [ ] Scope lock — ONLY the 5 files in **Files to Produce** (+ governance). Any other file (esp. `TurnActionBar.vue`, `<PlayMobile>*`, `useViewport.ts`, `wiki/architecture-inventory.md`, `.github/workflows/**`) is a FAIL.

## Locked Values (do not re-derive)
- **Fix:** `.play-desktop__stage :deep(.turn-action-bar) { position: static; }` — stage-scoped; `TurnActionBar.vue` NOT edited (bar keeps sticky everywhere else).
- **Guard viewports:** `1280×720`, `1366×768`, `1920×1080`; route `?fixture=mid-turn&play=1`.
- **Guard invariants:** `documentElement.scrollHeight <= clientHeight` AND `scrollWidth <= clientWidth` (no page scroll); `turnBar.getBoundingClientRect().top >= cockpitBottom - 1` (no overlap with played-row/economy/victory); `.play-desktop__stage` visual box within `.play-desktop__fit`.
- **Playwright:** `apps/arena-client` **devDependencies** only; invoked by `test:visual` (build+preview+run) / `test:visual:run` (against `PLAY_URL`); runs against `vite preview`.

## Guardrails
- Fix ONLY inside `.play-desktop__stage` via `:deep()`. Do NOT edit `TurnActionBar.vue`. If an edit reaches it / `<PlayMobile>` / `useViewport.ts`, STOP.
- `playwright` in `devDependencies` NEVER `dependencies`; no production import of it. (Shared-Tooling, like `vue-sfc-loader`/`jsdom`.)
- Assertion-based guard only — NO committed golden/baseline PNGs, NO pixel-diff (cross-platform flake). Screenshots are artifacts, gitignored.
- Pure presentation for the fix — no `G`/`UIState`/persistence/hash/HTTP. The guard reads DOM geometry only.
- Do NOT add a CI job / edit `.github/workflows/**` (documented follow-on). Do NOT hand-edit `wiki/architecture-inventory.md` (generated; cron regens with `--external`).

## Required `// why:` / `/* why: */`
- The `:deep(.turn-action-bar){position:static}` rule: cite D-24505/D-24506 — the sticky-in-transformed-stage overlap; the fitted board never page-scrolls so sticky is unneeded here.
- The guard script: JSDoc header (what it guards, why chromium not jsdom) + `// why:` on each invariant + on the `PLAY_URL`/preview choice.

## Files to Produce
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — stage-scoped `:deep(.turn-action-bar){position:static}` fix.
- `apps/arena-client/visual/play-surface.visual.mjs` — **new** — raw-`playwright` + `node:assert` guard; 3 viewports; asserts the invariants; writes `visual/__screenshots__/play-desktop-<w>x<h>.png`; non-zero exit on failure; `PLAY_URL` env (default preview port).
- `apps/arena-client/package.json` — **modified** — `playwright` devDep + `test:visual` (build+preview+run+teardown, cross-platform) + `test:visual:run` (against a running `PLAY_URL`).
- `.gitignore` (repo root or `apps/arena-client/.gitignore`) — **modified** — ignore `apps/arena-client/visual/__screenshots__/`.
- `wiki/testing.md` — **modified** — "Play-surface visual regression (Playwright)" section (what it guards, run commands, one-time `npx playwright install chromium`, expected output, the ci.yml follow-on sketch) + `last-reviewed` bump; SCHEMA-compliant.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip WP-689 `📝 → ✅`.

## After Completing
- [ ] `pnpm -r build` / `pnpm --filter @legendary-arena/arena-client typecheck` / `... test` all exit 0.
- [ ] **Fix verified by DOM geometry (D-24026, resolution-independent):** at 1280×720 on the fixture route, `turnBar.top >= handRow.bottom - 1` (bar below cockpit, no overlap) and `documentElement.scrollHeight <= clientHeight` (no page scroll). Capture the reading.
- [ ] `git diff --name-only` shows only the Files to Produce; `Select-String "\"playwright\"" package.json` match is under `devDependencies`.
- [ ] (On a chromium-capable host — not required in the exec env) `pnpm --filter @legendary-arena/arena-client test:visual` exits 0 with the per-viewport invariant log + PNGs. Record the outcome / that it's host-delegated.
- [ ] `docs/ai/DECISIONS.md` — D-24506 landed.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `wiki/testing.md` section + `last-reviewed` bumped.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-689 `[x]` + date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- Editing `TurnActionBar.vue` to fix the overlap — that removes sticky everywhere (incl. `<PlayMobile>`); the fix MUST be `.play-desktop__stage`-scoped via `:deep()`.
- `playwright` landing in `dependencies` — a Shared-Tooling layer violation; devDeps only.
- Committing screenshot PNGs or a pixel-diff baseline — the guard is assertion-based; the PNGs are gitignored artifacts.
- Adding a `ci.yml` Playwright job now — unverifiable from the exec env; documented follow-on only.
- Hand-editing `wiki/architecture-inventory.md` or regenerating it locally without `--external` — strips SaaS detections (the contamination trap); leave it to the cron.
- Claiming the Playwright guard "passes" without a run — the exec env can't execute chromium; verify the FIX by DOM geometry and disclose the guard run as host-delegated.
