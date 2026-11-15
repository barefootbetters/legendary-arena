# EC-929 — Client card image tiers (Execution Checklist)

**Source:** docs/ai/work-packets/WP-891-client-card-image-tiers.md
**Layer:** arena-client (`apps/arena-client/src/**`)
**Risk Tier:** MEDIUM — client application logic on every card-face render and the setup prefetch; no auth, money, persistence, determinism or customer-data surface. A wrong tier URL degrades to the original image, then to the existing name tile.

## Before Starting
- [ ] Baseline `origin/main` includes #3315 (WP-888), #3326 (reserve) and the WP-891 draft SPEC.
- [ ] `pnpm install`; `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
- [ ] Re-run WP Assumes 3: `git grep -nE ':src="[^"]*([iI]mageUrl|ImageForCell)' -- apps/arena-client/src` lists 30 bindings in the 27 SFCs of §Files to Produce; `VfxOverlay.vue:865` and `useCardImagePrefetch.ts:50` assign the raw URL.
- [ ] `curl.exe -sI https://images.legendary-arena.com/core/thumb/core-so-officer.webp` and `.../core/phone/core-so-officer.webp` → 200 `image/webp`.
- [ ] Scope lock: the target file set is exactly §Files to Produce; anything else needs an inline amendment (WP §Files Expected to Change), else STOP.

## Locked Values (do not re-derive)
- **Module** `apps/arena-client/src/lib/cardImageTiers.ts`:
  - `export const CARD_IMAGE_BASE_URL = 'https://images.legendary-arena.com';`
  - `export type CardImageTier = 'thumb' | 'phone' | 'large';` (the D-24840 tier names)
  - `export function cardImageTierUrl(imageUrl: string, tier: CardImageTier): string | null` — returns `null` unless `imageUrl` matches `^https://images\.legendary-arena\.com/[a-z0-9]+/[^/]+\.webp$`; otherwise inserts `/<tier>` before the final path segment: `https://images.legendary-arena.com/core/core-hr-x.webp` → `https://images.legendary-arena.com/core/thumb/core-hr-x.webp`.
  - `export function cardImageSources(imageUrl: string): { src: string; srcset: string | null }` — a matching URL gives `{ src: <thumb>, srcset: '<thumb> 1x, <phone> 2x' }`; any other string (including `''`) gives `{ src: imageUrl, srcset: null }`.
- **Component** `apps/arena-client/src/components/play/CardImage.vue` (`name: 'CardImage'`): prop `imageUrl: { type: String, required: true }`; `emits: ['error']`; renders exactly one root `<img :src="sources.src" :srcset="sources.srcset ?? undefined">`, where the computed `sources` is `cardImageSources(imageUrl)` until the fallback and `{ src: imageUrl, srcset: null }` after it; attributes (`class`, `alt`, `loading`, `data-testid`, `title`) falling through. On the first `error` while a `srcset` is in use, it switches to `src` = the original `imageUrl` with no `srcset`; on an `error` with no tier in use, it emits `error`. A change of `imageUrl` resets the fallback.
- **Every card-face `<img>`** in the 27 SFCs becomes `<CardImage :image-url="<the same expression>" …>`, keeping its other attributes and `v-if`. CardTile binds `@error="onImageError"` on `CardImage`, so its name tile appears only after the original also fails.
- **VFX art** (`VfxOverlay.vue`): `art.src` / `art.srcset` from `cardImageSources(imageUrl)` (srcset set only when not `null`); `art.onerror` switches once to the original (`removeAttribute('srcset')`, `src = imageUrl`). `art.onerror` is attached only when `srcset` is not `null`, and its first statement is `art.onerror = null`.
- **Prefetch** (`useCardImagePrefetch.ts`, `warmOneImage`): sets `image.srcset` (when not `null`) then `image.src` from `cardImageSources(imageUrl)`; on a tier error it warms the original once with a fresh `const fallbackImage = new Image()` that sets `fallbackImage.src = imageUrl` only, then resolves; when `srcset` is `null`, an error resolves with no second warm. `warmedImageUrls` stays keyed by the original `imageUrl`; `PREFETCH_CONCURRENCY` stays 6.

## Guardrails
- Card-face URLs come only from projected `imageUrl`; no manifest fetch, set list, registry import or new `UIState` field.
- Play surface only: the lobby featured-table art (`lobby/ArenaEntrance.vue`) is out of scope and keeps its original.
- A non-matching URL renders exactly as today (`src` unchanged, no `srcset`); `large` is never referenced.
- No engine, server, registry, card-data, R2 or card-surface CSS change.
- Only the three WP Assumes 8 tests change an expected URL (to the tier URL, said in the commit body); a further set-path `src` expectation is an inline amendment; any other failure is a STOP. No assertion is weakened.
- `CardImage` declares `emits: ['error']`, so a parent `@error` never sees the first (tier) failure.
- Keep the AC2 grep gates clean: do not quote either policed literal (a `:src` binding naming an image URL, or the fallback assignment) in comments, JSDoc or template comments; paraphrase.
- `defineComponent({ setup() { return {...} } })`; full-word names; JSDoc on every function; no nested ternaries.

## Required `// why:` Comments
- `cardImageTiers.ts` URL pattern: mirrors D-24840's path rule; only set-folder `.webp` card faces have tiers (avatars also match, harmless: only card-face sites call it).
- `cardImageSources` density descriptors: card surfaces are at most about 150 CSS px wide, so `thumb` covers 1x and `phone` 2x+; `srcset` ignores the fit-scale transform.
- `CardImage.vue` fallback: a set published before its size step still shows its art.
- `useCardImagePrefetch.ts`: the warm uses the same `src` / `srcset` so the browser picks the candidate the board will request; idempotency stays keyed by the original URL.

## Files to Produce
- `apps/arena-client/src/lib/cardImageTiers.ts`, `cardImageTiers.test.ts` — **new** — tier URL rule and sources
- `apps/arena-client/src/components/play/CardImage.vue`, `CardImage.test.ts` — **new** — the card-face `<img>` with fallback
- `apps/arena-client/src/components/play/` — **modified** — `<img>` → `CardImage`: `BattleBrief.vue`, `CardTile.vue`, `DiscardToPlayPrompt.vue`, `HQRow.vue`, `NotableEventOverlay.vue`, `OptionalKoRewardPrompt.vue`, `OptionalPutBottomHQPrompt.vue`, `PendingCopyPowersChoicePrompt.vue`, `PendingDefeatChoicePrompt.vue`, `PendingDiscardChoicePrompt.vue`, `PendingElectromagneticBubbleChoicePrompt.vue`, `PendingGiveHqHeroChoicePrompt.vue`, `PendingHeroChoicePrompt.vue`, `PendingKoDiscardChoicePrompt.vue`, `PendingKoHeroChoicePrompt.vue`, `PendingMelterKoChoicePrompt.vue`, `PendingPutCardsOnDeckChoicePrompt.vue`, `PendingReorderChoicePrompt.vue`, `PendingRevealThreeAssignPrompt.vue`, `PendingRevealTopDisposePrompt.vue`, `PendingRuthlessDictatorChoicePrompt.vue`, `PendingScryKoChoicePrompt.vue`, `PutAnyNumberBottomHQPrompt.vue`, `PutHandOnDeckTopPrompt.vue`, `ReturnOnDiscardPrompt.vue`, `ReturnZeroCostDiscardPrompt.vue`, `SmashDiscardPrompt.vue`
- `apps/arena-client/src/components/play/VfxOverlay.vue` — **modified** — art sources and fallback
- `apps/arena-client/src/composables/useCardImagePrefetch.ts`, `useCardImagePrefetch.test.ts` — **modified**
- `apps/arena-client/src/components/play/CardTile.test.ts`, `HQRow.test.ts`, `SharedDecks.test.ts`, `VfxOverlay.test.ts` — **modified** — WP Scope D
- `wiki/card-image-acquisition.md`, `wiki/r2-image-naming-convention.md`, `wiki/airplane-mode.md`, `docs/03.1-DATA-SOURCES.md` — **modified** — WP Scope E
- `docs/ai/DECISIONS.md` (D-24848), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-891-client-card-image-tiers.md` — governance close

## After Completing
- [ ] `pnpm -r build` → 0; `pnpm --filter @legendary-arena/arena-client test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm --filter @legendary-arena/arena-client build` → 0.
- [ ] AC2 greps (test files excluded): no direct card-face `:src` binding; the policed assignment returns exactly 2 matches (`VfxOverlay.vue` inside `art.onerror`, `useCardImagePrefetch.ts` on the fresh fallback image).
- [ ] `pnpm wiki:lint` → no finding on the three pages; AC6 doc-text greps (both stale sentences gone; `{tier}` in 03.1 §Card Images); `ledger:numbers:check` 0; allowlist-only `git diff --name-only`.
- [ ] D-24848 Active (every WP DoD clause); 01.6 post-mortem written; STATUS entry; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `pnpm roadmap:counts:write` then `roadmap:counts:check` 0; ledger LANDED.
- [ ] Two commits: `EC-929:` (code, tests, docs), then `SPEC:` close.
- [ ] Live-on-surface (AC5, D-24026): after deploy, a new match on `play.legendary-arena.com` requests `/<set>/thumb/` or `/<set>/phone/` card faces, no tiered card loads its top-level original, and no card shows the name tile; three URLs plus `devicePixelRatio` go in STATUS. Not yet deployed at close → STATUS "live-verify pending" and a follow-up `SPEC:` flip.

## Common Failure Smells
- A parent's name tile appears on a card whose original exists → `CardImage` let the first `error` fall through (missing `emits`).
- Every prompt image 404s on a root-URL fixture → the pattern accepted URLs with no set folder.
- The board refetches images the prefetch already warmed → the warm set `src` only, not the same `srcset`.
- A missing image reloads forever in the VFX layer → `art.onerror` was not cleared first, or was attached for a non-tier URL.
- A re-sent manifest re-warms everything → idempotency was keyed by the tier URL.
- The prefetch test hangs after a tier failure → the fallback reused the failed image (the fake has no `removeAttribute`); warm the original on a fresh `new Image()`.
- A `CardImage` test never reaches the fallback → jsdom fires no image events; dispatch with `await image.trigger('error')`.
