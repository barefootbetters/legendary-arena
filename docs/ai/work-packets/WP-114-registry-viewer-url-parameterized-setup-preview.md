# WP-114 — Registry Viewer URL-Parameterized Setup Preview ("Game of the Week")

**Status:** Draft (awaiting review)
**Primary Layer:** Client UI (`apps/registry-viewer`)
**Dependencies:**
- **WP-086** — hard sequencing prerequisite. WP-086 (queued registry-viewer
  card-types upgrade, blocked on WP-084) touches the same component tree
  (`apps/registry-viewer/src/components/`) and `App.vue`. WP-114 must land
  **after** WP-086 to avoid merge churn on `LoadoutBuilder.vue` and `App.vue`.
- **WP-091** — `@legendary-arena/registry/setupContract` exports
  `validateMatchSetupDocument`, `MatchSetupDocument`, `SetupCompositionInput`,
  `MatchSetupValidationError`; `apps/registry-viewer/src/composables/useLoadoutDraft.ts`
  exposes the editor's `draft` ref and `loadFromJson` mutator plus the
  default-count constants.
- **WP-093** — `heroSelectionMode` envelope field with v1 enum
  `["GROUP_STANDARD"]`; reserved token `"HERO_DRAFT"` is rejected by the
  validator until a future WP amends D-9301.
- **WP-113** — set-qualified ID format `<setAbbr>/<slug>` LOCKED for all five
  entity-ID fields per D-10014; bare slugs and display names are rejected by
  the validator.

---

## Session Context

WP-091 shipped the registry-viewer's Loadout Builder and the
`packages/registry/src/setupContract/` module that exports
`validateMatchSetupDocument()`; WP-093 locked `heroSelectionMode` as an
optional envelope field with v1 enum `["GROUP_STANDARD"]`; WP-113 locked
the set-qualified ID format `<setAbbr>/<slug>` for all five entity-ID
fields (PS-8 measured 51/307 hero-slug collisions, making bare-slug
ambiguity non-hypothetical); this packet adds a **read-only** URL-driven
preview surface so a curated MATCH-SETUP can be shared as a single link
without contacting the server, persisting state, or pre-filling the editor
unless the user explicitly clicks "Edit this loadout."

---

## Goal

After this session, opening the registry-viewer with URL query parameters
that name composition entities (e.g., `?schemeId=core/midtown-bank-robbery&mastermindId=core/loki-god-of-mischief&villainGroupIds=core/hydra,smwp/enemy-of-my-enemy&heroDeckIds=core/spider-man,core/wolverine,core/iron-man,core/hulk`)
renders a `LoadoutPreview` panel that:

- Parses the URL into a `Partial<SetupCompositionInput>` using the
  canonical 9-field names (`schemeId`, `mastermindId`, `villainGroupIds`,
  `henchmanGroupIds`, `heroDeckIds` — the four count fields are deliberately
  not URL-bound; see Out of Scope)
- Constructs a synthetic `MatchSetupDocument` (envelope defaults applied)
  and runs it through `validateMatchSetupDocument()` against the loaded
  `CardRegistry`
- Renders matched cards via the existing detail components (`CardDetail`,
  `ThemeDetail`)
- Displays a banner labeled "Loaded from URL" with each unknown ext_id
  surfaced as a non-fatal note
- On first mount, if URL parameters are present, auto-switches the active
  tab to "Loadout" (one-shot — subsequent user tab navigation is preserved)
- Exposes a "Copy Setup Link" button on `LoadoutBuilder` that serializes
  the current draft's composition block into the same URL shape

The preview is read-only. It does not mutate `useLoadoutDraft`, does not
persist to storage, and does not communicate with the server. The editor
remains the only authoring surface; "Edit this loadout" is a user-initiated
copy-into-editor convenience, not an automatic handoff.

**Determinism contract (canonical):** identical URLs must yield byte-identical
synthetic `MatchSetupDocument` JSON. All later determinism statements in this
packet reference this single rule. **Scope of the rule:** determinism applies
to the synthesized document JSON. URL-string determinism is only guaranteed
for URLs produced by `serializeSetupToUrl()` (where canonical key order is
enforced); user-typed URLs with arbitrary key order parse to the same
`Partial<SetupCompositionInput>` but their string form is not normalized
back to canonical order until they pass through the serializer.

**Scope frame:** "Game of the Week" is marketing copy only. This packet
introduces no rotation logic, no scheduling, no randomness, and no editorial
selection behavior — curation lives entirely outside the viewer.

---

## Assumes

- WP-086 complete. Specifically:
  - WP-086 has landed and merged into `main` before WP-114 begins (avoids
    merge churn on `LoadoutBuilder.vue` and `App.vue`)
- WP-091 complete. Specifically:
  - `packages/registry/src/setupContract/setupContract.types.ts` exports
    `SetupCompositionInput`, `MatchSetupDocument`, `MatchSetupValidationError`,
    `HeroSelectionMode`
  - `packages/registry/src/setupContract/setupContract.validate.ts` exports
    `validateMatchSetupDocument(document, registry)`
  - `apps/registry-viewer/src/composables/useLoadoutDraft.ts` exposes
    `draft: Ref<MatchSetupDocument>` and `loadFromJson(document): void`,
    plus the constants `DEFAULT_BYSTANDERS_COUNT`, `DEFAULT_WOUNDS_COUNT`,
    `DEFAULT_OFFICERS_COUNT`, `DEFAULT_SIDEKICKS_COUNT`,
    `DEFAULT_PLAYER_COUNT`, `DEFAULT_EXPANSIONS`
- WP-093 complete: `HeroSelectionMode` union is exactly `"GROUP_STANDARD"`
- WP-113 complete: `<setAbbr>/<slug>` ID format is the only accepted shape;
  bare slugs are rejected by the validator
- `pnpm --filter @legendary-arena/registry-viewer build` exits 0
- `pnpm --filter @legendary-arena/registry-viewer test` exits 0
- `pnpm --filter @legendary-arena/registry test` exits 0
- `docs/ai/DECISIONS.md` exists
- `docs/ai/ARCHITECTURE.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — confirms
  `apps/registry-viewer` may import `@legendary-arena/registry` types but
  never `game-engine`, `preplan`, `apps/server`, `boardgame.io`, or `pg`.
  This packet adds new files inside the viewer; layer boundary checks
  apply at every import.
- `docs/ai/ARCHITECTURE.md §1 Monorepo Package Boundaries` — confirms the
  `apps/registry-viewer` import allowlist.
- `.claude/rules/architecture.md §Layer Boundary (Authoritative)` — runtime
  enforcement of the same boundary; the import-rules table for
  `apps/registry-viewer` is the binding form.
- `docs/ai/REFERENCE/00.2-data-requirements.md §7 Match Configuration` —
  the 9-field composition contract is locked. URL parameter names must use
  the canonical names verbatim.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations:
  `villains` is not a substitute for `villainGroupIds`), Rule 6 (`// why:`
  comments), Rule 11 (full-sentence error messages), Rule 13 (ESM only),
  Rule 14 (field names match data contract).
- `docs/ai/DECISIONS.md` — scan for D-9101 (WP-091 envelope-defaults
  rationale), D-9301 (WP-093 rule-mode policy), D-10014 (WP-113
  set-qualified ID format).
- `packages/registry/src/setupContract/setupContract.types.ts` — read
  entirely. The composition contract, envelope shape, and error codes
  must not be re-derived from memory.
- `packages/registry/src/setupContract/setupContract.validate.ts` —
  confirm no Node-only imports (the validator runs in the browser);
  confirm error codes match the union in `.types.ts`.
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — read the
  default-values comment block; the URL preview reuses these constants
  verbatim and must not re-declare them.
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — read the
  mutator API surface (`setScheme`, `setMastermind`, `addVillainGroup`,
  `addHenchmanGroup`, `addHeroGroup`, `setCount`); the "Copy Setup Link"
  button reads `draft.value.composition` directly without invoking these.
- `apps/registry-viewer/src/App.vue` — read the existing tab-routing
  mechanism; the auto-switch behavior must integrate with it without
  introducing a router library.
- `docs/ai/work-packets/WP-091-loadout-builder-registry-viewer.md` §Goal —
  the "no persistence" clause; URL parameters are declarative shareable
  input, not draft persistence, and must be called out in
  `LoadoutPreview.vue`'s file-header comment.
- `docs/ai/work-packets/WP-113-engine-server-registry-wiring-and-validator-alignment.md`
  §Scope "set-qualified ID format LOCKED" — confirm test fixtures use
  `<setAbbr>/<slug>` throughout.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never persist URL state or any preview state to `localStorage`,
  `sessionStorage`, `IndexedDB`, or `cookies` — URL is the sole carrier
- ESM only, Node v22+ — all new files use `import`/`export`, never
  `require()`
- `node:` prefix on all Node.js built-in imports (test files only)
- Test files use `.test.ts` extension — never `.test.mjs`
- No imports from `@legendary-arena/game-engine`, `@legendary-arena/preplan`,
  `boardgame.io`, `pg`, or any `apps/server/**` path
- No database, network, or filesystem access in any new file
- Full file contents for every new or modified file in the output —
  no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- URL parameter names are exactly `schemeId`, `mastermindId`,
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`. Paraphrasing
  (e.g., `scheme`, `villains`, `heroes`) is a Session Abort Condition.
  Reason: WP-091 + WP-093 + WP-113 govern the canonical shape; a
  parallel naming would fork the contract.
- ID values use the WP-113 set-qualified format `<setAbbr>/<slug>`. The
  parser does not normalize, lowercase, strip, or fuzzy-match. Unknown
  shapes are passed through to `validateMatchSetupDocument()`, which
  rejects them per D-10014.
- The four count fields (`bystandersCount`, `woundsCount`,
  `officersCount`, `sidekicksCount`) and all envelope fields
  (`schemaVersion`, `setupId`, `createdAt`, `createdBy`, `seed`,
  `playerCount`, `expansions`, `heroSelectionMode`) are not URL-bound.
  Defaults are imported from `useLoadoutDraft.ts` constants — do not
  re-declare them.
- `LoadoutPreview.vue` is read-only. It must not import or invoke any
  `useLoadoutDraft` mutator (`setScheme`, `setMastermind`,
  `addVillainGroup`, `addHenchmanGroup`, `addHeroGroup`, `setCount`,
  `setPlayerCount`, `setSeed`, `reRollSeed`, `prefillFromTheme`,
  `resetDraft`). The "Edit this loadout" button calls `loadFromJson`
  exactly once, on user click — this is the only permitted mutator
  invocation in the preview component.
- The "Copy Setup Link" button uses `navigator.clipboard.writeText`. On
  failure (permission denied, insecure context), it falls back to a
  `<input readonly>` reveal so the URL is always recoverable. Add
  `// why:` comment.
- No router library is added. URL parsing uses `URLSearchParams`
  against `window.location.search` only. The auto-switch-to-Loadout-tab
  behavior fires once on first mount and is not re-applied when the
  user navigates between tabs.
- No HTTP, no fetch, no WebSocket, no eval, no `Function()` constructor.

**Session protocol:**
- Validator error surfacing: if a `validateMatchSetupDocument()` error
  message is technically accurate but phrased in a developer-centric
  or user-hostile way, do not paraphrase it and do not suppress it.
  Surface it verbatim in the preview (the error is the contract) and
  raise the wording as a follow-up WP candidate for WP-093 amendment.
  Stop and ask only if the message is technically incorrect or
  references contract values this packet has not bound.
- If any contract, field name, or reference is unclear, stop and ask
  the human before proceeding — never guess or invent field names,
  type shapes, or file paths.

**Locked contract values:**

- **MatchSetupConfig composition fields** (this packet binds the first
  five to URL parameters; the last four are default-only):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **Envelope defaults** (sourced from
  `apps/registry-viewer/src/composables/useLoadoutDraft.ts` for the four
  count constants and `DEFAULT_PLAYER_COUNT` / `DEFAULT_EXPANSIONS`; the
  remaining literals are inlined in the composable per the per-field
  rationales below):
  `schemaVersion: "1.0"`, `createdBy: "system"`,
  `playerCount: DEFAULT_PLAYER_COUNT`,
  `expansions: DEFAULT_EXPANSIONS`,
  `heroSelectionMode: "GROUP_STANDARD"`,
  `setupId: "url-preview"`,
  `seed: "0000000000000000"` (16-hex placeholder; preview never feeds
  the engine, so seed identity is cosmetic),
  `createdAt: "1970-01-01T00:00:00.000Z"` (Unix-epoch placeholder; the
  field is required by `SetupEnvelope` so it must be set, but using
  `Date.now()` would break the determinism contract above; the literal
  signals "synthetic preview document" to any reader)

- **HeroSelectionMode v1 enum**: `"GROUP_STANDARD"` is the only legal
  value (WP-093 D-9301)

- **Set-qualified ID format**: `<setAbbr>/<slug>` for `schemeId`,
  `mastermindId`, `villainGroupIds[*]`, `henchmanGroupIds[*]`,
  `heroDeckIds[*]` (WP-113 D-10014)

---

## Debuggability & Diagnostics

- The determinism contract above (§Goal) holds: identical URLs yield
  byte-identical synthetic `MatchSetupDocument` JSON. Mechanically
  this is preserved by `parseSetupUrl()` being pure (no clocks, no
  randomness, no I/O) and by every envelope default being a fixed
  literal — `seed` is `"0000000000000000"`, `createdAt` is the
  Unix-epoch literal, no `Date.now()` or `crypto.randomUUID()` is
  invoked anywhere in the synthesis path.
- The `LoadoutPreview` panel does not append to `G.messages` because
  it does not touch engine state; debuggability is satisfied via test
  fixtures and DOM-level component tests.
- `useSetupFromUrl()` exposes `parsedParams`, `previewDocument`, and
  `validationErrors` as plain `Ref` / `ComputedRef` values for
  in-component inspection.
- Failures localize to either: (a) parser output mismatch (covered by
  parser tests), (b) envelope-default drift (covered by drift test
  re-importing `useLoadoutDraft` constants), or (c) validator rejection
  (covered by composable tests with known-bad ext_ids).

---

## Scope (In)

### A) URL parser/serializer (pure helper)
**`apps/registry-viewer/src/lib/setupUrlParams.ts`** — new:
- Module-header JSDoc declaring: pure helper; no Vue, no DOM, no
  network; deterministic.
- `parseSetupUrl(search: string): Partial<SetupCompositionInput>` —
  accepts `window.location.search` (with or without leading `?`),
  returns only the keys that were present in the URL. Unknown query
  keys are silently dropped. Empty array values produce `[]`, not
  `[""]`. Comma-separated list values are split on `,`. No manual
  trimming, lowercasing, or normalization is performed; behavior is
  exactly that of `URLSearchParams` decoding plus the `,` split.
- **Empty-string semantics for singular fields (locked):** if a
  singular key is present with an empty value (`?schemeId=` or
  `?mastermindId=`), the parser returns the empty string value (e.g.,
  `{ schemeId: "" }`) and relies on `validateMatchSetupDocument()` to
  reject it as an unknown ext_id. Rationale: presence in the URL is
  semantically meaningful ("the user shared a URL with this key, even
  if blank"); the validator owns ID validity. Add `// why:` comment.
- `serializeSetupToUrl(composition: SetupCompositionInput, baseUrl:
  string): string` — emits canonical key order:
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`. Count fields and envelope fields are deliberately
  omitted (they are owned by `useLoadoutDraft` defaults).
- **Base URL contract:** `baseUrl` MUST be origin + pathname only
  (e.g., `https://cards.barefootbetters.com/`); any existing query or
  hash is the caller's concern. The serializer does not inspect or
  strip the base URL — pass `window.location.origin +
  window.location.pathname` from the call site.
- Add `// why:` comment on the `URLSearchParams` choice (forward
  slashes in `<setAbbr>/<slug>` round-trip cleanly through standard
  URL encoding; no manual `%2F` handling required).
- Add `// why:` comment on the deliberate omission of count and
  envelope fields (URL is composition-only by design; defaults live
  in `useLoadoutDraft.ts`).
- Add `// why:` comment on the empty-array handling (URLSearchParams
  yields `""` for an empty value; the parser must convert this to
  `[]` to satisfy the `string[]` type contract).
- No imports from `@legendary-arena/registry/setupContract`; this
  helper is type-bound only via `import type
  { SetupCompositionInput } from "@legendary-arena/registry/setupContract"`.
- Every exported function has a JSDoc comment with parameter, return,
  and edge-case notes per `00.6-code-style.md` Rule 5.

### B) Composable
**`apps/registry-viewer/src/composables/useSetupFromUrl.ts`** — new:
- Module-header JSDoc declaring: read-only; no persistence; no engine
  handoff; no server contact. URL parameters are declarative
  shareable input, not draft state.
- `useSetupFromUrl(registry: CardRegistryReader): {
    parsedParams: ComputedRef<Partial<SetupCompositionInput>>;
    hasUrlParams: ComputedRef<boolean>;
    previewDocument: ComputedRef<MatchSetupDocument | null>;
    validationErrors: ComputedRef<MatchSetupValidationError[]>;
    matchedCount: ComputedRef<{ schemes: number; masterminds: number;
      villainGroups: number; henchmanGroups: number; heroDecks: number }>;
  }`
- Reads `window.location.search` once at composable instantiation
  via a `ref` initialized to `parseSetupUrl(window.location.search)`.
- `previewDocument` synthesizes a `MatchSetupDocument` by combining
  parsed params with envelope defaults imported from
  `useLoadoutDraft.ts` (do not re-declare). Returns `null` when
  `hasUrlParams === false`.
- Calls `validateMatchSetupDocument(synthetic, registry)` and exposes
  the error list. When the validator returns `{ ok: true, value }`,
  `validationErrors.value` is `[]`.
- `matchedCount[field]` is computed as: total URL-provided IDs for
  that field minus the count of `code: 'unknown_extid'` validation
  errors whose path identifier maps to that same field. Other error
  codes do not subtract from the match count. For singular fields
  (`schemes`, `masterminds`), the value is `0` or `1`.
- **Validator error-path binding (do NOT guess — read `.types.ts`
  first):** before implementing `matchedCount`, the executor MUST
  re-open `packages/registry/src/setupContract/setupContract.types.ts`
  and confirm the authoritative property name and value format of the
  path identifier on `MatchSetupValidationError`. The names this WP
  references (`field`, "field path identifies") are illustrative only;
  the actual property may be `field`, `path`, or another name, and
  the format may be a dot-string (`"composition.villainGroupIds[0]"`)
  or a segment array (`["composition","villainGroupIds",0]`). If the
  actual shape differs from any reference in this WP, STOP and amend
  the packet with the authoritative shape before implementing —
  paraphrasing is a Session Abort Condition (no exceptions; this is
  the same rule as canonical field-name paraphrasing).
- Add `// why:` comment on the `setupId: 'url-preview'` literal
  (preview docs are not real loadouts; the synthetic id avoids
  generating a fresh id per render and stabilizes test fixtures).
- Add `// why:` comment on the `createdAt: '1970-01-01T00:00:00.000Z'`
  literal (the field is required by `SetupEnvelope`; using `Date.now()`
  here would break the §Goal determinism contract; the Unix-epoch
  value signals "synthetic preview document" to any reader).

### C) Preview component
**`apps/registry-viewer/src/components/LoadoutPreview.vue`** — new:
- Module-header `<!-- -->` comment block declaring: read-only; no
  persistence; no engine handoff; no server contact; URL is the sole
  state carrier.
- `<script setup lang="ts">` block declares props for
  `hasUrlParams: boolean`, `previewDocument: MatchSetupDocument | null`,
  `validationErrors: MatchSetupValidationError[]`, `matchedCount: { ... }`,
  and `parsedParams: Partial<SetupCompositionInput>` (these come from
  `App.vue`'s single `useSetupFromUrl(registry)` call per §E ownership
  rule). The component does NOT call `useSetupFromUrl()` itself.
  It DOES import `useLoadoutDraft` to access the `loadFromJson`
  mutator (the only permitted mutator invocation per §Non-Negotiable
  Constraints), the existing `CardDetail` / `ThemeDetail` components,
  and `import type` for `SetupCompositionInput`,
  `MatchSetupValidationError`, `MatchSetupDocument`.
- Renders nothing when `hasUrlParams.value === false` (returns an
  empty fragment).
- Header: a banner element containing the literal text "Loaded from
  URL" plus a "Copy this link" button that writes `window.location.href`
  via `navigator.clipboard.writeText`.
- Five sections, each labeled with its canonical-name field title:
  "Scheme" (`schemeId`), "Mastermind" (`mastermindId`), "Villain
  Groups" (`villainGroupIds`), "Henchman Groups" (`henchmanGroupIds`),
  "Hero Decks" (`heroDeckIds`). Each section renders matched cards via
  the existing `CardDetail` component (or `ThemeDetail` for hero
  decks, matching `LoadoutBuilder`'s rendering choice). Unknown
  ext_ids are rendered as a muted line with the literal text
  "Unknown ext_id: " followed by the offending value.
- "Edit this loadout" button: on click, calls
  `loadFromJson(previewDocument.value)` exactly once. Disabled when
  `previewDocument.value === null`. Add `// why:` comment: this is
  the only permitted mutator invocation in this component; it is
  user-initiated and copies the preview into the editor draft for
  modification.

### D) Copy Setup Link button on existing builder
**`apps/registry-viewer/src/components/LoadoutBuilder.vue`** — modified:
- Add a single button with literal text "Copy Setup Link" near the
  existing JSON download/upload controls.
- On click: serialize `draft.value.composition` via
  `serializeSetupToUrl()` using `window.location.origin +
  window.location.pathname` as the base URL. Write the result to the
  clipboard via `navigator.clipboard.writeText`. On rejection or
  error, reveal a `<input readonly>` element with the URL pre-populated
  and pre-selected so the user can copy manually.
- Add `// why:` comment on the clipboard fallback path (browsers gate
  `clipboard.writeText` behind a permissions prompt and an
  insecure-context block; the readonly-input fallback ensures the
  URL is never lost).
- This is the only modification to `LoadoutBuilder.vue`. Existing
  mutator API, JSON export/import controls, picker panel, and
  rule-mode banner are not touched. Refactors are out of scope.

### E) App routing
**`apps/registry-viewer/src/App.vue`** — modified:
- **Composable ownership (locked).** `App.vue` instantiates
  `useSetupFromUrl(registry)` exactly once, using the same
  `CardRegistryReader` instance the existing Loadout tab already
  consumes. The composable's outputs (`hasUrlParams`,
  `previewDocument`, `validationErrors`, `matchedCount`,
  `parsedParams`) are then passed to `<LoadoutPreview>` as props.
  This avoids two parses + two validations of the same URL and gives
  `App.vue` direct access to `hasUrlParams` for the auto-switch
  decision.
  Add `// why:` comment: a single composable instance per page
  prevents duplicate parsing/validation work and keeps the
  declarative URL state consistent across the parent (auto-switch)
  and child (preview render) consumers.
- Mount `<LoadoutPreview>` inside the Loadout tab pane, above
  `<LoadoutBuilder>`, passing the composable's outputs as props (at
  minimum: `hasUrlParams`, `previewDocument`, `validationErrors`,
  `matchedCount`, `parsedParams`). The preview renders only when
  `hasUrlParams === true`; otherwise it produces no DOM.
- On first mount only, if `hasUrlParams === true` and the active tab
  is not "Loadout", set the active tab to "Loadout" exactly once.
  Track this via a `hasAppliedUrlAutoSwitch` boolean ref initialized
  to `false`; set to `true` after the first switch. Subsequent user
  tab navigation is preserved (the auto-switch does not re-fire).
- Add `// why:` comment on the one-shot pattern (URL params are a
  declarative arrival signal, not a sticky preference; re-applying
  the switch on later renders would override the user's manual
  navigation).

### F) Tests
**`apps/registry-viewer/src/lib/setupUrlParams.test.ts`** — new
(`node:test`):
- **Type-correct round-trip:** given a full `SetupCompositionInput`
  object (all five URL-bound keys plus the four count keys),
  `parseSetupUrl(new URL(serializeSetupToUrl(composition, baseUrl)).search)`
  returns exactly the expected `Partial<SetupCompositionInput>`
  containing only the five URL-bound keys (`schemeId`,
  `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`). Count keys are NOT in the parsed result because
  the serializer omits them. This is the parse-after-serialize
  direction; type-safe because the input is fully-typed.
- **Canonical-order assertion:** `serializeSetupToUrl(composition,
  baseUrl)` produces a URL whose query-string substring places the
  five keys in this exact order: `schemeId`, `mastermindId`,
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`. Test by
  extracting the raw query string (everything after `?`) and asserting
  the key sequence. Do NOT compare URLs "modulo key order" — the
  serializer's contract IS canonical order, so the test enforces it
  literally.
- `parseSetupUrl('')` returns `{}` (no thrown errors).
- `parseSetupUrl('?schemeId=core/foo')` returns `{ schemeId: 'core/foo' }`
  and nothing else.
- `parseSetupUrl('?villainGroupIds=core/hydra,smwp/enemy-of-my-enemy')`
  returns `{ villainGroupIds: ['core/hydra', 'smwp/enemy-of-my-enemy'] }`.
- Forward-slash round-trip: `core/loki-god-of-mischief` survives
  encode → decode unchanged.
- Unknown query keys (e.g., `?foo=bar`) are silently dropped.
- Empty array values (e.g., `?villainGroupIds=`) produce
  `villainGroupIds: []`, not `[""]`.
- **Empty-singular semantics:** `parseSetupUrl('?schemeId=')`
  returns `{ schemeId: '' }` (empty string preserved); the parser
  defers to the validator for ID-validity rejection.

**`apps/registry-viewer/src/composables/useSetupFromUrl.test.ts`** —
new (`node:test`):
- Synthesizes a valid `MatchSetupDocument` when all five entity
  arrays are populated with registry-known ext_ids; `validationErrors`
  is empty.
- Surfaces an `unknown_extid` error when the URL names an ext_id
  absent from the test `CardRegistryReader`; `field` value matches
  the expected canonical path.
- Returns `previewDocument: null` when the URL is empty.
- Drift test: re-imports `DEFAULT_BYSTANDERS_COUNT`,
  `DEFAULT_WOUNDS_COUNT`, `DEFAULT_OFFICERS_COUNT`,
  `DEFAULT_SIDEKICKS_COUNT`, `DEFAULT_PLAYER_COUNT`,
  `DEFAULT_EXPANSIONS` from `useLoadoutDraft.ts` and asserts the
  composable's synthesized envelope uses these exact values. Add
  `// why:` comment: failure here means defaults forked between the
  editor and the preview, breaking round-trip consistency between
  "Edit this loadout" and the original URL.

---

## Vision Alignment

- **Vision clauses touched:** §10a (Registry Viewer public surfaces).
- **Conflict assertion:** No conflict — the preview is read-only,
  additive, and serves the §10a goal of making the public viewer a
  useful reference surface.
- **Non-Goal proximity check:** None of NG-1..NG-7 are crossed.
  - NG-1 (no monetization surfaces): no funding affordances added or
    modified.
  - NG-2 (no PvP framing / opponent / win-loss / matchmaking):
    "Game of the Week" refers to the curated game itself, not to
    player-vs-player; the preview displays composition entities
    (scheme, mastermind, villain groups, hero decks) without comparison
    or scoring.
  - NG-3 / NG-4 (no scoring / leaderboards / rankings): the preview
    is purely descriptive; no comparison, no metrics, no rankings.
  - NG-5..NG-7: not engaged (no auth, no cosmetics, no replay surface).
- **Determinism preservation:** Not engaged for engine determinism
  (the viewer never touches engine state). Parser determinism is
  preserved by construction: `parseSetupUrl` is a pure function over a
  string input with no clocks, no randomness, and no I/O. The
  synthesized `MatchSetupDocument` uses fixed-string envelope defaults
  (no `Date.now()`, no `crypto.randomUUID()`) so identical URLs yield
  byte-identical synthetic documents.

---

## Funding Surface Gate

**N/A** — this packet adds no funding affordances and modifies none
of the existing ones. The preview surface displays MATCH-SETUP
composition data sourced from the loaded `CardRegistry` only; no
"donate", "support tournaments", or equivalent copy is introduced.
The "Loaded from URL" banner, "Copy Setup Link" button, "Copy this
link" button, and "Edit this loadout" button are all
setup-share / setup-edit affordances, not funding affordances.
WP-097 §B funding affordances on the registry viewer (if any) remain
unchanged. **Authority:** WP-097, D-9701, D-9801.

---

## Out of Scope

- **Match handoff to the lobby / arena-client.** Preview-only by
  design; transferring a URL-derived setup into a real match is a
  separate WP that would extend WP-092's lobby JSON intake to accept
  URL-derived documents.
- **Persistence of any kind.** No `localStorage`, no `sessionStorage`,
  no IndexedDB, no cookies, no server round-trip.
- **Authentication, user accounts, saved-loadout libraries.** Same
  boundary as WP-091.
- **URL hash-based encoding / compression.** Listed as a future
  extension in the original proposal; defer to a follow-up WP if URL
  length becomes a problem.
- **Pile counts and envelope fields in URL.** Defaults are applied
  from `useLoadoutDraft.ts` constants; surfacing them in URL is a
  future-extension hook, not part of this packet.
- **Rule-mode selection.** `heroSelectionMode` defaults to
  `"GROUP_STANDARD"` per WP-093; no URL parameter exposes it.
  `"HERO_DRAFT"` is reserved for a future WP per D-9301.
- **Random / curated-content rotation logic.** "Game of the Week"
  rotation lives in marketing copy / external publishing, not in the
  viewer.
- **Player-count enforcement, gameplay legality checking.** The
  validator already covers ext_id validity; gameplay legality is the
  engine's job (and out of scope for the viewer entirely).
- **Refactors of `LoadoutBuilder.vue` beyond adding the Copy Setup
  Link button.** Touching the editor's mutator API, picker filter,
  rule-mode banner, or JSON download/upload controls is a Session
  Abort Condition.
- **A new tab.** The preview lives inside the existing Loadout tab,
  not as a fourth tab.
- **A router library.** No `vue-router`, no history-API push.

---

## Files Expected to Change

### Implementation (only these app files may change)

- `apps/registry-viewer/src/lib/setupUrlParams.ts` — **new** —
  pure URL parser/serializer.
- `apps/registry-viewer/src/lib/setupUrlParams.test.ts` — **new** —
  `node:test` parser coverage including type-correct round-trip,
  canonical-order assertion, and empty-singular semantics.
- `apps/registry-viewer/src/composables/useSetupFromUrl.ts` — **new** —
  composable wiring URL → validator with envelope defaults.
- `apps/registry-viewer/src/composables/useSetupFromUrl.test.ts` —
  **new** — `node:test` composable coverage including drift test.
- `apps/registry-viewer/src/components/LoadoutPreview.vue` — **new** —
  read-only preview panel; consumes props from `App.vue`'s single
  `useSetupFromUrl(registry)` instance per §E ownership rule.
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` —
  **modified** — add "Copy Setup Link" button; no other changes.
- `apps/registry-viewer/src/App.vue` — **modified** — instantiate
  `useSetupFromUrl(registry)` once, mount `<LoadoutPreview>` inside
  the Loadout tab pane with the composable's outputs as props, and
  apply one-shot auto-switch to Loadout tab when URL params are
  present.

### Component-level behavior — manual verification only (no new test files)

The following two acceptance criteria items are verified manually
against the dev server (`pnpm --filter @legendary-arena/registry-viewer
dev`) per the WP-066 / WP-094 / WP-096 / EC-103 viewer-side precedent.
They are NOT covered by automated tests in this packet because the
viewer's test runner (`node --import tsx --test`, established under
WP-086 / D-8607) is pure-Node and cannot mount Vue components; adding
DOM test infrastructure (jsdom + `@vue/test-utils` + a runner change)
would be a significant scope expansion outside WP-114's bounds.

- **Clipboard fallback (LoadoutBuilder.vue "Copy Setup Link"):** open
  the dev server, navigate to the Loadout tab, build a non-empty
  composition, deny clipboard permission in the browser permission
  prompt (or use an HTTP context where `navigator.clipboard` is
  unavailable), click "Copy Setup Link", and verify the readonly-input
  fallback element appears with the URL pre-populated and pre-selected.
- **One-shot auto-switch (App.vue):** open the dev server with URL
  params present (e.g., `?schemeId=core/foo`), confirm the active
  tab is "Loadout" on first render, manually switch to a different
  tab (e.g., Cards), then trigger any reactive update (filter input,
  search), and confirm the tab does not re-switch back to Loadout.

If a future viewer-side test-harness WP introduces DOM-rendering test
support, these items should be promoted to automated component tests
at that time.

### Governance closeout (per Definition of Done)

- `docs/ai/STATUS.md` — **modified** — record feature landing block
  per recent precedent.
- `docs/ai/DECISIONS.md` — **modified** — three D-114XX entries
  (canonical URL keys; count/envelope-not-URL-bound; one-shot
  auto-switch; `useSetupFromUrl` ownership at `App.vue` may warrant
  a fourth at executor discretion).
- `docs/ai/work-packets/WORK_INDEX.md` — **modified** — flip WP-114
  `[ ]` → `[x]` with date and Commit A SHA.
- `docs/ai/execution-checklists/EC_INDEX.md` — **modified** — flip
  EC-116 row Draft → Done with date.

No other files may be modified beyond Implementation + Governance
closeout listed above.

---

## Acceptance Criteria

- [ ] `setupUrlParams.ts` exports exactly `parseSetupUrl` and
  `serializeSetupToUrl`; both are pure functions; no `throw`
  statements; no imports from `@legendary-arena/registry/setupContract`
  except `import type`.
- [ ] `parseSetupUrl('?schemeId=core/foo&villainGroupIds=core/a,smwp/b')`
  returns exactly `{ schemeId: 'core/foo', villainGroupIds: ['core/a',
  'smwp/b'] }`; `parseSetupUrl('')` returns `{}`; unknown query keys
  are silently dropped; `?villainGroupIds=` produces `[]`.
- [ ] `useSetupFromUrl(registry)` returns the five `ComputedRef`
  fields named exactly `parsedParams`, `hasUrlParams`,
  `previewDocument`, `validationErrors`, `matchedCount`. When all
  five entity arrays are URL-bound to registry-known ext_ids,
  `validationErrors.value.length === 0`.
- [ ] Drift test: `useSetupFromUrl`'s synthesized envelope uses the
  exact constant values exported by `useLoadoutDraft.ts`
  (`DEFAULT_BYSTANDERS_COUNT`, `DEFAULT_WOUNDS_COUNT`,
  `DEFAULT_OFFICERS_COUNT`, `DEFAULT_SIDEKICKS_COUNT`,
  `DEFAULT_PLAYER_COUNT`, `DEFAULT_EXPANSIONS`).
- [ ] `LoadoutPreview.vue` does not import any mutator from
  `useLoadoutDraft` other than `loadFromJson` (confirmed with
  `Select-String` for `setScheme`, `setMastermind`, `addVillainGroup`,
  `addHenchmanGroup`, `addHeroGroup`, `setCount`, `setPlayerCount`,
  `setSeed`, `reRollSeed`, `prefillFromTheme`, `resetDraft`); the
  pattern returns no matches.
- [ ] `LoadoutPreview.vue` produces empty DOM when
  `hasUrlParams === false`; renders the literal banner text
  "Loaded from URL" when `hasUrlParams === true`; the
  "Edit this loadout" button is disabled when
  `previewDocument === null`.
- [ ] `LoadoutBuilder.vue` contains a button with literal text
  "Copy Setup Link"; clipboard write fallback path verified by
  manual smoke per §Files Expected to Change → "Component-level
  behavior — manual verification only" (deny clipboard permission;
  confirm readonly-input fallback appears with URL pre-populated and
  pre-selected). Operator records the result in the Commit A
  message and STATUS.md block.
- [ ] `App.vue` instantiates `useSetupFromUrl(registry)` exactly once
  (grep-confirmed: `Select-String -Path "apps\registry-viewer\src\App.vue"
  -Pattern "useSetupFromUrl\("` returns exactly 1 match);
  `LoadoutPreview.vue` does NOT call `useSetupFromUrl()` itself
  (`Select-String -Path "apps\registry-viewer\src\components\LoadoutPreview.vue"
  -Pattern "useSetupFromUrl\("` returns 0 matches).
- [ ] `App.vue`'s auto-switch fires exactly once on first mount when
  URL params are present; subsequent tab navigation by the user does
  not re-trigger it. Verified by manual smoke per §Files Expected to
  Change → "Component-level behavior — manual verification only"
  (open with `?schemeId=core/foo`; confirm Loadout tab is active;
  switch to Cards; trigger a reactive update; confirm tab does not
  re-switch). Operator records the result in the Commit A message
  and STATUS.md block.
- [ ] No imports from `@legendary-arena/game-engine`,
  `@legendary-arena/preplan`, `apps/server`, `boardgame.io`, or `pg`
  in any new or modified file.
- [ ] No use of `localStorage`, `sessionStorage`, `IndexedDB`, or
  `document.cookie` in any new or modified file.
- [ ] No use of `Math.random` in any new or modified file.
- [ ] No files outside `## Files Expected to Change` were modified
  (confirmed with `git diff --name-only`).

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/registry-viewer build
# Expected: exits 0, no TypeScript errors

# Step 2 — viewer tests
pnpm --filter @legendary-arena/registry-viewer test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — registry regression check (setupContract should be untouched)
pnpm --filter @legendary-arena/registry test
# Expected: TAP output — all tests passing, 0 failing

# Step 4 — confirm no engine / preplan / server / boardgame.io / pg imports
Select-String -Path "apps\registry-viewer\src\lib\setupUrlParams.ts","apps\registry-viewer\src\composables\useSetupFromUrl.ts","apps\registry-viewer\src\components\LoadoutPreview.vue","apps\registry-viewer\src\components\LoadoutBuilder.vue","apps\registry-viewer\src\App.vue" -Pattern "from '@legendary-arena/game-engine|from '@legendary-arena/preplan|from 'apps/server|from 'boardgame\.io|from 'pg'"
# Expected: no output

# Step 5 — confirm no persistence APIs
Select-String -Path "apps\registry-viewer\src\lib\setupUrlParams.ts","apps\registry-viewer\src\composables\useSetupFromUrl.ts","apps\registry-viewer\src\components\LoadoutPreview.vue" -Pattern "localStorage|sessionStorage|indexedDB|document\.cookie"
# Expected: no output

# Step 6 — confirm canonical field names appear (positive proof)
Select-String -Path "apps\registry-viewer\src\lib\setupUrlParams.ts" -Pattern "schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds"
# Expected: each name appears at least twice (parser branch + serializer branch)

# Step 7 — confirm forbidden paraphrases are absent from the parser
Select-String -Path "apps\registry-viewer\src\lib\setupUrlParams.ts" -Pattern "['""](scheme|mastermind|villains|heroes)['""]"
# Expected: no output (paraphrased keys forbidden — see D-NNNN at execution)

# Step 8 — confirm no Math.random
Select-String -Path "apps\registry-viewer\src" -Pattern "Math\.random" -Recurse
# Expected: no output

# Step 9 — confirm no throw in parser
Select-String -Path "apps\registry-viewer\src\lib\setupUrlParams.ts" -Pattern "throw "
# Expected: no output

# Step 10 — confirm scope
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/registry-viewer build` exits 0
- [ ] `pnpm --filter @legendary-arena/registry-viewer test` exits 0
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0
- [ ] No `throw` in `apps/registry-viewer/src/lib/setupUrlParams.ts`
  (confirmed with `Select-String`)
- [ ] No `Math.random` in any new or modified file
  (confirmed with `Select-String`)
- [ ] No imports from `@legendary-arena/game-engine`,
  `@legendary-arena/preplan`, `apps/server`, `boardgame.io`, or `pg`
  (confirmed with `Select-String`)
- [ ] No persistence APIs (`localStorage`, `sessionStorage`,
  `IndexedDB`, `document.cookie`) in any new or modified file
- [ ] WP-091 contract files
  (`packages/registry/src/setupContract/setupContract.types.ts`,
  `packages/registry/src/setupContract/setupContract.validate.ts`,
  `apps/registry-viewer/src/composables/useLoadoutDraft.ts`) were
  not modified (confirmed with `git diff`)
- [ ] No files outside `## Files Expected to Change` were modified
  (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — "registry viewer accepts
  URL-parameterized read-only setup previews; no engine or server
  handoff; auto-switches to Loadout tab on first mount when params
  are present"
- [ ] `docs/ai/DECISIONS.md` updated — at minimum:
  - D-114XX: URL parameter names use canonical 9-field composition
    names verbatim (no aliases) — preserves WP-091 + WP-093 + WP-113
    contract continuity
  - D-114XX: count fields and envelope fields are deliberately not
    URL-bound — defaults live in `useLoadoutDraft.ts` constants;
    surfacing them in URL is deferred
  - D-114XX: auto-switch-to-Loadout-tab fires once per mount and is
    not re-applied on subsequent tab navigation — declarative arrival
    signal vs. sticky preference
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-114 checked off
  with today's date
