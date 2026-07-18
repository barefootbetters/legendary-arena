/**
 * applyPreviewToDraft.ts — promotes a URL setup preview into the SHARED
 * loadout draft (D-24190).
 *
 * why: "Edit this loadout" previously promoted by round-tripping the preview
 * document through `loadFromJson`, which runs the full
 * `validateMatchSetupDocument` and returns WITHOUT assigning when the document
 * is invalid. A challenge link that pins only scheme + mastermind (the WP-114 /
 * WP-345 partial-seed shape) yields empty `villainGroupIds` /
 * `henchmanGroupIds` / `heroDeckIds`, and the schema requires at least one
 * entry in each — so the promote silently bailed and the draft stayed blank.
 *
 * This applies the preview field-by-field through the draft's own public
 * mutators instead, mirroring the `prefillFromTheme` precedent: a draft is a
 * work-in-progress and is ALLOWED to be incomplete (it surfaces its own
 * validation errors until the player fills the rest). Partial-tolerant by
 * construction — there is no all-or-nothing gate.
 *
 * Pure with respect to module state: no Vue, no DOM, no network, no clock, no
 * randomness. It only calls the mutators on the draft API handed in, which
 * makes it unit-testable against a stub API.
 */

import type { MatchSetupDocument } from "@legendary-arena/registry/setupContract";

/**
 * The subset of the loadout-draft API this promotion needs. Declared
 * structurally (rather than importing `UseLoadoutDraftApi`) so a test can
 * supply a minimal recording stub without constructing a real draft.
 */
export interface PreviewPromotionDraftApi {
  draft: { value: MatchSetupDocument };
  setScheme: (schemeId: string) => void;
  setMastermind: (mastermindId: string) => void;
  addVillainGroup: (groupId: string) => void;
  removeVillainGroup: (groupId: string) => void;
  addHenchmanGroup: (groupId: string) => void;
  removeHenchmanGroup: (groupId: string) => void;
  addHeroGroup: (groupId: string) => void;
  removeHeroGroup: (groupId: string) => void;
  setCount: (
    field: "bystandersCount" | "woundsCount" | "officersCount" | "sidekicksCount",
    value: number,
  ) => void;
  setPlayerCount: (value: number) => void;
}

/**
 * Applies a URL setup preview onto the shared draft, replacing whatever the
 * draft currently holds.
 *
 * Ordering is deliberate:
 * 1. Existing group picks are removed first so the promote REPLACES rather
 *    than merges (clicking "Edit this loadout" means "load this loadout").
 * 2. `setMastermind` runs BEFORE the villain adds so any "Always Leads"
 *    villain groups the mastermind auto-includes survive, and the preview's
 *    own villain picks (when the URL carries them) layer on top.
 * 3. `setPlayerCount` runs last so the WP-387 URL player count drives the
 *    required-count guidance the player sees immediately after promoting.
 *
 * @param draftApi - The SHARED draft API owned by App.vue (never a local
 *   instance — a second `useLoadoutDraft()` call would populate a draft
 *   nothing renders, which is the other half of the D-24190 defect).
 * @param previewDocument - The synthesized preview document to promote.
 */
export function applyPreviewToDraft(
  draftApi: PreviewPromotionDraftApi,
  previewDocument: MatchSetupDocument,
): void {
  const currentComposition = draftApi.draft.value.composition;
  // why: copy each array before iterating — the remove mutators splice the
  // very arrays being walked, which would skip entries on a live reference.
  for (const groupId of [...currentComposition.villainGroupIds]) {
    draftApi.removeVillainGroup(groupId);
  }
  for (const groupId of [...currentComposition.henchmanGroupIds]) {
    draftApi.removeHenchmanGroup(groupId);
  }
  for (const heroId of [...currentComposition.heroDeckIds]) {
    draftApi.removeHeroGroup(heroId);
  }

  const incoming = previewDocument.composition;
  draftApi.setScheme(incoming.schemeId);
  draftApi.setMastermind(incoming.mastermindId);
  for (const groupId of incoming.villainGroupIds) {
    draftApi.addVillainGroup(groupId);
  }
  for (const groupId of incoming.henchmanGroupIds) {
    draftApi.addHenchmanGroup(groupId);
  }
  for (const heroId of incoming.heroDeckIds) {
    draftApi.addHeroGroup(heroId);
  }

  draftApi.setCount("bystandersCount", incoming.bystandersCount);
  draftApi.setCount("woundsCount", incoming.woundsCount);
  draftApi.setCount("officersCount", incoming.officersCount);
  draftApi.setCount("sidekicksCount", incoming.sidekicksCount);
  draftApi.setPlayerCount(previewDocument.playerCount);
}
