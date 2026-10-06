# WP-794 — Storm fight-cost reduction: "Any Villain you fight on the Rooftops / Bridge / in the Sewers this turn gets -N attack" and "The Mastermind gets -2 attack this turn"

**Status:** Draft 2026-10-06 · **EC:** EC-831 · **Reserves:** D-24663 (reserve PR #2610)
**Primary Layer:** Game Engine
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (a new lazy `TurnEconomy` field in a contract file, a new handler-bearing
`HeroKeyword`, a hero-effect descriptor field, and a change to the single fight-cost authority — NOT
lightweight-eligible)
**Baseline:** `origin/main` @ `d23eb857` (2026-10-06)
**Paired with:** WP-795 (Spinning Cyclone). They are independent; either may execute first.

## Goal

Five printed lines (four Storm, one Forge) that do nothing today reduce fight costs for the rest of the turn:

- core Storm **Lightning Bolt**: "Any Villain you fight on the Rooftops this turn gets -2[icon:attack]."
- core Storm **Tidal Wave**, line 1: "Any Villain you fight on the Bridge this turn gets -2[icon:attack]."
- core Storm **Tidal Wave**, line 2: "[hc:ranged]: The Mastermind gets -2[icon:attack] this turn."
- cvwr Storm & Black Panther **Lightning Strike**: "Any Villain you fight on the Rooftops this turn gets
  -1[icon:attack]."
- dkcy Forge **Dirty Work**: "[hc:tech]: Any Villain you fight in the Sewers this turn gets -2[icon:attack]."

After this packet, a played line lowers the fight cost of every Villain in the named City space, or of the
Mastermind, for the rest of the turn. The cost the player sees on the City card or Mastermind tile drops by the
same amount, and the Fight button enables when the lower cost is affordable.

## User-Visible Impact

- Jeff's 2-player match `s1jtBcEAOfw` (Red Skull / Secret Invasion, build `bd7cfb7`, 2026-10-06):
  - Lightning Bolt was played four times. No Rooftops fight was ever cheaper, and nothing was logged.
  - Tidal Wave logged "Its effect is not supported yet" on its Ranged line. Its Bridge line did nothing.
- After this packet, each play logs one line, e.g. `Player 0's Lightning Bolt (core/storm/lightning-bolt#4):
  Villains you fight on the Rooftops this turn get -2 attack.` A Rooftops Villain printed at 5 shows and costs 3.
- The client needs no change. It already renders the engine-projected `fightCost` (WP-750 / D-24574), and its
  "altered cost" badge (`CityRow.vue` ~L162, `MastermindTile.vue` ~L131) marks the reduced card.

## Assumes

- **WP-214 / WP-760 ✅ — `resolveFightCost` is the single City Villain fight-cost authority**
  (`economy/economy.resolve.ts` ~L70–88). It sums `resolveBaseFightCost` (~L219), `darkPortalVillainBonus`
  (~L170, a per-City-index term via `G.city.indexOf`), `bystanderVillainAttackBonus` (~L197) and
  `villainBloodFrenzyBonus` (~L102). Its JSDoc promises a non-negative integer (~L62).
  - It is read by `moves/fightVillain.ts` ~L158, `simulation/ai.legalMoves.ts` ~L965 and the City projection
    `ui/uiState.build.ts` ~L873. The move then adds `getPatrolModifier` (~L159–167).
- **`resolveMastermindFightCost`** (`economy/economy.resolve.ts` ~L285–292) is the Mastermind's single authority:
  base `fightCost` plus the Dark Portal bonus. It is read by `moves/fightMastermind.ts` ~L154 (normal and Final
  Blow fights), `ai.legalMoves.ts` ~L989 and `uiState.build.ts` ~L976.
- **D-24295 (WP-489) ✅** — `CITY_SPACE_NAMES = ['sewers','bank','rooftops','streets','bridge']`, the
  `CitySpaceName` type and `citySpaceNameForIndex(index)` (`board/citySpaceNames.ts` ~L24–63). Index 0 is the
  Sewers (entry), and index 4 is the Bridge (escape).
- **WP-790 / D-24652 ✅** — `AttackTargetName = CitySpaceName | 'mastermind'` (`economy/economy.types.ts`). It
  also set the lazy `TurnEconomy` field pattern: `restrictedAttack?` (~L162), carried by `CarriedTurnFields` /
  `carryConversionFlag` (`economy/economy.logic.ts` ~L481 / ~L519) and dropped by `resetTurnEconomy` (~L1129).
- **D-24486 ✅** — `NEGATIVE_MAGNITUDE_ICON_PATTERN` (`setup/heroAbility.setup.ts` ~L510) already suppresses every
  `-N[icon:attack]` from the Step 2b / Step 3 extractors. So these lines parse to no effect today and never become
  phantom +N grants. This packet keeps that suppression and adds a separate clause recognizer.
- **D-24623 ✅** — Step 4b (`heroAbility.setup.ts` ~L2499) records a `gate-only` hollow for a gated line whose body
  resolved nothing. That is Tidal Wave line 2's "Its effect is not supported yet" today. Once the line resolves an
  effect, Step 4b no longer fires for it.
- **The handler-bearing `HeroKeyword` lockstep** (six sites; auto-memory `reference_hero_keyword_lockstep_sites`):
  - the `HeroKeyword` union and `HERO_KEYWORDS` (`rules/heroKeywords.ts` ~L26 / ~L110; 75 entries at baseline);
  - the THREE length pins: `rules/heroKeywords.test.ts` ~L67, `rules/heroAbility.setup.test.ts` ~L639 (+ append
    `'fight-cost-reduction'` to its `expectedKeywords` order array; the ~L669 `Set.size === length` no-duplicates
    assert needs no edit), and `setup/heroAbility.setup.test.ts` ~L1464 (the X-Gene "count stays" assert);
  - `HERO_EFFECT_HANDLERS` (`hero/heroEffects.execute.ts` ~L5966; 58 entries at baseline) and its count pins
    (`hero/heroEffects.execute.test.ts` ~L135 and ~L7656);
  - `HANDLED_KEYWORDS`;
  - the setup parser.
- **Determinism:**
  - Both oracles hash `G.turnEconomy` and `G.heroAbilityHooks`.
  - The only replay fixture, `test/fixtures/games/sentinel-core-doom-2p.replay.json`, plays `core/black-widow` +
    `core/captain-america`, and never Storm.
  - No `data/par/**` profile or sweep fixture names `core/storm`.
- Engine 4883 / 0 (1122 suites) and arena-client 2270 / 0 on `origin/main` @ `d23eb857`. Re-record them at
  execution.

## Context (Read First)

**Rules.** "gets -N[icon:attack]" lowers that Villain's or Mastermind's attack. For a fight, that is the attack
you must spend. "Any Villain you fight on the Rooftops this turn" applies to each fight this turn against a Villain
that is on the Rooftops at the moment of the fight. That includes a Villain that enters or is moved there later in
the turn (e.g. by WP-795 Spinning Cyclone), and Henchmen, which are Villains (rules v23; D-24603). A cost never goes
below 0.

**The 5 printed lines** (verbatim in `data/cards/*.json`). Pre-flight scanned every hero ability string with both
locked regexes after stripping the gate prefix; these are the only matches:

| Card | Line | Target | Amount | Gate |
|---|---|---|---|---|
| core Storm Lightning Bolt (`core.json` ~L1345) | idx0 | rooftops | 2 | — |
| core Storm Tidal Wave | idx0 | bridge | 2 | — |
| core Storm Tidal Wave | idx1 | mastermind | 2 | `[hc:ranged]` |
| cvwr Storm & Black Panther Lightning Strike (a split-card face, paired with `pouncing-strike`) | idx0 | rooftops | 1 | — |
| dkcy Forge Dirty Work (`dkcy.json` heroes[8].cards[0]) | idx0 | sewers | 2 | `[hc:tech]` |

**Why the reduction lives in `resolveFightCost` / `resolveMastermindFightCost`.** These are the single
authorities. Adding the term there makes the fight move, the bot's legal moves and the projected `fightCost` agree
by construction, which is the WP-214 / WP-750 invariant. No client file and no `UIState` field change.

**Why a sub-total, not per-grant spending.** Unlike WP-790's restricted attack, a reduction is not spent. Every
fight this turn against an eligible target gets the full reduction. The field records each played line, and the cost
read sums the entries whose `target` matches.

**Why the reduction is clamped inside the resolver.** `resolveFightCost` already promises `>= 0`. The reduction is
applied to the resolver's sum, and the result is floored at 0 there. `getPatrolModifier` is added by the move
afterwards, unchanged. Patrol is rare and still pays in full, which keeps one change site.

**Excessive Violence needs no change.** Its +1 overspend reads `requiredFightCost + 1` (`fightVillain.ts` ~L265,
`fightMastermind.ts` ~L259), so it is already evaluated against the reduced cost.

**Not "the Villain's attack" everywhere.** Only the fight cost reads the reduction. Effects that read a Villain's
**printed** attack keep reading `cardStats[...].fightCost`: Pure Fury targets (`buildPureFuryTargets`), D-24605's
"Villain that has N[icon:attack] or less" lines, and the `uiState.build.ts` ~L1895 `attackValue`. The cards say
"Any Villain **you fight**", so the reduction is a fight-time modifier. D-24663 records that reading.

**Interaction with drafted or recent WPs (not dependencies):**
- **WP-795** (Spinning Cyclone) moves a Villain between spaces. A Villain moved onto the Rooftops after Lightning
  Bolt was played gets the reduction at fight time with no extra code, because the space is read when the fight
  happens.
- **WP-790** restricted attack is unaffected. Restricted attack pays a cost, and this packet lowers the cost.
- **WP-775** (affordability cues, drafted) reads the projected `fightCost` and inherits the reduction.

**Read:**
- `docs/ai/DECISIONS.md` — scan D-24652 (restricted attack, lazy field), D-24295 (City space names), D-24486
  (negative icons), D-24623 (gate-only hollow), D-24574 (projected fight cost), D-24603 (Henchmen are Villains),
  D-24372 (runtime drift pins).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — no shape change; `CardExtId` and the City space names are used
  verbatim.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary. Engine only; nothing is persisted.

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- Never `Math.random()`. No I/O in moves or helpers. Moves never throw.
- `G` stays JSON-serializable. Zones store `CardExtId` strings only.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test` + `makeMockCtx`. No `boardgame.io` import in helpers
  or tests.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: no nested ternaries, no `.reduce()` in the cost
  sum, full-word names, JSDoc on every function.

**Packet-specific:**
- **Lazy materialization.**
  - `TurnEconomy.fightCostReductions` is absent until a reduction line is played.
  - `carryConversionFlag` carries it only when present, as a new array of copied entries.
  - `resetTurnEconomy` never includes it, and `REDACTED_ECONOMY` never carries it.
  - A turn with no reduction serializes byte-identically to today.
- **One read site per cost.** Only `resolveFightCost` and `resolveMastermindFightCost` read the field, through one
  exported helper `getFightCostReduction(economy, target)`. No move, bot or projection file reads the field
  directly.
- **Fail closed in the parser.** A line that does not match a locked regex exactly parses as today. In particular
  "Each Villain gets -N…", "the next time you fight the Mastermind", Royal Decree and every D-24605 line are
  unchanged.
- **Keep D-24486.** The negative icon stays suppressed from Step 2b / Step 3. The new effect comes only from the
  Step 4c clause recognizer, never from the icon extractors.
- **Existing tests pass without edits, EXCEPT the mandated drift-pin bumps:**
  - the three `HERO_KEYWORDS` length pins (`rules/heroKeywords.test.ts`, `rules/heroAbility.setup.test.ts`,
    `setup/heroAbility.setup.test.ts` ~L1464) and the order array;
  - the `HERO_EFFECT_HANDLERS` count pins.
  Any other existing test that fails is STOP-and-report. In particular, if a test asserts Tidal Wave line 2 is a
  `gate-only` hollow, STOP and report it before editing.
- **Sentinel oracles byte-unchanged; no re-pin.** A moved `finalStateHash` / `PRE_WP080_HASH` means the field
  leaked into a no-reduction path: investigate, never re-pin.
- **Session protocol:** if any line outside the Context table parses to `fight-cost-reduction`, or a table line
  fails to, STOP and report it before widening the regexes.

## Locked Contract Values

- **Types** (`economy/economy.types.ts`):
  - `export interface FightCostReduction { target: AttackTargetName; amount: number; sourceCardId: CardExtId }`
  - `TurnEconomy.fightCostReductions?: FightCostReduction[]`, with JSDoc citing WP-794 / D-24663.
- **Keyword:** `fight-cost-reduction`. It is handler-bearing and carries a magnitude (the amount), so it is **not**
  in `NO_MAGNITUDE_KEYWORDS`.
- **Descriptor** (`rules/heroAbility.types.ts`): `HeroEffectDescriptor.fightCostReductionTarget?: AttackTargetName`.
  It is set only on `fight-cost-reduction` effects, whose `magnitude` is the amount.
- **Parser** (`setup/heroAbility.setup.ts`, a new Step 4c in `parseAbilityText`, placed after Step 4a and before
  Step 4b):
  - **Post-gate text:** `abilityText.slice(leadingGatePrefixLength).trim()`. It reuses the existing
    `LEADING_GATE_PREFIX_PATTERN` (~L131) / `leadingGatePrefixLength` (~L1127). The trim matters because data
    contains a double space after the gate (`"[hc:ranged]:  Draw"`), and both regexes are `^`-anchored.
  - The two locked regexes. Each is ONE line; copy it exactly, with no line break:

    ```text
    /^Any Villain you fight (?:on|in) the (Sewers|Bank|Rooftops|Streets|Bridge) this turn gets -(\d+)\[icon:attack\]\.?$/i
    /^The Mastermind gets -(\d+)\[icon:attack\] this turn\.?$/i
    ```

  - City form (the first): target = the lowercased space name. Mastermind form (the second): target =
    `'mastermind'`.
  - Step 4c runs after the effect-builder loop. On a match it pushes directly to `effects` — `{ type:
    'fight-cost-reduction', magnitude: N, fightCostReductionTarget: target }` — and pushes the keyword to
    `uniqueKeywords`. It never goes through `keywords` / `magnitudes`, which would lose the keyword or build a bare
    effect with no magnitude. The gate's conditions parse exactly as today.
  - No match leaves the line as today.
- **Economy helpers** (`economy/economy.logic.ts`, exported from `index.ts`):
  - `addFightCostReduction(economy, target, amount, sourceCardId)` returns a new economy whose
    `fightCostReductions` is the old array (or `[]`) plus one entry. All other fields are carried.
  - `getFightCostReduction(economy, target)` returns the sum of `amount` over the entries whose `target ===
    target`, or 0 when the field is absent. It uses an explicit `for...of`.
  - `CarriedTurnFields` gains `fightCostReductions`, and `carryConversionFlag` copies it when present.
- **Resolvers** (`economy/economy.resolve.ts`):
  - `resolveFightCost` = `max(0, <today's sum> - cityReduction)`.
    - `cityIndex = G.city?.indexOf(villainCardId) ?? -1`, the `darkPortalVillainBonus` precedent (~L177–178).
    - `cityReduction` = `getFightCostReduction(G.turnEconomy, citySpaceNameForIndex(cityIndex))` when `cityIndex
      >= 0`, the name is defined and `G.turnEconomy !== undefined`. Otherwise it is 0.
  - `resolveMastermindFightCost` = `max(0, base + portalBonus - mastermindReduction)`. `mastermindReduction` =
    `G.turnEconomy === undefined ? 0 : getFightCostReduction(G.turnEconomy, 'mastermind')`.
  - Both MUST tolerate a partial `G` with no `city` and no `turnEconomy`. The existing `economy.resolve.test.ts`
    `makeG` (~L25–32) and `makeMastermindG` (~L299–305) build exactly that, and they must pass unedited.
- **Handler** `heroEffectFightCostReduction` (`hero/heroEffects.execute.ts`, in `HERO_EFFECT_HANDLERS` and
  `HANDLED_KEYWORDS`):
  - It reads `effect.magnitude` (the pre-gate guarantees a valid one) and `effect.fightCostReductionTarget`. A
    missing target is a silent no-op.
  - It sets `G.turnEconomy = addFightCostReduction(G.turnEconomy, target, magnitude, cardId)`.
  - Log, `applied`, with the card id:
    - City: `Player ${playerID}'s ${cardRef}: Villains you fight ${preposition} the ${SpaceLabel} this turn get
      -${N} attack.`
    - Mastermind: `Player ${playerID}'s ${cardRef}: the Mastermind gets -${N} attack this turn.`
    - `SpaceLabel` comes from the exported `formatAttackTargets([target])` (WP-790). `preposition` is `in` for
      `sewers` and `on` for every other space, matching the printed cards ("in the Sewers", "on the Rooftops").
- **Drift pins at draft:** `HERO_KEYWORDS` 75 → 76 and `HERO_EFFECT_HANDLERS` 58 → 59. Read the HEAD values at
  execution and bump from those; sibling WPs move them.

## Scope (In)

### A) Engine
- `economy/economy.types.ts` — `FightCostReduction` and the lazy field.
- `economy/economy.logic.ts` — the carry, `addFightCostReduction`, `getFightCostReduction`.
- `economy/economy.resolve.ts` — the reduction term in both resolvers, with the 0 floor.
- `rules/heroKeywords.ts` — the `fight-cost-reduction` keyword (union + array).
- `rules/heroAbility.types.ts` — `fightCostReductionTarget` on `HeroEffectDescriptor`.
- `setup/heroAbility.setup.ts` — Step 4c (the two clause regexes).
- `hero/heroEffects.execute.ts` — the handler, its `HERO_EFFECT_HANDLERS` entry and `HANDLED_KEYWORDS`.
- `index.ts` — export `FightCostReduction`, `addFightCostReduction` and `getFightCostReduction`.

### B) Tests
- **New `economy/economy.fightCostReduction.test.ts`:**
  - `addFightCostReduction` appends without mutating its input;
  - `getFightCostReduction` sums by target and returns 0 with the field absent;
  - carry through `addResources` / `spendAttack`;
  - `resetTurnEconomy` drops the field;
  - a runtime keyset assertion that an economy with no reduction has no `fightCostReductions` key (D-24372);
  - `resolveFightCost`: a Rooftops Villain printed 5 with a rooftops 2 reduction resolves to 3; the same Villain on
    the Streets resolves to 5; two rooftops entries (2 + 1) stack to 3; a printed 1 with a reduction of 2 floors
    at 0;
  - `resolveMastermindFightCost` with a mastermind 2 reduction is base − 2, floored at 0. It still includes the
    Dark Portal bonus;
  - AC-5: add a rooftops reduction while the City is empty, then place a Villain at index 2. It resolves reduced.
    At index 3 it resolves at full cost.
- **`setup/heroAbility.setup.test.ts`:**
  - one parse case per Context-table line (all 5), using the verbatim card text, asserting the effect, target,
    magnitude, keyword and the gate condition on Tidal Wave idx1 (`[hc:ranged]`) and Dirty Work (`[hc:tech]`).
    Lightning Strike is a split-card face, so its case uses that face's hook;
  - Tidal Wave idx1 is no longer a `gate-only` hollow;
  - fail-closed cases: "Each Villain gets -2[icon:attack]" and a Royal Decree-shaped line parse exactly as before.
- **`rules/heroAbility.setup.test.ts`:** the `HERO_KEYWORDS` order-array / length pins (mandated).
- **`hero/heroEffects.execute.test.ts`:**
  - the handler appends the entry and logs the exact line (City "on the Rooftops", City "in the Sewers", and
    Mastermind forms);
  - a missing target is a no-op;
  - AC-3: Tidal Wave with no other Ranged Hero played adds a `bridge` entry only (the idx1 gate fails);
  - the handler count pins (mandated).
- **`rules/heroKeywords.test.ts`:** the length pin (mandated).
- **`moves/fightVillain.test.ts`:**
  - after a rooftops 2 reduction, a Rooftops fight costing 5 succeeds with 3 attack and spends 3;
  - a Sewers fight with the same 3 attack is rejected silently, with `G` unchanged;
  - Excessive Violence: rooftops −2, a cost-5 Villain and 4 attack with an EV card in play spends 4 and fires EV.
- **`moves/fightMastermind.test.ts`:** a mastermind 2 reduction lowers the spend by 2, including on a Final Blow
  fight.
- **`simulation/ai.legalMoves.test.ts`:**
  - with a rooftops reduction, the Rooftops fight is enumerated at the reduced cost;
  - a mastermind reduction enumerates `fightMastermind` at base − 2;
  - with no reduction, the list equals today's list.
- **`ui/uiState.build.test.ts`:** the projected City `fightCost` and Mastermind `fightCost` show the reduced value.
- **Non-vacuous:** reverting each of these must fail at least one new test. Report 5/5.
  - (a) the Step 4c parse
  - (b) the handler append
  - (c) the `resolveFightCost` term
  - (d) the `resolveMastermindFightCost` term
  - (e) the 0 floor

## D-24663 Content (authored at execution, Status Active)

The DECISIONS.md entry is written in the execution session (01.0a: D-entries land at execution). It locks:
1. **A fight-cost reduction is a turn-scoped, lazily materialized `TurnEconomy` list**, read only by the two cost
   resolvers through `getFightCostReduction`. Entries stack and are never spent.
2. **The space is read at fight time.** A Villain that enters or is moved into the space later in the turn gets the
   reduction.
3. **Fight-time only.** Effects that read a Villain's printed attack are unaffected.
4. **The cost floors at 0 inside the resolver**, and Patrol is added after the floor.
5. **The parser fails closed.** The two locked regexes are the whole vocabulary. "Each Villain gets -N", "the next
   time you fight the Mastermind" and Royal Decree are named follow-ups.
6. **Matches in progress** keep the hooks built at setup, so they keep today's behavior. There is no migration.

## Out of Scope

- WP-795 Spinning Cyclone (move a Villain).
- Other "-N[icon:attack]" vocabulary, which needs its own clause forms: "Each Villain gets -N",
  "the next time you fight the Mastermind this turn", Royal Decree's "isn't worth at least 5VP",
  villain-side and scheme-side reductions.
- Any client change, including a chip that lists the active reductions. The reduced `fightCost` and the existing
  altered-cost badge are the UI.
- Changing `getPatrolModifier`, or Patrol's position in the sum.
- `RULING_ECONOMY_FLAGS` (`rules/effectRulings.validate.ts`): not changed unless an existing test requires it. If
  one does, STOP and report it.

## Files Expected to Change

- `packages/game-engine/src/economy/economy.types.ts` — modified — type + lazy field
- `packages/game-engine/src/economy/economy.logic.ts` — modified — carry + two helpers
- `packages/game-engine/src/economy/economy.resolve.ts` — modified — the reduction term in both resolvers
- `packages/game-engine/src/rules/heroKeywords.ts` — modified — `fight-cost-reduction`
- `packages/game-engine/src/rules/heroAbility.types.ts` — modified — `fightCostReductionTarget`
- `packages/game-engine/src/setup/heroAbility.setup.ts` — modified — Step 4c
- `packages/game-engine/src/hero/heroEffects.execute.ts` — modified — handler + registries
- `packages/game-engine/src/index.ts` — modified — exports
- `scripts/coverage/mechanic-provenance.json` — modified, OPTIONAL forward-compat hand edit — add
  `"fight-cost-reduction": { "wp": "WP-794", "decision": "D-24663" }` (the WP-783 `phasing` precedent). It is inert
  today, because no line carries a `[keyword:fight-cost-reduction]` token.
- `packages/game-engine/src/economy/economy.fightCostReduction.test.ts` — **new**
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — modified — the Step 4c parse cases (the WP-790
  parse-case file) and the ~L1464 X-Gene `HERO_KEYWORDS` length pin (mandated)
- `packages/game-engine/src/rules/heroKeywords.test.ts` — modified — length pin
- `packages/game-engine/src/rules/heroAbility.setup.test.ts` — modified — order array + length pins
- `packages/game-engine/src/hero/heroEffects.execute.test.ts` — modified — handler tests + count pins
- `packages/game-engine/src/moves/fightVillain.test.ts` — modified
- `packages/game-engine/src/moves/fightMastermind.test.ts` — modified
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — modified
- `packages/game-engine/src/ui/uiState.build.test.ts` — modified
- **Generated — modified ONLY if its gate shows a real diff** (regenerate with the gate's own script; never
  hand-edit):
  - `scripts/coverage/hero-effect-coverage.baseline.json` (`sim:coverage`). **Expected to change.** `noEffect`
    drops for core, cvwr and dkcy, because these lines now resolve an effect. `--check` passes on a drop and will
    not force the update, so run `pnpm sim:coverage --update-baseline` deliberately and name the per-set deltas in
    the commit body.
  - `data/metadata/effect-implementation-index.json` (`effect-index`).
  - **Expected UNCHANGED:** `data/metadata/card-mechanics.json` (`mechanics:metadata`) and
    `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` (`ledger:heroes`). The ledger extracts only `[keyword:X]`
    tokens (`scripts/hero-mechanic-ledger.mjs` ~L343–356), and none of the 5 lines carries one.
  - **Expected UNCHANGED (a diff means a leak: STOP):** `docs/ai/coverage/runtime-observed-hollows.json`
    (`sim:runtime-observed`). The sweep's hero sets include none of core Storm, cvwr Storm & Black Panther or
    dkcy Forge. The same goes for the dashboard `useInPlayCoverage.test.ts` totalObs pin, whose feed is built from
    that artifact.
- Governance:
  - `docs/ai/STATUS.md`
  - `docs/ai/DECISIONS.md` (D-24663 → Active)
  - `docs/ai/work-packets/WORK_INDEX.md`
  - `docs/ai/execution-checklists/EC_INDEX.md`
  - `docs/05-ROADMAP-MINDMAP.md`
  - `docs/ai/coverage/live-verify.json` (no Core entry exists for these lines today; add none unless an existing
    key matches)

No other files may be modified.

## Contract

- A played reduction line records a turn-scoped reduction for one City space or the Mastermind.
- Every fight this turn against a Villain in that space, or against the Mastermind, costs that much less, floored
  at 0.
- The fight move, the bot and the projected `fightCost` agree, because all three call the same two resolvers.

## Acceptance Criteria

1. After Lightning Bolt, a Rooftops Villain printed at 5 costs 3 in `resolveFightCost`, in the projected City
   `fightCost`, and in the attack the fight move spends.
2. The same reduction does not lower a Sewers, Bank, Streets or Bridge Villain's cost.
3. After Tidal Wave with a Ranged superpower, the Mastermind's cost (and the Final Blow fight's cost) is 2 lower.
   Without one, only the Bridge reduction applies.
4. Two reductions on the same space stack. A cost never goes below 0.
5. A Villain that enters or moves onto the Rooftops after Lightning Bolt was played gets the reduction.
6. A turn with no reduction line has no `fightCostReductions` key in `G.turnEconomy`. The field is gone after the
   turn ends.
7. Each played line logs exactly one locked line. Tidal Wave line 2 no longer logs "Its effect is not supported yet".
8. For the City fights and the non-Final-Blow Mastermind fight the bot enumerates today, it enumerates exactly
   those the engine accepts at the reduced cost. The bot never enumerates a Final Blow fight
   (`ai.legalMoves.ts` ~L985 gates on `tacticsDeck.length > 0`); that is pre-existing and unchanged.
9. Lines outside the Context table, including "Each Villain gets -N" and Royal Decree, parse exactly as before.
10. The sentinel `finalStateHash` / `PRE_WP080_HASH` are unchanged. The only edited existing assertions are the
    mandated drift pins. `runtime-observed-hollows.json` and the dashboard totalObs pin are unchanged.

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0
pnpm --filter @legendary-arena/game-engine test
# Expected: 0 fail; record before/after counts
pnpm --filter @legendary-arena/game-engine exec node --import tsx --test "src/test/fixtures/replayFixtures.test.ts"
git diff --exit-code -- packages/game-engine/src/test/fixtures/games
# Expected: green; exits 0
pnpm sim:runtime-observed:check; pnpm effect-index:check; pnpm mechanics:metadata:check; pnpm ledger:heroes:check; pnpm cards:check
# Expected: OK (runtime-observed, mechanics and ledger UNCHANGED); effect-index regenerated only with a real diff
pnpm sim:coverage --update-baseline
pnpm sim:coverage --check
# Expected: the baseline drops noEffect for core, cvwr and dkcy; --check then exits 0
pnpm -r --no-bail test
# Expected: 0 failures
pnpm roadmap:counts:write
pnpm roadmap:counts:check
# Expected: exits 0
git status --porcelain
# Expected: only the Files Expected to Change allowlist. Discard line-ending-only churn a build may leave in
# generated files (e.g. packages/lagn-spec/schemas/lagn-v1.json); check with git diff --ignore-all-space --numstat.
```

## Definition of Done

- [ ] All ACs pass. The 5/5 revert proofs are reported.
- [ ] `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. Engine before/after counts are recorded.
- [ ] Sentinel / replay oracles byte-identical, with no re-pin.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED):** in a manual match with core Storm, play Lightning Bolt with a Villain on
      the Rooftops:
  - the log shows the locked line;
  - the Rooftops card's cost drops by 2 and shows the altered-cost badge;
  - the fight spends the reduced amount.
  Record the matchId in STATUS.md.
- [ ] STATUS.md updated. The D-24663 entry is authored in DECISIONS.md as Active, with the six points in
      §D-24663 Content.
- [ ] WORK_INDEX WP-794 `[x]` with date. EC_INDEX EC-831 → Done. Mindmap `📝`→`✅`.
      `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:**
  - §1 / §2: faithful card semantics. Printed cost reductions now apply.
  - §11: stateless client. It renders the engine-projected cost and gains no logic.
  - §8 / §22: determinism. The field is lazy and sentinel-inert.
  - §24: replay-verified competitive integrity. See the accepted window below.
  - §26: the bot / PAR simulation. `ai.legalMoves` reads the same resolver.
  - None of NG-1..NG-8 is crossed: nothing paid, persuasive or cosmetic affects play.
- **Conflict assertion:** No conflict. Gameplay fidelity only; no monetization surface.
- **Determinism and scoring:**
  - Matches that play an affected card can now score differently, because their fights are cheaper. That is the
    fidelity fix.
  - **Accepted window:** a competitive match captured before the deploy that includes an affected card, but is
    submitted after it, re-executes with the new rules and fails `replay_verification_failed`. This is the same
    accepted window WP-790 / WP-789 carried. It closes once pre-deploy matches age out.

## Lint Gate Self-Review (00.3)

All 21 sections are satisfied or N/A. This was an independent subagent run: PASS, then a delta re-check PASS after
the advisory edits.
- **§1 structure:** all required sections are present. Baseline `d23eb857` is cited.
- **§2 constraints:** engine-wide constraints, packet-specific constraints, the session protocol and the Locked
  Contract Values.
- **§3 / §4:**
  - WP-214 / WP-760, WP-790 / D-24652, D-24295, D-24486 and D-24623 are cited with verified line anchors.
  - Also cited: the DECISIONS scan list, 00.2 and ARCHITECTURE §Layer Boundary.
- **§5 / §7:**
  - A closed allowlist: 8 engine source files, the mandated and new tests, the gated generated artifacts by exact
    path, and governance. Each item is marked new or modified.
  - No new dependencies.
- **§6 naming:** `CardExtId`, `AttackTargetName`, `CitySpaceName` and `fightCost` are canonical.
- **§8 layer:** engine only. The read site is the two resolvers; nothing is persisted, and the client is unchanged.
- **§9 Windows:** `pwsh` verification.
- **§10 / §11:** N/A — no environment variable and no auth surface.
- **§12 tests:** `node:test` and `makeMockCtx`; no boardgame.io, network or database; 5/5 revert proofs.
- **§13 / §14 / §15:**
  - exact commands with their expected output;
  - 10 binary ACs;
  - a DoD covering STATUS, DECISIONS, WORK_INDEX, EC_INDEX, the mindmap and the D-24026 live verify.
- **§16 code style:** `for...of`, no `.reduce()`, JSDoc, and the `// why:` list in the EC.
- **§17 Vision:** §1/§2/§8/§11/§22/§24/§26 touched; no NG-1..NG-8 crossing; the accepted replay window is stated.
- **§18:** N/A — no literal-string grep in Verification.
- **§19:** N/A — commit-time discipline.
- **§20 Funding:** N/A — engine-only gameplay fidelity (hero parser, economy resolvers, hero-effect handler). There
  is no navigation, viewer, profile or tournament surface, and no donate/support copy.
- **§21 API Catalog:** N/A. All changes are under `packages/game-engine/**`, plus tests, generated coverage
  artifacts and governance docs. No `apps/server` HTTP endpoint or `apps/server/src/**` library function is added,
  modified or re-statused.

## Gate Verdicts

- **Pre-flight (01.4): NOT READY → READY TO EXECUTE.** Two blockers were found and fixed in the text:
  - **PS-1:** a fifth printed line matches the City regex: dkcy Forge Dirty Work, "in the Sewers". It is now in
    scope, with the `in` / `on` log preposition.
  - **PS-2:** a third `HERO_KEYWORDS` pin (`setup/heroAbility.setup.test.ts` ~L1464) is now named.

  RS items applied:
  - the post-gate text via `leadingGatePrefixLength` + trim;
  - Step 4c pushing to `effects` / `uniqueKeywords`;
  - runtime-observed and totalObs expected unchanged;
  - the `sim:coverage` drop expected;
  - the split-face note.

  A delta re-check after the copilot and lint edits returned **READY**.
- **Copilot (01.7): RISK → HOLD → PASS.** Seven scope-neutral findings were applied:
  - #22: partial-G tolerance, `G.city?.indexOf ?? -1` and `turnEconomy` undefined → 0;
  - #12: the EC dashboard-pin contradiction;
  - #26: mechanic-provenance made an optional, inert hand edit, with ledger and mechanics expected unchanged;
  - #30: an explicit `--update-baseline`;
  - #11: AC-3, AC-5, the Mastermind legal-moves and Excessive Violence tests, and AC-8 reworded for the bot's
    pre-existing Final Blow gap;
  - #4: pin wording.

  The delta re-check returned **PASS**. A second delta, after the lint edits, also returned **PASS**.
- **Lint (00.3): PASS.** Advisories applied: the five-line Goal and the Sewers in the title; the regexes as fenced
  one-line blocks; verification gaining `--update-baseline`, `roadmap:counts` and the line-ending-churn note. The
  delta re-check returned **PASS**.
- **Not applied (non-blocking, for the executor):**
  - `effect-implementation-index.json` is derived from the ledgers, so it is effectively expected UNCHANGED too.
    Run `pnpm effect-index` before its `:check`.
  - `sim:coverage --check` straight after `--update-baseline` always passes. The evidence is the per-set `noEffect`
    deltas named in the commit body.
