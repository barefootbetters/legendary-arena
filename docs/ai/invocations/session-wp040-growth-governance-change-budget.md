# Session Prompt — WP-040 Growth Governance & Change Budget

**Work Packet:** [docs/ai/work-packets/WP-040-growth-governance-change-budget.md](../work-packets/WP-040-growth-governance-change-budget.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-040-growth-governance.checklist.md](../execution-checklists/EC-040-growth-governance.checklist.md)
**Session Context:** [docs/ai/session-context/session-context-wp040.md](../session-context/session-context-wp040.md)
**Pre-Flight v1 (DO NOT EXECUTE YET):** [docs/ai/invocations/preflight-wp040-growth-governance-change-budget.md](preflight-wp040-growth-governance-change-budget.md)
**Pre-Flight v2 (READY TO EXECUTE):** [docs/ai/invocations/preflight-wp040-growth-governance-change-budget-v2.md](preflight-wp040-growth-governance-change-budget-v2.md)
**Copilot Check (CONFIRM):** [docs/ai/invocations/copilot-wp040-growth-governance-change-budget.md](copilot-wp040-growth-governance-change-budget.md)
**Commit prefix:** `EC-040:` on content commit; `SPEC:` on pre-flight bundle and governance close commits; `WP-040:` is **forbidden** (commit-msg hook rejects per P6-36).
**Pre-flight verdict:** READY TO EXECUTE (v2) — four v1 blockers (Findings 1–4) resolved by Path A; three pre-session actions (PS-1 D-4001, PS-2 P6-51 form (2), PS-3 P6-52 paraphrase discipline) resolved at governance + pre-flight level; copilot check CONFIRM (27/30 PASS, 3 scope-neutral RISKs with FIXes folded into this prompt's §Locked Values).
**WP Class:** Contract-Only / Documentation + Types — one new doc + one new types file + two additive re-exports + one new post-mortem. Zero `G` touch. Zero moves, phases, or hooks. Zero runtime logic. Zero new tests.
**Primary layer:** Product Governance / Change Control / Sustainable Growth — documentation + types; `docs/governance/` is Docs category; `packages/game-engine/src/governance/` is engine code category per D-4001.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-040:` on content commit; `SPEC:` on pre-flight bundle and governance close. If anyone insists on `WP-040:`, STOP — the commit-msg hook rejects it per **P6-36**.

2. **Governance pre-committed.** The pre-flight bundle (this prompt + v1 preflight + v2 preflight + copilot check + Path A rewrites of WP-040 + EC-040 + the D-4001 additions to DECISIONS.md + DECISIONS_INDEX.md + 02-CODE-CATEGORIES.md + the session-context-wp040.md bridge at `c861b24`) must land as the first commit of this session. Subject:

   `SPEC: WP-040 pre-flight bundle — v1 + v2 preflights, copilot check, Path A tightening, D-4001 code-category classification`

3. **Unrelated working-tree drift — land as a separate SPEC commit BEFORE Commit A0.** At pre-flight v1 the working tree contained four unrelated documentation modifications (Gate 8 drift, RS-6):

   - `docs/00-INDEX.md` (unrelated back-sync)
   - `docs/05-ROADMAP-MINDMAP.md` (unrelated back-sync)
   - `docs/05-ROADMAP.md` (unrelated back-sync)
   - `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` (+194 lines appending P6-52 + P6-53 precedents — the precedents this WP-040 pre-flight cites)

   Land these as **Commit A0a** (SPEC-prefix governance-housekeeping) **before** the WP-040 Commit A0 pre-flight bundle. Suggested subject:

   `SPEC: land P6-52 + P6-53 precedents in 01.4, back-sync 00-INDEX / 05-ROADMAP / 05-ROADMAP-MINDMAP`

   This keeps Commit A0's diff clean (only WP-040-scoped files). If the drift has already been committed before this session opens, Commit A0a is skipped and this gate is trivially satisfied.

4. **Upstream dependency green at session base commit.** Run `pnpm --filter @legendary-arena/game-engine test`. Expected engine baseline: **444 passing / 110 suites / 0 failing** (recorded at pre-flight v2 on 2026-04-23). Also run `pnpm -r test` for repo-wide baseline — expected **596 passing / 0 failing**. Record the current number in STATUS.md (the repo may have advanced since the v2 pre-flight; if so, use the current number, do not edit this prompt).

5. **Working-tree hygiene.** At session start `git status --short` should show:
   - ` M docs/ai/work-packets/WP-040-growth-governance-change-budget.md` — Path A rewrite (belongs to Commit A0)
   - ` M docs/ai/execution-checklists/EC-040-growth-governance.checklist.md` — Path A rewrite (belongs to Commit A0)
   - ` M docs/ai/DECISIONS.md` — D-4001 append (belongs to Commit A0)
   - ` M docs/ai/DECISIONS_INDEX.md` — D-4001 row (belongs to Commit A0)
   - ` M docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — `src/governance/` registration (belongs to Commit A0)
   - `?? docs/ai/invocations/preflight-wp040-growth-governance-change-budget.md` — v1 preflight (belongs to Commit A0)
   - `?? docs/ai/invocations/preflight-wp040-growth-governance-change-budget-v2.md` — v2 preflight (belongs to Commit A0)
   - `?? docs/ai/invocations/copilot-wp040-growth-governance-change-budget.md` — copilot check (belongs to Commit A0)
   - `?? docs/ai/invocations/session-wp040-growth-governance-change-budget.md` — this prompt (belongs to Commit A0)
   - `?? .claude/worktrees/` — inherited; do **NOT** stage

   Plus the Commit A0a drift (if not already landed) — see gate 3.

   **CRITICAL:** Stage-by-exact-filename per **P6-27 / P6-44**. `git add .` / `git add -A` / `git add -u` are **forbidden** — they would sweep `.claude/worktrees/` into the commit.

6. **Code-category classification confirmed.** `packages/game-engine/src/governance/` is classified as engine code category per D-4001 (landed with Commit A0; see [docs/ai/DECISIONS.md](../DECISIONS.md) and [docs/ai/REFERENCE/02-CODE-CATEGORIES.md:105](../REFERENCE/02-CODE-CATEGORIES.md)). `docs/governance/` is a new top-level docs subdirectory — no classification D-entry required (RS-7 disposition; new `docs/<subdir>/` directories are not gated by 02-CODE-CATEGORIES.md; precedents: `docs/ops/` created by WP-035 without classification, `docs/beta/` by WP-037).

7. **Authority-chain re-read confirmation.** Before writing any file in Commit A, the executor must re-read (P6-53 discipline):
   - [docs/ai/ARCHITECTURE.md §MVP Gameplay Invariants](../ARCHITECTURE.md) — **AUTHORITATIVE** for immutable engine invariants
   - [docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)](../ARCHITECTURE.md) — **AUTHORITATIVE** for the five-layer partition
   - [docs/ops/LIVE_OPS_FRAMEWORK.md §8 Change Management](../../ops/LIVE_OPS_FRAMEWORK.md) — **AUTHORITATIVE** for allowed/forbidden change matrix
   - [packages/game-engine/src/ops/ops.types.ts](../../../packages/game-engine/src/ops/ops.types.ts) — **AUTHORITATIVE** for `IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment`
   - [docs/ops/INCIDENT_RESPONSE.md](../../ops/INCIDENT_RESPONSE.md) — **AUTHORITATIVE** for P0 / P1 / P2 / P3 severity semantics
   - [docs/ops/RELEASE_CHECKLIST.md](../../ops/RELEASE_CHECKLIST.md) — **AUTHORITATIVE** for the seven release gates
   - [docs/ops/DEPLOYMENT_FLOW.md](../../ops/DEPLOYMENT_FLOW.md) — **AUTHORITATIVE** for the four-environment promotion + rollback procedure
   - [packages/game-engine/src/versioning/](../../../packages/game-engine/src/versioning/) — **AUTHORITATIVE** for the three version axes (`EngineVersion`, `DataVersion`, `ContentVersion`) and `VersionedArtifact<T>` / `checkCompatibility` / `migrateArtifact` / `stampArtifact`
   - [docs/ai/DECISIONS.md](../DECISIONS.md) — **AUTHORITATIVE** for D-1001 / D-1002 / D-1003 / D-0702 / D-0801 / D-3901 / D-4001

   These 8 surfaces were added to WP-040 §Context (Read First) during the v2 Path A rewrite per P6-53. Re-read before writing the content files.

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md](../REFERENCE/01.5-runtime-wiring-allowance.md) §When to Include This Clause. WP-040 is Contract-Only (types + docs). Each of the four 01.5 trigger criteria is enumerated below and marked absent:

| 01.5 Trigger Criterion | Applies to WP-040? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | Governance types are metadata-only and explicitly forbidden from `LegendaryGameState` membership (EC-040 §Guardrails). |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | No engine modification. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move added. No moves touched. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding | **No** | No phase hook added. |

**Conclusion:** 01.5 is **NOT INVOKED**. The scope lock applies without the allowance. Any file beyond the Commit A / Commit B allowlist in §Files Expected to Change is a scope violation per **P6-27**, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it.

Per 01.5 §Escalation: *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution, STOP and escalate — do not force-fit.

---

## Copilot Check (01.7) — COMPLETED, VERDICT: CONFIRM

See [docs/ai/invocations/copilot-wp040-growth-governance-change-budget.md](copilot-wp040-growth-governance-change-budget.md) for the full 30-issue scan. Overall Judgment: **PASS** — 27 PASS, 3 scope-neutral RISKs (Issue 4 version-axis mapping table, Issue 5 `exactOptionalPropertyTypes` construction note, Issue 26 category-to-layer mapping-table directive), 0 BLOCK. Disposition **CONFIRM**. All three RISK FIXes are folded into this prompt's §Locked Values as session-prompt-authoring guardrails (see below). Session prompt generation authorized.

---

## Vision Sanity Check (01.4 §Vision Sanity Check)

Clause titles verified against `docs/01-VISION.md` headers:

- **Vision clauses touched by this WP:** §5 (Longevity & Expandability), §13 (Execution Checklist–Driven Development), §14 (Explicit Decisions, No Silent Drift), §22 (Deterministic & Reproducible Evaluation), §24 (Replay-Verified Competitive Integrity), Financial Sustainability ("no margin, no mission" covenant).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` The five change categories and the five-surface immutable list directly enforce §22 and §24 — major-version gates on determinism-bearing surfaces prevent silent drift (§14). Per-release change budgets enforce sustainability (§5).
- **Non-Goal proximity:** `N/A — WP touches no monetization or competitive surface directly, but structurally reinforces NG-1 (No Pay-to-Win) and NG-3 (No Content-Withholding)` by requiring major-version governance for any ENGINE change — no paid surface can request an ENGINE change without architectural review.
- **Determinism preservation:** Confirmed. Replay, RNG, scoring, invariants, and endgame are explicitly immutable surfaces requiring major-version bump + migration path + DECISIONS.md entry. No determinism-bearing path can drift via a content or UI release.
- **WP `## Vision Alignment` section status:** Present in WP-040 post-Path-A (§Vision Alignment block intact, clauses match).

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, lint gate, commit discipline
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary; engine code in WP-040 is pure types only
3. [.claude/rules/game-engine.md](../../../.claude/rules/game-engine.md) — engine-category rules inherited by `src/governance/` per D-4001
4. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — prose style for produced doc; type-file style for `governance.types.ts`
5. [docs/01-VISION.md](../../01-VISION.md) — Primary Goals (#1-5), Non-Goals (NG-1..7), Financial Sustainability covenant
6. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — **AUTHORITATIVE** for §MVP Gameplay Invariants + §Layer Boundary
7. [docs/ops/LIVE_OPS_FRAMEWORK.md](../../ops/LIVE_OPS_FRAMEWORK.md) §8 Change Management — **AUTHORITATIVE** for allowed/forbidden change matrix; WP-040 categories inherit §8's rows
8. [packages/game-engine/src/ops/ops.types.ts](../../../packages/game-engine/src/ops/ops.types.ts) — **AUTHORITATIVE** for `IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment`; no parallel types
9. [docs/ops/INCIDENT_RESPONSE.md](../../ops/INCIDENT_RESPONSE.md) — **AUTHORITATIVE** for severity semantics
10. [docs/ops/RELEASE_CHECKLIST.md](../../ops/RELEASE_CHECKLIST.md) — **AUTHORITATIVE** for release gates
11. [docs/ops/DEPLOYMENT_FLOW.md](../../ops/DEPLOYMENT_FLOW.md) — **AUTHORITATIVE** for promotion flow + rollback
12. [packages/game-engine/src/versioning/](../../../packages/game-engine/src/versioning/) — **AUTHORITATIVE** for three version axes
13. [docs/ai/execution-checklists/EC-040-growth-governance.checklist.md](../execution-checklists/EC-040-growth-governance.checklist.md) — primary execution authority
14. [docs/ai/work-packets/WP-040-growth-governance-change-budget.md](../work-packets/WP-040-growth-governance-change-budget.md) — authoritative WP specification
15. [docs/ai/DECISIONS.md](../DECISIONS.md) — **AUTHORITATIVE** for D‑1001, D‑1002, D‑1003, D‑0702, D‑0801, D‑3901, D‑4001

If any of these conflict, higher-authority documents win.

---

## Goal (Binary)

After this session:

1. **`docs/governance/CHANGE_GOVERNANCE.md` exists** with §Change Classification, §Immutable Surfaces, §Change Budget Template, §Growth Vectors, §Review Requirements by Category sections per WP-040 §Scope In §A.
2. **`packages/game-engine/src/governance/governance.types.ts` exists** exporting exactly three types: `ChangeCategory`, `ChangeBudget`, `ChangeClassification`. Type literals match EC-040 §Locked Values verbatim.
3. **`packages/game-engine/src/types.ts` re-exports the three governance types.** Additive only — no other edits.
4. **`packages/game-engine/src/index.ts` exports the three governance types.** Additive only — no other edits.
5. **`docs/ai/post-mortems/01.6-WP-040-growth-governance-change-budget.md` exists** with the canonical coverage fields.
6. **Governance types are NOT members of `LegendaryGameState`** — verified by grep that they appear only in re-export lines in `types.ts`.
7. **No engine gameplay file touched.** `git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ packages/game-engine/src/rules/` returns empty.
8. **Engine baseline unchanged:** 444 passing / 110 suites / 0 failing (baseline from pre-flight v2 2026-04-23; current baseline re-recorded in STATUS.md if the repo has advanced).
9. **Repo-wide baseline unchanged:** 596 passing / 0 failing.
10. **No `require(` in `packages/game-engine/src/governance/`.**
11. **Three back-pointer DECISIONS.md entries landed at Commit B:** D-4002 (classification rationale), D-4003 (growth vectors), D-4004 (immutable surfaces). Each is a first-class DECISIONS.md entry with its own DECISIONS_INDEX row per P6-51 form (2) prevention clause.
12. **D-4001 already landed at Commit A0** (not Commit B) — classifies `packages/game-engine/src/governance/` as engine code category.

No registry changes. No server changes. No client changes. No new tests. No new npm dependencies. No moves. No phases. No `G` touch.

---

## Locked Values (Do Not Re-Derive)

### Commit topology (three commits — plus optional Commit A0a housekeeping)

- **(Optional) Commit A0a (`SPEC:`)** — unrelated working-tree drift if present at session start. Stages the four unrelated doc mods (00-INDEX, 05-ROADMAP, 05-ROADMAP-MINDMAP, 01.4 P6-52/P6-53). Subject: `SPEC: land P6-52 + P6-53 precedents in 01.4, back-sync 00-INDEX / 05-ROADMAP / 05-ROADMAP-MINDMAP`. Skip if already landed.
- **Commit A0 (`SPEC:`)** — pre-flight bundle + D-4001. Stages v1 preflight, v2 preflight, copilot check, this session prompt, Path A rewrites of WP-040 and EC-040, and the D-4001 additions to DECISIONS.md + DECISIONS_INDEX.md + 02-CODE-CATEGORIES.md. **Subject:** `SPEC: WP-040 pre-flight bundle — v1 + v2 preflights, copilot check, Path A tightening, D-4001 code-category classification`
- **Commit A (`EC-040:`)** — content + 01.6 post-mortem: `CHANGE_GOVERNANCE.md` + `governance.types.ts` + `types.ts` + `index.ts` + post-mortem. **Subject:** `EC-040: ship growth-governance types + classification doc (change categories, immutable surfaces, change budget)`. Commit body must include a `Vision: §5, §13, §14, §22, §24` trailer per [docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md §Vision Trailer](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md).
- **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` + `EC_INDEX.md` + `DECISIONS.md` (three back-pointer entries) + `DECISIONS_INDEX.md` (three rows). **Subject:** `SPEC: close WP-040 / EC-040 — growth governance & change budget`. Commit body repeats the `Vision:` trailer.

### Type literals (copy verbatim from EC-040 §Locked Values — deviation FAILS)

```typescript
export type ChangeCategory = 'ENGINE' | 'RULES' | 'CONTENT' | 'UI' | 'OPS';

export interface ChangeBudget {
  readonly release: string;
  readonly engine: number;
  readonly rules: number;
  readonly content: number;
  readonly ui: number;
  readonly ops: number;
}

export interface ChangeClassification {
  readonly id: string;
  readonly category: ChangeCategory;
  readonly description: string;
  readonly versionImpact: 'major' | 'minor' | 'patch' | 'none';
  readonly immutableSurface?: 'replay' | 'rng' | 'scoring' | 'invariants' | 'endgame';
}
```

All fields `readonly` per the D-2802 / D-3501 aliasing-prevention discipline extended to metadata surfaces. No additional fields, no reorderings, no abbreviations.

### Copilot Issue 4 FIX — `versionImpact` → version-axis mapping (locked for CHANGE_GOVERNANCE.md §Change Classification)

The `versionImpact` field values map to the three landed version axes (per D-0801) and to "no bump" as follows. Render this as a table in `CHANGE_GOVERNANCE.md §Change Classification`:

| Classification | `versionImpact` value | Target version axis | Rationale |
|---|---|---|---|
| ENGINE | `'major'` | `EngineVersion` | Engine-breaking change; replay and invariant implications |
| RULES | `'major'` | `EngineVersion` | Rule changes affect replay determinism and scoring semantics (per WP-040 §Locked Values) |
| CONTENT | `'major'` / `'minor'` / `'patch'` | `ContentVersion` | Scale with scope: new set = major; new card = minor; text fix = patch |
| UI | `'none'` (default) or `'minor'` if `UIState` shape changes | `EngineVersion` if `UIState` shape changes; otherwise none | `UIState` is engine-exported per D-2801 |
| OPS | `'none'` | N/A | Infrastructure/deployment changes do not bump artifact versions |

### Copilot Issue 5 FIX — `exactOptionalPropertyTypes` construction rule (locked for `governance.types.ts` consumers + CHANGE_GOVERNANCE.md authoring guidance)

The repo-wide `tsconfig.json` enables `exactOptionalPropertyTypes: true` (WP-029 precedent). `ChangeClassification.immutableSurface` is optional:

- **A `ChangeClassification` with no immutable-surface touch must OMIT the field entirely** — use conditional assignment or object-spread in an `if` block:
  ```typescript
  const base = { id, category, description, versionImpact } as const;
  const classification: ChangeClassification =
    immutableSurface !== undefined ? { ...base, immutableSurface } : base;
  ```
- **Do NOT set `immutableSurface: undefined`** — `exactOptionalPropertyTypes` rejects `T | undefined` for optional properties. This matches the WP-029 `preserveHandCards` / `handCards` pattern.
- Document this pattern in `CHANGE_GOVERNANCE.md` as reader-facing guidance when the doc introduces the `ChangeClassification` shape, so future authoring workflows that instantiate classifications follow the same discipline.

### Copilot Issue 26 FIX — category-to-layer mapping table (locked for CHANGE_GOVERNANCE.md §Change Classification)

Render the category-to-layer mapping as a table in the first §Change Classification section — not as prose. This codifies the convention WP-040 §Goal already describes in prose:

| `ChangeCategory` | `ARCHITECTURE.md §Layer Boundary` layer | Primary directory |
|---|---|---|
| ENGINE | Game Engine | `packages/game-engine/src/` (core) |
| RULES | Game Engine | `packages/game-engine/src/rules/` + rule hook registry |
| CONTENT | Registry | `packages/registry/`, `docs/content/`, card JSON |
| UI | Client (outside engine) | `apps/arena-client/`, `packages/game-engine/src/ui/` (UIState type only) |
| OPS | Server + Ops Playbook | `apps/server/`, `docs/ops/`, `packages/game-engine/src/ops/` (types only) |

### Change budget template (reader-facing prose in CHANGE_GOVERNANCE.md §Change Budget Template)

Per WP-040 §Scope In §A "Change Budget Template":

- **ENGINE:** 0 default per release; any nonzero requires architecture review + DECISIONS.md entry.
- **RULES:** 0 by default; at most 1 per release and only with simulation validation (D-0702 / WP-036).
- **CONTENT:** uncapped but validated by content validation (WP-033).
- **UI:** encouraged; no cap.
- **OPS:** as needed; ops review + rollback test per WP-035.
- Budget is declared before release development begins. Overruns require explicit approval and a new DECISIONS.md entry.

### Immutable surfaces (copy verbatim — deviation FAILS)

Per EC-040 §Locked Values + D-1002:

- Replay semantics
- RNG behavior (`ctx.random.*`) — paraphrased in prose per §Authoring Discipline below
- Scoring rules (`computeFinalScores`)
- Engine invariants (WP-031)
- Endgame conditions (`evaluateEndgame`)

Any change to one of these requires: major version increment on the target axis + migration path + explicit DECISIONS.md entry.

### Review requirements by category (copy verbatim)

- **ENGINE:** architecture review + DECISIONS.md entry + full replay verification
- **RULES:** simulation validation (WP-036) + DECISIONS.md entry
- **CONTENT:** content validation (WP-033) only
- **UI:** standard code review
- **OPS:** ops review + rollback test

### D-3901 reuse verification (already recorded in EC-040 §Locked Values — re-state in `governance.types.ts` header comment)

All four proposed types returned **genuinely novel (4/4 PASS)** against `packages/game-engine/src/` at pre-flight v2. `governance.types.ts` file header must include a one-line `// why:` comment recording the reuse verification:

```typescript
// why: D-3901 reuse verification (pre-flight v2, 2026-04-23): ChangeCategory,
// ChangeBudget, ChangeClassification, and the ChangeClassification.immutableSurface
// literal union are genuinely novel — no collision with IncidentSeverity,
// OpsCounters, DeploymentEnvironment, or any other landed ops/versioning type.
```

### Required `// why:` comment (copy verbatim — EC-040 §Required `// why:` Comments)

`governance.types.ts` includes the following `// why:` comment exactly (absence, paraphrase, or relocation FAILS the EC):

> change budgets prevent entropy during growth (D-1001)

This comment must sit immediately above the `ChangeBudget` interface declaration.

### DECISIONS.md placement: P6-51 form (2) with back-pointer entries

Per P6-51 (WP-035 precedent + pre-flight v1 PS-2 resolution), the three rationales required by WP-040 §DoD live as **reader-facing prose** in `docs/governance/CHANGE_GOVERNANCE.md`. Three short **back-pointer D-entries** land in Commit B, citing the produced doc's sections:

- **D-4002** — back-pointer citing `docs/governance/CHANGE_GOVERNANCE.md §Change Classification` (five-categories rationale + layer-boundary mapping).
- **D-4003** — back-pointer citing `docs/governance/CHANGE_GOVERNANCE.md §Growth Vectors` (content/UI as primary vectors rationale).
- **D-4004** — back-pointer citing `docs/governance/CHANGE_GOVERNANCE.md §Immutable Surfaces` (replay / RNG / scoring / invariants / endgame definition rationale).

Each back-pointer D-entry is a first-class `docs/ai/DECISIONS.md` entry with its own `docs/ai/DECISIONS_INDEX.md` row per P6-51 prevention clause. Entry structure follows the WP-035 D-3502 / D-3503 / D-3504 precedent:

```
### D-4002 — Five Change Categories Map to Architectural Layer Partition

**Decision:** The five change categories (ENGINE / RULES / CONTENT / UI / OPS)
map one-to-one to the `ARCHITECTURE.md §Layer Boundary` partition. Authoritative
prose restatement lives in `docs/governance/CHANGE_GOVERNANCE.md §Change
Classification`; this entry exists for citation resolution and grep-based audit.

**Rationale:** <see authoritative prose at CHANGE_GOVERNANCE.md §Change Classification>.

**Status:** Immutable
**Raised:** 2026-MM-DD (Commit B of WP-040)
**Resolved:** 2026-MM-DD (this decision)
```

Follow the same template for D-4003 and D-4004, citing their respective CHANGE_GOVERNANCE.md sections.

### Authoring discipline for grep-guarded identifiers (P6-52, citing P6-52 by number)

Per [P6-52](../REFERENCE/01.4-pre-flight-invocation.md:5292), Verification Step 5's literal-pattern grep (`require(` over `packages/game-engine/src/governance/`) is a P6-52-class gate. Any prose, JSDoc, or comment mentioning the forbidden identifier — even to argue against it — will trip the grep.

**The identifiers listed in Verification Step 5 MUST NOT appear in `governance.types.ts` under any circumstance — including meta-prose arguing against them, parenthetical examples, or footnotes. Paraphrase each identifier to a descriptive noun phrase per the table below. The grep cannot distinguish advocacy from opposition; the authoring discipline must.**

Per P6-50 (WP-035 proactive paraphrase loading), the same discipline applies to all engine-category purity tokens that may appear in prose documenting `ChangeClassification.immutableSurface` semantics (RNG behavior, wall-clock reads, etc.):

| Forbidden identifier (literal) | Approved paraphrase |
|---|---|
| `require(` | "the CJS require call" |
| `Math.random` | "non-engine RNG" |
| `Math.random()` | "the non-engine RNG helper call" |
| `Date.now` | "wall-clock helper" |
| `Date.now()` | "the wall-clock read" |
| `performance.now` | "high-resolution timing read" |
| `performance.now()` | "the high-resolution timing read" |
| `new Date()` | "wall-clock constructor" |
| `boardgame.io` | "the game framework" |
| `@legendary-arena/registry` | "the registry package" |
| `apps/server` | "the server layer" |

The paraphrase table applies to `governance.types.ts` and to any `// why:` comments in the re-exports. The same paraphrases may be re-used in `CHANGE_GOVERNANCE.md` prose when discussing immutable-surface semantics — the produced doc does not trip Verification Step 5 (which scopes only to `packages/game-engine/src/governance/`), but applying the paraphrases there too keeps the discipline uniform and makes future verification-step expansions lower-friction.

**`ctx.random.*` exception:** The phrase `ctx.random.*` is the canonical name of the boardgame.io RNG surface and is documented as the required RNG path in `.claude/rules/architecture.md`. It may appear in prose when explaining what counts as RNG behavior. It is NOT covered by Verification Step 5's `require(` grep.

### Prose discipline for `CHANGE_GOVERNANCE.md`

- **Binary pass/fail language only** on success criteria, change-budget enforcement, and immutable-surface definitions.
- **Forbidden subjective phrases** (case-insensitive): "looks good", "looks great", "acceptable" (except in specifically locked clauses), "mostly ready", "good enough", "should be fine", "probably". Verification Step 9 greps for these and requires zero hits.
- **No forbidden-token enumeration for determinism.** Cite D-entries (D-0801, D-1002, D-0702) rather than listing `Math.random`, `Date.now`, etc. Per `00.3 §18` prose-vs-grep discipline.
- **Cross-link, do not restate** authority surfaces from §Authority Chain re-read. The severity taxonomy in `INCIDENT_RESPONSE.md`, the seven release gates in `RELEASE_CHECKLIST.md`, the four-environment promotion in `DEPLOYMENT_FLOW.md`, and the three version axes in `src/versioning/` all stay authoritative in their source files — `CHANGE_GOVERNANCE.md` points to them.

### No canonical `CHANGE_CATEGORIES` readonly array

`ChangeCategory` is metadata-only and never used to branch runtime gameplay. The project-wide drift-detection discipline for canonical-array + union pairs (`MATCH_PHASES`, `TURN_STAGES`, `CORE_MOVE_NAMES`, `RULE_TRIGGER_NAMES`, `RULE_EFFECT_TYPES`, `REVEALED_CARD_TYPES`, `BOARD_KEYWORDS`, `SCHEME_SETUP_TYPES`) applies to runtime-typed unions consumed by `G`, moves, or rule hooks. Metadata-only unions are explicitly waived per EC-040 §D-3901 Reuse Verification.

Future additions to `ChangeCategory` require only a new D-entry (not a canonical-array test update).

---

## Required `// why:` Comments

Exactly one in-code `// why:` comment is locked by EC-040:

- **`governance.types.ts`** above the `ChangeBudget` interface: `// why: change budgets prevent entropy during growth (D-1001)`

Plus the P6-52-compliant file-header comment recording the D-3901 reuse verification (see §Locked Values above).

No `// why:` comments are required in `types.ts` or `index.ts` because the re-exports are additive and the rationale is documented in the import site (`governance.types.ts`). No `// why:` comments are required in `CHANGE_GOVERNANCE.md` (not a code file).

---

## Files Expected to Change (Allowlist — 15 files across 3 committed commits, plus 0–4 in optional Commit A0a)

### Commit A0a (optional — skip if already landed)

| File | New/Modify | Owner |
|---|---|---|
| `docs/00-INDEX.md` | modify | Commit A0a |
| `docs/05-ROADMAP-MINDMAP.md` | modify | Commit A0a |
| `docs/05-ROADMAP.md` | modify | Commit A0a |
| `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` | modify (+P6-52, P6-53) | Commit A0a |

### Commit A0 (SPEC pre-flight bundle + D-4001)

| File | New/Modify | Owner |
|---|---|---|
| `docs/ai/invocations/preflight-wp040-growth-governance-change-budget.md` | **new** (v1) | Commit A0 |
| `docs/ai/invocations/preflight-wp040-growth-governance-change-budget-v2.md` | **new** (v2) | Commit A0 |
| `docs/ai/invocations/copilot-wp040-growth-governance-change-budget.md` | **new** | Commit A0 |
| `docs/ai/invocations/session-wp040-growth-governance-change-budget.md` | **new** (this prompt) | Commit A0 |
| `docs/ai/work-packets/WP-040-growth-governance-change-budget.md` | modify (Path A rewrite) | Commit A0 |
| `docs/ai/execution-checklists/EC-040-growth-governance.checklist.md` | modify (Path A rewrite) | Commit A0 |
| `docs/ai/DECISIONS.md` | modify (append D-4001) | Commit A0 |
| `docs/ai/DECISIONS_INDEX.md` | modify (append D-4001 row) | Commit A0 |
| `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` | modify (register `src/governance/`) | Commit A0 |

### Commit A (EC-040 content)

| File | New/Modify | Owner |
|---|---|---|
| `docs/governance/CHANGE_GOVERNANCE.md` | **new** | Commit A |
| `packages/game-engine/src/governance/governance.types.ts` | **new** | Commit A |
| `packages/game-engine/src/types.ts` | modify (additive re-exports only) | Commit A |
| `packages/game-engine/src/index.ts` | modify (additive re-exports only) | Commit A |
| `docs/ai/post-mortems/01.6-WP-040-growth-governance-change-budget.md` | **new** | Commit A |

### Commit B (SPEC governance close)

| File | New/Modify | Owner |
|---|---|---|
| `docs/ai/STATUS.md` | modify (prepend Phase 7 closure block) | Commit B |
| `docs/ai/DECISIONS.md` | modify (append D-4002, D-4003, D-4004 back-pointer entries) | Commit B |
| `docs/ai/DECISIONS_INDEX.md` | modify (append three back-pointer rows) | Commit B |
| `docs/ai/work-packets/WORK_INDEX.md` | modify (WP-040 `[ ]` → `[x]` with today's date) | Commit B |
| `docs/ai/execution-checklists/EC_INDEX.md` | modify (EC-040 Draft → Done; counters 12 → 13 / 48 → 47) | Commit B |

**No other files may be modified in any commit.** Any file outside this allowlist is a scope violation — escalate, do not force-fit.

At each `git add`, pass exact filenames. At each commit, confirm `git diff --cached --name-only` matches the allowlist exactly. `.claude/worktrees/` must NOT be staged.

---

## Verification Steps

Execute each before checking any Acceptance Criteria in EC-040.

```bash
# Step 1 — confirm the governance doc exists with expected sections
test -f docs/governance/CHANGE_GOVERNANCE.md && echo "CHANGE_GOVERNANCE present"
grep -cE "^## " docs/governance/CHANGE_GOVERNANCE.md
# Expected: >= 5 (§Change Classification, §Immutable Surfaces, §Change Budget Template,
# §Growth Vectors, §Review Requirements by Category — plus optional §Rationale / §Appendices)

# Step 2 — confirm governance types file exists and exports the three types verbatim
test -f packages/game-engine/src/governance/governance.types.ts && echo "governance.types.ts present"
grep -cE "export (type|interface) (ChangeCategory|ChangeBudget|ChangeClassification)" \
  packages/game-engine/src/governance/governance.types.ts
# Expected: 3

# Step 3 — confirm governance types are re-exported from types.ts (metadata re-export only,
# NEVER as fields of LegendaryGameState)
grep -nE "ChangeCategory|ChangeBudget|ChangeClassification" packages/game-engine/src/types.ts
# Expected: only re-export lines (export { ... } from './governance/governance.types.js').
# If any occurrence appears inside the LegendaryGameState interface definition, this step FAILS.

# Step 4 — confirm governance types exported from package index
grep -nE "ChangeCategory|ChangeBudget|ChangeClassification" packages/game-engine/src/index.ts
# Expected: three re-export lines (one per type)

# Step 5 — confirm no CJS require call in new governance directory
#   Per P6-52 / P6-50 paraphrase discipline, do NOT mention "the CJS require call"
#   identifier in prose within this directory.
grep -rE "require\(" packages/game-engine/src/governance/
# Expected: no output

# Step 6 — confirm no engine gameplay files modified
git diff --name-only packages/game-engine/src/game.ts packages/game-engine/src/moves/ \
  packages/game-engine/src/rules/
# Expected: no output

# Step 7 — confirm the required `// why:` comment is present verbatim
grep -nE "// why: change budgets prevent entropy during growth \(D-1001\)" \
  packages/game-engine/src/governance/governance.types.ts
# Expected: one match, immediately above the ChangeBudget interface

# Step 8 — confirm D-3901 reuse-verification header comment is present
grep -nE "D-3901 reuse verification" \
  packages/game-engine/src/governance/governance.types.ts
# Expected: at least one match in the file header

# Step 9 — subjective-language grep on the governance doc (must return zero hits)
grep -iE "looks good|looks great|mostly ready|good enough|should be fine|probably" \
  docs/governance/CHANGE_GOVERNANCE.md
# Expected: no output

# Step 10 — prose-vs-grep discipline on the governance doc (must return zero hits)
#   Per §18 — cite D-entries (D-0801, D-1002, D-0702) rather than listing identifiers.
grep -E "Math\.random|Date\.now|performance\.now|new Date\(\)" \
  docs/governance/CHANGE_GOVERNANCE.md
# Expected: no output

# Step 11 — confirm only allowlist files touched in aggregate
git diff --name-only
# Expected: only files in §Files Expected to Change across A0a (if run) + A0 + A + B

# Step 12 — test baselines unchanged
pnpm --filter @legendary-arena/game-engine test
# Expected: 444 passing / 110 suites / 0 failing (baseline from pre-flight v2 2026-04-23;
# if repo state has advanced, use current baseline and record in STATUS.md)

pnpm -r test
# Expected: 596 passing / 0 failing; record current count in STATUS.md

# Step 13 — engine build passes
pnpm --filter @legendary-arena/game-engine build
# Expected: exit 0, no TypeScript errors

# Step 14 — confirm three back-pointer DECISIONS.md entries landed at Commit B
grep -nE "^### D-(4002|4003|4004) " docs/ai/DECISIONS.md
# Expected: three matches (regular hyphen; D-4001 landed earlier at Commit A0)

# Step 15 — confirm matching rows in DECISIONS_INDEX
grep -nE "D-(4001|4002|4003|4004)" docs/ai/DECISIONS_INDEX.md
# Expected: at least four matches under Growth Governance section

# Step 16 — WP-040 checked off in WORK_INDEX at Commit B
grep -nE "\[x\] WP-040" docs/ai/work-packets/WORK_INDEX.md
# Expected: one match with today's date

# Step 17 — EC-040 moved to Done in EC_INDEX at Commit B
grep -nE "EC-040.*Done" docs/ai/execution-checklists/EC_INDEX.md
# Expected: one match; Done counter 12 → 13, Draft counter 48 → 47
```

All 17 steps must pass. Any failure STOPS execution and escalates to pre-commit review.

---

## Execution Sequence (Hard-Locked)

1. **(Optional) Commit A0a — housekeeping.** If the four unrelated doc mods are still unstaged at session start, stage them by exact filename and commit as `SPEC: land P6-52 + P6-53 precedents in 01.4, back-sync 00-INDEX / 05-ROADMAP / 05-ROADMAP-MINDMAP`. Include the Vision trailer if any changed file touches §17.1 triggers; otherwise trailer is optional. Skip if already landed.

2. **Commit A0 — pre-flight bundle + D-4001.** Stage the nine Commit A0 files by exact filename (four new invocations + two modified WP/EC + three modified governance files). Commit as `SPEC: WP-040 pre-flight bundle — v1 + v2 preflights, copilot check, Path A tightening, D-4001 code-category classification` with the Vision trailer `Vision: §5, §13, §14, §22, §24`.

3. **Content authoring — `governance.types.ts`.** Write the three type definitions verbatim per §Locked Values. Include the D-3901 reuse-verification file-header `// why:` comment. Include the `// why: change budgets prevent entropy during growth (D-1001)` comment immediately above `ChangeBudget`. All fields `readonly`. No imports beyond what the type definitions themselves require.

4. **Content authoring — `types.ts` re-exports.** Append three re-export lines at an appropriate location (grouped with other re-exports, not inside the `LegendaryGameState` interface). Example pattern per project convention:
   ```typescript
   export type { ChangeCategory, ChangeBudget, ChangeClassification }
     from './governance/governance.types.js';
   ```

5. **Content authoring — `index.ts` public-API exports.** Append matching public-API exports.

6. **Content authoring — `CHANGE_GOVERNANCE.md`.** Write the governance doc with:
   - **§Change Classification** — five categories with layer-boundary mapping table (Issue 26 FIX) and `versionImpact` mapping table (Issue 4 FIX).
   - **§Immutable Surfaces** — the five-surface list + major-version-bump + migration-path + DECISIONS.md-entry requirement. Paraphrase per P6-52/P6-50 table (no literal `Math.random`, `Date.now`, `boardgame.io`, etc. in prose).
   - **§Change Budget Template** — per-release budget declaring allowances per §Locked Values. RULES: "0 by default; at most 1 per release and only with simulation validation" verbatim.
   - **§Growth Vectors** — primary (CONTENT, UI), secondary (RULES with simulation), restricted (ENGINE), forbidden without major version (immutable surfaces).
   - **§Review Requirements by Category** — per §Locked Values, verbatim.
   - **§Authoring Guidance for `ChangeClassification`** — the `exactOptionalPropertyTypes` construction pattern (Issue 5 FIX): omit `immutableSurface` when unset, do not use `undefined`.

   Apply §Prose discipline from §Locked Values: binary pass/fail language, no subjective phrases, cross-link not restate.

7. **Run Verification Steps 1–11** against the content changes. All must pass.

8. **01.6 post-mortem.** Author `docs/ai/post-mortems/01.6-WP-040-growth-governance-change-budget.md`. Required coverage:
   - **Risks surfaced** — v1 pre-flight caught four Path A findings (four-metric-categories paraphrase, D-3901 inheritance, eight AUTHORITATIVE surfaces, post-mortem gap) + three pre-session actions (D-4001, P6-51 form (2), P6-52 paraphrase table). v2 resolved all seven.
   - **Lessons learned** — P6-53 authority-surface enumeration is load-bearing (absent §Context surfaces caused the v1 drift, same class as WP-039). P6-51 DECISIONS.md placement ambiguity resolved by locking form (2) at pre-flight, not at execution. P6-52 paraphrase discipline applied proactively per P6-50 — zero mid-execution grep-guard trips.
   - **Lifecycle isolation** — N/A (no code wiring into `game.ts`, moves, or phase hooks).
   - **Aliasing** — N/A (no functions, no projections). `readonly` fields on all interfaces pre-emptively enforce immutability for any future consumer.
   - **Extension seam status** — five closed literal unions; extension requires new D-entry + (for `immutableSurface`) fresh D-3901 reuse-verification run. No canonical-array drift-detection discipline applied because metadata-only.
   - **Follow-up WP pointers** — future audit-tooling WP will consume `ChangeClassification` instances (construction site and enforcement mechanism TBD; outside WP-040 scope); any governance addition to `ChangeCategory` / `ChangeBudget` / `ChangeClassification` requires a new pre-flight.

9. **Content commit (EC-040).** Stage the five Commit A files by exact filename (governance doc + types file + types.ts + index.ts + post-mortem). Commit as `EC-040: ship growth-governance types + classification doc (change categories, immutable surfaces, change budget)` with the Vision trailer.

10. **Run Verification Step 12** (test baselines) and Step 13 (build) against the content commit. Engine 444/110/0 + repo-wide 596/0 + build exit 0 all required.

11. **Governance close.** Update:
   - `STATUS.md` — prepend Phase 7 closure block using the canonical language: *"Phase 7 complete: Growth governance enforced. Change classification mandatory. Immutable surfaces protected. D-1001 / D-1002 / D-1003 fully implemented."* Plus current engine + repo-wide test baselines.
   - `WORK_INDEX.md` — check off WP-040 with today's date and the EC-040 commit hash.
   - `EC_INDEX.md` — EC-040 Draft → Done; Done counter 12 → 13; Draft counter 48 → 47.
   - `DECISIONS.md` — append D-4002 (Change Classification back-pointer), D-4003 (Growth Vectors back-pointer), D-4004 (Immutable Surfaces back-pointer). Use regular hyphens in headings. Follow the WP-035 D-3502/D-3503/D-3504 template.
   - `DECISIONS_INDEX.md` — add three matching rows under the `## Growth Governance & Change Budget (WP-040)` section (already created at Commit A0).

12. **Governance commit (SPEC).** Stage the five Commit B files by exact filename. Commit as `SPEC: close WP-040 / EC-040 — growth governance & change budget` with the Vision trailer.

13. **Run Verification Steps 14–17** against the governance commit. All must return expected output.

If any step fails, STOP and raise as a pre-commit review finding — do not continue.

---

## Definition of Done

All of the following must hold:

- [ ] All Acceptance Criteria in WP-040 pass (binary pass/fail per item).
- [ ] All After Completing items in EC-040 pass (including the aggregate-diff limit of 5 Commit A files + 5 Commit B files).
- [ ] All Verification Steps above return expected output.
- [ ] `git diff --cached --name-only` at each commit matches the allowlist exactly.
- [ ] Test baselines recorded: engine 444/110/0; repo-wide 596/0.
- [ ] Engine build exits 0.
- [ ] No engine gameplay files modified (grep-verified).
- [ ] No `require(` in `packages/game-engine/src/governance/` (grep-verified).
- [ ] No governance types appear inside the `LegendaryGameState` interface definition (grep-verified).
- [ ] `governance.types.ts` contains the verbatim `// why: change budgets prevent entropy during growth (D-1001)` comment above `ChangeBudget`.
- [ ] `governance.types.ts` contains the D-3901 reuse-verification header comment.
- [ ] `CHANGE_GOVERNANCE.md` renders the category-to-layer mapping table and the `versionImpact` axis-mapping table (Issue 26 + Issue 4 copilot FIXes).
- [ ] `CHANGE_GOVERNANCE.md §Authoring Guidance` documents the `exactOptionalPropertyTypes` omit-don't-undefined pattern (Issue 5 copilot FIX).
- [ ] No subjective-language or forbidden-token enumeration in `CHANGE_GOVERNANCE.md`.
- [ ] No P6-52-class grep-guard trips during authoring (the six paraphrase-table identifiers appear only as paraphrased noun phrases in any governance-directory file).
- [ ] WP-040 checked off in WORK_INDEX.md with today's date + commit hash.
- [ ] EC-040 moved to Done in EC_INDEX.md; counters updated 12 → 13 / 48 → 47.
- [ ] D-4001 already landed at Commit A0 (verify via grep `^### D-4001 ` in DECISIONS.md).
- [ ] D-4002 / D-4003 / D-4004 back-pointer entries landed at Commit B (three matches in DECISIONS.md + three matching rows in DECISIONS_INDEX.md).
- [ ] STATUS.md prepended with canonical Phase 7 closure block.
- [ ] 01.6 post-mortem authored and committed in Commit A.
- [ ] All three (or four if A0a ran) commits land on `main` (no push required by this session).

---

*Session prompt authored 2026-04-23 against `main @ c861b24` as the fourth artifact in the WP-040 pre-flight bundle (after v1 preflight, Path A tightening of WP-040 + EC-040 + D-4001 landing, v2 preflight, and copilot check). Pre-flight v2 verdict READY TO EXECUTE; copilot check disposition CONFIRM with three scope-neutral RISK FIXes (Issues 4, 5, 26) folded into §Locked Values as session-prompt-authoring guardrails. Next step: commit the SPEC pre-flight bundle (Commit A0), then execute Commit A (EC-040 content), then Commit B (SPEC governance close) in a **new Claude Code session** per 01.4:128.*
