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
2. **Validator and builder disagree about ID format.** Even when the
   registry is wired (e.g., in test contexts that bypass server
   wiring), `validateMatchSetup` builds its `knownExtIds` set from
   `registry.listCards()` keys ([matchSetup.validate.ts:82-88](packages/game-engine/src/matchSetup.validate.ts))
   — full flat-card keys like `core-villain-brotherhood-blob` — and
   rejects any field entry not in that set. But `buildVillainDeck`
   ([villainDeck.setup.ts:165-175](packages/game-engine/src/villainDeck/villainDeck.setup.ts))
   expects `villainGroupIds` to contain **bare group slugs** like
   `brotherhood` (extracted from card keys via
   `extractVillainGroupSlug`). The two surfaces are contradictory: any
   payload that satisfies one fails the other. The same mismatch
   applies to `henchmanGroupIds`, and to a lesser extent `schemeId` /
   `mastermindId` / `heroDeckIds` (whose ID formats also need
   verification).

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
  after `loadRegistry()` resolves and BEFORE `Server({ games:
  [LegendaryGame], ... })` is constructed. boardgame.io's setup
  invocation can fire as soon as the server starts accepting
  POST /create requests, so the engine must already see the
  registry by then.
- `validateMatchSetup` retains its existing structural validation
  (9 fields present, types correct, counts non-negative). Only the
  registry-existence-check loops are restructured to recognize
  group slugs vs flat-card keys vs whatever each field actually
  needs. Existing engine tests pass without modification (or with
  documented test-data updates if the test fixtures used the wrong
  ID format).
- `extractVillainGroupSlug` (currently a private helper in
  `villainDeck.setup.ts`) is promoted to an export so
  `matchSetup.validate.ts` can consume it. Same for any
  henchman / mastermind / scheme equivalents. The exports are
  type-stable (no signature change) and live alongside the
  existing builder.
- The four `isXRegistryReader` guards in
  `buildVillainDeck` / `buildMastermindState` /
  `buildSchemeSetupInstructions` / hero-deck construction either
  (a) remain as silent-empty fallbacks (existing test mocks rely
  on them) AND additionally push a `G.messages` entry naming the
  gap, OR (b) throw if `Game.setup()` is the runtime path (detect
  via a flag passed in from `setup()`). Author chooses; option (a)
  is the safer minimum.
- No changes to `LegendaryGame.moves` registration, lobby phase
  configuration, or any UI code in `apps/arena-client/`. WP-113 is
  strictly server-wiring + engine-validation alignment. The arena-
  client smoke test is the verification surface, not the change
  surface.

**Locked contract values (do not paraphrase or re-derive):**

- **Server-engine wiring sequence** (locked):
  1. `loadRegistry()` resolves → `registry` in scope
  2. `setRegistryForSetup(registry)` called immediately after
  3. `loadRules()` and `createParGate()` resolve in parallel
  4. `Server({ games: [LegendaryGame], ... })` constructed
  5. `server.run({ port })` — accepts requests
- **Validator field categories** (verified against engine source
  2026-04-27 — confirm at pre-flight):
  - `schemeId`: bare slug (e.g., `midtown-bank-robbery`) — buildScheme
    expects this; verified by inspecting setData.schemes[].slug pattern
  - `mastermindId`: bare slug (e.g., `magneto`) — buildMastermind
    expects this; verify at execution time
  - `villainGroupIds`: bare group slugs (e.g., `[brotherhood]`) —
    buildVillainDeck calls `extractVillainGroupSlug` to filter
  - `henchmanGroupIds`: bare henchman slugs (e.g., `[hand-ninjas]`) —
    verify the format against henchman builder code at execution time
  - `heroDeckIds`: bare hero slugs (e.g., `[spider-man, hulk, ...]`)
    — verify the format against hero-deck builder code at execution
    time
- **Silent-failure surfacing minimum** (locked): each of the four
  setup helpers' early-return paths gains AT LEAST a `G.messages`
  entry with a full-sentence message naming what was skipped and
  why. The arena-client HUD already renders `G.messages` (via the
  log panel from WP-064), so the entry is observable in smoke
  testing. Throwing is permitted but not required.

---

## Scope (In)

### A) Server registry wiring — `apps/server/src/server.mjs`

- **`apps/server/src/server.mjs`** — modified:
  - Add `setRegistryForSetup` to the existing
    `import { LegendaryGame } from '@legendary-arena/game-engine'`
    line. The export already exists (verified 2026-04-27).
  - Inside `startServer()`, after `loadRegistry()` resolves and
    BEFORE the `Server({ games: [LegendaryGame], ... })` constructor
    call, insert:
    ```js
    setRegistryForSetup(registry);
    ```
  - Add a `// why:` comment naming D-10014 and the WP-100 smoke-test
    discovery that surfaced the gap.
  - **One-line code change + comment block.** No other modifications
    to `server.mjs`. No changes to `index.mjs`, `rules/loader.mjs`,
    `par/parGate.mjs`, or any other server file.

### B) Validator alignment — `packages/game-engine/src/matchSetup.validate.ts`

- **`packages/game-engine/src/matchSetup.validate.ts`** — modified:
  - The existing `buildKnownExtIds(registry)` function returns a
    `Set<string>` of flat-card keys. Keep it as-is (some fields may
    legitimately consume flat-card keys).
  - Add new helpers:
    - `buildKnownVillainGroupSlugs(registry): Set<string>` — extracts
      group slugs from villain card keys via the (now-exported)
      `extractVillainGroupSlug` from `villainDeck.setup.ts`.
    - `buildKnownHenchmanGroupSlugs(registry): Set<string>` — same
      pattern for henchmen.
    - `buildKnownSchemeSlugs(registry): Set<string>` — same for
      schemes.
    - `buildKnownMastermindSlugs(registry): Set<string>` — same for
      masterminds.
    - `buildKnownHeroSlugs(registry): Set<string>` — same for heroes.
  - Restructure the per-field validation loops:
    - `schemeId`: validate against `buildKnownSchemeSlugs`.
    - `mastermindId`: validate against `buildKnownMastermindSlugs`.
    - `villainGroupIds[]`: validate each entry against
      `buildKnownVillainGroupSlugs`.
    - `henchmanGroupIds[]`: validate each entry against
      `buildKnownHenchmanGroupSlugs`.
    - `heroDeckIds[]`: validate each entry against
      `buildKnownHeroSlugs`.
  - Error messages remain full-sentence and field-specific (the
    existing pattern). Each error names the field, the rejected
    value, and the canonical format the validator expected ("group
    slug", "card key", etc.).

- **`packages/game-engine/src/villainDeck/villainDeck.setup.ts`** —
  modified:
  - Promote `extractVillainGroupSlug` from internal helper to named
    export. No signature change. Add JSDoc noting external consumers.
- **`packages/game-engine/src/mastermind/mastermind.setup.ts`**,
  `packages/game-engine/src/setup/buildSchemeSetupInstructions.ts`,
  and the hero-deck setup file — modified:
  - Each promotes its slug-extraction helper to a named export, OR if
    no such helper exists yet, creates one with a `// why:` comment
    citing D-10014's "single source of truth for ID format"
    discipline.

### C) Silent-failure surfacing — four setup helpers

- **`packages/game-engine/src/villainDeck/villainDeck.setup.ts`** —
  modified:
  - The existing `if (!isVillainDeckRegistryReader(registry)) return
    { state: { deck: [], discard: [] }, cardTypes: {} };` early
    return gets a `G.messages.push(...)` call BEFORE the return,
    naming the gap: `"buildVillainDeck skipped: registry interface
    incomplete (missing listCards / listSets / getSet). Match was
    created without a usable card registry."`
  - Same `// why:` comment block referencing D-10014 and the WP-100
    smoke-test discovery.
- **`packages/game-engine/src/mastermind/mastermind.setup.ts`** —
  modified:
  - Same pattern for `isMastermindRegistryReader` early return.
- **`packages/game-engine/src/setup/buildSchemeSetupInstructions.ts`**
  — modified:
  - Same pattern for the registry-reader guard if present.
- **Hero-deck builder** — modified:
  - Same pattern.

These pushes happen at setup time (within `Game.setup()`), so they
end up in the initial `G.messages` and are visible from the very
first UIState frame — the arena-client HUD's log panel renders them
without further wiring.

### D) Tests

- **`apps/server/src/server.mjs.test.ts`** — modified or created:
  - One new test asserting that `startServer()` calls
    `setRegistryForSetup` with the loaded registry before constructing
    `Server()`. Mocks the import to spy the call.
- **`packages/game-engine/src/matchSetup.validate.test.ts`** —
  modified:
  - Five new tests, one per field-category, each asserting that the
    correct slug-set helper is consulted:
    - `validateMatchSetup accepts schemeId as a bare scheme slug`
    - `validateMatchSetup rejects schemeId given as a flat-card key`
    - `validateMatchSetup accepts villainGroupIds as bare group slugs`
    - (similar for mastermind / henchman / hero — 5 total minimum)
  - Existing tests that used flat-card keys for these fields are
    updated to use slugs. Document each fixture change in the test
    file's top JSDoc with a `D-10014` reference.
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

Estimated 12 files. Final count locked at pre-flight.

---

## Acceptance Criteria

### Server wiring
- [ ] `apps/server/src/server.mjs` imports `setRegistryForSetup` from `@legendary-arena/game-engine`
- [ ] `startServer()` calls `setRegistryForSetup(registry)` after `loadRegistry()` resolves and before `Server({ games: [LegendaryGame] })`
- [ ] A `// why:` comment names D-10014 and the WP-100 smoke-test discovery
- [ ] Server-side test verifies the call ordering

### Validator alignment
- [ ] `validateMatchSetup` validates `schemeId` against scheme slugs (not flat-card keys)
- [ ] `validateMatchSetup` validates `mastermindId` against mastermind slugs
- [ ] `validateMatchSetup` validates each `villainGroupIds[]` entry against villain group slugs
- [ ] `validateMatchSetup` validates each `henchmanGroupIds[]` entry against henchman group slugs
- [ ] `validateMatchSetup` validates each `heroDeckIds[]` entry against hero slugs
- [ ] Bare-slug loadouts (`villainGroupIds: ['brotherhood']`, `mastermindId: 'magneto'`, etc.) pass the validator
- [ ] Flat-card-key loadouts (`villainGroupIds: ['core-villain-brotherhood-blob']`) FAIL the validator with a "rejected: did not match any known group slug" error message
- [ ] Field-specific error messages name the rejected value and the canonical format

### Silent-failure surfacing
- [ ] `buildVillainDeck`'s `isVillainDeckRegistryReader` early-return pushes a full-sentence `G.messages` entry
- [ ] `buildMastermindState`'s `isMastermindRegistryReader` early-return pushes a full-sentence `G.messages` entry
- [ ] `buildSchemeSetupInstructions`'s registry-reader early-return pushes a full-sentence `G.messages` entry
- [ ] Hero-deck builder's registry-reader early-return pushes a full-sentence `G.messages` entry
- [ ] Each message names the gap and the path to fix it (e.g., "Match was created without a usable card registry. Verify that the server called setRegistryForSetup before accepting create requests.")

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

1. **(Pre-flight resolution required.) Validator delegation strategy
   (a) vs (b).** Author commits to (a) at draft time (validator
   imports builder slug-extractors). At pre-flight, verify that the
   four setup helpers can each expose a single slug-extractor that
   matches the validator's needs. If any helper's slug semantics are
   too coupled to its builder logic to expose cleanly (e.g., scheme
   setup also resolves campaign instructions), author may pivot to
   (b) and define a shared ID-resolution layer. The decision is
   logged in DECISIONS as part of D-10014.
2. **(Pre-flight resolution recommended.) Hero-deck builder
   location.** The hero-deck setup file path is not visible from a
   quick grep — author locates and reads it at pre-flight, confirms
   the slug convention matches the canonical pattern, and updates
   the §Files Expected to Change list with the resolved path.
3. **(Resolved at draft time.) 01.5 not invoked.** All four triggers
   absent — no new `LegendaryGameState` field, no
   `buildInitialGameState` shape change (config still has the same 9
   fields with the same types), no new `LegendaryGame.moves` entry,
   no new phase hook. The validator's per-field semantics change
   their interpretation of strings; the type signatures are
   unchanged.
4. **(Acknowledged-deferred.) Engine integration harness.** D-10010
   and D-10013 both flagged the need for an in-process `Server() +
   Client()` simulation harness as the structural prevention for
   smoke-test-only-discoverable regressions. WP-113 doesn't build
   that harness — its loadout integration test (§Scope D, end-to-end
   `Game.setup()` flow) is a tactical surrogate. A separate
   infrastructure WP should follow.
5. **(Acknowledged-deferred.) Three scaffold-artifact buttons in
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
