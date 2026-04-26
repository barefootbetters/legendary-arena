# EC-098 — Funding Surface Gate Trigger (Execution Checklist)

**Source:** docs/ai/work-packets/WP-098-funding-surface-gate-trigger.md
**Layer:** Governance / Policy (docs-only; lint-gate enforcement)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-098.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-098.

---

## Before Starting

- [ ] WP-097 has executed; `grep -n "^## D-9701" docs/ai/DECISIONS.md` returns exactly one match
- [ ] `docs/TOURNAMENT-FUNDING.md` reflects the WP-097 reconciliations (Scope section, Vision citation, D-9701 citation, Cost Baseline, Public Blurb)
- [ ] WP-098 status flipped Draft → Executing; pre-flight bundle registered
- [ ] `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` has §17, §18, §19 and Final Gate in their current form (no prior §20 entry; verified with `grep -nE "^## §20" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returning zero matches)
- [ ] `docs/ai/DECISIONS.md` highest current ID is `D-9701` (D-9801 not yet present)
- [ ] `git diff --name-only packages/ apps/` empty at start

## Locked Values (do not re-derive)

- Target file: `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`
- New section header: `## §20 — Funding Surface Gate Trigger`
- Subsection headers (exact): `### §20.1 — Trigger conditions`, `### §20.2 — Required content of \`## Funding Surface Gate\``, `### §20.3 — What §20 does not do`
- Decision ID: `D-9801`
- Authority chain cited inside §20: WP-097 §F (gate items); D-9701 (policy); D-9801 (this trigger)
- Five §20.1 trigger surfaces: global navigation funding affordances (per WP-097 §A); registry viewer funding affordances (per §B); profile / account attribution (per §C); tournament funding-channel integrations (Open Collective, PayPal, equivalent); user-visible "donate" / "support tournaments" / "tournament funding" copy (per §F G-6)
- Four §20.2 required content items: Surface inventory; G-1..G-7 disposition; Copy deferral declaration; Authority citation
- Final Gate row count delta: at least five new rows attributed to §20 (four enforcement rows + the narrative-only-N/A trap row)
- §20 header MUST contain the load-bearing sentence "§20 introduces no new policy and no new constraints" (preempts misreading §20 as a second policy)
- §20.1 MUST contain a `**Governance-doc exclusion.**` sub-bullet (pure governance / reference docs that mention funding conceptually do not trigger §20)
- §20.1 N/A justification MUST name a reason; bare "N/A" and tautological placeholders ("N/A — not applicable", "this WP does not trigger §20") are FAILs; example acceptable phrasing is included in §20.1

## Guardrails

- Docs-only. No `packages/`, `apps/`, Vision, Architecture, `.claude/`, WP-097, or `docs/TOURNAMENT-FUNDING.md` files modified.
- §20 cites WP-097 §F G-1..G-7 by ID; never duplicates or paraphrases them. Duplication is the exact drift surface §20 exists to prevent.
- §20 is structurally parallel to §17 (same subsection numbering: .1 trigger, .2 content, .3 boundary; same FAIL-condition wording in Final Gate).
- D-9801 ≠ D-9701. D-9701 = "what the policy is"; D-9801 = "how the lint gate enforces it." Body of D-9801 must distinguish the two scopes explicitly.
- The §F "Copy deferral" rule must surface in §20.2 as a distinct required-content item.
- WP-098 self-application: WP-098 itself contains a `## Funding Surface Gate` declaration marked **N/A with justification** ("WP-098 codifies the §20 trigger; it implements no UI surface"). This is preserved at execution; do not delete or rewrite.

## Required `// why:` Comments

- N/A — no executable code is created or modified by EC-098.

## Files to Produce

### Commit A (EC-098 execution — 00.3 §20 addition)

- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — **modified** — insert `## §20 — Funding Surface Gate Trigger` section between §19 (Bridge-vs-HEAD Staleness Rule) and `## Final Gate`; subsections §20.1 / §20.2 / §20.3 mirror §17.1 / §17.2 / §17.3 pattern; §20 cites WP-097 §F by ID without duplicating G-1..G-7 content. The §20 header intro contains the load-bearing sentence "§20 introduces no new policy and no new constraints; its sole function is to make omission of WP-097 §F review mechanically visible at lint time." §20.1 contains a `**Governance-doc exclusion.**` sub-bullet and a strengthened N/A justification bar (tautological placeholders fail). Append at minimum five new rows to the Final Gate numbered table after row 33 (the §18 prose-vs-grep entry), each attributed to §20: missing `## Funding Surface Gate` on §20.1-triggered WP; missing G-1..G-7 mapping; bare or tautological "N/A" without a reason-naming justification; Public Blurb paraphrase without `D-NNNN` carve-out; WP narratively proposes future funding surfaces while declaring §20 N/A. The §19 commit-time-discipline note that follows the existing Final Gate table is preserved byte-for-byte.

### Commit B (SPEC governance close — not EC-098)

- `docs/ai/DECISIONS.md` — **modified** — `## D-9801` inserted immediately before `## Final Note`; cites `00.3 §20`, WP-097 §F, and D-9701; distinguishes its scope from D-9701; status `Active`
- `docs/ai/STATUS.md` — **modified** — `### WP-098 / EC-098 Executed — Funding Surface Gate Trigger ({YYYY-MM-DD}, EC-098)` block at top of `## Current State`
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — WP-098 row flipped `[ ]` → `[x]` with today's date and SPEC commit hash
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — EC-098 row flipped `Draft` → `Done {YYYY-MM-DD}`

## After Completing

- [ ] WP-098 acceptance criteria AC-1 through AC-7 all pass
- [ ] `grep -nE "^## §20 — Funding Surface Gate Trigger" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returns exactly one match between §19 and Final Gate
- [ ] `grep -nE "^### §20\.(1|2|3)" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returns exactly three matches in order
- [ ] §20 references WP-097 §F by ID at least three times; G-1..G-7 appear only as ID citations, never as duplicated bullet items
- [ ] Final Gate table has at least five new §20-attributed rows after row 33 (verified with `grep -nE "§20$" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returning at least five matches inside the Final Gate table)
- [ ] §20 header contains the load-bearing preempt sentence (verified with `grep -nE "no new policy and no new constraints" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returning at least one match)
- [ ] §20.1 contains the Governance-doc exclusion sub-bullet (verified with `grep -nE "Governance-doc exclusion" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returning exactly one match)
- [ ] §20.1 N/A justification bar fails tautological placeholders (verified with `grep -nE "tautological|N/A — not applicable" docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` returning at least one match)
- [ ] `grep -n "^## D-9801" docs/ai/DECISIONS.md` returns exactly one match (immediately before `## Final Note`)
- [ ] `grep -A 50 "^## D-9801" docs/ai/DECISIONS.md | grep -E "WP-097|D-9701|00\.3.*§20"` returns at least three matches
- [ ] `grep -nE "\[x\] WP-098" docs/ai/work-packets/WORK_INDEX.md` returns exactly one match under Phase 7
- [ ] `grep -nE "Donate|Support Tournaments|Tournament Supporter" apps/ packages/` returns zero matches
- [ ] `git diff --name-only packages/ apps/ docs/01-VISION.md docs/ai/ARCHITECTURE.md .claude/ docs/TOURNAMENT-FUNDING.md docs/ai/work-packets/WP-097-tournament-funding-policy.md` returns empty
- [ ] `git diff --name-only` limited to the files listed in `## Files to Produce`
- [ ] EC-098 commit body includes a `Vision: §Financial Sustainability, NG-1, NG-3, NG-5, NG-6, NG-7` trailer per `01.3-commit-hygiene-under-ec-mode.md`
- [ ] EC_INDEX EC-098 row updated `Draft` → `Done {YYYY-MM-DD}`

## Common Failure Smells

- §20 includes a verbatim restatement of G-1 through G-7 — STOP; this is exactly the duplication §20 exists to prevent. Re-read WP-098 Locked Values and the AC-2 single-source-of-truth requirement; cite §F by ID, do not paraphrase.
- D-9801 collapsed into D-9701 (e.g., body says "this amends D-9701") — STOP; D-9801 is a separate decision. D-9701 governs the policy; D-9801 governs the lint enforcement. Re-read WP-098 Goal and AC-4.
- §17 subsection structure altered or §17 fail-condition rows rewritten — STOP; §17 is preserved byte-for-byte. §20 mirrors §17, never modifies it.
- WP-097 §F edited "while we're in there" — STOP; WP-097 is out of scope. §20 cites §F; it does not amend it. Restore from baseline.
- Bare "N/A" appears in §20.1's N/A path without the justification rule — STOP; the "one-line justification required" rule is load-bearing per WP-097 §F "Applicability is declared, never inferred."
- §20.1 N/A path accepts tautological placeholders ("N/A — not applicable", "this WP does not trigger §20") — STOP; the strengthened bar requires the justification to NAME why none of the trigger surfaces are present, with example phrasing in §20.1. A restated conclusion is not a justification.
- §20 header omits the "no new policy and no new constraints" preempt sentence — STOP; the sentence is load-bearing. Without it, future readers may misread §20 as a second policy peer to WP-097 §F instead of as a verification trigger over it. Re-add and re-run grep verification before completing Commit A.
- §20.1 missing the Governance-doc exclusion sub-bullet — STOP; without the exclusion, reviewers risk over-applying §20 to other WPs / ECs / STATUS updates / DECISIONS entries that mention funding conceptually. The exclusion is what scopes §20 to actual UI-touching WPs.
- WP narratively describes future funding surfaces ("we'll add a donate button later", "Phase 2 will surface tournament funding") and declares §20 N/A — STOP; this is the loophole the new fifth Final Gate row closes. Either land the surface and run G-1..G-7, or remove the narrative reference and re-justify N/A. "Conceptual WP now, enforcement later" is exactly the drift §20 prevents.
