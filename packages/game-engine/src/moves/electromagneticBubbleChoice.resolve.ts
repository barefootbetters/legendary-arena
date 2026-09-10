/**
 * resolveElectromagneticBubbleChoice move — resolves a pending Magneto
 * "Electromagnetic Bubble" X-Men Hero pick (WP-695 / D-24512).
 *
 * Called by the defeating (active) player after Electromagnetic Bubble's Fight was
 * defeated with ≥2 in-play X-Men Heroes and parked a PendingElectromagneticBubbleChoice
 * carrying the eligible in-play X-Men ext_ids (`eligibleCardIds`). The player picks ONE;
 * its ext_id is recorded into `G.deferredHandInjections[playerID]`, consumed once at the
 * player's NEXT play-phase `onBegin` fill (game.ts) to add it as an extra (seventh)
 * card. The queue front-pops on success.
 *
 * All invalid states are silent no-ops (moves never throw). The queue is left
 * byte-identical on every no-op so the player can resubmit a valid pick — the block-all
 * guard freezes the board while pending.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { pushLog } from '../log/logPush.js';
import { resolveCardName } from '../log/logDisplay.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/**
 * Payload for the resolveElectromagneticBubbleChoice move.
 *
 * cardId — the in-play X-Men Hero ext_id to add to the next hand (must be one of the
 *   front pending entry's `eligibleCardIds` snapshot; the round-trip rule).
 */
export interface ResolveElectromagneticBubbleChoiceArgs {
  cardId: CardExtId;
}

/**
 * Whether any Electromagnetic Bubble X-Men pick is currently pending.
 *
 * Single predicate imported by the turn-end guards (endTurn, advanceStage) and the
 * block-all action-move guards. `undefined` and `[]` both mean no pending choice
 * (mirrors hasPendingScryKoChoice / hasPendingMelterKoChoice, D-24007).
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending-Electromagnetic-Bubble queue holds at least one entry.
 */
export function hasPendingElectromagneticBubbleChoice(G: LegendaryGameState): boolean {
  return (G.pendingElectromagneticBubbleChoices?.length ?? 0) > 0;
}

/**
 * Resolves the FRONT pending Electromagnetic Bubble pick by recording the chosen X-Men
 * Hero as a deferred hand injection.
 *
 * Validate args → validate the front pending entry (playerID / choiceType) → validate
 * the cardId against the front's `eligibleCardIds` snapshot (round-trip rule) → record
 * the deferred injection (lazily creating the map + per-player array) → front-pop on
 * success. Silent no-ops: empty/non-string cardId; empty queue; front.playerID mismatch;
 * front.choiceType mismatch; cardId not in `eligibleCardIds`.
 *
 * @param context - boardgame.io move context with G and playerID.
 * @param args - the selected { cardId } in-play X-Men Hero to add to the next hand.
 */
export function resolveElectromagneticBubbleChoice(
  { G, playerID }: MoveContext,
  args: ResolveElectromagneticBubbleChoiceArgs,
): void {
  // Step 1: Validate args — empty / non-string cardId is a no-op.
  if (typeof args.cardId !== 'string' || args.cardId.length === 0) { return; }

  // Step 2: Validate the front pending entry — front-only resolution (no index in the
  // payload). Only the defeating player who owns the choice may resolve it.
  const queue = G.pendingElectromagneticBubbleChoices;
  if (queue === undefined || queue.length === 0) { return; }
  const front = queue[0]!;
  if (front.playerID !== playerID) { return; }
  if (front.choiceType !== 'electromagnetic-bubble') { return; }

  // Step 3: Validate the pick against the front's eligible snapshot (round-trip rule) —
  // the client submits a cardId the engine projected, and only those are accepted.
  // Explicit scan, not .includes over a helper, keeps the validation boring and correct.
  let isEligible = false;
  for (const eligibleId of front.eligibleCardIds) {
    if (eligibleId === args.cardId) {
      isEligible = true;
      break;
    }
  }
  if (!isEligible) { return; }

  // Step 4: Record the deferred injection. Lazily create the map + per-player array
  // before the first write — the field is absent by default (never seeded in Game.setup),
  // and index-assigning undefined would throw. Duplicated here (rather than importing the
  // rules/tacticHandlers helper) to avoid a moves→rules import cycle; a 4-line lazy-init.
  if (G.deferredHandInjections === undefined) {
    G.deferredHandInjections = {};
  }
  if (G.deferredHandInjections[playerID] === undefined) {
    G.deferredHandInjections[playerID] = [];
  }
  G.deferredHandInjections[playerID].push(args.cardId);

  // Step 5: Narrate the resolved pick. `G.messages` is hash-excluded (D-24081).
  const cardName = resolveCardName(G.cardDisplayData, args.cardId);
  pushLog(G,
    `Player ${playerID} will add ${cardName} (${args.cardId}) to their next hand as a seventh card (Electromagnetic Bubble).`,
    'applied',
    args.cardId,
  );

  // Step 6: Front-pop ONLY on success.
  queue.shift();
}
