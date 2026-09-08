# EC-703 — Playmat Mat Backgrounds (Execution Checklist)

**Source:** docs/ai/work-packets/WP-666-playmat-mat-backgrounds.md
**Layer:** Client UI (arena-client only)

## Before Starting
- [ ] WP-130 / EC-133 on `main`: `skinManifest.ts`, `playmatSchema.ts`,
      `playmatStore.ts`, `useSkinApplier.ts`, `SkinSelector.vue`, and the three
      `assets/skins/{classic,comic,minimal}/theme.css` all exist — else STOP.
- [ ] `PlayViewport.vue` calls `useSkinApplier(viewportRoot)` and `.play-viewport`
      is `display: contents` — confirm before adding the paint layer.
- [ ] Target file set = exactly the `Files to Produce` list below. Any edit
      outside it is a FAIL — surface as a blocker, do not improvise.
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter arena-client typecheck` exits 0.
- [ ] `pnpm --filter arena-client test` exits 0 (record the baseline count).

## Locked Values (do not re-derive)
- Manifest image field: **repurpose the existing `boardBackgroundUrl`**, widened
  `string` → `string | null` (bundled URL, CDN URL, or `null`). Do NOT add a
  parallel `boardImageUrl` field. Add `displayLabel: string` +
  `licensed?: boolean` + `attribution?: string`.
- CSS variables (three distinct roles — do not collapse):
  `--skin-board-background` (pre-existing flat palette ground),
  `--skin-board-image` (the mat image; set by `useSkinApplier` from
  `boardBackgroundUrl` — `url("…")` or `none`; NOT hard-coded in `theme.css`),
  `--skin-board-scrim` (per-skin flat `<color>` overlay above image, below board;
  ALWAYS painted). Paint order: background → image → scrim → board.
- Paint-layer class: `playmat-background`.
- Default / fallback skin: `'classic'` (D-13003 / D-13005, unchanged).
- Selector label source: `SkinManifestEntry.displayLabel` (never the raw key).
- **Pinned curated set (exactly five entries; drift test asserts N = 5):**
  | key | `displayLabel` | `boardBackgroundUrl` disposition |
  |---|---|---|
  | `classic` | `Classic` | `null` (palette ground — the default) |
  | `comic`   | `Comic`   | bundled first-party abstract image |
  | `minimal` | `Minimal` | `null` (high-contrast a11y ground) |
  | `midtown` | `Midtown Skyline` | bundled first-party abstract image |
  | `cosmic`  | `Cosmic Arena`    | bundled first-party abstract image |
  All images are project-generated/owned first-party art — NEVER web-sourced,
  NEVER a Marvel/UD scan. No entry is `licensed: true` in this packet.
- CDN host (seam for future licensed mats only): `https://images.legendary-arena.com/`.
- Decisions: D-24477 (paint layer; **Activates** D-13002), D-24478 (named-mat set;
  **supersedes** D-13003), D-24479 (CDN hosting; **supersedes** D-13001).

## Guardrails
- Skin code reads NO game state: no `G.` / `UIState.` / `useUiStateStore` /
  socket / `boardgame.io` / `submitMove`. No `UIState` field is added.
- Paint layer is decorative: `position: fixed`, full-bleed, `pointer-events: none`,
  `aria-hidden="true"`, low `z-index` (behind board). It must NOT change
  `.play-viewport`'s `display: contents` or any board flow layout.
- The scrim is mandatory — a mat painted with no scrim is a FAIL.
- Preserve the D-13005 fallback verbatim: unresolvable skin → `'classic'` + exactly
  one `console.warn`; the image variable follows the fallback. No image preloading,
  network probing, decode-retry, or HEAD-check (out of scope).
- Manifest stays the single source of truth for `SkinName`; the schema closed set
  stays derived from `Object.keys(skinManifest)` — no hand-duplicated union.
- No licensed Marvel / UD asset ships: no manifest entry marked `licensed: true`
  may point at a committed or CDN scan in this packet — the field is a seam only.
- `--skin-board-image` set ONLY on the success branch, AFTER the class swap.

## Required `// why:` Comments
- `PlaymatBackground.vue`: why the layer is fixed/full-bleed/behind-board and inert
  to input (decorative; must not intercept clicks or shift board layout).
- `useSkinApplier.ts`: why `--skin-board-image` is set from the manifest (supports
  bundled AND CDN URLs per D-24479) and only after the class application.
- `PlayViewport.vue`: why `<PlaymatBackground>` mounts once at the shared root
  (single-host, covers both surfaces — the `<VfxOverlay>` precedent).

## Files to Produce
- `apps/arena-client/src/components/play/PlaymatBackground.vue` — **new** — fixed
  full-bleed background + mandatory scrim leaf.
- `apps/arena-client/src/components/play/PlaymatBackground.test.ts` — **new**.
- `apps/arena-client/src/assets/skins/midtown/board-background.<ext>` — **new** — first-party abstract art.
- `apps/arena-client/src/assets/skins/midtown/theme.css` — **new** — `--skin-board-scrim` + palette.
- `apps/arena-client/src/assets/skins/cosmic/board-background.<ext>` — **new** — first-party abstract art.
- `apps/arena-client/src/assets/skins/cosmic/theme.css` — **new** — `--skin-board-scrim` + palette.
- `apps/arena-client/src/assets/skins/comic/board-background.<ext>` — **new/replace** — real art over the 79-byte stub.
- `apps/arena-client/src/prefs/skinManifest.ts` — **modified** — repurpose
  `boardBackgroundUrl` → `string | null`; add `displayLabel` + `licensed?`/`attribution?`; pin the five-entry set.
- `apps/arena-client/src/composables/useSkinApplier.ts` — **modified** — set `--skin-board-image`.
- `apps/arena-client/src/composables/useSkinApplier.test.ts` — **modified**.
- `apps/arena-client/src/prefs/playmatSchema.test.ts` — **modified** — drift at N = 5.
- `apps/arena-client/src/components/play/SkinSelector.vue` — **modified** — render `displayLabel`.
- `apps/arena-client/src/components/play/SkinSelector.test.ts` — **modified**.
- `apps/arena-client/src/pages/PlayViewport.vue` — **modified** — mount `<PlaymatBackground>`.
- `apps/arena-client/src/assets/skins/{classic,comic,minimal}/theme.css` — **modified** — add `--skin-board-scrim`.

**Governance (required by After Completing — inside the allowlist):**
- `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter arena-client typecheck` exits 0.
- [ ] `pnpm --filter arena-client test` exits 0; baseline grew.
- [ ] Live-on-surface (D-24026): on play.legendary-arena.com, pick a non-classic
      mat → board repaints, cards/zones legible, reload persists. Screenshot in STATUS.
- [ ] `docs/ai/STATUS.md` updated (`### WP-666 / EC-703 Executed`, with screenshot).
- [ ] `docs/ai/DECISIONS.md` — D-24477, D-24478, D-24479 + supersession pointers.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-666 row `[x]` with date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-703 → Done.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node `📝`→`✅`; `pnpm roadmap:counts:write`;
      `pnpm roadmap:counts:check` exits 0.

## Common Failure Smells
- Skin selected but board unchanged → `--skin-board-image` not set on the root, or
  the paint layer sits above the board (wrong `z-index`) / behind an opaque surface.
- Cards unreadable over a mat → scrim missing or too weak; the scrim is mandatory.
- Broken-image box on `'classic'` → `boardBackgroundUrl: null` not handled as `none`.
- `typecheck` red only in CI → a required new field (`displayLabel`) or the
  widened `boardBackgroundUrl` left off an entry; `vite build` + `tsx` don't
  type-check, only `vue-tsc` does.
