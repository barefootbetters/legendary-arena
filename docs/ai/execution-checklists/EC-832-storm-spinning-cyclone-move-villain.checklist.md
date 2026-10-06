# EC-832 — Storm Spinning Cyclone move-a-Villain (WP-795)

**WP:** WP-795 · **Reserves:** D-24664 · **Layers:** Game Engine + Arena Client

Authoritative execution contract for WP-795. Subordinate to ARCHITECTURE.md and `.claude/rules/*`. If this EC and
WP-795 disagree, WP-795 wins. Compliance is binary.

## Before Starting

- [ ] `origin/main` clean and synced. WP-719 / D-24541, D-24284, D-24295 and D-24336 are on main.
- [ ] Re-grep the guard CALL sites (14 sites in 12 files at baseline):
      `git grep -n "hasPendingCoveringFireChoice(G\|hasPendingCoveringFireChoice(gameState" -- packages/game-engine/src ':!*.test.ts' ':!packages/game-engine/src/moves/coveringFireChoice.resolve.ts'`.
      Add the new guard beside every hit, and bump `phaseCard.ts` `hasAnyPendingChoice()`'s JSDoc check count. A
      call site not in the WP allowlist is the one permitted 01.5 addition; name it in the commit body. JSDoc-only
      mentions (e.g. `splitFaceChoice.resolve.ts`) are not sites.
- [ ] Read the HEAD drift pins and bump from the OBSERVED values: `HERO_KEYWORDS.length` (three files: `rules/heroKeywords.test.ts` ~L67,
      `rules/heroAbility.setup.test.ts` ~L639, `setup/heroAbility.setup.test.ts` ~L1464), the handler
      count (two asserts), and the `game.test.ts` move count / array / title.
- [ ] `pnpm -r build`, then record the engine and arena-client before-counts.

## Locked Values

- Keyword `spinning-cyclone`, in both `HANDLED_KEYWORDS` and `NO_MAGNITUDE_KEYWORDS`. Marker
  `[keyword:spinning-cyclone]` on `core/storm/spinning-cyclone` abilityIndex 0, core only. Do NOT add a co2e entry:
  co2e's printing has no rescue clause. `VALID_TOKEN_PATTERN` gains
  `^\[keyword:spinning-cyclone\]$`.
- Pending: `PendingMoveVillainChoice { playerID: string; sourceCardId: CardExtId }`;
  `G.pendingMoveVillainChoices?: PendingMoveVillainChoice[] | undefined`.
- Move: `resolveMoveVillainChoice(context, args: ResolveMoveVillainChoiceArgs)`, where the exported
  `ResolveMoveVillainChoiceArgs = { decline: true } | { fromCityIndex: number; toCityIndex: number }`, with
  `client: false`. In the sorted move array it sits between `resolveMelterKoChoice` and `resolveOptionalKoReward`.
- Guard: `hasPendingMoveVillainChoice(G)`.
- No-Villain log (`blocked`): `Player ${playerID}'s ${cardRef} found no Villain in the City to move.`
- Decline log (`neutral`): `Player ${playerID} chose not to move a Villain (Spinning Cyclone).`
- Move log (`applied`): `Player ${playerID} moved ${movedRef} from the ${FromLabel} to the ${ToLabel} (Spinning
  Cyclone).` On a swap, append ` ${swappedRef} moved to the ${FromLabel}.` Labels:
  `formatAttackTargets([name])`, with `citySpaceNameForIndex` narrowed by an explicit `undefined` check, never `!`.
- Rescue: `awardAttachedBystanders(movedId, G.attachedBystanders, victory)`, plus the fight-path line `Player
  ${playerID} rescued ${n} bystander(s) from ${movedRef}.`
- Args shape:
  - a null, undefined or non-object `args` is a no-op, guarded before any field read;
  - decline = `decline === true` with no index fields;
  - move = both index fields with no `decline`;
  - any mixed or partial shape is a no-op.
- UIState: `UIPendingMoveVillainChoice { playerID: string; villainCityIndices: number[] }`, chooser-redacted. It is
  recomputed from the live `G.city` on every build. The filter copies `[...source.villainCityIndices]`. `index.ts`
  exports the UI type and `ResolveMoveVillainChoiceArgs` only.
- Prompt props: `pendingMoveVillainChoice?` (default `undefined`), `city: UICityState`, `viewerPlayerId: string |
  null`, `submitMove`. Render only when the viewer is `playerID`. Picks and `isSubmitting` reset when the pending
  prop's identity changes. Don't move is always enabled.
- **Component authoring form (P6-46 / D-6512):** any template binding that is neither a `defineProps`-declared
  prop nor a `defineEmits`-declared emit forces `defineComponent({ setup() { return {...} } })` form. The prompt's
  local source and destination refs require it.
- Bot: move the lowest-index Bystander holder to the lowest other index, else `{ decline: true }`.
- Client test ids: `move-villain-source`, `move-villain-destination`, `move-villain-confirm`,
  `move-villain-decline`.
- Drift at draft: `HERO_KEYWORDS` 75 → 76, handlers 58 → 59, moves 46 → 47 (+1 more each if WP-794 landed first).

## Guardrails

1. Active-player scoped (D-24284). Park only for `playerID`. Lazy-init at the park site, never in `Game.setup`.
2. Every invalid answer is a silent no-op with the queue intact: bad shape, a non-integer or out-of-range index,
   `from === to`, an empty source, or a `playerID` mismatch.
3. The resolve move is the only mutation site. It swaps by direct index assignment. No Fight, Escape or Ambush
   fires, and the Bridge never escapes.
4. Rescue only the MOVED Villain's Bystanders, and only on a move. The swapped Villain keeps its Bystanders and
   captured Heroes.
5. The block-all guard is replicated at every site (not centralized), plus the `ai.legalMoves` short-circuit.
6. Sim-dispatch three-site lockstep: `SIMULATION_MOVE_NAMES` + both `MOVE_MAP`s, or a sim hangs.
7. UIState five-step: type + build + filter pass-through + audience test (built via `buildUIState`) + Play
   Diagnostics snapshot. The drift case is a runtime keyset assertion on a built projection, never `satisfies`.
8. Client: `UiMoveName` gains the move (vue-tsc). The prompt submits ENGINE indices, never the visual order (see
   `useCityRow.ts`). Runtime imports come from the `.` surface only.
   Add `hasPendingMoveVillainChoice` to `TurnActionBar.vue` `anyPendingChoice()` (~L359; the D-24648 freeze class).
   Append the `useTurnActions` positional param LAST and extend the `canEndTurn` / `canHealWounds` call sites.
9. Sentinel `finalStateHash` / `PRE_WP080_HASH` unchanged. Never re-pin.

## Required Comments (`// why:`)

- The lazy-init park. Each block-all guard site. The swap's direct assignment (D-24336 precedent).
- The moved-only rescue. The bot default (rescue value, deterministic).
- The engine-index submission in the prompt.

## Files to Produce

Exactly the WP-795 §Files Expected to Change allowlist, plus any post-baseline guard site named in the commit body.

## After Completing

- Revert proofs 4/4: park, swap, moved-only rescue, filter pass-through.
- Run `node scripts/convert-cards/apply-hero-ability-markers.mjs`, then `pnpm cards:check`. Then
  `pnpm ledger:heroes` → `pnpm mechanics:metadata` → `pnpm effect-index` → `pnpm sim:runtime-observed`, and
  `pnpm sim:coverage --check`.
- `pnpm --filter @legendary-arena/dashboard prebuild:coverage`. Re-pin the dashboard `useInPlayCoverage.test.ts`
  totalObs only if it changed, and explain it in the commit body. The commit carries a `Tests-changed:` trailer
  naming every edited existing test: the drift pins, plus this pin if it was re-pinned.
- Land D-24664 (the six points). Update STATUS. Flip the WORK_INDEX row and EC_INDEX → Done. Mindmap 📝 → ✅, then
  `pnpm roadmap:counts:write`.
- D-24026 live-verify (operator): a move with a rescue, one swap, one decline, and no freeze.

## Common Failure Smells

- Leaving out the filter pass-through: the prompt never renders, and the board freezes (no-UX freeze).
- Leaving out a `MOVE_MAP` entry: a sim hangs on the parked choice.
- Rescuing both Villains on a swap, or rescuing on a decline.
- Submitting visual indices, so the Villain lands in the mirrored space. The prompt test must use Sewers (0) →
  Bridge (4) and assert `{ fromCityIndex: 0, toCityIndex: 4 }`. A Rooftops-only case passes vacuously.
- Adding the keyword to `HANDLED_KEYWORDS` but not to `NO_MAGNITUDE_KEYWORDS`: the handler silently never runs.
- Copying `resolveCoveringFireChoice`'s unguarded `args.choice` read, so an argless submit throws.
- Writing the prompt with `<script setup>` local refs, which breaks the template bindings (D-6512).
- A merge conflict in `TurnActionBar.vue` / `PlayDesktop.vue` / `PlayMobile.vue` with the in-flight
  `infra/endgame-readonly-board` work. Merge `origin/main` and keep both sides.
