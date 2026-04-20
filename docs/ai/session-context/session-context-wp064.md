# Session Context — WP-064 Game Log & Replay Inspector

> **Generated:** 2026-04-19 after WP-063 / EC-071 landed on
> `wp-063-replay-snapshot-producer` (Commit A `97560b1`, Commit B
> `b1ad8e5`). This file is the bridge step-0 input for the WP-064
> executing session. Load it first, then load the WP-064 session
> prompt and its execution checklist.

---

## Upstream State at Session Start

- **Branch to cut from:** `main` once `wp-063-replay-snapshot-producer`
  lands, OR directly from `wp-063-replay-snapshot-producer` head
  (commit `b1ad8e5`) if the WP-064 session precedes the merge.
  Pre-flight MUST confirm which. Option B (cut from the upstream WP
  branch) is the established precedent when the prerequisite WP's
  merge is still pending — WP-063 cut from `wp-080` under this
  pattern; WP-080 cut from `wp-079` under this pattern.
- **Repo test baseline:** **486 tests passing** (3 registry + 427
  game-engine + 11 vue-sfc-loader + 6 server + 35 arena-client + 4
  replay-producer). 0 failures. WP-064 must not regress any of these
  counts and will add arena-client tests for the four new components
  + the `loadReplay` helper.
- **Engine baseline:** **427 tests / 108 suites** (was 412 / 102
  pre-WP-063; WP-063 added 15 tests across 6 new suites in
  `buildSnapshotSequence.test.ts`). WP-064 is a client-only WP and
  must not modify any engine file.
- **arena-client baseline:** **35 tests / 0 suites** (was 35 at
  WP-067 close; unchanged through WP-063). WP-064 will add tests
  for `loadReplay`, `GameLogPanel`, `ReplayInspector`, and
  `ReplayFileLoader`.
- **replay-producer baseline:** **4 tests / 2 suites** (new in
  WP-063; the fifth per-app count).
- **WP-064's upstream dependencies are ALL COMPLETE:**
  - WP-027 (determinism & replay harness) — completed 2026-04-14 ✅
  - WP-028 (UIState contract) — completed 2026-04-14 ✅
  - WP-061 (gameplay client bootstrap) — completed 2026-04-17 ✅
  - WP-062 (Arena HUD) — completed 2026-04-18 ✅ (optional; slots
    the inspector next to the HUD cleanly)
  - WP-063 (replay snapshot producer) — completed 2026-04-19 at
    commit `97560b1` ✅
  - WP-080 (step-level API) — completed 2026-04-19 at commit
    `dd0e2fd` ✅ (contextual only; WP-064 never calls engine
    runtime — `import type` only)
- **WP-064 is unblocked.** Every contract and framework
  prerequisite exists in shipped form.

---

## What WP-063 Shipped (WP-064's Direct Inputs)

Engine barrel exports now reachable from
`@legendary-arena/game-engine` (type-only imports for WP-064):

- `type ReplaySnapshotSequence` — `{ version: 1; snapshots:
  readonly UIState[]; metadata?: { matchId?; seed?; producedAt? } }`.
  `version` is the literal `1`. **WP-064's DoD carries the
  consumer-side `version === 1` assertion** (D-6303).
- `type ReplayInputsFile` — the on-disk shape the WP-063 CLI
  parses. WP-064 does not directly consume this type (the
  inspector consumes sequences, not inputs), but the file loader
  may encounter it in error-message contexts.
- `type BuildSnapshotSequenceParams` — the 6-field helper input
  shape. WP-064 does not call the helper; listed for awareness
  only.
- `buildSnapshotSequence(params)` — runtime export. **WP-064 must
  NOT import this** per the Layer Boundary (`apps/arena-client/`
  is `client-app` category, type-only imports from engine).

Fixture artifact WP-063 committed:

- `apps/replay-producer/samples/three-turn-sample.inputs.json` —
  ReplayInputsFile producing 4 snapshots (1 post-setup + 3
  per-move). Uses `setPlayerReady` / `startMatchIfReady` moves
  and an empty-list registry reader. See §Fixture Generation Note
  below — this golden is **not directly reusable** by WP-064's
  fixture requirements.
- `apps/replay-producer/samples/three-turn-sample.sequence.json` —
  the golden JSON output (2,952 bytes).
- `apps/replay-producer/samples/three-turn-sample.cmd.txt` — the
  exact CLI invocation for reproducibility.

Post-mortem artifact landed:

- `docs/ai/post-mortems/01.6-WP-063-replay-snapshot-producer.md` —
  formal 10-section output; verdict WP COMPLETE; new decision
  D-6305 documented (reconciled `ReplayInputsFile.moves`
  field-naming with WP-027 canonical `ReplayMove`; helper needs
  explicit `playerOrder` + `registry` parameters beyond the WP's
  literal 3-field signature).

Governance artifacts landed in Commit B (`b1ad8e5`):

- `docs/ai/STATUS.md` — §Current State prepend for WP-063.
- `docs/ai/work-packets/WORK_INDEX.md` — WP-063 flipped to `[x]`
  with commit link.
- `docs/ai/execution-checklists/EC_INDEX.md` — EC-071 flipped
  Draft → Done; "Last updated" footer refreshed.
- `docs/ai/DECISIONS.md` — D-6305 added between D-6304 and the
  MOVE_LOG_FORMAT block.
- `docs/ai/DECISIONS_INDEX.md` — D-6305 row added under the
  WP-063 block.

---

## Fixture Generation Note (Important)

WP-064's §Files Expected to Change requires
`apps/arena-client/src/fixtures/replay/three-turn-sample.json` to
be "between 6 and 12 snapshots … with at least one phase
transition and one log-growth step" **produced by the WP-063 CLI,
not hand-authored**. The committed WP-063 golden
(`three-turn-sample.sequence.json` = 4 snapshots built from
`setPlayerReady` × 2 + `startMatchIfReady` against the empty-list
registry) does NOT meet this bar:

- 4 snapshots < 6–12 requirement
- `setPlayerReady` mutates `G.lobby.ready` which is NOT projected
  into `UIState` — snapshots 0–2 are visually identical apart from
  `activePlayerId`
- `startMatchIfReady` calls `ctx.events.setPhase('setup')`, but
  `applyReplayStep`'s `events.setPhase` is a no-op (per
  `replay.execute.ts:127`) — phase does not advance in the
  determinism-only harness
- No log growth: no moves push to `G.messages`

**WP-064 will need to author a new `<name>.inputs.json` input file
and re-run the CLI** to produce a new fixture that satisfies its
6–12 snapshot + phase transition + log growth requirements. The
empty-list registry pattern from `replay.execute.test.ts` is the
minimal path, but WP-064 will need moves that provably mutate
UIState-visible fields across turns. Options the WP-064 executing
session should evaluate during pre-flight:

- **Unknown-move path:** WP-080's `applyReplayStep` pushes a
  `"Replay warning: unknown move name \"X\" — skipped."` string to
  `gameState.messages` for unknown moves (test:
  `replay.execute.test.ts:106`). A sequence of unknown-move
  records grows `UIState.log` deterministically without needing
  real card data. Caveat: all-unknown moves do not exercise phase
  transitions.
- **Mixed path:** one real move per turn (e.g., `endTurn`)
  combined with unknown-move warnings to populate `log`.
  `endTurn` has stage gating and its `ctx.events.endTurn()` is a
  no-op in replay context — the move itself may not advance turn
  counter but will still produce a determinism-stable output.
- **Real-card fixture:** use ext_ids the `listCards` mock returns.
  Requires more fixture authoring but produces the most realistic
  UIState progressions. The WP-063 post-mortem §Notes /
  Follow-ups flagged this as unaddressed by WP-063.

WP-064's pre-flight should pick ONE of these before inspector
tests are written, and log the choice in DECISIONS.md as a
WP-064-specific decision (e.g., D-64NN).

---

## Dirty-Tree Advisory (Inherited, DO NOT CLEAN)

At the close of WP-063, the tree carries these unresolved states.
WP-064 WILL inherit them. Every one of them is OUT OF SCOPE for
WP-064 and must be left untouched.

### 1. Retained `stash@{0}` — WP-068 / MOVE_LOG_FORMAT governance

```text
stash@{0}: On wp-062-arena-hud: pre-existing WP-068 +
MOVE_LOG_FORMAT governance edits (quarantined during WP-062
commit)
```

Contents: `docs/ai/DECISIONS.md` (D-1414, D-0203/D-0204/D-0205),
`docs/ai/DECISIONS_INDEX.md` (index entries), `WORK_INDEX.md`
(WP-068 narrative), `EC_INDEX.md` (EC-070 row). Owned by the
WP-068 / MOVE_LOG_FORMAT governance resolver. **WP-064 MUST NOT
`git stash pop` this stash.**

### 2. Retained `stash@{1}` — WP-068 pre-wp-062 branch cut

```text
stash@{1}: On wp-068-preferences-foundation: dirty tree before
wp-062 branch cut (pre-existing in-flight work + WP-068
lessons-learned 01.4 additions)
```

Same owner. **WP-064 MUST NOT pop.**

### 3. `EC_INDEX.md` still carries the WP-062 `<pending>` placeholder

EC-069's row in `EC_INDEX.md` reads
`Executed 2026-04-18 at commit \`<pending — gatekeeper session>\`.`
The correct hash is `7eab3dc`. Neither WP-079, WP-080, nor WP-063
backfilled it (all three explicitly deferred to avoid cross-WP
contamination per P6-38 / the inherited §Pre-Session Gate #6
discipline). **WP-064 MUST NOT backfill this placeholder** —
still owned by a separate `SPEC:` commit or the eventual WP-068
stash-pop resolution commit.

### 4. `docs/ai/post-mortems/01.6-applyReplayStep.md` still untracked

The WP-080 post-mortem artifact produced by the WP-080 gatekeeper
session remains untracked. Owned by a separate `SPEC:` commit
(not a WP-064 concern). **WP-064 MUST NOT stage this file.**

### 5. Modified + untracked files in `docs/ai/` from upstream WPs

From `git status --short` at WP-063 close:

- `M docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`
- `?? docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`
- `?? docs/ai/invocations/forensics-move-log-format.md`
- `?? docs/ai/invocations/session-wp048-par-scenario-scoring.md`
- `?? docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
- `?? docs/ai/invocations/session-wp068-preferences-foundation.md`
- `?? docs/ai/session-context/session-context-forensics-move-log-format.md`
- `?? docs/ai/session-context/session-context-wp067.md`

**None of these are WP-064's scope.** Stage by name only; NEVER
use `git add .` or `git add -A` (P6-27 / P6-44 discipline;
Inherited Tree State rule from the WP-063 precedent).

---

## WP-064 Scope Summary (from WORK_INDEX.md + WP body)

**Title:** Game Log & Replay Inspector
**Status:** Reviewed (2026-04-16 lint-gate pass); execution
unblocked 2026-04-19 after WP-063 landed
**Primary Layer:** Client UI (Vue 3 SPA — `apps/arena-client/`)
**Dependencies:** WP-061, WP-063, WP-028, WP-027 (all complete)
**Consumed by:** No WPs yet directly; future spectator surface
(unscoped WP) will extend or wrap the inspector.

**Three-part structure:**

1. **Game log panel:**
   - `<GameLogPanel />` renders `UIState.log: readonly string[]`
     as a scrollable virtualized list with stable line keys and
     `aria-live="polite"`.

2. **Replay inspector components:**
   - `<ReplayInspector />` consumes a `ReplaySnapshotSequence`
     and drives `useUiStateStore().setSnapshot` on index changes.
     Keyboard controls: `←` / `→` step, `Home` / `End` jump.
   - `<ReplayFileLoader />` — file-input component that parses a
     JSON `ReplaySnapshotSequence` via `File.text()` + JSON.parse +
     version-1 assertion; emits `loaded` event.
   - `loadReplay.ts` helper — the parse + validate entry point,
     carrying the **D-6303 consumer-side `version === 1`
     assertion** as a full-sentence error on any other value.

3. **Committed fixture:**
   - `apps/arena-client/src/fixtures/replay/three-turn-sample.json`
     — 6–12 snapshots with phase transition + log growth. **Must
     be produced by the WP-063 CLI**, not hand-authored. See
     §Fixture Generation Note above for the path choices.

**Untouched:**
- Any engine file (`packages/game-engine/**`)
- `apps/server/`, `apps/registry-viewer/`, `apps/replay-producer/`
- `packages/registry/`, `packages/vue-sfc-loader/`,
  `packages/preplan/` (does not exist)
- `UIState` shape, `buildUIState`, replay harness surfaces

---

## Key Differences vs. WP-063 (don't over-generalize)

WP-063 was an engine-helper + CLI producer app WP. WP-064 is a
**client-UI** WP consuming what WP-063 produced. The D-6301
`cli-producer-app` category rules DO NOT APPLY to WP-064 — it
lives under `apps/arena-client/` which is the `client-app`
category (type-only engine imports).

- **P6-43 (JSDoc + grep collision)** — APPLIES if WP-064's EC
  includes any grep-based verification step. The WP-064
  post-mortem should use paraphrase form in any JSDoc describing
  "no X, no Y" constraints.
- **P6-44 (`pnpm-lock.yaml` implicit allowlist)** — APPLIES IF
  WP-064 adds any new devDep to `apps/arena-client/package.json`.
  If no new deps, `pnpm-lock.yaml` should NOT appear in the
  diff; if it does, investigate before staging.
- **P6-45 (execution-surfaced D-entry)** — APPLIES if the WP's
  literal wording conflicts with a WP-063 / WP-027 upstream
  canonical type. For example, if the WP-064 spec uses
  "snapshots" or "sequence" in a way that conflicts with the
  `ReplaySnapshotSequence` field names, reconcile via a D-entry
  + post-mortem audit rather than escalating to a pre-flight
  amendment (unless the conflict materially changes AC).
- **D-6301 `cli-producer-app` rules** — DO NOT APPLY to WP-064.
  WP-064 is `client-app`: type-only engine imports, no file I/O
  outside `File.text()` / `URL.createObjectURL`, no `Date.now()`
  (the replay file already carries `metadata.producedAt`).
- **D-6303 version bump policy** — DIRECTLY APPLIES. WP-064
  carries the consumer-side `version === 1` assertion per its
  DoD. Any other version must fail with a full-sentence error.
- **D-6302 sorted top-level JSON keys** — NOT directly
  applicable at render time (WP-064 consumes an already-parsed
  object), but the `loadReplay.ts` helper should NOT re-serialize
  or re-sort the loaded JSON.
- **D-6305 field-naming reconciliation** — IRRELEVANT to the
  inspector path (inspector consumes `ReplaySnapshotSequence`,
  not `ReplayInputsFile`). If WP-064's `ReplayFileLoader`
  diagnostic messages reference the inputs shape, use
  `ReplayInputsFile.moves` (not `.inputs`) to match the
  canonical type.

What **does** apply from WP-063 and upstream:

- **P6-30 / P6-40** (`defineComponent({ setup() {...} })` form
  under vue-sfc-loader) — APPLIES for any non-leaf SFC (any
  component whose `<template>` registers child components OR
  references bindings beyond `defineProps` / `defineEmits`).
  `<ReplayInspector />` registers `<GameLogPanel />` + likely a
  range input + buttons. `<ReplayFileLoader />` is probably
  leaf-enough for `<script setup>`. Pre-flight verifies.
- **P6-33** (required-field promotion on a public projection
  type) — NOT applicable; WP-064 does not promote any field.
- **P6-34** (pre-flight governance commits) — APPLIES.
  WP-064's EC-074 draft and any new D-entry must land under a
  `SPEC:` prefix before READY.
- **P6-35** (01.6 mandatory before commit) — APPLIES. WP-064
  adds a new long-lived client-UI abstraction (`<ReplayInspector />`
  becomes the first replay-consumption surface; `loadReplay.ts`
  is the first consumer-side `version === 1` assertion site).
  Both P6-35 triggers fire. 01.6 is MANDATORY.
- **P6-36** (commit-prefix literal) — APPLIES.
  `.githooks/commit-msg` rejects `WP-###:`. Valid prefixes are
  only `EC-###:` / `SPEC:` / `INFRA:`. WP-064 uses `EC-074:`
  for code commits.
- **P6-37** (test-infra explicit allowlist) — APPLIES IF WP-064
  adds any new devDep. `apps/arena-client/package.json` already
  has `tsx`, `jsdom`, `@vue/test-utils`, etc. If WP-064 stays
  within existing deps (likely), P6-37 is informational. If
  WP-064 adds (e.g., a virtualization library), §Files Expected
  to Change must explicitly list `apps/arena-client/package.json`
  with the new dep and a DECISIONS.md justification.
- **P6-38** (governance index cleanliness) — APPLIES. The
  WP-062 EC-069 `<pending>` placeholder and the WP-068 stash
  residue remain. Document expected governance stash-reapply in
  the WP-064 session prompt's §Expected Governance Updates.
- **P6-41** (path-scoped stash + reapply + leave-stash pattern)
  — LIKELY APPLIES during WP-064's DoD-driven updates to
  `WORK_INDEX.md` / `EC_INDEX.md` / possibly `DECISIONS.md` (if
  fixture-generation-path D-entry is added).
- **P6-42** (same-session pre-commit review requires disclosure)
  — APPLIES. Default is separate-session gatekeeper per P6-35.
  If the user explicitly requests in-session review, disclose in
  the `EC-074:` commit body.
- **P6-43** (JSDoc + grep collision) — see above.
- **P6-44** (`pnpm-lock.yaml` implicit allowlist) — see above.
- **P6-45** (execution-surfaced D-entry pattern) — see above.

---

## EC Slot Selection

Available 060-series ECs at session start (all bound unless
marked):

| EC  | Status | Owner |
|---|---|---|
| EC-061 | Done | WP-061 original (Glossary panel) |
| EC-062 / EC-063 / EC-064 | — | unused |
| EC-065 | Done | WP-065 vue-sfc-loader |
| EC-066 | Done/Draft | WP-066 registry-viewer data toggle |
| EC-067 | Done | WP-061 gameplay client bootstrap |
| EC-068 | Done | WP-067 UIState PAR projection |
| EC-069 | Done | WP-062 Arena HUD (hash `<pending>` still) |
| EC-070 | Done | WP-068 preferences foundation |
| EC-071 | Done | WP-063 replay snapshot producer (commit `97560b1`) |
| EC-072 | Done | WP-080 replay harness step-level API |
| EC-073 | Done | WP-079 replay determinism-only labeling |

**Recommended slot for WP-064: `EC-074`** (first truly free
slot following the EC-061 → EC-067 / EC-066 → EC-068 /
EC-062 → EC-069 / EC-063 → EC-071 / EC-080 → EC-072 / EC-079
→ EC-073 retargeting precedent).

Pre-flight MUST triple-cross-reference (WP-064 header + EC-074
header + session-prompt line) per the P6-30 / P6-34 pattern.
Commit prefix for WP-064 code: **`EC-074:`**. Never `WP-064:`
(hook rejects per P6-36).

---

## Pre-Flight Gates WP-064 Must Clear

1. **Dependency status** — all five (WP-027, WP-028, WP-061,
   WP-063, and informationally WP-080) confirmed complete via
   `WORK_INDEX.md` `[x]` marks + commit hashes (`97560b1` for
   WP-063, `dd0e2fd` for WP-080, `2e68530` for WP-061, earlier
   for WP-027 / WP-028).
2. **Engine baseline green at session base commit** —
   `pnpm -r test` shows **486 passing / 0 failing**, engine
   **427 / 108**, replay-producer **4 / 2**, arena-client **35 /
   0**.
3. **Governance-file cleanliness for WP-064's own artifacts** —
   WP-064 WP body (already on disk), EC-074 draft checklist (to
   be authored), any WP-064-specific copilot-check MD, must be
   committed under `SPEC:` before READY per P6-34.
4. **ReplaySnapshotSequence type reachability** —
   `import type { ReplaySnapshotSequence } from '@legendary-arena/game-engine'`
   resolves in `apps/arena-client/`. Confirm via file read of
   `packages/game-engine/src/index.ts` (search for the
   `// Replay snapshot sequence (WP-063)` block at line 215;
   barrel is currently committed on the
   `wp-063-replay-snapshot-producer` branch but NOT yet on
   `main`). If cutting from main post-merge, confirm the barrel
   line is present; if cutting from `wp-063-*` head, the line
   is guaranteed present at `b1ad8e5`.
5. **Cross-WP governance index cleanliness** — `WORK_INDEX.md`,
   `EC_INDEX.md`, `DECISIONS.md`, `DECISIONS_INDEX.md` will
   still carry the WP-068 / MOVE_LOG_FORMAT residue AND the
   WP-062 EC_INDEX `<pending>` placeholder. Document the
   expected governance-update handoff in the session prompt's
   §Expected Governance Updates section.
6. **Code-category classification** — `apps/arena-client/`
   is already the `client-app` category (D-6101 / D-6301
   opposite; no new classification needed). **No new
   cli-producer-app code permitted in WP-064** — if the WP-064
   executing session is ever tempted to add file-system writes
   or timestamp-embedding, STOP and re-read D-6301.

---

## Things WP-064 Must Not Do

- **Import `@legendary-arena/game-engine` at runtime.**
  `import type` only. The inspector consumes pre-produced
  snapshots; it never regenerates state.
- **Import `@legendary-arena/registry` or `boardgame.io`
  anywhere** in `apps/arena-client/`.
- **Hand-author the fixture.** Regenerate via the WP-063 CLI
  using an inputs file crafted for WP-064's 6–12 snapshot +
  phase-transition + log-growth requirements. Commit the
  `<name>.cmd.txt` sibling for reproducibility per the WP-063
  pattern.
- **Redefine `ReplaySnapshotSequence` locally.** Import the
  type from `@legendary-arena/game-engine`.
- **Reconstruct `UIState` from moves client-side.** The
  inspector drives `useUiStateStore().setSnapshot(sequence.snapshots[index])`
  and lets the HUD re-render. No engine calls.
- **Touch `packages/**/` or other `apps/**/` packages.** Every
  engine, registry, vue-sfc-loader, server, replay-producer,
  and registry-viewer file is out of scope.
- **Pop `stash@{0}` or `stash@{1}`.** Leave for the WP-068 /
  MOVE_LOG owner.
- **Backfill the EC-069 `<pending>` placeholder.** Separate
  `SPEC:` commit owns it.
- **Stage `docs/ai/post-mortems/01.6-applyReplayStep.md`.** WP-080
  artifact; not WP-064's concern.
- **Use `git add -A` or `git add .` for staging.** Stage by
  name (P6-27, reinforced by P6-44).

---

## Likely New Decisions WP-064 Will Produce

Speculative — pre-flight should confirm:

- **D-64NN — Fixture generation path for
  `three-turn-sample.json`.** Pick ONE of the three options
  above (unknown-move / mixed / real-card). Lock the choice,
  document the rationale (e.g., "unknown-move for minimum
  registry footprint; trades realism for minimal setup") and
  the generator command line.
- **D-64NN — Keyboard focus / root tabindex pattern.** If
  WP-061 or WP-062 did not establish one, WP-064 establishes
  the `tabindex="0"` root + listener-on-root pattern and logs
  it. See WP-064's §Preflight line 139–142.
- **D-64NN — Consumer-side `version === 1` error message
  wording.** The full-sentence error text the `loadReplay`
  helper throws. Lock here so future `version: 2` bump
  (D-6303) knows the exact message text to replace.
- **D-64NN (conditional) — `defineComponent` vs `<script setup>`
  form per component.** Per P6-30 / P6-40, non-leaf SFCs must
  use `defineComponent({ setup() {...} })`. WP-064 should list
  which of its four SFCs are leaf and which are non-leaf.

---

## Established Patterns From WP-063 Worth Quoting

From Commit A `97560b1`, Commit B `b1ad8e5`, and the 01.4
Precedent Log P6-43 / P6-44 / P6-45 (added post-execution):

- **Two-commit split discipline.** Code (`EC-###:`) then
  governance (`SPEC:`). WP-064 should follow the same pattern
  that WP-063 and WP-080 both ran cleanly.
- **Capture commit-A hash immediately after it lands.**
  Substitute verbatim into `STATUS.md`, `WORK_INDEX.md`, and
  `EC_INDEX.md` (including the footer "Last updated" line)
  before Commit B stages.
- **Separate-session gatekeeper for pre-commit review.** The
  WP-063 gatekeeper session returned a specific staging-by-name
  punch list rather than a veto; the execution session resumed
  and landed both commits without `--amend`. Plan for the same
  structure.
- **Post-mortem D-entry pattern.** D-6305 was surfaced during
  WP-063 execution (WP-literal signature vs upstream canonical
  type mismatch). The D-entry lives in the post-mortem §10
  Fixes list AND as a real section in `DECISIONS.md` + index
  row in `DECISIONS_INDEX.md`. WP-064 should use the same
  pattern for any execution-surfaced decisions (e.g., fixture
  path, full-sentence error wording).
- **Commit message body shape.** (1) one-line present-tense
  summary after the prefix, (2) paragraph on what changed,
  (3) paragraph on contract / decisions, (4) paragraph on
  verification counts + regression anchor, (5) paragraph on
  downstream unblock, (6) standard `Co-Authored-By` trailer.
- **Stage by name, never `-A`.** Every upstream WP since WP-062
  has reinforced this. WP-063 added P6-44 to the Precedent Log
  confirming `pnpm-lock.yaml` is an implicit allowlist entry
  when a new workspace package is added — which WP-064 is NOT
  doing, so `pnpm-lock.yaml` should NOT appear in the WP-064
  diff. If it does, investigate.
- **Content-based greps, not line-number references.**
  WP-080's invocation locked this pattern; WP-063 reinforced.
  WP-064's EC should use greps like `^export function
  loadReplay\(`, `const ReplayInspector`, `import type \{ ReplaySnapshotSequence`,
  not "at approx line N" references.

---

## Bootstrap Checklist for the WP-064 Executing Session

1. Load this file (`session-context-wp064.md`).
2. `git branch --show-current` — confirm branch. Cut
   `wp-064-log-replay-inspector` from the appropriate base
   (either `main` once WP-063 merges, or from
   `wp-063-replay-snapshot-producer` head at `b1ad8e5`).
3. `git status --short` — confirm the dirty-tree state matches
   §Dirty-Tree Advisory above; confirm `stash@{0}` +
   `stash@{1}` retained; do NOT touch.
4. `pnpm -r test` — confirm **486 passing / 0 failing**, engine
   **427 / 108**, replay-producer **4 / 2**, arena-client **35**.
5. Read:
   - `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)`
     — client vs engine split
   - `docs/ai/work-packets/WP-064-log-replay-inspector.md`
     (scope lock)
   - `docs/ai/REFERENCE/02-CODE-CATEGORIES.md §client-app`
     — the category rules WP-064 lives in
   - `docs/ai/post-mortems/01.6-WP-063-replay-snapshot-producer.md`
     §5 (aliasing audit) — the pattern the WP-064 post-mortem
     will follow
   - `packages/game-engine/src/index.ts` (confirm
     `ReplaySnapshotSequence` export at the WP-063 block) +
     `packages/game-engine/src/replay/replaySnapshot.types.ts`
     (confirm the type shape)
   - `apps/replay-producer/samples/three-turn-sample.{inputs,sequence,cmd}`
     (understand the producer input/output/command format)
   - `apps/arena-client/src/stores/uiState.ts` (the
     `setSnapshot` action the inspector will drive)
   - `apps/arena-client/src/components/hud/` (WP-062 HUD
     components — established pattern for `defineComponent`
     vs `<script setup>` split)
6. **Pick the fixture generation path** (see §Fixture
   Generation Note). Author the inputs file, run the WP-063
   CLI, validate it meets 6–12 snapshot + phase-transition +
   log-growth requirements. Commit path is
   `apps/arena-client/src/fixtures/replay/three-turn-sample.{json,cmd.txt}`.
7. Draft
   `docs/ai/execution-checklists/EC-074-log-replay-inspector.checklist.md`
   per the `EC-TEMPLATE.md` structure (seven sections minimum
   per P6-36).
8. Run pre-flight per `01.4` — include the §Pre-Flight Gates
   list above; explicitly enumerate the retained stashes,
   EC-069 placeholder, and untracked WP-080 post-mortem as
   non-blocking handoffs.
9. Run the copilot check per `01.7` on the draft session
   prompt.
10. Author the session prompt at
    `docs/ai/invocations/session-wp064-log-replay-inspector.md`
    using the WP-063 session prompt as a structural template
    (but not a content copy — WP-064's layer and guardrails
    are client-UI, not engine + CLI).
11. Execute under EC-mode; run 01.6 post-mortem (MANDATORY
    per P6-35) before the pre-commit review and commit.
12. Hand off to separate-session gatekeeper for pre-commit
    review (default per P6-35). If user requests in-session
    review, disclose the P6-42 deviation in the `EC-074:`
    commit body.
13. Land Commit A (`EC-074:` code + samples + 01.6
    post-mortem + session-context-wp064), capture hash,
    update governance with hash, land Commit B (`SPEC:`
    governance close).

---

## One-Line Handoff

WP-063 landed at `97560b1` + `b1ad8e5`; engine 427/108, repo
486; `ReplaySnapshotSequence` + `loadReplay` contract unblocks
`<GameLogPanel />` / `<ReplayInspector />` / `<ReplayFileLoader />`;
EC-074 is the next free slot; `client-app` category rules apply
(not `cli-producer-app`); P6-43/P6-44/P6-45 from WP-063 now
available in the Precedent Log; stash@{0} + stash@{1} + EC-069
`<pending>` + WP-080 post-mortem all still quarantined.
