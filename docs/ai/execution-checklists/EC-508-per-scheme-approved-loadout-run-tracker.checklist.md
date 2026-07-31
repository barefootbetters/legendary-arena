# EC-508 — Per-Scheme Approved-Loadout Run-Tracker + Launch (Execution Checklist)

**Source:** docs/ai/work-packets/WP-473-per-scheme-approved-loadout-run-tracker.md
**Layer:** Server (`apps/server`) — gauntlet module registry-free (injected data)

## Before Starting
- [ ] WP-472 ✅ merged (`qualifiesAsLegClear` / `matchesApprovedLoadout` accept the
      additive per-scheme lookup, absent-scheme → per-mastermind fallback) and WP-471 ✅
      (`getGauntletConfig(setAbbr, mastermindSlug, schemeSlug, playerCount)`).
- [ ] On `origin/main` (post-WP-472), worktree clean; server green.
- [ ] Confirm `deriveGauntletRunProgress` calls `qualifiesAsLegClear` with
      `inputs.approvedLoadouts` (per-mastermind) and the scheme is parsed by the caller
      from `replay.scenarioKey.split('::')[0]` (today used only for `clearedSchemeSlugs`);
      `resolveGauntletRunProgressInputs` reads `definition.approvedLoadouts?.[count]?.[0]`
      (one composition for the whole run); `GauntletRunLaunch` is a single per-run block.
- [ ] `competitive_scores` empty (same de-qualify caveat as EC-507 if not — swapped-scheme
      historical clears drop out of run-tracker leg-clear on recompute).
- [ ] **Exact target file set (any outside = FAIL, STOP):**
      `apps/server/src/gauntlet/gauntletRunProgress.logic.ts` (+`.test.ts`),
      `apps/server/src/gauntlet/gauntletRun.types.ts`, `apps/server/src/server.mjs`,
      `docs/ai/REFERENCE/api-endpoints.md` (§21: whole-row update of `GET /api/me/gauntlet-runs`).

## Locked Values (do not re-derive)
- Leg-clear qualifies against the **leg's** per-scheme config: `deriveGauntletRunProgress`
  passes the leg scheme (`replay.scenarioKey.split('::')[0]`, already in hand) into
  WP-472's additive `qualifiesAsLegClear` scheme param.
- `GauntletRunLaunch` gains a per-leg (per-scheme) `legLaunch` map **additively** — the
  per-run block is PRESERVED + still populated (mastermind default) so the arena-client
  consumer stays green until WP-475 migrates it; `deriveGauntletRunLaunch` builds each
  leg's composition from the per-scheme config. **§21:** this is a `GET /api/me/gauntlet-runs`
  response `run.launch` sub-shape change → whole-row update of `api-endpoints.md` (Status
  `Wired` / Auth `authenticated-session-required` unchanged; cite WP-473 + D-24283).
- Wiring builds the per-leg approved map from the WP-471 loader / the WP-472 per-scheme
  wiring source; gauntlet module stays registry-free (injected).
- `ScenarioKey` / `henchman_key` / scoring math UNCHANGED; run `leg_picks` shape unchanged;
  PAR ~2,118 unchanged; `competitive_scores` empty → zero migration.
- **No D-entry** (consumes D-24283, landed at WP-472).

## Guardrails
- Gauntlet module imports NO registry — per-scheme configs arrive injected (as today).
- Deterministic fixed-property-order derivation; `for...of`, no `.reduce()`.
- Do NOT change `ScenarioKey`/`henchman_key`, the scoring math, the persisted `leg_picks`
  shape, or non-Core clear/launch behaviour (seeded configs → byte-identical).
- Do NOT touch the shared truth signature (WP-472 owns the additive param) or the
  leaderboard caller.

## Required `// why:` Comments
- Why leg-clear passes the scheme it already parses (per-scheme qualification).
- Why `GauntletRunLaunch` is now per-leg (each leg launches its own adversaries).
- Why the gauntlet module still imports no registry (injected per-leg map).

## Files to Produce
- `gauntletRunProgress.logic.ts` — leg-clear passes the leg scheme; `deriveGauntletRunLaunch`
  per-leg composition (+ test: a wrong-scheme win does not clear the requiring leg; a leg's
  launch returns its scheme's adversaries).
- `gauntletRun.types.ts` — add the additive per-leg `legLaunch` map (per-run block preserved); inputs carry the per-leg config.
- `server.mjs` — `resolveGauntletRunProgressInputs` builds + injects the per-leg approved map.

## After Completing
- [ ] Server tests (run affected pure files directly if the DB suite times out) +
      `pnpm -r build` exit 0.
- [ ] **D-24026 live-verify (operator-pending):** "Play this leg" launches the leg's
      scheme adversaries; clearing a swapped leg credits only that leg.
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-508 Done.
- [ ] No file outside the allowlist (+ governance) modified. No D-entry.

## Common Failure Smells
- A wrong-scheme win still clears the leg → the scheme wasn't passed to `qualifiesAsLegClear`.
- Every leg launches the same adversaries → `GauntletRunLaunch` stayed per-run, not per-leg.
- Non-Core clear/launch drifted → the injected per-leg map isn't seeded-equivalent.
- Gauntlet module imports the registry → move the loader read to `server.mjs` wiring.
