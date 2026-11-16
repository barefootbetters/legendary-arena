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
 * WP-840 / D-24773: a Villain to the left of the Mastermind (co2e The Blob) is fought through
 * the same path, via `fightVillain({ besideMastermindIndex })`. Both off-City fights share
 * the fightability authority (findFightableOffCityVillain), the fight body
 * (fightOffCityVillain) and the award (awardOffCityVillain), and The Blob shares every
 * residual above. Only the removal and the fought line differ.
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
import type { CardExtId, PlayerZones } from '../state/zones.types.js';
import { takeVillainBesideMastermind } from '../board/besideMastermind.logic.js';
import type { FightableFortifier } from './villainDefeatRequirement.logic.js';
import {
  findFightableFortifier,
  findFightableVillainBesideMastermind,
  matchHasFightRestrictionKind,
} from './villainDefeatRequirement.logic.js';
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

/** Where an off-City Villain is fought: a fortified place, or a position left of the Mastermind. */
type OffCityFightLocation =
  | { kind: 'fortified'; place: FortifyPlace }
  | { kind: 'beside-mastermind'; besideIndex: number };

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
  const fortifier = findFightableFortifier(G, context.ctx.currentPlayer, fortifiedPlace);
  if (fortifier === null) {
    return;
  }
  // why: findFightableFortifier returned non-null, so the argument is a fortified place.
  const place = fortifiedPlace as FortifyPlace;
  fightOffCityVillain(G, context, fortifier, { kind: 'fortified', place });
}

/**
 * Fights the Villain at a position to the left of the Mastermind, for the current player
 * (WP-840 / D-24773).
 *
 * Every refusal is a silent return with no G write, exactly as for a fortifier: the state
 * checks of findFightableVillainBesideMastermind, then the stage gate, an open pending choice
 * and the heal lock.
 *
 * @param G - Game state (mutated under the Immer draft when the fight happens).
 * @param context - The move context (ctx.currentPlayer + random).
 * @param besideMastermindIndex - The requested position (an untrusted move argument).
 */
export function fightVillainBesideMastermind(
  G: LegendaryGameState,
  context: FortifyFightContext,
  besideMastermindIndex: unknown,
): void {
  const villain = findFightableVillainBesideMastermind(G, context.ctx.currentPlayer, besideMastermindIndex);
  if (villain === null) {
    return;
  }
  // why: findFightableVillainBesideMastermind returned non-null, so the argument is an
  // integer position within the list.
  const besideIndex = besideMastermindIndex as number;
  fightOffCityVillain(G, context, villain, { kind: 'beside-mastermind', besideIndex });
}

/**
 * The off-City fight after its fightability check: the gates, the Size-Changing note, the
 * defeat, the debit and the fight's tail riders (WP-873 / D-24818, shared by WP-840 /
 * D-24773).
 *
 * // why: WP-840 / D-24773 — moved verbatim out of fightFortifyingVillain so a fight of The
 * Blob never drifts from a fortifier fight; only the defeat call reads the location.
 *
 * @param G - Game state (mutated under the Immer draft when the fight happens).
 * @param context - The move context (ctx.currentPlayer + random).
 * @param fortifier - The off-City Villain and its price, from the single fightability authority.
 * @param location - Where the Villain is fought.
 */
function fightOffCityVillain(
  G: LegendaryGameState,
  context: FortifyFightContext,
  fortifier: FightableFortifier,
  location: OffCityFightLocation,
): void {
  const currentPlayer = context.ctx.currentPlayer;
  if (isOffCityFightBlocked(G, currentPlayer)) {
    return;
  }
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
  defeatOffCityVillainCore(G, context.ctx, location, { random: context.random });
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
 * Returns whether an off-City fight is refused by a turn-state gate: the stage, an open
 * pending choice, the heal lock or a missing zone (WP-873 / D-24818; moved verbatim by
 * WP-840 / D-24773 to keep fightOffCityVillain on one screen).
 *
 * @param G - Game state (not mutated).
 * @param currentPlayer - The fighting player.
 * @returns True when the fight must return silently.
 */
function isOffCityFightBlocked(G: LegendaryGameState, currentPlayer: string): boolean {
  if (G.currentStage !== 'main') {
    return true;
  }
  // why: hasAnyPendingChoice is the City fight's block-all cluster plus the two
  // put-bottom-HQ guards. getLegalMoves returns early on both put-bottom-HQ choices, so the
  // fortifier intent mirror can never offer a fight this guard refuses.
  if (hasAnyPendingChoice(G)) {
    return true;
  }
  // why: D-24180 — a player who healed this turn may not fight for the rest of the turn.
  if (hasHealedThisTurn(G)) {
    return true;
  }
  // why: defense-in-depth for a malformed state with no zone for the fighter — refuse before
  // any write, so no price note, debit or acted flag is recorded for a fight that cannot land
  // (the core keeps its own guard). Never reachable from a real match.
  if (G.playerZones[currentPlayer] === undefined) {
    return true;
  }
  return false;
}

/**
 * Defeats an off-City Villain at its location (WP-840 / D-24773).
 *
 * @param G - Game state (mutated under the Immer draft).
 * @param ctx - The bare boardgame.io ctx, forwarded to the location's core.
 * @param location - Where the Villain is fought.
 * @param shuffleContext - ShuffleProvider ({ random }) for a Fight reshuffle.
 */
function defeatOffCityVillainCore(
  G: LegendaryGameState,
  ctx: unknown,
  location: OffCityFightLocation,
  shuffleContext: ShuffleProvider,
): void {
  switch (location.kind) {
    case 'fortified':
      defeatFortifyingVillainCore(G, ctx, location.place, shuffleContext);
      break;
    case 'beside-mastermind':
      defeatVillainBesideMastermindCore(G, ctx, location.besideIndex, shuffleContext);
      break;
    default: {
      // why: compile-time exhaustiveness — a location added without a core fails `tsc`.
      // Intentionally unused (no tsconfig sets noUnusedLocals).
      const unhandledLocation: never = location;
      break;
    }
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
  const placeLabel = FORTIFY_PLACE_LABELS[place];
  const capitalizedLabel = `${placeLabel.charAt(0).toUpperCase()}${placeLabel.slice(1)}`;
  awardOffCityVillain(
    G,
    ctx,
    zones,
    cardId,
    `Player ${currentPlayer} fought ${formatCardRef(G.cardDisplayData, cardId)} fortifying ${placeLabel}. ${capitalizedLabel} is no longer fortified.`,
    shuffleContext,
  );
}

/**
 * Defeats the Villain at a position to the left of the Mastermind into the current player's
 * Victory Pile and fires its Fight effects (WP-840 / D-24773).
 *
 * @param G - Game state (mutated under the Immer draft).
 * @param ctx - The bare boardgame.io ctx (currentPlayer + turn), forwarded to
 *   executeVillainAbilities.
 * @param besideIndex - The 0-based position in G.villainsBesideMastermind.
 * @param shuffleContext - ShuffleProvider ({ random }) for a Fight reshuffle.
 */
export function defeatVillainBesideMastermindCore(
  G: LegendaryGameState,
  ctx: unknown,
  besideIndex: number,
  shuffleContext: ShuffleProvider,
): void {
  const currentPlayer = (ctx as { currentPlayer: string }).currentPlayer;
  const zones = G.playerZones[currentPlayer];
  // why: defense-in-depth for a narrow mock with no zone for the player — a silent no-op
  // that leaves the Villain in place, so it never vanishes (never throws).
  if (zones === undefined) {
    return;
  }
  const cardId = takeVillainBesideMastermind(G, besideIndex);
  if (cardId === null) {
    return;
  }
  awardOffCityVillain(
    G,
    ctx,
    zones,
    cardId,
    `Player ${currentPlayer} fought ${formatCardRef(G.cardDisplayData, cardId)} to the left of the Mastermind.`,
    shuffleContext,
  );
}

/**
 * Puts a defeated off-City Villain into the fighter's Victory Pile, logs the fought line and
 * fires its Fight effects (WP-873 / D-24818, shared by WP-840 / D-24773).
 *
 * // why: WP-840 / D-24773 — moved verbatim out of defeatFortifyingVillainCore so both
 * off-City cores award identically; only the fought line is the caller's.
 *
 * @param G - Game state (mutated under the Immer draft).
 * @param ctx - The bare boardgame.io ctx, forwarded to executeVillainAbilities.
 * @param zones - The fighter's zones.
 * @param cardId - The defeated Villain, already removed from its off-City location.
 * @param foughtLine - The log line naming the fight.
 * @param shuffleContext - ShuffleProvider ({ random }) for a Fight reshuffle.
 */
function awardOffCityVillain(
  G: LegendaryGameState,
  ctx: unknown,
  zones: PlayerZones,
  cardId: CardExtId,
  foughtLine: string,
  shuffleContext: ShuffleProvider,
): void {
  // why: WP-871 / D-24816 — record "defeated a Villain this turn" for Orrgo's fight
  // restriction, lazily, exactly as defeatCityVillainCore does.
  if (matchHasFightRestrictionKind(G, 'requires-villain-defeated-this-turn')) {
    G.turnEconomy = recordVillainDefeated(G.turnEconomy);
  }
  zones.victory.push(cardId);
  pushLog(G, foughtLine);
  // why: an off-City Villain has no fought City space, so cityIndex is undefined and a
  // location-gated Fight effect fails closed (D-24295).
  const appliedFightResults = executeVillainAbilities(G, ctx, cardId, 'onFight', shuffleContext, undefined);
  if (appliedFightResults.length > 0) {
    const resolvedFightResults = resolveEffectResultNames(G, appliedFightResults);
    pushLog(G, `Fight effect: ${composeEffectResultLogLine(resolvedFightResults)}.`);
  }
}
