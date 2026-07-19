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

import type {
  SetupCompositionInput,
  SupportPools,
} from "@legendary-arena/registry/setupContract";

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
 * Collects the ext_ids of every card named by the draft's support pools —
 * bystanders, wounds, S.H.I.E.L.D. officers and sidekicks (D-24194).
 *
 * why: `compositionExtIdSet` reads the five composition fields only, because
 * that is all a loadout had when the gallery shipped. Support pools live on the
 * ENVELOPE (D-24194 put them there so the 9-field composition lock D-1244 could
 * stand), so the gallery could not see them and a loadout with pools rendered
 * with its support cards missing entirely.
 *
 * Kept as a SEPARATE set rather than folded into `compositionExtIdSet` so the
 * caller can offer support cards as an opt-in: they are numerous (a
 * select-all-sets bystander pool is ~70 cards) and wanted far less often than
 * the heroes and villains, so merging the two would bury the interesting cards.
 *
 * Unlike composition ids — which are GROUP ext_ids shared by every member card —
 * a pool ext_id names one specific card, so membership here is exact rather
 * than expanding.
 *
 * @param supportPools - The draft's envelope pools, or undefined when unset.
 */
export function supportPoolExtIdSet(supportPools: SupportPools | undefined): Set<string> {
  const extIdSet = new Set<string>();
  if (supportPools === undefined) {
    return extIdSet;
  }
  // why: explicit iteration over the four named pools rather than
  // Object.values, so a future fifth pool kind is a compile error here instead
  // of silently missing from the gallery.
  for (const pool of [
    supportPools.bystanders,
    supportPools.wounds,
    supportPools.officers,
    supportPools.sidekicks,
  ]) {
    if (pool === undefined) {
      continue;
    }
    for (const card of pool.cards) {
      extIdSet.add(card.extId);
    }
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
