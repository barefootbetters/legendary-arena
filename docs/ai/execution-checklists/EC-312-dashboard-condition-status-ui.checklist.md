# EC-312 — Dashboard Condition-Gate Status Display (Execution Checklist)

**Source:** `docs/ai/work-packets/WP-281-mechanic-ledger-condition-status-ui.md`  
**Layer:** Dashboard only (`apps/dashboard/`)  
**Execution Lane:** Lightweight (UI-only, single-session)

---

## Before Starting

- [ ] WP-280 is executed and live (ledger emits `"status": "condition"` for spectrum rows)
- [ ] Ledger JSON is on `main` with condition status: `git show main:docs/ai/coverage/hero-mechanic-ledger.json | grep -c '"status": "condition"'` returns **5**
- [ ] `pnpm --filter @legendary-arena/dashboard build` exits 0
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` exits 0
- [ ] Dashboard baseline tests pass: `pnpm --filter @legendary-arena/dashboard test` exits 0

---

## Locked Values (Do Not Re-Derive)

**TypeScript Union (Canonical):**
```typescript
type MechanicStatus =
  | "executable"
  | "deferred"
  | "condition"
  | "unsupported"
  | "unmarked"
```

**Status Ordering Constant (Single Source of Truth):**
```typescript
const STATUS_ORDER: readonly MechanicStatus[] = [
  "executable",
  "deferred",
  "condition",
  "unsupported",
  "unmarked"
] as const
```

**Type Guard Function (Deserialization):**
```typescript
function isValidStatus(value: unknown): value is MechanicStatus {
  return typeof value === "string" && STATUS_ORDER.includes(value as MechanicStatus)
}
```

**Visual Spec:**
- CSS class: `.status-condition`
- Label: "Condition"
- Tooltip: *"Recognized condition-gate mechanic; effects execute only when condition is satisfied."*

**Summary Format:** `152 Executable · 5 Condition · 423 Unsupported · 47 Unmarked`

**Section Ordering (Exact):** Executable → Deferred → Condition → Unsupported → Unmarked

---

## Guardrails

1. **Status order MUST be enforced via `STATUS_ORDER` constant — ALL sorting/rendering derives from this one constant.** No hardcoded arrays or switch-case orderings.

2. **Type safety at deserialization — every ledger row's status MUST pass `isValidStatus()` guard before use.** Unknown statuses MUST fall through to "unmarked" (safe default).

3. **Filter chip MUST be single-select (mutually exclusive).** Selecting "Condition" hides all non-condition rows. "All" is the default state.

4. **Section MUST NOT render if zero rows.** Condition section only appears if count > 0.

5. **No cache silencing — dashboard MUST fetch ledger.json on load.** Stale cache is acceptable (HTTP headers); user can force refresh.

6. **Spectrum assertion (test fixture) — EXACTLY 5 condition rows MUST exist at baseline.** Mismatch logs dev warning.

7. **Deterministic row sorting within each section — primary: mechanic name (asc), secondary: card ext_id (asc).**

---

## Required Files to Modify

**Allowlist (4 files + optional wiring, per D-24028):**

- `apps/dashboard/src/composables/useMechanicCoverage.ts` — **modified**  
  Add `MechanicStatus` type union, `STATUS_ORDER` constant, `isValidStatus()` guard. Update deserialization to handle "condition".

- `apps/dashboard/src/views/CoveragePage.vue` — **modified**  
  Add "Condition" filter chip. Update section rendering logic to respect `STATUS_ORDER`. Add condition section header with count. Update summary KPI display.

- `apps/dashboard/src/components/MechanicCoverageTable.vue` (or inline in CoveragePage) — **modified** OR **new**  
  Render Condition section rows in correct order. Apply `.status-condition` CSS class.

- `apps/dashboard/src/styles/*.css` (or scoped in component) — **modified**  
  Add `.status-condition` styling (label, icon, color, tooltip).

---

## After Completing (Binary Checklist)

- [ ] `pnpm --filter @legendary-arena/dashboard build` exits 0
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` exits 0
- [ ] `pnpm --filter @legendary-arena/dashboard test` exits 0 (baseline preserved or improved)
- [ ] Acceptance Criteria (AC-1 through AC-6 in WP-281) verified:
  - [ ] AC-1: Condition status deserialized correctly
  - [ ] AC-2: Section ordering enforced (Executable > Deferred > Condition > Unsupported > Unmarked)
  - [ ] AC-3: Filter chips work (single-select, "All" default, search + status AND logic)
  - [ ] AC-4: Summary counts correct (`condition_count == count(status=="condition")`)
  - [ ] AC-5: Backward compatibility (no crash on old ledger)
  - [ ] AC-6: Unknown status handling (falls to "unmarked", dev warning, no throw)
- [ ] Spectrum assertion: 5 condition rows visible at baseline
- [ ] **Live-on-surface verification (D-24026 gate):** Navigate to deployed `/coverage` page, search for "spectrum," confirm it appears in **Condition** section (not Unsupported)
- [ ] No changes outside the 4 allowlisted files
- [ ] `docs/ai/STATUS.md` updated (WP-281 → Done, D-24057/D-24058 → Active)
- [ ] `docs/ai/WORK_INDEX.md` checked off with date

---

## Common Failure Smells

| Smell | Likely Cause | Fix |
|-------|--------------|-----|
| Condition section appears in wrong position (e.g., after Unsupported) | `STATUS_ORDER` not used in rendering | Audit every sort/grouping call; re-derive from `STATUS_ORDER` constant, not a hardcoded array |
| Unknown statuses crash or render blank | `isValidStatus()` guard missing at deserialization | Add guard immediately after `JSON.parse()`; route unknown to "unmarked" |
| Filter chip selection is multi-select (both "Condition" and "Unsupported" show rows) | Chips not wired as mutually exclusive | Review chip component; ensure selecting one deselects others; "All" is default state |
| Spectrum rows missing entirely | Ledger version mismatch or cache stale | Verify ledger.json on deployed server has `"status": "condition"` rows; hard-reload browser (`Ctrl+Shift+R`) |
| Summary count does not match row count (e.g., shows "5 Condition" but only 3 rows visible) | Filter hiding rows but summary still includes them | Ensure summary reflects *visible* row count after all filters applied |
| Tooltip not rendering on Condition badge | CSS class missing or selector conflict | Inspect element in dev tools; confirm `.status-condition` class applied; check for z-index or overflow issues |

---

## Notes

- This WP is a **lightweight single-session WP** per D-24028: UI-only, ≤4 files, no determinism impact, no new contracts.
- Scaffold-first NOT required (this is UI rendering, not validation-tightening).
- No session boundary; inline amendments allowed (up to 3 distinct corrections per anti-gaming rules).
- Post-merge: if spectrum does not appear as "Condition" on live `/coverage`, check browser cache first (hard reload), then verify deployed ledger.json has the rows.
