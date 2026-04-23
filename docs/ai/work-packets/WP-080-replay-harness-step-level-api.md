# WP-080 — Replay Harness Step-Level API for Downstream Snapshot / Replay Tools

**Status:** Complete
**Primary Layer:** Game Engine (`packages/game-engine/src/replay/`)
**Dependencies:** WP-027 (replay harness exists), WP-079 (JSDoc narrowing
must land first — both packets touch `replay.execute.ts`), D-6304 (this
packet's governing decision)

> **Note on WP-079 coordination:** At WP-080 drafting time (commit
> `41d28d1`), WP-079 had a WP file on disk but no EC row in
> `EC_INDEX.md`. As of a subsequent SPEC commit (2026-04-18), EC-073
> has been drafted for WP-079 (Draft status; see
> `docs/ai/execution-checklists/EC-073-label-replay-harness-determinism-only.checklist.md`
> and the WP-079 execution session prompt at
> `docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`).
> WP-079 executes under commit prefix `EC-073:` (never `WP-079:` per
> P6-36). WP-080 must NOT ship ahead of WP-079 — the JSDoc narrowing
> WP-079 introduces is expected verbatim at the export site WP-080
> adds and must not be re-worded.

---

## Session Context

WP-027 locked the engine's replay verification harness in
`packages/game-engine/src/replay/replay.execute.ts`. It exposes
`replayGame(input, registry): ReplayResult` — an **end-to-end** function
that runs `Game.setup()` plus every `ReplayMove` in `input.moves`
internally and returns only `{ finalState, stateHash, moveCount }`. The
per-move dispatch primitives (`MOVE_MAP` at line 77, `buildMoveContext`
at line 98, the `ReplayMoveContext` structural interface at line 39) are
**module-local**: no `export` keyword on any of their declarations, and
`replayGame`'s loop at lines 156–168 is not observable from outside the
file. The engine barrel at
`packages/game-engine/src/index.ts:206–211` (the WP-027 block) exports
only `ReplayInput`, `ReplayMove`, `ReplayResult`, `replayGame`,
`computeStateHash`, and `verifyDeterminism` — no step function, no
dispatch table, no context constructor.

A prior session attempted to execute WP-063 / EC-071 (Replay Snapshot
Producer) to build `buildSnapshotSequence({ setupConfig, seed, inputs }):
ReplaySnapshotSequence` — a pure helper that runs `Game.setup()` once,
then applies each `ReplayMove` one at a time, calling `buildUIState`
(WP-028) after each step to emit `snapshots[i]`. The WP-063 session
stopped at **Pre-Session Gate #4** because there is no per-input stepping
API to wrap; the only way to execute `buildSnapshotSequence` without
duplicating `MOVE_MAP` into `apps/replay-producer/` (or a new engine
file) is for WP-027's harness to expose a step-level primitive. Under
the EC-071 session protocol, "If the harness is end-to-end only, WP-063
is **BLOCKED** — STOP and ask; do not patch WP-027 locked contract
files from this session." The user selected the "Stop and amend
(pre-flight)" option, which produces this packet.

WP-080 is the amendment: add a named step-level export
`applyReplayStep(gameState, move, numPlayers): LegendaryGameState` to
`replay.execute.ts`, and refactor `replayGame`'s internal loop to
delegate each iteration to that export. The dispatch table `MOVE_MAP`
remains the single source of truth — consumers do not duplicate it.
`buildSnapshotSequence` (WP-063's helper) then becomes a thin wrapper:
construct initial state, call `applyReplayStep` per move, project via
`buildUIState` each step. `replayGame`'s public signature and return
type are unchanged; its observable behavior is proved byte-identical by
the existing `verifyDeterminism` test fixture via `computeStateHash`
(regression guard).

This WP implements D-0201 (Replay as a First-Class Feature) and is
fully consistent with D-0205 (RNG truth source — the harness remains
determinism-only; the step export inherits that semantics unchanged).
D-6304 (this packet) locks the "single source of truth for dispatch"
decision and documents the rejected alternatives.

---

## Goal

After execution:

- `packages/game-engine/src/replay/replay.execute.ts` exports a named
  step function `applyReplayStep(gameState, move, numPlayers):
  LegendaryGameState` that applies exactly one `ReplayMove` to
  `gameState` via the existing `MOVE_MAP`, returning the same
  `gameState` reference it received (mutate-and-return-same-ref, per Q2
  below). Purity is identical to `replayGame`'s loop body today: no
  `Date.now`, no `Math.random`, no `performance.now`, no `console.*`,
  no I/O, no `boardgame.io` import.
- `replayGame`'s internal loop is refactored to a single `for...of`
  that calls `applyReplayStep` once per move. `MOVE_MAP` and
  `buildMoveContext` remain **file-local** (Option A; `ReplayMoveContext`
  is NOT exported, per Q4 below). The unknown-move warning-and-skip
  path is routed through the step function unchanged; the message text
  is byte-identical to today's.
- `packages/game-engine/src/index.ts` gains exactly one new export
  line — `applyReplayStep` — under the existing WP-027 block (approx
  lines 206–211). No surrounding reformatting, no other new exports.
- A new test file
  `packages/game-engine/src/replay/replay.execute.test.ts` asserts
  (a) identical inputs produce identical output state from
  `applyReplayStep`, (b) `replayGame`'s final-state hash is byte-identical
  before and after the refactor for the existing determinism fixture
  (regression guard via `computeStateHash`), (c) unknown `move.moveName`
  routes through the same warning-and-skip path (via `applyReplayStep`)
  as the pre-refactor `replayGame` did.
- `pnpm --filter @legendary-arena/game-engine build` and
  `pnpm --filter @legendary-arena/game-engine test` both exit 0; the
  game-engine test count is strictly greater than the pre-WP-080
  baseline (new tests added); the repo-wide `pnpm -r test` count is
  strictly greater than the pre-WP-080 baseline; no existing test
  changes status (no regressions).

No change to `G` shape, `LegendaryGameState`, `MatchSetupConfig`,
`ReplayInput`, `ReplayMove`, `ReplayResult`, `computeStateHash`, or
`verifyDeterminism`. No change to RNG semantics (D-0205 unchanged).
No new files outside `packages/game-engine/src/replay/` and governance
docs. No consumer-side changes in `apps/**`.

---

## Assumes

- WP-027 complete. Specifically:
  - `packages/game-engine/src/replay/replay.execute.ts` exports
    `replayGame(input, registry): ReplayResult`.
  - Module-local `MOVE_MAP`, `buildMoveContext`, and `ReplayMoveContext`
    are present at lines 77, 98, and 39 respectively.
  - `replayGame`'s internal loop at lines 156–168 constructs a
    `ReplayMoveContext` per move and calls `MOVE_MAP[move.moveName]`.
  - `computeStateHash(gameState): string` and
    `verifyDeterminism(input, registry): DeterminismResult` exist and
    exit 0 under `pnpm --filter @legendary-arena/game-engine test`.
- WP-079 complete. Specifically:
  - `replay.execute.ts` carries the D-0205 determinism-only JSDoc
    narrowing at the module header and on `replayGame`'s JSDoc block.
  - `replay.verify.ts` carries the matching narrowing.
  - Forbidden phrases ("replays live matches", "replays a specific
    match", "reproduces live-match outcomes") absent from both files.
  - Required phrases ("determinism-only"; cross-reference to D-0205;
    cross-reference to `MOVE_LOG_FORMAT.md` Gap #4) present per
    WP-079's acceptance criteria.
- Repo-wide baseline green: `pnpm -r test` exits 0. At WP-080 drafting
  time (commit `4b75dca`), the engine baseline is **409 tests / 101
  suites** (unchanged since WP-067 at `1d709e5`), and repo-wide is
  **464 passing** (3 registry + 409 game-engine + 11 vue-sfc-loader +
  6 server + 35 arena-client). WP-079 execution may adjust these
  counts (it is JSDoc-only, so the test count is expected to be
  unchanged); WP-080 execution must read the post-WP-079 baseline and
  require strict-greater for its new tests.
- `docs/ai/DECISIONS.md` contains D-0201 (active), D-0205 (active,
  resolved 2026-04-18), and D-6304 (this packet's decision, landed in
  the same SPEC commit that created this WP).
- `stash@{0}` and `stash@{1}` are retained and do **not** belong to
  WP-080's scope. The WP-080 execution session MUST NOT pop them.

If any of the above is false, this packet is **BLOCKED** and must not
proceed.

---

## Context (Read First)

Before modifying a single file, the WP-080 execution session must read:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — confirms
  the replay harness is Game Engine only; WP-080 adds no new imports
  and touches no other layer.
- `docs/ai/ARCHITECTURE.md §Persistence Boundary` — `G` is
  runtime-only; `applyReplayStep` never persists state.
- `docs/ai/DECISIONS.md §D-0201 — Replay as a First-Class Feature`
  and `§D-0205 — RNG Truth Source for Replay` — read the
  `Decision:`, `Decision rationale:`, and `Follow-up actions` blocks
  in full. WP-080 does not modify either decision; both remain in
  force.
- `docs/ai/DECISIONS.md §D-6304 — WP-027 Replay Harness Exposes a
  Step-Level API` — the authoritative decision for WP-080; lists the
  Q1/Q2/Q3 resolutions verbatim.
- `docs/ai/execution-checklists/EC-072-replay-harness-step-level-api.checklist.md`
  — WP-080's execution contract; the EC is binary (every item must be
  satisfied exactly).
- `docs/ai/work-packets/WP-027-determinism-replay-verification-harness.md`
  — the WP this packet amends; read completely, especially
  `§Non-Negotiable Constraints` (purity invariants that WP-080
  inherits) and `§Files Expected to Change` (to confirm the current
  export surface). **Do not modify** WP-027 itself.
- `docs/ai/work-packets/WP-079-label-replay-harness-determinism-only.md`
  — the JSDoc narrowing sibling packet; its Locked Values section
  enumerates the forbidden phrases that WP-080 must NOT re-introduce.
- `docs/ai/work-packets/WP-063-replay-snapshot-producer.md` — the
  downstream consumer; WP-080's goal is to unblock its Pre-Session
  Gate #4. WP-063 is NOT modified by this packet.
- `docs/ai/invocations/session-wp063-replay-snapshot-producer.md
  §Pre-Session Gates #4` — the exact block this packet amends (in
  the WP-080 drafting session's same commit, as an additive
  amendment).
- `packages/game-engine/src/replay/replay.execute.ts` — read
  completely before writing. Lines 39 (`interface
  ReplayMoveContext`), 77 (`const MOVE_MAP`), 98 (`function
  buildMoveContext`), and 156–168 (the loop to refactor) are the
  load-bearing positions.
- `packages/game-engine/src/replay/replay.verify.ts` and
  `packages/game-engine/src/replay/replay.verify.test.ts` — the
  existing consumer of `replayGame`; its behavior envelope is the
  WP-080 regression guard.
- `packages/game-engine/src/index.ts` lines 206–211 — the WP-027
  barrel block; WP-080's new export follows this pattern exactly.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1` — the
  `MatchSetupConfig` 9-field contract; WP-080 does not modify this
  shape but `ReplayInput.setupConfig` references it.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 1 (duplicate first,
  abstract on third copy — justifies the single-function Q1 = A
  choice), Rule 6 (`// why:` comments — required on the new export's
  JSDoc and on the refactored loop), Rule 8 (no `.reduce()` in
  zone/effect operations — the refactored loop uses `for...of`),
  Rule 11 (full-sentence error messages — the unknown-move warning
  is preserved verbatim), Rule 13 (ESM only).
- `.claude/rules/architecture.md §Layer Boundary` and
  `.claude/rules/code-style.md §Pure Helpers` — enforce that
  `replay.execute.ts` continues to have no `boardgame.io` import
  after the refactor.

---

## Preflight (Must Pass Before Coding — WP-080 Execution Session)

Each item is a **blocker**. Resolve before writing a single line.

### EC Slot Lock (do not re-derive)

**WP-080 executes against EC-072.** Occupied / tracked ECs in the
070-series: EC-067 (WP-061, Done, `2e68530`), EC-068 (WP-067, Done,
`1d709e5`), EC-069 (WP-062, Done, `7eab3dc` — `<pending>`
placeholder in `EC_INDEX.md` is owned by a separate SPEC commit, NOT
WP-080), EC-070 (WP-068, Done, `bbd58b0` + `8ec6ced`), EC-071
(WP-063, Draft — BLOCKED at Pre-Session Gate #4, the gate WP-080
unblocks). EC-072 is the first truly free slot. Following the
EC-061 → EC-067 / EC-066 → EC-068 / EC-062 → EC-069 retargeting
precedent, an out-of-sequence EC number for an 080-range WP is
expected and documented in EC-072's header.

- Commit prefix at execution time: `EC-072:` on every code-changing
  commit; `SPEC:` on governance-only commits. `WP-080:` is **forbidden**
  (P6-36 — the `.githooks/commit-msg` hook rejects it).

### Commit Prefix Lock (P6-36)

**`WP-###:` is NEVER a valid commit prefix for code changes.** The
three valid prefixes under 01.3 are `EC-###:`, `SPEC:`, `INFRA:`.
WP-080 execution uses `EC-072:` on every code-changing commit. Do not
invent a fourth prefix.

### Inherited Tree State (Must Not Modify)

- `stash@{0}` — pre-existing WP-068 / MOVE_LOG_FORMAT governance
  edits. Owned by the WP-068 / MOVE_LOG_FORMAT resolver. **WP-080
  MUST NOT pop.**
- `stash@{1}` — pre-existing WP-068 in-flight work. Same resolver.
  **MUST NOT pop.**
- EC-069 `<pending — gatekeeper session>` placeholder in
  `EC_INDEX.md` — WP-080 execution MUST NOT backfill this placeholder
  in any `EC-072:` commit. Cross-WP contamination is a scope
  violation (P6-27).

### WP-079 Ordering (Hard Upstream)

WP-079 modifies `replay.execute.ts` JSDoc and `replay.verify.ts`
JSDoc. WP-080 modifies `replay.execute.ts` exports and refactors
`replayGame`'s loop. Both touch the same file. If WP-079 has not yet
executed at WP-080 execution session start, **WP-080 is BLOCKED** —
do not attempt to parallelize. Execute WP-079 first (doc-only,
minimal merge surface), then WP-080 rebases against it and inherits
the JSDoc narrowing verbatim. **Do not re-word WP-079's JSDoc during
WP-080.** If WP-079 has no EC row in `EC_INDEX.md` at WP-080
execution time, drafting a WP-079 EC is a transitive prerequisite —
STOP and escalate.

### WP-063 Downstream Confirmation

The WP-063 session prompt's `§Pre-Session Gates #4` was amended on
2026-04-18 (same SPEC commit that created this WP) to cite WP-080 /
EC-072 / D-6304 as the newly-added upstream. WP-080 execution does
not modify that amendment. WP-063 execution resumes after WP-080
lands.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness goes through
  `ctx.random.*`. `applyReplayStep` adds no new randomness source;
  it inherits `buildMoveContext`'s existing deterministic reverse-
  shuffle (D-0205).
- Never throw inside moves. Only `Game.setup()` may throw (WP-005B).
  `applyReplayStep` is not a move — it is a step-level dispatch
  function — and must never throw. Unknown move names continue to
  emit a warning into `gameState.messages` and return the same
  `gameState` reference unchanged (mirrors `replayGame`'s existing
  behavior at lines 159–164).
- Never persist `G`, `ctx`, or any runtime state. `applyReplayStep`
  is invoked on a live `LegendaryGameState` already constructed by
  `buildInitialGameState`; it neither creates nor stores a copy.
- `G` must remain JSON-serializable at all times (engine-wide
  invariant). The refactor does not introduce any non-serializable
  fields.
- ESM only, Node v22+. `node:` prefix on all Node built-ins. Test
  files use `.test.ts` extension (never `.test.mjs`).
- Full file contents for every new or modified file in the output —
  no diffs, no snippets.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific — Additive Exports Only:**
- **No change to `replayGame`'s public signature.** Input type
  `ReplayInput`, return type `ReplayResult`, and the
  `(input, registry)` parameter order are frozen.
- **No change to `verifyDeterminism` or `computeStateHash`.**
- **No change to `ReplayInput`, `ReplayMove`, `ReplayResult`, or
  `DeterminismResult`** in `replay.types.ts`. `replay.types.ts` is
  not modified by this packet.
- **No change to `replay.hash.ts`.**
- **No change to `replay.verify.ts`** beyond what WP-079 already
  committed (WP-080 inherits those edits unchanged).
- **`applyReplayStep` is additive.** Its signature is new; no
  existing export changes shape, name, or documentation.

**Packet-specific — Refactor Preservation (Regression Guard):**
- After the refactor, `replayGame(input, registry)` must produce a
  `ReplayResult` whose `stateHash` is byte-identical to the
  pre-refactor result for the existing `verifyDeterminism` fixture.
  This is the primary regression guard. A failing hash means the
  refactor changed observable behavior — revert and re-check the
  mutation / context-construction contract.
- `MOVE_MAP` appears **exactly once** in `replay.execute.ts` after
  the refactor (verified by `Select-String` in Verification Steps).
- `buildMoveContext` appears **exactly once** in `replay.execute.ts`
  after the refactor.
- `replayGame`'s internal loop is refactored to delegate to
  `applyReplayStep`; the loop body is one line that calls
  `applyReplayStep(gameState, move, numPlayers)` (plus the `for...of`
  header). No `.reduce()`. No parallel dispatch path.

**Packet-specific — Step Function Purity:**
- No `console.*`, no `Date.now`, no `Math.random`, no
  `performance.now`, no `node:fs*` import, no network, no
  environment access inside `applyReplayStep`.
- `applyReplayStep` does not import `boardgame.io` (the whole file
  already avoids this per WP-027; the new export preserves the
  invariant).
- `applyReplayStep` does not allocate a new
  `LegendaryGameState` — it mutates the input `gameState` in place
  (Q2 = A) and returns the same reference. Consumers wanting
  historical snapshots must project via `buildUIState` after each
  step, not retain `G` copies.

**Packet-specific — Barrel Pattern Discipline:**
- The new export appears **exactly under** the existing WP-027
  block in `packages/game-engine/src/index.ts` (approx lines
  206–211), one line per export. No reformatting of surrounding
  lines. No reordering of existing exports. No new barrel file.

**Session protocol:**
- If the pre-refactor `stateHash` for the existing determinism
  fixture cannot be recovered (for example, because WP-079 changed
  the fixture — it did not, but the session must verify), STOP and
  escalate via `AskUserQuestion` with three named options (run the
  pre-refactor harness once to record the hash / proceed with the
  post-WP-079 hash as the new baseline / unsafe bypass).
- If refactoring `replayGame`'s loop surfaces a hidden dependency
  on `MOVE_MAP` being accessed by an out-of-file consumer, STOP —
  that is an unintended coupling that needs its own WP.
- If a file beyond the allowlist in `§Files Expected to Change`
  must be modified, STOP and escalate (P6-27 — scope lock is
  binary).

**Locked contract values:**
- **Export name:** `applyReplayStep` (lower camel case, matches the
  file's existing naming convention: `replayGame`, `buildMoveContext`,
  `replayAdvanceStage`).
- **Export signature:**
  ```ts
  export function applyReplayStep(
    gameState: LegendaryGameState,
    move: ReplayMove,
    numPlayers: number,
  ): LegendaryGameState
  ```
- **State-ownership contract:** `applyReplayStep` mutates `gameState`
  in place and returns the same reference it received. Consumers
  that need historical snapshots MUST project via `buildUIState`
  after each step. `applyReplayStep` never clones `gameState`.
- **`MOVE_MAP` location:** remains file-local (no `export` keyword)
  at `packages/game-engine/src/replay/replay.execute.ts` approx
  line 77.
- **`buildMoveContext` location:** remains file-local at approx
  line 98.
- **`ReplayMoveContext` scope:** remains a file-local structural
  interface (Q4 — not exported, because Q1 = A does not require
  it). `replay.types.ts` is not modified.
- **Unknown-move message text:** verbatim from today —
  `` `Replay warning: unknown move name "${move.moveName}" —
  skipped.` `` — the step function's warning-and-skip path uses
  exactly this string.

---

## Design Decisions (Q1–Q5)

### Q1 — API shape: **Option A (single `applyReplayStep` function)**

**Resolution:** A single named export
`applyReplayStep(gameState, move, numPlayers): LegendaryGameState`.

**Rationale:** Minimum surface area. WP-063's actual need is
one function that applies one move — exposing more (Option B
context-pair, Option C `MOVE_MAP` surface) leaks internals and
invites ad-hoc extensions. 00.6 Rule 1 ("duplicate first, abstract
on third copy") applies: a second consumer might surface, but a
third does not yet exist. If pre-planning (`packages/preplan/`)
later needs either `buildMoveContext` or `MOVE_MAP` directly,
a follow-up WP can promote them at that time with a clear
second-consumer justification. Option B's extra surface
(`buildReplayMoveContext` + `dispatchReplayMove`) doubles the
export footprint and forces `ReplayMoveContext` to become a
public type — this packet's scope does not require that. Option
C (`export const REPLAY_MOVE_MAP`) leaks the `MoveFn` type and
the internal dispatch topology; rejected.

### Q2 — State ownership: **Option A (mutate-and-return-same-reference)**

**Resolution:** `applyReplayStep` mutates the input `gameState` in
place and returns the same reference.

**Rationale:** Preserves `replayGame`'s current semantics byte-
identically (the existing loop at lines 156–168 already mutates in
place via boardgame.io move functions acting on a plain JS object —
Immer drafts are not used in this file). Option B (clone-return)
would allocate per step, which is expensive on long matches and
duplicates work `buildUIState` (WP-028) already performs for its
own immutable projection. Consumers that need historical snapshots
MUST project via `buildUIState` after each step — this matches
WP-063's `buildSnapshotSequence` design (which collects `UIState`
projections, not `G` copies, per the `## Goal` section of WP-063).
Locked in `§Non-Negotiable Constraints` and in D-6304.

### Q3 — `replayGame` refactor: **Option A (refactor the loop)**

**Resolution:** `replayGame`'s internal loop is refactored so that
each iteration calls `applyReplayStep(gameState, move, numPlayers)`
instead of inlining the `MOVE_MAP` lookup and `buildMoveContext`
call. `MOVE_MAP` and `buildMoveContext` remain module-local; they
are called by `applyReplayStep` (the single source of truth for
dispatch) rather than by `replayGame` directly.

**Rationale:** Single source of truth for dispatch prevents drift.
Option B (two copies of dispatch — one in `replayGame`, one in
`applyReplayStep`) is exactly the failure mode D-6304 exists to
prevent: when a new move is added to `LegendaryGame.moves`, the
author must remember to update two tables instead of one, and
tests pass locally because the legacy `replayGame` path still
works while the new step-export path silently diverges. The
regression guard is `verifyDeterminism` on the existing test
fixture — the `stateHash` must be byte-identical pre- and
post-refactor.

### Q4 — `ReplayMoveContext` export: **NOT exported**

**Resolution:** `ReplayMoveContext` remains a file-local structural
interface (current line 39 of `replay.execute.ts`). It is not
exported from the file, not re-declared in `replay.types.ts`, and
not added to the engine barrel at `packages/game-engine/src/index.ts`.

**Rationale:** Q1 = A does not expose any API that requires
consumers to construct a `ReplayMoveContext`. Exporting a
structural type that no consumer imports is dead surface area.
If a future consumer (pre-planning sandbox, WP-064 replay
inspector) needs the context shape, a follow-up WP can promote
it with an explicit consumer rationale. Locked in D-6304.

### Q5 — `ReplayInputsFile` scope: **OUT OF SCOPE**

**Resolution:** `ReplayInputsFile` (the on-disk JSON shape
described in WP-063 `§Locked contract values`) is **not** defined
or modified by WP-080. That shape is WP-063's scope; WP-063's
execution session will decide whether to reuse a WP-027-side
definition (none exists today) or introduce one under
`apps/replay-producer/`.

**Rationale:** WP-080's deliverable is the engine-side step-level
API. `ReplayInputsFile` is a consumer-side concern (CLI / file
format) and belongs to the producer app. Locking it in WP-080
would pre-empt WP-063's design space without justification.
Listed explicitly in `§Out of Scope`.

---

## Scope (In)

### A) `packages/game-engine/src/replay/replay.execute.ts` — modified

1. **Add named export `applyReplayStep`.** Placed immediately above
   `replayGame` (logical order: dispatch primitive first, then the
   function that loops over it). Signature as in
   `§Locked contract values` above. JSDoc block:
   - Opens with a one-line summary: "Applies a single `ReplayMove` to
     the given `LegendaryGameState` and returns the same reference."
   - States the state-ownership contract (mutate-in-place;
     consumers wanting snapshots must project via `buildUIState`).
   - Cites D-6304 and motivates the export (unblock WP-063 snapshot
     producer; single source of truth for dispatch).
   - `@param gameState` / `@param move` / `@param numPlayers` /
     `@returns` — all full sentences per 00.6 Rule 11.
   - Inherits WP-079's D-0205 determinism-only narrowing on the
     file header verbatim (no re-wording).
2. **Refactor `replayGame`'s internal loop** (currently lines
   156–168). The new loop body is one statement that calls
   `applyReplayStep(gameState, move, numPlayers)`. A one-line
   `// why:` above the loop notes that the loop delegates to
   `applyReplayStep` (single dispatch source of truth; determinism
   regression covered by the existing `verifyDeterminism` test
   fixture).
3. **Preserve existing `// why:` comments** on the reverse-shuffle
   (lines 118–124) and on the events no-op block (lines 110–113).
   WP-079's D-0205 cross-references at the module header are
   retained verbatim.

No other edits to this file. `MOVE_MAP` and `buildMoveContext` keep
their file-local declarations (no `export` keyword). The
`ReplayMoveContext` interface at line 39 is unchanged.

### B) `packages/game-engine/src/index.ts` — modified

Add exactly one export line, placed immediately under the existing
WP-027 block (approx lines 206–211). The new line follows the
surrounding pattern:

```ts
export { applyReplayStep } from './replay/replay.execute.js';
```

No reformatting of surrounding lines. No reordering of existing
exports. No other new exports in this packet.

### C) `packages/game-engine/src/replay/replay.execute.test.ts` — new

A new `node:test` suite. Imports `applyReplayStep`,
`replayGame`, `computeStateHash` from the module under test; imports
`buildInitialGameState` and `makeMockCtx` as usual; imports a
minimal card registry fixture (follow `replay.verify.test.ts`'s
existing pattern — `replay.verify.test.ts` already constructs a
`CardRegistryReader` for test use; re-use the same construction
rather than introducing a new one).

Required test cases:

1. **Identical inputs produce identical output state.** Build an
   initial `LegendaryGameState`, deep-clone it, call
   `applyReplayStep` on both copies with the same `ReplayMove` and
   `numPlayers`, assert that `computeStateHash` on each result is
   equal. Guards Q2 (mutate-and-return-same-reference) and purity.
2. **`replayGame` regression guard.** Invoke `replayGame` against
   the existing determinism fixture (the same fixture
   `verify.test.ts` uses) and assert the resulting `stateHash`
   equals a recorded pre-WP-080 value. The recorded value is
   captured once at the top of the test file as a string constant
   with a `// why:` noting it is the WP-080 regression anchor
   (byte-identical behavior through the refactor is the binary
   pass/fail).
3. **Unknown move name routes through warning-and-skip.** Call
   `applyReplayStep` with a `ReplayMove` whose `moveName` is
   (for example) `"nonexistentMove"`. Assert (a) the returned
   `gameState` is the same reference as the input, (b)
   `gameState.messages` gained exactly one entry whose text is
   the canonical `` `Replay warning: unknown move name
   "nonexistentMove" — skipped.` ``, (c) no throw. Mirrors the
   `replayGame`-today behavior at `replay.execute.ts:159–164`.

Test file uses `.test.ts` extension (never `.test.mjs`), imports
from `node:test` and `node:assert/strict`, and does not import
`boardgame.io` or any app-layer package.

No modification to `replay.verify.test.ts`.

---

## Out of Scope

Listed explicitly per the 00.3 `§1` requirement (non-empty
out-of-scope list):

- **`ReplayInputsFile` shape.** WP-063's concern; defined by WP-063
  execution, not here (Q5).
- **RNG changes.** D-0205 remains in force. The reverse-shuffle at
  `replay.execute.ts:121–123` is NOT replaced; that is a future WP
  gated on D-0203.
- **Consumer-side changes in `apps/**`.** WP-080 touches engine
  only. `apps/arena-client/`, `apps/registry-viewer/`, `apps/server/`,
  and the (not-yet-created) `apps/replay-producer/` are untouched.
- **`boardgame.io` version bump.** Locked at `^0.50.0`; no upgrade.
- **`replay.types.ts` modifications.** `ReplayInput`, `ReplayMove`,
  `ReplayResult`, and `DeterminismResult` are frozen contract
  surfaces from WP-027. `ReplayMoveContext` is NOT promoted to this
  file (Q4).
- **`replay.hash.ts` modifications.** `computeStateHash` is unchanged.
- **`replay.verify.ts` modifications.** WP-080 inherits WP-079's
  JSDoc narrowing verbatim and makes no further edits.
- **Exporting `MOVE_MAP` or `buildMoveContext`.** Both remain
  file-local (Q1 = A rejects Option C).
- **Cloning / deep-copying `gameState`.** Q2 = A rejects Option B;
  `applyReplayStep` never clones.
- **Generator / iterator API.** A generator form of the step surface
  is explicitly not introduced; Option A's named function is
  sufficient for WP-063 and future replay inspectors.
- **New long-lived abstractions beyond `applyReplayStep`.** No new
  types, no new modules, no new files outside
  `replay.execute.test.ts`.
- **Backfill of the EC-069 `<pending>` placeholder in
  `EC_INDEX.md`.** Owned by a separate SPEC commit.
- **Popping `stash@{0}` or `stash@{1}`.** Owned by the WP-068 /
  MOVE_LOG_FORMAT resolver.
- **Refactors, cleanups, or "while I'm here" improvements** anywhere
  in the replay directory or the engine barrel.

---

## Files Expected to Change

Every file WP-080 execution is permitted to create or modify. Any
file beyond this list is a scope violation (P6-27) — STOP and
escalate to a pre-flight amendment.

### New — engine tests
- `packages/game-engine/src/replay/replay.execute.test.ts` — **new**.
  Three test cases per `§Scope (In) §C`. Uses `node:test`. No
  `boardgame.io` import.

### Modified — engine
- `packages/game-engine/src/replay/replay.execute.ts` — **modified**.
  Adds named export `applyReplayStep` immediately above `replayGame`;
  refactors `replayGame`'s internal loop to delegate to
  `applyReplayStep`. `MOVE_MAP`, `buildMoveContext`, and
  `ReplayMoveContext` remain file-local. WP-079's JSDoc narrowing is
  preserved verbatim.
- `packages/game-engine/src/index.ts` — **modified**. Adds exactly
  one export line (`export { applyReplayStep } from
  './replay/replay.execute.js';`) under the existing WP-027 block.
  No reformatting of surrounding lines.

### Modified — governance (per Definition of Done)
- `docs/ai/STATUS.md` — **modified**. One line (or one short
  section) recording WP-080's completion.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**. WP-080 row
  checked off with today's date; WP-063 dependency cell confirmed
  to include WP-080 (the SPEC-drafting session already added it).
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**. EC-072
  row flipped from Draft to Done with `Executed YYYY-MM-DD at
  commit <hash>`. If dirty at commit time, apply the P6-41
  stash + re-apply + leave-stash pattern.
- `docs/ai/DECISIONS.md` — **modified** only if WP-080 execution
  surfaces new decisions beyond D-6304 (unlikely given the
  scope-locked design; note any deviation in the post-mortem).

### Must remain UNTOUCHED
- `packages/game-engine/src/replay/replay.types.ts`
- `packages/game-engine/src/replay/replay.hash.ts`
- `packages/game-engine/src/replay/replay.verify.ts` (beyond WP-079's
  already-landed edits)
- `packages/game-engine/src/replay/replay.verify.test.ts`
- `packages/game-engine/src/types.ts` (no new type re-exports)
- Every file under `packages/game-engine/src/` outside the replay
  directory and `index.ts`
- `packages/registry/**`, `packages/preplan/**`,
  `packages/vue-sfc-loader/**`
- `apps/arena-client/**`, `apps/registry-viewer/**`, `apps/server/**`
- `docs/ai/work-packets/WP-027-*.md` and `WP-079-*.md`
  (coordination expressed in WP-080 header, not by editing siblings)
- `docs/ai/work-packets/WP-063-*.md` (amendments live in the WP-063
  session prompt, not the WP body)
- `docs/ai/execution-checklists/EC-071-*.checklist.md`
- `stash@{0}` and `stash@{1}`
- EC-069 `<pending>` placeholder in `EC_INDEX.md`

---

## Acceptance Criteria

All items are binary pass/fail. No partial credit.

### Export surface
- [ ] `applyReplayStep` is exported from
      `packages/game-engine/src/replay/replay.execute.ts` with the
      signature in `§Locked contract values`.
- [ ] `applyReplayStep` is re-exported from
      `packages/game-engine/src/index.ts` exactly once, under the
      WP-027 block.
- [ ] `MOVE_MAP` appears exactly once in `replay.execute.ts` (file-
      local; no `export` keyword). Verified by `Select-String`.
- [ ] `buildMoveContext` appears exactly once in
      `replay.execute.ts` (file-local). Verified by `Select-String`.
- [ ] `ReplayMoveContext` is not exported from
      `replay.execute.ts` and is not declared anywhere else.

### Behavior preservation (regression guard)
- [ ] `replayGame`'s signature and return type are byte-identical to
      the pre-WP-080 commit. `git diff` on the `export function
      replayGame(` line shows neither removal nor addition.
- [ ] The `stateHash` produced by `replayGame` against the existing
      `verifyDeterminism` test fixture is byte-identical pre- and
      post-refactor.
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0; the
      game-engine test count is strictly greater than the pre-WP-080
      baseline (new tests added, no tests removed or skipped).
- [ ] `pnpm -r test` exits 0; repo-wide count is strictly greater
      than the pre-WP-080 baseline; 0 failures.

### Step function purity
- [ ] `applyReplayStep` does not use `console.*`, `Date.now`,
      `Math.random`, `performance.now`, or any `node:fs*` import
      (verified by `Select-String` against the file). Inherits
      `buildMoveContext`'s existing `random.Shuffle` only.
- [ ] `replay.execute.ts` does not import `boardgame.io` (verified
      by `Select-String`).

### Scope enforcement
- [ ] `git diff --name-only` shows only files listed in `§Files
      Expected to Change`.
- [ ] `apps/arena-client/**`, `apps/registry-viewer/**`,
      `apps/server/**`, `packages/registry/**`,
      `packages/preplan/**`, `packages/vue-sfc-loader/**` untouched.
- [ ] `packages/game-engine/src/` outside `replay/` and `index.ts`
      untouched.
- [ ] EC-069 `<pending>` placeholder in `EC_INDEX.md` NOT modified.
- [ ] `stash@{0}` and `stash@{1}` not popped.

---

## Verification Steps

```pwsh
# Step 1 — engine build & test
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
# Expected: both exit 0; test count strictly greater than pre-WP-080

# Step 2 — repo-wide test
pnpm -r test
# Expected: exit 0; repo-wide count strictly greater than pre-WP-080;
# 0 failures

# Step 3 — confirm applyReplayStep export in the source file
Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" `
  -Pattern "^export function applyReplayStep\("
# Expected: exactly one match

# Step 4 — confirm MOVE_MAP declared exactly once; no export keyword
(Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" `
  -Pattern "^const MOVE_MAP:").Count
# Expected: 1
Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" `
  -Pattern "^export const MOVE_MAP"
# Expected: no output

# Step 5 — confirm buildMoveContext declared exactly once; no export
(Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" `
  -Pattern "^function buildMoveContext\(").Count
# Expected: 1
Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" `
  -Pattern "^export function buildMoveContext"
# Expected: no output

# Step 6 — confirm applyReplayStep exported from barrel
Select-String -Path "packages\game-engine\src\index.ts" `
  -Pattern "applyReplayStep"
# Expected: at least one match under the WP-027 block

# Step 7 — confirm replayGame signature unchanged
git diff packages/game-engine/src/replay/replay.execute.ts `
  | Select-String -Pattern "^(-|\+)export function replayGame\("
# Expected: no matches (signature line neither removed nor added)

# Step 8 — confirm step function purity (no forbidden calls inside file)
Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" `
  -Pattern "console\.|Date\.now|Math\.random|performance\.now|from 'node:fs"
# Expected: no output

# Step 9 — confirm no boardgame.io import in the file
Select-String -Path "packages\game-engine\src\replay\replay.execute.ts" `
  -Pattern "from ['`"]boardgame\.io"
# Expected: no output

# Step 10 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in §Files Expected to Change

# Step 11 — confirm stashes untouched
git stash list
# Expected: stash@{0} + stash@{1} both present, unchanged
```

---

## Definition of Done

- [ ] Preflight items (EC slot EC-072, commit-prefix literal,
      inherited tree state, WP-079 landed, WP-063 amendment present)
      all resolved before coding.
- [ ] All Acceptance Criteria above pass.
- [ ] `applyReplayStep` export and `replayGame` loop refactor
      landed in one `EC-072:` commit.
- [ ] `docs/ai/STATUS.md` updated — one entry noting the step-level
      API landed and WP-063 is now unblocked at Pre-Session Gate #4.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-080 checked off
      with today's date.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-072 flipped
      from Draft to Done with `Executed YYYY-MM-DD at commit
      <hash>`. P6-41 stash + re-apply + leave-stash pattern applied
      if the file is dirty at commit time.
- [ ] No files outside `§Files Expected to Change` modified.
- [ ] All required `// why:` comments present (step function JSDoc;
      refactored loop; preserved reverse-shuffle cites from
      WP-027 / WP-079).
- [ ] Commit uses `EC-072:` prefix (NEVER `WP-080:`; NEVER
      `EC-080:`).
- [ ] **01.6 post-mortem complete (MANDATORY per P6-35)** — formal
      10-section output, in-session, BEFORE commit. Triggering
      criterion: **new long-lived abstraction** (`applyReplayStep`
      becomes the canonical step-level dispatch surface for every
      future replay consumer — WP-063's `buildSnapshotSequence`,
      future replay inspectors, future debug tools). The code
      category is not new (`replay.execute.ts` already lives inside
      the engine's replay directory), so the post-mortem has one
      trigger, not two.
- [ ] Pre-commit review runs in a **separate gatekeeper session**
      per P6-35; if the user explicitly requests in-session review
      via `AskUserQuestion`, the deviation MUST be disclosed in
      the `EC-072:` commit body per P6-42.
- [ ] `stash@{0}` and `stash@{1}` retained (NOT popped).
- [ ] EC-069 `<pending — gatekeeper session>` placeholder in
      `EC_INDEX.md` NOT backfilled in the `EC-072:` commit.
