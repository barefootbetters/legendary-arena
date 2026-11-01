/**
 * Commune with the Spirit World (WP-860 / D-24796).
 *
 * Doctor Voodoo's "You may discard an [keyword:Artifact] you control or three cards from your
 * hand. If you do, KO a card from your hand or discard pile." resolves through three chained
 * WP-684 seat choices for the active player:
 *
 * 1. `commune-cost` — one option per modeled Artifact the player controls (the WP-858 controlled
 *    record, then Ritual Artifacts played this turn), then "Discard three cards from your hand"
 *    when the hand holds three or more, then "Don't discard" (the default).
 * 2. `commune-discard` — up to three single-card picks, each through `discardFromHand`.
 * 3. `commune-ko` — a mandatory pick over the hand then the discard pile; the card is KO'd and
 *    recorded as an owned KO.
 *
 * The cost choice is parked by the `discard-artifact-or-three-then-ko` hero handler at play; the
 * next step is chained from `resolveSeatChoice`'s live move context, reading its inputs BEFORE the
 * apply (the Crush Pacifist Resistance precedent). Every apply re-checks its card, so a stale option
 * is a logged no-op and nothing is KO'd without payment.
 *
 * No boardgame.io import, no registry, no .reduce(), never throws. Imported bindings are read only
 * inside function bodies (this module sits in import cycles with seatChoice.resolve and
 * heroEffects.execute); the kind constants are string literals.
 */

import type { LegendaryGameState, PendingSeatChoice, SeatChoiceOption } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { discardFromHand } from './discardFromHand.js';
import { parkSeatChoice } from './seatChoice.resolve.js';
import { isRitualArtifact } from './ritualArtifact.js';
import { recordRitualUsedPlayed } from '../economy/economy.logic.js';
import { koCard } from '../board/ko.logic.js';
import { recordOwnedCardKoed } from '../hero/deferredConditionalGrants.js';
import { pushLog } from '../log/logPush.js';
import { describeKoSourceZone, resolveCardName } from '../log/logDisplay.js';

/** The seat-choice kind for Commune's cost choice. */
export const COMMUNE_COST_SEAT_CHOICE_KIND = 'commune-cost';
/** The seat-choice kind for one of Commune's three hand-discard picks. */
export const COMMUNE_DISCARD_SEAT_CHOICE_KIND = 'commune-discard';
/** The seat-choice kind for Commune's mandatory KO pick. */
export const COMMUNE_KO_SEAT_CHOICE_KIND = 'commune-ko';

// why: the printed "three cards from your hand" — the hand size that makes the option available
// and the number of discard picks.
const COMMUNE_DISCARD_COUNT = 3;

/** Which cost the player chose on the Commune cost choice. */
export type CommuneCostBranch = 'artifact' | 'three' | 'decline';

/**
 * Minimal boardgame.io events surface parkSeatChoice reads. Optional: every Commune choice is the
 * active player's own, so no stage ride is needed.
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/**
 * Lists the Artifacts the player controls that Commune may discard: the WP-858 controlled record,
 * then Ritual Artifacts played this turn, distinct, in that order.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player paying the cost.
 * @returns The Artifact ids, or [] when none.
 */
export function communeArtifactOptions(G: LegendaryGameState, playerID: string): CardExtId[] {
  // why: WP-860 / D-24796 RS-2 — rules v23 p.17: you control an Artifact from the moment you play
  // it. Only modeled Ritual Artifacts (WP-858) are Artifacts to the engine; controlled first.
  const artifacts: CardExtId[] = [];
  for (const cardId of G.controlledArtifacts?.[playerID] ?? []) {
    if (!artifacts.includes(cardId)) {
      artifacts.push(cardId);
    }
  }
  for (const cardId of G.playerZones[playerID]?.inPlay ?? []) {
    if (!artifacts.includes(cardId) && isRitualArtifact(G, cardId)) {
      artifacts.push(cardId);
    }
  }
  return artifacts;
}

/**
 * Parks Commune's cost choice for the player, or logs why nothing opens.
 *
 * @param G - The game state, mutated in place.
 * @param playerID - The player who played Commune with the Spirit World.
 * @param sourceCardId - The Commune card played.
 */
export function parkCommuneCostChoice(G: LegendaryGameState, playerID: string, sourceCardId: CardExtId): void {
  // why: WP-860 / D-24796 RS-1 — parkSeatChoice overwrites unconditionally, so never park on top
  // of an open seat choice (two Communes replayed by one Steal Abilities, or Commune beside Here,
  // Hold This / Random Acts in the same executeHeroEffects loop) — the D-24761 posture.
  if (G.pendingSeatChoice !== undefined) {
    pushLog(G, `Player ${playerID} could not Commune with the Spirit World — another choice is open.`, 'blocked');
    return;
  }
  const artifacts = communeArtifactOptions(G, playerID);
  const handSize = G.playerZones[playerID]?.hand.length ?? 0;
  if (artifacts.length === 0 && handSize < COMMUNE_DISCARD_COUNT) {
    pushLog(
      G,
      `Player ${playerID} had no Artifact to discard and fewer than three cards in hand, so Commune with the Spirit World did nothing.`,
      'blocked',
    );
    return;
  }
  const options: SeatChoiceOption[] = [];
  for (const artifactId of artifacts) {
    options.push({ label: `Discard ${resolveCardName(G.cardDisplayData, artifactId)}`, cardId: artifactId });
  }
  if (handSize >= COMMUNE_DISCARD_COUNT) {
    options.push({ label: 'Discard three cards from your hand' });
  }
  options.push({ label: "Don't discard" });
  parkSeatChoice(G, undefined, {
    kind: COMMUNE_COST_SEAT_CHOICE_KIND,
    addressedSeats: [playerID],
    seatPrompts: { [playerID]: { options } },
    submissions: {},
    // why: WP-860 / D-24796 RS-3 — "You may": the timeout / bot default is the decline (last).
    defaultOptionIndex: options.length - 1,
    communeSpiritWorld: { sourceCardId },
  });
}

/**
 * Reads the single addressed seat and its submitted option on a Commune choice.
 *
 * @param choice - The fully-submitted pending choice (one addressed seat).
 * @returns The seat, its option and the option index, or undefined when nothing valid was submitted.
 */
function readSubmittedOption(
  choice: PendingSeatChoice,
): { seat: string; option: SeatChoiceOption; optionIndex: number } | undefined {
  // why: duplicate-first (00.6) — seatChoiceTactics' readAddressedSeatOption is private.
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
  return { seat, option, optionIndex: submission.optionIndex };
}

/**
 * Whether the player still controls the Artifact (controlled record or played this turn).
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The controlling player.
 * @param cardId - The Artifact.
 * @returns true when the card is in the controlled record or in play.
 */
function stillControlsArtifact(G: LegendaryGameState, playerID: string, cardId: CardExtId): boolean {
  if ((G.controlledArtifacts?.[playerID] ?? []).includes(cardId)) {
    return true;
  }
  return (G.playerZones[playerID]?.inPlay ?? []).includes(cardId);
}

/**
 * Reads which cost the submitted Commune cost choice took, by option POSITION, never by label.
 *
 * @param G - The game state to inspect (not mutated).
 * @param choice - The fully-submitted 'commune-cost' choice.
 * @returns The branch, or undefined when nothing valid was submitted or the Artifact left.
 */
export function readCommuneCostBranch(G: LegendaryGameState, choice: PendingSeatChoice): CommuneCostBranch | undefined {
  const submitted = readSubmittedOption(choice);
  if (submitted === undefined) {
    return undefined;
  }
  // why: WP-860 / D-24796 RS-3 — the decline is the option at defaultOptionIndex, an option with a
  // cardId is an Artifact, any other is "three cards". RS-7: an Artifact that left the player's
  // control is no payment, so no branch (and no KO).
  if (submitted.optionIndex === choice.defaultOptionIndex) {
    return 'decline';
  }
  const artifactId = submitted.option.cardId;
  if (artifactId !== undefined) {
    if (stillControlsArtifact(G, submitted.seat, artifactId)) {
      return 'artifact';
    }
    return undefined;
  }
  return 'three';
}

/**
 * Reads how many hand discards remain after the submitted Commune discard pick.
 *
 * @param G - The game state to inspect (not mutated).
 * @param choice - The fully-submitted 'commune-discard' choice.
 * @returns The picks left after this one, or undefined (no chain) when the picked card left the hand.
 */
export function readCommuneDiscardsLeft(G: LegendaryGameState, choice: PendingSeatChoice): number | undefined {
  const submitted = readSubmittedOption(choice);
  const cardId = submitted?.option.cardId;
  if (submitted === undefined || cardId === undefined) {
    return undefined;
  }
  // why: WP-860 / D-24796 RS-7 — a card that left the hand cannot pay, so Commune ends here.
  if (!(G.playerZones[submitted.seat]?.hand ?? []).includes(cardId)) {
    return undefined;
  }
  return (choice.communeSpiritWorld?.discardsRemaining ?? 1) - 1;
}

/**
 * Removes a controlled Artifact from its player's record, deleting the empty key and map.
 *
 * @param G - Game state, mutated in place.
 * @param playerID - The controlling player.
 * @param cardId - The Artifact to remove.
 * @returns true when the card was found and removed.
 */
function removeControlledArtifact(G: LegendaryGameState, playerID: string, cardId: CardExtId): boolean {
  // why: duplicate-first (00.6) — WP-858's removeControlledArtifact is private to ritualArtifact.ts.
  // The empty key and map are deleted so a used-up record leaves no hash surface.
  const controlled = G.controlledArtifacts?.[playerID];
  if (G.controlledArtifacts === undefined || controlled === undefined) {
    return false;
  }
  const removal = moveCardFromZone(controlled, [], cardId);
  if (!removal.found) {
    return false;
  }
  if (removal.from.length > 0) {
    G.controlledArtifacts[playerID] = removal.from;
  } else {
    delete G.controlledArtifacts[playerID];
  }
  if (Object.keys(G.controlledArtifacts).length === 0) {
    delete G.controlledArtifacts;
  }
  return true;
}

/**
 * Applies a submitted Commune cost choice: discards the chosen Artifact, or records the choice.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted 'commune-cost' seat choice.
 */
export function applyCommuneCostResolvedSeatChoice(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const submitted = readSubmittedOption(choice);
  const branch = readCommuneCostBranch(G, choice);
  if (submitted === undefined || branch === undefined) {
    return;
  }
  const { seat, option } = submitted;
  if (branch === 'decline') {
    pushLog(G, `Player ${seat} chose not to Commune with the Spirit World.`, 'neutral');
    return;
  } else if (branch === 'three') {
    pushLog(G, `Player ${seat} chose to discard three cards from their hand (Commune with the Spirit World).`, 'neutral');
    return;
  }
  const artifactId = option.cardId;
  const zones = G.playerZones[seat];
  if (artifactId === undefined || !zones) {
    return;
  }
  // why: WP-860 / D-24796 — discarding an Artifact is the cost, not a Ritual use: no reward, and it
  // is not a discard from hand (cardsDiscardedThisTurn untouched, the useRitualArtifact posture).
  if (!removeControlledArtifact(G, seat, artifactId)) {
    const playResult = moveCardFromZone(zones.inPlay, [], artifactId);
    if (!playResult.found) {
      return;
    }
    zones.inPlay = playResult.from;
    // why: rules v23 L3441-3453 — an Artifact played this turn still counts as played after it
    // leaves play; a controlled Artifact from an earlier turn was not played this turn.
    G.turnEconomy = recordRitualUsedPlayed(G.turnEconomy, artifactId);
  }
  zones.discard = [...zones.discard, artifactId];
  pushLog(
    G,
    `Player ${seat} discarded ${resolveCardName(G.cardDisplayData, artifactId)} to Commune with the Spirit World.`,
    'applied',
  );
}

/**
 * Applies a submitted Commune discard pick: discards the chosen hand card through the chokepoint.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted 'commune-discard' seat choice.
 */
export function applyCommuneDiscardResolvedSeatChoice(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const submitted = readSubmittedOption(choice);
  const cardId = submitted?.option.cardId;
  if (submitted === undefined || cardId === undefined) {
    return;
  }
  // why: every hand discard goes through the chokepoint (cardsDiscardedThisTurn, return-on-discard,
  // teleport-on-discard). RS-7: a card no longer in hand pays nothing and Commune ends.
  if (!discardFromHand(G, submitted.seat, cardId)) {
    pushLog(
      G,
      `Player ${submitted.seat} could not discard ${resolveCardName(G.cardDisplayData, cardId)} — it is no longer in their hand (Commune with the Spirit World).`,
      'blocked',
    );
    return;
  }
  pushLog(
    G,
    `Player ${submitted.seat} discarded ${resolveCardName(G.cardDisplayData, cardId)} (Commune with the Spirit World).`,
    'applied',
  );
}

/**
 * Applies a submitted Commune KO pick: KOs the chosen card from the option's zone and records it as
 * an owned KO.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted 'commune-ko' seat choice.
 */
export function applyCommuneKoResolvedSeatChoice(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const submitted = readSubmittedOption(choice);
  if (submitted === undefined) {
    return;
  }
  const { seat, option } = submitted;
  const cardId = option.cardId;
  const sourceZone = option.sourceZone;
  const zones = G.playerZones[seat];
  if (cardId === undefined || (sourceZone !== 'hand' && sourceZone !== 'discard') || !zones) {
    return;
  }
  // why: WP-860 / D-24796 — the zone is read from the option, because ids repeat (S.H.I.E.L.D.
  // Agents, Wounds) across the hand and the discard pile (the Crush Pacifist Resistance pattern).
  const removal = moveCardFromZone(zones[sourceZone], [], cardId);
  if (!removal.found) {
    // why: RS-7 — the card left its zone while the pick was open (return-on-discard); nothing KO'd.
    pushLog(
      G,
      `Player ${seat} could not KO ${resolveCardName(G.cardDisplayData, cardId)} — it is no longer in ${describeKoSourceZone(sourceZone)} (Commune with the Spirit World).`,
      'blocked',
    );
    return;
  }
  zones[sourceZone] = removal.from;
  G.ko = koCard(G.ko, cardId);
  // why: WP-853 / D-24789 — a KO from the player's own hand or discard pile is an owned KO, so a
  // waiting Absorb Energies / Possessed by Brother's Spirit grant reacts at the next onMove resolve.
  recordOwnedCardKoed(G, seat, cardId, sourceZone);
  pushLog(
    G,
    `Player ${seat} KO'd ${resolveCardName(G.cardDisplayData, cardId)} from ${describeKoSourceZone(sourceZone)} (Commune with the Spirit World).`,
    'applied',
  );
}

/**
 * Builds the options for one Commune discard pick: one per hand card, in hand order.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The discarding player.
 * @returns The options.
 */
function buildDiscardOptions(G: LegendaryGameState, playerID: string): SeatChoiceOption[] {
  const options: SeatChoiceOption[] = [];
  for (const cardId of G.playerZones[playerID]?.hand ?? []) {
    options.push({ label: `Discard ${resolveCardName(G.cardDisplayData, cardId)}`, cardId });
  }
  return options;
}

/**
 * Builds the options for Commune's KO pick: hand cards then discard-pile cards, each (zone, id)
 * pair listed once.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The KOing player.
 * @returns The options, or [] when the hand and discard pile are both empty.
 */
function buildKoOptions(G: LegendaryGameState, playerID: string): SeatChoiceOption[] {
  const zones = G.playerZones[playerID];
  const options: SeatChoiceOption[] = [];
  if (!zones) {
    return options;
  }
  const listedHandIds: CardExtId[] = [];
  for (const cardId of zones.hand) {
    if (listedHandIds.includes(cardId)) {
      continue;
    }
    listedHandIds.push(cardId);
    options.push({ label: `KO ${resolveCardName(G.cardDisplayData, cardId)} (hand)`, cardId, sourceZone: 'hand' });
  }
  const listedDiscardIds: CardExtId[] = [];
  for (const cardId of zones.discard) {
    if (listedDiscardIds.includes(cardId)) {
      continue;
    }
    listedDiscardIds.push(cardId);
    options.push({ label: `KO ${resolveCardName(G.cardDisplayData, cardId)} (discard pile)`, cardId, sourceZone: 'discard' });
  }
  return options;
}

/**
 * Parks Commune's mandatory KO pick, or logs that there is nothing to KO.
 *
 * @param G - The game state, mutated in place.
 * @param playerID - The player who paid the cost.
 * @param sourceCardId - The Commune card.
 * @param events - The move's events (unused for an active-seat park).
 */
function parkCommuneKoChoice(
  G: LegendaryGameState,
  playerID: string,
  sourceCardId: CardExtId,
  events: SeatChoiceEvents | undefined,
): void {
  const options = buildKoOptions(G, playerID);
  if (options.length === 0) {
    // why: WP-860 / D-24796 RS-5 — teleport-on-discard can empty the discard pile after a paid cost.
    pushLog(G, `Player ${playerID} had no card to KO (Commune with the Spirit World).`, 'blocked');
    return;
  }
  parkSeatChoice(G, events, {
    kind: COMMUNE_KO_SEAT_CHOICE_KIND,
    addressedSeats: [playerID],
    seatPrompts: { [playerID]: { options } },
    submissions: {},
    // why: "If you do, KO a card" — mandatory, no decline; the default is the first listed card.
    defaultOptionIndex: 0,
    communeSpiritWorld: { sourceCardId },
  }, playerID);
}

/**
 * Parks one Commune hand-discard pick.
 *
 * @param G - The game state, mutated in place.
 * @param playerID - The discarding player.
 * @param discardsRemaining - How many discards remain including this pick.
 * @param sourceCardId - The Commune card.
 * @param events - The move's events (unused for an active-seat park).
 */
function parkCommuneDiscardChoice(
  G: LegendaryGameState,
  playerID: string,
  discardsRemaining: number,
  sourceCardId: CardExtId,
  events: SeatChoiceEvents | undefined,
): void {
  parkSeatChoice(G, events, {
    kind: COMMUNE_DISCARD_SEAT_CHOICE_KIND,
    addressedSeats: [playerID],
    seatPrompts: { [playerID]: { options: buildDiscardOptions(G, playerID) } },
    submissions: {},
    defaultOptionIndex: 0,
    // why: discardsRemaining is set only on a discard pick (exactOptionalPropertyTypes).
    communeSpiritWorld: { sourceCardId, discardsRemaining },
  }, playerID);
}

/**
 * Chains the next Commune step after the cost choice resolved (live move context).
 *
 * @param G - The game state, mutated in place.
 * @param playerID - The player who chose.
 * @param branch - The cost branch read before the apply.
 * @param sourceCardId - The Commune card.
 * @param events - The move's events.
 */
export function chainCommuneAfterCost(
  G: LegendaryGameState,
  playerID: string,
  branch: CommuneCostBranch,
  sourceCardId: CardExtId,
  events: SeatChoiceEvents | undefined,
): void {
  if (branch === 'artifact') {
    parkCommuneKoChoice(G, playerID, sourceCardId, events);
  } else if (branch === 'three') {
    parkCommuneDiscardChoice(G, playerID, COMMUNE_DISCARD_COUNT, sourceCardId, events);
  }
}

/**
 * Chains the next Commune step after a discard pick resolved (live move context): the next pick
 * while picks remain and the hand is non-empty, else the KO pick.
 *
 * @param G - The game state, mutated in place.
 * @param playerID - The discarding player.
 * @param discardsLeft - The picks left after the resolved one (read before the apply).
 * @param sourceCardId - The Commune card.
 * @param events - The move's events.
 */
export function chainCommuneAfterDiscard(
  G: LegendaryGameState,
  playerID: string,
  discardsLeft: number,
  sourceCardId: CardExtId,
  events: SeatChoiceEvents | undefined,
): void {
  const handSize = G.playerZones[playerID]?.hand.length ?? 0;
  if (discardsLeft > 0 && handSize > 0) {
    parkCommuneDiscardChoice(G, playerID, discardsLeft, sourceCardId, events);
    return;
  }
  parkCommuneKoChoice(G, playerID, sourceCardId, events);
}
