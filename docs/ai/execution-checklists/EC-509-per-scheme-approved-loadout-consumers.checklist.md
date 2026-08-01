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
- Cards: add `schemeId` to `GauntletQualificationInput` + resolve the leg's config via
  `getGauntletConfig`, **falling back to the per-mastermind menu
  (`GauntletLoadoutMenu` / `compositionsByPlayerCount`) when it returns `undefined`** (all
  non-Core, unswapped Core — the today-behaviour); `resolveGauntletLegLoadout` selects the
  composition by `input.schemeId` the same way (loader where present, else scheme-blind
  menu). The legends-board consumers instead read `leg.approvedLoadouts` (WP-472's
  effective loadout — already menu-fallback-filled per leg).
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

## Execution Reconciliation (2026-08-01, operator-confirmed — SPLIT)

**Supersedes the Before-Starting file set and the cards items above.** The registry-viewer
half is **infeasible as drafted**: `getGauntletConfig` (WP-471) is **Node-only** (`node:fs`
`readFileSync` at module load, reachable only via the registry root barrel; no
`/gauntletConfigs` subpath), and `apps/registry-viewer` is a Vite browser app that must not
import the root barrel. There is no browser-safe per-scheme data source in the cards builder
today. **Operator decision: SPLIT** — this packet ships the **legends-board half only** (the
published `gauntlet-index.json` is browser-safe), and the **cards half (AC#3)** moves to a
new WP that first adds a browser-safe per-scheme registry export.

- **Actual target file set (subset):** `snapshotClient.ts`, `gauntletDisplay.{ts,test.ts}`,
  `GauntletIndexPanel.vue`, `GauntletBoardPanel.vue` (+ governance). The three registry-viewer
  files are **NOT touched**.
- **Leg-level read with entry-level fallback:** the mirror adds `GauntletIndexLeg.approvedLoadouts`;
  consumers use `selectLegApprovedLoadout` (leg-level preferred, entry-level per-mastermind
  fallback for a pre-WP-472 snapshot). `buildCoverageMatrix` selects per leg;
  `buildRowChallengeUrl` + board per-leg links pin the leg's config; `buildGauntletDetails`
  is per-scheme (`GauntletDetailConfig` gains `schemeName`).
- No D-entry (consumes D-24283). See WP-474 §Execution Reconciliation for the full rationale.
