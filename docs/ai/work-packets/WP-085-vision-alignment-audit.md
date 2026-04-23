# WP-085 — Vision Alignment Audit (Detection, Classification & Gating)

**Status:** Draft (drafted 2026-04-22; pre-flight pending)
**Primary Layer:** Governance / Audit Tooling
**Dependencies:** None (builds on the audit scaffold landed at INFRA `24996a9` and the §17 gate landed at SPEC `0689406`)

---

## Session Context

The §17 Vision Alignment gate landed in commits `0689406` (00.3 / 01.3 /
01.4 governance) and `2f65d9f` (Phase 7 WP blocks). The supporting
instrument — four `.greps.mjs` scripts under `scripts/audit/vision/` —
landed at INFRA `24996a9`.

The instrument exists and has been calibrated against `main` (output
captured in the INFRA commit body). The four scripts, however, are
uncoordinated: each runs independently, no combined report is produced,
and there is no executable PASS/FAIL gate. Furthermore, calibration
revealed six DET-001 matches that are **documentation-only** (JSDoc /
comment warnings against `Math.random()`), rather than executable use.

This WP codifies the audit's governance: how the four scripts are
orchestrated, how the calibrated baseline is enforced, what counts as a
regression, and how violations escalate to corrective WPs. It does not
modify engine code, does not fix any vision violation, and does not
change gameplay behavior.

Per the project's settled audit/lint scaffold-then-spec rule (memory:
`feedback_audit_tooling_scaffold_first.md`), this WP is the
codification step that follows the prototype + calibration steps
already complete.

---

## Goal

Codify the Vision Alignment audit instrument as an enforceable,
deterministic, single-verdict gate that consumes the calibrated
baseline as its acceptance contract. After this session:

- A single orchestration script combines the four domain greps into
  one PASS/FAIL run
- A single combined report is emitted at
  `docs/audits/vision-alignment-{YYYY-MM-DD}.md`
- DET-001 becomes comment-aware for **executable detection**
  (executable matches FAIL; doc-comment occurrences are treated as
  baseline exceptions only at allowlisted file:line pairs)
- The exact baseline (6 DET-001 / 4 DET-007 / 0 / 0 / 0) is enforced
  bit-for-bit
- Regressions escalate via corrective WP, never via in-place edits to
  WP-085

---

## Assumes

- INFRA commit `24996a9` complete. Specifically:
  - `scripts/audit/vision/determinism.greps.mjs` exists with `RULES`
    and `runRules()` exports
  - `scripts/audit/vision/monetization.greps.mjs` exists similarly
  - `scripts/audit/vision/registry.greps.mjs` exists similarly
  - `scripts/audit/vision/engine-boundary.greps.mjs` exists similarly
- SPEC commit `0689406` complete. Specifically:
  - `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` §17 (Vision
    Alignment) exists
  - `docs/ai/REFERENCE/01.4-pre-flight-invocation.md` includes
    `01-VISION.md` as Authority Chain item #3 and the Vision Sanity
    Check subsection
  - `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md` documents
    the `Vision:` trailer convention
- SPEC commit `2f65d9f` complete (Phase 7 WP Vision Alignment blocks
  landed for WP-039, 040, 041, 049, 050, 051)
- SPEC commit `b1c675b` complete (WORK_INDEX Phase 7 breadcrumb
  landed).
- `docs/ai/work-packets/WORK_INDEX.md` reflects WP-085 as a queued
  Phase 7 governance packet (breadcrumb and row corrected).
- `docs/ai/DECISIONS.md` contains D-8501 (WP-085 is the queued
  governance instrument for §17 Vision Alignment audit enforcement).
- Calibration baseline captured on `main` at INFRA `24996a9` is the
  source of truth for AC-2, AC-3, and AC-4
- `git grep -P` is available (the host's git build supports PCRE)
- `pnpm` and Node v22+ are installed (project standard)
- `docs/audits/` directory exists or will be created at first
  orchestrator run

If any of the above is false, this packet is **BLOCKED** and must not
proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/01-VISION.md` — the authoritative vision. Read §3 (Trust &
  Fairness), §13 (EC-Driven Development), §14 (No Silent Drift),
  §18 (Replayability), §22 (Deterministic & Reproducible Evaluation),
  §24 (Replay-Verified Competitive Integrity), and NG-1..7. The audit
  enforces these clauses programmatically.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the
  audit must not violate the layer rules it enforces. The orchestrator
  script lives outside `packages/`, never imports engine code.
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17` — defines the
  Vision Alignment gate this WP institutionalizes.
- `docs/ai/REFERENCE/01.4-pre-flight-invocation.md "Vision Sanity
  Check"` — defines how pre-flight uses the gate.
- `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md "Vision
  Trailer"` — defines the optional trailer the EC-085 commit must use.
- `scripts/audit/vision/*.greps.mjs` — the four existing scripts. Read
  them. The orchestrator must invoke each via dynamic import without
  modifying them. The single exception is the comment-aware filter
  added to `determinism.greps.mjs` per Scope (In) §B.
- `.claude/rules/work-packets.md` — single packet per session, no
  historical edits, dependencies must be complete.
- `.claude/rules/code-style.md` — ESM, `node:` prefix, JSDoc on every
  function, full-sentence error messages, no `.reduce()` for branching
  logic, no abbreviated names.

---

## Scope (In)

### A) `scripts/audit/vision/run-all.mjs` — new

Orchestrator that imports `runRules` from each of the four domain
scripts, runs them sequentially, aggregates findings into a single
report, and emits PASS/FAIL.

Required behavior:
- Read-only against the engine — produces a report file but never
  mutates engine, registry, server, or UI code
- Deterministic output for a fixed `git rev-parse HEAD` value
- Captures the audited commit hash via `git rev-parse HEAD` once at
  start
- Writes the report to `docs/audits/vision-alignment-{YYYY-MM-DD}.md`
  using local date
- Refuses to overwrite an existing same-day report (exits with a
  full-sentence error message; `// why:` comment explains audit-history
  immutability)
- Returns exit code `0` on PASS, `1` on FAIL
- Calibration baseline values appear as named constants
  (`EXPECTED_DET_001 = 6`, `EXPECTED_DET_007 = 4`, etc.), never as
  magic numbers
- Reading the six DET-001 allowlist file paths for doc-comment
  verification is a permitted read-only operation and does not
  constitute engine coupling or mutation.

**DET-001 baseline handling (required to preserve the calibrated "6"):**

- The orchestrator must separately verify the **six DET-001 allowlist
  file:line pairs** exist **and are doc-comments** (line content begins
  with `*`, `//`, or `/*` after trimming leading whitespace).
- These six are reported as **baseline exceptions** (counted toward
  DET-001 = 6) and are **PASS only** if they match exactly and are
  comment-only.
- Any **executable** DET-001 hit reported by `determinism.greps.mjs` is
  an automatic **FAIL** (and is *not* "offset" by the allowlist).

### B) `scripts/audit/vision/determinism.greps.mjs` — modified

Add comment-aware filtering to DET-001 only:
- After `git grep` returns matches, post-filter to discard lines whose
  content (after the `path:lineno:` prefix) begins with `*`, `//`, or
  `/*` (with any leading whitespace).
- DET-001's allowlist is enforced by the orchestrator; this script's
  job is to flag executable hits only. After the filter, DET-001 must
  produce **zero executable findings** on the current `main`.
- Add a `// why:` comment on the filter explaining its asymmetry with
  DET-007 (DET-001 catches a determinism invariant where doc-comment
  hits are pure documentation; DET-007 is a wall-clock awareness
  warning where doc-comment hits are equally meaningful as executable
  hits).
- All other RULES in this file must remain untouched.
- The filter must not change DET-001's behavior on currently-flagged
  executable code (none exists today; this is preserved by AC-2's
  zero-deviation rule).

### C) Combined report format

The report at `docs/audits/vision-alignment-{YYYY-MM-DD}.md` must
contain:
- Heading with date and audited commit hash
- Per-scan section (Determinism, Monetization, Registry, Engine
  boundary) with critical and warning counts
- Allowlist references (AC-3 and AC-4 file:line pairs)
- Explicit section (or subsection) enumerating the **DET-001 baseline
  exception** lines (AC-3) and confirming they are doc-comments
- A single `VERDICT: PASS` or `VERDICT: FAIL` line
- A `Vision: §3, §13, §14, §22, §24` trailer line for grep-ability

### D) Calibrated baseline constants — new

WP-085 codifies the calibrated audit baseline captured on `main` at
INFRA `24996a9` as named constants in the orchestrator.

This WP does not re-calibrate or reinterpret the baseline; it
*consumes* it as a locked contract.

These constants are:

- `EXPECTED_DET_001 = 6`
- `EXPECTED_DET_007 = 4`
- `EXPECTED_MONETIZATION = 0`
- `EXPECTED_REGISTRY = 0`
- `EXPECTED_ENGINE_BOUNDARY = 0`

Any change to these values requires a new SPEC decision and a
superseding WP per AC-6.

---

## Out of Scope

- **No engine modifications.** Not even to fix a real DET-001 hit if
  one is found. Violations escalate to corrective WPs per AC-6.
- **No new domain greps.** Adding a new clause-coverage script (e.g.,
  accessibility, performance, security) is a separate future WP.
- **No `package.json` script wrapper.** Whether to expose
  `pnpm audit:vision` is an INFRA concern, deferred to a follow-up.
- **No CI integration.** Wiring the audit into GitHub Actions or
  pre-commit hooks is a follow-up WP.
- **No backfill of `## Vision Alignment` blocks** to historical WPs
  beyond Phase 7. Phase 7 WPs received blocks under SPEC `2f65d9f`;
  pre-Phase-7 WPs are out of scope here.
- **No modification to the §17 gate text.** The gate is settled at
  SPEC `0689406`.
- **No edits to historical WPs** (per `.claude/rules/work-packets.md`).
- **No automatic remediation.** The audit detects and reports;
  corrective WPs do the fixing.
- Refactors, cleanups, or "while I'm here" improvements are **out of
  scope** unless explicitly listed in Scope (In) above.

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`. WP-085 is
> the audit instrument for the §17 gate; it codifies how vision
> compliance is detected, classified, and gated across the engine.

**Vision clauses touched:** §3, §13, §14, §18, §22, §24, NG-1, NG-3

**Conflict assertion:** No conflict. WP-085 enforces — does not
redefine — the touched clauses. The audit is a detection /
classification / gating instrument; it never mutates engine code or
scoring logic. §22 and §24 determinism are preserved by definition
(the audit's job is to catch any regression that would break them).
§18 replay faithfulness depends on §22, so the audit transitively
protects it.

**Non-Goal proximity:** Confirmed clear. WP-085 *enforces* NG-1 and
NG-3 zero-tolerance via AC-5 (monetization predicates and content-
withholding patterns). It introduces no paid surface, no leaderboard,
and no user-facing feature. The audit's reports are public-by-default
in the repo, consistent with NG-7 (no apologetic monetization).

**Determinism preservation:** STRONG. The orchestrator is read-only
against engine code. Output is deterministic for a fixed commit hash
(per AC-1). The audit's whole purpose is to catch any change that
would make engine output non-deterministic (per §22).

---

## Files Expected to Change

### EC-085 execution (Commit A)

- `scripts/audit/vision/run-all.mjs` — **new** — orchestrator script
  that invokes each domain `runRules`, aggregates counts, writes the
  combined report, and emits PASS/FAIL exit code
- `scripts/audit/vision/determinism.greps.mjs` — **modified** —
  comment-aware filter on DET-001 only (with `// why:` comment); all
  other RULES untouched
- `docs/audits/vision-alignment-{YYYY-MM-DD}.md` — **new** — first
  audit report, generated by the orchestrator on its initial run

### Modified — governance (Commit B, post-EC-085)

- `docs/ai/STATUS.md` — vision audit governance live; baseline locked
  at calibration captured by INFRA `24996a9`
- `docs/ai/work-packets/WORK_INDEX.md` — WP-085 `[ ]` → `[x]` with
  today's date
- `docs/ai/DECISIONS.md` — three new entries at minimum (baseline
  source-of-truth; comment-aware filter asymmetry between DET-001 and
  DET-007; same-day re-run refusal as audit-history immutability
  principle)

No files outside the lists above may be modified.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents required for every new or modified file. No
  diffs, no snippets, no "show only the changed section."
- ESM only, Node v22+
- `node:` prefix on all Node.js built-in imports
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- Read-only against `packages/` and `apps/` — orchestrator and the
  modified determinism grep must not import, write, or otherwise touch
  engine, registry, server, or UI code.
- Each function must have a JSDoc comment.
- No abbreviated names (no `cfg`, `e`, `cb`, `fn`, `msg`, etc.).
- Full-sentence error messages — what failed and what to check.
- No `.reduce()` for multi-step branching logic; use `for...of`.
- DET-001 comment-filter must use a `// why:` comment explaining its
  asymmetry with DET-007.
- The orchestrator's date-collision refusal must use a `// why:`
  comment explaining audit-history immutability.
- Calibration baseline values (6 DET-001 / 4 DET-007 / 0 / 0 / 0)
  appear as named constants in the orchestrator, never magic numbers.

**Session protocol:**
- If the calibrated baseline (6 / 4 / 0 / 0 / 0) cannot be reproduced
  exactly during verification, **STOP**. Do not proceed. The
  discrepancy must be investigated; either the engine has drifted
  since `24996a9` or the audit logic differs from calibration. Either
  is a stop-ship blocker until reconciled.
- If any contract, file:line allowlist, or constant is unclear, stop
  and ask before proceeding.

**Locked contract values:**
- Audit baseline matrix: see AC-2.
- DET-001 allowlist: 6 file:line pairs, see AC-3.
- DET-007 allowlist: 4 file:line pairs, see AC-4.
- Report file path pattern: `docs/audits/vision-alignment-{YYYY-MM-DD}.md`
  using local date.
- Vision trailer for the EC-085 execution commit:
  `Vision: §3, §13, §14, §22, §24`.

---

## Acceptance Criteria

### AC-1 — Execution scope and mechanics

- The four domain greps (`determinism`, `monetization`, `registry`,
  `engine-boundary`) must execute read-only — no writes, no fixes.
- A single orchestration script (`scripts/audit/vision/run-all.mjs`)
  invokes the four greps and is the only component permitted to write
  output.
- **PASS** if greps are read-only and the orchestrator produces a
  report; **FAIL** otherwise.

### AC-2 — Baseline match (calibrated)

The combined audit output must match the calibrated baseline below
exactly. Any deviation in count, severity, or class is a **FAIL**.

| Scan             | Severity / Class    | Expected count | Result rule                                          |
|------------------|---------------------|---------------:|------------------------------------------------------|
| Determinism      | DET-001 (Critical)  |              6 | Composite: 6 orchestrator-verified allowlist matches (AC-3) + 0 script-channel executable findings. Deviation in either channel is a **FAIL**. |
| Determinism      | DET-007 (Warning)   |              4 | Allowed only at the enumerated allowlist (AC-4)      |
| Monetization     | Any                 |              0 | Any non-zero count is a **FAIL**                     |
| Registry         | Any                 |              0 | Any non-zero count is a **FAIL**                     |
| Engine boundary  | Any                 |              0 | Any non-zero count is a **FAIL**                     |

**PASS** if every cell matches; **FAIL** on any deviation.

### AC-3 — DET-001 allowlist (exact file:line, doc-comment only)

The only permitted DET-001 matches are inside JSDoc or single-line
comments warning against runtime use of `Math.random`, at exactly:

- `packages/game-engine/src/moves/coreMoves.impl.ts:10`
- `packages/game-engine/src/moves/zoneOps.ts:5`
- `packages/game-engine/src/setup/shuffle.ts:5`
- `packages/game-engine/src/simulation/ai.legalMoves.ts:9`
- `packages/game-engine/src/simulation/ai.random.ts:9`
- `packages/game-engine/src/simulation/simulation.runner.ts:10`

Rules:
- Any DET-001 hit outside these six file:line pairs is a **FAIL**.
- Any script-channel DET-001 finding (any executable match reported
  by `determinism.greps.mjs` after the comment-aware filter) is a
  **FAIL** even if its file:line would match an allowlist entry —
  executable use is never permitted, regardless of location.
- The total DET-001 count must remain exactly 6.

### AC-4 — DET-007 allowlist (exact file:line, snapshot/version only)

The only permitted DET-007 warnings are wall-clock reads in derived
snapshot or version metadata, at exactly:

- `packages/game-engine/src/persistence/persistence.types.ts:75`
- `packages/game-engine/src/persistence/snapshot.create.ts:86`
- `packages/game-engine/src/persistence/snapshot.create.ts:90`
- `packages/game-engine/src/versioning/versioning.stamp.ts:59`

Rules:
- Any DET-007 hit outside these four file:line pairs is a **FAIL**.
- Any promotion of `new Date()` into move, rule, or effect code is a
  **FAIL** even if file:line matches.
- The total DET-007 count must remain exactly 4.

### AC-5 — Zero-tolerance categories

Any finding (any severity) in the following categories is an
automatic **FAIL**:

- Monetization predicates — Vision §3, NG-1, NG-3 (rule IDs MON-001..006)
- Registry divergence or hard-coded card values — Vision §1, §2
  (REG-001..004)
- Engine importing from `apps/`, `pg`, or framework in pure helpers —
  Vision §7, §8 (BND-001..006)

### AC-6 — Regression handling (no historical edits)

- The allowlists in AC-3 and AC-4 are baseline exceptions, not
  endorsements.
- Any regression — new finding, relocated finding, or count change —
  is a **FAIL** unless accompanied by:
  - a new `DECISIONS.md` entry, AND
  - a superseding corrective WP that re-establishes the baseline.
- WP-085's Acceptance Criteria are never edited in place; corrections
  ship as new WPs per `.claude/rules/work-packets.md`.

### AC-7 — Output artifact

The orchestrator must emit a single combined report at:

```
docs/audits/vision-alignment-YYYY-MM-DD.md
```

The report must contain:
- audited commit hash
- per-scan critical and warning counts
- explicit references to AC-3 and AC-4 allowlists
- a single `VERDICT: PASS` or `VERDICT: FAIL` line
- a `Vision:` clause list matching AC-9

### AC-8 — Enforcement semantics

- **PASS** only if AC-1 through AC-7 all pass.
- **FAIL** triggers: classification of every finding by rule ID, and
  creation of at least one corrective WP. Historical WPs are never
  edited.

### AC-9 — Vision alignment self-compliance

WP-085 must include a `## Vision Alignment` block (per
`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` §17) citing
§3, §13, §14, §18, §22, §24, NG-1, NG-3 — with an explicit
no-conflict assertion and a determinism-preservation line. (See
`## Vision Alignment` above; this AC is its own self-check.)

### AC-10 — Commit trailer governance

The EC-085 execution commit must include a `Vision:` trailer
(per `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`)
listing §3, §13, §14, §22, §24.

---

## Verification Steps

```bash
# Step 1 — confirm new orchestrator exists
test -f scripts/audit/vision/run-all.mjs
# Expected: exit 0

# Step 2 — confirm determinism.greps.mjs gained the comment-aware filter
grep -n "comment-aware" scripts/audit/vision/determinism.greps.mjs
# Expected: at least one match alongside a // why: comment

# Step 3 — run the orchestrator on the current working tree
node scripts/audit/vision/run-all.mjs
# Expected: exit code 0 (PASS); single line "VERDICT: PASS"

# Step 4 — confirm the report was written
ls docs/audits/vision-alignment-*.md | head -1
# Expected: a file dated today

# Step 5 — confirm report structure
grep -c "^## " docs/audits/vision-alignment-*.md | head -1
# Expected: at least 5 (per-scan sections plus verdict)

# Step 6a — confirm baseline composite counts match exactly
grep -E "DET-001|DET-007|Monetization|Registry|Engine boundary" \
  docs/audits/vision-alignment-*.md | head -10
# Expected: DET-001 = 6, DET-007 = 4, Monetization = 0,
# Registry = 0, Engine boundary = 0

# Step 6b — confirm the two-channel DET-001 decomposition explicitly
grep -E "executable findings.*0|baseline exception" \
  docs/audits/vision-alignment-*.md
# Expected: at least one line confirming "DET-001 executable
# findings: 0" AND the baseline-exception section listing the six
# allowlist file:line pairs per Scope (In) §C. Both channels must
# be observable in the report, not just the composite count.

# Step 7 — confirm Vision trailer present
grep "^Vision:" docs/audits/vision-alignment-*.md
# Expected: "Vision: §3, §13, §14, §22, §24"

# Step 8 — confirm same-day re-run refuses to overwrite
node scripts/audit/vision/run-all.mjs
# Expected: exit code non-zero; full-sentence error mentioning audit
# history immutability

# Step 9 — confirm no engine, registry, server, or UI files modified
git diff --name-only packages/ apps/
# Expected: no output

# Step 10 — confirm only allowlisted files changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in
> `## Verification Steps` before checking any item below. Reading the
> code is not sufficient — run the commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `scripts/audit/vision/run-all.mjs` exists and is read-only
      against engine, registry, server, and UI code
- [ ] `scripts/audit/vision/determinism.greps.mjs` has comment-aware
      filtering on DET-001 with the required `// why:` comment
- [ ] First audit report at `docs/audits/vision-alignment-{YYYY-MM-DD}.md`
      exists
- [ ] Report contains commit hash, per-scan counts matching baseline,
      AC-3 and AC-4 allowlist references, single `VERDICT:` line, and
      the `Vision:` trailer
- [ ] Baseline matches exactly (6 DET-001 / 4 DET-007 / 0 / 0 / 0)
- [ ] Same-day re-run refuses to overwrite (date-collision protection
      works)
- [ ] No engine, registry, server, or UI files modified (confirmed
      with `git diff packages/ apps/`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — vision audit governance live;
      baseline locked at calibration captured by INFRA `24996a9`
- [ ] `docs/ai/DECISIONS.md` updated with at minimum:
  - Vision audit baseline source-of-truth (calibration on `main` at
    INFRA `24996a9`)
  - Comment-aware filter asymmetry between DET-001 and DET-007
  - Same-day re-run refusal as audit-history immutability principle
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-085 checked off with
      today's date

---

## Post-WP-085 Follow-ups

~~The items below are **out of EC-085 scope** and tracked separately
from this packet's Definition of Done.~~

**No remaining follow-ups.** The original list has been fully
closed:

- WORK_INDEX breadcrumb correction (WP-042 → WP-085 references at
  the Phase 7 breadcrumb) — landed in the WP-085 registration
  bundle at SPEC `2e88aa7`; the corresponding bullet was removed
  from this section in the same commit.
- Memory-file rationale correction (`feedback_audit_tooling_scaffold_first.md`
  WP-042 → WP-085 references) — **vacuous**: verified post-WP-085-
  registration that the memory file contains zero `WP-042`
  references and already cites `WP-085` at its only WP-bearing
  line. No correction was ever required; the original follow-up
  bullet reflected an incorrect assumption by this WP's drafter.

Section header retained for consistency with the WP template
convention. Future WP-085-scope follow-ups (if any surface) would
be appended below this note.
