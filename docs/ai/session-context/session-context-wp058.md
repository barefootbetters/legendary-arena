# Session Context — WP-058 Pre-Plan Disruption Pipeline

Bridge from WP-057 execution (Pre-Plan Sandbox Execution, 2026-04-20) to
the WP-058 executor. Carries baselines, quarantine state, inherited
dirty-tree map, upstream contract anchors with line numbers, WP-057-
specific lessons learned (strict-tsconfig narrowing; uniform failure-
signaling; spread-copy discipline; canonical-array deferral pattern;
test wrapping convention), and discipline precedents from the
WP-034 → WP-035 → WP-042 → WP-055 → WP-056 → WP-057 Phase 6 closure
sequence.

This document is **not a pre-flight**. It is the input to the WP-058
pre-flight. Author `docs/ai/invocations/preflight-wp058-*.md` separately.

---

## Baselines (WP-057 closed at commit `7414656`; A0 + A + B all landed)

### Three-commit topology (all on `wp-081-registry-build-pipeline-cleanup`):

- **A0 `SPEC:` `f12c796`** — pre-flight bundle (EC-057 checklist +
  WP-057 amendments + pre-flight file + session-context-wp057 +
  EC_INDEX row + session prompt).
- **A `EC-057:` `8a324f0`** — execution: 9 new source files under
  `packages/preplan/src/` + `index.ts` modification + `package.json`
  modification + `pnpm-lock.yaml` + mandatory 01.6 post-mortem.
- **B `SPEC:` `7414656`** — governance close (STATUS + WORK_INDEX +
  EC_INDEX).

### Test baselines at HEAD `7414656`:

- **Preplan package:** `23 / 4 / 0` — PRNG 3, sandbox 6, operations 13,
  status drift 1 (each file wraps its tests in exactly one top-level
  `describe('preplan <area> (WP-057)')` block).
- **Registry package:** `13 / 2 / 0` — unchanged.
- **Game-engine package:** `436 / 109 / 0` — **UNCHANGED** since Phase 6
  start (WP-034 / WP-035 / WP-042 / WP-055 / WP-056 / WP-057 all held
  this baseline).
- **vue-sfc-loader package:** `11 / 0`, **apps/server:** `6 / 0`,
  **apps/replay-producer:** `4 / 0`, **apps/arena-client:** `66 / 0`
  — all unchanged.
- **Repo-wide: `559 passing / 0 failing`.**

### WP-058 expected baseline shift (to be locked by EC-058 + pre-flight)

WP-058 authors the Pre-Plan Disruption Pipeline. Based on
`WORK_INDEX.md:1324-1340` the scope is: full disruption workflow as a
single cohesive pipeline (`detect → invalidate → rewind → notify`).
Expected additions:

- **First runtime consumer of `invalidationReason.effectType` closed
  union.** `PREPLAN_EFFECT_TYPES` canonical readonly array + its
  drift-detection test land here (deferred from WP-056 per EC-056
  Locked Value line 32; WP-057 deferred it again per PS-2 narrow scope).
- **`invalidatePrePlan`** transitions `status: 'active' → 'invalidated'`
  with causal reason.
- **`computeSourceRestoration`** — rewind source derivation from
  `revealLedger` exclusively (DESIGN-CONSTRAINT #3 invariant). Deck
  returns must be reshuffled; shared-source returns restore membership
  only.
- **`buildDisruptionNotification`** — structured causal message.
- **`PlayerAffectingMutation`** type with `sourcePlayerId` (who caused
  it) + `affectedPlayerId` (who was disrupted) + `effectType`
  discriminator.

Engine-baseline lock (`436 / 109 / 0` UNCHANGED) **must hold** — WP-058
should touch zero engine code, same as WP-057. Any deviation is a
scope violation per the `preplan` code category (D-5601 Immutable).

---

## Upstream contract anchors (line numbers locked at HEAD `7414656`)

Verify before writing any WP-058 code — if a line number has drifted,
the anchor description was wrong:

### WP-056 output (immutable across WP-057; immutable in WP-058)

- `packages/preplan/src/preplan.types.ts:29` — `PrePlan` type
  declaration.
- `packages/preplan/src/preplan.types.ts:66` — `status` union
  (`'active' | 'invalidated' | 'consumed'`).
- `packages/preplan/src/preplan.types.ts:77` — `baseStateFingerprint`
  with NON-GUARANTEE clause.
- `packages/preplan/src/preplan.types.ts:92-115` — `invalidationReason`
  optional field with:
  - `sourcePlayerId: string`
  - `effectType: 'discard' | 'ko' | 'gain' | 'other'` (line 108) —
    **first runtime consumer is WP-058; its canonical array belongs
    here**
  - `effectDescription: string`
  - `affectedCardExtId?: CardExtId`
- `packages/preplan/src/preplan.types.ts:132` — `PrePlanSandboxState`
  (`hand`, `deck`, `discard`, `inPlay`, `counters`).
- `packages/preplan/src/preplan.types.ts:162-168` — `RevealRecord`
  invariant: "reveal ledger is the sole authority for deterministic
  rewind; all rewinds must be derived exclusively from the
  revealLedger. Any rewind logic that inspects sandboxState directly
  is invalid" — **WP-058 rewind logic MUST read `revealLedger` only**.
- `packages/preplan/src/preplan.types.ts:169` — `RevealRecord` type
  declaration.
- `packages/preplan/src/preplan.types.ts:202` — `PrePlanStep` type.

### WP-057 output (new runtime surface; immutable in WP-058 unless explicit amendment)

- `packages/preplan/src/speculativePrng.ts:79` — single `Date.now()`
  call in the entire `packages/preplan/` package, inside
  `generateSpeculativeSeed`. WP-058 must NOT introduce additional
  wall-clock reads.
- `packages/preplan/src/preplanSandbox.ts:14-21` — `PlayerStateSnapshot`
  type (6 fields).
- `packages/preplan/src/preplanSandbox.ts:37-65` — `createPrePlan`.
- `packages/preplan/src/preplanSandbox.ts:84-104` —
  `computeStateFingerprint` (djb2-over-sorted-canonical-stringification;
  deterministic + content-sensitive only, NOT cryptographic).
- `packages/preplan/src/speculativeOperations.ts` — five speculative
  operations, all with null-on-inactive uniform guard:
  - `speculativeDraw` (line 17)
  - `speculativePlay` (line 72)
  - `updateSpeculativeCounter` (line 112)
  - `addPlanStep` (line 151)
  - `speculativeSharedDraw` (line 191)
- `packages/preplan/src/preplanStatus.ts:16` —
  `PREPLAN_STATUS_VALUES = ['active', 'invalidated', 'consumed'] as
  const`.
- `packages/preplan/src/preplanStatus.ts:27-33` — compile-time
  `_StatusDriftCheck` pattern (replicate for `PREPLAN_EFFECT_TYPES` in
  WP-058).
- `packages/preplan/src/index.ts` — mixed runtime + type export
  surface. WP-058 extends this file additively; WP-057's header
  `// why:` comment about the type-only → mixed transition stays.

### Engine re-exports (type-only permitted; runtime forbidden)

- `packages/game-engine/src/index.ts:5` — `CardExtId = string` —
  **only** permitted engine reference (as `import type`).

### Registry mirror (WP-057 PS-3 precedent)

- `packages/registry/package.json:19` — `"test": "node --import tsx
  --test src/**/*.test.ts"` (mirrored into preplan's package.json
  verbatim).
- `packages/registry/package.json:34` — `"tsx": "^4.15.7"` (mirrored
  exactly — no version bump).

---

## Quarantine state — do NOT disturb

All three pre-WP-056 stashes remain intact across WP-057 and MUST NOT be
popped during WP-058 execution:

- **`stash@{0}`** — `wp-055-quarantine-viewer` (registry viewer v1→v2).
- **`stash@{1}`** — WP-068 / MOVE_LOG_FORMAT governance edits.
- **`stash@{2}`** — pre-WP-062 dirty tree.

None overlap the anticipated WP-058 scope (`packages/preplan/` +
`pnpm-lock.yaml` if any devDep lands + governance docs).

---

## Inherited dirty-tree state — do NOT stage under WP-058

`git status --short` at WP-058 session start will show the following
items, all inherited from prior sessions and **none** in WP-058's
anticipated allowlist. Never `git add .` / `git add -A` / `git add -u`
(P6-27 / P6-44 / P6-50 discipline).

### Untracked files (carried across WP-056 + WP-057):

- `.claude/worktrees/` — parallel-session state from WP-081. Do NOT
  commit.
- `content/themes/heroes/` — test-time artifact observed during
  WP-057's `pnpm -r test` run (contains `black-widow.json` at
  ~1.9KB). Unrelated to WP-058 scope; do NOT stage. **Worth a
  separate hygiene WP** — some theme-validation test is emitting
  fixtures outside its tmpdir, which will keep regenerating on
  every test run. Not a WP-058 concern.
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

---

## Lessons learned from WP-057 (apply in WP-058)

Five concrete patterns surfaced during WP-057 execution that WP-058
should inherit without having to re-derive them:

### 1. Strict-tsconfig narrowing pattern (MANDATORY — saves a first-compile loop)

`packages/preplan/tsconfig.json:8-9` has both
`exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true`
(inherited from WP-056). The WP-057 session-prompt skeleton did NOT
account for these, and the first compile produced ~10 errors
(post-mortem §8.1 for the full list). WP-058 authors should write in
these patterns from the start:

- **Indexed array access returns `T | undefined`.** When the
  surrounding logic guarantees an element is present, use a
  destructured-guard:

  ```typescript
  const [first, ...rest] = arr;
  if (first === undefined) return null;  // or early-return handler
  // 'first' is now narrowed to T
  ```

  Or cast after an explicit length check:

  ```typescript
  if (arr.length === 0) return null;
  const first = arr[0] as T;  // safe — length check just happened
  ```

  Either pattern is acceptable; pick whichever reads cleaner at the
  site.

- **Fisher-Yates swap requires `as T` casts.** The idiomatic
  `const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;` fails because
  `arr[i]` is `T | undefined`. Use:

  ```typescript
  const atI = arr[i] as T;
  const atJ = arr[j] as T;
  arr[i] = atJ;
  arr[j] = atI;
  ```

- **Optional properties forbid explicit `undefined` assignment.**
  With `exactOptionalPropertyTypes: true`, `{ invalidationReason:
  undefined }` fails because `invalidationReason?: X` means *absent
  or X*, not *undefined or X*. **Omit the field from the object
  literal.** WP-058's `invalidatePrePlan` transition will set
  `invalidationReason` to a concrete `{ sourcePlayerId, effectType,
  effectDescription, affectedCardExtId? }` value — that's fine; the
  trap is only when writing `: undefined`.

- **`Record<string, T>` property access returns `T | undefined`.**
  `counters.attack` is `number | undefined` even when you "know" the
  key exists. Either use a fallback (`counters.attack ?? 0`) or
  destructure with a check.

### 2. Uniform failure-signaling convention (extend to WP-058 disruption operations)

WP-057 locked **null-on-inactive**: every speculative operation returns
`null` when `prePlan.status !== 'active'`. **Throws are reserved for
programming errors (internal invariant violations), never for expected
conditions.** This matches the engine's "moves never throw" pattern
extended to the non-authoritative layer.

WP-058's `invalidatePrePlan` is the inverse — it transitions plans
*out* of `'active'` — so its guard will be different (e.g., skip if
already invalidated). But the **convention carries**: expected
conditions (plan already invalidated, rewind target missing from
ledger, notification payload malformed) return `null` or a tagged
failure result, not throws.

`computeSourceRestoration` is the subtlest: it derives from
`revealLedger` exclusively. If the ledger is empty or the reveal
target is missing, **return an empty-restoration result, not throw**.
Throwing would crash the disruption pipeline mid-flight, which is
exactly the failure mode the null-on-inactive convention prevents.

### 3. Spread-copy discipline on every returned PrePlan field (42/42 pattern)

WP-057's post-mortem §6 aliasing trace confirmed **42 field assignments
across six mutation sites, all fresh**. The pattern:

```typescript
return {
  ...prePlan,
  revision: prePlan.revision + 1,
  sandboxState: {
    hand: [...prePlan.sandboxState.hand],       // fresh even if unchanged
    deck: [...prePlan.sandboxState.deck],       // fresh even if unchanged
    discard: [...prePlan.sandboxState.discard], // fresh even if unchanged
    inPlay: [...prePlan.sandboxState.inPlay],   // fresh even if unchanged
    counters: { ...prePlan.sandboxState.counters }, // fresh even if unchanged
  },
  revealLedger: [...prePlan.revealLedger],      // fresh even if unchanged
  planSteps: [...prePlan.planSteps],            // fresh even if unchanged
};
```

**Every field in the returned envelope is a fresh copy**, even when
that operation didn't modify it. The `...prePlan` top-level spread is
a safe shallow copy — but every array/object field inside must be
explicitly overwritten with a fresh copy on the next lines.

The session prompt's "✅ CORRECT" example used a partial
`{ ...prePlan.sandboxState, hand: [...] }` form that leaves unchanged
fields aliased. **That pattern is too loose.** Post-mortem §6 requires
every field to be fresh; the session prompt's example was illustrative,
not comprehensive. Follow the full-spread pattern above.

WP-058's `invalidatePrePlan` will produce a returned plan with a new
`status: 'invalidated'` and a new `invalidationReason: {...}`. The
same discipline applies — fresh arrays/objects for every field, even
`sandboxState` which doesn't semantically change on invalidation.

### 4. Canonical-array deferral pattern (now WP-058's first runtime consumer)

WP-056 deferred `PREPLAN_STATUS_VALUES` and `PREPLAN_EFFECT_TYPES`
canonical arrays to the "first runtime consumer" WPs. WP-057 picked
up `PREPLAN_STATUS_VALUES`; **WP-058 picks up `PREPLAN_EFFECT_TYPES`**.

The locked file-layout pattern (from `preplanStatus.ts`):

- **File:** `packages/preplan/src/preplanEffectTypes.ts` (new file,
  separate from `preplanStatus.ts`).
- **Contents:**
  1. Canonical readonly array:
     ```typescript
     export const PREPLAN_EFFECT_TYPES = ['discard', 'ko', 'gain', 'other'] as const;
     ```
  2. Derived union type:
     ```typescript
     export type PrePlanEffectType = typeof PREPLAN_EFFECT_TYPES[number];
     ```
  3. Compile-time exhaustive check matching the pattern at
     `preplanStatus.ts:27-33`:
     ```typescript
     type _EffectTypeDriftCheck = PrePlanEffectType extends
       NonNullable<PrePlan['invalidationReason']>['effectType']
       ? NonNullable<PrePlan['invalidationReason']>['effectType'] extends PrePlanEffectType
         ? true
         : never
       : never;
     const _effectTypeDriftProof: _EffectTypeDriftCheck = true;
     void _effectTypeDriftProof;
     ```
     Note: `NonNullable<>` is needed because `invalidationReason` is
     optional. Test this pattern compiles before committing to it.
  4. Required `// why:` comment at the `as const` matching the
     `preplanStatus.ts:12` style, citing the deferral from WP-056
     per EC-056 Locked Value line 32.

- **Test file:** `packages/preplan/src/preplanEffectTypes.test.ts`
  (new), 1 test in one `describe('preplan effect-type drift (WP-058)')`
  block performing runtime set-equality against the four literal
  values.

- **index.ts extension:** add
  ```typescript
  export { PREPLAN_EFFECT_TYPES } from './preplanEffectTypes.js';
  export type { PrePlanEffectType } from './preplanEffectTypes.js';
  ```
  as a new section matching the existing `PREPLAN_STATUS_VALUES`
  block.

### 5. Test wrapping convention (one `describe()` per file)

Each `*.test.ts` file in `packages/preplan/` wraps its tests in
**exactly one** top-level `describe('preplan <area> (WP-NNN)')` block.
Bare top-level `test()` calls are forbidden — they do not register as
suites under `node:test` (WP-031 precedent carried through WP-057).

This is how WP-057's preplan package gained `+4 suites`: four new
files, one `describe` each.

WP-058's test-count delta depends on this — suite counts are a hard
check at the 01.6 post-mortem §2 baseline table. If WP-058's session
prompt says "+N tests / +M suites", the M must equal the number of
new test files.

---

## Pre-flight locks carried forward (from WP-057)

These locks apply to `packages/preplan/` generally and should carry
into WP-058 without re-debate:

- **Commit prefix:** `EC-058:` on code-changing commits; `SPEC:` on
  governance / pre-flight / governance-close. **`WP-058:` forbidden**
  per P6-36 (commit-msg hook rejects).
- **Three-commit topology:** A0 `SPEC:` (pre-flight bundle) → A
  `EC-058:` (execution + 01.6 post-mortem) → B `SPEC:` (STATUS +
  WORK_INDEX + EC_INDEX close).
- **Allowlist staging by exact filename.** Never `git add .` /
  `git add -A` / `git add -u`. Never `--no-verify` / `--no-gpg-sign`.
- **P6-50 paraphrase discipline** in JSDoc: no `G`,
  `LegendaryGameState`, `LegendaryGame`, `boardgame.io` tokens in
  prose. The only permitted framework reference is `ctx.turn + 1`
  in the inherited WP-056 carve-out at `preplan.types.ts:21, :51`.
- **No `Math.random`, `ctx.random`, `require(`, `.reduce(` anywhere
  in `packages/preplan/`.** Use the PRNG helpers from
  `./speculativePrng.js` for any new speculative randomness (none
  should be needed in a disruption pipeline — `computeSourceRestoration`
  derives from `revealLedger` deterministically, and rewind
  reshuffling can re-use `createSpeculativePrng` with the original
  seed if the disruption logic retains it).
- **`Date.now()` permitted exactly once per WP in this package**
  (currently at `speculativePrng.ts:79`). WP-058 should NOT introduce
  a second. If a timestamp is genuinely needed, it should be
  caller-supplied, not read from the wall clock.
- **`preplan.types.ts` immutable across WP-058** — WP-056 output is
  still frozen. Any perceived need to add a field or modify JSDoc is
  scope creep; escalate via a pre-flight amendment per 01.4 §Scope-
  Neutral Mid-Execution Amendment.
- **No wiring into `game.ts`, `LegendaryGame.moves`, phase hooks, or
  any engine lifecycle point.** The engine does not know preplan
  exists (WP-028 lifecycle-prohibition precedent).
- **Inherited dirty-tree items untouched and not staged.** Same list
  as above.
- **Quarantine stashes `stash@{0..2}` intact and not popped.**

---

## Discipline precedents to read (inherited chain)

Before authoring WP-058's pre-flight, the executor should skim:

- `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` §Precedent Log —
  P6-22 (escaped-dot grep patterns), P6-27 (allowlist staging
  discipline), P6-36 (EC-NNN commit prefix hook), P6-42 (pre-commit
  review gatekeeper), P6-43 (JSDoc + grep collision), P6-44
  (lockfile scope), P6-50 (paraphrase discipline), P6-51
  (back-pointer patterns), WP-028 (lifecycle-prohibition +
  aliasing), WP-031 (suite-count discipline), and the emerging
  WP-057 patterns captured here.
- `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md` — declare
  **NOT INVOKED** in WP-058's session prompt per the same four
  criteria that applied to WP-057 (the preplan layer by
  construction cannot wire into engine lifecycle).
- `docs/ai/REFERENCE/01.6-post-mortem-checklist.md` — WP-058 will
  fire triggers for: new long-lived abstractions
  (`invalidatePrePlan`, `computeSourceRestoration`,
  `buildDisruptionNotification`, `PREPLAN_EFFECT_TYPES`) + first
  runtime consumer of `invalidationReason.effectType` closed union
  + first implementation of DESIGN-CONSTRAINT #3 "reveal ledger is
  sole rewind authority". §6 aliasing trace will be **mandatory
  again** — any returned `PrePlan` from `invalidatePrePlan` must
  follow the 42/42 full-spread pattern from WP-057.
- `docs/ai/REFERENCE/01.7-copilot-check.md` — mandatory 30-issue
  audit before finalizing the WP-058 session prompt.
- `docs/ai/DESIGN-PREPLANNING.md` + `DESIGN-CONSTRAINTS-PREPLANNING.md`
  — re-read constraints #4 (source restoration from ledger),
  #6 (notification causality), #7 (per-player disruption detection),
  #11 (rewind determinism), #12 (notification payload shape). These
  are WP-058's scope — WP-057 explicitly did NOT pull them forward.

---

## Anticipated WP-058 allowlist (for pre-flight reference, not binding)

Based on `WORK_INDEX.md:1324-1340` and WP-057 precedent, the WP-058
allowlist will likely include:

### New files

- `packages/preplan/src/preplanEffectTypes.ts` — canonical array +
  compile-time drift check (pattern from §Canonical-array deferral
  above).
- `packages/preplan/src/disruption.ts` — `PlayerAffectingMutation`
  type + `detectDisruption` helper (or split across
  `disruption.types.ts` + `disruption.detect.ts` at executor
  discretion).
- `packages/preplan/src/invalidatePrePlan.ts` — `'active' →
  'invalidated'` transition with causal reason.
- `packages/preplan/src/computeSourceRestoration.ts` — rewind derivation
  from `revealLedger` exclusively (DESIGN-CONSTRAINT #3 invariant).
- `packages/preplan/src/buildDisruptionNotification.ts` — structured
  causal message builder.
- Four or five `*.test.ts` files mirroring the implementation files,
  each wrapped in one `describe()` per §Test wrapping convention.
- `docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md` —
  mandatory post-mortem.

### Modified files

- `packages/preplan/src/index.ts` — additive exports for the new
  runtime surface.
- Possibly `packages/preplan/package.json` / `pnpm-lock.yaml` if a new
  devDep is needed (unlikely — `tsx` already there from WP-057).

### Governance close files (Commit B)

- `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
  `docs/ai/execution-checklists/EC_INDEX.md`.

The WP-058 pre-flight should lock the exact allowlist with file-count
and test-count numbers before the session prompt is finalized.

---

## Housekeeping items not blocking WP-058

Observed but unrelated:

- **`content/themes/heroes/black-widow.json`** — test-time artifact
  that surfaced during WP-057's `pnpm -r test` run. Likely a
  theme-validation test writing fixtures outside its tmpdir.
  **Separate hygiene WP** — not WP-058's concern.
- **Remote push** — three WP-057 commits
  (`f12c796` / `8a324f0` / `7414656`) sit locally on
  `wp-081-registry-build-pipeline-cleanup`. Push when ready; not a
  WP-058 prerequisite.
- **D-5701 optional entry** — WP-057 did not author a
  `DECISIONS.md` entry for the djb2 fingerprint choice or the LCG
  constants lock. JSDoc captures both adequately. If a future WP
  needs to reference either choice, a retrospective D-entry can be
  added then; it is not a WP-058 prerequisite.

---

**End of session context for WP-058.**

Author WP-058's pre-flight (`docs/ai/invocations/preflight-wp058-*.md`)
next, then the copilot check, then the session prompt. This context
document is the step-0 input to the WP-058 pre-flight per 01.6 §Workflow
Position.
