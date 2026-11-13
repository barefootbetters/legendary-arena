# WP-892 — Registry viewer card images use the WP-888 size tiers: thumb or phone by tile size, phone and large in the detail panel, original as fallback and in the lightbox (registry-viewer)

**Status:** Draft 2026-11-13
**Primary Layer:** registry-viewer (`apps/registry-viewer/src/**`). No engine, registry package, server, arena-client, card-data, `00.2` or R2 change.
**Dependencies (all ✅):**
- WP-888 / D-24840 (the `thumb` / `phone` / `large` tiers at `{set}/{tier}/{file}.webp`, published for every `imageUrl` in `data/cards/*.json`, `immutable`)
- WP-891 / D-24848 (the arena client's tier rule and fallback order; this packet is its named registry-viewer follow-up)
- WP-121 / D-12101 (the card-grid size slider: `MIN_CARD_WIDTH_PX` 80, `MAX_CARD_WIDTH_PX` 260, `DEFAULT_CARD_WIDTH_PX` 130)

**User-Visible Surface:** `cards.legendary-arena.com` (the card grid's image tiles and the card detail panel)
**Risk Tier:** LOW — a read-only catalog app's image `src` / `srcset`; no auth, money, persistence, determinism, gameplay or customer-data surface. A wrong tier URL degrades to the original image, then to the grid's existing dimmed-tile fallback.
**Lane:** Standard (two-session). Not lightweight-eligible: a new component and a D-entry that locks a rendering rule for the app.

> Baseline: `origin/main` at `ef5dd9a28` (WP-891 merged #3329, its live-verify #3330), plus the reserve #3332. registry-viewer `test` 341 / 0 on that tree. Anchors and counts below were measured on it.

---

## Goal

The registry viewer's card grid and detail panel load a WP-888 size tier instead of the full original. A grid tile at the default or a smaller slider size renders `src` = its `thumb` URL with `srcset` = `"<thumb> 1x, <phone> 2x"`; a larger tile, or a split-card face, renders `src` = `phone` with `srcset` = `"<phone> 1x, <large> 2x"`; the detail panel always uses the `phone` / `large` pair. If a tier fails to load, the image retries the original once before the existing fallback. The lightbox ("view full size") keeps the original.

**After this session:** browsing a high-resolution set no longer downloads about 1 MB per card (`co2e` 2.7 MB): a default grid of `co2e` loads about 14 KB per tile at 1x.

## User-Visible Impact

Cards look the same and the grid fills much faster on the six high-resolution sets. Measured from the R2 manifests (`metadata/image-sizes/{set}.json`, 2026-11-13), per card: `co2e` original 2,763 KB → `thumb` 14 KB / `phone` 131 KB; `amwp` 878 → 13 / 92; `bkpt` 1,024 → 16 / 130; `bkwd` 957 → 15 / 106; `mdns` 1,011 → 16 / 130; `msis` 990 → 15 / 108. Across all 3,104 card images: originals 1,188 MB, `thumb` 52 MB, `phone` 310 MB. Low-resolution sets (most of the rest, e.g. `core` at about 160 KB) change little at the `phone` rung and drop about 5× at `thumb`.

## Assumes

1. WP-888 published `thumb`, `phone` and `large` for every `imageUrl` in `data/cards/*.json` (3,104 images; all 41 sets have a manifest at `metadata/image-sizes/{set}.json`, re-checked 2026-11-13). Tiers are by long edge (280 / 840 / 1680 px) and never enlarged, so a portrait card's `thumb` is about 200 px wide and its `phone` about 600 px (smaller when the original is smaller: `core-mm-magneto` original 489 × 685 has `phone` = `large` = 489 × 685).
2. The viewer receives card-face URLs only as `FlatCard.imageUrl` and `FlatCard.physicalCardImageUrl` (`registry/shared.ts:189`, from the same card data at `{metadataBaseUrl}/metadata/{set}.json`). Every one has the form `https://images.legendary-arena.com/{set}/{file}.webp` with `{set}` matching `[a-z0-9]+` (the WP-891 Assumes 1 check, same card data).
3. Card-face `<img>` bindings: `CardGrid.vue:117` (the tile, `loading="lazy"`, split-face class, an inline `@error` that dims the image to `opacity 0.2` and calls `devLog`) and `CardDetail.vue:219` (the panel image inside the lightbox button). `ImageLightbox.vue:55` binds the URL `CardDetail` passes to `openLightbox` (the original). `ThemeGrid.vue:44` and `ThemeDetail.vue:61` bind `theme.comicImageUrl`, an editorial cover hot-linked from comicvine (`content/themes/*.json`, `theme.schema.ts:103`), not a card face. No other `<img>`, `new Image()` or `.src =` in `apps/registry-viewer/src`.
4. Grid tiles: `.grid { grid-template-columns: repeat(auto-fill, minmax(var(--card-grid-min-width), 1fr)) }` with `--card-grid-min-width` = the slider value (`CardGrid.vue:96, :202`), so a tile's width is at least the slider value and less than twice it. The image wrap is `aspect-ratio: 3/4` with `object-fit: cover` (`:206-208`). A split-card face (`physicalCardImageHalf` set) shows one half of a landscape image cropped by `object-position` (`:211-212`), so its visible half needs a source about 1.9× the tile width.
5. Detail panel: `useResizable` `defaultWidth` 320, `minWidth` 240, `maxWidth` 720 (`CardDetail.vue:58-64`); the image is `width: 100%` of the panel (`:482`).
6. The viewer's `test` script is `node --import tsx --test "src/**/*.test.ts" "functions/**/*.test.ts"` with no `vue-sfc-loader`, `@vue/test-utils` or jsdom; it has no component tests. Its SFCs use `<script setup lang="ts">`. `typecheck` is `vue-tsc --noEmit`. `lint` is eslint with `plugin:vuejs-accessibility/recommended` (so every `<img>` needs its own `alt`), CI-gated (`.github/workflows/ci.yml` "Lint viewer"); 0 errors / 533 warnings at `ef5dd9a28`.
7. The viewer imports `@legendary-arena/registry` and may not import `@legendary-arena/game-engine` or any `apps/*` (`.claude/rules/architecture.md` import table); the arena client may not import the registry at runtime. So no runtime module is importable by both apps, and the root `scripts/build-card-image-sizes.mjs` is not importable by either.
8. `cards.legendary-arena.com` deploys from `main` on merge and serves `/version.json` (`{"gitSha":"ef5dd9a"}` at drafting; `6018c89` after #3331 at pre-flight; re-read at AC5), so AC5 can confirm the deployed SHA.

If any assumption is false, STOP and reconcile (update this WP and D-24849) before coding.

## Context (Read First)

- `docs/ai/REFERENCE/00.2-data-requirements.md` §3.1 / §3.2 (`{baseUrl}/{setAbbr}/…webp`; prefer the stored `imageUrl`). This packet rewrites the stored URL by the D-24840 path rule and never builds one.
- `docs/ai/DECISIONS.md` D-24840 (tier path rule, a published tier never changes) and D-24848 (the arena client's `thumb 1x, phone 2x`, the fallback order, and this follow-up).
- `apps/arena-client/src/lib/cardImageTiers.ts` and `components/play/CardImage.vue` (WP-891): the shapes this packet mirrors.
- `wiki/card-image-acquisition.md` §"Size tiers for mobile and offline" and `wiki/r2-image-naming-convention.md` §"Size tiers" / "Registry Viewer".
- `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) and `.claude/rules/architecture.md` §Import Rules: the viewer and arena-client rows, which rule out a runtime module both apps can import (Assumes 7).
- **Why a two-rung ladder, not one pair:** the arena client's surfaces are all ≤ about 150 CSS px, so one `thumb 1x, phone 2x` pair fits. The viewer's grid slider runs 80–260 px and tiles stretch up to twice the slider value, and the detail panel runs 240–720 px. `thumb` (200 px) suits a tile below about 200 px at 1x, so the grid uses it at the default 130 or smaller (tiles under 260 px; typical 130–195 px); above that, and for split faces and the panel, `phone` (600 px) covers 1x and `large` (1,200 px) covers 2x.
- **Why density descriptors with a ladder, not width descriptors with `sizes`:** tier widths vary by orientation (a landscape split image's `thumb` is 280 px wide, a portrait's 200) and shrink when the original is small, so a `w` descriptor per tier would be wrong for many cards; and the grid tile's real width depends on the column count, which `sizes` cannot express from the slider. The ladder needs only the slider value and the split flag, both already in the component.
- **Why the lightbox keeps the original:** its button says "Click to view full size" and it offers a 2× zoom. It is a deliberate one-card action, so it shows the best available image.
- **Why a viewer-local copy of the tier rule (the third copy):** the code-style rule is to abstract at the third copy, but no runtime home is importable by both apps (Assumes 7), and a new shared package for one ten-line function would need an `ARCHITECTURE.md` layer-table change. Each copy is pinned by the same example table (`core-hr-x.webp` → `core/thumb/core-hr-x.webp`; the five non-matching shapes). D-24849 records the exception and names the trigger for extracting a package (a fourth consumer).
- **Why pure-function tests, not component tests:** the viewer has no SFC test harness (Assumes 6); adding `vue-sfc-loader`, `@vue/test-utils` and jsdom is a dependency change out of proportion to one component. The component's logic lives in tested pure functions (`cardImageSources`, `gridImageLadder`, `resolveCardFaceSources`); the binding is covered by `typecheck`, `build` and AC5.
- **Lobby featured-table art (the other D-24848 follow-up) is not in this packet and needs no WP today:** the featured table is hard-coded to `core-mm-magneto`, whose original is 489 × 685 / 83 KB and whose `phone` and `large` tiers are the same size (82 KB). D-24849 records this so the follow-up is re-opened only if the featured table moves to a high-resolution set.

## Non-Negotiable Constraints

**Repo-wide (always apply):** full file contents for every new or modified file (no diffs, no snippets); ESM only, Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` and `.claude/rules/code-style.md` (full-word names, JSDoc on every function, functions about one screen long, no nested ternaries); `node:test` `.test.ts` suites; the viewer imports only what `.claude/rules/architecture.md` allows it.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile before coding. One WP per session.

**Packet-specific:**
- The viewer never builds a card-face URL from anything but `imageUrl` / `physicalCardImageUrl`. No manifest fetch, no set list.
- A URL that does not match the tier rule renders exactly as today: `src` = the URL, no `srcset`.
- The lightbox, the theme comic covers and the data-view tiles are unchanged.
- No CSS size change to any tile, panel or slider; `useCardSize.ts`'s locked surface (D-12101) is unchanged.
- No new dependency; `package.json` and the lockfile are unchanged.

## Locked Values

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

## Scope (In)

- **A) Tier helper** `src/lib/cardImageTiers.ts` per Locked Values, every export with JSDoc, a `// why:` on the URL pattern (mirrors D-24840; the third copy, D-24849), on `SMALL_LADDER_MAX_CARD_WIDTH_PX` (tiles at that slider value or less stay under about 260 px, where a 200 px `thumb` is at most a 30% upscale at 1x) and on the split-face rung (the visible half needs about 1.9× the tile width).
- **B) Component** `src/components/CardFaceImage.vue` per Locked Values; fallback boolean `hasTierFailed`.
- **C) Site migration.** `CardGrid.vue` and `CardDetail.vue` per Locked Values (import, the `gridImageLadder` import in `CardGrid.vue`).
- **D) Tests** `src/lib/cardImageTiers.test.ts`: the WP-888 example for each tier; `null` / pass-through for a root URL (`https://images.legendary-arena.com/agent.webp`), a nested path (`…/core/thumb/x.webp`), another host, a non-`.webp` file and `''`; the exact `small` and `large` `srcset` strings; `gridImageLadder` at 80, 130 (`small`), 140, 260 (`large`) and a split face at 80 (`large`); `resolveCardFaceSources` returns the original with no `srcset` when `hasTierFailed`, and the ladder sources otherwise; `large` appears only in the `large` ladder.
- **E) Docs.** `wiki/r2-image-naming-convention.md` "Registry Viewer" bullet (it now derives tier URLs from `imageUrl`; lightbox original); `wiki/card-image-acquisition.md` client-use note (the registry viewer is no longer a follow-up; the ladder; the lobby-art finding) and Code Touchpoints; `docs/03.1-DATA-SOURCES.md` §Card Images "Consumers" (Registry Viewer tiers + lightbox original); `apps/registry-viewer/CLAUDE.md` Key Files (`CardFaceImage.vue`, `lib/cardImageTiers.ts`).

## Out of Scope

- The lightbox (`ImageLightbox.vue`), theme comic covers, data-view tiles and every other app (arena-client, dashboard, marketing sites).
- Width descriptors / `sizes`; reading `metadata/image-sizes/` manifests; prefetching.
- A shared package for the tier rule (named in D-24849 as the fourth-consumer trigger).
- Adding component-test infrastructure to the viewer.
- The lobby featured-table art (recorded as moot today in D-24849).

## Files Expected to Change

- `apps/registry-viewer/src/lib/cardImageTiers.ts` — **new**
- `apps/registry-viewer/src/lib/cardImageTiers.test.ts` — **new**
- `apps/registry-viewer/src/components/CardFaceImage.vue` — **new**
- `apps/registry-viewer/src/components/CardGrid.vue` — modified (tile image)
- `apps/registry-viewer/src/components/CardDetail.vue` — modified (panel image)
- `wiki/r2-image-naming-convention.md`, `wiki/card-image-acquisition.md`, `docs/03.1-DATA-SOURCES.md`, `apps/registry-viewer/CLAUDE.md` — modified (Scope E)
- Governance (execution close): `docs/ai/DECISIONS.md` (D-24849 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-892-registry-viewer-card-image-tiers.md` — new/modified

## Contract

- `cardImageTierUrl` / `cardImageSources` / `gridImageLadder` / `resolveCardFaceSources`, the URL pattern and `SMALL_LADDER_MAX_CARD_WIDTH_PX`; `CardFaceImage.vue`'s props, `error` emit and fallback order; "every viewer grid and detail card face renders through `CardFaceImage`". A new card-face `<img>` in the viewer that binds `imageUrl` directly is a regression. AC2's grep polices bindings whose expression names an image URL (`imageUrl` / `ImageUrl`); its three expected matches are the lightbox and the two theme comic covers.

## Vision Alignment

**Vision clauses touched:** §2 Content Authenticity (same art, downscaled; the original is the fallback and the lightbox image), §9 Externalized Static Assets, §10a Registry Viewer (the public card and theme browser shows the same legendarycardgame.com-sourced card art, at a size that suits the tile; card data is still consumed as published), §12 Cloud-Friendly Design, §16 Performance & Responsiveness. NG-1..7 not crossed.
**Conflict assertion:** No conflict: this WP preserves all touched clauses.
**Non-Goal proximity:** not crossed.
**Determinism (§22):** no engine, `G`, replay or hash surface is touched.

## Funding Surface Gate

§20 **N/A**: no funding affordance, channel, copy or account surface (WP-097 §A/§B/§C) is touched.

## API Catalog

§21 **N/A**: no `apps/server` endpoint or `Library-only` catalog function is added or changed.

---

## Acceptance Criteria

1. `pnpm --filter registry-viewer test` passes with 0 failures, including every Scope D case; `pnpm --filter registry-viewer typecheck` exits 0; `pnpm --filter registry-viewer lint` exits 0 (0 errors).
2. `git grep -nE ':src="[^"]*[iI]mageUrl' -- apps/registry-viewer/src ':!*.test.ts'` returns exactly 3 matches: `ImageLightbox.vue`, `ThemeDetail.vue`, `ThemeGrid.vue`.
3. `git diff --name-only` ⊆ Files Expected to Change.
4. `pnpm --filter registry-viewer build` exits 0.
5. **Live (D-24026), after deploy:** once `cards.legendary-arena.com/version.json` reports the merge SHA, in the built-in browser with `co2e` shown and the slider at 130 (it persists in localStorage; reset it first), the network log, read **before the lightbox is opened**, shows grid card faces from `images.legendary-arena.com/co2e/thumb/` (1x) or `/co2e/phone/` (2x) and none from a top-level `co2e/<file>.webp`; with the slider then at 200, newly loaded tiles come from `/co2e/phone/` at 1x; selecting a card loads the panel image from `/co2e/phone/` (1x) or `/co2e/large/` (2x); opening the lightbox then loads the original; no tile is dimmed.
6. `pnpm wiki:lint` reports no finding on the two wiki pages; `docs/03.1-DATA-SOURCES.md` §Card Images "Consumers" names the registry viewer's tiers.

## Verification Steps

1. `pnpm install`; `pnpm -r build`; `pnpm --filter registry-viewer test` → 0 fail; `pnpm --filter registry-viewer typecheck` → 0; `pnpm --filter registry-viewer lint` → 0 errors.
2. The AC2 `git grep` → exactly 3 matches: `ImageLightbox.vue`, `ThemeDetail.vue`, `ThemeGrid.vue`.
3. `pnpm --filter registry-viewer build` → 0.
4. `pnpm wiki:lint` → no finding on the two pages; `pnpm ledger:numbers:check` → exit 0; `pnpm roadmap:counts:check` → exit 0; `git diff --name-only` ⊆ Files Expected to Change.
5. After the PR merges and the cards site deploys: open `https://cards.legendary-arena.com/` in the built-in browser, set the slider to 130, filter to `co2e`, read the network requests filtered by `images.legendary-arena.com`, set the slider to 200 and read again, select a card, and only then open the lightbox; record three tier URLs, the lightbox URL and `window.devicePixelRatio` in STATUS.

## Definition of Done

- [ ] ACs 1–4 and 6 pass; allowlist-only diff.
- [ ] D-24849 Active. It records: viewer tier URLs come only from `imageUrl` / `physicalCardImageUrl` via the D-24840 path rule (no manifest or set list); the two-rung ladder (`small` = `thumb 1x, phone 2x` for grid tiles at slider ≤ 130 px; `large` = `phone 1x, large 2x` above that, for split faces and for the detail panel) and why density over width descriptors; split faces take the `large` rung for simplicity, so at 2x the 39 split images fetch `large` where a landscape `phone` would usually suffice (accepted); a non-matching URL renders unchanged; the fallback order (tier → original once → the grid's dimmed tile); the lightbox keeps the original; `CardFaceImage.vue` as the single viewer card-face `<img>` outside the lightbox; the third-copy exception with the fourth-consumer trigger for a shared package; and the lobby featured-table finding (moot while the featured table is `core-mm-magneto`). STATUS and D-24849 state which paths AC5 did not exercise live (the 2x candidates, the tier → original fallback), as D-24848 did.
- [ ] 01.6 post-mortem written (a new component abstraction and an app-wide rendering rule trigger it).
- [ ] STATUS entry (user-visible on `cards.legendary-arena.com` after deploy); WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `pnpm roadmap:counts:write` then `roadmap:counts:check` 0; ledger LANDED.
- [ ] Two-commit topology: `EC-930:` (code, tests, docs), then the `SPEC:` close.
- [ ] **Live-on-surface verification (AC5)** done after deploy with the network evidence in STATUS. If the deploy has not happened when the PR closes, STATUS says "live-verify pending", and a follow-up `SPEC:` commit flips it with the evidence.

## Reserved Decision (lands at execution)

**D-24849 — registry-viewer-card-image-tiers.** It locks everything in the DoD item above. Reserved in NUMBER-LEDGER (#3332); written Active in the execution `SPEC:` close.

## Settled Design Questions (drafting decisions, 2026-11-13)

1. **Two-rung density ladder** over one pair or width descriptors (§Context).
2. **Threshold at the default slider (130 px).** At or below it a tile is under 260 px wide, so `thumb` at 1x is at worst a 30% upscale and typically under 10%; above it the `phone` rung avoids visible blur on large tiles.
3. **Split faces always take the `large` rung**, because the visible half is drawn from about 1.9× the tile width. Accepted cost (01.4 RS-1): 39 split images (cvwr 20, mgtg 8, xmen 5, bkwd 3, msis 3) fetch `large` at 2x where a landscape `phone` (420 px per half) would cover most tiles; a per-orientation rung is not worth the extra rule.
4. **Lightbox stays original.** It is the explicit full-size view.
5. **Viewer-local tier rule** (third copy) with a pinned example table, not a new package (§Context).
6. **Pure-function tests**, no new SFC test harness (§Context).
7. **Fallback via a component**, matching WP-891: the inline grid handler cannot tell a tier failure from an original failure.

## Lint Gate Self-Review (00.3)

Independent subagent runs (2026-11-13), after copilot Round 2.

**Run 1: FAIL** on one text-only item, fixed:
- §17: §10a Registry Viewer added to the vision clauses (00.3 §17.1 names the cards site as a trigger).

Advisories applied: Context cites the layer-boundary sources behind the third-copy decision (§4); Verification Steps 2 and 4 state their expected output (§13).

**Run 2: PASS** (the §17 fix and both advisories confirmed; EC unchanged, Locked Values and tier still identical; nothing regressed).

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Constraints | PASS |
| §3 Assumes | PASS (anchors re-checked; baseline grep 5) |
| §4 Context | PASS (00.2 §3.1 / §3.2, D-24840 / D-24848, layer-boundary sources) |
| §5 Files | PASS (5 code, 4 docs, 7 governance) |
| §6 Naming | PASS |
| §7 Dependencies | PASS (none new; no `package.json` or lockfile change) |
| §8 Boundaries | PASS (viewer-local; only `imageUrl` / `physicalCardImageUrl`; no manifest) |
| §9 Windows | PASS (`curl.exe`, single-quoted pathspecs) |
| §10 Env vars | N/A: none introduced |
| §11 Auth | N/A: no auth surface |
| §12 Tests | PASS (`node:test` pure functions; no network, DB or boardgame.io) |
| §13 Verification | PASS (each step states its expected output) |
| §14 ACs | PASS (AC2 5 → 3 checked against the tree) |
| §15 / §15.1 / §15.2 | PASS (cards.legendary-arena.com with AC5 live evidence; LOW, EC identical) |
| §16 Code style | PASS (third-copy exception justified and recorded in D-24849) |
| §17 Vision | PASS (§2, §9, §10a, §12, §16) |
| §18 Prose-vs-grep | PASS (the EC forbids quoting the policed binding) |
| §19 Bridge-vs-HEAD | N/A: commit-time rule |
| §20 Funding | N/A, justified |
| §21 API catalog | N/A, justified |
| EC-TEMPLATE | PASS (Locked Values byte-identical, tier identical, typecheck, lint, live check, mindmap) |

## Gate Record

**Pre-flight (01.4), independent subagent, 2026-11-13.**

**Round 1: NOT READY → READY TO EXECUTE** after one text-only blocker (no re-run required; scope unchanged):
- **PS-1:** `CardFaceImage`'s root `<img>` had no `alt`; the viewer's CI `lint` (`vuejs-accessibility/recommended`) would fail on it (probe: `img elements must have an alt prop`; baseline 0 errors / 533 warnings). Fixed: `alt: string` is a required prop bound on the `<img>`; `lint` added to AC1, Verification Step 1, Assumes 6 and both EC checklists.

Recommended items applied: **RS-1** the split-face `large` rung's 2x over-fetch on 39 split images recorded as accepted (Settled Q3, DoD); **RS-2** the deploy SHA note in Assumes 8; **RS-3** the slider-crossing re-request listed as an expected EC smell.

Verified by the agent: every anchor; AC2 5 → 3; all `imageUrl` values match the pattern; the Locked Values typecheck as written (`cardSize` top-level ref, the optional split field, a static `ladder` literal, the `Event` payload, parent scoped CSS on the child root); EC Locked Values byte-identical; WP-888 / WP-891 / WP-121 `[x]`; live HEADs 200 `image/webp` on `co2e` tiers; viewer tests 341 / 0; the third copy is not a blocker (00.6 Rule 1 limits early abstraction; no shared runtime home exists).

**Copilot (01.7), independent subagent, 2026-11-13.**

**Round 1: RISK → HOLD**, three findings, all wording or staging, no scope change (no pre-flight re-run):
- **Mode 30:** the 01.4 fixes were in the working tree but not staged; re-staged and checked in `git diff --cached`.
- **Mode 26:** AC5 opened the lightbox (an original) in the same window it asserts no originals, and the slider persists in localStorage. AC5, Verification Step 5 and the EC live line now reset the slider to 130, read the log before the lightbox, and check slider 200 → `phone` at 1x.
- **Mode 11:** the emit-with-`Event` path has no automated test (no SFC harness). The EC now requires the typed emit `defineEmits<{ error: [event: Event] }>()` with `emit('error', event)`, lists the undefined-`target` smell, and the DoD makes STATUS and D-24849 name the paths AC5 did not exercise live.

Verified by the agent: the `<script setup>` fallback design (declared emit keeps the parent listener off the `<img>`; the pre-flush watch reset), per-tile ladder re-evaluation, types and lint, no missed surface, Locked Values byte-identical, EC length, commit topology.

**Round 2: PASS.** All three fixes confirmed in the files; nothing regressed.

**Round 3: PASS** (confirmation after the 00.3 text edits): no copilot finding, scope, allowlist, AC or Locked Value changes; the Gate Record matches rounds 1–2.
