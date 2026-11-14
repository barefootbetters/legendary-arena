/**
 * Stack cards that enter the City as Villains (WP-869 / D-24814).
 *
 * Groot from Planet X's Fight sends two Bystanders from the Bystander Stack into the City as
 * 3-Attack "Splintered Half-Groot" Villains; Agent Gabe Jones's Fight and Agent Eric Marshall's
 * Ambush each send one S.H.I.E.L.D. Officer from the Officer Stack. The stacks hold identical
 * token ids, so each converted card needs its own unique id. This module owns those ids, their
 * display entries, the fixed Attack and the marker name pattern. No boardgame.io import; every
 * export is pure except `applyStackVillainDisplay`, which fills the setup-local display data
 * before `G` exists.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { LegendaryGameState } from '../types.js';
import type { UICardDisplay } from '../ui/uiState.types.js';
import type { VillainAbilityHook } from './villainAbility.types.js';
import { BYSTANDER_EXT_ID, SHIELD_OFFICER_EXT_ID } from '../setup/pilesInit.js';

// why: every marked line prints "3 Attack" (Groot from Planet X, Agent Gabe Jones, Agent Eric
// Marshall). A future line printing another Attack adds a parameter to the primitive instead;
// a test asserts every marked line's text contains `3[icon:attack]`.
/** The Attack of every converted stack card. */
export const STACK_VILLAIN_ATTACK = 3;

// why: the marker name token is lowercase words joined by `_` (a word break) or `-` (a hyphen
// kept in the name). The marker script (`scripts/convert-cards/apply-effect-markers.mjs`)
// carries the same pattern source; a test asserts the two copies cannot drift.
/** The name token a `stack-cards-enter-city-as-villains` marker may carry. */
export const STACK_VILLAIN_NAME_PATTERN = /^[a-z0-9]+([_-][a-z0-9]+)*$/;

/**
 * Turns a marker name token into the display name the converted cards carry.
 *
 * // why: the name comes from the marker token alone, so a new card needs no per-card name map
 * in the engine: `_` separates words, `-` stays a hyphen, and every word and hyphen segment is
 * capitalized (`splintered_half-groot` → "Splintered Half-Groot").
 *
 * @param nameToken - A token matching STACK_VILLAIN_NAME_PATTERN.
 * @returns The display name.
 */
export function stackVillainDisplayName(nameToken: string): string {
  const displayWords: string[] = [];
  for (const word of nameToken.split('_')) {
    const segments: string[] = [];
    for (const segment of word.split('-')) {
      segments.push(segment.charAt(0).toUpperCase() + segment.slice(1));
    }
    displayWords.push(segments.join('-'));
  }
  return displayWords.join(' ');
}

/**
 * The unique id of one converted stack card owned by a marked villain instance.
 *
 * // why: a token id cannot carry an overlay entry (every copy would convert), so each marked
 * villain instance owns exactly `count` ids of its own, indexed 00..count-1. A villain instance
 * carries at most one stack-villain descriptor, so the source id alone is unique.
 *
 * @param sourceCardId - The marked villain instance's ext_id.
 * @param index - The id's index, 0..count-1.
 * @returns `stack-villain-<sourceCardId>-<NN>`.
 */
export function stackVillainExtId(sourceCardId: CardExtId, index: number): CardExtId {
  return `stack-villain-${sourceCardId}-${String(index).padStart(2, '0')}`;
}

/**
 * Lists the ids a marked villain instance can convert next, in index order.
 *
 * // why: an id is free while it has no overlay entry. A converted card keeps its entry in the
 * City and in the Escape Pile (escaping does not free it); defeating it deletes the entry and
 * frees the id. So one copy of a card has at most `count` converted cards out at once.
 *
 * @param gameState - Game state (read-only).
 * @param sourceCardId - The marked villain instance's ext_id.
 * @param count - How many ids the instance owns (the descriptor's magnitude).
 * @returns The free ids, lowest index first.
 */
export function listFreeStackVillainIds(
  gameState: LegendaryGameState,
  sourceCardId: CardExtId,
  count: number,
): CardExtId[] {
  const origins = gameState.convertedVillainOrigins ?? {};
  const freeIds: CardExtId[] = [];
  for (let index = 0; index < count; index++) {
    const cardId = stackVillainExtId(sourceCardId, index);
    if (origins[cardId] === undefined) {
      freeIds.push(cardId);
    }
  }
  return freeIds;
}

/**
 * Seeds a display entry for every id a marked villain instance owns.
 *
 * // why: G.cardDisplayData is built at setup and read-only at runtime, so a converted card's
 * entry must exist before it ever enters the City. Each id gets a fresh copy of its stack
 * token's entry with its own extId, renamed from the marker name token when the line has one.
 * A match with no marked card gains no entry, so its G and every hash are unchanged. A missing
 * token entry skips (the card would fall back to the raw-id placeholder, never crash).
 *
 * @param cardDisplayData - The freshly built display data; mutated in place.
 * @param villainAbilityHooks - The match's villain ability hooks (the same value G receives).
 */
export function applyStackVillainDisplay(
  cardDisplayData: Record<CardExtId, UICardDisplay>,
  villainAbilityHooks: readonly VillainAbilityHook[],
): void {
  for (const hook of villainAbilityHooks) {
    if (hook.timing !== 'onFight' && hook.timing !== 'onAmbush') {
      continue;
    }
    for (const descriptor of hook.effects) {
      if (descriptor.primitive !== 'stack-cards-enter-city-as-villains') {
        continue;
      }
      let tokenId: CardExtId = BYSTANDER_EXT_ID;
      if (descriptor.stackVillainKind === 'officer') {
        tokenId = SHIELD_OFFICER_EXT_ID;
      }
      const tokenEntry = cardDisplayData[tokenId];
      if (tokenEntry === undefined) {
        continue;
      }
      const count = descriptor.magnitude ?? 1;
      for (let index = 0; index < count; index++) {
        const cardId = stackVillainExtId(hook.cardId, index);
        const entry: UICardDisplay = { ...tokenEntry, extId: cardId };
        if (descriptor.stackVillainName !== undefined) {
          entry.name = stackVillainDisplayName(descriptor.stackVillainName);
        }
        cardDisplayData[cardId] = entry;
      }
    }
  }
}
