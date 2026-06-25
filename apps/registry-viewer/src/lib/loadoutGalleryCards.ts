/**
 * loadoutGalleryCards.ts — pure helpers turning a loadout composition into the
 * deduped set of its member-card ext_ids and a card-membership predicate
 * (WP-288 / EC-320 / D-24072).
 *
 * The Cards tab's "View loadout as cards" gallery narrows the existing grid to
 * exactly the cards in the shared loadout draft's composition. This module is
 * the SINGLE source of that composition→ext_id-set expansion + the membership
 * test; `App.vue`'s gallery filter stage routes through these helpers and never
 * re-encodes the expansion.
 *
 * Pure helper module: no Vue reactivity is created here, no I/O, no engine or
 * game-framework import (the registry-viewer layer never pulls in the engine's
 * boardgame runtime). Both functions only READ the composition / card; neither
 * mutates the draft, the composition, or the card list.
 */

import type { SetupCompositionInput } from "@legendary-arena/registry/setupContract";

/**
 * The minimal card shape the gallery membership test reads: the set-qualified
 * group ext_id (D-24018 — the id the loadout composition stores, shared across
 * a group's member cards; NOT `FlatCard.key`).
 */
export interface LoadoutGalleryCard {
  extId: string;
}

/**
 * Collects, into one deduped Set, the ext_ids of every pick in a loadout
 * composition: the non-empty scheme and mastermind single slots plus every
 * entry of the three group arrays (villain / henchman / hero). The set-qualified
 * group ext_id is shared by all of a group's member cards, so membership against
 * this set expands each group pick to its full member-card set.
 *
 * Reads ONLY the five canonical composition fields (00.2 §8.1); never mutates
 * the composition.
 *
 * @param composition - The draft's composition block (read-only here).
 */
export function compositionExtIdSet(composition: SetupCompositionInput): Set<string> {
  const extIdSet = new Set<string>();
  // why: skip an unset single slot — an empty-string schemeId / mastermindId is
  // "no pick", not a real ext_id. Adding "" would poison the set and make any
  // card with an empty extId spuriously match the gallery (EC-320 failure smell).
  if (composition.schemeId !== "") {
    extIdSet.add(composition.schemeId);
  }
  if (composition.mastermindId !== "") {
    extIdSet.add(composition.mastermindId);
  }
  // why: explicit `for...of` accumulation into the deduped Set (no `.reduce()`,
  // per code-style.md §Abstraction & Control Flow). `Set.add` is idempotent, so
  // a repeated id collapses to one entry.
  for (const villainGroupId of composition.villainGroupIds) {
    extIdSet.add(villainGroupId);
  }
  for (const henchmanGroupId of composition.henchmanGroupIds) {
    extIdSet.add(henchmanGroupId);
  }
  for (const heroDeckId of composition.heroDeckIds) {
    extIdSet.add(heroDeckId);
  }
  return extIdSet;
}

/**
 * Returns whether a card belongs to the loadout: membership of the card's
 * set-qualified `extId` (D-24018) in the composition ext_id set. The `extId`
 * is the membership key — NEVER `card.key` (a per-member flat-card display id
 * the engine rejects; keying on it would show only one card per group).
 *
 * @param card - The card to test (only its `extId` is read).
 * @param extIdSet - The composition ext_id set from `compositionExtIdSet`.
 */
export function isCardInLoadoutComposition(
  card: LoadoutGalleryCard,
  extIdSet: Set<string>,
): boolean {
  return extIdSet.has(card.extId);
}
