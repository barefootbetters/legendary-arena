# EC-509 — Per-Scheme Approved-Loadout Consumers (Execution Checklist)

**Source:** docs/ai/work-packets/WP-474-per-scheme-approved-loadout-consumers.md
**Layer:** App (`apps/legends-board` + `apps/registry-viewer`) — client tier

## Before Starting
- [ ] WP-471 ✅ + WP-472 ✅ merged (registry `getGauntletConfig(...schemeSlug...)`;
      server `GauntletIndexLeg.approvedLoadouts`; D-24283 Active).
- [ ] On `origin/main` (post-WP-472), worktree clean; legends-board + registry-viewer green.
- [ ] Confirm the client consumers already hold the scheme (`leg.schemeSlug` in
      `buildCoverageMatrix`; `legs[0].schemeSlug` in `buildRowChallengeUrl`;
      `input.schemeId` in the pack), and `checkGauntletQualification` input lacks schemeId.
- [ ] **Exact target file set (any outside = FAIL, STOP):** `snapshotClient.ts`,
      `gauntletDisplay.{ts,test.ts}`, `GauntletIndexPanel.vue`, `GauntletBoardPanel.vue`,
      `gauntletQualificationCheck.{ts,test.ts}`, `loadoutGauntletPackImport.{ts,test.ts}`
      (+ governance).

## Locked Values (do not re-derive)
- Mirror WP-472: `approvedLoadouts` moves onto the `GauntletIndexLeg` mirror in
  `snapshotClient.ts` (drop the entry-level field); mirror only, never import server.
- Consumers read the **leg's** config: `buildCoverageMatrix` selects per leg (each
  scheme-row's ✓ pattern reflects THAT leg — remove the per-mastermind reuse);
  `buildGauntletDetails` pairs each scheme with its own config; `buildRowChallengeUrl`
  pins the row's leg config; `selectApprovedLoadout`/`listApprovedLoadouts` take the leg.
- Cards: add `schemeId` to `GauntletQualificationInput` + resolve the leg's config;
  `resolveGauntletLegLoadout` selects the composition by `input.schemeId`.
- Degrade cleanly on an old snapshot (no per-leg loadouts) — no crash.

## Guardrails
- legends-board `vue`-only / zero-API; mirror not import; no new `fetch`.
- registry-viewer reads the registry (WP-471 loader) or the published per-scheme menu.
- Do NOT change the accessible names, count selector, collapse, rotated headings, or
  scheme-wrap; do NOT touch the server/registry contract (WP-471/472 own it).

## Required `// why:` Comments
- Why the coverage-matrix ✓ pattern now varies by scheme (per-leg config, not per-mastermind).
- Why the mirror moves the loadout onto the leg in lockstep with WP-472.
- Why the cards badge needs `schemeId` threaded (it lacked it; the leg is the unit).

## Files to Produce
- `snapshotClient.ts` — leg-level `approvedLoadouts` mirror.
- `gauntletDisplay.ts` (+ test) — per-leg `buildCoverageMatrix` / reveal / links / selectors.
- `GauntletIndexPanel.vue`, `GauntletBoardPanel.vue` — pass the leg to the helpers.
- `gauntletQualificationCheck.ts` (+ test) — `schemeId` in input + leg lookup.
- `loadoutGauntletPackImport.ts` (+ test) — composition by `input.schemeId`.

## After Completing
- [ ] legends-board + registry-viewer `test`/`typecheck`/`build` + `pnpm -r build` exit 0.
- [ ] **D-24026 live-verify (operator-pending):** Core matrix ✓ patterns vary per
      scheme (Dr. Doom Secret-Invasion → Skrulls ✓; a non-swapped row → Brotherhood ✓);
      cards badge/pack honour the leg.
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-509 Done.
- [ ] No file outside the allowlist (+ governance) modified. No D-entry.

## Common Failure Smells
- Matrix rows still identical across a mastermind's schemes → `buildCoverageMatrix`
  still selects per mastermind (once), not per leg.
- Old snapshot crashes → the mirror/consumers don't tolerate absent `leg.approvedLoadouts`.
- Cards badge ignores the scheme → `schemeId` not threaded into the input/lookup.
