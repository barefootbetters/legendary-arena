/**
 * The Unbreakable Enigma Code (WP-830 / D-24763) — the Cap 75th scheme's face-down code.
 *
 * "Twists 1-5: Put a card from the Hero Deck face down next to the scheme as part of the
 * 'Enigma Code.' Mix up those cards face-down." "Special Rules: Whenever you fight a Villain, you
 * may pay 1 [recruit] to look at one of the face-down Enigma Cards. When you fight the
 * Mastermind, first guess the color of each Enigma card, and then reveal them. If you guessed
 * them right, fight the Mastermind as normal. If not, your turn ends, and mix up the Enigma cards
 * face-down."
 *
 * The code is `G.enigmaCode` (card ids in their face-down order). What each player has looked at
 * since the last mix is `G.enigmaPeeks` (positions per player); a right guess reveals every card to
 * everyone until the next mix (`G.isEnigmaCodeRevealed`). A Villain fight queues a peek offer
 * (`G.pendingEnigmaPeekOffers`) that the play-phase onMove opener turns into the active player's
 * seat choice. A card's color is its Hero Class (both classes for a dual-class or Divided card,
 * rules v23 p.49); a card with no class is grey (rules v23 "Class vs. Colors").
 *
 * Pure helpers over G: no boardgame.io import, no I/O. Randomness only through the caller's
 * ShuffleProvider (ctx.random).
 */

import type { LegendaryGameState, PendingSeatChoice, SeatChoiceOption } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';
import { parkSeatChoice } from '../moves/seatChoice.resolve.js';
import { hasAnyPendingChoice } from '../moves/phaseCard.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { isGreyHero, offPlayCardTraits } from '../hero/splitCard.logic.js';
import { getAvailableRecruit, spendRecruit } from '../economy/economy.logic.js';
import { applyEndOfTurnCleanup } from '../moves/endOfTurnCleanup.logic.js';
import { consumeExtraTurn } from '../turn/turnLoop.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';

/** The seat-choice kind for the pay-1-Recruit peek offer. */
export const ENIGMA_PEEK_SEAT_CHOICE_KIND = 'enigma-peek';

// why: "Twists 1-5" add a card; Twist 6 is the scheme's loss (its config's lossThreshold).
/** The highest Twist number that adds a card to the Enigma Code. */
export const ENIGMA_CODE_LAST_BUILDING_TWIST = 5;

/** The Recruit a peek costs ("you may pay 1 [recruit]"). */
export const ENIGMA_PEEK_RECRUIT_COST = 1;

// why: rules v23 "Class vs. Colors": the five Hero Classes are colors, and a card with no
// Class is grey, a sixth color. Ordered as the guess picker shows them.
/** Every color an Enigma card can have, and so every legal guess. */
export const ENIGMA_COLORS = ['strength', 'instinct', 'covert', 'tech', 'ranged', 'grey'] as const;

/** One Enigma color. */
export type EnigmaColor = (typeof ENIGMA_COLORS)[number];

/** The display name of each color, for log lines. */
const ENIGMA_COLOR_NAMES: Readonly<Record<EnigmaColor, string>> = {
  strength: 'Strength',
  instinct: 'Instinct',
  covert: 'Covert',
  tech: 'Tech',
  ranged: 'Ranged',
  grey: 'Grey',
};

/**
 * Minimal boardgame.io events surface parkSeatChoice reads. The peek is the active player's own
 * choice, so no stage ride is needed.
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/** The minimal events surface a wrong guess needs to end the turn. */
export interface EnigmaTurnEndEvents {
  endTurn?: (options?: { next: string }) => void;
}

/**
 * Whether an id is one of the six Enigma colors.
 *
 * @param value - Any value.
 * @returns true when it is an EnigmaColor.
 */
export function isEnigmaColor(value: unknown): value is EnigmaColor {
  return typeof value === 'string' && (ENIGMA_COLORS as readonly string[]).includes(value);
}

/**
 * The colors of one card: its Hero Class or Classes, or grey when it has none.
 *
 * // why: rules v23 p.49 — off play, a Divided Card counts as all its Hero Classes; a dual-class
 * card has two. offPlayCardTraits returns both in heroClass / heroClass2.
 *
 * @param G - The game state (reads cardTraits and the split-face map).
 * @param cardId - The Enigma card.
 * @returns One or two colors, never empty.
 */
export function enigmaColorsOf(G: LegendaryGameState, cardId: CardExtId): EnigmaColor[] {
  // why: D-24783 — grey is the shared grey-Hero predicate's call, not a local class scan.
  if (isGreyHero(G, cardId)) {
    return ['grey'];
  }
  const traits = offPlayCardTraits(G, cardId);
  const colors: EnigmaColor[] = [];
  for (const heroClass of [traits?.heroClass, traits?.heroClass2]) {
    if (isEnigmaColor(heroClass) && heroClass !== 'grey' && !colors.includes(heroClass)) {
      colors.push(heroClass);
    }
  }
  // why: the code holds Hero Deck cards, so this only catches a card that is not a Hero (a
  // Wound) or carries a class outside the five; "never empty" keeps every guess check total.
  if (colors.length === 0) {
    colors.push('grey');
  }
  return colors;
}

/**
 * Mixes the Enigma Code face down: a fresh order, and nobody knows any card any more.
 *
 * @param G - The game state, mutated in place.
 * @param random - The deterministic shuffle source (ctx.random).
 */
function mixEnigmaCode(G: LegendaryGameState, random: ShuffleProvider['random']): void {
  if (G.enigmaCode === undefined) {
    return;
  }
  G.enigmaCode = random.Shuffle([...G.enigmaCode]);
  delete G.enigmaPeeks;
  delete G.isEnigmaCodeRevealed;
}

/**
 * Twists 1-5: the top card of the Hero Deck joins the Enigma Code face down, and the code is mixed.
 *
 * // why: D-24775 — the Twist number is schemeTwistCount: the dispatcher raises the counter
 * before it calls the resolver.
 *
 * @param G - The game state, mutated in place.
 * @param random - The deterministic shuffle source (the reveal context's random).
 */
export function addHeroDeckCardToEnigmaCode(G: LegendaryGameState, random: ShuffleProvider['random']): void {
  const twistNumber = G.counters.schemeTwistCount ?? 0;
  if (twistNumber > ENIGMA_CODE_LAST_BUILDING_TWIST) {
    return;
  }
  const topCard = G.heroDeck[0];
  if (topCard === undefined) {
    // why: "Mix up those cards face-down" is its own instruction, so the code is still mixed.
    mixEnigmaCode(G, random);
    pushLog(G, `[Enigma Code] Twist ${twistNumber}: the Hero Deck is empty, so no card joins the Enigma Code; the code is mixed.`, 'neutral');
    return;
  }
  G.heroDeck = G.heroDeck.slice(1);
  G.enigmaCode = [...(G.enigmaCode ?? []), topCard];
  mixEnigmaCode(G, random);
  pushLog(
    G,
    `[Enigma Code] Twist ${twistNumber}: the top card of the Hero Deck joins the Enigma Code face down (${G.enigmaCode.length} card${G.enigmaCode.length === 1 ? '' : 's'}), and the code is mixed.`,
    'threat',
  );
}

/**
 * The positions a player has not looked at since the last mix (none once the code is revealed).
 *
 * @param G - The game state (not mutated).
 * @param playerID - The player.
 * @returns Unknown positions, ascending.
 */
export function unknownEnigmaPositions(G: LegendaryGameState, playerID: string): number[] {
  const code = G.enigmaCode ?? [];
  if (G.isEnigmaCodeRevealed === true) {
    return [];
  }
  const known = G.enigmaPeeks?.[playerID] ?? [];
  const positions: number[] = [];
  for (let position = 0; position < code.length; position++) {
    if (!known.includes(position)) {
      positions.push(position);
    }
  }
  return positions;
}

/**
 * After a Villain fight: owe the fighter a peek offer, when the code holds a card they have not seen.
 *
 * // why: the fight resolves inside the move; the offer opens after it (the D-24656 owed-choice
 * pattern) so it never interrupts the fight's own effects.
 *
 * @param G - The game state, mutated in place.
 * @param playerID - The fighting (active) player.
 */
export function queueEnigmaPeekOffer(G: LegendaryGameState, playerID: string): void {
  if (unknownEnigmaPositions(G, playerID).length === 0) {
    return;
  }
  if (G.pendingEnigmaPeekOffers === undefined) {
    G.pendingEnigmaPeekOffers = [];
  }
  G.pendingEnigmaPeekOffers.push({ playerID, positions: [] });
}

/**
 * Whether the opener must wait: another choice is open, or the match is already decided.
 *
 * // why: D-24763 — the escape-opener precedent (D-24656). hasAnyPendingChoice covers
 * G.pendingSeatChoice but not G.pendingHeroChoice, so both are checked.
 *
 * @param G - The game state (not mutated).
 * @returns true when the opener must leave the queue for a later move.
 */
function isAnotherChoiceOpenOrMatchOver(G: LegendaryGameState): boolean {
  if (G.pendingSeatChoice !== undefined || hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined) {
    return true;
  }
  return evaluateEndgame(G) !== null;
}

/**
 * Opens the front owed peek offer as the fighter's seat choice, dropping offers that can no longer
 * be taken (nothing unseen, or less than 1 Recruit left).
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events (passed through to parkSeatChoice).
 * @param currentPlayer - The active player id.
 */
export function openEnigmaPeekSeatChoiceIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer?: string,
): void {
  const queue = G.pendingEnigmaPeekOffers;
  if (queue === undefined || isAnotherChoiceOpenOrMatchOver(G)) {
    return;
  }
  while (queue.length > 0) {
    const front = queue[0]!;
    const positions = unknownEnigmaPositions(G, front.playerID);
    // why: "you may pay 1 [recruit]" — an offer the player can no longer take is simply gone. The
    // offer is priced from G.turnEconomy, the current player's, so an offer that outlived its
    // fighter's turn is dropped rather than charged to someone else.
    const isFightersTurn = currentPlayer === undefined || front.playerID === currentPlayer;
    if (isFightersTurn && positions.length > 0 && getAvailableRecruit(G.turnEconomy) >= ENIGMA_PEEK_RECRUIT_COST) {
      front.positions = positions;
      parkSeatChoice(G, events, buildEnigmaPeekChoice(front.playerID, positions), currentPlayer);
      return;
    }
    queue.shift();
  }
  delete G.pendingEnigmaPeekOffers;
}

/**
 * Builds the peek offer: one option per unseen position, then "Don't look".
 *
 * // why: options carry no cardId — the prompt reaches the client, and a card id there would show
 * the card without paying. The entry's `positions` maps an option back to its position.
 *
 * @param playerID - The fighter.
 * @param positions - The unseen positions, ascending.
 * @returns The pending seat choice; the timeout default declines.
 */
function buildEnigmaPeekChoice(playerID: string, positions: readonly number[]): PendingSeatChoice {
  const options: SeatChoiceOption[] = [];
  for (const position of positions) {
    options.push({ label: `Pay 1 Recruit: look at Enigma card ${position + 1}` });
  }
  options.push({ label: "Don't look" });
  return {
    kind: ENIGMA_PEEK_SEAT_CHOICE_KIND,
    addressedSeats: [playerID],
    seatPrompts: { [playerID]: { options } },
    submissions: {},
    // why: the peek is optional ("you may pay"), so a timeout declines and spends nothing.
    defaultOptionIndex: positions.length,
  };
}

/**
 * Applies a submitted peek choice: pay 1 Recruit and remember the position, or decline.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted 'enigma-peek' seat choice.
 */
export function applyEnigmaPeekResolvedSeatChoice(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const queue = G.pendingEnigmaPeekOffers;
  const seat = choice.addressedSeats[0];
  if (queue === undefined || queue.length === 0 || seat === undefined) {
    return;
  }
  const front = queue.shift()!;
  if (queue.length === 0) {
    delete G.pendingEnigmaPeekOffers;
  }
  const optionIndex = choice.submissions[seat]?.optionIndex;
  const position = optionIndex === undefined ? undefined : front.positions[optionIndex];
  if (position === undefined || getAvailableRecruit(G.turnEconomy) < ENIGMA_PEEK_RECRUIT_COST) {
    return;
  }
  G.turnEconomy = spendRecruit(G.turnEconomy, ENIGMA_PEEK_RECRUIT_COST);
  if (G.enigmaPeeks === undefined) {
    G.enigmaPeeks = {};
  }
  G.enigmaPeeks[seat] = [...(G.enigmaPeeks[seat] ?? []), position];
  pushLog(G, `[Enigma Code] Player ${seat} paid 1 Recruit to look at Enigma card ${position + 1}.`, 'applied');
}

/**
 * Whether a fightMastermind guess is well-formed for the current code.
 *
 * @param G - The game state (not mutated).
 * @param guess - The move's enigmaGuess argument.
 * @returns true when it is one known color per Enigma card.
 */
export function isEnigmaGuessWellFormed(G: LegendaryGameState, guess: unknown): guess is EnigmaColor[] {
  const code = G.enigmaCode ?? [];
  if (!Array.isArray(guess) || guess.length !== code.length) {
    return false;
  }
  for (const color of guess) {
    if (!isEnigmaColor(color)) {
      return false;
    }
  }
  return true;
}

/**
 * Whether every guessed color is one of its card's colors.
 *
 * // why: a dual-class or Divided card is both its colors (rules v23 p.49), so either is right.
 *
 * @param G - The game state (not mutated).
 * @param guess - A well-formed guess.
 * @returns true when the whole guess is right.
 */
function isEnigmaGuessRight(G: LegendaryGameState, guess: readonly EnigmaColor[]): boolean {
  const code = G.enigmaCode ?? [];
  for (let position = 0; position < code.length; position++) {
    if (!enigmaColorsOf(G, code[position]!).includes(guess[position]!)) {
      return false;
    }
  }
  return true;
}

/**
 * The log text naming each guessed color and each revealed card.
 *
 * @param G - The game state (not mutated).
 * @param guess - A well-formed guess.
 * @returns "Strength, Tech" and "<card>, <card>".
 */
function describeGuessAndCode(G: LegendaryGameState, guess: readonly EnigmaColor[]): { guessed: string; revealed: string } {
  const guessedNames: string[] = [];
  for (const color of guess) {
    guessedNames.push(ENIGMA_COLOR_NAMES[color]);
  }
  const revealedNames: string[] = [];
  for (const cardId of G.enigmaCode ?? []) {
    revealedNames.push(formatCardRef(G.cardDisplayData, cardId));
  }
  return { guessed: guessedNames.join(', '), revealed: revealedNames.join(', ') };
}

/**
 * Settles the guess a Mastermind fight starts with. Right: the code stays revealed and the fight
 * goes ahead. Wrong: the code is mixed face down and the player's turn ends.
 *
 * // why: "your turn ends" is a full turn end — the endTurn move's cleanup (discard and draw a new
 * hand), then events.endTurn, honoring a queued extra turn exactly as that move does (D-24520,
 * D-24513). Without the cleanup the player would keep their hand and in-play cards.
 *
 * @param G - The game state, mutated in place.
 * @param playerID - The fighting (active) player.
 * @param guess - A well-formed guess.
 * @param random - The deterministic shuffle source (ctx.random).
 * @param events - The move's events (endTurn).
 * @returns true when the fight goes ahead.
 */
export function settleEnigmaGuess(
  G: LegendaryGameState,
  playerID: string,
  guess: readonly EnigmaColor[],
  random: ShuffleProvider['random'],
  events: EnigmaTurnEndEvents | undefined,
): boolean {
  const { guessed, revealed } = describeGuessAndCode(G, guess);
  if (isEnigmaGuessRight(G, guess)) {
    G.isEnigmaCodeRevealed = true;
    pushLog(G, `[Enigma Code] Player ${playerID} guessed ${guessed}. The code is ${revealed}: right, so the fight goes ahead.`, 'applied');
    return true;
  }
  pushLog(G, `[Enigma Code] Player ${playerID} guessed ${guessed}. The code is ${revealed}: wrong, so the turn ends and the code is mixed face down.`, 'threat');
  mixEnigmaCode(G, random);
  applyEndOfTurnCleanup(G, playerID, { random });
  if (consumeExtraTurn(G, playerID)) {
    // why: WP-696 / D-24513 — a queued extra turn begins the same seat's next turn.
    events?.endTurn?.({ next: playerID });
    return false;
  }
  // why: boardgame.io manages player rotation via ctx.events.endTurn(); the wrong guess ends the turn.
  events?.endTurn?.();
  return false;
}

/**
 * The bot's guess: each card's first color, or null while the bot has not seen every card.
 *
 * // why: D-24763 — the bot never reads an unseen Enigma card, and it never gambles: a wrong guess
 * ends its turn and mixes the code, wiping every peek its partners paid for. So it fights the
 * Mastermind only once it knows the whole code (its own peeks, or a reveal).
 *
 * @param G - The game state (not mutated).
 * @param playerID - The bot's seat.
 * @returns One color per Enigma card, or null when a card is unseen.
 */
export function chooseBotEnigmaGuess(G: LegendaryGameState, playerID: string): EnigmaColor[] | null {
  if (unknownEnigmaPositions(G, playerID).length > 0) {
    return null;
  }
  const guess: EnigmaColor[] = [];
  for (const cardId of G.enigmaCode ?? []) {
    guess.push(enigmaColorsOf(G, cardId)[0]!);
  }
  return guess;
}
