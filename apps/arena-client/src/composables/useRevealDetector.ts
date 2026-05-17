/**
 * Composable that detects villain deck card reveals by diffing consecutive
 * UIState snapshots. When a card is revealed (villainDeckCount decreases),
 * it identifies the destination and emits a RevealEvent for the UI to
 * animate.
 *
 * Pure diff logic — no DOM, no timers, no side effects beyond returning
 * the detected event.
 */

import { ref, watch, type Ref } from 'vue';
import type { UIState, UICardDisplay } from '@legendary-arena/game-engine';

export type RevealDestination = 'city' | 'scheme-twist' | 'mastermind-strike' | 'bystander';

export interface RevealEvent {
  /** Display name of the revealed card (or fallback). */
  cardName: string;
  /** Where the card was routed after reveal. */
  destination: RevealDestination;
  /** Timestamp for keying/deduplication. */
  timestamp: number;
  /** Display data for the card to show in the overlay (image + abilities). */
  display: UICardDisplay | null;
}

/**
 * Watches a UIState snapshot ref and emits RevealEvents when the villain
 * deck count decreases between frames.
 */
export function useRevealDetector(snapshot: Ref<UIState | null>) {
  const currentReveal = ref<RevealEvent | null>(null);
  let previousSnapshot: UIState | null = null;

  watch(snapshot, (next) => {
    if (next === null || previousSnapshot === null) {
      previousSnapshot = next;
      return;
    }

    const prevDeckCount = previousSnapshot.decks.villainDeckCount;
    const nextDeckCount = next.decks.villainDeckCount;

    if (nextDeckCount < prevDeckCount) {
      const event = identifyReveal(previousSnapshot, next);
      if (event !== null) {
        currentReveal.value = event;
      }
    }

    previousSnapshot = next;
  }, { deep: false });

  function dismiss(): void {
    currentReveal.value = null;
  }

  return { currentReveal, dismiss };
}

/**
 * Identifies what was revealed by comparing two snapshots.
 */
function identifyReveal(previous: UIState, next: UIState): RevealEvent | null {
  const timestamp = Date.now();

  // Check if a new villain appeared in the city
  const newCityCard = findNewCityCard(previous, next);
  if (newCityCard !== null) {
    return {
      cardName: newCityCard.name,
      destination: 'city',
      timestamp,
      display: newCityCard.display,
    };
  }

  // Check if a new scheme twist appeared — show the scheme card's text
  if (next.scheme.twistPile.length > previous.scheme.twistPile.length) {
    return {
      cardName: next.scheme.display.name || 'Scheme Twist',
      destination: 'scheme-twist',
      timestamp,
      display: next.scheme.display,
    };
  }

  // Check if a new mastermind strike appeared — show the mastermind card's text
  if (next.mastermind.strikePile.length > previous.mastermind.strikePile.length) {
    return {
      cardName: next.mastermind.display.name || 'Master Strike',
      destination: 'mastermind-strike',
      timestamp,
      display: next.mastermind.display,
    };
  }

  // Check log for bystander reveal message
  if (next.log.length > previous.log.length) {
    for (let logIndex = previous.log.length; logIndex < next.log.length; logIndex++) {
      const message = next.log[logIndex] ?? '';
      if (message.toLowerCase().includes('bystander')) {
        return { cardName: 'Bystander', destination: 'bystander', timestamp, display: null };
      }
    }
  }

  return null;
}

interface CityCardResult {
  name: string;
  display: UICardDisplay;
}

/**
 * Finds a newly-appeared card in the city by comparing spaces.
 */
function findNewCityCard(previous: UIState, next: UIState): CityCardResult | null {
  for (let slotIndex = 0; slotIndex < next.city.spaces.length; slotIndex++) {
    const prevSlot = previous.city.spaces[slotIndex] ?? null;
    const nextSlot = next.city.spaces[slotIndex] ?? null;

    if (nextSlot !== null && prevSlot === null) {
      return { name: nextSlot.display.name, display: nextSlot.display };
    }
    if (nextSlot !== null && prevSlot !== null && nextSlot.extId !== prevSlot.extId) {
      return { name: nextSlot.display.name, display: nextSlot.display };
    }
  }
  return null;
}
