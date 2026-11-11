# WP-881 — Hero Patrol: "Patrol the <space>: If it's empty, … If it's not, …" gates on that City space (Game Engine + Card Data)

**Status:** Draft 2026-11-10
**Primary Layer:** Game Engine (hero conditions, setup parser) + Card Data (hero markers)
**Dependencies (all ✅):**
- WP-765 / D-24598 (board-state hero conditions: the Sunlight / Moonlight arm, evaluator and Synergy exclusion this packet mirrors)
- WP-859 / D-24795 (one printed line split into two parsed halves before the per-line parse)
- WP-865 / D-24808 (a keyword-led line consumed at its own line index in the per-line loop)
- WP-790 / D-24652 (location-restricted attack, `attackRestriction`)
- WP-831 / D-24764 (a City of 1-6 spaces; a removed space does not exist)
- WP-489 / D-24295 (`CITY_SPACE_NAMES`, Sewers(0) … Bridge(4))
- WP-866 / D-24809 (`next-hand-extra-draw`), WP-667 / D-24480 (`optional-ko-hand-discard`), WP-851 / D-24787 (names Feeding Grounds as waiting on Patrol)

**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — gameplay rules (two new hero conditions, a setup-parser line form) plus card data and derived feeds; no auth, money, persistence or server surface
**Lane:** Standard (two-session). Parser + evaluator + card data + regenerated feeds; not lightweight-eligible (behavior change on ranked-reachable cards, > 4 code/test files).

> Baseline: `origin/main` at `4a7259bb` (the reserve commit, #3269).

---

## Goal

Legendary's hero **Patrol** keyword (rules v23 ~L1772-1780; "Abilities Triggering Separately" ~L2605):

- "Patrol the Bridge: If it's empty, draw a card." — use the ability **only if that City space has no cards in it**.
- If the space empties later in the turn, it is too late.
- If a card effect makes that City space not exist, the Patrol ability can't be used at all.
- A Location above a space with no Villain still counts as empty (Location clarifications ~L2484-2487).

**Today** (observed with a parser probe at the baseline):
- The `[keyword:Patrol the X]` token never matches `KEYWORD_PATTERN` (it has spaces), so nothing gates the line.
- **Icon-bearing Patrol lines over-grant on every play.** Elsa Bloodstone's Axe of the Slayer gives +2 recruit **and** +2 attack; Government Payroll +2 / +2; Lord of Dragons +4 / +4; Seal the Rift an unrestricted +5 attack; Corvus Glaive's Let None Escape You +2 / +2; Seek the Empty Mind +2 attack; Silver Bullets, Acrobatic Kung Fu, Where Monsters Lurk, All-Terrain Barbarian, First Adventure, Warlord of Open Spaces, Calm Before the Storm and Save the Day each a flat +1.
- **Text-only Patrol lines are hollow.** Bridge Between Dimensions, Hunt High and Low, Where Monsters Lurk's draw line, Big Slimeportunity, Feeding Grounds, Sweep the Streets of Trash, Monster Hunter, Fateful Bridge and Bridge to a Better Future record a `parse-unrecognized` hollow (`patrol-the-*`) on every play. Live operator match `YkewuXWQWQV` logged 22 in one game (Bridge Between Dimensions ×13, Axe of the Slayer ×7, Where Monsters Lurk ×2).
- Axe of the Slayer's "[hc:instinct]: Instead, you get both." is a `gate-only` hollow.

**After this session:**
1. **Two board-state conditions.** `patrolSpaceEmpty` / `patrolSpaceOccupied` (value = the `CitySpaceName`) are read from `G.city` as the hook resolves.
2. **Patrol lines parse as gated hooks.** A Patrol line naming one of the five City spaces becomes one hook per printed branch: the "If it's empty" body gated by `patrolSpaceEmpty`, the "If it's not" body (when printed) gated by `patrolSpaceOccupied`.
3. **"Instead, you get both"** on Axe of the Slayer becomes two cross hooks (instinct AND occupied → the empty branch's grant; instinct AND empty → the occupied branch's grant).
4. **Markers** route 11 text bodies to shipped executors (all existing token forms; no validator change).
5. **Honest hollows.** A branch the engine can't model, and every Patrol line whose target is not a single named City space, grants nothing and records the line's existing `patrol-*` hollow slug — the over-grants stop.

## User-Visible Impact

- Midnight Sons and Secret Wars Vol. 2 Patrol heroes stop granting both branches on every play; each grant needs its City space empty (or occupied, for "If it's not").
- Wong's Bridge Between Dimensions draws when the Bridge is empty; Seal the Rift draws two, or gives +5 Attack usable only against the Bridge.
- Feeding Grounds, Monster Hunter, Fateful Bridge, Save the Day, Hunt High and Low, Sweep the Streets of Trash, Big Slimeportunity and Bridge to a Better Future do what they print when their space is empty.
- A Patrol line that is blocked logs the standard blocked line, e.g. "Player 0's Bridge Between Dimensions ability did not activate — there's a card in the Bridge."

---

## Assumes

1. **Parser** (`packages/game-engine/src/setup/heroAbility.setup.ts`, at `4a7259bb`):
   - `KEYWORD_PATTERN` `:152` never matches a multi-word token; `collectUnmatchedKeywordSlugs` `:3184` slugifies `[keyword:Patrol the Bridge]` → `patrol-the-bridge`.
   - `parseAbilityText` `:1209` (text-only; options object).
   - `ATTACK_RESTRICTION_CLAUSE_PATTERN` `:512` = `/,?\s*usable only against (.+?)\.?$/i`; consumed at `:2901` via `parseAttackRestrictionTargets` `:3043`.
   - Per-line loop in `buildHeroAbilityHooks` (`:4650`); the Heist consume-at-own-index block is at `:4792` (the precedent for consuming a Patrol line); `previousLineHook` is reset after any consumed line.
   - The WP-859 split precedent `splitFeastThenTransformLine` `:3719`.
   - Parser emits keyword effects before icon effects; `attack-per-count` suppresses the printed icon on its line.
2. **Conditions** (`hero/heroConditions.evaluate.ts`): `HeroCondition.type` is a bare string. `evaluateCondition(G, playerID, condition, triggeringCardId?)` `:131` (Sunlight / Moonlight cases `:470` / `:480`); `describeFailedCondition(G, playerID, condition)` `:904` (cases `:1037` / `:1042`); `SEQUENCE_GATE_CONDITION_TYPES` `:1067`; `WAIT_AND_SEE_CONDITION_TYPES` `hero/deferredConditionalGrants.ts:79`.
3. **Execution** (`hero/heroEffects.execute.ts`): `countSynergyConditions` `:1494` excludes the two day/night types; `detectHollowHeroHook` `:1542` records `parse-unrecognized` for a conditions-passed hook whose only content is `unresolvedMarkers`.
4. **City.** `G.city` is `CitySpace[]` (`CardExtId | null`), length 1-6 (`board/city.types.ts`, D-24764). A smaller City has lost its far spaces; names are bound to engine indices 0-4 (`board/citySpaceNames.ts` `CITY_SPACE_NAMES`). Locations are not stored in `G.city`.
5. **Markers.** `scripts/convert-cards/apply-hero-ability-markers.mjs` `VALID_TOKEN_PATTERN` `:151` accepts every §Card Map token form: `draw:N`, `rescue:N`, `reveal:N`, `reveal-top-may-ko`, `optional-ko-hand-discard`, `next-hand-extra-draw:N`, `attack-per-count:<src>:<n>:<per>`. Markers are appended at line end (`:441`). Core / co2e / cvwr / smhc / ssw1 Spider-Man print Fateful Bridge's exact reveal line with `[keyword:reveal:2]` (e.g. `core.json:1222`), which builds the same descriptor as `reveal:cost-lte-2:draw` (`revealRule.ts:234-238`). `inputs/hero-ability-markers.json` has `mdns` (`:2183`) and `ssw2` (`:1200`) sections and a `_deferred` entry for `mdns/blade-daywalker/hunt-high-and-low` ability 0 (`:2864-2869`).
6. **Ledger.** `scripts/hero-mechanic-ledger.mjs` folds every `patrol-*` slug to `patrol` (`MECHANIC_FAMILY_RULES` `:315`) and classifies via `KNOWN_CONDITIONS` `:183` (`'sunlight': 'sunlightInEffect'` precedent).
7. **Branch bodies resolve with shipped executors** (parser probe at baseline, each body + its marker parsed through `buildHeroAbilityHooks`):

   | Body + marker | Parsed |
   |---|---|
   | "draw a card." `[keyword:draw:1]` / "draw two cards." `[keyword:draw:2]` | `draw` 1 / 2 |
   | "reveal the top card … You may KO it." `[keyword:reveal-top-may-ko]` | `reveal-top-may-ko` |
   | "you may KO a card from your hand or discard pile." `[keyword:optional-ko-hand-discard]` | `optional-ko-hand-discard` |
   | "rescue a Bystander." `[keyword:rescue:1]` | `rescue` 1 |
   | "… draw an extra card." `[keyword:next-hand-extra-draw:1]` | `next-hand-extra-draw` 1 |
   | "reveal the top card … costs 2 or less, draw it." `[keyword:reveal:2]` | `reveal` with `cost-lte 2 → draw` (core Spider-Man's line and token) |
   | "rescue a Bystander, and then you get +1[icon:attack] for every two Bystanders in your Victory Pile." `[keyword:rescue:1] [keyword:attack-per-count:victory-bystanders:1:2]` | `rescue` 1, then `attack-per-count` (`victory-bystanders`, perEach 2); the icon is not also granted |
   | "+5[icon:attack] usable only **against** Villains on the Bridge." | `attack` 5, `attackRestriction {targets:['bridge']}` — the printed "**to fight**" wording does not match today |
   | "defeat the Villain there for free." / "reveal the bottom card … You may KO it." | nothing |

8. **Scaffold observed at draft (reverted).** The two evaluator cases, the Patrol line builder, the both-fusion and the restriction widen were prototyped on a throwaway branch. A probe printed the intended hooks for all 29 Patrol hero lines (mdns 9, ssw2 20). `pnpm --filter @legendary-arena/game-engine test`: **6853 tests, 6852 pass, 1 fail** — `setup/heroAbility.setup.test.ts:2058` ("fails closed: Karma …"), which pins Seal the Rift's "usable only to fight Villains on the Bridge" as **unrestricted**. That pin migrates in scope (§Scope D). No other engine test, snapshot, drift pin or hash moved.
9. `pnpm -r build` exits 0 and the suites are green at the baseline.

If any item is false, this packet is **BLOCKED**.

## Context (Read First)

- `docs/legendary-universal-rules-v23.md` ~L1772-1780 (Patrol), ~L2484-2487 (a Location doesn't make a space non-empty), ~L2603-2610 (abilities resolve one at a time).
- **Not the board keyword.** D-2501 / D-2502 / WP-025 define a *villain* board keyword `patrol` (+1 fight cost, `board/boardKeywords.logic.ts`, no data source). Hero Patrol is a different mechanic, lives entirely in hero ability hooks (D-2501 keeps the two separate), and touches none of `boardKeywords.*`, `getPatrolModifier` or `buildCardKeywords`.
- `docs/ai/DECISIONS.md`: D-24598, D-24795, D-24808, D-24652, D-24764, D-24295, D-24624 / D-24623 (honest hollow slugs), D-24570 (parsed-grant suppression), D-24119 (replay verification). D-24832 is reserved.
- User memory: `reference_hero_keyword_lockstep_sites` (not triggered — no new `HeroKeyword`), `reference_setup_hook_change_replay_compat`, `reference_inplay_totalobs_pin_stale_on_feed_regen`, `reference_hero_ability_marker_curated_map`.
- **Why conditions + split hooks, not a composite keyword.** `HeroCondition` lists are AND-only, so a two-branch line becomes two hooks with complementary conditions (the WP-859 split shape), and "Instead, you get both" becomes two more AND-only hooks. No `HeroKeyword`, handler or count pin changes, and the day/night machinery (blocked log, hollow detection, Synergy exclusion) applies as-is. The WP-765 composite (`day-night-both`) was needed only because day/night has three states; Patrol's empty / occupied are complementary.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Full file contents for every new or modified file; no diffs, no snippets.
- ESM only, Node v22+; human-style code per `docs/ai/REFERENCE/00.6-code-style.md` (full-word names, JSDoc, no nested ternaries, functions ~30 lines).
- Moves and effects never throw. No randomness, no clock. Engine + card data + the hero-ledger script + derived feeds and records + the dashboard `totalObs` pin only (§Files Expected to Change).

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP + D-24832) before coding. One WP per session.

**Packet-specific:**

- **Conditions.** `{ type: 'patrolSpaceEmpty', value: <CitySpaceName> }` and `{ type: 'patrolSpaceOccupied', value: <CitySpaceName> }`.
  - **One literal each.** Export `PATROL_SPACE_EMPTY_CONDITION_TYPE = 'patrolSpaceEmpty'` and `PATROL_SPACE_OCCUPIED_CONDITION_TYPE = 'patrolSpaceOccupied'` from `hero/heroConditions.evaluate.ts` (the existing `*_CONDITION_TYPE` export pattern, `:35-111`, already imported by the parser at `heroAbility.setup.ts:43-48`). The parser, the evaluate / describe cases, `countSynergyConditions`, the failed-Patrol clause rule and the ledger use the constants, never a re-typed string (`HeroCondition.type` is a bare string and the evaluator's `default` is `false`, so a typo would silently never fire).
  - Evaluation, read as the hook resolves (never cached): the space index is `CITY_SPACE_NAMES.indexOf(value)`. If the value is not a name, `G.city` is not an array, or the index is `>= G.city.length` (the space does not exist, D-24764), **both** conditions are false. Otherwise `patrolSpaceEmpty` ⇔ `G.city[index] === null`; `patrolSpaceOccupied` ⇔ `G.city[index] !== null`.
  - `describeFailedCondition`: `patrolSpaceEmpty` → `"there's a card in the <Space>"`; `patrolSpaceOccupied` → `"nothing is in the <Space>"`; a space that does not exist → `"there is no <Space> in the City"` (`<Space>` = Sewers / Bank / Rooftops / Streets / Bridge). These read after the engine's "… ability did not activate — " prefix (`heroEffects.execute.ts:1141-1145`).
  - Neither type joins `WAIT_AND_SEE_CONDITION_TYPES` (rules: "If that city space becomes empty later in the turn, it's too late") or `SEQUENCE_GATE_CONDITION_TYPES` (board state, not a play-order synergy). A new runtime pin in `heroConditions.evaluate.test.ts` asserts both types have evaluate and describe cases and are in neither array.
- **Synergy Rate.** Both types are excluded from `countSynergyConditions` (board state, not a built synergy). **And** a hook whose Patrol condition fails on this play is **not** a countable conditional clause on that play. Mechanism (locked): where `isCountableConditionalClause` is computed (`heroEffects.execute.ts:1000-1001`), also require that **every** Patrol-type condition on the hook passes `evaluateCondition` directly — not via `findFailedCondition`, which stops at the first failure (`:1041`) and would report the instinct gate first on Axe's off-branch cross hook (2 misses without instinct). Reason: otherwise Axe of the Slayer's off-branch cross hook (instinct ∧ the other Patrol state) records a guaranteed miss on every play (`recordConditionalClause`, `:1109-1117`). Expected per Axe play: with another instinct Hero, exactly 1 assembled clause and 0 misses; without, exactly 1 miss — in either Streets state.
- **Blocked-log noise (accepted).** Without instinct, an Axe of the Slayer play logs up to three "did not activate" lines (the off-branch base hook and both cross hooks). Accepted and recorded in D-24832; no log suppression.
- **Patrol line recognition** (in the per-line loop, consumed at its own index like Heist; `previousLineHook = null` after):
  - A line is a Patrol line when, after an optional leading `[hc:X]` / `[team:X]` gate prefix, its first token is `[keyword:Patrol <target>]`.
  - **Named target** — `<target>` is `the Sewers` / `the Bank` / `the Rooftops` / `the Streets` / `the Bridge` (case-insensitive): split the body at `If it's not,` (straight or curly apostrophe). The empty branch is the text after `If it's empty,`; trailing curated `[keyword:…]` marker tokens at line end are **stripped from the line before the split** and appended to the **empty** branch (the restriction pattern is `$`-anchored, so a marker left on Seal the Rift's occupied clause would be swallowed by it). Each branch is parsed with `parseAbilityText(<gate prefix> + <branch body>)` and gets the matching Patrol condition appended after any gate conditions; timing `onPlay`.
  - **Honest-partial:** a branch that resolves no effect, no primitive and no unresolved marker of its own records the line's `collectUnmatchedKeywordSlugs` slug (e.g. `patrol-the-rooftops`) as its unresolved marker.
  - **Hook construction.** Every Patrol branch, cross and hollow hook uses the per-line loop's omit-when-empty construction (`heroAbility.setup.ts:4859-4900`: `conditions` / `effects` / `primitiveEffects` / `unresolvedMarkers` / `resolvedMarkers` assigned only when non-empty). A hook carrying ≥1 condition carries the `conditional` keyword exactly once (`parseAbilityText`'s rule, `:2705`), including an ungated branch whose only condition is the appended Patrol one; an ungated other-target hollow has no conditions and no `conditional`.
  - **No aliasing (D-13502).** Every hook — per branch, per cross hook, per card instance — comes from its own `parseAbilityText` call and owns its condition objects and arrays.
  - **Other target** (any city space, two adjacent city spaces, every city space, the Escape Pile, your discard pile, your Victory Pile): one hook keeping only the gate prefix's conditions (and its `conditional` keyword), **no effects**, and the slug as its unresolved marker (e.g. `patrol-any-city-space`). Its printed grants are dropped (the D-24570 / D-24598 suppression sibling).
- **"Instead, you get both" fusion.** `PATROL_BOTH_CARDS` = `{ 'mdns/elsa-bloodstone/axe-of-the-slayer' }`. On an allowlisted card, the line reading `<gate>: Instead, you get both.` is consumed at its own index into two hooks, each parsed from `<gate>: <branch body>`: (gate AND `patrolSpaceOccupied`) → the **empty** branch's body; (gate AND `patrolSpaceEmpty`) → the **occupied** branch's body. Both read the card's Patrol line.
- **Restricted attack wording.** `ATTACK_RESTRICTION_CLAUSE_PATTERN` accepts `usable only (?:against|to fight) …`. Seal the Rift is the only data line printing "to fight" (grep at baseline). This **amends D-24652 §4** (`DECISIONS.md:46435`), which named Seal the Rift as deliberately failing closed while its +5 fired ungated; rewrite the comment at `heroAbility.setup.ts:509-510` accordingly.
- **Marker validator.** Unchanged — every §Card Map token is an existing form.
- **Ledger.** `KNOWN_CONDITIONS` gains `'patrol': 'patrolSpaceEmpty'`, but `patrol` is classified **by hook**, not by name: in the per-hero hook loop (`hero-mechanic-ledger.mjs:610`) collect the hooks' condition types, and report `condition` only when some hook carries `patrolSpaceEmpty` / `patrolSpaceOccupied`; otherwise `unsupported`. This per-hook `patrol` check runs **before** `statusForMechanic`'s by-name `KNOWN_CONDITIONS` return (`:404`), which would otherwise answer `condition` first. So a hero whose only Patrol lines are other-target hollows (ssw2 Corvus Glaive, ssw2 Beast) stays `unsupported`. Mixed heroes (Shang-Chi, Arkon, Dr. Punisher, Time-Traveling Jean Grey, mdns Elsa Bloodstone) and ssw2 Captain Britain (Raise the Union Jack is a named-space hollow that still carries `patrolSpaceEmpty`) read `condition` — recorded in D-24832.
- **Provenance.** `scripts/coverage/mechanic-provenance.json` gains `patrol → WP-881 / D-24832` (the WP-866 precedent).
- **Live-verify record.** `docs/ai/coverage/live-verify.json` gains `pending` rows for `mdns/wong-master-of-the-mystic-arts|patrol` and `mdns/elsa-bloodstone|patrol` (flipped to `verified` by the post-deploy STATUS flip).
- **Not touched:** `HERO_KEYWORDS`, `HERO_EFFECT_HANDLERS`, `HANDLED_KEYWORDS`, `NO_MAGNITUDE_KEYWORDS` and every count pin; `board/boardKeywords.*`; UIState (no new field — no five-step); villain / bystander Patrol lines.
- **Determinism / replay.** Setup output plus an evaluator case only new hooks reference: pre-deploy match blobs keep their stored `G.heroAbilityHooks` and replay identically (memory `reference_setup_hook_change_replay_compat`); only matches created after the deploy see Patrol. No `G` field, no randomness. Core-only oracles (`finalStateHash`) unchanged — confirm by running them, do not assume.

## Card Map (locked)

**Markers** (appended at line end by `apply-hero-ability-markers.mjs`):

| Set / hero / card | Ability | Marker(s) |
|---|---|---|
| `mdns/blade-daywalker/hunt-high-and-low` | 0 (Rooftops) | `[keyword:reveal-top-may-ko]` — lift its `_deferred` entry |
| `mdns/blade-daywalker/where-monsters-lurk` | 0 (Rooftops) | `[keyword:draw:1]` |
| `mdns/wong-master-of-the-mystic-arts/bridge-between-dimensions` | 0 (Bridge) | `[keyword:draw:1]` |
| `mdns/wong-master-of-the-mystic-arts/seal-the-rift` | 0 (Bridge, empty branch) | `[keyword:draw:2]` |
| `ssw2/agent-venom/big-slimeportunity` | 1 (Sewers) | `[keyword:draw:1]` |
| `ssw2/captain-and-the-devil-the/feeding-grounds` | 0 (Streets) | `[keyword:optional-ko-hand-discard]` |
| `ssw2/dr-punisher-soldier-supreme/sweep-the-streets-of-trash` | 0 (Streets) | `[keyword:draw:1]` |
| `ssw2/elsa-bloodstone/monster-hunter` | 0 (Sewers) | `[keyword:rescue:1]` |
| `ssw2/spider-gwen/fateful-bridge` | 0 (Bridge) | `[keyword:reveal:2]` |
| `ssw2/spider-gwen/save-the-day` | 0 (Rooftops) | `[keyword:rescue:1]` then `[keyword:attack-per-count:victory-bystanders:1:2]` |
| `ssw2/time-traveling-jean-grey/bridge-to-a-better-future` | 0 (Bridge) | `[keyword:next-hand-extra-draw:1]` |

**Gate only (printed icons, no marker):** Where Monsters Lurk 1 (Sewers +1 recruit); Axe of the Slayer 0 (Streets: +2 recruit / not: +2 attack) + the both line; Silver Bullets 0 (Streets +1 attack); Seal the Rift 0 occupied branch (+5 attack, Bridge only); Government Payroll 1 (Bank: +2 recruit / not: +2 attack); All-Terrain Barbarian 1 (Sewers +1 recruit); Lord of Dragons 0 empty branch (Rooftops +4 / +4); Acrobatic Kung Fu 1 (Rooftops +1 attack); First Adventure 1 (Bank +1 attack).

**Honest hollows (named space, unmodelled branch):** Hunt High and Low 1 (Sewers, "reveal the bottom card"); Raise the Union Jack 0 (Rooftops, two-card team-icon reveal); Lord of Dragons 0 occupied branch ("defeat the Villain there for free").

**Honest hollows (other target, grants dropped):** Vengeance of the Bloodstone Gem 0 (any city space); Warlord of Open Spaces 0 (two adjacent); Upside-Down Thinking 1 (any); Let None Escape You 0 (Escape Pile); Calm Before the Storm 0 (every city space); Seek the Empty Mind 0 (your discard pile); First Adventure 2 (your Victory Pile); Change History 0 (`[team:x-men]` gate kept; any city space).

Totals: 29 Patrol hero lines (mdns 9, ssw2 20) → 18 fully modelled, 1 partial (Lord of Dragons), 2 named hollows, 8 other-target hollows; plus Axe of the Slayer's both line.

## Locked Values

- Condition types `'patrolSpaceEmpty'` / `'patrolSpaceOccupied'` via `PATROL_SPACE_EMPTY_CONDITION_TYPE` / `PATROL_SPACE_OCCUPIED_CONDITION_TYPE`; `value` ∈ `CITY_SPACE_NAMES`.
- `describeFailedCondition` strings, verbatim as in Packet-specific.
- `PATROL_BOTH_CARDS` (1 card), verbatim.
- `ATTACK_RESTRICTION_CLAUSE_PATTERN` = `/,?\s*usable only (?:against|to fight) (.+?)\.?$/i`.
- Ledger `KNOWN_CONDITIONS['patrol'] = 'patrolSpaceEmpty'`, classified by hook (Packet-specific).
- Synergy: a failed-Patrol-condition hook is not a countable clause on that play; Axe of the Slayer = 1 assembled / 0 misses with instinct, 1 miss without.
- The §Card Map tokens, verbatim.

---

## Scope (In)

- **A) Conditions.** `hero/heroConditions.evaluate.ts`: the two evaluate cases and describe cases (+ test: empty, occupied, removed space in a 3-space City, a Bank Villain with a captured Bystander is occupied, an unknown value is false, and the runtime pin). `hero/heroEffects.execute.ts`: `countSynergyConditions` excludes both types, and a hook whose Patrol condition fails is not a countable clause on that play.
- **B) Parser.** `setup/heroAbility.setup.ts`: Patrol line recognition and branch build (consumed at own index), honest-partial / other-target hollows, `PATROL_BOTH_CARDS` fusion, the widened `ATTACK_RESTRICTION_CLAUSE_PATTERN`.
- **C) Markers + data.** `inputs/hero-ability-markers.json` §Card Map rows and the Blade `_deferred` lift (the script itself is unchanged); regenerate `data/cards/mdns.json`, `data/cards/ssw2.json`.
- **D) Tests.**
  - `setup/heroAbility.setup.test.ts`: per-line hook shape for every §Card Map row class (named single-branch, two-branch, both fusion, honest-partial, other-target); **migrate** the `:2058` fail-closed list — remove the Seal the Rift line and assert in a new case that its occupied hook carries `attackRestriction {targets:['bridge']}` under `patrolSpaceOccupied` (intentional behavior change, D-24832).
  - Setup: Axe of the Slayer's four hooks share no `effects` / `conditions` references across hooks or card instances (`assert.notStrictEqual`).
  - New `hero/heroPatrol.test.ts`: play-time behavior on hooks built by `buildHeroAbilityHooks` from the regenerated `data/cards/mdns.json` / `ssw2.json` (never hand-written hooks, so a marker or parser drift fails the test) — Bridge Between Dimensions draws only with the Bridge empty; Axe of the Slayer gives +2 recruit (empty) / +2 attack (occupied) / both with another instinct Hero in either state, and records 1 assembled / 0 missed Synergy clauses with instinct and 1 miss without (each asserted with the Streets empty and occupied); Seal the Rift draws 2 (empty) or adds a Bridge-restricted +5 (occupied); Feeding Grounds parks the optional KO only when the Streets are empty; a removed Bridge (City length 3) fires neither branch and logs "there is no Bridge in the City"; Seek the Empty Mind grants nothing and records a `patrol-your-discard-pile` hollow; Lord of Dragons occupied records `patrol-the-rooftops`.
- **E) Ledger + records.** `scripts/hero-mechanic-ledger.mjs` `KNOWN_CONDITIONS` + by-hook `patrol` classification; `scripts/coverage/mechanic-provenance.json` row; `docs/ai/coverage/live-verify.json` pending rows.
- **F) Feeds.** Regenerate `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.{json,csv}`, `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json` (if `sim:coverage --check` flags) and `apps/dashboard/src/data/in-play-hollow-baseline.json` (if its gate flags), and re-pin the dashboard `totalObs` test.

## Out of Scope

- **Other-target Patrol** (any / two adjacent / every city space, Escape Pile, discard pile, Victory Pile) and the three unmodelled named branches: one named follow-up WP. They stay honest hollows.
- **Villain and bystander Patrol lines** (ssw2 Fight / Escape / Master Strike / rescue lines; 5 lines): the villain-side follow-up. Unchanged here.
- The D-2502 board-keyword Patrol (+1 fight cost). Unchanged.
- A client badge or board highlight for patrolled spaces. The existing blocked-line log is the surface.
- The Scalded by Sunlight Sunlight hollow (tracked separately, D-24598).

## Files Expected to Change

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` (+ `heroConditions.evaluate.test.ts`) — modified
- `packages/game-engine/src/hero/heroEffects.execute.ts` — modified (`countSynergyConditions` + failed-Patrol clause rule)
- `packages/game-engine/src/setup/heroAbility.setup.ts` (+ `setup/heroAbility.setup.test.ts`) — modified
- `packages/game-engine/src/hero/heroPatrol.test.ts` — **new**
- `scripts/convert-cards/inputs/hero-ability-markers.json` — modified
- `scripts/hero-mechanic-ledger.mjs`, `scripts/coverage/mechanic-provenance.json`, `docs/ai/coverage/live-verify.json` — modified
- `data/cards/mdns.json`, `data/cards/ssw2.json` — regenerated
- `data/metadata/effect-implementation-index.json`, `data/metadata/card-mechanics.json`, `docs/ai/coverage/hero-mechanic-ledger.json`, `docs/ai/coverage/hero-mechanic-ledger.csv`, `docs/ai/coverage/runtime-observed-hollows.json` — regenerated
- `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json` — regenerated only if their gates flag
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — `totalObs` re-pin
- Governance: `docs/ai/DECISIONS.md` (D-24832), `docs/ai/STATUS.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED), `WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

Six engine code/test files plus the marker map, ledger script and two records, two regenerated card files and the feeds.

## Contract

- The Locked Values.
- `patrolSpaceEmpty` / `patrolSpaceOccupied` are the shared City-emptiness conditions the villain-side and other-target follow-ups reuse.

## Vision Alignment

**Vision clauses touched:** §1 Rules Authenticity (these heroes are over-powered today), §2 Content Authenticity and §10 Content as Data (card-data markers; printed text unchanged), §22 Deterministic & Reproducible Evaluation, §23 / §24 (ranked fairness, replay-verified integrity), NG-1 (no pay-to-win; untouched).
**Conflict assertion:** No conflict: this WP preserves all touched clauses.
**Non-Goal proximity:** not crossed.
**Determinism (§22):** pure reads of `G.city`, no randomness; setup-only change, so stored matches replay identically.

## Funding Surface Gate

§20 **N/A** — engine + card-data rules change; no UI, no user-visible copy beyond the existing blocked-log line, and no funding affordance or channel (WP-097 §A/§B/§C) is touched.

## API Catalog

§21 **N/A** — no `apps/server` HTTP endpoint added, changed or removed, and no `Library-only` catalog function touched (`docs/ai/REFERENCE/api-endpoints.md` lists none of the edited engine functions).

---

## Acceptance Criteria

1. Each condition evaluates per the rule for empty, occupied, removed (City length < index + 1) and unknown values, and never throws.
2. Every §Card Map line parses to its locked hook shape (setup test), including the Axe of the Slayer cross hooks and Seal the Rift's restricted +5.
3. At play, a gated branch fires only under its condition: Bridge Between Dimensions, Axe of the Slayer (empty / occupied / both with instinct), Seal the Rift (both branches), Feeding Grounds and the removed-space case behave as in §Scope D.
4. Every honest-hollow line grants nothing and records its `patrol-*` slug when its gate (if any) passes.
5. The two types are in neither `WAIT_AND_SEE` nor `SEQUENCE_GATE`, have evaluate and describe cases (runtime pin), and are excluded from the Synergy clause count; Axe of the Slayer records 1 assembled / 0 missed clauses with instinct and 1 miss without. The ledger reads `patrol` = `condition` only for heroes with a Patrol-conditioned hook (Corvus Glaive, Beast stay `unsupported`).
6. No `HERO_KEYWORDS` / handler count changes; no UIState field.
7. `cards:check`, `effect-index:check`, `mechanics:metadata:check`, `ledger:heroes:check`, `sim:runtime-observed:check` and `sim:coverage --check` exit 0; in the regenerated runtime-observed feed, `patrol-*` hits remain only for the honest-hollow lines.
8. `pnpm -r build` → 0; `pnpm -r --no-bail test` → 0 fail (dashboard `totalObs` pin included); core oracles unchanged (the `finalStateHash` sentinel in `game.test.ts`, run by Verification step 4).

## Verification Steps

1. `pnpm -r build` → 0.
2. `node scripts/convert-cards/apply-hero-ability-markers.mjs` → the §Card Map rows update; re-run → 0 updates; `--validate` → 0.
3. Regenerate in pipeline order (`docs/03-DATA-PIPELINE.md` §1; markers already applied by step 2): `pnpm ledger:heroes && pnpm effect-index && pnpm mechanics:metadata && pnpm sim:runtime-observed`, then `pnpm sim:coverage --check` (only if it flags: `pnpm sim:coverage --update-baseline`), then re-pin the dashboard `totalObs` from the regenerated feed. Then `pnpm cards:check && pnpm cards:count-markers:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm ledger:heroes:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check && pnpm ledger:numbers:check` → all 0.
4. `pnpm --filter @legendary-arena/game-engine test` → 0 fail.
5. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/dashboard typecheck` → 0 (the WP touches dashboard files).
5a. AC-5's ledger claim (`ledger:heroes:check` only tests freshness):
    `node -e "const l=require('./docs/ai/coverage/hero-mechanic-ledger.json');for(const id of ['ssw2/corvus-glaive','ssw2/beast','mdns/wong-master-of-the-mystic-arts']){const r=l.rows.find(x=>x.extId===id&&x.mechanic==='patrol');console.log(id,r&&r.status)}"`
    → `ssw2/corvus-glaive unsupported`, `ssw2/beast unsupported`, `mdns/wong-master-of-the-mystic-arts condition`.
5b. AC-7's runtime claim: `node -e "const f=require('./docs/ai/coverage/runtime-observed-hollows.json');console.log(JSON.stringify(f).match(/patrol-[a-z-]+/g)?.filter((v,i,a)=>a.indexOf(v)===i))"` → expected: no `patrol-the-bridge` and no `patrol-the-streets` (every Bridge and Streets Patrol line is fully modelled); the Sewers, Rooftops and other-target slugs may remain (baseline prints all five).
6. `git diff --name-only` ⊆ Files Expected to Change; revert `lagn-v1.json` CRLF churn.

## Definition of Done

- [ ] All ACs pass; the diff is allowlist-only.
- [ ] D-24832 Active: the two conditions and their rule, the split / both shape, the honest-hollow posture, the restriction widen, the Synergy exclusion and failed-Patrol clause rule, the accepted Axe blocked-log noise, the by-hook ledger classification (mixed heroes read `condition`), the two condition-type constants, the amendment of D-24652 §4 for Seal the Rift, the distinction from D-2502, and the replay note.
- [ ] STATUS; WORK_INDEX `[x]`; EC_INDEX Done; mindmap `✅`; `roadmap:counts:check` 0.
- [ ] Two-commit topology (`EC-919:` then `SPEC:`).
- [ ] **D-24026 live-verify (post-merge):** on an operator match created after the deploy with Wong and Elsa Bloodstone, Bridge Between Dimensions draws with the Bridge empty and logs "… ability did not activate — there's a card in the Bridge." with a Villain there; Axe of the Slayer gives +2 recruit with the Streets empty and +2 attack otherwise. Recorded as a STATUS flip.

## Reserved Decision (lands at execution)

**D-24832 — hero-patrol-keyword.** It locks everything listed in the DoD item above.

---

## Lint Gate Self-Review (00.3)

Independent subagent runs. **Run 1: FAIL** (4 text-only items, fixed): §2 the engine-wide scope bullet understated the file set; §13 step 3 named no regen commands and step 5a was a description, not a command; §20 / §21 justifications restated the conclusion. Advisories applied: §17 cites §2 / §10 / §22 with the canonical no-conflict line; AC-7 gained step 5b; AC-8 names the `finalStateHash` sentinel; EC Before Starting gained a scope-lock line. **Run 2: PASS** (2026-11-10).

| § | Verdict |
|---|---|
| §1 Structure | PASS — all ten sections present and non-empty; Out of Scope has 5 items |
| §2 Constraints | PASS — engine-wide, session protocol, packet-specific, Locked Values |
| §3 Assumes | PASS — dependencies, anchors, external state, BLOCKED clause |
| §4 Context | PASS — rules lines, D-entries, memory refs |
| §5 Files | PASS — every file marked new / modified / regenerated; size justified by regenerated feeds |
| §6 Naming | PASS — slugs and paths verified against data and source |
| §7 Dependencies | PASS — no new packages |
| §8 Boundaries | PASS — engine-only pure reads; no UIState, registry or server edge |
| §9 Windows | PASS — pnpm / node commands only |
| §10 Env vars | N/A — none introduced or read |
| §11 Auth | N/A — no auth surface |
| §12 Tests | PASS — `node:test` `.test.ts`, repo JSON only |
| §13 Verification | PASS — exact commands with expected output (steps 1-6, 5a, 5b) |
| §14 ACs | PASS — 8 binary ACs |
| §15 / §15.1 / §15.2 | PASS — DoD complete; live-verify on a new match; Risk Tier MEDIUM, EC verbatim |
| §16 Code style | PASS — 00.6 required, nothing prescribed violates it |
| §17 Vision | PASS — §1, §2, §10, §22, §23, §24, NG-1; no conflict |
| §18 Prose-vs-grep | N/A — no forbidden-token grep step |
| §19 Bridge-vs-HEAD | N/A — commit-time rule |
| §20 Funding | N/A, justified |
| §21 API catalog | N/A, justified (both halves of §21.1) |
| EC-TEMPLATE | PASS — 69 content lines (cap 100); Risk Tier verbatim; Locked Values match the WP |

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent): NOT READY.** Anchors, rules fidelity (empty ⇔ `G.city[i] === null`; Locations / Haunt / Fortify places are not City spaces; a removed space fails both), the branch-body probes and the cross-hook shape all held. Five blocking findings, all fixed in this revision:
- **PS-1:** Axe of the Slayer's cross hooks would log a guaranteed Synergy miss → a hook whose Patrol condition fails is not a countable clause (1 assembled / 0 misses with instinct, 1 miss without).
- **PS-2:** `KNOWN_CONDITIONS['patrol']` by name would read Corvus Glaive / Beast as `condition` → classified by hook.
- **PS-3:** Fateful Bridge's token is core Spider-Man's `[keyword:reveal:2]` (identical descriptor) → no validator change; the marker script leaves the allowlist.
- **PS-4:** allowlist missing `NUMBER-LEDGER.md`, `live-verify.json` and named feeds (WP-866 precedent) → added, plus `mechanic-provenance.json`; `cards:count-markers:check` and `ledger:numbers:check` added.
- **PS-5:** 29 Patrol hero lines (ssw2 20), not 28.
- RS applied: the real blocked-log wording, the describe strings for plural space names, Axe blocked-log noise accepted, trailing markers stripped before the split. RS noted (not this WP): the dashboard in-play % gauge cannot credit any folded family (`patrol-the-*` runtime keys never match the ledger's folded `patrol`).

**Pre-flight round 2: READY TO EXECUTE.** All five fixes consistent across WP, EC and both index rows; three cosmetic RS items applied (file-list note, Captain Britain in the mixed-hero list, WP-851 in the WORK_INDEX deps). No scaffold re-run needed (the fixes add no parser tightening).

**Copilot (01.7), round 1 (independent subagent): RISK → HOLD.** Determinism / replay, layer boundary and the no-UIState claim held (`uiState.build.ts:658`, `sequenceTeacher.logic.ts:150`, simulation / arena-client / preplan read no hook conditions). Findings, all fixed in place:
- **Modes 4 / 10 / 21:** `HeroCondition.type` is a bare string with a `false` default → exported `PATROL_SPACE_*_CONDITION_TYPE` constants used at every site.
- **Mode 5:** hook construction unstated → omit-when-empty + `conditional` keyword rule locked.
- **Mode 11:** behavior tests now build from `buildHeroAbilityHooks` over the regenerated data; a ledger-row verification step (5a); the dashboard `typecheck` gate.
- **Mode 17:** no-aliasing rule + an Axe `notStrictEqual` assertion.
- **Mode 20:** D-24832 names its amendment of D-24652 §4 (Seal the Rift).
- **Mode 26:** failed-Patrol clause mechanism locked (direct `evaluateCondition`, not `findFailedCondition`); the per-hook ledger check precedes the by-name return.
- **Mode 27:** the EC carries the 12 Card Map tokens verbatim.

**Copilot round 2: PASS — CONFIRM** (2026-11-10). Pre-flight not re-run: no allowlist or scope change.
