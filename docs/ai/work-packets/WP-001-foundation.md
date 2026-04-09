# WP-001 — Foundation & Coordination System

**Status:** Complete
**Primary Layer:** Documentation / Coordination System
**Dependencies:** None — this is the first packet in the sequence

---

## Session Context

This is the first Work Packet. There are no prior packets to reference.
All subsequent Claude Code sessions — WP-002 through WP-040 — operate on the
coordination system and REFERENCE documents this packet establishes. Context
drift (sessions re-deriving settled decisions from chat history rather than from
authoritative files) was the primary failure mode this packet was designed to
eliminate.

---

## Goal

Establish the repo-as-memory AI development system for Legendary Arena so that
all subsequent Claude Code sessions operate from a single authoritative set of
documents rather than from chat history.

After this packet, every REFERENCE file in `docs/ai/REFERENCE/` has a
consistent coordination header, correct override hierarchy, accurate field names,
and all required Work Packet sections — eliminating context drift as the primary
failure mode across 15+ sessions.

---

## Assumes

- Repository exists at `C:\pcloud\BB\DEV\legendary-arena`
- The problem of context drift across 15+ Claude Code sessions is understood
- Human review and sign-off replaces automated acceptance — this is a
  documentation and coordination packet, not a code packet
- `docs/ai/ARCHITECTURE.md` does **not** exist yet — it is created in WP-013.
  Use `00.1` and `00.2` as the architectural references for this packet.
- `docs/ai/STATUS.md` and `docs/ai/DECISIONS.md` do **not** exist yet —
  they are created at the start of WP-002

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before making any change:

- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — the coordination
  system itself; the primary output of this packet. Read the existing file (if
  present) to understand what already exists before rewriting it.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — the data requirements
  reference. Read it entirely to identify stale field names (`strikeCount`,
  `expansions`, `db/migrations/`), wrong namespace usage, and incorrect image
  URL patterns before correcting them.
- `data/legendary_library_schema.sql` — the canonical schema file. This is the
  ground truth for table names, field names, and PK types. Any REFERENCE doc
  that conflicts with it must be corrected to match the schema, not the other
  way around.

---

## Non-Negotiable Constraints

**Documentation-pass constraints (apply to this packet — do not remove):**
- No code changes to any application, package, or script
- No database changes of any kind
- No infrastructure deployment or modification
- No execution of any prompt in `docs/ai/REFERENCE/`
- Human review and sign-off replaces automated acceptance for all changes
- All corrections must match the real codebase state — do not invent or assume
  field names, table names, or file paths that are not in the actual files

**Data contract corrections (must be applied to all REFERENCE docs):**
- All PostgreSQL tables use the `legendary.*` schema namespace — never bare
  table names (`sets`, `cards`) without the namespace prefix
- Primary keys use `bigserial` — never `serial` or `integer`
- The `vp` field on masterminds — never `strikeCount` (which does not exist
  in the real schema)
- Cross-service identifiers use `ext_id text` columns — never numeric foreign
  keys across service boundaries
- Image URLs in R2 use hyphens, not underscores (`/cards/mdns-001.webp` not
  `/cards/mdns_001.webp`)
- Migration files live in `data/migrations/` — never `db/migrations/`

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human
  before proceeding — never guess or invent field names, table names, or file
  paths

**Locked contract values (inline the relevant ones — do not paraphrase or
re-derive from memory; delete rows that do not apply to this packet):**

- **legendary.\* namespace** (this packet corrects all REFERENCE docs to use it):
  All PostgreSQL tables live in the `legendary.*` schema (e.g.,
  `legendary.rules`, `legendary.sets`, `legendary.cards`). PKs use `bigserial`.
  Cross-service identifiers use `ext_id text`. Migration files live in
  `data/migrations/` — never `db/migrations/`.

---

## Scope (In)

All files under `docs/ai/REFERENCE/`:

| File | Change |
|------|--------|
| `00.1-master-coordination-prompt.md` | Rewritten — repo-as-memory system, override hierarchy, Work Packet template, session protocol, drift detection |
| `00.2-data-requirements.md` | Updated header, `legendary.*` schema namespace, `bigserial` PKs, `vp` field (not `strikeCount`), image URL patterns aligned with real R2 examples |
| `00.3-prompt-lint-checklist.md` | Expanded — 28 Final Gate items, §16 code style section, all new WP structure sections, drift detection footer |
| `00.4-connection-health-check.md` | Updated — all WP sections, `node:` prefix, fixed REQUIRED_VARS count (9), ESM-compatible JWT generation |
| `00.5-validation.md` | Updated — all WP sections, image URL patterns fixed (hyphens not underscores), structural checks use real 00.2 fields |
| `00.6-code-style.md` | Updated — Rules 13–15 added (ESM-only, data contract alignment, async error handling), `strikeCount` → `vp` in examples, enforcement mapping table |
| `01-render-infrastructure.md` | Updated — all WP sections, `legendary.*` tables, `bigserial` PKs, `node:` prefix, reads real schema files |
| `02-database-migrations.md` | Updated — all WP sections, `data/migrations/` directory (not `db/`), `ext_id text` references, `legendary.*` namespace |

Work Packet files created or updated:

| File | Change |
|------|--------|
| `work-packets/WORK_INDEX.md` | Created — Foundation Prompts table, phase structure, dependency chain, procedure for adding packets |
| `work-packets/WP-001-foundation.md` | Created — this file |

---

## Out of Scope

- No code changes to any application, package, or script
- No database changes
- No infrastructure deployment
- No execution of any prompt in `docs/ai/REFERENCE/`
- No changes to `packages/`, `apps/`, or `data/`
- Refactors, cleanups, or "while I'm here" improvements are **out of scope**
  unless explicitly listed in Scope (In) above

---

## Files Expected to Change

All files listed in the Scope table above — REFERENCE docs and Work Packet files.
No application source files, no `data/`, no `apps/`, no `packages/`.

---

## Acceptance Criteria

All items must be binary pass/fail. No partial credit.

### REFERENCE Docs
- [x] All REFERENCE docs have a coordination system `>` blockquote header
- [x] `00.2-data-requirements.md` uses `legendary.*` namespace, `bigserial` PKs,
      `vp` field on masterminds, correct image URL patterns (hyphens not underscores)
- [x] `00.3-prompt-lint-checklist.md` Final Gate has 28 rows; §16 covers all
      code style rules from `00.6`
- [x] `00.6-code-style.md` has Rules 1–15 with enforcement mapping table

### WORK_INDEX
- [x] `work-packets/WORK_INDEX.md` exists with all Work Packets listed

### Scope Enforcement
- [x] No phantom table names (`expansions`, `setup_rules`) appear in any REFERENCE file
- [x] No `strikeCount` field appears in any REFERENCE file
      (replaced by `vp` per the real `data/legendary_library_schema.sql`)
- [x] No `require()` or `db/migrations/` appear as patterns in any REFERENCE file
- [x] No files outside `## Files Expected to Change` were modified

---

## Verification Steps

This packet is human-reviewed. There are no automated build or test commands.

```
Spot-check procedure:

1. Open 00.2-data-requirements.md — grep for 'strikeCount'
   Expected: no matches

2. Open 00.3-prompt-lint-checklist.md — count Final Gate table rows
   Expected: 28 rows

3. Open 00.6-code-style.md — confirm Rules 13, 14, 15 exist
   Expected: all three rules present with enforcement mapping table

4. Open work-packets/WORK_INDEX.md — confirm Foundation Prompts table
   and all Work Packets are listed
   Expected: Foundation Prompts table present; all WP entries present

5. Open any WP file (e.g., WP-002-game-skeleton.md) — confirm Context
   references existing files, not nonexistent PROJECT_BRIEF.md
   Expected: all referenced files exist on disk
```

---

## Definition of Done

> Human reviewer must complete every spot-check in `## Verification Steps`
> before checking any item below. Visual inspection alone is not sufficient —
> open the files and verify the content.
>
> Every item must be true before this packet is considered complete.

This packet is complete when ALL of the following are true:

- [x] All acceptance criteria above pass
- [x] All REFERENCE files updated and reviewed by human developer
- [x] `work-packets/WORK_INDEX.md` created and reviewed
- [x] `work-packets/WP-001-foundation.md` (this file) documents the completed work
- [x] No files outside `## Files Expected to Change` were modified
- [ ] `docs/ai/STATUS.md` — to be created at the start of WP-002
- [ ] `docs/ai/DECISIONS.md` — to be created at the start of WP-002
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-001 checked off with today's date

---

*Completed: this coordination session (see git log for date)*
