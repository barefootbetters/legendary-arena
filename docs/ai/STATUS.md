# STATUS.md — Legendary Arena

> Current state of the project after each Work Packet or Foundation Prompt.
> Updated at the end of every execution session.

---

## Current State

### WP-026 — Scheme Setup Instructions & City Modifiers (2026-04-14)

**What changed:**
- Scheme setup instruction system implemented: `SchemeSetupType` closed union
  (`'modifyCitySize'` | `'addCityKeyword'` | `'addSchemeCounter'` |
  `'initialCityState'`) with `SCHEME_SETUP_TYPES` canonical array and
  drift-detection test
- `SchemeSetupInstruction` is a data-only, JSON-serializable contract following
  the "Representation Before Execution" pattern (D-2601)
- `executeSchemeSetup()` — deterministic executor handles all 4 instruction
  types via `for...of` (no `.reduce()`), unknown types warn and skip
- `buildSchemeSetupInstructions()` — setup-time builder with
  `registry: unknown` + local structural interface (`SchemeRegistryReader`) +
  runtime type guard. MVP: returns `[]` for all schemes (no structured
  metadata in registry yet, D-2504 safe-skip)
- `modifyCitySize` is warn + no-op at MVP while `CityZone` is a fixed tuple
  (D-2602)
- `G.schemeSetupInstructions: SchemeSetupInstruction[]` added to
  `LegendaryGameState` for replay observability
- Wired into `buildInitialGameState` — builder called after `buildCardKeywords`,
  executor applied to constructed state before return
- 9 new tests (8 executor + 1 drift-detection), 314 total passing
- Phase 5 (Card Mechanics & Abilities) is complete

**What's true now:**
- Schemes can configure the board before the first turn via declarative
  instructions (counters, keywords, city state, city size in future)
- Scheme setup (board config, WP-026) is formally separated from scheme twist
  (event reaction, WP-024) — D-2601
- All scheme setup files are pure (no boardgame.io imports, no .reduce(),
  no registry imports)
- `G.schemeSetupInstructions` is Runtime class, built at setup, immutable
  during gameplay
- WP-025 contracts unmodified (`boardKeywords.types.ts` untouched)
- WP-015 contracts unmodified (`city.types.ts` untouched)

**What's next:**
- Future WP to add structured scheme metadata to the registry (enables real
  setup instructions instead of empty `[]`)
- Future WP to convert `CityZone` from fixed tuple to dynamic array (enables
  `modifyCitySize`)
- Future WP for structured keyword classification for Patrol/Guard
- Future WP for `'gainWound'` RuleEffect type

---

### WP-025 — Keywords: Patrol, Ambush, Guard (2026-04-13)

**What changed:**
- Board keyword system implemented: `BoardKeyword` closed union
  (`'patrol'` | `'ambush'` | `'guard'`) with `BOARD_KEYWORDS` canonical array
  and drift-detection test
- `G.cardKeywords: Record<CardExtId, BoardKeyword[]>` built at setup time
  from registry card data via `buildCardKeywords()` (same pattern as
  `G.cardStats` and `G.villainDeckCardTypes`)
- **Patrol:** `fightVillain` now adds `getPatrolModifier()` (+1 MVP) to the
  fight cost before the attack sufficiency check. Three-step contract preserved.
- **Guard:** `fightVillain` now checks `isGuardBlocking()` — a Guard card at a
  higher City index blocks fighting cards at lower indices. Targeting the Guard
  itself is allowed.
- **Ambush:** `revealVillainCard` now checks `hasAmbush()` after City placement
  — each player gains 1 wound inline (same pattern as escape wounds, D-2503).
- `buildCardKeywords` extracts Ambush from ability text (`"Ambush:"` prefix).
  Patrol and Guard have no data source — dormant with real cards (D-2504).
- 14 new tests (9 unit + 5 integration), 305 total passing

**What's true now:**
- City gameplay has tactical friction: Patrol, Guard, and Ambush modify
  fight validation and reveal behavior
- Board keywords are a separate mechanism from hero ability hooks — automatic,
  no player choice (D-2501)
- All keyword helpers are pure (no boardgame.io imports, no .reduce())
- `G.cardKeywords` is Runtime class, built at setup, immutable during gameplay
- WP-009A contracts unmodified (no new RuleEffect types)
- WP-015 contracts unmodified (`city.types.ts` untouched)
- WP-026 is unblocked

**What's next:**
- WP-026 — Scheme Setup Instructions & City Modifiers
- Future WP to add structured keyword classification for Patrol/Guard
- Future WP to add `'gainWound'` RuleEffect type and migrate Ambush to pipeline

---

### WP-024 — Scheme & Mastermind Ability Execution (2026-04-13)

**What changed:**
- Scheme twist and mastermind strike handlers produce real gameplay effects
- `schemeTwistHandler(G, ctx, payload)` — new handler in
  `packages/game-engine/src/rules/schemeHandlers.ts`
  - Increments `schemeTwistCount` counter on each twist
  - At threshold (7 twists): increments `ENDGAME_CONDITIONS.SCHEME_LOSS`
    counter, triggering scheme-loss via existing endgame evaluator
- `mastermindStrikeHandler(G, ctx, payload)` — new handler in
  `packages/game-engine/src/rules/mastermindHandlers.ts`
  - Increments `masterStrikeCount` counter (MVP tracking)
  - MVP: counter + message only; wound card movement deferred
- `ruleRuntime.impl.ts` updated:
  - WP-009B stub handlers replaced with real handlers
  - Scheme hook trigger: `onTurnStart` -> `onSchemeTwistRevealed`
  - Mastermind hook trigger: `onTurnEnd` -> `onMastermindStrikeRevealed`
  - `DEFAULT_IMPLEMENTATION_MAP` now maps to real handler functions
- Integration test assertions updated (01.5 value-only updates)
- 10 new tests (6 scheme + 4 mastermind), 291 total passing

**What's true now:**
- Scheme twists produce real gameplay effects via the rule hook pipeline
- Scheme-loss condition is functional (counter reaches threshold -> loss)
- Mastermind strikes track via counter (MVP — wound effects deferred)
- Same `executeRuleHooks` -> `applyRuleEffects` pipeline as hero effects
- Handlers in `ImplementationMap` (never stored in G)
- WP-009A contracts unmodified
- WP-014 reveal pipeline unmodified
- WP-025 is unblocked

**What's next:**
- Future WP to add `'gainWound'` effect type for actual wound card movement
- Future WP to parameterize per-scheme twist thresholds from registry data
- WP-025 — next in sequence

---

### WP-023 — Conditional Hero Effects (Teams, Colors, Keywords) (2026-04-13)

**What changed:**
- Hero ability conditions now evaluate instead of being skipped
- `evaluateCondition(G, playerID, condition)` — new pure function in
  `packages/game-engine/src/hero/heroConditions.evaluate.ts`
- `evaluateAllConditions(G, playerID, conditions)` — AND logic over all
  conditions (returns `true` only when ALL pass)
- 4 MVP condition types implemented:
  - `requiresKeyword` — fully functional, checks `G.heroAbilityHooks` for
    keyword matches on played cards
  - `playedThisTurn` — fully functional, checks `inPlay.length` threshold
  - `heroClassMatch` — placeholder (returns `false`), awaits class data in G
  - `requiresTeam` — placeholder (returns `false`), awaits team data in G
- Integration: `heroEffects.execute.ts` calls `evaluateAllConditions`
  instead of skipping all conditional hooks
- Conditions never mutate G (pure predicates, deep equality test enforces)
- Unsupported condition types safely return `false`
- 15 new tests (10 unit + 5 integration), 281 total passing

**What's true now:**
- Conditional hero effects evaluate deterministically
- `requiresKeyword` synergies work (played card keyword matching)
- `playedThisTurn` thresholds work (card count gating)
- `heroClassMatch` and `requiresTeam` are safe no-ops pending data resolution
- Condition type string is `heroClassMatch` (not `requiresColor`)
- WP-021 contracts unmodified
- WP-024 is unblocked for scheme/mastermind ability execution

**What's next:**
- Follow-up WP needed to resolve team/class data into G (enables
  `heroClassMatch` and `requiresTeam` evaluators)
- WP-024 — Scheme & Mastermind Ability Execution

---

### WP-022 — Execute Hero Keywords (Minimal MVP) (2026-04-13)

**What changed:**
- Hero ability effects now execute when a hero card is played
- `executeHeroEffects(G, ctx, playerID, cardId)` — new function in
  `packages/game-engine/src/hero/heroEffects.execute.ts`
- 4 MVP keywords execute: `'draw'`, `'attack'`, `'recruit'`, `'ko'`
- `'draw'` — draws N cards from player deck to hand (with reshuffle)
- `'attack'` — adds N to `G.turnEconomy.attack` via `addResources`
- `'recruit'` — adds N to `G.turnEconomy.recruit` via `addResources`
- `'ko'` — removes the played card from inPlay, appends to `G.ko`
- Conditional effects safely skipped (no mutation, no error)
- Unsupported keywords (`'rescue'`, `'wound'`, `'reveal'`, `'conditional'`)
  safely ignored
- Invalid magnitude (undefined, NaN, negative, float) skipped
- `HeroEffectResult` internal type for dev/test assertions (not stored in G)
- Integration: `playCard` in `coreMoves.impl.ts` calls `executeHeroEffects`
  after base stat economy
- 11 new tests, 266 total passing

**What's true now:**
- Hero ability hooks execute deterministically for 4 MVP keywords
- Hooks fire in registration order; effects fire in descriptor array order
- Hero hook economy is additive to WP-018 base card stats
- `'ko'` targets the played card itself (MVP: no player choice)
- `ctx: unknown` — no boardgame.io import in execution files
- `ShuffleProvider` from engine-internal `setup/shuffle.js` for draw reshuffle
- WP-021 contract files unmodified
- WP-023 is unblocked for conditional effect evaluation

**What's next:**
- WP-023 — Conditional Hero Effects (Teams, Colors, Keywords)

---

### WP-021 — Hero Card Text & Keywords (Hooks Only) (2026-04-13)

**What changed:**
- Hero ability hooks added as data-only contracts to the game engine
- `HeroAbilityHook` interface — data-only, JSON-serializable, stored in
  `G.heroAbilityHooks`
- `HeroKeyword` closed union + `HERO_KEYWORDS` canonical array (8 keywords:
  draw, attack, recruit, ko, rescue, wound, reveal, conditional)
- `HeroAbilityTiming` closed union + `HERO_ABILITY_TIMINGS` canonical array
  (5 timings: onPlay, onFight, onRecruit, onKO, onReveal)
- `HeroCondition` and `HeroEffectDescriptor` declarative descriptors
- `buildHeroAbilityHooks` setup-time builder using `CardRegistryReader`
- Query/filter utilities: `filterHooksByTiming`, `filterHooksByKeyword`,
  `getHooksForCard`
- 8 tests including drift detection for both keywords and timings,
  determinism test

**What's true now:**
- `G.heroAbilityHooks` is populated at setup with parsed hero ability data
- Keywords and timings are normalized with drift-detection tests
- Timing defaults to `'onPlay'` — no NL inference
- Hero hooks are observation-only; no effects execute in WP-021
- The packet is inert by design — no game state changes from hero hooks
- WP-022 is unblocked for execution

**What's next:**
- WP-022 — Execute Hero Keywords (Minimal MVP) — Phase 5

---

### WP-020 — VP Scoring & Win Summary (Minimal MVP) (2026-04-12)

**What changed:**
- `packages/game-engine/src/scoring/scoring.types.ts` — **new** —
  `FinalScoreSummary`, `PlayerScoreBreakdown`, VP constants
  (VP_VILLAIN=1, VP_HENCHMAN=1, VP_BYSTANDER=1, VP_TACTIC=5, VP_WOUND=-1)
- `packages/game-engine/src/scoring/scoring.logic.ts` — **new** —
  `computeFinalScores` pure function (read-only on G, deterministic)
- `packages/game-engine/src/types.ts` — **modified** — re-export scoring
  types and VP constants
- `packages/game-engine/src/index.ts` — **modified** — export scoring API
- `packages/game-engine/src/scoring/scoring.logic.test.ts` — **new** —
  8 scoring tests
- `game.ts` NOT modified (scoring is a library export, not wired into
  engine lifecycle)

**What's true now:**
- `computeFinalScores(G)` returns per-player VP breakdowns and winner
- Villains, henchmen classified via `G.villainDeckCardTypes`
- Bystanders use dual check: `G.villainDeckCardTypes` + `BYSTANDER_EXT_ID`
- Wounds identified by `WOUND_EXT_ID = 'pile-wound'`
- Tactic VP awarded to all players (WP-019 lacks per-player attribution)
- Winner = highest total VP; null on tie; no tiebreaker in MVP
- KO pile cards contribute 0 VP
- Scoring is pure — does not mutate G, does not trigger endgame
- Full MVP game loop complete: setup -> play cards -> fight villains ->
  recruit heroes -> fight mastermind -> endgame -> score
- Phase 4 (Core Combat Loop) is done
- 247 tests passing, 0 failures

**What's next:**
- WP-021 — Hero Card Text & Keywords (Hooks Only) — Phase 5

---

### WP-019 — Mastermind Fight & Tactics (Minimal MVP) (2026-04-12)

**What changed:**
- `packages/game-engine/src/mastermind/mastermind.types.ts` — **new** —
  `MastermindState` interface
- `packages/game-engine/src/mastermind/mastermind.setup.ts` — **new** —
  `buildMastermindState` (resolves mastermind from registry, adds base card
  fightCost to G.cardStats, shuffles tactics deck)
- `packages/game-engine/src/mastermind/mastermind.logic.ts` — **new** —
  `defeatTopTactic`, `areAllTacticsDefeated` pure helpers
- `packages/game-engine/src/moves/fightMastermind.ts` — **new** — boss fight
  move with internal stage gating, attack validation, tactic defeat, and
  victory counter
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  calls `buildMastermindState` after `buildCardStats`; cardStats extracted
  to local variable for ordering
- `packages/game-engine/src/game.ts` — **modified** — `fightMastermind`
  registered in play phase moves
- `packages/game-engine/src/types.ts` — **modified** — added
  `mastermind: MastermindState` to `LegendaryGameState`
- `packages/game-engine/src/index.ts` — **modified** — exports for mastermind
  types and helpers
- 3 new test files: setup (5), logic (5), move (6) = 16 new tests
- 6 existing test files updated (01.5 wiring: added `mastermind` to mock
  game state objects + move list assertion)

**What's true now:**
- `G.mastermind` exists with id, baseCardId, tacticsDeck, tacticsDefeated
- Tactics deck is shuffled deterministically at setup from registry data
- `fightMastermind` validates attack against `G.cardStats[baseCardId].fightCost`
- Each successful fight defeats exactly 1 tactic (MVP) and spends attack
- When all tactics defeated: `G.counters[MASTERMIND_DEFEATED] = 1` triggers
  the endgame evaluator (WP-010)
- Full MVP combat loop is functional: play cards -> fight villains ->
  fight mastermind -> win
- `buildMastermindState` is sole source for mastermind in G.cardStats
- Internal stage gating (same pattern as fightVillain/recruitHero)
- 239 tests passing, 0 failures

**What's next:**
- WP-020 — VP Scoring & Win Summary

---

### WP-018 — Attack & Recruit Point Economy (Minimal MVP) (2026-04-12)

**What changed:**
- `packages/game-engine/src/economy/economy.types.ts` — **new** — `TurnEconomy`
  and `CardStatEntry` interfaces
- `packages/game-engine/src/economy/economy.logic.ts` — **new** —
  `parseCardStatValue`, `buildCardStats`, `CardStatsRegistryReader`, and economy
  helpers (`getAvailableAttack`, `getAvailableRecruit`, `addResources`,
  `spendAttack`, `spendRecruit`, `resetTurnEconomy`)
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **modified** — `playCard`
  adds hero attack/recruit resources to economy after placing card in inPlay
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — attack
  validation in step 1 (insufficient = return void) and spend in step 3
- `packages/game-engine/src/moves/recruitHero.ts` — **modified** — recruit
  validation in step 1 (insufficient = return void) and spend in step 3
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  calls `buildCardStats` and initializes `turnEconomy`
- `packages/game-engine/src/game.ts` — **modified** — economy reset wired into
  `play.turn.onBegin` before rule hooks
- `packages/game-engine/src/types.ts` — **modified** — added `turnEconomy` and
  `cardStats` to `LegendaryGameState`
- `packages/game-engine/src/index.ts` — **modified** — exports for economy types
  and helpers
- 2 new test files: economy unit (8), economy integration (9) = 17 new tests
- 4 existing test files updated (01.5 wiring: added `turnEconomy`/`cardStats`
  to mock game state objects)

**What's true now:**
- `G.turnEconomy` tracks attack/recruit points accumulated and spent per turn
- `G.cardStats` stores parsed card stat values built at setup time from registry
- Playing hero cards adds base attack and recruit values to the economy
- `fightVillain` requires sufficient unspent attack points (fails silently)
- `recruitHero` requires sufficient unspent recruit points (fails silently)
- Economy resets to zero at the start of each player turn
- Card stat parser handles `"2+"`, `"2*"`, integers, null, and garbage input
- Villains/henchmen have `fightCost` from `vAttack`; heroes have `fightCost = 0`
- Starting cards (agents/troopers) contribute 0/0 (fail-closed MVP — D-1806)
- 223 tests passing, 0 failures

**What's next:**
- WP-019 — Mastermind Fight & Tactics

---

### WP-017 — KO, Wounds & Bystander Capture (Minimal MVP) (2026-04-12)

**What changed:**
- `packages/game-engine/src/board/ko.logic.ts` — **new** — `koCard`
  destination-only append helper for KO pile
- `packages/game-engine/src/board/wounds.logic.ts` — **new** — `gainWound`
  helper moves top wound from supply to player discard
- `packages/game-engine/src/board/bystanders.logic.ts` — **new** —
  `attachBystanderToVillain`, `awardAttachedBystanders`,
  `resolveEscapedBystanders` pure helpers for bystander lifecycle
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified**
  — on villain/henchman City entry: attach 1 bystander from supply;
  on escape: gain wound for current player + resolve attached bystanders
  (return to supply)
- `packages/game-engine/src/moves/fightVillain.ts` — **modified** — on
  villain defeat: award attached bystanders to player's victory zone
- `packages/game-engine/src/types.ts` — **modified** — added `ko: CardExtId[]`
  and `attachedBystanders: Record<CardExtId, CardExtId[]>` to
  `LegendaryGameState`
- `packages/game-engine/src/index.ts` — **modified** — exports for new helpers
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified**
  (01.5 wiring) — initialize `ko: []` and `attachedBystanders: {}`
- 4 new test files: ko (3), wounds (4), bystanders (8), integration (7) = 22
- 7 existing test files updated (01.5 wiring: added `ko`/`attachedBystanders`
  to mock game state objects)

**What's true now:**
- `G.ko` exists as a KO pile for cards removed from the game
- `G.attachedBystanders` tracks bystanders attached to villains in the City
- Villains/henchmen entering City get 1 bystander attached (MVP simplified)
- Fighting a villain awards attached bystanders to player's victory zone
- Villain escape causes current player to gain 1 wound
- Escaped villain's attached bystanders return to supply pile (no leak)
- All zone operations are pure helpers with no boardgame.io imports
- Supply pile convention: `pile[0]` is top-of-pile (locked)
- 206 tests passing, 0 failures

**What's next:**
- WP-018 — Attack & Recruit Economy (resource gating for fight/recruit)

---

### WP-016 — Fight First, Then Recruit (Minimal MVP) (2026-04-11)

**What changed:**
- `packages/game-engine/src/moves/fightVillain.ts` — **new** —
  `fightVillain` move: removes villain from City space, places in player's
  victory pile. Three-step validation contract. Internal stage gating
  (`main` only). MVP: no attack point check (WP-018 adds economy).
- `packages/game-engine/src/moves/recruitHero.ts` — **new** —
  `recruitHero` move: removes hero from HQ slot, places in player's discard
  pile. Three-step validation contract. Internal stage gating (`main` only).
  MVP: no recruit point check (WP-018 adds economy).
- `packages/game-engine/src/moves/fightVillain.test.ts` — **new** — 7 tests
- `packages/game-engine/src/moves/recruitHero.test.ts` — **new** — 7 tests
- `packages/game-engine/src/game.ts` — **modified** — registered
  `fightVillain` and `recruitHero` in play phase moves
- `packages/game-engine/src/index.ts` — **modified** — exports for new moves
- `packages/game-engine/src/game.test.ts` — **modified** (01.5 wiring) —
  move-count assertion updated (5 -> 7)

**What's true now:**
- Players can fight villains/henchmen in the City and recruit heroes from HQ
- Both moves gate to `main` stage (non-core internal gating pattern)
- Fight-first is a documented policy preference (D-1602), not engine-enforced
- MVP: no resource checking — any target can be fought/recruited without
  spending points. WP-018 adds the economy.
- Recruited heroes go to discard (D-1604), matching tabletop rules
- 184 tests passing, 0 failures

**What's next:**
- WP-017 — KO, Wounds & Bystander Capture
- WP-018 — Attack & Recruit Economy (resource gating for fight/recruit)

---

### WP-015 — City & HQ Zones (Villain Movement + Escapes) (2026-04-11)

**What changed:**
- `packages/game-engine/src/board/city.types.ts` — **new** — `CityZone`,
  `HqZone`, `CitySpace`, `HqSlot` (fixed 5-tuples)
- `packages/game-engine/src/board/city.logic.ts` — **new** —
  `pushVillainIntoCity`, `initializeCity`, `initializeHq` (pure helpers)
- `packages/game-engine/src/board/city.validate.ts` — **new** —
  `validateCityShape` runtime safety check
- `packages/game-engine/src/board/city.logic.test.ts` — **new** — 9 city
  push unit tests (push, shift, escape, identity, tuple invariant, JSON)
- `packages/game-engine/src/villainDeck/villainDeck.city.integration.test.ts`
  — **new** — 8 integration tests (routing, escape counter, HQ immutability,
  malformed city safety)
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **modified**
  — City routing for villain/henchman (push into City space 0), conditional
  discard for bystander/scheme-twist/mastermind-strike, escape counter via
  `ENDGAME_CONDITIONS.ESCAPED_VILLAINS`
- `packages/game-engine/src/types.ts` — **modified** — added `city: CityZone`
  and `hq: HqZone` to `LegendaryGameState`
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  initialize `G.city` and `G.hq` from `initializeCity()` and `initializeHq()`
- `packages/game-engine/src/index.ts` — **modified** — exports for city types,
  logic, and validation
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **modified**
  (01.5 wiring) — added `city`/`hq` to mock G; updated villain routing
  assertion from discard to City
- `packages/game-engine/src/moves/coreMoves.integration.test.ts` — **modified**
  (01.5 wiring) — added missing fields to mock G for type completeness
- `packages/game-engine/src/persistence/snapshot.create.test.ts` — **modified**
  (01.5 wiring) — added missing fields to mock G for type completeness

**What exists now:**
- City zone: 5 ordered spaces, each `CardExtId | null`
- HQ zone: 5 ordered slots, each `CardExtId | null` (empty — WP-016 populates)
- Revealed villains and henchmen enter City space 0 via push logic
- Existing cards shift rightward; space 4 card escapes
- Escapes increment `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]`
- Scheme-twists and mastermind-strikes trigger only (existing WP-014 behavior)
- Bystanders go to discard + message (MVP; WP-017 adds capture)
- City placement occurs BEFORE trigger emission (contractual ordering)
- All 169 tests passing (152 existing + 17 new)

**Known gaps (expected at this stage):**
- HQ is empty — WP-016 adds recruit slot population
- No fight/attack/recruit mechanics — WP-016
- No bystander capture — WP-017
- No KO pile — WP-017

---

### WP-014B — Villain Deck Composition Rules & Registry Integration (2026-04-11)

**What changed:**
- `packages/game-engine/src/villainDeck/villainDeck.setup.ts` — **new** —
  `buildVillainDeck`, `VillainDeckRegistryReader`, count constants,
  local structural types for registry traversal
- `packages/game-engine/src/villainDeck/villainDeck.setup.test.ts` — **new** —
  10 tests (composition, counts, ext_id formats, serialization)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  replaced empty defaults with real `buildVillainDeck` call; renamed
  `_registry` to `registry`
- `packages/game-engine/src/index.ts` — **modified** — exports for
  `buildVillainDeck` and `VillainDeckRegistryReader`

**What exists now:**
- Villain deck fully populated from registry at setup time
- 5 card types represented: villain (FlatCard keys), henchman (virtual
  `henchman-{slug}-{index}`), scheme-twist (virtual
  `scheme-twist-{slug}-{index}`), bystander (virtual
  `bystander-villain-deck-{index}`), mastermind-strike (FlatCard keys,
  `tactic !== true`)
- Count rules: 10 henchmen/group, 8 scheme twists, 1 bystander/player,
  mastermind strikes from data
- Pre-shuffle lexical sort ensures deterministic deck order
- `VillainDeckRegistryReader` structural interface (no registry imports)
- Runtime type guard gracefully handles narrow test mocks (empty deck)
- D-1412 amended with bystander ext_id format
- All 152 tests passing (142 existing + 10 new)

**Known gaps (expected at this stage):**
- City routing not yet implemented — WP-015 will change villain/henchman
  routing from discard to City
- No hero deck (HQ) construction — future WP

---

### WP-014A — Villain Reveal & Trigger Pipeline (2026-04-11)

**What changed:**
- `packages/game-engine/src/villainDeck/villainDeck.types.ts` — **new** —
  `RevealedCardType` (5 canonical values), `REVEALED_CARD_TYPES` canonical
  array, `VillainDeckState` interface
- `packages/game-engine/src/villainDeck/villainDeck.reveal.ts` — **new** —
  `revealVillainCard` move (draw, classify, trigger, apply effects, discard)
- `packages/game-engine/src/villainDeck/villainDeck.types.test.ts` — **new** —
  2 tests (drift-detection + serialization)
- `packages/game-engine/src/villainDeck/villainDeck.reveal.test.ts` — **new** —
  10 tests (reveal pipeline with mock deck fixtures)
- `packages/game-engine/src/types.ts` — **modified** — added `villainDeck`
  and `villainDeckCardTypes` to `LegendaryGameState`
- `packages/game-engine/src/game.ts` — **modified** — added
  `revealVillainCard` to top-level moves
- `packages/game-engine/src/index.ts` — **modified** — exports for new types
  and move
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified**
  (01.5 wiring) — empty-default villain deck fields
- `packages/game-engine/src/game.test.ts` — **modified** (01.5 wiring) —
  move count assertion 4 -> 5

**What exists now:**
- Villain deck type contracts: `RevealedCardType`, `VillainDeckState`,
  `REVEALED_CARD_TYPES` canonical array with drift-detection test
- Reveal pipeline: `revealVillainCard` draws top card, looks up classification
  in `G.villainDeckCardTypes`, emits `onCardRevealed` (always),
  `onSchemeTwistRevealed` (scheme twists), `onMastermindStrikeRevealed`
  (mastermind strikes), applies effects via the WP-009B pipeline, routes to
  discard
- Fail-closed: missing card type prevents removal and triggers
- Reshuffle: empty deck + non-empty discard reshuffles before draw
- Empty defaults in `buildInitialGameState` (WP-014B populates from registry)
- All 142 tests passing (130 existing + 12 new)

**Known gaps (expected at this stage):**
- No `buildVillainDeck` — deferred to WP-014B pending registry schema
  decisions for henchman instancing, scheme twist identifiers, and composition
  counts (DECISIONS.md D-1410 through D-1413 define the conventions)
- Discard routing is temporary — WP-015 will route villain/henchman to City
- No City, HQ, or KO zone logic — WP-015/017

---

### Phase 3 Exit Gate Closed (2026-04-11)

**What changed:**
- `docs/ai/REFERENCE/03A-PHASE-3-MULTIPLAYER-READINESS.md` — **modified** —
  all six refinements applied (authority consequence clause, invariant baseline
  rule, concurrency negative rule, replay acceptance test, framework lock-in
  prohibition, silent recovery prohibition); WP-013 marked complete; X-3 and
  X-5 updated from PENDING/PARTIAL to PASS; gate decision flipped to
  "Phase 4 approved"
- `docs/ai/DECISIONS.md` — added D-1320 (Phase 3 Exit Approved)

**What exists now:**
- Phase 3 (MVP Multiplayer) is formally complete. All five exit criteria pass.
- Phase 4 (Core Gameplay Loop) is approved to proceed.
- The gate document is now future-proof with contractual language that
  prohibits regression, wall-clock tie-breaking, framework lock-in, and
  silent recovery.

---

### WP-013 — Persistence Boundaries & Snapshots (2026-04-11)

**What changed:**
- `packages/game-engine/src/persistence/persistence.types.ts` — **new** —
  `PERSISTENCE_CLASSES` (3 canonical data class constants), `MatchSnapshot`,
  `MatchSnapshotPlayer`, `MatchSnapshotOutcome`, `PersistableMatchConfig`
- `packages/game-engine/src/persistence/snapshot.create.ts` — **new** —
  `createSnapshot` pure function returning `Readonly<MatchSnapshot>` via
  `Object.freeze()`; `SnapshotContext` minimal interface
- `packages/game-engine/src/persistence/snapshot.validate.ts` — **new** —
  `validateSnapshotShape` returning structured `MoveError[]` results (never throws)
- `packages/game-engine/src/persistence/snapshot.create.test.ts` — **new** —
  7 tests: zone counts, JSON serialization, excluded keys, determinism,
  valid/invalid validation
- `packages/game-engine/src/types.ts` — **modified** — re-exports persistence
  types (`MatchSnapshot`, `PersistableMatchConfig`, `PERSISTENCE_CLASSES`)
- `packages/game-engine/src/index.ts` — **modified** — exports persistence
  public API (`createSnapshot`, `validateSnapshotShape`, types)
- `docs/ai/DECISIONS.md` — added D-1310 through D-1313

**What exists now:**
- `@legendary-arena/game-engine` exports `PERSISTENCE_CLASSES` with exactly
  3 canonical class names: `runtime`, `configuration`, `snapshot`
- `MatchSnapshot` has exactly 9 top-level keys (matchId, snapshotAt, turn,
  phase, activePlayer, players, counters, messages, outcome?) with zone
  **counts** only — no `CardExtId[]` arrays
- `PersistableMatchConfig` has 4 fields (matchId, setupConfig, playerNames,
  createdAt) — no G, no ctx
- `createSnapshot` is a pure function that derives outcome via
  `evaluateEndgame(G)`, never throws, returns `Object.freeze()` result
- `validateSnapshotShape` imports `MoveError` from `coreMoves.types.ts`,
  never throws, returns structured results
- `docs/ai/ARCHITECTURE.md` Section 3 already contained the three-class
  data model and field-to-class mapping table — no update was needed
- 130 tests passing (123 existing + 7 new), 0 failing
- No changes to `game.ts`, no boardgame.io imports in persistence files,
  no `require()`, ESM only

---

### WP-012 — Match Listing, Join & Reconnect (Minimal MVP) (2026-04-11)

**What changed:**
- `apps/server/scripts/list-matches.mjs` — **new** — CLI script to list
  available matches from the boardgame.io lobby API using built-in `fetch`
- `apps/server/scripts/join-match.mjs` — **new** — CLI script to join a
  match by ID using built-in `fetch`; prints `{ matchID, playerID, credentials }`
  to stdout
- `apps/server/scripts/list-matches.test.ts` — **new** — 3 tests covering
  `--server` flag override, network failure error messages, and exit code
- `apps/server/scripts/join-match.test.ts` — **new** — 3 tests covering
  missing `--match` flag, missing `--name` flag, and HTTP 409 error handling
- `apps/server/package.json` — **modified** — added `test` script
  (`node --import tsx --test scripts/**/*.test.ts`) and `tsx` devDependency
- `docs/ai/DECISIONS.md` — added D-1241, D-1242, D-1243

**What exists now:**
- The minimum viable multiplayer loop is now complete:
  **create → list → join → ready → play**
- `list-matches.mjs` fetches `GET /games/legendary-arena` and prints a JSON
  summary of available matches (matchID, player count, setupData presence,
  gameover status). Accepts `--server <url>` flag (default `http://localhost:8000`).
- `join-match.mjs` POSTs to `/games/legendary-arena/<matchID>/join` with
  `{ playerName }` body. Prints `{ matchID, playerID, credentials }` to stdout.
  Credentials are never stored to disk. Accepts `--match`, `--name`, and
  `--server` flags.
- Both scripts use Node v22 built-in `fetch` — no axios, no node-fetch.
- Both scripts exit 1 on failure with full-sentence error messages to stderr.
- Both scripts export testable functions for unit testing without a live server.
- Server package now has a working `test` script — 6 tests pass, 0 fail.
- No game engine files were modified. No `apps/server/src/` files were modified.
- `create-match.mjs` was not modified.

---

### WP-011 — Match Creation & Lobby Flow (Minimal MVP) (2026-04-11)

**What changed:**
- `packages/game-engine/src/lobby/lobby.types.ts` — **new** — defines
  `LobbyState` (3 fields: `requiredPlayers`, `ready`, `started`),
  `SetPlayerReadyArgs`, re-exports `MoveResult`/`MoveError`
- `packages/game-engine/src/lobby/lobby.validate.ts` — **new** —
  `validateSetPlayerReadyArgs` and `validateCanStartMatch` (both return
  `MoveResult`, never throw)
- `packages/game-engine/src/lobby/lobby.moves.ts` — **new** —
  `setPlayerReady` and `startMatchIfReady` (boardgame.io move functions
  wired into the `lobby` phase)
- `packages/game-engine/src/lobby/lobby.moves.test.ts` — **new** — 6 tests
  covering readiness toggling, invalid args rejection, match start gating,
  observability ordering, and JSON serializability
- `packages/game-engine/src/types.ts` — **modified** — added
  `lobby: LobbyState` to `LegendaryGameState`
- `packages/game-engine/src/game.ts` — **modified** — wired `setPlayerReady`
  and `startMatchIfReady` into the `lobby` phase `moves` block
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified**
  (01.5 wiring) — added `lobby` field to return object
- `packages/game-engine/src/index.ts` — **modified** — exports `LobbyState`,
  `SetPlayerReadyArgs`, `validateSetPlayerReadyArgs`, `validateCanStartMatch`
- `apps/server/scripts/create-match.mjs` — **new** — CLI match creation
  script using Node v22 built-in `fetch`
- `docs/ai/DECISIONS.md` — added D-1238, D-1239, D-1240

**What exists now:**
- A match can now be created and players can join, ready up, and transition
  into gameplay via the lobby phase.
- `G.lobby` stores lobby state: `requiredPlayers` (from `ctx.numPlayers`),
  `ready` (Record keyed by player ID), and `started` (boolean flag).
- `setPlayerReady` allows each player to toggle their readiness status.
  `ctx.currentPlayer` is used as the ready-map key.
- `startMatchIfReady` validates all players are ready, sets
  `G.lobby.started = true` (observability flag), then calls
  `ctx.events.setPhase('setup')`. The flag-before-transition ordering is
  non-negotiable for UI observability.
- Lobby moves are wired inside the `lobby` phase `moves` block (not
  top-level) — boardgame.io enforces phase isolation.
- `create-match.mjs` enables CLI match creation against the running server.
- No new error types — `MoveResult`/`MoveError` reused from WP-008A.
- No `boardgame.io` imports in lobby type or validate files.
- 120 tests pass (114 prior + 6 new), 0 fail
- Build exits 0

---

### WP-010 — Victory & Loss Conditions (Minimal MVP) (2026-04-11)

**What changed:**
- `packages/game-engine/src/endgame/endgame.types.ts` — **new** — defines
  `EndgameOutcome` (`'heroes-win' | 'scheme-wins'`), `EndgameResult` interface,
  `ENDGAME_CONDITIONS` (3 canonical counter key constants: `escapedVillains`,
  `schemeLoss`, `mastermindDefeated`), `ESCAPE_LIMIT = 8`
- `packages/game-engine/src/endgame/endgame.evaluate.ts` — **new** — pure
  `evaluateEndgame(G)` function that checks 3 MVP conditions in fixed priority
  order using `if/else if/else` (loss before victory)
- `packages/game-engine/src/endgame/endgame.evaluate.test.ts` — **new** —
  6 tests: null when no conditions, scheme-wins on escape/schemeLoss,
  heroes-win on mastermindDefeated, loss-before-victory priority, JSON
  serializability
- `packages/game-engine/src/game.ts` — **modified** — added `endIf` to `play`
  phase delegating entirely to `evaluateEndgame(G) ?? undefined`
- `packages/game-engine/src/types.ts` — **modified** — re-exports
  `EndgameResult`, `EndgameOutcome`, `ENDGAME_CONDITIONS`
- `packages/game-engine/src/index.ts` — **modified** — exports
  `evaluateEndgame`, `EndgameResult`, `EndgameOutcome`, `ENDGAME_CONDITIONS`,
  `ESCAPE_LIMIT`
- `docs/ai/DECISIONS.md` — added D-1235, D-1236, D-1237

**What exists now:**
- A match can now conclusively end. Three MVP conditions are evaluated on every
  state change in the `play` phase via boardgame.io's `endIf`:
  1. **Loss — Too Many Escapes:** `escapedVillains >= 8` → `scheme-wins`
  2. **Loss — Scheme Triggered:** `schemeLoss >= 1` → `scheme-wins`
  3. **Victory — Mastermind Defeated:** `mastermindDefeated >= 1` → `heroes-win`
- To trigger in a test: set `G.counters['escapedVillains'] = 8` (or
  `'schemeLoss' = 1`, `'mastermindDefeated' = 1`) before calling
  `evaluateEndgame(G)`. The function returns `EndgameResult | null`.
- If no conditions are met (or counters are absent), `evaluateEndgame` returns
  `null` and the game continues.
- Loss conditions are always checked before victory — simultaneous triggers
  resolve as `scheme-wins`.
- `ENDGAME_CONDITIONS` constants are the canonical counter key names — all future
  packets must import and use these constants, never string literals.
- No new fields added to `LegendaryGameState`. No `boardgame.io` imports in
  endgame files. `evaluateEndgame` is pure (no side effects, no throw).
- 114 tests pass (108 prior + 6 new), 0 fail
- Build exits 0

---

### WP-009B — Scheme & Mastermind Rule Execution Minimal MVP (2026-04-11)

**What changed:**
- `packages/game-engine/src/rules/ruleRuntime.execute.ts` — **new** — defines
  `ImplementationMap` type (handler functions keyed by hook `id`, no boardgame.io
  import), `executeRuleHooks` (reads `G`, calls `getHooksForTrigger`, accumulates
  `RuleEffect[]`, returns without modifying `G`)
- `packages/game-engine/src/rules/ruleRuntime.effects.ts` — **new** — defines
  `applyRuleEffects` (applies effects using `for...of`: `queueMessage` pushes to
  `G.messages`, `modifyCounter` updates `G.counters`, `drawCards` draws using
  zoneOps helpers, `discardHand` uses `moveAllCards`, unknown types push warning
  — never throws)
- `packages/game-engine/src/rules/ruleRuntime.impl.ts` — **new** — default stub
  implementations: `defaultSchemeImplementation` (onTurnStart → "Scheme: turn
  started."), `defaultMastermindImplementation` (onTurnEnd → "Mastermind: turn
  ended."), `DEFAULT_IMPLEMENTATION_MAP`, `buildDefaultHookDefinitions`
- `packages/game-engine/src/rules/ruleRuntime.ordering.test.ts` — **new** —
  3 ordering tests (priority ordering, id tiebreak, missing handler graceful skip)
- `packages/game-engine/src/rules/ruleRuntime.integration.test.ts` — **new** —
  6 integration tests (onTurnStart message, onTurnEnd message, JSON round-trip,
  executeRuleHooks read-only, modifyCounter, unknown effect warning)
- `packages/game-engine/src/types.ts` — **modified** — added `messages: string[]`,
  `counters: Record<string, number>`, `hookRegistry: HookDefinition[]` to
  `LegendaryGameState`
- `packages/game-engine/src/game.ts` — **modified** — wired `onTurnStart` trigger
  in `play` phase `turn.onBegin`, added `turn.onEnd` with `onTurnEnd` trigger;
  both use `executeRuleHooks` → `applyRuleEffects` pipeline with
  `DEFAULT_IMPLEMENTATION_MAP`
- `packages/game-engine/src/index.ts` — **modified** — exports `ImplementationMap`,
  `executeRuleHooks`, `applyRuleEffects`, `buildDefaultHookDefinitions`
- `docs/ai/DECISIONS.md` — added D-1232 (ImplementationMap pattern), D-1233
  (two-step execute/apply), D-1234 (graceful unknown effect handling)

**Runtime Wiring Allowance (01.5):** Exercised for
`packages/game-engine/src/setup/buildInitialGameState.ts` — added `messages: []`,
`counters: {}`, `hookRegistry: buildDefaultHookDefinitions(config)` to the return
object. Import of `buildDefaultHookDefinitions` added. No new behavior introduced.

**What exists now:**
- The complete two-step rule execution pipeline is operational:
  `executeRuleHooks` → `applyRuleEffects`
- `LegendaryGameState` includes `messages`, `counters`, and `hookRegistry`
- On each turn start in the play phase, the default scheme hook fires and
  `G.messages` receives `'Scheme: turn started.'`
- On each turn end in the play phase, the default mastermind hook fires and
  `G.messages` receives `'Mastermind: turn ended.'`
- `ImplementationMap` handler functions live outside `G` — never in state
- Unknown effect types degrade gracefully (warning in `G.messages`, no throw)
- No `.reduce()` in effect application; no `.sort()` in `executeRuleHooks`
- No `boardgame.io` imports in any `src/rules/` file
- WP-009A contract files (`ruleHooks.types.ts`, `ruleHooks.validate.ts`,
  `ruleHooks.registry.ts`) untouched
- 108 tests pass (99 prior + 9 new), 0 fail
- Build exits 0

---

### WP-009A — Scheme & Mastermind Rule Hooks Contracts (2026-04-11)

**What changed:**
- `packages/game-engine/src/rules/ruleHooks.types.ts` — **new** — defines
  `RuleTriggerName` (5-value union), `RULE_TRIGGER_NAMES` canonical array,
  5 trigger payload interfaces (`OnTurnStartPayload`, `OnTurnEndPayload`,
  `OnCardRevealedPayload`, `OnSchemeTwistRevealedPayload`,
  `OnMastermindStrikeRevealedPayload`), `TriggerPayloadMap`,
  `RuleEffect` (4-variant tagged union), `RULE_EFFECT_TYPES` canonical array,
  `HookDefinition` (data-only, 5 fields), `HookRegistry` type alias
- `packages/game-engine/src/rules/ruleHooks.validate.ts` — **new** — three
  validators (`validateTriggerPayload`, `validateRuleEffect`,
  `validateHookDefinition`); all return `MoveResult`; none throw
- `packages/game-engine/src/rules/ruleHooks.registry.ts` — **new** —
  `createHookRegistry` (validates and stores; throws on invalid),
  `getHooksForTrigger` (returns hooks sorted by priority asc, then id lexically)
- `packages/game-engine/src/rules/ruleHooks.contracts.test.ts` — **new** —
  10 tests including 2 drift-detection tests for `RULE_TRIGGER_NAMES` and
  `RULE_EFFECT_TYPES`
- `packages/game-engine/src/types.ts` — **modified** — re-exports
  `RuleTriggerName`, `RuleEffect`, `HookDefinition`, `HookRegistry`
- `packages/game-engine/src/index.ts` — **modified** — exports all new public
  types, constants, validators, and registry helpers
- `docs/ai/DECISIONS.md` — added D-1229 (HookDefinition is data-only),
  D-1230 (effects are tagged data union), D-1231 (priority-then-id ordering)

**What exists now:**
- `@legendary-arena/game-engine` exports the complete rule hook contract surface:
  trigger names, payload shapes, effect types, hook definitions, validators,
  and registry helpers
- All rule hook types are JSON-serializable (no functions, Maps, Sets, or classes)
- `MoveError` from WP-008A is reused for all validator errors — no new error types
- `CardExtId` used for all card references in trigger payloads
- No `boardgame.io` imports in any `src/rules/` file
- Drift-detection tests prevent silent additions to trigger names or effect types
- 99 tests pass (89 prior + 10 new), 0 fail
- Build exits 0

**Runtime Wiring Allowance:** Not exercised. No files outside the WP allowlist
were modified. Adding re-exports to `types.ts` and `index.ts` did not break
any existing structural assertions.

---

### WP-047 — Code Style Reference Governance Alignment (2026-04-10)

**What changed:**
- `docs/ai/REFERENCE/00.6-code-style.md` — **modified** — replaced header
  blockquote with Authority & Scope section declaring subordination to
  ARCHITECTURE.md and `.claude/rules/code-style.md`; documented three
  complementary code-style artifacts (00.6 descriptive reference,
  `.claude/rules/code-style.md` enforcement, 00.3 §16 quality gate);
  preserved scope statement, enforcement mapping, and change policy
- `docs/ai/DECISIONS.md` — added D-1404 (code style reference is descriptive
  while rules file is enforcement; three-artifact relationship; parallels
  D-1401/D-1402/D-1403)

**What exists now:**
- The code style reference explicitly declares subordination to ARCHITECTURE.md
  and `.claude/rules/code-style.md`
- Style rules never override architectural constraints or layer boundaries
- The three-artifact relationship is documented: 00.6 (descriptive with
  examples), `.claude/rules/code-style.md` (enforcement), 00.3 §16 (quality
  gate)
- All 15 existing rules preserved exactly — no rules added, removed, or weakened
- All code examples preserved
- Enforcement mapping table (18 §16.* entries) preserved
- Change policy preserved
- No `.claude/rules/` files modified
- No scripts modified
- No TypeScript code produced

---

### WP-046 — R2 Validation Governance Alignment (2026-04-10)

**What changed:**
- `docs/ai/REFERENCE/00.5-validation.md` — **modified** — added
  subordination clause in header (document is subordinate to ARCHITECTURE.md
  and `.claude/rules/*.md`); added Foundation Prompt vs Lint Gate distinction;
  added Layer Boundary note identifying registry/data layer with reference to
  `.claude/rules/registry.md`; added WP-042 distinction (reusable preflight
  vs operational deployment checklists); added Execution Gate section with
  stop-on-failure semantics naming Foundation Prompts 01, 02 as blocked on
  error (warnings alone do not block)
- `docs/ai/DECISIONS.md` — added D-1403 (R2 validation gate remains REFERENCE
  document; R2 validation vs Lint Gate distinction; warnings vs errors;
  position in Foundation Prompts sequence)

**What exists now:**
- The R2 validation gate explicitly declares subordination to ARCHITECTURE.md
  and `.claude/rules/*.md`
- The R2 validation vs Lint Gate distinction is documented: R2 validation is a
  Foundation Prompt prerequisite (runs once after 00.4); Lint Gate is a per-WP
  quality gate (runs before each WP)
- Layer Boundary note identifies the document as registry/data-layer validation,
  referencing `.claude/rules/architecture.md` ("Layer Boundary (Authoritative)")
  and `.claude/rules/registry.md` for data shape conventions
- WP-042 distinction documented: 00.5 is a reusable preflight script; WP-042
  documents operational deployment procedures
- Execution Gate section makes stop-on-failure semantics explicit: if any
  error-level check fails, Foundation Prompts 01/02 and all Work Packets
  depending on R2 data are blocked; warnings alone do not block
- No existing validation checks removed or weakened
- No scripts modified

**Known gaps:** None — documentation-only packet.

### WP-045 — Connection Health Check Governance Alignment (2026-04-10)

**What changed:**
- `docs/ai/REFERENCE/00.4-connection-health-check.md` — **modified** — added
  subordination clause in header (document is subordinate to ARCHITECTURE.md
  and `.claude/rules/*.md`); added Foundation Prompt vs Lint Gate distinction;
  added Layer Boundary note identifying server/ops layer with reference to
  `.claude/rules/server.md`; added Execution Gate section with stop-on-failure
  semantics naming Foundation Prompts 00.5, 01, 02 as blocked on failure
- `docs/ai/DECISIONS.md` — added D-1402 (health check remains REFERENCE
  document; health check vs Lint Gate distinction)

**What exists now:**
- The connection health check explicitly declares subordination to
  ARCHITECTURE.md and `.claude/rules/*.md`
- The health check vs Lint Gate distinction is documented: health check is a
  Foundation Prompt prerequisite (runs once); Lint Gate is a per-WP quality
  gate (runs before each WP)
- Layer Boundary note identifies the document as server/ops layer tooling,
  referencing `.claude/rules/architecture.md` ("Layer Boundary (Authoritative)")
  and `.claude/rules/server.md` for script governance
- Execution Gate section makes stop-on-failure semantics explicit: if any
  health check fails, Foundation Prompts 00.5/01/02 and all Work Packets
  are blocked
- No existing health checks removed or weakened
- No scripts modified

**Known gaps:** None — documentation-only packet.

### WP-044 — Prompt Lint Governance Alignment (2026-04-10)

**What changed:**
- `docs/ai/REFERENCE/00.3-prompt-lint-checklist.md` — **modified** — added
  subordination clause in header (checklist is subordinate to ARCHITECTURE.md
  and `.claude/rules/*.md`); added Layer Boundary context check in §4; added
  governance note and Layer Boundary violation check in §8; added code style
  companion note in §16
- `docs/ai/DECISIONS.md` — added D-1401 (checklist remains REFERENCE, not
  merged into rules)

**What exists now:**
- The prompt lint checklist explicitly declares subordination to ARCHITECTURE.md
  and `.claude/rules/*.md`
- §4 requires Layer Boundary reference in Context when packets touch layer
  boundaries or package imports
- §8 opens with authoritative governance note citing ARCHITECTURE.md Section 1
  & 5 and `.claude/rules/architecture.md` "Layer Boundary (Authoritative)"
- §16 opens with companion note citing `00.6-code-style.md` and
  `.claude/rules/code-style.md`
- Checkbox count: 142 (was 139; +2 in §4, +1 in §8)
- No existing lint rules removed or weakened

**Known gaps:** None — documentation-only packet.

### WP-043 — Data Contracts Reference (2026-04-10)

**What changed:**
- `docs/ai/REFERENCE/00.2-data-requirements.md` — **replaced** — legacy 755-line
  document (13 sections including UI concerns) replaced with governed 8-section
  data contracts reference covering card shapes, metadata lookups, image
  conventions, PostgreSQL schema, ability text markup, mastermind-villain
  relationships, match configuration, and authority notes
- `docs/ai/ARCHITECTURE.md` — cross-reference already adequate at line 136;
  no modification needed
- `docs/ai/DECISIONS.md` — added D-1301 (legacy section exclusion rationale)
  and D-1302 (subordination to schema.ts rationale)

**What exists now:**
- `docs/ai/REFERENCE/00.2-data-requirements.md` is the governed data contracts
  reference, subordinate to `schema.ts` and `ARCHITECTURE.md`
- Legacy 00.2 content archived at `docs/archive prompts-legendary-area-game/`
- All card data shapes, metadata lookup shapes, image URL construction rules,
  ability text markup tokens, and PostgreSQL table inventory are documented with
  real JSON examples and field reference tables
- Legacy sections §7 (user deck data), §9 (search/filter), §10 (preferences),
  §11 (app config), §12 (export) excluded as UI-layer concerns (D-1301)

**Known gaps:** None — documentation-only packet.

### Foundation Prompt 00.4 — Connection & Environment Health Check (2026-04-09)

**What exists now:**
- `scripts/check-connections.mjs` — Node.js ESM health check for all external
  services (PostgreSQL, boardgame.io server, Cloudflare R2, Cloudflare Pages,
  GitHub API, rclone R2 bucket)
- `scripts/Check-Env.ps1` — PowerShell tooling check (Node, pnpm, dotenv-cli,
  git, rclone, .env file, npm packages) — runs without Node.js or network
- `.env.example` — definitive 9-variable reference for the whole project
- `pnpm check` and `pnpm check:env` script entries in package.json

**What a developer can do:**
- Run `pwsh scripts/Check-Env.ps1` on a fresh machine to verify all tools
- Run `pnpm check` to verify all external service connections
- Both produce clear pass/fail reports with remediation for every failure

**Known gaps (expected at this stage):**
- No .env file yet (must be created from .env.example)
- boardgame.io and zod not installed (no game-engine package yet)
- PostgreSQL and game server connections will fail until Foundation Prompt 01

### Foundation Prompt 00.5 — R2 Data & Image Validation (2026-04-09)

**What exists now:**
- `scripts/validate-r2.mjs` — Node.js ESM R2 validation with 4 phases:
  Phase 1: registry check (sets.json), Phase 2: per-set metadata validation,
  Phase 3: image spot-checks (HEAD only), Phase 4: cross-set slug deduplication
- `pnpm validate` runs the full validation against live R2 (no .env needed)

**Live validation results (2026-04-09):**
- 40 sets validated, 0 errors, 74 warnings (known data quality issues)
- 6 missing images (URL pattern mismatches on specific sets)
- 43 cross-set duplicate slugs (expected — same heroes appear in multiple sets)

**Known data quality issues (per 00.2 §12):**
- `[object Object]` abilities in msmc, bkpt, msis sets
- Missing `vp` field on 2 masterminds in mgtg set
- 1 hero card missing `cost` and `hc` in anni set

### Foundation Prompt 01 — Render.com Backend Setup (2026-04-09)

**What exists now:**
- `apps/server/` — new pnpm workspace package (`@legendary-arena/server`)
  - `src/rules/loader.mjs` — loads `legendary.rules` and `legendary.rule_docs`
    from PostgreSQL at startup, caches in memory, exports `loadRules()` and
    `getRules()`
  - `src/game/legendary.mjs` — minimal boardgame.io `Game()` definition wired
    to the rules cache. Placeholder move (`playCard`) and endgame condition.
    No real game logic — that belongs in `packages/game-engine/` (WP-002+).
  - `src/server.mjs` — boardgame.io `Server()` with CORS (production SPA +
    localhost:5173), `/health` endpoint on koa router, rules count logging
  - `src/index.mjs` — process entrypoint with SIGTERM graceful shutdown
- `data/schema-server.sql` — rules-engine DDL subset (sets, masterminds,
  villain_groups, schemes, rules, rule_docs) in `legendary.*` namespace.
  All tables use `bigserial` PKs, `IF NOT EXISTS`, indexed.
- `data/seed-server.sql` — seed data with complete Galactus (Core Set)
  example: set, mastermind (strike 5, vp 6), Heralds of Galactus villain
  group, Brotherhood, two schemes. Wrapped in a transaction.
- `render.yaml` — Render infrastructure-as-code provisioning web service
  + managed PostgreSQL (starter plan) in one deploy

**What a developer can do:**
- `pnpm install` detects the new server workspace and installs deps
- `node --env-file=.env apps/server/src/server.mjs` starts the server
- `GET /health` returns `{ "status": "ok" }` for Render and pnpm check
- `psql $DATABASE_URL -f data/schema-server.sql` creates rules-engine tables
- `psql $DATABASE_URL -f data/seed-server.sql` seeds Galactus example
- `render deploy` provisions both services from `render.yaml`

**Known gaps (expected at this stage):**
- No real game logic — `LegendaryGame` is a placeholder (WP-002)
- No card registry loading at startup (WP-003 registry package needed)
- No authentication (separate WP)
- No lobby/match creation CLI scripts (WP-011/012)

### Foundation Prompt 02 — Database Migrations (2026-04-09)

**What exists now:**
- `scripts/migrate.mjs` — zero-dependency ESM migration runner using `pg` only.
  Reads `.sql` files from `data/migrations/`, applies them in filename order,
  tracks applied migrations in `public.schema_migrations`. Resolves `\i`
  directives (psql includes) by inlining referenced files. Strips embedded
  `BEGIN`/`COMMIT` wrappers to avoid nested transaction issues.
- `data/migrations/001_server_schema.sql` — includes `data/schema-server.sql`
  (rules-engine DDL: legendary.source_files, sets, masterminds, villain_groups,
  schemes, rules, rule_docs)
- `data/migrations/002_seed_rules.sql` — includes `data/seed_rules.sql`
  (rules index + rule_docs glossary + source_files audit records)
- `data/migrations/003_game_sessions.sql` — creates `public.game_sessions`
  table for match tracking (match_id, status, player_count, mastermind_ext_id,
  scheme_ext_id). Uses `text` ext_id references, not bigint FKs.
- `render.yaml` buildCommand updated to run migrations before server start
- `pnpm migrate` script entry in root package.json

**What a developer can do:**
- `pnpm migrate` applies pending migrations against local PostgreSQL
- Running twice is safe — idempotent (0 applied, 3 skipped on second run)
- `render deploy` runs migrations automatically in the build step

**Known gaps (expected at this stage):**
- No rollback mechanism (manual recovery via `psql` if needed)
- No real game logic — game_sessions table is created but not yet used
- Card registry not loaded at startup (WP-003 needed)

### WP-004 — Server Bootstrap: Game Engine + Registry Integration (2026-04-09)

**What changed:**
- `apps/server/src/game/legendary.mjs` — replaced placeholder `Game()` definition
  with a thin re-export of `LegendaryGame` from `@legendary-arena/game-engine`
- `apps/server/src/server.mjs` — imports `LegendaryGame` from
  `@legendary-arena/game-engine` and `createRegistryFromLocalFiles` from
  `@legendary-arena/registry`. Loads registry at startup alongside rules.
  Uses `createRequire` to bridge boardgame.io's CJS-only server bundle.
- `apps/server/package.json` — added `@legendary-arena/game-engine` and
  `@legendary-arena/registry` as workspace dependencies
- `apps/server/src/index.mjs` — added `// why:` comment explaining entrypoint
  vs configuration module separation
- `render.yaml` — already had correct `startCommand`, no change needed

**What a developer can do:**
- `node --env-file=.env apps/server/src/index.mjs` starts the server with
  real game engine and card registry
- Server logs show both startup tasks:
  - `[server] registry loaded: 40 sets, 288 heroes, 2620 cards`
  - `[server] rules loaded: 19 rules, 18 rule docs`
- `GET /health` returns `{"status":"ok"}`
- `POST /games/legendary-arena/create` with `setupData` returns a `matchID`
- Missing `setupData` returns HTTP 400 with a descriptive message (not 500)
- `numPlayers` outside 1-5 returns HTTP 400 (`minPlayers: 1`, `maxPlayers: 5`
  on `LegendaryGame`, enforced by boardgame.io lobby)

**Known gaps (expected at this stage):**
- No lobby/match creation CLI scripts yet (WP-011/012)
- No authentication (separate WP)

### WP-005A — Match Setup Contracts (2026-04-10)

**What changed:**
- `packages/game-engine/src/matchSetup.types.ts` — **new** — defines the
  canonical `MatchSetupConfig` (9 locked fields), `MatchSetupError`
  (`{ field, message }`), and `ValidateMatchSetupResult` (discriminated union)
- `packages/game-engine/src/matchSetup.validate.ts` — **new** —
  `validateMatchSetup(input, registry)` checks both shape and registry ext_id
  existence; never throws; returns structured result. Defines
  `CardRegistryReader` interface to respect the layer boundary.
- `packages/game-engine/src/types.ts` — **modified** — `MatchConfiguration` is
  now a type alias for `MatchSetupConfig` (both had identical 9-field shapes)
- `packages/game-engine/src/index.ts` — **modified** — exports
  `MatchSetupConfig`, `MatchSetupError`, `ValidateMatchSetupResult`,
  `validateMatchSetup`, and `CardRegistryReader`
- `packages/game-engine/src/matchSetup.contracts.test.ts` — **new** — 4 contract
  tests using inline mock registry (no boardgame.io imports)

**What a subsequent session can rely on:**
- `@legendary-arena/game-engine` exports the canonical match setup contract types
- `validateMatchSetup` validates both shape and ext_id existence
- `MatchConfiguration` is a type alias for `MatchSetupConfig` — both work
- The validator never throws — `Game.setup()` decides whether to throw
- `CardRegistryReader` is the minimal interface the validator needs from a registry

**Known gaps (expected at this stage):**
- No deterministic shuffling or deck construction — that is WP-005B
- No changes to `Game.setup()` — that is WP-005B
- No gameplay moves, rules, or phases

### WP-005B — Deterministic Setup Implementation (2026-04-10)

**What changed:**
- `packages/game-engine/src/types.ts` — **modified** — expanded
  `LegendaryGameState` with `CardExtId`, `SetupContext`, `PlayerZones`,
  `GlobalPiles`, `MatchSelection` types. G now has `selection`, `playerZones`,
  and `piles` fields.
- `packages/game-engine/src/setup/shuffle.ts` — **new** — `shuffleDeck(cards, context)`
  uses `context.random.Shuffle` exclusively for deterministic shuffling
- `packages/game-engine/src/test/mockCtx.ts` — **new** — `makeMockCtx(overrides?)`
  returns a `SetupContext` with `Shuffle` that reverses arrays (proves shuffle ran)
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **new** —
  builds initial G from validated config: per-player zones (12-card starting
  decks of 8 agents + 4 troopers), global piles sized from config counts,
  selection metadata
- `packages/game-engine/src/game.ts` — **modified** — `setup()` now calls
  `validateMatchSetup` (when registry configured) then `buildInitialGameState`.
  Exports `setRegistryForSetup()` for server-side registry configuration.
- `packages/game-engine/src/index.ts` — **modified** — exports new types,
  `buildInitialGameState`, `shuffleDeck`, well-known ext_id constants,
  `setRegistryForSetup`
- `packages/game-engine/src/game.test.ts` — **modified** — updated to use
  `makeMockCtx` for proper boardgame.io 0.50.x context shape
- Shape test and determinism test — **new** — 17 new tests

**Revision pass (same session):**
- `shuffle.ts` — narrowed parameter type from `SetupContext` to new
  `ShuffleProvider` interface (`{ random: { Shuffle } }`) for future reuse
  in move contexts. Zero behavior change.
- `game.ts` — added `clearRegistryForSetup()` test-only reset hook to
  prevent module-level registry pollution across tests
- `types.ts` — expanded `SetupContext` JSDoc explaining boardgame.io 0.50.x
  `ctx` nesting rationale
- `index.ts` — exports `clearRegistryForSetup` and `ShuffleProvider`
- Shape tests — added 3 invariant tests: starting deck composition
  (8 agents + 4 troopers), selection/matchConfiguration field consistency,
  selection array reference isolation
- Determinism tests — added shuffleDeck immutability test
- Test count: 34 → 38 (4 new invariant tests)

**What a subsequent session can rely on:**
- `@legendary-arena/game-engine` exports a fully functional `buildInitialGameState`
- `shuffleDeck` provides deterministic shuffling via `context.random.Shuffle`;
  accepts any `ShuffleProvider` (not just `SetupContext`)
- `makeMockCtx` is the shared test helper for all future game engine tests
- `Game.setup()` validates config (when registry set) then builds full initial G
- Determinism guaranteed: same inputs + same RNG → identical G
- All 38 tests passing (17 from WP-005A + 21 new)

**Known gaps (expected at this stage):**
- No hero deck (HQ) construction from registry data — future WP
- No villain deck construction — WP-014/015
- No gameplay moves beyond stubs — WP-008A/B
- `setRegistryForSetup` must be called by the server before creating matches
  (server not yet updated — that is a future integration task)
- Starting deck ext_ids are well-known constants, not resolved from registry

### WP-006A — Player State & Zones Contracts (2026-04-10)

**What changed:**
- `packages/game-engine/src/state/zones.types.ts` — **new** — canonical zone
  and player state contracts: `CardExtId`, `Zone`, `PlayerZones`, `PlayerState`,
  `GlobalPiles`, `ZoneValidationError`, `GameStateShape`
- `packages/game-engine/src/state/zones.validate.ts` — **new** — pure runtime
  shape validators: `validateGameStateShape(input)` and
  `validatePlayerStateShape(input)`. Return structured results, never throw.
  No boardgame.io imports.
- `packages/game-engine/src/state/zones.shape.test.ts` — **new** — 4 structural
  tests (2 passing, 2 `{ ok: false }` cases) using `node:test` and `node:assert`
- `packages/game-engine/src/types.ts` — **modified** — `CardExtId`, `PlayerZones`,
  `GlobalPiles` now re-exported from `state/zones.types.ts`. New types `Zone`,
  `PlayerState`, `ZoneValidationError`, `GameStateShape` also re-exported.
  `LegendaryGameState` uses canonical types from `zones.types.ts`.
- `packages/game-engine/src/index.ts` — **modified** — exports new types and
  validators from `state/zones.types.ts` and `state/zones.validate.ts`

**What a subsequent session can rely on:**
- `@legendary-arena/game-engine` exports canonical zone contracts (`CardExtId`,
  `Zone`, `PlayerZones`, `PlayerState`, `GlobalPiles`)
- `ZoneValidationError` is `{ field, message }` — distinct from `MoveError`
- `validateGameStateShape` and `validatePlayerStateShape` are pure helpers
  that check structural shape only — no registry lookups, no throws
- `GameStateShape` is the minimal interface for zone validation
- All 48 tests passing (38 from WP-005B + 10 zone shape tests)

**Known gaps (expected at this stage):**
- No gameplay moves beyond stubs — WP-008A/B
- No hero deck (HQ) or villain deck construction — future WPs
- `PlayerState` is defined but not yet used in `LegendaryGameState` (G uses
  `Record<string, PlayerZones>` directly — `PlayerState` is available for
  move validation in future WPs)

### WP-006B — Player State Initialization (2026-04-10)

**What changed:**
- `packages/game-engine/src/setup/playerInit.ts` — **new** —
  `buildPlayerState(playerId, startingDeck, context)` returns a typed
  `PlayerState` with shuffled deck and 4 empty zones. Uses `ShuffleProvider`
  for the context parameter.
- `packages/game-engine/src/setup/pilesInit.ts` — **new** —
  `buildGlobalPiles(config, context)` returns a typed `GlobalPiles` from
  `MatchSetupConfig` count fields. Contains `createPileCards` helper and
  well-known pile ext_id constants.
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  delegates player creation to `buildPlayerState` and pile creation to
  `buildGlobalPiles`. Retains `buildStartingDeckCards`, `buildMatchSelection`,
  and well-known starting card ext_id constants.
- `packages/game-engine/src/setup/playerInit.shape.test.ts` — **new** — 3 shape
  tests: all zones present, deck reversed (proves shuffle), broken player rejected
- `packages/game-engine/src/setup/validators.integration.test.ts` — **new** — 3
  integration tests: `validateGameStateShape` ok, `validatePlayerStateShape` ok
  for all players, `JSON.stringify(G)` does not throw

**What is now fully initialized and validator-confirmed:**
- `buildInitialGameState` produces a `G` that passes `validateGameStateShape`
- Every player in `G` passes `validatePlayerStateShape`
- Player state construction is isolated in `buildPlayerState` — independently
  testable with its own shape tests
- Global pile construction is isolated in `buildGlobalPiles` — typed against
  canonical `GlobalPiles` from WP-006A
- All 56 tests passing (48 from WP-006A + 8 new)

**Known gaps (expected at this stage):**
- No hero deck (HQ) construction from registry data — future WP
- No villain deck construction — WP-014/015
- No gameplay moves beyond stubs — WP-008A/B

### WP-007A — Turn Structure & Phases Contracts (2026-04-10)

**What changed:**
- `packages/game-engine/src/turn/turnPhases.types.ts` — **new** — defines
  `MatchPhase` (4 values), `TurnStage` (3 values), canonical arrays
  `MATCH_PHASES` and `TURN_STAGES`, and `TurnPhaseError` error shape
- `packages/game-engine/src/turn/turnPhases.logic.ts` — **new** — pure
  transition helpers: `getNextTurnStage`, `isValidTurnStageTransition`,
  `isValidMatchPhase`, `isValidTurnStage`. No boardgame.io imports.
- `packages/game-engine/src/turn/turnPhases.validate.ts` — **new** —
  `validateTurnStageTransition(from, to)` validates both inputs and transition
  legality. Returns structured results, never throws.
- `packages/game-engine/src/turn/turnPhases.contracts.test.ts` — **new** —
  7 contract tests: 2 valid transitions, 2 invalid transitions,
  `getNextTurnStage('cleanup')` returns null, 2 drift-detection tests
- `packages/game-engine/src/types.ts` — **modified** — re-exports
  `MatchPhase`, `TurnStage`, `TurnPhaseError` from turn types
- `packages/game-engine/src/index.ts` — **modified** — exports all new types,
  canonical arrays, transition helpers, type guards, and validator

**What a subsequent session can rely on:**
- `MatchPhase` and `TurnStage` are the canonical union types for phases and stages
- `MATCH_PHASES` and `TURN_STAGES` are the single source of truth arrays
- `getNextTurnStage` defines stage ordering — WP-007B must use it
- `isValidTurnStageTransition` checks forward-adjacent transitions only
- Type guards (`isValidMatchPhase`, `isValidTurnStage`) use array membership
- `validateTurnStageTransition` validates unknown inputs before checking legality
- `TurnPhaseError` uses `{ code, message, path }` — distinct from `ZoneValidationError`
- All 63 tests passing (56 from WP-006B + 7 new)

**Known gaps (expected at this stage):**
- No `G.currentStage` field — that is WP-007B
- No turn advancement logic — that is WP-007B
- No moves, stage gating, or boardgame.io wiring — WP-008A/B

### WP-007B — Turn Loop Implementation (2026-04-10)

**What changed:**
- `packages/game-engine/src/turn/turnLoop.ts` — **new** — `advanceTurnStage(G, ctx)`
  advances `G.currentStage` through the canonical turn stage cycle. Uses
  `getNextTurnStage` from WP-007A for ordering — no hardcoded stage strings.
  Calls `ctx.events.endTurn()` when `getNextTurnStage` returns `null` (after
  cleanup). Defines `TurnLoopContext` and `TurnLoopState` interfaces locally
  to avoid importing boardgame.io.
- `packages/game-engine/src/types.ts` — **modified** — added
  `currentStage: TurnStage` to `LegendaryGameState` with `// why:` comment
  explaining storage in G rather than ctx
- `packages/game-engine/src/game.ts` — **modified** — wired `play` phase with
  `turn.onBegin` (resets `G.currentStage` to `TURN_STAGES[0]` each turn) and
  added `advanceStage` move that delegates to `advanceTurnStage`
- `packages/game-engine/src/index.ts` — **modified** — exports
  `advanceTurnStage`, `TurnLoopContext`, `TurnLoopState`
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified** —
  returns `currentStage: TURN_STAGES[0]` in initial G (required by updated
  `LegendaryGameState` type)
- `packages/game-engine/src/game.test.ts` — **modified** — updated move
  assertion to include `advanceStage` (3 moves instead of 2)
- `packages/game-engine/src/turn/turnLoop.integration.test.ts` — **new** —
  4 integration tests: start->main, main->cleanup, cleanup->endTurn called,
  JSON-serializability after each transition

**What a running match can now do:**
- The `play` phase has a functional turn stage cycle: `start -> main -> cleanup`
- Each new turn resets `G.currentStage` to the first canonical stage
- `advanceStage` move advances the stage forward or ends the turn
- `ctx.events.endTurn()` handles player rotation — manual rotation forbidden
- `G.currentStage` is observable to all moves for future stage gating (WP-008A)

**What a subsequent session can rely on:**
- `LegendaryGameState` has `currentStage: TurnStage` — always present in G
- `advanceTurnStage` is exported and uses `getNextTurnStage` exclusively
- `advanceStage` is registered as a move on `LegendaryGame`
- The play phase `turn.onBegin` hook resets stage on each turn
- All 67 tests passing (63 from WP-007A + 4 new)

**Known gaps (expected at this stage):**
- No stage gating on moves — WP-008A defines which moves run in which stages
- No gameplay moves (draw, recruit, fight) — WP-008A/B
- No win/loss conditions — WP-010
- No villain deck or city logic — WP-014/015

### WP-008A — Core Moves Contracts (2026-04-10)

**What changed:**
- `packages/game-engine/src/moves/coreMoves.types.ts` — **new** — defines
  `CoreMoveName` (3 values), `CORE_MOVE_NAMES` canonical array,
  `DrawCardsArgs`, `PlayCardArgs` (uses `CardExtId`), `EndTurnArgs`,
  and the engine-wide `MoveError`/`MoveResult` result contract
- `packages/game-engine/src/moves/coreMoves.gating.ts` — **new** —
  `MOVE_ALLOWED_STAGES` map and `isMoveAllowedInStage` helper. No
  boardgame.io imports.
- `packages/game-engine/src/moves/coreMoves.validate.ts` — **new** — four
  pure validators: `validateDrawCardsArgs`, `validatePlayCardArgs`,
  `validateEndTurnArgs`, `validateMoveAllowedInStage`. All return `MoveResult`,
  never throw. No mutation, no normalization, no coercion.
- `packages/game-engine/src/moves/coreMoves.contracts.test.ts` — **new** —
  13 tests: 3 drawCards, 2 playCard, 3 stage gating, 2 drift-detection,
  2 validateMoveAllowedInStage error cases, 1 endTurn
- `packages/game-engine/src/types.ts` — **modified** — re-exports
  `MoveResult`, `MoveError`, `CoreMoveName`
- `packages/game-engine/src/index.ts` — **modified** — exports all new types,
  constants, gating helpers, and validators

**What a subsequent session can rely on:**
- `@legendary-arena/game-engine` exports the canonical move contracts
- `MoveResult`/`MoveError` are the engine-wide result contract — no future
  packet may redefine or shadow these types
- `CORE_MOVE_NAMES` is the canonical array for drift-detection
- `MOVE_ALLOWED_STAGES` is the sole source of truth for stage gating
- `isMoveAllowedInStage` derives answers from the map only
- All four validators are pure (no throw, no mutation, no boardgame.io)
- `PlayCardArgs.cardId` is typed as `CardExtId` (not plain string)
- All 80 tests passing (67 from WP-007B + 13 new)

**Known gaps (expected at this stage):**
- No move implementations that mutate G — WP-008B
- No card rules, costs, or keyword logic — future WPs
- No villain deck, city, or HQ logic — WP-014/015

### WP-008B — Core Moves Implementation (2026-04-10)

**What changed:**
- `packages/game-engine/src/moves/zoneOps.ts` — **new** — pure zone mutation
  helpers: `moveCardFromZone(from, to, cardId)` returns `{ from, to, found }`;
  `moveAllCards(from, to)` returns `{ from, to }`. Both return new arrays,
  never mutate inputs. No boardgame.io imports. No `Math.random()`.
- `packages/game-engine/src/moves/coreMoves.impl.ts` — **new** — three move
  implementations (`drawCards`, `playCard`, `endTurn`) following three-step
  ordering: validate args, check stage gate, mutate G. Imports validators and
  gating from WP-008A. Uses `shuffleDeck` for reshuffle in `drawCards`.
- `packages/game-engine/src/game.ts` — **modified** — replaced `playCard` and
  `endTurn` stubs with imports from `coreMoves.impl.ts`; added `drawCards` as
  a new move. `advanceStage` remains untouched.
- `packages/game-engine/src/index.ts` — **modified** — exports
  `moveCardFromZone`, `moveAllCards`, `MoveCardResult`, `MoveAllResult`
- `packages/game-engine/src/game.test.ts` — **modified** — updated move-count
  assertion from 3 to 4 (runtime wiring allowance for adding `drawCards`)
- `packages/game-engine/src/moves/coreMoves.integration.test.ts` — **new** —
  9 integration tests covering all three moves, stage gating, reshuffle, and
  JSON serializability

**What a running match can now do:**
- `drawCards`: draws N cards from deck to hand; reshuffles discard into deck
  when deck is exhausted mid-draw (deterministic via `ctx.random`)
- `playCard`: moves a card from hand to inPlay
- `endTurn`: moves all inPlay and hand cards to discard, then calls
  `ctx.events.endTurn()` to advance to the next player
- All three moves enforce stage gating via `MOVE_ALLOWED_STAGES`
- A match can now execute a full turn cycle: draw cards (start/main stage),
  play cards (main stage), end turn (cleanup stage), rotate to next player

**What a subsequent session can rely on:**
- `@legendary-arena/game-engine` exports functional move implementations
- `zoneOps.ts` exports `moveCardFromZone` and `moveAllCards` for reuse in
  future moves (villain deck, recruit, fight)
- WP-008A contracts were NOT modified — all validators, gating, and types
  remain locked
- All 89 tests passing (80 from WP-008A + 9 new)

**Known gaps (expected at this stage):**
- No card effects (attack, recruit, keywords, costs) — future WPs
- No HQ, city, KO zone, or villain deck logic — WP-014/015
- No buying or fighting mechanics — future WPs
- No win/loss conditions — WP-010

### WP-003 — Card Registry Verification & Defect Correction (2026-04-09)

**What was fixed:**
- **Defect 1:** `httpRegistry.ts` was fetching `card-types.json` (card type
  taxonomy) instead of `sets.json` (set index). The Zod parse silently
  produced zero sets because `card-types.json` entries lack `abbr` and
  `releaseDate` fields. Fixed to fetch `sets.json` with a `// why:` comment
  explaining the distinction.
- **Defect 2:** `FlatCard.cost` in `types/index.ts` was typed as
  `number | undefined` but real card data includes star-cost strings like
  `"2*"` (amwp Wasp). Widened to `string | number | undefined` to match
  `HeroCardSchema.cost`.
- Stale JSDoc references to `card-types.json` corrected to `sets.json` in
  `CardRegistry.listSets()` and `HttpRegistryOptions.eagerLoad`.

**What was added:**
- `src/registry.smoke.test.ts` — smoke test using `node:test` confirming
  the local registry loads sets and cards without blocking parse errors
- `test` script in `package.json` for `pnpm --filter @legendary-arena/registry test`
- `tsconfig.build.json` excludes `*.test.ts` from build output

**What is confirmed working:**
- Local registry loads 40 sets (38 parse fully, 2 have known schema issues)
- `listSets().length > 0` and `listCards().length > 0` pass
- Immutable files (`schema.ts`, `shared.ts`, `localRegistry.ts`) were not modified

**Known remaining build errors (pre-existing, out of scope):**
- `localRegistry.ts` — missing `@types/node` type declarations for
  `node:fs/promises` and `node:path`; implicit `any` parameter
- `shared.ts` — `exactOptionalPropertyTypes` strictness (optional fields
  assigned to required fields in `FlatCard`)
- These require modifications to immutable files or adding `@types/node` —
  flagged for a follow-up work packet

### WP-002 — boardgame.io Game Skeleton (2026-04-09)

**What exists now:**
- `packages/game-engine/` — new pnpm workspace package (`@legendary-arena/game-engine`)
  - `src/types.ts` — `MatchConfiguration` (9 locked fields from 00.2 §8.1)
    and `LegendaryGameState` (initial G shape)
  - `src/game.ts` — `LegendaryGame` created with boardgame.io `Game()`,
    4 phases (`lobby`, `setup`, `play`, `end`), 2 move stubs (`playCard`,
    `endTurn`), and a `setup()` function that accepts `MatchConfiguration`
  - `src/index.ts` — named exports: `LegendaryGame`, `MatchConfiguration`,
    `LegendaryGameState`
  - `src/game.test.ts` — JSON-serializability test, field verification,
    phase/move assertions (5 tests, all passing)

**What a subsequent session can rely on:**
- `@legendary-arena/game-engine` is importable as a workspace package
- `LegendaryGame` is a valid boardgame.io 0.50.x `Game()` object
- `LegendaryGame.setup()` accepts `MatchConfiguration` and returns
  `LegendaryGameState` (JSON-serializable)
- Phase names are locked: `lobby`, `setup`, `play`, `end`
- Move stubs exist: `playCard`, `endTurn` (void, no side effects)
- `MatchConfiguration` has exactly 9 fields matching 00.2 §8.1

**Known gaps (expected at this stage):**
- Move stubs have no logic — gameplay implementation starts in WP-005B+
- `LegendaryGameState` contains only `matchConfiguration` — zones, piles,
  counters, and other G fields will be added by subsequent Work Packets
- No card registry integration — engine does not import registry (by design)
- No server wiring — `apps/server/` still uses its own placeholder Game()
