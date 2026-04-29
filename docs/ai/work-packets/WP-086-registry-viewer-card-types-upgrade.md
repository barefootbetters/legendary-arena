# WP-086 — Registry Viewer Card-Types Upgrade

**Status:** Ready
**Primary Layer:** Registry (`packages/registry/**`) + Client UI (`apps/registry-viewer/**`) + Content / Data (`data/metadata/**`)
**Dependencies:** WP-084 (deleted unused auxiliary metadata; this WP re-adds `card-types.json` with a runtime consumer present, satisfying the constraint that motivated WP-084's deletion), WP-082 (`KeywordGlossarySchema` / `RuleGlossarySchema` `.strict()` precedent + `glossaryClient.ts` fetch-boundary `.safeParse()` non-blocking pattern), WP-066 (`useCardViewMode` precedent + `data/metadata/` R2 publish workflow), WP-091 (`LoadoutBuilder.vue` + setup-contract types — coexistence target on the same component tree)

> **EC slot clarification:** the authoritative execution checklist for
> this packet is **EC-086** (1:1 mapping with WP-086). Earlier draft
> references to EC-119 (made by analogy with WP-111 → EC-118) were
> erroneous and were corrected during lint-gate self-review. EC-119 is
> not used here. See `## Drafting Notes` for the full correction trail.

---

## Session Context

The Registry Viewer's card-type ribbon filter is currently driven by a
hardcoded `TYPE_GROUPS` array in `apps/registry-viewer/src/App.vue` and
a four-value `cardType` z.enum in `packages/registry/src/schema.ts`
(`"hero" | "mastermind" | "villain" | "scheme"`). Three real card
entities are not classified today:

- **Sidekick deck** (a shared global pile in many setups; cards have
  distinct identity but no `cardType` slug)
- **S.H.I.E.L.D. Officer deck** (Officer cards carry a SHIELD identity
  but project as bare strings in the viewer)
- **Starting S.H.I.E.L.D. Agents and Troopers** (the player-deck
  starters that every Legendary game ships with)

The ribbon also displays an orphan "Location" button that
`flattenSet()` never assigns — dead UI inherited from a prior
classification attempt.

This packet replaces the hardcoded ribbon model with a data-driven
taxonomy: `data/metadata/card-types.json` becomes the single source of
truth for which card types exist, their display labels / icons /
order, and parent-child relationships (S.H.I.E.L.D. → Agent / Officer
/ Trooper). The viewer generates the ribbon from this file at fetch
time. The registry package gains a `CardTypeEntrySchema` + a
`CardType = string` alias validated at load against the taxonomy.

This is **Phase 1** of a two-phase rollout. Phase 1 ships the schema +
viewer wiring + taxonomy file; new ribbon buttons render but return
zero cards because the per-card `cardType` slugs aren't emitted yet.
Phase 2 (a follow-up WP) updates the upstream `modern-master-strike`
generator to emit `cardType` on each card and regenerates all 40 sets.
Splitting the rollout keeps this packet shippable without coordinating
a 40-set regen and an upstream-repo change in the same session.

The design is **locked at Interpretation A** (memory note 2026-04-21):
container-based `SetDataSchema` (`heroes[]`, `masterminds[]`, …) is
retained unchanged. The alternative Interpretation B (flatten
containers into a single `cards[]` array discriminated by `cardType`)
was rejected because it would have been a 3–5 WP cross-layer refactor
touching engine `Game.setup()`. The engine remains untouched here.

---

## Goal

After this session, the Registry Viewer's ribbon filter is generated
from `data/metadata/card-types.json` and the registry package exports
a `CardTypeEntry` schema + `CardType` type alias with fetch-boundary
validation. Specifically:

- `data/metadata/card-types.json` is re-added (was deleted under
  WP-084) as the authoritative taxonomy: which card types exist,
  their display label / emoji / order, and `parentType`
  relationships for sub-roles. Uploaded to R2 at
  `images.barefootbetters.com/metadata/card-types.json` alongside
  `keywords-full.json` and `rules-full.json`.
- `packages/registry/src/schema.ts` re-adds `CardTypeEntrySchema` /
  `CardTypesIndexSchema` (`.strict()`, mirroring the WP-082 keyword /
  rule glossary precedent) plus inferred types `CardTypeEntry` /
  `CardTypesIndex`. The previous `cardType: z.enum(["hero",
  "mastermind", "villain", "scheme"]).optional()` line is widened to
  `cardType: z.string().optional()` because the four-value enum is
  no longer authoritative — the taxonomy file is.
- A new `apps/registry-viewer/src/lib/cardTypesClient.ts` is added,
  mirroring `glossaryClient.ts` structure: singleton module-scope
  `_promise` holder, `devLog("cardTypes", ...)` instrumentation,
  `.safeParse(...)` at the fetch boundary with full-sentence
  `[CardTypes] Rejected …` `console.warn` + empty-array degraded
  fallback (non-blocking).
- `apps/registry-viewer/src/App.vue` consumes the fetched taxonomy:
  the hardcoded `TYPE_GROUPS` array is removed; ribbon buttons are
  generated from entries where `parentType === null`, sorted by the
  `order` field; sub-chips render on click for entries that have
  children. The orphan "Location" button is removed. The selected-
  types model continues to drive `applyFilters()` exactly as today —
  this packet does not change the filter algorithm, only the source
  of the button list.
- The `S.H.I.E.L.D.` taxonomy entry is added with three children
  (`Agent`, `Officer`, `Trooper`), and a `Sidekick` top-level entry
  is added. New buttons render in the ribbon but return zero cards
  in Phase 1 because per-card `cardType` slugs are not emitted yet
  — this is intentional and tested.
- The viewer's `flattenSet()` and registry runtime are unchanged.
  The engine package (`packages/game-engine`) is unchanged.
  `apps/server` is unchanged. `apps/arena-client` is unchanged.

This WP delivers the taxonomy + viewer wiring + schema. Phase 2
(upstream `modern-master-strike` generator emits `cardType` on each
card; regenerate 40 sets) is a follow-up WP, not in scope here.

---

## Assumes

- WP-084 complete. Specifically:
  - `data/metadata/card-types.json` was deleted at commit `b250bf1`
    (2026-04-21) on the explicit constraint that no runtime consumer
    existed. This packet adds the runtime consumer (ribbon button
    generation + per-card `cardType` validation), satisfying that
    constraint and authorizing the file's re-introduction.
  - The deletion rationale is recorded in WP-084's DECISIONS entry
    (verify exact D-number when drafting the new D-NNNN); this
    packet's new DECISIONS entry explicitly cites it and explains
    why re-adding is now correct.
- WP-082 complete. Specifically:
  - `packages/registry/src/schema.ts` exports `KeywordGlossaryEntrySchema`
    / `KeywordGlossarySchema` / `RuleGlossaryEntrySchema` /
    `RuleGlossarySchema` as `.strict()` schemas (the first `.strict()`
    schemas in the file). This packet adds `CardTypeEntrySchema` /
    `CardTypesIndexSchema` using the same pattern.
  - `apps/registry-viewer/src/lib/glossaryClient.ts` exports the
    fetch-boundary `.safeParse(...)` non-blocking pattern (singleton
    `_promise` holder; `devLog(...)` instrumentation; full-sentence
    `[Glossary] Rejected …` warn; empty-Map fallback). This packet's
    new `cardTypesClient.ts` mirrors the structure exactly.
- WP-066 complete. Specifically:
  - `data/metadata/` upload-to-R2 workflow is documented and operable
    (operator-step with R2 credentials per WP-082's `images-`
    `barefootbetters.com/metadata/` publish convention).
  - `apps/registry-viewer/src/lib/devLog.ts` exposes a `devLog`
    categorical signature; `"cardTypes"` becomes a new category in
    this packet (parallel to `"glossary"` / `"theme"` /
    `"registry"`).
- WP-091 complete. Specifically:
  - `LoadoutBuilder.vue` and `useLoadoutDraft.ts` are stable. This
    packet does not modify either file. Same component tree;
    coexistence is sequencing-only, not contract overlap.
- `apps/registry-viewer/src/App.vue` continues to use a `selectedTypes:
  Set<string>` filter model with `applyFilters()` on toggle. This
  packet preserves that model exactly; only the source of the button
  list changes.
- `pnpm --filter @legendary-arena/registry build` exits 0
- `pnpm --filter @legendary-arena/registry test` exits 0
- `pnpm --filter registry-viewer build` exits 0
- `pnpm --filter registry-viewer test` exits 0
- `docs/ai/ARCHITECTURE.md` exists
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not
proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — confirm
  that `apps/registry-viewer` may import `registry` (data shape +
  schemas) but never `game-engine`, `preplan`, or `server`. This
  packet preserves that. The Shared Tooling row is irrelevant.
- `.claude/rules/architecture.md §Layer Boundary` — enforces the
  same. The viewer is on the Registry → Game Engine → Server chain
  only at type / data level, never runtime engine import.
- `.claude/rules/registry.md` — confirm that registry data is
  immutable post-load and that schema changes require a DECISIONS
  entry. This packet adds `CardTypeEntrySchema` and widens the
  per-card `cardType` field; both require D-NNNN entries.
- `packages/registry/src/schema.ts` — read entirely. Locks the
  current `cardType: z.enum([...]).optional()` and the existing
  `KeywordGlossarySchema` / `RuleGlossarySchema` `.strict()`
  precedent (introduced by WP-082). New schemas mirror that
  precedent.
- `apps/registry-viewer/src/App.vue` lines 80–126 — read entirely.
  Locks the current hardcoded `TYPE_GROUPS` shape and the
  `selectedTypes: Set<FlatCardType>` filter model. The new
  taxonomy-driven ribbon must produce the same downstream
  `applyFilters()` behavior; only the source of the button list
  changes. Note the orphan "Location" entry on line 122 — this
  packet removes it.
- `apps/registry-viewer/src/lib/glossaryClient.ts` — read entirely.
  Canonical fetch-boundary `.safeParse(...)` non-blocking pattern.
  New `cardTypesClient.ts` mirrors structure exactly: module-scope
  singleton `_promise`, `devLog("cardTypes", ...)` instrumentation,
  `.safeParse(...)` validation, full-sentence `[CardTypes]
  Rejected …` warn, empty-array degraded fallback.
- `apps/registry-viewer/src/lib/devLog.ts` — read entirely. Confirm
  the categorical signature `devLog(category, message, fields?)`
  (per EC-104 lock). New category `"cardTypes"` joins the existing
  set without changing the signature.
- `apps/registry-viewer/CLAUDE.md` — read entirely. Confirms the
  data-flow contract (registry-config.json → R2 metadata fetches →
  parallel non-blocking) that this packet extends.
- `data/metadata/keywords-full.json` and `data/metadata/rules-full.json`
  — read first 30 lines of each. Confirms the JSON shape /
  formatting / ordering convention (alphabetical-by-key for glossary;
  this packet uses explicit `order` field for taxonomy because
  display sequence matters).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — confirm canonical
  field names. The new `CardTypeEntry` field set
  (`slug`, `label`, `emoji?`, `order`, `parentType`) must match 00.2
  exactly; if any field is inconsistent, STOP — update 00.2 first
  with a DECISIONS entry, then update the schema.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rules 4 (no abbreviations),
  6 (`// why:` on non-obvious decisions), 13 (ESM only). The new
  `cardTypesClient.ts` must satisfy all.
- `docs/ai/DECISIONS.md` — scan for `WP-084` entries (the deletion
  rationale), `WP-082` entries (the `.strict()` schema precedent),
  and any prior `card-types.json` decisions. The new D-NNNN entry
  this packet lands must explicitly cite WP-084's deletion D-entry
  and explain that the constraint (no runtime consumer) is now
  satisfied.
- `docs/01-VISION.md §1, §2, §10, §11` — the `## Vision Alignment`
  section below asserts these clauses are preserved.

---

## Non-Negotiable Constraints

**Cross-cutting (always apply — do not remove):**

- ESM only, Node v22+ — all new files use `import` / `export`, never
  `require`
- `node:` prefix on all Node.js built-in imports (none expected in
  this packet, but the rule stands)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside any helper or test (the
  `cardTypesClient.ts` HTTP fetch is at module scope, not inside
  helpers or tests; tests stub the fetch)
- Full file contents for every new or modified file in the output —
  no diffs, no snippets
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific (locked Interpretation A):**

- **Container shape unchanged.** `SetDataSchema` containers
  (`heroes[]`, `masterminds[]`, `villainGroups[]`, `henchmanGroups[]`,
  `schemes[]`) are retained unchanged. Engine `Game.setup()` is
  untouched. Per-card files retain their per-container shape. This
  packet does NOT flatten containers (Interpretation B is rejected).
- **`packages/game-engine/**` is not modified.** No engine import,
  no engine type change, no engine test change.
- **`apps/server/**` and `apps/arena-client/**` are not modified.**
- **`packages/registry/src/schema.ts`** is the only file in
  `packages/registry/**` that is modified. Add `CardTypeEntrySchema`
  / `CardTypesIndexSchema` (both `.strict()`); add inferred types
  `CardTypeEntry` / `CardTypesIndex`; widen the per-card `cardType`
  field from a four-value `z.enum(...)` to `z.string().optional()`.
  Re-export the two new schemas + two new types from
  `packages/registry/src/index.ts`. No other files in the registry
  package change. No new registry runtime helpers.
- **`CardTypeEntrySchema` field set is locked** (do not paraphrase
  or expand):
  - `slug: z.string().min(1)` — the canonical identifier (e.g.,
    `"hero"`, `"shield"`, `"shield-agent"`, `"sidekick"`)
  - `label: z.string().min(1)` — human display label (e.g.,
    `"Hero"`, `"S.H.I.E.L.D."`, `"S.H.I.E.L.D. Agent"`,
    `"Sidekick"`)
  - `emoji: z.string().optional()` — single emoji used in the
    ribbon button (matches today's hardcoded emojis); optional
    because future taxonomy entries may not need one
  - `order: z.number().int().nonnegative()` — display sort key for
    siblings sharing the same `parentType` (top-level entries are
    sorted by `order`; sub-chips within a parent are sorted by
    `order` independently)
  - `parentType: z.string().nullable()` — `null` for top-level
    entries that render as ribbon buttons; non-null for sub-chips
    (the value is the parent's `slug`)
- **`CardTypesIndexSchema` is `z.array(CardTypeEntrySchema)`** with
  the additional invariant (enforced at fetch-time, not by Zod)
  that every `parentType` value either equals an existing entry's
  `slug` or is `null`. Relational orphan entries (valid schema,
  invalid `parentType` reference) are NOT treated as schema
  rejections:
  - The orphan entry is dropped from the derived ribbon model
  - A single `console.warn("[CardTypes] Orphan parentType: <slug>")`
    is emitted (one warn per unique offending `parentType` value,
    deduplicated for the page session)
  - The fetch is considered successful (non-blocking degradation)

  The `[CardTypes] Rejected …` warn is reserved for **Zod schema
  rejection** at the `.safeParse()` boundary (e.g., a missing
  `slug`, wrong type, or extra field on a `.strict()` entry).
  Orphan-parent is a post-parse relational invariant and uses the
  distinct `Orphan parentType` token so log triage cleanly
  separates the two failure modes.
- **`CardType = string` alias.** Replace the existing
  `FlatCardType` z.enum union with `type CardType = string` (a
  named string alias, not bare `string`). Validation against
  `card-types.json` happens at fetch time in the viewer, not at
  registry-load time — this is the locked design choice (the
  registry remains permissive; the viewer enforces taxonomy).
- **`data/metadata/card-types.json`** is the new taxonomy file.
  Authored by hand; uploaded to
  `images.barefootbetters.com/metadata/card-types.json` as an
  operator step (R2 credentials required). Contains exactly the
  taxonomy entries listed in **Locked taxonomy entries** below,
  no more, no less. Adding entries is a follow-up content WP, not
  scope creep here.
- **Locked taxonomy entries (Phase 1 ship list):**
  Top-level entries (alphabetical by `label` for human readability;
  `order` field controls display):
  1. `{ slug: "hero",        label: "Hero",        emoji: "🦸", order: 10, parentType: null }`
  2. `{ slug: "mastermind",  label: "Mastermind",  emoji: "👹", order: 20, parentType: null }`
  3. `{ slug: "villain",     label: "Villain",     emoji: "🦹", order: 30, parentType: null }`
  4. `{ slug: "henchman",    label: "Henchman",    emoji: "👤", order: 40, parentType: null }`
  5. `{ slug: "scheme",      label: "Scheme",      emoji: "📜", order: 50, parentType: null }`
  6. `{ slug: "bystander",   label: "Bystander",   emoji: "🧑", order: 60, parentType: null }`
  7. `{ slug: "wound",       label: "Wound",       emoji: "🩸", order: 70, parentType: null }`
  8. `{ slug: "sidekick",    label: "Sidekick",    emoji: "🧒", order: 80, parentType: null }`
  9. `{ slug: "shield",      label: "S.H.I.E.L.D.", emoji: "🛡️", order: 90, parentType: null }`
  10. `{ slug: "other",      label: "Other",       emoji: "🃏", order: 100, parentType: null }`

  Sub-chips for `shield`:
  11. `{ slug: "shield-agent",   label: "Agent",   order: 10, parentType: "shield" }`
  12. `{ slug: "shield-officer", label: "Officer", order: 20, parentType: "shield" }`
  13. `{ slug: "shield-trooper", label: "Trooper", order: 30, parentType: "shield" }`

  - **The orphan `location` entry is NOT included.** It existed in
    the prior hardcoded ribbon (`apps/registry-viewer/src/App.vue:122`)
    but `flattenSet()` never assigned it. Removing it is part of
    this packet.
  - **No emoji on sub-chips.** Sub-chips render as text-only
    pills inside the parent's expanded panel. The parent button
    carries the emoji. Visual treatment matches today's
    `Other → Other` sub-chip presentation.
- **`apps/registry-viewer/src/lib/cardTypesClient.ts`** is new.
  Mirrors `glossaryClient.ts` structurally:
  - Module-scope singleton `_promise: Promise<CardTypeEntry[]> | null`
  - Exported `getCardTypes(metadataBaseUrl: string):
    Promise<CardTypeEntry[]>` — non-blocking; resolves to `[]` on
    fetch failure or schema rejection
  - `devLog("cardTypes", "load start", { url })` /
    `devLog("cardTypes", "load complete", { count })` /
    `devLog("cardTypes", "load failed", { error })` instrumentation
  - `.safeParse(...)` against `CardTypesIndexSchema` at the fetch
    boundary; `.parse(...)` is forbidden
  - Full-sentence rejection warn:
    `console.warn("[CardTypes] Rejected …")` with the Zod issue
    list summarized to one line
  - Empty-array fallback on rejection or fetch failure (degraded
    UI: ribbon shows the legacy hardcoded fallback list — see
    next bullet)
- **Legacy fallback in `App.vue` is preserved as a degraded path**,
  not removed. Rationale: if the taxonomy fetch fails, the ribbon
  must still render a usable filter. The fallback is the existing
  hardcoded `TYPE_GROUPS` array, kept verbatim, behind a
  conditional: `cardTypes.length > 0 ? generateRibbonFromTaxonomy()
  : LEGACY_TYPE_GROUPS`. The legacy path is dead code in the happy
  path but lights up on degraded fetch. Add `// why:` comment.
- **`packages/registry/src/schema.ts` per-card `cardType` widening.**
  The current `cardType: z.enum(["hero", "mastermind", "villain",
  "scheme"]).optional()` becomes `cardType: z.string().optional()`.
  Add `// why:` comment: the four-value enum is no longer
  authoritative; `card-types.json` is the taxonomy, validated at
  fetch time in the viewer. The registry remains permissive at
  load time so existing 40 sets continue to load; cards without
  `cardType` set are routed to the `"other"` ribbon button (or the
  legacy fallback, depending on which path is active).
- **No upstream `modern-master-strike` changes.** Phase 2 (regenerate
  40 sets with `cardType` emitted per card) is a follow-up WP. This
  packet ships with new ribbon buttons that return zero cards for
  `sidekick` / `shield` / `shield-agent` / `shield-officer` /
  `shield-trooper` — that is the locked Phase 1 outcome and is
  asserted by tests.
- **One new viewer devDep permitted: `tsx` (test runner).** The
  viewer has no `node:test` runner today (no `*.test.ts` files
  exist under `apps/registry-viewer/src/` at HEAD). To execute the
  two new test files (`cardTypesClient.test.ts` and
  `shared.test.ts`) without inventing a parallel harness, this
  packet adds `tsx` to `apps/registry-viewer/package.json`
  `devDependencies` at the same minor version pinned by the
  registry package (`^4.15.7`) and adds a `"test": "node --import
  tsx --test src/**/*.test.ts"` script — byte-identical to the
  registry-package precedent at `packages/registry/package.json`.
  No other dep change. No router, no clipboard, no fetch polyfill.
  Production runtime deps remain `vue`, `zod`, `@legendary-arena/registry`.
  This is the only WP-086-authorized `package.json` edit;
  `pnpm-lock.yaml` updates accordingly (add `tsx` and its transitive
  deps under the viewer's resolution; the registry package's `tsx`
  entry is reused by pnpm's content-addressed store, so the lock
  delta is small).
- **No persistence.** No `localStorage` / `sessionStorage` /
  `IndexedDB` / `document.cookie` writes anywhere in the new files.
  The taxonomy is fetched fresh on each load (via the singleton
  `_promise` cache; the cache lives only for the lifetime of the
  module — i.e., the page session).
- **`CardTypeEntrySchema` is `.strict()`.** No additional fields
  permitted on entries. Adding fields requires a separate WP with
  a DECISIONS entry. Mirrors WP-082's `.strict()` precedent.

**Session protocol:**

- If `data/metadata/card-types.json` already exists at session
  start (i.e., WP-084's deletion was reverted between draft and
  execution), STOP. The deletion-then-readd story must be a clean
  Phase 1 deliverable; existing content would compromise the
  DECISIONS narrative. Re-establish baseline before proceeding.
- If the upstream `modern-master-strike` generator has already been
  updated to emit `cardType` between draft and execution, STOP.
  The Phase 1 / Phase 2 split is an ordering invariant; combining
  them in one session would expand scope past the locked design.
- If `apps/registry-viewer/src/App.vue` has been refactored between
  draft and execution (e.g., `TYPE_GROUPS` extracted into a
  separate file), re-read line by line before editing. The hardcoded
  `LEGACY_TYPE_GROUPS` fallback must be byte-identical to whatever
  was there at session start.

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via
deterministic state inspection.

The following requirements are mandatory:

- `cardTypesClient.ts` instruments every fetch lifecycle event via
  `devLog("cardTypes", ...)`. With the URL-parameterized debug gate
  on (`DEBUG_VIEWER`), the operator sees `load start` / `load
  complete` / `load failed` events with payload metadata.
- A schema-rejection event logs the Zod issue list summarized to one
  line via `console.warn("[CardTypes] Rejected …")` (full-sentence,
  per the registry-rules error-message convention).
- Empty-taxonomy fallback is observable two ways: (a)
  `cardTypes.length === 0` in Vue devtools is the static signal
  that the legacy `LEGACY_TYPE_GROUPS` ribbon is active; (b) when
  the legacy fallback is selected for the first time after
  `getCardTypes()` resolves, a single
  `devLog("cardTypes", "using legacy fallback")` event is emitted
  (deduplicated for the page session). The diagnostic event makes
  degraded mode unmistakable in console traces without changing
  control flow.
- Per-card `cardType` slugs that don't match any taxonomy entry are
  routed to the `"other"` ribbon button. A single
  `console.warn("[CardTypes] Unknown slug: <value>")` event is
  emitted per unique unknown slug, deduplicated for the page session.
- **Per-card `cardType` routing rules (truth table):**

  | Per-card `cardType` value | Ribbon routing | Diagnostic |
  |---|---|---|
  | absent (Phase 1 reality) | treated as `"other"` | none (silent — Phase 1 expected) |
  | unknown slug (not in taxonomy) | treated as `"other"` | `[CardTypes] Unknown slug: <value>` warn (one per unique slug) |
  | explicit `"other"` | treated as `"other"` | none |
  | known taxonomy slug | routed to that slug's button | none |

  These rules make `"other"` semantics explicit rather than
  implicit and prevent regressions when Phase 2 begins emitting
  `cardType` per card.
- The two-phase rollout's Phase 1 outcome (new ribbon buttons return
  zero cards) is asserted by an integration test that calls
  `applyFilters()` with `selectedTypes = new Set(["sidekick"])` on a
  fixture registry and asserts `filteredCards.length === 0`.

---

## Scope (In)

### A) `data/metadata/card-types.json` — new taxonomy file

- **`data/metadata/card-types.json`** — new — exactly 13 entries
  per the **Locked taxonomy entries** list above. JSON formatting
  follows `keywords-full.json` convention (2-space indent, top-level
  array, trailing newline).
- **Operator step:** upload to
  `images.barefootbetters.com/metadata/card-types.json` with
  `Content-Type: application/json` and `Cache-Control: max-age=300,
  must-revalidate` (matches `keywords-full.json` cache policy).
  STOP and escalate if R2 credentials are unavailable. The viewer
  WP author cannot complete the WP without this upload.

### B) `packages/registry/src/schema.ts` — schema additions

- **`packages/registry/src/schema.ts`** — modified:
  - Add `CardTypeEntrySchema` (`.strict()`) with the locked four
    fields (`slug`, `label`, `emoji?`, `order`, `parentType`).
  - Add `CardTypesIndexSchema = z.array(CardTypeEntrySchema)`.
  - Add inferred types `CardTypeEntry = z.infer<typeof
    CardTypeEntrySchema>` and `CardTypesIndex = z.infer<typeof
    CardTypesIndexSchema>`.
  - Add type alias `export type CardType = string;` with `// why:`
    comment: the four-value enum is no longer authoritative;
    `card-types.json` is the taxonomy, validated at fetch time in
    the viewer.
  - Widen the existing `cardType: z.enum(["hero", "mastermind",
    "villain", "scheme"]).optional()` to `cardType:
    z.string().optional()` with `// why:` comment.
  - **No other changes** to `schema.ts`. No reordering, no
    unrelated edits.

### C) `packages/registry/src/index.ts` — re-exports

- **`packages/registry/src/index.ts`** — modified:
  - Re-export `CardTypeEntrySchema`, `CardTypesIndexSchema`,
    `CardTypeEntry`, `CardTypesIndex`, `CardType` alongside the
    existing `KeywordGlossary*` / `RuleGlossary*` exports.
  - Single re-export block addition; no other changes.

### D) `apps/registry-viewer/src/lib/cardTypesClient.ts` — new fetcher

- **`apps/registry-viewer/src/lib/cardTypesClient.ts`** — new:
  - Module-scope singleton `_promise: Promise<CardTypeEntry[]> |
    null = null`.
  - Exported `getCardTypes(metadataBaseUrl: string):
    Promise<CardTypeEntry[]>`.
  - Imports `CardTypesIndexSchema` from
    `@legendary-arena/registry/schema` (the narrow subpath, never
    the barrel — per `glossaryClient.ts` precedent).
  - Imports `devLog` from `../lib/devLog.ts`.
  - Fetches `${metadataBaseUrl}card-types.json` once; subsequent
    calls return the cached promise.
  - `.safeParse(...)` against `CardTypesIndexSchema` at the
    response-JSON boundary. On `success: false`, log
    `console.warn("[CardTypes] Rejected: <issue list>")` and resolve
    to `[]`.
  - On HTTP failure, log
    `devLog("cardTypes", "load failed", { error: msg })` and
    resolve to `[]`. Network failures do not throw — the
    consumer continues with the legacy fallback.
  - Add JSDoc on the exported function citing the WP-082
    `.safeParse()` non-blocking pattern.

### E) `apps/registry-viewer/src/lib/cardTypesClient.test.ts` — coverage

- **`apps/registry-viewer/src/lib/cardTypesClient.test.ts`** — new
  — `node:test` coverage:
  - Happy path: stub `fetch` to return a 13-entry payload; assert
    the resolved array matches.
  - Schema rejection: stub `fetch` to return a payload missing
    `slug` on one entry; assert the resolved array is `[]` and a
    `[CardTypes] Rejected …` warn was emitted.
  - HTTP failure: stub `fetch` to throw; assert the resolved array
    is `[]` and a `devLog` failure event was emitted.
  - Singleton: call `getCardTypes(...)` twice; assert `fetch` was
    called once.
  - No `boardgame.io` import in the test file. Uses `node:test` and
    `node:assert` only.

### F) `apps/registry-viewer/src/App.vue` — taxonomy-driven ribbon

- **`apps/registry-viewer/src/App.vue`** — modified:
  - Import `CardTypeEntry` from `@legendary-arena/registry`.
  - Import `getCardTypes` from `./lib/cardTypesClient.ts`.
  - Add reactive `cardTypes = ref<CardTypeEntry[]>([])`.
  - Inside the existing `onMounted` `try` block (parallel to the
    `getThemes()` and `getKeywordGlossary()` calls), add
    `cardTypes.value = await getCardTypes(metadataBaseUrl)`. Wrap
    in its own `try` per the project's non-blocking convention so
    a taxonomy fetch failure doesn't abort theme / glossary loads.
  - Add a `LEGACY_TYPE_GROUPS` const containing the existing
    hardcoded `TYPE_GROUPS` array byte-identical to today's source
    (kept as fallback when the taxonomy fetch returns empty).
    Add `// why:` comment citing the degraded-fetch fallback
    rationale.
  - Replace the hardcoded `TYPE_GROUPS` reference with a computed
    `displayedTypeGroups`:
    - When `cardTypes.value.length === 0`: returns
      `LEGACY_TYPE_GROUPS`.
    - Otherwise: generates the ribbon model from `cardTypes.value`
      — top-level entries (`parentType === null`) sorted by
      `order`; each carries its sub-chips (entries whose
      `parentType` matches the top-level slug, sorted by their
      own `order`).
  - The orphan `Location` button is removed (deleted from the
    legacy fallback as well — Phase 1 ships without it on both
    paths).
  - The selected-types model (`selectedTypes: Set<string>`),
    `toggleGroup`, `isGroupActive`, `isGroupFullyActive`,
    `clearTypes`, `clearAllFilters`, and `applyFilters` are
    UNCHANGED. Only the source of `displayedTypeGroups` differs.
  - Add `// why:` comments on (a) the `getCardTypes` call site
    citing the taxonomy-source-of-truth design, (b) the
    `LEGACY_TYPE_GROUPS` fallback rationale, (c) the `Location`
    removal (orphan UI; `flattenSet()` never assigned it).

### G) `apps/registry-viewer/src/App.vue` integration coverage

- **`apps/registry-viewer/src/App.vue`** is not directly unit-
  tested (no Vue component-test harness in the viewer per the
  WP-066 / WP-094 / WP-096 precedent). Coverage is via:
  - `cardTypesClient.test.ts` (covers the fetch / schema
    boundary).
  - Manual smoke test (in **Verification Steps** below): start the
    dev server, observe the ribbon renders the 10 top-level
    buttons, click `S.H.I.E.L.D.` to expand sub-chips, click
    `Sidekick`, confirm zero cards display (Phase 1 expected
    behavior), confirm the legacy `Location` button is absent.
  - A lightweight `applyFilters()` integration test pinned in the
    next bullet.

### H) `apps/registry-viewer/src/registry/shared.test.ts` — Phase 1 invariant

- **`apps/registry-viewer/src/registry/shared.test.ts`** — **new**
  (file does not exist at HEAD `95108f6`; pre-flight Q3 confirmed
  via `Glob` returning zero matches — the WP-086 §Scope (In) H
  earlier "modified or new" wording is resolved to **new**):
  - New test: `applyFilters` with `cardTypes: ["sidekick"]` on a
    fixture registry returns zero cards (Phase 1 invariant: ribbon
    button exists, no cards match, no crash).
  - New test: `applyFilters` with `cardTypes: ["shield-agent"]`
    returns zero cards.
  - New test: `applyFilters` with `cardTypes: ["hero"]` returns the
    expected hero cards (regression baseline).
  - New test: `applyFilters` with `cardTypes: ["location"]` is no
    longer a meaningful query (ribbon button removed); confirm
    that passing it returns zero cards (the registry never had
    location-typed cards) and no crash.

### I) `apps/registry-viewer/package.json` — `node:test` harness wiring

- **`apps/registry-viewer/package.json`** — modified:
  - Add `"test": "node --import tsx --test src/**/*.test.ts"` to
    the `scripts` block — byte-identical to the registry-package
    precedent at `packages/registry/package.json:31`.
  - Add `"tsx": "^4.15.7"` to `devDependencies` — the same minor
    version pinned by the registry package (verified at HEAD
    `95108f6`). pnpm's content-addressed store reuses the existing
    `tsx` install; the workspace lockfile delta is a single
    additive `devDependencies` line + the small set of transitive
    deps not already pulled by the registry workspace.
  - **No other change.** No `dependencies` edit. No script rename.
    No `scripts.dev` / `scripts.build` / `scripts.preview` /
    `scripts.typecheck` / `scripts.lint` modification.
  - This is the first viewer-side `node:test` harness in the
    project. It coexists with — but does not replace — the future
    Vue component-test framework that a follow-up WP will
    introduce. New `// why:` comment is not required (`package.json`
    is JSON; rationale lives in the new D-NNNN entry instead).

---

## Out of Scope

- **No upstream `modern-master-strike` generator changes.** Phase 2
  (regenerate all 40 sets with `cardType` emitted per card) is a
  separate WP. This packet ships with the ribbon buttons rendering
  zero cards for `sidekick` / `shield*` — that is the locked Phase
  1 outcome.
- **No engine changes.** `packages/game-engine/**` is not modified.
  `Game.setup()`, `cardStats`, `villainDeckCardTypes`,
  `cardDisplayData` (WP-111) are all unaffected.
- **No server changes.** `apps/server/**` is not modified.
- **No arena-client changes.** `apps/arena-client/**` is not
  modified. The arena-client does not consume `card-types.json` in
  this packet (the arena-client renders cards via UIState, not via
  the registry-viewer ribbon).
- **No flattening of `SetDataSchema` containers.** `heroes[]` /
  `masterminds[]` / `villainGroups[]` / `henchmanGroups[]` /
  `schemes[]` remain unchanged (Interpretation B is rejected per
  the locked design).
- **No new top-level metadata files.** `data/metadata/` gains
  exactly `card-types.json`. `themes/`, `keywords-full.json`,
  `rules-full.json`, `sets.json` are unchanged.
- **No Vue component-test framework introduced.** The viewer
  continues to lack Vitest / `@vue/test-utils` / jsdom / Playwright
  (per WP-066 / WP-094 / WP-096 precedent). The new harness wired
  by this packet is `node:test` via `tsx` only — sufficient for
  pure-TS test files (`cardTypesClient.test.ts`,
  `shared.test.ts`) that do not mount Vue components. SFC-level
  testing remains a future-WP concern.
- **No CSS / styling changes.** The ribbon button visual treatment
  is preserved exactly. Sub-chip visual treatment matches the
  existing `Other → Other` sub-chip presentation.
- **No accessibility (a11y) changes beyond preserving today's
  behavior.** EC-103 / EC-105 a11y instrumentation is unchanged.
  If the new taxonomy-driven ribbon needs additional aria-
  attributes to maintain parity, add them; do not regress.
- **No router or URL-parameterized state.** WP-114 handles URL-
  driven setup-preview. This packet does not URL-encode the
  ribbon selection.
- **Refactors, cleanups, or "while I'm here" improvements are
  out of scope** unless explicitly listed in **Scope (In)**.

---

## Files Expected to Change

- `data/metadata/card-types.json` — **new** — 13-entry taxonomy
  file (10 top-level + 3 SHIELD sub-chips)
- `packages/registry/src/schema.ts` — **modified** — add
  `CardTypeEntrySchema` / `CardTypesIndexSchema` / `CardType` alias;
  widen per-card `cardType` to `z.string().optional()`
- `packages/registry/src/index.ts` — **modified** — re-export the
  two new schemas + three new types
- `apps/registry-viewer/src/lib/cardTypesClient.ts` — **new** —
  singleton fetcher with `.safeParse()` non-blocking pattern
- `apps/registry-viewer/src/lib/cardTypesClient.test.ts` — **new**
  — `node:test` coverage (happy path, schema rejection, HTTP
  failure, singleton)
- `apps/registry-viewer/src/App.vue` — **modified** — taxonomy-
  driven ribbon + `LEGACY_TYPE_GROUPS` fallback + remove orphan
  `Location` button
- `apps/registry-viewer/src/registry/shared.test.ts` — **new**
  — Phase 1 invariant tests (`applyFilters` with new taxonomy
  slugs returns zero cards)
- `apps/registry-viewer/package.json` — **modified** — add
  `"test": "node --import tsx --test src/**/*.test.ts"` script +
  `"tsx": "^4.15.7"` devDep, byte-identical to the registry-package
  precedent at `packages/registry/package.json` (PS-2 Option B per
  preflight-wp086.md 2026-04-29 — wires the first viewer-side
  `node:test` runner so the new `.test.ts` files actually execute)
- **Operator-step (R2):** upload
  `data/metadata/card-types.json` to
  `images.barefootbetters.com/metadata/card-types.json` with the
  cache policy listed in **Scope A**

That is **8 files** plus one R2 operator step. Scope is at the
00.3 §5 ~8-file soft cap. The 8th file (`apps/registry-viewer/`-
`package.json`) was added during pre-flight resolution (PS-2 Option
B) to wire the `node:test` runner that the existing two test files
(§Scope (In) E + H) require to actually execute — without it, those
files would exist as dead test surface. Any 9th file must trigger
STOP and a separate scope amendment.

Governance updates at session close — `docs/ai/STATUS.md`,
`docs/ai/DECISIONS.md`, `docs/ai/work-packets/WORK_INDEX.md`,
`docs/ai/execution-checklists/EC_INDEX.md`, `docs/03.1-DATA-SOURCES.md`
— are listed under §Definition of Done, not in this scope list, per
the WP-111 / WP-114 / EC-117 precedent (governance files are
session-close artifacts, not production scope).

---

## Acceptance Criteria

### Taxonomy file
- [ ] `data/metadata/card-types.json` exists and contains exactly
      13 entries (10 top-level with `parentType: null` + 3 SHIELD
      sub-chips with `parentType: "shield"`)
- [ ] Each entry has the locked field set: `slug`, `label`,
      `emoji?`, `order`, `parentType`. No additional fields.
- [ ] The orphan `location` entry is NOT present
- [ ] File is uploaded to R2 at
      `images.barefootbetters.com/metadata/card-types.json`

### Schema
- [ ] `packages/registry/src/schema.ts` exports `CardTypeEntrySchema`
      (`.strict()`) and `CardTypesIndexSchema = z.array(...)`
- [ ] `packages/registry/src/schema.ts` exports inferred types
      `CardTypeEntry`, `CardTypesIndex`
- [ ] `packages/registry/src/schema.ts` exports `type CardType =
      string`
- [ ] Per-card `cardType` field is widened from `z.enum([...])` to
      `z.string().optional()`
- [ ] `packages/registry/src/index.ts` re-exports all five new
      symbols

### Fetcher
- [ ] `getCardTypes(metadataBaseUrl)` exists in
      `apps/registry-viewer/src/lib/cardTypesClient.ts`
- [ ] Uses module-scope singleton `_promise` (verified by the
      "called once" test)
- [ ] Validates with `.safeParse(...)` against
      `CardTypesIndexSchema` at the fetch boundary
- [ ] Logs full-sentence `[CardTypes] Rejected …` warn on schema
      failure; resolves to `[]`
- [ ] Resolves to `[]` on HTTP failure; emits `devLog` failure
      event
- [ ] Uses narrow subpath import
      `@legendary-arena/registry/schema` (NOT the barrel)

### Viewer ribbon
- [ ] `App.vue` calls `getCardTypes(metadataBaseUrl)` inside
      `onMounted` parallel to `getThemes()` / `getKeywordGlossary()`
- [ ] When `cardTypes.length > 0`, ribbon buttons are generated
      from `parentType === null` entries sorted by `order`
- [ ] When `cardTypes.length === 0`, `LEGACY_TYPE_GROUPS` fallback
      renders the legacy ribbon WITHOUT the `Location` button
- [ ] Sub-chips for `shield` render on click for entries with
      children
- [ ] `applyFilters()` algorithm is byte-unchanged (regression
      baseline)

### Phase 1 invariant
- [ ] `applyFilters` with `selectedTypes: ["sidekick"]` returns
      zero cards (no upstream emission yet)
- [ ] `applyFilters` with `selectedTypes: ["shield-agent"]` returns
      zero cards
- [ ] `applyFilters` with `selectedTypes: ["hero"]` returns hero
      cards (regression)
- [ ] No crash on unknown taxonomy slugs

### Layer boundary
- [ ] No `from '@legendary-arena/game-engine'` import in any new
      or modified file (Select-String verified)
- [ ] No `from '@legendary-arena/preplan'` import
- [ ] No `from 'apps/server'` import
- [ ] No `boardgame.io` import in any viewer file
- [ ] No engine-package files modified (`git diff` verified)
- [ ] No server-package files modified
- [ ] No arena-client files modified

### Tests
- [ ] `pnpm --filter @legendary-arena/registry build` exits 0
- [ ] `pnpm --filter @legendary-arena/registry test` exits 0
      (registry baseline `31 / 3 / 0` preserved)
- [ ] `pnpm --filter registry-viewer build` exits 0
- [ ] `pnpm --filter registry-viewer test` exits 0 AND emits TAP
      output for at least 8 tests across 2 suites
      (`cardTypesClient.test.ts` 4 tests + `shared.test.ts` 4
      tests). A silent "No projects matched the filters" or
      "Missing script" exit-0 is a FAILED criterion.
- [ ] `pnpm --filter registry-viewer typecheck` exits 0
- [ ] `pnpm --filter registry-viewer lint` baseline
      preserved (calibrated against pre-execution baseline; new
      stylistic warnings on `cardTypesClient.ts` are acceptable
      per the EC-091 / EC-096 precedent)
- [ ] No test imports `boardgame.io` (only `node:test` and
      `node:assert`)

### Scope Enforcement
- [ ] Only files listed in `## Files Expected to Change` were
      modified (`git diff --name-only` verified — exactly 8
      production files plus the operator R2 step + the
      governance close-out files listed under Definition of Done)
- [ ] No engine, server, or arena-client files modified
- [ ] No production-runtime npm dependency added. The only
      permitted package-graph change is `tsx` as a viewer devDep
      (test-time only) plus its transitive deps in
      `pnpm-lock.yaml`. The registry package's lockfile section
      is unchanged.

---

## Verification Steps

```pwsh
# Step 1 — registry build
pnpm --filter @legendary-arena/registry build
# Expected: exits 0, no TypeScript errors

# Step 2 — registry tests
pnpm --filter @legendary-arena/registry test
# Expected: TAP output — all tests passing

# Step 3 — viewer build
pnpm --filter registry-viewer build
# Expected: exits 0, no TypeScript errors

# Step 4 — viewer typecheck
pnpm --filter registry-viewer typecheck
# Expected: 0 errors

# Step 5 — viewer tests (PS-2 Option B: first viewer node:test run)
pnpm --filter registry-viewer test
# Expected: TAP output with "tests N" where N >= 8, "fail 0",
# covering both cardTypesClient.test.ts (4 tests) and
# shared.test.ts (4 tests). A response of "Missing script: test"
# or "No projects matched the filters" is a FAILED step —
# `apps/registry-viewer/package.json` either lacks the new script
# or the package name is mistyped. Compare against the
# registry-package script at packages/registry/package.json:31.

# Step 6 — confirm no engine import in viewer
Select-String -Path "apps\registry-viewer\src" -Pattern "@legendary-arena/game-engine|@legendary-arena/preplan|boardgame\.io|apps/server" -Recurse
# Expected: no output

# Step 7 — confirm no engine package modified
git diff --name-only -- packages/game-engine
# Expected: no output

# Step 8 — confirm server unchanged
git diff --name-only -- apps/server
# Expected: no output

# Step 9 — confirm arena-client unchanged
git diff --name-only -- apps/arena-client
# Expected: no output

# Step 10 — confirm taxonomy file shape
node -e "const j=require('./data/metadata/card-types.json'); console.log(j.length, j.filter(e=>e.parentType===null).length, j.filter(e=>e.parentType==='shield').length);"
# Expected: 13 10 3

# Step 11 — confirm no Location entry
Select-String -Path "data\metadata\card-types.json" -Pattern '"location"|"Location"'
# Expected: no output

# Step 12 — confirm no files outside scope changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change

# Step 13 — manual smoke (operator step)
pnpm --filter registry-viewer dev
# Open http://localhost:5173, observe:
#   - 10 top-level ribbon buttons render in the locked order (Hero,
#     Mastermind, Villain, Henchman, Scheme, Bystander, Wound,
#     Sidekick, S.H.I.E.L.D., Other)
#   - "Location" button is absent
#   - Click "S.H.I.E.L.D." — sub-chips render: Agent, Officer, Trooper
#   - Click "Sidekick" — zero cards display, no crash
#   - Click "Hero" — heroes filter as expected (regression)
#   - DevTools console: no "[CardTypes] Rejected" warn (happy path)
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] All verification steps pass
- [ ] `data/metadata/card-types.json` is uploaded to R2 at
      `images.barefootbetters.com/metadata/card-types.json`
- [ ] Manual smoke (Step 13) passes against a local dev server
- [ ] `docs/ai/STATUS.md` updated — what is now data-driven
      (ribbon taxonomy) vs. what was hardcoded
- [ ] `docs/ai/DECISIONS.md` updated — at minimum:
      - Why `card-types.json` is being re-added after WP-084 deleted
        it (explicitly cite WP-084's deletion D-entry; note the
        runtime-consumer constraint is now satisfied by the new
        ribbon generator)
      - Why Interpretation A (container shape unchanged) was chosen
        over Interpretation B (flatten containers) — engine
        `Game.setup()` is preserved
      - Why the per-card `cardType` field is widened to
        `z.string().optional()` — the four-value enum is no longer
        authoritative; `card-types.json` is
      - Why `S.H.I.E.L.D.` is modeled as a parent type with three
        sub-chips (Agent / Officer / Trooper) rather than three
        independent top-level types — preserves grouped filter UX
      - Why the legacy `LEGACY_TYPE_GROUPS` fallback is preserved
        as a degraded path rather than removed — the ribbon must
        remain usable on a taxonomy fetch failure
      - Why the orphan `Location` button is removed — dead UI;
        `flattenSet()` never assigned it
      - Why the viewer's first `node:test` runner lands inside this
        feature WP rather than a dedicated harness WP (PS-2 Option B
        per `docs/ai/invocations/preflight-wp086.md` 2026-04-29) —
        the two `.test.ts` files §Scope (In) E + H introduces would
        otherwise be dead test surface; the runner mirrors the
        registry-package precedent byte-identically (`node --import
        tsx --test src/**/*.test.ts` + `tsx ^4.15.7` devDep), so the
        harness is one line + one devDep with no new abstraction
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-086 checked off
      with today's date
- [ ] `docs/ai/execution-checklists/EC_INDEX.md` EC-086 row
      (added at EC drafting time) flips from `Draft` to
      `Done {YYYY-MM-DD}`
- [ ] `docs/03.1-DATA-SOURCES.md` (if it exists; it does per WP-082)
      gains a new row under §Registry Metadata for `card-types.json`
- [ ] No files outside `## Files Expected to Change` were modified
      (`git diff --name-only` verified — explicit scope-boundary
      check per 00.3 §15)

---

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2 (Content
Authenticity), §10 (Content as Data), §10a (Registry Viewer Public
Surfaces), §11 (Stateless Client Philosophy).

**Conflict assertion:** No conflict — this WP preserves all touched
clauses.

- §1 and §2 are upheld: card-type classifications match
  authoritative game terminology (Hero / Mastermind / Villain /
  Henchman / Scheme / Bystander / Wound / Sidekick / S.H.I.E.L.D.).
  The taxonomy entries are derived from the published Legendary
  rulebook, not invented.
- §10 is advanced: ribbon classification moves from hardcoded UI
  state into a data file (`card-types.json`) loaded at runtime.
  Adding a future taxonomy entry is now an edit-one-JSON change,
  not a code change.
- §10a is the public-surface clause this WP directly touches: the
  Registry Viewer at `cards.barefootbetters.com` is a public read
  surface. This packet preserves that — `card-types.json` is
  publicly readable on R2 (same access policy as
  `keywords-full.json` and `rules-full.json`), no authentication
  is introduced, and the ribbon remains a public-facing browse
  affordance.
- §11 is preserved: the viewer remains stateless. Taxonomy is
  fetched fresh on each page load (singleton-cached for the
  session); no `localStorage` / persistence introduced.

**Non-Goal proximity check (NG-1..7):** None of NG-1..7 are crossed.
This packet introduces no monetization, no cosmetic store, no
persuasive UI, no engagement-pattern dark surfaces. The
taxonomy file is presentation infrastructure, not commercial
surface.

**Determinism preservation (Vision §8, §22):** N/A. The engine is
untouched. Viewer behavior is deterministic given a fixed
taxonomy file (and degraded-deterministic on fetch failure via
`LEGACY_TYPE_GROUPS`).

---

## Funding Surface Gate

**Status:** N/A — this packet introduces no funding-related surfaces.

**Justification (per 00.3 §20.1):** WP-086 adds a card-type taxonomy
data file plus its viewer ribbon consumer. None of the §20.1 trigger
surfaces are touched: no global navigation funding affordances (per
WP-097 §A); no registry-viewer funding affordances (per WP-097 §B);
no profile / account funding attribution (per WP-097 §C); no
tournament-specific funding-channel integrations; no user-visible
copy referencing donate / support / tournament funding terms. The
ribbon button labels (`Hero`, `Mastermind`, `Villain`, …) are
gameplay terminology only. **Authority:** WP-097 + D-9701 + D-9801
(cited per 00.3 §20.2 authority-citation discipline).

---

## Open Questions (Must Resolve Before Promoting From Draft)

1. **R2 upload coordination.** Phase 1 ships with the viewer
   pointing at the new `card-types.json` URL. If the file is not
   uploaded before the viewer deploys, every page load will hit
   the empty-array fallback and the user-visible ribbon will be
   the legacy hardcoded list. Confirm the R2 upload step is
   sequenced ahead of the viewer deploy, and confirm the operator
   has R2 credentials available at execution time. STOP and
   escalate at execution start if credentials are unavailable.

2. **`schema.ts` per-card `cardType` widening blast radius.**
   Widening from `z.enum([...]).optional()` to
   `z.string().optional()` removes a runtime guard that the four
   legacy values were the only allowed strings. Audit
   `flattenSet()` and any downstream consumers of `card.cardType`
   to confirm none depend on the enum narrowing for type
   refinement. The viewer's `applyFilters()` reads the field as
   a string today (per the `selectedTypes: Set<string>` model), so
   widening is consistent with current usage. Verify before
   execution.

3. **`shared.test.ts` existence.** Confirm whether
   `apps/registry-viewer/src/registry/shared.test.ts` exists at
   session start. If not, the Phase 1 invariant tests are added in
   a new file. If it exists, extend it (do not delete existing
   tests). Pre-flight should grep the directory before starting.

4. **`emoji` rendering parity.** The existing hardcoded ribbon uses
   string emojis (`"🦸"`, `"👹"`, etc.). The new taxonomy entries
   carry the same emojis as `string` fields. Confirm that Vue's
   default rendering preserves emoji codepoints byte-identically
   between the two paths (no escaping / normalization). A small
   visual regression test in the manual smoke step is sufficient.

5. **`docs/03.1-DATA-SOURCES.md` row.** WP-082 added rows for
   `keywords-full.json` and `rules-full.json`. Confirm the file
   path and section header at execution time before adding the
   `card-types.json` row.

---

## WORK_INDEX Note

When this WP is promoted from Draft to Ready, add it to
`docs/ai/work-packets/WORK_INDEX.md` in the appropriate phase
section with:

- **Dependencies:** WP-084, WP-082, WP-066, WP-091
- **Notes:** Re-adds `data/metadata/card-types.json` (deleted under
  WP-084) with a runtime consumer (ribbon generator + per-card
  `cardType` validation), satisfying WP-084's deletion constraint.
  Phase 1 of a two-phase rollout: this WP ships the schema +
  viewer + taxonomy file; Phase 2 (a follow-up WP) updates the
  upstream `modern-master-strike` generator to emit `cardType` per
  card and regenerates all 40 sets. Adds `Sidekick` and
  `S.H.I.E.L.D.` (with Agent / Officer / Trooper sub-chips) to the
  ribbon; removes the orphan `Location` button. Engine
  (`packages/game-engine`) untouched (Interpretation A — container
  shape preserved). Unblocks WP-114.

---

## Lint Self-Review (00.3)

**Result: PASS 2026-04-28.** All ❌ FAIL conditions in the 00.3
Final Gate are satisfied. Section-by-section dispositions below.

### §1 — Work Packet Structure
- ✅ All 10 required sections present and non-empty: `## Goal`,
  `## Assumes`, `## Context (Read First)`, `## Scope (In)`,
  `## Out of Scope`, `## Files Expected to Change`,
  `## Non-Negotiable Constraints`, `## Acceptance Criteria`,
  `## Verification Steps`, `## Definition of Done`.
- ✅ `## Out of Scope` lists 9 explicit exclusions (well above the
  ≥2 floor).

### §2 — Non-Negotiable Constraints Block
- ✅ Engine-wide constraints present (titled "Cross-cutting"
  because no engine code is touched; functionally equivalent).
- ✅ Full file contents required for every new / modified file —
  diffs and snippets explicitly forbidden.
- ✅ ESM only / Node v22+ stated.
- ✅ References `docs/ai/REFERENCE/00.6-code-style.md` (Rule 4 / 6 /
  13 cited explicitly in `## Context`).
- ✅ Packet-specific constraints present (locked Interpretation A,
  13-entry taxonomy lock, schema fields lock, fallback-preserved
  rule).
- ✅ Session protocol present (3 STOP conditions).
- ✅ Locked contract values present (taxonomy entries, schema field
  set, R2 upload path).

### §3 — Prerequisites (`## Assumes`)
- ✅ All prior WPs listed (WP-084, WP-082, WP-066, WP-091) with the
  exact exports / shapes required.
- ✅ External state listed: R2 publish workflow operability;
  `data/metadata/card-types.json` does NOT exist at session start
  (verified 2026-04-28 via `Glob data/metadata/*` returning only
  `sets.json`, `keywords-full.json`, `rules-full.json`).
- ✅ Build / test exit-0 baselines listed.

### §4 — Context References (`## Context (Read First)`)
- ✅ Specific docs + sections cited (`ARCHITECTURE.md §Layer
  Boundary`, `00.6 Rules 4 / 6 / 13`, `00.2-data-requirements.md`).
- ✅ Touches data shapes — `00.2-data-requirements.md` cited.
- ✅ Touches package boundaries — `ARCHITECTURE.md §Layer Boundary
  (Authoritative)` and `.claude/rules/architecture.md §Layer
  Boundary` both cited.
- ✅ Prior decisions — `DECISIONS.md` scan note (WP-084 deletion
  rationale; WP-082 `.strict()` precedent).

### §5 — Output Completeness (`## Files Expected to Change`)
- ✅ All files marked `— new` or `— modified` with one-line
  descriptions.
- ✅ No "update this section" / "show diff" / "add the following
  code" language anywhere.
- ✅ Bounded — 7 production files + 1 R2 operator step (under the
  ~8-file soft cap).
- **Fix applied during lint:** body said "6 files" (off-by-one);
  corrected to "7 files" with explicit cap-discipline note.

### §6 — Naming Consistency
- ✅ Field names match 00.2 (`ext_id` discipline preserved; setup
  payload field names — `schemeId`, `mastermindId`, etc. — not
  introduced by this WP, but the `cardType` slug field aligns
  with 00.2's existing field-name conventions).
- ✅ No abbreviations in new identifiers (`cardTypesClient`,
  `getCardTypes`, `LEGACY_TYPE_GROUPS`, `CardTypeEntry`).
- ✅ No typos in file paths (cross-checked against
  `apps/registry-viewer/src/` glob).
- ✅ No stray backticks at section ends.

### §7 — Dependency Discipline
- ✅ "No new npm dependency" stated in Non-Negotiable Constraints
  + Acceptance Criteria (`pnpm-lock.yaml` unchanged check).
- ✅ Forbidden packages not introduced (no `axios`, no Jest /
  Vitest, no Passport / Auth0 / Clerk).
- ✅ N/A: no Hanko-related surface; this WP doesn't touch auth.

### §8 — Architectural Boundaries
- ✅ Layer Boundary preserved: `apps/registry-viewer` may import
  `registry`, never `game-engine` / `preplan` / `server` /
  `arena-client`. Acceptance Criteria + Verification Step 6
  enforce by grep.
- ✅ Frontend rule satisfied: viewer uses dedicated
  `cardTypesClient.ts` (mirrors `glossaryClient.ts`) — does not
  fetch R2 from a component.
- N/A: backend (PG / WebSocket / moves) — no engine code.
- N/A: game logic (G / ctx / `Math.random` / deck builder) — no
  engine code.

### §9 — Windows Compatibility
- ✅ Verification Steps use PowerShell (`Select-String`, backslash
  paths).
- ✅ All `pnpm` invocations are pwsh-compatible.
- N/A: no shell scripts; no rclone config; no env-var sourcing.

### §10 — Environment Variable Hygiene
- N/A — this WP introduces no env vars. `metadataBaseUrl` already
  exists in `public/registry-config.json` per WP-066. No
  `.env.example` change required.

### §11 — Authentication Clarity
- N/A — viewer is unauthenticated. No JWT, no credentials, no
  Hanko surface.

### §12 — Test Quality
- ✅ Tests use `node:test` and `node:assert` only
  (`cardTypesClient.test.ts`, `shared.test.ts` extension).
- ✅ No `boardgame.io` import in any test file.
- ✅ Tests run without network (stub `fetch`) and without DB.
- N/A: `makeMockCtx` (no engine context); no golden / snapshot
  determinism test (no deck construction in viewer scope).

### §13 — Commands and Verification
- ✅ All commands use `pnpm` (no `npm run`).
- ✅ Every step is exact with expected output inline (one
  necessary exception: Step 13 manual smoke against dev server,
  flagged as operator step because the viewer has no Vue
  component-test framework per WP-066 / WP-094 / WP-096
  precedent).
- ✅ `pnpm check` / `pnpm validate` not applicable to this WP.

### §14 — Acceptance Criteria Quality
- ✅ All AC items binary, observable, specific (file names,
  function names, exact strings).
- ✅ AC aligned with deliverables — no phantom checks.
- The total AC count (~41 across 8 sections) is above the literal
  "6–12 items" guideline, but matches the established sectioned-
  AC pattern in WP-111 / WP-114 / WP-102 (recent precedent
  treats the cap as per-section guidance, not total). Not a FAIL.

### §15 — Definition of Done
- ✅ All AC pass checkbox present.
- ✅ STATUS.md updated.
- ✅ DECISIONS.md updated (6 entries enumerated).
- ✅ WORK_INDEX.md flipped.
- ✅ EC_INDEX.md row flipped (added during lint — was missing).
- **Fix applied during lint:** explicit "No files outside `## Files
  Expected to Change` were modified" checkbox added to DoD
  (transitively covered via AC §Scope Enforcement, but 00.3 §15
  requires it directly in DoD).

### §16 — Code Style (instructions to executor)
- ✅ §16.1: `cardTypesClient.ts` mirrors `glossaryClient.ts`
  structurally — no premature abstraction; fallback path is
  inline in `App.vue`, not factored into a helper.
- ✅ §16.2: No `.reduce()` for branching logic (00.6 referenced).
- ✅ §16.3: Full English names throughout (`cardTypes`,
  `displayedTypeGroups`, `LEGACY_TYPE_GROUPS`, `getCardTypes`).
- ✅ §16.4: Functions implicit-bounded by 00.6 reference.
- ✅ §16.5: 6 `// why:` comment locations specified (schema
  widening, fallback rationale, `Location` removal, `getCardTypes`
  call site, `CardType = string` alias, fallback-conditional).
- ✅ §16.6: Narrow subpath import enforced
  (`@legendary-arena/registry/schema`, never the barrel) per
  `glossaryClient.ts` precedent.
- ✅ §16.7: Full-sentence error messages (`[CardTypes] Rejected …`,
  `[CardTypes] Unknown slug: <value>`).

### §17 — Vision Alignment
- ✅ Triggered by §17.1 surfaces: card-data / content semantics
  (Vision §1, §2, §10) AND Registry Viewer public surfaces
  (Vision §10a).
- ✅ Vision clauses explicitly listed by number: §1, §2, §10,
  §10a, §11.
- ✅ Conflict assertion: `No conflict — this WP preserves all
  touched clauses.`
- ✅ Non-Goal proximity check present (NG-1..7 not crossed).
- ✅ Determinism preservation line present (N/A engine-side;
  viewer-side deterministic given fixed taxonomy + degraded-
  deterministic fallback).
- **Fix applied during lint:** §10a (Registry Viewer public
  surfaces) added to the cited clause list — was missing despite
  being a §17.1 trigger.

### §18 — Prose-vs-Grep Discipline
- ✅ Verification Step 6 greps for forbidden imports
  (`@legendary-arena/game-engine`, `@legendary-arena/preplan`,
  `boardgame\.io`, `apps/server`) under
  `apps\registry-viewer\src` — the WP file itself is at
  `docs/ai/work-packets/WP-086-…md`, NOT under the grep path.
  No risk of prose-vs-grep collision.
- ✅ AC items mention forbidden tokens (e.g., "No `from
  '@legendary-arena/game-engine'` import") but live in the WP
  file outside the grep path. No cross-pollution.

### §19 — Bridge-vs-HEAD Staleness Rule
- N/A — this WP is a forward-looking Work Packet, not a
  repo-state-summarizing artifact (not a session-context bridge,
  not a STATUS entry, not a post-mortem). §19 is a commit-time
  discipline for snapshot artifacts; does not apply at WP-draft
  time.

### §20 — Funding Surface Gate Trigger
- ✅ N/A declared with explicit one-line justification (per §20.1
  *"Applicability is declared, never inferred"*). Authority
  cited: WP-097 + D-9701 + D-9801.
- **Fix applied during lint:** `## Funding Surface Gate` block
  added with explicit N/A + justification + authority citation —
  was previously missing entirely. Tautological-placeholder rule
  (§20.1 paragraph 4) satisfied: justification names *why* none
  of the trigger surfaces apply (gameplay-terminology ribbon
  labels only; no donate / support / tournament-funding copy).

### Final Gate disposition
All 38 ❌ FAIL conditions in the 00.3 Final Gate table are
satisfied. The WP is **lint-PASS** and ready for promotion to
Ready once the four Open Questions (R2 upload coordination,
schema widening blast radius, `shared.test.ts` existence, emoji
rendering parity) are resolved at pre-flight.

### Lint fixes applied during self-review
1. File count corrected: "6 files" → "7 files" with cap-discipline
   note (§5).
2. DoD scope-boundary checkbox added (§15).
3. Vision clause §10a added to the cited list (§17).
4. `## Funding Surface Gate` N/A block added (§20).

No design intent changed. All four fixes tighten governance
compliance without expanding scope.
