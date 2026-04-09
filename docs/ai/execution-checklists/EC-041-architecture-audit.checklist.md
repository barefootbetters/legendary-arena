# EC-041 — System Architecture Definition & Authority Model (Execution Checklist)

**Source:** docs/ai/work-packets/WP-041-system-architecture-definition-authority-model.md
**Layer:** Core Architecture / Documentation

**Execution Authority:**
This EC is the authoritative execution checklist for WP-041.
Implementation must satisfy every clause exactly.
Failure to satisfy any item below is a failed execution of WP-041.

---

## Before Starting

- [ ] WP-040 complete: all WP-001 through WP-040 deliverables in place
- [ ] `docs/ai/ARCHITECTURE.md` exists with Sections 1-5, MVP Gameplay Invariants, Layer Boundary
- [ ] `docs/ai/DECISIONS.md` exists with all decisions D-0001 through D-1102
- [ ] `.claude/rules/*.md` files exist and cross-reference ARCHITECTURE.md
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0

---

## Locked Values (do not re-derive)

All items below must be copied verbatim from WP-041.
If formatting, spelling, or ordering differs, the implementation is invalid.

- 19 G fields to verify in Field Classification table:
  `playerZones` (WP-006A), `piles` (WP-006B), `villainDeck` (WP-014),
  `villainDeckCardTypes` (WP-014), `hookRegistry` (WP-009B),
  `currentStage` (WP-007B), `lobby` (WP-011), `messages` (WP-009B),
  `counters` (WP-010), `city` (WP-015), `hq` (WP-015), `ko` (WP-017),
  `attachedBystanders` (WP-017), `turnEconomy` (WP-018),
  `cardStats` (WP-018), `mastermind` (WP-019),
  `heroAbilityHooks` (WP-021), `cardKeywords` (WP-025),
  `schemeSetupInstructions` (WP-026)
- All 19 fields are Class 1 (Runtime)
- Authority hierarchy: CLAUDE.md > ARCHITECTURE.md > rules > WORK_INDEX > WPs > conversation
- Architecture version stamp format: `Architecture Version: 1.0.0`
- Verified against: WP-001 through WP-040

---

## Guardrails

- Review and consolidate only — do NOT invent new architecture
- No new layers, boundaries, or invariants introduced
- No weakening of existing constraints — additions and corrections only
- No removal of existing sections
- `.claude/rules/*.md` files are NOT modified — drift is logged, not fixed
- No engine code changes
- Any correction must reference the WP or Decision that established the correct version

---

## Required `// why:` Comments

- None — this packet modifies documentation only

---

## Files to Produce

- `docs/ai/ARCHITECTURE.md` — **modified** — Field Classification completeness, version stamp, authority model, consistency corrections
- `docs/ai/DECISIONS.md` — **modified** — audit findings logged

---

## Common Failure Smells (Optional)

- New architectural concepts invented instead of documenting existing ones
- `.claude/rules/*.md` files modified instead of logging drift
- Missing G fields in Field Classification table
- Authority hierarchy not explicitly documented

---

## After Completing

- [ ] All 19 G fields present in Field Classification table
- [ ] Version stamp present at top of ARCHITECTURE.md
- [ ] Authority hierarchy documented in ARCHITECTURE.md
- [ ] No contradictions found (or corrected with WP references)
- [ ] Drift with `.claude/rules/*.md` logged in DECISIONS.md (not fixed)
- [ ] No engine files modified (confirmed with `git diff`)
- [ ] No `.claude/rules/*.md` files modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated
      (architecture formally reviewed and versioned)
- [ ] `docs/ai/DECISIONS.md` updated
      (inconsistencies found; drift logged; corrections with rationale)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-041 checked off with date
