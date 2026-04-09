# EC-006B — Player State Initialization (Execution Checklist)

**Source:** docs/ai/work-packets/WP-006B-player-state-initialization.md
**Layer:** Game Engine / Setup

**Execution Authority:**
This EC is the authoritative execution checklist for WP-006B.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-006B.

---

## Before Starting

- [ ] WP-006A complete: `PlayerZones`, `PlayerState`, `GlobalPiles`, `CardExtId` exported
- [ ] WP-006A validators `validateGameStateShape`, `validatePlayerStateShape` exported
- [ ] `shuffleDeck` exists in `src/setup/shuffle.ts` (WP-005B)
- [ ] `makeMockCtx` exists in `src/test/mockCtx.ts` (WP-005B)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-006B.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `MatchSetupConfig` count fields to `GlobalPiles` mapping:
  `bystandersCount` -> `bystanders` | `woundsCount` -> `wounds` |
  `officersCount` -> `officers` | `sidekicksCount` -> `sidekicks`

- `PlayerZones` initialization: `deck` = shuffled starting deck;
  `hand: []` | `discard: []` | `inPlay: []` | `victory: []`

- `GlobalPiles` keys: `bystanders` | `wounds` | `officers` | `sidekicks`

---

## Guardrails

- `buildPlayerState` starts all zones other than `deck` as `[]`
- `buildPlayerState` calls `shuffleDeck` — never `Math.random()`
- No `.reduce()` in deck or pile construction — use `for...of`
- `G` stores `CardExtId` strings only — no full card objects
- WP-006A files (`zones.types.ts`, `zones.validate.ts`) must NOT be modified
- Tests use `makeMockCtx` — do not import from `boardgame.io`
- WP-005B determinism test must still pass after changes

---

## Required `// why:` Comments

- `buildPlayerState`: cards enter non-deck zones through game moves, not setup
- `buildGlobalPiles`: token ID convention for generic game tokens
- `buildInitialGameState`: why helpers were extracted (30-line function limit)

---

## Files to Produce

- `packages/game-engine/src/setup/playerInit.ts` — **new** — `buildPlayerState(playerId, startingDeck, ctx)`
- `packages/game-engine/src/setup/pilesInit.ts` — **new** — `buildGlobalPiles(config, ctx)`
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** — delegates to new helpers
- `packages/game-engine/src/setup/playerInit.shape.test.ts` — **new** — 3 tests
- `packages/game-engine/src/setup/validators.integration.test.ts` — **new** — validator integration

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (including WP-005B determinism test)
- [ ] `validateGameStateShape(G)` returns `{ ok: true }` on setup output
- [ ] `validatePlayerStateShape(player)` returns `{ ok: true }` for all players
- [ ] WP-006A contract files untouched (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what is fully initialized and validator-confirmed
- [ ] `docs/ai/DECISIONS.md` updated — why token IDs; why helpers extracted from `buildInitialGameState`
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-006B checked off with date
