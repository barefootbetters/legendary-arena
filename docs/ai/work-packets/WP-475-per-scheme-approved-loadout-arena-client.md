# WP-475 — Per-Scheme Approved-Loadout: Arena-Client "Play this leg" Launch Consumer (Arc 5/5)

**User-Visible Surface:** `play.legendary-arena.com` — the profile gauntlet run tracker's
**"Play this leg"** button now assembles the **leg's** approved adversaries from the
per-leg launch map (not the mastermind default). **D-24026 live-verification applies**
(operator-pending: click "Play this leg" on a swapped scheme in the live profile tracker).

## User-Visible Impact

Completes the per-scheme arc's headline benefit on the primary play surface. Today the
arena-client "Play this leg" reads the per-run `launch` block **flat** (ignoring the
leg), so after WP-473 re-keys the launch it would launch empty/wrong villains. This
packet migrates the arena-client consumer to the per-leg `legLaunch` map so each leg
launches its own scheme's adversaries.

## Goal

Arc 5 of 5. Migrate the **arena-client** consumer of the per-leg launch map WP-473 added
(additively) to `GauntletRunLaunch`: the run-API mirror carries the per-leg map, and
`MyProfilePage.vue playLeg(run, leg)` selects `run.launch.legLaunch[leg.schemeSlug]`
(falling back to the per-run block for an old snapshot) when assembling the
`MatchSetupConfig`. No new decision — consumes the **D-24283** contract.

## Assumes

- **On `origin/main` after WP-473 merges** — the `GET /api/me/gauntlet-runs` `run.launch`
  block carries the **additive per-leg `legLaunch` map** (WP-473) while the per-run block
  is still populated (fallback). `apps/arena-client` green.
- Chain map (2026-07-31, WP-473 lint finding): `apps/arena-client` **mirrors** (does not
  import) the server `GauntletRunLaunch` type — `apps/arena-client/src/lib/api/gauntletRunApi.ts`
  (~line 77) mirrors the launch shape, and `apps/arena-client/src/pages/MyProfilePage.vue`
  `playLeg(run, leg)` (~lines 775-797) reads `run.launch.villainGroupIds` **flat, ignoring
  `leg`** (the "client twin of the launch break" on the primary play surface). arena-client
  cannot import the registry (D-24269); everything it needs is on the wire.

## Context (Read First)

**Read before executing:** `docs/ai/ARCHITECTURE.md §Layer Boundary` (arena-client is a
client tier — mirrors server wire types, imports no server/registry), the WP-473
`GauntletRunLaunch` per-leg `legLaunch` addition + the `api-endpoints.md` row for
`GET /api/me/gauntlet-runs`, `docs/ai/REFERENCE/00.2-data-requirements.md §8.1` (the
`villainGroupIds` / `henchmanGroupIds` field names), and the D-24269 launch-block design
(arena-client assembles the `MatchSetupConfig` from the server launch block + the leg's
`schemeId`). Source: `apps/arena-client/src/lib/api/gauntletRunApi.ts`,
`apps/arena-client/src/pages/MyProfilePage.vue` (`playLeg`).

## Scope (In)

- **`apps/arena-client/src/lib/api/gauntletRunApi.ts`** — mirror the additive per-leg
  `legLaunch` map on the client's `GauntletRunLaunch` shape (alongside the per-run block).
- **`apps/arena-client/src/pages/MyProfilePage.vue`** — `playLeg(run, leg)` selects the
  leg's launch composition `run.launch.legLaunch?.[leg.schemeSlug]` and falls back to the
  per-run block when absent — either an old snapshot **or** a leg with no per-scheme
  override (WP-473 populates `legLaunch` with each leg's effective composition, but the
  `?? per-run block` fallback keeps the flat default correct if a leg is missing) — then
  assembles the `MatchSetupConfig` as today. (+ test if a spec exists for the page's launch
  assembly.)

## Out of Scope

- No server / registry change (WP-473 owns the wire shape; WP-471 the loader). No
  legends-board / cards / registry-viewer change (WP-474). No `MatchSetupConfig`-assembly
  logic change beyond **which** composition is selected. No new endpoint.

## Files Expected to Change

- `apps/arena-client/src/lib/api/gauntletRunApi.ts` — mirror the per-leg `legLaunch` map
- `apps/arena-client/src/pages/MyProfilePage.vue` — `playLeg` selects the leg's launch

## Contract

> Full file contents (no diffs); ESM/Node v22+; `00.6`; arena-client is a client tier —
> mirrors (never imports) the server wire type; degrades on an old snapshot (per-leg map
> absent → per-run block).

**Locked:** "Play this leg" assembles the **leg's** adversaries via
`run.launch.legLaunch[leg.schemeSlug]`, per-run block as the fallback; no server/registry
import; `MatchSetupConfig` assembly otherwise unchanged.

## Acceptance Criteria

- [ ] `playLeg(run, leg)` selects `run.launch.legLaunch[leg.schemeSlug]` (a Core Dr. Doom
      "Secret Invasion…" leg launches Skrulls + Masters of Evil; a non-swapped leg launches
      Brotherhood + Masters of Evil), not the flat per-run block.
- [ ] An old snapshot with no `legLaunch` map degrades cleanly to the per-run block (no
      crash, no empty villains).
- [ ] `apps/arena-client` `test` / `typecheck` / `build` + `pnpm -r build` exit 0.
- [ ] No file outside the allowlist (+ governance) is modified. No D-entry (consumes D-24283).

## Verification Steps

```bash
pnpm --filter @legendary-arena/arena-client test typecheck build
pnpm -r build
# Post-deploy (D-24026): in the live profile run tracker, click "Play this leg" on a
# swapped scheme — the created match fields that scheme's adversaries, not the default.
```

## Vision Alignment

**Clauses:** §20-26 (competitive gauntlet). **Conflict:** *No conflict* — client-tier
read of the per-scheme launch contract; assembles the leg's `MatchSetupConfig`. **NG:** none.

## Definition of Done

- [ ] All AC pass; arena-client + `pnpm -r build` green.
- [ ] **D-24026 live-verify (operator-pending):** "Play this leg" launches the leg's adversaries.
- [ ] STATUS; WORK_INDEX `[x]`; MINDMAP `📝`→`✅` + counts:write; EC_INDEX EC-510 Done.
- [ ] No files outside the list. No D-entry (consumes D-24283).

## Lint Gate Self-Review

- §1/§15: header + impact; D-24026 present. PASS. §2: full-file/no-diffs/`00.6`. PASS.
  §4: read-list incl. `00.2 §8.1`. PASS. §5: 2 arena-client files (+ governance). PASS.
  §8: client tier, mirrors-not-imports. PASS. §17: §20-26, No conflict; consumes D-24283.
  PASS. §20 N/A — no funding surface, copy, or channel touched. §21 N/A — client-tier
  reads only; no `apps/server` HTTP endpoint or Library-only function touched (WP-473 owns
  the `/api/me/gauntlet-runs` row). No new contract file; no D-entry.

## Gate Verdicts (drafting session)

Recorded at drafting; see the SPEC commit body (paired with WP-471 + WP-472 + WP-473 + WP-474).
