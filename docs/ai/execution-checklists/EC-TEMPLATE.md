# EC-TEMPLATE — Execution Checklist Template

> **Purpose:** Execution Checklists (ECs) are lightweight pre-execution
> supplements that sit alongside Work Packets. Claude reads both the WP
> (authoritative design document) and the EC (execution contract) before
> starting.
>
> ECs do NOT replace Work Packets. The WP is always authoritative for
> design intent. If the EC and WP conflict on design, the WP wins.
>
> **Execution Authority:** For any Work Packet with a corresponding
> Execution Checklist (EC), the EC is the authoritative execution checklist.
> Implementation must satisfy the EC exactly.
> Failure to satisfy any EC item is a failed execution of the WP.
>
> **When to use:** Before starting a WP session, read the EC first for a
> rapid orientation, then read the full WP for details.

---

## How to Generate an EC

For each WP, extract:

1. **Before Starting** — from `## Assumes`: key dependencies that must be true
2. **Locked Values** — from `## Non-Negotiable Constraints` locked contract
   values: verbatim constants, field names, evaluation orders. Never paraphrase.
3. **Guardrails** — from constraints and architecture: the 5-8 most important
   rules that prevent drift
4. **Required Comments** — any `// why:` comment locations specified in the WP
5. **Files to Produce** — from `## Files Expected to Change`: compact list
6. **After Completing** — from `## Definition of Done`: session-close checklist
7. **Common Failure Smells** (optional) — known symptoms that indicate specific
   guardrail violations or re-derived locked values

---

## EC File Structure (Exact)

```markdown
# EC-NNN — Short Title (Execution Checklist)

**Source:** docs/ai/work-packets/WP-NNN-slug.md
**Layer:** [Game Engine | Registry | Server | Cross-cutting]

## Before Starting
- [ ] [dependency 1]
- [ ] [dependency 2]
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

## Locked Values (do not re-derive)
- [verbatim constant 1]
- [verbatim constant 2]
- [exact evaluation order or field names]

## Guardrails
- [most important rule 1]
- [most important rule 2]
- [known failure mode to prevent]

## Required `// why:` Comments
- [location 1]: [what to explain]
- [location 2]: [what to explain]

## Files to Produce
- `path/file.ts` — **new** — one-line description
- `path/file.ts` — **modified** — what changes

## After Completing
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated (list specific decisions)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` checked off with date

## Common Failure Smells (Optional)
- [symptom] usually indicates [specific guardrail violation]
- [symptom] often means [locked value was re-derived]
```

---

## Rules

- The EC is the **authoritative execution contract** for its WP — compliance
  is binary; every item must be satisfied exactly
- The WP is the **authoritative design document** — if the EC and WP conflict
  on design intent, the WP wins
- ECs must be ≤ 60 non-empty content lines (excluding this header and
  section titles)
- Locked Values must be copied verbatim from the WP.
  If formatting or ordering differs, the EC is invalid.
- Do not include narrative, rationale, or session context
- Do not include full acceptance criteria — those live in the WP
- One EC per WP; filename: `EC-NNN-short-slug.checklist.md`
- Short Title in the EC header should match the filename slug semantically
- The "Common Failure Smells" section is optional — include it when the WP
  has known failure modes that are non-obvious from the guardrails alone
