# WP-831 — A City of 1 to 6 spaces: the variable City size foundation (Game Engine + client board)

**Status:** Draft 2026-10-24 — gates pending (EC-869; **D-24764** reserved (#2999)).
**Primary Layer:** Game Engine (`board/` City type + helpers, `invariants/`, `moves/` fight / move-villain / operator escape, `economy/` fight target, `simulation/` bot) plus arena-client (the City and HQ rows)
**Dependencies:** none open. Builds on WP-015 (the City zone and `pushVillainIntoCity`), WP-026 / D-2602 (which deferred City resizing "until `CityZone` is converted from a fixed tuple to a dynamic array" in "its own WP with architectural review" — this packet), WP-790 / D-24652 (fight targets by City space name), D-24747 (the HQ under the City, column-aligned on the board).
**User-Visible Surface:** `play.legendary-arena.com` — none at 5 spaces (every match today). It enables WP-832 (Change the Outcome of WWII).
**Lane:** Standard (two-session). It changes a locked contract file (`board/city.types.ts`: `CityZone` from a 5-tuple to an array), widens the City shape check and structural invariant, and adds an `AttackTargetName` member (D-24028).
**Arc:** Cap 75th completion, remaining item 9, part 1 of 2 (auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at the reserve commit #2999 (on top of `7861af2b`). The open exec PRs #2986 / #2989 / #2992 / #2995 / #2998 do not touch the City files; whichever lands later rebases, keeping both sides' index rows.

---

## Goal

Change the Outcome of WWII (WP-832) prints "The number of city spaces changes", from 1 space (Switzerland) to 6 (the USSR). The rulebook covers a changed City: "Start in the normal city… use the Scheme card to mark the new edge of the city"; "this doesn't affect the number of HQ spaces"; and for a removed space, "act as if that city space no longer exists" — its name no longer applies (rules v23, the WWII, Ego and Galactus notes).

Today the City cannot change size. `CityZone` is a fixed 5-tuple; the shape check and the structural invariant reject any other length; and a dozen sites hard-code index 4 or five spaces.

After this packet:
- the City holds 1-6 spaces, 5 by default;
- villains enter space 0 and escape off the City's LAST space;
- names stay attached to their engine index: 0 Sewers … 4 Bridge. A smaller City loses its far spaces, and a larger one adds unnamed spaces beyond the Bridge;
- the HQ stays five;
- the board renders a removed space as a hatched column and an extra space as a new leftmost column, with the HQ aligned under the same spaces.

At 5 spaces nothing changes: every existing test is the oracle.

## Scaffold (observed at drafting, REQUIRED evidence)

A working implementation was built and run on the baseline to measure these numbers, then reverted before the drafting commit (the patch is evidence only).

- **Compiler.** `tsc` passed on the engine with no other change once `CityZone` became `CitySpace[]`. No production code depended on the tuple's fixed indices at the type level; the 5-space assumptions were all runtime values.
- **Tests.** The new engine file (V1-V9 with V5b) passes 10 / 10. The new client cases pass: `useCityRow` (3), `HQRow` (1), `CityRow` (1), `MoveVillainChoicePrompt` (1), `operatorSetterIntents` (1).
- **Suite.** game-engine 5672 → 5682 / 0 fail (+10 tests in the new file; +2 suites); arena-client 2435 → 2444 / 0 fail (+9); `pnpm -r --no-bail test` 0 fail in every package; arena-client `typecheck` 0.
- **Board check (observed, 1280x720, the `?fixture=mid-turn&play=1` dev route, the store's `city.spaces` set to 5 / 6 / 3).**
  - 5 spaces: the stage is 1500px, and Hero 1 through Hero 5 sit at the same x as Bridge through Sewers (unchanged).
  - 6 spaces: the stage widens to 1668px, and the City and HQ rows have no horizontal overflow. "Space 6" sits left of the Bridge, the extra HQ spacer is under it, and Hero 1 stays under the Bridge (both at x=304).
  - 3 spaces: the Bridge and the Streets render as hatched gone columns titled "The Bridge is not part of the City right now.", and the HQ x positions are identical to the 5-space board.
  - The fit scale held at 0.628 (height-bound at 1280x720). There were no script errors; the only console errors were the fixture's image 404s.
- **Revert proofs (observed).** Exactly as AC 3 lists them, (a)-(t).
- **Derived artifacts.** After a rebuild every card / coverage `:check` stayed current and the dashboard `test:coverage` / `typecheck` / `format:check` exit 0: nothing regenerates. Measured at the #2999 base; expectations, not targets.

## User-Visible Impact

- None in any current match (always 5 spaces).
- Under WP-832:
  - a 3-space City shows the Sewers, Bank and Rooftops, plus two hatched columns where the Streets and Bridge were ("The Bridge is not part of the City right now.");
  - a 6-space City shows a "Space 6" column left of the Bridge, and on desktop the HQ gains a blank leading cell so Hero 1 stays under the Bridge (the mobile HQ is not column-aligned, and its City row scrolls as today);
  - while the City has 6 spaces, the board scales slightly smaller to fit the extra column (the stage widens by one column).

## Assumes

1. **The City type** (`board/city.types.ts` L17-29): `CityZone = [CitySpace × 5]`, `CitySpace = CardExtId | null`; `HqZone` is a 5-tuple. `G.city: CityZone` (`types.ts` ~L2436).
2. **Helpers** (`board/city.logic.ts`):
   - `pushVillainIntoCity` (L60-100) copies `city[0..4]` and, when full, escapes `city[4]` with a hand-unrolled shift; its leftmost-empty scan already uses `city.length`.
   - `initializeCity()` (L111) returns 5 nulls.
3. **Shape checks:**
   - `validateCityShape` (`board/city.validate.ts` L47 / L58) rejects `length !== 5` and loops to 5. `performVillainReveal` calls it (`villainDeck/villainDeck.reveal.ts` L267) and skips the reveal on failure.
   - `checkCitySize` (`invariants/structural.checks.ts` L27-31) asserts length 5.
4. **Hard-coded fives:**
   - `fightVillain` rejects `cityIndex > 4` (`moves/fightVillain.ts` L158);
   - `isGuardBlocking` loops `index <= 4` (`board/boardKeywords.logic.ts` L70);
   - `OPERATOR_ESCAPE_CITY_INDEX = 4` (`moves/operatorSetters.ts` L56);
   - the bot's move-villain default picks `toCityIndex = from === 0 ? 1 : 0` (`simulation/ai.legalMoves.ts` L329), which needs 2 spaces.
5. **Names by index** (`board/citySpaceNames.ts`):
   - `CITY_SPACE_NAMES` is the 5-name tuple; `citySpaceNameForIndex` returns `undefined` past index 4;
   - `hqSlotIndexUnderCitySpace(i) = 4 - i`, `undefined` past 4.
   - `fightVillain` takes its restricted-attack target from the name and returns silently when there is none (L171-174).
   - `AttackTargetName = CitySpaceName | 'mastermind'` (`economy/economy.types.ts` L17), with labels in `ATTACK_TARGET_LABELS` (`economy/economy.logic.ts` L698).
6. **Name-to-index lookups** read `G.city[index]` and so already see nothing past the end:
   - the villain location gate (`villain/villainEffects.execute.ts` `isCityGateSatisfied`);
   - the fight-cost-by-space reduction (`economy/economy.resolve.ts` L145);
   - the Spinning Cyclone move (`moves/moveVillainChoice.resolve.ts`, which also needs `from` / `to` checked against the length).
7. **Scheme-specific indices.** Dark Portals (`economy/economy.resolve.ts` `darkPortalLocations`, `rules/schemeTwistResolvers.ts` L822-834) and `BANK_CITY_INDEX` (Midtown Bank Robbery) belong to schemes that never run with a resized City (one scheme per match).
8. **Setup instruction.** The `modifyCitySize` scheme-setup instruction is a logged no-op citing the tuple (`scheme/schemeSetup.execute.ts` L67-84). No scheme prints a setup-time City size.
9. **Projection.** `UIState.city.spaces` is already a plain array built from `G.city` (`ui/uiState.build.ts` L856-873); the filter copies it.
10. **Client:**
    - `useCityRow` (`composables/useCityRow.ts`) names cells by VISUAL position and always builds 7 cells.
    - `CityRow.vue` and `HQRow.vue` use the fixed `--board-space-column-width` / `--board-edge-column-width` flex columns. HQRow has one blank leading cell under the Escaped Pile (D-24747).
    - `MoveVillainChoicePrompt.vue` lists engine indices `[4, 3, 2, 1, 0]`.
    - `operatorSetterIntents.hasEscapeCandidate` reads `spaces[4]`.
    - `PlayDesktop.vue` / `PlayMobile.vue` mount `HQRow` with `:hq="snapshot.hq"`.
11. **Tests.** About 80 engine test files hand-build 5-null `city` literals. Engine tests run under `tsx` without type-checking, and an array literal is still a valid `CityZone`.
12. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why an array, not a 6-tuple with "closed" spaces.** D-2602 named the conversion: `CityZone` becomes `CitySpace[]`. Then the length IS the City size, and "the escape edge is the last space" is true by construction. Every loop over `G.city` already visits only spaces that exist. A space that does not exist cannot hold a card, so "act as if that city space no longer exists" needs no flag. A fixed tuple with a "closed" mask would need every reader to consult it.
- **Which end changes.** The entry (Sewers, index 0) never moves; the far edge does ("mark the new edge of the city"). So index `i` keeps its name and its HQ slot below it, and a removed space is always a far one. Spaces 6+ are new, beyond the Bridge, with no name.
- **Unnamed spaces and restricted Attack.** A grant "usable only against Villains in the Sewers" names a space. A sixth space has no name, so its fight target is a new `UNNAMED_CITY_SPACE_TARGET`. No grant can name it, so it is fought with plain Attack only, and a Bridge-only grant cannot pay for it. Location effects that name a space do nothing for it, which is the rulebook's reading.
- **HQ.** Always five (rules v23). `hqSlotIndexUnderCitySpace` already returns `undefined` past index 4, so a sixth space has no HQ slot under it (Abomination there gets +0).
- **Layout.** A smaller City keeps five columns, its removed spaces drawn as hatched placeholders, so nothing on the board moves. A larger City adds a leftmost column; the HQ gets a matching blank cell so Hero 1 stays under the Bridge. The authored stage is a fixed 1500px, so it is widened by one space column per extra space; its ResizeObserver then refits and the board scales down a little while it lasts (one country of seven in WP-832). Without the widening the City and HQ rows would overflow their separate scrollers and drift out of alignment (the 01.7 finding).
- **Fixed-name model limits.** The model removes spaces from the far edge only. Galactus destroys a specific named space (e.g. the Streets), which a length cannot represent; that is out of scope here and needs its own model if Galactus is built.
- **What this packet does not do.** Nothing resizes the City yet; WP-832's Twist does. The `modifyCitySize` setup instruction stays a logged no-op with corrected wording.
- `docs/ai/ARCHITECTURE.md` §Zone & Pile Structure (CardExtId-only zones), §Architectural Principles #1 / #2; `.claude/rules/architecture.md` §Layer Boundary.
- `docs/ai/DECISIONS.md`: scan D-2602, D-24652, D-24747, D-24295, D-24505 before coding.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- No randomness, no I/O, no registry access at runtime. Moves never throw.
- Tests use `node:test` + `node:assert` (`makeMockCtx` / `makeMockMoveContext`), with no `boardgame.io` import.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24764) before coding. One WP per session.

**Packet-specific:**
- **Byte-identical at five spaces.** No existing assertion is edited (one malformed-City fixture changes its example, AC 2); `finalStateHash` / `PRE_WP080_HASH` unchanged.
- **The HQ stays a 5-tuple.**
- **No resize here.** No code path changes the City size in this packet.
- **Contract change.** `CityZone` and `AttackTargetName` are recorded in D-24764 (superseding D-2602's premise).

## Locked Values

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

## Scope (In)

- **A)** Engine: `ui/uiState.types.ts` (comment), `board/city.types.ts`, `board/city.logic.ts`, `board/city.validate.ts`, `invariants/structural.checks.ts`, `board/boardKeywords.logic.ts`, `moves/fightVillain.ts`, `moves/moveVillainChoice.resolve.ts`, `moves/operatorSetters.ts`, `economy/economy.types.ts`, `economy/economy.logic.ts`, `simulation/ai.legalMoves.ts`, `scheme/schemeSetup.execute.ts` (wording).
- **B)** Engine tests: NEW `board/citySize.test.ts` (V1-V9, V5b); `villainDeck/villainDeck.city.integration.test.ts` (its malformed-City fixture moves from 3 spaces, now legal, to 7).
- **C)** Client: `composables/useCityRow.ts` + test, `components/play/CityRow.vue` + test, `components/play/HQRow.vue` + test, `components/play/MoveVillainChoicePrompt.vue` + test, `lib/operatorSetterIntents.ts` + test, `pages/PlayDesktop.vue`, `pages/PlayMobile.vue`.
- **D)** Derived artifacts only if their `:check` reports stale after a rebuild.

## Out of Scope

- Changing the City size anywhere (WP-832).
- Wiring the `modifyCitySize` setup instruction.
- Dark Portals and Midtown Bank Robbery on a resized City (their schemes never resize it).
- A UIState City-size or space-name field (the client derives both from `spaces.length` and the engine index).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `board/citySize.test.ts`: **new**
- `villainDeck/villainDeck.city.integration.test.ts` (the malformed-City fixture): modified
- `board/city.types.ts` (the array type + size bounds), `board/city.logic.ts` (`pushVillainIntoCity`, `initializeCity`), `board/city.validate.ts` (the range), `invariants/structural.checks.ts` (the range), `board/boardKeywords.logic.ts` (Guard loop), `moves/fightVillain.ts` (index guard + fight target), `moves/moveVillainChoice.resolve.ts` (index bound, existence check, unnamed label), `moves/operatorSetters.ts` (escape edge), `economy/economy.types.ts` + `economy/economy.logic.ts` (the unnamed target + label), `simulation/ai.legalMoves.ts` (1-space decline, unnamed fight target), `ui/uiState.types.ts` (a stale index comment), `scheme/schemeSetup.execute.ts` (wording): modified

**Client (`apps/arena-client/src/`)**
- `composables/useCityRow.ts` + `useCityRow.test.ts` (names by engine index, gone cells, the 6th column), `components/play/CityRow.vue` + `CityRow.test.ts` (the hatched gone column), `components/play/HQRow.vue` + `HQRow.test.ts` (the extra spacer prop), `components/play/MoveVillainChoicePrompt.vue` + `MoveVillainChoicePrompt.test.ts` (indices from the City size, "Space N" from 1), `lib/operatorSetterIntents.ts` + `operatorSetterIntents.test.ts` (the last-space escape), `pages/PlayDesktop.vue` (the spacer count and the stage widening), `pages/PlayMobile.vue` (the spacer count): modified

**Derived artifacts (regenerated only if their `:check` reports stale)**
- none expected (§Scaffold)

That is 27 hand-edited files (7 tests). Each 5-space site needs its own one-line fix, and the client board must render both directions. Splitting it from WP-832 keeps the contract change separate from the scheme.

**Governance:** `docs/ai/ARCHITECTURE.md` (the `G.city` row, L713: `CitySpace[]`, 1-6 spaces, 5 by default, D-24764; and the `modifyCitySize` bullet, L1443: unwired because no scheme sets a setup-time size, the City itself resizable per D-24764), `docs/ai/DECISIONS.md` (D-24764, and a "premise superseded by D-24764" note on D-2602), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-831-variable-city-size.md`

## Contract

- `CityZone` becomes `CitySpace[]` (contract file, locked since WP-015; recorded in D-24764, superseding D-2602's premise). Two more contract files change: `board/city.validate.ts` (the length range) and `economy/economy.types.ts` (the `AttackTargetName` member).
- The City size bounds `CITY_DEFAULT_SIZE` / `CITY_MIN_SIZE` / `CITY_MAX_SIZE`.
- `AttackTargetName` gains `'unnamed-city-space'`.
- No new move, `G` field or UIState field.
- At 5 spaces every behavior is unchanged.

## Test Contract

`board/citySize.test.ts` drives the real helpers, the real `fightVillain` / `revealVillainCard` / `operatorEscapeVillain` moves and a full G built from `data/cards/ca75.json`.

| # | Input | Expected | Invariant |
|---|---|---|---|
| V1 | `initializeCity()`, `(1)`, `(6)` | 5 / 1 / 6 nulls | constructor |
| V2 | push into full 3-, 6- and 1-space Cities, and a 6-space one with a gap | the last space escapes; the gap absorbs the push | entry / escape |
| V3 | shape check + invariant on sizes 1-6, 0, 7 | accepted; rejected (`INVALID_CITY_LENGTH`, the locked message) / throws | bounds |
| V4 | a Guard on a sixth space; a 3-space City | blocks; no block | Guard reach |
| V5 | fight a Villain on space 6 (index 5); fight index 3 of a 3-space City | defeated (plain Attack); nothing happens, the City stays 3 long | index guard + unnamed target |
| V6 | a reveal into a full 2-space City | the new Villain enters; the last space escapes to `G.escapedPile` | reveal shape gate |
| V7 | the operator escape on a 3-space City | the Villain on index 2 escapes | escape edge |
| V8 | a move-a-Villain choice in a 1-space City | the bot's only legal move is the decline | bot |
| V5b | a Villain on the sixth space, enough Attack | `getLegalMoves` lists `fightVillain { cityIndex: 5 }` | bot mirrors the move |
| V9 | Spinning Cyclone with the only bystander-holder on the sixth space | the bot picks `{ from: 5, to: 0 }`; the move succeeds; the choice drains (no freeze) | sixth-space move |

Client cases: `extraCityColumns` counts only spaces beyond five; a 3-space City renders gone cells for indices 4 and 3 with names by engine index; a 6-space City adds a leftmost "Space 6"; the normal City has no gone cell (`useCityRow`). The HQ extra spacer appears only with an extra space (`HQRow`). `CityRow` draws the gone columns. The move-villain prompt lists only existing spaces, and numbers an unnamed sixth space "Space 6". `hasEscapeCandidate` reads the last space.

## Vision Alignment

**Vision clauses touched:** §1 (rules authenticity), §8 / §22 (determinism).

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (an engine foundation, no paid or persuasive surface).

**Determinism preservation:**
- At 5 spaces every function returns exactly what it did; no new randomness.
- No `G` field is added; the City's serialized form at 5 spaces is the same array of five, so every hash oracle is unchanged.
- **Replay compat:** no stored match changes behavior (no match resizes the City until WP-832).

## Funding Surface Gate

§20 **N/A**: engine and board layout. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Behavior.** V1-V9 (with V5b) and the client cases pass.
2. **Unchanged neighbors.** Every existing test passes unedited, including the 5-space City, escape, fight, Guard, move-villain, operator-setter, board-alignment and HQ tests — except one fixture: `villainDeck.city.integration.test.ts`' "malformed G.city" case used a 3-space City as its malformed example, which is now legal by design, so its example becomes a 7-space City (the assertions are unchanged).
3. **Revert proofs**, each restored afterwards: (a) escaping from index 4 fails V2, V6; (b) an `initializeCity` that ignores its size fails V1, V3, V5; (c) a shape check wanting 5 fails V3, V6; (d) an invariant wanting 5 fails V3; (e) Guard reach stopping at 4 fails V4; (f) a fight index guard at 4 fails V5; (g) an unfightable unnamed space fails V5; (h) the operator escape at index 4 fails V7; (i) no 1-space decline fails V8; (j) no gone cells, (k) names by visual position — each fails a `useCityRow` case; (l) no HQ extra spacer fails the `HQRow` case; (m) a CityRow that drops gone cells fails the `CityRow` case; (n) a prompt listing five spaces fails the `MoveVillainChoicePrompt` case; (o) the escape candidate at index 4 fails the `operatorSetterIntents` case; (p) a bot that skips an unnamed space fails V5b; (q) a move-villain index bound at 4, (r) refusing an unnamed space — each fails V9; (s) `extraCityColumns` returning 0 fails its `useCityRow` case; (t) a 0-based "Space N" label fails the 6-space `MoveVillainChoicePrompt` case.
4. **Derived gates.** After `pnpm -r build`, every card / coverage `:check` exits 0 (`pnpm cards:check`, `pnpm cards:count-markers:check`, `pnpm ledger:heroes:check`, `pnpm ledger:villains:check`, `pnpm effect-index:check`, `pnpm mechanics:metadata:check`, `pnpm gauntlet:loadouts:check`, `pnpm gauntlet:configs:check`, `pnpm sim:runtime-observed:check`, `pnpm sim:coverage --check`), and from `apps/dashboard` `pnpm test:coverage`, `pnpm typecheck` and `pnpm format:check` exit 0.
5. **Client.** `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
6. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `finalStateHash` / `PRE_WP080_HASH` unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; expected delta +10 tests / +2 suites (§Scaffold). A different delta is explained, never tuned.
3. AC 3 revert proofs from `packages/game-engine` with `node --import tsx --test src/board/citySize.test.ts`, and from `apps/arena-client` with `node --import tsx --import @legendary-arena/vue-sfc-loader/register --test <the client test file>` for (j)-(o), each restored.
4. Every check in AC 4 → 0 after the rebuild.
5. `pnpm --filter @legendary-arena/arena-client typecheck` → 0; `pnpm --filter @legendary-arena/arena-client test` → 0 fail, expected delta +9 (2435 → 2444).
6. `pnpm -r --no-bail test` → 0 fail.
7. `git status --porcelain` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] Every Acceptance Criterion passes and the diff is allowlist-only.
- [ ] D-24764 appended to `DECISIONS.md` as Active, and D-2602 marked "premise superseded by D-24764"; `ARCHITECTURE.md`'s `G.city` row and `modifyCitySize` bullet updated; 01.6 post-mortem written; `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]` with date, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-869:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge). On `play.legendary-arena.com`, after `/api/version` shows a gitSha that contains the merge, in any match created after the deploy:
  - the board is unchanged: 5 City spaces named Bridge … Sewers, the HQ aligned under them, a Villain escaping off the Bridge as before; the Play Diagnostics `uiStateSnapshot` still shows `city.spaces` with 5 entries.

  The resized-City views are verified live with WP-832. Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24764 — variable-city-size.** It locks:
- `CityZone` as `CitySpace[]` of `CITY_MIN_SIZE..CITY_MAX_SIZE` (1-6) spaces, 5 by default, superseding D-2602's fixed-tuple premise;
- the entry fixed at index 0 and the escape edge at the last index; names bound to engine indices 0-4; spaces 6+ unnamed, fought with plain Attack only (`unnamed-city-space`); removed spaces simply absent; the HQ always 5, with no HQ slot under a sixth space;
- the board layout: removed spaces drawn as hatched columns, an extra space as a leftmost column with a matching HQ spacer, the authored stage widened by one column per extra space so the scale-to-fit board shrinks;
- the bot mirrors the move (an unnamed space is fightable and movable), and Spinning Cyclone labels an unnamed space;
- the limits: far-edge removal only (Galactus's named-space destruction needs its own model); a future resize helper (WP-832) escapes each removed space's Villain through `resolveVillainEscape`; a mastermind-driven resize (Ego, Galactus) would reopen Assumes 7 (Portals / Bank / Brainwash index assumptions);
- that nothing resizes the City yet; `modifyCitySize` stays an unwired setup instruction.

---

## Gate Record

**Pre-flight (01.4) (independent subagent): DO NOT EXECUTE YET → READY after three blocking fixes, applied in scope (the conditional-verdict rule; no re-run needed).** Verified every Locked Value against the scaffold, V1-V8 against the Test Contract, and every Assumes anchor on `658b0d87`; byte-identity at five spaces traced; no tuple destructuring of `G.city` anywhere; the client gone cells keep the space-column class and the HQ extra spacer keeps Hero 1 under the Bridge; `apps/server`, the UIState projection, `ai.competent` / `ai.seatChoice` and the client cost gating are length-agnostic.
- **B1 (fixed):** Spinning Cyclone refused a sixth space (`isCityIndex` stopped at 4, an unnamed space returned silently), so a 6-space City could freeze the bot on a block-all choice → bounded by `CITY_MAX_SIZE`, unnamed spaces labelled (V9, proofs (q) / (r)).
- **B2 (fixed):** the bot's fight enumeration still skipped a nameless index, breaking the D-24364 mirror → the unnamed target (V5b, proof (p)).
- **B3 (fixed):** ARCHITECTURE.md still documents `G.city` as a 5-tuple and `modifyCitySize` as tuple-blocked → both rows on the governance list, and D-2602 marked superseded.
- Non-blocking, applied: the board-scaling claim was false against a fixed-width stage (now the stage widens, verified live); "Space N" from 1; stale "5-element" comments; the two other contract files named; V3 pins the locked code and message; anchor drift; Galactus's named-space destruction recorded as out of the length model.

**Copilot (01.7) (independent subagent): round 1 RISK (HOLD), three blocking + three non-blocking findings, all applied; round 2 CONFIRM, four P2 items, applied. Pre-flight stands.** Round 1 confirmed byte-identity at five (no `G` or UIState shape change, hashes, replay and the diagnostics snapshot unaffected) and found the same two engine gaps as 01.4 plus the layout one:
1. FM 11 / 22: the bot never fought the sixth space → the unnamed target in `getLegalMoves` (V5b).
2. FM 22: Spinning Cyclone froze on a 6-space City → the bound and label (V9).
3. FM 26 / 29: the stage is a fixed 1500px, so an extra column would overflow the City and HQ rows' separate scrollers and break their alignment → the stage widens by `extraCityColumns(n)` columns so the ResizeObserver refits; a 1280x720 DOM check recorded in §Scaffold (1668px, no overflow, Hero 1 under the Bridge).
4-6. The "Space 5" label, the stale `villainCityIndices` comment, and the D-24764 limits (far-edge-only, the WP-832 escape obligation, the mastermind-resize caveat).
- Round 2 (all verified in docs and code; Locked Values byte-identical; the stage calc 1500 + 168 = 1668px; a null first-render snapshot yields 0 extra columns): stale "0-4" comments in the edited files fixed; a 6-space prompt case pins "Space 6" (proof (t)); the Client Locked Value names `extraCityColumns`; the HQ spacer is desktop-only (the mobile HQ is not column-aligned).

**Lint (00.3) (independent subagent): PASS with one count fix (the file count) and four nits, applied** (the `node:test` / no-boardgame.io constraint, the client proof command, per-file client descriptions). Locked Values byte-identical between WP and EC.

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 sections present; 6 ACs; 4 Out-of-Scope items |
| §2 | PASS — full files, ESM / Node 22, 00.6, session protocol, packet-specific rules; Locked Values |
| §3 | PASS — 12 anchored Assumes items, a BLOCKED clause |
| §4 | PASS — ARCHITECTURE Zone & Pile Structure / Principles / Layer Boundary, DECISIONS scan list; 00.2 not needed |
| §5 | PASS — 27 hand-edited files, each described; the size and the split from WP-832 justified |
| §6 | PASS — no setup-payload fields; full-word names |
| §7 | N/A — no new packages |
| §8 | PASS — the engine decides; the client derives names and columns from `spaces.length` and the engine index |
| §9 | PASS — pnpm / node only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test + node:assert, no boardgame.io import |
| §13 | PASS — exact commands; deltas +10 / +2 suites (engine), +9 (client) |
| §14 | PASS — 6 binary ACs; AC 2 names the one changed fixture |
| §15 / §15.1 | PASS — STATUS, DECISIONS, ARCHITECTURE, indexes, allowlist-only diff; live-verify with gitSha evidence |
| §16 | PASS — named helpers; `// why:` on every site |
| §17 | PASS — §1, §8 / §22; conflict, determinism and replay lines |
| §18 | N/A — no grep verification steps |
| §19 | N/A at lint |
| §20 | PASS — N/A with reason |
| §21 | PASS — N/A with reason (no endpoint, no `apps/server` surface) |

EC-869 vs EC-TEMPLATE: PASS; Locked Values byte-identical to the WP.

**Verdict:** PASS.
