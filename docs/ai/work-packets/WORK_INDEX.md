# Work Index — Legendary Arena

> **Authoritative execution order for all AI-assisted development sessions.**
> One Work Packet per Claude Code session. Update this file at the end of every
> session — check off completed packets, add new ones as they are defined.
>
> **Location note:** This file lives at `docs/ai/work-packets/WORK_INDEX.md`.
> All references in the coordination system (00.1, CLAUDE.md) point here.

---

## Format

```
- [ ] WP-NNN — Short Title — [pending | in-progress | blocked: reason]
- [x] WP-NNN — Short Title — Completed YYYY-MM-DD
```

**Rules:**
- One Work Packet per Claude Code session — never combine two packets in one session
- Packets must be executed in dependency order unless explicitly noted as parallel
- A packet may not be executed until all listed dependencies are complete
- Status is updated only when the packet's `## Definition of Done` is fully met

---

## Review Status Legend

| Mark | Meaning |
|------|---------|
| ✅ Reviewed | Packet has been audited: SharePoint links removed, all required sections present, verified against conventions |
| ⚠️ Needs review | Packet has NOT been audited — likely contains SharePoint links, missing Definition of Done, `.mjs` test paths |

All existing WPs through WP-060 are marked ✅ Reviewed. WP-048 through WP-054, WP-055, and WP-060 were audited during the 2026-04-15 Standardization Completeness Pass (no issues found). WP-061 through WP-064 were drafted 2026-04-16 as a UI-implementation chain and passed the lint-gate review (00.3) the same day: Vitest option removed in favor of `node:test`-only per §7/§12; verification code fences switched to `pwsh` and Windows paths per §9; forbidden-packages block added explicitly per §7; WP-063 determinism check now uses `Compare-Object` instead of Unix `diff`. WP-065 was added 2026-04-16 as a hard prerequisite for the UI chain: a shared `packages/vue-sfc-loader/` that makes `.vue` SFCs importable under `node:test` (the lint-forbidden Vitest escape hatch is replaced by this internal loader). WP-079 was added 2026-04-18 as a tiny doc-only decision-closure WP arising from the `docs/ai/MOVE_LOG_FORMAT.md` forensics report; passed the 00.3 lint-gate self-review the same day after two surgical patches (verification-command shell + acceptance-criteria count). Any future WPs must be reviewed before Claude Code executes them.

---

## Foundation Prompts (run once before Work Packets begin)

These are execution prompts, not Work Packets. They establish the deployment
environment that all Work Packets build on top of. Run them in the order shown.

| Prompt | Description | Status |
|--------|-------------|--------|
| `00.4` | Connection & environment health check | ✅ complete 2026-04-09 |
| `00.5` | R2 data & image validation | ✅ complete 2026-04-09 |
| `01` | Render.com backend — server, schema, `render.yaml` | ✅ complete 2026-04-09 |
| `02` | Database migration runner + `data/migrations/` | ✅ complete 2026-04-09 |

Run `00.4` first. Fix any failures before proceeding. Then run `00.5`, `01`, `02`
in that order. When all four pass, WP-002 is unblocked.

---

## Phase 0 — Coordination & Contracts (Foundational)

These packets establish the repo-as-memory system and lock contracts before code.

- [x] WP-001 — Foundation & Coordination System — Completed ✅ Reviewed
  Notes: Establishes the **repo-as-memory** AI coordination system — REFERENCE
  docs (not chat history) are the single authoritative project memory for all
  Claude Code sessions. Human-reviewed documentation pass only; no code
  generated, no commands run.

  **Override hierarchy** (locked here, documented in ARCHITECTURE.md header):
  `00.1-master-coordination-prompt.md` > `ARCHITECTURE.md` > Work Packets >
  conversation context. Higher entries always win in any conflict.

  **REFERENCE docs updated** (`docs/ai/REFERENCE/`):
  - `00.1` — coordination system, override hierarchy, WP template, session
    protocol, drift detection
  - `00.2` — `legendary.*` PostgreSQL namespace, `bigserial` PKs, `vp` field
    (not `strikeCount`), `ext_id text` cross-service identifiers, image URL
    patterns use hyphens not underscores
  - `00.3` — 28-item Final Gate, §16 code style coverage
  - `00.6` — Rules 13–15: ESM-only, data contract alignment, async error handling

  **Corrections locked into `00.2-data-requirements.md`** (critical for all
  future packets that reference schema or card data):
  - All PostgreSQL tables in `legendary.*` schema namespace
  - `ext_id text` as cross-service identifier type (not numeric FK)
  - `vp` field on masterminds (not `strikeCount`)
  - Image URLs in R2 use hyphens, not underscores

  WORK_INDEX created with Foundation Prompts table, phase structure, dependency
  chain, and procedure for adding new Work Packets.

- [x] WP-002 — boardgame.io Game Skeleton (Contracts Only) ✅ Reviewed — completed 2026-04-09
  Dependencies: WP-001, Foundation Prompts (01, 02)
  Notes: Creates `packages/game-engine/` from scratch using boardgame.io
  `^0.50.0` — this version is locked; do not upgrade without a DECISIONS.md
  entry (the `Game()` API, Immer mutation model, and `ctx` shape are
  version-specific);
  `LegendaryGame` (boardgame.io `Game()`) is the package's primary export and
  the single object through which ALL phases, moves, and hooks must be
  registered — never create parallel Game instances;
  `MatchConfiguration` interface — 9 fields from 00.2 §8.1 (initial type name;
  reconciled with `MatchSetupConfig` in WP-005A — both refer to the same
  9-field locked contract);
  `LegendaryGameState` — initial `G` type, empty at this stage, expanded by
  each successive packet that adds new state fields;
  4 phase names scaffolded here: `lobby`, `setup`, `play`, `end` (locked;
  WP-007A formalises via `MATCH_PHASES` array but does not change the names);
  `docs/ai/STATUS.md` and `docs/ai/DECISIONS.md` created (first entries);
  JSON-serializability test (`src/game.test.ts`, `node:test`) — the baseline
  test that every subsequent state change must not break;
  see ARCHITECTURE.md §Section 4 "The LegendaryGame Object" for version and
  mutation model details

- [x] WP-003 — Card Registry Verification & Defect Correction — Completed 2026-04-09 ✅ Reviewed
  Dependencies: WP-001
  Notes: `packages/registry/` already exists — fixes two confirmed defects and
  adds a smoke test. Does NOT create the registry from scratch.

  **Defect 1 — wrong fetch URL (silent failure):**
  `httpRegistry.ts` was fetching `metadata/card-types.json` instead of
  `metadata/sets.json`. The failure is silent because the two files have
  incompatible shapes — `card-types.json` entries `{ id, slug, name,
  displayName, prefix }` don't match `SetIndexEntrySchema`'s required
  `{ abbr, releaseDate }`, so Zod silently produces zero sets with no error
  thrown. Fix: fetch `metadata/sets.json` instead.

  **Defect 2 — `FlatCard.cost` typed too narrow:**
  Was `number | undefined`; must be `string | number | undefined` to match
  `HeroCardSchema.cost`. Real cards have star-cost strings like `"2*"` (e.g.,
  amwp Wasp). Same pattern applies to `attack`, `recruit`, and `vAttack` in
  later packets — see Convention "Hero card numeric fields are
  `string | number | undefined`".

  **Files NOT modified** (correct as-is; future packets must not alter them
  without strong reason): `schema.ts`, `shared.ts`, `localRegistry.ts`.

  **Smoke test** (`registry.smoke.test.ts`, `node:test`): confirms
  `listSets().length > 0`, `listCards().length > 0`, `validate().errors`
  non-blocking. This is the only `@legendary-arena/registry` test file.

  See ARCHITECTURE.md §Section 2 "Registry Metadata File Shapes" for the
  canonical shapes of `sets.json` vs `card-types.json` and why confusing
  them causes a silent failure.

- [x] WP-004 — Server Bootstrap (Game Engine + Registry Integration) ✅ Reviewed — completed 2026-04-09
  Dependencies: WP-002, WP-003
  Notes: Server is a **wiring layer only** — it must never contain game logic,
  implement rules, or define a boardgame.io `Game()` directly;
  replaces placeholder `game/legendary.mjs` with a thin re-export of
  `LegendaryGame` from `@legendary-arena/game-engine` (kept for backwards
  compatibility only);
  registry loaded at startup via `createRegistryFromLocalFiles` (local files —
  NOT the HTTP/R2 loader; see DECISIONS.md for why);
  `rules/loader.mjs` (`loadRules`/`getRules` from PostgreSQL) is from Foundation
  Prompt 01 and is **not modified** in this packet — two parallel startup tasks:
  registry load + rules load both complete before `Server()` accepts matches;
  creates `src/index.mjs` process entrypoint with SIGTERM graceful shutdown;
  updates `render.yaml` startCommand to `node apps/server/src/index.mjs`;
  see ARCHITECTURE.md §Section 1 for server layer constraints and
  §Section 2 "Server Startup Sequence" for the startup flow

- [x] WP-043 — Data Contracts Reference (Canonical Card & Metadata Shapes) ✅ Reviewed ✅ Completed (2026-04-10)
  Dependencies: WP-003
  Notes: Migrates legacy `00.2-data-requirements.md` into governed
  `docs/ai/REFERENCE/00.2-data-requirements.md`; documents card data shapes,
  metadata lookup shapes, image URL construction, ability text markup, and
  PostgreSQL table inventory; subordinate to `schema.ts` and ARCHITECTURE.md;
  excludes UI concerns (search/filter, preferences, feature flags) per Layer
  Boundary; does not modify any code — reference document only

- [x] WP-044 — Prompt Lint Governance Alignment ✅ Reviewed (2026-04-10)
  Dependencies: WP-001
  Notes: Updates governed `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`
  with subordination clause, Layer Boundary references in §4/§8/§16, and
  `.claude/rules/*.md` cross-references; no lint rules added or removed;
  the checklist remains a REFERENCE document (reusable pre-execution gate),
  distinct from `.claude/rules/*.md` (runtime enforcement); the legacy
  prompt version at `docs/prompts-legendary-area-game/00.3-*` is superseded
  but not deleted

- [x] WP-045 — Connection Health Check Governance Alignment ✅ Reviewed (2026-04-10)
  Dependencies: WP-001
  Notes: Updates governed `docs/ai/REFERENCE/00.4-connection-health-check.md`
  with subordination clause, Layer Boundary note (server/ops layer), and
  stop-on-failure semantics; distinguishes the health check gate (Foundation
  Prompt prerequisite) from the Lint Gate (per-WP gate in CLAUDE.md); no
  health checks added or removed; no script modifications; the legacy prompt
  version at `docs/prompts-legendary-area-game/00.4-*` is superseded

- [x] WP-046 — R2 Validation Governance Alignment ✅ Reviewed (2026-04-10)
  Dependencies: WP-001, WP-045
  Notes: Updates governed `docs/ai/REFERENCE/00.5-validation.md` with
  subordination clause, Layer Boundary note (registry/data layer), and
  stop-on-failure semantics; distinguishes from WP-042 (deployment
  checklists — operational procedures) vs 00.5 (reusable preflight script);
  no validation checks added or removed; no script modifications; the legacy
  prompt version at `docs/prompts-legendary-area-game/00.5-*` is superseded

- [x] WP-047 — Code Style Reference Governance Alignment ✅ Reviewed (2026-04-10)
  Dependencies: WP-001
  Notes: Updates governed `docs/ai/REFERENCE/00.6-code-style.md` header with
  subordination clause (ARCHITECTURE.md and `.claude/rules/code-style.md`),
  three-artifact relationship documentation (00.6 descriptive, rules/code-style.md
  enforcement, 00.3 §16 quality gate); no rules added, removed, or weakened;
  all 15 rules, code examples, enforcement mapping, and change policy preserved;
  no enforcement WP needed — `.claude/rules/code-style.md` already handles
  runtime enforcement

- [ ] WP-055 — Theme Data Model (Mastermind / Scenario Themes v1) ✅ Reviewed — pending
  Dependencies: WP-003, WP-005A
  Notes: Defines `ThemeDefinition` Zod schema as a registry-layer content
  primitive; `ThemeSetupIntentSchema` mirrors `MatchSetupConfig` ID fields
  exactly (`mastermindId`, `schemeId`, `villainGroupIds`, `henchmanGroupIds`,
  `heroDeckIds`) but excludes count fields (themes describe composition, not
  pile sizing); `ThemePrimaryStoryReferenceSchema` includes editorial fields
  (`marvelUnlimitedUrl`, `externalIndexUrls`) — all optional, never
  authoritative; `content/themes/` directory with one JSON file per theme;
  `validateTheme` (sync) and `validateThemeFile` (async) with filename-to-
  themeId alignment check; `parDifficultyRating` excluded from v1 (PAR system
  does not exist yet); no engine imports, no runtime behavior, no loaders;
  theme loader, referential integrity, and MatchSetupConfig projection are
  deferred to consumer WPs as scope items — not standalone packets (design
  review decision 2026-04-12); parallel-safe with Phase 2+

- [ ] WP-060 — Keyword & Rule Glossary Data Migration ✅ Reviewed — pending
  Dependencies: WP-003
  Notes: Migrates `keywords-full.json` (102 keywords with definitions) and
  `rules-full.json` (18 rules with definitions) from external
  `modern-master-strike` project into `data/metadata/`; uploads to R2;
  updates registry viewer to fetch glossary data at runtime instead of
  hardcoding 200+ lines of definitions in `useRules.ts`; display-only
  content — no Zod schema, no engine integration; non-blocking fetch
  (card view works if glossary load fails); parallel-safe with Phase 2+

---

## Phase 1 — Game Setup Contracts & Determinism

These packets define *what* a match is before implementing *how* it plays.

- [x] WP-005A — Match Setup Contracts ✅ Reviewed ✅ Completed (2026-04-10)
  Dependencies: WP-002, WP-003
  Notes: Defines `MatchSetupConfig` (9 fields, locked names from 00.2 §8.1:
  `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`,
  `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`);
  `MatchSetupError { field, message }` and `ValidateMatchSetupResult` (discriminated
  union) — these are NOT `MoveResult`/`MoveError` which belong to WP-008A;
  `validateMatchSetup(input, registry)` checks BOTH shape AND registry ext_id
  existence — it is NOT shape-only (zone validators from WP-006A onward are
  shape-only); returns structured result, never throws;
  reconciles `MatchSetupConfig` with `MatchConfiguration` type from WP-002

- [x] WP-005B — Deterministic Setup Implementation — Completed 2026-04-10 ✅ Reviewed
  Dependencies: WP-005A
  Notes: `shuffleDeck(cards, ctx): string[]` returns a new array via
  `ctx.random.Shuffle` — never `Math.random()`, never mutates input;
  `makeMockCtx` reverses arrays (proves shuffle ran — identity shuffle would not);
  no boardgame.io import in `mockCtx.ts`;
  `buildInitialGameState(config, registry, ctx): LegendaryGameState` —
  full initial `G` with `selection`, `playerZones`, `bystanders`, `wounds`,
  `officers`, `sidekicks`;
  `Game.setup()` calls `validateMatchSetup` first, then throws `Error` on failure
  before building `G` — this is the ONLY place in the engine where throwing is
  correct (moves must never throw);
  `G` stores `ext_id` strings only — no full card objects;
  see ARCHITECTURE.md §Section 4 for the setup vs moves throwing distinction

- [x] WP-006A — Player State & Zones Contracts — Completed 2026-04-10 ✅ Reviewed
  Dependencies: WP-005B
  Notes: Locks `PlayerZones` (5 zones: `deck`, `hand`, `discard`, `inPlay`,
  `victory`), `GlobalPiles` (4 piles: `bystanders`, `wounds`, `officers`,
  `sidekicks`), `PlayerState`, and `CardExtId = string` (named type alias — not
  plain `string`); `ZoneValidationError { field, message }` — distinct from
  `MoveError { code, message, path }`: do NOT reuse `MoveError` for zone shape
  errors; `validateGameStateShape` and `validatePlayerStateShape` — structured
  results, never throw; validators check shape only, no registry ext_id existence;
  `zones.validate.ts` has no boardgame.io import (pure helper);
  see ARCHITECTURE.md §Section 2 for Zone & Pile Structure

- [x] WP-006B — Player State Initialization (Align to Zone Contracts) — Completed 2026-04-10 ✅ Reviewed
  Dependencies: WP-006A
  Notes: `buildPlayerState(playerId, startingDeck, ctx): PlayerState` — deck
  is shuffled starting deck, all other zones start `[]`; `// why:` comment
  required explaining that cards enter non-deck zones via moves, not setup;
  `buildGlobalPiles(config, ctx): GlobalPiles` — pile sizes come from
  `MatchSetupConfig` count fields (`bystandersCount`, `woundsCount`,
  `officersCount`, `sidekicksCount`);
  WP-006A contract files (`zones.types.ts`, `zones.validate.ts`) must not be
  modified in this packet;
  see ARCHITECTURE.md §Section 2 for Zone & Pile Structure and initialization rule

---

## Phase 2 — Core Turn Engine (Minimal Playable Loop)

These packets create the first playable (but incomplete) game loop.

- [x] WP-007A — Turn Structure & Phases Contracts ✅ Reviewed (completed 2026-04-10)
  Dependencies: WP-006B
  Notes: Locks the lifecycle-to-phase mapping from 00.2 §8.2 (Lobby→`lobby`,
  Setup→`setup`, In Progress→`play`, Completed→`end`) — do not invent alternate
  phase names; `MatchPhase` (4 values) and `TurnStage` (3 values: `start`,
  `main`, `cleanup`); `MATCH_PHASES` and `TURN_STAGES` are canonical `readonly`
  arrays — drift-detection test must assert these match their union types;
  `getNextTurnStage` returns `null` at `cleanup` (signals turn end — never cycles
  back); only two valid transitions: `start→main` and `main→cleanup`;
  `turnPhases.logic.ts` has no boardgame.io imports (pure helper);
  see ARCHITECTURE.md §Section 4 for The Turn Stage Cycle and Phase Sequence

- [x] WP-007B — Turn Loop Implementation ✅ Reviewed (completed 2026-04-10)
  Dependencies: WP-007A
  Notes: `currentStage: TurnStage` stored in `G` (not `ctx`) — boardgame.io's
  `ctx` does not expose inner stage to move functions; `// why:` comment required;
  `play` phase `onBegin` resets `G.currentStage = 'start'` on each new turn;
  `advanceTurnStage` calls `getNextTurnStage` from WP-007A — no duplicated
  stage ordering; no hardcoded stage strings in `turnLoop.ts` or `game.ts`;
  `ctx.events.endTurn()` called when `getNextTurnStage` returns `null`;
  integration test uses `makeMockCtx` — no live server, no `boardgame.io/testing`;
  WP-007A contract files must not be modified;
  see ARCHITECTURE.md §Section 4 for The Turn Stage Cycle

- [x] WP-008A — Core Moves Contracts (Draw, Play, End Turn) ✅ Reviewed — Completed 2026-04-10
  Dependencies: WP-007B
  Notes: `MoveResult`/`MoveError` are the **engine-wide result contract** —
  every move validator in every future packet must return `MoveResult` (imported
  from `coreMoves.types.ts`), not define a new parallel type;
  `PlayCardArgs.cardId` uses `CardExtId` not plain `string`;
  stage gating via `MOVE_ALLOWED_STAGES` (`drawCards`: start+main, `playCard`:
  main, `endTurn`: cleanup) — each assignment has a `// why:` comment;
  stage gating uses `TurnStage` constants — no hardcoded string literals;
  drift-detection test for `CORE_MOVE_NAMES`; all validators never throw;
  see ARCHITECTURE.md §Section 4 for The Move Validation Contract

- [x] WP-008B — Core Moves Implementation (Draw, Play, End Turn) ✅ Reviewed — Completed 2026-04-10
  Dependencies: WP-008A
  Notes: Three-step move ordering — validate args → check stage gate → mutate G;
  if either guard fails, return without mutation (never throw);
  `zoneOps.ts` helpers return new arrays — inputs never mutated, no boardgame.io
  import (`zoneOps.ts` is a pure helper);
  `endTurn` calls `ctx.events.endTurn()` with `// why:` — manual player index
  rotation is forbidden, boardgame.io manages turn order;
  reshuffle uses `shuffleDeck` from WP-005B — never `Math.random()`;
  WP-008A contract files (`coreMoves.types.ts`, `.validate.ts`, `.gating.ts`)
  must not be modified;
  see ARCHITECTURE.md §Section 4 for Zone Mutation Rules

---

## Phase 3 — MVP Multiplayer Infrastructure

These packets complete the minimum viable multiplayer loop.

- [x] WP-009A — Scheme & Mastermind Rule Hooks (Contracts) ✅ Reviewed — Completed 2026-04-11
  Dependencies: WP-008B
  Notes: Defines 5 trigger names (`onTurnStart`, `onTurnEnd`, `onCardRevealed`,
  `onSchemeTwistRevealed`, `onMastermindStrikeRevealed`) and 4 effect types
  (`queueMessage`, `modifyCounter`, `drawCards`, `discardHand`);
  `RULE_TRIGGER_NAMES` and `RULE_EFFECT_TYPES` are canonical `readonly` arrays —
  drift-detection tests must assert these match their union types;
  `HookDefinition` is data-only (5 fields: `id`, `kind`, `sourceId`, `triggers`,
  `priority`) — no handler functions, fully JSON-serializable;
  card references in all trigger payloads use `CardExtId`, not plain `string`;
  `MoveError` reused from WP-008A — no new error type;
  no `boardgame.io` import in any file under `src/rules/`;
  was previously incomplete — now complete
  Governance: Rule hooks consume validated, frozen composition (D-1244);
  hooks may read setup composition but must not modify it; no hook may
  infer missing setup fields or introduce defaults

- [x] WP-009B — Scheme & Mastermind Rule Execution (Minimal MVP) ✅ Reviewed (2026-04-11)
  Dependencies: WP-009A
  Notes: Introduces `ImplementationMap` (`Record<hookId, handler>`) — handler
  functions live outside `G`, never stored in state;
  `executeRuleHooks` returns `RuleEffect[]` without modifying `G` (Step 1);
  `applyRuleEffects` applies with `for...of`, never `.reduce()` (Step 2);
  unknown effect types push warning to `G.messages` — never throw;
  adds `G.messages: string[]`, `G.counters: Record<string, number>`,
  `G.hookRegistry: HookDefinition[]` to `LegendaryGameState`;
  `G.hookRegistry` built at setup from `matchData` (data-only) — not queried
  at runtime from registry;
  `buildDefaultHookDefinitions(matchSetupConfig)` builds hooks from `schemeId`
  and `mastermindId` in setup config;
  `onTurnStart`/`onTurnEnd` wired via `turn.onBegin`/`turn.onEnd`;
  WP-009A contract files (`ruleHooks.*.ts`) must not be modified;
  see ARCHITECTURE.md §Section 4 for the full pipeline explanation

- [x] WP-010 — Victory & Loss Conditions (Minimal MVP) ✅ Reviewed (2026-04-11)
  Dependencies: WP-009B
  Notes: Three conditions: `escapedVillains >= 8`, `schemeLoss >= 1`,
  `mastermindDefeated >= 1`; all read from `G.counters` using `ENDGAME_CONDITIONS`
  constants (not string literals — using wrong strings silently breaks the evaluator);
  `ESCAPE_LIMIT = 8` hardcoded MVP constant — will move to `MatchSetupConfig`
  when scheme-specific limits are added; loss before victory;
  `evaluateEndgame` pure function → wired into `endIf` (no inline counter
  logic in `endIf`); was previously truncated — now complete;
  see ARCHITECTURE.md §Section 4 for the full endIf contract

- [x] WP-011 — Match Creation & Lobby Flow (Minimal MVP) ✅ Reviewed (2026-04-11)
  Dependencies: WP-010
  Notes: Adds `G.lobby` (`LobbyState: { requiredPlayers, ready, started }`);
  `requiredPlayers` comes from `ctx.numPlayers` — not from `MatchSetupConfig`;
  lobby moves wired inside the `lobby` phase only — not top-level;
  `startMatchIfReady` calls `ctx.events.setPhase('setup')` — transitions to
  `setup` first, then `play` (not directly to `play`);
  `G.lobby.started` is a UI observability flag: set in `G` before the phase
  transition so the UI can detect "lobby completed" without inspecting `ctx.phase`;
  `create-match.mjs` CLI uses Node built-in `fetch`; `MoveResult`/`MoveError`
  reused from WP-008A; see ARCHITECTURE.md §Section 4 for the observability pattern

- [x] WP-012 — Match Listing, Join & Reconnect (Minimal MVP) ✅ Reviewed — **Complete 2026-04-11**
  Dependencies: WP-011
  Notes: Two CLI scripts (`list-matches.mjs`, `join-match.mjs`) using Node
  built-in `fetch` — no axios; unit tests stub `fetch` (no live server needed
  for tests); full end-to-end verified manually; no game logic changes

- [x] WP-013 — Persistence Boundaries & Snapshots ✅ Reviewed ✅ Reviewed ✅ Completed (2026-04-11)
  Dependencies: WP-012
  Notes: Creates `PERSISTENCE_CLASSES` constants, `MatchSnapshot` (zone counts
  only — no ext_id arrays), `PersistableMatchConfig`, `createSnapshot` (pure,
  frozen), `validateSnapshotShape`; ARCHITECTURE.md Section 3 already existed
  with three-class model and field table — no update needed; 130 tests pass

---

## Phase 4 — Core Gameplay Loop

These packets make the game play like Legendary for the first time.

- [x] WP-014A — Villain Reveal & Trigger Pipeline ✅ Reviewed ✅ Reviewed ✅ Completed (2026-04-11)
  Dependencies: WP-013
  Notes: Types (`RevealedCardType`, `VillainDeckState`, `REVEALED_CARD_TYPES`),
  `revealVillainCard` move (draw, classify, trigger, apply, discard), 12 new
  tests with mock deck fixtures, empty defaults in `buildInitialGameState`;
  `buildVillainDeck` deferred to WP-014B; discard routing temporary (WP-015
  changes to City)

- [x] WP-014B — Villain Deck Composition Rules & Registry Integration ✅ Reviewed ✅ Reviewed ✅ Completed (2026-04-11)
  Dependencies: WP-014A
  Notes: Implements `buildVillainDeck` using decisions D-1410 through D-1413;
  virtual card instancing for henchmen and scheme twists; ext_id conventions
  locked; composition counts are rules-driven (10 henchmen/group, 8 twists,
  1 bystander/player); defines `VillainDeckRegistryReader` interface;
  replaces empty defaults in `buildInitialGameState` with real data;
  D-1412 amended with bystander ext_id format

- [x] WP-015 — City & HQ Zones (Villain Movement + Escapes) ✅ Reviewed ✅ Reviewed ✅ Completed (2026-04-11)
  Dependencies: WP-014A
  Notes: `G.city` (5-tuple of `CardExtId | null`) and `G.hq` (5-tuple);
  `pushVillainIntoCity` is a pure helper (no boardgame.io import, no `.reduce()`);
  revealed villains/henchmen route to City instead of discard; cards pushed past
  space 4 escape and increment `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
  — must use the constant, not the string literal; bystander MVP handling:
  discard + message (WP-017 adds capture); HQ initialized empty (WP-016 populates);
  SharePoint links removed; test files use `.test.ts` not `.test.mjs`; normalized
  to PACKET-TEMPLATE structure

- [x] WP-015A — Reveal Safety Fixes (Stage Gate + No-Card-Drop) ✅ Reviewed ✅ Completed (2026-04-11)
  Dependencies: WP-015
  Notes: Patch packet. Adds internal stage gating to `revealVillainCard`
  (allowed in `start` stage only, per tabletop Legendary semantics and
  non-core move model from EC-014A). Fixes malformed city card-drop bug
  where deck removal occurred before city validation — card was silently
  lost. Defers deck removal until placement destination is confirmed.
  1 new test (stage gating); 1 updated test (malformed city deck assertion).

- [x] WP-016 — Fight First, Then Recruit (Minimal MVP) ✅ Reviewed ✅ Reviewed ✅ Completed (2026-04-11)
  Dependencies: WP-015
  Notes: Adds `fightVillain({ cityIndex })` and `recruitHero({ hqIndex })`
  moves, both `main` stage only, both follow three-step validation contract;
  fight-first is a **policy** (not a hard lockout) — documented in DECISIONS.md
  (D-1601 through D-1604); MVP: no attack/recruit point checking (WP-018),
  no card text effects (WP-022), no bystander rescue (WP-017); 14 new tests
  (7 per move); game.test.ts 01.5 wiring (5->7 moves)

- [x] WP-017 — KO, Wounds & Bystander Capture (Minimal MVP) ✅ Reviewed ✅ Reviewed ✅ Completed (2026-04-12)
  Dependencies: WP-016
  Notes: Adds `G.ko: CardExtId[]` and `G.attachedBystanders: Record<CardExtId,
  CardExtId[]>`; MVP: 1 bystander per villain entering City (simplified);
  escape causes current player to gain 1 wound (links WP-015 escapes to
  penalty); `koCard`, `gainWound`, `attachBystanderToVillain`,
  `awardAttachedBystanders`, `resolveEscapedBystanders` are pure helpers
  (no boardgame.io import, no `.reduce()`); modifies `fightVillain.ts` and
  `villainDeck.reveal.ts`; `city.logic.ts` NOT modified (pure helper
  boundary); 22 new tests; test files use `.test.ts`

- [x] WP-018 — Attack & Recruit Point Economy (Minimal MVP) ✅ Reviewed ✅ Reviewed ✅ Completed (2026-04-12)
  Dependencies: WP-017
  Notes: `G.turnEconomy` (attack/recruit/spentAttack/spentRecruit, reset per
  turn); `G.cardStats: Record<CardExtId, CardStatEntry>` built at setup time
  from registry — same pattern as `G.villainDeckCardTypes`; moves NEVER query
  registry (registry boundary enforced); deterministic parser strips `+`/`*`
  from `"2+"` → 2; `fightVillain` gated by available attack; `recruitHero`
  gated by available recruit; no conditional bonuses (WP-022); PowerBI links
  removed; test files `.test.ts`; normalized to PACKET-TEMPLATE

- [x] WP-019 — Mastermind Fight & Tactics (Minimal MVP) ✅ Reviewed ✅ Reviewed ✅ Completed (2026-04-12)
  Dependencies: WP-018
  Notes: `G.mastermind: MastermindState` with `id`, `baseCardId`,
  `tacticsDeck`, `tacticsDefeated`; `fightMastermind` move validates attack
  from `G.cardStats` (WP-018 pattern), defeats 1 tactic per fight (MVP),
  increments `G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]` when all
  defeated — must use constant not string; `vAttack` parsed via WP-018's
  `parseCardStatValue` (no separate parser); no tactic text effects (WP-024);
  no VP scoring (WP-020); was truncated at 79 lines — normalized to full
  PACKET-TEMPLATE; SharePoint links removed

- [x] WP-020 — VP Scoring & Win Summary (Minimal MVP) ✅ Reviewed ✅ Reviewed ✅ Completed (2026-04-12)
  Dependencies: WP-019
  Notes: Pure `computeFinalScores(G): FinalScoreSummary` — read-only on G,
  never mutates, never triggers endgame (WP-010 owns that); MVP VP table
  locked as named constants (VP_VILLAIN=1, VP_HENCHMAN=1, VP_BYSTANDER=1,
  VP_TACTIC=5, VP_WOUND=-1); card classification via `G.villainDeckCardTypes`
  and `G.mastermind.tacticsDefeated` — no registry access; scores NOT stored
  in G during MVP (derived view); was truncated at 70 lines — normalized to
  full PACKET-TEMPLATE

---

## Phase 5 — Card Mechanics & Abilities

These packets make individual cards do things.

- [x] WP-021 — Hero Card Text & Keywords (Hooks Only) ✅ Reviewed ✅ Completed (2026-04-13)
  Dependencies: WP-020
  Notes: Hero ability hooks only — **no execution**; `HeroAbilityHook` is
  data-only, JSON-serializable (same pattern as `HookDefinition`);
  `HeroKeyword` closed canonical union with drift-detection; hooks built at
  setup time, immutable during gameplay; `G.heroAbilityHooks` stores hooks;
  rule engine can observe/query/filter hooks but no effects fire; execution
  deferred to WP-022+; was truncated at 56 lines — normalized to full
  PACKET-TEMPLATE; this packet is inert by design

- [x] WP-022 — Execute Hero Keywords (Minimal MVP) ✅ Reviewed ✅ Completed (2026-04-13)
  Dependencies: WP-021
  Notes: Executes 4 unconditional hero keywords only: `'draw'`, `'attack'`,
  `'recruit'`, `'ko'`; conditional effects safely skipped (no mutation);
  unsupported keywords safely ignored; uses zone-ops primitives for draw,
  addResources for economy, koCard helper for KO — no ad-hoc state writes;
  `'ko'` MVP targets the played card itself (no player choice); execution
  fires immediately after play in registration order; hero hook economy is
  additive to WP-018 base card stats; `ctx: unknown` avoids boardgame.io
  import; WP-021 contracts not modified; 11 new tests, 266 total passing

- [x] WP-023 — Conditional Hero Effects (Teams, Colors, Keywords) ✅ Reviewed ✅ Completed (2026-04-13)
  Dependencies: WP-022
  Notes: 4 MVP condition types: `heroClassMatch`, `requiresTeam`,
  `requiresKeyword`, `playedThisTurn`; conditions are checked not inferred
  (pure predicates, never mutate G); effects never inspect hidden information;
  ALL conditions must pass (AND logic); unsupported condition types safely
  skipped; `requiresKeyword` and `playedThisTurn` fully functional;
  `heroClassMatch` and `requiresTeam` are placeholders (return false) until
  team/class data is resolved into G; modifies WP-022 execution to integrate
  condition evaluation; WP-021 contracts not modified; condition type string
  is `heroClassMatch` (not `requiresColor` — pre-flight name drift fix);
  15 new tests, 281 total passing

- [x] WP-024 — Scheme & Mastermind Ability Execution ✅ Reviewed ✅ Completed (2026-04-13)
  Dependencies: WP-023
  Notes: Scheme twist and mastermind strike handlers use the same
  `executeRuleHooks` -> `applyRuleEffects` pipeline — no new execution engine;
  `schemeTwistHandler` fires on `onSchemeTwistRevealed`,
  `mastermindStrikeHandler` fires on `onMastermindStrikeRevealed`; scheme-loss
  increments `G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS]` at threshold (7);
  MVP mastermind strike uses counter + message only (wound card effects
  deferred); WP-009B stubs replaced; 10 new tests, 291 total passing

- [x] WP-025 — Keywords: Patrol, Ambush, Guard ✅ Reviewed ✅ Completed (2026-04-13)
  Dependencies: WP-024
  Notes: `BoardKeyword` closed union (`'patrol'` | `'ambush'` | `'guard'`)
  with drift-detection; `G.cardKeywords` built at setup (registry boundary);
  Patrol: +1 fight cost; Ambush: wound on City entry; Guard: blocks targeting
  lower-index cards; board keywords are **structural City rules**, NOT hero
  abilities — automatic, no player choice, separate from hero hook system;
  was truncated at 63 lines — normalized to full PACKET-TEMPLATE

- [x] WP-026 — Scheme Setup Instructions & City Modifiers ✅ Reviewed ✅ Completed (2026-04-14)
  Dependencies: WP-025
  Notes: `SchemeSetupInstruction` data-only contract (D-0603 pattern);
  4 MVP instruction types: `modifyCitySize`, `addCityKeyword`,
  `addSchemeCounter`, `initialCityState`; instructions execute once during
  `setup` phase before first turn; persistent modifiers stored in G; no
  hard-coded scheme logic — all data-driven from registry at setup; scheme
  setup (board config) is separate from scheme twist (event reaction, WP-024);
  `G.schemeSetupInstructions` stored for replay observability; was truncated
  at 64 lines — normalized to full PACKET-TEMPLATE; final Phase 5 packet

---

## Phase 6 — Verification, UI & Production

These packets make the game safe to ship.

- [x] WP-027 — Determinism & Replay Verification Harness ✅ Reviewed (2026-04-14)
  Dependencies: WP-026
  Notes: `ReplayInput` canonical contract (seed + setupConfig + playerOrder +
  moves); `replayGame` pure function reconstructs game from inputs;
  `verifyDeterminism` runs replay twice and compares canonical state hashes;
  `computeStateHash` uses deterministic serialization (sorted keys);
  implements D-0201 (Replay as First-Class Feature); `ReplayInput` is
  Class 2 (Configuration) data — safe to persist; harness uses `makeMockCtx`
  not `boardgame.io/testing`; does NOT modify gameplay; was truncated at
  63 lines — normalized to full PACKET-TEMPLATE
  Governance: Replay correctness assumes match setup is engine-aligned,
  immutable, and fully validated before match creation (D-1244, D-1247);
  (match setup + move log) is the complete deterministic input set;
  replays referencing invalid setups must be rejected; no replay path
  may re-interpret or normalize setup data; seed wiring gap documented
  in D-1248

- [x] WP-028 — UI State Contract (Authoritative View Model) ✅ Reviewed (2026-04-14)
  Dependencies: WP-027
  Notes: `UIState` is the **only** state the UI consumes — derived, read-only,
  JSON-serializable; `buildUIState(G, ctx)` is a pure function (no mutation,
  no I/O); hides all engine internals (hookRegistry, cardStats,
  villainDeckCardTypes, heroAbilityHooks, ImplementationMap); player zones
  projected as counts not card arrays; implements D-0301; card display
  resolution is a separate UI concern (not in buildUIState); spectator views
  deferred to WP-029; was truncated at 80 lines — normalized to full
  PACKET-TEMPLATE

- [x] WP-029 — Spectator & Permissions View Models ✅ Reviewed (2026-04-14)
  Dependencies: WP-028
  Notes: `UIAudience` type (`player` + `spectator`);
  `filterUIStateForAudience` is a pure post-processing filter on UIState
  (never touches G); active player sees own hand ext_ids, others see counts
  only; spectators see all public zones + hand counts; deck order never
  revealed; implements D-0302 (Single UIState, Multiple Audiences); replay
  viewers use spectator audience; no alternate game states — one UIState,
  filtered views; was truncated at 57 lines — normalized to full
  PACKET-TEMPLATE

- [x] WP-030 — Campaign / Scenario Framework ✅ Reviewed ✅ Completed 2026-04-14
  Dependencies: WP-029
  Notes: `ScenarioDefinition` + `CampaignDefinition` + `CampaignState` — all
  data-only, JSON-serializable, external to engine (D-0501, D-0502);
  `applyScenarioOverrides` produces valid `MatchSetupConfig` — engine never
  knows about campaigns; `CampaignState` is Class 2 (Configuration), NOT part
  of `LegendaryGameState`; campaign replay = sequence of `ReplayInput` objects;
  no engine modifications; `ScenarioOutcome` named union shared between
  evaluator return and advance parameter (pre-flight tightening);
  `evaluateScenarioOutcome` takes separate victory/failure condition arrays
  to express loss-before-victory order (pre-flight shape refinement);
  `src/campaign/` classified as engine code category (D-3001, follows D-2706
  and D-2801 precedent); 8 new tests, 348 total; 01.5 runtime-wiring allowance
  NOT invoked — WP is purely additive; was truncated at 68 lines — normalized
  to full PACKET-TEMPLATE

- [x] WP-031 — Production Hardening & Engine Invariants ✅ Reviewed ✅ Completed 2026-04-15
  Dependencies: WP-029
  Notes: Five non-overlapping invariant categories: structural, gameRules,
  determinism, security (deferred), lifecycle. Canonical
  `INVARIANT_CATEGORIES` readonly array with Test 1 drift-detection
  assertion. `assertInvariant` throws `InvariantViolationError` on
  violation (D-0102 fail fast); invariant checks are pure helpers, no
  boardgame.io import, no registry import, no `.reduce()`, no
  `Math.random()`. Critical distinction enforced by Tests 9/10: invariant
  violations (structural corruption) fail fast; gameplay conditions
  (insufficient attack, empty pile) remain safe no-ops per D-0102
  clarification. Wiring scope: setup-only per D-3102 / Option B
  (per-move wiring deferred to a follow-up WP) — `runAllInvariantChecks`
  called from `Game.setup()` return path only, throwing covered by the
  existing `Game.setup() may throw` row in `.claude/rules/game-engine.md
  §Throwing Convention` (no new rule exception). 01.5 runtime-wiring
  allowance INVOKED with three minimal additive edits: `game.ts` (1
  import + 4-line setup-return wrap), `types.ts` (additive re-export
  block), `index.ts` (additive export block). 10 new tests in
  `invariants.test.ts`; 358 total tests, 94 suites, 0 failures (348
  baseline + 10 new); no existing test modified. Implements D-0001
  (Correctness Over Convenience) and D-0102 (Fail Fast on Invariant
  Violations). Mid-execution amendment: WP §D
  `checkNoCardInMultipleZones` semantics narrowed to
  fungible-token exclusion per A-031-01 / D-3103 because CardExtIds
  are card-type IDs (not per-instance) — the literal "no CardExtId in
  multiple zones" check would have thrown on every valid G. Six
  fungible token strings (starting-shield-agent, starting-shield-trooper,
  pile-bystander, pile-wound, pile-shield-officer, pile-sidekick) are
  excluded; cross-zone duplication of all other CardExtIds still fires
  the invariant. A-031-02 fixes a `victoryPile` → `victory` field-name
  drift in the WP draft. A-031-03 widens
  `checkValidPhase`/`checkTurnCounterMonotonic` parameter types to
  `| undefined` for mock-context test compatibility. Pre-flight RS-9 /
  RS-10 / RS-11 + PS-3 and copilot Findings #31 / #32 / #33 capture
  the discovery and resolution; both audit trails re-confirm. New
  decisions: D-3101 (invariants directory engine classification),
  D-3102 (setup-only wiring scope), D-3103 (card uniqueness fungible
  exclusion).

- [x] WP-032 — Network Sync & Turn Validation ✅ Reviewed (2026-04-15)
  Dependencies: WP-031
  Notes: `ClientTurnIntent` canonical submission format; engine-side
  `validateIntent` checks player, turn, move name, args — returns structured
  rejections (never throws); 5 rejection codes: WRONG_PLAYER, WRONG_TURN,
  INVALID_MOVE, MALFORMED_ARGS, DESYNC_DETECTED; desync detection via
  `computeStateHash` (WP-027) — engine state always wins (D-0402);
  transport-agnostic (works with boardgame.io or any future transport);
  implements D-0401, D-0402; was truncated at 66 lines — normalized to
  full PACKET-TEMPLATE

- [x] WP-033 — Content Authoring Toolkit ✅ Reviewed ✅ Complete 2026-04-16
  Dependencies: WP-031
  Notes: Author-facing JSON schemas for hero, villain, mastermind, scheme,
  scenario; `validateContent` + `validateContentBatch` — structural, enum,
  cross-reference, and hook consistency checks; returns structured results
  (never throws); schemas reference canonical unions (HERO_KEYWORDS,
  BOARD_KEYWORDS); content validation is pre-engine gate — invalid content
  never reaches Game.setup(); does NOT modify registry Zod schemas; implements
  D-0601, D-0602; was truncated at 78 lines — normalized to full
  PACKET-TEMPLATE

- [x] WP-034 — Versioning & Save Migration Strategy ✅ Reviewed (2026-04-19 pre-flight READY TO EXECUTE; SPEC pre-flight commit `c587f74` landed D-3401 + 02-CODE-CATEGORIES.md update + session prompt before execution) — Completed 2026-04-19 at commit `5139817` under EC-034 (see [session-wp034-versioning-save-migration.md](../invocations/session-wp034-versioning-save-migration.md))
  Dependencies: WP-033
  Execution Checklist: `docs/ai/execution-checklists/EC-034-versioning.checklist.md` (Done)
  Notes: Three independent version axes: `EngineVersion` (semver),
  `DataVersion` (integer), `ContentVersion` (integer); `VersionedArtifact<T>`
  embeds all stamps at save time; `checkCompatibility` returns structured
  result (compatible/migratable/incompatible) with five locked
  full-sentence message templates; migrations forward-only, pure,
  deterministic; incompatible + unmigratable = fail loud (D-0802 wins
  over D-1234 at the load boundary); engine never guesses old data
  meaning. Five new files under `packages/game-engine/src/versioning/`
  (D-3401 engine code category, seventh instance of the established
  pattern after replay/ui/campaign/invariants/network/content);
  additive re-exports in `types.ts` and `index.ts` only — no
  `LegendaryGameState` shape change, no other engine subdirectory
  touched. `migrateArtifact` MAY throw — load-boundary exception
  identical to `Game.setup()`'s throw rationale per D-0802
  fail-loud. `stampArtifact` is the single permitted wall-clock
  read in the versioning subtree (`new Date().toISOString()` for
  `savedAt` metadata, structurally distinct from the forbidden
  `Date.now` static helper per D-3401 sub-rule). MVP migration
  registry is `Object.freeze({})` — long-lived seam for future
  format changes. Engine tests 427 → 436 (+9 in one
  `describe('versioning (WP-034)')` block per P6-19 / P6-25);
  repo-wide tests 517 → 526. `pnpm-lock.yaml` absent (no new
  dep). Engine, registry, vue-sfc-loader, server, replay-producer,
  registry-viewer, arena-client all untouched. 01.5 NOT INVOKED.
  01.6 post-mortem MANDATORY (new long-lived abstraction
  `VersionedArtifact<T>` + new code-category directory D-3401) —
  delivered in-session at
  `docs/ai/post-mortems/01.6-WP-034-versioning-save-migration-strategy.md`;
  verdict WP COMPLETE. Zero in-allowlist refinements applied during
  post-mortem. Meta-finding: P6-43 (JSDoc + grep collision precedent
  authored from WP-064 execution and committed at `0c741c6`) caught
  six initial JSDoc-vs-grep collisions at the first verification
  gate run; all fixed via paraphrase form before re-test. First
  empirical demonstration that the precedent log is load-bearing
  across sessions. Three commits on this branch: `c587f74` SPEC
  (pre-flight), `5139817` EC-034 (code + post-mortem), `<this
  commit>` SPEC (governance close). Pre-commit review ran in a
  separate gatekeeper session per P6-35 default; no P6-42
  deviation.

- [ ] WP-035 — Release, Deployment & Ops Playbook ✅ Reviewed
  Dependencies: WP-034
  Notes: Release artifacts (engine build + content bundle + migration bundle +
  validation report) — immutable once published; 4 environments: dev -> test ->
  staging -> prod with sequential promotion; mandatory release checklist gates
  every release (blocked if any fails); rollback strategy: revert engine +
  content together, no data loss (D-0902); incident response P0-P3; OpsCounters
  type for passive monitoring; produces `docs/ops/` documentation; WP-042
  provides specific deployment checklists on top of this framework; was 166
  lines but missing template sections — normalized to full PACKET-TEMPLATE

- [ ] WP-042 — Deployment Checklists (Data, Database & Infrastructure) ✅ Reviewed
  Dependencies: WP-035
  Notes: Converts legacy `00.2b-deployment-checklists.md` into governed
  verification procedures; covers R2 card data validation (`pnpm registry:validate`),
  PostgreSQL migration and seeding (`pnpm migrate`, `pnpm seed`), and
  infrastructure configuration; produces binary pass/fail outcomes only;
  legacy Checklist C (Konva.js canvas UI) excluded — UI implementation is
  not a deployment concern per Layer Boundary

- [x] WP-048 — PAR Scenario Scoring & Leaderboards ✅ Reviewed (2026-04-17 pre-flight READY TO EXECUTE + copilot 30/30 CONFIRM; commit c5f7ca4) — Completed 2026-04-17 (see [session-wp048-par-scenario-scoring.md](../invocations/session-wp048-par-scenario-scoring.md))
  Dependencies: WP-020, WP-027, WP-030
  Notes: Extends VP scoring (WP-020) into PAR-based scenario scoring per
  `docs/12-SCORING-REFERENCE.md`; `ScenarioKey` and `TeamKey` stable identity
  strings; `ScenarioScoringConfig` versioned per-scenario weights, caps, PAR
  baseline, penalty event mappings; `deriveScoringInputs(replayResult,
  gameState)` (D-4801) reads G directly, no `GameMessage` type introduced;
  non-villainEscaped penalty producers safe-skip to 0 per D-4801; integer
  arithmetic (centesimal) for determinism; monotonicity invariant enforced
  by config validation; self-contained configs per D-4805 (every
  `PenaltyEventType` key must be present in `penaltyEventWeights`);
  team-aggregate MVP per D-4803; end-of-match only per D-4804;
  `G.activeScoringConfig` field deferred to WP-067 per D-4802;
  `ScoreBreakdown` and `LeaderboardEntry` JSON-roundtrip tested per D-4806;
  `LeaderboardEntry` contract defined in engine, storage is server-only;
  anti-exploit controls (bystander cap, VP cap, round cost, per-event
  penalty weights); does NOT modify WP-020 or WP-027 contracts; implements
  Vision goals 20-25. 16 logic tests + 4 key tests; game-engine suite
  396/98, repo-wide 429. Note: session prompt quoted 392/425 for test
  counts (arithmetic error); authoritative counts are 396/429 from 20 new
  tests.

- [x] WP-065 — Vue SFC Test Transform Pipeline ✅ Reviewed (2026-04-16 lint-gate pass) — Completed 2026-04-17 (see [session-wp065-vue-sfc-loader.md](../invocations/session-wp065-vue-sfc-loader.md))
  Dependencies: none
  Notes: Creates `packages/vue-sfc-loader/` as a shared internal private
  package (`@legendary-arena/vue-sfc-loader`) that makes `.vue` SFCs
  importable under `node:test`. Lint §7 and §12 forbid Vitest / Jest /
  Mocha; `node:test` is mandatory project-wide, but Node cannot import
  `.vue` files without a compilation step. This package wraps
  `@vue/compiler-sfc` in a Node 22 `module.register()` loader hook
  exposed via the subpath `@legendary-arena/vue-sfc-loader/register`;
  consumers opt in by setting `NODE_OPTIONS=--import
  @legendary-arena/vue-sfc-loader/register` in their `test` script.
  Scoped to **tests only** — runtime SFC handling in Vite is unchanged.
  `<style>` blocks are stripped at test time (jsdom ignores CSS;
  component tests assert on text + a11y, not styles). Sourcemaps are
  emitted so stack traces point at `.vue` line numbers. Pure
  `compileVue` helper + deterministic output verified by tests.
  Hard prerequisite for WP-061, WP-062, WP-064 and every future UI WP
  that tests `.vue` components. If `apps/registry-viewer/` already had
  a home-rolled SFC shim, this packet consolidates it — DECISIONS.md
  records the consolidation outcome.

- [x] WP-061 — Gameplay Client Bootstrap ✅ Reviewed (2026-04-16 lint-gate pass) — Completed 2026-04-17 under commit prefix `EC-067:` (see [session-wp061-gameplay-client-bootstrap.md](../invocations/session-wp061-gameplay-client-bootstrap.md))
  Dependencies: WP-028, WP-065
  Notes: Creates `apps/arena-client/` as a new Vue 3 + Vite + Pinia + TypeScript
  SPA — the first gameplay client in the repo (distinct from `apps/registry-viewer/`,
  which is a card browser); exposes `useUiStateStore()` with a single slot
  `snapshot: UIState | null` and one mutation `setSnapshot`; fixture loader
  reads committed JSON `UIState` artifacts (`mid-turn`, `endgame-win`,
  `endgame-loss`) for deterministic rendering; ships `<BootstrapProbe />` as
  a wiring smoke test only — no HUD, no routing beyond a placeholder, no
  networking, no auth; engine import is type-only (no `@legendary-arena/game-engine`
  runtime import anywhere in `apps/arena-client/`); unblocks WP-062 and WP-064;
  test runner and router choice deferred to "match `apps/registry-viewer/`
  precedent" to avoid drift; accessibility baseline (WCAG AA contrast, focus
  rings) established in base CSS for all future UI packets to inherit.
  Layer rule: client apps consume engine types only; this WP enforces that
  boundary at repo setup time so it cannot regress later.

- [x] WP-062 — Arena HUD & Scoreboard (Client Projection View) ✅ Reviewed (2026-04-16 lint-gate pass) — Completed 2026-04-18 under EC-069 (see [session-wp062-arena-hud-scoreboard.md](../invocations/session-wp062-arena-hud-scoreboard.md))
  Dependencies: WP-061, WP-028, WP-029, WP-048, WP-067
  Notes: First on-screen presentation of `UIState`; fixed (non-floating) HUD
  comprising `<TurnPhaseBanner />`, `<SharedScoreboard />`, `<ParDeltaReadout />`,
  `<PlayerPanelList />`, `<EndgameSummary />`; five shared counters
  (bystandersRescued, escapedVillains, twistCount, tacticsRemaining,
  tacticsDefeated) rendered unconditionally from the required
  `UIState.progress` field (no phase gating — lobby renders zeros);
  `<ParDeltaReadout />` reads `gameOver.par.finalScore` when `'par' in gameOver`
  and renders em-dash otherwise (D-6701 dominant path); zero is a valid engine
  value rendered as `0`, not em-dash; bystanders-rescued counter carries
  `data-emphasis="primary"` exactly once per Vision §Heroic Values in Scoring;
  no client-side arithmetic on game values; `team` vocabulary forbidden;
  color-blind-safe Okabe-Ito palette with mandatory icon differentiation
  (color is never the sole signal); five new base.css tokens with numeric
  contrast-ratio comments under both light and dark `prefers-color-scheme`
  blocks; container/presenter split enforced (only `ArenaHud.vue` imports
  `useUiStateStore`); `ArenaHud.vue`, `PlayerPanel.vue`, `PlayerPanelList.vue`,
  `ParDeltaReadout.vue`, `EndgameSummary.vue` use the `defineComponent`
  authoring form per D-6512 / P6-30 (template-scope bindings beyond props
  require setup-returned surfacing under vue-sfc-loader's separate-compile
  pipeline); `TurnPhaseBanner.vue` + `SharedScoreboard.vue` remain in
  `<script setup>` form (props-only templates). Repo suite: 464 tests passing
  (engine 409/101, arena-client +22 tests / 6 new test files, registry 3,
  vue-sfc-loader 11, server 6); no engine or registry changes.

- [x] WP-063 — Replay Snapshot Producer ✅ Reviewed (2026-04-16 lint-gate pass) — Completed 2026-04-19 at commit `97560b1` under EC-071 (see [session-wp063-replay-snapshot-producer.md](../invocations/session-wp063-replay-snapshot-producer.md))
  Dependencies: WP-027, WP-028, WP-005B, WP-080 (step-level API —
  amended 2026-04-18 after WP-063 / EC-071 stopped at Pre-Session
  Gate #4; resumes after WP-080 / EC-072 lands)
  Notes: Two-part packet crossing engine + new CLI app; engine adds type
  `ReplaySnapshotSequence` (version: 1 literal, `readonly snapshots:
  readonly UIState[]`) and pure helper `buildSnapshotSequence({ setupConfig,
  seed, inputs })` that wraps WP-027's harness and calls `buildUIState`
  (WP-028) at each step, returning a frozen sequence; helper is pure (no I/O,
  no `console.*`, no wall clock, no RNG); new CLI app `apps/replay-producer/`
  wraps the helper with file I/O, exposing `produce-replay --in <file>
  --out <file> --produced-at <iso>`; `--produced-at` override required for
  byte-identical determinism tests across machines; exit codes documented
  (0/1/2/3/4); sorted top-level JSON keys for stable diffs; committed golden
  sample (`three-turn-sample`) demonstrates round-trip; consumed by WP-064;
  no change to `G`, `UIState`, `buildUIState`, WP-027 harness surface, or
  any existing engine move/phase; `apps/arena-client/`, `apps/registry-viewer/`,
  `apps/server/`, `packages/registry/`, `packages/preplan/` untouched.

- [x] WP-064 — Game Log & Replay Inspector ✅ Reviewed (2026-04-16 lint-gate pass) — Completed 2026-04-19 at commit `76beddc` under EC-074 (see [session-wp064-log-replay-inspector.md](../invocations/session-wp064-log-replay-inspector.md))
  Dependencies: WP-061, WP-063, WP-028, WP-027
  Execution Checklist: `docs/ai/execution-checklists/EC-074-log-replay-inspector.checklist.md` (Done)
  Notes: First post-match inspection UI; `<GameLogPanel />` renders
  `UIState.log` verbatim with `aria-live="polite"` and a `role="status"`
  empty state (no reformatting, no filtering — engine authors log entries,
  client renders them); `<ReplayInspector />` consumes a
  `ReplaySnapshotSequence` (imported as a type from WP-063) and drives
  the Pinia store via `setSnapshot` on index changes — client NEVER
  regenerates `UIState` from moves (Layer Boundary); keyboard operation
  (`←`/`→` step, `Home`/`End` jump) on the inspector root with
  `tabindex="0"` + listeners-on-root pattern locked as **D-6401** (first
  repo stepper precedent); `<ReplayFileLoader />` uses the browser `File`
  API to accept a JSON replay (no `fetch`, no network);
  `parseReplayJson(raw, source?)` carries the consumer-side D-6303
  `version === 1` assertion with three locked full-sentence error
  templates mirroring the WP-063 CLI wording. Fixture
  (`apps/arena-client/src/fixtures/replay/three-turn-sample.{json,
  inputs.json,cmd.txt}`) is 8 snapshots produced by the committed WP-063
  CLI from a hand-authored inputs file mixing `advanceStage` moves
  (visible `currentStage` transitions) with unknown-move records (log
  growth via `applyReplayStep`'s warning-and-skip) — phases unreachable
  per D-0205, fixture re-scoped to stage-and-log per the WP-064
  amendment 2026-04-19; byte-identical regeneration confirmed twice.
  Clamping (no wrap) at both step boundaries. `enableAutoPlay` is a
  forward-compat prop (default `false`, no implementation in this
  packet — autoplay deferred to keep scope to one session). `src/stores/`
  + `src/main.ts` + `src/fixtures/uiState/` + `src/components/hud/` +
  `apps/arena-client/package.json` untouched. `pnpm-lock.yaml` absent
  from diff (P6-44 pass — no new devDep). Engine, registry,
  vue-sfc-loader, server, replay-producer, registry-viewer all
  untouched. arena-client tests 35 → 66 (+31); repo-wide tests 486 → 517.
  01.5 NOT INVOKED. 01.6 post-mortem MANDATORY (new long-lived abstraction
  `parseReplayJson` + new keyboard focus precedent D-6401) — delivered
  in-session at `docs/ai/post-mortems/01.6-WP-064-log-replay-inspector.md`;
  verdict WP COMPLETE. One in-allowlist refinement applied during
  post-mortem (`currentLog` spread-copy in `<ReplayInspector />` —
  WP-028 / D-2802 aliasing-prevention pattern). Pre-commit review ran
  in a separate gatekeeper session per P6-35 default; no P6-42
  deviation. Two commits on this branch: `76beddc` EC-074 (code +
  fixture + post-mortem) and `<this commit>` SPEC (governance close).

- [x] WP-079 — Label Engine Replay Harness as Determinism-Only ✅ Completed 2026-04-19 at commit `1e6de0b` under EC-073 (Reviewed 2026-04-18 lint-gate pass; 00.3 self-lint clean after two surgical patches)
  Dependencies: WP-027, D-0205
  Execution Checklist: `docs/ai/execution-checklists/EC-073-label-replay-harness-determinism-only.checklist.md` (Done)
  Notes: Doc-only decision-closure WP carrying out D-0205's single
  follow-up action. Modifies two source files (doc-only content
  edit; zero runtime behavior change): `packages/game-engine/src/replay/replay.execute.ts`
  gains a module-header notice + wholesale `replayGame()` JSDoc
  rewrite; `packages/game-engine/src/replay/replay.verify.ts`
  gains a module-header sentence + wholesale `verifyDeterminism()`
  JSDoc rewrite. Forbidden phrases ("replays live matches",
  "replays a specific match", "reproduces live-match outcomes")
  must grep to zero; required phrases ("determinism-only" ≥ 2 in
  execute / ≥ 1 in verify; D-0205 xref in both; `MOVE_LOG_FORMAT.md`
  Gap #4 xref in execute). No signature changes. No export changes.
  No type changes. No test changes — test count IDENTICAL to
  starting commit. No new files. Hard upstream for WP-080 (both
  packets touch `replay.execute.ts`; WP-079 lands first, WP-080
  inherits the JSDoc narrowing verbatim). Commit prefix `EC-073:`
  at execution (NEVER `WP-079:` per P6-36). NO 01.6 post-mortem
  required (doc-only; no new abstraction; no new code category).

- [x] WP-080 — Replay Harness Step-Level API for Downstream Snapshot / Replay Tools ✅ Reviewed (2026-04-18 lint-gate pass — drafted to unblock WP-063 / EC-071 Pre-Session Gate #4) — Executed 2026-04-19 at commit `dd0e2fd`
  Dependencies: WP-027, WP-079, D-6304
  Execution Checklist: `docs/ai/execution-checklists/EC-072-replay-harness-step-level-api.checklist.md` (Done)
  Notes: Additive refactor to `packages/game-engine/src/replay/replay.execute.ts`:
  adds named export `applyReplayStep(gameState, move, numPlayers):
  LegendaryGameState` (Q1 = Option A — single function, minimum surface),
  mutate-and-return-same-reference contract (Q2 = Option A), and refactors
  `replayGame`'s internal loop to delegate each iteration to the new
  export (Q3 = Option A — single source of truth for dispatch).
  `MOVE_MAP` and `buildMoveContext` remain file-local; `ReplayMoveContext`
  remains a file-local structural interface (Q4 — not exported). One new
  export line added under the WP-027 block in `packages/game-engine/src/index.ts`.
  New test file `replay.execute.test.ts` adds three cases: identity
  (same inputs → same output state), `replayGame` regression guard
  (byte-identical `stateHash` on existing `verifyDeterminism` fixture
  pre- and post-refactor), and unknown-move warning-and-skip routing.
  `ReplayInputsFile` is OUT OF SCOPE (Q5 — WP-063's concern). RNG
  semantics unchanged; D-0205 remains in force (step function inherits
  reverse-shuffle determinism-only semantics). WP-079 is a hard upstream —
  both packets touch `replay.execute.ts`; WP-079 lands first with JSDoc
  narrowing, WP-080 inherits it verbatim. If WP-079 has no EC at WP-080
  execution time, drafting WP-079's EC is a transitive prerequisite.
  Commit prefix `EC-072:` at execution (never `WP-080:` per P6-36).
  Unblocks WP-063 Pre-Session Gate #4 once executed.

- [ ] WP-066 — Registry Viewer: Card Image-to-Data Toggle (Not yet reviewed)
  Dependencies: None (registry viewer is independent)
  Notes: Adds a global view-mode toggle to `apps/registry-viewer/` allowing
  users to switch between image view (current behavior) and a structured
  data view mirroring www.master-strike.com layout. Toggle state persisted
  in `localStorage` under key `cardViewMode` (`'image'` | `'data'`, default
  `'image'`). New components: `ViewModeToggle.vue` (button/switch), 
  `CardDataDisplay.vue` (structured card attributes table). Modified components:
  `App.vue` (manages global viewMode state), `CardDetail.vue` (conditional
  render image or data based on viewMode). Display attributes organized by
  section (cost, attack, recruit, abilities, metadata); both modes use same
  underlying `FlatCard` data; printable in data mode. Toggling view does not
  reset selected card or filters. No TypeScript errors. Follows
  `docs/ai/REFERENCE/00.6-code-style.md` conventions.

- [x] WP-067 — UIState Projection of PAR Scoring & Progress Counters ✅ Reviewed (2026-04-17 lint-gate pass) — Completed 2026-04-17 under EC-068 (see [session-wp067-uistate-par-projection-and-progress-counters.md](../invocations/session-wp067-uistate-par-projection-and-progress-counters.md))
  Dependencies: WP-028, WP-048
  Execution Checklist: `docs/ai/execution-checklists/EC-068-uistate-par-projection-and-progress-counters.checklist.md`
  Commit prefix: `EC-068:` (EC-066 / EC-067 taken; EC-068 is the next free slot)
  Lint-gate outcome: 1 fix applied (added explicit `00.6-code-style.md` citation
  to Non-Negotiable Constraints per §2). 1 scope amendment applied during
  lint-gate (adds 3 WP-061 fixture type-conformance edits to §Files Expected
  to Change — the new non-optional `UIState.progress` field forces
  `satisfies UIState` updates in the three committed fixtures; leaving them
  unchanged would break `pnpm -r test`). 2 non-blocking observations noted:
  (a) §5 file count is now 11 unconditional + 2 conditional + 3 governance;
  the 2 conditional files under §C (`types.ts`, `buildInitialGameState.ts`)
  are **highly likely to trigger** because WP-048 did NOT add
  `G.activeScoringConfig` (D-4802 explicitly deferred it to WP-067;
  confirmed post-commit against `2587bbb`). WP-067 therefore owns both
  the design decision (optional 3rd param to `buildInitialGameState`
  vs. server-layer population vs. 9-field `MatchSetupConfig` amend — see
  `session-context-wp067.md`) and the implementation; realistic file
  count is ≤ 16 not ≤ 14. (b) §14 Acceptance Criteria has 18 items vs
  the 6–12 advisory band, each binary / observable / specific across six
  concern subsections — consolidation would reduce traceability. Both
  observations non-blocking per 00.3 Final Gate (neither matches a
  ❌ FAIL condition).
  Notes: Engine-side bridge between WP-048 (PAR scoring types) and WP-062
  (Arena HUD). Adds `UIProgressCounters { bystandersRescued, escapedVillains }`
  and optional `UIGameOverState.par: UIParBreakdown { rawScore, parScore,
  finalScore, scoringConfigVersion }` to `UIState`. Extends `buildUIState`
  with two pure helpers: aggregates bystanders by scanning each player's
  victory pile via `G.villainDeckCardTypes`; reads `escapedVillains` from
  `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS] ?? 0`; projects WP-048's
  `ScoreBreakdown` into `UIGameOverState.par` only when
  `G.activeScoringConfig` is defined and `phase === 'end'`. Adds drift
  tests asserting field-name stability. Purely additive — no existing
  `UIState` sub-type contract changes; no UI code modified; no new G
  counter introduced (bystanders aggregated at projection time per
  DECISIONS.md rationale). Discovered 2026-04-17 during WP-061 execution
  audit of WP-062 (see `session-context-wp062.md` §IMPORTANT and 01.4
  Precedent Log P6-30/31/32 context).
  Unblocks: WP-062 pre-flight blockers #1–#3 (dependency, no-UI, field
  names). WP-062 pre-flight blocker #4 (base.css allowlist) is
  independent.

---

## Phase 7 — Beta, Launch & Live Ops

These packets ship the game and keep it running.

- [ ] WP-049 — PAR Simulation Engine ✅ Reviewed
  Dependencies: WP-036, WP-048
  Notes: Implements T2 Competent Heuristic AI policy (5 behavioral heuristics
  modeling experienced human play) and PAR aggregation pipeline (55th percentile
  of simulated Raw Scores); `generateScenarioPar` orchestrates simulation ->
  scoring -> PAR for any scenario; AI policy tier taxonomy (T0-T4) documented
  with T2 as sole PAR authority; minimum 500 simulated games per scenario;
  deterministic, replayable, versioned; does NOT modify engine, WP-036, or
  WP-048 contracts; implements Phase 2 of PAR derivation pipeline per
  `docs/12-SCORING-REFERENCE.md`
  Governance: PAR simulations consume match setup as their sole configuration
  input (D-1244); must reject invalid setups rather than correcting them;
  no simulation may derive or mutate setup composition; seed-to-PRNG wiring
  limitations documented in D-1248 and must not be masked

- [ ] WP-051 — PAR Publication & Server Gate Contract ✅ Reviewed
  Dependencies: WP-050, WP-004
  Notes: Server-layer enforcement of the pre-release PAR gate; loads PAR
  index at startup (non-blocking — casual play continues without PAR);
  `checkParPublished` is index-only lookup (no filesystem probing);
  competitive submissions rejected when PAR is missing (fail closed);
  server is read-only for PAR data; does NOT implement leaderboard endpoint
  (future work); does NOT modify engine or WP-050 contracts; server files
  use `.mjs` extension per WP-004; closes the chain from simulation →
  artifact → enforcement

- [ ] WP-052 — Player Identity, Replay Ownership & Access Control ✅ Reviewed
  Dependencies: WP-051, WP-004, WP-027
  Notes: Introduces `PlayerId` (branded string, UUID v4), `PlayerAccount`,
  `GuestIdentity`, `PlayerIdentity` discriminated union; `ReplayOwnership`
  contracts with `ReplayVisibility` (`private` | `link` | `public`),
  defaulting to `private`; guest players can play and export replays without
  an account — core gameplay is never gated; account players unlock
  server-side replay persistence, leaderboard submission, and shareable
  links; PostgreSQL tables `legendary.players` and `legendary.replay_ownership`;
  identity affects access and visibility only — never gameplay, RNG, scoring,
  or engine execution; identity types live in `apps/server/` — never in
  `packages/game-engine/`; GDPR-compliant deletion; 30-day minimum retention
  per `13-REPLAYS-REFERENCE.md`; does NOT modify WP-027 or WP-051 contracts

- [ ] WP-053 — Competitive Score Submission & Verification ✅ Reviewed
  Dependencies: WP-048, WP-051, WP-052, WP-027, WP-004
  Notes: Keystone trust surface for competition — every competitive score is
  replay-verified; server re-executes replays via `replayGame`, recomputes
  scores via WP-048 engine contracts (`deriveScoringInputs`, `computeRawScore`,
  `computeFinalScore`, `buildScoreBreakdown`); client-reported values never
  trusted; PAR publication enforced via `checkParPublished`; `CompetitiveScoreRecord`
  is immutable once created; idempotent via `UNIQUE (player_id, replay_hash)`;
  guest identities cannot submit competitively; private replays not eligible
  until visibility changed; server is enforcer, not calculator — delegates
  scoring to engine; PostgreSQL table `legendary.competitive_scores`;
  does NOT modify WP-048, WP-051, WP-052, or WP-027 contracts

- [ ] WP-054 — Public Leaderboards & Read-Only Web Access ✅ Reviewed
  Dependencies: WP-053, WP-052, WP-051, WP-004
  Notes: Read-only public access to verified competitive results;
  scenario-scoped leaderboards sorted by `finalScore` ascending,
  `createdAt` ascending tie-break; only scores with `visibility IN
  ('link', 'public')` included — private replays never exposed; PAR-missing
  scenarios return empty results (fail closed); no authentication required
  for public queries; `PublicLeaderboardEntry` strips sensitive fields
  (`playerId`, `email`, `replayHash`, `stateHash`, `scoreBreakdown`);
  no new database tables — query projections of existing tables; no SQL
  write operations; no engine imports; no scoring logic; does NOT modify
  WP-053 or WP-052 contracts

- [ ] WP-050 — PAR Artifact Storage & Indexing ✅ Reviewed
  Dependencies: WP-049, WP-048
  Notes: Defines how PAR simulation results are stored, indexed, versioned,
  and accessed as immutable file-based artifacts; content-addressed by
  ScenarioKey with sharded directory layout; deterministic sorted-key JSON
  serialization for bit-for-bit reproducibility; `index.json` manifest for
  fast existence checks (server pre-release gate); PAR version directories
  (`v1/`, `v2/`) immutable once published; calibration updates create new
  versions, never in-place edits; scales to 10k-100k scenarios; works on
  local filesystem, R2/S3, or CDN; does NOT modify engine, WP-049, or WP-048

- [ ] WP-036 — AI Playtesting & Balance Simulation ✅ Reviewed
  Dependencies: WP-035
  Notes: `AIPolicy` pluggable interface receives filtered UIState + legal moves,
  returns `ClientTurnIntent`; `RandomPolicy` MVP baseline (seeded RNG);
  `runSimulation` executes N games with aggregate stats (win rate, turns,
  scores); AI uses same pipeline as humans — no special engine access (D-0701);
  AI cannot inspect hidden state; decisions deterministic and reproducible;
  no engine modifications; balance changes require simulation (D-0702); was
  truncated at 65 lines — normalized to full PACKET-TEMPLATE

- [ ] WP-037 — Public Beta Strategy ✅ Reviewed
  Dependencies: WP-036
  Notes: Strategy docs + type definitions only — no engine modifications;
  invitation-only, hard user cap, unique build ID; three cohorts (expert
  tabletop, general strategy, passive observers); `BetaFeedback` type tied
  to build version with optional replay reference; binary exit criteria per
  category (rules, UX, balance, stability); no "beta mode" in engine — beta
  runs same deterministic engine as production; uses same release gates as
  prod (WP-035); was truncated at 114 lines — normalized to full
  PACKET-TEMPLATE

- [ ] WP-038 — Launch Readiness & Go-Live Checklist ✅ Reviewed
  Dependencies: WP-037
  Notes: Documentation only — no engine modifications; 4 readiness gate
  categories (engine/determinism, content/balance, beta exit, ops/deployment);
  all gates binary pass/fail — single failure = NO-GO; single launch authority
  (one owner, not consensus); launch day: build verification, soft launch
  window with monitoring, go-live signal; 72h post-launch change freeze;
  rollback triggers: invariant violation spike, replay divergence, migration
  failure, client desync; was 157 lines but missing template sections —
  normalized to full PACKET-TEMPLATE

- [ ] WP-039 — Post-Launch Metrics & Live Ops ✅ Reviewed
  Dependencies: WP-038
  Notes: Documentation + type definitions only — no engine modifications;
  four metric categories: system health (P0), gameplay stability (P1),
  balance signals (P2), UX friction (P3); all metrics derived from
  deterministic sources, version-tagged (D-0901); alerting reuses WP-035
  severity levels; live ops cadence: daily/weekly/monthly; change management:
  validated content OK, hot-patches forbidden; stability > growth; was 250
  lines but missing template sections — normalized to full PACKET-TEMPLATE

- [ ] WP-040 — Growth Governance & Change Budget ✅ Reviewed
  Dependencies: WP-039
  Notes: Documentation + type definitions only; five change categories
  (ENGINE | RULES | CONTENT | UI | OPS) — classification mandatory before
  shipping; immutable surfaces (replay, RNG, scoring, invariants, endgame)
  require major version to change (D-1002); per-release change budgets
  declared before development; primary growth vectors: CONTENT + UI (D-1003);
  ENGINE changes restricted, require architecture review; implements D-1001,
  D-1002, D-1003; was truncated at 57 lines — normalized to full
  PACKET-TEMPLATE

- [ ] WP-041 — System Architecture Definition & Authority Model ✅ Reviewed
  Dependencies: WP-040
  Notes: Architecture review and consolidation — NOT new design; verifies
  ARCHITECTURE.md Field Classification table has all 19 G fields from
  WP-002 through WP-026; adds version stamp; documents authority hierarchy
  (CLAUDE.md > ARCHITECTURE.md > rules > WORK_INDEX > WPs); audits
  consistency with DECISIONS.md and `.claude/rules/*.md`; logs drift but
  does NOT modify rules files; no engine modifications; no new layers,
  boundaries, or invariants invented; was truncated at 69 lines and not
  registered in WORK_INDEX — normalized to full PACKET-TEMPLATE and added

---

## Pre-Planning System (Parallel-Safe with Phase 4+)

Reduces multiplayer downtime by providing a sandboxed speculative planning
system for waiting players. Design constraints in
`docs/ai/DESIGN-CONSTRAINTS-PREPLANNING.md`, architecture in
`docs/ai/DESIGN-PREPLANNING.md`.

All pre-planning code lives in `packages/preplan/` — outside the game engine.
The preplan package may import engine type definitions only (never runtime
code, never `boardgame.io`).

- [ ] WP-056 — Pre-Planning State Model & Lifecycle — pending ✅ Reviewed
  Dependencies: WP-006A, WP-008B
  Notes: Types-only WP — no runtime-executable code; creates
  `packages/preplan/` package with `PrePlan`, `PrePlanSandboxState`,
  `RevealRecord`, `PrePlanStep` types; `PrePlan` includes `prePlanId`
  (unique identity), `revision` (monotonic version), `status` ('active' |
  'invalidated' | 'consumed'), `baseStateFingerprint` (divergence hint,
  not correctness guarantee), `invalidationReason` with machine-stable
  `effectType` discriminator ('discard' | 'ko' | 'gain' | 'other') and
  optional `affectedCardExtId`; all zones use `CardExtId[]`; counters use
  `Record<string, number>` (engine convention); reveal ledger elevated to
  INVARIANT status (sole authority for rewind — sandbox inspection is
  invalid); lifecycle states encoded in data; null semantics documented
  (missing plan = "no plan", empty planSteps = "planning started");
  sandbox counters must not encode conditional state or rule flags;
  architectural boundary enforced via grep checks (no boardgame.io, no
  engine runtime imports)

- [ ] WP-057 — Pre-Plan Sandbox Execution — pending ✅ Reviewed
  Dependencies: WP-056, WP-006A, WP-008B
  Notes: First runtime code in `packages/preplan/`; client-local seedable
  PRNG (LCG or equivalent — deterministic per seed, never `ctx.random.*`,
  algorithm changes require snapshot test updates); `createPrePlan` builds
  sandbox from `PlayerStateSnapshot` with shuffled deck copy; speculative
  operations: `speculativeDraw` (deck → hand + ledger), `speculativePlay`
  (hand → inPlay), `updateSpeculativeCounter`, `addPlanStep` (isValid
  initialized true, never mutated in this WP), `speculativeSharedDraw`
  (caller must verify card visibility); all functions are pure, guard on
  `status === 'active'`, increment `revision`, return new PrePlan (no
  mutation); failure signaling via `null` (never throw for expected
  conditions); zero-op plans explicitly valid; 3 test files

- [ ] WP-058 — Pre-Plan Disruption Pipeline — pending ✅ Reviewed
  Dependencies: WP-057, WP-056, WP-008B
  Notes: Full disruption workflow as single cohesive pipeline (detect →
  invalidate → rewind → notify — not separable); `PlayerAffectingMutation`
  with `sourcePlayerId` (who caused it) and `affectedPlayerId` (who was
  disrupted) plus `effectType` discriminator; binary per-player detection
  (no plan-step or sandbox inspection); `invalidatePrePlan` transitions
  active → invalidated with causal reason; `computeSourceRestoration`
  derives returns from reveal ledger exclusively (INVARIANT); deck returns
  must be reshuffled, shared source returns restore membership only;
  `buildDisruptionNotification` produces structured causal message
  (`effectDescription` is canonical, `message` is derived rendering);
  `executeDisruptionPipeline` orchestrates all steps, returns
  `DisruptionPipelineResult` with `requiresImmediateNotification: true`
  (Constraint #7 encoded in data); multiple mutations per move handled
  mechanically by status guard (first invalidates, subsequent return null);
  terminal state invariant: invalidated plans must never be passed to
  speculative operations; all functions pure; acceptance scenario test
  required (create → plan → disrupt → verify); 2 test files

  WP-059 (Pre-Plan UI Integration) is deferred until WP-028 (UI State
  Contract) is executed and a UI framework decision is made. Integration
  guidance preserved in `docs/ai/DESIGN-PREPLANNING.md` Section 11.

---

## Dependency Chain (Quick Reference)

```
Foundation Prompts: 00.4 → 00.5 → 01 → 02
                                        │
WP-001 (coordination — complete)        │
                                        ▼
                    WP-002 ──────────── WP-003
                       │                  │
                       └────── WP-004 ────┘
                                  │
                    WP-005A → WP-005B → WP-006A → WP-006B
                                                      │
                    WP-007A → WP-007B → WP-008A → WP-008B
                                                      │
                    WP-009A → WP-009B → WP-010 → WP-011 → WP-012 → WP-013
                                                                        │
                    WP-014 → WP-015 → WP-016 → WP-017 → WP-018 → WP-019 → WP-020
                                                                              │
                    WP-021 → WP-022 → WP-023 → WP-024 → WP-025 → WP-026
                                                                        │
                    WP-027 → WP-028 → WP-029 → WP-030
                       │                            │
                       └──── WP-048 (+ WP-020) ─────┘
                                            │
                    WP-031 → WP-032 → WP-033 → WP-034 → WP-035
                                                              │
                    WP-036 ──────────→ WP-049 (+ WP-048) → WP-050 → WP-051
                                                                        │
                    WP-052 (+ WP-004, WP-027) ←─────────────────────────┘
                       │
                    WP-053 (+ WP-048, WP-027) ←── WP-052
                       │
                    WP-054 (+ WP-052, WP-051) ←── WP-053
                    
                    WP-036 → WP-037 → WP-038 → WP-039 → WP-040

                    Pre-Planning (parallel with Phase 4+):
                    WP-006A + WP-008B → WP-056 → WP-057 → WP-058
                                                            │
                    WP-059 (deferred — needs WP-028 + UI framework decision)

                    UI Implementation Chain (Phase 6, parallel with Phase 7 where deps allow):
                    WP-065 (Vue SFC Test Transform — prerequisite for all UI test packets)
                       │
                    WP-028 + WP-065 → WP-061 → WP-062 (+ WP-029, WP-048)
                                        │          │
                                        │          └── future spectator HUD WP (+ WP-029)
                                        │          └── future lobby client WP (+ WP-011)
                                        │          └── future card-tooltip WP (+ registry client access)
                                        │
                                        └── WP-064 (+ WP-028, WP-027)
                                              ▲
                                              │
                    WP-027 + WP-028 → WP-063 ─┘
                    (WP-063 defines ReplaySnapshotSequence consumed by WP-064)
```

**Parallel-safe packets** (no dependency on each other):
- WP-003 (Card Registry) can run alongside WP-002 (Game Skeleton)
- WP-005A and WP-005B have no dependency on WP-004
- WP-030 (Campaign) is parallel to WP-031 (Production Hardening)
- WP-056/057/058 (Pre-Planning) are parallel with Phase 4+ (depend only on WP-006A + WP-008B from Phase 2)
- WP-061 (Client Bootstrap) and WP-063 (Replay Snapshot Producer) are parallel — WP-061 touches only `apps/arena-client/` and WP-063 touches `packages/game-engine/` + new `apps/replay-producer/`; WP-064 joins both chains so it waits for both
- WP-065 (Vue SFC Test Transform) is parallel with every other WP — it touches only `packages/vue-sfc-loader/`; it blocks WP-061, WP-062, WP-064 on the test-harness side only

---

## Conventions Established Across WPs

These decisions were made during packet review and apply to all future packets.
Sessions must not relitigate settled choices without updating DECISIONS.md first.

| Convention | Established in | Rule |
|---|---|---|
| Zones contain `CardExtId` strings only — no card objects | WP-005B, WP-006A | 00.2 §7.1 |
| `makeMockCtx` reverses arrays (not identity shuffle) | WP-005B | 00.3 §12 |
| `Game.setup()` throws `Error` on invalid `MatchSetupConfig`; moves never throw — return void on failure | WP-005B | ARCHITECTURE.md §Section 4 |
| Hero card numeric fields (`cost`, `attack`, `recruit`, `vAttack`) are `string \| number \| undefined` — modifier strings like `"2*"` and `"2+"` exist in real data; strip the modifier and parse integer base; return 0 on unexpected input | WP-003 (`cost`), WP-018 (`attack`/`recruit`), WP-019 (`vAttack`) | ARCHITECTURE.md §Section 2 "Card Field Data Quality" |
| No `boardgame.io` imports in pure helper or rules files | WP-007A, WP-008A, WP-009A | 00.1 non-negotiables |
| Test files use `.test.ts` — not `.test.mjs` | WP-002 onward | project convention |
| Prior packet contract files must not be modified by B packets | WP-006B onward | drift prevention |
| `ZoneValidationError` uses `{ field, message }` — distinct from `MoveError { code, message, path }`; never reuse `MoveError` for zone shape errors | WP-006A | ARCHITECTURE.md §Section 4 |
| Zones other than `deck` start empty at setup — cards enter via moves, not initialization | WP-006B | ARCHITECTURE.md §Section 2 |
| Phase names locked to 00.2 §8.2 mapping — `lobby`, `setup`, `play`, `end`; no alternates | WP-007A | ARCHITECTURE.md §Section 4 |
| `MATCH_PHASES` and `TURN_STAGES` are canonical arrays — drift-detection tests must assert they match their union types | WP-007A | same pattern as `RULE_TRIGGER_NAMES` |
| `G.currentStage` stored in `G`, not `ctx` — inner stage must be observable to moves and JSON-serializable | WP-007B | ARCHITECTURE.md §Section 4 |
| `ctx.events.endTurn()` requires a `// why:` comment | WP-007B, WP-008B | 00.6 Rule 6 |
| `ctx.events.setPhase()` requires a `// why:` comment | WP-011 | 00.6 Rule 6 |
| `MoveResult`/`MoveError` from `coreMoves.types.ts` are the engine-wide result contract — never redefine | WP-008A | single error contract |
| Every move: validate args → check stage gate → mutate G — never mutate before both pass | WP-008B | ARCHITECTURE.md §Section 4 |
| `zoneOps.ts` helpers return new arrays — inputs are never mutated | WP-008B | ARCHITECTURE.md §Section 4 |
| Card references in trigger payloads use `CardExtId`, not `string` | WP-009A | 00.2 §7.1 |
| `RULE_TRIGGER_NAMES` and `RULE_EFFECT_TYPES` arrays must match their union types | WP-009A | drift-detection pattern |
| `HookDefinition` is data-only — no functions | WP-009A | 00.2 §8.2 JSON-serializable |
| `ImplementationMap` handler functions live outside `G` — never stored in state | WP-009B | ARCHITECTURE.md §Section 4 |
| `executeRuleHooks` returns effects; `applyRuleEffects` applies them | WP-009B | separation of concerns |
| `applyRuleEffects` uses `for...of` — never `.reduce()` | WP-009B | 00.6 Rule 8 |
| Unknown effect types push warning to `G.messages` — never throw | WP-009B | graceful degradation |
| Boolean game events stored as numeric counters (`>= 1` for true) | WP-010 | `G.counters` is `Record<string, number>` |
| Loss conditions evaluated before victory when both trigger simultaneously | WP-010 | Legendary rulebook precedence |
| `endIf` delegates to `evaluateEndgame` — no inline counter logic | WP-010 | single source of truth |
| Endgame counters incremented via `ENDGAME_CONDITIONS` constants — never string literals | WP-010 | ARCHITECTURE.md §Section 4 |
| Phase-gated moves live inside the phase's `moves` block — not top-level | WP-011 | boardgame.io phase isolation |
| Phase exit observability: store flag in `G` before `ctx.events.setPhase()` | WP-011 | ARCHITECTURE.md §Section 4 |
| CLI scripts use Node built-in `fetch` — no axios, no node-fetch | WP-011, WP-012 | 00.1 Node v22+ |
| Unit tests for HTTP scripts stub `fetch` — no live server for tests | WP-012 | test isolation |
| Snapshots use zone counts only — no `ext_id` arrays | WP-013 | `MatchSnapshot` is not a copy of `G` |
| Card type classification stored in `G` at setup — moves never import registry | WP-014 | ARCHITECTURE.md §Section 5 |
| `REVEALED_CARD_TYPES` is a canonical array — drift-detection test required; slugs use hyphens not underscores | WP-014 | same drift-detection pattern |
| Pre-planning state lives in `packages/preplan/` — never in `packages/game-engine/` (non-authoritative, per-client) | WP-056 | DESIGN-PREPLANNING.md §3 |
| Reveal ledger is sole authority for rewind — sandbox inspection during rewind is invalid | WP-056 | DESIGN-CONSTRAINTS-PREPLANNING.md #3 |
| Full rewind to clean hand is the baseline — partial plan survival is a future optimization | WP-056 | DESIGN-CONSTRAINTS-PREPLANNING.md #3 |
| Speculative PRNG uses seedable LCG, never `ctx.random.*`; `Date.now()` acceptable for seed entropy | WP-057 | DESIGN-PREPLANNING.md §3 |
| Disruption pipeline is one cohesive workflow (detect → invalidate → rewind → notify) — never split into separate WPs | WP-058 | DESIGN-PREPLANNING.md §11 |

---

## Cross-Cutting Governance Decisions

Decisions that affect multiple phases or span the full pipeline.
Full details are in `DECISIONS.md`; this section provides searchable summaries.

### Match Setup Schema and Validation Alignment (2026-04-11)

Formal audit and correction of the Match Setup schema and validation model
to ensure 1:1 alignment with the engine's authoritative `MatchSetupConfig`.

**Outcomes:**
- Composition schema corrected to match engine contract (9 required fields;
  `heroDeckIds` not `heroIds`; added `henchmanGroupIds` and all 4 count fields)
- `playerCount` constrained to engine limit (1-5, per `game.ts` maxPlayers)
- Redundant `not/anyOf` exclusions removed; fail-closed via `additionalProperties: false`
- Identifier format aligned to content registry (kebab-case `^[a-z0-9-]+$`)
- Two-layer structure documented: envelope (server) vs composition (engine setupData)
- Seed-to-PRNG integration gap documented as future task (D-1248)

**Artifacts:**
- `docs/ai/REFERENCE/MATCH-SETUP-JSON-SCHEMA.json`
- `docs/ai/REFERENCE/MATCH-SETUP-SCHEMA.md`
- `docs/ai/REFERENCE/MATCH-SETUP-VALIDATION.md`
- `DECISIONS.md` entries D-1244 through D-1248

**Impact:** Locks Match Setup as a deterministic, engine-aligned, governance-enforced
configuration boundary for game creation, replays, simulation, and competitive integrity.

### Customer-Safe Configuration Knobs (2026-04-11)

Defines which match setup fields may be adjusted in response to customer
feedback without requiring engine changes, and which surfaces are explicitly
non-configurable.

**Artifact:** `docs/ai/REFERENCE/SAFE-KNOBS.md`

**Key policy:** Safe knobs are data-only configuration parameters expressible
in match setup or its envelope. Runtime switches, conditional logic, and
rule modifications are not safe knobs. Knobs are tiered by risk (Tier 1
fully safe, Tier 2 guarded, Tier 3 gated/future). No knob may move to a
higher tier without a documented decision.

---

## Adding a New Work Packet

1. Create `docs/ai/work-packets/WP-NNN-<topic>.md` using the required template
   in `docs/ai/REFERENCE/00.1-master-coordination-prompt.md`
2. Add a line to the appropriate phase section in this file **before** executing it
3. Run the lint checklist (`docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`)
   against the new packet — it must pass before Claude Code touches it
4. On completion, update the line to `[x]` with the completion date

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[x]` | Complete — Definition of Done met |
| `BLOCKED` | Cannot proceed — see `docs/ai/STATUS.md` for details |
| ✅ Reviewed | Packet audited and ready for Claude Code |
| ⚠️ Needs review | Packet must be reviewed before execution |

---

*Last updated: this coordination review session (see git log for date)*
*Updated by: the Claude Code session at the close of each Work Packet (Step 6 of the Session Execution Protocol in 00.1)*
