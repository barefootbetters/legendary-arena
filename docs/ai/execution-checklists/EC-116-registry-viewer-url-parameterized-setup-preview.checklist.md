# EC-116 — Registry Viewer URL-Parameterized Setup Preview (Execution Checklist)

**Source:** [docs/ai/work-packets/WP-114-registry-viewer-url-parameterized-setup-preview.md](../work-packets/WP-114-registry-viewer-url-parameterized-setup-preview.md)
**Layer:** Client UI (`apps/registry-viewer`)
**Status:** DRAFT — not executable until WP-086 has landed on `main`.

> **Authority reminder:** This EC is the execution contract once WP-114 is
> promoted to executable. If the EC and WP conflict on design, the **WP wins**.
> ECs are subordinate to `docs/ai/ARCHITECTURE.md` and `.claude/rules/*.md`.

---

## Before Starting

- [ ] WP-086 landed on `main` (hard sequencing — same component tree).
- [ ] WP-091 / WP-093 / WP-113 are merged on `main`; `setupContract.{types,validate}.ts` exports unchanged from WP-091 baseline; `useLoadoutDraft.ts` exports the six default constants verbatim.
- [ ] `pnpm --filter registry-viewer build` exits 0.
- [ ] `pnpm --filter registry-viewer test` exits 0.
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0 (regression baseline).
- [ ] No parallel session is editing `apps/registry-viewer/src/App.vue`, `LoadoutBuilder.vue`, or `useLoadoutDraft.ts`.

## Locked Values (do not re-derive)

- **URL parameter names — verbatim, canonical 9-field composition names:** `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`. Forbidden paraphrases: `scheme`, `mastermind`, `villains`, `heroes`.
- **Serializer key emit order:** `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`.
- **ID format (per WP-113 D-10014):** `<setAbbr>/<slug>` for every entity-ID value; bare slugs and display names are rejected by the validator. Parser does not normalize, lowercase, strip, or fuzzy-match.
- **Count and envelope fields are NOT URL-bound.** `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`, `schemaVersion`, `setupId`, `createdAt`, `createdBy`, `seed`, `playerCount`, `expansions`, `heroSelectionMode` — defaults sourced from `useLoadoutDraft.ts` constants; do not re-declare.
- **Synthetic envelope defaults (verbatim):** `schemaVersion: "1.0"`, `createdBy: "system"`, `playerCount: DEFAULT_PLAYER_COUNT`, `expansions: DEFAULT_EXPANSIONS`, `heroSelectionMode: "GROUP_STANDARD"`, `setupId: "url-preview"`, `seed: "0000000000000000"`, `createdAt: "1970-01-01T00:00:00.000Z"` (Unix-epoch literal; `SetupEnvelope` requires the field, `Date.now()` would break the determinism contract — identical URLs must yield byte-identical synthetic JSON).
- **HeroSelectionMode v1 enum:** `["GROUP_STANDARD"]` — `"HERO_DRAFT"` reserved per WP-093 D-9301; never appears in this packet.
- **Banner text (verbatim):** `Loaded from URL`.
- **Builder button text (verbatim):** `Copy Setup Link`.
- **Preview unknown-id text (verbatim):** `Unknown ext_id: <value>`.
- **Empty-singular parser semantics (locked):** `parseSetupUrl("?schemeId=")` returns `{ schemeId: "" }` (empty string preserved); `parseSetupUrl("?mastermindId=")` returns `{ mastermindId: "" }`. Presence in the URL is semantically meaningful — the validator owns ID-validity rejection. Empty arrays remain `[]` (e.g., `?villainGroupIds=` → `[]`, never `[""]`).
- **Composable ownership (locked):** `App.vue` calls `useSetupFromUrl(registry)` exactly once per page; `LoadoutPreview.vue` consumes the composable's outputs via props (does NOT call it itself). Single instance prevents duplicate parsing/validation work; gives `App.vue` direct access to `hasUrlParams` for the auto-switch decision.
- **Validator error-path identifier (read-first; do NOT guess):** the property name (`field` vs `path` vs other) and value format (dot-string `"composition.villainGroupIds[0]"` vs segment array) on `MatchSetupValidationError` MUST be confirmed by re-opening `packages/registry/src/setupContract/setupContract.types.ts` at execution start. The WP-114 references to "field path" are illustrative only. If the actual shape differs, STOP and amend WP-114 + EC-116 with the authoritative shape before implementing `matchedCount`.
- **Base URL contract:** `serializeSetupToUrl(composition, baseUrl)` requires `baseUrl` = origin + pathname only (e.g., `https://cards.barefootbetters.com/`). The serializer does not strip existing query/hash; the call site at `LoadoutBuilder.vue` MUST pass `window.location.origin + window.location.pathname`.

## Guardrails

1. **Layer boundary:** no `from '@legendary-arena/game-engine'`, `from '@legendary-arena/preplan'`, `from 'boardgame.io'`, `from 'pg'`, or `from 'apps/server'` in any new or modified file. Verified by `Select-String`.
2. **No new npm dependency.** No router library, no clipboard polyfill, no URL library. `URLSearchParams` only.
3. **No persistence.** No `localStorage` / `sessionStorage` / `IndexedDB` / `document.cookie` writes anywhere in the new files.
4. **`LoadoutPreview.vue` is read-only.** It must not import any `useLoadoutDraft` mutator other than `loadFromJson`. Forbidden imports (grep-confirmed — full 16-mutator API surface from `UseLoadoutDraftApi` per WP-114 PS-2): `setScheme`, `setMastermind`, `addVillainGroup`, `removeVillainGroup`, `addHenchmanGroup`, `removeHenchmanGroup`, `addHeroGroup`, `removeHeroGroup`, `setCount`, `setPlayerCount`, `setSeed`, `reRollSeed`, `setThemeId`, `setHeroSelectionMode`, `prefillFromTheme`, `resetDraft`.
5. **`loadFromJson` is invoked exactly once.** From the "Edit this loadout" button click handler only. Disabled when `previewDocument === null`.
6. **One-shot auto-switch.** `App.vue` switches to the Loadout tab on first mount only when `hasUrlParams === true`. A `hasAppliedUrlAutoSwitch` ref gates re-firing. Subsequent user tab navigation must not re-trigger the switch.
7. **No paraphrase of canonical names.** The five URL keys must be the canonical `schemeId` / `mastermindId` / `villainGroupIds` / `henchmanGroupIds` / `heroDeckIds`. Paraphrasing is a Session Abort Condition.
8. **Parser is pure.** `parseSetupUrl` and `serializeSetupToUrl` have no side effects, no clocks, no randomness, no I/O, no `throw`. Type-only imports from `setupContract` allowed (`import type` only).
9. **Defaults are imported, not re-declared.** The composable imports `DEFAULT_BYSTANDERS_COUNT`, `DEFAULT_WOUNDS_COUNT`, `DEFAULT_OFFICERS_COUNT`, `DEFAULT_SIDEKICKS_COUNT`, `DEFAULT_PLAYER_COUNT`, `DEFAULT_EXPANSIONS` from `useLoadoutDraft.ts`. Drift test enforces.
10. **Clipboard fallback.** On `navigator.clipboard.writeText` rejection, reveal a `<input readonly>` with the URL pre-selected. Both branches required.

## Required `// why:` Comments

- `setupUrlParams.ts` — on `URLSearchParams` choice (forward slashes round-trip cleanly).
- `setupUrlParams.ts` — on omission of count and envelope fields (defaults owned by `useLoadoutDraft`; URL is composition-only).
- `setupUrlParams.ts` — on empty-array handling (`URLSearchParams` yields `""`; convert to `[]` to satisfy `string[]`).
- `setupUrlParams.ts` — on empty-singular handling (`?schemeId=` → `{ schemeId: "" }` preserved; validator owns ID-validity rejection so URL presence is meaningful even when blank).
- `useSetupFromUrl.ts` — on `setupId: "url-preview"` literal (preview docs are not real loadouts; stable id avoids per-render churn).
- `useSetupFromUrl.ts` — on `createdAt: "1970-01-01T00:00:00.000Z"` literal (required by `SetupEnvelope`; `Date.now()` would break the determinism contract).
- `useSetupFromUrl.test.ts` — on the drift test (failure means defaults forked between editor and preview, breaking round-trip).
- `LoadoutPreview.vue` — on the `loadFromJson` call site (only permitted mutator invocation; user-initiated copy into editor).
- `LoadoutBuilder.vue` — on the clipboard fallback path (browsers gate `clipboard.writeText` behind permissions and insecure-context).
- `App.vue` — on the one-shot auto-switch pattern (URL params are an arrival signal, not a sticky preference; re-applying would override manual navigation).
- `App.vue` — on the `useSetupFromUrl(registry)` instantiation site (single instance per page; passed to `LoadoutPreview` via props to avoid duplicate parsing/validation work).

## Files to Produce

### Implementation (Commit A)

- `apps/registry-viewer/src/lib/setupUrlParams.ts` — **new** — pure parser/serializer.
- `apps/registry-viewer/src/lib/setupUrlParams.test.ts` — **new** — parser coverage including type-correct round-trip (parse-after-serialize from a full `SetupCompositionInput`), canonical-order assertion (literal substring order in the query string), empty-array (`?villainGroupIds=` → `[]`), empty-singular (`?schemeId=` → `{ schemeId: "" }`), forward-slash round-trip, unknown-key drop.
- `apps/registry-viewer/src/composables/useSetupFromUrl.ts` — **new** — composable wiring URL → validator with envelope defaults; consumes `MatchSetupValidationError` shape per §Locked Values "Validator error-path identifier" gate.
- `apps/registry-viewer/src/composables/useSetupFromUrl.test.ts` — **new** — composable + drift coverage.
- `apps/registry-viewer/src/components/LoadoutPreview.vue` — **new** — read-only preview panel; consumes props from `App.vue`'s single composable instance per §Locked Values "Composable ownership" rule.
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **modified** — add "Copy Setup Link" button only.
- `apps/registry-viewer/src/App.vue` — **modified** — instantiate `useSetupFromUrl(registry)` once, mount `<LoadoutPreview>` with composable outputs as props, apply one-shot auto-switch.
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — **modified (PS-1, additive only)** — add `export` keyword to the six existing `DEFAULT_*` constants at lines 31–36 (`DEFAULT_BYSTANDERS_COUNT`, `DEFAULT_WOUNDS_COUNT`, `DEFAULT_OFFICERS_COUNT`, `DEFAULT_SIDEKICKS_COUNT`, `DEFAULT_PLAYER_COUNT`, `DEFAULT_EXPANSIONS`). **No other change permitted** — logic, signatures, mutator API, internal helpers all locked exactly as WP-091 shipped. Required so `useSetupFromUrl.ts` can import the constants for the drift test (per Guardrail #9).

### Component-level behavior — manual verification only (no new component test files)

The viewer's test runner is pure-Node `node --import tsx --test src/**/*.test.ts` (established under WP-086 / D-8607); it cannot mount Vue components. Two AC items are verified manually against `pnpm --filter registry-viewer dev` per the WP-066 / WP-094 / WP-096 / EC-103 viewer-side precedent:
- **Clipboard fallback verification** — operator denies clipboard permission and clicks "Copy Setup Link"; confirms readonly-input fallback appears with URL pre-populated + pre-selected.
- **One-shot auto-switch verification** — operator opens viewer with URL params; confirms Loadout tab is active on first render; manually switches to Cards; triggers a reactive update; confirms tab does not re-switch back.

Operator records both results in the Commit A message and STATUS.md block. If a future test-harness WP adds DOM-rendering support, these items should be promoted to automated component tests.

### Governance closeout (Commit B SPEC)

- `docs/ai/STATUS.md` — record feature landing block including the manual-verification results.
- `docs/ai/DECISIONS.md` — four D-114XX entries (canonical-name URL keys; count/envelope-not-URL-bound; one-shot auto-switch; **PS-1 additive `export` of six `DEFAULT_*` constants in `useLoadoutDraft.ts`** — additive scope-neutral amendment to the WP-091 immutable file, no logic/signature change, drift test now imports them; rationale: editor/preview default-value continuity is now drift-test-protected). Optional fifth at executor discretion: `useSetupFromUrl` ownership at `App.vue` (single-instance pattern) if the executor wants to anchor it explicitly.
- `docs/ai/work-packets/WORK_INDEX.md` — flip WP-114 `[ ]` → `[x]` with date + Commit A SHA + body update from "planned" to "landed".
- `docs/ai/execution-checklists/EC_INDEX.md` — flip EC-116 row Draft → Done with date and verification summary.

## After Completing

- [ ] `pnpm --filter registry-viewer build` exits 0.
- [ ] `pnpm --filter registry-viewer test` exits 0.
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0 (regression baseline holds).
- [ ] `Select-String -Path "apps\registry-viewer\src\lib\setupUrlParams.ts","apps\registry-viewer\src\composables\useSetupFromUrl.ts","apps\registry-viewer\src\components\LoadoutPreview.vue","apps\registry-viewer\src\components\LoadoutBuilder.vue","apps\registry-viewer\src\App.vue" -Pattern "from '@legendary-arena/game-engine|from '@legendary-arena/preplan|from 'apps/server|from 'boardgame\.io|from 'pg'"` returns no match.
- [ ] `Select-String -Path "apps\registry-viewer\src\lib\setupUrlParams.ts","apps\registry-viewer\src\composables\useSetupFromUrl.ts","apps\registry-viewer\src\components\LoadoutPreview.vue" -Pattern "localStorage|sessionStorage|indexedDB|document\.cookie"` returns no match.
- [ ] `Select-String -Path "apps\registry-viewer\src\lib\setupUrlParams.ts" -Pattern "['""](scheme|mastermind|villains|heroes)['""]"` returns no match.
- [ ] `Select-String -Path "apps\registry-viewer\src\lib\setupUrlParams.ts" -Pattern "throw "` returns no match.
- [ ] `Select-String -Path "apps\registry-viewer\src" -Pattern "Math\.random" -Recurse` returns no match.
- [ ] `Select-String -Path "apps\registry-viewer\src\components\LoadoutPreview.vue" -Pattern "setScheme|setMastermind|addVillainGroup|removeVillainGroup|addHenchmanGroup|removeHenchmanGroup|addHeroGroup|removeHeroGroup|setCount|setPlayerCount|setSeed|reRollSeed|setThemeId|setHeroSelectionMode|prefillFromTheme|resetDraft"` returns no match (full 16-mutator API surface from `UseLoadoutDraftApi` per WP-114 PS-2).
- [ ] `Select-String -Path "apps\registry-viewer\src\components\LoadoutBuilder.vue" -Pattern "Copy Setup Link"` returns exactly 1 match.
- [ ] `Select-String -Path "apps\registry-viewer\src\components\LoadoutPreview.vue" -Pattern "Loaded from URL"` returns exactly 1 match.
- [ ] **Composable ownership grep gates:** `Select-String -Path "apps\registry-viewer\src\App.vue" -Pattern "useSetupFromUrl\("` returns exactly 1 match; `Select-String -Path "apps\registry-viewer\src\components\LoadoutPreview.vue" -Pattern "useSetupFromUrl\("` returns 0 matches.
- [ ] **Manual verification — clipboard fallback (LoadoutBuilder.vue):** in the dev server, deny clipboard permission (DevTools → Application → Permissions, or use an HTTP context), click "Copy Setup Link" with a non-empty composition; confirm the readonly-input fallback element appears with the URL pre-populated and pre-selected. Record result in Commit A message + STATUS.md.
- [ ] **Manual verification — one-shot auto-switch (App.vue):** in the dev server, open the viewer with `?schemeId=core/foo` (or any populated URL params); confirm the active tab is "Loadout" on first render. Manually switch to Cards; trigger any reactive update (search input, set filter); confirm the tab does NOT re-switch back to Loadout. Record result in Commit A message + STATUS.md.
- [ ] `git diff packages/registry/ apps/server/ apps/arena-client/ packages/game-engine/ packages/preplan/` is empty.
- [ ] **PS-1 export gate (positive existence):** `Select-String -Path "apps\registry-viewer\src\composables\useLoadoutDraft.ts" -Pattern "^export const DEFAULT_(BYSTANDERS|WOUNDS|OFFICERS|SIDEKICKS|PLAYER)_COUNT|^export const DEFAULT_EXPANSIONS"` returns exactly 6 matches (one per constant).
- [ ] **PS-1 scope gate (additive-only):** `git diff apps/registry-viewer/src/composables/useLoadoutDraft.ts` shows only the addition of `export` keyword to six existing `const` declarations. No logic, signature, comment, or other line is touched outside the constants block. If the diff shows anything beyond the six `export` token additions, STOP — the WP-091 immutable-file constraint has been violated.
- [ ] `git diff --name-only` lists only files under `## Files to Produce`.

## Common Failure Smells

- URL parameter named `scheme` / `villains` / `heroes` → paraphrase guardrail violated; canonical 9-field names are mandatory.
- `villainGroupIds=hydra,enemy-of-my-enemy` (bare slugs) accepted → WP-113 set-qualified format dropped; values must be `<setAbbr>/<slug>`.
- `LoadoutPreview.vue` imports any non-`loadFromJson` mutator from `useLoadoutDraft` → read-only guardrail violated.
- `LoadoutPreview.vue` calls `useSetupFromUrl()` itself → composable-ownership guardrail violated; the component must consume props from `App.vue`'s single instance.
- Preview component re-declares any `DEFAULT_*_COUNT` constant instead of importing → drift test fails; defaults forked between editor and preview.
- Auto-switch fires more than once per mount → one-shot guardrail violated; `hasAppliedUrlAutoSwitch` ref missing or unset.
- `parseSetupUrl("?schemeId=")` drops the key (returns `{}`) instead of preserving the empty string → empty-singular semantics violated; URL presence is semantically meaningful and the validator owns rejection.
- `matchedCount` implementation references `error.field` or `error.path` without re-opening `setupContract.types.ts` to confirm → the property name in this WP is illustrative; STOP and amend WP-114 + EC-116 with the authoritative shape if the actual differs.
- `serializeSetupToUrl` test uses `parseSetupUrl(serializeSetupToUrl(...))` round-trip starting from a partial → type-error (parser returns Partial; serializer requires full); use the type-correct direction `parseSetupUrl(new URL(serializeSetupToUrl(fullComposition, baseUrl)).search)` instead.
