# WP-444 — Co-op Win-Rate + Loss-Cause Harness

**Status:** Ready
**Primary Layer:** Game Engine / Implementation (simulation)
**Dependencies:** none (builds only on shipped exports)
**User-Visible Surface:** none — infrastructure

> Behavior-identical to gameplay: this WP adds a measurement tool over the
> existing simulation framework. No player, visitor, or operator observes any
> change. (D-24026)

---

## Session Context

WP-036/D-3601 established the balance-simulation framework (`runSimulation`,
`SimulationConfig`, `SimulationResult`, the T2 `createCompetentHeuristicPolicy`);
WP-411/D-24223 made `evaluateEndgame(G)` the sole endgame authority (`{ outcome,
reason }`, `outcome ∈ 'heroes-win' | 'scheme-wins' | 'tie'`). This packet builds a
co-op win-rate + loss-cause harness on top of both, changing neither.

---

## Goal

After this session `@legendary-arena/game-engine` exports a **deterministic co-op
strength harness**: given a match configuration, a policy name, and a fixed set of
seeds, it plays each game to a terminal state through the existing simulation runner
and reports the **co-op win rate** plus a **loss-cause breakdown** (scheme-completed
vs. villains-escaped vs. tie vs. turn-cap-inconclusive). A `scripts/coop-winrate.mjs`
entrypoint runs a default `(config, seed)` matrix and prints the summary. This makes
"is the bot ally stronger?" a measured number rather than a subjective read — the
yardstick every later WP of the Bot Ally Strengthening epic reports against.

---

## User-Visible Impact

None — infrastructure. No user-observable change; this packet's payoff is a
regression-free measurement tool that later epic WPs (the dedicated T3 ally policy
and its heuristics) use to prove — in win-rate points — that the bot ally got
stronger.

---

## Assumes

- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- `packages/game-engine/src/simulation/simulation.runner.ts` exports
  `runSimulation` (WP-036) and internally plays each game to terminal via
  `evaluateEndgame`, producing the internal `GameOutcome` record with fields
  `isHeroesWin`, `endgameReached`, `endgameWinner`, `escapedVillains`
- `runSimulation` / `simulateOneGame` take a **non-optional** `registry:
  CardRegistryReader` as a second param (`buildInitialGameState` resolves
  heroes/villains/scheme from it). `CardRegistryReader` is an **engine-local**
  type exported from `matchSetup.validate.ts`. The real reader is supplied by the
  **script layer**: `createRegistryFromLocalFiles` from
  `packages/registry/dist/index.js` — the exact loader
  `scripts/runtime-observed-hollows.mjs` / `sweep-setup-matrix.mjs` already use.
- `packages/game-engine/src/endgame/endgame.types.ts` exports `EndgameOutcome`
  (`'heroes-win' | 'scheme-wins' | 'tie'`) and `ESCAPE_LIMIT` (WP-411)
- `packages/game-engine/src/simulation/ai.random.ts` exports `createRandomPolicy`
  and `ai.competent.ts` exports `createCompetentHeuristicPolicy`
- `docs/ai/DECISIONS.md` and `docs/ai/ARCHITECTURE.md` exist

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the simulation
  subsystem is Game Engine layer; the harness must import nothing from
  `registry`, `server`, `preplan`, `pg`, or `boardgame.io`.
- `packages/game-engine/src/simulation/simulation.runner.ts` — read entirely.
  It already owns the per-turn loop, the `GameOutcome` record, and the
  `winRate = winCount / gamesPlayed` aggregation. The harness reuses this path;
  it must NOT re-implement the turn loop and must NOT alter `runSimulation`'s
  existing return contract (byte-stable per the `GameOutcome` internal-seam note).
- `packages/game-engine/src/endgame/endgame.evaluate.ts` + `endgame.types.ts` —
  the outcome union and `ESCAPE_LIMIT`; the classifier reads these, never a
  re-derived literal.
- `packages/game-engine/src/simulation/ai.types.ts` — `SimulationConfig`,
  `SimulationResult`, `AIPolicy` shapes the harness composes.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6
  (`// why:`), Rule 8 (no `.reduce()` with branching), Rule 13 (ESM), Rule 9
  (`node:` prefix).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — the harness derives all randomness from the seeded
  policy/PRNG the existing runner already uses; the harness itself introduces no
  randomness
- Never throw inside boardgame.io move functions — N/A (no moves added); harness
  helpers are pure and may validate inputs by returning a typed error/empty, never
  throwing on ordinary input
- Never persist `G`, `ctx`, or any runtime state
- `G` must be JSON-serializable at all times
- ESM only, Node v22+; `node:` prefix on Node built-ins
- Test files use `.test.ts` — never `.test.mjs`
- No database or network access in any helper
- Full file contents for every new or modified file in the output — no diffs, no
  snippets, no "show only the changed section," no partial output
- Human-style code per `00.6-code-style.md`

**Packet-specific:**
- `runSimulation`'s existing exported return contract must not change — any
  runner edit is an **additive** narrow projection export only
  (`simulateOneCoopGame`), mirroring the `CapturedOutcomeSummary` smallest-seam
  precedent
- The loss-cause classifier reads `ESCAPE_LIMIT` and the `EndgameOutcome` union
  from `endgame.types.ts` — never hardcodes the escape threshold or the outcome
  strings
- The harness writes **no committed artifact and adds no CI freshness gate** — it
  prints; each consuming WP records its number in its own STATUS/PR (D-24263).
  This deliberately avoids the runtime-observed-hollows/dashboard cascade class
- **Registry seam (engine↔registry layer lock).** The engine harness modules
  (`coopOutcome.ts`, `coopWinRate.ts`, `simulation.runner.ts`) import ONLY the
  `CardRegistryReader` **type** (from `matchSetup.validate.ts`) — NEVER
  `@legendary-arena/registry` or any `packages/registry` path. The real reader is
  loaded by `scripts/coop-winrate.mjs` and passed in as an explicit param. A
  registry import in any `packages/game-engine/**` file is a layer violation and a FAIL

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask — never guess

**Locked contract values (inline):**
- **EndgameOutcome union:** `'heroes-win' | 'scheme-wins' | 'tie'`
- **TurnStage values** (if the harness touches stage checks): `'start' | 'main' | 'cleanup'`

---

## Debuggability & Diagnostics

The harness is fully reproducible: identical `(matchConfiguration, policyName,
seeds)` yields a byte-identical `CoopWinRateReport` (the underlying sim is
seed-deterministic). Every reported number is derivable from the per-game
`CoopGameRecord` list, which the harness may return alongside the aggregate for
inspection. No hidden side effects; no state mutation beyond local aggregation.

---

## Scope (In)

### A) Co-op outcome classifier — `src/simulation/coopOutcome.ts` (new)
- `COOP_OUTCOME_CATEGORIES` — a `readonly` canonical array of exactly **5**
  values: `'win'`, `'loss-scheme-completed'`, `'loss-villains-escaped'`,
  `'loss-tie'`, `'inconclusive-turn-cap'`.
- `CoopOutcomeCategory = typeof COOP_OUTCOME_CATEGORIES[number]`.
- `classifyCoopOutcome(record: CoopGameRecord): CoopOutcomeCategory` — pure,
  deterministic. Evaluation order (explicit `if`, no nested ternary):
  1. `record.isHeroesWin` → `'win'`
  2. else `!record.endgameReached` → `'inconclusive-turn-cap'` (hit the turn cap
     without a terminal — the bot stalled / was too slow; `// why:` comment)
  3. else `record.endgameWinner === 'tie'` → `'loss-tie'`
  4. else (a `'scheme-wins'` terminal): `record.escapedVillains >= ESCAPE_LIMIT`
     → `'loss-villains-escaped'`, otherwise `'loss-scheme-completed'`. The
     **`// why:` comment MUST state the load-bearing invariant:** `evaluateEndgame`
     ends on the FIRST tripped condition, so at a `scheme-wins` terminal
     `escapedVillains >= ESCAPE_LIMIT` iff escape-overrun was the trigger; the
     same-turn double-trip (SCHEME_LOSS and escape-overrun both true on one turn) is
     a known, accepted limitation of this proxy. Surfacing a typed loss-cause from
     `evaluateEndgame` is deliberately OUT of scope (it would touch
     `endgame.evaluate.ts`, outside the allowlist).

### B) Aggregating harness — `src/simulation/coopWinRate.ts` (new)
- `CoopGameRecord` — the narrow per-game projection the runner surfaces:
  `{ isHeroesWin: boolean; endgameReached: boolean; endgameWinner: EndgameOutcome
  | null; escapedVillains: number; turns: number }`.
- `CoopWinRateReport` — `{ games: number; wins: number; winRate: number;
  byCategory: Record<CoopOutcomeCategory, number> }`.
- `runCoopWinRate(config: CoopHarnessConfig, registry: CardRegistryReader):
  CoopWinRateReport` — for each seed, play one co-op game to terminal (via the
  additive runner export below), classify it, and accumulate counts with an
  explicit `for...of` (no `.reduce`). `CoopHarnessConfig = { matchConfiguration:
  MatchConfiguration; policyName: 'random' | 'competent'; seeds: readonly
  string[]; numPlayers?: number }`. `registry` is an explicit **second param**
  (mirroring `runSimulation`), NOT a config field — the engine never loads it.
  Every seat is driven by the same policy name (models a fully-cooperative table);
  `numPlayers` defaults to 2 (the solo + one-bot-ally shape).
- **Fresh policy per seed (determinism).** `runCoopWinRate` constructs a NEW policy
  instance per seed (`createRandomPolicy(seed)` / `createCompetentHeuristicPolicy(seed)`)
  so a game's outcome depends ONLY on its own seed, never its position in the list.
  The policy holds a stateful decision-domain PRNG (D-2704); reusing one instance
  across seeds would make records position-dependent. Each seed threads into both the
  shuffle domain and the policy's decision domain.
- **Empty-seeds guard.** When `seeds` is empty, `runCoopWinRate` returns a zeroed
  report (`games: 0, wins: 0, winRate: 0`, every `byCategory` count 0) — never a
  `NaN` from `wins / 0` — mirroring `runSimulation`'s `zeroedResult` guard
  (`config.games < 1`). Requires a `// why:` comment and a one-line test.

### C) Additive runner projection — `src/simulation/simulation.runner.ts` (modified)
- Add an **additive** export `simulateOneCoopGame(matchConfiguration, registry,
  policy, seed, numPlayers): CoopGameRecord` that plays one game via the existing
  per-turn loop and returns the narrow projection. It reuses the existing loop
  helper and threads `registry` into `buildInitialGameState`; it does NOT alter
  `runSimulation` or the internal `GameOutcome` shape. The `registry` param is the
  engine-local `CardRegistryReader` **type** — this file must NOT import the
  registry package.

### D) Operator entrypoint — `scripts/coop-winrate.mjs` (new)
- A standalone ESM script that imports the built **engine** dist AND
  `createRegistryFromLocalFiles` from the built **registry** dist
  (`packages/registry/dist/index.js` — the script/app layer may import registry;
  the engine may not), loads the real registry, and runs `runCoopWinRate(config,
  registry)` over a **fixed, pinned** `(config, seeds)` matrix: a real 2-player
  core Magneto / Midtown Bank Robbery `MatchSetupConfig` (pin the exact ext_ids in
  the script) and a fixed, literal seed list (≥50 seeds, named in the script) so the
  STATUS baseline is reviewer-reproducible. Prints the report (win rate + per-category
  counts). Add the alias `sim:coop-winrate` to the **root** `package.json` (beside
  `sim:coverage` / `sim:runtime-observed`).

### E) Export surface — `src/index.ts` (modified)
- Additive exports: `runCoopWinRate`, `classifyCoopOutcome`,
  `COOP_OUTCOME_CATEGORIES`, and the `CoopOutcomeCategory` / `CoopGameRecord` /
  `CoopWinRateReport` / `CoopHarnessConfig` types.

### F) Tests
Add `node:test` tests:
- `src/simulation/coopOutcome.test.ts` — one assertion per category from a
  synthetic `CoopGameRecord` (win; scheme-completed; villains-escaped at exactly
  `ESCAPE_LIMIT`; tie; turn-cap). **Drift test:** `COOP_OUTCOME_CATEGORIES`
  contains exactly the 5 expected values, AND `classifyCoopOutcome` returns a
  member of it for every branch (non-vacuous). Include a negative check: a record
  with `escapedVillains = ESCAPE_LIMIT - 1` on a `scheme-wins` terminal
  classifies as `'loss-scheme-completed'`, not escaped.
- `src/simulation/coopWinRate.test.ts` — aggregation math over a small fixed seed
  list; determinism (same seeds → identical report); **position-independence** (the
  same seed at index 0 vs index N yields an identical per-game classification —
  proves the fresh-policy-per-seed rule); `byCategory` counts sum to `games`; does
  not import `boardgame.io`. The test supplies a `CardRegistryReader` as the
  engine-boundary input — a minimal in-test stub or an engine test fixture; it must
  NOT import the `@legendary-arena/registry` package into a `packages/game-engine`
  test.

---

## Out of Scope

- No T3 `BotAlly` policy — that is WP-445. The harness only selects the existing
  `'random'` / `'competent'` policies; it is written so a third policy name drops
  in later without a harness change.
- No changes to `createCompetentHeuristicPolicy`, `runSimulation`'s existing
  return, `getLegalMoves`, or any UIState projection.
- No committed win-rate artifact and no CI freshness gate (D-24263).
- No bot-ally driver (`apps/server`) changes.
- No new persistence, snapshot, or `bgio`-store surface.
- Refactors or "while I'm here" cleanups outside Scope (In).

---

## Vision Alignment

> `docs/01-VISION.md` §17 trigger surfaces are touched (this is a **simulation**
> harness and it reasons about **determinism**), so this block is required.

- **§22 Replay / determinism — preserved.** The harness introduces **no new
  randomness** (no `Math.random`, no clock, no I/O); every reported number is a
  pure function of `(matchConfiguration, policyName, seeds)` driven through the
  existing seed-deterministic runner. It **reads** terminal state via
  `evaluateEndgame` and never writes `G`/`ctx` or any persisted state. Identical
  inputs yield a byte-identical `CoopWinRateReport`.
- **§20–26 Scoring / PAR / leaderboards — NOT crossed.** The harness is an
  offline measurement tool. It feeds **no** competitive-scoring, PAR-publication,
  or leaderboard surface; it emits no `competitive_scores` row and no committed
  artifact (D-24263). It shares the simulation subsystem with the balance-PAR
  framework but adds a sibling aggregation only — the existing `runSimulation`
  aggregate contract is byte-unchanged.
- **§20 Funding surface — N/A.** No navigation, profile, or monetization
  affordance; no funding copy or channel.
- **NG-1..NG-7 non-goals — not crossed.** No pay-to-win, no player-vs-player
  interaction term, no identity/PII, no persistence-boundary change.
- **Verdict:** No conflict; determinism-preserving.

---

## Files Expected to Change

- `packages/game-engine/src/simulation/coopOutcome.ts` — **new** — classifier + canonical array
- `packages/game-engine/src/simulation/coopOutcome.test.ts` — **new** — classifier + drift tests
- `packages/game-engine/src/simulation/coopWinRate.ts` — **new** — aggregating harness
- `packages/game-engine/src/simulation/coopWinRate.test.ts` — **new** — aggregation + determinism tests
- `packages/game-engine/src/simulation/simulation.runner.ts` — **modified** — additive `simulateOneCoopGame` projection export only
- `packages/game-engine/src/index.ts` — **modified** — additive harness exports
- `scripts/coop-winrate.mjs` — **new** — operator entrypoint
- `package.json` — **modified** — `sim:coop-winrate` script alias

No other files may be modified.

---

## Acceptance Criteria

### A) Classifier
- [ ] `coopOutcome.ts` exports `COOP_OUTCOME_CATEGORIES` with exactly 5 values in the order specified
- [ ] `classifyCoopOutcome` returns `'win'` iff `isHeroesWin`
- [ ] a `scheme-wins` record with `escapedVillains >= ESCAPE_LIMIT` → `'loss-villains-escaped'`; with `escapedVillains < ESCAPE_LIMIT` → `'loss-scheme-completed'`
- [ ] `endgameReached === false` → `'inconclusive-turn-cap'`; `endgameWinner === 'tie'` → `'loss-tie'`
- [ ] no `throw` in `coopOutcome.ts`; no `boardgame.io` import (confirmed with grep)
- [ ] the escape threshold is read from `ESCAPE_LIMIT`, not a literal (confirmed with grep)

### B) Harness
- [ ] `runCoopWinRate` returns `{ games, wins, winRate, byCategory }` with `byCategory` counts summing to `games`
- [ ] identical `(config, policyName, seeds)` → byte-identical report (determinism test)
- [ ] `simulation.runner.ts`'s existing `runSimulation` export signature and return shape are unchanged (confirmed with grep/diff)

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] Drift test: `COOP_OUTCOME_CATEGORIES` contains exactly 5 expected values
- [ ] Test files import `node:test` / `node:assert` only; no `boardgame.io`

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — no throw / no boardgame.io in the classifier
Select-String -Path "packages\game-engine\src\simulation\coopOutcome.ts" -Pattern "throw |boardgame.io"
# Expected: no output

# Step 4 — escape threshold read from the constant, not a literal
Select-String -Path "packages\game-engine\src\simulation\coopOutcome.ts" -Pattern "ESCAPE_LIMIT"
# Expected: at least one match (the import + the comparison)

# Step 5 — record the baseline: run the harness with the competent policy
node scripts/coop-winrate.mjs
# Expected: prints games / winRate / per-category counts (record this number in STATUS)

# Step 6 — no files outside scope changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] **User-visible verification:** surface is `none — infrastructure`, so
      `docs/ai/STATUS.md` states plainly **"No user-observable change —
      infrastructure only"** (payoff: the epic's win-rate yardstick), AND the
      baseline competent-policy co-op win rate from Step 5 is recorded in STATUS
- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `runSimulation`'s existing export is unchanged (confirmed with `git diff`)
- [ ] No `Math.random` in any new or modified file (confirmed with grep)
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` — **D-24263** landed (co-op-strength metric)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-444 checked off with today's date
- [ ] `docs/05-ROADMAP-MINDMAP.md` node glyph flipped `📝`→`✅` and `pnpm roadmap:counts:write` run; `roadmap:counts:check` exits 0

---

## Lint Gate Self-Review

Drafting gates (01.0a Step 5), run as independent subagents against the amended WP + EC:

- **Pre-flight (01.4): READY TO EXECUTE.** Every §Assumes claim verified on `main`
  @ `85edbf26`: `runSimulation(config, registry: CardRegistryReader, …)`,
  `CardRegistryReader` (`matchSetup.validate.ts`), `createRegistryFromLocalFiles`
  (registry dist, used by `runtime-observed-hollows.mjs`), `ESCAPE_LIMIT` = 8,
  `EndgameOutcome`, the policy factories, and the `GameOutcome` fields all exist;
  the amended harness signatures are internally consistent.
- **Copilot (01.7): RISK (all concerns resolved).** The first pass returned **BLOCK**
  — the harness signatures omitted the `CardRegistryReader` that `runSimulation`
  requires (would have forced signature drift or an engine→registry layer violation).
  Resolved by threading `registry` as an explicit param (engine imports the type only;
  the `.mjs` supplies the reader). Two RISKs likewise fixed: fresh policy instance per
  seed (position-independence) and the loss-cause first-tripped-condition `// why:`
  invariant. The final low-severity RISK (empty-seeds `NaN`) is closed by the
  zeroed-report guard (§Scope B / EC Locked Values).
- **Lint (00.3): PASS.** All 21 sections PASS or justified N/A (§11 / §19 / §20 / §21
  N/A). The two first-pass FAILs — §2 (full-file-output clause) and §17 (Vision
  Alignment) — are resolved.
