# R-EC-02 — Fix Missing Required Fields in Card Data (Registry Hygiene)

**Source:** R2 validation findings (pnpm validate, 2026-04-09)
**Layer:** Registry / Data Quality

**Execution Authority:**
This EC is the authoritative execution checklist for R-EC-02.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of R-EC-02.

---

## Before Starting
- [ ] `pnpm validate` has been run and shows missing-field warnings
- [ ] Local `data/cards/` files have been inspected for the same issues

---

## Locked Values (do not re-derive)
- `vp` field on masterminds: integer, victory points when defeated (per 00.2 §1.3)
- `cost` field on hero cards: number (per 00.2 §1.2)
- `hc` field on hero cards: string, hero class (per 00.2 §1.2)

---

## Findings

### mgtg — Missing mastermind VP
- `ronan-the-accuser`: `vp: null` → should be `vp: 5`
- `ego-the-living-planet`: `vp: null` → should be `vp: 6`

### anni — Hero card missing cost/hc (NOT A BUG)
- `brainstorm` deck, card "Protege of Dr. Doom": `cost: undefined`, `hc: undefined`
  → This is the **back-face of a transform card** (the rarity-3 card's alternate side)
  → The record is minimal: only slug, name, imageUrl — no cost/hc/rarity/slot
  → This is expected behavior, not a data defect
  → The validation script warns about it, which is correct (the warning is informational)

---

## Guardrails
- Only modify the specific fields identified above
- Do not alter any other card data
- VP values must be sourced from the physical card game (not invented)
- After fixing, re-run `pnpm validate` to confirm warnings cleared

---

## Files to Fix
- `data/cards/mgtg.json` — **modified** — set vp on 2 masterminds
- `data/cards/anni.json` — **modified** — set cost and hc on 1 hero card

---

## After Completing
- [ ] `data/cards/mgtg.json` has `vp: 5` on ronan-the-accuser
- [ ] `data/cards/mgtg.json` has `vp: 6` on ego-the-living-planet
- [ ] `data/cards/anni.json` brainstorm "Protege of Dr. Doom" has cost and hc
- [ ] `pnpm validate` no longer warns about these fields
