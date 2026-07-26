# EC-465 — Fluid Desktop Responsive Scaling for the Play Surface (Execution Checklist)

**Source:** docs/ai/work-packets/WP-430-fluid-desktop-responsive-scaling.md
**Layer:** App (`apps/arena-client` — CSS only)

## Before Starting
- [ ] `apps/arena-client/src/styles/base.css` has a `:root` block (≈L25) and is imported once at `main.ts` (≈L7); the "no raw hex" rule is **color-only** (size tokens are fine).
- [ ] `apps/arena-client/src/pages/PlayDesktop.vue` `.play-desktop` scoped style has **no `max-width` / `margin-inline`** today (it stretches edge-to-edge).
- [ ] `apps/arena-client/src/components/play/CardTile.vue` sets `.card-tile--sm/md/lg` to `60px/90px/120px` with `aspect-ratio: 5 / 7`.
- [ ] `apps/arena-client/src/composables/useViewport.ts` (`BREAKPOINT_MOBILE_MAX_PX = 767`, D-12909) is the sole breakpoint — **read-only, do not modify**.
- [ ] `pnpm --filter arena-client typecheck` exits 0 and the arena-client suite passes on the baseline.

## Locked Values (do not re-derive)
- `--play-max-width: 1600px` (the cap — locked).
- `--play-gutter: clamp(16px, 2vw, 40px)` (curve tunable; applied as `padding-inline`).
- `--card-width-sm: clamp(60px, 4.4vw, 76px)`, `--card-width-md: clamp(90px, 6.6vw, 112px)`, `--card-width-lg: clamp(120px, 8.8vw, 150px)` — **`clamp()` floor = the current fixed width (60/90/120px); locked. Curve tunable up to the cap.**
- Desktop comfortable floor: **1366px** (no horizontal scroll at/above). Checkpoints: `@media (min-width: 1440px / 1920px / 2560px)` — spacing tuning only.
- **Unchanged:** `BREAKPOINT_MOBILE_MAX_PX = 767` (D-12909), `useViewport.ts`, `<PlayMobile>`, skin `theme.css`, D-12901/D-12902 zone placement.
- **Reserved decision:** **D-24251** — land Active at execution.

## Guardrails
- **Additive to D-12909, never a change to it** — no edit to `useViewport.ts`, the 767 constant, or any `<PlayMobile>` file. If tempted, STOP.
- **Pure CSS** — no `G`/`ctx`/`UIState`, no persistence, no `finalStateHash`; no runtime `game-engine`/`registry`/`server`/`pg`/`boardgame.io` import.
- **No raw hex** added (size tokens only); **card `aspect-ratio: 5 / 7` preserved** (only `width` changes).
- **Cap centers, never crops** — `margin-inline: auto`, no `overflow: hidden`; no horizontal page scrollbar at any width ≥ 1366.
- **Card widths never shrink below** 60/90/120px (the `clamp()` floor).
- **No new dependency, no CSS framework, no container queries** — plain `clamp()` + `min-width` media queries.
- **3-file allowlist is closed** — the prompt-component card thumbnails (`__card-image`, `max-width: 60px`) are **independent of `.card-tile`** and stay out of scope (a known, acknowledged visual inconsistency, not a miss).

## Required `// why:` Comments
- `base.css` each new token: `/* why: */` naming the anchor (the 1600 cap; the 1366-floor-preserving fluid card widths; the gutter curve).
- `PlayDesktop.vue` each `min-width` checkpoint: `/* why: */` noting it is spacing tuning for that tier, not a layout change.

## Files to Produce
- `apps/arena-client/src/styles/base.css` — **modified** — six `:root` size tokens.
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — `.play-desktop` cap + `margin-inline: auto` + gutter; three checkpoint media queries.
- `apps/arena-client/src/components/play/CardTile.vue` — **modified** — `.card-tile--{sm,md,lg}` widths → `var(--card-width-{sm,md,lg})`.

## After Completing
- [ ] `pnpm -r build` exits 0; `pnpm --filter arena-client typecheck` exits 0; arena-client suite passes with **unchanged count** (no test added/removed).
- [ ] `git diff --name-only` shows ONLY the three CSS files (+ governance) — no `useViewport.ts`, no `PlayMobile*`, no `packages/**`, no skin `theme.css`.
- [ ] **Live-on-surface verification (D-24026, REQUIRED)** — resize a real browser: at 2560 the play area is capped at 1600 and centered; at 1366 no horizontal scroll; card tiles scale from their floor; mobile intact at ≤767. Capture the 2560-width screenshot.
- [ ] `docs/ai/STATUS.md` updated.
- [ ] `docs/ai/DECISIONS.md` — land **D-24251** Active.
- [ ] `wiki/responsive-viewport-targets.md` — *Open question* section updated to the shipped model (cite WP-430 / D-24251).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-430 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` — WP-430 node `📝 → ✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- A horizontal page scrollbar appears at 1366 or 1920 → the gutter/cap math is off; the container's `padding-inline` must be inside the `max-width`, not added to it (`box-sizing: border-box` is already global in base.css).
- Card art looks stretched → the `aspect-ratio` was dropped; only `width` may change.
- `git diff` shows `useViewport.ts` or a `PlayMobile` file → scope breach; the mobile side of D-12909 is untouchable here.
