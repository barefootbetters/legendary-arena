# WP-841 — co2e variable-Attack passives: Baron Strucker, Paibok, Super-Skrull and Hydro-Man fight for what they print (Game Engine + card data)

**Status:** Draft 2026-10-25 — pre-flight READY TO EXECUTE (01.4, after PS-1..3 + RS-1..7); copilot (01.7) RISK → CONFIRM (round 2); lint (00.3) PASS (EC-879; **D-24774** reserved, #3014). See §Gate Record.
**Primary Layer:** Game Engine (+ one card-data marker overlay and its input map)
**Dependencies:** none hard. Everything this packet builds on is on `main`. Soft ordering: WP-838 (drafted on `main` in #3012, not executed) edits the same overlay script, requirement map, setup builder file, `types.ts`, `buildInitialGameState.ts` and `economy.resolve.ts` dynamic branch (its `G.villainAttackPerCaptured` table). Whichever of the two lands second rebases its appends and keeps the other's (EC-879 and EC-876 Before Starting each name the merge points). WP-835 marks Hydro-Man's and Super-Skrull's `Fight:` lines and WP-838 marks Baron Strucker's; those are different lines on the same cards and nothing here reads them.
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It adds an omit-when-empty `G` field and a term in the fight-cost authority, a scoring-adjacent competitive surface (lightweight lane §6 excludes it).
**Arc:** co2e villain fidelity follow-up. WP-835 §Out of Scope names these four passives as owned by no WP in WP-835..840.

> Baseline: `origin/main` at `b61b9ec1` (WP-831 and WP-832 merged; the reserve commit #3014 and the WP-835..840 drafts #3012 landed). Re-read line anchors and test totals at execution.

---

## Goal

As a player facing the Core 2nd-edition HYDRA, Skrulls and Sinister Syndicate groups, I want Baron Strucker, Paibok the Power Skrull, Super-Skrull and Hydro-Man to cost what their cards print, so that the fights are as hard as the tabletop game and the City tile shows the real number.

Today all four fight at their flat printed base (6, 5, 2 and 4). After this session:

- **Baron Strucker, Supreme Hydra** (`co2e/hydra`): +1 Attack for each **other** HYDRA Villain in the City and/or the Escape Pile.
- **Paibok the Power Skrull** and **Super-Skrull** (`co2e/skulls`): +1 Attack for each Hero Class among the Heroes in the HQ (0 to 5).
- **Hydro-Man** (`co2e/sinister-syndicate`): +2 Attack while he is in the Sewers or on the Bridge.

The term is added inside `resolveFightCost`, so the fight gate, the bot's legal moves, the seat-choice bot, Pure Fury targeting and the City `fightCost` projection all move together with no caller change.

## User-Visible Impact

- Strucker gets harder as HYDRA Villains pile up in the City and Escape Pile; Paibok and Super-Skrull track the HQ's colours as it refills; Hydro-Man costs 6 at the two ends of the City and 4 in between.
- The City tile already shows a `Fight N` badge when the projected cost differs from the printed one (WP-750), so players see the real cost with no client change.

## Affected cards (closed list, verified in `data/cards/co2e.json` on the baseline)

| Card (2 copies each) | Group | `vAttack` | Printed passive line (verbatim) | Marker appended |
|---|---|---|---|---|
| Baron Strucker, Supreme Hydra | `hydra` | `6+` | `Baron Strucker gets +1[icon:attack] for each other HYDRA Villain in the city and/or Escape Pile.` | `[variable-attack:per-other-hydra-villain:1]` |
| Paibok the Power Skrull | `skulls` | `5+` | `Paibok gets +1[icon:attack] for each Hero Class among Heroes in the HQ.` | `[variable-attack:per-hq-hero-class:1]` |
| Super-Skrull | `skulls` | `2+` | `Super-Skrull gets +1[icon:attack] for each Hero Class among Heroes in the HQ.` | `[variable-attack:per-hq-hero-class:1]` |
| Hydro-Man | `sinister-syndicate` | `4+` | `Hydro-Man gets +2[icon:attack] in the Sewers and Bridge.` | `[variable-attack:flat:2@sewers+bridge]` |

Instance ids: `co2e-villain-hydra-baron-strucker-supreme-hydra-00` / `-01`, `co2e-villain-skulls-paibok-the-power-skrull-00` / `-01`, `co2e-villain-skulls-super-skrull-00` / `-01`, `co2e-villain-sinister-syndicate-hydro-man-00` / `-01` (the group slug `skulls` is the data's own spelling; WP-835 leaves it alone).

---

## Assumes

1. **Rules text.** `docs/legendary-universal-rules-v23.md`:
   - L2742-2752 (Class vs. "Colors"): "Hero/Ally Classes are" the five class icons; Officers, Sidekicks, Agents / Troopers, HYDRA Operatives / Soldiers, Madame HYDRA and New Recruits "have no Class icon, and therefore no Class. Team icons aren't Hero Classes."
   - L2774-2777 (Divided Cards): outside play a Divided card "counts as all its Hero Classes".
   - L1599-1602 (HYDRA Level) and the S.H.I.E.L.D. Level rule the engine encodes in `economy/shieldMembership.ts` L1-19 (D-24493): a card is S.H.I.E.L.D. / HYDRA by its team icon or by the word in its card name or Villain Group name. The rulebook gives no separate definition of "HYDRA Villain" (Operator fork F1).
   - L2923 ("Henchmen Are Villains/Adversaries") and L1146-1148 ("Heroes that were turned into Villains" have no Villain Group).
2. **Fight-cost authority** (`packages/game-engine/src/economy/economy.resolve.ts`): `resolveFightCost(G, villainCardId, fightingPlayerId?)` (L94) sums `resolveBaseFightCost + darkPortalVillainBonus + bystanderVillainAttackBonus + villainBloodFrenzyBonus + villainAbominationBonus` (L109-114), then subtracts `cityFightCostReduction` with a 0 floor. `resolveBaseFightCost` (L281) returns `fightCostBase + Σ captured Hero cost` for a `dynamic` villain (L326-338) (plus WP-838's early return and `villainCapturedCountBonus` term, if it landed first). Production callers, none of which change: `moves/fightVillain.ts:191`, `simulation/ai.legalMoves.ts:1116`, `simulation/ai.seatChoice.ts:285`, `ui/uiState.build.ts:896`, `hero/heroEffects.execute.ts:4914`.
3. **`N+` parse.** `economy/economy.logic.ts` `parseCardStatValue` strips a trailing `+`; all four cards are `fightCostMode: 'dynamic'` with `fightCostBase` 6 / 5 / 2 / 4.
4. **Sibling-table precedent (WP-817 / D-24750).** `setup/villainDefeatRequirement.setup.ts` `buildVillainFightDiscardCosts` (L332) reads the selected groups' ability lines, parses the first valid marker on any line, and fans one fresh object out per copy id through `villainCardInstanceExtIds` (`villainDeck/villainDeck.setup.ts:504`). It is called at `setup/buildInitialGameState.ts:443` with `villainBuildConfig` and spread onto `G` only when non-empty (L902-905). `types.ts:2858` declares `villainFightDiscardCosts?`. The overlay is `scripts/convert-cards/apply-defeat-requirement-markers.mjs` with the optional `fightDiscardCosts` list in `scripts/convert-cards/inputs/villain-defeat-requirements.json`; its final console line is L500.
5. **Fight-cost term precedent (WP-815 / D-24747).** `economy/abomination.logic.ts` holds its kind union, array and term functions in one logic file and `types.ts` type-imports the union (no new `.types.ts` contract file). It reads the City index with `G.city?.indexOf(id) ?? -1` and HQ slots from `G.hq`.
6. **City and HQ.** `board/city.types.ts:42` `CityZone = CitySpace[]` (WP-831: 1 to 6 spaces); `HqZone` is a 5-tuple of `CardExtId | null`. `board/citySpaceNames.ts` `citySpaceNameForIndex(index)` returns `sewers` (0) … `bridge` (4) and `undefined` for any other index, including a sixth space (WP-831 / D-24764: names stay on engine indices). `G.escapedPile: CardExtId[]` (`types.ts:2633`) holds escaped Villains plus any carried Bystanders and captured Heroes.
7. **Card identity at fight time.** `G.villainDeckCardTypes: Record<CardExtId, RevealedCardType>` (`types.ts:2510`; `'villain' | 'henchman' | 'bystander' | 'scheme-twist' | 'mastermind-strike'`) types every Villain-Deck card for the whole match, so an escaped Villain keeps its type. Villain ids are `{set}-villain-{groupSlug}-{cardSlug}-NN` (L515), henchman ids `henchman-{groupSlug}-NN` (L253); both slugs are derived from the printed names. Converted cards (Killbot Bystanders, Secret Invasion Skrull Heroes, Brainwashed Officers) carry a `G.convertedVillainOrigins` entry (`types.ts:2645`).
8. **HYDRA corpus scan** (all `data/cards/*.json`): the villain / henchman cards whose card name, card slug, Villain Group name or group slug contains "hydra" are: co2e `hydra` (Strucker, Endless Armies of HYDRA, HYDRA Kidnappers, Viper); core `hydra` (Endless Armies, HYDRA Kidnappers, Supreme HYDRA, Viper); msp1 `hydra` (Endless Armies, HYDRA Motorcycle Squad, Arnim Zola, HYDRA Tank) and henchmen `hydra-pilots`, `hydra-spies`; rvlt henchman `hydra-base`; shld `a-i-m-hydra-offshoot` (4) and `hydra-elite` (4); amwp `hydra-arms-dealer`; ssw1 `zombie-madame-hydra`; wtif `red-skull-hydra-occultist`, `arnim-zola-hydra-scientist`, `demon-champion-of-hydra`. No villain or henchman slug contains "hydra" as part of another word ("hydro-man" does not match). co2e has no HYDRA henchmen.
9. **Hero Class reads.** `hero/splitCard.logic.ts:91` `offPlayCardTraits(G, cardId)` returns a card's `{ heroClass, heroClass2? }` off play, a Divided card's two faces as one union entry. `heroClass` is `null` for Officers / Sidekicks (the `typeof === 'string'` guard in `hero/heroConditions.evaluate.ts:629-635` skips it). `content/content.schemas.ts:67` `HERO_CLASSES` is the five class slugs and imports only types.
10. **No hashed fixture includes an affected card.** The sentinel is `core/dr-doom`; `PRE_WP080` is synthetic. The only test references to the three groups are scenario-key strings (`scoring/parScoring.keys.test.ts:122`, `simulation/par.storage.test.ts:201`, `apps/server/src/legends/gauntletTruth.logic.test.ts:551`). `data/par/**` references none of them.
11. **Feeds.** No `[effect:X]` token is added, so `ledger:villains`, `effect-index` and `mechanics:metadata` do not change: the ledger is card-level and classifies by `[effect:]` markers only (`scripts/villain-mechanic-ledger.mjs` L43, L157). Strucker, Super-Skrull and Hydro-Man stay `(unmarked)` (ledger L124 / L149 / L136) until WP-838 / WP-835 mark their `Fight:` lines; Paibok stays `executable` (L141). No `scripts/coverage/subsystem-coverage.json` entry is added, because it would flip the three `(unmarked)` rows to `subsystem` and hide their open `Fight:` lines (the WP-815 precedent). `cards:check` excludes `co2e` (`scripts/check-card-data-regen.mjs:51`). The sim feeds sweep only core (`scripts/runtime-observed-hollows.mjs`) or parse heroes (`sim:coverage`).
12. **Display.** Villain ability text is not projected to the play client (`setup/buildCardDisplayData.ts` builds `abilityText` for Heroes only, L418-462), so the marker reaches the play board nowhere. On the cards site the line renders exactly like the existing `[effect:]` and `[discard-to-fight:]` markers (unchanged by this packet).
13. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.
14. **Helpers the Locked Values and tests lean on.** `setup/villainAbility.setup.ts` private `parseCityGateSuffix` (L325) and `isCitySpaceName` (L347), the copy source and pattern for the space parser; `board/citySpaceNames.ts` exports `CITY_SPACE_NAMES` (L24) and `CitySpaceName` (L33); `economy/economy.logic.ts` `addFightCostReduction` (L1201), used by T8; `G.villainAttachedHeroes: Record<CardExtId, CardExtId[]>` (`types.ts:2616`), used by T9.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why markers, not a sentence scan.** WP-815 recognised co2e Abomination's English sentence at setup. That works for one card. These passives share their wording with other cards whose numbers or scope differ: the Mastermind passives co2e Epic Red Skull ("+2 for each HYDRA Villain in the city and/or Escape Pile", no "other"), shld Hydra High Council Viper ("+1 for each Hydra Villain in the city") and cvwr Ragnarok ("+2 for each Hero Class among Heroes in the HQ"), and the Sewers / Rooftops / Bridge "wolf form" / "giant-size" villains. A sentence regex would silently widen to them. A curated per-card marker pins exact set / group / card, the same authoring path as WP-292 / WP-817 (and WP-838's `[attack-per-captured:]`), and lets a later packet add those cards as data rows.
- **Why one table with three sources.** All four lines are "+N Attack, read at fight time" with a different count. One `G.villainVariableAttack` table and one term keep the authority single; each source is one small counting helper. A location gate (`@<space>[+<space>…]`, the D-24295 grammar) makes Hydro-Man's line `flat:2` gated to two spaces, and lets a future per-count line carry a gate too.
- **Why the dynamic captured-cost sum is replaced.** The `+` on these cards marks the printed passive, not a captured-Hero cost. Without the early return, a Hero captured by one of them (another card's effect) would add its cost on top of the printed rule. WP-838 makes the same call for its table (D-24771 as drafted). Operator fork F2.
- **Why the types live in the logic file.** The WP-815 precedent: the source union, its array and the entry interface sit in `economy/villainVariableAttack.logic.ts`. `types.ts` type-imports `VillainVariableAttack`; the setup builder type-imports it and value-imports `VILLAIN_VARIABLE_ATTACK_SOURCES` (plus `CITY_SPACE_NAMES` from `board/citySpaceNames.js`), all acyclic. No `.types.ts` contract file changes, and this packet does not collide with WP-838's edits to `rules/villainAbility.types.ts`.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (Villain Group shape: `cards`, `copies`, `abilities`, `vAttack`) and §5 (Ability Text Markup: the display tokens `[keyword:]`, `[icon:]`, `[hc:]`, `[team:]`, `[rule:]`). 00.2 does not document engine markers and is unchanged: `[effect:]`, `[require-to-defeat:]` and `[discard-to-fight:]` are documented only in their overlay maps' `_doc` / `_notes`, and `[variable-attack:]` joins them in the `villain-defeat-requirements.json` `_doc`.
- **Input data traceability.** `docs/03.1-DATA-SOURCES.md` §Setup-Time Derived Data is not updated, matching the WP-760 / WP-815 / WP-817 precedent (a known NO).
- co2e Epic Red Skull's own setup line "Always Leads: Any 'HYDRA' Villain Group" is printed support for reading HYDRA by name (F1).
- `docs/ai/ARCHITECTURE.md` §Zone & Pile Structure (zones hold `CardExtId` only) and §Persistence Boundaries (`G` is runtime-only; the new table is a setup snapshot).
- `docs/ai/DECISIONS.md`: scan D-24076, D-24750, D-24747, D-24589, D-24295, D-24493, D-24355, D-24764, D-24372 before coding.
- User memory: `reference_hashed_g_field_dual_repin`, `reference_setup_hook_change_replay_compat`, `reference_engine_tests_never_typechecked`, `reference_fightvillain_defeats_henchmen_too`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24774) before coding. One WP per session.

**Packet-specific:**
- **One authority.** The term lives only in `resolveFightCost`, added to `costBeforeReduction` **before** the reduction and the 0 floor. No caller changes. The Mastermind cost is untouched.
- **Read at fight time.** The term reads the City, the Escape Pile and the HQ on every call; nothing is cached in `G`.
- **Markers only.** The setup parser reads `[variable-attack:…]`; no engine code reads English. Never run `convert-cards-v15.mjs`.
- **Omit-when-empty.** `G.villainVariableAttack` is spread onto `G` only when the builder returns a non-empty map, so every other match is byte-identical.
- **Not a `BoardKeyword`, not a hook.** The passive is a cost modifier (the Blood Frenzy / Abomination precedent); `buildVillainAbilityHooks` is not touched.

## Locked Values

- In `economy/villainVariableAttack.logic.ts` (new):
  - `export type VillainVariableAttackSource = 'flat' | 'per-other-hydra-villain' | 'per-hq-hero-class';` and `export const VILLAIN_VARIABLE_ATTACK_SOURCES: readonly VillainVariableAttackSource[] = ['flat', 'per-other-hydra-villain', 'per-hq-hero-class'];`
  - `export interface VillainVariableAttack { source: VillainVariableAttackSource; attackPerUnit: number; requireCitySpaces?: CitySpaceName[]; }`
  - Membership tests against `HERO_CLASSES`, `VILLAIN_VARIABLE_ATTACK_SOURCES` and `CITY_SPACE_NAMES` are explicit `for…of` equality loops (the `isCitySpaceName` pattern, `villainAbility.setup.ts:347`), never `.includes()` with a cast. The `HERO_CLASSES` import (its first runtime consumer outside author-facing validation, D-3303) carries a one-line `// why:`.
  - `isHydraVillainCard(G, cardId): boolean` — true iff `G.convertedVillainOrigins?.[cardId] === undefined`, `G.villainDeckCardTypes?.[cardId]` is `'villain'` or `'henchman'`, and `cardId.toLowerCase().includes('hydra')`.
  - `countOtherHydraVillains(G, villainCardId): number` — over every non-null `G.city` entry then every `G.escapedPile` entry, counts ids `!== villainCardId` for which `isHydraVillainCard` holds (each id once; a missing `city` / `escapedPile` reads as empty).
  - `countHqHeroClasses(G): number` — the size of the set of `heroClass` / `heroClass2` strings that are members of `HERO_CLASSES`, read through `offPlayCardTraits` over every non-null `G.hq` slot (a missing `hq` reads as empty).
  - `villainVariableAttackBonus(G, villainCardId): number`:
    1. `entry = G.villainVariableAttack?.[villainCardId]`; absent → 0;
    2. if `entry.requireCitySpaces` is present: `cityIndex = G.city?.indexOf(villainCardId) ?? -1`; `spaceName = citySpaceNameForIndex(cityIndex)`; `undefined` or not in the list → 0 (fails closed off the named spaces, including a sixth City space and outside the City);
    3. `flat` → `attackPerUnit`; `per-other-hydra-villain` → `attackPerUnit × countOtherHydraVillains`; `per-hq-hero-class` → `attackPerUnit × countHqHeroClasses`.
- Marker grammar `[variable-attack:<source>:<N>[@<space>[+<space>…]]]`: split the value on `@` (at most one `@`, else no entry); the left side is exactly `<source>:<N>` (two `:` parts); `source` ∈ `VILLAIN_VARIABLE_ATTACK_SOURCES`; `N` matches `^[1-9][0-9]*$`; each `+`-separated space is a member of `CITY_SPACE_NAMES` and the list is non-empty with no repeats; `flat` **requires** a gate. Anything else → no entry (inert, never throws). The first valid marker on any line of the card wins.
- Setup, in `setup/villainDefeatRequirement.setup.ts`: `export function parseVariableAttackLine(abilityLine: string): VillainVariableAttack | null` and `export function buildVillainVariableAttack(registry: unknown, matchConfig: MatchSetupConfig): Record<CardExtId, VillainVariableAttack>` — the `buildVillainFightDiscardCosts` walk copied (the existing builders are not refactored), a fresh object and a fresh `requireCitySpaces` array per copy id. An ungated entry **omits** `requireCitySpaces` (never `requireCitySpaces: undefined`; the engine has `exactOptionalPropertyTypes`, and engine test files are not type-checked). The space parser is a local copy of `villainAbility.setup.ts`'s private `parseCityGateSuffix` plus the no-repeat check (second copy; the code-style rule abstracts at the third).
- `types.ts`: `villainVariableAttack?: Record<CardExtId, VillainVariableAttack>` (type import), placed beside `villainFightDiscardCosts`, with the omit-when-empty `// why:`.
- Wiring: `buildInitialGameState.ts` calls `buildVillainVariableAttack(registry as unknown, villainBuildConfig)` beside `buildVillainFightDiscardCosts` and spreads `...(Object.keys(villainVariableAttack).length > 0 ? { villainVariableAttack } : {})` beside the `villainFightDiscardCosts` spread.
- `economy.resolve.ts`:
  - `costBeforeReduction` gains `+ villainVariableAttackBonus(G, villainCardId)` as its last term.
  - In `resolveBaseFightCost`'s dynamic branch, before the captured-Hero sum: `if (G.villainVariableAttack?.[villainCardId] !== undefined) { return base; }`.
- Overlay (`apply-defeat-requirement-markers.mjs`): optional list `variableAttack` (absent = empty) of `{ set, group, card, source, attackPerUnit, spaces? }`. Validated: set / group / card strings; `source` in the hand-synced `['flat', 'per-other-hydra-villain', 'per-hq-hero-class']`; `attackPerUnit` a positive integer; `spaces` an array of the hand-synced five names, non-empty, no repeats, required for `flat`, optional otherwise. Locator: the single ability line whose lower-cased text contains both ` gets +` and `[icon:attack]` (0 or > 1 → loud-fail). Appends exactly `` ` [variable-attack:${source}:${attackPerUnit}${spaces ? '@' + spaces.join('+') : ''}]` `` (the gate sits inside the brackets: ` [variable-attack:flat:2@sewers+bridge]`), idempotently. `--propose` lists these rows. Every loud-fail is a full sentence naming the entry. Start banner (~L467): `🏷  Overlaying [require-to-defeat:], [discard-to-fight:] and [variable-attack:] markers onto curated villain restriction lines...`; the header doc-comment gains a `variableAttack` paragraph (grammar, locator, loud-fails). Final line: `` `\nDone. ${S} set(s) processed, ${R} new [require-to-defeat:] marker(s), ${F} new [discard-to-fight:] marker(s) and ${V} new [variable-attack:] marker(s) appended.` `` (if WP-838 landed first, its `[attack-per-captured:]` count and banner name stay, before the new ones, so both name four markers; its header paragraph stays beside the new one).
- Map rows (`villain-defeat-requirements.json` `variableAttack`, in this order):
  - `{ "set": "co2e", "group": "hydra", "card": "baron-strucker-supreme-hydra", "source": "per-other-hydra-villain", "attackPerUnit": 1 }`
  - `{ "set": "co2e", "group": "skulls", "card": "paibok-the-power-skrull", "source": "per-hq-hero-class", "attackPerUnit": 1 }`
  - `{ "set": "co2e", "group": "skulls", "card": "super-skrull", "source": "per-hq-hero-class", "attackPerUnit": 1 }`
  - `{ "set": "co2e", "group": "sinister-syndicate", "card": "hydro-man", "source": "flat", "attackPerUnit": 2, "spaces": ["sewers", "bridge"] }`
  - and the map's `_doc` gains one sentence describing `variableAttack` (WP-841 / D-24774).

---

## Scope (In)

- **A)** `economy/villainVariableAttack.logic.ts` (new) + test: the union, the array, the entry type, the three counters and the term.
- **B)** `setup/villainDefeatRequirement.setup.ts` + test: `parseVariableAttackLine`, `buildVillainVariableAttack`.
- **C)** `types.ts` field; `setup/buildInitialGameState.ts` wiring; `setup/buildInitialGameState.shape.test.ts` omit-when-empty and wiring cases (T15, T15b).
- **D)** `economy/economy.resolve.ts` + `economy.resolve.test.ts`: the term and the dynamic-branch early return.
- **E)** Integration tests, additions only: `moves/fightVillain.test.ts` (refused below the raised cost, defeated at it) and `ui/uiState.build.test.ts` (the City `fightCost` projection shows the raised cost).
- **F)** Data: the overlay script, its input map, and the regenerated `data/cards/co2e.json` (4 lines gain a marker).

## Out of Scope

- **The four cards' `Fight:` lines.** Strucker's (WP-838), Hydro-Man's and Super-Skrull's (WP-835). Paibok's is already marked (WP-533).
- **The same passives on other villains** (the Sewers / Rooftops / Bridge "wolf form" and "giant-size" villains, Thundra, Ultron "per Tech Hero in the HQ" and the rest of the corpus scan). Each is a data row, or a new source, in a later packet (Operator fork F3).
- **Mastermind passives.** The table is villain-only; `resolveMastermindFightCost` is untouched. This covers the look-alike Masterminds co2e Epic Red Skull, shld Hydra High Council Viper and cvwr Ragnarok.
- **WP-838's table** (`G.villainAttackPerCaptured`, Venom / Enchantress / co2e Baron Zemo). Not merged with this table; a later packet may fold the two.
- **Ledger / feed changes and `subsystem-coverage.json`** (Assumes 11).
- **Cards-site display of engine markers** (Assumes 12): unchanged, the same as every existing villain marker.
- **Client changes**: WP-750 already renders the projected cost.
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `economy/villainVariableAttack.logic.ts` — **new**
- `economy/villainVariableAttack.logic.test.ts` — **new**
- `setup/villainDefeatRequirement.setup.ts` — modified; `setup/villainDefeatRequirement.setup.test.ts` — modified
- `setup/buildInitialGameState.ts` — modified (builder call + spread); `setup/buildInitialGameState.shape.test.ts` — modified
- `types.ts` — modified
- `economy/economy.resolve.ts` — modified; `economy/economy.resolve.test.ts` — modified
- `moves/fightVillain.test.ts` — modified (additions only)
- `ui/uiState.build.test.ts` — modified (additions only)

**Scripts / data**
- `scripts/convert-cards/apply-defeat-requirement-markers.mjs` — modified
- `scripts/convert-cards/inputs/villain-defeat-requirements.json` — modified
- `data/cards/co2e.json` — regenerated by the overlay (4 lines gain a trailing marker)

**Governance close:** `docs/ai/post-mortems/01.6-WP-841-co2e-variable-attack-passives.md` (**new**; mandatory under `01.6-post-mortem-checklist.md`: a new setup-time builder and `G` field), `docs/ai/DECISIONS.md` (D-24774), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

That is 14 code / test / data files (2 new, 12 modified, 6 of them tests). Above the ~10 guideline because the marker needs its overlay, input map and data line, and the term needs its setup table; every file is a small, anchored append, and every file named exists on the baseline except the two new ones.

## Contract

- The Locked Values above: `VillainVariableAttackSource` / `VILLAIN_VARIABLE_ATTACK_SOURCES`, `VillainVariableAttack`, the three counters, `villainVariableAttackBonus`, the marker grammar, `parseVariableAttackLine`, `buildVillainVariableAttack`, `G.villainVariableAttack?`, the term placement, the dynamic-branch early return, the overlay list, locator and final line, and the four map rows.
- `resolveFightCost` keeps its signature.

## Test Contract

Each engine case builds a minimal `G` (the `economy.resolve.test.ts` / `abomination.logic.test.ts` fixture style) unless it says setup. "Base" is `fightCostBase` with `fightCostMode: 'dynamic'`.

| # | Input | Expected | Invariant / must NOT |
|---|---|---|---|
| T1 | `VILLAIN_VARIABLE_ATTACK_SOURCES` | equals `['flat', 'per-other-hydra-villain', 'per-hq-hero-class']` and the keyset of a `Record<VillainVariableAttackSource, true>` literal | runtime assertion (D-24372) |
| T2 | `isHydraVillainCard` on: `co2e-villain-hydra-viper-00` typed `villain`; `henchman-hydra-spies-00` typed `henchman`; `co2e-villain-sinister-syndicate-hydro-man-00` typed `villain`; `co2e-villain-hydra-viper-01` with no type entry; `co2e-villain-hydra-viper-00` with a `convertedVillainOrigins` entry; a `hydra`-named id typed `bystander` | true, true, false, false, false, false | "hydro" ≠ "hydra" |
| T3 | Strucker S0 (`per-other-hydra-villain:1`, base 6) at `city[0]`; `city` also holds Strucker S1, co2e Viper and co2e Green Goblin; `escapedPile` holds co2e HYDRA Kidnappers, a Bystander and a captured Hero id | `resolveFightCost` = 9 | self excluded; Goblin / Bystander / Hero not counted |
| T4 | Strucker alone in the City, empty Escape Pile; `G.escapedPile` absent | 6; 6 | partial-G tolerant |
| T5 | Paibok (`per-hq-hero-class:1`, base 5); `hq` = [covert, covert, a strength + tech dual-class card, null, a Sidekick (`heroClass: null`)] | 8 | dual class counts both; grey and null add nothing |
| T6 | Super-Skrull (base 2); `hq[0]` a Divided card whose faces are ranged and instinct, rest null; then an all-null HQ | 4; 2 | `offPlayCardTraits` union; empty HQ = 0 |
| T7 | Hydro-Man (`flat:2@sewers+bridge`, base 4) at `city[0]`; at `city[4]`; at `city[2]`; not in the City; at `city[5]` of a 6-space City; at `city[3]` of a 4-space City (no Bridge, D-24764) | 6; 6; 4; 4; 4; 4 | gate fails closed off the named spaces |
| T8 | Hydro-Man (base 4) at `city[0]` with three Storm `-2` Sewers reductions (`addFightCostReduction` ×3, total 6) | 0 | term before the reduction (wrongly after the floor gives 2); 0 floor kept |
| T9 | Super-Skrull (entry, base 2, all-null HQ) holding a captured Hero of cost 5 in `villainAttachedHeroes`; a dynamic villain with no entry holding the same Hero | 2; base + 5 | entry replaces the captured-cost sum; others unchanged |
| T10 | an entry `{ per-hq-hero-class, 1, requireCitySpaces: ['rooftops'] }` with 3 HQ classes, at `city[0]`; at `city[2]` | +0; +3 | a gate also gates a per-count source |
| T11 | a plain villain with no entry; `G.villainVariableAttack` absent | today's cost | byte-identical path |
| T12 | `parseVariableAttackLine` on the four regenerated lines (verbatim) and on `per-hq-hero-class:1@rooftops` | the four entries of the Locked Values; `{ per-hq-hero-class, 1, ['rooftops'] }` | the three ungated entries deep-equal objects with **no** `requireCitySpaces` key (T14 likewise) |
| T13 | `parseVariableAttackLine` on `[variable-attack:flat:2]`, `…:per-hq-hero-class:0`, `…:wound:1`, `…:per-hq-hero-class:1:2`, `…:per-hq-hero-class:x`, `…:flat:2@sewers+lagoon`, `…:flat:2@`, `…:flat:2@sewers@bridge`, `…:flat:2@sewers+sewers`, and a line with no marker | null each | inert, never throws |
| T14 | Setup: `buildVillainVariableAttack` over mock groups whose lines and `copies: 2` are copied **verbatim** from the regenerated `co2e.json`: `hydra` (Strucker, Viper), `skulls` (Paibok, Super-Skrull, Skrull Queen Veranke, Skrull Shapeshifter), `sinister-syndicate` (Hydro-Man, Beetle) | exactly 8 keys (the 4 cards × `-00` / `-01`) with the Locked Values entries; the two Hydro-Man copies' `requireCitySpaces` arrays are different objects | negatives unflagged; no aliasing |
| T15 | Shape: `buildInitialGameState` with the existing mock registry; a registry without `getSet` | no `villainVariableAttack` key; builder `{}` | omit-when-empty |
| T15b | Shape: the shape test's `getSet` fixture registry (`buildInitialGameState.shape.test.ts` ~L465-491) gains a selected villain card with `copies: 2` and an ability line ending `[variable-attack:flat:2@sewers+bridge]` | `G.villainVariableAttack` has exactly the two copy keys, each `{ source: 'flat', attackPerUnit: 2, requireCitySpaces: ['sewers', 'bridge'] }` | proves the builder call and spread are wired |
| T16 | `fightVillain`: Hydro-Man (base 4) at `city[0]` with 5 attack available; then with 6 | refused (no `G` change); defeated | move never throws |
| T17 | `buildUIState`: Paibok (base 5) at `city[1]`, HQ with 2 distinct classes | `city.spaces[1].fightCost` = 7 | projection = resolver |

Hand-checked (recorded in the commit body, not unit tests): the overlay's apply run, its re-run, `--propose`, and six loud-fails, each from a temporary map row reverted afterwards: unknown `source`; `flat` without `spaces`; an unknown space; `attackPerUnit: 0`; two locator lines (`2099/alchemax-enforcers/whackoid`, the only corpus villain with two); zero locator lines (`co2e/hydra/viper`).

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** the three co2e groups appear in published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`). These villains now cost what they print, so those legs get harder; WP-834 already moved the Core-first fill, so co2e groups fill fewer out-of-set slots. No committed `data/par` artifact references the groups (Assumes 10), so nothing is re-pinned; a future PAR run picks up the new cost.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (engine card fidelity, no paid or persuasive surface).

**Determinism preservation:**
- `G.villainVariableAttack` is omit-when-empty and built once at setup; a match without the four cards never creates it.
- The term reads only `G`; no randomness, clock or I/O.
- The sentinel plays none of these cards, so both hash oracles are expected unchanged; if either moves, STOP: an unmarked match grew a key.
- **Replay-compat:** the term and the early return are inert without the table, and pre-deploy matches' `initialState` has no table, so every stored match (finished or in progress) replays and plays exactly as before. Only matches created after the deploy get the new cost; live-verify uses one.

## Funding Surface Gate

§20 **N/A**: engine and card data only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Sources.** T1-T2 pass.
2. **Term.** T3-T11 pass.
3. **Setup.** T12-T15b pass with exactly the listed keys.
4. **Consumers agree.** T16 and T17 pass with no change to any caller file.
5. **Data.** The overlay reports 4 new `[variable-attack:]` markers and re-runs at 0; `git diff data/cards/` touches only `co2e.json`, and only the 4 passive lines, each gaining one trailing marker.
6. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` has 0 failures; `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `cards:check`, `sim:runtime-observed:check` and `sim:coverage --check` exit 0 with nothing regenerated (Assumes 11).

## Verification Steps

1. `pnpm -r build` → exit 0. Record the engine test total before any edit.
2. `node scripts/convert-cards/apply-defeat-requirement-markers.mjs --propose` → the 4 rows with their matched lines; then the apply run → `… 4 new [variable-attack:] marker(s) appended.`; the re-run → `0 new`.
3. `pnpm --filter @legendary-arena/game-engine test` → all pass; record before / after totals.
4. `pnpm ledger:villains:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm cards:check` → each exits 0. If one flags, STOP: Assumes 11 is false.
5. `pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0.
6. `pnpm -r --no-bail test` → 0 fail.
7. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` line-ending churn.
8. Revert proofs, one at a time, each failing at least one T-case: drop the term from `costBeforeReduction`; drop the dynamic-branch early return; drop the self-exclusion in `countOtherHydraVillains`; drop `heroClass2` from `countHqHeroClasses`; drop the gate check; move the term after `Math.max` (must fail T8); drop the `buildInitialGameState` spread (must fail T15b).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the seven revert proofs were observed.
- [ ] D-24774 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated, with follow-up lines for the other-villain rows (F3) and for folding the two variable-Attack tables and the setup registry walks (D-24774).
- [ ] The 01.6 post-mortem `docs/ai/post-mortems/01.6-WP-841-co2e-variable-attack-passives.md` written (verdict WP COMPLETE).
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-879:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a match created after the deploy on `play.legendary-arena.com`, with the deployed gitSha checked, using `co2e/hydra`, `co2e/skulls` and `co2e/sinister-syndicate` (autoplay `setupData` or the operator setter may stage the board):
  - Hydro-Man's City tile reads `Fight 6` in the Sewers and on the Bridge and `Fight 4` elsewhere;
  - Paibok's / Super-Skrull's tile reads base + the number of distinct classes in the HQ, and changes after a recruit refills a slot;
  - Strucker's tile reads 6 + the other HYDRA Villains in the City and Escape Pile;
  - Fight is enabled only at that cost.

  Record this as operator-pending until seen.

## Operator forks (decided in the draft; the operator may flip any before execution)

| # | Fork | Drafted | Alternative |
|---|---|---|---|
| F1 | What is a "HYDRA Villain"? | **A Villain or Henchman whose card name or Villain Group name contains "HYDRA"** (tested on the slug, Assumes 7-8), the reading the engine already uses for S.H.I.E.L.D. / HYDRA Levels (D-24493); converted cards never count. In a co2e-only match this is exactly the `hydra` group. | Group-only (`isHydraGroupVillain`, the `-villain-hydra-` segment D-24355 uses for Supreme HYDRA's VP). Differs only in mixed-set matches (msp1 HYDRA Pilots / Spies, rvlt HYDRA Base, shld A.I.M. HYDRA Offshoot, amwp Hydra Arms Dealer, Zombie Madame Hydra, the wtif HYDRA cards and Demon Champion of Hydra count under the drafted reading). |
| F2 | A captured Hero's cost on these four | **Replaced**: an entry returns `fightCostBase` from the dynamic branch (the printed passive is the whole variable part), as WP-838 drafts for its table. | Kept additive: the printed bonus plus any captured Hero's cost. |
| F3 | Scope | **The four co2e cards only.** | Also add rows for other villains whose wording fits a source (the "wolf form" / "giant-size" villains would need a three-space gate and their other clauses). The look-alike Red Skull, Viper and Ragnarok lines are Mastermind passives, outside a villain table. |

## Reserved Decision (lands at execution)

**D-24774 — co2e-variable-attack-passives.** It locks:
- `G.villainVariableAttack` as an omit-when-empty, per-copy setup table from the curated `[variable-attack:<source>:<N>[@<spaces>]]` marker, appended by `apply-defeat-requirement-markers.mjs`, read only by `resolveFightCost`;
- the three sources and their counting rules: HYDRA Villain by card / Villain Group name (F1), City then Escape Pile, self excluded, converted cards excluded; Hero Classes as distinct `HERO_CLASSES` members among HQ Heroes, both classes of a dual-class or Divided card, grey adds none; `flat` gated to named spaces, failing closed off them and on an unnamed sixth space;
- the term before the reduction and floor; the entry replacing the dynamic captured-Hero sum (F2);
- markers over a sentence scan, so look-alike passives in other sets stay unflagged until curated (F3);
- no ledger, feed or `subsystem-coverage.json` change while the cards keep open `Fight:` lines;
- the replay-compat note (setup-only reach; live-verify on a new match);
- the sibling-table divergence from WP-838's `G.villainAttackPerCaptured { kind; attackPerCard }`: `attackPerUnit` because the unit is not always a card (a Hero Class, or `flat`); the fold path is `per-captured-hero` / `per-captured-bystander` as sources of this table, in a later packet;
- the deliberate third (fourth, if WP-838 lands first) copy of the setup registry walk, against the code-style abstract-at-third rule, because a shared walk would put the shipped `villainDefeatRequirements` / `villainFightDiscardCosts` tables at risk for no behavior gain; folding the walks is a STATUS follow-up.

---

## Gate Record

**Pre-flight (01.4) (independent subagent): READY TO EXECUTE after three text / test fixes, applied in scope (no re-run needed).** Verified against live code and data: every Assumes anchor and caller; the four passive lines verbatim and the locator's one-line-per-card match; the Assumes 8 HYDRA scan; no import cycle; omit-when-empty keeps both hash oracles; the replay-compat claim; the feeds key on `[effect:]` only; T3-T17 arithmetic; the six allowlisted engine test files green on the baseline (325 / 0).
- **PS-1 (fixed):** 00.2 §5 does not document engine markers; Context now says so and 00.2 is unchanged.
- **PS-2 (fixed):** the look-alike "Red Skull", "Viper" and "Ragnarok" passives are Masterminds (co2e Epic Red Skull, shld Hydra High Council Viper, cvwr Ragnarok); Context, Out of Scope and F3 corrected.
- **PS-3 (fixed):** T8 could not catch a term placed after the floor; now three `-2` reductions (expected 0, wrong placement 2) plus a revert proof.
- **RS-1..7 (fixed):** baseline moved to `b61b9ec1`; value-import wording; `for…of` membership loops; T14 `copies: 2`; named loud-fail cards (whackoid two lines, co2e Viper none); overlay banner + header locked; `03.1-DATA-SOURCES.md` noted as a known NO; `HERO_CLASSES` import `// why:`.

**Copilot (01.7), round 1 (independent subagent): RISK (HOLD), six fixes, all applied.** F2's early return is inert for live data (`villainAttachedHeroes` is written only by a villain's own capture effect; none of the four captures); every revert proof fails a named T-case.
1. Merge-order note existed only on this side → a reverse note added to EC-876 Before Starting and WP-838 Dependencies (keep this packet's table, builder, field, spread, early return); EC-879 L9 covers banner + header.
2. No test proved the builder is wired → T15b + a seventh revert proof (drop the spread).
3. Governance close incomplete → the mandatory 01.6 post-mortem (new setup builder + `G` field) and `workindex:rows:check` / `workindex:executed:check` added.
4. `requireCitySpaces?` construction unlocked under `exactOptionalPropertyTypes` → ungated entries omit the key; T12 / T14 assert it.
5. Marker gate placement ambiguous → the appended literal is locked (gate inside the brackets); a 4-space City T7 case.
6. Sibling-table vocabulary and the third registry-walk copy unlogged → both recorded in D-24774's scope, with the fold path and a STATUS follow-up.

**Copilot (01.7), round 2 (independent subagent): RISK → CONFIRM after four wording fixes, all applied.** R1: Assumes 2 here and WP-838 Assumes 8 qualified for either landing order. R2: each keep-list names the other packet's cost term, the console marker order is pinned, the leading `\n` kept. R3: WP-838 drops Strucker's passive from its STATUS follow-ups, Out of Scope and D-24771 residuals. R4: Scope (In) C names T15 and T15b. Spot-check confirmed all four; EC-876 67 / EC-879 59 content lines.

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 runs. Run 1 failed §3 (four helper dependencies missing from Assumes) → Assumes 14 added; the re-run passed. The table is the re-run's post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all required sections present; Out of Scope has 8 items; 6 ACs |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS after fix — Assumes 1-14 cover every file, symbol and line anchor the body names |
| §4 | PASS — 00.2 §1.4 / §5, ARCHITECTURE §Zone & Pile Structure + Persistence Boundaries, ten cited D-ids, memory refs |
| §5 | PASS — 14 files (2 new, 12 modified, 6 tests), justified; each marked new / modified / regenerated |
| §6 | PASS — names and the `skulls` slug match the data; no setup-payload field touched |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine-only, `G`-pure term, setup-only registry read, idempotent overlay |
| §9 | PASS — pnpm / node / git commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — in-memory fixtures; no boardgame.io, network or DB |
| §13 | PASS — exact commands with expected output; every script exists |
| §14 | PASS — 6 binary ACs tied to T1-T17 + T15b and named gates |
| §15 / §15.1 | PASS — DoD covers STATUS, DECISIONS, indexes, post-mortem; D-24026 live-verify on `play.legendary-arena.com` on a new match |
| §16 | PASS — `for…of` loops, JSDoc, `// why:` sites listed; parser copy and third registry walk justified |
| §17 | PASS — §1 / §8 / §22 / §23 / §24 and NG-1 cited; conflict line; determinism + replay-compat |
| §18 | N/A — no grep verification step |
| §19 | N/A at draft — commit-time reconciliation (baseline line updated) |
| §20 | PASS — N/A with reason (engine and card data only) |
| §21 | PASS — N/A with reason (no HTTP endpoint or `apps/server/src` surface) |

**Verdict:** PASS.
