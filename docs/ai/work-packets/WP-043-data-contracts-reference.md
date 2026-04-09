# WP-043 — Data Contracts Reference (Canonical Card & Metadata Shapes)

**Status:** Ready
**Primary Layer:** Registry / Contracts
**Dependencies:** WP-003

---

## Session Context

WP-003 fixed the two confirmed registry defects (wrong fetch URL, narrow
`FlatCard.cost` type) and established `packages/registry/src/schema.ts` as
the single source of truth for field shapes. The legacy document
`docs/prompts-legendary-area-game/00.2-data-requirements.md` contains detailed
card data shapes, metadata lookup shapes, image URL construction rules, and
ability text markup that are not yet captured in the governed documentation
system. This packet migrates that reference material into a governed,
auditable data contracts document.

---

## Goal

Create a canonical data contracts reference document that captures the card
and metadata shapes, image URL conventions, and ability text markup language
from the legacy 00.2 document. After this session:

- A governed `docs/ai/REFERENCE/00.2-data-requirements.md` exists (replacing
  the legacy prompt version) with all card, metadata, and image URL contracts
- The document is clearly subordinate to `ARCHITECTURE.md` and
  `packages/registry/src/schema.ts`
- Architectural rules already captured in `ARCHITECTURE.md` are referenced,
  not restated
- Engine contracts already locked by existing WPs are referenced, not re-encoded
- UI-specific concerns (search/filter, preferences, feature flags) are excluded

---

## Assumes

- WP-003 complete. Specifically:
  - `packages/registry/src/schema.ts` is the authoritative Zod schema source
  - `FlatCard.cost` is `string | number | undefined`
  - `httpRegistry.ts` fetches `sets.json` (not `card-types.json`)
- `docs/ai/ARCHITECTURE.md` exists (created in WP-013) and documents:
  - Registry Metadata File Shapes (sets.json vs card-types.json)
  - Card Field Data Quality (string | number | undefined convention)
  - Zone & Pile Structure (CardExtId strings only)
  - Persistence Boundaries (G never persisted)
  - MatchSetupConfig (9 locked fields)
- `docs/ai/DECISIONS.md` exists (created in WP-002)

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Section 2` — read "Registry Metadata File Shapes",
  "Card Field Data Quality", and "Card Data Flow: Registry into Game Engine".
  These sections already govern key data conventions. The new reference document
  must not contradict or restate them — it should reference them.
- `docs/ai/ARCHITECTURE.md §Section 3` — persistence boundaries. The reference
  document must clearly mark what is runtime-only vs what may be persisted.
- `docs/ai/ARCHITECTURE.md — "Layer Boundary (Authoritative)"` — the data
  contracts document describes registry-layer data shapes. It must not encode
  engine logic, server startup procedures, or UI implementation.
- `packages/registry/src/schema.ts` — the authoritative Zod schemas. The
  reference document describes the shapes for human consumption; the Zod
  schemas are the machine-enforced source of truth. If they differ, the Zod
  schemas win.
- `docs/prompts-legendary-area-game/00.2-data-requirements.md` — the legacy
  source. Sections 1-6 and 8.1 are in scope. Sections 7 (user deck data),
  9 (search/filter), 10 (user/preferences), 11 (app configuration), and
  12 (export) are UI concerns and out of scope.

---

## Non-Negotiable Constraints

**Applicable constraints:**
- This packet produces a **reference document**, not TypeScript code
- No modifications to `packages/registry/src/` — the Zod schemas are
  authoritative and already correct
- No modifications to `packages/game-engine/` — engine contracts are locked
  by their respective WPs
- No modifications to `apps/server/` — server wiring is not a data contract
  concern
- The reference document is subordinate to `ARCHITECTURE.md` and `schema.ts`

**Packet-specific:**
- Do NOT restate architectural rules (persistence boundaries, G never persisted,
  MatchSetupConfig 9 fields) — reference the relevant ARCHITECTURE.md section
- Do NOT restate engine conventions (CardExtId, zone contents, move validation)
  — reference the relevant WP
- Do NOT include UI-specific concerns (search/filter logic, user preferences,
  feature flags, app configuration, animations)
- Do NOT include deployment procedures — those are in WP-042
- The ability text markup language (§5 from legacy) IS in scope — it is a
  data contract for parsing card ability text, not a UI concern
- Image URL construction rules ARE in scope — they define how image paths
  map to card data
- The PostgreSQL table overview IS in scope as a data contract reference,
  but must note that PostgreSQL is server-layer and reference the Layer
  Boundary

**Session protocol:**
- If a field name, shape, or convention appears to conflict with `schema.ts`
  or ARCHITECTURE.md, stop and flag it — do not silently carry the conflict
  forward

**Locked contract values:**

- **MatchSetupConfig fields** (reference only — defined in WP-005A):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **Card field type convention** (from WP-003):
  `cost`, `attack`, `recruit`, `vAttack` are `string | number | undefined`

- **legendary.\* namespace:**
  All PostgreSQL tables in `legendary.*` schema. PKs use `bigserial`.
  Cross-service IDs use `ext_id text`.

---

## Scope (In)

### A) `docs/ai/REFERENCE/00.2-data-requirements.md` — new (replaces legacy)

A governed reference document with the following sections:

- **§1 — Card Data Shapes** — per-set JSON structure, hero deck shape (with
  field reference table), mastermind shape (with tactic/epic distinction and
  `vAttack` string convention), villain group shape (with `ledBy` inverse
  relationship), scheme shape (with transform card note), henchman shape,
  bystander/wound/other shapes
- **§2 — Metadata Lookups** — shapes for all 6 metadata files:
  `card-types.json` (37 types with full taxonomy table), `sets.json` (40 sets),
  `hero-teams.json` (25 teams), `hero-classes.json` (5 classes),
  `icons-meta.json` (7 icons), `leads.json` (mastermind-villain relationships).
  Each with field reference tables.
  Cross-reference to ARCHITECTURE.md "Registry Metadata File Shapes" for the
  critical sets.json vs card-types.json distinction.
- **§3 — Image & Asset Conventions** — R2 base URL, image URL construction
  patterns (with real examples), image naming convention table by card type,
  hero card suffix encoding (cost + rarity), `metadata/sets.json` registry manifest
- **§4 — PostgreSQL Schema Reference** — table inventory with purposes,
  key foreign keys, `ext_id` convention, what PostgreSQL stores vs what stays
  in R2. Note: "PostgreSQL is server-layer; see Layer Boundary."
- **§5 — Ability Text Markup Language** — bracket notation tokens
  (`[keyword:X]`, `[icon:X]`, `[hc:X]`, `[team:X]`, `[rule:X]`) with
  resolution targets, parsing notes, `[object Object]` data quality warning
- **§6 — Mastermind-Villain Group Relationship** — three-level model
  (per-set JSON, leads.json, PostgreSQL), special cases (any villain group,
  henchmen leads, unassigned groups)
- **§7 — Match Configuration** — reference to ARCHITECTURE.md §Section 2
  "Match Lifecycle" and WP-005A for the 9 locked fields. One paragraph, not
  a restatement.
- **§8 — Authority Notes** — explicit subordination: this document is a
  human-readable reference. `schema.ts` is the machine-enforced source of
  truth. `ARCHITECTURE.md` governs persistence, layer boundaries, and engine
  contracts.

Each section must include:
- Actual JSON shapes from real data (not aspirational)
- Field reference tables with types and notes
- Cross-references to ARCHITECTURE.md sections where relevant
- No UI implementation details

### B) Update ARCHITECTURE.md cross-reference

Add a one-line reference in `docs/ai/ARCHITECTURE.md §Section 2` noting:
"Canonical card and metadata shapes are documented in
`docs/ai/REFERENCE/00.2-data-requirements.md`."

---

## Out of Scope

- **No user deck data (legacy §7)** — user-generated deck data is a future
  feature, not a current data contract
- **No search/filter logic (legacy §9)** — UI-layer concern; derived at runtime
- **No user preferences (legacy §10)** — UI-layer; `localStorage` is not a
  data contract
- **No app configuration / feature flags (legacy §11)** — UI-layer
- **No export/interoperability (legacy §12)** — future feature
- **No deployment checklists** — covered by WP-042
- **No modifications to `packages/registry/src/`** — Zod schemas are correct
- **No modifications to `packages/game-engine/`** — engine contracts are locked
- **No modifications to `apps/server/`** — server wiring is not in scope
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**

---

## Files Expected to Change

- `docs/ai/REFERENCE/00.2-data-requirements.md` — **new** — governed data
  contracts reference (replaces legacy prompt version)
- `docs/ai/ARCHITECTURE.md` — **modified** — one-line cross-reference to the
  new reference document

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Data Contracts Document
- [ ] `docs/ai/REFERENCE/00.2-data-requirements.md` exists with all 8 sections
      from Scope (In) §A
- [ ] §1 contains hero deck shape with field reference table including
      `cost: string | number | undefined` convention
- [ ] §1 contains mastermind shape with `vAttack: string | number` convention
- [ ] §2 contains all 6 metadata file shapes with entry counts
- [ ] §2 references ARCHITECTURE.md "Registry Metadata File Shapes" for the
      sets.json vs card-types.json distinction
- [ ] §3 contains image URL construction patterns with real examples
- [ ] §4 contains PostgreSQL table inventory with Layer Boundary note
- [ ] §5 contains all 5 ability text markup token types
- [ ] §8 contains explicit subordination to `schema.ts` and `ARCHITECTURE.md`
- [ ] Document does not contain UI preferences, feature flags, or search logic
      (confirmed with `Select-String`)
- [ ] Document does not restate persistence boundaries — references
      ARCHITECTURE.md instead

### Layer Boundary Compliance
- [ ] No engine concepts (G, ctx, moves, phases, turn stages) are defined in
      the document — only referenced via cross-links
- [ ] PostgreSQL section notes server-layer ownership
- [ ] No UI implementation details (Konva.js, Vue, localStorage, animations)

### Cross-References
- [ ] `docs/ai/ARCHITECTURE.md` contains a reference to
      `docs/ai/REFERENCE/00.2-data-requirements.md`

### Scope Enforcement
- [ ] No files in `packages/` or `apps/` were modified
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — confirm data contracts document exists with all sections
Test-Path "docs\ai\REFERENCE\00.2-data-requirements.md"
# Expected: True

Select-String -Path "docs\ai\REFERENCE\00.2-data-requirements.md" -Pattern "^## "
# Expected: 8+ section headers

# Step 2 — confirm no UI concerns leaked in
Select-String -Path "docs\ai\REFERENCE\00.2-data-requirements.md" -Pattern "localStorage|feature.?flag|animation|Konva|theme.*dark"
# Expected: no output

# Step 3 — confirm card field type convention is correct
Select-String -Path "docs\ai\REFERENCE\00.2-data-requirements.md" -Pattern "string \| number \| undefined"
# Expected: at least one match (cost/attack/recruit/vAttack fields)

# Step 4 — confirm subordination to schema.ts is stated
Select-String -Path "docs\ai\REFERENCE\00.2-data-requirements.md" -Pattern "schema\.ts"
# Expected: at least one match

# Step 5 — confirm ARCHITECTURE.md cross-reference
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "00\.2-data-requirements"
# Expected: at least one match

# Step 6 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

> Claude Code must execute every verification command in `## Verification Steps`
> before checking any item below. Reading the code is not sufficient — run the
> commands.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `docs/ai/REFERENCE/00.2-data-requirements.md` exists with all 8 sections
- [ ] No UI concerns in the document (confirmed with `Select-String`)
- [ ] Card field type convention (`string | number | undefined`) is documented
- [ ] Subordination to `schema.ts` and `ARCHITECTURE.md` is explicit
- [ ] `docs/ai/ARCHITECTURE.md` updated with cross-reference
- [ ] No files in `packages/` or `apps/` were modified
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — data contracts reference exists; legacy
      00.2 is superseded
- [ ] `docs/ai/DECISIONS.md` updated — at minimum: why legacy §7/9/10/11/12
      were excluded (UI concerns per Layer Boundary); why this is a reference
      document subordinate to schema.ts rather than a replacement for it
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-043 checked off with today's date
