# WP-111 — UIState Card Display Projection (Engine-Side)

**Status:** Draft (pre-flight 2026-04-29 PS-1..PS-10 applied; ready
for promotion to Ready pending re-verdict per pre-flight Authorized
Next Step section)
**Primary Layer:** Game Engine (`packages/game-engine/**`)
**Dependencies:** WP-089 (engine playerView wiring), WP-018 (`cardStats` precedent for setup-time registry snapshots), WP-014 (`villainDeckCardTypes` precedent for keyed lookups)

---

## Session Context

WP-018 established the `G.cardStats` pattern for setup-time registry
snapshots keyed by `CardExtId`, WP-014 established `G.villainDeckCardTypes`
for the same pattern, and WP-089 locked the `UIState` projection contract;
this packet adds a third sibling snapshot, `G.cardDisplayData`, that
surfaces card display fields (name, image URL, recruit cost, fight cost)
into UIState so the arena-client can render real cards instead of
`CardExtId` strings — without granting the client a runtime registry
import.

---

## Goal

After this session, `@legendary-arena/game-engine` builds a
`G.cardDisplayData: Readonly<Record<CardExtId, UICardDisplay>>` snapshot
at setup time and surfaces it through `buildUIState` so every `CardExtId`
visible in `UIState` (player hand, City spaces, HQ slots, Mastermind
tile, and any future card surface) carries enough display data for the
UI to render a real card — without granting the client a runtime
registry import. Specifically:

- The engine reads `name`, `imageUrl`, and the appropriate numeric cost
  source from the registry once at `Game.setup()` and snapshots them
  into `G.cardDisplayData`. `UICardDisplay.cost` is a single generic
  numeric field — its **semantic meaning** depends on card type:
  - **Heroes** — `name`, `imageUrl`, and `cost` (recruit cost) read from
    `registry.listCards()` filtered to `cardType === 'hero'`. Per-card
    `FlatCard.cost`, `FlatCard.name`, `FlatCard.imageUrl`. Parsed via
    the cost-null wrapper in §Locked contract values.
  - **Villains** — `name`, `imageUrl`, and `vAttack` walked via
    `registry.getSet(setAbbr).villains[i].cards[j]` (mirrors
    `buildCardStats:202–231`). The corresponding `FlatCard` (cardType
    `'villain'`, key `{setAbbr}-villain-{groupSlug}-{cardSlug}`) supplies
    `name` / `imageUrl`; `vAttack` is read from the SetData entry.
  - **Henchmen** — group-level `name`, `imageUrl`, and `vAttack` walked
    via `registry.getSet(setAbbr).henchmen[i]` (mirrors
    `buildCardStats:233–261`). Each group expands to 10 virtual entries
    `henchman-{groupSlug}-00` … `-09`, all sharing the group-level
    fields. **Henchmen are NOT in `FlatCard`** — `flattenSet()` emits
    only `hero | mastermind | villain | scheme` cardTypes; this branch
    must walk SetData directly.
  - **Mastermind** — base-card `name`, `imageUrl`, and `vAttack` walked
    via `registry.getSet(setAbbr).masterminds[i].cards[j]` (mirrors
    `mastermind.setup.ts:findMastermindCards`). The base-card ext_id is
    `{setAbbr}-mastermind-{mastermindSlug}-{baseCard.slug}` and matches
    `G.mastermind.baseCardId` exactly. Tactic cards are NOT projected in
    this packet (UIState exposes tactics as counts only — see §Card
    types NOT projected).
  - Gameplay never reads `UICardDisplay.cost` for cost gating —
    `G.cardStats` is the gameplay source of truth (see Locked contract
    values).
- `UIState` exposes the snapshot wherever a `CardExtId` appears today:
  `UIPlayerState.handCards` (plus `handDisplay`), `UICityCard`,
  `UIHQState.slots`, and `UIMastermindState`. The exact projection
  shape is locked in `## Scope` below.
- The arena-client (WP-100 and beyond) consumes the projection and never
  imports the registry at runtime. The Layer Boundary in
  `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` is preserved.
- The snapshot is JSON-serializable, deterministic at setup time, and
  read-only during gameplay — same invariants as `G.cardStats` and
  `G.villainDeckCardTypes`.

This WP delivers the engine-side projection only. The arena-client
consumption is a follow-up: WP-100 currently renders `CardExtId` strings
as labels; once this WP lands, WP-100's components (or a sibling polish
WP) bind to the new fields.

---

## Assumes

- WP-018 complete. Specifically:
  - `packages/game-engine/src/economy/economy.types.ts` exports
    `CardStatEntry { attack, recruit, cost, fightCost }`
  - `packages/game-engine/src/economy/economy.logic.ts` exports
    `buildCardStats(registry, config) → Record<CardExtId, CardStatEntry>`
  - `parseCardStatValue` strips trailing `*` / `+` modifiers and returns
    a number (per registry rules — `cost` / `attack` / `recruit` /
    `vAttack` may be `string | number | null | undefined` in raw data)
- WP-014 complete. Specifically:
  - `G.villainDeckCardTypes: Record<CardExtId, RevealedCardType>` is
    built at setup and read at move time without registry access
- WP-089 complete. Specifically:
  - `packages/game-engine/src/ui/uiState.types.ts` exports `UIState`,
    `UICityCard`, `UICityState`, `UIHQState`, `UIPlayerState`,
    `UIMastermindState`
  - `packages/game-engine/src/ui/uiState.build.ts` exports
    `buildUIState(G, ctx)` returning the projection
  - `packages/game-engine/src/ui/uiState.filter.ts` exports
    `filterUIStateForAudience(uiState, audience)` redacting opponent
    `handCards`
- `@legendary-arena/registry` exports `FlatCard` with fields `name`,
  `imageUrl`, `slug`, `setName`, `cardType`, `cost`, and `vAttack`;
  and (per the registry rules in `.claude/rules/registry.md`) numeric-
  ish fields `cost` / `attack` / `recruit` / `vAttack` widened to
  `string | number | null | undefined` in raw data
- The engine setup function already receives the registry (it does — see
  `buildCardStats(registry, config)` call site in
  `buildInitialGameState.ts`)
- `pnpm --filter @legendary-arena/game-engine build` exits 0
- `pnpm --filter @legendary-arena/game-engine test` exits 0
- `docs/ai/ARCHITECTURE.md` exists
- `docs/ai/DECISIONS.md` exists

If any of the above is false, this packet is **BLOCKED** and must not
proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — confirm the
  Registry → Game Engine direction. Registry feeds the engine **once** at
  setup; the engine never queries the registry at runtime. This packet
  follows that direction.
- `docs/ai/ARCHITECTURE.md §Architectural Principles` — re-read principle
  #3 (G is JSON-serializable, runtime-only) and the persistence boundary.
  `G.cardDisplayData` is runtime state, never persisted, and contains no
  functions or class instances.
- `.claude/rules/architecture.md §Layer Boundary` — enforces the Registry
  / Engine separation this packet must preserve.
- `.claude/rules/game-engine.md §Registry Boundary` — confirms the engine
  may receive the registry only at setup time. Move files and type files
  must never import the registry. This packet does not change that.
- `.claude/rules/registry.md §Card Field Data Quality` — `cost`,
  `attack`, `recruit`, and `vAttack` are widened to
  `string | number | null | undefined` in raw data. The projection must
  use the existing `parseCardStatValue` parser (or equivalent) for
  numeric fields and must preserve string fields (`name`, `imageUrl`)
  verbatim.
- `packages/registry/src/types/index.ts` — read entirely. `FlatCard` is
  the merged shape produced by `flattenSet()`. The fields this packet
  reads are: `name`, `imageUrl`, `cost` (hero recruit cost), `vAttack`
  (mastermind fight requirement) where applicable, plus the join key
  used by the engine.
- `packages/game-engine/src/economy/economy.logic.ts` — read entirely.
  `buildCardStats` is the canonical precedent for setup-time
  registry-to-G snapshots. This packet mirrors its structure for display
  data.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — read
  entirely. The setup pipeline already invokes `buildCardStats` and
  `buildVillainDeckCardTypes`; this packet adds a sibling
  `buildCardDisplayData` call in the same place.
- `packages/game-engine/src/ui/uiState.types.ts` — read entirely. Locks
  the existing UIState shape; this packet extends it without renaming
  any existing field.
- `packages/game-engine/src/ui/uiState.build.ts` — read entirely. This
  is the projection seam.
- `packages/game-engine/src/ui/uiState.filter.ts` — read entirely.
  Confirm that opponent-hand redaction continues to work after the
  projection extension.
- `docs/ai/REFERENCE/00.2-data-requirements.md` — confirm canonical
  field names for `name`, `imageUrl`, `cost` (registry side) and the
  `CardExtId` definition (engine side). The projection field names in
  this packet must match 00.2 exactly; no rename, no abbreviation.
- `docs/ai/REFERENCE/00.6-code-style.md` — key rules: Rule 4 (no
  abbreviations), Rule 5 (every function has JSDoc), Rule 6 (`// why:`
  on non-obvious decisions), Rule 7 (no `.reduce()` for branching), Rule
  8 (no dynamic property access for known keys), Rule 13 (ESM only).
- `docs/ai/DECISIONS.md` — scan for prior entries on `cardStats`,
  `villainDeckCardTypes`, `playerView`, UIState shape decisions, and any
  layer-boundary exceptions for the registry. The DoD requires this WP
  to log a new decision (sibling-snapshot pattern reaffirmed for
  display data); confirm no conflict.
- `docs/01-VISION.md §1, §2, §3, §10, §11, §22` — the `## Vision
  Alignment` section below asserts these clauses are preserved.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**

- Never use `Math.random()` — `ctx.random.*` is the only randomness
  source, and this packet introduces no randomness anywhere
- Never throw inside boardgame.io move functions — this packet does not
  modify any move
- Never persist `G`, `ctx`, or any runtime state — `G.cardDisplayData` is
  runtime-only, JSON-serializable, never written to any database, file,
  cache, or external store
- `G` must be JSON-serializable at all times — `UICardDisplay` contains
  only primitives (strings and numbers); no functions, Maps, Sets, Dates,
  Symbols, or class instances
- ESM only, Node v22+ — all new files use `import` / `export`, never
  `require`
- `node:` prefix on all Node.js built-in imports (`node:test`,
  `node:assert`, etc.)
- Test files use `.test.ts` extension — never `.test.mjs`
- No database or network access inside any helper or test
- Full file contents for every new or modified file in the output — no
  diffs, no snippets, no "show only the changed section"
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`

**Packet-specific:**

- `G.cardDisplayData` is built **once** at `Game.setup()` time from the
  registry; it is never mutated during gameplay. Tests must assert
  immutability (e.g., snapshot the map after setup, run a sequence of
  moves, assert the map is referentially equal or structurally
  identical).
- Only `Game.setup()` reads the registry. No move file, no rule hook,
  no projection function may import `@legendary-arena/registry`. The
  existing engine `Registry Boundary` invariant is reaffirmed.
- `UICardDisplay` exposes exactly four fields (the canonical sources
  are locked in §Locked contract values §Source-field map; this list
  is the four-field shape, not the field-source map):
  - `extId: string` — CardExtId (the join key, redundantly carried for
    UI convenience and drift-detection sanity)
  - `name: string` — display name (preserved verbatim from the
    canonical source per card type — `FlatCard.name` for heroes /
    villains / mastermind base card, group-level for henchmen; never
    trimmed, lowercased, or transformed)
  - `imageUrl: string` — full image URL (preserved verbatim from the
    canonical source per card type — `FlatCard.imageUrl` for heroes /
    villains / mastermind base card, group-level for henchmen; image
    URLs use hyphens per registry rules — never substitute
    underscores)
  - `cost: number | null` — parsed numeric cost via the
    `parseCostNullable` wrapper around `parseCardStatValue` (locked
    in §Locked contract values §Cost null-check semantics). Source
    fields per card type are locked in §Source-field map: heroes use
    `FlatCard.cost`; villains / henchmen / masterminds use
    `vAttack` from the canonical `getSet(...)` walks (NOT
    `FlatCard.vAttack` — `FlatCard` does not carry `vAttack`).
    `null` is the canonical "no cost shown" sentinel (registry value
    is genuinely null/undefined); `0` is "free" (registry value is
    integer 0).
- The four locked fields above are an exact set. Do not add `team`,
  `class`, `setName`, `cardType`, `attack`, `recruit`, `keywords`, or
  any other field in this packet. Each requires a separate WP with its
  own design rationale. Adding fields here is scope creep.
- `parseCostNullable(value)` (the single-line wrapper around
  `parseCardStatValue` defined in §Locked contract values) is the
  **only** entry point used for numeric cost fields in this packet.
  Do not call `parseCardStatValue` directly with raw registry values
  — the wrapper preserves the `null/undefined → null` UX
  distinction. Do not introduce any other parallel parser. Do not
  narrow `string | number | null | undefined` anywhere — the wrapper
  + canonical parser together handle widening and null-distinction.
- `G.cardDisplayData` is keyed by `CardExtId` — the same join key used
  by `G.cardStats` and `G.villainDeckCardTypes`. The WP author must
  read `buildCardStats` to confirm the canonical join key construction
  and reuse it. Do not invent a new key format.
- `buildUIState` is the only projection seam. Components in
  `apps/arena-client` consume `UIState` only — never `G.cardDisplayData`
  directly. The seam is preserved.
- `filterUIStateForAudience` continues to redact opponent `handCards`.
  Display data attached to redacted hands must be redacted along with
  them — there is no "leak display data while hiding card identity"
  intermediate state. Tests must assert this.
- `UICityCard`, `UIHQState.slots`, `UIPlayerState.handCards`, and
  `UIMastermindState` shapes are extended **additively** in this packet.
  Existing field names are preserved — `UICityCard.extId` /
  `UICityCard.type` / `UICityCard.keywords` remain. New fields are
  added; no renames.
- Drift-detection tests are mandatory: any new union or constant array
  introduced here (none expected, but if you add one) must have an
  exact-match test against its TypeScript type.
- `.reduce()` is forbidden for branching logic. Use `for` / `for...of`
  loops with descriptive variables for the registry walk.
- No `.reduce()` for the cardDisplayData map construction either —
  build via explicit `for...of` iteration over registry cards, mirror
  `buildCardStats`.

**Session protocol:**

- If the registry's `FlatCard` shape has changed since this packet was
  drafted (e.g., `imageUrl` was renamed, or `cost` became
  `recruitCost`), STOP. Do not work around it; the canonical name in
  00.2 must change first via a separate decision, then this packet
  updates.
- If the canonical CardExtId join key construction differs between
  `buildCardStats` and any other engine site, STOP and ask. The join
  key must be a single derivation rule across all sibling snapshots.
- If a card type (bystander, scheme-twist, mastermind-strike, scheme,
  henchman) has no entry in `FlatCard` (e.g., bystanders / scheme
  twists are typically generic and may not appear in `flattenSet()`
  output), STOP and ask before deciding the projection's behavior for
  that type. Do not silently fabricate display data.

**Locked contract values (do not paraphrase or re-derive):**

- **`UICardDisplay` shape** (lock — exactly four fields):
  - `extId: string`
  - `name: string`
  - `imageUrl: string`
  - `cost: number | null`
- **Source-field map** (verified 2026-04-29 against
  `packages/registry/src/types/index.ts`,
  `packages/game-engine/src/economy/economy.logic.ts`,
  `packages/game-engine/src/mastermind/mastermind.setup.ts`):
  - **Heroes** — read from `registry.listCards()` filtered to
    `cardType === 'hero'` and matched `setAbbr` / hero-deck slug
    (mirrors `buildCardStats:filterHeroCardsByDeckSlug`). Per-card
    `FlatCard`:
    - `FlatCard.name` → `UICardDisplay.name` (preserved verbatim)
    - `FlatCard.imageUrl` → `UICardDisplay.imageUrl` (preserved verbatim)
    - `FlatCard.cost` (`string | number | undefined`) → null-check then
      `parseCardStatValue` → `UICardDisplay.cost` (recruit cost)
  - **Villains** — read from `registry.getSet(setAbbr).villains[i].cards[j]`
    (mirrors `buildCardStats:findVillainGroupCards`). The matching
    `FlatCard` (key `{setAbbr}-villain-{groupSlug}-{cardSlug}`) supplies
    `name` / `imageUrl`; the SetData entry supplies `vAttack`:
    - `FlatCard.name` → `UICardDisplay.name`
    - `FlatCard.imageUrl` → `UICardDisplay.imageUrl`
    - `VillainCardEntry.vAttack` (`string | number | null`) → null-check
      then `parseCardStatValue` → `UICardDisplay.cost`
  - **Henchmen** — read from `registry.getSet(setAbbr).henchmen[i]` only
    (henchmen are NOT in `FlatCard`; `flattenSet()` does not emit them).
    Group-level `name`, `imageUrl`, `vAttack` apply to all 10 virtual
    copies (`henchman-{groupSlug}-00` … `-09`):
    - `HenchmanGroupEntry.name` → `UICardDisplay.name` (group-level)
    - `HenchmanGroupEntry.imageUrl` → `UICardDisplay.imageUrl` (group-level)
    - `HenchmanGroupEntry.vAttack` (`string | number | null | undefined`)
      → null-check then `parseCardStatValue` → `UICardDisplay.cost`
  - **Mastermind** — base card walked via
    `registry.getSet(setAbbr).masterminds[i].cards[j]` (the base card is
    classified per `mastermind.setup.ts:findMastermindCards`). The
    matching `FlatCard` (key
    `{setAbbr}-mastermind-{mastermindSlug}-{baseCard.slug}`) supplies
    `name` / `imageUrl`; the SetData entry supplies `vAttack`:
    - `FlatCard.name` → `UICardDisplay.name`
    - `FlatCard.imageUrl` → `UICardDisplay.imageUrl`
    - `MastermindCardEntry.vAttack` → null-check then
      `parseCardStatValue` → `UICardDisplay.cost`
- **Cost null-check semantics** (lock — preserves the UX distinction
  between "no cost shown" and "free"):
  - `UICardDisplay.cost = parseCostNullable(rawValue)` where
    `parseCostNullable(value: string | number | null | undefined): number | null`
    is a single-line guard:
    `return value === null || value === undefined ? null : parseCardStatValue(value);`
  - This is **NOT** a parallel parser — it is a guard around the
    canonical `parseCardStatValue` that distinguishes
    `null/undefined → null` (registry says "no cost") from
    `0 → 0` (registry says "free"). The canonical parser remains the
    only widener-handler for non-null values; star-modifier and
    plus-modifier strings still flow through it unchanged.
  - Lives at the top of `buildCardDisplayData.ts` with a `// why:`
    comment citing this clause and noting the pre-flight 2026-04-29
    PS-4 lock.
- **`G.cardDisplayData` key** (lock):
  `CardExtId` — same as `G.cardStats` and `G.villainDeckCardTypes`
- **Projection paths** (where `UICardDisplay` is surfaced — lock; **all
  additive after Q3 audit fallback per pre-flight 2026-04-29 PS-6**):
  - `UICityCard` extended with `display: UICardDisplay` (additive).
  - `UIHQState.slots: (string | null)[]` is **unchanged** (preserved
    verbatim). A parallel `UIHQState.slotDisplay?: (UIHQCard | null)[]`
    is **added**, where
    `UIHQCard = { extId: string; display: UICardDisplay }`. Length
    matches `slots` length when both present; positions align by index;
    `null` at position `i` means an empty slot (must match `slots[i] ===
    null`). Symmetric with `UIPlayerState.handDisplay`. This is the
    fallback-form locked during pre-flight Q3 written audit (see
    §Open Questions Q3 RESOLVED).
  - `UIPlayerState.handCards?: string[]` (already optional on the
    existing contract; preserved verbatim) for the CardExtId list; a
    parallel `UIPlayerState.handDisplay?: UICardDisplay[]` is **added**
    (length matches `handCards`, redacted when `handCards` is redacted
    by the audience filter). Keeps the wire shape additive and
    backwards-compatible — existing UI code that reads `handCards`
    continues to work; new UI code reads `handDisplay` for display
    fields.
  - `UIMastermindState` extended with `display: UICardDisplay`
    (additive). The display lookup uses `gameState.mastermind.baseCardId`
    (the canonical `G.cardStats` join key). `UIMastermindState.id`
    remains the qualified group id (e.g., `"core/dr-doom"`); no new
    `baseCardId` field surfaced to the UI — projection performs the
    lookup internally.
- **Determinism contract** (lock — canonical line; referenced
  elsewhere in this WP rather than re-stated): given an identical
  registry and identical setup config, `G.cardDisplayData` is
  byte-identical across runs. `JSON.stringify(G.cardDisplayData)`
  round-trips byte-equal. No new randomness, no wall-clock reads, no
  I/O are introduced in this packet at any time. Mirrors the
  determinism precedent set by `G.cardStats` (WP-018) and
  `G.villainDeckCardTypes` (WP-014).
- **Presentation vs. gameplay separation** (lock — non-overlapping
  responsibilities of the two snapshots):
  - `G.cardStats[*].cost` / `.fightCost` / `.attack` / `.recruit` —
    **gameplay**. Move validation, cost gating, KO predicates, and
    every rule hook MUST continue to read `G.cardStats`.
  - `UICardDisplay.cost` (and any future field on `UICardDisplay`) —
    **presentation only**. No move file, no rule hook, and no
    setup-time validator may consume `G.cardDisplayData` or
    `UIState.*.display` as a source of truth for cost validation. A
    grep verification step ensures `G.cardDisplayData` is read only
    from `uiState.build.ts`.
- **Snapshot type signature** (lock — signal immutability at the
  type boundary even though TypeScript does not enforce runtime
  immutability for `Record`):
  - `buildCardDisplayData` returns
    `Readonly<Record<CardExtId, UICardDisplay>>`
  - `LegendaryGameState.cardDisplayData` is typed
    `Readonly<Record<CardExtId, UICardDisplay>>`
  - The intent is documentational; tests still assert structural
    equality across the lifecycle to catch accidental mutation.
- **Card types projected** (lock — display data is built only for
  these card types in this packet):
  - `hero` (player hands, HQ, in-play, discard, victory)
  - `villain` (City, villain deck)
  - `henchman` (City, villain deck)
  - `mastermind` (Mastermind tile)
- **Card types NOT projected in this packet** (deferred):
  - `bystander`, `scheme-twist`, `mastermind-strike`, `scheme`, `wound`,
    `officer`, `sidekick`. These either have no per-card display data,
    are generic placeholders, or surface differently in UIState
    (`UISchemeState` already carries scheme identity). Deferred to
    follow-up WPs.
  - **Mastermind tactic cards** are also deferred. `UIMastermindState`
    today exposes tactics as counts only (`tacticsRemaining`,
    `tacticsDefeated`); no per-tactic surface exists in UIState. The
    base card is the only mastermind entry projected here. A future
    UI WP that surfaces individual tactic cards would expand this scope.
- **Projection-time purity contract** (lock — restores WP-028 D-2801
  invariant; pre-flight 2026-04-29 PS-8):
  - `buildUIState` MUST NOT mutate `G.messages` (or any other `G` field)
    when projecting display data. If a `CardExtId` in any zone is
    missing from `G.cardDisplayData`, the projection falls back to the
    `UNKNOWN_DISPLAY_PLACEHOLDER` constant — silently, without `G`
    mutation. The function-level "Forbidden behaviors" docstring on
    `buildUIState` (caching / closures-over-G / mutation via aliasing /
    side effects) is preserved verbatim.
  - The diagnostic surface for missing display entries lives at
    **setup time** in `buildInitialGameState.ts:161–182`, mirroring
    the four existing builder-guard messages (WP-113 D-10014 pattern).
    See §Scope (In) §D for the completeness sweep.
  - Aliasing prevention: every projection-time read of
    `G.cardDisplayData[extId]` MUST return a fresh shallow copy
    (`{...G.cardDisplayData[extId]}`) at the projection boundary, not
    a direct reference. Mirrors the WP-028 `cardKeywords` post-mortem
    aliasing fix. A test in `uiState.build.test.ts` MUST assert that
    mutating a returned `display` object does not affect
    `G.cardDisplayData`.

---

## Debuggability & Diagnostics

All behavior introduced by this packet must be debuggable via
deterministic state inspection.

The following requirements are mandatory:

- `G.cardDisplayData` is built once at setup and is referentially
  inspectable post-setup. Any test can call `Game.setup()` with a fixed
  config and assert the snapshot's contents.
- The snapshot is deterministic given a fixed registry and config — no
  randomness, no time, no I/O. Two setups with identical inputs produce
  byte-equal `G.cardDisplayData` maps (asserted via JSON deep-equal).
- The projection seam (`buildUIState`) is a pure function of `G` plus
  `ctx`. Its output is fully reproducible from a `G` snapshot.
- The audience filter (`filterUIStateForAudience`) is also pure and
  fully reproducible.
- Failures attributable to this packet must be localizable via:
  - missing key in `G.cardDisplayData` for a `CardExtId` that appears
    in any zone (asserted by an integration test that walks every
    zone in a setup and verifies every CardExtId has a display entry)
  - mismatched `name` / `imageUrl` against the registry source
    (asserted by a round-trip test)

---

## Scope (In)

### A) `UICardDisplay` type — extend `uiState.types.ts`

- **`packages/game-engine/src/ui/uiState.types.ts`** — modified:
  - Add new exported type `UICardDisplay`:
    ```ts
    /**
     * Display-safe card data projected once at setup time and surfaced
     * through UIState. Read-only. JSON-serializable. Contains only
     * primitive fields.
     *
     * // why: gives the UI enough to render a real card (name + image +
     * cost) without granting the client a runtime registry import.
     * Mirrors the G.cardStats / G.villainDeckCardTypes setup-snapshot
     * pattern (see WP-018, WP-014).
     */
    export interface UICardDisplay {
      extId: string;
      name: string;
      imageUrl: string;
      cost: number | null;
    }
    ```
  - Extend `UICityCard` to add `display: UICardDisplay` (additive).
    Existing fields (`extId`, `type`, `keywords`) are preserved.
  - Add new exported type `UIHQCard`:
    ```ts
    export interface UIHQCard {
      extId: string;
      display: UICardDisplay;
    }
    ```
  - **Keep `UIHQState.slots: (string | null)[]` UNCHANGED** (per
    pre-flight 2026-04-29 PS-6 / Q3 RESOLVED). Add an optional
    `slotDisplay?: (UIHQCard | null)[]` field with positions matching
    `slots` by index. `null` at position `i` means an empty slot and
    must match `slots[i] === null` exactly. Add `// why:` comment
    citing the parallel-array rationale (avoids breaking
    `apps/arena-client/src/components/play/HQRow.vue` + `HQRow.test.ts`
    which iterate `hq.slots` as bare strings; the breaking-change form
    would have required off-allowlist edits — see §Open Questions Q3).
  - Extend `UIPlayerState` to add an optional
    `handDisplay?: UICardDisplay[]`. Length matches `handCards` length
    when both are present. Redacted (undefined) when `handCards` is
    redacted by the audience filter. Add `// why:` comment citing the
    symmetric parallel-array pattern + WP-029 D-2902
    `exactOptionalPropertyTypes` precedent (use conditional assignment
    in projection / filter, not inline ternary).
  - Extend `UIMastermindState` to add `display: UICardDisplay` (additive).
    Existing fields (`id`, `tacticsRemaining`, `tacticsDefeated`) are
    preserved. The display lookup uses `gameState.mastermind.baseCardId`
    internally — `UIMastermindState.id` continues to expose the
    qualified group id only.

### B) `buildCardDisplayData` — new setup helper

- **`packages/game-engine/src/setup/buildCardDisplayData.ts`** — new:
  - Exported function signature uses `registry: unknown` (the
    established convention from `buildCardStats` and `buildCardKeywords`),
    plus a runtime guard. Do not introduce a new registry type alias:
    ```ts
    export function buildCardDisplayData(
      registry: unknown,
      config: MatchSetupConfig,
    ): Readonly<Record<CardExtId, UICardDisplay>>;
    ```
    The `Readonly<...>` wrapper is documentational — TypeScript does
    not enforce runtime immutability for `Record` values, but the type
    signal makes accidental writes from a downstream consumer visible
    at compile time and grep-able in review. Add a `// why:` comment
    explaining the `registry: unknown` choice (mirrors WP-018
    `buildCardStats` precedent; the layer boundary forbids
    `import type { CardRegistry } from '@legendary-arena/registry'` in
    engine setup files — local structural reader is the canonical
    workaround).
  - Define a local structural reader interface
    `CardDisplayDataRegistryReader` (or, if shape-compatible with
    `CardStatsRegistryReader`, reuse that one — preferred for
    deduplication). The reader exposes `listCards()` (for hero +
    mastermind FlatCard rows) and `getSet(abbr)` (for villain /
    henchman / mastermind SetData walks). Add a runtime type guard
    `isCardDisplayDataRegistryReader(registry: unknown)` that returns
    `false` on incomplete mocks; on guard failure, return `{}`
    gracefully (mirrors `buildCardStats:170–172`).
  - **Iteration plan** (mirrors `buildCardStats` structure exactly so
    sibling-snapshot consumers can reason about the two builders the
    same way):
    1. **Heroes** — filter `registry.listCards()` by `cardType === 'hero'`
       and matched `setAbbr` per `heroDeckId` (mirrors
       `filterHeroCardsByDeckSlug`). Emit one entry per hero card with
       `extId = card.key`, `name = card.name`, `imageUrl = card.imageUrl`,
       `cost = parseCostNullable(card.cost)`.
    2. **Villains** — for each `villainGroupId`, parse `<setAbbr>/<slug>`,
       walk `registry.getSet(setAbbr).villains[i].cards[j]` (mirrors
       `findVillainGroupCards`). For each villain card, find the
       matching `FlatCard` (mirrors `findFlatCardForVillain`) for `name`
       / `imageUrl`, and read `vAttack` from the SetData entry. Emit
       `{ extId: flat.key, name, imageUrl, cost: parseCostNullable(vAttack) }`.
    3. **Henchmen** — for each `henchmanGroupId`, parse
       `<setAbbr>/<slug>`, walk `registry.getSet(setAbbr).henchmen[i]`
       (mirrors `findHenchmanGroupVAttack`). Read group-level `name`,
       `imageUrl`, `vAttack`. Emit 10 entries per group with
       `extId = henchman-{groupSlug}-{NN}` (NN = `00` … `09`,
       zero-padded; mirrors `buildCardStats:248–260`), all carrying
       the group-level fields. **Henchmen are not in `FlatCard`;
       `flattenSet()` does not emit them.** This branch must never
       attempt `registry.listCards()` for henchman data.
    4. **Mastermind** — parse `mastermindId` (`<setAbbr>/<slug>`), walk
       `registry.getSet(setAbbr).masterminds[i]` to find the matching
       group, classify cards as base or tactic via the same logic as
       `mastermind.setup.ts:findMastermindCards` (read from there if
       it is exported, otherwise mirror its logic locally). Find the
       matching `FlatCard` for the base card (key
       `{setAbbr}-mastermind-{mastermindSlug}-{baseCard.slug}`) for
       `name` / `imageUrl`, and read `vAttack` from the base card's
       SetData entry. Emit one entry for the base card; skip tactic
       cards (deferred — see §Card types NOT projected).
  - Use `parseCostNullable(value)` (the wrapper defined in §Locked
    contract values — null-check then `parseCardStatValue`) for every
    numeric cost field. Do NOT call `parseCardStatValue` directly on
    raw registry values — always go through the wrapper.
  - Use `for...of` iteration. No `.reduce()`.
  - Add `// why:` comment on the function header citing the
    setup-snapshot pattern (sibling to `G.cardStats` per WP-018,
    `G.villainDeckCardTypes` per WP-014B, `G.cardKeywords` per WP-025).
  - Add `// why:` comment on the `parseCostNullable` wrapper definition
    explaining: the registry's raw `cost` / `vAttack` may be
    `string | number | null | undefined`; `parseCardStatValue` returns
    `0` for null/undefined which conflates "registry says no cost"
    with "registry says free"; the wrapper preserves the UX
    distinction without introducing a parallel parser. Cite pre-flight
    2026-04-29 PS-4.
  - Add `// why:` comment on the runtime guard explaining the
    layer-boundary precedent (mirrors `buildCardStats:170–172`).

### C) `buildCardDisplayData` test coverage

- **`packages/game-engine/src/setup/buildCardDisplayData.test.ts`** —
  new — `node:test` coverage:
  - Given a fixture registry and a fixture `MatchSetupConfig`, the
    builder produces an entry for every CardExtId in heroes / villains /
    henchmen / mastermind base card.
  - String fields (`name`, `imageUrl`) match the registry verbatim.
  - Numeric `cost` is parsed via `parseCostNullable` correctly:
    - `0` (integer) → `0` (preserved — distinct from `null`)
    - `3` (integer) → `3`
    - `"2*"` (star-cost) → `2`
    - `"2+"` (plus-modifier) → `2`
    - `null` → `null`
    - `undefined` → `null`
  - Henchman expansion: a single `henchmanGroupId` yields exactly 10
    entries with extIds `henchman-{groupSlug}-00` … `-09`, all sharing
    the group-level `name` / `imageUrl` / `cost`.
  - Mastermind base card: one entry with extId
    `{setAbbr}-mastermind-{mastermindSlug}-{baseCard.slug}` matching
    `G.mastermind.baseCardId` exactly. No tactic-card entries.
  - Layer-boundary guard: a narrow mock registry (e.g., only
    `listCards()`, no `getSet`) triggers the runtime guard's empty-record
    fallback (`{}` returned). Test asserts no throw.
  - Drift sanity: every entry's `extId` field matches its map key.
  - Determinism: calling the builder twice with identical inputs
    produces deeply-equal output.
  - JSON serialisation: `JSON.stringify(buildCardDisplayData(...))`
    succeeds and round-trips.
  - No `boardgame.io` import in the test file.
  - No `@legendary-arena/registry` import in the test file (use a
    structural mock that satisfies the local reader interface).
  - Uses `node:test` and `node:assert` only.
  - Uses `makeMockCtx` only if needed (probably not — this is a pure
    setup-time helper that does not consume `ctx`).

### D) Wire the builder into setup

- **`packages/game-engine/src/setup/buildInitialGameState.ts`** —
  modified (PS-7 + PS-8):
  - Import `buildCardDisplayData` and `isCardDisplayDataRegistryReader`
    (or reuse `isCardStatsRegistryReader` if the readers are
    shape-compatible).
  - Call `buildCardDisplayData(registry as unknown, config)` after
    `buildCardStats` (ordering doesn't matter for correctness, but
    mirror placement for readability).
  - Add the result to the returned `G` object as `cardDisplayData`.
  - Add `// why:` comment citing the setup-snapshot pattern (sibling
    to `cardStats` / `cardKeywords` / `villainDeckCardTypes`).
  - **Add a new setup-message guard at lines 161–182** matching the
    four existing builder guards (`isVillainDeckRegistryReader`,
    `isMastermindRegistryReader`, `isSchemeRegistryReader`,
    `isHeroAbilityRegistryReader`):
    ```ts
    if (!isCardDisplayDataRegistryReader(registry)) {
      setupMessages.push(
        'buildCardDisplayData skipped: the registry-reader interface is incomplete (listCards / getSet missing or not functions). Verify that setRegistryForSetup(registry) was called at server startup, or that the test mock implements the full reader interface.',
      );
    }
    ```
  - **Add a one-shot completeness sweep AFTER `buildCardDisplayData`
    returns** (PS-8 setup-time diagnostic surface — replaces the
    rejected projection-time mutation):
    - Walk the configured zones (every hero ext_id from the resolved
      hero deck cards, every villain ext_id from `cardStats`, the 10
      henchman virtual ext_ids per `henchmanGroupId`, the mastermind
      `baseCardId` once it is computed by `buildMastermindState`) and
      check membership in `cardDisplayData`.
    - If any expected extId is missing, push **one** consolidated
      diagnostic to `setupMessages` naming (a) which builder
      under-emitted, (b) the missing extId(s) — list them, do not
      truncate, (c) how to fix (verify registry-reader interface,
      re-check `setRegistryForSetup` wiring). Single message per
      setup, never per-card.
    - The completeness sweep itself is a pure helper (e.g.,
      `auditCardDisplayDataCompleteness`) that returns a string or
      `null`; the orchestrator pushes the string into `setupMessages`
      if non-null.
    - Add `// why:` comment citing the WP-113 D-10014 pattern (single
      diagnostic detection seam at orchestration site; defense-in-depth
      for builder-internal `isXRegistryReader → empty` paths).
  - **No other changes.** Do not refactor existing setup code.

### E) Add `cardDisplayData` to `LegendaryGameState`

- **`packages/game-engine/src/types.ts`** — modified:
  - Add `cardDisplayData: Readonly<Record<CardExtId, UICardDisplay>>`
    to `LegendaryGameState`. The `Readonly<...>` mirrors the builder
    return type; intent is documentational, not runtime-enforced.
  - Add a JSDoc field comment citing the WP-014 / WP-018 sibling
    snapshot pattern.
  - **No other changes** to `LegendaryGameState`. No reordering, no
    other field additions.

### F) Surface display data in `buildUIState`

- **`packages/game-engine/src/ui/uiState.build.ts`** — modified (PS-8
  preserves WP-028 D-2801 projection-purity contract):
  - For each player projected: when `handCards` is populated, also
    populate `handDisplay` by mapping each CardExtId through
    `G.cardDisplayData` with a fresh shallow copy per entry
    (`{...G.cardDisplayData[extId]}`). Length must match `handCards`.
    Use conditional assignment (per WP-029 D-2902
    `exactOptionalPropertyTypes` precedent), not inline ternary. Add
    `// why:` comment citing the length-equals-`handCards` invariant
    and the spread-copy aliasing prevention.
  - For each City space: when the space is occupied, populate the new
    `display` field on `UICityCard` from `G.cardDisplayData` with a
    fresh shallow copy.
  - For each HQ slot: keep `slots: (string | null)[]` projection
    unchanged (preserved verbatim from current `buildUIState`). Add
    a parallel `slotDisplay: (UIHQCard | null)[]` projection: for each
    occupied slot at index `i`, emit
    `{ extId: slotExtId, display: {...G.cardDisplayData[slotExtId]} }`;
    for empty slots emit `null`. The two arrays MUST have the same
    length and align by index. Use conditional assignment when
    populating `slotDisplay` so it is `undefined` rather than an empty
    array if no slots have display data resolution (rare; covered by
    completeness sweep at setup).
  - For the Mastermind: populate `display` from `G.cardDisplayData`
    keyed by `gameState.mastermind.baseCardId` (per pre-flight
    2026-04-29 PS-5 lock). Use a fresh shallow copy.
  - If a CardExtId in any zone is missing from `G.cardDisplayData`,
    fall back to the `UNKNOWN_DISPLAY_PLACEHOLDER` constant exported
    from this file. Locked literal:
    `{ extId, name: '<unknown>', imageUrl: '', cost: null }`. Inline
    the placeholder literal **nowhere else** — the named constant is
    the single grep target for audit, and centralizing it prevents
    per-call-site drift.
  - **`buildUIState` MUST NOT mutate `G.messages`** (or any other `G`
    field) when handling a missing entry. The missing-entry diagnostic
    surface lives at SETUP TIME in `buildInitialGameState.ts:161–182`
    (per §D completeness sweep). The projection-time fallback is a
    pure render path with no `G` interaction. The function-level
    "Forbidden behaviors" docstring on `buildUIState` is preserved
    verbatim — caching / closures-over-G / mutation via aliasing /
    side effects all remain forbidden.
  - Add a `// why:` comment at the `UNKNOWN_DISPLAY_PLACEHOLDER`
    constant declaration explaining the trade-off: a missing display
    entry is a setup-time invariant violation (covered by completeness
    sweep + drift tests at setup), but throwing at projection time
    would crash a spectator's UI for a state the engine considers
    recoverable. The placeholder is purely a render fallback; the
    diagnostic surface is at setup time. Tests must assert no
    placeholder appears for valid setups (a CI-visible regression
    target). Cite WP-028 D-2801 + pre-flight 2026-04-29 PS-8.
  - Add a `// why:` comment at every spread-copy site explaining the
    aliasing prevention (mirrors WP-028 `cardKeywords` post-mortem
    spread-copy fix).
  - Use `for...of` iteration. No `.reduce()`.

### G) Audience-filter parity for hand display

- **`packages/game-engine/src/ui/uiState.filter.ts`** — modified:
  - When `filterUIStateForAudience` redacts an opponent's `handCards`,
    it must also redact the corresponding `handDisplay` (omit it from
    the rebuilt player object — i.e., `redactHandCards` does not assign
    `handDisplay`; `preserveHandCards` conditionally assigns it when
    present, mirroring the existing `handCards` conditional assignment
    pattern at `uiState.filter.ts:54–72` per WP-029 D-2902
    `exactOptionalPropertyTypes` precedent). Add `// why:` comment
    citing the information-leakage constraint — exposing a card's
    display data is identical to exposing its CardExtId for opponent
    privacy purposes.
  - The City, HQ (`slots` AND `slotDisplay`), and Mastermind
    projections are public by definition — their `display` fields and
    the new `slotDisplay` array are not filtered. Use shallow copies
    of any new array fields in the result builder (mirrors the existing
    `[...uiState.city.spaces]`, `[...uiState.hq.slots]` pattern).

### H) Drift and integration tests

- **`packages/game-engine/src/ui/uiState.types.drift.test.ts`** —
  modified:
  - Assert `UICardDisplay` has exactly the four locked fields (`extId`,
    `name`, `imageUrl`, `cost`). Add `// why:` comment: failure means a
    field was added without governance.
  - Assert `UIHQCard` has exactly the two locked fields (`extId`,
    `display`).
  - Assert `UICityCard` retains its existing fields (`extId`, `type`,
    `keywords`) AND has the new `display` field.
  - Assert `UIHQState` retains its existing `slots: (string | null)[]`
    field (UNCHANGED) AND has the new optional
    `slotDisplay?: (UIHQCard | null)[]` field. Length-equality
    invariant (`slots.length === slotDisplay.length`) when both
    present is asserted at the projection-test level, not the type
    level.
  - Assert `UIPlayerState` retains its existing `handCards?: string[]`
    field (UNCHANGED) AND has the new optional
    `handDisplay?: UICardDisplay[]` field.
  - Assert `UIMastermindState` retains its existing fields (`id`,
    `tacticsRemaining`, `tacticsDefeated`) AND has the new `display`
    field.

- **`packages/game-engine/src/ui/uiState.build.test.ts`** — modified
  (extend existing tests; do not delete):
  - Existing tests pass unchanged.
  - New test: given a setup `G` with City, HQ, hand, and mastermind
    populated, every CardExtId has a `display` field with non-empty
    `name` and `imageUrl`.
  - New test: opponent `handCards` redaction also redacts
    `handDisplay`.
  - New test: City, HQ (`slots` AND `slotDisplay`), Mastermind `display`
    fields are not redacted by the audience filter (public
    information).
  - New test: HQ length-equality invariant — when `slotDisplay` is
    present, `slots.length === slotDisplay.length` and
    `slots[i] === null ⇔ slotDisplay[i] === null` for every index.
  - New test: setup-time determinism — two identical setups produce
    deeply-equal `UIState.players[*].handDisplay`,
    `UIState.city.spaces`, `UIState.hq.slotDisplay`,
    `UIState.mastermind.display`.
  - New test (PS-8 projection purity): `buildUIState` does NOT mutate
    `G.messages`. Construct a `G` with a deliberately missing display
    entry (e.g., a hand card not in `G.cardDisplayData`); assert that
    after `buildUIState(G, ctx)` returns, `G.messages` is unchanged
    (deep-equal to its pre-call snapshot) AND the projection contains
    `UNKNOWN_DISPLAY_PLACEHOLDER` for the missing entry.
  - New test (PS-8 setup-time diagnostic): with the same missing-entry
    fixture but constructed via `buildInitialGameState`, assert
    `G.messages` contains exactly one diagnostic naming the missing
    extId(s).
  - New test (aliasing prevention): mutating a `display` object
    returned in a `UIState` (e.g., `state.players[0].handDisplay![0].name = 'mutated'`)
    does NOT change `G.cardDisplayData[extId].name`.

---

## Out of Scope

- No client-side consumption of the new fields. The arena-client
  binding (showing card names / images / costs in `HandRow`, `CityRow`,
  `HQRow`, `MastermindTile`) is a follow-up UI WP. WP-100 currently
  renders CardExtId strings; that remains correct until the follow-up
  UI WP wires `display.name` / `display.imageUrl` / `display.cost`.
- No new card types projected. `bystander`, `scheme-twist`,
  `mastermind-strike`, `scheme`, `wound`, `officer`, and `sidekick` are
  deferred. Each has different display semantics that warrant
  separate design.
- No new fields on `UICardDisplay` beyond the four locked ones. No
  `team`, `class`, `setName`, `cardType`, `attack`, `recruit`, or
  `keywords`. Each requires a separate WP.
- No registry-side changes. `FlatCard` shape is unchanged. `flattenSet`
  is unchanged. Registry loaders are unchanged.
- No migration or persistence work. `G.cardDisplayData` is runtime-only.
- No move changes. `playCard`, `fightVillain`, `recruitHero`,
  `fightMastermind`, `drawCards`, `endTurn`, and all rule hooks remain
  unchanged. They continue to read `G.cardStats` for cost / fight-cost
  validation; they do not read `G.cardDisplayData`.
- No PostgreSQL changes. No `legendary.*` schema modifications.
- No server-side changes. `apps/server` is not modified.
- No registry-viewer changes.
- No styling, no UI design.
- No breaking change to `UIHQState.slots`. Per pre-flight 2026-04-29
  PS-6 (Q3 RESOLVED), the WP-111 §Locked contract values lock the
  parallel-array form: `slots: (string | null)[]` is unchanged;
  `slotDisplay?: (UIHQCard | null)[]` is added alongside. This
  preserves the 9-file allowlist (no off-allowlist edits to
  `apps/arena-client/src/components/play/HQRow.vue` or
  `HQRow.test.ts`). Existing UI code that reads `hq.slots` continues
  to work unchanged; new UI code reads `hq.slotDisplay` for display
  fields. The follow-up UI binding WP can choose to adopt
  `slotDisplay` or keep using `slots` — both remain supported.
- Refactors, cleanups, or "while I'm here" improvements are out of
  scope unless explicitly listed in Scope (In).

---

## Files Expected to Change

- `packages/game-engine/src/ui/uiState.types.ts` — **modified** —
  introduce `UICardDisplay`, `UIHQCard`; extend `UICityCard`,
  `UIHQState`, `UIPlayerState`, `UIMastermindState`
- `packages/game-engine/src/setup/buildCardDisplayData.ts` — **new** —
  setup-time registry-to-G snapshot builder
- `packages/game-engine/src/setup/buildCardDisplayData.test.ts` —
  **new** — `node:test` coverage for the builder
- `packages/game-engine/src/setup/buildInitialGameState.ts` —
  **modified** — wire builder into setup pipeline
- `packages/game-engine/src/types.ts` — **modified** — add
  `cardDisplayData` field to `LegendaryGameState`
- `packages/game-engine/src/ui/uiState.build.ts` — **modified** —
  surface display data through projection
- `packages/game-engine/src/ui/uiState.filter.ts` — **modified** —
  redact `handDisplay` alongside `handCards`
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` —
  **modified** — drift-detection assertions for new types
- `packages/game-engine/src/ui/uiState.build.test.ts` — **modified** —
  integration coverage for the projection extension

No other files may be modified.

That is **9 files** — at the lint-guideline soft limit. The packet is
intentionally tight. If during execution the WP author discovers a
tenth file must change (e.g., `playerInit.ts` happens to import
`UIPlayerState` and breaks), STOP and raise it as a blocker rather than
silently expanding scope.

---

## Acceptance Criteria

### Type definitions
- [ ] `uiState.types.ts` exports `UICardDisplay` with exactly four
      fields: `extId: string`, `name: string`, `imageUrl: string`,
      `cost: number | null`
- [ ] `uiState.types.ts` exports `UIHQCard` with exactly two fields:
      `extId: string`, `display: UICardDisplay`
- [ ] `UICityCard` retains existing `extId`, `type`, `keywords` AND has
      a new `display: UICardDisplay` field
- [ ] `UIHQState.slots` type is `(string | null)[]` (UNCHANGED — per
      pre-flight 2026-04-29 PS-6 / Q3 RESOLVED)
- [ ] `UIHQState` has new optional `slotDisplay?: (UIHQCard | null)[]`
- [ ] `UIPlayerState` retains existing `handCards?: string[]`
      (UNCHANGED) and has new optional `handDisplay?: UICardDisplay[]`
- [ ] `UIMastermindState` retains existing `id`, `tacticsRemaining`,
      `tacticsDefeated` AND has new `display: UICardDisplay`

### Setup snapshot
- [ ] `buildCardDisplayData(registry, config)` exists and returns
      `Readonly<Record<CardExtId, UICardDisplay>>`; its `registry`
      parameter is typed `unknown` (mirrors `buildCardStats`
      precedent — no new registry type alias introduced; layer
      boundary preserved)
- [ ] `isCardDisplayDataRegistryReader(registry)` runtime guard exists
      (or `isCardStatsRegistryReader` is reused if shape-compatible);
      builder returns `{}` gracefully on guard failure
- [ ] `parseCostNullable(value)` wrapper exists at the top of
      `buildCardDisplayData.ts`, distinguishing `null/undefined → null`
      from `0 → 0`; canonical `parseCardStatValue` is called
      unchanged for non-null values; no parallel parser introduced
- [ ] Builder iteration covers heroes via `listCards()`; villains and
      mastermind base card via `getSet(...).villains/masterminds`;
      henchmen via `getSet(...).henchmen` (10 virtual copies per
      group sharing group-level fields). Mirrors `buildCardStats`
      structure exactly.
- [ ] Builder is invoked once in `buildInitialGameState` and the result
      is stored in `G.cardDisplayData`
- [ ] Setup-orchestration guard message added at lines 161–182
      mirroring the four existing builder guards
- [ ] Setup-time completeness sweep emits a single consolidated
      diagnostic to `setupMessages` if any expected extId is missing
      from `cardDisplayData`; no per-card / per-zone messages
- [ ] `LegendaryGameState` exposes
      `cardDisplayData: Readonly<Record<CardExtId, UICardDisplay>>`
- [ ] No `boardgame.io` import in `buildCardDisplayData.ts` (confirmed
      with `Select-String`)
- [ ] No `@legendary-arena/registry` import in
      `buildCardDisplayData.ts` (confirmed with `Select-String`;
      uses local structural reader instead)
- [ ] No `Math.random` in `buildCardDisplayData.ts`
- [ ] No `.reduce()` in `buildCardDisplayData.ts`

### Projection
- [ ] `buildUIState` populates `display` on every occupied `UICityCard`
      via shallow copy (no aliasing with `G.cardDisplayData`)
- [ ] `buildUIState` keeps `hq.slots: (string | null)[]` projection
      UNCHANGED and populates a parallel `hq.slotDisplay` whose
      length and null-positions align with `slots` exactly
- [ ] `buildUIState` populates `handDisplay` for the viewing player
      with length matching `handCards`, via shallow copy per entry,
      using conditional assignment (per WP-029 D-2902
      `exactOptionalPropertyTypes` precedent)
- [ ] `buildUIState` populates `display` on `UIMastermindState` via
      `gameState.mastermind.baseCardId` lookup, with shallow copy
- [ ] **`buildUIState` does NOT mutate `G.messages` or any other `G`
      field** (PS-8; verified by grep + dedicated test)
- [ ] `UNKNOWN_DISPLAY_PLACEHOLDER` constant is exported from
      `uiState.build.ts` with a `// why:` comment justifying the
      pure-render fallback trade-off (citing WP-028 D-2801 +
      pre-flight 2026-04-29 PS-8); it is the only inline literal
      that produces `name: '<unknown>'` (grep-confirmed)
- [ ] No `display` field references the placeholder for any valid
      setup (asserted by an integration test that walks every zone)
- [ ] Aliasing prevention test: mutating any returned `display` /
      `slotDisplay[i]` / `handDisplay[i]` object does NOT mutate
      `G.cardDisplayData[extId]`

### Presentation vs. gameplay separation
- [ ] No file under `packages/game-engine/src/moves/**` reads
      `G.cardDisplayData` (Select-String verified)
- [ ] No file under `packages/game-engine/src/rules/**` reads
      `G.cardDisplayData` (Select-String verified)
- [ ] `G.cardDisplayData` is read only from `uiState.build.ts`
      (Select-String verified)

### Audience filter
- [ ] `filterUIStateForAudience` redacts opponent `handDisplay`
      whenever it redacts `handCards`, using conditional assignment
      (per WP-029 D-2902 `exactOptionalPropertyTypes` precedent)
- [ ] City `display`, HQ `slotDisplay`, and Mastermind `display`
      fields are NOT redacted (public information; passed through
      via shallow copy to prevent aliasing with input UIState)

### Drift detection
- [ ] `UICardDisplay` field set is asserted exact in
      `uiState.types.drift.test.ts`
- [ ] `UIHQCard` field set is asserted exact
- [ ] `UIHQState` retains existing `slots: (string | null)[]`
      AND has new optional `slotDisplay?: (UIHQCard | null)[]`
      (asserted)
- [ ] `UIPlayerState` retains existing `handCards?: string[]`
      AND has new optional `handDisplay?: UICardDisplay[]` (asserted)

### Determinism
- [ ] Two `Game.setup()` calls with identical config and identical
      registry produce deeply-equal `G.cardDisplayData`
- [ ] `JSON.stringify(G.cardDisplayData)` round-trips identically

### Layer boundary
- [ ] No move file (`packages/game-engine/src/moves/**`) imports
      `@legendary-arena/registry` (confirmed with `Select-String`)
- [ ] No file under `packages/game-engine/src/ui/**` imports
      `@legendary-arena/registry`
- [ ] Only setup-time files (`buildInitialGameState.ts`,
      `buildCardDisplayData.ts`, and existing setup files) read the
      registry

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0 (all
      test files including new and modified ones)
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] No test imports `boardgame.io` (only `node:test` and
      `node:assert`)
- [ ] No test imports `@legendary-arena/registry` (uses local
      structural mocks)
- [ ] Cost-parsing test covers integer 0 → 0 (preserved, distinct
      from null), integer 3 → 3, star-cost "2*" → 2, plus-modifier
      "2+" → 2, null → null, undefined → null
- [ ] Henchman expansion test: one `henchmanGroupId` produces 10
      entries (`henchman-{groupSlug}-00` … `-09`) sharing
      group-level fields
- [ ] Mastermind base-card test: one entry per match with extId
      matching `G.mastermind.baseCardId` exactly
- [ ] Layer-boundary guard test: narrow registry mock triggers
      empty-record fallback without throwing
- [ ] Projection-purity test: `buildUIState` does NOT mutate
      `G.messages` even when `G.cardDisplayData` is missing entries
- [ ] Setup-time diagnostic test: missing-entry fixture produces
      one consolidated diagnostic in `G.messages`
- [ ] Aliasing prevention test: mutating returned `display` does
      not mutate `G.cardDisplayData[extId]`

### Scope Enforcement
- [ ] No files outside `## Files Expected to Change` were modified
      (confirmed with `git diff --name-only`)
- [ ] No moves modified
- [ ] No registry package modified

---

## Verification Steps

```pwsh
# Step 1 — build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0, no TypeScript errors

# Step 2 — full test run
pnpm --filter @legendary-arena/game-engine test
# Expected: TAP output — all tests passing, 0 failing

# Step 3 — confirm no registry import in moves
Select-String -Path "packages\game-engine\src\moves\*.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 4 — confirm no registry import in UI projection
Select-String -Path "packages\game-engine\src\ui\*.ts" -Pattern "@legendary-arena/registry"
# Expected: no output

# Step 5 — confirm no Math.random
Select-String -Path "packages\game-engine\src\setup\buildCardDisplayData.ts", "packages\game-engine\src\ui\uiState.build.ts" -Pattern "Math\.random"
# Expected: no output

# Step 6 — confirm no .reduce in new code
Select-String -Path "packages\game-engine\src\setup\buildCardDisplayData.ts" -Pattern "\.reduce\("
# Expected: no output

# Step 6a — confirm presentation/gameplay separation (no move or rule
# file reads G.cardDisplayData)
Select-String -Path @("packages\game-engine\src\moves","packages\game-engine\src\rules") -Pattern "cardDisplayData" -Recurse
# Expected: no output

# Step 6b — confirm placeholder literal is centralized in the
# UNKNOWN_DISPLAY_PLACEHOLDER constant and not inlined anywhere else
Select-String -Path "packages\game-engine\src" -Pattern "<unknown>" -Recurse
# Expected: exactly one match (the constant declaration in uiState.build.ts)

# Step 6c — confirm buildUIState does NOT mutate G.messages (PS-8
# projection-purity restoration; WP-028 D-2801 contract preserved)
Select-String -Path "packages\game-engine\src\ui\uiState.build.ts" -Pattern "messages\.push|messages\s*=|messages\[" -Recurse
# Expected: no output (G.messages is read-only at projection time —
# the existing `const log = [...gameState.messages];` shallow copy
# matches `\[\.\.\.gameState\.messages\]` and is excluded by the
# patterns above)

# Step 6d — confirm UIHQState.slots shape is UNCHANGED (PS-6 fallback)
Select-String -Path "packages\game-engine\src\ui\uiState.types.ts" -Pattern "slots:\s*\(string\s*\|\s*null\)\[\]"
# Expected: exactly one match (the existing UIHQState.slots line
# preserved verbatim)

# Step 7 — confirm registry layer unchanged
git diff --name-only -- packages/registry
# Expected: no output

# Step 8 — confirm server unchanged
git diff --name-only -- apps/server
# Expected: no output

# Step 9 — confirm no files outside scope changed
git diff --name-only
# Expected: only files listed in ## Files Expected to Change
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm --filter @legendary-arena/game-engine build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm -r build` exits 0 (full monorepo still builds)
- [ ] No `@legendary-arena/registry` import in any move or UI
      projection file (Select-String verified)
- [ ] No `Math.random` in any new file (Select-String verified)
- [ ] No `.reduce()` in `buildCardDisplayData.ts` (Select-String
      verified)
- [ ] Registry package unchanged (`git diff` verified)
- [ ] Server package unchanged (`git diff` verified)
- [ ] No files outside `## Files Expected to Change` were modified
- [ ] `docs/ai/STATUS.md` updated — what is now projected through
      UIState; what was previously bare CardExtId strings
- [ ] `docs/03.1-DATA-SOURCES.md §Setup-Time Derived Data (In-Memory)`
      updated — `G.cardDisplayData` row added alongside `G.cardStats`,
      `G.cardKeywords`, `G.villainDeckCardTypes`,
      `G.heroAbilityHooks`, `G.schemeSetupInstructions` (per
      pre-flight 2026-04-29 PS-12 governance follow-up)
- [ ] `docs/ai/DECISIONS.md` updated — at minimum (six new D-NNNN
      entries; ID range allocated at session close):
      - Why `cardDisplayData` is a sibling snapshot to `cardStats` /
        `villainDeckCardTypes` rather than extending `CardStatEntry`
        (separation of concerns: stats vs. display; gameplay reads
        `cardStats` only — UIState reads `cardDisplayData` only)
      - Why `UIPlayerState.handDisplay` is a parallel array rather
        than embedding `display` per hand card object (preserves
        backwards compatibility on `handCards: string[]`; consumers
        can opt into display fields)
      - **Why `UIHQState.slotDisplay` is a parallel array rather
        than widening `UIHQState.slots` to `(UIHQCard | null)[]`**
        (per pre-flight 2026-04-29 PS-6 / Q3 written audit:
        `apps/arena-client/src/components/play/HQRow.vue` and
        `HQRow.test.ts` are the only consumers of `hq.slots`;
        widening would require off-allowlist edits in WP-111's
        9-file lock; parallel-array form preserves the allowlist
        and matches the `handCards` + `handDisplay` precedent. Cite
        the audit verbatim in the DECISIONS.md entry.)
      - **Why `cost: number | null` uses a `parseCostNullable`
        wrapper around `parseCardStatValue`** (per pre-flight
        2026-04-29 PS-4: distinguishes `null/undefined → null`
        ("registry says no cost") from `0 → 0` ("free"); NOT a
        parallel parser — single-line guard around the canonical
        parser; preserves UX clarity for bystander / scheme cards
        that have no printed cost)
      - **Why a `UNKNOWN_DISPLAY_PLACEHOLDER` named constant +
        setup-time-diagnostic + projection-time-pure-fallback was
        chosen over either throw-on-missing OR projection-time
        `G.messages` mutation** (per pre-flight 2026-04-29 PS-8:
        recoverable spectator-UX trade-off preserved; **WP-028
        D-2801 projection-purity contract preserved** — diagnostic
        surface lives at setup time mirroring WP-113 D-10014
        pattern; projection-time fallback is pure render with no
        `G` interaction; tests assert no placeholder for valid
        setups AND `buildUIState` does not mutate `G.messages`)
      - Why bystander / scheme-twist / mastermind-strike / scheme /
        wound / officer / sidekick / mastermind tactic cards are
        deferred (different display semantics; warrant separate
        design; UI does not surface them today as individual cards)
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-111 checked off with
      today's date

---

## Vision Alignment

**Vision clauses touched:** §1 (Rules Authenticity), §2 (Content
Authenticity), §3 (Player Trust & Fairness), §10 (Content as Data),
§11 (Stateless Client Philosophy), §22 (Deterministic & Reproducible
Evaluation).

**Conflict assertion:** No conflict — this WP preserves all touched
clauses.

- §1 and §2 are upheld by surfacing canonical registry-sourced display
  fields without transformation. Card names and image URLs flow
  verbatim from the registry through the engine into UIState; no
  paraphrasing, no rebranding, no synthetic placeholder fields enter
  authoritative state for valid setups.
- §3 is preserved: the engine continues to own all gameplay state. The
  projection is read-only and contains no logic. Clients cannot use
  `display` data to bypass move validation — costs are validated by
  the engine via `G.cardStats`, not by the client via `display.cost`.
- §10 is advanced: this packet is the engine's mechanism for "content
  as data" reaching the UI without granting the UI a runtime registry
  seam. The Layer Boundary remains intact.
- §11 is preserved: the client remains stateless. `G.cardDisplayData`
  is server-side authoritative state, projected via `UIState`. The
  client does not cache, derive, or recompute display data; it
  re-renders from each frame.
- §22 is preserved: `G.cardDisplayData` is built deterministically at
  setup from a fixed registry and fixed config. Replays reconstruct
  the same map byte-for-byte. No randomness, no time, no I/O at
  projection time.

**Non-Goal proximity check (NG-1..7):** None of NG-1..7 are crossed.
This packet introduces no monetization, no cosmetic store, no
persuasive UI, no engagement-pattern dark surfaces, no paid
competitive lane, and no content gated behind purchase. Card display
data is functional content, not commercial surface.

**Determinism preservation (Vision §8, §22):** This WP introduces no
new randomness source, no wall-clock reads, and no I/O at projection
or move time. `G.cardDisplayData` is built once from deterministic
inputs (registry + config) and is read-only thereafter. Replay
faithfulness is preserved because the snapshot is part of `G` and is
reconstructed byte-equal from a replay's setup config.

---

## Open Questions (RESOLVED during pre-flight 2026-04-29)

1. **Mastermind cost field name.** **RESOLVED 2026-04-29 (pre-flight
   PS-2 / PS-5 / PS-10).** The mastermind fight-cost branch lives in
   `packages/game-engine/src/mastermind/mastermind.setup.ts:165–245`
   (function `buildMastermindState`), NOT in
   `packages/game-engine/src/economy/economy.logic.ts:buildCardStats`
   (which has no mastermind branch). The canonical source field is
   `MastermindCard.vAttack` on the **base** card (per-card, classified
   by `findMastermindCards`). The base-card ext_id is constructed at
   `mastermind.setup.ts:211` as
   `${setAbbr}-mastermind-${mastermindSlug}-${baseCard.slug}` and
   matches `G.mastermind.baseCardId` exactly. The display lookup uses
   `gameState.mastermind.baseCardId` (NOT `gameState.mastermind.id`,
   which is the qualified group id). Tactic cards are NOT projected
   in this packet (UIState exposes them as counts only). The builder
   walk path is path (a) — `findMastermindCards`-equivalent walk on
   `registry.getSet(setAbbr).masterminds[*]` for both `name`/`imageUrl`
   and `vAttack` in a single read.

2. **Bystander / scheme-twist / mastermind-strike display.**
   **RESOLVED 2026-04-29 (pre-flight PS-3).** Confirmed by reading
   `packages/registry/src/shared.ts`: `flattenSet()` emits
   `cardType: "hero" | "mastermind" | "villain" | "scheme"` only.
   Bystander, scheme-twist, mastermind-strike, wound, officer, and
   sidekick do NOT appear as `FlatCard` entries — exclusion is
   correct, no per-card display data is available for them in the
   registry today. **Henchmen also do not appear in `FlatCard`** —
   they require a `getSet(setAbbr).henchmen[*]` walk (mirrors
   `buildCardStats`). The §Locked contract values source-field map
   has been corrected to reflect this.

3. **HQ slot projection breaking change — consumer audit.**
   **RESOLVED 2026-04-29 (pre-flight PS-6) — fallback selected.**
   Pre-flight performed the written consumer audit. Result:
   - `apps/arena-client/src/components/play/HQRow.vue:60–80` is the
     sole runtime consumer of `hq.slots`. It iterates via
     `v-for="(cardId, hqIndex) in hq.slots"` and renders
     `{{ cardId }}` for occupied slots. Comment at lines 73–80
     explicitly notes "UIHQState.slots carries bare CardExtId strings
     (NOT the UICityCard shape used by City)."
   - `apps/arena-client/src/components/play/HQRow.test.ts` constructs
     a `FULL_HQ: UIHQState` fixture with bare strings and asserts on
     rendered text.
   - `packages/replay-*/**` does not exist as a separate package
     today; replay code lives under `packages/game-engine/src/replay/`
     and consumes `LegendaryGameState` directly, not `UIHQState`.
   - `apps/registry-viewer/**` is out-of-scope by layer rule (reads
     registry, not engine state) — confirmed by absence of
     `UIHQState` import.
   - Audit grep equivalent
     (`Select-String -Pattern "hq\.slots" -Path apps/,packages/`)
     surfaces no other readers beyond HQRow.vue + HQRow.test.ts.

   **Conclusion:** the breaking-change form (`slots: (UIHQCard | null)[]`)
   would require off-allowlist edits to two arena-client files,
   violating WP-111's 9-file scope lock. **Fallback parallel-array
   form selected:** `slots: (string | null)[]` UNCHANGED (preserved
   verbatim); `slotDisplay?: (UIHQCard | null)[]` added alongside.
   Existing UI code continues to work; new UI code can adopt
   `slotDisplay` opportunistically. The follow-up UI binding WP
   (forecast in §Drafting Notes) chooses which array to consume; no
   lockstep update required.

4. **Card image URL variability.** **RESOLVED 2026-04-29 (pre-flight
   PS-9).** Per registry rules in `.claude/rules/registry.md` and the
   existing Q4 spec, the simple "empty string passthrough" behavior
   is acceptable. `UICardDisplay.imageUrl` is `string` (not
   `string | null`). If a specific card has no `imageUrl` populated,
   the empty string flows through verbatim and the UI can choose to
   render a placeholder image based on cardType. No type-signature
   change; no placeholder URL constant. The completeness sweep at
   setup time will surface any missing-extId problem; missing
   imageUrl on a present extId is a registry data-quality issue
   handled separately by `pnpm validate`.

---

## WORK_INDEX Note

When this WP is promoted from Draft to Ready, add it to
`docs/ai/work-packets/WORK_INDEX.md` in the appropriate phase section
with:

- **Dependencies:** WP-089, WP-018, WP-014A/B, WP-100, WP-113
- **Notes:** Engine-side projection of card display data (name, image,
  cost) into UIState. Sibling snapshot to `G.cardStats` /
  `G.villainDeckCardTypes` / `G.cardKeywords`. Resolves WP-100
  D-10004 (registry projection deferred). UI binding to the new
  fields is a follow-up WP. **Fully additive** — no breaking change
  to `UIHQState.slots` (parallel-array `slotDisplay?` added per
  pre-flight 2026-04-29 PS-6). 9-file allowlist preserved.
  Projection-purity contract from WP-028 D-2801 preserved
  (PS-8 — diagnostic surface lives at setup time, not projection
  time). Cost semantics distinguish `null/undefined → null` from
  `0 → 0` via `parseCostNullable` wrapper around the canonical
  `parseCardStatValue` (PS-4 — not a parallel parser).

---

## Drafting Notes (Delete When Promoting To Ready)

- Drafted 2026-04-26 in response to WP-100's Open Question Q1. The
  recommended option (a) is implemented here: extend the engine's
  `playerView` to embed display data per visible card.
- Open Questions Q1–Q4 above must be answered before promotion to
  Ready. Q1 is a quick verification (read the mastermind branch of
  `buildCardStats`); Q2 is a registry-shape verification; Q3 is a
  written consumer audit (recorded in this WP or a cited
  `DECISIONS.md` entry — not just an asserted assumption); Q4 is a
  data-quality spot check.
- Governance polish (2026-04-28): added the canonical determinism
  contract line, the presentation-vs-gameplay separation lock, the
  `Readonly<...>` snapshot type signal, the
  `UNKNOWN_DISPLAY_PLACEHOLDER` constant centralization, and the
  explicit Q3 consumer-audit checklist. No design intent changed —
  these are clarifications that make execution under EC-118 a binary
  compliance check.
- **Governance polish (2026-04-29 — pre-flight + copilot check):**
  pre-flight at
  `docs/ai/invocations/preflight-wp111-uistate-card-display-projection.md`
  surfaced eight contract-fidelity findings (B-1..B-8) against the
  canonical code. PS-1..PS-10 applied here in-place as scope-neutral
  drift fixes:
  - **PS-1 / PS-3:** rewrote §Goal + §Locked contract values
    source-field map. `FlatCard` does not carry `vAttack`;
    `flattenSet()` emits only `hero | mastermind | villain | scheme`;
    villains / henchmen / masterminds source `vAttack` from
    `getSet(...)` walks. Henchmen are NOT in `FlatCard` at all —
    walked via `getSet(...).henchmen[*]` with 10 virtual copies
    sharing group-level fields.
  - **PS-2 / PS-5 / PS-10:** mastermind branch lives in
    `mastermind.setup.ts:165–245`, not `economy.logic.ts`. Locked
    the canonical mastermind walk + `baseCardId` join key. Q1
    RESOLVED.
  - **PS-4:** `parseCardStatValue` returns `0` for null/undefined,
    not `null`. Locked `parseCostNullable` single-line guard around
    the canonical parser to preserve the UX distinction between "no
    cost" and "free". NOT a parallel parser.
  - **PS-6:** Q3 written audit performed and recorded inline.
    `UIHQState.slots` widening would require off-allowlist edits
    (`HQRow.vue` + `HQRow.test.ts`); fallback parallel-array form
    locked (`slotDisplay?` added; `slots` unchanged). Q3 RESOLVED.
  - **PS-7:** runtime guard
    (`isCardDisplayDataRegistryReader` or reuse of
    `isCardStatsRegistryReader`) + setup-orchestration diagnostic at
    `buildInitialGameState.ts:161–182`. Mirrors the four existing
    builder guards (WP-113 D-10014 pattern).
  - **PS-8 (CRITICAL):** removed the projection-time `G.messages`
    mutation (would have broken WP-028 D-2801 projection-purity
    contract). Diagnostic surface moved to setup-time completeness
    sweep in `buildInitialGameState`. Projection-time
    `UNKNOWN_DISPLAY_PLACEHOLDER` fallback is now a pure render path
    with no `G` interaction. Aliasing prevention via per-entry shallow
    copies at every projection-time read of `G.cardDisplayData[extId]`.
  - **PS-9:** Q4 resolved as empty-string passthrough (no type
    change, no placeholder URL constant).
  - **PS-12 (governance follow-up):** added
    `docs/03.1-DATA-SOURCES.md §Setup-Time Derived Data` row to
    Definition of Done.

  None of the PS items expanded scope. The 9-file allowlist is
  preserved verbatim. The lint gate from the original draft remains
  satisfied (corrections narrow the WP rather than widen it). Once
  the pre-flight Authorized Next Step section logs PS resolution,
  the WP can promote from Draft to Ready without re-running pre-flight.
- Per `.claude/rules/work-packets.md`, this WP must pass the Prompt
  Lint Gate (`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`) before
  execution. Drafted to template structure but not yet lint-gated.
- **EC slot:** EC-111 is occupied by `EC-111-replay-storage-loader`
  (WP-103 retarget on 2026-04-25 per the EC-collision precedent).
  EC-117 is occupied by `EC-117-public-profile-page` (WP-102
  retarget on 2026-04-28). Per the locked numbering rule in
  `EC_INDEX.md` (EC-103 → EC-111; EC-101 → EC-114; EC-109 → EC-115;
  EC-102 → EC-117), this WP retargets to **EC-118** — the next free
  slot that does not shadow a known or imminent WP number.
- Numbered WP-111 because WP-100 / 101 / 102 / 103 are claimed,
  WP-104..108 are deferred placeholders for owner-profile / badges /
  avatar / integrity / funding work, WP-109 is team-affiliation
  (drafted 2026-04-26), and WP-110 is loosely earmarked in WP-109's
  WORK_INDEX note for "team-play attribution onto run records
  (provisionally WP-110+)". WP-111 avoids both claims.
- Recommended sequencing once promoted: land WP-100 first (renders
  CardExtId strings), then WP-111 (engine projection), then a small
  follow-up UI WP that updates WP-100's components to bind to the new
  fields. The follow-up is trivial — five `<button>` labels change
  from `{{ cardId }}` to `{{ display.name }}` and gain `<img
  :src="display.imageUrl" />`. It is not in this packet because
  scoping it here would re-open WP-100's lint-gated scope.
