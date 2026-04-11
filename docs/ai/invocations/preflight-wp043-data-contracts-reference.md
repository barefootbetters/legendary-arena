# Pre-Flight Invocation — WP-043

---

### Pre-Flight Header

**Target Work Packet:** `WP-043`
**Title:** Data Contracts Reference (Canonical Card & Metadata Shapes)
**Previous WP Status:** WP-003 Complete (2026-04-09)
**Pre-Flight Date:** 2026-04-10
**Invocation Stage:** Pre-Execution (Scope & Readiness)

**Work Packet Class:** Contract-Only (types/contracts/tests only)

Required sections: Dependency Check, Structural Readiness, Scope Lock,
Test Expectations, Risk Review.
Skipped sections: Runtime Readiness Check, Mutation Boundary Confirmation.

---

### Pre-Flight Intent

Perform a pre-flight validation for WP-043.

- Not implementing.
- Not generating code.
- Validating readiness and constraints only.

If a blocking condition is found, pre-flight must return **NOT READY** and stop.

---

### Authority Chain (Must Read)

1. `.claude/CLAUDE.md` — read (EC-mode rules, bug handling, commit discipline)
2. `docs/ai/ARCHITECTURE.md` — read (layer boundaries, engine vs framework rules)
3. `docs/ai/execution-checklists/EC-043-data-contracts.checklist.md` — read
4. `docs/ai/work-packets/WP-043-data-contracts-reference.md` — read
5. WP-003 (dependency) — confirmed complete in WORK_INDEX.md

No conflicts detected between authority chain documents.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| WP-003 | ✅ Complete (2026-04-09) | Card Registry Verification & Defect Correction. `schema.ts` authoritative, `FlatCard.cost` is `string \| number \| undefined`, `httpRegistry.ts` fetches `sets.json`. |

All prerequisites are met.

---

### Structural Readiness Check (Types & Contracts)

- [x] All prior WPs compile and tests pass (game-engine: 72 tests pass, 0 fail)
- [x] No known EC violations remain open
- [x] Required types/contracts exist: `packages/registry/src/schema.ts` exists; `docs/ai/ARCHITECTURE.md` exists with Registry Metadata File Shapes, Card Field Data Quality, Zone & Pile Structure, Persistence Boundaries, MatchSetupConfig sections; `docs/ai/DECISIONS.md` exists
- [x] No naming or ownership conflicts
- [x] No architectural boundary conflicts anticipated at the contract level

**Build note:** Registry package build fails with `dist/cards.json not found —
run 'pnpm normalize' first`. This is an environmental dependency (requires local
card data files at `C:\Users\jjensen\bbcode\modern-master-strike\src\data\cards\`).
Registry smoke test also fails (ENOENT for card data). These are data-path issues,
not code defects. Since WP-043 is documentation-only and does not modify any
package code, this is **non-blocking**.

All structural readiness checks pass.

---

### Established Patterns to Follow (Locked Precedents)

- Reference ARCHITECTURE.md sections rather than restating them
- Reference prior WPs for engine conventions (CardExtId, zone contents, moves)
- Use real JSON shapes from actual card data (not aspirational)
- Include field reference tables with types and notes
- Subordination to `schema.ts` and `ARCHITECTURE.md` must be explicit
- The existing `docs/ai/REFERENCE/00.2-data-requirements.md` (755 lines) is
  a legacy version that includes out-of-scope UI sections (7, 9, 10, 11, 12).
  The execution session will **replace it entirely** per WP-043 scope.

No deviations from established patterns anticipated.

---

### Scope Lock (Critical)

#### WP-043 Is Allowed To

- **Create/Replace:** `docs/ai/REFERENCE/00.2-data-requirements.md` — governed
  data contracts reference with 8 sections:
  - §1 Card Data Shapes (hero, mastermind, villain, scheme, henchman, bystander/wound)
  - §2 Metadata Lookups (6 metadata files with entry counts, ARCHITECTURE.md cross-ref)
  - §3 Image & Asset Conventions (R2 base URL, URL construction, naming conventions)
  - §4 PostgreSQL Schema Reference (table inventory, Layer Boundary note)
  - §5 Ability Text Markup Language (5 bracket notation token types)
  - §6 Mastermind-Villain Group Relationship (3-level model, special cases)
  - §7 Match Configuration (reference to ARCHITECTURE.md and WP-005A, one paragraph)
  - §8 Authority Notes (subordination to schema.ts and ARCHITECTURE.md)
- **Modify:** `docs/ai/ARCHITECTURE.md` — one-line cross-reference to new 00.2
  (note: cross-reference already exists at line 136; verify and update if needed)
- **Update:** `docs/ai/STATUS.md` — data contracts reference exists
- **Update:** `docs/ai/DECISIONS.md` — why legacy sections excluded, subordination rationale
- **Update:** `docs/ai/work-packets/WORK_INDEX.md` — WP-043 checked off

#### WP-043 Is Explicitly Not Allowed To

- No modifications to `packages/registry/src/` (Zod schemas are authoritative)
- No modifications to `packages/game-engine/` (engine contracts locked)
- No modifications to `apps/server/`
- No TypeScript code produced
- No restating of architectural rules — reference ARCHITECTURE.md instead
- No restating of engine conventions (CardExtId, zone contents) — reference WPs
- No UI concerns: search/filter, user preferences, feature flags, animations,
  localStorage, Konva.js, Vue, themes
- No deployment checklists (covered by WP-042)
- No files outside the explicit allow-list above

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **New tests:** 0 — this is a documentation-only packet
- **Existing test changes:** None expected
- **Prior test baseline:** game-engine 72 tests passing; all must continue to pass
- **Test boundaries:** No test files may be created or modified

**Rule:** If the execution session discovers that test changes are needed,
it must stop and escalate — documentation-only packets do not modify tests.

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### Risk 1: Existing 00.2 file is the legacy version

- **Risk:** `docs/ai/REFERENCE/00.2-data-requirements.md` already exists (755 lines)
  with legacy UI sections (§7 Deck Data, §9 Search/Filter, §10 Preferences,
  §11 App Config, §12 Export). The execution session must replace it entirely.
- **Impact:** If the session appends rather than replaces, out-of-scope UI
  content will persist.
- **Mitigation:** The execution session must fully overwrite the file with the
  new 8-section structure. The legacy content is archived at
  `docs/archive prompts-legendary-area-game/00.2-data-requirements.md`.
- **Decision:** Full replacement. The new file has 8 sections per WP-043 §A.
  Legacy sections 7/9/10/11/12 are excluded (UI concerns per Layer Boundary).

#### Risk 2: ARCHITECTURE.md cross-reference may already exist

- **Risk:** ARCHITECTURE.md line 136 already contains a reference to
  `00.2-data-requirements.md`. The WP says to add a one-line cross-reference.
- **Impact:** Could create a duplicate reference.
- **Mitigation:** The execution session should verify the existing reference
  and update it if needed rather than blindly adding a second one.
- **Decision:** Check existing reference; update wording if needed, do not duplicate.

#### Risk 3: Legacy source is archived, not at original path

- **Risk:** WP-043 references `docs/prompts-legendary-area-game/00.2-data-requirements.md`
  as the legacy source, but that directory has been renamed to
  `docs/archive prompts-legendary-area-game/`.
- **Impact:** The execution session may fail to find the legacy source.
- **Mitigation:** Use `docs/archive prompts-legendary-area-game/00.2-data-requirements.md`
  as the legacy source path. Also use the existing governed 00.2 and real card
  data from `packages/registry/src/schema.ts` as authoritative references.
- **Decision:** Read from the archive path. If not found, the existing governed
  00.2 (legacy version) at the target path contains the same content.

#### Risk 4: Card data not available locally for examples

- **Risk:** Real card JSON data lives at
  `C:\Users\jjensen\bbcode\modern-master-strike\src\data\cards\` (per CLAUDE.md).
  If not accessible, the execution session cannot verify real JSON shapes.
- **Impact:** Document may use aspirational rather than real shapes.
- **Mitigation:** The existing 00.2 and schema.ts contain verified shapes. Use
  those as the reference. If the external card data is available, use it for
  verification.
- **Decision:** Use schema.ts and the existing 00.2 content as primary shape
  references. Verify against external card data if accessible.

All risks have mitigations. No blocking issues.

---

### Pre-Flight Verdict (Binary)

**✅ READY TO EXECUTE**

WP-043 is properly sequenced — its sole dependency (WP-003) is complete and
reviewed. The scope is cleanly bounded: one new reference document (replacing
an existing legacy version) and minor governance updates. All source materials
exist (schema.ts, ARCHITECTURE.md, legacy 00.2 in archive). The only risks are
environmental (file paths, existing content) and all have clear mitigations
locked above. No architectural boundary conflicts exist — this is a
documentation-only packet that does not touch any package code.

---

### Authorized Next Step

> You are authorized to generate a **session execution prompt** for WP-043
> to be saved as:
> `docs/ai/invocations/session-wp043-data-contracts-reference.md`

**Guard:** The session prompt **must conform exactly** to the scope, constraints,
and decisions locked by this pre-flight. No new scope may be introduced.

---

### Final Instruction

Pre-flight exists to **prevent premature execution and scope drift**.

If there is uncertainty, missing context, or unresolved ambiguity:

**DO NOT PROCEED TO EXECUTION.**

Escalate, clarify, or split the WP instead.
