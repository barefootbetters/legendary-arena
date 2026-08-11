# EC-561 — URL-Preview Scheme-Aware Setup-Requirement Display

**WP:** WP-526 · **Layer:** App (registry-viewer) · **Baseline:** `origin/main` @ `d41732bb`
· **Lane:** Lightweight (single session, one branch, one PR).

Authoritative execution contract for WP-526. The WP is the design authority; on conflict the
WP wins. Subordinate to ARCHITECTURE.md + `.claude/rules/*`.

> Additive UI display only. Surfaces the WP-524 scheme-aware hero count (Secret Invasion → 6)
> in the read-only URL preview so a shared deep-link shows the requirement WITHOUT clicking
> "Edit this loadout". Respects the locked read-only preview-first design (D-114XX) — no
> draft mutation, no promotion-behaviour change. No new D-entry (applies D-24337).

## Before Starting

- [ ] `git pull --ff-only origin main`; WP-524 / D-24337 on main (`resolveEffectiveHeroCount`
      + `getPlayerCountSetup` exported from `@legendary-arena/registry/playerCountSetup`).
- [ ] Fresh worktree → `pnpm install` + `pnpm -r build` (apps import built dist; skipping the
      build fakes LAGN-test failures — the known stale-dist trap).
- [ ] Read `LoadoutPreview.vue` (props: `previewDocument: MatchSetupDocument | null` carries
      `playerCount` + `composition.schemeId`) and `useSetupFromUrl.ts` (preview is read-only;
      "Edit this loadout" is the sole draft-promotion path).

## Locked Values (do not re-derive)

- Effective hero count from **`resolveEffectiveHeroCount`** (WP-524 — single source; no
  re-hardcode of "6"), `getPlayerCountSetup` for the base row. Both from the browser-safe
  `@legendary-arena/registry/playerCountSetup` subpath.
- Helper: **`resolveSetupRequirement(previewDocument)`** in
  `apps/registry-viewer/src/lib/previewSetupRequirement.ts` → `{ playerCount, row } | null`.
- Requirement line mirrors the builder's: "For a N-player match: X villain groups, Y
  henchmen groups, Z heroes, W villain-deck bystanders." (`Z` scheme-aware).
- Test id: **`preview-setup-requirement`**.

## Guardrails

- [ ] Pure helper — no Vue/DOM/I/O; the component calls it in a computed. No registry-viewer
      runtime import of anything but the existing `@legendary-arena/registry/*` subpaths.
- [ ] Spread a NEW row (`{ ...baseRow, heroCount }`) — never mutate the immutable
      `PLAYER_COUNT_SETUP` table row.
- [ ] Read-only: NO draft mutation, NO change to `onEditLoadout` / the emit, NO change to
      `useSetupFromUrl` / `applyPreviewToDraft` (D-114XX preview-first untouched).
- [ ] Null document → null; player count outside 1–5 → null (no row).
- [ ] registry-viewer only — no engine / registry-package / server / contract / determinism
      surface.

## Required Comments (`// why:`)

- [ ] `previewSetupRequirement.ts`: why scheme-aware (Secret Invasion 6) + why spread-not-mutate.
- [ ] `LoadoutPreview.vue`: why the preview shows the requirement (shared deep-link, without Edit).

## Files to Produce (allowlist)

- [ ] `apps/registry-viewer/src/lib/previewSetupRequirement.ts` (new helper).
- [ ] `apps/registry-viewer/src/lib/previewSetupRequirement.test.ts` (new: SI → 6 @1–5;
      non-SI → base; non-hero counts base; null / out-of-range → null).
- [ ] `apps/registry-viewer/src/components/LoadoutPreview.vue` (computed + requirement line).
- [ ] NOT touched: `useSetupFromUrl.ts`, `applyPreviewToDraft.ts`, `useLoadoutDraft.ts`, the
      registry package, engine, server.
- [ ] Governance: `WORK_INDEX` `[x]`, `EC_INDEX` Done, mindmap `✅` + `roadmap:counts:write`,
      `STATUS`, `NUMBER-LEDGER`.

## After Completing

- [ ] `pnpm -r build` then `pnpm --filter registry-viewer test` green (record delta);
      `pnpm --filter registry-viewer typecheck` clean.
- [ ] Control-revert non-vacuous: return `baseRow.heroCount` → the SI-6 helper test fails;
      others green. Restore.
- [ ] `pnpm -r build` 0; `git diff --name-only` = the 3 files + governance.
- [ ] Two-commit topology: `EC-561:` impl + `SPEC:` govern-close, one PR.
- [ ] D-24026 live-verify performed or explicitly operator-pending.

## Common Failure Smells

- Re-hardcoding "6" instead of calling `resolveEffectiveHeroCount`.
- Mutating the base table row instead of spreading a new one.
- Touching the URL→draft promotion flow (D-114XX is preview-first; this is display-only).
- Skipping `pnpm -r build` in the fresh worktree → spurious LAGN-test failures (stale dist).
