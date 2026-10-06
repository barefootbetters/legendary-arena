/**
 * The rulebook Villain escape procedure (WP-793 / D-24656).
 *
 * Rules v23 L556–L570: when a Villain escapes, in this order,
 *   1. it KOs a Hero costing 6 or less from the HQ — the player whose turn it is
 *      chooses which — and the HQ space refills from the Hero Deck;
 *   2. if it carried any Bystanders away, each player discards a card;
 *   3. its own Escape effect resolves.
 *
 * Step 3 resolves inside the move that caused the escape (`resolveVillainEscape`).
 * Steps 1–2 need player choices, and the escape site has no boardgame.io `events`, can
 * run several times in one move, and the seat-choice slot holds one choice. So the escape
 * RECORDS what it owes on the G-only FIFO `G.pendingEscapeProcedures`, and the play-phase
 * `turn.onMove` OPENS it after the move through the WP-684 seat-choice capability — the
 * Diving Block wave-opener precedent (D-24499 / D-24648). Steps 1–2 therefore resolve
 * after the triggering move: the accepted deviation recorded in D-24656 point 4.
 *
 * These are plain G-mutating helpers (the opener, the builders, the KO helper and the two
 * kind-specific applies), NOT boardgame.io moves. No registry imports, no boardgame.io
 * import, no .reduce(). Never throws.
 */

import type {
  LegendaryGameState,
  PendingEscapeProcedure,
  PendingSeatChoice,
  SeatChoiceOption,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
// why: WP-793 / D-24656 — the park entry point. seatChoice.resolve imports this module's
// applies, so the two form a runtime-safe import cycle (each references the other ONLY
// inside function bodies, never at module top level), so ESM resolves both bindings by
// call time (the divingBlock.logic.ts precedent).
import { parkSeatChoice } from '../moves/seatChoice.resolve.js';
// why: WP-793 / D-24656 — the shared pending-choice aggregate the opener waits on. A third
// runtime-safe cycle runs this module → phaseCard → seatChoice.resolve / resolveReturnOnDiscard
// / playVillainTop.resolve → (villainDeck.reveal →) this module; phaseCard holds only imports
// and functions at top level, and this module reads hasAnyPendingChoice only inside a
// function body, so ESM resolves the binding by call time (the divingBlock.logic.ts precedent).
import { hasAnyPendingChoice } from '../moves/phaseCard.js';
import { discardFromHand } from '../moves/discardFromHand.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { applyPileDepletionResourceLoss } from '../rules/schemeResourceLoss.js';
import { koCard } from '../board/ko.logic.js';
import { refillHqSlot } from '../board/city.logic.js';
import { formatCardRef, resolveCardName } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** The seat-choice kind for an escape's HQ-KO pick (step 1). */
export const ESCAPE_HQ_KO_KIND = 'escape-hq-ko';

/** The seat-choice kind for an escape's every-player Bystander discard (step 2). */
export const ESCAPE_BYSTANDER_DISCARD_KIND = 'escape-bystander-discard';

// why: rules v23 L561 — "the escaping Villain KOs a Hero that costs 6 or less from the HQ".
// A Hero costing 7 or more is never offered or KO'd.
export const ESCAPE_HQ_KO_MAX_COST = 6;

/**
 * Minimal boardgame.io events surface the opener needs (setActivePlayers via
 * parkSeatChoice). Optional so a unit / sim / replay context without a live framework
 * is a guarded no-op (the stage ride is skipped there).
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/** One HQ Hero eligible for an escape's KO. */
interface EligibleEscapeHqHero {
  cardId: CardExtId;
  slotIndex: number;
  cost: number;
}

/**
 * Records the escape procedure an escaped Villain owes (steps 1–2), at the back of the
 * FIFO. Creates `G.pendingEscapeProcedures` lazily.
 *
 * @param G - The game state, mutated in place.
 * @param escapedCardId - The Villain that escaped.
 * @param chooserPlayerID - The player whose turn it is (chooses the HQ KO).
 * @param hasCarriedBystanders - Whether the escape carried at least one Bystander away.
 */
export function enqueueEscapeProcedure(
  G: LegendaryGameState,
  escapedCardId: CardExtId,
  chooserPlayerID: string,
  hasCarriedBystanders: boolean,
): void {
  const entry: PendingEscapeProcedure = {
    escapedCardId,
    chooserPlayerID,
    hasCarriedBystanders,
    isHqKoResolved: false,
  };
  if (G.pendingEscapeProcedures === undefined) {
    G.pendingEscapeProcedures = [];
  }
  G.pendingEscapeProcedures.push(entry);
}

/**
 * Lists the HQ Heroes an escape may KO: every non-null HQ slot whose cost is
 * `ESCAPE_HQ_KO_MAX_COST` or less, sorted cost ascending, then slot ascending.
 *
 * @param G - The game state (read only).
 * @returns The eligible Heroes in offer order.
 */
function listEligibleEscapeHqHeroes(G: LegendaryGameState): EligibleEscapeHqHero[] {
  const eligible: EligibleEscapeHqHero[] = [];
  for (let slotIndex = 0; slotIndex < G.hq.length; slotIndex++) {
    const cardId = G.hq[slotIndex];
    if (cardId === null || cardId === undefined) {
      continue;
    }
    // why: a Hero with no cardStats entry (a narrow test G) counts as cost 0, the
    // koFromHq / secretInvasion convention.
    const cost = G.cardStats[cardId]?.cost ?? 0;
    if (cost > ESCAPE_HQ_KO_MAX_COST) {
      continue;
    }
    eligible.push({ cardId, slotIndex, cost });
  }
  eligible.sort((entryA, entryB) => {
    if (entryA.cost !== entryB.cost) {
      return entryA.cost - entryB.cost;
    }
    return entryA.slotIndex - entryB.slotIndex;
  });
  return eligible;
}

/**
 * KOs one HQ Hero for an escape and refills its HQ space from the Hero Deck (an empty
 * Hero Deck leaves the space empty, D-13503). A Hero no longer in the HQ is a logged
 * no-op. A haunter stays in its HQ space when the Hero leaves (D-24587).
 *
 * @param G - The game state, mutated in place.
 * @param heroCardId - The HQ Hero to KO.
 * @param villainCardId - The escaped Villain (named in the log line).
 * @returns true when the Hero was KO'd.
 */
export function koHqHeroForEscape(
  G: LegendaryGameState,
  heroCardId: CardExtId,
  villainCardId: CardExtId,
): boolean {
  const slot = G.hq.indexOf(heroCardId);
  if (slot === -1) {
    pushLog(G,
      `Escape: ${formatCardRef(G.cardDisplayData, heroCardId)} is no longer in the HQ — nothing was KO'd.`,
    );
    return false;
  }
  // why: the koFromHq remove-then-refill template (schemeTwistResolvers.ts) — pure helpers
  // return new arrays, assigned back onto G.
  G.hq[slot] = null;
  G.ko = koCard(G.ko, heroCardId);
  const refill = refillHqSlot(G.hq, slot, G.heroDeck);
  G.hq = refill.hq;
  G.heroDeck = refill.heroDeck;
  pushLog(G,
    `Escape: ${formatCardRef(G.cardDisplayData, villainCardId)} KO'd ${formatCardRef(G.cardDisplayData, heroCardId)} from the HQ.`,
  );
  return true;
}

/**
 * Builds the step-1 HQ-KO seat choice, addressed to the escape's chooser only: one option
 * per eligible Hero, in eligibility order.
 *
 * @param G - The game state (read for card names).
 * @param chooserPlayerID - The seat that chooses.
 * @param eligible - The eligible HQ Heroes, in offer order (two or more).
 * @returns The pending HQ-KO choice.
 */
export function buildEscapeHqKoChoice(
  G: LegendaryGameState,
  chooserPlayerID: string,
  eligible: readonly EligibleEscapeHqHero[],
): PendingSeatChoice {
  const options: SeatChoiceOption[] = [];
  for (const hero of eligible) {
    options.push({
      label: `${resolveCardName(G.cardDisplayData, hero.cardId)} (cost ${String(hero.cost)})`,
      cardId: hero.cardId,
    });
  }
  return {
    kind: ESCAPE_HQ_KO_KIND,
    addressedSeats: [chooserPlayerID],
    seatPrompts: { [chooserPlayerID]: { options } },
    submissions: {},
    // why: the bot / sim + disconnect default KOs the cheapest eligible Hero (index 0) —
    // deterministic and always in range.
    defaultOptionIndex: 0,
  };
}

/**
 * Builds the step-2 Bystander discard choice, or undefined when no seat holds a card:
 * every seat with a card in hand is addressed (ascending), one option per hand card, in
 * hand order (the Monarch's Decree discard precedent, D-24511).
 *
 * @param G - The game state (read for hands + card names).
 * @returns The pending discard choice, or undefined when every hand is empty.
 */
export function buildEscapeBystanderDiscardChoice(
  G: LegendaryGameState,
): PendingSeatChoice | undefined {
  const addressedSeats: string[] = [];
  const seatPrompts: PendingSeatChoice['seatPrompts'] = {};
  for (const seat of Object.keys(G.playerZones).sort()) {
    const zones = G.playerZones[seat];
    if (!zones || zones.hand.length === 0) {
      continue;
    }
    const options: SeatChoiceOption[] = [];
    for (const cardId of zones.hand) {
      options.push({ label: resolveCardName(G.cardDisplayData, cardId), cardId });
    }
    addressedSeats.push(seat);
    seatPrompts[seat] = { options };
  }
  if (addressedSeats.length === 0) {
    return undefined;
  }
  return {
    kind: ESCAPE_BYSTANDER_DISCARD_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: the bot / sim + disconnect default discards each seat's first hand card
    // (index 0) — deterministic and always in range.
    defaultOptionIndex: 0,
  };
}

/**
 * Opens (or resolves automatically) the next owed escape step, draining
 * `G.pendingEscapeProcedures` in escape order until a seat choice is parked, the queue
 * is empty, or the match is decided. Called from the play-phase `turn.onMove` (and its
 * sim / fixture mirrors) after every move.
 *
 * Returns at once while any pending player choice is open (`hasAnyPendingChoice`, which
 * covers an open seat choice, a return-on-discard reaction and every active-player queue
 * such as a Juggernaut Escape's hand KO) or the WP-427 `pendingHeroChoice` slot is set, so
 * a step-3 pick resolves first and prompts never stack; and once `evaluateEndgame(G)` is
 * non-null, so a decided match never parks a prompt.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events (for the stage ride), or
 *   undefined in a unit / sim / fixture context.
 * @param currentPlayer - The active player id (ctx.currentPlayer, or the sim loop's
 *   active seat). An undefined value admits every addressed seat to the stage ride.
 */
export function openEscapeProcedureSeatChoiceIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer?: string,
): void {
  while (G.pendingEscapeProcedures !== undefined) {
    const queue = G.pendingEscapeProcedures;
    if (queue.length === 0) {
      delete G.pendingEscapeProcedures;
      return;
    }
    if (hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined) {
      return;
    }
    // why: checked at the head of EVERY iteration, not once per call — an automatic KO's
    // refill can empty the Hero Deck on a Hero-Deck scheme (applied just below), which ends
    // the match before the next step parks.
    if (evaluateEndgame(G) !== null) {
      return;
    }
    const entry = queue[0]!;
    if (!entry.isHqKoResolved) {
      if (openEscapeHqKoStep(G, events, entry, currentPlayer)) {
        return;
      }
      continue;
    }
    queue.shift();
    if (queue.length === 0) {
      delete G.pendingEscapeProcedures;
    }
    if (entry.hasCarriedBystanders && openEscapeBystanderDiscardStep(G, events, currentPlayer)) {
      return;
    }
  }
}

/**
 * Resolves or opens step 1 (the HQ KO) for the front escape: 0 eligible → the no-op line;
 * 1 → an automatic KO followed by the Hero-Deck depletion check; 2+ → the chooser's seat
 * choice. Marks the step resolved in every case.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move's boardgame.io events, or undefined.
 * @param entry - The front escape procedure.
 * @param currentPlayer - The active player id.
 * @returns true when a seat choice was parked (the opener must stop).
 */
function openEscapeHqKoStep(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  entry: PendingEscapeProcedure,
  currentPlayer: string | undefined,
): boolean {
  entry.isHqKoResolved = true;
  const eligible = listEligibleEscapeHqHeroes(G);
  if (eligible.length === 0) {
    pushLog(G,
      `Escape: ${formatCardRef(G.cardDisplayData, entry.escapedCardId)} KO'd nothing — no Hero in the HQ costs 6 or less.`,
    );
    return false;
  }
  if (eligible.length === 1) {
    koHqHeroForEscape(G, eligible[0]!.cardId, entry.escapedCardId);
    // why: the refill can empty the Hero Deck (Super Hero Civil War's loss, D-24318);
    // setting SCHEME_LOSS now lets the next iteration's evaluateEndgame stop the opener
    // before a queued step 2 parks.
    applyPileDepletionResourceLoss(G);
    return false;
  }
  // why: D-24648 — a one-seat choice addressed to the active player needs no stage ride;
  // they already accept moves as the currentPlayer.
  parkSeatChoice(G, events, buildEscapeHqKoChoice(G, entry.chooserPlayerID, eligible), currentPlayer);
  return true;
}

/**
 * Opens step 2 (the every-player Bystander discard) for an escape that carried
 * Bystanders, or logs the no-op line when every hand is empty.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move's boardgame.io events, or undefined.
 * @param currentPlayer - The active player id.
 * @returns true when a seat choice was parked (the opener must stop).
 */
function openEscapeBystanderDiscardStep(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer: string | undefined,
): boolean {
  const choice = buildEscapeBystanderDiscardChoice(G);
  if (choice === undefined) {
    pushLog(G, 'Escape: no player has a card to discard for the Bystanders carried away.');
    return false;
  }
  // why: D-24656 point 3 — a MIXED ride (the active seat plus others) must admit the active
  // seat too. With the D-24648 skip boardgame.io would set activePlayers to the non-active
  // seats only and reject the active seat's own discard until they all answered (autoplay
  // aborts, bot-ally faults). Skip the ride only when the active seat is the sole addressed
  // seat (the Random Acts pass-left precedent).
  const isActiveSeatOnly =
    choice.addressedSeats.length === 1 && choice.addressedSeats[0] === currentPlayer;
  if (isActiveSeatOnly) {
    parkSeatChoice(G, events, choice, currentPlayer);
  } else {
    parkSeatChoice(G, events, choice);
  }
  return true;
}

/**
 * Applies a fully-submitted HQ-KO seat choice: KOs the chosen Hero (if it is still in the
 * HQ) and refills its space. The Villain named in the log line is the front escape, which
 * stays at the front until its step 2 is opened.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted choice (kind 'escape-hq-ko').
 */
export function applyEscapeHqKo(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const seat = choice.addressedSeats[0];
  if (seat === undefined) {
    return;
  }
  const submission = choice.submissions[seat];
  const option = submission === undefined
    ? undefined
    : choice.seatPrompts[seat]?.options[submission.optionIndex];
  const heroCardId = option?.cardId;
  const front = G.pendingEscapeProcedures?.[0];
  if (heroCardId === undefined || front === undefined) {
    pushLog(G, 'Escape: the HQ KO choice no longer matches an escape — nothing was KO\'d.');
    return;
  }
  koHqHeroForEscape(G, heroCardId, front.escapedCardId);
}

/**
 * Applies a fully-submitted Bystander discard ATOMICALLY: every addressed seat, in
 * ascending id order, discards its chosen hand card through the `discardFromHand`
 * chokepoint (so return-on-discard and teleport-on-discard see a card-effect discard).
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted choice (kind 'escape-bystander-discard').
 */
export function applyEscapeBystanderDiscard(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const cardId = choice.seatPrompts[seat]?.options[submission.optionIndex]?.cardId;
    if (cardId === undefined) {
      continue;
    }
    if (discardFromHand(G, seat, cardId)) {
      pushLog(G,
        `Player ${seat} discarded ${formatCardRef(G.cardDisplayData, cardId)} (Bystanders carried away).`,
        'applied',
      );
    }
  }
}
