# 10 — Glossary

> Canonical definitions of key terms, types, and abbreviations used
> across Legendary Arena. Every Work Packet, code file, and doc page
> must align with these definitions.
>
> **Last updated:** 2026-04-14
>
> When a term here conflicts with usage in code or docs, this glossary
> is authoritative for terminology. For architectural rules, see
> `docs/ai/ARCHITECTURE.md`.

---

## Standard Abbreviations

| Abbreviation | Full Term | Context |
|---|---|---|
| **EC** | Execution Checklist | 63 EC files; EC-mode is active for all code changes |
| **WP** | Work Packet | 66 atomic design units (WP-001 through WP-060) |
| **FP** | Foundation Prompt | 4 infrastructure prompts (FP-00.4, FP-00.5, FP-01, FP-02) |
| **R2** | Cloudflare R2 | Public object storage for card data and images |
| **MVP** | Minimum Viable Product | First playable game loop (Phases 0–4) |
| **G** | Game State | boardgame.io mutable state object — never persisted |
| **ctx** | Context | boardgame.io internal metadata (player, turn, phase, random) |
| **CLI** | Command Line Interface | `.mjs` scripts in `scripts/` and `pnpm` commands |
| **SPA** | Single Page Application | The registry viewer at `cards.barefootbetters.com` |

---

## Core Engine Concepts

| Term | Definition |
|---|---|
| **`G`** | The full game state object managed by boardgame.io. JSON-serializable at all times, mutated via Immer drafts in moves, never persisted to any database. Type: `LegendaryGameState`. |
| **`ctx`** | boardgame.io's internal match metadata — current player, turn number, phase, `ctx.random.*`, `ctx.events.*`. Never persisted or modified directly by game code. |
| **`LegendaryGame`** | The single `Game()` object exported from `packages/game-engine`. All phases, moves, hooks, and `endIf` are registered through it. boardgame.io `^0.50.0` (locked). |
| **`MatchSetupConfig`** | The 9-field deterministic setup payload: `schemeId`, `mastermindId`, `villainGroupIds`, `henchmanGroupIds`, `heroDeckIds`, `bystandersCount`, `woundsCount`, `officersCount`, `sidekicksCount`. Field names locked in 00.2 §8.1. |
| **`CardExtId`** | `string` type alias for external card identifiers. All zones and piles store only `CardExtId` strings — never full card objects. |
| **`makeMockCtx`** | Test utility that provides a mock `ctx` object. `ctx.random.Shuffle` reverses arrays (proves shuffle ran). Does not import `boardgame.io`. |

---

## Data & Registry

| Term | Definition |
|---|---|
| **`CardRegistry`** | Immutable runtime object containing all card sets, heroes, masterminds, etc. Built at server startup from local files. Read-only after creation. |
| **`ext_id`** | Canonical external identifier used across database, `G`, and setup config. Type is `text` in PostgreSQL. Never changes after release. |
| **`slug`** | Human-readable, hyphenated, lowercase identifier (e.g., `iron-man`). Used in URLs, image filenames, and metadata. Hyphens only — never underscores. |
| **`sets.json`** | The set index file in `data/metadata/` and R2 at `metadata/sets.json`. Contains `abbr`, `name`, `releaseDate`. THE registry manifest — 40 entries. |
| **`card-types.json`** | Card type taxonomy (37 entries: villain, hero, scheme, etc.). NOT a set index. Confusing it with `sets.json` causes silent registry failures. |
| **`FlatCard`** | Flattened card record exposed by the registry. Numeric fields (`cost`, `attack`, `recruit`) are `string \| number \| undefined` due to modifier strings like `"2+"`. |

---

## Game State & Zones

| Term | Definition |
|---|---|
| **`PlayerZones`** | Per-player record of 5 zones: `deck`, `hand`, `discard`, `inPlay`, `victory`. All store `CardExtId[]`. |
| **`GlobalPiles`** | 4 shared piles: `bystanders`, `wounds`, `officers`, `sidekicks`. Sized from `MatchSetupConfig` count fields. |
| **`G.currentStage`** | Current turn stage inside the `play` phase: `'start' \| 'main' \| 'cleanup'`. Stored in `G` (not `ctx`) for move observability. Reset to `'start'` each turn. |
| **`G.villainDeckCardTypes`** | `Record<CardExtId, RevealedCardType>` — card type classification built at setup so moves can look up types without registry access. |
| **`G.turnEconomy`** | Attack/recruit/spent tracking. Reset at the start of each player turn. |
| **`G.cardStats`** | `Record<CardExtId, CardStatEntry>` — card stats (attack, recruit, cost) resolved at setup from registry. |
| **`G.counters`** | `Record<string, number>` — endgame condition counters. A value `>= 1` is truthy. Keys governed by `ENDGAME_CONDITIONS` constants. |
| **`G.hookRegistry`** | `HookDefinition[]` — data-only rule definitions. Built at setup, reconstructed each match. |
| **`G.city`** | `CityZone` — 5-space fixed tuple for villain/henchman placement. Space 0 = entry, space 4 = escape. |
| **`G.hq`** | `HqZone` — 5-slot fixed tuple for hero recruit cards. |
| **`G.mastermind`** | `MastermindState` — tactics deck, defeated list, base card ID. Built at setup from registry. |
| **`G.heroAbilityHooks`** | `HeroAbilityHook[]` — hero ability declarations. Data-only, built at setup, immutable during gameplay. |
| **`G.cardKeywords`** | `Record<CardExtId, BoardKeyword[]>` — board keywords per card. Built at setup from ability text (WP-025). |
| **`G.schemeSetupInstructions`** | `SchemeSetupInstruction[]` — scheme board config applied during setup. Empty at MVP (WP-026). |
| **`G.ko`** | `CardExtId[]` — knocked-out cards pile. |
| **`G.attachedBystanders`** | `Record<CardExtId, CardExtId[]>` — bystanders attached to villains. |
| **`G.lobby`** | `{ requiredPlayers, ready, started }` — transient lobby phase state. |

---

## Hero Abilities (Phase 5)

| Term | Definition |
|---|---|
| **`HeroAbilityHook`** | Data-only declaration: `{ cardId, timing, keyword, magnitude, effects?, conditions? }`. Built at setup from hero card text. JSON-serializable. |
| **`HeroKeyword`** | Closed union: `'draw' \| 'attack' \| 'recruit' \| 'ko' \| 'revealVillain' \| 'gainArtifact' \| 'rescueBystander' \| 'wallCrawl'`. With canonical `HERO_KEYWORDS` array. |
| **`HeroAbilityTiming`** | When the ability fires: `'onPlay' \| 'onFight' \| 'onRecruit' \| 'onDiscard' \| 'onReveal'`. With canonical `HERO_ABILITY_TIMINGS` array. |
| **`executeHeroEffects`** | Fires hero keyword effects after `playCard`. Evaluates conditions (AND logic), then applies effects. |
| **`evaluateCondition`** | Pure predicate for hero effect conditions. 4 types: `heroClassMatch`, `requiresTeam`, `requiresKeyword`, `playedThisTurn`. Returns boolean, never mutates G. |

---

## Board Keywords (Phase 5)

| Term | Definition |
|---|---|
| **`BoardKeyword`** | Closed union: `'patrol' \| 'ambush' \| 'guard'`. With canonical `BOARD_KEYWORDS` array. Structural City rules — NOT hero abilities. |
| **Patrol** | +1 fight cost on the target villain (additive modifier). |
| **Guard** | A Guard card at a higher City index blocks fighting cards at lower indices. The Guard itself can be targeted. |
| **Ambush** | Each player gains 1 wound when a card with Ambush enters the City. Inline `gainWound` pattern (D-2503). |

---

## Scheme Setup (Phase 5)

| Term | Definition |
|---|---|
| **`SchemeSetupInstruction`** | Data-only contract: `{ type: SchemeSetupType, value: unknown }`. Follows D-2601 (Representation Before Execution). |
| **`SchemeSetupType`** | Closed union: `'modifyCitySize' \| 'addCityKeyword' \| 'addSchemeCounter' \| 'initialCityState'`. With canonical `SCHEME_SETUP_TYPES` array. |
| **`executeSchemeSetup`** | Deterministic executor. Applies instructions to G via `for...of`. Unknown types warn + skip. |
| **`buildSchemeSetupInstructions`** | Setup-time builder. `registry: unknown` with local structural interface. MVP: returns `[]`. |
| **Safe-skip pattern** | When data is unavailable, implement the full structure but return safe defaults. Preserves extension seams for future WPs. (D-2302, D-2504) |

---

## Rules & Hooks

| Term | Definition |
|---|---|
| **`HookDefinition`** | Data-only structure: `{ id, kind, sourceId, triggers, priority }`. Lives inside `G.hookRegistry`. JSON-serializable — no functions. |
| **`ImplementationMap`** | `Record<string, handler>` — handler functions keyed by hook ID. Lives outside `G`. Never serialized, never stored in state. |
| **`executeRuleHooks`** | Step 1 of rule pipeline: collects `RuleEffect[]` without modifying `G`. |
| **`applyRuleEffects`** | Step 2 of rule pipeline: applies effects to `G` using `for...of`. Never `.reduce()`. Unknown effects push warnings to `G.messages`. |
| **`RuleTriggerName`** | Union of 5 triggers: `onTurnStart`, `onTurnEnd`, `onCardRevealed`, `onSchemeTwistRevealed`, `onMastermindStrikeRevealed`. |
| **`RuleEffectType`** | Union of 4 effect types: `queueMessage`, `modifyCounter`, `drawCards`, `discardHand`. |
| **`RevealedCardType`** | Union: `'villain' \| 'henchman' \| 'bystander' \| 'scheme-twist' \| 'mastermind-strike'`. Slugs use hyphens, not underscores. |

---

## Moves & Validation

| Term | Definition |
|---|---|
| **`MoveResult`** | Engine-wide result type: `{ ok: true } \| { ok: false; errors: MoveError[] }`. Every validator in every packet returns this. |
| **`MoveError`** | `{ code: string; message: string; path: string }`. |
| **`ZoneValidationError`** | `{ field: string; message: string }` — narrower shape for zone structural checks. Distinct from `MoveError`. |
| **`zoneOps.ts`** | Pure helper library for card zone operations. Returns new arrays, never mutates inputs, no `boardgame.io` import, no `.reduce()`. |
| **`validateMatchSetup`** | Validates `MatchSetupConfig` against the registry. Returns `ValidateMatchSetupResult` (structured). The caller (`Game.setup()`) throws on failure — this is the only place in the engine where throwing is correct. |
| **Stage gating** | `MOVE_ALLOWED_STAGES` maps each move to its permitted `TurnStage` values. Checked as Step 2 of the move validation contract (after arg validation, before `G` mutation). |

---

## Endgame & Scoring

| Term | Definition |
|---|---|
| **`ENDGAME_CONDITIONS`** | Canonical record of counter key constants: `ESCAPED_VILLAINS = 'escapedVillains'`, `SCHEME_LOSS = 'schemeLoss'`, `MASTERMIND_DEFEATED = 'mastermindDefeated'`. Every counter increment must use these — never string literals. |
| **`ESCAPE_LIMIT`** | `= 8`. MVP hardcoded constant. Becomes part of `MatchSetupConfig` when scheme-specific limits are added. |
| **`evaluateEndgame`** | Pure function called by `endIf`. Reads only `G.counters`. Loss conditions evaluated before victory. Returns `EndgameResult \| null`. |
| **`EndgameResult`** | `{ outcome: 'heroes-win' \| 'scheme-wins'; reason: string }`. |
| **`computeFinalScores`** | Pure function. Reads `G` without mutating it. Never triggers endgame logic. Never queries the registry. |

---

## Phases & Lifecycle

| Term | Definition |
|---|---|
| **`MATCH_PHASES`** | Canonical array: `['lobby', 'setup', 'play', 'end']`. Locked — do not invent alternate names. |
| **`TURN_STAGES`** | Inside `play` phase: `['start', 'main', 'cleanup']`. Ordering defined once in `turnPhases.logic.ts`. |
| **`getNextTurnStage`** | Single authority on stage ordering. Returns the next stage or `null` (signals turn end). |
| **`advanceTurnStage`** | Calls `getNextTurnStage`. On `null`, calls `ctx.events.endTurn()`. |
| **`startMatchIfReady`** | Lobby move that validates readiness and transitions `lobby` → `setup` via `ctx.events.setPhase()`. |

---

## Persistence & Snapshots

| Term | Definition |
|---|---|
| **Class 1 — Runtime** | `G`, `ctx`, `ImplementationMap`, in-flight `RuleEffect[]`. Never persisted. |
| **Class 2 — Configuration** | `MatchSetupConfig`, player names, creation timestamp. Safe to persist. |
| **Class 3 — Snapshot** | `MatchSnapshot` — immutable, read-only, zone counts only. Never re-hydrated into a live match. |
| **`PERSISTENCE_CLASSES`** | Canonical constants: `'runtime'`, `'configuration'`, `'snapshot'`. |

---

## Governance & Coordination

| Term | Definition |
|---|---|
| **EC-mode** | Execution Checklists are active. All code changes require a matching EC. Compliance is binary. |
| **Drift-detection** | Tests that assert canonical `readonly` arrays exactly match their TypeScript union types. Failure means a value was added to the type but not the array, or vice versa. |
| **Lint Gate** | `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — 28-item quality gate run before executing any WP. |
| **Authority hierarchy** | CLAUDE.md > ARCHITECTURE.md > .claude/rules/*.md > WORK_INDEX.md > WPs > conversation context. Higher entries win in any conflict. |
| **`// why:` comment** | Required on non-obvious decisions: `ctx.events.setPhase()`, `ctx.events.endTurn()`, constants, catch blocks, CJS checks, `APPDATA` usage, `ctx.random.*` usage. |

---

## Naming Rules

- Always use the exact term from this glossary in documentation and code
- Never invent synonyms: `CardExtId` not `cardId` or `externalId`
- No abbreviated variable names: `villainGroup` not `vg`, `setAbbreviation` not `abbr`
- Exception: `G` and `ctx` are permitted inside boardgame.io move functions (framework requires them)
- Slugs use hyphens only: `scheme-twist` not `scheme_twist`

---

**See also:**
- [02-ARCHITECTURE.md](02-ARCHITECTURE.md) — architectural context for every term
- [ai/ARCHITECTURE.md](ai/ARCHITECTURE.md) — authoritative system architecture
- [06-TESTING.md](06-TESTING.md) — how drift-detection tests work
- [ai/REFERENCE/00.2-data-requirements.md](ai/REFERENCE/00.2-data-requirements.md) — canonical field names
