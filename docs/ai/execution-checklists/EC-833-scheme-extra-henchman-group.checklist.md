# EC-833 — "Add an extra Henchman group": scheme-aware henchmen requirement (WP-796)

**WP:** WP-796 · **Reserves:** D-24666 · **Layer:** Registry + Game Engine + Server + App (registry-viewer) +
gauntlet tooling

Authoritative execution contract for WP-796. Subordinate to ARCHITECTURE.md and `.claude/rules/*`. If this EC and
WP-796 disagree, WP-796 wins. Compliance is binary.

## Before Starting

- [ ] Target file set = WP-796 §Files Expected to Change exactly; touching any other file is STOP.
- [ ] The WP-796 / EC-833 / D-24666 reservation is present on `origin/main`, and `pnpm ledger:numbers:check`
      exits 0.
- [ ] `origin/main` clean and synced. WP-524 / D-24337, WP-525 / D-24338, WP-576 / D-24385 and WP-472 / D-24283
      are on main.
- [ ] `pnpm -r build` exits 0. Record the per-package `pnpm -r --no-bail test` before-counts.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0.
- [ ] `pnpm gauntlet:configs:check` and `pnpm gauntlet:loadouts:check` exit 0 on the untouched tree.
- [ ] The four NZPB legs in `data/gauntlet-configs.json` still carry the 2-entry pools named in WP-796 §Assumes,
      and the sentinel fixture still plays `core/legacy-virus-the`. If either differs, STOP and report.

## Locked Values

- The list, in this order, ONLY in `packages/registry/src/playerCountSetup.ts`:
  `SCHEMES_WITH_EXTRA_HENCHMAN_GROUP = ['core/negative-zone-prison-breakout', 'msp1/asgard-under-siege',
  'vnom/invasion-of-the-venom-symbiotes']`.
- `resolveEffectiveHenchmenCount(schemeId: string, numPlayers: number, baseHenchmenCount: number): number`
  returns `base + 1` for a listed id, else `base`.
- `checkPlayerCountComposition`'s henchmen check uses
  `resolveEffectiveHenchmenCount(input.schemeId ?? '', input.playerCount, row.henchmenGroupCount)`.
- `CardRegistry.resolveEffectiveHenchmenCount` is REQUIRED (both impls).
  `CardRegistryReader.resolveEffectiveHenchmenCount?` is OPTIONAL. The engine reads
  `registry.resolveEffectiveHenchmenCount?.(schemeId, numPlayers, row.henchmenGroupCount) ?? row.henchmenGroupCount`.
- The server `projectSetupRequirements` sets `henchmenGroupCount` through the resolver beside `heroCount`. An
  empty `schemeId` returns `PLAYER_COUNT_SETUP` unchanged.
- The viewer's `requiredPlayerCountSetup` and `resolveSetupRequirement` set `henchmenGroupCount` through the
  resolver.
- `data/gauntlet-configs.json`: `"core/sentinel"` is appended as the third `henchmanPool` entry of the four 2026
  Core NZPB legs only.
- `getGauntletConfig`:
  - authored leg → `henchmanPool.slice(0, resolveEffectiveHenchmenCount(\`${setAbbr}/${schemeSlug}\`, playerCount,
    setupRow.henchmenGroupCount))`;
  - else the menu's `schemeOverrides?.[schemeSlug]?.[playerCount]`;
  - else `undefined`.
- `validateGauntletConfigs` rejects a leg whose pool is shorter than
  `resolveEffectiveHenchmenCount(\`${setAbbr}/${schemeSlug}\`, 5, PLAYER_COUNT_SETUP[5].henchmenGroupCount)`.
- `getGauntletConfig` reads the menu through `getGauntletLoadoutMenu` from `./gauntletLoadouts.js`.
- `GauntletLoadoutMenu.schemeOverrides?` is keyed by scheme slug, with a `compositionsByPlayerCount` value. It is
  emitted for every mastermind whose own set has a listed scheme, Core included. The Core ones are unused data,
  because the authored NZPB legs win.
- Generator overrides: henchmen = a superset of base with exactly one more id (the D-24199 fill order; output is
  sorted), villains = base. Throw `GenerationError` otherwise, or on a duplicate slug.
- Expected overrides (STOP if the generated output differs):
  - msp1: `msp1/hammer-drone-army`, `msp1/hydra-pilots` (+ `msp1/hydra-spies` at 4–5p);
  - vnom: `co2e/doombot-legion`, `co2e/hand-ninjas` (+ `co2e/savage-land-mutates`);
  - core: `core/doombot-legion`, `core/hand-ninjas` (+ `core/savage-land-mutates`).
- Drift pin, output-derived: the sorted union of `${setAbbr}/${schemeSlug}` over every menu's `schemeOverrides`
  keys deep-equals `SCHEMES_WITH_EXTRA_HENCHMAN_GROUP`. No test imports the generator (it runs `main()` on
  import).
- `data/gauntlet-configs.json` `slicing.note` is updated to say the henchmen slice uses the scheme-effective
  count.

## Guardrails

1. One definition. No production file other than `playerCountSetup.ts` (and the drift-pinned generator copy)
   encodes the extra-Henchman rule (the list or the `+ 1`). Tests and data may name the scheme ids.
2. Requirement side only. No `schemeSetupSizing` transform. `PLAYER_COUNT_SETUP` is never mutated.
3. Unlisted schemes are byte-identical everywhere: table, projection, menus and `getGauntletConfig`.
4. The gauntlet change flows through `getGauntletConfig` only. A code edit to `server.mjs`, `gauntlet.logic.ts`,
   `gauntletRunProgress.logic.ts`, `legends.publisher.ts`, `loadoutGauntletPackImport.ts`,
   `gauntletQualificationCheck.ts` or `LoadoutBuilder.vue` is STOP-and-report. Their stale "`undefined` for
   non-Core" comments (and the "N authored legs" startup log) are a known follow-up: do not edit them and do not
   stop over them.
5. Generated modules are regenerated by `pnpm gauntlet:configs` / `pnpm gauntlet:loadouts`, never hand-edited.
6. No arena-client file, no `G` field and no `MatchSetupConfig` field changes.
7. Existing tests change only as mandated: `gauntletConfigs.test.ts` :108–142, the one failure the pre-flight
   scaffold observed. `loadoutGauntletPackImport.test.ts` does not break; do not edit it. Anything else is
   STOP-and-report.
8. Sentinel `finalStateHash` / `PRE_WP080_HASH` unchanged. Never re-pin.

## Required Comments (`// why:`)

- The resolver: printed "Add an extra Henchman group", a requirement increase like D-24337 (not a build-side
  downsize).
- The engine `?.` / `??` fallback: a table-only mock keeps the base count, and production registries always carry
  the resolver.
- `getGauntletConfig` override branch: menu-fallback legs get a scheme-aware composition without new seed-PAR
  scenarios.
- The generator's duplicated list (runs before any build; drift-pinned) and the duplicate-slug guard (bare-slug
  Henchman card ids).
- The `core/sentinel` pool entry: makes 4–5p (3 groups) satisfiable.
- `gauntletConfigs.ts`: rewrite the module header (:26–31), the import list (:39–41) and the `getGauntletConfig`
  JSDoc (:262–276) to describe the override branch (mandatory).

## Files to Produce

Exactly the WP-796 §Files Expected to Change allowlist. The two generated modules change only through their
scripts.

## After Completing

- Revert proofs 6/6: the resolver's +1, the engine check, the server projection, `getGauntletConfig`'s effective
  slice, the viewer's `henchmenGroupCount` override, and the `schemeOverrides` branch.
- `pnpm -r build`; `pnpm -r --no-bail test` 0 failures (before/after counts per package);
  `pnpm --filter registry-viewer typecheck` 0.
- `pnpm gauntlet:configs:check` and `pnpm gauntlet:loadouts:check` 0. Replay fixtures byte-identical.
- `docs/ai/REFERENCE/api-endpoints.md` setup-requirements row replaced whole (D-11804).
- Live-on-surface verification (D-24026), after deploy: loadout builder 2 groups at 1p NZPB; a 1p NZPB match with
  20 Henchman cards; a Core NZPB and an msp1 Asgard Under Siege "Play this leg" with the extra group; the lobby
  shows 2 for 1p NZPB. The setup-requirements response is cached
  for up to an hour (`max-age=3600`), so hard-refresh the lobby. Record the matchId in STATUS.md.
- `docs/ai/STATUS.md` updated; `docs/ai/DECISIONS.md` D-24666 → Active (the six points).
- WORK_INDEX WP-796 `[x]` with date; EC_INDEX EC-833 → Done; mindmap 📝 → ✅, then `pnpm roadmap:counts:write`
  and `pnpm roadmap:counts:check` exit 0.

## Common Failure Smells

- A Core NZPB leg returns 2 groups at 4p: the pool was not extended, or the slice used the base count.
- `gauntletConfigs.test.ts` freshness deep-equal fails: the JSON was edited without `pnpm gauntlet:configs`.
- An override composition carries `core/doombot-legion` + `co2e/doombot-legion`: the duplicate-slug guard is
  missing (colliding `henchman-doombot-legion-NN` card ids).
- The lobby still says 1 for NZPB: the server projection row was not updated (the client is projection-driven).
- A Midtown menu entry or projection row changed: the override leaked to an unlisted scheme.
