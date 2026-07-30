# EC-488 — Gauntlet Loadout Qualification Guard (Execution Checklist)

**Source:** docs/ai/work-packets/WP-453-gauntlet-loadout-qualification-guard.md
**Layer:** App (`apps/registry-viewer`)

## Before Starting
- [ ] On `origin/main` @ `28b3b61f` (drafting baseline), worktree clean.
- [ ] **WP-444 landed:** `apps/registry-viewer/src/lib/loadoutGauntletPackImport.ts`
      exports `parseGauntletPack` / `resolveGauntletLegLoadout` /
      `listGauntletLegSchemeIds`; `LoadoutBuilder.vue` hosts the "Load Gauntlet
      Pack" importer, `onPickGauntletLeg`, and the `gauntletImportSuccessAt` flag.
- [ ] **WP-395 landed:** `packages/registry` exports `getGauntletLoadoutMenu` /
      `GAUNTLET_LOADOUT_MENUS` via `./gauntletLoadouts`, variants carrying
      `variantIndex` + `compositionsByPlayerCount[playerCount]` →
      `{ villainGroupIds, henchmanGroupIds }` (set-qualified ext_ids, sorted ASC).
- [ ] `LoadoutBuilder.vue` already value-imports `getGauntletLoadoutMenu` from
      `@legendary-arena/registry/gauntletLoadouts` (reuse it; add NO new import).
- [ ] `pnpm -r build` exits 0 (registry `dist` present so the value import resolves).
- [ ] `pnpm --filter registry-viewer test` exits 0 (baseline).
- [ ] `pnpm --filter registry-viewer typecheck` exits 0 (baseline).
- [ ] **Exact target file set (any file outside this list = FAIL, STOP):** the
      three files under `## Files to Produce`.

## Locked Values (do not re-derive)
- Qualification comparison = **exact set equality** on the full set-qualified
  `setAbbr/slug` ext_ids of **both** `villainGroupIds` and `henchmanGroupIds`,
  order-insensitive. **Sort a SPREAD COPY (`[...ids].sort()`), never the input
  array** — the draft's `villainGroupIds` is a live reactive `string[]`; an
  in-place `.sort()` would reorder the visitor's on-screen chips. Both fields
  must match to `qualifies`. NOT the server's bare-slug villain-segment
  projection — the draft + menu both hold full ext_ids, so the client check is
  exact (and, per D-24131 same-set + exact `henchman_key`, cannot false-negative
  a server-acceptable loadout).
- Player-count boundary: `playerCount` is a plain envelope `number`;
  `compositionsByPlayerCount` is keyed by `SupportedPlayerCount`. Narrow
  explicitly — an out-of-range / absent lookup maps to `unoffered-count`, never
  an unchecked cast.
- Lock-clear wiring: `onPickGauntletLeg` itself calls `resetDraft()` and THEN
  sets the lock true, so clear `adversaryFieldsLocked` in the **user
  reset-button handler** (e.g. `onResetDraft`) and the explicit unlock — NOT
  literally inside every `resetDraft` call (that would undo the pick's re-lock).
- Status set (closed): `not-a-gauntlet` (menu undefined) · `unoffered-count` (no
  composition for the draft player count) · `qualifies` (with the matching
  `variantIndex`) · `not-qualifying` (with `approvedVariantCount`). No free-form
  status strings.
- `variantIndex` reported = the variant's `variantIndex` **field**, not array
  position.
- Lock trigger: `adversaryFieldsLocked` set true ONLY via the existing
  `onPickGauntletLeg` success path; cleared by `resetDraft` and by the explicit
  "Unlock adversaries" control. A hand-built draft is NEVER auto-locked.
- Advisory-only: neither badge nor lock blocks building, editing, or exporting
  any loadout. The server stays the sole qualification authority.
- Id space = set-qualified `setAbbr/slug` ext_ids (D-10014 / D-24018).
- Registry import: reuse `getGauntletLoadoutMenu` + `GauntletLoadoutMenu` from
  `@legendary-arena/registry/gauntletLoadouts` — NEVER the root barrel; add no
  new registry import.

## Guardrails
- **Zero-API.** The check is entirely client-side from the bundled registry; NO
  server call, NO `fetch`, NO snapshot/endpoint. If the guard issues a network
  request, STOP.
- **No engine/server/pg/boardgame.io import; no registry root barrel** (Node
  built-ins break the browser build).
- **New helper lives in its OWN module** `gauntletQualificationCheck.ts` — do NOT
  add it to WP-444's `loadoutGauntletPackImport.ts` and do NOT alter that
  module's exports.
- **No `packages/registry` change, no server change, no persistence/migration.**
  The server-side `matchesApprovedLoadout` (WP-395) is untouched and authoritative.
- **`checkGauntletQualification` never throws** — return the discriminated
  `{ status }` result. Keep it pure + data-injected (menu passed in) so it
  unit-tests without a live registry.
- **Lock is opt-out, never a hard block.** The "Unlock adversaries" control must
  restore free editing; heroes/scheme/counts/player-count stay editable while
  adversaries are locked.
- **Advisory only.** Never block, gate, or reject building/exporting/launching a
  loadout; the badge is a prediction, not enforcement.
- **Badge shows for hand-built drafts too** — it is driven off the draft
  mastermind's menu, not off the pack-sourced flag.

## Required `// why:` Comments
- The exact-set-equality comparison on full ext_ids: why it is used instead of
  the server's bare-slug villain-segment projection (draft + menu both carry full
  set-qualified ext_ids; the client check is exact and stricter) **and why it
  cannot false-negative** — D-24131 both-sides-same-set + the server's exact
  set-qualified `henchman_key` collapse the same-slug/different-set case, so a
  client `qualifies` implies a server match. (Keeps a future editor from
  "loosening" the villain check to bare slugs thinking it is a bug.)
- The spread-copy sort: why the input arrays must not be sorted in place (the
  draft array is live and reactive).
- The `adversaryFieldsLocked` trigger: why it is set only on the
  `onPickGauntletLeg` success path and cleared on reset / explicit unlock (a
  pack-sourced composition is the only auto-lock case).
- The advisory-only posture: why the guard never blocks build/export (the server
  is the sole adjudicator; the badge predicts, it does not gate).

## Files to Produce
- `apps/registry-viewer/src/lib/gauntletQualificationCheck.ts` — **new** — pure
  `checkGauntletQualification(input)` + its discriminated result type.
- `apps/registry-viewer/src/lib/gauntletQualificationCheck.test.ts` — **new** —
  `node:test`: not-a-gauntlet, qualifies (incl. a reordered-id input), non-zero
  variant, not-qualifying (wrong/extra/missing group), unoffered-count, **and a
  non-mutation assertion** (the input `villainGroupIds` / `henchmanGroupIds`
  arrays are unchanged in contents and order after a call — proves the
  spread-copy sort).
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** —
  qualification-badge computed + render near the villain/henchmen fields; the
  pack-sourced adversary lock (hide remove ✕ + disable add-slot) + "Unlock
  adversaries" escape hatch.

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter registry-viewer test` exits 0 (new tests green).
- [ ] `pnpm --filter registry-viewer typecheck` exits 0 (`vue-tsc`).
- [ ] `pnpm --filter registry-viewer build` exits 0.
- [ ] **D-24026 live verification (operator-pending on deploy):** on deployed
      `cards.legendary-arena.com`, a pack-sourced `core/magneto` leg shows locked
      adversary fields + "✓ Qualifies (variant 0)"; unlocking and removing a
      villain group flips the badge to "✗ won't count"; `read_network_requests` =
      zero API calls.
- [ ] `docs/ai/STATUS.md` updated (qualification badge + adversary lock on cards
      builder).
- [ ] `docs/ai/DECISIONS.md` **D-24273** flipped Drafted → Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-488 status → `Done`.
- [ ] No file outside the three-file list was modified.

## Common Failure Smells
- Badge says "qualifies" for a reordered-but-equal composition but FAILS a
  genuinely-equal one, or vice versa → array equality was used instead of
  order-insensitive set equality; sort both sides first.
- Badge never appears → the draft `mastermindId` was not split to
  `(setAbbr, mastermindSlug)` before `getGauntletLoadoutMenu`, or the menu-lookup
  computed did not react to `mastermindId` changes.
- Locked fields can still be removed → the remove ✕ control was not gated on
  `adversaryFieldsLocked`, or the lock ref was never set in `onPickGauntletLeg`.
- "Unlock adversaries" does nothing / can't re-lock → expected: unlock is
  one-way for the session's draft; re-locking happens only on a fresh pack leg
  load. Do not add a re-lock toggle (out of scope).
- Browser build breaks with a `node:*` error → the registry **root barrel** was
  imported; reuse the existing `/gauntletLoadouts` subpath import.
- The badge blocks export or launch → advisory-only was violated; the guard must
  never gate an action.
