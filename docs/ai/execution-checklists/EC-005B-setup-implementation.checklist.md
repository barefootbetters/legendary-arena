# EC-005B — Deterministic Setup Implementation (Execution Checklist)

**Source:** docs/ai/work-packets/WP-005B-deterministic-setup-implementation.md
**Layer:** Game Engine / Setup

**Execution Authority:**
This EC is the authoritative execution checklist for WP-005B.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-005B.

---

## Before Starting

- [ ] WP-005A complete: `MatchSetupConfig`, `validateMatchSetup` exported from game-engine
- [ ] `packages/game-engine/src/types.ts` exports `LegendaryGameState` (WP-002)
- [ ] `@legendary-arena/registry` exports `CardRegistry` and `createRegistryFromLocalFiles` (WP-003)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-005B.
If formatting, spelling, or ordering differs, the implementation is invalid.

- `MatchSetupConfig` fields consumed by `buildInitialGameState`:
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`

- `PlayerZones` keys (all `CardExtId[]`; only `deck` non-empty after setup):
  `deck` | `hand` | `discard` | `inPlay` | `victory`

- `GlobalPiles` keys (sizes from config count fields):
  `bystanders` (← `bystandersCount`) | `wounds` (← `woundsCount`) |
  `officers` (← `officersCount`) | `sidekicks` (← `sidekicksCount`)

- `makeMockCtx().random.Shuffle` reverses arrays — not identity

---

## Guardrails

- `shuffleDeck` uses `ctx.random.Shuffle` only — never `Math.random()`; returns new array, never mutates input
- `makeMockCtx` must not import from `boardgame.io`
- `Game.setup()` calls `validateMatchSetup` first; throws on `ok: false` — the ONLY place throwing is correct
- No `.reduce()` in deck construction — use `for...of`
- `G` stores `ext_id` strings only — no full card objects in any zone or pile
- WP-005A files (`matchSetup.types.ts`, `matchSetup.validate.ts`) must NOT be modified
- Tests do not import from `boardgame.io` — use `makeMockCtx`

---

## Required `// why:` Comments

- `shuffleDeck`: why `ctx.random.Shuffle` is used — determinism for replay
- `makeMockCtx`: why reverse-not-identity — identity would not prove shuffle ran
- `Game.setup()`: why validation runs before `G` is built; why throwing here is correct
- Determinism test: failure indicates a replay-breaking change

---

## Files to Produce

- `packages/game-engine/src/setup/shuffle.ts` — **new** — `shuffleDeck(cards, ctx)`
- `packages/game-engine/src/test/mockCtx.ts` — **new** — shared `makeMockCtx` test helper
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **new** — setup builder
- `packages/game-engine/src/game.ts` — **modified** — wire validate + buildInitialGameState
- `packages/game-engine/src/types.ts` — **modified** — expand `LegendaryGameState`
- `packages/game-engine/src/index.ts` — **modified** — export new public types
- `packages/game-engine/src/setup/buildInitialGameState.shape.test.ts` — **new**
- `packages/game-engine/src/setup/buildInitialGameState.determinism.test.ts` — **new**

---

## Common Failure Smells (Optional)

- `Math.random` found anywhere in package — determinism invariant violated
- Identity shuffle in `makeMockCtx` — cannot prove shuffle ran
- `matchSetup.types.ts` modified — WP-005A contract protection violated
- `JSON.stringify(G)` throws — non-serializable value in `G`

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all test files)
- [ ] No `Math.random` anywhere in `packages/game-engine/src`
- [ ] `JSON.stringify(G)` succeeds; determinism test passes
- [ ] WP-005A contract files untouched (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — what is now working end-to-end
- [ ] `docs/ai/DECISIONS.md` updated — why `ext_id` strings in `G`; why `makeMockCtx` reverses
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-005B checked off with date
