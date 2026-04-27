# WP-113 — Engine-Server Registry Wiring + Match-Setup Validator / Builder ID Alignment

**Status:** Draft (drafted 2026-04-27 in response to WP-100 smoke-test discovery; pre-flight pending)
**Primary Layer:** Server (`apps/server/src/server.mjs`) + Game Engine (`packages/game-engine/src/matchSetup.validate.ts` + four setup helpers under `packages/game-engine/src/{villainDeck,mastermind,scheme,setup}/*setup*.ts`)
**Dependencies:** WP-004 (server bootstrap), WP-014 / WP-015 (villain deck setup), WP-007 (mastermind setup), WP-005 (initial game state), WP-100 (the smoke test that surfaced this gap)

---

## Session Context

WP-100's smoke test on 2026-04-27 surfaced two coupled failures that
together render every match created today structurally empty:

1. **Server never wires the registry into `Game.setup()`.** The server
   loads the card registry at startup
   ([server.mjs:43-69](apps/server/src/server.mjs)) but does NOT call
   `setRegistryForSetup(registry)` ([game.ts:37](packages/game-engine/src/game.ts)),
   so `gameRegistry` inside the engine stays `undefined`. As a
   consequence:
   - `validateMatchSetup` is **silently skipped** by the
     `if (gameRegistry) { ... }` guard at
     [game.ts:201-210](packages/game-engine/src/game.ts) — any
     match-setup payload, valid or not, passes through to
     `buildInitialGameState`.
   - `buildInitialGameState` falls back to `EMPTY_REGISTRY`
     ([game.ts:217](packages/game-engine/src/game.ts)) which the four
     setup helpers (`buildVillainDeck`, `buildMastermindState`,
     `buildSchemeSetupInstructions`, hero-deck construction) all
     interpret as "registry not provided → return empty/minimal state
     silently."
2. **Validator and builder disagree about ID format AND bare slugs
   are ambiguous across sets.** Even when the registry is wired
   (e.g., in test contexts that bypass server wiring),
   `validateMatchSetup` builds its `knownExtIds` set from
   `registry.listCards()` keys ([matchSetup.validate.ts:82-88](packages/game-engine/src/matchSetup.validate.ts))
   — full flat-card keys like `core-villain-brotherhood-blob` — and
   rejects any field entry not in that set. `buildVillainDeck`
   ([villainDeck.setup.ts:165-175](packages/game-engine/src/villainDeck/villainDeck.setup.ts))
   expects `villainGroupIds` to contain **bare group slugs** like
   `brotherhood`. The two surfaces are contradictory.

   **And both formats are wrong** — bare slugs collide across sets
   in the actual registry data. Empirical probe 2026-04-27:
   - **23 / 279 hero slugs** appear in 2+ sets. `black-widow` exists
     in `3dtc`, `bkwd`, `core`, `msp1`. `hulk` in 3 sets.
     `captain-america` / `thor` / `deadpool` / `wasp` / `ant-man` /
     `nova` all collide.
   - **11 / 584 mastermind slugs** collide. `loki` in `core` +
     `msp1` plus four stage-variant slugs.
   - **4 villain group slugs** collide
     (e.g., `enemies-of-asgard` in `core` + `msp1`).
   - **2 scheme slugs** collide
     (`super-hero-civil-war` in `core` + `msp1`).

   Even with a perfectly-aligned validator-vs-builder contract, a
   bare-slug ID like `villainGroupIds: ['brotherhood']` would be
   nondeterministic the moment two sets ship a `brotherhood` group
   and both are loaded. Ranking-affecting state determinism (Vision
   §22) requires that match-setup IDs deterministically resolve to
   exactly one card collection.

   **The correct contract is set-qualified slugs.** Every entity ID
   in `MatchSetupConfig` (scheme, mastermind, villain group, henchman
   group, hero) takes the form `<setAbbr>/<slug>` — e.g.,
   `core/brotherhood`, `wwhk/black-widow`,
   `core/midtown-bank-robbery`. The format collapses three failure
   modes into one: collision-free across sets, parser-trivial for
   builders (single `string.split('/')`), and validator-checkable in
   two independent existence checks (set exists; slug exists in that
   set).

The combined effect: every match created via the lobby today builds
with `G.villainDeck.deck = []`, `G.mastermind = <minimal empty
state>`, `G.cardStats = {}`, `G.hookRegistry = []`, etc. The match is
playable through the WP-100 click-to-play surface up to the point of
needing real card content (Reveal pulls nothing, Fight has no targets,
Recruit has no heroes). WP-100's eight smoke-test fix-forwards
(D-10006 → D-10013) closed every UI / dispatch / multi-active-player
gap on the WP-100 side; this WP closes the engine-server seam beneath
them so a created match actually has cards.

Out of scope for this WP: any ID-format choice that breaks existing
engine tests. The goal is a self-consistent end-to-end ID contract
that satisfies BOTH the validator AND the builders, AND surfaces
silent-failure paths loudly. The WP author may choose between two
shape-equivalent approaches at execution time:

- **(a) Validator delegates to builders.** `validateMatchSetup`
  imports `extractVillainGroupSlug` (and equivalents for henchman /
  scheme / mastermind / hero-deck) and accepts entries that any
  builder will accept. Pro: minimal blast radius; the builders stay
  authoritative. Con: validator needs to know each builder's slug
  conventions.
- **(b) Builders delegate to a shared ID-resolution layer.** A new
  module exports `resolveMatchSetupIdFormat()` returning a structural
  description of acceptable ID shapes per field. Both validator and
  builders consume it. Pro: single source of truth. Con: a real
  refactor across five files; harder to scope.

The WP author commits to (a) at pre-flight unless Open Question Q1
(below) determines (b) is necessary.

---

## Goal

After this session, every match created through the lobby's
`POST /games/legendary-arena/create` endpoint builds with a
**non-empty villain deck**, a **populated mastermind tactics deck**,
and **scheme setup instructions** that match the configured loadout.
`validateMatchSetup` runs successfully against the wired registry and
either accepts the loadout (deck construction proceeds) or rejects
it with an actionable per-field error message. Silent empty-state
fallbacks in the four setup helpers are converted to loud failures
(throw at setup OR push diagnostic entries to `G.messages` so the
HUD log surfaces them).

This unblocks WP-100's smoke test end-to-end: after this WP lands,
clicking **Reveal** in `start` stage with a real loadout actually
populates the City with a villain or henchman; clicking
**fightVillain** has a target; clicking **fightMastermind** has
tactics to defeat.

---

## Assumes

- WP-100 (revised execution 2026-04-27 + fix-forwards D-10006 → D-10013)
  is complete and shipped at HEAD.
- `apps/server/src/server.mjs` `startServer()` flow is the canonical
  startup path. The PAR gate, registry, and rules loaders all run
  before `Server()` returns; adding `setRegistryForSetup(registry)`
  immediately after the registry resolves is structurally safe.
- `packages/game-engine/src/index.ts` already exports
  `setRegistryForSetup` and `clearRegistryForSetup` (verified
  2026-04-27).
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts`
  exports `extractVillainGroupSlug` (verified — internal helper, may
  need to be promoted to an export for validator consumption).
- The card registry's `listCards()` returns flat cards with `.key`
  matching the pattern `<setAbbr>-<cardType>-<groupSlug>-<cardSlug>`
  for villains; similar conventions for other card types (verified
  via 2026-04-27 inspection).
- arena-client test baseline at session start: **182 / 17 / 0** (post
  WP-100 D-10013).
- game-engine test baseline at session start: **524 / 116 / 0** (post
  WP-100 D-10010 regression test).
- server test baseline at session start: **47 / 7 / 0** (post-WP-053).
- `pnpm -r build` exits 0.

If any of the above is false, this packet is **BLOCKED** and must
not proceed.

---

## Context (Read First)

Before writing a single line:

- `docs/ai/ARCHITECTURE.md §Layer Boundary (Authoritative)` — the
  server's role is "wiring layer only." Adding `setRegistryForSetup(registry)`
  to `server.mjs` is exactly that — wiring an existing engine-loaded
  resource into an engine-exposed configuration seam. No game logic
  enters the server.
- `.claude/rules/server.md` — confirms the server may "load immutable
  inputs at startup" and "wire `LegendaryGame` into boardgame.io
  `Server()`." Calling a registry-injection seam exposed by the
  engine fits this pattern.
- `.claude/rules/game-engine.md` — confirms `Game.setup()` is the only
  permitted throwing site in the engine. Validator failures already
  throw via the existing path at
  [game.ts:201-210](packages/game-engine/src/game.ts); silent
  empty-state fallbacks in the four setup helpers should also throw
  (or at minimum log to `G.messages`) per "Failures must be
  localizable via invariant violation or unexpected state mutation."
- `packages/game-engine/src/game.ts:37-39` — the
  `setRegistryForSetup` export and module-level `gameRegistry`
  holder. This is the contract surface.
- `packages/game-engine/src/game.ts:201-210` — the registry-existence
  guard around `validateMatchSetup`. WP-113 must NOT remove this
  guard (tests rely on it for setup-without-registry paths); only the
  server wiring closes the runtime gap.
- `packages/game-engine/src/matchSetup.validate.ts` — read entirely.
  The `buildKnownExtIds` function and the per-field validation loops
  are the surfaces that need to align with builder semantics.
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts` —
  `buildVillainDeck`, `extractVillainGroupSlug`,
  `filterVillainCardsByGroupSlug`, `isVillainDeckRegistryReader`. The
  `villainGroupIds` builder semantics live here.
- `packages/game-engine/src/mastermind/mastermind.setup.ts` —
  `buildMastermindState`, `isMastermindRegistryReader`. The
  `mastermindId` builder semantics live here. **Read the slug
  convention carefully** — it may be different from villain groups.
- `packages/game-engine/src/setup/buildSchemeSetupInstructions.ts`
  (or equivalent) — the `schemeId` builder semantics. Likely
  different again.
- `packages/game-engine/src/setup/buildInitialGameState.ts:160-170`
  — the call sites where each builder receives `config.<field>`.
  Confirms the ID shape that flows into each builder.
- `apps/server/src/server.mjs:43-126` — the `loadRegistry()` and
  `startServer()` functions. Wiring slot is between
  `loadRegistry()` resolving and `Server()` constructing.
- `docs/ai/DECISIONS.md` D-10006 → D-10013 — the eight WP-100
  smoke-test fix-forwards. WP-113 closes the ninth (and
  hopefully-last) gap.

---

## Non-Negotiable Constraints

**Engine-wide (always apply):**

- `Game.setup()` is the only permitted throwing site (per
  `.claude/rules/game-engine.md`). `validateMatchSetup` failures
  already route through this path. Surfaced silent-failure paths in
  the four setup helpers either (a) throw and let the existing
  catch in `setup()` handle propagation, OR (b) push diagnostic
  entries to `G.messages` and continue with empty state — author
  picks one path per helper at execution time and documents in
  DECISIONS. Mixing within one helper is forbidden.
- No new `LegendaryGameState` field. No `buildInitialGameState`
  shape change. No new `LegendaryGame.moves` entry. No new phase
  hook. **01.5 NOT INVOKED** — verified by the four-trigger check
  at AC time.
- No `boardgame.io` imports added to `matchSetup.validate.ts` or any
  setup helper. Existing imports stay as-is.
- No registry imports added to engine moves (registry is
  setup-time-only per existing architecture).
- All new tests use `node:test` and `node:assert` — no new test
  runner.
- ESM only. `node:` prefix on built-in imports.

**Packet-specific:**

- The server's `setRegistryForSetup(registry)` call MUST happen
  after `loadRegistry()` resolves and BEFORE the boardgame.io
  `Server({ games: [LegendaryGame], ... })` is constructed and/or
  starts accepting create requests. boardgame.io's setup invocation
  can fire as soon as the server begins serving, so the engine must
  already see the registry by then. The change must be a **minimal
  diff** — import addition + call site + `// why:` comment —
  with no unrelated refactors in server startup.
- `validateMatchSetup` retains its existing structural validation
  (9 fields present, types correct, counts non-negative). Only the
  registry-existence-check loops are restructured to recognize
  per-field canonical ID shapes (group slugs / scheme slugs /
  mastermind slugs / hero slugs / flat-card keys where applicable).
  Existing engine tests pass without modification (or with
  documented test-fixture updates where the fixture used the wrong
  ID shape — flagged in the validator-test JSDoc with a D-10014
  reference).
- `extractVillainGroupSlug` (currently a private helper in
  `villainDeck.setup.ts`) is promoted to a named export so
  `matchSetup.validate.ts` can consume it. Same for any
  henchman / mastermind / scheme / hero equivalents. The exports
  are type-stable (no signature change) and live alongside their
  existing builder. **The slug-extraction helpers are the single
  source of truth for ID format** — validator (option (a)) consumes
  them; builders remain authoritative. No new ID-resolution module
  is introduced.
- **Silent-failure surfacing minimum (locked).** When a setup
  builder must return empty/minimal state due to an unusable
  registry (the `isXRegistryReader → empty fallback` paths), a
  full-sentence diagnostic must be present in initial `G.messages`
  naming the gap and the remediation. **Implementation constraint:
  the diagnostic must be emitted during setup without changing any
  builder signature and without adding new state fields.** The WP
  does NOT prescribe *where* the push occurs — if a builder has
  access to `G.messages` (because it receives `G` directly), the
  push happens inside the builder; if a builder returns partial
  state to `buildInitialGameState` and never sees `G`, the
  orchestration site (which owns `G.messages`) emits the
  diagnostic on the builder's behalf. Pre-flight Q3 resolves the
  per-builder choice. Throwing instead of pushing is permitted but
  not required.
- No changes to `LegendaryGame.moves` registration, lobby phase
  configuration, or any UI code in `apps/arena-client/`. WP-113 is
  strictly server-wiring + engine-validation alignment + setup-
  diagnostic surfacing. The arena-client smoke test is the
  verification surface, not the change surface.

**Decision record:**

- **D-10014 is reserved for this WP.** It does not exist yet —
  WP-113 creates it during execution as part of the Definition of
  Done. All `// why:` comments referencing D-10014 must land in the
  same commit set as the decision entry (Commit B governance close,
  per the EC-113 sequencing). Pre-promotion drafts MAY reference
  D-10014 in WP / EC body text; runtime code MAY NOT reference
  D-10014 until the entry exists.

**Locked contract values (do not paraphrase or re-derive):**

- **Server-engine wiring sequence** (locked):
  1. `loadRegistry()` resolves → `registry` in scope
  2. `setRegistryForSetup(registry)` called immediately after
  3. `loadRules()` and `createParGate()` resolve in parallel
  4. `Server({ games: [LegendaryGame], ... })` constructed
  5. `server.run({ port })` — accepts requests
- **Set-qualified ID format (LOCKED).** All five entity-ID fields on
  `MatchSetupConfig` use the form `<setAbbr>/<slug>` — collision-free
  across sets, builder-parseable via a single `string.split('/')`,
  validator-checkable in two existence steps (set exists; slug
  exists in that set). Bare slugs and flat-card keys are BOTH
  rejected. The format is mandatory regardless of whether the slug
  happens to be unambiguous today — future set additions can
  introduce collisions and the format must be stable.

  Canonical examples (verify each against the registry at
  pre-flight; these are illustrative, not normative):
  - `schemeId: "core/midtown-bank-robbery"` — `<setAbbr>` is `core`,
    slug matches `setData.schemes[].slug`.
  - `mastermindId: "core/magneto"` — slug matches a mastermind
    entity slug, NOT a flat-card key.
  - `villainGroupIds: ["core/brotherhood", "core/hydra"]` — each
    entry is `<setAbbr>/<groupSlug>`.
  - `henchmanGroupIds: ["core/hand-ninjas"]` — same shape.
  - `heroDeckIds: ["core/spider-man", "wwhk/black-widow", ...]` —
    each entry is `<setAbbr>/<heroSlug>`. **Bare hero slugs are
    EXPLICITLY forbidden** — `black-widow` alone collides across
    `3dtc, bkwd, core, msp1` per 2026-04-27 empirical probe.

  Forbidden ID shapes (validator MUST reject with field-specific
  error messages naming the canonical form):
  - Display names (`"Black Widow"`, `"Captain America"`).
  - Bare slugs without set prefix (`"black-widow"`, `"brotherhood"`).
  - Flat-card keys (`"core-hero-black-widow-1"`,
    `"core-villain-brotherhood-blob"`).
  - Bare set abbreviations (`"core"` alone).
  - Empty strings, whitespace-only strings, paths with extra
    components (`"core/sub/black-widow"`).

  Error message contract (per `00.6 §11`): full sentence naming the
  rejected value, the field, the canonical form, and an example.
  E.g., `"heroDeckIds[2] rejected: \"black-widow\". Hero IDs must be
  set-qualified slugs in the form \"<setAbbr>/<heroSlug>\", e.g.,
  \"core/black-widow\" or \"wwhk/black-widow\"."`
- **Silent-failure surfacing minimum** (locked): each of the four
  setup helpers' early-return paths gains AT LEAST a `G.messages`
  entry with a full-sentence message naming what was skipped and
  why. The arena-client HUD already renders `G.messages` (via the
  log panel from WP-064), so the entry is observable in smoke
  testing. Throwing is permitted but not required.

---

## Scope (In)

### A) Server registry wiring — `apps/server/src/server.mjs`

- **`apps/server/src/server.mjs`** — modified (minimal diff):
  - Add `setRegistryForSetup` to the existing
    `import { LegendaryGame } from '@legendary-arena/game-engine'`
    line. The export already exists (verified 2026-04-27).
  - Inside `startServer()`, after `loadRegistry()` resolves and
    BEFORE the `Server({ games: [LegendaryGame], ... })` constructor
    call (or before the server is otherwise made ready to accept
    create requests, whichever is earlier), insert:
    ```js
    setRegistryForSetup(registry);
    ```
  - Add a `// why:` comment naming D-10014 and the WP-100 smoke-test
    discovery that surfaced the gap.
  - **Minimal diff** — import addition + call site + comment block.
    No other modifications to `server.mjs`. No changes to
    `index.mjs`, `rules/loader.mjs`, `par/parGate.mjs`, or any other
    server file. No structural reorganization of `startServer()`'s
    Promise.all / sequencing.

### B) Validator alignment — `packages/game-engine/src/matchSetup.validate.ts`

- **`packages/game-engine/src/matchSetup.validate.ts`** — modified:
  - The existing `buildKnownExtIds(registry)` function returns a
    `Set<string>` of flat-card keys. Keep it as-is (some
    flat-card-direct fields may still consume it; not used for the
    five entity-ID fields after this WP).
  - Add `parseQualifiedId(input: string): { setAbbr: string; slug:
    string } | null` — parses `<setAbbr>/<slug>` and returns null
    on any malformed input (empty string, no `/`, multiple `/`,
    empty parts, leading/trailing whitespace). Validator emits a
    "format" error before the existence check when parse fails.
  - Add five helpers, each returning `Set<string>` of fully-qualified
    `<setAbbr>/<slug>` IDs:
    - `buildKnownSchemeQualifiedIds(registry)`
    - `buildKnownMastermindQualifiedIds(registry)`
    - `buildKnownVillainGroupQualifiedIds(registry)`
    - `buildKnownHenchmanGroupQualifiedIds(registry)`
    - `buildKnownHeroQualifiedIds(registry)`
    Each iterates the registry's flat cards (or `getSet(...)`
    results for henchmen) and emits one entry per
    `(setAbbr, slug)` pair. The bare-slug extractors imported from
    builder modules (`extractVillainGroupSlug`, etc.) provide the
    slug half; the flat card's `setAbbr` field provides the
    set half.
  - Restructure the per-field validation loops. For each entity-ID
    field:
    1. Parse the entry as `<setAbbr>/<slug>`. If parse fails, emit
       a format error: `"<field>[<i>] rejected: \"<value>\". IDs
       must be set-qualified slugs in the form
       \"<setAbbr>/<slug>\", e.g., \"core/<example>\"."`
    2. If parse succeeds but the parsed ID is not in the
       corresponding `buildKnownXxxQualifiedIds` set, emit an
       existence error naming the parsed `setAbbr` and `slug`
       separately so the user can distinguish "set not loaded"
       from "slug not in that set."
  - Bare slugs (`black-widow`), display names (`Black Widow`), and
    flat-card keys (`core-hero-black-widow-1`) are ALL rejected by
    the parse step. The error message contract is locked above.

- **`packages/game-engine/src/villainDeck/villainDeck.setup.ts`** —
  modified:
  - Promote `extractVillainGroupSlug` from internal helper to a
    named export. No signature change.
  - Update `buildVillainDeck` to parse each `villainGroupIds` entry
    as `<setAbbr>/<groupSlug>` (use the same `parseQualifiedId`
    helper — exported from `matchSetup.validate.ts` and re-imported,
    OR re-implemented locally if cross-module imports are awkward;
    author's choice at execution time. The helper is small enough
    to safely duplicate if needed.) The deck-construction loop
    filters flat cards by BOTH `setAbbr` (top-level) AND the
    extracted `groupSlug` (within set), iterating only that set's
    cards. No accidental cross-set matches.
- **`packages/game-engine/src/mastermind/mastermind.setup.ts`,
  `packages/game-engine/src/setup/buildSchemeSetupInstructions.ts`,
  and the hero-deck setup file (located at pre-flight Q2)** —
  modified with the same pattern:
  - Promote bare-slug extractor to named export.
  - Parse `<setAbbr>/<slug>` at the builder boundary using
    `parseQualifiedId`.
  - Iterate the named set first, match the slug within that set's
    cards/entities only.
- **No signature change to the four builders' top-level entry
  points.** Each takes the same `MatchSetupConfig` slice it took
  before; only the internal parsing/matching changes.

### C) Silent-failure surfacing — setup-time diagnostics

For each of the four setup builders that currently performs a
`isXRegistryReader → empty/minimal fallback`, a setup-time
diagnostic must be present in initial `G.messages` whenever the
fallback fires. The diagnostic is a full sentence naming:
- **what was skipped** (which builder),
- **why** (registry interface incomplete / registry not injected),
- **how to fix** (verify server called `setRegistryForSetup` before
  accepting create requests, or that the test mock implements the
  full registry-reader interface).

**Implementation choice (per builder, resolved at pre-flight Q3):**
the diagnostic is emitted EITHER

- **inside the builder** if the builder receives a `G` reference or
  a writable `messages` accumulator that the orchestration site
  reads, OR
- **at the orchestration site** (`buildInitialGameState.ts` or
  `Game.setup()`) by inspecting the builder's return shape and
  pushing a synthetic message naming the silently-skipped builder.

**Constraint:** no new state fields, no signature-breaking changes
to the four builders. Pre-flight Q3 confirms which path applies per
builder by reading their current signatures.

**Builders to surface:**
- **`packages/game-engine/src/villainDeck/villainDeck.setup.ts`** —
  the `isVillainDeckRegistryReader → empty deck` path.
- **`packages/game-engine/src/mastermind/mastermind.setup.ts`** —
  the `isMastermindRegistryReader → minimal mastermind` path.
- **`packages/game-engine/src/setup/buildSchemeSetupInstructions.ts`**
  — the registry-reader guard if present (verify at pre-flight).
- **Hero-deck builder** (file located at pre-flight Q2) — same
  pattern if a registry-reader guard exists.

Each modified file gains a `// why:` comment block referencing
D-10014 and the WP-100 smoke-test discovery, regardless of where
the diagnostic emission lands.

### D) Tests

- **`apps/server/src/server.mjs.test.ts`** — modified or created:
  - One new test asserting that `startServer()` calls
    `setRegistryForSetup` with the loaded registry before constructing
    `Server()`. Mocks the import to spy the call.
- **`packages/game-engine/src/matchSetup.validate.test.ts`** —
  modified:
  - **At least 25 new tests** organized as 5 per field category
    (5 fields × accept-qualified + reject-bare-slug + reject-display-
    name + reject-flat-card-key + reject-cross-set-collision-
    sensitivity) — final count locked at pre-flight when the
    per-field shape is verified against builder semantics:
    - `validateMatchSetup accepts schemeId as set-qualified slug
      (e.g., "core/midtown-bank-robbery")`
    - `validateMatchSetup rejects schemeId given as a bare slug`
    - `validateMatchSetup rejects schemeId given as a display name`
    - `validateMatchSetup rejects schemeId given as a flat-card key`
    - `validateMatchSetup rejects schemeId for a slug that exists
      in a different set than the one named` (collision-sensitivity:
      e.g., `"core/super-hero-civil-war"` accepts but
      `"msp1/midtown-bank-robbery"` rejects if `msp1` doesn't have
      that scheme)
    - (similar 5-test groups for mastermindId, villainGroupIds,
      henchmanGroupIds, heroDeckIds — 25 total minimum)
  - **At least 5 parse-error tests** asserting `parseQualifiedId`
    rejects malformed inputs: empty string, no slash, multiple
    slashes (`"core/sub/black-widow"`), empty setAbbr
    (`"/black-widow"`), empty slug (`"core/"`).
  - Existing tests that used flat-card keys or bare slugs for these
    fields are updated to use the qualified format. Document each
    fixture change in the test file's top JSDoc with a D-10014
    reference. The fixture migration is part of WP-113's scope —
    test-data drift from the new contract is expected and intended.
- **`packages/game-engine/src/villainDeck/villainDeck.setup.test.ts`**
  (and three peer files) — modified:
  - Add one regression test per helper asserting that the silent-empty
    early-return now also pushes a `G.messages` entry. The test
    constructs an incomplete-interface mock registry, calls the
    builder, and asserts both the empty-state return AND the
    `G.messages` entry.
- **End-to-end loadout integration test** (new file:
  `packages/game-engine/src/setup/buildInitialGameState.loadout.test.ts`):
  - Constructs a real `MatchSetupConfig` with bare slugs (e.g.,
    `villainGroupIds: ['brotherhood']`), passes through `Game.setup()`
    with a fixture `CardRegistryReader` that exposes a small set of
    cards, and asserts:
    - `G.villainDeck.deck.length > 0`
    - `G.mastermind.tacticsDeck.length > 0`
    - `G.cardStats` populated for the chosen cards
    - `G.messages` does NOT contain any "skipped" entry
  - This test is the structural prevention for the silent-empty-deck
    class of regression. Future engine WPs that touch setup helpers
    must keep it green.

All tests use `node:test` and `node:assert` only.

---

## Out of Scope

- No changes to `apps/arena-client/` — WP-100 closed the UI surface;
  WP-113 closes the engine-server seam. The arena-client is the
  verification surface (smoke test), not the change surface.
- No changes to the lobby's `parseLoadoutJson.ts` or the existing
  WP-092 lobby form — they accept any non-empty string for ID
  fields, which is the correct behavior (loose validation upstream;
  authoritative validation in `Game.setup()`).
- No changes to the engine's move functions (`drawCards`,
  `setPlayerReady`, `revealVillainCard`, etc.) — those are
  WP-100-territory and stable.
- No engine-integration test harness (in-process `Server() +
  Client()` simulation, recommended in D-10010 / D-10013) —
  separate infrastructure WP, larger scope. WP-113's loadout
  integration test (§Scope D) is a step toward that harness but
  doesn't replace it.
- No new `LegendaryGameState` field, no shape changes, no new moves,
  no new phase hooks.
- No changes to the parseLoadoutJson test fixtures' prefixed ID
  strings — those tests don't pass through the engine, so they're
  schema-loose and correct as-is.
- No changes to the existing `buildKnownExtIds` function — it stays
  as the flat-card-key set, in case any field legitimately needs it.

---

## Files Expected to Change

- `apps/server/src/server.mjs` — modified — registry wiring
- `apps/server/src/server.mjs.test.ts` — new or modified — wiring test
- `packages/game-engine/src/matchSetup.validate.ts` — modified — slug-set helpers + per-field alignment
- `packages/game-engine/src/matchSetup.validate.test.ts` — modified — 5 new field-format tests + existing-test fixture updates
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts` — modified — export `extractVillainGroupSlug` + `G.messages` push
- `packages/game-engine/src/villainDeck/villainDeck.setup.test.ts` — modified — silent-failure regression test
- `packages/game-engine/src/mastermind/mastermind.setup.ts` — modified — export slug-extractor + `G.messages` push
- `packages/game-engine/src/mastermind/mastermind.setup.test.ts` — modified — silent-failure regression test
- `packages/game-engine/src/setup/buildSchemeSetupInstructions.ts` — modified — same pattern
- `packages/game-engine/src/setup/buildSchemeSetupInstructions.test.ts` — modified — same pattern
- `packages/game-engine/src/setup/<heroDeckBuilder>.ts` — modified — same pattern (file path TBD at pre-flight)
- `packages/game-engine/src/setup/<heroDeckBuilder>.test.ts` — modified — same pattern
- `packages/game-engine/src/setup/buildInitialGameState.loadout.test.ts` — new — end-to-end loadout integration test

Estimated 12-13 files (the qualified-format scope expansion may
also touch the henchman-group resolution path inside
`villainDeck.setup.ts` if it lives separately from villain
parsing). Final count locked at pre-flight.

**WP-100 retrospective note.** The smoke-test recipe in
[docs/ai/invocations/session-wp100-interactive-gameplay-surface.md](../invocations/session-wp100-interactive-gameplay-surface.md)
included a sample loadout JSON using bare slugs
(`villainGroupIds: ["villains-brotherhood"]`, `heroDeckIds:
["hero-spider-man", ...]`). That JSON was always ambiguous per the
2026-04-27 collision data above and only "worked" in the WP-100
smoke test because the registry-not-wired bug (closed by §Scope A)
silently skipped validation. WP-100 is closed and not reopened by
this WP; the smoke-test artifact is scratchpad-by-default per
`.claude/rules/work-packets.md` so editing it has no governance
overhead, but it is also self-correcting once WP-113 lands —
future smoke testers will see the validator's format-error message
and update the JSON. No retroactive changes to WP-100 spec are
required. This note exists to record the precedent: scaffold
smoke-test JSON in any future WP must use the qualified format
locked here.

---

## Acceptance Criteria

### Server wiring
- [ ] `apps/server/src/server.mjs` imports `setRegistryForSetup` from `@legendary-arena/game-engine`
- [ ] `startServer()` calls `setRegistryForSetup(registry)` after `loadRegistry()` resolves and before the server begins serving create requests
- [ ] A `// why:` comment names D-10014 and the WP-100 smoke-test discovery
- [ ] Server-side test asserts `setRegistryForSetup` was called during `startServer()` execution and prior to the function returning. Mock the imported binding (e.g., via `mock.module` or a re-exported test seam) to spy the call. **Do NOT require deep boardgame.io constructor spying** — that's awkward under ESM and not necessary; ordering "after loadRegistry, before startServer returns" is sufficient to prove the gap is closed.

### Validator alignment (set-qualified ID format, locked)
- [ ] `validateMatchSetup` accepts each entity-ID field in the form `<setAbbr>/<slug>` (e.g., `schemeId: "core/midtown-bank-robbery"`)
- [ ] `validateMatchSetup` REJECTS bare slugs (`"midtown-bank-robbery"`) for ALL five entity-ID fields with a format-error message naming the canonical form
- [ ] `validateMatchSetup` REJECTS display names (`"Black Widow"`) and flat-card keys (`"core-hero-black-widow-1"`) for the five entity-ID fields
- [ ] `parseQualifiedId` rejects malformed inputs (empty, no slash, multiple slashes, empty parts) with format-error messaging
- [ ] Validator distinguishes "set not loaded" from "slug not in that set" in its error messages — e.g., `"heroDeckIds[0] rejected: \"missing-set/black-widow\". Set \"missing-set\" is not loaded."` vs `"heroDeckIds[0] rejected: \"core/nonexistent-hero\". Hero slug \"nonexistent-hero\" not found in set \"core\"."`
- [ ] Cross-set collision protection: `villainGroupIds: ["core/brotherhood"]` validates against `core` set only, regardless of whether `brotherhood` exists in any other set
- [ ] All five field-specific error messages follow the `00.6 §11` full-sentence contract — name the field index, the rejected value, the canonical form, and a concrete example

### Builder alignment
- [ ] `buildVillainDeck` parses `villainGroupIds` entries as `<setAbbr>/<groupSlug>` and filters cards by `setAbbr` first, `groupSlug` second
- [ ] `buildMastermindState`, `buildSchemeSetupInstructions`, and the hero-deck builder follow the same `<setAbbr>/<slug>` parsing pattern
- [ ] No top-level signature changes to any of the four builders — `MatchSetupConfig` argument shape is unchanged, only the internal interpretation of strings changes
- [ ] Cross-set deck-construction safety: a `villainGroupIds` entry of `"core/brotherhood"` produces a deck containing ONLY `core` set's brotherhood cards, even when `msp1`'s `brotherhood` (if it existed) is loaded in the same registry

### Silent-failure surfacing
- [ ] When `buildVillainDeck` returns empty/minimal due to an unusable registry, initial `G.messages` contains a full-sentence diagnostic naming cause (which builder + interface gap) and remediation
- [ ] Same diagnostic invariant for `buildMastermindState`, `buildSchemeSetupInstructions`, and the hero-deck builder
- [ ] When the registry IS wired and usable, the loadout integration test produces non-empty decks AND `G.messages` contains NO "skipped" diagnostic from any of the four builders
- [ ] Each diagnostic message follows the `00.6 §11` full-sentence error-message contract — names what failed, what to check or do, no terse single-word entries

### Builder exports
- [ ] `extractVillainGroupSlug` is exported from `villainDeck.setup.ts`
- [ ] Equivalent slug-extractor functions are exported from each of the other three setup helpers (or created if absent)
- [ ] `matchSetup.validate.ts` consumes the four exported extractors

### Tests
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (unchanged from WP-100 baseline)
- [ ] `pnpm -r build` exits 0
- [ ] Engine baseline `524 / 116 / 0` → `~534 / 117 / 0` (estimate +10 tests / +1 suite for the new loadout integration test + 9 per-field validator and silent-failure tests)
- [ ] Server baseline `47 / 7 / 0` → `~48 / 7 / 0` (one new wiring test)
- [ ] arena-client baseline `182 / 17 / 0` UNCHANGED — this WP doesn't touch the client

### End-to-end smoke test
- [ ] Manual smoke test (`scripts/Start-SmokeTest.ps1`) reproduces the WP-100 flow with bare-slug loadout JSON, and clicking **Reveal** in `start` stage now produces a villain or henchman card in the City row (not a "Villain deck reveal skipped" log entry)
- [ ] Clicking **fightVillain** with sufficient attack defeats the villain (it appears in the player's victory pile)
- [ ] Clicking **fightMastermind** with sufficient attack defeats a tactic (mastermind tactics-remaining count decrements)

### 01.5 status
- [ ] No new `LegendaryGameState` field
- [ ] No `buildInitialGameState` shape change
- [ ] No new `LegendaryGame.moves` entry
- [ ] No new phase hook
- [ ] **01.5 NOT INVOKED** — verified by the four-trigger check

### Scope enforcement
- [ ] No files outside `## Files Expected to Change` modified (`git diff --name-only`)
- [ ] `apps/arena-client/` unchanged (`git diff --name-only -- apps/arena-client`)
- [ ] No new moves registered on `LegendaryGame.moves`
- [ ] No changes to `LegendaryGame.phases.lobby` configuration

---

## Verification Steps

```pwsh
# Step 1 — engine build
pnpm --filter @legendary-arena/game-engine build
# Expected: exits 0

# Step 2 — engine tests
pnpm --filter @legendary-arena/game-engine test
# Expected: ~534 / 117 / 0 / 0 (engine baseline + new tests)

# Step 3 — server tests
pnpm --filter @legendary-arena/server test
# Expected: ~48 / 7 / 0 / 0 (server baseline + wiring test)

# Step 4 — full monorepo build
pnpm -r build
# Expected: exits 0

# Step 5 — arena-client tests unchanged
pnpm --filter @legendary-arena/arena-client test
# Expected: 182 / 17 / 0 / 0 (WP-100 baseline preserved)

# Step 6 — verify server wiring grep
Select-String -Path "apps\server\src\server.mjs" -Pattern "setRegistryForSetup"
# Expected: at least 2 matches (the import line + the call site)

# Step 7 — verify slug helpers exported from setup files
Select-String -Path "packages\game-engine\src\villainDeck\villainDeck.setup.ts" -Pattern "^export function extractVillainGroupSlug"
Select-String -Path "packages\game-engine\src\mastermind\mastermind.setup.ts" -Pattern "^export function (extractMastermindSlug|isMastermindCard)"
# Expected: each greps returns at least one match

# Step 8 — verify silent-failure G.messages pushes
Select-String -Path "packages\game-engine\src\villainDeck\villainDeck.setup.ts","packages\game-engine\src\mastermind\mastermind.setup.ts","packages\game-engine\src\setup\buildSchemeSetupInstructions.ts" -Pattern "G\.messages\.push.*skipped"
# Expected: 3+ matches (one per helper at least)

# Step 9 — confirm scope enforcement
git diff --name-only -- apps/arena-client packages/registry
# Expected: no output

# Step 10 — manual smoke test with corrected loadout JSON
# (run pwsh scripts/Start-SmokeTest.ps1 -KillStaleListeners; create match
# with bare-slug JSON; click Reveal; verify a villain appears in City)
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (baseline preserved)
- [ ] Manual smoke test: clicking **Reveal** in `start` stage produces a villain or henchman in the City (not a log entry); `fightVillain` defeats the target; `fightMastermind` decrements tactics
- [ ] `docs/ai/STATUS.md` updated — match creation now produces non-empty matches; smoke testable end-to-end
- [ ] `docs/ai/DECISIONS.md` updated — D-10014 records the engine-server registry wiring + validator alignment, AND clarifies the slug-vs-key contract for each MatchSetupConfig field
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-113 checked off with today's date
- [ ] 01.6 post-mortem authored at `docs/ai/post-mortems/01.6-WP-113-engine-server-registry-wiring-and-validator-alignment.md` (mandatory triggers: new contract surface — slug-set helpers; new code seam — server registry wiring; new long-lived abstraction — silent-failure surfacing pattern that future setup helpers must follow)

---

## Vision Alignment

**Vision clauses touched:** §3 (Player Trust & Fairness), §8
(Deterministic Game Engine), §10 (Content as Data).

**Conflict assertion:** No conflict — this WP strengthens all three.

- §3 / §8: matches today are silently structurally broken (empty
  decks). Players cannot trust that creating a match produces a
  playable game. WP-113 closes the silent-failure path so the
  engine either accepts a loadout and builds a real match, or
  rejects it loudly with an actionable error message. No middle
  ground where the match looks created but the deck is empty.
- §10: the registry is content; it must reach the engine via a
  defined seam. WP-113 names the seam (`setRegistryForSetup`) and
  wires it. The validator alignment ensures content-as-data
  semantics are enforced — every loadout's IDs are checked
  against the actual content shape, not a misaligned schema.

**Non-Goal proximity check (NG-1..7):** None crossed. No
monetization surface, no cosmetic store, no persuasive UI, no paid
competitive lane.

**Determinism preservation (Vision §8, §22):** No new randomness
source, no wall-clock reads, no client-side mutation. The validator
runs deterministically against the registry's snapshot at startup
time. The silent-failure surfacings push deterministic
`G.messages` entries that don't affect game state.

---

## Open Questions

1. **(Pre-flight resolution required.) Validator delegation strategy.**
   Default is **(a): validator consumes builder-owned slug-extractor
   helpers; builders remain authoritative for their ID format**. The
   "single source of truth" is the per-builder extractor — NOT a new
   ID-resolution module. Pivot to **(b): introduce a shared
   ID-resolution layer** ONLY if a setup helper's slug semantics
   cannot be expressed as a stable, self-contained extractor without
   entangling builder logic (e.g., scheme setup also resolves
   campaign instructions in a way that can't be cleanly factored).
   The pre-flight reads each of the four setup helpers and confirms
   (a) is feasible per-field. The decision is logged in D-10014.
2. **(Pre-flight resolution required.) Hero-deck builder location.**
   The hero-deck setup file path is not visible from a quick grep —
   author locates and reads it at pre-flight, confirms the slug
   convention matches the canonical pattern, and updates the
   §Files Expected to Change list with the resolved path.
3. **(Pre-flight resolution required.) Diagnostics injection
   feasibility per builder.** The "silent-failure surfacing minimum"
   constraint is shape-agnostic: the diagnostic must be in initial
   `G.messages`. Pre-flight must confirm, **per builder**, whether
   the existing signature provides access to `G` / a writable
   `messages` accumulator (in which case the push happens inside the
   builder) OR whether the diagnostic must be emitted at the
   orchestration site (`buildInitialGameState.ts` or `Game.setup()`)
   based on the builder's return shape. Either path is acceptable;
   pre-flight locks the per-builder choice and records it in the
   §Scope (In) §C body. If a builder requires a signature change to
   support the diagnostic, that's a scope expansion — STOP and
   re-evaluate.
4. **(Resolved at draft time.) 01.5 not invoked.** All four triggers
   absent — no new `LegendaryGameState` field, no
   `buildInitialGameState` shape change (config still has the same 9
   fields with the same types), no new `LegendaryGame.moves` entry,
   no new phase hook. The validator's per-field semantics change
   their interpretation of strings; the type signatures are
   unchanged.
5. **(Acknowledged-deferred.) Engine integration harness.** D-10010
   and D-10013 both flagged the need for an in-process `Server() +
   Client()` simulation harness as the structural prevention for
   smoke-test-only-discoverable regressions. WP-113 doesn't build
   that harness — its loadout integration test (§Scope D, end-to-end
   `Game.setup()` flow) is a tactical surrogate. A separate
   infrastructure WP should follow.
6. **(Acknowledged-deferred.) Three scaffold-artifact buttons in
   TurnActionBar.** D-10003 (Draw), D-10011 (Advance), D-10012
   (Reveal) are all decision-logged for deletion when the engine
   adds automatic turn-start mechanics (auto-reveal, auto-draw,
   auto-advance to main). A consolidated engine WP that wires
   `turn.onBegin` to do all three retires the buttons. WP-113 is
   not that WP — it focuses on the orthogonal validator/wiring
   issue.

---

## Promotion Record (2026-04-27)

- Drafted 2026-04-27 in response to WP-100's smoke-test discovery —
  the user's "no villains in the City" symptom traced to
  `G.villainDeck.deck = []` at setup time, which traced to
  `gameRegistry === undefined` (server never wires it), which traced
  to a missing `setRegistryForSetup(registry)` call in
  `apps/server/src/server.mjs`.
- Initial scope inspection found the secondary mismatch: even with
  registry wired, `validateMatchSetup` and `buildVillainDeck`
  disagree on `villainGroupIds` format (flat-card key vs bare group
  slug). Scope expanded to cover both fixes in one WP.
- Tertiary scope: silent-failure paths in the four setup helpers
  (the `isXRegistryReader → return empty` pattern) need surfacing
  so future failures are observable. Added per the smoke-test
  precedent that "engine MVPs that fail silently waste hours of
  debugging time" (WP-100 D-10006/7/8/9/10/11/12/13 cumulative
  reflection).
- 00.3 lint-gate self-review: PENDING (will run at pre-flight).
- Pre-flight pending. The WP author should also verify each setup
  helper's actual slug convention before locking the validator's
  per-field categories — schema mismatches like the
  villain-flat-key-vs-group-slug one may exist for other fields too.
