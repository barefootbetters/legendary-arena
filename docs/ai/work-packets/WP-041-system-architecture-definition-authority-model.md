# WP-041 — System Architecture Definition & Authority Model

**Status:** Ready  
**Primary Layer:** Core Architecture / System Definition / Authority Boundaries  
**Dependencies:** WP-040

---

## Session Context

WP-013 created `docs/ai/ARCHITECTURE.md` with the initial 5 sections covering
package boundaries, data flow, persistence, boardgame.io runtime, and
dependency rules. Subsequent packets (WP-014 through WP-040) incrementally
added content — field classification entries, MVP gameplay invariants, and
the Layer Boundary section. This packet performs a **formal architectural
review and consolidation** — ensuring ARCHITECTURE.md is complete,
internally consistent, and accurately reflects the system as built by all
40 prior packets. It does not invent new architecture — it formalizes what
exists.

---

## Goal

Formally review, consolidate, and version the system architecture document.
After this session:

- `docs/ai/ARCHITECTURE.md` is verified as complete and internally consistent
  against all WP-001 through WP-040 deliverables
- All Field Classification Reference entries are present and accurate
  (G fields added by WP-014 through WP-026)
- The authority model is explicit: engine authority, determinism guarantees,
  UI boundaries, network boundaries, content separation, campaign separation,
  live ops constraints
- The document is versioned with an explicit version stamp matching the
  current `EngineVersion` (WP-034)
- Any gaps, inconsistencies, or undocumented invariants found during review
  are corrected
- The document remains the authoritative system reference — higher authority
  than any individual Work Packet

---

## Assumes

- WP-040 complete. Specifically:
  - All WP-001 through WP-040 deliverables are in place
  - `docs/ai/ARCHITECTURE.md` exists with Sections 1-5 + MVP Gameplay
    Invariants + Layer Boundary
  - `docs/ai/DECISIONS.md` exists with all decisions D-0001 through D-1102
  - `.claude/rules/*.md` files exist and cross-reference ARCHITECTURE.md
  - `pnpm --filter @legendary-arena/game-engine build` exits 0
  - `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md` — read the **entire document**. This is the
  primary input to this packet. Every section must be verified against the
  code and Work Packets that established it.
- `.claude/CLAUDE.md` — read the authority hierarchy. ARCHITECTURE.md is #2
  in the hierarchy (after CLAUDE.md). This packet verifies that relationship
  is maintained.
- `.claude/rules/*.md` — read all 7 rules files. They must accurately
  cross-reference ARCHITECTURE.md. Any drift between rules files and
  architecture must be corrected (in the rules files, not in architecture).
- `docs/ai/DECISIONS.md` — read all decisions. Architecture must be consistent
  with every immutable decision.
- `docs/ai/work-packets/WORK_INDEX.md` — scan all completed/reviewed packets
  for G fields, types, and invariants that should be in ARCHITECTURE.md.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 6 (`// why:` on any
  architectural corrections made).

**Critical design note — review and consolidate, not invent:**
This packet audits and corrects. It does not introduce new architectural
concepts, new layers, new boundaries, or new invariants. If something is
missing from ARCHITECTURE.md but was established by a prior WP, it is added.
If something in ARCHITECTURE.md contradicts a prior WP or decision, the
higher authority wins.

---

## Non-Negotiable Constraints

**Packet-specific:**
- This packet produces a **documentation review and update** — no engine code
- ARCHITECTURE.md remains the **second-highest authority** (after CLAUDE.md)
- No new architectural concepts invented — only existing invariants formalized
- No weakening of existing constraints — only additions and corrections
- No removal of existing sections — only additions, corrections, and
  clarifications
- Any correction must reference the WP or Decision that established the
  correct version
- The document receives a version stamp matching `EngineVersion` format
- `.claude/rules/*.md` files are NOT modified in this packet — drift between
  rules and architecture is logged for a separate correction pass

**Session protocol:**
- If any inconsistency is found between ARCHITECTURE.md and a higher-authority
  document (CLAUDE.md, DECISIONS.md), stop and flag it before correcting

---

## Scope (In)

### A) Field Classification Reference — verify completeness

Verify that Section 3's Field Classification Reference table includes ALL
`G` fields established by WP-002 through WP-026:

- `playerZones` (WP-006A)
- `piles` (WP-006B)
- `villainDeck` (WP-014)
- `villainDeckCardTypes` (WP-014)
- `hookRegistry` (WP-009B)
- `currentStage` (WP-007B)
- `lobby` (WP-011)
- `messages` (WP-009B)
- `counters` (WP-010)
- `city` (WP-015)
- `hq` (WP-015)
- `ko` (WP-017)
- `attachedBystanders` (WP-017)
- `turnEconomy` (WP-018)
- `cardStats` (WP-018)
- `mastermind` (WP-019)
- `heroAbilityHooks` (WP-021)
- `cardKeywords` (WP-025)
- `schemeSetupInstructions` (WP-026)

Add any missing entries. All are Class 1 (Runtime).

### B) Authority model section — add if missing

If not already present, add a section documenting:
- The complete authority hierarchy (CLAUDE.md > ARCHITECTURE.md > rules >
  WORK_INDEX > WPs > conversation)
- The relationship between ARCHITECTURE.md and `.claude/rules/*.md`
- The relationship between ARCHITECTURE.md and DECISIONS.md

### C) Version stamp

Add a version stamp at the top of the document:
```
Architecture Version: 1.0.0
Last Reviewed: [date of this packet's execution]
Verified Against: WP-001 through WP-040
```

### D) Consistency audit

Review every section of ARCHITECTURE.md for:
- Accuracy against the code deliverables of WP-002 through WP-040
- Consistency with all DECISIONS.md entries
- Consistency with `.claude/rules/*.md` (log drift, do not fix rules files)
- No contradictions between sections

Document any findings in DECISIONS.md.

---

## Out of Scope

- **No new architectural concepts** — this is a review, not a design session
- **No `.claude/rules/*.md` modifications** — drift is logged, not fixed here
- **No engine code changes**
- **No Work Packet modifications** (other than WORK_INDEX.md)
- **No server, registry, or UI changes**
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Vision Alignment

> Per `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md §17`. Architecture
> consolidation must reflect the authority chain that now includes
> `01-VISION.md` (per `01.4-pre-flight-invocation.md` Authority Chain).

**Vision clauses touched:** §7, §8, §13, §14, §15

**Conflict assertion:** No conflict. WP-041 audits — does not redefine —
the authority hierarchy. The audit must verify that `01-VISION.md`
appears in the documented authority chain (CLAUDE.md > ARCHITECTURE.md >
01-VISION.md > rules > WORK_INDEX > WPs). If the current chain omits
01-VISION.md, that is the drift this audit must log; it is not a
license to remove the vision from authority.

**Non-Goal proximity:** N/A — WP touches no monetization or competitive
surface. (Audit only.)

**Determinism preservation:** N/A — audit only; no engine, RNG, scoring,
or replay code is modified. WP-041 verifies the Field Classification
table covers all 19 G fields without changing any of them.

---

## Files Expected to Change

- `docs/ai/ARCHITECTURE.md` — **modified** — Field Classification completeness,
  version stamp, authority model section (if missing), consistency corrections
- `docs/ai/DECISIONS.md` — **modified** — audit findings logged

No other files may be modified.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### Field Classification
- [ ] All 19 G fields listed in Scope (In) §A are present in the table
- [ ] All entries are Class 1 (Runtime)
- [ ] No stale or removed fields remain

### Authority Model
- [ ] Complete authority hierarchy is documented
- [ ] Relationship to `.claude/rules/*.md` is documented
- [ ] Relationship to DECISIONS.md is documented

### Version Stamp
- [ ] Architecture version stamp present at top of document
- [ ] "Verified Against" references WP-001 through WP-040

### Consistency
- [ ] No contradictions between ARCHITECTURE.md sections
- [ ] No contradictions with DECISIONS.md entries
- [ ] Any drift with `.claude/rules/*.md` is logged (not fixed)

### No Invention
- [ ] No new layers, boundaries, or invariants introduced
- [ ] All additions trace to existing WPs or Decisions

### Scope Enforcement
- [ ] No engine files modified
- [ ] No `.claude/rules/*.md` files modified
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — confirm Field Classification table has all 19 fields
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "playerZones|piles|villainDeck|villainDeckCardTypes|hookRegistry|currentStage|lobby|messages|counters|city|hq|ko|attachedBystanders|turnEconomy|cardStats|mastermind|heroAbilityHooks|cardKeywords|schemeSetupInstructions"
# Expected: at least 19 matches

# Step 2 — confirm version stamp
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "Architecture Version"
# Expected: at least one match

# Step 3 — confirm authority hierarchy documented
Select-String -Path "docs\ai\ARCHITECTURE.md" -Pattern "authority hierarchy|CLAUDE.md"
# Expected: at least one match

# Step 4 — confirm no engine files modified
git diff --name-only packages/ apps/
# Expected: no output

# Step 5 — confirm no rules files modified
git diff --name-only .claude/rules/
# Expected: no output

# Step 6 — confirm no files outside scope
git diff --name-only
# Expected: only docs/ai/ARCHITECTURE.md and docs/ai/DECISIONS.md
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
- [ ] All 19 G fields present in Field Classification table
- [ ] Version stamp present
- [ ] Authority hierarchy documented
- [ ] No contradictions found (or contradictions corrected with WP references)
- [ ] Any drift with `.claude/rules/*.md` logged in DECISIONS.md
- [ ] No engine files modified (confirmed with `git diff`)
- [ ] No `.claude/rules/*.md` files modified (confirmed with `git diff`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — architecture document formally reviewed,
      versioned, and verified against WP-001 through WP-040
- [ ] `docs/ai/DECISIONS.md` updated — any inconsistencies found during audit,
      drift between rules and architecture, corrections made with rationale
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-041 checked off with today's date
