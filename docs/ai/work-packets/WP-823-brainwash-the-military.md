# WP-823 — Brainwash the Military: S.H.I.E.L.D. Officers as Villains, the Traitor Battalion, and the escaped-Officer Evil Wins (Game Engine)

**Status:** Draft 2026-10-23 — READY TO EXECUTE (EC-861; **D-24756** reserved (#2973); pre-flight READY, copilot CONFIRM, 00.3 PASS — see §Gate Record).
**Primary Layer:** Game Engine (+ one danger-meter noun in `apps/arena-client/src/vfx/menaceDisplay.ts`, forced by the grown `SchemeLossKind` union)
**Dependencies:** none open. Builds on WP-513 / D-24324 + D-24325 (the converted-villain overlay, counter-driven attack, the escaped-converted loss), WP-514 / D-24326 + D-24327 (non-villain cards in the Villain Deck as Villains, gained as a Hero on defeat), WP-518 / D-24331 (the gain clause in the fight narrative), D-24668 / D-24680 (converted display names, escaped-loss wording), WP-542 / D-24351 (`playTopVillainDeckCards`), WP-793 / D-24656 (an effect-caused escape runs the full escape), WP-623 / D-24434 (origin-named meter kinds), WP-763 / D-24595 (configured schemes leave the last-twist fallback), D-24178 / D-24315 (resource losses suppress the twist proxy).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It grows three closed unions (`ConvertedVillainOrigin`, `SchemeTwistResolverId` / `SchemeTwistResolverKey`, `SchemeLossKind`), changes scheme-specific setup (Villain Deck and Officer Stack), and touches one client file.
**Arc:** Cap 75th (ca75) completion arc, scheme item 1 (auto-memory `project_cap75_completion_arc`).

> Baseline: `origin/main` at `8fe78e5c`, which includes the reserve commit #2973. Re-read line anchors and test totals at execution.

---

## Goal

As a player facing Brainwash the Military, I want its twelve brainwashed S.H.I.E.L.D. Officers to fight me as Villains and its Twists to do what the card prints, so that I win or lose by the card's own rule instead of a stand-in.

Today `ca75/brainwash-the-military` has no `SCHEME_TWIST_CONFIGS` entry. Its Twists do nothing, no Officer is in the Villain Deck, and it loses at the D-24595 last-twist fallback (the 7th Twist), which the WP-763 audit table records as FALSE-LOSS. After this session:

| Printed (`data/cards/ca75.json`, scheme `brainwash-the-military`) | Behavior |
|---|---|
| "Setup: 7 Twists. Add 12 S.H.I.E.L.D. Officers to the Villain Deck." | The Villain Deck holds 7 Twists (unchanged, `villainDeckTwistCount: 7`) and 12 Officer instances `shield-officer-villain-deck-00` … `-11`, shuffled in with the rest. The Officer Stack starts 12 cards smaller (30 → 18). |
| "S.H.I.E.L.D. Officers in the Villain Deck are Villains. Their [icon:attack] is 3 plus the number of Twists stacked next to this Scheme." | A revealed Officer enters the City as a Villain. Its Attack is 3 + the Traitor Battalion count, read at fight time. |
| "When you defeat a S.H.I.E.L.D. Officer, gain it as a Hero." | The fought Officer leaves the City and a S.H.I.E.L.D. Officer goes to the fighter's discard pile, not the Victory Pile. |
| "Twist 1-6: Stack this Twists next to the Scheme as a 'Traitor Battalion.' Play another card from the Villain Deck." (sic) | The Traitor Battalion count rises by 1 (every Officer gets +1 Attack), then the top card of the Villain Deck is played through the normal reveal. |
| "Twist 7: All S.H.I.E.L.D. Officers in the city escape." | Every Officer in the City escapes through the full escape (HQ KO, Bystander discard, Escape effects, the loss check). Other Villains stay. |
| "Evil Wins: When 5 S.H.I.E.L.D. Officers escape." | The scheme is lost when the Escaped Villains pile holds 5 Officers. The twist-count proxy is off; the danger meter reads "Officers N/5". |

## User-Visible Impact

- Officers appear in the City with the S.H.I.E.L.D. Officer art and name, and their City fight cost is 3 at the start and climbs by 1 with each of the first six Twists.
- Defeating one puts a S.H.I.E.L.D. Officer in your discard (it plays for +2 Recruit as usual), and the center overlay says "… and gained the Hero into the active player's discard pile".
- The 7th Twist empties every Officer out of the City at once; five escaped Officers end the game with "Scheme loss triggered — 5 S.H.I.E.L.D. Officers escaped (threshold 5)."
- The danger meter shows "Officers 0/5" instead of "Twists (approximate)".

---

## Assumes

1. **Card text** (verbatim, `data/cards/ca75.json`, scheme `id: 56`, slug `brainwash-the-military`, `villainDeckTwistCount: 7`): the five ability lines quoted in §Goal. The scheme id is `ca75/brainwash-the-military` (`data/sweep-fixtures/scheme-ids.full.json`). `data/metadata/scheme-twist-assignments.json:30` tags it `stack-and-escalate` (metadata only; unchanged).
2. **Rules text** (`docs/legendary-universal-rules-v23.md`): L558-570 (the escape procedure: HQ KO of a Hero costing 6 or less, a discard per player if Bystanders were carried, then the Escape effect); L1170 ("Gain" means "put it into your discard pile"); L1610-1613 (only a Villain escaping the City is an "escape"). No rules line says where the 12 Officers come from; this WP rules (D-24756) that they come from the 30-card S.H.I.E.L.D. Officer Stack, because ca75 ships no Officers (`ca75.json` `other: []`) and the core box lists 30 (rules v23 L4545 / L4767).
3. **No config today.** `SCHEME_TWIST_CONFIGS` (`rules/schemeTwistConfigs.ts`) has no `ca75/brainwash-the-military` key; `schemeTwistConfigs.test.ts:266-267` pins `SCHEME_TWIST_CONFIGS.size === 8 + 67 + 1`. DECISIONS.md L44912 (the WP-763 table) lists the scheme as `twist-7 proxy | FALSE-LOSS`.
4. **Converted-villain overlay** (D-24324): `ConvertedVillainOrigin = 'killbot' | 'skrull'` (`types.ts:69`). `buildVillainDeck` (`villainDeck/villainDeck.setup.ts:178`) types each Killbot `'villain'` in `cardTypes` and records `convertedOrigins[extId] = 'killbot'` (L304-322, gated on the local `KILLBOTS_SCHEME_ID`, L28 / L197) before the lexical sort (§6) and the single shuffle. `buildInitialGameState` spreads `convertedVillainOrigins` into `G` only when non-empty (`setup/buildInitialGameState.ts:646`, `:745`). `config.officersCount` is on the `MatchSetupConfig` `buildVillainDeck` receives (the supply floor is 30, `matchSetup.validate.ts:120`; loadouts default to 30).
5. **Attack.** `resolveFightCost` (`economy/economy.resolve.ts:90`) sums `resolveBaseFightCost` (L277) with the scheme / keyword terms. `resolveBaseFightCost` checks the overlay first: `'killbot'` → `G.counters[KILLBOT_TWISTS_NEXT_TO_SCHEME] ?? 0` (L287), `'skrull'` → cost + 2 (L299); only then the `cardStats` guard (a converted card has no `cardStats` row). The fight move (`moves/fightVillain.ts`), the bot (`simulation/ai.legalMoves.ts:1107`) and the City projection (`ui/uiState.build.ts:893`) all read `resolveFightCost`.
6. **Defeat.** `defeatCityVillainCore` (`moves/fightVillain.ts:506`) is shared by the fight move and the free defeats. Its Skrull branch (L536-549) pushes the fought card to the defeater's discard, deletes its origin and logs a gain line; every other defeat goes to `victory`. It captures `skrullGained` and passes it to `composeFightNarrative` (L658-665, `events/notableEvents.compose.ts:268`), whose clause reads `" and gained the Hero into the active player's discard pile"`.
7. **The Officer token.** `SHIELD_OFFICER_EXT_ID = 'pile-shield-officer'` (`setup/pilesInit.ts:28`) is a fungible token: `G.piles.officers` is `createPileCards(SHIELD_OFFICER_EXT_ID, config.officersCount)` shuffled (L89), `G.cardStats[SHIELD_OFFICER_EXT_ID]` is recruit 2 / cost 3 / `isShieldOrHydra` (`buildInitialGameState.ts:541`), its display entry is built in `buildCardDisplayData.ts:847-866`, and `checkNoCardInMultipleZones` skips it (`invariants/gameRules.checks.ts:46-56`). `pilesInit.ts` imports only types and `shuffle.js`.
8. **Twist dispatch.** `schemeTwistHandler` (`rules/schemeHandlers.ts`) runs the configured resolver, then returns the `schemeTwistCount` +1 effect (L46-57), so the counter is incremented AFTER the resolver. A Twist played from inside a resolver (a nested reveal) therefore reads the outer Twist's pre-increment count. The resolver signature is `(gameState, context: RevealContext, implementationMap, params, twistCardId?)`; each resolver pushes one `schemeTwistResolved` notable event (`killbots`, `schemeTwistResolvers.ts:648`).
9. **Reveal and escape helpers** (`villainDeck/villainDeck.reveal.ts`): `playTopVillainDeckCards(G, context, implementationMap, count)` (L767) plays the top cards through `performVillainReveal`, stopping with a log line when deck and discard are both empty. `resolveVillainEscape(G, context, implementationMap, cardId)` (L595) runs the full escape (counter, Escaped Villains pile, carried Bystanders, the owed HQ KO + Bystander discard, the Escape effect, captured Heroes, the Mystique twist, then `applyEscapedPileResourceLoss`); it does not touch `G.city`, so callers clear the space first (`moves/operatorSetters.ts:452`).
10. **Loss and meter.** `resourceLossCondition: { kind: 'escaped-converted-count', origin, threshold }` (`rules/schemeTwistConfig.types.ts:98-108`) is counted by `countEscapedConvertedLoss` (`rules/schemeResourceLoss.ts`) and suppresses the twist proxy (`isTwistLossSuppressed`). `describeEscapedLoss` names Killbots and Skrulls. `schemeLossProgress.ts` maps an origin to a kind in the exhaustive switch `escapedConvertedKind` (L348); `SchemeLossKind` and `SCHEME_LOSS_KINDS` are drift-pinned by the order list at `schemeLossProgress.test.ts:565-579`; the converted-kind assertions (~L605-622), the "every configured scheme" list (~L626-641) and the scheme → kind table (~L803-815) name each converted scheme. The client's `SCHEME_LOSS_NOUNS: Record<SchemeLossKind, string>` (`apps/arena-client/src/vfx/menaceDisplay.ts:30-63`) must name every kind or the client fails to compile.
11. **Resolver keys.** `SchemeTwistResolverId` (`schemeTwistConfig.types.ts:115-125`), `SchemeTwistResolverKey` + `SCHEME_TWIST_RESOLVER_KEYS` (`events/notableEvents.types.ts:117-143`, pinned "exactly nine entries" at `notableEvents.types.test.ts:101-135`), and `RESOLVER_KEY_PHRASES` (`events/notableEvents.compose.ts:371`). No client file switches on a resolver key.
12. **Display.** `applyKillbotDisplayNames` (`setup/buildCardDisplayData.ts:1615`) is the setup-time display rewrite for converted cards, called at `buildInitialGameState.ts:498`. The City tile name and image come from `G.cardDisplayData[cardId]`; its fight cost comes from the engine's `resolveFightCost`.
13. **No hashed fixture plays this scheme.** `brainwash-the-military` appears outside card data only in `scheme-twist-assignments.json`, `scheme-ids.full.json` (the weekly scheme sweep, not a hash gate), `scheme-deck-counts.json`, `content/themes/CATALOG.md` and DECISIONS. No gauntlet loadout and no `data/par` artifact names it. The hash sentinel is `core/dr-doom` with `core/legacy-virus-the`; `PRE_WP080` is synthetic.
14. **No ledger covers schemes.** `data/metadata/effect-implementation-index.json` and the hero / villain ledgers carry no scheme rows, so no feed regenerates.
15. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- **Why it is next.** The 2026-10-23 re-audit (auto-memory `project_cap75_completion_arc`) ranks Brainwash the Military first among the four ca75 schemes because it loses by the wrong rule today: the last-twist fallback ends the game at Twist 7, while the card's Evil Wins is five escaped Officers.
- **Why the Killbots pattern.** The Officers are non-villain cards that "are Villains" while in the Villain Deck, with an Attack driven by Twists next to the Scheme and an escape-count loss: Killbots exactly (D-24324 / D-24325). They are converted at the one co-located site in `buildVillainDeck`, typed `'villain'` so the reveal, fight and escape paths route them natively, and tagged with a new origin `'shield-officer'` so the attack, the defeat, the display and the loss read the overlay, never the shared `'villain'` type (which would include real Villains). They enter the deck before the lexical sort, so the existing single shuffle mixes them in: no new random draw (Secret Invasion's injection needed one because its Heroes come from the already-shuffled Hero reservoir).
- **Why the Officer Stack shrinks.** The printed setup takes the 12 Officers from the S.H.I.E.L.D. Officer Stack (Assumes 2). `buildInitialGameState` drops the same number of `pile-shield-officer` tokens from `G.piles.officers` after the piles are built (a slice of identical tokens; the shuffle already ran, so the random stream is unchanged). The count is `min(12, config.officersCount)`, so the Villain Deck never holds more Officers than the configured Stack supplied.
- **Why the defeated Officer becomes the `pile-shield-officer` token.** "Gain it as a Hero" means the same card goes to your discard as a S.H.I.E.L.D. Officer Hero (Assumes 2). Every Officer is identical, and the engine models a held Officer as the fungible `pile-shield-officer` token, which already has its stats, team, display and invariant exemption (Assumes 7). So the defeat removes the instance id from play and pushes `SHIELD_OFFICER_EXT_ID` to the fighter's discard. It is not drawn from the Officer Stack (the card came from the City). Pushing the instance id instead (the Skrull pattern) would need a `cardStats`, team and display copy for each of 12 ids, and every Officer read keyed on `SHIELD_OFFICER_EXT_ID` (recruit cost, S.H.I.E.L.D. team, Officer counts) would miss it.
- **How it scores.** A defeated Officer never enters the Victory Pile, so it scores nothing as a Villain or a Bystander; in your deck it is a 0-VP Hero like any S.H.I.E.L.D. Officer. Savior and every Victory-Pile Villain / Bystander read (`isVictoryPileBystander`, D-24680) never see it. While it is in the City it is typed `'villain'`, so every City Villain read (fight targets, "each Villain in the City", Abomination under it, Portals, the bot) sees it as a Villain. An escaped Officer is an escaped Villain: it counts toward the escaped-Villain counter and, through its origin, toward this scheme's loss.
- **Why the Twist is numbered from the Traitor Battalion, not `schemeTwistCount`.** "Play another card from the Villain Deck" can reveal another Twist, which re-enters the resolver before the dispatcher increments `schemeTwistCount` (Assumes 8). Reading `schemeTwistCount + 1` would number that nested Twist the same as the outer one, so a Twist 7 played by Twist 6 would stack instead of emptying the City. The Traitor Battalion counter is raised BEFORE the resolver plays another card, so a nested Twist reads the right number. The rule: fewer than 6 stacked → stack (and play another card); 6 stacked → Twist 7. A Twist beyond the seventh (a Mystique Escape) also runs the Twist 7 effect; the card defines no Twist 8, and stacking a seventh would leave the stack past its printed size.
- **Why Twist 7 escapes Bridge-first.** The card names no order. The City is scanned from the escape edge (index 4, the Bridge) to the Sewers (index 0), the order Villains leave the City in. Each escape is a full escape (D-24656: "an escape caused by a card effect causes all the same effects"), so each owes its own HQ KO and, if it carried Bystanders, a discard. The loss latch is idempotent, so a fifth escape mid-scan ends the game and the remaining escapes still resolve.
- **Why one client line.** `SCHEME_LOSS_NOUNS` is a `Record<SchemeLossKind, string>`, so a new kind does not compile without its noun (the WP-623 / Clash precedent). The noun is "Officers"; no other client file changes, because Officers render through the existing City tile, overlay and meter.
- **Known gaps, recorded not fixed.** The dispatcher's generic "Scheme Twist #N revealed" line is built after the resolver returns (`schemeHandlers.ts` ~L56 / L152 / L183), so when Twist 6 plays a Twist the log reads "Twist 6 joins…", "Twist 7: all … escape", "Scheme Twist #6 revealed", "Scheme Twist #7 revealed": the #6 line follows the Twist 7 effect. The count ends right (7); fixing the order touches `schemeHandlers.ts`, outside this packet. HYDRA Level (rules v23 L1606-1613: S.H.I.E.L.D. cards in the Escape Pile) is not modeled anywhere in the engine, so escaped Officers raise nothing. The competent bot values a fight by Victory Points; a defeated Officer yields a Hero, not VP, so the bot may undervalue fighting Officers. Both are Out of Scope.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.5 Scheme Shape (`villainDeckTwistCount`, `abilities`), §5 Ability Text Markup Language (`[icon:attack]`).
- `docs/ai/ARCHITECTURE.md` §Zone & Pile Structure (zones hold `CardExtId` only), §The Rule Execution Pipeline (resolvers never throw), Section 3 Persistence Boundaries (`G` runtime-only).
- `docs/ai/DECISIONS.md`: scan D-24178, D-24315, D-24324, D-24325, D-24326, D-24327, D-24331, D-24351, D-24434, D-24595, D-24656, D-24668, D-24680, D-24736, D-24738, D-24372 before coding.
- User memory: `reference_engine_tests_never_typechecked`, `reference_hashed_g_field_dual_repin`, `reference_registry_dist_cross_package_tests`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and resolvers never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24756) before coding. One WP per session.

**Packet-specific:**
- **Overlay-keyed.** Every Officer-specific branch tests `G.convertedVillainOrigins?.[cardId] === 'shield-officer'` (or the setup-time origins map). Nothing keys on the instance-id prefix at runtime, and nothing widens a `'villain'`-typed read.
- **Scheme-gated setup.** Only `ca75/brainwash-the-military` adds Officers or shrinks the Officer Stack. Every other scheme's setup, including both random streams, is byte-identical.
- **Self-narrate** every Twist outcome through `pushLog` (hash-excluded `G.messages`, D-24081) with the exact strings in Locked Values.
- **Union lockstep.** Each grown union moves with its canonical array and its drift pin in the same commit (`.claude/rules/code-style.md` §Drift Detection); the new pins are runtime assertions (D-24372).

## Locked Values

**Scheme module (`rules/brainwashTheMilitary.logic.ts`, NEW; pure, imports types, `SHIELD_OFFICER_EXT_ID` and `CITY_SPACE_NAMES` only):**
- `export const BRAINWASH_THE_MILITARY_SCHEME_ID = 'ca75/brainwash-the-military';`
- `export const BRAINWASHED_OFFICER_COUNT = 12;` `export const BRAINWASHED_OFFICER_BASE_ATTACK = 3;` `export const TRAITOR_BATTALION_STACK_LIMIT = 6;` `export const BRAINWASHED_OFFICER_ESCAPE_THRESHOLD = 5;`
- `export function brainwashedOfficerExtId(index: number): CardExtId` → `` `shield-officer-villain-deck-${String(index).padStart(2, '0')}` ``.
- `export function resolveBrainwashedOfficerCount(schemeId: string, officersCount: number): number` → `Math.min(BRAINWASHED_OFFICER_COUNT, officersCount)` for the scheme id (a negative or non-finite `officersCount` reads as 0), else `0`.
- `export function countBrainwashedOfficers(origins: Readonly<Record<CardExtId, ConvertedVillainOrigin>>): number` — the `'shield-officer'` entries, `for...of`.
- `export function applyBrainwashedOfficerDisplay(cardDisplayData, origins): void` — for each `'shield-officer'` id, `cardDisplayData[id] = { ...cardDisplayData[SHIELD_OFFICER_EXT_ID], extId: id }` (a fresh object per id); a missing Officer entry → skip.
- `export function listCityBrainwashedOfficers(G): number[]` — City indices holding a `'shield-officer'` card, from `CITY_SPACE_NAMES.length - 1` down to `0`.

**Types (`types.ts`):**
- `export type ConvertedVillainOrigin = 'killbot' | 'skrull' | 'shield-officer';` (the `// why:` names WP-823 / D-24756).
- `export const TRAITOR_BATTALION_TWISTS = 'traitorBattalionTwists';` beside `KILLBOT_TWISTS_NEXT_TO_SCHEME` — never seeded at setup (`?? 0`).

**Setup:**
- `villainDeck.setup.ts`, new section between §4 (Bystanders) and §5 (Master Strikes): `officerCount = resolveBrainwashedOfficerCount(config.schemeId, config.officersCount)`; for `i` in `0..officerCount-1`: `extId = brainwashedOfficerExtId(i)`, `deck.push(extId)`, `cardTypes[extId] = 'villain'`, `convertedOrigins[extId] = 'shield-officer'`.
- `buildInitialGameState.ts`, right after `buildVillainDeck`: `const brainwashedOfficerCount = countBrainwashedOfficers(villainDeckResult.convertedOrigins);` and, when `> 0`, `piles.officers = piles.officers.slice(brainwashedOfficerCount);` (`piles` is built earlier, L352). Right after `applyKillbotDisplayNames(...)`: `applyBrainwashedOfficerDisplay(cardDisplayData, villainDeckResult.convertedOrigins);`.

**Attack (`economy/economy.resolve.ts` `resolveBaseFightCost`):** `economy.resolve.ts` imports `BRAINWASHED_OFFICER_BASE_ATTACK` from `../rules/brainwashTheMilitary.logic.js` and `TRAITOR_BATTALION_TWISTS` from `../types.js`. After the Skrull branch, `if (G.convertedVillainOrigins?.[villainCardId] === 'shield-officer') { return BRAINWASHED_OFFICER_BASE_ATTACK + (G.counters[TRAITOR_BATTALION_TWISTS] ?? 0); }`.

**Defeat (`moves/fightVillain.ts` `defeatCityVillainCore`):** `fightVillain.ts` imports `SHIELD_OFFICER_EXT_ID` from `../setup/pilesInit.js` (not a re-export). The Skrull `if` becomes `if / else if / else`. New branch: `G.convertedVillainOrigins?.[cardId] === 'shield-officer'` → `officerGained = true`; `G.playerZones[currentPlayer]!.discard.push(SHIELD_OFFICER_EXT_ID)`; `delete G.convertedVillainOrigins[cardId]`; `` pushLog(G, `Player ${currentPlayer} defeated ${formatCardRef(G.cardDisplayData, cardId)} and gained it as a Hero into their discard pile.`) ``. The narrative argument becomes `skrullGained || officerGained`. `composeFightNarrative`'s body is unchanged; only its `skrullGained` `@param` JSDoc adds "or a Brainwash the Military Officer gained as a Hero (WP-823 / D-24756)".

**Resolver (`rules/schemeTwistResolvers.ts`), id `'brainwash-the-military'`, key `'brainwashTheMilitary'`:**
- `stackedCount = gameState.counters[TRAITOR_BATTALION_TWISTS] ?? 0`.
- `stackedCount < TRAITOR_BATTALION_STACK_LIMIT` → `nextCount = stackedCount + 1`; `gameState.counters[TRAITOR_BATTALION_TWISTS] = nextCount`; `` pushLog(gameState, `[Brainwash the Military] Twist ${nextCount} joins the Traitor Battalion next to the Scheme — S.H.I.E.L.D. Officers now have ${BRAINWASHED_OFFICER_BASE_ATTACK + nextCount} Attack. Another card is played from the Villain Deck.`, 'threat') ``; then `playTopVillainDeckCards(gameState, context, implementationMap, 1)`.
- else → `escapeEveryCityOfficer(gameState, context, implementationMap)` (its own JSDoc'd function): `indices = listCityBrainwashedOfficers(gameState)`; none → `` pushLog(gameState, `[Brainwash the Military] Twist 7: no S.H.I.E.L.D. Officer is in the City, so none escapes.`) ``; else `` pushLog(gameState, `[Brainwash the Military] Twist 7: all ${indices.length} S.H.I.E.L.D. Officer(s) in the City escape.`, 'threat') `` and per index in order: re-read `cardId = G.city[index]` and skip the index if it is now `null` or its origin is no longer `'shield-officer'` (an earlier escape's effects may have moved it); else write `G.city` with that space `null` (a copied array, the `operatorEscapeVillain` idiom), then `resolveVillainEscape(gameState, context, implementationMap, cardId)`.
- One terminal `schemeTwistResolved` push with `resolverKey: 'brainwashTheMilitary'`, after either branch.
- `RESOLVER_KEY_PHRASES.brainwashTheMilitary = 'a Twist joined the Traitor Battalion, or every S.H.I.E.L.D. Officer in the City escaped'`.

**Config (`rules/schemeTwistConfigs.ts`):** `['ca75/brainwash-the-military', { schemeId: 'ca75/brainwash-the-military', resolverId: 'brainwash-the-military', params: {}, lossThreshold: 7, resourceLossCondition: { kind: 'escaped-converted-count', origin: 'shield-officer', threshold: 5 } }]`, placed after the Portals entry with a `// why:` (D-24756; `lossThreshold` inert, D-24178).

**Loss and meter:**
- `SchemeLossKind` and `SCHEME_LOSS_KINDS` gain `'escaped-officer'` right after `'escaped-skrull'`; `escapedConvertedKind` gains `case 'shield-officer': return 'escaped-officer';`.
- `describeEscapedLoss`: `condition.origin === 'shield-officer'` → `` `${matchCount} S.H.I.E.L.D. Officers escaped` `` (checked before the Skrull fall-through).
- Client `SCHEME_LOSS_NOUNS['escaped-officer'] = 'Officers'`, with a `// why:` (WP-823).

**Officer pile JSDoc (`state/zones.types.ts:86`):** the `officers` field's JSDoc changes from "Size equals config.officersCount" to say the Stack starts at `config.officersCount`, minus the Officers Brainwash the Military puts in the Villain Deck (D-24756). Comment only; no type changes.

**Resolver unions:** `SchemeTwistResolverId` gains `'brainwash-the-military'` before `'counter-only'`; `SchemeTwistResolverKey` and `SCHEME_TWIST_RESOLVER_KEYS` gain `'brainwashTheMilitary'` last; the drift test becomes "exactly ten entries".

---

## Scope (In)

- **A)** `rules/brainwashTheMilitary.logic.ts` (NEW) and `rules/brainwashTheMilitary.test.ts` (NEW): the module and every B / A / D / T / L case below.
- **B)** `types.ts`: the origin and the counter key.
- **C)** `villainDeck/villainDeck.setup.ts` and `setup/buildInitialGameState.ts`: the Officers in the Villain Deck, the Officer Stack draw-down, the display call.
- **D)** `economy/economy.resolve.ts`: the attack branch.
- **E)** `moves/fightVillain.ts`: gain as a Hero.
- **F)** `rules/schemeTwistConfig.types.ts`, `rules/schemeTwistResolvers.ts`, `rules/schemeTwistConfigs.ts` + test: the resolver and the config entry.
- **G)** `rules/schemeLossProgress.ts` + test, `rules/schemeResourceLoss.ts`: the meter kind and the loss line.
- **H)** `events/notableEvents.types.ts` + test, `events/notableEvents.compose.ts`: the resolver key and its phrase, plus the `composeFightNarrative` `@param` JSDoc.
- **I)** `apps/arena-client/src/vfx/menaceDisplay.ts` + test: the "Officers" noun.
- **J)** `state/zones.types.ts`: the Officer pile JSDoc only (a contract file; comment-only, covered by D-24756).

## Out of Scope

- **HYDRA Level** (escaped S.H.I.E.L.D. cards). Not modeled anywhere; no current card needs it with this scheme.
- **Bot fight valuation** of Officers (a Hero, not VP). Revisit if playtest shows bots ignore Officers.
- **A Traitor Battalion UIState field or board token.** The stack is visible through every Officer's City fight cost and the Twist log line; a board readout is a separate client WP.
- **Special S.H.I.E.L.D. Officers** (rules v23 L3361-3383, a mixed Officer Stack). The engine's Officer Stack is basic Officers only.
- **The other ca75 schemes** (Change the Outcome of WWII, Go Back in Time, Unbreakable Enigma Code) and the ca75 hero lines.
- **`data/metadata/scheme-twist-assignments.json`** (registry-viewer metadata) and the WP-763 table in DECISIONS (historic; D-24756 supersedes its row).
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `rules/brainwashTheMilitary.logic.ts`, `rules/brainwashTheMilitary.test.ts` — **new**
- `types.ts` — modified (origin member, counter key)
- `villainDeck/villainDeck.setup.ts` — modified
- `setup/buildInitialGameState.ts` — modified
- `economy/economy.resolve.ts` — modified
- `moves/fightVillain.ts` — modified
- `rules/schemeTwistConfig.types.ts` — modified (resolver id)
- `rules/schemeTwistResolvers.ts` — modified
- `rules/schemeTwistConfigs.ts`, `rules/schemeTwistConfigs.test.ts` — modified
- `rules/schemeLossProgress.ts`, `rules/schemeLossProgress.test.ts` — modified
- `rules/schemeResourceLoss.ts` — modified
- `events/notableEvents.types.ts`, `events/notableEvents.types.test.ts` — modified
- `events/notableEvents.compose.ts` — modified
- `state/zones.types.ts` — modified (JSDoc only)

**Client (`apps/arena-client/src/`)**
- `vfx/menaceDisplay.ts`, `vfx/menaceDisplay.test.ts` — modified

**Governance:** `docs/ai/DECISIONS.md` (D-24756), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 18 engine files (2 new, 4 test files, one JSDoc-only) plus 2 client files, above the ~8-file split guideline. The scheme is one card whose rules span setup, attack, defeat, twist and loss; each union addition must land with its drift pin; and the client line is forced by the type. Splitting would ship a scheme that converts Officers but cannot lose correctly, or the reverse. The Clash of the Monsters Unleashed change (D-24736) touched 20 files for the same reason.

## Contract

- The Locked Values above: the module exports, the `'shield-officer'` origin, `TRAITOR_BATTALION_TWISTS`, the setup draw-down, the attack term, the defeat branch, the resolver with its exact strings, the config entry, `'escaped-officer'`, `'brainwashTheMilitary'`, the client noun.
- No new `G` field (the overlay and `counters` already exist), no UIState field, no move, no `.validate.ts` / `.gating.ts` file. `schemeTwistConfig.types.ts` gains one union member.

## Test Contract

`rules/brainwashTheMilitary.test.ts` builds full `G` with `buildInitialGameState` over a ca75 registry made from the shipped `data/cards/ca75.json` (the `clashMonsterPit.test.ts` registry precedent: `getSet('ca75')` serves the set, `listCards` one flat villain card per printed villain), loadout `schemeId: 'ca75/brainwash-the-military'`, `mastermindId: 'ca75/arnim-zola'`, `villainGroupIds: ['ca75/masters-of-evil-wwii']`, `heroDeckIds: ['ca75/agent-x-13', 'ca75/captain-america-falcon', 'ca75/winter-soldier']`, `officersCount: 30`, `makeMockCtx({ numPlayers: 2 })`. Twist cases call `SCHEME_TWIST_RESOLVERS['brainwash-the-military'](G, context, DEFAULT_IMPLEMENTATION_MAP, {}, twistId)` with an identity-shuffle `RevealContext` (`{ random: identity, ctx: { currentPlayer: '0', turn: 1 } }`). Under `makeMockCtx`'s reverse shuffle the Officer ids sort last, so the built deck's top 12 cards are Officers: T1 / T2 / T3 / T6 set the deck top explicitly, and A1 / D1 / L1 move Officers out of the Villain Deck before placing them, so `checkNoCardInMultipleZones` stays valid. Expected totals: game-engine +18 tests (one new file); arena-client +1 assertion in an existing test (P4). Cases group under `describe('WP-823 Brainwash the Military …')`.

| # | Input | Expected | Invariant / must NOT |
|---|---|---|---|
| B1 | build `G` | `G.villainDeck.deck` holds exactly the 12 ids `shield-officer-villain-deck-00..11`, each `villainDeckCardTypes` `'villain'` and `convertedVillainOrigins` `'shield-officer'`; 7 `'scheme-twist'` cards; `G.piles.officers.length === 18`; each Officer's display name equals `G.cardDisplayData['pile-shield-officer'].name`; `G.counters.traitorBattalionTwists` is undefined; `checkNoCardInMultipleZones(G)` does not throw | — |
| B1b | a Shuffle call-count spy over this build and over the same Brainwash loadout with `officersCount: 0` (no Officers, everything else identical) | equal call counts | adding the Officers costs no extra random draw |
| B2 | same build with `schemeId: 'ca75/change-the-outcome-of-wwii'` | no `shield-officer-villain-deck-` id anywhere; `G.piles.officers.length === 30`; `convertedVillainOrigins` absent | other schemes untouched |
| B3 | `resolveBrainwashedOfficerCount` with (scheme, 30), (scheme, 5), (scheme, 0), (scheme, -1), (other scheme, 30) | 12, 5, 0, 0, 0 | — |
| A1 | an Officer in the City; counter absent, then 1, then 6 | `resolveFightCost` = 3, 4, 9 | — |
| A2 | a printed ca75 villain in the City with the counter at 6 | its printed fight cost, unchanged | real Villains unaffected |
| D1 | Officer at City 2, `defeatCityVillainCore(G, { currentPlayer: '0' }, 2, { random })` | City 2 `null`; player 0's discard ends with `'pile-shield-officer'`; victory unchanged; the instance id has no origin and is in no zone; `G.piles.officers.length` unchanged; the log line from Locked Values; the last `fightResolved` narrative contains "gained the Hero into the active player's discard pile" | not in the Victory Pile; not drawn from the Stack |
| D2 | a printed villain defeated the same way | it goes to `victory`; narrative has no gain clause | non-Officer path unchanged |
| T1 | counter absent, a printed villain on top of the Villain Deck, run the resolver | counter 1; that villain now in City space 0; the stack log line names Twist 1 and Attack 4; one `schemeTwistResolved` with `resolverKey: 'brainwashTheMilitary'` | — |
| T2 | counter 5, an Officer on top | counter 6; the Officer in the City; its fight cost 9 | — |
| T3 | counter 5, `schemeTwistCount` 5, a Twist card on top of the Villain Deck, an Officer at City 3 | the outer Twist stacks (counter 6) and the nested Twist runs Twist 7: the Officer at City 3 is in `G.escapedPile`, City 3 `null`, counter stays 6 | numbering from the stack, not `schemeTwistCount` |
| T4 | counter 6, Officers at City 4 and 1, a printed villain at City 2 | counter stays 6; both Officers in `G.escapedPile` (City 4's first), City 4 and 1 `null`, the villain still at City 2; `ESCAPED_VILLAINS` +2; no card played from the Villain Deck (deck length unchanged); the Twist 7 log line says 2; `G.pendingEscapeProcedures` gains exactly 2 entries whose `escapedCardId`s are `[City 4 Officer, City 1 Officer]` (each owes its own HQ KO) | other Villains stay; each escape is the full escape |
| T5 | counter 6, no Officer in the City | the "none escapes" line; City and escaped pile unchanged | — |
| T6 | counter 2, empty Villain Deck and discard | counter 3; the reveal helper's exhaustion line; no throw | — |
| L1 | 4 Officers already in `G.escapedPile`, counter 6, one Officer in the City; run the resolver | `G.counters[SCHEME_LOSS] === 1`; a message "Scheme loss triggered — 5 S.H.I.E.L.D. Officers escaped (threshold 5)." | — |
| L2 | 4 escaped Officers plus 3 escaped printed villains | no scheme loss after `applyEscapedPileResourceLoss` | real Villains do not count |
| L3 | the built `G` | `isTwistLossSuppressed(G) === true`; `resolveSchemeLossKind(G) === 'escaped-officer'` and its progress / threshold read 0 / 5, then 2 / 5 after two escaped Officers | the last-twist fallback is off |
| L4 | `SCHEME_TWIST_CONFIGS.get('ca75/brainwash-the-military')` | the Locked Values entry | — |

Existing files, updated in lockstep:

| # | File | Change |
|---|---|---|
| P1 | `schemeTwistConfigs.test.ts` | size `8 + 67 + 2`, test name names Brainwash the Military (D-24756) |
| P2 | `schemeLossProgress.test.ts` | the `SCHEME_LOSS_KINDS` order list (L565-579) gains `'escaped-officer'`; the converted-kind test asserts Brainwash → `'escaped-officer'`; the "every configured scheme" list (L626-641) gains `'ca75/brainwash-the-military'` |
| P3 | `notableEvents.types.test.ts` | "exactly ten entries", `'brainwashTheMilitary'` last in both lists |
| P4 | `menaceDisplay.test.ts` | `menaceKindLabel('escaped-officer') === 'Officers'` |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** Brainwash the Military is in no gauntlet loadout and no `data/par` artifact (Assumes 13). Matches on it change outcome (a real loss rule, harder Officers), the fidelity shift every card WP carries; nothing is re-pinned.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (engine card fidelity plus one meter noun; no paid or persuasive surface).

**Determinism preservation:**
- No new random draw: the Officers join the Villain Deck before its existing sort and shuffle; the Officer Stack draw-down slices identical tokens after its shuffle.
- Every other scheme's setup is byte-identical (B2). No new `G` key appears in a non-Brainwash match: the overlay is spread only when non-empty, and `TRAITOR_BATTALION_TWISTS` is written only by this scheme's resolver.
- Narration goes to hash-excluded `G.messages` (D-24081). The new notable-event key and the fight-narrative gain clause fire only in this scheme.
- No hashed fixture plays the scheme (Assumes 13), so `finalStateHash` and `PRE_WP080_HASH` are expected unchanged. If either moves, STOP and explain before any re-pin.
- **Replay-compat:** a stored pre-WP-823 Brainwash match replays differently (its Villain Deck gains 12 cards). It is not a hash fixture; the weekly scheme sweep (`scheme-ids.full.json`) shifts for this scheme. Recorded in D-24756.

## Funding Surface Gate

§20 **N/A**: engine card fidelity and one meter noun. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Setup.** B1, B1b, B2, B3 pass.
2. **Attack.** A1-A2 pass.
3. **Gain as a Hero.** D1-D2 pass.
4. **Twists.** T1-T6 pass.
5. **Evil Wins and meter.** L1-L4 pass.
6. **Lockstep.** P1-P4 pass; `pnpm --filter @legendary-arena/arena-client typecheck` (`vue-tsc`, the only gate that enforces `Record<SchemeLossKind, string>`) exits 0.
7. **Feeds.** `effect-index:check`, `ledger:villains:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `cards:check`, `cards:count-markers:check`, `sim:runtime-observed:check` exit 0 with no regeneration (Assumes 14).
8. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail.
9. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record before / after totals. The hash oracles (`game.test.ts` `finalStateHash`, `replay/replay.execute.test.ts` `PRE_WP080_HASH`) pass unchanged.
3. `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0, then `pnpm --filter @legendary-arena/arena-client test` → all pass.
4. `pnpm effect-index:check && pnpm ledger:villains:check && pnpm ledger:heroes:check && pnpm mechanics:metadata:check && pnpm cards:check && pnpm cards:count-markers:check && pnpm sim:runtime-observed:check` → each exits 0. If any flags, STOP: Assumes 14 is false.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
7. Revert proofs, one at a time, each must fail at least one case: number the Twist from `schemeTwistCount + 1` instead of the stack (fails T3); push the instance id to the discard instead of the token (fails D1); push the Officer to `victory` (fails D1); skip the Officer Stack draw-down (fails B1); drop the `'shield-officer'` attack branch (fails A1); escape every City card on Twist 7 (fails T4); count `'villain'`-typed escapes for the loss (fails L2); bypass `resolveVillainEscape` on Twist 7 with a direct pile push and counter bump (fails T4).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the eight revert proofs were observed.
- [ ] D-24756 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-861:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a live 2-player bot-ally operator match on `play.legendary-arena.com` (scheme `ca75/brainwash-the-military`), with the deployed gitSha checked, using the operator panel (`operatorMoveToDeckTop` puts an Officer on the Villain Deck top, `operatorRevealNow` forces the next Scheme Twist, `operatorEscapeVillain` escapes the Bridge Villain):
  - an Officer enters the City showing the S.H.I.E.L.D. Officer art with fight cost 3;
  - a Twist logs "joins the Traitor Battalion", every Officer's cost rises by 1, and another card is played;
  - defeating an Officer puts a S.H.I.E.L.D. Officer in the discard (not the Victory Pile) and the overlay says it was gained;
  - the 7th Twist empties every Officer out of the City and the meter reads "Officers N/5";
  - a fifth escaped Officer ends the game with "5 S.H.I.E.L.D. Officers escaped".
  - expected, not a defect: when a Twist plays another Twist, the generic "Scheme Twist #N revealed" lines print after both Twists' Brainwash lines (Context, Known gaps).

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24756 — brainwash-the-military.** It locks:
- the 12 Officers as converted Villains: instance ids `shield-officer-villain-deck-NN`, typed `'villain'`, origin `'shield-officer'`, added in `buildVillainDeck` before its sort and shuffle (no new random draw); the count is `min(12, officersCount)` and the Officer Stack is drawn down by the same number;
- Officer Attack = 3 + `TRAITOR_BATTALION_TWISTS`, read overlay-first in `resolveBaseFightCost`, so every scheme / keyword term still stacks on it;
- "gain it as a Hero" = the instance leaves play and the fungible `pile-shield-officer` token goes to the defeater's discard (not drawn from the Stack); a defeated Officer never enters the Victory Pile, so it never scores as a Villain or Bystander and Savior never sees it; while in the City it is a Villain to every City read;
- the Twist is numbered from the Traitor Battalion stack (raised before "play another card"), not from `schemeTwistCount`, so a nested Twist reads the right number; a Twist after six stacked runs Twist 7;
- Twist 7: every City Officer escapes, Bridge to Sewers, each through the full `resolveVillainEscape`;
- Evil Wins: `escaped-converted-count` on `'shield-officer'`, threshold 5; the twist proxy off; meter kind `'escaped-officer'` ("Officers"); loss line "N S.H.I.E.L.D. Officers escaped"; WP-763's FALSE-LOSS row for this scheme superseded;
- the contract-file edits: `ConvertedVillainOrigin` gains `'shield-officer'` and `TRAITOR_BATTALION_TWISTS` is added (`types.ts`); `SchemeTwistResolverId` gains `'brainwash-the-military'` (`rules/schemeTwistConfig.types.ts`); `SchemeTwistResolverKey` / `SCHEME_TWIST_RESOLVER_KEYS` gain `'brainwashTheMilitary'` (`events/notableEvents.types.ts`); the `officers` JSDoc in `state/zones.types.ts` (comment only);
- the known gaps (HYDRA Level, bot valuation, the generic Twist log line printing after a nested Twist's effect) and the replay-compat note.

---

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent): READY TO EXECUTE, no PS-items.** Verified every Assumes item at `8fe78e5c`: cycle-free imports (`pilesInit.ts` and `citySpaceNames.ts` are leaves); the Locked Values compile under `exactOptionalPropertyTypes` / `noUncheckedIndexedAccess`; `resolveVillainEscape` never writes `G.city`; the nested Twist really re-enters through `buildDefaultHookDefinitions` + `DEFAULT_IMPLEMENTATION_MAP` before the `schemeTwistCount` effect; every defeat route goes through `defeatCityVillainCore`; no Victory-Pile classifier can see an Officer; no other app, LAGN schema or server code switches on the grown unions; only P1-P4 move; no fixture plays the scheme. RS-items, all applied:
- RS-1: Assumes 2's "Officers come from the Stack" relabelled as this WP's ruling (D-24756) with its evidence.
- RS-2: the `economy.resolve.ts` and `fightVillain.ts` import edges named in Locked Values.
- RS-3: the Twist 7 scan re-reads and re-checks each space.
- RS-4: the test `RevealContext` carries `turn`.
- RS-5: test-author notes (deck top, Officers out of the deck); B1's no-extra-draw check is a Shuffle call-count spy; expected totals locked.
- RS-6: P2 and Assumes 10 reworded to the real pin and assertion sites.
- RS-7: the live-verify step names `operatorMoveToDeckTop` / `operatorRevealNow` / `operatorEscapeVillain`.
- RS-8: the stale `state/zones.types.ts:86` Officer-pile JSDoc is allowlisted (comment only, Scope J).
- RS-9: anchors and counts corrected (L178, L277, L1170, L115-125, the supply floor, 4 test files, the printed "Twists" (sic)).

**Copilot (01.7), round 1 (independent subagent): RISK (HOLD), six scope-neutral fixes, all applied; pre-flight stands.** Clean on layers, determinism (no new draw; overlay- and scheme-gated branches; no new `G` key elsewhere) and union lockstep; the rules reading holds (one escape procedure per Officer observed in a probe; token gain; Stack draw-down; stack numbering; Twist 8+). Fixes:
1. FM 11 / 4: the client gate is `arena-client typecheck` (`vue-tsc`), not `build` (AC 6, Verification 3; the EC already said so).
2. FM 11: T4 now asserts one `pendingEscapeProcedures` entry per Officer, Bridge first; revert proof 8 (bypass `resolveVillainEscape`).
3. FM 11: B1's no-extra-draw control is the same loadout with `officersCount: 0`, not a scheme this arc will change.
4. FM 18 / 26: the generic "Scheme Twist #N revealed" ordering after a nested Twist is recorded (Context, D-24756, live-verify note); T3 sets `schemeTwistCount` 5.
5. FM 30 / 4: D-24756 names every contract-file edit.
6. FM 27: `composeFightNarrative`'s `@param` JSDoc names the Officer gain.

**Copilot (01.7), round 2 (same independent subagent): CONFIRM.** All six fixes verified in the WP, the EC and the prototype (18 / 18 pass; revert proof 8 fails T4 and L1). One optional wording tightening applied (Scope H names the `composeFightNarrative` JSDoc); no round 3, no pre-flight re-run.

**Lint (00.3) (independent subagent): FAIL → PASS after two fixes, applied** (see §Lint Gate Self-Review).

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run (a first reviewer stalled with no output; a fresh one completed). Two FAILs were fixed in place: §13 (the locked "+18" total did not match 17 listed cases; the 18th, the no-extra-draw spy, is now its own row B1b) and the EC template's Before Starting typecheck. The table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all 10 required sections; Out of Scope has 7 items |
| §2 | PASS — engine-wide block (full files, ESM, Node v22+, 00.6), session protocol, packet-specific constraints, separate Locked Values |
| §3 | PASS — 15 Assumes items with a BLOCKED clause; ~40 anchors spot-checked against code, rules v23, `ca75.json`, DECISIONS L44912 |
| §4 | PASS — 00.2 §1.5 / §5, ARCHITECTURE sections, 16-entry DECISIONS scan, memory refs; no package-import change |
| §5 | PASS — 18 engine + 2 client files + governance, size justified against the ~8 guideline |
| §6 | PASS — real setup field names; the ca75 slugs exist; scheme text matches `ca75.json` |
| §7 | PASS — no new dependencies |
| §8 | PASS — the new module imports only leaves; no boardgame.io, randomness or registry access after setup; the client line is forced by `Record<SchemeLossKind, string>` |
| §9 | PASS — only pnpm and git commands |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test, `makeMockCtx`, shipped card JSON (the `clashMonsterPit.test.ts` precedent); hash oracles stand in for the golden test |
| §13 | PASS (after fix) — exact commands with exit-0 expectations, the diff-scope step, eight revert proofs, hash oracles; the +18 total now matches B1-B3 + B1b, A1-A2, D1-D2, T1-T6, L1-L4 |
| §14 | PASS — 9 binary criteria tied to named cases or commands |
| §15 / §15.1 | PASS — DoD has STATUS, DECISIONS, WORK_INDEX, EC_INDEX, mindmap, allowlist-only diff; D-24026 live-verify on `play.legendary-arena.com`, operator-pending |
| §16 | PASS — style mandated; `escapeEveryCityOfficer` split out; nothing throws; no `.reduce()` |
| §17 | PASS — §1 / §8 / §22 / §23 / §24 and NG-1; conflict line; determinism and replay-compat |
| §18 | N/A — no grep verification step |
| §19 | N/A at draft — applies to the STATUS entry at close |
| §20 | PASS — N/A with reason (no funding UI, copy or channel) |
| §21 | PASS — N/A with reason (no HTTP endpoint, no `apps/server/src/**` surface) |

EC-861 vs EC-TEMPLATE: FAIL → PASS after one fix (the arena-client `typecheck` added to Before Starting; it was already in After Completing). Seven sections in template order; 52 content lines against the 100 ceiling; every Locked Value code span matches the WP verbatim.

Advisories applied: A1 (the ~8-file guideline); A2 (the stale "seven-entry" comment above `SCHEME_TWIST_RESOLVER_KEYS` is corrected in the in-scope file at execution). Edits after the copilot CONFIRM are a test-row split, a count wording and an EC gate line within listed files (the WP-818 / WP-821 precedent: lint fixes applied without a copilot re-run).

**Verdict:** PASS.
