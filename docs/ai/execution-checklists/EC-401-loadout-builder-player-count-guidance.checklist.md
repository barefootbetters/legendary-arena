# EC-401 — WP-372: Loadout Builder Player-Count Required Counts + Warn/Export-Gate

**Pairs with:** [WP-372](../work-packets/WP-372-loadout-builder-player-count-hero-guidance.md) · **Lane:** standard two-session · **Baseline:** `origin/main @ 2ee41fe8` (after WP-371) · **Consumes:** D-24165 (no new D-entry).

## Before Starting
- Confirm baseline green: registry-viewer test **123/0**; `pnpm -r build` 0.
- The viewer imports from `@legendary-arena/registry/setupContract` (the browser-safe barrel), **never** the root barrel (node-only re-exports break Vite).

## Locked Values
- Required counts + mismatches come from the registry single-source-of-truth table (`checkPlayerCountComposition` / `getPlayerCountSetup`) — **no re-typed count literals in the viewer**.
- Warn in builder, **gate export** (D-24165 model): a player-count mismatch disables both Download buttons; authoring stays free (heroes are chosen, never auto-filled).

## Guardrails
- **Packaging refinement (scope-neutral):** WP-370 exported the table only from the node-only root barrel. This WP re-exports `PLAYER_COUNT_SETUP` + `getPlayerCountSetup` + `checkPlayerCountComposition` from the browser-safe `setupContract` barrel (`packages/registry/src/setupContract/index.ts`) — `playerCountSetup.ts` has zero node deps, so the viewer's Vite build stays browser-safe. **Rebuild the registry package** so the viewer sees the new dist export (apps import the built `dist`).
- Mirror the existing `missingRequiredVillainGroupIds` warn/block pattern; add the player-count mismatch to BOTH export handlers AND BOTH export-button `:disabled` bindings.
- No `@legendary-arena/game-engine` import in the viewer.

## Required Comments
- `// why: WP-372 / D-24165` on the new composable computeds and the barrel re-export.

## Files to Produce (allowlist)
- `packages/registry/src/setupContract/index.ts` — **modified** — browser-safe re-export of the table + helpers
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — **modified** — `requiredPlayerCountSetup` + `playerCountCompositionMismatches` computeds (interface + return)
- `apps/registry-viewer/src/composables/useLoadoutDraft.test.ts` — **modified** — computed + mismatch tests
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — required-counts readout + warnings + export-disable on mismatch
- governance (STATUS / WORK_INDEX / EC_INDEX / mindmap + counts)

## After Completing
- registry-viewer typecheck (vue-tsc) 0 + test **127/0** (+4); `pnpm -r build` 0.
- **D-24026 live-verified** on the worktree dev server: Loadout tab shows "For a N-player match: …" readout + per-mismatch warnings + Download disabled; reactive to the player-count input (2→4 updates the counts to 3/2/8/5).
- WORK_INDEX WP-372 → Done; STATUS; EC_INDEX EC-401 row; mindmap 📝→✅ + `pnpm roadmap:counts --write`. No DECISIONS entry (consumes D-24165).

## Common Failure Smells
- Importing the table from the root barrel → Vite browser build breaks (node-only re-exports).
- Forgetting to rebuild the registry dist → the viewer's import resolves to a stale barrel (silent: `getPlayerCountSetup` undefined → readout never renders).
- Re-typing the 1/2/8/8/12 or 3/5/5/5/6 literals in the viewer.
