# Pre-Flight — WP-058 Pre-Plan Disruption Pipeline

**Template:** `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`
**Target Work Packet:** `WP-058` — Pre-Plan Disruption Pipeline (Detect → Invalidate → Rewind → Notify)
**Previous WP Status:** WP-057 complete — executed 2026-04-20 at commit `8a324f0` (governance close `7414656`; SPEC bundle `f12c796`)
**Pre-Flight Date:** 2026-04-20
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** **Infrastructure & Verification**
> Rationale: WP-058 introduces runtime logic (detection, invalidation, restoration derivation, notification construction, pipeline orchestration) inside `packages/preplan/` only. It does **not** mutate `G` in gameplay, does **not** wire into `game.ts`, does **not** add moves or phases, and does **not** import `boardgame.io`. All mutation is against the non-authoritative `PrePlan` object in `packages/preplan/`. Same classification as WP-057 — the Infrastructure & Verification class (01.4 §Pre-Flight Header).

Mandatory sections per class: Dependency Check, Input Data Traceability, Structural Readiness, Runtime Readiness, Dependency Contract Verification, Maintainability & Upgrade Readiness, Scope Lock, Test Expectations, Risk Review. Mutation Boundary Confirmation is skipped (no `G` mutation path exists in this layer).

---

## Pre-Flight Intent

Validate readiness, dependency contracts, scope lock, and risks for WP-058. Not implementing. Not generating code. Not authorizing the session execution prompt until pre-session actions listed below are resolved.

---

## Review Order & Authority

Per 01.4 §Review Order & Authority, review proceeded **EC → WP → invocation**.

- **EC-058** — **DOES NOT EXIST** at pre-flight time. `docs/ai/execution-checklists/` contains EC-055/EC-056/EC-057 at the preplan level but no EC-058. EC_INDEX.md has no EC-058 row. Since the EC is the primary authority for execution correctness under 01.4, the absence of EC-058 is captured as **PS-1 (blocking pre-session action)** below, mirroring WP-057's PS-1 precedent. A draft EC-058 must land (Commit A0) before the session execution prompt is generated.
- **WP-058** — `docs/ai/work-packets/WP-058-preplan-disruption-pipeline.md` read in full. Status line: "Ready for Implementation". Dependencies: WP-056, WP-057, WP-008B — all complete. Two drafting issues surface (PS-2, PS-3) requiring WP amendments before execution.
- **Invocation prompt** — not yet generated. Must match EC-058 + this pre-flight verbatim once authored.

---

## Authority Chain (Read)

1. `.claude/CLAUDE.md` — Execution Checklist rule, Prompt Lint Gate, File Modifications During Execution. ✅
2. `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative) lists `packages/preplan/**` as Pre-Planning (Non-Authoritative, Per-Client). Engine does not know preplan exists. ✅
3. `docs/03.1-DATA-SOURCES.md` — WP-058 consumes no external data inputs. `PlayerAffectingMutation` is produced by integration-layer adapters (out-of-scope for this WP); `RevealRecord` data comes from in-memory `PrePlan.revealLedger` populated during WP-057 operations. ✅
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — `preplan` category classified at line 43 and §Pre-Planning (lines 168-205) under D-5601 (Status: Immutable). Category rules forbid engine runtime imports, `boardgame.io`, registry, server, apps, `pg`, `Math.random`, `ctx.random.*`, `.reduce()`. All rules carry to WP-058. ✅
5. `docs/ai/execution-checklists/EC-058-*.checklist.md` — **MISSING (PS-1)**.
6. `docs/ai/work-packets/WP-058-preplan-disruption-pipeline.md` — read and analyzed; two drafting issues (PS-2, PS-3) identified.
7. References consumed:
   - `docs/ai/DESIGN-PREPLANNING.md §11` (disruption pipeline single-workflow constraint).
   - `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md` #3, #4, #6, #7, #9, #11, #12 (WP-058 scope — WP-057 explicitly deferred these).
   - `docs/ai/session-context/session-context-wp058.md` (full WP-057 baseline handoff + five lessons-learned patterns + PS-2 canonical-array detail).
   - `docs/ai/invocations/preflight-wp057-preplan-sandbox-execution.md` (template + precedent for Infrastructure & Verification pre-flight in this layer).
   - `docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md` (pattern template for EC-058).
   - `docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md` + `docs/ai/post-mortems/01.6-WP-057-preplan-sandbox-execution.md` (when available — §6 aliasing trace pattern is precedent for WP-058).
   - `packages/preplan/src/preplan.types.ts` (authoritative contract — immutable in WP-058).
   - `packages/preplan/src/preplanStatus.ts` (WP-057 canonical-array + drift-check pattern to replicate for `PREPLAN_EFFECT_TYPES`).
   - `packages/preplan/src/speculativeOperations.ts` (spread-copy discipline precedent — 42/42 pattern).
   - `packages/game-engine/src/index.ts:5` — `CardExtId` type export confirmed.

No higher-authority conflicts observed.

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-056 — Pre-Planning State Model & Lifecycle | ✅ complete (commit `eade2d0`, 2026-04-20) | Four types locked at `packages/preplan/src/preplan.types.ts`; `invalidationReason.effectType` closed union at line 108 is WP-058's first runtime consumer |
| WP-057 — Pre-Plan Sandbox Execution | ✅ complete (commit `8a324f0`, governance close `7414656`, 2026-04-20) | Ten runtime helpers + `PREPLAN_STATUS_VALUES` canonical array + drift test landed; preplan baseline at `23/4/0`; `PlayerStateSnapshot` type exported; spread-copy discipline established |
| WP-008B — Core moves implementation | ✅ complete | `drawCards`/`playCard`/`endTurn` locked in `CORE_MOVE_NAMES`; referenced by WP-058 §Dependencies but not directly consumed (engine remains unaware of preplan) |

**Foundation Prompts:** FP-00.4 / FP-00.5 / FP-01 / FP-02 all complete; no WP-058 dependencies on FP-established schema, migrations, or R2 data paths.

All prerequisites met — no dependency blocker.

**WP-058 review status:** WORK_INDEX.md:1324 reads `[ ] WP-058 — Pre-Plan Disruption Pipeline — pending ✅ Reviewed`. The `✅ Reviewed` legend marks design review complete, allowing execution; the `[ ]` empty-checkbox marks execution pending. This is the correct legend state per WORK_INDEX.md Review Status Legend.

---

## Dependency Contract Verification

Every type, field, signature, and line-number anchor that WP-058 consumes was verified against actual source, not against WP text alone.

- [x] **`PrePlan` type declaration** — exists at `packages/preplan/src/preplan.types.ts:29` (session-context-wp058 line 79 anchor confirmed). Exported from `packages/preplan/src/index.ts:6`. ✅
- [x] **`PrePlan.status` closed union** — `'active' | 'invalidated' | 'consumed'` at `preplan.types.ts:66`. WP-058 §C guards `status !== 'active'` (detection), WP-058 §D transitions `'active' → 'invalidated'`, WP-058 §F guards `status !== 'invalidated'` (notification). All three match the union literal values exactly. ✅
- [x] **`PrePlan.baseStateFingerprint` NON-GUARANTEE clause** — `preplan.types.ts:77` confirms "NON-GUARANTEE: The fingerprint is a divergence hint, not a correctness guarantee. It must never be used as a sole authority for invalidation." WP-058 correctly does NOT use fingerprint for detection — detection is binary per-player per §C. ✅
- [x] **`invalidationReason` optional field + closed `effectType`** — `preplan.types.ts:92-115` confirmed. Field is **optional** (`invalidationReason?: {...}`); `effectType: 'discard' | 'ko' | 'gain' | 'other'` at line 108 is the closed union WP-058 consumes. `effectType` is non-optional within the `invalidationReason` block; `affectedCardExtId` is optional (line 114 `affectedCardExtId?: CardExtId`). ✅
- [x] **`RevealRecord` rewind-authority invariant** — `preplan.types.ts:162-168` confirms "The reveal ledger is the sole authority for deterministic rewind. All rewinds must be derived exclusively from the revealLedger. Any rewind logic that inspects sandboxState directly is invalid." **WP-058 §E `computeSourceRestoration` reads only `revealLedger: readonly RevealRecord[]` — never `sandboxState` — matching the invariant.** ✅
- [x] **`RevealRecord.source` open union** — `preplan.types.ts:182-187` confirms `source: 'player-deck' | 'officer-stack' | 'sidekick-stack' | 'hq' | string`. WP-058 §E partitions on `record.source === 'player-deck'` vs "anything else" — correctly handles the open union by using the known-literal check as the discriminator and falling through all other string values into `sharedSourceReturns[record.source]`. No new literal values invented. ✅
- [x] **`RevealRecord.cardExtId`** — non-optional `CardExtId` at `preplan.types.ts:190`. WP-058 §E reads `record.cardExtId` unconditionally; safe. ✅
- [x] **`RevealRecord.revealIndex`** — monotonic number at `preplan.types.ts:193`. WP-058 §E does NOT depend on ordering — it partitions by source only. Ledger order-preservation is an emergent property of iterating `for (const record of revealLedger)`, not a contract WP-058 locks, but WP-058 Tests list "Reveal order is preserved within each source group" — the `for...of` iteration pattern satisfies it deterministically. ✅
- [x] **`CardExtId` import path** — `import type { CardExtId } from '@legendary-arena/game-engine';` is valid; confirmed at `packages/game-engine/src/index.ts:5` (re-export from `./types.js`). WP-058 §A, §B, §E use this exact import. **Only permitted engine reference** (as `import type`). ✅
- [x] **`PREPLAN_STATUS_VALUES` precedent available** — `packages/preplan/src/preplanStatus.ts` shipped in WP-057 provides the canonical-array + compile-time exhaustive-check pattern to replicate for `PREPLAN_EFFECT_TYPES` (see PS-2 below). ✅
- [x] **Spread-copy discipline precedent available** — `packages/preplan/src/speculativeOperations.ts:41-56` (`speculativeDraw` return) demonstrates the full 42/42 spread-copy pattern WP-058 §D `invalidatePrePlan` must follow. Session-context-wp058 §Lesson 3 locks this for WP-058. ✅
- [x] **`PrePlan.revision` increment discipline** — `preplan.types.ts:34-44` states revision "Increments on any mutation of sandboxState, revealLedger, or planSteps." **WP-058 `invalidatePrePlan` changes `status` + `invalidationReason` (neither of those three fields), so it MUST NOT increment revision.** WP-058 §D spec correctly omits `revision` increment. ✅
- [x] **No forbidden imports in WP-058's intended source** — WP-058 §A/§B imports `type { CardExtId } from '@legendary-arena/game-engine'` (type-only); §C imports `type { PrePlan, PlayerAffectingMutation }` (intra-package + type-only); §D/§E/§F/§G import only intra-package types + types. No `boardgame.io`, no runtime engine imports, no registry imports. Permitted under D-5601 rules. ✅
- [x] **No `.reduce()` implied by WP-058 algorithms** — §E uses explicit `for (const record of revealLedger)` with a mutable accumulator; no `.reduce()` call required. Tests partition by iteration, not reduction. Matches D-5601 + code-style rule + session-context §Pre-flight locks. ✅
- [x] **No `Math.random()` / `ctx.random.*` / `Date.now()` anywhere in WP-058** — No randomness is consumed in disruption detection, invalidation, rewind derivation, or notification construction. Session-context-wp058 line 106-108 confirms `speculativePrng.ts:79` is the sole `Date.now()` in the package; WP-058 must not introduce a second. ✅
- [x] **Handler/data separation** — No data stored in returned envelopes is a function, Map, Set, or class instance. All operations return plain objects. `DisruptionPipelineResult.requiresImmediateNotification: true` is a literal type, not a runtime construct. ✅
- [x] **Persistence classification** — `PrePlan` + all WP-058 outputs are non-authoritative runtime state, never persisted. WP-058 introduces no new `G` field (the engine does not know pre-planning exists). No ARCHITECTURE.md §3 entry required. ✅
- [x] **Immutable files untouched** — `packages/preplan/src/preplan.types.ts` is immutable across WP-058 (session-context-wp058 line 406). `packages/preplan/src/preplanStatus.ts` is immutable (WP-057 output). WP-057's ten runtime helpers at `speculativePrng.ts` / `preplanSandbox.ts` / `speculativeOperations.ts` are immutable. `packages/preplan/src/index.ts` is modified additively only. ✅
- [x] **Functions WP-058 calls are actually available** — WP-058 defines its own functions (`isPrePlanDisrupted`, `invalidatePrePlan`, `computeSourceRestoration`, `buildDisruptionNotification`, `executeDisruptionPipeline`, internal `buildNotificationMessage`) — no external runtime dependency beyond types. ✅
- [x] **Move classification** — WP-058 adds **zero** moves. `CoreMoveName` / `CORE_MOVE_NAMES` untouched. ✅
- [x] **Field paths in G** — WP-058 touches no `G` field. `PlayerAffectingMutation` is a **caller-supplied input** produced by integration-layer adapters; WP-058 does not read `G` or any engine state directly. ✅
- [x] **`exactOptionalPropertyTypes` compatibility** — `packages/preplan/tsconfig.json:8` enables `exactOptionalPropertyTypes: true`. WP-058 §D builds `invalidationReason: { ..., affectedCardExtId: mutation.affectedCardExtId }` and §F builds `{ ..., affectedCardExtId: mutation.affectedCardExtId }` where `mutation.affectedCardExtId` is `CardExtId | undefined`. **Under `exactOptionalPropertyTypes: true`, assigning `undefined` to an `affectedCardExtId?: CardExtId` field fails typecheck** (session-context-wp058 Lesson 1). Executor must use the conditional-assignment pattern (build base object; assign `affectedCardExtId` in an `if (mutation.affectedCardExtId !== undefined)` block). **Locked as RS-4 below.** ⚠️ (conditional)
- [x] **`noUncheckedIndexedAccess` compatibility** — same tsconfig line 9. WP-058 §E `sharedSourceReturns[record.source]` reads a `Record<string, CardExtId[]>` entry that may be `undefined` — but §E guards with `if (!sharedSourceReturns[record.source]) { ...create [] }` before pushing, so the access is safe. ✅
- [x] **WP file paths verified against actual filesystem** — All six WP-058 implementation files land in `packages/preplan/src/`, which exists. `packages/preplan/src/index.ts` already exists and exports WP-056+WP-057 surface. All six `*.ts` / `*.test.ts` target names (`disruption.types.ts`, `disruptionDetection.ts`, `disruptionPipeline.ts`, `disruptionDetection.test.ts`, `disruptionPipeline.test.ts`) are new — no collision. ✅
- [x] **WP file paths verified against code category rules** — `packages/preplan/src/**` is classified under D-5601 (Immutable). All eight WP-058 files (six from WP spec + two from PS-2 `preplanEffectTypes.ts` + `preplanEffectTypes.test.ts`) fall within the classified directory. No new directory introduced. ✅
- [x] **WP gating assumptions verified** — WP-058 §Dependencies and §Architectural Placement assertions are all true against actual code. DESIGN-PREPLANNING §11 single-workflow constraint respected (detection/invalidation/restoration/notification shipped together, not split into sub-WPs). ✅
- [x] **Multiple mutations per move** — WP-058 §Architectural Placement lines 120-125 locks the "first-mutation-wins" semantics: subsequent mutations for the same waiting player return from `isPrePlanDisrupted` as `false` because `status !== 'active'` after the first invalidation. **This is enforced mechanically by the status guard in `isPrePlanDisrupted` (§C line 236) + `invalidatePrePlan` (§D line 274) — no caller dedup logic required.** ✅
- [x] **Decision ID references** — WP-058 text does not reference any specific D-NNNN entry. Governance bullet list at §Governance (lines 671-686) describes new decisions to author in `DECISIONS.md`; IDs assigned at execution time (likely `D-5801`-family). ✅
- [x] **Projection aliasing** — `invalidatePrePlan` returns a new `PrePlan` envelope. `computeSourceRestoration` returns a new `{ playerDeckReturns, sharedSourceReturns }` object with fresh arrays. `buildDisruptionNotification` returns a new `DisruptionNotification` object. `executeDisruptionPipeline` returns a new `DisruptionPipelineResult`. **RS-3 locks the full-spread discipline** (mirroring WP-057 §6 post-mortem) so every field in the returned envelopes is a fresh copy, even `sandboxState` / `revealLedger` / `planSteps` that are semantically unchanged by invalidation.
- [x] **Filter/consumer input type completeness** — `PlayerAffectingMutation` (§A) carries `sourcePlayerId` + `affectedPlayerId` + `effectType` + `effectDescription` + optional `affectedCardExtId`. All are derivable by integration-layer adapters from engine state; WP-058 does not assume upstream producer modification. ✅

**Findings:** All contract verifications pass in substance. Two drafting corrections required (PS-2 canonical-array scope gap; PS-3 type-file layout inconsistency at §H). One type-system pattern locked (RS-4 conditional-assignment for optional `affectedCardExtId`).

---

## Input Data Traceability Check

- [x] All non-user-generated inputs consumed by this WP are listed in `docs/03.1-DATA-SOURCES.md` — **YES**. WP-058 consumes only `PlayerAffectingMutation` (caller-supplied from integration-layer adapters) and `PrePlan` state (in-memory, produced by WP-057 `createPrePlan`). Neither is an "external dataset" per 03.1.
- [x] Storage location known — In-memory only for `PrePlan`; `PlayerAffectingMutation` is a transient function parameter.
- [x] Data sources to inspect on incorrect behavior — Integration-layer adapter code (future WP-059+) + `packages/preplan/src/disruption*.ts` test fixtures.
- [x] No implicit hardcoded literals originating from external datasets.
- [x] **Setup-Time Derived Data update needed?** — No. Preplan state is not a setup-time derived field of `G`.

All YES. No unacceptable maintenance risk.

---

## Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — verified `2026-04-20`: preplan `23/4/0`, engine `436/109/0`, registry `13/2/0`, vue-sfc-loader `11/0/0`, server `6/2/0`, replay-producer `4/2/0`, arena-client `66/0/0`. **Repo-wide: 559 passing / 0 failing at HEAD `7414656`** (matches session-context baseline exactly).
- [x] No known EC violations open.
- [x] Required types/contracts exist — `PrePlan`, `invalidationReason.effectType`, `RevealRecord`, `CardExtId`, `PREPLAN_STATUS_VALUES` all exported.
- [x] No naming or ownership conflicts — `disruption.types.ts`, `disruptionDetection.ts`, `disruptionPipeline.ts`, `preplanEffectTypes.ts` do not exist; no collision.
- [x] No architectural boundary conflicts anticipated at the contract level — all new code stays in `packages/preplan/src/`.
- [x] Migrations idempotent — N/A (no DB touch).
- [x] R2 data — N/A.
- [x] G field subfields — N/A (no G read).

All YES.

---

## Runtime Readiness Check (Mutation & Framework)

Infrastructure & Verification class requires this section.

- [x] Expected runtime touchpoints are known — **None in the engine.** WP-058 introduces runtime code inside `packages/preplan/` only; it is consumed by future integration/UI WPs, not by the engine lifecycle.
- [x] Framework context requirements — WP-058 does **not** use `ctx.events.*` or `ctx.random.*` or `G`. No `boardgame.io` import. No `ctx` exists in this layer.
- [x] Existing test infrastructure — `node:test` + `tsx` pattern already established by WP-057 at `packages/preplan/package.json:16` (`"test": "node --import tsx --test src/**/*.test.ts"`). No package.json modification needed — the glob already picks up new `*.test.ts` files.
- [x] 01.5 runtime wiring allowance — **NOT INVOKED**. None of the four 01.5 trigger criteria apply:
    - No new field added to `LegendaryGameState` (no engine file modified).
    - No shape change to `buildInitialGameState` (engine untouched).
    - No new move added to `LegendaryGame.moves`.
    - No new phase hook.
  The session prompt must declare **01.5 NOT INVOKED** explicitly per WP-030 / WP-055 / WP-056 / WP-057 precedent.
- [x] No architecture boundary violations expected.
- [x] Integration point code read — N/A (no engine integration in this WP).
- [x] Stage gating — N/A (not a move).
- [x] Multi-step mutations — `executeDisruptionPipeline` chains invalidate → compute restoration → build notification. Ordering: (1) invalidate (status guard short-circuits null); (2) read `prePlan.revealLedger` (original pre-invalidation ledger — correct because invalidation does not mutate ledger); (3) build notification from `invalidatedPlan`. **No in-place mutation and no "source removed before destination confirmed" hazard** because the work happens in derived copies.
- [x] Registry data flow — N/A.
- [x] Phase transition ordering / simultaneous conditions — N/A.
- [x] Degradation path for unknown/unsupported — `invalidatePrePlan`, `executeDisruptionPipeline` return `null` on non-active status; `isPrePlanDisrupted` returns `false` on null plan or non-active plan; `computeSourceRestoration` returns `{ playerDeckReturns: [], sharedSourceReturns: {} }` on empty ledger (never throws). `buildDisruptionNotification` THROWS on `status !== 'invalidated'` — **this is a programming-error throw** (the only expected caller is `executeDisruptionPipeline`, which has just produced the invalidated plan), matching the WP-057 convention "throws reserved for programming errors" (session-context Lesson 2).
- [x] Move functions outside framework context — N/A.
- [x] Mock/PRNG capability check — no PRNG consumed in WP-058.

All YES.

---

## Established Patterns to Follow (Locked Precedents)

The following 01.4 Established Patterns apply to WP-058:

- **Pure helper functions return new values** (D-1233 two-step pattern) — every WP-058 function returns a new object, never mutates.
- **Local structural interfaces** (WP-022/027/028 pattern) — `PlayerAffectingMutation` and `DisruptionNotification` are WP-058-local types; not re-exported from `@legendary-arena/game-engine`; do not import `Ctx`.
- **Failure signaling by `null`, not throw** (WP-057 precedent, session-context Lesson 2) — all runtime functions except `buildDisruptionNotification` return `null` on expected failure paths. `buildDisruptionNotification` throws only on programming-error input (caller passed a non-invalidated plan).
- **Open unions respected** (WP-056 precedent) — `RevealRecord.source` remains open; WP-058 §E partitions correctly on the known-literal discriminator.
- **Canonical readonly array + drift-detection test for closed unions** (WP-007A/009A/014A/021/057 precedent) — `invalidationReason.effectType` is closed (`'discard' | 'ko' | 'gain' | 'other'`). Per `preplan.types.ts:101-108` JSDoc + session-context-wp058 line 311-360, the `PREPLAN_EFFECT_TYPES` canonical array + drift-detection test are **deferred to WP-058**. **WP-058 spec omits this scope** — captured as **PS-2** below (mirrors WP-057's PS-2 for `PREPLAN_STATUS_VALUES`).
- **Spread-copy discipline on every returned envelope field** (WP-057 post-mortem §6, 42/42 pattern; session-context Lesson 3) — `invalidatePrePlan` must return a `PrePlan` where **every** field (`sandboxState.hand` / `deck` / `discard` / `inPlay` / `counters`, `revealLedger`, `planSteps`) is a fresh copy, even if semantically unchanged by invalidation. RS-3 locks this.
- **Three-commit topology** (WP-034/035/042/055/056/057 precedent) — Commit A0 `SPEC:` (EC-058 + WP-058 PS-2/PS-3 amendments + this pre-flight) → Commit A `EC-058:` (execution: 8 files + 01.6 post-mortem + any D-entries) → Commit B `SPEC:` (WORK_INDEX + STATUS + EC_INDEX governance close). Commit prefix `WP-058:` is **forbidden** (P6-36).
- **P6-50 paraphrase discipline** — JSDoc in new preplan files must not reference engine runtime concepts by name (`G`, `ctx`, `LegendaryGameState`, `LegendaryGame`, `boardgame.io`). The only permitted framework reference inherited from WP-056 is the `ctx.turn + 1` invariant in `preplan.types.ts:21, :51` — WP-058 must not extend this carve-out. A JSDoc grep gate must be included in Verification Steps, using escaped patterns (`boardgame\.io`, `\\bG\\b`, `\\bctx\\b`) per P6-22 precedent.
- **`// why:` comment requirements** — mandatory on:
  - Every guard that short-circuits with `null` (e.g., `isPrePlanDisrupted` null/non-active checks, `invalidatePrePlan` non-active check).
  - The throw in `buildDisruptionNotification` (programming-error rationale).
  - The spread-copy discipline at the first occurrence in `invalidatePrePlan`.
  - The `requiresImmediateNotification: true` literal (encodes Constraint #7 in the type system).
  - The `as const` on `PREPLAN_EFFECT_TYPES` (deferral rationale from WP-056 per preplan.types.ts:101-106).
  - The for-loop in `computeSourceRestoration` citing DESIGN-CONSTRAINT #3 (reveal ledger is sole rewind authority).
- **Fail-closed configuration / additionalProperties: false** — N/A (no schema).
- **Setup-only wiring scope** — N/A (no G mutation; no lifecycle wiring).

No deviations proposed.

---

## Maintainability & Upgrade Readiness

- [x] **Extension seam exists** — `RevealRecord.source` is open (new shared sources add without union refactor). `PREPLAN_EFFECT_TYPES` canonical array (to be added per PS-2) is the extension seam for future effect categories; drift test guards parity. `PlayerAffectingMutation.effectType` closed union is the extensibility gate for all future disruption categories.
- [x] **Patch locality** — Detection bugs localized to `disruptionDetection.ts`; invalidation bugs to `invalidatePrePlan` inside `disruptionPipeline.ts`; restoration bugs to `computeSourceRestoration` inside `disruptionPipeline.ts`; notification bugs to `buildDisruptionNotification` + `buildNotificationMessage` inside `disruptionPipeline.ts`. Single-behavior bugs touch one file.
- [x] **Fail-safe behavior** — All non-active paths return `null` (detection/invalidation/pipeline) or `false` (detection). Empty ledger produces empty restoration. `buildDisruptionNotification` throws only on programming error (caller bug). No partial mutation.
- [x] **Deterministic reconstructability** — Detection is binary (`playerId === affectedPlayerId` + status check). Invalidation is deterministic (status transition + invalidationReason capture). Restoration is deterministic (iterate ledger, partition by source). Notification is deterministic (string concatenation from mutation). All pure functions.
- [x] **Backward-compatible test surface** — No existing test touches WP-058 code (it is all new). All 559 existing tests must continue to pass; WP-058 adds new tests only. No test mock modifications.
- [x] **Semantic naming stability** — `isPrePlanDisrupted`, `invalidatePrePlan`, `computeSourceRestoration`, `buildDisruptionNotification`, `executeDisruptionPipeline` — none encode MVP-only assumptions (no `Simple`, `Temp`, `V1`, `Inline`). Names are full English words (no abbreviations) per `00.6-code-style.md` Rule 4.

All YES. Design is maintainable.

---

## Code Category Boundary Check

- [x] All new or modified files fall cleanly into the `preplan` code category (`packages/preplan/src/**`, D-5601 Status: Immutable).
- [x] Each file's category permits all imports it uses — Node built-ins + `import type` from `@legendary-arena/game-engine` + intra-package relative imports. No forbidden imports.
- [x] No file blurs category boundaries — zero `boardgame.io`, zero runtime engine import, zero registry import, zero server import.
- [x] No new directory introduced. D-5601 already classifies `packages/preplan/`; no new D-entry required for file placement.

No boundary violations.

---

## Scope Lock (Critical)

### WP-058 Is Allowed To

- Create: `packages/preplan/src/disruption.types.ts` — type-only (Node built-ins + `import type { CardExtId }`). Exports `PlayerAffectingMutation` + `DisruptionNotification`. **PS-3 locks additional exports here:** `SourceRestoration` + `DisruptionPipelineResult` (currently declared in `disruptionPipeline.ts` per WP-058 §E/§G but re-exported from `./disruption.types.js` per §H — inconsistent; resolve by consolidating all four types in `disruption.types.ts`).
- Create: `packages/preplan/src/disruptionDetection.ts` — pure helper: `isPrePlanDisrupted(prePlan: PrePlan | null, mutation: PlayerAffectingMutation): boolean`.
- Create: `packages/preplan/src/disruptionPipeline.ts` — pure helpers: `invalidatePrePlan`, `computeSourceRestoration`, `buildDisruptionNotification`, internal `buildNotificationMessage`, `executeDisruptionPipeline`.
- Create: `packages/preplan/src/preplanEffectTypes.ts` — **NEW (PS-2)** — canonical readonly array `PREPLAN_EFFECT_TYPES = ['discard', 'ko', 'gain', 'other'] as const;` + derived `PrePlanEffectType` union + compile-time drift check (pattern from `preplanStatus.ts:25-31` using `NonNullable<PrePlan['invalidationReason']>['effectType']` because `invalidationReason` is optional) + required `// why:` comment citing deferral from WP-056 `preplan.types.ts:101-106` JSDoc.
- Create: `packages/preplan/src/disruptionDetection.test.ts` — detection tests (5 tests per WP-058 §I).
- Create: `packages/preplan/src/disruptionPipeline.test.ts` — invalidation + source restoration + notification + full pipeline + acceptance scenario tests (invalidation 4 + restoration 5 + notification 5 + full pipeline 7 + acceptance 1 = ~22 tests; final count locked in EC-058 after executor decides on parameterized-test aggregation per WP-057 Test 12/13 precedent).
- Create: `packages/preplan/src/preplanEffectTypes.test.ts` — **NEW (PS-2)** — 1 test in one `describe('preplan effect-type drift (WP-058)')` block (runtime set-equality against `{'discard', 'ko', 'gain', 'other'}`).
- Modify: `packages/preplan/src/index.ts` — add additive exports per WP-058 §H (plus PS-2 `PREPLAN_EFFECT_TYPES` + `PrePlanEffectType` per WP-057 precedent pattern).
- Update: `docs/ai/DECISIONS.md` per WP-058 §Governance (five bullet points from lines 671-686). Authored as a new `### D-5801` entry (or grouped D-5801/5802/5803) at execution author discretion; `DECISIONS_INDEX.md` row mandatory for every new D-entry.
- Update: `docs/ai/work-packets/WORK_INDEX.md` — mark WP-058 `[x]` with date + commit hash (Commit B).
- Update: `docs/ai/STATUS.md` — WP-058 status bump (Commit B).
- Update: `docs/ai/execution-checklists/EC_INDEX.md` — add EC-058 row (Commit A0) and flip Draft → Done (Commit B).
- Produce: `docs/ai/post-mortems/01.6-WP-058-preplan-disruption-pipeline.md` — MANDATORY 10-section audit staged into Commit A.

### WP-058 Is Explicitly Not Allowed To

- Modify `packages/preplan/src/preplan.types.ts` — immutable per WP-056 EC-056 Locked Value. Any perceived need to add a field is scope creep; stop and escalate.
- Modify `packages/preplan/src/preplanStatus.ts` — immutable per WP-057 output.
- Modify `packages/preplan/src/speculativePrng.ts` / `preplanSandbox.ts` / `speculativeOperations.ts` — immutable per WP-057 output.
- Modify `packages/preplan/package.json` — no new devDep needed (`tsx` already present from WP-057 PS-3); the `"test"` glob `src/**/*.test.ts` already picks up new test files.
- Modify `pnpm-lock.yaml` — no devDep delta anticipated; if one surfaces, it is a P6-44 tripwire — stop and investigate.
- Import `boardgame.io` anywhere in `packages/preplan/`.
- Import runtime values from `@legendary-arena/game-engine` (type-only imports are permitted; `import { foo }` is forbidden).
- Import `@legendary-arena/registry`, `pg`, or anything from `apps/**`.
- Use `Math.random()`, `ctx.random.*`, or `Date.now()` anywhere (tests included). WP-058 consumes no randomness.
- Use `.reduce()` — code-style invariant extends to preplan; §E uses explicit `for...of`.
- Add any new move to `LegendaryGame.moves` / expand `CORE_MOVE_NAMES` / add any phase hook — 01.5 NOT INVOKED.
- Write anything to engine `G` — there is no access path and none must be invented.
- Add a second `PREPLAN_EFFECT_TYPES` drift-detection test or widen the scope beyond a single set-equality assertion — WP-057 pattern uses one drift test.
- Touch any file outside the eight-file allowlist above + governance files + post-mortem.
- Use `git add .` / `git add -A`; stage files by exact name only (P6-27 / P6-44).
- Use `--no-verify`, `--no-gpg-sign`, or bypass any hook.
- Commit under the `WP-058:` prefix — forbidden (P6-36). Use `EC-058:` for execution commit and `SPEC:` for pre-flight bundle / governance close.
- Modify the inherited dirty-tree items listed in `session-context-wp058.md` lines 162-190 (untracked files + `.claude/worktrees/` + the one modified `session-wp079-*.md` file). Leave them untouched.
- Pop quarantine stashes `stash@{0}` / `stash@{1}` / `stash@{2}`.

**Rule:** Anything not explicitly allowed is out of scope.

---

## Test Expectations (Locked Before Execution)

- **Preplan package new tests (target — final count locked in EC-058):**
  - `disruptionDetection.test.ts` — **5 tests** in one `describe('preplan disruption detection (WP-058)')` block (mutation affects plan owner; mutation affects different player; null plan; already-invalidated plan; already-consumed plan).
  - `disruptionPipeline.test.ts` — **~22 tests** in one `describe('preplan disruption pipeline (WP-058)')` block. WP-058 §I lists: invalidation 4, source restoration 5, notification 5, full pipeline 7, acceptance scenario 1 = 22. Executor may parameterize (per WP-057 Tests 12/13 precedent) to reduce count, but the 22-bullet coverage is the EC-058 floor. EC-058 should lock exact count after the session-prompt author applies parameterization judgment.
  - `preplanEffectTypes.test.ts` — **1 test** in one `describe('preplan effect-type drift (WP-058)')` block (PS-2).
  - **Total target: ~28 new tests in 3 new suites** in the preplan package. EC-058 will lock exact counts.
- **Preplan baseline shift (target):** `23 / 4 / 0` → **~`51 / 7 / 0`** for `@legendary-arena/preplan` (3 new suites + ~28 new tests; exact lock in EC-058).
- **Repo-wide baseline shift (target):** `559 / 0` → **~`587 / 0`**.
- **Engine package baseline:** `436 / 109 / 0` **MUST REMAIN UNCHANGED**.
- **All other package baselines:** UNCHANGED (registry 13/2, vue-sfc-loader 11/0, server 6/2, replay-producer 4/2, arena-client 66/0).
- **Existing test changes:** None expected. No 01.5 allowance invoked; no assertion value edits authorized.
- **Defensive guards:** None required — no existing test mock touches WP-058 code.
- **Test boundaries:**
  - Test files must use `node:test` + `node:assert`. No `boardgame.io/testing`. No `Math.random()`. No `Date.now()`. No wall-clock-sensitive assertions.
  - Tests must **NOT** modify `packages/game-engine/src/`, `packages/registry/src/`, or any other package.
  - Tests must include at least one assertion proving `invalidatePrePlan` does NOT increment `revision` (since `status` is not one of the three revision-bumping fields per `preplan.types.ts:36-38`).
  - Tests must include at least one assertion proving `computeSourceRestoration` reads only from `revealLedger` (not from `sandboxState`) — e.g., a ledger with cards that are NOT in the sandbox hand/deck still produces those cards in the restoration result.
  - Tests must include at least one full-pipeline acceptance assertion: create → draw speculatively → execute disruption → verify invalidated plan + restoration + notification (WP-058 §I Acceptance scenario).

**Suite-wrapping convention (WP-031 / WP-057 precedent):** Each new test file wraps its tests in exactly one `describe()` block. Bare top-level `test()` calls are forbidden. The 3-suite increment is locked by this convention.

---

## Mutation Boundary Confirmation

**Skipped** — WP-058 is Infrastructure & Verification class. Behavior / State Mutation section applies only to WPs that mutate `G`. WP-058 mutates only its own returned envelopes (fresh objects, not input mutation); the equivalent discipline (pure functions, return new, no mutation) is locked in §Scope Lock + §Maintainability above + RS-3 below.

---

## Risk & Ambiguity Review

| # | Risk / Ambiguity | Impact | Mitigation | Decision / Pattern |
|---|---|---|---|---|
| RS-1 | `PREPLAN_EFFECT_TYPES` canonical readonly array + drift-detection test deferred by WP-056 (`preplan.types.ts:101-106` JSDoc) to the first runtime consumer (WP-058), but WP-058's Scope (In) section doesn't include them. | HIGH — drift-detection pattern is a project-wide invariant per 01.4 Established Patterns. Missing it regresses the WP-007A/009A/014A/021/057 precedent. | Add new files `preplanEffectTypes.ts` + `preplanEffectTypes.test.ts` to the WP-058 allowlist. EC-058 must include "add canonical array + drift test" as a locked Required Implementation Task. Pattern mirrors WP-057 `preplanStatus.ts` exactly with `NonNullable<>` accommodation for the optional `invalidationReason`. | **Locked: add as PS-2 action.** Files added to §Scope Lock above. One new test file, one new source file, two new `index.ts` exports. |
| RS-2 | WP-058 §H (line 513-518) exports `SourceRestoration` + `DisruptionPipelineResult` from `./disruption.types.js`, but §E (line 322-331) declares `SourceRestoration` inside `disruptionPipeline.ts` and §G (line 447-466) declares `DisruptionPipelineResult` inside `disruptionPipeline.ts`. | MEDIUM — drafting inconsistency. A reviewer reading §H alone will expect all four types in `disruption.types.ts`; an executor reading §E/§G alone will co-locate types with implementations. Without resolution, the file layout is ambiguous. | Lock resolution: **consolidate all four types (`PlayerAffectingMutation`, `DisruptionNotification`, `SourceRestoration`, `DisruptionPipelineResult`) in `disruption.types.ts`**. `disruptionPipeline.ts` imports them via `import type`. Matches the convention of types-in-`*.types.ts`-files (00.6 Rule §Types in dedicated files) and the §H export-path claim. WP-058 §E/§G code skeletons remain unchanged; only the type declaration site moves. | **Locked: add as PS-3 action — WP-058 §E/§G/§H amendment.** Type declarations move to `disruption.types.ts`; implementation files import them. No signature changes. |
| RS-3 | WP-058 §D `invalidatePrePlan` skeleton uses `{ ...prePlan, status: 'invalidated', invalidationReason: {...} }` — a partial spread that leaves `sandboxState` / `revealLedger` / `planSteps` aliased to the input. Per WP-057 post-mortem §6 (42/42 full-spread pattern) + session-context-wp058 Lesson 3, this discipline is **too loose**. | MEDIUM — aliasing bug; standard `JSON.stringify` equality tests cannot detect it. Matches the WP-028 aliasing precedent + WP-057 post-mortem §6 finding. | Lock the full-spread discipline: every returned `PrePlan` from `invalidatePrePlan` must carry fresh `sandboxState` (including nested `hand` / `deck` / `discard` / `inPlay` / `counters` spreads), `revealLedger` (fresh array), and `planSteps` (fresh array), even though invalidation does not semantically change them. Mirror the 42/42 pattern from `speculativeOperations.ts:47-56`. Tests include a "input not mutated" assertion after invalidation. 01.6 post-mortem §6 aliasing trace is MANDATORY. | **Locked: full-spread discipline enforced at code + test + post-mortem levels. 01.6 §6 mandatory. WP-057 precedent carried forward verbatim.** |
| RS-4 | `PlayerAffectingMutation.affectedCardExtId?: CardExtId` is optional. WP-058 §D assigns `invalidationReason: { ..., affectedCardExtId: mutation.affectedCardExtId }` and §F assigns `{ ..., affectedCardExtId: mutation.affectedCardExtId }` — both fail under `exactOptionalPropertyTypes: true` when `mutation.affectedCardExtId === undefined` (session-context-wp058 Lesson 1). | MEDIUM — first-compile failure; the WP skeleton will not compile as written on a strict tsconfig. | Lock the conditional-assignment pattern: build the base object without `affectedCardExtId`, then assign in an `if (mutation.affectedCardExtId !== undefined)` block. Matches D-2901 `preserveHandCards` precedent (WP-029) and session-context-wp058 Lesson 1. EC-058 Required Implementation Task. Tests cover both branches (with card + without card). | **Locked: conditional-assignment pattern at two sites (`invalidatePrePlan` `invalidationReason.affectedCardExtId`, `buildDisruptionNotification` return `affectedCardExtId`). Test coverage: 2 of the 5 notification tests already cover with/without card per WP-058 §I.** |
| RS-5 | `buildDisruptionNotification` THROWS on `status !== 'invalidated'` (WP-058 §F lines 398-403). This is the ONLY throw in the preplan package beyond programming-error cases. | LOW — correctly classified as a programming-error throw (the only expected caller, `executeDisruptionPipeline`, has just produced the invalidated plan one line earlier). Matches session-context-wp058 Lesson 2 "throws reserved for programming errors". | Lock the throw as the ONLY expected-path exception in WP-058. Required `// why:` comment: "programming-error throw — `executeDisruptionPipeline` is the only expected caller and always passes an invalidated plan; any other caller is misusing the API". Tests include one "throws on non-invalidated plan" assertion. | **Locked: single documented throw at `buildDisruptionNotification`; `// why:` comment required; test asserts the throw.** |
| RS-6 | P6-50 paraphrase discipline — JSDoc in new preplan files must not reference engine runtime concepts by name. WP-058 spec text uses `RuleEffect`-adjacent vocabulary but does NOT mention `G`, `LegendaryGameState`, `LegendaryGame`, or `boardgame.io`. | LOW | Verification gate: `git grep -nE "\\b(LegendaryGameState|LegendaryGame)\\b" packages/preplan/src/` and `git grep -nE "boardgame\\.io" packages/preplan/src/` must return zero hits in new files. Use escaped patterns per WP-031 P6-22 precedent. `ctx` is **permitted** only in the inherited `ctx.turn + 1` invariant reference at `preplan.types.ts` (immutable); any new `ctx` reference in WP-058 new files is a violation. | **Locked: verification greps with escaped patterns. Include `git grep -nE "\\bG\\b" packages/preplan/src/` expecting zero hits (letter-`G`-as-engine-state forbidden).** |
| RS-7 | `Date.now` defense-in-depth grep (WP-057 copilot-check HOLD Finding 2) expects exactly one hit at `speculativePrng.ts:generateSpeculativeSeed`. WP-058 must not introduce a second. | LOW | Carry forward the WP-057 gate: `git grep -nE "Date\\.now" packages/preplan/src/` must return **exactly one hit** at `speculativePrng.ts`. Any additional hit is an unauthorized wall-clock read. | **Locked: EC-058 After Completing replicates WP-057's `Date.now` grep gate verbatim.** |
| RS-8 | WP-058 §G `executeDisruptionPipeline` passes `prePlan.revealLedger` (not `invalidatedPlan.revealLedger`) to `computeSourceRestoration` (line 491). | LOW — semantically equivalent because invalidation does not mutate `revealLedger`, but the choice is not self-evident from the spec. | Lock rationale in a `// why:` comment at line 491: "invalidation does not mutate the ledger; reading from the pre-invalidation plan is equivalent and avoids depending on invalidatePrePlan's spread-copy semantics". Tests include an assertion that restoration is equivalent regardless of which plan the ledger is read from. | **Locked: `// why:` comment + equivalence assertion in pipeline test.** |
| RS-9 | `computeSourceRestoration`'s partition on `record.source === 'player-deck'` correctly handles the known literal, but any future expansion of known literals in `RevealRecord.source` (e.g., adding `'city-hq'`) would require updating the partition. | LOW | Lock the open-union semantics: any source other than `'player-deck'` goes to `sharedSourceReturns[record.source]`. Future WPs may introduce new known literals; the fall-through `else` branch handles them correctly as shared sources by default. If a future effect needs player-deck-like semantics for a new source, that is a future WP's concern, not WP-058's. | **Locked: single known-literal partition is correct; future expansion is intentional extension seam.** |
| RS-10 | Multiple mutations per move (WP-058 §Architectural Placement lines 120-125) — the first-mutation-wins semantics is enforced mechanically by `isPrePlanDisrupted` returning `false` on non-active plans. | LOW — test-enforceable. | Lock: WP-058 §I full-pipeline test "Multiple mutations for same player: first produces result, second returns null (plan already invalidated by status guard)" covers this mechanically. `executeDisruptionPipeline`'s second call receives an `'invalidated'` plan and short-circuits via the status guard. No caller dedup logic required. | **Locked: mechanical enforcement + test coverage.** |
| RS-11 | Inherited dirty-tree state from session-context-wp058 lines 162-190 — untracked files + `.claude/worktrees/` + one modified tracked file (`docs/ai/invocations/session-wp079-label-replay-harness-determinism-only.md`). Must not be staged. | MEDIUM — accidentally staging any of these breaks P6-27 / P6-44 discipline. | Session prompt Stop Conditions + Verification Steps explicitly enumerate files to exclude. Executor stages by exact name only. | **Locked: inherited-dirty-tree discipline carried forward from WP-057 precedent.** |
| RS-12 | Parallel `.claude/worktrees/` session from WP-081 may still be in-flight. | LOW — WP-058 touches only `packages/preplan/`; WP-081 touches `packages/registry/scripts/`. Zero file overlap. | Session prompt notes the parallel worktree exists. | **Locked: no coordination required; WP-058 proceeds independently.** |
| RS-13 | `buildNotificationMessage` (WP-058 §F lines 420-428) formats `"Player {source}'s {effect}."` with optional card suffix. The exact format is prose, not a locked contract. | LOW — UI consumes structured fields (`sourcePlayerId`, `message`, `affectedCardExtId`) — `message` is a rendering hint. DESIGN-CONSTRAINT #11 (understandable failures) is satisfied by the structured `DisruptionNotification` shape plus the rendered message. | Lock: message format is implementation detail; tests assert substring presence (source id appears; effect description appears; card appears iff `affectedCardExtId` is set). Exact string matching is discouraged to avoid brittleness. | **Locked: substring assertions, not full-string equality, in notification tests.** |

No HIGH-impact residual risks after mitigation. All MEDIUM risks locked with explicit actions.

---

## Pre-Flight Verdict (Binary)

**Verdict: DO NOT EXECUTE YET — conditional on three pre-session actions (PS-1, PS-2, PS-3).**

Justification: Dependencies (WP-056 / WP-057 / WP-008B) are all complete and contract-verified. The `PrePlan` type surface at `packages/preplan/src/preplan.types.ts` supports every function WP-058 intends to add — `invalidationReason.effectType` closed union ready at line 108, `RevealRecord` rewind-authority invariant locked at line 162-168, `status` union ready at line 66. Architectural boundaries are clean (D-5601 classification covers every new file; zero `boardgame.io`/engine-runtime/registry/server/apps imports anticipated). Maintainability is strong (extension seams via open unions + new canonical array; patch locality across three implementation files; fail-safe via `null`/`false` returns; pure functions throughout). Engine baseline `436 / 109 / 0` will remain untouched.

However, three pre-session actions are **blocking**: (1) **EC-058 does not exist** — 01.4 requires the EC as primary execution authority, and Phase 6 norm (EC-055 / EC-056 / EC-057 / EC-081) is that every WP has a committed checklist before execution; (2) **`PREPLAN_EFFECT_TYPES` canonical array + drift test deferred from WP-056 is absent from WP-058's Scope (In)** — must be added to the allowlist with a dedicated file pair mirroring WP-057's PS-2; (3) **WP-058 §H exports `SourceRestoration` + `DisruptionPipelineResult` from `./disruption.types.js` while §E/§G declare them in `disruptionPipeline.ts`** — the type-declaration site must be consolidated in `disruption.types.ts` before execution.

All three resolutions are **scope-neutral corrections** (no new behavior, no new contract, no new import). Once landed as Commit A0 `SPEC:` bundle, pre-flight does **not** require a re-run — the corrections close the gaps identified here without changing scope or introducing new architectural concerns (01.4 §Pre-Flight Verdict "If the verdict is READY TO EXECUTE but mandatory WP/EC updates are required first, list them explicitly. The verdict may be conditional on completing those updates.").

---

## Authorized Next Step

**Generation of the session execution prompt is NOT AUTHORIZED until the three pre-session actions below are resolved.**

### Pre-session actions — REQUIRED BEFORE Session Prompt Generation

**PS-1 — Author EC-058.**
Create `docs/ai/execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md` using `EC-TEMPLATE.md` + EC-057 as structural precedent. The EC must lock:
- Before Starting: WP-056 complete at `eade2d0`; WP-057 complete at `7414656`; `pnpm -r build` and `pnpm test` green at 559 / 0; inherited-dirty-tree items untouched; quarantine stashes untouched.
- Locked Values (verbatim): five WP-058 function signatures (`isPrePlanDisrupted`, `invalidatePrePlan`, `computeSourceRestoration`, `buildDisruptionNotification`, `executeDisruptionPipeline`) + four type declarations (`PlayerAffectingMutation`, `DisruptionNotification`, `SourceRestoration`, `DisruptionPipelineResult`, all in `disruption.types.ts` per PS-3) + `PREPLAN_EFFECT_TYPES = ['discard', 'ko', 'gain', 'other'] as const` (PS-2); 8-file allowlist; test baseline target; `EC-058:` commit prefix lock (P6-36); 01.5 NOT INVOKED declaration; 01.6 MANDATORY (new long-lived abstractions + first runtime consumer of `invalidationReason.effectType` + first implementation of DESIGN-CONSTRAINT #3 rewind-from-ledger); three-commit topology (A0 SPEC → A EC-058 → B SPEC); full-spread 42/42 discipline for `invalidatePrePlan`; null-on-inactive convention extended to `invalidatePrePlan` + `executeDisruptionPipeline`; throw discipline at `buildDisruptionNotification` (programming-error only); conditional-assignment pattern for optional `affectedCardExtId` (RS-4).
- Guardrails: no `boardgame.io`; no runtime engine / registry / server / apps imports; no `Math.random` / `ctx.random.*` / `Date.now` (the existing single hit at `speculativePrng.ts:79` must remain the only hit); no `.reduce()`; no new moves / phase hooks / `CoreMoveName` entries; no mutation of WP-056 or WP-057 immutable files; no `git add -A`; no `--no-verify`.
- Required `// why:` Comments: all status guards in `isPrePlanDisrupted` + `invalidatePrePlan` + `executeDisruptionPipeline`; programming-error throw in `buildDisruptionNotification`; spread-copy discipline at `invalidatePrePlan` (first occurrence); `requiresImmediateNotification: true` literal (Constraint #7 encoding); `PREPLAN_EFFECT_TYPES` `as const` citing deferral from WP-056 `preplan.types.ts:101-106`; `for...of` loop in `computeSourceRestoration` citing DESIGN-CONSTRAINT #3 (reveal ledger sole authority); `prePlan.revealLedger` read in `executeDisruptionPipeline` (RS-8 invalidation-doesn't-touch-ledger rationale).
- Verification Steps (escaped patterns per P6-22): `pnpm --filter @legendary-arena/preplan build` exits 0; `pnpm -r --if-present test` exits 0 with preplan delta `23/4/0 → ~51/7/0` and repo-wide `559 → ~587` (exact counts locked after EC-058 finalizes test aggregation); boundary greps: `git grep -nE "from ['\"]boardgame\\.io" packages/preplan/` zero hits; `git grep -nE "from ['\"]@legendary-arena/game-engine['\"]" packages/preplan/src/` returns only `import type` lines; `git grep -nE "Math\\.random|ctx\\.random|\\.reduce\\(" packages/preplan/src/` zero hits; `git grep -nE "Date\\.now" packages/preplan/src/` exactly one hit at `speculativePrng.ts:79`; P6-50 paraphrase gate (`git grep -nE "\\b(LegendaryGameState|LegendaryGame|boardgame\\.io)\\b" packages/preplan/src/` zero hits in NEW files; `git grep -nE "\\bG\\b" packages/preplan/src/` zero hits; `git grep -nE "\\bctx\\b" packages/preplan/src/` only the inherited `ctx.turn + 1` references at `preplan.types.ts:21, :51`).
- Stop Conditions: halt on any contract drift, any file outside allowlist, any test failure, any boundary grep hit, any JSDoc paraphrase hit, any `preplan.types.ts` edit attempt, any `Date.now` hit outside `speculativePrng.ts:79`, any `revision` increment in `invalidatePrePlan`.

**PS-2 — Amend WP-058 scope to include `PREPLAN_EFFECT_TYPES` canonical array + drift-detection test.**
Add the following to WP-058 §Scope (In) and §Files Expected to Change:
- `packages/preplan/src/preplanEffectTypes.ts` — **new** — exports `export const PREPLAN_EFFECT_TYPES = ['discard', 'ko', 'gain', 'other'] as const;` + `export type PrePlanEffectType = typeof PREPLAN_EFFECT_TYPES[number];` + compile-time exhaustive check using `NonNullable<PrePlan['invalidationReason']>['effectType']` (required because `invalidationReason` is optional on `PrePlan`) per session-context-wp058 lines 311-341.
- `packages/preplan/src/preplanEffectTypes.test.ts` — **new** — a `describe('preplan effect-type drift (WP-058)')` block with one `test` that asserts the canonical array matches the union (runtime set-equality check against a fixture `Set<PrePlanEffectType>`).
- Update `packages/preplan/src/index.ts` to export `PREPLAN_EFFECT_TYPES` and `PrePlanEffectType` (additive block mirroring the `PREPLAN_STATUS_VALUES` block at `index.ts:14-15`).
- Test baseline target updated accordingly (+1 test, +1 suite in preplan package).

**PS-3 — Amend WP-058 §E/§G/§H to consolidate type declarations in `disruption.types.ts`.**
Apply three coordinated edits to the WP text:
- **§E (line 322-331):** Move the `SourceRestoration` type declaration from `disruptionPipeline.ts` to `disruption.types.ts`. `disruptionPipeline.ts` imports it via `import type { SourceRestoration } from './disruption.types.js';`.
- **§G (line 447-466):** Move the `DisruptionPipelineResult` type declaration from `disruptionPipeline.ts` to `disruption.types.ts`. `disruptionPipeline.ts` imports it via `import type { DisruptionPipelineResult } from './disruption.types.js';`.
- **§H (line 513-518):** No change — `./disruption.types.js` becomes the single source of truth for all four public types. Consistent with the `*.types.ts` convention (00.6 Rule 12 and WP-005B/006A precedent).
- `disruption.types.ts` accordingly exports four types: `PlayerAffectingMutation`, `DisruptionNotification`, `SourceRestoration`, `DisruptionPipelineResult`.

### Recommended but optional pre-session action

**PS-4 (recommended) — Confirm `docs/ai/session-context/session-context-wp058.md` is committed.**
Session-context-wp058 exists at pre-flight read time (consumed by this document). If it is still only in the working tree at pre-flight completion time, include it in Commit A0 SPEC bundle. Content is already final and does not require edits (all PS-2/PS-3 resolutions map cleanly onto its §WP-058 expected baseline shift section).

### Once PS-1/2/3 land (Commit A0 `SPEC:` bundle):

> You are authorized to generate a **session execution prompt** for WP-058 to be saved as:
> `docs/ai/invocations/session-wp058-preplan-disruption-pipeline.md`
>
> The session prompt must conform exactly to the scope, constraints, and decisions locked by this pre-flight and by EC-058. No new scope may be introduced. All EC-058 locked values must be copied verbatim into the session prompt.

Per 01.4 §Pre-Flight Verdict:

```
**Pre-session actions — resolution log (to be filled when complete):**

1. PS-1 — EC-058 authored and committed. File: docs/ai/execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md. Resolved YYYY-MM-DD.
2. PS-2 — WP-058 scope amended: PREPLAN_EFFECT_TYPES array + drift test added (+2 files, +1 test, +1 suite). Resolved YYYY-MM-DD.
3. PS-3 — WP-058 §E/§G/§H amended: SourceRestoration + DisruptionPipelineResult consolidated in disruption.types.ts; disruptionPipeline.ts imports them. Resolved YYYY-MM-DD.

All mandatory pre-session actions are complete. No re-run of pre-flight required — these updates resolve gaps identified by this pre-flight without changing scope or introducing new architectural concerns.
```

### Step 1b (Copilot Check, 01.7) — mandatory for Infrastructure & Verification WPs

Per 01.4 §Step Sequencing Rules, Step 1b runs in the **same session** as pre-flight, only after a READY verdict. This pre-flight returns **DO NOT EXECUTE YET**. The copilot check below runs **against the post-PS-1/2/3 state** (i.e., assumes EC-058 authored per PS-1, WP-058 amended per PS-2/PS-3) — equivalent to the WP-057 pre-flight's "conditional READY" treatment. Any new RISK surfaced by the copilot check becomes an additional HOLD-class fix to apply before session-prompt generation.

---

## Invocation Prompt Conformance Check (Pre-Generation)

**Not yet applicable** — pre-flight is DO NOT EXECUTE YET. This checklist runs only after PS-1/2/3 resolve and the verdict flips to READY TO EXECUTE.

When applicable:
- [ ] All EC-058 locked values copied verbatim into session prompt.
- [ ] No new keywords, helpers, file paths, or timing rules appear only in the prompt.
- [ ] File paths, extensions, and test locations match WP-058 (as amended by PS-2/PS-3) exactly.
- [ ] No forbidden imports or behaviors introduced by wording changes.
- [ ] No ambiguities resolved only in the prompt (all resolved here or in EC-058).
- [ ] Contract names and field names in the prompt match `packages/preplan/src/preplan.types.ts` verbatim.
- [ ] Helper call patterns in the prompt reflect actual signatures (parameter order, return types, pure vs throwing).

**Rule:** The invocation prompt is strictly a transcription + ordering artifact. If it requires interpretation, pre-flight is incomplete.

---

## Final Instruction

Pre-flight exists to prevent premature execution and scope drift. Three pre-session actions (PS-1, PS-2, PS-3) are **blocking**. Do not proceed to session-prompt generation until all three land as a Commit A0 `SPEC:` bundle. Once they land, no re-run of pre-flight is required — this document's scope, risks, and locks remain valid because the pre-session actions close gaps without changing scope.

**End of pre-flight.**

---

# Copilot Check — WP-058 Pre-Plan Disruption Pipeline

**Date:** 2026-04-20
**Pre-flight verdict under review:** READY TO EXECUTE (effective after PS-1/PS-2/PS-3 resolution, 2026-04-20) — equivalent to the conditional READY issued in the pre-flight above; all three pre-session actions treated as resolved per the pre-flight's own "no re-run required" clause.
**Inputs reviewed:**
- EC: `docs/ai/execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md` (to be authored per PS-1)
- WP: `docs/ai/work-packets/WP-058-preplan-disruption-pipeline.md` (to be amended per PS-2/PS-3)
- Pre-flight: this file (above)
- Session context: `docs/ai/session-context/session-context-wp058.md`

## Overall Judgment

**RISK**

The pre-flight verdict holds in principle — WP-058's architecture, determinism at the preplan layer, contract integrity, and scope lock are all correctly shaped. Three findings surface scope-neutral gaps that should be closed before session-prompt generation: (1) Issue 15 — `// why:` comment coverage on the `requiresImmediateNotification: true` literal is locked in pre-flight §Established Patterns but must be mirrored into EC-058 Required `// why:` Comments to trip the WP-057-style defense-in-depth; (2) Issue 11 — the restoration tests must include at least one assertion proving `computeSourceRestoration` ignores `sandboxState` entirely (pass a plan whose sandbox contents disagree with the ledger; restoration follows ledger), enforcing DESIGN-CONSTRAINT #3 at the test level; (3) Issue 2 — the WP-057-established `Date.now` grep gate expecting exactly one hit must be carried into EC-058 verbatim. All three FIXes are scope-neutral (additive test + additive grep + additive `// why:` ask) and require no pre-flight re-run. Disposition: **HOLD** — apply the three FIXes in EC-058 / WP-058 / session prompt, re-run copilot check (expected CONFIRM), then generate the session prompt.

## Findings

### 1. Separation of Concerns & Boundaries

1. **Engine vs UI/App Boundary Drift** — PASS. D-5601 classification pins `packages/preplan/` category rules; pre-flight guardrails ban runtime engine / registry / server / apps / pg / boardgame.io imports; EC-058 (per PS-1) will replicate WP-057's escaped-dot grep gates.

9. **UI Re-implements or Re-interprets Engine Logic** — PASS. Preplan is non-authoritative by construction (D-5601). `PlayerAffectingMutation` is an integration-layer adapter input, explicitly produced OUTSIDE the engine by future WPs (WP-058 §Scope Out, line 592-593). Engine remains sole authority on real deck / moves / state. WP-058 defines pipeline functions; wiring them into the client event loop is explicitly a UI concern (§Architectural Placement line 115-118).

16. **Lifecycle Wiring Creep** — PASS. Pre-flight Runtime Readiness Check declares "01.5 Runtime Wiring Allowance: NOT INVOKED" with four criteria enumerated absent. Guardrails (Scope Lock) "No wiring into `game.ts`, `LegendaryGame.moves`, phase hooks, or any engine lifecycle point". No engine file appears in the allowlist.

29. **Assumptions Leaking Across Layers** — PASS. ARCHITECTURE.md §Pre-Planning Layer: "The engine does not know pre-planning exists. Pre-planning observes the engine; it never influences it." WP-058 imports `type { CardExtId }` only — no runtime knowledge of engine shape. One-directional.

### 2. Determinism & Reproducibility

2. **Non-Determinism Introduced by Convenience** — **RISK**. `Math.random` / `ctx.random` / `Date.now` are all explicitly banned in WP-058. The WP-057-established `Date.now` grep gate expects exactly one hit at `speculativePrng.ts:generateSpeculativeSeed`; WP-058 must preserve that count.
   **FIX:** EC-058 §After Completing must replicate WP-057's `git grep -nE "Date\\.now" packages/preplan/src/` gate expecting exactly one hit. Session prompt Verification Steps must mirror. Prevents accidental propagation of wall-clock reads into `buildDisruptionNotification` (e.g., a "timestamp the notification" drift).

8. **No Single Debugging Truth Artifact** — PASS. DESIGN-CONSTRAINT #3 (reveal ledger is sole rewind authority) + WP-058 §E `computeSourceRestoration` enforce this at the code level. Any rewind bug is traceable to the ledger content; the ledger is inspectable post-hoc.

23. **Lack of Deterministic Ordering Guarantees** — PASS. `computeSourceRestoration` iterates `for (const record of revealLedger)` preserving ledger order; `Object.keys(sharedSourceReturns)` order is insertion-order per ECMAScript. WP-058 §I tests "Reveal order is preserved within each source group" and "Mixed sources are correctly separated" assert this. No `.reduce()`, no `Object.values` over `Record<string, CardExtId[]>` that would invite non-deterministic ordering.

### 3. Immutability & Mutation Discipline

3. **Confusion Between Pure Functions and Immer Mutation** — PASS. No Immer in preplan layer (Immer lives in boardgame.io, forbidden in preplan). All five WP-058 functions are pure helpers returning new values. Scope Lock "No in-place mutation of input PrePlan or any of its arrays/objects" extended from WP-057.

17. **Hidden Mutation via Aliasing** — PASS. RS-3 locks the full-spread 42/42 discipline for `invalidatePrePlan`. WP-058 §I tests include "Input plan is not mutated (returns new object)" under Invalidation tests. 01.6 post-mortem §6 aliasing trace is MANDATORY per RS-3 (carrying forward WP-057 precedent). Pre-flight §Risk Review RS-3 enforces at all three levels (code + test + post-mortem).

### 4. Type Safety & Contract Integrity

4. **Contract Drift Between Types, Tests, and Runtime** — PASS. `PREPLAN_EFFECT_TYPES` canonical readonly array + compile-time exhaustive check (using `NonNullable<>` for optional `invalidationReason` per session-context-wp058 Lesson 4) + runtime set-equality drift test (PS-2 resolution). Mirrors `MATCH_PHASES` / `TURN_STAGES` / `CORE_MOVE_NAMES` / `RULE_TRIGGER_NAMES` / `RULE_EFFECT_TYPES` / `REVEALED_CARD_TYPES` / `PREPLAN_STATUS_VALUES` precedent. EC-058 will lock the compile-time check pattern verbatim.

5. **Optional Field Ambiguity (`exactOptionalPropertyTypes`)** — PASS. RS-4 locks conditional-assignment pattern at two sites (`invalidatePrePlan` for `affectedCardExtId` inside `invalidationReason`; `buildDisruptionNotification` for `affectedCardExtId` in the returned `DisruptionNotification`). Matches session-context-wp058 Lesson 1 + D-2901 `preserveHandCards` precedent. Tests cover both branches (with card / without card) per WP-058 §I Notification tests list.

6. **Undefined Merge Semantics (Replace vs Append)** — PASS. No merge/override semantics in WP-058. `invalidatePrePlan` performs status replace (`'active' → 'invalidated'`) and adds `invalidationReason` (previously absent). `computeSourceRestoration` builds fresh record from scratch. No ambiguity.

10. **Stringly-Typed Outcomes and Results** — PASS. All five function signatures use typed returns (`boolean`, `PrePlan | null`, `SourceRestoration`, `DisruptionNotification`, `DisruptionPipelineResult | null`). `PlayerAffectingMutation.effectType` is a closed union (soon reinforced by `PREPLAN_EFFECT_TYPES` canonical array per PS-2). `DisruptionPipelineResult.requiresImmediateNotification: true` is a literal type, not a free-form string — encodes Constraint #7 in the type system per WP-058 §G lines 457-466.

21. **Type Widening at Boundaries** — PASS. `CardExtId` (named type alias) used throughout, not raw `string`. `PlayerAffectingMutation` / `DisruptionNotification` / `SourceRestoration` / `DisruptionPipelineResult` are structured types with named fields. No `any` / `unknown` at preplan boundaries. `Record<string, CardExtId[]>` in `SourceRestoration.sharedSourceReturns` is intentional — mirrors `sandboxState.counters` open-keyed pattern.

27. **Weak Canonical Naming Discipline** — PASS. All five function names follow full-English-words rule (`isPrePlanDisrupted`, `invalidatePrePlan`, `computeSourceRestoration`, `buildDisruptionNotification`, `executeDisruptionPipeline` — no abbreviations). `PlayerAffectingMutation` / `DisruptionNotification` / `SourceRestoration` / `DisruptionPipelineResult` field names (`sourcePlayerId` / `affectedPlayerId` / `effectType` / `effectDescription` / `affectedCardExtId` / `prePlanId` / `message` / `playerDeckReturns` / `sharedSourceReturns` / `invalidatedPlan` / `notification` / `requiresImmediateNotification`) are all full-English-words. `PREPLAN_EFFECT_TYPES` matches the existing canonical-array naming convention (`PREPLAN_STATUS_VALUES`).

### 5. Persistence & Serialization

7. **Persisting Runtime State by Accident** — PASS. D-5601 explicitly states preplan is client-local disposable state; never persisted. ARCHITECTURE.md §Pre-Planning Layer: "must never persist state to any storage". WP-058 has no file / DB / R2 write paths.

19. **Weak JSON-Serializability Guarantees** — PASS. `PlayerAffectingMutation` / `DisruptionNotification` / `SourceRestoration` / `DisruptionPipelineResult` are all JSON-serializable by construction: strings, numbers, arrays of strings, `Record<string, string[]>`, `PrePlan` (already JSON-serializable per WP-056). `requiresImmediateNotification: true` is a JSON literal. No functions, Maps, Sets, or class instances. Preplan is non-transport (client-local), so no explicit JSON-roundtrip test required; a future transport-layer WP would add it.

24. **Mixed Persistence Concerns** — PASS. D-5601 separates preplan (runtime client-local) from engine `G` (runtime, never persisted), `MatchSetupConfig` (persisted separately), and snapshots (counts-only). No blur.

### 6. Testing & Invariant Enforcement

11. **Tests Validate Behavior, Not Invariants** — **RISK**. Most invariant-focused tests are locked in WP-058 §I (binary detection per-player; invalidation → null on non-active; input not mutated; empty ledger → empty restoration; ledger-only source; notification throw on non-invalidated; acceptance scenario). However, one invariant from DESIGN-CONSTRAINT #3 is implied but not test-enforced:
   - **Ledger-sole-authority invariant:** WP-058 §E comment "INVARIANT: All rewinds are derived exclusively from the revealLedger" is prose; no test asserts `computeSourceRestoration` would IGNORE a plan whose `sandboxState` disagrees with the ledger. A future refactor that reads `sandboxState` for restoration would pass all listed tests because the tests use consistent inputs.
   **FIX:** Add one restoration test to `disruptionPipeline.test.ts`: construct a `PrePlan` whose `revealLedger` contains cards NOT present in `sandboxState.hand` / `deck` / `discard` / `inPlay`; assert `computeSourceRestoration` returns exactly the ledger-derived cards. Raises restoration test count from 5 → 6 and total from 22 → 23 in `disruptionPipeline.test.ts`. Scope-neutral (same file, same function, one more assertion group).

### 7. Scope & Execution Governance

12. **Scope Creep During "Small" Packets** — PASS. Pre-flight §Scope Lock has explicit "Is Allowed To / Is Explicitly Not Allowed To" sections; 8-file allowlist + governance artifacts. "Anything not explicitly allowed is out of scope" rule cited. EC-058 (per PS-1) will replicate WP-057's `git diff --name-only` check.

13. **Unclassified Directories and Ownership Ambiguity** — PASS. `packages/preplan/` classified D-5601 (Status: Immutable) in `02-CODE-CATEGORIES.md:43, 168-205`. No new directory introduced by WP-058.

30. **Missing Pre-Session Governance Fixes** — PASS. PS-1 (EC-058), PS-2 (canonical array + drift test), PS-3 (type-file layout), PS-4 (session-context commit check) all identified and resolved before session prompt generation. Pre-flight §Authorized Next Step enumerates each with blocking classification + resolution log.

### 8. Extensibility & Future-Proofing

14. **No Extension Seams for Future Growth** — PASS. `RevealRecord.source` open union (new shared sources add without union refactor). `PlayerAffectingMutation.effectType` closed union + `PREPLAN_EFFECT_TYPES` canonical array (PS-2) — future effect categories add to both with drift test catching drift. `SourceRestoration.sharedSourceReturns: Record<string, CardExtId[]>` is open-keyed (new shared-source types add without type change). `DisruptionPipelineResult` has `requiresImmediateNotification: true` as a locked invariant — future WPs can add optional metadata without breaking consumers.

28. **No Upgrade or Deprecation Story** — PASS. Preplan state is non-persisted; no data migration concerns. `PlayerAffectingMutation` is produced by integration-layer adapters (future WPs) — additive `effectType` literals extend `PREPLAN_EFFECT_TYPES` canonical array with a drift-test update, not a breaking refactor. WP-058 is the terminal WP in the preplan core pipeline; WP-059 (UI integration) is explicitly deferred in WORK_INDEX.md:1390 pending WP-028 + UI framework decision.

### 9. Documentation & Intent Clarity

15. **Missing "Why" for Invariants and Boundaries** — **RISK**. Pre-flight §Established Patterns enumerates 7 mandatory `// why:` comment locations (all status guards, programming-error throw, spread-copy discipline, `requiresImmediateNotification: true` literal, `PREPLAN_EFFECT_TYPES` `as const`, `for...of` loop in `computeSourceRestoration`, `prePlan.revealLedger` read in pipeline). EC-058 (per PS-1) will carry these into Required `// why:` Comments — but the `requiresImmediateNotification: true` literal is a subtle one: it encodes Constraint #7 in the type system (§G line 457-466), and without a `// why:` comment explaining why a literal-true field sits in a result type, a future contributor may "clean it up" as redundant data.
   **FIX:** EC-058 Required `// why:` Comments must include: "at `DisruptionPipelineResult.requiresImmediateNotification: true` — encodes Constraint #7 (immediate notification) in the type system; callers check this field to confirm they are handling the notification requirement; removing the field would delete a type-level enforcement mechanism." Also surface in WP-058 §G JSDoc (lines 457-466) as prose so future readers of the WP see the rationale without needing to read the EC.

20. **Ambiguous Authority Chain** — PASS. Pre-flight §Review Order & Authority explicit: "EC → WP → invocation". Session-context-wp058 lists 4 authority documents in §Discipline precedents (lines 419-450). EC-058 header (per PS-1) will cite source WP + pre-flight + session context in authority order.

26. **Implicit Content Semantics** — PASS. All semantics are documented inline — `PrePlan.status` closed union JSDoc, `invalidationReason` optional-field semantics, `RevealRecord` rewind-authority invariant, `DisruptionPipelineResult.requiresImmediateNotification` type-level enforcement (pending `// why:` upgrade per Issue 15 FIX above). No reliance on names alone; every non-obvious construct has JSDoc.

### 10. Error Handling & Failure Semantics

18. **Outcome Evaluation Timing Ambiguity** — PASS. Every WP-058 function evaluates at entry: `isPrePlanDisrupted` checks null + status; `invalidatePrePlan` / `executeDisruptionPipeline` check status; `buildDisruptionNotification` checks `status === 'invalidated'` (programming-error throw otherwise); `computeSourceRestoration` has no precondition (empty ledger → empty result). No deferred or cross-lifecycle evaluation. Session-context-wp058 Lesson 2 null-on-inactive uniform convention applies.

22. **Silent Failure vs Loud Failure Decisions Made Late** — PASS. Null-return for expected failure paths (non-active status, null plan). Empty result for empty input (ledger). Programming-error throw ONLY at `buildDisruptionNotification` for caller misuse (session-context Lesson 2 + RS-5). Uniform across all five operations. Consistent with WP-057's "throws reserved for programming errors" pattern extended to the disruption layer.

### 11. Single Responsibility & Logic Clarity

25. **Overloaded Function Responsibilities** — PASS. Each of the five WP-058 functions has exactly one responsibility — binary detection / status transition / ledger-derived restoration / notification construction / pipeline orchestration. Narrow input/output contracts; no function does multiple unrelated jobs. `executeDisruptionPipeline` orchestrates the other four but does not implement their logic — it composes them.

## Mandatory Governance Follow-ups

- **EC-058 §After Completing** — add `git grep -nE "Date\\.now" packages/preplan/src/` expecting exactly one hit at `speculativePrng.ts:79` (Issue 2 FIX).
- **WP-058 §Verification Steps** — add `git grep -nE "Date\\.now" packages/preplan/src/` (expect one hit) (Issue 2 FIX).
- **EC-058 Required `// why:` Comments** — add the `requiresImmediateNotification: true` rationale (Issue 15 FIX).
- **WP-058 §G JSDoc** (on `DisruptionPipelineResult.requiresImmediateNotification`) — upgrade prose to explicitly state type-level enforcement rationale (Issue 15 FIX).
- **WP-058 §I Tests (Source restoration tests)** — add one test: `computeSourceRestoration` derives from ledger ONLY even when sandbox disagrees (Issue 11 FIX). Raises restoration tests 5 → 6 and `disruptionPipeline.test.ts` total ~22 → ~23; EC-058 and pre-flight Test Expectations updated accordingly.
- **Pre-flight §Test Expectations** — update `disruptionPipeline.test.ts` target from ~22 to ~23; update preplan baseline target from `~51/7/0` to `~52/7/0`; update repo-wide target from `~587` to `~588`.

No DECISIONS.md / 02-CODE-CATEGORIES.md / .claude/rules / WORK_INDEX changes required — all FIXes are additive tests + additive grep + additive `// why:` within existing governance structures.

## Pre-Flight Verdict Disposition

- [ ] CONFIRM — Pre-flight READY TO EXECUTE verdict stands. Session prompt generation authorized.
- [x] **HOLD** — Apply the three FIXes listed above in-place in EC-058 / WP-058 / pre-flight / session-context (scope-neutral: +1 test, +1 grep gate, +1 `// why:` location). Re-run copilot check after the fixes land; expected verdict CONFIRM. No pre-flight re-run required — fixes do not change file scope, function signatures, allowlist, or architectural boundaries. Also contingent on prior resolution of PS-1 / PS-2 / PS-3 from the pre-flight itself.
- [ ] SUSPEND — not applicable.

**End of copilot check.**

---

# Copilot Check — Re-Run 2026-04-20 (post-HOLD fixes)

**Date:** 2026-04-20
**Pre-flight verdict under review:** READY TO EXECUTE (effective 2026-04-20 after PS-1/PS-2/PS-3 resolution + copilot-check HOLD fixes landed in-place via amendments A-058-01 through A-058-05).
**Inputs reviewed:**
- EC: [`docs/ai/execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md`](../execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md) (authored per PS-1; includes all three HOLD FIXes at Locked Values + Required `// why:` Comments + After Completing sections).
- WP: [`docs/ai/work-packets/WP-058-preplan-disruption-pipeline.md`](../work-packets/WP-058-preplan-disruption-pipeline.md) (amendments A-058-01 through A-058-05 applied: §Amendments block added at top; §B.1 `SourceRestoration` + §B.2 `DisruptionPipelineResult` relocated from §E/§G per PS-3; §H canonical `PREPLAN_EFFECT_TYPES` block added per PS-2; §I exports updated with `PREPLAN_EFFECT_TYPES` + `PrePlanEffectType`; §J Tests expanded with ledger-sole restoration test + effect-type drift test + explicit 29-tests / 3-suites lock; §Files Expected to Change expanded to 8-file allowlist with Notes column; §Acceptance Criteria adds Canonical Effect-Type Array subsection + ledger-sole restoration criterion + Tests subsection upgraded with suite-wrapping convention and baseline shift; §Verification Steps expanded with full escaped-pattern grep battery including `Date.now` gate; §G `executeDisruptionPipeline` JSDoc + inline `// why:` comment on `prePlan.revealLedger` read; §B.2 `DisruptionPipelineResult.requiresImmediateNotification: true` JSDoc upgraded with type-level enforcement rationale).
- Pre-flight: this file (above); §Test Expectations section implicitly amended by WP-058 §J test count lock (29 / 3 in final amended form; see EC-058 Locked Values for the canonical number).
- Session context: [`docs/ai/session-context/session-context-wp058.md`](../session-context/session-context-wp058.md) (unchanged — already captured all five lessons-learned patterns + PS-2 canonical-array detail + quarantine / dirty-tree / inherited state).
- EC_INDEX: [`docs/ai/execution-checklists/EC_INDEX.md`](../execution-checklists/EC_INDEX.md) — EC-058 row added between EC-057 and EC-066 with status `Draft` and the full Phase 6 description pattern.

## Overall Judgment

**PASS**

All three HOLD FIXes landed as scope-neutral edits across EC-058, WP-058, and pre-flight. No file was added to or removed from the 8-file implementation allowlist; no function signature changed; no architectural boundary moved; no locked value re-derived. The three previously-RISK findings now resolve:

- **Issue 2 — Non-Determinism:** `Date.now` grep gate added to EC-058 §After Completing (expects exactly one hit at `speculativePrng.ts:79`) and WP-058 §Verification Steps (same gate). Any propagation of wall-clock reads into `buildDisruptionNotification`, `executeDisruptionPipeline`, or any new WP-058 file now trips a binary gate before commit. Matches the WP-031 / WP-057 defense-in-depth pattern. **Resolved → PASS.**
- **Issue 11 — Tests Validate Behavior, Not Invariants:** New ledger-sole restoration test added to WP-058 §J Tests (Source restoration tests bullet 6): construct a `PrePlan` whose `sandboxState.hand` / `deck` / `discard` / `inPlay` contain cards NOT in the `revealLedger`, and whose `revealLedger` contains cards NOT in the sandbox; assert `computeSourceRestoration` returns exactly the ledger-derived cards. Enforces DESIGN-CONSTRAINT #3 ("reveal ledger is sole rewind authority") at the test level — a future refactor that reads `sandboxState` for restoration would now fail this test. EC-058 Locked Values and After Completing sections reference this test explicitly. **Resolved → PASS.**
- **Issue 15 — Missing "Why" for Invariants and Boundaries:** `DisruptionPipelineResult.requiresImmediateNotification: true` JSDoc upgraded in WP-058 §B.2 with the type-level enforcement rationale ("removing this field would delete a type-level enforcement mechanism for Constraint #7"). EC-058 Required `// why:` Comments includes the site. A future contributor tempted to "clean up" the literal-true field as redundant data will now see both the JSDoc prose and the inline `// why:` comment explaining why the field is load-bearing. **Resolved → PASS.**

The three PS actions from the pre-flight itself (PS-1 / PS-2 / PS-3) also landed as part of the same Commit A0 SPEC bundle:
- **PS-1** — EC-058 authored at [`docs/ai/execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md`](../execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md); EC_INDEX row added between EC-057 and EC-066 with status `Draft`.
- **PS-2** — WP-058 amended per A-058-01: `PREPLAN_EFFECT_TYPES` canonical readonly array + `PrePlanEffectType` derived type + compile-time drift check using `NonNullable<PrePlan['invalidationReason']>['effectType']` + runtime set-equality drift test. Two new files added to allowlist (`preplanEffectTypes.ts` + `preplanEffectTypes.test.ts`); `index.ts` exports extended; test baseline shift updated `23/4/0 → 52/7/0`; repo-wide `559 → 588`.
- **PS-3** — WP-058 amended per A-058-02: §B.1 and §B.2 added, consolidating `SourceRestoration` + `DisruptionPipelineResult` declarations into `disruption.types.ts` alongside `PlayerAffectingMutation` + `DisruptionNotification`. §E + §G code skeletons trimmed to implementations only; import the relocated types via `import type`. §H exports (now §I) unchanged — the single-source-of-truth claim now matches the declaration site.

No new `RISK` surfaced from re-reading the amended artifacts. The 27 previously-PASS findings remain PASS (the HOLD fixes + PS resolutions are strictly additive and touch none of the other 28 issue surfaces).

## Findings

All 30 issues — **30 PASS, 0 RISK, 0 FIX.**

Delta from prior run (only the three previously-RISK items are restated in full; the 27 unchanged-PASS items are listed by number for auditability):

1. Engine vs UI/App Boundary Drift — PASS (unchanged).
2. **Non-Determinism Introduced by Convenience — PASS.** `Math.random` / `ctx.random` banned with grep gates; `Date.now` permitted at exactly one location (`speculativePrng.ts:79`, WP-057 carve-out) gated by EC-058 After Completing + WP-058 Verification Steps grep expecting exactly one hit. Any new wall-clock read in WP-058 files trips the binary gate before commit. Layered prevention: design-doc (DESIGN-PREPLANNING §3) + WP-057 `// why:` comment at the carve-out site + EC-058 Locked Value ("The pre-existing single hit at `packages/preplan/src/speculativePrng.ts:79` must remain the **only** hit") + binary grep gate.
3. Confusion Between Pure Functions and Immer Mutation — PASS (unchanged; no Immer in preplan layer; all five functions return new values).
4. Contract Drift Between Types, Tests, and Runtime — PASS (unchanged; canonical array + compile-time check using `NonNullable<>` + runtime drift test trio locked per PS-2; mirrors `PREPLAN_STATUS_VALUES` + six other project canonical arrays).
5. Optional Field Ambiguity — PASS (unchanged; RS-4 locks conditional-assignment pattern at both `affectedCardExtId` sites; tests cover with-card and without-card branches).
6. Undefined Merge Semantics — PASS (unchanged; no merge/override semantics in WP-058).
7. Persisting Runtime State by Accident — PASS (unchanged; preplan is client-local disposable state per D-5601; no file / DB / R2 write paths).
8. No Single Debugging Truth Artifact — PASS (unchanged; DESIGN-CONSTRAINT #3 + `computeSourceRestoration` reads only `revealLedger`; Issue 11 test enforces).
9. UI Re-implements or Re-interprets Engine Logic — PASS (unchanged; `PlayerAffectingMutation` is integration-layer adapter input; engine remains sole authority).
10. Stringly-Typed Outcomes and Results — PASS (unchanged; typed returns; `DisruptionPipelineResult.requiresImmediateNotification: true` is a literal type, not free-form).
11. **Tests Validate Behavior, Not Invariants — PASS.** Detection binary per-player; invalidation null-on-non-active; input-not-mutated; empty ledger → empty restoration; mixed sources partitioned; reveal order preserved; notification throw on non-invalidated; `requiresImmediateNotification: true` asserted; acceptance scenario end-to-end. **Ledger-sole rewind invariant now test-enforced** via the new restoration test 6 (sandbox disagrees with ledger; restoration follows ledger). A future refactor that reads `sandboxState` for restoration would fail this test. **Resolved → PASS.**
12. Scope Creep During "Small" Packets — PASS (unchanged; 8-file allowlist locked; `git diff --name-only` check in EC-058).
13. Unclassified Directories and Ownership Ambiguity — PASS (unchanged; `packages/preplan/` classified D-5601 Immutable; no new directory introduced).
14. No Extension Seams for Future Growth — PASS (unchanged; `RevealRecord.source` open; `PREPLAN_EFFECT_TYPES` closed with drift test; `SourceRestoration.sharedSourceReturns` open-keyed; `DisruptionPipelineResult.requiresImmediateNotification: true` locked).
15. **Missing "Why" for Invariants and Boundaries — PASS.** EC-058 Required `// why:` Comments enumerates 11 mandatory locations covering every non-obvious invariant. The `requiresImmediateNotification: true` literal now has both inline `// why:` at the return site in `executeDisruptionPipeline` AND upgraded JSDoc on the type declaration in §B.2 explaining "removing this field would delete a type-level enforcement mechanism for Constraint #7 — the notification requirement would then live only in prose. Do not 'clean up' this field as redundant data." A future contributor now has two independent rationale signals at the call site and the declaration site. **Resolved → PASS.**
16. Lifecycle Wiring Creep — PASS (unchanged; 01.5 NOT INVOKED; four criteria absent; no engine file in allowlist).
17. Hidden Mutation via Aliasing — PASS (unchanged; full-spread 42/42 discipline locked at code + test + post-mortem levels per RS-3; WP-058 §D skeleton remains illustrative — EC-058 Locked Values tighten to full-spread; 01.6 §6 MANDATORY).
18. Outcome Evaluation Timing Ambiguity — PASS (unchanged; every function evaluates at entry).
19. Weak JSON-Serializability Guarantees — PASS (unchanged; all four types + `requiresImmediateNotification: true` literal are JSON-serializable; preplan is non-transport).
20. Ambiguous Authority Chain — PASS (unchanged; EC → WP → invocation order; EC-058 header cites source WP + pre-flight).
21. Type Widening at Boundaries — PASS (unchanged; `CardExtId` used throughout; no `any`/`unknown`).
22. Silent Failure vs Loud Failure Decisions Made Late — PASS (unchanged; null-on-inactive uniform convention; single documented programming-error throw at `buildDisruptionNotification`).
23. Lack of Deterministic Ordering Guarantees — PASS (unchanged; `for...of` preserves ledger order; no `.reduce()`).
24. Mixed Persistence Concerns — PASS (unchanged; D-5601 separates preplan from engine / config / snapshot classes).
25. Overloaded Function Responsibilities — PASS (unchanged; each of five functions has exactly one responsibility).
26. Implicit Content Semantics — PASS (unchanged; all semantics documented inline; `requiresImmediateNotification` JSDoc upgrade strengthens this further).
27. Weak Canonical Naming Discipline — PASS (unchanged; full English words; `PREPLAN_EFFECT_TYPES` matches canonical-array convention).
28. No Upgrade or Deprecation Story — PASS (unchanged; preplan non-persisted; additive `effectType` literals extend via drift-test update, not breaking refactor).
29. Assumptions Leaking Across Layers — PASS (unchanged; one-directional knowledge; `import type` only).
30. Missing Pre-Session Governance Fixes — PASS (unchanged; PS-1 / PS-2 / PS-3 + Issue 2 / Issue 11 / Issue 15 all resolved before session prompt generation; resolution log below).

## Mandatory Governance Follow-ups

None. All HOLD FIXes and PS actions landed as scope-neutral amendments within existing governance structures. No DECISIONS.md / 02-CODE-CATEGORIES.md / .claude/rules / WORK_INDEX changes required at this stage (WORK_INDEX update lands in Commit B governance-close per three-commit topology).

## Amendment Resolution Log

All five WP amendments + three PS actions landed in Commit A0 SPEC bundle:

| Amendment / PS | What Resolved | Location |
|---|---|---|
| **PS-1** | EC-058 authored | [EC-058-preplan-disruption-pipeline.checklist.md](../execution-checklists/EC-058-preplan-disruption-pipeline.checklist.md); EC_INDEX row added line 133 |
| **PS-2** / A-058-01 | `PREPLAN_EFFECT_TYPES` canonical array + drift test + `NonNullable<>` compile check | WP-058 §H + §J; EC-058 Locked Values + Files to Produce |
| **PS-3** / A-058-02 | All four public types consolidated in `disruption.types.ts` | WP-058 §B.1 + §B.2; §E + §G skeletons trimmed to implementations only with `import type` |
| **A-058-03** (Issue 2) | `Date.now` grep gate expecting exactly one hit | EC-058 After Completing; WP-058 §Verification Steps |
| **A-058-04** (Issue 11) | Ledger-sole restoration test (sandbox disagrees with ledger) | WP-058 §J Tests restoration bullet 6; §Acceptance Criteria Source Restoration subsection; EC-058 Locked Values + After Completing |
| **A-058-05** (Issue 15) | `requiresImmediateNotification: true` JSDoc upgrade + `// why:` at call site | WP-058 §B.2 JSDoc; EC-058 Required `// why:` Comments |

## Pre-Flight Verdict Disposition

- [x] **CONFIRM** — Pre-flight READY TO EXECUTE verdict stands. Session prompt generation authorized.
- [ ] HOLD — not applicable (all prior HOLD fixes landed).
- [ ] SUSPEND — not applicable.

**Authorized next step:** Generate the session execution prompt at [`docs/ai/invocations/session-wp058-preplan-disruption-pipeline.md`](session-wp058-preplan-disruption-pipeline.md), conforming exactly to EC-058 + this pre-flight (including both the original copilot check and this re-run) + amended WP-058. The session prompt is a pure transcription + ordering artifact — no new scope, no new keywords, no new file paths beyond those locked here.

**End of copilot check re-run.**
