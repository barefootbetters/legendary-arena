# WP-471 — Year-Keyed Gauntlet-Config JSON + Registry Loader (Arc 1/5)

**User-Visible Surface:** none directly (registry data + loader). Enables the
per-scheme gauntlet variety users see once WP-472 (server truth + leaderboard) +
WP-473 (run-tracker + launch) + WP-474 (client) land.
**D-24026 inverted** (no user-observable change in this packet alone).

## User-Visible Impact

None in this packet. It replaces the generated per-mastermind approved-loadout
source with a hand-authored, year-keyed JSON that varies the approved adversaries
**per scheme**, so a later packet can publish the variety.

## Goal

Arc 1 of 5 (per-scheme gauntlet variety, operator-directed 2026-07-30). Replace the
**generated** gauntlet approved-loadouts (`GAUNTLET_LOADOUT_MENUS`, one config per
mastermind × count, D-24278) with a **fully-authored, year-keyed JSON** config file
whose configs are keyed per **(year → set → mastermind → scheme)**, each an ordered
adversary **pool** that scales by player count via `REQUIRED_GROUP_COUNTS`. This
packet is the **registry foundation**: the JSON file, a Zod validator, and a loader
exposing a per-(set × mastermind × scheme) lookup. WP-472 (server truth + leaderboard),
WP-473 (run-tracker + launch), and WP-474 (client + cards) consume it.

Two authoring steps: **(1) seed** the JSON programmatically from today's
`GAUNTLET_LOADOUT_MENUS` so every set's per-scheme pools initially equal its current
per-mastermind config (non-Core is behaviourally byte-identical); **(2) apply the
Core swaps** the operator confirmed (below). The JSON is the new source of truth;
the generator's role narrows to a one-time seeder (retained for re-seeding a new
year, not run at build time).

## Assumes

- **On `origin/main` @ `f6c7c43b`.** Registry + server + client build/test/typecheck
  green. **WP-458 / D-24278 ✅** (the one-config-per-mastermind menu this supersedes).
- `packages/registry/src/gauntletLoadouts.ts` defines `GauntletLoadoutMenu` /
  `GauntletLoadoutComposition` / `getGauntletLoadoutMenu(setAbbr, mastermindSlug)`;
  `gauntletLoadouts.generated.ts` is the generated `GAUNTLET_LOADOUT_MENUS`
  (per mastermind × count, no scheme); `REQUIRED_GROUP_COUNTS` (in
  `scripts/generate-gauntlet-loadouts.mjs`) sets per-count villain/henchman counts.
  (Source: WP-471 chain map, 2026-07-30.)
- `data/cards/{abbr}.json` provides each set's schemes/villains/henchmen slugs.

## Context (Read First)

**Read before executing:** `docs/ai/ARCHITECTURE.md §Layer Boundary` (registry:
loads/validates data, no engine/server import), `.claude/rules/`
(`legendary-registry` skill), `packages/registry/src/gauntletLoadouts.ts` (the
current contract + `buildVillainSegment`/`buildHenchmanKey`/`REQUIRED_GROUP_COUNTS`),
`scripts/generate-gauntlet-loadouts.mjs` (the generator to seed from),
`docs/ai/REFERENCE/00.2-data-requirements.md §8.1` (the canonical `villainGroupIds` /
`henchmanGroupIds` field names the JSON + loader emit), and the D-24283 draft in
`DECISIONS.md` (the superseding decision, landed at WP-472).

The operator wants the gauntlet's approved adversaries to vary by scheme (so a
mastermind's 8 legs aren't identical), authored in JSON so revisions are data edits,
not code — and year-keyed so the annual championship can update configs year-to-year.

## Scope (In)

- **`data/gauntlet-configs.json`** (new) — `{ schemaVersion, activeYear, years: {
  "2026": { "<setAbbr>": { "<mastermindSlug>": { "<schemeSlug>": { villains: [ordered
  slugs], henchmen: [ordered slugs] } } } } } }`. Bare slugs (set is the parent key).
  Seeded for all sets; Core carries the confirmed swaps.
- **`scripts/seed-gauntlet-configs.mjs`** (new) — a one-time seeder that dumps the
  current `GAUNTLET_LOADOUT_MENUS` into the JSON's active-year block as per-scheme
  pools (each scheme = the mastermind's current ordered pool). Re-runnable to seed a
  new year; NOT run at build.
- **`packages/registry/src/gauntletConfigs.ts`** (new) — the JSON's TS type + a Zod
  validator (`validateGauntletConfigs`) + a loader `getGauntletConfig(setAbbr,
  mastermindSlug, schemeSlug, playerCount)` returning the scaled
  `{ villainGroupIds, henchmanGroupIds }` (set-qualified) for that leg + count (first
  `REQUIRED_GROUP_COUNTS[count]` of each pool), and `getActiveYear()`. Reads the JSON
  once (validated at load; throws on malformed data — registry setup-time throw is
  allowed).
- **`packages/registry/src/gauntletConfigs.test.ts`** (new) — validator + loader
  (pool scaling per count; Core swap presence; set-qualification; unknown leg → the
  seeded default; malformed → throw).

## Out of Scope

- **No server/client/publisher/snapshot change** (WP-472 / WP-473 / WP-474). This
  packet only produces the data + loader; nothing consumes it yet.
- No removal of `GAUNTLET_LOADOUT_MENUS` yet (WP-472/473/474 migrate consumers
  incrementally; this packet leaves the generated file in place so nothing breaks mid-arc).
- No archival/rollover machinery — the year key exists; only the active year is
  exposed by the loader.

## Files Expected to Change

- `data/gauntlet-configs.json` — **new** (authored data)
- `scripts/seed-gauntlet-configs.mjs` — **new** (seeder)
- `packages/registry/src/gauntletConfigs.ts` — **new** (type + validator + loader)
- `packages/registry/src/gauntletConfigs.test.ts` — **new** (tests)
- `packages/registry/src/index.ts` — **modified** (barrel: add explicit named exports
  `getGauntletConfig`, `getActiveYear`, `validateGauntletConfigs`, and the config type(s)
  from `./gauntletConfigs.js` — WP-472 imports them via `@legendary-arena/registry`, and
  the barrel uses explicit named exports, no `export *`, so a new symbol is unreachable
  until added here; WP-472 is server-only and cannot add it)
- `docs/ai/DECISIONS.md` — **not** edited here (D-24283 lands at WP-472)

## Contract

> Full file contents (no diffs); ESM/Node v22+; human-style code per
> `00.6-code-style.md`; registry imports only Node built-ins + `zod`; the loader is
> pure/deterministic; the JSON is the source of truth (validated at load).

**Locked — JSON shape:** `year → setAbbr → mastermindSlug → schemeSlug →
{ villains: string[], henchmen: string[] }`, bare slugs, each an **ordered pool**
(inclusion priority: pool[0] is always included at 1 player). The loader scales by
`REQUIRED_GROUP_COUNTS[count]` (villains 1→1,2→2,3→3,4→3,5→4; henchmen
1→1,2→1,3→1,4→2,5→2) and set-qualifies ids as `` `${setAbbr}/${slug}` ``. Active
year drives the loader.

**Locked — Core per-scheme swaps** (year 2026; base pool = the seeded current config;
swaps replace one pool slot so the 2-player fight varies; higher counts scale the
same pool):

- **Dr. Doom** base villains `[masters-of-evil, brotherhood, enemies-of-asgard,
  hydra]`; on `negative-zone-prison-breakout`, `secret-invasion-of-the-skrull-
  shapeshifters`, `super-hero-civil-war`, `unleash-the-power-of-the-cosmic-cube`:
  villains `[masters-of-evil, skrulls, enemies-of-asgard, hydra]` (skrulls ⇄ brotherhood).
- **Magneto** base villains `[brotherhood, enemies-of-asgard, hydra, masters-of-evil]`,
  henchmen `[doombot-legion, hand-ninjas]`; villains `[brotherhood, spider-foes, hydra,
  masters-of-evil]` on `midtown-bank-robbery`, `super-hero-civil-war`; henchmen
  `[sentinel, hand-ninjas]` on `portals-to-the-dark-dimension`, `replace-earths-
  leaders-with-killbots`; henchmen `[savage-land-mutates, hand-ninjas]` on
  `negative-zone-prison-breakout`, `unleash-the-power-of-the-cosmic-cube`.
- **Red Skull** base villains `[hydra, brotherhood, enemies-of-asgard, masters-of-evil]`,
  henchmen `[doombot-legion, hand-ninjas]`; villains `[hydra, masters-of-evil,
  enemies-of-asgard, brotherhood]` on `midtown-bank-robbery`, `replace-earths-leaders-
  with-killbots`, `super-hero-civil-war`; henchmen `[hand-ninjas, doombot-legion]` on
  `portals-to-the-dark-dimension`, `unleash-the-power-of-the-cosmic-cube`.
- **Loki** base villains `[enemies-of-asgard, brotherhood, hydra, masters-of-evil]`,
  henchmen `[doombot-legion, hand-ninjas]`; villains `[radiation, brotherhood, hydra,
  masters-of-evil]` on `portals-to-the-dark-dimension`, `secret-invasion-of-the-skrull-
  shapeshifters`, `super-hero-civil-war`; henchmen `[savage-land-mutates, hand-ninjas]`
  on `legacy-virus-the`, `negative-zone-prison-breakout`.

Every other set/leg = its seeded current config (no swap).

**Faithfulness note — Loki `radiation` swap omits the Always-Leads group (deliberate,
verified safe).** Loki's `alwaysLeads` is `enemies-of-asgard`, and the `radiation` swap
replaces it as pool[0] on those legs, so the leg's approved pool no longer contains the
mastermind's printed Always-Leads group. This is **safe**: no setup layer enforces
`alwaysLeads` (it appears only as card metadata in `packages/registry/src/schema.ts`; the
engine builds the villain deck from the explicit `MatchSetupConfig.villainGroupIds`, and
none of the three match-setup validation layers reference it), so the leg still launches
and plays. Operator-confirmed 2026-07-30. Do **not** "fix" this by re-adding
`enemies-of-asgard` — the omission is intentional variety, not a bug.

## Acceptance Criteria

- [ ] `data/gauntlet-configs.json` validates; for every non-Core (set × mastermind ×
      scheme × count), the loader's output equals today's `GAUNTLET_LOADOUT_MENUS`
      config for that mastermind × count (behaviourally byte-identical).
- [ ] The Core swaps are present: e.g. `getGauntletConfig('core','dr-doom',
      'secret-invasion-of-the-skrull-shapeshifters',2)` villains =
      `['core/masters-of-evil','core/skrulls']`; a non-swapped Dr. Doom scheme at 2p
      = `['core/masters-of-evil','core/brotherhood']`.
- [ ] The loader scales pools by `REQUIRED_GROUP_COUNTS` (1p→1 villain … 5p→4) and
      set-qualifies ids; an unknown leg falls back to the seeded default; malformed
      JSON throws with a full-sentence error.
- [ ] Registry imports only Node built-ins + `zod`; no engine/server import.
- [ ] `pnpm --filter @legendary-arena/registry test`, `pnpm -r build`, `pnpm -r test`
      (registry) exit 0. No consumer behaviour changes (nothing reads the loader yet).
- [ ] No file outside the allowlist (+ governance) is modified.

## Verification Steps

```bash
node scripts/seed-gauntlet-configs.mjs        # regenerate the seed block (idempotent for non-Core)
git diff --stat data/gauntlet-configs.json    # confirm only the intended Core swaps differ from seed
pnpm --filter @legendary-arena/registry test
pnpm -r build && pnpm -r test
```

## Vision Alignment

**Clauses:** §20-26 (competitive gauntlet), §22 (scoring config versioning — the
year key ties the future archival rollover). **Conflict:** *No conflict* — data +
loader only; no scoring/RNG/determinism/persistence surface (no `G`). Sets up the
D-24283 contract (landed at WP-472). **NG:** none.

## Definition of Done

- [ ] All Acceptance Criteria pass; registry test + `pnpm -r build`/`test` green.
- [ ] `docs/ai/STATUS.md`; `WORK_INDEX.md` row `[x]`; `ROADMAP-MINDMAP.md` `📝`→`✅`
      + `pnpm roadmap:counts:write`; `EC_INDEX.md` EC-506 → Done.
- [ ] No D-entry lands here (D-24283 lands at WP-472). No files outside the list.
- [ ] `User-Visible Surface = none` — D-24026 inverted (STATUS "no user-observable
      change; enables WP-472/473/474").

## Lint Gate Self-Review

- §1/§15: header + `## User-Visible Impact` (none — infra); D-24026 inverted. PASS.
- §2: Contract full-file / no-diffs / `00.6`. PASS. §4: Context read-list. PASS.
  §5: 4 new files (data/seeder/loader/test). PASS. §8: registry layer, zod-only.
  PASS. §17: §20-26/§22, No conflict. PASS. §20 N/A (no funding). §21 N/A (no
  endpoint). New contract *file* `gauntletConfigs.ts` — its consumers land in
  WP-472/473/474; no D-entry here.

## Gate Verdicts (drafting session)

Recorded at drafting; see the SPEC commit body for the pre-flight / copilot / lint
subagent verdicts run against this WP + EC-506 (and the paired WP-472/473/474).
