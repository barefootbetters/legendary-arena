# EC-722 — Play-Surface Spatial Rebuild (Execution Checklist)

**Source:** docs/ai/work-packets/WP-685-play-surface-spatial-rebuild.md
**Layer:** App (`apps/arena-client`) — presentation only

## Before Starting
- [ ] `docs/ai/DECISIONS.md` **D-24502** is on `main` (the eight geometry locks this WP implements).
- [ ] `apps/arena-client/src/pages/PlayDesktop.vue`, `styles/base.css`, `styles/playmat-slots.css`, and the `HandRow` / `PlayedCardsRow` / `CityRow` / `OpponentPanel` / `GameLogPanel` components exist on the baseline.
- [ ] The twist/tactics denominator fix (D-24502 lock 8) has already shipped — `SchemeTile.vue` / `TopHudBar.vue` are OUT of scope.
- [ ] `pnpm -r build` exits 0 and `pnpm --filter arena-client typecheck` (vue-tsc) exits 0 on the baseline.
- [ ] Scope lock — the ONLY files this EC may modify are the 10 in **Files to Produce** (+ governance), plus one pre-authorized `PlayRail` extraction. Any other file is a FAIL; surface it as a blocker before touching it.

## Locked Values (do not re-derive — from D-24502)
- Authoring grid: `1280 × 720` at `1.00×`. `1366×768` → `~1.07×`; `1920×1080` → `1.50×`. Below `1280`: letterbox toward `0.90×`, then `<PlayMobile>` at `≤767px`.
- Right rail owns the opponent panels + game log.
- City visual order (L→R): `Escaped | Bridge | Streets | Rooftops | Bank | Sewers | Villain Deck`. Advance direction is the reverse — label separately; occupied spaces keep place-names.
- Hand + in-play bind the **full** `handCards` / `inPlayCards`; in-zone horizontal scroll + `+N` peek; **never `slice(0,6)`**. Click-to-play lands a card in the in-play well until cleanup; empty in-play well = a dashed target, disabled off-turn / off-`main`.
- Transform Deck (WP-664): HQ-adjacent, hides when empty.
- Unchanged: `BREAKPOINT_MOBILE_MAX_PX = 767`, `useViewport.ts`, `<PlayMobile>`, skin assets, the zones themselves (only their arrangement changes).

## Guardrails
- Additive to D-12909 — do NOT modify `useViewport.ts`, the 767 constant, or any `<PlayMobile>` file. If an edit reaches them, STOP (hard stop — abort and report).
- Pure presentation — no `G`, no new `UIState` field, no persistence, no `finalStateHash`; no new runtime `registry`/`game-engine`/`server`/`pg`/`boardgame.io` import.
- Scale-to-fit, never reflow — zones never rewrap/rearrange across the ladder; no horizontal *page* scroll (in-zone hand/in-play scroll is expected — the pill reads "no page scroll").
- Full-array binding — remove any fixed-count cap; `slice(` must not appear in `HandRow.vue` / `PlayedCardsRow.vue`.
- Undo and Heal Wound are OUT of scope (D-24502) — do not add either control.
- Do NOT touch `SchemeTile.vue` / `TopHudBar.vue` (lock 8 already shipped).

## Required `// why:` (or `/* why: */`) Comments
- The authoring-grid + scale tokens (`base.css`) and the grid/scale mechanism (`PlayDesktop.vue`): cite D-24502.
- Each resolution-ladder media query (1366 / 1920 / letterbox-below-1280): note it is scale/gutter tuning, not a layout rearrangement.

## Files to Produce
- `apps/arena-client/src/styles/base.css` — **modified** — authoring-grid + scale size tokens under `:root`.
- `apps/arena-client/src/pages/PlayDesktop.vue` — **modified** — flex-stack → fixed grid regions + right rail + scale-to-fit + ladder media policy.
- `apps/arena-client/src/styles/playmat-slots.css` — **modified** — frosted-panel selectors re-anchored to the new regions; text-protection mask preserved.
- `apps/arena-client/src/components/play/HandRow.vue` — **modified** — full-array scrolling well.
- `apps/arena-client/src/components/play/PlayedCardsRow.vue` — **modified** — full-array in-play well + empty dashed target.
- `apps/arena-client/src/components/play/CityRow.vue` — **modified** — occupied place-names.
- `apps/arena-client/src/pages/PlayDesktop.test.ts` — **modified** — new region structure + right-rail assertions.
- `apps/arena-client/src/components/play/HandRow.test.ts` — **modified/new** — a >6-card hand renders every card; no slice.
- `apps/arena-client/src/components/play/PlayedCardsRow.test.ts` — **modified/new** — full array + empty-well disabled target.
- `apps/arena-client/src/components/play/CityRow.test.ts` — **modified** — occupied place-name.
- `docs/05-ROADMAP-MINDMAP.md` — **modified** — flip the WP-685 node `📝 → ✅`.
- (Pre-authorized amendment) a `PlayRail` component extraction, App-layer, no contract — record it in this EC if used.

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter arena-client typecheck` exits 0 (vue-tsc — REQUIRED for arena-client).
- [ ] `pnpm --filter arena-client test` exits 0.
- [ ] `Select-String` shows no `slice(` in `HandRow.vue` / `PlayedCardsRow.vue`; `git diff --name-only` excludes `useViewport.ts`, `<PlayMobile>*`, `SchemeTile.vue`, `TopHudBar.vue`, `packages/**`, `apps/server/**`.
- [ ] **Live-on-surface (D-24026, REQUIRED)** — `?fixture=mid-turn&play=1` at `1280×720` / `1366×768` / `1920×1080`: fits at 1280×720 with no page scroll, scales up (not rewraps) at 1920, right rail holds opponents+log, City names on occupied spaces, hand of >6 scrolls in-zone; `≤767` still `<PlayMobile>`. Capture the **1280×720** screenshot as evidence.
- [ ] `docs/ai/STATUS.md` updated — desktop play surface is a fixed 1280×720 spatial board.
- [ ] `docs/ai/DECISIONS.md` updated — D-24502 realized; D-24251 annotated superseded (desktop side).
- [ ] `wiki/responsive-viewport-targets.md` — *Fluid desktop scaling* section reconciled with the shipped fixed-grid model.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-685 checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `✅`, then `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- A hand test that mounts exactly 6 cards will pass a `slice(0,6)` regression silently — the >6-card assertion is the non-vacuous guard; keep it.
- "No horizontal scroll" as an acceptance phrasing invites a false fail — the wells DO scroll in-zone; the invariant is no *page* scroll.
- Touching `PlayMobile`/`useViewport` to "keep them consistent" is the exact D-12909 violation this EC forbids — the mobile composer is a separate WP.
