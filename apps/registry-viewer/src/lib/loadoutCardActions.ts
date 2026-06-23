/**
 * loadoutCardActions.ts — pure helpers mapping a browsed card to its loadout
 * slot (WP-279 / EC-310 / D-24054).
 *
 * The Cards tab lets a player add the card they are viewing to the shared
 * loadout draft with one click. This module is the SINGLE source of the
 * cardType→slot routing, the slot-occupancy check, and the add/remove/clear
 * toggle (including the Always-Leads safety no-op). Components and `App.vue`
 * route through these helpers and never re-encode the mapping.
 *
 * Pure helper module: no Vue reactivity is created here, no I/O, no engine or
 * game-framework import (the registry-viewer layer never pulls in the engine's
 * boardgame runtime). `toggleCardInLoadout` is the only mutating function, and
 * it mutates ONLY through the existing `UseLoadoutDraftApi` methods — never by
 * writing `draft.composition.*` directly.
 */

import type { SetupCompositionInput } from "@legendary-arena/registry/setupContract";
import type { UseLoadoutDraftApi } from "../composables/useLoadoutDraft";

/**
 * The five composition slots a card can occupy. A card type that is not one
 * of the five composition entity types resolves to `null` (no slot, no
 * button).
 */
export type LoadoutSlot = "scheme" | "mastermind" | "villain" | "henchman" | "hero";

/**
 * The minimal card shape the loadout-action helpers read: the set-qualified
 * group ext_id (D-24018 — the id the loadout composition stores, NOT
 * `FlatCard.key`) and the card type that selects the slot.
 */
export interface LoadoutActionCard {
  extId: string;
  cardType: string;
}

/**
 * Maps a card type to the loadout composition slot it occupies, or `null` for
 * any non-composition type (bystander / wound / other) — which renders no
 * add-to-loadout button.
 *
 * @param cardType - The `FlatCard.cardType` of the viewed card.
 */
export function resolveLoadoutSlot(cardType: string): LoadoutSlot | null {
  // why: explicit per-type routing (no dynamic key access / no map lookup,
  // per code-style.md §Abstraction & Control Flow). The five composition
  // entity types map to their slot; everything else has no slot.
  if (cardType === "scheme") {
    return "scheme";
  }
  if (cardType === "mastermind") {
    return "mastermind";
  }
  if (cardType === "villain") {
    return "villain";
  }
  if (cardType === "henchman") {
    return "henchman";
  }
  if (cardType === "hero") {
    return "hero";
  }
  return null;
}

/**
 * Returns whether the card's `extId` currently occupies its slot in the given
 * composition: scheme/mastermind by string equality on the single slot; the
 * three group slots by array membership. A non-composition card type is never
 * "in" the loadout.
 *
 * @param composition - The draft's composition block (read-only here).
 * @param card - The viewed card (extId + cardType).
 */
export function isCardInLoadout(
  composition: SetupCompositionInput,
  card: LoadoutActionCard,
): boolean {
  const slot = resolveLoadoutSlot(card.cardType);
  if (slot === null) {
    return false;
  }
  // why: scheme/mastermind are single-value slots — occupancy is equality on
  // the stored ext_id. The three group slots are deduped arrays — occupancy is
  // membership.
  if (slot === "scheme") {
    return composition.schemeId === card.extId;
  }
  if (slot === "mastermind") {
    return composition.mastermindId === card.extId;
  }
  if (slot === "villain") {
    return composition.villainGroupIds.includes(card.extId);
  }
  if (slot === "henchman") {
    return composition.henchmanGroupIds.includes(card.extId);
  }
  // slot === "hero"
  return composition.heroDeckIds.includes(card.extId);
}

/**
 * Toggles the card's presence in the shared loadout draft: adds (or sets, for
 * the single slots) when absent, removes (or clears) when present — using ONLY
 * the existing `UseLoadoutDraftApi` methods. A villain group the selected
 * mastermind Always Leads is locked: removing it is a no-op.
 *
 * @param api - The shared loadout-draft API (owned by `App.vue`).
 * @param card - The viewed card (extId + cardType).
 */
export function toggleCardInLoadout(api: UseLoadoutDraftApi, card: LoadoutActionCard): void {
  const slot = resolveLoadoutSlot(card.cardType);
  if (slot === null) {
    // why: non-composition card types (bystander / wound / other) have no
    // loadout slot — nothing to toggle, so this is a silent no-op.
    return;
  }
  const present = isCardInLoadout(api.draft.value.composition, card);

  if (slot === "scheme") {
    // why: setScheme("") clears the single slot (mirrors the builder).
    if (present) {
      api.setScheme("");
    } else {
      api.setScheme(card.extId);
    }
    return;
  }
  if (slot === "mastermind") {
    if (present) {
      api.setMastermind("");
    } else {
      api.setMastermind(card.extId);
    }
    return;
  }
  if (slot === "hero") {
    if (present) {
      api.removeHeroGroup(card.extId);
    } else {
      api.addHeroGroup(card.extId);
    }
    return;
  }
  if (slot === "henchman") {
    if (present) {
      api.removeHenchmanGroup(card.extId);
    } else {
      api.addHenchmanGroup(card.extId);
    }
    return;
  }
  // slot === "villain"
  if (!present) {
    api.addVillainGroup(card.extId);
    return;
  }
  // why: D-24054 — a villain group the selected mastermind Always Leads is
  // mandatory in the match deck (mirrors the builder's chip-lock). Removing it
  // via this button would silently drop a required group, so removal of a
  // required villain group is a no-op. The guard lives in the helper so no
  // future caller can bypass it.
  if (api.requiredVillainGroupIds.value.includes(card.extId)) {
    return;
  }
  api.removeVillainGroup(card.extId);
}
