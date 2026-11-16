# WP-840 — co2e The Blob guards the Mastermind: a Villain held to the left of the Mastermind, fought there through the Fortify fight path, who blocks every Mastermind fight (Game Engine + Arena Client + card data)

**Status:** Draft 2026-10-25; **reconciled and re-gated 2026-11-15** on `main` `a752fc130` (after WP-873 Fortify, WP-839 #3410, WP-897). EC-878; **D-24773** reserved (#3010). See §Gate Record.
**Reconciliation (2026-11-15):** WP-873 / D-24818 already ships an off-City Villain that blocks the Mastermind and is fought through `fightVillain({ fortifiedPlace })` (`moves/fortifyFight.ts`), with `findFightableFortifier` as its single fightability authority, `isMastermindFortified` as the lock, a bot mirror, a `city.fortifiers` / `mastermind.fortifiedReason` projection and the `FortifiedVillains.vue` chip. **Operator fork 3 — Jeff chose "reuse Fortify" (2026-11-15).** The Blob gets his own lazy list (Fortify holds one Villain per place; both Blob copies and a Colleen Wing must coexist) and his own keyword-less Ambush primitive (Fortify fires at Escape). Everything else rides the Fortify seams: the fight body and defeat core are shared, one predicate `isMastermindGuarded` replaces `isMastermindFortified` at the move and the bot mirror, and The Blob is projected as a `UIFortifier` entry with an index. Deleted from the draft: the `defeatCityVillainCore` split (`defeatVillainCardCore`), `BESIDE_MASTERMIND_TARGET` and the `AttackTargetName` change, `fightResolved.citySpace = -1` and the `notableEvents.types.ts` JSDoc, `UIMastermindState.villainsBeside`, `buildCityCardProjection` / `deepCopyCityCard`, `BesideMastermindVillains.vue`, the second MastermindTile lock arm and the two page mounts. The Ambush narrative follows D-24854 (the handler returns its logged clause; the RS-5 set goes 20 → 21), so the draft's "no Ambush effect" residual is gone. The primitive is position 64 (WP-839 ends at 63).
**Primary Layer:** Game Engine (one `G` field, one villain primitive, a `fightVillain` argument routed into the Fortify fight path, the shared Mastermind-guard predicate and its bot mirror, one optional `UIFortifier` field) + Arena Client (the Fortify chip learns The Blob's index and wording) + card data and the derived coverage feeds.
**Dependencies:** all merged on `main` `a752fc130`: WP-873 / D-24818 / D-24819 (Fortify: the fight path, the projection and the chip this packet extends), WP-897 / D-24854 (keyword-less handlers return `narrativeClause`; RS-5 set), WP-839 / D-24772 (primitives 61-63; this packet appends 64), WP-831 / D-24764 (`UNNAMED_CITY_SPACE_TARGET`), WP-871 / D-24816 (fight restrictions with a null City index), WP-830 / D-24763 (the Enigma peek on any Villain fight). Builds on WP-757 / D-24587 (the Haunt precedent: an Ambush that moves a Villain out of the City into a lazy off-City field), WP-554 / D-24363 + D-24364 (a move gate ships with its `getLegalMoves` mirror), WP-750 / D-24574 (the client gates on projected data), WP-128 / D-12803 (the UIState whitelist). No open packet edits the files below.
**User-Visible Surface:** `play.legendary-arena.com`
**Risk Tier:** MEDIUM
**Lane:** Standard (two-session). It changes two contract files (`rules/villainAbility.types.ts`, `ui/uiState.types.ts`), adds a `G` field, a villain primitive and a `fightVillain` argument.
**Arc:** co2e villain fidelity epic (WP-835..840), inventory row #7.

> Baseline: reconciled on `origin/main` `a752fc130` (#3411). Every line anchor below was read there. `pnpm -r build && pnpm -r --no-bail test` exits 0 with game-engine 7233 / 0 fail and arena-client 2724 / 0 fail.

---

## Goal

As a player facing Magneto's Brotherhood (Legendary core 2nd edition, `co2e`), I want The Blob to do what his card prints, so that he guards the Mastermind instead of being a free 2 VP Villain.

| Card (`co2e/brotherhood-of-mutants`) | Printed line (verbatim, `data/cards/co2e.json`) | Today | After this session |
|---|---|---|---|
| The Blob (Attack 4, VP 2, 2 copies) | `Ambush: Put The Blob to the left of the Mastermind space. Nothing moves The Blob. While he's there, you can't fight the Mastermind. (You can still fight The Blob.)` | No marker. He enters the City like any Villain, the Ambush does nothing, and the D-24266 detector logs it as hollow. | He enters the City (pushing as usual), then his Ambush takes him out of the City to the left of the Mastermind. City movement, pushes and escapes can't reach him there. While he (or the other copy) is there, the Mastermind can't be fought. Any player can fight him there for his printed 4 Attack, exactly like a fortifying Villain; he goes to their Victory Pile. |

The core-set Blob (`core/brotherhood`, `[require-to-defeat:team:x-men]`) is a different card and is not touched.

## User-Visible Impact

- When The Blob is revealed, the log and the Ambush overlay say he moves to the left of the Mastermind and the Mastermind can't be fought while he is there. He leaves the City.
- A chip under the Mastermind's Fight button (the Fortify chip, D-24819 placement) shows `The Blob` with a `Fight 4` button. Its title reads `The Blob is to the left of the Mastermind: the Mastermind can't be fought.`
- The Mastermind's Fight button is disabled with the reason `The Blob is to the left of the Mastermind. Fight The Blob first.` (the Fortify lock arm). The Excessive Violence button for the Mastermind is hidden too.
- Fighting him logs `Player N fought The Blob to the left of the Mastermind.` and re-enables the Mastermind once nothing guards it.
- Bots (bot-ally, autoplay, sim, PAR) fight him when they can and never try to fight the Mastermind while he is there.
- When both copies have ambushed, both sit to the left of the Mastermind (arrival order, one chip each) and both must be fought.

---

## Assumes

1. **Rules text** (`docs/legendary-universal-rules-v23.md`): L547-571 (a Villain entering the City pushes the others; one pushed off the last space escapes), L573-576 (the new Villain's Ambush resolves after any escape it caused), L1299-1301 ("When a card tells you to 'defeat an enemy,' you still do that enemy's Fight effect. You ignore restrictions …", the basis of Operator fork 1), L1454-1466 (Fortify: "Any player can fight that Villain as normal to end that Fortify effect"; a place holds one fortifier).
2. **Card data.** `data/cards/co2e.json` group `brotherhood-of-mutants` (`ledBy: ["magneto"]`) prints the Blob line in §Goal verbatim, `vAttack "4"`, `vp "2"`, `copies: 2` (instance ids `co2e-villain-brotherhood-of-mutants-the-blob-00` / `-01`). `scripts/convert-cards/inputs/villain-effect-markers.json` has a `villains.co2e.brotherhood-of-mutants` block (L116-117, WP-835..839 rows); The Blob has no row and his line carries no `[effect:]` marker.
3. **Fortify on `main`.**
   - `board/fortify.types.ts`: `FortifyPlace = 'sidekick-stack' | 'mastermind'`, `FORTIFY_PLACE_LABELS.mastermind = 'the Mastermind'`, `FORTIFY_LOCK_TEXT['no-fight'] = "the Mastermind can't be fought"`, `Fortification { villainCardId; lock }`.
   - `board/fortify.logic.ts`: `getFortification`, `isMastermindFortified` (L80), `listFortifications` (L106), `removeFortification` (L166, deletes the key when empty), `buildFortifyBlockReason` (L189, `<name> fortifies <place>. Fight <name> first.`). `G.fortifications` holds at most one Villain per place.
   - `moves/fortifyFight.ts` (171 lines): `fightFortifyingVillain(G, context, fortifiedPlace: unknown)` (L57) = `findFightableFortifier` → stage `main` → `hasAnyPendingChoice` → heal lock → zone guard → Size-Changing note → `defeatFortifyingVillainCore` → `spendFightCostForTarget(…, UNNAMED_CITY_SPACE_TARGET)` → Microscopic gain → `hasActedThisTurn` → D-24467 signal → Enigma offer. `defeatFortifyingVillainCore(G, ctx, place, shuffleContext)` (L135) = zone guard → `removeFortification` → Orrgo recorder → Victory Pile → `Player P fought X fortifying <place>. <Place> is no longer fortified.` → `executeVillainAbilities(…, 'onFight', shuffle, undefined)` + the Fight-effect line.
   - `moves/villainDefeatRequirement.logic.ts` `FightableFortifier { cardId; price; required }` (L448-454) and `findFightableFortifier(state, playerId, fortifiedPlace)` (L471-507): place guard, fortified, spendable Attack at `UNNAMED_CITY_SPACE_TARGET` ≥ the floored Size-Changing price, D-24076 requirement, WP-871 restriction with a `null` City index, fail closed on a fight discard cost. It is the single authority; the move and the bot mirror both call it.
   - `moves/fightVillain.ts`: `FightVillainArgs.fortifiedPlace?` (L157-162, "every other argument is ignored"); the branch at L185-193 runs before step 1 and returns.
   - `moves/fightMastermind.ts` L161-167: `if (isMastermindFortified(G)) { return; }`.
   - `simulation/ai.legalMoves.ts` L1228-1240 (step 3b: one `{ fortifiedPlace }` intent per `findFightableFortifier` hit, inside `stage === 'main'`) and L1242-1252 (step 4: `!isMastermindHaunting(gameState) && !isMastermindFortified(gameState)`).
   - `invariants/gameRules.checks.ts` L123-129: every fortifier visited as `fortifications.<place>`.
   - UIState: `UICityState.fortifiers?: UIFortifier[]` and `UIFortifier { place, placeLabel, extId, display, fightCost, lockText, fightRestrictionReason? }` (`ui/uiState.types.ts` L694-722); `UIMastermindState.fortifiedReason?` (L832-835); `buildFortifyProjection` (`ui/uiState.build.ts` L741-805, a `never`-default switch over the place) called once at L1083; `deepCopyFortifiers` (`ui/uiState.filter.ts` L97-120).
   - Client: `FortifiedVillains.vue` (253 lines; props `fortifiers`, `place`, `currentStage`, `isViewerTurn`, `hasHealedThisTurn`, `economy`, `submitMove`; gate stage → heal → `canFight(fightCost, UNNAMED_CITY_SPACE_TARGET)` → `fightRestrictionReason`; submits `fightVillain({ fortifiedPlace: fortifier.place })`; `:key="fortifier.place"`; chip title `${name} fortifies ${placeLabel}: ${lockText}.`). Mounted by `MastermindTile.vue` (L455, `place="mastermind"`) and `SharedDecks.vue` (L356). `MastermindTile.vue` `gateForFight` returns `{ allowed: false, reason: props.mastermind.fortifiedReason }` when it is defined (L234-240), after the Haunt arm and before the tactics check; EV and the Enigma picker go through `gateForFight`.
4. **Haunt precedent** (`villain/villainEffects.execute.ts` `villainEffectHauntHqHero` L5138-5174): finds its `cardId` in `G.city`, records it off-City, nulls the space, logs `${label} effect: ${clause}.` and returns `{ targets, narrativeClause: clause }` (D-24854); blocked branches log `'blocked'` and return their clause too (`narrateBlockedHaunt`).
5. **Ambush fire site.** `villainDeck/villainDeck.reveal.ts` `performVillainReveal`: City entry and push, any escape, then `executeVillainAbilities(…, 'onAmbush', …)`, then `ambushResolved`. A keyword-less clause reaches the overlay through `execution.narrativeClauses` (`villainEffects.execute.ts` L395-409). `villain/ambushNarrative.keywordless.test.ts` L462 pins the 20 keyword-less Ambush primitives found in the card data (L492-512, sorted).
6. **Villain primitives.** `VILLAIN_EFFECT_PRIMITIVES` (`rules/villainAbility.types.ts`) has 63 members, last `enter-city-from-victory-pile` (L685). Pins in `rules/villainAbility.types.test.ts`: L390 title `exactly the 63 canonical primitives`, the ordered list, L458-464 length / message / last-member literal, the length-63 lines at L690, L729, L758, L814, L874, L963, L988, L1030, L1069, their `// why:` lines, and WP-839's `slice(60)` at L1070. The primitive parity Record (L876-945, `describe('WP-873 fortify primitive')`, `unionMembers` at L878) lists every member. `VILLAIN_EFFECT_HANDLERS` is a `Record<VillainEffectPrimitive, …>`. A no-param primitive falls through to the parser's no-param tail (`setup/villainAbility.setup.ts`; the doc list at L675-682). The marker script keeps a hand-synced copy (`scripts/convert-cards/apply-effect-markers.mjs` L231 note, L297 last entry). `scripts/coverage/mechanic-provenance.json` L114 is the WP-839 precedent row.
7. **Free defeats** do not consult Fortify: `moves/defeatChoice.resolve.ts` has no Fortify read (`isMastermindFreeDefeatTarget`), and the Villain builders iterate `G.city`.
8. **No hashed fixture, PAR artifact or runtime-observed sweep plays the co2e Brotherhood** (`packages/game-engine/src/test/**` and `data/par/**` have no `brotherhood-of-mutants` reference; `sim:runtime-observed` sweeps `core/brotherhood`). The group appears in `packages/registry/src/gauntletLoadouts.generated.ts`.
9. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is 0 fail on `a752fc130` (§Baseline).

If any item is false, this packet is **BLOCKED**: STOP and reconcile (update this WP and D-24773) before coding.

## Context (Read First)

- `moves/fortifyFight.ts`, `moves/villainDefeatRequirement.logic.ts` (`findFightableFortifier`), `ui/uiState.build.ts` `buildFortifyProjection` — **AUTHORITATIVE for the off-City fight, its single fightability authority and its projection.** WP-840 extends them; it does not re-derive them.
- **Why reuse Fortify (Operator fork 3).** A Villain off the City that blocks the Mastermind and is fought "as normal" through `fightVillain` is exactly WP-873's Fortify. A second off-City mechanism would duplicate the fightability authority, the bot mirror, the lock predicate, the projection and the chip, and the two would drift (the D-24820 lesson). Reusing it, The Blob costs one list, one primitive, one fight wrapper and one projection loop.
- **Why a separate list, not a Fortify place.** `G.fortifications.mastermind` holds one Fortification (rules L1465-1466: a second fortify of the same place does nothing). Both Blob copies sit there at once, and a Colleen Wing fortify can coexist (The Blob is not the Fortify keyword). Widening the table to a list would change the D-24818 contract and the hashed shape of in-flight Fortify matches. So The Blob lives in a lazy `G.villainsBesideMastermind` list, read only through `board/besideMastermind.logic.ts`.
- **Why outside the City.** "Put The Blob to the left of the Mastermind space" takes him out of the City. If he stayed in `G.city` with a flag, every City reader (push, escape, Whirlwind's swap, Spinning Cyclone, WP-839's movers, scheme twists, Guard, the Danger Meter) would have to learn the flag. Outside the City none of them reach him, so "Nothing moves The Blob" is true by construction (the Haunt shape, D-24587).
- **One guard predicate.** `isMastermindGuarded(G)` = `isMastermindFortified(G)` or a non-empty list. `fightMastermind` and `getLegalMoves` step 4 switch from `isMastermindFortified` to it (D-24364), so a Fortify-only match behaves exactly as today.
- **What a Blob fight shares with a fortifier fight.** The same price (Size-Changing, plain Attack at `UNNAMED_CITY_SPACE_TARGET`, which no restricted grant names), requirement, restriction (null City index), fail-closed discard cost, gates, debit, acted flag, D-24467 signal and Enigma offer. So The Blob inherits D-24818's residuals: no `fightResolved` (no slice VFX or fight sound), no Excessive Violence, no Baron Zemo paid rescue, no attached-Bystander award, and the client offers plain Fight only. One follow-up closes them for both.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.4 (villain group shape) and §5 (printed markup; `[effect:]` is a pipeline-appended engine marker, documented in the marker map `_notes`).
- `docs/ai/ARCHITECTURE.md` Section 1 — Monorepo Package Boundaries (§Package Import Rules, §Layer Boundary (Authoritative)): `apps/arena-client` imports only the `.` engine surface (`UIFortifier`, `UNNAMED_CITY_SPACE_TARGET`). Also §The Move Validation Contract, §Zone & Pile Structure, Persistence Boundaries, §The Rule Execution Pipeline. `.claude/rules/architecture.md` §Layer Boundary (Enforcement) and §UIState Projection Integrity (the five-step contract).
- `docs/ai/DECISIONS.md`: scan D-24818, D-24819, D-24854, D-24824, D-24587, D-24750, D-24364, D-24574, D-24802, D-24816, D-24076, D-24763, D-24467, D-24081, D-12803, D-24266, D-24372 before coding.
- User memory: `reference_bot_legalmoves_moveguard_divergence`, `reference_villain_effect_vocabulary_extension`, `reference_card_data_pipeline`, `reference_engine_tests_never_typechecked`, `reference_setup_hook_change_replay_compat`.

### Operator forks (forks 1 and 2 locked to their defaults at pre-flight 2026-11-15; choosing an alternative is a re-scope)

1. **Do free "defeat" effects reach the Mastermind while The Blob is beside it?** (Silent Sniper's defeat-with-Bystander, Pure Fury.) **Default: yes, unchanged.** Rules v23 L1299-1301 say a "defeat" ignores restrictions; D-24750 locks that only `fightVillain` pays fight restrictions; Fortify already leaves free defeats alone (Assumes 7). Alternative: block them in `isMastermindFreeDefeatTarget` (one line + one test). Either way Pure Fury cannot target a Villain to the left of the Mastermind (its builder iterates `G.city`): a named residual and follow-up.
2. **Amwp Energy Shield** (`amwp/armada-of-kang/energy-shield`, "Ambush: Put this Energy Shield above the Mastermind space. While it's there, you can't fight the Mastermind."). **Default: out of scope**, named follow-up (it would reuse this packet's primitive with one marker row, after checking its Conqueror line off-City).
3. **Reuse Fortify or build the draft's parallel path?** **Decided by Jeff 2026-11-15: reuse Fortify** (§Reconciliation). The alternative was the 2026-10-25 draft (split `defeatCityVillainCore`, new fight target, `citySpace -1`, own component and lock arm), which would have given The Blob EV / rescue / the fight sound at the cost of a second off-City mechanism.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries, no `import *`.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24773) before coding. One WP per session. Jeff merges the execution PR.

**Packet-specific:**
- **One predicate.** The move and the bot read `isMastermindGuarded`; the projected `mastermind.fortifiedReason` is present exactly when `isMastermindGuarded(G)` is true, and the client reads only that. No inline list-length test elsewhere.
- **One fightability authority.** `findFightableOffCityVillain` (extracted verbatim from `findFightableFortifier`) prices and checks both a fortifier and a Villain to the left of the Mastermind; the move and the bot mirror both call it through their wrappers.
- **Gate before commit, mirror in the bot** (D-24364): the `fightMastermind` change and the step-3b / step-4 mirrors land in the same commit as the move code.
- **Byte-identical without The Blob.** No `G` key, log line, intent arg, projection key or event changes in a match where no Blob has ambushed (for every input a client or bot sends today), including Fortify matches (a fortifier's `UIFortifier` gains no key; its fight logs exactly today's lines). Hash oracles unchanged.
- **Data, not English.** Behavior comes only from the `[effect:put-self-beside-mastermind]` marker. Never run `convert-cards-v15.mjs`.
- **Self-narrate** through `pushLog` (hash-excluded `G.messages`, D-24081) and return the logged clause as `narrativeClause` (D-24854). `VillainEffectKeyword`, the legacy reverse-map and `EFFECT_KEYWORD_LABELS` stay frozen.
- **Five-step UIState contract** for `UIFortifier.besideMastermindIndex` (`.claude/rules/architecture.md`).
- **City code untouched.** No City mover, push, escape, Guard, City fight or City-space helper changes.

## Locked Values

**State (`types.ts`, beside `fortifications`):** `LegendaryGameState.villainsBesideMastermind?: CardExtId[]` — Villains to the left of the Mastermind space, arrival order (WP-840 / D-24773). Lazy: created by the first put, deleted when the last one leaves; never `[]` in `G`.

**Helpers (`board/besideMastermind.logic.ts`, new, boardgame.io-free, never throw; the only readers and writers of the field):**
- `listVillainsBesideMastermind(G): readonly CardExtId[]` — `G.villainsBesideMastermind ?? []`.
- `getVillainBesideMastermind(G, besideIndex: unknown): CardExtId | null` — null unless `besideIndex` is an integer in `0..length-1`.
- `putVillainBesideMastermind(G, cardId): boolean` — false (no write) when `cardId` is already listed; otherwise lazy-create and append, true.
- `takeVillainBesideMastermind(G, besideIndex: number): CardExtId | null` — removes and returns the entry (`getVillainBesideMastermind` rules), deleting the field when it empties.
- `isMastermindGuarded(G): boolean` — `isMastermindFortified(G) || listVillainsBesideMastermind(G).length > 0`.
- `buildBesideMastermindBlockReason(G): string | null` — null when the list is empty; else, for the first listed Villain's display name `name` (falling back to its id, the `buildFortifyBlockReason` rule): `` `${name} is to the left of the Mastermind. Fight ${name} first.` ``

**Primitive (`rules/villainAbility.types.ts`):** `'put-self-beside-mastermind'` appended to the union **and** at position 64 of `VILLAIN_EFFECT_PRIMITIVES`, with the append `// why:`. No params; any `:` param → unresolved. No `descriptorKey` change. Pins in `villainAbility.types.test.ts`: the L390 title and the L458-464 length / message / last-member literal → 64 and `put-self-beside-mastermind`; the ordered list appended; every `length, 63` line → 64 with its `// why:` naming WP-840 position 64; WP-839's `slice(60)` → `slice(60, 63)`; the parity Record gains the member. Intended product change, stated in the commit body. The marker script copy gains the entry at position 64 with the same note.

**Handler (`villainEffectPutSelfBesideMastermind`, executor, keyword-less; `label = villainEffectTimingLabel(timing)`, `name = resolveCardDisplayName(G, cardId)`). Each branch logs `` `${label} effect: ${clause}.` `` and returns `{ targets: [], narrativeClause: clause }` (D-24854):**
- `G.city.indexOf(cardId) < 0` → clause `` `${name} is not in the City; it stays where it is` ``, `'blocked'`, no write.
- `putVillainBesideMastermind` false → clause `` `${name} is already to the left of the Mastermind` ``, `'blocked'`, no City write.
- Otherwise `G.city[cityIndex] = null` and clause `` `${name} moves to the left of the Mastermind; nothing can move him, and the Mastermind can't be fought while he is there` ``, `'threat'`.
- The executor's ordinary trace records `put-self-beside-mastermind:fired`; no D-24824 allowlist entry (the handler is not a bridged no-op).

**Fightability (`moves/villainDefeatRequirement.logic.ts`):**
- `findFightableOffCityVillain(state, playerId, cardId: CardExtId): FightableFortifier | null` — the price / requirement / restriction / discard-cost checks of `findFightableFortifier` moved verbatim (with their `// why:` comments). `findFightableFortifier` keeps its signature and JSDoc and becomes place guard → `getFortification` → delegate.
- `findFightableVillainBesideMastermind(state, playerId, besideMastermindIndex: unknown): FightableFortifier | null` — `getVillainBesideMastermind` null → null; else delegate. The `FightableFortifier` JSDoc notes it also covers a Villain to the left of the Mastermind.

**Fight (`moves/fortifyFight.ts`):**
- `type OffCityFightLocation = { kind: 'fortified'; place: FortifyPlace } | { kind: 'beside-mastermind'; besideIndex: number }` (module-local).
- The body of `fightFortifyingVillain` after its `findFightableFortifier` call moves verbatim into module-local `fightOffCityVillain(G, context, fortifier: FightableFortifier, location: OffCityFightLocation): void`. Its stage, pending-choice, heal-lock and missing-zone refusals move verbatim, with their `// why:` comments, into module-local `isOffCityFightBlocked(G, currentPlayer): boolean` (so the body fits one screen); `fightOffCityVillain` returns when it is true. Its one other change is the defeat call: `defeatOffCityVillainCore(G, context.ctx, location, { random: context.random })`, a module-local `switch` on `location.kind` with a `never` default calling `defeatFortifyingVillainCore` or `defeatVillainBesideMastermindCore`. `fightFortifyingVillain` keeps its signature and becomes `findFightableFortifier` → `fightOffCityVillain(…, { kind: 'fortified', place })`.
- New `fightVillainBesideMastermind(G, context, besideMastermindIndex: unknown): void` (exported) — `findFightableVillainBesideMastermind` → null → return; else `fightOffCityVillain(…, { kind: 'beside-mastermind', besideIndex })`.
- `defeatFortifyingVillainCore` keeps its signature, its zone guard and `removeFortification`, then calls module-local `awardOffCityVillain(G, ctx, zones, cardId, foughtLine, shuffleContext)` = the Orrgo recorder, Victory Pile push, `pushLog(G, foughtLine)`, onFight with `cityIndex` undefined and the Fight-effect line, moved verbatim. Its fought line is today's string.
- New `defeatVillainBesideMastermindCore(G, ctx, besideIndex: number, shuffleContext): void` (exported) — the same zone guard, `takeVillainBesideMastermind` (null → return), then `awardOffCityVillain` with `` `Player ${currentPlayer} fought ${formatCardRef(G.cardDisplayData, cardId)} to the left of the Mastermind.` ``
- File header and JSDoc name The Blob beside Fortify (WP-840 / D-24773).

**`fightVillain` (`moves/fightVillain.ts`):** `FightVillainArgs.besideMastermindIndex?: number` (JSDoc: WP-840 / D-24773, the 0-based position in `G.villainsBesideMastermind`; fights that Villain instead of a City Villain; every other argument except `fortifiedPlace` is ignored). Directly after the `fortifiedPlace` branch (so `fortifiedPlace` wins when both are sent, and every pre-existing input is byte-identical): `if (besideMastermindIndex !== undefined) { fightVillainBesideMastermind(G, context, besideMastermindIndex); return; }` with a `// why:`. The `fightVillain` JSDoc names the off-City locations.

**`fightMastermind` (`moves/fightMastermind.ts` L161-167):** `isMastermindFortified(G)` → `isMastermindGuarded(G)`; the `// why:` names both sources.

**`getLegalMoves` (`simulation/ai.legalMoves.ts`):**
- Step 3b, after the fortifier loop inside the same `stage === 'main'` block: for `besideIndex` from 0 to `listVillainsBesideMastermind(gameState).length - 1`, push `{ name: 'fightVillain', args: { besideMastermindIndex: besideIndex } }` when `findFightableVillainBesideMastermind(gameState, activePlayer, besideIndex) !== null`. The 3b comment and the canonical-order JSDoc list name it.
- Step 4: `!isMastermindFortified(gameState)` → `!isMastermindGuarded(gameState)`.

**Invariant (`invariants/gameRules.checks.ts`):** after the fortifications loop, each listed id visited as `` `villainsBesideMastermind.${index}` ``.

**UIState:**
- `UIFortifier.besideMastermindIndex?: number` (JSDoc: WP-840 / D-24773 — present only on an entry for a Villain to the left of the Mastermind, whose `place` is `'mastermind'`; the client sends it back as `fightVillain({ besideMastermindIndex })`; absent on every fortifier). The `UICityState.fortifiers` JSDoc names The Blob.
- `buildFortifyProjection`: after the fortifications loop, `appendBesideMastermindFortifiers(gameState, activePlayerId, fortifiers)` — a new module-local function with JSDoc that pushes one entry per listed Villain in list order: `place: 'mastermind'`, `placeLabel: FORTIFY_PLACE_LABELS.mastermind`, `extId`, `display`, `fightCost` and `fightRestrictionReason` built exactly as for a fortifier, `lockText: FORTIFY_LOCK_TEXT['no-fight']`, `besideMastermindIndex`. Then, if `mastermindFortifiedReason` is still null, it becomes `buildBesideMastermindBlockReason(gameState)` (a Fortify reason wins when both guard). So `fortifiers` = fortifiers in FORTIFY_PLACES order, then Villains to the left of the Mastermind in arrival order.
- Comment / JSDoc updates in the same files: the `fortifiedReason` spread comment in `buildUIState` names `isMastermindGuarded` and The Blob; `UIFortifier.place` reads "The fortified place, or `mastermind` for a Villain to the left of the Mastermind (WP-840). The client sends it back as `fightVillain({ fortifiedPlace })` unless `besideMastermindIndex` is present."; the `UICityState.fortifiers` order sentence names both parts; `UIMastermindState.fortifiedReason` names The Blob.
- `deepCopyFortifiers` copies `besideMastermindIndex` with a conditional spread (absent stays absent), every audience.

**Client (`apps/arena-client/src/components/play/FortifiedVillains.vue`):**
- `onFightFortifier`: when `fortifier.besideMastermindIndex !== undefined`, `submitMove('fightVillain', { besideMastermindIndex: fortifier.besideMastermindIndex })`; otherwise today's `{ fortifiedPlace }` payload.
- `chipTitle`: the relation is `` `${name} is to the left of ${placeLabel}: ${lockText}.` `` for an entry with an index, today's `fortifies` sentence otherwise; the sr-only text reads `To the left of …` vs today's `Fortifying …`.
- `:key`: `fortifierKey(fortifier)` = `fortifier.place` for a fortifier (unchanged), `` `${fortifier.place}-beside-${index}` `` for an index entry, so two Blobs and a Colleen Wing render as three chips.
- The list's `aria-label` becomes `Villains guarding this place` (no test pins it). The gate is unchanged (stage → heal → cost at `UNNAMED_CITY_SPACE_TARGET` → `fightRestrictionReason`). The header comment names The Blob. `MastermindTile.vue`, `SharedDecks.vue` and the pages are unchanged: the existing mount and the existing `fortifiedReason` lock arm carry The Blob.

**Comment-only (`board/fortify.logic.ts`):** the header (L11) and the `isMastermindFortified` `// why:` (L74-75) say the Mastermind lock now reads `isMastermindGuarded` (`board/besideMastermind.logic.ts`), which includes `isMastermindFortified`. No code change.

**Docs:** `wiki/card-effect-system.md` L177 "sixty-three entries as of WP-839" → "sixty-four entries as of WP-840".

**Data:**
- Marker map `villains.co2e.brotherhood-of-mutants` gains `"the-blob": { "ambush": ["put-self-beside-mastermind"] }`.
- `apply-effect-markers.mjs` local `VILLAIN_EFFECT_PRIMITIVES` gains the entry at position 64 with the append note.
- `mechanic-provenance.json`: `"put-self-beside-mastermind": { "wp": "WP-840", "decision": "D-24773" }`.
- `docs/ai/coverage/live-verify.json`: one `pending` row keyed `co2e-villain-brotherhood-of-mutants-the-blob|put-self-beside-mastermind` (the WP-838 / WP-839 precedent), flipped when the live-verify passes.
- `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json`: regenerated by `pnpm spike:local-bundle` (the Blob ability strings gain the marker; `initialStateHash` unchanged).

---

## Scope (In)

- **A)** `board/besideMastermind.logic.ts` (new) + test: the six helpers.
- **B)** `types.ts`: the `G` field.
- **C)** `rules/villainAbility.types.ts` + test; `setup/villainAbility.setup.ts` (the no-param doc list) + test: the primitive.
- **D)** `villain/villainEffects.execute.ts` + test: the handler and map entry. `villain/ambushNarrative.keywordless.test.ts`: the RS-5 set 20 → 21 and the T8 reveal cases.
- **E)** `moves/villainDefeatRequirement.logic.ts` + test: the extracted authority and the beside wrapper.
- **F)** `moves/fortifyFight.ts` + `moves/fortifyFight.test.ts`: the shared off-City fight and the Blob wrapper / core; `board/fortify.logic.ts` (comments only).
- **G)** `moves/fightVillain.ts`: the argument and the branch (its cases T15 live in `fortifyFight.test.ts`, which already drives `fightVillain`).
- **H)** `moves/fightMastermind.ts` + test: the shared guard.
- **I)** `simulation/ai.legalMoves.ts` + test: step 3b and step 4.
- **J)** `invariants/gameRules.checks.ts` + `invariants/invariants.test.ts`; `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts` + `ui/uiState.filter.test.ts`.
- **K)** Client: `FortifiedVillains.vue` + `FortifiedVillains.test.ts`.
- **L)** Data: the marker script and map, `mechanic-provenance.json`, `co2e.json` regenerated (1 line), the regenerated villain ledger + effect index and local-spike bundle, the `live-verify.json` row, the `wiki/card-effect-system.md` count.

## Out of Scope

- **Free defeats** (Operator fork 1 default): Silent Sniper / Pure Fury can still defeat the Mastermind while The Blob is beside it. **Pure Fury cannot target a Villain to the left of the Mastermind** (its builder iterates `G.city`): a named residual and follow-up.
- **Amwp Energy Shield** (Operator fork 2 default): named follow-up.
- **The D-24818 off-City residuals, now shared by The Blob:** no `fightResolved` event (no slice VFX, no fight sound), no Excessive Violence, no Baron Zemo paid rescue, no attached-Bystander or captured-Hero award (unreachable for The Blob: his Ambush fires right after his City entry, before anything can attach to him), a fight discard cost fails closed, and the client offers plain Fight only. One follow-up closes them for Fortify and The Blob together.
- **Chip placement.** The Blob's chip sits under the Mastermind's Fight button (D-24819's "on or near" placement), not as a card tile left of the Mastermind.
- **Lock precedence.** The Fortify lock arm runs before MastermindTile's tactics check, so in the unreachable state "tactics 0, no Final Blow, The Blob beside" the button shows The Blob's reason instead of the vanquished reason (the existing Fortify order, unchanged).
- **Stale client bundles.** A client bundle older than WP-840 shows the Blob chip, but its Fight click sends `{ fortifiedPlace: 'mastermind' }`, a silent no-op, until reload (the Mastermind lock is correct on old clients, which already read `fortifiedReason`). Accepted transient residual.
- **`MastermindTile.vue` L230-233 comment** still names only `isMastermindFortified`; the file is not on the allowlist, so it is a STATUS follow-up (comment drift only).
- **Operator setters / board inspection** do not list or move a Villain to the left of the Mastermind.
- **The core Blob** (`core/brotherhood`, `require-to-defeat`).
- **PAR regeneration** (none exists for the group; see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `board/besideMastermind.logic.ts`, `board/besideMastermind.logic.test.ts` — **new**
- `types.ts` — modified (one field)
- `rules/villainAbility.types.ts`, `rules/villainAbility.types.test.ts` — modified
- `setup/villainAbility.setup.ts` (doc list), `setup/villainAbility.setup.test.ts` — modified
- `villain/villainEffects.execute.ts`, `villain/villainEffects.execute.test.ts`, `villain/ambushNarrative.keywordless.test.ts` — modified
- `moves/villainDefeatRequirement.logic.ts`, `moves/villainDefeatRequirement.logic.test.ts` — modified
- `moves/fortifyFight.ts`, `moves/fortifyFight.test.ts` — modified
- `board/fortify.logic.ts` — modified (comments only)
- `moves/fightVillain.ts` — modified
- `moves/fightMastermind.ts`, `moves/fightMastermind.test.ts` — modified
- `simulation/ai.legalMoves.ts`, `simulation/ai.legalMoves.test.ts` — modified
- `invariants/gameRules.checks.ts`, `invariants/invariants.test.ts` — modified
- `ui/uiState.types.ts`, `ui/uiState.build.ts`, `ui/uiState.filter.ts`, `ui/uiState.filter.test.ts` — modified

**Client (`apps/arena-client/src/`)**
- `components/play/FortifiedVillains.vue`, `components/play/FortifiedVillains.test.ts` — modified

**Scripts and data**
- `scripts/convert-cards/apply-effect-markers.mjs`, `scripts/convert-cards/inputs/villain-effect-markers.json`, `scripts/coverage/mechanic-provenance.json` — modified
- `data/cards/co2e.json` — regenerated (the Blob line gains one trailing marker)
- `docs/ai/coverage/villain-mechanic-ledger.json`, `docs/ai/coverage/villain-mechanic-ledger.csv`, `data/metadata/effect-implementation-index.json`, `apps/arena-client/src/fixtures/localSpike/featuredSetupBundle.json` — regenerated; `data/metadata/card-mechanics.json` and the wiki-viewer projection only if their checks report stale
- `docs/ai/coverage/live-verify.json` — modified (one `pending` row)
- `wiki/card-effect-system.md` — modified (the primitive count)

**Governance:** `docs/ai/DECISIONS.md` (D-24773), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`, `docs/ai/NUMBER-LEDGER.md` (if the ledger row needs closing), `docs/ai/post-mortems/01.6-WP-840-co2e-the-blob-guards-the-mastermind.md` (**new**, the mandatory 01.6 post-mortem: this packet adds a new projection field and a new execution path, `docs/ai/REFERENCE/01.6-post-mortem-checklist.md`).

That is 26 engine files (12 tests), 2 client files (1 test), 3 script/input files, 1 card-data file, 4-5 generated feeds, the live-verify row and one wiki line. About half are tests; the production edits outside the new helper file, the handler and `fortifyFight.ts` are one to fifteen lines each.

## Contract

- The Locked Values above: `G.villainsBesideMastermind`, the six helpers, the primitive and its log strings, `findFightableOffCityVillain` / `findFightableVillainBesideMastermind`, `fightVillainBesideMastermind` / `defeatVillainBesideMastermindCore` and the fought line, `FightVillainArgs.besideMastermindIndex` and its branch order, the `isMastermindGuarded` gate and its bot mirror, the step-3b intents, `UIFortifier.besideMastermindIndex`, the lock reason, the chip payload and wording.
- `fightFortifyingVillain`, `defeatFortifyingVillainCore`, `findFightableFortifier`, `defeatCityVillainCore`, `executeVillainAbilities`, `resolveFightCost` and every existing handler keep their signatures and behavior; `descriptorKey` is unchanged. Every existing Fortify test passes unedited.

## Test Contract

Minimal-`G` fixtures in each file's existing style. "Blob" = `co2e-villain-brotherhood-of-mutants-the-blob-00` (`-01` for the second copy) with `cardStats` fight cost 4 and `cardDisplayData` name `The Blob`. Each T-case is at least one `it`, under one `describe('WP-840 …')` per file. T2 edits the `VILLAIN_EFFECT_PRIMITIVES` pins exactly as Locked Values lists them and the RS-5 sorted list gains one entry: intended product changes, said so in the commit body. No other existing assertion changes.

| # | File | Input | Expected | Must NOT / invariant |
|---|---|---|---|---|
| T1 | besideMastermind | `list` / `get` / `isMastermindGuarded` / reason on absent and on `[blob-00]`; `put` blob-00 twice; `take(0)`; `get(1)`, `get(-1)`, `get(0.5)`, `get('0')`; a Colleen fortification alone | `[]` / null / false / null on absent; guarded true, reason `The Blob is to the left of the Mastermind. Fight The Blob first.`; second `put` false, length 1; `take` returns blob-00 and the field is deleted; nulls; Colleen alone → guarded true, Blob reason null | never `[]` in G |
| T2 | types | `VILLAIN_EFFECT_PRIMITIVES` and every existing pin | length 64 everywhere; last entry `put-self-beside-mastermind` at position 64; WP-839's `slice(60)` → `slice(60, 63)`, contents unchanged; parity Record passes | |
| T3 | setup | parse `put-self-beside-mastermind`; `put-self-beside-mastermind:1` | `{ primitive }`; unresolved | |
| T4 | setup | `buildVillainAbilityHooks` over the Blob line copied **verbatim** from the regenerated `co2e.json` | one onAmbush hook with that descriptor; no `unresolvedMarkers` | |
| T5 | executor | City `[v0, v1, blob-00, null, null]`, onAmbush the descriptor | City `[v0, v1, null, null, null]`; list `[blob-00]`; the `moves to the left of the Mastermind` line `'threat'`; `narrativeClause` equals the logged clause; trace `put-self-beside-mastermind:fired` | other spaces untouched |
| T6 | executor | T5 then blob-01 at City 0 ambushes | list `[blob-00, blob-01]` | arrival order |
| T7 | executor | the Blob not in the City; the Blob already listed and also at City 1 | no write, `not in the City` `'blocked'`, no field; `already to the left` `'blocked'`, City unchanged; each `narrativeClause` equals its logged clause | never throws |
| T8 | ambushNarrative.keywordless | a marked Blob revealed into City `[a, b, c, d, null]`; then into a full City; the RS-5 card-data scan | Blob listed, absent from City, `a..d` pushed one space; the `ambushResolved` narrative names the move (D-24854); full City → the Bridge Villain escaped before the Blob left; the RS-5 set has 21 primitives incl. `put-self-beside-mastermind` | rules L573-576 order |
| T9 | fightMastermind | list `[blob-00]`, attack ≥ Mastermind cost, a tactic left | `G` deep-equal before/after | silent refusal |
| T10 | fightMastermind | same with the field absent; a Colleen fortification alone | a tactic is defeated; refused (Fortify unchanged) | control |
| T11 | fortifyFight | list `[blob-00]`, attack 4, `fightVillainBesideMastermind(G, ctx, 0)` | Blob in victory; field deleted; attack spent 4; `hasActedThisTurn`; log `Player 0 fought The Blob to the left of the Mastermind.`; no `fightResolved` event | |
| T12 | fortifyFight | attack 3; index 1 with one Blob; -1; 0.5; `'0'`; field absent; stage `start`; healed this turn; an open pending choice | each: `G` deep-equal | silent return |
| T13 | fortifyFight | plain attack 0 plus a 4-point restricted grant for `sewers`; then one for `mastermind` | both refused (`G` deep-equal) | no grant pays The Blob |
| T14 | fortifyFight | list `[blob-00, blob-01]` and a Colleen fortification; fight index 1, then Colleen, then index 0 | after each fight the Mastermind stays guarded until the last; `isMastermindGuarded` false after the third | |
| T15 | fortifyFight (via `fightVillain`) | list `[blob-00]`, `{ besideMastermindIndex: 0 }`; `{ fortifiedPlace: 'mastermind', besideMastermindIndex: 0 }` with Colleen fortifying; a City Villain at 0 with `{ cityIndex: 0 }` | the Blob fight resolves (T11 effects); the fortifier is fought and the list is unchanged; the City fight logs the unchanged `at city space 0` line and `fightResolved.citySpace` 0, list unchanged | branch order; City path byte-identical |
| T16 | villainDefeatRequirement | `findFightableVillainBesideMastermind` affordable / unaffordable / bad index; `findFightableFortifier` on an existing fixture | `{ cardId, price 4, required 4 }` / null / null; the fortifier result unchanged | one authority |
| T17 | legalMoves | list `[blob-00]`, attack 4 + enough for the Mastermind | contains `{ fightVillain, { besideMastermindIndex: 0 } }`; no `fightMastermind` | mirrors T9 / T11 |
| T18 | legalMoves | attack 3 | no beside intent | mirrors T12 |
| T19 | legalMoves | no field; City Villains; affordable Mastermind | the intent list deep-equals the pre-change list and `fightMastermind` is present | byte-identical |
| T20 | invariants | the Blob in the list only; then in the list and at City 0 | passes; duplicate reported naming `villainsBesideMastermind.0` | container visited |
| T21 | ui filter | build + filter with list `[blob-00]` for player 0, player 1, a spectator; a Colleen-only state; Colleen fortifying and `[blob-00]` listed; a state with neither | Blob-only: `city.fortifiers` has one entry (`place` `mastermind`, `besideMastermindIndex` 0, `extId`, `display.name` The Blob, `fightCost` 4, `lockText`), `mastermind.fortifiedReason` the Blob reason, for all three audiences, deep-equal and not aliased; Colleen-only: no `besideMastermindIndex` key and today's reason; both: `fortifiers` = [Colleen (no index), Blob (index 0)] and the reason is Colleen's `fortifies` reason; neither: no `fortifiers` / `fortifiedReason` keys; in all four, `fortifiedReason` is present exactly when `isMastermindGuarded(G)` | five-step steps 2-4 |
| T22 | FortifiedVillains | `place="mastermind"`, fortifiers = Colleen + two Blob entries (indexes 0 and 1), viewer's Main, attack 4; click the second Blob; then a Colleen click; not the viewer's turn | three chips; the Blob chip title reads `The Blob is to the left of the Mastermind: the Mastermind can't be fought. …`; the click submits `fightVillain { besideMastermindIndex: 1 }`; Colleen still submits `{ fortifiedPlace: 'mastermind' }` and her title still says `fortifies`; disabled chips submit nothing | Fortify chip unchanged |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §2 (Content Authenticity) and §10 (Content as Data) through the card-data marker, §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** `co2e/brotherhood-of-mutants` appears in published gauntlet loadout rows (`packages/registry/src/gauntletLoadouts.generated.ts`). The Blob now blocks the Mastermind until he is fought, so those legs get harder. No committed `data/par` artifact references the group, so nothing is re-pinned; a future PAR run sees the new behavior.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (card fidelity; no paid or persuasive surface).

**Determinism preservation:**
- `G.villainsBesideMastermind` is lazy and appears only after a Blob Ambush. `getLegalMoves` output, every log line, every notable event and every projection key are unchanged in any match without one, Fortify matches included (T15, T19, T21). No randomness; list order is arrival order.
- Narration goes to hash-excluded `G.messages` (D-24081). `finalStateHash` and `PRE_WP080_HASH` are expected unchanged (Assumes 8); if either moves, STOP and explain before any re-pin.
- **Replay-compat:** stored matches replay from their bgio `initialState`, which holds the setup-time hooks; a pre-WP-840 match has no Blob marker and replays identically (`reference_setup_hook_change_replay_compat`). Only a match created after the deploy sees the new behavior. Recorded in D-24773.

## Funding Surface Gate

§20 **N/A**: engine, card data and a gameplay control. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Helpers and grammar.** T1-T4 pass as runtime assertions. `apply-effect-markers.mjs` accepts `put-self-beside-mastermind` and, put by hand into the map as `put-self-beside-mastermind:1`, fails loudly (observed, reverted, recorded in the EC-878 commit body).
2. **Ambush.** T5-T8 pass.
3. **Mastermind guard and Blob fight.** T9-T16 pass; T12's nine refusals leave `G` deep-equal; every existing `fortifyFight.test.ts`, `fightVillain.test.ts` and `fightMastermind.test.ts` assertion passes unedited.
4. **Bot mirror.** T17-T19 pass.
5. **Invariant and projection.** T20-T21 pass; T21 also asserts `buildUIState` alone carries the field (step 2) before the filter (step 3).
6. **Client.** T22 passes; `pnpm --filter @legendary-arena/arena-client typecheck` exits 0.
7. **Board check (observed).** On the 1280x720 dev route (`?fixture=mid-turn&play=1`), with `city.fortifiers` set to one Blob entry and `mastermind.fortifiedReason` to its reason by injecting them into the store at runtime (the fixture JSON is not edited): the Blob chip renders under the Mastermind's Fight button with `Fight 4`, the adversary band has no horizontal overflow, and the Mastermind Fight button shows the locked reason. At 375x812 the page has no horizontal overflow. Recorded in the commit body.
8. **Data.** `apply-effect-markers.mjs` prints `co2e.json — 1 new marker(s) this run` and re-runs at 0; `git diff data/cards/` touches only `co2e.json`, one line gaining ` [effect:put-self-beside-mastermind]`.
9. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail; `cards:check`, `cards:count-markers:check`, `effect-index:check`, `ledger:villains:check`, `mechanics:metadata:check`, `gauntlet:loadouts:check`, `sim:runtime-observed:check`, `sim:coverage --check`, `node scripts/build-local-spike-bundle.mjs --check`, and `wiki-viewer:check-links` after `pnpm wiki-viewer:project` exit 0 after the regeneration in Verification Steps.
10. **Hashes.** `finalStateHash`, `PRE_WP080_HASH` and the local-spike `initialStateHash` byte-unchanged.
11. **Ledger row.** In the regenerated `villain-mechanic-ledger.json`, The Blob (`put-self-beside-mastermind`) is `executable` with a handler and WP-840 / D-24773 provenance; no other row changes.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` and `pnpm --filter @legendary-arena/arena-client test` → all pass; record before / after totals.
3. `node scripts/convert-cards/apply-effect-markers.mjs`; re-run → 0 new markers. `git diff --stat -- data/cards/` → only `co2e.json`.
4. `pnpm -r build` again (the ledger reads the engine dist), then `pnpm ledger:villains && pnpm effect-index && pnpm spike:local-bundle`.
5. `pnpm cards:check && pnpm cards:count-markers:check && pnpm effect-index:check && pnpm ledger:villains:check && pnpm mechanics:metadata:check && pnpm gauntlet:loadouts:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0 (regenerate `card-mechanics.json` only if its check flags). `pnpm wiki-viewer:project && pnpm wiki-viewer:check-links` → 0. `node scripts/build-local-spike-bundle.mjs --check` → 0. If `gauntlet:loadouts:check` or `sim:runtime-observed:check` flags, STOP: Assumes 8 is false (`sim:coverage --check` is hero-only; a flag there is investigated on its own).
6. `pnpm -r --no-bail test` → 0 fail (paste every package's totals); `pnpm --filter @legendary-arena/arena-client typecheck` → exit 0. The AC 7 board check.
7. After governance close: `pnpm roadmap:counts:check && pnpm ledger:numbers:check && pnpm workindex:rows:check && pnpm workindex:executed:check && pnpm workindex:liveverify:check` → exit 0. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
8. Revert proofs, one at a time, each must fail at least one T-case: (a) `fightMastermind` back to `isMastermindFortified` (T9); (b) step 4 back to `isMastermindFortified` (T17); (c) drop the step-3b beside loop (T17); (d) leave the City space set in the handler (T5, T20); (e) price the off-City fight at `'mastermind'` instead of `UNNAMED_CITY_SPACE_TARGET` (T13); (f) drop `besideMastermindIndex` from `deepCopyFortifiers` (T21); (g) send `{ fortifiedPlace }` for an index entry in the chip (T22).

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the seven revert proofs were observed.
- [ ] D-24773 appended to `DECISIONS.md` as Active. 01.6 post-mortem written (`docs/ai/post-mortems/01.6-WP-840-co2e-the-blob-guards-the-mastermind.md`). `docs/ai/STATUS.md` updated with the follow-ups: Energy Shield (Operator fork 2), Pure Fury cannot target a Villain to the left of the Mastermind, the shared off-City residuals (EV / rescue / fight sound / slice VFX for Fortify and The Blob together), and the `MastermindTile.vue` L230-233 comment drift.
- [ ] WORK_INDEX `[x]` with `[live-verify: pending]` (D-24853), EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check`, `ledger:numbers:check`, `workindex:rows:check` and `workindex:executed:check` exit 0.
- [ ] Two-commit topology: `EC-878:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). On `play.legendary-arena.com`, with `/api/version` showing a gitSha that contains the merge, in a match created after the deploy with `co2e/magneto` (it always leads the Brotherhood), driven by `POST https://api.legendary-arena.com/api/match/autoplay` with `setupData` (or the operator setter pane), reading the log and the Pinia `uiStateSnapshot` on the play page:
  - The Blob's reveal logs `moves to the left of the Mastermind` and he leaves the City; the snapshot shows his `city.fortifiers` entry with `besideMastermindIndex` and `mastermind.fortifiedReason` (five-step step 5);
  - no `fightMastermind` happens while he is there;
  - a fight of him logs `fought The Blob to the left of the Mastermind`, and after the last one the snapshot has no Blob entry and the Mastermind can be fought again.

  The WORK_INDEX token flips to `[live-verify: verified]` and the `live-verify.json` row to verified in a `SPEC:` PR once seen.

## Reserved Decision (lands at execution)

**D-24773 — co2e-the-blob-guards-the-mastermind.** It locks:
- the authorized contract-file changes: `rules/villainAbility.types.ts` (primitive `put-self-beside-mastermind`, appended at position 64) and `ui/uiState.types.ts` (`UIFortifier.besideMastermindIndex?`);
- Operator fork 3, decided by Jeff 2026-11-15: The Blob reuses the WP-873 / D-24818 Fortify fight path, fightability authority, lock arm, projection and chip; only his position (a lazy `G.villainsBesideMastermind` list, arrival order, both copies) and his Ambush primitive are new, because Fortify holds one Villain per place and fires at Escape;
- a Villain "to the left of the Mastermind space" is outside the City, so no City mover, push, escape or Guard reaches it ("Nothing moves The Blob" by construction, the D-24587 Haunt shape); the Ambush runs after the City entry and any escape it caused (rules v23 L573-576); the handler returns its logged clause (D-24854);
- `isMastermindGuarded` (fortified or a non-empty list) is the one predicate behind `fightMastermind` and `getLegalMoves` step 4 (D-24364), and the projected `mastermind.fortifiedReason` is present exactly when it is true (a Fortify reason wins when both guard); free "defeat" effects still reach the Mastermind (Operator fork 1 default; rules v23 L1299-1301; D-24750);
- a Villain to the left of the Mastermind is fought through `fightVillain({ besideMastermindIndex })`, routed after the `fortifiedPlace` branch into the shared off-City fight; `findFightableOffCityVillain` (extracted verbatim from `findFightableFortifier`) is the one authority; plain Attack at `UNNAMED_CITY_SPACE_TARGET` only; it shares D-24818's residuals (no `fightResolved`, EV, paid rescue or attached award; a fight discard cost fails closed), which one follow-up closes for both;
- the helpers `findFightableOffCityVillain`, `fightOffCityVillain` and `awardOffCityVillain` (plus `isOffCityFightBlocked`, split for length) are verbatim moves with two callers each (a fortifier and The Blob), so every Fortify fight is byte-identical. They are a recorded exception to 00.6 Rule 1 (two callers each), authorized by Operator fork 3 to prevent off-City fight drift (the D-24820 lesson); a third off-City location reuses them with no new copy;
- the client shows The Blob as a Fortify chip with his index, wording `is to the left of`, and the existing `fortifiedReason` lock arm;
- the residuals in §Out of Scope (including that Pure Fury cannot target a Villain to the left of the Mastermind) and the replay-compat note; a client bundle older than WP-840 shows the Blob chip but its Fight click is a silent no-op until reload, while the Mastermind lock is correct on old clients (accepted transient residual).

---

## Gate Record

- 2026-10-25 (draft): 01.4 READY — BLOCKED ON WP-831 after PS-1..3 + RS-1..11; 01.7 RISK → fixes 1-5 applied; 00.3 §4 FAIL → fixed → PASS. Those reports covered the superseded parallel-path design.
- 2026-11-15 round 1 (reconciled draft on `a752fc130`, independent subagents):
  - 01.4: READY TO EXECUTE conditional on PS-1 (local-spike bundle missing from Files), PS-2 (commit the reviewed docs; declare the worktree code edits as the execution session's start) and PS-3 (D-24773 locked a conditional fork-1 clause); non-blocking 4-10 (a T21 both-guard case, "present exactly when" wording, `wiki/card-effect-system.md` count, `fortify.logic.ts` comment, `live-verify.json` row + `workindex:liveverify:check`, anchors, the `sim:coverage` STOP clause, the AUTHORITATIVE callout). All applied.
  - 01.7: RISK / HOLD — must-fix 1 (the same bundle), should-fix 2 (stale UIState / Fortify comments) and 3 (00.6 Rule 1 stated as a recorded exception, not relabelled), optional 4 (stale-client residual) and 5 (handler wording "nothing can move him", chip `aria-label`). All applied.
  - 00.3: FAIL — §5 (the bundle), §16.4 (`buildFortifyProjection` and `fightOffCityVillain` over one screen → `appendBesideMastermindFortifiers` and `isOffCityFightBlocked`), §4 (ARCHITECTURE Section 1 and the rules-file Layer Boundary cited). Recommendations applied: Risk Tier MEDIUM, "every input a client or bot sends today", T2 wording, this record.
  - Also moved: T8 into `ambushNarrative.keywordless.test.ts` and T15 into `fortifyFight.test.ts` (both already drive the real reveal / `fightVillain`), so `villainDeck.reveal.test.ts` and `fightVillain.test.ts` leave the Files list.
- 2026-11-15 round 2 (on `c20f5a442`, the same independent subagents): **01.4 READY TO EXECUTE** (PS-1..3 resolved; findings 4-10 present); **01.7 CONFIRM** (all five round-1 findings resolved, nothing new); **00.3 PASS** (every section PASS or N/A; Risk Tier MEDIUM matches in WP and EC).

---

## Lint Gate Self-Review (00.3)

Reconciliation self-review; the independent 01.4 / 01.7 / 00.3 runs are recorded in §Gate Record.

| § | Result |
|---|---|
| §1 | PASS — every required section present; Out of Scope has 8 items |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, Locked Values |
| §3 | PASS — Assumes 1-9 cite file:line on `a752fc130` for every seam used, the rules lines, the card data and the baseline |
| §4 | PASS — `00.2-data-requirements.md` §1.4 / §5, ARCHITECTURE Section 1 (§Package Import Rules, §Layer Boundary (Authoritative)) and other sections, rules §Layer Boundary (Enforcement) / §UIState Projection Integrity, DECISIONS scan list, memory |
| §5 | PASS — every file marked new / modified / regenerated, all paths verified on `a752fc130`; the count is justified |
| §6 | PASS — set / group / card slugs and instance ids match `co2e.json`; `besideMastermindIndex` follows the `cityIndex` / `hqIndex` naming |
| §7 | PASS — every dependency merged; no new package dependency |
| §8 | PASS — engine decides; the client gates on projected data only (D-24574) and imports only the `.` surface; `G` stays JSON; no I/O or randomness; no server change |
| §9 | PASS — pnpm / node commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth change |
| §12 | PASS — node:test, minimal-`G` fixtures, runtime assertions for the count pins (D-24372); hash oracles stand in for the golden test |
| §13 | PASS — exact commands with exit-0 / literal-output expectations, a diff-scope step, 7 revert proofs, an observed board check |
| §14 | PASS — 11 binary criteria tied to T1-T22 |
| §15 / §15.1 | PASS — STATUS (+ follow-ups), DECISIONS, indexes and mindmap in DoD; D-24026 live-verify on `play.legendary-arena.com` names the UIState field |
| §16 | PASS — 00.6 mandated; the off-City helpers are a recorded exception to Rule 1 in D-24773 (Operator fork 3, drift prevention); every new or touched function fits one screen (`isOffCityFightBlocked`, `appendBesideMastermindFortifiers`) |
| §17 | PASS — §1 / §8 / §22-24 / NG-1 cited; conflict line; determinism + replay-compat |
| §18 | N/A — no forbidden-token grep step |
| §19 | N/A at draft — applies to the STATUS entry at close |
| §20 | PASS — N/A with reason (no funding surface) |
| §21 | PASS — N/A with reason; no `apps/server/src` surface |

Scaffold-first (01.0a Step 3): not this class. No previously accepted input is newly rejected: `fightMastermind` refuses only in a state that cannot exist before this packet, a `fightVillain` call with `fortifiedPlace` or a City index behaves exactly as today, and `besideMastermindIndex` was ignored before (a City fight with it now routes to the beside branch; no client or bot sent it).
