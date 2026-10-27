# EC-869 — A City of 1 to 6 spaces (Execution Checklist)

**Source:** docs/ai/work-packets/WP-831-variable-city-size.md
**Layer:** Game Engine (City type + helpers, shape check + invariant, fight / move-villain / operator escape, fight target, bot) plus arena-client (City and HQ rows)

## Before Starting
- [ ] `CityZone` is the 5-tuple in `board/city.types.ts`; `validateCityShape` and `checkCitySize` reject any length but 5; `fightVillain` rejects `cityIndex > 4`; `isGuardBlocking` loops to 4; `OPERATOR_ESCAPE_CITY_INDEX = 4`.
- [ ] `useCityRow` names cells by visual position; `HQRow` has one leading spacer; `MoveVillainChoicePrompt` lists `[4, 3, 2, 1, 0]`; `hasEscapeCandidate` reads `spaces[4]`.
- [ ] The drafting scaffold patch is evidence only; re-author from Locked Values and the Test Contract.
- [ ] Scope lock: the target set is exactly §Files to Produce; any other file is a blocker.
- [ ] Rebuild first. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → 0; record the engine and client totals.

## Locked Values (do not re-derive)
- **Type** (`board/city.types.ts`): `export type CityZone = CitySpace[];`; `CITY_DEFAULT_SIZE = 5`, `CITY_MIN_SIZE = 1`, `CITY_MAX_SIZE = 6` (exported). `HqZone` unchanged.
- **`initializeCity(size = CITY_DEFAULT_SIZE)`**: `size` nulls.
- **`pushVillainIntoCity`**: copy `[...city]`; with no empty space, `escapedCard = city[length - 1]` and shift every space up by one from the last index down; otherwise unchanged.
- **`validateCityShape`**: `INVALID_CITY_LENGTH` when the length is outside `CITY_MIN_SIZE..CITY_MAX_SIZE`, with the message `G.city must have between 1 and 6 spaces, but has ${length}.`; the per-space check loops `city.length`.
- **`checkCitySize`**: asserts `CITY_MIN_SIZE <= length <= CITY_MAX_SIZE`, with the message naming the range, the found length and where to look.
- **`fightVillain`**: rejects `cityIndex >= G.city.length`. Its fight target is `citySpaceNameForIndex(cityIndex) ?? UNNAMED_CITY_SPACE_TARGET`; the old silent return for a nameless index is removed (the index guard proves the space exists).
- **`AttackTargetName`**: gains `typeof UNNAMED_CITY_SPACE_TARGET`, with `UNNAMED_CITY_SPACE_TARGET = 'unnamed-city-space'` (`economy/economy.types.ts`); `ATTACK_TARGET_LABELS['unnamed-city-space'] = 'an unnamed City space'`.
- **`isGuardBlocking`**: loops `index < city.length`.
- **`resolveMoveVillainChoice` existence**: returns silently when `fromCityIndex` or `toCityIndex` is `>= G.city.length` (before the name lookups).
- **Bot**: `selectDefaultMoveVillainArgs` declines when `city.length < 2`.
- **Bot fights**: `getLegalMoves` takes the fight target as `citySpaceNameForIndex(cityIndex) ?? UNNAMED_CITY_SPACE_TARGET` (no skip for a nameless index), mirroring the move (D-24364).
- **`resolveMoveVillainChoice`**: `isCityIndex` accepts `0..CITY_MAX_SIZE - 1` (existence is the `G.city.length` check); an unnamed space is labelled `formatAttackTargets([name ?? UNNAMED_CITY_SPACE_TARGET])` ("an unnamed City space") instead of refused.
- **Stage width**: `extraCityColumns(citySize) = max(0, citySize - 5)` (exported from `useCityRow.ts`) drives both the HQ spacers and `PlayDesktop.vue`'s stage: `--play-extra-city-columns` on the stage style, `width: calc(var(--play-authoring-width) + var(--play-extra-city-columns, 0) * (var(--board-space-column-width) + 0.25rem))`, so the stage ResizeObserver refits and the board scales down rather than the City / HQ rows overflowing apart.
- **Labels**: the move-villain prompt numbers an unnamed space from 1 (`Space ${cityIndex + 1}`), as on the board.
- **`operatorEscapeVillain`**: the escape edge is `G.city.length - 1`; `OPERATOR_ESCAPE_CITY_INDEX` is removed.
- **`modifyCitySize` setup instruction**: still a logged no-op. Its comment says D-24764 made the City resizable but no scheme prints a setup-time size; its message reads `Scheme setup instruction "modifyCitySize" is not yet supported (no scheme sets the City size at setup) — skipped`.
- **Client:**
  - `useCityRow`: cell kind `{ kind: 'gone'; cityIndex; slotName }`. Names come from `SLOT_NAMES_BY_ENGINE_INDEX = ['Sewers', 'Bank', 'Rooftops', 'Streets', 'Bridge']`, or `Space ${index + 1}` past them. It renders `max(spaces.length, 5)` space columns, highest engine index first; an index `>= spaces.length` is a `gone` cell.
  - `CityRow.vue` renders `gone` as a hatched space-column box (`data-testid="play-city-gone"`, title `The ${slotName} is not part of the City right now.`).
  - `HQRow.vue`: prop `extraCitySpaces` (default 0), rendering that many blank space-column cells (`play-hq-extra-spacer`) after the edge spacer when column-aligned. Both pages pass `extraCityColumns(snapshot.city.spaces.length)`.
  - `MoveVillainChoicePrompt.vue`: `visualOrderEngineIndices(props.city.spaces.length)`.
  - `hasEscapeCandidate` reads the last space.

## Guardrails
- Byte-identical at five spaces: no existing assertion edited (the one malformed-City fixture change is WP AC 2); hash oracles unchanged, else STOP.
- The HQ stays a 5-tuple; no code path resizes the City in this packet.
- `CityZone` and `AttackTargetName` are contract changes, recorded in D-24764.
- Regenerate only what a `:check` reports stale after a rebuild.

## Required `// why:` Comments
- The array type and the size bounds (WP-831 / D-24764; D-2602 superseded).
- The escape edge as the last space (`pushVillainIntoCity`, the operator escape); the Guard reach; the fight index guard; the move-villain existence check; the 1-space bot decline.
- The unnamed fight target (no grant names it, so plain Attack only).
- The `modifyCitySize` setup instruction staying unwired.
- Client: names by engine index; gone cells keep their columns; the HQ extra spacer.

## Files to Produce
- `packages/game-engine/src/board/citySize.test.ts` — **new** (V1-V9, V5b)
- `packages/game-engine/src/board/city.types.ts`, `board/city.logic.ts`, `board/city.validate.ts`, `invariants/structural.checks.ts`, `board/boardKeywords.logic.ts`, `moves/fightVillain.ts`, `moves/moveVillainChoice.resolve.ts`, `moves/operatorSetters.ts`, `economy/economy.types.ts`, `economy/economy.logic.ts`, `simulation/ai.legalMoves.ts`, `scheme/schemeSetup.execute.ts`, `ui/uiState.types.ts`, `villainDeck/villainDeck.city.integration.test.ts` — **modified**
- `apps/arena-client/src/composables/useCityRow.ts` + test, `components/play/CityRow.vue` + test, `components/play/HQRow.vue` + test, `components/play/MoveVillainChoicePrompt.vue` + test, `lib/operatorSetterIntents.ts` + test, `pages/PlayDesktop.vue`, `pages/PlayMobile.vue` — **modified**
- `docs/ai/ARCHITECTURE.md` (the `G.city` row + the `modifyCitySize` bullet), `docs/ai/DECISIONS.md` (D-24764 + the D-2602 note), `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-831-variable-city-size.md` — **modified / new** (governance close)

## After Completing
- [ ] V1-V9 (with V5b) and the client cases pass; engine and client deltas as in WP §Scaffold.
- [ ] Revert proofs as listed in WP AC 3, each restored.
- [ ] Every card / coverage `:check` → 0 after the rebuild; arena-client `typecheck` → 0; dashboard `test:coverage` / `typecheck` / `format:check` → 0.
- [ ] `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.
- [ ] D-24764 Active; D-2602 noted superseded; ARCHITECTURE.md rows updated; 01.6 post-mortem WP COMPLETE; STATUS updated; WORK_INDEX `[x]` with date; EC_INDEX Done; mindmap `✅` + `pnpm roadmap:counts:write`; `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check`, `workindex:executed:check` → 0.
- [ ] Allowlist-only diff (revert `lagn-v1.json` CRLF churn). Two-commit topology `EC-869:` then `SPEC:`.
- [ ] Live-verify (D-24026), operator-pending until seen: any match created after the deploy shows the unchanged 5-space board.

## Common Failure Smells
- Villains stop entering a resized City → `validateCityShape` still wants 5 (the reveal skips on failure).
- A Villain sits past the edge or escapes from the wrong space → a hard-coded index 4 remains.
- A sixth-space Villain cannot be fought (or the bot never fights it) → the move's or `getLegalMoves`' fight target still requires a name.
- Spinning Cyclone freezes on a sixth-space Villain → `isCityIndex` still stops at 4, or an unnamed space is refused.
- The City and HQ rows scroll apart with six spaces → the stage did not widen.
- The board labels a 3-space City "Bridge / Streets / Rooftops" → names by visual position.
- Hero 1 is not under the Bridge in a 6-space City → the HQ extra spacer is missing.
