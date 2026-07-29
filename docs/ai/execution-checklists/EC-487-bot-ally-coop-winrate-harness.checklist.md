# EC-487 — Co-op Win-Rate + Loss-Cause Harness (Execution Checklist)

**Source:** docs/ai/work-packets/WP-452-bot-ally-coop-winrate-harness.md
**Layer:** Game Engine (simulation)

## Before Starting
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `runSimulation` exported from `simulation.runner.ts`; internal `GameOutcome`
      has `isHeroesWin` / `endgameReached` / `endgameWinner` / `escapedVillains`
- [ ] `runSimulation` / `simulateOneGame` take a non-optional `registry: CardRegistryReader`
      second param; `CardRegistryReader` exported from `matchSetup.validate.ts`;
      `createRegistryFromLocalFiles` in `packages/registry/dist/index.js`
- [ ] `ESCAPE_LIMIT` + `EndgameOutcome` exported from `endgame/endgame.types.ts`
- [ ] Target file set is EXACTLY the `Files to Produce` list below; any file
      outside it is a FAIL — surface as a blocker, do not touch

## Locked Values (do not re-derive)
- `COOP_OUTCOME_CATEGORIES` (exact order, 5): `'win'`, `'loss-scheme-completed'`,
  `'loss-villains-escaped'`, `'loss-tie'`, `'inconclusive-turn-cap'`
- `EndgameOutcome` union: `'heroes-win' | 'scheme-wins' | 'tie'`
- Escape threshold: import `ESCAPE_LIMIT` — never a numeric literal
- Classify order: win → turn-cap (`!endgameReached`) → tie → (scheme-wins) escaped-vs-completed
- Signatures (registry is an explicit param, mirroring `runSimulation`):
  `runCoopWinRate(config, registry: CardRegistryReader)`,
  `simulateOneCoopGame(matchConfiguration, registry, policy, seed, numPlayers)`
- Registry loader (script only): `createRegistryFromLocalFiles` from `packages/registry/dist/index.js`
- Fresh policy per seed: `create{Random,Competent}Policy(seed)` — one new instance per seed
- Empty-seeds guard: empty `seeds` → zeroed report (`games:0, wins:0, winRate:0`, all `byCategory` 0), never `NaN` (mirror `runSimulation`'s `zeroedResult`)

## Guardrails
- Do NOT alter `runSimulation`'s existing signature/return — additive
  `simulateOneCoopGame` projection export only (smallest-seam, like `CapturedOutcomeSummary`)
- Do NOT re-implement the per-turn loop — reuse the existing runner path
- No `.reduce()` with branching; aggregate with explicit `for...of`
- No `boardgame.io` / `registry` / `server` / `preplan` / `pg` import anywhere in scope
- No `Math.random()`; the harness adds no randomness (seed-deterministic via the runner)
- Engine harness imports ONLY the `CardRegistryReader` TYPE (from `matchSetup.validate.ts`),
  NEVER `@legendary-arena/registry` / `packages/registry`; the `.mjs` supplies the reader
- Fresh policy instance per seed (position-independent) — never reuse one policy across the seed list
- NO committed artifact and NO CI freshness gate (D-24272) — the harness prints only
- Guard/drift test is non-vacuous: assert the array's exact 5 members AND that a
  synthetic bad category name is absent; test the `ESCAPE_LIMIT - 1` boundary explicitly

## Required `// why:` Comments
- `coopOutcome.ts` turn-cap branch: why `!endgameReached` is inconclusive (stall / too slow), not a loss
- `coopOutcome.ts` scheme-wins branch: the load-bearing invariant — `evaluateEndgame` ends on the
  FIRST tripped condition, so `escapedVillains >= ESCAPE_LIMIT` at a `scheme-wins` terminal iff
  escape-overrun triggered; same-turn double-trip is a known accepted proxy limitation
- `coopWinRate.ts` policy construction: why a fresh policy per seed (stateful decision PRNG → position-independence)
- `simulation.runner.ts` new export: why the projection is narrow (does not widen the internal `GameOutcome` seam)

## Files to Produce
- `packages/game-engine/src/simulation/coopOutcome.ts` — **new** — classifier + canonical array
- `packages/game-engine/src/simulation/coopOutcome.test.ts` — **new** — classifier + drift tests
- `packages/game-engine/src/simulation/coopWinRate.ts` — **new** — aggregating harness
- `packages/game-engine/src/simulation/coopWinRate.test.ts` — **new** — aggregation + determinism tests
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — additive `simulateOneCoopGame` only
- `packages/game-engine/src/index.ts` — **modified** — additive harness exports
- `scripts/coop-winrate.mjs` — **new** — operator entrypoint (loads the real registry via `createRegistryFromLocalFiles`)
- `package.json` (root) — **modified** — `sim:coop-winrate` alias (beside `sim:coverage`)

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `git diff` confirms `runSimulation`'s existing export unchanged
- [ ] `node scripts/coop-winrate.mjs` prints a report; baseline win rate recorded in STATUS
- [ ] Live-on-surface: N/A — `none — infrastructure`; STATUS states "No user-observable change — infrastructure only"
- [ ] `docs/ai/STATUS.md` updated (baseline number + payoff)
- [ ] `docs/ai/DECISIONS.md` — D-24272 landed
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-452 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` glyph `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- A hardcoded escape threshold (e.g. `>= 8`) instead of `ESCAPE_LIMIT` → drift when the limit changes
- Editing `runSimulation`'s return to add loss causes → breaks the byte-stable aggregate contract; add a sibling projection instead
- `byCategory` counts not summing to `games` → a branch fell through the classifier (missing category)
- An engine module (`coopWinRate.ts` / `simulation.runner.ts`) importing the registry package → engine↔registry layer violation (import only the TYPE)
- Reusing one policy instance across seeds → per-game records become position-dependent (a determinism trap)
