# EC-041 — System Architecture Definition & Authority Model (Execution Checklist)

**Source:** docs/ai/work-packets/WP-041-system-architecture-definition-authority-model.md
**Layer:** Core Architecture / Documentation

**Execution Authority:**
This Execution Checklist is the **authoritative acceptance contract** for WP-041.
All clauses below are mandatory. Failure to satisfy **any single item** —
including differences in spelling, casing, formatting, ordering, or count of
locked values — is a **failed execution** of WP-041.
No discretionary interpretation is permitted.

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

All items below must be reproduced verbatim from WP-041.
Any difference in **spelling, casing, formatting, ordering, or count** is an
automatic failure.

### Field Classification (Class 1 — Runtime G)

Exactly **20** G-class fields must appear in the Field Classification table,
in the order below:

1. `selection` — WP-005B
2. `playerZones` — WP-006A
3. `piles` — WP-006B
4. `villainDeck` — WP-014
5. `villainDeckCardTypes` — WP-014
6. `hookRegistry` — WP-009B
7. `currentStage` — WP-007B
8. `lobby` — WP-011
9. `messages` — WP-009B
10. `counters` — WP-010
11. `city` — WP-015
12. `hq` — WP-015
13. `ko` — WP-017
14. `attachedBystanders` — WP-017
15. `turnEconomy` — WP-018
16. `cardStats` — WP-018
17. `mastermind` — WP-019
18. `heroAbilityHooks` — WP-021
19. `cardKeywords` — WP-025
20. `schemeSetupInstructions` — WP-026

**Invariant:** all 20 fields are **Class 1 — Runtime (G)**.

**Scope note:** `matchConfiguration` (Class 2, Configuration) and
`activeScoringConfig` (WP-067, out of the WP-001..WP-026 verification
range) are intentionally excluded and must not be added or modified by
this packet.

### Authority Hierarchy (highest → lowest)

```
CLAUDE.md
ARCHITECTURE.md
01-VISION.md
.claude/rules/*.md
WORK_INDEX.md
Work Packets (WP-*)
Conversation / Chat
```

`01-VISION.md` position is fixed by WP-041 §B and must not be re-ordered
or omitted.

### Architecture Version Stamp

Required format (exact, at the top of `ARCHITECTURE.md`):

```
Architecture Version: 1.0.0
```

### Verification Scope

- Verified against: **WP-001 through WP-040**

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

## Files to Produce (and only these)

- `docs/ai/ARCHITECTURE.md` — **modified**
  - Field Classification table complete (20 fields, correct order, Class 1)
  - Authority model explicitly documented (VISION position included)
  - Version stamp added in exact format
  - Internal contradictions corrected with WP/Decision citations
- `docs/ai/DECISIONS.md` — **modified**
  - Audit findings recorded (Architecture Audit Finding / Resolved
    Transcription Inconsistency / Rules-Architecture Drift Log)
  - Drift with `.claude/rules/*.md` explicitly logged — no fixes applied

---

## Common Failure Smells (Optional)

- New architectural concepts invented instead of documenting existing ones
- `.claude/rules/*.md` files modified instead of logging drift
- Missing, renamed, or reordered G-class fields in Field Classification table
- Authority hierarchy implied but not explicitly stated, or `01-VISION.md`
  omitted from the chain
- Version stamp missing, misplaced, or reformatted (e.g., `Architecture v1.0.0`)
- DECISIONS.md noised with trivial no-change confirmations instead of only
  the three permitted entry types

---

## After Completing

- [ ] Exactly **20** G-class fields present in Field Classification table,
      in the order locked above, all classified Class 1 (Runtime)
- [ ] Version stamp present at top of ARCHITECTURE.md in exact format
      (`Architecture Version: 1.0.0`)
- [ ] Authority hierarchy explicitly documented in ARCHITECTURE.md with
      `01-VISION.md` between ARCHITECTURE.md and `.claude/rules`
- [ ] No unresolved contradictions remain (or corrections are documented
      with WP / Decision references)
- [ ] Drift with `.claude/rules/*.md` logged in DECISIONS.md (not fixed)
- [ ] No engine files modified (confirmed with `git diff`)
- [ ] No `.claude/rules/*.md` files modified (confirmed with `git diff`)
- [ ] `docs/ai/STATUS.md` updated
      (architecture formally reviewed and versioned)
- [ ] `docs/ai/DECISIONS.md` updated
      (entries limited to the three permitted types; no trivial
      no-change confirmations)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` WP-041 checked off with date
