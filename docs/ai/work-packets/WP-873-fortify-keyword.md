# WP-873 — Fortify: Squirrel Girl and Colleen Wing escape onto the Sidekick Stack or the Mastermind and lock it until a player fights them there (Game Engine + Arena Client + card data)

**Status:** Draft 2026-11-07 — READY TO EXECUTE (EC-911; **D-24818** reserved (#3204); pre-flight READY TO EXECUTE, copilot PASS (CONFIRM), 00.3 PASS — see §Gate Record).
**Primary Layer:** Game Engine (+ three Arena Client consumers of new UIState fields, card-data markers and the derived coverage feeds)
**Dependencies:** none open. Builds on WP-793 / D-24656 (the escape procedure and its step-3 Escape-effect fire site), WP-757 / D-24587 (Haunt: a Villain parked off the City in a lazy `G` table, and the `isMastermindHaunting` "the Mastermind can't be fought" predicate shared by the move, the bot and the projection), WP-871 / D-24816 (fight restrictions; Squirrel Girl's restriction still applies when she is fought at the Stack), WP-842 / D-24776 + WP-844 / D-24778 (the Sidekick Stack, `recruitSidekick`, `gainSidekickToDiscard`), WP-868 / D-24811 (the latest appended villain primitives and the hand-synced marker-script list), D-24076 (defeat requirements), D-24737 (a free defeat ignores fight restrictions), D-24802 (the Size-Changing fight price), WP-790 / D-24652 (target-aware Attack), WP-750 / D-24574 (the client gates on projected data), D-24364 (a move precondition ships with its `getLegalMoves` mirror).
**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM — a new escape-time primitive that pulls a Villain back out of the Escape Pile (the escape still counts), a second fight path through `fightVillain` with its bot mirror (a divergence freezes bot turns), a new contract file and a lazy hashed `G` table; no auth, money, persistence or server surface.
**Lane:** Standard (two-session). New contract file (`board/fortify.types.ts`), changes to two existing contract files (`rules/villainAbility.types.ts`, `ui/uiState.types.ts`), a new `G` field, three UIState fields, engine + client + card data.

> Baseline: `origin/main` at `6426eb23` (the reserve PR #3204). Re-read every line anchor below at execution.

---

## Goal

As a player, when Squirrel Girl or Colleen Wing escapes, I want her to Fortify the place her card names, so it plays like the tabletop game: while she sits there the place is locked, and any player can fight her there to unlock it.

| Card (`cvwr`, 2 copies each) | Printed Escape line (verbatim) | Today | After this session |
|---|---|---|---|
| Squirrel Girl (`great-lakes-avengers`, 3 Attack, 2 VP) | `Escape: [keyword:Fortify] the Sidekick Stack. While it's fortified, [rule:Sidekicks] can't be recruited or gained.` | Escapes to the Escape Pile; the line logs an `unmarked-ability` / `onEscape` / `no-handler` hollow (operator match `kGywzM4SJGS`, server `5cbac16a`, 2026-11-07, at 36.1.4). | She leaves the Escape Pile and fortifies the Sidekick Stack. No Sidekick can be recruited (`recruitSidekick`) or gained by a card effect until a player fights her there. |
| Colleen Wing (`heroes-for-hire`, 9 Attack, 5 VP) | `Escape: [keyword:Fortify] the Mastermind. While it's fortified, the Mastermind can't be fought.` | Escapes; no hollow is shown, but the line does nothing (unmarked). | She leaves the Escape Pile and fortifies the Mastermind. `fightMastermind` is refused until a player fights her there. |

## User-Visible Impact

- A fortifying Villain appears under the Escaped Pile column of the City row with the place it fortifies, what is locked, and a Fight button priced like any City fight.
- While the Sidekick Stack is fortified, the Recruit Sidekick button is disabled with the reason. While the Mastermind is fortified, its Fight button is disabled with the reason.
- Fighting the fortifier puts it in your Victory Pile, fires its Fight effects (none for these two) and ends the lock.
- A second copy that escapes while the first still fortifies the same place escapes normally (rules: "don't do anything if there's already a Villain fortifying that place").

---

## Assumes

1. **Rules (v23, `docs/legendary-universal-rules-v23.md`).** L1454-1466 (Fortify): "Put this Villain on or near the specified place. While it's there, it has the listed effect. Any player can fight that Villain as normal to end that Fortify effect and put that Villain into their Victory Pile." and "If a card would fortify a place, don't do anything if there's already a Villain fortifying that place." L3175-3184: schemes that count escaped Villains "count only the Villain cards currently in the Escape Pile" and "This doesn't count Villains that escape the city and are immediately put somewhere besides the Escape Pile." L1299-1302 + D-24737: a card that defeats an enemy ignores fight restrictions.
2. **Card data on the baseline** (`data/cards/cvwr.json`). The two Escape lines above are verbatim: Squirrel Girl's is ability 2 (ability 1 is `You can't fight Squirrel Girl if you played more than one card this turn. [fight-restriction:at-most-one-card-played]`), Colleen Wing's is ability 2 (ability 1 is `[keyword:Bribe]`, unimplemented anywhere in the engine). Neither Escape line carries an `[effect:]` marker. No `fortify` token exists in `data/cards/` other than the display `[keyword:Fortify]` / `[keyword:fortifies]` / `[keyword:fortifying]`.
3. **The escape site.** `resolveVillainEscape` (`villainDeck/villainDeck.reveal.ts` ~L598) increments `G.counters[ENDGAME_CONDITIONS.ESCAPED_VILLAINS]` (~L609), appends the card to `G.escapedPile` (~L614), carries its Bystanders into the pile (~L627), enqueues the HQ-KO / Bystander-discard procedure (~L649), then fires `executeVillainAbilities(G, ctx, escapedCardId, 'onEscape', { random }, undefined)` (~L664), then moves captured Heroes to the pile (~L692), the Mystique branch (~L705), `applyEscapedPileResourceLoss` (~L745) and `settleWwiiConquest` (~L750). Every escape reaches it (callers: `villainDeck.reveal.ts` ~L316, `villainDeck.enterCity.ts` ~L119, `rules/schemeTwistResolvers.ts` ~L797 / ~L1123, `moves/operatorSetters.ts` ~L461; `villainDeck.enterCity.ts` ~L61 `enterCityIgnoringAmbush` also pushes through it). The card is already in `G.escapedPile` when an Escape handler runs.
4. **Villain primitive plumbing.** `VillainEffectPrimitive` + `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts` ~L342-384 / ~L452-542; tail `hq-heroes-cost-change`, `ko-from-discard-current`, `reenter-sewers-if-villain-deck-top`, positions 40-42), `VillainEffectDescriptor` (~L672); parser `parseUngatedEffect` in `setup/villainAbility.setup.ts` (~L541; the `hq-heroes-cost-change` grammar ~L827 is the precedent); executor `VILLAIN_EFFECT_HANDLERS` (`villain/villainEffects.execute.ts` ~L4932) and `applyVillainEffect` (~L5008), which passes `timing` to every handler. The marker script `scripts/convert-cards/apply-effect-markers.mjs` holds a hand-synced primitive list (~L189-235) and per-primitive grammar checks (~L453-480), and reads `scripts/convert-cards/inputs/villain-effect-markers.json`. `detectVillainUnmarkedTimingLine` (`villainEffects.execute.ts` ~L574) records the `unmarked-ability` hollow only for a timing line with no marker.
5. **Off-City Villain precedent.** WP-757 Haunt keeps a Villain out of the City in the lazy `G.hqHaunters` (`types.ts`), with pure helpers in `board/haunt.logic.ts` and the single predicate `isMastermindHaunting` read by `fightMastermind` (~L156), `getLegalMoves` (`simulation/ai.legalMoves.ts` ~L1200-1204) and `buildUIState` (`isHaunting`, ~L1096). No path fights a Villain that is not in the City today.
6. **The fight move.** `fightVillain({ G, ...context }, { cityIndex, useExcessiveViolence, discardCardId, payToRescueBystander })` (`moves/fightVillain.ts` ~L151) reads `G.city[cityIndex]` only. `defeatCityVillainCore` (~L574) is City-indexed (its first write is `G.city[cityIndex] = null`). `resolveFightCost` / `resolveFightPrice` (`economy/economy.resolve.ts` ~L101 / ~L153) take a card id and need no City presence (their City / Escape-Pile / HQ lookups miss harmlessly for an off-City card). `getSpendableAttackForTarget` / `spendFightCostForTarget` take an `AttackTargetName`; `UNNAMED_CITY_SPACE_TARGET` (`economy/economy.types.ts` ~L23) is the target no restricted grant names. `hasAnyPendingChoice` (`moves/phaseCard.ts` ~L82) is the shared block-all cluster (`attemptHeist` reuses it); `hasHealedThisTurn` is the D-24180 lock.
7. **Fight restriction helper.** `isFightRestrictionBlocking(state, playerId, cityIndex: number, restriction)` (`moves/villainDefeatRequirement.logic.ts` ~L334) reads `cityIndex` only in the `no-adjacent-villain` arm; `getFightRestriction` (~L288), `matchHasFightRestrictionKind` (~L304), `FIGHT_RESTRICTION_REASONS`, `getDefeatRequirement` / `playerMeetsDefeatRequirement`, `getFightDiscardCost` live in that file.
8. **Sidekick paths.** `recruitSidekick` (`moves/recruitSidekick.ts` ~L95; reads `G.piles.sidekicks[0]` ~L100) is the only recruit; `gainSidekickToDiscard` (`moves/gainSidekick.logic.ts` ~L39) is the only effect gain, called once by `heroEffectGainSidekick` (`hero/heroEffects.execute.ts` ~L2196, loop ~L2218, `blocked` line "the Sidekick Stack is empty"). The bot does not enumerate `recruitSidekick`.
9. **The Mastermind fight.** `fightMastermind` (`moves/fightMastermind.ts` ~L125) step 1: empty tactics (~L148), then `isMastermindHaunting` (~L156). The `getLegalMoves` branch is ~L1198-1220. The free-defeat target builders (`moves/defeatChoice.resolve.ts`) read `isMastermindHaunting` (the Mastermind is physically gone while it haunts).
10. **Projection.** `UICityState { spaces, escapedPile }` (`ui/uiState.types.ts` ~L689), `UIMastermindState` (~L764, `isHaunting?: true`), `UISharedPilesState` (~L1000, `sidekicksCount`); `buildUIState` City ~L940-992 (`fightCost: Math.max(0, resolveFightPrice(gameState, space, ctx.currentPlayer))` ~L979), Mastermind ~L1093-1096, piles ~L1281; `filterUIStateForAudience` City ~L610-612 (`deepCopyCitySpaces` ~L98). The client imports UIState types from `@legendary-arena/game-engine` (`index.ts`).
11. **Client.** `apps/arena-client/src/components/play/CityRow.vue` renders `<EscapedPile :pile="cell.entries" />` in the `escaped` cell (~L575) and has `submitMove`, `currentStage`, `isViewerTurn`, `hasHealedThisTurn`, `economy` props; `gateForCell` (~L195) is the stage → heal → cost → … order; `useCardCostGating(economy).canFight(cost, target?)`. `MastermindTile.vue` `gateForFight` (~L195: stage → heal → cost → tactics). `SharedDecks.vue` Sidekick gate (~L165-188: heal → already recruited → empty Stack → cost). Each has a `.test.ts`.
12. **Ledger rows on the baseline** (`docs/ai/coverage/villain-mechanic-ledger.csv`): `cvwr-villain-great-lakes-avengers-squirrel-girl` (~L260) and `cvwr-villain-heroes-for-hire-colleen-wing` (~L241), each `(unmarked),unmarked`.
13. **No hashed fixture, sentinel or PAR artifact plays either group.** `great-lakes-avengers` / `heroes-for-hire` appear in `packages/registry/src/gauntletLoadouts.generated.ts`, coverage feeds, `scripts/convert-cards/inputs/*` and engine unit tests (`moves/fightVillain.test.ts`, `moves/villainDefeatRequirement.logic.test.ts`, `setup/buildFightSizeChanging.test.ts`, `simulation/ai.legalMoves.test.ts`, `ui/uiState.filter.test.ts`, `villain/cvwrBigBerthaRevealOrWound.test.ts`, `villain/koFromDiscardMandatory.test.ts`, `villain/reenterSewers.test.ts`); none fires either Escape line (re-grep at execution). The hash sentinel is `core/dr-doom`.
14. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile (update this WP and D-24818) before coding.

## Context (Read First)

- **Every Fortify line in the corpus** (scan 2026-11-07; only `cvwr` prints Fortify). Shared-notes copy: `wp873-fortify-enumeration.md`.

  | Card | Timing | Place | Effect while fortified | Here? |
  |---|---|---|---|---|
  | Squirrel Girl | Escape | Sidekick Stack | Sidekicks can't be recruited or gained | **Yes** |
  | Colleen Wing | Escape | Mastermind | the Mastermind can't be fought | **Yes** |
  | Radioactive Man (`thunderbolts`) | Escape | Wound Stack | each Wound gained brings an extra Wound | Follow-up A |
  | Luke Cage *Unbreakable Skin* (hero, `[team:avengers]:`) | play | Wound Stack | players can't gain Wounds; the card returns to discard next turn | Follow-up A |
  | Venom (`csa-special-marshals`) | Escape | Bystander Stack | a Bystander rescued from there is KO'd instead | Follow-up B |
  | Ms. Marvel (`superhuman-registration-act`) | Escape | an HQ space | Heroes can't be gained from that space | Follow-up C |
  | Yellowjacket (`superhuman-registration-act`) | Escape | Hero Deck | a Hero in the HQ that costs 7+ is KO'd | Follow-up C |
  | She-Hulk (`superhuman-registration-act`) | Escape | Villain Deck | a Master Strike completed from it: each player gains a Wound and She-Hulk enters the Sewers | Follow-up D |
  | Iron Spider (`superhuman-registration-act`) | Ambush + Fight | a player's deck | that player draws one fewer at end of turn; Fight passes it to the player on the left | Follow-up D |
  | Sharon Carter, Agent 13 (`shield-elite`) | Escape | S.H.I.E.L.D. Officer stack | Officers becoming Villains bring one extra | Follow-up E (after WP-869) |
  | Authoritarian Iron Man (Master Strike) + *Man the Fortifications* tactics | strike / Fight | the next City space | can't fight him while a Villain is there; +3 Attack there | Follow-up F |
  | *Imprison Unregistered Superhumans* (scheme) | Twists 1/3/5/7/9 | the next City space | +1 Attack there; other Twists KO a Bystander if occupied | Follow-up F |
  | Misty Knight *Trusted Bodyguard* (tactic) | Fight | Misty Knight | Colleen Wing returns fortifying Misty Knight | Follow-up F |

- **Split decision.** This packet builds the Fortify system once (the escape primitive, the `G.fortifications` table, fighting a fortifier through `fightVillain`, the bot mirror, the projection and the client strip) and lands the two places whose lock has **one** chokepoint each: the Sidekick Stack (`recruitSidekick` + `gainSidekickToDiscard`) and the Mastermind (`fightMastermind`). Squirrel Girl is the observed hollow; Colleen Wing costs one predicate and proves the table is not Sidekick-specific. Every other row needs a seam that does not exist yet:
  - **A** Wound Stack: wounds have no single chokepoint (`moves/seatChoiceCards.ts` ~L288 calls the pure `gainWound` directly), and an extra or prevented Wound needs a Diving Block / Flying Shield Block ruling.
  - **B** Bystander Stack: five rescue-from-Stack sites (`heroEffectRescue`, `applyRescueOnFight`, `rescueTopBystander`, two in `rules/tacticHandlers.ts`) need one chokepoint first.
  - **C** HQ space / Hero Deck: an HQ-space gain gate across `recruitHero` and every gain-from-HQ effect, a choice of space, and an HQ-refill KO hook.
  - **D** Villain Deck / player deck: a Master Strike hook plus Sewers entry, and an Ambush that takes the Villain out of the City, a hand-size change and a cross-player Fight chain.
  - **E** Officer stack: depends on WP-869 (draft) for Officers becoming Villains at runtime.
  - **F** City-space Fortify by a Mastermind, scheme or tactic: no Villain fortifier; a different mechanic.
  Each reuses this packet's table, primitive grammar and fight path by appending a place and a lock.
- **Sibling drafts, not dependencies.** WP-864 (Demolish), WP-869 (stack cards as Villains) and WP-872 (Mandarin's Rings variants) each append a villain primitive and edit `rules/villainAbility.types.ts`, `setup/villainAbility.setup.ts`, `villain/villainEffects.execute.ts`, `apply-effect-markers.mjs` and `villain-effect-markers.json`; WP-869 also edits `moves/fightVillain.ts` and `types.ts`. None prints Fortify, so order does not matter: whichever executes later rebases, appends its primitive after the others and bumps the length pin.
- **Why `fightVillain` with a new optional argument, not a new move.** A new move must be registered in `game.ts`, `index.ts`, `replay/replay.execute.ts`, `simulation/simulation.runner.ts`, `simulation/par.aggregator.ts`, the move-dispatch drift test and the client move-name union, and the server autoplay spend filter would need to learn it. `fightVillain` is already registered on every one of those surfaces and its args pass through unchanged. An optional `fortifiedPlace` routes the move to a separate, boardgame.io-free fight function before any City read, so every City fight is byte-identical.
- **Why a dedicated small defeat core, not a refactor of `defeatCityVillainCore`.** The City core handles converted Villains (Skrull, Officer, micro-sized), attached Bystanders and Heroes, Baron Zemo's paid rescue, the `fightResolved` event (whose `citySpace` is a required number) and two Villain-Deck bridges. A fortifier is always a printed Villain whose Bystanders were carried into the Escape Pile and whose captured Heroes were moved there (Assumes 3). Rewriting the City core to be location-agnostic would touch every City fight; a ~40-line fortifier core touches none (code-style: duplicate first).
- **No ARCHITECTURE / rules edit.** The two locks are board-state step-1 returns, like the Haunt lock (`fightMastermind` ~L156), which the Move Validation Contract already admits; the fortifier fight is an ordinary validate-then-mutate move path. D-24818 records them.
- **Import cycles (runtime-safe).** `fightVillain.ts` <-> `fortifyFight.ts` (`buildFightSizeChangingLine`) and `fortifyFight.ts` -> `phaseCard.ts` -> `defeatChoice.resolve.ts` -> `fightVillain.ts` are new cycles, and so is `villainDefeatRequirement.logic.ts` -> `economy/economy.resolve.ts` -> … -> `rules/mastermindHandlers.ts` -> `villainDefeatRequirement.logic.ts` (from `findFightableFortifier`; load order verified on a scratch copy at pre-flight round 3). Every binding is read inside a function and the shared modules hold only literals at top level, so they are safe; each gets a `// why:` (the `villainDeck/villainEscapeProcedure.ts` ~L32-41 precedent).
- **Why only the Escape Pile changes, not the escape counter.** Rules L3182-3184: a scheme that counts escaped Villains counts only the Villain cards in the Escape Pile, and a Villain put somewhere else does not count. Every engine "escaped Villains" loss already counts `G.escapedPile` (`rules/schemeResourceLoss.ts` ~L222-258; `rules/schemeTwistConfigs.ts` ~L90-100), and that check runs after the handler (Assumes 3), so removing the card from the pile is the whole fix. `G.counters[ESCAPED_VILLAINS]` is an escape-event count: it feeds the score penalty (`scoring/parScoring.logic.ts` ~L147, `simulation/par.aggregator.ts` ~L991) and the HUD `progress.escapedVillains` (`ui/uiState.build.ts` ~L477), and rules L3265 scores "-1 for each Villain/Adversary that escaped". The Villain did escape, so the counter is not touched. The HQ KO and Bystander discard the escape owes still resolve (D-24656), and the carried Bystanders stay in the Escape Pile.
- **Why free defeats ignore the Mastermind lock.** Fortify's "can't be fought" is a fight restriction (D-24737). Haunt removes the Mastermind physically, so it also blocks free defeats; Fortify leaves it in place. `defeatChoice.resolve.ts` is not changed.
- **Silent refusals.** Like every fight precondition, a locked `recruitSidekick` / `fightMastermind` and a refused fortifier fight return with no `G` write and no log. A card-effect Sidekick gain logs a `blocked` line naming the fortifier (D-24017: a silent skip reads as "the card did nothing").
- **Layer Boundary.** `docs/ai/ARCHITECTURE.md` Section 1 §Package Import Rules / §Layer Boundary (Authoritative) and `.claude/rules/architecture.md` §Layer Boundary: arena-client may import only the `.` Runtime-Safe Engine Surface (WP-090); this WP adds the value export `UNNAMED_CITY_SPACE_TARGET` (a string literal) and two type exports to it. No other cross-layer edge.
- `docs/ai/ARCHITECTURE.md`: §The Move Validation Contract, §Architectural Principles #2, Persistence Boundaries. `.claude/rules/architecture.md`: §UIState Projection Integrity (five-step field contract), §Move Validation Contract, §Zone Contents (the table holds `CardExtId`s only).
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (villain group shape) and §5 (ability-text markup: `[effect:fortify:<place>:<lock>]` is a pipeline-appended engine marker, documented in the `villain-effect-markers.json` `_notes`).
- `docs/ai/DECISIONS.md`: read D-24017, D-24076, D-24180, D-24364, D-24377, D-24574, D-24587, D-24652, D-24656, D-24737, D-24776, D-24778, D-24802, D-24811, D-24816 before coding.
- User memory: `reference_bot_legalmoves_moveguard_divergence`, `reference_card_data_pipeline`, `reference_engine_tests_never_typechecked`, `reference_arena_client_uistate_backfill_recurrence`, `reference_setup_hook_change_replay_compat`, `reference_operator_match_live_verify_recipe`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones and `G.fortifications` hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24818) before coding. One WP per session.

**Packet-specific:**
- **One table, one set of predicates.** `G.fortifications` is written only by `fortifyWithEscapedVillain` and `removeFortification` (`board/fortify.logic.ts`). Every lock reads `isSidekickStackFortified` / `isMastermindFortified`; no inline `G.fortifications` read anywhere else.
- **Gate, mirror, project.** The Mastermind lock gates `fightMastermind`, is mirrored in `getLegalMoves` and projected; the fortifier fight gates in `fightVillain`, is mirrored in `getLegalMoves` and projected (D-24364). The Sidekick lock gates `recruitSidekick` and `gainSidekickToDiscard` and is projected (the bot does not recruit Sidekicks; Assumes 8).
- **City fights byte-identical.** The `fortifiedPlace` branch runs before any City read and returns; with the argument absent, `fightVillain` is unchanged. `defeatCityVillainCore` is not modified.
- **Byte-identical for every other match.** No `G.fortifications` key until a Fortify fires; the key is deleted when the last fortification ends; no new UIState key without a fortification; `getLegalMoves` output unchanged when no fortification exists. Hash oracles stay unchanged.
- **Data, not English.** Behavior comes only from the `[effect:fortify:<place>:<lock>]` marker; no parser reads the printed English.
- **Markers only.** Regenerate card data with `apply-effect-markers.mjs` alone. Never run `convert-cards-v15.mjs`.
- **Five-step UIState contract** for each of the three new fields (`.claude/rules/architecture.md`).

## Locked Values

**New contract file `board/fortify.types.ts`** (types and constants only):
- `export type FortifyPlace = 'sidekick-stack' | 'mastermind';`
- `export const FORTIFY_PLACES: readonly FortifyPlace[] = ['sidekick-stack', 'mastermind'] as const;` (canonical order; JSDoc: the closed set of places a Villain can fortify in v1, WP-873 / D-24818; a follow-up appends).
- `export type FortifyLock = 'no-recruit-or-gain' | 'no-fight';`
- `export const FORTIFY_LOCKS: readonly FortifyLock[] = ['no-recruit-or-gain', 'no-fight'] as const;`
- `export const FORTIFY_ALLOWED_LOCKS: Readonly<Record<FortifyPlace, readonly FortifyLock[]>> = { 'sidekick-stack': ['no-recruit-or-gain'], mastermind: ['no-fight'] };` (a place may carry more than one lock in a follow-up; the Wound Stack will).
- `export const FORTIFY_PLACE_LABELS: Readonly<Record<FortifyPlace, string>> = { 'sidekick-stack': 'the Sidekick Stack', mastermind: 'the Mastermind' };`
- `export const FORTIFY_LOCK_TEXT: Readonly<Record<FortifyLock, string>> = { 'no-recruit-or-gain': "Sidekicks can't be recruited or gained", 'no-fight': "the Mastermind can't be fought" };`
- `export interface Fortification { villainCardId: CardExtId; lock: FortifyLock; }`

**State (`types.ts`, beside `hqHaunters`):** `LegendaryGameState.fortifications?: Partial<Record<FortifyPlace, Fortification>>` — JSDoc: WP-873 / D-24818; created lazily by the first Fortify, an entry removed when its Villain is fought, the key deleted when empty.

**Helpers (`board/fortify.logic.ts`, new, pure, no boardgame.io import):**
- `isFortifyPlace(value: unknown): value is FortifyPlace` — membership in `FORTIFY_PLACES`.
- `getFortification(G, place): Fortification | null`.
- `isSidekickStackFortified(G): boolean` — an entry at `'sidekick-stack'` whose lock is `'no-recruit-or-gain'`.
- `isMastermindFortified(G): boolean` — an entry at `'mastermind'` whose lock is `'no-fight'`.
- `listFortifications(G): { place: FortifyPlace; fortification: Fortification }[]` — in `FORTIFY_PLACES` order (a `for...of`), empty without the table.
- `fortifyWithEscapedVillain(G, place, lock, villainCardId): 'fortified' | 'already-fortified' | 'not-in-escape-pile'` — in this order: an existing entry at `place` → `'already-fortified'`, no write; the last index of `villainCardId` in `G.escapedPile` is `-1` → `'not-in-escape-pile'`, no write; else remove that one index from `G.escapedPile` and write `G.fortifications = { ...(G.fortifications ?? {}), [place]: { villainCardId, lock } }` → `'fortified'`. `G.counters` is never touched (Context).
- `removeFortification(G, place): CardExtId | null` — deletes the entry (and `G.fortifications` when it becomes empty); returns the Villain id, or `null` when none.
- `buildFortifyBlockReason(G, place): string | null` — `` `${name} fortifies ${FORTIFY_PLACE_LABELS[place]}. Fight ${name} first.` `` with `name` = `G.cardDisplayData[villainCardId].name` (fallback: the id); `null` without an entry.

**Primitive (`rules/villainAbility.types.ts`):** `'fortify'` appended **last** to `VillainEffectPrimitive` and `VILLAIN_EFFECT_PRIMITIVES` (after whatever is last at execution: `reenter-sewers-if-villain-deck-top` on the baseline, or a sibling draft's primitive if WP-864 / WP-869 / WP-872 lands first); descriptor fields `fortifyPlace?: FortifyPlace` and `fortifyLock?: FortifyLock` (present only on `{ primitive: 'fortify' }`, not part of `descriptorKey`; keyword-less, self-narrating). The marker script's hand-synced list appends it at the same (last) position.

**Grammar (`setup/villainAbility.setup.ts` and the script's check):** `fortify:<place>:<lock>` — exactly 3 colon-parts; `<place>` in `FORTIFY_PLACES`; `<lock>` in `FORTIFY_ALLOWED_LOCKS[place]`. Anything else returns `null` (→ `unresolvedMarkers`), never a partial descriptor. Descriptor: `{ primitive: 'fortify', fortifyPlace, fortifyLock }`.

**Handler (`villain/villainEffects.execute.ts`, `villainEffectFortify`, entry `'fortify'` in `VILLAIN_EFFECT_HANDLERS`):**
- `timing !== 'onEscape'` → no-op, no write, no log.
- `'fortified'` → log `` `${villain} fortifies ${label}: ${lockText} until a player fights ${villain}.` `` (e.g. `Squirrel Girl fortifies the Sidekick Stack: Sidekicks can't be recruited or gained until a player fights Squirrel Girl.`).
- `'already-fortified'` → log `` `${villain} can't fortify ${label}: ${other} already fortifies it, so ${villain} stays in the Escape Pile.` ``.
- `'not-in-escape-pile'` → no write, no log.
- Names via `resolveCardDisplayName(G, id)` (`villainEffects.execute.ts` ~L416), the executor's convention (bare display name, ext-id fallback). Returns the handler application shape the WP-868 keyword-less primitives return.
- **Exhaustiveness.** The handler's branch over the `'fortified' | 'already-fortified' | 'not-in-escape-pile'` result, and every `switch` over `FortifyPlace` / `FortifyLock` (the engine predicates and the projection; the client renders the projected `lockText` / `placeLabel` and never switches on `FortifyPlace` / `FortifyLock`, D-24574), ends in `default: { const unhandled: never = value; … }` with a `// why:` (the WP-871 `isFightRestrictionBlocking` precedent): a follow-up that appends a place or lock without wiring its gate must fail `tsc`, not fortify a place while locking nothing.

**Fight (`moves/fightVillain.ts` + new `moves/fortifyFight.ts`):**
- `FightVillainArgs.fortifiedPlace?: FortifyPlace` (JSDoc: WP-873 / D-24818; when present the move fights the Villain fortifying that place and every other argument is ignored).
- `fightVillain` first statement after the `ctx` / `random` reads: `if (fortifiedPlace !== undefined) { fightFortifyingVillain(G, context, fortifiedPlace); return; }`.
- `export function findFightableFortifier(G, playerId, fortifiedPlace: unknown): { cardId: CardExtId; price: number; required: number } | null` in `moves/villainDefeatRequirement.logic.ts` (boardgame.io-free, already imported by `getLegalMoves`) — the six state checks, in order, each → `null`: `!isFortifyPlace`; no entry; `price = resolveFightPrice(G, cardId, playerId)`, `required = Math.max(0, price)`, and `getSpendableAttackForTarget(G.turnEconomy, UNNAMED_CITY_SPACE_TARGET) < required`; the D-24076 defeat requirement unmet; `getFightRestriction` + `isFightRestrictionBlocking(G, playerId, null, restriction)`; `getFightDiscardCost(G, cardId) !== null` (fail closed: no in-scope fortifier has one). It is the **single authority** the move and the `getLegalMoves` mirror both call; neither re-tests any of the six inline.
- `export function fightFortifyingVillain(G, context, fortifiedPlace: unknown): void`, in order, each a silent `return`: `findFightableFortifier(G, player, fortifiedPlace) === null` → return; `G.currentStage !== 'main'` → return; `hasAnyPendingChoice(G)` → return (a `// why:`: the City block-all cluster plus the two put-bottom-HQ guards; `getLegalMoves` returns early on both, ~L1033 / ~L1053, so the mirror cannot diverge); `hasHealedThisTurn(G)` → return. Then: the D-24802 Size-Changing line via `buildFightSizeChangingLine` when `price !== resolveFightCost(G, cardId, player)`; `defeatFortifyingVillainCore(G, ctx, place, { random })`; `G.turnEconomy = spendFightCostForTarget(G.turnEconomy, required, UNNAMED_CITY_SPACE_TARGET)`; the Microscopic gain `addResources(…, -price, 0)` when `price < 0`; `G.hasActedThisTurn = true`; the D-24467 `villainOrMastermindDefeatedSinceResolve` signal under the same guard as `fightVillain`; `queueEnigmaPeekOffer` when `G.enigmaCode !== undefined`.
- `export function defeatFortifyingVillainCore(G, ctx, place, shuffleContext): void`: `removeFortification` (null → return); the WP-871 `recordVillainDefeated` under `matchHasFightRestrictionKind(G, 'requires-villain-defeated-this-turn')`; push to the current player's Victory Pile; log `` `Player ${player} fought ${villain} fortifying ${label}. ${Label} is no longer fortified.` `` (`Label` = the label with a capital T; `${villain}` = `formatCardRef(G.cardDisplayData, cardId)`, the City fought-line convention, `fightVillain.ts` ~L693); `executeVillainAbilities(G, ctx, cardId, 'onFight', shuffleContext, undefined)` and the core's `Fight effect: …` line when any applied. No `fightResolved` event, no Bystander / Hero award, no Excessive Violence, no paid rescue (Context).
- `isFightRestrictionBlocking` takes `cityIndex: number | null`; the `no-adjacent-villain` arm returns `false` for `null` (a fortifier has no City neighbours). Every existing caller passes its number unchanged.

**Locks:**
- `recruitSidekick` step 1, first check: `if (isSidekickStackFortified(G)) return;`.
- `gainSidekickToDiscard`: `return false` first when `isSidekickStackFortified(G)`.
- `heroEffectGainSidekick`: before the loop, when fortified, log `` `Player ${playerID} could not gain a Sidekick — ${buildFortifyBlockReason(G, 'sidekick-stack')} (${card})` `` with outcome `'blocked'` and `cardId` as the fourth `pushLog` argument (like the existing lines), and return.
- `fightMastermind` step 1, right after the `isMastermindHaunting` return: `if (isMastermindFortified(G)) return;`.
- `getLegalMoves` fightMastermind branch: `&& !isMastermindFortified(gameState)` beside `!isMastermindHaunting(gameState)`.
- `getLegalMoves` fortifier intents: right after the City fight intents, under the same stage / pending gates, for each `listFortifications` entry for which `findFightableFortifier(gameState, activePlayer, place) !== null` (`activePlayer` is `getLegalMoves`'s name for the current player, ~L462): `{ name: 'fightVillain', args: { fortifiedPlace: place } }`.
- `defeatChoice.resolve.ts` free-defeat builders: unchanged (D-24737).

**UIState (`ui/uiState.types.ts`):**
- `export interface UIFortifier { place: FortifyPlace; placeLabel: string; extId: CardExtId; display: UICardDisplay; fightCost: number; lockText: string; fightRestrictionReason?: string; }`
- `UICityState.fortifiers?: UIFortifier[]` — `listFortifications` order; `fightCost` built exactly like `UICityCard.fightCost` (`Math.max(0, resolveFightPrice(gameState, id, ctx.currentPlayer))`); `fightRestrictionReason` = `FIGHT_RESTRICTION_REASONS[kind]` only while `isFightRestrictionBlocking(gameState, ctx.currentPlayer, null, restriction)`; key present only when non-empty. Public (every audience).
- `UIMastermindState.fortifiedReason?: string` — `buildFortifyBlockReason(G, 'mastermind')` while `isMastermindFortified`. Public.
- `UISharedPilesState.sidekickStackFortifiedReason?: string` — `buildFortifyBlockReason(G, 'sidekick-stack')` while `isSidekickStackFortified`. Public.
- `filterUIStateForAudience` copies each field by conditional spread; `fortifiers` entries are rebuilt field by field (`display` deep-copied like a City card's).
- `index.ts`: `export type { UIFortifier }` beside the other UIState type exports; `export type { FortifyPlace }`; and the value `export { UNNAMED_CITY_SPACE_TARGET } from './economy/economy.types.js';` (today only types are re-exported from that module, ~L292, and the package exposes only `.` and `./setup`; the client cost gate needs the value).

**Client (`apps/arena-client/src/components/play/`):**
- **New** `FortifiedVillains.vue` (props `fortifiers`, `currentStage`, `isViewerTurn`, `hasHealedThisTurn`, `economy`, `submitMove`): one tile per fortifier `data-testid="play-fortifier"` showing the Villain name, `Fortifying <placeLabel>`, the lock text and a `Fight N` button `data-testid="play-fortifier-fight"`. Gate order stage (`canFightVillain`) → heal lock → cost (`canFight(fightCost, UNNAMED_CITY_SPACE_TARGET)`) → `fightRestrictionReason`; a blocked button is disabled with the reason as its `title`. Click → `submitMove('fightVillain', { fortifiedPlace: place })`.
- `CityRow.vue`: renders `<FortifiedVillains>` under `<EscapedPile>` in the escaped cell when `city.fortifiers` is non-empty, passing its own props through.
- `MastermindTile.vue` `gateForFight`: after the cost gate, before the tactics check: `if (props.mastermind.fortifiedReason !== undefined) return { allowed: false, reason: props.mastermind.fortifiedReason };`.
- `SharedDecks.vue` Sidekick gate: after the heal lock, before "already recruited", beside the other structural Stack gates (SharedDecks' own local order puts those before the cost check): the same arm on `props.piles.sidekickStackFortifiedReason`.

**Data:**
- `villain-effect-markers.json` `villains.cvwr`: `"great-lakes-avengers": { "squirrel-girl": { "escape": ["fortify:sidekick-stack:no-recruit-or-gain"] } }` and `"heroes-for-hire": { "colleen-wing": { "escape": ["fortify:mastermind:no-fight"] } }` (merged into any existing `cvwr` group keys), plus one `_notes` sentence for the grammar.
- `scripts/coverage/mechanic-provenance.json` (hand-maintained, the WP-868 precedent): a `"fortify": { "wp": "WP-873", "decision": "D-24818" }` row, so the regenerated ledger rows carry the WP and decision.
- `apply-effect-markers.mjs`: `'fortify'` appended last to the hand-synced list; a grammar check mirroring the parser (3 parts; local copies of the two places and the allowed-lock table; loud full-sentence failure).

---

## Scope (In)

- **A)** `board/fortify.types.ts` (new contract), `board/fortify.logic.ts` + test (new), `types.ts`: the unions, arrays, labels, the `Fortification` shape, the `G` field and the helpers.
- **B)** `rules/villainAbility.types.ts` + test, `setup/villainAbility.setup.ts` + test: the primitive (appended last), its descriptor fields and grammar.
- **C)** `villain/villainEffects.execute.ts` + new `villain/cvwrFortify.test.ts`: the handler, end to end on the real regenerated `cvwr.json`.
- **D)** `moves/fightVillain.ts` + test, new `moves/fortifyFight.ts` + test, `moves/villainDefeatRequirement.logic.ts` + test: the argument, the routing, the fortifier fight and core, the nullable `cityIndex`, `findFightableFortifier`.
- **E)** `moves/recruitSidekick.ts` + test, `moves/gainSidekick.logic.ts`, `hero/heroEffects.execute.ts`, `hero/gainSidekick.test.ts`: the Sidekick lock.
- **F)** `moves/fightMastermind.ts` + test: the Mastermind lock.
- **G)** `simulation/ai.legalMoves.ts` + test, `simulation/ai.competent.test.ts`: the mirrors and the scoring pin.
- **H)** `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts`, `index.ts`: the three fields.
- **I)** Client: new `FortifiedVillains.vue` + test; `CityRow.vue`, `MastermindTile.vue`, `SharedDecks.vue` + their tests.
- **I2)** `invariants/gameRules.checks.ts` + `invariants/invariants.test.ts`: each `G.fortifications` entry's `villainCardId` is visited as a card container labelled `fortifications.${place}`, in `FORTIFY_PLACES` order, right after the WP-757 `hqHaunters` loop (~L113-121), so a fortifier also left in a scanned zone is caught. (`checkNoCardInMultipleZones` does not scan `G.escapedPile`; that stays unchanged.)
- **J)** Card data: marker map + script, `cvwr.json` regenerated (two lines), regenerated ledger and feeds.

## Out of Scope

- **Follow-ups A-F** in Context (Wound Stack incl. Luke Cage's hero Fortify; Bystander Stack; HQ space / Hero Deck; Villain Deck / player deck; Officer stack; City-space Fortify by a Mastermind, scheme or tactic).
- **Colleen Wing's Bribe** (an unimplemented keyword everywhere).
- **A `fightResolved` event, Excessive Violence, Baron Zemo's paid rescue and free defeats for a fortifier fight.** The fortifier fight is the plain fight.
- **Bot Sidekick recruiting** (the bot does not recruit Sidekicks today).
- **Logging a refused fight or recruit.** Silent, like every other precondition.
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `board/fortify.types.ts`, `board/fortify.logic.ts`, `board/fortify.logic.test.ts` — **new**
- `types.ts`, `index.ts` — modified
- `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts` — modified
- `setup/villainAbility.setup.ts`, `setup/villainAbility.setup.test.ts` — modified
- `villain/villainEffects.execute.ts` — modified; `villain/cvwrFortify.test.ts` — **new**
- `moves/fightVillain.ts`, `moves/fightVillain.test.ts` — modified; `moves/fortifyFight.ts`, `moves/fortifyFight.test.ts` — **new**
- `moves/villainDefeatRequirement.logic.ts`, `moves/villainDefeatRequirement.logic.test.ts` — modified
- `moves/recruitSidekick.ts`, `moves/recruitSidekick.test.ts`, `moves/gainSidekick.logic.ts` — modified
- `hero/heroEffects.execute.ts`, `hero/gainSidekick.test.ts` — modified
- `moves/fightMastermind.ts`, `moves/fightMastermind.test.ts` — modified
- `simulation/ai.legalMoves.ts`, `simulation/ai.legalMoves.test.ts`, `simulation/ai.competent.test.ts` — modified
- `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — modified
- `invariants/gameRules.checks.ts`, `invariants/invariants.test.ts` — modified (`G.fortifications` scanned as a card container)

**Client (`apps/arena-client/src/components/play/`)**
- `FortifiedVillains.vue`, `FortifiedVillains.test.ts` — **new**
- `CityRow.vue`, `CityRow.test.ts`, `MastermindTile.vue`, `MastermindTile.test.ts`, `SharedDecks.vue`, `SharedDecks.test.ts` — modified

**Scripts and data**
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json` — modified
- `data/cards/cvwr.json` — regenerated (two lines each gain one marker)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`, `data/metadata/effect-implementation-index.json` — regenerated
- Only if the regeneration moves them (record either way): `data/metadata/card-mechanics.json`, `docs/ai/coverage/runtime-observed-hollows.json`, `scripts/coverage/hero-effect-coverage.baseline.json`, `apps/dashboard/src/data/in-play-hollow-baseline.json` + `apps/dashboard/src/composables/useInPlayCoverage.test.ts` (the in-play pin)

**Governance:** `docs/ai/DECISIONS.md` (D-24818), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (LANDED note) — modified; `docs/ai/coverage/live-verify.json` — modified (pending rows for the two cards at execution, the WP-868 precedent; flipped only when the live-verify is observed); `docs/ai/post-mortems/01.6-WP-873-fortify-keyword.md` — **new** (01.6 mandatory: a new contract file consumed by six follow-up packets, a new `G` table, a second fight path, new projection fields).

That is 33 engine files (14 tests, 6 new), 8 client files (4 tests, 2 new), 3 script/input files, 1 card-data file and up to 8 generated feeds. Above the ~10 guideline because a keyword system must land its state, its trigger, its release (the fight), the bot mirror, the projection and the client together (D-24364: a lock without the fight to release it strands the place; a fight without its mirror freezes the bot; a lock without the projection shows a live button the engine refuses). Every modified test file exists on the baseline.

## Contract

- The Locked Values above: the place / lock unions and arrays, `FORTIFY_ALLOWED_LOCKS`, the labels and lock texts, `Fortification`, `G.fortifications`, the helpers, the primitive (appended last) and its grammar, the handler outcomes and log lines, `FightVillainArgs.fortifiedPlace`, `fightFortifyingVillain` and `defeatFortifyingVillainCore` and their check order, the nullable `cityIndex`, the five lock sites, the two `getLegalMoves` mirrors, the three UIState fields, the client gate orders and test ids.
- City `fightVillain` calls, `defeatCityVillainCore`, `getLegalMoves`'s City intents, every existing UIState field and every other villain primitive are unchanged.

## Test Contract

Minimal-`G` fixtures in each file's existing style, except T9-T13 which read the real regenerated `cvwr.json`. Each T-case is at least one `it`, grouped under one `describe('WP-873 …')` per file. Drift and keyset pins are **runtime** assertions (WP-563 / D-24372).

| # | File | Input | Expected | Must NOT / invariant |
|---|---|---|---|---|
| T1 | fortify.logic | `FORTIFY_PLACES`, `FORTIFY_LOCKS`; `FORTIFY_ALLOWED_LOCKS`, `FORTIFY_PLACE_LABELS`, `FORTIFY_LOCK_TEXT` | exact arrays in canonical order; `FORTIFY_ALLOWED_LOCKS` deep-equals the locked value; the label and text records keyed by exactly the array members (runtime keyset checks) | |
| T2 | fortify.logic | `fortifyWithEscapedVillain` with the card at the end of `G.escapedPile`, counter 3, no table | `'fortified'`; card removed (one index); counter still 3; `G.fortifications` has exactly the one entry | other pile cards keep order |
| T3 | fortify.logic | same place again with a second id in the pile; an id not in the pile | `'already-fortified'` (no write); `'not-in-escape-pile'` (no write) | |
| T4 | fortify.logic | `removeFortification` on the only entry; on a missing place; `isSidekickStackFortified` / `isMastermindFortified` / `listFortifications` / `buildFortifyBlockReason` before and after | id then `null`; `G.fortifications` key deleted when empty; predicates and reason track the entry | |
| T5 | types | `VILLAIN_EFFECT_PRIMITIVES` | `'fortify'` is the last entry and the length grew by exactly one from the HEAD baseline (bump every length site in `villainAbility.types.test.ts`, ~L413 and ~L641, the last-entry assert and its message, the `expectedPrimitives` literal (~L379-421) and the position-history comment (~L355), the WP-868 wording); union parity (runtime) | |
| T6 | setup | `fortify:sidekick-stack:no-recruit-or-gain`, `fortify:mastermind:no-fight` | the two descriptors | |
| T7 | setup | `fortify`, `fortify:sidekick-stack`, `fortify:mastermind:no-recruit-or-gain`, `fortify:wound-stack:no-fight`, `fortify:mastermind:no-fight:1` | `null` each (→ unresolved) | never throws |
| T8 | setup | the two regenerated Escape lines copied **verbatim** from `cvwr.json` through the hook builder | one `onEscape` hook each with the T6 descriptor | |
| T9 | cvwrFortify | a reveal that pushes Squirrel Girl out of a full City (real card data) | she is in `G.fortifications['sidekick-stack']`, not in `G.escapedPile`; escape counter +1 (the escape counts); the HQ-KO procedure is still enqueued; the fortify log line verbatim; no `unmarked-ability` hollow record for her | |
| T10 | cvwrFortify | Colleen Wing escapes the same way | `G.fortifications.mastermind` holds her; `isMastermindFortified` true | |
| T11 | cvwrFortify | the second Squirrel Girl copy escapes while the first fortifies | the second stays in `G.escapedPile`, counter +1, the "can't fortify" line verbatim | one per place |
| T12 | cvwrFortify | Squirrel Girl escapes carrying a Bystander | the Bystander is in `G.escapedPile`; she is not | |
| T13 | cvwrFortify | Squirrel Girl's id IS in `G.escapedPile`, no table; the handler invoked at `onFight` and at `onAmbush` | `G.escapedPile` and `G.fortifications` unchanged; no log line | escape-only (the timing guard, not the pile check, refuses) |
| T14 | fortifyFight | Squirrel Girl fortifying, attack 3, main stage, one card in play; `fightVillain({ fortifiedPlace: 'sidekick-stack' })` | in the Victory Pile; table key deleted; attack 0; `hasActedThisTurn`; the fought line verbatim | |
| T14b | fortifyFight | the T14 fight in a match whose `villainFightRestrictions` holds a `requires-villain-defeated-this-turn` entry; and in one without | `turnEconomy.hasDefeatedVillainThisTurn === true`; the key absent | the Orrgo recorder, lazy |
| T15 | fortifyFight | refusals, each with `G` deep-equal before/after: unknown place; no entry; attack 2; two cards in play (her WP-871 restriction); `currentStage: 'start'`; a pending choice; healed this turn | silent return | |
| T16 | fortifyFight | Colleen Wing fortifying, attack 9; a minimal-`G` fortifier whose card has a Size-Changing class the fighter has played (the file's fixture style), attack equal to the discounted price | each defeated; the second logs the D-24802 line | price via `resolveFightPrice` |
| T17 | fightVillain | a City villain at 0 and Squirrel Girl fortifying; `{ cityIndex: 0 }` | the City villain is fought exactly as before; the fortification untouched | City path byte-identical |
| T18 | villainDefeatRequirement.logic | `isFightRestrictionBlocking` with `null` for each kind, on a fixture whose `city[0]` and `city[1]` are occupied | `no-adjacent-villain` → false; the other two unchanged | a `null ± 1` read would block |
| T19 | recruitSidekick | fortified Stack, 2 recruit, main stage | `G` deep-equal | |
| T20 | gainSidekick (hero) | `gain-sidekick` effect while fortified; and after the fortification is removed | no gain, the `blocked` line naming Squirrel Girl verbatim; then the normal gain | |
| T20b | gainSidekick (hero) | `gainSidekickToDiscard(G, '0')` called directly while fortified | `false`; `piles.sidekicks` and the discard pile unchanged | the helper lock, unreachable through T20 |
| T21 | fightMastermind | Mastermind fortified, attack enough | `G` deep-equal; after `removeFortification` the fight proceeds | |
| T22 | legalMoves | Squirrel Girl fortifying, attack 3, main stage: one card played; two cards played; `currentStage: 'start'`; attack 2; and the Mastermind fortified with enough attack | `{ name: 'fightVillain', args: { fortifiedPlace: 'sidekick-stack' } }` present; absent (her restriction); absent; absent; no `fightMastermind` intent | mirrors the move |
| T23 | legalMoves | no table | intents equal the pre-WP fixture output exactly | byte-identical |
| T24 | ai.competent | scoring a `{ fortifiedPlace }` fightVillain intent | a finite score (the base fight score), no throw | |
| T25 | ui filter | each field through `filterUIStateForAudience` for player 0, player 1 and a spectator; a state without them | survive equal for all three; absent keys stay absent | five-step step 4 |
| T26 | ui filter | `buildUIState` with Squirrel Girl fortifying and two cards in play; Colleen Wing fortifying | `city.fortifiers[0]` keyset includes `fightRestrictionReason`, `fightCost: 3`, the label and lock text; `mastermind.fortifiedReason` and `piles.sidekickStackFortifiedReason` verbatim | built-projection pin |
| T27 | FortifiedVillains | a fortifier, affordable, viewer's Main stage; click | `fightVillain` submitted with `{ fortifiedPlace }` | |
| T28 | FortifiedVillains | not the viewer's turn; unaffordable; `fightRestrictionReason` set | disabled with the stage / cost / restriction reason, in that precedence | gate order |
| T29 | CityRow | `city.fortifiers` with one entry; absent | the tile renders in the escaped cell; nothing renders | |
| T30 | MastermindTile | `fortifiedReason` set, affordable | Fight disabled with that reason; no submit | |
| T31 | SharedDecks | `sidekickStackFortifiedReason` set, recruit 2 | Recruit Sidekick disabled with that reason | |
| T32 | invariants | a state whose `G.fortifications['sidekick-stack']` holds a Villain also in `playerZones['0'].victory` (a fight that skipped `removeFortification`); the same state with it only in the table | `runAllInvariantChecks` throws `InvariantViolationError` with category `'gameRules'` and a message naming `fortifications.sidekick-stack`; no throw | the container scan (the Escape Pile is not a scanned container) |
| T33 | villainDefeatRequirement.logic | `findFightableFortifier` for each of the six refusals and for a fightable fortifier | `null` each; `{ cardId, price, required }` | the single authority |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** the two groups appear in published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`); those legs change (two escapes lock a place and leave the Escape Pile, so the Escape Pile holds two fewer cards; the escape counter, score penalty and HUD are unchanged). No committed `data/par` artifact references them; nothing is re-pinned.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (card fidelity; no paid or persuasive surface).

**Determinism preservation:**
- `G.fortifications` exists only after a Fortify fires and is deleted when empty; the primitive exists only on two `cvwr` Escape lines. No randomness. UIState fields are never hashed.
- `getLegalMoves` output is unchanged without a fortification, so sim, PAR and bot runs on other loadouts are byte-identical.
- `finalStateHash` and `PRE_WP080_HASH` are expected unchanged (Assumes 13); if either moves, STOP and explain before any re-pin.
- **Replay-compat:** a stored match replays from its bgio `initialState`, which holds the setup-built villain hooks; a pre-WP-873 match has no `fortify` hook, so its escapes replay identically. Only a new setup sees the markers (auto-memory `reference_setup_hook_change_replay_compat`). Recorded in D-24818.

## Funding Surface Gate

§20 **N/A**: engine, card data and gameplay buttons only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Types, helpers and invariants.** T1-T5, T32 and T33 pass.
2. **Grammar.** T6-T8 pass. The marker script runs `main()` on import, so its rejection side is checked by hand: put `fortify:mastermind:no-recruit-or-gain`, `fortify:wound-stack:no-fight` and `fortify:sidekick-stack` into the map one at a time, run the script, observe a loud full-sentence failure, revert. Record the observed failures in the `EC-911:` commit body.
3. **Escape.** T9-T13 pass.
4. **Fight.** T14-T18 pass; every refusal leaves `G` deep-equal.
5. **Locks.** T19-T21 pass.
6. **Bot.** T22-T24 pass.
7. **Projection.** T25-T26 pass.
8. **Client.** T27-T31 pass; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
9. **Data.** `apply-effect-markers.mjs` reports 2 new markers and re-runs at 0; `git diff data/cards/` touches only `cvwr.json`, two lines, each gaining one trailing `[effect:fortify:…]` marker.
10. **Ledger.** In the regenerated ledger, Squirrel Girl and Colleen Wing are no longer `(unmarked),unmarked`; record their new rows verbatim; no other row changes except the regeneration's own derived columns for those two.
11. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `cards:check`, `cards:count-markers:check`, `effect-index:check`, `effect-index:test`, `registry:validate`, `ledger:villains:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check` exit 0 after the regeneration in Verification Steps.
12. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `node scripts/convert-cards/apply-effect-markers.mjs`; re-run → 0 new markers. `git diff --stat -- data/cards/` → only `cvwr.json`. (Before step 3: T8-T13 read the regenerated card data.)
3. `pnpm --filter @legendary-arena/game-engine test` → all pass; record before / after totals.
4. `pnpm -r build` again (the ledger reads the engine dist), then `pnpm ledger:villains && pnpm effect-index`.
5. `pnpm --filter @legendary-arena/dashboard prebuild:coverage && pnpm --filter @legendary-arena/dashboard prebuild:effect-index` (the dashboard tests read gitignored copies of the regenerated feeds, the WP-868 precedent), then `pnpm cards:check && pnpm cards:count-markers:check && pnpm effect-index:check && pnpm effect-index:test && pnpm registry:validate && pnpm ledger:villains:check && pnpm ledger:heroes:check && pnpm mechanics:metadata:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0. A generated feed that moves is regenerated by its own `:write` script and listed in the commit body; if `sim:coverage --check` or a hash oracle moves, STOP (Assumes 13 is false).
6. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0.
7. After governance close: `pnpm roadmap:counts:check && pnpm ledger:numbers:check && pnpm workindex:rows:check && pnpm workindex:executed:check` → exit 0. `git diff --name-only origin/main...HEAD` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
8. Revert proofs, one at a time, each must fail at least one T-case: drop the `pull out of the Escape Pile` step (T2/T9); drop the `already-fortified` check (T11); drop the `fortifiedPlace` routing in `fightVillain` (T14); drop the restriction check in `findFightableFortifier` (T15, T22 two-cards case, T33); in `fightFortifyingVillain`, skip the `findFightableFortifier` call and read the entry directly (T15); drop the `recruitSidekick` lock (T19); drop the `fightMastermind` lock (T21); drop the fightMastermind mirror (T22); drop the `fortifiers` spread from the filter (T25); drop the MastermindTile arm (T30); in the `getLegalMoves` fortifier loop, push every `listFortifications` entry without calling `findFightableFortifier` (T22: two cards played / attack 2 must be absent); drop the fortifier intent loop (T22); drop the handler timing guard (T13); drop the `gainSidekickToDiscard` lock (T20b); drop the Orrgo recorder in `defeatFortifyingVillainCore` (T14b); drop the `mastermind.fortifiedReason` spread in `filterUIStateForAudience` (T25; the Mastermind filter is a field-by-field whitelist, the PR #1165 class); drop the SharedDecks arm (T31); drop `fortifiedPlace` from the `FortifiedVillains` submit (T27); drop the `heroEffectGainSidekick` pre-loop blocked line (T20); drop the `G.fortifications` loop in the invariant scan (T32). (`piles.sidekickStackFortifiedReason` passes through the filter by the `...uiState.piles` spread, ~L766; T25 pins it, a revert proof there would be vacuous.)

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the twenty revert proofs were observed.
- [ ] D-24818 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated, including the follow-up lines A-F, Colleen Wing's Bribe, the fortifier-fight residuals (no `fightResolved` event, Excessive Violence, paid rescue or free defeat), and the Bribe note: a future Bribe implementation must cover `fightFortifyingVillain` and its `getLegalMoves` mirror, not only the City fight.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] 01.6 post-mortem authored (`docs/ai/post-mortems/01.6-WP-873-fortify-keyword.md`).
- [ ] Two-commit topology: `EC-911:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED), deployed gitSha checked. The hooks are built at setup, so the match's setup MUST list `cvwr/great-lakes-avengers` and `cvwr/heroes-for-hire` (autoplay setupData or a lobby config); the operator setter pane then stages the City so each escapes (recipe: auto-memory `reference_operator_match_live_verify_recipe`).
  - Squirrel Girl escapes: the fortifier tile shows under the Escaped Pile, she is not in the Escaped Pile, the Recruit Sidekick button is disabled with `Squirrel Girl fortifies the Sidekick Stack. Fight Squirrel Girl first.`; fighting her (one card played) re-enables it.
  - Colleen Wing escapes: the Mastermind Fight button is disabled with her reason; fighting her re-enables it.
  - The Play Diagnostics `uiStateSnapshot` shows `city.fortifiers`, `mastermind.fortifiedReason` and `piles.sidekickStackFortifiedReason` (five-step step 5).

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24818 — fortify-keyword.** It locks:
- the authorized contract-file changes: new `board/fortify.types.ts`; `rules/villainAbility.types.ts` (`'fortify'` appended last, `fortifyPlace?`, `fortifyLock?`); `ui/uiState.types.ts` (`UIFortifier`, `UICityState.fortifiers?`, `UIMastermindState.fortifiedReason?`, `UISharedPilesState.sidekickStackFortifiedReason?`);
- Fortify is a keyword-less villain primitive `[effect:fortify:<place>:<lock>]` that fires only at `onEscape`; the place and lock unions, the allowed-lock table, the labels and texts;
- a fortifying Villain leaves the Escape Pile (rules v23 L3182-3184) and the escape counter still counts the escape (rules L3265; score and HUD unchanged); the owed HQ KO / Bystander discard still resolve; carried Bystanders and captured Heroes stay in the Escape Pile; one Villain per place, and a second fortifier stays in the Escape Pile (L1465-1466);
- `G.fortifications` is the one lazy table, written only by the two helpers, keyed by place, deleted when empty, and scanned as a card container by the game-rule invariants;
- a fortifier is fought through `fightVillain({ fortifiedPlace })`, a branch before any City read, and `findFightableFortifier` is the one authority for that fight and its `getLegalMoves` mirror; the plain fight: Size-Changing price at the unnamed target, defeat requirement, the WP-871 restriction with a `null` City index, fail-closed on a discard cost, the same stage / pending / heal gates, Victory Pile, Fight effects, no `fightResolved` event, no Excessive Violence, no paid rescue;
- the Sidekick lock gates the recruit move and the effect gain (with a `blocked` line naming the fortifier); the Mastermind lock gates `fightMastermind` and its bot mirror, and free defeats ignore it (D-24737);
- the three public UIState fields, engine-written reasons, and the client gate positions;
- the follow-up split A-F and the replay-compat note.

---

## Gate Record

All three gates ran as independent subagents, in order, against the code at `6426eb23`. Every fix is text in this WP / EC; none moved the layer, the lane or the allowlist category.

**Pre-flight (01.4), round 1: NOT READY, two blocking fixes, both applied.**
- **PS-1:** the draft decremented `G.counters[ESCAPED_VILLAINS]` when a Villain fortifies. No loss condition reads that counter (they count `G.escapedPile`); it is the escape-event count behind the score penalty and the HUD, and rules L3265 scores every escape. Now only the pile changes (Context, Locked Values, T2 / T3 / T9, D-24818).
- **PS-2:** the client could not import `UNNAMED_CITY_SPACE_TARGET` (only types were re-exported). `index.ts` now exports the value.
- **RS-1 to RS-11, all applied:** `mechanic-provenance.json` row required; the `enterCityIgnoringAmbush` escape caller; every length site in T5; the import-cycle note; the `hasAnyPendingChoice` note; SharedDecks gate wording; file counts; the invariant gap; pending `live-verify.json` rows; the no-ARCHITECTURE-edit note; `cardId` on the blocked log line.

**Pre-flight, round 2: READY TO EXECUTE.** It also confirmed the T16 correction (Colleen Wing has no Size-Changing; the D-24802 case uses a fixture fortifier).

**Copilot (01.7), round 1: RISK (HOLD), five fixes, all applied.**
1. Modes 11 / 30: T22 now covers the restriction branch of the bot mirror.
2. Mode 11: T13 with the card in the pile, T14b (Orrgo recorder), T18 fixture with City neighbours, T20b (helper lock), and nine more revert proofs.
3. Modes 12 / 30: dashboard `prebuild:coverage` / `prebuild:effect-index`, `effect-index:test` and `registry:validate` added to Verification.
4. Modes 10 / 14 / 22: `never` exhaustiveness defaults; T1 deep-equals `FORTIFY_ALLOWED_LOCKS`.
5. Modes 4 / 26: T5 names the `expectedPrimitives` literal; the Bribe STATUS note.

**Copilot, round 2: PASS (CONFIRM).** One wording nit applied (the client renders projected `lockText`, never switches on the unions). Outside its lens it noted a papercut: `MastermindTile` ignores `mastermind.isHaunting`, so a haunting Mastermind shows a live Fight button the engine refuses (a separate small fix).

**Lint (00.3), round 1: FAIL, two fixes, both applied.**
- §2: the handler names via `resolveCardDisplayName`, the fought line via `formatCardRef`.
- §4: the Layer Boundary citation for the new `.`-surface value export.
- EC: `${player}` in the fought line. Advisories adopted: A1 `findFightableFortifier` as the single authority for the move and the bot mirror (T33); A2 feed count; A3 competitive wording; A4 the invariant scan of `G.fortifications` (T32).

**Pre-flight, round 3 (delta): NOT READY → fixed.** T32 used an Escape-Pile duplicate, but the invariant scan does not visit `G.escapedPile`; T32 now uses a Victory-Pile duplicate. It load-tested the new `villainDefeatRequirement.logic` → `economy.resolve` cycle on a scratch copy (225 targeted tests, 0 fail) and declared no further round needed.

**Copilot, round 3 (delta): RISK (HOLD), one fix applied.** The step-8 revert proofs were retargeted to `findFightableFortifier` and its two call sites (twenty in total). **Confirm pass: PASS (CONFIRM).**

**Lint, round 2 (delta): PASS.** EC-911 has 95 content lines.

**Final gate state:** pre-flight READY TO EXECUTE · copilot PASS (CONFIRM) · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run (round 2, post-fix state).

| § | Result |
|---|---|
| §1 | PASS — all required sections; Out of Scope has 6 items |
| §2 | PASS after fix — engine-wide block, session protocol, Locked Values; name helpers agree with the verbatim T-cases |
| §3 | PASS — 14 Assumes items, anchors verified at HEAD |
| §4 | PASS after fix — 00.2 §1.4 / §5, ARCHITECTURE Move Validation / Principles #2 / Persistence / Layer Boundary, the rules sections, the DECISIONS read list |
| §5 | PASS — full allowlist incl. the invariants pair, the 01.6 post-mortem and conditional feeds; 33 + 8 files justified |
| §6 | PASS — `UIFortifier` names match `UICityCard`; booleans `is…`; slugs match `cvwr.json` |
| §7 | PASS — no new dependencies |
| §8 | PASS — the engine decides through one authority; the client gates on projected fields and imports the `.` surface only |
| §9 | PASS — pnpm / node / git commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth |
| §12 | PASS — node:test, minimal-`G` and real-data fixtures, runtime pins; hash oracles stand in for the golden test |
| §13 | PASS — exact commands with exit-0 / marker-count expectations; 20 revert proofs mapped to T-cases |
| §14 | PASS — 12 binary criteria tied to T1-T33 |
| §15 / §15.1 / §15.2 | PASS — STATUS, DECISIONS, indexes, post-mortem, allowlist-only diff; D-24026 live-verify on `play.legendary-arena.com`; MEDIUM tier identical in the EC |
| §16 | PASS — 00.6 mandated, `never` defaults locked, the move stays short via `findFightableFortifier`, `// why:` list |
| §17 | PASS — §1 / §8 / §22-24 / NG-1 cited; conflict line; determinism + replay-compat |
| §18 | N/A — no forbidden-token grep step |
| §19 | N/A at draft — applies to the STATUS entry and post-mortem at close |
| §20 | PASS — N/A with reason (no funding surface) |
| §21 | PASS — N/A with reason; no `apps/server/src` surface |

EC-911 vs EC-TEMPLATE: PASS (all sections, 95 content lines under the 100 ceiling, arena-client typecheck gated before and after).

**Verdict:** PASS.
