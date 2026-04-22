# Session Context — WP-085 (Vision Alignment Audit — Detection, Classification & Gating)

> **Authored:** 2026-04-22 as a bridge document for the EC-085
> execution session. **Purpose:** Surface the conversation-level
> context that produced WP-085 and its supporting governance, so the
> executor does not re-derive design decisions from git log alone.
>
> **No execution is performed by authoring this file.** The
> orchestrator script (`scripts/audit/vision/run-all.mjs`), the
> comment-aware filter on `determinism.greps.mjs`, and the first
> audit report under `docs/audits/` are not produced here; they
> belong to EC-085 Commit A.

---

## 1. State on `main` (as of authoring)

The §17 Vision Alignment governance and audit instrument are landed:

- INFRA `24996a9` — four `.greps.mjs` scaffold under
  `scripts/audit/vision/`
- SPEC `0689406` — §17 Vision Alignment gate added to 00.3 / 01.3 / 01.4
- SPEC `2f65d9f` — Phase 7 WP Vision Alignment blocks
  (WP-039, 040, 041, 049, 050, 051)
- SPEC `b1c675b` — WORK_INDEX Phase 7 breadcrumb
- SPEC `e5b0d67` — WP-037 Vision Alignment block applied
- SPEC `83a9b3a` — WP-037 session prompt §17 retrofit
- EC  `160d9b9` — WP-037 fully executed (EC-037 ship)
- SPEC `ee099c5` — WP-037 / EC-037 governance close
- SPEC `2998d8a` — Vision Alignment audit report on WP-037 session
  prompt landed under `docs/audits/`
- SPEC `2e88aa7` — WP-085 file + WORK_INDEX row + D-8501 registered
- SPEC `8b84587` — EC-085 checklist + EC_INDEX row registered

WP-085 row in WORK_INDEX is marked Reviewed, ready for pre-flight.
EC-085 row in EC_INDEX is marked Draft.

---

## 2. The Calibrated Baseline (LOCKED)

Captured against `main` at INFRA `24996a9`:

| Scan             | Severity / Class    | Count |
|------------------|---------------------|------:|
| Determinism      | DET-001 (Critical)  |     6 |
| Determinism      | DET-007 (Warning)   |     4 |
| Monetization     | Any                 |     0 |
| Registry         | Any                 |     0 |
| Engine boundary  | Any                 |     0 |

**This is locked contract.** The executor MUST NOT re-run the audit
in order to "fresh-derive" baseline numbers. The numbers above are
the source of truth (per WP-085 AC-2 and EC-085 Locked Values).
Re-deriving against a later commit invalidates the contract — that
is the entire point of locking the calibration to a specific anchor.

---

## 3. The Two-Channel DET-001 Model (Rationale)

The calibration revealed 6 DET-001 hits — all inside JSDoc or
single-line comments warning *against* `Math.random()` (e.g.,
"All randomness uses ctx.random exclusively — never Math.random()").
Zero executable hits.

The audit needs to do two different things:
- **(a)** FAIL if any executable `Math.random(` appears (the actual
  determinism invariant per Vision §22).
- **(b)** PASS the existing 6 doc-comment hits as known baseline
  exceptions, but only at the exact six file:line pairs.

A single-channel approach (one filter OR one allowlist) cannot cleanly
do both. Two-channel separates concerns:

- **Script channel** (`determinism.greps.mjs`): comment-aware filter
  discards lines whose content begins with `*`, `//`, or `/*` (after
  trimming leading whitespace). Reports executable hits only. After
  the filter, current `main` produces zero DET-001 findings from this
  channel.
- **Orchestrator channel** (`run-all.mjs`): independently verifies the
  six file:line allowlist sites exist AND each is comment-content.
  These count as the baseline six.

Failure modes the two channels jointly catch:
- New `Math.random(` in executable code anywhere → script channel FAIL
- New `Math.random(` in executable code AT one of the six allowlist
  sites → script channel FAIL (allowlist does not "offset" executable
  hits)
- A relocated or removed doc-comment warning → orchestrator channel
  FAIL (allowlist mismatch)

---

## 4. The DET-007 Single-Channel Asymmetry (Rationale)

DET-007 (`new Date(`) does NOT get comment-aware filtering. The
warning covers wall-clock awareness; doc-comment occurrences are
equally meaningful as executable ones (a `// why: snapshotAt uses
new Date()` comment IS the canonical site documentation). Filtering
them out would lose audit signal.

The four known DET-007 sites (per AC-4) are all legitimate snapshot
or version metadata, never gameplay logic. Promotion of
`new Date()` into move, rule, or effect code is a FAIL even if the
file:line pair matches.

---

## 5. Patterns Still in Effect

- **Scaffold-then-spec for audit / lint instrumentation** (memory:
  `feedback_audit_tooling_scaffold_first.md`). Normal feature work
  remains contract-first; WP-085 follows the inverted ordering
  because it codifies a tool that was prototyped and calibrated
  first.
- **Vision Alignment §17 gate** is now enforced for every Phase 7
  WP. EC-085 must self-comply via WP-085's `## Vision Alignment`
  block (AC-9).
- **`Vision:` trailer convention** (per 01.3): the EC-085 execution
  commit MUST include `Vision: §3, §13, §14, §22, §24`.
- **Authority Chain item #3 = `01-VISION.md`** (per 01.4 update).
  Pre-flight reading order: CLAUDE.md → ARCHITECTURE.md →
  01-VISION.md → 03.1-DATA-SOURCES.md → 02-CODE-CATEGORIES.md →
  EC-### → WP-### → deps.
- **INFRA ≠ governance ≠ content** commit-boundary discipline.
  EC-085's Commit A (execution) and Commit B (governance close)
  must respect the same boundary; they cannot be bundled.

---

## 6. Active Risks for the Executor

### 6.1 Line-number brittleness in AC-3 and AC-4

The 6 DET-001 and 4 DET-007 file:line pairs are exact. Any unrelated
edit to those 10 files that shifts line numbers (e.g., adding a JSDoc
line above the warning comment) will FAIL the audit. This is
**intentional** per AC-6 — a re-baseline is a SPEC + corrective WP,
never an in-place edit. The executor MUST NOT "fix" line numbers
during EC-085 execution if drift has occurred since `24996a9`. Any
drift is a finding; classify per AC-6 and escalate.

### 6.2 Same-day re-run refusal

Per WP-085 Scope (In) §A: the orchestrator must refuse to overwrite
an existing same-day report. This protects audit-history
immutability — recording multiple verdicts for the same day
undermines the report's role as a point-in-time witness. The
refusal must be an explicit error with a full-sentence message and
a `// why:` comment.

### 6.3 Magic-number prohibition

Five named constants must be defined in `run-all.mjs`:

- `EXPECTED_DET_001 = 6`
- `EXPECTED_DET_007 = 4`
- `EXPECTED_MONETIZATION = 0`
- `EXPECTED_REGISTRY = 0`
- `EXPECTED_ENGINE_BOUNDARY = 0`

The numbers must NOT appear inline in comparison code. Per 00.6
code-style, locked contract values get named constants. EC-085
Locked Values calls this out explicitly.

### 6.4 No engine modifications

Even if the audit reveals a real DET-001 executable hit, the
executor MUST NOT fix it as part of EC-085. WP-085 is detection /
classification / gating only. Real findings escalate via a corrective
WP per AC-6 and Vision §13 (bugs are execution contract violations,
not patch targets).

### 6.5 Residual references to "WP-042"

The audit work was originally proposed in conversation as "WP-042"
before discovering that slot was taken by the existing Deployment
Checklists WP. The rename WP-042 → WP-085 was applied as the
governance work landed, but a few residual references may remain in
artifacts produced before the rename. Specifically check:

- Memory file `feedback_audit_tooling_scaffold_first.md` (line 14
  was corrected post-rename)
- WORK_INDEX Phase 7 breadcrumb (corrected post-rename)
- Audit report `docs/audits/vision-alignment-wp037-session-prompt.md`
  (may or may not contain stale WP-042 references — verify at
  pre-flight; correct if present via SPEC follow-up, never an
  in-place edit to a committed audit report)

If "WP-042" appears anywhere in audit-related context, it is
residual. WP-085 is the canonical identity.

---

## 7. Relevant Decisions

- **D-8501** — WP-085 is the queued governance instrument for §17
  Vision Alignment audit enforcement. Full text in
  `docs/ai/DECISIONS.md` at the §"Decision Log" entry for `8501`.

Additional D-NNNN entries for (a) the two-channel DET-001 model,
(b) the DET-007 single-channel asymmetry, and (c) same-day re-run
refusal as audit-history immutability are **scheduled to land in
EC-085's Commit B governance close**. They are not in DECISIONS.md
yet; the executor should plan to author them as part of Commit B.

---

## 8. Authoritative References

This file is **not authoritative**. If a conflict arises:

- On design intent → WP-085 wins
  (`docs/ai/work-packets/WP-085-vision-alignment-audit.md`)
- On execution contract → EC-085 wins
  (`docs/ai/execution-checklists/EC-085-vision-alignment-audit.checklist.md`)
- On governance gate → 00.3 §17 wins
  (`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`)
- On vision clauses → 01-VISION.md wins (`docs/01-VISION.md`)

This bridge file exists to surface the *why* behind the *what*. It
will be effectively superseded once EC-085 lands and the design
rationale is captured in DECISIONS.md (Commit B).
