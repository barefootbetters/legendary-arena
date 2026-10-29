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
 *     each other player picks one Victory-Pile Villain to KO, Henchmen included per
 *     D-24742); a seat with no Victory-Pile Villain is not addressed (no-op).
 *   - Fallen Idols (Baron Zemo, WP-818 / D-24752) — "Each other player that is not a
 *     Savior discards a card." A SIMULTANEOUS MULTI-SEAT discard (kind
 *     'fallen-idols-discard') for the other non-Savior seats, the Monarch's discard shape.
 *   - Arnim Zola (ca75, WP-821 / D-24754) — Computer-Uploaded Genius reuses the Fallen
 *     Idols discard body (kind 'computer-uploaded-genius-discard'); Dominate the Weak is
 *     one active-seat "Player N gains <Hero>" choice (kind 'dominate-the-weak-gain');
 *     Crush Pacifist Resistance is a two-step active-seat "KO up to two" chain (kinds
 *     'crush-pacifist-resistance-ko' then 'crush-pacifist-resistance-last-ko').
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
import { recordOwnedCardKoed } from '../hero/deferredConditionalGrants.js';
import { refillHqSlot } from '../board/city.logic.js';
import { offPlayCardStats } from '../hero/splitCard.logic.js';
import { pushLog } from '../log/logPush.js';
import { describeKoSourceZone, resolveCardName } from '../log/logDisplay.js';
import { getEligibleVictoryVillains } from './resolveVictoryPileCardPick.js';
import { listCrushEligibleTargets } from '../mastermind/arnimZola.logic.js';

/** Discriminant for Monarch's Decree's active single-seat draw-vs-discard mode choice. */
export const MONARCHS_DECREE_MODE_KIND = 'monarchs-decree-mode';
/** Discriminant for Monarch's Decree's simultaneous multi-seat discard step. */
export const MONARCHS_DISCARD_KIND = 'monarchs-discard';
/** Discriminant for Vanishing Illusions' simultaneous multi-seat KO-a-Victory-Pile-Villain choice. */
export const VANISHING_ILLUSIONS_KO_KIND = 'vanishing-illusions-ko';
/** Discriminant for Baron Zemo's Fallen Idols multi-seat discard (WP-818 / D-24752). */
export const FALLEN_IDOLS_DISCARD_KIND = 'fallen-idols-discard';
/** Discriminant for Arnim Zola's Computer-Uploaded Genius multi-seat discard (WP-821 / D-24754). */
export const COMPUTER_UPLOADED_GENIUS_DISCARD_KIND = 'computer-uploaded-genius-discard';
/** Discriminant for Arnim Zola's Dominate the Weak active-seat "Player N gains <Hero>" choice. */
export const DOMINATE_THE_WEAK_GAIN_KIND = 'dominate-the-weak-gain';
/** Discriminant for Crush Pacifist Resistance's first active-seat KO pick. */
export const CRUSH_PACIFIST_RESISTANCE_KO_KIND = 'crush-pacifist-resistance-ko';
/** Discriminant for Crush Pacifist Resistance's second (last) active-seat KO pick. */
export const CRUSH_PACIFIST_RESISTANCE_LAST_KO_KIND = 'crush-pacifist-resistance-last-ko';

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
    // why: D-24742 — "a Villain" is the broad term, so a Henchman in the Victory Pile
    // counts (rules v23 "Henchmen Are Villains": "Henchman Villain cards are indeed
    // Villains"; D-24603 / D-24608). getEligibleVictoryVillains is the shared
    // Victory-Pile Villain test: the villain + henchman entries of the setup-time
    // villainDeckCardTypes map. Rescued Bystanders are typed 'bystander', a defeated
    // Killbot counts as a Bystander, and Mastermind Tactics never enter the map, so all
    // three stay excluded. The old `-villain-` id-grammar test dropped every Henchman,
    // whose ext_id is `henchman-{group}-NN`.
    const options: SeatChoiceOption[] = [];
    for (const cardId of getEligibleVictoryVillains(G, seat)) {
      options.push({ label: resolveCardName(G.cardDisplayData, cardId), cardId });
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

/**
 * Builds Baron Zemo's Fallen Idols multi-seat discard choice (WP-818 / D-24752), or
 * undefined when no given seat holds a card to discard.
 *
 * Every seat in `seats` that holds ≥1 hand card is addressed with one option per hand
 * card, carrying the exact hand instance in `cardId`. The caller has already removed
 * the Saviors and the defeating player.
 *
 * @param G - The game state (read for hands + card display names).
 * @param seats - The other non-Savior seats (ascending).
 * @returns The pending discard choice, or undefined when no seat can discard.
 */
export function buildFallenIdolsDiscardChoice(
  G: LegendaryGameState,
  seats: readonly string[],
): PendingSeatChoice | undefined {
  return buildHandDiscardChoice(G, seats, FALLEN_IDOLS_DISCARD_KIND);
}

/**
 * Applies a fully-submitted Fallen Idols discard atomically: every addressed seat
 * discards its chosen hand card via the enforced discardFromHand chokepoint, in
 * ascending seat order (the Monarch's discard apply, WP-818 / D-24752).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'fallen-idols-discard').
 */
export function applyFallenIdolsDiscard(G: LegendaryGameState, choice: PendingSeatChoice): void {
  applyHandDiscard(G, choice, 'Fallen Idols');
}

/**
 * Builds Arnim Zola's Computer-Uploaded Genius multi-seat discard choice (WP-821 /
 * D-24754), or undefined when no given seat holds a card to discard.
 *
 * The Fallen Idols shape: one "Discard <card>" option per hand card. The caller has
 * already removed the defeating player and every seat that revealed a Tech Hero.
 *
 * @param G - The game state (read for hands + card display names).
 * @param seats - The other seats without a Tech Hero in hand (ascending).
 * @returns The pending discard choice, or undefined when no seat can discard.
 */
export function buildComputerUploadedGeniusDiscardChoice(
  G: LegendaryGameState,
  seats: readonly string[],
): PendingSeatChoice | undefined {
  return buildHandDiscardChoice(G, seats, COMPUTER_UPLOADED_GENIUS_DISCARD_KIND);
}

/**
 * Applies a fully-submitted Computer-Uploaded Genius discard atomically, in ascending
 * seat order, through the enforced discardFromHand chokepoint (WP-821 / D-24754).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'computer-uploaded-genius-discard').
 */
export function applyComputerUploadedGeniusDiscard(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
): void {
  applyHandDiscard(G, choice, 'Computer-Uploaded Genius');
}

/**
 * Builds a multi-seat "discard any hand card" choice of the given kind, or undefined
 * when no given seat holds a card to discard.
 *
 * // why: WP-821 / D-24754 — Fallen Idols and Computer-Uploaded Genius share this body
 * (Monarch's bare-name discard is the third copy of the loop), so it is extracted once.
 *
 * @param G - The game state (read for hands + card display names).
 * @param seats - The seats to address (ascending).
 * @param kind - The seat-choice kind to stamp on the choice.
 * @returns The pending discard choice, or undefined when no seat can discard.
 */
function buildHandDiscardChoice(
  G: LegendaryGameState,
  seats: readonly string[],
  kind: string,
): PendingSeatChoice | undefined {
  const addressedSeats: string[] = [];
  const seatPrompts: Record<string, { options: SeatChoiceOption[] }> = {};
  for (const seat of seats) {
    const zones = G.playerZones[seat];
    if (!zones || zones.hand.length === 0) {
      continue;
    }
    const options: SeatChoiceOption[] = [];
    for (const cardId of zones.hand) {
      // why: the "Discard <card>" label says what the pick does, so the client's generic
      // "Your choice" prompt heading is enough and no client file changes.
      options.push({ label: `Discard ${resolveCardName(G.cardDisplayData, cardId)}`, cardId });
    }
    addressedSeats.push(seat);
    seatPrompts[seat] = { options };
  }
  if (addressedSeats.length === 0) {
    return undefined;
  }
  return {
    kind,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: the sim + disconnect default discards each seat's FIRST hand card (index 0) —
    // deterministic and always in range.
    defaultOptionIndex: 0,
  };
}

/**
 * Applies a fully-submitted "discard any hand card" choice atomically: every addressed
 * seat discards its chosen hand card via the enforced discardFromHand chokepoint, in
 * ascending seat order, logging the printed card name.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending discard choice.
 * @param sourceName - The printed tactic name for the log line.
 */
function applyHandDiscard(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  sourceName: string,
): void {
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
        `Player ${seat} discarded ${resolveCardName(G.cardDisplayData, cardId)} (${sourceName}).`,
        'applied',
      );
    }
  }
}

/**
 * Gains the HQ Hero at `hqIndex` to `playerId`'s discard for FREE — the forced
 * single-eligible free-recruit path (WP-692 / D-24509).
 *
 * // why: WP-821 / D-24754 — moved verbatim from tacticHandlers.ts (was gainHqHeroFree)
 * so Dominate the Weak's apply, which lives in this module, can share it; tacticHandlers
 * imports this module, so the body could not stay there.
 *
 * @param G - Game state (mutated: `G.hq`, `G.heroDeck`, the recipient's discard).
 * @param playerId - The recipient whose discard the Hero enters.
 * @param hqIndex - The HQ slot to take (expected to hold a non-null Hero).
 * @returns The gained Hero ext_id, or null when the slot was empty.
 */
export function gainHqHeroToDiscard(
  G: LegendaryGameState,
  playerId: string,
  hqIndex: number,
): CardExtId | null {
  const heroId = G.hq[hqIndex];
  if (heroId === null || heroId === undefined) {
    return null;
  }
  // why: WP-692 / D-24509 — FREE recruit: vacate the slot + refill from G.heroDeck via
  // refillHqSlot, but NEVER read or spend `turnEconomy.recruit` (the whole point of the
  // "for free" tactics vs the normal cost-paying recruit path). D-24327 — the gain routes
  // to the recipient's DISCARD, never the victory pile.
  G.hq[hqIndex] = null;
  const refillResult = refillHqSlot(G.hq, hqIndex, G.heroDeck);
  G.hq = refillResult.hq;
  G.heroDeck = refillResult.heroDeck;
  const zones = G.playerZones[playerId];
  if (zones) {
    zones.discard.push(heroId);
  }
  return heroId;
}

/**
 * Builds Arnim Zola's Dominate the Weak choice (WP-821 / D-24754): one active-seat
 * prompt whose options each pair a recipient with an eligible HQ Hero.
 *
 * @param G - The game state (read for seats, HQ costs + card display names).
 * @param currentPlayer - The defeating player (the sole addressed seat, listed first).
 * @param slots - The HQ slots holding a Hero with less than 2 printed Attack (ascending).
 * @returns The pending gain choice to park (or to auto-resolve when it has one option).
 */
export function buildDominateTheWeakChoice(
  G: LegendaryGameState,
  currentPlayer: string,
  slots: readonly number[],
): PendingSeatChoice {
  const otherSeats = Object.keys(G.playerZones)
    .filter((seat) => seat !== currentPlayer)
    .sort();
  const recipients = [currentPlayer, ...otherSeats];
  const heroIds = listDominateHeroesByCostDescending(G, slots);
  // why: you first, then cost-descending, so defaultOptionIndex 0 is "you gain the
  // highest-cost eligible Hero", the D-24343 auto-gain rule the bot, the sim and a
  // timeout take.
  const options: SeatChoiceOption[] = [];
  for (const seat of recipients) {
    for (const heroId of heroIds) {
      options.push({
        label: `Player ${seat} gains ${resolveCardName(G.cardDisplayData, heroId)}`,
        cardId: heroId,
        recipientSeat: seat,
      });
    }
  }
  return {
    kind: DOMINATE_THE_WEAK_GAIN_KIND,
    addressedSeats: [currentPlayer],
    seatPrompts: { [currentPlayer]: { options } },
    submissions: {},
    defaultOptionIndex: 0,
  };
}

/**
 * Lists the Heroes in the given HQ slots by descending off-play cost, keeping
 * ascending slot order on a tie.
 *
 * @param G - The game state (read for the HQ + card stats).
 * @param slots - The HQ slots to read (ascending).
 * @returns The Hero ext_ids in option order.
 */
function listDominateHeroesByCostDescending(
  G: LegendaryGameState,
  slots: readonly number[],
): CardExtId[] {
  const entries: { heroId: CardExtId; slot: number; cost: number }[] = [];
  for (const slot of slots) {
    const heroId = G.hq[slot];
    if (heroId === null || heroId === undefined) {
      continue;
    }
    entries.push({ heroId, slot, cost: offPlayCardStats(G, heroId)?.cost ?? 0 });
  }
  entries.sort((left, right) => {
    if (left.cost !== right.cost) {
      return right.cost - left.cost;
    }
    return left.slot - right.slot;
  });
  const heroIds: CardExtId[] = [];
  for (const entry of entries) {
    heroIds.push(entry.heroId);
  }
  return heroIds;
}

/**
 * Gives the HQ Hero `heroId` to `recipientSeat`'s discard pile for Dominate the Weak
 * and refills its slot. Spends no Recruit.
 *
 * @param G - Game state (mutated: `G.hq`, `G.heroDeck`, the recipient's discard).
 * @param heroId - The HQ Hero to gain.
 * @param recipientSeat - The player who gains it.
 */
export function gainDominateTheWeakHero(
  G: LegendaryGameState,
  heroId: CardExtId,
  recipientSeat: string,
): void {
  const hqIndex = G.hq.indexOf(heroId);
  if (hqIndex === -1) {
    // why: the block-all guard froze the HQ while the choice was open, so a missing
    // Hero is unreachable; silent per the WP-821 exemption.
    return;
  }
  const gainedId = gainHqHeroToDiscard(G, recipientSeat, hqIndex);
  if (gainedId !== null) {
    pushLog(
      G,
      `Player ${recipientSeat} gained ${resolveCardName(G.cardDisplayData, heroId)} from the HQ (Dominate the Weak).`,
      'applied',
    );
  }
}

/**
 * Applies a fully-submitted Dominate the Weak choice: the chosen recipient gains the
 * chosen HQ Hero.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'dominate-the-weak-gain').
 */
export function applyDominateTheWeakGain(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const submitted = readAddressedSeatOption(choice);
  if (submitted === undefined) {
    return;
  }
  const heroId = submitted.option.cardId;
  const recipientSeat = submitted.option.recipientSeat;
  if (heroId === undefined || recipientSeat === undefined) {
    return;
  }
  gainDominateTheWeakHero(G, heroId, recipientSeat);
}

/**
 * Builds one Crush Pacifist Resistance KO pick (WP-821 / D-24754) for the given seat,
 * or undefined when the seat has no Hero with less than 2 printed Attack.
 *
 * @param G - The game state (read for the seat's hand + played cards).
 * @param seat - The defeating player (the sole addressed seat).
 * @param kind - The first-pick or last-pick kind.
 * @returns The pending KO choice, or undefined when nothing is eligible.
 */
export function buildCrushPacifistResistanceChoice(
  G: LegendaryGameState,
  seat: string,
  kind: string,
): PendingSeatChoice | undefined {
  const targets = listCrushEligibleTargets(G, seat);
  if (targets.length === 0) {
    return undefined;
  }
  const options: SeatChoiceOption[] = [];
  for (const target of targets) {
    options.push({
      label: `KO ${resolveCardName(G.cardDisplayData, target.cardId)} from ${describeKoSourceZone(target.zone)}`,
      cardId: target.cardId,
      sourceZone: target.zone,
    });
  }
  options.push({ label: 'KO nothing' });
  return {
    kind,
    addressedSeats: [seat],
    seatPrompts: { [seat]: { options } },
    submissions: {},
    // why: "up to two" is optional, so the absent-seat default (a timeout, the sim)
    // KOs nothing: the safe floor.
    defaultOptionIndex: options.length - 1,
  };
}

/**
 * Reports whether the addressed seat picked a Hero (not "KO nothing") on a
 * fully-submitted Crush Pacifist Resistance choice.
 *
 * @param choice - The fully-submitted pending KO choice.
 * @returns true when the submitted option carries a card.
 */
export function didCrushChooseKo(choice: PendingSeatChoice): boolean {
  const submitted = readAddressedSeatOption(choice);
  return submitted?.option.cardId !== undefined;
}

/**
 * Applies a fully-submitted Crush Pacifist Resistance pick: KO the chosen Hero from
 * its zone, or log the decline.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending KO choice (either Crush kind).
 */
export function applyCrushPacifistResistanceKo(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
): void {
  const submitted = readAddressedSeatOption(choice);
  if (submitted === undefined) {
    return;
  }
  const { seat, option } = submitted;
  const cardId = option.cardId;
  if (cardId === undefined) {
    pushLog(G, `Player ${seat} chose not to KO a Hero (Crush Pacifist Resistance).`, 'neutral');
    return;
  }
  const sourceZone = option.sourceZone;
  const zones = G.playerZones[seat];
  if (sourceZone === undefined || !zones) {
    return;
  }
  // why: the zone is read by name from the option, as resolveKoHeroChoice reads its
  // payload zone (moves/koHeroChoice.resolve.ts:111); the starter id may sit in both zones.
  const removal = moveCardFromZone(zones[sourceZone], [], cardId);
  if (!removal.found) {
    return;
  }
  zones[sourceZone] = removal.from;
  G.ko = koCard(G.ko, cardId);
  // why: WP-853 / D-24789 — the chosen seat owns the KO'd card, not the active player.
  recordOwnedCardKoed(G, seat);
  pushLog(
    G,
    `Player ${seat} KO'd ${resolveCardName(G.cardDisplayData, cardId)} from ${describeKoSourceZone(sourceZone)} (Crush Pacifist Resistance).`,
    'applied',
  );
}

/**
 * Reads the single addressed seat and its submitted option on an active-seat choice.
 *
 * @param choice - The fully-submitted pending choice (one addressed seat).
 * @returns The seat and its option, or undefined when nothing valid was submitted.
 */
function readAddressedSeatOption(
  choice: PendingSeatChoice,
): { seat: string; option: SeatChoiceOption } | undefined {
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
