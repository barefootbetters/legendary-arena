# EC-787 — Client Fight gating reads the engine's projected fight cost (Execution Checklist)

**Source:** docs/ai/work-packets/WP-750-client-fight-gating-reads-engine-fightcost.md
**Layer:** Arena Client + Game Engine UIState projection

## Before Starting
- [ ] **WP-762 (null-vAttack data fill) is `[x]` in WORK_INDEX.** If it is not, STOP: without it, this WP exposes 0-cost fights on 14 Masterminds (13 in gauntlet menus) (Operator Decision 2026-09-25).
- [ ] Baseline `origin/main` ≥ `5de14d5b`. Worktree is clean and synced. Run `pnpm install`, then `pnpm -r build` → 0.
- [ ] Record baselines: engine suite (4231/0 at draft), arena-client suite (2084/0 at draft), arena-client typecheck 0.
- [ ] Anchors unchanged:
  - `UICityCard.fightCost` is required and passed through `deepCopyCitySpaces`.
  - `UIMastermindState` has no cost field.
  - `useCardCostGating` `canFight` / `canFightWithExcessiveViolence` take `UICardDisplay`.
  - CityRow `gateForCell` / `showEvFight` / `gateForCityIndex`.
  - MastermindTile `gateForFight` :96 / `showEvFight`.
  - `buildCardKeywords` still skips Patrol/Guard (D-2504).

## Locked Values (do not re-derive)
- `canFight(cost: number | null, economy)` / `canFightWithExcessiveViolence(cost: number | null, economy)`. Messages are unchanged:
  - `This card cannot be fought.`
  - `Needs X attack, you have Y.`
  - EV passes when `availableAttack >= cost + 1`.
- `useCardCostGating(economy)` exposes `canFight(cost)` and `canFightWithExcessiveViolence(cost)`. `canRecruit` is unchanged.
- CityRow: `canFight(cell.card.fightCost)` and `canFightWithExcessiveViolence(cell.card.fightCost)`.
- MastermindTile: `const mastermindFightCost = props.mastermind.fightCost ?? props.mastermind.display.cost;` feeds both predicates.
- `UIMastermindState.fightCost?: number` = `resolveMastermindFightCost(gameState)`. The filter passes it through with a conditional spread; never write a `fightCost: undefined` literal.
- Badges:
  - City: `data-testid="play-city-fight-cost"`, class `city-space__fight-cost`, text `Fight {{ fightCost }}`. Renders only when `fightCost !== display.cost`.
  - Mastermind: `data-testid="play-mastermind-fight-cost"`, class `mastermind__fight-cost`. Renders only when `fightCost !== undefined && fightCost !== display.cost`, never from the fallback.
  - Placement: inside the tile button, absolutely at the bottom (button `position: relative`). It is not a `.city-space` flex child and not in the top band. The shared `.city-space__cost` rule is unchanged.

## Guardrails
- The WP-762 residual list (Indestructible Man, Killmonger, Jameson, pttr doppelganger / kraven / sandman, and noir kraven-animal-trainer) was **accepted by the operator** (WP §Residual Acceptance). Do not add client locks for these cards; they are engine follow-ups.
- The engine owns truth. The client never adds Dark-Portal, captured-Hero, Skrull or Killbot terms itself; it reads the projection.
- Engine edits stay confined to `ui/uiState.{types,build,filter}.ts` + tests. No move, guard or `G` change, and no hash surface.
- Complete the UIState five-step for `mastermind.fightCost`: types → build → filter pass-through → audience test → diagnostics snapshot check.
- Test migration is limited to what the observed scaffold broke:
  - the `CityRow.test.ts` `villain()` helper sets `fightCost: cost`;
  - `useCardCostGating.test.ts` passes numbers.

  Edit no other existing assertion. The commit body states the intentional behavior change.
- Tooltip precedence stays stage → resource → structural. A matching-cost tile renders byte-identically, with no badge.
- `useSlashGesture.ts` is unchanged; it inherits the gate through `gateForCityIndex`.

## Required `// why:` Comments
- `useCardCostGating` numeric signature: D-24574. The engine projection is the only fight-cost source; printed cost diverged both ways (dead buttons and false locks).
- CityRow gate: `fightCost` is `resolveFightCost`, the same authority as the fight guard (Patrol/Guard unset per D-2504).
- MastermindTile fallback: `display.cost` covers only snapshots from before `fightCost` existed.
- `uiState.types.ts` / `uiState.filter.ts` `fightCost?`: optional so typed fixtures compile, and passed through so the EC-206 filter drop can't recur.
- Badge: players see what the engine will actually charge; it shows only on mismatch.

## Files to Produce
- `packages/game-engine/src/ui/uiState.types.ts`, `uiState.build.ts`, `uiState.build.test.ts`, `uiState.filter.ts`, `uiState.filter.test.ts` — **modified**
- `apps/arena-client/src/composables/useCardCostGating.ts` + `.test.ts` — **modified**
- `apps/arena-client/src/components/play/CityRow.vue` + `CityRow.test.ts` — **modified**
- `apps/arena-client/src/components/play/MastermindTile.vue` + `MastermindTile.test.ts` — **modified**
- `docs/ai/DECISIONS.md`, `docs/ai/STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md` — **modified** (governance close)

## After Completing
- [ ] `pnpm -r build` → 0.
- [ ] Engine suite passes.
- [ ] arena-client typecheck → 0 and suite passes, with the count above 2084 and none deleted.
- [ ] `pnpm -r --no-bail test` → 0 fail.
- [ ] Preview `/?fixture=mid-turn&play=1`: 3× `play-city-fight-cost` (`Fight 0`) and 3× enabled `play-city-villain`; the Mastermind shows no `play-mastermind-fight-cost`; the board scale is unchanged. Screenshot at 1280×720.
- [ ] New tests ≥ filter +1, build +2, gating +2, CityRow +3, MastermindTile +3.
- [ ] D-24574 Active; STATUS updated; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Allowlist-only diff. Two-commit topology.
- [ ] Live-verify (D-24026) on a Portals match: post-deploy STATUS-flip.

## Common Failure Smells
- The Mastermind Fight button is still dead under Portals → the filter pass-through is missing, so `fightCost` was dropped and the tile fell back to printed cost.
- Unrelated CityRow tests fail → the helper still sets `fightCost: 0`, or an assertion was edited beyond the migration.
- A badge appears on every real-match villain → the badge compared against something other than `display.cost` (e.g. CardTile's label). Fixture villains correctly show `Fight 0`.
- The Mastermind shows an empty "Fight " badge on fixtures → the badge rendered from the fallback; guard it with `fightCost !== undefined`.
- The board scale shrank → the badge was added as a flex child of `.city-space`.
- The slash gesture fights a villain the button refuses → the gesture was given its own gate instead of `gateForCityIndex`.
- Typecheck errors outside `useCardCostGating.test.ts` → a caller still passes a `UICardDisplay`.
