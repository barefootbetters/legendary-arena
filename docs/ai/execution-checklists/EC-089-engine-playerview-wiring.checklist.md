# EC-089 — Engine PlayerView Wiring (UIState Projection) (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-089-engine-playerview-wiring.md`
**Layer:** Game Engine

> **Status: DRAFT.** Do not execute until (a) WP-028 and WP-029 are merged to `main` with `buildUIState`, `UIState`, `filterUIStateForAudience`, and `UIAudience` exported as specified; (b) WP-089 is registered in `WORK_INDEX.md`; (c) the 00.3 lint gate has been run against WP-089 and recorded passing; and (d) this EC is registered in `EC_INDEX.md`.

## Before Starting

> **STOP** if any checkbox below is false. Execution is not permitted until every item is satisfied.

- [ ] WP-028 (UIState build) merged; `buildUIState(gameState, ctx)` and `UIState` exported per WP-089 `## Assumes`
- [ ] WP-029 (audience filter) merged; `filterUIStateForAudience(uiState, audience)` and `UIAudience` exported per WP-089 `## Assumes`
- [ ] `LegendaryGame` in `packages/game-engine/src/game.ts` is the single `Game()` instance and has no existing `playerView` field
- [ ] No parallel session is editing `packages/game-engine/src/game.ts` or `packages/game-engine/src/ui/**`
- [ ] Baseline captured: `pnpm --filter @legendary-arena/game-engine build` exits 0; `pnpm --filter @legendary-arena/game-engine test` exits 0 with passing count noted for later comparison

## Locked Values (do not re-derive)

- Function signature (verbatim): `(gameState: LegendaryGameState, ctx: Ctx, playerID: PlayerID | null | undefined) => UIState`
- Wiring literal (verbatim): `playerView: buildPlayerView`
- Phase names (the `ctx.phase` values that reach `playerView`): `'lobby'` | `'setup'` | `'play'` | `'end'`
- UIAudience variants used in this packet: `{ kind: 'player'; playerId: string }`, `{ kind: 'spectator' }`
- UIBuildContext shape (do not widen): `{ phase: string | null; turn: number; currentPlayer: string }`
- Audience derivation (exact): `typeof playerID === 'string'` → `{ kind: 'player', playerId: playerID }`; `null` or `undefined` → `{ kind: 'spectator' }`
- Projection order (exact): build `UIBuildContext` from `ctx` → `buildUIState(gameState, uiBuildContext)` → derive audience → `filterUIStateForAudience(fullUIState, audience)` → return

## Guardrails

- `buildPlayerView` is a named top-level function in `game.ts` (not an inline arrow) and remains un-exported unless exporting materially improves test clarity
- `buildPlayerView` never throws, never mutates `gameState` or `ctx`, never reads wall-clock, RNG, or I/O, never logs, never appends to `G.messages`
- `game.ts` must not import from `@legendary-arena/registry`, `apps/server/`, `boardgame.io/testing`, or any server-layer path introduced by this packet
- `LegendaryGame` remains a single `Game()` object — no wrapper Games, no parallel projections, no server-layer reshape
- No existing `LegendaryGame` field is reordered or renamed; `playerView` is added adjacent to `setup` / `moves` / `phases`
- No change to `buildUIState` or `filterUIStateForAudience` — both are locked WP-028 / WP-029 contracts
- No boardgame.io `PlayerView.STRIP_SECRETS` fallback — `filterUIStateForAudience` is the sole audience authority
- On type rejection from `Game<...>`, the only acceptable fixes are (a) adjusting `LegendaryGame`'s `Game<...>` generic type parameters or (b) a narrowly-scoped type assertion at the `playerView` assignment site; anything else stops the session

## Required `// why:` Comments

- On the `buildPlayerView` function body — explain why `null` and `undefined` both map to spectator (boardgame.io represents unauthenticated/unseated clients as either, depending on transport path)
- On the `playerView: buildPlayerView` field of the `LegendaryGame` literal — state that this is the sole engine→client projection boundary and that clients never observe raw `LegendaryGameState`
- On any local type assertion introduced at the `playerView` assignment site (if required) — justify the narrow scope and cite the `Game<...>` generic constraint being worked around

## Files to Produce

- `packages/game-engine/src/game.ts` — **modified** — add named `buildPlayerView` function; wire `playerView: buildPlayerView` into `LegendaryGame`; add required `// why:` comments
- `packages/game-engine/src/game.playerView.test.ts` — **new** — `node:test` coverage for seated-player, other-seated-player, `null`, `undefined`, determinism, no-mutation-of-`gameState`, no-mutation-of-`ctx`
- `docs/ai/DECISIONS.md` — **modified** — append `D-89xx` per WP-089 canonical language (playerView reshapes to `UIState`; `filterUIStateForAudience` is the audience authority; `STRIP_SECRETS` intentionally not used)
- `docs/ai/STATUS.md` — **modified** — append WP-089 complete note per WP-089 canonical line
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — check off WP-089 with today's date
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — mark EC-089 Done

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0 with zero new TS errors or warnings
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 with test count equal to baseline + the new `game.playerView.test.ts` cases
- [ ] `Select-String -Path "packages/game-engine/src/game.ts" -Pattern "throw "` shows no match inside `buildPlayerView` (pre-existing `setup()` throws are expected elsewhere)
- [ ] `Select-String -Path "packages/game-engine/src/game.ts" -Pattern "@legendary-arena/registry"` shows no match
- [ ] `Select-String -Path "packages/game-engine/src/game.ts" -Pattern "apps/server"` shows no match
- [ ] `Select-String -Path "packages/game-engine/src/game.ts" -Pattern "playerView: buildPlayerView"` shows exactly one match
- [ ] `git diff --name-only` lists only the files under `## Files to Produce`

## Common Failure Smells

- Test asserts specific zone contents rather than deep-equal to `filterUIStateForAudience(buildUIState(...), audience)` → WP-029 semantics were re-asserted; delegation-correctness framing was lost
- `buildPlayerView` appears as an inline arrow on the `LegendaryGame` literal → named-function guardrail violated; JSDoc and `// why:` anchors have nowhere to live
- A new `Game()` or wrapper object appears in `game.ts` or `apps/server/**` → single-`LegendaryGame` invariant broken; revert and use the generic-parameter or local-assertion fix
- `PlayerView.STRIP_SECRETS` appears anywhere under `packages/game-engine/src/` → audience-authority guardrail violated
- `playerID === ''` or other truthy/falsy checks in audience derivation → locked `typeof playerID === 'string'` rule was re-derived; empty-string seat IDs would wrongly fall through to spectator
