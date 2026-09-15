# EC-736 — Hand Presentation: hover-lift + shallow hand arc (Execution Checklist)

**Source:** docs/ai/work-packets/WP-699-hand-presentation-hover-and-arc.md
**Layer:** Arena Client (App / presentation)

## Before Starting
- [ ] `apps/arena-client/src/vfx/effectIntensity.ts` exports `useEffectIntensity()` → `{ intensity, prefersReducedMotion, shouldRender }` and `shouldRender('shake'|'particles'|'word'): boolean` (WP-556)
- [ ] `HandRow.vue` renders the shared hand (`<ul class="hand-cards">` of `<CardTile>`); `CardTile.vue` has `.card-tile--interactive:hover { transform: scale(1.05); }` and NO `z-index` rule today
- [ ] Read the EXACT target file set (below) — any modification outside it is a FAIL, surfaced as a blocker before touching the file
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0

## Locked Values (do not re-derive)
- Effect-Intensity gate API (verbatim): `useEffectIntensity()` → `{ intensity, prefersReducedMotion, shouldRender }`; `shouldRender(kind: 'shake' | 'particles' | 'word'): boolean`
- Hover lift is gated by BOTH `@media (hover: hover)` AND (`shouldRender('particles')` true AND `prefersReducedMotion` false)
- Animate `transform` / `box-shadow` / `opacity` ONLY — never a layout property

## Guardrails
- Pure presentation: read only already-projected `UIState`; compute no game rule. NO new **runtime** import of `@legendary-arena/game-engine`, `@legendary-arena/registry`, or `pg` — the pre-existing type-only `import type { UICardDisplay } from '@legendary-arena/game-engine'` in both files is permitted (WP-090) and stays; the Step-4 diff check targets added non-`import type` lines only
- Absent from the determinism hash: touch no move dispatch, validation, RNG, or hashed state
- No new dependency (D-24365): hand-rolled CSS / WAAPI only — no `motion` / GSAP / `tsparticles`; `apps/arena-client/package.json` stays unchanged
- Preserve the WP-688 fit (D-24505): the arc must not introduce a page scroll or overflow the fitted 1280×720 stage on `<PlayDesktop>`, and must not regress `<PlayMobile>`
- Do NOT touch playability: the stage gate and Wound gate in `HandRow.vue` stay as-is — no affordability grey-out (playing from hand is resource-free; nothing to grey)
- Hand-scope the hover lift: apply it ONLY to hand tiles (a `HandRow`-set prop/class), leaving city / HQ / in-play `CardTile` consumers unchanged
- STOP means HARD STOP: if a `Before Starting` precondition fails, fix-and-reverify or abort-and-report — never a partial/speculative fix

## Required `// why:` Comments
- `CardTile.vue` — the `z-index` raise-on-enter / restore-after-leave ordering (a leaving card must not clip its neighbour)
- `HandRow.vue` (or `handArc.ts`) — the arc geometry: why `transform-origin` sits below the card and why spacing compresses as the hand grows

## Files to Produce
- `apps/arena-client/src/components/play/CardTile.vue` — **modified** — hand-scoped hover lift, gated
- `apps/arena-client/src/components/play/HandRow.vue` — **modified** — shallow-arc layout + hover straighten/nudge + hand-scope flag
- `apps/arena-client/src/components/play/handArc.ts` — **new** — pure `computeHandArc(handSize, index)` (only if non-trivial/reused; else inline in `HandRow.vue` with a `// why:`)
- `apps/arena-client/src/components/play/handArc.test.ts` — **new** — arc geometry `node:test` (omit if inlined)
- `apps/arena-client/src/components/play/HandRow.test.ts` — **modified** — arc + gated-hover + unchanged-playability assertions

## After Completing
- [ ] `pnpm --filter @legendary-arena/arena-client build` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client typecheck` exits 0
- [ ] `git diff -- apps/arena-client/package.json` empty (no new dependency)
- [ ] Live-on-surface verification (D-24026): hover lift + fanned arc confirmed live on play.legendary-arena.com in a real match, plus the resting arc renders with Effect-Intensity `off` / reduced-motion
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — no new entry; note the packet applies D-24365 + the WP-556 gate
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` — node glyph `📝` → `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0

## Common Failure Smells
- A page scroll appears at 1280×720 → the arc offsets overflow the fitted stage; bound the vertical offset (WP-688 regression)
- The hover lift animates on a touch device or under reduced-motion → the `@media (hover: hover)` or `shouldRender`/`prefersReducedMotion` gate is missing
- A city/HQ tile also lifts → the lift was applied to `CardTile` unconditionally instead of hand-scoped
