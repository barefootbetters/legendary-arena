/**
 * Fight mastermind move for the Legendary Arena game engine.
 *
 * fightMastermind defeats the top tactic card from the mastermind's
 * tactics deck when the player has sufficient attack points. When all
 * tactics are defeated, the victory counter is set. Follows the
 * three-step validation contract: validate args, check stage gate,
 * mutate G.
 *
 * This is a non-core move that gates internally (same pattern as
 * fightVillain and recruitHero from WP-016). It is NOT added to
 * CoreMoveName, CORE_MOVE_NAMES, or MOVE_ALLOWED_STAGES.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { getSpendableAttack, spendFightCost } from '../economy/economy.logic.js';
// why: WP-539 / D-24348 — centralized mastermind fight requirement (base fightCost +
// the Portals Dark-Portal mastermind bonus), so combat / UI / AI never disagree.
import { resolveMastermindFightCost } from '../economy/economy.resolve.js';
import {
  defeatTopTactic,
  areAllTacticsDefeated,
  isFinalBlowAvailable,
  setFinalBlowPending,
} from '../mastermind/mastermind.logic.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { composeMastermindDefeatedNarrative } from '../events/notableEvents.compose.js';
import { dispatchTacticOnFight } from '../rules/tacticHandlers.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { hasPendingKoHeroChoice } from './koHeroChoice.resolve.js';
import { hasPendingScryKoChoice } from './scryKoChoice.resolve.js';
import { hasPendingMelterKoChoice } from './melterKoChoice.resolve.js';
import { hasPendingDiscardChoice } from './discardChoice.resolve.js';
import { hasPendingPutCardsOnDeckChoice } from './putCardsOnDeckChoice.resolve.js';
import { hasPendingKoDiscardChoice } from './koDiscardChoice.resolve.js';
import { hasPendingReorderChoice } from './reorderChoice.resolve.js';
import { hasPendingDefeatChoice } from './defeatChoice.resolve.js';
import { hasPendingOptionalKoReward } from './optionalKoReward.resolve.js';
import { hasPendingSmashDiscard } from './smashDiscard.resolve.js';
import { hasPendingDoOver } from './doOver.resolve.js';
import { hasPendingPlayVillainTopChoice } from './playVillainTop.resolve.js';
import { hasPendingVictoryPileCardPick } from './resolveVictoryPileCardPick.js';
import { hasPendingDrawOrEmpowered } from './drawOrEmpowered.resolve.js';
import { hasPendingCountScaledChoice } from './countScaledChoice.resolve.js';
import { hasPendingUndercoverChoice } from './undercover.resolve.js';
import { hasPendingReturnZeroCostDiscard } from './resolveReturnZeroCostDiscard.js';
import { hasPendingDiscardToPlay } from './resolveDiscardToPlay.js';
import { hasPendingReturnOnDiscard } from './resolveReturnOnDiscard.js';
import { hasPendingGiveHqHeroChoice } from './giveHqHeroChoice.resolve.js';
import { hasPendingCopyPowersChoice } from './copyPowersChoice.resolve.js';
import { hasPendingSeatChoice } from './seatChoice.resolve.js';
import { hasHealedThisTurn } from './healWounds.js';
import { resolveCardName } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * The minimal boardgame.io events surface threaded into dispatchTacticOnFight so a
 * tactic Fight can park a WP-684 multi-seat seat choice (WP-694 / D-24511).
 *
 * // why: narrowed via a structural type (mirroring seatChoice.resolve.ts's SeatChoiceEvents
 * and tacticHandlers.ts's TacticSeatChoiceEvents) so this core forwards events without a
 * boardgame.io-specific dependency. Optional so a unit/replay caller omits it.
 */
interface TacticSeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/**
 * Fights the mastermind by defeating the top tactic card.
 *
 * Validates available attack against the mastermind's fight requirement,
 * defeats exactly one tactic per successful fight, and checks for
 * victory when all tactics are defeated.
 *
 * @param context - boardgame.io move context with G, ctx.
 */
// why: MVP defeats exactly 1 tactic per fight; multi-tactic defeat is WP-024.
// why: WP-497 / D-24300 — tactic Fight effects are NOW executed by
// defeatMastermindTacticCore's dispatchTacticOnFight step; the former "tactic
// text effects are WP-024" note was stale (WP-024 did scheme + mastermind STRIKE
// execution; tactic Fight was scoped out of WP-316/386/388 and had no owner).
export function fightMastermind(
  { G, ctx, random, events }: MoveContext,
): void {
  // why: WP-687 / D-24504 — the optional Final Blow rule. When available, the
  // Mastermind (with no Tactics left) is fightable a 5th, final time; that fight is
  // a DISTINCT branch in Step 3 that awards the Mastermind card itself and does NOT
  // run the tactic defeat core. Off (the default) this is false and every branch
  // below is byte-identical to pre-WP-687.
  const isFinalBlow = isFinalBlowAvailable(G.mastermind, G.finalBlow);

  // Step 1: Validate
  // why: an empty tactics deck ends the move — EXCEPT under an available Final
  // Blow, where the empty-deck Mastermind is exactly the one that stays fightable
  // (WP-687). The `&& !isFinalBlow` is the only change here; with Final Blow off
  // isFinalBlow is false so the early-return is unchanged (regression pin).
  if (G.mastermind.tacticsDeck.length === 0 && !isFinalBlow) {
    return;
  }

  // why: baseCardId is the canonical stats key; fightCost is the fight
  // requirement field per WP-018 D-1805; never use G.mastermind.id or
  // any tactic card ID for stat lookup
  const requiredFightCost = resolveMastermindFightCost(G);
  // why: WP-580 / D-24389 — getSpendableAttack folds in unspent recruit when the
  // recruit-as-attack conversion is active this turn; equal to getAvailableAttack
  // otherwise, so the gate is unchanged on every non-conversion turn.
  const spendableAttack = getSpendableAttack(G.turnEconomy);

  // why: silent failure preserves deterministic move contract —
  // insufficient attack points means the mastermind fight cannot proceed
  if (spendableAttack < requiredFightCost) {
    return;
  }

  // Step 2: Stage gate (non-core move, internal gating)
  // why: boss fight during action window; non-core moves gate internally
  // per WP-014A precedent (same pattern as fightVillain/recruitHero)
  if (G.currentStage !== 'main') return;

  // why: block-all guard (D-24008) — while a KO-a-Hero choice is pending the
  // board is frozen; fightMastermind returns with no side effects. Placed
  // immediately after the stage gate, before any G/zone write.
  if (hasPendingKoHeroChoice(G)) return;
  // why: block-all guard (D-24282) — a pending Doombot scry-KO choice freezes the
  // board until the player picks which revealed card to KO.
  if (hasPendingScryKoChoice(G)) return;
  // why: WP-603 / D-24413 — block-all guard: a pending Melter Fight KO/keep choice
  // freezes the board until the fighting player resolves every revealed deck top.
  if (hasPendingMelterKoChoice(G)) return;
  // why: block-all guard (WP-476 / D-24284) — a pending discard-to-limit choice
  // freezes the board until the current player picks which cards to discard.
  if (hasPendingDiscardChoice(G)) return;
  if (hasPendingPutCardsOnDeckChoice(G)) return;
  if (hasPendingReorderChoice(G)) return; // why: WP-479 / D-24286 block-all guard
  if (hasPendingDefeatChoice(G)) return; // why: WP-486 / D-24291 block-all guard
  if (hasPendingKoDiscardChoice(G)) return; // why: WP-693 / D-24510 block-all guard
  // why: block-all guard (D-24019) — optional-KO-reward choice pending; the
  // board is frozen until resolved (beside the D-24008 KO-hero check above).
  if (hasPendingPlayVillainTopChoice(G)) return; // why: WP-663 / D-24474 — block-all guard (Shadowed Thoughts play-villain-top choice)
  if (hasPendingOptionalKoReward(G)) return;
  if (hasPendingSmashDiscard(G)) return; // why: WP-676 / D-24492 — block-all guard (Smash discard-for-attack choice)
  if (hasPendingDoOver(G)) return; // why: WP-681 / D-24498 — block-all guard (Do-Over accept/decline choice)
  // why: block-all — pendingVictoryPileCardPick must be resolved before any other action (D-24067)
  if (hasPendingVictoryPileCardPick(G)) return;
  // why: block-all — pendingDrawOrEmpowered must be resolved before any other action (D-24069)
  if (hasPendingDrawOrEmpowered(G)) return;
  if (hasPendingCountScaledChoice(G)) return;
  // why: block-all — pendingUndercoverChoice must be resolved before any other action (WP-678 / D-24494)
  if (hasPendingUndercoverChoice(G)) return;
  // why: block-all — pendingReturnZeroCostDiscard must be resolved before any other action (D-24139)
  if (hasPendingReturnZeroCostDiscard(G)) return;
  // why: block-all — pendingDiscardToPlay must be resolved before any other action (WP-383 / D-24184)
  if (hasPendingDiscardToPlay(G)) return;
  // why: block-all — pendingReturnOnDiscard must be resolved before any other action (WP-498 / D-24301)
  if (hasPendingReturnOnDiscard(G)) return;
  // why: block-all — pendingGiveHqHeroChoice (Paibok Fight) must be resolved first (WP-532 / D-24343)
  if (hasPendingGiveHqHeroChoice(G)) return;
  // why: block-all — pendingCopyPowersChoice (Rogue's Copy Powers) must be resolved first (WP-535 / D-24345)
  if (hasPendingCopyPowersChoice(G)) return;
  if (hasPendingSeatChoice(G)) return; // why: WP-684 / D-24501 — block-all (non-active/multi-seat pending choice)

  // why: D-24180 — a player who used the Wound Healing ability this turn may not
  // fight or recruit for the rest of the turn (the reverse lock).
  if (hasHealedThisTurn(G)) return;

  // Step 3: Mutate G.
  // why: WP-687 / D-24504 — the Final Blow 5th, final fight is a DISTINCT branch
  // that awards the Mastermind card itself and does NOT run the tactic defeat core
  // (whose empty-deck early return would no-op while the shared spend below still
  // ran — attack for nothing, RS-2). It is an if/else so the final blow NEVER falls
  // into the core; off the Final Blow rule the else branch is byte-identical to
  // pre-WP-687.
  //
  // why: the normal path reuses the shared mastermind-tactic defeat-core (WP-486 /
  // D-24291); then spend attack + mark acted (shared by both branches). Both are
  // EXCLUDED from the shared core and stay here in the fight move: Silent Sniper's
  // defeat spends no attack and is a card play, not a fight. The tactic defeat
  // fires NO onFight ability, so nothing between reads G.turnEconomy or
  // G.hasActedThisTurn — the unmodified fightMastermind tests are the oracle.
  if (isFinalBlow) {
    awardMastermindOnFinalBlow(G, ctx);
  } else {
    // why: WP-694 / D-24511 — thread the move's events so a tactic Fight that parks a
    // WP-684 multi-seat seat choice (Monarch's Decree / Vanishing Illusions) can admit the
    // non-active seats via setActivePlayers.
    defeatMastermindTacticCore(G, ctx, { random }, events);
  }
  // why: WP-580 / D-24389 — spendFightCost debits attack first, then unspent
  // recruit when the conversion is active; identical to spendAttack when unset.
  G.turnEconomy = spendFightCost(G.turnEconomy, requiredFightCost);
  // why: D-24180 — this successful mastermind fight marks the player as having
  // acted this turn, which bars the Wound Healing ability for the rest of the turn.
  G.hasActedThisTurn = true;
  // why: WP-656 / D-24467 — signal this Mastermind defeat for Diamond Form's
  // wait-and-see grant. RS-1 ruling: each successful fightMastermind defeats one
  // Tactic into the victory pile, and per the Universal Rules a Tactic defeat is
  // "defeating the Mastermind" for a whenever-you-defeat trigger — so EVERY tactic
  // fight counts (repeatable +3 per tactic), not only the final vanquish. GATED and
  // EDGE-triggered exactly as the fightVillain site; consumed by resolveDeferredHeroGrants.
  if (G.deferredConditionalGrants !== undefined && G.deferredConditionalGrants.length > 0) {
    G.villainOrMastermindDefeatedSinceResolve = true;
  }
}

/**
 * Shared mastermind-tactic defeat-core (WP-486 / D-24291).
 *
 * Defeats the top tactic into the current player's victory pile, rescues every
 * Bystander the Mastermind currently holds (both stores), drops the mirror
 * attachment, and — when all tactics are defeated — sets the endgame counter and
 * emits the mastermindDefeated notable event. The exact Step-3+ body
 * fightMastermind formerly inlined, MINUS `spendAttack` and `G.hasActedThisTurn`
 * (those stay in the fight moves). Reused by fightMastermind (the normal fight)
 * and by Silent Sniper's `defeat-with-bystander` hero effect / its
 * resolveDefeatChoice move (the free defeat, no attack spend).
 *
 * Unlike the villain core, a tactic defeat fires no onFight ability, so this core
 * takes no ShuffleProvider. The caller guarantees at least one tactic remains; an
 * empty tactics deck is a silent no-op (moves never throw). The defeating player
 * is `ctx.currentPlayer`.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param ctx - The bare boardgame.io ctx (currentPlayer), typed unknown to avoid
 *   a framework import.
 * @param shuffleContext - ShuffleProvider ({ random }) for a tactic Fight that draws.
 * @param events - The move's boardgame.io events (WP-694 / D-24511), forwarded to
 *   dispatchTacticOnFight so a tactic that parks a WP-684 multi-seat seat choice can admit
 *   the non-active seats. Optional/guarded — a unit/replay context without a live framework
 *   omits it and the parked choice resolves directly against G.
 */
export function defeatMastermindTacticCore(
  G: LegendaryGameState,
  ctx: unknown,
  shuffleContext: ShuffleProvider,
  events?: TacticSeatChoiceEvents,
): void {
  // why: narrow the unknown ctx to the one field this core reads (the defeating
  // player), mirroring executeVillainAbilities — no framework import.
  const currentPlayer = (ctx as { currentPlayer: string }).currentPlayer;

  // why: defense-in-depth — the caller (fightMastermind gate / hero eligibility
  // builder) guarantees a tactic remains, but an empty deck is a silent no-op
  // rather than an out-of-range read (moves never throw).
  if (G.mastermind.tacticsDeck.length === 0) {
    return;
  }

  // why: capture the tactic card ID before defeatTopTactic moves it from
  // tacticsDeck to tacticsDefeated — the player earns this card in their
  // victory pile (tabletop Legendary: defeated tactics are VP cards).
  const defeatedTacticId = G.mastermind.tacticsDeck[0]!;
  G.mastermind = defeatTopTactic(G.mastermind);
  G.playerZones[currentPlayer]!.victory.push(defeatedTacticId);

  // why: WP-323 — name the mastermind (G.mastermind.id is the qualified
  // "core/magneto", not a display name; baseCardId keys cardDisplayData — the
  // same resolution the vanquish notableEvent uses below) and the specific tactic
  // just defeated (defeatedTacticId, captured above before defeatTopTactic moved
  // it from the deck).
  const mastermindDisplayName = resolveCardName(
    G.cardDisplayData,
    G.mastermind.baseCardId,
  );
  const defeatedTacticName = resolveCardName(G.cardDisplayData, defeatedTacticId);
  pushLog(G,
    `Player ${currentPlayer} fought ${mastermindDisplayName} and defeated the tactic "${defeatedTacticName}".`,
  );

  // why: EVERY tactic defeat rescues all bystanders the Mastermind is
  // currently holding — NOT only the vanquishing blow. Universal Rules v23
  // §"When you fight a Mastermind/Commander" step 1: "put that Tactic into
  // your Victory Pile ... (Also rescue any Bystanders the Mastermind was
  // holding, putting them all into your Victory Pile.)". The Mastermind is
  // "not truly defeated until all four Tactics are defeated" (rules
  // §Mastermind Card), but that gates the WIN, not the rescue. Earlier code
  // awarded captured bystanders only on the final tactic — the bug reported
  // on play.legendary-arena.com. G.mastermind.attachedBystanders is the
  // complete capture set as of this fight: Master Strike captures (D-15401,
  // stored only here) plus bystanders revealed while the City was empty
  // (villainDeck.reveal mirrors those into this field too). The fighting
  // player earns all of them in their victory pile (rescued bystanders are
  // VP cards). `?? []` guards legacy test fixtures that omit the field;
  // production setup always populates it. The store is cleared after the
  // award so a later Master Strike re-capture is rescued by the next fight.
  const mastermindBaseCardId = G.mastermind.baseCardId;
  const rescuedBystanders = G.mastermind.attachedBystanders ?? [];
  for (const bystanderCardId of rescuedBystanders) {
    G.playerZones[currentPlayer]!.victory.push(bystanderCardId);
  }
  G.mastermind = { ...G.mastermind, attachedBystanders: [] };

  // why: bystanders revealed while the City was empty are mirrored into
  // BOTH G.mastermind.attachedBystanders (awarded above) and the
  // city-villain G.attachedBystanders map keyed by the mastermind's base
  // card. Drop that mirror entry so no dangling attachment survives the
  // award and the same bystander is never counted in two stores.
  if (G.attachedBystanders[mastermindBaseCardId] !== undefined) {
    const remainingAttachments = { ...G.attachedBystanders };
    delete remainingAttachments[mastermindBaseCardId];
    G.attachedBystanders = remainingAttachments;
  }

  if (rescuedBystanders.length > 0) {
    pushLog(G,
      `Player ${currentPlayer} rescued ${rescuedBystanders.length} bystander(s) from the mastermind into their victory pile.`,
    );
  }

  if (areAllTacticsDefeated(G.mastermind)) {
    if (G.finalBlow === true) {
      // why: WP-687 / D-24504 — the optional Final Blow rule (Universal Rules v23
      // "Final Blow (Optional)"): once every Tactic is defeated the Mastermind is
      // NOT yet won — a player must fight the Mastermind card itself a 5th, final
      // time. So DEFER the win: latch final-blow-pending (the Mastermind stays
      // fightable), and do NOT set MASTERMIND_DEFEATED or emit the mastermindDefeated
      // event here. That vanquish + the Mastermind-card award happen in
      // fightMastermind's final-blow branch (awardMastermindOnFinalBlow). This is
      // the SHARED core, so a Silent Sniper free defeat of the last Tactic under
      // Final Blow also defers — rulebook-correct.
      G.mastermind = setFinalBlowPending(G.mastermind, true);
      // why: WP-323 — reuse the mastermind display name resolved above.
      pushLog(G,
        `All tactics defeated — ${mastermindDisplayName} requires a final blow: fight the Mastermind once more to win.`,
      );
    } else {
      // why: setting MASTERMIND_DEFEATED counter to 1 triggers the endgame
      // evaluator from WP-010 — use constant, never string literal
      G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1;
      // why: WP-323 — reuse the mastermind display name resolved above.
      pushLog(G,
        `All tactics defeated — mastermind ${mastermindDisplayName} is vanquished!`,
      );

      // why: D-20008 parity with fightVillain's fightResolved event — surface
      // a player-visible "mastermind defeated + bystanders rescued" notable
      // event so the arena-client overlay reports the outcome. G.messages is
      // NOT projected to clients (UIState carries notableEvents only), so
      // without this the rescue is invisible on the client. Emitted last so it
      // observes fully-settled state. Defensive cardDisplayData access mirrors
      // the mastermind-strike handler — production setup always builds it;
      // legacy test fixtures may omit it, in which case the id is the fallback.
      const mastermindDisplay = G.cardDisplayData?.[G.mastermind.baseCardId];
      const mastermindName =
        mastermindDisplay && typeof mastermindDisplay.name === 'string' && mastermindDisplay.name.length > 0
          ? mastermindDisplay.name
          : G.mastermind.id;
      G.notableEvents.push({
        type: 'mastermindDefeated',
        playerId: currentPlayer,
        mastermindId: G.mastermind.id,
        bystandersRescued: rescuedBystanders.length,
        narrative: composeMastermindDefeatedNarrative(
          mastermindName,
          rescuedBystanders.length,
        ),
      });
    }
  }

  // why: WP-497 / D-24300 — FINAL step: fire the defeated tactic's printed Fight
  // ability (per-tactic dispatch keyed by defeatedTacticId; unknown id → silent
  // no-op, so every unimplemented tactic stays inert). Runs AFTER the tactic +
  // bystanders are awarded and the all-tactics endgame block, on the current
  // player, whether or not this was the vanquishing tactic (Universal Rules v23:
  // tactic Fight effects resolve on defeat). Placed last so it observes fully-
  // settled state.
  // why: WP-567 - pass a ShuffleProvider alongside ctx. HYDRA Conspiracy DRAWS,
  // and the bare boardgame.io ctx carries no random (the D-24051 hazard recorded
  // in dodgeCard.ts), so the reshuffle path needs random.Shuffle threaded from
  // the move context or an empty-deck draw would silently stop short.
  // why: WP-694 / D-24511 - forward events so Monarch's Decree / Vanishing Illusions can
  // park a WP-684 multi-seat seat choice (setActivePlayers admits the non-active seats).
  dispatchTacticOnFight(G, ctx, defeatedTacticId, shuffleContext, events);
}

/**
 * Awards the Mastermind card itself on the Final Blow 5th, final fight
 * (WP-687 / D-24504).
 *
 * Called ONLY when `isFinalBlowAvailable(...)` held (Final Blow on, every Tactic
 * defeated, the final blow still pending). Moves the Mastermind BASE card into the
 * current player's Victory Pile (the win reward per Universal Rules v23 "Final Blow
 * (Optional)"), rescues any Bystanders the Mastermind still holds, clears the
 * pending flag + the bystander stores, sets the MASTERMIND_DEFEATED endgame counter
 * (reused, not a new condition), and emits the mastermindDefeated notable event.
 *
 * The Mastermind card enters exactly ONE Victory Pile ONCE: the deferred 4th-Tactic
 * branch (in `defeatMastermindTacticCore`) never awards it — it only latches
 * final-blow-pending — so this is the sole award site.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param ctx - The bare boardgame.io ctx (currentPlayer), typed unknown to avoid a framework import.
 */
function awardMastermindOnFinalBlow(G: LegendaryGameState, ctx: unknown): void {
  // why: narrow the unknown ctx to the one field this reads (the fighting player),
  // mirroring defeatMastermindTacticCore — no framework import.
  const currentPlayer = (ctx as { currentPlayer: string }).currentPlayer;
  const mastermindBaseCardId = G.mastermind.baseCardId;

  // why: the win reward — the Mastermind card itself goes to the fighting player's
  // Victory Pile (the D-24504 locked award), via the direct `.victory.push` the
  // tactic / bystander awards use.
  G.playerZones[currentPlayer]!.victory.push(mastermindBaseCardId);

  // why: rescue any Bystanders the Mastermind still holds. In the common case the
  // deferred 4th-Tactic defeat already rescued + cleared them (so this is []/0); but
  // a Master Strike between the 4th Tactic and this final fight can re-capture, and
  // every mastermind fight rescues held Bystanders (Universal Rules v23) — so they
  // are never stranded on a now-defeated Mastermind.
  const rescuedBystanders = G.mastermind.attachedBystanders ?? [];
  for (const bystanderCardId of rescuedBystanders) {
    G.playerZones[currentPlayer]!.victory.push(bystanderCardId);
  }

  // why: the final blow is done — clear the pending flag (so isFinalBlowAvailable
  // now reads false: the card is awarded) and empty the bystander store (parity
  // with the core's post-award clear). Copy-then-override preserves every other
  // MastermindState field.
  G.mastermind = { ...setFinalBlowPending(G.mastermind, false), attachedBystanders: [] };

  // why: drop the city-mirror bystander entry so no dangling attachment survives
  // the award (parity with defeatMastermindTacticCore's mirror cleanup).
  if (G.attachedBystanders[mastermindBaseCardId] !== undefined) {
    const remainingAttachments = { ...G.attachedBystanders };
    delete remainingAttachments[mastermindBaseCardId];
    G.attachedBystanders = remainingAttachments;
  }

  const mastermindDisplayName = resolveCardName(G.cardDisplayData, mastermindBaseCardId);
  pushLog(G,
    `Player ${currentPlayer} struck the final blow and defeated ${mastermindDisplayName}!`,
  );
  if (rescuedBystanders.length > 0) {
    pushLog(G,
      `Player ${currentPlayer} rescued ${rescuedBystanders.length} bystander(s) from the mastermind into their victory pile.`,
    );
  }

  // why: setting MASTERMIND_DEFEATED to 1 fires the WP-010 endgame evaluator
  // (heroes-win) — reused, never a new condition (D-24504). On Final Blow this is
  // the ONLY site that sets it; the deferred 4th-Tactic branch does not.
  G.counters[ENDGAME_CONDITIONS.MASTERMIND_DEFEATED] = 1;

  // why: D-20008 parity with the core's vanquish event — surface the player-visible
  // win + any final-blow rescue (G.messages is not projected to clients). Defensive
  // cardDisplayData access mirrors the core.
  const mastermindDisplay = G.cardDisplayData?.[mastermindBaseCardId];
  const mastermindName =
    mastermindDisplay && typeof mastermindDisplay.name === 'string' && mastermindDisplay.name.length > 0
      ? mastermindDisplay.name
      : G.mastermind.id;
  G.notableEvents.push({
    type: 'mastermindDefeated',
    playerId: currentPlayer,
    mastermindId: G.mastermind.id,
    bystandersRescued: rescuedBystanders.length,
    narrative: composeMastermindDefeatedNarrative(
      mastermindName,
      rescuedBystanders.length,
    ),
  });
}
