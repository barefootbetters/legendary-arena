# Pre-Flight — WP-057 Pre-Plan Sandbox Execution

**Template:** `docs/ai/REFERENCE/01.4-pre-flight-invocation.md`
**Target Work Packet:** `WP-057` — Pre-Plan Sandbox Execution (Speculative Planning Logic)
**Previous WP Status:** WP-056 complete — executed 2026-04-20 at commit `eade2d0` (SPEC closers `8a6451d`, `5bce4a2`, `b9b677e`)
**Pre-Flight Date:** 2026-04-20
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** **Infrastructure & Verification**
> Rationale: WP-057 introduces runtime logic (PRNG, sandbox factory, speculative operations) but does **not** mutate `G` in gameplay, does **not** wire into `game.ts`, does **not** add moves or phases, and does **not** import `boardgame.io`. All mutation is against the non-authoritative `PrePlan` object in `packages/preplan/`. This is the exact fit for the Infrastructure & Verification class (01.4 §Pre-Flight Header).

Mandatory sections per class: Dependency Check, Input Data Traceability, Structural Readiness, Runtime Readiness, Dependency Contract Verification, Maintainability & Upgrade Readiness, Scope Lock, Test Expectations, Risk Review. Mutation Boundary Confirmation is skipped (no `G` mutation path exists in this layer).

---

## Pre-Flight Intent

Validate readiness, dependency contracts, scope lock, and risks for WP-057. Not implementing. Not generating code. Not authorizing the session execution prompt until pre-session actions listed below are resolved.

---

## Review Order & Authority

Per 01.4 §Review Order & Authority, review proceeded **EC → WP → invocation**.

- **EC-057** — **DOES NOT EXIST** at pre-flight time. The EC_INDEX.md table has no EC-057 row; `docs/ai/execution-checklists/` contains only `EC-055-*` and `EC-056-*` at Phase 6/preplan level. Since the EC is the primary authority for execution correctness under 01.4, the absence of EC-057 is captured as **PS-1 (blocking pre-session action)** below. A draft EC-057 must land (Commit A0) before the session execution prompt is generated.
- **WP-057** — `docs/ai/work-packets/WP-057-preplan-sandbox-execution.md` read in full. Status line: "Ready for Implementation". Dependencies: WP-056, WP-006A, WP-008B — all complete. Drift-detection canonical-array deferral from WP-056 (EC-056 Locked Values lines 32) names WP-057 as the first runtime consumer; this must be reflected in WP-057's scope (PS-2).
- **Invocation prompt** — not yet generated. Must match EC-057 + this pre-flight verbatim once authored.

---

## Authority Chain (Read)

1. `.claude/CLAUDE.md` — Execution Checklist rule, Prompt Lint Gate, File Modifications During Execution. ✅
2. `docs/ai/ARCHITECTURE.md` — §Layer Boundary (Authoritative) lists `packages/preplan/**` as Pre-Planning (Non-Authoritative, Per-Client). ✅
3. `docs/03.1-DATA-SOURCES.md` — WP-057 consumes no external data inputs (pure in-memory; snapshot comes from caller). ✅
4. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — `preplan` category classified at line 43 and §Pre-Planning (lines 168–205) under D-5601 (Status: Immutable). Category rules forbid engine runtime imports, `boardgame.io`, registry, server, apps, `pg`, `Math.random`, `ctx.random.*`, `.reduce()`. ✅
5. `docs/ai/execution-checklists/EC-057-*.checklist.md` — **MISSING (PS-1)**.
6. `docs/ai/work-packets/WP-057-preplan-sandbox-execution.md` — read and analyzed.
7. References consumed:
   - `docs/ai/DESIGN-PREPLANNING.md §3` (randomness in the sandbox — `Date.now()` seed permitted by design).
   - `docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md` #1, #2, #3, #5, #8, #9, #10 (#4/#6/#7/#11/#12 remain WP-058 scope).
   - `docs/ai/session-context/session-context-wp056.md` (contains WP-056 precedents — confirmed no `session-context-wp057.md` exists; PS-3).
   - `docs/ai/post-mortems/01.6-WP-056-preplan-state-model.md` (baseline handoff, canonical-array deferral to WP-057).
   - `packages/preplan/src/preplan.types.ts` (actual consumed contract).
   - `packages/game-engine/src/index.ts:5` — `CardExtId` export confirmed.

No higher-authority conflicts observed.

---

## Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-056 — Pre-Planning State Model & Lifecycle | ✅ complete (commit `eade2d0`, 2026-04-20) | Four types delivered at `packages/preplan/src/preplan.types.ts`; category classified D-5601 |
| WP-006A — Player zones & hand/deck/discard model | ✅ complete | `CardExtId = string`, `PlayerZones` with `hand`/`deck`/`discard`/`inPlay`/`victory`; re-exported at `packages/game-engine/src/index.ts:5` |
| WP-008B — Core moves implementation | ✅ complete | `drawCards`/`playCard`/`endTurn` locked in `CORE_MOVE_NAMES`; `PrePlanStep.intent` intentionally distinct per WP-056 JSDoc |

**Foundation Prompts:** FP-00.4 / FP-00.5 / FP-01 / FP-02 all complete (no WP-057 infrastructure dependencies on FP-established schema, migrations, or R2 data paths).

All prerequisites met — no dependency blocker.

---

## Dependency Contract Verification

Every type, field, and signature that WP-057 consumes was verified against actual source, not against WP text alone.

- [x] **Type names** — `PrePlan`, `PrePlanSandboxState`, `RevealRecord`, `PrePlanStep` exist verbatim at `packages/preplan/src/preplan.types.ts:29, 132, 169, 202`. Exported from `packages/preplan/src/index.ts:1-6` as `export type`.
- [x] **`CardExtId` import path** — `import type { CardExtId } from '@legendary-arena/game-engine';` is valid; confirmed at `packages/game-engine/src/index.ts:5` (re-export from `./types.js`). WP-057 §B and §C use this exact import. ✅
- [x] **`PrePlanSandboxState` fields** — `hand`, `deck`, `discard`, `inPlay`: `CardExtId[]`; `counters: Record<string, number>`. Exact match at `preplan.types.ts:132-157`. `victory` is **intentionally absent** (DESIGN-CONSTRAINT #9); WP-057 does not reintroduce it. ✅
- [x] **`PrePlan.status` closed union** — `'active' | 'invalidated' | 'consumed'` at `preplan.types.ts:66`. WP-057 guards `status === 'active'` — matches verbatim. ✅
- [x] **`PrePlan.revision` invariant** — Starts at 1; increments on every mutation of `sandboxState` / `revealLedger` / `planSteps` (per JSDoc at `preplan.types.ts:37-44`). WP-057 §C Rules require "All mutation functions increment `revision` on the returned PrePlan" — compatible.
- [x] **`PrePlan.appliesToTurn` invariant** — `snapshot.currentTurn + 1` (WP-057 §B). Matches WP-056 invariant at `preplan.types.ts:20-23, 54` and EC-056 Locked Value line 19. ✅
- [x] **`RevealRecord.source`** — Open union with `'player-deck' | 'officer-stack' | 'sidekick-stack' | 'hq' | string` at `preplan.types.ts:182-187`. WP-057 §C emits `'player-deck'` for deck draws and passes through the caller's `RevealRecord['source']` for shared draws — compatible, no new literal values invented. ✅
- [x] **`RevealRecord.revealIndex`** — Monotonic number, mandatory. WP-057 acceptance criterion "Reveal indices are monotonically increasing" holds the implementation accountable.
- [x] **`PrePlanStep` shape** — `intent` (open union), `targetCardExtId?`, `description`, `isValid: boolean`. `addPlanStep` takes `Omit<PrePlanStep, 'isValid'>` and sets `isValid: true` — matches WP-056 intent vocabulary deferral (open `| string` fallback).
- [x] **`invalidationReason.effectType`** — `'discard' | 'ko' | 'gain' | 'other'` at `preplan.types.ts:108`. **Not consumed by WP-057** — invalidation is WP-058 scope; WP-057 creates PrePlans with `invalidationReason: undefined`. ✅
- [x] **No forbidden imports in the WP's intended source** — WP-057 §C imports `type { CardExtId } from '@legendary-arena/game-engine'` (type-only) and intra-package types. No `boardgame.io`, no runtime engine imports, no registry imports. Permitted under D-5601 rules. ✅
- [x] **No `.reduce()` implied by WP-057 algorithms** — Fisher-Yates shuffle uses swap loop; draw/play/counter/sharedDraw all use simple array spread/slice. No `.reduce()` branching is hinted. Matches D-5601 and code-style rule.
- [x] **`Math.random()` usage** — WP-057 §A explicitly permits `Date.now()` for `generateSpeculativeSeed()` (DESIGN-PREPLANNING §3). `Math.random()` is **not** used in seed generation. The `speculativePrng` returns a deterministic function from an integer seed. Architecture §Pre-Planning Layer allows a "client-local seedable PRNG." WORK_INDEX convention (line 1463) confirms "Speculative PRNG uses seedable LCG, never `ctx.random.*`; `Date.now()` acceptable for seed entropy." ✅
- [x] **`Date.now()` wall-clock read** — Non-authoritative layer. Must be guarded with a `// why:` comment citing DESIGN-PREPLANNING §3 and the Architecture clause permitting client-local PRNGs (code-style rule requires `// why:` on any wall-clock read; the engine's `D-3401` sub-rule pattern is a reasonable precedent, but here the authority is layer-level). **Required `// why:` comment** is added to EC-057 guardrails under PS-1.
- [x] **Handler/data separation** — No data stored in `PrePlan` is a function, Map, Set, or class instance. All operations return plain objects. ✅
- [x] **Persistence classification** — `PrePlan` is **non-authoritative runtime state**, never persisted. WP-057 introduces no new `G` field (the engine does not know pre-planning exists). No ARCHITECTURE.md §3 entry required; pre-planning persistence is covered by D-5601 + DESIGN-PREPLANNING.
- [x] **Immutable files untouched** — WP-003 immutable files (`schema.ts`, `shared.ts`, `localRegistry.ts`) not in WP-057 allowlist. WP-056's `preplan.types.ts` and `index.ts` **are** modified (the `index.ts` adds runtime exports). Per WP-056 EC-056 Locked Value line 29, `index.ts` is "type-only re-exports" — WP-057 converts it to a mixed (type + runtime) export surface. This is a **contract-file modification** that must be explicitly authorized by EC-057 (PS-1) and noted as an allowlist widening vs. the WP-056 type-only baseline. This is not a reinterpretation of WP-056 — it is the natural transition from Contract-Only WP to runtime consumer, but the authorization must be explicit.
- [x] **Functions WP-057 calls are actually available** — `PrePlan` / `PrePlanSandboxState` / `RevealRecord` / `PrePlanStep` are exported. `speculativeShuffle` / `createSpeculativePrng` / `generateSpeculativeSeed` / `createPrePlan` / `computeStateFingerprint` / `speculativeDraw` / `speculativePlay` / `updateSpeculativeCounter` / `addPlanStep` / `speculativeSharedDraw` are all **new** and will be authored in this WP — nothing to verify against existing code.
- [x] **Move classification** — WP-057 adds **zero** moves. `CoreMoveName` / `CORE_MOVE_NAMES` untouched. ✅
- [x] **Field paths in G** — WP-057 touches no `G` field. The `PlayerStateSnapshot` type is a **caller-supplied input** to `createPrePlan`; WP-057 does not read `G` directly. The caller (future UI/controller WP) is responsible for converting engine projections into snapshots.
- [x] **Locked value string literal audit** — No string literals from `LegendaryGameState` are referenced. `RevealRecord.source` values (`'player-deck'` etc.) match `preplan.types.ts:183-186` exactly.
- [x] **Runtime data availability for "scan-and-throw" checks** — Not applicable; WP-057 defines no scan-G invariants (per D-3101 / D-3102 wiring, invariants live in `packages/game-engine/src/invariants/` and do not extend to preplan).
- [x] **WP file paths verified against actual filesystem** — All three new files land in `packages/preplan/src/`, which exists (`dist/`, `node_modules/`, `package.json`, `src/`, `tsconfig.json` observed). Modify target `packages/preplan/src/index.ts` exists and currently exports types only (lines 1-6).
- [x] **WP file paths verified against code category rules** — `packages/preplan/src/**` is classified under D-5601. All seven WP-057 files fall within the classified directory. No new directory is introduced. ✅
- [x] **WP gating assumptions verified** — WP-057 §Dependencies and §Architectural Placement assertions are all true against actual code.
- [x] **Decision ID references** — WP-057 text does not reference any specific D-NNNN entry that requires verification. `DESIGN-PREPLANNING.md §3` exists and contains the randomness clause at the pre-planning layer.
- [x] **Projection aliasing** — WP-057 functions return new `PrePlan` objects; DESIGN-CONSTRAINT #9 (no information leakage) requires the sandbox to be disposable. The spec's "no operation mutates input" acceptance criterion + "All functions are pure: they return a new PrePlan, never mutate in place" rule covers aliasing. However, since `CardExtId[]` arrays inside `sandboxState` may be spread-copied vs. referenced, **pre-flight locks a requirement**: every returned `PrePlan` whose `sandboxState.hand` / `sandboxState.deck` / `sandboxState.discard` / `sandboxState.inPlay` differs from its input must re-create that array via spread (`[...hand, drawnCard]`, `deck.slice(1)`, etc.), not mutate the input in place. See **RS-4** below.
- [x] **Filter/consumer input type contains all needed data** — `PlayerStateSnapshot` (WP-057 §B) must carry `playerId`, `hand`, `deck`, `discard`, `counters`, `currentTurn`. All are derivable from engine `PlayerZones` + `G.counters` + `ctx.turn` — caller's responsibility. No upstream producer modification required in this WP.

**Findings:** All contract verifications pass. No blocking drift.

---

## Input Data Traceability Check

- [x] All non-user-generated inputs consumed by this WP are listed in `docs/03.1-DATA-SOURCES.md` — **YES**. WP-057 consumes only the caller-supplied `PlayerStateSnapshot` (from engine projections) and a `Date.now()` entropy source for PRNG seeding. Neither is an "external dataset" per 03.1; engine projections are setup-time derived data (in-memory) and `Date.now()` is a runtime entropy source, not an authored data input.
- [x] Storage location known — In-memory only for `PrePlan`; snapshot arrives via function parameter; `Date.now()` is a process-local wall-clock read.
- [x] Data sources to inspect on incorrect behavior — Engine state projection code (future UI WP) + `speculativePrng.ts` seed/shuffle determinism tests.
- [x] No implicit hardcoded literals originating from external datasets.
- [x] **Setup-Time Derived Data update needed?** — No. `PrePlan` lives outside the engine and is not a setup-time derived field of `G`. No entry required in `docs/03.1-DATA-SOURCES.md` "Setup-Time Derived Data (In-Memory)" section.

All YES. No unacceptable maintenance risk.

---

## Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass — Engine `436 / 109 / 0`, registry `13 / 2 / 0`, vue-sfc-loader `11 / 0`, server `6 / 0`, replay-producer `4 / 0`, arena-client `66 / 0`, preplan `0 / 0` (types-only). **Repo-wide: 536 passing / 0 failing at commit `b9b677e`** (WP-056 final SPEC closer).
- [x] No known EC violations open.
- [x] Required types/contracts exist — `PrePlan`, `PrePlanSandboxState`, `RevealRecord`, `PrePlanStep` all exported. `CardExtId` exported.
- [x] No naming or ownership conflicts — `speculativePrng.ts`, `preplanSandbox.ts`, `speculativeOperations.ts` do not exist; no collision.
- [x] No architectural boundary conflicts anticipated at the contract level — all new code stays in `packages/preplan/src/`.
- [x] Migrations idempotent — N/A (no DB touch).
- [x] R2 data — N/A.
- [x] G field subfields — N/A (no G read).

All YES.

---

## Runtime Readiness Check (Mutation & Framework)

Infrastructure & Verification class requires this section.

- [x] Expected runtime touchpoints are known — **None in the engine.** WP-057 introduces runtime code inside `packages/preplan/` only; it is consumed by future WP-059/UI, not by the engine lifecycle.
- [x] Framework context requirements — WP-057 does **not** use `ctx.events.*` or `ctx.random.*`. `ctx.turn` is referenced only as the semantic origin of `snapshot.currentTurn` (the caller passes a plain number, not `ctx`). No `boardgame.io` import.
- [x] Existing test infrastructure — `node:test` + `tsx` pattern used by `packages/registry/src/*.test.ts`. Preplan package.json **currently has no `test` script and no `tsx` devDep** — this is a scope gap captured under **RS-3** below.
- [x] 01.5 runtime wiring allowance — **NOT INVOKED**. None of the four 01.5 trigger criteria apply:
    - No new field added to `LegendaryGameState` (no engine file modified).
    - No shape change to `buildInitialGameState` (engine untouched).
    - No new move added to `LegendaryGame.moves`.
    - No new phase hook.
  The session prompt must declare **01.5 NOT INVOKED** explicitly per WP-030/WP-034/WP-035/WP-055/WP-056 precedent.
- [x] No architecture boundary violations expected.
- [x] Integration point code read — N/A (no engine integration in this WP).
- [x] Stage gating — N/A (not a move).
- [x] Multi-step mutations — `speculativeDraw` removes from deck **and** adds to hand **and** appends reveal. Ordering: (1) validate deck non-empty, (2) compute new deck/hand/ledger via spread, (3) return new PrePlan. No in-place mutation and no "source removed before destination confirmed" hazard because the work happens in a derived copy.
- [x] Registry data flow — N/A.
- [x] Phase transition ordering / simultaneous conditions — N/A.
- [x] Degradation path for unknown/unsupported — `speculativeDraw` / `speculativePlay` return `null` on invalid status or empty source. Counter and addStep and sharedDraw silently no-op on invalid status (return original-status PrePlan unchanged; tests must confirm revision does **not** increment in that case). The **failure-signaling convention** in WP-057 §C Rules is explicit.
- [x] Move functions outside framework context — N/A.
- [x] Mock/PRNG capability check — `speculativePrng` is authored by this WP; determinism is the WP's own acceptance criterion. `makeMockCtx` is **not** used; the preplan layer has no `ctx`.

All YES subject to RS-3 and RS-4 resolution.

---

## Established Patterns to Follow (Locked Precedents)

The following 01.4 Established Patterns apply to WP-057:

- **Pure helper functions return new values** (D-1233 two-step pattern) — every speculative operation returns a new `PrePlan`, never mutates.
- **Local structural interfaces** (WP-022/027/028 pattern) — `PlayerStateSnapshot` is a WP-057-local interface; it is not re-exported from `@legendary-arena/game-engine` and does not import `Ctx`.
- **Failure signaling by `null`, not throw** (WP-056-era precedent; reinforced here) — all speculative operations return `null` for expected failure paths; `throw` is reserved for programming errors (e.g., internal invariant violations), not expected conditions.
- **Open unions for extensibility** (WP-056 precedent) — `RevealRecord.source` and `PrePlanStep.intent` remain open. WP-057 does not introduce new string literals into either union.
- **Canonical readonly array + drift-detection test for closed unions** (WP-007A/009A/014A/021 precedent) — `PrePlan.status` is closed. Per WP-056 JSDoc (`preplan.types.ts:60-65`) + EC-056 Locked Value line 32, the `PREPLAN_STATUS_VALUES` canonical array + drift-detection test are **deferred to WP-057**. **WP-057 spec omits this scope** — captured as **PS-2 / RS-1** below.
- **Safe-skip placeholder for missing handlers / types** (WP-023/024/025/026 precedent) — WP-057 does not defer any scope here; all listed operations are fully functional at MVP (no "safe-skip" returns).
- **Three-commit topology** (WP-034/035/042/055/056 precedent) — Commit A0 `SPEC:` (EC-057 + D-entries if any + WP-057 amendments + this pre-flight) → Commit A `EC-057:` (execution: seven files + 01.6 post-mortem) → Commit B `SPEC:` (WORK_INDEX + STATUS + EC_INDEX governance close). Commit prefix `WP-057:` is **forbidden** (P6-36).
- **P6-50 paraphrase discipline** — JSDoc in new preplan files must not reference engine runtime concepts by name (`G`, `ctx`, `LegendaryGameState`, `LegendaryGame`, `boardgame.io`). WP-056 precedent: only the `ctx.turn + 1` invariant reference is permitted (WP-056 Stop Condition 16 / EC-057 will inherit). A JSDoc grep gate must be included in Verification Steps.
- **`// why:` comment requirements** — mandatory on:
  - Every use of `Date.now()` in `generateSpeculativeSeed()` (wall-clock read).
  - Every non-obvious invariant (e.g., `revision` increment, `isValid = true` initialization, sandbox copy discipline).
  - The `Math.random()` prohibition carve-out (if any prose references the rule).
- **Fail-closed configuration / additionalProperties: false** (Phase 3 exit gate) — N/A (no schema).

No deviations proposed.

---

## Maintainability & Upgrade Readiness

- [x] **Extension seam exists** — `RevealRecord.source` and `PrePlanStep.intent` are open unions; new pre-planning sources (e.g., `'shield-division'`) can be added without union refactor. `PrePlanSandboxState.counters` is `Record<string, number>`; new counter names (future card mechanics) add without type change. `PREPLAN_STATUS_VALUES` (to be added per PS-2) is the extension seam for future status values, guarded by the drift-detection test.
- [x] **Patch locality** — Bug fixes to draw/play/counter logic are localized to `speculativeOperations.ts`; PRNG fixes to `speculativePrng.ts`; sandbox factory fixes to `preplanSandbox.ts`. Clean separation. A single-behavior bug touches one file.
- [x] **Fail-safe behavior** — All invalid-status / empty-deck / missing-card paths return `null` or unchanged `PrePlan`; no partial mutation of `sandboxState`. Revision does not increment on no-op.
- [x] **Deterministic reconstructability** — PRNG is seedable; shuffle is Fisher-Yates with the PRNG; a given seed + input yields identical output. `computeStateFingerprint` is deterministic over snapshot contents (no set iteration order, no wall-clock, no randomness). The reveal ledger is the sole rewind authority (DESIGN-CONSTRAINT #3) — inspectable post-hoc.
- [x] **Backward-compatible test surface** — No existing tests run preplan code (preplan has zero tests today). All 536 existing tests must continue to pass; WP-057 adds new tests only. No existing test mocks are affected.
- [x] **Semantic naming stability** — `createPrePlan`, `speculativeDraw`, `speculativePlay`, `updateSpeculativeCounter`, `addPlanStep`, `speculativeSharedDraw`, `computeStateFingerprint`, `createSpeculativePrng`, `speculativeShuffle`, `generateSpeculativeSeed` — none encode MVP-only assumptions (no `Simple`, `Temp`, `V1`, `Immediate`, `Inline`). `speculative*` prefix cleanly distinguishes non-authoritative operations from future engine names.

All YES. Design is maintainable.

---

## Code Category Boundary Check

- [x] All new or modified files fall cleanly into the `preplan` code category (`packages/preplan/src/**`, D-5601 Status: Immutable).
- [x] Each file's category permits all imports it uses — Node built-ins + `import type` from `@legendary-arena/game-engine` + intra-package relative imports. No forbidden imports.
- [x] No file blurs category boundaries — zero `boardgame.io`, zero runtime engine import, zero registry import, zero server import.
- [x] No new directory introduced. D-5601 already classifies `packages/preplan/` and is Immutable; no new D-entry required for WP-057's file placement.

No boundary violations.

---

## Scope Lock (Critical)

### WP-057 Is Allowed To

- Create: `packages/preplan/src/speculativePrng.ts` — pure helper: `createSpeculativePrng(seed: number): () => number`, `speculativeShuffle<T>(items: readonly T[], random: () => number): T[]`, `generateSpeculativeSeed(): number` (uses `Date.now()` with `// why:` comment).
- Create: `packages/preplan/src/preplanSandbox.ts` — pure helpers: `PlayerStateSnapshot` type, `createPrePlan(snapshot, prePlanId, prngSeed): PrePlan`, `computeStateFingerprint(snapshot): string`.
- Create: `packages/preplan/src/speculativeOperations.ts` — pure helpers: `speculativeDraw`, `speculativePlay`, `updateSpeculativeCounter`, `addPlanStep`, `speculativeSharedDraw`.
- Create: `packages/preplan/src/preplanStatus.ts` — **NEW (PS-2)**: canonical readonly array `PREPLAN_STATUS_VALUES = ['active', 'invalidated', 'consumed'] as const` plus a drift-detection helper/constant. Or inline into `speculativeOperations.ts` guard — **locked at pre-flight as a dedicated file** to keep drift-detection test location obvious.
- Create: `packages/preplan/src/speculativePrng.test.ts` — PRNG determinism tests.
- Create: `packages/preplan/src/preplanSandbox.test.ts` — sandbox creation tests.
- Create: `packages/preplan/src/speculativeOperations.test.ts` — operation tests.
- Create: `packages/preplan/src/preplanStatus.test.ts` — **NEW (PS-2)**: drift-detection test asserting `PREPLAN_STATUS_VALUES` matches the `PrePlan['status']` union exactly.
- Modify: `packages/preplan/src/index.ts` — add runtime exports for all new functions + `PlayerStateSnapshot` type export + `PREPLAN_STATUS_VALUES` export. This transitions `index.ts` from type-only (WP-056 EC-056 Locked Value line 29) to mixed runtime/type exports. This transition is **explicitly authorized by EC-057** (PS-1).
- Modify: `packages/preplan/package.json` — **(PS-3 scope expansion)**: add `"test": "node --import tsx --test src/**/*.test.ts"` script and `"tsx"` devDep (matching `packages/registry/package.json:19-34`). Without this, `pnpm test` at the repo root cannot pick up the new test files.
- Modify: `pnpm-lock.yaml` — scoped to `importers['packages/preplan']` devDep delta only. Any cross-importer churn is a scope violation (P6-44).
- Update: `DECISIONS.md` entries per WP-057 §Governance (three bullet points: seedable LCG + non-authoritative `Date.now()`; pure functions returning new objects; ledger populated at operation level). Authored as a new D-entry (e.g., `D-5701`) or grouped into an existing governance block at execution author discretion — the EC must fix one shape before Commit A.
- Update: `docs/ai/work-packets/WORK_INDEX.md` — mark WP-057 `[x]` with date + commit hash (Commit B).
- Update: `docs/ai/STATUS.md` — WP-057 status bump (Commit B).
- Update: `docs/ai/execution-checklists/EC_INDEX.md` — add EC-057 row (Commit A0) and flip Draft → Done (Commit B).

### WP-057 Is Explicitly Not Allowed To

- Modify `packages/preplan/src/preplan.types.ts` — this file is immutable per WP-056 EC-056 Locked Value. Any perceived need to add a field is scope creep; stop and escalate.
- Import `boardgame.io` anywhere in `packages/preplan/`.
- Import runtime values from `@legendary-arena/game-engine` (type-only imports are permitted; `import { foo }` is forbidden).
- Import `@legendary-arena/registry`, `pg`, or anything from `apps/**`.
- Use `Math.random()` anywhere in production code paths (tests may use a deterministic seed only — Math.random is forbidden in tests too under the layer rules).
- Use `ctx.random.*` — no `ctx` exists in this layer.
- Use `.reduce()` — code-style invariant extends to preplan.
- Add any new move to `LegendaryGame.moves` / expand `CORE_MOVE_NAMES` / add any phase hook — 01.5 NOT INVOKED.
- Write anything to engine `G` — there is no access path and none must be invented.
- Simulate card effects or rule hooks within the sandbox (WP-057 §Non-Goals) — basic draw/play/counter only.
- Detect disruptions, invalidate pre-plans, perform rewind, deliver notifications, or wire into the UI layer — all are WP-058+ scope.
- Touch any file outside the nine-file allowlist above.
- Use `git add .` / `git add -A`; stage files by exact name only (P6-27 / P6-44).
- Use `--no-verify`, `--no-gpg-sign`, or bypass any hook.
- Commit under the `WP-057:` prefix — forbidden (P6-36). Use `EC-057:` for the execution commit and `SPEC:` for pre-flight bundle / governance close.
- Modify the inherited dirty-tree items listed in `session-context-wp056.md` lines 63-75 (10 untracked files + `.claude/worktrees/`). Leave them untouched.

**Rule:** Anything not explicitly allowed is out of scope.

---

## Test Expectations (Locked Before Execution)

- **Preplan package new tests (locked targets; copilot-check HOLD 2026-04-20 raised speculativeOperations.test.ts from 11 → 13):**
  - `speculativePrng.test.ts` — **3 tests** (same-seed determinism; different-seed divergence; shuffle non-mutation).
  - `preplanSandbox.test.ts` — **6 tests** (`status: 'active'` + `revision: 1` + empty ledger/steps; `appliesToTurn = currentTurn + 1`; deck is shuffled; fingerprint deterministic; fingerprint changes on hand delta; zero-op plan usable).
  - `speculativeOperations.test.ts` — **13 tests** (deck-draw moves top card; deck-draw appends reveal `'player-deck'` with monotonic `revealIndex`; deck-draw null on empty deck; deck-draw null on non-active status; play moves hand→inPlay; play null if card not in hand; updateCounter adds delta; updateCounter creates missing counter; addPlanStep appends with `isValid: true`; sharedDraw adds to hand + ledger with source; no operation mutates input across 3 sequential ops; **uniform null-on-inactive across all five ops × two non-active statuses** [copilot-check FIX]; **revision-increment discipline across all five ops** [copilot-check FIX]).
  - `preplanStatus.test.ts` — **1 test** (drift-detection: runtime set-equality + compile-time exhaustive check).
  - **Total: 23 new tests** in the preplan package, wrapped in 4 `describe()` blocks (one per test file). Pre-flight locks this as the WP-057 test-count expectation.
- **Preplan baseline shift:** `0 / 0 / 0` → **`23 / 4 / 0`** for `@legendary-arena/preplan`.
- **Repo-wide baseline shift:** `536 / 0` → **`559 / 0`** (registry 13 + vue-sfc-loader 11 + game-engine 436 + server 6 + replay-producer 4 + arena-client 66 + preplan 23).
- **Engine package baseline:** `436 / 109 / 0` **MUST REMAIN UNCHANGED**.
- **All other package baselines:** UNCHANGED.
- **Existing test changes:** None expected. No 01.5 allowance invoked; no assertion value edits authorized.
- **Defensive guards:** None required — no existing test mock touches preplan code.
- **Test boundaries:**
  - Test files must use `node:test` + `node:assert`. No `boardgame.io/testing`. No `Math.random()`. No wall-clock-sensitive assertions (seed all PRNG tests with a literal integer).
  - Tests must **NOT** modify `packages/game-engine/src/`, `packages/registry/src/`, or any other package.
  - Tests must include at least one assertion proving the `revision` field increments correctly on mutation and does NOT increment on guarded no-ops (invalid-status or empty-deck paths).
  - Tests must include at least one assertion proving every speculative-draw path appends exactly one `RevealRecord` with a monotonically-increasing `revealIndex`.

**Suite-wrapping convention (P6-44 / WP-031 precedent):** Each new test file wraps its tests in exactly one `describe()` block. Bare top-level `test()` calls are forbidden (they don't register as a suite under `node:test`). The 4-suite increment in the preplan baseline is locked by this convention.

---

## Mutation Boundary Confirmation

**Skipped** — WP-057 is Infrastructure & Verification class. Behavior / State Mutation section applies only to WPs that mutate `G`. WP-057 mutates only the `PrePlan` object (non-authoritative, per-client, outside `G`). The equivalent discipline (pure functions, return new, no mutation) is locked in §Scope Lock + §Maintainability above.

---

## Risk & Ambiguity Review

| # | Risk / Ambiguity | Impact | Mitigation | Decision / Pattern |
|---|---|---|---|---|
| RS-1 | `PREPLAN_STATUS_VALUES` canonical readonly array + drift-detection test deferred by WP-056 to WP-057, but WP-057's Scope (In) section doesn't include them. | HIGH — drift-detection pattern is a project-wide invariant per 01.4 Established Patterns. | Add new files `preplanStatus.ts` + `preplanStatus.test.ts` to the WP-057 allowlist. EC-057 must include "add canonical array + drift test" as a locked Required Implementation Task. | **Locked: add as PS-2 action.** Files added to §Scope Lock above. One new test (total tests lock rises from 20 to 21). |
| RS-2 | WP-057 §D spec shows the new `index.ts` exporting runtime symbols alongside types, but WP-056's EC-056 Locked Value line 29 says `index.ts` is "type-only re-exports." | MEDIUM — requires explicit authorization to transition `index.ts` from type-only to mixed. Without it, a reviewer may (correctly) flag the WP-057 execution as violating a WP-056 lock. | EC-057 must declare that the `index.ts` mixed-export transition is authorized, citing the natural progression from Contract-Only to Runtime Consumer. A `// why:` comment in the new `index.ts` noting the transition is appropriate but not required. | **Locked: EC-057 contains explicit authorization for `index.ts` mixed-export transition. Not a WP-056 violation — the WP-056 lock was scoped to the Contract-Only WP boundary and expires at WP-057.** |
| RS-3 | Preplan `package.json` has no `test` script and no `tsx` devDep. WP-057 §Files Expected to Change does not list `packages/preplan/package.json` as "modify". | HIGH — without the `test` script, `pnpm test` at the repo root skips the preplan package entirely and the 21 new tests never run under the aggregate baseline. | Add `packages/preplan/package.json` + `pnpm-lock.yaml` to the WP-057 allowlist with explicit diff shape: `scripts.test = "node --import tsx --test src/**/*.test.ts"`; `devDependencies.tsx = "^4.15.7"` (match registry version). Regenerate `pnpm-lock.yaml` via `pnpm install`; limit lockfile delta to the `importers['packages/preplan']` block (P6-44). | **Locked: PS-3 action. Allowlist widened to 10 files + `pnpm-lock.yaml`. EC-057 enumerates the exact devDep version match.** |
| RS-4 | WP-057 §C Rules say "All functions are pure: they return a new PrePlan, never mutate in place" but the code skeletons rely on author discipline for spread-vs-reference on `sandboxState.hand[]`, `sandboxState.deck[]`, etc. Aliasing could let a consumer mutate the sandbox through a returned array reference (WP-028 aliasing precedent). | MEDIUM — standard `JSON.stringify` equality tests cannot detect aliasing. Requires explicit pre-flight lock. | Lock a post-implementation trace check: every returned `PrePlan`'s `sandboxState.hand` / `deck` / `discard` / `inPlay` / `counters` must be a fresh spread/slice/object literal, not a reference to the input. 01.6 post-mortem MUST include an aliasing-trace section (WP-028 precedent). Tests must include one "input not mutated after 3 sequential operations" assertion per operation file. | **Locked: tests + post-mortem check required. Failure here is a 01.6 finding that blocks Commit B.** |
| RS-5 | `Date.now()` inside `generateSpeculativeSeed()` is a wall-clock read. Engine rules forbid wall-clock reads; the preplan layer doesn't, but the permission must be explicit in code. | LOW — authorized by DESIGN-PREPLANNING §3 and WORK_INDEX convention (line 1463), but reviewers may flag the literal `Date.now()` call without context. | Mandatory `// why:` comment at the `Date.now()` call citing DESIGN-PREPLANNING §3 + the non-authoritative-randomness rationale. EC-057 lists this as a Required `// why:` Comment. | **Locked: `// why:` comment required. Content: "non-authoritative layer; speculative randomness per DESIGN-PREPLANNING §3 — engine `ctx.random.*` remains the sole authority for real deck order."** |
| RS-6 | Paraphrase discipline (P6-50) — JSDoc in `speculativePrng.ts` / `preplanSandbox.ts` / `speculativeOperations.ts` must not reference engine runtime concepts by name. WP-057 spec text uses `ctx.turn` in `appliesToTurn` comment (fine — permitted exception per WP-056 Stop Condition 16) and "engine's `ctx.random.*`" in the PRNG prose. | LOW | Verification gate: `git grep -nE "LegendaryGameState|LegendaryGame|boardgame\.io|\\bG\\b" packages/preplan/src/` must return zero hits in new files (excluding the `CardExtId` import line and any type-only import line). Use regex-escaped patterns per WP-031 precedent (`boardgame\.io` with escaped dot, not bare `boardgame.io`). `ctx` is **permitted** only in the `ctx.turn + 1` invariant reference (inherited from WP-056). | **Locked: verification greps with escaped patterns. Rephrase "engine's `ctx.random.*`" in JSDoc to "the engine's authoritative randomness primitives" if the grep gate rejects it.** |
| RS-7 | `speculativeDraw` returns `{ updatedPlan, drawnCard } | null` but `speculativePlay` / `updateSpeculativeCounter` / `addPlanStep` / `speculativeSharedDraw` return `PrePlan | null` (or `PrePlan`). Inconsistent return shapes — may confuse callers. | LOW — WP-057 §C spec is explicit about each signature; not a drafting error. | Document the asymmetry: `speculativeDraw` returns the drawn card *separately* because the drawn card is needed by the caller to display / record without re-reading `sandbox.hand`; other operations return only the updated plan. A JSDoc note at `speculativeDraw` clarifying "the drawn card is surfaced in the return value so the caller needn't scan `sandboxState.hand` for the new top-of-hand entry" suffices. | **Locked: JSDoc clarification required at `speculativeDraw`.** |
| RS-8 | `updateSpeculativeCounter` / `addPlanStep` / `speculativeSharedDraw` don't guard failure paths with `null` — they always return a `PrePlan`. Per WP-057 §C Rules "All functions guard on `status === 'active'` — return `null` on invalid status (never throw for expected failure paths)", but the spec's operation-specific description for these three doesn't mention null returns. | MEDIUM — ambiguity may lead the executor to skip null returns for these three, breaking consistency. | Lock the convention: **all five speculative operations (`Draw`, `Play`, `UpdateCounter`, `AddPlanStep`, `SharedDraw`) return `null` when `status !== 'active'`**. Return types: `Draw` returns `{updatedPlan, drawnCard} | null`; others return `PrePlan | null`. Update EC-057 locked signatures accordingly. Tests cover non-active-status paths for all five. | **Locked: all five operations return `null` on non-active status. Test count of 11 in `speculativeOperations.test.ts` accommodates this.** |
| RS-9 | `createPrePlan(snapshot, prePlanId, prngSeed)` takes a caller-supplied `prePlanId: string`. No uniqueness / format contract. | LOW | Caller responsibility per WP-057 spec. EC-057 notes `prePlanId` is caller-supplied, no format validation in this WP (future WP may add). | **Locked: `prePlanId` is caller-supplied opaque string; WP-057 does not validate it.** |
| RS-10 | `computeStateFingerprint(snapshot)` algorithm is "implementation detail" in WP-057 §B. Different algorithms yield different fingerprints and any future change is a breaking change for any consumer that stored a fingerprint externally. | LOW | Algorithm locked at execution time in the implementation + documented in a JSDoc paragraph. WP-057 acceptance criterion "Fingerprint is deterministic" is the only consumer-visible contract. Since no external consumer exists yet (WP-058 is the first), algorithm changes are free until WP-058 executes. | **Locked: algorithm is implementation detail; acceptance = "same snapshot → same fingerprint, different hand/deck/discard/counters → different fingerprint". No external storage dependency in this WP.** |
| RS-11 | WP-057 §E Tests list "Deck is shuffled (not identical to input order — use seeded PRNG for deterministic assertion)". With a short deck (e.g., 3 cards) and certain seeds, a Fisher-Yates shuffle could legitimately produce the identity permutation. Test may be flaky if seed is chosen naively. | LOW | Lock the test fixture: use a deck of ≥8 cards and a seed proven to produce a non-identity shuffle. Or assert "shuffle output differs from input for at least one index" combined with a second assertion on a different seed. Either is acceptable — EC-057 leaves the exact fixture to the executor but requires a comment justifying the seed choice. | **Locked: fixture comment required; no specific seed value mandated.** |
| RS-12 | `pnpm test` at the repo root currently iterates packages via workspace globs. The preplan package's newly-added `test` script must be picked up; confirm the root's `pnpm test` (or `pnpm -r test`) invocation pattern. | LOW | Verify at session start: `pnpm -r test` (or equivalent) visits `@legendary-arena/preplan` once the `test` script is added. If the repo uses a non-recursive root script, EC-057 lists the exact command. | **Locked: executor runs `pnpm -r --if-present test` (or equivalent) to confirm preplan tests execute. Baseline `536 → 557` verified at session end.** |
| RS-13 | Inherited dirty-tree state from session-context-wp056 lines 63-75 — 10 untracked files + `.claude/worktrees/`. Must not be staged. | MEDIUM — accidentally staging any of these breaks P6-27 discipline. | Session prompt Stop Conditions + Verification Steps explicitly enumerate files to exclude. Executor stages by exact name only. | **Locked: inherited-dirty-tree discipline per WP-056 Stop Condition set.** |
| RS-14 | Parallel `.claude/worktrees/` session from WP-081 build-pipeline cleanup may still be in-flight. | LOW — WP-057 touches only `packages/preplan/`; WP-081 touches `packages/registry/scripts/`. Zero file overlap. | Session prompt notes the parallel worktree exists and may be rebased under either session's merge. | **Locked: no coordination required; WP-057 proceeds independently.** |

No HIGH-impact residual risks after mitigation. All MEDIUM risks locked with explicit actions.

---

## Pre-Flight Verdict (Binary)

**Verdict: DO NOT EXECUTE YET — conditional on three pre-session actions (PS-1, PS-2, PS-3).**

Justification: Dependencies (WP-056 / WP-006A / WP-008B) are all complete and contract-verified. The `PrePlan` type surface at `packages/preplan/src/preplan.types.ts` supports every function WP-057 intends to add — no field drift, no import-path drift, no signature surprise. Architectural boundaries are clean (D-5601 classification covers every new file; zero `boardgame.io`/engine-runtime/registry/server/apps imports anticipated). Maintainability is strong (extension seams via open unions + new canonical array; patch locality across three implementation files; fail-safe on every operation via `null` return; deterministic PRNG; no aliasing if spread discipline is enforced per RS-4).

However, three pre-session actions are **blocking**: (1) **EC-057 does not exist** — 01.4 requires the EC as primary execution authority, and Phase 6 norm (EC-055 / EC-056 / EC-081) is that every WP has a committed checklist before execution; (2) **canonical readonly array + drift-detection test for `PREPLAN_STATUS_VALUES` was deferred from WP-056 to WP-057 but is absent from WP-057's Scope (In)** — must be added to the allowlist with a dedicated file pair; (3) **preplan `package.json` needs a `test` script and `tsx` devDep** — without it the 21 new tests don't execute under `pnpm test`, invalidating the 557-test baseline claim.

All three resolutions are **scope-neutral corrections** (no new behavior, no new contract, no new import). Once landed as Commit A0 `SPEC:` bundle, pre-flight does **not** require a re-run — the corrections close the gaps identified here without changing scope or introducing new architectural concerns (01.4 §Pre-Flight Verdict "If the verdict is READY TO EXECUTE but mandatory WP/EC updates are required first, list them explicitly. The verdict may be conditional on completing those updates.").

---

## Authorized Next Step

**Generation of the session execution prompt is NOT AUTHORIZED until the three pre-session actions below are resolved.**

### Pre-session actions — REQUIRED BEFORE Session Prompt Generation

**PS-1 — Author EC-057.**
Create `docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md` using `EC-TEMPLATE.md`. The EC must lock:
- Before Starting: WP-056 complete at `eade2d0`; WP-006A / WP-008B complete; `pnpm -r build` and `pnpm test` green at 536 / 0; inherited-dirty-tree items untouched.
- Locked Values (verbatim): ten WP-057 signatures (`createSpeculativePrng`, `speculativeShuffle`, `generateSpeculativeSeed`, `createPrePlan`, `computeStateFingerprint`, `speculativeDraw`, `speculativePlay`, `updateSpeculativeCounter`, `addPlanStep`, `speculativeSharedDraw`); `PREPLAN_STATUS_VALUES = ['active', 'invalidated', 'consumed'] as const`; 10-file allowlist + `pnpm-lock.yaml`; 21-test / 4-suite baseline lock; `EC-057:` commit prefix lock (P6-36); 01.5 NOT INVOKED declaration; 01.6 MANDATORY (new long-lived abstractions; first runtime consumer of `PrePlan.status` union); three-commit topology (A0 SPEC → A EC-057 → B SPEC).
- Guardrails: no `boardgame.io`; no runtime engine / registry / server / apps imports; no `Math.random` / `ctx.random.*` / `.reduce()`; no new moves / phase hooks / `CoreMoveName` entries; no mutation of WP-056 immutable `preplan.types.ts`; no `git add -A`; no `--no-verify`.
- Required `// why:` Comments: `Date.now()` wall-clock read at `generateSpeculativeSeed`; `index.ts` type-only-to-mixed transition authorization (references RS-2); `revision` increment discipline; `isValid: true` initialization in `addPlanStep`; sandbox spread-copy discipline preventing aliasing (RS-4).
- Verification Steps: `pnpm --filter @legendary-arena/preplan build` exits 0; `pnpm -r --if-present test` exits 0 with preplan delta `0/0/0 → 21/4/0` and repo-wide `536 → 557`; boundary greps (escaped patterns per RS-6): `git grep -nE "from ['\"]boardgame\.io" packages/preplan/` zero hits; `git grep -nE "from ['\"]@legendary-arena/game-engine['\"]" packages/preplan/src/` returns only `import type` lines; `git grep -nE "Math\.random|ctx\.random|\.reduce\(" packages/preplan/src/` zero hits; P6-50 paraphrase gate per RS-6.
- Stop Conditions: halt on any contract drift, any file outside allowlist, any test failure, any boundary grep hit, any JSDoc paraphrase hit, any `preplan.types.ts` edit attempt.

**PS-2 — Amend WP-057 scope to include `PREPLAN_STATUS_VALUES` canonical array + drift-detection test.**
Add the following to WP-057 §Scope (In) and §Files Expected to Change:
- `packages/preplan/src/preplanStatus.ts` — **new** — exports `export const PREPLAN_STATUS_VALUES = ['active', 'invalidated', 'consumed'] as const;` and `export type PrePlanStatusValue = typeof PREPLAN_STATUS_VALUES[number];` plus a drift-detection compile-time check (`const _check: PrePlanStatusValue = ...` pattern or assignability assertion).
- `packages/preplan/src/preplanStatus.test.ts` — **new** — a `describe('preplan status drift (WP-057)')` block with one `test` that asserts the canonical array matches the union (runtime set-equality check against a fixture `Set<PrePlan['status']>`).
- Update `packages/preplan/src/index.ts` to export `PREPLAN_STATUS_VALUES` and `PrePlanStatusValue`.
- Test baseline updates accordingly (20 → 21 tests, 3 → 4 suites in preplan package).

**PS-3 — Amend WP-057 scope to include `packages/preplan/package.json` + `pnpm-lock.yaml` updates.**
Add to WP-057 §Files Expected to Change:
- `packages/preplan/package.json` — **modify** — add `"test": "node --import tsx --test src/**/*.test.ts"` under `scripts`; add `"tsx": "^4.15.7"` under `devDependencies` (match registry version exactly).
- `pnpm-lock.yaml` — **modify** — scoped to `importers['packages/preplan']` devDep delta only. Run `pnpm install` to regenerate; verify zero cross-importer churn (P6-44 tripwire).

### Recommended but optional pre-session action

**PS-4 (recommended) — Author `docs/ai/session-context/session-context-wp057.md`** as step 8 of WP-056's workflow. WP-056's post-mortem did not produce one (verified: no `session-context-wp057.md` file exists). Producing it now is not strictly blocking (01.4 step 0 says "if no session context file exists ... skip step 0 and begin pre-flight from the authority documents directly"), but doing so closes the WP-056 workflow audit loop and gives the executor a clean handoff. Content should mirror this pre-flight's baselines + PS-1/2/3 resolution summary.

### Once PS-1/2/3 land (Commit A0 `SPEC:` bundle):

> You are authorized to generate a **session execution prompt** for WP-057 to be saved as:
> `docs/ai/invocations/session-wp057-preplan-sandbox-execution.md`
>
> The session prompt must conform exactly to the scope, constraints, and decisions locked by this pre-flight and by EC-057. No new scope may be introduced. All EC-057 locked values must be copied verbatim into the session prompt.

Per 01.4 §Pre-Flight Verdict:

```
**Pre-session actions — resolution log (to be filled when complete):**

1. PS-1 — EC-057 authored and committed. File: docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md. Resolved YYYY-MM-DD.
2. PS-2 — WP-057 scope amended: PREPLAN_STATUS_VALUES array + drift test added (+2 files, +1 test, +1 suite). Resolved YYYY-MM-DD.
3. PS-3 — WP-057 scope amended: package.json + pnpm-lock.yaml added to allowlist with tsx devDep + test script. Resolved YYYY-MM-DD.

All mandatory pre-session actions are complete. No re-run of pre-flight required — these updates resolve gaps identified by this pre-flight without changing scope or introducing new architectural concerns.
```

### Step 1b (Copilot Check, 01.7) — mandatory for Infrastructure & Verification WPs

Per 01.4 §Step Sequencing Rules, Step 1b runs in the **same session** as pre-flight, only after a READY verdict. This pre-flight returns **DO NOT EXECUTE YET**. Step 1b **does not run** until PS-1/2/3 are resolved. Once PS-1/2/3 land, the verdict flips to READY TO EXECUTE and 01.7 must run before the session prompt is generated.

---

## Invocation Prompt Conformance Check (Pre-Generation)

**Not yet applicable** — pre-flight is DO NOT EXECUTE YET. This checklist runs only after PS-1/2/3 resolve and the verdict flips to READY TO EXECUTE.

When applicable:
- [ ] All EC-057 locked values copied verbatim into session prompt.
- [ ] No new keywords, helpers, file paths, or timing rules appear only in the prompt.
- [ ] File paths, extensions, and test locations match WP-057 (as amended by PS-2/PS-3) exactly.
- [ ] No forbidden imports or behaviors introduced by wording changes.
- [ ] No ambiguities resolved only in the prompt (all resolved here or in EC-057).
- [ ] Contract names and field names in the prompt match `packages/preplan/src/preplan.types.ts` verbatim.
- [ ] Helper call patterns in the prompt reflect actual signatures (parameter order, return types, pure vs mutating).

**Rule:** The invocation prompt is strictly a transcription + ordering artifact. If it requires interpretation, pre-flight is incomplete.

---

## Final Instruction

Pre-flight exists to prevent premature execution and scope drift. Three pre-session actions (PS-1, PS-2, PS-3) are **blocking**. Do not proceed to session-prompt generation until all three land as a Commit A0 `SPEC:` bundle. Once they land, no re-run of pre-flight is required — this document's scope, risks, and locks remain valid because the pre-session actions close gaps without changing scope.

**End of pre-flight.**

---

# Copilot Check — WP-057 Pre-Plan Sandbox Execution

**Date:** 2026-04-20
**Pre-flight verdict under review:** READY TO EXECUTE (effective after PS-1/PS-2/PS-3/PS-4 resolution, 2026-04-20) — equivalent to the conditional READY issued in the pre-flight above; all four pre-session actions now satisfied per the pre-flight's own "no re-run required" clause.
**Inputs reviewed:**
- EC: `docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md`
- WP: `docs/ai/work-packets/WP-057-preplan-sandbox-execution.md` (amended 2026-04-20 per PS-2/PS-3)
- Pre-flight: this file (above)
- Session context: `docs/ai/session-context/session-context-wp057.md`

## Overall Judgment

**RISK**

The pre-flight verdict still holds in principle — WP-057's architecture, determinism at the preplan layer, contract integrity, and scope lock are all correctly shaped. Three findings surface scope-neutral gaps in the **test surface + verification greps** that must be closed before the session execution prompt is generated: (1) `Date.now()` is explicitly permitted at one location but not grep-gated to that location, so accidental propagation would not be detected by the After Completing checklist; (2) the uniform null-on-inactive convention (RS-8) is locked in EC-057 across all five speculative operations but only tested on `speculativeDraw`; (3) the revision-increment discipline is locked verbally but never test-asserted, so the convention can drift silently. All three FIXes are scope-neutral (additive tests + one grep line) and require no pre-flight re-run. Disposition: **HOLD** — apply the three FIXes in EC-057 / WP-057 / session-context, re-run copilot check (expected CONFIRM), then generate the session prompt.

## Findings

### 1. Separation of Concerns & Boundaries

1. **Engine vs UI/App Boundary Drift** — PASS. D-5601 classification pins `packages/preplan/` category rules; EC-057 guardrails ban runtime engine / registry / server / apps / pg / boardgame.io imports; After Completing has escaped-dot grep gates for each.

9. **UI Re-implements or Re-interprets Engine Logic** — PASS. Preplan is documented as advisory (DESIGN-CONSTRAINT #2, WP-057 §Non-Negotiable Constraints row 2) — speculative logic is parallel, not re-implementation. Engine remains the sole authority for real deck order and real moves; WP-057 §Architectural Placement cites this explicitly.

16. **Lifecycle Wiring Creep** — PASS. EC-057 Locked Values "01.5 Runtime Wiring Allowance: NOT INVOKED" with four criteria enumerated absent. Guardrails "No wiring into game.ts, LegendaryGame.moves, phase hooks, or any engine lifecycle point (WP-028 lifecycle-prohibition precedent)". No engine file appears in the allowlist.

29. **Assumptions Leaking Across Layers** — PASS. ARCHITECTURE.md §Pre-Planning Layer: "The engine does not know pre-planning exists. Pre-planning observes the engine; it never influences it." Preplan imports `type { CardExtId }` only — no runtime knowledge of engine shape. One-directional.

### 2. Determinism & Reproducibility

2. **Non-Determinism Introduced by Convenience** — **RISK**. `Math.random` and `ctx.random` are both explicitly banned with grep gates. `Date.now()` is explicitly **permitted** at `generateSpeculativeSeed` per DESIGN-PREPLANNING §3 and WORK_INDEX convention (line 1463), with a mandatory `// why:` comment. However, the After Completing verification greps do **not** include a `Date.now` check — so an accidental propagation of `Date.now()` into `speculativeOperations.ts` or `preplanSandbox.ts` (e.g., a future contributor copying the pattern for "timing" a draw) would not be caught by the binary gate. The `// why:` comment discipline catches it at code review, but defense-in-depth grep is consistent with the project's P6-22 / WP-031 precedent.
   **FIX:** Add to EC-057 §After Completing: `git grep -nE "Date\.now" packages/preplan/src/` — expect exactly one hit, in `speculativePrng.ts` (inside `generateSpeculativeSeed`). Mirror addition to WP-057 §Verification Steps.

8. **No Single Debugging Truth Artifact** — PASS. DESIGN-CONSTRAINT #3 and EC-057 Locked Values designate the **reveal ledger** as the sole authority for sandbox state reconstruction. `revealIndex` monotonicity is enforced by test + JSDoc invariant.

23. **Lack of Deterministic Ordering Guarantees** — PASS. Fisher-Yates shuffle is deterministic given seed; `CardExtId[]` arrays preserve order; `PREPLAN_STATUS_VALUES` array order matches union declaration order in `preplan.types.ts:66`; reveal ledger is append-only with monotonic `revealIndex`. `computeStateFingerprint` explicitly excludes deck order (sandbox has its own shuffle) — documented semantic choice, not implicit.

### 3. Immutability & Mutation Discipline

3. **Confusion Between Pure Functions and Immer Mutation** — PASS. No Immer in preplan layer (Immer lives in boardgame.io, which is forbidden in preplan). All ten functions are pure helpers returning new values. EC-057 Locked Values "Purity + no mutation: every operation returns a new PrePlan object" plus guardrail "No in-place mutation of input PrePlan or any of its arrays/objects".

17. **Hidden Mutation via Aliasing** — PASS. Pre-flight RS-4 locks spread-copy discipline for every `sandboxState` array/object returned. EC-057 Required `// why:` Comments includes the spread-copy rationale at the first occurrence. Test 11 in `speculativeOperations.test.ts` asserts "no operation mutates the input PrePlan across 3 sequential operations" — the WP-028 aliasing-precedent check. 01.6 post-mortem §6 aliasing trace is MANDATORY per pre-flight RS-4.

### 4. Type Safety & Contract Integrity

4. **Contract Drift Between Types, Tests, and Runtime** — PASS. `PREPLAN_STATUS_VALUES` canonical readonly array + compile-time exhaustive check + runtime set-equality drift test (PS-2 resolution). Mirrors `MATCH_PHASES` / `TURN_STAGES` / `CORE_MOVE_NAMES` / `RULE_TRIGGER_NAMES` / `RULE_EFFECT_TYPES` / `REVEALED_CARD_TYPES` precedent. EC-057 locks the compile-time check pattern verbatim.

5. **Optional Field Ambiguity (`exactOptionalPropertyTypes`)** — PASS. Preplan `tsconfig.json` has `exactOptionalPropertyTypes: true` (inherited from WP-056 lock). WP-057 adds no optional fields to its new types. `addPlanStep(prePlan, step: Omit<PrePlanStep, 'isValid'>)` handles the optional-field concern by excluding the caller-supplied field and letting the function set it. `PrePlan.invalidationReason` remains WP-058 scope.

6. **Undefined Merge Semantics (Replace vs Append)** — PASS. No merge/override semantics in WP-057. `updateSpeculativeCounter` adds a delta (explicit arithmetic), `addPlanStep` appends (explicit array growth), `speculativeSharedDraw` appends (explicit array growth + ledger append). No ambiguity.

10. **Stringly-Typed Outcomes and Results** — PASS. All ten function signatures use typed returns (`PrePlan | null`, `{updatedPlan: PrePlan; drawnCard: CardExtId} | null`, `() => number`, `T[]`, `number`, `string` for fingerprint). `counterName: string` parameter is open by design (inherited from WP-056 `counters: Record<string, number>` contract). `source: RevealRecord['source']` is a typed union reference, not a free-form string.

21. **Type Widening at Boundaries** — PASS. `CardExtId` (named type alias) used throughout, not raw `string`. `PlayerStateSnapshot` is a structured type with named fields. No `any` / `unknown` at preplan boundaries.

27. **Weak Canonical Naming Discipline** — PASS. All ten function names follow full-English-words rule (`createSpeculativePrng`, `generateSpeculativeSeed`, `updateSpeculativeCounter`, `speculativeSharedDraw` — no abbreviations). `PlayerStateSnapshot` field names (`hand`/`deck`/`discard`/`counters`/`currentTurn`/`playerId`) mirror `PrePlanSandboxState` + `PrePlan` field names verbatim. `PREPLAN_STATUS_VALUES` matches the existing canonical-array naming convention.

### 5. Persistence & Serialization

7. **Persisting Runtime State by Accident** — PASS. D-5601 explicitly states preplan is client-local disposable state; never persisted. ARCHITECTURE.md §Pre-Planning Layer: "must never persist state to any storage". WP-057 has no file / DB / R2 write paths.

19. **Weak JSON-Serializability Guarantees** — PASS. `PrePlan` type (WP-056) is JSON-serializable by construction: strings, numbers, arrays of strings, `Record<string, number>`. WP-057 adds no functions, Maps, Sets, or class instances. No explicit JSON-roundtrip test is required because preplan is non-transport (client-local); if a future WP introduces cross-transport serialization, a roundtrip test should be added at that WP, not here.

24. **Mixed Persistence Concerns** — PASS. D-5601 separates preplan (runtime client-local) from engine `G` (runtime, never persisted), `MatchSetupConfig` (persisted separately), and snapshots (counts-only). No blur.

### 6. Testing & Invariant Enforcement

11. **Tests Validate Behavior, Not Invariants** — **RISK**. Most invariant-focused tests are locked (PRNG determinism, ledger monotonicity, drift detection, 3-op aliasing proof). However, two EC-057 Locked Values are verbally asserted but not test-enforced:
   - **Null-on-inactive uniform convention (RS-8):** only `speculativeDraw` has a "returns null when status is not 'active'" test (test 4). The other four operations (`speculativePlay`, `updateSpeculativeCounter`, `addPlanStep`, `speculativeSharedDraw`) have no such test. The convention can silently drift on any of the four.
   - **Revision-increment discipline:** EC-057 locks "+1 on every successful mutation; no increment on null-return paths" but no test asserts either half across the five operations. A future implementation that forgets to increment `revision` on `addPlanStep` would pass all 21 tests.
   **FIX:** Add two parameterized tests to `speculativeOperations.test.ts`, raising its count from 11 → 13 and the total baseline from 21/4/0 → 23/4/0:
   - Test 12: "All five operations return null when `status` is `'invalidated'` or `'consumed'`" — iterates five operations × two non-active statuses (10 assertions in one test).
   - Test 13: "Revision increments by exactly 1 on each successful mutation and does NOT increment on any null-return path" — iterates five operations × one success path + one failure path (10 assertions in one test).
   Update `speculativeOperations` test count in: EC-057 Locked Values "Test baseline lock"; EC-057 Files to Produce description for `speculativeOperations.test.ts`; WP-057 §E test list; WP-057 §Acceptance Criteria Tests baseline; pre-flight §Test Expectations; `session-context-wp057.md` baselines. All updates are scope-neutral (same file, same functions, more assertions — no file-list or signature changes).

### 7. Scope & Execution Governance

12. **Scope Creep During "Small" Packets** — PASS. EC-057 After Completing `git diff --name-only` check enforces the 10-file allowlist + `pnpm-lock.yaml` + governance artifacts. Pre-flight §Scope Lock has explicit "Is Allowed To / Is Explicitly Not Allowed To" sections. "Anything not explicitly allowed is out of scope" rule cited.

13. **Unclassified Directories and Ownership Ambiguity** — PASS. `packages/preplan/` classified D-5601 (Status: Immutable) in `02-CODE-CATEGORIES.md:43, 168-205`. No new directory introduced by WP-057.

30. **Missing Pre-Session Governance Fixes** — PASS. PS-1 (EC-057), PS-2 (canonical array + drift test), PS-3 (package.json + lockfile), PS-4 (session-context) all identified and resolved before session prompt generation. Pre-flight §Authorized Next Step enumerates each with blocking classification + resolution log.

### 8. Extensibility & Future-Proofing

14. **No Extension Seams for Future Growth** — PASS. `RevealRecord.source` and `PrePlanStep.intent` are open unions (extension without union refactor). `counters: Record<string, number>` extensible via new keys. `PREPLAN_STATUS_VALUES` is the extension seam for future status values, guarded by drift test. `PREPLAN_EFFECT_TYPES` deferred to WP-058 as its own extension seam.

28. **No Upgrade or Deprecation Story** — PASS. Preplan state is non-persisted; no data migration concerns. `createSpeculativePrng` algorithm is documented as implementation detail via `// why:` comment ("algorithm changes require updating snapshot tests") — no downstream consumer may depend on specific seed-output bytes. WP-058 extension path is documented (it extends via `PREPLAN_EFFECT_TYPES` + disruption handlers, not via breaking WP-057's contract).

### 9. Documentation & Intent Clarity

15. **Missing "Why" for Invariants and Boundaries** — PASS. EC-057 §Required `// why:` Comments has 12 specific locations covering every non-obvious invariant: `Date.now()` rationale; PRNG algorithm stability; seed fixture choice; `appliesToTurn = snapshot.currentTurn + 1`; `revision: 1` initialization; fingerprint deck-order exclusion; status guard rationale; revision increment rationale; `isValid: true` initialization; spread-copy aliasing prevention; `index.ts` transition authorization; canonical array drift rationale.

20. **Ambiguous Authority Chain** — PASS. Pre-flight §Review Order & Authority explicit: "EC → WP → invocation". EC-057 header cites source WP + pre-flight. Session-context-wp057 §Files the executor needs to read lists 9 authority documents in order.

26. **Implicit Content Semantics** — PASS. All semantics are documented inline — `appliesToTurn` invariant, `revision` monotonicity, closed-vs-open union intent, reveal ledger as sole rewind authority, fingerprint NON-GUARANTEE clause. No reliance on names alone; every non-obvious construct has JSDoc.

### 10. Error Handling & Failure Semantics

18. **Outcome Evaluation Timing Ambiguity** — PASS. Every operation checks `status === 'active'` at entry; no deferred or cross-lifecycle evaluation. EC-057 Required `// why:` Comments at each guard: "pre-plan is advisory and only mutates while active; null-return signals non-active status to the caller without throwing".

22. **Silent Failure vs Loud Failure Decisions Made Late** — PASS. WP-057 §C Rules + EC-057 Locked Values "Failure signaling: null return for expected failure paths (empty deck, card not in hand, non-active status); throw reserved for programming errors". Uniform across all five operations (RS-8). Consistent with engine's "moves never throw" pattern extended to the advisory layer.

### 11. Single Responsibility & Logic Clarity

25. **Overloaded Function Responsibilities** — PASS. Each of the ten WP-057 functions has exactly one responsibility — PRNG creation / PRNG-driven shuffle / seed generation / sandbox creation / fingerprinting / draw / play / counter update / step append / shared draw. Narrow input/output contracts; no function does multiple unrelated jobs.

## Mandatory Governance Follow-ups

- **EC-057 §Locked Values "Test baseline lock"** — update `21 / 4 / 0` to `23 / 4 / 0`; update repo-wide `536 → 557` to `536 → 559`.
- **EC-057 §Files to Produce** — update `speculativeOperations.test.ts` description from "11 tests" to "13 tests".
- **EC-057 §After Completing** — add `git grep -nE "Date\.now" packages/preplan/src/` expecting exactly one hit at `speculativePrng.ts:generateSpeculativeSeed`.
- **WP-057 §E Tests** — update `speculativeOperations.test.ts` count from 11 → 13; add test 12 (uniform null-on-inactive across five ops) and test 13 (revision-increment discipline across five ops). Update baseline lock `0 / 0 / 0 → 21 / 4 / 0` to `0 / 0 / 0 → 23 / 4 / 0`.
- **WP-057 §Acceptance Criteria Tests** — update test-count reference from 21 to 23.
- **WP-057 §Verification Steps** — add `git grep -nE "Date\.now" packages/preplan/src/` (expect one hit).
- **WP-057 §Files Expected to Change** — update `speculativeOperations.test.ts` "Notes" column from "11 tests (includes 3-op aliasing proof)" to "13 tests (includes 3-op aliasing proof + uniform null-on-inactive + revision-increment discipline)".
- **Pre-flight §Test Expectations** — update preplan baseline and repo-wide baseline.
- **`session-context-wp057.md`** — update preplan baseline and repo-wide baseline in two locations (Baselines section + Workflow audit trail section if it mentions test count).

No DECISIONS.md / 02-CODE-CATEGORIES.md / .claude/rules / WORK_INDEX changes required — all FIXes are additive tests + one grep line within existing governance structures.

## Pre-Flight Verdict Disposition

- [ ] CONFIRM — Pre-flight READY TO EXECUTE verdict stands. Session prompt generation authorized.
- [x] **HOLD** — Apply the three FIXes listed above in-place (scope-neutral: +2 tests, +1 grep, baseline 21/4/0 → 23/4/0). Re-run copilot check after the fixes land; expected verdict CONFIRM. No pre-flight re-run required — fixes do not change file scope, function signatures, allowlist, or architectural boundaries.
- [ ] SUSPEND — not applicable.

**End of copilot check.**

---

# Copilot Check — Re-Run 2026-04-20 (post-HOLD fixes)

**Date:** 2026-04-20
**Pre-flight verdict under review:** READY TO EXECUTE (effective 2026-04-20 after PS-1/PS-2/PS-3/PS-4 + copilot-check HOLD fixes).
**Inputs reviewed:**
- EC: `docs/ai/execution-checklists/EC-057-preplan-sandbox-execution.checklist.md` (3 FIXes applied: test baseline `21/4/0 → 23/4/0`; `speculativeOperations.test.ts` description updated to 13 tests; Date.now grep added to After Completing).
- WP: `docs/ai/work-packets/WP-057-preplan-sandbox-execution.md` (4 FIXes applied: §E operations test file header updated to 13 tests; §E baseline lock updated; §E test list expanded to include tests 12 and 13; §Acceptance Criteria / §Verification Steps / §Files Expected to Change / §Definition of Done all updated; Date.now grep added to §Verification Steps).
- Pre-flight: §Test Expectations section updated (this file).
- Session context: `docs/ai/session-context/session-context-wp057.md` §WP-057 expected baseline shift updated.

## Overall Judgment

**PASS**

All three HOLD FIXes landed as scope-neutral edits across EC-057, WP-057, pre-flight, and session-context. No file was added to or removed from the implementation allowlist; no function signature changed; no architectural boundary moved; no test existed before — the two new tests are additive on top of the original 21, bringing the locked baseline to `23 / 4 / 0` (preplan) / `559 / 0` (repo-wide). The two previously-flagged `RISK` findings now resolve:

- **Issue 2 — Non-Determinism:** `Date.now` grep added to EC-057 §After Completing and WP-057 §Verification Steps with expected count of exactly one hit (`speculativePrng.ts:generateSpeculativeSeed`). Any propagation outside that location now trips a binary gate before commit, matching the WP-031 P6-22 defense-in-depth pattern. **Resolved → PASS.**
- **Issue 11 — Tests Validate Behavior, Not Invariants:** Two new tests added to `speculativeOperations.test.ts`:
  - Test 12 "uniform null-on-inactive across all five operations × two non-active statuses" — 10 `assert.strictEqual(result, null)` assertions in one `test`, proving RS-8 uniformly across `speculativeDraw` / `Play` / `UpdateCounter` / `AddPlanStep` / `SharedDraw` for both `'invalidated'` and `'consumed'` statuses.
  - Test 13 "revision-increment discipline across all five operations" — 10 assertions proving `+1` on success and unchanged input on null-return for all five operations. A forgotten `revision + 1` on any operation now trips a locked test.
  Both invariants were verbally locked in EC-057 but not test-enforced; they are now test-enforced. **Resolved → PASS.**

No new `RISK` surfaced from the re-read of the amended artifacts. The 27 previously-PASS findings remain PASS (the HOLD fixes are strictly additive and touch none of the other 28 issue surfaces).

## Findings

All 30 issues — **30 PASS, 0 RISK, 0 FIX.**

Delta from prior run (only the two previously-RISK items are restated in full; the 27 unchanged-PASS items are listed by number for auditability):

1. Engine vs UI/App Boundary Drift — PASS (unchanged).
2. **Non-Determinism Introduced by Convenience — PASS.** Math.random + ctx.random banned with grep gates; Date.now permitted at exactly one location (`speculativePrng.ts:generateSpeculativeSeed`) gated by grep expecting exactly one hit; `// why:` comment discipline at the Date.now call site reinforces the rationale. Layered prevention: design-doc (DESIGN-PREPLANNING §3) + code comment + binary grep gate.
3. Confusion Between Pure Functions and Immer Mutation — PASS (unchanged).
4. Contract Drift Between Types, Tests, and Runtime — PASS (unchanged; canonical array + compile-time check + runtime drift test trio locked).
5. Optional Field Ambiguity — PASS (unchanged).
6. Undefined Merge Semantics — PASS (unchanged).
7. Persisting Runtime State by Accident — PASS (unchanged).
8. No Single Debugging Truth Artifact — PASS (unchanged; reveal ledger is sole rewind authority).
9. UI Re-implements or Re-interprets Engine Logic — PASS (unchanged).
10. Stringly-Typed Outcomes and Results — PASS (unchanged).
11. **Tests Validate Behavior, Not Invariants — PASS.** PRNG determinism + ledger monotonicity + drift detection + 3-op aliasing proof were already locked. Null-on-inactive uniform convention (RS-8) now test-enforced across all five operations × two non-active statuses via test 12. Revision-increment discipline now test-enforced across all five operations × both branches via test 13. Both tests are parameterized/iterated within a single `test` call to keep the suite count at 4 while raising the test count to 23; this is consistent with the project's single-`describe`-per-file convention (WP-031 precedent).
12. Scope Creep During "Small" Packets — PASS (unchanged; allowlist unchanged at 10 implementation files + `pnpm-lock.yaml`).
13. Unclassified Directories and Ownership Ambiguity — PASS (unchanged; D-5601 Immutable).
14. No Extension Seams for Future Growth — PASS (unchanged).
15. Missing "Why" for Invariants and Boundaries — PASS (unchanged; 12 required `// why:` comment locations in EC-057).
16. Lifecycle Wiring Creep — PASS (unchanged; 01.5 NOT INVOKED; four criteria absent).
17. Hidden Mutation via Aliasing — PASS (unchanged; spread-copy discipline + post-mortem §6 aliasing trace mandatory).
18. Outcome Evaluation Timing Ambiguity — PASS (unchanged; status-at-entry check uniform across five ops).
19. Weak JSON-Serializability Guarantees — PASS (unchanged; type system + non-transport layer).
20. Ambiguous Authority Chain — PASS (unchanged).
21. Type Widening at Boundaries — PASS (unchanged).
22. Silent Failure vs Loud Failure Decisions Made Late — PASS (unchanged; null-return convention uniform; now test-enforced via test 12).
23. Lack of Deterministic Ordering Guarantees — PASS (unchanged).
24. Mixed Persistence Concerns — PASS (unchanged).
25. Overloaded Function Responsibilities — PASS (unchanged).
26. Implicit Content Semantics — PASS (unchanged).
27. Weak Canonical Naming Discipline — PASS (unchanged).
28. No Upgrade or Deprecation Story — PASS (unchanged; PRNG algorithm documented as implementation detail via `// why:` comment).
29. Assumptions Leaking Across Layers — PASS (unchanged; one-directional knowledge).
30. Missing Pre-Session Governance Fixes — PASS (unchanged; PS-1/2/3/4 all resolved).

## Mandatory Governance Follow-ups

None. All fixes were scope-neutral test/grep additions within existing governance structures. No DECISIONS.md / 02-CODE-CATEGORIES.md / .claude/rules / WORK_INDEX changes required.

## Pre-Flight Verdict Disposition

- [x] **CONFIRM** — Pre-flight READY TO EXECUTE verdict stands. Session prompt generation authorized.
- [ ] HOLD — not applicable (all prior HOLD fixes landed).
- [ ] SUSPEND — not applicable.

**Authorized next step:** Generate the session execution prompt at `docs/ai/invocations/session-wp057-preplan-sandbox-execution.md`, conforming exactly to EC-057 + this pre-flight + amended WP-057. The session prompt is a pure transcription + ordering artifact — no new scope, no new keywords, no new file paths beyond those locked here.

**End of copilot check re-run.**
