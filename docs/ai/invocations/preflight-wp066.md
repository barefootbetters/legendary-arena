# WP-066 Pre-Flight Verdict

---

### Pre-Flight Header

**Target Work Packet:** `WP-066`
**Title:** Registry Viewer — Card Image-to-Data Toggle
**Execution Checklist:** `EC-066`
**Previous WP Status:** WP-083 / EC-108 complete (commit `7f054e1`, 2026-04-22 on branch `wp-083-fetch-time-schema-validation`, not yet merged to `main`); WP-084 / EC-109 complete (commit `4cc9ded`, same branch).
**Pre-Flight Date:** 2026-04-22
**Invocation Stage:** Pre-Execution (Scope & Readiness)
**Current Verdict:** ❌ **DO NOT EXECUTE YET** — four pre-session actions required (PS-1..PS-4). Once PS-1 (EC↔WP reconciliation), PS-2 (WORK_INDEX flip), PS-3 (landing branch), PS-4 (scope narrow on `setViewMode` stale claim) are resolved on paper, verdict flips to ✅ **READY** without a pre-flight re-run.

**Work Packet Class:** Client UI feature — `apps/registry-viewer/` only. Creates three new SFCs + one composable; modifies `App.vue` and `CardDetail.vue`. No `game-engine` code, no `G`, no framework `ctx`, no tests (no viewer test harness exists). Closest 01.4 class = **Runtime Wiring** (limited wiring of new composable into existing components) — not Behavior (no `G` mutation), not Infrastructure (no new test harness or engine-adjacent tooling), not Contract-Only (produces runtime components).

Required sections applied: Authority Chain, Dependency Check, Input Data Traceability, Structural Readiness, Dependency Contract Verification, Scope Lock, Test Expectations, Code Category Boundary, Maintainability, Risk Review, STOP-Gate Status, External Input Disposition Log, Invocation Prompt Conformance.

Skipped sections: Runtime Readiness Check (no `game.ts` / `ctx.events` / framework random), Mutation Boundary Confirmation (no `G`).

---

### Pre-Flight Intent

Perform pre-flight validation for `WP-066`.

- Not implementing.
- Not generating components.
- Validating readiness, scope lock, and contract fidelity only.
- Independently verifying every claim in `preflight-input-wp066.md` (non-authoritative input carried forward from a 2026-04-21 triage session).

Blocking conditions discovered. Verdict: **DO NOT EXECUTE YET.** See §Pre-Session Actions.

---

### Authority Chain (Read Before Execution)

1. `.claude/CLAUDE.md` — EC-mode rules, bug handling, commit discipline; Lint Gate mandatory before WP execution.
2. `docs/ai/ARCHITECTURE.md` — Layer Boundary; UI packages may import `registry` and UI framework, must NOT import `game-engine`, `preplan`, `server`, `pg`.
3. `.claude/rules/architecture.md` — "Prohibited AI Failure Patterns" (no API surface without callers).
4. `.claude/rules/code-style.md` — no abbreviations, human-style code, boolean names start with `is/has/can`, no unjustified `.reduce()`.
5. `.claude/rules/work-packets.md` — "Review Gate" (unreviewed packets must not execute); this pre-flight is the review.
6. `apps/registry-viewer/CLAUDE.md` — viewer-level tech stack, data flow, composable conventions, layer boundary for UI.
7. `docs/ai/execution-checklists/EC-TEMPLATE.md` — "Locked Values must be copied verbatim from the WP. If formatting or ordering differs, the EC is invalid."
8. `docs/ai/execution-checklists/EC-066-registry-viewer-data-toggle.checklist.md`
9. `docs/ai/work-packets/WP-066-registry-viewer-data-toggle.md`
10. `docs/ai/invocations/preflight-input-wp066.md` — non-authoritative triage notes (every claim re-verified below).

No authority-chain conflicts detected. If EC and WP conflict on execution contract (locked values, guardrails), the WP wins per `.claude/CLAUDE.md` §Execution Checklists ("If the EC and WP conflict, the WP wins"). This specifically governs PS-1 below.

---

### Dependency & Sequencing Check

| WP | Status | Notes |
|---|---|---|
| (none) | — | WP-066 §Dependencies: *"None (registry viewer is independent; existing codebase functions)"*. Verified against WORK_INDEX.md:1056. |
| WP-083 (EC-108) | Complete on branch, not on `main` | Fetch-time schema validation for viewer config + themes. Touches `apps/registry-viewer/src/lib/*.ts`. Orthogonal to WP-066 scope but lands in the same viewer tree — see PS-3. |
| WP-084 (EC-109) | Complete on branch, not on `main` | Deletes unused auxiliary metadata schemas + files. Touches `packages/registry/` and `apps/registry-viewer/src/registry/` (type-index re-point, `localRegistry.ts` removal). Orthogonal to WP-066 scope but lands in the viewer tree — see PS-3. |

Input file's Finding 3 claimed the triage branch was `wp-084-delete-unused-auxiliary-metadata` with five uncommitted viewer files. **Re-verified 2026-04-22:** those changes are now committed on branch `wp-083-fetch-time-schema-validation` (commits `b250bf1` and `601d6fc`). `localRegistry.ts` has been deleted on this branch; `main` still has it. The "dirty tree" condition described in the input no longer exists — it has evolved into an **un-merged-branch** condition. The substantive concern survives: WP-066 must start from a tree that contains WP-083/WP-084 outcomes (new fetch-time validation clients, removed auxiliary metadata, updated type-index). See PS-3.

**Dependency gate: PASS** (no contractual dependencies); **Sequencing gate: CONDITIONAL** on PS-3.

---

### Input Data Traceability Check

- ✅ All non-user-generated inputs consumed by this WP are listed in `docs/03.1-DATA-SOURCES.md` — WP-066 reads `FlatCard` data already fetched by the viewer from R2 at `https://images.barefootbetters.com/metadata/`. No new data inputs introduced.
- ✅ Storage locations known — Cloudflare R2 (per-set JSON, theme JSON, glossary JSON, rulebook PDF) + viewer `localStorage` (new `cardViewMode` key added by this WP).
- ✅ Diagnostic path for incorrect behavior known — card display bugs trace to R2 JSON (per set) or per-card source patches in `bbcode/modern-master-strike/`; view-mode bugs trace to `localStorage.cardViewMode` + new composable state.
- ✅ The WP does not introduce implicit data — the `cardViewMode` key is declared explicitly in WP §Non-Negotiable Constraints (`cardViewMode`) and EC §Locked Values (same exact spelling).
- ⚠ **Setup-Time Derived Data:** n/a — WP-066 does not touch `G` or any setup-time resolution. `localStorage` is a UI-level persistence channel separate from `docs/03.1-DATA-SOURCES.md`'s runtime-state taxonomy.

Traceability gate: **PASS.**

---

### Structural Readiness Check (Types & Contracts)

- ✅ All prior WPs compile on current branch — viewer `pnpm --filter registry-viewer typecheck` exits 0 (vue-tsc silent); `pnpm --filter registry-viewer lint` exits 0 errors (174 cosmetic warnings, unrelated to WP-066 scope); `pnpm --filter registry-viewer build` succeeds, 60 modules transformed, 866ms. Confirmed 2026-04-22 against `HEAD=7f054e1`.
- ✅ No known open EC violations blocking WP-066. EC-108 and EC-109 post-mortems are clean on this branch.
- ✅ Required types exist and are exported as WP-066 references them — `FlatCard` is re-exported from `apps/registry-viewer/src/registry/browser.ts:23` (via `./types/types-index.js`). All of `cost`, `attack`, `recruit`, `victoryPoints`, `recruiterText`, `attackerText`, `abilityText`, `heroClass`, `team`, `rarity`, `edition`, `type`, `name`, `id`, `subtypes` are accessible on `FlatCard`.
- ✅ No naming or ownership conflicts — WP-066's new file names (`useCardViewMode.ts`, `ViewModeToggle.vue`, `CardDataDisplay.vue`) do not collide with existing viewer files.
- ✅ No architectural boundary conflicts at the contract level — WP-066 stays entirely within `apps/registry-viewer/` and only imports Vue + existing type exports.
- ❌ **BLOCKER PS-1 — EC-066 Locked Values table diverges from WP-066 verbatim** (see RS-1 below).
- ❌ **BLOCKER PS-2 — WORK_INDEX.md:1055 marks WP-066 as "Not yet reviewed"** (see RS-2 below).

Structural Readiness gate: **FAIL — two blockers.**

---

### Dependency Contract Verification

Cross-checked every type and file-path claim in WP-066 + EC-066 against the actual source files at `HEAD=7f054e1`.

- ✅ **`FlatCard` is re-exported from `browser.ts`** — confirmed at `apps/registry-viewer/src/registry/browser.ts:23` (via `./types/types-index.js`). WP-066 §Assumes item 2 is true.
- ✅ **Vue 3 Composition API is the established pattern** — four existing composables (`useGlossary.ts`, `useLightbox.ts`, `useResizable.ts`, `useRules.ts`) all use `<script setup>` or `export function useX()` pattern. No Options API in the viewer. WP-066 §Assumes item 3 is true.
- ✅ **`CardDetail.vue` and `CardGrid.vue` exist** at their WP-cited paths — confirmed. WP-066 §Deliverables "Modifications" targets are valid.
- ✅ **`App.vue` exists** — confirmed at `apps/registry-viewer/src/App.vue`. WP-066's toolbar-integration target is valid.
- ✅ **Tailwind presence** — WP-066 §Styling says "Tailwind if already in use, or plain CSS in scoped `<style>` blocks." The viewer's actual convention (per `CLAUDE.md` →"Dark theme, scoped CSS throughout") is **scoped CSS, not Tailwind**. WP text allows either; EC is silent. Locking to scoped CSS in PS-1 eliminates ambiguity. Non-blocking clarification — see RS-6.
- ❌ **EC locked values add rows not in WP** — see PS-1 / RS-1.
- ✅ **`localStorage.cardViewMode` key** — exact spelling verified byte-for-byte between WP line 90 (`cardViewMode`) and EC line 23 (``cardViewMode`` / exact spelling — case-sensitive). Default value (`'image'`) and allowed values (`'image'` | `'data'`) match between both documents.
- ✅ **EC `src/composables/useCardViewMode.ts` file placement** — aligns with the 4 existing composables. WP-066 §Implementation Notes line 239 lists the composable under "Composable Option" but does not lock it as a file. EC formalizes the composable-file choice — this is an EC-level refinement of WP intent, not a verbatim violation (WP permitted it; EC locked it). Permitted under EC-TEMPLATE's right to "pick one of several WP-offered choices." No action needed.
- ✅ **Files the WP calls are actually exported / importable** — `FlatCard` type import from `../registry/browser` (or `../registry/browser.ts`) is the established pattern in CardDetail.vue and CardGrid.vue (per EC-103 commit message `e7d6408`, the relative import paths in those files were fixed to `../registry/browser`). WP-066's new components will follow the same convention.
- ✅ **No forbidden imports required by scope** — WP-066 implementation needs Vue 3, `FlatCard` type, `localStorage`. No `boardgame.io`, no `@legendary-arena/registry` (the viewer uses its own re-exports), no node: imports (browser-only).

Dependency Contract Verification gate: **CONDITIONAL PASS** — one blocker (PS-1), one clarification (RS-6).

---

### Code Category Boundary Check

Verified against `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` and `apps/registry-viewer/CLAUDE.md` §Layer Boundary.

- ✅ All new/modified files live under `apps/registry-viewer/src/` (Client UI category).
- ✅ Each file's category permits its imports and mutations — `src/composables/` for composables (existing pattern), `src/components/` for SFCs (existing pattern).
- ✅ No file blurs category boundaries — no engine imports, no registry-package imports beyond the existing `browser.ts` re-exports, no Node-only imports.
- ✅ No new directory created — `src/composables/` and `src/components/` already exist.

Code Category Boundary gate: **PASS.**

---

### Scope Lock (Critical)

#### WP-066 Is Allowed To

- Create: `apps/registry-viewer/src/composables/useCardViewMode.ts` — composable managing `viewMode` ref + `localStorage` persistence. Public API: `{ viewMode, toggleViewMode }` (see PS-4).
- Create: `apps/registry-viewer/src/components/ViewModeToggle.vue` — button/switch SFC rendering the toggle control.
- Create: `apps/registry-viewer/src/components/CardDataDisplay.vue` — structured data view alternative to image view.
- Modify: `apps/registry-viewer/src/App.vue` — integrate `ViewModeToggle` into the toolbar; call `useCardViewMode()`; pass `viewMode` to detail panel as a prop (or via composable re-call).
- Modify: `apps/registry-viewer/src/components/CardDetail.vue` — conditionally render image view (existing behavior) or `CardDataDisplay` based on `viewMode`.
- Update: viewer `CLAUDE.md` Key Files table if a new composable row should be added (optional; see RS-5).

**File count lock:** 3 new files + 2 modified = 5 authored files. No test files (viewer has no unit-test harness; WP-066 produces no tests per EC §After Completing).

#### WP-066 Is Explicitly Not Allowed To

- Modify `CardGrid.vue` unless strictly necessary (EC §Guardrails). If modified, a DECISIONS.md entry is required; the pre-flight anticipates this as a non-trigger (grid tiles can stay image-only in MVP).
- Modify any `packages/registry/` file, any `packages/game-engine/` file, any `apps/server/` file.
- Modify any existing composable (`useGlossary.ts`, `useLightbox.ts`, `useResizable.ts`, `useRules.ts`).
- Modify any existing `src/lib/*.ts` (registry/theme/glossary clients).
- Introduce new npm dependencies.
- Expose `setViewMode` on the composable's public API (see PS-4 + RS-4).
- Use `.reduce()` in any new code (per `code-style.md` "Patterns to Avoid" list).
- Use abbreviations (`vm` for `viewMode`, `btn` for button, etc.) — full English words only (`code-style.md` Rule 4).
- Store non-`'image' | 'data'` values in `localStorage.cardViewMode`.
- Add URL-driven init for view mode, debug menu, or any other caller for a future `setViewMode` — if any such consumer is needed later, it is out of scope for WP-066 and must be its own WP.

**Rule:** Anything not explicitly allowed is out of scope.

---

### Test Expectations (Locked Before Execution)

- **New tests:** 0. The viewer has no unit-test harness configured at `HEAD=7f054e1` (no `pnpm --filter registry-viewer test` script; no `*.test.ts` files under `apps/registry-viewer/`). EC-066 §After Completing confirms verification is manual (typecheck + lint + build + DevTools-assisted browser smoke test).
- **Existing test changes:** n/a.
- **Prior test baseline:** `pnpm --filter registry-viewer typecheck` exits 0; `pnpm --filter registry-viewer lint` exits 0 errors + 174 cosmetic warnings; `pnpm --filter registry-viewer build` succeeds (60 modules, 866ms). These are the gate values for post-WP-066 verification — warning count may drift ±N from cosmetic churn in new SFCs but **error count must remain 0**.
- **Test boundaries:** no new logic in existing files (other than the two scoped modifications in `App.vue` and `CardDetail.vue`); no `boardgame.io/testing` imports (n/a — no tests); no changes to any shared test helper.
- **Defensive guards:** new composable must handle `localStorage.getItem('cardViewMode')` returning `null` (first visit) or an unexpected value (third-party tampering) — default to `'image'` and write the defaulted value back so the invariant holds on subsequent reads.
- **Manual verification steps (from EC §After Completing):**
  1. `pnpm --filter registry-viewer typecheck` exits 0
  2. `pnpm --filter registry-viewer lint` exits 0 errors
  3. `pnpm --filter registry-viewer build` exits 0
  4. DevTools → Application → Local Storage shows `cardViewMode` key
  5. Toggling updates `localStorage` in real-time
  6. Select card → toggle → toggle back: same card selected, no state loss
  7. Toggling view mode does not reset `searchText`, filters, or `selectedCard`
  8. Data view is printable (browser print preview clean)

**Rule:** Test expectations are locked. If the executor discovers a need for an automated test harness mid-implementation, that is a scope expansion requiring pre-flight re-run — not a silent addition.

---

### Maintainability & Upgrade Readiness (Senior Review)

- ✅ **Extension seam exists:** `viewMode: 'image' | 'data'` is a closed union; adding a third mode later (e.g., `'csv'` or `'printer-friendly'`) requires widening the union, adding a case to the composable's toggle logic, and adding a conditional branch in `CardDetail.vue` — no refactor. Per D-2903 "Semantic naming stability," the name `viewMode` (not `ImageMode` or `DataToggleOn`) is appropriately semantic.
- ✅ **Patch locality:** a future bug fix — e.g., data view shows a stale value, or toggle doesn't persist — localizes to either `useCardViewMode.ts` (persistence / state logic) or `CardDataDisplay.vue` (rendering). No cross-cutting change required.
- ✅ **Fail-safe behavior:** EC §Guardrails + WP §Debuggability invariants lock deterministic defaulting on first visit, defensive handling of null/missing optional fields (em-dash or omit), and no mutation of filter/selection state on toggle. Incorrect `localStorage` values fall through to `'image'` default.
- ✅ **Deterministic reconstructability:** `localStorage` + `FlatCard` props are the only inputs; no hidden runtime logging or side effects. Consistent with viewer's existing composable conventions.
- ✅ **Backward-compatible test surface:** n/a — no existing automated tests. But the defensive handling pattern keeps older `localStorage` states (including absent) valid inputs.
- ✅ **Semantic naming stability:** `useCardViewMode`, `ViewModeToggle`, `CardDataDisplay`, `viewMode`, `toggleViewMode`, `cardViewMode` (localStorage key) are all semantically stable names without MVP-only baggage.

Maintainability gate: **PASS.**

---

### Risk & Ambiguity Review (Resolve Now, Lock for Execution)

#### RS-1 — EC-066 Locked Values table deviates from WP-066 verbatim [HIGH]

**Risk / ambiguity:** EC-066 §Locked Values lists **13** display-label rows including `name` → "Name" and `type` → "Type". WP-066 §Non-Negotiable Constraints (lines 116–127) lists only **11** labels — `name` and `type` are declared FlatCard **required fields** at WP line 112 but have **no WP-prescribed display label**. Per `EC-TEMPLATE.md`: "Locked Values must be copied verbatim from the WP. If formatting or ordering differs, the EC is invalid." This is a verbatim-rule violation.

Additionally, EC locks single values where WP offers choices:
- `recruiterText`: WP "Recruiting Effect" OR "Recruitment"; EC locks "Recruiting Effect" ✅ (legitimate choice-pick)
- `attackerText`: WP "Attack Effect" OR "Combat"; EC locks "Attack Effect" ✅ (legitimate choice-pick)
- `abilityText`: WP "Ability" OR "Card Text"; EC locks "Ability" ✅ (legitimate choice-pick)

Only the **two added rows** (`name`, `type`) are the verbatim violation.

**Impact:** HIGH. Without resolution, the executor inherits contradictory guidance: EC says "`name` → 'Name', `type` → 'Type'"; WP is silent on those labels. Per `.claude/CLAUDE.md` §Execution Checklists "If the EC and WP conflict, the WP wins" — but silence is not conflict, and executor confusion is the predictable failure mode.

**Mitigation:** **PS-1.** Amend WP-066 §Non-Negotiable Constraints to add two rows:
```
- `name` → "Name"
- `type` → "Type"
```
This is the less disruptive resolution (option b in the input file) — adds two rows to the WP. Option a (delete the two EC rows and rely on WP §Scope C "Other Fields" rendering) is also valid but less self-documenting: the two fields are FlatCard required fields and deserve explicit display-label locks.

**Decision / pattern to follow:** Apply option b. WP line 127 `edition → "Edition"` becomes the new penultimate row; add `name → "Name"` and `type → "Type"` as the new final two rows. Once the WP is amended, the EC's 13-row table is verbatim-compliant. No re-run of pre-flight is needed — scope does not change.

#### RS-2 — WORK_INDEX.md status gate unresolved [HIGH]

**Risk / ambiguity:** `docs/ai/work-packets/WORK_INDEX.md:1055` marks WP-066 as `- [ ] WP-066 — Registry Viewer: Card Image-to-Data Toggle (Not yet reviewed)`. Per `.claude/rules/work-packets.md` §"Review Gate": "Any packet marked 'Needs review' must NOT be executed by Claude." Equivalent wording; same gate.

**Impact:** HIGH. This pre-flight **is** the review. Executing without flipping the flag would violate the governance spine.

**Mitigation:** **PS-2.** After PS-1 / PS-3 / PS-4 are resolved, flip WORK_INDEX.md:1055 from `[ ]` "(Not yet reviewed)" to `[x]` "(Reviewed 2026-04-22; pre-flight: `docs/ai/invocations/preflight-wp066.md`)". Commit the flip with the SPEC-prefix convention established by adjacent rows.

**Decision / pattern to follow:** WORK_INDEX flip is the final pre-session action before the execution prompt is generated. Reference the pre-flight verdict file by path in the flip commit message.

#### RS-3 — Un-merged-branch starting state [MEDIUM]

**Risk / ambiguity:** At `HEAD=7f054e1` (branch `wp-083-fetch-time-schema-validation`), WP-066 would start on top of WP-083 (EC-108) + WP-084 (EC-109) work that is **committed on branch but not on `main`**. Starting WP-066 from this branch before WP-083/WP-084 merge to `main` couples WP-066's branch to either:

(a) waiting for WP-083 + WP-084 to land on `main`, then cutting a new `wp-066-...` branch off updated `main`, OR
(b) cutting `wp-066-...` off the current `wp-083-...` branch and merging only after WP-083 + WP-084 merge, OR
(c) cherry-picking WP-083 + WP-084 outcomes into a fresh `wp-066-...` branch off `main`.

Input file's Finding 3 originally called for (a) — this is still the cleanest resolution. The input's specific claim "uncommitted modifications to `apps/registry-viewer/CLAUDE.md` / `index.ts` / `types/index.ts` / `types-index.ts` / `localRegistry.ts`" is **stale**: as of 2026-04-22 those changes are committed, not uncommitted.

**Impact:** MEDIUM. WP-066 reads `apps/registry-viewer/CLAUDE.md` as context; its content at `HEAD=7f054e1` reflects WP-083 + WP-084 outcomes (lines about `src/lib/registryClient.ts` + `themeClient.ts` + `glossaryClient.ts` validation clients; removed auxiliary metadata). Starting from pre-WP-083 `main` would give the executor a different mental model than the committed reality. Starting from post-WP-083/WP-084 branch keeps the mental model correct.

**Mitigation:** **PS-3.** Lock path (a): wait for WP-083 and WP-084 to land on `main`, then cut `wp-066-...` branch off updated `main`. If the user prefers (b) or (c) for scheduling reasons, authorize the alternate path in writing (DECISIONS.md entry or WP amendment) before execution. Do not silently pick a path.

**Decision / pattern to follow:** Path (a) is default. Re-confirm the post-merge state of `apps/registry-viewer/CLAUDE.md` matches WP-066 §Context expectations (specifically the Key Files table, composable list, and Layer Boundary — all of which remain true after WP-083/WP-084).

#### RS-4 — Input Finding 4 (`setViewMode` caller) is factually incorrect [LOW — REJECT]

**Risk / ambiguity:** Input file §4 claims "WP-066 §Scope A specifies the composable returns `{ viewMode, setViewMode, toggleViewMode }`" and recommends auditing callers / dropping `setViewMode`.

**Verification 2026-04-22:** grep for `setViewMode` across the repo returns **only** references inside `docs/ai/invocations/preflight-input-wp066.md` itself. WP-066 text (including the Composable Option example at lines 242–253) returns exactly `{ viewMode, toggleViewMode }`. EC-066 never mentions `setViewMode`. The claim is a fabrication from the triage snapshot — possibly a misread of the WP's example block, possibly drift from an earlier WP draft.

**Impact:** LOW — the claim is false; no action needed against the artifacts. But the claim leaks into the pre-flight record if not disposed of explicitly (per the "External reviewer findings against stale artifact snapshots" pattern in 01.4 §Risk & Ambiguity Review).

**Mitigation:** **PS-4.** Reject Finding 4 as an unverified stale claim. Do **not** amend WP-066 or EC-066. Lock the composable's public API as `{ viewMode, toggleViewMode }` as specified in the WP.

**Decision / pattern to follow:** WP-066's exported shape is `{ viewMode, toggleViewMode }` — the executor must not add `setViewMode`. This protects against dead-code surface per `.claude/rules/architecture.md` "Prohibited AI Failure Patterns."

#### RS-5 — Viewer `CLAUDE.md` composable list is incomplete [LOW, non-blocking]

**Risk / ambiguity:** `apps/registry-viewer/CLAUDE.md` Key Files table lists only 2 composables (`useRules.ts`, `useGlossary.ts`). Actual `ls apps/registry-viewer/src/composables/` returns 4 (`useGlossary.ts`, `useLightbox.ts`, `useResizable.ts`, `useRules.ts`). Documentation drift pre-existing WP-066; not introduced by it.

**Impact:** LOW. Does not block WP-066. But WP-066 §Context directs the executor to read viewer `CLAUDE.md` for pattern understanding — the incomplete list under-represents the established composable pattern.

**Mitigation:** Optional during WP-066 execution: when `useCardViewMode.ts` is added, update the viewer `CLAUDE.md` Key Files table to include the new composable AND back-fill the two missing rows (`useLightbox.ts`, `useResizable.ts`). Alternatively, defer the back-fill to a follow-up documentation WP — the critical path does not depend on it.

**Decision / pattern to follow:** If the executor touches viewer `CLAUDE.md` at all, adding a `useCardViewMode.ts` row is in-scope. Back-filling missing rows is permitted as a "while I'm there" doc fix **because** documentation drift doesn't violate `code-style.md` "no unsolicited refactors" (docs are not code). Optional, not blocking.

#### RS-6 — Styling convention (Tailwind vs scoped CSS) [LOW, clarify and lock]

**Risk / ambiguity:** WP-066 §Styling allows "Tailwind if already in use, or plain CSS in scoped `<style>` blocks." Viewer `CLAUDE.md` says "Dark theme, scoped CSS throughout." Viewer `package.json` has no Tailwind dependency. The WP's "Tailwind if already in use" clause is **vacuously not-in-use** — no Tailwind present.

**Impact:** LOW. Ambiguity resolves by elimination: scoped CSS is the only permitted choice.

**Mitigation:** Lock for execution — **scoped CSS in `<style scoped>` blocks only**. No Tailwind, no CSS modules, no new CSS framework. Existing viewer dark-theme conventions (CSS custom properties, if any) should be reused.

**Decision / pattern to follow:** The session prompt must state "Styling: scoped CSS matching the viewer's existing dark-theme convention." This removes the Tailwind fork from the WP text without amending the WP (WP text remains accurate — Tailwind genuinely is an option elsewhere in the project, just not here).

#### RS-7 — Acceptance-criteria count exceeds lint guideline [LOW, accept-with-rationale]

**Risk / ambiguity:** WP-066 has ~21 binary Definition-of-Done items (WP lines 263–281). `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` §14 recommends 6–12 AC items per WP. All 21 items are observable and binary, so this is not a hard FAIL — but it does exceed the guideline.

**Impact:** LOW. A long AC list adds verification overhead but does not compromise scope lock.

**Mitigation:** **Accept with rationale** — WP-066 is a UI-feature WP with many independently-verifiable surface behaviors (toggle mechanics, persistence, state-preservation across toggles, print-cleanliness, filter-interaction, etc.). Each is genuinely binary and worth an AC row. Consolidation (e.g., "toggle works" covering 5 sub-behaviors) would reduce the count but weaken the verification contract. Prefer the long list.

**Decision / pattern to follow:** No AC consolidation required. Lint-gate observation logged here; verdict does not downgrade.

---

### STOP-Gate Status

STOP gates are conditions that halt execution unless explicitly resolved.

| Gate | Status | Resolution path |
|---|---|---|
| `.claude/rules/work-packets.md` Review Gate | ❌ FAIL | PS-2 |
| `.claude/CLAUDE.md` Lint Gate (EC-TEMPLATE verbatim) | ❌ FAIL | PS-1 |
| WP §Assumes blocking conditions | ✅ PASS | Viewer builds + runs; `FlatCard` accessible; Composition API standard; `localStorage` available; no new deps planned — verified. |
| Branch sequencing | ⚠ PENDING | PS-3 |
| Stale input claim disposition | ⚠ PENDING | PS-4 (reject, not modify) |

---

### External Review / Input Triage Disposition Log

Per the "External reviewer findings against stale artifact snapshots" pattern (01.4 Established Patterns, WP-030 precedent), each input-file claim is explicitly dispositioned:

| Input Finding | Claim | Disposition | Reason |
|---|---|---|---|
| 1 | WP/EC display-label mismatch (EC has 13 rows, WP has 11; EC adds `name`/`type`) | ✅ **ACCEPT** | Re-verified byte-for-byte at `HEAD=7f054e1`. EC-TEMPLATE verbatim rule violated. Resolved as PS-1. |
| 2 | WORK_INDEX.md:1055 marks WP-066 "Not yet reviewed" | ✅ **ACCEPT** | Re-verified at WORK_INDEX.md:1055. Resolved as PS-2. |
| 3 | Dirty-tree blocker on `wp-084-...` branch with 5 uncommitted viewer files | ⚠ **ACCEPT WITH EVOLUTION** | Original claim is stale: those files are now committed on `wp-083-...` branch (commits `b250bf1` + `601d6fc`). The substantive concern (start from post-WP-083/WP-084 state) survives as PS-3. |
| 4 | WP-066 §Scope A specifies `{ viewMode, setViewMode, toggleViewMode }`; no known caller for `setViewMode` | ❌ **REJECT** | Re-verified: `setViewMode` appears nowhere in WP-066, EC-066, or the viewer source. The claim is a fabrication. The composable API is locked as `{ viewMode, toggleViewMode }` (PS-4). |
| (Verified repo facts — browser.ts re-exports FlatCard, 4 existing composables, CardDetail+CardGrid exist, no dependencies) | 4 sub-claims | ✅ **ACCEPT** | All re-verified against `HEAD=7f054e1`. |
| (Lint-gate observation — 21 AC items exceeds 6–12 guideline; no tests) | 2 sub-claims | ✅ **ACCEPT WITH RATIONALE** | AC-count accepted (RS-7); no-test-coverage correctly N/A. |

---

### Pre-Flight Verdict (Binary)

❌ **DO NOT EXECUTE YET.**

**Justification:** Four pre-session actions are required before WP-066 execution may proceed: (PS-1) reconcile the EC-066 vs WP-066 verbatim violation by adding `name` and `type` display-label rows to WP-066 §Non-Negotiable Constraints; (PS-2) flip WORK_INDEX.md:1055 from "Not yet reviewed" to reviewed after PS-1/PS-3/PS-4 resolve; (PS-3) land WP-083 + WP-084 on `main` and cut `wp-066-...` off updated `main` (or explicitly authorize an alternate branching path); (PS-4) reject Finding 4's `setViewMode` claim and lock the composable API as `{ viewMode, toggleViewMode }`. Structural readiness of the viewer is otherwise clean: typecheck 0 errors, lint 0 errors, build succeeds; `FlatCard` is fully accessible via `browser.ts`; composables and components cited by the WP all exist. No architectural boundary or layer violations are anticipated; WP-066 stays entirely within `apps/registry-viewer/` and uses only Vue 3 built-ins plus existing viewer type exports. Once PS-1 through PS-4 are resolved on paper, the verdict flips to ✅ **READY TO EXECUTE** without a pre-flight re-run — none of the pre-session actions change scope, introduce new architectural concerns, or modify the locked 5-file scope.

---

### Invocation Prompt Conformance Check (Pre-Generation)

This check applies once the verdict is READY. Pre-conditions to verify when generating `docs/ai/invocations/session-wp066-registry-viewer-data-toggle.md`:

- [ ] All EC-066 locked values copied verbatim (after PS-1 amends WP-066 to include `name` / `type` rows, both documents match; session prompt cites both)
- [ ] No new keywords, helpers, file paths, or timing rules introduced beyond EC + WP
- [ ] File paths match exactly: `src/composables/useCardViewMode.ts`, `src/components/ViewModeToggle.vue`, `src/components/CardDataDisplay.vue`, `src/App.vue`, `src/components/CardDetail.vue`
- [ ] No forbidden imports (`boardgame.io`, `@legendary-arena/game-engine`, `@legendary-arena/server`, `pg`, `node:*` modules in browser-bundled code)
- [ ] The session prompt locks styling to "scoped CSS in `<style scoped>` blocks matching existing viewer dark-theme convention" (RS-6 resolution)
- [ ] The session prompt locks the composable public API to `{ viewMode, toggleViewMode }` — no `setViewMode` (PS-4 resolution)
- [ ] The session prompt states "No test harness; verification is typecheck + lint + build + manual browser smoke test per EC §After Completing"
- [ ] The session prompt includes a `// why:` comment requirement for the `cardViewMode` localStorage key name (EC §Required `// why:` Comments)
- [ ] The session prompt does not resolve any ambiguity not resolved in this pre-flight
- [ ] The session prompt explicitly declares **01.5 NOT INVOKED** (purely additive WP; no `LegendaryGameState` field change, no `buildInitialGameState` shape change, no `LegendaryGame.moves` entry, no phase hook — all four criteria absent, WP-030 precedent)

**Rule:** The invocation prompt is a transcription + ordering artifact. Any interpretation required means pre-flight is incomplete — escalate back to this document.

---

### Authorized Next Step

**Verdict is DO NOT EXECUTE YET.** Do **not** generate a session execution prompt until the four pre-session actions complete.

**Pre-Session Actions — REQUIRED:**

1. **PS-1 — WP-066 verbatim amendment.** Edit `docs/ai/work-packets/WP-066-registry-viewer-data-toggle.md` §Non-Negotiable Constraints "Field display names" block: insert `- `name` → "Name"` and `- `type` → "Type"` as the final two rows of the list (after `- `edition` → "Edition"`). Commit with `SPEC:` prefix. No code impact; scope unchanged.

2. **PS-3 — Branch landing.** Merge `wp-083-fetch-time-schema-validation` to `main` (includes both WP-083 and WP-084 commits per the linear branch history). After merge, cut `wp-066-registry-viewer-data-toggle` off updated `main`. If scheduling requires an alternate path, authorize in writing before starting the session.

3. **PS-4 — Disposition lock.** No file changes — simply confirm in the subsequent session prompt that `setViewMode` is not part of the composable API. Reference this pre-flight's RS-4 and Disposition Log row.

4. **PS-2 — WORK_INDEX flip.** After PS-1 + PS-3 + PS-4 are resolved, edit `docs/ai/work-packets/WORK_INDEX.md:1055` from `- [ ] WP-066 — Registry Viewer: Card Image-to-Data Toggle (Not yet reviewed)` to `- [x] WP-066 — Registry Viewer: Card Image-to-Data Toggle (Reviewed 2026-04-22; pre-flight: docs/ai/invocations/preflight-wp066.md)`. Commit with `SPEC:` prefix. This is the final pre-session action.

Once all four complete, log their resolution here:

```
**Pre-session actions — ALL RESOLVED (YYYY-MM-DD):**

1. PS-1: WP-066 amended to add `name` → "Name" and `type` → "Type" display-label rows (commit <hash>). EC-066 now verbatim-compliant.
2. PS-3: WP-083 + WP-084 merged to main (commit <hash>); wp-066-... branch cut off updated main (branch created <hash>). Viewer CLAUDE.md post-merge state verified against WP-066 §Context — no drift.
3. PS-4: setViewMode claim rejected on the record; composable API locked as { viewMode, toggleViewMode } in session prompt.
4. PS-2: WORK_INDEX.md:1055 flipped to reviewed (commit <hash>).

All mandatory pre-session actions are complete. No re-run of pre-flight required — these updates resolve risks identified by this pre-flight without changing scope.
```

After logging, proceed to step 1b (copilot check per `docs/ai/REFERENCE/01.7-copilot-check.md`), then step 2 (session execution prompt generation) at `docs/ai/invocations/session-wp066-registry-viewer-data-toggle.md`.

---

### Final Instruction

Pre-flight exists to prevent premature execution and scope drift.

WP-066 is a small, well-scoped UI feature with clean structural readiness. The four pre-session actions are all procedural (one text amendment, one branch operation, one disposition record, one WORK_INDEX flip) — none require re-design, scope change, or new tests. Expected resolution effort: under 30 minutes of human-supervised time.

**Do not generate the session prompt until all four pre-session actions are recorded above as RESOLVED.**
