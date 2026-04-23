# Session Prompt — WP-041 System Architecture Definition & Authority Model

**Work Packet:** [docs/ai/work-packets/WP-041-system-architecture-definition-authority-model.md](../work-packets/WP-041-system-architecture-definition-authority-model.md)
**Execution Checklist:** [docs/ai/execution-checklists/EC-041-architecture-audit.checklist.md](../execution-checklists/EC-041-architecture-audit.checklist.md)
**Pre-Flight (READY TO EXECUTE, conditional on PS-1/PS-2 — now resolved):** [docs/ai/invocations/preflight-wp041-system-architecture-audit.md](preflight-wp041-system-architecture-audit.md)
**Copilot Check (CONFIRM):** [docs/ai/invocations/copilot-wp041-system-architecture-audit.md](copilot-wp041-system-architecture-audit.md)
**Session Context:** NONE — `session-context-wp041.md` was never generated (lineage jumped WP-040 → WP-042). The session-context lineage gap is a governance finding, logged below under Mandatory Session-Finalization Actions.
**Commit prefix:** `EC-041:` on content commit; `SPEC:` on pre-flight bundle and governance close commits; `WP-041:` is **forbidden** (commit-msg hook rejects per **P6-36**).
**Pre-flight verdict:** READY TO EXECUTE — PS-1 (EC count → 20 with `selection` at #1) and PS-2 (Assumes range → D-4004) applied before this prompt was generated; PS-3 and PS-4 are encoded **in this prompt** as session-authoring guardrails (see §Locked Values).
**WP Class:** Contract-Only / Documentation — pure documentation certification pass. Zero types. Zero `G` touch. Zero moves, phases, or hooks. Zero runtime logic. Zero new tests. Zero engine or apps file touch.
**Primary layer:** Core Architecture / Documentation / Authority Boundaries — `docs/ai/ARCHITECTURE.md` is the subject of certification; `docs/ai/DECISIONS.md` is the audit-log sink.

---

## Pre-Session Gates (Resolve Before Writing Any File)

1. **Commit-prefix confirmation.** `EC-041:` on content commit; `SPEC:` on pre-flight bundle and governance close. If anyone insists on `WP-041:`, STOP — the commit-msg hook rejects it per **P6-36**.

2. **Pre-flight bundle commit (Commit A0).** The pre-flight bundle (this prompt + preflight + copilot check + the PS-1/PS-2 corrections to WP-041 and EC-041) must land as the **first** commit of this session. Subject:

   `SPEC: WP-041 pre-flight bundle — preflight, copilot check, PS-1/PS-2 corrections (field count → 20, Assumes range → D-4004)`

3. **Working-tree hygiene at session start.** At the moment of session opening, `git status --short` should show exactly these files (the PS-1/PS-2 edits to WP-041 and EC-041 are already uncommitted from the pre-flight authoring session):

   - ` M docs/ai/work-packets/WP-041-system-architecture-definition-authority-model.md` — PS-1/PS-2 corrections (belongs to Commit A0)
   - ` M docs/ai/execution-checklists/EC-041-architecture-audit.checklist.md` — PS-1 correction (belongs to Commit A0)
   - `?? docs/ai/invocations/preflight-wp041-system-architecture-audit.md` — preflight (belongs to Commit A0)
   - `?? docs/ai/invocations/copilot-wp041-system-architecture-audit.md` — copilot check (belongs to Commit A0)
   - `?? docs/ai/invocations/session-wp041-architecture-audit.md` — this prompt (belongs to Commit A0)
   - `?? .claude/worktrees/` — inherited; do **NOT** stage

   **CRITICAL:** Stage-by-exact-filename per **P6-27 / P6-44**. `git add .`, `git add -A`, and `git add -u` are **forbidden** — they would sweep `.claude/worktrees/` into the commit.

4. **Upstream dependency green at session base commit.** Run `pnpm --filter @legendary-arena/game-engine test`. Expected engine baseline: **444 passing / 110 suites / 0 failing** (baseline recorded at WP-040 pre-flight v2, 2026-04-23). Also run `pnpm -r test` — expected **596 passing / 0 failing**. Record the current numbers in `docs/ai/STATUS.md` at Commit B (if the repo has advanced, use the current numbers; do not edit this prompt).

5. **Engine / apps untouched pre-check.** `git diff --name-only packages/ apps/` must return empty before, during, and after this session. This is invariant #1 of the scope lock — a violation is immediate session halt, not a negotiable item.

6. **DECISIONS.md tail re-verification (PS-2 self-correcting clause).** Run `grep "^### D-" docs/ai/DECISIONS.md | tail -1`. Expected tail: **`D-4004`**. If newer decisions have landed between pre-flight authoring and session execution, update WP-041 Assumes line 59 to the new tail as a PS-2b amendment (a minor transcription correction, not a scope change — safe to land in Commit A0).

7. **Authority-chain re-read confirmation.** Before writing any change to ARCHITECTURE.md, the executor must re-read in order:

   - [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode, commit hygiene, permission flow
   - [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — **the subject of certification**; read end-to-end (1500+ lines) before any edit
   - [docs/01-VISION.md](../../01-VISION.md) — authority position being locked in §B
   - [.claude/rules/architecture.md](../../../.claude/rules/architecture.md), [.claude/rules/code-style.md](../../../.claude/rules/code-style.md), [.claude/rules/work-packets.md](../../../.claude/rules/work-packets.md) — the four rules files whose cross-references to ARCHITECTURE.md are being verified
   - [docs/ai/DECISIONS.md](../DECISIONS.md) — D-0001 through D-4004; consistency audit scope
   - [packages/game-engine/src/types.ts §LegendaryGameState at line 375](../../../packages/game-engine/src/types.ts) — ground truth for the 20 Class-1 Runtime fields (no memory; re-read the source of truth each time)

If any gate is unresolved, STOP.

---

## Runtime Wiring Allowance (01.5) — NOT INVOKED

Per [docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md §When to Include This Clause](../REFERENCE/01.5-runtime-wiring-allowance.md). WP-041 is pure documentation — the four 01.5 trigger criteria are enumerated below and marked absent:

| 01.5 Trigger Criterion | Applies to WP-041? | Justification |
|---|---|---|
| Adds a required field to `LegendaryGameState` or another shared type | **No** | Zero type changes. Zero `packages/` touch. The WP audits existing types; it does not introduce or modify them. |
| Changes the shape of a return type produced by `buildInitialGameState` or similar setup orchestrators | **No** | No engine modification. |
| Adds a new move to `LegendaryGame.moves` that affects structural assertions in existing tests | **No** | No move added. |
| Adds a new phase hook that alters the expected structural shape of gameplay initialization | **No** | No phase hook added. |

**Conclusion:** 01.5 is **NOT INVOKED**. The scope lock applies without the allowance. Any file beyond the Commit A0 / Commit A / Commit B allowlist in §Locked Values §Commit topology is a scope violation per **P6-27**, not a minor additive deviation — escalate to a pre-flight amendment rather than shipping it.

Per 01.5 §Escalation: *"It may not be cited retroactively in execution summaries or pre-commit reviews to justify undeclared changes."* If an unanticipated structural break appears mid-execution, STOP and escalate.

---

## Copilot Check (01.7) — COMPLETED, VERDICT: CONFIRM (after PS-1/PS-2 re-pass)

See [copilot-wp041-system-architecture-audit.md](copilot-wp041-system-architecture-audit.md) for the full 30-issue scan. Overall Judgment: **PASS** — 28 PASS, 2 residual scope-neutral RISKs carried into this prompt as guardrails (Issue 24/26 Class-column clarifying sentence, Issue 23 ordering discipline), 0 BLOCK. Disposition **CONFIRM** after PS-1 (EC count → 20) and PS-2 (Assumes range → D-4004) landed. The two residual RISKs are addressed by **PS-3** and **PS-4** in §Locked Values below. Session prompt generation authorized.

---

## Vision Sanity Check (01.4 §Vision Sanity Check)

Clause titles verified against [docs/01-VISION.md](../../01-VISION.md) headers:

- **Vision clauses touched by this WP:** §7 (Integrity & Fairness baseline), §8 (Replay Fidelity), §13 (Execution Checklist-Driven Development), §14 (Explicit Decisions, No Silent Drift), §15 (Vision Authority Chain).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.` WP-041 **strengthens** §15 by locking `01-VISION.md`'s position in the authority chain explicitly (between `ARCHITECTURE.md` and `.claude/rules`); it strengthens §14 by requiring every correction to cite the originating WP or Decision.
- **Non-Goal proximity:** `N/A — WP touches no monetization or competitive surface.` Documentation-only.
- **Determinism preservation:** `N/A — WP touches no determinism-bearing surface.` No RNG, no scoring, no replay code. The Field Classification audit verifies (does not modify) the 20 G-class Runtime fields that carry determinism.
- **WP `## Vision Alignment` section status:** Present in WP-041 post-tightening (lines 181-201). Clauses cited by number; form verified.

---

## Authority Chain (Read in Order Before Writing)

1. [.claude/CLAUDE.md](../../../.claude/CLAUDE.md) — EC-mode rules; commit discipline; permission flow
2. [.claude/rules/architecture.md](../../../.claude/rules/architecture.md) — Layer Boundary enforcement (the text whose conformity to ARCHITECTURE.md is being audited)
3. [.claude/rules/code-style.md](../../../.claude/rules/code-style.md) — doc-prose style baseline
4. [.claude/rules/work-packets.md](../../../.claude/rules/work-packets.md) — one-packet-per-session discipline; WORK_INDEX enforcement
5. [docs/01-VISION.md](../../01-VISION.md) — §7, §8, §13, §14, §15; position in authority chain being locked
6. [docs/ai/ARCHITECTURE.md](../ARCHITECTURE.md) — **the subject of certification**; read Sections 1-5, MVP Gameplay Invariants, Layer Boundary, High-Level System Diagram in full before any edit
7. [docs/ai/REFERENCE/02-CODE-CATEGORIES.md](../REFERENCE/02-CODE-CATEGORIES.md) — directory/layer registry; cross-reference discipline
8. [docs/ai/execution-checklists/EC-041-architecture-audit.checklist.md](../execution-checklists/EC-041-architecture-audit.checklist.md) — authoritative acceptance contract (post-PS-1)
9. [docs/ai/work-packets/WP-041-system-architecture-definition-authority-model.md](../work-packets/WP-041-system-architecture-definition-authority-model.md) — WP specification (post-PS-1/PS-2)
10. [docs/ai/DECISIONS.md](../DECISIONS.md) — D-0001 through D-4004; consistency-audit scope
11. [packages/game-engine/src/types.ts §LegendaryGameState at line 375](../../../packages/game-engine/src/types.ts) — ground truth for the 20 Class-1 Runtime fields
12. [packages/game-engine/src/versioning/versioning.check.ts at line 29](../../../packages/game-engine/src/versioning/versioning.check.ts) — ground truth for `EngineVersion = {1,0,0}`, authoritative source for the `Architecture Version: 1.0.0` stamp

If any of these conflict, higher-authority documents win.

---

## Goal (Binary)

After this session:

1. **`docs/ai/ARCHITECTURE.md` carries a version stamp** at the very top of the document (immediately after the `# Legendary Arena — System Architecture` H1 and its blockquote, before the first `---`). Exact format — deviation in whitespace, punctuation, or case **FAILS**:

   ```
   Architecture Version: 1.0.0
   Last Reviewed: 2026-04-23
   Verified Against: WP-001 through WP-040
   ```

2. **The existing Document override hierarchy block at [ARCHITECTURE.md:8-16](../ARCHITECTURE.md) is UPDATED** (not duplicated — PS-3 guardrail below) to match the current authority chain. The seven-entry chain must appear verbatim:

   ```
   1. .claude/CLAUDE.md
   2. docs/ai/ARCHITECTURE.md (this file)
   3. docs/01-VISION.md
   4. .claude/rules/*.md
   5. docs/ai/work-packets/WORK_INDEX.md
   6. Individual Work Packets (WP-*)
   7. Active conversation context
   ```

   Plus one-sentence relationships: (a) ARCHITECTURE.md wins on conflict with `.claude/rules/*.md`; (b) DECISIONS.md records rationale, ARCHITECTURE.md encodes the result.

3. **Field Classification Reference table at [ARCHITECTURE.md:620-653](../ARCHITECTURE.md) contains all 20 G-class Runtime fields** enumerated in EC-041 §Locked Values §Field Classification. `selection` (WP-005B) already present at line 636; the executor **verifies** its presence and adds any of the remaining 19 that turn out to be missing. (Based on pre-flight Finding 1, all 20 are already present — this is a verify-and-confirm step, not an add step.)

4. **A single clarifying sentence** is inserted **above** the Field Classification Reference table body (after the paragraph at [ARCHITECTURE.md:619](../ARCHITECTURE.md) that introduces the table, before the `| Field / Object | Class | Notes |` header row). Exact text (copy verbatim — PS-3 guardrail):

   > The Class column indicates the authoritative class first; annotations like "Snapshot (as copy)" or "Snapshot → count only" describe how a runtime value may appear in a snapshot without changing the field's own class. All 20 G-class Runtime fields remain Class 1 (Runtime) regardless of snapshot-handling annotation.

5. **`docs/ai/DECISIONS.md` carries audit findings** landed in Commit A. The permitted entry types are **exactly three** (EC-041 §Files to Produce):
   - `Architecture Audit Finding` — contradictions or gaps requiring correction, with citations
   - `Resolved Transcription Inconsistency` — wording / numbering / cross-reference errors corrected during audit
   - `Rules-Architecture Drift Log` — drift between `.claude/rules/*.md` and ARCHITECTURE.md, logged for a future rules-correction pass
   - **Forbidden:** trivial no-change confirmations. If a section of ARCHITECTURE.md passes audit without change, do **not** log it.

6. **`docs/ai/post-mortems/01.6-WP-041-architecture-audit.md` exists** with the canonical 10-section 01.6 coverage per [docs/ai/REFERENCE/01.6-post-mortem-checklist.md](../REFERENCE/01.6-post-mortem-checklist.md). Verdict: **WP COMPLETE**.

7. **No engine or apps file touched.** `git diff --name-only packages/ apps/` returns empty at Commit A and Commit B.

8. **No `.claude/rules/*.md` file touched.** `git diff --name-only .claude/rules/` returns empty. Rules drift discovered during audit is logged under entry type `Rules-Architecture Drift Log`, not fixed.

9. **Engine baseline unchanged:** 444 passing / 110 suites / 0 failing (re-record in STATUS.md).

10. **Repo-wide baseline unchanged:** 596 passing / 0 failing.

11. **`docs/ai/STATUS.md` updated at Commit B** with architecture-formally-reviewed-and-versioned entry.

12. **`docs/ai/work-packets/WORK_INDEX.md` updated at Commit B** with WP-041 checked off, date 2026-04-23 (or current execution date).

No registry changes. No server changes. No client changes. No new tests. No new `.claude/rules/*.md` entries. No new decisions (only audit-finding records). No new invariants. No new layers. No new boundaries.

---

## Locked Values (Do Not Re-Derive)

### Commit topology (three commits)

- **Commit A0 (`SPEC:`)** — pre-flight bundle. Stages the preflight, copilot check, this session prompt, and the PS-1/PS-2 corrections already uncommitted in WP-041 and EC-041. **Subject:**

  `SPEC: WP-041 pre-flight bundle — preflight, copilot check, PS-1/PS-2 corrections (field count → 20, Assumes range → D-4004)`

- **Commit A (`EC-041:`)** — content: `ARCHITECTURE.md` (version stamp + authority model update + clarifying sentence + any missing Field Classification rows) + `DECISIONS.md` (audit-finding entries, if any) + post-mortem. **Subject:**

  `EC-041: certify architecture — version stamp, authority model, field classification completeness`

  Commit body must include a `Vision: §7, §8, §13, §14, §15` trailer per [docs/ai/REFERENCE/01.3-commit-hygiene-under-ec-mode.md §Vision Trailer](../REFERENCE/01.3-commit-hygiene-under-ec-mode.md).

- **Commit B (`SPEC:`)** — governance close: `STATUS.md` + `WORK_INDEX.md` + `EC_INDEX.md` + back-pointer DECISIONS.md entries (if any audit findings warrant them). **Subject:**

  `SPEC: close WP-041 / EC-041 — architecture certification pass`

  Commit body repeats the `Vision:` trailer.

### Architecture version stamp (verbatim — deviation FAILS)

Immediately after the ARCHITECTURE.md H1 and its blockquote-authored override hierarchy block, before the first `---`:

```
Architecture Version: 1.0.0
Last Reviewed: 2026-04-23
Verified Against: WP-001 through WP-040
```

Rationale for each field:
- `1.0.0` matches [CURRENT_ENGINE_VERSION_VALUE at versioning.check.ts:29](../../../packages/game-engine/src/versioning/versioning.check.ts) — architecture and engine versions are intentionally synchronized at v1.0.0.
- `Last Reviewed: 2026-04-23` — execution date; update if the session runs on a later date.
- `Verified Against: WP-001 through WP-040` — the certification scope. Do **not** expand this range to WP-041+ (the WP cannot certify itself) or to a later WP (out of scope).

### Authority hierarchy (verbatim — from EC-041 §Locked Values §Authority Hierarchy — deviation FAILS)

```
CLAUDE.md
ARCHITECTURE.md
01-VISION.md
.claude/rules/*.md
WORK_INDEX.md
Work Packets (WP-*)
Conversation / Chat
```

`01-VISION.md` position is locked between `ARCHITECTURE.md` and `.claude/rules/*.md`. This is the single authoritative statement of the chain — do **not** reorder or re-derive the chain elsewhere in ARCHITECTURE.md.

### Field Classification — 20 Class-1 Runtime G fields (verbatim from EC-041 §Locked Values §Field Classification — deviation FAILS)

The table at [ARCHITECTURE.md:620-653](../ARCHITECTURE.md) must contain rows for exactly these 20 fields (all Class 1 — Runtime):

1. `selection` — WP-005B
2. `playerZones` — WP-006A
3. `piles` — WP-006B
4. `villainDeck` — WP-014
5. `villainDeckCardTypes` — WP-014
6. `hookRegistry` — WP-009B
7. `currentStage` — WP-007B
8. `lobby` — WP-011
9. `messages` — WP-009B
10. `counters` — WP-010
11. `city` — WP-015
12. `hq` — WP-015
13. `ko` — WP-017
14. `attachedBystanders` — WP-017
15. `turnEconomy` — WP-018
16. `cardStats` — WP-018
17. `mastermind` — WP-019
18. `heroAbilityHooks` — WP-021
19. `cardKeywords` — WP-025
20. `schemeSetupInstructions` — WP-026

Each field's name must match [LegendaryGameState at types.ts:375](../../../packages/game-engine/src/types.ts) verbatim (letter-case, no abbreviation). The `Class` column value for each is `Runtime` — if the existing table shows `Snapshot (as copy)` or `Snapshot → count only`, **do not change that annotation**; the clarifying sentence added per Goal §4 reconciles the column semantics.

**Out of scope:** `matchConfiguration` (Class 2 — Configuration; outside Class-1 count) and `activeScoringConfig` (WP-067 — outside verification scope). Do not add or modify their rows.

### PS-3 guardrails (session-authoring discipline, from pre-flight §8 and copilot check §Mandatory Governance Follow-ups)

Three behavioral rules the executor must honor during Commit A content edits:

- **PS-3a.** The Document override hierarchy block at [ARCHITECTURE.md:8-16](../ARCHITECTURE.md) is an **UPDATE**, not an ADD. Do **not** duplicate the block. Modify the existing text in place to match the seven-entry chain in §Locked Values §Authority hierarchy above. The pre-WP-041 block names `00.1-master-coordination-prompt.md` as #1 — that entry is superseded and removed; `00.1` remains a reference document but is not in the authority chain.

- **PS-3b.** The Class-column clarifying sentence (Goal §4) is a **single sentence inserted above the Field Classification Reference table body**. Do **not** restructure the table into separate "Authoritative Class" and "Snapshot Handling" columns (option (a) from pre-flight Finding 4 is rejected; only option (b) is in scope). Do **not** edit the existing Class-column values for `G.counters`, `G.messages`, `G.playerZones[*].*`, or any other field — the annotations describe snapshot handling, not class reassignment.

- **PS-3c.** `activeScoringConfig` (WP-067) is **out of scope** and must not appear in the Field Classification table rows added or modified by this packet. If it already exists in ARCHITECTURE.md (it does not, per pre-flight §3), it would remain unchanged. A later audit packet scoped to WP-041+ will close the WP-067 entry.

### PS-4 guardrail (canonical ordering for future audits)

The EC-041 Locked Values list order (with `selection` at position #1, followed by `playerZones` → `piles` → `villainDeck` → `villainDeckCardTypes` → `hookRegistry` → `currentStage` → `lobby` → `messages` → `counters` → …) is the **canonical ordering for all future Field Classification audits**. Future certification packets must preserve this ordering when adding fields: new fields land at the **bottom** of the list (append), not inserted by introduction date. This makes EC diffs auditable over time.

The ordering itself is not introduction-order by WP ID — it is the order established at WP-041 certification time, with `selection` added at the top per PS-1. Future maintainers reading the EC will see: position #1 = earliest-introduced field, positions #2+ = audit-order preserved from the original WP-041 drafting. This is a **locked precedent**, not a re-derivation rule.

### Audit entry format for DECISIONS.md (verbatim — deviation FAILS)

Each audit-finding entry in DECISIONS.md must use one of the three permitted types and follow this shape:

```markdown
### D-41XX — <short title>

**Type:** Architecture Audit Finding | Resolved Transcription Inconsistency | Rules-Architecture Drift Log
**Packet:** WP-041
**Date:** 2026-04-23

**Finding:** <one sentence stating what was wrong or what drifted>

**Resolution:** <one sentence stating what was changed, cited to the WP or DECISION that established the correct version; for Rules-Architecture Drift Log entries, state "Logged for future rules-correction pass; no fix applied in this packet.">

**Citation:** <file:line reference or WP/D-ID>
```

D-IDs for WP-041 audit findings start at **D-4101** and increment sequentially. Each entry also lands a one-row addition to `docs/ai/DECISIONS_INDEX.md` per **P6-51** form (2).

---

## Step Plan (Numbered — Follow in Order)

1. **Read.** Re-read the seven Authority Chain documents in order. Do not trust memory — read each file from the filesystem in this session.

2. **Inventory.** Grep the Field Classification Reference table at [ARCHITECTURE.md:620-653](../ARCHITECTURE.md) to confirm all 20 locked-value fields are already present. Pre-flight §3 confirmed they are. If any is missing, add a row in the same style as the existing rows; if all 20 are present, this step is a **verify-and-confirm** no-op and is logged as passing without any DECISIONS.md entry (trivial no-change confirmations are forbidden per Goal §5).

3. **Update override hierarchy block** (per PS-3a) at [ARCHITECTURE.md:8-16](../ARCHITECTURE.md) — replace the four-entry block with the seven-entry chain in §Locked Values §Authority hierarchy. Add the two one-sentence relationship statements (ARCHITECTURE ↔ rules; ARCHITECTURE ↔ DECISIONS).

4. **Insert clarifying sentence** (per PS-3b) above the Field Classification Reference table body.

5. **Add version stamp** immediately after the ARCHITECTURE.md H1 + blockquote block (now updated per step 3), before the first `---`.

6. **Consistency audit** — walk every section of ARCHITECTURE.md:
   - Sections 1-5 against the code deliverables and DECISIONS.md D-0001 through D-4004
   - MVP Gameplay Invariants against WP-010 through WP-026 scope
   - Layer Boundary against `.claude/rules/architecture.md` (log drift under `Rules-Architecture Drift Log`, do **not** edit rules)
   - Every DECISIONS.md cross-reference verified

   Log **material findings only** under the three permitted entry types. If a section passes clean, do not log.

7. **Write the post-mortem** at `docs/ai/post-mortems/01.6-WP-041-architecture-audit.md` per [01.6 template](../REFERENCE/01.6-post-mortem-checklist.md). Verdict: **WP COMPLETE**. Cover: What landed, what was verified, what was logged, what drift was discovered, what was deferred. Include an explicit entry for the **session-context lineage gap** (no `session-context-wp041.md` exists — see Mandatory Session-Finalization Actions below).

8. **Stage Commit A** — exact filenames: `docs/ai/ARCHITECTURE.md`, `docs/ai/DECISIONS.md` (if any audit entries), `docs/ai/post-mortems/01.6-WP-041-architecture-audit.md`, `docs/ai/DECISIONS_INDEX.md` (if any D-entries added). Subject per §Commit topology.

9. **Stage Commit B** — `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`. Subject per §Commit topology.

10. **Pre-commit review** — run [docs/ai/prompts/PRE-COMMIT-REVIEW.template.md](../prompts/PRE-COMMIT-REVIEW.template.md) against the staged commits before pushing. Verdict: **Safe to commit as-is**. Any `Minor nit` items are noted but not blocking.

---

## Verification Steps (Run Before Claiming Done)

From `docs/ai/work-packets/WP-041-…md §Verification Steps`, with the regex updated for the 20-field scope:

```pwsh
# Step 1 — confirm Field Classification table has all 20 fields
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "selection|playerZones|piles|villainDeck|villainDeckCardTypes|hookRegistry|currentStage|lobby|messages|counters|city|hq|ko|attachedBystanders|turnEconomy|cardStats|mastermind|heroAbilityHooks|cardKeywords|schemeSetupInstructions"
# Expected: at least 20 matches

# Step 2 — confirm version stamp
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "Architecture Version: 1\.0\.0"
# Expected: 1 match (exact format)

# Step 3 — confirm updated authority hierarchy
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "CLAUDE\.md" -Context 0,6 | Select-Object -First 10
# Expected: chain appears with CLAUDE.md → ARCHITECTURE.md → 01-VISION.md → .claude/rules → WORK_INDEX → WPs → conversation

# Step 4 — confirm clarifying sentence above Field Classification table
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "authoritative class first"
# Expected: 1 match

# Step 5 — confirm no engine files modified
git diff --name-only packages/ apps/
# Expected: no output

# Step 6 — confirm no rules files modified
git diff --name-only .claude/rules/
# Expected: no output

# Step 7 — confirm no files outside scope
git diff --name-only main.. -- . ':!docs/ai/ARCHITECTURE.md' ':!docs/ai/DECISIONS.md' ':!docs/ai/DECISIONS_INDEX.md' ':!docs/ai/STATUS.md' ':!docs/ai/work-packets/WORK_INDEX.md' ':!docs/ai/execution-checklists/EC_INDEX.md' ':!docs/ai/post-mortems/01.6-WP-041-architecture-audit.md' ':!docs/ai/invocations/preflight-wp041-system-architecture-audit.md' ':!docs/ai/invocations/copilot-wp041-system-architecture-audit.md' ':!docs/ai/invocations/session-wp041-architecture-audit.md' ':!docs/ai/work-packets/WP-041-system-architecture-definition-authority-model.md' ':!docs/ai/execution-checklists/EC-041-architecture-audit.checklist.md'
# Expected: no output

# Step 8 — confirm engine test baseline
pnpm --filter @legendary-arena/game-engine test
# Expected: 444 passing / 110 suites / 0 failing (or current baseline)

# Step 9 — confirm repo-wide baseline
pnpm -r test
# Expected: 596 passing / 0 failing (or current baseline)
```

All nine steps must return expected output before the session may claim **WP COMPLETE**.

---

## Mandatory Session-Finalization Actions

After Commit B lands but before the session closes:

1. **Generate `session-context-wp041.md`** — the session-context lineage jumped WP-040 → WP-042 (no WP-041 context file was ever created). Per [01.4 Step 8 Session Context Template](../REFERENCE/01.4-pre-flight-invocation.md), a retroactive session-context file should be authored covering this WP-041 certification pass, even though the WP has already executed. Save to `docs/ai/session-context/session-context-wp041.md`. Include it in a follow-up SPEC commit (not Commit A, not Commit B — a separate Commit C if warranted, or fold into Commit B if token budget allows).

2. **Lessons learned** — per [01.4 Step 7 Lessons Learned Template](../REFERENCE/01.4-pre-flight-invocation.md). Capture:
   - Pattern: a certification packet catches governance drift in its own specification (EC-041 "Exactly 19" vs. actual 20) — the loop works. Log as a new **precedent** (P7-0X series?), describing how the pre-flight + copilot check combo caught PS-1/PS-2 before execution.
   - Anti-pattern: documentation packets can drift silently for a long time without external signals — `G.selection` was correct in ARCHITECTURE.md since WP-005B, but the EC authored in Phase 7 undercounted because it enumerated fields from memory instead of re-reading `LegendaryGameState`. The lesson applies to every future audit WP: **re-read source of truth, never enumerate from the prior WP's scope section.**

3. **STATUS.md entry** — one line: "WP-041 complete; architecture formally reviewed and versioned at 1.0.0 (2026-04-23); 20 G-class Runtime fields certified in Field Classification Reference; authority chain locks `01-VISION.md` between ARCHITECTURE.md and .claude/rules."

4. **WORK_INDEX.md entry** — check off WP-041 with 2026-04-23.

---

## Final Instruction

This WP is a **certification pass, not a change pass**. The phrase appears in WP-041 §Session Context for a reason: the executing agent must resist every temptation to "clean up while here" — no removed sections, no weakened constraints, no speculative additions, no `while I'm here` refactors.

Every correction must cite either a WP or a DECISION. Every logged entry must use one of the three permitted DECISIONS.md entry types. Every edit to ARCHITECTURE.md must trace to WP-005B..WP-040 scope.

If at any point the executor feels uncertain about whether an edit is in scope, STOP — re-read the pre-flight §4 Scope Lock, re-read this prompt's §Locked Values, and if still uncertain, escalate rather than proceed.

**This WP closes at `WP COMPLETE` verdict — not `WP COMPLETE (with minor deviations)`.** A Phase-7 governance packet has zero tolerance for deviation drift.
