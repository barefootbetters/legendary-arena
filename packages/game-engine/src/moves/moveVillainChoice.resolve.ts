/**
 * resolveMoveVillainChoice move — resolves a pending Spinning Cyclone move-a-Villain choice
 * (WP-795 / D-24664 — core Storm's "Spinning Cyclone").
 *
 * Called by the ACTIVE player (or the deterministic bot) after a spinning-cyclone hero ability
 * parked a PendingMoveVillainChoice on G.pendingMoveVillainChoices (FIFO). This realizes the
 * printed "You may move a Villain to a new city space. Rescue any Bystanders captured by that
 * Villain. (If you move a Villain to a city space that already has Villain, swap them.)".
 *
 * The answer is one intent with two shapes:
 *   - `{ fromCityIndex, toCityIndex }` — move the Villain at `fromCityIndex` to `toCityIndex`.
 *     An occupied destination swaps the two Villains; both stay in the City. Only the MOVED
 *     Villain's Bystanders are rescued into the chooser's Victory Pile.
 *   - `{ decline: true }` — "You may": move nothing, rescue nothing.
 *
 * Moving is not a fight and not an escape: no Fight / Escape / Ambush ability fires, no Villain
 * enters from the Villain Deck, and a Villain moved onto the Bridge does not escape.
 *
 * Atomicity: a failed validation (bad args shape, a bad index, an empty source, an empty queue,
 * a wrong player) returns before any mutation and leaves the queue intact.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CitySpaceName } from '../board/citySpaceNames.js';
import { citySpaceNameForIndex } from '../board/citySpaceNames.js';
import { awardAttachedBystanders } from '../board/bystanders.logic.js';
import { formatAttackTargets } from '../economy/economy.logic.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveMoveVillainChoice move.
 *
 * Either decline the optional move, or name the Villain's current City index and the
 * destination City index (engine indices: 0 = Sewers … 4 = Bridge).
 */
export type ResolveMoveVillainChoiceArgs =
  | { decline: true }
  | { fromCityIndex: number; toCityIndex: number };

/** The answer after shape validation: a decline, or a validated pair of City indices. */
type MoveVillainAnswer =
  | { kind: 'decline' }
  | { kind: 'move'; fromCityIndex: number; toCityIndex: number };

/**
 * Whether any Spinning Cyclone move-a-Villain choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the getLegalMoves
 * short-circuit. `undefined` and `[]` both mean no pending choice (mirrors
 * hasPendingCoveringFireChoice, D-24541).
 *
 * // why: pendingMoveVillainChoices is lazy-init (D-24664); undefined and [] both mean no pending choice
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending move-a-Villain queue holds at least one entry.
 */
export function hasPendingMoveVillainChoice(G: LegendaryGameState): boolean {
  return (G.pendingMoveVillainChoices?.length ?? 0) > 0;
}

/**
 * Whether a value is an integer City index (0..4).
 *
 * @param value - The untrusted index from the move payload.
 * @returns true for an integer in 0..4.
 */
function isCityIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 4;
}

/**
 * Reads the untrusted move payload into a decline or a move, or null for any other shape.
 *
 * Shape rule (no precedence guessing): a decline is `decline === true` with neither index field
 * present; a move is both index fields present with no `decline` field. Anything else — a null
 * or non-object payload, a partial move, or a mixed decline-plus-index payload — is null.
 *
 * @param args - The untrusted move payload.
 * @returns The validated answer, or null when the payload matches neither shape.
 */
function readMoveVillainAnswer(args: unknown): MoveVillainAnswer | null {
  // why: guard the payload BEFORE any field read — an argless submit must be a silent no-op,
  // never a TypeError (resolveCoveringFireChoice reads args.choice unguarded; this does not).
  if (args === null || typeof args !== 'object') {
    return null;
  }
  const payload = args as Record<string, unknown>;
  const hasDecline = 'decline' in payload;
  const hasFrom = 'fromCityIndex' in payload;
  const hasTo = 'toCityIndex' in payload;
  if (hasDecline && !hasFrom && !hasTo) {
    if (payload.decline === true) {
      return { kind: 'decline' };
    }
    return null;
  }
  if (!hasDecline && hasFrom && hasTo) {
    const fromCityIndex = payload.fromCityIndex;
    const toCityIndex = payload.toCityIndex;
    if (!isCityIndex(fromCityIndex) || !isCityIndex(toCityIndex)) {
      return null;
    }
    return { kind: 'move', fromCityIndex, toCityIndex };
  }
  return null;
}

/**
 * Resolves the FRONT pending Spinning Cyclone move-a-Villain choice.
 *
 * Atomic sequence (HARD — exact order, mirrors coveringFireChoice.resolve.ts):
 *   1. Validate args — a decline, or two integer City indices 0..4; anything else is a silent
 *      no-op (queue intact).
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. Decline → log and pop. Move → validate `from !== to` and a Villain at `from`, swap the
 *      two City slots, log the move, rescue only the moved Villain's Bystanders, then pop.
 *
 * Any failure before the mutation ABORTS the effect (no move, no rescue, no shift). Moves never
 * throw.
 *
 * // why: block-all guard — no other move may fire while a move-a-Villain choice is outstanding (D-24664)
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - `{ fromCityIndex, toCityIndex }` or `{ decline: true }`.
 */
export function resolveMoveVillainChoice(
  { G, playerID }: MoveContext,
  args: ResolveMoveVillainChoiceArgs,
): void {
  // Step 1: Validate the payload shape and the index range.
  const answer = readMoveVillainAnswer(args);
  if (answer === null) {
    return;
  }

  // Step 2: Validate the front pending entry — front-only resolution.
  // why: pendingMoveVillainChoices is lazy-init (D-24664); undefined and [] both mean no pending choice
  const queue = G.pendingMoveVillainChoices;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }

  // Step 3a: Decline — "You may": nothing moves and nothing is rescued.
  if (answer.kind === 'decline') {
    pushLog(G, `Player ${playerID} chose not to move a Villain (Spinning Cyclone).`, 'neutral');
    queue.shift();
    return;
  }

  // Step 3b: Move — "a new city space" with a Villain to move.
  const { fromCityIndex, toCityIndex } = answer;
  if (fromCityIndex === toCityIndex) {
    return;
  }
  const movedId = G.city[fromCityIndex];
  if (movedId === null || movedId === undefined) {
    return;
  }
  const fromSpaceName: CitySpaceName | undefined = citySpaceNameForIndex(fromCityIndex);
  const toSpaceName: CitySpaceName | undefined = citySpaceNameForIndex(toCityIndex);
  if (fromSpaceName === undefined || toSpaceName === undefined) {
    return;
  }
  const fromLabel = formatAttackTargets([fromSpaceName]);
  const toLabel = formatAttackTargets([toSpaceName]);
  const swappedId = G.city[toCityIndex] ?? null;

  // why: D-24336 precedent (villainEffectSwapTwoCityVillains) — swap the two City slots by
  // direct index assignment. This is the ONLY mutation site for the move: an empty destination
  // receives the Villain and the source becomes empty; an occupied destination swaps, so both
  // Villains stay in the City. No Fight / Escape / Ambush fires, and the Bridge never escapes.
  // Bystanders (G.attachedBystanders) and captured Heroes (G.villainAttachedHeroes) are keyed
  // by the Villain's ext_id, so they travel with it.
  G.city[fromCityIndex] = swappedId;
  G.city[toCityIndex] = movedId;

  const movedRef = formatCardRef(G.cardDisplayData, movedId);
  let moveLine = `Player ${playerID} moved ${movedRef} from the ${fromLabel} to the ${toLabel} (Spinning Cyclone).`;
  if (swappedId !== null) {
    moveLine += ` ${formatCardRef(G.cardDisplayData, swappedId)} moved to the ${fromLabel}.`;
  }
  pushLog(G, moveLine, 'applied', front.sourceCardId);

  // why: D-24664 — "Rescue any Bystanders captured by THAT Villain": only the moved Villain's
  // Bystanders are rescued, through the fight path's awardAttachedBystanders with the same log
  // line. A swapped-with Villain keeps its Bystanders and captured Heroes.
  const playerZones = G.playerZones[playerID];
  if (playerZones) {
    const victoryBefore = playerZones.victory.length;
    const awardResult = awardAttachedBystanders(movedId, G.attachedBystanders, playerZones.victory);
    G.attachedBystanders = awardResult.attachedBystanders;
    playerZones.victory = awardResult.playerVictory;
    const bystandersRescued = awardResult.playerVictory.length - victoryBefore;
    if (bystandersRescued > 0) {
      pushLog(G, `Player ${playerID} rescued ${bystandersRescued} bystander(s) from ${movedRef}.`);
    }
  }

  // Step 4: Front-pop LAST (front-pop = Array.shift), mirroring WP-248.
  queue.shift();
}
