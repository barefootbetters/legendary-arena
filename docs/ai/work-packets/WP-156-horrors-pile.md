# WP-156 — Horrors Pile

## Goal

Graduate the WP-128 safe-skip site `piles.horrorsCount` by adding a
`horrors: Zone` field to `GlobalPiles` and wiring deterministic setup-time
initialization (MVP: empty invariant) for scenarios that use the Horrors
mechanic. Removes one
`// SAFE-SKIP-WP128` marker from `uiState.build.ts` and replaces the
hardcoded `0` with a real count derived from `G.piles.horrors.length`.

## Assumes

- WP-128 (UIState Projection Extensions for Board Layout) is complete.
  `uiState.build.ts` contains the `// SAFE-SKIP-WP128` marker at the
  `horrorsCount` assignment site. `uiState.types.ts` defines
  `UISharedPilesState.horrorsCount: number` (always present, default `0`
  per D-12802).
- WP-135 (HQ Population & Hero Deck Reservoir) is complete — graduation
  template pattern.
- WP-155 (Turn Economy: Piercing and Wounds Drawn) is complete — the two
  economy safe-skip markers are graduated before this WP executes.
- `packages/game-engine/src/state/zones.types.ts` exports `GlobalPiles`
  with fields: `bystanders`, `wounds`, `officers`, `sidekicks`.
- No existing Horrors support exists anywhere in the game engine.
- The Horrors mechanic is scenario-dependent: the pile is populated at
  setup time only when the selected scheme requires it. MVP: pile is
  always empty (`[]`) for all scenarios — the field exists for the
  projection contract and future scheme WPs.

## Context (Read First)

**Baseline:** `origin/main` at `00e179c` (2026-05-16).

- `docs/ai/ARCHITECTURE.md` §Layer Boundary — game-engine layer rules
- `docs/ai/DECISIONS.md` — D-12802 (`piles.horrorsCount` always present,
  default `0`), D-12806 (safe-skip resolution)
- `docs/ai/post-mortems/01.6-WP-135-hq-population-and-hero-deck-reservoir.md`
  — graduation template pattern
- `docs/ai/work-packets/WP-128-uistate-projection-extensions-for-board-layout.md`
  §Scope B Safe-Skip Resolutions — `piles.horrorsCount` row
- `packages/game-engine/src/state/zones.types.ts` — current `GlobalPiles`
  shape
- `.claude/rules/game-engine.md` — G serialization, zone rules
- `.claude/rules/code-style.md` — naming, comments, function size

## Scope (In)

- Add `horrors: Zone` field to `GlobalPiles` in `zones.types.ts`
- Initialize `G.piles.horrors` as `[]` in `buildInitialGameState`
  (MVP: always empty — no scheme currently populates Horrors)
- Graduate the `uiState.build.ts` projection: replace hardcoded `0`
  with `gameState.piles.horrors.length`, remove the
  `// SAFE-SKIP-WP128` marker
- Update zone validation (`zones.validate.ts`) to include `horrors` in
  the `GlobalPiles` shape check
- Add/update tests for the new G field, setup initialization, zone
  validation, and projection
- 01.5 cascade: update `computeStateHash` replay fixture literal
- DECISIONS.md entry

## Out of Scope

- Scheme-specific Horrors population logic (future scheme WPs will
  define which schemes populate the Horrors pile and with what cards)
- Horrors-specific gameplay mechanics (draw, resolve, discard of Horror
  cards) — future WP scope
- Adding a `horrorsCount` field to `MatchSetupConfig` (the pile is
  scheme-controlled, not user-configured)
- Destination piles — that is WP-153 scope
- Mastermind bystanders — that is WP-154 scope
- Economy extensions — that is WP-155 scope
- Any UI or client-side rendering changes

## Files Expected to Change

- `packages/game-engine/src/state/zones.types.ts` — modified — add
  `horrors: Zone` to `GlobalPiles`
- `packages/game-engine/src/setup/buildInitialGameState.ts` (or
  equivalent setup file) — modified — initialize `piles.horrors` as `[]`
- `packages/game-engine/src/state/zones.validate.ts` — modified —
  include `horrors` in structural validation
- `packages/game-engine/src/ui/uiState.build.ts` — modified — graduate
  safe-skip site with real projection
- `packages/game-engine/src/ui/uiState.build.test.ts` — modified — flip
  safe-skip value assertion to real projected value
- `packages/game-engine/src/state/zones.validate.test.ts` — modified —
  add `horrors` to validation test fixtures
- `packages/game-engine/src/replay/replay.execute.test.ts` — modified —
  update hash literal (01.5 cascade)
- `docs/ai/DECISIONS.md` — modified — D-156xx entry
- `docs/ai/STATUS.md` — modified — dated completion entry
- `docs/ai/work-packets/WORK_INDEX.md` — modified — check off WP-156

## Contract

This WP locks the following data surface:

- `GlobalPiles` gains one new field: `horrors: Zone` (i.e., `CardExtId[]`).
  Existing fields (`bystanders`, `wounds`, `officers`, `sidekicks`) are
  unchanged.
- `G.piles.horrors` is initialized as `[]` in `buildInitialGameState`.
  No second initialization path exists.
- `UISharedPilesState.horrorsCount` projection switches from hardcoded
  `0` to live `gameState.piles.horrors.length`. No UI contract change —
  the type was already locked by WP-128 (D-12802).
- Zone validation (`zones.validate.ts`) gains structural assertions for
  `horrors`: existence, array type, `CardExtId`-string entries.
- The pile is inert in MVP: no move, effect, or hook reads or mutates
  `G.piles.horrors`. Activation deferred to future scheme WPs.

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file — no diffs, no snippets
- ESM only, Node v22+
- Human-style code — see `docs/ai/REFERENCE/00.6-code-style.md`
- All randomness via `ctx.random.*` — never `Math.random()`
- `G` must remain JSON-serializable at all times
- Moves never throw — only `Game.setup()` may throw
- All zones store `CardExtId` strings only
- No `.reduce()` in zone operations or effect application
- No `boardgame.io` imports in pure helpers
- Every `ctx.events.setPhase()` and `ctx.events.endTurn()` call needs a
  `// why:` comment

**Packet-specific:**
- `horrors` is `Zone` (i.e., `CardExtId[]`) — consistent with existing
  `GlobalPiles` field types
- MVP: pile is always `[]` for all scenarios — no scheme currently
  populates it. The field exists to close the projection contract.
  Future scheme WPs will add population logic.
- `horrorsCount` in UIState is always `gameState.piles.horrors.length`
  — never a separate counter
- D-12802 is satisfied: `horrorsCount` is always present with `0`
  default (now derived from `.length` instead of hardcoded)
- 01.5 IS INVOKED — new G field changes `computeStateHash`
- No move or effect in this WP may read or mutate `G.piles.horrors`
  — the pile remains inert until explicitly activated by a future WP

**Canonical Rule — Horrors Pile:**
- `G.piles.horrors` is a non-player-owned global zone
- Cards placed here MUST originate from setup-time scheme-defined logic only
- No moves, draws, or mutations are allowed in this WP
- The pile MUST remain untouched during gameplay in MVP (read-only after setup)

**Setup Responsibility:**
- Initialization occurs in the same location responsible for constructing
  `G.piles` (currently `buildInitialGameState.ts`)
- Do not introduce a second initialization path

**Forward Compatibility Constraint:**
- Future scheme WPs MUST populate `G.piles.horrors` during setup only
  (not mid-game)
- Population logic MUST occur before any gameplay phases begin
- This WP must not introduce any hooks, callbacks, or conditional logic
  for scheme-driven population

**Zone Validation Contract:**
- Validation MUST assert:
  - `horrors` exists on `G.piles`
  - `horrors` is an array
  - All entries are `CardExtId` strings
- Validation MUST fail if:
  - `horrors` is missing
  - `horrors` is not an array
  - any entry is not a `CardExtId` string

**01.5 Cascade Constraint:**
- Replay hash changes MUST be attributable ONLY to the addition of
  `piles.horrors`
- Expected state shape delta: `G.piles` gains `horrors: []` — no other
  top-level or nested structure changes are permitted
- No gameplay behavior or sequencing changes are permitted
- Hash update must include `// why:` comment documenting this exact cause

**Session protocol:**
- Stop and ask on unclear items — never guess

**Locked contract values:**
- `UISharedPilesState.horrorsCount: number` — locked by WP-128
- Existing `GlobalPiles` fields (`bystanders`, `wounds`, `officers`,
  `sidekicks`) — unchanged

## Acceptance Criteria

- [ ] `GlobalPiles` in `zones.types.ts` has a `horrors: Zone` field
- [ ] `G.piles.horrors` initialized as `[]` in `buildInitialGameState`
- [ ] `G.piles.horrors.length === 0` after setup (MVP guarantee)
- [ ] `G.piles.horrors` contains only `CardExtId` strings (validated via zone validation tests)
- [ ] Zone validation in `zones.validate.ts` checks `horrors` field
- [ ] `uiState.build.ts` projects `piles.horrorsCount` from `gameState.piles.horrors.length`
- [ ] One `// SAFE-SKIP-WP128` marker removed from `uiState.build.ts`
- [ ] `uiState.build.ts` projection returns `0` for `horrorsCount` when `piles.horrors` is empty
- [ ] No move or effect reads or mutates `G.piles.horrors`
- [ ] `rg "piles\.horrors" packages/game-engine/src --glob "*.ts"` returns matches ONLY in:
  `zones.types.ts`, `buildInitialGameState.ts`, `zones.validate.ts`, `uiState.build.ts`,
  and associated test files
- [ ] `pnpm --filter game-engine test` passes with no failures

## Vision Alignment

**Vision clauses touched:** §3 (determinism).

No conflict: this WP preserves all touched clauses. The Horrors pile
is initialized deterministically (empty array) and projected as a
count. No gameplay mechanics added.

**Non-Goal proximity check:** NG-1..7 not crossed.

**Determinism preservation:** empty-array initialization is trivially
deterministic. No new randomness source.

## Funding Surface Gate

N/A — engine-only G-state extension; no UI surfaces, no user-visible
copy, no funding channels referenced.

## API Catalog (§21)

N/A — no HTTP endpoints touched, no `apps/server/src/**` library
functions added or modified.

## Verification Steps

```pwsh
pnpm --filter game-engine test
# Expected: all tests pass, no failures

# Verify safe-skip marker removed
rg "SAFE-SKIP-WP128" packages/game-engine/src/ui/uiState.build.ts --count
# Expected: count reduced by 1 from pre-WP-156 baseline
```

## Definition of Done

- [ ] All acceptance criteria pass
- [ ] `docs/ai/STATUS.md` updated with what changed
- [ ] `docs/ai/DECISIONS.md` updated with D-156xx entry
- [ ] `docs/ai/work-packets/WORK_INDEX.md` has WP-156 checked off
- [ ] No files outside the "Files Expected to Change" list were modified
- [ ] 01.5 cascade resolved — replay hash literal updated with `// why:` comment

## Lint Gate Self-Review

| § | Verdict | Notes |
|---|---|---|
| 1 | PASS | All required sections present |
| 2 | PASS | Engine-wide + packet-specific constraints; full-file output required; references 00.6 |
| 3 | PASS | WP-128, WP-135, WP-155 dependencies listed; file shapes enumerated |
| 4 | PASS | ARCHITECTURE.md, DECISIONS.md, zones.types.ts, rules files cited |
| 5 | PASS | 10 files listed with modified annotations and descriptions |
| 6 | N/A | No new naming conflicts; field names match existing GlobalPiles pattern |
| 7 | N/A | No new npm dependencies |
| 8 | PASS | Engine-only; no server/persistence/registry boundary crossed |
| 9 | PASS | Verification uses `pnpm` and `rg` (Windows-compatible) |
| 10 | N/A | No environment variables touched |
| 11 | N/A | No authentication surfaces |
| 12 | PASS | Tests use `node:test`; no boardgame.io imports in pure helpers |
| 13 | PASS | Exact pnpm commands with expected output shown |
| 14 | PASS | 11 binary, observable acceptance criteria |
| 15 | PASS | DoD includes STATUS.md, DECISIONS.md, WORK_INDEX.md, scope-boundary check |
| 16 | PASS | No new abstractions; explicit control flow required; naming conventions enforced |
| 17 | PASS | Vision Alignment section present; §3 cited; determinism line included |
| 18 | PASS | No literal-string-scoped grep gates that could trip on prose |
| 19 | N/A | No repo-state-summarizing artifacts authored |
| 20 | PASS | N/A justified: engine-only G-state extension; no UI surfaces, no user-visible copy, no funding channels |
| 21 | PASS | N/A justified: no HTTP endpoints touched, no `apps/server/src/**` library functions added or modified |
