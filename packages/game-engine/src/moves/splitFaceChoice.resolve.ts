/**
 * resolveSplitFaceChoice move — resolves a pending split / dual-faced hero "choose a side"
 * player choice (WP-724 / D-24546 — the split hero card mechanic that un-defers D-14101).
 *
 * A split physical card (`physicalCards[].sides.length === 2`) has two faces printed on one
 * card. When it is PLAYED, playCard places it in `inPlay` as its primary face (`sides[0]`
 * instance), DEFERS the card's own economy + ability, and parks a PendingSplitFaceChoice on
 * G.pendingSplitFaceChoices (FIFO). The ACTIVE player then calls this move to bind a side:
 *
 *   - `face: 'a'` → keep the primary face (`sides[0]`).
 *   - `face: 'b'` → swap the in-play instance to the alternate face (`sides[1]`).
 *
 * Once bound, the CHOSEN face's base attack/recruit is granted to G.turnEconomy and its
 * onPlay ability fires — exactly what applyCardPlay does for a non-split card, deferred here
 * to run against the chosen face's ext_id. The other face does nothing. This mirrors the
 * existing Transform base→target strip-and-map idiom (heroEffects.execute.ts) — both faces'
 * per-copy stats / ability hooks / display are enumerated into G at setup (D-24545), so
 * resolving either face is a pure state read.
 *
 * Freeze-safe scoping (D-24284): only the ACTIVE player holds the pending choice. A block-all
 * guard on every action move keeps the board frozen until this resolves.
 *
 * Atomicity: a failed validation (invalid face, empty queue, wrong player) returns before any
 * mutation and leaves the queue intact. No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { CardExtId, LegendaryGameState, PendingSplitFaceChoice } from '../types.js';
import { addResources } from '../economy/economy.logic.js';
import { executeHeroEffects } from '../hero/heroEffects.execute.js';
import { pushLog } from '../log/logPush.js';
import { formatBaseEconomyClause, formatPlayedCardLabel } from '../log/logDisplay.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveSplitFaceChoice move.
 *
 * The active player must pick exactly one side of the split card.
 */
export interface ResolveSplitFaceChoiceArgs {
  /** Which face of the split card to bind: 'a' = primary (sides[0]), 'b' = alternate (sides[1]). */
  face: 'a' | 'b';
}

/**
 * Whether any split-face "choose a side" choice is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the getLegalMoves
 * short-circuit. `undefined` and `[]` both mean no pending choice (mirrors
 * hasPendingCoveringFireChoice, D-24541).
 *
 * // why: pendingSplitFaceChoices is lazy-init (D-24546); undefined and [] both mean no pending choice
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending split-face queue holds at least one entry.
 */
export function hasPendingSplitFaceChoice(G: LegendaryGameState): boolean {
  return (G.pendingSplitFaceChoices?.length ?? 0) > 0;
}

/**
 * Splits a hero card instance ext_id into its copy-agnostic base key and its `#copyIndex`
 * suffix. Mirrors the Transform strip-`#copy` idiom (heroEffects.execute.ts).
 *
 * // why: G.splitFaces is a copy-agnostic base→alternate map; the played instance carries a
 * `#copyIndex` the alternate face shares, so strip it to look up, then reattach it.
 *
 * @param cardId - A card instance ext_id, e.g. `cvwr/peter-parker/hot-bowl-of-soup#0`.
 * @returns The base key (before `#`) and the suffix (`#0`, or '' when absent).
 */
function splitInstanceIntoBaseAndCopy(cardId: string): { baseKey: string; copySuffix: string } {
  const hashIndex = cardId.indexOf('#');
  if (hashIndex === -1) {
    return { baseKey: cardId, copySuffix: '' };
  }
  return { baseKey: cardId.slice(0, hashIndex), copySuffix: cardId.slice(hashIndex) };
}

/**
 * Whether the given played instance is a split / dual-faced card (WP-724 / D-24545).
 *
 * True when the instance's copy-agnostic base key is a primary face registered in
 * G.splitFaces. Called by playCard to decide whether to park a "choose a side" choice
 * instead of resolving the play immediately.
 *
 * @param G - The game state (reads G.splitFaces only).
 * @param cardId - The played instance ext_id.
 * @returns true when the card is a split card with an alternate face.
 */
export function isSplitCardInstance(G: LegendaryGameState, cardId: string): boolean {
  if (G.splitFaces === undefined) {
    return false;
  }
  const { baseKey } = splitInstanceIntoBaseAndCopy(cardId);
  return G.splitFaces[baseKey as CardExtId] !== undefined;
}

/**
 * Parks a split-face "choose a side" choice for the active player (WP-724 / D-24546).
 *
 * Called by playCard AFTER the split card has been appended to inPlay as its primary face,
 * and BEFORE any economy is granted. Lazily initializes the FIFO queue (never in Game.setup)
 * and records both face ext_ids: faceA is the played (primary) instance; faceB is the
 * alternate face's instance for the same physical copy (same `#copyIndex`).
 *
 * // why: D-24546 — the card is already in inPlay as faceA; the economy + ability are deferred
 * until resolveSplitFaceChoice binds the side. Assumes isSplitCardInstance(G, cardId) is true.
 *
 * @param G - The game state to mutate.
 * @param playerID - The active player playing the split card.
 * @param cardId - The played primary-face instance ext_id (faceA).
 */
export function parkSplitFaceChoice(G: LegendaryGameState, playerID: string, cardId: CardExtId): void {
  // why: assumes the caller checked isSplitCardInstance; splitFaces + the base key are present.
  const splitFaces = G.splitFaces;
  if (splitFaces === undefined) {
    return;
  }
  const { baseKey, copySuffix } = splitInstanceIntoBaseAndCopy(cardId);
  const alternateBase = splitFaces[baseKey as CardExtId];
  if (alternateBase === undefined) {
    return;
  }
  const faceB = `${alternateBase}${copySuffix}` as CardExtId;

  const pending: PendingSplitFaceChoice = {
    playerID,
    sourceCardId: cardId,
    faceA: cardId,
    faceB,
  };
  // why: lazy-init the FIFO queue at the park site (D-24546); never seeded in Game.setup.
  if (G.pendingSplitFaceChoices === undefined) {
    G.pendingSplitFaceChoices = [];
  }
  G.pendingSplitFaceChoices.push(pending);
}

/**
 * Resolves the FRONT pending split-face choice.
 *
 * Atomic sequence (HARD — exact order, mirrors coveringFireChoice.resolve.ts):
 *   1. Validate args — face must be exactly 'a' or 'b'; anything else is a silent no-op.
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3. Bind the chosen face:
 *      - 'a' → keep faceA (already in inPlay).
 *      - 'b' → replace the faceA entry in inPlay with faceB (relabel the same physical copy).
 *      Grant the CHOSEN face's base attack/recruit (G.cardStats[chosen]) to G.turnEconomy,
 *      then fire the chosen face's onPlay ability (executeHeroEffects) — the deferred play.
 *   4. Front-pop (queue.shift()) LAST.
 *
 * Any failure before step 3 ABORTS (no swap, no economy, no ability, no shift). Moves never throw.
 *
 * // why: block-all guard — no other move may fire while a split-face choice is outstanding (D-24546)
 *
 * @param context - boardgame.io move context with G, playerID, and the rest (ctx, events,
 *   random, log) spread into `context` so the chosen face's ability has access to context.random.
 * @param args - the chosen face ('a' or 'b').
 */
export function resolveSplitFaceChoice(
  { G, playerID, ...context }: MoveContext,
  args: ResolveSplitFaceChoiceArgs,
): void {
  // Step 1: Validate args — face must be exactly 'a' or 'b'.
  const face = (args as { face?: unknown }).face;
  if (face !== 'a' && face !== 'b') {
    return;
  }

  // Step 2: Validate the front pending entry — front-only resolution (no index in the payload).
  // why: pendingSplitFaceChoices is lazy-init (D-24546); undefined and [] both mean no pending choice
  const queue = G.pendingSplitFaceChoices;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  if (front.playerID !== playerID) {
    return;
  }

  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }

  const chosenExtId = face === 'a' ? front.faceA : front.faceB;

  // Step 3: Bind the chosen face.
  if (face === 'b') {
    // why: D-24545 — the same physical copy is already in inPlay as faceA; relabel that one
    // entry to faceB so every downstream projection (display, economy, ability) reads the
    // chosen face. indexOf finds the just-played instance (block-all means it is unique here).
    const inPlayIndex = playerZones.inPlay.indexOf(front.faceA);
    if (inPlayIndex !== -1) {
      const nextInPlay = [...playerZones.inPlay];
      nextInPlay[inPlayIndex] = front.faceB;
      playerZones.inPlay = nextInPlay;
    }
  }

  // why: the split card's own economy was DEFERRED at play time (D-24546); grant the CHOSEN
  // face's base attack/recruit now — mirrors applyCardPlay's base-economy step for a non-split
  // card, keyed to the chosen face's ext_id (both faces' stats live in G.cardStats per D-24545).
  const cardStats = G.cardStats[chosenExtId];
  const chosenAttack = cardStats ? cardStats.attack : 0;
  const chosenRecruit = cardStats ? cardStats.recruit : 0;
  G.turnEconomy = addResources(G.turnEconomy, chosenAttack, chosenRecruit);

  pushLog(
    G,
    `Player ${playerID} chose ${formatPlayedCardLabel(G.cardDisplayData, chosenExtId, formatBaseEconomyClause(chosenAttack, chosenRecruit))}.`,
    'neutral',
    chosenExtId,
  );

  // why: fire the chosen face's onPlay ability — the deferred half of the play (D-24546). Keyed
  // to the chosen face's ext_id so getHooksForCard resolves that face's hooks (D-24545). This may
  // itself park a further pending choice (e.g. the chosen face is a Smash/Covering Fire card),
  // which is legitimate — it queues after this split-face entry is popped below.
  G.lastPlayEffectsFired = executeHeroEffects(G, context, playerID, chosenExtId);

  // Step 4: Front-pop LAST (front-pop = Array.shift), mirroring coveringFireChoice.resolve.ts.
  queue.shift();
}
