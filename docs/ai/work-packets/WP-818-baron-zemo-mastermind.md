# WP-818 — Baron Heinrich Zemo: +9 unless you are a Savior, the Master Strike, and the four Tactics (Game Engine)

**Status:** Draft 2026-10-21 — READY TO EXECUTE (EC-856; **D-24752** reserved (#2939); pre-flight READY, copilot CONFIRM, 00.3 PASS — see §Gate Record).
**Primary Layer:** Game Engine (+ the tactic provenance overlay and the regenerated effect index)
**Dependencies:** none open. Builds on WP-816 / D-24749 (the shared Savior helpers in `board/bystanders.logic.ts`), WP-815 / D-24747 (the additive mastermind fight-cost term), WP-760 / D-24589 (the optional `fightingPlayerId` fight-cost parameter), WP-497 / D-24300 (per-tactic resolvers keyed by ext_id), WP-691 / D-24508 (Xavier's Nemesis, Whispers and Lies), WP-694 / D-24511 (the Monarch's Decree multi-seat discard), WP-684 / D-24501 (`parkSeatChoice`), WP-682 / D-24499 + D-24673 (`gainWoundWithOutcome`, Diving Block wording).
**User-Visible Surface:** `play.legendary-arena.com`
**Lane:** Standard (two-session). It changes the mastermind fight-cost authority (a competitive surface), adds a seat-choice kind and touches the bot.
**Arc:** Cap 75th (ca75) completion arc, audit item 3 (auto-memory `project_cap75_completion_arc`). Coordinates with WP-817 (see Context).

> Baseline: `origin/main` at `bd811363` (the reserve commit #2939, then the Killbot pin #2940). Re-read line anchors and test totals at execution.

---

## Goal

As a player facing Baron Heinrich Zemo, I want him to cost what he prints and to strike and fight back the way his cards say, so that rescuing Bystanders (being a Savior) decides how hard he is, as the tabletop game intends.

Today the engine fights Zemo at 9 for everyone, his Master Strike does nothing, and his four Tactics are inert (`dispatchTacticOnFight` has no branch for them). After this session:

| Card (`ca75/baron-heinrich-zemo`) | Printed | Behavior |
|---|---|---|
| Baron Heinrich Zemo (base) | "Baron Zemo gets +9[icon:attack] unless you are a [keyword:Savior]." | The fight cost is 9 + 9 = **18** for a fighter with fewer than 3 Bystanders in their Victory Pile, **9** for a Savior. The Mastermind tile, the Fight gate, the bot and Pure Fury all read the same number. |
| Baron Heinrich Zemo (base) | "Master Strike: Each player KOs a Bystander from their Victory Pile. Any player who cannot do so gains a Wound." | Every player KOs the first Bystander in their Victory Pile; a player with none gains a Wound. |
| Fallen Idols | "Fight: Each other player that is not a [keyword:Savior] discards a card." | Every other non-Savior player with a card in hand picks one to discard (a multi-seat seat choice, the Monarch's Decree discard). |
| Finding Zemo | "Fight: Reveal the top five cards of the Villain Deck. If you revealed any Bystanders, KO them and each other player gains a Wound. Put the rest back in random order." | As printed. One Wound per other player, however many Bystanders were revealed. |
| Hatred for the Avengers | "Fight: For each of your [team:avengers] Heroes, rescue a Bystander." | One Bystander from the supply per Avengers Hero in your hand or play (the Xavier's Nemesis rule). |
| Prisoners of War | "Fight: Each other player reveals an [team:avengers] Hero or chooses a Bystander from their Victory Pile, and you rescue that Bystander." | Each other player reveals an Avengers Hero from their hand if they have one; otherwise their first Victory-Pile Bystander moves to your Victory Pile. |

**Savior** = at least 3 Bystanders in the player's Victory Pile (rules v23 L1844-1853), counted with the shared WP-816 helpers. That includes a defeated Killbot, which keeps its `bystander-villain-deck-NN` id (rules v23 L2337-2341; confirmed by #2940).

## User-Visible Impact

- Zemo's tile shows a `Fight 18` badge until you have rescued 3 Bystanders. With 3+ the badge disappears, because the projected cost equals the printed 9 (`MastermindTile.vue:122-131` badges only a cost that differs from `display.cost`), and Fight enables at 9 Attack. WP-750 already renders this; no client change.
- His Master Strike costs each player a rescued Bystander (1 VP), or a Wound if they have none.
- Defeating each of his four Tactics does what it prints, and the log says why when it does nothing.
- Fallen Idols opens the existing seat-choice prompt for the other non-Savior players. Its options read "Discard <card>", so the generic "Your choice" heading is enough and no client file changes.

---

## Assumes

1. **Card text** (verbatim, `data/cards/ca75.json` L625-690 on the baseline; the table in §Goal). The base face is `vAttack: "9+"`; the four tactics are `vAttack: 9`, `tactic: true`. Tactic ext ids follow `${setAbbr}-mastermind-${mastermindSlug}-${tacticSlug}` (`mastermind/mastermind.setup.ts:253,279`): `ca75-mastermind-baron-heinrich-zemo-fallen-idols`, `-finding-zemo`, `-hatred-for-the-avengers`, `-prisoners-of-war`. `fightCost = parseCardStatValue(baseCard.vAttack)` (`mastermind.setup.ts:264`), so the base cost is 9.
2. **Rules text** (`docs/legendary-universal-rules-v23.md`): L1844-1853 (Savior = at least 3 Bystanders in your Victory Pile); L772-792 (a Tactic's Fight effect and its rescues resolve "in any order"); L2337-2341 (a defeated Killbot counts as a Bystander in the Victory Pile).
3. **The mastermind fight-cost authority** (`economy/economy.resolve.ts`): `resolveMastermindFightCost(G)` (L331-347) returns `max(0, base + portalBonus + abominationBonus - mastermindReduction)`; base = `G.cardStats[G.mastermind.baseCardId]?.fightCost ?? 0` (L332); the WP-815 term is added before the reduction (L342-346). Its four production callers are `moves/fightMastermind.ts:155`, `simulation/ai.legalMoves.ts:1116` (inside `getLegalMoves`, where `activePlayer = context.currentPlayer`, L411), `ui/uiState.build.ts:986`, and `hero/heroEffects.execute.ts:4748` (`buildPureFuryTargets`, whose `fightingPlayerId?` parameter is at L4725 and is already passed to `resolveFightCost` at L4736). The villain authority `resolveFightCost(G, villainCardId, fightingPlayerId?)` (L78) is the optional-fighter precedent (WP-760); `uiState.build.ts:883` passes `ctx.currentPlayer`.
4. **The UI projection follows the authority.** `UIMastermindState.fightCost` (`ui/uiState.types.ts:738`) is built at `uiState.build.ts:986` and passed through the audience filter (`ui/uiState.filter.ts:595`); the client reads `fightCost ?? display.cost` (`apps/arena-client/src/components/play/MastermindTile.vue:100-106`). No UIState field is added.
5. **Shared Savior helpers** (`board/bystanders.logic.ts`, WP-816): `SAVIOR_BYSTANDER_THRESHOLD = 3` (L26), `countVictoryPileBystanders(victory)` (L54), `findFirstVictoryPileBystander(victory)` (L74). The file imports only `BYSTANDER_EXT_ID` and types, so importing it from `economy/` or `rules/` adds no cycle. PR #2940 (Killbot pin, merged `bd811363`) changed only their tests and doc comments; signatures and behavior are unchanged.
6. **Master Strike dispatch** (`rules/mastermindHandlers.ts`): `mastermindStrikeHandler` (L1189) branches on `gameState.selection.mastermindId` (the qualified `set/slug`, e.g. `'core/magneto'`) through an if / else-if chain (L1206-1232); a mastermind with no branch is bookkeeping only. No `ca75/*` branch exists. Helpers reused: `gainWoundToDiscard` (L653, wraps `gainWoundWithOutcome`) and `describeStrikeWound` (L667); the per-player strike precedent is `resolveCoreLokiStrike` (L829-869); `moveCardFromZone` is already imported (L26).
7. **Tactic dispatch** (`rules/tacticHandlers.ts`): `dispatchTacticOnFight(G, ctx, defeatedTacticId, shuffleContext, events?)` (L1415-1525) is an if-chain on the tactic ext id, called last in `defeatMastermindTacticCore` (`moves/fightMastermind.ts:471`) with the move's shuffle context and events. Precedents in the same file: `resolveXaviersNemesis` (L678-734) with `countXMenHeroesYouHave(G, inPlay, hand)` (L640-662: in play via `cardHasTeamWhenPlayed`, in hand via `offPlayCardTraits(...)?.team`, called with `playedCardIdsStillInPlay(G, zones.inPlay)`); `resolveCrushingShockwave` (L338-414, the auto-resolved hand reveal + per-player `gainWoundWithOutcome` loop); `resolveWhispersAndLies` (L764-820, the solo `neutral` no-op line and the Victory Pile → `G.ko` move); `resolveMonarchsDecree` / `resolveVanishingIllusions` (L1045-1105, `parkSeatChoice(G, events, choice)`). Already imported: `pushLog`, `formatCardRef`, `gainWoundWithOutcome`, `moveCardFromZone`, `cardHasTeamWhenPlayed`, `offPlayCardTraits`, `playedCardIdsStillInPlay`, `parkSeatChoice`, `ShuffleProvider`.
8. **The multi-seat discard** (`moves/seatChoiceTactics.ts`): `buildMonarchsDiscardChoice(G, otherSeats)` (L180-210) addresses each seat with ≥1 hand card, one option per hand card (`{ label, cardId }`), `defaultOptionIndex: 0`; `applyMonarchsDiscard` (L226-247) discards each submitted card through `discardFromHand` in ascending seat order. `seatChoice.resolve.ts` `applySeatChoiceByKind` (L420-466) dispatches by `choice.kind`; `simulation/ai.seatChoice.ts` `chooseByKind` (L90-~125) picks `indexOfLeastValuableCard` for `MONARCHS_DISCARD_KIND` / `ESCAPE_BYSTANDER_DISCARD_KIND` (L109). The client prompt (`apps/arena-client/src/components/play/PendingSeatChoicePrompt.vue` L84-120) shows a per-kind heading and falls back to "Your choice" for any other kind, rendering each option's `label`. `PendingSeatChoice.kind` is a plain `string` (`types.ts:1392`), so a new kind is not a contract change.
9. **Villain Deck shape.** `G.villainDeck.deck` (top = index 0; `villainDeck/villainDeck.reveal.ts:242`), `G.villainDeckCardTypes: Record<CardExtId, RevealedCardType>` (`types.ts:2350`); a Bystander is typed `'bystander'` (`scoring/scoring.logic.ts:49`). On the Killbots scheme the villain-deck Bystanders are typed `'villain'` (D-24324), so they are Killbots, not Bystanders, while in the deck. `ShuffleProvider` = `{ random: { Shuffle } }` (`setup/shuffle.ts`).
10. **Supply rescue idiom.** `G.piles.bystanders[0]` moved to the player's Victory Pile with `moveCardFromZone` (`tacticHandlers.ts:705-721`, D-21501).
11. **Feeds.** The four tactics are `status: "unmarked"` in `data/metadata/effect-implementation-index.json` (generated by `scripts/build-effect-implementation-index.mjs`, which joins `scripts/coverage/tactic-provenance.json`, L61). A provenance row flips a tactic to `executable` with no generator change. No hero / villain ledger covers mastermind strikes or base-face lines, and no `[effect:]` marker is added, so `ledger:villains`, `ledger:heroes`, `mechanics:metadata`, `cards:check`, `sim:runtime-observed` (core-only sweep) and `sim:coverage` (static hero parse) cannot move.
12. **No hashed fixture plays Zemo.** `baron-heinrich-zemo` appears in `packages/**` / `apps/**` only in `packages/registry/src/gauntletLoadouts.generated.ts` (L269-279) and the untracked dashboard copy of the effect index. The hash sentinel is `core/dr-doom`; `PRE_WP080` is synthetic.
13. `pnpm -r build` exits 0 and `pnpm -r --no-bail test` is green on the baseline.

If any item is false, this packet is **BLOCKED**: STOP and reconcile.

## Context (Read First)

- The 2026-10-19 ca75 audit found Zemo fought at 9 and every one of his lines inert (auto-memory `project_cap75_completion_arc`; the side-session note `ca75-audit-2026-10-19.md`).
- **Why the "may use 2 Recruit to rescue" passive is out of scope.** "Whenever you fight a Villain, you may use 2[icon:recruit] to rescue a Bystander" is an opt-in payment at fight time. It needs an engine opt-in on `fightVillain`, an active-player UIState signal and a client control. That is the three-WP shape of the Excessive Violence arc (WP-736 mechanic, WP-739 signal, WP-738 control), and a bot can't opt in, so its live-verify is operator-seated. Bundling it here would cross into `apps/arena-client` and double the file count. It is proposed as its own follow-up; govern-close records its link or a STATUS follow-up line.
- **Why a mastermind-id constant and not a data scan.** Only Zemo prints "+N unless you are a Savior" on a Mastermind (corpus grep). Master Strikes and Tactics are already id-keyed per the 2026-08-04 operator ruling (D-24300), so the cost term keys on the same `G.selection.mastermindId` the strike dispatcher reads. No `G` field is added (unlike WP-815's `cardAbomination`).
- **Why the fighting player is a parameter.** "Unless you are a Savior" is about the fighter. `resolveMastermindFightCost` reads only `G` today; it gains the same optional `fightingPlayerId` that `resolveFightCost` has (WP-760). All four callers pass the current player. When omitted, the term assumes the fighter is not a Savior, so +9 applies; a caller can never get the cheaper cost by forgetting the argument.
- **Why auto-resolve reveals and Bystander picks.** A free reveal always beats losing a Bystander (the Crushing Shockwave rule, D-24312), and every Victory-Pile Bystander is worth the same 1 VP with its rescue ability spent, so "first in pile order" loses nothing (the WP-816 / D-24749 Executioner precedent). Only Fallen Idols' discard is a real choice, and it reuses the multi-seat discard Monarch's Decree already ships.
- **Savior predicate.** Every Savior read in this packet imports `countVictoryPileBystanders` + `SAVIOR_BYSTANDER_THRESHOLD`; every "first Bystander" read imports `findFirstVictoryPileBystander`. No new copy of the two-arm id test is written (coordinated with the Killbot session, #2940, on 2026-10-21). The older private copy in `tacticHandlers.ts` (`isVictoryPileBystander`, L744, used by Whispers and Lies) is left as is (Out of Scope).
- **Intended follow-on effects.** Finding Zemo can empty the Villain Deck, so the end-of-move checks in `game.ts` (~L854-893: `latchFinalTurnIfDeckExhausted`, `applyPileDepletionResourceLoss`) may start the final turn or a villain-deck scheme loss. The strike and Finding Zemo put Bystanders into `G.ko`, which advances Chthon's Bystanders-in-KO transform (`schemeTransform.logic.ts` ~L97-124). Both follow the rules and must not be suppressed.
- **Coordination with WP-817** (drafted, not executed). Both packets add one branch to `seatChoice.resolve.ts` `applySeatChoiceByKind` and `ai.seatChoice.ts` `chooseByKind`, and WP-817 edits `ai.legalMoves.ts` near the villain-fight enumeration while this packet changes one argument at L1116. Neither depends on the other. Whichever executes second rebases and keeps both branches.
- `docs/ai/REFERENCE/00.2-data-requirements.md` §1.3 Mastermind Shape (`slug`, `tactic`, `vAttack`), §5 Ability Text Markup Language (`[keyword:Savior]`, `[team:avengers]`, `[icon:attack]`).
- `docs/ai/ARCHITECTURE.md` §Zone & Pile Structure (zones hold `CardExtId` only), Section 3 Persistence Boundaries (`G` runtime-only), §The Move Validation Contract (moves never throw).
- `docs/ai/DECISIONS.md`: scan D-24300, D-24312, D-24499, D-24501, D-24508, D-24511, D-24589, D-24645, D-24654, D-24661, D-24673, D-24747, D-24749, D-24372 before coding.
- User memory: `reference_interactive_choice_active_player_only` (non-active seats choose only through `pendingSeatChoice`), `reference_heroes_you_have_hand_plus_play`, `reference_engine_tests_never_typechecked`, `reference_bot_legalmoves_moveguard_divergence`.

---

## Non-Negotiable Constraints

**Engine-wide (always apply — do not remove):**
- Output the **full file contents** for every new or modified file. No diffs, no snippets.
- ESM only, Node v22+. Human-style code per `docs/ai/REFERENCE/00.6-code-style.md`: full words, JSDoc on every function, `// why:` comments, no `.reduce()`, no nested ternaries.
- Moves and effects never throw. Zones hold `CardExtId` only. No randomness except `shuffleContext.random.Shuffle`, no I/O, no registry access after setup.

**Session protocol:** if any Assumes item is false or scope is unclear, STOP and reconcile (update this WP and D-24752) before coding. One WP per session.

**Packet-specific:**
- **One cost authority.** The Zemo term lives only in `resolveMastermindFightCost`, added before the reduction and the 0 floor. The four callers change only by passing the fighter.
- **One Savior predicate.** Import the WP-816 helpers. Never write a new two-arm Bystander id test.
- **Id-keyed dispatch.** The strike is a new `else if` branch in `mastermindStrikeHandler`; each tactic is a new `if` branch in `dispatchTacticOnFight`. Other masterminds and tactics behave byte-identically.
- **Self-narrate** every outcome through `pushLog` (hash-excluded `G.messages`, D-24081), including every no-op, with the exact strings in Locked Values. The one exemption is a missing current-player zone in Hatred for the Avengers and Prisoners of War: a defensive silent return (the Xavier's Nemesis precedent, unreachable in a built match).
- **Sorted seats.** Every per-player loop iterates `Object.keys(G.playerZones).sort()`.

## Locked Values

**Fight cost (`economy/economy.resolve.ts`):**
- `const BARON_ZEMO_MASTERMIND_ID = 'ca75/baron-heinrich-zemo';` (module-private) and `export const BARON_ZEMO_NON_SAVIOR_BONUS = 9;`.
- `function mastermindNonSaviorBonus(G: LegendaryGameState, fightingPlayerId?: string): number`:
  1. `G.selection?.mastermindId !== BARON_ZEMO_MASTERMIND_ID` → `0`;
  2. `fightingPlayerId === undefined` → `BARON_ZEMO_NON_SAVIOR_BONUS`;
  3. `zones = G.playerZones?.[fightingPlayerId]`; missing → `BARON_ZEMO_NON_SAVIOR_BONUS`;
  4. `countVictoryPileBystanders(zones.victory) >= SAVIOR_BYSTANDER_THRESHOLD` → `0`, else `BARON_ZEMO_NON_SAVIOR_BONUS` (an `if`, not a nested ternary).
- The Savior read counts only the fighter's Victory Pile. Bystanders Zemo holds (`G.mastermind.attachedBystanders`) are rescued after the fight (`defeatMastermindTacticCore`) and never lower the cost: rules v23 L1849-1851 orders the rescue before a Villain's Savior *ability*, not before the fight cost, which must be known to fight at all (L772-792).
- `resolveMastermindFightCost(G: LegendaryGameState, fightingPlayerId?: string): number` returns `Math.max(0, baseFightCost + portalBonus + abominationBonus + nonSaviorBonus - mastermindReduction)`. JSDoc gains the parameter.
- Callers pass the fighter: `fightMastermind.ts:155` `ctx.currentPlayer`; `ai.legalMoves.ts:1116` `activePlayer`; `uiState.build.ts:986` `ctx.currentPlayer`; `heroEffects.execute.ts:4748` `fightingPlayerId`.

**Master Strike (`rules/mastermindHandlers.ts`):**
- `const MASTERMIND_BARON_ZEMO = 'ca75/baron-heinrich-zemo';` and a new `else if (mastermindId === MASTERMIND_BARON_ZEMO) { resolveBaronZemoStrike(gameState); }` branch.
- `resolveBaronZemoStrike(gameState)`: for each sorted player, `bystander = findFirstVictoryPileBystander(zones.victory)`:
  - found → `moveCardFromZone(zones.victory, gameState.ko, bystander)`, write both arrays back; `` `[Baron Zemo Master Strike] Player ${playerId} KO'd a Bystander from their Victory Pile.` `` (default outcome, the Loki line style);
  - not found → `outcome = gainWoundToDiscard(gameState, playerId)`; `outcome !== 'no-wound'` → `` `[Baron Zemo Master Strike] Player ${playerId} had no Bystander in their Victory Pile and ${describeStrikeWound(outcome)}.` ``; else `` `[Baron Zemo Master Strike] Player ${playerId} had no Bystander in their Victory Pile and the Wound supply is empty — no effect.` ``.

**Tactics (`rules/tacticHandlers.ts`):**
- Constants: `ZEMO_FALLEN_IDOLS_TACTIC_ID = 'ca75-mastermind-baron-heinrich-zemo-fallen-idols'`, `ZEMO_FINDING_ZEMO_TACTIC_ID = '…-finding-zemo'`, `ZEMO_HATRED_FOR_THE_AVENGERS_TACTIC_ID = '…-hatred-for-the-avengers'`, `ZEMO_PRISONERS_OF_WAR_TACTIC_ID = '…-prisoners-of-war'` (full strings in code); `export const FINDING_ZEMO_REVEAL_COUNT = 5;`; `const TEAM_AVENGERS = 'avengers';`.
- Four new `if` branches at the end of `dispatchTacticOnFight`: `resolveFallenIdols(G, events, currentPlayer)`, `resolveFindingZemo(G, currentPlayer, shuffleContext)`, `resolveHatredForTheAvengers(G, currentPlayer)`, `resolvePrisonersOfWar(G, currentPlayer)`.
- `countXMenHeroesYouHave` becomes `countTeamHeroesYouHave(G, inPlay, hand, team: string)` (same body with `team` for `TEAM_X_MEN`); `resolveXaviersNemesis` calls it with `TEAM_X_MEN`. Its log strings and tests are unchanged. The comment that names `countXMenHeroesYouHave` (~L1304) moves to the new name, and the file header's "No `ctx.random.*` (nothing here reveals or shuffles)" (~L21-22) is corrected: Finding Zemo shuffles through the move's `shuffleContext`.
- **Fallen Idols** (`resolveFallenIdols`): `otherSeats` = sorted seats ≠ current.
  - none → `` `Fight effect: there is no other player to discard a card (Fallen Idols).` `` `'neutral'`; return.
  - each other seat with `countVictoryPileBystanders(victory) >= SAVIOR_BYSTANDER_THRESHOLD` → `` `Fight effect: Player ${seat} is a Savior and discards nothing (Fallen Idols).` `` `'neutral'`; each other non-Savior seat with an empty hand → `` `Fight effect: Player ${seat} has no card to discard (Fallen Idols).` `` `'neutral'`; both lines in sorted seat order. The rest are `nonSaviorSeats`.
  - The normal fight and card-play paths are behind the open-seat-choice guard (`fightMastermind.ts` ~L227, `coreMoves.impl.ts` ~L233); a pending free-defeat resolution (`defeatChoice.resolve.ts` ~L224) has the same exposure as the D-24511 Monarch's Decree and Vanishing Illusions precedent. Add no extra guard.
  - `choice = buildFallenIdolsDiscardChoice(G, nonSaviorSeats)`; `undefined` → `` `Fight effect: no other player who is not a Savior has a card to discard (Fallen Idols).` `` `'neutral'`; else `parkSeatChoice(G, events, choice)` and `` `Fight effect: each other player who is not a Savior must discard a card (Fallen Idols).` `` `'neutral'`.
- **Finding Zemo** (`resolveFindingZemo`):
  - `revealCount = Math.min(FINDING_ZEMO_REVEAL_COUNT, G.villainDeck.deck.length)`; `0` → `` `Fight effect: the Villain Deck is empty, so nothing is revealed (Finding Zemo).` `` `'blocked'`; return (no Shuffle call).
  - `revealed = deck.slice(0, revealCount)`; Bystanders = revealed ids with `G.villainDeckCardTypes[id] === 'bystander'`, each pushed to `G.ko` in revealed order; `rest` = the others in revealed order.
  - `rest.length >= 2` → `rest = shuffleContext.random.Shuffle([...rest])` (else no Shuffle call); `G.villainDeck.deck = [...rest, ...deck.slice(revealCount)]`.
  - no Bystanders → `` `Fight effect: revealed the top ${revealCount} card(s) of the Villain Deck — no Bystanders (Finding Zemo).` `` `'blocked'`; return.
  - else `` `Fight effect: revealed the top ${revealCount} card(s) of the Villain Deck and KO'd ${count} Bystander(s) (Finding Zemo).` `` `'applied'`; then `dealFindingZemoWounds(G, currentPlayer)` (its own JSDoc'd function, so the resolver stays on one screen): no other seat → `` `Fight effect: there is no other player to gain a Wound (Finding Zemo).` `` `'neutral'`; else per sorted other seat, `gainWoundWithOutcome(G, seat)`: `'gained'` → `` `Fight effect: Player ${seat} gained a Wound (Finding Zemo).` `` `'applied'`; `'diving-block-pending'` → `` `Fight effect: Player ${seat} would gain a Wound — Diving Block can prevent it (Finding Zemo).` `` `'neutral'`; `'no-wound'` → `` `Fight effect: Player ${seat} gained no Wound — the Wound supply is empty (Finding Zemo).` `` `'blocked'`.
- **Hatred for the Avengers** (`resolveHatredForTheAvengers`): `resolveXaviersNemesis`'s structure with `countTeamHeroesYouHave(G, playedCardIdsStillInPlay(G, zones.inPlay), zones.hand, TEAM_AVENGERS)`. Lines: `` `Fight effect: Player ${currentPlayer} has no Avengers Hero in hand or play, so no Bystander is rescued (Hatred for the Avengers).` `` `'blocked'`; `` `Fight effect: Player ${currentPlayer} has Avengers Heroes but the Bystander supply is empty, so no Bystander is rescued (Hatred for the Avengers).` `` `'blocked'`; `` `Fight effect: Player ${currentPlayer} rescued ${n} Bystander(s) — one per Avengers Hero in hand or play (Hatred for the Avengers).` `` `'applied'`.
- **Prisoners of War** (`resolvePrisonersOfWar`): current zones missing → return. No other seat → `` `Fight effect: there is no other player to reveal an Avengers Hero or give up a Bystander (Prisoners of War).` `` `'neutral'`. Per sorted other seat:
  - the first hand card with `offPlayCardTraits(G, id)?.team === TEAM_AVENGERS` → `` `Fight effect: Player ${seat} revealed ${formatCardRef(G.cardDisplayData, id)} — no Bystander (Prisoners of War).` `` `'neutral'`;
  - else `bystander = findFirstVictoryPileBystander(seatZones.victory)`; found → `moveCardFromZone(seatZones.victory, currentZones.victory, bystander)`, write both back; `` `Fight effect: Player ${seat} had no Avengers Hero, so Player ${currentPlayer} rescued a Bystander from their Victory Pile (Prisoners of War).` `` `'applied'`;
  - else `` `Fight effect: Player ${seat} had no Avengers Hero and no Bystander in their Victory Pile (Prisoners of War).` `` `'blocked'`.

**Seat choice (`moves/seatChoiceTactics.ts`, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts`):**
- `export const FALLEN_IDOLS_DISCARD_KIND = 'fallen-idols-discard';`
- `export function buildFallenIdolsDiscardChoice(G, seats): PendingSeatChoice | undefined` — `buildMonarchsDiscardChoice`'s loop with option `label` `` `Discard ${resolveCardName(G.cardDisplayData, cardId)}` ``, `kind: FALLEN_IDOLS_DISCARD_KIND`, `defaultOptionIndex: 0`.
- `export function applyFallenIdolsDiscard(G, choice): void` — `applyMonarchsDiscard`'s body; line `` `Player ${seat} discarded ${resolveCardName(G.cardDisplayData, cardId)} (Fallen Idols).` `` `'applied'`.
- `applySeatChoiceByKind` gains `if (choice.kind === FALLEN_IDOLS_DISCARD_KIND) { applyFallenIdolsDiscard(G, choice); return; }` beside the Monarch's branch. `chooseByKind`'s least-valuable branch also matches `FALLEN_IDOLS_DISCARD_KIND`.

**Provenance (`scripts/coverage/tactic-provenance.json`):** four rows, `status: "executable"`, handler `packages/game-engine/src/rules/tacticHandlers.ts#resolve<Name>`, `wp: "WP-818"`, `decision: "D-24752"`.

---

## Scope (In)

- **A)** `economy/economy.resolve.ts` + test: the Zemo term and the optional fighter parameter.
- **B)** The four callers pass the fighter (`fightMastermind.ts`, `ai.legalMoves.ts`, `uiState.build.ts`, `heroEffects.execute.ts`); integration tests in `fightMastermind.test.ts`, `ai.legalMoves.test.ts`, `uiState.build.test.ts` (additions only).
- **C)** `rules/mastermindHandlers.ts` + test: the Master Strike.
- **D)** `rules/tacticHandlers.ts` + test: the four resolvers, their dispatch branches, `countTeamHeroesYouHave`.
- **E)** `moves/seatChoiceTactics.ts` + test, `moves/seatChoice.resolve.ts`, `simulation/ai.seatChoice.ts` + test: the Fallen Idols discard kind.
- **F)** `tactic-provenance.json` and the regenerated `effect-implementation-index.json`.

## Out of Scope

- **The "whenever you fight a Villain, you may use 2 Recruit to rescue a Bystander" passive** (Context). Its own follow-up: engine opt-in + UIState signal + client control.
- **Arnim Zola** (strike + 4 tactics; Cap 75th item 4).
- **Killbot counting** — already correct through the shared helpers; PR #2940 pins it.
- **The private `isVictoryPileBystander` copy in `tacticHandlers.ts`** (Whispers and Lies) and `scoring/scoring.logic.ts`'s scoring predicate. Not touched; consolidating the Whispers copy onto the shared helper is a separate hygiene change.
- **"When you rescue this" Bystander abilities.** The engine models Bystanders as plain VP cards; Hatred / Prisoners rescue exactly as Xavier's Nemesis does.
- **Client changes.** WP-750 renders the cost; the generic seat-choice prompt renders Fallen Idols.
- **`data/metadata/mastermind-pattern-assignments.json`** (`strike-wound`, read only by the registry viewer).
- **PAR regeneration** (see Vision Alignment).

## Files Expected to Change

**Engine (`packages/game-engine/src/`)**
- `economy/economy.resolve.ts`, `economy/economy.resolve.test.ts` — modified
- `moves/fightMastermind.ts` — modified (one argument); `moves/fightMastermind.test.ts` — modified (additions only)
- `simulation/ai.legalMoves.ts` — modified (one argument); `simulation/ai.legalMoves.test.ts` — modified (additions only)
- `ui/uiState.build.ts` — modified (one argument); `ui/uiState.build.test.ts` — modified (additions only)
- `hero/heroEffects.execute.ts` — modified (one argument); `hero/pureFury.logic.test.ts` — modified (additions only)
- `rules/mastermindHandlers.ts`, `rules/mastermindHandlers.test.ts` — modified
- `rules/tacticHandlers.ts`, `rules/tacticHandlers.test.ts` — modified
- `moves/electromagneticBubbleChoice.resolve.test.ts` — modified (comment only: ~L145 names `countXMenHeroesYouHave`)
- `moves/seatChoiceTactics.ts`, `moves/seatChoiceTactics.test.ts` — modified
- `moves/seatChoice.resolve.ts` — modified (one dispatch branch)
- `simulation/ai.seatChoice.ts`, `simulation/ai.seatChoice.test.ts` — modified

**Scripts and data**
- `scripts/coverage/tactic-provenance.json` — modified
- `data/metadata/effect-implementation-index.json` — regenerated

**Governance:** `docs/ai/NUMBER-LEDGER.md` (the D-24752 reservation line, corrected at drafting: the pay-Recruit passive is deferred), `docs/ai/DECISIONS.md` (D-24752), `docs/ai/STATUS.md`, `docs/ai/work-packets/WORK_INDEX.md`, `docs/ai/execution-checklists/EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`

That is 20 engine files (10 tests, one of them a comment-only rename; 4 one-argument caller edits) plus 2 data files. It is above the ~10 guideline because one Mastermind spans the cost authority, its callers, the strike, the tactic dispatcher and a seat-choice kind. Splitting would ship a Mastermind that is half-faithful in the same match.

## Contract

- The Locked Values above: `BARON_ZEMO_NON_SAVIOR_BONUS`, the optional `fightingPlayerId` on `resolveMastermindFightCost`, the strike and four tactic resolvers with their exact strings, `FINDING_ZEMO_REVEAL_COUNT`, `countTeamHeroesYouHave`, `FALLEN_IDOLS_DISCARD_KIND` with its builder and applier.
- `resolveMastermindFightCost`'s existing callers that pass no fighter keep compiling (the parameter is optional). No `G` field, UIState field or contract file changes.

## Test Contract

Minimal `G` fixtures in each file's existing style, `messages: []` so `pushLog` records. "Bystander ids" are `pile-bystander` and `bystander-villain-deck-NN`. Zemo fixtures set `selection.mastermindId: 'ca75/baron-heinrich-zemo'` and `G.cardStats[G.mastermind.baseCardId] = { fightCost: 9, … }` with `baseCardId: 'ca75-mastermind-baron-heinrich-zemo-baron-heinrich-zemo'`. Tactic cases call `dispatchTacticOnFight` with the real tactic ext id, a `{ currentPlayer: '0' }` ctx and `makeMockCtx()` as the shuffle context (it reverses arrays). Each file groups its cases under one `describe('WP-818 …')`.

| # | File | Input | Expected | Invariant / must NOT |
|---|---|---|---|---|
| T1 | economy.resolve | Zemo; player `0` Victory Pile 2 Bystanders + a villain | `resolveMastermindFightCost(G, '0')` = 18 | |
| T2 | economy.resolve | same, 3 Bystanders (`pile-bystander` ×2 + `bystander-villain-deck-01`) | 9 | `>=` threshold |
| T3 | economy.resolve | Zemo, fighter omitted; fighter `'9'` (no zones) | 18; 18 | never the cheaper cost by default |
| T3b | economy.resolve | Zemo holds `G.mastermind.attachedBystanders = ['pile-bystander']`; fighter `0` has 2 Victory-Pile Bystanders | 18 | held Bystanders never count |
| T4 | economy.resolve | `selection.mastermindId: 'core/red-skull'`, 0 Bystanders, base 7; and a partial `G` with no `selection` | 7 with and without a fighter | other masterminds unchanged |
| T5 | economy.resolve | Zemo with a Storm −2 Mastermind reduction this turn; non-Savior; then Savior | 16; 7 | term before the reduction |
| T6 | fightMastermind | Zemo with a tactics deck of one dummy tactic id (`test-tactic-00`, so no Zemo Fight effect fires); current `0` non-Savior with 17 attack; then 18 attack; then a Savior with 9 attack | refused (no `G` change); the tactic defeated; the tactic defeated | asserts only the cost gate; the move never throws |
| T7 | uiState.build | Zemo; current `0` with 2 Bystanders; then 3 | `mastermind.fightCost` 18; 9 | projection = resolver |
| T8 | ai.legalMoves | Zemo, main stage, tactics left; current non-Savior with 9 attack; then 18 | no `fightMastermind`; `fightMastermind` present | bot = move guard |
| T8b | pureFury.logic | `buildPureFuryTargets(G, '0')` with Zemo (Mastermind free-defeat eligible) and 10 S.H.I.E.L.D. Heroes in the KO pile (the file's existing fixture style); player `0` a Savior; then a non-Savior | the Mastermind target present (9 < 10); absent (18 ≥ 10) | the Pure Fury caller passes the fighter |
| T9 | mastermindHandlers | Zemo strike; Victory Piles `0: [v, 'bystander-villain-deck-02', 'pile-bystander']`, `1: ['pile-bystander']`, `2: [v2]`; wounds pile 3 | `0` loses `bystander-villain-deck-02`; `1` loses `pile-bystander`; `G.ko` ends with those two in that order; `2`'s discard gains one Wound; three strike lines exactly as locked, in seat order | first in pile order; one per player |
| T10 | mastermindHandlers | T9 with an empty wound pile | `2` gains nothing; `… and the Wound supply is empty — no effect.` | never throws |
| T11 | mastermindHandlers | strike with `selection.mastermindId: 'core/loki'` and T9's piles | no Bystander moves; no `[Baron Zemo Master Strike]` line | dispatch isolation |
| T12 | tacticHandlers | Fallen Idols; seats `0` (current), `1` non-Savior hand `[a, b]`, `2` Savior hand `[c]`, `3` non-Savior empty hand | `G.pendingSeatChoice` = `{ kind: 'fallen-idols-discard', addressedSeats: ['1'], seatPrompts: { '1': { options: [{ label: 'Discard <a>', cardId: a }, { label: 'Discard <b>', cardId: b }] } }, submissions: {}, defaultOptionIndex: 0 }`; Savior line for `2`, then the no-card line for `3`, then the park line | Saviors and empty hands not addressed, each narrated |
| T13 | tacticHandlers | Fallen Idols solo; and with every other seat a Savior | no `pendingSeatChoice`; the solo line; the "no other player who is not a Savior" line after the Savior lines | |
| T14 | seatChoiceTactics | `applyFallenIdolsDiscard` with seats `1` and `3` submitted | each chosen card leaves the hand for the discard, ascending seat order; `(Fallen Idols)` lines | through `discardFromHand` |
| T15 | ai.seatChoice | a `fallen-idols-discard` choice whose options include a Wound and a cost-5 Hero | the Wound's index (`indexOfLeastValuableCard`) | same pick as Monarch's discard |
| T16 | tacticHandlers | Finding Zemo; deck `[v1, b1, v2, b2, s1, v3]` (`b*` typed `bystander`, `s1` `scheme-twist`, `v*` `villain`); seats 0-2; wounds 5 | `G.ko` gains `[b1, b2]`; deck = `[s1, v2, v1, v3]`; seats `1` and `2` gain one Wound each, `0` none; the KO line then two Wound lines | rest back on top, reshuffled |
| T17 | tacticHandlers | Finding Zemo with no Bystander in the top 5 (deck of 7 villains) | nothing KO'd; top 5 reversed, last 2 untouched; no Wounds; the "no Bystanders" line `blocked` | the rest is still reshuffled |
| T18 | tacticHandlers | Finding Zemo with a 1-card deck `[b1]`; then an empty deck (count the Shuffle calls) | `b1` KO'd, deck empty, Wounds dealt, Shuffle not called; empty deck → the empty line, Shuffle not called | |
| T19 | tacticHandlers | Finding Zemo on a Killbots-style deck where `bystander-villain-deck-01` is typed `villain` | not KO'd | Killbots are not Bystanders in the deck |
| T20 | tacticHandlers | Hatred; hand `[avengersHero]`, in play `[avengersHero2, xMenHero]`; supply 5 | Victory Pile +2 supply Bystanders; the `applied` line with `2` | hand + play |
| T21 | tacticHandlers | Hatred with no Avengers Hero; and with Avengers Heroes and an empty supply | the two `blocked` lines; nothing moves | |
| T22 | tacticHandlers | the existing Xavier's Nemesis tests | unchanged and passing | refactor oracle |
| T23 | tacticHandlers | Prisoners; seats `0` (current), `1` hand holds an Avengers Hero, `2` no Avengers, Victory Pile `[v, 'bystander-villain-deck-04', 'pile-bystander']`, `3` no Avengers, no Bystander | `1` unchanged (reveal line); `bystander-villain-deck-04` moves to the end of `0`'s Victory Pile; `3` `blocked` line | a pick, not a choice |
| T24 | tacticHandlers | Prisoners where seat `2`'s only Avengers Hero is in its discard; and solo | `2` gives up its Bystander; the solo `neutral` line | hand-only reveal |

## Vision Alignment

**Vision clauses touched:** §1 (faithful rules), §8 / §22 (determinism), §23 / §24 (competitive integrity), NG-1.

**Competitive surface:** Baron Heinrich Zemo is a gauntlet Mastermind (`packages/registry/src/gauntletLoadouts.generated.ts` L269-279). He now costs 18 until a player is a Savior, and his strike and tactics bite, so those legs get harder. No committed `data/par` artifact references him, so nothing is re-pinned here; future PAR runs pick up the change, the fidelity shift every card WP carries.

**Conflict assertion:** No conflict: this WP preserves all touched clauses; none of NG-1..NG-8 is crossed (engine-only card fidelity, no paid or persuasive surface).

**Determinism preservation:**
- No new `G` field. The cost term and every resolver read only `G`; seats are sorted; the only randomness is Finding Zemo's `shuffleContext.random.Shuffle`, called only when 2+ non-Bystander cards are put back.
- Narration goes to hash-excluded `G.messages` (D-24081).
- No hashed fixture plays Zemo (Assumes 12), so `finalStateHash` and `PRE_WP080_HASH` are expected unchanged. If either moves, STOP and explain before any re-pin.
- **Replay-compat:** a stored pre-WP-818 match that fought Zemo, hit his strike or defeated a tactic replays differently on the new code. No Zemo match is a hashed fixture. The weekly full-mastermind sweep (`.github/workflows/sweep-weekly.yml` ~L115) is not a hash gate, but its Zemo results shift. Recorded in D-24752.

## Funding Surface Gate

§20 **N/A**: engine only. No funding UI, copy or channel.

## API Catalog

§21 **N/A**: no HTTP endpoint and no `apps/server/src/**` library surface. D-11804 does not apply.

---

## Acceptance Criteria

1. **Cost.** T1-T5 and T3b pass.
2. **Consumers agree.** T6-T8 and T8b pass; the four callers change only by the passed fighter.
3. **Strike.** T9-T11 pass.
4. **Fallen Idols.** T12-T15 pass.
5. **Finding Zemo.** T16-T19 pass.
6. **Hatred / Xavier.** T20-T22 pass.
7. **Prisoners of War.** T23-T24 pass.
8. **Feeds.** After `pnpm effect-index`, the four Zemo tactics read `executable` with WP-818 / D-24752 provenance and no other row changes (the derived `summary.byStatus` counts excepted); `effect-index:check`, `ledger:villains:check`, `ledger:heroes:check`, `mechanics:metadata:check`, `cards:check`, `sim:runtime-observed:check`, `sim:coverage --check` exit 0, and only the effect index needed regeneration.
9. **Gates.** `pnpm -r build` exits 0; `pnpm -r --no-bail test` 0 fail.
10. **Hashes.** `finalStateHash` and `PRE_WP080_HASH` byte-unchanged.

## Verification Steps

1. `pnpm -r build` → exit 0.
2. `pnpm --filter @legendary-arena/game-engine test` → all pass; record the before / after totals. The hash oracles (`game.test.ts` `finalStateHash`, `replay/replay.execute.test.ts` `PRE_WP080_HASH`) pass unchanged.
3. `pnpm effect-index` → `git diff --stat -- data/metadata/` shows only `effect-implementation-index.json`, and its diff touches only the four Zemo tactic rows (and any summary counts the generator derives from them).
4. `pnpm effect-index:check && pnpm ledger:villains:check && pnpm ledger:heroes:check && pnpm mechanics:metadata:check && pnpm cards:check && pnpm sim:runtime-observed:check && pnpm sim:coverage --check` → each exits 0. If any but `effect-index:check` flags, STOP: Assumes 11 is false.
5. `pnpm -r --no-bail test` → 0 fail.
6. `git diff --name-only` ⊆ Files Expected to Change. Revert any `lagn-v1.json` CRLF churn.
7. Revert proofs, one at a time, each must fail at least one T-case: drop the non-Savior term; make it read `>` instead of `>=`; make the strike skip the Wound fallback; make Fallen Idols address Saviors; skip Finding Zemo's reshuffle.

## Definition of Done

- [ ] Every Acceptance Criterion passes, the diff is allowlist-only, and the five revert proofs were observed.
- [ ] D-24752 appended to `DECISIONS.md` as Active. `docs/ai/STATUS.md` updated, including the passive follow-up (its link, or a follow-up line).
- [ ] WORK_INDEX `[x]`, EC_INDEX Done, mindmap `✅`; `pnpm roadmap:counts:write`, then `roadmap:counts:check` and `ledger:numbers:check` exit 0.
- [ ] Two-commit topology: `EC-856:` then `SPEC:`.
- [ ] **D-24026 live-verify** (post-merge, REQUIRED). In a live `ca75/baron-heinrich-zemo` match on `play.legendary-arena.com`, with the deployed gitSha checked, staged through the operator setter pane (WP-806/807) or `/api/match/autoplay` setupData:
  - with fewer than 3 rescued Bystanders the Mastermind tile shows a `Fight 18` badge and Fight stays disabled at 9-17 Attack; with 3+ the badge disappears (projected cost = printed 9) and Fight enables at 9 Attack;
  - a Master Strike KOs a Victory-Pile Bystander from each player who has one and wounds each player who has none;
  - each of the four Tactics, when defeated, logs its locked line (Fallen Idols opens the discard prompt for a non-Savior other seat in a 2+-player match).

  Record this as operator-pending until seen.

## Reserved Decision (lands at execution)

**D-24752 — baron-zemo-mastermind.** It locks:
- "+9 unless you are a Savior" as a mastermind-id-keyed term in `resolveMastermindFightCost`, read for the fighter through the shared WP-816 Savior helpers (Killbots included, rules v23 L2341), added before the reduction and the 0 floor;
- the optional `fightingPlayerId` on `resolveMastermindFightCost` (the WP-760 precedent) and the fail-expensive default: an omitted or unknown fighter is not a Savior;
- the strike: every player, first Victory-Pile Bystander in pile order to `G.ko`, else a Wound through the Diving Block chokepoint;
- Fallen Idols as a `fallen-idols-discard` multi-seat seat choice addressed to the other non-Savior seats with a card in hand (the D-24511 Monarch's discard, "Discard <card>" labels so no client heading is needed);
- Finding Zemo: top 5 (fewer if the deck is short); only `villainDeckCardTypes === 'bystander'` counts (Killbots in the deck are villains, D-24324); one Wound per other player however many Bystanders; the rest reshuffled with the move's `random.Shuffle` only when 2+ cards go back;
- Hatred for the Avengers on the Xavier's Nemesis rule (hand + still in play, D-24645 / D-24692) through the generalized `countTeamHeroesYouHave`;
- Prisoners of War auto-resolved: a hand reveal when possible, else the other player's first Victory-Pile Bystander moves to the fighter;
- the passive "may use 2 Recruit to rescue a Bystander" deferred to its own opt-in arc (the Excessive Violence shape);
- the Savior read counts only the fighter's Victory Pile; Bystanders Zemo holds are rescued after the fight and never lower the cost;
- the intended follow-on effects: Finding Zemo emptying the Villain Deck feeds the end-of-move final-turn / pile-depletion checks, and Bystanders KO'd by the strike or Finding Zemo count toward Chthon's KO-pile transform;
- the cost projection reads the active player (`ctx.currentPlayer`), so an off-turn viewer sees the active player's 18 or 9 (the WP-760 villain precedent);
- the replay-compat note, including that the weekly full-mastermind sweep (`.github/workflows/sweep-weekly.yml` ~L115, not a hash gate) shifts for Zemo.

---

## Gate Record

**Pre-flight (01.4), round 1 (independent subagent): NOT READY → READY TO EXECUTE after one wording fix, applied (the reviewer ruled no re-run is needed).**
- Verified against live code and data: all 13 Assumes items; exactly four production callers of `resolveMastermindFightCost` (none in `apps/server`, `preplan` or other `simulation/` files); `G.selection?.` partial-G safety; production `set/slug` mastermind ids; the strike / tactic dispatch, helpers and the `parkSeatChoice` signature; the seat-choice build, filter and client prompt pass any kind and its labels (no client change); villain-deck top = `deck[0]`; `makeMockCtx` reverses; T5 / T9 / T16 / T23 arithmetic and orders; no hashed fixture or PAR artifact; `pnpm effect-index` changes the four rows plus `summary.byStatus`. The six touched test files ran 283 / 0 on the baseline.
- **PS-1 (fixed):** a Savior sees no `Fight 9` badge (`MastermindTile.vue:122-131` badges only a cost that differs from the printed 9). User-Visible Impact and the live-verify bullet now say the badge disappears and Fight enables at 9.
- **RS-1 (fixed):** the Pure Fury caller had no T-case → T8b in `hero/pureFury.logic.test.ts` (allowlisted).
- **RS-2 (fixed):** #2940 merged; baseline `bd811363`, helper anchors L54 / L74.
- **RS-3 (fixed):** the D-24752 ledger line no longer claims the pay-Recruit passive; `NUMBER-LEDGER.md` is in the governance list.
- **RS-4 (fixed):** the ~L1304 comment and the file-header randomness line are updated (Locked Values, EC).
- **RS-5 (fixed):** T6 uses a dummy tactic id, so it asserts only the cost gate.
- **RS-6 (fixed):** the weekly full-mastermind sweep shift is in the replay-compat note and D-24752.
- **RS-7 (fixed):** the missing-current-zone silent return in Hatred / Prisoners is an explicit exemption.
- **RS-8 (fixed):** D-24752 records that the projection reads the active player.

**Copilot (01.7), round 1 (independent subagent): RISK (HOLD), six scope-neutral fixes, all applied; pre-flight stands.** No hidden cost consumer (the operator view goes through `buildUIState`; EV reuses `requiredFightCost`; PAR / sim call the real move; coach, preplan and the server never read `fightCost`); badge logic as claimed; free defeats of Zemo still fire tactics through `defeatMastermindTacticCore`; Finding Zemo's deck handling, the Victory-Pile transfer, the refactor's single call site, imports and the seat-choice kind all clean.
1. Mode 30: the gate verdicts were not recorded → this record (written as the review ran) and the Status line.
2. Modes 18 / 26: when Savior is read vs. the Bystanders Zemo holds → Locked Values sentence, T3b, a D-24752 bullet, an EC smell.
3. Mode 18: Finding Zemo can exhaust the Villain Deck (final-turn / pile-depletion checks) and the strike / Finding Zemo feed Chthon's KO-pile transform → a Context line and a D-24752 bullet (intended, not suppressed).
4. Modes 22 / 26: a non-Savior with an empty hand was skipped silently → a locked `has no card to discard` line, in T12.
5. Mode 27: the EC abbreviated two strike strings → written out in full.
6. Modes 15 / 12: `electromagneticBubbleChoice.resolve.test.ts` ~L145 names the renamed function → allowlisted as a comment-only edit.
7. Mode 29 (PASS + sentence): the seat-choice slot is empty because callers are behind the block-all guard → stated; no extra guard.

**Copilot (01.7), round 2 (same independent subagent): PASS → CONFIRM after two wording fixes, applied (no round 3, no pre-flight re-run).** All seven round-1 findings confirmed fixed; WP ↔ EC agree on locked values, files, T1-T24 + T3b + T8b and the revert proofs; no new failure mode; EC 72 lines.
- **N1 (fixed):** the Status line now carries the gate verdicts.
- **N2 (fixed):** the seat-choice sentence names the guarded paths (fight, card play) and the free-defeat resolution that shares the D-24511 precedent's exposure.

**Lint (00.3) (independent subagent): FAIL → PASS after one EC string fix, applied** (see §Lint Gate Self-Review).

**Final gate state:** pre-flight READY TO EXECUTE · copilot CONFIRM · 00.3 PASS.

## Lint Gate Self-Review (00.3)

From the independent 00.3 run. One EC FAIL (a restated string) was fixed in place; the table shows the post-fix state.

| § | Result |
|---|---|
| §1 | PASS — all required sections present; Out of Scope has 8 items |
| §2 | PASS — engine-wide block, session protocol, packet-specific constraints, a separate Locked Values section |
| §3 | PASS — 13 Assumes items cover every file, export, anchor, data and rules line, and the baseline, with a BLOCKED clause |
| §4 | PASS — 00.2 §1.3 / §5, ARCHITECTURE sections, a 14-entry DECISIONS scan list and memory refs cited |
| §5 | PASS — 20 engine + 2 data files + governance, justified; every referenced file listed, including the comment-only test |
| §6 | PASS — ext ids match `mastermind.setup.ts:253,279`; `set/slug` mastermind id; canonical names (00.2 `mastermindSlug`) |
| §7 | PASS — no new dependencies |
| §8 | PASS — engine, scripts and data only; no `G` / UIState field; randomness only via `shuffleContext.random.Shuffle`; `rules/` stays boardgame.io-free |
| §9 | PASS — pnpm / node / git commands only |
| §10 | N/A — no environment variables |
| §11 | N/A — no auth surface |
| §12 | PASS — node:test, reversing `makeMockCtx`, pure-`G` fixtures, no boardgame.io / network / DB; hash oracles stand in for the golden test |
| §13 | PASS — exact commands with exit-0 expectations, a diff-scope step, five revert proofs; the hash oracles named in step 2 (A6) |
| §14 | PASS — 10 binary criteria tied to T-cases or named checks |
| §15 / §15.1 | PASS — STATUS, DECISIONS, indexes in DoD; D-24026 live-verify on `play.legendary-arena.com` with gitSha check and staging path |
| §16 | PASS — style rules mandated; `resolveFindingZemo` splits its Wound loop into `dealFindingZemoWounds` (A3) |
| §17 | PASS — §1 / §8 / §22 / §23 / §24 and NG-1 cited; conflict line; determinism + replay-compat (gauntlet, weekly sweep) |
| §18 | N/A — no grep verification step |
| §19 | N/A at draft — applies to the STATUS entry at close |
| §20 | PASS — N/A with reason (engine only) |
| §21 | PASS — N/A with reason; no `apps/server/src` surface |

EC-856 vs EC-TEMPLATE: FAIL → PASS after one fix — the Fallen Idols apply line was restated as `${name}`; it now copies the WP string verbatim. All seven sections in template order; under the 100-line ceiling; a scope-lock line added to Before Starting (A2).

Advisories applied: A2 (EC scope lock + green baseline), A3 (`dealFindingZemoWounds`), A6 (hash oracles named), A7 (AC 8 excepts derived summary counts), A8 (status and records filled). Not applied: A1 (the EC points to the WP for the Finding Zemo / Hatred / Prisoners strings, the EC-854 house practice), A4 (a third per-seat options loop, acceptable under duplicate-first; consolidation is a later hygiene change), A5 (Scope (In) A-F describes each file).

**Verdict:** PASS.
