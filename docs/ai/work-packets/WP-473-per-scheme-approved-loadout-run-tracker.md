# WP-473 — Per-Scheme Approved-Loadout: Run-Tracker Leg-Clear + Per-Leg Launch (Arc 3/5)

**User-Visible Surface:** `play.legendary-arena.com` — the gauntlet run tracker's
per-leg "Play this leg" now launches the **leg's** approved adversaries (not the
mastermind default), and a leg counts as cleared only when it was won against **its
own** approved config. **D-24026 live-verification applies** (operator-pending: a run
tracker in a live match).

## User-Visible Impact

Closes the functional break the per-scheme re-key would otherwise leave: today "Play
this leg" launches one per-mastermind composition for every leg, so a leg that
requires (e.g.) Skrulls launches Brotherhood and the replay can **never** qualify.
After this packet the launch composition and the leg-clear qualification are both
keyed to the leg's scheme, so per-scheme legs are actually playable and clearable.

## Goal

Arc 3 of 5. Migrate the two **run-tracker** consumers of the WP-472 additive
per-scheme truth: (1) `gauntletRunProgress.logic.ts` leg-clear passes the leg scheme
into `qualifiesAsLegClear`, so a leg clears only against its own approved config; and
(2) the per-leg **launch composition** (`server.mjs resolveGauntletRunProgressInputs`
+ the `GauntletRunLaunch` wire-shape + `deriveGauntletRunLaunch`) resolves the villains
/ henchmen **per leg** from the WP-471 loader instead of the single per-mastermind
variant-0 applied to every leg. No new decision — consumes the **D-24283** contract.

## Assumes

- **On `origin/main` after WP-472 merges** — `gauntletTruth.logic.ts`
  `qualifiesAsLegClear` / `matchesApprovedLoadout` accept the additive per-scheme
  lookup (absent-scheme → today's per-mastermind fallback, WP-472), and the WP-471
  loader `getGauntletConfig(setAbbr, mastermindSlug, schemeSlug, playerCount)` is on
  `main`. `apps/server` green.
- Chain map (2026-07-30, confirmed by the WP-473 surface study): the leg-clear
  predicate `deriveGauntletRunProgress` (`gauntletRunProgress.logic.ts`) calls
  `qualifiesAsLegClear` with `inputs.approvedLoadouts` (a per-mastermind
  `GauntletApprovedLoadouts`); the scheme is already parsed by the caller from
  `replay.scenarioKey.split('::')[0]` (used today only to bucket the win into
  `clearedSchemeSlugs`) — so the scheme is **in hand**, just not passed to the
  predicate. The launch resolver `resolveGauntletRunProgressInputs` (`server.mjs`)
  reads `definition.approvedLoadouts?.[playerCount]?.[0]` — one composition for the
  whole run — and `GauntletRunLaunch` (`gauntletRun.types.ts`) is a single per-run
  block the client applies to every leg.

## Context (Read First)

**Read before executing:** `docs/ai/ARCHITECTURE.md §Layer Boundary` (server wires;
legends/gauntlet modules import no registry — per-scheme configs injected via the
wiring layer), `.claude/rules/architecture.md` + the `legendary-server` skill, WP-472's
additive `qualifiesAsLegClear` param + the WP-471 loader,
`docs/ai/REFERENCE/00.2-data-requirements.md §8.1` (canonical `villainGroupIds` /
`henchmanGroupIds` field names in the launch composition), and the **D-24283** entry in
`DECISIONS.md`. Source: `apps/server/src/gauntlet/gauntletRunProgress.logic.ts`
(`deriveGauntletRunProgress`, `deriveGauntletRunLaunch`, the `qualifiesAsLegClear` call
site, `LegClearReplayFacts`), `apps/server/src/gauntlet/gauntletRun.types.ts`
(`GauntletRunLaunch`, `GauntletRunProgressInputs`, `GauntletRunLegProgress`),
`apps/server/src/server.mjs` (`resolveGauntletRunProgressInputs`, the launch
composition read).

## Scope (In)

- **`apps/server/src/gauntlet/gauntletRunProgress.logic.ts`**: `deriveGauntletRunProgress`
  passes the leg scheme (`replay.scenarioKey.split('::')[0]`, already computed for
  bucketing) into `qualifiesAsLegClear` so leg-clear qualifies against the **leg's**
  per-scheme config; `deriveGauntletRunLaunch` builds the launch composition **per leg**
  from the per-scheme config instead of one per-run composition. (+ tests.)
- **`apps/server/src/gauntlet/gauntletRun.types.ts`**: **additively** add a per-leg
  (per-scheme) launch map to `GauntletRunLaunch` **alongside** the existing per-run block
  (e.g. a new `legLaunch?: Record<schemeSlug, GauntletRunLaunchComposition>` field, per-run
  block preserved and still populated with the mastermind default) so the client can
  assemble each leg's `MatchSetupConfig` with the leg's own adversaries **and** the
  arena-client consumer keeps reading the old per-run block until it migrates in **WP-475**
  — no runtime break in the deploy window. `GauntletRunProgressInputs` /
  `GauntletRunLegProgress` carry the per-leg approved config the two helpers read.
- **`apps/server/src/server.mjs`** (01.5 wiring): `resolveGauntletRunProgressInputs`
  builds the per-leg approved map (from the WP-471 loader / the WP-472 per-scheme
  wiring source) and feeds it to the two helpers, replacing the
  `definition.approvedLoadouts?.[playerCount]?.[0]` single-composition read.
- **Tests**: a leg clears only when won against its **own** approved config (a
  swapped-scheme win with the mastermind's *other* scheme's villains does **not**
  clear the requiring leg); the per-leg launch composition returns the leg's scheme's
  adversaries (a Skrulls leg launches Skrulls, a non-swapped leg launches Brotherhood).

## Out of Scope

- No shared-truth signature/registry change (WP-472 / WP-471 own the additive param +
  loader). No leaderboard change (WP-472). No legends-board / cards change (WP-474). **No
  arena-client change — the `apps/arena-client` "Play this leg" consumer of the per-leg
  launch map migrates in WP-475** (this packet keeps the per-run `launch` block populated
  so it stays green until then). No `ScenarioKey` / `henchman_key` / scoring-math change;
  no new persisted column (the run's `leg_picks` shape is unchanged — only the
  launch/clear derivation keys by scheme).

## Files Expected to Change

- `apps/server/src/gauntlet/gauntletRunProgress.logic.ts` — leg-clear scheme + per-leg launch (+ test)
- `apps/server/src/gauntlet/gauntletRun.types.ts` — `GauntletRunLaunch` **additive** per-leg map
- `apps/server/src/server.mjs` — 01.5 wiring (`resolveGauntletRunProgressInputs` per-leg map)
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** (§21: whole-row update of `GET /api/me/gauntlet-runs`, row for the `run.launch` block — additive per-leg `legLaunch` map alongside the per-run block; Status `Wired`, Auth `authenticated-session-required` unchanged; cite WP-473 + D-24283)
- `docs/ai/DECISIONS.md` — **not** edited here (D-24283 lands at WP-472)

## Contract

> Full file contents (no diffs); ESM/Node v22+; `00.6`; the gauntlet module imports no
> registry (per-scheme configs injected via the wiring layer, as today); deterministic
> fixed-order derivation; the run's persisted `leg_picks` shape is unchanged.

**Locked:** leg-clear qualifies against the **leg's** per-scheme config (via WP-472's
additive `qualifiesAsLegClear` scheme param); `GauntletRunLaunch` is **per leg** so the
client launches each leg's own adversaries; `ScenarioKey` / `henchman_key` / scoring
shapes unchanged; PAR scenario count unchanged (~2,118); `competitive_scores` empty so
zero migration/invalidation.

## Acceptance Criteria

- [ ] `deriveGauntletRunProgress` clears a leg only when its winning replay matched the
      **leg's** approved config; a win carrying a *different* scheme's villains of the
      same mastermind does **not** clear the requiring leg (new test).
- [ ] `deriveGauntletRunLaunch` / the launch resolver returns the **leg's** scheme
      adversaries per leg (a Core Dr. Doom "Secret Invasion…" leg launches Skrulls +
      Masters of Evil at 2p; a non-swapped Dr. Doom leg launches Brotherhood + Masters
      of Evil), not one per-run composition.
- [ ] Non-Core runs clear + launch identically to today (seeded configs → no behaviour
      change).
- [ ] The gauntlet module imports no registry; per-scheme configs arrive injected.
- [ ] Server tests (run the affected pure files directly if the DB suite times out) +
      `pnpm -r build` exit 0. No `D-entry` here (D-24283 at WP-472).
- [ ] No file outside the allowlist (+ governance) is modified.

## Verification Steps

```bash
node --import tsx --test apps/server/src/gauntlet/gauntletRunProgress.logic.test.ts
pnpm -r build
# Post-deploy (D-24026): in a live run tracker, "Play this leg" on a swapped scheme
# launches that scheme's adversaries; clearing it credits only that leg.
```

## Vision Alignment

**Clauses:** §20-26 (competitive gauntlet), §22 (scoring config versioning).
**Conflict:** *No conflict* — closes the per-scheme launch/clear functional gap; PAR /
score math unchanged; `competitive_scores` empty (zero migration). Consumes **D-24283**
(landed at WP-472). **NG:** none.

## Definition of Done

- [ ] All AC pass; server tests + `pnpm -r build` green.
- [ ] **D-24026 live-verify (operator-pending):** "Play this leg" launches the leg's
      adversaries; leg-clear credits the correct leg.
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-508 Done.
- [ ] No files outside the list. No D-entry (consumes D-24283).

## Lint Gate Self-Review

- §1/§15: header + impact; D-24026 present. PASS. §2: full-file/no-diffs/`00.6`. PASS.
  §4: read-list. PASS. §5: 2 gauntlet files (+ test) + wiring (01.5). PASS. §8: gauntlet
  module registry-free (injected). PASS. §17: §20-26/§22, No conflict; consumes D-24283.
  PASS. §20 N/A — no funding surface, copy, or channel touched. **§21 TRIGGERED** — the
  `GauntletRunLaunch` change alters the `GET /api/me/gauntlet-runs` response `run.launch`
  sub-shape (a catalogued endpoint), so `docs/ai/REFERENCE/api-endpoints.md` gets a
  whole-row update in the same commit (row unchanged Status `Wired` / Auth
  `authenticated-session-required`; response schema gains the additive per-leg `legLaunch`
  map; cite WP-473 + D-24283). Reserves/lands **no** D-entry.

## Gate Verdicts (drafting session)

Recorded at drafting; see the SPEC commit body (paired with WP-471 + WP-472 + WP-474).
