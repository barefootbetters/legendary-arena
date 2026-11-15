# WP-891 — Arena client play-surface card images use the WP-888 size tiers: thumb at 1x, phone at 2x, original as fallback (arena-client)

**Status:** Draft 2026-11-12
**Primary Layer:** arena-client (`apps/arena-client/src/**`). No engine, registry, server, `UIState`, card-data, `00.2` or R2 change.
**Dependencies (all ✅):**
- WP-888 / D-24840 (the `thumb` / `phone` / `large` tiers at `{set}/{tier}/{file}.webp`, published to R2 for all 3,104 referenced card faces, `immutable`)
- WP-410 / D-24222 (`UIState.matchCardImageUrls` and `useCardImagePrefetch.ts`, which warms the match's card images at the setup screen)
- WP-178 (CardTile card-image rendering with `loading="lazy"` and the name-tile fallback on a load error)

**User-Visible Surface:** `play.legendary-arena.com` (every card face in a match: board, hand, City, HQ, prompts, the Battle Brief, the notable-event overlay, the card reader and the villain-slash VFX art)
**Risk Tier:** MEDIUM — client application logic on every card-face render and the setup prefetch; no auth, money, persistence, determinism or customer-data surface. A wrong tier URL degrades to the original image, then to the existing name tile.
**Lane:** Standard (two-session). Not lightweight-eligible: about 35 code/test files, a new component, and D-24848 locks a client-wide rendering invariant.

> Baseline: `origin/main` at `561fecab` (WP-888 closed #3315, the R2 copy-only docs #3325), plus the reserve #3326. Anchors and counts below were measured on that tree.

---

## Goal

Every card face on the arena client's play surface loads a size tier instead of the full original. A card image renders `src` = its `thumb` URL with `srcset` = `"<thumb> 1x, <phone> 2x"`, so a 1x screen downloads the 280 px tier and a high-density screen the 840 px tier. If a tier fails to load, the image retries the original URL once before the existing fallback runs. The WP-410 setup prefetch warms the same image the board will request.

**After this session:** a match's card images are tens of kilobytes each instead of up to 2.7 MB (`co2e`), so the board paints sooner and a phone on cellular downloads far less. The art is the same; only its pixel size matches the screen.

## User-Visible Impact

Cards look the same and load faster. Today every card face downloads its original: `co2e` averages 2.7 MB per card, `core` 157 KB. After this packet a 1x screen downloads `thumb` (about 15 KB per card) and a 2x or denser screen downloads `phone` (about 94 KB `core`, 131 KB `co2e`). For a `co2e` setup the prefetch drops from hundreds of megabytes to about 2 MB (1x) or 19 MB (2x).

## Assumes

1. WP-888 published `thumb`, `phone` and `large` for every one of the 3,104 distinct card-face URLs in `data/cards/*.json`, at `https://images.legendary-arena.com/{set}/{tier}/{file}.webp` (D-24840; AC5 curl on `3dtc` and `co2e` passed). Every referenced card-face URL has the form `https://images.legendary-arena.com/{set}/{file}.webp`, and every set abbreviation matches `[a-z0-9]+` (all 41 `data/cards/*.json` basenames).
2. On the play surface, the client receives card-face URLs only as `imageUrl` strings in projected display data (`UIState` `imageUrl`, `packages/game-engine/src/ui/uiState.types.ts:389`) and in `UIState.matchCardImageUrls` (WP-410). It never constructs one, and it may not import the registry at runtime.
3. Card-face `<img>` bindings: 30 `:src` bindings in 27 SFCs under `apps/arena-client/src/components/play/` (§Files Expected to Change; `OptionalKoRewardPrompt.vue` has 3 and `BattleBrief.vue` 2), plus the villain-slash art `art.src = imageUrl` in `VfxOverlay.vue:865` and the warm `image.src = imageUrl` in `useCardImagePrefetch.ts:50`. `AbilityText.vue:76` binds icon SVGs, not card faces. `CardReaderModal`, `SchemeTile`, `HandRow`, `PlayedCardsRow` and `SharedDecks` render card faces through `CardTile`.
4. No **play-surface** card face renders wider than about 150 CSS px or taller than about 210 CSS px before the desktop fit-scale: the CardTile widths are `clamp(60px, 4.4vw, 76px)` / `clamp(90px, 6.6vw, 112px)` / `clamp(120px, 8.8vw, 150px)` (`styles/base.css:69-71`; `apps/arena-client/src/pages/PlayDesktop.vue:1549-1551` sets 54 / 80 / 108 px), the reader modal uses CardTile `lg`, prompt thumbnails are at most 60 px, and the notable-event image is at most `12rem` tall. A `thumb` is 200 × 280 for a portrait card, a `phone` 600 × 840. The one card face outside the play surface, the lobby featured-table art (`lobby/ArenaEntrance.vue:181-186`, `min(30vw, 420px)` wide, a URL hard-coded in `lobby/featuredTable.ts:54` rather than a projected `imageUrl`), is out of scope.
5. The desktop board is authored at 1280 × 720 and scaled with `transform: translateX(-50%) scale(var(--play-fit-scale, 1))` (`apps/arena-client/src/pages/PlayDesktop.vue:1543`, WP-688 / D-24502). `srcset` density descriptors select by `devicePixelRatio` only, not by CSS transforms.
6. CardTile's `<img>` (`CardTile.vue:113-121`) is guarded by `hasImage()` and sets `imageLoadFailed` on `@error` (`:83-89`), which swaps in the name tile. The prompt and overlay `<img>` bindings have no error handler.
7. Arena-client SFCs use `defineComponent({ setup() { return {...} } })` (the EC-132 §2 whitelist), and its tests run under `node:test` with `@legendary-arena/vue-sfc-loader/register` and jsdom (`package.json` `test`). Vue removes an attribute bound to `null` or `undefined`.
8. Existing tests that assert a set-path card `src` (and so change expectation): `HQRow.test.ts:426-429` (`mdns/mdns-vi-fallen-metarchus.webp`), `SharedDecks.test.ts:162-165` (`core/core-so-officer.webp`) and `useCardImagePrefetch.test.ts` (`MANIFEST_10` = `https://images.legendary-arena.com/set/card-<n>.webp`, `:93-96`, asserted at `:114`, plus the failed-warm case at `:121`). Tests whose fixtures use root URLs without a set folder (`CardTile.test.ts:29`, `NotableEventOverlay.test.ts:553`, `PlayDesktop.test.ts:619`, `CardReaderModal.test.ts`) keep their expectations, because a URL that does not match the tier rule renders unchanged.

If any assumption is false, STOP and reconcile (update this WP and D-24848) before coding.

## Context (Read First)

- `docs/ai/REFERENCE/00.2-data-requirements.md` §3.1 R2 Base URL and §3.2 Image URL Construction (`{baseUrl}/{setAbbr}/…webp`; prefer the stored `imageUrl`). This packet does that: it rewrites the projected URL and never builds one.
- `docs/ai/DECISIONS.md` D-24840 (the tier key format and the path rule, the published-tier-never-changes rule) and D-24222 (the prefetch).
- `wiki/card-image-acquisition.md` §"Size tiers for mobile and offline" (the tier table: `thumb` for board slots, `phone` for zoom and the airplane-mode download, `large` for desktop and 4K zoom) and `wiki/r2-image-naming-convention.md` §"Size tiers".
- `wiki/airplane-mode.md` §"Which image sizes": the offline download uses `phone`; this packet does not touch offline storage.
- `apps/arena-client/src/components/play/CardTile.vue`, `composables/useCardImagePrefetch.ts` (+ test), `components/play/VfxOverlay.vue:855-880`.
- `scripts/build-card-image-sizes.mjs:67` `tierUrlFor`: the rule this packet mirrors (`/<tier>` before the final path segment). A root script cannot be imported by an app, so the client carries its own copy with a test that pins the same examples.
- **Why density descriptors (`1x` / `2x`), not width descriptors with `sizes`:** every card surface is at most about 150 CSS px wide (Assumes 4), so `thumb` covers 1x and `phone` covers up to 4x. Width descriptors would need a `sizes` value per surface and still ignore the fit-scale transform (Assumes 5). The cost is small: a 1x desktop scaled to about 2× shows a 216 px card from a 200 px `thumb`, about an 8% upscale. A high-density phone always takes `phone`, which is what a sharp card needs there.
- **Why one component, not a helper at each site:** the tier-to-original fallback has to live with every `<img>`, and 27 SFCs have no error handler today. One `CardImage.vue` owns `src`, `srcset` and the fallback, and each site swaps `<img :src>` for `<CardImage :image-url>`.
- **Why one packet, not a CardTile packet then a prompts packet:** the prefetch moves to the tiers in the same change. A split would leave prompts and overlays requesting originals the prefetch no longer warms, a mid-turn round-trip WP-410 exists to prevent. The site edits are a mechanical one-element swap.

## Non-Negotiable Constraints

**Repo-wide (always apply):** full file contents for every new or modified file (no diffs, no snippets); ESM only, Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` and `.claude/rules/code-style.md` (full-word names, JSDoc on every function, functions about one screen long, no nested ternaries); `node:test` `.test.ts` suites; no `boardgame.io` import; arena-client imports only what `.claude/rules/architecture.md` allows it (no `registry` at runtime).

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile before coding. One WP per session.

**Packet-specific:**
- The client never builds a card-face URL from anything but a projected `imageUrl`. No manifest fetch, no set list, no registry read.
- A URL that does not match the tier rule renders exactly as today: `src` = the URL, no `srcset`.
- `large` is not referenced by the arena client.
- No engine, `UIState`, registry, server, card-data or R2 change. No CSS size change to any card surface.
- No existing test assertion is weakened. The three Assumes 8 tests change their expected URL to the tier URL, intentionally, and the commit body says so.

## Locked Values

- **Module** `apps/arena-client/src/lib/cardImageTiers.ts`:
  - `export const CARD_IMAGE_BASE_URL = 'https://images.legendary-arena.com';`
  - `export type CardImageTier = 'thumb' | 'phone' | 'large';` (the D-24840 tier names)
  - `export function cardImageTierUrl(imageUrl: string, tier: CardImageTier): string | null` — returns `null` unless `imageUrl` matches `^https://images\.legendary-arena\.com/[a-z0-9]+/[^/]+\.webp$`; otherwise inserts `/<tier>` before the final path segment: `https://images.legendary-arena.com/core/core-hr-x.webp` → `https://images.legendary-arena.com/core/thumb/core-hr-x.webp`.
  - `export function cardImageSources(imageUrl: string): { src: string; srcset: string | null }` — a matching URL gives `{ src: <thumb>, srcset: '<thumb> 1x, <phone> 2x' }`; any other string (including `''`) gives `{ src: imageUrl, srcset: null }`.
- **Component** `apps/arena-client/src/components/play/CardImage.vue` (`name: 'CardImage'`): prop `imageUrl: { type: String, required: true }`; `emits: ['error']`; renders exactly one root `<img :src="sources.src" :srcset="sources.srcset ?? undefined">`, where the computed `sources` is `cardImageSources(imageUrl)` until the fallback and `{ src: imageUrl, srcset: null }` after it; attributes (`class`, `alt`, `loading`, `data-testid`, `title`) falling through. On the first `error` while a `srcset` is in use, it switches to `src` = the original `imageUrl` with no `srcset`; on an `error` with no tier in use, it emits `error`. A change of `imageUrl` resets the fallback.
- **Every card-face `<img>`** in the 27 SFCs becomes `<CardImage :image-url="<the same expression>" …>`, keeping its other attributes and `v-if`. CardTile binds `@error="onImageError"` on `CardImage`, so its name tile appears only after the original also fails.
- **VFX art** (`VfxOverlay.vue`): `art.src` / `art.srcset` from `cardImageSources(imageUrl)` (srcset set only when not `null`); `art.onerror` switches once to the original (`removeAttribute('srcset')`, `src = imageUrl`). `art.onerror` is attached only when `srcset` is not `null`, and its first statement is `art.onerror = null`.
- **Prefetch** (`useCardImagePrefetch.ts`, `warmOneImage`): sets `image.srcset` (when not `null`) then `image.src` from `cardImageSources(imageUrl)`; on a tier error it warms the original once with a fresh `const fallbackImage = new Image()` that sets `fallbackImage.src = imageUrl` only, then resolves; when `srcset` is `null`, an error resolves with no second warm. `warmedImageUrls` stays keyed by the original `imageUrl`; `PREFETCH_CONCURRENCY` stays 6.

## Scope (In)

- **A) Tier helper** `src/lib/cardImageTiers.ts` per Locked Values, every export with JSDoc and a `// why:` on the URL pattern (it also matches non-card single-folder `.webp` files such as avatars, which is harmless because only card-face sites call it).
- **B) Component** `src/components/play/CardImage.vue` per Locked Values. Its fallback state is a boolean named with `is` / `has` (for example `hasTierFailed`).
- **C) Site migration.** The 30 card-face `<img>` bindings in the 27 SFCs swap to `CardImage` (import and `components` registration added in each); `VfxOverlay.vue`'s art element and `useCardImagePrefetch.ts`'s warm use `cardImageSources`.
- **D) Tests.**
  - `src/lib/cardImageTiers.test.ts`: the WP-888 example URL for each tier; `null` / pass-through for a root URL (`https://images.legendary-arena.com/agent.webp`), a nested path (`…/core/thumb/x.webp`), another host, a non-`.webp` file and `''`; the exact `srcset` string.
  - `src/components/play/CardImage.test.ts` (jsdom fires no image `load` / `error` on its own, so each case dispatches it: `await image.trigger('error'); await nextTick()`): a set-path URL renders `src` = thumb and the exact `srcset`; a root URL renders `src` unchanged with no `srcset` attribute; a first `error` switches to the original with no `srcset` and emits nothing; a second `error` emits `error` once; a root-URL `error` emits at once; fall-through `class` / `alt` / `data-testid` land on the `<img>`; a new `imageUrl` restores the tier sources.
  - `useCardImagePrefetch.test.ts`: the fake `Image` records `srcset` as well as `src`; `MANIFEST_10` expectations become the thumb URLs with their `srcset`; the failed-warm case (`:121-149`) is rewritten to assert one original warm on a fresh image after a tier failure (so its distinct-`src` count grows by one) and that the batch still completes; one added case: a non-matching URL that fails is warmed once, with no second warm; idempotency is unchanged.
  - `VfxOverlay.test.ts`: one added case — a set-path art URL sets the tier `src` and `srcset`, and an `error` switches the art to the original with no `srcset`. The existing fixture (`images.example/villain.webp`) does not match the pattern, so current cases are unaffected.
  - `HQRow.test.ts:426-429` and `SharedDecks.test.ts:162-165`: the expected `src` becomes the `thumb` URL (Assumes 8).
  - `CardTile.test.ts`: one added case — a set-path `imageUrl` renders the tier `src` / `srcset`, and the name tile appears only after two `error` events.
- **E) Docs.** `wiki/card-image-acquisition.md` (the built-status note's "No client reads the tiers yet" becomes the WP-891 / D-24848 client use; Code Touchpoints gain `cardImageTiers.ts` and `CardImage.vue`); `wiki/r2-image-naming-convention.md` (the prefetch section says it warms the tier the board renders); `wiki/airplane-mode.md` (the "Image sizes" row's "No screen uses them yet: every screen still gets the original" (`:136`) becomes the play surface's `thumb` / `phone` use, and the `thumb` bullet under "Which image sizes" says the board renders `thumb` at 1x and `phone` at 2x); `docs/03.1-DATA-SOURCES.md` §Card Images (`:147`; it lists only the original path) gains the `{abbr}/{tier}/{file}.webp` tier path and the arena client as a consumer.

## Out of Scope

- The registry viewer (`cards.legendary-arena.com`), the dashboard, the marketing sites and any other app.
- A larger zoom view, `large` in the arena client, width descriptors / `sizes`, reading `metadata/image-sizes/` manifests.
- Airplane mode: service worker, Cache Storage, the download button (`wiki/airplane-mode.md` sequences it).
- `UIState.matchCardImageUrls` and every engine or server file; card data; R2 objects; the cache-control runbook.
- Avatars, icons (`AbilityText.vue`), audio and skins.
- The lobby featured-table art (`lobby/ArenaEntrance.vue`, up to 420 CSS px, a hard-coded URL rather than a projected `imageUrl`): it needs `phone` or `large` and is a named follow-up.

## Files Expected to Change

- `apps/arena-client/src/lib/cardImageTiers.ts` — **new**
- `apps/arena-client/src/lib/cardImageTiers.test.ts` — **new**
- `apps/arena-client/src/components/play/CardImage.vue` — **new**
- `apps/arena-client/src/components/play/CardImage.test.ts` — **new**
- `apps/arena-client/src/components/play/` — modified, `<img>` → `CardImage`: `BattleBrief.vue`, `CardTile.vue`, `DiscardToPlayPrompt.vue`, `HQRow.vue`, `NotableEventOverlay.vue`, `OptionalKoRewardPrompt.vue`, `OptionalPutBottomHQPrompt.vue`, `PendingCopyPowersChoicePrompt.vue`, `PendingDefeatChoicePrompt.vue`, `PendingDiscardChoicePrompt.vue`, `PendingElectromagneticBubbleChoicePrompt.vue`, `PendingGiveHqHeroChoicePrompt.vue`, `PendingHeroChoicePrompt.vue`, `PendingKoDiscardChoicePrompt.vue`, `PendingKoHeroChoicePrompt.vue`, `PendingMelterKoChoicePrompt.vue`, `PendingPutCardsOnDeckChoicePrompt.vue`, `PendingReorderChoicePrompt.vue`, `PendingRevealThreeAssignPrompt.vue`, `PendingRevealTopDisposePrompt.vue`, `PendingRuthlessDictatorChoicePrompt.vue`, `PendingScryKoChoicePrompt.vue`, `PutAnyNumberBottomHQPrompt.vue`, `PutHandOnDeckTopPrompt.vue`, `ReturnOnDiscardPrompt.vue`, `ReturnZeroCostDiscardPrompt.vue`, `SmashDiscardPrompt.vue` (27)
- `apps/arena-client/src/components/play/VfxOverlay.vue` — modified (art sources and fallback)
- `apps/arena-client/src/composables/useCardImagePrefetch.ts`, `useCardImagePrefetch.test.ts` — modified
- `apps/arena-client/src/components/play/CardTile.test.ts`, `HQRow.test.ts`, `SharedDecks.test.ts`, `VfxOverlay.test.ts` — modified (Scope D)
- `wiki/card-image-acquisition.md`, `wiki/r2-image-naming-convention.md`, `wiki/airplane-mode.md`, `docs/03.1-DATA-SOURCES.md` — modified
- Governance (execution close): `docs/ai/DECISIONS.md` (D-24848 appended Active), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-891-client-card-image-tiers.md` — new/modified

A further existing test that asserts a set-path card-face `src` and fails only because of the tier URL is an allowed inline amendment (expectation update, recorded in §Execution Amendments). Any other unexpected failure is a STOP.

## Contract

- `cardImageTierUrl` / `cardImageSources` and the URL pattern; `CardImage.vue`'s prop, `error` emit and fallback order; "every play-surface card-face image renders through `CardImage` or `cardImageSources`". A new play-surface card-face `<img>` that binds `imageUrl` directly is a regression. The AC2 grep polices only bindings whose expression names an image URL (`imageUrl` / `ImageUrl` / `ImageForCell`), so it catches the existing naming, not every possible one.

## Vision Alignment

**Vision clauses touched:** §2 Content Authenticity (same card art, downscaled; the original is the fallback; names, text and semantics untouched), §9 Externalized Static Assets, §12 Cloud-Friendly Design, §16 Performance & Responsiveness. NG-1..7 not crossed (NG-1, no pay-to-win, untouched).
**Conflict assertion:** No conflict: this WP preserves all touched clauses.
**Non-Goal proximity:** not crossed.
**Determinism (§22):** no engine, `G`, replay or hash surface is touched.

## Funding Surface Gate

§20 **N/A**: no funding affordance, channel, copy or account surface (WP-097 §A/§B/§C) is touched.

## API Catalog

§21 **N/A**: no `apps/server` endpoint or `Library-only` catalog function is added or changed.

---

## Acceptance Criteria

1. `pnpm --filter @legendary-arena/arena-client test` passes with 0 failures, including every Scope D case; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
2. `git grep -nE ':src="[^"]*([iI]mageUrl|ImageForCell)' -- apps/arena-client/src ':!*.test.ts'` returns nothing, and `git grep -n "src = imageUrl" -- apps/arena-client/src ':!*.test.ts'` returns exactly 2 matches: `VfxOverlay.vue` (inside `art.onerror`) and `useCardImagePrefetch.ts` (the fresh fallback image).
3. `git diff --name-only` ⊆ Files Expected to Change (plus any recorded inline test amendment).
4. In a local `pnpm --filter @legendary-arena/arena-client build`, the build exits 0.
5. **Live (D-24026), after deploy:** on `play.legendary-arena.com`, in a new match, the network log shows card-face requests to `images.legendary-arena.com/<set>/thumb/` (1x) or `/<set>/phone/` (2x) and none to a top-level `<set>/<file>.webp` for a card that has tiers; the board, a prompt thumbnail and the Battle Brief images render; no card shows the name tile. The lobby featured-table art still loads its original (out of scope) and is ignored.
6. `pnpm wiki:lint` reports no finding on the three wiki pages; `git grep -n "No screen uses them yet" -- wiki/airplane-mode.md` and `git grep -n "No client reads the tiers yet" -- wiki/card-image-acquisition.md` return nothing; `docs/03.1-DATA-SOURCES.md` §Card Images contains `{tier}`.

## Verification Steps

1. `pnpm install`; `pnpm -r build`; `pnpm --filter @legendary-arena/arena-client test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0.
2. The two `git grep` checks of AC2.
3. `pnpm --filter @legendary-arena/arena-client build` → 0.
4. `pnpm wiki:lint`; `pnpm ledger:numbers:check`; `pnpm roadmap:counts:check`; `git diff --name-only` against the allowlist.
5. After the PR merges and `play.legendary-arena.com` deploys: open a new match in the built-in browser, read the network requests filtered by `images.legendary-arena.com`, and record three tier URLs and the device pixel ratio (`window.devicePixelRatio`) in STATUS.

## Definition of Done

- [ ] ACs 1–4 and 6 pass; allowlist-only diff.
- [ ] D-24848 Active. It records: client tier URLs come only from projected `imageUrl` via the D-24840 path rule (no manifest, set list or registry); `src` = `thumb`, `srcset` = `thumb 1x, phone 2x`, `large` unused by the arena client, and the density-over-width choice with the fit-scale trade-off (Assumes 4–5); a non-matching URL renders unchanged; the fallback order (tier → original once → the surface's existing fallback); `CardImage.vue` as the single play-surface card-face `<img>`; the prefetch warms the same sources and keys its idempotency by the original URL; and the named follow-ups (registry viewer tiers; a zoom view using `large`; the lobby featured-table art; and for airplane mode, a 1x board requests `thumb` while the offline download is `phone`, so the service worker must answer a `thumb` request from the downloaded `phone` copy, or download both).
- [ ] 01.6 post-mortem written (a new component abstraction and a client-wide rendering contract trigger it).
- [ ] STATUS entry (user-visible on `play.legendary-arena.com` after deploy); WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `pnpm roadmap:counts:write` then `roadmap:counts:check` 0; ledger LANDED.
- [ ] Two-commit topology: `EC-929:` (code, tests, docs), then the `SPEC:` close.
- [ ] **Live-on-surface verification (AC5)** done after deploy with the network evidence in STATUS. If the deploy has not happened when the PR closes, STATUS says "live-verify pending", and a follow-up `SPEC:` commit flips it with the evidence.

## Reserved Decision (lands at execution)

**D-24848 — client-card-image-tiers.** It locks everything in the DoD item above. Reserved in NUMBER-LEDGER (#3326); written Active in the execution `SPEC:` close.

## Settled Design Questions (drafting decisions, 2026-11-12)

1. **Density descriptors over width descriptors** (§Context). No card surface exceeds about 150 CSS px, so two candidates cover every screen; `sizes` would add a per-surface constant and still miss the fit-scale.
2. **`large` stays unused by the arena client.** No surface is large enough to need it; it is for a future zoom view and the registry viewer.
3. **Fallback to the original, then the existing fallback.** A set added later whose size step has not run still shows its art (one extra request), instead of every card turning into a name tile.
4. **One component.** The fallback cannot be a bare `:src` helper; 27 SFCs have no error handler.
5. **No manifest read.** The path rule plus the fallback is enough; manifests stay for the airplane-mode size label.
6. **The prefetch keeps keying by the original URL**, so a re-sent manifest stays a no-op whichever candidate the browser chose.

## Lint Gate Self-Review (00.3)

Independent subagent runs (2026-11-12), after copilot Round 2.

**Run 1: FAIL** on two text-only items, both fixed:
- §4: Context now cites `00.2` §3.1 / §3.2 (the image URL shape the pattern matches; this packet rewrites the stored URL and never builds one).
- §17: §2 Content Authenticity added to the vision clauses.

Advisories applied: the `PlayDesktop.vue` path is qualified and line 1543 quoted exactly (§6); AC6 now checks the doc text (§14); the fallback flag gets an `is` / `has` name (§16). §5's ~45 files are accepted: Context justifies one packet, and the 27 SFC edits are a mechanical swap.

**Run 2: PASS** (both fixes and the three advisories confirmed; EC unchanged and still verbatim).

| § | Verdict |
|---|---|
| §1 Structure | PASS |
| §2 Constraints | PASS |
| §3 Assumes | PASS |
| §4 Context | PASS (00.2 §3.1 / §3.2 cited) |
| §5 Files | PASS (~45 files; one packet justified in Context) |
| §6 Naming | PASS |
| §7 Dependencies | PASS (none new) |
| §8 Boundaries | PASS (projected `imageUrl` only; no registry, no game logic) |
| §9 Windows | PASS (`curl.exe`, single-quoted pathspecs) |
| §10 Env vars | PASS: none introduced |
| §11 Auth | N/A: no auth surface |
| §12 Tests | PASS (`node:test` + jsdom; no network, DB or boardgame.io) |
| §13 Verification | PASS |
| §14 ACs | PASS |
| §15 / §15.1 / §15.2 | PASS (play.legendary-arena.com with AC5 live evidence; MEDIUM, EC verbatim) |
| §16 Code style | PASS |
| §17 Vision | PASS (§2, §9, §12, §16) |
| §18 Prose-vs-grep | PASS (the EC forbids quoting the policed literals) |
| §19 Bridge-vs-HEAD | N/A: commit-time rule |
| §20 Funding | N/A, justified |
| §21 API catalog | N/A, justified |
| EC-TEMPLATE | PASS (Locked Values verbatim, tier identical, ~47 lines, typecheck, live check, mindmap) |

## Gate Record

**Pre-flight (01.4), independent subagent, 2026-11-12.**

**Round 1: READY TO EXECUTE, conditional on PS-1** (a text-only fix that narrows scope; no re-run required):
- **PS-1:** the lobby featured-table art (`lobby/ArenaEntrance.vue:181-186`, `min(30vw, 420px)`, a hard-coded URL) is a card face the draft's "every card face" claim missed and Assumes 4's 150 px ceiling did not hold for. Fixed by scoping the packet to the play surface: Goal, Assumes 4, Out of Scope, Contract, the D-24848 DoD follow-ups and AC5 now say so.

Recommended items applied:
- **RS-1:** `wiki/airplane-mode.md:136` ("No screen uses them yet") added to Scope E.
- **RS-2:** AC2 greps exclude test files; `CardImage.vue`'s own binding locked as `sources.src`; the Contract says what the gate polices.
- **RS-3:** CardImage tests dispatch `error` themselves (jsdom fires no image events).
- **RS-4:** the prefetch fallback warms the original on a fresh `new Image()`; the failed-warm test is rewritten.
- **RS-5:** `VfxOverlay.test.ts` added with one tier case.
- **RS-6:** the airplane-mode `thumb` / `phone` mismatch named as a D-24848 follow-up.
- **RS-7:** `docs/03.1-DATA-SOURCES.md` §Card Images added to Scope E.
- **RS-8:** the pattern's avatar overlap is stated in the `// why:`.
- **RS-9** (no change): reserve #3326 must merge before execution, which the EC's first Before Starting item already requires.

Verified by the agent: the 30 bindings in 27 SFCs and that the only other `<img>` / `new Image` / `.src =` sites are icons, the profile avatar and the lobby art; every anchor; the tests that change and those that don't; Vue `emits` / `null`-attribute behaviour, jsdom `srcset` reflection and detached-`Image` candidate selection; all 3,104 card URLs match the pattern; live HEAD 200 `image/webp` `immutable` on `core/{thumb,phone,large}/core-so-officer.webp`; EC Locked Values byte-identical; WP-888 / WP-410 / WP-178 `[x]`.

**Copilot (01.7), independent subagent, 2026-11-12.**

**Round 1: RISK → HOLD**, five findings, all wording or Locked-Value tightening with no scope change (no pre-flight re-run):
- **Mode 22:** the VFX art's `onerror` could reload forever when the original also fails. Locked: it is attached only when `srcset` is not `null` and clears itself first. Also locked: the prefetch resolves a non-tier error with no second warm, which gets a new test case.
- **Mode 26 / 20:** Assumes 2 contradicted the lobby art. It now says "on the play surface".
- **Mode 12:** the WORK_INDEX row, the EC_INDEX row, the title and the mindmap node now say "play surface", and the EC_INDEX row names `03.1-DATA-SOURCES.md`.
- **Mode 11:** the prefetch fallback's literal is locked (`fallbackImage.src = imageUrl`), so AC2's second grep is "exactly 2 matches". The EC guardrail now covers both policed literals, including template comments.
- **Mode 30:** the 00.3 record must be filled in before Step 6, and the reserve #3326 must merge before execution (the EC's first Before Starting item).

Verified by the agent: the layer boundary; every anchor; that the allowlist is complete (no other test asserts a set-path `src`, no `shallowMount`, `html()` checks look up testids only); the Scope D cases are specifiable in jsdom; the Locked Values are byte-identical; `vue-tsc` accepts the `required: true` string prop at every site; the commit topology; the D-24026 path; and the EC size.

**Round 2: PASS.** All four in-place fixes confirmed in the files; the EC Locked Values match the WP's; `roadmap:counts:check` exits 0; scope, allowlist and layer boundary unchanged, so no pre-flight re-run.

**Round 3: PASS** (confirmation after the 00.3 text edits): no copilot finding changes. One parity nit applied with no re-run: the EC's After Completing now lists AC6's doc-text greps.
