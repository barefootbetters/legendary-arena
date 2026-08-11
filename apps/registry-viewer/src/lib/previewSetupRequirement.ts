/**
 * previewSetupRequirement.ts — the scheme-aware setup requirement for a
 * URL-driven loadout preview (WP-526 / D-24337).
 *
 * The read-only `<LoadoutPreview>` (WP-114) shows a shared `?schemeId=…`
 * deep-link's composition, but until WP-526 it showed no setup requirement —
 * so a Secret Invasion link (which requires 6 heroes) gave no hint of the
 * 6-hero rule until the user clicked "Edit this loadout" and read it off the
 * empty editor draft (which, being empty, reported the base 5). This pure
 * helper resolves the requirement for the preview's player count AND scheme,
 * reusing the same registry `resolveEffectiveHeroCount` the builder uses, so
 * the preview agrees with the builder + engine.
 *
 * Pure: no Vue, no DOM, no I/O — a lib helper the component's computed calls,
 * so the requirement logic is unit-testable (registry-viewer tests are plain
 * `node:test`, no component mounting).
 */

import type { MatchSetupDocument } from "@legendary-arena/registry/setupContract";
import {
  getPlayerCountSetup,
  resolveEffectiveHeroCount,
  type PlayerCountSetupRow,
} from "@legendary-arena/registry/playerCountSetup";

/** The setup requirement shown in the preview, for one player count. */
export interface PreviewSetupRequirement {
  /** The preview's player count (1–5). */
  readonly playerCount: number;
  /** The required counts, with a scheme-aware `heroCount`. */
  readonly row: PlayerCountSetupRow;
}

/**
 * Resolves the scheme-aware setup requirement for a preview document, or null
 * when there is no preview or its player count is outside the supported 1–5
 * range (no table row to show).
 *
 * @param previewDocument - The URL-driven preview document (carries playerCount
 *   and composition.schemeId), or null when no URL params are present.
 * @returns The required counts (villain groups / henchmen / heroes /
 *   villain-deck bystanders) with `heroCount` resolved for the scheme, or null.
 */
export function resolveSetupRequirement(
  previewDocument: MatchSetupDocument | null,
): PreviewSetupRequirement | null {
  if (previewDocument === null) {
    return null;
  }
  const baseRow = getPlayerCountSetup(previewDocument.playerCount);
  if (baseRow === undefined) {
    return null;
  }
  // why: WP-526 / D-24337 — the hero count is scheme-aware (Secret Invasion
  // requires 6). Spread a NEW row so the immutable single-source-of-truth
  // PLAYER_COUNT_SETUP row is never mutated.
  return {
    playerCount: previewDocument.playerCount,
    row: {
      ...baseRow,
      heroCount: resolveEffectiveHeroCount(
        previewDocument.composition.schemeId,
        previewDocument.playerCount,
        baseRow.heroCount,
      ),
    },
  };
}
