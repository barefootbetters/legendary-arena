/**
 * The hero Transform swap (WP-658 / D-24469), extracted to a leaf (WP-885 / D-24836).
 *
 * Two callers run it: `heroEffectTransform` in heroEffects.execute.ts (the `transform` keyword on a
 * SUPPORTED_TRANSFORM_BASES card, after its printed condition passed) and `grantGainWoundReward` in
 * gainWoundRewardGrant.ts (wwhk Mood Swings' "You may gain a Wound. If you do, Transform this into
 * Raging Savage", for a Wound gained and kept).
 *
 * // why: WP-885 / D-24836 — the grant leaf must not import heroEffects.execute.ts (that module
 * imports gainWoundReward.logic.ts, which imports the grant leaf), so the swap lives here and both
 * call it. The body, its log strings and its notable-event push moved verbatim; heroEffectTransform
 * delegates.
 *
 * No boardgame.io import. No randomness. Never throws.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
// why: WP-885 / D-24836 — zoneOps, economy, the log helpers and the notable-event composer are
// leaves that import nothing from hero/, so this module adds no import-cycle edge.
import { moveCardFromZone } from '../moves/zoneOps.js';
import { addResources } from '../economy/economy.logic.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';
import { composeTransformNarrative } from '../events/notableEvents.compose.js';

/**
 * Swaps the played base card for its second form (the body of the `transform` keyword handler).
 *
 * Placement (Jeff-confirmed permanent-upgrade rule): the second-form leaves the side
 * deck and enters play in the base card's slot; the base card goes BACK to the side
 * deck (set aside). The second-form then follows the normal played-card cleanup to the
 * discard pile, so it cycles through the player's deck henceforth — a permanent deck
 * upgrade, with no net card gained (the base leaves the deck as the second-form joins it).
 *
 * Soft no-op (AC-5): if the side deck holds no matching second-form copy (multi-player
 * contention exhausted it), or the base already left play, the transform does not happen —
 * logged, never a throw (moves never throw).
 *
 * @param G - Game state (mutated under Immer draft).
 * @param playerID - The player who played the base card (the active player).
 * @param cardId - The played base card's CardExtId (e.g. `wwhk/she-hulk/hurl-legal-objections#3`).
 */
export function applyHeroTransform(
  G: LegendaryGameState,
  playerID: string,
  cardId: CardExtId,
): void {
  const playerZones = G.playerZones[playerID];
  if (!playerZones) {
    return;
  }

  // why: guard against G states that predate WP-658 (older test mocks with no
  // transformTargets / transformDeck). A real match always seeds both at setup;
  // an absent map/side deck is a silent no-op, never a throw (mirrors the
  // executeHeroEffects heroAbilityHooks guard).
  if (!G.transformTargets || !G.transformDeck) {
    return;
  }

  // why: strip the `#copy` suffix so the played base instance ext_id
  // (`wwhk/she-hulk/hurl-legal-objections#3`) resolves to the copy-agnostic card
  // key (`wwhk/she-hulk/hurl-legal-objections`) buildTransformTargets stored.
  const hashIndex = cardId.indexOf('#');
  const baseKey = (hashIndex === -1 ? cardId : cardId.slice(0, hashIndex)) as CardExtId;
  const targetKey = G.transformTargets[baseKey];
  if (targetKey === undefined) {
    // why: defensive — only a SUPPORTED_TRANSFORM_BASES card (the transform keyword) or a
    // gain-wound-reward transform reward (WP-885 / D-24836, wwhk Mood Swings) reaches here, and
    // buildTransformTargets maps every wwhk base, so a missing key is unreachable in practice.
    // A silent no-op, never a throw.
    return;
  }

  // why: find the FIRST matching second-form copy still in the side deck. Instance
  // ids are `{targetKey}#{copy}`; the appended `#` stops a target key prefix-matching
  // a longer sibling slug. Front-of-zone, deterministic — no ctx.random.
  const targetPrefix = `${targetKey}#`;
  let targetInstanceId: CardExtId | undefined;
  for (const sideDeckId of G.transformDeck) {
    if (sideDeckId.startsWith(targetPrefix)) {
      targetInstanceId = sideDeckId;
      break;
    }
  }
  if (targetInstanceId === undefined) {
    // why: AC-5 — the side deck ran out of this second-form copy (multi-player
    // contention). The transform simply does not happen: log and continue. WP-434 —
    // nothing happened, so the outcome is `blocked`.
    pushLog(G,
      `Player ${playerID} could not Transform ${formatCardRef(G.cardDisplayData, cardId)} — no matching second-form copy remained in the transform side deck.`,
      'blocked',
      cardId, // why: WP-438 — the played base card whose transform could not resolve.
    );
    return;
  }

  // Route the base card back to the side deck (set aside): a permanent deck upgrade —
  // the player's deck loses the base as it gains the second-form, no net card change.
  const baseMove = moveCardFromZone(playerZones.inPlay, G.transformDeck, cardId);
  if (!baseMove.found) {
    // why: WP-859 / D-24795 — a deferred (wait-and-see) Transform can fire after its base card
    // left play (KO'd from play, say). Swapping then would put the second form into play while
    // the base stays wherever it went: a free card. Refuse before any zone is assigned, so the
    // side deck and inPlay are untouched. Covers Hurl Legal Objections and Gamma-Draining
    // Nanites too, which have had this window since WP-658 / WP-665.
    pushLog(G,
      `Player ${playerID} could not Transform ${formatCardRef(G.cardDisplayData, cardId)} — it is no longer in play.`,
      'blocked',
      cardId,
    );
    return;
  }
  playerZones.inPlay = baseMove.from;
  G.transformDeck = baseMove.to;

  // Bring the second-form into play in the base card's slot.
  const targetMove = moveCardFromZone(G.transformDeck, playerZones.inPlay, targetInstanceId);
  G.transformDeck = targetMove.from;
  playerZones.inPlay = targetMove.to;

  // why: apply the second-form's printed attack/recruit — the transform makes it the
  // card now in play, and printed icons are applied imperatively at play time
  // (applyCardPlay). The base's already-applied recruit is intentionally NOT refunded.
  const targetStats = G.cardStats[targetInstanceId];
  const targetAttack = targetStats ? targetStats.attack : 0;
  const targetRecruit = targetStats ? targetStats.recruit : 0;
  G.turnEconomy = addResources(G.turnEconomy, targetAttack, targetRecruit);

  // why: WP-434 — a completed transform that applied the second-form is `applied` (green).
  pushLog(G,
    `Player ${playerID} Transformed ${formatCardRef(G.cardDisplayData, cardId)} into ${formatCardRef(G.cardDisplayData, targetInstanceId)}${formatTransformEconomyClause(targetAttack, targetRecruit)}.`,
    'applied',
    targetInstanceId, // why: WP-438 — the second-form now in play is the play identity the log associates.
  );

  // why: WP-672 / D-24487 — emit the transformResolved notable event LAST (after the
  // swap settled and the applied log pushed), observing final state — the healWounds /
  // bystanderRevealed emission precedent. G.messages is not projected to clients, so this
  // event is what drives the arena-client "Transformed!" overlay + the transform VFX beat.
  // Names resolve HERE via G.cardDisplayData (the composer stays pure), with a defensive
  // raw-ext_id fallback when display data is absent (legacy test states may omit it).
  // Guarded push: the minimal heroEffects test builder omits G.notableEvents; a real match
  // always seeds it at setup ([] in buildInitialGameState). Handlers never throw, so an
  // absent array is a silent skip, mirroring the transformTargets / transformDeck guards.
  if (Array.isArray(G.notableEvents)) {
    const baseName = resolveTransformCardName(G, cardId);
    const secondFormName = resolveTransformCardName(G, targetInstanceId);
    G.notableEvents.push({
      type: 'transformResolved',
      playerId: playerID,
      narrative: composeTransformNarrative(baseName, secondFormName),
    });
  }
}

/**
 * Resolves a card's display name from `G.cardDisplayData` for the transform
 * narrative, falling back to the raw ext_id when no display entry exists (WP-672).
 * Mirrors the `villainDeck.reveal.ts` bystanderRevealed name-resolution so the
 * `composeTransformNarrative` composer keeps its no-`G` purity.
 *
 * @param G - Game state (read-only here).
 * @param cardId - The card ext_id to resolve to a display name.
 * @returns The card's display name, or the raw ext_id when display data is absent.
 */
export function resolveTransformCardName(G: LegendaryGameState, cardId: CardExtId): string {
  const display = G.cardDisplayData?.[cardId];
  if (display && typeof display.name === 'string' && display.name.length > 0) {
    return display.name;
  }
  return cardId;
}

/**
 * Builds the trailing " (+N attack, +M recruit)" clause for a transform log line,
 * omitting either half that is zero and the whole clause when the second-form has no
 * printed economy (WP-658 / D-24469). Mirrors the intent of formatBaseEconomyClause but
 * is local to keep heroEffects.execute.ts free of a moves-layer import (avoids a cycle).
 *
 * @param attack - The second-form's printed attack (>= 0).
 * @param recruit - The second-form's printed recruit (>= 0).
 * @returns The clause including a leading space, or an empty string when both are zero.
 */
export function formatTransformEconomyClause(attack: number, recruit: number): string {
  const parts: string[] = [];
  if (attack > 0) {
    parts.push(`+${attack} attack`);
  }
  if (recruit > 0) {
    parts.push(`+${recruit} recruit`);
  }
  if (parts.length === 0) {
    return '';
  }
  return ` (${parts.join(', ')})`;
}
