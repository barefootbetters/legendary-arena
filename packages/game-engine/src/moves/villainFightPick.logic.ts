/**
 * Mandarin's Rings cross-player and Villain Deck Fight picks (WP-872 / D-24817).
 *
 * - Liar, The Mento-Intensifier: "Look at the top card of another player's deck. Say it is "Good"
 *   or "Bad." That player chooses to put it in your discard pile or their discard pile."
 * - Nightbringer, The Black Light: "Reveal the top three cards of the Villain Deck. You may defeat
 *   a Villain you revealed worth 2VP or less. (Do its Fight effect.) Put the rest back in any
 *   order."
 * - Remaker, The Matter Rearranger: "You may choose a card from your hand or discard pile. The
 *   player on your right puts it in their hand."
 *
 * The three villain handlers append `{ primitive, playerID, sourceCardId, targetSeat? }` to the
 * lazy G.pendingVillainFightPicks. The play-phase onMove opener (and the rebuilt sim / PAR /
 * fixture loops, which never run onMove) shifts the front entry and parks its first WP-684 seat
 * choice, or logs a no-op and moves on. From then on every step's state lives in the choice's
 * `villainFightPick` payload, so a chain never re-reads the queue.
 *
 * // why: WP-872 / D-24817 — effect in the apply, next park in the chain. Each kind's apply
 * (`applyVillainFightPickResolvedSeatChoice`, dispatched from applySeatChoiceByKind) does the
 * step's own state change with no ctx, so a defaulted choice still moves the card. Parking the
 * next step and Nightbringer's Fight effect run in `chainVillainFightPick`, called from the
 * resolveSeatChoice chain section, because they need the live move's events (a non-active seat
 * rides setActivePlayers), ctx (the turn) and random (the bridges' RevealContext). The timeout path
 * does not chain (the D-24500 / D-24501 residual; that path is not wired live).
 *
 * // why: WP-872 / D-24817 — the hidden card. Liar's looked-at card appears only in the fighter's
 * own 'liar-claim' option labels (the per-seat prompt redaction, D-24501) and the unprojected
 * payload. G.messages is public, so no log line names it, or passes it as the pushLog card
 * argument, until the 'liar-decide' apply has put it in a discard pile.
 *
 * // why: WP-872 / D-24817 — Nightbringer's ruling order (Jeff, 2026-11-07): the chosen Villain
 * goes to the Victory Pile when picked, the fighter then orders the rest back on top of the Villain
 * Deck, and only then does its Fight effect run (rules v23 L5164-5167, Astral Plane L1034-1036).
 *
 * Plain G-mutating helpers; no boardgame.io import, no registry, no .reduce(), never throws.
 */

import type {
  LegendaryGameState,
  PendingSeatChoice,
  PendingVillainFightPick,
  SeatChoiceOption,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
// why: WP-872 / D-24817 — runtime-safe import cycles, the nextHandFromPlay.logic.ts shape:
// seatChoice.resolve imports this module's apply / chain / kind guard while this module imports
// parkSeatChoice from it; and villainEffects.execute (which imports queueVillainFightPick and
// rightNeighborSeat) → this module → fightVillain (resolveVillainDeckDefeatFightEffect,
// routeDefeatedVillainCard) → villainEffects.execute. Every imported binding is read only inside a
// function body, never at module top level, and this module's own constants are literals, so ESM
// resolves each binding by call time.
import { parkSeatChoice } from './seatChoice.resolve.js';
import { hasAnyPendingChoice } from './phaseCard.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef, resolveCardName } from '../log/logDisplay.js';
import { seatsInTurnOrderFrom } from '../turn/seatOrder.logic.js';
import { reshuffleDiscardIntoDeck } from './drawCards.logic.js';
import { moveCardFromZone } from './zoneOps.js';
import { heistRevealedVictoryPoints } from './attemptHeist.js';
import { recordVillainDefeated } from '../economy/economy.logic.js';
import { matchHasFightRestrictionKind } from './villainDefeatRequirement.logic.js';
import { routeDefeatedVillainCard, resolveVillainDeckDefeatFightEffect } from './fightVillain.js';
import { readTurnNumber } from '../villain/villainEffects.execute.js';

/** Liar: the fighter picks which other player's deck to look at (two or more other seats). */
export const LIAR_TARGET_SEAT_CHOICE_KIND = 'liar-target';
/** Liar: the fighter privately sees the card and says "Good" or "Bad". */
export const LIAR_CLAIM_SEAT_CHOICE_KIND = 'liar-claim';
/** Liar: the (non-active) target picks whose discard pile gets the card, without seeing it. */
export const LIAR_DECIDE_SEAT_CHOICE_KIND = 'liar-decide';
/** Nightbringer: the fighter may defeat one revealed Villain worth 2VP or less. */
export const NIGHTBRINGER_DEFEAT_SEAT_CHOICE_KIND = 'nightbringer-defeat';
/** Nightbringer: the fighter orders the remaining revealed cards back on top. */
export const NIGHTBRINGER_ORDER_SEAT_CHOICE_KIND = 'nightbringer-order';
/** Remaker: the fighter may give a hand or discard card to the player on their right. */
export const REMAKER_GIVE_SEAT_CHOICE_KIND = 'remaker-give';

// why: option index = permutation index; index 0 keeps the order as revealed (the default).
/** Every order of two put-back cards, as indexes into the revealed list. */
export const PERMUTATIONS_OF_TWO: readonly (readonly number[])[] = [[0, 1], [1, 0]];
/** Every order of three put-back cards, as indexes into the revealed list. */
export const PERMUTATIONS_OF_THREE: readonly (readonly number[])[] = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
];

/** The six seat-choice kinds this module owns. */
const VILLAIN_FIGHT_PICK_KINDS: readonly string[] = [
  'liar-target', 'liar-claim', 'liar-decide', 'nightbringer-defeat', 'nightbringer-order', 'remaker-give',
];

/** Liar's primitive (the queue key). */
const LIAR_PRIMITIVE: PendingVillainFightPick['primitive'] = 'look-other-player-deck-top-claim-current';
/** Nightbringer's primitive (the queue key). */
const NIGHTBRINGER_PRIMITIVE: PendingVillainFightPick['primitive'] = 'reveal-villain-deck-defeat-low-vp-current';

/** The most printed VP a Villain may have for Nightbringer to defeat it. */
const NIGHTBRINGER_MAX_VICTORY_POINTS = 2;
/** How many Villain Deck cards Nightbringer reveals. */
const NIGHTBRINGER_REVEAL_COUNT = 3;

/** The payload every pick step carries (PendingSeatChoice.villainFightPick). */
type VillainFightPickPayload = NonNullable<PendingSeatChoice['villainFightPick']>;

/**
 * Minimal boardgame.io events surface parkSeatChoice reads. Optional so the rebuilt loops and unit
 * tests (no stage ride) are a guarded no-op.
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/**
 * Whether a seat-choice kind is one of the six Mandarin's Rings pick kinds.
 *
 * @param kind - The seat-choice kind.
 * @returns true for 'liar-target' / 'liar-claim' / 'liar-decide' / 'nightbringer-defeat' /
 *   'nightbringer-order' / 'remaker-give'.
 */
export function isVillainFightPickKind(kind: string): boolean {
  return VILLAIN_FIGHT_PICK_KINDS.includes(kind);
}

/**
 * Records one owed pick for a defeated Liar, Nightbringer or Remaker (each handler's whole job).
 *
 * // why: WP-872 / D-24817 — the villain executor has no boardgame.io events, so it cannot park
 * the seat choice; the pick is queued here and opened by the play-phase onMove opener (the
 * D-24761 / D-24779 precedent). Lazily created at the first write and never seeded, so a match
 * without these cards serializes byte-identically (no hash-oracle re-pin).
 *
 * @param G - The game state, mutated in place (queue appended, lazily created).
 * @param entry - The owed pick.
 */
export function queueVillainFightPick(G: LegendaryGameState, entry: PendingVillainFightPick): void {
  if (G.pendingVillainFightPicks === undefined) {
    G.pendingVillainFightPicks = [];
  }
  G.pendingVillainFightPicks.push({ ...entry });
}

/**
 * The player on a seat's right: the previous seat in turn order.
 *
 * // why: WP-872 / D-24817 — turns go clockwise (rules v23 L524), so the next player is on your
 * left (D-24500) and the previous one on your right; clockwise is ascending seat id (D-24780), so
 * the right neighbour is the last seat of seatsInTurnOrderFrom. A one-seat game has none.
 *
 * @param G - The game state (read for the seats).
 * @param seat - The seat whose right neighbour to find.
 * @returns The right neighbour's seat id, or undefined with one seat.
 */
export function rightNeighborSeat(G: LegendaryGameState, seat: string): string | undefined {
  const seatsInOrder = seatsInTurnOrderFrom(Object.keys(G.playerZones), seat);
  if (seatsInOrder.length < 2) {
    return undefined;
  }
  return seatsInOrder[seatsInOrder.length - 1];
}

/**
 * Opens the front owed pick's first seat choice, resolving every pick that needs no choice (a
 * logged no-op) on the way.
 *
 * Called from the play-phase onMove after every move (and from the rebuilt sim / PAR / fixture
 * loops at the same position). A no-op while any other choice is open or the match is decided.
 * Never shuffles: Liar's empty-deck top-up runs where a shuffle source exists (the handler or the
 * 'liar-target' apply).
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events (passed through to parkSeatChoice).
 * @param currentPlayer - The active player id; that seat is never stage-ridden.
 */
export function openVillainFightPickSeatChoiceIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer?: string,
): void {
  const queue = G.pendingVillainFightPicks;
  if (queue === undefined || isAnotherChoiceOpenOrMatchOver(G)) {
    return;
  }
  let parkedChoice: PendingSeatChoice | undefined;
  while (queue.length > 0 && parkedChoice === undefined) {
    const front = queue.shift()!;
    parkedChoice = buildFirstStepChoice(G, front);
  }
  if (queue.length === 0) {
    delete G.pendingVillainFightPicks;
  }
  if (parkedChoice !== undefined) {
    parkSeatChoice(G, events, parkedChoice, currentPlayer);
  }
}

/**
 * Whether the opener must wait: another choice is open, or the match is already decided.
 *
 * // why: WP-872 / D-24817 — the outOfTimeGrant.logic.ts shape (module-private there, so
 * re-implemented here): never park a pick on top of another open choice, and never after the
 * match ends. hasAnyPendingChoice covers G.pendingSeatChoice but not G.pendingHeroChoice, so both
 * are checked.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the opener must leave the queue for a later move.
 */
function isAnotherChoiceOpenOrMatchOver(G: LegendaryGameState): boolean {
  if (G.pendingSeatChoice !== undefined || hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined) {
    return true;
  }
  return evaluateEndgame(G) !== null;
}

/**
 * Builds an owed pick's first seat choice, or logs why there is nothing to choose.
 *
 * @param G - The game state (logs pushed).
 * @param entry - The owed pick, already shifted off the queue.
 * @returns The choice to park, or undefined when the pick resolved as a logged no-op.
 */
function buildFirstStepChoice(G: LegendaryGameState, entry: PendingVillainFightPick): PendingSeatChoice | undefined {
  if (entry.primitive === LIAR_PRIMITIVE) {
    if (entry.targetSeat === undefined) {
      return buildLiarTargetChoice(G, entry.playerID, entry.sourceCardId);
    }
    return buildLiarLookStep(G, entry.playerID, entry.targetSeat, entry.sourceCardId);
  }
  if (entry.primitive === NIGHTBRINGER_PRIMITIVE) {
    return buildNightbringerRevealStep(G, entry.playerID, entry.sourceCardId);
  }
  if (entry.targetSeat === undefined) {
    return undefined;
  }
  return buildRemakerGiveChoice(G, entry.playerID, entry.targetSeat, entry.sourceCardId);
}

/**
 * Builds a one-seat choice addressed to `seat` (the shape every step shares).
 *
 * @param kind - The seat-choice kind.
 * @param seat - The only addressed seat.
 * @param options - That seat's options.
 * @param payload - The step's state (arrays already copied by the caller).
 * @returns The pending seat choice; the timeout / bot default is option 0.
 */
function buildPickChoice(
  kind: string,
  seat: string,
  options: SeatChoiceOption[],
  payload: VillainFightPickPayload,
): PendingSeatChoice {
  return {
    kind,
    addressedSeats: [seat],
    seatPrompts: { [seat]: { options } },
    submissions: {},
    // why: WP-872 / D-24817 — every default is option 0: Liar's first other seat in turn order,
    // "Good", the fighter's discard pile; Nightbringer's decline and the order as revealed;
    // Remaker's "Give nothing".
    defaultOptionIndex: 0,
    villainFightPick: payload,
  };
}

/**
 * Liar with two or more other seats: the fighter picks the player whose deck to look at.
 *
 * @param G - The game state (read for the seats).
 * @param fighterSeat - The defeating player.
 * @param sourceCardId - The defeated Liar copy.
 * @returns The 'liar-target' choice (one option per other seat, in turn order).
 */
function buildLiarTargetChoice(
  G: LegendaryGameState,
  fighterSeat: string,
  sourceCardId: CardExtId,
): PendingSeatChoice {
  const options: SeatChoiceOption[] = [];
  for (const seat of seatsInTurnOrderFrom(Object.keys(G.playerZones), fighterSeat)) {
    if (seat !== fighterSeat) {
      options.push({ label: `Player ${seat}`, recipientSeat: seat });
    }
  }
  return buildPickChoice(LIAR_TARGET_SEAT_CHOICE_KIND, fighterSeat, options, { sourceCardId, fighterSeat });
}

/**
 * Liar's look step: the fighter privately looks at the target's top card and is asked to claim.
 *
 * // why: the look line passes the source card as its card argument, never the looked-at card,
 * and names no card: G.messages is public. Only the fighter's own option labels name it.
 *
 * @param G - The game state (logs pushed).
 * @param fighterSeat - The defeating player.
 * @param targetSeat - The player whose deck top is looked at.
 * @param sourceCardId - The defeated Liar copy.
 * @returns The 'liar-claim' choice, or undefined (logged) when that deck is empty.
 */
function buildLiarLookStep(
  G: LegendaryGameState,
  fighterSeat: string,
  targetSeat: string,
  sourceCardId: CardExtId,
): PendingSeatChoice | undefined {
  const source = formatCardRef(G.cardDisplayData, sourceCardId);
  const topCardId = G.playerZones[targetSeat]?.deck[0];
  if (topCardId === undefined) {
    pushLog(G, `Player ${targetSeat} has no card on top of their deck to look at (${source}).`, 'blocked', sourceCardId);
    return undefined;
  }
  pushLog(G, `Player ${fighterSeat} looks at the top card of Player ${targetSeat}'s deck (${source}).`, 'neutral', sourceCardId);
  const cardName = resolveCardName(G.cardDisplayData, topCardId);
  const options: SeatChoiceOption[] = [
    { label: `Say "Good" (it is ${cardName})` },
    { label: `Say "Bad" (it is ${cardName})` },
  ];
  return buildPickChoice(LIAR_CLAIM_SEAT_CHOICE_KIND, fighterSeat, options, {
    sourceCardId, fighterSeat, targetSeat, lookedAtCardId: topCardId,
  });
}

/**
 * The claim word a 'liar-claim' / 'liar-decide' step shows.
 *
 * @param claim - The recorded claim.
 * @returns "Good" or "Bad".
 */
function claimWord(claim: 'good' | 'bad' | undefined): string {
  if (claim === 'bad') {
    return 'Bad';
  }
  return 'Good';
}

/**
 * Liar's decide step for the (usually non-active) target: whose discard pile gets the card. The
 * labels carry the claim, never the card.
 *
 * @param payload - The applied 'liar-claim' payload (claim recorded).
 * @returns The 'liar-decide' choice addressed to the target, or undefined without a target.
 */
function buildLiarDecideChoice(payload: VillainFightPickPayload): PendingSeatChoice | undefined {
  const targetSeat = payload.targetSeat;
  if (targetSeat === undefined) {
    return undefined;
  }
  const fighterSeat = payload.fighterSeat;
  const said = `Player ${fighterSeat} says it is "${claimWord(payload.claim)}"`;
  const options: SeatChoiceOption[] = [
    { label: `${said}: put it in Player ${fighterSeat}'s discard pile` },
    { label: `${said}: put it in your discard pile` },
  ];
  return buildPickChoice(LIAR_DECIDE_SEAT_CHOICE_KIND, targetSeat, options, {
    sourceCardId: payload.sourceCardId,
    fighterSeat,
    targetSeat,
    ...(payload.lookedAtCardId !== undefined ? { lookedAtCardId: payload.lookedAtCardId } : {}),
    ...(payload.claim !== undefined ? { claim: payload.claim } : {}),
  });
}

/**
 * Whether a revealed Villain Deck card is a Villain or Henchman worth 2VP or less.
 *
 * // why: WP-872 / D-24817 — Henchmen are Villains (rules v23 L2923); VP is the printed VP the
 * WP-865 Heist reader returns (a converted Skrull / Officer / Micro-Sized card, typed 'villain'
 * with no VP entry, reads the 1-VP fallback and is eligible).
 *
 * @param G - The game state (read only).
 * @param cardId - The revealed card.
 * @returns true when Nightbringer may defeat it.
 */
function isNightbringerEligible(G: LegendaryGameState, cardId: CardExtId): boolean {
  const cardType = G.villainDeckCardTypes?.[cardId];
  if (cardType !== 'villain' && cardType !== 'henchman') {
    return false;
  }
  return heistRevealedVictoryPoints(G, cardId) <= NIGHTBRINGER_MAX_VICTORY_POINTS;
}

/**
 * Nightbringer's reveal: log the top three, then ask for a defeat, or go straight to the order.
 *
 * @param G - The game state (logs pushed).
 * @param fighterSeat - The defeating player.
 * @param sourceCardId - The defeated Nightbringer copy.
 * @returns The 'nightbringer-defeat' or 'nightbringer-order' choice, or undefined (logged).
 */
function buildNightbringerRevealStep(
  G: LegendaryGameState,
  fighterSeat: string,
  sourceCardId: CardExtId,
): PendingSeatChoice | undefined {
  const source = formatCardRef(G.cardDisplayData, sourceCardId);
  const revealed = G.villainDeck.deck.slice(0, NIGHTBRINGER_REVEAL_COUNT);
  if (revealed.length === 0) {
    pushLog(G, `The Villain Deck is empty; there is nothing to reveal (${source}).`, 'blocked', sourceCardId);
    return undefined;
  }
  const revealedList = revealed.map((cardId) => formatCardRef(G.cardDisplayData, cardId)).join(', ');
  pushLog(G, `Player ${fighterSeat} revealed ${revealedList} from the top of the Villain Deck (${source}).`, 'neutral', sourceCardId);
  const options: SeatChoiceOption[] = [{ label: `Don't defeat a Villain` }];
  for (const cardId of revealed) {
    if (isNightbringerEligible(G, cardId)) {
      const victoryPoints = heistRevealedVictoryPoints(G, cardId);
      options.push({ label: `Defeat ${resolveCardName(G.cardDisplayData, cardId)} (${victoryPoints} VP)`, cardId });
    }
  }
  if (options.length > 1) {
    return buildPickChoice(NIGHTBRINGER_DEFEAT_SEAT_CHOICE_KIND, fighterSeat, options, {
      sourceCardId, fighterSeat, revealedCardIds: [...revealed],
    });
  }
  pushLog(G, `None of the revealed cards is a Villain worth 2VP or less (${source}).`, 'neutral', sourceCardId);
  return buildNightbringerOrderChoice(G, { sourceCardId, fighterSeat, revealedCardIds: [...revealed] });
}

/**
 * The put-back orders for `count` cards, or undefined when there is nothing to order.
 *
 * @param count - How many revealed cards are still on top.
 * @returns PERMUTATIONS_OF_TWO, PERMUTATIONS_OF_THREE, or undefined.
 */
function permutationsFor(count: number): readonly (readonly number[])[] | undefined {
  if (count === 2) {
    return PERMUTATIONS_OF_TWO;
  }
  if (count === 3) {
    return PERMUTATIONS_OF_THREE;
  }
  return undefined;
}

/**
 * Nightbringer's order step over the revealed cards still on top (two or three of them).
 *
 * @param G - The game state (read for the names).
 * @param payload - The step's state; `revealedCardIds` lists the cards in deck order and
 *   `defeatedCardId` is kept when set.
 * @returns The 'nightbringer-order' choice, or undefined with fewer than two cards.
 */
function buildNightbringerOrderChoice(
  G: LegendaryGameState,
  payload: VillainFightPickPayload,
): PendingSeatChoice | undefined {
  const revealedCardIds = [...(payload.revealedCardIds ?? [])];
  const permutations = permutationsFor(revealedCardIds.length);
  if (permutations === undefined) {
    return undefined;
  }
  const options: SeatChoiceOption[] = [];
  for (const permutation of permutations) {
    const names = permutation.map((index) => resolveCardName(G.cardDisplayData, revealedCardIds[index]!));
    options.push({ label: `Top to bottom: ${names.join(', ')}` });
  }
  return buildPickChoice(NIGHTBRINGER_ORDER_SEAT_CHOICE_KIND, payload.fighterSeat, options, {
    sourceCardId: payload.sourceCardId,
    fighterSeat: payload.fighterSeat,
    revealedCardIds,
    ...(payload.defeatedCardId !== undefined ? { defeatedCardId: payload.defeatedCardId } : {}),
  });
}

/**
 * Remaker's give step: the fighter's hand cards, then discard cards, each id once per zone.
 *
 * @param G - The game state (logs pushed).
 * @param fighterSeat - The defeating player.
 * @param targetSeat - The right neighbour who puts the card in their hand.
 * @param sourceCardId - The defeated Remaker copy.
 * @returns The 'remaker-give' choice, or undefined (logged) with no card to give.
 */
function buildRemakerGiveChoice(
  G: LegendaryGameState,
  fighterSeat: string,
  targetSeat: string,
  sourceCardId: CardExtId,
): PendingSeatChoice | undefined {
  const zones = G.playerZones[fighterSeat];
  const options: SeatChoiceOption[] = [{ label: 'Give nothing' }];
  appendRemakerZoneOptions(G, options, zones?.hand ?? [], 'hand');
  appendRemakerZoneOptions(G, options, zones?.discard ?? [], 'discard');
  if (options.length === 1) {
    const source = formatCardRef(G.cardDisplayData, sourceCardId);
    pushLog(G, `Player ${fighterSeat} has no card in their hand or discard pile to give (${source}).`, 'blocked', sourceCardId);
    return undefined;
  }
  return buildPickChoice(REMAKER_GIVE_SEAT_CHOICE_KIND, fighterSeat, options, { sourceCardId, fighterSeat, targetSeat });
}

/**
 * Appends one Remaker option per distinct card id in a zone (the first instance).
 *
 * @param G - The game state (read for the names).
 * @param options - The option list, appended in place.
 * @param zoneCards - The zone's cards in order.
 * @param sourceZone - Which zone they come from.
 */
function appendRemakerZoneOptions(
  G: LegendaryGameState,
  options: SeatChoiceOption[],
  zoneCards: readonly CardExtId[],
  sourceZone: 'hand' | 'discard',
): void {
  const listed: CardExtId[] = [];
  for (const cardId of zoneCards) {
    if (listed.includes(cardId)) {
      continue;
    }
    listed.push(cardId);
    options.push({ label: `${resolveCardName(G.cardDisplayData, cardId)} (${zoneLabel(sourceZone)})`, cardId, sourceZone });
  }
}

/**
 * The player-facing name of a Remaker source zone.
 *
 * @param sourceZone - The zone.
 * @returns "hand" or "discard pile".
 */
function zoneLabel(sourceZone: 'hand' | 'inPlay' | 'discard' | undefined): string {
  if (sourceZone === 'discard') {
    return 'discard pile';
  }
  return 'hand';
}

/**
 * The option a seat chose on a fully-submitted one-seat pick choice.
 *
 * @param choice - The resolved choice.
 * @returns The chosen option index and option, or undefined when nothing was submitted.
 */
function readChosenOption(choice: PendingSeatChoice): { index: number; option: SeatChoiceOption } | undefined {
  const seat = choice.addressedSeats[0];
  if (seat === undefined) {
    return undefined;
  }
  const submission = choice.submissions[seat];
  const option = submission === undefined ? undefined : choice.seatPrompts[seat]?.options[submission.optionIndex];
  if (submission === undefined || option === undefined) {
    return undefined;
  }
  return { index: submission.optionIndex, option };
}

/**
 * Applies one fully-submitted pick step: the step's own state change, with no ctx.
 *
 * Writes the step's result onto the choice's payload (Liar's target and claim, Nightbringer's
 * defeated card and the cards left) for the chain to read.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted pick choice (one of the six kinds).
 * @param shuffleContext - The live move's shuffle source, or undefined (timeout path).
 */
export function applyVillainFightPickResolvedSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  shuffleContext: ShuffleProvider | undefined,
): void {
  const payload = choice.villainFightPick;
  const chosen = readChosenOption(choice);
  if (payload === undefined || chosen === undefined) {
    return;
  }
  if (choice.kind === LIAR_TARGET_SEAT_CHOICE_KIND) {
    applyLiarTarget(G, payload, chosen.option, shuffleContext);
  } else if (choice.kind === LIAR_CLAIM_SEAT_CHOICE_KIND) {
    applyLiarClaim(G, payload, chosen.index);
  } else if (choice.kind === LIAR_DECIDE_SEAT_CHOICE_KIND) {
    applyLiarDecide(G, payload, chosen.index);
  } else if (choice.kind === NIGHTBRINGER_DEFEAT_SEAT_CHOICE_KIND) {
    applyNightbringerDefeat(G, payload, chosen.option);
  } else if (choice.kind === NIGHTBRINGER_ORDER_SEAT_CHOICE_KIND) {
    applyNightbringerOrder(G, payload, chosen.index);
  } else if (choice.kind === REMAKER_GIVE_SEAT_CHOICE_KIND) {
    applyRemakerGive(G, payload, chosen.option);
  }
}

/**
 * 'liar-target': records the chosen player and tops up their empty deck from their discard.
 *
 * // why: D-24285 — a short deck tops up from the discard before a look; the shuffle source is
 * here (the live move's random), never in the opener.
 *
 * @param G - The game state, mutated in place.
 * @param payload - The applied choice's payload (targetSeat written).
 * @param option - The chosen option (its recipientSeat).
 * @param shuffleContext - The live move's shuffle source, or undefined.
 */
function applyLiarTarget(
  G: LegendaryGameState,
  payload: VillainFightPickPayload,
  option: SeatChoiceOption,
  shuffleContext: ShuffleProvider | undefined,
): void {
  const targetSeat = option.recipientSeat;
  if (targetSeat === undefined) {
    return;
  }
  payload.targetSeat = targetSeat;
  const targetZones = G.playerZones[targetSeat];
  if (targetZones !== undefined && targetZones.deck.length === 0) {
    reshuffleDiscardIntoDeck(targetZones, shuffleContext);
  }
}

/**
 * 'liar-claim': records and logs the fighter's "Good" / "Bad" claim (never the card).
 *
 * @param G - The game state (log pushed).
 * @param payload - The applied choice's payload (claim written).
 * @param optionIndex - 0 = "Good", 1 = "Bad".
 */
function applyLiarClaim(G: LegendaryGameState, payload: VillainFightPickPayload, optionIndex: number): void {
  let claim: 'good' | 'bad' = 'good';
  if (optionIndex === 1) {
    claim = 'bad';
  }
  payload.claim = claim;
  const source = formatCardRef(G.cardDisplayData, payload.sourceCardId);
  pushLog(G,
    `Player ${payload.fighterSeat} says the top card of Player ${payload.targetSeat}'s deck is "${claimWord(claim)}" (${source}).`,
    'neutral',
    payload.sourceCardId,
  );
}

/**
 * 'liar-decide': the target puts the looked-at card in the fighter's (0) or their own (1) discard.
 *
 * // why: a card that is no longer on top (the deck changed under the choice) is never moved or
 * named: the stale line names only the source.
 *
 * @param G - The game state, mutated in place.
 * @param payload - The applied choice's payload.
 * @param optionIndex - 0 = the fighter's discard pile, 1 = the target's own.
 */
function applyLiarDecide(G: LegendaryGameState, payload: VillainFightPickPayload, optionIndex: number): void {
  const targetSeat = payload.targetSeat;
  const lookedAtCardId = payload.lookedAtCardId;
  const fighterSeat = payload.fighterSeat;
  const source = formatCardRef(G.cardDisplayData, payload.sourceCardId);
  const targetZones = targetSeat === undefined ? undefined : G.playerZones[targetSeat];
  if (targetZones === undefined || lookedAtCardId === undefined || targetZones.deck[0] !== lookedAtCardId) {
    pushLog(G, `The top card of Player ${targetSeat}'s deck changed; nothing is put in a discard pile (${source}).`, 'neutral', payload.sourceCardId);
    return;
  }
  const recipientZones = optionIndex === 0 ? G.playerZones[fighterSeat] : targetZones;
  if (recipientZones === undefined) {
    return;
  }
  const moved = moveCardFromZone(targetZones.deck, recipientZones.discard, lookedAtCardId);
  targetZones.deck = moved.from;
  recipientZones.discard = moved.to;
  const card = formatCardRef(G.cardDisplayData, lookedAtCardId);
  let message = `Player ${targetSeat} put ${card} in their own discard pile (${source}).`;
  if (optionIndex === 0) {
    message = `Player ${targetSeat} put ${card} in Player ${fighterSeat}'s discard pile (${source}).`;
  }
  pushLog(G, message, 'applied', lookedAtCardId);
}

/**
 * Whether the Villain Deck's top cards are exactly `cardIds`, in order.
 *
 * @param G - The game state (read only).
 * @param cardIds - The expected top cards.
 * @returns true when the top `cardIds.length` cards match in order.
 */
function villainDeckTopEquals(G: LegendaryGameState, cardIds: readonly CardExtId[]): boolean {
  const top = G.villainDeck.deck.slice(0, cardIds.length);
  if (top.length !== cardIds.length) {
    return false;
  }
  for (let i = 0; i < cardIds.length; i += 1) {
    if (top[i] !== cardIds[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Removes the first instance of `cardId` from a list.
 *
 * @param cardIds - The list (not mutated).
 * @param cardId - The id to drop once.
 * @returns A new list without that one instance.
 */
function withoutFirstInstance(cardIds: readonly CardExtId[], cardId: CardExtId): CardExtId[] {
  const remaining: CardExtId[] = [];
  let isRemoved = false;
  for (const listedCardId of cardIds) {
    if (!isRemoved && listedCardId === cardId) {
      isRemoved = true;
      continue;
    }
    remaining.push(listedCardId);
  }
  return remaining;
}

/**
 * 'nightbringer-defeat': defeats the chosen revealed Villain (or declines).
 *
 * // why: WP-872 / D-24817 — a free defeat: no fight cost, and defeat requirements and fight
 * restrictions are not checked (D-24737, the Silent Sniper / Cruel Ruler precedent). It records
 * the WP-871 "defeated a Villain this turn" flag lazily, as the City core does, and routes the
 * card through the shared routeDefeatedVillainCard (Victory Pile, or a converted card home).
 *
 * @param G - The game state, mutated in place.
 * @param payload - The applied choice's payload (defeatedCardId and revealedCardIds written).
 * @param option - The chosen option (option 0 has no cardId: decline).
 */
function applyNightbringerDefeat(G: LegendaryGameState, payload: VillainFightPickPayload, option: SeatChoiceOption): void {
  const revealedCardIds = payload.revealedCardIds ?? [];
  const fighterSeat = payload.fighterSeat;
  const source = formatCardRef(G.cardDisplayData, payload.sourceCardId);
  if (!villainDeckTopEquals(G, revealedCardIds)) {
    pushLog(G, `The revealed cards are no longer on top of the Villain Deck; nothing is defeated or put back (${source}).`, 'neutral', payload.sourceCardId);
    return;
  }
  const cardId = option.cardId;
  if (cardId === undefined) {
    pushLog(G, `Player ${fighterSeat} chose not to defeat a revealed Villain (${source}).`, 'neutral', payload.sourceCardId);
    return;
  }
  G.villainDeck.deck = withoutFirstInstance(G.villainDeck.deck, cardId);
  if (matchHasFightRestrictionKind(G, 'requires-villain-defeated-this-turn')) {
    G.turnEconomy = recordVillainDefeated(G.turnEconomy);
  }
  pushLog(G, `Player ${fighterSeat} defeated ${formatCardRef(G.cardDisplayData, cardId)} from the Villain Deck (${source}).`, 'applied', cardId);
  // why: `stackBystandersRescued` is not read: a WP-869 Splintered Half-Groot token enters only the
  // City, never the Villain Deck, so Nightbringer cannot reveal one and the count is always 0 here.
  const routing = routeDefeatedVillainCard(G, fighterSeat, cardId);
  // why: the routing returns a converted card's gain line for the caller to log after its own
  // defeat line (the gain-order fix, operator match 8eURMq6tTSS).
  if (routing.gainedHeroLogLine !== null) {
    pushLog(G, routing.gainedHeroLogLine.message, routing.gainedHeroLogLine.outcome, routing.gainedHeroLogLine.card);
  }
  payload.defeatedCardId = cardId;
  payload.revealedCardIds = withoutFirstInstance(revealedCardIds, cardId);
}

/**
 * Whether `topCardIds` holds exactly the cards of `revealedCardIds` in some order.
 *
 * @param topCardIds - The Villain Deck's current top cards.
 * @param revealedCardIds - The revealed cards still owed a put-back.
 * @returns true when both hold the same cards (with multiplicity).
 */
function isPermutationOf(topCardIds: readonly CardExtId[], revealedCardIds: readonly CardExtId[]): boolean {
  if (topCardIds.length !== revealedCardIds.length) {
    return false;
  }
  let unmatched = [...revealedCardIds];
  for (const cardId of topCardIds) {
    if (!unmatched.includes(cardId)) {
      return false;
    }
    unmatched = withoutFirstInstance(unmatched, cardId);
  }
  return true;
}

/**
 * 'nightbringer-order': writes the chosen order over the top of the Villain Deck.
 *
 * @param G - The game state, mutated in place.
 * @param payload - The applied choice's payload.
 * @param optionIndex - The chosen permutation's index.
 */
function applyNightbringerOrder(G: LegendaryGameState, payload: VillainFightPickPayload, optionIndex: number): void {
  const revealedCardIds = payload.revealedCardIds ?? [];
  const count = revealedCardIds.length;
  const source = formatCardRef(G.cardDisplayData, payload.sourceCardId);
  const permutation = permutationsFor(count)?.[optionIndex];
  if (permutation === undefined || !isPermutationOf(G.villainDeck.deck.slice(0, count), revealedCardIds)) {
    pushLog(G, `The revealed cards are no longer all on top of the Villain Deck; nothing to put back in order (${source}).`, 'neutral', payload.sourceCardId);
    return;
  }
  const orderedTop: CardExtId[] = [];
  for (const index of permutation) {
    orderedTop.push(revealedCardIds[index]!);
  }
  G.villainDeck.deck = [...orderedTop, ...G.villainDeck.deck.slice(count)];
  pushLog(G,
    `Player ${payload.fighterSeat} put the other ${count} revealed cards back on top of the Villain Deck in the order they chose (${source}).`,
    'neutral',
    payload.sourceCardId,
  );
}

/**
 * 'remaker-give': moves the chosen hand or discard card to the right neighbour's hand (or not).
 *
 * // why: WP-872 / D-24817 — a hand-to-hand move through moveCardFromZone, not a gain, so no gain
 * reaction fires; the card is public once given, so the line names it (the D-24500 Random Acts
 * precedent).
 *
 * @param G - The game state, mutated in place.
 * @param payload - The applied choice's payload.
 * @param option - The chosen option (option 0 has no cardId: give nothing).
 */
function applyRemakerGive(G: LegendaryGameState, payload: VillainFightPickPayload, option: SeatChoiceOption): void {
  const fighterSeat = payload.fighterSeat;
  const source = formatCardRef(G.cardDisplayData, payload.sourceCardId);
  const cardId = option.cardId;
  if (cardId === undefined) {
    pushLog(G, `Player ${fighterSeat} chose not to give a card (${source}).`, 'neutral', payload.sourceCardId);
    return;
  }
  const fighterZones = G.playerZones[fighterSeat];
  const recipientZones = payload.targetSeat === undefined ? undefined : G.playerZones[payload.targetSeat];
  const fromZone = option.sourceZone === 'discard' ? fighterZones?.discard : fighterZones?.hand;
  if (fighterZones === undefined || recipientZones === undefined || fromZone === undefined || !fromZone.includes(cardId)) {
    pushLog(G, `The chosen card is no longer in Player ${fighterSeat}'s ${zoneLabel(option.sourceZone)}; nothing is given (${source}).`, 'neutral', payload.sourceCardId);
    return;
  }
  const moved = moveCardFromZone(fromZone, recipientZones.hand, cardId);
  if (option.sourceZone === 'discard') {
    fighterZones.discard = moved.from;
  } else {
    fighterZones.hand = moved.from;
  }
  recipientZones.hand = moved.to;
  pushLog(G,
    `Player ${fighterSeat} gave ${formatCardRef(G.cardDisplayData, cardId)} to Player ${payload.targetSeat}, who put it in their hand (${source}).`,
    'applied',
    cardId,
  );
}

/**
 * Chains the next pick step after an applied one, in the live move context.
 *
 * Liar's target pick → the look step; Liar's claim → the target's decide (a non-active seat rides
 * setActivePlayers); Nightbringer's defeat → the order step, or the Fight effect; Nightbringer's
 * order → the Fight effect. Liar's decide and Remaker's give chain nothing.
 *
 * // why: WP-872 / D-24817 — the Fight effect runs with `{ currentPlayer: fighterSeat, turn }`,
 * never the raw move ctx, so a missing ctx cannot throw (D-24732) and a sim acting-seat ctx cannot
 * misattribute the defeat.
 *
 * @param G - The game state, mutated in place.
 * @param appliedChoice - The applied choice (captured before G.pendingSeatChoice was deleted).
 * @param ctx - The live move's ctx (read for the active player and the turn), or undefined.
 * @param events - The live move's events (the non-active seat's stage ride), or undefined.
 * @param random - The live move's random (the Fight effect's shuffle source), or undefined.
 */
export function chainVillainFightPick(
  G: LegendaryGameState,
  appliedChoice: PendingSeatChoice,
  ctx: { currentPlayer?: string; turn?: number } | undefined,
  events: SeatChoiceEvents | undefined,
  random: ShuffleProvider['random'] | undefined,
): void {
  const payload = appliedChoice.villainFightPick;
  if (payload === undefined) {
    return;
  }
  let nextChoice: PendingSeatChoice | undefined;
  if (appliedChoice.kind === LIAR_TARGET_SEAT_CHOICE_KIND && payload.targetSeat !== undefined) {
    nextChoice = buildLiarLookStep(G, payload.fighterSeat, payload.targetSeat, payload.sourceCardId);
  } else if (appliedChoice.kind === LIAR_CLAIM_SEAT_CHOICE_KIND) {
    nextChoice = buildLiarDecideChoice(payload);
  } else if (appliedChoice.kind === NIGHTBRINGER_DEFEAT_SEAT_CHOICE_KIND) {
    nextChoice = chainAfterNightbringerDefeat(G, payload, ctx, random);
  } else if (appliedChoice.kind === NIGHTBRINGER_ORDER_SEAT_CHOICE_KIND) {
    runNightbringerFightEffect(G, payload, ctx, random);
  }
  if (nextChoice !== undefined) {
    parkSeatChoice(G, events, nextChoice, ctx?.currentPlayer);
  }
}

/**
 * After Nightbringer's defeat step: the order step when two or more revealed cards remain, else
 * the defeated Villain's Fight effect. Nothing on drift.
 *
 * @param G - The game state, mutated in place.
 * @param payload - The applied defeat payload (post-apply revealedCardIds / defeatedCardId).
 * @param ctx - The live move's ctx, or undefined.
 * @param random - The live move's random, or undefined.
 * @returns The order choice to park, or undefined.
 */
function chainAfterNightbringerDefeat(
  G: LegendaryGameState,
  payload: VillainFightPickPayload,
  ctx: { currentPlayer?: string; turn?: number } | undefined,
  random: ShuffleProvider['random'] | undefined,
): PendingSeatChoice | undefined {
  // why: true after a defeat (the card left both lists) and after a decline; false only when the
  // deck changed under the choice, and then the apply already logged that nothing happens.
  if (!villainDeckTopEquals(G, payload.revealedCardIds ?? [])) {
    return undefined;
  }
  if ((payload.revealedCardIds ?? []).length >= 2) {
    return buildNightbringerOrderChoice(G, payload);
  }
  runNightbringerFightEffect(G, payload, ctx, random);
  return undefined;
}

/**
 * Runs the Villain Nightbringer defeated's Fight effect, when one was defeated.
 *
 * @param G - The game state, mutated in place.
 * @param payload - The payload carrying defeatedCardId.
 * @param ctx - The live move's ctx (read for the turn), or undefined.
 * @param random - The live move's random, or undefined.
 */
function runNightbringerFightEffect(
  G: LegendaryGameState,
  payload: VillainFightPickPayload,
  ctx: { currentPlayer?: string; turn?: number } | undefined,
  random: ShuffleProvider['random'] | undefined,
): void {
  const defeatedCardId = payload.defeatedCardId;
  // why: resolveSeatChoice always holds random; a context without one (never live) runs no Fight
  // effect rather than build a RevealContext that would throw (moves never throw).
  if (defeatedCardId === undefined || random === undefined) {
    return;
  }
  const fightContext = { currentPlayer: payload.fighterSeat, turn: readTurnNumber(ctx) };
  resolveVillainDeckDefeatFightEffect(G, fightContext, defeatedCardId, { random });
}
