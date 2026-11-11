/**
 * The grant half of "You may gain a Wound. If you do, you get +N[icon:attack]" (WP-883 / D-24834).
 *
 * One function, `grantGainWoundReward`, called at every place a voluntarily gained Wound is
 * finally KEPT: the 'gain-wound-reward' apply when nothing can prevent the Wound, a declined
 * Diving Block, a Flying Shield Block entry no candidate revealed for, and a Flying Shield Block
 * entry dropped because no copy is left to reveal.
 *
 * // why: WP-883 / D-24834 — a leaf module. divingBlock.logic.ts and flyingShieldBlock.logic.ts
 * import it, so it imports nothing that reaches them (only the economy helper, the log helpers
 * and types). That keeps the two interception modules free of any new import-cycle edge.
 *
 * No boardgame.io import. No randomness. Never throws.
 */

import type { GainWoundReward, LegendaryGameState } from '../types.js';
import { addResources } from '../economy/economy.logic.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';

/**
 * Grants the reward a kept Wound earns, and logs it.
 *
 * // why: WP-883 / D-24834 — the recipient is always the player who played the card, which is
 * the active player (the choice is active-scoped and the board is frozen until every
 * interception wave resolves), so G.turnEconomy is theirs.
 *
 * @param G - Game state (mutated: G.turnEconomy and the log).
 * @param recipientID - The player who kept the Wound (the active player).
 * @param reward - The held reward.
 * @param isAfterInterception - true when the Wound was kept after a Diving Block or Flying
 *   Shield Block was offered (log L7); false when nothing could prevent it (log L4).
 */
export function grantGainWoundReward(
  G: LegendaryGameState,
  recipientID: string,
  reward: GainWoundReward,
  isAfterInterception: boolean,
): void {
  const cardRef = formatCardRef(G.cardDisplayData, reward.sourceCardId);
  switch (reward.rewardType) {
    case 'attack': {
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
  }
}

/**
 * Logs that a voluntarily gained Wound was prevented, so its reward is forfeited (log L8).
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
  pushLog(G,
    `Player ${recipientID}'s Wound was prevented, so no +${reward.magnitude} Attack (${formatCardRef(G.cardDisplayData, reward.sourceCardId)}).`,
    'blocked',
    reward.sourceCardId,
  );
}
