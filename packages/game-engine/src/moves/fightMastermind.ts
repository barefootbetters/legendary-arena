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
import { getAvailableAttack, spendAttack } from '../economy/economy.logic.js';
// why: WP-539 / D-24348 — centralized mastermind fight requirement (base fightCost +
// the Portals Dark-Portal mastermind bonus), so combat / UI / AI never disagree.
import { resolveMastermindFightCost } from '../economy/economy.resolve.js';
import { defeatTopTactic, areAllTacticsDefeated } from '../mastermind/mastermind.logic.js';
import { ENDGAME_CONDITIONS } from '../endgame/endgame.types.js';
import { composeMastermindDefeatedNarrative } from '../events/notableEvents.compose.js';
import { dispatchTacticOnFight } from '../rules/tacticHandlers.js';
import { hasPendingKoHeroChoice } from './koHeroChoice.resolve.js';
import { hasPendingScryKoChoice } from './scryKoChoice.resolve.js';
import { hasPendingDiscardChoice } from './discardChoice.resolve.js';
import { hasPendingPutCardsOnDeckChoice } from './putCardsOnDeckChoice.resolve.js';
import { hasPendingReorderChoice } from './reorderChoice.resolve.js';
import { hasPendingDefeatChoice } from './defeatChoice.resolve.js';
import { hasPendingOptionalKoReward } from './optionalKoReward.resolve.js';
import { hasPendingVictoryPileCardPick } from './resolveVictoryPileCardPick.js';
import { hasPendingDrawOrEmpowered } from './drawOrEmpowered.resolve.js';
import { hasPendingReturnZeroCostDiscard } from './resolveReturnZeroCostDiscard.js';
import { hasPendingDiscardToPlay } from './resolveDiscardToPlay.js';
import { hasPendingReturnOnDiscard } from './resolveReturnOnDiscard.js';
import { hasPendingGiveHqHeroChoice } from './giveHqHeroChoice.resolve.js';
import { hasPendingCopyPowersChoice } from './copyPowersChoice.resolve.js';
import { hasHealedThisTurn } from './healWounds.js';
import { resolveCardName } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

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
  { G, ctx }: MoveContext,
): void {
  // Step 1: Validate
  if (G.mastermind.tacticsDeck.length === 0) {
    return;
  }

  // why: baseCardId is the canonical stats key; fightCost is the fight
  // requirement field per WP-018 D-1805; never use G.mastermind.id or
  // any tactic card ID for stat lookup
  const requiredFightCost = resolveMastermindFightCost(G);
  const availableAttack = getAvailableAttack(G.turnEconomy);

  // why: silent failure preserves deterministic move contract —
  // insufficient attack points means the mastermind fight cannot proceed
  if (availableAttack < requiredFightCost) {
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
  // why: block-all guard (WP-476 / D-24284) — a pending discard-to-limit choice
  // freezes the board until the current player picks which cards to discard.
  if (hasPendingDiscardChoice(G)) return;
  if (hasPendingPutCardsOnDeckChoice(G)) return;
  if (hasPendingReorderChoice(G)) return; // why: WP-479 / D-24286 block-all guard
  if (hasPendingDefeatChoice(G)) return; // why: WP-486 / D-24291 block-all guard
  // why: block-all guard (D-24019) — optional-KO-reward choice pending; the
  // board is frozen until resolved (beside the D-24008 KO-hero check above).
  if (hasPendingOptionalKoReward(G)) return;
  // why: block-all — pendingVictoryPileCardPick must be resolved before any other action (D-24067)
  if (hasPendingVictoryPileCardPick(G)) return;
  // why: block-all — pendingDrawOrEmpowered must be resolved before any other action (D-24069)
  if (hasPendingDrawOrEmpowered(G)) return;
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

  // why: D-24180 — a player who used the Wound Healing ability this turn may not
  // fight or recruit for the rest of the turn (the reverse lock).
  if (hasHealedThisTurn(G)) return;

  // Step 3: Mutate G — reuse the shared mastermind-tactic defeat-core
  // (WP-486 / D-24291), then spend attack + mark acted. Both are EXCLUDED from
  // the shared core and stay here in the fight move: Silent Sniper's defeat spends
  // no attack and is a card play, not a fight. The tactic defeat fires NO onFight
  // ability (unlike a villain), so nothing between reads G.turnEconomy or
  // G.hasActedThisTurn — running them after the core is byte-identical to the
  // prior inline order (the unmodified fightMastermind tests are the oracle).
  defeatMastermindTacticCore(G, ctx);
  G.turnEconomy = spendAttack(G.turnEconomy, requiredFightCost);
  // why: D-24180 — this successful mastermind fight marks the player as having
  // acted this turn, which bars the Wound Healing ability for the rest of the turn.
  G.hasActedThisTurn = true;
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
 */
export function defeatMastermindTacticCore(
  G: LegendaryGameState,
  ctx: unknown,
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

  // why: WP-497 / D-24300 — FINAL step: fire the defeated tactic's printed Fight
  // ability (per-tactic dispatch keyed by defeatedTacticId; unknown id → silent
  // no-op, so every unimplemented tactic stays inert). Runs AFTER the tactic +
  // bystanders are awarded and the all-tactics endgame block, on the current
  // player, whether or not this was the vanquishing tactic (Universal Rules v23:
  // tactic Fight effects resolve on defeat). Placed last so it observes fully-
  // settled state.
  dispatchTacticOnFight(G, ctx, defeatedTacticId);
}
