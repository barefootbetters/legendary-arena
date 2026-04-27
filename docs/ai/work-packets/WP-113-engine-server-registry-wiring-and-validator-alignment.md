# WP-113 — Engine-Server Registry Wiring + Match-Setup Validator / Builder ID Alignment

**Status:** Pre-flight READY TO EXECUTE 2026-04-27 (conditional on PS-1..8 — all resolved into this body)
**Primary Layer:** Server (`apps/server/src/server.mjs`) + Game Engine (`packages/game-engine/src/matchSetup.validate.ts` + `matchSetup.types.ts` + `game.ts` `EMPTY_REGISTRY` + `setup/buildInitialGameState.ts` orchestration + four setup helpers under `packages/game-engine/src/{villainDeck,mastermind,setup}/*setup*.ts`)
**Dependencies:** WP-004 (server bootstrap), WP-014 / WP-015 (villain deck setup), WP-007 (mastermind setup), WP-005 (initial game state), WP-100 (the smoke test that surfaced this gap)
**Pre-flight resolutions baked in:** PS-1 Q2 path lock, PS-2 slug-source Class A/B distinction, PS-3 `CardRegistryReader` widening (Option (i)), PS-4 Q3 orchestration-only lock, PS-5 server destructure-rename, PS-6 test-count reconciliation, PS-7 builder internal-iterator updates, PS-8 collision-probe re-measure at session start. Plus three copilot folds: Finding 10 (`MatchSetupConfig` field JSDoc), Finding 24 (`buildKnownExtIds` deprecation marker), Finding 30 (validator structural split).

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
   in the actual registry data. Empirical probe 2026-04-27 (pre-flight
   re-verification):
   - **23 / 279 hero slugs** appear in 2+ sets (verified at pre-flight).
     `black-widow` exists in `3dtc`, `bkwd`, `core`, `msp1`. `hulk` in
     3 sets. `captain-america` / `thor` / `deadpool` / `wasp` /
     `ant-man` / `nova` all collide.
   - **3 / 103 mastermind entity slugs** collide (pre-flight re-probe).
     The original WP draft cited "11 / 584" — that figure counted
     individual mastermind cards (~5-6 cards per entity × ~100
     entities), not unique mastermind entity slugs. **PS-8 LOCKED:**
     re-measure all four collision counts at session start using the
     actual loaded data and record the measured numbers verbatim in
     the D-10014 entry. Do NOT repeat the original "11 / 584" figure
     — it is probe-shape-dependent and unverified.
   - **~2-4 villain group slugs** collide depending on probe shape
     (group-level vs card-level). Re-measure at session start.
   - **2 / 189 scheme slugs** collide (verified at pre-flight):
     `super-hero-civil-war` in `core` + `msp1`.

   The determinism argument stands on hero-collision data alone (23 /
   279 verified) and does NOT depend on the higher mastermind/villain
   numbers. Set-qualified `<setAbbr>/<slug>` IDs are required regardless.

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
  imports builder-owned slug-source helpers (Class A key-decoders +
  Class B set-data slug iterators per PS-2) and accepts entries that
  any builder will accept. Pro: minimal blast radius; the builders
  stay authoritative. Con: validator needs to know each builder's
  slug conventions.
- **(b) Builders delegate to a shared ID-resolution layer.** A new
  module exports `resolveMatchSetupIdFormat()` returning a structural
  description of acceptable ID shapes per field. Both validator and
  builders consume it. Pro: single source of truth. Con: a real
  refactor across five files; harder to scope.

**Q1 RESOLVED at pre-flight 2026-04-27 → Option (a).** Pivot to (b)
is forbidden without WP body amendment + new pre-flight. PS-3 widens
`CardRegistryReader` in-place (Option (i)) to expose `listSets` /
`getSet` so the validator can build per-field qualified-ID sets.

---

## Mid-Execution Amendment (Spec Gap Fix — 2026-04-27)

During execution, a fifth internal-iterator site was discovered:

- `packages/game-engine/src/economy/economy.logic.ts`
  `buildCardStats()` consumes `matchConfig.heroDeckIds`,
  `matchConfig.villainGroupIds`, and `matchConfig.henchmanGroupIds`
  as bare slugs at lines 179, 195, 224. After this WP's
  set-qualified ID contract lands, `buildCardStats()` would
  silently produce empty `G.cardStats`, breaking the loadout
  integration test and runtime move costs (fight*, recruit*).

**Amendment:**

- Add `economy.logic.ts` to the PS-7 internal-iterator update set.
- Add `economy.logic.ts` to `## Files Expected to Change`.
- Increase the hard cap by +1 file (16 → 17) for this WP only,
  because the fix is mechanically identical to the existing PS-7
  transforms and is required to satisfy the WP's locked
  acceptance criteria. Authorized inline per D-3103 (WP-031
  precedent for scope-neutral mid-execution amendments).

**Verified blast radius (independent grep against main HEAD,
2026-04-27):** `economy.logic.ts` is the **only** missed
iterator. Other consumers of the five entity-ID fields are
format-agnostic:

- `campaign/campaign.logic.ts` — spread/merge only; opaque
  string handling. SAFE.
- `rules/ruleRuntime.impl.ts:58,65` — `sourceId` flows opaquely
  through hook definitions; no equality checks against bare
  slugs anywhere. SAFE.
- `ui/uiState.build.ts:256` — `scheme.id` flows to UI projection
  in qualified form. **Cosmetic ripple only**: UI will display
  `"core/midtown-bank-robbery"` instead of `"midtown-bank-robbery"`.
  Not a determinism issue. UI strip-prefix-for-display is a
  follow-up polish WP, **not** WP-113 scope expansion. Tracked
  in D-10014 as a known display-side ripple.
- `types.ts`, `matchSetup.types.ts` — type definitions only
  (string). String typing already accommodates the qualified
  format. SAFE.
- `game.ts`, `setup/buildInitialGameState.ts` — already in scope
  via PS-3 / PS-4.

**Spec-gap detection note:** the gap was discovered via runtime
trace from `buildCardStats` consuming `matchConfig` fields, not
from a static enumeration check. Process improvement candidate
for the 01.6 post-mortem: future WPs introducing contract changes
on `MatchSetupConfig` fields should grep ALL source files for
`matchConfig.{fieldName}` consumption, not just `/setup`-named
directories. The "builder" mental model missed `/economy` because
it is a sibling stats-computation directory, not a setup builder
per se.

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
  2026-04-27, line 1).
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts` declares
  `extractVillainGroupSlug` and `isVillainDeckRegistryReader` as local
  functions (verified at pre-flight 2026-04-27 — both currently NOT
  exported; this WP promotes them per PS-2 / PS-4).
- `packages/game-engine/src/setup/heroAbility.setup.ts` declares
  `extractHeroSlug` and `isHeroAbilityRegistryReader` as local
  functions (verified at pre-flight — both currently NOT exported;
  promoted per PS-2 / PS-4). This is the canonical "hero-deck builder"
  per Q2 LOCK below.
- `packages/game-engine/src/mastermind/mastermind.setup.ts` declares
  `isMastermindRegistryReader` as a local function (NOT exported;
  promoted per PS-4). It does NOT have a card-key extractor —
  mastermind slugs are matched against `setData.masterminds[].slug`
  directly. PS-2 introduces `listMastermindSlugsInSet` (Class B
  set-data slug iterator) as a NEW exported helper.
- `packages/game-engine/src/setup/buildSchemeSetupInstructions.ts`
  declares `isSchemeRegistryReader` as a local function (NOT exported;
  promoted per PS-4). It does NOT have a card-key extractor — scheme
  slugs match `setData.schemes[].slug` directly. PS-2 introduces
  `listSchemeSlugsInSet` (Class B) as a NEW exported helper.
- Henchman group slugs match `setData.henchmen[].slug` directly. They
  are co-located with villain-deck construction in
  `villainDeck.setup.ts` (`findHenchmanGroupSlug` is internal). PS-2
  introduces `listHenchmanGroupSlugsInSet` (Class B) as a NEW
  exported helper inside `villainDeck.setup.ts`.
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
  entries to `G.messages` and continue with empty state.
  **Uniformity rule (LOCKED):** all four setup builders MUST use
  the SAME failure-reporting mode. The chosen mode (throw vs
  `G.messages` diagnostics) is decided ONCE at pre-flight Q3 and
  applies uniformly to all four helpers. Mixing modes across
  helpers is forbidden — a per-helper choice would force tests
  (and future readers) to track which helper does what, which is
  exactly the inconsistency this WP exists to retire. Mixing within
  one helper is also forbidden (carryover constraint).
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
- **Slug-source helpers — Class A + Class B (PS-2 LOCKED).** The
  per-builder slug-source authority is the union of two helper
  classes; the validator consumes both:
  - **Class A — slug key-decoders** (decode `{setAbbr}-{cardType}-{slug}-{cardSlug}`
    flat-card keys):
    - `extractVillainGroupSlug` — promote to export from
      `villainDeck.setup.ts`. Type-stable, no signature change.
    - `extractHeroSlug` — promote to export from
      `setup/heroAbility.setup.ts`. Type-stable, no signature change.
  - **Class B — set-data slug iterators** (enumerate
    `setData.{masterminds|schemes|henchmen}[].slug`):
    - `listMastermindSlugsInSet(setData: unknown): string[]` — NEW
      exported helper in `mastermind.setup.ts`. Returns `[]` on
      malformed `setData` shape (no throws).
    - `listSchemeSlugsInSet(setData: unknown): string[]` — NEW
      exported helper in `setup/buildSchemeSetupInstructions.ts`.
      Same `[]`-on-malformed contract.
    - `listHenchmanGroupSlugsInSet(setData: unknown): string[]` —
      NEW exported helper in `villainDeck.setup.ts` (henchmen are
      co-located with villain-deck construction; preserved). Same
      `[]`-on-malformed contract.

  Inventing fictitious key-decoders for mastermind / scheme is
  forbidden — those slugs are NOT encoded in flat-card keys.

- **Registry-reader guard exports (PS-4 LOCKED).** All four type
  guards must be promoted to named exports for orchestration-side
  diagnostic emission:
  - `isVillainDeckRegistryReader` — export from
    `villainDeck.setup.ts`.
  - `isMastermindRegistryReader` — export from
    `mastermind.setup.ts`.
  - `isSchemeRegistryReader` — export from
    `setup/buildSchemeSetupInstructions.ts`.
  - `isHeroAbilityRegistryReader` — export from
    `setup/heroAbility.setup.ts`.
  Type-stable, no signature change.

- **`CardRegistryReader` widening — Option (i) in-place (PS-3 LOCKED).**
  Widen the existing `CardRegistryReader` interface in
  `matchSetup.validate.ts` to:
  ```ts
  export interface CardRegistryReader {
    listCards(): Array<{ key: string }>;
    listSets(): Array<{ abbr: string }>;
    getSet(abbr: string): unknown | undefined;
  }
  ```
  The real `CardRegistry` already satisfies the wider shape
  structurally (same shape `VillainDeckRegistryReader` reads).
  `EMPTY_REGISTRY` in `game.ts:56-58` must add
  `listSets: () => []` and `getSet: () => undefined`. The
  `if (gameRegistry)` guard at `game.ts:201-210` is preserved
  unchanged.

- **Authority lock (LOCKED):** the slug-source helpers (Class A +
  Class B) are the ONLY authoritative definition of acceptable
  slug semantics. `matchSetup.validate.ts` MUST NOT independently
  parse, normalize, or reinterpret slug formats beyond delegating
  to these helpers (and to `parseQualifiedId` for the surrounding
  `<setAbbr>/<slug>` envelope). The validator does not own slug
  grammar; it consumes it. Builders remain authoritative; no new
  ID-resolution module is introduced.
- **Silent-failure surfacing — Q3 LOCKED orchestration-only (PS-4).**
  When a setup builder must return empty/minimal state due to an
  unusable registry (the `isXRegistryReader → empty fallback`
  paths), a full-sentence diagnostic must be present in initial
  `G.messages` naming the gap and the remediation. **Pre-flight
  determined that NONE of the four builders receives `G`** —
  emission inside the builder is structurally impossible without
  a forbidden signature change. Therefore the locked emission
  site for ALL FOUR builders is the orchestration site
  (`setup/buildInitialGameState.ts`). Implementation pattern:
  1. Build a local `setupMessages: string[] = []` accumulator
     BEFORE constructing `baseState`.
  2. Run each of the four exported `isXRegistryReader` guards
     against `registry`. On `false`, push a full-sentence
     diagnostic to `setupMessages` naming (a) which builder was
     skipped, (b) why (registry-reader interface incomplete /
     registry not injected by server), (c) how to fix (verify
     `setRegistryForSetup(registry)` was called at server startup
     OR that the test mock implements the full reader interface).
  3. Assign `baseState.messages = setupMessages` (replacing the
     current `messages: []` literal).
  4. Builders' internal `isXRegistryReader → empty` paths remain
     unchanged for defense-in-depth (orchestration-side detection
     + builder-side fallback).
  This satisfies the Uniformity Rule (one mode, one site, four
  builders treated identically). No builder signature changes; no
  new state fields; `baseState` shape unchanged (only the
  `messages` field's content differs from `[]` to a populated
  accumulator on registry-narrow paths).
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
- **Qualified IDs are exclusive (LOCKED).** There are no fallback or
  compatibility paths for bare slugs, display names, or flat-card
  keys anywhere in the validator or builders. Any attempt to accept
  alternative formats — at any point in the pipeline, in any
  helper, in any test fixture — is a contract violation and must
  fail loudly. The format is one-way: qualified in, validated, then
  consumed. There is no "lenient mode," no "legacy compatibility
  shim," and no "best-effort guess" path. Reviewers reject any PR
  that introduces a bare-slug fallback regardless of how isolated
  it appears.
- **Silent-failure surfacing minimum** (locked): each of the four
  setup helpers' early-return paths gains AT LEAST a `G.messages`
  entry with a full-sentence message naming what was skipped and
  why. The arena-client HUD already renders `G.messages` (via the
  log panel from WP-064), so the entry is observable in smoke
  testing. Throwing is permitted but not required.
- **Builders MUST filter by `setAbbr` first, slug second (LOCKED).**
  After parsing `<setAbbr>/<slug>`, the builder iterates ONLY that
  set's cards/entities and matches the slug within that set's scope.
  Any builder that parses a qualified ID but matches across all
  loaded sets (e.g., calls a global `findCardBySlug(slug)` after
  parsing) is in violation of the determinism contract — the
  qualified format exists precisely to prevent cross-set matches,
  and stripping the set qualifier mid-pipeline defeats the entire
  fix. Reviewers reject this regardless of test pass/fail status.

---

## Scope (In)

### A) Server registry wiring — `apps/server/src/server.mjs`

- **`apps/server/src/server.mjs`** — modified (minimal diff per PS-5):
  - Add `setRegistryForSetup` to the existing
    `import { LegendaryGame } from '@legendary-arena/game-engine'`
    line. The export already exists (verified at `index.ts:1`,
    2026-04-27).
  - **Destructure rename in `Promise.all` (PS-5).** The current
    `await Promise.all([loadRegistry(), loadRules(), createParGate(...)])`
    destructures as `[, , parGate]` — discarding the resolved
    registry. Rename to `[registry, , parGate]` to capture it. This
    is part of the minimal diff, not a structural change.
  - After the `await Promise.all(...)` completes (and `registry`
    is in scope), insert:
    ```js
    // why: D-10014 — engine's setRegistryForSetup() must be called
    // before Server() is constructed so Game.setup() sees the
    // registry on every match-create. WP-100 smoke test on
    // 2026-04-27 surfaced this gap: the server loaded the registry
    // but never wired it, so validateMatchSetup was silently
    // skipped via the `if (gameRegistry)` guard at game.ts:201-210
    // and every match was structurally empty.
    setRegistryForSetup(registry);
    ```
  - **Minimal diff scope (PS-5):** import addition + Promise.all
    destructure rename + call site + `// why:` comment. No other
    modifications to `server.mjs`. No changes to `index.mjs`,
    `rules/loader.mjs`, `par/parGate.mjs`, or any other server
    file. No structural reorganization of `startServer()`'s
    Promise.all sequencing.

### B) Validator alignment — `packages/game-engine/src/matchSetup.validate.ts` + `matchSetup.types.ts` + `game.ts`

- **`packages/game-engine/src/matchSetup.validate.ts`** — modified:
  - **Widen `CardRegistryReader` (PS-3 LOCKED).** The existing
    interface has only `listCards()`. Widen in-place to:
    ```ts
    export interface CardRegistryReader {
      listCards(): Array<{ key: string }>;
      listSets(): Array<{ abbr: string }>;
      getSet(abbr: string): unknown | undefined;
    }
    ```
    Add a `// why:` comment citing D-10014 and "validator needs
    `listSets`/`getSet` to build per-field qualified-ID sets."
    The real `CardRegistry` already satisfies the wider shape
    structurally (verified — `VillainDeckRegistryReader` reads the
    same shape).
  - The existing `buildKnownExtIds(registry)` function returns a
    `Set<string>` of flat-card keys. **After WP-113, no entity-ID
    field consumes it** — preserve as a forensic-debugging aid
    with a deprecation `// why:` comment (Finding 24 LOCKED):
    ```ts
    // why: D-10014 — deprecated; remove in follow-up cleanup WP.
    // No current consumers after WP-113 — all five entity-ID
    // fields now use buildKnownXxxQualifiedIds. Retained for one
    // release cycle as a forensic-debugging aid.
    ```
    Do NOT remove the function in this WP.
  - Add `parseQualifiedId(input: string): { setAbbr: string; slug:
    string } | null` — parses `<setAbbr>/<slug>` and returns null
    on any malformed input (empty string, no `/`, multiple `/`,
    empty parts, leading/trailing whitespace). Validator emits a
    "format" error before the existence check when parse fails.
  - Add five helpers, each returning `Set<string>` of fully-qualified
    `<setAbbr>/<slug>` IDs:
    - `buildKnownSchemeQualifiedIds(registry)` — iterates
      `registry.listSets()` and uses `listSchemeSlugsInSet(getSet(abbr))`
      (Class B) to enumerate scheme slugs per set.
    - `buildKnownMastermindQualifiedIds(registry)` — iterates
      `listSets()` + `listMastermindSlugsInSet(getSet(abbr))`
      (Class B).
    - `buildKnownVillainGroupQualifiedIds(registry)` — uses
      `listCards()` filtered to `cardType: 'villain'` + Class A
      `extractVillainGroupSlug` to derive `(setAbbr, groupSlug)`
      pairs; deduplicates.
    - `buildKnownHenchmanGroupQualifiedIds(registry)` — iterates
      `listSets()` + `listHenchmanGroupSlugsInSet(getSet(abbr))`
      (Class B).
    - `buildKnownHeroQualifiedIds(registry)` — uses `listCards()`
      filtered to `cardType: 'hero'` + Class A `extractHeroSlug`
      to derive `(setAbbr, heroSlug)` pairs; deduplicates.
  - Restructure the per-field validation loops. For each entity-ID
    field:
    1. Parse the entry as `<setAbbr>/<slug>`. If parse fails, emit
       a format error: `"<field>[<i>] rejected: \"<value>\". IDs
       must be set-qualified slugs in the form
       \"<setAbbr>/<slug>\", e.g., \"core/<example>\"."`
    2. If parse succeeds but the parsed ID is not in the
       corresponding `buildKnownXxxQualifiedIds` set, emit an
       existence error distinguishing "set not loaded" from "slug
       not in that set" by checking set membership separately:
       - First check `registry.listSets()` — if `setAbbr` is not
         loaded, emit `"<field>[<i>] rejected: \"<value>\". Set
         \"<setAbbr>\" is not loaded."`
       - Otherwise emit `"<field>[<i>] rejected: \"<value>\".
         <Entity> slug \"<slug>\" not found in set
         \"<setAbbr>\"."`
  - Bare slugs (`black-widow`), display names (`Black Widow`), and
    flat-card keys (`core-hero-black-widow-1`) are ALL rejected by
    the parse step. The error message contract is locked above.
  - **Structural sub-function split (Finding 30).** Preserve the
    existing `// --- Shape validation: ... ---` comment-block
    sub-structure. As the per-field qualified-ID validation grows,
    extract `validateShape(input, errors)` and
    `validateExistence(input, registry, errors)` into named
    sub-functions to stay under the 30-line per-function limit per
    `00.6 §5`. No new abstractions — same convention already
    partially present.

- **`packages/game-engine/src/matchSetup.types.ts`** — modified
  (Finding 10 LOCKED):
  - Add a one-line JSDoc on each of the five entity-ID fields in
    `MatchSetupConfig` documenting the locked `<setAbbr>/<slug>`
    format and citing D-10014:
    ```ts
    /** Set-qualified slug — `<setAbbr>/<schemeSlug>`. D-10014. */
    schemeId: string;
    /** Set-qualified slug — `<setAbbr>/<mastermindSlug>`. D-10014. */
    mastermindId: string;
    // ... etc for villainGroupIds[], henchmanGroupIds[], heroDeckIds[]
    ```
  - Documentation-only change. No type-shape change. The 9-field
    lock (D-1244) is preserved.

- **`packages/game-engine/src/game.ts`** — modified (PS-3 LOCKED):
  - Widen `EMPTY_REGISTRY` at lines 56-58 to satisfy the widened
    `CardRegistryReader`:
    ```ts
    const EMPTY_REGISTRY: CardRegistryReader = {
      listCards: () => [],
      listSets: () => [],
      getSet: () => undefined,
    };
    ```
  - Add a `// why:` comment citing D-10014 and "satisfies wider
    CardRegistryReader for test-context skip path."
  - **Do NOT modify the `gameRegistry` guard at lines 201-210.**
    Server wiring (§A) is the runtime fix; the engine guard is
    preserved for test contexts that intentionally skip validation.

- **`packages/game-engine/src/villainDeck/villainDeck.setup.ts`** —
  modified:
  - Promote `extractVillainGroupSlug` (Class A) and
    `isVillainDeckRegistryReader` (guard) to named exports. No
    signature change.
  - Add new exported `listHenchmanGroupSlugsInSet(setData: unknown):
    string[]` (Class B) — returns `[]` on malformed `setData`.
  - Update `buildVillainDeck` to parse each `villainGroupIds` entry
    as `<setAbbr>/<groupSlug>` (import `parseQualifiedId` from
    `matchSetup.validate.ts` OR duplicate locally — author's choice;
    helper is small).
  - **Builder Filtering Order (PS-7).** Update internal iterators
    to accept `(setAbbr, slug)` and iterate the named set only:
    - `filterVillainCardsByGroupSlug` — filter by `setAbbr` first
      (top-level FlatCard field), then `extractVillainGroupSlug`
      within that set's cards only.
    - `findHenchmanGroupSlug` — receive `setAbbr` parameter; call
      `getSet(setAbbr)` once and iterate ONLY that set's
      `henchmen[]`. Throw if not found in the named set (no
      cross-set fallback).
    - `findSchemeSlug` — same pattern, constrained to the named
      set's `schemes[]`.

- **`packages/game-engine/src/mastermind/mastermind.setup.ts`** —
  modified:
  - Promote `isMastermindRegistryReader` (guard) to named export.
    No signature change.
  - Add new exported `listMastermindSlugsInSet(setData: unknown):
    string[]` (Class B) — iterates `setData.masterminds[].slug`;
    returns `[]` on malformed shape.
  - Update `buildMastermindState` to parse `mastermindId` as
    `<setAbbr>/<mastermindSlug>` at the builder boundary using
    `parseQualifiedId`.
  - **Builder Filtering Order (PS-7).** Update `findMastermindCards`
    to receive `setAbbr` parameter; call `getSet(setAbbr)` once;
    iterate ONLY that set's `masterminds[]`. No cross-set scan
    after parse.

- **`packages/game-engine/src/setup/buildSchemeSetupInstructions.ts`**
  — modified:
  - Promote `isSchemeRegistryReader` (guard) to named export. No
    signature change.
  - Add new exported `listSchemeSlugsInSet(setData: unknown):
    string[]` (Class B) — iterates `setData.schemes[].slug`;
    returns `[]` on malformed shape.
  - Update `buildSchemeSetupInstructions` to parse `schemeId` as
    `<setAbbr>/<schemeSlug>` at the builder boundary using
    `parseQualifiedId`.
  - **Builder Filtering Order (PS-7).** Any internal scheme lookup
    added (the MVP returns `[]` so this may remain a no-op) MUST
    constrain to the named set's `schemes[]`.

- **`packages/game-engine/src/setup/heroAbility.setup.ts`** — modified
  (this is the "hero-deck builder" per Q2 LOCKED):
  - Promote `extractHeroSlug` (Class A) and
    `isHeroAbilityRegistryReader` (guard) to named exports. No
    signature change.
  - Update `buildHeroAbilityHooks` to parse each `heroDeckIds` entry
    as `<setAbbr>/<heroSlug>` at the builder boundary using
    `parseQualifiedId`.
  - **Builder Filtering Order (PS-7).** Update the hero-card filter
    inside `buildHeroAbilityHooks` to filter `allFlatCards` by
    `setAbbr` first, then by `extractHeroSlug(card) === heroSlug`,
    iterating ONLY the named set's hero cards.

- **No signature change to the four builders' top-level entry
  points.** Each takes the same `MatchSetupConfig` slice it took
  before; only the internal parsing/matching changes.

### C) Silent-failure surfacing — setup-time diagnostics (Q3 LOCKED orchestration-only per PS-4)

**Pre-flight Q3 RESOLVED 2026-04-27:** none of the four setup
builders receives `G`. Emission inside any builder would require a
forbidden signature change. **Therefore the locked emission site
for ALL FOUR builders is the orchestration site
(`packages/game-engine/src/setup/buildInitialGameState.ts`).** The
Uniformity Rule is satisfied by orchestration-only emission — one
mode, one site, four builders treated identically.

**Implementation pattern in `buildInitialGameState.ts` (PS-4):**

1. Import the four exported registry-reader guards
   (`isVillainDeckRegistryReader` from `villainDeck.setup.ts`,
   `isMastermindRegistryReader` from `mastermind.setup.ts`,
   `isSchemeRegistryReader` from
   `setup/buildSchemeSetupInstructions.ts`,
   `isHeroAbilityRegistryReader` from `setup/heroAbility.setup.ts`).
2. Build a local `setupMessages: string[] = []` accumulator BEFORE
   constructing `baseState`.
3. Run each guard against `registry`. On `false`, push a
   full-sentence diagnostic to `setupMessages` naming:
   - **what was skipped** (which builder),
   - **why** (registry-reader interface incomplete / registry not
     injected by server),
   - **how to fix** (verify `setRegistryForSetup(registry)` was
     called at server startup OR that the test mock implements
     the full registry-reader interface).
4. Replace the `messages: []` literal in the existing `baseState`
   construction with `messages: setupMessages` (or assign
   post-construction — author's choice).
5. Add a single `// why:` comment block on the orchestration-side
   diagnostic emission referencing D-10014, the WP-100 smoke-test
   discovery, the Uniformity Rule, and "builder signatures don't
   accept G" rationale.

**Constraints (LOCKED):** no new state fields, no signature changes
to the four builders, no new `LegendaryGame.moves` entry, no new
phase hook (the four 01.5 triggers, all absent). The builders'
existing internal `isXRegistryReader → empty` fallbacks remain
unchanged (defense-in-depth — orchestration-side detection +
builder-side fallback both present).

**Builders surfaced:**
- **`packages/game-engine/src/villainDeck/villainDeck.setup.ts`** —
  detects `isVillainDeckRegistryReader → empty deck` path at
  orchestration.
- **`packages/game-engine/src/mastermind/mastermind.setup.ts`** —
  detects `isMastermindRegistryReader → minimal mastermind` path at
  orchestration.
- **`packages/game-engine/src/setup/buildSchemeSetupInstructions.ts`**
  — detects `isSchemeRegistryReader → []` path at orchestration
  (note: MVP returns `[]` even on success per D-2601, so the
  diagnostic fires only when the GUARD itself fails, not on every
  empty result).
- **`packages/game-engine/src/setup/heroAbility.setup.ts`** (the
  "hero-deck builder" per Q2 LOCKED) — detects
  `isHeroAbilityRegistryReader → []` path at orchestration.

### D) Tests (PS-6 test-count reconciliation LOCKED)

**Total minimum new tests: 35** (24 short of the previous WP estimate
of "+10" — that earlier number was understated; the reconciliation
below is authoritative).

- **`apps/server/src/server.mjs.test.ts`** — modified or created
  (**+1 test**):
  - One new test asserting that `startServer()` calls
    `setRegistryForSetup` with the loaded registry before constructing
    `Server()`. Use `mock.module` or a re-exported test seam to spy
    the call. Do NOT require deep boardgame.io constructor spying.
- **`packages/game-engine/src/matchSetup.validate.test.ts`** —
  modified (**≥30 new tests**):
  - **At least 25 new tests** organized as 5 per field category
    (5 fields × accept-qualified + reject-bare-slug + reject-display-
    name + reject-flat-card-key + reject-cross-set-collision-
    sensitivity):
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
  (and three peer files: `mastermind.setup.test.ts`,
  `buildSchemeSetupInstructions.test.ts`,
  `setup/heroAbility.setup.test.ts`) — modified (**+4 tests, one
  per builder**):
  - Add one regression test per builder asserting that on the
    `isXRegistryReader → empty` path, the orchestration-side
    diagnostic (per Q3 LOCKED) appears in `G.messages`. The test
    constructs an incomplete-interface mock registry, calls
    `buildInitialGameState` (NOT the builder directly — the
    diagnostic emission is at the orchestration site, not inside
    the builder), and asserts both the empty-state result AND the
    `G.messages` entry naming the skipped builder.
- **End-to-end loadout integration test** (new file:
  `packages/game-engine/src/setup/buildInitialGameState.loadout.test.ts`,
  **+1 test minimum, recommended ~3-4 tests**):
  - Constructs a real `MatchSetupConfig` with **set-qualified slugs**
    (e.g., `villainGroupIds: ['core/brotherhood']`), passes through
    `Game.setup()` with a fixture `CardRegistryReader` that exposes
    a small set of cards (satisfying ALL FOUR registry-reader
    interfaces), and asserts:
    - `G.villainDeck.deck.length > 0`
    - `G.mastermind.tacticsDeck.length > 0`
    - `G.cardStats` populated for the chosen cards
    - `G.messages` does NOT contain ANY of the four "skipped"
      diagnostic prefixes (substring match per builder, asserting
      none appear) — Finding 11 fold from copilot check.
  - This test is the structural prevention for the silent-empty-deck
    class of regression. Future engine WPs that touch setup helpers
    must keep it green.

**Reconciled test totals (PS-6):**
- New tests: ≥25 field-validation + ≥5 parse-error + 4 diagnostic
  regression + ≥1 loadout integration + 1 server wiring = **≥36 new
  tests** (engine ≥35 + server +1).
- Engine baseline: `524 → ≥559 / 117 / 0` (the `~555` figure cited
  elsewhere is approximate; the floor is 559).
- Server baseline: `47 → 48 / 7 / 0` pass; 16 skipped DB-tests
  preserved.
- Arena-client: `182 / 17 / 0` UNCHANGED.

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

## Files Expected to Change (PS-1..7 LOCKED — 14 files; hard cap 16)

**Engine modifications (10 files):**

- `packages/game-engine/src/matchSetup.types.ts` — modified —
  Finding 10 — JSDoc on each of the five entity-ID fields
  documenting `<setAbbr>/<slug>` format + D-10014 reference
- `packages/game-engine/src/matchSetup.validate.ts` — modified —
  PS-3 widen `CardRegistryReader`; add `parseQualifiedId` + 5
  `buildKnownXxxQualifiedIds` helpers; per-field alignment;
  Finding 24 deprecation marker on `buildKnownExtIds`; Finding 30
  structural sub-function split if length grows
- `packages/game-engine/src/matchSetup.validate.test.ts` — modified
  — ≥30 new tests + fixture migrations (each documented in test
  JSDoc with D-10014 reference)
- `packages/game-engine/src/game.ts` — modified — PS-3 — widen
  `EMPTY_REGISTRY` to `{ listCards, listSets, getSet }`. Do NOT
  modify the `gameRegistry` guard at lines 201-210.
- `packages/game-engine/src/setup/buildInitialGameState.ts` —
  modified — PS-4 / Q3 LOCKED — orchestration-side diagnostic
  accumulator; assigns to `baseState.messages`. No shape change.
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts` —
  modified — promote `extractVillainGroupSlug` (Class A) +
  `isVillainDeckRegistryReader` (guard) to exports; add new
  exported `listHenchmanGroupSlugsInSet` (Class B); update
  `filterVillainCardsByGroupSlug`, `findHenchmanGroupSlug`,
  `findSchemeSlug` to accept `(setAbbr, slug)` and iterate the
  named set only (PS-7)
- `packages/game-engine/src/villainDeck/villainDeck.setup.test.ts`
  — modified — orchestration-side diagnostic-presence regression
  test
- `packages/game-engine/src/mastermind/mastermind.setup.ts` —
  modified — promote `isMastermindRegistryReader` (guard) to
  export; add new exported `listMastermindSlugsInSet` (Class B);
  update `findMastermindCards` to accept `(setAbbr, slug)` and
  iterate the named set only (PS-7)
- `packages/game-engine/src/mastermind/mastermind.setup.test.ts` —
  modified — orchestration-side diagnostic-presence regression
  test
- `packages/game-engine/src/setup/buildSchemeSetupInstructions.ts`
  — modified — promote `isSchemeRegistryReader` (guard) to export;
  add new exported `listSchemeSlugsInSet` (Class B); parse
  `<setAbbr>/<schemeSlug>` at builder boundary (PS-7)
- `packages/game-engine/src/setup/buildSchemeSetupInstructions.test.ts`
  — modified — orchestration-side diagnostic-presence regression
  test
- `packages/game-engine/src/setup/heroAbility.setup.ts` —
  modified — Q2 LOCKED — promote `extractHeroSlug` (Class A) +
  `isHeroAbilityRegistryReader` (guard) to exports; update hero-card
  filter to filter by `setAbbr` first, then hero slug (PS-7)
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` —
  modified or created if absent — orchestration-side
  diagnostic-presence regression test (note: this file may not
  yet exist as `heroAbility.setup.test.ts` per current Glob —
  if the existing test file uses a different name like
  `rules/heroAbility.setup.test.ts`, modify in place; do NOT
  create a duplicate)
- `packages/game-engine/src/setup/buildInitialGameState.loadout.test.ts`
  — **new** — end-to-end loadout integration test

**Server modifications (2 files):**

- `apps/server/src/server.mjs` — modified — PS-5 — minimal diff
  (import addition + Promise.all destructure rename + call site +
  `// why:` comment)
- `apps/server/src/server.mjs.test.ts` — new or modified — wiring
  test

**Total: 14 modified-or-new files.** Hard cap: 16. If scope grows
beyond 16, STOP and escalate.

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
- [ ] Engine baseline `524 / 116 / 0` → `≥559 / 117 / 0` (PS-6 reconciled — minimum +35 tests, +1 suite: ≥25 per-field validator tests + ≥5 parse-error tests + 4 diagnostic-presence regression tests + ≥1 loadout integration test). Higher counts are fine; the floor is 559.
- [ ] Server baseline `47 / 7 / 0` pass → `48 / 7 / 0` pass (one new wiring test); 16 skipped DB-tests preserved
- [ ] arena-client baseline `182 / 17 / 0` UNCHANGED — this WP doesn't touch the client

### End-to-end smoke test
- [ ] Manual smoke test with **bare-slug loadout JSON** (e.g.,
      `villainGroupIds: ["brotherhood"]`) FAILS at match creation
      with a validator error message naming the qualified-ID format
      and an example (e.g., `"core/brotherhood"`). Per the Qualified
      IDs Are Exclusive lock, the bare-slug JSON must NOT produce a
      match at all — successful match creation here is a contract
      violation, not an acceptable outcome.
- [ ] Manual smoke test with **set-qualified loadout JSON** (e.g.,
      `villainGroupIds: ["core/brotherhood"]`) succeeds at match
      creation, AND clicking **Reveal** in `start` stage produces a
      villain or henchman card in the City row (not a "Villain deck
      reveal skipped" log entry).
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

# Step 10 — manual smoke test, two cases (per the smoke-test
# acceptance criteria above):
#   (a) bare-slug loadout JSON: match creation FAILS with a validator
#       error naming the qualified-ID format. (NOT an acceptable
#       success — bare slugs are exclusive-rejected by D-10014.)
#   (b) set-qualified loadout JSON: match creation succeeds; click
#       Reveal in `start` and verify a villain appears in City;
#       fightVillain defeats target; fightMastermind decrements
#       tactics.
# (run pwsh scripts/Start-SmokeTest.ps1 -KillStaleListeners for both)
```

---

## Definition of Done

This packet is complete when ALL of the following are true:

- [ ] All acceptance criteria above pass
- [ ] `pnpm -r build` exits 0
- [ ] `pnpm --filter @legendary-arena/game-engine test` exits 0
- [ ] `pnpm --filter @legendary-arena/server test` exits 0
- [ ] `pnpm --filter @legendary-arena/arena-client test` exits 0 (baseline preserved)
- [ ] Manual smoke test (bare-slug case): match creation FAILS with a validator format error naming the qualified-ID form
- [ ] Manual smoke test (set-qualified case): match creation succeeds; clicking **Reveal** in `start` stage produces a villain or henchman in the City (not a log entry); `fightVillain` defeats the target; `fightMastermind` decrements tactics
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

1. **Q1 RESOLVED 2026-04-27 (pre-flight) → Option (a) + PS-3
   widening.** Validator delegates to builder-owned slug-source
   helpers (Class A key-decoders + Class B set-data slug iterators
   per PS-2). `CardRegistryReader` widened in-place to
   `{ listCards, listSets, getSet }` (Option (i)). Pivot to (b) is
   forbidden without WP body amendment + new pre-flight. Pre-flight
   verified per-builder feasibility: villain group + hero use Class
   A (existing extractors); mastermind + scheme + henchman use
   Class B (new exported iterators). Logged in D-10014 at Commit B.
2. **Q2 RESOLVED 2026-04-27 (pre-flight) → `setup/heroAbility.setup.ts`
   (PS-1).** The "hero-deck builder" is `buildHeroAbilityHooks` in
   `packages/game-engine/src/setup/heroAbility.setup.ts`. There is
   no separate hero-deck-construction file; `heroDeckIds` is
   consumed only by `buildHeroAbilityHooks`. Slug-extractor is
   `extractHeroSlug` (currently local, promoted to export per PS-2).
   Files-Expected-to-Change list updated.
3. **Q3 RESOLVED 2026-04-27 (pre-flight) → Orchestration-only for
   ALL FOUR builders (PS-4).** None of the four builders receives
   `G` (verified by reading `buildVillainDeck`,
   `buildMastermindState`, `buildSchemeSetupInstructions`,
   `buildHeroAbilityHooks` signatures). Emission inside any builder
   would require a forbidden signature change. The Uniformity Rule
   is satisfied by orchestration-only emission in
   `setup/buildInitialGameState.ts` (one mode, one site, four
   builders). Implementation pattern locked in §Scope (In) §C.
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
7. **(Pre-flight LOGGED.) `buildKnownExtIds` post-WP-113 fate
   (Finding 24).** After WP-113 lands, `buildKnownExtIds` has no
   consumers — all five entity-ID fields use
   `buildKnownXxxQualifiedIds`. Retained in this WP for one release
   cycle as a forensic-debugging aid with a deprecation `// why:`
   comment. A follow-up cleanup WP should remove it.
8. **(Pre-flight LOGGED.) Stringly-typed validator error kinds
   (Copilot Finding 13).** The per-field error kinds ("format
   invalid", "set not loaded", "slug not in that set") are
   stringly-typed in error messages. Adding a discriminated-union
   `ValidationErrorKind = 'shape' | 'format' | 'set-not-loaded' |
   'slug-not-in-set'` to `MatchSetupError` would lock the error
   shape compile-time. Out of scope for WP-113 (touches
   `matchSetup.types.ts` contract surface beyond the JSDoc-only
   change in Finding 10); deferred to a follow-up WP. Document the
   deferral in D-10014.

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
- **Pre-flight 2026-04-27 — READY TO EXECUTE conditional on PS-1..8.**
  Eight scope-neutral pre-session actions resolved into this WP body
  + EC-113:
  - PS-1 (Q2 path): hero-deck builder = `setup/heroAbility.setup.ts`.
  - PS-2 (slug-source semantics): split into Class A key-decoders
    + Class B set-data iterators; three new exported `listXxxSlugsInSet`
    helpers added.
  - PS-3 (`CardRegistryReader` widening): Option (i) widen-in-place
    to `{ listCards, listSets, getSet }`; `EMPTY_REGISTRY` widened
    in `game.ts`.
  - PS-4 (Q3 emission site): orchestration-only in
    `setup/buildInitialGameState.ts` (forced — no builder receives
    `G`); four registry-reader guards exported.
  - PS-5 (server minimal diff): destructure rename `[, , parGate]`
    → `[registry, , parGate]` is part of the minimal diff.
  - PS-6 (test counts): reconciled to engine `≥559 / 117 / 0`
    (≥+35 tests, +1 suite); server `48 / 7 / 0` pass (+1 wiring).
  - PS-7 (builder internal-iterator updates): `filterVillainCardsByGroupSlug`,
    `findHenchmanGroupSlug`, `findSchemeSlug`, `findMastermindCards`,
    and the hero-card filter in `buildHeroAbilityHooks` all updated
    to accept `(setAbbr, slug)` and iterate the named set only.
  - PS-8 (collision re-probe): re-measure all four collision counts
    at session start; record measured numbers in D-10014. Original
    "11/584 mastermind" figure is probe-shape-dependent; 23/279 hero
    is verified.
  - Plus three copilot folds: Finding 10 (`MatchSetupConfig` field
    JSDoc), Finding 24 (`buildKnownExtIds` deprecation marker),
    Finding 30 (validator structural sub-function split).
- Final file scope: 14 modified-or-new files (hard cap 16).
- Authorized to generate session execution prompt next.
