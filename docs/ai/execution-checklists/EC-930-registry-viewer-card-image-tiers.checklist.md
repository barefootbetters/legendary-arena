# EC-930 — Registry viewer card image tiers (Execution Checklist)

**Source:** docs/ai/work-packets/WP-892-registry-viewer-card-image-tiers.md
**Layer:** registry-viewer (`apps/registry-viewer/src/**`)
**Risk Tier:** LOW — a read-only catalog app's image `src` / `srcset`; no auth, money, persistence, determinism, gameplay or customer-data surface. A wrong tier URL degrades to the original image, then to the grid's existing dimmed-tile fallback.

## Before Starting
- [ ] Baseline `origin/main` includes #3329 (WP-891), #3332 (reserve) and the WP-892 draft SPEC.
- [ ] `pnpm install`; `pnpm -r build` → 0; `pnpm --filter registry-viewer test` → 0 fail (341 at `ef5dd9a28`); `pnpm --filter registry-viewer typecheck` → 0; `pnpm --filter registry-viewer lint` → 0 errors (533 warnings at `ef5dd9a28`).
- [ ] Re-run WP Assumes 3: `git grep -nE ':src="[^"]*[iI]mageUrl' -- apps/registry-viewer/src ':!*.test.ts'` lists 5 matches (`CardDetail.vue`, `CardGrid.vue`, `ImageLightbox.vue`, `ThemeDetail.vue`, `ThemeGrid.vue`).
- [ ] `curl.exe -sI https://images.legendary-arena.com/co2e/thumb/<a co2e file>.webp` and `/phone/` and `/large/` → 200 `image/webp` (take a file name from `metadata/image-sizes/co2e.json`).
- [ ] Scope lock: the target file set is exactly §Files to Produce; anything else needs an inline amendment (WP §Files Expected to Change), else STOP.

## Locked Values (do not re-derive)
- **Module** `apps/registry-viewer/src/lib/cardImageTiers.ts`:
  - `export type CardImageTier = 'thumb' | 'phone' | 'large';`
  - `export type CardImageLadder = 'small' | 'large';`
  - `export function cardImageTierUrl(imageUrl: string, tier: CardImageTier): string | null` — returns `null` unless `imageUrl` matches `^https://images\.legendary-arena\.com/[a-z0-9]+/[^/]+\.webp$`; otherwise inserts `/<tier>` before the final path segment.
  - `export function cardImageSources(imageUrl: string, ladder: CardImageLadder): { src: string; srcset: string | null }` — a matching URL gives `small` → `{ src: <thumb>, srcset: '<thumb> 1x, <phone> 2x' }`, `large` → `{ src: <phone>, srcset: '<phone> 1x, <large> 2x' }`; any other string (including `''`) gives `{ src: imageUrl, srcset: null }`.
  - `export const SMALL_LADDER_MAX_CARD_WIDTH_PX = 130;`
  - `export function gridImageLadder(cardWidthPx: number, isSplitFace: boolean): CardImageLadder` — `'small'` when `isSplitFace` is `false` and `cardWidthPx <= SMALL_LADDER_MAX_CARD_WIDTH_PX`; otherwise `'large'`.
  - `export function resolveCardFaceSources(imageUrl: string, ladder: CardImageLadder, hasTierFailed: boolean): { src: string; srcset: string | null }` — `{ src: imageUrl, srcset: null }` when `hasTierFailed`; otherwise `cardImageSources(imageUrl, ladder)`.
- **Component** `apps/registry-viewer/src/components/CardFaceImage.vue` (`<script setup lang="ts">`): props `imageUrl: string`, `ladder: CardImageLadder` and `alt: string` (all required); emits `error` with the `Event`; renders exactly one root `<img :src="sources.src" :srcset="sources.srcset ?? undefined" :alt="alt">`, `sources` = `resolveCardFaceSources(imageUrl, ladder, hasTierFailed)`; attributes (`loading`, `class`) fall through. On an `error` while `sources.srcset` is not `null` it sets `hasTierFailed`; otherwise it emits `error`. A change of `imageUrl` resets `hasTierFailed`.
- **Grid** (`CardGrid.vue`): the tile `<img>` becomes `<CardFaceImage :image-url="card.physicalCardImageUrl ?? card.imageUrl" :ladder="gridImageLadder(cardSize, card.physicalCardImageHalf !== undefined)" …>`, keeping `alt`, `loading="lazy"` and the split class; the existing inline error handler moves to `@error` on it unchanged.
- **Detail panel** (`CardDetail.vue`): the panel `<img>` becomes `<CardFaceImage :image-url="card.physicalCardImageUrl ?? card.imageUrl" ladder="large" :alt="card.name" />`; `openLightbox` still receives the original URL.

## Guardrails
- Card-face URLs come only from `imageUrl` / `physicalCardImageUrl`; no manifest fetch, no set list.
- A non-matching URL renders exactly as today (`src` unchanged, no `srcset`).
- The lightbox, theme comic covers and data-view tiles are unchanged; `openLightbox` gets the original.
- No CSS size change; `useCardSize.ts` (D-12101) untouched; no `package.json` or lockfile change.
- `CardFaceImage` declares its `error` emit, so the grid's dimmed-tile handler never sees the first (tier) failure. Declare it typed — `defineEmits<{ error: [event: Event] }>()` — and call `emit('error', event)`; the grid handler reads `$event.target`.
- Keep AC2 at exactly 3: do not quote a `:src` binding that names an image URL in comments or template comments; paraphrase.
- Full-word names; JSDoc on every function; no nested ternaries.

## Required `// why:` Comments
- `cardImageTiers.ts` URL pattern: mirrors D-24840's path rule; the third copy of the rule (D-24849), pinned by the same example table.
- `SMALL_LADDER_MAX_CARD_WIDTH_PX`: tiles at or below it stay under about 260 px, where a 200 px `thumb` is at most a 30% upscale at 1x.
- `gridImageLadder` split rung: a split face's visible half is drawn from about 1.9× the tile width.
- `CardFaceImage.vue` fallback: a set published before its size step still shows its art.

## Files to Produce
- `apps/registry-viewer/src/lib/cardImageTiers.ts`, `cardImageTiers.test.ts` — **new** — tier rule, ladder, sources
- `apps/registry-viewer/src/components/CardFaceImage.vue` — **new** — the card-face `<img>` with fallback
- `apps/registry-viewer/src/components/CardGrid.vue`, `CardDetail.vue` — **modified** — `<img>` → `CardFaceImage`
- `wiki/r2-image-naming-convention.md`, `wiki/card-image-acquisition.md`, `docs/03.1-DATA-SOURCES.md`, `apps/registry-viewer/CLAUDE.md` — **modified** — WP Scope E
- `docs/ai/DECISIONS.md` (D-24849), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-892-registry-viewer-card-image-tiers.md` — governance close

## After Completing
- [ ] `pnpm -r build` → 0; `pnpm --filter registry-viewer test` → 0 fail; `pnpm --filter registry-viewer typecheck` → 0; `pnpm --filter registry-viewer lint` → 0 errors; `pnpm --filter registry-viewer build` → 0.
- [ ] AC2 grep (test files excluded) → exactly 3 matches: `ImageLightbox.vue`, `ThemeDetail.vue`, `ThemeGrid.vue`.
- [ ] `pnpm wiki:lint` → no finding on the two pages; 03.1 §Card Images names the viewer's tiers; `ledger:numbers:check` 0; allowlist-only `git diff --name-only`.
- [ ] D-24849 Active (every WP DoD clause); 01.6 post-mortem written; STATUS entry; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `pnpm roadmap:counts:write` then `roadmap:counts:check` 0; ledger LANDED.
- [ ] Two commits: `EC-930:` (code, tests, docs), then `SPEC:` close.
- [ ] Live-on-surface (AC5, D-24026): after `cards.legendary-arena.com/version.json` shows the merge SHA, with the slider reset to 130 and the log read before the lightbox opens, `co2e` grid faces load from `/co2e/thumb/` or `/co2e/phone/`, none from a top-level original; at slider 200 new tiles load from `/co2e/phone/` at 1x; the panel from `/co2e/phone/` or `/co2e/large/`; the lightbox then the original; no dimmed tile. Three tier URLs, the lightbox URL and `devicePixelRatio` go in STATUS. Not yet deployed at close → STATUS "live-verify pending" and a follow-up `SPEC:` flip.

## Common Failure Smells
- Tiles dim on cards whose original exists → `CardFaceImage` let the first `error` through (missing `error` emit declaration).
- A failed original throws `Cannot read properties of undefined (reading 'target')` → the emit dropped its `Event` argument.
- Split-card tiles look blurry → the split flag was not passed to `gridImageLadder`.
- The lightbox shows a 600 px image → `openLightbox` was handed the tier URL.
- Dragging the slider past 130 re-requests every tile from the other rung → expected (the ladder changed).
- A slider change leaves a tile on its original after one failure → expected (the flag resets only on a new `imageUrl`); not a bug.
