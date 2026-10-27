/**
 * Reactive Flying-Shield-Block wound interception (WP-827 / D-24760).
 *
 * Captain America (Falcon)'s Flying Shield Block — "Once per turn, if a player would gain a
 * Wound, you may reveal this card and rescue a Bystander instead." — is the Diving Block
 * (WP-682 / D-24499) shape with three differences:
 *  - the seat that may reveal is any seat holding the card, not only the wound recipient;
 *  - each copy may be revealed once per turn (G.flyingShieldBlockUsedThisTurn, cleared at
 *    turn start);
 *  - the reward is a Bystander rescued by the revealing seat.
 *
 * It rides the same land-then-offer-undo chokepoint: the Wound lands in the recipient's
 * discard, then `checkFlyingShieldBlock` parks one entry per Wound
 * (G.pendingFlyingShieldBlockWounds) listing the seats that could reveal: the recipient first,
 * then the other seats in ascending order. The recipient's own Diving Block is offered first:
 * the chokepoint parks a Flying Shield Block entry only when no Diving Block entry was parked,
 * and a declined Diving Block parks one then. So a Wound never has two open interceptions.
 * Each wave (a WP-684 seat choice, kind 'flying-shield-block') asks each addressed seat about
 * one Wound; a decline passes that Wound to its next candidate, and the recipient keeps it
 * when none is left. Waves open only after every Diving Block Wound has resolved.
 *
 * Plain G-mutating helpers called from the chokepoint, the Diving Block decline, the
 * play-phase onMove wave-opener and resolveSeatChoice. NOT boardgame.io moves. No registry
 * imports. No .reduce(). Never throws.
 */

import type { LegendaryGameState, PendingSeatChoice, PendingFlyingShieldBlockWound } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { getHooksForCard } from '../rules/heroAbility.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { parkSeatChoice } from './seatChoice.resolve.js';
import { pushLog } from '../log/logPush.js';

/** The seat-choice kind discriminant for a Flying-Shield-Block reveal/decline wave. */
export const FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND = 'flying-shield-block';

// why: WP-827 / D-24760 — the reveal option is index 0 and the decline index 1, the Diving
// Block layout. The disconnect/timeout default is DECLINE: an absent seat never reveals
// (the Wound passes to its next candidate, or stays with its recipient).
export const FLYING_SHIELD_BLOCK_REVEAL_OPTION_INDEX = 0;
const FLYING_SHIELD_BLOCK_DECLINE_OPTION_INDEX = 1;

/**
 * Minimal boardgame.io events surface the wave-opener needs (setActivePlayers via
 * parkSeatChoice). Optional so a unit/replay context without a live framework is a no-op.
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/**
 * Whether a card carries the reactive `flying-shield-block` keyword.
 *
 * // why: WP-827 / D-24760 — keys on the KEYWORD, exactly like cardCarriesDivingBlock. The
 * Array.isArray guard covers minimal test states that omit G.heroAbilityHooks.
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The card whose hooks are scanned.
 * @returns true when the card has a `flying-shield-block` hook.
 */
export function cardCarriesFlyingShieldBlock(
  G: LegendaryGameState,
  cardId: CardExtId,
): boolean {
  if (!Array.isArray(G.heroAbilityHooks)) {
    return false;
  }
  for (const hook of getHooksForCard(G.heroAbilityHooks, cardId)) {
    if (hook.keywords.includes('flying-shield-block')) {
      return true;
    }
  }
  return false;
}

/**
 * The first Flying Shield Block copy the seat can still reveal this turn: in hand, then in
 * its play area, skipping copies already revealed this turn.
 *
 * // why: D-24760 — rules v23 "Revealing a Card": a card can be revealed from hand or from
 * the cards played this turn (D-24651). "Once per turn" caps each COPY: a copy revealed
 * this turn is in G.flyingShieldBlockUsedThisTurn; a second copy may still be revealed.
 *
 * @param G - The game state to inspect (not mutated).
 * @param seat - The seat whose hand and play area are scanned.
 * @returns The copy's card id, or undefined when the seat has none left to reveal.
 */
export function findRevealableFlyingShieldBlockCopy(
  G: LegendaryGameState,
  seat: string,
): CardExtId | undefined {
  const playerZones = G.playerZones[seat];
  if (!playerZones) {
    return undefined;
  }
  const usedCopies = G.flyingShieldBlockUsedThisTurn ?? [];
  const zones: CardExtId[][] = [playerZones.hand];
  // why: the Array.isArray guard mirrors countRevealableDivingBlockCopies (minimal test
  // states omit the play area).
  if (Array.isArray(playerZones.inPlay)) {
    zones.push(playerZones.inPlay);
  }
  for (const zone of zones) {
    for (const cardId of zone) {
      if (!usedCopies.includes(cardId) && cardCarriesFlyingShieldBlock(G, cardId)) {
        return cardId;
      }
    }
  }
  return undefined;
}

/**
 * The seats that could reveal Flying Shield Block right now: the recipient first, then the
 * other seats in ascending order.
 *
 * // why: D-24760 — whoever reveals rescues the Bystander (VP), so the order is a rule, not a
 * tie-break. The recipient protects their own Wound first (the same precedence as their own
 * Diving Block); the rest follow the WP-684 deterministic ascending order.
 *
 * @param G - The game state to inspect (not mutated).
 * @param recipientID - The player who would gain the Wound.
 * @returns Seat ids with a revealable, unused copy, in asking order.
 */
function seatsThatCanReveal(G: LegendaryGameState, recipientID: string): string[] {
  const seats: string[] = [];
  if (findRevealableFlyingShieldBlockCopy(G, recipientID) !== undefined) {
    seats.push(recipientID);
  }
  for (const seat of Object.keys(G.playerZones).sort()) {
    if (seat !== recipientID && findRevealableFlyingShieldBlockCopy(G, seat) !== undefined) {
      seats.push(seat);
    }
  }
  return seats;
}

/**
 * Parks a reactive Flying-Shield-Block interception for a Wound that just landed in the
 * recipient's discard pile, when any seat can still reveal a copy this turn.
 *
 * Lazily initializes the FIFO at the park site (never in Game.setup), so an untriggered
 * match leaves the field undefined and the hash oracles do not move.
 *
 * @param G - The game state, mutated in place (pending FIFO appended).
 * @param recipientID - The player who just gained the Wound.
 * @param woundCardId - The Wound card now in the recipient's discard pile.
 * @returns true when an interception was parked.
 */
export function checkFlyingShieldBlock(
  G: LegendaryGameState,
  recipientID: string,
  woundCardId: CardExtId,
): boolean {
  const candidateSeats = seatsThatCanReveal(G, recipientID);
  if (candidateSeats.length === 0) {
    return false;
  }
  if (G.pendingFlyingShieldBlockWounds === undefined) {
    G.pendingFlyingShieldBlockWounds = [];
  }
  G.pendingFlyingShieldBlockWounds.push({ recipientID, woundCardId, candidateSeats });
  return true;
}

/**
 * The seat an entry is waiting on: its first candidate, in `candidateSeats` order, that can
 * still reveal a copy.
 *
 * @param G - The game state to inspect (not mutated).
 * @param entry - The pending Wound.
 * @returns The seat, or undefined when no candidate can reveal any more.
 */
function currentCandidateSeat(
  G: LegendaryGameState,
  entry: PendingFlyingShieldBlockWound,
): string | undefined {
  for (const seat of entry.candidateSeats) {
    if (findRevealableFlyingShieldBlockCopy(G, seat) !== undefined) {
      return seat;
    }
  }
  return undefined;
}

/**
 * Drops pending Wounds that no candidate can intercept any more (every copy was revealed
 * for an earlier Wound this turn). The Wound stays with its recipient.
 *
 * @param G - The game state, mutated in place.
 */
function dropUninterceptableWounds(G: LegendaryGameState): void {
  const queue = G.pendingFlyingShieldBlockWounds;
  if (queue === undefined) {
    return;
  }
  const remaining: PendingFlyingShieldBlockWound[] = [];
  for (const entry of queue) {
    if (currentCandidateSeat(G, entry) === undefined) {
      pushLog(G, `Player ${entry.recipientID} took the Wound (no Flying Shield Block was left to reveal).`);
    } else {
      remaining.push(entry);
    }
  }
  G.pendingFlyingShieldBlockWounds = remaining;
}

/**
 * Builds one seat's two-option prompt for the Wound it is asked about.
 *
 * @param seat - The addressed seat.
 * @param recipientID - The player who would gain the Wound.
 * @returns The seat's prompt (reveal first, decline second).
 */
function buildSeatPrompt(seat: string, recipientID: string): PendingSeatChoice['seatPrompts'][string] {
  if (seat === recipientID) {
    return {
      options: [
        { label: 'Reveal Flying Shield Block: prevent your Wound and rescue a Bystander' },
        { label: 'Take the Wound' },
      ],
    };
  }
  return {
    options: [
      { label: `Reveal Flying Shield Block: prevent Player ${recipientID}'s Wound and rescue a Bystander` },
      { label: `Let Player ${recipientID} take the Wound` },
    ],
  };
}

/**
 * Opens the next Flying-Shield-Block reveal/decline WAVE as a WP-684 pending seat choice.
 *
 * Called from the play-phase onMove after the Diving Block opener. A no-op while another
 * seat choice is open or any Diving Block Wound is still pending (a declined Diving Block
 * may park a Flying Shield Block entry, so Diving Block resolves first). For each entry in FIFO
 * order it addresses the entry's first candidate that can still reveal; when that seat is
 * already addressed this wave the entry waits for the next wave (it is never offered to a
 * later candidate first). The entry is stamped with `addressedSeat` so the apply resolves
 * exactly the Wound the seat saw.
 *
 * @param G - The game state, mutated in place (G.pendingSeatChoice set).
 * @param events - The move context's boardgame.io events (for the stage ride).
 * @param currentPlayer - The active player id; that seat is not stage-ridden (D-24648).
 */
export function openFlyingShieldBlockSeatChoiceIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer?: string,
): void {
  if ((G.pendingFlyingShieldBlockWounds?.length ?? 0) === 0) {
    return;
  }
  if (G.pendingSeatChoice !== undefined || (G.pendingDivingBlockWounds?.length ?? 0) > 0) {
    return;
  }
  dropUninterceptableWounds(G);
  const queue = G.pendingFlyingShieldBlockWounds ?? [];
  // why: D-24760 — clear every stamp first, so a stamp left on an entry that is not addressed
  // this wave can never make the apply resolve the wrong Wound.
  for (const entry of queue) {
    delete entry.addressedSeat;
  }
  const seats: string[] = [];
  const seatPrompts: PendingSeatChoice['seatPrompts'] = {};
  for (const entry of queue) {
    const seat = currentCandidateSeat(G, entry);
    if (seat === undefined || seats.includes(seat)) {
      continue;
    }
    entry.addressedSeat = seat;
    seats.push(seat);
    seatPrompts[seat] = buildSeatPrompt(seat, entry.recipientID);
  }
  if (seats.length === 0) {
    delete G.pendingFlyingShieldBlockWounds;
    return;
  }
  parkSeatChoice(G, events, {
    kind: FLYING_SHIELD_BLOCK_SEAT_CHOICE_KIND,
    addressedSeats: seats,
    seatPrompts,
    submissions: {},
    defaultOptionIndex: FLYING_SHIELD_BLOCK_DECLINE_OPTION_INDEX,
  }, currentPlayer);
}

/**
 * Applies a fully-submitted Flying-Shield-Block wave, in ascending seat order (the WP-684
 * deterministic apply order). Each seat resolves the entry stamped for it: a reveal (see
 * applyFlyingShieldBlockReveal) or a decline (see applyFlyingShieldBlockDecline).
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted Flying-Shield-Block seat choice.
 */
export function applyFlyingShieldBlockResolvedSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
): void {
  const queue = G.pendingFlyingShieldBlockWounds;
  if (queue === undefined) {
    return;
  }
  for (const seat of [...choice.addressedSeats].sort()) {
    const submission = choice.submissions[seat];
    const entryIndex = queue.findIndex((entry) => entry.addressedSeat === seat);
    if (submission === undefined || entryIndex === -1) {
      continue;
    }
    const entry = queue[entryIndex]!;
    // why: D-24760 — every resolve clears its stamp, reveal or decline.
    delete entry.addressedSeat;
    const copy = findRevealableFlyingShieldBlockCopy(G, seat);
    if (submission.optionIndex === FLYING_SHIELD_BLOCK_REVEAL_OPTION_INDEX && copy !== undefined) {
      applyFlyingShieldBlockReveal(G, seat, copy, entry.recipientID);
      queue.splice(entryIndex, 1);
    } else if (applyFlyingShieldBlockDecline(G, seat, entry)) {
      queue.splice(entryIndex, 1);
    }
  }
  if (queue.length === 0) {
    delete G.pendingFlyingShieldBlockWounds;
  }
}

/**
 * Applies one seat's decline: the seat leaves that Wound's candidates, and the recipient keeps
 * the Wound once no candidate is left.
 *
 * @param G - The game state, mutated in place (log line).
 * @param seat - The declining seat.
 * @param entry - The pending Wound the seat was asked about (mutated: candidates trimmed).
 * @returns true when no candidate is left and the entry should leave the queue.
 */
function applyFlyingShieldBlockDecline(
  G: LegendaryGameState,
  seat: string,
  entry: PendingFlyingShieldBlockWound,
): boolean {
  entry.candidateSeats = entry.candidateSeats.filter((candidate) => candidate !== seat);
  if (entry.candidateSeats.length > 0) {
    return false;
  }
  pushLog(G, `Player ${entry.recipientID} took the Wound (Flying Shield Block was not revealed).`);
  return true;
}

/**
 * Reveals one copy: marks it used this turn, returns the recipient's Wound to the supply,
 * and rescues a Bystander for the revealing seat. The card is never moved (a reveal is not a
 * play or a discard).
 *
 * // why: D-24760 — "rescue a Bystander instead" replaces gaining the Wound, so undoing the
 * already-landed Wound (all Wounds share WOUND_EXT_ID) and rescuing is identical to the
 * printed effect. An empty Bystander supply still prevents the Wound (the Diving Block
 * precedent: the reveal is never a dead no-op) and logs that no Bystander was left.
 *
 * @param G - The game state, mutated in place.
 * @param seat - The revealing seat.
 * @param copy - The Flying Shield Block copy revealed.
 * @param recipientID - The player whose Wound is prevented.
 */
function applyFlyingShieldBlockReveal(
  G: LegendaryGameState,
  seat: string,
  copy: CardExtId,
  recipientID: string,
): void {
  if (G.flyingShieldBlockUsedThisTurn === undefined) {
    G.flyingShieldBlockUsedThisTurn = [];
  }
  G.flyingShieldBlockUsedThisTurn.push(copy);
  const isWoundReturned = returnWoundToSupply(G, recipientID);
  const isRescued = rescueTopBystander(G, seat);
  // why: D-24760 — the Diving Block not-found precedent: if a reshuffle already moved the Wound
  // out of the discard, the reveal still counts and still rescues, and the log says why no
  // Wound came back.
  if (!isWoundReturned) {
    pushLog(G, `Player ${seat} revealed Flying Shield Block and rescued a Bystander (Player ${recipientID}'s Wound was no longer in their discard pile).`, 'applied', copy);
    return;
  }
  let whose = `Player ${recipientID}'s`;
  if (seat === recipientID) {
    whose = 'their own';
  }
  let rescueClause = 'rescued a Bystander';
  if (!isRescued) {
    rescueClause = 'could not rescue a Bystander (the supply is empty)';
  }
  pushLog(G, `Player ${seat} revealed Flying Shield Block: prevented ${whose} Wound and ${rescueClause}.`, 'applied', copy);
}

/**
 * Returns one Wound from the recipient's discard pile to the wounds supply.
 *
 * @param G - The game state, mutated in place.
 * @param recipientID - The player whose Wound is prevented.
 * @returns true when a Wound was found and returned.
 */
function returnWoundToSupply(G: LegendaryGameState, recipientID: string): boolean {
  const recipientZones = G.playerZones[recipientID];
  if (!recipientZones) {
    return false;
  }
  const woundMove = moveCardFromZone(recipientZones.discard, G.piles.wounds, WOUND_EXT_ID);
  if (!woundMove.found) {
    return false;
  }
  recipientZones.discard = woundMove.from;
  G.piles.wounds = woundMove.to;
  return true;
}

/**
 * Moves the top Bystander of the supply into the seat's Victory Pile.
 *
 * @param G - The game state, mutated in place.
 * @param seat - The rescuing seat.
 * @returns true when a Bystander was rescued.
 */
function rescueTopBystander(G: LegendaryGameState, seat: string): boolean {
  const playerZones = G.playerZones[seat];
  // why: top-of-pile convention — pile[0] is the next Bystander (D-21501), as heroEffectRescue.
  const topBystander = G.piles.bystanders[0];
  if (!playerZones || topBystander === undefined) {
    return false;
  }
  const moveResult = moveCardFromZone(G.piles.bystanders, playerZones.victory, topBystander);
  if (!moveResult.found) {
    return false;
  }
  G.piles.bystanders = moveResult.from;
  playerZones.victory = moveResult.to;
  return true;
}
