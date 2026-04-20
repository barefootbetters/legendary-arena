# Session Context — WP-057 Pre-Plan Sandbox Execution

Bridge from WP-056 execution (Pre-Planning state model, 2026-04-20) to the
WP-057 executor. Carries baselines, quarantine state, inherited dirty-tree
map, pre-flight locks (RS-1..RS-14), pre-session-action resolution log
(PS-1 / PS-2 / PS-3), and discipline precedents from the WP-034 → WP-035 →
WP-042 → WP-055 → WP-056 Phase 6 closure sequence.

---

## Baselines (WP-056 closed at commit `eade2d0`; SPEC closers through `b9b677e`)

- **Preplan package:** `0 tests / 0 suites / 0 failing` (types-only; no
  `.test.ts` files exist — WP-057 owns the first test surface).
- **Registry package:** `13 / 2 / 0` — unchanged since WP-055 closed.
- **Game-engine package:** `436 / 109 / 0` — unchanged since Phase 6
  start (WP-034 / WP-035 / WP-042 / WP-055 / WP-056 all held this
  baseline).
- **vue-sfc-loader package:** `11 / 0` — unchanged.
- **apps/server:** `6 / 0`, **apps/replay-producer:** `4 / 0`,
  **apps/arena-client:** `66 / 0` — all unchanged.
- **Repo-wide: `536 passing / 0 failing`** at HEAD `b9b677e` on branch
  `wp-081-registry-build-pipeline-cleanup`.

### WP-057 expected baseline shift (locked by EC-057 + pre-flight; copilot-check HOLD 2026-04-20 raised operations count 11 → 13)

- **Preplan package:** `0 / 0 / 0 → 23 / 4 / 0` (+23 tests across 4
  `describe` blocks — PRNG 3, sandbox 6, operations 13, status drift 1).
- **Game-engine package:** `436 / 109 / 0` **MUST REMAIN UNCHANGED** —
  WP-057 touches zero engine code.
- **All other packages:** baselines unchanged.
- **Repo-wide: `536 → 559 passing / 0 failing`.**

The +4 suite count depends on each new test file wrapping its tests in
exactly one top-level `describe('preplan <area> (WP-057)')` block. Bare
top-level `test()` calls are forbidden — they do not register as suites
under `node:test` (WP-031 precedent). This is locked in EC-057 Locked
Values and called out in WP-057 §E.

---

## Quarantine state — do NOT disturb

All three pre-WP-056 stashes remain intact and MUST NOT be popped during
WP-057 execution:

- **`stash@{0}`** — `wp-055-quarantine-viewer` (registry viewer v1→v2).
- **`stash@{1}`** — WP-068 / MOVE_LOG_FORMAT governance edits.
- **`stash@{2}`** — pre-WP-062 dirty tree.

None overlap WP-057 scope (`packages/preplan/` + `pnpm-lock.yaml` +
governance docs).

---

## Inherited dirty-tree state — do NOT stage under WP-057

`git status --short` at session start will show the following items. None
are in WP-057's implementation allowlist; quarantine them or leave them
untracked. **Never** `git add .` / `git add -A` (P6-27 / P6-44).

### Untracked files (carried from pre-WP-056 + surfaced during/after WP-056):

- `.claude/worktrees/` — WP-081 build-pipeline cleanup worktree state.
  Do NOT commit.
- `docs/ai/REFERENCE/01.3-ec-mode-commit-checklist.oneliner.md`
- `docs/ai/invocations/forensics-move-log-format.md`
- `docs/ai/invocations/session-wp048-par-scenario-scoring.md`
- `docs/ai/invocations/session-wp067-uistate-par-projection-and-progress-counters.md`
- `docs/ai/invocations/session-wp068-preferences-foundation.md`
- `docs/ai/post-mortems/01.6-applyReplayStep.md`
- `docs/ai/session-context/session-context-forensics-move-log-format.md`
- `docs/ai/session-context/session-context-wp067.md`

### Modified (tracked) files:

- `docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`

### Pre-flight artifacts produced by THIS context session (belong to Commit A0 `SPEC:` bundle):

- `docs/ai/invocations/preflight-wp057-preplan-sandbox-execution.md` — NEW
- `docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md` — NEW
- `docs/ai/work-packets/WP-057-preplan-sandbox-execution.md` — MODIFIED (Amendments section + §D / §E / §F / §Files / §Verification / §Acceptance / §Governance / §Definition of Done updates)
- `docs/ai/session-context/session-context-wp057.md` — NEW (this file)

Commit A0 also folds in the EC_INDEX row for EC-057 (Draft status) and
any DECISIONS_INDEX row if `D-5701` is authored during pre-flight. The
executor for Commit A only stages implementation files + `pnpm-lock.yaml`
+ post-mortem + DECISIONS.md / DECISIONS_INDEX.md updates (if any
D-entries are authored during execution). Commit B stages
STATUS.md / WORK_INDEX.md / EC_INDEX.md governance close.

---

## Parallel session in flight (status)

The WP-081 registry build-pipeline cleanup that spawned during WP-055
closeout landed at commit `ea5cfdd` (plus PS-2 `9fae043` and PS-3
`aab002f` amendments). Per `session-context-wp056.md` §Parallel session
in flight, no file overlap with preplan exists. Confirm at session start
that `.claude/worktrees/` is the only residue (pre-flight already flagged
this).

---

## Upstream contracts — what WP-057 consumes

### From WP-056 (`packages/preplan/src/preplan.types.ts`, immutable in this WP)

- `PrePlan` — line 29. Fields: `prePlanId`, `revision` (starts at 1,
  increments on mutation), `playerId`, `appliesToTurn = ctx.turn + 1`,
  `status: 'active' | 'invalidated' | 'consumed'` (closed union),
  `baseStateFingerprint` (NON-GUARANTEE), `sandboxState`, `revealLedger`,
  `planSteps`, optional `invalidationReason` (WP-058 scope).
- `PrePlanSandboxState` — line 132. Fields: `hand`, `deck`, `discard`,
  `inPlay` (all `CardExtId[]`), `counters` (`Record<string, number>`).
  **`victory` intentionally absent** (DESIGN-CONSTRAINT #9 — not
  player-visible during normal play). WP-057 must not reintroduce it.
- `RevealRecord` — line 169. Open `source` union (`'player-deck' |
  'officer-stack' | 'sidekick-stack' | 'hq' | string`); monotonic
  `revealIndex`. Reveal ledger is the **sole authority** for rewind
  (DESIGN-CONSTRAINT #3). WP-057 must not invent new literal sources.
- `PrePlanStep` — line 202. Open `intent` union (`'playCard' |
  'recruitHero' | 'fightVillain' | 'useEffect' | string`); advisory,
  intentionally NOT the engine's `CoreMoveName`. `isValid: boolean` is
  initialized to `true` by `addPlanStep` and never flipped in WP-057
  (step-level invalidation is WP-058 scope).

### From WP-006A (`packages/game-engine/src/state/zones.types.ts:23`, re-exported from `packages/game-engine/src/index.ts:5`)

- `CardExtId = string` — named type alias. WP-057 imports via
  `import type { CardExtId } from '@legendary-arena/game-engine';`.
  Bare `import { CardExtId }` is forbidden (runtime engine import gate).

### From WP-008B

- `CORE_MOVE_NAMES` locked at `drawCards` / `playCard` / `endTurn`.
  WP-057 does not expand `CoreMoveName`. `PrePlanStep.intent` remains
  descriptive-only.

---

## Pre-flight locks carried into execution

### Resolved pre-session actions

- **PS-1** — EC-057 authored. File:
  `docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md`.
  Primary execution authority per 01.4.
- **PS-2** — WP-057 scope amended to include `preplanStatus.ts` +
  `preplanStatus.test.ts` (canonical readonly array `PREPLAN_STATUS_VALUES`
  + derived type + drift-detection test). Closes WP-056 deferral per
  EC-056 Locked Value line 32. `PREPLAN_EFFECT_TYPES` remains WP-058 scope.
- **PS-3** — WP-057 scope amended to include `packages/preplan/package.json`
  (modify: add `test` script + `tsx` devDep matching registry version
  `^4.15.7`) and `pnpm-lock.yaml` (modify: scoped devDep delta). Without
  the `test` script, the 21 new tests would silently skip under
  `pnpm test`.
- **PS-4** — this file (closes the WP-056 → WP-057 step-8 workflow audit
  loop).

Pre-flight verdict flips from **DO NOT EXECUTE YET** to **READY TO
EXECUTE** once the Commit A0 `SPEC:` bundle lands. No re-run of
pre-flight is required — PS-1..PS-4 resolve gaps without changing scope.

### Locked risks (from pre-flight §Risk & Ambiguity Review)

- **RS-1** — `PREPLAN_STATUS_VALUES` canonical array + drift test added
  (resolved via PS-2).
- **RS-2** — `index.ts` type-only → mixed transition **authorized by
  EC-057** with `// why:` header comment requirement.
- **RS-3** — `package.json` `test` script + `tsx` devDep added (resolved
  via PS-3).
- **RS-4** — Aliasing trace MANDATORY in 01.6 post-mortem §6. Every
  returned `PrePlan`'s `sandboxState.hand` / `deck` / `discard` /
  `inPlay` / `counters` must be fresh (spread `[...]` / `slice()` /
  object literal). Standard JSON-equality tests cannot detect aliasing;
  post-mortem trace fills the gap (WP-028 precedent). Tests include
  a "3 sequential operations do not mutate input" assertion per
  operation file.
- **RS-5** — `Date.now()` in `generateSpeculativeSeed` requires a
  mandatory `// why:` comment citing DESIGN-PREPLANNING §3.
- **RS-6** — P6-50 paraphrase discipline. Verification greps use
  escaped regex patterns (`boardgame\.io`) per WP-031 P6-22. New preplan
  code must not name `G`, `LegendaryGameState`, `LegendaryGame`, or
  `boardgame.io` in prose. `ctx` permitted only in the `ctx.turn + 1`
  invariant reference (inherited WP-056 carve-out).
- **RS-7** — `speculativeDraw` surfaces the drawn card separately in
  its return tuple so callers need not scan `sandboxState.hand`; JSDoc
  note required.
- **RS-8** — **All five speculative operations** (`Draw` / `Play` /
  `UpdateCounter` / `AddPlanStep` / `SharedDraw`) uniformly return
  `null` when `status !== 'active'`. This extends WP-057 §C Rules to
  the three operations whose per-operation spec didn't originally
  mention null returns.
- **RS-9** — `prePlanId` is caller-supplied opaque string; WP-057
  does not validate format.
- **RS-10** — `computeStateFingerprint` algorithm is implementation
  detail; acceptance criterion is deterministic sameness + content
  sensitivity. No external consumer exists yet (WP-058 is first).
- **RS-11** — Shuffle test fixture: ≥8-card deck + seed proven to
  produce a non-identity permutation + `// why:` comment on the seed
  literal.
- **RS-12** — `pnpm -r --if-present test` (or equivalent) confirms
  preplan tests execute after PS-3 lands.
- **RS-13** — Inherited dirty-tree discipline (P6-27 / P6-44).
- **RS-14** — Parallel WP-081 worktree cleanup is independent; no
  coordination required.

---

## Architectural placement (locked)

- **Layer:** Pre-Planning (Non-Authoritative, Per-Client).
  `packages/preplan/` — D-5601 (Immutable) in
  `docs/ai/REFERENCE/02-CODE-CATEGORIES.md:43, 168-205`.
- **Import matrix** (from `.claude/rules/architecture.md` §Import Rules):
  preplan MAY import Node built-ins + `@legendary-arena/game-engine`
  type-only. preplan MUST NOT import `@legendary-arena/game-engine`
  runtime, `@legendary-arena/registry`, `apps/server`, any `apps/*`,
  `pg`, `boardgame.io`.
- **Category rules forbid:** `Math.random()`, `ctx.random.*`, `.reduce()`,
  `require(`, writes to `G`, writes to `ctx`, wiring into `game.ts` /
  `LegendaryGame.moves` / phase hooks.
- **Allowed engine reference:** only `import type { CardExtId } from
  '@legendary-arena/game-engine'`. All other engine references are
  gated out.

---

## Work Packet Class — Infrastructure & Verification

Per 01.4 §Pre-Flight Header:

> Infrastructure & Verification — harnesses, replay, testing infra,
> verification tooling — has runtime logic but does not mutate `G` in
> gameplay, does not wire into `game.ts`, does not add moves or phases.

WP-057 fits exactly: runtime logic in `packages/preplan/src/**`, zero
`G` mutation, zero `game.ts` wiring, zero new moves / phase hooks.

**Sections mandatory for this class** (all completed in pre-flight):
Dependency Check, Input Data Traceability, Structural Readiness,
Runtime Readiness, Dependency Contract Verification, Maintainability
& Upgrade Readiness, Scope Lock, Test Expectations, Risk Review.
Mutation Boundary Confirmation skipped (no `G` path).

---

## 01.5 / 01.6 / commit topology (locked)

### 01.5 Runtime Wiring Allowance — **NOT INVOKED**

Four criteria absent:
- No new field in `LegendaryGameState` (no engine file touched).
- No shape change to `buildInitialGameState`.
- No new entry in `LegendaryGame.moves`.
- No new phase hook.

Session prompt must declare NOT INVOKED explicitly per WP-030 / 055 / 056
precedent.

### 01.6 Post-Mortem — **MANDATORY** (three triggers)

1. New long-lived abstractions (`speculativePrng`, sandbox factory,
   speculative operations) — canonical contract lifetime of project.
2. First runtime consumer of `PrePlan.status` closed union (the status
   guards in §C speculative operations).
3. Contract consumed by WP-058 (disruption pipeline will read
   `revealLedger`, `sandboxState`, `revision`, and trigger
   `status: 'active' → 'invalidated'` transitions).

10-section formal audit at
`docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md`.
**Section 6 MUST include the aliasing trace** (RS-4) — every returned
`PrePlan` traced line-by-line to confirm fresh `sandboxState` arrays/
objects.

### Three-commit topology

1. **Commit A0 (`SPEC:`)** — pre-flight bundle: this session-context file
   + pre-flight + EC-057 + EC_INDEX row + WP-057 amendments +
   DECISIONS_INDEX row (if `D-5701` authored at A0) + optional
   placeholder D-5701 entry if the executor prefers pre-authoring.
2. **Commit A (`EC-057:`)** — execution: 10 implementation files under
   `packages/preplan/` + `pnpm-lock.yaml` + 01.6 post-mortem +
   any D-entries authored during execution.
3. **Commit B (`SPEC:`)** — governance close: `STATUS.md` +
   `WORK_INDEX.md` (WP-057 `[x]` with date + commit hash) +
   `EC_INDEX.md` (EC-057 Draft → Done).

**Commit prefix `WP-057:` is forbidden** (P6-36). The commit-msg hook
enforces `EC-057:` for execution and `SPEC:` for pre-flight / governance
close.

---

## Step 1b — Copilot Check (01.7) — MANDATORY

Per 01.4 §Step Sequencing Rules, Step 1b is mandatory for Infrastructure
& Verification WPs. It runs in the **same session** as pre-flight, only
after step 1 produces a READY TO EXECUTE verdict. Since the pre-flight
returns **DO NOT EXECUTE YET** until the Commit A0 bundle lands, Step 1b
does not run yet. Once the bundle lands and the verdict flips to READY,
01.7 must complete with disposition `CONFIRM` before the session
execution prompt is generated.

Expected copilot check focus areas for WP-057:
- Aliasing risks on `sandboxState` arrays/objects (WP-028 lens).
- PRNG determinism + seed-entropy contract.
- Null-on-inactive uniform convention enforcement.
- Ledger monotonicity across multi-draw sequences.
- Type-only → mixed-export transition in `index.ts`.
- P6-50 paraphrase in new JSDoc.
- Drift-detection test rigor (runtime set-equality + compile-time
  exhaustive check).

If 01.7 returns RISK with FIXes, fold the fixes into WP-057 / EC-057
before generating the session prompt (WP-028 / WP-055 precedent).

---

## Discipline precedents to carry into the WP-057 session

These precedents were locked across Phase 6 and apply to WP-057:

### Allowlist staging (P6-27 / P6-44)

- `git add` by exact file name only; never `-A` / `.`.
- Never `--no-verify` / `--no-gpg-sign`.
- `pnpm-lock.yaml` delta confined to `importers['packages/preplan']`;
  any cross-importer churn is a scope violation.

### Paraphrase discipline (P6-50)

- Forbidden tokens in new preplan code + JSDoc: `G`, `LegendaryGameState`,
  `LegendaryGame`, `boardgame.io` (with unescaped dot match).
- `ctx` permitted only in the `ctx.turn + 1` invariant reference
  (inherited from WP-056 carve-out).
- Verification greps use escaped-dot patterns (`boardgame\.io`) per
  WP-031 P6-22 — a bare `boardgame.io` pattern over-matches comment
  prose because `.` is regex-special.

### Commit prefix (P6-36)

- Execution commit: `EC-057:`.
- Pre-flight / governance commits: `SPEC:`.
- `WP-057:` is forbidden everywhere.

### Drift-detection pattern (WP-007A / 009A / 014A / 021 precedent)

- Canonical readonly `as const` array paired with closed union.
- Compile-time exhaustive check + runtime set-equality test.
- Both layers required; one without the other is weaker than the
  precedent.

### Projection aliasing discipline (WP-028 precedent)

- Every returned object reading from another stateful source must be
  a fresh spread/slice/object-literal copy.
- Standard `JSON.stringify` equality tests cannot detect aliasing.
- Post-mortem §6 MUST include the aliasing trace.

### Reality-reconciliation at pre-flight (WP-042 / 055 / 056 precedent)

- Before locking any Locked Value in the session prompt, grep the
  actual source files to confirm names/paths exist. WP-057 pre-flight
  already verified: `CardExtId` export path, `PrePlan` / `PrePlanSandboxState`
  / `RevealRecord` / `PrePlanStep` field shapes, `packages/preplan/`
  category classification (D-5601), WP-056 `preplan.types.ts`
  immutability, preplan `package.json` missing `test` script and
  `tsx` devDep.

---

## Open questions — all resolved during pre-flight

1. **Should `PREPLAN_STATUS_VALUES` land in WP-057?** → YES (PS-2,
   deferred from WP-056 per EC-056 Locked Value line 32). `PREPLAN_EFFECT_TYPES`
   stays deferred to WP-058.
2. **Does `packages/preplan/package.json` need a `test` script?** → YES
   (PS-3, without it `pnpm test` skips the new tests silently).
3. **Does `index.ts` type-only → mixed transition need explicit
   authorization?** → YES (RS-2, authorized by EC-057 with required
   header `// why:` comment).
4. **Is `Date.now()` permitted in `generateSpeculativeSeed`?** → YES
   (DESIGN-PREPLANNING §3; WORK_INDEX convention line 1463; mandatory
   `// why:` comment per RS-5).
5. **Should all five speculative operations uniformly return `null` on
   non-active status?** → YES (RS-8, locked in EC-057).
6. **Test count target?** → 21 tests / 4 suites in preplan package
   (locked in EC-057 + WP-057 §E).
7. **What WP owns `PREPLAN_EFFECT_TYPES`?** → WP-058 (first runtime
   consumer of `effectType`).

No open questions remain for execution.

---

## Files the WP-057 executor needs to read

### Authority documents (in order)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` §Pre-Planning Layer
3. `.claude/rules/architecture.md` §Import Rules (Quick Reference)
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` lines 43, 168-205 (D-5601)
5. `docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md`
6. `docs/ai/work-packets/WP-057-preplan-sandbox-execution.md` (amended)
7. `docs/ai/invocations/preflight-wp057-preplan-sandbox-execution.md`
8. `docs/ai/DESIGN-PREPLANNING.md` §3 (randomness in the sandbox)
9. `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md` #1 / #2 / #3 / #5 / #8 / #9 / #10

### Contract files (read-only)

- `packages/preplan/src/preplan.types.ts` — **immutable in WP-057**;
  reference only.
- `packages/preplan/src/index.ts` — will be modified to add runtime
  exports alongside existing type re-exports.
- `packages/game-engine/src/index.ts:5` — `CardExtId` export line.

### Test-infrastructure reference

- `packages/registry/package.json:19, 34` — `test` script shape and
  `tsx` devDep version (`^4.15.7`) to mirror in `packages/preplan/package.json`.
- `packages/registry/src/**/*.test.ts` — `node:test` + `node:assert`
  patterns (no `boardgame.io/testing`).

---

## Final reminders

- **Phase 6 is closed.** No retro-editing of Phase-6 artifacts
  (WP-034 / 035 / 042 / 055 / 056 / 081 are all `[x]`).
- **Non-authoritative by construction.** `packages/preplan/` owns no
  game state; any pressure during execution to add a write path to `G`
  is an architecture violation — stop and escalate.
- **`preplan.types.ts` is immutable in this WP.** WP-056 output is
  final. Any perceived need to add a field, rename a field, or edit
  JSDoc is scope creep — stop and escalate.
- **Uniform null-on-inactive.** Every speculative operation returns
  `null` when `status !== 'active'`. Uniform convention is non-negotiable.
- **Revision is monotonic.** +1 on each successful mutation; zero delta
  on null-return paths. Tests cover both branches explicitly.
- **Aliasing is forbidden.** Every `sandboxState.hand` / `deck` / `discard`
  / `inPlay` / `counters` array/object in a returned `PrePlan` is a fresh
  copy. Post-mortem §6 aliasing trace is mandatory.
- **Ledger is the rewind authority** (DESIGN-CONSTRAINT #3). Rewind
  logic (WP-058) reads `revealLedger` only; never `sandboxState`.
  WP-057 populates the ledger in `speculativeDraw` and
  `speculativeSharedDraw`; no other operation touches it.
- **Single-turn scope.** `appliesToTurn = snapshot.currentTurn + 1`
  unconditionally. Multi-turn planning is out of scope (and rejected
  by design-doc review).
- **Canonical array lives alongside the first runtime consumer.**
  `PREPLAN_STATUS_VALUES` lands in WP-057 (first `status === 'active'`
  guard); `PREPLAN_EFFECT_TYPES` waits for WP-058 (first disruption
  classifier). Do not pull WP-058 forward.
- **Three-commit topology + 01.5 NOT INVOKED + 01.6 MANDATORY + Step 1b
  copilot check.** Session prompt must declare all four.

---

## Workflow audit trail — WP-056 closure

Steps completed for WP-056:

- **0** — session-context-wp056.md loaded.
- **1** — pre-flight 2026-04-20, READY.
- **1b** — copilot check 2026-04-20, CONFIRM (WP-056 was Contract-Only
  so 01.7 was recommended rather than mandatory; ran anyway per
  session-context-wp056.md §Copilot Check recommendation).
- **2** — `docs/ai/invocations/session-wp056-preplan-state-model.md`
  generated.
- **3** — execution 2026-04-20, 536 / 0 tests unchanged (types-only,
  zero tests added).
- **4** — post-mortem clean (`docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md`);
  two §8 findings both informational (pre-existing registry build
  bootstrap; EC grep-pattern drift).
- **5** — pre-commit review pending (WP-056 `SPEC:` closers landed
  at `b9b677e` etc. without a formal pre-commit review artifact;
  this is consistent with Phase 6 Contract-Only WP practice and does
  not block WP-057).
- **6** — commit `eade2d0` (Commit A — execution), plus SPEC closers
  `8a6451d`, `5bce4a2`, `b9b677e` (top-level roadmap + post-mortem
  gap closure + roadmap refresh).
- **7** — lessons learned: none material. The WP-056 post-mortem §8
  captures the two informational findings; no template updates needed.
- **8** — this file.

## Workflow audit trail — WP-057 next steps

- **0** — this file is the step 0 input for the WP-057 session.
- **1** — pre-flight already authored at
  `docs/ai/invocations/preflight-wp057-preplan-sandbox-execution.md`.
  Current verdict: **DO NOT EXECUTE YET**, conditional on Commit A0
  bundle landing. Once A0 lands, verdict flips to **READY TO EXECUTE**
  without re-run (PS-1..PS-4 are scope-neutral corrections).
- **1b** — copilot check (01.7) — mandatory for Infrastructure &
  Verification WPs; runs in the same session as pre-flight once the
  verdict is READY. Expected disposition: CONFIRM.
- **2** — session execution prompt to be authored at
  `docs/ai/invocations/session-wp057-preplan-sandbox-execution.md`
  after 1b returns CONFIRM.
- **3..8** — standard WP execution flow per 01.4.

**Run pre-flight (step 1) re-confirmation → 1b copilot check → generate
step 2 session prompt next.**
