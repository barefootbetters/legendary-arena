# EC-320 — Cards Tab "View Loadout as Cards" (Execution Checklist)

**Source:** docs/ai/work-packets/WP-288-cards-tab-view-loadout-as-cards.md
**Layer:** Registry Viewer (`apps/registry-viewer`)

## Before Starting (Hard Gate)
- [ ] WP-279 landed: `grep -c "loadoutDraftApi" apps/registry-viewer/src/App.vue` ≥ 1 and `test -f apps/registry-viewer/src/components/LoadoutTray.vue` → OK (the shared draft + tray this builds on)
- [ ] Worktree built once (`pnpm -r build`) so the viewer typechecks against the registry dist
- [ ] Baseline snapshot (record now, compare at close): `pnpm --filter registry-viewer typecheck` → **0 errors**; `pnpm --filter registry-viewer test` → record passing count **X**. At close: typecheck still 0; test count **=== X + the new `loadoutGalleryCards` tests**, with no other suite delta

## Locked Values (do not re-derive)
- Composition fields read (00.2 §8.1, verbatim): `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`
- Membership key is `card.extId` (the set-qualified group ext_id, D-24018) — NOT `card.key`
- `compositionExtIdSet`: deduped `Set`; **skip** empty single slots (`schemeId === ""` / `mastermindId === ""`); built with `for...of`, never `.reduce()`
- Composition source = `loadoutDraftApi.value.draft.composition` (`MatchSetupDocument["composition"]`); read-only
- Gallery stage is the **final** stage of `applyFilters()`, after the WP-270 mechanic stage; **inert** when `loadoutGalleryActive` is false (existing paths byte-identical)
- `navigateToLoadoutGallery()` mirrors `navigateToCard`: `activeView='cards'` + `loadoutGalleryActive=true` + clear the same other filter refs + `applyFilters()`; no-op (early return, no throw) on an empty composition
- Banner is inline in `App.vue` (NOT a new component); shows while `loadoutGalleryActive`; `✕` calls `clearLoadoutGallery()` (sets false + `applyFilters()`)
- Both entry points emit `view-as-cards` (no payload); `App.vue` routes both to `navigateToLoadoutGallery()`

## Guardrails
- Read-only: the helper and components NEVER mutate the draft, the composition, or the card list — the gallery stage only narrows a local array
- No new LAGN loader: the only LAGN/JSON import stays the Loadout tab's `onFileImport`/`onPasteImport` (do NOT add a second loader or a dropdown)
- No engine / contract / draft-logic change: do NOT edit `useLoadoutDraft` mutation/validation, `setupContract`, any `.types.ts`/`.validate.ts`/`.gating.ts`, or `MatchSetupConfig`
- No forbidden import in `loadoutGalleryCards.ts` / `LoadoutBuilder.vue` / `LoadoutTray.vue` (`game-engine`/`server`/`dashboard`/`boardgame.io`/`scripts/`); helper is boardgame.io-free
- `CardGrid.vue` is unchanged — the gallery narrows `filteredCards`, the grid is untouched
- `for...of` / explicit `if/else` (no branching `.reduce()`); full-word names; `is*`/`has*` booleans
- Do NOT touch the WP-279 add-to-loadout button (`CardDetail.vue`), the tray pill visibility logic, the Loadout picker, `LoadoutPreview.vue`, `useSetupFromUrl`, or the Cards filters (WP-278)

## Required `// why:` Comments
- On the gallery stage in `applyFilters`: inert when `loadoutGalleryActive` is false (existing filter paths unchanged)
- On the `navigateToLoadoutGallery` empty-composition early return (no-op, no throw)
- On the filter-clear in `navigateToLoadoutGallery` (mirrors `navigateToCard` — "view THIS loadout" replaces, not ANDs with, prior filters)

## Files to Produce
- `lib/loadoutGalleryCards.ts` (new — `compositionExtIdSet`/`isCardInLoadoutComposition`)
- `lib/loadoutGalleryCards.test.ts` (new — node:test coverage)
- `App.vue` (modified — `loadoutGalleryActive`; gallery `applyFilters` stage; `navigateToLoadoutGallery`/`clearLoadoutGallery`; inline banner; route `view-as-cards`)
- `components/LoadoutBuilder.vue` (modified — "🖼 View as cards" button, disabled when empty; emit `view-as-cards`)
- `components/LoadoutTray.vue` (modified — secondary "View as cards" action; emit `view-as-cards`)
- `DECISIONS.md` (D-24072 → Active) + `WORK_INDEX.md` + `EC_INDEX.md` + `STATUS.md` (governance close)

## File Responsibilities (no logic duplication)
- `lib/loadoutGalleryCards.ts` — the SINGLE source of composition→ext_id-set expansion + membership. `App.vue` must not re-encode it
- `App.vue` — owns the gallery state, the `applyFilters` stage (calls the helper), entry/exit handlers, the banner, and routing both `view-as-cards` events. No expansion logic of its own
- `components/LoadoutBuilder.vue` / `components/LoadoutTray.vue` — presentation only: emit `view-as-cards`, render the affordance. NO draft/composition mutation, NO gallery logic

## Required Test Matrix (`lib/loadoutGalleryCards.test.ts` — every row required)
- `compositionExtIdSet`: collects all 5 fields into one set; dedups a repeated id; **skips** empty `schemeId`/`mastermindId`; empty composition → empty set
- `isCardInLoadoutComposition`: card whose `extId` ∈ set → true; card not in set → false
- group→member expansion: two cards sharing one group `extId` both match the set built from that single group id (proves a hero group renders all its member cards)

## After Completing
- [ ] Helper + tests cover collection / dedup / empty-slot skip / member-card expansion / membership
- [ ] `App.vue` gallery mode inert when off (existing filters byte-identical); entry clears other filters; banner `✕` exits; both `view-as-cards` events routed
- [ ] Button disabled on empty composition; `navigateToLoadoutGallery` no-op on empty; no new loader/dropdown
- [ ] No forbidden import; helper boardgame.io-free; `CardGrid` + draft-logic/contract untouched
- [ ] `typecheck` 0; `test` 0 (count preserved + new helper tests); `build` 0
- [ ] LIVE: load a LAGN on the Loadout tab → "View as cards" → Cards tab shows that loadout's cards (hero group → all member cards; scheme + mastermind present; unrelated absent); banner clears; tray action enters identically; WP-279 button + tray pill + Loadout export unchanged
- [ ] D-24072 lands (Active); WORK_INDEX/EC_INDEX/STATUS flipped
- [ ] Commit prefix `EC-320:` (code) + `SPEC:` (governance); D-24026 live-verify post-deploy

## Common Failure Smells
- Gallery shows zero cards for a valid loadout → membership keyed on `card.key` not `card.extId`, or the composition empty-slot strings weren't skipped (`""` poisoning the set)
- A hero group shows only one card → set built from `card.key` (per-member) instead of the group `extId`; member cards share the group `extId`
- An existing filter path changed → the gallery stage isn't gated on `loadoutGalleryActive` (must be inert when off)
- Banner won't clear / grid stuck on the subset → `clearLoadoutGallery` didn't reset `loadoutGalleryActive` before `applyFilters()`
- Crash entering the gallery before data loads → stage/handler not guarded on `loadoutDraftApi.value` presence
- Button enabled on a blank draft enters an empty gallery → missing the empty-composition `:disabled` + handler no-op
