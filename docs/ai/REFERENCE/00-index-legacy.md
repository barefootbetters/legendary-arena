# 00-index — Legacy Prompt Sequence Index (HISTORICAL)

> **NON-AUTHORITATIVE — This document is a historical archive only.**
>
> This file preserves the original prompt sequence index from the legacy
> prompt system (`docs/prompts-legendary-area-game/00-index.md`). It is
> retained for reference purposes only.
>
> **This document has NO authority.** All responsibilities it once held
> have been relocated to governed documents:
>
> | Former responsibility | Now governed by |
> |---|---|
> | Execution order & dependencies | `docs/ai/work-packets/WORK_INDEX.md` |
> | System architecture & boundaries | `docs/ai/ARCHITECTURE.md` |
> | Output contract & execution discipline | `.claude/CLAUDE.md` (Lint Gate) |
> | Work Packet quality gate | `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` |
> | Code style standard | `docs/ai/REFERENCE/00.6-code-style.md` |
> | Data contracts | `docs/ai/REFERENCE/00.2-data-requirements.md` |
> | Deployment checklists | WP-042 |
> | Connection health check | `docs/ai/REFERENCE/00.4-connection-health-check.md` |
> | R2 validation | `docs/ai/REFERENCE/00.5-validation.md` |
>
> **Do NOT use this document to determine execution order, phase definitions,
> or architectural boundaries.** Use `WORK_INDEX.md` and `ARCHITECTURE.md`.
>
> **Prompt-style numbering (00.x, 01-13) is superseded** by the Work Packet
> system (WP-001 through WP-047+). Legacy prompt numbers appear in this
> archive for traceability only.

---

## Original Prompt Map (Historical)

The following table records the legacy prompt sequence as it existed before
migration to the Work Packet system. It is preserved for traceability.

| # | File | Phase | Builds On | Status |
|---|---|---|---|---|
| 00.2 | `00.2-data-requirements.md` | Meta | — | Migrated to WP-043 |
| 00.2b | `00.2b-deployment-checklists.md` | Meta | 00.2 | Migrated to WP-042 |
| 00.3 | `00.3-prompt-lint-checklist.md` | Meta | — | Governed: `docs/ai/REFERENCE/00.3-*`, aligned by WP-044 |
| 00.4 | `00.4-connection-health-check.md` | Diagnostics | — | Governed: `docs/ai/REFERENCE/00.4-*`, aligned by WP-045 |
| 00.5 | `00.5-r2-validation.md` | Diagnostics | 00.4 | Governed: `docs/ai/REFERENCE/00.5-*`, aligned by WP-046 |
| 00.6 | `00.6-code-style.md` | Meta | — | Governed: `docs/ai/REFERENCE/00.6-*`, aligned by WP-047 |
| 01 | `01-render-infrastructure.md` | Infrastructure | 00.4, 00.5 | Governed: `docs/ai/REFERENCE/01-*` |
| 02 | `02-database-migrations.md` | Infrastructure | 01 | Governed: `docs/ai/REFERENCE/02-*` |
| 03 | `03-game-seed-data.md` | Data | 01, 02 | Legacy — not yet migrated |
| 04 | `04-game-rules-engine.md` | Game Logic | 01, 03 | Superseded by WP-002 through WP-014 |
| 05 | `05-deck-construction.md` | Game Logic | 04 | Superseded by WP-005A/005B |
| 06 | `06-lobby-server.md` | Multiplayer | 01, 04, 05 | Superseded by WP-011 |
| 07 | `07-player-identity.md` | Auth | 06 | Legacy — not yet migrated |
| 08 | `08-vue-client.md` | Frontend | 06 | Legacy — not yet migrated |
| 09 | `09-game-board-ui.md` | Frontend | 08 | Legacy — not yet migrated |
| 10 | `10-lobby-ui.md` | Frontend | 08 | Legacy — not yet migrated |
| 11 | `11-game-testing.md` | Quality | 04, 05 | Legacy — not yet migrated |
| 12 | `12-cicd-deployment.md` | Operations | All | Legacy — not yet migrated |
| 13 | `13-gameboard-canvas.md` | Canvas | 08, 09 | Legacy — not yet migrated |

---

## Original Version History (Historical)

- `v1.0` — Initial prompt set
- `v1.1` — Contract standardization, typo fixes, expanded checks
- `v1.2` — Added 00.6 code style, §13 to lint checklist, style mandates to all prompts
- `v1.3` — Added Prompt 13 (Konva.js canvas)
- `v1.4` — Added 00.2 data requirements and 00.2b deployment checklists

---

*This document was archived during the migration to the governed Work Packet
system. It is not maintained and will not be updated.*
