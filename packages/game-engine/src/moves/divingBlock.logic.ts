/**
 * Reactive Diving-Block wound interception (WP-682 / D-24499).
 *
 * Captain America's Diving Block — "If you would gain a Wound, you may reveal this
 * card and draw a card instead." — is the FIRST reactive WOUND-time hero ability,
 * the wound-side sibling of `return-on-discard` (WP-498). It fires at the
 * `gainWoundForPlayer` chokepoint (board/wounds.logic.ts) so EVERY wound source —
 * Master Strikes, Scheme Twists, villain effects, hero self-wounds — is seen, not
 * just hero effects.
 *
 * The interception follows the return-on-discard land-then-offer-undo shape: the
 * Wound lands in the player's discard first, then `checkDivingBlock` parks one
 * PENDING entry per Wound (G.pendingDivingBlockWounds, PER-WOUND, one Diving Block
 * copy per Wound). The pending FIFO is drained one WAVE at a time through the
 * WP-684 non-active/multi-seat pending-choice capability (G.pendingSeatChoice, kind
 * 'diving-block'): the wound recipient MAY be a NON-ACTIVE seat (a Master Strike /
 * "each player gains a Wound" scheme), which the shipped active-player-only
 * pending-choice model cannot serve — hence the WP-684 hard dependency. On reveal
 * the just-gained Wound is returned to the supply, a card is drawn, and Diving
 * Block STAYS in hand; on decline the Wound is kept.
 *
 * These are plain G-mutating helpers called from the chokepoint, the play-phase
 * onMove wave-opener, and resolveSeatChoice — NOT boardgame.io moves. No registry
 * imports. No .reduce(). Never throws.
 */

import type { LegendaryGameState, PendingSeatChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { getHooksForCard } from '../rules/heroAbility.types.js';
import { moveCardFromZone } from './zoneOps.js';
import { drawCardsIntoHand } from './drawCards.logic.js';
import { WOUND_EXT_ID } from '../setup/pilesInit.js';
import { parkSeatChoice } from './seatChoice.resolve.js';
import { pushLog } from '../log/logPush.js';

/** The seat-choice kind discriminant for a Diving-Block reveal/decline wave. */
export const DIVING_BLOCK_SEAT_CHOICE_KIND = 'diving-block';

// why: WP-682 / D-24499 — the reveal option is index 0, the decline (take the
// Wound) option is index 1; the disconnect/timeout default is DECLINE (the reveal
// is optional pure-upside, but an absent seat resolves to keeping the Wound, never
// a phantom free draw). These indices are the contract between the wave builder,
// the client prompt, and the apply.
const DIVING_BLOCK_REVEAL_OPTION_INDEX = 0;
const DIVING_BLOCK_DECLINE_OPTION_INDEX = 1;

/**
 * Minimal boardgame.io events surface the wave-opener needs (setActivePlayers via
 * parkSeatChoice). Optional so a unit/replay context without a live framework is a
 * guarded no-op (it dispatches resolveSeatChoice directly against G).
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/**
 * Whether a card carries the reactive `diving-block` keyword.
 *
 * // why: WP-682 / D-24499 — the reaction keys on the KEYWORD (the timing label is
 * declarative-only), exactly like cardCarriesReturnOnDiscard. The Array.isArray
 * guard covers minimal test states that omit G.heroAbilityHooks.
 *
 * @param G - The game state to inspect (not mutated).
 * @param cardId - The card whose hooks are scanned.
 * @returns true when the card has a `diving-block` hook.
 */
export function cardCarriesDivingBlock(
  G: LegendaryGameState,
  cardId: CardExtId,
): boolean {
  if (!Array.isArray(G.heroAbilityHooks)) {
    return false;
  }
  for (const hook of getHooksForCard(G.heroAbilityHooks, cardId)) {
    if (hook.keywords.includes('diving-block')) {
      return true;
    }
  }
  return false;
}

/**
 * The number of Diving Block copies the player currently holds IN HAND.
 *
 * // why: WP-682 / D-24499 — the ruling is "each simultaneous Wound needs its OWN
 * Diving Block in hand", so the per-Wound park gate compares the count of already
 * pending Diving-Block Wounds for the player against the copies in hand: a player
 * with one copy and two Wounds is offered exactly one reveal.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose hand is counted.
 * @returns The number of Diving Block cards in the player's hand.
 */
export function countDivingBlockCopiesInHand(
  G: LegendaryGameState,
  playerID: string,
): number {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return 0;
  }
  let copies = 0;
  for (const cardId of playerZones.hand) {
    if (cardCarriesDivingBlock(G, cardId as CardExtId)) {
      copies++;
    }
  }
  return copies;
}

/**
 * The number of Diving-Block Wounds currently pending for the given player.
 *
 * @param G - The game state to inspect (not mutated).
 * @param playerID - The player whose pending Wounds are counted.
 * @returns How many entries in the FIFO belong to the player.
 */
function countPendingWoundsForPlayer(
  G: LegendaryGameState,
  playerID: string,
): number {
  const queue = G.pendingDivingBlockWounds;
  if (queue === undefined) {
    return 0;
  }
  let count = 0;
  for (const entry of queue) {
    if (entry.playerID === playerID) {
      count++;
    }
  }
  return count;
}

/**
 * Whether any reactive Diving-Block wound interception is currently pending.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending Diving-Block queue holds at least one entry.
 */
export function hasPendingDivingBlockWounds(G: LegendaryGameState): boolean {
  return (G.pendingDivingBlockWounds?.length ?? 0) > 0;
}

/**
 * Parks a reactive Diving-Block interception for a Wound that just landed in the
 * player's discard pile, when the player holds Diving Block and has an un-committed
 * copy left for this Wound batch.
 *
 * Runs AFTER the Wound moved into discard (the land-then-offer-undo shape). Lazily
 * initializes the FIFO at the park site (never in Game.setup) so an untriggered
 * match leaves the field undefined and the empty-replay hash oracles do not re-pin.
 * G-only (no events): the wave that admits the seat is opened later by the
 * play-phase onMove (openDivingBlockSeatChoiceIfNeeded), which has the events the
 * WP-684 setActivePlayers stage-ride needs.
 *
 * @param G - The game state, mutated in place (pending FIFO appended).
 * @param playerID - The player who just gained the Wound.
 * @param woundCardId - The Wound card now in the player's discard pile.
 */
export function checkDivingBlock(
  G: LegendaryGameState,
  playerID: string,
  woundCardId: CardExtId,
): void {
  const copiesInHand = countDivingBlockCopiesInHand(G, playerID);
  if (copiesInHand === 0) {
    return;
  }
  // why: WP-682 / D-24499 — one Diving Block copy per Wound. A player with fewer
  // copies than incoming Wounds is offered exactly `copiesInHand` reveals; the rest
  // of the Wounds land unpreventably.
  if (countPendingWoundsForPlayer(G, playerID) >= copiesInHand) {
    return;
  }
  if (G.pendingDivingBlockWounds === undefined) {
    G.pendingDivingBlockWounds = [];
  }
  G.pendingDivingBlockWounds.push({ playerID, woundCardId });
}

/**
 * The distinct seats with a pending Diving-Block Wound, in FIFO order (one seat per
 * wave). Each seat decides ONE Wound per wave; a seat with more than one pending
 * Wound resolves the rest in later waves.
 *
 * @param G - The game state to inspect (not mutated).
 * @returns The seats to address in the next wave, in FIFO-first order.
 */
function seatsForNextWave(G: LegendaryGameState): string[] {
  const queue = G.pendingDivingBlockWounds ?? [];
  const seats: string[] = [];
  for (const entry of queue) {
    if (!seats.includes(entry.playerID)) {
      seats.push(entry.playerID);
    }
  }
  return seats;
}

/**
 * Opens the next Diving-Block reveal/decline WAVE as a WP-684 pending seat choice
 * when the FIFO holds pending Wounds and no seat choice is already open.
 *
 * Called from the play-phase onMove after every move (the move that dealt the
 * Wounds, and each resolveSeatChoice that drains a wave) so waves are opened and
 * re-opened deterministically. Uses parkSeatChoice to set G.pendingSeatChoice AND
 * admit the addressed seats — which MAY be non-active — via the WP-684
 * setActivePlayers stage-ride, so boardgame.io accepts a non-active recipient's
 * resolveSeatChoice move without forking the turn model.
 *
 * // why: WP-682 / D-24499 — a wave addresses every distinct seat with a pending
 * Wound (one Wound each per wave), so a Master Strike's simultaneous per-seat
 * Wounds resolve concurrently; a seat's additional Wounds resolve in later waves.
 *
 * @param G - The game state, mutated in place (G.pendingSeatChoice set).
 * @param events - The move context's boardgame.io events (for the stage ride).
 */
export function openDivingBlockSeatChoiceIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
): void {
  if (!hasPendingDivingBlockWounds(G)) {
    return;
  }
  // why: never stack a Diving-Block wave on top of another open seat choice (a
  // Random Acts multi-seat choice, or a prior Diving-Block wave still resolving);
  // the block-all guard freezes the turn until it clears, then onMove re-opens.
  if (G.pendingSeatChoice !== undefined) {
    return;
  }
  const seats = seatsForNextWave(G);
  if (seats.length === 0) {
    return;
  }
  const seatPrompts: PendingSeatChoice['seatPrompts'] = {};
  for (const seat of seats) {
    seatPrompts[seat] = {
      options: [
        { label: 'Reveal Diving Block: prevent the Wound and draw a card' },
        { label: 'Take the Wound' },
      ],
    };
  }
  const choice: PendingSeatChoice = {
    kind: DIVING_BLOCK_SEAT_CHOICE_KIND,
    addressedSeats: seats,
    seatPrompts,
    submissions: {},
    // why: an absent seat resolves to DECLINE (keep the Wound) — never a phantom
    // free draw; the reveal is optional pure-upside a present player opts into.
    defaultOptionIndex: DIVING_BLOCK_DECLINE_OPTION_INDEX,
  };
  parkSeatChoice(G, events, choice);
}

/**
 * Applies a fully-submitted Diving-Block reveal/decline wave, then drains the
 * resolved Wounds from the FIFO. Called from resolveSeatChoice (and the
 * disconnect/timeout default) when every addressed seat has submitted; the caller
 * clears G.pendingSeatChoice.
 *
 * For each addressed seat, in ascending id order (the WP-684 deterministic apply
 * order), the front pending Wound for that seat is resolved:
 *  - REVEAL → the just-gained Wound is removed from the seat's discard, returned to
 *    the wounds supply, and the seat draws one card. Diving Block is NEVER moved
 *    (it stays in hand) — a reveal is not a play or a discard.
 *  - DECLINE → the Wound stays in the discard pile.
 *
 * // why: WP-682 / D-24499 — the reveal REPLACES the Wound with a draw, so undoing
 * the already-landed Wound (return to supply) + drawing is byte-identical to the
 * printed "draw a card instead". The board is frozen (block-all) between park and
 * resolve, so the seat's front pending Wound is stable.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted Diving-Block seat choice.
 * @param shuffleContext - Deterministic reshuffle source for the reveal draw.
 */
export function applyDivingBlockResolvedSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  shuffleContext: ShuffleProvider | undefined,
): void {
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const queue = G.pendingDivingBlockWounds;
    if (queue === undefined) {
      continue;
    }
    const woundIndex = queue.findIndex((entry) => entry.playerID === seat);
    if (woundIndex === -1) {
      continue;
    }
    const woundEntry = queue[woundIndex]!;
    if (submission.optionIndex === DIVING_BLOCK_REVEAL_OPTION_INDEX) {
      applyDivingBlockReveal(G, seat, woundEntry.woundCardId, shuffleContext);
    } else {
      pushLog(G,
        `Player ${seat} took the Wound (declined Diving Block).`,
      );
    }
    // Drain this seat's resolved Wound from the FIFO (front-pop per seat).
    queue.splice(woundIndex, 1);
  }
  if ((G.pendingDivingBlockWounds?.length ?? 0) === 0) {
    delete G.pendingDivingBlockWounds;
  }
}

/**
 * Undoes one just-gained Wound for a revealing seat: removes the Wound from the
 * seat's discard, returns it to the wounds supply, and draws one card. Diving Block
 * is intentionally NOT moved — a reveal keeps it in hand.
 *
 * @param G - The game state, mutated in place.
 * @param seat - The revealing seat.
 * @param woundCardId - The Wound card to return to the supply.
 * @param shuffleContext - Deterministic reshuffle source for the draw.
 */
function applyDivingBlockReveal(
  G: LegendaryGameState,
  seat: string,
  woundCardId: CardExtId,
  shuffleContext: ShuffleProvider | undefined,
): void {
  const playerZones = G.playerZones[seat];
  if (!playerZones) {
    return;
  }
  // why: all Wounds share WOUND_EXT_ID, so removing any one Wound instance from the
  // discard and pushing one back to the supply returns exactly the just-gained
  // Wound (net-identical to preventing it). Guard on the stored id to be explicit.
  const targetWoundId = woundCardId === WOUND_EXT_ID ? woundCardId : WOUND_EXT_ID;
  const moveResult = moveCardFromZone(playerZones.discard, G.piles.wounds, targetWoundId);
  if (!moveResult.found) {
    // why: the Wound is no longer in discard (should not happen while the board is
    // frozen) — skip the return but still draw, so the reveal is never a dead no-op.
    drawCardsIntoHandGuarded(G, seat, shuffleContext);
    pushLog(G,
      `Player ${seat} revealed Diving Block and drew a card.`,
    );
    return;
  }
  playerZones.discard = moveResult.from;
  G.piles.wounds = moveResult.to;
  drawCardsIntoHandGuarded(G, seat, shuffleContext);
  pushLog(G,
    `Player ${seat} revealed Diving Block: prevented the Wound and drew a card.`,
  );
}

/**
 * Draws one card for the seat when a deterministic shuffle source is available.
 *
 * // why: WP-682 / D-24499 — the reveal draw needs a ShuffleProvider for a possible
 * reshuffle; resolveSeatChoice supplies random. The disconnect/timeout default
 * never reaches a reveal (its default is decline), so a missing shuffleContext
 * simply skips the draw rather than reaching for a non-deterministic source.
 *
 * @param G - The game state, mutated in place.
 * @param seat - The seat drawing a card.
 * @param shuffleContext - Deterministic reshuffle source, or undefined.
 */
function drawCardsIntoHandGuarded(
  G: LegendaryGameState,
  seat: string,
  shuffleContext: ShuffleProvider | undefined,
): void {
  const playerZones = G.playerZones[seat];
  if (!playerZones || shuffleContext === undefined) {
    return;
  }
  drawCardsIntoHand(playerZones, 1, shuffleContext);
}
