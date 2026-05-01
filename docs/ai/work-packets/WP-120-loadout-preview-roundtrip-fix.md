# WP-120 — Loadout Preview Round-Trip Fix (Hoist `useLoadoutDraft` to App.vue)

**Status:** Draft (pre-lint)
**Primary Layer:** Apps / `apps/registry-viewer` (UI wiring)
**Dependencies:** WP-091 (LoadoutBuilder + `useLoadoutDraft` 16-mutator API), WP-114 (`useSetupFromUrl` + `<LoadoutPreview>` "Edit this loadout" call site), WP-117 (D-11702 no-router posture for registry-viewer)

---

## Why This Is a WP (Not an EC)

This change alters **runtime behavior and state ownership** in a public-facing UI surface. Specifically, it relocates the authoritative `useLoadoutDraft` instance and introduces a new component-level interaction contract (props in, `request-edit` event out). It commits a single architectural decision (D-12001) about *who owns the draft state*, replacing the WP-114 implicit "each component owns its own draft" with an explicit "App.vue owns one draft, children consume or request mutation."

That puts the change above the EC-only bar set by precedents EC-110 (CI path fix) and EC-120 (lint baseline / accessibility cleanup). It introduces:

- a new state ownership rule (single owner of draft state in `App.vue`)
- a new event-driven mutation path (`request-edit` from preview → parent handler → shared draft)
- a new component-level prop contract (`draftApi: UseLoadoutDraftApi` into `<LoadoutBuilder>`)

Therefore governance requires a Work Packet with an explicit decision record (D-12001), not an ad-hoc EC.

---

## Session Context

WP-114 shipped a "Game of the Week" URL-driven setup preview at `c059199` (governance-closed `8e67447`, 2026-04-30) on top of WP-091's `<LoadoutBuilder>` + `useLoadoutDraft` authoring surface; WP-114 deliberately deferred a UX caveat — clicking "Edit this loadout" on `<LoadoutPreview>` calls `loadFromJson` on the preview component's *own* draft instance instead of the visible `<LoadoutBuilder>`'s draft, because each `useLoadoutDraft()` invocation creates an independent non-singleton draft and WP-091 PS-1 immutably locks the composable's signature against change. WP-117 closed at `b6a6d5b` 2026-04-30 with D-11702 = no router for `apps/registry-viewer`, foreclosing a router-driven fix and clearing the path for a plain Vue composition resolution. This packet ships the deferred fix using the same hoist-to-App.vue pattern WP-114 already uses for `useSetupFromUrl`.

---

## Goal

**Restore a single-owner draft model so the user's mental model matches the runtime behavior.** After this session, the registry viewer holds exactly one authoritative `useLoadoutDraft` instance per page. Both `<LoadoutPreview>` and `<LoadoutBuilder>` read and request mutations against that single instance, eliminating the dual-draft divergence shipped by WP-114. Concretely: clicking "Edit this loadout" on `<LoadoutPreview>` updates the **visible** `<LoadoutBuilder>`'s draft so the user sees their preview content populated in the editor below — exactly what they expect from "edit."

The mechanism is to hoist the single `useLoadoutDraft(registry)` instance from each component's local setup up to `App.vue` (mirroring the existing `useSetupFromUrl(reg)` pattern at `App.vue:246`) and pass the API down to children as Vue props. `<LoadoutPreview>` emits a `request-edit` event carrying the synthesized preview JSON; `App.vue` handles the event by invoking `loadFromJson` on the hoisted draft. The visible editor below updates because both components now share the same draft instance.

WP-091 PS-1 (`useLoadoutDraft.ts` immutable signature lock) is preserved verbatim — only the call sites move. WP-114's URL contract (`setupUrlParams.ts` + `useSetupFromUrl.ts`) is preserved verbatim — no URL key, encoding, or parsing semantics change. WP-117's no-router posture is preserved — no router library is added, no `<router-view>` wired in, no route table introduced.

---

## Vision Alignment

> §17.1 trigger evaluation:
> - Vision §10a (Registry Viewer public surfaces) — **triggered** because `cards.barefootbetters.com` is the deployment target and this WP modifies its UI behavior. Other §17.1 surfaces are not touched (no scoring/PAR/leaderboards, no replays, no player identity, no multiplayer sync, no determinism/RNG, no card data semantics, no monetization, no live ops, no accessibility/i18n surface change).

**Vision clauses touched:** §10a (Registry Viewer public surface).

**Conflict assertion:** No conflict — this WP preserves §10a. The registry viewer remains public, read-only by default, and free of monetization or competitive surfaces. The "Edit this loadout" interaction is user-initiated (matching WP-114's read-only-until-clicked posture); the fix only changes which draft instance receives the load, not whether the load is user-gated.

**Non-Goal proximity check:** NG-1..NG-7 not crossed. No paid surface, no persuasive copy, no competitive mechanic, no monetization affordance, no "supporter tier" or cosmetics surface added or modified. The fix is purely a UX bug correction.

**Determinism preservation:** N/A — no scoring, replay, RNG, or simulation surface touched. The fix touches only Vue component wiring in `apps/registry-viewer`; engine, replay, and PAR layers are untouched.

**§20 Funding Surface Gate:** N/A — no UI surfaces referencing funding, donations, supporter tiers, or tournament funding are added or modified. Pure UX bug fix on an existing read-only surface. Per §20.1 governance-doc carve-out language, this WP touches no funding affordances per WP-097 §A/§B/§C.

**§21 API Catalog Update:** N/A — no HTTP endpoints touched, no `apps/server/src/**` library functions added, modified, removed, or status-changed. The fix is entirely within `apps/registry-viewer`'s component layer.

---

## Assumes

- WP-091 complete. Specifically:
  - `apps/registry-viewer/src/composables/useLoadoutDraft.ts` exports `useLoadoutDraft(registry)` returning `UseLoadoutDraftApi` with all 16 mutators + `loadFromJson` + `exportToJsonBlob` + `exportFilename` + `resetDraft` (WP-091 + WP-114 PS-1 additive `export` of six `DEFAULT_*` constants)
  - The `UseLoadoutDraftApi` interface and the `useLoadoutDraft` function signature are unchanged from `49e07ec` (WP-114 PS-1 amendment); this packet does not modify either
- WP-114 complete. Specifically:
  - `apps/registry-viewer/src/composables/useSetupFromUrl.ts` exports `useSetupFromUrl(registry)` returning `UseSetupFromUrlApi` with `parsedParams`, `hasUrlParams`, `previewDocument`, `validationErrors`, `matchedCount` (verified at HEAD `b6a6d5b`)
  - `apps/registry-viewer/src/lib/setupUrlParams.ts` exports `parseSetupUrl` and `serializeSetupToUrl` with the canonical 5-key URL contract (verified at HEAD `b6a6d5b`)
  - `apps/registry-viewer/src/components/LoadoutPreview.vue` currently calls `useLoadoutDraft(props.registry)` once in setup and destructures only `loadFromJson` from the result (verified at HEAD `b6a6d5b`, lines 47, 132)
  - `apps/registry-viewer/src/components/LoadoutBuilder.vue` currently calls `useLoadoutDraft(props.registry)` once in setup and destructures the full mutator surface (verified at HEAD `b6a6d5b`, line 53)
  - `apps/registry-viewer/src/App.vue` currently mounts both `<LoadoutPreview>` and `<LoadoutBuilder>` inside the `activeView === "loadout"` template branch with sibling layout (verified at HEAD `b6a6d5b`, lines 602–614) and calls `useSetupFromUrl(reg)` once inside `onMounted` (verified at HEAD `b6a6d5b`, line 246)
- WP-117 complete. Specifically:
  - `docs/ai/DECISIONS.md` D-11702 records "no router; preserve `activeView` + WP-114 query params" for `apps/registry-viewer` (verified at HEAD `b6a6d5b`)
  - `apps/registry-viewer/package.json` has no `vue-router` dependency (verified at HEAD `b6a6d5b`)
- `pnpm --filter registry-viewer build` exits 0 at HEAD
- `pnpm --filter registry-viewer test` exits 0 at HEAD (baseline `22 / 4 / 0` per WP-114 §Verification)
- `docs/ai/DECISIONS.md` exists
- `docs/ai/ARCHITECTURE.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — confirm `apps/registry-viewer` may import Vue, Zod, UI framework, and the `registry` package only. No `game-engine`, no `preplan`, no `server`, no `pg`. This packet stays inside `apps/registry-viewer/src/` and adds no new dependency.
- `apps/registry-viewer/src/App.vue` — read entirely; this is the only file that will hold the hoisted `useLoadoutDraft` instance. Note especially the existing `useSetupFromUrl(reg)` integration at lines 242–262 — the new hoist mirrors that pattern (instantiate inside `onMounted` once `registry.value` is non-null, snapshot outputs into top-level refs if needed, pass to children as props).
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — read entirely; the `useLoadoutDraft(props.registry)` call at line 53 is the call that gets removed. The destructured surface (`draft`, `errors`, `isValid`, all 16 mutators, `loadFromJson`, `exportToJsonBlob`, `exportFilename`, `resetDraft`) becomes a single typed prop. None of the 17 verbatim WP-093 UI strings (`HERO_SELECTION_MODE_*` constants imported from `@legendary-arena/registry/setupContract`) change.
- `apps/registry-viewer/src/components/LoadoutPreview.vue` — read entirely; the `useLoadoutDraft(props.registry)` call at line 47 is the call that gets removed. The `onEditLoadout` handler at lines 123–138 changes from "call local `loadFromJson`" to "emit `request-edit` with the synthesized JSON payload". The `editStatus` ref still updates, but the success path waits on a parent-acknowledgment prop (`editAcknowledgement`) instead of a local `result.ok`.
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — read entirely so the `UseLoadoutDraftApi` shape is reproduced verbatim in the new prop type. **DO NOT MODIFY** — WP-091 PS-1 immutable lock applies; signature changes are forbidden.
- `apps/registry-viewer/src/composables/useSetupFromUrl.ts` — read entirely as the architectural precedent for the hoist pattern.
- `docs/ai/work-packets/WP-114-registry-viewer-url-parameterized-setup-preview.md §Files Expected to Change` — confirm this WP's allowlist does not overlap with WP-114's locked outputs in a way that re-touches any of the four shipped WP-114 files outside this packet's declared scope.
- `docs/ai/work-packets/WP-117-client-routing-strategy.md §Out of Scope` — confirm the no-router posture and that WP-114's query-param contract must be preserved verbatim.
- `docs/ai/DECISIONS.md` — scan for D-11702 (registry-viewer no router) and the four D-114XX entries (canonical URL keys, count/envelope-not-URL-bound, one-shot auto-switch, PS-1 additive export); none of these are altered by this WP.
- `docs/ai/REFERENCE/00.6-code-style.md` — applies to all three modified Vue files. Key rules: §16.4 (each function fits on one screen), §16.5 (`// why:` comments on non-obvious decisions), §16.6 (no `import * as`, no barrel re-exports).

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- ESM only, Node v22+
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`
- Full file contents for every new or modified file — no diffs, no snippets
- `node:` prefix on all Node.js built-in imports (N/A — this packet is browser-side only)
- Test files use `.test.ts` extension — never `.test.mjs` (N/A — no tests added under this packet's scope; see `## Out of Scope` for rationale)

**Packet-specific:**
- **`useLoadoutDraft.ts` is immutable.** WP-091 PS-1 lock and WP-114 PS-1 additive-export amendment together pin the file's signature, exports, and behavior. This packet must not modify `useLoadoutDraft.ts` for any reason — not the function signature, not the `UseLoadoutDraftApi` interface, not the `DEFAULT_*` constants, not the JSDoc, not whitespace. Any required type re-export is achieved by importing the existing `UseLoadoutDraftApi` from `useLoadoutDraft.ts` directly into the consuming components and `App.vue`.
- **WP-114 URL contract is preserved verbatim.** `setupUrlParams.ts` and `useSetupFromUrl.ts` must not be modified. URL key names (`schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`), comma-joined value encoding, empty-vs-missing semantics, and the one-shot auto-switch behavior are all preserved.
- **No router added.** WP-117 D-11702 forbids `vue-router` adoption for `apps/registry-viewer`. No `vue-router` import, no `<router-view>`, no `useRouter()` call, no route table — the fix uses plain Vue props + emits.
- **No new dependency.** `apps/registry-viewer/package.json` is unchanged; no npm package is added or upgraded.
- **No persistence.** No `localStorage`, `sessionStorage`, IndexedDB, or cookies introduced. The fix is purely component-tree wiring.
- **No engine, server, registry, or arena-client touch.** `git diff --name-only -- 'packages/**' 'apps/server/**' 'apps/arena-client/**' 'data/**'` must return no output.
- **`<LoadoutPreview>` remains read-only-by-default.** The 16-mutator forbidden-list discipline from EC-116 §Guardrails carries forward unchanged: the component imports zero mutators from `useLoadoutDraft`, calls `useLoadoutDraft` zero times, and the only mutation path is the user-initiated "Edit this loadout" click that emits `request-edit` for the parent to handle.
- **The `request-edit` event fires at most once per click.** No auto-promotion on URL arrival, no debounced retry, no implicit fire on validation-state change. The user clicks the button; the event emits once; the parent calls `loadFromJson` once.
- **WP-091 verbatim UI strings are preserved.** The three WP-093-locked `HERO_SELECTION_MODE_*` constants imported from `@legendary-arena/registry/setupContract` continue to flow through `<LoadoutBuilder>` byte-for-byte. The hoist does not paraphrase, alias, or re-derive any of the three strings.

**Session protocol:**
- If any contract, field name, or reference is unclear, stop and ask the human before proceeding — never guess or invent field names, type shapes, or file paths.
- **Unrelated untracked / unstaged files (mirroring WP-117 §Out of Scope precedent):** the execution session may observe a residual `EC-119-public-leaderboard-http-endpoints.checklist.md` untracked file from WP-115 stub work and a possible `WP-117-client-routing-strategy.md` modification from a parallel session. These are out of WP-120 scope. Do not stage, modify, or comment on them. Stage by exact filename only — never `git add .` / `-A` / `-u`. The WP-120 close-out commit must contain only the resolved-allowlist file diffs and nothing else.

**Locked contract values (delete rows that do not apply to this packet):**

- **MatchSetupConfig fields** (this packet touches preview JSON synthesis, indirectly):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount` — must not be renamed, abbreviated, or re-derived.

- **WP-114 URL keys (canonical, preserved verbatim from D-11401):**
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`

- **`UseLoadoutDraftApi` field set** (this packet imports the type but does not modify it):
  `draft`, `errors`, `isValid`, `setScheme`, `setMastermind`,
  `addVillainGroup`, `removeVillainGroup`, `addHenchmanGroup`,
  `removeHenchmanGroup`, `addHeroGroup`, `removeHeroGroup`, `setCount`,
  `setPlayerCount`, `setSeed`, `reRollSeed`, `setThemeId`,
  `setHeroSelectionMode`, `prefillFromTheme`, `loadFromJson`,
  `exportToJsonBlob`, `exportFilename`, `resetDraft`

---

## Decision Points

### D-12001 — Draft state ownership → **Option A (hoist `useLoadoutDraft` instance to `App.vue` + pass API as props)**

**Decision:** `App.vue` is the single owner of the draft instance. The `useLoadoutDraft(registry)` invocation moves from each component's local `<script setup>` up to `App.vue`'s `onMounted` block, becoming the page's one authoritative draft. `App.vue` passes the resulting `UseLoadoutDraftApi` to `<LoadoutBuilder>` as a `:draftApi` prop. `<LoadoutPreview>` no longer calls `useLoadoutDraft` at all; instead, its "Edit this loadout" button emits `request-edit` carrying `JSON.stringify(props.previewDocument)`. `App.vue` handles the event by invoking `draftApi.loadFromJson(...)` on the hoisted instance, which mutates the same shared state that `<LoadoutBuilder>` is rendering.

- *Rationale:* The core property the fix delivers is *single ownership* of draft state — eliminating the dual-draft divergence that made WP-114's "Edit this loadout" button appear to do nothing visible. This pattern is already used in `App.vue` for `useSetupFromUrl` (introduced by WP-114 EC-116 §Locked Values "Composable ownership"). Mirroring it preserves architectural consistency, requires zero changes to `useLoadoutDraft.ts` (preserving WP-091 PS-1 immutable lock), uses only plain Vue props + emits (no router, satisfying WP-117 D-11702), and keeps the prop surface narrow (one prop into `<LoadoutBuilder>`, one event out of `<LoadoutPreview>`). Two-level prop drilling is acceptable at this depth and avoids the global-state pitfalls of provide/inject for this small surface.
- *Rejected:*
  - **Option B (module-level singleton inside `useLoadoutDraft.ts`):** would require modifying `useLoadoutDraft.ts` to store its returned API in module scope. This unlocks WP-091 PS-1 (immutable signature lock) and would force a re-evaluation of every existing call site (currently two: `<LoadoutBuilder>` and `<LoadoutPreview>`). Singleton state in a Vue composable is also an anti-pattern that interferes with future testability and test isolation. The lock exists precisely to prevent this kind of drift; reversing it requires a separate governance WP plus a DECISIONS supersession of WP-091 PS-1.
  - **Option C (Vue provide/inject):** would hide the dependency relationship between `App.vue` and the two children behind a string key, making the data flow harder to trace at the call site. Provide/inject pays off when the consumer tree is deep (3+ levels) or branchy (many distinct consumers); here the tree is two levels with two consumers, both already direct children of `App.vue`. Props are more explicit, more boring, and a junior developer can follow them without learning an additional Vue mechanism.

The single decision (D-12001 = A) is recorded in `DECISIONS.md` at execution time per `## Definition of Done`. No further `[DECISION REQUIRED]` blocks remain.

---

## Scope (In)

### A) Hoist the draft instance to `App.vue`

- **`apps/registry-viewer/src/App.vue`** — modified:
  - Add an import for `useLoadoutDraft` and the `UseLoadoutDraftApi` type from `./composables/useLoadoutDraft`.
  - Inside the existing `onMounted` block (after `registry.value` is set, alongside the `useSetupFromUrl(reg)` invocation at line 246), instantiate the draft once: `const draftApi = useLoadoutDraft(reg);`. Snapshot the API into a top-level `shallowRef<UseLoadoutDraftApi | null>(null)` named `loadoutDraftApi` so the template can pass it to children only after registry load. The non-null assertion in the template (`:draft-api="loadoutDraftApi!"`) is acceptable inside the `v-if="activeView === 'loadout' && registry && loadoutDraftApi"` branch because that branch already guards on the same registry-loaded condition.
  - **Use `shallowRef`, not `ref`.** `useLoadoutDraft` returns an object whose properties are themselves Refs (`draft: Ref<MatchSetupDocument>`, `errors: ComputedRef<...>`, `isValid: ComputedRef<boolean>`). A regular `ref()` deep-reactifies its value via `reactive()`, which auto-unwraps nested refs on property access — so `loadoutDraftApi.value.draft` would silently become a plain `MatchSetupDocument` instead of `Ref<MatchSetupDocument>`. `<LoadoutBuilder>`'s destructure (`const { draft } = props.draftApi`) would then bind `draft` to a plain object, and the template's `draft.value.composition.…` would throw a render-time error and the entire Loadout tab would render blank. `shallowRef` makes the `.value` swap reactive without recursing into the API object, preserving the inner refs and the existing destructure contract. Surfaced during execution-time Smoke 1 and recorded inline as a `// why:` comment on the `shallowRef` declaration.
  - Add a `function onPreviewRequestEdit(jsonText: string): void` handler that calls `loadoutDraftApi.value?.loadFromJson(jsonText)` and surfaces the success / error result via a parent-owned ref (`previewEditAcknowledgement: Ref<"idle" | "loaded" | "rejected">`) which is passed back down to `<LoadoutPreview>` as a prop so the preview component can update its existing `editStatus` display.
  - Pass `:draft-api="loadoutDraftApi"` to `<LoadoutBuilder>` and `:edit-acknowledgement="previewEditAcknowledgement"` plus `@request-edit="onPreviewRequestEdit"` to `<LoadoutPreview>`.
  - Add a `// why:` comment on the hoist explaining: (1) the move from per-component instantiation up to App.vue is the WP-120 round-trip fix; (2) WP-091 PS-1 immutable lock is preserved by this approach; (3) the pattern mirrors the existing `useSetupFromUrl` hoist at lines 242–262.

### B) Consume the API in `<LoadoutBuilder>`

- **`apps/registry-viewer/src/components/LoadoutBuilder.vue`** — modified:
  - Remove the `import { useLoadoutDraft } from "../composables/useLoadoutDraft";` line and the `const draftApi = useLoadoutDraft(props.registry);` call at line 53.
  - Add `import type { UseLoadoutDraftApi } from "../composables/useLoadoutDraft";` so the prop type is named.
  - Extend the `Props` interface with `draftApi: UseLoadoutDraftApi`.
  - Replace `const draftApi = useLoadoutDraft(props.registry);` with `const draftApi = props.draftApi;` so the rest of the file's destructure (`const { draft, errors, isValid, setScheme, ... } = draftApi;`) is unchanged. **No other line in `<script setup>` or `<template>` changes.**
  - Add a `// why:` comment on the new prop intake explaining that the draft API is now owned by `App.vue` per WP-120 D-12001 = A and WP-091 PS-1 (composable signature) remains untouched.
  - Verify the `serializeSetupToUrl` import at line 31 is unchanged — that path is WP-114's URL contract and out of scope here.
  - Verify the three `HERO_SELECTION_MODE_*` imports at lines 19–22 are unchanged — those are WP-093-locked verbatim UI strings.

### C) Emit `request-edit` from `<LoadoutPreview>`

- **`apps/registry-viewer/src/components/LoadoutPreview.vue`** — modified:
  - Remove the `import { useLoadoutDraft } from "../composables/useLoadoutDraft";` line and the `const { loadFromJson } = useLoadoutDraft(props.registry);` call at line 47.
  - Add `editAcknowledgement: "idle" | "loaded" | "rejected"` to the `Props` interface so the parent can drive the success/error display.
  - Replace the existing local `editStatus` ref usage with the prop value: rename the local refs as needed and bind the existing template surface (`v-if="editStatus === 'loaded'"`) to `props.editAcknowledgement`. Remove the local `editStatus.value = ...` mutations from `onEditLoadout`.
  - Add a `defineEmits<{ 'request-edit': [jsonText: string] }>()` and replace the `loadFromJson(JSON.stringify(props.previewDocument))` call inside `onEditLoadout` with `emit('request-edit', JSON.stringify(props.previewDocument))`. Preserve the `if (props.previewDocument === null) return;` guard verbatim.
  - Add a `// why:` comment on the emit-only handler explaining: (1) the local mutator import is removed per WP-120 §Scope (C); (2) the parent (`App.vue`) owns the single hoisted draft instance and drives the load + acknowledgement; (3) the read-only-by-default posture from EC-116 §Guardrails #4/#5 is preserved (the component imports zero `useLoadoutDraft` mutators).

### D) Tests

This packet **adds no new tests**. Rationale (matches WP-114's UI-test posture per its own §Verification §14 manual operator smokes):

- The Vue component testing infrastructure (Vue Test Utils, jsdom, etc.) is not installed in `apps/registry-viewer` at HEAD. Adding it is independently scoped work that warrants its own WP — bundling it here would violate the §5 8-file soft cap and §16.1 no-premature-abstraction guidance.
- The fix is component-wiring only. The behavior verification path is two manual operator smokes (per WP-114 §14 precedent) recorded in `## Verification Steps` below.
- Existing automated tests (`setupUrlParams.test.ts`, `useSetupFromUrl.test.ts`, `cardTypesClient.test.ts`, `shared.test.ts`) continue to pass unchanged — the URL-parsing and validator surfaces they cover are untouched. Test-baseline preservation is a hard acceptance criterion below.

---

## Out of Scope

- **No modification of `apps/registry-viewer/src/composables/useLoadoutDraft.ts`.** WP-091 PS-1 lock + WP-114 PS-1 additive amendment together pin the file's signature; this packet uses the existing API as-is and changes only call sites.
- **No modification of `apps/registry-viewer/src/composables/useSetupFromUrl.ts`.** WP-114's URL composable is preserved verbatim.
- **No modification of `apps/registry-viewer/src/lib/setupUrlParams.ts`.** WP-114's URL parser/serializer is preserved verbatim.
- **No modification of any test file.** `setupUrlParams.test.ts`, `useSetupFromUrl.test.ts`, `cardTypesClient.test.ts`, `shared.test.ts` are all untouched.
- **No new test infrastructure.** Vue Test Utils, jsdom, happy-dom, Cypress, Playwright, or any other browser/component testing harness is not introduced. That is a separate WP if and when the team decides component-level UI tests are warranted.
- **No URL contract changes.** The 5 URL keys, comma-joined encoding, empty-vs-missing semantics, and one-shot auto-switch from WP-114 are all preserved.
- **No router adoption.** WP-117 D-11702 = no router for registry-viewer; this packet does not supersede that decision.
- **No engine, server, registry, preplan, or arena-client touch.** Cross-package diff must be empty.
- **No `package.json` or lockfile change.** No new dependency.
- **No persistence layer.** No `localStorage`, `sessionStorage`, IndexedDB, or cookies — the no-persistence policy from WP-091 / WP-114 is preserved.
- **No CSS / scoped-style changes.** The fix is `<script setup>` and template-binding only.
- **No accessibility regression.** Existing `aria-label`, `role`, and label-association rules from WP-103 / WP-120-EC accessibility work continue to hold.
- **No funding affordances.** Per `## Vision Alignment` §20 N/A.
- **No HTTP API surface change.** Per `## Vision Alignment` §21 N/A.
- Refactors, cleanups, or "while I'm here" improvements are **out of scope** unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

> Complete list. Every file is `**modified**`. No new files. No other files may be modified.

1. `apps/registry-viewer/src/App.vue` — **modified** — hoist `useLoadoutDraft(registry)` instance into `onMounted`, add `onPreviewRequestEdit` handler + `previewEditAcknowledgement` ref, pass `:draft-api` to `<LoadoutBuilder>` and `:edit-acknowledgement` + `@request-edit` to `<LoadoutPreview>`.
2. `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — remove internal `useLoadoutDraft` call, accept `draftApi: UseLoadoutDraftApi` as a prop, source the destructured surface from the prop instead of the local invocation. No template, CSS, or WP-093 verbatim-string changes.
3. `apps/registry-viewer/src/components/LoadoutPreview.vue` — **modified** — remove internal `useLoadoutDraft` call, accept `editAcknowledgement` as a prop, replace local `loadFromJson` invocation with `emit('request-edit', jsonText)`. Preserve the `previewDocument === null` guard, the read-only-by-default posture, and all existing template / CSS.

**Total: 3 files** (well under the §5 ~8-file soft cap).

No new files. No other files may be modified.

---

## Acceptance Criteria

> All items must be binary pass/fail. No partial credit.

### A) `App.vue` integration
- [ ] `apps/registry-viewer/src/App.vue` imports `useLoadoutDraft` and `UseLoadoutDraftApi` from `./composables/useLoadoutDraft` (single named import per `00.6 §16.6`)
- [ ] `apps/registry-viewer/src/App.vue` instantiates `useLoadoutDraft(reg)` exactly once inside `onMounted` after `registry.value` is non-null
- [ ] `apps/registry-viewer/src/App.vue` declares a top-level `loadoutDraftApi: Ref<UseLoadoutDraftApi | null>` initialized to `null`
- [ ] `apps/registry-viewer/src/App.vue` declares a top-level `previewEditAcknowledgement: Ref<"idle" | "loaded" | "rejected">` initialized to `"idle"`
- [ ] `apps/registry-viewer/src/App.vue` declares a `function onPreviewRequestEdit(jsonText: string): void` that calls `loadoutDraftApi.value?.loadFromJson(jsonText)` and updates `previewEditAcknowledgement.value` to `"loaded"` on `result.ok === true`, `"rejected"` otherwise
- [ ] `<LoadoutBuilder>` mount in `App.vue` template includes `:draft-api="loadoutDraftApi!"`
- [ ] `<LoadoutPreview>` mount in `App.vue` template includes `:edit-acknowledgement="previewEditAcknowledgement"` and `@request-edit="onPreviewRequestEdit"`

### B) `LoadoutBuilder.vue` integration
- [ ] `apps/registry-viewer/src/components/LoadoutBuilder.vue` no longer imports `useLoadoutDraft` from `../composables/useLoadoutDraft` — only `import type { UseLoadoutDraftApi }` remains
- [ ] `apps/registry-viewer/src/components/LoadoutBuilder.vue` does not call `useLoadoutDraft(...)` anywhere in `<script setup>`
- [ ] The `Props` interface includes `draftApi: UseLoadoutDraftApi`
- [ ] The destructure `const { draft, errors, isValid, ... } = draftApi;` sources `draftApi` from `props.draftApi`
- [ ] All 17 destructured names (16 mutators + `draft`/`errors`/`isValid`/`exportToJsonBlob`/`exportFilename`/`resetDraft`/`loadFromJson`) are referenced by the same call sites as at HEAD `b6a6d5b` — no rename, no aliasing, no consolidation
- [ ] The three `HERO_SELECTION_MODE_*` constants at imports lines 19–22 are byte-identical to HEAD (confirmed with `git diff` on the import block)
- [ ] The `serializeSetupToUrl` import at line 31 is byte-identical to HEAD (confirmed with `git diff` on the import block)

### C) `LoadoutPreview.vue` integration
- [ ] `apps/registry-viewer/src/components/LoadoutPreview.vue` no longer imports `useLoadoutDraft` from `../composables/useLoadoutDraft` — the import is fully removed
- [ ] `apps/registry-viewer/src/components/LoadoutPreview.vue` does not call `useLoadoutDraft(...)` anywhere in `<script setup>`
- [ ] The `Props` interface includes `editAcknowledgement: "idle" | "loaded" | "rejected"`
- [ ] The component declares `defineEmits<{ 'request-edit': [jsonText: string] }>()`
- [ ] `onEditLoadout` calls `emit('request-edit', JSON.stringify(props.previewDocument))` exactly once on click and contains zero references to `loadFromJson`
- [ ] The existing `if (props.previewDocument === null) return;` guard is preserved verbatim at the top of `onEditLoadout`
- [ ] The template `v-if="editStatus === 'loaded'"` and `v-if="editStatus === 'rejected'"` bindings now resolve to `props.editAcknowledgement`
- [ ] The local `editStatus` ref is removed (acknowledgement now flows from the parent)

### D) Cross-cutting
- [ ] No file under `apps/registry-viewer/src/composables/useLoadoutDraft.ts` is modified (`git diff -- apps/registry-viewer/src/composables/useLoadoutDraft.ts` returns empty)
- [ ] No file under `apps/registry-viewer/src/composables/useSetupFromUrl.ts` is modified (`git diff -- apps/registry-viewer/src/composables/useSetupFromUrl.ts` returns empty)
- [ ] No file under `apps/registry-viewer/src/lib/setupUrlParams.ts` is modified (`git diff -- apps/registry-viewer/src/lib/setupUrlParams.ts` returns empty)
- [ ] `apps/registry-viewer/package.json` is unchanged (`git diff -- apps/registry-viewer/package.json` returns empty)
- [ ] No `vue-router` import added (`Select-String -Path "apps\registry-viewer\src" -Pattern "vue-router" -Recurse` returns no matches)
- [ ] No `<router-view>` introduced (`Select-String -Path "apps\registry-viewer\src" -Pattern "router-view" -Recurse` returns no matches)
- [ ] No `localStorage` / `sessionStorage` / `IndexedDB` / `document.cookie` introduced in the three modified files (`Select-String` patterns return empty)
- [ ] No new dependency in `package.json` (`git diff -- apps/registry-viewer/package.json` returns empty)

### E) Tests + build
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] `pnpm --filter registry-viewer test` exits 0 with baseline counts unchanged from HEAD `22 / 4 / 0`
- [ ] `pnpm -r build` exits 0 (full monorepo build green)
- [ ] No file outside `## Files Expected to Change` is modified (`git diff --name-only` returns exactly the 3 files listed)

### F) Manual operator smokes (per WP-114 §14 precedent)
- [ ] **Smoke 1 — Round-trip from URL:** Navigate to `cards.barefootbetters.com/?schemeId=core/save-humanity&mastermindId=core/loki-god-of-mischief&villainGroupIds=core/brotherhood&heroDeckIds=core/iron-man-core,core/hulk-core` (or any equivalent valid 5-key URL); the Loadout tab auto-switches per WP-114; click "Edit this loadout" on the preview pane; **observe** the `<LoadoutBuilder>` below populates with the same scheme / mastermind / villain / hero IDs from the URL, and the "Loaded into a fresh editor draft." status appears on the preview pane. Operator records the result in WP execution notes.
- [ ] **Smoke 2 — Independent editor:** Without a URL, open the Loadout tab, edit the builder freely, then refresh the page with no URL params; **observe** the builder starts with a blank draft (no preview pane shown), confirming the hoisted instance does not introduce stickiness or persistence. Operator records the result in WP execution notes.

---

## Verification Steps

```pwsh
# Step 1 — build after all changes
pnpm --filter registry-viewer build
# Expected: exits 0, no TypeScript errors

# Step 2 — run all tests
pnpm --filter registry-viewer test
# Expected: TAP output — 22 tests passing, 0 failing, 4 suites (baseline preserved)

# Step 3 — confirm no internal useLoadoutDraft call in LoadoutPreview.vue
Select-String -Path "apps\registry-viewer\src\components\LoadoutPreview.vue" -Pattern "useLoadoutDraft\("
# Expected: no output

# Step 4 — confirm no internal useLoadoutDraft call in LoadoutBuilder.vue
Select-String -Path "apps\registry-viewer\src\components\LoadoutBuilder.vue" -Pattern "useLoadoutDraft\("
# Expected: no output

# Step 5 — confirm App.vue calls useLoadoutDraft exactly once
Select-String -Path "apps\registry-viewer\src\App.vue" -Pattern "useLoadoutDraft\("
# Expected: exactly one match (the hoist call inside onMounted)

# Step 6 — confirm useLoadoutDraft.ts is unchanged
git diff -- apps/registry-viewer/src/composables/useLoadoutDraft.ts
# Expected: no output (PS-1 lock preserved)

# Step 7 — confirm useSetupFromUrl.ts is unchanged
git diff -- apps/registry-viewer/src/composables/useSetupFromUrl.ts
# Expected: no output

# Step 8 — confirm setupUrlParams.ts is unchanged
git diff -- apps/registry-viewer/src/lib/setupUrlParams.ts
# Expected: no output

# Step 9 — confirm no vue-router added
Select-String -Path "apps\registry-viewer" -Pattern "vue-router" -Recurse
# Expected: no output (matches D-11702)

# Step 10 — confirm no router-view in templates
Select-String -Path "apps\registry-viewer\src" -Pattern "router-view" -Recurse
# Expected: no output

# Step 11 — confirm no persistence layer introduced in the 3 modified files
Select-String -Path "apps\registry-viewer\src\App.vue","apps\registry-viewer\src\components\LoadoutBuilder.vue","apps\registry-viewer\src\components\LoadoutPreview.vue" -Pattern "localStorage|sessionStorage|IndexedDB|document\.cookie"
# Expected: no output

# Step 12 — confirm scope boundary
git diff --name-only
# Expected: exactly these 3 files (and nothing else):
#   apps/registry-viewer/src/App.vue
#   apps/registry-viewer/src/components/LoadoutBuilder.vue
#   apps/registry-viewer/src/components/LoadoutPreview.vue

# Step 13 — confirm cross-package diff is empty
git diff --name-only -- "packages/**" "apps/server/**" "apps/arena-client/**" "data/**"
# Expected: no output

# Step 14 — confirm package.json untouched
git diff -- apps/registry-viewer/package.json
# Expected: no output

# Step 15 — full monorepo build (sanity)
pnpm -r build
# Expected: exits 0
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass (sections A through F)
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] `pnpm --filter registry-viewer test` exits 0 with baseline counts `22 / 4 / 0` unchanged
- [ ] `pnpm -r build` exits 0
- [ ] No `useLoadoutDraft(` call in `LoadoutPreview.vue` or `LoadoutBuilder.vue` (confirmed with `Select-String`)
- [ ] Exactly one `useLoadoutDraft(` call in `App.vue` (confirmed with `Select-String`)
- [ ] `useLoadoutDraft.ts`, `useSetupFromUrl.ts`, and `setupUrlParams.ts` unchanged (confirmed with three `git diff --` checks)
- [ ] No `vue-router` or `router-view` references added (confirmed with two recursive `Select-String` checks)
- [ ] No persistence layer added (`localStorage` / `sessionStorage` / `IndexedDB` / `cookie` patterns absent in the 3 modified files)
- [ ] No files outside `## Files Expected to Change` were modified (confirmed with `git diff --name-only`)
- [ ] Manual Smoke 1 (URL round-trip populates visible builder) **PASS** — operator-recorded
- [ ] Manual Smoke 2 (no URL → blank builder, no stickiness) **PASS** — operator-recorded
- [ ] `docs/ai/STATUS.md` updated — capability line: "Loadout preview's 'Edit this loadout' button now populates the visible LoadoutBuilder instead of an invisible second draft instance, closing the WP-114 §UX caveat."
- [ ] `docs/ai/DECISIONS.md` updated — D-12001 entry recording Option A (hoist + props) with rationale and rejected options (Option B singleton, Option C provide/inject)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-120 checked off with today's date
- [ ] EC governance close (if EC stub created at execution time per `.githooks/commit-msg` Rule 5; commit prefix selection between `EC-NNN:` and `SPEC:` is determined at execution time based on whether `apps/` files are staged — they will be, so `EC-NNN:` prefix is required)

---

## Lint Self-Review

> Filled in 2026-04-30 against `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` §1–§21.

| § | Verdict | Justification |
|---|---|---|
| §1 — Work Packet Structure | **PASS** | All required sections present and non-empty: `## Goal`, `## Vision Alignment`, `## Assumes`, `## Context (Read First)`, `## Non-Negotiable Constraints`, `## Decision Points`, `## Scope (In)`, `## Out of Scope`, `## Files Expected to Change`, `## Acceptance Criteria` (across 6 sub-groups), `## Verification Steps` (15 commands), `## Definition of Done` (16 items), `## Lint Self-Review`. |
| §2 — Non-Negotiable Constraints | **PASS** | Engine-wide block (ESM, Node v22+, full file contents — no diffs/snippets, code-style.md citation). Packet-specific block (PS-1 lock preservation, WP-114 URL contract preservation, no router per D-11702, no new dependency, no persistence, no engine/server/registry touch, read-only-by-default for `<LoadoutPreview>`, single emit per click, WP-091 verbatim UI strings preserved). Session protocol (stop-and-ask, do-not-stage rule for residual EC-119 / WP-117 modifications). Locked contract values block lists 9-field `MatchSetupConfig`, 5-key URL contract, 22-name `UseLoadoutDraftApi` field set. |
| §3 — Prerequisites (`## Assumes`) | **PASS** | 14 explicit assumptions with file paths, line numbers, and HEAD anchor `b6a6d5b`. WP-091 / WP-114 / WP-117 dependencies named with the specific exports and behaviors required. Build + test baseline (`22 / 4 / 0`) named. `DECISIONS.md` and `ARCHITECTURE.md` existence confirmed. |
| §4 — Context References | **PASS** | Specific section references: ARCHITECTURE.md §Layer Boundary (Authoritative), three modified Vue files by exact path, two read-only composables by exact path with line numbers, two parent WPs (WP-114 §Files Expected to Change, WP-117 §Out of Scope), DECISIONS.md scan target, 00.6-code-style.md with rule numbers (§16.4, §16.5, §16.6). |
| §5 — Output Completeness | **PASS** | All 3 files listed with `— modified` markers and one-line descriptions. No new files. Total file count is **3**, well under the ~8-file soft cap. No ambiguous output language anywhere ("modify the existing function" etc.). |
| §6 — Naming Consistency | **PASS** | 9-field `MatchSetupConfig` names cited verbatim (`schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`). 5-key URL contract preserved verbatim per D-11401. WP-093 verbatim UI strings preserved (the three `HERO_SELECTION_MODE_*` constants imported via the existing `@legendary-arena/registry/setupContract` subpath). No new field names introduced. |
| §7 — Dependency Discipline | **PASS** | No new npm dependencies introduced; explicit `## Out of Scope` line "No `package.json` or lockfile change". Forbidden alternative routers (per WP-117 D-11702) excluded by the no-router constraint. Forbidden test runners (Jest/Vitest/Mocha) excluded by the no-new-test-infrastructure §Out of Scope line. |
| §8 — Architectural Boundaries | **PASS** | Layer Boundary preserved by construction — `apps/registry-viewer` may import Vue, Zod, UI framework, `@legendary-arena/registry` (already imported); no `game-engine`, no `preplan`, no `server`, no `pg`. The packet stays inside `apps/registry-viewer/src/` and adds no cross-package import. Cross-package diff check at AC §D enforces. |
| §9 — Windows Compatibility | **PASS** | All 15 verification commands use PowerShell-native syntax (`Select-String -Path`, `git diff` with forward-slash paths quoted, `pnpm --filter`); no bash-specific syntax, no Linux-only globbing. |
| §10 — Environment Variable Hygiene | **N/A** | No environment variables introduced or referenced. The fix is entirely component-tree wiring inside an existing browser-side SPA. |
| §11 — Authentication Clarity | **N/A** | No authentication surface touched. The registry viewer is a public read-only SPA per Vision §10a; no auth posture added or modified. |
| §12 — Test Quality | **N/A** | No new tests produced — see `## Scope (In) D)` for the rationale (Vue component testing infrastructure not installed; bundling its introduction here would violate §16.1 no-premature-abstraction and the §5 file-count cap). Existing tests continue to pass unchanged per AC §E. Manual operator smokes per WP-114 §14 precedent cover the behavior verification path. |
| §13 — Commands and Verification | **PASS** | All 15 commands use `pnpm` (not `npm run`), are exact, and have expected-output annotations. Step 1 is the build; Step 2 is the test run; Steps 3–15 are scope/contract checks. No "run and verify manually" anywhere — the two manual smokes are formalized in AC §F and DoD with operator-recording requirement. |
| §14 — Acceptance Criteria Quality | **PASS** | 6 sub-groups with binary checks: A (App.vue integration, 7 items), B (LoadoutBuilder integration, 8 items), C (LoadoutPreview integration, 7 items), D (cross-cutting, 9 items), E (tests + build, 4 items), F (manual smokes, 2 items). Total 37 binary checks. Every item is observable via the corresponding Verification Step or `git diff` / `Select-String` invocation. No subjective items. |
| §15 — Definition of Done | **PASS** | Section exists with 16 checkboxes including STATUS.md / DECISIONS.md / WORK_INDEX.md updates, scope-boundary check, build + test exits, manual smokes, and EC governance close note. |
| §16 — Code Style | **PASS** | §16.1 — no premature abstraction (the fix introduces no new helper; it relocates the existing `useLoadoutDraft` invocation by one level). §16.2 — explicit control flow (`onPreviewRequestEdit` is a 4-line if/else, no nested ternaries). §16.3 — readable names (`loadoutDraftApi`, `previewEditAcknowledgement`, `onPreviewRequestEdit`, `request-edit` — full English words, no abbreviations). §16.4 — small functions (the new `onPreviewRequestEdit` is well under 30 lines). §16.5 — `// why:` comments required at each of the 3 hoist / prop-intake / emit sites per `## Scope (In)`. §16.6 — no `import * as`, no barrel re-exports (named imports only — `import { useLoadoutDraft } from "./composables/useLoadoutDraft"` and `import type { UseLoadoutDraftApi } from "./composables/useLoadoutDraft"`). §16.7 — no error messages introduced. |
| §17 — Vision Alignment | **PASS** | `## Vision Alignment` block present. §17.1 trigger: §10a (Registry Viewer public surface). Conflict assertion: "No conflict — this WP preserves §10a." Non-Goal proximity: NG-1..NG-7 not crossed (explicit). Determinism preservation: N/A — no scoring/replay/RNG/simulation surface touched (explicit). |
| §18 — Prose-vs-Grep Discipline | **PASS** | Verification Steps use scoped patterns: literal paths to specific files (Steps 3–8, 11, 14), recursive scopes for boundary-violation detection (Steps 9, 10), `git diff` path-scoped (Step 13). Prose discussing the no-router constraint cites D-11702 by ID rather than enumerating forbidden router-package names verbatim. Prose discussing the immutable file lock cites WP-091 PS-1 by ID. The `Select-String` patterns target specific tokens (`vue-router`, `router-view`, `localStorage` etc.) and the prose references the governing decisions (D-11702, WP-091 PS-1, EC-116 §Guardrails) — no false-positive grep risk. |
| §19 — Bridge-vs-HEAD Staleness Rule | **PASS** | This is a forward-locking fix WP, not a repo-state-summarizing artifact. The HEAD anchor `b6a6d5b` is cited in `## Assumes` for verification; the executing session must re-verify against HEAD-at-execution-time per the standard execution discipline. |
| §20 — Funding Surface Gate | **N/A** | Pure UX bug fix on a non-funding surface. No `## Funding Surface Gate` section needed per §20.1 N/A path with one-line justification ("pure component-wiring fix on the public registry viewer; no UI surfaces referencing donations, supporter tiers, or tournament funding are added or modified"). Per §20.1 governance-doc carve-out language, this WP touches no funding affordances per WP-097 §A/§B/§C. |
| §21 — API Catalog Update | **N/A** | No HTTP endpoints touched, no `apps/server/src/**` library functions added, modified, removed, or status-changed. The fix is entirely within `apps/registry-viewer/src/`'s component layer. Per §21.4 N/A path with one-line justification ("component-wiring fix in `apps/registry-viewer`; no HTTP endpoints touched, no `apps/server/src/**` library functions added or modified"). |

**Summary:** 16 PASS, 5 N/A (each justified per §10 / §11 / §12 / §20 / §21 N/A discipline). Zero FAIL. Lint gate satisfied.

**Pre-Session Actions:** None outstanding at draft time. All decisions resolved (D-12001 = A in `## Decision Points`). All assumptions cited at HEAD `b6a6d5b`. The pre-flight invocation will independently verify file paths, line numbers, and the WP-091 PS-1 / WP-114 / WP-117 dependency chain.
