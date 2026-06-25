# EC-318 — One-Hit Wonder: Draw-or-Empowered Choose-One (Engine)
# Execution Checklist

**Source:** docs/ai/work-packets/WP-286-draw-or-empowered-choice.md
**Layer:** Game Engine (`packages/game-engine`) + card data
**Decisions:** D-24069 (pending-choice infrastructure + interactive-not-oracle), D-24070 (keyword + card-data typo fix)

---

## Before Starting

- [ ] `git status` — working tree clean; on a `claude/*` branch
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — record baseline test count
- [ ] Confirm `G.pendingOptionalKoRewards` + `optionalKoReward.resolve.ts` exist (WP-248 ✅) — else STOP
- [ ] Confirm `tryResolveEmpoweredChooseOneLine` + `EMPOWERED_CHOOSE_ONE_PREFIX_PATTERN` in `setup/heroAbility.setup.ts` (WP-283 ✅) — else STOP
- [ ] Confirm `buildEmpoweredComposition` (`rules/heroCompositions.ts`) + `interpretHeroPrimitiveEffect` (`hero/effectPrimitive.interpret.ts`) + `executeSingleEffect` (`hero/heroEffects.execute.ts`) — else STOP
- [ ] Confirm D-24069 + D-24070 present in `docs/ai/DECISIONS.md` — else STOP
- [ ] Read `optionalKoReward.resolve.ts` in full — it is the move to mirror
- [ ] Read WP-286 in full before touching a file

---

## Locked Values (do not re-derive)

| Name | Locked Value | Source |
|---|---|---|
| New keyword | `'draw-or-empowered'` | D-24070 |
| New pending type | `PendingDrawOrEmpowered` | D-24069 |
| New G field | `pendingDrawOrEmpowered` | D-24069 |
| New move name | `resolveDrawOrEmpowered` | D-24069 |
| New move file | `moves/drawOrEmpowered.resolve.ts` | D-24069 |
| Helper — gate | `hasPendingDrawOrEmpowered` | D-24069 |
| New descriptor field | `empoweredClass?: string` | D-24069 |
| New parser fn | `tryResolveDrawOrEmpoweredLine` | D-24069 |
| Move args | `{ choice: 'draw' \| 'empowered' }` | D-24069 |
| Pending entry | `{ playerID: string, empoweredClass: string }` | D-24069 |
| Typo fix | `"Chose one"` → `"Choose one"` (only `one-hit-wonder`) | D-24070 |
| HERO_KEYWORDS length after | `22` (was 21 post-WP-285) | D-24030 drift rule |
| Park field init | Lazy only — never in `Game.setup()` | D-24069 |

---

## Guardrails

1. **Never put `pendingDrawOrEmpowered: []` in `Game.setup()`** — lazy-init only.
2. **Import `hasPendingDrawOrEmpowered` at every guard site** — never inline the check.
3. **`'draw'` branch dispatches `executeSingleEffect(..., { type: 'draw', magnitude: 1 })`** — never re-implement card draw.
4. **`'empowered'` branch runs `buildEmpoweredComposition(front.empoweredClass)` via `interpretHeroPrimitiveEffect`** — never re-implement the count.
5. **FIFO front is `[0]`** — pop with `.shift()`, not `.pop()`.
6. **Bot default: always `'empowered'`** — deterministic; no `ctx.random.*`.
7. **Move returns silently on any validation failure** — never throws.
8. **Update the `heroKeywords.test.ts` drift test (21 → 22)** — the most common test red (WP-248/279 precedent).
9. **Update the `game.test.ts` move-set drift test (count + `'resolveDrawOrEmpowered'`)** — same omission class (move-registration drift memo).
10. **The new pre-pass runs BEFORE the per-token empowered dispatch and suppresses it for the matched line** — gated strictly to `Choose one:` + "Draw a card" + exactly one `[keyword:Empowered] by [hc:X]`; must not alter the WP-283 two-empowered path or the core empowered path (pin both with tests, AC-4).
11. **Never partially mutate on a failure path** — return before drawing / granting attack / shifting.

---

## Required Implementation Order

1. `data/cards/antm.json` + `scripts/convert-cards/inputs/cards/antman.js` — typo `"Chose one"` → `"Choose one"`
2. `types.ts` — `PendingDrawOrEmpowered` + `pendingDrawOrEmpowered` G field
3. `rules/heroKeywords.ts` — add `'draw-or-empowered'` (union + array; 21 → 22)
4. `rules/heroAbility.types.ts` — add `empoweredClass?: string` to `HeroEffectDescriptor`
5. `moves/drawOrEmpowered.resolve.ts` — move + `hasPendingDrawOrEmpowered`
6. `moves/drawOrEmpowered.resolve.test.ts` — write + run; confirm green before continuing
7. `rules/heroKeywords.test.ts` — drift 21 → 22
8. `setup/heroAbility.setup.ts` — `tryResolveDrawOrEmpoweredLine` pre-pass + dispatch + suppression
9. `setup/heroAbility.setup.test.ts` — draw-or-empowered parse tests + core/fight-or-flight baseline pin
10. `hero/heroEffects.execute.ts` — `'draw-or-empowered'` onPlay park case (+ HANDLED/parks-pending lists)
11. Block-all guards (7 of: `coreMoves.impl.ts`, `fightVillain.ts`, `fightMastermind.ts`, `recruitHero.ts`, `villainDeck.reveal.ts`, `dodgeCard.ts`, `playFromUndercover.ts`)
12. `simulation/ai.legalMoves.ts` — short-circuit + deterministic `'empowered'`
13. `game.ts` — move registration + `advanceStage` guard (register last to avoid spurious move-set failures)
14. `game.test.ts` — move count N+1 + move-name set

**Checkpoint:** run `pnpm --filter @legendary-arena/game-engine test` after step 6 and again after step 14. Red → diagnose before continuing.

---

## Required `// why:` Comments

- `drawOrEmpowered.resolve.ts`:
  - lazy-init / gate: `// why: pendingDrawOrEmpowered is lazy-init (D-24069); undefined and [] both mean no pending choice`
  - block-all gate at move top: `// why: block-all guard — no other move may fire while a draw-or-empowered choice is outstanding (D-24069)`
  - empowered branch reuse: `// why: reuse the empowered composition (no re-implementation of the count); same amount the core path grants (D-24069)`
- `hero/heroEffects.execute.ts` park site: `// why: parks an interactive draw-or-empowered choice resolved by resolveDrawOrEmpowered (D-24069)`
- each of the 8 guard sites: `// why: block-all — pendingDrawOrEmpowered must be resolved before any other action (D-24069)`
- `simulation/ai.legalMoves.ts` bot default: `// why: deterministic bot default — always empowered; an expected-value default is deferred (D-24069)`
- `setup/heroAbility.setup.ts` pre-pass suppression: `// why: draw-or-empowered pre-pass resolved the line; suppress the per-token empowered dispatch (D-24069)`

---

## Files to Produce

**New files:**
- `packages/game-engine/src/moves/drawOrEmpowered.resolve.ts`
- `packages/game-engine/src/moves/drawOrEmpowered.resolve.test.ts`

**Modified (game engine):**
- `packages/game-engine/src/types.ts`
- `packages/game-engine/src/rules/heroKeywords.ts`
- `packages/game-engine/src/rules/heroKeywords.test.ts`
- `packages/game-engine/src/rules/heroAbility.types.ts`
- `packages/game-engine/src/setup/heroAbility.setup.ts`
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` <!-- Amendment A: corrected path — the draft listed `setup/`; the parser test file actually lives in `rules/` (same file intent). -->
- `packages/game-engine/src/hero/heroEffects.execute.ts`
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` <!-- Amendment A: added — forced drift-test maintenance (handler count 9→10) + an AC-5 park test; same class as the listed game.test.ts / heroKeywords.test.ts drift updates. -->
- `packages/game-engine/src/game.ts`
- `packages/game-engine/src/moves/coreMoves.impl.ts`
- `packages/game-engine/src/moves/fightVillain.ts`
- `packages/game-engine/src/moves/fightMastermind.ts`
- `packages/game-engine/src/moves/recruitHero.ts`
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts`
- `packages/game-engine/src/moves/dodgeCard.ts`
- `packages/game-engine/src/moves/playFromUndercover.ts`
- `packages/game-engine/src/game.test.ts`
- `packages/game-engine/src/simulation/ai.legalMoves.ts`
- `packages/game-engine/src/simulation/simulation.runner.ts` <!-- Amendment B: added — dispatch resolveDrawOrEmpowered in the sim MOVE_MAP (the sweep hangs otherwise). -->
- `packages/game-engine/src/simulation/par.aggregator.ts` <!-- Amendment B: added — same MOVE_MAP dispatch (RS-10 duplicate). -->

**Modified (card data):**
- `data/cards/antm.json`
- `scripts/convert-cards/inputs/cards/antman.js`

**Governance (govern-close, not implementation):**
- `docs/ai/DECISIONS.md` (D-24069 + D-24070 Active)
- `docs/ai/work-packets/WORK_INDEX.md` (WP-286 Done)
- `docs/ai/execution-checklists/EC_INDEX.md` (EC-318 Done)
- `docs/ai/STATUS.md` (execution summary)
- `docs/05-ROADMAP-MINDMAP.md` (WP-286 node)

---

## Required Test Coverage

`drawOrEmpowered.resolve.test.ts` MUST include at minimum these 7 tests (a green suite without them does not satisfy the DoD):

- [ ] `{ choice: 'draw' }`: front player draws exactly 1 card; front entry popped
- [ ] `{ choice: 'empowered' }`: grants the same amount as the core empowered path for that board; front entry popped
- [ ] `hasPendingDrawOrEmpowered`: `false` for `undefined` and `[]`, `true` for non-empty
- [ ] invalid `choice`: `G` entirely unmutated
- [ ] front `playerID` mismatch: `G` unmutated, queue intact
- [ ] FIFO: ≥2 entries, first resolve consumes `[0]`; `[1]` untouched
- [ ] queue shift: after a successful resolve, length is exactly `startLength - 1`

---

## After Completing

- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 — count ≥ baseline + 12
- [ ] `pnpm -r build && pnpm test` — green
- [ ] `pnpm --filter @legendary-arena/game-engine exec tsc --noEmit` — 0 errors
- [ ] Spot-check: `hasPendingDrawOrEmpowered` imported in all 8 guard sites
- [ ] Spot-check: `"Chose one"` returns zero matches in `data/cards/antm.json`
- [ ] Spot-check: `HERO_KEYWORDS.length === 22`; `resolveDrawOrEmpowered` in `game.ts` registration
- [ ] Infrastructure WP — STATUS.md states "No user-observable change — infrastructure only; bot-resolved until WP-287; MUST NOT deploy without WP-287"
- [ ] Governance close — `SPEC:` commit with DECISIONS, WORK_INDEX, EC_INDEX, STATUS, mindmap

---

## Common Failure Smells

- **`heroKeywords.test.ts` still at 21** — update the drift test when adding the keyword.
- **`game.test.ts` move count stale** — the move-set drift test asserts exact count.
- **One-Hit Wonder still applies empowered with no choice** — the typo fix or the pre-pass ordering is wrong; the pre-pass must run before `tryResolveEmpoweredCore` and suppress it.
- **fight-or-flight or the synthetic core form regressed** — the new pre-pass is not gated tightly enough (must require "Draw a card" + exactly one empowered marker); AC-4 pins both.
- **`Game.setup()` initializes `pendingDrawOrEmpowered`** — must be lazy-init only.
- **Guard site uses inline `G.pendingDrawOrEmpowered?.length`** — must call `hasPendingDrawOrEmpowered`.
- **`finalStateHash` changes** — sentinel unexpectedly includes an `antm` card. STOP; do not re-baseline.

---

## Amendments (execution)

**Amendment A (2026-06-24, execution — EC-318 commit `4203f050`).** Two allowlist
corrections, both forced drift-test maintenance directly caused by in-scope changes
(no scope expansion):

1. The Files-to-Produce entry `setup/heroAbility.setup.test.ts` was a path typo — the
   parser test file lives at `rules/heroAbility.setup.test.ts` (where the empowered
   parser tests already are; EC-317 listed it correctly). The corrected file was edited
   (drift count 21→22 + the draw-or-empowered parse tests + the AC-3/AC-4 pins).
2. `hero/heroEffects.execute.test.ts` was **not** listed but had to be edited: adding the
   `draw-or-empowered` handler moves the pinned handler count 9→10 (the bidirectional
   `HERO_EFFECT_HANDLERS` ↔ `HANDLED_KEYWORDS` drift test), which goes red otherwise. The
   same edit adds an AC-5 park test (mirroring the WP-285 victory-villain-attack park test
   in that file). This is the same drift-maintenance class as the already-listed
   `game.test.ts` (move count) and `heroKeywords.test.ts` (keyword count) updates — the
   allowlist should have included it up front (move-registration drift-test memo).

**Amendment B (2026-06-24, execution — EC-318 commit `016c50fe`). Sim move-dispatch
wiring (01.5 runtime allowance).** The competent simulation sweep
(`sim:runtime-observed:check`, a blocking CI gate) hung in an infinite loop. Root
cause: `antm/wonder-man` is in the sweep's hero-deck sets, so One-Hit Wonder is
played, and the new `draw-or-empowered` choice parks **unconditionally** → the
block-all guard freezes the board and `getLegalMoves` returns ONLY
`resolveDrawOrEmpowered`. But the simulation/PAR move-dispatch maps (`MOVE_MAP`) held
only the 8 core gameplay moves — **no resolve moves** — so the move was skipped as
"unknown" and the choice never cleared (`maxTurns` bounds turns, not within-turn
move-steps). Fix: dispatch `resolveDrawOrEmpowered` in both `getLegalMoves`-driven
loops — `simulation.runner.ts` MOVE_MAP and `par.aggregator.ts` MOVE_MAP (neither in
the original allowlist; the WP/EC did not anticipate the sim dispatch surface). The
sibling resolve moves (`resolveOptionalKoReward` / `resolveVictoryPileCardPick` /
`resolveKoHeroChoice`) were never hit because their pending choices need preconditions
a sweep rarely triggers — draw-or-empowered is the first to park unconditionally.

**Flagged (out of scope — pre-existing systemic gap):** the four engine move-dispatch
maps (`simulation.runner.ts`, `par.aggregator.ts`, `replay/replay.execute.ts`,
`test/fixtures/runFixture.ts`) all omit **every** resolve move. The replay maps were
left unchanged here (no recorded fixture contains `resolveDrawOrEmpowered`), and there
is no unit-level guard that the sim MOVE_MAP covers every `getLegalMoves`-emittable
move — only the sweep CI gate catches it, and only for cards in its hero-deck sets. A
follow-up should add resolve-move dispatch coverage + a drift guard; tracked outside
WP-286.
