# WP-815 — Abomination fight cost: Villains and Masterminds add the printed Attack of HQ Heroes (Game Engine)

**Status:** Draft 2026-10-20 (EC-853; **D-24747** reserved (#2915)).
**Primary Layer:** Game Engine
**Dependencies:** none open. Builds on WP-214 (dynamic `N+` cost), WP-489 / D-24295 (named City spaces), WP-539 / D-24348 and WP-760 / D-24589 (additive fight-cost terms + omit-when-empty setup flag), WP-750 / D-24574 (client Fight gating reads the projected cost), WP-724 / D-24545 (`offPlayCardStats` split-card view).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It adds an omit-when-empty `G` field and changes the fight-cost authority, a scoring-adjacent competitive surface.
**Arc:** Cap 75th (ca75) completion arc, WP 2 (WP-803 Out of Time was WP 1). Re-scoped by the 2026-10-19 ca75 card-text audit.

> Baseline: `origin/main` at `cb418e93` plus the reserve commit (#2915). Re-read drift counts and test totals at execution.

---

## Goal

As a player fighting Arnim Zola, Zola's Creations, the Inhuman Rebellion, Maximus or the 2nd-edition Abomination, I want those cards to cost what they print, so that the match is as hard as the tabletop game and the City / Mastermind tiles show the real number.

Today the engine fights every one of them at its printed base. Arnim Zola is fought at 6 when the HQ usually adds 8 to 12 more. After this session:

- **Abomination** (Villain): +Attack equal to the printed Attack of the Hero in the HQ space directly under the Villain's City space.
- **Double Abomination** (Villain): twice that.
- **Ultimate Abomination** (Mastermind): +Attack equal to the total printed Attack of all Heroes in the HQ.
- **Double Highest Abomination** (Mastermind): +Attack equal to twice the highest printed Attack among the Heroes in the HQ.

The terms are added inside the two fight-cost authorities, so the fight gate, the bot's legal moves, Pure Fury targeting and both UIState `fightCost` projections all move together with no caller change.

## User-Visible Impact

- Abomination Villains cost more or less as they move along the City and as the HQ refills. Recruiting the Hero under one changes its cost, as the rules intend.
- Arnim Zola and Maximus cost what they print.
- The City tile and the Mastermind tile already show a `Fight N` badge when the projected cost differs from the printed one (WP-750), so players see the real cost with no client change.

## Affected cards (closed list, verified in `data/cards/*.json` on the baseline)

| Card | Set / group | Printed | Kind |
|---|---|---|---|
| Captain Zolandia, Doughboy, Man-Fish | `ca75/zolas-creations` | `[keyword:Abomination]` | `abomination` |
| Lineage, Omega, Lash | `rlmk/inhuman-rebellion` | `[keyword:Abomination]` | `abomination` |
| The Unspoken | `rlmk/inhuman-rebellion` | `[keyword:Double Abomination]` | `double-abomination` |
| Abomination | `co2e/radiation` | the sentence "Abomination gets +[icon:attack] equal to the printed [icon:attack] of the Hero in the HQ space under his current city space." (no keyword token) | `abomination` |
| Arnim Zola (base face) | `ca75/arnim-zola` | `[keyword:Ultimate Abomination]` | `ultimate-abomination` |
| Maximus the Mad (base face) | `rlmk/maximus-the-mad` | `[keyword:Double Highest Abomination]` | `double-highest-abomination` |

Every copy of each villain is flagged (2 copies each; ids like `ca75-villain-zolas-creations-doughboy-00` / `-01`).

---

## Assumes

1. **Rules text.**
   - `docs/legendary-universal-rules-v23.md` L880-926: Abomination = "+Attack equal to the printed Attack of the Hero/Ally in the HQ/Lair space under this Villain/Adversary's city space"; Ultimate Abomination = "+Attack equal to the total printed Attack of all the Heroes/Allies in the HQ/Lair"; the cost "can go up and down as the Villain moves through the city"; "Double Abomination doubles the bonus"; Highest Abomination with HQ printed Attack 2, 4, 3+, 0+ and none gives 4; a Divided card not being played adds both printed numbers, "This applies to Abomination". Glossary (L2039-2041) repeats Ultimate Abomination.
   - `data/metadata/keywords-full.json` keys `abomination`, `doubleabomination`, `highestabomination`, `ultimateabomination` agree.
2. **Fight-cost authorities** (`packages/game-engine/src/economy/economy.resolve.ts`):
   - `resolveFightCost(G, villainCardId, fightingPlayerId?)` (L73) sums `resolveBaseFightCost + darkPortalVillainBonus + bystanderVillainAttackBonus + villainBloodFrenzyBonus` (L85-89), then subtracts `cityFightCostReduction` with a 0 floor.
   - `resolveMastermindFightCost(G)` (L322) returns `max(0, cardStats[mastermind.baseCardId].fightCost + portalBonus - mastermindReduction)`.
   - Production callers (none change): `moves/fightVillain.ts:160`, `simulation/ai.legalMoves.ts:1092`, `simulation/ai.seatChoice.ts:234`, `ui/uiState.build.ts:883` (City `fightCost`), `moves/fightMastermind.ts:155`, `simulation/ai.legalMoves.ts:1116`, `ui/uiState.build.ts:986` (Mastermind `fightCost`), `hero/heroEffects.execute.ts:4736,4748` (`buildPureFuryTargets`).
3. **`N+` parse.** `economy/economy.logic.ts:190` `parseCardStatValue` strips a trailing `+` (`"6+"` → 6; `null` → 0). Villain `N+` cards are `fightCostMode: 'dynamic'` (base + captured-Hero costs, WP-214); the new term is additive on top.
4. **Printed Attack of an HQ card.** `hero/splitCard.logic.ts:130` `offPlayCardStats(G, cardId)` returns the off-play stat view: a Divided card's two halves' `attack` totalled, any other card's raw `G.cardStats` entry. `moves/resolveOptionalPutBottomHQ.ts:35` already reads HQ printed Attack through it. `G.cardStats` is keyed by the copy-suffixed hero instance ids the HQ holds (`economy/economy.logic.ts:286-330`).
5. **Board geometry.**
   - `board/citySpaceNames.ts:24` `CITY_SPACE_NAMES` = Sewers(0) … Bridge(4); index 0 is the entry edge (D-24295).
   - `board/city.types.ts:47` `HqZone` is a 5-tuple.
   - The binding is **ordinal**, from the physical board and the engine's index orders, not from pixel alignment on screen. On the tabletop the five HQ spaces sit under the five City spaces. The City's five spaces read Bridge … Sewers left to right (`docs/ai/DESIGN-BOARD-LAYOUT.md` §7.1, L307-312; the client renders City index `i` at City column `4 - i`, `apps/arena-client/src/composables/useCityRow.ts:84`). The HQ's five slots read index 0 … 4 left to right (`composables/useHqRow.ts:46`), and the engine's HQ "rightmost" is index 4 (`villain/villainEffects.execute.ts:1158`).
   - Therefore **the HQ space under City index `i` is `G.hq[4 - i]`**: Sewers ↔ the 5th (rightmost) HQ slot, Bridge ↔ the 1st (leftmost).
   - The arena-client does **not** column-align the two rows today: the City row leads with an Escaped Pile cell and the HQ row has no leading spacer (`CityRow.vue`, `HQRow.vue`, `pages/PlayDesktop.vue:907-935`), so on screen the HQ Hero that looks "under" Sewers is not reliably `hq[4]`. That is a client presentation gap (see Out of Scope), not a rules question; this packet binds by ordinal.
6. **Setup precedent.** `setup/buildVillainBloodFrenzy.ts` scans selected villain groups' ability text and fans out per copy with `villainCardInstanceExtIds` (`villainDeck/villainDeck.setup.ts`). It is called at `setup/buildInitialGameState.ts:426` with `villainBuildConfig` and spread onto `G` only when non-empty (L865). `buildMastermindState` runs at L439 and its `baseCardId` = `` `${setAbbr}-mastermind-${slug}-${baseCard.slug}` `` (`mastermind/mastermind.setup.ts:253`), the base being the first non-tactic face (D-24193). `cardVictoryPoints` already keys the mastermind by that `baseCardId` (L445-449).
7. **No hashed fixture includes an affected card.** The sentinel is `core/dr-doom`; `PRE_WP080` is synthetic. A grep of `packages/**` and `apps/**` fixtures for the five group / two mastermind ids finds none (only `data/sweep-fixtures/mastermind-ids.full.json`, an id list).
8. **Feeds are unaffected.** No `[effect:X]` token is added, so `ledger:villains`, `effect-index`, `mechanics:metadata` and `cards:check` do not change. Doughboy and Man-Fish already read `executable` through their marked lines; every other affected villain carries a still-unimplemented line (Zolandia's Fight, Lineage's Fight, Omega's Fight, Lash / The Unspoken's Ambush + Fight, co2e Abomination's Fight). No `subsystem-coverage.json` entry is added, because it would flip those rows to `subsystem` and hide their open lines. The simulation feeds cannot move either: `scripts/runtime-observed-hollows.mjs:131-140` sweeps only `core/dr-doom` + `core/brotherhood`, and `sim:coverage` (`scripts/hero-effect-coverage.mjs`) is a static hero parse.
9. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- The 2026-10-19 ca75 audit (auto-memory `project_cap75_completion_arc`): both ca75 masterminds and three of four Zola's Creations villains are fought at their printed base.
- WP-760 (`docs/ai/work-packets/WP-760-fallen-fight-side.md`) is the structural template: one omit-when-empty setup map, one additive term per authority.
- The scope widens past ca75 to every Villain / Mastermind form of the keyword because one helper and one table row each cover them, and leaving rlmk / co2e on the old cost would ship two rules for one keyword.
- User memory: `reference_client_fight_gating_ignores_fightcost`, `reference_hashed_g_field_dual_repin`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24747) before coding. One WP per session.

**Packet-specific:**
- **One authority each.** The villain term lives only in `resolveFightCost`; the mastermind term only in `resolveMastermindFightCost`. No caller changes. Both terms are added **before** the existing reduction and 0 floor.
- **Read at fight time.** The villain term reads the Villain's current City index and the HQ slot under it on every call; nothing is cached.
- **Printed Attack** = `offPlayCardStats(G, heroId)?.attack ?? 0`. An empty slot (`null`) or a card with no stats reads 0. Granted or temporary Attack never counts.
- **Type placement.** `AbominationKind` lives in `economy/abomination.logic.ts` and `types.ts` type-imports it. This follows the existing `types.ts` imports from `rules/heroKeywords.js` and `rules/heroCountSource.js` rather than creating a new `.types.ts` contract file.
- **Kinds are scoped.** `villainAbominationBonus` acts only on `abomination` / `double-abomination`; `mastermindAbominationBonus` acts only on `ultimate-abomination` / `double-highest-abomination`. Any other kind or no entry → 0.
- **Omit-when-empty.** `G.cardAbomination` is spread onto `G` only when the builder returns a non-empty map, so every other match is byte-identical.
- **Not a `BoardKeyword`.** Abomination is a cost modifier, not City-structural (the Blood Frenzy precedent).

## Locked Values

- `type AbominationKind = 'abomination' | 'double-abomination' | 'ultimate-abomination' | 'double-highest-abomination'` and `ABOMINATION_KINDS` in that order, both exported from `economy/abomination.logic.ts`; a runtime drift test asserts the array matches the union's members.
- `G.cardAbomination?: Record<CardExtId, AbominationKind>` (type-only import into `types.ts`).
- `hqSlotIndexUnderCitySpace(cityIndex: number): number | undefined` in `board/citySpaceNames.ts` returns `(CITY_SPACE_NAMES.length - 1) - cityIndex` for an integer `cityIndex` in `0..4`, else `undefined`.
- Villain term (`villainAbominationBonus(G, villainCardId)`):
  1. kind = `G.cardAbomination?.[villainCardId]`; not `abomination` / `double-abomination` → 0;
  2. `cityIndex = G.city?.indexOf(villainCardId) ?? -1` (the `cityFightCostReduction` partial-G pattern, `economy.resolve.ts:116`); `< 0` → 0;
  3. `hqIndex = hqSlotIndexUnderCitySpace(cityIndex)`; `undefined` → 0; `heroId = G.hq?.[hqIndex]`; `null` / `undefined` → 0;
  4. `printed = offPlayCardStats(G, heroId)?.attack ?? 0`;
  5. return `printed` for `abomination`, `2 * printed` for `double-abomination`.
- Mastermind term (`mastermindAbominationBonus(G)`): kind = `G.cardAbomination?.[G.mastermind.baseCardId]`; `ultimate-abomination` → sum of `printed` over every non-null `G.hq` slot; `double-highest-abomination` → `2 *` the highest `printed` among non-null slots (0 when the HQ is empty); anything else → 0.
- Setup builder `buildCardAbomination(registry: unknown, villainConfig: MatchSetupConfig, mastermindId: string, mastermindBaseCardId: CardExtId): Record<CardExtId, AbominationKind>` in `setup/buildCardAbomination.ts` (the `buildCardVictoryPoints` / `buildVillainBloodFrenzy` parameter precedent; a registry without `getSet` yields `{}`):
  - Villain lines: scan `villainConfig.villainGroupIds` exactly like `buildVillainBloodFrenzy`. A line matching `/\[keyword:\s*double abomination\s*\]/i` → `double-abomination`; else `/\[keyword:\s*abomination\s*\]/i` → `abomination`; else the co2e sentence `/^[^:]*gets \+\[icon:attack\] equal to the printed \[icon:attack\] of the Hero in the HQ space under (?:his|her|its) current city space\.?$/i` → `abomination`. One entry per copy id from `villainCardInstanceExtIds`.
  - Mastermind: in the selected mastermind's non-tactic cards, find the card whose `` `${setAbbr}-mastermind-${slug}-${card.slug}` `` equals `mastermindBaseCardId` (equality, not a re-encoded first-face rule). A line matching `/\[keyword:\s*ultimate abomination\s*\]/i` → `ultimate-abomination`; `/\[keyword:\s*double highest abomination\s*\]/i` → `double-highest-abomination`.
  - Villain scans never emit a mastermind kind and the mastermind scan never emits a villain kind.
- Wiring: `buildInitialGameState.ts` calls the builder **after** `buildMastermindState` with `mastermindState.baseCardId`, and spreads `...(Object.keys(cardAbomination).length > 0 ? { cardAbomination } : {})`.

---

## Scope (In)

- **A)** `economy/abomination.logic.ts` (new) + test: the union, the array, `villainAbominationBonus`, `mastermindAbominationBonus`.
- **B)** `board/citySpaceNames.ts` + test: `hqSlotIndexUnderCitySpace`.
- **C)** `types.ts`: `cardAbomination?`.
- **D)** `setup/buildCardAbomination.ts` (new) + test; wired in `setup/buildInitialGameState.ts`.
- **E)** `economy/economy.resolve.ts` + `economy.resolve.test.ts`: add `villainAbominationBonus` to `costBeforeReduction` and `mastermindAbominationBonus` to the mastermind sum.
- **F)** Integration tests, additions only: `moves/fightVillain.test.ts` (refusal at the printed base when the HQ Hero under adds Attack) and `ui/uiState.build.test.ts` (City and Mastermind `fightCost` projections show the raised cost).

## Out of Scope

- **Hero-side Abomination** (rlmk Gorgon: `Abomination`, `Streets Abomination`, `Rooftops Abomination`, `Highest Abomination` as hero Attack grants, "When Recruited" abilities). `hqSlotIndexUnderCitySpace` is the helper they will reuse.
- **Lineage's Fight** ("Rescue Bystanders equal to the printed Attack of the Hero in the HQ space under Lineage") and every other open line on the affected cards (Zolandia, Omega, Lash, The Unspoken, co2e Abomination's Fight; Primus; both masterminds' strikes and tactics). They are later Cap 75th / rlmk WPs.
- **Henchmen** (none print Abomination).
- **Scheme-granted Abomination.** rlmk *Devolve with Xerogen Crystals* prints "All Xerogen Experiments also have [keyword:Abomination]". The scheme is `counter-only` today (`rules/schemeTwistConfigs.ts`), and Xerogen Experiments come from its own setup; both belong to that scheme's own WP, which can add its cards to `cardAbomination` at setup.
- **Client changes** (WP-750 already renders the projected cost). Separately, the HQ row is not column-aligned under the City row on screen (Assumes 5); a client follow-up (a leading HQ spacer under the Escaped Pile, as on the physical board) is logged as an INFRA item, not part of this packet.
- **Ledger / feed changes** (Assumes 8).
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

- `packages/game-engine/src/economy/abomination.logic.ts` — **new**
- `packages/game-engine/src/economy/abomination.logic.test.ts` — **new**
- `packages/game-engine/src/setup/buildCardAbomination.ts` — **new**
- `packages/game-engine/src/setup/buildCardAbomination.test.ts` — **new**
- `packages/game-engine/src/board/citySpaceNames.ts` — modified; `citySpaceNames.test.ts` — modified
- `packages/game-engine/src/types.ts` — modified
- `packages/game-engine/src/setup/buildInitialGameState.ts` — modified (wiring)
- `packages/game-engine/src/economy/economy.resolve.ts` — modified; `economy.resolve.test.ts` — modified
- `packages/game-engine/src/moves/fightVillain.test.ts` — modified (additions only)
- `packages/game-engine/src/ui/uiState.build.test.ts` — modified (additions only)
- Governance: `docs/ai/DECISIONS.md` (D-24747), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 12 code/test files: 4 new, 8 modified, half of them tests.

## Contract

- The Locked Values above: `AbominationKind` / `ABOMINATION_KINDS`, `G.cardAbomination?`, `hqSlotIndexUnderCitySpace`, the two term functions, the builder signature and its three patterns.
- `resolveFightCost` and `resolveMastermindFightCost` keep their signatures.

## Test Contract

Each case builds a minimal `G` (the `economy.resolve.test.ts` fixture style) unless it says setup.

| # | Input | Expected | Invariant / must NOT |
|---|---|---|---|
| T1 | `hqSlotIndexUnderCitySpace` for 0, 1, 2, 3, 4; for -1, 5, 1.5 | 4, 3, 2, 1, 0; `undefined` ×3 | never throws |
| T2 | `abomination` Villain V, `fightCost 6` `dynamic` base 6, at `city[0]`; `hq = [h5, null, null, null, h3]` (printed 5 and 3) | `resolveFightCost` = 9 | reads `hq[4]`, not `hq[0]` |
| T3 | same V moved to `city[4]` | 11 | cost follows the space |
| T4 | V at `city[2]`, `hq[2] = null` | 6 | empty slot = 0 |
| T5 | V not in the City (no index) | 6 | no HQ read |
| T6 | `double-abomination` V at `city[0]`, `hq[4]` printed 3 | 12 | doubles the read |
| T7 | `hq[4]` is a split card, faces printed 2 and 1 | +3 | uses `offPlayCardStats` |
| T8 | `hq[4]` card with `attack` parsed from `"2+"` → 2; card with no stats | +2; +0 | no throw on missing stats |
| T9 | T2 plus a Storm `-2` reduction on the Sewers | 7 | term before reduction, 0 floor kept |
| T10 | V with no `cardAbomination` entry; and V whose entry is `ultimate-abomination` | base only | villain fn ignores mastermind kinds |
| T11 | Mastermind base `fightCost 6`, `ultimate-abomination`, `hq` printed `[2, 0, null, 3, 1]` | `resolveMastermindFightCost` = 12 | null slot skipped |
| T12 | same, empty HQ | 6 | |
| T13 | `double-highest-abomination`, base 8, `hq` printed `[2, 4, 3, 0, null]` | 16 | highest, not sum |
| T14 | Mastermind entry `abomination`; no entry; `G.cardAbomination` absent | base only | mastermind fn ignores villain kinds |
| T15 | Setup: villain groups `ca75/zolas-creations`, mastermind `ca75/arnim-zola` | 6 `abomination` entries (Zolandia, Doughboy, Man-Fish × `-00`/`-01`), none for Primus; `ca75-mastermind-arnim-zola-arnim-zola` → `ultimate-abomination` | exactly 7 keys |
| T16 | Setup: `rlmk/inhuman-rebellion` + `rlmk/maximus-the-mad` | Lineage / Omega / Lash copies `abomination`; The Unspoken copies `double-abomination`; `rlmk-mastermind-maximus-the-mad-maximus-the-mad` → `double-highest-abomination` | exactly 9 keys |
| T17 | Setup: `co2e/radiation` + mastermind `co2e/doctor-doom` | exactly 2 keys: `co2e-villain-radiation-abomination-00` / `-01` → `abomination` | Maestro, The Leader, Zzzax unflagged |
| T18 | Setup: the core sentinel config; a registry without `getSet` | builder `{}`; `G` has no `cardAbomination` key | `finalStateHash` and `PRE_WP080_HASH` unchanged |
| T19 | `fightVillain` with V at `city[0]`, `hq[4]` printed 3, 6 attack available | refused (no `G` change); 9 available → defeated | move never throws |
| T20 | `buildUIState`: City card V and an `ultimate-abomination` Mastermind | `city.spaces[0].fightCost` = 9; `mastermind.fightCost` = base + HQ sum | projection = resolver |
| T21 | `ABOMINATION_KINDS` drift | array equals the four union members, in order | runtime assertion (D-24372) |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** ca75 Zola's Creations (9 composition rows) and rlmk Inhuman Rebellion (9 rows) appear in published gauntlet loadouts (`packages/registry/src/gauntletLoadouts.generated.ts`), and Arnim Zola (L254) and Maximus the Mad (L1181) are gauntlet masterminds. co2e Radiation is in no loadout. Raising their costs to the printed values makes those legs harder; published PAR for affected seeds may drift. That is the same fidelity shift every card WP carries; PAR regeneration stays with the PAR pipeline.

**Conflict assertion:** None. Card fidelity only; nothing money can buy changes a game outcome (NG-1).

**Determinism preservation:**
- `cardAbomination` is omit-when-empty and built once at setup.
- Both terms read only `G`; no randomness, clock or I/O.
- The sentinel plays none of these cards, so both hash oracles are expected unchanged; if either moves, dual re-pin honestly and say why.
- **Replay-compat:** stored replays of pre-WP-815 matches that fought an affected card will not re-execute identically. Recorded in D-24747.

## Funding Surface Gate

§20 **N/A**: engine only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Geometry.** T1 passes: the HQ space under City index `i` is `hq[4 - i]`.
2. **Villain term.** T2-T10 pass.
3. **Mastermind term.** T11-T14 pass.
4. **Setup map.** T15-T17 pass with exactly the listed keys.
5. **Omit-when-empty.** T18 passes; `finalStateHash` and `PRE_WP080_HASH` are byte-unchanged.
6. **Consumers agree.** T19 and T20 pass with no change to any caller file.
7. **Drift.** T21 passes as a runtime assertion.
8. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` has 0 failures; `ledger:villains:check`, `effect-index:check`, `mechanics:metadata:check`, `cards:check` exit 0 with no diff; `sim:runtime-observed:check` and `sim:coverage --check` exit 0 with no regeneration (Assumes 8).

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record the before / after totals.
3. `pnpm ledger:villains:check && pnpm effect-index:check && pnpm mechanics:metadata:check && pnpm cards:check` → each exits 0.
4. `pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0. If either flags, STOP: Assumes 8 is false, and the WP must be amended before any feed is regenerated.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
7. Revert proofs: delete the villain term, the mastermind term, and the `4 -` in `hqSlotIndexUnderCitySpace` one at a time; each must fail at least one T-case.

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the three revert proofs were observed.
- [ ] D-24747 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`, `roadmap:counts:check` exits 0.
- [ ] Two-commit topology: `EC-853:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a live `ca75/arnim-zola` match on `play.legendary-arena.com`, with the deployed gitSha checked:
  - the Mastermind tile shows `Fight 6 + total HQ printed Attack`, and it changes after a recruit;
  - an Abomination Villain's City tile shows its base + the printed Attack of the HQ Hero in the same ordinal position (Sewers ↔ the 5th HQ slot, Bank ↔ 4th, … Bridge ↔ 1st, counting HQ slots left to right), and the number changes when it moves one space. Judge by ordinal, not by what looks "under" on screen (Assumes 5);
  - Fight is enabled only at that cost.

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24747 — abomination-fight-cost.** It locks:
- the board binding, by ordinal: the HQ space under City index `i` is `hq[4 - i]` (Sewers ↔ the 5th / rightmost HQ slot), from the physical board, D-24295, DESIGN-BOARD-LAYOUT §7.1 column order and the client's HQ index order, independent of on-screen pixel alignment;
- the Xerogen scheme-granted Abomination left to that scheme's WP;
- "printed Attack" = `offPlayCardStats(...).attack` (a trailing `+` dropped, no icon = 0, a Divided card's halves totalled), never granted Attack;
- the four kinds, their scoping (villain vs mastermind), and their arithmetic;
- `G.cardAbomination` as an omit-when-empty setup map keyed by villain copy ids and the mastermind `baseCardId`, not a `BoardKeyword`;
- the co2e sentence pattern standing in for a missing keyword token (no data edit, so no redundant keyword chip on the card);
- no feed change while the affected cards keep other open lines;
- the replay-compat note.

---

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent): NOT READY → READY TO EXECUTE after a text-only fix.**
- Verified against live code and data: Assumes 1-4, 6, 7; every caller in Assumes 2; nothing bypasses the two resolvers (the other `fightCost` reads are deliberately printed-attack reads); the regexes match exactly the intended lines across all `data/cards/*.json` villain and mastermind lines; T1-T21 arithmetic and the 7 / 9 / 2 key counts; neither Arnim Zola nor Maximus is on the transform allowlist; lane, layers and determinism.
- **PS-1 (fixed):** Assumes 5 claimed the HQ is drawn "directly under" the City. It is not column-aligned on screen. The binding is now stated by ordinal (rules + engine/client index orders), the live-verify bullet judges by ordinal, D-24747 says so, and the client alignment is logged out of scope.
- **RS-1 (fixed):** rlmk *Devolve with Xerogen Crystals* grants Abomination; now Out of Scope and noted in D-24747.
- **RS-2 (fixed):** the sim feeds cannot move (core-only sweep, static hero parse); the conditional regen files were removed, and a flag now means STOP.
- **RS-3 (fixed):** Assumes 8 wording (Doughboy and Man-Fish are already `executable`).
- **RS-4 (fixed):** T17 names `co2e/doctor-doom`.
- **RS-5 (fixed):** builder parameter types, `G.city?.indexOf(...) ?? -1`, and an `undefined` index guard before the HQ read.
- **RS-6 (accepted):** `types.ts` type-imports `AbominationKind` from the logic file, per the `heroKeywords.js` / `heroCountSource.js` precedent (§Non-Negotiable Constraints).
- **RS-7 (fixed):** rebased onto the reserve commit before the drafting commit.

The reviewer ruled no pre-flight re-run is needed: no scope, contract or code-path change.

## Lint Gate Self-Review (00.3)

Recorded after the independent gate run.
