# EC-725 — Play-Surface Fit-to-Floor (Execution Checklist)

**Source:** docs/ai/work-packets/WP-688-play-surface-fit-to-floor.md
**Layer:** App (`apps/arena-client`) — presentation only

## Before Starting
- [ ] WP-685 / EC-722 is on `main` — `PlayDesktop.vue` already has `.play-desktop__grid` (two-column), `.play-desktop__rail` (opponents + log), the adversary-band / HQ / cockpit regroup, and the full-array `HandRow` / `PlayedCardsRow` wells. This WP tunes that structure to fit; it does not rebuild it.
- [ ] `docs/ai/DECISIONS.md` **D-24502** (lock 1 — the fit) and **D-24251** are on `main`; **D-24505** is reserved in `NUMBER-LEDGER.md`.
- [ ] `CardTile.vue` sizes by `width: var(--card-width-{sm|md|lg})` (aspect 5/7) — confirm it is token-driven so a `.play-desktop`-scoped token override compacts it with no component edit.
- [ ] `pnpm -r build` exits 0 and `pnpm --filter @legendary-arena/arena-client typecheck` (vue-tsc) exits 0 on the baseline.
- [ ] Scope lock — the ONLY files this EC may modify are the 6 in **Files to Produce** (+ governance). The conditional ones (`useScaleToFit.ts`/`.test.ts`, `playmat-slots.css`) are produced only if the fit needs them; record which were used. Any other file is a FAIL; surface it as a blocker before touching it.

## Locked Values (do not re-derive — from D-24502 lock 1)
- Authoring floor: the board fits **1280×720** at the smallest supported desktop width, **scales up** (toward ~1.5× on a 1920 screen), letterboxes / down-scales toward a low floor just below 1280, then `<PlayMobile>` at `≤767px`.
- Scale-ladder realization: the exact 1.00/1.07/1.50 ladder was illustrative against the ~720px-natural mock; with real ~2× content the fit is **height-bound first**, so the realized scale lands **~0.75× at 1280** (after moderate compaction) and grows toward the 1.5× cap on 1080p. "Scale up, never rewrap" + the 1280-fit are the binding intent; exact per-width scale numbers are fit-driven (record in D-24505).
- Unchanged: `BREAKPOINT_MOBILE_MAX_PX = 767`, `useViewport.ts`, `<PlayMobile>`, skin assets, the shared `:root` `--card-width-*` token **values**, and every WP-685 structural zone — only size/scale is tuned.

## Guardrails
- **Board-scoped compaction ONLY** — the `--card-width-*` / gutter / spacing compaction is a `.play-desktop`-scoped CSS-variable override. Do NOT shrink the shared `:root` values (other surfaces + `<PlayMobile>` read them). Do NOT edit `CardTile.vue` (token-driven compaction instead).
- Additive to D-12909 — do NOT modify `useViewport.ts`, the 767 constant, or any `<PlayMobile>` file. If an edit reaches them, STOP (hard stop — abort and report).
- Pure presentation — no `G`, no new `UIState` field, no persistence, no `finalStateHash`; no new runtime `registry`/`game-engine`/`server`/`pg`/`boardgame.io` import. A `useScaleToFit` composable reads DOM geometry only (`getBoundingClientRect`/`ResizeObserver`/`window.innerHeight`), never game state / the store.
- Fit, no page scroll, scale-up-never-reflow — the board fits 1280×720 in BOTH axes with no *page* scroll (in-zone well/rail scroll is expected — the pill reads "no page scroll"); zones never rewrap/rearrange across the ladder.
- Readable floor (D-24502 lock 4) — compaction + scale must keep card names + costs legible at 1280×720. Author generously + scale the composition; do not shrink tokens below legibility.
- Preserve every WP-685 guarantee — grid, rail (opponents + log), full-array wells (no `slice(`), adversary-band / HQ / cockpit regroup, occupied City place-names, HQ-adjacent Transform Deck, projection-bound denominators.
- Do NOT touch `SchemeTile.vue` / `TopHudBar.vue` (lock 8 shipped). Undo and Heal Wound are OUT of scope (D-24502).

## Required `// why:` (or `/* why: */`) Comments
- The `.play-desktop`-scoped `--card-width-*` / spacing override (`PlayDesktop.vue`) and the authoring-floor/scale tokens (`base.css`): cite D-24502 lock 1, and note the override is board-scoped so `<PlayMobile>` / the shared tokens are unchanged.
- The scale-to-fit mechanism (and each ladder / letterbox media query): note it is scale/fit tuning, not a layout rearrangement.
- If the `useScaleToFit` composable is used: `// why:` on the DOM-geometry read (no game state) and on the scaled-height reservation (so the page reserves only the scaled height → no page scroll).

## Files to Produce
- `apps/arena-client/src/styles/base.css` — **modified** — authoring-floor + scale support tokens under `:root` (no shared-token shrink).
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — `.play-desktop`-scoped compaction override + scale-to-fit wiring + ladder/letterbox media policy.
- `apps/arena-client/src/pages/PlayDesktop.test.ts` — **modified** — fit-wiring / structure-intact assertions (WP-685 structural assertions stay green).
- `apps/arena-client/src/composables/useScaleToFit.ts` — **new (conditional)** — measure-and-scale composable; created only if the scale stage uses JS. Record use in this EC.
- `apps/arena-client/src/composables/useScaleToFit.test.ts` — **new (conditional)** — clamp-math unit test for the composable.
- `apps/arena-client/src/styles/playmat-slots.css` — **modified (conditional)** — board per-zone padding/label spacing tightened if token compaction is insufficient; frosted-panel + mask behavior preserved.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip the WP-688 node `📝 → ✅`.

### Execution record (2026-09-10)
- **Conditional files USED:** `useScaleToFit.ts` + `.test.ts` (the JS scale stage) and `playmat-slots.css` (desktop-board compaction) — all used.
- **Allowlist amendment (App-layer, no contract):** `apps/arena-client/src/pages/PlayViewport.vue` + `apps/arena-client/src/App.vue` were added. The fit's root cause was structural — the app-shell flex column had `.play-viewport` forcing `min-height:100vh` below a ~68px header + ~55px footer, guaranteeing a page scroll regardless of board height, which `<PlayDesktop>` cannot fix from inside the wrapper. At `≥768px`, `.play-viewport` and `<main>` (the latter scoped to the `play-fixture`/`live` routes) fill the app-shell flex gap instead of forcing 100vh. Both are `≥768px`-scoped so the D-12909 `<PlayMobile>` surface is byte-unchanged (verified live at 375px). Recorded in WP-688 §Execution amendment + D-24505.

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0 (vue-tsc — REQUIRED for arena-client).
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0.
- [ ] `Select-String` shows no `slice(` in `HandRow.vue` / `PlayedCardsRow.vue`; `git diff --name-only` excludes `useViewport.ts`, `<PlayMobile>*`, `SchemeTile.vue`, `TopHudBar.vue`, `CardTile.vue`, `packages/**`, `apps/server/**`, and shows the shared `:root` `--card-width-*` values unchanged.
- [ ] Record in this EC which conditional files were used (the `useScaleToFit` composable/test and/or `playmat-slots.css`).
- [ ] **Live-on-surface (D-24026, REQUIRED)** — `?fixture=mid-turn&play=1` at `1280×720` / `1366×768` / `1920×1080`: FITS at 1280×720 with NO page scroll (either axis), card names/costs readable, scales up (not rewraps) at 1920, right rail holds opponents+log, City names on occupied spaces, hand of >6 scrolls in-zone; `≤767` still `<PlayMobile>`. Capture the **1280×720** screenshot as evidence.
- [ ] `docs/ai/STATUS.md` updated — desktop play surface now fits the 1280×720 floor with no page scroll.
- [ ] `docs/ai/DECISIONS.md` — D-24505 landed (realized fit mechanism); D-24251 annotated superseded (desktop side); D-24502 marked fully implemented.
- [ ] `wiki/responsive-viewport-targets.md` — *Implementation status* updated: the fit is shipped (Tex's sub-1366 failure fixed).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-688 checked off with date; **and WP-685's still-`[ ]` row reconciled** (WP-688 realizes WP-685's deferred lock 1, so WP-685 is now fully realized — close/annotate its row in the same pass so the `workindex:executed:check` stale-row gate stays green) + its mindmap node `📝 → ✅`.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- Shrinking the shared `:root` `--card-width-*` values to compact the board — that leaks into `<PlayMobile>` and every other CardTile surface. The compaction MUST be `.play-desktop`-scoped.
- "No scroll" as an acceptance phrasing invites a false fail — the wells + rail DO scroll in-zone; the invariant is no *page* scroll (either axis).
- A `transform: scale()` stage that reserves the UNSCALED height leaves the page scrolling anyway — the wrapper must reserve only `naturalHeight * scale`.
- A `transform: scale()` stage that keeps the default `transform-origin: center` (the board has `margin-inline: auto`) mispositions / clips the top while reserving only scaled height — pin `transform-origin: top center` (or `top left` + centering) so the scaled board anchors at the top.
- The `PileBrowseModal` / `CardReaderModal` teleport under `document.body` (outside `.play-desktop`), so their CardTiles keep the shared `:root` size — this is deliberate (full-size inspection); do not "fix" it by moving the override to `:root`.
- Editing `CardTile.vue` or `PlayMobile`/`useViewport` to "compact consistently" is the exact cross-surface / D-12909 leak this EC forbids.
- A page test that only asserts the board mounts will pass even if the fit regresses — the fit is live-verified (D-24026); the jsdom test guards structure + composable clamp-math, not layout pixels.
