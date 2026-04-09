# R-EC-01 — Fix [object Object] Abilities in R2 Data (Registry Hygiene)

**Source:** R2 validation findings (pnpm validate, 2026-04-09)
**Layer:** Registry / Data Quality

**Execution Authority:**
This EC is the authoritative execution checklist for R-EC-01.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of R-EC-01.

---

## Before Starting
- [ ] `pnpm validate` has been run and shows `[object Object]` warnings
- [ ] Local `data/cards/` files do NOT have the issue (confirmed: local data is clean)
- [ ] The issue exists only in R2 metadata JSON (pipeline serialization bug)

---

## Scope
- The `[object Object]` abilities exist in R2 at `metadata/{abbr}.json`
- Affected sets: msmc (12 cards), bkpt (11 cards), msis (3 cards)
- The local `data/cards/*.json` files have correct string abilities
- This is a **data re-upload issue**, not a code fix

---

## Guardrails
- Do NOT modify `data/cards/*.json` — local data is correct
- Do NOT invent ability text — the correct text is in the local files
- The fix requires re-running the data pipeline that generates R2 metadata
- Until re-upload, the game engine must handle `[object Object]` gracefully

---

## Resolution
- [ ] Identify the pipeline step that serializes abilities to R2 metadata
- [ ] Re-run the pipeline for affected sets: msmc, bkpt, msis
- [ ] Re-upload the corrected metadata to R2
- [ ] Re-run `pnpm validate` — zero `[object Object]` warnings expected

---

## Status
**Deferred** — requires R2 upload pipeline execution. Not blocking EC-002.
The game engine (WP-003+) handles this via the registry's Zod schemas
which treat abilities as `string[]` and will reject non-string entries.
