# EC-420 — Loadout Picker Set Filter (Execution Checklist)

**Source:** docs/ai/work-packets/WP-390-support-card-pools.md
**Layer:** Registry Viewer

> **Retroactive registration.** This EC was authored after the change was
> written, to bring PR #819 into EC-mode commit hygiene. It documents the
> change as landed rather than predicting it. Recorded here rather than
> back-dated, because the EC_INDEX is a governance record and a fabricated
> pre-flight would be worse than an honest late one.

## Before Starting
- [ ] The Cards tab already has a set filter (`filterSet` in `App.vue`); the
      loadout picker does not — it filters by `cardType` plus a free-text
      needle only (`LoadoutBuilder.vue`)
- [ ] `props.registry.listSets()` returns `SetIndexEntry[]` with `abbr` and
      `name`, and `LoadoutBuilder.vue` already receives `props.registry` — no
      new prop is needed
- [ ] `pnpm --filter registry-viewer typecheck` exits 0 at baseline
- [ ] `pnpm --filter registry-viewer test` exits 0 at baseline — observed
      **143 pass / 0 fail**

## Locked Values (do not re-derive)
- An `extId` is `{setAbbr}/{slug}` (D-10014 / D-24018) — every card in a
  collapsed picker entry shares exactly one set
- Empty string is the "all sets" sentinel for the filter ref; never `null`,
  never `undefined`
- The picker's existing extId-collapse behaviour (one chip per group, labelled
  by `groupName`) is unchanged

## Guardrails
- Filter by set **before** the extId collapse, not after — equivalent result,
  and it avoids constructing entries that would be discarded
- Do NOT offer a set that holds no card of the active slot's type; an
  unreachable choice that empties the picker reads as a broken filter
- The set selection **persists across slot changes** (scheme → mastermind →
  heroes stays scoped) and self-clears ONLY when the newly-active slot has no
  cards in that set
- No change to loadout state, the setup contract, LAGN, or export
- Do NOT touch `useLoadoutDraft.ts` — this EC is picker-presentation only

## Required `// why:` Comments
- The pre-collapse filter: why filtering before the collapse is equivalent
  (one set per extId) and why it is preferred
- `pickerSetOptions`: why sets are restricted to those holding the active
  type, i.e. what the unrestricted version would break
- The `watch(activeSlot, ...)`: why the selection persists but self-clears
- The header `flex-wrap`: three controls at the 280px panel min-width

## Files to Produce
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** —
  `pickerSet` ref, `pickerSetOptions` computed, stale-selection watch, set
  `<select>` in the picker header, clear-filter affordance in the empty state,
  header wrap + control styles

## After Completing
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer test` exits 0 — **143 / 0**, unchanged
      (presentation-only; no new tests expected)
- [ ] `eslint` warning count on the touched file unchanged — observed **52
      before / 52 after**, zero errors
- [ ] Live-on-surface (D-24026): the set dropdown filters the picker on
      `cards.legendary-arena.com` — **operator-pending; not yet exercised in a
      browser**, record the result when run
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped with date

## Common Failure Smells
- Picker empties on a legitimate set choice → the options list was not
  restricted to sets holding the active card type
- Filter silently resets on every slot click → the watch is clearing
  unconditionally instead of only when the set is unavailable
- Search box unusable at narrow widths → the header `flex-wrap` was dropped
