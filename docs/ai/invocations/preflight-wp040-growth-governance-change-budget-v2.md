# Pre-Flight v2 — WP-040 Growth Governance & Change Budget

**Target Work Packet:** `WP-040`
**Title:** Growth Governance & Change Budget
**Previous WP Status:** WP-039 Complete (2026-04-23, commit `ee5e1d5`)
**Pre-Flight Date:** 2026-04-23
**Invocation Stage:** Pre-Execution (Scope & Readiness) — v2 re-run after Path A
**Repo-state anchor:** `main @ c861b24` + in-flight Path A rewrite (uncommitted; Commit A0 will bundle the Path A changes plus v2 + copilot + session prompt)

**Work Packet Class:** Contract-Only / Documentation + Types (unchanged from v1).

**v1 → v2 Summary:** v1 returned **DO NOT EXECUTE YET** with four Path A findings (§5.1 + §5.2 + §5.3 + §7 post-mortem gap) and three pre-session actions (PS-1 D-4001, PS-2 P6-51 placement lock, PS-3 P6-52 paraphrase table). This v2 re-verifies the as-edited state after Path A application. All four Findings are resolved by construction in the Path A rewrites of WP-040 + EC-040. PS-1 is resolved by the D-4001 entry now present in `docs/ai/DECISIONS.md` + `docs/ai/DECISIONS_INDEX.md` + `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`. PS-2 and PS-3 land in the session prompt (Commit A0 bundle content); EC-040 §After Completing now locks P6-51 form (2) with three back-pointer D-entries, and PS-3 paraphrase discipline is deferred to the session prompt as specified.

---

## Pre-Flight Intent

Perform a pre-flight validation for WP-040 after Path A rewrite.

- Not implementing.
- Not generating code.
- Validating that all v1 blockers are resolved and no new scope has entered.

Verdict is binary (READY TO EXECUTE / DO NOT EXECUTE YET).

---

## §9 Reality-Check Gates (re-run at v2)

All nine gates re-run at v2 for audit completeness. No gate state changes since v1 other than Gate 8 (working tree reflects the Path A + D-4001 edits; still documentation-only, no `packages/` or `apps/` touch).

| Gate | Expected | Actual | Verdict |
|---|---|---|---|
| 1 | WP-039 governance close at `ee5e1d5` | matches | PASS |
| 2 | D-3901 present | DECISIONS.md:8361 | PASS |
| 3 | LIVE_OPS_FRAMEWORK.md 11 `## ` sections | 11 | PASS |
| 4 | EC_INDEX Done counter = 12 | 12 | PASS |
| 5 | engine test 444 / 110 / 0 | 444 / 110 / 0 | PASS |
| 6 | repo `pnpm -r test` 596 / 0 | 596 / 0 | PASS |
| 7 | `git diff --name-only ee5e1d5..HEAD packages/ apps/` empty | empty | PASS |
| 8 | Working tree clean except `.claude/worktrees/` | drift (docs-only Path A + D-4001 edits + v1 drift) | PASS-with-note |
| 9 | P6-52 + P6-53 present in 01.4 | two matches | PASS |

**Gate 8 note (updated):** v1's gate 8 drift (4 unstaged doc mods) now extended by the Path A edits (`WP-040-…md`, `EC-040-…checklist.md`), the D-4001 additions (`DECISIONS.md`, `DECISIONS_INDEX.md`, `02-CODE-CATEGORIES.md`), the v1 pre-flight file itself (`preflight-wp040-…md`), and this v2 file. All drift is documentation-only; none touches `packages/` or `apps/`. Commit A0 bundle will stage the Path A + D-4001 + pre-flight-v1 + pre-flight-v2 + copilot + session-prompt content in one `SPEC:` commit per the WP-039 precedent.

All nine gates return expected output. Pre-flight v2 authoring proceeds.

---

## Resolution Audit — v1 Findings

### Finding 1 (§5.1 drift) — "four metric categories" → "four organizational-prose metric labels"

**v1 status:** BLOCKER.
**v2 verification:** Path A edit applied at [WP-040 §Session Context](docs/ai/work-packets/WP-040-growth-governance-change-budget.md:11).

Pre-flight v2 re-read of WP-040 §Session Context confirms:

> *"WP-039 established live ops with four organizational-prose metric labels (System Health / Gameplay Stability / Balance Signals / UX Friction) and a daily / weekly / monthly review cadence."*

The paraphrase is semantically identical to session-context-wp040.md §5.1's recommended fix and aligns with `LIVE_OPS_FRAMEWORK.md §5`'s explicit non-typed-union declaration. **Finding 1: RESOLVED.**

### Finding 2 (§5.2 drift) — D-3901 missing from implements list

**v1 status:** BLOCKER.
**v2 verification:** Path A edit applied at [WP-040 §Session Context](docs/ai/work-packets/WP-040-growth-governance-change-budget.md:11) and [WP-040 §Context (Read First)](docs/ai/work-packets/WP-040-growth-governance-change-budget.md).

Pre-flight v2 confirms:
- §Session Context now states *"inherits D-3901 (Live Ops Reuses Existing `IncidentSeverity` and `OpsCounters` Rather Than Parallel Types) as a binding reuse-not-parallel discipline on all proposed type definitions."*
- §Context (Read First) now includes a D-3901 bullet under `docs/ai/DECISIONS.md`: *"D-3901 … **binding** on this packet's type definitions; every proposed new type must pass a D-3901 reuse-verification check recorded in EC-040 §Locked Values."*

Grep verification: `grep -c "D-3901" docs/ai/work-packets/WP-040-growth-governance-change-budget.md` now returns **≥ 2 matches** (v1 returned 0). **Finding 2: RESOLVED.**

### Finding 3 (§5.3 + P6-53) — Context (Read First) missing 8 AUTHORITATIVE surfaces

**v1 status:** BLOCKER.
**v2 verification:** Path A rewrite of [WP-040 §Context (Read First)](docs/ai/work-packets/WP-040-growth-governance-change-budget.md) expanded from 7 bullets to 10 bullets with caps-tagged **AUTHORITATIVE** markers.

The rewritten §Context (Read First) now enumerates:

| Surface | In §Context? | AUTHORITATIVE marker? |
|---|---|---|
| `ARCHITECTURE.md §MVP Gameplay Invariants` | YES | **AUTHORITATIVE for immutable engine invariants** |
| `ARCHITECTURE.md §Layer Boundary (Authoritative)` | YES | **AUTHORITATIVE for five-layer partition** |
| `docs/ops/LIVE_OPS_FRAMEWORK.md §8 Change Management` | YES | **AUTHORITATIVE for allowed/forbidden change matrix** |
| `packages/game-engine/src/ops/ops.types.ts` | YES | **AUTHORITATIVE for `IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment`** |
| `docs/ops/INCIDENT_RESPONSE.md` | YES | **AUTHORITATIVE for P0 / P1 / P2 / P3 severity semantics** |
| `docs/ops/RELEASE_CHECKLIST.md` | YES | **AUTHORITATIVE for the seven release gates** |
| `docs/ops/DEPLOYMENT_FLOW.md` | YES | **AUTHORITATIVE for the four-environment promotion path and rollback procedure** |
| `packages/game-engine/src/versioning/` | YES | **AUTHORITATIVE for the three version axes** |
| `DECISIONS.md D-1001 / D-1002 / D-1003 / D-0702 / D-0801 / D-3901` | YES | **AUTHORITATIVE for D-1001 / D-1002 / D-1003 / D-0702 / D-0801 / D-3901** |
| `00.6-code-style.md` | YES | (style baseline — no AUTHORITATIVE tag required per P6-53 scope) |

All 12 session-context §3 AUTHORITATIVE surfaces are now named in WP-040 §Context (Read First) with caps-tagged markers. D-0702 is explicitly called out as the binding RULES-category simulation requirement. **Finding 3: RESOLVED.**

### Finding 4 (§7 post-mortem gap) — Post-mortem missing from §Files Expected

**v1 status:** BLOCKER.
**v2 verification:** Path A edit applied at [WP-040 §Files Expected to Change](docs/ai/work-packets/WP-040-growth-governance-change-budget.md) and [EC-040 §Files to Produce](docs/ai/execution-checklists/EC-040-growth-governance.checklist.md).

Both files now list `docs/ai/post-mortems/01.6-WP-040-growth-governance-change-budget.md` as a fifth Commit A file, matching the WP-039 Commit-A precedent at `4b1cf5c`. The post-mortem's three triggers (new long-lived abstraction document, new `packages/game-engine/src/governance/` code-category directory, new type contracts consumed by future WPs) are documented in the file list rationale. EC-040 §After Completing §Aggregate working-tree diff clause now says "The **five** content files in **## Files to Produce** above (four governance-content files plus the post-mortem)." **Finding 4: RESOLVED.**

### PS-1 — D-4001 authored

**v1 status:** Pre-session action required before execution.
**v2 verification:** D-4001 now landed at [DECISIONS.md](docs/ai/DECISIONS.md) (between D-3901 and `## Final Note`), with matching row at [DECISIONS_INDEX.md](docs/ai/DECISIONS_INDEX.md) under a new `## Growth Governance & Change Budget (WP-040)` section, and registration line added to [02-CODE-CATEGORIES.md:105](docs/ai/REFERENCE/02-CODE-CATEGORIES.md:105) listing `packages/game-engine/src/governance/` (D-4001) as engine code category.

D-4001 follows the D-2706 / D-2801 / D-3001 / D-3101 / D-3401 / D-3501 template: cites purity, no I/O, no `boardgame.io` / registry / server imports, no non-engine RNG, no wall-clock helper, no `.reduce()`, Status Immutable, heading uses regular hyphen (`### D-4001 —`) to avoid em-dash grep-encoding drift (P6-2 class).

EC-040 §Before Starting now includes a hard-block checkbox for D-4001 existence. **PS-1: RESOLVED.**

### PS-2 — P6-51 placement lock (form 2 with three back-pointer D-entries)

**v1 status:** Pre-session action required before session-prompt generation.
**v2 verification:** EC-040 §After Completing now locks form (2) with D-4002 / D-4003 / D-4004 back-pointer citations to `docs/governance/CHANGE_GOVERNANCE.md §Change Classification / §Growth Vectors / §Immutable Surfaces`. Each D-entry will land in Commit B as a first-class DECISIONS.md entry with its own DECISIONS_INDEX row per P6-51 prevention clause.

Session prompt (forthcoming, Commit A0 bundle) must re-state form (2) in §Locked Values per the P6-51 template language: *"DECISIONS.md placement: form (2) with back-pointer citing …"*. **PS-2: RESOLVED at EC-040 level; session prompt transcription pending.**

### PS-3 — P6-52 paraphrase table

**v1 status:** Pre-session action required before session-prompt generation.
**v2 verification:** Session prompt (forthcoming) must include "Authoring discipline for grep-guarded identifiers" §Locked Values subsection citing P6-52 by number with the six-row paraphrase table (`require(`, `Math.random`, `Date.now`, `boardgame.io`, `@legendary-arena/registry`, `apps/server`). This is a session-prompt concern, not a WP/EC concern. **PS-3: RESOLVED at governance level; session prompt transcription pending.**

---

## Authority Chain (Read in Order) — unchanged from v1

See pre-flight v1 §Authority Chain. All 16 authority documents re-read at v2. No new conflicts discovered.

---

## Vision Sanity Check — unchanged from v1

See pre-flight v1 §Vision Sanity Check. Path A edits do not change the Vision Alignment block in WP-040 (still lines 221-249 post-edit, clauses §5 / §13 / §14 / §22 / §24 + Financial Sustainability). **Verdict: PASS.**

---

## Dependency & Sequencing Check — unchanged from v1

All dependencies verified at v1. D-4001 now present satisfies the new EC-040 hard block. All six D-entries cited by WP-040 now verified present (D-1001 at 346, D-1002 at 354, D-1003 at 362, D-0702 at 285, D-0801 at 310, D-3901 at 8361) plus D-4001 at the end of DECISIONS.md. No sequencing blockers.

---

## Dependency Contract Verification

### D-3901 Reuse Verification (re-verified at v2)

Pre-flight v2 re-ran the grep trace over `packages/game-engine/src/` to confirm no new types have landed since v1. Results identical to v1:

| Proposed type | Grep | v2 Result | Admissibility |
|---|---|---|---|
| `ChangeCategory` | `rg "ChangeCategory"` | No files found | Admissible — genuinely novel |
| `ChangeBudget` | `rg "Budget"` | No files found | Admissible — genuinely novel |
| `ChangeClassification` | `rg "ChangeClassification"` | No files found | Admissible — genuinely novel |
| `immutableSurface?` literal union | `rg "ImmutableSurface\|immutableSurface"` | No files found | Admissible — genuinely novel |

**4/4 PASS.** EC-040 §D-3901 Reuse Verification now records the same table verbatim. **Verdict: PASS.**

### Post-Path-A Contract Field Verification

Pre-flight v2 cross-checked every type name referenced in WP-040 §Scope / §Locked Values against:

- The `ops.types.ts` exports: `IncidentSeverity`, `OpsCounters`, `DeploymentEnvironment` — no collision.
- The `versioning.types.ts` exports: `EngineVersion`, `DataVersion`, `ContentVersion`, `VersionedArtifact<T>` — no collision, cross-linked not paralleled.
- The existing `LegendaryGameState` fields: no overlap with `ChangeCategory` / `ChangeBudget` / `ChangeClassification` (the types are explicitly forbidden from appearing as `LegendaryGameState` fields per EC-040 §Guardrails).

No field-name drift, no schema-engine drift, no handler-ownership ambiguity. **Verdict: PASS.**

---

## Input Data Traceability Check — unchanged from v1

All five items PASS. WP-040 introduces no new input datasets; types are metadata-only; produced doc is free prose. **Verdict: PASS.**

---

## Structural Readiness Check — unchanged from v1, with EC-040 tightening

All structural items PASS. EC-040 §After Completing now locks three additional verification checks beyond v1:

- `pnpm --filter @legendary-arena/game-engine test` reports 444 / 110 / 0 (baseline unchanged).
- `pnpm -r test` reports 596 / 0 (baseline unchanged).
- Aggregate diff clause expanded from 4+3 to 5+3+EC_INDEX.md+DECISIONS_INDEX.md (total 5 Commit A files + 5 Commit B governance-close files). The extended governance-close list reflects the P6-51 form (2) back-pointer entries requiring both DECISIONS.md and DECISIONS_INDEX.md edits.

**Verdict: PASS.**

---

## Code Category Boundary Check — RESOLVED

- [x] `packages/game-engine/src/governance/` classified in [02-CODE-CATEGORIES.md:105](docs/ai/REFERENCE/02-CODE-CATEGORIES.md:105) per PS-1 / D-4001.
- [x] All new or modified files fall cleanly into one existing code category.
- [x] Each file's category permits all imports and mutations it uses.
- [x] No file blurs category boundaries — `governance.types.ts` is pure types (no imports beyond Node built-ins); `types.ts` + `index.ts` re-exports are additive; `CHANGE_GOVERNANCE.md` under `docs/governance/` (new docs subdirectory, not gated by 02-CODE-CATEGORIES.md per RS-7 in v1).

**Verdict: PASS.**

---

## Pre-Session Actions — Final Disposition

```
**Pre-session actions — ALL RESOLVED (2026-04-23):**

1. PS-1 — D-4001 authored in DECISIONS.md / DECISIONS_INDEX.md /
   02-CODE-CATEGORIES.md. Engine code-category classification for
   packages/game-engine/src/governance/ now explicit. EC-040 §Before
   Starting hard-block added.
2. PS-2 — P6-51 placement locked as form (2) with three back-pointer
   D-entries (D-4002 / D-4003 / D-4004) citing CHANGE_GOVERNANCE.md
   sections. Session prompt must re-state in §Locked Values.
3. PS-3 — P6-52 paraphrase-table governance requirement documented;
   session prompt must include "Authoring discipline for grep-guarded
   identifiers" §Locked Values subsection with six-row paraphrase table.
4. Findings 1-4 — Path A rewrite of WP-040 + EC-040 resolved all four
   drafting-drift items (four-metric-categories paraphrase, D-3901
   inheritance, eight AUTHORITATIVE surface enumerations, post-mortem
   added to Commit A file list).

All mandatory pre-session actions are complete. No re-run of pre-flight
required beyond this v2 — these updates resolve risks identified by v1
without changing scope.
```

---

## Scope Lock (Critical) — unchanged structurally from v1

Scope is identical to v1 post-Path-A. Commit A now locks **five** files (governance doc + types + types.ts + index.ts + post-mortem). Commit B locks **five** files (STATUS + DECISIONS + DECISIONS_INDEX + WORK_INDEX + EC_INDEX). Commit A0 pre-flight bundle locks **seven** files (v1 + v2 + copilot + session prompt + WP-040 Path A rewrite + EC-040 Path A rewrite + D-4001 entries across DECISIONS.md / DECISIONS_INDEX.md / 02-CODE-CATEGORIES.md).

### WP-040 Is Allowed To

- Create the four Commit A governance-content files.
- Create the fifth Commit A post-mortem.
- Modify `types.ts` + `index.ts` additively (re-exports only).
- Apply the five Commit B governance-close edits.
- Land the seven Commit A0 pre-flight-bundle files.

### WP-040 Is Explicitly Not Allowed To

(unchanged from v1 + EC-040 v2 tightening)
- No modification of prior contract files.
- No gameplay systems, no `LegendaryGameState` additions, no engine gameplay file modification.
- No `require()` in any generated file.
- No parallel severity / counter / environment / version-axis type.
- No canonical `CHANGE_CATEGORIES` readonly array (EC-040 locks this explicitly — metadata-only types do not inherit the drift-detection discipline for runtime-typed unions).
- No files outside the five+five+seven allowlist.

---

## Test Expectations — unchanged from v1, with EC-040 tightening

- Zero new tests.
- Prior baseline 444 / 110 / 0 and 596 / 0 must remain unchanged post-Commit-A and post-Commit-B. EC-040 §After Completing now locks both baselines explicitly (v1 locked only the build exit code).

**Verdict: PASS.**

---

## Risk & Ambiguity Review — carried forward from v1

All eight v1 risks re-evaluated. No new risks introduced by Path A:

- **RS-1** (ChangeCategory vs Layer Boundary): Admissible — cross-link in produced doc. D-3901 reuse-verification PASS recorded in EC-040 §Locked Values. **No change at v2.**
- **RS-2** (immutableSurface extension seam): Extension discipline documented in EC-040 §D-3901 Reuse Verification — "Any future addition … requires a fresh D-3901 reuse-verification run + a new D-entry in docs/ai/DECISIONS.md." **Tightened at v2.**
- **RS-3** (P6-52 risk in produced doc): Session prompt §Locked Values will include paraphrase table. **Deferred to session prompt per PS-3 disposition.**
- **RS-4** (post-mortem placement option a vs b): Option (a) locked via Finding 4 resolution. **Closed at v2.**
- **RS-5** (WORK_INDEX date token): No action required. **Unchanged.**
- **RS-6** (Gate 8 drift): Commit A0 bundle will stage all drift into one clean `SPEC:` commit. **Flagged for Commit A0 authoring.**
- **RS-7** (`docs/governance/` new subdir classification): No classification required for new `docs/<subdir>/` directories. **Unchanged — confirmed at v2.**
- **RS-8** (deliberate v1 preservation by c861b24): Resolved by v2 Path A application. **Closed.**

No new HIGH- or MEDIUM-impact risks discovered at v2.

---

## Pre-Flight Verdict (Binary)

**READY TO EXECUTE.**

All four v1 Path A findings (1, 2, 3, 4) resolved by construction via Path A rewrites of WP-040 and EC-040. PS-1 (D-4001) resolved by authoring the decision entry across DECISIONS.md + DECISIONS_INDEX.md + 02-CODE-CATEGORIES.md. PS-2 and PS-3 are session-prompt concerns pre-emptively documented here for session-prompt authoring.

D-3901 reuse verification PASS (4/4 genuinely novel, re-verified at v2). All nine §9 reality gates PASS (Gate 8 drift is documentation-only Commit A0 bundle content). Structural Readiness PASS. Code Category Boundary RESOLVED. Dependency & Sequencing PASS. Vision Sanity Check PASS. Dependency Contract Verification PASS. Input Data Traceability PASS. Test Expectations PASS. Risk & Ambiguity Review: no new risks.

WP-040 is properly sequenced, scoped, and ready for execution **after** the session prompt is generated with PS-2 and PS-3 transcribed into §Locked Values and **after** the copilot check (step 1b per 01.4 workflow) returns CONFIRM.

---

## Invocation Prompt Conformance Check (Pre-Generation)

This check applies now that verdict is READY TO EXECUTE. Session prompt authoring is authorized subject to the following must-carry items:

- [x] All EC locked values must be copied verbatim into the invocation prompt — includes the four D-3901-verified type literals, the five immutable surfaces, the version-impact rules per category, and the RULES "0 by default; at most 1 per release and only with simulation validation" budget.
- [x] No new keywords, helpers, file paths, or timing rules appear only in the prompt — prompt transcribes EC + WP, nothing more.
- [x] File paths, extensions, and test locations match the WP exactly — five Commit A files, five Commit B files.
- [x] No forbidden imports or behaviors are introduced by wording changes — P6-52 paraphrase table prevents meta-prose grep-guard trips.
- [x] Prompt does not resolve ambiguities not resolved in this pre-flight — PS-2 form (2) and PS-3 paraphrase discipline are both pre-resolved here.
- [x] Contract names and field names in the prompt match the verified dependency code — `IncidentSeverity` / `OpsCounters` / `DeploymentEnvironment` / version-axes types verified at v1 and v2.
- [x] Helper call patterns in the prompt reflect actual signatures — N/A (no helper calls; types-only WP).

**Verdict: AUTHORIZED.** Session prompt generation may proceed after copilot check (01.7) returns CONFIRM.

---

## Authorized Next Step

> You are authorized to run the **copilot check** (step 1b per `01.4` workflow, `01.7-copilot-check.md` 30-issue lens) against this v2 pre-flight + WP-040 Path A + EC-040 Path A as the combined input. Save as:
>
> `docs/ai/invocations/copilot-wp040-growth-governance-change-budget.md`
>
> If copilot check returns **CONFIRM**, you are then authorized to generate the **session execution prompt** for WP-040 to be saved as:
>
> `docs/ai/invocations/session-wp040-growth-governance-change-budget.md`
>
> The session prompt must include:
> - P6-51 placement form (2) statement in §Locked Values (PS-2 transcription)
> - P6-52 "Authoring discipline for grep-guarded identifiers" subsection with the six-row paraphrase table (PS-3 transcription)
> - Explicit "01.5 NOT INVOKED" declaration per WP-030 precedent
> - Three-commit topology lock (A0 SPEC bundle → A EC-040 content → B SPEC governance close) per session-context §7
> - Vision trailer: `Vision: §5, §13, §14, §22, §24`

**Guard:** The session prompt must conform exactly to the scope, constraints, and decisions locked by this v2 pre-flight and the v2-refreshed EC-040. No new scope may be introduced.

---

## Final Instruction

Pre-flight exists to **prevent premature execution and scope drift**.

v2 verdict: **READY TO EXECUTE** (subject to copilot-check CONFIRM per 01.4 step-1b sequencing rule).

The v1 → v2 cycle closed cleanly: four Path A findings + three pre-session actions, all resolved without scope expansion. All resolutions applied via documentation edits + one DECISIONS.md addition (D-4001) — zero code changes, zero test changes, zero engine-gameplay-file touches. This is the expected well-governed v1 → v2 trajectory.

Proceed to copilot check (step 1b). Do NOT generate a session execution prompt until copilot-check CONFIRM verdict lands.

---

*Pre-flight v2 authored 2026-04-23 at `main @ c861b24` + in-flight Path A edits. Author: WP-040 pre-flight session (same as v1). Consumer: WP-040 copilot-check author + session-prompt author. v2 is load-bearing until Commit A0 SPEC lands; at that point v1 and v2 both become historical audit artifacts.*
