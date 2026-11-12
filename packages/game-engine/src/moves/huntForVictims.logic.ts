/**
 * Hunt for Victims (WP-884 / D-24835).
 *
 * Stalk the Night Stalkers (mdns Elsa Bloodstone) prints "You may have a Villain or Mastermind
 * [keyword:Hunt for Victims]. If it KOs a Bystander this way, you may KO a Hero from your hand or
 * discard pile." and "[hc:tech]: If a Bystander is KO'd this way, you may also rescue that Bystander
 * instead of putting it in the KO pile." Hunt for Victims means "KO a Bystander that is captured by
 * any Villain or Mastermind or in the Escape Pile. If you can't, then this captures a Bystander
 * instead." (rules v23 L1564-1577).
 *
 * Two chained WP-684 seat choices for the active player:
 *
 * 1. `hunt-for-victims` — KO mode lists one option per Bystander holder (City Villains ascending,
 *    the Mastermind, the Escape Pile); capture mode (no holder, non-empty supply) lists one option
 *    per City Villain, then the Mastermind. Both end with "Don't Hunt for Victims" (the default).
 *    The Tech line's handler adds a rescue twin before each KO option.
 * 2. `hunt-for-victims-ko-hero` — after a KO or rescue, an optional KO of a Hero from the hand or
 *    discard pile, recorded as an owned KO.
 *
 * The hunt choice is parked by the `hunt-for-victims` hero handler at play. The Hero pick chains
 * from `resolveSeatChoice`'s live move context, reading its input BEFORE the apply (the Commune /
 * Crush precedent). Every apply re-checks its holder or card, so a stale option is a logged no-op
 * and no Hero is KO'd without a Bystander KO.
 *
 * WP-889 / D-24841 adds the villain side for the Lilin Ambush lines that print only the hunt
 * (Skinner, Meatmarket, and Blackout with its Moonlight repeat): the mandatory
 * `villain-hunt-for-victims` choice (KO mode only, no decline, default the Escape Pile), resolved
 * without a prompt when at most one holder has a Bystander, and the Villain itself captures one
 * when none does. Outcast's and Sister Nil's Ambush second sentences and Lilith's tactics and
 * Master Strike remain follow-ups.
 *
 * No boardgame.io import, no registry, no .reduce(), never throws. Imported bindings are read only
 * inside function bodies (this module sits in import cycles with seatChoice.resolve and
 * heroEffects.execute); the kind constants are string literals.
 */

import type { LegendaryGameState, PendingSeatChoice, SeatChoiceOption } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { parkSeatChoice } from './seatChoice.resolve.js';
import { buildHereHoldThisTargets } from './seatChoiceCards.js';
import { attachBystanderToVillain } from '../board/bystanders.logic.js';
import { citySpaceNameForIndex } from '../board/citySpaceNames.js';
import { koCard } from '../board/ko.logic.js';
import { isBystanderCard } from '../scoring/scoring.logic.js';
import { buildKoEligibleTargets } from '../villain/villainEffects.execute.js';
import { recordOwnedCardKoed } from '../hero/deferredConditionalGrants.js';
import { pushLog } from '../log/logPush.js';
import { describeKoSourceZone, formatCardRef, resolveCardName } from '../log/logDisplay.js';
import { getVillainHooksForCard } from '../rules/villainAbility.types.js';

// why: WP-884 / D-24835 — the seat-choice kind of the hunt choice (KO / rescue / capture / decline),
// a string literal so the import cycle with seatChoice.resolve never reads it before it is defined.
/** The seat-choice kind for the Hunt for Victims choice. */
export const HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND = 'hunt-for-victims';
// why: WP-884 / D-24835 — the seat-choice kind of the optional KO-a-Hero pick that follows a
// Bystander KO or rescue.
/** The seat-choice kind for the KO-a-Hero pick after a Hunt for Victims KO. */
export const HUNT_FOR_VICTIMS_KO_HERO_SEAT_CHOICE_KIND = 'hunt-for-victims-ko-hero';
// why: WP-889 / D-24841 — the seat-choice kind of the Lilin villain hunt's holder pick (KO mode
// only, no decline), a string literal for the same import-cycle reason.
/** The seat-choice kind for a Villain's Hunt for Victims holder pick. */
export const VILLAIN_HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND = 'villain-hunt-for-victims';

const DECLINE_HUNT_LABEL = "Don't Hunt for Victims";
const DECLINE_KO_HERO_LABEL = "Don't KO a Hero";

/**
 * Title-cases a City space name ("bank" → "Bank").
 *
 * @param cityIndex - The 0-based City index.
 * @returns The title-cased name, or undefined when the index is out of range.
 */
function titleCasedSpaceName(cityIndex: number): string | undefined {
  const spaceName = citySpaceNameForIndex(cityIndex);
  if (spaceName === undefined) {
    return undefined;
  }
  return spaceName.charAt(0).toUpperCase() + spaceName.slice(1);
}

/**
 * Names a City Villain with its space: "Hand Ninjas (Bank)".
 *
 * @param G - The game state to inspect (not mutated).
 * @param cityIndex - The Villain's City index.
 * @param cardId - The Villain.
 * @returns The name with the space in parentheses, or the bare name when the index has no space.
 */
function describeCityVillain(G: LegendaryGameState, cityIndex: number, cardId: CardExtId): string {
  // why: WP-884 / D-24835 RS-2 — the space tells two copies of one Villain apart, which matters
  // because some Villains gain Attack per Bystander they hold.
  const name = resolveCardName(G.cardDisplayData, cardId);
  const spaceName = titleCasedSpaceName(cityIndex);
  if (spaceName === undefined) {
    return name;
  }
  return `${name} (${spaceName})`;
}

/**
 * Names the Mastermind (the fightMastermind.ts idiom).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns The Mastermind's display name.
 */
function mastermindName(G: LegendaryGameState): string {
  return resolveCardName(G.cardDisplayData, G.mastermind.baseCardId);
}

/**
 * The index of the last Bystander in the Escape Pile.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns The index, or -1 when the Escape Pile holds no Bystander.
 */
function lastEscapedBystanderIndex(G: LegendaryGameState): number {
  const escapedPile = G.escapedPile ?? [];
  for (let pileIndex = escapedPile.length - 1; pileIndex >= 0; pileIndex--) {
    if (isBystanderCard(G, escapedPile[pileIndex]!)) {
      return pileIndex;
    }
  }
  return -1;
}

/**
 * The Bystanders a City occupant holds.
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The City occupant.
 * @returns Its captured Bystanders, or [] when none.
 */
function cityBystanders(G: LegendaryGameState, cardId: CardExtId): CardExtId[] {
  return G.attachedBystanders?.[cardId] ?? [];
}

/**
 * Builds the KO-mode options: a KO option per Bystander holder, each preceded by its rescue twin
 * when rescue is allowed.
 *
 * @param G - The game state to inspect (not mutated).
 * @param isRescueAllowed - Whether the Tech line added the rescue twins.
 * @returns The options, or [] when no holder has a Bystander.
 */
export function buildKoModeOptions(G: LegendaryGameState, isRescueAllowed: boolean): SeatChoiceOption[] {
  const options: SeatChoiceOption[] = [];
  // why: WP-884 / D-24835 RS-2 — City options come from G.city occupants, never from the
  // G.attachedBystanders keys, so the Mastermind's mirror key is never offered as a City holder.
  for (let cityIndex = 0; cityIndex < G.city.length; cityIndex++) {
    const cardId = G.city[cityIndex];
    if (cardId === null || cardId === undefined || cityBystanders(G, cardId).length === 0) {
      continue;
    }
    const holder = describeCityVillain(G, cityIndex, cardId);
    if (isRescueAllowed) {
      options.push({ label: `Rescue a Bystander held by ${holder}`, huntAction: 'rescue', huntSource: 'city', cityIndex, cardId });
    }
    options.push({ label: `KO a Bystander held by ${holder}`, huntAction: 'ko', huntSource: 'city', cityIndex, cardId });
  }
  if ((G.mastermind.attachedBystanders ?? []).length >= 1) {
    if (isRescueAllowed) {
      options.push({ label: `Rescue a Bystander held by ${mastermindName(G)}`, huntAction: 'rescue', huntSource: 'mastermind' });
    }
    options.push({ label: `KO a Bystander held by ${mastermindName(G)}`, huntAction: 'ko', huntSource: 'mastermind' });
  }
  if (lastEscapedBystanderIndex(G) >= 0) {
    if (isRescueAllowed) {
      options.push({ label: 'Rescue a Bystander from the Escape Pile', huntAction: 'rescue', huntSource: 'escape-pile' });
    }
    options.push({ label: 'KO a Bystander from the Escape Pile', huntAction: 'ko', huntSource: 'escape-pile' });
  }
  return options;
}

/**
 * Builds the capture-mode options: each City occupant, then the Mastermind.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns The options (the Mastermind option is always present).
 */
function buildCaptureModeOptions(G: LegendaryGameState): SeatChoiceOption[] {
  const options: SeatChoiceOption[] = [];
  for (const target of buildHereHoldThisTargets(G)) {
    options.push({
      label: `${describeCityVillain(G, target.cityIndex, target.cardId)} captures a Bystander`,
      huntAction: 'capture',
      huntSource: 'city',
      cityIndex: target.cityIndex,
      cardId: target.cardId,
    });
  }
  options.push({ label: `${mastermindName(G)} captures a Bystander`, huntAction: 'capture', huntSource: 'mastermind' });
  return options;
}

/**
 * Builds the hunt choice's options: KO mode when any holder has a Bystander, else capture mode
 * when the supply is non-empty, then the decline last.
 *
 * @param G - The game state to inspect (not mutated).
 * @param isRescueAllowed - Whether the Tech line added the rescue twins.
 * @returns The options; the last is always "Don't Hunt for Victims".
 */
export function buildHuntForVictimsOptions(G: LegendaryGameState, isRescueAllowed: boolean): SeatChoiceOption[] {
  let options = buildKoModeOptions(G, isRescueAllowed);
  // why: rules v23 L1564-1577 — "If you can't, then this captures a Bystander instead": capture
  // mode only when no holder has a Bystander, and only while the supply has one to capture.
  if (options.length === 0 && G.piles.bystanders.length > 0) {
    options = buildCaptureModeOptions(G);
  }
  // why: "You may": the decline is last and is the timeout / bot default.
  options.push({ label: DECLINE_HUNT_LABEL });
  return options;
}

/**
 * Parks the hunt choice for the player, or logs why nothing opens.
 *
 * @param G - The game state, mutated in place.
 * @param playerID - The player who played the card (the active player).
 * @param sourceCardId - The card played.
 */
export function parkHuntForVictimsChoice(G: LegendaryGameState, playerID: string, sourceCardId: CardExtId): void {
  // why: WP-884 / D-24835 RS-1 — parkSeatChoice overwrites unconditionally, so never park on top of
  // an open seat choice (the D-24761 / Commune posture).
  if (G.pendingSeatChoice !== undefined) {
    pushLog(G, `Player ${playerID} could not Hunt for Victims — another choice is open.`, 'blocked');
    return;
  }
  const cardRef = formatCardRef(G.cardDisplayData, sourceCardId);
  const options = buildHuntForVictimsOptions(G, false);
  // why: RS-1 — only the decline is left when no holder has a Bystander and the supply is empty,
  // so nothing can happen and no choice opens.
  if (options.length === 1) {
    pushLog(G, `Player ${playerID}'s ${cardRef} found no Bystander to Hunt for Victims, and the Bystander supply is empty.`, 'blocked', sourceCardId);
    return;
  }
  // why: the hunting seat is the active player, so no stage ride (events undefined, D-24648).
  parkSeatChoice(G, undefined, {
    kind: HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND,
    addressedSeats: [playerID],
    seatPrompts: { [playerID]: { options } },
    submissions: {},
    // why: "You may": the timeout / autoplay default is the decline (last).
    defaultOptionIndex: options.length - 1,
    huntForVictims: { sourceCardId },
  });
  pushLog(G, `Player ${playerID} must choose whether a Villain or Mastermind Hunts for Victims (${cardRef}).`, 'neutral', sourceCardId);
}

/**
 * Lets the open hunt choice parked by this card also rescue: marks it and rebuilds its options with
 * the rescue twins.
 *
 * @param G - The game state, mutated in place.
 * @param playerID - The player who played the card.
 * @param sourceCardId - The card whose Tech line fired.
 */
export function allowHuntForVictimsRescue(G: LegendaryGameState, playerID: string, sourceCardId: CardExtId): void {
  const choice = G.pendingSeatChoice;
  // why: WP-884 / D-24835 RS-1 — silent no-op when no unsubmitted hunt choice from this card is
  // open for this seat (the hunt line was blocked and already logged why, or a copy replays the
  // card after the choice resolved); a second log line would be noise.
  if (
    choice === undefined ||
    choice.kind !== HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND ||
    choice.addressedSeats[0] !== playerID ||
    choice.submissions[playerID] !== undefined ||
    choice.huntForVictims?.sourceCardId !== sourceCardId
  ) {
    return;
  }
  // why: the park and this rebuild run in the same move, so no client has seen the choice yet.
  // isRescueAllowed is written only as true (exactOptionalPropertyTypes).
  const options = buildHuntForVictimsOptions(G, true);
  choice.huntForVictims = { sourceCardId, isRescueAllowed: true };
  choice.seatPrompts = { [playerID]: { options } };
  choice.defaultOptionIndex = options.length - 1;
}

/**
 * Reads the single addressed seat and its submitted option.
 *
 * @param choice - The fully-submitted pending choice (one addressed seat).
 * @returns The seat and its option, or undefined when nothing valid was submitted.
 */
function readSubmittedOption(choice: PendingSeatChoice): { seat: string; option: SeatChoiceOption } | undefined {
  // why: duplicate-first (00.6) — communeSpiritWorld's readSubmittedOption is private.
  const seat = choice.addressedSeats[0];
  if (seat === undefined) {
    return undefined;
  }
  const submission = choice.submissions[seat];
  if (submission === undefined) {
    return undefined;
  }
  const option = choice.seatPrompts[seat]?.options[submission.optionIndex];
  if (option === undefined) {
    return undefined;
  }
  return { seat, option };
}

/**
 * Whether a KO / rescue option's holder still has a Bystander to take.
 *
 * @param G - The game state to inspect (not mutated).
 * @param option - A hunt option.
 * @returns true when the holder (still the same City occupant) has a Bystander.
 */
export function huntHolderHasBystander(G: LegendaryGameState, option: SeatChoiceOption): boolean {
  if (option.huntSource === 'city') {
    // why: WP-884 / D-24835 RS-7 — the space must still hold the option's Villain.
    if (option.cityIndex === undefined || option.cardId === undefined || G.city[option.cityIndex] !== option.cardId) {
      return false;
    }
    return cityBystanders(G, option.cardId).length > 0;
  }
  if (option.huntSource === 'mastermind') {
    return (G.mastermind.attachedBystanders ?? []).length > 0;
  }
  if (option.huntSource === 'escape-pile') {
    return lastEscapedBystanderIndex(G) >= 0;
  }
  return false;
}

/**
 * Reads, BEFORE the apply, whether the submitted hunt option will KO (or rescue) a Bystander, so
 * the chain offers the Hero pick only then.
 *
 * @param G - The game state to inspect (not mutated).
 * @param choice - The fully-submitted 'hunt-for-victims' choice.
 * @returns true only for a ko / rescue option whose holder still has a Bystander.
 */
export function readHuntForVictimsWillKoBystander(G: LegendaryGameState, choice: PendingSeatChoice): boolean {
  const submitted = readSubmittedOption(choice);
  if (submitted === undefined) {
    return false;
  }
  const huntAction = submitted.option.huntAction;
  if (huntAction !== 'ko' && huntAction !== 'rescue') {
    return false;
  }
  return huntHolderHasBystander(G, submitted.option);
}

/**
 * Names a KO / rescue option's Bystander for the log: "a Bystander held by <holder>" or "a
 * Bystander in the Escape Pile".
 *
 * @param G - The game state to inspect (not mutated).
 * @param option - A hunt option.
 * @returns The phrase.
 */
export function describeHuntedBystander(G: LegendaryGameState, option: SeatChoiceOption): string {
  if (option.huntSource === 'city' && option.cityIndex !== undefined && option.cardId !== undefined) {
    return `a Bystander held by ${describeCityVillain(G, option.cityIndex, option.cardId)}`;
  }
  if (option.huntSource === 'mastermind') {
    return `a Bystander held by ${mastermindName(G)}`;
  }
  return 'a Bystander in the Escape Pile';
}

/**
 * Removes the last occurrence of a Bystander from the Mastermind's mirror entry in
 * G.attachedBystanders, deleting the key when it empties.
 *
 * @param G - The game state, mutated in place.
 * @param bystanderId - The Bystander taken from the Mastermind.
 */
function removeMastermindMirrorCopy(G: LegendaryGameState, bystanderId: CardExtId): void {
  // why: WP-884 / D-24835 RS-3 (PS-1) — a Villain-Deck Bystander revealed into an empty City is
  // written to BOTH G.mastermind.attachedBystanders and G.attachedBystanders[baseCardId]
  // (villainDeck.reveal.ts). The invariant scan skips attachedBystanders, so a stale copy would
  // fail silently; a capture through this module or Here, Hold This writes no copy.
  const mirrorKey = G.mastermind.baseCardId;
  const mirror = G.attachedBystanders?.[mirrorKey];
  if (mirror === undefined) {
    return;
  }
  const mirrorIndex = mirror.lastIndexOf(bystanderId);
  if (mirrorIndex === -1) {
    return;
  }
  const remaining = [...mirror.slice(0, mirrorIndex), ...mirror.slice(mirrorIndex + 1)];
  const attachedBystanders = { ...G.attachedBystanders };
  if (remaining.length > 0) {
    attachedBystanders[mirrorKey] = remaining;
  } else {
    delete attachedBystanders[mirrorKey];
  }
  G.attachedBystanders = attachedBystanders;
}

/**
 * Takes the holder's LAST Bystander off it.
 *
 * @param G - The game state, mutated in place.
 * @param option - A ko / rescue hunt option.
 * @returns The Bystander taken, or undefined (nothing moved) when the option is stale.
 */
export function takeHuntedBystander(G: LegendaryGameState, option: SeatChoiceOption): CardExtId | undefined {
  if (!huntHolderHasBystander(G, option)) {
    return undefined;
  }
  // why: WP-884 / D-24835 RS-3 — the LAST entry (the most recently captured). Every Bystander on G
  // is interchangeable (no special Bystander is modeled); the pick is locked for determinism.
  if (option.huntSource === 'city' && option.cardId !== undefined) {
    const held = cityBystanders(G, option.cardId);
    const attachedBystanders = { ...G.attachedBystanders };
    if (held.length > 1) {
      attachedBystanders[option.cardId] = held.slice(0, -1);
    } else {
      delete attachedBystanders[option.cardId];
    }
    G.attachedBystanders = attachedBystanders;
    return held[held.length - 1];
  }
  if (option.huntSource === 'mastermind') {
    const held = G.mastermind.attachedBystanders ?? [];
    const bystanderId = held[held.length - 1]!;
    G.mastermind = { ...G.mastermind, attachedBystanders: held.slice(0, -1) };
    removeMastermindMirrorCopy(G, bystanderId);
    return bystanderId;
  }
  // why: removing from the Escape Pile has the Fortify precedent (fortify.logic.ts); only the
  // Bystander's index leaves, so the escaped Villains stay.
  const pileIndex = lastEscapedBystanderIndex(G);
  const bystanderId = G.escapedPile[pileIndex]!;
  G.escapedPile = [...G.escapedPile.slice(0, pileIndex), ...G.escapedPile.slice(pileIndex + 1)];
  return bystanderId;
}

/**
 * Applies a capture option: the top supply Bystander goes to the chosen City Villain or the
 * Mastermind.
 *
 * @param G - The game state, mutated in place.
 * @param seat - The hunting seat.
 * @param option - The capture option.
 * @param cardRef - The source card reference for the log.
 */
function applyHuntCapture(G: LegendaryGameState, seat: string, option: SeatChoiceOption, cardRef: string): void {
  if (G.piles.bystanders.length === 0) {
    pushLog(G, `Player ${seat}'s ${cardRef} could not Hunt for Victims — the Bystander supply is empty.`, 'blocked');
    return;
  }
  let hunter = mastermindName(G);
  if (option.huntSource === 'city') {
    // why: WP-884 / D-24835 RS-7 — the space must still hold the option's Villain.
    if (option.cityIndex === undefined || option.cardId === undefined || G.city[option.cityIndex] !== option.cardId) {
      pushLog(G, `Player ${seat}'s ${cardRef} could not Hunt for Victims — that Villain is no longer there.`, 'blocked');
      return;
    }
    hunter = describeCityVillain(G, option.cityIndex, option.cardId);
    const result = attachBystanderToVillain(G.piles.bystanders, option.cardId, G.attachedBystanders);
    G.piles.bystanders = result.bystandersPile;
    G.attachedBystanders = result.attachedBystanders;
  } else {
    // why: a Mastermind capture writes no G.attachedBystanders mirror copy (the Here, Hold This
    // precedent, captureBystanderToMastermind); top of the supply = index 0 (D-21501).
    const bystanderId = G.piles.bystanders[0]!;
    G.piles.bystanders = G.piles.bystanders.slice(1);
    G.mastermind = { ...G.mastermind, attachedBystanders: [...(G.mastermind.attachedBystanders ?? []), bystanderId] };
  }
  pushLog(G, `Player ${seat}'s ${cardRef} Hunted for Victims: no Bystander to KO, so ${hunter} captured a Bystander.`, 'applied');
}

/**
 * Applies a submitted hunt choice: KO or rescue the holder's last Bystander, capture one, or
 * decline. The KO-a-Hero pick chains from resolveSeatChoice, never from here.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted 'hunt-for-victims' seat choice.
 */
export function applyHuntForVictimsResolvedSeatChoice(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const submitted = readSubmittedOption(choice);
  const sourceCardId = choice.huntForVictims?.sourceCardId;
  if (submitted === undefined || sourceCardId === undefined) {
    return;
  }
  const { seat, option } = submitted;
  const cardRef = formatCardRef(G.cardDisplayData, sourceCardId);
  // why: WP-884 / D-24835 — the action is read from the option's fields, never its label or index;
  // the decline (the default) has no huntAction.
  if (option.huntAction === undefined) {
    pushLog(G, `Player ${seat} chose not to Hunt for Victims.`, 'neutral');
    return;
  }
  if (option.huntAction === 'capture') {
    applyHuntCapture(G, seat, option, cardRef);
    return;
  }
  const victory = G.playerZones[seat]?.victory;
  const bystanderPhrase = describeHuntedBystander(G, option);
  const bystanderId = victory === undefined ? undefined : takeHuntedBystander(G, option);
  if (bystanderId === undefined) {
    pushLog(G, `Player ${seat}'s ${cardRef} could not Hunt for Victims — that Bystander is no longer there.`, 'blocked');
    return;
  }
  if (option.huntAction === 'rescue') {
    // why: WP-884 / D-24835 RS-5 — "you may also rescue that Bystander instead of putting it in the
    // KO pile": the Tech line changes where it goes, not whether it was KO'd this way, so the Hero
    // pick still follows. Not added to G.ko; no rescue counter exists on G to update.
    G.playerZones[seat]!.victory = [...G.playerZones[seat]!.victory, bystanderId];
    pushLog(G, `Player ${seat}'s ${cardRef} Hunted for Victims: ${bystanderPhrase} was rescued instead of KO'd.`, 'applied');
    return;
  }
  // why: one Bystander KO site per apply. KOing an escaped Bystander removes it from G.escapedPile,
  // which lowers PAR's derived bystanderLost and Midtown Bank Robbery's carried-away count, as the
  // printed card allows (the Fortify Escape-Pile removal precedent); no scoring weight changes.
  G.ko = koCard(G.ko, bystanderId);
  pushLog(G, `Player ${seat}'s ${cardRef} Hunted for Victims: ${bystanderPhrase} was KO'd.`, 'applied');
}

/**
 * Chains the optional KO-a-Hero pick after a Bystander KO or rescue (live move context), or logs
 * that the hand and discard pile hold no Hero.
 *
 * @param G - The game state, mutated in place.
 * @param seat - The hunting seat (the active player).
 * @param sourceCardId - The card that hunted.
 */
export function chainHuntForVictimsKoHero(G: LegendaryGameState, seat: string, sourceCardId: CardExtId): void {
  const zones = G.playerZones[seat];
  const options: SeatChoiceOption[] = [];
  // why: "a Hero" = a non-Wound card (D-18503); discard pile first, then hand (the
  // buildKoEligibleTargets order). Each option carries sourceZone because ids repeat (S.H.I.E.L.D.
  // Agents) across the two zones.
  for (const target of zones === undefined ? [] : buildKoEligibleTargets(zones, ['discard', 'hand'])) {
    const zoneLabel = target.zone === 'discard' ? 'discard pile' : 'hand';
    options.push({
      label: `KO ${resolveCardName(G.cardDisplayData, target.cardId)} (${zoneLabel})`,
      cardId: target.cardId,
      sourceZone: target.zone,
    });
  }
  if (options.length === 0) {
    pushLog(G, `Player ${seat} had no Hero in hand or discard pile to KO for ${formatCardRef(G.cardDisplayData, sourceCardId)}.`, 'blocked');
    return;
  }
  options.push({ label: DECLINE_KO_HERO_LABEL });
  // why: the hunting seat is the active player, so no stage ride (events undefined, D-24648).
  parkSeatChoice(G, undefined, {
    kind: HUNT_FOR_VICTIMS_KO_HERO_SEAT_CHOICE_KIND,
    addressedSeats: [seat],
    seatPrompts: { [seat]: { options } },
    submissions: {},
    // why: "you may KO a Hero": the timeout / autoplay default is the decline (last).
    defaultOptionIndex: options.length - 1,
    huntForVictims: { sourceCardId },
  });
}

/**
 * Applies a submitted KO-a-Hero pick: KOs the chosen card from its option's zone and records it as
 * an owned KO, or declines.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted 'hunt-for-victims-ko-hero' seat choice.
 */
export function applyHuntForVictimsKoHeroResolvedSeatChoice(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const submitted = readSubmittedOption(choice);
  const sourceCardId = choice.huntForVictims?.sourceCardId;
  if (submitted === undefined || sourceCardId === undefined) {
    return;
  }
  const { seat, option } = submitted;
  const cardId = option.cardId;
  const sourceZone = option.sourceZone;
  const zones = G.playerZones[seat];
  if (cardId === undefined) {
    pushLog(G, `Player ${seat} chose not to KO a Hero.`, 'neutral');
    return;
  }
  if ((sourceZone !== 'hand' && sourceZone !== 'discard') || zones === undefined) {
    return;
  }
  const cardRef = formatCardRef(G.cardDisplayData, sourceCardId);
  const heroName = resolveCardName(G.cardDisplayData, cardId);
  // why: the zone is read from the option, never searched, because ids repeat across zones.
  const removal = moveCardFromZone(zones[sourceZone], [], cardId);
  if (!removal.found) {
    // why: WP-884 / D-24835 RS-7 — the card left its zone while the pick was open; nothing KO'd
    // and no owned-KO record.
    pushLog(G, `Player ${seat} could not KO ${heroName} — it is no longer in ${describeKoSourceZone(sourceZone)} (${cardRef}).`, 'blocked');
    return;
  }
  zones[sourceZone] = removal.from;
  G.ko = koCard(G.ko, cardId);
  // why: WP-853 / D-24789 — a KO from the player's own hand or discard pile is an owned KO, so a
  // waiting Absorb Energies / Possessed by Brother's Spirit grant reacts at the next onMove resolve.
  recordOwnedCardKoed(G, seat, cardId, sourceZone);
  pushLog(G, `Player ${seat} KO'd ${heroName} from ${describeKoSourceZone(sourceZone)} for ${cardRef}.`, 'applied');
}

// ---------------------------------------------------------------------------
// Villain Hunt for Victims (WP-889 / D-24841): Skinner, Meatmarket, Blackout
// ---------------------------------------------------------------------------

/**
 * The default target of a Villain's hunt: the Escape Pile option when present, else the first
 * option.
 *
 * @param options - The KO-mode options (at least one).
 * @returns The default option's index.
 */
function defaultVillainHuntOptionIndex(options: SeatChoiceOption[]): number {
  // why: WP-889 / D-24841 — the default (timeout, autoplay, sim, PAR, bot ally, collision) is the
  // Escape Pile: an escaped Bystander is already lost to the players, while a City or Mastermind
  // Bystander can still be rescued by a fight. Else index 0 (City ascending, then the Mastermind).
  for (let optionIndex = 0; optionIndex < options.length; optionIndex++) {
    if (options[optionIndex]!.huntSource === 'escape-pile') {
      return optionIndex;
    }
  }
  return 0;
}

/**
 * Takes the holder's last Bystander for a Villain's hunt and KOs it (the one villain-hunt KO site).
 *
 * @param G - The game state, mutated in place.
 * @param cardId - The Hunting Villain (for the log).
 * @param option - A KO-mode option whose holder still has a Bystander.
 * @returns true when a Bystander was KO'd; false (nothing moved) when the option is stale.
 */
export function koVillainHuntedBystander(G: LegendaryGameState, cardId: CardExtId, option: SeatChoiceOption): boolean {
  // why: the phrase is read before the take, while the holder still holds the Bystander.
  const bystanderPhrase = describeHuntedBystander(G, option);
  const bystanderId = takeHuntedBystander(G, option);
  if (bystanderId === undefined) {
    return false;
  }
  // why: WP-889 / D-24841 — the one villain-hunt KO site, routed exactly as the hero hunt's KO
  // (applyHuntForVictimsResolvedSeatChoice). A from-play Bystander KO site for D-24839 (WP-887).
  // KOing an escaped Bystander lowers PAR's derived bystanderLost and Midtown Bank Robbery's
  // carried-away count, as the printed card allows; no scoring weight changes.
  G.ko = koCard(G.ko, bystanderId);
  pushLog(G, `${formatCardRef(G.cardDisplayData, cardId)} Hunted for Victims: ${bystanderPhrase} was KO'd.`, 'applied', cardId);
  return true;
}

/**
 * Resolves a Villain's hunt when no holder has a Bystander: "this captures a Bystander instead".
 *
 * @param G - The game state, mutated in place.
 * @param cardId - The Hunting Villain, which captures the top supply Bystander.
 */
export function resolveVillainHuntWithoutChoice(G: LegendaryGameState, cardId: CardExtId): void {
  const cardRef = formatCardRef(G.cardDisplayData, cardId);
  if (G.piles.bystanders.length === 0) {
    pushLog(G, `${cardRef} found no Bystander to Hunt for Victims, and the Bystander supply is empty.`, 'blocked', cardId);
    return;
  }
  // why: WP-889 / D-24841 RS-1 — "this" is the Hunting Villain, so the capture needs no choice; it
  // must still be in the City (G.city.indexOf, the Haunt handler precedent).
  if (G.city.indexOf(cardId) === -1) {
    pushLog(G, `${cardRef} could not capture a Bystander — it is not in the City.`, 'blocked', cardId);
    return;
  }
  // why: top of the supply = index 0 (D-21501), the capture-bystander Ambush template.
  const result = attachBystanderToVillain(G.piles.bystanders, cardId, G.attachedBystanders ?? {});
  G.piles.bystanders = result.bystandersPile;
  G.attachedBystanders = result.attachedBystanders;
  pushLog(G, `${cardRef} Hunted for Victims: no Bystander to KO, so it captured a Bystander.`, 'applied', cardId);
}

/**
 * KOs the default target of a Villain's hunt, or captures when no holder is left.
 *
 * @param G - The game state, mutated in place.
 * @param cardId - The Hunting Villain.
 */
function resolveVillainHuntAtDefault(G: LegendaryGameState, cardId: CardExtId): void {
  const options = buildKoModeOptions(G, false);
  if (options.length === 0) {
    resolveVillainHuntWithoutChoice(G, cardId);
    return;
  }
  koVillainHuntedBystander(G, cardId, options[defaultVillainHuntOptionIndex(options)]!);
}

/**
 * The open seat choice when it is this Villain's own unsubmitted hunt (Blackout's repeat while its
 * first hunt waits).
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The Hunting Villain.
 * @returns The open choice, or undefined when it is absent, another kind, another card's, or answered.
 */
function readOpenOwnVillainHunt(G: LegendaryGameState, cardId: CardExtId): PendingSeatChoice | undefined {
  const choice = G.pendingSeatChoice;
  if (
    choice === undefined ||
    choice.kind !== VILLAIN_HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND ||
    choice.huntForVictims?.sourceCardId !== cardId
  ) {
    return undefined;
  }
  const seat = choice.addressedSeats[0];
  if (seat === undefined || choice.submissions[seat] !== undefined) {
    return undefined;
  }
  return choice;
}

/**
 * A Villain Hunts for Victims (rules v23 L1548-1553): KO a Bystander captured by any Villain or the
 * Mastermind or in the Escape Pile; if it can't, it captures a Bystander instead. Mandatory.
 *
 * @param G - The game state, mutated in place.
 * @param currentPlayer - The active player, who picks the holder when two or more hold one.
 * @param cardId - The Hunting Villain.
 */
export function huntForVictimsForVillain(G: LegendaryGameState, currentPlayer: string, cardId: CardExtId): void {
  const cardRef = formatCardRef(G.cardDisplayData, cardId);
  // why: WP-889 / D-24841 RS-1 step 4 — Blackout's Moonlight repeat while its own first hunt waits:
  // record it on that choice so it runs after the choice resolves (RS-3b), in printed order. Checked
  // first, before any option is built.
  const openOwnHunt = readOpenOwnVillainHunt(G, cardId);
  if (openOwnHunt !== undefined && openOwnHunt.huntForVictims !== undefined) {
    openOwnHunt.huntForVictims = {
      ...openOwnHunt.huntForVictims,
      pendingRepeats: (openOwnHunt.huntForVictims.pendingRepeats ?? 0) + 1,
    };
    pushLog(G, `${cardRef} will Hunt for Victims again after this choice.`, 'neutral', cardId);
    return;
  }
  const options = buildKoModeOptions(G, false);
  if (options.length === 0) {
    resolveVillainHuntWithoutChoice(G, cardId);
    return;
  }
  // why: one holder means no choice to make (the WP-875 / D-24822 lone-option precedent).
  if (options.length === 1) {
    koVillainHuntedBystander(G, cardId, options[0]!);
    return;
  }
  const defaultOptionIndex = defaultVillainHuntOptionIndex(options);
  // why: WP-889 / D-24841 RS-1 step 6 — parkSeatChoice overwrites unconditionally, so an unrelated
  // open choice (a chained reveal) is never overwritten: the mandatory hunt takes its default target.
  if (G.pendingSeatChoice !== undefined) {
    pushLog(G, `${cardRef} Hunted for Victims at its default target — another choice is open.`, 'neutral', cardId);
    koVillainHuntedBystander(G, cardId, options[defaultOptionIndex]!);
    return;
  }
  // why: rules v23 ~L3316-3320 — the player whose turn it is makes the choice; the hunting seat is
  // the active player, so no stage ride (events undefined, D-24648). No decline: no "may".
  parkSeatChoice(G, undefined, {
    kind: VILLAIN_HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND,
    addressedSeats: [currentPlayer],
    seatPrompts: { [currentPlayer]: { options } },
    submissions: {},
    // why: WP-889 / D-24841 — the default is the Escape Pile, else the first option.
    defaultOptionIndex,
    huntForVictims: { sourceCardId: cardId },
  });
  pushLog(G, `Player ${currentPlayer} must choose which Bystander ${cardRef} Hunts.`, 'neutral', cardId);
}

/**
 * Re-locates a submitted City option by its Villain's id (a chained reveal later in the same move
 * can shift it before the prompt is shown). A copy; the shared helpers are unchanged.
 *
 * @param G - The game state to inspect (not mutated).
 * @param option - The submitted option.
 * @returns The option with its current cityIndex, the option itself when not a City option, or
 *   undefined when its Villain is no longer in the City.
 */
function relocateVillainHuntOption(G: LegendaryGameState, option: SeatChoiceOption): SeatChoiceOption | undefined {
  if (option.huntSource !== 'city') {
    return option;
  }
  if (option.cardId === undefined) {
    return undefined;
  }
  const cityIndex = G.city.indexOf(option.cardId);
  if (cityIndex === -1) {
    return undefined;
  }
  return { ...option, cityIndex };
}

/**
 * Applies a submitted villain hunt: KOs the chosen holder's last Bystander, or, when the pick went
 * stale, re-resolves the mandatory hunt at its default (or captures).
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted 'villain-hunt-for-victims' seat choice.
 */
export function applyVillainHuntForVictimsResolvedSeatChoice(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const submitted = readSubmittedOption(choice);
  const sourceCardId = choice.huntForVictims?.sourceCardId;
  if (submitted === undefined || sourceCardId === undefined) {
    return;
  }
  // why: WP-889 / D-24841 RS-3 — the holder is read from the option's fields, never its label or
  // index; a City option is re-located by id first.
  const option = relocateVillainHuntOption(G, submitted.option);
  if (option !== undefined && huntHolderHasBystander(G, option)) {
    koVillainHuntedBystander(G, sourceCardId, option);
    return;
  }
  // why: the hunt is mandatory (no "may"), so a stale pick re-resolves without parking rather than
  // dropping; the hero hunt's stale no-op is unchanged (its line says "may").
  pushLog(G, `${formatCardRef(G.cardDisplayData, sourceCardId)}'s chosen Bystander is no longer there, so it Hunts its default target.`, 'neutral', sourceCardId);
  resolveVillainHuntAtDefault(G, sourceCardId);
}

/**
 * Reads, BEFORE the apply, the further hunts a villain hunt choice owes.
 *
 * @param choice - The fully-submitted seat choice.
 * @returns The seat, the Hunting Villain and the repeats owed, or undefined when none are owed.
 */
export function readVillainHuntRepeats(
  choice: PendingSeatChoice,
): { seat: string; sourceCardId: CardExtId; repeats: number } | undefined {
  if (choice.kind !== VILLAIN_HUNT_FOR_VICTIMS_SEAT_CHOICE_KIND) {
    return undefined;
  }
  const seat = choice.addressedSeats[0];
  const sourceCardId = choice.huntForVictims?.sourceCardId;
  const repeats = choice.huntForVictims?.pendingRepeats ?? 0;
  if (seat === undefined || sourceCardId === undefined || repeats < 1) {
    return undefined;
  }
  return { seat, sourceCardId, repeats };
}

/**
 * Runs the hunts a resolved villain hunt owed (Blackout's Moonlight repeat), in the live move
 * context after the choice is cleared. A run that parks a new choice carries the rest on it.
 *
 * @param G - The game state, mutated in place.
 * @param seat - The active player.
 * @param sourceCardId - The Hunting Villain.
 * @param repeats - The hunts still owed (at least 1).
 */
export function chainVillainHuntRepeats(G: LegendaryGameState, seat: string, sourceCardId: CardExtId, repeats: number): void {
  for (let run = 0; run < repeats; run++) {
    // why: a choice another chain already opened is never this run's park (the hunt then takes its
    // default target, RS-1 step 6), so only a choice that appears during this run stops the loop.
    const wasChoiceOpen = G.pendingSeatChoice !== undefined;
    huntForVictimsForVillain(G, seat, sourceCardId);
    const parked = G.pendingSeatChoice;
    if (wasChoiceOpen || parked === undefined) {
      continue;
    }
    // why: WP-889 / D-24841 RS-3b — this run parked a new holder pick, so the repeats still owed
    // ride on it (omitted when 0) and run after it resolves, in printed order.
    const owed = repeats - run - 1;
    if (owed >= 1 && parked.huntForVictims !== undefined) {
      parked.huntForVictims = { ...parked.huntForVictims, pendingRepeats: owed };
    }
    return;
  }
}

/**
 * Whether a Villain's Ambush carries an UNCONDITIONAL villain-hunt descriptor (no condition, no
 * City-space gate), so the overlay names the hunt only when no gate could skip it.
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The revealed Villain.
 * @returns true when its onAmbush hook has an unconditional `villain-hunt-for-victims` descriptor.
 */
export function villainAmbushHuntsForVictims(G: LegendaryGameState, cardId: CardExtId): boolean {
  // why: WP-889 / D-24841 RS-6 — narrow test states may omit the hook table; read it defensively.
  for (const hook of getVillainHooksForCard(G.villainAbilityHooks ?? [], cardId, 'onAmbush')) {
    for (const descriptor of hook.effects) {
      if (
        descriptor.primitive === 'villain-hunt-for-victims' &&
        descriptor.requireCondition === undefined &&
        descriptor.requireCitySpaces === undefined
      ) {
        return true;
      }
    }
  }
  return false;
}
