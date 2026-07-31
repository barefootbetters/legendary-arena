# EC-510 — Per-Scheme Approved-Loadout Arena-Client Launch (Execution Checklist)

**Source:** docs/ai/work-packets/WP-475-per-scheme-approved-loadout-arena-client.md
**Layer:** Client (`apps/arena-client`) — mirrors server wire types, imports no server/registry

## Before Starting
- [ ] WP-473 ✅ merged (`GauntletRunLaunch` carries the additive per-leg `legLaunch` map
      on the `GET /api/me/gauntlet-runs` `run.launch` block; per-run block still populated).
- [ ] On `origin/main` (post-WP-473), worktree clean; arena-client green.
- [ ] Confirm `gauntletRunApi.ts` (~77) mirrors the launch shape and `MyProfilePage.vue`
      `playLeg(run, leg)` (~775-797) reads `run.launch.villainGroupIds` **flat** (ignores `leg`).
- [ ] **Exact target file set (any outside = FAIL, STOP):**
      `apps/arena-client/src/lib/api/gauntletRunApi.ts`,
      `apps/arena-client/src/pages/MyProfilePage.vue`.

## Locked Values (do not re-derive)
- `playLeg(run, leg)` selects `run.launch.legLaunch?.[leg.schemeSlug]`, **falls back** to
  the per-run block when the per-leg map is absent (old snapshot).
- arena-client **mirrors** the server `GauntletRunLaunch` type (does NOT import server /
  registry — D-24269); everything needed is on the wire.
- `MatchSetupConfig` assembly is otherwise unchanged (same fields, same derivation).
- **No D-entry** (consumes D-24283).

## Guardrails
- No server / registry import; no legends-board / registry-viewer change (WP-474).
- Degrade cleanly on an old snapshot (per-leg map absent → per-run block).
- `for...of`, no `.reduce()`; descriptive names; `00.6`.

## Required `// why:` Comments
- Why `playLeg` selects by `leg.schemeSlug` (per-leg adversaries, not the mastermind default).
- Why the per-run fallback exists (old-snapshot degrade, no runtime break).

## Files to Produce
- `gauntletRunApi.ts` — mirror the additive per-leg `legLaunch` map on the client shape.
- `MyProfilePage.vue` — `playLeg` selects the leg's launch composition (+ test if a page
  launch-assembly spec exists).

## After Completing
- [ ] arena-client `test` / `typecheck` / `build` + `pnpm -r build` exit 0.
- [ ] **D-24026 live-verify (operator-pending):** "Play this leg" on a swapped scheme
      launches that scheme's adversaries.
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-510 Done.
- [ ] No file outside the allowlist (+ governance) modified. No D-entry.

## Common Failure Smells
- "Play this leg" launches empty/wrong villains → still reading the flat per-run block.
- typecheck green but runtime break → the mirror type gained `legLaunch` but `playLeg`
  didn't switch to it.
- Old snapshot crashes → missing the per-run fallback.
