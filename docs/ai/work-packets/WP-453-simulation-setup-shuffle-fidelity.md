# WP-453 — Simulation Setup Deck Shuffle Fidelity (Seeded, Not Reverse-Mock)

**Status:** Ready
**Primary Layer:** Game Engine / Implementation (simulation + test fixtures)
**Dependencies:** WP-452 ✅ (co-op harness that surfaced the artifact); WP-036 ✅ (`shuffleWithPrng`); WP-411 ✅ (`evaluateEndgame`)
**User-Visible Surface:** none — infrastructure

> Behavior-identical to production gameplay: this WP changes only how the
> **offline simulation / fixture** paths shuffle the deck at setup. Production
> already shuffles with boardgame.io's real seeded PRNG and is untouched. No
> player, visitor, or operator observes any change. (D-24026)

---

## Session Context

WP-452 (`0e1ae88c`) landed the co-op win-rate + loss-cause harness and, at
execution, surfaced a defect it had to work around: the pinned scheme was swapped
from `core/midtown-bank-robbery` to `core/legacy-virus-the` because
`midtown-bank-robbery` and `negative-zone-prison-breakout` trip a `SCHEME_LOSS`
endgame at **turn 0** — an auto-loss before any move — and the WP-452 execution
note explicitly **flagged this for a follow-up**. This is that follow-up.

Investigation (2026-07-29) found the root cause is **not** in scheme setup and
**not** a 0/undefined loss threshold. `buildInitialGameState` leaves `G.counters
= {}` and `evaluateEndgame(G) = null` at initial state for every scheme, the two
"failing" schemes included. The turn-0 loss is a **simulation-harness shuffle
artifact**, described in full under §Context.

---

## Goal

After this session, every **simulation** setup path and the **fixture-replay**
harness shuffle the setup deck with the run's **seeded mulberry32 Fisher–Yates**
(`shuffleWithPrng`, the same PRNG domain the per-turn reveal loop already uses) —
not the `makeMockCtx` reverse mock. This distributes scheme-twist cards through
the villain deck the way a real shuffle does, eliminating the turn-0 cascade
auto-loss on chained-reveal schemes and making the WP-452 co-op win-rate yardstick
measure bot skill rather than a deterministic reverse-order artifact.

---

## User-Visible Impact

None — infrastructure. Production gameplay is unchanged (it never used the reverse
mock). The payoff is a trustworthy simulation/PAR/co-op-yardstick surface and the
removal of a class of degenerate turn-0 auto-losses in simulated games.

---

## Assumes

- `pnpm --filter @legendary-arena/game-engine build` exits 0 and
  `pnpm --filter @legendary-arena/game-engine test` exits 0 on the baseline.
- `packages/game-engine/src/simulation/simulation.runner.ts` defines
  `shuffleWithPrng(deck, nextRandom)` (WP-036) and constructs a per-game
  `nextRandom = createMulberry32(hashSeedString(seed))`; its three setup sites
  (`simulateOneGame`, `simulateOneCoopGame`, `simulateOneGameAndCaptureMoves`)
  currently call `makeMockCtx({ numPlayers })` to build the setup context.
- `packages/game-engine/src/simulation/par.aggregator.ts` has its own local
  `shuffleWithPrng` + `nextRandom` and one setup site calling `makeMockCtx`
  (RS-10 deliberate duplication per WP-036 scope lock). **Ordering wrinkle
  (pre-flight RS-1):** its `makeMockCtx` setup site (~525) precedes the
  `nextRandom = createMulberry32(hashSeedString(perGameSeed))` construction
  (~528). A seeded setup shuffle is invoked synchronously during
  `buildInitialGameState`, so the `nextRandom` const MUST be **hoisted above**
  the setup-context construction — a statement relocation only, not a change to
  the seed literal or PRNG algorithm.
- Each runner setup site has a `nextRandom` in scope before setup: for
  `simulateOneGame` it is the **run-level** closure passed in as a parameter (not
  a per-game construction); `simulateOneCoopGame` and
  `simulateOneGameAndCaptureMoves` construct it locally before the setup site.
- `packages/game-engine/src/test/fixtures/runFixture.ts` already has a local
  `shuffleWithPrng` (line ~119) + `nextRandom = createMulberry32(hashSeedString(
  fixture.input.seed))` (line ~359), uses `shuffleWithPrng` for per-move reveals,
  but calls `makeMockCtx` for the **setup** context (line ~361).
- `buildInitialGameState` consumes `setupContext.random.Shuffle` for every
  setup-time shuffle (villain deck, hero decks, piles) via `setup/shuffle.ts`.
- The **only** committed replay fixture is
  `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json`;
  its pinned `finalStateHash` lives **inside the JSON** and the fixture-reading
  guard is **`replayFixtures.test.ts` only** (it `readdir`/`readFile`s the JSON and
  asserts `fixture.expected.*` — no hardcoded hash in test code). `hashGameState.test.ts`
  tests the `hashGameState` function on synthetic states and does **not** load the
  fixture — it is unaffected by the re-record.
- `scripts/record-game-fixture.mjs` regenerates that fixture from the built dist.
- No committed PAR artifact and no PAR CI `:check` gate exist (PAR is disk-only
  tooling output).

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

The mechanism, reproduced end-to-end 2026-07-29:

1. `buildVillainDeck` (`villainDeck.setup.ts`) **lexically sorts** the assembled
   deck before shuffling, for deterministic pre-shuffle ordering. Virtual
   `scheme-twist-<slug>-NN` ids sort **last** (s > m > h > c > b vs
   `master-strike-`, `henchman-`, `core-villain-`, `bystander-`).
2. The simulation setup path builds its `SetupContext` via `makeMockCtx`, whose
   `random.Shuffle` is `(deck) => [...deck].reverse()` — a deterministic reverse
   the **unit tests** rely on to prove shuffle ran. Reversing a list whose twists
   are at the bottom deterministically stacks **all** scheme-twists on **top** of
   the villain deck (verified: top 8 = `scheme-twist-…-07..00`).
3. `core/midtown-bank-robbery` and `core/negative-zone-prison-breakout` are the
   only two core schemes whose twist resolver **chains extra villain reveals**
   (`performVillainReveal`). The turn-1 twist reveals the next twist, which chains
   the next … cascading through all 8 clustered twists in one reveal;
   `schemeTwistHandler` increments `schemeTwistCount` each time until it hits the
   `lossThreshold: 8` doom-clock proxy (D-24178) → `schemeLoss` → `evaluateEndgame`
   returns `scheme-wins` at turn 0.
4. Non-chaining schemes are hit by the same clustering more mildly (one
   top-of-deck twist revealed per turn → loss around turn 8), so the reverse mock
   **front-loads twists for every scheme**, systematically depressing simulated
   win rates. The WP-452 baseline (0.0% over 60 seeds on `legacy-virus-the`) is a
   likely victim; this WP does not predict the post-fix number — the executor
   measures it.

Fix: point the **simulation** setup context and the **fixture-replay** setup
context at the seeded `shuffleWithPrng(deck, nextRandom)` each file already owns.
A real Fisher–Yates distributes twists (verified: 1 in top 10; `evaluateEndgame`
null at init; game plays past turn 0). Production is unaffected — boardgame.io
supplies the real seeded PRNG shuffle in the live engine.

Read before writing:
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — this is all Game
  Engine layer; import nothing from `registry` / `server` / `preplan` / `pg`.
- `docs/ai/DECISIONS.md D-24178` — the twist doom-clock proxy is **faithful and
  out of scope**; this WP does not touch twist counting or thresholds.
- `packages/game-engine/src/simulation/simulation.runner.ts`,
  `par.aggregator.ts`, `packages/game-engine/src/test/fixtures/runFixture.ts` —
  read the setup sites and the existing `shuffleWithPrng` usage entirely.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4, 6, 8, 9, 13.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Never use `Math.random()` — shuffles derive from the existing seeded mulberry32.
- Never throw inside boardgame.io move functions — N/A (no moves touched).
- Never persist `G` / `ctx`; `G` stays JSON-serializable.
- ESM only, Node v22+, `node:` prefix on built-ins; `.test.ts` for tests.
- No database or network access.
- Human-style code per `00.6`; full file contents for every changed file.

**Packet-specific (load-bearing):**
- **Do NOT modify `makeMockCtx`** (`packages/game-engine/src/test/mockCtx.ts`).
  Its reverse-shuffle is a deliberate "shuffle ran" proof relied on by ~190
  importers and pinned by `buildInitialGameState.determinism.test.ts` and
  `replay.execute.test.ts` (`PRE_WP080_HASH`). Editing it is a FAIL.
- **Recorder ↔ replay lockstep:** `simulateOneGameAndCaptureMoves` (recorder
  setup) and `runFixture` (replay setup) MUST use the **identical** seeded setup
  shuffle. Changing one without the other breaks the capture→replay contract
  (`simulation.captureMoves.test.ts` round-trip). They move together.
- **Re-record, don't hand-edit** the sentinel fixture. Regenerate
  `sentinel-core-doom-2p.replay.json` via `scripts/record-game-fixture.mjs`; the
  new `finalStateHash` / `messages` / `snapshotPerTurn` / `outcome` are whatever
  the seeded-shuffle replay produces.
- **`PRE_WP080_HASH` (`replay.execute.test.ts`) MUST stay byte-identical** — it
  uses `makeMockCtx` directly and proves the mock was untouched.
- The seeded shuffle reuses each file's **existing** `shuffleWithPrng` and the
  `nextRandom` already in scope. Do NOT re-implement Fisher–Yates, introduce a new
  PRNG, or change any `nextRandom` **seed literal / algorithm**. The only permitted
  relocation is the par.aggregator `nextRandom` hoist (RS-1 above).
- **One narrow extraction is IN scope, for test reachability:** a small
  `makeSeededSetupContext(numPlayers, nextRandom)` builder in
  `simulation.runner.ts`, **exported at module scope** (imported by the regression
  test) but **NOT re-exported from `index.ts`** — it is not package-public API. The
  three runner setup sites call it. `par.aggregator.ts` and `runFixture.ts` build
  the same-shaped context **inline** with their own local `shuffleWithPrng` (par is
  isolated per RS-10; runFixture is the test-fixture layer) — they do NOT import the
  runner helper.
- Twist counting, `lossThreshold`, `schemeTwistHandler`, and `evaluateEndgame`
  are **out of scope** — the doom-clock proxy is faithful (D-24178).

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask — never guess.

---

## Debuggability & Diagnostics

Every simulated game remains fully reproducible: identical `(config, seed)` yields
a byte-identical result, now under a real seeded shuffle. The regression test
asserts the setup shuffle is a seeded PRNG shuffle (not reverse) and is
deterministic across runs of the same seed.

---

## Scope (In)

### A) Simulation runner setup sites — `src/simulation/simulation.runner.ts` (modified)
Add a small **module-exported** builder `makeSeededSetupContext(numPlayers:
number, nextRandom: () => number): SetupContext` that returns `{ ctx: { numPlayers
}, random: { Shuffle: <T>(deck: T[]): T[] => shuffleWithPrng(deck, nextRandom) } }`
— the exact shape `makeMockCtx` returned, but seeded. Export it at module scope
(for the regression test) but do **NOT** add it to `index.ts` (not package-public
API). Replace the reverse-mock setup context at the three setup sites
(`simulateOneGame`, `simulateOneCoopGame`, `simulateOneGameAndCaptureMoves`) with a
call to it, passing the `nextRandom` already in scope (run-level param for
`simulateOneGame`; locally-constructed for the other two). Remove the now-unused
`makeMockCtx` import. A `// why:` comment on the builder states the seeded shuffle
replaces the reverse mock so setup deck order is representative (twists
distributed, not clustered on top).

### B) PAR aggregator setup site — `src/simulation/par.aggregator.ts` (modified)
Same swap at its one setup site, building the context **inline** with its own
local `shuffleWithPrng` + `nextRandom` (isolated per RS-10 — do not import the
runner helper). **Hoist** the `nextRandom = createMulberry32(hashSeedString(
perGameSeed))` const **above** the setup-context construction (RS-1) so the seeded
closure has `nextRandom` in scope when `buildInitialGameState` invokes Shuffle.
Remove the now-unused `makeMockCtx` import. Included so no second reverse-shuffle
setup path is left behind (no committed PAR artifact/gate exists — nothing to
re-pin).

### C) Fixture replay setup site — `src/test/fixtures/runFixture.ts` (modified)
Replace the setup-context `makeMockCtx` (line ~361) with a context whose
`random.Shuffle` delegates to the existing local `shuffleWithPrng(deck,
nextRandom)` — the `nextRandom` already constructed from `fixture.input.seed` at
line ~359. Remove the now-unused `makeMockCtx` import. This is the lockstep
partner of the recorder change in (A).

### D) Re-recorded sentinel fixture — `src/test/fixtures/games/sentinel-core-doom-2p.replay.json` (modified)
Re-record via `scripts/record-game-fixture.mjs` after (A)/(C) land, so its
`expected` block (`finalStateHash`, `messages`, `snapshotPerTurn`, `outcome`)
reflects the seeded-shuffle replay. `replayFixtures.test.ts` + `hashGameState.test.ts`
re-pass against the re-recorded JSON (they read the fixture's own fields — no test
code edit expected).

### E) Regression test — `src/simulation/simulation.setupShuffle.test.ts` (new)
`node:test` guards, registry-free (the game-engine layer must not import the
registry). **Access path (locked):** import `makeSeededSetupContext` from
`./simulation.runner.js` (sibling module — `./`, not `../`) and drive its real `Shuffle` with a **controlled,
deterministic `nextRandom` stub** supplied by the test (e.g. a fixed sequence /
counter — a legitimate INPUT to the builder). **FORBIDDEN:** re-implementing
mulberry32 or Fisher–Yates inside the test and asserting on the test's own copy
(that would pass even if a setup site reverted to `makeMockCtx` — vacuous).
- **Not-reverse, not-identity, not-clustered:** shuffle a lexically-sorted input
  whose last N entries are `scheme-twist-…` ids through
  `makeSeededSetupContext(2, stubNextRandom).random.Shuffle`; assert the result is
  neither the identity nor the reverse, and that the `scheme-twist` ids are **not
  all contiguous at the top** (the exact clustering the reverse mock produced).
  This is the direct regression guard for the bug.
- **Determinism:** the same stub-`nextRandom` state produces a byte-identical
  shuffle; a different `nextRandom` sequence produces a different order.
- **Wiring is additionally guarded** (not by this test) by the AC grep (zero
  `makeMockCtx` in the three touched files → the sites call the seeded builder /
  inline seeded context) and by the re-recorded fixture + `simulation.captureMoves.test.ts`
  round-trip (a reverted `runFixture` would break replay).

---

## Out of Scope

- **`makeMockCtx` itself** — untouched (unit-test invariant; ~190 importers +
  determinism/replay-hash pins).
- **`replay.execute.ts` / `PRE_WP080_HASH`** — untouched; must stay byte-identical.
- **Twist counting / `lossThreshold` / `schemeTwistHandler` / `evaluateEndgame` /
  D-24178 doom-clock semantics** — faithful, not this WP's concern.
- **Production engine shuffle** (boardgame.io) — already correct.
- **`runSimulation`'s aggregate return contract / `GameOutcome` shape** — the
  values it computes shift, but its shape/signature does not change.
- **PAR artifact/gate work** — none exists; none added.
- Any refactor or "while I'm here" cleanup outside Scope (In), including extracting
  a shared `shuffleWithPrng`.

---

## Vision Alignment

> `docs/01-VISION.md §17` determinism trigger surfaces are touched (this changes a
> simulation/replay shuffle), so this block is required.

- **§22 Replay / determinism — preserved and improved.** The change swaps one
  deterministic shuffle (reverse) for another deterministic, seeded shuffle
  (mulberry32 Fisher–Yates) already used by the same code for reveals. Every
  simulated game and every fixture replay stays fully reproducible from
  `(config, seed)`. The recorder and replay harness are changed in lockstep so
  the capture→replay contract holds; the sentinel fixture is re-recorded, not
  hand-edited. `makeMockCtx` and `PRE_WP080_HASH` are untouched, so the
  determinism-forensic and unit-test surfaces are byte-stable.
- **§20–26 Scoring / PAR / leaderboards — NOT crossed.** No committed PAR artifact
  or competitive-score surface changes; PAR is disk-only tooling output with no
  gate. Production competitive replay uses `computeStateHash` on live boardgame.io
  state, which this WP does not touch.
- **§20 Funding surface — N/A.** No navigation, profile, or monetization
  affordance; no funding copy or channel is added or touched.
- **§21 API catalog — N/A.** No `apps/server` HTTP endpoint and no `Library-only`
  catalog function is added, modified, removed, or status-changed; the change is
  engine-internal (simulation + test fixtures), so `api-endpoints.md` needs no edit.
- **NG-1..NG-7 — not crossed.** No pay-to-win, no PvP term, no identity/PII, no
  persistence-boundary change.
- **Verdict:** No conflict; determinism-preserving.

---

## Files Expected to Change

- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — 3 setup sites → seeded context; drop `makeMockCtx` import
- `packages/game-engine/src/simulation/par.aggregator.ts` — **modified** — 1 setup site → seeded context; drop `makeMockCtx` import
- `packages/game-engine/src/test/fixtures/runFixture.ts` — **modified** — setup site → seeded context; drop `makeMockCtx` import
- `packages/game-engine/src/test/fixtures/games/sentinel-core-doom-2p.replay.json` — **modified** — re-recorded via `scripts/record-game-fixture.mjs`
- `packages/game-engine/src/simulation/simulation.setupShuffle.test.ts` — **new** — seeded-shuffle regression + determinism guards

No other **code/test/fixture** files may be modified. The governance/DoD ledgers
edited at close — `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md`,
`docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`,
`docs/05-ROADMAP-MINDMAP.md` — are the expected governance surface and are excepted
from this lock. If the executor finds a fifth reverse-mock setup site or a second
committed replay fixture, that is a blocker to surface — not a silent scope
expansion.

---

## Acceptance Criteria

### Fix
- [ ] All simulation setup sites (`simulateOneGame`, `simulateOneCoopGame`, `simulateOneGameAndCaptureMoves`, `par.aggregator`'s `simulateOneGame`) and `runFixture` build their setup context with `shuffleWithPrng(deck, nextRandom)`, not `makeMockCtx` (confirmed with grep — zero `makeMockCtx` in these three files after the change)
- [ ] `makeMockCtx` (`test/mockCtx.ts`) is byte-unchanged (confirmed with `git diff`)
- [ ] `replay.execute.test.ts` `PRE_WP080_HASH` is byte-unchanged and its suite passes (confirmed with `git diff` + test run)

### Regression
- [ ] `simulation.setupShuffle.test.ts` asserts the seeded setup shuffle is neither identity nor reverse and does not cluster scheme-twist ids contiguously at the top; and is deterministic per seed
- [ ] A representative run of `core/midtown-bank-robbery` and `core/negative-zone-prison-breakout` no longer terminates at turn 0 with `scheme-wins` (evidenced via the executor's `sim:coop-winrate` / `scripts` run recorded in STATUS — registry-backed, run at execution)

### Fixtures / determinism
- [ ] `sentinel-core-doom-2p.replay.json` re-recorded; `replayFixtures.test.ts` (the only fixture-reading guard) passes against the re-recorded JSON; `hashGameState.test.ts` (synthetic-state hash tests — does not load the fixture) stays green
- [ ] `simulation.captureMoves.test.ts` round-trip passes (proves recorder↔replay lockstep)

### Suite / scope
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (`--no-bail` whole-repo totals recorded)
- [ ] No `Math.random` in any changed file (confirmed with grep)
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — no reverse-mock setup context remains in the three touched TS files
Select-String -Path "packages\game-engine\src\simulation\simulation.runner.ts","packages\game-engine\src\simulation\par.aggregator.ts","packages\game-engine\src\test\fixtures\runFixture.ts" -Pattern "makeMockCtx"
# Expected: no output

# Step 3 — makeMockCtx and PRE_WP080_HASH untouched
git diff --stat packages/game-engine/src/test/mockCtx.ts
git diff packages/game-engine/src/replay/replay.execute.test.ts
# Expected: no diff on either

# Step 4 — re-record the sentinel fixture (after A/C land), then run the fixture suites
node scripts/record-game-fixture.mjs   # per its --help; regenerates sentinel-core-doom-2p
pnpm --filter @legendary-arena/game-engine test
# Expected: all tests pass, including replayFixtures / hashGameState / captureMoves

# Step 5 — the two chained-reveal schemes no longer auto-lose at turn 0
node scripts/coop-winrate.mjs   # or a scoped run pinning the two schemes; record in STATUS
# Expected: games reach >0 turns; no turn-0 scheme-wins

# Step 6 — scope
git diff --name-only
# Expected: only the 5 files in ## Files Expected to Change
```

---

## Definition of Done

- [ ] **User-visible verification:** surface is `none — infrastructure`, so
      `docs/ai/STATUS.md` states plainly **"No user-observable change —
      infrastructure only"**, AND the post-fix `sim:coop-winrate` baseline (with
      the two schemes no longer auto-losing at turn 0) is recorded in STATUS
- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` / `test` exit 0
- [ ] `makeMockCtx` + `PRE_WP080_HASH` byte-identical (confirmed with `git diff`)
- [ ] Sentinel fixture re-recorded; `git diff` shows only the expected fixture drift
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — **D-24273** landed (seeded simulation setup shuffle)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-453 checked off with today's date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph flipped `📝`→`✅` and `pnpm roadmap:counts:write` run; `roadmap:counts:check` exits 0

---

## Lint Gate Self-Review

Drafting gates (01.0a Step 5), run as independent subagents against the WP + EC,
baseline `origin/main` @ `7417a0e8`:

- **Pre-flight (01.4): READY TO EXECUTE.** Every §Assumes claim + Locked Value
  verified against source: `shuffleWithPrng` / `hashSeedString` / `createMulberry32`
  in the runner; the 3 runner `makeMockCtx` setup sites (541 / 604 / 973);
  `par.aggregator` setup site (525) with its `nextRandom` at (528) — confirming the
  **RS-1 hoist** is required; `runFixture` `executeOnce` setup (361) with `nextRandom`
  already at (359) — no hoist; `makeMockCtx`'s reverse shape; `SetupContext`
  (`types.ts:672`); `sentinel-core-doom-2p.replay.json` as the sole committed
  replay fixture with `replayFixtures.test.ts` its only reader; `PRE_WP080_HASH`
  independent (uses `makeMockCtx` directly); no PAR artifact/gate; deps
  WP-452/036/411 complete. The re-run confirmed the module-scope
  `makeSeededSetupContext` export does NOT leak into `index.ts` (named re-exports
  only, no `export *`), so it is not package-public API.
- **Copilot (01.7): PASS (RISK resolved).** First pass returned RISK (HOLD): (1)
  the regression test's access path was unlocked and risked shipping vacuous, and
  (2) `hashGameState.test.ts` was mislabeled a fixture reader. Both resolved: the
  test now imports the module-exported `makeSeededSetupContext` and drives its real
  `Shuffle` with a controlled `nextRandom` stub (with the vacuous PRNG-reimpl
  pattern explicitly forbidden), and §Assumes/AC now name `replayFixtures.test.ts`
  as the sole fixture guard. HOLD (not SUSPEND) confirmed — the export is
  module-scope only.
- **Lint (00.3): PASS.** All 21 sections PASS or justified N/A (§10 / §11 / §19 /
  §20 / §21 N/A). Three hardening fixes applied: `docs/05-ROADMAP-MINDMAP.md` added
  to the EC `Files to Produce`; the EC `// why:` instruction paraphrased to "reverse
  mock" (never the literal token) so Verification Step 2's grep stays clean; explicit
  §20/§21 N/A lines + a governance/DoD-ledger carve-out on the scope lock added to
  the WP. EC content-line count 56 (≤ 100 ceiling).
