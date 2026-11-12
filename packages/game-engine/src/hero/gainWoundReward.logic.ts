/**
 * "You may gain a Wound. If you do, <reward>" — the choice half of the `gain-wound-reward` hero
 * keyword (WP-883 / D-24834; the non-Attack rewards, WP-885 / D-24836).
 *
 * Two hero lines print it: co2e Hulk Smash! (`[hc:strength]`, +5) and mdns Scalded by Sunlight's
 * Sunlight line (+2). The handler in heroEffects.execute.ts parks the choice this module builds;
 * resolveSeatChoice dispatches the answer to `applyGainWoundRewardSeatChoice`.
 *
 * The gain goes through the Wound chokepoint (`gainWoundWithOutcome`), so Diving Block and
 * Flying Shield Block are offered exactly as for any other Wound. The +N is granted only for a
 * Wound gained AND kept: when an interception is pending, the reward is held on that entry
 * (`gainWoundReward`) and granted or forfeited when it resolves (divingBlock.logic.ts,
 * flyingShieldBlock.logic.ts).
 *
 * No boardgame.io import and no heroEffects.execute.ts import (the hero/heistPayloads.logic.ts
 * posture). Every module constant is a literal; imported bindings are used only inside function
 * bodies. Never throws.
 */

import type { GainWoundReward, LegendaryGameState, PendingSeatChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroKeyword } from '../rules/heroKeywords.js';
// why: WP-883 / D-24834 — a runtime-safe import cycle (the D-24760 / WP-845 shape):
// seatChoice.resolve imports this module (dispatch), this module imports wounds.logic, which
// imports divingBlock.logic, which imports seatChoice.resolve. Every binding below is read only
// inside a function body, never at module top level.
import { gainWoundWithOutcome } from '../board/wounds.logic.js';
// why: the leaf grant module imports nothing that reaches back here (no cycle edge).
import { describeGainWoundRewardPhrases, grantGainWoundReward } from './gainWoundRewardGrant.js';
import { pushLog } from '../log/logPush.js';
import { formatCardRef } from '../log/logDisplay.js';

/** The seat-choice kind discriminant for the gain / don't prompt. */
export const GAIN_WOUND_REWARD_SEAT_CHOICE_KIND = 'gain-wound-reward';

/** Option 0: gain the Wound for the reward. */
export const GAIN_WOUND_REWARD_GAIN_OPTION_INDEX = 0;

/** Option 1: don't gain a Wound (the default for an absent seat, autoplay, sim and PAR). */
export const GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX = 1;

// why: WP-883 / D-24834, WP-885 / D-24836 — the seeded HeroKeyword reward vocabulary: +N Attack,
// the optional KO of up to N other cards from hand / discard, and Transform. Mirrors the same
// constant in setup/heroAbility.setup.ts (two copies, per duplicate-first).
export const GAIN_WOUND_REWARD_SEEDED_REWARDS: ReadonlySet<HeroKeyword> = new Set<HeroKeyword>([
  'attack',
  'optional-ko-hand-discard',
  'transform',
]);

// why: WP-885 / D-24836 — the seeded composition-marker rewards (descriptor rewardComposition).
// Berserk is a HERO_COMPOSITION_MARKERS row, not a HeroKeyword (D-24031). Mirrors the same
// constant in setup/heroAbility.setup.ts (two copies, per duplicate-first).
export const GAIN_WOUND_REWARD_SEEDED_COMPOSITIONS: ReadonlySet<string> = new Set<string>([
  'berserk',
]);

/**
 * Builds the active-player gain / don't prompt.
 *
 * @param playerID - The player who played the card (the only addressed seat).
 * @param reward - The reward a kept Wound earns.
 * @param G - Game state (read only), used only to name a Transform reward's second form. Optional
 *   and trailing (WP-885 / D-24836) so the WP-883 two-argument callers stay valid; without it a
 *   Transform reward is labelled "its second form".
 * @returns The seat choice to park.
 */
export function buildGainWoundRewardChoice(
  playerID: string,
  reward: GainWoundReward,
  G?: LegendaryGameState,
): PendingSeatChoice {
  let gainLabel = `Gain a Wound: you get +${reward.magnitude} Attack`;
  if (reward.rewardType !== 'attack') {
    gainLabel = `Gain a Wound: ${describeGainWoundRewardPhrases(reward, G).labelPhrase}`;
  }
  return {
    kind: GAIN_WOUND_REWARD_SEAT_CHOICE_KIND,
    addressedSeats: [playerID],
    seatPrompts: {
      [playerID]: {
        options: [
          { label: gainLabel },
          { label: "Don't gain a Wound" },
        ],
      },
    },
    submissions: {},
    // why: an absent seat, autoplay, the sim runner and PAR all decline (D-24745): gaining a
    // Wound is a deck cost a seat opts into, never a default.
    defaultOptionIndex: GAIN_WOUND_REWARD_DECLINE_OPTION_INDEX,
    gainWoundReward: reward,
  };
}

/**
 * Applies a resolved 'gain-wound-reward' choice.
 *
 * Decline → log L3. Gain → one Wound through the chokepoint, then:
 * - `'no-wound'` (the supply emptied after the park) → log L6, no reward;
 * - a Diving Block entry parked → the reward is held on it (L5);
 * - a Flying Shield Block entry parked → the reward is held on it (L5);
 * - otherwise nothing can prevent the Wound → grant now (L4). That includes a Flying Shield Block
 *   holder whose only copy was already revealed this turn (nothing parks).
 *
 * @param G - Game state (mutated).
 * @param choice - The fully-submitted 'gain-wound-reward' choice.
 */
export function applyGainWoundRewardSeatChoice(
  G: LegendaryGameState,
  choice: PendingSeatChoice,
): void {
  const seat = choice.addressedSeats[0];
  const reward = choice.gainWoundReward;
  if (seat === undefined || reward === undefined) {
    return;
  }
  const cardRef = formatCardRef(G.cardDisplayData, reward.sourceCardId);
  const submission = choice.submissions[seat];
  if (submission === undefined || submission.optionIndex !== GAIN_WOUND_REWARD_GAIN_OPTION_INDEX) {
    pushLog(G, `Player ${seat} chose not to gain a Wound (${cardRef}).`, 'neutral', reward.sourceCardId);
    return;
  }
  // why: D-24760 — gainWoundWithOutcome reports 'gained' even when the chokepoint parked a
  // Flying Shield Block entry, so the queue length before and after is the only signal.
  const flyingShieldBlockQueueBefore = G.pendingFlyingShieldBlockWounds?.length ?? 0;
  const outcome = gainWoundWithOutcome(G, seat);
  if (outcome === 'no-wound') {
    logGainWoundRewardSupplyEmpty(G, seat, reward, cardRef);
    return;
  }
  // why: WP-865 / D-24808 — woundsDrawn bumps when a Wound lands for the playing seat.
  G.turnEconomy.woundsDrawn += 1;
  if (holdRewardOnPendingInterception(G, seat, reward, outcome, flyingShieldBlockQueueBefore)) {
    logGainWoundRewardHeld(G, seat, reward, cardRef);
    return;
  }
  grantGainWoundReward(G, seat, reward, false);
}

/**
 * Logs that the Wound supply emptied before the gain, so the reward is not granted (L6 / N6).
 *
 * @param G - Game state (mutated: the log).
 * @param seat - The player who chose to gain.
 * @param reward - The reward that is not granted.
 * @param cardRef - The source card's log reference.
 */
function logGainWoundRewardSupplyEmpty(
  G: LegendaryGameState,
  seat: string,
  reward: GainWoundReward,
  cardRef: string,
): void {
  if (reward.rewardType === 'attack') {
    pushLog(G,
      `Player ${seat} could not gain a Wound — the Wound supply is empty, so no Attack (${cardRef}).`,
      'blocked',
      reward.sourceCardId,
    );
    return;
  }
  pushLog(G,
    `Player ${seat} could not gain a Wound — the Wound supply is empty, so they do not ${describeGainWoundRewardPhrases(reward, G).logPhrase} (${cardRef}).`,
    'blocked',
    reward.sourceCardId,
  );
}

/**
 * Logs that the reward waits on a pending Diving Block or Flying Shield Block (L5 / N5).
 *
 * @param G - Game state (mutated: the log).
 * @param seat - The player who gained the Wound.
 * @param reward - The held reward.
 * @param cardRef - The source card's log reference.
 */
function logGainWoundRewardHeld(
  G: LegendaryGameState,
  seat: string,
  reward: GainWoundReward,
  cardRef: string,
): void {
  if (reward.rewardType === 'attack') {
    pushLog(G,
      `Player ${seat} would gain a Wound — +${reward.magnitude} Attack if they keep it (${cardRef}).`,
      'neutral',
      reward.sourceCardId,
    );
    return;
  }
  pushLog(G,
    `Player ${seat} would gain a Wound — they ${describeGainWoundRewardPhrases(reward, G).logPhrase} if they keep it (${cardRef}).`,
    'neutral',
    reward.sourceCardId,
  );
}

/**
 * Holds the reward on the interception the Wound just parked, if any.
 *
 * // why: D-24673 — the Wound lands first and the reveal resolves in a later wave; Diving Block
 * and Flying Shield Block both print "… instead", so a revealed Wound was never gained. The
 * reward waits on the entry and is granted only when the Wound is kept.
 *
 * @param G - Game state (mutated: one entry tagged).
 * @param seat - The player who gained the Wound.
 * @param reward - The reward to hold.
 * @param outcome - What gainWoundWithOutcome reported.
 * @param flyingShieldBlockQueueBefore - The Flying Shield Block queue length before the gain.
 * @returns true when an entry now holds the reward.
 */
function holdRewardOnPendingInterception(
  G: LegendaryGameState,
  seat: string,
  reward: GainWoundReward,
  outcome: 'gained' | 'diving-block-pending',
  flyingShieldBlockQueueBefore: number,
): boolean {
  if (outcome === 'diving-block-pending') {
    const divingBlockQueue = G.pendingDivingBlockWounds ?? [];
    for (let index = divingBlockQueue.length - 1; index >= 0; index--) {
      const entry = divingBlockQueue[index]!;
      if (entry.playerID === seat) {
        entry.gainWoundReward = reward;
        return true;
      }
    }
    return false;
  }
  const flyingShieldBlockQueue = G.pendingFlyingShieldBlockWounds ?? [];
  if (flyingShieldBlockQueue.length > flyingShieldBlockQueueBefore) {
    flyingShieldBlockQueue[flyingShieldBlockQueue.length - 1]!.gainWoundReward = reward;
    return true;
  }
  return false;
}

/**
 * Builds the held reward for a parsed descriptor, or undefined for an unseeded reward.
 *
 * // why: WP-885 / D-24836 — the narrowing is checked, never cast: the keyword path needs
 * seeded-set membership AND a switch case; the composition path needs seeded-set membership AND
 * `=== 'berserk'`. rewardType wins when both are present (the parser never emits both).
 *
 * @param rewardType - The descriptor's rewardType.
 * @param rewardComposition - The descriptor's rewardComposition.
 * @param magnitude - The descriptor's magnitude (>= 1; failsMagnitudePreGate drops the rest).
 * @param sourceCardId - The played card.
 * @returns The reward, or undefined when the reward is not seeded.
 */
export function buildGainWoundReward(
  rewardType: HeroKeyword | undefined,
  rewardComposition: string | undefined,
  magnitude: number,
  sourceCardId: CardExtId,
): GainWoundReward | undefined {
  if (rewardType !== undefined) {
    if (!GAIN_WOUND_REWARD_SEEDED_REWARDS.has(rewardType)) {
      return undefined;
    }
    switch (rewardType) {
      case 'attack':
      case 'optional-ko-hand-discard':
      case 'transform':
        return { rewardType, magnitude, sourceCardId };
      default:
        return undefined;
    }
  }
  if (rewardComposition === undefined || !GAIN_WOUND_REWARD_SEEDED_COMPOSITIONS.has(rewardComposition)) {
    return undefined;
  }
  if (rewardComposition === 'berserk') {
    return { rewardType: 'berserk', magnitude, sourceCardId };
  }
  return undefined;
}
