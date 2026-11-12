/**
 * The grant half of "You may gain a Wound. If you do, <reward>" (WP-883 / D-24834, WP-885 /
 * D-24836).
 *
 * One function, `grantGainWoundReward`, called at every place a voluntarily gained Wound is
 * finally KEPT: the 'gain-wound-reward' apply when nothing can prevent the Wound, a declined
 * Diving Block, a Flying Shield Block entry no candidate revealed for, and a Flying Shield Block
 * entry dropped because no copy is left to reveal.
 *
 * Four rewards: +N Attack (co2e Hulk Smash!, mdns Scalded by Sunlight), Berserk N times (wpnx
 * Violent Conditioning), KO up to N other cards from hand / discard (msis Hulk Gets Smashed) and
 * Transform (wwhk Mood Swings). The phrasing helper here names a non-Attack reward for the prompt
 * labels and the log, so Diving Block and Flying Shield Block keep their single import of this
 * module.
 *
 * // why: WP-883 / D-24834 — a leaf module. divingBlock.logic.ts and flyingShieldBlock.logic.ts
 * import it, so it imports nothing that reaches them, seatChoice.resolve.ts or
 * heroEffects.execute.ts. That keeps the two interception modules free of any new import-cycle
 * edge.
 *
 * No boardgame.io import. No randomness. Never throws.
 */

import type { GainWoundReward, LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import { addResources } from '../economy/economy.logic.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';
// why: WP-885 / D-24836 — the primitive interpreter imports only zoneOps, economy, the log helpers
// and splitCard.logic (→ setup/pilesInit), none of which reaches back to this module.
import { interpretHeroPrimitiveEffect } from './effectPrimitive.interpret.js';
// why: WP-885 / D-24836 — a data-only module (one type import), so no cycle edge.
import { HERO_COMPOSITION_MARKERS } from '../rules/heroCompositions.js';
// why: WP-885 / D-24836 — the Transform swap leaf imports only zoneOps, economy, the log helpers
// and the notable-event composer, never this module.
import { applyHeroTransform, resolveTransformCardName } from './heroTransform.logic.js';
// why: WP-885 / D-24836 — setup/pilesInit imports only setup/shuffle, so the Wound id adds no cycle.
import { WOUND_EXT_ID } from '../setup/pilesInit.js';

/** A non-Attack reward named for a prompt option (second person) and a log line (third person). */
export interface GainWoundRewardPhrases {
  /** e.g. "KO up to 2 other cards from your hand or discard pile". */
  labelPhrase: string;
  /** e.g. "KO up to 2 other cards from their hand or discard pile". */
  logPhrase: string;
}

/**
 * Names a reward for the prompt labels and the log.
 *
 * // why: WP-885 / D-24836 — the Attack reward keeps its WP-883 wording at every call site, which
 * branches on `'attack'` before calling this; the attack arm here exists only so the switch is
 * total.
 *
 * @param reward - The reward a kept Wound earns.
 * @param G - Game state (read only), used only to name a Transform's second form. Without it a
 *   Transform reward is named "its second form".
 * @returns The label and log phrases.
 */
export function describeGainWoundRewardPhrases(
  reward: GainWoundReward,
  G?: LegendaryGameState,
): GainWoundRewardPhrases {
  switch (reward.rewardType) {
    case 'attack': {
      return { labelPhrase: `you get +${reward.magnitude} Attack`, logPhrase: `get +${reward.magnitude} Attack` };
    }
    case 'berserk': {
      let berserkPhrase = `Berserk ${reward.magnitude} times`;
      if (reward.magnitude === 2) {
        berserkPhrase = 'Berserk twice';
      }
      return { labelPhrase: berserkPhrase, logPhrase: berserkPhrase };
    }
    case 'optional-ko-hand-discard': {
      return {
        labelPhrase: `KO up to ${reward.magnitude} other cards from your hand or discard pile`,
        logPhrase: `KO up to ${reward.magnitude} other cards from their hand or discard pile`,
      };
    }
    case 'transform': {
      const transformPhrase = `Transform into ${describeTransformSecondForm(reward.sourceCardId, G)}`;
      return { labelPhrase: transformPhrase, logPhrase: transformPhrase };
    }
  }
}

/**
 * The display name of the first second-form copy still in the transform side deck.
 *
 * @param sourceCardId - The played base card.
 * @param G - Game state (read only), or undefined.
 * @returns The second form's display name, or "its second form" when none can be named.
 */
function describeTransformSecondForm(sourceCardId: CardExtId, G: LegendaryGameState | undefined): string {
  if (G === undefined || !G.transformTargets || !G.transformDeck) {
    return 'its second form';
  }
  const hashIndex = sourceCardId.indexOf('#');
  let baseKey = sourceCardId;
  if (hashIndex !== -1) {
    baseKey = sourceCardId.slice(0, hashIndex);
  }
  const targetKey = G.transformTargets[baseKey];
  if (targetKey === undefined) {
    return 'its second form';
  }
  const targetPrefix = `${targetKey}#`;
  for (const sideDeckId of G.transformDeck) {
    if (sideDeckId.startsWith(targetPrefix)) {
      return resolveTransformCardName(G, sideDeckId);
    }
  }
  return 'its second form';
}

/**
 * Grants the reward a kept Wound earns, and logs it.
 *
 * // why: WP-883 / D-24834 — the recipient is always the player who played the card, which is
 * the active player (the choice is active-scoped and the board is frozen until every
 * interception wave resolves), so G.turnEconomy is theirs.
 *
 * @param G - Game state (mutated: G.turnEconomy, zones, the optional-KO queue and the log).
 * @param recipientID - The player who kept the Wound (the active player).
 * @param reward - The held reward.
 * @param isAfterInterception - true when the Wound was kept after a Diving Block or Flying
 *   Shield Block was offered (log L7 / N7); false when nothing could prevent it (log L4 / N4).
 */
export function grantGainWoundReward(
  G: LegendaryGameState,
  recipientID: string,
  reward: GainWoundReward,
  isAfterInterception: boolean,
): void {
  const cardRef = formatCardRef(G.cardDisplayData, reward.sourceCardId);
  if (reward.rewardType === 'attack') {
    G.turnEconomy = addResources(G.turnEconomy, reward.magnitude, 0);
    if (isAfterInterception) {
      pushLog(G,
        `Player ${recipientID} kept the Wound and got +${reward.magnitude} Attack (${cardRef}).`,
        'applied',
        reward.sourceCardId,
      );
    } else {
      pushLog(G,
        `Player ${recipientID} gained a Wound and got +${reward.magnitude} Attack (${cardRef}).`,
        'applied',
        reward.sourceCardId,
      );
    }
    return;
  }
  // why: WP-885 / D-24836 — a non-Attack reward logs the kept Wound first (N7 / N4); the reward
  // then runs and logs its own lines (Berserk's grant, the KO prompts, the Transform).
  if (isAfterInterception) {
    pushLog(G, `Player ${recipientID} kept the Wound (${cardRef}).`, 'applied', reward.sourceCardId);
  } else {
    pushLog(G, `Player ${recipientID} gained a Wound (${cardRef}).`, 'applied', reward.sourceCardId);
  }
  switch (reward.rewardType) {
    case 'berserk': {
      grantBerserkReward(G, recipientID, reward);
      return;
    }
    case 'optional-ko-hand-discard': {
      grantOptionalKoReward(G, recipientID, reward, cardRef);
      return;
    }
    case 'transform': {
      applyHeroTransform(G, recipientID, reward.sourceCardId);
      return;
    }
  }
}

/**
 * Runs the Berserk composition `magnitude` times for the recipient.
 *
 * @param G - Game state (mutated: the deck, the discard pile, G.turnEconomy and the log).
 * @param recipientID - The player who kept the Wound.
 * @param reward - The 'berserk' reward.
 */
function grantBerserkReward(G: LegendaryGameState, recipientID: string, reward: GainWoundReward): void {
  const berserkComposition = HERO_COMPOSITION_MARKERS.berserk;
  // why: defensive — the Berserk row is seeded data; a missing row grants nothing, never a throw.
  if (berserkComposition === undefined) {
    return;
  }
  // why: WP-885 / D-24836 — each Berserk is its own run with a fresh interpreter context and a
  // fresh copy of the AST (D-13502: never alias the shared registry row). Berserk reads no ctx,
  // so undefined is passed; an empty deck makes a run a no-op (no reshuffle).
  for (let i = 0; i < reward.magnitude; i++) {
    interpretHeroPrimitiveEffect(G, undefined, recipientID, structuredClone(berserkComposition), reward.sourceCardId);
  }
}

/**
 * Parks up to `magnitude` optional KOs from the recipient's hand ∪ discard, never of the Wound
 * just gained.
 *
 * @param G - Game state (mutated: G.pendingOptionalKoRewards or the log).
 * @param recipientID - The player who kept the Wound.
 * @param reward - The 'optional-ko-hand-discard' reward.
 * @param cardRef - The source card's log reference.
 */
function grantOptionalKoReward(
  G: LegendaryGameState,
  recipientID: string,
  reward: GainWoundReward,
  cardRef: string,
): void {
  const playerZones = G.playerZones[recipientID];
  if (!playerZones) {
    return;
  }
  const eligibleCount = countSpareRuleEligibleKoTargets(playerZones.hand, playerZones.discard);
  if (eligibleCount === 0) {
    pushLog(G,
      `Player ${recipientID} had no other card in their hand or discard pile to KO (${cardRef}).`,
      'blocked',
      reward.sourceCardId,
    );
    return;
  }
  // why: WP-885 / D-24836 — park min(magnitude, eligible) entries. KOs only remove cards and the
  // board is frozen until the queue drains, so every parked entry still has a legal target when it
  // reaches the front: the bot never faces an entry with nothing it may KO (no sim hang).
  let entryCount = reward.magnitude;
  if (eligibleCount < entryCount) {
    entryCount = eligibleCount;
  }
  if (!G.pendingOptionalKoRewards) { G.pendingOptionalKoRewards = []; }
  for (let i = 0; i < entryCount; i++) {
    // why: a fresh koZones literal per entry (the heroEffectOptionalKoHandDiscard precedent), so
    // no two entries share one array.
    G.pendingOptionalKoRewards.push({
      playerID: recipientID,
      rewardType: 'none',
      rewardMagnitude: 0,
      sourceCardId: reward.sourceCardId,
      koZones: ['hand', 'discard'],
      koSparesGainedWound: true,
    });
  }
}

/**
 * Counts the Wounds in a hand and discard pile.
 *
 * // why: WP-885 / D-24836 — the spare-a-Wound rule's single count. "KO up to two OTHER cards"
 * never takes the Wound just gained; Wounds are one fungible id, so a Wound is an eligible KO
 * target only while hand ∪ discard hold at least two. The resolve, the projection and the bot
 * each call this on current G.
 *
 * @param hand - The chooser's hand.
 * @param discard - The chooser's discard pile.
 * @returns How many Wounds the two zones hold.
 */
export function countWoundsInHandAndDiscard(
  hand: readonly CardExtId[],
  discard: readonly CardExtId[],
): number {
  let woundCount = 0;
  for (const cardId of hand) {
    if (cardId === WOUND_EXT_ID) {
      woundCount += 1;
    }
  }
  for (const cardId of discard) {
    if (cardId === WOUND_EXT_ID) {
      woundCount += 1;
    }
  }
  return woundCount;
}

/**
 * Whether a card is a KO target the spare-a-Wound rule forbids right now.
 *
 * @param cardId - The candidate target.
 * @param hand - The chooser's hand (current G).
 * @param discard - The chooser's discard pile (current G).
 * @returns true when the card is a Wound and hand ∪ discard hold fewer than two Wounds.
 */
export function isWoundSparedFromKo(
  cardId: CardExtId,
  hand: readonly CardExtId[],
  discard: readonly CardExtId[],
): boolean {
  if (cardId !== WOUND_EXT_ID) {
    return false;
  }
  return countWoundsInHandAndDiscard(hand, discard) < 2;
}

/**
 * How many KO targets the spare-a-Wound rule allows in a hand and discard pile.
 *
 * @param hand - The chooser's hand.
 * @param discard - The chooser's discard pile.
 * @returns Non-Wounds plus max(0, Wounds − 1).
 */
function countSpareRuleEligibleKoTargets(hand: readonly CardExtId[], discard: readonly CardExtId[]): number {
  const woundCount = countWoundsInHandAndDiscard(hand, discard);
  const nonWoundCount = hand.length + discard.length - woundCount;
  let spareableWoundCount = woundCount - 1;
  if (spareableWoundCount < 0) {
    spareableWoundCount = 0;
  }
  return nonWoundCount + spareableWoundCount;
}

/**
 * Logs that a voluntarily gained Wound was prevented, so its reward is forfeited (log L8 / N8).
 *
 * // why: WP-883 / D-24834 — Diving Block and Flying Shield Block both print "… instead": a
 * revealed Wound was never gained, so "If you do" fails and no reward is granted.
 *
 * @param G - Game state (mutated: the log).
 * @param recipientID - The player whose Wound was prevented.
 * @param reward - The forfeited reward.
 */
export function logGainWoundRewardForfeited(
  G: LegendaryGameState,
  recipientID: string,
  reward: GainWoundReward,
): void {
  const cardRef = formatCardRef(G.cardDisplayData, reward.sourceCardId);
  if (reward.rewardType === 'attack') {
    pushLog(G,
      `Player ${recipientID}'s Wound was prevented, so no +${reward.magnitude} Attack (${cardRef}).`,
      'blocked',
      reward.sourceCardId,
    );
    return;
  }
  pushLog(G,
    `Player ${recipientID}'s Wound was prevented, so they do not ${describeGainWoundRewardPhrases(reward, G).logPhrase} (${cardRef}).`,
    'blocked',
    reward.sourceCardId,
  );
}
