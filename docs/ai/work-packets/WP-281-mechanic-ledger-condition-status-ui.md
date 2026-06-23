# WP-281 — Mechanic Coverage Dashboard: Condition-Gate Status Display

**Status:** Drafted 2026-06-23  
**Baseline:** `origin/main` at commit `1d411682` (governance draft commit)  
**Paired with:** EC-312

---

## Context

WP-280 introduces a new "condition" status type to the mechanic ledger JSON schema to properly classify condition-gate mechanics (e.g., Spectrum requires ≥3 hero classes). The ledger now emits `"status": "condition"` for 5 rows across ssw2 cards.

The dashboard `/coverage` page currently displays the mechanic coverage worklist with four status types: `executable | deferred | unsupported | unmarked`. The UI has no handler for the new "condition" type, so condition-gate mechanics are either silently dropped or misclassified.

**User-visible problem:** Spectrum appears as "Unsupported" instead of "Condition," creating confusion about whether the mechanic is recognized by the engine.

---

## Scope (Single-Layer, UI-Only)

**Layer:** `apps/dashboard/` only. No engine, server, registry, or cross-layer changes.

**File Allowlist (4 files max + optional wiring file per D-24028):**
1. `src/composables/useMechanicCoverage.ts` — add "condition" to TypeScript union, deserialize, guard
2. `src/views/CoveragePage.vue` — add filter chip, update section rendering, update summary display
3. `src/components/MechanicCoverageTable.vue` (or inline in CoveragePage) — render Condition section
4. `src/styles/*.css` (or scoped) — add `.status-condition` styling

**No changes to:**
- Engine, server, registry, data pipeline
- Ledger generation script (done in WP-280)
- API contracts or persistence

---

## Acceptance Criteria (Binary)

**AC-1 — Status Recognition**
- GIVEN a ledger row with `"status": "condition"`
- WHEN dashboard loads
- THEN row MUST be deserialized as status `"condition"` (not dropped, not coerced)

**AC-2 — Section Ordering (Enforced)**
- Dashboard MUST render sections in EXACT order:
  **Executable > Deferred > Condition > Unsupported > Unmarked**
- Section header MUST include count badge: e.g., "Condition (5)"
- Rows MUST be sorted deterministically within each section:
  - Primary: mechanic name (ascending)
  - Secondary: card ext_id (ascending)

**AC-3 — Filter Chip Behavior**
- Selecting "Condition" chip MUST:
  - Show ONLY condition rows
  - Hide all other status rows
  - Preserve search filtering (AND logic: search + status filter)
- Chips MUST be mutually exclusive (single-select)
- Default state MUST be "All"

**AC-4 — Summary Counts**
- Summary MUST display: `152 Executable · 5 Condition · 423 Unsupported · 47 Unmarked`
- Condition count MUST equal `count(rows where status == "condition")`
- Total row count MUST equal sum of all statuses

**AC-5 — Backward Compatibility**
- GIVEN ledger.json without "condition" field (e.g., pre-WP-280 deployed state)
- THEN dashboard MUST:
  - Not crash
  - Not render empty "Condition" section
  - Gracefully skip unknown statuses (log dev warning only)

**AC-6 — Unknown Status Handling**
- ANY row with unknown status (typo, future schema drift) MUST:
  - Default to "unmarked" (safe fallback)
  - Emit console.warn in dev (one line: `"Unknown mechanic status: <value>"`)
  - Not throw

---

## Technical Design

### Type Safety

```typescript
// Canonical status union — source of truth
type MechanicStatus =
  | "executable"
  | "deferred"
  | "condition"
  | "unsupported"
  | "unmarked"

// Status ordering constant — enforced in rendering
const STATUS_ORDER: readonly MechanicStatus[] = [
  "executable",
  "deferred",
  "condition",
  "unsupported",
  "unmarked"
] as const

// Type guard for deserialization
function isValidStatus(value: unknown): value is MechanicStatus {
  return typeof value === "string" && STATUS_ORDER.includes(value as MechanicStatus)
}
```

**All UI rendering, sorting, and grouping MUST derive from `STATUS_ORDER` constant.**

### Filter Chip Rules

- Chips MUST be single-select (mutually exclusive)
- "All" includes ALL statuses (executable, deferred, condition, unsupported, unmarked)
- Default state: "All"
- URL/query param state persistence: optional but recommended (e.g., `?filter=condition`)

### UI Section Rendering Rules

- Section MUST NOT render if zero rows in that status
- Section header format: **Status Name (Count)**  
  Example: "Condition (5)", "Unsupported (423)"
- Rows MUST be sorted deterministically:
  1. Mechanic name (ascending alphabetical)
  2. Card ext_id (ascending)
- Sections render in order per `STATUS_ORDER`

### Visual Specification (Locked)

**CSS Class:** `.status-condition`

**Visual attributes:**
- Label: "Condition"
- Icon: Lock or gate symbol (SVG id: `icon-gate` or equivalent)
- Badge color: HEX color TBD (must NOT conflict with `status-executable`, `status-deferred`, `status-unsupported`, `status-unmarked`)
- Tooltip (exact string): *"Recognized condition-gate mechanic; effects execute only when condition is satisfied."*

### Data Freshness (Cache Handling)

- Dashboard MUST fetch ledger JSON on page load (no stale-only fallback)
- Browser cache is acceptable (HTTP cache-control headers apply)
- No manual refresh UI required (optional enhancement post-merge)
- Hard reload (Ctrl+Shift+R) MUST bypass cache and fetch fresh ledger

### Spectrum-Specific Assertion (Test Fixture)

- EXACTLY 5 rows MUST appear with status "condition" in the deployed baseline
- Condition rows MUST all be ssw2 cards (Agent Venom)
- If count != 5, log mismatch in dev console: `"Expected 5 condition rows, got N"`

---

## Determinism & Stability

- **No game-engine changes** (WP-280 is the sole engine touch)
- **Ledger artifact** (`docs/ai/coverage/hero-mechanic-ledger.json`) is regenerated deterministically by `pnpm ledger:heroes` (CI-gated)
- **Dashboard is a pure UI consumer** — no new schema contracts, no API changes, no persistence boundary impact
- **No RNG, I/O, or external state** in the UI logic

---

## Hard Dependencies

- **WP-280** ✅ (ledger MUST emit "condition" status; this WP depends on that change being live)

**Order:** WP-280 deploys → ledger changes live → WP-281 executes and deploys → spectrum appears as "Condition" on /coverage

---

## Hard Scope Boundaries (No Changes Permitted)

- ❌ NO modifications outside the 4 allowlisted files
- ❌ NO API/schema changes
- ❌ NO engine or server changes
- ❌ NO new contract files (`.types.ts`, `.validate.ts`)
- ❌ NO changes to ledger generation pipeline

---

## Reserved Decisions

- **D-24057** — Condition-gate mechanics are a recognized status type, distinct from "unsupported" keywords. Display order: Executable > Deferred > Condition > Unsupported > Unmarked.
- **D-24058** — Dashboard "condition" visual: "Condition" label + lock/gate icon + tooltip string (locked above).

---

## See Also

- [WP-280](WP-280-spectrum-conditional-keyword.md) (ledger schema + engine condition-gate)
- [EC-311](../execution-checklists/EC-311-spectrum-conditional-keyword.checklist.md) (WP-280 execution)
- [EC-312](../execution-checklists/EC-312-dashboard-condition-status-ui.checklist.md) (this WP's execution checklist)
- [D-24055, D-24056](../DECISIONS.md) (WP-280 design decisions)
- [D-24057, D-24058](../DECISIONS.md) (this WP's design decisions)
