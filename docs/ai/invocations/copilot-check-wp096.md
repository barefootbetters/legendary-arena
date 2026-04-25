# Copilot Check — WP-096 (Registry Viewer: Grid Data View Mode)

**Date:** 2026-04-25
**Pre-flight verdict under review:** READY TO EXECUTE — conditional on PS-1, PS-2, PS-3 (`docs/ai/invocations/preflight-wp096-registry-viewer-grid-data-view.md`, 2026-04-25)
**Inputs reviewed:**
- EC: `docs/ai/execution-checklists/EC-096-registry-viewer-grid-data-view.checklist.md`
- WP: `docs/ai/work-packets/WP-096-registry-viewer-grid-data-view.md`
- Pre-flight: `docs/ai/invocations/preflight-wp096-registry-viewer-grid-data-view.md`

---

## Overall Judgment

**CONFIRM** (Re-run 2026-04-25, post-PS-1..PS-3 + FIX 4 resolution).

**Initial pass (2026-04-25, pre-resolution):** HOLD — four scope-neutral RISK findings (#27 naming-discipline, Cross-cutting A forbidden-imports overstatement, Cross-cutting B session-context misframing, #13 unclassified directory governance follow-up). No BLOCK-class items.

**Re-run (2026-04-25, post-resolution):** all four FIXes landed as scope-neutral wording / docs additions:

1. **#27 (PS-1)** — User chose Option A; WP-096 §Non-Negotiable Constraints, §Locked Values rows 3 + 8, §Scope (In) B, §Acceptance Criteria B6, §Definition of Done D-9601 line, plus EC-096 §Locked Values labels line, §Required `// why:` Comments JSDoc bullet, and §After Completing DECISIONS line all updated to acknowledge the deliberate `Set` / `setAbbr` tile-compaction divergence from sidebar `Edition` / `setName`. D-9601 will capture the rationale at execution close.
2. **Cross-cutting A (PS-2)** — WP-096 §Non-Negotiable Constraints "No layer leaks" bullet and EC-096 §Guardrails imports line both now distinguish the Node-bearing `@legendary-arena/registry` barrel (forbidden) from narrow Zod-schema subpaths (permitted by the layer rule, not needed in scope).
3. **Cross-cutting B (PS-3)** — WP-096 §Session Context reframed; §Context (Read First) post-mortem reference updated to match.
4. **#13 (FIX 4)** — WORK_INDEX.md gained a "(deferred placeholder)" tracker line for the `02-CODE-CATEGORIES.md` classification of `apps/registry-viewer/`, with two acceptable resolution paths enumerated. Scope-neutral docs-only addition; WP-096's allowlist unchanged.

No file was added or removed from WP-096's scope. No contract changed. No test count changed. The pre-flight verdict (READY TO EXECUTE — conditional on PS-1..PS-3) is now unconditional. **Session prompt generation authorized** per `01.4 §Authorized Next Step`.

The 30-issue scan now returns 30 PASS / 0 RISK / 0 BLOCK. Findings detail below preserves the original RISK framing for audit purposes; each is individually marked RESOLVED with the resolution citation.

---

## Findings

Grouped by the 11 categories in `01.7-copilot-check.md`. Twenty-six PASS findings are consolidated; four RISK findings are detailed individually. `BLOCK` reserved for the overall verdict — none assigned.

### Category 1: Separation of Concerns & Boundaries

1. **Engine vs UI / App Boundary Drift** — PASS. WP-096 §Non-Negotiable Constraints + EC-096 §Guardrails confine all edits to `apps/registry-viewer/src/components/`. No `packages/game-engine/`, `packages/registry/` runtime barrel, `packages/preplan/`, `apps/server/`, `pg`, or `boardgame.io` import is permitted. Pre-flight §Code Category Boundary Check verifies. Same envelope as WP-066 / WP-094.

9. **UI Re-implements or Re-interprets Engine Logic** — PASS. WP is pure presentation: two view modes rendering the same `FlatCard` (already a registry-side projection). No game state, no rule semantics, no move dispatch, no replay surface. The composable owns view-mode state; the rendering layer is read-only.

16. **Lifecycle Wiring Creep** — PASS. Pre-flight §Authority Chain item 13 mandates the session prompt declare **01.5 NOT INVOKED** with all four criteria absent (no `LegendaryGameState` field change, no `buildInitialGameState` shape change, no `LegendaryGame.moves` entry, no phase hook). WP-030 / WP-066 precedent applied. `game.ts` is outside the viewer tree entirely.

29. **Assumptions Leaking Across Layers** — PASS. Engine unaware of viewer. Viewer consumes only `FlatCard` re-exported from `apps/registry-viewer/src/registry/browser.ts`. No engine projection reads, no runtime registry barrel access. The new `CardDataTile.vue` does not introduce any new cross-layer assumption.

### Category 2: Determinism & Reproducibility

2. **Non-Determinism Introduced by Convenience** — PASS. `.claude/rules/code-style.md §Patterns to Avoid` blanket-bans `Math.random()` and `Date.now()` repo-wide; pre-flight §Authority Chain cites this. WP-096 §Non-Negotiable Constraints repeats the prohibition. Tile render is a pure function of `FlatCard` + `viewMode`. No timer, no animation, no RNG.

8. **No Single Debugging Truth Artifact** — PASS. WP-096 §Debuggability & Diagnostics section explicitly enumerates two deterministic debug surfaces (DOM tile content; `localStorage.cardViewMode` via DevTools → Application → Local Storage) and asserts no hidden side effects. Same model as WP-066.

23. **Lack of Deterministic Ordering Guarantees** — PASS. WP introduces no iteration order semantics. `CardGrid.vue`'s existing sort/filter logic in `App.vue` is out of scope (§Out of Scope and §Files Expected to Change both forbid touching `App.vue`).

### Category 3: Immutability & Mutation Discipline

3. **Confusion Between Pure Functions and Immer Mutation** — PASS. No Immer. No `G` draft. No move context. The composable uses Vue's `ref` (reactive primitive with assignment semantics, not Immer). Rendering is declarative via `<template>`.

17. **Hidden Mutation via Aliasing** — PASS. No `G` projection. No shared array reference. `FlatCard` passes as a prop (Vue convention: props are read-only at the child boundary). The new tile component reads `card.X` paths only — no mutation, no array splice, no nested object passthrough that could alias upstream state.

### Category 4: Type Safety & Contract Integrity

4. **Contract Drift Between Types, Tests, and Runtime** — PASS. `FlatCard` is the consumed contract (verified at `apps/registry-viewer/src/registry/types/index.ts:34-54`). WP-096 §Locked Values pins the eight field references against the actual interface (cross-checked in pre-flight §Dependency Contract Verification). No canonical readonly arrays introduced (viewer has no drift-detection array surface).

5. **Optional Field Ambiguity (`exactOptionalPropertyTypes`)** — PASS. WP-096 mandates the same AND-semantics guard form `CardDataDisplay.vue` already uses (verified byte-for-byte): `v-if="card.X"` for strings, `v-if="card.X !== undefined && card.X !== null"` for numbers (admits 0), `v-if="card.X !== undefined && card.X !== null && card.X !== ''"` for `attack`/`recruit`. Tile reads from an already-validated `FlatCard`; no object-literal construction site where `exactOptionalPropertyTypes` would bite.

6. **Undefined Merge Semantics (Replace vs Append)** — PASS. No merge logic. The composable's `localStorage.setItem('cardViewMode', nextValue)` is replace-only (locked under WP-066). Tile field set is closed at WP-096 ratification — no future-extensible merge surface.

10. **Stringly-Typed Outcomes and Results** — PASS. `viewMode: 'image' | 'data'` is a narrow literal union (verified at `useCardViewMode.ts:50`). EC-096 §Locked Values pins both modes verbatim. The composable destructure pattern (`const { viewMode } = useCardViewMode();`) is also locked. No free-form strings.

21. **Type Widening at Boundaries** — PASS. The tile prop is exactly `defineProps<{ card: FlatCard }>()` — no widening to `unknown`, no `as any`, no structural duck-typing. `FlatCard` flows via the existing browser-safe re-export path (`../registry/browser`). The composable's narrowing already happened in WP-066 (REQ-1 discriminated narrowing).

27. **Weak Canonical Naming Discipline** — **RISK → RESOLVED 2026-04-25 via PS-1 Option A.** Original finding: the locked field set named `setAbbr → "Set"` while the sidebar at `CardDataDisplay.vue:78` uses `setName → "Edition"` (with `setAbbr` parenthesized inside the `<dd>`). The WP additionally claimed labels were "byte-identical" to the sidebar — the two locks contradicted each other. **Resolution:** User chose Option A. WP-096 + EC-096 now state that six of the seven labelled rows (`Type`, `Class`, `Cost`, `Attack`, `Recruit`, `Rarity`) are byte-identical to the sidebar; the seventh row (`Set` / `setAbbr`) is the deliberate tile-compaction divergence captured under D-9601. Edits landed in WP-096 §Non-Negotiable Constraints, §Locked Values rows 3 + 8, §Scope (In) B, §Acceptance Criteria B6, §Definition of Done D-9601 line, and EC-096 §Locked Values, §Required `// why:` Comments, §After Completing DECISIONS line. **Now PASS.**

### Category 5: Persistence & Serialization

7. **Persisting Runtime State by Accident** — PASS. The only persisted state is `localStorage.cardViewMode`, established by WP-066 and unchanged. No `G`, no `ctx`, no engine artifact. Tile component is entirely render-time.

19. **Weak JSON-Serializability Guarantees** — PASS. No data put into `G` or persisted at all in this packet. `FlatCard` is already JSON-serializable (Zod-inferred). No function/Map/Set/class instance introduced.

24. **Mixed Persistence Concerns** — PASS. `localStorage` (UI preference) and R2 (`FlatCard` source) are cleanly separated. Tile reads from `FlatCard`, never from `localStorage` or any persistence-class boundary.

### Category 6: Testing & Invariant Enforcement

11. **Tests Validate Behavior, Not Invariants** — PASS (with known gap accepted at pre-flight §Test Expectations). The viewer has no Vue component-test harness — same precedent as WP-066 / WP-094 / EC-103. Verification is `pnpm --filter registry-viewer build` + `pnpm --filter registry-viewer typecheck` + manual smoke (a–h sub-steps in WP-096 §Verification Steps). Pre-flight RS-5 carries the long-term governance follow-up to add a harness in a separate WP. No new tests are permitted under WP-096's allowlist.

### Category 7: Scope & Execution Governance

12. **Scope Creep During "Small" Packets** — PASS. WP-096 §Files Expected to Change explicitly names two production files plus four governance files. EC-096 §Guardrails repeats the two-file lock. Pre-flight §Scope Lock enumerates the not-allowed file list (every other registry-viewer component, all engine packages, all server / arena-client paths). `git diff --name-only` verification step is in WP-096 §Verification Steps. The earlier WP/EC contradiction (between "files limited to two" and DoD's governance updates) was resolved by the user-led template-conformance pass and is now consistent.

13. **Unclassified Directories and Ownership Ambiguity** — **RISK → RESOLVED 2026-04-25 via FIX 4 (backlog entry).** Original finding: `apps/registry-viewer/` has no row in `docs/ai/REFERENCE/02-CODE-CATEGORIES.md`. WP-066 copilot check #13 surfaced this; WP-094 inherited the gap silently; WP-096 inherits it again (third pass). **Resolution:** Per the original FIX direction, the gap is NOT fixed inside WP-096 (out of scope; would expand allowlist). A "(deferred placeholder)" tracker line was appended to `WORK_INDEX.md` immediately after the existing CLI-credentials placeholder, enumerating two acceptable resolution paths: (a) extend the existing `client-app` row to cover both `apps/arena-client/` and `apps/registry-viewer/`; (b) add a new `client-app-viewer` row with its own DECISIONS.md entry. This converts the silent inheritance into an indexed governance follow-up — the next viewer-touching WP can no longer drift past the gap. **Now PASS** for WP-096 specifically; standing governance item remains tracked in WORK_INDEX.md.

30. **Missing Pre-Session Governance Fixes** — PASS. Pre-flight §Pre-Flight Verdict explicitly lists PS-1, PS-2, PS-3 as scope-neutral wording fixes that must land before session prompt generation. Each is mapped to a specific RS finding. Resolution will be logged in §Authorized Next Step. Same WP-027 / WP-031 / WP-066 precedent for blocking-vs-non-blocking PS-# triage.

### Category 8: Extensibility & Future-Proofing

14. **No Extension Seams for Future Growth** — PASS. WP-096 §Maintainability & Upgrade Readiness identifies the extension seam: a future third view mode (e.g., `'compact'`) requires a follow-up WP that updates the literal union, the localStorage narrowing, the toggle button label, and adds a third branch in both `CardDetail.vue` and `CardGrid.vue`. The locked field set on `CardDataTile.vue` is closed but extension-friendly: adding a new `FlatCard`-derived field is a single new `<template v-if="card.Y">` block + a one-line entry in WP-096's locked-field-set successor.

28. **No Upgrade or Deprecation Story** — PASS. The composable's `localStorage` shape is already self-healing (REQ-1 narrowing in WP-066: any non-`'data'` value defaults to `'image'` and is written back). No data migration required. No deprecation surface (the toggle's UX is purely additive — `CardGrid.vue` previously rendered image tiles; data tiles are an expansion, not a replacement, of that capability).

### Category 9: Documentation & Intent Clarity

15. **Missing "Why" for Invariants and Boundaries** — PASS. WP-096 §Non-Negotiable Constraints names five required `// why:` comment locations: composable import line in `CardGrid.vue`, conditional render block inside `.img-wrap`, `CardDataTile.vue` module JSDoc, `CardDataTile.vue` numeric guard on `cost`, and `CardDataTile.vue` `attack`/`recruit` empty-string guard. EC-096 §Required `// why:` Comments mirrors these as a checklist. Each comment names the specific invariant the reader must understand without back-reference.

20. **Ambiguous Authority Chain** — PASS. Pre-flight §Authority Chain enumerates 15 documents in priority order (CLAUDE.md → ARCHITECTURE.md → 01-VISION.md → 03.1-DATA-SOURCES.md → 02-CODE-CATEGORIES.md → EC-096 → WP-096 → registry-viewer CLAUDE.md → architecture rules → code-style rules → DECISIONS.md → WP-066 post-mortem → 01.5 → 01.6 → templates). Same chain as WP-092 / WP-094. No ambiguity.

26. **Implicit Content Semantics** — PASS. AND-semantics is documented in WP-096 §Locked Values **and** in `CardDataDisplay.vue`'s JSDoc (sidebar source). Display labels, field order, abilities omission, print parity, and conditional placement (inside `.img-wrap`) are all explicit. No "convention-based" meaning relied on.

### Category 10: Error Handling & Failure Semantics

18. **Outcome Evaluation Timing Ambiguity** — PASS. No before-vs-after game-end semantics. The toggle's effect on render is synchronous on `viewMode.value` change; Vue's reactivity handles the re-render. No lifecycle ambiguity.

22. **Silent Failure vs Loud Failure Decisions Made Late** — PASS. AND-semantics rule is "missing/empty fields are omitted entirely; no em-dash, no placeholder." This is a deliberate fail-soft choice (WP-066 / D-66xx precedent) preserved across the tile. Build/typecheck failures are loud (exit 1). Vue prop-type warnings on the tile would be loud (DevTools console). No new silent-failure surface introduced.

### Category 11: Single Responsibility & Logic Clarity

25. **Overloaded Function Responsibilities** — PASS. `CardDataTile.vue` does one thing: render a tile-sized data card from a `FlatCard`. No state management, no validation, no data fetching, no event emission. `CardGrid.vue` modification adds one branch in the tile body — no other behavior is touched.

### Cross-Cutting

A. **Forbidden-imports list overstates the layer rule** — **RISK → RESOLVED 2026-04-25 via PS-2.** Original finding: WP-096 §Non-Negotiable Constraints listed `@legendary-arena/registry` as disallowed without distinguishing the Node-bearing barrel from the browser-safe Zod-schema subpaths permitted by `apps/registry-viewer/CLAUDE.md` and `.claude/rules/architecture.md §Import Rules`. **Resolution:** WP-096 §Non-Negotiable Constraints "No layer leaks" bullet now reads: "Disallowed: the Node-bearing `@legendary-arena/registry` barrel (narrow Zod-schema subpaths such as `@legendary-arena/registry/schema` are permitted by the layer rule but not needed in this scope); `@legendary-arena/game-engine`; `@legendary-arena/preplan`; `@legendary-arena/server`; `pg`; `boardgame.io`; any `node:` built-in." EC-096 §Guardrails imports line mirrors the same wording. **Now PASS.**

B. **Session-context misframes WP-066 scope as "implicit"** — **RISK → RESOLVED 2026-04-25 via PS-3.** Original finding: WP-096 §Session Context said "implicitly sidebar-only despite the 'global' framing"; the WP-066 post-mortem at `01.6-WP-066-registry-viewer-data-toggle.md:66` shows the scope was deliberately sidebar-only. **Resolution:** WP-096 §Session Context reframed to "WP-066 was deliberately scoped to the sidebar — its `CardGrid.vue` exclusion was an explicit EC-066 §Guardrails item ('CardGrid.vue NOT modified — do NOT touch unless necessary'), not an oversight. The user-visible bug is the gap between that deliberate scope and the public-facing 'global toggle' framing the user expected: a toggle labelled 'Data view' / 'Image view' implies coverage of the main grid, not just the sidebar." §Context (Read First) post-mortem reference updated to match. **Now PASS.**

---

## Mandatory Governance Follow-ups (if any)

- **DECISIONS.md entry — D-9601 (locked at WP-096 execution close):** capture (a) locked field set on `CardDataTile.vue`; (b) composable-vs-prop choice (`CardGrid.vue` reads `useCardViewMode` directly, no prop plumbing through `App.vue`); (c) AND-semantics guard parity with `CardDataDisplay.vue`; (d) ability-text omission rationale (sidebar remains the place for full ability text); (e) the RS-1 / PS-1 disposition (Option A or B for the `Set` / `Edition` label drift) so the divergence (or alignment) is auditable.
- **02-CODE-CATEGORIES.md update — DEFERRED to a follow-up docs-housekeeping WP.** Add a row classifying `apps/registry-viewer/` (either as `client-app-viewer` with its own DECISIONS entry, or extend `client-app` to include both `apps/arena-client/` and `apps/registry-viewer/`). This is the third inheritance pass (WP-066, WP-094, WP-096); the next viewer-touching WP should arrive with the classification already landed. Track in the WORK_INDEX backlog.
- **`.claude/rules/*.md` update:** None required. WP-096 does not introduce a new enforcement pattern.
- **WORK_INDEX.md update:** Register WP-096 in the appropriate phase / section as part of WP-096 execution itself (already in the WP §Definition of Done). Also append a tracker line for the deferred 02-CODE-CATEGORIES.md classification follow-up under the "deferred placeholders" tail.

---

## Pre-Flight Verdict Disposition

- [x] **CONFIRM** (Re-run 2026-04-25, post-resolution) — pre-flight READY TO EXECUTE verdict stands unconditionally. Session prompt generation authorized per `01.4 §Authorized Next Step`.
- [ ] ~~HOLD~~ (initial pass 2026-04-25, pre-resolution) — Applied four scope-neutral FIXes:
  - **FIX 1 (#27):** PS-1 Option A — kept `Set` / `setAbbr`; softened byte-identity claim to six-of-seven; captured `Set` row divergence under D-9601 across WP-096 + EC-096. **DONE.**
  - **FIX 2 (Cross-cutting A):** PS-2 — softened forbidden-imports wording in WP §Non-Negotiable + EC §Guardrails to permit narrow Zod-schema subpaths from `@legendary-arena/registry`. **DONE.**
  - **FIX 3 (Cross-cutting B):** PS-3 — reframed WP-096 §Session Context + §Context (Read First) to characterize WP-066's scope as deliberate, not implicit. **DONE.**
  - **FIX 4 (#13):** Appended a "(deferred placeholder)" tracker line to `WORK_INDEX.md` for the deferred `02-CODE-CATEGORIES.md` classification of `apps/registry-viewer/`. **DONE.**
- [ ] SUSPEND — N/A. No scope-changing fixes were required; pre-flight re-run not needed.

**Authorized next step:** generate the WP-096 session execution prompt at `docs/ai/invocations/session-wp096-registry-viewer-grid-data-view.md` per pre-flight §Authorized Next Step. The prompt must conform exactly to WP-096 + EC-096 (post-resolution) and the pre-flight scope lock; no new scope may be introduced. The prompt must explicitly declare **01.5 NOT INVOKED** with all four criteria enumerated and marked absent, per WP-030 / WP-066 precedent.
