# EC-096 — Registry Viewer: Grid Data View Mode (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-096-registry-viewer-grid-data-view.md`
**Layer:** Client UI (`apps/registry-viewer/`)

## Before Starting

- [ ] WP-066 merged: `useCardViewMode.ts`, `ViewModeToggle.vue`, `CardDataDisplay.vue` exist under `apps/registry-viewer/src/{composables,components}/`.
- [ ] `useCardViewMode.ts` contains `const STORAGE_KEY = "cardViewMode";` and the mode type is `'image' | 'data'`.
- [ ] WP-003 merged: `FlatCard` exported from `apps/registry-viewer/src/registry/browser.ts` with fields `name`, `cardType`, `setAbbr`, `hc`, `cost`, `attack`, `recruit`, `rarityLabel` | `rarity`.
- [ ] `pnpm --filter registry-viewer build` exits 0 on `main`.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0 on `main`.

## Locked Values (do not re-derive)

- Production files (two only):
  1. `apps/registry-viewer/src/components/CardGrid.vue` (modified)
  2. `apps/registry-viewer/src/components/CardDataTile.vue` (new)
- Toggle modes (verbatim): `'image'` and `'data'`.
- localStorage key (verbatim): `'cardViewMode'`.
- Composable destructure (verbatim): `const { viewMode } = useCardViewMode();`
- Composable import path (verbatim): `from "../composables/useCardViewMode"`.
- `CardDataTile` import path (verbatim): `from "./CardDataTile.vue"`.
- Tile field order (verbatim): `name`, `cardType`, `setAbbr`, `hc`, `cost`, `attack`, `recruit`, `rarityLabel` (preferred) or `rarity` (fallback).
- Labels (verbatim): `Type`, `Set`, `Class`, `Cost`, `Attack`, `Recruit`, `Rarity`. Six (`Type`, `Class`, `Cost`, `Attack`, `Recruit`, `Rarity`) are byte-identical to `CardDataDisplay.vue`. The seventh row uses the compact label `Set` rendering `card.setAbbr` — deliberate tile-compaction divergence from sidebar `Edition` / `setName` per WP-096 §Locked Values + D-9601.
- AND-semantics guards (verbatim):
  - Strings: `v-if="card.X"`.
  - Numbers (0 valid): `v-if="card.X !== undefined && card.X !== null"`.
  - `attack` / `recruit`: `v-if="card.X !== undefined && card.X !== null && card.X !== ''"`.
- Conditional placement: the `viewMode` branch lives inside `.img-wrap`; `.img-wrap` itself stays in the DOM in both modes.
- Tile root sizing: `width: 100%; height: 100%;` with overflow controlled to fit the `.img-wrap` 3:4 box.
- Print parity: `@media print` block on `CardDataTile.vue` makes the tile white background, black text, hairline border.
- Abilities on tile: OMITTED.

## Guardrails

- No edits to: `useCardViewMode.ts`, `ViewModeToggle.vue`, `CardDataDisplay.vue`, `CardDetail.vue`, `App.vue`.
- No change to grid columns (`minmax(130px, 1fr)`) or the 3:4 swap-area dimensions.
- `.tile-info` footer renders unconditionally and is structurally unchanged.
- `.selected` border glow remains on the outer `.card-tile`, never moved into a conditional branch.
- No imports from `boardgame.io`, `@legendary-arena/{game-engine,preplan,server}`, `pg`, the Node-bearing `@legendary-arena/registry` barrel, or any `node:` built-in. (Narrow Zod-schema subpaths from `@legendary-arena/registry` are permitted by the layer rule but not needed in this scope.)
- No new dependencies; no `package.json` changes.
- No tests added; no test config changes.
- Display label formatting matches `CardDataDisplay.vue` via the same CSS classes (no new helpers).

## Required `// why:` Comments

- `CardGrid.vue` on the `useCardViewMode` import: composable is single source of truth; grid reads it directly to avoid prop plumbing through `App.vue`.
- `CardGrid.vue` on the `viewMode === 'data'` / `v-else` block inside `.img-wrap`: swap is confined to inside the 3:4 area; footer unchanged; grid layout preserved byte-identically.
- `CardDataTile.vue` module JSDoc: cousin of `CardDataDisplay.vue`; locked field set; six of seven labelled rows match sidebar byte-for-byte; the `Set` / `setAbbr` row is the deliberate tile-compaction divergence from sidebar `Edition` / `setName` per D-9601; abilities omitted intentionally.
- `CardDataTile.vue` numeric guard (`cost`): explains why `!== undefined && !== null` rather than truthiness (0 is a valid cost).
- `CardDataTile.vue` `attack` / `recruit` empty-string guard: source data may carry `''`; omission preserves AND-semantics.

## Files to Produce

- `apps/registry-viewer/src/components/CardGrid.vue` — **modified** — branch swap-area on `viewMode`; render `CardDataTile` in data mode.
- `apps/registry-viewer/src/components/CardDataTile.vue` — **new** — render locked fields under AND-semantics with print parity.

## After Completing

- [ ] `pnpm --filter registry-viewer build` exits 0.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0.
- [ ] `git diff --name-only` shows only the two production files plus governance (`STATUS.md`, `DECISIONS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, WP-096, EC-096).
- [ ] Manual smoke: toggle flips entire grid; selection persists; no console warnings; print preview in data mode renders white bg + black text.
- [ ] `docs/ai/STATUS.md` updated — grid now respects `cardViewMode`.
- [ ] `docs/ai/DECISIONS.md` updated — `D-9601` (locked field set, composable-vs-prop, AND-semantics parity, ability omission, `Set` / `setAbbr` tile-compaction divergence from sidebar `Edition` / `setName`).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-096 row checked off with date + commit hash.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-096 row set to `Done <date>`.

## Common Failure Smells

- Grid columns reflow when toggling → tile content overflowed `.img-wrap`. Fix sizing on `CardDataTile.vue` root; do not change column track.
- Vue "Property X accessed but not defined" → typo in `card.X`; cross-check the eight locked field names exactly.
- Zero-cost cards render no `Cost` row → guard used `v-if="card.cost"` instead of explicit null/undefined check.
- Rarity rendered as number when label exists → `v-if/v-else-if` ordering wrong; prefer `rarityLabel`, fall back to `rarity`.
- Print preview shows dark tile in data mode → `@media print` block missing or scoped wrong; mirror `CardDataDisplay.vue` literally.
- Selection glow disappears after toggle → `.selected` rule was moved into a conditional branch; it must remain on the outer `.card-tile`.
