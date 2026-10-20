# EC-853 — Abomination fight cost (Execution Checklist)

**Source:** docs/ai/work-packets/WP-815-abomination-fight-cost.md
**Layer:** Game Engine

## Before Starting
- [ ] `resolveFightCost` still sums base + Dark Portal + Bystander + Blood Frenzy before the reduction and 0 floor; `resolveMastermindFightCost` still sums base + portal − reduction with a 0 floor.
- [ ] The production callers in WP Assumes 2 still read only these two resolvers. None of them is edited.
- [ ] `offPlayCardStats` (`hero/splitCard.logic.ts`) still totals a Divided card's two halves, and has only type-only imports.
- [ ] `CITY_SPACE_NAMES` is still Sewers(0) … Bridge(4); `useCityRow.ts` still renders `cityIndex = 4 - visualIndex` and `useHqRow.ts` renders HQ index = visual column.
- [ ] `buildMastermindState` still runs after `buildVillainBloodFrenzy` in `buildInitialGameState.ts`, and its `baseCardId` template is unchanged.
- [ ] `pnpm -r build` → 0 and the suites are green. Record the engine test total.

## Locked Values (do not re-derive)
- `type AbominationKind = 'abomination' | 'double-abomination' | 'ultimate-abomination' | 'double-highest-abomination'`; `ABOMINATION_KINDS` in that order; both in `economy/abomination.logic.ts`.
- `G.cardAbomination?: Record<CardExtId, AbominationKind>`; spread onto `G` only when non-empty.
- `hqSlotIndexUnderCitySpace(cityIndex)` = `(CITY_SPACE_NAMES.length - 1) - cityIndex` for an integer in `0..4`, else `undefined`.
- Printed Attack = `offPlayCardStats(G, heroId)?.attack ?? 0`.
- Villain term: `cityIndex = G.city?.indexOf(id) ?? -1`; `hqIndex = hqSlotIndexUnderCitySpace(cityIndex)`; `abomination` → printed Attack of `G.hq?.[hqIndex]`; `double-abomination` → twice that; not in the City, `undefined` index, empty slot or any other kind → 0.
- Mastermind term, keyed by `G.mastermind.baseCardId`: `ultimate-abomination` → sum over non-null HQ slots; `double-highest-abomination` → 2 × the highest (0 if empty); any other kind → 0.
- Builder `buildCardAbomination(registry: unknown, villainConfig: MatchSetupConfig, mastermindId: string, mastermindBaseCardId: CardExtId)`. Call exactly `buildCardAbomination(registry as unknown, villainBuildConfig, config.mastermindId, mastermindState.baseCardId)` after `buildMastermindState` (`villainBuildConfig` carries the scheme-effective groups, the Blood Frenzy precedent).
- Setup-test mocks copy ability lines verbatim from `data/cards/{ca75,rlmk,co2e}.json` and include the negatives: Primus, Maestro, The Leader, Zzzax, the tactics, and `epic-maximus-the-mad` (no key).
- Villain patterns, first match wins: `/\[keyword:\s*double abomination\s*\]/i` → `double-abomination`; `/\[keyword:\s*abomination\s*\]/i` → `abomination`; `/^[^:]*gets \+\[icon:attack\] equal to the printed \[icon:attack\] of the Hero in the HQ space under (?:his|her|its) current city space\.?$/i` → `abomination`.
- Mastermind patterns (on the non-tactic card whose id equals `mastermindBaseCardId`): `/\[keyword:\s*ultimate abomination\s*\]/i`, `/\[keyword:\s*double highest abomination\s*\]/i`.
- Expected keys: ca75 Zola setup = 7; rlmk Inhuman Rebellion + Maximus = 9; co2e Radiation + `co2e/doctor-doom` = 2 (abomination `-00` / `-01` only).

## Guardrails
- The villain term lives ONLY in `resolveFightCost` and the mastermind term ONLY in `resolveMastermindFightCost`, each added before the reduction. No caller edit.
- Read the City index and HQ slot at call time; never cache a cost in `G`.
- Never count granted or temporary Attack, only printed.
- Villain and mastermind kinds never cross: each function returns 0 for the other family's kinds.
- Omit-when-empty: a core match has no `cardAbomination` key and both hash oracles stay byte-identical. If one moves, STOP and explain before any re-pin.
- The rlmk Xerogen scheme grant and the client HQ alignment are out of scope.
- No card-data edit, no `[effect:X]` marker, no `subsystem-coverage.json` entry, no `BoardKeyword` change.
- No `.reduce()`, no nested ternaries; explicit `if` blocks. Nothing throws.

## Required `// why:` Comments
- `hqSlotIndexUnderCitySpace`: on the physical board the City reads Bridge … Sewers left to right above HQ slots 0 … 4, so the space under City index `i` is HQ index `4 - i`. The binding is ordinal, not on-screen alignment (D-24747, D-24295).
- The villain term: rules v23 L880-926, read at fight time because the cost moves with the City and the HQ.
- `offPlayCardStats`: "printed" Attack drops the trailing `+`, and a Divided card adds both halves (rules v23 Divided Cards).
- The mastermind lookup matches `baseCardId` by equality so it can never key a different face than `buildMastermindState` chose (D-24193).
- The co2e sentence pattern: that card prints the rule in words with no keyword token; matching it avoids a data edit that would render a duplicate keyword chip.
- The conditional spread: hash stability (the `villainBloodFrenzy` precedent).

## Files to Produce
- `packages/game-engine/src/economy/abomination.logic.ts` + test — **new**
- `packages/game-engine/src/setup/buildCardAbomination.ts` + test — **new**
- `packages/game-engine/src/board/citySpaceNames.ts` + test — **modified**
- `packages/game-engine/src/types.ts` — **modified**
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** (wiring)
- `packages/game-engine/src/economy/economy.resolve.ts` + test — **modified**
- `packages/game-engine/src/moves/fightVillain.test.ts`, `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** (additions only)
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] T1-T21 pass. `pnpm -r build` → 0. `pnpm -r --no-bail test` → 0 fail.
- [ ] `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `cards:check` → 0 with no diff. `sim:runtime-observed:check`, `sim:coverage --check` → 0 with no regeneration; if either flags, STOP (WP Assumes 8 is false).
- [ ] Revert proofs observed: drop each term, and the `4 -`; each fails a T-case.
- [ ] `finalStateHash` and `PRE_WP080_HASH` unchanged.
- [ ] D-24747 Active. STATUS updated (with the client HQ-alignment follow-up recorded). WORK_INDEX `[x]`. EC_INDEX Done. Mindmap `✅` + `pnpm roadmap:counts:write`. `roadmap:counts:check` and `ledger:numbers:check` 0.
- [ ] Allowlist-only diff. Two-commit topology `EC-853:` then `SPEC:`.
- [ ] Live-verify (D-24026) post-deploy STATUS-flip.

## Common Failure Smells
- Abomination reads the wrong Hero (left/right mirrored) → `hq[cityIndex]` was used instead of `hq[4 - cityIndex]`. Judge by ordinal (Sewers ↔ 5th HQ slot): the client does not column-align the HQ under the City.
- The City tile and the fight gate disagree → the term went into a caller instead of the resolver.
- Arnim Zola's cost doesn't change after a recruit → the bonus was computed at setup and stored.
- A Divided Hero under an Abomination adds only one half → `G.cardStats` was read directly instead of `offPlayCardStats`.
- A core replay's hash moved → `cardAbomination` became always-present.
- A timing line (`Fight:` / `Ambush:`) gets flagged → the co2e sentence pattern lost its `^[^:]*` anchor.
