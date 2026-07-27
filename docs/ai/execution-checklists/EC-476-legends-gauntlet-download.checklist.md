# EC-476 — Legends Gauntlet Pin + Download (Execution Checklist)

**Source:** docs/ai/work-packets/WP-441-legends-gauntlet-download.md
**Layer:** App (`apps/legends-board`)

## Before Starting
- [ ] On `origin/main` @ `01ec0a27` (drafting baseline), worktree clean.
- [ ] **WP-440 landed:** `packages/registry/package.json` `exports` has
      `./gauntletPack`; `gauntletPack.ts` exports `GauntletPack` /
      `GauntletPackIdentity` / `GauntletDivision`.
- [ ] `apps/legends-board/package.json` has `vue` as the sole runtime dep and
      `@legendary-arena/lagn` as a type-only devDep (the pattern to mirror).
- [ ] `pnpm -r build` exits 0 (registry `dist` present so the type-only import resolves).
- [ ] `pnpm --filter @legendary-arena/legends-board test` exits 0 (baseline).
- [ ] `pnpm --filter @legendary-arena/legends-board typecheck` exits 0 (baseline).
- [ ] **Exact target file set (any file outside this list = FAIL, STOP):** the
      six files under `## Files to Produce`.

## Locked Values (do not re-derive)
- `SHOWCASE_SET_ABBR = "core"`, `SHOWCASE_MASTERMIND_SLUG = "magneto"`.
- Pack literal: `{ pack_version: 1, gauntlet: { setAbbr, mastermindSlug, division, playerCount } }`
  — `pack_version` is the literal `1`; the object `satisfies GauntletPack`.
- Filename: `gauntlet-<setAbbr>-<mastermindSlug>-<division>-p<N>.gauntlet.json`.
- Selector domain: player count ∈ `1|2|3|4|5`, division ∈ `"fixed"|"open"`;
  default **playerCount 1 + division "fixed"**.
- Button label: `"Download Mastermind Gauntlet"`. MIME: `application/json`.
- Import form: `import type { GauntletPack, GauntletDivision } from
  "@legendary-arena/registry/gauntletPack"` — NEVER a value import.

## Guardrails
- **`vue` stays the SOLE runtime dependency.** `@legendary-arena/registry` goes
  in `devDependencies` ONLY. A `dependencies` entry, or any value/runtime import
  of registry (`buildGauntletPack`, `validateGauntletPack`, `GAUNTLET_PACK_VERSION`),
  is a layer violation — STOP.
- Build the pack **inline**; do NOT call `buildGauntletPack` at runtime.
- The download makes **no** network call — mirror `matchResultDownload.ts`
  Blob/anchor MINUS the `fetch`; revoke the object URL after click.
- `pinShowcaseGauntlet` is a NEW pure helper applied AFTER `groupGauntletsBySet`;
  do NOT modify `groupGauntletsBySet`'s order-preserving contract. It returns a
  fresh array and MUST NOT mutate the input groups.
- Absent `core/magneto` → return the groups unchanged (a copy), never crash.
- No `apps/server`, no snapshot/publisher, no migration, no `packages/registry`
  edit. Strictly additive to the existing chips/challenge-links/fixed toggle.

## Required `// why:` Comments
- The `pack_version: 1` inline literal: why it is hardcoded (mirrors
  `GAUNTLET_PACK_VERSION`) rather than runtime-imported (zero-runtime-registry
  invariant); the server re-validates at import (WP-5).
- `URL.revokeObjectURL` after `anchor.click()`: why (avoid leaking the Blob).
- `SHOWCASE_SET_ABBR` / `SHOWCASE_MASTERMIND_SLUG`: why these values (the
  epic's showcase gauntlet).

## Files to Produce
- `apps/legends-board/src/panels/gauntletDisplay.ts` — **modified** — add
  `pinShowcaseGauntlet` + showcase constants.
- `apps/legends-board/src/panels/GauntletIndexPanel.vue` — **modified** — apply
  pin in `setGroups`; add per-row count/division selector + Download button.
- `apps/legends-board/src/panels/gauntletPackDownload.ts` — **new** — inline
  build + filename + serialize + Blob/anchor download.
- `apps/legends-board/src/panels/gauntletPackDownload.test.ts` — **new** —
  identity-only shape, default solo/fixed, filename convention, round-trip.
- `apps/legends-board/src/panels/gauntletDisplay.test.ts` — **modified** — pin
  reorder + absent-showcase passthrough + no-mutation.
- `apps/legends-board/package.json` — **modified** — add
  `@legendary-arena/registry` to `devDependencies`.

## After Completing
- [ ] `pnpm -r build` exits 0.
- [ ] `pnpm --filter @legendary-arena/legends-board test` exits 0 (new tests green).
- [ ] `pnpm --filter @legendary-arena/legends-board typecheck` exits 0 (`vue-tsc`).
- [ ] `pnpm --filter @legendary-arena/legends-board build` exits 0, then
      `grep -r "legendary-arena/registry" apps/legends-board/dist` → **no match**.
- [ ] **D-24026 live verification (operator-pending on deploy):** on deployed
      `legends.legendary-arena.com`, Core Set / Magneto renders first; Download
      produces a valid `gauntlet-<set>-<mm>-<div>-p<N>.gauntlet.json` parsing
      against the WP-440 `GauntletPackSchema`; `read_network_requests` = zero API calls.
- [ ] `docs/ai/STATUS.md` updated (pin + download on legends).
- [ ] `docs/ai/DECISIONS.md` **D-24261** flipped Drafted → Active (post-execution).
- [ ] `docs/ai/work-packets/WORK_INDEX.md` row checked off with date.
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph `📝` → `✅`, then
      `pnpm roadmap:counts:write`; `pnpm roadmap:counts:check` exits 0.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-476 status → `Done`.
- [ ] No file outside the six-file list was modified.

## Common Failure Smells
- `@legendary-arena/registry` appearing in `apps/legends-board/dist` → a value
  import leaked (must be `import type`), or it was added to `dependencies`.
- `vue-tsc` red on `@legendary-arena/registry/gauntletPack` unresolved → registry
  `dist` not built; run `pnpm -r build` first (bundler resolution needs it).
- Pin test passes but the input array is reordered in place → mutation bug; the
  helper must return a fresh array and leave the input untouched.
