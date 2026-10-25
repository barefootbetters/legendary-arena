# EC-871 — "Add an extra Villain Group": scheme-aware Villain Group requirement (Execution Checklist)

**Source:** docs/ai/work-packets/WP-833-extra-villain-group.md
**Layer:** Registry + Game Engine + Server + App (registry-viewer) + gauntlet tooling

Authoritative execution contract for WP-833. Subordinate to ARCHITECTURE.md and `.claude/rules/*`. If this EC and
WP-833 disagree, WP-833 wins. Compliance is binary.

## Before Starting
- [ ] Target file set = WP-833 §Files Expected to Change exactly; any other file is STOP.
- [ ] The WP-833 / EC-871 / D-24766 reservation is on `origin/main` (#3002); `pnpm ledger:numbers:check` exits 0.
- [ ] WP-796 / D-24666 is on main: `SCHEMES_WITH_EXTRA_HENCHMAN_GROUP`, `resolveEffectiveHenchmenCount` and the
      generator's `schemeOverrides` exist; no `SCHEMES_WITH_EXTRA_VILLAIN_GROUP` exists yet.
- [ ] `data/gauntlet-configs.json` has no leg for a listed scheme (Core only), and the sentinel fixture plays
      `core/legacy-virus-the`. If either differs, STOP.
- [ ] `pnpm -r build` 0; record per-package `pnpm -r --no-bail test` counts; registry-viewer typecheck 0; both gauntlet
      `:check` scripts 0 on the untouched tree.

## Locked Values (do not re-derive)
- `SCHEMES_WITH_EXTRA_VILLAIN_GROUP` ONLY in `packages/registry/src/playerCountSetup.ts`, in this order:
  `ca75/change-the-outcome-of-wwii`, `co2e/bank-robbery-hostage-crisis`, `co2e/negative-zone-prison-outbreak`,
  `cvwr/predict-future-crime`, `dkcy/steal-the-weaponized-plutonium`, `dstr/war-for-the-dream-dimension`,
  `dstr/cursed-pages-of-the-darkhold-tome`, `mgtg/inescapable-kyln-space-prison`,
  `mgtg/provoke-the-sovereign-war-fleet`, `nmut/superhuman-baseball-game`, `rvlt/earthquake-drains-the-ocean`,
  `ssw1/fragmented-realities`, `ssw1/smash-two-dimensions-together`, `ssw2/deadlands-hordes-charge-the-wall`.
- `resolveEffectiveVillainGroupCount(schemeId: string, numPlayers: number, baseVillainGroupCount: number): number` →
  `base + 1` for a listed id, else `base`. `checkPlayerCountComposition` uses it with `input.schemeId ?? ''`.
- `CardRegistry.resolveEffectiveVillainGroupCount` REQUIRED (both impls); `CardRegistryReader.resolveEffectiveVillainGroupCount?`
  OPTIONAL; engine reads `registry.resolveEffectiveVillainGroupCount?.(schemeId, numPlayers, row.villainGroupCount) ??
  row.villainGroupCount`; error text is the existing `checkCompositionCount` sentence.
- Server `projectSetupRequirements` and the viewer's `requiredPlayerCountSetup` / `resolveSetupRequirement` set
  `villainGroupCount` through the resolver; empty `schemeId` returns `PLAYER_COUNT_SETUP` unchanged.
- `getGauntletConfig` authored slice: `villainPool.slice(0, resolveEffectiveVillainGroupCount(\`${setAbbr}/${schemeSlug}\`,
  playerCount, setupRow.villainGroupCount))`; `validateGauntletConfigs` rejects a `villainPool` shorter than
  `resolveEffectiveVillainGroupCount(id, 5, PLAYER_COUNT_SETUP[5].villainGroupCount)` with a full sentence naming set,
  mastermind and scheme ("… requires N Villain Groups at 5 players …").
- API catalog row `GET /api/match/setup-requirements` replaced whole: Status `Wired`, `GET`, Auth `guest`, Path and
  schemas unchanged; Authorizing WP appends `WP-833 / D-24766 (scheme-aware villainGroupCount)`; Notes add the
  `villainGroupCount` projection (the 14 `SCHEMES_WITH_EXTRA_VILLAIN_GROUP` schemes require base + 1).
- `data/gauntlet-configs.json` `slicing.note` gains one sentence (the villain slice is scheme-effective; no authored leg
  uses such a scheme); the `GauntletLoadoutMenu.schemeOverrides` doc names both rules.
- Generator: a drift-pinned copy of the list; `buildSchemeOverrides(set, mastermindSlug, baseVariant, villainPools,
  henchmanPools)` refills only the extended slot(s) for base + 1; `GenerationError` unless each slot equals base or is a
  superset with exactly one more id, or on a duplicate slug.
- Expected WWII override (both ca75 masterminds; STOP if different): 1p `ca75/masters-of-evil-wwii`,
  `ca75/zolas-creations`; 5p + `co2e/brotherhood-of-mutants`, `co2e/enemies-of-asgard`, `co2e/hydra`; henchmen = base.
- Mandated existing-test edits (exactly four): `gauntletLoadouts.test.ts` Henchman drift pin (count overrides whose
  henchmen grow), override-shape test (both slots), presence test (either list); `gauntletConfigs.test.ts`
  unlisted-legs sweep (skip both lists). Commit trailer `Tests-changed:` names them.

## Guardrails
1. One definition: no production file but `playerCountSetup.ts` (and the drift-pinned generator copy) encodes the list or
   the `+ 1`.
2. Requirement side only: no `schemeSetupSizing` transform; `PLAYER_COUNT_SETUP` never mutated.
3. Unlisted schemes byte-identical everywhere (table, projection, menus, `getGauntletConfig`).
4. Gauntlet change flows through `getGauntletConfig` only; a code edit to `server.mjs`, `gauntlet.logic.ts`,
   `gauntletRunProgress.logic.ts`, `legends.publisher.ts`, `loadoutGauntletPackImport.ts`,
   `gauntletQualificationCheck.ts` or `LoadoutBuilder.vue` is STOP.
5. Generated modules only via `pnpm gauntlet:loadouts` / `pnpm gauntlet:configs`; the menu diff is additive.
6. No arena-client file, no `G` field, no `MatchSetupConfig` field.
7. Existing tests change only as mandated; any other failure is STOP-and-report.
8. Sentinel `finalStateHash` / `PRE_WP080_HASH` unchanged; never re-pin.

## Required `// why:` Comments
- The resolver (printed "Add an extra Villain Group", a requirement increase like D-24666) and the
  `checkPlayerCountComposition` call.
- The engine `?.` / `??` fallback (table-only mock keeps base; production registries carry the resolver).
- Both registry impls' attachment; the generator's duplicated list (runs before any build; drift-pinned).
- `gauntletConfigs.ts`: the villain-slice module note (no authored leg uses a listed scheme today) and the pool check.
- The mandated test edits (why each now accounts for the villain list).

## Files to Produce
Exactly the WP-833 §Files Expected to Change allowlist (governance: STATUS, DECISIONS, WORK_INDEX, EC_INDEX,
`docs/05-ROADMAP-MINDMAP.md`); the two generated modules change only through their scripts.

## After Completing
- [ ] Revert proofs 6/6 (WP §Scope F), each restored.
- [ ] An independent subagent reviews the final diff against this EC before the `EC-871:` commit; verdict in STATUS.
- [ ] `pnpm -r build` 0; `pnpm -r --no-bail test` 0 fail with the locked counts: registry 295 → 310, game-engine
      5672 → 5676, server 1836 → 1838, registry-viewer 329 → 335, every other package unchanged; registry-viewer
      typecheck 0; both gauntlet `:check` 0 (56 additive `schemeOverrides`); replay fixtures byte-identical.
- [ ] `docs/ai/REFERENCE/api-endpoints.md` setup-requirements row replaced whole (D-11804).
- [ ] D-24766 Active (five points); STATUS updated; WORK_INDEX `[x]` with date; EC_INDEX Done; mindmap `✅`;
      `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check` 0. Allowlist-only diff (revert
      `lagn-v1.json` CRLF churn). Two commits: `EC-871:` then `SPEC:`.
- [ ] Live-verify (D-24026), operator-pending until seen: builder shows 2 Villain Groups for 1p WWII and exports; a 1p
      WWII match starts with both ca75 groups; a ca75 WWII "Play this leg" launches with 2 (the first live exercise of the menu-override path; a 400 is STOP); the lobby shows 2 after a
      hard refresh. matchId in STATUS.

## Common Failure Smells
- A ca75 WWII "Play this leg" returns 400 → the generator override is missing or the menu was not regenerated.
- A Midtown projection row or a non-listed menu entry changed → the override leaked to an unlisted scheme.
- The lobby still says 1 for WWII → the server projection was not updated (the client is projection-driven).
- The corpus-scan test fails after a card-data change → a new scheme prints the sentence: confirm it is unconditional
  before adding it to both lists; a player-count-conditional or named-group shape is out of scope (D-24766 §4) and the
  scan must exclude it.
