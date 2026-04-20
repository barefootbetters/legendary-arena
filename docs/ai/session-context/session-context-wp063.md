# Session Context — WP-063 Replay Snapshot Producer

> **Generated:** 2026-04-18 after WP-062 / EC-069 landed on `wp-062-arena-hud`
> (commit `7eab3dc`). This file is the bridge step-0 input for the WP-063
> executing session. Load it first, then load the WP-063 session prompt
> and the WP-063 execution checklist.
>
> **Updated:** 2026-04-19 — WP-079 / EC-073 and WP-080 / EC-072 both
> Executed. Baselines, Pre-Session Gate #4, and lessons-learned captured
> below. See `## UPDATE 2026-04-19 — Post-WP-080 State` and
> `## Lessons From WP-080 / EC-072 Execution (2026-04-19)` sections near
> the end of this file; the sections above retain the pre-WP-080 snapshot
> for historical context.

---

## Upstream State at Session Start

- **Branch to cut from:** `main` once `wp-062-arena-hud` lands, OR directly
  from `wp-062-arena-hud` head (commit `723e002`) if the WP-063 session
  precedes the merge. Pre-flight MUST confirm which.
- **Repo test baseline:** **464 tests passing** (3 registry + 409
  game-engine + 11 vue-sfc-loader + 6 server + 35 arena-client). 0
  failures. WP-063 must not regress any of these counts and will add
  engine-side tests for `buildSnapshotSequence` plus CLI-side tests for
  `apps/replay-producer/`.
- **Engine baseline:** **409 tests / 101 suites** (unchanged since
  WP-067 / EC-068 at commit `1d709e5`; WP-062 did not touch the engine).
- **WP-063's three upstream dependencies are ALL COMPLETE:**
  - WP-005B (deterministic setup) — completed 2026-04-10 ✅
  - WP-027 (determinism & replay verification harness) — completed
    2026-04-14 ✅
  - WP-028 (UIState contract — authoritative view model) — completed
    2026-04-14 ✅
- **WP-063 is unblocked.** All contract and framework prerequisites
  (`buildInitialGameState`, the replay harness, `UIState` /
  `buildUIState`) exist in their shipped form.

---

## Dirty-Tree Advisory (DO NOT CLEAN WITHOUT READING)

At the close of the WP-062 session, the tree carries three classes of
unresolved state the WP-063 executor WILL inherit:

### 1. Retained `stash@{0}` — pre-existing WP-068 / MOVE_LOG_FORMAT governance edits

```text
stash@{0}: On wp-062-arena-hud: pre-existing WP-068 + MOVE_LOG_FORMAT
governance edits (quarantined during WP-062 commit)
```

Contents:
- `docs/ai/DECISIONS.md` — D-1414 (WP-068 Option A delivery path),
  D-0203 / D-0204 / D-0205 (MOVE_LOG_FORMAT decisions)
- `docs/ai/DECISIONS_INDEX.md` — index entries for the above
- `docs/ai/work-packets/WORK_INDEX.md` — WP-068 narrative updates
- `docs/ai/execution-checklists/EC_INDEX.md` — EC-070 WP-068 row

**WP-063 MUST NOT `git stash pop` this stash.** It is owned by the
WP-068 / MOVE_LOG_FORMAT governance owner. If WP-063 needs to modify
any of those four files during its own execution, apply the path-scoped
stash + re-apply + leave-stash pattern documented in
[01.4 §P6-41](../REFERENCE/01.4-pre-flight-invocation.md#p6-41) —
DO NOT bundle these edits into the WP-063 commit.

### 2. `EC_INDEX.md` carries a `<pending — gatekeeper session>` placeholder

The EC-069 row in `EC_INDEX.md` reads:

> `Executed 2026-04-18 at commit \`<pending — gatekeeper session>\`.`

The correct hash is `7eab3dc`. This backfill was intentionally deferred
(the execution commit's own hash cannot be self-referential). WP-063
should **not** backfill this placeholder as part of its own commit —
that would be cross-WP contamination. A separate small `SPEC:` commit
(or the eventual WP-068 stash-pop resolution commit) owns the backfill.

### 3. Untracked, unrelated files in the tree

From `git status --short` at WP-062 close:

- `docs/ai/MOVE_LOG_FORMAT.md`
- `docs/ai/invocations/forensics-move-log-format.md`
- `docs/ai/invocations/session-wp048-par-scenario-scoring.md`
- `docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
- `docs/ai/invocations/session-wp068-preferences-foundation.md`
- `docs/ai/session-context/session-context-forensics-move-log-format.md`
- `docs/ai/session-context/session-context-wp067.md`
- `docs/ai/session-context/session-context-wp079.md`
- `docs/ai/work-packets/WP-079-label-replay-harness-determinism-only.md`
- `content/themes/*.json` (many modified files — unrelated theming
  content)
- Various root-level survey text files (`Monrovia_ACTV_Survey_*.txt`,
  etc.)

**None of these are WP-063's scope.** If `git add -A` / `git add .` is
used instead of staging-by-name, the commit will sweep them in. STAGE
BY NAME only.

---

## WP-063 Scope Summary (from WORK_INDEX.md)

**Title:** Replay Snapshot Producer
**Status:** Reviewed (2026-04-16 lint-gate pass); execution unblocked
2026-04-18
**Primary Layer:** Game Engine + NEW CLI app (`apps/replay-producer/`)
**Dependencies:** WP-027, WP-028, WP-005B (all complete)
**Consumed by:** WP-064 (Game Log & Replay Inspector)

**Two-part structure:**

1. **Engine addition (`packages/game-engine/`):**
   - New type `ReplaySnapshotSequence`:
     - `version: 1` literal
     - `readonly snapshots: readonly UIState[]`
   - New pure helper `buildSnapshotSequence({ setupConfig, seed,
     inputs })` that:
     - Wraps WP-027's harness
     - Calls `buildUIState` (WP-028) at each step
     - Returns a frozen sequence
     - Is PURE: no I/O, no `console.*`, no wall clock, no RNG (use
       `ctx.random.*` via the harness, never `Math.random` or
       `Date.now`)
   - NO change to `G`, `UIState`, `buildUIState`, or WP-027's harness
     surface
   - NO change to any existing engine move or phase

2. **New CLI app (`apps/replay-producer/`):**
   - Wraps `buildSnapshotSequence` with file I/O
   - Command: `produce-replay --in <file> --out <file> --produced-at
     <iso>`
   - `--produced-at` override is **required** for byte-identical
     determinism tests across machines — the CLI must accept this
     as an explicit flag, not derive from `Date.now()`
   - Exit codes documented: 0 / 1 / 2 / 3 / 4
   - Sorted top-level JSON keys for stable diffs
   - Committed golden sample (`three-turn-sample`) demonstrating
     round-trip

**Untouched:**
- `apps/arena-client/`, `apps/registry-viewer/`, `apps/server/`
- `packages/registry/`, `packages/preplan/`
- Any existing engine move, phase, type, or setup orchestrator

---

## Key Differences vs. WP-062 (don't over-generalize)

WP-062 was a client-UI WP consuming vue-sfc-loader. WP-063 is
**engine + CLI** — none of the UI-specific precedents from WP-062
apply. In particular:

- **P6-40 (defineComponent form for non-leaf HUD .vue) DOES NOT APPLY.**
  WP-063 adds no SFCs. No vue-sfc-loader interaction.
- **D-6512 / P6-30 DO NOT APPLY.** Same reason.
- **The HUD container/presenter split pattern DOES NOT APPLY.** WP-063
  has no Pinia store, no Vue components, no accessibility tree.
- **The `aria-label` literal-leaf discipline (D-6201) DOES NOT APPLY.**
  WP-063 emits JSON, not an a11y tree.

What **does** apply from WP-062:
- **P6-41 (mixed-governance-edits stash+reapply pattern)** — likely,
  because the dirty-tree state outlined above persists.
- **P6-42 (same-session deviation disclosure)** — procedural; applies
  if the user collapses step 4 + step 5 in the WP-063 session.
- **P6-35 (01.6 post-mortem mandatory before commit)** — WP-063
  introduces a new long-lived abstraction (`ReplaySnapshotSequence`
  becomes the input type for WP-064 `<ReplayInspector />`) and a new
  execution path (the CLI). 01.6 IS MANDATORY.
- **P6-34 (pre-flight governance commits)** — WP-063 pre-flight must
  verify its own governance edits (WP-063 / EC-07? MDs) are committed
  before printing READY.
- **P6-38 (cross-WP index-file cleanliness)** — unchanged. WP-063 will
  flip its EC row from Draft to Done in EC_INDEX.md, which is still
  dirty (see §2 above).

---

## EC Slot Selection

Available 060-series ECs at session start:

| EC  | Status | Owner | Notes |
|---|---|---|---|
| EC-061 | Done | WP-061 original (Glossary panel) | Consumed — see
EC-061 header note |
| EC-062 | — | unused | Historically skipped |
| EC-063 | — | unused | Historically skipped |
| EC-064 | — | unused | Historically skipped |
| EC-065 | Done | WP-065 vue-sfc-loader | |
| EC-066 | Done/Draft | WP-066 registry-viewer data toggle | |
| EC-067 | Done | WP-061 gameplay client bootstrap | |
| EC-068 | Done | WP-067 UIState PAR projection | |
| EC-069 | Done | WP-062 Arena HUD (this session) | |
| EC-070 | Done (EC_INDEX only; file not on disk) | WP-068 preferences
foundation | File absent per P6-38 fallout |

**Recommended slot for WP-063: `EC-071`** (first truly free slot
following the established "next free slot" precedent from
EC-061→EC-067, EC-066→EC-068, EC-062→EC-069).

Pre-flight MUST triple-cross-reference (WP-063 header + EC-071 header +
session-prompt line) per the P6-30 / WP-061 / WP-062 pattern. Commit
prefix for WP-063 code: **`EC-071:`**. Not `WP-063:` (hook rejects per
P6-36).

---

## Pre-Flight Gates WP-063 Must Clear

1. **Dependency status** — all three (WP-005B, WP-027, WP-028) confirmed
   complete at commits `14ebb87` / earlier, verified by `git log --grep`
   or `WORK_INDEX.md` read.
2. **Engine baseline green at session base commit** — `pnpm -r test`
   shows 464+ passing, 0 failures, engine = 409/101.
3. **Governance-file cleanliness for WP-063's own artifacts** — WP-063
   MD, EC-071 MD, copilot-wp063 MD (if copilot check runs) must be
   committed under `SPEC:` before READY, per P6-34.
4. **Cross-WP governance index cleanliness** — WORK_INDEX.md,
   EC_INDEX.md, DECISIONS.md, DECISIONS_INDEX.md will still be dirty
   with WP-068 / MOVE_LOG residue AND the WP-062 EC_INDEX `<pending>`
   placeholder. The WP-063 executor inherits the same P6-38 pattern:
   document the expected governance stash-and-reapply in an "Expected
   Governance Updates" section of the WP-063 session prompt.
5. **Code-category classification** — `packages/game-engine/src/replay/`
   or similar new subdirectory inherits the Game Engine category; the
   CLI app `apps/replay-producer/` is a **new top-level app
   classification**. Pre-flight MUST produce a new PS-# DECISIONS.md
   entry for the CLI app category per the D-6511 precedent pattern,
   OR explicitly reuse an existing category if one fits (e.g., a
   generic "CLI producer app" category if it exists — verify against
   `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`).

---

## Things WP-063 Must Not Do

- **Modify `G`, `UIState`, `buildUIState`, or WP-027's harness surface.**
  WP-063 is strictly additive on the engine side.
- **Call `Math.random()`, `Date.now()`, or `performance.now()` anywhere
  in `buildSnapshotSequence`.** The helper is pure. The CLI may call
  `Date.now()` ONLY as a fallback if `--produced-at` is not supplied
  (and must document this in the help text), but the determinism test
  asserts that `--produced-at` is the deterministic path.
- **Use `console.*` inside the pure helper.** The CLI layer owns all
  stdout/stderr. The helper returns data; the CLI renders it.
- **Persist `G`.** WP-063 persists the `ReplaySnapshotSequence`
  (derived JSON), never the engine state directly. Snapshots are
  `UIState[]` — already a projection, never a save-game.
- **Touch `packages/preplan/`, `apps/server/`, `apps/arena-client/`,
  `apps/registry-viewer/`, or `packages/registry/`.** All untouched
  per the WORK_INDEX scope lock.
- **Pop `stash@{0}`.** Leave it for the WP-068 / MOVE_LOG owner.
- **Bundle the EC-069 `<pending>` hash backfill into the WP-063
  commit.** Separate `SPEC:` commit owns it.
- **Use `git add -A` or `git add .` for staging.** Stage by name.

---

## Likely New Decisions WP-063 Will Produce

Speculative — pre-flight should confirm:

- **D-63## (PS-# analog) — Code-category classification for
  `apps/replay-producer/`.** Is this a new "CLI Producer App"
  category, or does it inherit an existing one? Most likely new; the
  D-6511 pattern for `apps/arena-client/` is the template.
- **D-63## — `ReplaySnapshotSequence` version stamping.** `version: 1`
  literal is the starting point; a decision should lock the
  migration / bump policy (when a future WP adds fields, does
  `version` go to 2, or is the schema append-only at v1?).
- **D-63## — Sorted-JSON-keys determinism rationale.** WORK_INDEX
  says "sorted top-level JSON keys for stable diffs" — capture the
  rationale (golden-sample diffs, CI determinism) and whether sorting
  extends to nested objects.
- **D-63## — `--produced-at` override rationale.** Cross-machine
  determinism test requires byte-identical output; `Date.now()` is
  non-deterministic. Capture why the override is mandatory, not
  optional.
- **D-63## — Exit-code semantics (0/1/2/3/4).** WORK_INDEX promises
  documented exit codes; lock each code's meaning before CLI code is
  written.

---

## Established Patterns From WP-062 Worth Quoting

From commit `7eab3dc` (WP-062) and the 01.4 Precedent Log:

- **Session-prompt lint-gate discipline.** WP-062's session prompt ran
  through the 00.3 prompt lint checklist before execution; WP-063
  should do the same, paying attention to §7 forbidden dependencies
  (no `axios`, no `node-fetch`, no `Jest`, no `Vitest`, no `Mocha` —
  only `node:test`).
- **EC-mode commit discipline.** Stage by name, use `git commit -m
  "$(cat <<'EOF' ... EOF)"` for multi-paragraph messages, expect
  commit-msg hook validation (`EC-###:` / `SPEC:` / `INFRA:` only).
- **Mandatory 01.6 post-mortem before commit.** WP-063 meets the
  criteria (new abstraction + new contract + new code category).
- **Pre-commit review SHOULD run in a separate session.** WP-062
  exercised the P6-42 deviation (same-session review) under user
  approval; WP-063 should restore the separate-session discipline
  unless the user explicitly requests otherwise.

---

## Bootstrap Checklist for the WP-063 Executing Session

1. Load this file (session-context-wp063.md).
2. `git branch --show-current` — confirm branch. Cut `wp-063-replay-
   producer` from the appropriate base (either `main` after WP-062
   merges, or from `wp-062-arena-hud` head at `723e002` / the eventual
   EC_INDEX backfill commit).
3. `git status --short` — confirm the dirty-tree state matches §Dirty-
   Tree Advisory above; confirm `stash@{0}` is retained; do NOT touch it.
4. `pnpm -r test` — confirm 464 passing / 0 failing / engine 409/101.
5. Read:
   - `docs/ai/ARCHITECTURE.md` §Layer Boundary (Authoritative) —
     engine vs CLI split
   - `docs/ai/work-packets/WP-063-*.md` (scope lock)
   - `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — locate the right
     category for `apps/replay-producer/` or propose a new one
   - WP-027 source (harness) + WP-028 source (`buildUIState`) + WP-005B
     source (`buildInitialGameState`) — the three APIs WP-063 composes
6. Draft `docs/ai/execution-checklists/EC-071-replay-snapshot-producer.checklist.md`
   per the `EC-TEMPLATE.md` structure (Before Starting / Locked Values
   / Guardrails / Files to Produce / Verification / After Completing —
   seven sections minimum per P6-36).
7. Run pre-flight per `01.4` — include the §Pre-Flight Gates list
   above; explicitly enumerate the retained stash and EC_INDEX
   placeholder as non-blocking handoffs.
8. Run the copilot check per `01.7` on the draft session prompt.
9. Author the session prompt at
   `docs/ai/invocations/session-wp063-replay-snapshot-producer.md`
   using the WP-062 session prompt as a structural template (but not
   a content copy — WP-063's layer, goal, and guardrails are
   fundamentally different).
10. Execute under EC-mode; run 01.6 post-mortem (MANDATORY) before the
    pre-commit review and commit.

---

## One-Line Handoff

WP-062 landed at `7eab3dc`; WP-063's upstream is unblocked; engine
baseline 409/101, repo 464; stash@{0} quarantines unrelated
governance; EC-071 is the next free EC slot; same `defineComponent`
/ HUD lessons from WP-062 DO NOT APPLY here (engine + CLI, no SFCs).

---

## UPDATE 2026-04-19 — Post-WP-080 State

Two upstream WPs landed between the original generation of this file
and the next WP-063 session:

- **WP-079 / EC-073** executed 2026-04-19 at commit `1e6de0b` — replay
  harness JSDoc narrowed to "determinism-only" per D-0205; no runtime
  behavior change; required/forbidden phrase greps all pass. No impact
  on WP-063 beyond the JSDoc the executor will read when consuming
  `applyReplayStep`.
- **WP-080 / EC-072** executed 2026-04-19 at commit `dd0e2fd` +
  `ed15439` (SPEC governance) — added named export
  `applyReplayStep(gameState, move, numPlayers): LegendaryGameState`
  to `packages/game-engine/src/replay/replay.execute.ts`; refactored
  `replayGame`'s internal loop to delegate each iteration to
  `applyReplayStep`; added one barrel line in
  `packages/game-engine/src/index.ts`. `MOVE_MAP`, `buildMoveContext`,
  `ReplayMoveContext`, and `MoveFn` remain file-local (Q1 = A / Q4).

### What this means for WP-063

- **Pre-Session Gate #4 is now SATISFIED** at the WP-080 merge point
  (branch `wp-080-replay-harness-step-level-api` head = `ed15439`).
  `applyReplayStep` is visible at
  `packages/game-engine/src/index.ts`. The WP-063 invocation's
  amendment block (lines 14–33 + 56–64 of
  `session-wp063-replay-snapshot-producer.md`) can now resolve this
  gate on the first check.

- **`buildSnapshotSequence` wraps `applyReplayStep` — DO NOT duplicate
  `MOVE_MAP`.** This was the whole point of WP-080. The Q3 = A
  refactor made `applyReplayStep` the single source of truth for
  dispatch (D-6304). Any new dispatch table in `apps/replay-producer/`
  or anywhere else is a scope violation.

- **Baselines have shifted:**
  - engine: **412 tests / 102 suites** (was 409 / 101); delta owned by
    `packages/game-engine/src/replay/replay.execute.test.ts` added in
    `dd0e2fd`
  - repo-wide: **467 passing / 0 failing** (was 464)
  - The pre-flight §Gate #4 `pnpm -r test` expected counts in the
    WP-063 invocation (lines 66–75) predate WP-080. Treat 467 / 412
    as the new floor; any WP-063 test additions bring the counts
    further up.

- **Branch cut — consider Option B off `wp-080-replay-harness-step-level-api`.**
  The WP-080 execution invocation's §2 "Option B" pattern (cut the new
  WP branch from the upstream WP branch, not from `main`) worked
  cleanly when the new WP needs to inherit changes that are not yet
  on `main`. If `wp-080` has not been merged to `main` when WP-063
  starts, cut `wp-063-replay-snapshot-producer` from
  `wp-080-replay-harness-step-level-api` (head `ed15439`). If `wp-080`
  has merged to `main`, cut from `main` as the invocation suggests.
  Pre-flight must confirm the base explicitly.

- **`applyReplayStep` contract the WP-063 consumer must respect:**
  1. **Mutate-and-return-same-reference (Q2 = A).** The returned
     `LegendaryGameState` is the identity of the input. The `=` in
     `gameState = applyReplayStep(gameState, move, numPlayers)` is
     stylistic; the binding is always identical.
  2. **Consumers wanting historical snapshots MUST project via
     `buildUIState` after each step.** Do NOT retain `G` copies
     between iterations; they all alias the same mutated object.
     `buildSnapshotSequence` is correctly designed around this —
     WP-063's WP body already says "calls `buildUIState` (WP-028) at
     each step." That was written before WP-080 landed; the contract
     has not changed.
  3. **`applyReplayStep` never throws.** Unknown move names push
     `Replay warning: unknown move name "<name>" — skipped.` into
     `gameState.messages` and return. WP-063 does not need to guard
     the call with `try`/`catch`.
  4. **`applyReplayStep` inherits `buildMoveContext`'s deterministic
     reverse-shuffle** (D-0205). No seed-faithful live-match RNG.
     WP-063's output is a snapshot of engine reducer determinism,
     not a live-match replay. Document this in the CLI's help text
     if the CLI's semantics are "replay verification harness output"
     rather than "live match reconstruction."

- **Regression hash anchor (informational).** WP-080 locked
  `PRE_WP080_HASH = 'a56f949e'` as the `stateHash` of `replayGame`
  against the standard fixture (9-field `MatchSetupConfig`,
  `seed: 'test-seed-001'`, `playerOrder: ['0', '1']`,
  `moves: []`). If WP-063's golden artifact is built against the
  same fixture and empty moves, `stateHash` will be `a56f949e`. WP-063
  can use a different fixture — the anchor is not required, just
  available.

- **EC-069 `<pending>` placeholder STILL present in `EC_INDEX.md`.**
  Neither WP-079 nor WP-080 backfilled it. Leave it alone in WP-063
  too.

- **Stashes.** `stash@{0}` + `stash@{1}` still retained unchanged
  across both WP-079 and WP-080. The §Dirty-Tree Advisory above
  still applies.

---

## Lessons From WP-080 / EC-072 Execution (2026-04-19)

Patterns and pitfalls surfaced during the WP-080 execution session that
WP-063's executor should carry forward or, where flagged, explicitly
avoid.

### Patterns to repeat

1. **Two-commit split (code + governance).** The `EC-###:` code commit
   and the `SPEC:` governance commit (STATUS.md + WORK_INDEX.md +
   EC_INDEX.md) landed cleanly on the first attempt under the
   commit-msg hook. No `--amend` was needed. This matches the
   WP-079 / EC-073 pattern (`1e6de0b` + `2131116`) and is now the
   established shape for EC execution commits.

2. **Capture `<A-HASH>` from `git rev-parse HEAD` immediately after
   Commit A.** Substitute it verbatim into the three governance files
   before Commit B stages. `STATUS.md` cites it in prose; `WORK_INDEX.md`
   carries it in the `[x] ... Executed YYYY-MM-DD at commit <A-HASH>`
   line; `EC_INDEX.md` carries it in the EC row's trailing sentence
   AND in the "Last updated:" footer. WP-063 should do the same with
   `EC-071`'s code-commit hash.

3. **Separate gatekeeper session for pre-commit review.** P6-35's
   default path (the `§9` locked choice in the WP-080 execution
   invocation). Under this flow: the execution session stops before
   Commit A, the user opens a fresh Claude Code session pointed at
   `docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`, the gatekeeper
   returns a verdict ("WP COMPLETE" or a concrete fix list), and the
   execution session resumes to land the two-commit split. WP-063
   meets the same trigger criteria (new long-lived abstraction —
   `ReplaySnapshotSequence` + `buildSnapshotSequence`; new execution
   path — the CLI). The user should plan for the gatekeeper session.

4. **Gatekeeper may produce governance artifacts. Don't bundle them.**
   WP-080's gatekeeper session produced two files — a full 01.6
   post-mortem artifact (`docs/ai/post-mortems/01.6-applyReplayStep.md`)
   and a 01.3 one-liner reference (`docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`).
   They were left **untracked** during Commit A + Commit B and are
   owned by independent `SPEC:` commits (landed by the user
   separately). If WP-063's gatekeeper produces similar artifacts,
   the same discipline applies — do NOT stage them into the
   `EC-071:` code commit or the WP-063 `SPEC:` governance commit.

5. **01.6 post-mortem runs in-session, before Commit A.** The §5
   aliasing audit is the load-bearing section. For `buildSnapshotSequence`:
   the audit should explicitly document the return-frozen-array
   contract, whether `snapshots[i]` aliases any mutable `G` sub-field
   (it must not — `buildUIState` returns a projection, and the
   sequence array should be `Object.freeze`d), and distinguish from
   the WP-028 `cardKeywords` precedent (unintentional aliasing of a
   returned array sharing a reference with a mutable `G`-owned array).
   This audit cannot be skipped and cannot be left vague.

6. **Mirror existing test fixtures — don't reinvent.** WP-080's
   `replay.execute.test.ts` copied `replay.verify.test.ts`'s
   `standardInput` (9-field `MatchSetupConfig`, `seed: 'test-seed-001'`,
   `playerOrder: ['0', '1']`, `moves: []`) and the `mockRegistry`
   pattern verbatim. WP-063's engine-side tests for
   `buildSnapshotSequence` should do the same — start from
   `replay.verify.test.ts`'s fixture, extend with moves where needed.
   Avoid hand-rolling a new `CardRegistryReader` or `ReplayInput`
   shape; the existing minimal fixtures proved sufficient for
   determinism assertions.

7. **Content-based greps, not line-number references.** The WP-080
   invocation specified greps like `^export function applyReplayStep\(`
   and forbade line-number-based specifications because WP-079's
   JSDoc edits had already shifted line numbers. This held — every
   "at approx line N" reference in WP-080's own text was stale by
   execution time, and the content-based greps gave clean pass/fail
   answers. WP-063 should reach for content-based greps
   (`^export function buildSnapshotSequence\(`, `ReplaySnapshotSequence`,
   `version: 1`, `applyReplayStep`, etc.) rather than line ranges in
   its EC's §Verification Steps.

8. **Dirty-tree §3 lock discipline carries across sessions.** The
   `stash@{0}` + `stash@{1}` + EC-069 `<pending>` + 7 untracked
   invocation/session-context items were all still present at
   WP-080's session start and remained untouched at WP-080's session
   end. This file's §Dirty-Tree Advisory still applies verbatim to
   WP-063.

9. **Commit message body template.** The WP-080 Commit A body shape
   — (1) one-line present-tense summary after the prefix, (2)
   paragraph on what changed, (3) paragraph on contract / decisions,
   (4) paragraph on verification counts + regression anchor,
   (5) paragraph on downstream unblock, (6) standard `Co-Authored-By`
   trailer — read well and satisfied the commit-msg hook's subject
   constraints on the first attempt. Reuse this shape for `EC-071:`.

### Patterns NOT to repeat

1. **The `__CAPTURE_ME__` one-shot hash-capture pattern was flagged by
   WP-080 itself as "not a permanent pattern — future WPs should not
   propagate it."** WP-063 is additive (new helper + new CLI + new
   app); no pre-refactor regression anchor exists for it to guard
   against. Do not import this pattern.

2. **Do NOT re-word WP-079's JSDoc narrowing on `replay.execute.ts`
   or `replay.verify.ts`.** Forbidden phrases (`replays live matches`,
   `replays a specific match`, `reproduces live-match outcomes`)
   grep to zero; required phrases (`determinism-only` ≥ 2 in
   execute / ≥ 1 in verify; D-0205 xref; `MOVE_LOG_FORMAT.md`
   Gap #4 xref) all hold. WP-063 reads these files but does not
   edit them.

3. **Do NOT export `MOVE_MAP`, `buildMoveContext`, `ReplayMoveContext`,
   `MoveFn`, or `replayAdvanceStage` from any file.** WP-080 locked
   them file-local (Q1 = A / Q4). `buildSnapshotSequence` calls
   `applyReplayStep` — it does not need any of these. If a second
   consumer ever surfaces that legitimately needs the context shape
   or dispatch table, that promotion is a follow-up WP with an
   explicit second-consumer rationale — not a WP-063 side-effect.

4. **Do NOT clone `gameState` inside any step-level loop.** Q2 = A
   (mutate-and-return-same-reference) is the contract. The snapshot
   sequence collects `UIState` projections via `buildUIState`, not
   `G` copies. Calling `structuredClone(gameState)` inside
   `buildSnapshotSequence`'s loop is an anti-pattern that defeats
   WP-080's entire design.

5. **Do NOT add a `boardgame.io` import to any file under
   `packages/game-engine/src/replay/`.** The directory is
   `boardgame.io`-free today (WP-027 invariant, held through WP-079
   and WP-080). `buildSnapshotSequence` must remain in this
   directory-wide invariant.

6. **Do NOT use `git add -A` or `git add .`** — stage by name. The
   dirty tree at WP-080 execution still carried 7 untracked
   invocation / session-context scraps plus `stash@{0}` / `stash@{1}`
   / modified WP-079 session prompt. `git add -A` would have swept
   them into the commit. WP-063 inherits the same risk surface.

### Procedural observations

- **Commit-msg hook's subject-length floor is 12 chars after the
  prefix.** The WP-080 Commit A subject (`add applyReplayStep
  step-level API and delegate replayGame loop`, 64 chars) cleared
  it easily. Short subjects like `add step API` would fail the
  hook.

- **LF / CRLF warnings from Git on Windows are cosmetic** — the
  `core.autocrlf` normalization fires on every `git add` and is
  not a gate. WP-080 saw warnings on all three code files; neither
  commit was blocked.

- **`pnpm -r test` invoked from the repo root is the canonical
  full-test command.** `pnpm --filter @legendary-arena/game-engine
  test` narrows to the engine. The `ℹ tests NNN / pass NNN / fail
  NNN / skipped NNN` lines in the output are the authoritative
  counts per package; sum them for the repo-wide figure.

- **EC_INDEX footer update is easy to forget.** The "Last updated:"
  line at the bottom of `EC_INDEX.md` wants a short one-liner
  citing the commit hash and the packet's headline. WP-080 updated
  it as part of Commit B. WP-063's `SPEC:` governance commit
  should do the same for EC-071.
