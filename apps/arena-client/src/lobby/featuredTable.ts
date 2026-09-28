/**
 * The featured table the Arena entrance seats a player at in one click
 * (WP-785 / D-24633). A curated, composition-legal solo match: the entrance
 * is a player's first screen, so the table is fixed here rather than chosen.
 *
 * The composition uses set-qualified ext_ids (the WP-254 lobby guard), and
 * `featuredTable.test.ts` pins every id, count, and label against
 * `data/cards/core.json`.
 */

import type { MatchConfiguration } from '@legendary-arena/game-engine';

/**
 * The featured solo composition: Magneto and the Brotherhood against Midtown
 * Bank Robbery, with Spider-Man, Hulk, and Wolverine.
 */
// why: Brotherhood is Magneto's printed Always Leads. The engine's setup
// validation does not enforce Always Leads, so featuredTable.test.ts does.
export const FEATURED_TABLE: MatchConfiguration = {
  schemeId: 'core/midtown-bank-robbery',
  mastermindId: 'core/magneto',
  villainGroupIds: ['core/brotherhood'],
  henchmanGroupIds: ['core/sentinel'],
  heroDeckIds: ['core/spider-man', 'core/hulk', 'core/wolverine'],
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 12,
};

/** The number of seats at the featured table (a solo match). */
export const FEATURED_PLAYER_COUNT = 1;

/** Display names and art for the featured table, matching the card data. */
export interface FeaturedTableLabels {
  readonly mastermind: string;
  readonly scheme: string;
  readonly villainGroup: string;
  readonly henchmanGroup: string;
  readonly heroes: readonly string[];
  readonly artUrl: string;
}

/**
 * The featured table's labels. The client never imports the registry at
 * runtime, so the names live here beside the composition they describe.
 */
export const FEATURED_TABLE_LABELS: FeaturedTableLabels = {
  mastermind: 'Magneto',
  scheme: 'Midtown Bank Robbery',
  villainGroup: 'Brotherhood',
  henchmanGroup: 'Sentinel',
  heroes: ['Spider-Man', 'Hulk', 'Wolverine'],
  artUrl: 'https://images.legendary-arena.com/core/core-mm-magneto.webp',
};
