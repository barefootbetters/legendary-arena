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
 *   - Zarathos (mdns, WP-758 / D-24588) — Eruption of Hellfire and Corrupted Spirit of
 *     Vengeance are multi-seat "discard a Hero of the class pair or <alternative>" choices
 *     (kinds 'zarathos-eruption' / 'zarathos-corrupted-spirit'); Imprison in the Soul
 *     Crystal is an active-seat optional Victory-Pile Villain KO (kind 'zarathos-imprison');
 *     Demonic Essence of Ghost Rider is one or two active-seat optional Hero KOs (kinds
 *     'zarathos-demonic-essence-first' then 'zarathos-demonic-essence-last'). Corrupted
 *     Spirit's "discards down to 3" is a multi-seat one-card-per-round discard (kind
 *     'zarathos-corrupted-spirit-discard-down', WP-882 / D-24833) that resolveSeatChoice
 *     re-chains until every owing seat holds 3 cards.
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
// why: WP-758 / D-24588 — Zarathos's seat choices. The class read, the Wound chokepoint,
// the scoring-mirroring VP read and the discard-down-to-N picker are each imported from
// their one home. wounds.logic and mastermindHandlers reach seatChoice.resolve (and so
// this module) transitively; every binding here is read only inside function bodies, so
// the cycle is runtime-safe (the villainEscapeProcedure precedent, D-24656).
import { offPlayCardHasAnyClass } from '../mastermind/zarathos.logic.js';
import { gainWoundWithOutcome } from '../board/wounds.logic.js';
import { victoryPointValueForCard } from '../economy/bloodFrenzy.logic.js';
import { selectDiscardToLimitCards } from '../rules/mastermindHandlers.js';
import { BYSTANDER_EXT_ID, WOUND_EXT_ID } from '../setup/pilesInit.js';

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
  recordOwnedCardKoed(G, seat, cardId, sourceZone);
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

// ---------------------------------------------------------------------------
// Zarathos (mdns, WP-758 / D-24588) — the four tactics' seat choices
// ---------------------------------------------------------------------------

/** Discriminant for Eruption of Hellfire's multi-seat "discard a covert/ranged Hero or gain a Wound". */
export const ZARATHOS_ERUPTION_KIND = 'zarathos-eruption';
/** Discriminant for Corrupted Spirit of Vengeance's multi-seat "discard an instinct/covert Hero or discard down to 3". */
export const ZARATHOS_CORRUPTED_SPIRIT_KIND = 'zarathos-corrupted-spirit';
/** Discriminant for Imprison in the Soul Crystal's active-seat optional Victory-Pile Villain KO. */
export const ZARATHOS_IMPRISON_KIND = 'zarathos-imprison';
/** Discriminant for Demonic Essence of Ghost Rider's first of two owed optional KOs. */
export const ZARATHOS_DEMONIC_ESSENCE_FIRST_KIND = 'zarathos-demonic-essence-first';
/** Discriminant for Demonic Essence of Ghost Rider's last (or only) owed optional KO. */
export const ZARATHOS_DEMONIC_ESSENCE_LAST_KIND = 'zarathos-demonic-essence-last';
/** Discriminant for Corrupted Spirit of Vengeance's multi-seat one-card-per-round discard down to 3. */
export const ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND = 'zarathos-corrupted-spirit-discard-down';

// why: D-24588 — the printed "discards down to 3 cards" target hand size.
export const ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT = 3;

/** The Wound option label on an Eruption of Hellfire prompt. */
const ZARATHOS_GAIN_WOUND_LABEL = 'Gain a Wound';
/** The discard-down option label on a Corrupted Spirit of Vengeance prompt. */
const ZARATHOS_DISCARD_DOWN_LABEL = `Discard down to ${String(ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT)} cards`;
/** The decline option label on an Imprison / Demonic Essence prompt. */
const ZARATHOS_DECLINE_KO_LABEL = "Don't KO";

/**
 * Lists a seat's hand Heroes of any of `classes`, ascending by off-play cost, keeping
 * hand order on a tie and one entry per card id.
 *
 * // why: D-24588 — ascending cost puts the cheapest matching Hero at option 0, the
 * default an absent seat (or the sim) takes, so the default gives up the least. A card
 * id repeated in the hand is outcome-identical to discard, so it is listed once.
 *
 * @param G - The game state (read-only).
 * @param seat - The seat whose hand is scanned.
 * @param classes - The tactic's class pair.
 * @returns The matching hand card ids in option order; `[]` when none match.
 */
export function listZarathosHandHeroesByCost(
  G: LegendaryGameState,
  seat: string,
  classes: readonly string[],
): CardExtId[] {
  const zones = G.playerZones[seat];
  if (!zones) {
    return [];
  }
  const entries: { cardId: CardExtId; handIndex: number; cost: number }[] = [];
  for (let handIndex = 0; handIndex < zones.hand.length; handIndex++) {
    const cardId = zones.hand[handIndex]!;
    const isListed = entries.some((entry) => entry.cardId === cardId);
    if (isListed || !offPlayCardHasAnyClass(G, cardId, classes)) {
      continue;
    }
    entries.push({ cardId, handIndex, cost: offPlayCardStats(G, cardId)?.cost ?? 0 });
  }
  entries.sort((left, right) => {
    if (left.cost !== right.cost) {
      return left.cost - right.cost;
    }
    return left.handIndex - right.handIndex;
  });
  const cardIds: CardExtId[] = [];
  for (const entry of entries) {
    cardIds.push(entry.cardId);
  }
  return cardIds;
}

/**
 * Builds a Zarathos multi-seat "discard a matching Hero or <alternative>" choice, or
 * undefined when no given seat is addressed.
 *
 * @param G - The game state (read-only).
 * @param seats - The seats that hold a matching Hero (ascending).
 * @param classes - The tactic's class pair.
 * @param kind - The seat-choice kind to stamp.
 * @param alternativeLabel - The trailing non-discard option, or undefined to offer none.
 * @returns The pending choice, or undefined when no seat holds a matching Hero.
 */
function buildZarathosHandDiscardChoice(
  G: LegendaryGameState,
  seats: readonly string[],
  classes: readonly string[],
  kind: string,
  alternativeLabel: string | undefined,
): PendingSeatChoice | undefined {
  const addressedSeats: string[] = [];
  const seatPrompts: Record<string, { options: SeatChoiceOption[] }> = {};
  for (const seat of seats) {
    const options: SeatChoiceOption[] = [];
    for (const cardId of listZarathosHandHeroesByCost(G, seat, classes)) {
      options.push({ label: `Discard ${resolveCardName(G.cardDisplayData, cardId)}`, cardId });
    }
    if (options.length === 0) {
      continue;
    }
    if (alternativeLabel !== undefined) {
      options.push({ label: alternativeLabel });
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
    // why: D-24588 — option 0 (discard the cheapest matching Hero) is the absent-seat and
    // sim default for both multi-seat kinds: deterministic and always in range.
    defaultOptionIndex: 0,
  };
}

/**
 * Builds Eruption of Hellfire's multi-seat choice for the seats holding a covert or
 * ranged Hero.
 *
 * // why: rules v23 L3199-3201 / D-24770 — a player picks only an option they can do,
 * so "Gain a Wound" is offered only while the Wound supply still has one. The caller
 * builds this AFTER the auto-Wound pass, so the supply check sees those Wounds.
 *
 * @param G - The game state (read-only).
 * @param seats - The other seats holding a matching Hero (ascending).
 * @param classes - Eruption's class pair (covert, ranged).
 * @returns The pending choice, or undefined when no seat is addressed.
 */
export function buildZarathosEruptionChoice(
  G: LegendaryGameState,
  seats: readonly string[],
  classes: readonly string[],
): PendingSeatChoice | undefined {
  const woundLabel = G.piles.wounds.length > 0 ? ZARATHOS_GAIN_WOUND_LABEL : undefined;
  return buildZarathosHandDiscardChoice(G, seats, classes, ZARATHOS_ERUPTION_KIND, woundLabel);
}

/**
 * Builds Corrupted Spirit of Vengeance's multi-seat choice for the seats holding an
 * instinct or covert Hero and more than 3 cards.
 *
 * // why: WP-882 / D-24833 — the forced seats (more than 3 cards, no matching Hero) wait
 * for the Hero-holders' answer and then join the first discard-down round, but a seat
 * that discarded a Hero may still hold more than 3 cards and must not join. Nothing in G
 * tells them apart after the apply, so the forced seats ride on this choice as
 * `zarathosDiscardDownSeats` (the communeSpiritWorld payload precedent). It is stamped
 * only on a defined choice and only when non-empty, so a choice with no forced seat is
 * byte-identical to the WP-758 one.
 *
 * @param G - The game state (read-only).
 * @param seats - The other seats with more than 3 cards and a matching Hero (ascending).
 * @param classes - Corrupted Spirit's class pair (instinct, covert).
 * @param discardDownSeats - The seats that must discard down with no choice (any order).
 * @returns The pending choice, or undefined when no seat is addressed.
 */
export function buildZarathosCorruptedSpiritChoice(
  G: LegendaryGameState,
  seats: readonly string[],
  classes: readonly string[],
  discardDownSeats: readonly string[] = [],
): PendingSeatChoice | undefined {
  const choice = buildZarathosHandDiscardChoice(
    G,
    seats,
    classes,
    ZARATHOS_CORRUPTED_SPIRIT_KIND,
    ZARATHOS_DISCARD_DOWN_LABEL,
  );
  if (choice === undefined) {
    return undefined;
  }
  if (discardDownSeats.length > 0) {
    choice.zarathosDiscardDownSeats = [...discardDownSeats].sort();
  }
  return choice;
}

/**
 * Builds Corrupted Spirit of Vengeance's multi-seat discard-down round for the given
 * seats still holding more than 3 cards, or undefined when none does.
 *
 * // why: WP-882 / D-24833 — closes D-24588 §6's named fidelity gap: the player picks
 * which cards to drop. Each seat's options list its hand in selectDiscardToLimitCards
 * order (one option per distinct id), so option 0 is the selector's next pick. The
 * selector is greedy over the remaining hand and discardFromHand removes the FIRST copy
 * of the id (equal ids share a cost, so it is the copy the selector would take), so N
 * defaulted rounds discard exactly the cards, in order, that the WP-758 auto-pick did.
 *
 * // why: one card per round — a seat choice resolves one optionIndex per seat (the
 * WP-860 Commune precedent, D-24796); resolveSeatChoice re-chains the next round.
 *
 * @param G - The game state (read-only).
 * @param seats - The seats that owe the discard-down (any order).
 * @returns The pending choice, or undefined when every given seat holds 3 or fewer cards.
 */
export function buildZarathosDiscardDownChoice(
  G: LegendaryGameState,
  seats: readonly string[],
): PendingSeatChoice | undefined {
  const addressedSeats: string[] = [];
  const seatPrompts: Record<string, { options: SeatChoiceOption[] }> = {};
  for (const seat of [...seats].sort()) {
    const zones = G.playerZones[seat];
    if (!zones || zones.hand.length <= ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT) {
      continue;
    }
    const options: SeatChoiceOption[] = [];
    for (const cardId of selectDiscardToLimitCards(G, zones.hand, zones.hand.length)) {
      const isListed = options.some((option) => option.cardId === cardId);
      if (!isListed) {
        options.push({ label: `Discard ${resolveCardName(G.cardDisplayData, cardId)}`, cardId });
      }
    }
    addressedSeats.push(seat);
    seatPrompts[seat] = { options };
  }
  if (addressedSeats.length === 0) {
    return undefined;
  }
  return {
    kind: ZARATHOS_CORRUPTED_SPIRIT_DISCARD_DOWN_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: option 0 is the selector's next pick, so the absent-seat / sim / PAR default
    // reproduces the WP-758 auto-pick in set and order (the parity test proves it).
    defaultOptionIndex: 0,
  };
}

/**
 * Lists the seats that owe Corrupted Spirit's discard-down once its choice resolved:
 * the forced seats carried on the choice plus every addressed seat whose submitted
 * option is the discard-down (no cardId). Deduplicated, ascending.
 *
 * // why: WP-882 / D-24833 — read from the submitted option, not addressedSeats, so a
 * seat that discarded a Hero and still holds more than 3 cards is not asked again.
 *
 * @param choice - The fully-submitted Corrupted Spirit choice.
 * @returns The owing seats, ascending.
 */
export function readZarathosDiscardDownSeats(choice: PendingSeatChoice): string[] {
  const seats: string[] = [...(choice.zarathosDiscardDownSeats ?? [])];
  for (const seat of choice.addressedSeats) {
    const option = readSeatOption(choice, seat);
    if (option !== undefined && option.cardId === undefined && !seats.includes(seat)) {
      seats.push(seat);
    }
  }
  return seats.sort();
}

/**
 * Gains `seat` a Wound for Eruption of Hellfire through the Wound chokepoint and logs
 * it honestly (D-24673).
 *
 * @param G - The game state, mutated in place.
 * @param seat - The seat gaining the Wound.
 */
export function gainZarathosEruptionWound(G: LegendaryGameState, seat: string): void {
  const outcome = gainWoundWithOutcome(G, seat);
  if (outcome === 'gained') {
    pushLog(G, `Player ${seat} gained a Wound (Eruption of Hellfire).`, 'applied');
  } else if (outcome === 'diving-block-pending') {
    pushLog(G, `Player ${seat} would gain a Wound — Diving Block can prevent it (Eruption of Hellfire).`, 'applied');
  } else {
    pushLog(G, `Player ${seat} gained no Wound — the Wound supply is empty (Eruption of Hellfire).`, 'blocked');
  }
}

/**
 * Applies one fully-submitted Corrupted Spirit discard-down round: each addressed seat
 * discards its chosen card through the discardFromHand chokepoint.
 *
 * // why: WP-882 / D-24833 §5 — ascending seat order (D-24501, the D-24780 §8 / §13
 * ascending-apply exception), so the result is the same whatever order the seats
 * answered in. The forced seats' return-on-discard reactions therefore queue in
 * ascending seat order, not clockwise as the WP-758 handler-time discard queued them.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'zarathos-corrupted-spirit-discard-down').
 */
export function applyZarathosDiscardDown(G: LegendaryGameState, choice: PendingSeatChoice): void {
  for (const seat of [...choice.addressedSeats].sort()) {
    const option = readSeatOption(choice, seat);
    if (option === undefined || option.cardId === undefined) {
      continue;
    }
    if (discardFromHand(G, seat, option.cardId)) {
      pushLog(G, `Player ${seat} discarded ${resolveCardName(G.cardDisplayData, option.cardId)} (Corrupted Spirit of Vengeance).`, 'applied');
    }
  }
}

/**
 * Applies a fully-submitted Eruption of Hellfire choice: each addressed seat discards
 * its chosen Hero, or gains a Wound.
 *
 * // why: D-24780 §6 / D-24501 — a simultaneous seat-choice apply runs in ascending seat
 * order, so the result is the same whatever order the seats answered in.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'zarathos-eruption').
 */
export function applyZarathosEruption(G: LegendaryGameState, choice: PendingSeatChoice): void {
  for (const seat of [...choice.addressedSeats].sort()) {
    const option = readSeatOption(choice, seat);
    if (option === undefined) {
      continue;
    }
    if (option.cardId === undefined) {
      gainZarathosEruptionWound(G, seat);
      continue;
    }
    if (discardFromHand(G, seat, option.cardId)) {
      pushLog(G, `Player ${seat} discarded ${resolveCardName(G.cardDisplayData, option.cardId)} (Eruption of Hellfire).`, 'applied');
    }
  }
}

/**
 * Applies a fully-submitted Corrupted Spirit of Vengeance choice: each addressed seat
 * discards its chosen Hero, or chooses to discard down to 3 cards. Ascending seat order
 * (D-24780 §6).
 *
 * // why: WP-882 / D-24833 — the discard-down option discards nothing here; the seat
 * picks its own cards in the discard-down rounds resolveSeatChoice chains next.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'zarathos-corrupted-spirit').
 */
export function applyZarathosCorruptedSpirit(G: LegendaryGameState, choice: PendingSeatChoice): void {
  for (const seat of [...choice.addressedSeats].sort()) {
    const option = readSeatOption(choice, seat);
    if (option === undefined) {
      continue;
    }
    if (option.cardId === undefined) {
      pushLog(G, `Player ${seat} chose to discard down to ${String(ZARATHOS_CORRUPTED_SPIRIT_HAND_LIMIT)} cards (Corrupted Spirit of Vengeance).`, 'neutral');
      continue;
    }
    if (discardFromHand(G, seat, option.cardId)) {
      pushLog(G, `Player ${seat} discarded ${resolveCardName(G.cardDisplayData, option.cardId)} (Corrupted Spirit of Vengeance).`, 'applied');
    }
  }
}

/**
 * Reads a Victory-Pile Villain's VP the way final scoring would, floored at 0.
 *
 * // why: D-24598 / R-3 — victoryPointValueForCard is the shared scoring mirror (printed
 * VP, else VP_VILLAIN / VP_HENCHMAN, dynamic VP included), so "draw cards equal to that
 * Villain's VP" never disagrees with the score. A negative VP draws nothing.
 *
 * @param G - The game state (read-only).
 * @param seat - The Victory Pile's owner.
 * @param cardId - The Villain in that Victory Pile.
 * @returns The Villain's VP, at least 0.
 */
function readZarathosImprisonVictoryPoints(
  G: LegendaryGameState,
  seat: string,
  cardId: CardExtId,
): number {
  const victoryPoints = victoryPointValueForCard(G, seat, cardId) ?? 0;
  return Math.max(0, victoryPoints);
}

/**
 * Builds Imprison in the Soul Crystal's active-seat choice, or undefined when the
 * seat has no Villain in its Victory Pile.
 *
 * // why: D-24742 — "a Villain" is the broad term, so a Henchman counts
 * (getEligibleVictoryVillains: the villain + henchman entries, a defeated Killbot out).
 *
 * @param G - The game state (read-only).
 * @param seat - The defeating player (the sole addressed seat).
 * @returns The pending choice, or undefined when no Villain qualifies.
 */
export function buildZarathosImprisonChoice(
  G: LegendaryGameState,
  seat: string,
): PendingSeatChoice | undefined {
  const villainIds = getEligibleVictoryVillains(G, seat);
  if (villainIds.length === 0) {
    return undefined;
  }
  const options: SeatChoiceOption[] = [];
  for (const cardId of villainIds) {
    const victoryPoints = readZarathosImprisonVictoryPoints(G, seat, cardId);
    options.push({
      label: `KO ${resolveCardName(G.cardDisplayData, cardId)} — draw ${String(victoryPoints)}`,
      cardId,
    });
  }
  options.push({ label: ZARATHOS_DECLINE_KO_LABEL });
  return {
    kind: ZARATHOS_IMPRISON_KIND,
    addressedSeats: [seat],
    seatPrompts: { [seat]: { options } },
    submissions: {},
    // why: D-24588 — "you may KO": the absent-seat default is the decline (the last
    // option), which also keeps the shuffle-less timeout path draw-free.
    defaultOptionIndex: options.length - 1,
  };
}

/**
 * Applies a fully-submitted Imprison in the Soul Crystal choice: KO the chosen Villain
 * from the Victory Pile, then draw cards equal to its VP; or log the decline.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (kind 'zarathos-imprison').
 * @param shuffleContext - Deterministic reshuffle source, or undefined (timeout path).
 * @param currentPlayer - The turn's active player, or undefined on the timeout path.
 */
export function applyZarathosImprison(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  shuffleContext: ShuffleProvider | undefined,
  currentPlayer?: string,
): void {
  const submitted = readAddressedSeatOption(choice);
  if (submitted === undefined) {
    return;
  }
  const { seat, option } = submitted;
  const zones = G.playerZones[seat];
  if (option.cardId === undefined || !zones) {
    pushLog(G, `Player ${seat} chose not to KO a Villain (Imprison in the Soul Crystal).`, 'neutral');
    return;
  }
  // why: read the VP while the Villain is still in the pile — a dynamic VP counts the pile.
  const victoryPoints = readZarathosImprisonVictoryPoints(G, seat, option.cardId);
  const removal = moveCardFromZone(zones.victory, [], option.cardId);
  if (!removal.found) {
    return;
  }
  zones.victory = removal.from;
  G.ko = koCard(G.ko, option.cardId);
  const drawn = drawZarathosImprisonCards(G, seat, victoryPoints, shuffleContext, currentPlayer);
  pushLog(
    G,
    `Player ${seat} KO'd ${resolveCardName(G.cardDisplayData, option.cardId)} from their Victory Pile and drew ${String(drawn)} card(s) (Imprison in the Soul Crystal).`,
    'applied',
  );
}

/**
 * Draws Imprison's VP cards for `seat` and counts them toward the turn's cards drawn.
 *
 * @param G - Game state (mutated).
 * @param seat - The drawing seat.
 * @param count - How many cards to draw (the Villain's VP).
 * @param shuffleContext - Deterministic reshuffle source, or undefined (timeout path).
 * @param currentPlayer - The turn's active player, or undefined.
 * @returns How many cards were actually drawn.
 */
function drawZarathosImprisonCards(
  G: LegendaryGameState,
  seat: string,
  count: number,
  shuffleContext: ShuffleProvider | undefined,
  currentPlayer: string | undefined,
): number {
  const zones = G.playerZones[seat];
  if (!zones || count === 0) {
    return 0;
  }
  // why: the timeout default is the decline, so it never reaches a draw; an identity
  // Shuffle keeps the apply total and deterministic anyway (the Monarch's Decree fallback).
  const effectiveShuffle: ShuffleProvider =
    shuffleContext ?? { random: { Shuffle: <T>(deck: T[]): T[] => deck } };
  const handBefore = zones.hand.length;
  drawCardsIntoHand(zones, count, effectiveShuffle);
  const drawn = zones.hand.length - handBefore;
  // why: D-24732 — these are the defeating (current) player's extra cards drawn this
  // turn, as HYDRA Conspiracy's are.
  if (seat === currentPlayer && G.turnEconomy !== undefined) {
    G.turnEconomy.cardsDrawn += drawn;
  }
  return drawn;
}

/**
 * Lists a player's Heroes Demonic Essence may KO: the hand, then the cards played this
 * turn, one target per (zone, card id), Wounds and Bystanders excluded.
 *
 * // why: rules v23 L3439 — "your Heroes" are your hand plus the cards you played this
 * turn, never the deck or discard pile (D-24687). The listCrushEligibleTargets shape
 * without its Attack filter: S.H.I.E.L.D. starter ids repeat, so a zone lists an id once
 * and the option carries its zone. A Wound or Bystander is not a Hero (the WP-828 rule).
 *
 * @param G - The game state (read-only).
 * @param seat - The defeating player.
 * @returns The KO targets in option order.
 */
function listZarathosDemonicTargets(
  G: LegendaryGameState,
  seat: string,
): { zone: 'hand' | 'inPlay'; cardId: CardExtId }[] {
  const targets: { zone: 'hand' | 'inPlay'; cardId: CardExtId }[] = [];
  const zones = G.playerZones[seat];
  if (!zones) {
    return targets;
  }
  for (const zone of ['hand', 'inPlay'] as const) {
    const seenCardIds = new Set<CardExtId>();
    for (const cardId of zones[zone]) {
      if (cardId === WOUND_EXT_ID || cardId === BYSTANDER_EXT_ID || seenCardIds.has(cardId)) {
        continue;
      }
      seenCardIds.add(cardId);
      targets.push({ zone, cardId });
    }
  }
  return targets;
}

/**
 * Builds one Demonic Essence of Ghost Rider KO pick for `seat`, or undefined when the
 * seat has no Hero to KO.
 *
 * @param G - The game state (read-only).
 * @param seat - The defeating player (the sole addressed seat).
 * @param kind - The first or last Demonic Essence kind.
 * @returns The pending choice, or undefined when nothing can be KO'd.
 */
export function buildZarathosDemonicEssenceChoice(
  G: LegendaryGameState,
  seat: string,
  kind: string,
): PendingSeatChoice | undefined {
  const targets = listZarathosDemonicTargets(G, seat);
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
  options.push({ label: ZARATHOS_DECLINE_KO_LABEL });
  return {
    kind,
    addressedSeats: [seat],
    seatPrompts: { [seat]: { options } },
    submissions: {},
    // why: D-24588 — "you may KO": the absent-seat default is the decline (the last option).
    defaultOptionIndex: options.length - 1,
  };
}

/**
 * Applies a fully-submitted Demonic Essence of Ghost Rider pick (either kind): KO the
 * chosen Hero from its zone, or log the decline.
 *
 * @param G - Game state (mutated under Immer draft).
 * @param choice - The fully-submitted pending choice (a Demonic Essence kind).
 */
export function applyZarathosDemonicEssence(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const submitted = readAddressedSeatOption(choice);
  if (submitted === undefined) {
    return;
  }
  const { seat, option } = submitted;
  const cardId = option.cardId;
  const sourceZone = option.sourceZone;
  const zones = G.playerZones[seat];
  if (cardId === undefined || (sourceZone !== 'hand' && sourceZone !== 'inPlay') || !zones) {
    pushLog(G, `Player ${seat} chose not to KO a Hero (Demonic Essence of Ghost Rider).`, 'neutral');
    return;
  }
  // why: the zone is read by name from the option, as Crush Pacifist Resistance reads it.
  const removal = moveCardFromZone(zones[sourceZone], [], cardId);
  if (!removal.found) {
    return;
  }
  zones[sourceZone] = removal.from;
  G.ko = koCard(G.ko, cardId);
  // why: WP-853 / D-24789 — the KO'd card's owner may have a waiting owned-KO grant.
  recordOwnedCardKoed(G, seat, cardId, sourceZone);
  pushLog(
    G,
    `Player ${seat} KO'd ${resolveCardName(G.cardDisplayData, cardId)} from ${describeKoSourceZone(sourceZone)} (Demonic Essence of Ghost Rider).`,
    'applied',
  );
}

/**
 * Reads one addressed seat's submitted option on a multi-seat choice.
 *
 * @param choice - The fully-submitted pending choice.
 * @param seat - The addressed seat.
 * @returns The submitted option, or undefined when the seat submitted nothing valid.
 */
function readSeatOption(choice: PendingSeatChoice, seat: string): SeatChoiceOption | undefined {
  const submission = choice.submissions[seat];
  if (submission === undefined) {
    return undefined;
  }
  return choice.seatPrompts[seat]?.options[submission.optionIndex];
}
