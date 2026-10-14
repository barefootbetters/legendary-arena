# WP-810 — Replay-LAGN Producer: `GET /api/match/:matchId/replay-lagn` + LAGN Writer Flip to 1.7.0

**Status:** Draft 2026-10-13 — **BLOCKED on WP-808** (the 1.7.0 `replay.execution` contract must be executed first)
**Layer:** Server (`apps/server`) + Shared Tooling writer flip (`packages/lagn-spec`) + docs
**Dependencies:**
- WP-808 (LAGN 1.7.0 `replay.execution` reader contract) — not yet executed; this is the hard dependency.
- WP-641 ✅ / D-24453 (the result-LAGN producer this extends).
- WP-698 ✅ / D-24517 (the 1.6.0 writer).
- WP-334 ✅ / WP-335 ✅ / WP-336 ✅ / D-24119 / D-24124 (the faithful reducer replay + the `bgio.replay_artifacts` store).
- WP-805 ✅ / D-24700 (`G.isFirstPlayerRandom`).
**User-Visible Surface:** none — infrastructure (a new guest-readable API endpoint; no UI; a download control is a
separate later packet)
**Baseline:** `origin/main` @ `12a0158a` (the WP-810 / EC-847 / D-24716 reserve commit, #2778)
**EC:** EC-847 · **Decision:** D-24716 (reserved; landed Active at execution)

## Goal

A completed, non-operator match becomes downloadable as a **re-executable LAGN 1.7.0 document**. The new guest-readable
endpoint `GET /api/match/:matchId/replay-lagn` returns two things:

- the same content as the result-LAGN, built from **durable** sources;
- **plus** the WP-808 `replay.execution` block: the seed, the ordered moves by seat, the engine and data version, and
  the final-state hash.

The endpoint **verifies before it emits.** It re-executes the block from the seed alone, mapping the Tier-1 `setup` it
is about to emit back to setup data, and re-dispatches the moves. It then requires the resulting hash to equal a
**fresh** faithful reduction of the stored match on the same build.

So every document it hands out is proven re-executable on the build that served it. The packet also flips the LAGN
writer from 1.6.0 to 1.7.0, because the block's version gate requires it.

## Assumes

**Dependency**
- **WP-808 is executed** (`[x]` in WORK_INDEX), and **D-24714 is Active**. If WP-808 is not `[x]`, this packet is
  BLOCKED.
  - `packages/lagn-spec` exports `LAGN_VERSION_1_7_0`, and `ReplayExecution` / `ReplayExecutionMove` types.
  - `replay.execution` is gated to ≥ 1.7.0, and `LAGN_VERSION` is still `LAGN_VERSION_1_6_0`.

**Replay reads (`apps/server/src/replay/matchReplay.logic.ts`)**
- `reduceMatchToFinalState(artifact)` is pure. It re-dispatches only `MAKE_MOVE` through
  `CreateGameReducer({ game: LegendaryGame, isClient: false })`.
  - It **throws** on a null `initialState` or a log entry without `action`.
- `readReplayHashByMatchId(matchId, db)`.
- `readReplayArtifactByHash(replayHash, db)` returns `{ initialState, log } | null`.

**The durable store (`bgio.replay_artifacts`, migration 025)**
- `captureHarvester.js` captures every finished match about every 300 s.
- `matchReaper.js` deletes the live `bgio.matches` row about 1 hour after gameover, once `captured_at` is set.
- So the producer reads the **artifact**, never the live row. An artifact exists only for finished matches.

**Seed, log, and setup data**
- The seed is the non-empty string at `initialState.plugins.random.data.seed` (D-24119 landmine). It is minted by
  boardgame.io, or by WP-809's server game seed getter if WP-809 has executed. Either way, the replay seam
  `{ ...LegendaryGame, seed }` reproduces the initial state from it.
- A persisted `MAKE_MOVE` entry is `{ action: { type: 'MAKE_MOVE', payload: { type, args, playerID } }, _stateID,
  turn, phase, … }`.
  - Credentials are stripped before logging.
  - `args` is a positional array.
  - boardgame.io copies `ctx.gameover` into `metadata.gameover`, so the two shapes are equal.
- `boardgame.io/dist/cjs/internal.js` exports `InitializeGame` and `CreateGameReducer`.
  - `InitializeGame` runs `LegendaryGame.setup()`, which reads the module-global setup registry (`setRegistryForSetup`,
    set once at `server.mjs` startup).
  - `setup()` **throws** when `validateMatchSetup` rejects the config (`packages/game-engine/src/game.ts` ~L452–465).
- `initialState.G.matchConfiguration` is the verbatim stored setup data, and the hash covers it.
  - The engine writes `G.finalBlow` / `G.isDebugMatch` only when true, and `G.isFirstPlayerRandom: true` for 2+ seats
    (WP-805).
  - Unknown setup-data keys are not rejected.
- Every stored artifact was played under data version 2. The `CURRENT_DATA_VERSION` bump to 2 came with WP-137 / EC-137
  (2026-05-07), before durable match storage began with WP-309 (2026-07-05).

**Engine and server exports**
- The engine package exports `LegendaryGame`, `computeStateHash`, `getCurrentEngineVersion`, `formatEngineVersion`,
  `CURRENT_DATA_VERSION` (`{ version: 2 }`), `setRegistryForSetup`, and `clearRegistryForSetup`.
- `apps/server/src/version.mjs` `getVersionInfo().gitSha` is the serving build's short sha, or `'unknown'`.
- `apps/server/src/match/matchLagn.logic.ts` exports:
  - `buildMatchLagn(matchId, composition, numPlayers, resolveName)`;
  - `buildNameResolver`, `buildResultPlayers`, `toLagnResult(gameover | null)`, `toResultScore`, `toBattlePlanBlock`;
  - `buildResultMatchLagn(matchId, composition, numPlayers, resolveName, players, result, scoringProfile, battlePlan,
    score)`, where the optional members are typed `T | undefined`. It is construction-only.
- `apps/server/src/match/matchLagn.routes.ts`:
  - `registerMatchLagnRoutes(router, database, deps: MatchLagnRouteDependencies, logic = PRODUCTION_MATCH_LAGN_LOGIC)`,
    where `deps` is `{ registry }`;
  - the `MatchLagnLogic` seam;
  - each handler starts with `Cache-Control: no-store`, and errors are `{ error: <code> }`;
  - registered once in `server.mjs`.

**Rate limiter**
- `apps/server/src/match/tokenBucketRateLimiter.mjs` exports `createTokenBucketRateLimiter({ capacity, windowMs, now })`.
  - **`now` is required**; it is called on every `consume`.
  - The limiter returns `{ consume(key, count) }`, and `consume` returns `false` over the limit.
- `resolveRateLimitKey(koaContext)` returns `{ key, source }`.
- The injected-clock precedent is `apps/server/src/analytics/analytics.routes.ts`: an optional `now?: () => number` dep,
  then `resolveRateLimitKey` → `consume(key, n) === false` → 429.

If any line is false, this packet is **BLOCKED**.

## Context (Read First)

- `.claude/CLAUDE.md`.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary and §Persistence Boundary (the D-24095 carve-out blockquote).
- `.claude/rules/architecture.md` §Persistence Boundary (Cross-Layer).
- `.claude/rules/work-packets.md` §API Catalog Update Obligation.
- `docs/ai/DECISIONS.md`:
  - **D-24714** (contract + producer discipline);
  - **D-24119** / **D-24124**;
  - **D-24095** + **D-24153** / **D-24169** / **D-24187** / **D-24689** (the carve-out format);
  - **D-0205**;
  - **D-24689 §1 / §8**;
  - **D-24700**;
  - **D-24453** / **D-24517** (writer-flip precedents);
  - **D-24211**;
  - **D-5301** / **D-24126**;
  - **D-11804**.
- `docs/ai/work-packets/WP-808-lagn-tier3-execution-block.md` (Locked Contract Values + D-24714 Content).
- `docs/ai/work-packets/WP-641-lagn-1-5-0-producer.md` (the producer template).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §7f–§7g; `wiki/lagn-v1.md`; `docs/ai/REFERENCE/api-endpoints.md` (the
  `/lagn`, `/result-lagn`, and `POST /api/me/loadouts` rows).

### What verify-before-emit guarantees (and what it does not)

Both sides of the check run the **same stored moves on the same serving build**. They differ only in their initial
state: one side rebuilds it from the seed plus the emitted Tier-1 `setup`, and the other uses the stored
`initialState`.

**The guarantee:** the emitted block re-executes, on the build that served it, to a final `G` whose `computeStateHash` (a 32-bit djb2 over the canonical JSON of `G`, `diagnostics` excluded) equals that of the
stored match's fresh reduction on that build.

**What it catches:** every **setup-time** divergence.

- extra caller keys in the stored setup data, or an explicit `finalBlow: false`;
- multi-seat matches created before WP-805, which lack `isFirstPlayerRandom`;
- registry or setup-code drift since the match was created.

Setup throws (for example, a stored config the current registry rejects) are refusals too.

**What it does not catch:**

- **A tampered stored log.** The log is the source of both sides.
- **Move-processing changes since capture.** Both sides use the serving build, so the document is faithful to that
  build. That is the meaning of `engine_build`.
- **A stale `args` shape after a future data-axis bump.** Both sides read the same args. D-24716 §3 binds that case.

The reference is a **fresh** reduction, never the stored `replay_artifacts.replay_hash`. That stored hash was computed
at capture time, and later engine-fidelity changes legitimately move it, so comparing to it would refuse good matches.

### Scaffold result (RUN, not reasoned)

The draft worktree was at `927314ae`. Every scaffold was reverted.

**(A) Seed round trip.** A throwaway `node:test` in `apps/server/src/replay/` did the following:

- created a 2-seat match the way the live server does: plain `LegendaryGame`, so boardgame.io mints the seed;
- played 0, 3, or 8 completed turns;
- reduced the log;
- rebuilt from `{ ...LegendaryGame, seed }` with the same setup data and re-dispatched the logged `MAKE_MOVE`s.

| Turns | Moves | Reference | Rebuilt | Initial `G` equal |
|---|---|---|---|---|
| 0 | 3 | `fca4d08f` | `fca4d08f` | yes |
| 3 | 15 | `94d404a0` | `94d404a0` | yes |
| 8 | 35 | `66369295` | `66369295` | yes |

Two further results:

- **Lossy case:** when the live setup data carried an extra key, the rebuild **diverged** (`e3531878` ≠ `a07b0032`).
- **Stored-artifact key order:** the pre-flight reviewer independently simulated jsonb key reordering of a stored
  artifact, and the round trip still held at 0/3/8 turns. The reviewer also showed that tampering `args` inside the
  artifact does **not** diverge, since both sides read it, which confirms the "does not catch" list above.

**(B) Writer flip.** WP-808's contract was prototyped, then `LAGN_VERSION` was set to `LAGN_VERSION_1_7_0` and
`package.json` to `1.7.0`. After `pnpm -r build` (exit 0):

- **`@legendary-arena/lagn`: 108 / 14 fail.**
  - One failure is WP-808's own enum re-pin.
  - **13 belong to the flip:** the writer-stamp pins (~L653/939/1183/1450/1613), the migration-target and no-op cases
    (~L768–774/1113/1264/1464–1468/1587/1596–1602/1658), and "a document already at the current version is returned
    unchanged".
- **Other suites:** registry-viewer **329 / 0**, legends-board **135 / 0**, arena-client **2351 / 0**, and server
  **1767 / 0** (207 DB-skipped). The DB-wired `matchLagn*` + `loadoutLibrary*` tests ran **83 / 0 / 0 skipped**.
- **One more case moves on the flip:** WP-808's own "1.6.0 document untouched (the writer is 1.6.0)" migration case,
  added at its execution. It is in scope.

### Interplay

- **WP-809 (match-seed-entropy, drafted #2783)** changes how the seed is minted, not where it lives. The replay seam
  `{ ...game, seed }` is unchanged. No ordering constraint between WP-809 and this packet.
- **Deploy order.** registry-viewer and legends-board bundle the lagn reader. WP-808's 1.7.0 reader must be **live** on
  cards and legends before WP-810's server flips the writer. Otherwise deployed bundles would reject the 1.7.0 output of
  `/lagn` and `/result-lagn`. WP-808 merging first and deploying makes this hold; the DoD verifies it.
- **Pre-existing bug, out of scope.** `/lagn` and `/result-lagn` read the live row and so 404 after the reaper. This is
  tracked as a separate task chip.

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test`, and no `boardgame.io/testing`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`:
  - full-word names; JSDoc on every function; functions ~30 lines max;
  - no nested ternaries; no `.reduce()` with branching;
  - no `import *` beyond the existing boardgame.io dist-entry pattern;
  - full-sentence messages; `// why:` on every non-obvious rule.
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- No commit subject may contain a `.githooks/commit-msg` Rule 1 token. Write "operator match", never the flag name.

**Packet-specific:**
- **The server wires; the engine decides.** Re-execution goes only through boardgame.io `InitializeGame` /
  `CreateGameReducer` and the engine exports (D-24119). No move, phase, or turn rule is reimplemented, and `G` is not
  interpreted beyond the D-24716 reads.
- **Reads are limited to the D-24716 carve-out:**
  - the artifact `initial_state`: `G.matchConfiguration`, `G.isDebugMatch`, `ctx.numPlayers`,
    `plugins.random.data.seed`;
  - the artifact `log`: the `MAKE_MOVE` actions + their `turn` / `phase` stamps;
  - the **re-executed final `ctx.gameover`**, which becomes the LAGN `result` outcome;
  - the existing domain reads (players, battle plan, score).
  - The reference re-execution reduces the **full** artifact `initialState + log` (the D-24119 reconstruction). Producer
    code **reads** only the fields above, the two final-`G` `computeStateHash` values, and the rebuild's final
    `ctx.gameover`.
  - Never the `bgio.matches` row (its `state` / `metadata`). Nothing is written back, persisted, or cached across
    requests.
- **Verify before emit, always.** No code path returns `replay.execution` unless the hash equality held in that request.
- **Setup-time throws are refusals, not 500s.** A throw from `InitializeGame`, the rebuild reduction, or
  `reduceMatchToFinalState` becomes `not_reexecutable`.
- **Non-authoritative.** Nothing scores, credits, ranks, or verifies a competitive entry from the document, and no
  table is written.
- **Producer discipline (D-24714):**
  - finished matches only: an artifact exists;
  - operator matches are refused;
  - setup data that Tier-1 `setup` cannot reproduce is refused through the hash;
  - `metadata` (credentials) is never read.
- **Writer flip:** `LAGN_VERSION` and `package.json` move together in one commit (EC-422 lockstep). No `migrate.ts`
  change.
- **The `/lagn` and `/result-lagn` read sources are not edited.** Only their catalog rows' stamped version changes.

**Session protocol:** if WP-808 is not `[x]`, or any Assumes line is false, STOP and report. Do not improvise a field,
a status code, or a carve-out.

## Locked Contract Values

- **Route:**
  - `GET /api/match/:matchId/replay-lagn`, registered inside `registerMatchLagnRoutes`.
  - Auth `guest`.
  - The first statement is `Cache-Control: no-store`.
- **Clock and limiter:**
  - `MatchLagnRouteDependencies` gains `readonly now?: () => number`. `server.mjs` is unchanged, since the field is
    optional.
  - Inside `registerMatchLagnRoutes`:
    `const now = deps.now ?? (() => Date.now()); const rateLimiter = createTokenBucketRateLimiter({ capacity: 10,
    windowMs: 60_000, now });`
  - In the handler, **before any read**: `const { key } = resolveRateLimitKey(koaContext); if
    (rateLimiter.consume(key, 1) === false)` → `429 { error: 'rate_limited' }`.
  - **Process-wide CPU budget (move-weighted).** A second route-local bucket bounds the whole process. A per-key
    bucket is not a hard bound (the `resolveRateLimitKey` `// why:`; D-24635 §3 + follow-up: keys are unverified and
    rotate), and exports block the event loop for live sockets (D-24716 §5). So the budget is spent in **moves**, not
    requests: `const exportBudget = createTokenBucketRateLimiter({ capacity: 4000, windowMs: 60_000, now });`.
    - Spend it **after** `readReplayArtifactByHash`, so cheap 404s never drain it.
    - `moveCount` = the number of artifact log entries whose `action.type === 'MAKE_MOVE'`, at least 1.
    - `if (exportBudget.consume('process', moveCount) === false)` → `503 { error: 'at_capacity' }`.
    - Order rationale: per-client first, then the budget. The limiter has no refund, so the reverse order would let an
      over-limit client drain the global budget.
    - A match longer than 4000 moves can never be exported. Execution verifies that no recent prod artifact comes close
      (D-24716 §5).
- **Statuses.** The status domain is `{200, 404, 422, 429, 500, 503}`; every error body is `{ error: <code> }`.

  | Status | Code | Cause |
  |---|---|---|
  | 200 | `{ lagn }` | success |
  | 404 | `not_found` | empty `matchId` |
  | 404 | `replay_not_found` | no replay artifact: an unknown or unfinished match, or one not yet captured (the harvester runs about every 5 min) |
  | 422 | `operator_match` | `initialState.G.isDebugMatch === true`, or `Object.hasOwn(matchConfiguration, 'isDebugMatch')` (the `operatorMatch.logic.ts` rule) |
  | 422 | `not_reexecutable` | any of the four causes listed below |
  | 429 | `rate_limited` | over the per-client limit |
  | 503 | `at_capacity` | over the process-wide move-weighted budget (4000 moves/min) |
  | 500 | `lagn_projection_failed` | the built document failed `validate()` |
  | 500 | `internal_error` | uncaught |

  The four causes of `not_reexecutable`:
  - a missing or misshaped seed, composition, or `numPlayers` (the step-2 shape check);
  - a throw from `InitializeGame` or either reduction (for example, a stored config the current registry rejects);
  - a log entry without `action`;
  - the rebuilt hash ≠ the reference hash.
- **Handler order (locked):**
  1. per-client limiter → `matchId` check → `readReplayHashByMatchId` → `readReplayArtifactByHash` (null at either
     step → `replay_not_found`) → the process budget spends `moveCount` (→ `503 at_capacity`).
  2. Shape-check before any build:
     - `G.matchConfiguration` is an object whose `schemeId` / `mastermindId` are non-empty strings;
     - `villainGroupIds` / `henchmanGroupIds` / `heroDeckIds` are arrays of non-empty strings;
     - the four counts are integers ≥ 0;
     - `finalBlow` is absent or boolean;
     - `ctx.numPlayers` is an integer 1–5;
     - the seed is a non-empty string.

     On failure → `422 not_reexecutable`. The check exists so a malformed composition never reaches verification or
     `validate()`. A `null` / non-object `matchConfiguration` would otherwise be a TypeError → 500.
  3. `const base = buildMatchLagn(matchId, composition, numPlayers, resolveName)`. Its `.setup` is the Tier-1 `setup`
     that gets verified and emitted.
  4. `buildVerifiedReplayExecution(artifact, base.setup, numPlayers, logic.getBuildId())` → on `isVerified: false`,
     `422 <reason>`.
  5. The existing domain reads (`readSeatAccounts` → `readAccountPublicIdentities` → `buildResultPlayers`,
     `readBattlePlan`, and `findCompetitiveScore` with the **step-1 replay hash**), using the same calls as
     `/result-lagn`.
  6. `buildResultMatchLagn(matchId, composition, numPlayers, resolveName, players,
     toLagnResult(verified.gameover ?? null), scoringProfile, battlePlan, score)`, then set
     `replay = { execution: verified.execution }`.
  7. `validate()` once → `200 { lagn }`.
- **`replay.execution` values:**

  | Field | Value |
  |---|---|
  | `engine` | `'legendary-arena'` |
  | `engine_version` | `formatEngineVersion(getCurrentEngineVersion())` |
  | `engine_build` | `getBuildId()` → `getVersionInfo().gitSha`; omitted when `'unknown'` |
  | `data_version` | `CURRENT_DATA_VERSION.version` |
  | `seed` | the artifact seed |
  | `moves` | each `MAKE_MOVE` entry, in order (shape below) |
  | `final_state_hash` | the verified hash |

  Each move is `{ seq: <index>, seat: Number(payload.playerID), move_name: payload.type,
  args: structuredClone(payload.args), turn, phase }`. Omit `turn` unless it is an integer ≥ 1, and omit `phase` unless
  it is a string or null. `args` is deep-copied, so emitted data never aliases reducer-owned state.
- **Verify (inside `buildVerifiedReplayExecution`):**
  1. Operator check → `operator_match`.
  2. `setupData` comes from `toSetupDataFromLagnSetup(setup)`: the 9 `MatchSetupConfig` fields from the emitted Tier-1
     `setup` (`shield_officers_count → officersCount`, ids in order), plus `finalBlow: true` when
     `setup.final_blow === true`.
  3. `reexecuteFromSeed`:
     - `game = { ...LegendaryGame, seed }`;
     - `InitializeGame({ game, numPlayers, setupData })`;
     - dispatch each move as `{ type: 'MAKE_MOVE', payload: { type: move_name, args, playerID: String(seat) } }` through
       `CreateGameReducer({ game, isClient: false })`;
     - return `{ finalState, finalContext, stateHash }`.
  4. Require `stateHash === reduceMatchToFinalState({ initialState, log }).stateHash`.
  5. Any throw in 2–4 → `not_reexecutable`. `extractExecutionMoves` runs **inside** that same guarded block, so a log
     entry without `action` is a 422, never an escaped 500.
- **New pure module `apps/server/src/match/replayLagn.logic.ts`** exports exactly:
  - `extractExecutionMoves(log)`
  - `toSetupDataFromLagnSetup(setup)`
  - `readArtifactSeed(initialState)`
  - `isOperatorArtifact(initialState)`
  - `reexecuteFromSeed({ seed, numPlayers, setupData, moves })`
  - `buildVerifiedReplayExecution(artifact, setup, numPlayers, buildId)`, which returns
    `{ isVerified: true, execution, gameover } | { isVerified: false, reason: 'operator_match' | 'not_reexecutable' }`

  The module does no DB I/O. **No comment or identifier in it** may contain `bgio.matches`, `metadata`, or `.state`;
  the durable-source rationale lives in `matchLagn.routes.ts`.
- **`MatchLagnLogic` gains** `readReplayArtifactByHash`, `buildVerifiedReplayExecution`, and `getBuildId`.
- **Writer flip:** `LAGN_VERSION = LAGN_VERSION_1_7_0`; `packages/lagn-spec/package.json` `"version": "1.7.0"`.

## Scope (In)

### A) Writer flip (`packages/lagn-spec`)

1. `validator.ts`:
   - `LAGN_VERSION = LAGN_VERSION_1_7_0`;
   - its doc comment says "1.7.0 as of WP-810", and keeps the history paragraphs.

   `package.json`: `1.6.0` → `1.7.0`, in the same commit.
2. `validator.test.ts`:
   - Re-pin the 13 scaffold-observed writer / migration-target assertions, plus WP-808's "1.6.0 untouched" case, to
     `LAGN_VERSION_1_7_0`.
   - Each `applied` list gains `'1.6.0->1.7.0'` where the chain now walks it.
   - The test titles and comments that name the writer (for example "…the writer is now 1.6.0 (WP-698)") are updated in
     the same edit.
   - Re-measure at execution. Any failure outside this class means STOP and report.

### B) Producer (`apps/server`)

3. `replayLagn.logic.ts` (**new**) — the six pure exports above, implemented with the locked verify steps.
4. `replayLagn.logic.test.ts` (**new**).
   - **Harness.** Manufacture matches with the **fixed-seed** pattern from `matchReplay.logic.test.ts`
     (`{ ...LegendaryGame, seed: <constant> }`, fat test registry, 0/3/8 turns). Rebuild through `readArtifactSeed` +
     plain `LegendaryGame`, which exercises the stored-seed path. Pair `setRegistryForSetup` with
     `clearRegistryForSetup`.
   - **The round trip verifies:**
     - for 0, 3, and 8 turns;
     - after a `JSON.parse(JSON.stringify(...))` round trip of the artifact (stored-jsonb parity);
     - and the block is valid inside a full LAGN 1.7.0 document.
   - **Move extraction:** `seq` runs 0..n-1; `seat`, `move_name`, and `args` are verbatim; non-`MAKE_MOVE` entries are
     dropped.
   - **Refusals:**
     - an extra setup-data key → `not_reexecutable`;
     - a missing seed → `not_reexecutable`;
     - setup data naming an ext_id the test registry lacks (setup throws) → `not_reexecutable`;
     - a log entry without `action` → `not_reexecutable`;
     - `isDebugMatch` in `G`, and as an own key of `matchConfiguration` → `operator_match`.
   - **`reexecuteFromSeed` level:** a tampered move list (drop the final move of an 8-turn match) yields a `stateHash`
     different from the fresh reduction of the untampered artifact.
   - **Fields:** a `final_blow: true` setup round-trips `finalBlow: true`; `engine_build` is omitted for `'unknown'`.
5. `matchLagn.routes.ts`:
   - the `now` dep, plus both route-local buckets (the per-client limiter and the move-weighted process budget);
   - the `/replay-lagn` handler, in the locked order;
   - the three new seam members;
   - the module header comment updated (it now reaches the engine and boardgame.io through `replayLagn.logic.ts`);
   - the durable-source `// why:`.
6. `matchLagn.routes.test.ts`:
   - The seam mock gains the members.
   - Route cases for each status: 200, both 404s, both 422s, 429 on the 11th request via an injected `now`, 503, and
     500 `lagn_projection_failed`.
   - **503 test (deterministic).** Use a fresh router per case and a constant injected `now`. The seam artifact's log
     holds 2000 stub `MAKE_MOVE` entries, and the seam verify is mocked to succeed. Send requests from three distinct
     `req.headers['cf-connecting-ip']` values: the first two are 200, the third is `503 at_capacity` with `no-store`.
   - **Misshaped composition.** The seam `buildVerifiedReplayExecution` is mocked to return `isVerified: true`.
     `matchConfiguration` without `heroDeckIds`, and a `null` `matchConfiguration`, each give `422 not_reexecutable`.
     The seam verify is called **0** times.
   - The `result` path is covered by a seam `gameover` of `{ outcome: 'heroes-win' }` → `result.outcome: 'victory'`.
   - `no-store` on every response.
7. `matchLagn.logic.ts` — doc comments only:
   - `buildResultMatchLagn`'s stale "1.5.0 as of the WP-641 writer flip" becomes "stamps `LAGN_VERSION`";
   - the module header's stale "no engine import" claim becomes accurate (it imports `gradeForFinalScore`).

### C) Registry viewer — comments only

8. `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` (~L229–231) and `useLoadoutLagnExport.test.ts`
   (comment ~L461–462, and the test title ~L453 "…validates at 1.6.0"): "now 1.6.0" / "at 1.6.0" become "stamps
   `LAGN_VERSION` (1.7.0 as of WP-810; ordinal gates, D-24211)" / "at the current writer". No code or assertion change.

### D) Governance docs (lockstep)

9. `docs/ai/ARCHITECTURE.md` §Persistence Boundary blockquote. The D-24689 clause ends "…match)." — replace that final
   period with the D-24716 clause (Locked text in D-24716 Content), ending it with "." before "All other application
   reads …".
10. `.claude/rules/architecture.md` §Persistence Boundary: "five" becomes "six". Drop the "and" before **D-24689**,
    and append ", and **D-24716** (exporting a completed match's replay artifact as a verified LAGN `replay.execution`
    block, plus its re-executed `gameover` outcome)" after the D-24689 parenthetical.
11. `docs/ai/REFERENCE/api-endpoints.md` (§21 TRIGGERED, D-11804 whole-row):
    - a **new** `GET /api/match/:matchId/replay-lagn` row: Wired, `guest`, and the full status table + notes above;
    - replace `/lagn` and `/result-lagn` whole: every stated writer value becomes **`1.7.0`** (in `/result-lagn` both
      the stamped value and "as a LAGN 1.6.0 document"), and nothing else changes;
    - replace `POST /api/me/loadouts` whole, with the writer tail: "`1.7.0` as of WP-810 (the replay-LAGN producer
      flipped the writer 1.6.0 → 1.7.0; readers still accept every version back to `1.0.0`)".
12. `wiki/lagn-v1.md`:
    - the Written row (1.7.0 `yes`, 1.6.0 `no`) and "(now `1.7.0`)";
    - the 1.7.0 section gains a producer paragraph: the endpoint, the durable source, verify-before-emit with its
      guarantee and non-guarantees, and the refusals;
    - the Interactions bullet names the producer.
13. `docs/ai/REFERENCE/00.2-data-requirements.md`:
    - §7f's "`LAGN_VERSION` is **1.6.0** as of WP-698" gains "(1.7.0 as of WP-810)";
    - §7g gains a producer rule: the field sources above, and verify-before-emit.

## Out of Scope

- **The `/lagn` / `/result-lagn` reaping bug.** Pre-existing; tracked as a separate task chip.
- **No UI** (download control, "open at turn N"). Later packets.
- **No CLI/offline re-executor**, and no stored-hash comparison.
- **No per-match build or data-version column** (D-24689 §8), and no cross-request cache.
- **No change to** WP-808's schema, `replay.turns`, `migrate.ts`, or `computeStateHash`.
- **No seed-entropy change** (WP-809).
- **No detection of a tampered stored log.** The log is the source; competitive integrity is the D-5301 / D-24126
  pipeline.

## Files Expected to Change

- `packages/lagn-spec/src/validator.ts` — **modified** — `LAGN_VERSION` → `LAGN_VERSION_1_7_0` + doc comment
- `packages/lagn-spec/package.json` — **modified** — `1.6.0` → `1.7.0` (same commit as the flip)
- `packages/lagn-spec/src/validator.test.ts` — **modified** — re-pinned writer / migration-target assertions, titles,
  and comments
- `apps/server/src/match/replayLagn.logic.ts` — **new** — pure extract / map / re-execute / verify helpers
- `apps/server/src/match/replayLagn.logic.test.ts` — **new** — round trip, refusals, and shape tests over
  manufactured matches
- `apps/server/src/match/matchLagn.routes.ts` — **modified** — `now` dep, limiter, `/replay-lagn` handler, seam,
  header
- `apps/server/src/match/matchLagn.routes.test.ts` — **modified** — seam mock + per-status route cases + the `result`
  path
- `apps/server/src/match/matchLagn.logic.ts` — **modified** — doc comments only
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.ts` — **modified** — stamp comment only
- `apps/registry-viewer/src/composables/useLoadoutLagnExport.test.ts` — **modified** — stamp comment only
- `docs/ai/ARCHITECTURE.md` — **modified** — D-24716 carve-out clause
- `.claude/rules/architecture.md` — **modified** — carve-out count + D-24716 parenthetical
- `docs/ai/REFERENCE/api-endpoints.md` — **modified** — 1 new row + 3 rows replaced WHOLE
- `wiki/lagn-v1.md` — **modified** — writer row, "(now 1.7.0)", producer paragraph, Interactions
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **modified** — §7f writer note + §7g producer rule

Governance close only beyond these: `DECISIONS.md` (D-24716 Active + the D-24714 pointer), `STATUS.md`,
`WORK_INDEX.md`, `EC_INDEX.md`, and `docs/05-ROADMAP-MINDMAP.md`.

**Why 15 files rather than ~8.** The flip, the producer, and the carve-out are one lockstep:

- emitting a 1.7.0 block requires the 1.7.0 writer;
- the reads require the carve-out;
- the catalog, wiki, and 00.2 must state the new writer on the same day.

This follows the WP-641 / WP-698 precedent. Eight of the files are comment-only (3) or doc-only (5).

## Contract

`GET /api/match/:matchId/replay-lagn` is guest-readable. It is rate-limited to 10/min per client (`429`) and bounded by
a 4000 moves/min process-wide budget (`503 at_capacity`). It returns a **LAGN
1.7.0** document containing:

- the result-LAGN content, built from the durable replay artifact and the domain tables;
- a `replay.execution` block that the serving build **re-executed from its seed and verified** against a fresh faithful
  reduction of the stored match.

The endpoint refuses operator matches (`422 operator_match`) and anything the seed rebuild cannot reproduce or throws on
(`422 not_reexecutable`). It returns `404 replay_not_found` when no artifact exists.

`LAGN_VERSION` becomes 1.7.0 for every emitter. The D-24716 carve-out is the only new blob read.

## D-24716 Content (create Active at execution)

### D-24716 — Replay-LAGN producer: the replay-export carve-out, verify-before-emit, and the 1.7.0 writer (Active — WP-810 / EC-847)

1. **Carve-out (extends D-24095).** A server-layer read MAY read a **completed** match's `bgio.replay_artifacts`
   `initialState` and `log`, and re-execute them through boardgame.io's reducer (D-24119). The read covers:
   - `initialState`: `G.matchConfiguration`, `G.isDebugMatch`, `ctx.numPlayers`, `plugins.random.data.seed`;
   - `log`: the `MAKE_MOVE` actions and their `turn` / `phase` stamps;
   - the re-executed final `ctx.gameover`.

   The reference re-execution reduces the full `initialState + log` (the D-24119 reconstruction). Producer code
   **reads** only the listed fields, the two final-`G` `computeStateHash` values, and the rebuild's final
   `ctx.gameover`.

   Its sole purposes are to emit and verify a LAGN 1.7.0 `replay.execution` block and the document's `result` outcome.
   It is a derived, read-only export:
   - never the `bgio.matches` row (its `state` / `metadata`);
   - never written back;
   - never cached across requests;
   - never a save-game;
   - never a scoring, credit, ranking, or verification input.

   ARCHITECTURE.md clause text: "— **and** the D-24716 replay-export carve-out: a server-layer read MAY read a completed
   match's `bgio.replay_artifacts` `initialState` (`G.matchConfiguration`, `G.isDebugMatch`, `ctx.numPlayers`,
   `plugins.random.data.seed`) and `log` (`MAKE_MOVE` actions + their `turn`/`phase` stamps), re-execute them through
   boardgame.io's reducer (the reference reduces the full `initialState + log`; producer code reads only those fields,
   the two final-`G` hashes, and the rebuild's final `ctx.gameover`), solely to emit and verify a LAGN 1.7.0
   `replay.execution` block and the document's `result` outcome (a derived, read-only export — never the `bgio.matches` row (its `state` / `metadata`), never written back, never cached across requests, never a save-game, never a scoring/credit/ranking/verification input)".
2. **Verify-before-emit.**
   - **What runs.** The block is emitted only when the re-execution from the seed hashes equal to a fresh
     `reduceMatchToFinalState` of the artifact on the serving build. The setup data comes from the emitted Tier-1
     `setup`.
   - **What it proves.** The emitted block re-executes on that build to a final `G` whose `computeStateHash` (a 32-bit djb2 over the canonical JSON of `G`, `diagnostics` excluded) equals that of the stored
     match's fresh reduction. It catches every setup-time
     divergence: lossy setup data, pre-WP-805 matches, and registry or setup drift. Setup throws become refusals.
   - **What it does not prove.** It does not detect a tampered stored log, or move-processing changes since capture.
     Both sides share the moves and the build.
   - **What it never compares to.** The capture-time `replay_hash`.
3. **Amends D-24714's `data_version` producer clause.**
   - No per-match data-version record exists.
   - Every stored artifact postdates the data-version 2 bump: WP-137, 2026-05-07, before durable storage began with
     WP-309 on 2026-07-05. So `data_version = CURRENT_DATA_VERSION.version` is accurate today.
   - **Binding:** a future data-axis bump must either migrate stored artifacts or make this producer refuse artifacts
     captured before the bump. The hash does **not** detect a stale `args` shape.
   - `engine_build` is the **verifying** (serving) build's sha, omitted when unknown.
4. **The writer is 1.7.0.** Every emitter stamps 1.7.0. This is safe because every gate is ordinal (D-24211). WP-808's
   1.7.0 reader must be deployed on the bundled viewers first.
5. **Abuse bound.** The endpoint is guest and CPU-bound: two synchronous reductions per request, measured at about
   0.7–0.85 ms per move each on trivial moves. Long matches block the event loop for about 0.5–2 s. It therefore has
   two limits, both route-local token buckets with an injected clock:
   - 10/min per client → `429`;
   - a process-wide budget of **4000 moves/min**, spent per request as its `MAKE_MOVE` count after the artifact read →
     `503 at_capacity`.

   The budget bounds CPU, not request count. At about 0.75 ms × 2 reductions per move, it is about 6 s of synchronous
   work per minute.

   **At execution (before merge),** run one real long prod artifact (read-only) through the verify path locally, and
   record its move count and ms per request here. If `ms_per_move × 2 × 4000 > 6000 ms`, or any recent prod artifact
   exceeds 4000 moves, STOP and report. Do not silently retune.
6. **Binding — shared seeds.** No surface shares a seed across matches by design today. Any future surface that reuses a seed across
   matches (for example, the DESIGN-SEED-CHALLENGES shared-seed challenges) must make this producer refuse, or embargo
   until the challenge closes, any match whose seed is shared. Otherwise one entrant's export publishes the deck order
   and a full move solution to every other entrant.

## Acceptance Criteria

- **AC-1** — A manufactured fixed-seed match at 0, 3, and 8 turns, rebuilt through the stored seed, yields
  `isVerified: true`. This also holds after a JSON round trip of the artifact. The emitted document `validate()`s as
  1.7.0, and `final_state_hash` equals the fresh reduction's hash.
- **AC-2** — `moves` keeps only `MAKE_MOVE` entries. `seq` runs 0..n-1, `seat` = `Number(playerID)`, `move_name` is
  verbatim, and `args` is deep-equal to the artifact's but not reference-equal.
- **AC-3** — Each of these yields `{ isVerified: false, reason: 'not_reexecutable' }`:
  - an extra setup-data key;
  - a missing seed;
  - a setup the registry rejects (setup throws);
  - a log entry without `action`.

  At the `reexecuteFromSeed` level, a tampered move list (the final move of an 8-turn match dropped) hashes differently
  from the untampered reference.
- **AC-4** — `G.isDebugMatch === true`, or an own `isDebugMatch` key on `matchConfiguration`, yields `operator_match`
  before any re-execution.
- **AC-5** — A `final_blow: true` setup round-trips and verifies. `engine_build` is present for a real sha and omitted
  for `'unknown'`.
- **AC-6** — Route behaviour:
  - `200 { lagn }`, with `result.outcome` from the seam `gameover`;
  - `404 not_found` and `404 replay_not_found`;
  - `422 operator_match` and `422 not_reexecutable`;
  - `429 rate_limited` on the 11th request in one window for one key (injected `now`);
  - `503 at_capacity` once the move-weighted budget is spent: with 2000-move stub artifacts from three distinct
    `cf-connecting-ip` keys and a constant `now`, requests 1–2 are 200 and request 3 is 503;
  - `422 not_reexecutable` for a misshaped composition (`heroDeckIds` missing, or a `null` `matchConfiguration`), with
    the seam verify called 0 times — never a 500;
  - `500 lagn_projection_failed`;
  - `Cache-Control: no-store` on every response.
- **AC-7** — `LAGN_VERSION === LAGN_VERSION_1_7_0` and `package.json` is `1.7.0`, in one commit. The re-pinned
  `validator.test.ts` is green, with no failure outside the scaffold-observed class.
- **AC-8** — No read beyond the D-24716 carve-out: no `bgio.matches`, `metadata`, or `.state` in `replayLagn.logic.ts`
  (code or comments), and no table write.
- **AC-9** — The docs are in lockstep:
  - `api-endpoints.md` has the new row, and `/lagn`, `/result-lagn`, and loadouts are replaced whole at 1.7.0;
  - ARCHITECTURE.md and `.claude/rules/architecture.md` carry D-24716 ("six");
  - the wiki and 00.2 reflect the writer and the producer.

## Verification Steps

```pwsh
pnpm -r build                                                              # exit 0
pnpm --filter @legendary-arena/lagn test                                   # 0 fail (re-pinned)
cd apps/server; node --import tsx --test src/match/replayLagn.logic.test.ts src/match/matchLagn.routes.test.ts src/match/matchLagn.logic.test.ts; cd ../..
pnpm --filter @legendary-arena/server test                                 # 0 fail (run in background: >5 min)
pnpm --filter registry-viewer test; pnpm --filter registry-viewer typecheck  # 0 fail; 0 errors
pnpm -r --no-bail test                                                     # no new failures
Select-String -Path apps/server/src/match/replayLagn.logic.ts -Pattern "bgio\.matches|metadata|\.state\b"  # no matches
git diff --name-only origin/main                                           # = Files Expected to Change + governance
```

**Before merge (deploy order):** confirm WP-808 is merged and the cards and legends sites are serving it. The deployed
viewer bundle must accept `lagn_version: "1.7.0"`, for example by opening a 1.7.0 `?lagn=` link in the Loadout tab.

**After deploy (operator, no UI) — required:**
- At least one observed `200` with `lagn_version: "1.7.0"` and a `replay.execution` block on prod, for a finished,
  non-operator match created **after** the deploy. Play one if needed.
- Record the 200/422 split over a small read-only sample of recent artifacts in the PR or STATUS. An endpoint that
  refuses every real match does not pass.

## Definition of Done

- [ ] WP-808 `[x]` confirmed before the first edit, and its viewer bundles deployed before this PR merges
- [ ] AC-1..AC-9 demonstrated with observed output pasted into the session log
- [ ] `pnpm -r build` 0; lagn, server, and registry-viewer 0 fail; `pnpm -r --no-bail test` no new failures;
  registry-viewer `typecheck` 0
- [ ] `DECISIONS.md` D-24716 created **Active** (Content above), plus a one-line "Amended by D-24716 §3" pointer on
  D-24714
- [ ] ARCHITECTURE.md and `.claude/rules/architecture.md` carve-outs in lockstep; `api-endpoints.md` 1 new row + 3
  whole-row replacements; wiki and 00.2 updated
- [ ] Before merge: the ms-per-request + move-count measurement on a real long prod artifact (read-only, run locally)
  is recorded in D-24716 §5 and passes its STOP check
- [ ] Post-deploy: one observed prod `200` with `replay.execution` for a post-deploy match, and the 200/422 sample split,
  are recorded
- [ ] `STATUS.md`: "No user-observable change — infrastructure only (new guest API endpoint)"
- [ ] WORK_INDEX `[x]`; EC_INDEX `Done`; mindmap `📝 → ✅`; `pnpm roadmap:counts:check` exits 0
- [ ] `git diff --name-only` matches §Files Expected to Change (+ governance)

## Vision Alignment

`00.3 §17.1` is **TRIGGERED** on three surfaces: replays and replay verification; determinism and RNG sourcing (the seed
is exported); and player identity (the `players[]` public-handle roster).

- **Clauses touched:** §3, §18, §19, §22, §24, NG-1.
- **Conflict assertion:** No conflict: this WP preserves all touched clauses. It delivers §18 ("every game is … a
  replayable, shareable log"; "replays are perfectly faithful") and §19 (machine-readable replay files).
- **Non-Goal proximity:** NG-1..NG-7 are not crossed. Nothing is paid; no outcome changes; the export is
  non-authoritative. Competitive credit stays `matchId → blob → re-reduce → re-verify → AccountId` (§24, D-5301 /
  D-24126).
- **Determinism preservation:**
  - Re-execution is boardgame.io's seeded reducer (D-24119), unchanged.
  - Verify-before-emit guarantees that every emitted block re-executes on the serving build to a final `G` that is
    hash-equal to the stored match's fresh faithful reduction. The hash is `computeStateHash`, a 32-bit djb2 over the
    canonical JSON of `G`; `ctx` and `plugins` are not compared.
  - No engine, `G`, `finalStateHash`, or replay-pipeline behaviour changes.
- **§3 seed exposure:** only finished matches are exported, and no seed is shared across matches today. D-24716 §6
  binds any future shared-seed surface to refuse or embargo. The clock-derived seed weakness is WP-809's.
- **§3 identity:** `players[]` keeps its D-24214 public-handle-only rule.

## Funding Surface Gate

N/A — this WP is a server endpoint, a contract-constant flip, and docs. It defines, proposes, or implements no UI, no
user-visible copy, and no funding channel or affordance (WP-097 §F; the §20.1 surfaces are absent).

## API Catalog

§21 is **TRIGGERED** (D-11804):

- one **new** row: `GET /api/match/:matchId/replay-lagn` (Wired, `guest`);
- three rows replaced **whole** because the stamped writer moves to 1.7.0: `/lagn`, `/result-lagn`, and
  `POST /api/me/loadouts` (its tail).

## Lint Gate Self-Review (00.3)

- §1 PASS — all sections present; Out of Scope lists 7 adjacent exclusions.
- §2 PASS — engine-wide + packet-specific + session protocol + locked values.
- §3 PASS — WP-808 (BLOCKED until `[x]`) + 641/698/334/335/336/805 ✅, plus file and export shapes. The limiter `now`
  requirement and the setup throw are stated.
- §4 PASS — specific D-entries, 00.2 §7f–§7g, ARCHITECTURE §Persistence Boundary + rules.
- §5 PASS — 15 files, each `new` / `modified` with a description; more than 8 is justified (a lockstep; 8
  comment/doc-only).
- §6 PASS — LAGN snake_case names from WP-808; `matchId` / `numPlayers` / `setupData` follow server + 00.2 usage.
- §7 PASS — no new dependency.
- §8 PASS — logic is in the Server layer; lagn-spec changes only a constant + tests; registry-viewer changes comments
  only; the engine is used only through its Runtime-Safe surface.
- §9 PASS — `pwsh` verification.
- §10 N/A — no environment variable is read or added (the build id comes from `version.mjs`; the clock is injected).
- §11 PASS — Auth `guest`, stated and justified (a completed match is public; rate-limited).
- §12 PASS — fixed-seed manufactured round trips, every refusal, every route status, and the `result` path.
- §13 PASS — exact commands with expected outcomes, plus the deploy-order and prod checks.
- §14 PASS — 9 binary ACs.
- §15 PASS — DoD with STATUS / DECISIONS / WORK_INDEX / EC_INDEX / mindmap; §15.1 infrastructure + operator prod fetch.
- §16 PASS — full-sentence error codes; `// why:` sites in EC-847.
- §17 TRIGGERED — PASS (Vision Alignment).
- §18 PASS — the `Select-String` targets one new file whose comments are barred from carrying those tokens; the
  rationale lives in `matchLagn.routes.ts`.
- §19 PASS — baseline recorded; HEAD re-checked at commit.
- §20 N/A — justified above.
- §21 TRIGGERED — PASS (API Catalog).

## Gate Verdicts

- **Pre-flight (01.4), run 1:** an independent subagent returned **NOT READY** with 6 PS items. All were fixed in
  place:
  1. the limiter `now` dep and the `consume` / `resolveRateLimitKey` API;
  2. the unachievable "tampered artifact args" AC was restated at the `reexecuteFromSeed` level, plus the explicit
     non-guarantee;
  3. the over-claimed guarantee and the D-24716 §3 basis were rewritten on the true facts (setup-time divergence only;
     data v2 dates), with a binding for a future bump;
  4. the handler order was locked (`buildMatchLagn` first, then its `.setup` is verified);
  5. setup and reduction throws map to `422 not_reexecutable`, with a test;
  6. the re-executed `ctx.gameover` was added to the carve-out (D-24716, ARCHITECTURE, rules, WP, EC).

  RS-1..RS-10 were folded in:
  - the fixed-seed harness;
  - the grep-safe comments;
  - `Object.hasOwn`;
  - the header comments;
  - the viewer test comment file;
  - the deploy-order DoD;
  - the `result` path test;
  - the Assumes typography;
  - the ARCHITECTURE punctuation;
  - the JSON round-trip case.
- **Pre-flight (01.4), run 2:** independent subagent, **READY TO EXECUTE (once WP-808 is [x])**, with no PS items.
  RS-1..RS-10 were applied without changing scope:
  1. the `turn` / `phase` omission rule in the EC;
  2. the verbatim limiter form;
  3. extraction inside the guarded block;
  4. both `/result-lagn` "1.6.0" mentions;
  5. the viewer test title;
  6. the 8 comment/doc files;
  7. the 14 re-pins in EC_INDEX;
  8. the step-1 hash reused;
  9. a named tamper;
  10. the rules-list grammar.

  RS-11 (placeholders) is filled at the commit.
- **Copilot check (01.7), run 1:** independent subagent, **RISK / HOLD**, 8 findings. All were fixed in place
  within the allowlist:
  1. a process-wide export budget (`503 at_capacity`, 30/min), plus a recorded ms measurement;
  2. the carve-out's read-vs-reducer-input wording, and identical never-lists in D-24716 §1 and the ARCHITECTURE clause;
  3. the step-2 composition shape check (a misshaped composition is a 422, never a 500), with a test;
  4. a prod DoD that requires one observed 200 for a post-deploy match, plus the 200/422 sample;
  5. a D-24716 §6 shared-seed binding;
  6. an order-independent seed Assumes line, and WP-809 recorded as drafted (#2783);
  7. the hash-equality wording (32-bit djb2 over the JSON of `G`);
  8. `args` deep-copied (`structuredClone`), with a non-aliasing assertion.

  These changed locked values (a new status, a new check), so the gates re-run before the commit.
- **Pre-flight (01.4) + copilot (01.7), delta re-check:** independent subagent.
  - Pre-flight: **READY TO EXECUTE (once WP-808 is [x])**.
  - Copilot: **RISK / HOLD**, all findings scope-neutral and fixed in place:
    1. C-1: the flat 30/min budget could stall sockets for up to 60 s/min. It became a **move-weighted** 4000 moves/min
       budget, spent after the artifact read, with an execution-time STOP check;
    2. C-2: an order-rationale `// why:`;
    3. C-3: a deterministic 503 test via distinct `cf-connecting-ip` keys;
    4. C-4: the composition test asserts the seam verify is never called, plus a `null` case;
    5. C-5: the hash-equality wording in Context + D-24716 §2;
    6. C-6: "no surface shares a seed by design".
  - RS-1..RS-4: Scope 5/6, the summaries, the budget citation, and an execution-time measurement.

  The residual RISK is documented here; nothing is open.
