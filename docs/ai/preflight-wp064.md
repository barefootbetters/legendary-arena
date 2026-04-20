# Pre-Flight Report — WP-064 Game Log & Replay Inspector

> **Template:** `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`
> **Generated:** 2026-04-19 (same session as WP-063 / EC-071 execution
> close at `97560b1` + `b1ad8e5`).
> **Target WP:** `docs/ai/work-packets/WP-064-log-replay-inspector.md`
> (amended 2026-04-19 per `Amendment 2026-04-19 (SPEC)` blocks)
> **Target EC:** `docs/ai/execution-checklists/EC-074-log-replay-inspector.checklist.md`
> (drafted 2026-04-19; status **Draft** — to flip **Done** on EC-074
> execution close)
> **Session-context input:**
> `docs/ai/session-context/session-context-wp064.md` (authored
> 2026-04-19)

---

## Pre-Flight Header

- **Work Packet:** WP-064
- **Title:** Game Log & Replay Inspector
- **Execution Checklist:** EC-074 (next free slot per the precedent
  chain EC-061 → EC-067, EC-066 → EC-068, EC-062 → EC-069, EC-063 →
  EC-071, EC-080 → EC-072, EC-079 → EC-073)
- **Commit prefix:** `EC-074:` (never `WP-064:` per P6-36)
- **Primary Layer:** Client UI (`apps/arena-client/`)
- **Dependencies (all complete):** WP-027, WP-028, WP-061, WP-062
  (optional), WP-063, WP-080 (informational)

---

## Pre-Flight Intent

Verify that WP-064 is ready to execute by confirming:
(a) all declared dependencies are landed and reachable;
(b) contracts the WP imports (types, loaders, store API) exist in
    their expected shape;
(c) scope is bounded and the file allowlist is internally
    consistent;
(d) upstream execution lessons (P6-43 / P6-44 / P6-45 and the
    WP-063 / WP-080 precedents) are encoded in EC-074;
(e) known blockers from the original WP draft (fixture location
    inconsistency, unreachable phase transition, SFC-transform
    excavation) are pre-resolved by the 2026-04-19 amendments.

---

## Authority Chain (Must Read Before Generation)

- `.claude/CLAUDE.md` (coordination, lint gate, EC authority)
- `.claude/rules/architecture.md` (Layer Boundary invariants)
- `.claude/rules/code-style.md` (ESM, `node:` prefix, `.test.ts`,
  no abbreviations, no `.reduce()` in rendering)
- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` +
  §Persistence Boundary
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md §client-app`
  (WP-064's category; type-only engine imports)
- `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`
  (`EC-074:` / `SPEC:` / `INFRA:` are the only valid prefixes)
- `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`
  (likely **NOT INVOKED** for WP-064 — see §Scope Lock below)
- `docs/ai/REFERENCE/01.6-post-mortem-checklist.md` (mandatory —
  two triggers fire)
- `docs/ai/DECISIONS.md §D-6303` (consumer-side version
  assertion) + §D-6301 (cli-producer-app category — contrasts
  with WP-064's client-app category; do NOT cross-apply)
- `docs/ai/work-packets/WP-064-log-replay-inspector.md` (WP —
  with 2026-04-19 amendments)
- `docs/ai/execution-checklists/EC-074-log-replay-inspector.checklist.md`
  (EC — primary execution authority)
- `docs/ai/session-context/session-context-wp064.md` (step-0
  bridge)
- WP-063 post-mortem: `docs/ai/post-mortems/01.6-WP-063-replay-snapshot-producer.md`
  (§5 aliasing audit pattern; §D-6305 execution-surfaced
  reconciliation precedent)
- WP-061 source:
  `apps/arena-client/src/stores/uiState.ts` +
  `apps/arena-client/src/main.ts` (store shape WP-064 consumes)
- WP-062 source:
  `apps/arena-client/src/components/hud/*.vue` (SFC authoring
  patterns under vue-sfc-loader)

---

## Dependency & Sequencing Check

| Dep | Status | Commit / Reference | Notes |
|---|---|---|---|
| WP-027 | ✅ Done | earlier | Wrapped by WP-063; no direct import |
| WP-028 | ✅ Done | earlier | `UIState` + `buildUIState` exported |
| WP-061 | ✅ Done | `2e68530` | Pinia store, vue-sfc-loader tests |
| WP-062 | ✅ Done | `7eab3dc` | HUD; optional co-sitting |
| WP-063 | ✅ Done | `97560b1` | `ReplaySnapshotSequence` exported; CLI + golden fixture at `apps/replay-producer/samples/` |
| WP-080 | ✅ Done | `dd0e2fd` | `applyReplayStep` (informational — WP-064 never imports engine runtime) |

No parallel-safe siblings: WP-064 is the sole replay-consumer WP
on the critical path. No pending merges block WP-064; execution
can cut from `wp-063-replay-snapshot-producer` head `b1ad8e5` if
the branch has not yet merged to `main`, or from `main` once it
does.

**VERDICT: CLEAR.**

---

## Dependency Contract Verification

- `import type { ReplaySnapshotSequence } from '@legendary-arena/game-engine'`
  **resolves at `b1ad8e5`.** Exported at
  `packages/game-engine/src/index.ts:217` (barrel block
  `// Replay snapshot sequence (WP-063)`; source at
  `packages/game-engine/src/replay/replaySnapshot.types.ts`).
  Also re-exported from
  `packages/game-engine/src/types.ts`.
- `type UIState` and sub-types exported verbatim from the same
  barrel (`packages/game-engine/src/index.ts:215-227`).
- `useUiStateStore().snapshot` + `setSnapshot(next: UIState |
  null)` exposed by `apps/arena-client/src/stores/uiState.ts`
  (WP-061 output; confirmed 35 arena-client tests green at
  session start).
- `loadUiStateFixture(name)` helper + committed UIState fixtures
  in `apps/arena-client/src/fixtures/uiState/` (WP-061 output —
  WP-064's replay fixtures are a separate siblings directory at
  `apps/arena-client/src/fixtures/replay/`, not a replacement).
- `UIState.log` confirmed `string[]` (not `readonly string[]`) at
  `packages/game-engine/src/ui/uiState.types.ts:40`. WP-064 EC-074
  locks this shape correction.

**VERDICT: ALL CONTRACTS VERIFIED.**

---

## Input Data Traceability Check

WP-064 consumes three input channels:

1. **Static fixture file** —
   `apps/arena-client/src/fixtures/replay/three-turn-sample.json`
   (NEW per WP-064). Produced by the committed WP-063 CLI
   (`apps/replay-producer/`). Regenerable via a sibling
   `three-turn-sample.inputs.json` + `three-turn-sample.cmd.txt`.
2. **In-browser `File` API** — `<ReplayFileLoader />` parses a
   user-selected `.json` file via `File.text()` + `JSON.parse` +
   `parseReplayJson`. No `fetch`, no network, no filesystem in
   production paths.
3. **Store state** — the inspector writes
   `sequence.snapshots[currentIndex]` into
   `useUiStateStore().snapshot`. Read by every downstream HUD
   component (WP-062 outputs) unchanged.

**Known fixture-generation path (locked):** `advanceStage` moves
(for `G.currentStage` transitions visible in
`snapshot.game.currentStage`) mixed with unknown-move records
(for `UIState.log` growth via `applyReplayStep`'s warning-and-skip
at `replay.execute.ts:162–166`). Phases are unreachable via the
WP-063 producer per D-0205; the original WP-064 "phase
transition" wording was re-scoped to "stage transition" in the
2026-04-19 amendment to §F.

**VERDICT: CLEAR. No registry access at runtime; no live engine
invocation; no external data source.**

---

## Structural Readiness Check (Types & Contracts)

All types WP-064 touches are **shipped and stable**:

- `ReplaySnapshotSequence` — locked at `version: 1` literal +
  readonly `UIState[]` + optional metadata (D-6303 bump policy
  active; any breaking change is v2 + consumer update in
  lockstep)
- `UIState` — stable since WP-028; WP-067 added `progress` +
  `UIParBreakdown`; no pending WP changes shape
- `ReplayInputsFile` — defined by WP-063 (informational;
  WP-064 does NOT consume on-disk inputs directly — the file
  loader consumes sequences, not inputs)
- Pinia `useUiStateStore()` — one state field `snapshot: UIState
  | null`, one action `setSnapshot(next)`; stable since WP-061

No new contract types are introduced by WP-064 at public surface
other than the parser signature
`parseReplayJson(raw: string, source?: string): ReplaySnapshotSequence`
and the fixture loader
`loadReplayFixture(name: 'three-turn-sample'): ReplaySnapshotSequence`.

**VERDICT: CLEAR. No structural drift to absorb; WP-064 is a pure
consumer of shipped contracts.**

---

## Runtime Readiness Check (Mutation & Framework)

- No runtime `@legendary-arena/game-engine` import: **enforced by
  EC-074 guardrail** + Verification Step 2 grep.
- No `@legendary-arena/registry` or `boardgame.io` import:
  **enforced by EC-074 guardrail** + Verification Step 3 grep.
- No `Math.random` / `Date.now` / `performance.now` in any new
  file: **enforced by EC-074 guardrail** + Verification Step 4
  grep. **P6-43 JSDoc-paraphrase discipline is required** to avoid
  grep false-positives.
- No `.reduce()` in rendering or navigation logic: **enforced by
  EC-074 guardrail** + Verification Step 5 grep.
- `<ReplayInspector />` authoring form: **locked as
  `defineComponent({ setup() {...} })` with `components: {...}`
  registration** per P6-30 / P6-40. Leaf SFCs (`<GameLogPanel />`,
  `<ReplayFileLoader />`) may use `<script setup>` conditional on
  template-binding audit during implementation.
- Keyboard focus pattern: **`tabindex="0"` on inspector root +
  listeners-on-root, locked as D-64NN** (first repo precedent;
  confirmed no prior art in WP-061 / WP-062 via component
  review).
- Parser throws on invalid version / missing snapshots / empty
  snapshots with the three locked full-sentence templates (see
  EC-074 §Locked Values).

**VERDICT: CLEAR. All mutation boundaries and framework-binding
points are pre-committed to EC-074's locked values.**

---

## Established Patterns to Follow (Locked Precedents)

Directly applicable to WP-064:
- **P6-30 / P6-40** — `defineComponent` form under vue-sfc-loader
  for non-leaf SFCs
- **P6-34** — pre-flight governance commits before READY
- **P6-35** — 01.6 post-mortem mandatory before commit (two
  triggers fire for WP-064: new long-lived abstraction
  `parseReplayJson` + new keyboard focus precedent D-64NN)
- **P6-36** — `WP-###:` commit prefix forbidden; use `EC-074:` /
  `SPEC:` / `INFRA:`
- **P6-37** — test-infra explicit allowlist (informational —
  WP-064 does NOT add devDeps; P6-44 is the dual guardrail)
- **P6-38** — governance index cleanliness
- **P6-41** — path-scoped stash + reapply + leave-stash for
  mixed governance edits
- **P6-42** — same-session pre-commit review requires disclosure
- **P6-43** — JSDoc + grep collision; paraphrase form required
- **P6-44** — `pnpm-lock.yaml` absence from diff (WP-064 adds no
  workspace package)
- **P6-45** — execution-surfaced D-entry pattern for literal-WP
  vs upstream-canonical mismatches

Not applicable:
- **D-6301 `cli-producer-app` rules** — WP-064 is `client-app`
- **D-6302 JSON-sort on output** — WP-064 consumes parsed JSON;
  no re-serialization
- **P6-31** (sourcemap carve-out for DCE-marker verification) —
  WP-064 has no DCE markers

**VERDICT: CLEAR. Precedent set codified in EC-074 §Guardrails +
§Common Failure Smells.**

---

## Maintainability & Upgrade Readiness (Senior Review)

Forward-safety questions:

- **Can WP-064 survive a `ReplaySnapshotSequence` v2 bump?** YES.
  D-6303 policy: v2 is allowed for breaking changes only and
  requires a matching consumer update. WP-064's `parseReplayJson`
  rejects any `version !== 1` with the locked full-sentence
  error, forcing a coordinated update when v2 lands.
- **Can WP-064 survive WP-080 step-level API churn?** YES. WP-064
  never imports `applyReplayStep` or any other engine runtime
  export; it consumes only `ReplaySnapshotSequence` (frozen
  shape, v1).
- **Can WP-064 survive WP-061 store evolution?** Partially. WP-064
  depends on `setSnapshot(next: UIState | null)` only; any future
  store additions (e.g., `setReplaySequence`) are additive and
  do not break WP-064. Removing `setSnapshot` would break WP-064
  AND WP-062 AND every HUD consumer — unlikely.
- **Is the keyboard pattern extensible?** YES. D-64NN locks
  `tabindex="0"` + listeners-on-root as the first repo
  precedent; future stepper-style components (e.g., a moves
  timeline, a scenario selector) inherit this without
  re-derivation.
- **Is the fixture regenerable by the next engineer?** YES. The
  locked triplet (`.json` + `.inputs.json` + `.cmd.txt`) is
  deterministic; empty-list registry matches `replay.execute.test.ts`
  precedent; running `pnpm --filter @legendary-arena/replay-producer
  produce-replay` against the committed inputs reproduces the
  golden byte-identically.

**VERDICT: CLEAR.**

---

## Code Category Boundary Check

WP-064 code lives under:
- `apps/arena-client/src/replay/` — client-app category
- `apps/arena-client/src/components/log/` — client-app category
- `apps/arena-client/src/components/replay/` — client-app
  category
- `apps/arena-client/src/fixtures/replay/` — client-app category
  (test fixture)

`02-CODE-CATEGORIES.md §client-app` rules:
- ✅ Type-only engine imports (enforced by EC-074)
- ✅ Node built-ins only in tests (`node:fs/promises`,
  `node:test`, `node:os`, `node:path`)
- ✅ No registry or boardgame.io at runtime
- ✅ No `Date.now` / `Math.random` / `performance.now` in new
  files

`cli-producer-app` category (D-6301) does NOT apply; the
`process.setSourceMapsEnabled(true)` pattern from WP-063 is
explicitly not copied (see §Non-Negotiable Constraints amendment).

**VERDICT: CLEAR. All new files land in the client-app
category; no cross-category contamination.**

---

## Scope Lock (Critical)

**§Files to Produce** (EC-074) is the binding allowlist. 14 files
total: 4 Vue SFCs + 4 test files + 1 loader module + 1 fixture
loader module + 3 fixture artifacts + 1 governance cluster
(STATUS / DECISIONS / DECISIONS_INDEX / WORK_INDEX / EC_INDEX —
counted as one entry for the Commit B governance commit).

**Must remain untouched:**
- `packages/game-engine/**` (entire engine)
- `packages/registry/**`, `packages/vue-sfc-loader/**`
- `apps/server/**`, `apps/registry-viewer/**`,
  `apps/replay-producer/**`
- `apps/arena-client/src/stores/**` (WP-061 output)
- `apps/arena-client/src/main.ts`
- `apps/arena-client/src/fixtures/uiState/**` (WP-061 output)
- `apps/arena-client/src/components/hud/**` (WP-062 output)
- `stash@{0}` + `stash@{1}` (NOT popped)
- `docs/ai/post-mortems/01.6-applyReplayStep.md` (WP-080
  artifact; NOT staged)
- EC-069 `<pending>` placeholder in `EC_INDEX.md` (NOT
  backfilled)
- `pnpm-lock.yaml` (WP-064 adds no workspace package — absence
  from diff is a P6-44 pass)

**01.5 Runtime Wiring Allowance:** NOT INVOKED. WP-064 does not
add a required field to `LegendaryGameState`, does not change
any setup orchestrator return type, does not add a new move,
does not add a phase hook. The four 01.5 trigger criteria are
all absent.

**VERDICT: CLEAR. Scope is bounded, allowlist is internally
consistent, and 01.5 is not in play.**

---

## Test Expectations (Locked Before Execution)

- **Engine baseline preserved:** 427 / 108 / 0 fail (no change —
  WP-064 does not touch the engine)
- **replay-producer baseline preserved:** 4 / 2 / 0 fail (no
  change)
- **server baseline preserved:** 6 / 0 fail (no change)
- **registry baseline preserved:** 3 / 0 fail (no change)
- **vue-sfc-loader baseline preserved:** 11 / 0 fail (no change)
- **arena-client baseline:** 35 → **41 minimum** (+6 for
  `parseReplayJson` AC cases) **+ additional component tests**
  as EC-074 enumerates (minimum 11 new tests across
  loadReplay / GameLogPanel / ReplayInspector / ReplayFileLoader
  suites; exact count locked at execution time)
- **Repo-wide:** 486 → **497+**; 0 failures

No existing test must be modified. The drift-detection tests
for `REVEALED_CARD_TYPES`, `MATCH_PHASES`, `TURN_STAGES`,
`CORE_MOVE_NAMES`, `RULE_TRIGGER_NAMES`, `RULE_EFFECT_TYPES`
are untouched (WP-064 is a pure consumer and adds no canonical
array or union type).

**VERDICT: CLEAR.**

---

## Mutation Boundary Confirmation

- `snapshot.log` is read-only in `<GameLogPanel />` (AC
  enforced). No `.push()`, `.pop()`, `.splice()`, or index
  assignment.
- `sequence.snapshots` is read-only in `<ReplayInspector />`
  (frozen by WP-063's `buildSnapshotSequence`). The inspector
  reads by index; never mutates.
- `useUiStateStore().setSnapshot(next)` is the only write path
  into the store from WP-064 code. Every other component
  observes the store reactively.
- `currentIndex` and `isPlaying` are component-local refs,
  not store state.
- `File` API reads are one-shot (`File.text()` returns a
  promise; the file object is discarded after parse). No
  persistent file handle.

**VERDICT: CLEAR.**

---

## Risk & Ambiguity Review (Resolve Now, Lock for Execution)

Risks that the 2026-04-19 amendments + EC-074 have resolved:

| Risk | Resolution |
|---|---|
| Fixture location contradiction (§Assumes vs §F) | WP amendment 2026-04-19 corrected §Assumes; EC-074 locks the fixture path under `apps/arena-client/src/fixtures/replay/` |
| "Phase transition" unreachable via WP-063 producer | §F amendment re-scoped to "stage transition"; EC-074 locks the `advanceStage` + unknown-move mix as the fixture generation path |
| WP-061 SFC transform excavation would delay execution | §Preflight amendment pre-resolved: `@legendary-arena/vue-sfc-loader`, test command locked |
| Keyboard focus prior art absent from WP-061/WP-062 | §Preflight amendment confirmed WP-064 establishes D-64NN as the first precedent |
| `UIState.log` shape drift (readonly vs mutable) | §Locked contract values amendment clarified actual type is `string[]`; AC keeps "no mutation" semantically |
| WP-063 CLI sourcemap pattern (`setSourceMapsEnabled`) risks being copied | §Non-Negotiable Constraints amendment explicitly marks that pattern as cli-producer-app-only |
| Consumer-side version-error wording would drift | §Locked contract values + §Scope A amendments lock the three verbatim templates |
| `<ReplayInspector />` would fail under `<script setup>` | §Scope D amendment locks `defineComponent({ setup })` form with P6-30 / P6-40 rationale |
| Verification grep would false-positive on JSDoc (P6-43) | §Verification Steps amendment notes the paraphrase discipline |
| `pnpm-lock.yaml` appearing in diff would indicate silent devDep | §Verification Steps amendment adds Step 8 with the `pnpm-lock.yaml` inspection |

Remaining risks (to be handled during execution, not pre-flight
blockers):

| Risk | Handling |
|---|---|
| `<GameLogPanel />` or `<ReplayFileLoader />` template may require `defineComponent` form if it references non-props bindings | EC-074 guardrail says "pre-flight verifies per-SFC"; executing session evaluates each SFC body during implementation and falls through to `defineComponent` if any binding escapes props-and-emits scope. No pre-flight block. |
| Auto-play implementation may push scope | §Scope D (WP-064) already gates it behind `enableAutoPlay?: boolean` default `false`; EC-074 locks the default-off behavior. Executing session may defer entirely if implementation adds scope. |
| Fixture regeneration may produce a sequence with non-optimal visual diff between snapshots | Not a blocker; the fixture just needs to meet 6–12 snapshots + stage transition + log growth. Executing session picks any `advanceStage`-count + unknown-move-count that satisfies the minimum. |

**VERDICT: CLEAR. All structural risks pre-resolved; residual
risks are execution-time judgment calls with documented
defaults.**

---

## Pre-Flight Verdict (Binary)

## **READY TO EXECUTE.**

All Pre-Flight sections clear. WP-064 is unblocked and may
proceed to session-prompt generation.

**Conditional on (pre-session SPEC commit, per P6-34):**
the following must land under a `SPEC:` commit **before** the
WP-064 execution session opens:

1. **WP-064 amendments** (the ten `Amendment 2026-04-19 (SPEC)`
   blocks added to `WP-064-log-replay-inspector.md`)
2. **EC-074 draft** (`EC-074-log-replay-inspector.checklist.md`)
3. **EC_INDEX.md** — new EC-074 row under Draft status; "Last
   updated" footer refresh
4. **01.4 Precedent Log additions** (P6-43 / P6-44 / P6-45)
5. **`docs/ai/session-context/session-context-wp064.md`**
6. **This pre-flight report** (`docs/ai/preflight-wp064.md`)

Optional but recommended in the same SPEC bundle:
- `DECISIONS.md` — D-64NN placeholder entry (can also land in
  the WP-064 execution Commit A; either works per precedent)
- `DECISIONS_INDEX.md` — row for the D-64NN placeholder (same
  rule)

---

## Invocation Prompt Conformance Check (Pre-Generation)

When drafting `docs/ai/invocations/session-wp064-log-replay-inspector.md`,
verify:

- [ ] Six Pre-Session Gates at the top of the invocation
      (slot lock, commit-prefix lock, governance-committed, deps
      verified green, D-6301-not-applicable check, stash +
      placeholder discipline)
- [ ] Authority Chain lists WP-064 + EC-074 + 01.4 + 01.6 + 01.3
      + 02-CODE-CATEGORIES (§client-app) + ARCHITECTURE (§Layer
      Boundary) + this pre-flight report + session-context-wp064
- [ ] Runtime Wiring Allowance: **NOT INVOKED** block (four
      triggers enumerated as absent, matching the WP-063
      invocation template)
- [ ] Locked Values block copied verbatim from EC-074 §Locked
      Values
- [ ] Required `// why:` Comments block copied verbatim from
      EC-074 §Required `// why:` Comments
- [ ] Files Expected to Change allowlist copied verbatim from
      EC-074 §Files to Produce
- [ ] Acceptance Criteria block derived from WP-064 §Acceptance
      Criteria, with the stage-transition rescope applied
      (§F amendment)
- [ ] Verification Steps block includes P6-43 paraphrase
      discipline note AND P6-44 `pnpm-lock.yaml` absence check
- [ ] Post-Mortem clause: **MANDATORY** per P6-35; triggers
      enumerated (new long-lived abstraction + new keyboard
      focus precedent D-64NN)
- [ ] Pre-commit review clause: separate gatekeeper session per
      P6-35 default; P6-42 deviation clause referenced
- [ ] DoD + Out-of-Scope blocks
- [ ] Final Instruction: stop before commit for gatekeeper
      review

---

## Authorized Next Step

1. Land the six artifacts above under one `SPEC:` commit (or a
   two-commit split: amendments + precedent log first, then
   EC-074 + preflight + session-context).
2. Draft
   `docs/ai/invocations/session-wp064-log-replay-inspector.md`
   per the Invocation Prompt Conformance Check above.
3. Land the invocation under a separate `SPEC:` commit.
4. Open a fresh Claude Code session and run
   `/execute docs/ai/invocations/session-wp064-log-replay-inspector.md
   using session context docs/ai/session-context/session-context-wp064.md`.

---

## Final Instruction

The WP-064 executing session must treat EC-074 as the
authoritative execution contract. Any conflict with the WP is
resolved in favor of the WP only when the WP explicitly
overrides (per the EC-TEMPLATE rule); otherwise EC-074's Locked
Values and Guardrails are binding. P6-27 (scope-lock binary)
applies to every file outside §Files to Produce.
