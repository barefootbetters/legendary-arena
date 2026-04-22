# Copilot Check — WP-066 (Registry Viewer: Card Image-to-Data Toggle)

**Date:** 2026-04-22
**Pre-flight verdict under review:** READY TO EXECUTE (post-PS-1..PS-4 resolution, 2026-04-22; `docs/ai/invocations/preflight-wp066.md`)
**Inputs reviewed:**
- EC: `docs/ai/execution-checklists/EC-066-registry-viewer-data-toggle.checklist.md`
- WP: `docs/ai/work-packets/WP-066-registry-viewer-data-toggle.md` (post-PS-1 amendment, 13-row display-label table)
- Pre-flight: `docs/ai/invocations/preflight-wp066.md`
- Triage input: `docs/ai/invocations/preflight-input-wp066.md`

---

## Overall Judgment

**CONFIRM** (with 4 normative RISK findings whose FIXes must be embedded in the session prompt)

The pre-flight's READY TO EXECUTE verdict holds. WP-066 is a well-scoped Client UI feature with no engine contact, no `G` mutation, no `boardgame.io` imports, no new persistence classes, and no canonical drift-array changes. Of the 30 failure-mode lenses, 26 return clean PASS; 4 surface minor RISK findings — two substantive session-prompt locks needed (#21 localStorage string narrowing; #22 localStorage.setItem error handling), one pre-acknowledged known-gap accepted at pre-flight RS-7 (#11 no viewer test harness), one pre-existing governance gap also affecting WP-060/082/083 (#13 `apps/registry-viewer/` unclassified in `02-CODE-CATEGORIES.md`). None are BLOCK-class; none cause determinism or architectural damage. The two substantive FIXes are wording-only and scope-neutral — they inform the session prompt without amending EC/WP/pre-flight or expanding the 5-file allowlist. No HOLD cycle required; no pre-flight re-run required; session prompt generation authorized conditional on prompt incorporating the four normative requirements below.

---

## Findings

Grouped by the 11 categories in `01.7-copilot-check.md`. 26 PASS findings are consolidated; 4 RISK findings are detailed individually.

### Category 1: Separation of Concerns & Boundaries

1. **Engine vs UI / App Boundary Drift** — PASS. Pre-flight §Scope Lock and EC-066 §Guardrails confine all edits to `apps/registry-viewer/src/`. No `packages/game-engine/`, `packages/registry/`, `packages/preplan/`, `apps/server/`, `pg`, or `boardgame.io` imports needed or permitted. Pre-flight §Code Category Boundary Check verifies.

9. **UI Re-implements or Re-interprets Engine Logic** — PASS. WP is pure presentation: two view modes rendering the same `FlatCard` (already a registry-side projection). No engine state, no game rules, no move dispatch, no turn semantics.

16. **Lifecycle Wiring Creep** — PASS. Pre-flight §Invocation Prompt Conformance mandates the session prompt declare **"01.5 NOT INVOKED"** with all four criteria absent (no `LegendaryGameState` field change, no `buildInitialGameState` shape change, no `LegendaryGame.moves` entry, no phase hook). WP-030 precedent applied. `game.ts` is out of the viewer tree entirely.

29. **Assumptions Leaking Across Layers** — PASS. Engine unaware of viewer. Viewer consumes only `FlatCard` re-exported from `browser.ts:23`. No engine projection reads, no runtime registry access beyond the fetch-boundary validation established by WP-083.

### Category 2: Determinism & Reproducibility

2. **Non-Determinism Introduced by Convenience** — PASS. `.claude/rules/code-style.md` §"Patterns to Avoid" blanket-bans `Math.random()` repo-wide; pre-flight §Authority Chain cites this rule. Viewer is a client SPA with no replay dependency — determinism framing is engine-scoped but the blanket prohibition still applies. No `Math.random` / `Date.now` / locale-dependent logic needed by WP-066 scope (toggle + storage + rendering).

8. **No Single Debugging Truth Artifact** — PASS. WP-066 §Debuggability locks three deterministic debug surfaces: (a) `localStorage.cardViewMode` via DevTools → Application → Local Storage, (b) Vue DevTools for reactive state, (c) state-preservation invariant across toggle. No ambient state; no hidden side effects.

23. **Lack of Deterministic Ordering Guarantees** — PASS. WP introduces no iteration order semantics. `CardGrid.vue` / `CardDetail.vue` existing sort/filter logic is out of scope (pre-flight §Scope Lock forbids modifying `CardGrid.vue` unless strictly necessary).

### Category 3: Immutability & Mutation Discipline

3. **Confusion Between Pure Functions and Immer Mutation** — PASS. No Immer. No `G` draft. No move context. Composable uses Vue's `ref` (reactive primitive with assignment semantics, not Immer). Rendering is declarative via `<template>`.

17. **Hidden Mutation via Aliasing** — PASS. No `G` projections. No shared array references. `FlatCard` passes as a prop (Vue convention: props are read-only at the child boundary). The composable returns its own `ref` — consumer reads `viewMode.value`, never mutates `FlatCard`.

### Category 4: Type Safety & Contract Integrity

4. **Contract Drift Between Types, Tests, and Runtime** — PASS. `FlatCard` is the consumed contract, re-exported from `apps/registry-viewer/src/registry/browser.ts:23` via `./types/types-index.js`. EC-066 §Locked Values pins the 13 display-label rows byte-for-byte with WP-066 (post-PS-1). No canonical readonly arrays introduced (viewer has no drift-detection array surface).

5. **Optional Field Ambiguity (`exactOptionalPropertyTypes`)** — PASS. WP-066 §Non-Negotiable Constraints locks that optional `FlatCard` fields (`cost?`, `attack?`, etc.) render as em-dash or omit. `CardDataDisplay.vue` reads out of an already-validated `FlatCard` — no object-literal construction where `exactOptionalPropertyTypes` would bite. The composable's shape `{ viewMode: Ref<'image' | 'data'>, toggleViewMode: () => void }` has no optional fields.

6. **Undefined Merge Semantics (Replace vs Append)** — PASS. No merge logic. `localStorage.setItem('cardViewMode', nextValue)` is replace-only. Toggle flips between exactly two values.

10. **Stringly-Typed Outcomes and Results** — PASS. `viewMode: 'image' | 'data'` is a narrow literal union per WP-066 §Implementation Notes line 244 `ref<'image' | 'data'>(...)`. EC-066 §Locked Values pins the union exhaustively. No free-form strings in the composable API.

21. **Type Widening at Boundaries** — **RISK**. `localStorage.getItem('cardViewMode')` returns `string | null`. EC-066 §Conditional Logic mandates `'image' | 'data'` semantics but does not lock the runtime narrowing. If the executor writes `viewMode.value = raw as 'image' | 'data'` without a runtime check, a stale `localStorage` value (user tampering, legacy key reuse, a value from a future `'csv'` mode mistakenly persisted by pre-release code) would poison the union and every downstream `switch (viewMode.value)` or `if (viewMode.value === 'data')` path would misclassify it. The "defensive guards" bullet in pre-flight §Test Expectations mentions defaulting to `'image'` on null, but does not lock the narrowing for unexpected non-null strings.
   **FIX:** the session prompt must lock a **discriminated narrowing** pattern for the composable's mount-time read — reject any value that is not exactly `'data'`, defaulting to `'image'` in all other cases:
   ```typescript
   // why: localStorage returns string | null; explicit narrowing rejects
   // stale or tampered values that would poison the discriminated union.
   const stored = localStorage.getItem('cardViewMode');
   const initial: 'image' | 'data' = stored === 'data' ? 'data' : 'image';
   ```
   Not `stored === 'image' ? 'image' : stored === 'data' ? 'data' : 'image'` (open nested ternary — forbidden by 00.6 Rule 3). Not a generic `as` cast (widening hole). The one-line ternary compares against the single non-default literal and defaults everything else to `'image'`. Plus an `if` block is also acceptable per 00.6 Rule 3. The session prompt must also mandate writing the narrowed value back to `localStorage` on mount so the invariant holds on subsequent reads (self-healing on malformed values). Scope-neutral (wording in session prompt §Locked Behaviors; no EC/WP/pre-flight amendment).

27. **Weak Canonical Naming Discipline** — PASS. `viewMode`, `toggleViewMode`, `useCardViewMode`, `ViewModeToggle`, `CardDataDisplay`, `cardViewMode` (localStorage key) — all full-word, no abbreviations, match `.claude/rules/code-style.md` Rule 4 / 14. Naming is semantically stable (no `V1`, `Simple`, `Temp`).

### Category 5: Persistence & Serialization

7. **Persisting Runtime State by Accident** — PASS. `localStorage` is a deliberate, documented user-preference channel (named explicitly in WP and EC). Not `G`; not engine state; not a snapshot. Stored value is a narrow string literal. Pre-flight §Input Data Traceability §"Setup-Time Derived Data" confirms n/a.

19. **Weak JSON-Serializability Guarantees** — PASS. Persisted payload is a two-value string literal union. No objects, Maps, Sets, functions, or class instances. `localStorage` serializes strings natively — no JSON wrapping, no roundtrip risk.

24. **Mixed Persistence Concerns** — PASS. The viewer has three clearly separated persistence channels: (a) `public/registry-config.json` for build-time config, (b) R2 fetches for runtime card/theme/glossary data, (c) `localStorage` for user preferences. WP-066 adds exactly one key to (c). No crossover.

### Category 6: Testing & Invariant Enforcement

11. **Tests Validate Behavior, Not Invariants** — **RISK (pre-acknowledged)**. `apps/registry-viewer/` has no automated test harness at `HEAD=5d72235` (no `pnpm --filter registry-viewer test` script; no `*.test.ts` files in tree). WP-066 produces 0 tests. Pre-flight §Test Expectations accepts this with rationale; pre-flight RS-7 dispositioned the related AC-count observation as accept-with-rationale. **This is a repo-level known state, not a WP-066 regression** — the viewer has never had tests; WP-060, WP-082, WP-083, EC-103 all modified the viewer without adding any. A future harness-establishment WP is the right venue; pulling it into WP-066 would be scope creep.
   **FIX:** already captured at pre-flight RS-7; no additional action. Session prompt must explicitly state "verification is manual (typecheck + lint + build + DevTools smoke test per EC §After Completing); no automated test harness for the viewer exists at baseline and WP-066 does not introduce one." Scope-neutral (documentation-only).

### Category 7: Scope & Execution Governance

12. **Scope Creep During "Small" Packets** — PASS. Pre-flight §Scope Lock enumerates: **3 new files** (`useCardViewMode.ts`, `ViewModeToggle.vue`, `CardDataDisplay.vue`) + **2 modified files** (`App.vue`, `CardDetail.vue`) = 5 authored files. Forbidden list covers all six neighboring file families (no `CardGrid.vue`, no `packages/*`, no existing composables, no existing `src/lib/*.ts`, no new deps, no `setViewMode` surface). "Anything not explicitly allowed is out of scope" cited. Pre-commit review can verify via `git diff --name-only main..HEAD`.

13. **Unclassified Directories and Ownership Ambiguity** — **RISK (pre-existing)**. `apps/registry-viewer/` is not enumerated in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md` §Category Summary. The `client-app` row covers `apps/arena-client/` only; `cli-producer-app` covers `apps/replay-producer/`. WP-060/EC-106, WP-082/EC-107, WP-083/EC-108, EC-103 all modified the viewer without this being a WP-specific blocker — the precedent is that the viewer is implicitly a client-category cousin governed by `apps/registry-viewer/CLAUDE.md`. **This is a repo-level governance gap, not WP-066's fault.**
   **FIX:** do NOT fold into WP-066 scope (that would be scope creep). Flag in the session prompt under a "Known pre-existing issues, not addressed by this WP" section so the executor doesn't attempt to fix mid-execution. A future docs-housekeeping WP should add a `registry-viewer-app` row to `02-CODE-CATEGORIES.md` citing the EC-103/EC-106/EC-107/EC-108 precedent. Scope-neutral to WP-066.

30. **Missing Pre-Session Governance Fixes** — PASS. Pre-flight §Pre-Session Actions enumerated PS-1 through PS-4 with explicit resolution criteria. All four are now resolved on record: PS-1 (commit `5d72235`, 13-row display-label amendment), PS-3 (branch ops: wp-083/wp-084 merged to main at `5d72235`; wp-066 branch cut at same SHA), PS-4 (setViewMode claim rejected in preflight §External Review Disposition Log), PS-2 (commit `bcbae3a`, WORK_INDEX flip). Governance bundle closed.

### Category 8: Extensibility & Future-Proofing

14. **No Extension Seams for Future Growth** — PASS. `viewMode: 'image' | 'data'` union widens cleanly to a third mode (e.g., `'printer-friendly'`) by extending the union, adding one branch to the toggle function, and adding one conditional in `CardDetail.vue`. `CardDataDisplay.vue` renders a field map that can accept new `FlatCard` fields without refactor. Per pre-flight §Maintainability item "Extension seam exists."

28. **No Upgrade or Deprecation Story** — PASS. First visit defaults to `'image'` (absent `localStorage.cardViewMode` is a valid state). No migration from prior versions needed — key is new. Future deprecation (if ever): remove the key, default back to `'image'`. Pre-flight §Maintainability "Backward-compatible test surface" item confirms older `localStorage` states (including absent) remain valid inputs.

### Category 9: Documentation & Intent Clarity

15. **Missing "Why" for Invariants and Boundaries** — PASS. EC-066 §"Required `// why:` Comments" enumerates three mandatory `// why:` comments:
- `src/composables/useCardViewMode.ts` — why `cardViewMode` key name
- `App.vue` onMounted — why `viewMode` is read from localStorage on mount
- `App.vue` toggle handler — why the localStorage update + reactive state sync

The RISK #21 FIX adds a fourth `// why:` on the narrowing pattern; the RISK #22 FIX adds a fifth on the localStorage.setItem error swallow. Both are consistent with `.claude/rules/code-style.md` Rule 6 (`// why:` explains non-obvious logic) and Rule 11 (catch-block swallows require `// why:`). No `ctx.events.*` / `ctx.random.*` calls exist in WP-066 scope.

20. **Ambiguous Authority Chain** — PASS. Pre-flight §Authority Chain enumerates 10 documents in order: `.claude/CLAUDE.md` > `ARCHITECTURE.md` > `.claude/rules/architecture.md` > `.claude/rules/code-style.md` > `.claude/rules/work-packets.md` > `apps/registry-viewer/CLAUDE.md` > `EC-TEMPLATE.md` > EC-066 > WP-066 > triage input. The CLAUDE.md rule "If EC and WP conflict, WP wins" governs the specific PS-1 reconciliation (which is now resolved).

26. **Implicit Content Semantics** — PASS. EC-066 §Locked Values + §Guardrails pin every prose meaning: `'image'` | `'data'` union (allowed values), `'image'` default on first visit, em-dash (—) or omit for null/empty, both modes render identical selected card, toggling does NOT reset selectedCard / filters / search. No convention-based meaning remains unwritten.

### Category 10: Error Handling & Failure Semantics

18. **Outcome Evaluation Timing Ambiguity** — PASS. Toggle flips `viewMode.value` synchronously with `localStorage.setItem(...)`. Vue's reactivity schedules a re-render deterministically; template-level `v-if` / `<component :is>` branching is resolved on the next tick. No lifecycle race window. EC §Guardrails: "localStorage must persist: closing/reopening browser should restore."

22. **Silent Failure vs Loud Failure Decisions Made Late** — **RISK**. If `localStorage.setItem('cardViewMode', ...)` throws (quota exceeded; iOS Safari private browsing mode historically; enterprise group-policy restrictions), neither EC-066 nor WP-066 locks the failure policy. WP-066 §Assumes line 48 declares `localStorage` available as a **precondition**, which is the right defensive posture — but it doesn't say what to do if the precondition holds at mount-time (`getItem` works) and fails later at toggle-time (`setItem` throws). Silent swallow is the right UI-feature policy (in-memory `viewMode` still updates; persistence is best-effort) — but it must be locked explicitly with a `// why:` per `.claude/rules/code-style.md` Rule 11 / 15.
   **FIX:** the session prompt must lock a **try/catch around `localStorage.setItem`** in the composable's toggle function, with a required `// why:` comment:
   ```typescript
   function toggleViewMode(): void {
     viewMode.value = viewMode.value === 'image' ? 'data' : 'image';
     try {
       localStorage.setItem('cardViewMode', viewMode.value);
     } catch (error) {
       // why: localStorage.setItem may throw in iOS Safari private browsing
       // mode or when storage quota is exceeded. The in-memory viewMode ref
       // is already updated above, so the UI remains functional — only
       // cross-reload persistence is lost. Silent swallow preserves UX;
       // 00.6 Rule 11 full-sentence swallow documentation required.
     }
   }
   ```
   The mount-time `localStorage.getItem` read in `useCardViewMode` does not need a try/catch: `getItem` is specified to return `null` (not throw) when storage is inaccessible in all modern browsers. Only `setItem` throws under quota/policy conditions. Scope-neutral (wording in session prompt §Locked Behaviors; no EC/WP/pre-flight amendment).

### Category 11: Single Responsibility & Logic Clarity

25. **Overloaded Function Responsibilities** — PASS. Single responsibility per file:
- `useCardViewMode.ts` — manage `viewMode` ref + persist
- `toggleViewMode()` — flip and persist
- `ViewModeToggle.vue` — render control, invoke toggle
- `CardDataDisplay.vue` — render structured FlatCard data
- `App.vue` modification — wire composable + prop-pass
- `CardDetail.vue` modification — conditional render based on viewMode

None of these cross into merging, validation (beyond narrowing), evaluation, or engine-adjacent mutation.

---

## Mandatory Governance Follow-ups

**None required for WP-066 execution.** Two pre-existing repo-wide governance gaps surfaced by the lens, neither blocking WP-066:

- **`02-CODE-CATEGORIES.md` registry-viewer row (Finding #13, pre-existing):** a future docs-housekeeping WP should add a `registry-viewer-app` row citing `apps/registry-viewer/CLAUDE.md` + the EC-103/EC-106/EC-107/EC-108 modification precedent. **Flag in session prompt §"Known pre-existing issues, not addressed by this WP."**
- **Viewer test harness (Finding #11, pre-acknowledged):** independent future WP; not in WP-066 scope.

No new `DECISIONS.md` entry required — all findings have precedent (WP-030 for 01.5-NOT-INVOKED; WP-083 for pre-existing-governance-gap handling; WP-060/082/083 for viewer no-test precedent).

---

## Normative Requirements for Session Prompt (Step 2)

The session prompt at `docs/ai/invocations/session-wp066-registry-viewer-data-toggle.md` must incorporate the following four normative requirements, each derived from a RISK finding above. These are **locked session behaviors**, not new scope:

1. **#21 FIX — localStorage value narrowing:** the composable's mount-time read uses `stored === 'data' ? 'data' : 'image'` (or equivalent `if`-block narrowing). Any non-`'data'` value defaults to `'image'`. Required `// why:` comment explaining the discriminated narrowing.

2. **#22 FIX — localStorage.setItem error swallow:** the composable's toggle function wraps `localStorage.setItem(...)` in try/catch with required `// why:` per 00.6 Rule 11. Silent swallow; in-memory `viewMode.value` update runs before the try/catch so UI remains functional.

3. **#11 FIX — explicit no-test-harness declaration:** the session prompt states "verification is manual (typecheck + lint + build + DevTools smoke test per EC §After Completing); no automated test harness for the viewer exists at baseline and WP-066 does not introduce one."

4. **#13 FIX — pre-existing governance gap flagged, not fixed:** the session prompt includes a "Known pre-existing issues, not addressed by this WP" section listing: `apps/registry-viewer/` not classified in `02-CODE-CATEGORIES.md` (repo-wide gap; future docs-housekeeping WP).

Additionally, the session prompt must state the 01.5 runtime-wiring allowance is **NOT INVOKED** per pre-flight §Invocation Prompt Conformance (WP-030 precedent; four criteria enumerated and marked absent).

---

## Pre-Flight Verdict Disposition

- [x] **CONFIRM** — Pre-flight READY TO EXECUTE verdict stands. Session prompt generation authorized, conditional on the four normative requirements above being embedded in the prompt.
- [ ] HOLD — not selected. The 4 RISK findings are scope-neutral (wording in session prompt only; no EC/WP/pre-flight amendment; no allowlist expansion; no new contract; no mutation boundary move). HOLD would trigger a re-run cycle that has no new inputs to evaluate.
- [ ] SUSPEND — not selected. No finding requires allowlist change, mutation-boundary move, or new contract introduction.

**Authorized:** proceed to step 2 (session prompt generation) at `docs/ai/invocations/session-wp066-registry-viewer-data-toggle.md`.

**Next-step conformance check:** the generated session prompt must embed requirements #21 / #22 / #11 / #13 above verbatim (or equivalent full-sentence lock). If any is missing or softened, the prompt fails pre-flight §Invocation Prompt Conformance Check — and must not be used for step 3 execution.
