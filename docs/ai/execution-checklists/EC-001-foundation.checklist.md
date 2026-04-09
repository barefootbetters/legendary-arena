# EC-001 — Foundation & Coordination System (Execution Checklist)

**Source:** docs/ai/work-packets/WP-001-foundation.md
**Layer:** Documentation / Coordination System

## Before Starting
- [ ] Repository exists at `C:\pcloud\BB\DEV\legendary-arena`
- [ ] `docs/ai/ARCHITECTURE.md` does NOT exist yet (created in WP-013)
- [ ] `docs/ai/STATUS.md` and `docs/ai/DECISIONS.md` do NOT exist yet (created in WP-002)
- [ ] `data/legendary_library_schema.sql` exists (ground truth for table/field names)

## Locked Values (do not re-derive)
- `legendary.*` schema namespace on all PostgreSQL tables (e.g., `legendary.rules`, `legendary.sets`, `legendary.cards`)
- PKs use `bigserial` — never `serial` or `integer`
- `vp` field on masterminds — never `strikeCount`
- Cross-service identifiers use `ext_id text` — never numeric foreign keys across service boundaries
- Image URLs use hyphens: `/cards/mdns-001.webp` — never underscores
- Migration files in `data/migrations/` — never `db/migrations/`

## Guardrails
- No code changes to any application, package, or script
- No database changes of any kind
- No infrastructure deployment or modification
- No execution of any prompt in `docs/ai/REFERENCE/`
- All corrections must match real codebase state — never invent field/table names
- Human review and sign-off replaces automated acceptance
- If any contract or reference is unclear, stop and ask — never guess

## Required `// why:` Comments
- N/A — this is a documentation-only packet; no code produced

## Files to Produce
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — **rewritten**
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **updated**
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — **expanded**
- `docs/ai/REFERENCE/00.4-connection-health-check.md` — **updated**
- `docs/ai/REFERENCE/00.5-validation.md` — **updated**
- `docs/ai/REFERENCE/00.6-code-style.md` — **updated**
- `docs/ai/REFERENCE/01-render-infrastructure.md` — **updated**
- `docs/ai/REFERENCE/02-database-migrations.md` — **updated**
- `docs/ai/work-packets/WORK_INDEX.md` — **new**
- `docs/ai/work-packets/WP-001-foundation.md` — **new**

## After Completing
- [ ] All REFERENCE docs have coordination system blockquote header
- [ ] No `strikeCount` in any REFERENCE file
- [ ] No `require()` or `db/migrations/` patterns in any REFERENCE file
- [ ] No phantom table names (`expansions`, `setup_rules`) in any REFERENCE file
- [ ] `WORK_INDEX.md` created with all WPs listed
- [ ] No files outside scope were modified
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-001 checked off with date
