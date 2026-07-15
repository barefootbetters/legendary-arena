/**
 * Wound identity for the arena-client play surface (WP-380 / D-24181).
 *
 * Components may not add a runtime `@legendary-arena/game-engine` import
 * (`bgioClient.ts` is the sole runtime engine-import site), so the Wound ext_id
 * is mirrored here as a client-local constant. The drift test in
 * `woundIdentity.test.ts` asserts it equals the engine's `WOUND_EXT_ID`, so the
 * literal can never drift from the engine.
 */

/** The Wound card ext_id, mirrored from the engine `WOUND_EXT_ID` (drift-tested). */
export const WOUND_EXT_ID = 'pile-wound';

/**
 * Returns whether the viewer holds at least one Wound in hand. Used to gate the
 * Heal-Wounds affordance: Healing KOs Wounds specifically from hand, so the
 * all-zones `UIPlayerState.woundCount` cannot answer this (it counts every zone).
 *
 * @param handCards The viewer's own hand ext_ids (`UIPlayerState.handCards`), or
 *   `undefined` when redacted or absent.
 * @returns True when at least one hand card is a Wound.
 */
export function handHasWound(handCards: readonly string[] | undefined): boolean {
  if (handCards === undefined) {
    return false;
  }
  for (const cardId of handCards) {
    if (cardId === WOUND_EXT_ID) {
      return true;
    }
  }
  return false;
}
