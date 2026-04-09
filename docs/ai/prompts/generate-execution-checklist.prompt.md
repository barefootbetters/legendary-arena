## Prompt — Generate Execution Checklists (EC) from Work Packets (WP)

> Tooling Prompt
> Generates Execution Checklists from Work Packets.
> Not an authority document.

**FULL CONTENTS MODE**

You are operating inside the Legendary Arena AI coordination system.

Your task is to generate **Execution Checklist (EC)** files from existing
**Work Packet (WP)** files. ECs are lightweight pre-execution supplements
that sit alongside WPs — they do NOT replace them.

This task produces documentation only. Do NOT implement code.

---

## Authority Hierarchy (Non-Negotiable)

1. `.claude/CLAUDE.md`
2. `docs/ai/ARCHITECTURE.md` (including Layer Boundary)
3. `.claude/rules/*.md`
4. `docs/ai/work-packets/WORK_INDEX.md`
5. Work Packets (authoritative source material)
6. Execution Checklists (derived supplements — WP wins on conflict)

---

## What is an Execution Checklist?

An EC is a ~40-50 line quick-reference document that Claude reads **before**
the full WP. It extracts the most drift-prone elements:

- **Dependencies** that must be verified before starting
- **Locked values** that must never be re-derived (constants, field names,
  evaluation orders)
- **Guardrails** that prevent the most common failure modes
- **Required comments** (`// why:` locations)
- **File list** for rapid orientation
- **Session-close checklist** (STATUS.md, DECISIONS.md, WORK_INDEX.md)

ECs deliberately exclude narrative, rationale, acceptance criteria details,
and verification step commands — those live in the WP.

---

## Selection Rule

Generate ECs for the WPs specified below:

- [PASTE LIST HERE BEFORE RUNNING]

If no list is provided, generate ECs for WP-002 through WP-014 only.

---

## Template

Follow the structure in `docs/ai/execution-checklists/EC-TEMPLATE.md` exactly.

Reference implementation: `docs/ai/execution-checklists/EC-010-endgame.checklist.md`

---

## Naming Convention

```
EC-NNN-short-slug.checklist.md
```

Where:
- NNN matches the WP number (WP-018 → EC-018)
- short-slug is concise kebab-case (2-5 words)

Examples:
- `EC-002-game-skeleton.checklist.md`
- `EC-005A-setup-contracts.checklist.md`
- `EC-018-economy.checklist.md`

---

## Extraction Rules

### Before Starting
- Pull from WP `## Assumes`
- Include only the critical dependencies (not every line)
- Always include build and test exit-0 checks

### Locked Values
- Pull from WP `## Non-Negotiable Constraints` locked contract values section
- **Copy verbatim** — never paraphrase or summarize
- Include exact constant names, string values, type shapes, field orders
- If the WP specifies an evaluation order or priority, copy it exactly

### Guardrails
- Pull from WP constraints, architecture references, and known failure modes
- Focus on the 5-8 rules most likely to cause drift
- Use imperative language ("must", "never", "no")

### Required `// why:` Comments
- Scan the WP for every mention of `// why:` comment requirements
- List the location and what the comment should explain

### Files to Produce
- Pull from WP `## Files Expected to Change`
- Compact format: path, new/modified, one-line description

### After Completing
- Pull from WP `## Definition of Done`
- Always include: build, test, STATUS.md, DECISIONS.md, WORK_INDEX.md
- Include packet-specific verification items (no throw, no forbidden imports)

---

## Quality Gates

Every generated EC must:
- Be ≤ 60 lines (excluding blank lines)
- Contain no narrative or rationale prose
- Contain no acceptance criteria details (those live in the WP)
- Contain no verification step commands (those live in the WP)
- Contain no external URLs
- Contain no `.test.mjs` references
- Have locked values copied verbatim from the WP (never summarized)

---

## Output Requirements

You must output, in order:

### 1) Files Changed
List exact paths.

### 2) Full Contents
Provide full contents of every generated EC file.
No diffs. No excerpts.

### 3) Validation Checklist
Confirm:
- [ ] Naming convention followed
- [ ] All ECs follow EC-TEMPLATE.md structure
- [ ] Locked values are verbatim (not paraphrased)
- [ ] No external URLs
- [ ] No narrative or rationale prose
- [ ] Each EC ≤ 60 lines

Begin generation now.
