# EC-507 — Per-Scheme Approved-Loadout Server (Execution Checklist)

**Source:** docs/ai/work-packets/WP-472-per-scheme-approved-loadout-server.md
**Layer:** Server (`apps/server`) — legends module registry-free (injected data)

## Before Starting
- [ ] WP-471 ✅ merged (`getGauntletConfig(setAbbr, mastermindSlug, schemeSlug,
      playerCount)` + `getActiveYear` exist).
- [ ] On `origin/main` (post-WP-471), worktree clean; server green.
- [ ] **`competitive_scores` is empty** (`SELECT count(*)`), so re-keying qualification
      re-keys nothing. If NOT empty: any historical row on a now-swapped scheme that used
      the mastermind's *base* villains **silently de-qualifies** on recompute (its
      `scenarioKey` villain-segment no longer matches the leg's per-scheme config) — a
      conscious pre-launch call, not a surprise. Note it and confirm with the operator.
- [ ] Confirm `matchesApprovedLoadout` receives `scenarioKey` and parses `[2]`
      (villains); `[0]` (scheme) is in-hand; `server.mjs` wiring gathers schemes;
      `GauntletDefinition.legs` are the schemes.
- [ ] **Exact target file set (any outside = FAIL, STOP):** `server.mjs`,
      `gauntlet.logic.ts` (+`.test.ts`), `gauntletTruth.logic.ts` (+`.test.ts`),
      `legends.publisher.ts` (+`.test.ts`), `legends.types.ts`, `DECISIONS.md`.

## Locked Values (do not re-derive)
- Approved loadout keyed per (scheme × mastermind × player-count); published on
  **`GauntletIndexLeg`** (`approvedLoadouts?: GauntletIndexApprovedLoadouts`).
- **Exact additive signature (do NOT deviate — the arc-split invariant):**
  `matchesApprovedLoadout` signature UNCHANGED; `qualifiesAsLegClear` gains **exactly one
  new optional trailing param** `approvedLoadoutsByScheme?: ReadonlyMap<string,
  GauntletApprovedLoadouts>`, resolving `effective =
  approvedLoadoutsByScheme?.get(scenarioKey.split('::')[0]) ?? approvedLoadouts` before the
  existing match. **`GauntletApprovedLoadouts` shape + the `approvedLoadouts` param +
  `definition.approvedLoadouts` are PRESERVED unchanged** — do NOT re-key the type in
  place or move it onto `GauntletLeg`. This keeps WP-473's 3-arg call site compiling.
  `getGauntletStandings` builds + passes the per-scheme map; the leg-level loadout is a
  NEW additive `GauntletLeg` field; the entry-level `GauntletIndexEntry.approvedLoadouts`
  stays **dual-written** (per-mastermind) — WP-474 removes it (RS-1, no deploy-window blank).
- `buildSetDetailsCatalog` (D-24279 `usedByGauntlets` coverage) recomputes against the
  per-scheme configs (a group is "used" if it appears in **any leg's** config).
- Run-tracker leg-clear (`gauntletRunProgress.logic.ts`) + per-leg launch
  (`resolveGauntletRunProgressInputs`, `GauntletRunLaunch`) are **OUT** → WP-473.
- Wiring builds the per-(set/mastermind/scheme) map from the WP-471 loader
  (`getActiveYear`); legends module stays registry-free (injected via the catalog path).
- `ScenarioKey` / `henchman_key` / scoring math UNCHANGED; PAR count unchanged.
- **Land D-24283** (reserved → Active): supersedes D-24278's per-mastermind axis;
  keeps 1 variant per leg + D-24199 core rule; PAR ~2,118 unchanged; zero migration.

## Guardrails
- Legends module imports NO registry — per-scheme configs arrive injected (as today).
- Deterministic fixed-property-order JSON; additive on the leg (pre-WP-474 readers
  ignore it); `for...of`, no `.reduce()`.
- Do NOT change `ScenarioKey`/`henchman_key` shape, the scoring math, or non-Core
  qualification/publish behaviour.

## Required `// why:` Comments
- Why `matchesApprovedLoadout` now parses the scheme it already reads.
- Why the loadout moves onto `GauntletIndexLeg` (per-scheme, colocated with the scheme).
- Why the legends module still imports no registry (injected per-scheme map).

## Files to Produce
- `server.mjs` — per-(set/mastermind/scheme) approved map from the WP-471 loader.
- `gauntlet.logic.ts` — build the scheme-keyed `ReadonlyMap` + additive per-leg stamp (type preserved);
  `getGauntletStandings` passes the leg's config; `buildSetDetailsCatalog` coverage
  recompute (+ test: reject a wrong-scheme match; coverage counts any-leg use).
- `gauntletTruth.logic.ts` — per-scheme selection in `matchesApprovedLoadout` (+ test).
- `legends.publisher.ts` — per-leg emission (+ test).
- `legends.types.ts` — loadout onto `GauntletIndexLeg`.
- `DECISIONS.md` — land D-24283.

## After Completing
- [ ] Server tests (run affected pure files directly if the DB suite times out) +
      `pnpm -r build` exit 0. **D-24283 Active.**
- [ ] **D-24026 live-verify (operator-pending):** deployed `gauntlet-index.json` legs
      carry per-scheme loadouts; Core Dr. Doom Secret-Invasion 2p = skrulls + masters-of-evil.
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-507 Done.
- [ ] No file outside the allowlist (+ governance) modified. Revert lagn-v1.json EOL churn.

## Common Failure Smells
- A wrong-scheme run still qualifies → `matchesApprovedLoadout` didn't select by the
  parsed scheme, or the per-scheme map wasn't threaded.
- Non-Core standings/publish drifted → the injected map isn't seeded-equivalent.
- Legends module imports the registry → move the loader read to `server.mjs` (wiring).
