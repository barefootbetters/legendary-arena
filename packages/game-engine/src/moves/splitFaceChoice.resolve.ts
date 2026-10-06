/**
 * resolveSplitFaceChoice move — resolves a pending split / dual-faced hero "choose a side"
 * player choice (WP-724 / D-24546 — the split hero card mechanic that un-defers D-14101).
 *
 * A split physical card (`physicalCards[].sides.length === 2`) has two faces printed on one
 * card. When it is PLAYED, playCard places it in `inPlay` under the id it carried (the
 * primary face, or face b when it was played as face b before — WP-772 / D-24604), DEFERS the
 * card's own economy + ability, and parks a PendingSplitFaceChoice on
 * G.pendingSplitFaceChoices (FIFO). The ACTIVE player then calls this move to bind a side:
 *
 *   - `face: 'a'` → the primary face (`sides[0]`).
 *   - `face: 'b'` → the alternate face (`sides[1]`).
 *   The in-play instance is relabelled to the chosen face when it differs.
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
import { addResources, markBothSidesPlayed } from '../economy/economy.logic.js';
import { executeHeroEffects } from '../hero/heroEffects.execute.js';
import { pushLog } from '../log/logPush.js';
import { formatBaseEconomyClause, formatPlayedCardLabel } from '../log/logDisplay.js';
import { resolveSplitFacePair } from '../hero/splitCard.logic.js';
import { getDiscardToPlayCost } from './resolveDiscardToPlay.js';

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
export function splitInstanceIntoBaseAndCopy(cardId: string): { baseKey: string; copySuffix: string } {
  const hashIndex = cardId.indexOf('#');
  if (hashIndex === -1) {
    return { baseKey: cardId, copySuffix: '' };
  }
  return { baseKey: cardId.slice(0, hashIndex), copySuffix: cardId.slice(hashIndex) };
}

/**
 * Whether the given played instance is a split / dual-faced card (WP-724 / D-24545).
 *
 * True for EITHER face id of a split card (WP-772 / D-24604). Called by playCard to decide
 * whether to park a "choose a side" choice instead of resolving the play immediately.
 *
 * // why: a card played as face b keeps its face-b id through cleanup, so the next play of
 * that physical copy arrives as the face-b id. Recognising only primary ids made such a card
 * skip the choice and play as face b forever; rules v23 p.49 chooses a side on EVERY play.
 *
 * @param G - The game state (reads the split-face map only).
 * @param cardId - The played instance ext_id.
 * @returns true when the card is a split card with an alternate face.
 */
export function isSplitCardInstance(G: LegendaryGameState, cardId: string): boolean {
  return resolveSplitFacePair(G, cardId) !== null;
}

/**
 * Whether the player can pay a split face's discard-to-play cost right now (WP-777 / D-24615).
 *
 * // why: at choice time the split card is already in inPlay, so the hand holds only the
 * OTHER cards — exactly the cards the cost may be paid with. A face with no cost is always
 * payable. The cost comes from getDiscardToPlayCost, the single cost source playCard's
 * D-24185 precondition and the park handler also use.
 *
 * @param G - The game state (not mutated).
 * @param playerID - The player choosing the face.
 * @param faceExtId - The face instance ext_id.
 * @returns true when the face has no cost or the hand holds enough cards to pay it.
 */
export function isSplitFacePayable(
  G: LegendaryGameState,
  playerID: string,
  faceExtId: CardExtId,
): boolean {
  const cost = getDiscardToPlayCost(G, faceExtId);
  if (cost === 0) {
    return true;
  }
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return false;
  }
  return playerZones.hand.length >= cost;
}

/**
 * Whether a split face may be bound by resolveSplitFaceChoice (WP-777 / D-24615).
 *
 * // why: anti-freeze fallback — a face is bindable when it is payable, OR when the other
 * face is not payable either, so the block-all choice can never hard-freeze the turn. No
 * card in the data has a cost on both faces; if one ever did, the park handler's defensive
 * branch would grant that face without a discard — an accepted leak over a frozen turn.
 *
 * @param G - The game state (not mutated).
 * @param playerID - The player choosing the face.
 * @param faceExtId - The face being chosen.
 * @param otherFaceExtId - The other face of the same card.
 * @returns true when the face may be bound.
 */
export function isSplitFaceBindable(
  G: LegendaryGameState,
  playerID: string,
  faceExtId: CardExtId,
  otherFaceExtId: CardExtId,
): boolean {
  if (isSplitFacePayable(G, playerID, faceExtId)) {
    return true;
  }
  return !isSplitFacePayable(G, playerID, otherFaceExtId);
}

/**
 * Parks a split-face "choose a side" choice for the active player (WP-724 / D-24546).
 *
 * Called by playCard AFTER the split card has been appended to inPlay as its primary face,
 * and BEFORE any economy is granted. Lazily initializes the FIFO queue (never in Game.setup)
 * and records both face ext_ids for the same physical copy (same `#copyIndex`): faceA is
 * ALWAYS the primary (sides[0]) instance and faceB the alternate (sides[1]), whichever face id
 * was played; sourceCardId is the id actually in inPlay (WP-772 / D-24604).
 *
 * // why: D-24546 — the card is already in inPlay as sourceCardId; the economy + ability are
 * deferred until resolveSplitFaceChoice binds the side. Pinning faceA to the primary keeps the
 * 'a'/'b' meaning stable across replays and keeps the picker's leftFace projection (which
 * strips faceA's #copy to find the card) correct. Assumes isSplitCardInstance(G, cardId).
 *
 * @param G - The game state to mutate.
 * @param playerID - The active player playing the split card.
 * @param cardId - The played instance ext_id (either face).
 */
export function parkSplitFaceChoice(G: LegendaryGameState, playerID: string, cardId: CardExtId): void {
  const pair = resolveSplitFacePair(G, cardId);
  if (pair === null) {
    return;
  }

  const pending: PendingSplitFaceChoice = {
    playerID,
    sourceCardId: cardId,
    faceA: pair.faceA,
    faceB: pair.faceB,
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
 *   3. Bind the chosen face: when the chosen face id differs from sourceCardId (the id in
 *      inPlay), relabel that inPlay entry to the chosen face (the same physical copy).
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
  // why: a client may submit the move with no payload (undefined) or null; reading a field off
  // either throws a TypeError, and moves never throw — reject before any field read.
  if (args === null || typeof args !== 'object') {
    return;
  }
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
  const otherExtId = face === 'a' ? front.faceB : front.faceA;

  // why: WP-777 / D-24615 — a side's discard-to-play cost ("To play this side, you must
  // discard a card", bkwd Attune) binds HERE, where the side is chosen: the D-24185 playCard
  // precondition runs before the side is known and is skipped for split cards. An unpayable
  // side is rejected with a log line and the queue left intact; the log write guarantees a
  // fresh frame so the picker's submit latch resets and the other side stays clickable.
  if (!isSplitFaceBindable(G, playerID, chosenExtId, otherExtId)) {
    pushLog(
      G,
      `Player ${playerID} could not choose ${G.cardDisplayData[chosenExtId]?.name ?? chosenExtId} — it requires discarding ${getDiscardToPlayCost(G, chosenExtId)} card(s) but their hand does not hold enough cards to discard; choose the other side.`,
      'neutral',
      chosenExtId,
    );
    return;
  }

  // Step 3: Bind the chosen face.
  if (chosenExtId !== front.sourceCardId) {
    // why: D-24545 / D-24604 — the same physical copy is already in inPlay as sourceCardId,
    // which is face b when a card played as face b last time comes round again; so the chosen
    // face may be EITHER a (played-as-b choosing a) or b (played-as-a choosing b). Relabel that
    // one entry so every downstream projection (display, economy, ability) reads the chosen
    // face. indexOf finds the just-played instance (block-all means it is unique here).
    const inPlayIndex = playerZones.inPlay.indexOf(front.sourceCardId);
    if (inPlayIndex !== -1) {
      const nextInPlay = [...playerZones.inPlay];
      nextInPlay[inPlayIndex] = chosenExtId;
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

/**
 * Grants one face's base attack/recruit, logs it, and fires that face's onPlay ability, for a
 * split card played both-sides under Penumbra (WP-780 / D-24619).
 *
 * @param G - The game state to mutate.
 * @param context - The move context (ctx, events, random, log) passed to executeHeroEffects.
 * @param playerID - The active player.
 * @param faceId - The face instance ext_id to resolve (face a or face b).
 * @param side - Which side this is, for the log line.
 * @returns The number of hero effects that fired for this face.
 */
function resolveBothSidesFace(
  G: LegendaryGameState,
  context: Omit<MoveContext, 'G' | 'playerID'>,
  playerID: string,
  faceId: CardExtId,
  side: 'a' | 'b',
): number {
  const cardStats = G.cardStats[faceId];
  const faceAttack = cardStats ? cardStats.attack : 0;
  const faceRecruit = cardStats ? cardStats.recruit : 0;
  G.turnEconomy = addResources(G.turnEconomy, faceAttack, faceRecruit);
  pushLog(
    G,
    `Player ${playerID} resolved side ${side}: ${formatPlayedCardLabel(G.cardDisplayData, faceId, formatBaseEconomyClause(faceAttack, faceRecruit))}.`,
    'neutral',
    faceId,
  );
  return executeHeroEffects(G, context, playerID, faceId);
}

/**
 * Logs that one face of a split card was skipped under Penumbra because its discard-to-play
 * cost cannot be paid (D-24625). The face grants no economy and fires no hooks.
 *
 * @param G - The game state to mutate (log only).
 * @param playerID - The active player.
 * @param faceId - The skipped face instance ext_id.
 * @param side - Which side was skipped, for the log line.
 */
function logBothSidesFaceSkipped(
  G: LegendaryGameState,
  playerID: string,
  faceId: CardExtId,
  side: 'a' | 'b',
): void {
  pushLog(
    G,
    `Player ${playerID} could not play side ${side}, ${G.cardDisplayData[faceId]?.name ?? faceId} — it requires discarding ${getDiscardToPlayCost(G, faceId)} card(s) but their hand does not hold enough cards to discard, so that side is skipped.`,
    'neutral',
    faceId,
  );
}

/**
 * Plays BOTH faces of a split card as two different cards, face a then face b, while cvwr
 * Penumbra is active this turn (WP-780 / D-24619). Called by playCard after the card has left
 * the hand, instead of parking the choose-a-side picker.
 *
 * Each face must be payable before it resolves (WP-777's isSplitFacePayable / D-24625): a face
 * whose discard-to-play cost the hand cannot pay is skipped entirely (no economy, no hooks, one
 * log line); a payable face resolves normally and its own discard-to-play hook charges the cost.
 *
 * The physical card enters inPlay ONCE. When both faces play, the entry is the face-a id and is
 * recorded in `bothSidesPlayedCardIds` between the faces. When only one face plays, the entry is
 * that face's id and is NOT marked — the card counts as the one face that was actually played.
 *
 * @param G - The game state to mutate.
 * @param context - The move context (ctx, events, random, log) passed to executeHeroEffects.
 * @param playerID - The active player.
 * @param cardId - The played instance ext_id (either face).
 * @returns false when the id has no split pair (playCard then falls through to its park path,
 *   so the card is never lost); true otherwise, including the silent no-op on missing zones.
 */
export function playBothSplitFaces(
  G: LegendaryGameState,
  context: Omit<MoveContext, 'G' | 'playerID'>,
  playerID: string,
  cardId: CardExtId,
): boolean {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return true;
  }
  const pair = resolveSplitFacePair(G, cardId);
  if (pair === null) {
    return false;
  }
  // why: D-24625 — face a plays when payable, or when face b is not payable either (the
  // isSplitFaceBindable anti-freeze fallback, D-24615 §2, so an all-costed card still plays one
  // face as the picker path would). No card in the data has a cost on both faces.
  const isFaceAPlayed = isSplitFaceBindable(G, playerID, pair.faceA, pair.faceB);
  // why: a card last played as face b keeps its face-b id; under Penumbra the one physical card
  // is entered as ONE face-a entry so both faces resolve in data order (sides[0] then sides[1]).
  // When face a is skipped, the entry is face b — the only face actually played.
  const entryId = isFaceAPlayed ? pair.faceA : pair.faceB;
  playerZones.inPlay = [...playerZones.inPlay, entryId];
  const entryLabel = formatPlayedCardLabel(G.cardDisplayData, entryId, '');
  pushLog(G, `Player ${playerID} played ${entryLabel}.`, 'neutral', entryId);
  pushLog(G, `Penumbra: both sides of ${entryLabel} play as two different cards.`, 'neutral', entryId);

  if (!isFaceAPlayed) {
    // why: face a was skipped, so face b is the card's only face this turn — no marker, so
    // "cards played this turn" reads see exactly one card (the face-b entry).
    logBothSidesFaceSkipped(G, playerID, pair.faceA, 'a');
    G.lastPlayEffectsFired = resolveBothSidesFace(G, context, playerID, pair.faceB, 'b');
    return true;
  }

  const effectsFiredA = resolveBothSidesFace(G, context, playerID, pair.faceA, 'a');
  // why: face b's payability is read AFTER face a resolves — face a's effects (a draw, a
  // discard) change the hand the cost is paid from. Boy Genius draws before Manly Dullard's cost.
  if (!isSplitFacePayable(G, playerID, pair.faceB)) {
    // why: face b is skipped, so the entry stays an ordinary face-a play — no marker.
    logBothSidesFaceSkipped(G, playerID, pair.faceB, 'b');
    G.lastPlayEffectsFired = effectsFiredA;
    return true;
  }
  // why: the faces are played sequentially — record the marker only AFTER face a resolves, so
  // face a sees a plain one-face entry (face b is not yet played) and face b's reads expand the
  // entry and see face a as another card played this turn.
  G.turnEconomy = markBothSidesPlayed(G.turnEconomy, pair.faceA);
  const effectsFiredB = resolveBothSidesFace(G, context, playerID, pair.faceB, 'b');
  G.lastPlayEffectsFired = effectsFiredA + effectsFiredB;
  return true;
}
