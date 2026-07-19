# EC-426 — Support Cards in the Loadout Gallery (Execution Checklist)

**Source:** docs/ai/work-packets/WP-391-support-card-pools.md
**Layer:** Registry Viewer

Operator-reported gap in EC-425, found on production: a loadout with support
pools rendered in "View as cards" with every bystander, wound, officer and
sidekick missing.

## Before Starting
- [ ] EC-425 (D-24194 pools + picker) is on `main`
- [ ] Confirm the cause before changing anything: `compositionExtIdSet`
      (`lib/loadoutGalleryCards.ts`) reads the **five composition fields
      only**. Pools live on the ENVELOPE — D-24194 put them there so the
      9-field composition lock (D-1244) could stand — so the gallery filter
      could never see them. If that is no longer true, STOP and re-scope
- [ ] `pnpm install` in the worktree, then build `@legendary-arena/lagn` and
      `@legendary-arena/registry`. Junctioned `node_modules` resolves to
      another checkout's stale `dist` and yields phantom export errors
- [ ] `pnpm --filter registry-viewer typecheck` + `test` exit 0 at baseline —
      observed **147 pass / 30 suites / 0 fail**

## Locked Values (do not re-derive)
- Support cards are **opt-in and default OFF** — operator instruction: "these
  aren't needed that often". A select-all-sets draft adds ~126 cards
  (bystanders 69 + wounds 22 + officers 18 + sidekicks 17) and would swamp the
  ~29 hero/villain cards the gallery is usually opened to see
- Pool ext_ids name **one specific card**; composition ext_ids are GROUP ids
  shared by every member card. Pool membership is exact, not expanding
- The four pool kinds are enumerated explicitly, not via `Object.values`, so a
  future fifth kind is a compile error rather than a silent omission

## Guardrails
- Keep `supportPoolExtIdSet` **separate** from `compositionExtIdSet`; do not
  fold pools into the composition set. The caller unions them only when the
  toggle is on — merging at the source removes the ability to opt out
- The gallery stage stays the FINAL narrowing stage and INERT when the gallery
  is off; every pre-existing filter path must assign `filteredCards`
  byte-identically (the EC-320 AC-2 invariant)
- The toggle hides itself when the draft names zero support cards — an
  always-visible control that does nothing reads as broken
- Changing the toggle must re-run the filter (`applyFilters`); `applyQuery` is
  not exposed to the template
- Do NOT touch the composition, the setup contract, LAGN, or either exporter —
  this is gallery presentation only

## Required `// why:` Comments
- `supportPoolExtIdSet`: why pools were invisible to the gallery (envelope vs
  composition, citing D-24194/D-1244), and why the set stays separate
- The explicit four-pool iteration: why not `Object.values`
- The union site in `App.vue`: why opt-in, with the ~126-card figure
- The toggle ref: the operator instruction behind defaulting to OFF

## Files to Produce
- `apps/registry-viewer/src/lib/loadoutGalleryCards.ts` — **modified** —
  `supportPoolExtIdSet`
- `apps/registry-viewer/src/App.vue` — **modified** —
  `loadoutGalleryIncludesSupport` ref, `loadoutSupportPoolCount` computed,
  conditional union in the gallery filter stage, banner checkbox + styles
- `apps/registry-viewer/src/lib/loadoutGalleryCards.test.ts` — **modified** —
  five cases incl. the regression proof that pool ids are absent from the
  composition set
- `docs/ai/execution-checklists/EC-425-*.checklist.md` + `EC_INDEX.md` —
  **modified** — correct the wrong "one generic card per set" data claim

## After Completing
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer test` exits 0 — **152 pass** (147 + 5)
- [ ] Live-on-surface (D-24026): pool 17 sidekicks, open View as cards,
      confirm the banner count rises when the toggle is on and falls when off.
      **Verified in dev: 29 → 46 → 29**
- [ ] `EC_INDEX.md` flipped with date

## Common Failure Smells
- Support cards appear without the toggle → the union was made unconditional,
  or folded into `compositionExtIdSet`
- Toggle present but the grid does not change → the change handler is not
  re-running the filter
- Count in the toggle label disagrees with the delta in the banner → the label
  counts pool entries while the filter unions ext_ids, or vice versa
- Cards outside the loadout appear → a pool ext_id was treated as a group id
