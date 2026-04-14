# DECISIONS_INDEX.md — Legendary Arena

## Purpose
This index maps **architectural and product decisions** to the **Work Packets (WPs)**
where they were introduced, justified, or locked in.

Use this file to:
- trace decision origins
- understand dependency chains
- evaluate impact before proposing changes

For full rationale, see `DECISIONS.md`.

---

## Meta‑Principles

| Decision ID | Summary | Introduced In |
|------------|---------|---------------|
| D‑0001 | Correctness over convenience | WP‑027 |
| D‑0002 | Determinism is non‑negotiable | WP‑027 |
| D‑0003 | Data outlives code | WP‑034 |

---

## Engine & Core Architecture

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0101 | Engine is the sole authority | WP‑031 | WP‑032, WP‑041 |
| D‑0102 | Fail fast on invariant violations (not gameplay conditions) | WP‑031 | WP‑039, WP‑010–023 |
| D‑0103 | Engine has no UI/network knowledge | WP‑028 | WP‑041 |
| D‑0104 | Counters are numeric flags, never booleans | WP‑010 | WP‑015, WP‑019, WP‑024 |

---

## Determinism & Replay

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0201 | Replay is first‑class | WP‑027 | WP‑039 |
| D‑0202 | Deterministic state hashing | WP‑027 | WP‑032 |

---

## UI & Presentation

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0301 | UI consumes projections only | WP‑028 | WP‑041 |
| D‑0302 | One UIState, many audiences | WP‑029 | WP‑042 |

---

## Network & Multiplayer

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0401 | Clients submit intents only | WP‑032 | WP‑041 |
| D‑0402 | Engine‑authoritative resync | WP‑032 | WP‑039 |

---

## Campaigns & Scenarios

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0501 | Campaigns are meta‑orchestration | WP‑030 | WP‑041 |
| D‑0502 | Campaign state lives outside engine | WP‑030 | WP‑034 |

---

## Content System

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0601 | Content is data, not code | WP‑033 | WP‑046 |
| D‑0602 | Invalid content blocked at load | WP‑033 | WP‑039 |
| D‑0603 | Representation before execution | WP‑021 | WP‑022, WP‑023, WP‑024 (D-2101, D-2104) |

---

## AI & Balance

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0701 | AI is tooling, not gameplay | WP‑036 | WP‑040 |
| D‑0702 | Balance requires simulation | WP‑036 | WP‑047 |
| D‑0703 | Difficulty declared before competition | WP‑049/050/051 | — |

---

## Versioning & Migration

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0801 | Explicit engine/data/content versions | WP‑034 | WP‑035 |
| D‑0802 | Incompatible data fails loudly | WP‑034 | WP‑039 |

---

## Live Ops

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑0901 | Deterministic metrics only | WP‑039 | — |
| D‑0902 | Rollback always available | WP‑035 | WP‑039 |

---

## Growth Governance

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑1001 | Growth requires change budgets | WP‑040 | — |
| D‑1002 | Immutable surfaces protected | WP‑040 | WP‑041 |
| D‑1003 | Content & UI are growth vectors | WP‑040 | WP‑042 |

---

## Onboarding

| Decision ID | Summary | Introduced In | Reinforced In |
|------------|---------|---------------|--------------|
| D‑1101 | Tutorials use real rules | WP‑042 | — |
| D‑1102 | Onboarding is UI‑only | WP‑042 | WP‑041 |

---

## Registry & Data Contracts

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-1201 | `game_sessions` uses ext_id text references, not bigint FKs | FP-02 |
| D-1202 | MatchConfiguration uses ext_id string references, not numeric IDs | WP-002 |
| D-1203 | `sets.json` and `card-types.json` are incompatible shapes | WP-003 |
| D-1204 | `FlatCard.cost` must be `string \| number \| undefined` | WP-003 |
| D-1227 | FlatCard hero-only optional fields include explicit `undefined` | INFRA |
| D-1228 | `shared.ts` hero card defaults for name and abilities | INFRA |

---

## Server & Infrastructure

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-1205 | Server uses `createRegistryFromLocalFiles` at startup | WP-004 |
| D-1206 | boardgame.io server import uses `createRequire` bridge | WP-004 |
| D-1241 | CLI scripts use boardgame.io built-in lobby endpoints | WP-012 |
| D-1242 | Unit tests stub `fetch` rather than spinning up a test server | WP-012 |
| D-1243 | Credentials printed to stdout, never stored to disk | WP-012 |

---

## Match Setup Contracts

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-1207 | `MatchSetupConfig` is canonical; `MatchConfiguration` is an alias | WP-005A |
| D-1208 | `MatchSetupError` uses `{ field, message }`, not `MoveError` | WP-005A |
| D-1209 | `CardRegistryReader` interface preserves layer boundary | WP-005A |
| D-1244 | Match setup composition maps 1:1 to `MatchSetupConfig` | Schema audit |
| D-1245 | Match setup `playerCount` maximum aligned to engine `maxPlayers` | Schema audit |
| D-1246 | Match setup uses `additionalProperties:false` | Schema audit |
| D-1247 | Match setup two-layer structure: envelope and composition | Schema audit |
| D-1248 | Match setup seed is an archival identifier until PRNG wiring exists | Schema audit |

---

## Player State & Zones

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-1210 | Player starting decks use ext_id strings in G, not full card objects | WP-005B |
| D-1211 | `makeMockCtx` reverses arrays instead of identity shuffle | WP-005B |
| D-1212 | Global piles use `G.piles` container, not flat top-level keys | WP-005B |
| D-1213 | `Game.setup()` uses module-level registry holder pattern | WP-005B |
| D-1214 | Zones store ext_id strings, not full card objects | WP-006A |
| D-1215 | `ZoneValidationError` uses `{ field, message }`, not `MoveError` | WP-006A |
| D-1216 | `LegendaryGameState` consolidated with canonical zone types | WP-006A |
| D-1217 | `buildPlayerState` and `buildGlobalPiles` extracted from `buildInitialGameState` | WP-006B |
| D-1218 | Global piles use token ext_ids rather than registry ext_ids | WP-006B |

---

## Turn & Phase System

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-1219 | `TurnStage` defined separately from boardgame.io's stage concept | WP-007A |
| D-1220 | `getNextTurnStage` returns null after cleanup instead of cycling | WP-007A |
| D-1221 | `G.currentStage` stored in G, not ctx | WP-007B |
| D-1222 | Integration tests call functions directly, not `boardgame.io/testing` | WP-007B |

---

## Move System

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-1223 | `MOVE_ALLOWED_STAGES` stage assignments for core moves | WP-008A |
| D-1224 | `MoveResult`/`MoveError` is the engine-wide result contract | WP-008A |
| D-1225 | `zoneOps.ts` helpers return new arrays rather than mutating G directly | WP-008B |
| D-1226 | Moves return `void` on validation failure rather than throwing | WP-008B |

---

## Rule Pipeline

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-1229 | `HookDefinition` is data-only with no handler functions | WP-009A |
| D-1230 | Rule effects are a tagged data union, not callback functions | WP-009A |
| D-1231 | Hook execution order: priority ascending, then ID lexically | WP-009A |
| D-1232 | `ImplementationMap` pattern: handler functions separate from `HookDefinition` | WP-009B |
| D-1233 | Two-step execute/apply pipeline for rule effects | WP-009B |
| D-1234 | Unknown effect types handled gracefully, not thrown | WP-009B |

---

## Endgame & Lobby

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-1235 | Loss evaluated before victory | WP-010 |
| D-1236 | Numeric counters instead of boolean fields | WP-010 |
| D-1237 | `ESCAPE_LIMIT` as hardcoded MVP constant | WP-010 |
| D-1238 | `G.lobby.started` as a boolean flag in G | WP-011 |
| D-1239 | `startMatchIfReady` transitions to setup, not directly to play | WP-011 |
| D-1240 | `ctx.currentPlayer` as the lobby ready-map key | WP-011 |

---

## Persistence & Snapshots (Phase 3)

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-1310 | Snapshots use zone counts, not `CardExtId` arrays | WP-013 |
| D-1311 | `createSnapshot` is a pure function, not an async DB write | WP-013 |
| D-1312 | `PersistableMatchConfig` excludes G and ctx | WP-013 |
| D-1313 | Endgame outcome derived via `evaluateEndgame`, not stored on G | WP-013 |
| D-1320 | Phase 3 exit approved | Phase 3 gate review |

---

## Phase 3 Governance

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-1301 | Legacy 00.2 sections 7/9/10/11/12 excluded from governed document | WP-043 |
| D-1302 | 00.2 is a human-readable reference subordinate to `schema.ts` | WP-043 |
| D-1401 | Prompt lint checklist remains a REFERENCE document | WP-044 |
| D-1402 | Connection health check remains a REFERENCE document | WP-045 |
| D-1403 | R2 validation gate remains a REFERENCE document | WP-046 |
| D-1404 | Code style: reference is descriptive; `.claude/rules/` is enforcement | WP-047 |

---

## WP-014 — Villain Deck Architecture

### WP-014A — Reveal Pipeline Guarantees

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-1405 | Classification stored in `G.villainDeckCardTypes` at setup | WP-014A |
| D-1406 | Reveal pipeline independent of deck construction | WP-014A |
| D-1407 | Fail-closed behaviour for missing card classification | WP-014A |
| D-1408 | Discard routing is correct and temporary (pre-City) | WP-014A |
| D-1409 | Canonical `RevealedCardType` set is closed and drift-checked | WP-014A |

### WP-014B — Deck Composition Rules (Unlocking Decisions)

| Decision ID | Summary | Unlocks | Introduced In |
|---|---|---|---|
| D-1410 | Henchmen are virtual, instanced cards | `buildVillainDeck` | WP-014B |
| D-1411 | Scheme twists are virtual, scheme-scoped cards | `buildVillainDeck` | WP-014B |
| D-1412 | Deck composition counts come from rules, not config | `buildVillainDeck` | WP-014B |
| D-1413 | Mastermind strikes identified by `tactic` field | `buildVillainDeck` | WP-014B |

---

## Hero Ability Hooks (WP-021)

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-2101 | `HeroAbilityHook` is data-only (same pattern as `HookDefinition`) | WP-021 |
| D-2102 | `HeroKeyword` union is closed; requires DECISIONS.md entry to extend | WP-021 |
| D-2103 | `HeroAbilityTiming` union is closed; defaults to `'onPlay'`, no NL inference | WP-021 |
| D-2104 | Hero ability execution deferred to WP-022+ | WP-021 |
| D-2105 | `buildHeroAbilityHooks` uses `CardRegistryReader`, consumes only key/abilities/deck | WP-021 |

---

## VP Scoring (WP-020)

| Decision ID | Summary | Introduced In |
|---|---|---|
| D-2001 | MVP VP table values locked as named constants | WP-020 |
| D-2002 | Wounds identified by `WOUND_EXT_ID` constant | WP-020 |
| D-2003 | Tactic VP awarded to all players (no per-player attribution) | WP-020 |
| D-2004 | Scores not stored in `G` during MVP | WP-020 |
| D-2005 | `game.ts` not modified for scoring | WP-020 |
| D-2006 | Bystander VP uses dual-source check | WP-020 |

---

## Usage Rules

- Before changing behaviour, locate related Decision IDs here
- Review all referenced WPs
- Add a new decision entry if behaviour meaningfully changes
- Never alter an “Immutable” decision without a major version bump

---

## Relationship to Other Docs
- `DECISIONS.md` — authoritative narrative
- `WORK_INDEX.md` — execution order
- `ARCHITECTURE.md` / WP-041 — structural reference

This index exists to keep growth **intelligent and intentional**.