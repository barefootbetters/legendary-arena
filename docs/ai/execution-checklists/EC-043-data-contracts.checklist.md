# EC-043 — Data Contracts Reference (Execution Checklist)

**Source:** docs/ai/work-packets/WP-043-data-contracts-reference.md
**Layer:** Registry / Contracts (Documentation)

**Execution Authority:**
This EC is the authoritative execution checklist for WP-043.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-043.

---

## Before Starting

- [ ] WP-003 complete: `schema.ts` is authoritative; `FlatCard.cost` is `string | number | undefined`
- [ ] `docs/ai/ARCHITECTURE.md` exists with Registry Metadata File Shapes, Card Field Data Quality, Zone & Pile Structure, Persistence Boundaries, MatchSetupConfig
- [ ] `packages/registry/src/schema.ts` exists (machine-enforced source of truth)
- [ ] `docs/ai/DECISIONS.md` exists

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-043.
If formatting, spelling, or ordering differs, the implementation is invalid.

- **MatchSetupConfig fields** (reference only — defined in WP-005A):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **Card field type convention** (from WP-003):
  `cost`, `attack`, `recruit`, `vAttack` are `string | number | undefined`

- **`legendary.*` namespace:**
  All PostgreSQL tables in `legendary.*` schema. PKs use `bigserial`.
  Cross-service IDs use `ext_id text`.

---

## Guardrails

- This is a reference document — no TypeScript code produced
- No modifications to `packages/registry/src/` — Zod schemas are authoritative
- No modifications to `packages/game-engine/` — engine contracts locked by their WPs
- No modifications to `apps/server/`
- Do NOT restate architectural rules — reference ARCHITECTURE.md sections instead
- Do NOT restate engine conventions (CardExtId, zone contents) — reference the relevant WP
- Do NOT include UI concerns (search/filter, preferences, feature flags, animations)
- Document is subordinate to `ARCHITECTURE.md` and `schema.ts`

---

## Required `// why:` Comments

- N/A — documentation-only packet

---

## Files to Produce

- `docs/ai/REFERENCE/00.2-data-requirements.md` — **new** — 8 sections covering card shapes, metadata, images, PostgreSQL, ability text, mastermind-villain, match config, authority notes
- `docs/ai/ARCHITECTURE.md` — **modified** — one-line cross-reference to new 00.2

---

## After Completing

- [ ] `docs/ai/REFERENCE/00.2-data-requirements.md` exists with all 8 sections
- [ ] No UI concerns in document (no localStorage, feature flags, animations)
- [ ] Card field type convention (`string | number | undefined`) documented
- [ ] Subordination to `schema.ts` and `ARCHITECTURE.md` is explicit
- [ ] `ARCHITECTURE.md` contains cross-reference to 00.2
- [ ] No files in `packages/` or `apps/` were modified
- [ ] `docs/ai/STATUS.md` updated
- [ ] `docs/ai/DECISIONS.md` updated
      (why legacy sections excluded; subordination to schema.ts)
- [ ] `docs/ai/work-packets/WORK_INDEX.md`
      WP-043 checked off with date
