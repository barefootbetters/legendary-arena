/**
 * Fighting a fortifying Villain (WP-873 / D-24818).
 *
 * Rules v23 L1454-1466: "Any player can fight that Villain as normal to end that Fortify
 * effect and put that Villain into their Victory Pile." A fortifier is not in the City, so
 * `fightVillain({ fortifiedPlace })` routes here before any City read, and every City fight
 * stays byte-identical.
 *
 * The fortifier fight is the plain fight: the Size-Changing price at the unnamed target,
 * the defeat requirement, the fight restriction (with no City index), the stage / pending /
 * heal gates, the Victory Pile and the Villain's Fight effects. It has no `fightResolved`
 * event, no attached Bystander or Hero award, no Excessive Violence, no paid rescue and no
 * free defeat (recorded residuals in D-24818).
 *
 * No boardgame.io import (the context is typed structurally). No .reduce(). Never throws.
 */

// why: WP-873 / D-24818 — this module and fightVillain.ts import each other
// (buildFightSizeChangingLine one way, fightFortifyingVillain the other), and
// phaseCard.ts -> defeatChoice.resolve.ts -> fightVillain.ts closes a second cycle. Both are
// runtime-safe: every imported binding is read inside a function and no module reads one at
// top level (the villainDeck/villainEscapeProcedure.ts precedent).
import type { LegendaryGameState } from '../types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import type { FortifyPlace } from '../board/fortify.types.js';
import { FORTIFY_PLACE_LABELS } from '../board/fortify.types.js';
import { removeFortification } from '../board/fortify.logic.js';
import { findFightableFortifier, matchHasFightRestrictionKind } from './villainDefeatRequirement.logic.js';
import { hasAnyPendingChoice } from './phaseCard.js';
import { hasHealedThisTurn } from './healWounds.js';
import { buildFightSizeChangingLine } from './fightVillain.js';
import { resolveFightCost } from '../economy/economy.resolve.js';
import { addResources, recordVillainDefeated, spendFightCostForTarget } from '../economy/economy.logic.js';
import { UNNAMED_CITY_SPACE_TARGET } from '../economy/economy.types.js';
import { executeVillainAbilities, resolveEffectResultNames } from '../villain/villainEffects.execute.js';
import { composeEffectResultLogLine } from '../events/notableEvents.compose.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';
import { queueEnigmaPeekOffer } from '../rules/enigmaCode.logic.js';

/** The slice of the boardgame.io move context the fortifier fight reads. */
interface FortifyFightContext {
  ctx: { currentPlayer: string };
  random: ShuffleProvider['random'];
}

/**
 * Fights the Villain fortifying a place, for the current player (WP-873 / D-24818).
 *
 * Every refusal is a silent return with no G write: the six state checks of
 * findFightableFortifier, then the stage gate, an open pending choice and the heal lock.
 *
 * @param G - Game state (mutated under the Immer draft when the fight happens).
 * @param context - The move context (ctx.currentPlayer + random).
 * @param fortifiedPlace - The requested place (an untrusted move argument).
 */
export function fightFortifyingVillain(
  G: LegendaryGameState,
  context: FortifyFightContext,
  fortifiedPlace: unknown,
): void {
  const currentPlayer = context.ctx.currentPlayer;
  const fortifier = findFightableFortifier(G, currentPlayer, fortifiedPlace);
  if (fortifier === null) {
    return;
  }
  if (G.currentStage !== 'main') {
    return;
  }
  // why: hasAnyPendingChoice is the City fight's block-all cluster plus the two
  // put-bottom-HQ guards. getLegalMoves returns early on both put-bottom-HQ choices, so the
  // fortifier intent mirror can never offer a fight this guard refuses.
  if (hasAnyPendingChoice(G)) {
    return;
  }
  // why: D-24180 — a player who healed this turn may not fight for the rest of the turn.
  if (hasHealedThisTurn(G)) {
    return;
  }
  // why: defense-in-depth for a malformed state with no zone for the fighter — refuse before
  // any write, so no price note, debit or acted flag is recorded for a fight that cannot land
  // (the core keeps its own guard). Never reachable from a real match.
  if (G.playerZones[currentPlayer] === undefined) {
    return;
  }
  // why: findFightableFortifier returned non-null, so the argument is a fortified place.
  const place = fortifiedPlace as FortifyPlace;
  const villainAttack = resolveFightCost(G, fortifier.cardId, currentPlayer);
  // why: D-24802 — the Size-Changing note only when the discount changed the price, logged
  // before the "fought" line, exactly as the City fight logs it.
  if (fortifier.price !== villainAttack) {
    pushLog(
      G,
      buildFightSizeChangingLine(currentPlayer, formatCardRef(G.cardDisplayData, fortifier.cardId), villainAttack, fortifier.price),
      'applied',
    );
  }
  defeatFortifyingVillainCore(G, context.ctx, place, { random: context.random });
  // why: a fortifier is on no named City space, so the debit uses the unnamed target, the
  // one findFightableFortifier checked: restricted Attack is never spent on it.
  G.turnEconomy = spendFightCostForTarget(G.turnEconomy, fortifier.required, UNNAMED_CITY_SPACE_TARGET);
  // why: D-24802 — rules v23 p.30, the Microscopic gain, added after the debit.
  if (fortifier.price < 0) {
    G.turnEconomy = addResources(G.turnEconomy, -fortifier.price, 0);
  }
  // why: D-24180 — a fight marks the player as having acted (bars Healing this turn).
  G.hasActedThisTurn = true;
  // why: WP-656 / D-24467 — the same edge-triggered signal and guard as fightVillain: a
  // fortifier is a Villain, so its defeat feeds a pending "defeat a Villain" grant.
  if (G.deferredConditionalGrants !== undefined && G.deferredConditionalGrants.length > 0) {
    G.villainOrMastermindDefeatedSinceResolve = true;
  }
  // why: WP-830 / D-24763 — "Whenever you fight a Villain" covers a fortifier too.
  if (G.enigmaCode !== undefined) {
    queueEnigmaPeekOffer(G, currentPlayer);
  }
}

/**
 * Defeats the Villain fortifying a place into the current player's Victory Pile and fires
 * its Fight effects (WP-873 / D-24818).
 *
 * // why: a separate small core instead of a location-agnostic defeatCityVillainCore. A
 * fortifier is always a printed Villain whose Bystanders and captured Heroes stayed in the
 * Escape Pile, so it needs none of the City core's conversion routes, awards, paid rescue,
 * fightResolved event (whose citySpace is a required number) or Villain-Deck bridges.
 * Rewriting the City core would touch every City fight; this touches none.
 *
 * @param G - Game state (mutated under the Immer draft).
 * @param ctx - The bare boardgame.io ctx (currentPlayer + turn), forwarded to
 *   executeVillainAbilities.
 * @param place - The fortified place.
 * @param shuffleContext - ShuffleProvider ({ random }) for a Fight reshuffle.
 */
export function defeatFortifyingVillainCore(
  G: LegendaryGameState,
  ctx: unknown,
  place: FortifyPlace,
  shuffleContext: ShuffleProvider,
): void {
  const currentPlayer = (ctx as { currentPlayer: string }).currentPlayer;
  const zones = G.playerZones[currentPlayer];
  // why: defense-in-depth for a narrow mock with no zone for the player — a silent no-op
  // that leaves the fortification in place, so the Villain never vanishes (never throws).
  if (zones === undefined) {
    return;
  }
  const cardId = removeFortification(G, place);
  if (cardId === null) {
    return;
  }
  // why: WP-871 / D-24816 — record "defeated a Villain this turn" for Orrgo's fight
  // restriction, lazily, exactly as defeatCityVillainCore does.
  if (matchHasFightRestrictionKind(G, 'requires-villain-defeated-this-turn')) {
    G.turnEconomy = recordVillainDefeated(G.turnEconomy);
  }
  zones.victory.push(cardId);
  const placeLabel = FORTIFY_PLACE_LABELS[place];
  const capitalizedLabel = `${placeLabel.charAt(0).toUpperCase()}${placeLabel.slice(1)}`;
  pushLog(
    G,
    `Player ${currentPlayer} fought ${formatCardRef(G.cardDisplayData, cardId)} fortifying ${placeLabel}. ${capitalizedLabel} is no longer fortified.`,
  );
  // why: a fortifier has no fought City space, so cityIndex is undefined and a
  // location-gated Fight effect fails closed (D-24295).
  const appliedFightResults = executeVillainAbilities(G, ctx, cardId, 'onFight', shuffleContext, undefined);
  if (appliedFightResults.length > 0) {
    const resolvedFightResults = resolveEffectResultNames(G, appliedFightResults);
    pushLog(G, `Fight effect: ${composeEffectResultLogLine(resolvedFightResults)}.`);
  }
}
