## Prompt — Auto-Tighten Execution Checklists (EC Drafts)

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

Your task is to tighten Execution Checklist (EC) drafts so they conform to:
- `docs/ai/execution-checklists/EC-TEMPLATE.md` (authoritative EC template)
- the tightened EC pattern demonstrated by `EC-010` (execution authority + binary compliance)

This task is DOCUMENTATION ONLY.
Do NOT modify any Work Packet (WP) files.
Do NOT modify any code.
Do NOT modify WORK_INDEX.md.
Do NOT modify EC_INDEX.md unless explicitly required by the instructions below.

---

## Inputs (Authoritative)

- `docs/ai/execution-checklists/EC-TEMPLATE.md` — EC structure and rules
- `docs/ai/execution-checklists/EC_INDEX.md` — list of ECs and their status
- Individual EC files being tightened (EC-*.checklist.md)
- The source WP for each EC (read-only reference)

---

## Selection Rule (Do Not Ask Questions)

Tighten ECs using one of these modes:

### Mode A — Explicit List
If the user provides a list of EC filenames in this prompt, tighten ONLY those.

### Mode B — Default
If no list is provided, tighten ALL ECs with Status = Draft in `EC_INDEX.md`
EXCEPT:
- EC-001 (already Done)
- any EC whose Source WP does not exist

You must not tighten Done ECs unless explicitly listed.

---

## Tightening Requirements (Hard)

For each targeted EC file:

### 1) Enforce EC Structure

The EC file MUST have exactly these sections, in this order:

1. Title line: `# EC-### — <Short Title> (Execution Checklist)`
2. Source and Layer lines on separate lines:
   - `**Source:** <path to WP>`
   - `**Layer:** <layer>`
3. Execution Authority block (required)
4. `## Before Starting` with checkbox items
5. `## Locked Values (do not re-derive)` (verbatim)
6. `## Guardrails`
7. `## Required \`// why:\` Comments`
8. `## Files to Produce`
9. `## Common Failure Smells (Optional)` — include only if there are known failure modes
10. `## After Completing` with checkbox items

No extra sections. No narrative.

### 2) Add Execution Authority (Required)

Insert this block immediately after Source/Layer:

```
**Execution Authority:**
This EC is the authoritative execution checklist for WP-NNN.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-NNN.
```

### 3) Convert "Before Starting" and "After Completing" to Checkboxes

- Every item must be `- [ ] ...`
- Commands must be wrapped in backticks where appropriate
- Keep "docs updated" closure items

### 4) Locked Values Must Be Verbatim

- Copy constants, field names, evaluation orders, and shapes verbatim from the WP
- Do not summarize
- Do not reformat in a way that changes meaning
- If you cannot locate a locked value verbatim in the WP, omit it and add a single line:
  `- [MISSING IN WP] <what is missing>`
  (Do not invent it.)

### 5) Guardrails Must Be Minimal and Drift-Preventing

- Include only the 5-10 highest impact "must/must not" constraints from the WP
- Prefer rules that prevent known failure modes:
  - registry boundary
  - determinism
  - JSON serializability
  - move throwing
  - forbidden imports
  - forbidden test extensions

### 6) Add Required `// why:` Comment Locations

- Extract comment requirements from the WP Scope/Constraints
- Express each as:
  `- <location>: <what to explain>`

### 7) Files to Produce Must Match WP "Files Expected to Change"

- Use the compact format:
  `- \`path/file.ts\` — **new** — one-line description`
- Do not add files not listed in the WP
- Do not omit files listed in the WP

### 8) Optional "Common Failure Smells" Section

Include ONLY if:
- the WP has known non-obvious failure modes, OR
- the EC benefits from quick debugging mapping

Each line must map symptom -> likely clause violation.
Keep to 3-6 bullets max.

### 9) Line Limit Enforcement

- Each tightened EC must be <= 60 non-empty content lines
  excluding the template header and section titles.
- If the EC exceeds 60 lines, tighten by:
  - removing optional failure smells first
  - collapsing low-value guardrails
  - shortening descriptions (without losing meaning)

### 10) No External URLs

- Remove any external URLs from ECs.
- ECs must reference repo-local paths only.

---

## Output Requirements (Mandatory)

You must output, in order:

### 1) Files Changed
List exact file paths.

### 2) Full Contents
Provide full contents of every modified EC file (no diffs, no excerpts).

### 3) Tightening Report
For each EC:
- Confirm it meets the EC structure
- Confirm it meets the line limit
- Note any `[MISSING IN WP]` items discovered

---

## Important Constraints

You must NOT:
- Modify WPs
- Modify code
- Modify WORK_INDEX.md
- Invent missing locked values
- Expand scope beyond execution checklist tightening

Begin tightening now.
