# Work Packet Invocation — WP-043 (Data Contracts Reference)

**FILE TYPE:** Invocation Prompt
**AUDIENCE:** Claude Code (Execution Mode)
**PURPOSE:** Pre-execution contract setup for a single Work Packet
**SCOPE:** This file defines *what may be done* in the upcoming WP execution

---

## Invocation Header

**Work Packet ID:** `WP-043`
**Work Packet Title:** Data Contracts Reference (Canonical Card & Metadata Shapes)
**Execution Mode:** EC-Mode (Execution Checklist enforced)
**Invocation Type:** Single-WP Execution
**Status:** Ready to Execute
**Pre-Flight Date:** 2026-04-10
**Pre-Flight Verdict:** READY TO EXECUTE
**Work Packet Class:** Contract-Only (documentation reference — no TypeScript code)

---

## Invocation Intent

You are about to execute **WP-043** in the Legendary Arena codebase.

This invocation defines **exact scope**, **authority order**, **allowed changes**,
and **forbidden behavior** for this Work Packet execution.

WP-043 creates a **governed data contracts reference document** that replaces
the legacy `00.2-data-requirements.md`. It captures card and metadata shapes,
image URL conventions, ability text markup, and PostgreSQL schema references
for human consumption — subordinate to `schema.ts` (machine-enforced) and
`ARCHITECTURE.md` (governance authority).

This is a **documentation-only** packet. No TypeScript code is produced. No
packages are modified. No tests are created or changed.

You must operate strictly within this contract.

---

## Authority Chain (Must Read In Order)

Before executing any step, you must read and follow these documents **in this order**:

1. `.claude/CLAUDE.md`
   - EC-mode rules
   - Bug handling rules
   - Commit discipline

2. `docs/ai/ARCHITECTURE.md`
   - Section 2: Registry Metadata File Shapes, Card Field Data Quality,
     Card Data Flow, Zone & Pile Structure, MatchSetupConfig
   - Section 3: Persistence Boundaries
   - Layer Boundary (Authoritative)

3. `.claude/rules/code-style.md`
   - Naming conventions (full English words, no abbreviations)
   - Comment requirements (`// why:` comments)

4. `docs/ai/execution-checklists/EC-043-data-contracts.checklist.md`
   - The governing execution checklist for this WP

5. `docs/ai/work-packets/WP-043-data-contracts-reference.md`
   - The formal specification for this Work Packet

Then reference (read-only — **none of these may be modified**):

6. `packages/registry/src/schema.ts` — the authoritative Zod schemas.
   The reference document describes shapes for human consumption; `schema.ts`
   is the machine-enforced source of truth. **If they differ, `schema.ts` wins.**
7. `docs/ai/REFERENCE/00.2-data-requirements.md` — the **existing legacy version**
   (755 lines) that will be **fully replaced**. Read it for content to migrate,
   but the new document must conform to WP-043 §A (8 sections only).
8. `docs/archive prompts-legendary-area-game/00.2-data-requirements.md` — the
   original legacy source (archived). Use if additional detail is needed.
9. Card JSON data at `C:\Users\jjensen\bbcode\modern-master-strike\src\data\cards\`
   — real card data for verifying JSON shapes and field examples. Use if accessible.

If any document conflicts, **higher-authority documents win**.

---

## Pre-Flight Findings (2026-04-10)

Pre-flight validation confirmed readiness. Key findings:

### Prerequisites Verified

- WP-003 complete (2026-04-09) — `schema.ts` authoritative, `FlatCard.cost` is
  `string | number | undefined`, `httpRegistry.ts` fetches `sets.json`
- `docs/ai/ARCHITECTURE.md` exists with all required sections
- `packages/registry/src/schema.ts` exists
- `docs/ai/DECISIONS.md` exists
- Game-engine: 72 tests passing, 0 failing

### Risks Identified and Mitigations (Locked)

1. **Existing 00.2 is the legacy version** — `docs/ai/REFERENCE/00.2-data-requirements.md`
   exists (755 lines) with legacy UI sections (§7 Deck Data, §9 Search/Filter,
   §10 Preferences, §11 App Config, §12 Export). **Decision: full replacement.**
   The new file has exactly 8 sections per WP-043 §A. Legacy content is archived.

2. **ARCHITECTURE.md cross-reference already exists** — Line 136 already references
   `00.2-data-requirements.md`. **Decision: verify and update wording if needed;
   do not add a duplicate reference.**

3. **Legacy source archived at different path** — The legacy source is at
   `docs/archive prompts-legendary-area-game/00.2-data-requirements.md` (not the
   original path referenced in WP-043). **Decision: read from archive path.**

4. **Card data may not be locally accessible** — Real card JSON lives outside the
   repo. **Decision: use `schema.ts` and the existing 00.2 content as primary
   shape references. Verify against external card data if accessible.**

These decisions are **locked for execution**. Do not revisit or reinterpret them.

---

## Scope Contract (Read Carefully)

### WP-043 DOES:

- **Replace** `docs/ai/REFERENCE/00.2-data-requirements.md` — fully overwrite
  the existing 755-line legacy file with a new governed reference document
  containing exactly 8 sections:
  - §1 Card Data Shapes — per-set JSON structure, hero deck shape (with field
    reference table), mastermind shape (with tactic/epic distinction and `vAttack`
    string convention), villain group shape (with `ledBy` inverse relationship),
    scheme shape (with transform card note), henchman shape, bystander/wound/other
  - §2 Metadata Lookups — shapes for all 6 metadata files: `card-types.json`
    (37 types with full taxonomy table), `sets.json` (40 sets), `hero-teams.json`
    (25 teams), `hero-classes.json` (5 classes), `icons-meta.json` (7 icons),
    `leads.json` (mastermind-villain relationships). Each with field reference
    tables. Cross-reference to ARCHITECTURE.md "Registry Metadata File Shapes"
  - §3 Image & Asset Conventions — R2 base URL, image URL construction patterns
    (with real examples), image naming convention table by card type, hero card
    suffix encoding (cost + rarity), `metadata/sets.json` registry manifest
  - §4 PostgreSQL Schema Reference — table inventory with purposes, key foreign
    keys, `ext_id` convention, what PostgreSQL stores vs what stays in R2.
    Must note: "PostgreSQL is server-layer; see Layer Boundary."
  - §5 Ability Text Markup Language — bracket notation tokens (`[keyword:X]`,
    `[icon:X]`, `[hc:X]`, `[team:X]`, `[rule:X]`) with resolution targets,
    parsing notes, `[object Object]` data quality warning
  - §6 Mastermind-Villain Group Relationship — three-level model (per-set JSON,
    leads.json, PostgreSQL), special cases (any villain group, henchmen leads,
    unassigned groups)
  - §7 Match Configuration — reference to ARCHITECTURE.md §Section 2
    "Match Lifecycle" and WP-005A for the 9 locked fields. One paragraph only.
  - §8 Authority Notes — explicit subordination: this document is a
    human-readable reference; `schema.ts` is the machine-enforced source of
    truth; `ARCHITECTURE.md` governs persistence, layer boundaries, and engine
    contracts

- **Verify/update** `docs/ai/ARCHITECTURE.md` — confirm the existing
  cross-reference to `00.2-data-requirements.md` (line 136) is adequate.
  Update wording if needed. Do NOT add a duplicate reference.
- **Update** `docs/ai/STATUS.md` — data contracts reference exists; legacy 00.2
  is superseded
- **Update** `docs/ai/DECISIONS.md` — at minimum: why legacy §7/9/10/11/12 were
  excluded (UI concerns per Layer Boundary); why this is a reference document
  subordinate to `schema.ts` rather than a replacement for it
- **Update** `docs/ai/work-packets/WORK_INDEX.md` — mark WP-043 complete with
  today's date

### WP-043 DOES NOT:

- No TypeScript code produced — no `.ts` files created or modified
- No modifications to `packages/registry/src/` — Zod schemas are authoritative
- No modifications to `packages/game-engine/` — engine contracts locked
- No modifications to `apps/server/` — server wiring not in scope
- No restating of architectural rules (persistence boundaries, G never persisted,
  MatchSetupConfig 9 fields) — reference ARCHITECTURE.md sections instead
- No restating of engine conventions (CardExtId, zone contents, move validation)
  — reference the relevant WP
- No UI concerns: search/filter logic, user preferences, feature flags,
  animations, localStorage, Konva.js, Vue, dark themes
- No deployment checklists — covered by WP-042
- No legacy §7 (user deck data), §9 (search/filter), §10 (preferences),
  §11 (app config), §12 (export) content in the new document
- No speculative content, aspirational shapes, or "future feature" placeholders
- No "while I'm here" improvements or refactoring

If something feels questionable, it almost certainly belongs **out of scope**.

---

## Files Allowed to Change (Allowlist)

Only the following files **may be created or modified** during this execution:

    docs/ai/REFERENCE/00.2-data-requirements.md   — replaced (full overwrite)
    docs/ai/ARCHITECTURE.md                         — modified (cross-ref verify/update)
    docs/ai/STATUS.md                               — modified (status update)
    docs/ai/DECISIONS.md                            — modified (exclusion rationale)
    docs/ai/work-packets/WORK_INDEX.md              — modified (completion check-off)

Any modification outside this list is a **hard failure**.

---

## Files Explicitly Locked (Read-Only)

The following files **must not be changed**:

    packages/registry/src/schema.ts                 — authoritative Zod schemas
    packages/registry/src/**                        — all registry source files
    packages/game-engine/src/**                     — all engine source files
    apps/server/**                                  — all server files
    apps/registry-viewer/**                         — all viewer files
    docs/ai/execution-checklists/EC-043-*.md        — governing EC (read-only)
    docs/ai/work-packets/WP-043-*.md                — governing WP spec (read-only)

These are dependencies or governance, not execution targets.

---

## Runtime Wiring Allowance

**Not applicable.** WP-043 is a Contract-Only (documentation) Work Packet.
No runtime-visible fields are introduced or consumed. No type changes, no
structural assertions affected. Per `docs/ai/REFERENCE/01.5-runtime-wiring-allowance.md`,
this clause applies only when a WP adds required fields to shared types, changes
return shapes, adds new moves, or adds phase hooks. None of these conditions
apply to WP-043.

No files outside the allowlist may be modified under any clause.

---

## Locked Values (Do Not Re-Derive)

All items below must be used verbatim from WP-043 and EC-043.
If formatting, spelling, or ordering differs, the implementation is invalid.

### MatchSetupConfig fields (reference only — defined in WP-005A)

`schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
`heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
`sidekicksCount`

### Card field type convention (from WP-003)

`cost`, `attack`, `recruit`, `vAttack` are `string | number | undefined`

### `legendary.*` namespace

All PostgreSQL tables in `legendary.*` schema. PKs use `bigserial`.
Cross-service IDs use `ext_id text`.

### Section structure (exactly 8 sections)

§1 Card Data Shapes, §2 Metadata Lookups, §3 Image & Asset Conventions,
§4 PostgreSQL Schema Reference, §5 Ability Text Markup Language,
§6 Mastermind-Villain Group Relationship, §7 Match Configuration,
§8 Authority Notes

No additional sections may be added. No sections may be omitted.

---

## Document Quality Requirements

Each section of the new `00.2-data-requirements.md` must include:

- **Actual JSON shapes from real data** — not aspirational or invented.
  Source shapes from `schema.ts`, the existing legacy 00.2, and (if accessible)
  real card JSON files.
- **Field reference tables** with column headers: Field, Type, Notes
- **Cross-references to ARCHITECTURE.md** sections where relevant (use relative
  paths and section names)
- **No UI implementation details** — no Konva.js, no Vue, no localStorage, no
  animations, no search/filter logic, no feature flags

The document header must include:

- A reference document notice (not an execution prompt)
- Explicit subordination to `schema.ts` and `ARCHITECTURE.md`
- Change policy (requires DECISIONS.md entry)

---

## Behavioral Constraints (Hard Rules)

- One Work Packet only — `WP-043`
- No scope expansion
- No cross-WP implementation
- No TypeScript code in any form
- No modifications to any file under `packages/` or `apps/`
- Card field type convention must use `string | number | undefined` exactly
- MatchSetupConfig must list exactly 9 fields in the locked order
- PostgreSQL section must include Layer Boundary note
- §8 Authority Notes must explicitly state subordination to both `schema.ts`
  and `ARCHITECTURE.md`
- When referencing engine concepts (G, ctx, moves, phases, turn stages, CardExtId),
  use cross-links to the relevant WP or ARCHITECTURE.md section — do not define
  or explain them in the data contracts document
- Use real entry counts for metadata files (37 card types, 40 sets, 25 teams,
  5 classes, 7 icons)

---

## Test Expectations

**No tests are created, modified, or executed as part of this WP.**

- Prior test baseline: game-engine 72 tests passing — all must continue to pass
  (no package code is touched, so no test impact is expected)
- No test files may be created or modified
- No `pnpm test` execution is required for this documentation-only WP, but
  confirming no regressions with `pnpm --filter @legendary-arena/game-engine test`
  is recommended as a safety check

---

## EC-Mode Execution Rules

- All changes must map to **EC-043**
- No commit may be created without passing EC hooks
- If an EC step cannot be satisfied:
  - Stop
  - Report the failure
  - Do not improvise

---

## Execution Outcome Requirements

By the end of WP-043 execution:

- All EC-043 checklist items must pass
- `docs/ai/REFERENCE/00.2-data-requirements.md` exists with exactly 8 sections
- No UI concerns in the document (confirmed with `Select-String` or `grep`)
- Card field type convention (`string | number | undefined`) is documented
- Subordination to `schema.ts` and `ARCHITECTURE.md` is explicit in §8
- `ARCHITECTURE.md` contains adequate cross-reference to 00.2
- No files in `packages/` or `apps/` were modified
- No files outside the allowlist were modified (confirmed with `git diff --name-only`)
- `STATUS.md` updated
- `DECISIONS.md` updated with exclusion rationale
- `WORK_INDEX.md` has WP-043 checked off with today's date

---

## Verification Steps

```bash
# Step 1 — confirm data contracts document exists with all sections
test -f "docs/ai/REFERENCE/00.2-data-requirements.md" && echo "EXISTS" || echo "MISSING"
# Expected: EXISTS

grep -c "^## " docs/ai/REFERENCE/00.2-data-requirements.md
# Expected: 8 or more section headers

# Step 2 — confirm no UI concerns leaked in
grep -iE "localStorage|feature.?flag|animation|Konva|theme.*dark" \
  docs/ai/REFERENCE/00.2-data-requirements.md
# Expected: no output

# Step 3 — confirm card field type convention is correct
grep "string | number | undefined" docs/ai/REFERENCE/00.2-data-requirements.md
# Expected: at least one match (cost/attack/recruit/vAttack fields)

# Step 4 — confirm subordination to schema.ts is stated
grep "schema\.ts" docs/ai/REFERENCE/00.2-data-requirements.md
# Expected: at least one match

# Step 5 — confirm ARCHITECTURE.md cross-reference
grep "00\.2-data-requirements" docs/ai/ARCHITECTURE.md
# Expected: at least one match

# Step 6 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Allowed to Change

# Step 7 — confirm no package code was touched
git diff --name-only | grep -E "^(packages|apps)/" || echo "CLEAN"
# Expected: CLEAN
```

---

## Post-Execution Obligations (Do Not Skip)

After successful execution, but **before committing**:

- Run the **PRE-COMMIT-REVIEW template** (`docs/ai/prompts/PRE-COMMIT-REVIEW.template.md`)
  if it exists
- Confirm all updates are complete:
  - `docs/ai/STATUS.md` — data contracts reference exists; legacy 00.2 superseded
  - `docs/ai/DECISIONS.md` — why legacy §7/9/10/11/12 excluded; why subordinate
    to `schema.ts`
  - `docs/ai/work-packets/WORK_INDEX.md` — WP-043 checked off with date
- Commit using EC-mode hygiene rules (`EC-043:` prefix)

Execution is not considered complete until these steps are done.

---

## Final Instruction to Claude

This invocation is a **contract**, not a suggestion.

If there is any uncertainty about whether a change belongs in WP-043:

**DO NOT IMPLEMENT IT.**
