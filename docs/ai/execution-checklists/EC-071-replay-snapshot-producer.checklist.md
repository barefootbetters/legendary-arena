# EC-071 — Replay Snapshot Producer (Execution Checklist)

**Source:** docs/ai/work-packets/WP-063-replay-snapshot-producer.md
**Layer:** Game Engine (`packages/game-engine/src/replay/`) + NEW CLI Producer App (`apps/replay-producer/`)

> **EC numbering note:** `EC-062`, `EC-063`, `EC-064` were never issued.
> `EC-065`–`EC-070` are historically bound. Following the EC-061 →
> EC-067, EC-066 → EC-068, and EC-062 → EC-069 retargeting precedent,
> WP-063 uses **EC-071** — the next free slot. Commits for WP-063 use
> the `EC-071:` prefix (never `WP-063:` — commit-msg hook rejects it
> per P6-36).

## Before Starting
- [ ] WP-005B complete (deterministic `Game.setup()` is sole throw site)
- [ ] WP-027 complete: replay harness exposes a **step-level API**
      (one input at a time with observable intermediate `G`+`ctx`). If
      only end-to-end replay exists, WP-063 is **BLOCKED** — stop and
      raise; do not patch WP-027 locked contract files
- [ ] WP-028 complete: `buildUIState(gameState, ctx)` + `UIState`
      exported from `@legendary-arena/game-engine`
- [ ] `ReplayInputsFile` origin decided: reuse WP-027 definition
      verbatim if one exists; otherwise define here and log in D-6301
      per P6-34
- [ ] Engine `index.ts`/`types.ts` barrel pattern inspected; new
      exports match it exactly
- [ ] CLI arg-parser precedent read in `apps/server/`; `node:util`
      `parseArgs` used unless server has already standardized
      elsewhere
- [ ] `tsx` pinned version confirmed against
      `apps/arena-client/package.json` and
      `apps/registry-viewer/package.json` (P6-37 explicit allowlist)
- [ ] Sourcemap enablement precedent confirmed (or established here):
      `NODE_OPTIONS=--enable-source-maps` in the `produce-replay`
      script, or `process.setSourceMapsEnabled(true)` at entry
- [ ] Repo baseline green: `pnpm -r test` exits 0, ≥464 tests, engine
      409/101
- [ ] Governance pre-session actions committed under `SPEC:` before
      READY is consumed (P6-34): EC-071 (this file), D-6301/D-6302/
      D-6303, 02-CODE-CATEGORIES.md update, EC_INDEX.md EC-071 row
- [ ] `stash@{0}` retained (WP-068/MOVE_LOG owner) — **MUST NOT** pop
- [ ] WP-062 EC-069 `<pending>` placeholder in EC_INDEX.md **MUST NOT**
      be backfilled in the WP-063 commit (cross-WP contamination)

## Locked Values (do not re-derive)
- EC/commit prefix: `EC-071:` on every code-changing commit;
  `SPEC:` on governance/doc-only commits; `WP-063:` is **forbidden**
- `ReplaySnapshotSequence` shape (verbatim from WP-063):
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
- `version` is the literal `1` (not `number`) — compile-time seam
- `snapshots[0]` is post-setup; `snapshots[i>0]` is after the i-th
  input is applied; `snapshots.length === inputs.length + 1`
- `ReplayInputsFile` shape (verbatim from WP-063) with
  `version: 1`, `setupConfig: MatchSetupConfig`, `seed: string`,
  `inputs: readonly ReplayInput[]`, optional
  `metadata: { matchId?: string; note?: string }`
- CLI name: `@legendary-arena/replay-producer`; scripts: `build`,
  `test`, `produce-replay`; `"private": true`; `"type": "module"`
- CLI flags: `--in <path>` (required), `--out <path>` (optional;
  stdout if absent), `--match-id <string>` (optional),
  `--produced-at <iso>` (optional; overrides auto-generated
  timestamp — REQUIRED for byte-identical determinism tests)
- Exit codes: `0` success, `1` invalid args, `2` input parse error,
  `3` engine error, `4` output write error — no other codes
- JSON serialization: **top-level keys sorted**; nested objects use
  engine-produced key order per D-6302 (no recursive sort; probe
  test asserts stability)
- Optional-field serialization: optional fields are **OMITTED** when
  absent. Never serialize as `"metadata": undefined` or
  `"par": null`. When `metadata` has no sub-fields set, the entire
  `metadata` key is omitted. Construction matrix test exercises:
  `metadata` absent, `metadata: {}`, each sub-field set singly
- Version-bump policy (D-6303): additive changes (new optional
  metadata fields, new optional top-level fields) remain at
  `version: 1`. Any change to `snapshots` element shape, removal/
  rename of a documented field, or change to sort semantics requires
  `version: 2`. Consumers MUST assert `version === 1` and refuse
  unknown versions with a full-sentence error
- Sourcemap flag location: `apps/replay-producer/package.json`
  `scripts.produce-replay` includes `NODE_OPTIONS=--enable-source-maps`
  OR the entry file calls `process.setSourceMapsEnabled(true)` on
  the first executable line

## Guardrails
- **Engine helper purity (non-negotiable):** no `console.*`, no
  `fs`/`node:fs*`, no `Date.now`, no `Math.random`, no
  `performance.now`, no `boardgame.io` import, no mutation of
  inputs, no side effects outside constructing the returned
  sequence. Verification Step 3 grep enforces.
- **CLI owns all I/O:** the only site that reads/writes files,
  touches stdout/stderr, or calls `Date.now` (bounded by
  `--produced-at` override). Helper is data-in/data-out.
- **Layer boundary:** `apps/replay-producer/` imports
  `@legendary-arena/game-engine` + Node built-ins only. MUST NOT
  import `@legendary-arena/registry` unless `Game.setup()`
  transitively requires it (mirror `apps/server/` precedent if
  forced). No `boardgame.io` import anywhere in this WP.
- **Freeze discipline:** `buildSnapshotSequence` returns an object
  whose outer shape AND `snapshots` array are `Object.freeze`-d
  before return. AC asserts `Object.isFrozen` true on both.
- **Call-count invariant:** `buildUIState` is invoked exactly
  `inputs.length + 1` times per call. Spy-based test enforces.
- **No `.reduce()` for the step loop** — use `for...of` appending
  to a local mutable array, then freeze on return.
- **Exit codes declared as named constants** in `cli.ts` with a
  single `// why:` block above the declarations naming each code's
  meaning. Full-sentence stderr messages cite the exit code in the
  message body (example: `"Missing required --in flag (exit code
  1)."`). No magic numbers in exit calls.
- **Sorted-key serialization:** top-level keys sorted via a small
  canonical serializer (not default `JSON.stringify`) or via a
  `replacer` that projects to an ordered object. A probe-object
  unit test constructs an object with deliberately-shuffled
  top-level keys and asserts stable serialization. Nested objects
  inherit engine-produced order per D-6302.
- **Optional-field test matrix:** unit tests cover `metadata`
  absent, `metadata: {}`, and each `metadata.*` sub-field set
  singly; each case asserts serialized output stability (no
  `"undefined"` literals in the JSON text).
- **Scope lock is binary:** any file touched outside
  `## Files Expected to Change` in WP-063 is a violation, not a
  deviation (P6-27).
- **Stash + governance-index cleanliness (P6-41):** if any of
  DECISIONS.md / DECISIONS_INDEX.md / WORK_INDEX.md / EC_INDEX.md
  carries pre-existing residue at commit time, apply the five-step
  stash + re-apply + leave-stash pattern. **Do not** `git stash
  pop`. Leave `stash@{0}` and `stash@{1}` retained.

## Required `// why:` Comments
- `replaySnapshot.types.ts` — on `version: 1` literal: future
  format revs must be detectable at compile time, not guessed from
  JSON shape; bump policy locked by D-6303
- `buildSnapshotSequence.ts` — above the step loop: snapshots
  include index 0 (post-setup) so consumers render the opening
  state without re-running the engine client-side
- `buildSnapshotSequence.ts` — on `Object.freeze` calls: aliasing
  defense; returned object and `snapshots` array must be
  deep-readonly at runtime
- `cli.ts` — on `--produced-at` override flag: without it, two
  runs on different machines embed different ISO timestamps in
  metadata, breaking byte-level determinism tests (AC + Step 5)
- `cli.ts` — single block above exit-code constants naming each
  code's meaning (0 success / 1 args / 2 parse / 3 engine / 4 write)
- `cli.ts` — on the sorted-key serializer: top-level sort only per
  D-6302; engine-produced nested order is deterministic by engine
  purity

## Files to Produce
- `packages/game-engine/src/replay/replaySnapshot.types.ts` — **new**
- `packages/game-engine/src/replay/buildSnapshotSequence.ts` — **new**
- `packages/game-engine/src/replay/buildSnapshotSequence.test.ts` —
  **new** (frozen check, length invariants, deterministic equality,
  JSON roundtrip, call-count spy, optional-field matrix, sorted-key
  probe)
- `packages/game-engine/src/index.ts` — **modified** (exports only)
- `packages/game-engine/src/types.ts` — **modified** (re-exports only)
- `apps/replay-producer/package.json` — **new**: name
  `@legendary-arena/replay-producer`; `"type": "module"`;
  `"private": true`; `dependencies.@legendary-arena/game-engine:
  "workspace:*"`; `devDependencies.tsx: "^<pinned>"`;
  `devDependencies.@types/node: "^22.x"`; `scripts.build`,
  `scripts.test: "node --import tsx --test \"src/**/*.test.ts\""`,
  `scripts.produce-replay` with
  `NODE_OPTIONS=--enable-source-maps`
- `apps/replay-producer/tsconfig.json` — **new**
- `apps/replay-producer/README.md` — **new**
- `apps/replay-producer/src/cli.ts` — **new**
- `apps/replay-producer/src/cli.test.ts` — **new** (determinism
  diff, missing `--in`, invalid `version`, unwritable `--out`)
- `apps/replay-producer/samples/three-turn-sample.inputs.json` —
  **new**
- `apps/replay-producer/samples/three-turn-sample.sequence.json` —
  **new** (golden output)
- `apps/replay-producer/samples/three-turn-sample.cmd.txt` — **new**
  (exact invocation for reproducibility)
- `pnpm-workspace.yaml` — **modified** only if new package not
  covered by existing glob
- `docs/ai/STATUS.md` — **modified**
- `docs/ai/DECISIONS.md` — **modified** (any execution-surfaced
  decisions beyond D-6301/D-6302/D-6303)
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** (WP-063 check)
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** (flip
  EC-071 Draft → Done with commit hash; P6-41 if dirty)

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/replay-producer build` exits 0
- [ ] `pnpm --filter @legendary-arena/replay-producer test` exits 0
- [ ] `pnpm -r test` exits 0 with ≥464 + new engine + new CLI counts
- [ ] `Select-String -Path
      packages\game-engine\src\replay\buildSnapshotSequence.ts
      -Pattern "console\.|Date\.now|Math\.random|performance\.now|from 'node:fs"`
      returns no output
- [ ] `Select-String -Path
      packages\game-engine\src\replay\buildSnapshotSequence.ts
      -Pattern "from ['\"]boardgame\.io"` returns no output
- [ ] Determinism: two `produce-replay` runs with same
      `--produced-at` produce byte-identical files (Verification
      Step 5)
- [ ] Committed `three-turn-sample.sequence.json` matches output
      of the documented CLI invocation against the committed
      inputs
- [ ] `git diff --name-only apps/arena-client/ apps/registry-viewer/
      apps/server/ packages/registry/ packages/preplan/` returns no
      output
- [ ] `git diff --name-only` shows only files listed above
- [ ] Governance files updated: `STATUS.md`, `DECISIONS.md`,
      `WORK_INDEX.md`, `EC_INDEX.md` (EC-071 Draft → Done with
      commit hash in `Executed YYYY-MM-DD at commit <hash>` format)
- [ ] **01.6 post-mortem MANDATORY before commit (P6-35)** — two
      triggering criteria: new long-lived abstraction
      (`ReplaySnapshotSequence` is WP-064's input type) + new code
      category (`apps/replay-producer/` as first CLI Producer App
      per D-6301). Formal 10-section output, not informal summary.
- [ ] Pre-commit review in **separate gatekeeper session** per
      P6-35; same-session deviation requires `AskUserQuestion`
      opt-in + commit-body disclosure per P6-42
- [ ] `stash@{0}` NOT popped; EC-069 `<pending>` placeholder NOT
      backfilled in the WP-063 commit

## Common Failure Smells
- `"metadata": undefined` or `"par": null` appears in the JSON
  output → optional-field serialization rule violated; replace
  `undefined` fields with key omission at the serializer layer
- Determinism test fails with byte offset in nested object → you
  relied on default `JSON.stringify` key order for a nested object
  whose key order is non-deterministic across Node versions; the
  contract is engine-purity + top-level sort (D-6302), so the
  non-determinism came from outside the engine — investigate the
  CLI layer, not the helper
- `commit-msg` hook rejects with "prefix must be one of EC-### /
  SPEC: / INFRA:" → commit used `WP-063:` prefix (P6-36). Rewrite
  with `EC-071:` for code or `SPEC:` for docs-only
- `[Replay] build error: Cannot find module 'tsx'` at CLI test
  time → P6-37 violation; `tsx` was added as `dependency` instead
  of `devDependencies`, or omitted entirely; restore per Files
  to Produce
- `Object.isFrozen(sequence.snapshots)` returns `false` → helper
  froze the outer object but not the array; freeze both
- `buildUIState` call-count spy fails with count `inputs.length` →
  helper skipped the post-setup snapshot at index 0; fix by
  calling `buildUIState` BEFORE entering the step loop
- Stack trace in a CLI failure points at `.js` not `.ts` →
  sourcemaps were not enabled; add `NODE_OPTIONS=--enable-source-maps`
  to the `produce-replay` script or call
  `process.setSourceMapsEnabled(true)` at the entry
- CI passes locally, fails on another machine with "byte 47
  differs" in the same run-twice test → you used auto-generated
  `Date.now()` in metadata without `--produced-at` override, or
  the test forgot to pass the override; the deterministic path is
  `--produced-at`, not `Date.now()`
