# EC-425 — Support Pool Picker (Execution Checklist)

**Source:** docs/ai/work-packets/WP-391-support-card-pools.md
**Layer:** Registry Viewer (+ one registry barrel export)

Phase C of WP-391. EC-421 landed the contract, EC-422 the wire format; this is
the authoring surface that finally writes a pool.

## Before Starting
- [ ] EC-421 (D-24194) and EC-422 (D-24195) are on `main`
- [ ] Know which flattener you are reading. `packages/registry/src/shared.ts`
      emits only hero / mastermind / villain / scheme. The **viewer** has its
      own at `apps/registry-viewer/src/registry/shared.ts` which additionally
      emits `bystander` (:370), `wound` (:390) and everything in `set.other`
      (:420) — that is the one `props.registry.listCards()` uses
- [ ] `pnpm install` in the worktree and build `@legendary-arena/lagn` +
      `@legendary-arena/registry` first. Junctioning `node_modules` from
      another checkout resolves workspace packages to that checkout's stale
      `dist` and produces phantom "has no exported member" errors
- [ ] `pnpm --filter registry-viewer typecheck` + `test` exit 0 at baseline —
      observed **143 pass / 29 suites / 0 fail**

## Locked Values (do not re-derive)
- Pool kinds and modes are D-24194's: `bystanders | wounds | officers |
  sidekicks`, `sets | explicit`, no `default` mode (absence expresses it)
- `SUPPORT_POOL_CARD_TYPES` — officers span **two** slugs, `shield-officer`
  AND `shield-officer-special`; omitting the second hides 8 of 18 officers
- Real card supply: sidekicks 17 / officers 18 across 5 sets; bystanders and
  wounds are **one generic card per set**, so "individual" selection collapses
  to "which set's" for those two. The UI is uniform; the data differs
- Set-fill writes **one copy per card** — the registry records no per-set pile
  quantity, so any other multiplier would be invented
- Hand-editing copies makes the pool `explicit` and drops `sets`; D-24194
  rejects an explicit pool that still carries a `sets` array

## Guardrails
- **The count is derived, never hand-kept.** `setSupportPool` writes
  `sum(cards[].copies)` into the paired composition field. The number input is
  disabled while a pool is set, so the two cannot drift into a document the
  validator rejects
- **Clearing a pool must NOT reset its count** — absence means "counts alone",
  and resetting would discard a deliberate pile size
- **An empty pool object is not representable.** Removing the last card clears
  the whole pool; an empty `supportPools: {}` reads as "configured and empty"
  so the key is dropped entirely
- **The MATCH-SETUP serializer's replacer is a WHITELIST.**
  `JSON.stringify(draft, keyOrder, 2)` with an array replacer omits every
  unlisted key — including nested ones. `supportPools`, the four kind names,
  `mode`, `sets`, `cards`, `extId` and `copies` must all be listed or the
  download silently ships a pool-free document. The LAGN exporter differs: it
  uses a FUNCTION replacer with a fallback loop, so listing there is ordering
  only
- LAGN renames `officers` → `shield_officers` (D-24195 matches
  `shield_officers_count`); translate in one place, never open-code it
- Do NOT add pool fields to the composition block — D-1244 stands

## Required `// why:` Comments
- `SUPPORT_POOL_CARD_TYPES`: why officers span two slugs; the
  bystander/wound one-per-set asymmetry
- `setSupportPool`: why the count is derived, and why clearing leaves it
- The `keyOrder` additions: that an array replacer is a whitelist
- `setPoolCopies`: why zero copies clears rather than stores, and why
  hand-editing forces `explicit`
- `fillPoolFromSets`: why one copy per card is the only defensible default
- The `Record<..., number>` view in `setSupportPool`: why indexing by a key
  union narrows the assignment target to `never`

## Files to Produce
- `packages/registry/src/setupContract/index.ts` — **modified** — re-export the
  pool types + `SUPPORT_POOL_COUNT_FIELD` / `SUPPORT_POOL_KINDS`; EC-421 added
  them to the types file but never to this barrel, leaving the contract
  unreachable from the viewer
- `packages/registry/src/setupContract/setupContract.types.ts` — **modified** —
  narrow `SUPPORT_POOL_COUNT_FIELD`'s value type to the new
  `SupportPoolCountField` (it was `keyof SetupCompositionInput`, all nine
  fields, which made writing through the table uncompilable)
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — **modified** —
  `SUPPORT_POOL_CARD_TYPES`, `setSupportPool`, keyOrder entries
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` — **modified** —
  `supportPoolsToLagn` + keyOrder ordering entries
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** —
  per-kind pool editor: set chips, Select all sets, per-card copies, clear
- `apps/registry-viewer/src/composables/useLoadoutDraft.test.ts` — **modified** —
  four cases incl. the export round-trip

## After Completing
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer test` exits 0 — **147 pass** (143 + 4)
- [ ] `eslint` reports **0 errors** on the touched files
- [ ] A test asserts `supportPools` survives `exportToJsonBlob()`
- [ ] Live-on-surface (D-24026): set a pool on `cards.legendary-arena.com`,
      download, confirm the file carries it — **operator-pending**
- [ ] `EC_INDEX.md` flipped with date

## Common Failure Smells
- Download has no `supportPools` but the UI shows one → a key is missing from
  the MATCH-SETUP `keyOrder` whitelist
- Validator rejects the document on a count mismatch → something wrote a count
  directly instead of going through `setSupportPool`
- Only 10 officers appear → `shield-officer-special` was dropped from the
  card-type map
- "has no exported member" on a pool type → stale workspace `dist`; rebuild
  `@legendary-arena/registry`, do not add a local type to work around it
