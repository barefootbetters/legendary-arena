# WP-790 — Location-restricted attack: "usable only against …" attack is spendable only on those targets

**Status:** Draft 2026-10-01 · **EC:** EC-827 · **Reserves:** D-24652 (reserve PR #2550)
**Primary Layer:** Game Engine + App arena-client
**User-Visible Surface:** play.legendary-arena.com
**Lane:** standard two-session (a new `TurnEconomy` sub-ledger, a hero-effect descriptor contract field, a new owner-only `UIState` field, and the client Fight gates)
**Baseline:** `origin/main` @ `78fc9790` (2026-10-01)

## Goal

Hero attack printed as **"You get +N[icon:attack] usable only against Villains in the Sewers or Bridge [or the
Mastermind]"** is tracked as **restricted attack**. It can pay only for a fight against a Villain in one of the
named City spaces, or against the Mastermind when the card names it. It can no longer pay for any fight anywhere.
The economy bar shows each restricted amount and where it can be used. Fight buttons enable when restricted
attack makes a target affordable.

## User-Visible Impact

- Jeff's game 2 (match `SprBgGkJuY0`, solo Magneto / Midtown Bank Robbery, co2e Storm + Captain America + Venom
  Rocket). Storm's **Lightning Bolt** ("+2 attack usable only against Villains on the Rooftops") and **Tidal
  Wave** ("+3 attack usable only against Villains in the Sewers or Bridge") added plain attack. That attack could
  be spent on the Mastermind or any City space.
- After this packet:
  - Lightning Bolt's +2 pays only for a Rooftops fight.
  - With a Ranged superpower, Storm's "You may use this bonus against the Mastermind instead" line also lets it
    pay for a Mastermind fight.
  - The economy bar reads, e.g., `Attack 0/2` with a chip `+2 only against: Rooftops`.
- Electro's **Shocking Robbery** stops granting **+6**. Today its Ranged "**Instead** you may get +3 … against the
  Commander" line grants a second +3. It now grants one +3, usable against the Bank, or also against the
  Mastermind when the Ranged superpower holds.

## Assumes

- **WP-580 / D-24389 ✅** — the lazily materialized `TurnEconomy` field pattern:
  - `recruitSpendableAsAttack?` (`economy/economy.types.ts` ~L41–53);
  - the single carry chokepoint `carryConversionFlag` (`economy/economy.logic.ts` ~L518–545), spread into
    `addResources` / `spendAttack` / `spendRecruit` and every setter;
  - `resetTurnEconomy` (~L889) returns the base 7 fields, so lazy fields drop at each turn boundary;
  - `getSpendableAttack` (~L566) and `spendFightCost` (~L866) spend attack first, then recruit.
- **D-24295 (WP-489) ✅** — `CITY_SPACE_NAMES = ['sewers','bank','rooftops','streets','bridge']`, the
  `CitySpaceName` type and `citySpaceNameForIndex(index)` (`board/citySpaceNames.ts` ~L24–63; index 0 is the entry
  space). `G.city` is a fixed 5-tuple, and no scheme changes its size.
- **The only two attack sinks are `fightVillain` and `fightMastermind`.**
  - `moves/fightVillain.ts`: cost `resolveFightCost + getPatrolModifier` (~L149–151); gate
    `getSpendableAttack < requiredFightCost` (~L155); Excessive Violence +1 (~L252–255); spend
    `spendFightCost` (~L261).
  - `moves/fightMastermind.ts`: cost `resolveMastermindFightCost` (~L154); gate ~L158–163; EV ~L255–258; spend
    ~L264.
  - No other move spends attack. `exorciseHauntedHero` spends recruit; `defeatCityVillainCore` spends nothing.
- **Bot:** `simulation/ai.legalMoves.ts` ~L876 takes one `spendableAttack` for the City loop (~L937–976) and the
  Mastermind (~L982–990). The simulation runner and the PAR aggregator call the real moves; their only lockstep
  copies are turn-reset lines that call `resetTurnEconomy`.
- **Parser:** `setup/heroAbility.setup.ts` `ICON_MAGNITUDE_PATTERN` (~L462) and Step 2b (~L1698–1717) turn
  `+N[icon:attack]` into `magnitude`; Step 3 (~L1943–1966) pushes the `attack` keyword. The "usable only against …"
  clause is ignored today. The grant runs in `heroEffectAttack` (`hero/heroEffects.execute.ts` ~L1600–1617).
- **Projection:** `UITurnEconomyState` (`ui/uiState.types.ts` ~L772–787) is built in `ui/uiState.build.ts`
  (~L1043–1060) and passed through for the **active player only** in `ui/uiState.filter.ts` (~L436–452).
  `REDACTED_ECONOMY` (~L44–51) never carries lazy fields.
- **Client Fight gates (WP-750 / D-24574 ✅):** `canFight(cost, economy)` and `canFightWithExcessiveViolence(cost,
  economy)` (`apps/arena-client/src/composables/useCardCostGating.ts` ~L85–129) compare the engine-projected
  `fightCost` with `economy.availableAttack`.
  - `CityRow.vue` calls them at ~L119 / ~L140 / ~L169, with the engine index on `cell.cityIndex`.
  - `MastermindTile.vue` calls them at ~L119 / ~L145 / ~L213 (the EV call).
  - The client maps visual Bridge..Sewers to engine index 4..0 (`useCityRow.ts` ~L45–85).
  - The client already imports runtime helpers from the Runtime-Safe Engine Surface, e.g. `gradeForFinalScore` in
    `EndgameSummary.vue` L7 and `LegendaryGame` in `bgioClient.ts` L16.
  - `economy.logic.ts` is already re-exported from `index.ts`, so the bundle gains no new import edge.
- **Hero condition evaluator:** `evaluateAllConditions(G, playerID, conditions, triggeringCardId?)`
  (`hero/heroConditions.evaluate.ts` ~L520).
- **Determinism:**
  - Both oracles hash `G.turnEconomy` and `G.heroAbilityHooks`.
  - The only replay fixture is `test/fixtures/games/sentinel-core-doom-2p.replay.json`. It is core-only, and no
    affected hero is in the core set.
- Engine 4777 / 0 and arena-client 2247 / 0 on `origin/main` @ `78fc9790`. Re-record at execution.

## Context (Read First)

**Rules.**
- Rules v23 (`docs/legendary-universal-rules-v23.md` ~L1656–1666, the Liberate entry) defines "usable only against"
  attack as a bonus that can be spent only on the named targets.
- Attack that is only usable against Masterminds may also pay for the extra attack a Mastermind ability asks for.
  This packet meets that because the restricted Mastermind attack pays the whole `resolveMastermindFightCost` total.

**The 20 printed lines** (verbatim in `data/cards/*.json`). There are 17 hero cards with 18 hero lines (Electro has
two), plus one mastermind tactic line, plus one line on a card in a Villain deck. 13 of the hero cards change. "Adversaries" means Villains and "Commander"
means the Mastermind (fear/vill).

| Card | Restriction | Today | After |
|---|---|---|---|
| co2e Storm Lightning Bolt | Rooftops (+ Mastermind with Ranged, next line) | plain +2 | restricted |
| co2e Storm Tidal Wave | Sewers, Bridge (+ Mastermind with Ranged) | plain +3 | restricted |
| cvwr Speedball Bubble Up | Bridge, Mastermind | plain +3 | restricted |
| cvwr Storm & Black Panther Tsunami of Water | Mastermind (Ranged-gated) | plain +2 | restricted |
| dead Stingray Superpowered Swimsuit | Sewers, Bridge, Mastermind (Tech-gated) | plain +2 | restricted |
| dims / 3dtc Man-Thing Form from Ooze | Sewers, Mastermind (3dtc Strength-gated) | plain +2 | restricted |
| fear Nerkkod Cudgel of the Deep | Bridge, Mastermind | plain +3 (throw trigger hollow) | restricted (throw gap unchanged) |
| smhc High-Tech Spider-Man Friendly Neighborhood… | Mastermind, Rooftops, Streets | plain +3 | restricted |
| ssw1 Namor Ruler of the Seas | Bridge, Mastermind (Strength-gated) | plain +2 | restricted |
| ssw1 Ultimate Spider-Man Web-Slinger | Mastermind, Rooftops, Bridge | plain +2 | restricted |
| vill Electro Shocking Robbery | Bank; Ranged "Instead … Commander" | **+3 and +3** | one +3: Bank, + Mastermind with Ranged |
| wwhk Namora Heart of the Ocean | Sewers, Bridge, Mastermind | plain +1 | restricted |
| anni / ff04 Mr. Fantastic, xmen Havok Blinding Burst | Mastermind | suppressed (Focus / Lightshow) | unchanged — no grant |
| nmut Karma Control Like a Puppet | "other Villains or the Mastermind" | no magnitude (hollow) | unchanged |
| ff04 Mole Man tactic Secret Tunnel; vnom Poison Storm (villain) | — | not hero abilities | unchanged |

**Why the restricted attack stays inside `attack`.**
- A restricted grant still adds to `turnEconomy.attack`, the total attack made this turn, and records a sub-ledger
  of the restricted remainder. Conditions that read "attack you made", the EconomyBar total and the stats keep
  counting it, which is faithful: you did make that attack.
- Only the **spendable** figure excludes the restricted remainder, unless the fight's target is eligible.
- Spending a restricted bucket increments `spentAttack`, so `attack - spentAttack` stays the true unspent total.

**Why narrowest-first.** When several buckets fit one fight, the bucket with the fewest eligible targets pays first
(ties go to the earlier grant). That keeps the most flexible attack for later fights. The choice is deterministic,
so no player prompt is needed.

**The "instead" lines (fusion).** Two follow-up lines change the preceding restricted grant. They are not new grants.
- Storm: `[hc:ranged]: You may use this bonus [icon:attack] against the Mastermind instead.`
- Electro: `[hc:ranged]: Instead you may get +3[icon:attack] usable only against the Commander.`

The parser attaches the follow-up line's conditions to the preceding grant as `widenToMastermindWhen`. When they hold
at play, the bucket also allows the Mastermind.
- Both follow-up hooks lose their `attack` effect and `attack` keyword and keep only their conditions. So Electro's
  second +3 is gone, and neither line is flagged as an `attack-no-magnitude` hollow (D-24649) for a behavior that is
  now modeled.
- The bucket stays one shared amount: a player with Ranged could split Electro's 3 between Bank and Mastermind,
  where the card means one or the other. D-24652 records that approximation.
- The Storm change inverts one existing assertion: `heroEffects.dispatchable.test.ts` ~L242 expects the gated hook
  to carry a magnitude-less attack effect. This is the one authorized test edit (see Non-Negotiable Constraints).

**Why one packet, not engine + client.**
- After the engine change, the projected `availableAttack` excludes restricted attack.
- An engine-only merge would therefore disable the Fight button on a target that only restricted attack can pay
  for. That is a regression the moment it deploys.
- The client gate change is small and consumes the new field. This mirrors WP-789 / WP-776 (engine + client in one
  packet).
- The file count (~28 including tests) is over the ~10-file split guidance, and that is accepted for this reason.

**Interaction with drafted WPs (not dependencies):**
- **WP-775** (affordability cues, drafted) builds on `canFight`. When it executes, it must pass the target so its
  red cost agrees with the button.
- **WP-781** (Lightshow executor, drafted) lists Blinding Burst as an honest hollow ("no restricted-attack pool").
  After WP-790, a follow-up can model it with this pool.

**Read:**
- `docs/ai/DECISIONS.md` — scan D-24389, D-24295, D-24574, D-24561 (Excessive Violence gate), D-12803 (audience
  filter), D-20105 (the client renders served data), D-24372 (runtime drift pins).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — no §-level shape change; `CardExtId` and the city space names are
  used verbatim.
- `docs/ai/ARCHITECTURE.md` §Layer Boundary and `.claude/rules/architecture.md` §UIState Projection Integrity (the
  Board-Visible Field Rule, five steps, applies to `restrictedAttack`).
- `.claude/rules/architecture.md` §Import Rules, the `apps/arena-client` row. The new runtime imports
  `citySpaceNameForIndex` / `sumRestrictedAttackForTarget` come from the `.` Runtime-Safe Engine Surface only, never
  `/setup`.

## Non-Negotiable Constraints

**Engine-wide (do not remove):**
- Never `Math.random()`. No I/O in moves or helpers. Moves never throw.
- `G` stays JSON-serializable. Zones store `CardExtId` strings only.
- Output the **full file contents** for every new or modified file — no diffs, no snippets.
- ESM only, Node v22+, `node:` prefix, `.test.ts`, `node:test` + `makeMockCtx`. No `boardgame.io` import in helpers
  or tests. Vue tests via `vue-sfc-loader`.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: no nested ternaries, no `.reduce()` in the spend
  logic, full-word names, JSDoc on functions.

**Packet-specific:**
- **Lazy materialization.**
  - `TurnEconomy.restrictedAttack` is absent until a restricted grant is played.
  - `carryConversionFlag` carries it only when present.
  - `resetTurnEconomy` never includes it, and `REDACTED_ECONOMY` never carries it.
  - A turn with no restricted grant serializes byte-identically to today.
- **One spend chokepoint.** Both fight moves and the bot gate use `getSpendableAttackForTarget` and
  `spendFightCostForTarget`. No other file computes restricted eligibility. The client uses the engine-exported
  `sumRestrictedAttackForTarget` only.
- **Fail closed in the parser.** If a clause yields no recognized target, or contains the word `other`, the line
  parses exactly as today. Karma stays unchanged.
- **Existing tests pass without edits, EXCEPT one authorized edit.** In `heroEffects.dispatchable.test.ts` ~L242
  (Storm Tidal Wave):
  - the fixture and the two `hookHasExecutableEffect` / `hookHasDispatchableEffect === false` assertions are kept;
  - the magnitude assertion becomes "the gated hook carries no `attack` effect";
  - the file's header comment (~L7–8, ~L18), which describes Storm's line as a bare magnitude-less attack, is
    updated to match.
  The EC commit body must say so (Reward Integrity).
- **One conditional second exception:** the dashboard `useInPlayCoverage.test.ts` totalObs pin may be re-pinned only
  if the sweep feed actually regenerates (after `prebuild:coverage`). Nothing in this packet is expected to
  regenerate it. Any other existing test that fails is a STOP-and-report; do not change it.
- **Sentinel oracles byte-unchanged; no re-pin.** A moved `finalStateHash` / `PRE_WP080_HASH` means the field leaked
  into a non-restricted path: investigate, never re-pin.
- **Session protocol:** if a restricted line not in the Context table parses with a restriction, or a table line
  fails to, STOP and report it before widening the regexes.

## Locked Contract Values

- **Types** (`economy/economy.types.ts`):
  - `export type AttackTargetName = CitySpaceName | 'mastermind';`
  - `export interface RestrictedAttackGrant { remaining: number; targets: AttackTargetName[]; sourceCardId: CardExtId }`
  - `targets` is in canonical order: `CITY_SPACE_NAMES` order, then `'mastermind'`.
  - `TurnEconomy.restrictedAttack?: RestrictedAttackGrant[]`, with JSDoc citing WP-790 / D-24652.
- **Descriptor** (`rules/heroAbility.types.ts`): `HeroEffectDescriptor.attackRestriction?: { targets:
  AttackTargetName[]; widenToMastermindWhen?: HeroCondition[] }`. It is set only on `attack` effects.
- **Economy helpers** (`economy/economy.logic.ts`, all exported from `index.ts`):
  - `addRestrictedAttack(economy, amount, targets, sourceCardId)`: `attack += amount` and appends a grant.
  - `getRestrictedAttackRemaining(economy)`: the sum of `remaining`, or 0 when the field is absent.
  - `getSpendableAttack(economy)` becomes `max(0, attack - spentAttack - getRestrictedAttackRemaining(economy))`,
    plus unspent recruit when the WP-580 flag is set.
  - `sumRestrictedAttackForTarget(grants: readonly { remaining: number; targets: readonly AttackTargetName[] }[],
    target: AttackTargetName)`: the sum of `remaining` over the grants whose `targets` include `target`.
  - `getSpendableAttackForTarget(economy, target)`: `getSpendableAttack(economy) + sumRestrictedAttackForTarget(
    economy.restrictedAttack ?? [], target)`.
  - `spendFightCostForTarget(economy, cost, target)`, in this order:
    1. Eligible grants, narrowest-first (fewest `targets`, ties by array index). Each decrements its `remaining`
       and adds the same amount to `spentAttack`.
    2. Unrestricted attack: pay `min(costLeft, attack - spentAttack - getRestrictedAttackRemaining(after step 1))`
       into `spentAttack`.
    3. Recruit: the rest, into `spentRecruit`, only when `recruitSpendableAsAttack === true`.
    - It **never** delegates to `spendFightCost`. That function's `attack - spentAttack` includes the remaining
      amount of ineligible grants, so with the WP-580 conversion it would spend that attack instead of recruit.
    - Invariant: `attack - spentAttack >= getRestrictedAttackRemaining(economy)` after every helper.
    - Grants that reach `remaining` 0 stay in the array (stable indices). A new array is built, not mutated in
      place.
  - `CarriedTurnFields` (~L481) gains `restrictedAttack`, and `carryConversionFlag` copies it as a new array of
    copied grants, only when present.
  - `spendFightCost(economy, cost)` keeps its signature and behavior.
- **Moves.**
  - `fightVillain` uses `target = citySpaceNameForIndex(cityIndex)`. A missing name means a silent return, as
    today's index guard does.
  - `fightMastermind` uses `'mastermind'`.
  - Both the affordability gate and the Excessive Violence `+1` check use `getSpendableAttackForTarget`, and the
    spend uses `spendFightCostForTarget(…, requiredFightCost + evExtra, target)`.
- **Bot** (`simulation/ai.legalMoves.ts`): the City loop and the Mastermind check use
  `getSpendableAttackForTarget` per target.
- **Parser** (`setup/heroAbility.setup.ts`):
  - **Where each part lives.**
    - The clause parse lives in `parseAbilityText`, which handles one line of text. It sets `attackRestriction`
      only on an `attack` effect that has a Step 2b magnitude.
    - The widen fusion lives in `buildHeroAbilityHooks`, inside the per-instance line loop (~L3920,
      `abilityLines[lineIndex]`), after `coalesceCountScaledChooseOne`. It fuses against the hook built from
      `abilityLines[lineIndex - 1]` of the same instance.
    - **Finding that hook:**
      - Track `previousLineHook: HeroAbilityHook | null`, local to the instance loop.
      - Set it right after each per-line `hooks.push`, and set it to `null` on every `continue` (consumed or blank
        lines).
      - Never read `hooks[hooks.length - 1]`: the digest / Excessive Violence / day-night fused hooks are pushed
        before the loop.
    - **No aliasing (D-13502):** `widenToMastermindWhen` is a fresh array of copied condition objects. It is never
      the follow-up hook's own `conditions` array.
  - **Restriction clause.** Match `/,?\s*usable only against (.+?)\.?$/i` on the text after the `+N[icon:attack]`.
    - Targets are each `\b(sewers|bank|rooftops|streets|bridge)\b` (case-insensitive), plus `'mastermind'` for
      `\b(mastermind|commander)\b`.
    - No target, or the word `other`, means no restriction.
  - **Widen (a), Storm:** `/^\[hc:[a-z]+\]:\s*You may use this bonus \[icon:attack\] against the Mastermind instead\.?$/i`.
  - **Widen (b), Electro:** `/^\[hc:[a-z]+\]:\s*Instead you may get \+(\d+)\[icon:attack\] usable only against the (Mastermind|Commander)\.?$/i`.
    It applies only when `N` equals the preceding restricted grant's magnitude.
  - Either widen applies only when the **immediately preceding line of the same card** produced an `attack` effect
    with `attackRestriction`.
    - It sets `widenToMastermindWhen` to a copy of the follow-up line's parsed conditions.
    - For both (a) and (b), the follow-up hook's `attack` effect (with any `attackRestriction`) and its `attack`
      keyword are removed. The hook keeps only its conditions, so it makes no second grant and is never classified
      as hollow.
- **Executor** (`heroEffectAttack`):
  - When `attackRestriction` is present, `targets` = the restriction's targets, plus `'mastermind'` when
    `widenToMastermindWhen` is present and `evaluateAllConditions(G, playerID, widenToMastermindWhen, cardId)` is
    true.
  - The grant then goes through `addRestrictedAttack`.
  - Log: `Player ${playerID} gained +${N} attack (only against: ${label}) from ${cardRef}.`, `applied`, with the
    card id.
  - `label` = the display names `Sewers`, `Bank`, `Rooftops`, `Streets`, `Bridge`, `Mastermind`, joined with
    `" or "`. It is built by an exported `formatAttackTargets(targets)` in `economy.logic.ts`.
- **Projection (five-step):**
  - `UITurnEconomyState.restrictedAttack?: { remaining: number; targets: AttackTargetName[]; label: string }[]`.
  - It holds only the grants with `remaining > 0`, in grant order, and is omitted when there are none
    (conditional spread).
  - The build and the filter both copy `targets` with `[...grant.targets]`, so the projection never aliases `G`.
  - `availableAttack` stays `getSpendableAttack(...)`, so it now excludes the restricted remainder.
  - Active player only: the filter copies it beside `recruitSpendableAsAttack`.
- **Client:**
  - `canFight(cost, economy, target?: AttackTargetName)` and `canFightWithExcessiveViolence(cost, economy, target?)`
    compare against `economy.availableAttack + sumRestrictedAttackForTarget(economy.restrictedAttack ?? [], target)`
    when `target` is given. The reason text uses that same figure.
  - The `useCardCostGating` wrapper passes `target` through.
  - `CityRow.vue` passes `citySpaceNameForIndex(cell.cityIndex)` at all three calls: ~L119 (the enable), ~L140
    (the cost-short badge) and ~L169 (Excessive Violence).
  - `MastermindTile.vue` passes `'mastermind'` at all three gate calls (~L119, ~L145 and the EV call at ~L213).
  - `EconomyBar.vue` renders one chip per projected grant:
    `<span data-testid="economy-restricted-attack">+{{ remaining }} only against: {{ label }}</span>`.

## Scope (In)

### A) Engine
- `economy/economy.types.ts` — `AttackTargetName`, `RestrictedAttackGrant`, the lazy field.
- `economy/economy.logic.ts` — the carry, the six helpers, `formatAttackTargets`, and the `getSpendableAttack`
  change.
- `rules/heroAbility.types.ts` — `attackRestriction` on `HeroEffectDescriptor`.
- `setup/heroAbility.setup.ts` — the clause parse and the two widen fusions.
- `hero/heroEffects.execute.ts` — the `heroEffectAttack` restricted branch.
- `moves/fightVillain.ts`, `moves/fightMastermind.ts` — target-aware gate, EV check and spend.
- `simulation/ai.legalMoves.ts` — per-target affordability.
- `ui/uiState.types.ts` / `ui/uiState.build.ts` / `ui/uiState.filter.ts` — `restrictedAttack` (five-step).
- `index.ts` — export the new helpers and types, plus `citySpaceNameForIndex` and the `CitySpaceName` type, which are not exported today (the client needs them).

### B) Client
- `apps/arena-client/src/composables/useCardCostGating.ts` — the optional `target`.
- `apps/arena-client/src/components/play/CityRow.vue`, `MastermindTile.vue` — pass the target.
- `apps/arena-client/src/components/play/EconomyBar.vue` — the restricted chips.

### C) Tests
- **New `economy/economy.restrictedAttack.test.ts`:**
  - add / remaining;
  - spendable excludes the remainder;
  - for-target includes eligible grants only;
  - narrowest-first, with the tie by index;
  - recruit after attack;
  - an ineligible grant plus the WP-580 conversion flag: recruit pays the shortfall, and the grant's `remaining` is
    unchanged;
  - an invariant walk: add → eligible spend → ineligible spend with the WP-580 flag → `addResources`, asserting
    `attack - spentAttack >= getRestrictedAttackRemaining(economy)` after each step;
  - `spendFightCost` output is unchanged for an economy with no grant;
  - carry through `addResources` / `spendAttack`;
  - `resetTurnEconomy` drops the field;
  - a runtime keyset assertion that an economy with no grant has no `restrictedAttack` key (D-24372);
  - `formatAttackTargets`.
- **New `hero/heroEffects.restrictedAttack.test.ts`:**
  - Lightning Bolt grants a `['rooftops']` bucket, `attack` +2, and the exact log line;
  - Tidal Wave with the Ranged condition met → `['sewers','bridge','mastermind']`, and unmet → `['sewers','bridge']`;
  - Electro with Ranged → one `['bank','mastermind']` grant of 3 and `attack` +3 (not +6);
  - a plain `+2[icon:attack]` card is unchanged (no field).
- **`setup/heroAbility.setup.test.ts`:**
  - one parse case per Context-table row that changes, using the verbatim card text;
  - the Electro L264 and Storm follow-up hooks have no `attack` effect and no `attack` keyword;
  - `widenToMastermindWhen` deep-equals the follow-up hook's conditions but is not the same array
    (`!==`);
  - an interleaving fused hook (e.g. a digest hook pushed before the loop) does not become the fusion target;
  - Karma unchanged;
  - a non-adjacent widen line does not fuse;
  - Electro with a mismatched N does not fuse.
- **`moves/fightVillain.test.ts`:**
  - Rooftops restricted attack pays for a Rooftops fight;
  - the same attack cannot pay for a Sewers fight (silent return, economy unchanged);
  - mixed restricted + plain attack pays a cost of 5;
  - EV +1 is payable from eligible restricted attack.
- **`moves/fightMastermind.test.ts`:** Mastermind-eligible attack pays; City-only attack does not.
- **`simulation/ai.legalMoves.test.ts`:**
  - a Rooftops-only grant enumerates the Rooftops fight and not the others;
  - a Mastermind-only grant enumerates the Mastermind fight and no City fight;
  - with no grant, the list equals today's list.
- **`ui/uiState.build.test.ts`:** the projection holds `remaining > 0` grants with `label`, and the key is absent with
  none. `availableAttack` excludes the remainder.
- **`ui/uiState.filter.test.ts`:** the active player sees it; an opponent and a spectator do not.
- **`ui/uiState.types.drift.test.ts`:** a new runtime keyset pin case for `restrictedAttack` on a built projection
  (the WP-581 / WP-739 / WP-783 precedent). New cases only; existing ones unedited.
- **Client tests** — `useCardCostGating.test.ts`, `CityRow.test.ts`, `MastermindTile.test.ts`, `EconomyBar.test.ts`:
  - target-aware enable and reason;
  - CityRow: when Rooftops restricted attack covers the cost, the cost-short badge is not shown;
  - an ineligible target stays disabled;
  - the chips render.
- **Non-vacuous:** reverting each of these must fail at least one new test. Report 7/7.
  - (a) the clause parse
  - (b) the widen fusion
  - (c) the `getSpendableAttack` exclusion
  - (d) the per-target spend order
  - (e) the fight-move target wiring
  - (f) the projection build or pass-through
  - (g) the client target pass-through

## D-24652 Content (authored at execution, Status Active)

The DECISIONS.md entry is written in the execution session (01.0a: D-entries land at execution). It locks:
1. **Restricted attack stays inside `attack`.** Totals, stats and "attack you made" conditions count it. Only the
   spendable figure excludes the restricted remainder, unless the fight's target is eligible.
2. **Spend order:** eligible grants narrowest-first (ties go to the earlier grant), then plain attack, then recruit
   under WP-580. It is deterministic, so there is no prompt. Invariant: `attack - spentAttack >= remaining`.
3. **Widen fusion:** Storm's and Electro's Ranged "instead" lines widen the preceding grant to the Mastermind, and
   the follow-up hook's attack effect is removed.
   - Electro's Bank/Mastermind amount is one shared bucket. That is a known approximation of "one or the other".
   - A Ranged Storm play no longer logs a hollow line for the follow-up.
4. **The parser fails closed.**
   - "other" (Karma) and "usable only to fight" (Wong Seal the Rift) parse as today.
   - Liberate (wtif) and Blinding Burst (behind Lightshow, WP-781) are deferred to follow-ups that reuse this pool.
5. **Matches in progress:** a match already running when this deploys keeps the hooks built at its setup, so it
   keeps today's behavior. There is no migration. The competitive replay window is the one under Vision Alignment.

## Out of Scope

- Liberate (wtif, "Villains holding Bystanders or the Mastermind") — it needs a bystander predicate; a follow-up.
- Karma's "other Villains" exclusion.
- The ff04 Mole Man tactic Secret Tunnel (tactic Fight effects).
- The vnom Poison Storm villain card's hero-side line.
- Focus / Lightshow executors (anni, ff04, xmen Blinding Burst stay suppressed; see WP-781).
- Fear's throw trigger for Cudgel of the Deep (the existing `thrown-artifact` hollow).
- mdns Wong **Seal the Rift** ("+5[icon:attack] usable only to fight Villains on the Bridge"). It sits behind an
  unsupported Patrol marker, and the clause regex deliberately does not match "to fight". It is a follow-up for
  when Patrol lands.
- A player prompt for choosing which bucket pays.
- Restricted recruit, and Piercing.
- `PlayMobile.vue`-specific layout.
- `RULING_ECONOMY_FLAGS` (`rules/effectRulings.validate.ts`): not changed unless an existing test requires it. If
  one does, STOP and report it.

## Files Expected to Change

- `packages/game-engine/src/economy/economy.types.ts` — modified — types + the lazy field
- `packages/game-engine/src/economy/economy.logic.ts` — modified — carry, helpers, spendable exclusion
- `packages/game-engine/src/rules/heroAbility.types.ts` — modified — `attackRestriction`
- `packages/game-engine/src/setup/heroAbility.setup.ts` — modified — clause parse + widen fusion
- `packages/game-engine/src/hero/heroEffects.execute.ts` — modified — restricted grant branch
- `packages/game-engine/src/moves/fightVillain.ts` — modified — target-aware gate/spend
- `packages/game-engine/src/moves/fightMastermind.ts` — modified — target-aware gate/spend
- `packages/game-engine/src/simulation/ai.legalMoves.ts` — modified — per-target affordability
- `packages/game-engine/src/ui/uiState.types.ts` — modified — `restrictedAttack` projection type
- `packages/game-engine/src/ui/uiState.build.ts` — modified — build it
- `packages/game-engine/src/ui/uiState.filter.ts` — modified — active-player pass-through
- `packages/game-engine/src/index.ts` — modified — exports (new helpers/types + `citySpaceNameForIndex` / `CitySpaceName`)
- `apps/arena-client/src/composables/useCardCostGating.ts` — modified — optional target
- `apps/arena-client/src/components/play/CityRow.vue` — modified — pass the City target
- `apps/arena-client/src/components/play/MastermindTile.vue` — modified — pass `'mastermind'`
- `apps/arena-client/src/components/play/EconomyBar.vue` — modified — restricted chips
- `packages/game-engine/src/economy/economy.restrictedAttack.test.ts` — **new**
- `packages/game-engine/src/hero/heroEffects.restrictedAttack.test.ts` — **new**
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — modified
- `packages/game-engine/src/moves/fightVillain.test.ts` — modified
- `packages/game-engine/src/moves/fightMastermind.test.ts` — modified
- `packages/game-engine/src/simulation/ai.legalMoves.test.ts` — modified
- `packages/game-engine/src/ui/uiState.build.test.ts` — modified
- `packages/game-engine/src/ui/uiState.filter.test.ts` — modified
- `packages/game-engine/src/ui/uiState.types.drift.test.ts` — modified — new keyset pin case
- `packages/game-engine/src/hero/heroEffects.dispatchable.test.ts` — modified — the ONE authorized assertion edit (~L242)
- `apps/arena-client/src/composables/useCardCostGating.test.ts` — modified
- `apps/arena-client/src/components/play/CityRow.test.ts` — modified
- `apps/arena-client/src/components/play/MastermindTile.test.ts` — modified
- `apps/arena-client/src/components/play/EconomyBar.test.ts` — modified
- **Generated — modified ONLY if its gate shows a real diff** (regenerate with the gate's own script; never hand-edit):
  - `scripts/coverage/hero-effect-coverage.baseline.json` (`sim:coverage`)
  - `docs/ai/coverage/runtime-observed-hollows.json` (`sim:runtime-observed`)
  - `data/metadata/effect-implementation-index.json` (`effect-index`)
  - `data/metadata/card-mechanics.json` (`mechanics:metadata`)
  - `docs/ai/coverage/hero-mechanic-ledger.json` and `docs/ai/coverage/hero-mechanic-ledger.csv` (`ledger:heroes`)
  - `apps/dashboard/src/composables/useInPlayCoverage.test.ts`: the totalObs pin only, and only after
    `pnpm --filter @legendary-arena/dashboard run prebuild:coverage` regenerates the sweep feed.
  - Removing the Storm and Electro follow-up attack effects is likely to move the runtime-observed artifact and the
    ledger.
- Governance:
  - `docs/ai/STATUS.md`
  - `docs/ai/DECISIONS.md` (D-24652 → Active)
  - `docs/ai/work-packets/WORK_INDEX.md`
  - `docs/ai/execution-checklists/EC_INDEX.md`
  - `docs/05-ROADMAP-MINDMAP.md`

No other files may be modified.

## Contract

- A "usable only against …" hero attack grant adds to the turn's attack total and records a restricted grant.
- The restricted amount pays only for fights against its named City spaces or the Mastermind, narrowest-first.
- The active player sees each restricted amount and its targets.
- A Fight button enables exactly when the engine would accept the fight.

## Acceptance Criteria

1. Lightning Bolt's +2 can pay for a Rooftops fight and cannot pay for a Sewers or Mastermind fight. The rejected
   fight leaves `G` unchanged.
2. Tidal Wave with a Ranged superpower can pay for a Mastermind fight; without one it cannot.
3. Shocking Robbery with Ranged makes `attack` +3 (not +6), usable against the Bank or the Mastermind.
4. With two eligible grants, the narrower grant is spent first, and plain attack is spent before recruit.
5. A turn with no restricted grant has no `restrictedAttack` key in `G.turnEconomy` or in the projection.
6. `restrictedAttack` reaches the active player only.
7. The City and Mastermind Fight buttons enable when restricted attack makes the target affordable, and stay
   disabled for ineligible targets. The economy bar shows one chip per grant with its remaining amount and label.
8. The bot enumerates exactly the fights the engine accepts.
9. Karma, Focus- and Lightshow-suppressed lines, and plain attack lines parse exactly as before.
10. The sentinel `finalStateHash` / `PRE_WP080_HASH` are unchanged. The only edited existing tests are:
    - the authorized `heroEffects.dispatchable.test.ts` ~L242 assertion and header comment;
    - the dashboard `useInPlayCoverage.test.ts` totalObs pin, only if the sweep feed regenerates.
11. The Electro and Storm follow-up hooks carry no `attack` effect or keyword, so a Ranged play logs no hollow line
    for them.

## Verification Steps

```pwsh
pnpm -r build
# Expected: exits 0
pnpm --filter @legendary-arena/game-engine test
# Expected: 0 fail; record before/after counts
pnpm --filter @legendary-arena/game-engine exec node --import tsx --test "src/test/fixtures/replayFixtures.test.ts"
git diff --exit-code -- packages/game-engine/src/test/fixtures/games
# Expected: green; exits 0
pnpm --filter @legendary-arena/arena-client typecheck
pnpm --filter @legendary-arena/arena-client test
# Expected: exits 0; 0 fail
pnpm sim:runtime-observed:check; pnpm sim:coverage --check; pnpm effect-index:check; pnpm mechanics:metadata:check; pnpm ledger:heroes:check
# Expected: OK, or regenerated with a real diff explained in the EC commit body
pnpm -r --no-bail test
# Expected: 0 failures
git status --porcelain
# Expected: only the Files Expected to Change allowlist
```

## Definition of Done

- [ ] All ACs pass. The 7/7 revert proofs are reported.
- [ ] `pnpm -r build` exits 0. `pnpm -r --no-bail test` has 0 failures. arena-client vue-tsc exits 0. Engine and
      client before/after counts are recorded.
- [ ] Sentinel / replay oracles byte-identical, with no re-pin.
- [ ] `git status --porcelain` ⊆ the allowlist.
- [ ] **D-24026 live verify (REQUIRED):** in a manual match with co2e Storm, play Lightning Bolt:
  - the economy bar shows `+2 only against: Rooftops`;
  - the Rooftops Fight button enables when +2 covers the cost, and Sewers / the Mastermind stay disabled;
  - the Play Diagnostics `uiStateSnapshot` carries `economy.restrictedAttack` (five-step, step 5).
  Record the matchId in STATUS.md.
- [ ] STATUS.md updated. The D-24652 entry is authored in DECISIONS.md as Active, with the five points in
      §D-24652 Content.
- [ ] WORK_INDEX WP-790 `[x]` with date. EC_INDEX EC-827 → Done. Mindmap `📝`→`✅`.
      `pnpm roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Vision Alignment

- **Clauses touched:**
  - §1 / §2: faithful card semantics — printed restrictions are enforced.
  - §11: stateless client — it renders served state, and eligibility comes from one engine helper.
  - §8 / §22: determinism — lazy field, sentinel-inert.
  - §24: replay-verified competitive integrity — see the accepted window below.
  - §26: the bot / PAR simulation — `ai.legalMoves` enumerates exactly the fights the engine accepts.
  - None of NG-1..NG-8 is crossed (nothing paid, persuasive or cosmetic affects play).
- **Conflict assertion:** No conflict. Gameplay fidelity only; no monetization surface.
- **Determinism and scoring:**
  - Matches that play an affected card can now score differently, because those players have less spendable
    attack. That is the fidelity fix.
  - **Accepted window:** a competitive match captured before the deploy that includes an affected card, but is
    submitted after it, re-executes with the new rules and fails `replay_verification_failed`. This is the same
    accepted window WP-789 / WP-726 carried. It closes once pre-deploy matches age out.

## Lint Gate Self-Review (00.3)

All 21 sections are satisfied or N/A. This was an independent subagent run: FAIL on the first pass, then PASS on a
delta re-lint.
- **§1 structure:** every required section is present, in WP-789 order. Baseline `78fc9790` is cited.
- **§2 constraints:** engine-wide constraints, packet-specific constraints, the session protocol and the Locked
  Contract Values.
- **§3 / §4:**
  - WP-580 / D-24389, D-24295 and WP-750 / D-24574 are cited with verified line anchors.
  - Also cited: the rules v23 Liberate entry, the DECISIONS scan list, 00.2, ARCHITECTURE §Layer Boundary, the
    UIState rule and the arena-client Import Rules row.
- **§5 / §7:**
  - A closed allowlist: 16 source files + 14 test files + governance, with the 7 generated artifacts named by exact
    path (modified only on a real gate diff). No new dependencies.
  - It exceeds the ~10-file guidance. It is not split because an engine-only merge would disable Fight buttons (see
    Context).
- **§6 naming:** `CardExtId`, `playerID` and the `CITY_SPACE_NAMES` values are canonical, with full-word names.
- **§8 layer:**
  - The engine owns eligibility through one helper. The client imports from the `.` Runtime-Safe surface only.
  - The five-step projection is covered.
  - The field is lazy and JSON-safe, with nothing persisted.
  - D-24652 covers the contract-type changes.
- **§9 Windows:** `pwsh` verification.
- **§10 / §11:** N/A — no environment variable and no auth surface.
- **§12 tests:** `node:test`, `makeMockCtx` and `vue-sfc-loader`; no boardgame.io, network or database; 7/7 revert
  proofs.
- **§13 / §14 / §15:** exact commands with their expected output; 11 binary ACs, where AC10 names both edited-test
  exceptions; a DoD covering STATUS, DECISIONS, WORK_INDEX, EC_INDEX, the mindmap and the D-24026 live verify.
- **§16 code style:** no `.reduce()`, explicit `for...of`, JSDoc, and the `// why:` list in the EC.
- **§17 Vision:** §1/§2/§8/§11/§22/§24/§26 touched; no NG-1..NG-8 crossing; the accepted replay window is stated.
- **§18:** N/A — no grep-based acceptance.
- **§19:** N/A — commit-time; applies when STATUS and DECISIONS are written at execution.
- **§20 Funding:** N/A. Only engine gameplay and the in-match economy and fight UI change. There are no funding
  affordances or donate/support copy; the only new copy is `+N only against: …`.
- **§21 API Catalog:** N/A. No `apps/server` endpoint or Library-only function is touched; the changes are in
  packages/game-engine and apps/arena-client only.

## Gate Verdicts

- **Pre-flight (01.4): NOT READY → READY TO EXECUTE.** Two blockers were found and fixed in the text:
  - **PS-1:** the widen-fusion site was unlocked, and Electro's follow-up would have left a magnitude-less attack
    effect, a false `attack-no-magnitude` hollow. Fixed: the clause parse is in `parseAbilityText`; the fusion is in
    the `buildHeroAbilityHooks` instance loop; both follow-up hooks lose their attack effect and keyword.
  - **PS-2:** the step-2/3 arithmetic of `spendFightCostForTarget` could, under WP-580, spend an ineligible grant's
    attack instead of recruit. Fixed: explicit `min(…)` arithmetic, never delegating to `spendFightCost`, plus the
    stated invariant and a test.

  RS items applied:
  - the card counts (17 hero cards / 18 lines / 13 changing);
  - Wong Seal the Rift added to Out of Scope;
  - the runtime-import citation;
  - the MastermindTile and CityRow call sites;
  - copied `targets` and a drift keyset pin;
  - `ledger:heroes:check` and its artifacts;
  - `CarriedTurnFields`.

  One deviation from PS-1: Storm's follow-up hook is stripped too, so no false hollow is logged. That makes
  `heroEffects.dispatchable.test.ts` ~L242 the one authorized test edit. The delta re-check returned **READY**.
  Empirical scaffold: no existing state carries `restrictedAttack`, and only that one test mentions these lines.
  The executor runs the suite right after the parser change.
- **Copilot (01.7): RISK → HOLD → PASS.** Five scope-neutral findings were applied:
  - #26: `previousLineHook` tracking instead of `hooks[hooks.length - 1]`;
  - #17: a copied `widenToMastermindWhen`, never aliasing the follow-up's conditions;
  - #15: the D-24652 Content section;
  - #11: the invariant-walk, no-grant identity and Mastermind-only / no-grant legalMoves tests;
  - #9: CityRow's three gate calls named, plus a badge test.
  Also added: the #28 matches-in-progress note. The delta re-check returned **PASS**.
- **Lint (00.3): FAIL → PASS.** Fixed:
  - §5: the exact generated-artifact paths;
  - §14: AC10 contradicted the conditional dashboard-pin exception;
  - the EC locked values, now verbatim with the WP.
  Advisories applied: §24 and §26 in Vision, and the arena-client Import Rules citation.
