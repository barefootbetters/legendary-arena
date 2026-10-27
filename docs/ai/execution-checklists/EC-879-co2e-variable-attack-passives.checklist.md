# EC-879 — co2e variable-Attack passives (Execution Checklist)

**Source:** docs/ai/work-packets/WP-841-co2e-variable-attack-passives.md
**Layer:** Game Engine (+ card-data marker overlay)

## Before Starting
- [ ] Scope lock: only the Files to Produce list below changes.
- [ ] WP-841 Assumes 1-14 hold on the execution baseline; re-read the line anchors in Assumes 2, 4 and 6.
- [ ] If WP-838 executed first: keep its `attackPerCaptured` list, `buildVillainAttackPerCaptured`, `villainAttackPerCaptured?` field + spread, its dynamic-branch early return and its `villainCapturedCountBonus` term (both terms before the reduction; order irrelevant); this packet's early return becomes one `||` condition beside it, and the overlay's start banner, final line and header doc-comment keep its `[attack-per-captured:]` entries before the new ones (four markers named).
- [ ] If WP-835 / WP-838 marked the four cards' `Fight:` lines first, those markers sit on other lines: the locator still finds exactly one passive line per card.
- [ ] `pnpm -r build` → 0; record the game-engine test total.

## Locked Values (do not re-derive)
- `economy/villainVariableAttack.logic.ts` exports `VillainVariableAttackSource = 'flat' | 'per-other-hydra-villain' | 'per-hq-hero-class'`, `VILLAIN_VARIABLE_ATTACK_SOURCES` in that order, `export interface VillainVariableAttack { source: VillainVariableAttackSource; attackPerUnit: number; requireCitySpaces?: CitySpaceName[]; }`, `isHydraVillainCard`, `countOtherHydraVillains`, `countHqHeroClasses`, `villainVariableAttackBonus`.
- HYDRA Villain: no `convertedVillainOrigins` entry, `villainDeckCardTypes` `'villain' | 'henchman'`, `cardId.toLowerCase().includes('hydra')`. Count non-null `G.city` then `G.escapedPile`, excluding the fought id.
- Membership tests (`HERO_CLASSES`, the sources array, `CITY_SPACE_NAMES`) are `for…of` equality loops, never `.includes()` with a cast. The setup file value-imports `VILLAIN_VARIABLE_ATTACK_SOURCES` and `CITY_SPACE_NAMES`.
- Hero Classes: distinct `HERO_CLASSES` members among `heroClass` / `heroClass2` of `offPlayCardTraits` over non-null `G.hq` slots.
- Term: no entry → 0; a gate → `citySpaceNameForIndex(G.city?.indexOf(id) ?? -1)` must be in `requireCitySpaces` else 0; then `flat` → N, per-count → N × count.
- Marker `[variable-attack:<source>:<N>[@<space>[+<space>…]]]`: ≤ 1 `@`; left side exactly `<source>:<N>`; `N` `^[1-9][0-9]*$`; spaces in `CITY_SPACE_NAMES`, non-empty, no repeats; `flat` requires a gate; else null. First valid marker on any line wins.
- `parseVariableAttackLine(abilityLine)` / `buildVillainVariableAttack(registry: unknown, matchConfig)` in `setup/villainDefeatRequirement.setup.ts`; fresh object + fresh `requireCitySpaces` per copy id; an ungated entry omits `requireCitySpaces` (never `undefined`, `exactOptionalPropertyTypes`).
- `types.ts` `villainVariableAttack?: Record<CardExtId, VillainVariableAttack>` beside `villainFightDiscardCosts`. Wiring beside `buildVillainFightDiscardCosts` with `villainBuildConfig`; spread only when non-empty.
- `resolveFightCost`: `+ villainVariableAttackBonus(G, villainCardId)` last in `costBeforeReduction`. Dynamic branch: entry present → `return base;` before the captured-Hero sum.
- Overlay list `variableAttack` `{ set, group, card, source, attackPerUnit, spaces? }`; locator = the single line containing ` gets +` and `[icon:attack]` (lower-cased); appends exactly `` ` [variable-attack:${source}:${attackPerUnit}${spaces ? '@' + spaces.join('+') : ''}]` `` (the gate sits inside the brackets: ` [variable-attack:flat:2@sewers+bridge]`); start banner `🏷  Overlaying [require-to-defeat:], [discard-to-fight:] and [variable-attack:] markers onto curated villain restriction lines...`; header doc-comment gains a `variableAttack` paragraph; final line `` `\nDone. ${S} set(s) processed, ${R} new [require-to-defeat:] marker(s), ${F} new [discard-to-fight:] marker(s) and ${V} new [variable-attack:] marker(s) appended.` ``.
- Map rows: Strucker `per-other-hydra-villain` 1; Paibok and Super-Skrull `per-hq-hero-class` 1; Hydro-Man `flat` 2 `["sewers", "bridge"]` (group slugs `hydra`, `skulls`, `skulls`, `sinister-syndicate`).

## Guardrails
- One authority: only `resolveFightCost` reads the table; no caller file changes; the Mastermind cost is untouched.
- Read at fight time; never cache a count in `G`.
- Markers only; no engine code reads English; never run `convert-cards-v15.mjs`.
- Omit-when-empty: no new `G` key for a match without the four cards; hash oracles unchanged (STOP if one moves).
- The existing builders are not refactored; the space parser is a local copy.
- No `[effect:]` marker, no ledger / feed / `subsystem-coverage.json` change.

## Required `// why:` Comments
- The term in `costBeforeReduction`: printed passive read at fight time, before the reduction (WP-841 / D-24774).
- The dynamic-branch early return: the `+` is the printed passive, not a captured-Hero cost (F2).
- `isHydraVillainCard`: name / Villain Group reading (F1, D-24493 precedent); slugs derive from names; converted cards have no Villain Group (rules v23 L1146-1148).
- `countOtherHydraVillains`: "other" excludes only the fought copy; the second Strucker counts.
- `countHqHeroClasses`: grey cards have no Class (rules v23 L2742-2752); Divided / dual-class count both.
- The gate in the term: fails closed outside the City and on an unnamed sixth space (D-24764).
- The local space parser: second copy of `parseCityGateSuffix`, abstract at the third.
- The `types.ts` field and the spread: omit-when-empty hash stability.
- The `HERO_CLASSES` import: its first runtime consumer outside author-facing validation (D-3303).

## Files to Produce
- Engine **new**: `economy/villainVariableAttack.logic.ts` + `.test.ts`
- Engine **modified**: `setup/villainDefeatRequirement.setup.ts` + test, `setup/buildInitialGameState.ts`, `setup/buildInitialGameState.shape.test.ts`, `types.ts`, `economy/economy.resolve.ts` + test, `moves/fightVillain.test.ts`, `ui/uiState.build.test.ts`
- Scripts **modified**: `scripts/convert-cards/apply-defeat-requirement-markers.mjs`, `scripts/convert-cards/inputs/villain-defeat-requirements.json` (+ one `_doc` sentence)
- Data **regenerated**: `data/cards/co2e.json` (4 lines)
- Governance close: `docs/ai/post-mortems/01.6-WP-841-co2e-variable-attack-passives.md` (**new**, mandatory: new setup builder + `G` field), `DECISIONS.md`, `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

## After Completing
- [ ] T1-T17 + T15b pass (T8: three `-2` Sewers reductions → 0; T14 mocks carry `copies: 2`; T15b proves the wiring). `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail.
- [ ] Overlay: `--propose` shows 4 rows; apply → 4 new `[variable-attack:]`; re-run → 0; `git diff data/cards/` = `co2e.json`, 4 lines. Six hand-checked loud-fails (incl. two locator lines on `2099/alchemax-enforcers/whackoid`, zero on `co2e/hydra/viper`) recorded in the commit body.
- [ ] `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `cards:check`, `sim:runtime-observed:check`, `sim:coverage --check` → 0, nothing regenerated.
- [ ] Seven revert proofs observed (term; early return; self-exclusion; `heroClass2`; gate; term after `Math.max` fails T8; spread dropped fails T15b).
- [ ] Hash oracles unchanged. Allowlist-only diff. Two-commit topology `EC-879:` then `SPEC:`.
- [ ] 01.6 post-mortem written. D-24774 Active (incl. the table divergence, fold path and third-copy walk); STATUS (+ F3 and fold follow-ups); WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0.
- [ ] Live-verify (D-24026) on a match created after the deploy; operator-pending until seen.

## Common Failure Smells
- A live match shows the flat base → the overlay row was not applied (`[variable-attack:]` missing from `co2e.json`) or the builder is not wired / spread.
- Strucker's cost is 1 higher than expected → the fought copy counted itself.
- Hydro-Man costs 6 in the Bank → the gate check is missing or reads the space by HQ, not City, index.
- Paibok counts 6 classes → `'grey'` or a non-class string slipped past the `HERO_CLASSES` filter.
- A sentinel hash moved → a `villainVariableAttack` key was written for a match without the four cards.
- The overlay reports 2 matching lines → the locator widened past ` gets +` + `[icon:attack]`.
