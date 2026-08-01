/**
 * Fight villain move for the Legendary Arena game engine.
 *
 * fightVillain removes a villain or henchman from a City space and places
 * it in the current player's victory pile. Follows the three-step
 * validation contract: validate args, check stage gate, mutate G.
 *
 * This is a non-core move that gates internally (same pattern as
 * revealVillainCard from WP-014A). It is NOT added to CoreMoveName,
 * CORE_MOVE_NAMES, or MOVE_ALLOWED_STAGES.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import { formatCardRef } from '../log/logDisplay.js';
import { awardAttachedBystanders } from '../board/bystanders.logic.js';
import { awardAttachedHeroes } from '../board/heroCapture.logic.js';
import { getAvailableAttack, spendAttack } from '../economy/economy.logic.js';
import { resolveFightCost } from '../economy/economy.resolve.js';
import { isGuardBlocking, getPatrolModifier } from '../board/boardKeywords.logic.js';
import {
  getDefeatRequirement,
  playerMeetsDefeatRequirement,
} from './villainDefeatRequirement.logic.js';
import {
  executeVillainAbilities,
  resolveEffectResultNames,
} from '../villain/villainEffects.execute.js';
import { hasPendingKoHeroChoice } from './koHeroChoice.resolve.js';
import { hasPendingScryKoChoice } from './scryKoChoice.resolve.js';
import { hasPendingDiscardChoice } from './discardChoice.resolve.js';
import { hasPendingOptionalKoReward } from './optionalKoReward.resolve.js';
import { hasPendingVictoryPileCardPick } from './resolveVictoryPileCardPick.js';
import { hasPendingDrawOrEmpowered } from './drawOrEmpowered.resolve.js';
import { hasPendingReturnZeroCostDiscard } from './resolveReturnZeroCostDiscard.js';
import { hasPendingDiscardToPlay } from './resolveDiscardToPlay.js';
import { hasHealedThisTurn } from './healWounds.js';
import {
  composeFightNarrative,
  composeEffectResultLogLine,
} from '../events/notableEvents.compose.js';
import { pushLog } from '../log/logPush.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** Arguments for the fightVillain move. */
interface FightVillainArgs {
  /** 0-based index of the City space to fight (0-4). */
  cityIndex: number;
}

/**
 * Fights a villain or henchman in the City.
 *
 * Removes the card from the specified City space and places it in the
 * current player's victory pile.
 *
 * @param context - boardgame.io move context with G, ctx.
 * @param args - The city space index to fight.
 */
export function fightVillain(
  { G, ctx, random }: MoveContext,
  { cityIndex }: FightVillainArgs,
): void {
  // Step 1: Validate args
  if (
    typeof cityIndex !== 'number' ||
    !Number.isFinite(cityIndex) ||
    !Number.isInteger(cityIndex) ||
    cityIndex < 0 ||
    cityIndex > 4
  ) {
    return;
  }

  const cardId = G.city[cityIndex];
  if (cardId === null || cardId === undefined) {
    return;
  }

  // why: Guard blocks access to lower-index City cards. A Guard at a higher
  // index (closer to escape) prevents fighting villains behind it. You must
  // defeat the Guard first. Guard check uses defensive access (G.cardKeywords
  // may be undefined in pre-WP-025 test states).
  const cardKeywords = G.cardKeywords ?? {};
  if (isGuardBlocking(G.city, cityIndex, cardKeywords)) {
    return;
  }

  // why: Patrol adds +1 to the fight cost (MVP additive modifier). The
  // patrol modifier is additive on top of the resolved fight cost.
  // resolveFightCost is the single authority — handles both static and
  // dynamic (captured-hero-based) villains (WP-214).
  const baseFightCost = resolveFightCost(G, cardId);
  const patrolModifier = getPatrolModifier(cardId, cardKeywords);
  const requiredFightCost = baseFightCost + patrolModifier;
  const availableAttack = getAvailableAttack(G.turnEconomy);
  if (availableAttack < requiredFightCost) {
    return;
  }

  // why: D-24076 — defeat-requirement precondition; a marked villain
  // (Blob/Venom/Zombie Venom) can't be defeated unless the current player has a
  // qualifying Hero in hand or in play. Silent return on block, mirroring the
  // Guard-block gate above — no G mutation, no message, no event, no throw. The
  // two helpers are the single authority for this test (no inline matching).
  const defeatRequirement = getDefeatRequirement(G, cardId);
  if (
    defeatRequirement !== null &&
    !playerMeetsDefeatRequirement(G, ctx.currentPlayer, defeatRequirement)
  ) {
    return;
  }

  // Step 2: Stage gate (non-core move, internal gating)
  // why: fighting happens during the main action window; non-core moves
  // gate internally per the WP-014A precedent
  if (G.currentStage !== 'main') return;

  // why: block-all guard (D-24008) — while a KO-a-Hero choice is pending the
  // board is frozen; fightVillain returns with no side effects so the player
  // resolves the Fight effect before fighting again. Placed immediately after
  // the stage gate, before any G/zone write.
  if (hasPendingKoHeroChoice(G)) return;
  // why: block-all guard (D-24282) — a pending Doombot scry-KO choice freezes the
  // board until the player picks which revealed card to KO. (fightVillain is the
  // Doombot trigger path itself, so this guards a re-fight while the park is open.)
  if (hasPendingScryKoChoice(G)) return;
  // why: block-all guard (WP-476 / D-24284) — a pending discard-to-limit choice
  // freezes the board until the current player picks which cards to discard.
  if (hasPendingDiscardChoice(G)) return;
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

  // why: D-24180 — a player who used the Wound Healing ability this turn may not
  // fight or recruit for the rest of the turn (the reverse lock).
  if (hasHealedThisTurn(G)) return;

  // Step 3: Mutate G
  // why: MVP has no attack point check; WP-018 adds the economy. Any player
  // can fight any occupied City space without spending attack points.
  G.city[cityIndex] = null;
  G.playerZones[ctx.currentPlayer]!.victory.push(cardId);

  // Step 3b: Award attached bystanders to player's victory zone (WP-017)
  const victoryBefore = G.playerZones[ctx.currentPlayer]!.victory.length;
  const awardResult = awardAttachedBystanders(
    cardId,
    G.attachedBystanders,
    G.playerZones[ctx.currentPlayer]!.victory,
  );
  G.attachedBystanders = awardResult.attachedBystanders;
  G.playerZones[ctx.currentPlayer]!.victory = awardResult.playerVictory;

  // Step 3c: Award attached heroes to player's discard pile (WP-214)
  // why: WP-431 — capture the attached-hero list BEFORE awardAttachedHeroes
  // deletes the mapping entry, so the log below can name each hero returned to
  // the defeating player's discard ("Fight: Gain that Hero"). Deterministic
  // append order; empty when the villain captured no HQ hero.
  const heroesReturnedToDiscard = [...(G.villainAttachedHeroes?.[cardId] ?? [])];
  awardAttachedHeroes(G, cardId, ctx.currentPlayer);

  G.turnEconomy = spendAttack(G.turnEconomy, requiredFightCost);

  // why: D-24180 — this successful fight marks the player as having acted this
  // turn, which bars the Wound Healing ability for the rest of the turn.
  G.hasActedThisTurn = true;

  // why: Fight: effects fire after the bystander award (Step 3b) and before
  // the message push, so they observe post-award pile state. A Fight:
  // captureBystander awards the newly attached bystander immediately (the card
  // is already in the victory pile), avoiding a stranded bystander (WP-185).
  // WP-316: capture the executor's per-effect results (keywords + targets) for
  // the fightResolved emission and the effect-narration log line below.
  // why: WP-478 / D-24285 — pass the move's `random` (wrapped as a ShuffleProvider
  // `{ random }`) so a Fight scry (Doombot Legion) can reshuffle the current
  // player's discard when their deck is short.
  const appliedFightResults = executeVillainAbilities(G, ctx, cardId, 'onFight', { random });
  // why: WP-316 — map results→keywords so the fightResolved `appliedEffects`
  // field and the composeFightNarrative string stay byte-identical to main; the
  // hashed notableEvents surface (and the arena-client) never observe the
  // per-target widening, so finalStateHash is unchanged.
  const appliedFightEffects = appliedFightResults.map((result) => result.keyword);

  pushLog(G, 
    `Player ${ctx.currentPlayer} fought ${formatCardRef(G.cardDisplayData, cardId)} at city space ${cityIndex}.`,
  );
  const bystandersRescued = awardResult.playerVictory.length - victoryBefore;
  if (awardResult.playerVictory.length > victoryBefore) {
    pushLog(G,
      `Player ${ctx.currentPlayer} rescued ${bystandersRescued} bystander(s) from ${formatCardRef(G.cardDisplayData, cardId)}.`,
    );
  }
  // why: WP-431 — narrate the captured HQ hero(es) returning to the defeating
  // player's discard on villain defeat (awardAttachedHeroes above; the villain's
  // "Fight: Gain that Hero" text). Without this line a hero the player never
  // recruited appears in their deck with no log trail. Durable log (G.messages,
  // hash-excluded per D-24081). One line per hero; none when no hero was captured.
  for (const heroId of heroesReturnedToDiscard) {
    pushLog(G,
      `Player ${ctx.currentPlayer} gained ${formatCardRef(G.cardDisplayData, heroId)} from ${formatCardRef(G.cardDisplayData, cardId)} into their discard pile.`,
    );
  }

  // why: WP-316 + WP-319 — resolve the effect targets to display names ONCE (via
  // G.cardDisplayData; the composer stays pure). The same resolved results feed
  // BOTH the durable `Fight effect:` log line below AND the fightResolved
  // narrative (so the center-screen overlay and the log name the same hero).
  const resolvedFightResults = resolveEffectResultNames(G, appliedFightResults);
  // why: WP-316 — narrate the Fight: effect targets into the durable log
  // (G.messages, hash-excluded per D-24081), after the fought/rescued pushes and
  // before the fightResolved event push. Length-guarded: no line when no effect
  // applied (an effectless fight pushes no effect line).
  if (appliedFightResults.length > 0) {
    pushLog(G, 
      `Fight effect: ${composeEffectResultLogLine(resolvedFightResults)}.`,
    );
  }

  // why: WP-200 — emission is the LAST step in this move (after Fight:
  // effect dispatch AND after both `G.messages.push` calls), so the event
  // observes the fully settled post-mutation state. `bystandersRescued`
  // reflects the post-award delta; `appliedEffects` is the executor's
  // dispatch-order return (post-safe-skip). Narrative composition uses the
  // resolved display name with a defensive fallback to raw cardId when
  // G.cardDisplayData has no matching entry — emissions never throw
  // (D-20006 + WP §Non-Negotiable Constraints).
  // why: WP-200 — defensive access; legacy test G states may leave
  // `cardDisplayData` undefined. Production setup always builds it.
  const fightCardDisplay = G.cardDisplayData?.[cardId];
  const fightCardName =
    fightCardDisplay && typeof fightCardDisplay.name === 'string' && fightCardDisplay.name.length > 0
      ? fightCardDisplay.name
      : cardId;
  G.notableEvents.push({
    type: 'fightResolved',
    playerId: ctx.currentPlayer,
    cardId,
    citySpace: cityIndex,
    bystandersRescued,
    appliedEffects: appliedFightEffects,
    // why: WP-319 — the narrative now names the specific effect target(s) (the
    // KO'd hero, captured HQ hero, etc.) via the resolved results, so the
    // center-screen NotableEventOverlay announces the hero. `appliedEffects`
    // above stays the keyword array (byte-identical) for the overlay's badges.
    narrative: composeFightNarrative(
      fightCardName,
      bystandersRescued,
      resolvedFightResults,
    ),
  });
}
