# Pre-Flight Input — WP-066 (Registry Viewer: Card Image-to-Data Toggle)

**Status:** Notes carried forward from a prior triage session (2026-04-21).
**Authority:** Non-authoritative. The preflight session must independently verify every item before relying on it.
**Target:** [WP-066](../work-packets/WP-066-registry-viewer-data-toggle.md) + [EC-066](../execution-checklists/EC-066-registry-viewer-data-toggle.checklist.md)

---

## Why this file exists

A prior session reviewed EC-066 and triaged readiness without running a full pre-flight. These notes preserve findings so the preflight session can skip re-discovery. They are inputs, not conclusions.

---

## Findings to verify

### 1. WP/EC display-label table mismatch

EC-066 §Locked Values lists **13 display-label rows** including `name` → "Name" and `type` → "Type". WP-066 §Non-Negotiable Constraints (lines 128–139) lists only **11 labels** — `name` and `type` are required FlatCard fields per WP line 124 but have no WP-prescribed display label. Per [EC-TEMPLATE.md](../execution-checklists/EC-TEMPLATE.md) "Locked Values must be copied verbatim from the WP. If formatting or ordering differs, the EC is invalid."

**Preflight action:** decide one of:
- (a) update EC-066 to drop `name` / `type` rows (match WP verbatim) and rely on WP §Scope C "Other Fields" rendering for those keys, or
- (b) amend WP-066 §Non-Negotiable Constraints to add explicit `name` / `type` display-label rows.

Either resolves the verbatim-rule violation.

### 2. WORK_INDEX status blocker

[WORK_INDEX.md:1055](../work-packets/WORK_INDEX.md) lists WP-066 as **"Not yet reviewed"**. Per [.claude/rules/work-packets.md](../../.claude/rules/work-packets.md) §"Review Gate", unreviewed packets must not be executed. This pre-flight is the review.

**Preflight action:** verdict must include explicit recommendation to flip WORK_INDEX status, with the commit doing so referenced in the verdict.

### 3. Dirty-tree blocker (branch context)

At time of triage, the working tree was on `wp-084-delete-unused-auxiliary-metadata` with uncommitted modifications to files WP-066 must read as authoritative context:
- `apps/registry-viewer/CLAUDE.md` (modified)
- `apps/registry-viewer/src/registry/index.ts` (modified)
- `apps/registry-viewer/src/registry/types/index.ts` (modified)
- `apps/registry-viewer/src/registry/types/types-index.ts` (modified)
- `apps/registry-viewer/src/registry/impl/localRegistry.ts` (deleted)

**Preflight action:** require WP-084 to land on `main` first, then start WP-066 on a clean branch off updated `main`. Re-confirm the post-WP-084 state of `apps/registry-viewer/CLAUDE.md` matches what WP-066 §Context expects.

### 4. Open question — `setViewMode` API surface

WP-066 §Scope A specifies the composable returns `{ viewMode, setViewMode, toggleViewMode }`. The toolbar UI (§Scope B) only needs `toggleViewMode`. EC-066 "After Completing" verifies toggle behavior only.

**Preflight action:** decide — is there a known caller for `setViewMode` (e.g., URL-driven init, test harness, debug menu)? If not, recommend WP amendment to drop `setViewMode` from the public API to avoid dead code per [.claude/rules/architecture.md] "Prohibited AI Failure Patterns" (don't expose surface without callers).

---

## Verified repo facts (use as-is)

These were confirmed during triage and are unlikely to drift before preflight:

- `apps/registry-viewer/src/registry/browser.ts` exists and re-exports `FlatCard` from `src/registry/types/`. WP-066's claim that `FlatCard` is "fully available via `src/registry/browser.ts`" is true at the import-surface level.
- `apps/registry-viewer/src/composables/` already contains 4 composables (`useGlossary.ts`, `useLightbox.ts`, `useResizable.ts`, `useRules.ts`) — Composition API pattern is established. No new pattern introduced by WP-066.
- `apps/registry-viewer/src/components/CardDetail.vue` and `CardGrid.vue` both exist. WP-066's "modified" file claims are valid targets.
- WP-066 dependencies = none (independent of WP-082 / WP-083 / WP-084 per WORK_INDEX).

---

## Lint-gate observations (non-blocking, flag in verdict)

- **Acceptance criteria count:** WP-066 has ~21 binary AC items, exceeding the [00.3-prompt-lint-checklist.md](../REFERENCE/00.3-prompt-lint-checklist.md) §14 guideline of 6–12. All items are observable and binary, so this is not a hard FAIL — but the preflight verdict should consolidate or accept-with-rationale.
- **Test coverage:** WP-066 produces no tests. `apps/registry-viewer/` has no existing unit-test harness in the inspected file set. §12 of the lint checklist is correctly N/A but worth noting in the verdict.

---

## What the preflight should produce

A standard verdict file at `docs/ai/invocations/preflight-wp066.md` following the [preflight-wp084.md](preflight-wp084.md) / [preflight-wp083.md](preflight-wp083.md) format, with:
- Dependency Check (will pass — no deps)
- Dependency Contract Verification (verify items 1–4 above)
- Scope Lock (5 files, no expansion)
- STOP-Gate Status (status flip + clean branch)
- Verdict: READY / NOT READY with explicit unblock list
