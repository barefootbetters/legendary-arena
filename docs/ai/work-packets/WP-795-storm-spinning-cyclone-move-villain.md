# WP-795 — Storm Spinning Cyclone: move a Villain to a new City space and rescue its Bystanders

**Status:** Draft 2026-10-06 · **EC:** EC-832 · **Reserves:** D-24664 (reserve PR #2610)
**Primary Layer:** Game Engine + App arena-client
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (cross-layer, a new pending-choice contract type, a new server-only move, a new
chooser-redacted `UIState` field and a client prompt — NOT lightweight-eligible)
**Baseline:** `origin/main` @ `d23eb857` (2026-10-06)
**Paired with:** WP-794 (Storm fight-cost reduction). They are independent; either may execute first.

## Goal

core Storm **Spinning Cyclone** reads: "You may move a Villain to a new city space. Rescue any Bystanders captured by
that Villain. (If you move a Villain to a city space that already has Villain, swap them.)" It does nothing today:
no marker, no handler, no log line and no trace.

After this packet, playing Spinning Cyclone with at least one Villain in the City opens a prompt for the active
player. They pick a Villain, then pick another City space, or choose not to move.
- Moving the Villain to an empty space moves it. Moving it to an occupied space swaps the two Villains.
- The moved Villain's captured Bystanders are rescued into the player's Victory Pile.
- The swapped-with Villain keeps its Bystanders.

## User-Visible Impact

- Jeff's 2-player match `s1jtBcEAOfw` (Red Skull / Secret Invasion, 2026-10-06): Spinning Cyclone was played seven
  times. It never offered a move or a rescue, and it left no log line or trace.
- After this packet, the player sees a "Spinning Cyclone: move a Villain" prompt. The log reads, e.g., `Player 0
  moved HYDRA Kidnappers (…) from the Sewers to the Rooftops (Spinning Cyclone).` followed by the fight-path rescue
  line `Player 0 rescued 1 bystander(s) from HYDRA Kidnappers (…).`
- With WP-794, moving a Villain onto the Rooftops after Lightning Bolt makes it cheaper to fight that turn, which is
  the classic Storm combo.

## Assumes

- **WP-719 / D-24541 ✅ — the template.** Covering Fire is a card-named, handler-bearing hero keyword that parks one
  active-player pending choice, resolved by a server-only move. Its full file set (`git show --stat d9177426`) is
  this packet's checklist:
  - the `types.ts` pending type (~L1197) and the `G` field (~L2087);
  - the resolve move `moves/coveringFireChoice.resolve.ts`;
  - the handler in `hero/heroEffects.execute.ts`;
  - the keyword in `rules/heroKeywords.ts`;
  - the projection: `ui/uiState.types.ts` ~L259 / ~L1580, `ui/uiState.build.ts` ~L1693, `ui/uiState.filter.ts`;
  - the client prompt `CoveringFireChoicePrompt.vue` and its wiring;
  - the curated marker in `scripts/convert-cards/inputs/hero-ability-markers.json`, applied by
    `apply-hero-ability-markers.mjs`.
- **The block-all guard sites at baseline.** Found with `git grep -n "hasPendingCoveringFireChoice(G\|hasPendingCoveringFireChoice(gameState" -- packages/game-engine/src ':!*.test.ts' ':!packages/game-engine/src/moves/coveringFireChoice.resolve.ts'`, which returns 14 call sites in 12 files:
  - `game.ts`;
  - `moves/coreMoves.impl.ts`, three guards: `drawCards` ~L188, `playCard` ~L448, `endTurn` ~L711;
  - `moves/fightVillain.ts`, `moves/fightMastermind.ts`, `moves/recruitHero.ts`, `moves/recruitOfficer.ts`;
  - `moves/healWounds.ts`, `moves/dodgeCard.ts`, `moves/exorciseHauntedHero.ts`;
  - `moves/phaseCard.ts` ~L101, inside `hasAnyPendingChoice()`. That aggregate also gates the escape-procedure
    opener (`villainEscapeProcedure.ts` ~L271), so this guard matters beyond Phasing. Its JSDoc check count is
    bumped by one;
  - `villainDeck/villainDeck.reveal.ts`;
  - the bot short-circuit in `simulation/ai.legalMoves.ts`.
  The new guard goes beside each call. `splitFaceChoice.resolve.ts` only mentions the guard in a JSDoc comment and
  is NOT a site. A call site added after baseline is included too (re-run the grep at execution).
- **Sim dispatch three-site lockstep** (auto-memory `reference_pending_choice_wp_full_file_set`):
  `SIMULATION_MOVE_NAMES` (`ai.legalMoves.ts` ~L170) plus a `MOVE_MAP` key in `simulation/simulation.runner.ts`
  (~L338) and `simulation/par.aggregator.ts`.
- **Move-registration drift pin:** `game.test.ts` ~L215–217 holds 46 moves at baseline.
  `resolveMoveVillainChoice` sorts between `resolveMelterKoChoice` and `resolveOptionalKoReward`.
- **City and rescue primitives:**
  - `G.city` is a fixed 5-tuple. `CITY_SPACE_NAMES` / `citySpaceNameForIndex` (`board/citySpaceNames.ts`
    ~L24–63; D-24295) give index 0 = Sewers … 4 = Bridge.
  - `awardAttachedBystanders(villainCardId, G.attachedBystanders, victory)` (`board/bystanders.logic.ts` ~L91) is
    applied exactly as the fight path applies it (`moves/fightVillain.ts` ~L379–385), with the same rescue log
    line (~L417–422).
  - Bystanders (`G.attachedBystanders`) and captured Heroes (`G.villainAttachedHeroes`) are keyed by the Villain's
    ext_id, so a move carries them. A rescue removes only the Bystanders.
- **Client:**
  - `useCityRow.ts` maps visual Bridge..Sewers to engine index 4..0 (~L22–65).
  - `UiMoveName` (`components/play/uiMoveName.types.ts`) is a vue-tsc-enforced union.
  - The prompt wiring mirrors Covering Fire in `useTurnActions.ts`, `TurnActionBar.vue`, `PlayDesktop.vue` and
    `PlayMobile.vue`, including the `anyPendingChoice()` auto-advance aggregate.
  - The client may import `citySpaceNameForIndex` / `formatAttackTargets` from the `.` Runtime-Safe surface
    (exported by WP-790).
- **Determinism:** the sentinel replay fixture plays `core/black-widow` + `core/captain-america`, never Storm. No
  `data/par/**` profile or sweep fixture names `core/storm`.
- Engine 4883 / 0 (1122 suites) and arena-client 2270 / 0 on `origin/main` @ `d23eb857`. Re-record them at
  execution.

## Context (Read First)

**Rules reading.**
- "You may move a Villain to a new city space": the Villain must end in a different space. Any of the other four is
  legal, empty or occupied.
- The parenthetical makes an occupied destination a swap. Both Villains change spaces, and no Villain leaves the
  City.
- "Rescue any Bystanders captured by **that** Villain" means only the moved Villain. The rescue happens only when a
  move happens. Declining rescues nothing.
- Henchmen and Skrull Heroes in the City (Secret Invasion) are Villains (D-24603), so they are movable.
- Moving is not a fight and not an escape:
  - no Fight or Escape ability fires;
  - no Villain enters from the Villain Deck;
  - no Ambush fires;
  - a Villain moved to the Bridge does not escape.

**Why one pending entry with a two-field answer, not two prompts.** The whole decision (which Villain, which space)
is one intent. The client gathers both picks locally and submits `{ fromCityIndex, toCityIndex }` once, or
`{ decline: true }`. The engine stores only `{ playerID, sourceCardId }`, as Covering Fire does, and validates the
answer against the live `G.city`. The block-all guard freezes the City until the answer arrives.

**Why a card-named keyword.** "Move a Villain, rescue its Bystanders, swap if occupied" is this card's compound, so
it follows the `covering-fire` / `here-hold-this` / `random-acts` naming precedent. A future generic "move a
Villain" card can extract a helper then.

**Why a prompt even with one Villain.** The destination is still a choice among four spaces.

**Bot default.** Deterministic, and it captures the rescue value:
- if any City Villain holds a Bystander, move the lowest-index one to the lowest-index other space;
- otherwise decline.

**Read:**
- `docs/ai/DECISIONS.md` — scan D-24541 (Covering Fire), D-24284 (interactive choices are active-player scoped),
  D-24295 (City space names), D-24603 (Henchmen are Villains), D-12803 (audience filter), D-24372 (runtime drift
  pins).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §5 (Ability Text Markup Language: the `[keyword:spinning-cyclone]`
  marker) and §4.4 (External ID Convention: the `CardExtId` keys of `G.attachedBystanders`). No card-data shape
  change.
- `docs/ai/ARCHITECTURE.md` Section 1 (Monorepo Package Boundaries) and §Layer Boundary (Authoritative): the engine
  decides, and the client submits intent.
- `.claude/rules/architecture.md` §UIState Projection Integrity. The five-step Board-Visible Field Rule applies to
  `pendingMoveVillainChoice`.
- `.claude/rules/architecture.md` §Import Rules, the `apps/arena-client` row: `.` surface only, never `/setup`.

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- Never `Math.random()`. No I/O in moves or helpers. Moves never throw (invalid input is a silent return with the
  queue intact).
- `G` stays JSON-serializable. Zones store `CardExtId` strings only.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test` + `makeMockCtx`; Vue tests via `vue-sfc-loader`. No
  `boardgame.io` import in helpers or tests.
- Human-style code per `00.6-code-style.md`: no nested ternaries, no `.reduce()`, full-word names, JSDoc.

**Packet-specific:**
- **The choice is active-player scoped** (D-24284). Park only for `playerID`. Never park a per-seat choice.
- **Lazy-init at the park site, never in `Game.setup`.** A game that never plays Spinning Cyclone carries no new
  field, and both hash oracles stay byte-unchanged.
- **One mutation site.** `resolveMoveVillainChoice` is the only code that moves the Villain. It swaps
  `G.city[from]` and `G.city[to]` by direct index assignment, the D-24336 `villainEffectSwapTwoCityVillains`
  precedent.
- **The rescue reuses `awardAttachedBystanders`** exactly as the fight path does, with the same log line. No new
  rescue helper.
- **Existing tests pass without edits, EXCEPT the mandated drift pins:** `HERO_KEYWORDS` length / order array,
  `HERO_EFFECT_HANDLERS` count, and the `game.test.ts` move count / array / title. Also the dashboard
  `apps/dashboard/src/composables/useInPlayCoverage.test.ts` totalObs pin, only when `prebuild:coverage`
  regenerates a changed feed. Any other existing test that fails is STOP-and-report. Every edited existing test is
  named in a `Tests-changed:` commit trailer.
- **Sentinel oracles byte-unchanged; no re-pin.**
- **Session protocol:** STOP and reconcile this WP and D-24664 before coding if either of these holds at execution:
  - an Assumes item is false (a guard site, drift pin, line anchor or helper signature differs);
  - a rules reading is unclear.

  One WP per session.

## Locked Contract Values

- **Keyword:** `spinning-cyclone`. It is handler-bearing with no magnitude, so it goes in both `HANDLED_KEYWORDS`
  and `NO_MAGNITUDE_KEYWORDS`.
- **Marker:** `[keyword:spinning-cyclone]`, a curated apply entry for `core/storm/spinning-cyclone` abilityIndex 0.
  `VALID_TOKEN_PATTERN` gains `^\[keyword:spinning-cyclone\]$`. The parenthetical line (idx1) stays a reminder
  with no marker.
- **Pending** (`types.ts`):
  - `export interface PendingMoveVillainChoice { playerID: string; sourceCardId: CardExtId }`
  - `G.pendingMoveVillainChoices?: PendingMoveVillainChoice[] | undefined` (FIFO).
- **Handler** `heroEffectSpinningCyclone`:
  - With no City Villain: log `Player ${playerID}'s ${cardRef} found no Villain in the City to move.` as `blocked`
    with the card id, and park nothing.
  - Otherwise lazy-init the queue and push `{ playerID, sourceCardId: cardId }`. The park is silent.
- **Move** `resolveMoveVillainChoice(context, args: ResolveMoveVillainChoiceArgs)`, registered in `game.ts` with
  `client: false`:
  - `export type ResolveMoveVillainChoiceArgs = { decline: true } | { fromCityIndex: number; toCityIndex: number };`
  - **Shape rule (no precedence guessing):**
    - `args` that is null, undefined or not an object is a no-op. Guard it before reading any field;
      `resolveCoveringFireChoice` reads `args.choice` unguarded, which this move must not copy.
    - **Decline** = `args.decline === true` with neither index field present.
    - **Move** = both index fields present with no `decline` field.
    - Any mixed or partial shape is a no-op.
  - **Silent no-op (queue intact):**
    - an empty queue;
    - a front `playerID` mismatch;
    - args that are neither shape;
    - indices that are not integers in 0..4;
    - `fromCityIndex === toCityIndex`;
    - `G.city[fromCityIndex] === null`.
  - **Decline:** log `Player ${playerID} chose not to move a Villain (Spinning Cyclone).` (`neutral`), then pop.
  - **Move:**
    1. Swap `G.city[from]` ↔ `G.city[to]`.
    2. Log `Player ${playerID} moved ${movedRef} from the ${FromLabel} to the ${ToLabel} (Spinning Cyclone).`
       (`applied`). When the destination was occupied, append ` ${swappedRef} moved to the ${FromLabel}.`
    3. `awardAttachedBystanders(movedId, …)` into `G.playerZones[playerID].victory`, plus the fight-path rescue
       line when at least one Bystander was rescued.
    4. Pop.
  - Labels come from `formatAttackTargets([citySpaceNameForIndex(i)])`. `citySpaceNameForIndex` returns
    `CitySpaceName | undefined`, so narrow it after the 0..4 validation, with an explicit `undefined` check. Never
    use a non-null assertion.
- **Guard:** `hasPendingMoveVillainChoice(G)` (`length > 0`), beside `hasPendingCoveringFireChoice` at every
  baseline call site. The `endTurn` (`coreMoves.impl.ts` ~L711) and `advanceStage` (`game.ts` ~L210) turn-end
  guards are already among the 14. Because they block turn end, the WP-732 mastermind-defeat latch and the
  final-turn latch promote only after the choice resolves.
- **Bot** (`ai.legalMoves.ts` short-circuit) returns exactly one move:
  - `{ fromCityIndex: i, toCityIndex: j }`, where `i` is the lowest index whose Villain has a non-empty
    `G.attachedBystanders` entry and `j` is the lowest index `!== i`;
  - else `{ decline: true }`.
  - `SIMULATION_MOVE_NAMES` plus both `MOVE_MAP`s gain `resolveMoveVillainChoice`.
- **UIState (five-step):**
  - `UIPendingMoveVillainChoice { playerID: string; villainCityIndices: number[] }`. The indices are the ascending
    non-null `G.city` indices, recomputed from the live `G.city` on every build into a fresh array. Nothing is
    snapshotted.
  - It is projected as `pendingMoveVillainChoice?` and redacted to the chooser (`audience.playerId === playerID`),
    mirroring `pendingCoveringFireChoice`. The filter pass-through copies `villainCityIndices:
    [...source.villainCityIndices]` (the split-face fresh-object precedent, `uiState.filter.ts` ~L1225–1236), so
    the projection never aliases.
  - `index.ts` re-exports the UI type and the `ResolveMoveVillainChoiceArgs` type only. The client has no consumer
    for `hasPendingMoveVillainChoice`, and no block-all choice predicate (e.g. `hasPendingCoveringFireChoice`) is
    exported today.
  - The drift case in `uiState.types.drift.test.ts` is a runtime keyset assertion on a **built** projection. The
    field is optional, so a `satisfies` literal would pin nothing (D-24372 corollary).
- **Client:**
  - A new `components/play/MoveVillainChoicePrompt.vue`:
    - Props, mirroring `CoveringFireChoicePrompt.vue` ~L33–48, because the component stays mounted:
      - `pendingMoveVillainChoice?: UIPendingMoveVillainChoice`, defaulting to `undefined`;
      - `city: UICityState` (`snapshot.city`, for names and "swap with" labels);
      - `viewerPlayerId: string | null`;
      - `submitMove`.
    - It renders only when the viewer is the choice's `playerID`;
    - the local source and destination picks and `isSubmitting` reset when the pending prop's identity changes
      (Covering Fire's double-submit guard);
    - **Authoring form:** the prompt holds local source and destination refs, which are template bindings that are
      neither props nor emits. So it MUST use `defineComponent({ setup() { return { … } } })` form, not
      `<script setup>` (D-6512 / P6-46);
    - step 1 lists the projected Villains by name and space (`data-testid="move-villain-source"`);
    - step 2 lists the other four spaces, each showing "swap with <name>" when occupied
      (`data-testid="move-villain-destination"`);
    - **Move** (`data-testid="move-villain-confirm"`) is disabled until both picks are made;
    - **Don't move** (`data-testid="move-villain-decline"`) is always enabled.
  - It submits `resolveMoveVillainChoice` with the engine indices, never the visual order.
  - `UiMoveName` gains `'resolveMoveVillainChoice'`.
  - The `useTurnActions` / `TurnActionBar` / both play pages wiring mirrors Covering Fire:
    - `hasPendingMoveVillainChoice` joins `TurnActionBar.vue`'s `anyPendingChoice()` (~L359). Leaving it out is
      the D-24648 freeze class;
    - the `useTurnActions` positional parameter is appended LAST, with the `canEndTurn` / `canHealWounds` call
      sites (~L408 / ~L428) extended.
- **Drift pins at draft:** `HERO_KEYWORDS` 75 → 76, `HERO_EFFECT_HANDLERS` 58 → 59, moves 46 → 47. If WP-794 lands
  first, these become 76 → 77 / 59 → 60. Read the HEAD values at execution.

## Scope (In)

- Engine:
  - `types.ts`, `moves/moveVillainChoice.resolve.ts` (new), `hero/heroEffects.execute.ts`, `rules/heroKeywords.ts`;
  - `game.ts`, `moves/coreMoves.impl.ts`, every baseline guard call site above;
  - the stale `game.test.ts` move-list title (~L181), refreshed along with the count and array;
  - `simulation/ai.legalMoves.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`;
  - `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `index.ts`.
- Client: `MoveVillainChoicePrompt.vue` (new), `uiMoveName.types.ts`, `useTurnActions.ts`, `TurnActionBar.vue`,
  `PlayDesktop.vue`, `PlayMobile.vue`.
- Data / tooling: the curated marker plus the `VALID_TOKEN_PATTERN` extension. Then regenerate `data/cards/core.json`
  and the derived feeds.

## Out of Scope

- WP-794 (the Rooftops / Bridge / Mastermind cost reductions).
- Other "move a Villain" cards in other sets, and any generic move-villain helper.
- **`co2e/storm/spinning-cyclone`.** Its 2nd-edition text ("You may move a Villain to another city space. If
  another Villain is already there, swap them.") has NO rescue clause. It gets no marker and stays hollow.
  Applying `[keyword:spinning-cyclone]` to it is forbidden; it needs a distinct keyword or variant later.
- Animating the move on the play mat; a notable event for it.
- Moving the Mastermind, or moving a Villain out of the City.
- Changing `villainEffectSwapTwoCityVillains` (D-24336).

## Files Expected to Change

- Engine source:
  - `packages/game-engine/src/types.ts`, `moves/moveVillainChoice.resolve.ts` (**new**),
    `hero/heroEffects.execute.ts`, `rules/heroKeywords.ts`, `game.ts`, `moves/coreMoves.impl.ts`;
  - `moves/fightVillain.ts`, `moves/fightMastermind.ts`, `moves/recruitHero.ts`, `moves/recruitOfficer.ts`,
    `moves/healWounds.ts`, `moves/dodgeCard.ts`, `moves/phaseCard.ts`, `moves/exorciseHauntedHero.ts`,
    `villainDeck/villainDeck.reveal.ts`;
  - `simulation/ai.legalMoves.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`;
  - `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `index.ts`.
- Engine tests:
  - `moves/moveVillainChoice.resolve.test.ts` (**new**);
  - `game.test.ts`, `rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`,
    `setup/heroAbility.setup.test.ts` (the ~L1464 X-Gene "count stays" `HERO_KEYWORDS.length` pin),
    `hero/heroEffects.execute.test.ts`;
  - `ui/uiState.filter.test.ts` (built through `buildUIState`, modeled on the `pendingSplitFaceChoice` filter case
    ~L3360, since Covering Fire has no filter test), `ui/uiState.types.drift.test.ts` (a new keyset case only);
  - `simulation/ai.legalMoves.test.ts`.
- Client: `apps/arena-client/src/components/play/MoveVillainChoicePrompt.vue` (**new**) +
  `MoveVillainChoicePrompt.test.ts` (**new**), `components/play/uiMoveName.types.ts`, `composables/useTurnActions.ts`,
  `components/play/TurnActionBar.vue`, `pages/PlayDesktop.vue`, `pages/PlayMobile.vue`.
- Data / tooling: `scripts/convert-cards/inputs/hero-ability-markers.json`,
  `scripts/convert-cards/apply-hero-ability-markers.mjs`, `data/cards/core.json`.
- **Generated — modified ONLY if its gate shows a real diff** (regenerate with the gate's own script):
  - `data/metadata/card-mechanics.json`, `data/metadata/effect-implementation-index.json`;
  - `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`;
  - `scripts/coverage/hero-effect-coverage.baseline.json`, `docs/ai/coverage/runtime-observed-hollows.json`;
  - `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (the totalObs pin), only after
    `pnpm --filter @legendary-arena/dashboard prebuild:coverage` regenerates the feed.
- Governance: `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (D-24664 → Active),
  `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

A guard site that appears after baseline is the one permitted addition (01.5 same-layer runtime wiring). Name it in
the EC commit body. No other files may be modified.

## D-24664 Content (authored at execution, Status Active)

1. **One active-player pending entry, two-field answer:** `{ fromCityIndex, toCityIndex }` or `{ decline: true }`,
   validated against the live City.
2. **Swap-if-occupied, both Villains stay in the City.** No Fight, Escape or Ambush fires, and the Bridge does not
   escape.
3. **Rescue only the moved Villain's Bystanders, only on a move**, through the fight-path award.
4. **Bot default:** move the lowest-index Bystander holder to the lowest-index other space, else decline.
5. **Card-named keyword** (`spinning-cyclone`). A generic move-villain helper is deferred until a second card needs
   it. co2e's no-rescue printing will need a distinct keyword or variant.
6. **Matches in progress and replay:** a match already running when this deploys keeps the hooks built at its
   setup. A competitive capture taken before the deploy that plays Spinning Cyclone, but is submitted after it,
   fails `replay_verification_failed`. That is the accepted window (the D-24652 §5 precedent).

## Contract

- Playing Spinning Cyclone with a City Villain parks one choice for the active player.
- The answer moves (or swaps) exactly one Villain and rescues only its Bystanders, or declines.
- The prompt reaches only the chooser, and the board is frozen until it resolves.

## Acceptance Criteria

1. With Villains in the City, playing Spinning Cyclone parks one entry for the active player. With none, it logs
   the locked `blocked` line and parks nothing.
2. Moving to an empty space moves the Villain and rescues its Bystanders into the active player's Victory Pile, with
   both log lines.
3. Moving to an occupied space swaps the two. Only the moved Villain's Bystanders are rescued, and the other keeps
   its Bystanders and captured Heroes.
4. Declining changes nothing but the log and pops the entry.
5. Every invalid answer listed in the Locked Contract Values is a silent no-op with the queue intact.
6. While pending, every guarded action move and turn end is blocked, and the bot emits exactly the locked default.
   The tests assert:
   - no-ops while pending for `drawCards`, `playCard`, `endTurn`, `fightVillain`, `recruitHero` and
     `revealVillainCard`;
   - `hasAnyPendingChoice(G) === true`;
   - `getLegalMoves` returns length 1 for both bot branches. That includes a Bystander holder at an index above 0,
     where the expected `toCityIndex` is 0.
7. `pendingMoveVillainChoice` reaches only the chooser and appears in the Play Diagnostics `uiStateSnapshot`. The
   filter test asserts the field is absent for both the opponent and the spectator.
8. The client prompt submits engine indices. Move is disabled until both picks are made, and Don't move submits
   `{ decline: true }`.
   - The prompt test selects the source Sewers (engine 0) and the destination Bridge (engine 4) by label, and
     asserts the payload `{ fromCityIndex: 0, toCityIndex: 4 }`.
   - A Rooftops-only case is forbidden: index 2 maps to itself visually, so it would pass vacuously.
9. A game that never plays Spinning Cyclone has no `pendingMoveVillainChoices` key. The sentinel `finalStateHash` /
   `PRE_WP080_HASH` are unchanged.
10. `cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`,
    `sim:runtime-observed:check` and `sim:coverage --check` are green, or regenerated with a real diff explained.

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0
pnpm --filter @legendary-arena/game-engine test
# Expected: 0 fail; record before/after counts
pnpm --filter @legendary-arena/game-engine exec node --import tsx --test "src/test/fixtures/replayFixtures.test.ts"
git diff --exit-code -- packages/game-engine/src/test/fixtures/games
# Expected: green; exits 0
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: exits 0; 0 fail
pnpm cards:check; pnpm effect-index:check; pnpm mechanics:metadata:check; pnpm ledger:heroes:check; pnpm sim:runtime-observed:check; pnpm sim:coverage --check
# Expected: OK, or regenerated with a real diff explained in the EC commit body
pnpm -r --no-bail test
# Expected: 0 failures
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All ACs pass. Revert proofs reported, 4/4: reverting each of these fails at least one new test.
  - (a) the park
  - (b) the swap
  - (c) the moved-Villain-only rescue
  - (d) the filter pass-through
- [ ] `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. arena-client vue-tsc exits 0. Before/after
      counts are recorded.
- [ ] Sentinel / replay oracles byte-identical, with no re-pin.
- [ ] `git status --porcelain` ⊆ the allowlist (plus any named post-baseline guard site).
- [ ] **D-24026 live verify (REQUIRED):** in a manual match with core Storm, play Spinning Cyclone:
  - move a Villain holding a Bystander to an empty space, and confirm the move and rescue lines;
  - swap two Villains once;
  - decline once;
  - confirm the board does not freeze and `pendingMoveVillainChoice` appears in the Play Diagnostics snapshot
    while open.
  Record the matchId in STATUS.md.
- [ ] STATUS.md updated. D-24664 is authored in DECISIONS.md as Active with the six points above.
- [ ] WORK_INDEX WP-795 `[x]` with date. EC_INDEX EC-832 → Done. Mindmap `📝`→`✅`.
      `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:**
  - §1 / §2: faithful card semantics.
  - §11: stateless client. It submits intent, and the engine validates.
  - §8 / §22: determinism. The field is lazy, and the bot default is deterministic.
  - §24: replay integrity. See the accepted window below.
  - §26: bot / PAR. The bot gets a deterministic legal default.
  - None of NG-1..NG-8 is crossed.
- **Conflict assertion:** No conflict. Gameplay fidelity only; no monetization surface.
- **Accepted window:** a competitive match captured before the deploy that includes Spinning Cyclone, but is
  submitted after it, re-executes with the new rules and fails `replay_verification_failed`. This is the same window
  WP-790 carried. It closes once pre-deploy matches age out.

## Lint Gate Self-Review (00.3)

All 21 sections are satisfied or N/A: 15 PASS and 6 N/A. This was an independent subagent run: FAIL on the first
pass, then PASS on two delta re-checks.
- **§1 structure:** all required sections are present. Baseline `d23eb857` is cited.
- **§2 constraints:** engine-wide constraints (incl. Node v22+), packet-specific constraints, a Session protocol and
  the Locked Contract Values.
- **§3 / §4:**
  - WP-719 / D-24541, the 14 guard call sites, the sim lockstep and the City / rescue primitives are cited with
    verified anchors.
  - The Read list cites 00.2 §5 / §4.4 and ARCHITECTURE Section 1 / §Layer Boundary.
- **§5 / §7:** a closed allowlist. Every generated artifact is named by exact path under the real-diff rule, including
  the dashboard test. No new dependencies. Its size (~45 files) matches the pending-choice family: WP-719 touched 46.
- **§6 naming:** `CardExtId`, `playerID` and the City space names are canonical.
- **§8 layer:** the engine decides; the client submits intent with `client: false` and imports from the `.` surface
  only.
- **§9 Windows:** `pwsh` verification.
- **§10 / §11:** N/A — no environment variable. No auth surface; the audience filter is projection redaction.
- **§12 tests:** `node:test`, `makeMockCtx` and `vue-sfc-loader`; no boardgame.io, network or database; 4/4 revert
  proofs.
- **§13 / §14 / §15:**
  - exact commands with their expected output;
  - 10 binary ACs, including the Sewers→Bridge anti-vacuity check;
  - a DoD covering STATUS, DECISIONS, WORK_INDEX, EC_INDEX, the mindmap and the D-24026 live verify.
- **§16 code style:** mandated; the guard is replicated per site; the `defineComponent` authoring form is locked.
- **§17 Vision:** clauses cited, a no-conflict assertion, NG-1..NG-8 not crossed, and the replay window in D-24664
  point 6.
- **§18:** N/A — no literal-string grep in Verification.
- **§19:** N/A — commit-time discipline.
- **§20 Funding:** N/A — gameplay fidelity and an in-match prompt only. There is no navigation, viewer or profile
  funding surface, no funding channel, and no donate/support copy.
- **§21 API Catalog:** N/A. There are no `apps/server` file changes. The new move runs through the existing
  boardgame.io built-in move route, so the catalog row is unchanged, and no Library-only function is touched.

## Gate Verdicts

- **Pre-flight (01.4): NOT READY → READY TO EXECUTE.** Two blockers were found and fixed in the text:
  - **PS-1:** the guard-site list wrongly included `splitFaceChoice.resolve.ts`, which is JSDoc only, and the EC grep
    would have steered the executor into the definition file. It is replaced by a call-site grep (14 sites in 12
    files) and the `phaseCard` `hasAnyPendingChoice` note.
  - **PS-2:** the `defineComponent` authoring-form lock (P6-46 / D-6512).

  RS items applied:
  - the prompt props;
  - the args null-guard and shape rule;
  - label narrowing;
  - a built-projection keyset drift test;
  - a live `villainCityIndices` recompute;
  - `index.ts` exports;
  - the filter test model.

  Delta re-checks after the copilot and lint edits returned **READY**.
- **Copilot (01.7): RISK → HOLD → PASS → RISK → PASS.**

  First HOLD, eight findings applied:
  - the third `HERO_KEYWORDS` pin;
  - co2e's no-rescue printing out of scope;
  - `anyPendingChoice()` and the `useTurnActions` wiring;
  - the Sewers→Bridge prompt test;
  - the AC6 test list;
  - the full prompt props;
  - the filter array copy;
  - wording.

  Second HOLD, after the lint edits: the existing-test exception list now includes the dashboard totalObs pin, with a
  `Tests-changed:` trailer. That resolves the copilot verdict to **PASS**.
- **Lint (00.3): FAIL → PASS.** Fixed:
  - Node v22+;
  - the Session protocol;
  - the 00.2 / ARCHITECTURE citations;
  - the dashboard test's full path.

  Advisories applied:
  - D-24664 point 6 (the replay window);
  - "six points";
  - the EC move signature;
  - the EC dashboard step and trailer wording;
  - AC7 / AC8 placement.

  Two delta re-checks returned **PASS**.
- **Not applied (non-blocking, for the executor):**
  - `index.ts:207` does export `hasPendingDivingBlockWounds`. The decision not to export
    `hasPendingMoveVillainChoice` stands.
  - The stale `TurnActionBar.vue` ~L349 comment says `hasRevealedVillain` is the last `useTurnActions` parameter.
    Do not "fix" `revealGate` because of it.
  - Picks reset on each pending-prop identity change. Resetting only when `playerID` / `villainCityIndices` content
    changes, or after a submit, would preserve a half-made selection across an unrelated frame. As written it is
    acceptable, because Don't move is always enabled and the engine re-validates.
