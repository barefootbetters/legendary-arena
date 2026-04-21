import type { CardExtId } from '@legendary-arena/game-engine';
import type { PrePlan } from './preplan.types.js';
import { createSpeculativePrng, speculativeShuffle } from './speculativePrng.js';

/**
 * Caller-supplied snapshot of a single player's visible state at the moment
 * a pre-plan is created.
 *
 * WP-057 does not define how the snapshot is obtained. The caller (a future
 * client controller) is responsible for deriving this shape from
 * authoritative engine projections. This module treats the snapshot as a
 * pure input: all fields are consumed by value and never retained.
 */
export type PlayerStateSnapshot = {
  playerId: string;
  hand: CardExtId[];
  deck: CardExtId[];
  discard: CardExtId[];
  counters: Record<string, number>;
  currentTurn: number;
};

/**
 * Build a fresh speculative pre-plan from a player-state snapshot.
 *
 * Produces an `active` pre-plan with an empty reveal ledger and empty plan
 * steps. The speculative deck is shuffled once at creation using the
 * supplied PRNG seed — callers who need reproducibility across rewinds
 * must retain this seed. The returned object aliases none of the input
 * arrays; every zone in `sandboxState` is a fresh copy.
 *
 * @param snapshot - Player-visible state to mirror into the sandbox.
 * @param prePlanId - Caller-supplied identifier for this pre-plan instance.
 * @param prngSeed - Seed for the sandbox-local shuffle.
 * @returns A fresh `PrePlan` in the `active` state.
 */
export function createPrePlan(
  snapshot: PlayerStateSnapshot,
  prePlanId: string,
  prngSeed: number,
): PrePlan {
  const shuffledDeck = speculativeShuffle(snapshot.deck, createSpeculativePrng(prngSeed));
  const baseStateFingerprint = computeStateFingerprint(snapshot);
  return {
    prePlanId,
    // why: new PrePlan instance starts at revision 1; post-rewind PrePlans
    // are new instances with new prePlanId and revision 1
    revision: 1,
    playerId: snapshot.playerId,
    // why: single-turn scope invariant (DESIGN-CONSTRAINT #10); planning a
    // different turn is invalid
    appliesToTurn: snapshot.currentTurn + 1,
    status: 'active',
    baseStateFingerprint,
    sandboxState: {
      hand: [...snapshot.hand],
      deck: shuffledDeck,
      discard: [...snapshot.discard],
      inPlay: [],
      counters: { ...snapshot.counters },
    },
    revealLedger: [],
    planSteps: [],
  };
}

/**
 * Produce a deterministic string fingerprint over the player-visible zones
 * and counters in a snapshot.
 *
 * Determinism and content sensitivity are the only requirements: the same
 * snapshot produces the same fingerprint, and a snapshot whose hand / deck
 * identities / discard / counters differ produces a different fingerprint.
 *
 * The fingerprint is a DESIGN-CONSTRAINT-#3-adjacent divergence hint per
 * the NON-GUARANTEE clause on `PrePlan.baseStateFingerprint`. It is not a
 * cryptographic hash, is not collision-resistant against adversarial input,
 * is not stable across process boundaries, and must never be used as a
 * sole authority for invalidation.
 *
 * @param snapshot - Player-visible state to fingerprint.
 * @returns A deterministic string fingerprint.
 */
export function computeStateFingerprint(snapshot: PlayerStateSnapshot): string {
  // why: deck order is sandbox-local and re-shuffled on rewind; fingerprint
  // covers contents only (hand / deck size + identities / discard /
  // counters), not deck order
  const sortedHand = [...snapshot.hand].sort();
  const sortedDeck = [...snapshot.deck].sort();
  const sortedDiscard = [...snapshot.discard].sort();
  const sortedCounterKeys = Object.keys(snapshot.counters).sort();
  const counterPairs: string[] = [];
  for (const key of sortedCounterKeys) {
    counterPairs.push(`${key}=${snapshot.counters[key]}`);
  }
  const canonical = [
    `playerId:${snapshot.playerId}`,
    `hand:${sortedHand.join(',')}`,
    `deck:${sortedDeck.join(',')}`,
    `discard:${sortedDiscard.join(',')}`,
    `counters:${counterPairs.join(',')}`,
  ].join('|');
  return hashDjb2(canonical);
}

/**
 * djb2 string hash — a widely-documented, non-cryptographic hash chosen for
 * its simplicity and stability across JavaScript engines. Produces an
 * unsigned 32-bit hex string.
 */
function hashDjb2(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
