/**
 * "Each player reveals a [X] Hero or gains a Wound": a player who can reveal chooses
 * (WP-845 / D-24779).
 *
 * Rules v23 "Revealing a Card" (L3196-3200): a player who has the card can still choose not to
 * reveal it and gain the Wound instead. The villain primitive `reveal-or-wound` and the hero
 * keyword `reveal-or-gain-wound-each` wound every player who cannot reveal at once, as before,
 * and record the players who can on `G.pendingRevealOrWoundChoices` (the villain executor has no
 * `events`, so it cannot park a choice itself — the D-24750 queue precedent). After the move the
 * play-phase opener parks the front entry as one simultaneous `reveal-or-wound` seat choice
 * (option 0 reveals, option 1 gains a Wound, default Reveal). The entry stays queued while its
 * choice is open (the Timestream Purge shape), so the apply can read its card, current player
 * and shield-block class, then shifts it off.
 *
 * Plain G-mutating helpers, NOT boardgame.io moves. No registry imports, no boardgame.io
 * import, no .reduce(). Never throws.
 */

import type {
  LegendaryGameState,
  PendingRevealOrWoundChoice,
  PendingSeatChoice,
} from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
// why: WP-845 / D-24779 — two runtime-safe import cycles meet here. seatChoice.resolve imports
// this module's applier and kind for its dispatch while this module imports parkSeatChoice from
// it; and phaseCard → playVillainTop.resolve → villainDeck.reveal → villainEffects.execute (which
// imports enqueueRevealOrWoundChoice) → this module → phaseCard (hasAnyPendingChoice). Every
// imported binding is read only inside a function body, never at module top level, and this
// module's own constants are literals, so ESM resolves each binding by call time (the
// villainEscapeProcedure.ts precedent).
import { parkSeatChoice } from './seatChoice.resolve.js';
import { hasAnyPendingChoice } from './phaseCard.js';
import { evaluateEndgame } from '../endgame/endgame.evaluate.js';
import { gainWoundWithOutcome } from '../board/wounds.logic.js';
import { composeStrikeBlockedNarrative, composeWoundOutcomeClause } from '../events/notableEvents.compose.js';
import { formatCardRef } from '../log/logDisplay.js';
import { pushLog } from '../log/logPush.js';

/** The seat-choice kind for a reveal-or-gain-a-Wound choice. */
export const REVEAL_OR_WOUND_SEAT_CHOICE_KIND = 'reveal-or-wound';

/** Option 0: reveal the qualifying Hero (no Wound). */
export const REVEAL_OR_WOUND_REVEAL_OPTION_INDEX = 0;

/** Option 1: decline to reveal and gain the Wound. */
export const REVEAL_OR_WOUND_GAIN_WOUND_OPTION_INDEX = 1;

// why: WP-845 / D-24779 — the decline label is shared with WP-837's Frost Giant Warrior
// discard-or-Wound choice; WP-837 had not landed, so this module owns the export and WP-837
// imports it.
export const VILLAIN_EFFECT_WOUND_OPTION_LABEL = 'Gain a Wound instead';

/**
 * Minimal boardgame.io events surface parkSeatChoice reads. Optional so a unit / sim / fixture
 * context without a live framework is a guarded no-op (the stage ride is skipped there).
 */
interface SeatChoiceEvents {
  setActivePlayers?: (arg: {
    value: Record<string, { stage: string; moveLimit: number }>;
    revert?: boolean;
  }) => void;
}

/**
 * Records one owed reveal-or-gain-a-Wound choice for the players who could reveal (the queue's
 * single writer). Sorts the seats numeric ascending itself, so the stored and applied order never
 * depends on the order the effect loop visited the players.
 *
 * @param G - The game state, mutated in place (queue appended, lazily created).
 * @param entry - The owed choice; `strikeBlockThreatKind` is set for a villain source only.
 */
export function enqueueRevealOrWoundChoice(
  G: LegendaryGameState,
  entry: PendingRevealOrWoundChoice,
): void {
  const revealingSeats = [...entry.revealingSeats].sort((left, right) => Number(left) - Number(right));
  const queued: PendingRevealOrWoundChoice = {
    sourceCardId: entry.sourceCardId,
    currentPlayerID: entry.currentPlayerID,
    revealOptionLabel: entry.revealOptionLabel,
    revealingSeats,
  };
  // why: a hero entry omits the key entirely (never `: undefined`), so it serializes without it.
  if (entry.strikeBlockThreatKind !== undefined) {
    queued.strikeBlockThreatKind = entry.strikeBlockThreatKind;
  }
  if (G.pendingRevealOrWoundChoices === undefined) {
    G.pendingRevealOrWoundChoices = [];
  }
  G.pendingRevealOrWoundChoices.push(queued);
}

/**
 * Formats player ids as `Player 0, Player 1`.
 *
 * @param playerIds - The player ids, in order.
 * @returns The comma-joined player names.
 */
export function formatRevealOrWoundPlayerNames(playerIds: readonly string[]): string {
  return playerIds.map((playerId) => `Player ${playerId}`).join(', ');
}

/**
 * Builds the simultaneous seat choice for one owed entry: a prompt for every recorded seat, the
 * same two options for each.
 *
 * @param entry - The owed reveal-or-gain-a-Wound choice.
 * @returns The pending seat choice (default Reveal).
 */
export function buildRevealOrWoundSeatChoice(entry: PendingRevealOrWoundChoice): PendingSeatChoice {
  const addressedSeats = [...entry.revealingSeats];
  const seatPrompts: PendingSeatChoice['seatPrompts'] = {};
  for (const seat of addressedSeats) {
    seatPrompts[seat] = {
      options: [{ label: entry.revealOptionLabel }, { label: VILLAIN_EFFECT_WOUND_OPTION_LABEL }],
    };
  }
  return {
    kind: REVEAL_OR_WOUND_SEAT_CHOICE_KIND,
    addressedSeats,
    seatPrompts,
    submissions: {},
    // why: D-24744 / D-24745 — the timeout, bot and sim answer is Reveal, which is what the
    // auto-reveal did before, so every simulated Wound outcome stays the same.
    defaultOptionIndex: REVEAL_OR_WOUND_REVEAL_OPTION_INDEX,
  };
}

/**
 * The card a log line from this module is attributed to: the played Hero for a hero source
 * (WP-438), none for a villain source (the reveal-or-wound self-narration carries none).
 *
 * @param entry - The owed choice.
 * @returns The card id to attribute, or undefined.
 */
function attributedCardId(entry: PendingRevealOrWoundChoice): CardExtId | undefined {
  return entry.strikeBlockThreatKind === undefined ? entry.sourceCardId : undefined;
}

/**
 * Removes the front entry, deleting the queue key once it is empty.
 *
 * @param G - The game state, mutated in place.
 */
function shiftFrontRevealOrWoundChoice(G: LegendaryGameState): void {
  const queue = G.pendingRevealOrWoundChoices;
  if (queue === undefined) {
    return;
  }
  queue.shift();
  if (queue.length === 0) {
    delete G.pendingRevealOrWoundChoices;
  }
}

/**
 * Whether an entry can be asked: it names at least one seat and every seat it names has zones.
 *
 * @param G - The game state (read-only).
 * @param entry - The owed choice.
 * @returns true when the entry can be parked.
 */
function isRevealOrWoundEntryServable(G: LegendaryGameState, entry: PendingRevealOrWoundChoice): boolean {
  if (!Array.isArray(entry.revealingSeats) || entry.revealingSeats.length === 0) {
    return false;
  }
  for (const seat of entry.revealingSeats) {
    if (G.playerZones[seat] === undefined) {
      return false;
    }
  }
  return true;
}

/**
 * Announces one avoided villain reveal-or-wound with a `strikeBlocked` notable event (WP-646 /
 * WP-651). A hero source pushes none.
 *
 * @param G - The game state, mutated in place.
 * @param entry - The owed choice (its threat kind is the villain timing's).
 * @param seat - The revealing player.
 */
function pushRevealStrikeBlocked(G: LegendaryGameState, entry: PendingRevealOrWoundChoice, seat: string): void {
  const threatKind = entry.strikeBlockThreatKind;
  if (threatKind === undefined) {
    return;
  }
  G.notableEvents.push({
    type: 'strikeBlocked',
    playerId: seat,
    threatKind,
    narrative: composeStrikeBlockedNarrative(threatKind),
  });
}

/**
 * Resolves the front entry as every seat revealing because the Wound supply is empty.
 *
 * @param G - The game state, mutated in place.
 * @param entry - The front owed choice.
 */
function resolveRevealOrWoundWithEmptySupply(G: LegendaryGameState, entry: PendingRevealOrWoundChoice): void {
  pushLog(G,
    `Reveal or gain a Wound (${formatCardRef(G.cardDisplayData, entry.sourceCardId)}): the Wound supply is empty, so ${formatRevealOrWoundPlayerNames(entry.revealingSeats)} revealed.`,
    'blocked',
    attributedCardId(entry),
  );
  for (const seat of entry.revealingSeats) {
    pushRevealStrikeBlocked(G, entry, seat);
  }
}

/**
 * Opens the front owed reveal-or-gain-a-Wound choice as a simultaneous seat choice for the
 * players who could reveal, resolving on the way every entry that needs no prompt.
 *
 * Waits while any choice is open or `pendingHeroChoice` is set, and once the match is decided.
 * The parked entry stays at the front of the queue; the open seat choice keeps this opener from
 * re-parking it, and the apply shifts it off.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events (for the stage ride), or undefined.
 * @param currentPlayer - The active player id (ctx.currentPlayer, or the sim loop's active seat).
 */
export function openRevealOrWoundSeatChoiceIfNeeded(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  currentPlayer?: string,
): void {
  while (G.pendingRevealOrWoundChoices !== undefined) {
    const queue = G.pendingRevealOrWoundChoices;
    if (queue.length === 0) {
      delete G.pendingRevealOrWoundChoices;
      return;
    }
    // why: hasAnyPendingChoice covers an open seat choice but not pendingHeroChoice, so both
    // are checked (the escape-opener guard). This queue never joins hasAnyPendingChoice: it would
    // then block its own opener.
    if (hasAnyPendingChoice(G) || G.pendingHeroChoice !== undefined) {
      return;
    }
    if (evaluateEndgame(G) !== null) {
      return;
    }
    const entry = queue[0]!;
    if (!isRevealOrWoundEntryServable(G, entry)) {
      pushLog(G,
        `Reveal or gain a Wound (${formatCardRef(G.cardDisplayData, entry.sourceCardId)}): the choice was dropped because it names no player who can answer it.`,
        'blocked',
        attributedCardId(entry),
      );
      shiftFrontRevealOrWoundChoice(G);
      continue;
    }
    // why: rules v23 L3199-3200 — with no Wound left, gaining one is not something a player can
    // choose to do, so every recorded player reveals and no prompt opens.
    if (G.piles.wounds.length === 0) {
      resolveRevealOrWoundWithEmptySupply(G, entry);
      shiftFrontRevealOrWoundChoice(G);
      continue;
    }
    parkRevealOrWoundSeatChoice(G, events, buildRevealOrWoundSeatChoice(entry), currentPlayer);
    return;
  }
}

/**
 * Parks the choice with the D-24750 stage-ride rule.
 *
 * @param G - The game state, mutated in place.
 * @param events - The move context's boardgame.io events, or undefined.
 * @param choice - The built seat choice.
 * @param currentPlayer - The active player id, or undefined.
 */
function parkRevealOrWoundSeatChoice(
  G: LegendaryGameState,
  events: SeatChoiceEvents | undefined,
  choice: PendingSeatChoice,
  currentPlayer: string | undefined,
): void {
  // why: D-24656 point 3 / D-24743 — skip the stage ride only when the active seat is the sole
  // addressed seat; a mixed ride admits the active seat too, or boardgame.io would refuse its
  // own answer until every other seat had answered.
  const isActiveSeatOnly =
    choice.addressedSeats.length === 1 && choice.addressedSeats[0] === currentPlayer;
  if (isActiveSeatOnly) {
    parkSeatChoice(G, events, choice, currentPlayer);
  } else {
    parkSeatChoice(G, events, choice);
  }
}

/**
 * Whether two seat lists hold the same seats in the same order (element-wise, never identity, so
 * a JSON round-trip between park and resolve still matches).
 *
 * @param left - One seat list.
 * @param right - The other seat list.
 * @returns true when they are equal element by element.
 */
function seatListsMatch(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

/** The per-seat results of one apply, for the summary line. */
interface RevealOrWoundApplyResult {
  revealed: string[];
  gained: string[];
  divingBlockPending: string[];
  emptySupply: string[];
}

/**
 * Applies a fully-submitted reveal-or-gain-a-Wound choice: Reveal → no mutation (a villain source
 * pushes its `strikeBlocked`); Gain a Wound → one Wound through `gainWoundWithOutcome`, so Diving
 * Block and Flying Shield Block still intercept it. Then the front entry is shifted off.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted 'reveal-or-wound' seat choice.
 */
export function applyRevealOrWoundSeatChoice(G: LegendaryGameState, choice: PendingSeatChoice): void {
  const entry = G.pendingRevealOrWoundChoices?.[0];
  if (entry === undefined) {
    pushLog(G, 'A reveal-or-gain-a-Wound answer arrived with no owed choice to apply it to, so nothing happened.', 'blocked');
    return;
  }
  // why: the timeout path passes no current player and PendingSeatChoice carries no payload, so
  // the entry is the only source of the card, current player and threat kind; a choice that does
  // not answer it is left owed, and the next onMove re-parks the entry.
  if (!seatListsMatch(choice.addressedSeats, entry.revealingSeats)) {
    pushLog(G,
      `Reveal or gain a Wound (${formatCardRef(G.cardDisplayData, entry.sourceCardId)}): the answering players do not match the owed choice, so it will be asked again.`,
      'blocked',
      attributedCardId(entry),
    );
    return;
  }
  const result = applyRevealOrWoundSeats(G, choice, entry);
  logRevealOrWoundApply(G, entry, result);
  shiftFrontRevealOrWoundChoice(G);
}

/**
 * Applies each seat's answer in ascending seat order.
 *
 * @param G - The game state, mutated in place.
 * @param choice - The fully-submitted seat choice.
 * @param entry - The front owed choice it answers.
 * @returns Who revealed and how each decliner's Wound went.
 */
function applyRevealOrWoundSeats(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
  entry: PendingRevealOrWoundChoice,
): RevealOrWoundApplyResult {
  const result: RevealOrWoundApplyResult = { revealed: [], gained: [], divingBlockPending: [], emptySupply: [] };
  // why: D-24501 — every simultaneous apply runs in ascending seat order, independent of the
  // order the seats answered in.
  for (const seat of [...entry.revealingSeats].sort((left, right) => Number(left) - Number(right))) {
    if (G.playerZones[seat] === undefined) {
      continue;
    }
    if (choice.submissions[seat]?.optionIndex !== REVEAL_OR_WOUND_GAIN_WOUND_OPTION_INDEX) {
      result.revealed.push(seat);
      pushRevealStrikeBlocked(G, entry, seat);
      continue;
    }
    const woundOutcome = gainWoundWithOutcome(G, seat);
    if (woundOutcome === 'no-wound') {
      result.emptySupply.push(seat);
      continue;
    }
    if (woundOutcome === 'diving-block-pending') {
      result.divingBlockPending.push(seat);
    } else {
      result.gained.push(seat);
    }
    // why: woundsDrawn projects the current player's Wounds only (the reveal-or-wound and
    // gain-wound:each parity); another seat's Wound never moves it.
    if (seat === entry.currentPlayerID) {
      G.turnEconomy.woundsDrawn += 1;
    }
  }
  return result;
}

/**
 * Composes the declined half of the apply line, or an empty string when no seat declined.
 *
 * @param result - The per-seat apply results.
 * @returns The declined clause.
 */
function composeDeclinedClause(result: RevealOrWoundApplyResult): string {
  let clause = '';
  if (result.divingBlockPending.length > 0) {
    // why: D-24673 — a Wound Diving Block can still return is not "gained" yet.
    clause = composeWoundOutcomeClause(result.gained, result.divingBlockPending);
  } else if (result.gained.length > 0) {
    clause = `${formatRevealOrWoundPlayerNames(result.gained)} chose to gain a Wound`;
  }
  if (result.emptySupply.length > 0) {
    // why: D-24686 — name who chose the Wound but found the supply empty.
    const emptySupplyTail = `the Wound supply ran out before ${formatRevealOrWoundPlayerNames(result.emptySupply)}`;
    clause = clause === '' ? emptySupplyTail : `${clause}; ${emptySupplyTail}`;
  }
  return clause;
}

/**
 * Writes the one summary line for an applied choice.
 *
 * @param G - The game state (the log is appended).
 * @param entry - The front owed choice.
 * @param result - The per-seat apply results.
 */
function logRevealOrWoundApply(
  G: LegendaryGameState,
  entry: PendingRevealOrWoundChoice,
  result: RevealOrWoundApplyResult,
): void {
  const clauses: string[] = [];
  if (result.revealed.length > 0) {
    clauses.push(`${formatRevealOrWoundPlayerNames(result.revealed)} revealed`);
  }
  const declinedClause = composeDeclinedClause(result);
  if (declinedClause !== '') {
    clauses.push(declinedClause);
  }
  if (clauses.length === 0) {
    clauses.push('no player could answer');
  }
  const hasDecliner =
    result.gained.length + result.divingBlockPending.length + result.emptySupply.length > 0;
  pushLog(G,
    `Reveal or gain a Wound (${formatCardRef(G.cardDisplayData, entry.sourceCardId)}): ${clauses.join('; ')}.`,
    hasDecliner ? 'applied' : 'blocked',
    attributedCardId(entry),
  );
}
