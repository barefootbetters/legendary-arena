/**
 * resolveUndercoverChoice move — resolves a pending Undercover target pick
 * (WP-678 / D-24494, supersedes D-24060; widened by WP-901 / D-24858).
 *
 * Called by the active player (or the deterministic bot) after an Undercover effect
 * parked a PendingUndercoverChoice on G.pendingUndercoverChoice (FIFO):
 *   - 'hand-shield-hero' (D-24494): TWO OR MORE eligible [team:shield] Heroes were in
 *     hand (0 eligible = no-op, 1 = auto-send — neither parks). No decline.
 *   - 'your-hero' (D-24858): "you may send one of your [other] Heroes Undercover" —
 *     Heroes in hand AND in play, always declinable.
 * The chosen Hero is sent Undercover (into the Victory Pile, worth 1 VP) via the shared
 * send helpers — no re-implementation of the send.
 *
 * Atomicity: the chosen send (or the decline) fires, then the front entry is popped. A
 * failed validation (bad args, empty queue, wrong player, target not eligible, a
 * 'your-hero' target no longer in its zone) returns before any mutation and leaves the
 * queue intact.
 *
 * No registry imports. No .reduce(). Moves never throw.
 */

import type { FnContext, PlayerID } from 'boardgame.io';
import type { LegendaryGameState, PendingUndercoverChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { moveCardUndercover, sendCardUndercover } from '../hero/heroEffects.execute.js';
import { recordPlayedCardLeftPlay } from '../economy/economy.logic.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';
import { SHIELD_AGENT_EXT_ID, SHIELD_TROOPER_EXT_ID } from '../setup/pilesInit.js';

/** Move context provided by boardgame.io 0.50.x to every move function. */
type MoveContext = FnContext<LegendaryGameState> & { playerID: PlayerID };

/** The zone a 'your-hero' target is sent from (a hand-shield target is always 'hand'). */
export type UndercoverTargetZone = 'hand' | 'inPlay';

/**
 * Payload for the resolveUndercoverChoice move (WP-901 / D-24858 XOR union).
 *
 * Either decline (only a 'your-hero' entry allows it) or name the target and, for an
 * in-play target, its zone. An absent `zone` means 'hand', so the WP-678 `{ targetExtId }`
 * callers still type-check and behave as before. A payload carrying both forms is refused.
 */
export type ResolveUndercoverChoiceArgs =
  | { decline: true }
  | { targetExtId: CardExtId; zone?: UndercoverTargetZone };

/** The validated payload: a decline, or a target with its resolved zone. */
type ParsedUndercoverArgs =
  | { kind: 'decline' }
  | { kind: 'send'; targetExtId: CardExtId; zone: UndercoverTargetZone };

/**
 * Whether any Undercover target pick is currently pending.
 *
 * Single predicate imported by the block-all action-move guards and the
 * getLegalMoves short-circuit. `undefined` and `[]` both mean no pending choice
 * (mirrors hasPendingDrawOrEmpowered / hasPendingCountScaledChoice).
 *
 * // why: pendingUndercoverChoice is lazy-init (D-24494); undefined and [] both mean no pending choice
 *
 * @param G - The game state to inspect (not mutated).
 * @returns true when the pending Undercover queue holds at least one entry.
 */
export function hasPendingUndercoverChoice(G: LegendaryGameState): boolean {
  return (G.pendingUndercoverChoice?.length ?? 0) > 0;
}

/**
 * Validates the resolve payload into exactly one form (WP-901 / D-24858).
 *
 * @param args - The raw move payload (may be anything a client sends).
 * @returns The parsed decline or send, or null when the payload is malformed.
 */
function parseResolveUndercoverArgs(args: unknown): ParsedUndercoverArgs | null {
  // why: a client may submit the move with no payload (undefined) or null; reading a field off
  // either throws a TypeError, and moves never throw — reject before any field read.
  if (args === null || typeof args !== 'object') {
    return null;
  }
  const fields = args as { decline?: unknown; targetExtId?: unknown; zone?: unknown };
  const hasDecline = fields.decline !== undefined;
  const hasTarget = fields.targetExtId !== undefined;
  // why: WP-901 / D-24858 — the args are an XOR union; a payload naming both a decline and a
  // target is ambiguous, so it is refused (no pop) rather than guessed at.
  if (hasDecline === hasTarget) {
    return null;
  }
  if (hasDecline) {
    return fields.decline === true ? { kind: 'decline' } : null;
  }
  if (typeof fields.targetExtId !== 'string' || fields.targetExtId.length === 0) {
    return null;
  }
  if (fields.zone === undefined || fields.zone === 'hand') {
    return { kind: 'send', targetExtId: fields.targetExtId as CardExtId, zone: 'hand' };
  }
  if (fields.zone === 'inPlay') {
    return { kind: 'send', targetExtId: fields.targetExtId as CardExtId, zone: 'inPlay' };
  }
  return null;
}

/**
 * Whether a 'your-hero' target was snapshotted for its zone AND is still in that zone now.
 *
 * @param front - The front pending entry (source 'your-hero').
 * @param zones - The chooser's live hand and in-play arrays.
 * @param targetExtId - The chosen card.
 * @param zone - The zone it is sent from.
 * @returns true when the send may go ahead.
 */
function isYourHeroTargetLive(
  front: PendingUndercoverChoice,
  zones: { hand: readonly CardExtId[]; inPlay: readonly CardExtId[] },
  targetExtId: CardExtId,
  zone: UndercoverTargetZone,
): boolean {
  if (zone === 'inPlay') {
    return (front.eligibleInPlayTargets ?? []).includes(targetExtId) && zones.inPlay.includes(targetExtId);
  }
  return front.eligibleTargets.includes(targetExtId) && zones.hand.includes(targetExtId);
}

/**
 * Resolves the FRONT pending Undercover target pick.
 *
 * Atomic sequence (HARD — exact order, mirrors drawOrEmpowered.resolve.ts):
 *   1. Validate args — exactly one of `{ decline: true }` / `{ targetExtId, zone? }`.
 *   2. Validate the front pending entry — non-empty queue, front.playerID match.
 *   3a. Decline — only when front.canDecline === true; log; pop.
 *   3b. Hand-shield send — 'hand' zone only; snapshot check; today's send; pop.
 *   3c. 'your-hero' send — the target must be snapshotted AND still in its zone, else
 *       return without popping; move it Undercover, log it by name, pop.
 *
 * Any failure before the send/decline ABORTS (no move, no shift). Moves never throw.
 *
 * // why: block-all guard — no other move may fire while an Undercover pick is outstanding (D-24494)
 *
 * @param context - boardgame.io move context with G, playerID.
 * @param args - a decline, or the chosen target ext_id and its zone.
 */
export function resolveUndercoverChoice(
  { G, playerID }: MoveContext,
  args: ResolveUndercoverChoiceArgs,
): void {
  // Step 1: Validate args.
  const parsed = parseResolveUndercoverArgs(args);
  if (parsed === null) {
    return;
  }

  // Step 2: Validate the front pending entry — front-only resolution.
  // why: pendingUndercoverChoice is lazy-init (D-24494); undefined and [] both mean no pending choice
  const queue = G.pendingUndercoverChoice;
  if (queue === undefined || queue.length === 0) {
    return;
  }
  const front = queue[0]!;
  const zones = G.playerZones[playerID];
  if (front.playerID !== playerID || !zones) {
    return;
  }

  if (parsed.kind === 'decline') {
    // why: WP-901 / D-24858 — only a 'your-hero' entry may be declined (canDecline is written
    // true there and never on a hand-shield entry; read === true, the D-24600 precedent).
    if (front.canDecline !== true) {
      return;
    }
    pushLog(G, `Player ${playerID} chose not to send a Hero Undercover.`);
    queue.shift();
    return;
  }

  const targetExtId = parsed.targetExtId;
  if (front.source !== 'your-hero') {
    // why: a hand-shield entry (D-24494) keeps today's path exactly: hand only (an in-play zone
    // is refused), the snapshot check, then the shared send — a no-op if the card left the hand
    // meanwhile — then the pop. It has no decline, so it must always pop to never freeze.
    if (parsed.zone !== 'hand' || !front.eligibleTargets.includes(targetExtId)) {
      return;
    }
    zones.hand = sendCardUndercover(G, playerID, targetExtId, zones.hand);
    queue.shift();
    return;
  }

  // why: WP-901 / D-24858 — zone gate + stale-target no-pop ('your-hero' only): the target must be
  // in the snapshot for its zone and still be there now. Another queue may have moved it first;
  // then the pick stays open, and the player picks another card or declines (canDecline).
  if (!isYourHeroTargetLive(front, zones, targetExtId, parsed.zone)) {
    return;
  }
  if (parsed.zone === 'inPlay') {
    zones.inPlay = moveCardUndercover(G, playerID, targetExtId, zones.inPlay);
    // why: WP-899 / D-24856 — a played card that leaves play mid-turn still counts as played this
    // turn; record the exit so the play-history gates keep seeing it.
    G.turnEconomy = recordPlayedCardLeftPlay(G.turnEconomy, targetExtId);
  } else {
    zones.hand = moveCardUndercover(G, playerID, targetExtId, zones.hand);
  }
  pushLog(G, `Player ${playerID} sent ${formatCardRef(G.cardDisplayData, targetExtId)} Undercover (into the Victory Pile, +1 VP).`);
  queue.shift();
}

/**
 * The bot's default answer to a 'your-hero' Undercover pick (WP-901 / D-24858).
 *
 * // why: rules v23 §Undercover — sending a starting S.H.I.E.L.D. Agent or Trooper is the
 * printed advice ("This can help get your starting S.H.I.E.L.D. Agents and Troopers out of your
 * deck"); a played one has already paid out this turn, so it goes first. Any other Hero is a
 * real loss, so the bot declines instead. Reads the LIVE zones, so it never offers a target the
 * resolve would refuse (a refused bot move would loop getLegalMoves).
 *
 * @param front - The front pending entry (source 'your-hero').
 * @param zones - The chooser's live hand and in-play arrays.
 * @returns The zone and target to send, or null to decline.
 */
export function selectDefaultUndercoverYourHeroTarget(
  front: PendingUndercoverChoice,
  zones: { hand: readonly CardExtId[]; inPlay: readonly CardExtId[] },
): { zone: UndercoverTargetZone; targetExtId: CardExtId } | null {
  for (const cardId of front.eligibleInPlayTargets ?? []) {
    if (isStarterUndercoverTarget(cardId) && zones.inPlay.includes(cardId)) {
      return { zone: 'inPlay', targetExtId: cardId };
    }
  }
  for (const cardId of front.eligibleTargets) {
    if (isStarterUndercoverTarget(cardId) && zones.hand.includes(cardId)) {
      return { zone: 'hand', targetExtId: cardId };
    }
  }
  return null;
}

/**
 * Whether a card is a starting S.H.I.E.L.D. Agent or Trooper (the bot's Undercover target).
 *
 * @param cardId - The card to test.
 * @returns true for the two starter ext ids.
 */
function isStarterUndercoverTarget(cardId: CardExtId): boolean {
  return cardId === SHIELD_AGENT_EXT_ID || cardId === SHIELD_TROOPER_EXT_ID;
}
