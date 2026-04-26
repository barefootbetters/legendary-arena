# WP-098 — Funding Surface Gate Trigger (00.3 §20)

**Status:** Draft (drafted 2026-04-26; lint-gate self-review PASS; pre-flight pending; **blocked on WP-097 execution** — D-9701 must exist in `docs/ai/DECISIONS.md` before §20 can cite it).
**Primary Layer:** Governance / Policy (docs-only; lint-gate enforcement)
**Dependencies:** **Hard dep on WP-097** (D-9701 must land first; §20 cites D-9701 + the WP-097 §F G-1..G-7 gate items as the canonical authority). No code deps.

---

## Session Context

WP-097 §F established the Funding Surface Gate (G-1..G-7) as the
locked checklist any future UI WP touching §A / §B / §C funding
surfaces must satisfy before merging. WP-097 §F "Audit discipline"
states that silent omission of the gate is *"a §17 lint FAIL by
analogy with the Vision Alignment trigger"* — but the trigger itself
does not yet exist in `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`.
Today the §F enforcement is self-described in the WP rather than
auto-applied by the lint gate. WP-098 closes that gap.

WP-098 adds a new §20 "Funding Surface Gate Trigger" to 00.3 that
mirrors the §17 Vision Alignment trigger pattern — §20.1 trigger
conditions, §20.2 required content, §20.3 what §20 doesn't do — and
extends the Final Gate table with the corresponding fail conditions.
The new section cites WP-097 §F as the single source of truth for the
gate items; it does not duplicate G-1..G-7.

A new decision `D-9801` anchors §20 itself. It is a separate decision
from `D-9701` (which anchors the funding policy contract): D-9701 is
*"what the policy is"*; D-9801 is *"how the lint gate enforces it."*

---

## Goal

After this session, every Work Packet that touches a funding-related
UI surface is **automatically required** to include a
`## Funding Surface Gate` block (or fold the gate into its
`## Vision Alignment` block) at lint-gate time, with G-1..G-7
disposition mapping per WP-097 §F. Specifically:

- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` contains a new
  `## §20 — Funding Surface Gate Trigger` section, structurally
  parallel to §17 Vision Alignment.
- The `## Final Gate` table in 00.3 has new rows enumerating the
  §20 fail conditions.
- `D-9801` in `docs/ai/DECISIONS.md` anchors §20 with explicit
  reference to D-9701 and WP-097 §F as the policy source.
- Future WPs touching §20.1 trigger surfaces are blocked at lint time
  unless they declare applicability and map G-N dispositions.

---

## Assumes

- **WP-097 has executed.** Specifically:
  - `docs/ai/DECISIONS.md` contains a `## D-9701` entry (verified by
    `grep -n "^## D-9701" docs/ai/DECISIONS.md` returning exactly one
    match)
  - `docs/TOURNAMENT-FUNDING.md` contains the `## Scope`, Cost Baseline,
    Public Blurb, and Vision-citation reconciliations from WP-097
    Scope §A
  - WP-097 §F (G-1..G-7 + Audit discipline + No silent exceptions
    sub-blocks) is intact in `docs/ai/work-packets/WP-097-tournament-funding-policy.md`

- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` exists with §17,
  §18, §19, and the Final Gate table in their current form. No
  conflicting prior §20 entry.
- `docs/ai/STATUS.md` and `docs/ai/work-packets/WORK_INDEX.md` exist.
- `docs/ai/DECISIONS.md` highest current ID is `D-9701` (D-9801 not
  yet present).

If any of the above is false — most importantly if WP-097 has not
executed and D-9701 does not exist — this packet is **BLOCKED** and
must not proceed. Executing WP-098 against a phantom D-9701 would
mint a §20 that cites a nonexistent decision.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/work-packets/WP-097-tournament-funding-policy.md §F` —
  the canonical Funding Surface Gate. §20 cites this section by ID
  (G-1..G-7) and MUST NOT duplicate or paraphrase the gate items.
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17` —
  the structural template §20 mirrors. Read §17.1 (trigger
  conditions), §17.2 (required content), §17.3 (what §17 does not
  do), and the §17-related Final Gate rows (#29-32) to see how the
  trigger / content / fail-condition pattern is wired.
- `docs/ai/ARCHITECTURE.md "Document override hierarchy"` —
  ARCHITECTURE is authority #2; VISION authority #3; rules #4;
  WORK_INDEX #5; WPs #6. WP-098 modifies a peer-authority document
  (00.3) — confirm scope-respect by reading the hierarchy.
- `docs/ai/DECISIONS.md` — scan recent governance entries (D-9701,
  D-9601, D-9301) for format conventions; confirm D-9801 is the
  next available ID for a non-WP-numbered governance decision (D-98xx
  range is conventionally reserved for WP-098-anchored decisions).
- `.claude/rules/work-packets.md` — single packet per session,
  dependency discipline (WP-097 must complete before WP-098 executes),
  no historical edits.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents required for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+ (N/A here — no code; preserved for template completeness).
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`.

**Packet-specific:**
- Read-only against `packages/` and `apps/`. No engine, registry, server, app, or test files modified.
- No modification to `docs/01-VISION.md`, `docs/ai/ARCHITECTURE.md`, or `.claude/rules/*.md`.
- No modification to WP-097 itself. §20 *cites* WP-097 §F; it does not amend WP-097's body.
- §20 MUST NOT duplicate WP-097 §F's G-1..G-7 gate items verbatim. §20.2 references them by ID; the canonical source remains WP-097 §F. Duplication would create the drift surface this WP exists to prevent.
- The §17 mirror pattern (§20.1 / §20.2 / §20.3) must be structurally parallel — same subsection numbering, same role per subsection, same FAIL-condition wording in Final Gate.
- D-9801 is a separate decision from D-9701. D-9701 = *"what the policy is."* D-9801 = *"how the lint gate enforces it."*
- The §F "Copy deferral" rule (paraphrasing the Public Blurb requires a `D-NNNN` carve-out) MUST be promoted into §20.2's required content as an explicit lint check.

**Session protocol:**
- If WP-097 has not yet executed at session start (D-9701 absent), **STOP**. Do not proceed. WP-098 cannot land §20 against a phantom decision.
- If §17 or the Final Gate table in 00.3 has been restructured since this WP was drafted, **STOP** and reconcile §20 against the current §17 form before proceeding.

**Locked contract values:**
- New 00.3 section: `## §20 — Funding Surface Gate Trigger`
- Subsections: `§20.1 — Trigger conditions`, `§20.2 — Required content of \`## Funding Surface Gate\``, `§20.3 — What §20 does not do`
- Decision ID: `D-9801`
- Authority chain cited inside §20: WP-097 §F (gate items); D-9701 (policy); D-9801 (this trigger)
- Final Gate new rows: at least five — (1) WP touches a §20.1 surface but lacks `## Funding Surface Gate`; (2) the gate block lacks G-1..G-7 mapping; (3) §20 N/A declared without justification, or with a tautological placeholder; (4) Copy deferral violated without `D-NNNN` carve-out; (5) WP narratively proposes future funding surfaces while declaring §20 N/A
- §20 header MUST contain the load-bearing sentence "§20 introduces no new policy and no new constraints" (preempts misreading §20 as a second policy)
- §20.1 MUST contain a "Governance-doc exclusion" sub-bullet (pure governance / reference docs that mention funding conceptually do not trigger §20)
- §20.1 N/A justification MUST name a reason; bare "N/A" and tautological placeholders are FAILs

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`. WP-098
> touches monetization policy enforcement (NG-1, NG-3, NG-5, NG-6,
> NG-7) by codifying the lint trigger that prevents drift on
> tournament-funding surfaces. §17 self-applies.

**Vision clauses touched:** §Financial Sustainability (peer-authority
boundary preserved by extension of WP-097 §F's enforcement); NG-1,
NG-3, NG-5, NG-6, NG-7 (the gate items §20 enforces all
cross-reference these Non-Goals).

**Conflict assertion:** **No conflict.** WP-098 enforces — does not
redefine — the touched clauses. The §20 trigger codifies WP-097 §F's
existing constraints at lint-gate time without amending the policy or
introducing new monetization surfaces. Vision §Financial Sustainability
remains the authority for platform-level revenue; §20 governs only the
tournament-level surface review process.

**Non-Goal proximity check:** Confirmed clear. NG-1 / NG-3 / NG-5 /
NG-6 / NG-7 are *strengthened* by §20 (the trigger forces explicit
disposition mapping rather than allowing silent skipping). NG-2 / NG-4
N/A — no gacha or energy-system surfaces are touched.

**Determinism preservation:** **N/A.** No engine, registry, scoring,
replay, RNG, or simulation surface touched.

---

## Funding Surface Gate (per WP-097 §F Audit discipline)

**Applicability declaration:** This WP does **not** touch any §A / §B /
§C funding surface. WP-098 codifies the lint-gate *trigger* that
enforces §F on future WPs; it does not implement, modify, or expose
any user-facing funding affordance. **Gate is N/A** for WP-098 itself
per the §F "Applicability is declared, never inferred" rule.

**Justification:** WP-098 modifies a governance document
(`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`) to add a lint
trigger. No `apps/` or `packages/` files are touched at execution; no
UI tokens (`Donate`, `Support Tournaments`, `Tournament Supporter`)
appear anywhere. The forbidden-token grep at the foot of WP-097 §E
applies and MUST return zero matches against `apps/` and `packages/`
at WP-098 execution time.

---

## Scope (In)

### A) `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — modified

Insert a new section **between §19 (Bridge-vs-HEAD Staleness Rule)
and `## Final Gate`**. Structure mirrors §17 exactly:

- **Header block** with a one-paragraph introduction explaining that
  §20 is a trigger-conditioned gate codifying WP-097 §F enforcement,
  and that the canonical gate items (G-1..G-7) live in WP-097 §F —
  §20 references them by ID. The intro MUST contain the sentence:
  *"§20 introduces no new policy and no new constraints; its sole
  function is to make omission of WP-097 §F review mechanically
  visible at lint time."* This sentence is load-bearing — it preempts
  future readers misreading §20 as a second policy peer to WP-097 §F.
- **§20.1 — Trigger conditions** — list of trigger surfaces (mirrors
  §17.1's checkbox-list pattern):
  - [ ] Global navigation funding affordances per WP-097 §A
  - [ ] Registry viewer funding affordances per WP-097 §B
  - [ ] User profile or account funding attribution surfaces per WP-097 §C
  - [ ] Tournament-specific funding-channel integrations (Open Collective, PayPal, equivalent per `docs/TOURNAMENT-FUNDING.md`)
  - [ ] User-visible copy referencing "donate", "support tournaments", "tournament funding", or equivalent terms (per WP-097 §F G-6)
  - A WP that touches none of the above MAY mark §20 as **N/A**, but MUST include a one-line justification per WP-097 §F "Applicability is declared, never inferred." A bare "N/A" is a §20 lint FAIL. The justification MUST name *why* none of the §20.1 trigger surfaces are present (e.g., *"docs-only governance update; no UI surfaces, no user-visible copy, no funding channels referenced"*). Tautological placeholders such as *"N/A — not applicable"* or *"this WP does not trigger §20"* are also a §20 lint FAIL — they restate the conclusion without naming the reason.
  - **Governance-doc exclusion.** Pure governance / reference documents (other WPs, ECs, STATUS updates, DECISIONS entries, `docs/ai/REFERENCE/*` files) that *mention* funding conceptually — for example, by citing WP-097, D-9701, or §20 itself — without defining, proposing, or implementing user-facing surfaces do not trigger §20. The N/A path with justification still applies; this exclusion only confirms that conceptual mention alone is not a trigger. Without this carve-out, reviewers risk over-applying §20 to every meta-document that names the funding policy.
- **§20.2 — Required content of `## Funding Surface Gate`** — checklist of required content when triggered:
  - [ ] **Surface inventory** — explicit list of every implemented surface mapped to its WP-097 §A / §B / §C source
  - [ ] **G-1 through G-7 disposition** — per implemented surface, an explicit pass / N/A statement with rationale, citing WP-097 §F by ID rather than paraphrasing
  - [ ] **Copy deferral declaration** — explicit statement that user-visible copy matches `docs/TOURNAMENT-FUNDING.md §Public Blurb (Reusable)` verbatim, OR a `D-NNNN` carve-out citation per WP-097 §F "Copy deferral"
  - [ ] **Authority citation** — `WP-097`, `D-9701`, and `D-9801` cited as authority chain
  - The WP MAY host this content inside its `## Vision Alignment` block instead of a dedicated `## Funding Surface Gate` block, per WP-097 §F Audit discipline; that's an acceptable equivalent.
- **§20.3 — What §20 does not do** — boundary clarifications:
  - It does not redefine WP-097 §F G-1..G-7. WP-097 is the source of truth; §20 is the trigger that forces the mapping.
  - It does not replace §17 Vision Alignment. A WP that triggers both §17 and §20 must satisfy both.
  - It does not apply to WPs that touch no §20.1 trigger surface.
  - It does not apply retroactively. Pre-existing WPs (WP-097 included) are not required to add `## Funding Surface Gate` blocks.

**Final Gate table modifications:**

Append at minimum five new rows after the existing row 33 (the §18 prose-vs-grep entry):

- WP touches a §20.1 trigger surface but has no `## Funding Surface Gate` section (or equivalent inside `## Vision Alignment`) — §20
- `## Funding Surface Gate` exists but lacks G-1..G-7 disposition mapping per WP-097 §F — §20
- §20 N/A declared without a one-line justification, or with a tautological placeholder ("N/A — not applicable", "this WP does not trigger §20") that restates the conclusion without naming the reason — §20
- User-visible funding copy paraphrases `docs/TOURNAMENT-FUNDING.md §Public Blurb (Reusable)` without a `D-NNNN` carve-out — §20
- WP describes or proposes future funding-related UI surfaces or copy in its narrative (e.g., "we'll add a donate button later", "Phase 2 will surface tournament funding", "a future packet will expose the Open Collective link") but declares §20 N/A — §20. Closes the "conceptual WP now, enforcement later" loophole: a WP that names a future funding surface is making a design commitment and runs the gate.

The §19 commit-time-discipline note that follows the existing Final Gate table is preserved byte-for-byte.

### B) `docs/ai/DECISIONS.md` — modified

Add a new `## D-9801` entry immediately before `## Final Note`. Required content:

- **Title:** `D-9801 — 00.3 §20 Funding Surface Gate Trigger Codifies WP-097 §F at Lint-Gate Time`
- **Decision body** stating four pillars:
  1. §20 mirrors §17 Vision Alignment trigger pattern (§20.1 / §20.2 / §20.3)
  2. Single source of truth: §20 cites WP-097 §F G-1..G-7 by ID rather than duplicating
  3. Applicability is mandatory — declared N/A with justification, or §F gate runs
  4. Final Gate adds at minimum five §20 fail conditions (the four direct-enforcement rows plus the narrative-only-N/A loophole-closer)
- **Anchor list:** `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §20`; WP-097 §F; D-9701 (policy authority cited by §20); §17 Vision Alignment (structural template)
- **Relationship to D-9701:** D-9701 = *"what the policy is"*; D-9801 = *"how the lint gate enforces it."* The two are mutually reinforcing; neither subsumes the other.
- **Status:** `Active`. Amendments require a new `D-NNNN` and a 00.3 §20 update.
- **Citation:** `WP-098`; `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §20`; `WP-097 §F`; `D-9701`.

### C) `docs/ai/STATUS.md` — modified

Add a `### WP-098 / EC-098 Executed — Funding Surface Gate Trigger (YYYY-MM-DD, EC-098)` block at the top of `## Current State`. Required content:

- One-paragraph summary: 00.3 §20 added; D-9801 anchors it; auto-trigger now applies to every funding-touching WP at lint time.
- Scope statement: docs-only; `git diff --name-only packages/ apps/` returns empty.
- Vision alignment: §Financial Sustainability + NG-1/3/5/6/7 strengthened by §20 enforcement.
- 01.5 NOT INVOKED — engine untouched.

### D) `docs/ai/work-packets/WORK_INDEX.md` — modified

- WP-098 row already added under Phase 7 at draft time; flip `[ ]` → `[x]` with today's date and SPEC commit hash.

### E) `docs/ai/execution-checklists/EC_INDEX.md` — modified

- EC-098 row already added at draft time as `Draft`; flip `Draft` → `Done {YYYY-MM-DD}`.

---

## Out of Scope

- **No modification to WP-097 or `docs/TOURNAMENT-FUNDING.md`.** Those are the policy contract; §20 cites them but does not amend them.
- **No modification to `docs/01-VISION.md`** (authority #3) or `docs/ai/ARCHITECTURE.md` (authority #2). §20 lives in 00.3 (REFERENCE), not in either authority document.
- **No modification to `.claude/rules/*.md`.** Runtime enforcement during execution is governed by `.claude/rules/`; §20 is a pre-execution lint gate, not a runtime rule.
- **No engine, registry, server, app, or test code touched.** No `.ts`, `.vue`, `.mjs`, `.sql`, `.json` modifications.
- **No retroactive application to existing WPs.** WP-097 (and any pre-existing UI WP that arguably touches funding surfaces) is not required to add a `## Funding Surface Gate` block. §20 applies prospectively.
- **No new UI surfaces, tokens, or copy.** Same scope-fence as WP-097's §E grep — `Donate`, `Support Tournaments`, `Tournament Supporter` MUST return zero matches against `apps/` and `packages/` at WP-098 execution.
- **No new lint tooling or scripts.** §20 is a documentation-level lint gate, the same as §17 / §18 / §19. Executing the gate is the responsibility of the WP-author / reviewer at draft time, not an automated script.
- **No EC-098-NT or parallel negative-tests file.** The user's earlier proposal for EC-097-NT was declined and integrated into WP-097 §F. Same precedent applies here: §20 is the single trigger; no shadow gate file.
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**.

---

## Files Expected to Change

- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — **modified** — add `## §20 — Funding Surface Gate Trigger` section between §19 and Final Gate (with the load-bearing "no new policy and no new constraints" preempt sentence in the §20 header, and a Governance-doc exclusion sub-bullet in §20.1); append at minimum five new rows to Final Gate table.
- `docs/ai/DECISIONS.md` — **modified** — add `## D-9801` entry immediately before `## Final Note`.
- `docs/ai/STATUS.md` — **modified** — add `### WP-098 / EC-098 Executed` block at top of `## Current State`.
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-098 row flipped `[ ]` → `[x]` with today's date and SPEC commit hash.
- `docs/ai/work-packets/WP-098-funding-surface-gate-trigger.md` — **new** — this file (created at draft time, before execution).
- `docs/ai/execution-checklists/EC-098-funding-surface-gate-trigger.checklist.md` — **new** — execution checklist (created at draft time, before execution; mirrors EC-097 pattern).
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-098 row flipped `Draft` → `Done {YYYY-MM-DD}`.

No other files may be modified. Verified by `git diff --name-only` after each commit.

---

## Acceptance Criteria

### AC-1 — §20 structural parity with §17

- [ ] `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` contains `## §20 — Funding Surface Gate Trigger` immediately after §19 and before `## Final Gate`.
- [ ] §20 has exactly three subsections: `§20.1 — Trigger conditions`, `§20.2 — Required content of \`## Funding Surface Gate\``, `§20.3 — What §20 does not do`.
- [ ] §20.1 lists the five trigger surfaces (global nav, registry viewer, profile attribution, tournament funding-channel integrations, user-visible funding copy) with citation back to WP-097 §A / §B / §C / §F.
- [ ] §20.1 includes the N/A path with the "one-line justification required" rule, citing WP-097 §F "Applicability is declared, never inferred."
- [ ] §20.1 N/A path explicitly fails tautological placeholders ("N/A — not applicable", "this WP does not trigger §20") and includes example phrasing of an acceptable justification (verified with `grep -nE "tautological|N/A — not applicable" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returning at least one match in §20.1).
- [ ] §20.1 contains a `**Governance-doc exclusion.**` sub-bullet stating that pure governance / reference documents mentioning funding conceptually do not trigger §20 (verified with `grep -nE "Governance-doc exclusion" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returning exactly one match).
- [ ] §20 header contains the sentence "§20 introduces no new policy and no new constraints" (verified with `grep -nE "no new policy and no new constraints" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returning at least one match in §20).
- [ ] §20.2 lists the four required content items (surface inventory, G-N disposition, copy deferral declaration, authority citation) and states `## Vision Alignment` block hosting is an acceptable equivalent.
- [ ] §20.3 lists at minimum four boundary clarifications (does not redefine §F; does not replace §17; does not apply to non-trigger WPs; does not apply retroactively).

### AC-2 — Single source of truth

- [ ] §20 does **not** restate or paraphrase G-1 through G-7. Verified with `grep -nE "G-[1-7]" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returning matches **only** as ID-citations (e.g., "G-1 through G-7"), never as full bullet items duplicating WP-097 §F's text.
- [ ] §20.2 cites WP-097 §F at least three times by section ID rather than paraphrasing its content.

### AC-3 — Final Gate extension

- [ ] At least five new rows appended to the Final Gate numbered table after row 33, all attributed to §20, covering: (1) missing `## Funding Surface Gate` section on a §20.1-triggering WP; (2) missing G-1..G-7 mapping; (3) bare or tautological "N/A" without a reason-naming justification; (4) Public Blurb paraphrase without `D-NNNN` carve-out; (5) WP narratively proposes future funding surfaces while declaring §20 N/A.
- [ ] The §19 commit-time-discipline note that follows the Final Gate table is preserved byte-for-byte.

### AC-4 — D-9801 anchor

- [ ] `docs/ai/DECISIONS.md` contains a `## D-9801` entry immediately before `## Final Note`.
- [ ] D-9801 cites `00.3 §20`, WP-097 §F, and D-9701 explicitly.
- [ ] D-9801 distinguishes its scope from D-9701 (D-9701 = policy; D-9801 = lint enforcement).
- [ ] D-9801 status is `Active` and the amendment rule is stated.

### AC-5 — STATUS and WORK_INDEX governance close

- [ ] `docs/ai/STATUS.md` has a new `### WP-098` block at the top of `## Current State`.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-098 row is flipped `[x]` with today's date and SPEC commit hash.
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-098 row is flipped `Draft` → `Done {YYYY-MM-DD}`.

### AC-6 — Scope enforcement

- [ ] `git diff --name-only packages/ apps/ docs/01-VISION.md docs/ai/ARCHITECTURE.md .claude/` returns empty.
- [ ] `git diff --name-only docs/TOURNAMENT-FUNDING.md docs/ai/work-packets/WP-097-tournament-funding-policy.md` returns empty (WP-097 + funding doc untouched).
- [ ] No new files outside `## Files Expected to Change`.
- [ ] `grep -nE "Donate|Support Tournaments|Tournament Supporter" apps/ packages/` returns zero matches.

### AC-7 — Lint gate self-compliance

- [ ] WP-098 contains a `## Vision Alignment` block citing §Financial Sustainability + NG-1/3/5/6/7 with a no-conflict assertion and an N/A determinism line.
- [ ] WP-098 contains a `## Funding Surface Gate` declaration (per the very §20 it codifies — self-application as proof of concept), declared **N/A with justification** because WP-098 implements no UI surface.

---

## Verification Steps

```bash
# Step 1 — confirm WP-097 has executed (D-9701 must exist)
grep -n "^## D-9701" docs/ai/DECISIONS.md
# Expected: exactly one match

# Step 2 — confirm §20 landed in 00.3 between §19 and Final Gate
grep -nE "^## §(19|20)|^## Final Gate" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: §19 line, §20 line (after §19), Final Gate line (after §20)

# Step 3 — confirm §20 subsections
grep -nE "^### §20\.(1|2|3)" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: three matches in order

# Step 4 — confirm §20 cites WP-097 §F by ID, never duplicates G-1..G-7
grep -nE "G-[1-7]" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: matches present, but only as citations like "G-1 through G-7"
# — never as full bullet items restating gate-item text from WP-097 §F

# Step 5 — confirm Final Gate extension (at least five new §20 rows)
grep -nE "§20" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: at least nine matches (1 section header + 3 subsections + 5 Final Gate rows minimum)

# Step 5b — confirm new clauses landed
grep -nE "no new policy and no new constraints|Governance-doc exclusion|tautological" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md
# Expected: at least three matches across §20

# Step 6 — confirm D-9801 in DECISIONS.md
grep -n "^## D-9801" docs/ai/DECISIONS.md
# Expected: exactly one match, immediately before "## Final Note"

# Step 7 — confirm D-9801 cites the right anchors
grep -A 50 "^## D-9801" docs/ai/DECISIONS.md | grep -E "WP-097|D-9701|00\.3.*§20"
# Expected: at least three matches across body

# Step 8 — confirm STATUS and WORK_INDEX
grep -n "WP-098" docs/ai/STATUS.md | head -3
grep -nE "\[x\] WP-098" docs/ai/work-packets/WORK_INDEX.md
# Expected: at least one match each

# Step 9 — confirm scope
git diff --name-only packages/ apps/ docs/01-VISION.md docs/ai/ARCHITECTURE.md .claude/
git diff --name-only docs/TOURNAMENT-FUNDING.md docs/ai/work-packets/WP-097-tournament-funding-policy.md
# Expected: empty for both
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification
> Steps` before checking any item below. Reading the doc is not
> sufficient — run the commands.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] WP-097 has executed (D-9701 exists in DECISIONS.md) — confirmed at session start
- [ ] §20 is in 00.3 between §19 and Final Gate; structurally parallel to §17
- [ ] §20 cites WP-097 §F G-1..G-7 by ID without duplicating
- [ ] Final Gate extended with at least five §20 fail conditions (the four enforcement rows + the narrative-only-N/A trap row)
- [ ] §20 header contains the "no new policy and no new constraints" preempt sentence
- [ ] §20.1 contains the "Governance-doc exclusion" sub-bullet and the strengthened N/A justification bar
- [ ] D-9801 lands in DECISIONS.md with the correct anchor citations
- [ ] STATUS.md, WORK_INDEX.md, EC_INDEX.md all updated
- [ ] No engine, registry, server, app, Vision, Architecture, rules, WP-097, or funding-doc files modified
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] EC-098 commit body includes a `Vision: §Financial Sustainability, NG-1, NG-3, NG-5, NG-6, NG-7` trailer per `01.3-commit-hygiene-under-ec-mode.md`

---

## Lint Self-Review (00.3 §1–§19; §20 self-applies after this WP lands)

> Performed at draft time; re-confirm before execution.

| § | Item | Status |
|---|---|---|
| §1 | All required WP sections present | PASS |
| §1 | `## Out of Scope` non-empty (≥2 items) | PASS (8+ items) |
| §2 | Non-Negotiable Constraints with engine-wide + packet-specific + session protocol + locked values | PASS |
| §2 | Constraints reference `00.6-code-style.md` | PASS |
| §3 | `## Assumes` lists prior state | PASS (WP-097 executed; D-9701 present; 00.3 §17/18/19 + Final Gate intact) |
| §4 | `## Context (Read First)` is specific | PASS (WP-097 §F, 00.3 §17, ARCHITECTURE.md hierarchy, DECISIONS.md, work-packets rule) |
| §5 | Every file `new` or `modified` with one-line description | PASS |
| §5 | No ambiguous "update this section" language | PASS |
| §6 | Naming consistency | PASS |
| §7 | No new npm dependencies | PASS (doc-only) |
| §8 | Layer boundaries respected (no engine import; no Vision edit; no rules edit) | PASS |
| §9 | Windows compatibility (verification commands cross-platform) | PASS |
| §10 | Env vars: N/A — no code | N/A |
| §11 | Auth: N/A — not auth-touching | N/A |
| §12 | Tests: N/A — doc-only WP, no test deliverables | N/A |
| §13 | Verification commands exact with expected output | PASS |
| §14 | Acceptance criteria are 6–12 binary observable items grouped by sub-task | PASS (7 AC groups) |
| §15 | DoD includes STATUS.md + DECISIONS.md + WORK_INDEX.md + scope-boundary check | PASS |
| §16 | Code style: N/A — markdown deliverables | N/A |
| §17 | Vision Alignment block present with cited clauses + no-conflict assertion + N/A determinism line | PASS |
| §18 | Prose-vs-grep discipline: forbidden tokens not enumerated verbatim near literal-string greps | PASS |
| §19 | Bridge-vs-HEAD staleness: N/A — not a repo-state-summarizing artifact | N/A |
| §20 | Funding Surface Gate Trigger: §20 will exist after this WP lands. WP-098 self-application — gate declared N/A with justification per the §F "Applicability is declared, never inferred" rule (codified by §20 itself). Self-applying §20 to its own authoring WP is a proof-of-concept demonstration; the actual §20 lint gate cannot be enforced against WP-098 at draft time because §20 does not yet exist. | PASS (self-applied) |

**Final Gate verdict:** PASS at draft time. Re-confirm before execution after WP-097 has landed and 00.3 §17/§18/§19 + Final Gate are confirmed intact.
