# Session Prompt — WP-035 Release, Deployment & Ops Playbook

**Work Packet:** [docs/ai/work-packets/WP-035-release-deployment-ops-playbook.md](../work-packets/WP-035-release-deployment-ops-playbook.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-035-release-ops.checklist.md](../execution-checklists/EC-035-release-ops.checklist.md)
**Session Context Bridge:** [docs/ai/session-context/session-context-wp035.md](../session-context/session-context-wp035.md)
**Commit prefix:** `EC-035:` on every code-changing commit; `SPEC:` on governance / doc-only commits; `WP-035:` is **forbidden** (commit-msg hook rejects per P6-36).
**Pre-flight verdict:** READY TO EXECUTE — WP-034 dependency green at `5139817`; D-3501 classification drafted and landed alongside this prompt under the Commit A0 SPEC bundle (see Pre-Session Gate #2); engine baseline 436 / 109 / 0 fail; repo baseline 526 / 0 fail. PS-1 (D-3501 directory classification), RS-1 (OpsCounters runtime ownership → option (a), pure type), RS-2 (test-count lock at 436 / 109), RS-3 (explicit test-run gate added to Verification Steps), and RS-4 (`docs/ops/` top-level docs subdirectory accepted) all resolved in this prompt's Locked Values and Verification Steps.
**WP Class:** Contract-Only + Documentation (pure type definitions, three new ops docs, additive re-exports; no `G` mutation, no `game.ts` wiring, no moves, no phase hooks, no new tests).
**Primary layer:** Operations / Release Engineering / Reliability — engine-owned surface at `packages/game-engine/src/ops/` + non-engine docs at `docs/ops/`.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-035:` on code, `SPEC:` on governance. Triple cross-referenced: WP-035 (§Definition of Done item referencing the SPEC/EC split implicitly), EC-035 line 1, this prompt line 4. If anyone insists on `WP-035:`, STOP — the commit-msg hook rejects it per **P6-36**.

2. **Governance committed (P6-34).** Before the first engine-file edit, run `git log --oneline -5` and confirm the SPEC pre-flight commit landed **D-3501** in `docs/ai/DECISIONS.md`, the **D-3501** row in `docs/ai/DECISIONS_INDEX.md`, and the `packages/game-engine/src/ops/ (D-3501)` entry in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §engine subdirectory list. If unlanded, STOP — execution is blocked on the directory-classification precedent (D-3501 follows D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 / D-3401 — **seven prior precedents**, this is the eighth engine subdirectory).

3. **Upstream dependency green at session base commit.** Run `pnpm -r test`. Expect repo-wide **526 passing / 0 failing** (registry 3 + vue-sfc-loader 11 + game-engine 436 + server 6 + replay-producer 4 + arena-client 66). Engine baseline = **436 / 109 suites**. If the repo baseline diverges, STOP and reconcile against `WORK_INDEX.md` per the §"Verify First" discipline in the session-context bridge file. Specifically confirm WP-034 closed at `5139817` and `b36c840`:

   ```pwsh
   git log --oneline -6
   # Expected head of list (or descendants): 50c76e3 SPEC: bridge WP-034 → WP-035 (session-context for next executor)
   #                                         b36c840 SPEC: close WP-034 / EC-034 governance
   #                                         5139817 EC-034: add versioning subtree
   #                                         c587f74 SPEC: pre-flight WP-034
   ```

4. **Working-tree hygiene.** `git status --short` will show inherited dirty-tree files from prior sessions (M `session-wp079-...`; `??` `forensics-...`, `session-wp048-...`, `session-wp067-...`, `session-wp068-...`, `01.6-applyReplayStep.md`, `session-context-forensics-...`, `session-context-wp067.md`, `01.3-ec-mode-commit-checklist.oneliner.md`). **None of these are in WP-035 scope.** Retained stashes `stash@{0}` and `stash@{1}` are owned by the WP-068 / MOVE_LOG_FORMAT resolver — **do NOT pop**. The EC-069 `<pending — gatekeeper session>` placeholder in `EC_INDEX.md` is owned by a separate SPEC commit — **do NOT backfill here**. Stage by name only; never `git add .` or `git add -A` (P6-27 / P6-44 discipline).

5. **Code-category classification confirmed (engine, NOT cli-producer-app, NOT client-app, NOT content).** Open [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) §`engine` and confirm the new `src/ops/` subdirectory entry was added by the SPEC pre-flight commit (D-3501). Engine category rules apply to `packages/game-engine/src/ops/`: no `boardgame.io` import, no `Math.random()`, no `Date.now()` / `performance.now()`, no I/O, no registry import, no server import. The three `docs/ops/*.md` files are **non-engine** (documentation at the repo-root `docs/` tree) — category rules and paraphrase discipline (P6-43) do NOT apply to them.

If any gate is unresolved, STOP.

---

## Copilot Check (01.7) — COMPLETED, VERDICT: CONFIRM

Per [docs/ai/REFERENCE/01.7-copilot-check.md](../REFERENCE/01.7-copilot-check.md) §When Copilot Check Is Required + §Discipline. WP-035 is **Contract-Only + Documentation**, for which 01.7 is *recommended but optional*. It is included here explicitly because the WP introduces a new engine subdirectory (`src/ops/`), a new canonical data shape (`OpsCounters`) with four locked counter names, two closed literal unions (`DeploymentEnvironment`, `IncidentSeverity`), and three ops docs that lock operational semantics for the lifetime of the project.

The 30-issue scan was applied to the union of this session prompt + WP-035 + EC-035 + session-context-wp035. Summary verdicts below; any non-`PASS` finding is accompanied by a `FIX` folded directly into this prompt's Locked Values / Non-Negotiable Constraints / Verification Steps.

**Category 1 — Separation of Concerns & Boundaries**
- **#1 Engine vs UI / App Boundary Drift — PASS.** Ops types are metadata only; no engine logic modifies or reads them. Three ops docs live under `docs/ops/` (non-engine). WP-035 §Non-Negotiable "engine does not auto-heal" locks the asymmetry.
- **#9 UI Re-implements Engine Logic — PASS.** Ops docs describe release/deploy/incident procedures; the engine emits no UI state for them. RS-1 resolution (option (a) pure type) ensures no engine runtime instance exists for UI to re-read.
- **#16 Lifecycle Wiring Creep — PASS.** No `game.ts` edit, no move, no phase hook. §Files Expected to Change allowlist forbids it. 01.5 NOT INVOKED (see §Runtime Wiring Allowance below).
- **#29 Assumptions Leaking Across Layers — PASS.** §Goal item 7 explicitly: "The engine does not know deployment environments exist." Server and ops tooling consume the types; the engine never reads them back.

**Category 2 — Determinism & Reproducibility**
- **#2 Non-Determinism Introduced by Convenience — PASS.** `ops.types.ts` is pure type definitions — no functions, no runtime code. No `Math.random()`, `Date.now()`, or `performance.now()` possible. RS-1 option (a) locks the "no runtime instance" choice.
- **#8 No Single Debugging Truth Artifact — PASS.** Replay remains the canonical debugging artifact (D-0902 rollback path uses stamped artifacts from WP-034). Ops docs reference replay verification as a release gate, reinforcing.
- **#23 Lack of Deterministic Ordering Guarantees — PASS.** `DeploymentEnvironment` and `IncidentSeverity` are closed ordered unions; the four `OpsCounters` fields have a locked field order (see Locked Values).

**Category 3 — Immutability & Mutation Discipline**
- **#3 Pure vs Immer Confusion — PASS.** No functions in scope. No `G` mutation.
- **#17 Hidden Mutation via Aliasing — PASS.** No runtime instance per RS-1 option (a). Future consumers (server layer) that construct `OpsCounters` objects are outside WP-035 scope.

**Category 4 — Type Safety & Contract Integrity**
- **#4 Contract Drift Between Types, Tests, and Runtime — PASS.** EC-035 locks all five type shapes verbatim. This prompt copies them into §Locked Values. No drift-detection array is required (the two closed unions have fewer than five members each; a canonical-array seam is not proportionate per the 01.4 "Established Patterns" sizing rule).
- **#5 Optional Field Ambiguity — PASS.** All four `OpsCounters` fields are required `number`. Neither `DeploymentEnvironment` nor `IncidentSeverity` admits optionality. No `exactOptionalPropertyTypes` edge case.
- **#6 Undefined Merge Semantics — PASS.** No merging, overriding, or config-layering in scope.
- **#10 Stringly-Typed Outcomes — PASS.** Both union types are closed literal unions. Consumers must exhaustively switch.
- **#21 Type Widening at Boundaries — PASS.** No `string` / `any` / `unknown`. Field types are primitives with narrow unions.
- **#27 Weak Canonical Naming — PASS.** Field names are full English (`invariantViolations`, `rejectedTurns`, `replayFailures`, `migrationFailures`) — no abbreviations (Rule 4). `DeploymentEnvironment` and `IncidentSeverity` match their prose usages in docs verbatim.

**Category 5 — Persistence & Serialization**
- **#7 Persisting Runtime State — PASS.** Ops types never enter `G`. RS-1 option (a) forbids module-level instances. WP-035 §Packet-specific "Operational counter types are defined in the engine for monitoring but do not affect gameplay" locks the asymmetry.
- **#19 Weak JSON-Serializability — PASS.** All three types are plain objects / primitive unions — no `Map`, `Set`, `Date`, functions, or class instances. D-1232 holds.
- **#24 Mixed Persistence Concerns — PASS.** Ops docs separate release artifacts (Class 2 Configuration per D-0003) from runtime counters (never persisted; constructed on demand by ops tooling) from incident records (ops-system concern, outside engine).

**Category 6 — Testing & Invariant Enforcement**
- **#11 Tests Validate Behavior, Not Invariants — PASS with FIX.** WP-035 produces **zero new tests** (RS-2 lock). The existing 436 engine tests must continue to pass unchanged — no invariant regression. **FIX:** §Verification Steps explicitly asserts engine count **unchanged at 436 / 109 / 0 fail** as a post-flight check (catches any accidental test-file leak).

**Category 7 — Scope & Execution Governance**
- **#12 Scope Creep — PASS.** §Files Expected to Change is a strict six-file allowlist. `git diff --name-only` is a required verification step. P6-27 is active.
- **#13 Unclassified Directories — PASS.** D-3501 classifies `src/ops/` before execution (landed in Commit A0 SPEC pre-flight bundle per Pre-Session Gate #2). `docs/ops/` is non-engine; precedents (`docs/ai/`, `docs/screenshots/`, `docs/devlog/`) confirm top-level docs subdirectories need no D-entry (RS-4 resolution).
- **#30 Missing Pre-Session Governance Fixes — PASS.** PS-1 (D-3501) resolved in Commit A0 before this session opens. RS-1 through RS-4 resolved in this prompt's Locked Values.

**Category 8 — Extensibility & Future-Proofing**
- **#14 No Extension Seams — PASS.** `OpsCounters` is designed for future counter additions via a new WP + matching `DECISIONS.md` entry. `IncidentSeverity` is closed at P0–P3 intentionally (WP-035 §Locked contract values; adding a P4 is a governance decision, not a silent code change).
- **#28 No Upgrade or Deprecation Story — PASS.** Ops types are additive. No existing code assumes their absence. D-0801/D-0802 govern future shape evolution via `DataVersion` (WP-034); WP-035 itself does not bump `CURRENT_DATA_VERSION`.

**Category 9 — Documentation & Intent Clarity**
- **#15 Missing "Why" for Invariants — PASS.** `ops.types.ts` requires the `// why:` comment "counters are for passive monitoring; engine does not auto-heal" per EC-035 §Required `// why:` Comments. See §Required `// why:` Comments below.
- **#20 Ambiguous Authority Chain — PASS.** §Authority Chain below lists the read order (CLAUDE.md > rules > ARCHITECTURE > DECISIONS > EC > WP > session-context > this prompt).
- **#26 Implicit Content Semantics — PASS.** Each incident severity level locks an example AND a required action verbatim from WP-035. Each deployment environment locks a purpose.

**Category 10 — Error Handling & Failure Semantics**
- **#18 Outcome Evaluation Timing Ambiguity — PASS.** Release gates run *before* deployment (blocked if any gate fails). Rollback triggers run *after* deployment (operational signal). Both are locked by the release checklist and deployment flow docs. No runtime code introduces new timing concerns.
- **#22 Silent vs Loud Failure — PASS.** Release-gate failures block deployment loudly (binary pass/fail). Ops counters increment passively (engine does not auto-heal). P0 = immediate rollback (loud); P3 = backlog (soft). Consistent with D-0802 (loud at load/release boundaries) and D-1234 (soft in runtime observability) — mapping spelled out in incident-response doc.

**Category 11 — Single Responsibility & Logic Clarity**
- **#25 Overloaded Function Responsibilities — PASS.** No functions in scope. Each of the three docs has a single responsibility (release gate, deployment flow, incident response).

**Overall Judgment:** **PASS** — 30 issues scanned, 30 PASS (with one FIX folded into Verification Steps for #11). Pre-flight READY TO EXECUTE verdict stands. Session prompt generation is authorized.

**Disposition:** **CONFIRM** (not HOLD, not SUSPEND). No remediation blocks execution.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause + §Escalation. WP-035 is purely additive engine work (new `src/ops/` subdirectory) plus documentation. Each of the four 01.5 trigger criteria is enumerated below and marked absent:

| 01.5 Trigger Criterion | Applies to WP-035? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | `LegendaryGameState` is not modified. `OpsCounters` is a new standalone type; it does not extend, embed into, or widen the 9-field-locked runtime state shape. Ops types are metadata per WP-035 §Packet-specific ("do not affect gameplay"). |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | `buildInitialGameState` is unchanged. No setup orchestrator signature shifts. No `OpsCounters` instance is constructed at match setup (RS-1 option (a) locks this). |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move is added, removed, or renamed. No move-map length assertion is altered. Engine baseline **436 / 109 / 0 fail** must hold unchanged (see Verification Steps). |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook is added. No `ctx.events.setPhase()` / `ctx.events.endTurn()` call is introduced. No existing test asserts against `src/ops/`. |

**Conclusion:** 01.5 is NOT INVOKED. The scope lock below applies without the allowance. Any file beyond the allowlist in §Files Expected to Change is a scope violation per **P6-27**, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it.

---

## Authority Chain (Read in Order Before Coding)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary; engine code never imports `boardgame.io`, server, or registry in pure helpers
3. [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) — JSON-serializability, no-throw-from-helpers (no helpers added here), `// why:` discipline, no `.reduce()` with branching
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — `.test.ts` extension (none added), ESM-only, `node:` prefix where needed (none expected), no abbreviations, full-sentence error messages (none expected — no runtime code)
5. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Section 3 — The Three Data Classes (release artifacts are Class 2 Configuration; runtime `G` is Class 1 and is never deployed)
6. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) §Layer Boundary (Authoritative) — server layer handles deployment wiring; engine is never aware of environments
7. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) §`engine` — new `src/ops/` subdirectory must be in the engine list (D-3501, landed in Commit A0)
8. [docs/ai/execution-checklists/EC-035-release-ops.checklist.md](../execution-checklists/EC-035-release-ops.checklist.md) — primary execution authority (Locked Values + Guardrails + Required `// why:` Comments + Files to Produce)
9. [docs/ai/work-packets/WP-035-release-deployment-ops-playbook.md](../work-packets/WP-035-release-deployment-ops-playbook.md) — authoritative WP specification
10. [docs/ai/session-context/session-context-wp035.md](../session-context/session-context-wp035.md) — session-context bridge from WP-034; baselines, patterns, inherited quarantine
11. [docs/ai/DECISIONS.md](../DECISIONS.md) — **D-0003** (Data Outlives Code), **D-0801** (Explicit Version Axes), **D-0802** (Incompatible Data Fails Loudly), **D-0902** (Rollback Is Always Possible — the decision WP-035 implements), **D-0602** (Invalid Content Cannot Reach Runtime), **D-1002** (Immutable Surfaces Are Protected), **D-1232** (JSON-serializable contracts), **D-3401** (versioning engine category — immediate precedent for D-3501); plus new **D-3501** (ops subdirectory classification) added by the SPEC pre-flight commit
12. [packages/game-engine/src/index.ts](../../../packages/game-engine/src/index.ts) — the export surface WP-035 appends to (after WP-034's versioning block)
13. [packages/game-engine/src/versioning/versioning.check.ts](../../../packages/game-engine/src/versioning/versioning.check.ts) — WP-034 reference for engine-category pure-type files (WP-035's `ops.types.ts` mirrors the module-header discipline)

If any of these conflict, higher-authority documents win.

---

## Goal (Binary)

After this session, Legendary Arena has a complete, auditable release → deployment → incident playbook plus the engine-side type surface for operational monitoring. Specifically:

1. **`docs/ops/RELEASE_CHECKLIST.md` exists** as the mandatory pre-release gate. Every item is binary pass/fail. Release is blocked if any step fails. Contents locked by WP-035 §Scope (A) below.
2. **`docs/ops/DEPLOYMENT_FLOW.md` exists** with the four environments (dev/test/staging/prod), sequential promotion rules, the explicit "no hot-patching" rule, rollback triggers, and rollback rules (revert engine + content together; never roll `dataVersion` forward; re-apply last known good; no data loss). Contents locked by WP-035 §Scope (B).
3. **`docs/ops/INCIDENT_RESPONSE.md` exists** with severity levels P0–P3, each with locked example + required action, plus the four-field incident output requirement (root cause, invariant violated if applicable, version implicated, corrective action). Contents locked by WP-035 §Scope (C).
4. **`packages/game-engine/src/ops/ops.types.ts` exists** as a new engine subdirectory classified under D-3501, exporting `OpsCounters`, `DeploymentEnvironment`, and `IncidentSeverity` with the locked shapes. All types are `readonly` where applicable and JSON-serializable. Module header carries the required `// why:` comment (see §Required `// why:` Comments below).
5. **`packages/game-engine/src/types.ts` re-exports** the three new ops types. No `LegendaryGameState` modification. No change to any other re-export block.
6. **`packages/game-engine/src/index.ts` exports** the three new ops types on the public API surface, appended after the WP-034 versioning block.
7. **Engine baseline unchanged: 436 tests / 109 suites / 0 fail.** Repo-wide 526 / 0 fail. WP-035 produces **zero new tests** (RS-2 lock) — ops types are pure data definitions with no runtime instance (RS-1 option (a)).
8. **D-3501 landed** (pre-flight Commit A0) classifying `packages/game-engine/src/ops/` as engine code category. The eighth engine subdirectory precedent after D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 / D-3401.
9. **D-0902 implemented.** Every deployment now has a documented, tested rollback path. WP-042 (Deployment Checklists) is unblocked for specific deployment procedures.
10. **Engine does not know deployment exists.** The engine imports nothing from `docs/ops/`; ops counters are pure types with no engine-side mutation surface; no runtime wiring between engine and environment.

No registry changes. No server changes. No client changes. No new tests. No new npm dependencies.

---

## Locked Values (Do Not Re-Derive)

### Commit & governance prefixes
- **EC / commit prefix:** `EC-035:` on every code-changing commit; `SPEC:` on governance / doc-only commits; `WP-035:` is **forbidden** (commit-msg hook rejects per P6-36).
- **Commit topology (three commits, matching WP-034):**
  - **Commit A0 (`SPEC:`)** — pre-flight bundle: D-3501 in `DECISIONS.md` + D-3501 row in `DECISIONS_INDEX.md` + `src/ops/` entry in `02-CODE-CATEGORIES.md` §engine + this session prompt. **Must land before Commit A.**
  - **Commit A (`EC-035:`)** — code + 01.6 post-mortem: six files under §Files Expected to Change (3 new docs + 1 new type file + 2 modified re-exports) + `docs/ai/post-mortems/01.6-WP-035-release-deployment-ops-playbook.md`.
  - **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` + `EC_INDEX.md` + any `DECISIONS_INDEX.md` / `DECISIONS.md` follow-ups surfaced during execution.

### Four deployment environments (WP-035 §Locked contract values — verbatim)

| Environment | Purpose |
|---|---|
| `dev` | Engine & content development |
| `test` | Full validation, replay, migration checks |
| `staging` | Production-identical dry run |
| `prod` | Live players |

Promotion order: **dev → test → staging → prod** (sequential, never skip).

- dev → test: **automated on build success**
- test → staging: **manual gate after full validation**
- staging → prod: **manual gate after smoke tests + replay verification**

Each promotion step is **atomic**. **No hot-patching in prod** — only versioned artifact deployments.

### Four incident severity levels (WP-035 §Locked contract values — verbatim)

| Level | Example | Action |
|---|---|---|
| `P0` | Corrupted game state | Immediate rollback |
| `P1` | Replay desync | Freeze deployments |
| `P2` | Invalid turn spikes | Investigate |
| `P3` | Content lint warnings | Backlog |

Every incident produces: **root cause, invariant violated (if applicable), version implicated, corrective action**.

### Type shapes (locked verbatim from EC-035 §Locked Values)

```ts
// ops.types.ts

export interface OpsCounters {
  readonly invariantViolations: number;
  readonly rejectedTurns: number;
  readonly replayFailures: number;
  readonly migrationFailures: number;
}

export type DeploymentEnvironment = 'dev' | 'test' | 'staging' | 'prod';

export type IncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';
```

- **Field order in `OpsCounters` is locked:** `invariantViolations`, `rejectedTurns`, `replayFailures`, `migrationFailures`. No alphabetization, no grouping, no renaming.
- **Union member order is locked:** `DeploymentEnvironment` strings appear in promotion order (dev → test → staging → prod). `IncidentSeverity` strings appear in descending urgency (P0 → P1 → P2 → P3).
- **Each `readonly` prefix on `OpsCounters` fields is required** — the interface represents a snapshot of counter values at a point in time; downstream consumers must reconstruct a new object rather than mutate in place. This mirrors the D-2802 aliasing-prevention discipline extended to ops observability surfaces.
- **No abbreviations.** `invariantViolations` not `invViolations`; `rejectedTurns` not `rejTurns`. Rule 4 of `00.6-code-style.md`.

### Runtime ownership (RS-1 resolution)

**Option (a): pure type, no runtime instance.** WP-035 ships only the type definitions in `ops.types.ts`. **No runtime `OpsCounters` instance is constructed anywhere in the engine.** Observability tooling (server layer, future ops dashboard, future WP-042 deployment procedures) is responsible for construction, storage, incrementing, and persistence. The engine never reads or writes a counter.

Rationale: matches WP-035 §Non-Negotiable ("monitoring is passive", "no engine logic changes"). Eliminates the three risks of option (b) (module-level singleton mutates engine-shared state — D-1232 risk) and option (c) (field on `G` — forbidden by the 9-field `MatchSetupConfig` lock + the `LegendaryGameState` runtime-shape discipline). A future WP that needs engine-side counter incrementing would require a separate D-entry and is explicitly out of scope here.

### Test-count lock (RS-2 resolution)

- **WP-035 produces zero new tests.** No `*.test.ts` file is added.
- **Engine count MUST remain 436 / 109 suites / 0 fail** after this WP lands.
- **Repo-wide count MUST remain 526 / 0 fail** after this WP lands.
- Any test file appearing under `packages/game-engine/src/ops/**/*.test.ts` is a scope violation — the engine baseline check will catch it.

### `docs/ops/` directory (RS-4 resolution)

- `docs/ops/` is a **new top-level docs subdirectory**, accepted without a new D-entry. Precedent: `docs/ai/`, `docs/screenshots/`, `docs/devlog/` all exist as top-level non-engine docs subdirectories without individual D-entries.
- **No `CLAUDE.md` in `docs/ops/` at MVP.** WP-042 may add one later when deployment-specific procedures accumulate.
- The three docs files are **rendered markdown** — not linted as engine code, not subject to paraphrase discipline (P6-43). `Date.now`, `Math.random`, `boardgame.io`, etc. may appear in deployment-procedure rationale text ("do not read `Date.now` in production code paths") without tripping the verification gates (which run against `packages/game-engine/src/ops/` only).

### D-3501 (pre-flight precondition)

Landed in Commit A0 SPEC pre-flight bundle. Summary row in `DECISIONS_INDEX.md`; full entry in `DECISIONS.md`:

- **Title:** `D-3501 — Ops subdirectory classification`
- **Status:** Immutable
- **Content summary:** `packages/game-engine/src/ops/` is engine-category code. No `boardgame.io`, no RNG, no wall-clock reads, no I/O. Mirrors the seven prior precedents (D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 / D-3401). No sub-rule carve-outs (unlike D-3401's `new Date().toISOString()` exception for `savedAt` metadata — `ops.types.ts` is pure types with no load-boundary wall-clock need).

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Never `import` `boardgame.io` in any `src/ops/*.ts` file (verified via Grep).
- Never `import` `@legendary-arena/registry` or anything under `apps/server/` or `apps/` from ops.
- Never `import` from `src/versioning/`, `src/replay/`, `src/campaign/`, `src/persistence/`, `src/content/`, `src/network/`, `src/invariants/`, `src/ui/`, `src/scoring/`, `src/moves/`, or `src/rules/` inside `src/ops/`. Ops types are the leaf of the engine-export DAG; they depend on nothing engine-internal.
- Never use `Math.random()` — ops types are pure type definitions; no randomness possible (verified via Grep).
- Never use `Date.now()` or `performance.now()` — ops types have no load-boundary wall-clock need (unlike `versioning.stamp.ts` which has D-3401 carve-out).
- Never use `new Date()` — same reason; D-3401 carve-out is versioning-only.
- No I/O, no filesystem, no network, no env access in `src/ops/` (Verification Step 5 grep for `node:fs`, `node:net`, `node:http`, `process.env`).
- ESM only; Node v22+. `node:` prefix on any Node built-in imports (none expected in production code).
- Test files use `.test.ts` extension — none expected in this WP (RS-2 lock).
- Full file contents for every new or modified file in the output. No diffs.
- Human-style code per [docs/ai/REFERENCE/00.6-code-style.md](../REFERENCE/00.6-code-style.md) — no abbreviations, JSDoc on every export, `// why:` on non-obvious code, no `import *`, no barrel re-exports, no default exports.
- **Forbidden dependencies (lint §7):** no `axios`, no `node-fetch`, no ORMs, no Jest / Vitest / Mocha (only `node:test`). **No new npm dependencies introduced by this packet.** `pnpm-lock.yaml` must NOT appear in the diff.

**Packet-specific:**
- **This packet produces documentation and type definitions — not deployment scripts or CI/CD pipelines** (WP-035 §Packet-specific). No `.yml` / `.yaml` CI files, no Dockerfiles, no shell scripts, no Render / GitHub Actions configs.
- **Release artifacts are immutable once published — no hot-patching in prod.** This rule is stated explicitly in `DEPLOYMENT_FLOW.md`.
- **Every release is gated by validation.** Release is blocked if any gate fails. This rule is stated explicitly in `RELEASE_CHECKLIST.md` as a binary pass/fail list.
- **Every deployment has a tested rollback path (D-0902).** Rollback must complete without data loss. This rule is stated explicitly in `DEPLOYMENT_FLOW.md` §Rollback Rules.
- **Environment promotion is sequential:** dev → test → staging → prod. No skipping. Stated explicitly in `DEPLOYMENT_FLOW.md`.
- **The engine does not auto-heal — monitoring is passive, humans decide actions.** Stated explicitly in `INCIDENT_RESPONSE.md` and as the `// why:` comment on `ops.types.ts`.
- **No runtime code changes in this packet** — ops contracts and documentation only. No modification to `game.ts`, any move file, any phase hook, `buildInitialGameState`, or any existing test.
- **Operational counter types are defined in the engine for monitoring but do not affect gameplay.** This is the rationale for the `// why:` comment on `ops.types.ts`.
- **D-0802 vs D-1234 mapping in incident response:** P0 (immediate rollback) maps to D-0802 load-boundary fail-loud semantics — corrupted state cannot proceed. P3 (backlog) maps to D-1234 graceful-degradation semantics — content lint warnings do not block a release. The `INCIDENT_RESPONSE.md` doc must spell this mapping out explicitly in prose (not just imply it) so future authors understand why the severity ladder has the shape it does.
- **D-0602 enforcement in release checklist:** "Content validation passes with zero errors" is a MANDATORY gate, not a warning tolerance. Zero-error policy reflects D-0602 (Invalid Content Cannot Reach Runtime).
- **D-0801 enforcement in release checklist:** "Version stamps are correct (`EngineVersion`, `DataVersion`, `ContentVersion`)" is a MANDATORY gate. Release artifacts without stamps fail the load-time `checkCompatibility` check (WP-034) and would be refused at boot — catching this at release time is cheaper.

**Session protocol:**
- If the engine baseline diverges from 436 / 109 suites at session start, STOP — the WP-035 test-count lock depends on this.
- If any of D-0003 / D-0801 / D-0802 / D-0902 / D-0602 / D-1002 cannot be located in `DECISIONS.md` (em-dash form per P6-2), STOP — the WP's foundation is missing.
- If the SPEC pre-flight commit did NOT land D-3501 + the `02-CODE-CATEGORIES.md` update, STOP — execution is blocked on the directory-classification precedent.
- If any contract, field name, or reference is unclear, STOP and ask before proceeding.

---

## Required `// why:` Comments

- **`ops.types.ts` module header** (at top, above the first export): per EC-035 §Required `// why:` Comments, verbatim: *"Counters are for passive monitoring; the engine does not auto-heal. Downstream observability tooling (server layer, future ops dashboard) is responsible for construction, incrementing, and persistence of `OpsCounters` instances. The engine never reads or writes a counter at runtime (RS-1 option (a); D-3501)."*
- **`ops.types.ts` above `OpsCounters` interface**: *"All four fields are `readonly number`. Field order is locked — `invariantViolations`, `rejectedTurns`, `replayFailures`, `migrationFailures` — to match the operational-hierarchy ordering used in `docs/ops/INCIDENT_RESPONSE.md` (fail-loud before fail-soft). D-1232 applies: plain-object shape, JSON-serializable, no `Map`/`Set`/`Date`/functions."*
- **`ops.types.ts` above `DeploymentEnvironment` union**: *"Four environments in sequential promotion order (dev → test → staging → prod). This order is the one enforced by `docs/ops/DEPLOYMENT_FLOW.md` and must not be re-derived. Adding a fifth environment requires a new D-entry and a coordinated documentation update (no silent expansion)."*
- **`ops.types.ts` above `IncidentSeverity` union**: *"Four levels in descending urgency (P0 → P1 → P2 → P3). The severity-to-action mapping is locked in `docs/ops/INCIDENT_RESPONSE.md`. P0 inherits D-0802 fail-loud semantics (immediate rollback on corrupted state); P3 inherits D-1234 graceful-degradation semantics (content lint warnings backlog). Adding a P4 requires a new D-entry — this is a governance change, not a code change."*
- **`docs/ops/RELEASE_CHECKLIST.md`** does NOT require `// why:` comments (markdown docs use prose rationale, not code comments). However, the doc MUST include a "Why these gates" section explaining the D-entry mapping (D-0602 → content validation; D-0801 → version stamps; D-0802 → migration tests; D-0902 → implicit prerequisite for rollback path).
- **`docs/ops/DEPLOYMENT_FLOW.md`** MUST include a "Why no hot-patching" section citing D-1002 (Immutable Surfaces Are Protected) and WP-035 §Packet-specific.
- **`docs/ops/INCIDENT_RESPONSE.md`** MUST include the D-0802 vs D-1234 severity-mapping explanation in prose (see Non-Negotiable Constraints §Packet-specific above).

No `// why:` comment is required in `types.ts` or `index.ts` for the re-exports (they are additive wiring, not new semantics). Exactly mirrors the WP-034 pattern at `5139817`.

---

## Files Expected to Change (Allowlist — P6-27 ENFORCED)

Any file beyond this list is a scope violation. STOP and escalate.

### New — ops documentation (under repo-root `docs/ops/`)
1. `docs/ops/RELEASE_CHECKLIST.md` — **new**. Mandatory pre-release gate. Binary pass/fail checklist covering: all engine tests pass; content validation passes with zero errors; replay verification passes; migration tests pass if `dataVersion` changes; UI contract unchanged or versioned; version stamps are correct (`EngineVersion`, `DataVersion`, `ContentVersion`); release notes authored. Plus a "Why these gates" rationale section.
2. `docs/ops/DEPLOYMENT_FLOW.md` — **new**. Four environments (dev/test/staging/prod) with purposes; sequential promotion rules (dev → test automated; test → staging manual after validation; staging → prod manual after smoke + replay); atomicity statement; explicit no-hot-patching rule (with "Why no hot-patching" section citing D-1002); rollback triggers (invariant violation, replay hash mismatch, migration failure, desync incidents); rollback rules (revert engine + content together; never roll `dataVersion` forward; re-apply last known good artifact; no data loss).
3. `docs/ops/INCIDENT_RESPONSE.md` — **new**. Severity table (P0–P3) with examples and actions (verbatim from Locked Values); incident-output four-field requirement (root cause, invariant violated if applicable, version implicated, corrective action); P0/P1 immediate-action prose; P2/P3 backlog prose; D-0802 vs D-1234 severity-mapping explanation.

### New — engine code (classified under D-3501)
4. `packages/game-engine/src/ops/ops.types.ts` — **new**. Exports `OpsCounters`, `DeploymentEnvironment`, `IncidentSeverity` per §Locked Values. Module header + three inline `// why:` comments per §Required `// why:` Comments. JSDoc on every export. No runtime values — types only.

### Modified — engine wiring
5. `packages/game-engine/src/types.ts` — **modified**. Re-export `OpsCounters`, `DeploymentEnvironment`, `IncidentSeverity` in a new block (append after the WP-034 versioning re-export block, under a `// Ops metadata (WP-035 / D-3501)` comment). **No `LegendaryGameState` modification.** **No modification to any pre-existing re-export.**
6. `packages/game-engine/src/index.ts` — **modified**. Public API surface: export the three new ops types from `./ops/ops.types.js` in a new block (append after the WP-034 versioning block, under a `// Ops metadata (WP-035 / D-3501)` comment). **No modification to any pre-existing export.**

### Modified — governance (Commit B; not Commit A)
- `docs/ai/STATUS.md` — **modified** per DoD. Prepend a WP-035 execution entry to §Current State: release process defined, four deployment environments established, rollback strategy documented, D-0902 implemented, WP-042 unblocked.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified**. Flip WP-035 to `[x]` with today's date and a link to this prompt and the Commit A hash.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified**. Flip EC-035 from Draft to Done with `Executed YYYY-MM-DD at commit <hash>`; refresh footer.
- `docs/ai/DECISIONS_INDEX.md` — **modified** (only if execution surfaces a new D-entry beyond D-3501 already landed in Commit A0).
- `docs/ai/DECISIONS.md` — **modified** (only if execution surfaces a new D-entry beyond D-3501 already landed in Commit A0).

### Must remain UNTOUCHED
- `packages/game-engine/src/types.ts` `LegendaryGameState` shape and all pre-WP-035 re-exports (only the new Ops block is appended)
- `packages/game-engine/src/setup/buildInitialGameState.ts` (RS-1 option (a) — no runtime instance)
- `packages/game-engine/src/game.ts` (no move, no phase hook)
- `packages/game-engine/src/versioning/`, `src/scoring/`, `src/replay/`, `src/campaign/`, `src/persistence/`, `src/content/`, `src/network/`, `src/invariants/`, `src/ui/`, `src/moves/`, `src/rules/`, `src/zones/` — all read-only (ops types never import from them)
- `apps/`, `packages/registry/`, `packages/vue-sfc-loader/`
- `apps/arena-client/package.json`, `pnpm-lock.yaml` (no new deps)
- `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` (D-3501 entry already landed in Commit A0)
- `docs/ai/DECISIONS.md` and `docs/ai/DECISIONS_INDEX.md` (D-3501 rows already landed in Commit A0; touched again only if a new D-entry surfaces during execution)
- All inherited dirty-tree files (M `session-wp079-...`; `??` files listed in Pre-Session Gate #4)
- Both retained stashes (`stash@{0}`, `stash@{1}`) — **NEVER pop**
- The EC-069 `<pending — gatekeeper session>` placeholder — **do NOT backfill**

---

## Acceptance Criteria

### Layer Boundary (engine code only — `src/ops/`)
- [ ] No `boardgame.io` import in any `src/ops/*.ts` file (Grep returns no matches).
- [ ] No `@legendary-arena/registry`, `apps/server`, or `apps/` import in `src/ops/` (Grep returns no matches).
- [ ] No import from any other `src/*/` subdirectory inside `src/ops/` (Grep returns no matches).
- [ ] No `Math.random`, `Date.now`, `performance.now`, or `new Date()` in `src/ops/` (Grep returns no matches).
- [ ] No `.reduce()` in `src/ops/` (Grep returns no matches).
- [ ] No I/O (Grep returns no matches for `node:fs`, `node:net`, `node:http`, `process.env`).
- [ ] No `require(` in `src/ops/` (Grep returns no matches).

### Ops Types
- [ ] `OpsCounters` defined with exactly four `readonly number` fields in locked order: `invariantViolations`, `rejectedTurns`, `replayFailures`, `migrationFailures`.
- [ ] `DeploymentEnvironment` is a closed union of exactly four values in locked order: `'dev' | 'test' | 'staging' | 'prod'`.
- [ ] `IncidentSeverity` is a closed union of exactly four values in locked order: `'P0' | 'P1' | 'P2' | 'P3'`.
- [ ] All three types are JSON-serializable (plain primitives + object literal — no `Map`, `Set`, `Date`, functions, class instances).
- [ ] `types.ts` re-exports all three; `index.ts` exports all three.
- [ ] No runtime value exported from `ops.types.ts` — types only (RS-1 option (a)).

### Release Checklist Doc
- [ ] `docs/ops/RELEASE_CHECKLIST.md` exists with all seven gate items (engine tests; content validation zero errors; replay verification; migration tests if `dataVersion` changes; UI contract unchanged or versioned; version stamps correct; release notes authored).
- [ ] Every gate item is binary pass/fail.
- [ ] "Release is blocked if any gate fails" statement is present and unambiguous.
- [ ] "Why these gates" rationale section cites D-0602, D-0801, D-0802, D-0902.

### Deployment Flow Doc
- [ ] `docs/ops/DEPLOYMENT_FLOW.md` exists with the four environments table (verbatim from Locked Values).
- [ ] Promotion is sequential: dev → test → staging → prod. No skipping statement is present.
- [ ] dev → test automation rule, test → staging manual-gate rule, staging → prod manual-gate rule all present and explicit.
- [ ] "No hot-patching in prod" rule is explicit, with "Why no hot-patching" section citing D-1002.
- [ ] Rollback triggers listed: invariant violation, replay hash mismatch, migration failure, desync incidents.
- [ ] Rollback rules present: revert engine + content together; never roll `dataVersion` forward; re-apply last known good; no data loss.

### Incident Response Doc
- [ ] `docs/ops/INCIDENT_RESPONSE.md` exists with P0–P3 severity table (verbatim from Locked Values).
- [ ] Each level has: example, required action.
- [ ] Four-field incident output requirement documented (root cause; invariant violated if applicable; version implicated; corrective action).
- [ ] P0/P1 immediate-action vs P2/P3 backlog distinction is explicit.
- [ ] D-0802 vs D-1234 severity-mapping explanation present in prose.

### Build & Test Baselines
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0.
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0.
- [ ] Engine count **UNCHANGED at 436 / 109 / 0 fail** (RS-2 lock — WP-035 adds zero tests).
- [ ] `pnpm -r test` exits 0 with **526 passing, 0 failing** (unchanged).

### Scope Enforcement
- [ ] No files outside §Files Expected to Change were modified (`git diff --name-only`).
- [ ] `packages/game-engine/src/versioning/`, `scoring/`, `replay/`, `campaign/`, `persistence/`, `content/`, `network/`, `invariants/`, `ui/`, `setup/`, `moves/`, `rules/`, `zones/` all clean per `git diff`.
- [ ] `game.ts`, `buildInitialGameState.ts` clean per `git diff`.
- [ ] `apps/`, `packages/registry/`, `packages/vue-sfc-loader/` all clean.
- [ ] `pnpm-lock.yaml` absent from diff (no new dep).
- [ ] Neither `stash@{0}` nor `stash@{1}` popped. EC-069 placeholder NOT backfilled. No inherited dirty-tree file staged.

### Governance
- [ ] D-3501 present in `DECISIONS.md` and `DECISIONS_INDEX.md` (landed in Commit A0).
- [ ] `src/ops/ (D-3501)` entry present in `02-CODE-CATEGORIES.md` §engine (landed in Commit A0).
- [ ] `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md` updated per DoD (Commit B).
- [ ] EC-035 flipped from Draft to Done with `Executed YYYY-MM-DD at commit <hash>` in `EC_INDEX.md` + footer refresh.

---

## Verification Steps (run in order)

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — engine test count unchanged (RS-2 lock)
pnpm --filter @legendary-arena/game-engine test
# Expected: exits 0; 436 passing / 109 suites / 0 failing

# Step 3 — repo-wide regression (RS-3 explicit test gate)
pnpm -r test
# Expected: 526 passing, 0 failing

# Step 4 — confirm ops docs exist
Test-Path "docs\ops\RELEASE_CHECKLIST.md"
Test-Path "docs\ops\DEPLOYMENT_FLOW.md"
Test-Path "docs\ops\INCIDENT_RESPONSE.md"
# Expected: True, True, True

# Step 5 — confirm ops types exist and no forbidden imports
Select-String -Path "packages\game-engine\src\ops" -Pattern "boardgame\.io|@legendary-arena/registry|apps/server|apps/" -Recurse
# Expected: no output

# Step 6 — confirm no non-determinism
Select-String -Path "packages\game-engine\src\ops" -Pattern "Math\.random|performance\.now|Date\.now|new Date\(" -Recurse
# Expected: no output

# Step 7 — confirm no cross-subdirectory engine imports from ops
Select-String -Path "packages\game-engine\src\ops" -Pattern "from '(\.\./)+(versioning|scoring|replay|campaign|persistence|content|network|invariants|ui|moves|rules|zones|setup)/" -Recurse
# Expected: no output

# Step 8 — confirm no I/O
Select-String -Path "packages\game-engine\src\ops" -Pattern "node:fs|node:net|node:http|process\.env" -Recurse
# Expected: no output

# Step 9 — confirm no .reduce() and no require()
Select-String -Path "packages\game-engine\src\ops" -Pattern "\.reduce\(|require\(" -Recurse
# Expected: no output

# Step 10 — confirm no engine logic modified
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/ packages/game-engine/src/setup/
# Expected: no output

# Step 11 — confirm other engine subtrees untouched
git diff --name-only packages/game-engine/src/versioning/ packages/game-engine/src/scoring/ packages/game-engine/src/replay/ packages/game-engine/src/campaign/ packages/game-engine/src/persistence/ packages/game-engine/src/content/ packages/game-engine/src/network/ packages/game-engine/src/invariants/ packages/game-engine/src/ui/ packages/game-engine/src/zones/
# Expected: no output

# Step 12 — confirm only expected files changed in Commit A
git diff --name-only
# Expected: only the 6 files in §Files Expected to Change (3 new docs + 1 new type file + types.ts + index.ts) plus the 01.6 post-mortem

# Step 13 — confirm pnpm-lock absent (no new deps)
git diff --name-only | Select-String "^pnpm-lock\.yaml$"
# Expected: no output

# Step 14 — confirm D-3501 landed (Commit A0 precondition)
Select-String -Path "docs\ai\DECISIONS.md" -Pattern "D.3501"
Select-String -Path "docs\ai\DECISIONS_INDEX.md" -Pattern "D.3501"
Select-String -Path "docs\ai\REFERENCE\02-CODE-CATEGORIES.md" -Pattern "src/ops/"
# Expected: at least one match each

# Step 15 — confirm no test file leaked into src/ops/
Get-ChildItem -Path "packages\game-engine\src\ops" -Filter "*.test.ts" -Recurse
# Expected: no output (RS-2 lock: WP-035 produces zero tests)

# Step 16 — confirm inherited quarantine intact
git stash list
# Expected: both stash@{0} and stash@{1} still present

Select-String -Path "docs\ai\execution-checklists\EC_INDEX.md" -Pattern "pending.*gatekeeper session"
# Expected: still present (EC-069 placeholder not backfilled)
```

---

## Post-Mortem — MANDATORY (P6-35)

Per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). Two triggering criteria apply:

1. **New long-lived abstraction:** `OpsCounters`, `DeploymentEnvironment`, and `IncidentSeverity` are the canonical operational-metadata surface going forward. The three shapes + the three ops docs will be referenced by WP-042 (deployment checklists), future monitoring WPs, and every subsequent release cycle. Lock the shapes + prose at MVP.
2. **New code-category directory:** `packages/game-engine/src/ops/` is the 8th engine subdirectory needing classification (D-3501). Same pattern as D-2706 / D-2801 / D-3001 / D-3101 / D-3201 / D-3301 / D-3401.

Run the formal 10-section 01.6 output, save at `docs/ai/post-mortems/01.6-WP-035-release-deployment-ops-playbook.md`, and stage into Commit A.

---

## Definition of Done

- [ ] Pre-Session Gates #1–#5 all resolved.
- [ ] Copilot Check (§01.7 section above) verdict CONFIRM re-read and honored during execution.
- [ ] All Acceptance Criteria above pass.
- [ ] All Verification Steps return expected output.
- [ ] No `boardgame.io`, registry, server, or cross-subdirectory engine import in any new file.
- [ ] No wall-clock / `Math.random` / `Date.now` / `performance.now` / `new Date()` in `src/ops/`.
- [ ] No `.reduce()`. No I/O. No `require()`.
- [ ] Engine count **unchanged at 436 / 109 / 0 fail**; repo-wide **526 / 0 fail**.
- [ ] All required `// why:` comments present at the sites listed in §Required `// why:` Comments.
- [ ] All three ops docs contain their required prose sections (rationale, D-entry citations, severity-mapping explanation).
- [ ] `STATUS.md`, `WORK_INDEX.md`, `EC_INDEX.md` updated in Commit B.
- [ ] EC-035 Draft → Done with commit hash + footer refresh.
- [ ] Commit A0 uses `SPEC:` prefix (pre-flight bundle, landed before this session); Commit A uses `EC-035:` prefix; Commit B uses `SPEC:` prefix.
- [ ] **01.6 post-mortem complete (MANDATORY per P6-35)** — formal 10-section output at `docs/ai/post-mortems/01.6-WP-035-release-deployment-ops-playbook.md`, in-session, staged into Commit A.
- [ ] Both inherited stashes intact (`stash@{0}`, `stash@{1}`); no inherited dirty-tree files staged; EC-069 placeholder not backfilled.

---

## Out of Scope (Explicit)

- **No CI/CD pipeline implementation** — this packet defines the process, not the tooling (GitHub Actions, Render webhooks, shell scripts).
- **No cloud provider configuration** — environment model is provider-agnostic.
- **No logging stack selection** — monitoring counters are defined; collection is ops tooling.
- **No alerting integrations** — monitoring is passive in MVP.
- **No deployment scripts** — WP-042 provides specific deployment checklists.
- **No engine logic changes** — ops types are metadata, not gameplay. No move, phase hook, rule, or setup change.
- **No persistence / database access.**
- **No new tests** (RS-2 lock).
- **No runtime `OpsCounters` instance anywhere in the engine** (RS-1 option (a)).
- **No new npm dependencies.**
- **No modification to any pre-existing engine subdirectory, any pre-existing re-export, any pre-existing test, or any governance document beyond the six files in §Files Expected to Change (Commit A) plus the four files in the governance list (Commit B).**
- **No backfill of the EC-069 `<pending — gatekeeper session>` placeholder** (owned by a separate SPEC session).
- **No pop of `stash@{0}` or `stash@{1}`** (owned by the WP-068 / MOVE_LOG_FORMAT resolver).
- Refactors, cleanups, or "while I'm here" improvements are out of scope unless explicitly listed in §Files Expected to Change above.

---

## Final Instruction

Execute exactly this scope. No synthesis, no scope expansion, no "helpful" additions. If any required modification cannot be classified as within the WP-035 allowlist, STOP and escalate rather than force-fitting. **P6-27 is active.** The 01.7 Copilot Check verdict CONFIRM above presumes the Locked Values and Non-Negotiable Constraints are honored literally — any deviation during execution re-opens the scan.

When finished: run all verification steps, capture output, run the mandatory 01.6 post-mortem, then commit per the established three-commit pattern (Commit A0: `SPEC:` pre-flight bundle — already landed; Commit A: `EC-035:` code + post-mortem; Commit B: `SPEC:` governance close).
