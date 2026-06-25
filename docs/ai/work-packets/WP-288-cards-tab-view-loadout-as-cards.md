# WP-288 — Cards Tab "View Loadout as Cards" (Gallery Filter + Loadout-Tab / Tray Entry Points)

**Status:** Draft — ready to execute (drafted 2026-06-24)
**Primary Layer:** Registry Viewer (`apps/registry-viewer`)
**User-Visible Surface:** `cards.legendary-arena.com` (Registry Viewer — Cards tab gallery + a "View as cards" affordance on the Loadout tab and the floating Loadout tray)
**Dependencies:** WP-279 (shared `useLoadoutDraft` lifted to `App.vue` + `LoadoutTray.vue`) ✅ Done 2026-06-22; WP-278 (current Cards filter surface + post-`applyQuery` filter-stage pattern) ✅; WP-091 (`useLoadoutDraft` + LAGN/JSON import on the Loadout tab) ✅; WP-245 (LAGN export) ✅. All landed.
**Baseline:** `origin/main` @ `25fa59cf` (2026-06-24).

---

## Goal

From the Loadout tab — or the floating Loadout tray, reachable from any tab — a
player clicks **"🖼 View as cards"** once and the Cards tab renders the cards of the
currently-loaded loadout / LAGN file as a gallery: the existing Cards grid, narrowed
to exactly the cards in the shared draft's composition. A dismissible banner
(`Viewing loadout — N cards · ✕`) marks the state and clears it. Because WP-279 already
lifted the loadout draft to `App.vue` as one **shared** instance, a LAGN imported on the
Loadout tab is already in state the Cards tab can read — so this is a one-click
*load → view* with no re-selection, no dropdown, no account, and no persistence. The
gallery is a **filter mode** over the existing Cards tab (operator-chosen — not a new
tab or a second grid). `pnpm --filter registry-viewer typecheck`, `test`, and `build`
exit 0.

---

## Assumes

- **WP-279 shipped the shared draft + the tray.** `App.vue` owns exactly one
  `useLoadoutDraft` instance in a `shallowRef` (`loadoutDraftApi`), instantiated
  post-registry-load; `LoadoutBuilder.vue` consumes it as the `draftApi` prop; and
  `LoadoutTray.vue` is a presentation-only floating pill that emits `open`. (Verified at
  `apps/registry-viewer/src/App.vue` `loadoutDraftApi` + `apps/registry-viewer/src/components/LoadoutTray.vue`; D-24054.)
- **The Loadout tab already imports LAGN / JSON files.** `LoadoutBuilder.vue` has
  `onFileImport` (a file input → `FileReader.readAsText`) and `onPasteImport`, both
  routing to `loadFromJson`, which mutates the **same shared draft**. So "the loaded
  LAGN" is the shared draft's composition — no new loader is added here. (Verified at
  `apps/registry-viewer/src/components/LoadoutBuilder.vue`.)
- **The Cards tab filters cards through a post-`applyQuery` filter-stage chain.**
  `applyFilters()` in `App.vue` runs `registry.value.query(q)` then narrows the result
  through successive `for`/`.filter` stages (twist, pattern, abilities, WP-270 mechanic)
  before assigning `filteredCards.value`; `CardGrid` renders `:cards="filteredCards"`.
  A new gallery stage slots into this chain with no grid change. (Verified at
  `apps/registry-viewer/src/App.vue` `applyFilters`, lines ~591–671 + `:cards="filteredCards"`.)
- **The Themes tab already cross-navigates into a filtered Cards view.** `navigateToCard`
  sets `activeView = 'cards'`, sets the filter refs, and calls `applyFilters()`. The new
  `navigateToLoadoutGallery` mirrors this exactly. (Verified at `apps/registry-viewer/src/App.vue` `navigateToCard`.)
- **`FlatCard.extId` is the set-qualified group ext_id the composition stores, shared
  across a hero's member cards** (`core/wolverine` on every Wolverine member card), and
  scheme / mastermind are single cards keyed by the same id-space. So
  `card.extId ∈ composition` expands each group pick to its full member-card set and
  matches the two single slots. (Verified at `apps/registry-viewer/src/registry/types/types-index.ts`; D-24018 / D-10014.)
- **The composition block is `draft.composition`** with the canonical fields `schemeId`,
  `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`
  (`MatchSetupDocument["composition"]`; verified at `apps/registry-viewer/src/composables/useLoadoutDraft.ts`).

---

## Context

WP-279 closed the Cards → Loadout direction (add a viewed card to the loadout). It named
the **reverse** — "view in Cards" from the loadout — as an explicit fast-follow, out of
scope there. This WP delivers the broader form the operator actually wants: not a
single-chip cross-link, but a **full gallery** of the loaded loadout / LAGN file rendered
as cards. The operator's framing: *"a full LAGN gallery view is really what the Themes
tab is, but just for a subset of cards."* A loaded loadout is structurally an unsaved
theme (same `setupIntent`-shaped composition), and the Themes tab already renders a
curated subset as a card gallery with a Themes→Cards cross-link — so this reuses two
shipped paths (the WP-279 shared draft and the `navigateToCard` cross-nav) rather than
inventing a surface.

**Why a filter mode, not a dropdown or a new tab (operator decision, 2026-06-24).** An
earlier idea was a "Custom LAGN files" filter dropdown sourced from an account or from
prior Loadout-tab uploads. The operator rejected it as too many steps (upload on Loadout
→ switch to Cards → open a dropdown → pick the file) and confusing. The dropdown also
solves a *different* problem — picking from a **saved library** of LAGN files — which
requires identity + a storage backend the viewer (a public, no-auth, R2-static SPA) does
not have. Viewing the *one* loadout already in memory needs no list: WP-279 globalized
the draft, so the gallery reads it directly. The account-backed LAGN library + dropdown
is a genuine later feature, deferred here and explicitly named in `## Scope (Out)`.

**Why filtered-Cards-tab over a dedicated gallery view (operator decision, 2026-06-24).**
The Cards tab *is* the card gallery (grid, detail panel, size slider, the WP-279
add-to-loadout button). Constraining it to the loadout subset reuses all of that for the
cost of one filter stage + a banner, versus a parallel read-only gallery component that
would duplicate rendering. Single WP, single layer (`apps/registry-viewer`); no layer
crossing.

---

## Scope (In)

- A boardgame.io-free helper `loadoutGalleryCards.ts` that turns a composition into the
  deduped set of its member-card ext_ids and a card-membership predicate (the testable
  invariant), unit-tested with `node:test`.
- A **gallery filter mode** in `App.vue`: a `loadoutGalleryActive` boolean state, a final
  narrowing stage in `applyFilters()` (mirroring the WP-270 mechanic stage), a
  `navigateToLoadoutGallery()` entry handler (mirroring `navigateToCard`), and a
  `clearLoadoutGallery()` exit.
- A dismissible **banner** rendered inline in `App.vue` above the Cards grid while the
  gallery mode is active: `Viewing loadout — {count} cards` + a `✕` that exits the mode.
- A **"🖼 View as cards"** button on the Loadout tab (`LoadoutBuilder.vue`), near the
  existing Download / import controls, disabled when the composition has zero picks;
  emits `view-as-cards`.
- A secondary **"View as cards"** action on the floating tray (`LoadoutTray.vue`),
  alongside the existing "Go to loadout →"; emits `view-as-cards`.

## Scope (Out)

- **No account / saved-LAGN library and no "Custom LAGN files" dropdown.** Picking from a
  stored set of LAGN files (account-backed or localStorage) is a separate, heavier
  feature gated on the viewer having identity + storage it does not have today. Named
  fast-follow.
- **No new LAGN loader.** The gallery reads the **existing** shared draft; the only LAGN
  upload remains the Loadout tab's `onFileImport` / `onPasteImport` (unchanged).
- **No reverse single-chip "view in Cards" cross-link from a loadout chip** — the narrow
  WP-279 fast-follow; this WP ships the whole-loadout gallery instead. The per-chip jump
  may be added later.
- **No further-filtering-within-the-gallery UI** (e.g., "only the Tech heroes in this
  loadout"). Entering the gallery clears the other filters; the gallery stage still
  composes as an AND if a filter is subsequently touched (existing `applyFilters`
  semantics), but no dedicated within-gallery filter affordance is added.
- **No new tab and no second grid component.** The gallery is a mode over the existing
  Cards tab; `CardGrid.vue` is unchanged.
- Any change to `useLoadoutDraft`'s draft mutation / validation logic, `setupContract`,
  any `.types.ts` / `.validate.ts` / `.gating.ts`, `MatchSetupConfig`, the engine /
  registry package / server / `data/cards` / feed; no new HTTP endpoint; no
  persistence / determinism surface.

---

## Files Expected to Change

- `apps/registry-viewer/src/App.vue` — **modified** — `loadoutGalleryActive` state; the gallery narrowing stage in `applyFilters`; `navigateToLoadoutGallery()` + `clearLoadoutGallery()`; the inline banner; handle `view-as-cards` from `LoadoutBuilder` and `LoadoutTray`. (Same-layer runtime-wiring file per `01.5`.)
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — add the "🖼 View as cards" button (emit `view-as-cards`), disabled on an empty composition.
- `apps/registry-viewer/src/components/LoadoutTray.vue` — **modified** — add the secondary "View as cards" action (emit `view-as-cards`).
- `apps/registry-viewer/src/lib/loadoutGalleryCards.ts` — **new** — pure helper: `compositionExtIdSet` + `isCardInLoadoutComposition` (no boardgame.io).
- `apps/registry-viewer/src/lib/loadoutGalleryCards.test.ts` — **new** — `node:test` coverage (collection / dedup / empty-slot skip / member-card expansion / membership).
- `docs/ai/DECISIONS.md` — **modified** (D-24072 reserved at draft; Active at execution).
- `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md` / `docs/ai/STATUS.md` — **modified** (index rows at draft; STATUS at execution / govern-close).

**~9 files (3 modified components/wiring + 1 new helper + 1 new test; 4 governance).**

---

## Contract

### A. Pure helper `loadoutGalleryCards.ts` (new) — the testable invariant

A boardgame.io-free module so composition → member-card-set expansion is unit-tested
without a Vue harness (mirrors WP-279's `loadoutCardActions.ts`):

- `compositionExtIdSet(composition): Set<string>` — collect, into one deduped `Set`,
  the non-empty `schemeId`, the non-empty `mastermindId`, and every entry of
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`. Empty-string single slots
  (`schemeId === ""` / `mastermindId === ""`) are **skipped**. Built with an explicit
  `for...of` over each array (no `.reduce()`). `composition` is the draft's composition
  block (`MatchSetupDocument["composition"]`), read by the canonical field names only.
- `isCardInLoadoutComposition(card, extIdSet): boolean` — `extIdSet.has(card.extId)`,
  where `card` is `{ extId: string }`. The set-qualified ext_id (`card.extId`, D-24018)
  is the membership key — **never** `card.key`.

The helper reads **only** the five canonical composition fields and never mutates the
composition, the draft, or the card list.

### B. `App.vue` gallery filter mode (wiring)

- New ref `loadoutGalleryActive: Ref<boolean>` (default `false`).
- `applyFilters()` gains a **final** narrowing stage, after the WP-270 mechanic stage:
  when `loadoutGalleryActive` is `true` and the draft is present, narrow
  `filteredCards.value` to the cards whose `extId` is in
  `compositionExtIdSet(loadoutDraftApi.value.draft.composition)` via
  `isCardInLoadoutComposition`. When `false`, the chain is unchanged (byte-for-byte
  behavior for every existing filter path). The stage uses the §A helper — `App.vue`
  does not re-encode the expansion.
- `navigateToLoadoutGallery()` mirrors `navigateToCard`: set `activeView = 'cards'`, set
  `loadoutGalleryActive = true`, **clear** the other filter refs (search / set / hero
  class / types / patterns — the same refs `navigateToCard` clears), then
  `applyFilters()`. It is a no-op guard when the composition is empty (the entry points
  are disabled in that state, but the handler also early-returns defensively without
  throwing).
- `clearLoadoutGallery()` sets `loadoutGalleryActive = false` and calls `applyFilters()`
  (restores normal browsing — all cards, no gallery narrowing).
- `App.vue` handles `@view-as-cards` from both `LoadoutBuilder` and `LoadoutTray` by
  calling `navigateToLoadoutGallery()`.

### C. Inline banner (in `App.vue`, no new component)

- Rendered in the Cards template, above `CardGrid`, **only** when
  `loadoutGalleryActive === true`. Shows `🖼 Viewing loadout — {{ filteredCards.length }}
  cards` and a `✕` button bound to `clearLoadoutGallery()`. Presentation only; never
  throws. Kept inline (not a new component) to hold the file budget.

### D. Entry points (`LoadoutBuilder.vue` + `LoadoutTray.vue`)

- `LoadoutBuilder.vue`: a **"🖼 View as cards"** button near the Download LAGN / import
  controls. `:disabled` when the composition has zero picks (so an empty draft cannot
  enter an empty gallery). Click emits `view-as-cards` (no payload — `App.vue` owns the
  shared draft and the view state). It reads composition emptiness from the existing
  `draftApi` prop; it adds no slot/draft-mutation logic.
- `LoadoutTray.vue`: a secondary **"View as cards"** action alongside the existing
  "Go to loadout →". New emit `view-as-cards: []`. The tray already only renders when the
  draft has ≥1 pick (App-gated, D-24054), so the action is never shown on an empty draft.
  Presentation only; no new props, no mutation.

**Gallery-mode state table (deterministic):**

| Trigger | `loadoutGalleryActive` | `activeView` | other filter refs | `filteredCards` |
|---|---|---|---|---|
| `view-as-cards` (composition non-empty) | `true` | `'cards'` | cleared | loadout subset |
| banner `✕` / `clearLoadoutGallery()` | `false` | unchanged | unchanged | full chain (no gallery stage) |
| `view-as-cards` (composition empty) | unchanged (`false`) | unchanged | unchanged | unchanged (no-op) |

---

## User-Visible Impact

On `cards.legendary-arena.com`: (1) the Loadout tab shows a "🖼 View as cards" button by
the Download / import controls; (2) the floating Loadout tray gains a "View as cards"
action; (3) clicking either jumps to the Cards tab showing only the loaded loadout /
LAGN's cards, with a `Viewing loadout — N cards · ✕` banner that clears the mode. No
change to the Loadout tab's builder / picker / validation / export, the Cards-tab filters
(WP-278), or the WP-279 add-to-loadout button and tray pill.

## Vision Alignment

Affirmatively on-vision per **Vision §10a** (the registry viewer is a public tool that
helps players inspect cards and build / share game setups). Letting a player *see* a
shared LAGN file as cards — without hunting each one by name — lowers the friction of the
"build a game and share it with others" loop this app exists for, and complements WP-279's
build direction with a view direction. **Non-Goal proximity:** none — no monetization,
identity, account-gating, competitive / PvP, scoring, RNG, or determinism surface is
touched; the account-backed LAGN library that *would* approach the identity surface is
explicitly deferred (`## Scope (Out)`). "Loadout" / "LAGN" framing is hero-vs-villain
setup authoring (no player-interaction terminology per §23(b)). Determinism line: N/A (no
scoring / replay / RNG).

---

## Acceptance Criteria

1. `loadoutGalleryCards.ts` exposes `compositionExtIdSet` (deduped Set of the 5
   composition fields, skipping empty single slots, built with `for...of` not `.reduce()`)
   and `isCardInLoadoutComposition` (membership by `card.extId`); both are boardgame.io-free
   and unit-tested (**AC-1**).
2. With `loadoutGalleryActive` false, `applyFilters()` produces byte-identical
   `filteredCards` to before for every existing filter path (the gallery stage is inert
   when off) (**AC-2**).
3. Clicking "🖼 View as cards" on the Loadout tab with a non-empty composition switches to
   the Cards tab and narrows the grid to exactly the loadout's cards: every member card of
   each picked hero / villain / henchman group plus the scheme and mastermind cards, and
   nothing else (**AC-3**).
4. The banner renders only while the gallery mode is active, shows the current card count,
   and its `✕` exits the mode and restores full browsing (`filteredCards` returns to the
   unnarrowed chain) (**AC-4**).
5. The tray's "View as cards" action enters the gallery identically; the Loadout-tab button
   is disabled on an empty composition and the `navigateToLoadoutGallery` handler is a
   no-op on an empty composition (no throw) (**AC-5**).
6. A hero group with multiple member cards shows all of its member cards in the gallery
   (group→member expansion), proven by a `compositionExtIdSet` / `isCardInLoadoutComposition`
   unit test using two cards that share one group `extId` (**AC-6**).
7. No change to the Loadout tab's builder / picker / validation / export / URL-preview, the
   WP-279 add-to-loadout button + tray pill, or the Cards-tab filters (no regression) (**AC-7**).
8. No forbidden import (`game-engine` / `server` / `dashboard` / `boardgame.io` / `scripts/`)
   in the touched files; the helper is boardgame.io-free (grep) (**AC-8**).
9. `pnpm --filter registry-viewer typecheck` 0; `test` 0 (prior count preserved + the new
   helper tests); `build` 0 (no `__vite-browser-external`) (**AC-9**).

---

## Verification Steps

```bash
# 1. New files present
test -f apps/registry-viewer/src/lib/loadoutGalleryCards.ts && echo OK
test -f apps/registry-viewer/src/lib/loadoutGalleryCards.test.ts && echo OK

# 2. Gallery wiring in App.vue (state + entry + exit)
grep -F "loadoutGalleryActive" apps/registry-viewer/src/App.vue && echo OK
grep -F "navigateToLoadoutGallery" apps/registry-viewer/src/App.vue && echo OK

# 3. Entry points emit view-as-cards
grep -F "view-as-cards" apps/registry-viewer/src/components/LoadoutBuilder.vue && echo OK
grep -F "view-as-cards" apps/registry-viewer/src/components/LoadoutTray.vue && echo OK

# 4. Helper is boardgame.io-free + no forbidden import in touched files
grep -RInE "(@legendary-arena/game-engine|apps/server|apps/dashboard|boardgame\.io|(^|/|\.\./)scripts/)" \
  apps/registry-viewer/src/lib/loadoutGalleryCards.ts \
  apps/registry-viewer/src/components/LoadoutBuilder.vue \
  apps/registry-viewer/src/components/LoadoutTray.vue && echo "FAIL: forbidden import" || echo OK

# 5. No new LAGN loader added (the only import stays on the Loadout tab)
grep -c "readAsText\|onFileImport" apps/registry-viewer/src/components/LoadoutBuilder.vue   # unchanged from baseline

# 6. typecheck / test / build
pnpm --filter registry-viewer typecheck && pnpm --filter registry-viewer test && pnpm --filter registry-viewer build
```

Live (preview against the live R2 feed): on the Loadout tab, import a LAGN / paste a JSON
loadout (or build one by clicking cards) → click "🖼 View as cards" → confirm the Cards
tab shows exactly that loadout's cards (a hero group shows all its member cards; the
scheme and mastermind appear; unrelated cards do not) and the `Viewing loadout — N cards`
banner is present → click `✕` → the grid returns to all cards. Repeat the entry from the
floating tray's "View as cards" action. Confirm the WP-279 add-to-loadout button, the tray
pill counts, and the Loadout tab's download / upload / LAGN controls are unchanged.

---

## Definition of Done (Binary Gate)

- [ ] `loadoutGalleryCards.ts` helper (`compositionExtIdSet` + `isCardInLoadoutComposition`) + tests cover collection / dedup / empty-slot skip / member-card expansion / membership
- [ ] `App.vue` gallery mode: `loadoutGalleryActive` state, inert-when-off `applyFilters` stage, `navigateToLoadoutGallery` (clears other filters) + `clearLoadoutGallery`, inline banner
- [ ] "🖼 View as cards" on `LoadoutBuilder` (disabled when empty) + the tray action; both emit `view-as-cards`; `App.vue` routes both to `navigateToLoadoutGallery`
- [ ] No forbidden import; helper boardgame.io-free; no new LAGN loader; no draft-logic / contract change; `CardGrid` unchanged
- [ ] `typecheck` + `test` + `build` exit 0 (prior test count preserved + new helper tests)
- [ ] No regression to the Loadout tab builder / picker / validation / export / URL-preview or the WP-279 add-to-loadout button + tray pill
- [ ] D-24072 lands (Active); WORK_INDEX + EC_INDEX + STATUS updated
- [ ] Commit prefix `EC-320:` for code, `SPEC:` for governance
- [ ] **D-24026 live-verify** post-deploy on `cards.legendary-arena.com` (load a LAGN → "View as cards" → the Cards tab shows that loadout's cards; banner clears)

---

## Decision — D-24072

Establishes that the registry viewer can render the currently-loaded loadout / LAGN file
as a **gallery** — the Cards tab narrowed (via a filter mode over the existing
post-`applyQuery` chain) to the cards in the shared draft's composition — entered with one
click from the Loadout tab and the floating tray, reusing WP-279's shared draft and the
Themes→Cards cross-nav. Pure registry-viewer UX; consumes the existing
`MatchSetupDocument["composition"]` + the `FlatCard.extId` id-space (D-24018) with no
draft-logic, contract, loader, or card-data change. A "Custom LAGN files" dropdown sourced
from an **account-backed saved-LAGN library** (and the narrow per-chip reverse cross-link)
are named follow-ups, deferred because they require identity / storage the public viewer
does not have and re-introduce the multi-step flow this WP avoids.

---

## Lint Gate Self-Review (00.3 — all 21 sections resolved)

- §1 WP Structure — PASS: all required sections present; `## Scope (Out)` lists ≥2 excluded items.
- §2 Non-Negotiable Constraints — PASS: block present; references `00.6`; forbids cross-layer imports + contract edits; no body contradiction.
- §3 Prerequisites (`## Assumes`) — PASS: WP-279 shared draft + tray, the Loadout-tab LAGN importer, the `applyFilters` chain, the `navigateToCard` precedent, and `FlatCard.extId` listed with sources.
- §4 Context References — PASS: cites viewer CLAUDE.md, architecture layer rule, `00.6`, `00.2 §8.1`, Vision §10a, DECISIONS.
- §5 Output Completeness — PASS: ~9 files, each marked new/modified with a one-line role; ≤~8 code/test.
- §6 Naming Consistency — PASS: canonical `schemeId`/`mastermindId`/`villainGroupIds`/`henchmanGroupIds`/`heroDeckIds`/`extId` per `00.2 §8.1`; descriptive full-word names (`loadoutGalleryActive`, `compositionExtIdSet`, `navigateToLoadoutGallery`).
- §7 Dependency Discipline — PASS: no new npm dependency; built-in / existing imports only.
- §8 Architectural Boundaries — PASS (Frontend): new helper + components carry no game logic, no direct R2 fetch (registry-sourced), no `boardgame.io`; grep-gated forbidden imports. Backend / Game-Logic / Scripts sub-lists N/A.
- §9 Windows Compatibility — N/A: no shell scripts authored; verification uses `pnpm` + POSIX grep only.
- §10 Environment Variable Hygiene — N/A: no new env vars introduced.
- §11 Authentication Clarity — N/A: no authentication touched (the account-backed library that *would* touch it is explicitly deferred).
- §12 Test Quality — PASS: new `node:test` coverage for `loadoutGalleryCards.ts`; no boardgame.io import, no network / DB. (Engine-specific `makeMockCtx` / golden-deck items N/A.)
- §13 Commands & Verification — PASS: `## Verification Steps` uses exact `pnpm` commands; `pnpm check` / `pnpm validate` (conn / R2) N/A.
- §14 Acceptance Criteria Quality — PASS: 9 binary, observable items naming real files / functions.
- §15 Definition of Done — PASS: binary checkboxes incl. governance + commit-prefix.
- §15.1 User-Visible Verification (D-24026) — PASS: `User-Visible Surface` declared (`cards.legendary-arena.com`); `## User-Visible Impact` present; DoD includes a live-on-surface verify item.
- §16 Code Style — PASS: small pure helpers + JSDoc; explicit `if/else` / `for...of` (no branching `.reduce()`); `is*`/`has*` booleans; `// why:` on the inert-when-off gallery stage, the empty-composition no-op, and the filter-clear-on-entry; no barrels.
- §17 Vision Alignment — PASS: `## Vision Alignment` block present, cites §10a affirmatively + NG-proximity none (with the deferred account library noted); determinism line N/A (no scoring / replay / RNG).
- §18 Prose-vs-Grep — N/A: verification greps target identifier tokens (`loadoutGalleryActive`, `view-as-cards`), not a count-bounded literal echoed in adjacent prose. (The one count grep — `readAsText|onFileImport` "unchanged" — targets a baseline-unchanged file, not a policed literal in this WP's new prose.)
- §19 Bridge-vs-HEAD — N/A: WP authors no repo-state-snapshot artifact; not a pre-execution lint rule.
- §20 Funding Surface Gate — N/A: loadout-viewing UX; introduces no donate / support copy, no funding channel, and no WP-097 §A/§B/§C funding affordance.
- §21 API Catalog Update — N/A: no HTTP endpoints touched, no `apps/server/src/**` library functions added or modified.

## Lint / Pre-Flight / Copilot

**Lint (00.3): PASS** — all 21 sections resolved above; the two hard triggers (§15.1
D-24026 + §17 Vision) are satisfied with real blocks, not N/A dodges; §20 / §21 N/A carry
non-tautological reasons.

**Pre-flight (01.4): READY TO EXECUTE** — Class = Runtime Wiring (single layer, app UI:
one new pure helper + its test, plus additive wiring in `App.vue` and two existing
components). Dependencies complete (WP-279 ✅ shared draft + tray; WP-278 ✅ filter chain;
WP-091 ✅ LAGN import + `useLoadoutDraft`; the consumed `MatchSetupDocument["composition"]`
fields, `FlatCard.extId`, and the `navigateToCard` precedent all verified against source).
**Not a validation-tightening WP** — it adds no parser / guard / schema that
newly-rejects previously-accepted input (the gallery stage is inert when off; AC-2), so
`01.4 §Empirical Scaffold` does **not** apply. No new contract, no determinism /
persistence / sentinel surface. RS-1 (locked): the gallery stage reads
`loadoutDraftApi.value.draft.composition`, which is null before registry load — the stage
is guarded on `loadoutDraftApi.value` presence (same post-load discipline as the WP-279
`selectedCardInLoadout` computed). RS-2 (locked): if a future `vue-sfc-loader` component
test exercises the new wiring, the `defineComponent({ setup })` authoring form is required
— but this WP's tests target the pure `loadoutGalleryCards.ts` helper (no `.vue` under
test), so it does not arise here.

**Copilot (01.7): PASS** — scanned all 30 modes. Addressed: **#1 Engine / UI boundary**
(grep gate + no engine import — gallery is pure client read of draft state); **#3 / #17
mutation / aliasing** (the helper and components never mutate the draft, the composition,
or the card list — the gallery stage only *reads* the composition and *narrows* a local
array); **#12 scope creep** (explicit allowlist + `git diff --name-only` close check;
account library + dropdown + per-chip cross-link + within-gallery filtering all explicitly
deferred); **#11 invariant tests** (composition→member-card-set expansion + membership is
unit-tested via the pure helper, not just "the button works"); **#2 behavior-identity**
(gallery stage inert when `loadoutGalleryActive` is false — AC-2 — so no existing filter
path changes). Determinism / persistence / engine-contract modes are N/A for a client-only
viewer feature.

## Vision / Funding / API

**Vision:** on-vision per §10a (see `## Vision Alignment`); the account-backed LAGN library
that would approach the identity Non-Goal is deferred. **Funding:** N/A — no funding
affordance. **API:** N/A — no HTTP endpoint or `apps/server` library function touched.
