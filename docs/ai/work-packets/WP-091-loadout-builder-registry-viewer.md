# WP-091 — Loadout Builder in Registry Viewer

**Status:** Draft (awaiting review)
**Primary Layer:** Registry / Contracts + Client UI (registry-viewer)
**Dependencies:** WP-003 (CardRegistry), WP-005A (`MatchSetupConfig` 9-field
contract), WP-055 (theme data model — `setupIntent` fields), WP-065
(vue-sfc-loader; not required at runtime for registry-viewer, but
documented here for test-tooling context), **WP-093 (Match-Setup Rule-Mode
Envelope Field — canonicalizes `heroSelectionMode` as an optional envelope
field with v1 enum `["GROUP_STANDARD"]`; prerequisite even though its
number is higher).** Compatible with (not dependent on) WP-086 and
WP-090. Prerequisite for WP-092.

---

## Session Context

WP-005A locked the 9-field `MatchSetupConfig` contract (00.2 §8.1);
`MATCH-SETUP-SCHEMA.md` / `MATCH-SETUP-JSON-SCHEMA.json` /
`MATCH-SETUP-VALIDATION.md` canonicalize the two-layer envelope + composition
document used across gameplay, replay, PAR, and simulation; WP-055 established
the theme model whose `setupIntent` block already carries five of the nine
composition fields; WP-090 ships a 9-field create-match form in the arena-
client lobby that accepts a `setupData` payload matching the composition
block verbatim; **WP-093 adds `heroSelectionMode` as an optional envelope
field with v1 enum `["GROUP_STANDARD"]`** (rule-mode flag preserved on the
envelope so the 9-field composition lock stays intact — see WP-093's
DECISIONS entry for the full rationale and the reservation of
`"HERO_DRAFT"` for a future WP). This packet adds the first authoring
surface for the canonical MATCH-SETUP document — a loadout builder in the
public Registry Viewer (`cards.barefootbetters.com`) that emits
`heroSelectionMode: "GROUP_STANDARD"` alongside the 9 composition fields,
rejects any other rule mode at the validator, and produces a schema-valid
JSON document without contacting the game server.

**Rule-mode lifecycle (explicit):** in v1 of the match setup schema,
`heroSelectionMode` is a governance-controlled envelope field with
exactly one allowed value (`"GROUP_STANDARD"`). This packet surfaces the
field for auditability (always emitted in downloaded JSON) and for
read-only display (the rule-mode indicator), but **does not allow user
choice** — there is no picker, no dropdown, no toggle. Future rule modes
(reserved token: `"HERO_DRAFT"`) are explicitly rejected per WP-093
until a separate WP amends WP-093 to enable them. A reader encountering
the rule-mode indicator in v1 should understand that the field exists
today to keep the schema forward-compatible and the JSON replay-stable,
not because the user has anything to choose.

---

## Goal

After this session:

- `packages/registry` exports a new `setupContract` module (types + zod
  schema + `validateMatchSetupDocument()` function) that mirrors
  `MATCH-SETUP-JSON-SCHEMA.json` structurally and additionally verifies
  every composition `ext_id` against a `CardRegistryReader`. The module is
  browser-safe (zod only, no Node built-ins) so it is the single source
  of truth for both the registry-viewer UI and any future tooling that
  needs structural + registry-aware validation of a MATCH-SETUP document.
- `apps/registry-viewer` renders a third top-level tab, "Loadout", that
  opens a builder view. The user picks a scheme, a mastermind, one or
  more villain groups, one or more henchman groups, one or more hero
  groups, and sets the four pile counts. Each selector browses the
  already-loaded registry and constrains choices by card type/slug.
- The builder shows live validation errors produced by
  `validateMatchSetupDocument()` against the in-memory loadout draft.
- A "Download JSON" action writes a MATCH-SETUP envelope + composition
  to a file named `loadout-<slug>.json`. A "Load JSON" action accepts a
  paste or file upload and hydrates the draft so a user can edit an
  existing loadout.
- An optional "Start from theme" menu pre-fills composition fields from
  a selected theme's `setupIntent` (bystanders/wounds/officers/sidekicks
  fall back to standard defaults; the user can override any field).

No match creation, no server call, no persistence, no auth, no user
profile, no saved-loadout library. Pure authoring and JSON
export/import.

---

## Assumes

- WP-003 complete. Specifically:
  - `packages/registry/src/index.ts` exports a `CardRegistryReader`
    interface with a method for reading flat cards by ext_id
  - The registry-viewer already consumes registry via
    `apps/registry-viewer/src/lib/registryClient.ts`
- WP-005A complete. Specifically:
  - `packages/game-engine/src/setup/matchSetup.types.ts` defines
    `MatchSetupConfig` with the 9 locked fields. This packet does **not**
    modify that file — the engine's type remains authoritative for the
    composition block; this packet adds a **registry-side mirror** and a
    drift-detection test that asserts the two share the same field set.
- WP-055 complete. Specifically:
  - `packages/registry/src/theme.schema.ts` defines `ThemeDefinition` with
    a `setupIntent` block containing `mastermindId`, `schemeId`,
    `villainGroupIds`, `heroDeckIds`, `henchmanGroupIds`
  - `apps/registry-viewer/src/lib/themeClient.ts` exposes a loaded
    `ThemeDefinition[]` at mount time
- WP-093 complete. Specifically:
  - `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md` documents
    `heroSelectionMode` as an optional envelope field with v1 enum
    `["GROUP_STANDARD"]` and default semantics (absent → treat as
    `"GROUP_STANDARD"`)
  - `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` defines
    `heroSelectionMode` under root `properties` with
    `enum: ["GROUP_STANDARD"]` and does **not** list it in the root
    `required` array
  - `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md` Stage 1 includes the
    rule-mode bullet + valid/invalid test-coverage entries
  - `docs/ai/DECISIONS.md` contains a D-9300-range entry naming the
    error code `"unsupported_hero_selection_mode"` and the full-sentence
    error-message template this packet's validator emits verbatim
- `pnpm --filter @legendary-arena/registry build` exits 0
- `pnpm --filter @legendary-arena/registry test` exits 0
- `pnpm --filter registry-viewer build` exits 0
- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md`,
  `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json`, and
  `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md` exist (they are the
  governance anchors referenced throughout this packet)
- `docs/ai/ARCHITECTURE.md` exists
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the
  registry-viewer app may import `@legendary-arena/registry` at runtime
  but must **never** import `@legendary-arena/game-engine` (even as
  types). The new `setupContract` module is deliberately placed in
  `packages/registry/` rather than `packages/game-engine/` so the
  browser-side authoring UI can validate without crossing the layer
  boundary. The engine's own `matchSetup.validate.ts` remains
  authoritative for composition validation at match creation time.
- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md §Two-Layer Structure` — the
  MATCH-SETUP document has an **envelope** (`schemaVersion`, `setupId`,
  `createdAt`, `createdBy`, `seed`, `playerCount`, `themeId`,
  `expansions`) and a **composition** block that maps 1:1 to
  `MatchSetupConfig`. This packet produces documents that are valid at
  both layers.
- `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` — read the JSON
  Schema in full. The zod schema in this packet mirrors every field,
  constraint, and `additionalProperties: false` rule verbatim. A drift
  test in `setupContract.test.ts` asserts the zod schema rejects every
  invalid case the JSON Schema rejects.
- `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md §Validation Stages` —
  clarifies the three-stage model. This packet implements a
  **client-side** validator that combines Stage 1 (envelope — specifically
  the `heroSelectionMode` rule-mode check canonicalized by WP-093),
  Stage 2 (structural), and Stage 3 (composition ext_id existence) into
  one function for authoring UX. Server-side Stage 1 authoritative
  enforcement remains future work; the registry-viewer is not a trust
  boundary but does surface the same Stage 1 rule-mode rejection for
  authoring feedback.
- `docs/ai/DECISIONS.md` — scan the D-9300-range entry from WP-093 for
  the canonical rule-mode decision, the reserved-future semantics of
  `"HERO_DRAFT"`, the error code `"unsupported_hero_selection_mode"`,
  and the full-sentence error-message template this packet's validator
  emits verbatim when a document declares an unsupported mode.
- `docs/ai/REFERENCE/00.2-data-requirements.md §8.1 Match Configuration`
  — the nine composition field names are **locked**. They must appear
  in the new types, schema, validator, and UI verbatim: `schemeId`,
  `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`,
  `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`.
- `apps/registry-viewer/CLAUDE.md` — registry-viewer uses Vue 3
  Composition API, single-page tab switching (no router), singleton
  caching for registry + themes + glossaries, and zod-inferred types.
  Follow these conventions. The new "Loadout" tab slots alongside
  "Cards" and "Themes".
- `apps/registry-viewer/src/App.vue` — read the tab switching pattern
  (look for `viewMode` or equivalent). The loadout tab integrates the
  same way. Do not add a router.
- `apps/registry-viewer/src/lib/themeClient.ts` — read to understand
  how `ThemeDefinition[]` is loaded and how singleton caching works.
  The "Start from theme" picker consumes the same cached list.
- `packages/registry/src/schema.ts` — read the existing zod patterns
  (permissive where needed, strict elsewhere). The new contract schema
  must be **strict** (`.strict()` on every object; fail closed on
  unknown fields) to match `additionalProperties: false` in the JSON
  Schema.
- `packages/registry/src/theme.validate.ts` — read the existing
  validator shape. The new `validateMatchSetupDocument()` follows the
  same `ok: true | ok: false + errors` convention used elsewhere in
  this repo.
- `packages/game-engine/src/setup/matchSetup.types.ts` — read the
  engine-side `MatchSetupConfig` to confirm field names and types. Do
  not modify it. The registry-side mirror must declare the same 9
  fields; a drift-detection test asserts the two share identical
  fields.
- `docs/ai/REFERENCE/00.1-master-coordination-prompt.md` — non-
  negotiable constraints: the client submits intent, not outcomes;
  engine is the sole authority; no client-side rule execution. A
  loadout builder authors **configuration**, which is the input to
  `Game.setup()`; it never implements rules or simulates gameplay.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations),
  Rule 6 (`// why:` comments), Rule 9 (`node:` prefix for Node built-
  ins — not applicable in browser code), Rule 11 (full-sentence error
  messages), Rule 13 (ESM only), Rule 14 (field names match data
  contract).
- `docs/ai/DECISIONS.md` — scan for prior decisions on match setup
  authoring, envelope shape, and registry-viewer UI patterns.
- `.claude/rules/architecture.md §Layer Overview` — confirms
  registry-viewer's allowed imports and that browser-safe validators
  belong with `registry`, not `game-engine`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Never use `Math.random()` — all randomness uses `ctx.random.*` only
  (not applicable to this packet; the browser `seed` field uses
  `crypto.randomUUID()` — see Locked Contract Values)
- Never throw inside boardgame.io move functions — return void on invalid
  input (not applicable; no moves in scope)
- Never persist `G`, `ctx`, or any runtime state — see ARCHITECTURE.md
  §Section 3
- `G` must be JSON-serializable at all times — no class instances, Maps,
  Sets, or functions
- ESM only, Node v22+ — all new files use `import`/`export`, never
  `require()`
- `node:` prefix on all Node.js built-in imports (`node:test`,
  `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside move functions or pure helpers
- Full file contents for every new or modified file in the output — no
  diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**
- **No import from `@legendary-arena/game-engine`** anywhere in
  `apps/registry-viewer/**` or `packages/registry/**` (registry-viewer
  and registry both live below game-engine in the dependency chain).
  The registry-side `SetupCompositionInput` type is a standalone mirror
  of the engine's `MatchSetupConfig`; a drift-detection test asserts the
  two have identical field names.
- **No new npm dependencies.** Zod is already in both `packages/registry`
  and `apps/registry-viewer`. Do not add `ajv`, `jsonschema`, or any
  other JSON Schema runtime. The zod schema in this packet is the
  authoritative runtime validator for the browser; the JSON Schema
  artifact at `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` remains
  governance-only.
- **No persistence.** No `localStorage`, `sessionStorage`, `IndexedDB`,
  or cookie writes. The loadout lives in memory and is only externalized
  via the download action. Re-opening the tab starts a fresh draft.
- **No server calls.** The builder never fetches from the game server,
  never submits a match, and never reads any URL beyond the already-
  cached R2 singletons. Match creation is WP-092.
- **All 9 composition field names verbatim** — `schemeId`, `mastermindId`,
  `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`,
  `woundsCount`, `officersCount`, `sidekicksCount`. Any abbreviation,
  rename, or drop is FAIL.
- **Zod schemas are strict** — `.strict()` or `.passthrough(false)` on
  every object in the MATCH-SETUP document tree to mirror the JSON
  Schema's `additionalProperties: false`. Unknown fields fail validation.
- **Error messages are full sentences** — per 00.6 rule 11. Every
  validation error identifies the field path and what the user should
  check.
- **Browser-safe code only in registry-viewer** — no `node:fs`,
  `node:path`, `node:crypto`, or any `node:` import in the
  registry-viewer tree. Seed generation uses `crypto.randomUUID()` (Web
  Crypto, globally available in modern browsers); file downloads use
  `Blob` + `URL.createObjectURL`; file uploads use the standard
  `<input type="file">` + `FileReader` API.
- **No router library** — the "Loadout" tab integrates into the
  existing single-page tab switcher in `App.vue`. Do not add Vue
  Router, Unhead, or any routing dependency.
- **No `// why:` comments for self-evident code** — per 00.6 rule 6.
  Every `// why:` must explain a non-obvious decision (e.g., "zod
  schema uses `.strict()` because the JSON Schema enforces
  `additionalProperties: false` at every level"; "seed uses
  `crypto.randomUUID()` rather than `Math.random()` because randomness
  at the registry-viewer layer must remain determinism-compatible with
  engine `ctx.random` downstream").

**Session protocol:**
- If any composition field name appears to conflict with 00.2 §8.1,
  stop and re-read 00.2 — do not rename the field.
- If the JSON Schema artifact at
  `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json` has drifted from
  `MATCH-SETUP-SCHEMA.md` (e.g., a field name differs), stop and ask
  the human before choosing a side. The three governance docs must
  agree; reconciliation is a DECISIONS.md-scoped decision, not a
  WP-091 call.
- If `CardRegistryReader` does not expose the method needed to look up
  a scheme / mastermind / villain group / henchman group / hero group
  by ext_id, stop and ask before adding a new registry surface. The
  validator must work with the **existing** reader contract.

**Locked contract values (paste verbatim — do not paraphrase):**

- **MatchSetupConfig composition fields** (exactly these nine, in this
  order, in both the registry-side mirror and the UI):
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
  `sidekicksCount`

- **MATCH-SETUP envelope fields** (exactly these nine, matching
  `MATCH-SETUP-JSON-SCHEMA.json` after WP-093):
  `schemaVersion`, `setupId`, `createdAt`, `createdBy`, `seed`,
  `playerCount`, `themeId` (optional), `expansions`,
  `heroSelectionMode` (optional — see entry below)

- **`heroSelectionMode` envelope field** (canonicalized by WP-093):
  - Type: `string` (enum)
  - Allowed values in v1: `["GROUP_STANDARD"]` — exactly one
  - Required: **false** (optional at the JSON Schema level)
  - Default when absent: `"GROUP_STANDARD"` (backward compat)
  - Reserved future value, **not** in v1 allowed enum: `"HERO_DRAFT"`
  - Error code emitted by this packet's validator when the field is
    present and not in the allowed enum:
    `"unsupported_hero_selection_mode"`
  - Full-sentence error message emitted verbatim when rejection fires
    (matches the WP-093 DECISIONS entry template):
    `"The loadout envelope's heroSelectionMode is <value>, which is not a supported rule mode in v1 of the match setup schema. Supported modes: GROUP_STANDARD. (HERO_DRAFT is reserved for a future release and is not yet implemented.)"`
  - Builder default: downloaded JSON **always emits**
    `heroSelectionMode: "GROUP_STANDARD"` explicitly (never relies on
    the absent-means-default fallback in exported documents, because
    explicit is more auditable; the backward-compat default is for
    accepting older JSON on upload only)

- **schemaVersion value** (enum of exactly one):
  `"1.0"` — bump only via DECISIONS.md entry

- **createdBy values** (enum of exactly three):
  `"player"` | `"system"` | `"simulation"` — the registry-viewer UI
  always emits `"player"` for user-authored loadouts; `"simulation"`
  is reserved for PAR pipelines; `"system"` is reserved for server-
  generated setups

- **playerCount range**: integer, `1 ≤ n ≤ 5` (matching
  `LegendaryGame.minPlayers` / `maxPlayers`)

- **ID pattern** (every ext_id in the document):
  `^[a-z0-9-]+$`

- **Standard pile count defaults** (used when "Start from theme"
  doesn't specify them; theme `setupIntent` currently does not carry
  pile counts):
  - `bystandersCount: 30`
  - `woundsCount: 30`
  - `officersCount: 30`
  - `sidekicksCount: 0`
  These are **defaults for authoring convenience only**; the user may
  override any value. The engine does not impose defaults — all four
  counts must be present in the exported JSON.

- **Default seed generator** (browser, Web Crypto):
  `crypto.randomUUID().replace(/-/g, '').slice(0, 16)` — produces a
  16-hex-char string matching the shape shown in the
  `MATCH-SETUP-SCHEMA.md` example (`"9b4a4e2d6e1c43c2"`). The user may
  override by editing the seed field before download.

- **Default expansions value** (when the builder cannot infer from
  loaded registry):
  `["base"]` — matches the JSON Schema's `minItems: 1` requirement

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via
deterministic reproduction and state inspection.

- The loadout draft state lives in the `useLoadoutDraft` composable and
  is fully inspectable in Vue DevTools. Every UI action (add group,
  remove group, edit count, change seed) is a named composable method
  with a single-argument signature, so state transitions are traceable
  in DevTools.
- `validateMatchSetupDocument()` is a pure function of (document, registry
  reader). Given identical inputs it produces identical `{ ok, errors }`
  outputs. Failures are localized via the `errors` array's `field` paths
  (e.g., `"composition.villainGroupIds[2]"`).
- JSON export is deterministic given a fixed draft: same draft produces
  byte-identical JSON (keys ordered per the schema, whitespace
  normalized via `JSON.stringify(doc, null, 2)`).
- JSON import is symmetric: re-importing the downloaded file produces
  the same draft state that generated it (round-trip test required in
  `setupContract.test.ts`).
- Validation errors surface in a visible error region in the UI — no
  `alert()`, no `console.error` for user-visible errors. `console.warn`
  is permitted for dev diagnostics that never surface to the UI.

---

## Vision Alignment

**Vision clauses touched:** §3 (Player Trust & Fairness), §10a (Registry
Viewer public surface), §22 (Replay Faithfulness — the MATCH-SETUP
envelope is a replay anchor), NG-1..7 (monetization proximity — the
loadout builder is free tooling, no paid gate).

**Conflict assertion:** No conflict. This packet preserves all touched
clauses:

- §3 — The builder authors configuration; it never implements rules,
  never simulates gameplay, and never alters engine randomness. The
  JSON it produces is subsequently validated by the engine's
  authoritative `validateMatchSetup()` at match creation time, so no
  trust boundary is weakened.
- §10a — The registry-viewer public surface grows by one tab
  ("Loadout") that is purely additive. The existing "Cards" and
  "Themes" tabs are unmodified. No card data, image URL, or
  downstream consumer contract changes.
- §22 — The MATCH-SETUP envelope's `seed`, `setupId`, and
  `schemaVersion` fields are authored in the correct shape so that a
  future server-side archival pipeline (outside this packet's scope)
  can index replays by setup without schema migration.
- NG-1..7 — The builder is free, unbranded, and introduces no paid
  tier, loot box, or behavioral nudge. It is authoring tooling
  comparable to the existing Themes tab.

**Non-Goal proximity check:** None of NG-1..7 are crossed. The builder
is a public authoring surface analogous to the Themes tab.

**Determinism preservation:** The `seed` field uses `crypto.randomUUID()`
(Web Crypto) at authoring time; the value is a plain string that the
engine consumes at `Game.setup()` time. The builder itself does no RNG,
no wall-clock read that affects game state, and no replay-affecting I/O.
Replay faithfulness (Vision §22) is preserved because the JSON produced
by this builder is the same shape consumed by the authoritative
`validateMatchSetup()` and by the engine's setup pipeline.

---

## Scope (In)

### A) Registry-side setup contract module

- **`packages/registry/src/setupContract/setupContract.types.ts`** — new:
  - `export interface SetupCompositionInput` with exactly the nine
    composition fields from Locked Contract Values, typed to match
    `MATCH-SETUP-JSON-SCHEMA.json`
  - `export interface SetupEnvelope` with the nine envelope fields
    (including optional `themeId` and optional `heroSelectionMode`)
  - `export type HeroSelectionMode = "GROUP_STANDARD"` — exported
    literal-union type (v1 has exactly one member; future WPs expand
    the union when `"HERO_DRAFT"` is implemented). Add `// why:`
    comment referencing WP-093's DECISIONS entry as the canonical
    source of allowed values and the reserved-future semantics of
    `"HERO_DRAFT"`.
  - `export interface MatchSetupDocument { envelope: SetupEnvelope;
    composition: SetupCompositionInput }` — Note: in JSON the envelope
    fields are **flattened alongside** `composition` (per schema
    example); this wrapper interface is for internal draft-state use
    only. The serializer in the UI produces the flat JSON shape.
  - **Alternative (simpler)**: no wrapper type — declare
    `MatchSetupDocument` as an interface whose fields are the envelope
    fields plus a `composition` field. Choose whichever better matches
    the JSON Schema; document the choice with a `// why:` comment.
  - `export type MatchSetupErrorCode` — union of literal error codes
    emitted by the validator: `"missing_field"`, `"unknown_extid"`,
    `"out_of_range"`, `"unknown_field"`, `"wrong_type"`,
    `"unsupported_hero_selection_mode"` (the last one is
    canonicalized by WP-093 and must match that WP's DECISIONS entry
    byte-for-byte)
  - `export interface MatchSetupValidationError { field: string; code:
    MatchSetupErrorCode; message: string }` — full-sentence `message`,
    dot-path `field` (e.g., `"composition.villainGroupIds[0]"`)
  - `export type ValidateMatchSetupDocumentResult = { ok: true; value:
    MatchSetupDocument } | { ok: false; errors:
    MatchSetupValidationError[] }`
  - Add `// why:` comment explaining the type mirrors the engine's
    `MatchSetupConfig` at the composition level and is kept in sync
    via the drift-detection test in `setupContract.test.ts`

- **`packages/registry/src/setupContract/setupContract.schema.ts`** — new:
  - Zod schemas: `EnvelopeSchema`, `CompositionSchema`,
    `MatchSetupDocumentSchema`, `HeroSelectionModeSchema`
  - Every object uses `.strict()` to mirror `additionalProperties: false`
  - String ID fields use `.regex(/^[a-z0-9-]+$/, {...})` with a full-
    sentence error message
  - Array fields use `.array(...).min(1)` with `.refine(...)` enforcing
    `uniqueItems` where the JSON Schema requires it
  - Count fields use `.int().nonnegative()`
  - `playerCount` uses `.int().min(1).max(5)`
  - `schemaVersion` uses `.literal("1.0")`
  - `createdBy` uses `.enum(["player", "system", "simulation"] as const)`
  - `createdAt` uses `.string().datetime()`
  - `heroSelectionMode` uses
    `.enum(["GROUP_STANDARD"] as const).optional()` — optional at the
    schema level; the validator applies the default when absent.
    `// why:` comment: v1 enum has exactly one member per WP-093;
    `"HERO_DRAFT"` is reserved in the DECISIONS entry but **not**
    present in the zod enum so zod-level parsing rejects it
    automatically with zod's default message, which the validator
    then upgrades to the full-sentence WP-093 message template.
  - Add `// why:` comment on the strict-object choice referencing
    `MATCH-SETUP-JSON-SCHEMA.json`'s `additionalProperties: false`

- **`packages/registry/src/setupContract/setupContract.validate.ts`** — new:
  - `export function validateMatchSetupDocument(input: unknown, registry:
    CardRegistryReader): ValidateMatchSetupDocumentResult`
  - Pure function. Never throws. Accumulates all errors (does not
    early-return on first failure) so the UI can render a complete
    error list.
  - Step 1: zod structural parse via `MatchSetupDocumentSchema.safeParse`.
    On failure, convert `ZodError.issues` into
    `MatchSetupValidationError[]` with full-sentence messages. Return
    `{ ok: false, errors }`. Zod-level rejection of an unrecognized
    `heroSelectionMode` is **upgraded** to the WP-093 error code
    `"unsupported_hero_selection_mode"` and the verbatim full-sentence
    message template (detect the issue via its field path
    `"heroSelectionMode"` and its `invalid_enum_value` code, then
    substitute the canonical error into the returned list).
  - Step 2: registry ext_id lookups. For each of the five composition
    ext_id surfaces (`schemeId`, `mastermindId`, and every entry in
    `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`), look up via
    the existing `CardRegistryReader` surface. Unknown ext_ids produce
    `code: "unknown_extid"` errors.
  - Step 3: rule-mode default normalization. If the parsed document
    has `heroSelectionMode === undefined`, the returned `value` field
    carries `heroSelectionMode: "GROUP_STANDARD"` explicitly (default
    materialized) so downstream consumers never need to handle the
    absent case. `// why:` comment: the validator normalizes on the
    way out so Step 3 of the WP-093 DECISIONS entry's backward-compat
    semantic ("absent → GROUP_STANDARD") is enforced exactly once, at
    this boundary. **Normalization of absent `heroSelectionMode` to
    `"GROUP_STANDARD"` occurs only in `validateMatchSetupDocument()`;
    UI code, composables, and any future registry-viewer surface must
    not implicitly assume defaults — they read `value.heroSelectionMode`
    after validation and can rely on it being set.** This single-site
    normalization rule is what keeps WP-091's builder and WP-092's
    shape guard (which has its own normalization pass at its own layer
    boundary) from duplicating default logic; the two packets each
    normalize at their own boundary rather than sharing a helper.
  - Step 4: if Steps 1 and 2 pass, return `{ ok: true, value }` (with
    the default materialized per Step 3).
  - Add `// why:` comment on the accumulate-don't-fail-fast choice
    (UX: full error list is actionable; fail-fast frustrates authoring).

- **`packages/registry/src/setupContract/setupContract.test.ts`** — new:
  - Drift-detection test: `SetupCompositionInput` field names match the
    engine's `MatchSetupConfig` field names exactly. This test imports
    the engine's **type** via a type-level trick (e.g., conditional
    type that flags field-set mismatches at compile time, or a
    literal-string array compared to keys of `MatchSetupConfig`).
    Acceptable implementation: copy the 9 field names into a
    `readonly` tuple in the test file, then declare a type-level
    assertion that the tuple's literal union equals
    `keyof SetupCompositionInput`. Add `// why:` comment:
    "failure means the registry mirror drifted from 00.2 §8.1 or the
    engine type — reconcile before merging".
  - Valid minimal document (1 expansion, 1 of each group, valid
    counts, `heroSelectionMode: "GROUP_STANDARD"`).
  - Valid document with all optional fields populated (`themeId`,
    `heroSelectionMode`).
  - Valid document with `heroSelectionMode` **absent** → validator
    returns `{ ok: true, value }` with
    `value.heroSelectionMode === "GROUP_STANDARD"` (default
    materialized per Step 3); `// why:` comment on the test asserts
    this is the WP-093 backward-compat contract.
  - Invalid: `heroSelectionMode: "HERO_DRAFT"` → error code
    `"unsupported_hero_selection_mode"` and message body matches the
    WP-093 template verbatim (test uses `assert.match` or
    `assert.strictEqual` on the exact string).
  - Invalid: `heroSelectionMode: "MADE_UP"` → same rejection.
  - Invalid: missing envelope field (e.g., `seed`).
  - Invalid: missing composition field (e.g., `schemeId`).
  - Invalid: unknown top-level field (strict object rejects).
  - Invalid: unknown composition field.
  - Invalid: duplicate `villainGroupIds`.
  - Invalid: unknown ext_id for `schemeId`, `mastermindId`, and array
    entries.
  - Invalid: `playerCount = 0` and `playerCount = 6`.
  - Invalid: non-integer count (e.g., `bystandersCount: 3.5`).
  - Invalid: negative count.
  - Invalid: malformed ext_id (e.g., `"Scheme With Spaces"`).
  - Round-trip: valid document (including explicit
    `heroSelectionMode: "GROUP_STANDARD"`) → `JSON.stringify` →
    `JSON.parse` → validator → identical `{ ok: true, value }`
    (byte-for-byte equality on serialized output).
  - All tests use `node:test` + `node:assert`.
  - **Tests that compare error messages use exact-string equality
    (`assert.strictEqual` on the full message), not substring
    matching, `assert.match` with a regex, or "contains" checks.**
    The byte-for-byte verbatim rule from WP-093 is only enforceable
    if tests refuse "almost the same" messages. `// why:` comment
    on at least one such test referencing this rule so future
    readers do not "relax" it into a substring check.
  - All tests use a small in-memory stub `CardRegistryReader` (no
    network, no filesystem beyond JSON fixtures already present in the
    registry package).

- **`packages/registry/src/index.ts`** — modified:
  - Re-export the public surface of `setupContract`:
    `SetupCompositionInput`, `SetupEnvelope`, `MatchSetupDocument`,
    `MatchSetupValidationError`, `MatchSetupErrorCode`,
    `ValidateMatchSetupDocumentResult`, `validateMatchSetupDocument`,
    `MatchSetupDocumentSchema`. Use named exports only — no barrel
    indirection beyond the top-level `index.ts` the project already
    uses.
  - Add `// why:` comment block at the top of the new export section
    stating the module is browser-safe and serves both registry-viewer
    authoring and future server-side envelope validation.

### B) Registry-viewer loadout draft composable

- **`apps/registry-viewer/src/composables/useLoadoutDraft.ts`** — new:
  - `export function useLoadoutDraft(registryReader: CardRegistryReader)`
    returning a ref-based draft API:
    - `draft: Ref<MatchSetupDocument>` — the current in-memory
      loadout (initialized with blank strings, empty arrays, default
      counts from Locked Contract Values, a generated `seed`,
      `schemaVersion: "1.0"`, `createdBy: "player"`, `createdAt:
      new Date().toISOString()`, `setupId: "setup-<createdAt>"`,
      `playerCount: 2`, `expansions: ["base"]`,
      `heroSelectionMode: "GROUP_STANDARD"` — explicit emission per
      Locked Contract Values, not relying on the absent-default)
    - `errors: ComputedRef<MatchSetupValidationError[]>` — recomputed
      on every draft change via `validateMatchSetupDocument(draft,
      registry)`
    - `isValid: ComputedRef<boolean>` — `errors.value.length === 0`
    - `setScheme(schemeId: string): void`
    - `setMastermind(mastermindId: string): void`
    - `addVillainGroup(groupId: string): void`
    - `removeVillainGroup(groupId: string): void`
    - `addHenchmanGroup(groupId: string): void`
    - `removeHenchmanGroup(groupId: string): void`
    - `addHeroGroup(groupId: string): void`
    - `removeHeroGroup(groupId: string): void`
    - `setCount(field: 'bystandersCount' | 'woundsCount' |
      'officersCount' | 'sidekicksCount', value: number): void`
    - `setPlayerCount(value: number): void`
    - `setSeed(seed: string): void`
    - `setThemeId(themeId: string | undefined): void`
    - `setHeroSelectionMode(mode: HeroSelectionMode): void` — the
      parameter type restricts v1 callers to `"GROUP_STANDARD"`;
      attempting to pass a future value is a TypeScript compile
      error. `// why:` comment: the UI does not expose a picker for
      this field in v1 (only one mode exists), but the setter exists
      so that future UI work for `"HERO_DRAFT"` has a stable
      composable API to bind to without reshaping the composable.
    - `prefillFromTheme(theme: ThemeDefinition): void` — copies the
      five `setupIntent` fields into the draft; does not touch counts,
      player count, seed, or expansions (the user keeps those as-is)
    - `loadFromJson(jsonText: string): { ok: true } | { ok: false;
      errors: MatchSetupValidationError[] }` — parses the text, runs
      `validateMatchSetupDocument`, and if valid replaces the draft
    - `exportToJsonBlob(): Blob` — serializes the draft via
      `JSON.stringify(draft, null, 2)` with an ordered key sequence
      matching the JSON Schema (envelope fields first, then
      `composition`). Adds a `// why:` comment on the ordering choice
      (deterministic diffs across exports).
    - `resetDraft(): void` — reinitializes to the same blank starting
      state described above (new `seed`, new `createdAt`).
  - The composable is pure — no module-level state, no singletons,
    no side effects beyond the returned refs. Multiple instances are
    independent drafts.
  - Every mutator normalizes its input (trim strings, coerce to
    integer for counts) before writing to the draft.

### C) Loadout builder view

- **`apps/registry-viewer/src/components/LoadoutBuilder.vue`** — new:
  - Vue 3 SFC, `<script setup lang="ts">`, scoped CSS matching the
    existing registry-viewer dark theme.
  - Imports `useLoadoutDraft` and receives the current registry reader
    from the parent `App.vue` (via a prop or a shared provide/inject —
    pick whichever the existing tabs already use and mirror that).
  - Layout: two-column. Left column is the draft summary (all 9
    composition fields, envelope fields, download/upload controls,
    validation error list). Right column is the picker panel — a
    card-browse-like grid that filters by the currently-active
    selection slot (scheme, mastermind, villain groups, henchman
    groups, hero groups) using the same card-tile styling as
    `CardGrid.vue`.
  - "Start from theme" control: a dropdown listing loaded themes; on
    change, calls `draft.prefillFromTheme(theme)` and sets
    `draft.setThemeId(theme.themeId)`.
  - Seed field: a read-only text display with a "🎲 Re-roll" button
    that calls `draft.setSeed(generateSeed())` where `generateSeed`
    uses the Locked Contract Values formula. Also a "✎ Edit" toggle
    that makes the seed manually editable (for advanced users
    reproducing a prior match).
  - Rule mode indicator: a read-only label rendering **verbatim**
    the WP-093-canonical UI string:
    `"Hero selection rule: GROUP_STANDARD — Classic Legendary hero groups"`
    — where `"Classic Legendary hero groups"` is the short UI label
    canonicalized in WP-093's human-readable label mapping and must
    be consumed byte-for-byte (never paraphrased as "classic mode",
    "standard", "Legendary rules", etc.).
    `"GROUP_STANDARD"` is the canonical default rule mode for the
    Marvel Legendary ruleset: selecting a hero group implies
    inclusion of that hero's full standard card set. This is the
    only rule mode the engine interprets in v1.
    Not a picker in v1 (enum has exactly one value). Hovering the
    label surfaces the WP-093 long-explanation tooltip (verbatim):
    `"The engine expands each selected hero group into its canonical card set at match start."`
    A separate info icon, on hover/click, surfaces exactly the
    sentence: `"Hero Draft rules are planned for a future update."`
    — this is the one-sentence explanatory string WP-091 is
    permitted to emit beyond the machine name; any longer
    explanation (e.g., of `HERO_DRAFT` mechanics) is out of scope
    per the WP-093 naming-governance policy. The info icon links to
    the WP-093 DECISIONS entry for users who want the full
    rationale.
    `// why:` comment: read-only surface is deliberate — WP-093
    reserves future rule modes but does not activate them, so a
    picker UI would be misleading.
  - "Download JSON" button: calls `draft.exportToJsonBlob()`, triggers
    a browser download as `loadout-<schemeId-or-date>.json`. Filename
    slug derives from `draft.composition.schemeId` if non-empty,
    otherwise `draft.envelope.createdAt` normalized to a filename-safe
    form.
  - "Load JSON" control: a file input + a collapsible paste textarea.
    Either route calls `draft.loadFromJson(text)`; on failure, the
    returned errors render inline above the input.
  - Validation errors section: lists each `MatchSetupValidationError`
    with its `field` path and `message`. Errors are grouped by whether
    the field is in the envelope or composition.
  - Add `// why:` comment on the "Re-roll seed" button stating that
    seed re-rolling is a valid authoring step (produces a new random
    deck order at match start) and that the user can reproduce a
    prior match by pasting the old JSON.

### D) Tab integration in App.vue

- **`apps/registry-viewer/src/App.vue`** — modified:
  - Add a third tab "Loadout" to the existing tab switcher alongside
    "Cards" and "Themes". Tab key: `"loadout"`.
  - When active, render `<LoadoutBuilder />` with the registry reader
    passed in the same way the other tabs receive it.
  - **Do not** modify the "Cards" or "Themes" tab logic. **Do not**
    add any new top-level fetches or singletons — the loadout builder
    re-uses the already-cached registry and themes.
  - Add `// why:` comment on the new tab entry explaining that the
    builder is an additive authoring surface and does not affect
    Cards/Themes behavior.

### E) Tests

Tests live in `packages/registry/src/setupContract/setupContract.test.ts`
(covered in §A above). No additional test files are added to
`apps/registry-viewer/**` in this packet — the registry-viewer does not
have a Vue-component test harness configured, and introducing one is a
separate WP. The loadout composable's pure functions are indirectly
covered by the validator tests; UI behavior is verified manually in the
Verification Steps.

---

## Out of Scope

- No match creation — the builder exports JSON, it never submits to a
  game server. Lobby intake of that JSON is **WP-092**.
- No user accounts, user profiles, saved-loadout library, or match
  history — that is a future WP pending an auth/Postgres epic.
- No server-side envelope validation — `MATCH-SETUP-VALIDATION.md`
  Stage 1 remains server-layer work deferred to a future WP (likely
  alongside user profiles when envelope archival becomes relevant).
- No engine-side changes — `packages/game-engine/**` is untouched.
  `matchSetup.validate.ts` and `matchSetup.types.ts` remain the
  authoritative engine-side contract; the registry-side mirror is a
  second copy with a drift-detection test, not a replacement.
- No changes to `apps/arena-client/**` — WP-092 is the lobby intake
  WP; this packet lands before or alongside WP-092 and does not
  modify the arena-client.
- No changes to `apps/server/**` — this is a pure client + registry
  packet.
- No new npm dependencies — zod is already present in both touched
  packages.
- No router library — tab switching in `App.vue` is the MVP
  navigation mechanism, consistent with the existing Cards/Themes
  pattern.
- No preset/template loadouts shipped in the repo — "Start from
  theme" pre-fills from existing theme data; shipping canonical
  preset loadouts is future work.
- No CI publish of the builder as a standalone artifact — it rides
  the existing `cards.barefootbetters.com` deployment pipeline.
- No Vue-component test harness for registry-viewer — introducing
  `jsdom` + `vue-sfc-loader` to registry-viewer's test script is a
  separate WP; UI verification here is manual per the Verification
  Steps.
- No changes to `public/registry-config.json` — the builder reads the
  already-loaded registry and themes; no new runtime config surface.
- No localization / i18n — the builder ships English-only strings,
  matching the existing registry-viewer.
- **No partial adoption of future rule modes** — the presence of
  `heroSelectionMode` in v1 documents does not imply partial support
  for `HERO_DRAFT` or any other reserved-future mode. There is no
  "experimental" flag, no "beta toggle", no `heroCardPool` scaffolding,
  no hero-card-level picker. v1 is binary: `"GROUP_STANDARD"` is
  supported end-to-end; every other value is rejected with the
  WP-093 error template. Reserving a future mode's token in
  governance is not the same as preparing to support it.
- Refactors, cleanups, or "while I'm here" improvements are **out of
  scope** unless explicitly listed in Scope (In) above.

---

## Files Expected to Change

- `packages/registry/src/setupContract/setupContract.types.ts` —
  **new** — MATCH-SETUP types (envelope + composition + validation
  result)
- `packages/registry/src/setupContract/setupContract.schema.ts` —
  **new** — zod schemas mirroring `MATCH-SETUP-JSON-SCHEMA.json`
- `packages/registry/src/setupContract/setupContract.validate.ts` —
  **new** — `validateMatchSetupDocument()` pure function (structural +
  registry ext_id checks)
- `packages/registry/src/setupContract/setupContract.test.ts` —
  **new** — `node:test` coverage + drift-detection vs. engine's
  `MatchSetupConfig`
- `packages/registry/src/index.ts` — **modified** — named re-exports
  of the new `setupContract` public surface
- `apps/registry-viewer/src/composables/useLoadoutDraft.ts` — **new**
  — draft-state composable with mutators, computed validation errors,
  and export/import helpers
- `apps/registry-viewer/src/components/LoadoutBuilder.vue` — **new**
  — two-column builder view (draft summary + picker grid + download/
  upload controls)
- `apps/registry-viewer/src/App.vue` — **modified** — third tab
  "Loadout" mounting `<LoadoutBuilder />`

No other files may be modified.

---

## Acceptance Criteria

### A) Setup contract module
- [ ] `packages/registry/src/setupContract/setupContract.types.ts`
      exports `SetupCompositionInput` with exactly these nine fields:
      `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`,
      `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`,
      `sidekicksCount`
- [ ] `SetupEnvelope` includes exactly: `schemaVersion`, `setupId`,
      `createdAt`, `createdBy`, `seed`, `playerCount`, `themeId`
      (optional), `expansions`, `heroSelectionMode` (optional)
- [ ] `HeroSelectionMode` type alias exports a literal union with
      exactly one member: `"GROUP_STANDARD"`
- [ ] `MatchSetupDocumentSchema` uses `.strict()` on every object
      (verified by `Select-String` for `.strict()` and by a test that
      asserts unknown fields are rejected)
- [ ] `validateMatchSetupDocument(input, registry)` returns
      `{ ok: true, value }` for a minimal valid document and
      `{ ok: false, errors: MatchSetupValidationError[] }` otherwise
- [ ] Every error message in the validator is a full sentence (no
      single-word messages)
- [ ] `packages/registry/src/index.ts` re-exports exactly the names
      listed in Scope §A (including `HeroSelectionMode` and
      `MatchSetupDocumentSchema`)

### A.1) Rule-mode validation (WP-093 compliance)
- [ ] Valid document with `heroSelectionMode: "GROUP_STANDARD"` →
      validator returns `{ ok: true }`
- [ ] Valid document with `heroSelectionMode` **absent** →
      validator returns `{ ok: true, value }` with
      `value.heroSelectionMode === "GROUP_STANDARD"` (default
      materialized)
- [ ] Invalid document with `heroSelectionMode: "HERO_DRAFT"` →
      validator returns `{ ok: false, errors }` where at least one
      error has `code: "unsupported_hero_selection_mode"`
- [ ] The emitted error message for `"HERO_DRAFT"` matches the
      WP-093 template verbatim (test asserts exact-string equality,
      not substring match)
- [ ] Invalid document with `heroSelectionMode: "MADE_UP"` → same
      rejection path, same error code

### A.2) Round-trip (promoted to top-level acceptance)
- [ ] A valid MATCH-SETUP document (with explicit
      `heroSelectionMode: "GROUP_STANDARD"`) passed through
      `JSON.stringify` → `JSON.parse` → `validateMatchSetupDocument`
      produces `{ ok: true }` and the resulting `value` deep-equals
      the original input
- [ ] The serialized output is byte-identical across two consecutive
      exports of the same draft (deterministic key ordering)

### B) Drift detection
- [ ] `setupContract.test.ts` contains a drift-detection assertion
      that the nine composition field names match 00.2 §8.1
- [ ] The drift-detection assertion comments `// why:` referencing
      the engine's `MatchSetupConfig` and 00.2 §8.1

### C) Loadout draft composable
- [ ] `useLoadoutDraft(registry)` returns a draft ref initialized with
      the default envelope values from Locked Contract Values
- [ ] Calling `addVillainGroup('foo')` twice results in a draft whose
      `composition.villainGroupIds` contains `'foo'` exactly once (no
      duplicates)
- [ ] `prefillFromTheme(theme)` copies the five `setupIntent` fields
      and does not touch `bystandersCount`, `woundsCount`,
      `officersCount`, `sidekicksCount`, `playerCount`, `seed`, or
      `expansions`
- [ ] `exportToJsonBlob()` produces a `Blob` whose parsed content
      validates via `validateMatchSetupDocument()` with `ok: true`
      when the draft is valid
- [ ] `loadFromJson(jsonText)` replaces the draft when the input is
      valid and leaves the draft unchanged when invalid (returns
      `{ ok: false, errors }`)
- [ ] `errors` computed updates within one tick of a mutator call
      (verified by a reactivity test using `nextTick`)

### D) Loadout builder view
- [ ] "Loadout" is the third tab in `App.vue`, positioned after
      "Cards" and "Themes"
- [ ] The builder renders the nine composition fields verbatim
      (confirmed by `Select-String` for each of the nine field names
      in `LoadoutBuilder.vue`)
- [ ] The "Download JSON" button produces a file whose parsed content
      validates via `validateMatchSetupDocument()` with `ok: true`
      (confirmed in manual smoke per Verification Step 7)
- [ ] The "Load JSON" control populates the draft from a pasted valid
      document and renders a visible error list for an invalid
      document (confirmed in manual smoke)
- [ ] The "Start from theme" dropdown lists every loaded theme and
      pre-fills the five `setupIntent` fields on selection (confirmed
      in manual smoke)
- [ ] The validation errors section renders at least one full-
      sentence error when the draft is incomplete (confirmed in
      manual smoke)
- [ ] The rule-mode indicator renders the exact string
      "Hero selection rule: GROUP_STANDARD — Classic Legendary hero groups"
      as a read-only label (confirmed by `Select-String` for the
      literal string and in manual smoke). The short UI label
      "Classic Legendary hero groups" matches the WP-093 human-
      readable label mapping byte-for-byte.
- [ ] Hovering the rule-mode label surfaces the exact WP-093
      long-explanation string: "The engine expands each selected
      hero group into its canonical card set at match start."
      (confirmed by `Select-String` for the literal string and in
      manual smoke).
- [ ] The info icon next to the rule-mode indicator renders exactly
      the sentence "Hero Draft rules are planned for a future
      update." (confirmed by `Select-String` for the literal
      string). No other UI copy in the builder references
      `HERO_DRAFT` or "Hero Draft" beyond this single sentence, per
      the WP-093 naming-governance policy.
- [ ] The error message emitted on an unsupported `heroSelectionMode`
      is **not constructed locally** — no string interpolation, no
      template literal assembly, no alternative phrasing. The
      message must originate from the WP-093 canonical template
      (either imported as a constant or copy-pasted verbatim into
      a locked location in the validator; either way the byte-for-
      byte equality test in §A.1 is the authoritative gate).
- [ ] The downloaded JSON contains `"heroSelectionMode":
      "GROUP_STANDARD"` explicitly at the envelope level (confirmed
      in manual smoke by opening the downloaded file)

### E) Layer boundary & dependencies
- [ ] No `from '@legendary-arena/game-engine'` import anywhere in
      `apps/registry-viewer/**` or `packages/registry/**` (confirmed
      with `Select-String`)
- [ ] No new entries in `dependencies` of
      `apps/registry-viewer/package.json` or
      `packages/registry/package.json` (confirmed with `git diff`)
- [ ] No `Math.random` in any new or modified file (confirmed with
      `Select-String`)
- [ ] No `localStorage`, `sessionStorage`, `IndexedDB`, or cookie
      write in any new or modified file (confirmed with
      `Select-String`)

### F) Tests
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0 (all
      test files including `setupContract.test.ts`)
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] Test file does not import from `boardgame.io` or
      `@legendary-arena/game-engine`
- [ ] Test uses `node:test` and `node:assert` only

### G) Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] No files under `packages/game-engine/**`, `apps/server/**`, or
      `apps/arena-client/**` were modified (confirmed with
      `git diff --name-only`)

---

## Verification Steps

```pwsh
# Step 1 — build + test the registry package after all changes
pnpm --filter @legendary-arena/registry build
# Expected: exits 0, no TypeScript errors

pnpm --filter @legendary-arena/registry test
# Expected: TAP output — all tests passing, 0 failing

# Step 2 — build + typecheck registry-viewer
pnpm --filter registry-viewer build
# Expected: exits 0, Vite build succeeds

pnpm --filter registry-viewer typecheck
# Expected: exits 0, no Vue-TSC errors

# Step 3 — confirm no game-engine imports in registry-viewer or registry
Select-String -Path "apps\registry-viewer\src" -Pattern "from '@legendary-arena/game-engine'" -Recurse
# Expected: no output

Select-String -Path "packages\registry\src" -Pattern "from '@legendary-arena/game-engine'" -Recurse
# Expected: no output

# Step 4 — confirm no new dependencies
git diff apps/registry-viewer/package.json packages/registry/package.json
# Expected: no changes in the "dependencies" block of either file

# Step 5 — confirm no Math.random, no localStorage, no sessionStorage
Select-String -Path "apps\registry-viewer\src" -Pattern "Math\.random|localStorage|sessionStorage|indexedDB" -Recurse
# Expected: no output

Select-String -Path "packages\registry\src\setupContract" -Pattern "Math\.random|localStorage|sessionStorage|indexedDB" -Recurse
# Expected: no output

# Step 6 — confirm strict-object usage in the schema
Select-String -Path "packages\registry\src\setupContract\setupContract.schema.ts" -Pattern "\.strict\("
# Expected: at least one match per object in the document tree (~3 matches)

# Step 6.5 — confirm the nine composition field names appear verbatim in the builder
Select-String -Path "apps\registry-viewer\src\components\LoadoutBuilder.vue" -Pattern "schemeId|mastermindId|villainGroupIds|henchmanGroupIds|heroDeckIds|bystandersCount|woundsCount|officersCount|sidekicksCount"
# Expected: at least 9 matches (one per field)

# Step 6.6 — confirm heroSelectionMode rule-mode indicator and emission
Select-String -Path "apps\registry-viewer\src\components\LoadoutBuilder.vue" -Pattern "heroSelectionMode|GROUP_STANDARD"
# Expected: at least two matches (read-only label + composable binding)

Select-String -Path "packages\registry\src\setupContract" -Pattern "heroSelectionMode|GROUP_STANDARD|unsupported_hero_selection_mode" -Recurse
# Expected: multiple matches across types, schema, validator, tests

# Step 7 — manual smoke (not a test gate; recorded in the invocation)
# Terminal A: pnpm --filter registry-viewer dev
# Open http://localhost:5173 in a browser
# 1. Confirm the new "Loadout" tab is present after "Cards" and "Themes"
# 2. Click "Loadout", confirm the builder renders with blank composition
#    fields and populated envelope defaults (schemaVersion 1.0, seed auto-
#    generated, playerCount 2, expansions ["base"])
# 3. Pick a scheme from the picker panel — confirm the scheme chip appears
#    in the draft summary and the validation error for "schemeId missing"
#    disappears
# 4. Repeat for mastermind, 3 villain groups, 1 henchman group, 5 hero
#    groups
# 5. Click "🎲 Re-roll" on the seed — confirm the seed changes to a new
#    16-hex value
# 6. Click "Download JSON" — confirm a file is downloaded and its parsed
#    content validates (paste into a playground or run
#    `validateMatchSetupDocument` in a Node REPL with a stub registry)
# 7. Click "Load JSON", paste a modified copy (change one count) — confirm
#    the draft updates and no errors appear
# 8. Paste an invalid JSON (malformed or unknown field) — confirm the
#    error region renders full-sentence errors and the draft is unchanged
# 9. Switch back to the "Cards" tab and confirm the card grid still
#    renders (no regression)

# Step 8 — confirm no files outside scope were changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] Manual smoke per Verification Step 7 passes end-to-end (recorded
      in the session invocation with screenshots of the builder in use
      and a sample downloaded JSON)
- [ ] No `from '@legendary-arena/game-engine'` import in
      `apps/registry-viewer/**` or `packages/registry/**` (confirmed
      with `Select-String`)
- [ ] No new dependencies in `apps/registry-viewer/package.json` or
      `packages/registry/package.json` (confirmed with `git diff`)
- [ ] No `Math.random`, `localStorage`, `sessionStorage`, or
      `IndexedDB` writes in any new or modified file (confirmed with
      `Select-String`)
- [ ] No files under `packages/game-engine/**`, `apps/server/**`, or
      `apps/arena-client/**` were modified (confirmed with
      `git diff --name-only`)
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] `docs/ai/STATUS.md` updated — a user can now open
      `cards.barefootbetters.com`, click the new "Loadout" tab, build a
      MATCH-SETUP JSON interactively, and download it to their machine
      ready for WP-092's lobby intake
- [ ] `docs/ai/DECISIONS.md` updated — at minimum:
  - `D-91xx` — setup contract module placed in `packages/registry/`
    rather than `packages/game-engine/` so the browser-side
    registry-viewer can validate without crossing the layer boundary;
    engine retains its own `matchSetup.validate.ts` as authoritative
    at match creation time; a drift-detection test keeps the two
    field sets in sync
  - `D-91xx` — zod schema chosen over ajv/jsonschema to avoid adding
    a new dependency (zod already present in both touched packages)
  - `D-91xx` — registry-viewer gains a third tab "Loadout" rather
    than a new route; consistent with existing Cards/Themes tab
    pattern and the "no router" convention in registry-viewer's
    CLAUDE.md
  - `D-91xx` — loadout persistence (user accounts, saved loadouts,
    match history) is explicitly deferred to a future epic; download/
    upload JSON is the MVP bridge and is forward-compatible with any
    future profile system
  - `D-91xx` — seed generation uses `crypto.randomUUID()` (Web
    Crypto) at authoring time; the value is a plain 16-hex string
    consumed as opaque data by the engine, preserving Vision §22
    replay faithfulness
  - `D-91xx` — rule-mode consumption: the builder emits
    `heroSelectionMode: "GROUP_STANDARD"` explicitly in every
    downloaded JSON (never relies on the absent-default) for
    auditability; the validator rejects any other value with the
    verbatim WP-093 error message template; the UI surfaces rule
    mode as a read-only indicator because v1 has exactly one
    allowed value. `"HERO_DRAFT"` is explicitly deferred per the
    WP-093 DECISIONS entry and must not be referenced in the allowed
    enum, the UI picker set, or any test fixture that expects
    `ok: true`.
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-091 added in the
      correct phase slot (alongside or after WP-090), dependencies
      listed, and checked off with today's date
