/**
 * Size-Changing granted or removed on an HQ Hero during play (WP-862 / D-24804).
 *
 * Six printed effects give a Hero in the HQ Size-Changing:
 * - Pym Particles (antm Ant-Man) and Ultron-Pym (antm): a Hero with no Size-Changing gains
 *   Size-Changing [Tech] this turn.
 * - Shrinksperiments (amwp): a Hero loses all Size-Changing, then gains Size-Changing [Tech] this turn.
 * - Sporr (chmp): a Hero gains Size-Changing [Tech], [Ranged] this turn.
 * - Alien Dragon Technology (chmp Fin Fang Foom tactic): a Hero gets all five classes this turn.
 * - Shrinking Research Budget (amwp Darren Cross tactic): each Hero with no Size-Changing gains
 *   Size-Changing for one of its own Hero Classes, for as long as it stays in the HQ.
 *
 * Each grant is one entry on G.hqSizeChangingGrants, read by the recruit price through
 * getHqCardSizeChanging (sizeChanging.logic.ts) while the card is in the HQ. The Hero is picked
 * through the WP-684 seat choice addressed to the active player: no eligible Hero is a logged
 * no-op, one is granted at once, two or more open a pick.
 *
 * No boardgame.io import, no registry, no .reduce(), never throws. Imported bindings are read
 * only inside function bodies (this module sits in import cycles with seatChoice.resolve,
 * heroEffects.execute and tacticHandlers); the kind constants are string literals.
 */

import type { HqSizeChangingGrant, LegendaryGameState, PendingSeatChoice, SeatChoiceOption } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { parkSeatChoice } from '../moves/seatChoice.resolve.js';
import { isHqSlotHaunted } from '../board/haunt.logic.js';
import { hqCardHasSizeChanging } from './sizeChanging.logic.js';
import { offPlayCardStats, offPlayCardTraits } from './splitCard.logic.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';

/** The seat-choice kind for "choose a Hero in the HQ to gain Size-Changing". */
export const SIZE_CHANGING_GRANT_SEAT_CHOICE_KIND = 'size-changing-grant';
/** The seat-choice kind for Shrinking Research Budget's "which of its classes" pick. */
export const SIZE_CHANGING_CLASS_PICK_SEAT_CHOICE_KIND = 'size-changing-class-pick';

// why: D-24804 — defined once here as a string literal (not in tacticHandlers.ts, which imports
// this module): the class-pick apply and the resolveSeatChoice chain name their source with it, and
// tacticHandlers.ts imports it for its dispatch arm, with no import cycle.
/** Darren Cross's Shrinking Research Budget tactic ext_id. */
export const SHRINKING_RESEARCH_BUDGET_TACTIC_ID: CardExtId =
  'amwp-mastermind-darren-cross-shrinking-research-budget';

// why: D-24804 — the printed order on the cards (Alien Dragon Technology reads "[Strength],
// [Instinct], [Covert], [Tech], [Ranged]"). HERO_CLASSES (content.schemas.ts) uses a different
// order, so labels and the class-pick options use this local list instead.
const SIZE_CHANGING_CLASS_ORDER: readonly { slug: string; word: string }[] = [
  { slug: 'strength', word: 'Strength' },
  { slug: 'instinct', word: 'Instinct' },
  { slug: 'covert', word: 'Covert' },
  { slug: 'tech', word: 'Tech' },
  { slug: 'ranged', word: 'Ranged' },
];

/** How a grant treats the chosen Hero's own Size-Changing. */
export type SizeChangingGrantMode = 'if-none' | 'add' | 'replace';

/** An HQ card together with the slot it sits in. */
interface HqCardAtSlot {
  cardId: CardExtId;
  slot: number;
}

/**
 * Keeps only known class slugs, in the printed class order, each once.
 *
 * @param classes - Candidate class slugs.
 * @returns The ordered, de-duplicated known slugs.
 */
function orderSizeChangingClasses(classes: readonly string[]): string[] {
  const ordered: string[] = [];
  for (const entry of SIZE_CHANGING_CLASS_ORDER) {
    if (classes.includes(entry.slug)) {
      ordered.push(entry.slug);
    }
  }
  return ordered;
}

/**
 * Names a list of class slugs as words: "Tech", "Tech and Ranged", "Strength, Instinct and Covert".
 *
 * @param classes - Ordered class slugs.
 * @returns The readable class list.
 */
function describeClassList(classes: readonly string[]): string {
  const words: string[] = [];
  for (const entry of SIZE_CHANGING_CLASS_ORDER) {
    if (classes.includes(entry.slug)) {
      words.push(entry.word);
    }
  }
  if (words.length <= 1) {
    return words.join('');
  }
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]!}`;
}

/**
 * Returns the log prefix for a grant's source: villain and tactic effects narrate as
 * "Fight effect: " (the keyword-less sibling precedent); a Hero's own ability does not.
 *
 * // why: Hero instance ids are `${set}/${hero}/${card}#${copy}`; villain and tactic ids use the
 * dash grammar and never contain "/".
 *
 * @param sourceCardId - The card whose effect made the grant.
 * @returns "Fight effect: " or the empty string.
 */
function logPrefixFor(sourceCardId: CardExtId): string {
  if (sourceCardId.includes('/')) {
    return '';
  }
  return 'Fight effect: ';
}

/**
 * Appends one grant, creating the overlay on first use.
 *
 * @param G - Game state (mutated).
 * @param grant - The grant to record.
 */
function addHqSizeChangingGrant(G: LegendaryGameState, grant: HqSizeChangingGrant): void {
  // why: D-24804 — lazy, so a match that never grants keeps the field absent (hash-stable).
  if (G.hqSizeChangingGrants === undefined) {
    G.hqSizeChangingGrants = [];
  }
  G.hqSizeChangingGrants.push(grant);
}

/**
 * Lists the HQ cards a grant may target, in slot order.
 *
 * @param G - Game state (read-only).
 * @param mode - `'if-none'` keeps only cards with no Size-Changing right now.
 * @returns The eligible cards with their slots.
 */
function listEligibleHqCards(G: LegendaryGameState, mode: SizeChangingGrantMode): HqCardAtSlot[] {
  const eligible: HqCardAtSlot[] = [];
  for (let slot = 0; slot < G.hq.length; slot++) {
    const cardId = G.hq[slot];
    if (cardId === null || cardId === undefined) {
      continue;
    }
    if (mode === 'if-none' && hqCardHasSizeChanging(G, cardId)) {
      continue;
    }
    eligible.push({ cardId, slot });
  }
  return eligible;
}

/**
 * Orders pick options: recruitable Heroes before Haunted ones, then printed cost descending,
 * then lower slot first.
 *
 * // why: D-24804 — option 0 is the bot / timeout default, so it should never be a Haunted Hero
 * (which cannot be recruited) while a recruitable one exists, and should be the priciest Hero.
 *
 * @param G - Game state (read-only).
 * @param cards - The eligible cards.
 * @returns A new array in option order.
 */
function orderPickCards(G: LegendaryGameState, cards: readonly HqCardAtSlot[]): HqCardAtSlot[] {
  const ordered = [...cards];
  ordered.sort((left, right) => {
    const leftHaunted = isHqSlotHaunted(G, left.slot) ? 1 : 0;
    const rightHaunted = isHqSlotHaunted(G, right.slot) ? 1 : 0;
    if (leftHaunted !== rightHaunted) {
      return leftHaunted - rightHaunted;
    }
    const leftCost = offPlayCardStats(G, left.cardId)?.cost ?? 0;
    const rightCost = offPlayCardStats(G, right.cardId)?.cost ?? 0;
    if (leftCost !== rightCost) {
      return rightCost - leftCost;
    }
    return left.slot - right.slot;
  });
  return ordered;
}

/**
 * Builds the pick-option label for a grant.
 *
 * @param heroName - The Hero's display name.
 * @param classes - The granted classes.
 * @param replacesPrinted - Whether the grant replaces the Hero's own Size-Changing.
 * @returns The option label.
 */
function buildGrantLabel(heroName: string, classes: readonly string[], replacesPrinted: boolean): string {
  const classWords = describeClassList(classes);
  if (replacesPrinted) {
    return `${heroName} loses its Size-Changing and gains Size-Changing ${classWords} this turn`;
  }
  return `${heroName} gains Size-Changing ${classWords} this turn`;
}

/**
 * Records a "this turn" grant on one HQ Hero and narrates it.
 *
 * @param G - Game state (mutated).
 * @param playerID - The player whose effect made the grant.
 * @param cardId - The HQ Hero.
 * @param classes - The granted classes (ordered).
 * @param replacesPrinted - Whether the grant replaces the Hero's own Size-Changing.
 * @param sourceCardId - The card whose effect made the grant.
 */
function applyThisTurnGrant(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
  classes: readonly string[],
  replacesPrinted: boolean,
  sourceCardId: CardExtId,
): void {
  addHqSizeChangingGrant(G, { cardId, classes: [...classes], replacesPrinted, expiresAtEndOfTurn: true });
  const prefix = logPrefixFor(sourceCardId);
  const heroName = resolveCardName(G.cardDisplayData, cardId);
  const classWords = describeClassList(classes);
  const sourceName = resolveCardName(G.cardDisplayData, sourceCardId);
  if (replacesPrinted) {
    pushLog(G, `${prefix}Player ${playerID} made ${heroName} lose its Size-Changing and gain Size-Changing ${classWords} this turn (${sourceName}).`, 'applied');
    return;
  }
  pushLog(G, `${prefix}Player ${playerID} gave ${heroName} Size-Changing ${classWords} this turn (${sourceName}).`, 'applied');
}

/**
 * Builds the seat choice for "choose a Hero in the HQ to gain Size-Changing".
 *
 * @param G - Game state (read-only).
 * @param playerID - The choosing (active) player.
 * @param cards - The eligible cards (two or more).
 * @param classes - The granted classes (ordered).
 * @param replacesPrinted - Whether the grant replaces the Hero's own Size-Changing.
 * @param sourceCardId - The card whose effect made the grant.
 * @returns The pending seat choice.
 */
function buildGrantChoice(
  G: LegendaryGameState,
  playerID: string,
  cards: readonly HqCardAtSlot[],
  classes: readonly string[],
  replacesPrinted: boolean,
  sourceCardId: CardExtId,
): PendingSeatChoice {
  const options: SeatChoiceOption[] = [];
  for (const card of orderPickCards(G, cards)) {
    const heroName = resolveCardName(G.cardDisplayData, card.cardId);
    options.push({ label: buildGrantLabel(heroName, classes, replacesPrinted), cardId: card.cardId });
  }
  return {
    kind: SIZE_CHANGING_GRANT_SEAT_CHOICE_KIND,
    addressedSeats: [playerID],
    seatPrompts: { [playerID]: { options } },
    submissions: {},
    defaultOptionIndex: 0,
    sizeChangingGrant: { classes: [...classes], replacesPrinted, sourceCardId },
  };
}

/**
 * Gives a chosen Hero in the HQ Size-Changing this turn (WP-862 / D-24804).
 *
 * No eligible Hero → a logged no-op; one → granted at once; two or more → the active player picks
 * through a seat choice (unless another seat choice is open, which blocks the park).
 *
 * @param G - Game state (mutated).
 * @param playerID - The active player whose effect makes the grant.
 * @param classes - The classes to grant (unknown slugs are ignored).
 * @param mode - `'if-none'` (only Heroes with no Size-Changing), `'add'` or `'replace'`.
 * @param sourceCardId - The card whose effect makes the grant.
 * @returns The Hero granted at once, or null when nothing was granted yet.
 */
export function grantSizeChangingToHqHero(
  G: LegendaryGameState,
  playerID: string,
  classes: readonly string[],
  mode: SizeChangingGrantMode,
  sourceCardId: CardExtId,
): CardExtId | null {
  const orderedClasses = orderSizeChangingClasses(classes);
  const replacesPrinted = mode === 'replace';
  const prefix = logPrefixFor(sourceCardId);
  const sourceName = resolveCardName(G.cardDisplayData, sourceCardId);
  const eligible = listEligibleHqCards(G, mode);
  if (orderedClasses.length === 0 || eligible.length === 0) {
    pushLog(G, `${prefix}No Hero in the HQ can gain Size-Changing (${sourceName}).`, 'blocked');
    return null;
  }
  if (eligible.length === 1) {
    // why: one eligible Hero is a forced pick, so it resolves now (the Bitter Captor rule).
    const onlyCardId = eligible[0]!.cardId;
    applyThisTurnGrant(G, playerID, onlyCardId, orderedClasses, replacesPrinted, sourceCardId);
    return onlyCardId;
  }
  // why: WP-860 RS-1 posture — parkSeatChoice overwrites unconditionally, so an open seat
  // choice blocks the park rather than being replaced.
  if (G.pendingSeatChoice !== undefined) {
    pushLog(G, `${prefix}Player ${playerID} could not choose a Hero to gain Size-Changing — another choice is open (${sourceName}).`, 'blocked');
    return null;
  }
  parkSeatChoice(G, undefined, buildGrantChoice(G, playerID, eligible, orderedClasses, replacesPrinted, sourceCardId), playerID);
  pushLog(G, `${prefix}Player ${playerID} chooses a Hero in the HQ to gain Size-Changing (${sourceName}).`, 'neutral');
  return null;
}

/**
 * Reads the single addressed seat's chosen option of a fully-submitted choice.
 *
 * @param choice - The fully-submitted seat choice.
 * @returns The seat and its chosen option, or undefined.
 */
function readChosenOption(choice: PendingSeatChoice): { seat: string; option: SeatChoiceOption } | undefined {
  const seat = choice.addressedSeats[0];
  if (seat === undefined) {
    return undefined;
  }
  const submission = choice.submissions[seat];
  const option = submission === undefined ? undefined : choice.seatPrompts[seat]?.options[submission.optionIndex];
  if (option === undefined) {
    return undefined;
  }
  return { seat, option };
}

/**
 * Applies a resolved "choose a Hero to gain Size-Changing" pick.
 *
 * @param G - Game state (mutated).
 * @param choice - The fully-submitted 'size-changing-grant' choice.
 */
export function applySizeChangingGrantResolvedSeatChoice(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const chosen = readChosenOption(choice);
  const grant = choice.sizeChangingGrant;
  if (chosen === undefined || grant === undefined || chosen.option.cardId === undefined) {
    return;
  }
  const cardId = chosen.option.cardId;
  // why: other resolve moves can change the HQ while the pick is open; a Hero that left gains nothing.
  if (!G.hq.includes(cardId)) {
    const prefix = logPrefixFor(grant.sourceCardId);
    const sourceName = resolveCardName(G.cardDisplayData, grant.sourceCardId);
    pushLog(G, `${prefix}${resolveCardName(G.cardDisplayData, cardId)} is no longer in the HQ, so it gains nothing (${sourceName}).`, 'blocked');
    return;
  }
  const classes = orderSizeChangingClasses(grant.classes);
  applyThisTurnGrant(G, chosen.seat, cardId, classes, grant.replacesPrinted, grant.sourceCardId);
}

/**
 * Returns an HQ card's own Hero Classes (either half of a split card), in the printed class order.
 *
 * @param G - Game state (read-only).
 * @param cardId - The HQ card.
 * @returns Its distinct known class slugs.
 */
function listHeroClassesOf(G: LegendaryGameState, cardId: CardExtId): string[] {
  const traits = offPlayCardTraits(G, cardId);
  const printed: string[] = [];
  if (traits === undefined) {
    return printed;
  }
  if (typeof traits.heroClass === 'string' && traits.heroClass !== '') {
    printed.push(traits.heroClass);
  }
  if (typeof traits.heroClass2 === 'string' && traits.heroClass2 !== '') {
    printed.push(traits.heroClass2);
  }
  return orderSizeChangingClasses(printed);
}

/**
 * Records a Shrinking Research Budget grant (lasts while the card stays in the HQ) and narrates it.
 *
 * @param G - Game state (mutated).
 * @param cardId - The HQ Hero.
 * @param heroClass - The class it gains Size-Changing for.
 * @param sourceCardId - The Shrinking Research Budget tactic (named in the log).
 */
function applyShrinkingResearchBudgetGrant(
  G: LegendaryGameState,
  cardId: CardExtId,
  heroClass: string,
  sourceCardId: CardExtId,
): void {
  // why: D-24804 — the tactic prints no duration; the operator-flagged reading is "while it
  // stays in the HQ", so this grant survives end-of-turn cleanup until the card leaves.
  addHqSizeChangingGrant(G, { cardId, classes: [heroClass], replacesPrinted: false, expiresAtEndOfTurn: false });
  const heroName = resolveCardName(G.cardDisplayData, cardId);
  const sourceName = resolveCardName(G.cardDisplayData, sourceCardId);
  pushLog(G, `Fight effect: ${heroName} gains Size-Changing ${describeClassList([heroClass])} while it stays in the HQ (${sourceName}).`, 'applied');
}

/**
 * Resolves Shrinking Research Budget: "Each Hero currently in the HQ that has no Size-Changing
 * abilities gains Size-Changing for one of its Hero Classes."
 *
 * Single-class Heroes are granted at once; a Hero with no class is logged; the first dual-class
 * Hero opens a class pick and the rest chain from resolveSeatChoice.
 *
 * @param G - Game state (mutated).
 * @param playerID - The player who defeated the tactic.
 * @param sourceCardId - The Shrinking Research Budget tactic (named in the log).
 */
export function resolveShrinkingResearchBudgetGrants(
  G: LegendaryGameState,
  playerID: string,
  sourceCardId: CardExtId,
): void {
  const sourceName = resolveCardName(G.cardDisplayData, sourceCardId);
  let hasDualClassHero = false;
  for (const card of listEligibleHqCards(G, 'if-none')) {
    const heroClasses = listHeroClassesOf(G, card.cardId);
    if (heroClasses.length === 0) {
      pushLog(G, `Fight effect: ${resolveCardName(G.cardDisplayData, card.cardId)} has no Hero Class, so it gains nothing (${sourceName}).`, 'blocked');
    } else if (heroClasses.length === 1) {
      applyShrinkingResearchBudgetGrant(G, card.cardId, heroClasses[0]!, sourceCardId);
    } else {
      hasDualClassHero = true;
    }
  }
  if (!hasDualClassHero) {
    return;
  }
  // why: WP-860 RS-1 posture — parkSeatChoice overwrites unconditionally, so an open seat choice
  // drops the dual-class picks (the single-class grants above already applied) rather than being
  // replaced.
  if (G.pendingSeatChoice !== undefined) {
    pushLog(G, `Fight effect: Player ${playerID} could not choose a Hero to gain Size-Changing — another choice is open (${sourceName}).`, 'blocked');
    return;
  }
  chainSizeChangingClassPick(G, playerID, sourceCardId);
}

/**
 * Finds the next dual-class Hero still owed a Shrinking Research Budget class: the lowest-slot
 * HQ card with no Size-Changing and two Hero Classes.
 *
 * // why: a fresh scan from slot 0 is exact — every earlier eligible card already holds a grant
 * (single-class at the tactic, dual-class from its own pick), so it now has Size-Changing.
 *
 * @param G - Game state (read-only).
 * @returns The next card, or undefined when none is owed a class.
 */
function findNextClassPickCard(G: LegendaryGameState): CardExtId | undefined {
  for (const card of listEligibleHqCards(G, 'if-none')) {
    if (listHeroClassesOf(G, card.cardId).length >= 2) {
      return card.cardId;
    }
  }
  return undefined;
}

/**
 * Parks the next Shrinking Research Budget class pick, if any Hero is still owed one.
 *
 * Called by the tactic for the first pick and by resolveSeatChoice (the live-move chain point)
 * after each class pick resolves, which passes SHRINKING_RESEARCH_BUDGET_TACTIC_ID as the source.
 *
 * @param G - Game state (mutated).
 * @param playerID - The player who defeated the tactic.
 * @param sourceCardId - The Shrinking Research Budget tactic (named in the log).
 */
export function chainSizeChangingClassPick(
  G: LegendaryGameState,
  playerID: string,
  sourceCardId: CardExtId,
): void {
  const cardId = findNextClassPickCard(G);
  if (cardId === undefined || G.pendingSeatChoice !== undefined) {
    return;
  }
  const heroName = resolveCardName(G.cardDisplayData, cardId);
  const options: SeatChoiceOption[] = [];
  for (const heroClass of listHeroClassesOf(G, cardId)) {
    options.push({ label: `${heroName} gains Size-Changing ${describeClassList([heroClass])}`, cardId, heroClass });
  }
  parkSeatChoice(G, undefined, {
    kind: SIZE_CHANGING_CLASS_PICK_SEAT_CHOICE_KIND,
    addressedSeats: [playerID],
    seatPrompts: { [playerID]: { options } },
    submissions: {},
    defaultOptionIndex: 0,
  }, playerID);
  const sourceName = resolveCardName(G.cardDisplayData, sourceCardId);
  pushLog(G, `Fight effect: Player ${playerID} chooses which Hero Class ${heroName} gains Size-Changing for (${sourceName}).`, 'neutral');
}

/**
 * Applies a resolved Shrinking Research Budget class pick.
 *
 * // why: the class-pick kind carries no source field (D-24804); its only source is the
 * Shrinking Research Budget tactic, named through SHRINKING_RESEARCH_BUDGET_TACTIC_ID.
 *
 * @param G - Game state (mutated).
 * @param choice - The fully-submitted 'size-changing-class-pick' choice.
 */
export function applySizeChangingClassPickResolvedSeatChoice(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const chosen = readChosenOption(choice);
  if (chosen === undefined || chosen.option.cardId === undefined || chosen.option.heroClass === undefined) {
    return;
  }
  const cardId = chosen.option.cardId;
  if (!G.hq.includes(cardId)) {
    const sourceName = resolveCardName(G.cardDisplayData, SHRINKING_RESEARCH_BUDGET_TACTIC_ID);
    pushLog(G, `Fight effect: ${resolveCardName(G.cardDisplayData, cardId)} is no longer in the HQ, so it gains nothing (${sourceName}).`, 'blocked');
    return;
  }
  // why: D-24804 — only the five class slugs are ever written to the overlay.
  const heroClass = orderSizeChangingClasses([chosen.option.heroClass])[0];
  if (heroClass === undefined) {
    return;
  }
  applyShrinkingResearchBudgetGrant(G, cardId, heroClass, SHRINKING_RESEARCH_BUDGET_TACTIC_ID);
}

/**
 * Reads the seat of a fully-submitted Shrinking Research Budget class pick, before the apply
 * clears the choice, so resolveSeatChoice can chain the next pick.
 *
 * @param choice - The submitted seat choice.
 * @returns The addressed seat for a class pick, else undefined.
 */
export function readSizeChangingClassPickSeat(choice: PendingSeatChoice): string | undefined {
  if (choice.kind !== SIZE_CHANGING_CLASS_PICK_SEAT_CHOICE_KIND) {
    return undefined;
  }
  return choice.addressedSeats[0];
}

/**
 * End-of-turn cleanup for the grant overlay: drops every "this turn" grant and every grant whose
 * card has left the HQ, and deletes the field when nothing is left.
 *
 * // why: D-24804 — "this turn" ends here; a Shrinking Research Budget grant lasts while its card
 * stays in the HQ. Deleting the empty field keeps the omit-when-empty shape (hash-stable).
 *
 * @param G - Game state (mutated).
 */
export function clearExpiredHqSizeChangingGrants(G: LegendaryGameState): void {
  const grants = G.hqSizeChangingGrants;
  if (grants === undefined) {
    return;
  }
  const kept: HqSizeChangingGrant[] = [];
  for (const grant of grants) {
    if (!grant.expiresAtEndOfTurn && G.hq.includes(grant.cardId)) {
      kept.push(grant);
    }
  }
  if (kept.length === 0) {
    delete G.hqSizeChangingGrants;
    return;
  }
  G.hqSizeChangingGrants = kept;
}
