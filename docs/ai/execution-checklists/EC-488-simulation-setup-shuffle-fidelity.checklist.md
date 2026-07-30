# EC-488 — Simulation Setup Deck Shuffle Fidelity (Execution Checklist)

**Source:** docs/ai/work-packets/WP-453-simulation-setup-shuffle-fidelity.md
**Layer:** Game Engine (simulation + test fixtures)

## Before Starting
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (capture the baseline totals)
- [ ] `simulation.runner.ts` has `shuffleWithPrng` + per-game `nextRandom`; its 3 setup
      sites (`simulateOneGame`, `simulateOneCoopGame`, `simulateOneGameAndCaptureMoves`)
      call `makeMockCtx({ numPlayers })`
- [ ] `par.aggregator.ts` has its own `shuffleWithPrng` + `nextRandom`; 1 setup site on `makeMockCtx`
- [ ] `runFixture.ts` has local `shuffleWithPrng` (~119) + `nextRandom` from
      `fixture.input.seed` (~359); setup context on `makeMockCtx` (~361)
- [ ] `sentinel-core-doom-2p.replay.json` is the ONLY committed replay fixture; `scripts/record-game-fixture.mjs` regenerates it
- [ ] Target file set is EXACTLY the `Files to Produce` list; any file outside it is a FAIL — surface as a blocker

## Locked Values (do not re-derive)
- Setup-context shape (unchanged from `makeMockCtx`): `{ ctx: { numPlayers }, random: { Shuffle } }`
- Setup `Shuffle` body: `<T>(deck: T[]): T[] => shuffleWithPrng(deck, nextRandom)` — each file's EXISTING local `shuffleWithPrng` + the `nextRandom` already in scope (no new PRNG, no changed seed literal/algorithm)
- **Runner helper (test-reachability extraction, IN scope):** `makeSeededSetupContext(numPlayers: number, nextRandom: () => number): SetupContext` in `simulation.runner.ts`, **module-exported** (imported by the regression test) but **NOT added to `index.ts`** (not package-public API). The 3 runner sites call it; `par.aggregator` + `runFixture` build the same-shaped context INLINE with their own `shuffleWithPrng` (no import of the runner helper — par isolated per RS-10, runFixture is test-layer)
- **par.aggregator RS-1 hoist:** move `const nextRandom = createMulberry32(hashSeedString(perGameSeed))` ABOVE the setup-context construction (site ~525 currently precedes the `nextRandom` at ~528) — relocation only, seed/algorithm unchanged. The other 4 sites already have `nextRandom` in scope
- Setup sites to convert (5): runner `simulateOneGame` (run-level `nextRandom` param) / `simulateOneCoopGame` / `simulateOneGameAndCaptureMoves`; `par.aggregator` `simulateOneGame`; `runFixture` `executeOnce`
- `makeMockCtx` (`test/mockCtx.ts`): **byte-unchanged** — do NOT edit
- `PRE_WP080_HASH` (`replay.execute.test.ts`): **byte-unchanged** — do NOT edit
- Regression test access path (LOCKED): import `makeSeededSetupContext` from `./simulation.runner.js` (sibling — `./`, not `../`), drive its `Shuffle` with a controlled deterministic `nextRandom` STUB; assert ≠ identity AND ≠ reverse AND scheme-twist ids not contiguous at top; deterministic per stub state. FORBIDDEN: re-implementing mulberry32/Fisher–Yates in the test and asserting on a private copy (vacuous)
- Fixture-reading guard is `replayFixtures.test.ts` ONLY; `hashGameState.test.ts` tests the hash fn on synthetic states and does not load the fixture
- Twist proxy is faithful (D-24178): do NOT touch `schemeTwistHandler` / `lossThreshold` / `evaluateEndgame`

## Guardrails
- Do NOT modify `makeMockCtx` — ~190 importers + determinism/replay-hash pins; editing it is a FAIL
- Recorder (`simulateOneGameAndCaptureMoves`) and replay (`runFixture`) MUST use the identical seeded setup shuffle — change them together or the capture→replay round-trip breaks
- Re-record `sentinel-core-doom-2p.replay.json` via `scripts/record-game-fixture.mjs` — never hand-edit the `expected` block / `finalStateHash`
- Reuse each file's existing `shuffleWithPrng` + `nextRandom` — no new Fisher–Yates / PRNG, no changed seed literal. The ONLY new symbol is `makeSeededSetupContext` in `simulation.runner.ts` (module export, NOT `index.ts`); `par.aggregator` + `runFixture` do NOT import it (inline their own context)
- The regression test drives `makeSeededSetupContext` with a controlled `nextRandom` stub — it must NOT re-implement mulberry32/Fisher–Yates and assert on its own copy (vacuous: would pass even if a site reverted to `makeMockCtx`)
- No `Math.random()`, no `boardgame.io` / `registry` / `server` / `preplan` / `pg` import in any changed file
- The regression test is registry-free (game-engine layer must not import the registry package)
- Drop the now-unused `makeMockCtx` import from all three TS files; confirm zero `makeMockCtx` matches in them post-change

## Required `// why:` Comments
- The converted setup sites (chiefly the runner's `makeSeededSetupContext`): why the seeded `shuffleWithPrng` replaces the reverse mock — reversing the lexically-sorted deck clusters all `scheme-twist-*` ids on top (they sort last), which chained-reveal schemes cascade into a turn-0 SCHEME_LOSS and which front-loads twists for every scheme. (Write the comment with the words "reverse mock", NOT the literal token, so Verification Step 2's grep stays clean.)
- `runFixture` setup site: additionally note this must match the recorder's setup shuffle (capture→replay lockstep)
- Regression test: why "not contiguous at top" is the direct guard for the reverse-mock cluster

## Files to Produce
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — 3 setup sites → seeded; drop `makeMockCtx` import
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — 1 setup site → seeded; drop `makeMockCtx` import
- `packages/game-engine/src/test/fixtures/runFixture.ts` — **modified** — setup site → seeded; drop `makeMockCtx` import
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified** — re-recorded via `scripts/record-game-fixture.mjs`
- `packages/game-engine/src/simulation/simulation.setupShuffle.test.ts` — **new** — seeded-shuffle regression + determinism guards (imports `makeSeededSetupContext`)
- `docs/05-ROADMAP-MINDMAP.md` — **modified at govern-close** — glyph `📝`→`✅` + `roadmap:counts:write` (listed per EC-TEMPLATE roadmap rule; governance ledger, not a code deliverable)

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (`--no-bail` totals recorded)
- [ ] `git diff` confirms `makeMockCtx` + `PRE_WP080_HASH` byte-unchanged
- [ ] `Select-String makeMockCtx` over the 3 TS files returns nothing
- [ ] `node scripts/coop-winrate.mjs` (or scoped run) shows the two schemes no longer auto-lose at turn 0; baseline recorded in STATUS
- [ ] Live-on-surface: N/A — `none — infrastructure`; STATUS states "No user-observable change — infrastructure only"
- [ ] `docs/ai/STATUS.md` updated (post-fix baseline + payoff)
- [ ] `docs/ai/DECISIONS.md` — D-24273 landed
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-453 checked off with date
- [ ] `docs/05-ROADMAP-MINDMAP.md` glyph `📝`→`✅`, then `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0

## Common Failure Smells
- Editing `makeMockCtx` to "fix it there" → breaks ~190 importers + `buildInitialGameState.determinism.test.ts` + `PRE_WP080_HASH`; the fix is local to the sim/fixture setup sites only
- Changing the recorder but not `runFixture` (or vice versa) → `simulation.captureMoves.test.ts` round-trip fails on deck-order divergence
- Hand-editing the fixture `finalStateHash` instead of re-recording → drift the next run can't reproduce
- Re-implementing Fisher–Yates or extracting a shared helper → out of scope; reuse the existing local `shuffleWithPrng`
- Leaving `par.aggregator`'s setup on the reverse mock → a second reverse-shuffle path silently diverges from real play
- A regression test that re-implements the PRNG/shuffle and asserts on its own copy → vacuous; it passes even if a setup site reverts to `makeMockCtx`. Drive the real `makeSeededSetupContext` with a controlled `nextRandom` stub
- Placing the `par.aggregator` seeded closure before its `nextRandom` const → TDZ `ReferenceError`; hoist `nextRandom` above the setup context first
