# Session Prompt — WP-036 AI Playtesting & Balance Simulation

**Work Packet:** [docs/ai/work-packets/WP-036-ai-playtesting-balance-simulation.md](../work-packets/WP-036-ai-playtesting-balance-simulation.md) (amended 2026-04-20 per PS-2)
**Execution Checklist:** [docs/ai/execution-checklists/EC-036-ai-playtesting.checklist.md](../execution-checklists/EC-036-ai-playtesting.checklist.md) (amended 2026-04-20 per PS-2)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp036.md](../session-context/session-context-wp036.md)
**Pre-Flight Report:** [docs/ai/invocations/preflight-wp036-ai-playtesting-balance-simulation.md](preflight-wp036-ai-playtesting-balance-simulation.md)
**Commit prefix:** `EC-036:` on every code-changing commit in the WP-036 allowlist; `SPEC:` on governance / pre-flight commits outside the allowlist; `WP-036:` is **forbidden** (commit-msg hook rejects per P6-36). EC-036 slot is **unconsumed** as of `main @ cd811eb` — no retargeting trap.
**Pre-flight verdict:** READY TO EXECUTE (2026-04-20) — PS-1 (D-3601 + 02-CODE-CATEGORIES.md) and PS-2 (WP-036 §D + EC-036 amendment `registry: CardRegistry` → `registry: CardRegistryReader`) must land in the A0 SPEC bundle before Commit A begins.
**Copilot Check (01.7):** CONFIRM — 30/30 PASS after FIXes (RS-13, RS-14, RS-15 added to pre-flight §Risk Review). Zero HOLD, zero SUSPEND.
**WP Class:** Infrastructure & Verification. External consumer tooling. No engine gameplay changes. No `G` mutation from simulation code. No moves added. No phase hooks. No new `LegendaryGameState` fields. No `buildInitialGameState` shape change.
**Primary layer:** Game Engine (new `packages/game-engine/src/simulation/` subdirectory classified as `engine` category per D-3601).

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-036:` on code commits inside the allowlist; `SPEC:` on governance commits. `WP-036:` forbidden (`.githooks/commit-msg` rejects per P6-36). Subject lines containing `WIP` / `misc` / `tmp` / `updates` / `changes` / `debug` / `fix stuff` are also rejected.

2. **Governance bundle landed (A0 SPEC).** Before writing any code file, run `git log --oneline -5` and confirm Commit A0 landed with all of:
   - `docs/ai/DECISIONS.md` — new entry **D‑3601 — Simulation Code Category** (classifies `packages/game-engine/src/simulation/` as `engine`; cites D-0701, D-2706 precedent)
   - `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — `packages/game-engine/src/simulation/` added to §engine directories list (PS-1)
   - `docs/ai/work-packets/WP-036-ai-playtesting-balance-simulation.md` — §D signature corrected `registry: CardRegistry` → `registry: CardRegistryReader`; §Scope (In) §D registry note appended; new §Amendments A-036-01 entry (PS-2)
   - `docs/ai/execution-checklists/EC-036-ai-playtesting.checklist.md` — amendment note locking `runSimulation(config, registry: CardRegistryReader)` signature (PS-2)
   - `docs/ai/invocations/preflight-wp036-ai-playtesting-balance-simulation.md` (this document's sibling)
   - This session prompt

   If any is unlanded, STOP — execution is blocked on pre-flight governance.

3. **Upstream dependency baseline.** Run:
   ```bash
   pnpm --filter @legendary-arena/game-engine test
   ```
   Expect `436 tests / 109 suites / 0 fail`. Package-level breakdown per session-context bridge:
   - registry `13 / 2 / 0`
   - vue-sfc-loader `11 / 0 / 0`
   - **game-engine `436 / 109 / 0` (MUST shift to 444 / 110 / 0 post-Commit A — exactly +8 tests, +1 suite)**
   - server `6 / 2 / 0`
   - replay-producer `4 / 2 / 0`
   - preplan `52 / 7 / 0`
   - arena-client `66 / 0 / 0`
   - Repo-wide: `588 / 0` pre-Commit A; `596 / 0` post-Commit A.

   If the repo baseline diverges, STOP and reconcile.

4. **Upstream contract surface verification.** Before writing any file, grep-verify all seven dependency exports at `main @ cd811eb`:

   ```bash
   grep -n "export interface ClientTurnIntent"   packages/game-engine/src/network/intent.types.ts
   grep -n "export interface UIState"             packages/game-engine/src/ui/uiState.types.ts
   grep -n "export function filterUIStateForAudience" packages/game-engine/src/ui/uiState.filter.ts
   grep -n "export interface ReplayInput"         packages/game-engine/src/replay/replay.types.ts
   grep -n "export function computeStateHash"     packages/game-engine/src/replay/replay.hash.ts
   grep -n "export interface FinalScoreSummary"   packages/game-engine/src/scoring/scoring.types.ts
   grep -n "export function makeMockCtx"          packages/game-engine/src/test/mockCtx.ts
   grep -n "export interface CardRegistryReader"  packages/game-engine/src/matchSetup.validate.ts
   ```

   Each must return exactly one line. If any returns zero lines, STOP — the Assumes gate is violated.

5. **`FinalScoreSummary` field check (RS-12).** `FinalScoreSummary` does **NOT** contain `escapedVillains` or `wounds` fields at the top level. It exposes `players: PlayerScoreBreakdown[]` (per-player VP breakdown) and `winner: string | null`. Per RS-12 resolution:
   - `escapedVillainsAverage` is sourced from `UIProgressCounters.escapedVillains` on the post-endgame `UIState` projection — NOT from `FinalScoreSummary` and NOT from direct `G.counters` access.
   - `woundsAverage` is sourced by summing `UIPlayerState.woundCount` across all players on the post-endgame `UIState` projection — NOT from `FinalScoreSummary.players[*].woundVP` and NOT from direct `G.playerZones` inspection.

   This keeps simulation on the `UIState` consumption boundary instead of inventing a new `FinalScoreSummary` field, which would expand WP-020's scope.

6. **Working-tree hygiene (P6-27).** `git status --short` will show the pre-existing inherited items (from session-context §Inherited Dirty-Tree Map). None are in the WP-036 allowlist. **Stage by exact filename only** — `git add .` / `git add -A` / `git add -u` are forbidden. If a mystery untracked file appears (e.g., `docs/ai/ideas/` per the WP-030 precedent), flag in the execution summary and do NOT touch.

7. **Quarantine state — do NOT disturb.** `stash@{0}` (wp-055-quarantine-viewer), `stash@{1}` (WP-068 / MOVE_LOG_FORMAT), `stash@{2}` (pre-WP-062 dirty tree). Never pop during WP-036 execution.

8. **Branch discipline.** Cut a fresh topic branch from `main @ cd811eb`:
   ```bash
   git checkout -b wp-036-ai-playtesting main
   ```
   Do NOT reuse an existing branch. Do NOT rebase onto an unreleased branch.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause. WP-036 is purely additive and touches **zero** engine contract surface:

| 01.5 Trigger Criterion | Applies to WP-036? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | No engine type modified. Zero new G fields. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildInitialGameState` called unchanged via D-2702 pattern. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | Zero moves added. Engine 436 / 109 / 0 baseline held on all existing tests. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook. No onBegin/onEnd. No endIf change. |

**Conclusion:** 01.5 is **NOT INVOKED**. Per 01.5 §Escalation: *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution, **STOP and escalate** — do not force-fit.

---

## Post-Mortem (01.6) — MANDATORY

Per [01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). WP-036 triggers two mandatory conditions:

| 01.6 Trigger | Applies? | Justification |
|---|---|---|
| New long-lived abstraction | **Yes** | `AIPolicy` is the extension seam for future heuristic / MCTS / neural policies; `LegalMove`, `SimulationConfig`, `SimulationResult`, `getLegalMoves`, `runSimulation` are new exports. |
| New code category / directory | **Yes** | `packages/game-engine/src/simulation/` is new; D-3601 classifies under `engine`. |
| New contract consumed by future WPs | **Yes** | `AIPolicy` and `SimulationResult` anchor Phase 7 / PAR simulation downstream WPs (WP-037 → WP-041, WP-049 → WP-054). |
| New setup artifact in `G` | No | Zero G involvement. |

**Post-mortem must cover (minimum):**

1. **Aliasing check** — verify `AIPolicy.decideTurn` receives a spread-copied `UIState` (RS-14 / WP-028/029 precedent). Every `[...array]` / `{...object}` at the projection boundary traced.
2. **Extension-seam check** — confirm `AIPolicy` and `LegalMove` are open-ended enough that future heuristic / MCTS policies add without refactor. Explicit statement in post-mortem.
3. **Capability-gap documentation** — `makeMockCtx` provides reverse-shuffle, NOT a seeded PRNG (D-2704). Simulation implements mulberry32 locally (RS-1). Post-mortem records this as the capability-gap pattern and cross-links D-2704.
4. **Forbidden-behaviors docstring block** — `decideTurn` JSDoc must include a "Forbidden behaviors" block (no cache / memoize / close over G / retain state) per WP-028 projection-purity precedent.
5. **`// why:` comment completeness** — the four required comments per EC-036 §Required `// why:` Comments verified present; plus RS-13 (enumeration order) and RS-15 (move-name set) comments.

**Post-mortem file path:** `docs/ai/post-mortems/01.6-WP-036-ai-playtesting-balance-simulation.md`. Template = `docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md` (most recent MANDATORY precedent per session-context §Quick-Reference Index).

Post-mortem runs in the **same session** as Commit A execution, before Commit B (governance close). Fixes applied during post-mortem are strict in-allowlist refinements (WP-031 precedent) — they do NOT require 01.5 invocation.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary (authoritative); engine may NOT import `boardgame.io`, registry, preplan, server, pg
3. [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) — engine category rules; registry boundary; moves never throw; no `.reduce()`; no `Math.random()`
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — ESM only, `.test.ts` extension, full-sentence error messages, no abbreviations, JSDoc required on every function
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — §Layer Boundary (line 211); §MVP Gameplay Invariants §Moves & Determinism (line 1286); §Debuggability & Diagnostics
6. [docs/ai/execution-checklists/EC-036-ai-playtesting.checklist.md](../execution-checklists/EC-036-ai-playtesting.checklist.md) — **primary execution authority** (Locked Values + Guardrails + Required `// why:` Comments + Files to Produce + After Completing + Common Failure Smells), amended 2026-04-20 per PS-2
7. [docs/ai/work-packets/WP-036-ai-playtesting-balance-simulation.md](../work-packets/WP-036-ai-playtesting-balance-simulation.md) — authoritative WP specification, amended 2026-04-20 per PS-2
8. [docs/ai/session-context/session-context-wp036.md](../session-context/session-context-wp036.md) — bridge from WP-060 closure (`cd811eb`); baselines, quarantine state, inherited dirty-tree map, EC-036 slot status, P6-22/27/36/43/50/44 precedents
9. [docs/ai/invocations/preflight-wp036-ai-playtesting-balance-simulation.md](preflight-wp036-ai-playtesting-balance-simulation.md) — READY TO EXECUTE verdict; copilot-check 30/30 PASS; RS-1 through RS-15 resolved
10. [docs/ai/DECISIONS.md](../DECISIONS.md) — D-0701 (AI Is Tooling, Not Gameplay), D-0702 (Balance Changes Require Simulation), D-2702 (framework bypass), D-2704 (PRNG capability gap), D-2705 (static MOVE_MAP), D-2801 (local structural interface), D-2903 (UIState filtering), **D-3601 (NEW — Simulation Code Category, landed in A0)**
11. [docs/ai/REFERENCE/00.6-code-style.md](../REFERENCE/00.6-code-style.md) — human-facing style guide (Rule 4, 6, 8, 13)
12. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) — engine category rules (updated in A0 to include `src/simulation/`)

**Implementation anchors (read before coding — paths verified at pre-flight time):**

13. [packages/game-engine/src/setup/buildInitialGameState.ts](../../../packages/game-engine/src/setup/buildInitialGameState.ts) — signature `buildInitialGameState(config: MatchSetupConfig, registry: CardRegistryReader, context: SetupContext): LegendaryGameState`. This is what `runSimulation` calls (NOT `Game.setup()`).
14. [packages/game-engine/src/matchSetup.validate.ts](../../../packages/game-engine/src/matchSetup.validate.ts) line 28 — `CardRegistryReader` interface: `{ listCards(): Array<{ key: string }> }`. This is the type `runSimulation` accepts (per PS-2 correction).
15. [packages/game-engine/src/test/mockCtx.ts](../../../packages/game-engine/src/test/mockCtx.ts) — `makeMockCtx(overrides?: { numPlayers?: number }): SetupContext` returns `{ ctx: { numPlayers }, random: { Shuffle: <T>(deck: T[]) => [...deck].reverse() } }`. Used only for constructing initial G; move dispatch uses the simulation's seeded PRNG, NOT `makeMockCtx`'s reverse-shuffle.
16. [packages/game-engine/src/moves/coreMoves.impl.ts](../../../packages/game-engine/src/moves/coreMoves.impl.ts) — `drawCards`, `playCard`, `endTurn` exports; all destructure `{ G, playerID, ...context }: MoveContext`.
17. [packages/game-engine/src/villainDeck/villainDeck.reveal.ts](../../../packages/game-engine/src/villainDeck/villainDeck.reveal.ts) — `revealVillainCard` export.
18. [packages/game-engine/src/moves/fightVillain.ts](../../../packages/game-engine/src/moves/fightVillain.ts), [.../recruitHero.ts](../../../packages/game-engine/src/moves/recruitHero.ts), [.../fightMastermind.ts](../../../packages/game-engine/src/moves/fightMastermind.ts) — the three fight/recruit exports.
19. [packages/game-engine/src/turn/turnLoop.ts](../../../packages/game-engine/src/turn/turnLoop.ts) — `advanceTurnStage(gameState: TurnLoopState, context: TurnLoopContext): void`. Used for `advanceStage` dispatch per D-2705 (WP-027 precedent: `advanceStage` is a local function in `game.ts`, not exported).
20. [packages/game-engine/src/ui/uiState.build.ts](../../../packages/game-engine/src/ui/uiState.build.ts) — `buildUIState(gameState: LegendaryGameState, ctx: UIBuildContext): UIState` where `UIBuildContext = { readonly phase: string | null; readonly turn: number; readonly currentPlayer: string }` (local interface per D-2801).
21. [packages/game-engine/src/ui/uiState.filter.ts](../../../packages/game-engine/src/ui/uiState.filter.ts) — `filterUIStateForAudience(state, audience): UIState`; `redactHandCards` omits `handCards` key entirely for non-active audiences (not `undefined` assignment).
22. [packages/game-engine/src/ui/uiState.filter.test.ts](../../../packages/game-engine/src/ui/uiState.filter.test.ts) line 102 — **canonical assertion pattern for RS-14**: `assert.equal(player1.handCards, undefined, 'Other player handCards must be undefined')`. Test #7 must mirror this verbatim.
23. [packages/game-engine/src/ui/uiState.types.ts](../../../packages/game-engine/src/ui/uiState.types.ts) — `UIPlayerState.handCards?: string[]` (optional, redacted via absence); `UIProgressCounters.escapedVillains` (line 150, authoritative source for `escapedVillainsAverage`); `UIPlayerState.woundCount` (line 59, authoritative source for `woundsAverage`).
24. [packages/game-engine/src/network/intent.types.ts](../../../packages/game-engine/src/network/intent.types.ts) line 35 — `ClientTurnIntent` shape (returned by `AIPolicy.decideTurn`).
25. [packages/game-engine/src/game.ts](../../../packages/game-engine/src/game.ts) lines 176-198 — `moves` map + `phases.play` / `phases.lobby` maps. Used to enumerate the 8 play-phase moves for `SIMULATION_MOVE_NAMES` (RS-15) — lobby moves (`setPlayerReady`, `startMatchIfReady`) are explicitly excluded.
26. [packages/game-engine/src/replay/replay.execute.ts](../../../packages/game-engine/src/replay/replay.execute.ts) — **reference precedent** for the D-2702 + D-2705 + D-2801 pattern (framework bypass, static MOVE_MAP, local `ReplayMoveContext` interface). The simulation runner mirrors this structure.

If any conflict, higher-authority documents win. WP and EC are subordinate to `ARCHITECTURE.md`, `.claude/rules/*.md`, and DECISIONS.md.

---

## Goal (Binary)

After this session, the game engine exposes an AI playtesting framework that exercises the full engine pipeline from outside boardgame.io. Specifically:

1. **`packages/game-engine/src/simulation/ai.types.ts`** exists with exported `AIPolicy`, `LegalMove`, `SimulationConfig`, `SimulationResult` interfaces matching EC-036 §Locked Values verbatim, plus a `// why:` comment citing D-0701.
2. **`packages/game-engine/src/simulation/ai.random.ts`** exists with exported `createRandomPolicy(seed: string): AIPolicy` backed by an internal mulberry32 PRNG (not exported from the package), single instance scoped to the policy's `decideTurn` closure. `// why:` comment cites MVP baseline + D-2704 capability-gap.
3. **`packages/game-engine/src/simulation/ai.legalMoves.ts`** exists with exported `getLegalMoves(G: LegendaryGameState, ctx: SimulationLifecycleContext): LegalMove[]`, a local `SIMULATION_MOVE_NAMES` 8-tuple (RS-15), and canonical enumeration order (RS-13). `// why:` comment cites same-as-humans constraint and WP-032 D-3202 precedent.
4. **`packages/game-engine/src/simulation/simulation.runner.ts`** exists with exported `runSimulation(config: SimulationConfig, registry: CardRegistryReader): SimulationResult`, local `SimulationMoveContext` interface (5 fields per RS-4), static `MOVE_MAP` per D-2705, `for...of` loops, 200-turn safety cap per RS-7, `escapedVillainsAverage` and `woundsAverage` sourced from post-endgame `UIState` per RS-12. `// why:` comment cites full-engine-pipeline parity with multiplayer.
5. **`packages/game-engine/src/types.ts`** re-exports `AIPolicy`, `LegalMove`, `SimulationConfig`, `SimulationResult` at the end of the file.
6. **`packages/game-engine/src/index.ts`** exports the public simulation API: `AIPolicy`, `LegalMove`, `SimulationConfig`, `SimulationResult`, `createRandomPolicy`, `getLegalMoves`, `runSimulation`.
7. **`packages/game-engine/src/simulation/simulation.test.ts`** exists with exactly 8 tests inside one `describe('simulation framework (WP-036)')` block — matching WP-036 §G and EC-036 §After Completing.
8. **Engine baseline shift: 436 / 109 / 0 → 444 / 110 / 0.** Zero existing tests modified.
9. **Governance closed:** `docs/ai/STATUS.md` updated (AI simulation framework exists; D-0701 + D-0702 implemented); `docs/ai/DECISIONS.md` updated (D-3601 landed in A0 plus at minimum: same-pipeline-as-humans rationale, random baseline rationale, simulation-seed reproducibility rationale); `docs/ai/work-packets/WORK_INDEX.md` flips WP-036 `[ ]` → `[x]` with today's date + Commit A hash; `docs/ai/execution-checklists/EC_INDEX.md` flips EC-036 Draft → Done.

No engine gameplay changes. No server changes. No arena-client changes. No preplan changes. No `package.json` / `pnpm-lock.yaml` edits.

---

## Locked Values (Do Not Re-Derive)

All Locked Values below are copied verbatim from EC-036 + pre-flight RS-1 through RS-15. Any divergence between this prompt and EC-036 is a prompt authoring bug — escalate and re-run copilot check rather than "work around."

### Commit & governance prefixes

- **EC / commit prefix:** `EC-036:` on code commits; `SPEC:` on governance/doc commits; `WP-036:` forbidden (P6-36). EC-036 slot confirmed unconsumed.
- **Three-commit topology:**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: new D-3601 in DECISIONS.md + `02-CODE-CATEGORIES.md` update + WP-036 §D + §Amendments A-036-01 + EC-036 amendment note + pre-flight file + copilot-check appendix + this session prompt. **Landed before Commit A.**
  - **Commit A (`EC-036:`)** — execution: 4 new simulation files + 1 new test file + `types.ts` re-export + `index.ts` export + DECISIONS.md entries (see §Governance Decisions below).
  - **Commit B (`SPEC:`)** — governance close: `WORK_INDEX.md` (WP-036 `[ ]` → `[x]` with date + Commit A hash) + `EC_INDEX.md` (EC-036 Draft → Done) + `STATUS.md`.

### `AIPolicy` + `LegalMove` — exact shape (EC-036 Locked Values)

```ts
export interface AIPolicy {
  readonly name: string;
  decideTurn(
    playerView: UIState,
    legalMoves: LegalMove[],
  ): ClientTurnIntent;
}

export interface LegalMove {
  readonly name: string;
  readonly args: unknown;
}
```

- `name` on `AIPolicy` is free-form metadata for logging/aggregation (not drift-pinned).
- `name` on `LegalMove` is one of the 8 values in `SIMULATION_MOVE_NAMES` (RS-15).
- `args: unknown` is a deliberate wide type (matches `ClientTurnIntent.moveArgs: unknown` per WP-032).

### `SimulationConfig` — exact shape

```ts
export interface SimulationConfig {
  readonly games: number;
  readonly seed: string;
  readonly setupConfig: MatchSetupConfig;
  readonly policies: AIPolicy[];
}
```

- `games`: positive integer. If `games < 1`, `runSimulation` returns an empty-zeroed `SimulationResult` with a `G.messages` warning (no throw).
- `seed`: non-empty string. Hashed into a 32-bit seed for mulberry32 via djb2 (simple deterministic hash — no crypto).
- `setupConfig`: valid `MatchSetupConfig` (9 locked fields per `00.2-data-requirements.md`).
- `policies`: one `AIPolicy` per player seat, indexed by `playerId` as a string (`'0'`, `'1'`, ...). If `policies.length !== setupConfig`-derived player count, `runSimulation` logs a warning and returns zeroed `SimulationResult` (no throw). The exact mapping: `policies[Number(playerId)]`.

### `SimulationResult` — exact shape (EC-036 Locked Values)

```ts
export interface SimulationResult {
  readonly gamesPlayed: number;
  readonly winRate: number;
  readonly averageTurns: number;
  readonly averageScore: number;
  readonly escapedVillainsAverage: number;
  readonly woundsAverage: number;
  readonly seed: string;
}
```

- All six numeric fields: `number`. `winRate` in `[0, 1]`. `averageTurns` capped at 200.0 (the safety-cap bound).
- `seed`: copied from `config.seed` verbatim (enables reproduction).
- `gamesPlayed` counts successful and stuck games alike (both contribute to averages). Stuck games (turn cap hit without endgame) count as `winRate += 0`, `averageTurns += 200`, no VP contribution.

### mulberry32 PRNG (RS-1) — exact implementation

Place in `ai.random.ts` as a file-local helper. Do NOT export. The mulberry32 algorithm:

```ts
// why: mulberry32 chosen for deterministic reproducibility + brevity;
// not a cryptographic PRNG; simulation-internal only. Same seed +
// same call sequence = same output sequence. Addresses D-2704
// capability gap: makeMockCtx reverses arrays, does not accept a seed.
function createMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return function next(): number {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeedString(seed: string): number {
  // why: djb2 string hash — deterministic, no crypto dependency,
  // produces a 32-bit seed for mulberry32.
  let hash = 5381;
  for (const character of seed) {
    hash = ((hash << 5) + hash + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}
```

**Single instance per `runSimulation` call** (RS-5). The mulberry32 instance is created once at the top of `runSimulation`, passed down to:
- Each per-game `SimulationMoveContext.random.Shuffle` (drives deck reshuffles inside dispatched moves).
- Each `AIPolicy.decideTurn` call indirectly — but the policy closes over its own mulberry32 instance created at `createRandomPolicy(seed)` time, so there are actually **two seed domains**: one scoped to `runSimulation` (shuffle domain), one scoped to each `createRandomPolicy` call (decision domain). This separation is intentional: the policy's seed can differ from the run's seed, and future tests can reseed one domain without perturbing the other.

`createRandomPolicy(seed)` returns an `AIPolicy` whose `decideTurn` closes over its own mulberry32 instance. Calling `createRandomPolicy(seed).decideTurn(view, moves)` then `.decideTurn(view, moves)` again with the same args must NOT return the same result — the PRNG advances stateful. Test #3 proves same-seed/same-sequence determinism by calling `createRandomPolicy(seed).decideTurn(view, moves)` once vs `createRandomPolicy(seed).decideTurn(view, moves)` once (two fresh policies with the same seed) — identical first-call output.

### `SimulationMoveContext` — exact shape (RS-4)

Place in `simulation.runner.ts` as a file-local interface:

```ts
// why: move functions destructure FnContext<LegendaryGameState> & { playerID }
// from boardgame.io. Simulation cannot import boardgame.io (engine category
// rule), so a local structural interface provides the minimum fields moves
// actually destructure. Events are no-ops because simulation does not trigger
// phase/turn transitions from outside moves — moves trigger them internally
// via the same paths as multiplayer. random.Shuffle uses the run's mulberry32
// instance for deterministic deck reshuffles. Pattern: D-2801 (local
// structural interface) + D-2705 (static MOVE_MAP).
interface SimulationMoveContext {
  readonly G: LegendaryGameState;
  readonly playerID: string;
  readonly ctx: {
    readonly phase: string;
    readonly turn: number;
    readonly currentPlayer: string;
    readonly numPlayers: number;
  };
  readonly events: {
    setPhase: (name: string) => void;
    endTurn: () => void;
  };
  readonly random: {
    Shuffle: <T>(deck: T[]) => T[];
  };
}
```

- `events.setPhase` and `events.endTurn` are **no-op functions** — simulation manages phase/turn externally via `ctx` field updates. The move calls these but the simulation does not honor them structurally; it tracks phase/turn separately.
- `random.Shuffle` uses the run's mulberry32 to Fisher-Yates-shuffle the array, returning a new array (not mutating input).

### `SimulationLifecycleContext` — exact shape (for getLegalMoves)

Place in `ai.legalMoves.ts` as a file-local interface:

```ts
// why: getLegalMoves needs phase + currentStage + turn to determine
// which moves are legal. This is the minimum ctx subset for enumeration
// — a smaller analog of SimulationMoveContext.ctx. Local per D-2801.
interface SimulationLifecycleContext {
  readonly phase: string;
  readonly turn: number;
  readonly currentPlayer: string;
  readonly numPlayers: number;
}
```

### `SIMULATION_MOVE_NAMES` (RS-15) — exact tuple

Place in `ai.legalMoves.ts`:

```ts
// why: simulation covers the play-phase only; lobby moves
// (setPlayerReady, startMatchIfReady) are excluded because
// runSimulation starts the simulation post-lobby via
// buildInitialGameState + manual ctx.phase = 'play'. Local constant
// per WP-032 D-3202 precedent — NOT a drift-pinned canonical array;
// adding a new play-phase move in a future WP requires updating this
// constant explicitly.
const SIMULATION_MOVE_NAMES = [
  'drawCards',
  'playCard',
  'endTurn',
  'advanceStage',
  'revealVillainCard',
  'fightVillain',
  'recruitHero',
  'fightMastermind',
] as const;

type SimulationMoveName = typeof SIMULATION_MOVE_NAMES[number];
```

### Legal-move enumeration order (RS-13) — locked

`getLegalMoves` must return a `LegalMove[]` in this exact order:

1. `playCard` intents — hand zone index ascending (0..N-1 over `G.playerZones[activePlayer].hand`), one `LegalMove` per hand card.
2. `recruitHero` intents — HQ slot 0..4 ascending, one `LegalMove` per non-null slot with sufficient `availableRecruit`.
3. `fightVillain` intents — City slot 0..4 ascending, one `LegalMove` per non-null slot with sufficient `availableAttack`.
4. `fightMastermind` intents — at most one entry (active mastermind) if `availableAttack` meets the current tactic cost.
5. `revealVillainCard` — one entry if `G.currentStage === 'start'`.
6. `drawCards` — one entry if the current stage permits it (per stage-gating table in `.claude/rules/game-engine.md`).
7. `advanceStage` — one entry if `G.currentStage !== 'cleanup'`.
8. `endTurn` — one entry if `G.currentStage === 'cleanup'`.

Return statement must carry a `// why: ordering locked by pre-flight RS-13 for deterministic seeded selection; reordering silently flips every seeded decision` comment.

### Test #7 assertion pattern (RS-14) — locked

Test #7 asserts hidden-state protection. The active-player filter yields a `UIState` where only the viewing player's `handCards` is populated. Use the canonical assertion pattern from `src/ui/uiState.filter.test.ts:89-102`:

```ts
const player0 = filteredState.players.find((player) => player.playerId === '0')!;
const player1 = filteredState.players.find((player) => player.playerId === '1')!;

// For audience { kind: 'player', playerId: '0' }:
assert.ok(
  player0.handCards !== undefined,
  'Active player must see own handCards',
);
assert.equal(
  player1.handCards,
  undefined,
  'Other player handCards must be undefined (redacted)',
);
```

Do NOT use `assert.strictEqual(handCards, undefined)` — the canonical pattern is `assert.equal`. Do NOT assert `handCards.length === 0` — `redactHandCards` omits the key entirely.

### 200-turn safety cap (RS-7) — locked

`runSimulation` per-game loop:

```ts
const MAX_TURNS_PER_GAME = 200;
// why: safety cap to prevent infinite loops in degenerate states
// (e.g., policy unable to find terminating moves). 200 is well above
// any realistic Legendary game length (~20–40 turns). Games hitting
// the cap are counted as "stuck" and contribute to averageTurns with
// value 200 and winRate contribution 0. Not a gameplay rule.
```

A game terminates on either:
- `G.counters[ESCAPED_VILLAINS] >= 8` (endgame loss per existing `evaluateEndgame`)
- `G.counters.mastermindDefeated === 1` (endgame win)
- `G.counters.schemeLoss === 1` (scheme loss)
- Turn counter reaches `MAX_TURNS_PER_GAME` (stuck)

Post-endgame statistics are collected from the post-endgame `UIState` projection (via `buildUIState(G, simulationCtx)`), not directly from `G`.

### Zero-legal-moves fallback (RS-6) — locked

If `getLegalMoves` returns `[]`, the random policy returns (in priority order):
1. `endTurn` intent, if stage is `'cleanup'`.
2. `advanceStage` intent, if stage is not `'cleanup'`.
3. If neither is legal (degenerate), the policy returns a `ClientTurnIntent` with `moveName: 'endTurn'` anyway — the simulation runner catches this, logs a warning to `G.messages`, and terminates the game as "stuck" (bypass the turn cap early).

Random policy code:

```ts
decideTurn(playerView, legalMoves) {
  if (legalMoves.length === 0) {
    // why: zero-legal-moves fallback per pre-flight RS-6.
    // Random policy prefers endTurn when degenerate to avoid
    // infinite loops inside the simulation runner.
    return {
      playerID: playerView.game.activePlayerId,
      moveName: 'endTurn',
      moveArgs: undefined,
      intentTurn: playerView.game.turn,
    };
  }
  const index = Math.floor(nextRandom() * legalMoves.length);
  const chosen = legalMoves[index]!;
  return {
    playerID: playerView.game.activePlayerId,
    moveName: chosen.name,
    moveArgs: chosen.args,
    intentTurn: playerView.game.turn,
  };
}
```

(Note: `nextRandom()` here is the policy's own mulberry32 closure, NOT `Math.random` — Verification Step 4 greps `Math\.random` expecting zero output.)

### Statistics aggregation (RS-12) — locked sources

Per-game statistics are sampled from the **post-endgame `UIState`** (built via `buildUIState(finalG, { phase: 'end', turn: finalTurn, currentPlayer: '0' })`), NOT from `FinalScoreSummary` and NOT from direct G access:

- **`gamesPlayed`** = config.games (all games, including stuck).
- **`winRate`** = count of games where `gameOver?.outcome === 'victory'` / `gamesPlayed`. Winner determination uses `computeFinalScores` called from within the simulation runner (it's already exported from `scoring/computeFinalScores.ts`).
- **`averageTurns`** = sum of per-game `turn` counters / `gamesPlayed`. Stuck games contribute 200.
- **`averageScore`** = sum of per-game highest `totalVP` (across all players) / `gamesPlayed`, using `FinalScoreSummary.players[i].totalVP`.
- **`escapedVillainsAverage`** = sum of per-game `UIProgressCounters.escapedVillains` / `gamesPlayed`. **Source:** `uiState.progress.escapedVillains`.
- **`woundsAverage`** = sum of per-game `sum(uiState.players[i].woundCount)` / `gamesPlayed`.
- **`seed`** = `config.seed` verbatim.

Aggregator uses `for...of` over a `perGame: Array<{ turns, winnerVP, escapedVillains, totalWounds, isVictory }>` array. **No `.reduce()`.**

### Governance Decisions (landed in Commit A)

At minimum, Commit A must add (or verify already landed) the following DECISIONS.md entries:

1. **D-0701 (already landed)** — reinforce citation in `ai.types.ts` `// why:` comment.
2. **D-0702 (already landed)** — reinforce citation in STATUS.md update.
3. **D-36NN (new, at minimum 3 entries):**
   - *AI Uses the Same Pipeline as Humans* — justification for `ClientTurnIntent` submission; why no "special AI API"; prevents shortcut hidden paths.
   - *Random Policy Is the MVP Baseline* — why random rather than heuristic for first policy; future policies plug into the same `AIPolicy` interface without refactor.
   - *Simulation Seed Reproducibility* — why a single mulberry32 instance per run; why djb2 for seed hashing; relation to D-2704 PRNG capability gap.

Assign IDs by scanning the highest existing `D-##` in DECISIONS.md and continuing the sequence. If D-3601 is already landed in A0, the new entries start at D-3602 (or whichever is next unused).

---

## Hard Stops (Stop Immediately If Any Occur)

- Any `import ... from 'boardgame.io'` in any simulation file
- Any `import ... from '@legendary-arena/registry'` in any simulation file
- Any `import ... from '../replay/...'` or `'../network/...'` at runtime (type-only imports OK)
- Any `.reduce()` in simulation logic
- Any `Math.random()` in simulation files
- Any `require()` in any file
- Any IO, network, filesystem, or environment access in simulation files
- Any modification to gameplay logic (moves, phases, hooks, rules, endgame, turn, villainDeck)
- Any modification to `game.ts`
- Any modification to `buildInitialGameState`, `buildUIState`, or `filterUIStateForAudience`
- Any new G fields, moves, phases, stages, or trigger names
- Any modification to `makeMockCtx`, `FinalScoreSummary`, or any shared test helper
- Any files modified outside the allowlist (see Scope Lock below)
- Any attempt to call `Game.setup()` or import `LegendaryGame`
- Any storage of `AIPolicy` (or any function) in `G`
- Any call to `crypto`, `node:crypto`, or external hashing libraries (djb2 inline is sufficient)
- Expanding scope beyond WP-036 (no "while I'm here" improvements)

---

## AI Agent Warning (Strict)

The simulation framework is **observation and analysis only**. It does NOT participate in live gameplay. AI is tooling, not gameplay (D-0701).

**Do NOT:**
- Modify any gameplay logic or move implementations
- Import `boardgame.io` in any simulation file (move files import it, but simulation files must not — the grep check verifies this)
- Import `Game.setup()` or `LegendaryGame` — use `buildInitialGameState` directly per D-2702
- Attempt to use `makeMockCtx`'s shuffle as the simulation PRNG — implement mulberry32 locally per D-2704 + RS-1
- Add new fields to `LegendaryGameState`, `FinalScoreSummary`, or `UIState`
- Store `AIPolicy` (a function) in `G`
- Use `boardgame.io/testing` in any file
- Import registry package types — use `CardRegistryReader` local interface per PS-2 correction + D-2504

**Instead:**
- Call `buildInitialGameState(config, registry, setupContext)` directly with a `SetupContext` from `makeMockCtx`
- Build a static `MOVE_MAP` mapping `SimulationMoveName` → imported move function (8 entries)
- Construct minimal `SimulationMoveContext` objects for each move call
- Use the run's mulberry32 instance for all randomness (Shuffle + decision selection)
- Read post-endgame statistics from `UIState` (via `buildUIState`) — not from raw `G`
- Use `for...of` everywhere; never `.reduce()`

---

## Implementation Tasks (Authoritative)

### A) Create `packages/game-engine/src/simulation/ai.types.ts` (new)

**No boardgame.io imports. No registry imports.**

**Imports:**

```ts
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { UIState } from '../ui/uiState.types.js';
import type { ClientTurnIntent } from '../network/intent.types.js';
```

**Exports:**

```ts
// why: AI receives filterUIStateForAudience with player audience —
// same visibility as a human player. AI is tooling, not gameplay
// (D-0701). AIPolicy lives outside G; simulation is an external
// consumer of the engine pipeline. See D-0702 for the balance-
// validation motivation.

/**
 * A single legal move available to the AI policy.
 *
 * Name is one of the 8 play-phase move names listed in
 * SIMULATION_MOVE_NAMES (ai.legalMoves.ts). Args is a deliberate
 * wide type matching ClientTurnIntent.moveArgs.
 */
export interface LegalMove {
  readonly name: string;
  readonly args: unknown;
}

/**
 * Pluggable AI decision interface.
 *
 * The AI policy receives an audience-filtered UIState (the same
 * projection a human player sees) and the list of legal moves,
 * and returns a ClientTurnIntent to be submitted through the
 * same validation + dispatch pipeline as humans.
 *
 * Forbidden behaviors:
 * - caching or memoizing across calls
 * - closing over G, ctx, or any engine internal
 * - retaining state between calls that would affect the next
 *   call's output
 * - reading or writing any external resource
 *
 * These are forbidden permanently, not just at MVP.
 */
export interface AIPolicy {
  readonly name: string;
  decideTurn(
    playerView: UIState,
    legalMoves: LegalMove[],
  ): ClientTurnIntent;
}

/**
 * Parameters for a simulation run.
 *
 * policies[i] is applied when playerID === String(i). policies.length
 * must match the player count derived from setupConfig, or the
 * runner returns a zeroed SimulationResult with a warning.
 */
export interface SimulationConfig {
  readonly games: number;
  readonly seed: string;
  readonly setupConfig: MatchSetupConfig;
  readonly policies: AIPolicy[];
}

/**
 * Aggregate statistics from a simulation run.
 *
 * All six numeric fields are derived from per-game UIState
 * projections — never from direct G access. JSON-serializable.
 */
export interface SimulationResult {
  readonly gamesPlayed: number;
  readonly winRate: number;
  readonly averageTurns: number;
  readonly averageScore: number;
  readonly escapedVillainsAverage: number;
  readonly woundsAverage: number;
  readonly seed: string;
}
```

No other content in this file. No helper functions. No constants.

---

### B) Create `packages/game-engine/src/simulation/ai.random.ts` (new)

**No boardgame.io imports. No registry imports. No `Math.random()`. No `.reduce()`.**

**Imports:**

```ts
import type { AIPolicy, LegalMove } from './ai.types.js';
import type { UIState } from '../ui/uiState.types.js';
import type { ClientTurnIntent } from '../network/intent.types.js';
```

**File-local helpers (NOT exported):**

- `createMulberry32(seed: number): () => number` — per RS-1 locked implementation above.
- `hashSeedString(seed: string): number` — djb2 per RS-1 locked implementation above.

**Exported function:**

```ts
/**
 * Creates a random AI policy backed by a seeded mulberry32 PRNG.
 *
 * Deterministic: same seed + same (playerView, legalMoves) sequence
 * produces identical decisions across calls.
 *
 * // why: random policy establishes baseline for balance measurement;
 * more sophisticated policies (heuristic, MCTS, neural) are future
 * work and will plug into the same AIPolicy interface without
 * refactor. Per D-2704 capability gap, makeMockCtx is not a seeded
 * PRNG — the policy implements its own mulberry32 instance.
 */
export function createRandomPolicy(seed: string): AIPolicy {
  const seedNumber = hashSeedString(seed);
  const nextRandom = createMulberry32(seedNumber);

  return {
    name: `random-${seed}`,
    decideTurn(playerView: UIState, legalMoves: LegalMove[]): ClientTurnIntent {
      if (legalMoves.length === 0) {
        // why: zero-legal-moves fallback per pre-flight RS-6.
        return {
          playerID: playerView.game.activePlayerId,
          moveName: 'endTurn',
          moveArgs: undefined,
          intentTurn: playerView.game.turn,
        };
      }
      const index = Math.floor(nextRandom() * legalMoves.length);
      const chosen = legalMoves[index]!;
      return {
        playerID: playerView.game.activePlayerId,
        moveName: chosen.name,
        moveArgs: chosen.args,
        intentTurn: playerView.game.turn,
      };
    },
  };
}
```

Verify the `ClientTurnIntent` shape at the top of the session by reading `network/intent.types.ts:35` — field names may differ slightly (e.g., `moveArgs` vs `args`, presence of `clientTimestamp`). **Copy WP-032's shape verbatim; do not invent field names.** If the actual shape diverges from the above, STOP and correct this session prompt (amendment A-036-02) before continuing.

---

### C) Create `packages/game-engine/src/simulation/ai.legalMoves.ts` (new)

**No boardgame.io imports. No registry imports. No `.reduce()`.**

**Imports:**

```ts
import type { LegendaryGameState } from '../types.js';
import type { LegalMove } from './ai.types.js';
```

**File-local:**

```ts
// why: simulation covers the play-phase only; lobby moves are excluded
// per pre-flight RS-15 + WP-032 D-3202 precedent. Adding a new play-phase
// move requires updating this constant explicitly — not drift-pinned.
const SIMULATION_MOVE_NAMES = [
  'drawCards',
  'playCard',
  'endTurn',
  'advanceStage',
  'revealVillainCard',
  'fightVillain',
  'recruitHero',
  'fightMastermind',
] as const;

type SimulationMoveName = typeof SIMULATION_MOVE_NAMES[number];

// why: minimum ctx subset for legal-move enumeration; smaller analog
// of SimulationMoveContext.ctx. Local per D-2801.
interface SimulationLifecycleContext {
  readonly phase: string;
  readonly turn: number;
  readonly currentPlayer: string;
  readonly numPlayers: number;
}
```

**Exported function:**

```ts
/**
 * Enumerates all legal moves for the active player.
 *
 * Pure function — deterministic, no side effects, no G mutation.
 * Return order is canonical (pre-flight RS-13) so seeded selection
 * is stable across refactors.
 *
 * // why: AI can only choose from legal moves — same constraint as
 * human players. Pre-flight RS-13 locks enumeration order: playCard
 * (hand asc) → recruitHero (HQ 0..4) → fightVillain (City 0..4) →
 * fightMastermind → revealVillainCard (if start) → drawCards (if
 * legal) → advanceStage (if not cleanup) → endTurn (if cleanup).
 * Reordering silently flips every seeded decision output.
 */
export function getLegalMoves(
  gameState: LegendaryGameState,
  context: SimulationLifecycleContext,
): LegalMove[] {
  const legalMoves: LegalMove[] = [];
  const activePlayer = context.currentPlayer;
  const zones = gameState.playerZones[activePlayer];
  if (zones === undefined) {
    // why: fail-closed — active player has no zones (malformed state).
    // Return empty list; runner's zero-legal-moves fallback handles it.
    return legalMoves;
  }

  // 1. playCard intents — hand zone index ascending
  for (let index = 0; index < zones.hand.length; index++) {
    legalMoves.push({ name: 'playCard', args: { cardIndex: index } });
  }

  // 2. recruitHero intents — HQ slot 0..4 ascending (if affordable)
  // [...iterate G.hq.slots, check availableRecruit vs card cost...]

  // 3. fightVillain intents — City slot 0..4 ascending (if affordable)
  // [...iterate G.city.spaces, check availableAttack vs card attack...]

  // 4. fightMastermind — single entry if affordable
  // [...check G.mastermind.currentTactic.fightCost vs availableAttack...]

  // 5. revealVillainCard — if currentStage === 'start'
  if (gameState.currentStage === 'start') {
    legalMoves.push({ name: 'revealVillainCard', args: {} });
  }

  // 6. drawCards — per stage-gating table (start, main)
  if (gameState.currentStage === 'start' || gameState.currentStage === 'main') {
    legalMoves.push({ name: 'drawCards', args: { count: 1 } });
  }

  // 7. advanceStage — if currentStage !== 'cleanup'
  if (gameState.currentStage !== 'cleanup') {
    legalMoves.push({ name: 'advanceStage', args: {} });
  }

  // 8. endTurn — if currentStage === 'cleanup'
  if (gameState.currentStage === 'cleanup') {
    legalMoves.push({ name: 'endTurn', args: {} });
  }

  // why: ordering locked by pre-flight RS-13 for deterministic seeded
  // selection; reordering silently flips every seeded decision.
  return legalMoves;
}
```

**Implementation note:** The pseudocode blocks marked `[...]` above must be filled in by reading the actual shapes of `G.playerZones[activePlayer]`, `G.hq`, `G.city`, `G.mastermind`, and the economy fields (attack / recruit availability). Read `LegendaryGameState` in `types.ts` (lines 216-343 per WP-027 session prompt reference) plus `economy/economy.logic.ts` for the availability helpers. Use the same logic as existing stage-gating + affordability checks in `fightVillain.ts` / `recruitHero.ts` / `fightMastermind.ts`. Do NOT invent new affordability rules; mirror what the move-internal validators check. If an affordability check would require importing a helper not currently exported, STOP and escalate — do not add new exports under WP-036 scope.

---

### D) Create `packages/game-engine/src/simulation/simulation.runner.ts` (new)

**No boardgame.io imports. No registry imports. No `.reduce()`. No `Math.random()`.**

**Imports:**

```ts
import type { LegendaryGameState } from '../types.js';
import type { CardRegistryReader } from '../matchSetup.validate.js';
import type { SimulationConfig, SimulationResult, LegalMove } from './ai.types.js';

import { buildInitialGameState } from '../setup/buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { buildUIState } from '../ui/uiState.build.js';
import { filterUIStateForAudience } from '../ui/uiState.filter.js';
import { getLegalMoves } from './ai.legalMoves.js';
import { computeFinalScores } from '../scoring/computeFinalScores.js';

// Move function imports (same set as WP-027 replay.execute.ts, minus lobby)
import { drawCards, playCard, endTurn } from '../moves/coreMoves.impl.js';
import { revealVillainCard } from '../villainDeck/villainDeck.reveal.js';
import { fightVillain } from '../moves/fightVillain.js';
import { recruitHero } from '../moves/recruitHero.js';
import { fightMastermind } from '../moves/fightMastermind.js';
import { advanceTurnStage } from '../turn/turnLoop.js';
```

**File-local:**

```ts
const MAX_TURNS_PER_GAME = 200;

// why: move functions destructure FnContext<LegendaryGameState> & { playerID }.
// Simulation cannot import boardgame.io — local structural interface with
// minimum fields moves actually destructure (D-2801 pattern). Events are
// no-ops; random uses the run's mulberry32 for deterministic Shuffle
// (D-2705 + D-2704 pattern).
interface SimulationMoveContext {
  readonly G: LegendaryGameState;
  readonly playerID: string;
  readonly ctx: {
    readonly phase: string;
    readonly turn: number;
    readonly currentPlayer: string;
    readonly numPlayers: number;
  };
  readonly events: {
    setPhase: (name: string) => void;
    endTurn: () => void;
  };
  readonly random: {
    Shuffle: <T>(deck: T[]) => T[];
  };
}

type MoveFn = (context: SimulationMoveContext, args?: unknown) => void;

// why: advanceStage is a local function in game.ts (not exported). Per D-2705
// (WP-027 precedent), reconstruct by calling advanceTurnStage directly.
function simulationAdvanceStage(context: SimulationMoveContext): void {
  advanceTurnStage(context.G, { events: { endTurn: context.events.endTurn } });
}

const MOVE_MAP: Record<string, MoveFn> = {
  drawCards: (context, args) => drawCards(context as never, args as never),
  playCard: (context, args) => playCard(context as never, args as never),
  endTurn: (context) => endTurn(context as never),
  advanceStage: (context) => simulationAdvanceStage(context),
  revealVillainCard: (context) => revealVillainCard(context as never),
  fightVillain: (context, args) => fightVillain(context as never, args as never),
  recruitHero: (context, args) => recruitHero(context as never, args as never),
  fightMastermind: (context, args) => fightMastermind(context as never, args as never),
};

// mulberry32 + djb2 helpers — inlined here from the pattern in ai.random.ts.
// NOT exported. NOT shared via a common file (WP-036 scope is 4 files only;
// duplicating the ~20-line implementation in two files is cheaper than
// adding a 5th file and an EC amendment).
```

**Exported function:**

```ts
/**
 * Executes N games with the supplied AI policies and returns aggregate
 * statistics.
 *
 * Uses the full engine pipeline: buildInitialGameState → loop (buildUIState
 * → filterUIStateForAudience → getLegalMoves → policy.decideTurn → validate
 * → dispatch move) → evaluateEndgame → computeFinalScores. Same pipeline
 * as multiplayer per D-0701.
 *
 * Pure function — deterministic, no side effects beyond returning the
 * result object. No IO.
 *
 * // why: simulation uses the full engine pipeline — same as multiplayer.
 * AI decisions are validated the same way human decisions are. Balance
 * changes require simulation validation (D-0702). Registry is consumed at
 * setup-time only via CardRegistryReader (local structural interface per
 * PS-2 + D-2504), never imported as CardRegistry from the registry package.
 */
export function runSimulation(
  config: SimulationConfig,
  registry: CardRegistryReader,
): SimulationResult {
  // Validation: games count, policies length, seed non-empty
  // Construct run-level mulberry32 instance
  // Per-game loop (for...of over an array built with new Array(config.games).fill(0).map(...))
  //   Construct SetupContext, call buildInitialGameState
  //   Per-turn loop (for...of, bounded by MAX_TURNS_PER_GAME)
  //     Build UIState, filter for active player, get legal moves
  //     Call policies[Number(activePlayer)].decideTurn
  //     Dispatch via MOVE_MAP; if unknown move name, warn + skip
  //     Check endgame; if terminated, collect per-game stats
  //   If turn cap hit, collect "stuck" stats
  // Aggregate per-game stats via for...of (no .reduce())
  // Return SimulationResult
}
```

**Implementation note:** fill in the loop bodies per the Locked Values above. The canonical source for endgame detection is `evaluateEndgame(G)` — check if this is already called inside `endTurn` or if the runner needs to call it explicitly. Read `packages/game-engine/src/endgame/evaluateEndgame.ts` at session start. Use `for...of`, never `.reduce()`. Every `Math.floor(prng() * ...)` uses the run's mulberry32, never `Math.random()`.

---

### E) Modify `packages/game-engine/src/types.ts`

Add re-exports for simulation types at the end of the file, after the existing re-exports:

```ts
// Simulation types (WP-036)
export type {
  AIPolicy,
  LegalMove,
  SimulationConfig,
  SimulationResult,
} from './simulation/ai.types.js';
```

Do NOT add any new fields to `LegendaryGameState`. Do NOT touch any other part of `types.ts`.

---

### F) Modify `packages/game-engine/src/index.ts`

Add exports after the existing exports (mirror the replay-harness export block pattern):

```ts
// Simulation framework (WP-036)
export type {
  AIPolicy,
  LegalMove,
  SimulationConfig,
  SimulationResult,
} from './simulation/ai.types.js';
export { createRandomPolicy } from './simulation/ai.random.js';
export { getLegalMoves } from './simulation/ai.legalMoves.js';
export { runSimulation } from './simulation/simulation.runner.js';
```

No other changes.

---

### G) Create `packages/game-engine/src/simulation/simulation.test.ts` (new)

**Uses `node:test` and `node:assert` only. Uses `makeMockCtx`. No boardgame.io imports. No `@legendary-arena/registry` imports. No `boardgame.io/testing`.**

Exactly **8 tests** inside **one** `describe('simulation framework (WP-036)')` block — matches the locked 444 / 110 baseline shift (RS / pre-flight Test Expectations).

**Test setup** — build shared fixtures in the file's top-level `const`s (not inside `describe`):

- A minimal `MatchSetupConfig` fixture. Use the same pattern as existing test files (e.g., `setup/buildInitialGameState.test.ts`). Read those files at session start.
- A minimal `CardRegistryReader` mock: `{ listCards: () => [] }`. Some tests may need a richer mock if `buildInitialGameState` exercises `registry.listCards()` — mirror the shape used in `setup/buildInitialGameState.test.ts`.

**Tests (exact order per WP-036 §G):**

```ts
import { describe, test } from 'node:test';
import { strict as assert } from 'node:assert';

// ... imports and fixtures ...

describe('simulation framework (WP-036)', () => {
  test('createRandomPolicy returns an AIPolicy with decideTurn function', () => {
    // ... shape assertion on returned AIPolicy ...
  });

  test('random policy produces valid ClientTurnIntent for legal moves', () => {
    // ... construct a UIState + LegalMove[], call decideTurn, assert
    //     shape matches ClientTurnIntent; moveName is one of the 8
    //     SIMULATION_MOVE_NAMES or 'endTurn' fallback ...
  });

  test('same seed produces identical decisions (deterministic)', () => {
    // ... createRandomPolicy('seed-a') twice, call decideTurn once
    //     on each with identical (view, moves), assert identical
    //     output ...
  });

  test('different seed produces different decisions', () => {
    // ... createRandomPolicy('seed-a') vs createRandomPolicy('seed-b'),
    //     call decideTurn on each, assert at least one field differs
    //     for a legalMoves.length > 1 input. If both seeds happen to
    //     pick the same index, the test must use a longer legalMoves
    //     array to make the probability negligible — document in
    //     `// why:` comment ...
  });

  test('getLegalMoves returns non-empty list during active game', () => {
    // ... buildInitialGameState + manual ctx.phase = 'play', call
    //     getLegalMoves, assert returned array length > 0 ...
  });

  test('runSimulation with 2 games produces aggregate SimulationResult', () => {
    // ... construct SimulationConfig with games: 2, call runSimulation,
    //     assert result.gamesPlayed === 2 and all six numeric fields
    //     are finite numbers ...
  });

  test('AI does not see hidden state (filtered UIState has no hand cards for opponents)', () => {
    // RS-14 locked assertion pattern:
    // ... build a UIState with handCards populated for all players,
    //     call filterUIStateForAudience with audience { kind: 'player',
    //     playerId: '0' }, find player0 and player1 in filtered.players,
    //     assert.ok(player0.handCards !== undefined, ...),
    //     assert.equal(player1.handCards, undefined, ...) ...
  });

  test('simulation results are JSON-serializable', () => {
    // ... call runSimulation, call JSON.stringify(result), assert no
    //     throw; call JSON.parse back, assert deepStrictEqual to the
    //     original result ...
  });
});
```

**Tests must use contract-enforcement framing (WP-028 precedent)** — if a test fails, the implementation is incorrect. Do NOT weaken assertions to make tests pass. Do NOT add or remove tests without a pre-flight amendment.

---

## Scope Lock (Authoritative)

### WP-036 Is Allowed To

- **Create:** `packages/game-engine/src/simulation/ai.types.ts`
- **Create:** `packages/game-engine/src/simulation/ai.random.ts`
- **Create:** `packages/game-engine/src/simulation/ai.legalMoves.ts`
- **Create:** `packages/game-engine/src/simulation/simulation.runner.ts`
- **Create:** `packages/game-engine/src/simulation/simulation.test.ts`
- **Modify:** `packages/game-engine/src/types.ts` — re-export simulation types only (no other changes)
- **Modify:** `packages/game-engine/src/index.ts` — export simulation API only (no other changes)
- **Update governance:** `docs/ai/STATUS.md`, `docs/ai/DECISIONS.md` (add at minimum three new D-entries), `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`

### WP-036 Is Explicitly NOT Allowed To

- Modify any gameplay logic (moves, phases, hooks, rules, endgame, turn, villainDeck, scheme, mastermind, hero, economy)
- Modify `game.ts`, `buildInitialGameState`, `buildUIState`, `filterUIStateForAudience`, `computeFinalScores`, `FinalScoreSummary`, `UIState`, `ClientTurnIntent`
- Import `boardgame.io` in any simulation file
- Import `@legendary-arena/registry` in any file
- Use `.reduce()` in simulation logic
- Use `Math.random()` in any simulation file
- Use `require()` in any file
- Use `crypto` / `node:crypto` / external hashing libraries
- Add new fields to `LegendaryGameState`, `FinalScoreSummary`, `UIState`, or any existing type
- Add new moves, phases, stages, trigger names, or canonical array entries
- Modify `makeMockCtx` or any shared test helper
- Modify any files not listed above
- Implement seed-faithful replay (not in scope; WP-036 is AI simulation, not replay upgrade)
- Expand `CORE_MOVE_NAMES` / `CoreMoveName`
- Persist `SimulationResult` to disk / database / R2
- Store `AIPolicy` (or any function) in `G`

---

## Verification Steps

Run these commands **after implementation is complete**, before checking Definition of Done:

```bash
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — 444 tests, 110 suites, 0 fail

# Step 3 — confirm no boardgame.io import in simulation files (escape dots per P6-22)
grep -rn "from ['\"]boardgame\.io" packages/game-engine/src/simulation/
# Expected: no output

# Step 4 — confirm no Math.random in simulation (escape dot per P6-22)
grep -rn "Math\.random" packages/game-engine/src/simulation/
# Expected: no output

# Step 5 — confirm no .reduce() (escape both parens + dot per P6-22 + WP-033 P6-22 confirmation)
grep -rn "\.reduce(" packages/game-engine/src/simulation/
# Expected: no output

# Step 6 — confirm no engine gameplay files modified
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/ packages/game-engine/src/setup/ packages/game-engine/src/turn/ packages/game-engine/src/ui/ packages/game-engine/src/scoring/ packages/game-engine/src/endgame/ packages/game-engine/src/villainDeck/ packages/game-engine/src/network/ packages/game-engine/src/replay/
# Expected: no output

# Step 7 — confirm no require() anywhere in simulation (escape paren per P6-22)
grep -rn "require\(" packages/game-engine/src/simulation/
# Expected: no output

# Step 8 — confirm no @legendary-arena/registry import in simulation
grep -rn "@legendary-arena/registry" packages/game-engine/src/simulation/
# Expected: no output

# Step 9 — confirm no files outside scope modified
git diff --name-only
# Expected: only files listed in Scope Lock (4 new simulation files + 1 test + types.ts + index.ts + STATUS.md + DECISIONS.md + WORK_INDEX.md + EC_INDEX.md)

# Step 10 — confirm pnpm-lock.yaml unchanged (P6-44)
git diff --name-only pnpm-lock.yaml package.json packages/game-engine/package.json
# Expected: no output (no dependency changes)

# Step 11 — confirm SIMULATION_MOVE_NAMES is an 8-tuple (RS-15)
grep -A 10 "SIMULATION_MOVE_NAMES" packages/game-engine/src/simulation/ai.legalMoves.ts | head -12
# Expected: tuple visible with 8 entries

# Step 12 — confirm mulberry32 is file-local, not exported (RS-1)
grep -n "export.*mulberry32\|export.*createMulberry32" packages/game-engine/src/simulation/
# Expected: no output

# Step 13 — confirm test #7 uses canonical assertion pattern (RS-14)
grep -n "assert\.equal.*handCards.*undefined" packages/game-engine/src/simulation/simulation.test.ts
# Expected: at least one match
```

---

## Definition of Done

> Execute every verification command above before checking any item below. Reading the code is not sufficient — run the commands.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria in WP-036 pass (all 8 sub-sections: AI Policy, Random Policy, Legal Moves, Simulation Runner, Engine Isolation, Pure & Deterministic, Tests, Scope Enforcement)
- [ ] All EC-036 §After Completing items pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 with **444 / 110 / 0 fail** (+8 tests, +1 suite from 436 / 109 / 0 baseline)
- [ ] No boardgame.io import in simulation files (confirmed with escaped-dot grep)
- [ ] No `Math.random()` in simulation files (confirmed with escaped-dot grep)
- [ ] No `.reduce()` in simulation logic (confirmed with escaped grep)
- [ ] No `@legendary-arena/registry` import in any simulation file (confirmed with grep)
- [ ] No `require()` in any generated file (confirmed with escaped grep)
- [ ] No engine gameplay files modified (confirmed with targeted `git diff --name-only`)
- [ ] No files outside scope modified (confirmed with `git diff --name-only`)
- [ ] `pnpm-lock.yaml` and all `package.json` files unchanged (confirmed with `git diff --name-only`; P6-44)
- [ ] `SIMULATION_MOVE_NAMES` is an 8-entry `as const` tuple in `ai.legalMoves.ts` (RS-15)
- [ ] mulberry32 helper is file-local, not exported (RS-1)
- [ ] Test #7 uses `assert.equal(..., undefined, ...)` assertion pattern (RS-14)
- [ ] Legal-move enumeration order matches RS-13 lock (`// why:` comment present)
- [ ] 200-turn safety cap in place (RS-7)
- [ ] Post-endgame statistics sourced from `UIState`, NOT `FinalScoreSummary` or direct G (RS-12)
- [ ] `SimulationMoveContext` is a local 5-field structural interface (RS-4 + D-2801)
- [ ] Static `MOVE_MAP` dispatch per D-2705; `advanceStage` via `advanceTurnStage`
- [ ] `AIPolicy.decideTurn` JSDoc includes the "Forbidden behaviors" block (WP-028 projection-purity precedent)
- [ ] Every simulation file has the required `// why:` comment per EC-036 §Required `// why:` Comments
- [ ] 01.6 post-mortem authored at `docs/ai/post-mortems/01.6-WP-036-ai-playtesting-balance-simulation.md` with the five mandatory items covered (aliasing, extension seam, PRNG capability gap, forbidden-behaviors block, `// why:` completeness)
- [ ] `docs/ai/STATUS.md` updated — AI simulation framework exists; random policy baseline established; D-0701 + D-0702 implemented; balance changes can now be validated via simulation; three-commit topology recorded (A0 hash → A hash → B hash)
- [ ] `docs/ai/DECISIONS.md` updated — at minimum three new entries: same-pipeline-as-humans rationale, random-policy MVP baseline rationale, simulation-seed reproducibility rationale (D-36NN sequence). D-3601 already landed in A0.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` — WP-036 row flipped `[ ]` → `[x]` with today's date + Commit A hash (Commit B edit)
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` — EC-036 row flipped Draft → Done; summary counts updated; footer block prepended with post-execution summary (Commit B edit)
- [ ] Branch `wp-036-ai-playtesting` pushed to `origin` if the human requests
- [ ] Three-commit topology recorded: Commit A0 (SPEC, pre-flight bundle) → Commit A (EC-036, execution) → Commit B (SPEC, governance close)

---

## Final Instruction

WP-036 is the single-hop unblocker for ten downstream WPs (Phase 7 beta / launch / live-ops / growth / architecture + PAR simulation / storage / gate / identity / score-submission / public-leaderboards). Any scope drift here compounds into all ten.

If uncertainty surfaces during execution that this prompt + EC-036 + pre-flight do not resolve — **STOP and escalate**. Do not force-fit under 01.5 (not invoked). Do not invent new abstractions. Do not expand scope to resolve implementation friction — the WP-036 shape was locked for reasons validated by the 30-issue copilot check.

Once Commit A + Commit B + post-mortem land and Verification Steps 1–13 all pass, WP-036 is complete and Phase 7 downstream WPs are unblocked.

*Session prompt authored 2026-04-20 at `main @ cd811eb`, same session as the pre-flight + copilot check. Consumer: a fresh Claude Code session executing WP-036 after the A0 SPEC bundle lands.*
