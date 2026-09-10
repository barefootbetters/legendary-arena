/**
 * Pure builders + atomic appliers for the two multi-seat "each other player
 * chooses" core mastermind tactics that ride WP-684's non-active/multi-seat
 * pending-choice capability (WP-694 / D-24511):
 *
 *   - Monarch's Decree (Dr. Doom) — "Choose one: each other player draws a card
 *     OR each other player discards a card." Two steps: the ACTIVE (defeating)
 *     player first makes a single-seat draw-vs-discard mode choice (kind
 *     'monarchs-decree-mode'); the "draw" branch resolves DETERMINISTICALLY inside
 *     the mode apply (each other player draws one card); the "discard" branch
 *     CHAINS a SIMULTANEOUS MULTI-SEAT discard (kind 'monarchs-discard', each other
 *     player picks one hand card to discard).
 *   - Vanishing Illusions (Loki) — "Each other player KOs a Villain from their
 *     Victory Pile." A SIMULTANEOUS MULTI-SEAT choice (kind 'vanishing-illusions-ko',
 *     each other player picks one Victory-Pile Villain to KO); a seat with no
 *     Victory-Pile Villain is not addressed (no-op).
 *
 * This module holds ONLY pure builders + state appliers (no boardgame.io import,
 * no parkSeatChoice import) so it never cycles with seatChoice.resolve.ts — that
 * module imports the appliers (to dispatch on resolve) and the discard-chain
 * builder (to chain the discard after the mode choice). The tactic resolvers
 * (tacticHandlers.ts) import the mode/KO builders + the park entry from
 * seatChoice.resolve.ts. One direction only.
 *
 * No .reduce() in the apply/count loops. No registry imports. Deterministic:
 * addressed seats apply in ASCENDING id order, so a multi-seat resolution is
 * byte-identical regardless of the order seats submitted in (the WP-684 guarantee).
 */

import type {
  LegendaryGameState,
  PendingSeatChoice,
  SeatChoiceOption,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { discardFromHand } from './discardFromHand.js';
import { drawCardsIntoHand } from './drawCards.logic.js';
import { moveCardFromZone } from './zoneOps.js';
import { koCard } from '../board/ko.logic.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';

/** Discriminant for Monarch's Decree's active single-seat draw-vs-discard mode choice. */
export const MONARCHS_DECREE_MODE_KIND = 'monarchs-decree-mode';
/** Discriminant for Monarch's Decree's simultaneous multi-seat discard step. */
export const MONARCHS_DISCARD_KIND = 'monarchs-discard';
/** Discriminant for Vanishing Illusions' simultaneous multi-seat KO-a-Victory-Pile-Villain choice. */
export const VANISHING_ILLUSIONS_KO_KIND = 'vanishing-illusions-ko';

// why: WP-694 / D-24511 — Monarch's Decree draws exactly one card per OTHER player on
// the "draw" branch (the printed "each other player draws a card"). Named, not inlined,
// so an audit can grep the count.
const MONARCHS_DECREE_DRAW_COUNT = 1;

// why: WP-694 / D-24511 — Monarch's mode options are a FIXED two-option list in a locked
// order: index 0 = the "draw" branch, index 1 = the "discard" branch (EC-731 locked). The
// mode is read back from the active seat's submitted optionIndex against this order.
const MONARCHS_DECREE_DRAW_OPTION_INDEX = 0;
const MONARCHS_DECREE_DISCARD_OPTION_INDEX = 1;

/**
 * Whether a Victory-Pile card is a real Villain, from the ext_id id-grammar.
 *
 * // why: WP-694 / D-24511 — a Villain's ext_id is `${setAbbr}-villain-${group}-${slug}`,
 * so the `-villain-` infix identifies a Villain from the id grammar alone — the
 * countVictoryPileGroupVillains / victoryPileHasOtherGroupVillain precedent — WITHOUT a new
 * hashed villain-group map (which would re-pin every committed fixture). The
 * `bystander-villain-deck-NN` rescued-Bystander form ALSO contains `-villain-`, so exclude
 * any `bystander-`-prefixed id; `-henchman-` / `-mastermind-` ext_ids never contain
 * `-villain-` and so are excluded naturally.
 *
 * @param cardExtId - A card ext_id from a player's Victory Pile.
 * @returns Whether the card is a Villain (not a Bystander / Henchman / Mastermind / Tactic).
 */
function isVictoryPileVillain(cardExtId: CardExtId): boolean {
  return cardExtId.includes('-villain-') && !cardExtId.startsWith('bystander-');
}

/**
 * Builds Monarch's Decree's active single-seat draw-vs-discard mode choice, addressed
 * to the defeating player only.
 *
 * @param currentPlayer - The defeating player (the sole addressed seat).
 * @returns The pending mode choice to park.
 */
export function buildMonarchsDecreeModeChoice(currentPlayer: string): PendingSeatChoice {
  return {
    kind: MONARCHS_DECREE_MODE_KIND,
    addressedSeats: [currentPlayer],
    seatPrompts: {
      [currentPlayer]: {
        options: [
          { label: 'Each other player draws a card' },
          { label: 'Each other player discards a card' },
        ],
      },
    },
    submissions: {},
    // why: the bot/sim + disconnect default is the "draw" branch (index 0) — a
    // deterministic, always-in-range, RNG-free default.
    defaultOptionIndex: MONARCHS_DECREE_DRAW_OPTION_INDEX,
  };
}

/**
 * Reads the mode the active seat chose for a fully-submitted Monarch's Decree mode
 * choice: 'draw', 'discard', or undefined when nothing (or an out-of-range index)
 * was submitted.
 *
 * @param choice - The fully-submitted pending mode choice (kind 'monarchs-decree-mode').
 * @returns The chosen mode, or undefined.
 */
export function readMonarchsDecreeSelectedMode(
  choice: PendingSeatChoice,
): 'draw' | 'discard' | undefined {
  const activeSeat = choice.addressedSeats[0];
  if (activeSeat === undefined) {
    return undefined;
  }
  const submission = choice.submissions[activeSeat];
  if (submission === undefined) {
    return undefined;
  }
  if (submission.optionIndex === MONARCHS_DECREE_DRAW_OPTION_INDEX) {
    return 'draw';
  }
  if (submission.optionIndex === MONARCHS_DECREE_DISCARD_OPTION_INDEX) {
    return 'discard';
  }
  return undefined;
}

/**
 * Applies a fully-submitted Monarch's Decree mode choice.
 *
 * Only the "draw" branch acts here: each OTHER player (every seat except the active
 * seat, ascending) draws exactly one card, reshuffle-aware. The "discard" branch is a
 * no-op here — the multi-seat discard is chained from the live move context
 * (seatChoice.resolve.ts) because admitting the non-active seats needs the move's
 * events.setActivePlayers.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending mode choice (kind 'monarchs-decree-mode').
 * @param shuffleContext - Deterministic reshuffle source for the draw, or undefined
 *   (the timeout/disconnect path).
 */
export function applyMonarchsDecreeMode(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  shuffleContext: ShuffleProvider | undefined,
): void {
  const activeSeat = choice.addressedSeats[0];
  if (activeSeat === undefined) {
    return;
  }
  if (readMonarchsDecreeSelectedMode(choice) !== 'draw') {
    // why: the "discard" branch (or an unsubmitted/defensive miss) draws nothing here —
    // the discard opens as its own chained multi-seat choice.
    return;
  }
  // why: the timeout/disconnect default is "draw" but supplies no shuffle source; an
  // identity Shuffle keeps the fallback deterministic (the reshuffle only reorders an
  // exhausted deck, and this path is the not-yet-wired WP-116 governing policy).
  const effectiveShuffle: ShuffleProvider =
    shuffleContext ?? { random: { Shuffle: <T>(deck: T[]): T[] => deck } };
  const otherSeats = Object.keys(G.playerZones)
    .filter((seat) => seat !== activeSeat)
    .sort();
  for (const seat of otherSeats) {
    const zones = G.playerZones[seat];
    if (!zones) {
      continue;
    }
    const handBefore = zones.hand.length;
    drawCardsIntoHand(zones, MONARCHS_DECREE_DRAW_COUNT, effectiveShuffle);
    const drawn = zones.hand.length - handBefore;
    pushLog(
      G,
      `Player ${seat} drew ${String(drawn)} card(s) (Monarch's Decree).`,
      'applied',
    );
  }
}

/**
 * Builds Monarch's Decree's simultaneous multi-seat discard choice, or undefined when
 * no other seat holds a card to discard.
 *
 * Every seat in `otherSeats` that holds ≥1 hand card is addressed with one option per
 * hand card (label = card name, carrying the exact hand instance in `cardId`). A seat
 * with an empty hand is not addressed.
 *
 * @param G - The game state (read for hands + card display names).
 * @param otherSeats - Every seat except the defeating player (ascending).
 * @returns The pending discard choice, or undefined when no other seat can discard.
 */
export function buildMonarchsDiscardChoice(
  G: LegendaryGameState,
  otherSeats: readonly string[],
): PendingSeatChoice | undefined {
  const addressedSeats: string[] = [];
  const seatPrompts: Record<string, { options: SeatChoiceOption[] }> = {};
  for (const seat of otherSeats) {
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
    kind: MONARCHS_DISCARD_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: the bot/sim + disconnect default discards each seat's FIRST hand card
    // (index 0) — deterministic and always in range.
    defaultOptionIndex: 0,
  };
}

/**
 * Applies a fully-submitted Monarch's Decree multi-seat discard ATOMICALLY: every
 * addressed seat discards its chosen hand card via the enforced discardFromHand
 * chokepoint.
 *
 * // why: WP-694 / D-24511 — seats are iterated in ASCENDING id order, so the resolution
 * is byte-identical regardless of the order seats submitted in (the multi-seat determinism
 * guarantee). Each seat's discard is independent (own hand → own discard), so no two-phase
 * remove/add is needed (unlike the pass-left apply). discardFromHand is the enforced
 * hand→discard chokepoint (it also fires any return-on-discard reaction) — never raw zoneOps.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'monarchs-discard').
 */
export function applyMonarchsDiscard(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const option = choice.seatPrompts[seat]?.options[submission.optionIndex];
    const cardId = option?.cardId;
    if (cardId === undefined) {
      continue;
    }
    const discarded = discardFromHand(G, seat, cardId);
    if (discarded) {
      pushLog(
        G,
        `Player ${seat} discarded ${resolveCardName(G.cardDisplayData, cardId)} (Monarch's Decree).`,
        'applied',
      );
    }
  }
}

/**
 * Builds Vanishing Illusions' simultaneous multi-seat KO choice, or undefined when no
 * other seat holds a Victory-Pile Villain.
 *
 * Every seat in `otherSeats` that holds ≥1 Victory-Pile Villain is addressed with one
 * option per such Villain (label = card name, carrying the Villain ext_id in `cardId`).
 * A seat with no Victory-Pile Villain is not addressed (it no-ops).
 *
 * @param G - The game state (read for victory piles + card display names).
 * @param otherSeats - Every seat except the defeating player (ascending).
 * @returns The pending KO choice, or undefined when no other seat qualifies.
 */
export function buildVanishingIllusionsChoice(
  G: LegendaryGameState,
  otherSeats: readonly string[],
): PendingSeatChoice | undefined {
  const addressedSeats: string[] = [];
  const seatPrompts: Record<string, { options: SeatChoiceOption[] }> = {};
  for (const seat of otherSeats) {
    const zones = G.playerZones[seat];
    if (!zones) {
      continue;
    }
    const options: SeatChoiceOption[] = [];
    for (const cardId of zones.victory) {
      if (isVictoryPileVillain(cardId)) {
        options.push({ label: resolveCardName(G.cardDisplayData, cardId), cardId });
      }
    }
    if (options.length === 0) {
      continue;
    }
    addressedSeats.push(seat);
    seatPrompts[seat] = { options };
  }
  if (addressedSeats.length === 0) {
    return undefined;
  }
  return {
    kind: VANISHING_ILLUSIONS_KO_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: the bot/sim + disconnect default KOs each seat's FIRST Victory-Pile Villain
    // (index 0, ascending victory-pile order) — deterministic and always in range.
    defaultOptionIndex: 0,
  };
}

/**
 * Applies a fully-submitted Vanishing Illusions KO ATOMICALLY: every addressed seat's
 * chosen Villain moves from its Victory Pile to the top-level KO pile (G.ko).
 *
 * // why: WP-694 / D-24511 — seats are iterated in ASCENDING id order, so the resolution
 * is byte-identical regardless of submission order (the multi-seat determinism guarantee).
 * The chosen Villain is removed from the seat's own Victory Pile and appended to G.ko via
 * koCard (the top-level KO pile, NOT G.piles.ko). moveCardFromZone removes the exact
 * instance from the Victory Pile; a stale/missing target is a silent skip (moves never throw).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'vanishing-illusions-ko').
 */
export function applyVanishingIllusionsKo(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const seatsInApplyOrder = [...choice.addressedSeats].sort();
  for (const seat of seatsInApplyOrder) {
    const submission = choice.submissions[seat];
    if (submission === undefined) {
      continue;
    }
    const option = choice.seatPrompts[seat]?.options[submission.optionIndex];
    const cardId = option?.cardId;
    if (cardId === undefined) {
      continue;
    }
    const zones = G.playerZones[seat];
    if (!zones) {
      continue;
    }
    // why: remove the chosen Villain from the seat's Victory Pile (the discarded `to`
    // is unused), then append it to the top-level G.ko via koCard — the enforced KO
    // destination for this tactic (NOT G.piles.ko).
    const removal = moveCardFromZone(zones.victory, [], cardId);
    if (!removal.found) {
      continue;
    }
    zones.victory = removal.from;
    G.ko = koCard(G.ko, cardId);
    pushLog(
      G,
      `Player ${seat} KO'd ${resolveCardName(G.cardDisplayData, cardId)} from their Victory Pile (Vanishing Illusions).`,
      'applied',
    );
  }
}
