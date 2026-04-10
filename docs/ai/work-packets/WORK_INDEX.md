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

All WPs marked ⚠️ must be reviewed using the same process applied to WP-001 through WP-014 before Claude Code executes them.

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

- [ ] WP-004 — Server Bootstrap (Game Engine + Registry Integration) ✅ Reviewed
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

- [ ] WP-043 — Data Contracts Reference (Canonical Card & Metadata Shapes) ✅ Reviewed
  Dependencies: WP-003
  Notes: Migrates legacy `00.2-data-requirements.md` into governed
  `docs/ai/REFERENCE/00.2-data-requirements.md`; documents card data shapes,
  metadata lookup shapes, image URL construction, ability text markup, and
  PostgreSQL table inventory; subordinate to `schema.ts` and ARCHITECTURE.md;
  excludes UI concerns (search/filter, preferences, feature flags) per Layer
  Boundary; does not modify any code — reference document only

- [ ] WP-044 — Prompt Lint Governance Alignment ✅ Reviewed
  Dependencies: WP-001
  Notes: Updates governed `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md`
  with subordination clause, Layer Boundary references in §4/§8/§16, and
  `.claude/rules/*.md` cross-references; no lint rules added or removed;
  the checklist remains a REFERENCE document (reusable pre-execution gate),
  distinct from `.claude/rules/*.md` (runtime enforcement); the legacy
  prompt version at `docs/prompts-legendary-area-game/00.3-*` is superseded
  but not deleted

- [ ] WP-045 — Connection Health Check Governance Alignment ✅ Reviewed
  Dependencies: WP-001
  Notes: Updates governed `docs/ai/REFERENCE/00.4-connection-health-check.md`
  with subordination clause, Layer Boundary note (server/ops layer), and
  stop-on-failure semantics; distinguishes the health check gate (Foundation
  Prompt prerequisite) from the Lint Gate (per-WP gate in CLAUDE.md); no
  health checks added or removed; no script modifications; the legacy prompt
  version at `docs/prompts-legendary-area-game/00.4-*` is superseded

- [ ] WP-046 — R2 Validation Governance Alignment ✅ Reviewed
  Dependencies: WP-001, WP-045
  Notes: Updates governed `docs/ai/REFERENCE/00.5-validation.md` with
  subordination clause, Layer Boundary note (registry/data layer), and
  stop-on-failure semantics; distinguishes from WP-042 (deployment
  checklists — operational procedures) vs 00.5 (reusable preflight script);
  no validation checks added or removed; no script modifications; the legacy
  prompt version at `docs/prompts-legendary-area-game/00.5-*` is superseded

- [ ] WP-047 — Code Style Reference Governance Alignment ✅ Reviewed
  Dependencies: WP-001
  Notes: Updates governed `docs/ai/REFERENCE/00.6-code-style.md` header with
  subordination clause (ARCHITECTURE.md and `.claude/rules/code-style.md`),
  three-artifact relationship documentation (00.6 descriptive, rules/code-style.md
  enforcement, 00.3 §16 quality gate); no rules added, removed, or weakened;
  all 15 rules, code examples, enforcement mapping, and change policy preserved;
  no enforcement WP needed — `.claude/rules/code-style.md` already handles
  runtime enforcement

---

## Phase 1 — Game Setup Contracts & Determinism

These packets define *what* a match is before implementing *how* it plays.

- [ ] WP-005A — Match Setup Contracts ✅ Reviewed
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

- [ ] WP-005B — Deterministic Setup Implementation ✅ Reviewed
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

- [ ] WP-006A — Player State & Zones Contracts ✅ Reviewed
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

- [ ] WP-006B — Player State Initialization (Align to Zone Contracts) ✅ Reviewed
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

- [ ] WP-007A — Turn Structure & Phases Contracts ✅ Reviewed
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

- [ ] WP-007B — Turn Loop Implementation ✅ Reviewed
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

- [ ] WP-008A — Core Moves Contracts (Draw, Play, End Turn) ✅ Reviewed
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

- [ ] WP-008B — Core Moves Implementation (Draw, Play, End Turn) ✅ Reviewed
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

- [ ] WP-009A — Scheme & Mastermind Rule Hooks (Contracts) ✅ Reviewed
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

- [ ] WP-009B — Scheme & Mastermind Rule Execution (Minimal MVP) ✅ Reviewed
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

- [ ] WP-010 — Victory & Loss Conditions (Minimal MVP) ✅ Reviewed
  Dependencies: WP-009B
  Notes: Three conditions: `escapedVillains >= 8`, `schemeLoss >= 1`,
  `mastermindDefeated >= 1`; all read from `G.counters` using `ENDGAME_CONDITIONS`
  constants (not string literals — using wrong strings silently breaks the evaluator);
  `ESCAPE_LIMIT = 8` hardcoded MVP constant — will move to `MatchSetupConfig`
  when scheme-specific limits are added; loss before victory;
  `evaluateEndgame` pure function → wired into `endIf` (no inline counter
  logic in `endIf`); was previously truncated — now complete;
  see ARCHITECTURE.md §Section 4 for the full endIf contract

- [ ] WP-011 — Match Creation & Lobby Flow (Minimal MVP) ✅ Reviewed
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

- [ ] WP-012 — Match Listing, Join & Reconnect (Minimal MVP) ✅ Reviewed
  Dependencies: WP-011
  Notes: Two CLI scripts (`list-matches.mjs`, `join-match.mjs`) using Node
  built-in `fetch` — no axios; unit tests stub `fetch` (no live server needed
  for tests); full end-to-end verified manually; no game logic changes

- [ ] WP-013 — Persistence Boundaries & Snapshots ✅ Reviewed
  Dependencies: WP-012
  Notes: Creates `PERSISTENCE_CLASSES` constants, `MatchSnapshot` (zone counts
  only — no ext_id arrays), `PersistableMatchConfig`, `createSnapshot` (pure,
  frozen), `validateSnapshotShape`; also creates `docs/ai/ARCHITECTURE.md`
  (the long-missing system structure doc — 5 required sections); was previously
  truncated — now complete

---

## Phase 4 — Core Gameplay Loop

These packets make the game play like Legendary for the first time.

- [ ] WP-014 — Villain Deck & Reveal Pipeline (Minimal MVP) ✅ Reviewed
  Dependencies: WP-013
  Notes: Creates `G.villainDeck` (`deck`/`discard`) and `G.villainDeckCardTypes`
  (built at setup time from registry — moves never query registry directly);
  `revealVillainCard` move draws top card, classifies, emits `onCardRevealed`
  + specific sub-triggers, applies effects via WP-009B, places in discard;
  `REVEALED_CARD_TYPES` is a canonical array — drift-detection test required
  (setup test file, test 6); slugs use hyphens not underscores;
  WP-015 will modify routing for villain/henchman cards to City; was previously
  truncated — now complete; also updates `docs/ai/ARCHITECTURE.md`

- [ ] WP-015 — City & HQ Zones (Villain Movement + Escapes) ✅ Reviewed
  Dependencies: WP-014
  Notes: `G.city` (5-tuple of `CardExtId | null`) and `G.hq` (5-tuple);
  `pushVillainIntoCity` is a pure helper (no boardgame.io import, no `.reduce()`);
  revealed villains/henchmen route to City instead of discard; cards pushed past
  space 4 escape and increment `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
  — must use the constant, not the string literal; bystander MVP handling:
  discard + message (WP-017 adds capture); HQ initialized empty (WP-016 populates);
  SharePoint links removed; test files use `.test.ts` not `.test.mjs`; normalized
  to PACKET-TEMPLATE structure

- [ ] WP-016 — Fight First, Then Recruit (Minimal MVP) ✅ Reviewed
  Dependencies: WP-015
  Notes: Adds `fightVillain({ cityIndex })` and `recruitHero({ hqIndex })`
  moves, both `main` stage only, both follow three-step validation contract;
  fight-first is a **policy** (not a hard lockout) — documented in DECISIONS.md;
  MVP: no attack/recruit point checking (WP-018), no card text effects (WP-022),
  no bystander rescue (WP-017); was previously truncated at 60 lines —
  normalized to full PACKET-TEMPLATE structure

- [ ] WP-017 — KO, Wounds & Bystander Capture (Minimal MVP) ✅ Reviewed
  Dependencies: WP-016
  Notes: Adds `G.ko: CardExtId[]` and `G.attachedBystanders: Record<CardExtId,
  CardExtId[]>`; MVP: 1 bystander per villain entering City (simplified);
  escape causes current player to gain 1 wound (links WP-015 escapes to
  penalty); `koCard`, `gainWound`, `attachBystanderToVillain`,
  `awardAttachedBystanders` are pure helpers (no boardgame.io import, no
  `.reduce()`); modifies `fightVillain.ts` and `city.logic.ts`; SharePoint
  links removed; test files use `.test.ts`; normalized to PACKET-TEMPLATE

- [ ] WP-018 — Attack & Recruit Point Economy (Minimal MVP) ✅ Reviewed
  Dependencies: WP-017
  Notes: `G.turnEconomy` (attack/recruit/spentAttack/spentRecruit, reset per
  turn); `G.cardStats: Record<CardExtId, CardStatEntry>` built at setup time
  from registry — same pattern as `G.villainDeckCardTypes`; moves NEVER query
  registry (registry boundary enforced); deterministic parser strips `+`/`*`
  from `"2+"` → 2; `fightVillain` gated by available attack; `recruitHero`
  gated by available recruit; no conditional bonuses (WP-022); PowerBI links
  removed; test files `.test.ts`; normalized to PACKET-TEMPLATE

- [ ] WP-019 — Mastermind Fight & Tactics (Minimal MVP) ✅ Reviewed
  Dependencies: WP-018
  Notes: `G.mastermind: MastermindState` with `id`, `baseCardId`,
  `tacticsDeck`, `tacticsDefeated`; `fightMastermind` move validates attack
  from `G.cardStats` (WP-018 pattern), defeats 1 tactic per fight (MVP),
  increments `G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED]` when all
  defeated — must use constant not string; `vAttack` parsed via WP-018's
  `parseCardStatValue` (no separate parser); no tactic text effects (WP-024);
  no VP scoring (WP-020); was truncated at 79 lines — normalized to full
  PACKET-TEMPLATE; SharePoint links removed

- [ ] WP-020 — VP Scoring & Win Summary (Minimal MVP) ✅ Reviewed
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

- [ ] WP-021 — Hero Card Text & Keywords (Hooks Only) ✅ Reviewed
  Dependencies: WP-020
  Notes: Hero ability hooks only — **no execution**; `HeroAbilityHook` is
  data-only, JSON-serializable (same pattern as `HookDefinition`);
  `HeroKeyword` closed canonical union with drift-detection; hooks built at
  setup time, immutable during gameplay; `G.heroAbilityHooks` stores hooks;
  rule engine can observe/query/filter hooks but no effects fire; execution
  deferred to WP-022+; was truncated at 56 lines — normalized to full
  PACKET-TEMPLATE; this packet is inert by design

- [ ] WP-022 — Execute Hero Keywords (Minimal MVP) ✅ Reviewed
  Dependencies: WP-021
  Notes: Executes 4 unconditional hero keywords only: `draw`, `gainAttack`,
  `gainRecruit`, `koCard`; conditional effects safely skipped (no mutation);
  unsupported keywords safely ignored; uses existing helpers (drawCards,
  addResources, koCard) — no ad-hoc state writes; `koCard` MVP targets the
  played card itself (no player choice); execution fires immediately after
  play in registration order; WP-021 contracts not modified; was truncated
  at 160 lines — normalized to full PACKET-TEMPLATE; test files `.test.ts`

- [ ] WP-023 — Conditional Hero Effects (Teams, Colors, Keywords) ✅ Reviewed
  Dependencies: WP-022
  Notes: 4 MVP condition types: `requiresTeam`, `requiresColor`,
  `requiresKeyword`, `playedThisTurn`; conditions are checked not inferred
  (pure predicates, never mutate G); effects never inspect hidden information;
  ALL conditions must pass (AND logic); unsupported condition types safely
  skipped; modifies WP-022 execution to integrate condition evaluation;
  WP-021 contracts not modified; was truncated at 55 lines — normalized to
  full PACKET-TEMPLATE

- [ ] WP-024 — Scheme & Mastermind Ability Execution ✅ Reviewed
  Dependencies: WP-023
  Notes: Schemes and masterminds use the **same** `executeRuleHooks` ->
  `applyRuleEffects` pipeline — no new execution engine; `schemeTwistHandler`
  fires on `onSchemeTwistRevealed`, `mastermindStrikeHandler` fires on
  `onMastermindStrikeRevealed`; scheme-loss increments
  `G.counters[ENDGAME_CONDITIONS.SCHEME_LOSS]` using constant; handlers
  registered in `ImplementationMap` at setup (never stored in G); uses
  existing `HookDefinition` shape and `RuleEffect` types; was truncated at
  52 lines — normalized to full PACKET-TEMPLATE

- [ ] WP-025 — Keywords: Patrol, Ambush, Guard ✅ Reviewed
  Dependencies: WP-024
  Notes: `BoardKeyword` closed union (`'patrol'` | `'ambush'` | `'guard'`)
  with drift-detection; `G.cardKeywords` built at setup (registry boundary);
  Patrol: +1 fight cost; Ambush: wound on City entry; Guard: blocks targeting
  lower-index cards; board keywords are **structural City rules**, NOT hero
  abilities — automatic, no player choice, separate from hero hook system;
  was truncated at 63 lines — normalized to full PACKET-TEMPLATE

- [ ] WP-026 — Scheme Setup Instructions & City Modifiers ✅ Reviewed
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

- [ ] WP-027 — Determinism & Replay Verification Harness ✅ Reviewed
  Dependencies: WP-026
  Notes: `ReplayInput` canonical contract (seed + setupConfig + playerOrder +
  moves); `replayGame` pure function reconstructs game from inputs;
  `verifyDeterminism` runs replay twice and compares canonical state hashes;
  `computeStateHash` uses deterministic serialization (sorted keys);
  implements D-0201 (Replay as First-Class Feature); `ReplayInput` is
  Class 2 (Configuration) data — safe to persist; harness uses `makeMockCtx`
  not `boardgame.io/testing`; does NOT modify gameplay; was truncated at
  63 lines — normalized to full PACKET-TEMPLATE

- [ ] WP-028 — UI State Contract (Authoritative View Model) ✅ Reviewed
  Dependencies: WP-027
  Notes: `UIState` is the **only** state the UI consumes — derived, read-only,
  JSON-serializable; `buildUIState(G, ctx)` is a pure function (no mutation,
  no I/O); hides all engine internals (hookRegistry, cardStats,
  villainDeckCardTypes, heroAbilityHooks, ImplementationMap); player zones
  projected as counts not card arrays; implements D-0301; card display
  resolution is a separate UI concern (not in buildUIState); spectator views
  deferred to WP-029; was truncated at 80 lines — normalized to full
  PACKET-TEMPLATE

- [ ] WP-029 — Spectator & Permissions View Models ✅ Reviewed
  Dependencies: WP-028
  Notes: `UIAudience` type (`player` + `spectator`);
  `filterUIStateForAudience` is a pure post-processing filter on UIState
  (never touches G); active player sees own hand ext_ids, others see counts
  only; spectators see all public zones + hand counts; deck order never
  revealed; implements D-0302 (Single UIState, Multiple Audiences); replay
  viewers use spectator audience; no alternate game states — one UIState,
  filtered views; was truncated at 57 lines — normalized to full
  PACKET-TEMPLATE

- [ ] WP-030 — Campaign / Scenario Framework ✅ Reviewed
  Dependencies: WP-029
  Notes: `ScenarioDefinition` + `CampaignDefinition` + `CampaignState` — all
  data-only, JSON-serializable, external to engine (D-0501, D-0502);
  `applyScenarioOverrides` produces valid `MatchSetupConfig` — engine never
  knows about campaigns; `CampaignState` is Class 2 (Configuration), NOT part
  of `LegendaryGameState`; campaign replay = sequence of `ReplayInput` objects;
  no engine modifications; was truncated at 68 lines — normalized to full
  PACKET-TEMPLATE

- [ ] WP-031 — Production Hardening & Engine Invariants ✅ Reviewed
  Dependencies: WP-029
  Notes: Five non-overlapping invariant categories: structural, gameRules,
  determinism, security, lifecycle; `assertInvariant` throws on violation
  (D-0102 fail fast); invariant checks are pure, deterministic, no I/O;
  critical distinction: invariant violations (structural corruption) fail
  fast; gameplay conditions (insufficient attack, empty pile) remain safe
  no-ops per D-0102 clarification; checks wired into setup and move lifecycle;
  implements D-0001, D-0102; was truncated at 78 lines — normalized to full
  PACKET-TEMPLATE

- [ ] WP-032 — Network Sync & Turn Validation ✅ Reviewed
  Dependencies: WP-031
  Notes: `ClientTurnIntent` canonical submission format; engine-side
  `validateIntent` checks player, turn, move name, args — returns structured
  rejections (never throws); 5 rejection codes: WRONG_PLAYER, WRONG_TURN,
  INVALID_MOVE, MALFORMED_ARGS, DESYNC_DETECTED; desync detection via
  `computeStateHash` (WP-027) — engine state always wins (D-0402);
  transport-agnostic (works with boardgame.io or any future transport);
  implements D-0401, D-0402; was truncated at 66 lines — normalized to
  full PACKET-TEMPLATE

- [ ] WP-033 — Content Authoring Toolkit ✅ Reviewed
  Dependencies: WP-031
  Notes: Author-facing JSON schemas for hero, villain, mastermind, scheme,
  scenario; `validateContent` + `validateContentBatch` — structural, enum,
  cross-reference, and hook consistency checks; returns structured results
  (never throws); schemas reference canonical unions (HERO_KEYWORDS,
  BOARD_KEYWORDS); content validation is pre-engine gate — invalid content
  never reaches Game.setup(); does NOT modify registry Zod schemas; implements
  D-0601, D-0602; was truncated at 78 lines — normalized to full
  PACKET-TEMPLATE

- [ ] WP-034 — Versioning & Save Migration Strategy ✅ Reviewed
  Dependencies: WP-033
  Notes: Three independent version axes: `EngineVersion` (semver),
  `DataVersion` (integer), `ContentVersion` (integer); `VersionedArtifact<T>`
  embeds all stamps at save time; `checkCompatibility` returns structured
  result (compatible/migratable/incompatible); migrations forward-only, pure,
  deterministic; incompatible + unmigratable = fail loud (D-0802); engine
  never guesses old data meaning; implements D-0003, D-0801, D-0802; was
  truncated at 72 lines — normalized to full PACKET-TEMPLATE

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

---

## Phase 7 — Beta, Launch & Live Ops

These packets ship the game and keep it running.

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
                                            │
                    WP-031 → WP-032 → WP-033 → WP-034 → WP-035
                                                              │
                    WP-036 → WP-037 → WP-038 → WP-039 → WP-040
```

**Parallel-safe packets** (no dependency on each other):
- WP-003 (Card Registry) can run alongside WP-002 (Game Skeleton)
- WP-005A and WP-005B have no dependency on WP-004
- WP-030 (Campaign) is parallel to WP-031 (Production Hardening)

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
