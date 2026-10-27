# WP-840 — co2e The Blob guards the Mastermind: a Villain held beside the Mastermind, fought there, who blocks every Mastermind fight (Game Engine + Arena Client + card data)

**Status:** Draft 2026-10-25 — pre-flight READY, BLOCKED ON WP-831; 01.7 RISK → fixes 1-5 applied; 00.3 PASS (EC-878; **D-24773** reserved (#3010)). See §Gate Record.
**Primary Layer:** Game Engine (a new off-City Villain position, one villain primitive, a `fightVillain` location argument, the `fightMastermind` gate and its bot mirror, one UIState field) + Arena Client (the Villain beside the Mastermind and the Mastermind Fight lock) + card data and the derived coverage feeds.
**Dependencies:** **WP-831 (hard; PR #3001, `claude/wp831-exec` head `0585f811`, rebased after WP-830 #2998 merged as `e580d801` and tree-identical to the earlier heads `a6e8dfa5` / `9e710dfb` (`git diff a6e8dfa5 0585f811` is empty); anchors were first read at `dfc118c8`, code-identical; only #3001 remains to merge)**, which rewrites `moves/fightVillain.ts` (index guard, fight target), `simulation/ai.legalMoves.ts` (fight branch), `economy/economy.types.ts` / `economy.logic.ts` (`AttackTargetName`), and the client City / Mastermind files this packet edits. WP-831 was stacked on WP-829 (#2995, merged as `461ed924`) and WP-830 (#2998, The Unbreakable Enigma Code, which adds the `fightMastermind` guess gate and rewrites `MastermindTile.vue`; merged as `e580d801`), so only #3001 must merge first. Soft (ordering only): WP-835..839 (same marker map, primitive array, executor and `co2e.json`; whichever lands first takes the next primitive position). WP-838 and WP-839 also edit `defeatCityVillainCore`'s defeat half (WP-838's Step 3c attached-hero branch, WP-839's Boomerang block after Endless Armies). If either landed, carry its block verbatim into `defeatVillainCardCore` (neither reads `cityIndex`, so the three location reads are unchanged); if WP-840 lands first, their edits go into `defeatVillainCardCore`. If WP-832 (#3004) merges first, re-read the `villainDeck.reveal.ts` / `notableEvents.types.ts` anchors; no semantic overlap. WP-759 (Draft, Haunt client) also adds a lock to `MastermindTile.vue` `gateForFight`; whichever lands second keeps both locks, after cost; the vanquished check keeps precedence. Builds on WP-757 / D-24587 (the Haunt precedent: an Ambush that moves a Villain out of the City into a lazy off-City field and blocks the Mastermind fight), WP-817 / D-24750 (fight-argument preconditions; only `fightVillain` pays fight restrictions), WP-554 / D-24363 + D-24364 (every move gate ships with its `getLegalMoves` mirror), WP-790 / D-24652 (fight targets), WP-750 / D-24574 (the client gates on projected data), WP-128 / D-12803 (the UIState whitelist).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It changes four contract files (`rules/villainAbility.types.ts`, `ui/uiState.types.ts`, `economy/economy.types.ts`, and a doc-comment line in `events/notableEvents.types.ts`), adds a `G` field, a villain primitive, a `fightVillain` argument and a client component.
**Arc:** co2e villain fidelity epic (WP-835..840), inventory row #7.

> Baseline: drafted on `origin/main` at the reserve squash `677c4109` (#3010, on top of `5e045fa9` #3009 and `f260d148`); `origin/main` is now `e580d801` (#2998, WP-830 merged, after #2995 WP-829 at `461ed924`); the WP-831 anchors below were read on `origin/claude/wp831-exec` at `dfc118c8` and are code-identical on its current head `0585f811` (rebased onto `e580d801`; `git diff a6e8dfa5 0585f811` is empty, so no cited code changed). Only #3001 remains to merge. Re-read every line anchor, the primitive count and the test totals at execution, after WP-831 merges.

---

## Goal

As a player facing Magneto's Brotherhood (Legendary core 2nd edition, `co2e`), I want The Blob to do what his card prints, so that he guards the Mastermind instead of being a free 2 VP Villain.

| Card (`co2e/brotherhood-of-mutants`) | Printed line (verbatim, `data/cards/co2e.json`) | Today | After this session |
|---|---|---|---|
| The Blob (Attack 4, VP 2, 2 copies) | `Ambush: Put The Blob to the left of the Mastermind space. Nothing moves The Blob. While he's there, you can't fight the Mastermind. (You can still fight The Blob.)` | No marker. He enters the City like any Villain, the Ambush does nothing, and the D-24266 detector logs it as hollow (`villain unmarked-ability onAmbush no-handler`). | He enters the City (pushing as usual), then his Ambush takes him out of the City to a spot beside the Mastermind. City movement, pushes and escapes can't reach him there. While he (or the other copy) is there, the Mastermind can't be fought. Any player can fight him there for his printed 4 Attack; he goes to their Victory Pile as normal. |

The core-set Blob (`core/brotherhood`, `[require-to-defeat:team:x-men]`) is a different card and is not touched.

## User-Visible Impact

- When The Blob is revealed, the log says he moves to the left of the Mastermind and the Mastermind can't be fought while he is there. He disappears from the City and appears beside the Mastermind tile.
- The Mastermind's Fight button is disabled while he is there, with the reason `You can't fight the Mastermind while The Blob is beside it — fight The Blob first`. The Excessive Violence button for the Mastermind is hidden too.
- The Blob beside the Mastermind has his own Fight button (enabled on the viewer's Main stage with 4 Attack, after the heal lock). Fighting him logs `Player N fought The Blob beside the Mastermind.` and re-enables the Mastermind once no Blob is left there.
- Bots (bot-ally, autoplay, sim, PAR) fight him when they can and never try to fight the Mastermind while he is there.
- When both copies have ambushed, both sit beside the Mastermind (arrival order) and both must be fought.

---

## Assumes

1. **Rules text** (`docs/legendary-universal-rules-v23.md`):
   - L547-571: a Villain entering the City pushes the others; one pushed off the last space escapes; escapes resolve in three steps.
   - L573-576: the new Villain's Ambush resolves after any escape it caused.
   - L1299-1301 ("Defeat"): "When a card tells you to 'defeat an enemy,' you still do that enemy's Fight effect. You ignore restrictions like Zero and Forearm." (basis of the Operator fork 1 default).
   - L1507-1543 (Haunt, the precedent): a Villain outside the City can't be fought there; the Mastermind can't be fought while it haunts.
2. **Card data.** `data/cards/co2e.json` group `brotherhood-of-mutants` (`ledBy: ["magneto"]`) prints the Blob line in §Goal verbatim, `vAttack "4"`, `vp "2"`, `copies: 2` (instance ids `co2e-villain-brotherhood-of-mutants-the-blob-00` / `-01`, the `villainEffects.execute.test.ts` L4756 id shape). On draft `main`, `scripts/convert-cards/inputs/villain-effect-markers.json` L91-101 has a `co2e` villains block with `masters-of-evil` and `skulls` only. If any sibling WP-835..839 merged first, its rows (including other `brotherhood-of-mutants` cards: Juggernaut, Mystique, Sabretooth) sit beside these (expected; EC Before Starting). What must hold: The Blob's line carries no `[effect:]` marker and has no map row. Ledger row `co2e-villain-brotherhood-of-mutants-the-blob` is `(unmarked)` (`docs/ai/coverage/villain-mechanic-ledger.csv` L150; `effect-implementation-index.json` L5889).
3. **The Haunt precedent** (`board/haunt.logic.ts`, `villain/villainEffects.execute.ts` `villainEffectHauntHqHero` ~L3720): an Ambush handler finds its `cardId` in `G.city`, records it in a lazy off-City field, nulls the City space, and self-narrates with one `pushLog` line; the reveal path's `ambushResolved` then records `citySpace` 0 (the `indexOf` fallback, `villainDeck/villainDeck.reveal.ts` ~L376-379), accepted by D-24587. `fightMastermind` returns silently while `isMastermindHaunting(G)` (`moves/fightMastermind.ts` L155 on WP-831); the bot mirrors it (`simulation/ai.legalMoves.ts` step 4, ~L1137-1142 on WP-831).
4. **Ambush fire site** (`villainDeck/villainDeck.reveal.ts`): `pushVillainIntoCity` (~L278), the escape via `resolveVillainEscape` (~L311), then `executeVillainAbilities(G, ctx, cardId, 'onAmbush', { random }, undefined)` (~L347), then the `ambushResolved` push. Every Ambush-firing City entry goes through `performVillainReveal`; `enterCityIgnoringAmbush` (exorcise) and the Secret Invasion push fire no Ambush.
5. **`fightVillain` on WP-831** (`moves/fightVillain.ts`): `FightVillainArgs` (L107) with required `cityIndex`; step 1 index guard `cityIndex >= G.city.length` (L160), `fightTarget = citySpaceNameForIndex(cityIndex) ?? UNNAMED_CITY_SPACE_TARGET` (L174), Guard check (L181), cost (`resolveFightCost` + Patrol vs `getSpendableAttackForTarget`), defeat requirement, discard cost (L222); stage gate (L239); block-all guards; heal lock (L300); step 3 discard, Zemo rescue decision, `defeatCityVillainCore(G, ctx, cityIndex, …)` (L339), EV, `spendFightCostForTarget`, `hasActedThisTurn`, the deferred-grant signal, `queueEnigmaPeekOffer` (L395). `defeatCityVillainCore` (L516, exported; its other production caller is `moves/defeatChoice.resolve.ts` L230, through which Silent Sniper, Pure Fury and Cruel Ruler route, plus two direct test calls at `fightVillain.test.ts` L553 / L582) nulls `G.city[cityIndex]` (L537), routes the card, awards attachments, optional Zemo rescue, `executeVillainAbilities(…, 'onFight', shuffleContext, cityIndex)` (L615), logs `Player ${p} fought ${ref} at city space ${cityIndex}.` (L623), pushes `fightResolved` with `citySpace: cityIndex` (L676), then the Endless Armies play.
6. **Location-dependent costs read `G.city`.** `resolveFightCost` (`economy/economy.resolve.ts` L94) adds Dark Portal, Bank Robbery, Blood Frenzy and Abomination terms and subtracts `cityFightCostReduction`, which reads `G.city.indexOf(cardId)` and gives 0 when absent (L134-150); the Dark Portal and Abomination terms read the City index the same way. So a Villain outside the City resolves to its printed / dynamic cost. The onFight location gate fails closed on `cityIndex === undefined` (`executeVillainAbilities` L134-150 JSDoc).
7. **Fight targets** (WP-831 `economy/economy.types.ts` L17-23): `AttackTargetName = CitySpaceName | 'mastermind' | typeof UNNAMED_CITY_SPACE_TARGET`; `ATTACK_TARGET_LABELS` (`economy/economy.logic.ts` L698-706) is a `Record<AttackTargetName, string>`, the only exhaustive map. Restricted grants are parsed from printed space names and `Mastermind` only (`setup/heroAbility.setup.ts` `parseAttackRestrictionTargets`), so a new target value is matched by no grant.
8. **Free defeats** go through `isMastermindFreeDefeatTarget` (`moves/defeatChoice.resolve.ts` L89) for the Mastermind and iterate `G.city` for Villains (`buildDefeatWithBystanderTargets`, Pure Fury, Cruel Ruler).
9. **Villain primitives.** `VillainEffectPrimitive` / `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts` L434-482) hold **31** members on the baseline, last `discard-hero-each-player-by-cost`. `villainAbility.types.test.ts` pins the array in five assertions across three tests: L393-397 length 31, L398-402 last entry `discard-hero-each-player-by-cost`, L403-405 the full ordered list, and L619 / L652 length 31. A no-param primitive needs no parser arm (the no-param tail in `setup/villainAbility.setup.ts`; the doc list at L483-484). `VILLAIN_EFFECT_HANDLERS` is `Record<VillainEffectPrimitive, VillainEffectHandler>` (`villainEffects.execute.ts` L3951). The marker script keeps a hand-synced copy (`scripts/convert-cards/apply-effect-markers.mjs` L175-206) and needs only the array entry for a no-param token. `scripts/coverage/mechanic-provenance.json` keys primitives (L76-79 precedent rows).
10. **Card-uniqueness invariant** (`invariants/gameRules.checks.ts`): visits the City, HQ, `G.hqHaunters` (L113-121) and `scanZone(G.monsterPit ?? [], …)` (L128, the lazy-off-City-list precedent).
11. **UIState.** The City card object is built inline in the `buildUIState` City loop (`ui/uiState.build.ts` ~L856-900) and copied field-by-field by `deepCopyCitySpaces` (`ui/uiState.filter.ts` L98-127); `UICityCard` is `ui/uiState.types.ts` ~L617. The Mastermind projection is built at ~L979-1010 (`isHaunting` conditional spread) and copied at `uiState.filter.ts` ~L569-623.
12. **Bot consumers of `fightVillain` args.** `simulation/ai.competent.ts` `scoreFightVillain` (L235-251) reads `args.cityIndex ?? -1`; `readCityCard` returns null for -1, so another fight intent scores the base `SCORE_FIGHT_VILLAIN_BASE`. `simulation/ai.seatChoice.ts` L249-251 reads `cityIndex` only when defined. The sim runner, PAR aggregator, replay executor, server autoplay (`apps/server/src/autoplay/botLoopProgress.mjs` `selectSpendMoves`, every non-loop move) and the bot-ally driver (`progressFingerprint` includes `turnEconomy` and every Victory Pile length) pass args through. No server file changes.
13. **Client.** `MastermindTile.vue` gates Fight stage → heal lock → cost → structural (`gateForFight`), and on WP-830 opens the Enigma picker from `onFight` / `onFightEV`. Both pages mount it in a flex row: `PlayDesktop.vue` `.play-desktop__mastermind-zone` (~L879-899, inside the `nowrap` adversary band, L1570) and `PlayMobile.vue` the first `.play-mobile__band` (~L581-599). `useTurnActions(stage, isViewerTurn).canFightVillain()`, `healLockGate` and `useCardCostGating(economy).canFight(cost, target)` are the CityRow gate helpers; `canFight` with a target no grant names counts plain Attack only. `submitMove` args are `unknown`. `fightResolved.citySpace` is read by `composables/useVillainSlashVfx.ts` (L126 forwards it into `VillainSlashVfxEvent.citySpace`, whose JSDoc at L28 says "The City space (0..4)") and by `VfxOverlay.vue` (`locateSliceBox`, L979, finds no cell and skips; the slice-hint `take(-1)` at L1023 into `useSlashGesture.ts` finds nothing). Nothing in the engine or server reads it.
14. **No hashed fixture, PAR artifact or runtime-observed sweep plays the co2e Brotherhood.** `packages/game-engine/src/test/**` and `data/par/**` have no `brotherhood-of-mutants` reference; the only engine test mention is a Juggernaut id in `villainEffects.execute.test.ts`; `sim:runtime-observed` sweeps the `core/brotherhood` sentinel. The group does appear in `packages/registry/src/gauntletLoadouts.generated.ts` loadout rows.
15. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the post-WP-831 baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile (update this WP and D-24773) before coding.

## Context (Read First)

- **Why a list beside the Mastermind, not a flagged City space.** "Put The Blob to the left of the Mastermind space" takes him out of the City. If he stayed in `G.city` with a flag, every City reader (push, escape, Whirlwind's swap WP-523, Spinning Cyclone WP-795, WP-839's Green Goblin / Speed Demon / Boomerang movers, scheme twists, Guard, the Danger Meter) would have to learn the flag. Outside the City, none of them can reach him, so "Nothing moves The Blob" is true by construction (the Haunt precedent, D-24587). A list holds both copies.
- **Why `fightVillain` gains a location argument instead of a new move.** Every "whenever you fight a Villain" rider lives in `fightVillain`: the fight discard cost (WP-817), the defeat requirement (D-24076), Baron Zemo's paid rescue (WP-819), Excessive Violence (WP-736), the deferred-grant signal (WP-656), the Enigma Code peek (WP-830), plus 30 block-all guards and the heal lock. A new move would have to copy all of them and every new-move lockstep site (registration, three dispatch maps, drift tests, scorer). One move with a second location keeps the riders in one place, so a Blob fight can never drift from a City fight. `fightVillain` is already registered everywhere, so no lockstep site changes.
- **Why a new fight target.** Restricted Attack ("usable only against Villains in the Sewers / the Mastermind") names places. The Blob is in neither, so only plain Attack can pay for him. `'unnamed-city-space'` (WP-831) means "a City space with no name" and is shown in Spinning Cyclone labels; reusing it would mislabel him. A `'beside-mastermind'` member that no grant names is the honest value.
- **Why the shared defeat core is split, not copied.** `defeatCityVillainCore` does two things: take the card from the City, then defeat it. The second half (route the card, awards, rescue, onFight, log, `fightResolved`, the Endless Armies play) is extracted unchanged into `defeatVillainCardCore`, which both locations call. `defeatCityVillainCore` keeps its signature and behavior for its other callers: `defeatChoice.resolve.ts` (Silent Sniper, Pure Fury and Cruel Ruler route through it) and two direct test calls. WP-838 and WP-839 add blocks to this defeat half; whichever of them and WP-840 lands second carries the other's block verbatim into `defeatVillainCardCore` (see Dependencies).
- **Why `citySpace: -1`.** `FightResolvedEvent.citySpace` is a required number on a hashed surface. A sentinel keeps the event shape for every other fight and only Blob fights carry it; its readers are `useVillainSlashVfx.ts` (forwards it) and `VfxOverlay.vue` (`locateSliceBox` finds no cell and skips; the slice-hint `take(-1)` finds nothing). The `VillainSlashVfxEvent.citySpace` JSDoc ("0..4") becomes inaccurate; fixing it is a STATUS follow-up (that file is not on the allowlist). Making the field optional would change the shape for every consumer.
- **Split vs one WP.** One packet. The minimum is engine + bot + UIState + client together: an engine-only packet would ship a Mastermind the engine refuses while the client still offers its Fight button and shows no Blob (the WP-757 / WP-759 "deploy together" lesson). The file count (~39 including generated feeds) is in line with WP-817 (44) and WP-757 (~30), each executed in one session. If the executing session judges it too big, the only clean seam is engine+bot+UIState (A-I) then client (J) in two commits on one branch and one PR, never two deploys.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (villain group shape) and §5 (printed markup; `[effect:]` is a pipeline-appended engine marker, documented in the marker map `_notes`).
- `docs/ai/ARCHITECTURE.md` Section 1 §Package Import Rules and §Layer Boundary (Authoritative): `apps/arena-client` imports only the `.` engine surface (`UICityCard`, `AttackTargetName`).
- `docs/ai/ARCHITECTURE.md`: §The Move Validation Contract, §Zone & Pile Structure, Persistence Boundaries, §The Rule Execution Pipeline. `.claude/rules/architecture.md` §UIState Projection Integrity (the five-step contract) and §Layer Boundary (the client imports only the `.` engine surface).
- `docs/ai/DECISIONS.md`: scan D-24587, D-24750, D-24185, D-24363, D-24364, D-24652, D-24764, D-24574, D-24295, D-24081, D-12803, D-24266, D-24703, D-24372 before coding.
- User memory: `reference_bot_legalmoves_moveguard_divergence`, `reference_villain_effect_vocabulary_extension`, `reference_card_data_pipeline`, `reference_engine_tests_never_typechecked`, `reference_setup_hook_change_replay_compat`.

### Operator forks (recommended default first; the execution session uses the default unless Jeff says otherwise)

1. **Do free "defeat" effects reach the Mastermind while The Blob is beside it?** (Silent Sniper's defeat-with-Bystander, Pure Fury.) **Default: yes, unchanged.** Rules v23 L1299-1301 say a "defeat" ignores fight restrictions, and D-24750 already locks that only `fightVillain` pays fight restrictions; "you can't fight the Mastermind" restricts fighting. Alternative: block them through the one seam `isMastermindFreeDefeatTarget` (one line + one test), matching how D-24587 treats a haunting Mastermind. Either way, Pure Fury cannot target a Villain beside the Mastermind (its builder iterates `G.city`), although its printed text ("Defeat any Villain or Mastermind whose Attack is less than …") has no City condition; that is a named residual and follow-up. Adding the list to the Pure Fury builder would be a scope expansion for Jeff to choose.
2. **Amwp Energy Shield** (`amwp/armada-of-kang/energy-shield`, 1 copy, `5+`, Streets Conqueror 2): "Ambush: Put this Energy Shield above the Mastermind space. While it's there, you can't fight the Mastermind. (You can still fight the Energy Shield.)" — the same mechanic. **Default: out of scope**, named follow-up (one marker row, after checking Conqueror off-City). Alternative: add its marker row in this packet.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries, no `import *`.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24773) before coding. One WP per session. Get Jeff's go before starting execution; Jeff merges the execution PR.

**Packet-specific:**
- **One predicate.** Every "the Mastermind can't be fought" check (move, bot, client projection) reads `hasVillainBesideMastermind` or the projected `villainsBeside`. No inline length test elsewhere.
- **Gate before commit, mirror in the bot** (D-24364): the `fightMastermind` refusal and the beside-fight intents land in the same commit as their move code.
- **Byte-identical without The Blob.** No `G` key, log line, intent arg or event field changes in a match where no Blob has ambushed. A City fight logs and emits exactly what it does today. Hash oracles unchanged.
- **Data, not English.** Behavior comes only from the `[effect:put-self-beside-mastermind]` marker. Never run `convert-cards-v15.mjs`.
- **Self-narrate.** The new primitive logs through `pushLog` (hash-excluded `G.messages`, D-24081). `VillainEffectKeyword`, the legacy reverse-map and `EFFECT_KEYWORD_LABELS` stay frozen.
- **Five-step UIState contract** for `UIMastermindState.villainsBeside` (`.claude/rules/architecture.md`).
- **City code untouched.** No City mover, push, escape, Guard or City-space helper changes ("Nothing moves The Blob" holds because he is not in `G.city`).

## Locked Values

**State (`types.ts`, beside `hqHaunters`):** `LegendaryGameState.villainsBesideMastermind?: CardExtId[]` — Villains to the left of the Mastermind space, arrival order. Lazy: created by the first put, deleted when the last one leaves; never `[]` in `G`.

**Helpers (`board/besideMastermind.logic.ts`, new, boardgame.io-free, never throw):**
- `hasVillainBesideMastermind(G): boolean` — `(G.villainsBesideMastermind?.length ?? 0) > 0`.
- `getVillainBesideMastermind(G, besideIndex: number): CardExtId | null` — null unless `besideIndex` is an integer in `0..length-1`.
- `putVillainBesideMastermind(G, cardId): boolean` — false (no write) when `cardId` is already listed; otherwise lazy-create and append, true.
- `takeVillainBesideMastermind(G, besideIndex): CardExtId | null` — removes and returns the entry (`getVillainBesideMastermind` rules), deleting the field when it empties.

**Primitive (`rules/villainAbility.types.ts`):** `'put-self-beside-mastermind'` appended to the union **and** the end of `VILLAIN_EFFECT_PRIMITIVES` (position 32 on the baseline; after WP-835..839's appends if they land first — re-read). No params; any `:` param → unresolved. No `descriptorKey` change. The pins in `villainAbility.types.test.ts`: L393-397 length (+1), L398-402 last entry (re-point to `put-self-beside-mastermind` and its position), L403-405 ordered list (append), L619 and L652 length (+1); re-read the positions if WP-835..839 landed first. Intended product change, stated in the commit body.

**Handler (`villainEffectPutSelfBesideMastermind`, executor, keyword-less):**
- `cityIndex = G.city.indexOf(cardId)`; `< 0` → `` `${label} effect: ${name} is not in the City; it stays where it is.` `` `'blocked'`, `{ targets: [] }`, no write.
- `putVillainBesideMastermind(G, cardId)` false → `` `${label} effect: ${name} is already beside the Mastermind.` `` `'blocked'`, no City write.
- Otherwise `G.city[cityIndex] = null` and `` `${label} effect: ${name} moves to the left of the Mastermind. Nothing moves him there, and the Mastermind can't be fought while he is there.` `` `'threat'`; `{ targets: [] }`. (`label = villainEffectTimingLabel(timing)`, `name = resolveCardDisplayName(G, cardId)`.)

**Fight target (`economy/economy.types.ts` + `economy.logic.ts`):** `export const BESIDE_MASTERMIND_TARGET = 'beside-mastermind';` and `AttackTargetName` gains `typeof BESIDE_MASTERMIND_TARGET`; `ATTACK_TARGET_LABELS['beside-mastermind'] = 'beside the Mastermind'`.

**`fightVillain` (`moves/fightVillain.ts`):**
- `FightVillainArgs.cityIndex?: number` (JSDoc: required unless `besideMastermindIndex` is given) and `besideMastermindIndex?: number` (JSDoc: WP-840 / D-24773, the 0-based position in `G.villainsBesideMastermind`; fights that Villain beside the Mastermind).
- Step 1, location: when `besideMastermindIndex !== undefined`: `cityIndex !== undefined` → return (both named); `getVillainBesideMastermind` null → return; `fightTarget = BESIDE_MASTERMIND_TARGET`; no Guard check. Otherwise the WP-831 City validation, target and Guard check, unchanged.
- Everything from the cost check through the heal lock is shared and unchanged (cost, defeat requirement, discard cost, stage, block-all guards, heal lock).
- Step 3: discard and the Zemo decision unchanged; then City → `defeatCityVillainCore(G, ctx, cityIndex, { random }, { payRescueOnFight })` (unchanged); beside → `takeVillainBesideMastermind(G, besideMastermindIndex)` then `defeatVillainCardCore(G, ctx, cardId, { kind: 'beside-mastermind' }, { random }, { payRescueOnFight })`, using the step-1 `cardId`, with a `// why:` that nothing between step 1 and step 3 writes the list (the fight discard can only park a return-on-discard choice), so the step-1 read still holds. The EV, debit, `hasActedThisTurn`, deferred-grant and Enigma tails are shared.
- `type FightLocation = { kind: 'city'; cityIndex: number } | { kind: 'beside-mastermind' }` (module-local). `defeatVillainCardCore(G, ctx, cardId, location, shuffleContext, options?)` (module-local) is the body of `defeatCityVillainCore` after its City removal, with three location reads: the onFight `cityIndex` argument (`location.cityIndex` for a City fight, `undefined` beside), the fought line (City: the existing string; beside: `` `Player ${currentPlayer} fought ${formatCardRef(G.cardDisplayData, cardId)} beside the Mastermind.` ``), and `fightResolved.citySpace` (City: the index; beside: `OFF_CITY_FIGHT_SPACE`, a module constant `-1`). `defeatCityVillainCore` = guard, null the space, call the core with `{ kind: 'city', cityIndex }`.

**`fightMastermind`:** directly after the `isMastermindHaunting` return: `if (hasVillainBesideMastermind(G)) { return; }`.

**`getLegalMoves` (`simulation/ai.legalMoves.ts`):**
- Step 3b, after the City loop, inside `stage === 'main'`: for each `besideIndex` ascending, the same defeat-requirement `continue`, discard-cost pick (`selectDefaultCostDiscardCard`, null → `continue`), `resolveFightCost(gameState, cardId, activePlayer) + getPatrolModifier(cardId, cardKeywords)` and `getSpendableAttackForTarget(gameState.turnEconomy, BESIDE_MASTERMIND_TARGET)` checks as the City branch; push `{ name: 'fightVillain', args: { besideMastermindIndex: besideIndex } }` (plus `discardCardId` when a cost applies).
- Step 4 condition gains `&& !hasVillainBesideMastermind(gameState)`.

**Invariant (`invariants/gameRules.checks.ts`):** `scanZone(G.villainsBesideMastermind ?? [], 'villainsBesideMastermind', firstSeenZone);` beside the `monsterPit` scan.

**Notable event doc (`events/notableEvents.types.ts`):** `FightResolvedEvent.citySpace` JSDoc becomes `City space the defeated card occupied, or -1 for a Villain fought outside the City (WP-840, beside the Mastermind).` No type change.

**UIState:**
- `UIMastermindState.villainsBeside?: UICityCard[]` (JSDoc: WP-840 / D-24773, public; omit-when-absent; while non-empty the Mastermind can't be fought).
- `buildUIState`: the City card object moves verbatim into `buildCityCardProjection(gameState, ctx, cardId): UICityCard` (the City loop calls it; byte-identical); the Mastermind object gains `...(gameState.villainsBesideMastermind !== undefined ? { villainsBeside: <each id through buildCityCardProjection, in list order> } : {})`.
- `filterUIStateForAudience`: the per-card copy moves into `deepCopyCityCard(card): UICityCard` (`deepCopyCitySpaces` calls it; byte-identical); the Mastermind copy gains `...(uiState.mastermind.villainsBeside !== undefined ? { villainsBeside: <each through deepCopyCityCard> } : {})` for every audience.

**Client (`apps/arena-client/src`):**
- `components/play/BesideMastermindVillains.vue` (new, `defineComponent({ setup })` like MastermindTile): props `villains: UICityCard[]` (required), `currentStage: string`, `isViewerTurn` (default true), `hasHealedThisTurn` (default false), `economy: UITurnEconomyState`, `submitMove: SubmitMove`. Root `<section data-testid="play-beside-mastermind" aria-label="Villains to the left of the Mastermind">` with the label `Left of the Mastermind`; one `<button data-testid="play-beside-mastermind-villain" :data-beside-index="index">` per villain holding a `CardTile size="sm"` (`show-label`, `interactive` / `tooltip` from the gate). Gate per villain: `useTurnActions(currentStage, isViewerTurn).canFightVillain()` → `healLockGate(hasHealedThisTurn)` → `useCardCostGating(economy).canFight(villain.fightCost, 'beside-mastermind')`. Click on an allowed villain → `submitMove('fightVillain', { besideMastermindIndex: index })`. No EV, rescue or discard control (§Out of Scope).
- `MastermindTile.vue` `gateForFight` order: stage → heal lock → cost → the existing vanquished check (`tacticsRemaining === 0` without `finalBlowPending`, unchanged) → the beside lock → allowed. So the lock applies only to a Mastermind that is still fightable (tactics remain, or `finalBlowPending`); a vanquished Mastermind keeps its vanquished reason even with a Blob beside it. The lock: when `mastermind.villainsBeside` is non-empty → `{ allowed: false, reason: \`You can't fight the Mastermind while ${name} is beside it — fight ${name} first\` }`, `name` = `villainsBeside[0].display.name`. (`showEvFight` and the Enigma path already go through `gateForFight`.)
- `PlayDesktop.vue`: `<BesideMastermindVillains v-if="(snapshot.mastermind.villainsBeside?.length ?? 0) > 0" …>` as the **first** child of `.play-desktop__mastermind-zone` (left of `MastermindTile`), passing `snapshot.mastermind.villainsBeside`, `snapshot.game.currentStage`, `isViewerTurn`, `snapshot.game.hasHealedThisTurn`, `snapshot.economy`, `submitMove`. `PlayMobile.vue`: the same, first child of the Mastermind band.

**Data:**
- Marker map `villains.co2e` gains `"brotherhood-of-mutants": { "the-blob": { "ambush": ["put-self-beside-mastermind"] } }` (merge with any row WP-835..839 added there).
- `apply-effect-markers.mjs` local `VILLAIN_EFFECT_PRIMITIVES` gains `'put-self-beside-mastermind'` at the same position as the engine array, with the append `// why:`.
- `mechanic-provenance.json`: `"put-self-beside-mastermind": { "wp": "WP-840", "decision": "D-24773" }`.

---

## Scope (In)

- **A)** `board/besideMastermind.logic.ts` (new) + test: the four helpers.
- **B)** `types.ts`: the `G` field.
- **C)** `rules/villainAbility.types.ts` + test; `setup/villainAbility.setup.ts` (the no-param doc list only) + test: the primitive.
- **D)** `villain/villainEffects.execute.ts` + test: the handler and map entry.
- **E)** `economy/economy.types.ts`, `economy/economy.logic.ts`: the fight target and label.
- **F)** `moves/fightVillain.ts` + test: the location argument, the core split; the file header and the `fightVillain` JSDoc ("Fights a villain or henchman in the City") also name the beside-the-Mastermind location.
- **G)** `moves/fightMastermind.ts` + test: the gate.
- **H)** `simulation/ai.legalMoves.ts` + test: step 3b and the step 4 condition; the `getLegalMoves` canonical-order JSDoc list (~L388-405) gains a "3b. fightVillain beside the Mastermind" line.
- **I)** `invariants/gameRules.checks.ts` + `invariants/invariants.test.ts`; `events/notableEvents.types.ts` (JSDoc); `villainDeck/villainDeck.reveal.test.ts` (the integration case); `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` + `ui/uiState.filter.test.ts`.
- **J)** Client: `BesideMastermindVillains.vue` (new) + test (new), `MastermindTile.vue` + test, `PlayDesktop.vue`, `PlayMobile.vue`.
- **K)** Data: the marker script and map, `mechanic-provenance.json`, `co2e.json` regenerated (1 line), the regenerated villain ledger + effect index.

## Out of Scope

- **Free defeats** (Operator fork 1 default): Silent Sniper / Pure Fury can still defeat the Mastermind while The Blob is beside it. No free-defeat builder lists a beside Villain. For Silent Sniper that is faithful (it needs a Bystander, and The Blob never holds one there). **Pure Fury cannot target a Villain beside the Mastermind** (its builder iterates `G.city`), although its printed text has no City condition: a named residual and follow-up.
- **Amwp Energy Shield** (Operator fork 2 default): named follow-up.
- **Client Excessive Violence / Baron Zemo rescue / fight-discard controls for a beside Villain.** The engine accepts those arguments with `besideMastermindIndex` (the shared riders), and bots use them; the client offers only plain Fight. No beside Villain has a fight discard cost (only the Blob carries the marker); a future marked Villain with one must extend the component.
- **The center-screen Ambush narrative** reads `"The Blob" entered the city with no Ambush effect.` because keyword-less results never reach `composeAmbushNarrative` (the shared WP-253-deferred class; Haunt and Whirlwind's swap read the same). The durable log line is correct. Recorded in STATUS.
- **Slice VFX** for a beside fight (`citySpace: -1` finds no City cell); the fight sound still plays. The `VillainSlashVfxEvent.citySpace` JSDoc in `composables/useVillainSlashVfx.ts` (L28, "0..4") is left stale and recorded as a STATUS follow-up; that file is not on the allowlist.
- **Operator setters / board inspection** do not list or move beside Villains.
- **The core Blob** (`core/brotherhood`, `require-to-defeat`) and the D-24076 client Fight-gate follow-up.
- **PAR regeneration** (none exists for the group; see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `board/besideMastermind.logic.ts`, `board/besideMastermind.logic.test.ts` — **new**
- `types.ts` — modified (one field)
- `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts` — modified
- `setup/villainAbility.setup.ts` (doc list), `setup/villainAbility.setup.test.ts` — modified
- `villain/villainEffects.execute.ts`, `villain/villainEffects.execute.test.ts` — modified
- `economy/economy.types.ts`, `economy/economy.logic.ts` — modified (one member, one label)
- `moves/fightVillain.ts`, `moves/fightVillain.test.ts` — modified
- `moves/fightMastermind.ts`, `moves/fightMastermind.test.ts` — modified
- `simulation/ai.legalMoves.ts`, `simulation/ai.legalMoves.test.ts` — modified
- `invariants/gameRules.checks.ts`, `invariants/invariants.test.ts` — modified
- `events/notableEvents.types.ts` — modified (one JSDoc line)
- `villainDeck/villainDeck.reveal.test.ts` — modified (T8)
- `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — modified

**Client (`apps/arena-client/src/`)**
- `components/play/BesideMastermindVillains.vue`, `components/play/BesideMastermindVillains.test.ts` — **new**
- `components/play/MastermindTile.vue`, `components/play/MastermindTile.test.ts` — modified
- `pages/PlayDesktop.vue`, `pages/PlayMobile.vue` — modified (one mount each)

**Scripts and data**
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json` — modified
- `data/cards/co2e.json` — regenerated (the Blob line gains one trailing marker)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`, `data/metadata/effect-implementation-index.json` — regenerated; `data/metadata/card-mechanics.json` — regenerated only if `mechanics:metadata:check` reports stale

**Governance:** `docs/ai/DECISIONS.md` (D-24773), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/post-mortems/01.6-WP-840-co2e-the-blob-guards-the-mastermind.md` (**new**, the mandatory 01.6 post-mortem: this packet adds a new projection and a new execution path, `docs/ai/REFERENCE/01.6-post-mortem-checklist.md` L42-51)

That is 25 engine files (10 tests), 6 client files (2 tests), 3 script/input files, 1 card-data file and 3-4 generated feeds. Above the ~10 guideline for the reason in §Context (Split vs one WP); about a third are tests, and five production edits are one or two lines.

## Contract

- The Locked Values above: `G.villainsBesideMastermind`, the four helpers, the primitive and its log strings, `BESIDE_MASTERMIND_TARGET`, `FightVillainArgs.besideMastermindIndex` and its step-1 rules, the `fightMastermind` gate and its bot mirror, the step-3b intents, `fightResolved.citySpace === -1` for a beside fight, `UIMastermindState.villainsBeside`, the client gate reason and the move payload.
- `defeatCityVillainCore`, `executeVillainAbilities`, `resolveFightCost` and every existing handler keep their signatures and behavior; `descriptorKey` is unchanged.

## Test Contract

Minimal-`G` fixtures in each file's existing style. "Blob" = `co2e-villain-brotherhood-of-mutants-the-blob-00` (`-01` for the second copy) with `cardStats` fight cost 4 and `cardDisplayData` name `The Blob`. Each T-case is at least one `it`, under one `describe('WP-840 …')` per file. T2 edits the five `VILLAIN_EFFECT_PRIMITIVES` pin assertions exactly as Locked Values lists them (two lengths +1 at L619 / L652, the L393-397 length +1, the L398-402 last entry re-pointed, the L403-405 ordered list appended): an intended product change, said so in the commit body. No other existing assertion changes.

| # | File | Input | Expected | Must NOT / invariant |
|---|---|---|---|---|
| T1 | besideMastermind | `has`/`get` on absent and on `[blob-00]`; `put` blob-00 twice; `take(0)`; `get(1)`, `get(-1)`, `get(0.5)` | false/null on absent; true; second `put` false, list length 1; `take` returns blob-00 and the field is deleted; nulls | never `[]` in G |
| T2 | types | `VILLAIN_EFFECT_PRIMITIVES` and the five existing pins | length +1 in all three length pins; last entry = `put-self-beside-mastermind` at its position; the ordered list ends with it; union parity passes | |
| T3 | setup | parse `put-self-beside-mastermind`; `put-self-beside-mastermind:1` | `{ primitive }`; unresolved | |
| T4 | setup | `buildVillainAbilityHooks` over the Blob line copied **verbatim** from the regenerated `co2e.json` | one onAmbush hook with that descriptor; no `unresolvedMarkers` | |
| T5 | executor | City `[v0, v1, blob-00, null, null]`, onAmbush the descriptor | City `[v0, v1, null, null, null]`; list `[blob-00]`; the `moves to the left of the Mastermind` line `'threat'` | other spaces untouched |
| T6 | executor | T5 then blob-01 at City 0 ambushes | list `[blob-00, blob-01]` | arrival order |
| T7 | executor | the Blob not in the City; and the Blob already listed and also at City 1 | no write, `not in the City` `'blocked'`, no field; `already beside` `'blocked'`, City unchanged | never throws |
| T8 | reveal | a marked Blob revealed into City `[a, b, c, d, null]`; then into a full City | Blob listed, absent from City, `a..d` pushed one space; `ambushResolved.citySpace` 0; full City → the Bridge Villain escaped (escape counted) before the Blob left | rules L573-576 order |
| T9 | fightMastermind | list `[blob-00]`, attack ≥ Mastermind cost, a tactic left | `G` deep-equal before/after | silent refusal |
| T10 | fightMastermind | same with the field absent | a tactic is defeated | control |
| T11 | fightVillain | list `[blob-00]`, attack 4, `{ besideMastermindIndex: 0 }` | Blob in victory; field deleted; attack spent 4; `hasActedThisTurn`; log `Player 0 fought The Blob beside the Mastermind.`; `fightResolved.citySpace` -1 | |
| T12 | fightVillain | attack 3; index 1 with one Blob; index -1; 0.5; `{ cityIndex: 0, besideMastermindIndex: 0 }`; field absent with index 0 | each: `G` deep-equal | silent return |
| T13 | fightVillain | plain attack 0 plus a 4-point restricted grant for `sewers`; then one for `mastermind` | both refused (`G` deep-equal) | no grant pays beside |
| T14 | fightVillain | list `[blob-00, blob-01]`, fight index 1 | list `[blob-00]`; `fightMastermind` still refused | |
| T15 | fightVillain | list `[blob-00]` and a City Villain at 0; `{ cityIndex: 0 }` | City fight resolves with the unchanged `at city space 0` line and `citySpace` 0; list unchanged | City path byte-identical |
| T16 | fightVillain | a Guard Villain at City 4 and the Blob beside | the beside fight succeeds | Guard is City-only |
| T17 | fightVillain | `{ besideMastermindIndex: 0, useExcessiveViolence: true }`, attack 5, an enrolled EV ability | debit 5, EV fired once | shared riders |
| T18 | legalMoves | list `[blob-00]`, attack 4 + enough for the Mastermind | contains `{ fightVillain, { besideMastermindIndex: 0 } }`; no `fightMastermind` | mirrors T9 / T11 |
| T19 | legalMoves | attack 3 | no beside intent | mirrors T12 |
| T20 | legalMoves | no field; City Villains; affordable Mastermind | the fight intents deep-equal the pre-change list (`{ cityIndex }` only) and `fightMastermind` present | byte-identical |
| T21 | invariants | the Blob in the list only; then in the list and at City 0 | passes; duplicate reported naming `villainsBesideMastermind` | container visited |
| T22 | ui filter | build + filter with list `[blob-00]` for player 0, player 1, a spectator; and a state without the field | `mastermind.villainsBeside` length 1 (`extId`, `display.name` The Blob, `fightCost` 4) for all three, deep-equal and not aliased; absent key without the field; the City projection deep-equal to the pre-change projection | five-step step 4 |
| T23 | BesideMastermindVillains | two villains, viewer's Main, attack 4; click index 1; not the viewer's turn; attack 3; healed | both enabled, click submits `fightVillain { besideMastermindIndex: 1 }`; disabled with the stage reason / the cost reason / the heal reason, and a disabled click submits nothing | |
| T24 | MastermindTile | `villainsBeside [The Blob]`, affordable Mastermind; then without it; then `villainsBeside [The Blob]`, `tacticsRemaining 0`, no Final Blow | Fight disabled with `You can't fight the Mastermind while The Blob is beside it — fight The Blob first`, no EV button, click submits nothing; without it the existing behavior; the vanquished case shows the existing vanquished reason, not the beside lock | vanquished check keeps precedence |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §2 (Content Authenticity) and §10 (Content as Data) through the card-data marker, §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** `co2e/brotherhood-of-mutants` appears in published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`). The Blob now blocks the Mastermind until he is fought, so those legs get harder. No committed `data/par` artifact references the group, so nothing is re-pinned; a future PAR run sees the new behavior.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (card fidelity; no paid or persuasive surface).

**Determinism preservation:**
- `G.villainsBesideMastermind` is lazy and appears only after a Blob Ambush. `getLegalMoves` output, every log line and every notable event are unchanged in any match without one (T15, T20, T22). No randomness; list order is arrival order.
- Narration goes to hash-excluded `G.messages` (D-24081). `fightResolved.citySpace` is -1 only for a beside fight. `finalStateHash` and `PRE_WP080_HASH` are expected unchanged (Assumes 14); if either moves, STOP and explain before any re-pin.
- **Replay-compat:** stored matches replay from their bgio `initialState`, which holds the setup-time hooks; a pre-WP-840 match has no Blob marker and replays identically (`reference_setup_hook_change_replay_compat`). Only a match created after the deploy sees the new behavior. Recorded in D-24773.

## Funding Surface Gate

§20 **N/A**: engine, card data and a gameplay control. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Helpers and grammar.** T1-T4 pass as runtime assertions. `apply-effect-markers.mjs` accepts `put-self-beside-mastermind` and, put by hand into the map as `put-self-beside-mastermind:1`, fails loudly (observed, reverted, recorded in the EC-878 commit body).
2. **Ambush.** T5-T8 pass.
3. **Mastermind gate and Blob fight.** T9-T17 pass; T12's six refusals leave `G` deep-equal.
4. **Bot mirror.** T18-T20 pass.
5. **Invariant and projection.** T21-T22 pass; T22 also asserts `buildUIState` alone gives `villainsBeside` (step 2) before the filter (step 3).
6. **Client.** T23-T24 pass; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
7. **Board check (observed).** On the 1280x720 dev route (`?fixture=mid-turn&play=1`), with `mastermind.villainsBeside` set to one Blob card by injecting it into the store at runtime (`preview_eval`; `src/fixtures/uiState/mid-turn.json` is not edited and is not on the allowlist): The Blob renders left of the Mastermind tile, the adversary band stays on one line with no horizontal overflow, and the Mastermind Fight button shows the locked reason. On `PlayMobile` at 375x812 the page has no horizontal overflow; the new component's own root wraps (`flex-wrap: wrap`) rather than any page CSS being edited. Recorded in the commit body.
8. **Data.** `apply-effect-markers.mjs` prints `co2e.json — 1 new marker(s) this run` and re-runs at 0; `git diff data/cards/` touches only `co2e.json`, one line gaining ` [effect:put-self-beside-mastermind]`.
9. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `cards:check`, `effect-index:check`, `ledger:villains:check`, `mechanics:metadata:check`, `gauntlet:loadouts:check`, `sim:runtime-observed:check`, `sim:coverage --check` exit 0 after the regeneration in Verification Steps; the last three need no regeneration.
10. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.
11. **Ledger row.** In the regenerated `villain-mechanic-ledger.json`, The Blob (`put-self-beside-mastermind`) is `executable` with a handler and WP-840 / D-24773 provenance; no other row changes.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` and `pnpm --filter @legendary-arena/arena-client test` → all pass; record before / after totals.
3. `node scripts/convert-cards/apply-effect-markers.mjs`; re-run → 0 new markers. `git diff --stat -- data/cards/` → only `co2e.json`.
4. `pnpm -r build` again (the ledger reads the engine dist), then `pnpm ledger:villains && pnpm effect-index`.
5. `pnpm cards:check && pnpm effect-index:check && pnpm ledger:villains:check && pnpm mechanics:metadata:check && pnpm gauntlet:loadouts:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0 (regenerate `card-mechanics.json` only if its check flags). If one of the last three flags, STOP: Assumes 14 is false.
6. `pnpm -r --no-bail test` → 0 fail; `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0. The AC 7 board check.
7. After governance close: `pnpm roadmap:counts:check && pnpm ledger:numbers:check && pnpm workindex:rows:check && pnpm workindex:executed:check` → exit 0. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
8. Revert proofs, one at a time, each must fail at least one T-case: (a) drop the `fightMastermind` gate (T9); (b) drop the step-4 bot condition (T18); (c) drop step 3b (T18); (d) leave the City space set in the handler (T5, T21); (e) use `'mastermind'` as the beside fight target (T13); (f) drop `villainsBeside` from the filter (T22); (g) drop the MastermindTile lock (T24).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the seven revert proofs were observed.
- [ ] D-24773 appended to `DECISIONS.md` as Active. 01.6 post-mortem written (`docs/ai/post-mortems/01.6-WP-840-co2e-the-blob-guards-the-mastermind.md`). `docs/ai/STATUS.md` updated with the follow-ups: Energy Shield (Operator fork 2), Pure Fury cannot target a Villain beside the Mastermind, the "no Ambush effect" overlay narrative class, beside-fight EV / rescue client controls, the slice VFX, and the stale `VillainSlashVfxEvent.citySpace` JSDoc ("0..4") in `useVillainSlashVfx.ts`.
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-878:` then `SPEC:` (or `EC-878:` engine, `EC-878:` client, `SPEC:` if the session uses the A-I / J seam).
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, with `/api/version` showing a gitSha that contains the merge, in a match created after the deploy with `co2e/magneto` (it always leads the Brotherhood), driven via the operator setter pane (reveal The Blob) or `/api/match/autoplay` setupData:
  - The Blob's reveal logs `moves to the left of the Mastermind`, he leaves the City and shows left of the Mastermind tile;
  - the Mastermind Fight button is disabled with the locked reason;
  - with 4 Attack, his Fight button fights him (`fought The Blob beside the Mastermind`), and the Mastermind Fight button is enabled again;
  - the Play Diagnostics `uiStateSnapshot` shows `mastermind.villainsBeside` while he is there and no such key after (five-step step 5).

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24773 — co2e-the-blob-guards-the-mastermind.** It locks:
- the authorized contract-file changes: `rules/villainAbility.types.ts` (primitive `put-self-beside-mastermind`, appended), `ui/uiState.types.ts` (`UIMastermindState.villainsBeside?`), `economy/economy.types.ts` (`AttackTargetName` gains `'beside-mastermind'`), and the `FightResolvedEvent.citySpace` JSDoc in `events/notableEvents.types.ts`;
- a Villain "to the left of the Mastermind space" is outside the City in the lazy `G.villainsBesideMastermind` list (arrival order, both Blob copies), so no City mover, push, escape or Guard reaches it ("Nothing moves The Blob" by construction, the D-24587 Haunt shape); the Ambush runs after the City entry and any escape it caused (rules v23 L573-576), and the `ambushResolved` `citySpace` 0 fallback is accepted (D-24587 precedent);
- while the list is non-empty `fightMastermind` refuses silently and `getLegalMoves` never offers it (D-24364); free "defeat" effects still reach the Mastermind (rules v23 L1299-1301; D-24750 "only `fightVillain` pays fight restrictions"), or the Operator-fork-1 alternative if Jeff chose it. This differs from D-24587 on purpose: Haunt removes the Mastermind from free-defeat targets because the Mastermind has left its space, while The Blob leaves the Mastermind in its space, and a "defeat" is not a fight;
- a beside Villain is fought through `fightVillain({ besideMastermindIndex })`, sharing every fight rider; it is paid with plain Attack only (`'beside-mastermind'`, which no restricted grant names); its location-dependent cost terms are 0; its onFight location gate fails closed; `fightResolved.citySpace` is -1; `defeatCityVillainCore` keeps its contract and its defeat half is shared;
- three verbatim extractions, each with exactly two callers, so the City path stays byte-identical: `defeatVillainCardCore` (the defeat half of `defeatCityVillainCore`, the WP-486 / D-24291 shared-core precedent), `buildCityCardProjection` (the City card object in `buildUIState`) and `deepCopyCityCard` (the per-card copy in `deepCopyCitySpaces`), following the WP-757 / D-24587 `resolveVillainEscape` extraction precedent; these are extractions, not new abstractions (00.6 Rule 1);
- the client shows the list left of the Mastermind with a plain Fight control and locks the Mastermind Fight button from the projected `villainsBeside`, after the existing vanquished check;
- the residuals in §Out of Scope (including that Pure Fury cannot target a Villain beside the Mastermind, because its builder iterates `G.city`) and the replay-compat note.

---

## Gate Record

- 01.4 pre-flight (independent): READY — BLOCKED ON WP-831 after PS-1..3 + RS-1..11 applied (2026-10-25). Report: `docs/ai/invocations/preflight-wp840-co2e-the-blob-guards-the-mastermind.md`.
- 01.7 copilot (independent): RISK → fixes 1-5 applied (2026-10-25). Report: `docs/ai/invocations/copilot-wp840-co2e-the-blob-guards-the-mastermind.md`. The fixes: the 00.2 §1.4 / §5 and ARCHITECTURE Section 1 Context bullets; the mandatory 01.6 post-mortem added to Files / DoD / EC / session prompt; the MastermindTile order stage → heal → cost → vanquished → beside lock, plus a T24 vanquished case; the `citySpace` reader inventory corrected (`useVillainSlashVfx.ts` JSDoc recorded as a STATUS follow-up, allowlist not widened); the pre-flight PENDING block marked RESOLVED and WP-831 head `a6e8dfa5` cited (#2995 merged). Also the optional D-24773 sentence naming the three extracted helpers.
- 00.3 lint (independent): §4 FAIL → fixed → PASS (2026-10-25).

---

## Lint Gate Self-Review (00.3)

Drafting self-review; the independent 01.4 / 01.7 / 00.3 runs are the coordinating session's.

| § | Result |
|---|---|
| §1 | PASS — every required section present; Out of Scope has 8 items |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS — Assumes 1-15 cite file:line on the WP-831 head for every seam used, the rules lines, the card data and the baseline green |
| §4 | PASS (after the independent 00.3 fix) — `00.2-data-requirements.md` §1.4 / §5, ARCHITECTURE Section 1 §Package Import Rules / §Layer Boundary (Authoritative) plus the other ARCHITECTURE sections, rules UIState / Layer Boundary, DECISIONS scan list, memory |
| §5 | PASS — every file marked new / modified / regenerated, all existing paths verified on `claude/wp831-exec`; the count is justified |
| §6 | PASS — set / group / card slugs and instance ids match `co2e.json`; `besideMastermindIndex` follows the `cityIndex` / `hqIndex` naming; the `G` field and UI field names are full words |
| §7 | PASS — hard dep WP-831 (stacked on WP-829 / WP-830) named with PR and head; soft ordering with WP-835..839; no new package dependency |
| §8 | PASS — engine decides; the client gates on projected data only (D-24574) and imports only the `.` surface; `G` stays JSON; no I/O or randomness; no server change |
| §9 | PASS — pnpm / node commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth change |
| §12 | PASS — node:test, minimal-`G` fixtures, runtime assertions for the count pins (D-24372); hash oracles stand in for the golden test |
| §13 | PASS — exact commands with exit-0 / literal-output expectations, a diff-scope step, 7 revert proofs, an observed board check |
| §14 | PASS — 11 binary criteria tied to T1-T24 |
| §15 / §15.1 | PASS — STATUS (+ follow-ups), DECISIONS, indexes and mindmap in DoD; D-24026 live-verify on `play.legendary-arena.com` names the UIState field |
| §16 | PASS — 00.6 mandated; one duplicated bot eligibility block (the second copy; the third would abstract) |
| §17 | PASS — §1 / §8 / §22-24 / NG-1 cited; conflict line; determinism + replay-compat |
| §18 | N/A — no forbidden-token grep step |
| §19 | N/A at draft — applies to the STATUS entry at close |
| §20 | PASS — N/A with reason (no funding surface) |
| §21 | PASS — N/A with reason; no `apps/server/src` surface |

Scaffold-first (01.0a Step 3): not this class. No previously accepted input is newly rejected: `fightMastermind` refuses only in a state that cannot exist before this packet, and `fightVillain`'s City path is unchanged.
