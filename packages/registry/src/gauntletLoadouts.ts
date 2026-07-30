/**
 * Canonical gauntlet loadout menus (WP-395 / EC-435 / D-24199).
 *
 * A ranked gauntlet leg qualifies only when it was played with one of the
 * approved villain-group and henchmen-group configurations for its mastermind
 * and player count. Casual match setup is untouched — free selection remains
 * the game as printed; this constrains the competitive surface only.
 *
 * The menu data itself is GENERATED from the card registry by
 * `scripts/generate-gauntlet-loadouts.mjs` into `gauntletLoadouts.generated.ts`
 * and gated in CI by `pnpm gauntlet:loadouts:check`. This module owns the
 * contract and the lookup helpers; it never hand-authors composition data,
 * because a typed copy would rot on the next set change.
 */

import { GAUNTLET_LOADOUT_MENUS } from './gauntletLoadouts.generated.js';
import type { SupportedPlayerCount } from './playerCountSetup.js';

/**
 * One approved composition: the exact villain and henchmen groups a qualifying
 * replay must have been played with at one player count. Both lists hold
 * set-qualified ext_ids in the D-10014 `setAbbr/slug` space, sorted ASC.
 */
export interface GauntletLoadoutComposition {
  readonly villainGroupIds: readonly string[];
  readonly henchmanGroupIds: readonly string[];
}

/**
 * The approved configuration for a mastermind (variant 0, D-24278 — the one
 * canonical configuration ranked qualification uses), sized for every supported
 * player count. `variantIndex` is stable across regenerations for a given
 * card-data state and is what the board and challenge link cite.
 */
export interface GauntletLoadoutVariant {
  readonly variantIndex: number;
  readonly compositionsByPlayerCount: Readonly<
    Record<SupportedPlayerCount, GauntletLoadoutComposition>
  >;
}

/**
 * Every approved configuration for one gauntlet's mastermind.
 */
export interface GauntletLoadoutMenu {
  readonly setAbbr: string;
  readonly mastermindSlug: string;
  readonly variants: readonly GauntletLoadoutVariant[];
}

export { GAUNTLET_LOADOUT_MENUS };

/**
 * Finds the approved menu for one gauntlet.
 *
 * @param setAbbr the gauntlet's home set abbreviation.
 * @param mastermindSlug the gauntlet's mastermind slug.
 * @returns the menu, or `undefined` when the pair hosts no gauntlet.
 */
export function getGauntletLoadoutMenu(
  setAbbr: string,
  mastermindSlug: string,
): GauntletLoadoutMenu | undefined {
  for (const menu of GAUNTLET_LOADOUT_MENUS) {
    if (menu.setAbbr === setAbbr && menu.mastermindSlug === mastermindSlug) {
      return menu;
    }
  }
  return undefined;
}

/**
 * Strips the set qualifier from an ext_id, yielding the bare group slug.
 *
 * @param groupExtId a `setAbbr/slug` ext_id.
 * @returns the bare slug.
 */
function stripSetAbbreviation(groupExtId: string): string {
  return groupExtId.slice(groupExtId.indexOf('/') + 1);
}

/**
 * Projects a composition's villain groups into the bare-slug, sorted, `+`-joined
 * form the ScenarioKey's third segment carries.
 *
 * why: ScenarioKey is built from bare slugs (`buildScenarioKey` strips the set
 * qualifier), so a stored key cannot distinguish `core/hydra` from
 * `co2e/hydra`. The qualification check therefore compares villain groups in
 * this lossy projection — the alternative is changing the key's shape, which
 * would re-key every future PAR table. Henchmen carry no such constraint and
 * are compared as exact set-qualified ids.
 *
 * @param composition the approved composition.
 * @returns the villain segment as it would appear in a ScenarioKey.
 */
export function buildVillainSegment(
  composition: GauntletLoadoutComposition,
): string {
  const bareSlugs: string[] = [];
  for (const groupExtId of composition.villainGroupIds) {
    bareSlugs.push(stripSetAbbreviation(groupExtId));
  }
  return bareSlugs.sort().join('+');
}

/**
 * Projects a composition's henchmen groups into the sorted, `+`-joined key the
 * server records on a scored replay (`legendary.competitive_scores.henchman_key`).
 *
 * why: set-qualified and never re-slugified, mirroring `team_key` (D-24187 §1)
 * — henchmen are not part of ScenarioKey, so this key is ours to define and
 * there is no reason to inherit the villain segment's set-blindness.
 *
 * @param composition the approved composition.
 * @returns the henchmen key.
 */
export function buildHenchmanKey(
  composition: GauntletLoadoutComposition,
): string {
  return [...composition.henchmanGroupIds].sort().join('+');
}
