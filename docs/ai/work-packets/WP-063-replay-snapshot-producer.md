# WP-063 — Replay Snapshot Producer

**Status:** Complete
**Primary Layer:** Game Engine (type + pure helper) + new CLI app
(`apps/replay-producer/`)
**Dependencies:** WP-027 (determinism & replay verification harness,
commit `<verify via git log>`), WP-028 (UIState + `buildUIState`,
commit `<verify via git log>`), WP-005B (`Game.setup()` deterministic
construction, commit `<verify via git log>`). **All three dependencies
complete as of 2026-04-18** (confirmed by `WORK_INDEX.md` `[x]` marks
at lines 249 / 589 / 606).
**EC:** EC-071 (next free slot; see Preflight §EC Slot Lock).
**Commit prefix:** `EC-071:` (NOT `WP-063:` — per P6-36 the commit-msg
hook rejects `WP-###:` prefixes; see Preflight §Commit Prefix Lock).

---

## Session Context

WP-027 locked the replay verification harness: given a `MatchSetupConfig`,
a seed, and an ordered sequence of inputs, the engine produces an
identical `G` every time. WP-028 added `buildUIState(gameState, ctx)`
deriving the read-only `UIState` projection. No tooling yet combines the
two to produce a portable, deterministic artifact that downstream UI
packets can consume. This packet adds that tooling in two pieces: (1) a
pure engine-side helper `buildSnapshotSequence` that wraps WP-027 and
WP-028 to emit `ReplaySnapshotSequence`, and (2) a new CLI app
`apps/replay-producer/` that wraps the helper with file I/O so humans and
CI can produce sample artifacts. WP-064 (game log & replay inspector)
consumes the shape this packet defines.

---

## Goal

After this session:

- `@legendary-arena/game-engine` exports a new type
  `ReplaySnapshotSequence` from
  `packages/game-engine/src/replay/replaySnapshot.types.ts`.
- `@legendary-arena/game-engine` exports a pure helper
  `buildSnapshotSequence({ setupConfig, seed, inputs }):
  ReplaySnapshotSequence` from
  `packages/game-engine/src/replay/buildSnapshotSequence.ts`. The helper
  drives the engine through `Game.setup()` + each ordered input, calls
  `buildUIState` at each step, and returns the sequence. It performs no
  I/O, throws only on fatal invalid setup (matching WP-005B's rule that
  only `Game.setup()` may throw).
- A new CLI app `apps/replay-producer/` reads a `ReplayInputsFile` JSON
  from disk, invokes `buildSnapshotSequence`, and writes
  `ReplaySnapshotSequence` JSON either to stdout or to a file specified
  by `--out`.
- `pnpm --filter @legendary-arena/replay-producer produce-replay --in
  <inputs.json> --out <sequence.json>` exits 0 deterministically: the
  output file is byte-identical across runs with the same inputs.
- At least one committed sample artifact under
  `apps/replay-producer/samples/` demonstrates the round-trip.

No engine rule changes. No change to `G` shape. No change to WP-027's
harness. No server, network, or DB access.

---

## Assumes

- **Repo test baseline: 464 tests passing** (3 registry + 409
  game-engine + 11 vue-sfc-loader + 6 server + 35 arena-client), 0
  failures, as of commit `7eab3dc` (WP-062 execution). WP-063 must not
  regress any of these counts. Engine baseline is **409 tests / 101
  suites** (unchanged since WP-067 / EC-068 at commit `1d709e5` —
  WP-062 did not modify the engine). WP-063 will ADD to both the
  engine count (new `buildSnapshotSequence.test.ts` suite) and
  introduce a NEW per-app count for `apps/replay-producer/` (the
  fifth app with its own test suite).
- WP-027 complete. Specifically:
  - The replay harness exists and deterministically reproduces `G` from a
    `MatchSetupConfig`, a seed, and an ordered input list.
  - If WP-027 defined a `ReplayInput` type and/or `ReplayInputsFile`
    shape, this packet reuses them verbatim. If WP-027 did not define an
    on-disk input file shape, this packet defines it here.
- WP-028 complete: `buildUIState(gameState, ctx)` and `UIState` are
  exported from `@legendary-arena/game-engine`.
- WP-005B complete: `Game.setup()` throws on invalid
  `MatchSetupConfig`; moves never throw.
- `pnpm --filter @legendary-arena/game-engine build` exits 0.
- `pnpm --filter @legendary-arena/game-engine test` exits 0.

If any of the above is false, this packet is **BLOCKED**. In particular,
if WP-027's harness surface does not cleanly support stepping one input
at a time with intermediate state capture, stop and ask the human —
reshaping WP-027 is out of scope here.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md §Rule Execution Pipeline` — understand the
  deterministic step model before driving inputs programmatically.
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the CLI
  app is new. Confirm its permitted imports before writing a line: it
  may import `@legendary-arena/game-engine` and Node built-ins, nothing
  else. It MUST NOT import `@legendary-arena/registry` at runtime unless
  `Game.setup()` itself requires it — if required, mirror whatever
  `apps/server/` already does.
- `docs/ai/work-packets/WP-027-determinism-replay-verification-harness.md`
  — the exact harness surface this packet wraps. Read completely.
- `docs/ai/work-packets/WP-028-ui-state-contract-authoritative-view-model.md`
  — `buildUIState` is the projection function called at each step.
- `docs/ai/work-packets/WP-005B-deterministic-setup-implementation.md` —
  confirms `Game.setup()` is the sole throwing site and establishes the
  `makeMockCtx` reversing convention used by tests.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 6 (`// why:`), Rule 8
  (no `.reduce()` in rule/zone operations; acceptable for simple
  accumulation here only if the sequence is an obvious append), Rule 11
  (full-sentence error messages), Rule 13 (ESM only).
- `apps/server/` — prior-art for a CLI entrypoint in this repo. Mirror
  its style (Commander or native `parseArgs`, based on what the server
  already uses) to avoid a drift decision.

---

## Preflight (Must Pass Before Coding)

Each item below is a **blocker**. Resolve before writing a single line.

### EC Slot Lock (do not re-derive)

**This WP executes against EC-071.** Existing ECs in the 060 series:
EC-061 (registry-viewer Glossary panel, Done), EC-065 (vue-sfc-loader,
Done), EC-066 (registry-viewer data toggle, Draft/Done), EC-067 (WP-061
client bootstrap, Done), EC-068 (WP-067 UIState PAR projection, Done),
EC-069 (WP-062 Arena HUD, Done — commit `7eab3dc`), EC-070 (WP-068
preferences foundation, Done in EC_INDEX.md but checklist file not yet
on disk per P6-38 fallout). EC-062, EC-063, EC-064 are unused. Following
the EC-061→EC-067, EC-066→EC-068, and EC-062→EC-069 retargeting
precedent, the next truly free slot is **EC-071**.

- Commit prefix: `EC-071:` (not `WP-063:`)
- EC filename: `docs/ai/execution-checklists/EC-071-replay-snapshot-producer.checklist.md`
- EC header note must preserve the rationale (consumed-slot history) so
  future readers understand why a 060-range WP uses an out-of-sequence
  EC. See the EC-067 / EC-069 headers for the template.

### Commit Prefix Lock (P6-36)

**`WP-###:` is NEVER a valid commit prefix for code changes.** The
`.githooks/commit-msg` hook rejects it; 01.3 allows only `EC-###:`,
`SPEC:`, and `INFRA:`. Every WP-063 code-changing commit MUST use the
`EC-071:` prefix; every documentation/governance correction MUST use
`SPEC:`. The session prompt for WP-063 MUST quote 01.3's three-prefix
list verbatim or cite 01.3 without enumerating options — never invent
a fourth prefix. See 01.4 §P6-36 for the WP-068 precedent where this
gap forced a mid-session pivot.

### Post-WP-062 Inherited Tree State (MUST NOT modify)

The WP-063 executing session inherits three unresolved states from the
close of WP-062 (commit `7eab3dc`). Pre-flight MUST document these as
non-blocking handoffs before READY is printed:

1. **Retained `stash@{0}`** — holds pre-existing WP-068 /
   MOVE_LOG_FORMAT governance edits (D-1414, D-0203, D-0204, D-0205,
   WP-068 WORK_INDEX row, EC-070 EC_INDEX row, DECISIONS_INDEX.md
   entries). Owned by the WP-068 / MOVE_LOG_FORMAT governance
   resolver. **WP-063 MUST NOT `git stash pop` this stash.** If
   WP-063's own governance edits collide with the same four files
   (DECISIONS.md, DECISIONS_INDEX.md, WORK_INDEX.md, EC_INDEX.md),
   apply the path-scoped stash + re-apply + leave-stash pattern
   documented in 01.4 §P6-41 — DO NOT bundle the stashed edits into
   the WP-063 commit.
2. **`EC_INDEX.md` `<pending — gatekeeper session>` placeholder** —
   the EC-069 row references `<pending>` where commit `7eab3dc` should
   appear. WP-063 MUST NOT backfill this placeholder as part of its
   own commit (cross-WP contamination). A separate `SPEC:` commit or
   the WP-068 stash-pop resolution commit owns the backfill.
3. **Unrelated untracked / modified files** — `docs/ai/MOVE_LOG_FORMAT.md`,
   `docs/ai/invocations/session-wp*.md` (multiple), `docs/ai/session-context/*.md`
   (multiple), `docs/ai/work-packets/WP-079-*.md`, `content/themes/*.json`,
   and root-level survey text files are all outside WP-063's scope.
   Stage by name only; NEVER use `git add .` or `git add -A`.

### Precedent Applicability (from 01.4 Precedent Log)

**APPLIES to WP-063 — must consult before session prompt is generated:**
- **P6-34: Pre-flight READY verdict must verify pre-flight edits are
  committed, not just applied.** WP-063 pre-flight will produce
  DECISIONS.md entries (CLI location, sorted-key serialization,
  `--produced-at` rationale, `version: 1` literal, `ReplayInputsFile`
  origin, and the new code-category classification for
  `apps/replay-producer/`). Commit these under a `SPEC:` prefix first,
  then print READY with the SPEC commit hash as the new base.
- **P6-35: 01.6 post-mortem is MANDATORY before commit.** WP-063
  introduces a new long-lived abstraction (`ReplaySnapshotSequence`
  becomes the input type for WP-064 `<ReplayInspector />`) and a new
  code category (`apps/replay-producer/` as the first "CLI Producer
  App"). Both 01.6 triggering criteria (new long-lived abstraction +
  new code category) are met. The session prompt MUST encode 01.6 as
  a literal STOP gate before commit; an informal in-line summary is
  NOT a substitute for the formal 10-section output.
- **P6-36: Session-context must never offer `WP-###:` as a commit
  prefix.** See §Commit Prefix Lock above.
- **P6-37: Test-infrastructure additions are implicit in scope when
  AC requires a test-verification command to exit 0.** `apps/replay-
  producer/package.json` is brand new — the test script, test runner
  devDep (`tsx`), and any tsconfig adjustments MUST be enumerated as
  EXPLICIT allowlist entries in §Files Expected to Change, not
  implicit scope. WP-068's P6-37 deviation is the cautionary
  precedent: a WP that says "package.json — new" without listing the
  test-infra triggers a scope interpretation dispute mid-execution.
- **P6-38: Pre-flight must verify governance index files are
  commit-clean.** WORK_INDEX.md, EC_INDEX.md, DECISIONS.md, and
  DECISIONS_INDEX.md will still be dirty with WP-068 residue AND the
  WP-062 EC_INDEX `<pending>` placeholder. Document the expected
  governance-update handoff explicitly in the pre-flight READY
  verdict; the executing session must know IN ADVANCE which index
  files it will need to stash + reapply.
- **P6-41: Path-scoped stash + re-apply + leave-stash pattern for
  mixed governance-file edits.** Likely to apply during WP-063's
  DoD-driven updates to DECISIONS.md, WORK_INDEX.md, and
  EC_INDEX.md. Executing session should default to this pattern
  when the file-level diff contains both pre-existing and
  in-session hunks.
- **P6-42: Same-session 01.6 / pre-commit review is a user-approved
  deviation from P6-35 and must be disclosed in the commit body.**
  WP-063 should RESTORE the separate-session gatekeeper discipline
  for the pre-commit review unless the user explicitly requests the
  deviation via `AskUserQuestion`. WP-067 is the "do not repeat"
  precedent; WP-062 was the user-approved exception with disclosure.

**DOES NOT APPLY to WP-063 — do NOT cargo-cult from UI WPs:**
- **P6-30 / P6-40: `defineComponent` authoring form under vue-sfc-
  loader.** WP-063 adds NO `.vue` files. No SFCs, no vue-sfc-loader
  interaction. Ignore.
- **D-6512: setup-scope binding surfacing.** Same reason. Ignore.
- **D-6201: literal-leaf-name `aria-label` rule.** WP-063 emits
  JSON, not an accessibility tree. No a11y labels. Ignore.
- **D-6202: no client-side arithmetic on UIState.** Engine-side
  helpers and CLI layer ARE permitted to count snapshots and read
  `inputs.length` for loop bookkeeping (e.g., `inputs.length + 1`
  snapshot count assertion). That is not "client-side arithmetic
  on game values" — it's control-flow arithmetic on collection
  lengths. Distinguish carefully: `UIState` field combination is
  still forbidden in any future HUD consumer of `ReplaySnapshotSequence`.
- **HUD container/presenter split.** WP-063 has no components, no
  Pinia store, no DOM.

### Original Preflight Blockers (unchanged)

- **WP-027 harness surface:** open `packages/game-engine/src/replay/*.ts`
  (or equivalent) and confirm:
  - Is there a step-level API that runs `Game.setup()` and then applies
    one input at a time with intermediate `G` + `ctx` observable, or
    does the harness run end-to-end only?
  - If only end-to-end, this packet is **BLOCKED** — raising
    harness-shape changes is its own WP.
  - If step-level: record the exact function name(s) and signature(s)
    in DECISIONS.md before coding, so the helper's integration is
    explicit rather than guessed.
- **Engine `index.ts` export policy:** confirm the engine's public
  barrel pattern (re-exports, named exports, or individual files).
  Additions in this packet match that policy exactly.
- **`ReplayInputsFile` precedent:** grep the repo for existing
  definitions of a replay-input file shape. If WP-027 already defines
  one, reuse it verbatim — this packet does not redefine it. If none
  exists, this packet defines it (Scope §A) and logs D-NNNN in
  DECISIONS.md.
- **CLI arg parsing prior art:** inspect `apps/server/` for whether it
  uses `commander`, `yargs`, `minimist`, or Node's built-in
  `node:util` `parseArgs`. This packet matches whatever the server
  uses. If the server has no CLI yet, use `node:util` `parseArgs` (no
  new dependency).
- **Sourcemap + stack-trace support for CLI:** confirm the Node
  invocation enables sourcemaps (e.g., `NODE_OPTIONS=--enable-source-maps`
  in `package.json` scripts, or `process.setSourceMapsEnabled(true)` at
  the entry). CLI failures must produce readable stack traces pointing
  at TypeScript, not compiled JS. If the repo has no sourcemap
  precedent for CLIs, establish it here and log DECISIONS.md.
- **Committed-artifact determinism harness:** confirm the repo has a
  pattern for byte-level equivalence assertions in tests (diff helpers,
  golden-file patterns, etc.). If not, the CLI test introduces one
  using `node:assert`'s `strictEqual` on the two run outputs.

If any item is unknown, **stop and ask** before coding.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness goes through the engine via
  `ctx.random.*`. The helper wraps WP-027 which handles this already;
  this packet adds no new randomness source.
- Never throw inside moves. `Game.setup()` is the only permitted throw
  site (WP-005B).
- Never persist `G` — the helper collects `UIState` snapshots, not `G`
  copies.
- `UIState` must be JSON-serializable (already guaranteed by WP-028);
  the snapshot sequence inherits that guarantee.
- ESM only, Node v22+; `node:` prefix on built-ins (`node:fs/promises`,
  `node:path`, `node:process`, `node:util`).
- Test files use `.test.ts` extension.
- Full file contents for every new or modified file. No diffs, no
  snippets, no "show only the changed section" output.
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`;
  no ORMs (this CLI does not touch a database); no `Jest`, no
  `Vitest`, no `Mocha` — only `node:test`; no `commander`, no `yargs`,
  no `minimist` unless `apps/server/` already uses one (in which case
  match it). Prefer Node's built-in `node:util` `parseArgs`. Any new
  dependency requires a DECISIONS.md justification and the full
  updated `package.json` in the output.

**Packet-specific:**
- The engine helper `buildSnapshotSequence` is **pure**: no I/O, no
  `console.*`, no wall clock, no mutation of inputs, no side effects
  outside constructing the returned sequence.
- The CLI is the **only** place that reads from disk or writes to stdout.
- The `ReplaySnapshotSequence` type is defined **only once**, in the
  engine. WP-064 imports it as a type; do not re-declare it anywhere.
- Determinism verification: the CLI must produce byte-identical output
  across two runs with the same input file. A test asserts this.
- The helper must handle an empty `inputs` array by returning a sequence
  of length 1 (just the post-setup snapshot). Verify with a test.
- The helper must not invoke `buildUIState` more than `inputs.length + 1`
  times per call (one initial + one per input). A test asserts the call
  count.
- No `.reduce()` for the step loop — use a `for...of` that appends to a
  local mutable array, then freezes on return.
- The CLI produces JSON with sorted object keys at the top level (for
  deterministic diffs). If JSON.stringify with the default `replacer`
  does not already produce stable key order, add a minimal sorted
  serializer — document the choice in DECISIONS.md.
- Full-sentence error messages on invalid input file, missing `--in`,
  unreadable file, unwritable output path.

**Session protocol:**
- If WP-027's harness does not expose a step function or equivalent
  per-input stepping, stop and ask — do not patch WP-027 locked contract
  files from this packet.
- If `buildUIState` signature is incompatible with the shape returned
  by the harness at each step, stop and ask.

**Locked contract values (defined by this packet):**

- `ReplaySnapshotSequence` shape:
  ```ts
  interface ReplaySnapshotSequence {
    readonly version: 1
    readonly snapshots: readonly UIState[]
    readonly metadata?: {
      readonly matchId?: string
      readonly seed?: string
      readonly producedAt?: string
    }
  }
  ```
  - `version` is the literal `1` so future format revs are a breaking
    change detectable at type level.
  - `snapshots` is ordered: index 0 is post-setup; index `i > 0` is the
    state after the `i`-th input is applied.
  - `metadata.producedAt` is informational only. Consumers (WP-064) must
    not use it for ordering.

- `ReplayInputsFile` shape (defined here unless WP-027 already defines
  it; in that case, reuse WP-027's definition):
  ```ts
  interface ReplayInputsFile {
    readonly version: 1
    readonly setupConfig: MatchSetupConfig
    readonly seed: string
    readonly inputs: readonly ReplayInput[]
    readonly metadata?: {
      readonly matchId?: string
      readonly note?: string
    }
  }
  ```

---

## Debuggability & Diagnostics

- Given an identical `ReplayInputsFile`, `buildSnapshotSequence` returns
  a sequence whose `JSON.stringify` output is byte-identical across runs.
  A test asserts this directly.
- The CLI writes only the JSON artifact to the output target; any
  progress or diagnostics go to `stderr`, never `stdout`, so piping the
  output is safe.
- The CLI exits with code 0 on success, non-zero with a full-sentence
  error on `stderr` otherwise. Exit codes: 0 success, 1 invalid args, 2
  input parse error, 3 engine error, 4 output write error.
- The helper does not log. It surfaces problems through thrown errors
  only at `Game.setup()`; move-level failures are captured as
  engine-side state changes and reflected in the snapshot sequence.
- **Sourcemaps:** CLI invocations enable Node sourcemaps (via
  `NODE_OPTIONS=--enable-source-maps` in the `produce-replay` script
  or `process.setSourceMapsEnabled(true)` at entry). Stack traces
  must point at TypeScript source lines, not compiled JS.
- **Optional DEBUG stderr summary:** when `process.env.DEBUG` matches
  `replay-producer` (or `*`), the CLI prints a one-line summary to
  **stderr** after success: `input=<path> inputs=<N> snapshots=<N+1>
  out=<path> bytes=<size>`. This aids CI and local debugging without
  polluting the stdout artifact. No other logging anywhere.
- **Determinism test names the failing field:** when the
  run-twice-and-diff test fails, the failure message must name the
  first differing byte offset and (if inside valid JSON) the top-level
  key whose value diverged. Silent `assert.strictEqual` failures are
  not acceptable — wrap the assertion or use a small custom diff.

---

## Scope (In)

### A) Engine types

- `packages/game-engine/src/replay/replaySnapshot.types.ts` — **new**:
  - Exports `interface ReplaySnapshotSequence` (shape above).
  - Exports `interface ReplayInputsFile` (shape above) IF WP-027 has not
    already defined it; otherwise re-exports WP-027's definition here
    for consumer convenience and documents the choice in DECISIONS.md.
  - `// why:` comment on `version: 1` literal: future format revs must
    be detectable at compile time, not guessed from JSON shape.

### B) Engine helper

- `packages/game-engine/src/replay/buildSnapshotSequence.ts` — **new**:
  - `buildSnapshotSequence(params: { setupConfig: MatchSetupConfig;
    seed: string; inputs: readonly ReplayInput[]; metadata?:
    ReplaySnapshotSequence['metadata'] }): ReplaySnapshotSequence`
  - Internally: invoke WP-027's harness to run `Game.setup()` and each
    input step. Call `buildUIState` after setup and after each input.
    Collect results into a local array; `Object.freeze` the returned
    object (and `snapshots` array) before returning.
  - `// why:` comment: snapshots include index 0 (post-setup) so
    consumers can render the opening state without running the engine
    client-side.
  - No I/O. No `console.*`. No wall clock.

### C) Engine index & types export

- `packages/game-engine/src/index.ts` — **modified** — export
  `ReplaySnapshotSequence`, `ReplayInputsFile` (if defined here), and
  `buildSnapshotSequence`.
- `packages/game-engine/src/types.ts` — **modified** — re-export the new
  types alongside existing UI types.

### D) Engine tests

- `packages/game-engine/src/replay/buildSnapshotSequence.test.ts` —
  **new**, uses `node:test` + `makeMockCtx`:
  - Empty `inputs` produces a sequence of length 1 whose snapshot 0 has
    `phase === 'setup'` or `'play'` (whichever WP-005B produces
    post-setup; assert the actual value from the engine, not a guess).
  - A known multi-input sequence produces `inputs.length + 1` snapshots.
  - Two identical calls produce equal (deep-equal) sequences — proves
    determinism at the function level.
  - `JSON.stringify(sequence)` succeeds and roundtrips without loss.
  - The returned sequence is frozen (`Object.isFrozen` true for the
    outer object and for `snapshots`).
  - `buildUIState` is called exactly `inputs.length + 1` times per
    invocation (spy or instrumentation — keep the spy minimal).

### E) CLI app scaffold

- `apps/replay-producer/package.json` — **new**. Name
  `@legendary-arena/replay-producer`. Scripts: `build`, `test`,
  `produce-replay`. Mark `private: true`.
- `apps/replay-producer/tsconfig.json` — **new**. Strict. Extends repo
  root if one exists.
- `apps/replay-producer/README.md` — **new**. Short: purpose, usage
  example. Not marketing; engineering.

### F) CLI entry

- `apps/replay-producer/src/cli.ts` — **new**:
  - Uses `node:util`'s `parseArgs` (matching whatever `apps/server/`
    uses if that package has already standardized).
  - Flags: `--in <path>` (required), `--out <path>` (optional; stdout
    if absent), `--match-id <string>` (optional metadata),
    `--produced-at <iso>` (optional; overrides the auto-generated ISO
    timestamp for tests that demand byte stability).
  - Reads the input file, parses as `ReplayInputsFile`, validates
    `version === 1` (full-sentence error otherwise), invokes
    `buildSnapshotSequence`, serializes to JSON with sorted top-level
    keys, writes to the target.
  - Exits 0 on success; non-zero with the documented exit codes on
    failure.
  - `// why:` comment on `--produced-at` override: without it, two runs
    on different machines would embed different ISO timestamps into
    metadata, breaking byte-level determinism tests.

### G) CLI tests

- `apps/replay-producer/src/cli.test.ts` — **new**:
  - With a committed sample input and `--produced-at` set to a fixed
    value, the CLI produces a committed golden sequence byte-identically
    across two runs.
  - Missing `--in` exits non-zero with the documented message on stderr.
  - Invalid `version` in the input file exits with the documented code
    and message.
  - Unwritable output path exits with the documented code and message.

### H) Sample artifacts

- `apps/replay-producer/samples/three-turn-sample.inputs.json` — **new**.
  A `ReplayInputsFile` that produces the fixture WP-064 will commit.
- `apps/replay-producer/samples/three-turn-sample.sequence.json` —
  **new**. The committed golden output.
- `apps/replay-producer/samples/three-turn-sample.cmd.txt` — **new**.
  The exact CLI invocation used to produce the sequence, so WP-064 (or
  any future consumer) can regenerate it deterministically.

---

## Out of Scope

- No server endpoint or HTTP handler — CLI only.
- No persistence of artifacts to R2, PostgreSQL, or any cloud store.
- No change to WP-027's harness signature or behavior. If a change is
  required, stop and raise it as its own WP.
- No change to `UIState`, `buildUIState`, or the engine's move/phase
  logic.
- No client-side consumption — that is WP-064.
- No scheduled CI artifact production — future WP if desired.
- No replay editing, truncation, or merging — replays are immutable per
  Vision §24.
- No compression of the output artifact (gzip, brotli, etc.) — future
  packet if size becomes a concern.
- Refactors, cleanups, or "while I'm here" improvements.

---

## Files Expected to Change

- `packages/game-engine/src/replay/replaySnapshot.types.ts` — **new**
- `packages/game-engine/src/replay/buildSnapshotSequence.ts` — **new**
- `packages/game-engine/src/replay/buildSnapshotSequence.test.ts` —
  **new**
- `packages/game-engine/src/index.ts` — **modified** (add exports only)
- `packages/game-engine/src/types.ts` — **modified** (re-export new
  types)
- `apps/replay-producer/package.json` — **new**. Per P6-37, the file
  is new and MUST explicitly include (a) `"test": "node --import tsx
  --test \"src/**/*.test.ts\""` in `scripts`, (b) `"tsx": "^4.15.7"`
  (or the repo's current pinned version — verify against
  `apps/arena-client/package.json` or `apps/registry-viewer/package.json`)
  in `devDependencies`, (c) `"@types/node": "^22.x"` in
  `devDependencies`, (d) `"@legendary-arena/game-engine":
  "workspace:*"` in `dependencies`, (e) `build`, `test`, and
  `produce-replay` scripts, (f) `"type": "module"`, `"private": true`,
  and the `@legendary-arena/replay-producer` name. Test-infrastructure
  additions (test script + tsx + @types/node) are EXPLICIT allowlist
  entries, not implicit scope — this avoids the WP-068 P6-37 scope
  interpretation dispute mid-execution.
- `apps/replay-producer/tsconfig.json` — **new**
- `apps/replay-producer/README.md` — **new**
- `apps/replay-producer/src/cli.ts` — **new**
- `apps/replay-producer/src/cli.test.ts` — **new**
- `apps/replay-producer/samples/three-turn-sample.inputs.json` — **new**
- `apps/replay-producer/samples/three-turn-sample.sequence.json` —
  **new**
- `apps/replay-producer/samples/three-turn-sample.cmd.txt` — **new**
- Root `pnpm-workspace.yaml` — **modified** only if the new package is
  not already covered by an existing glob
- `docs/ai/STATUS.md` — **modified** (governance update per DoD)
- `docs/ai/DECISIONS.md` — **modified** (governance update per DoD —
  CLI location, sorted-key serialization, `--produced-at` override
  rationale, `version: 1` literal choice, `ReplayInputsFile` origin)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (governance update
  per DoD)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (flip EC-071
  from Draft to Done with today's date and the execution commit hash,
  matching the EC-067 / EC-069 format `Executed YYYY-MM-DD at commit
  <hash>`). Per P6-41, if this file is dirty with pre-existing residue
  at commit time, apply the path-scoped stash + re-apply + leave-stash
  pattern.

No other files may be modified. `apps/arena-client/**`,
`apps/registry-viewer/**`, `apps/server/**`, `packages/registry/**`,
`packages/preplan/**` must be untouched.

---

## Acceptance Criteria

### Engine Types & Helper
- [ ] `@legendary-arena/game-engine` exports `ReplaySnapshotSequence`.
- [ ] `@legendary-arena/game-engine` exports `buildSnapshotSequence`.
- [ ] `buildSnapshotSequence` is pure: no `console.*`, no `fs`, no
      `Date.now`, no `Math.random`, no `performance.now` (confirmed with
      `Select-String`).
- [ ] Returned sequence and its `snapshots` array are frozen.
- [ ] Empty `inputs` → sequence length 1.
- [ ] Non-empty `inputs` → sequence length `inputs.length + 1`.
- [ ] Two identical calls produce deep-equal sequences.
- [ ] `JSON.stringify(sequence)` roundtrips without loss.

### CLI
- [ ] `pnpm --filter @legendary-arena/replay-producer build` exits 0.
- [ ] `pnpm --filter @legendary-arena/replay-producer test` exits 0.
- [ ] With `--produced-at` fixed, running the CLI twice on the same
      input produces byte-identical output.
- [ ] Missing `--in` exits with documented non-zero code and stderr
      message.
- [ ] Invalid `version` field exits with documented code and message.
- [ ] Unwritable output path exits with documented code and message.

### Samples
- [ ] The committed `three-turn-sample.sequence.json` matches the output
      of running the CLI against the committed inputs with the
      documented command line.

### Layer Boundary
- [ ] No import of `@legendary-arena/registry` anywhere in this packet's
      files unless `Game.setup()` already required it (mirror
      `apps/server/` precedent).
- [ ] No import of `boardgame.io` from the engine helper (pure helper
      rule, matching `zoneOps.ts` precedent).
- [ ] No files modified outside `## Files Expected to Change`.

### Scope Enforcement
- [ ] `apps/arena-client/**`, `apps/registry-viewer/**`,
      `apps/server/**`, `packages/registry/**`, `packages/preplan/**`
      untouched (confirmed with `git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — engine build & test
pnpm --filter @legendary-arena/game-engine build
pnpm --filter @legendary-arena/game-engine test
# Expected: both exit 0

# Step 2 — CLI build & test
pnpm --filter @legendary-arena/replay-producer build
pnpm --filter @legendary-arena/replay-producer test
# Expected: both exit 0

# Step 3 — confirm engine helper purity
Select-String -Path "packages\game-engine\src\replay\buildSnapshotSequence.ts" -Pattern "console\.|Date\.now|Math\.random|performance\.now|from 'node:fs"
# Expected: no output

# Step 4 — confirm no boardgame.io import in engine helper
Select-String -Path "packages\game-engine\src\replay\buildSnapshotSequence.ts" -Pattern "boardgame.io"
# Expected: no output

# Step 5 — determinism: run CLI twice into %TEMP%, compare bytes with PowerShell
$run1 = Join-Path $env:TEMP "replay-run1.json"
$run2 = Join-Path $env:TEMP "replay-run2.json"
pnpm --filter @legendary-arena/replay-producer produce-replay --in apps\replay-producer\samples\three-turn-sample.inputs.json --out $run1 --produced-at 2026-04-16T00:00:00Z
pnpm --filter @legendary-arena/replay-producer produce-replay --in apps\replay-producer\samples\three-turn-sample.inputs.json --out $run2 --produced-at 2026-04-16T00:00:00Z
Compare-Object -ReferenceObject (Get-Content $run1) -DifferenceObject (Get-Content $run2)
# Expected: no output (byte-identical)

# Step 6 — confirm CLI sourcemaps are enabled (stack traces point at .ts)
Select-String -Path "apps\replay-producer\package.json" -Pattern "enable-source-maps|setSourceMapsEnabled"
# Expected: at least one match

# Step 7 — confirm other apps untouched
git diff --name-only apps/arena-client/ apps/registry-viewer/ apps/server/ packages/registry/ packages/preplan/
# Expected: no output

# Step 8 — confirm only expected files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

- [ ] Preflight items all resolved (WP-027 harness shape confirmed,
      engine export policy confirmed, `ReplayInputsFile` origin
      decided, CLI arg parser chosen, CLI sourcemap enablement in
      place, determinism-diff harness in place).
- [ ] All acceptance criteria above pass.
- [ ] CLI stack traces point at TypeScript source (sourcemaps enabled).
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] `pnpm --filter @legendary-arena/replay-producer build` exits 0.
- [ ] `pnpm --filter @legendary-arena/replay-producer test` exits 0.
- [ ] Engine helper is pure (no I/O, no wall clock, no RNG,
      no `boardgame.io`).
- [ ] CLI produces byte-identical output across runs with
      `--produced-at` fixed.
- [ ] Committed sample matches the CLI's produced output.
- [ ] `apps/arena-client/**`, `apps/registry-viewer/**`,
      `apps/server/**`, `packages/registry/**`, `packages/preplan/**`
      untouched.
- [ ] No files outside `## Files Expected to Change` were modified.
- [ ] `docs/ai/STATUS.md` updated — replay snapshot production is now a
      first-class capability; WP-064 can consume real artifacts.
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: location of the CLI
      (`apps/replay-producer/` vs alternative); the sorted-key
      serialization choice; the `--produced-at` override rationale; the
      `version: 1` literal choice.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-063 checked off with
      today's date and a link back to the session invocation.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` has EC-071 flipped from
      Draft to Done with today's date and the execution commit hash
      (format: `Executed YYYY-MM-DD at commit <hash>`).
- [ ] Commit uses the `EC-071:` prefix (NOT `WP-063:`; NOT `EC-063:`).
- [ ] **01.6 post-mortem complete (MANDATORY per P6-35)** — formal
      10-section output, in-session, BEFORE commit. Two triggering
      criteria apply: (a) new long-lived abstraction
      (`ReplaySnapshotSequence` is the input type for WP-064), (b)
      new code category (`apps/replay-producer/` as the first
      CLI Producer App).
- [ ] Pre-commit review runs in a **separate gatekeeper session** per
      P6-35; if the user explicitly requests in-session review via
      `AskUserQuestion`, the deviation MUST be disclosed in the
      `EC-071:` commit body per P6-42.
- [ ] `stash@{0}` retained (NOT popped during the WP-063 session) —
      belongs to the WP-068 / MOVE_LOG_FORMAT governance resolver.
- [ ] WP-062's EC_INDEX `<pending — gatekeeper session>` placeholder
      NOT backfilled in the WP-063 commit — separate `SPEC:` commit
      owns the backfill.
