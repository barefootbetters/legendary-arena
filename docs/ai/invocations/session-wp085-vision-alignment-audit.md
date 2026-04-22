# Session Execution Prompt — WP-085 (Vision Alignment Audit)

> **Mode:** EC-mode.
> **Work Packet:** `docs/ai/work-packets/WP-085-vision-alignment-audit.md`
> **Execution Checklist:** `docs/ai/execution-checklists/EC-085-vision-alignment-audit.checklist.md`
> **Pre-flight:** READY TO EXECUTE (2026-04-22, in-session report; Copilot Check CONFIRM).
> **Generated:** 2026-04-22.
>
> This prompt is a strict transcription + ordering artifact derived from
> WP-085, EC-085, and the pre-flight. It introduces no new scope. If any
> ambiguity remains, STOP and escalate — do not resolve ambiguity in
> execution.

---

## 1. Authority Chain (Read in Order, Before Any Edit)

1. `.claude/CLAUDE.md` — EC-mode, lint gate, commit discipline
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary is authoritative
3. `docs/01-VISION.md` — §3, §13, §14, §18, §22, §24, NG-1, NG-3
4. `docs/03.1-DATA-SOURCES.md` — no user data consumed (audit is read-only against git-tracked files)
5. `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` — `scripts/` → `infra`; `docs/` → `docs`
6. `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17` — Vision Alignment gate this WP institutionalizes
7. `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md` — Vision Trailer convention
8. `docs/ai/execution-checklists/EC-085-vision-alignment-audit.checklist.md` — authoritative execution contract
9. `docs/ai/work-packets/WP-085-vision-alignment-audit.md` — authoritative design contract
10. D-8501 in `docs/ai/DECISIONS.md` — WP-085 is the queued §17 enforcement instrument

EC beats WP on execution correctness; WP beats EC on design intent; ARCHITECTURE.md and 01-VISION.md beat both on layer and intent questions respectively.

---

## 2. Work Packet Class

**Infrastructure & Verification** — produces an audit report, emits PASS/FAIL exit code, never mutates `G`, never wires into `game.ts`, never adds moves or phases.

---

## 3. Locked Values (Copied Verbatim from EC-085)

### Calibrated Baseline (Source: INFRA `24996a9` on `main`)

```
EXPECTED_DET_001         = 6
EXPECTED_DET_007         = 4
EXPECTED_MONETIZATION    = 0
EXPECTED_REGISTRY        = 0
EXPECTED_ENGINE_BOUNDARY = 0
```

These are **named constants in the orchestrator**, never magic numbers in comparison code. Any change requires a new SPEC decision and a superseding corrective WP per WP-085 AC-6.

### DET-001 Allowlist (Exact File:Line, Doc-Comment Only) — WP-085 AC-3

```
packages/game-engine/src/moves/coreMoves.impl.ts:10
packages/game-engine/src/moves/zoneOps.ts:5
packages/game-engine/src/setup/shuffle.ts:5
packages/game-engine/src/simulation/ai.legalMoves.ts:9
packages/game-engine/src/simulation/ai.random.ts:9
packages/game-engine/src/simulation/simulation.runner.ts:10
```

### DET-007 Allowlist (Exact File:Line, Snapshot / Version Metadata Only) — WP-085 AC-4

```
packages/game-engine/src/persistence/persistence.types.ts:75
packages/game-engine/src/persistence/snapshot.create.ts:86
packages/game-engine/src/persistence/snapshot.create.ts:90
packages/game-engine/src/versioning/versioning.stamp.ts:59
```

### Report Path and Trailer

- Report path pattern: `docs/audits/vision-alignment-{YYYY-MM-DD}.md` (local date; see L-decision L4 below)
- Report trailer line: `Vision: §3, §13, §14, §22, §24`
- Execution commit trailer (WP-085 AC-10): `Vision: §3, §13, §14, §22, §24`

---

## 4. Pre-Flight Locked Decisions (L1–L5)

These were resolved during pre-flight and must not be re-litigated during execution.

- **L1 — Aggregation semantics for zero-tolerance categories:** For Monetization, Registry, and Engine-boundary, the orchestrator aggregates `critical + warning` when comparing to `EXPECTED_*`. Any finding at any severity is a FAIL per WP-085 AC-5. (REG-004 is labelled `warning` in `registry.greps.mjs`; AC-5 escalates it to FAIL.)
- **L2 — DET-007 single-channel semantics:** DET-007 counts warnings only (severity `warning` in `determinism.greps.mjs`). The total must equal `EXPECTED_DET_007 = 4`, and the observed file:line pairs must equal the AC-4 allowlist exactly — no subset, no superset.
- **L3 — DET-001 two-channel semantics:** The script-channel executable count (after the comment-aware filter in `determinism.greps.mjs`) must equal `0`. The orchestrator-channel allowlist verification must match exactly `EXPECTED_DET_001 = 6` doc-comment pairs at the AC-3 allowlist. Composite count = script + orchestrator = 6. Deviation in either channel is a FAIL.
- **L4 — Report format is locked:** Heading with date + commit hash, per-scan sections (Determinism, Monetization, Registry, Engine boundary) each with critical + warning counts, a DET-001 two-channel decomposition section, an AC-3 allowlist-verification section, an AC-4 allowlist reference section, a single `VERDICT: PASS | FAIL` line, the `Vision:` trailer.
- **L5 — Constant naming is locked:** `EXPECTED_DET_001`, `EXPECTED_DET_007`, `EXPECTED_MONETIZATION`, `EXPECTED_REGISTRY`, `EXPECTED_ENGINE_BOUNDARY` — exactly these identifiers, no abbreviation.

---

## 5. Runtime Wiring Allowance (`docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`)

### 01.5 NOT INVOKED

Per `01.5 §When to Include This Clause`, the allowance applies only when a WP:
- Adds a required field to `LegendaryGameState` or another shared type — **ABSENT** (no engine type touched)
- Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators — **ABSENT** (no setup code touched)
- Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests — **ABSENT** (no moves added)
- Adds a new phase hook that alters the expected structural shape of gameplay initialization or test scaffolding — **ABSENT** (no phase hooks added)

All four triggers are absent. **01.5 is NOT INVOKED.**

Per `01.5 §Escalation`:

> This clause **must be invoked in the session prompt.** It may **not** be
> cited retroactively in execution summaries or pre-commit reviews to
> justify undeclared changes.

If an unanticipated structural break appears mid-execution (e.g., TypeScript compiler complains about a package the audit scripts supposedly don't touch, or a test that asserts the shape of `LegendaryGame.moves` suddenly fails), **STOP and escalate**. Do not force-fit the change under a retroactive 01.5 citation.

---

## 6. Scope Lock — Commit A (EC-085 Execution)

### Files Allowed to Change

1. **Create:** `scripts/audit/vision/run-all.mjs`
   - Pure Node ESM orchestrator (Node v22+).
   - `node:` prefix on every built-in import.
   - Dynamically imports `RULES` and `runRules` from each of the four domain grep scripts.
   - Captures audited commit hash once via `git rev-parse HEAD`.
   - Computes today's local date and targets `docs/audits/vision-alignment-{YYYY-MM-DD}.md`.
   - Refuses to overwrite an existing same-day report with a full-sentence error and exit code 1.
   - Prints each domain's `runRules()` output for operator visibility, then performs an independent structured scan to build the report.
   - Applies the DET-001 comment-aware filter via the exported helper from `determinism.greps.mjs` (no duplicate filter logic).
   - Reads each of the six DET-001 allowlist files to verify the referenced line is a doc-comment (`//`, `/*`, or `*` after leading-whitespace trim). Reading these six paths is the **only** permitted I/O against `packages/`.
   - Writes the combined report, logs a final `VERDICT:` line to stdout, exits 0 on PASS and 1 on FAIL.

2. **Modify:** `scripts/audit/vision/determinism.greps.mjs`
   - Add a new exported helper `isDocCommentLine(rawLine)` — pure, no I/O, returns `true` when the line's content portion begins with `//`, `/*`, or `*` after `trimStart`.
   - Inside `runRule()`, after the `git grep` output is split into lines and before printing, filter the result using `isDocCommentLine` **for `rule.id === 'DET-001'` only**.
   - Add the required `// why:` comment on the filter explaining the asymmetry with DET-007 (DET-001 protects an executable determinism invariant; DET-007 protects wall-clock awareness where doc-comment hits carry equal audit meaning).
   - Leave DET-002..007 rule definitions and all other logic untouched.
   - Preserve the existing `// why:` comment on the `git grep` exit-code-1 branch (no-matches semantics).

3. **Create:** `docs/audits/vision-alignment-2026-04-22.md`
   - Generated by running `node scripts/audit/vision/run-all.mjs` once.
   - Must contain: commit hash, per-scan critical+warning counts, AC-3 allowlist verification, AC-4 allowlist reference, DET-001 two-channel decomposition, single `VERDICT:` line, `Vision:` trailer.
   - Do not hand-edit the generated report.

### Files Explicitly Not Allowed to Change

- Any file under `packages/` (engine, registry, preplan, server types — everything)
- Any file under `apps/` (server, arena-client, registry-viewer, replay-producer)
- `scripts/audit/vision/monetization.greps.mjs`
- `scripts/audit/vision/registry.greps.mjs`
- `scripts/audit/vision/engine-boundary.greps.mjs`
- `docs/ai/STATUS.md` (belongs to Commit B)
- `docs/ai/work-packets/WORK_INDEX.md` (belongs to Commit B)
- `docs/ai/DECISIONS.md` (belongs to Commit B)
- Any historical WP, EC, pre-flight, post-mortem, or audit report
- Any other file anywhere in the repo

**Rule:** Anything not explicitly allowed is out of scope. If execution seems to require touching any other file, STOP and escalate — this is exactly the case 01.5 reserves for splitting / clarifying the WP.

---

## 7. Mandatory `// why:` Comments

EC-085 §Required `// why:` Comments locks these two. Both are mandatory.

1. **`determinism.greps.mjs` — comment-aware filter for DET-001.** Explain the asymmetry with DET-007. Must state that DET-001 protects an executable determinism invariant (doc-comment hits are pure documentation), while DET-007 protects wall-clock awareness where doc-comment hits carry equal audit meaning and must remain visible.
2. **`run-all.mjs` — same-day date-collision refusal.** Explain the audit-history immutability principle. Must state that each calendar date carries exactly one verdict, that overwriting would destroy the report's role as an immutable point-in-time record, and that corrective action is a new corrective WP per AC-6, not an in-place overwrite.

Any other non-obvious constant, catch-block swallow, or wall-clock read (e.g., `new Date()` for the local date filename) requires its own `// why:` comment per `00.6-code-style.md` Rule 6.

---

## 8. Non-Negotiable Code Constraints (Engine-Wide + Packet-Specific)

Reproduced here for convenience; WP-085 §Non-Negotiable Constraints is authoritative.

- **Full file contents required** for every new or modified file. No diffs, no snippets.
- ESM only; `node:` prefix on all Node.js built-in imports.
- Every function has a JSDoc comment.
- Full-sentence error messages — what failed and what to check / do.
- No `.reduce()` for multi-step branching logic; use `for...of` with descriptive loop variables.
- No abbreviated names (`cfg`, `e`, `cb`, `fn`, `msg`, etc.). `path` is acceptable as a Node module name.
- Read-only against `packages/` and `apps/`. The only permitted `packages/` I/O is reading the six DET-001 allowlist files.
- No imports from `@legendary-arena/*`, `boardgame.io`, `pg`, `apps/*`, or any engine module.
- No `Math.random()`; no new `new Date()` outside the locally-stamped report filename.
- No modifications to the three other grep scripts.

---

## 9. Determinism & Replay Preservation (Vision §22)

- The orchestrator's output (the written report body) is deterministic for a fixed `git rev-parse HEAD` value and a fixed local date.
- Two runs on the same commit on the same calendar date produce identical report body bytes (modulo the refusal on second run).
- No randomness is introduced at any point. The local-date read is the only wall-clock dependence, and it is sanctioned as the report's date-stamp key per L4.

---

## 10. Verification Steps (Execute Before Marking DoD)

Reproduce WP-085 §Verification Steps 1–10 in order; every step must match the expectation.

```bash
# Step 1 — orchestrator exists
test -f scripts/audit/vision/run-all.mjs
# Expected: exit 0

# Step 2 — comment-aware filter present with the required // why: comment
grep -n "comment-aware\|isDocCommentLine" scripts/audit/vision/determinism.greps.mjs
# Expected: at least one match; a // why: comment explains the DET-007 asymmetry

# Step 3 — orchestrator run on the current working tree
node scripts/audit/vision/run-all.mjs
# Expected: exit 0; stdout ends with "VERDICT: PASS"

# Step 4 — report was written
ls docs/audits/vision-alignment-*.md | head -1
# Expected: a file dated today

# Step 5 — report structure
grep -c "^## " docs/audits/vision-alignment-*.md | head -1
# Expected: ≥ 5

# Step 6a — baseline composite counts match exactly
grep -E "DET-001|DET-007|Monetization|Registry|Engine boundary" \
  docs/audits/vision-alignment-*.md | head -10
# Expected: DET-001 composite = 6, DET-007 = 4, Monetization = 0,
# Registry = 0, Engine boundary = 0

# Step 6b — two-channel DET-001 decomposition observable
grep -E "executable findings.*0|baseline exception" \
  docs/audits/vision-alignment-*.md
# Expected: "DET-001 executable findings ... 0" AND the
# baseline-exception enumeration of six file:line pairs

# Step 7 — Vision trailer
grep "^Vision:" docs/audits/vision-alignment-*.md
# Expected: "Vision: §3, §13, §14, §22, §24"

# Step 8 — same-day re-run refuses
node scripts/audit/vision/run-all.mjs
# Expected: non-zero exit; full-sentence error citing audit-history immutability

# Step 9 — no engine / registry / server / UI files modified
git diff --name-only packages/ apps/
# Expected: no output

# Step 10 — only the three Commit-A files changed
git diff --name-only
# Expected: only files listed in §6 "Files Allowed to Change"
```

---

## 11. Definition of Done

EC-085 §After Completing + WP-085 §Definition of Done together form the DoD. Every item below must be true before marking the packet complete.

- [ ] All ten verification commands in §10 pass
- [ ] All acceptance criteria AC-1 through AC-10 pass
- [ ] `scripts/audit/vision/run-all.mjs` exists and is read-only against `packages/` and `apps/` beyond the six DET-001 allowlist reads
- [ ] `scripts/audit/vision/determinism.greps.mjs` has `isDocCommentLine` exported and applied to DET-001 with the required `// why:` comment
- [ ] `docs/audits/vision-alignment-2026-04-22.md` exists with the locked report structure, `VERDICT: PASS`, and `Vision: §3, §13, §14, §22, §24` trailer
- [ ] Baseline matches bit-for-bit (composite 6 DET-001 / 4 DET-007 / 0 / 0 / 0)
- [ ] Same-day re-run refuses to overwrite (exit non-zero)
- [ ] `git diff --name-only packages/ apps/` is empty
- [ ] `git diff --name-only` (plus untracked) shows only the three Commit-A files (the pre-existing `.claude/worktrees/` untracked directory is session infra, not part of the WP)
- [ ] No engine, registry, server, or UI test count changes
- [ ] No tests added to `packages/` or `apps/`

**STATUS.md / WORK_INDEX.md / DECISIONS.md updates are deferred to a separate Commit B SPEC session. Do not modify them under Commit A.**

---

## 12. Commit Discipline

Per `docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md`:

- Commit message subject: `EC-085: ship vision alignment audit orchestrator and first report` (or equivalent; `EC-085:` prefix is mandatory)
- Commit body must include the Vision trailer line: `Vision: §3, §13, §14, §22, §24`
- Do not use `WP-085:` as a prefix — `.githooks/commit-msg` rejects that form per P6-36 precedent
- Do not bundle Commit B governance changes (STATUS.md / WORK_INDEX.md / DECISIONS.md) into Commit A

Only create the commit when the user explicitly requests it.

---

## 13. Escalation

If any of the following occur during execution, **STOP immediately and report**:

- Any verification step (§10) returns an unexpected result
- The baseline does not reproduce at 6 / 4 / 0 / 0 / 0 exactly
- The same-day refusal does not fire on second invocation
- A DET-001 executable hit appears — **do not fix it**, classify it per AC-6 and escalate to a new corrective WP
- A DET-007 allowlist mismatch appears (missing or extra file:line pair)
- Any file outside `§6 Files Allowed to Change` would need to be modified to complete the task
- The pre-flight's locked decisions (L1–L5) would need to be revisited
- A structural runtime-wiring change would be required (01.5 is NOT INVOKED; a real 01.5 need indicates mis-scoped WP)

Per `01.5 §Final Note`: when in doubt, escalation is always correct.

---

## 14. Post-Execution

After all DoD items are true:

- Produce an execution summary listing the three files written, the verdict, and explicit confirmation that `git diff packages/ apps/` is empty
- Run the WP-085 §Post-WP-085 Follow-ups reminder: the `feedback_audit_tooling_scaffold_first.md` memory correction (WP-042 → WP-085) is a separate SPEC follow-up, not part of Commit A
- Post-mortem (`docs/ai/REFERENCE/01.6-post-mortem-checklist.md`) is mandatory for this WP (new long-lived abstraction — the audit orchestrator and its locked baseline contract)
- After the post-mortem, Commit A is complete and Commit B (SPEC governance close) may proceed in a separate session

---

## 15. Final Instruction

Execute exactly what this prompt specifies. Do not add, remove, or reinterpret scope. If any step reveals that the specification is wrong, STOP and escalate — do not force-fit.

The audit exists to detect silent drift. Do not let this execution introduce any.
