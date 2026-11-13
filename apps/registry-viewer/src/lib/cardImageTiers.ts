/**
 * Card image size tiers — Registry Viewer (WP-892 / D-24849)
 *
 * WP-888 (D-24840) publishes three resized WebP copies of every card face to R2,
 * one folder per tier, next to the original:
 *
 *   original  https://images.legendary-arena.com/core/core-hr-x.webp
 *   thumb     https://images.legendary-arena.com/core/thumb/core-hr-x.webp
 *   phone     https://images.legendary-arena.com/core/phone/core-hr-x.webp
 *   large     https://images.legendary-arena.com/core/large/core-hr-x.webp
 *
 * This module rewrites a card's `imageUrl` / `physicalCardImageUrl` into its
 * tier URLs and picks the density ladder a grid tile or the detail panel uses.
 * It never builds a URL from anything else: no manifest, no set list.
 */

/** The D-24840 size tier names. */
export type CardImageTier = 'thumb' | 'phone' | 'large';

/**
 * The two density ladders: `small` renders `thumb 1x, phone 2x`; `large`
 * renders `phone 1x, large 2x`.
 */
export type CardImageLadder = 'small' | 'large';

/** The `src` / `srcset` pair a card-face image element renders. */
export interface CardFaceSources {
  src: string;
  srcset: string | null;
}

// why: mirrors D-24840's path rule. Only a card face stored directly in a set
// folder (`{set}/{file}.webp`) has published tiers; a root-level file, an
// already-tiered path, another host or another format does not. This is the
// third copy of the rule (the build script and the arena client hold the
// others; no runtime module is importable by both apps), pinned by the same
// example table in `cardImageTiers.test.ts` (D-24849).
const TIERED_CARD_IMAGE_PATTERN =
  /^https:\/\/images\.legendary-arena\.com\/[a-z0-9]+\/[^/]+\.webp$/;

// why: at a slider value of 130 px or less a grid tile stays under about
// 260 px wide, where a 200 px `thumb` is at most a 30% upscale at 1x; above it
// the `phone` rung avoids visible blur on large tiles (D-24849).
export const SMALL_LADDER_MAX_CARD_WIDTH_PX = 130;

/**
 * Returns the URL of one size tier of a card-face image, or null when the URL
 * has no published tiers.
 *
 * @param imageUrl - The card-face URL, e.g. `.../core/core-hr-x.webp`.
 * @param tier - The tier name, e.g. `thumb`.
 * @returns The tier URL, e.g. `.../core/thumb/core-hr-x.webp`, or null.
 */
export function cardImageTierUrl(
  imageUrl: string,
  tier: CardImageTier,
): string | null {
  if (!TIERED_CARD_IMAGE_PATTERN.test(imageUrl)) {
    return null;
  }
  const lastSlashIndex = imageUrl.lastIndexOf('/');
  const folderPart = imageUrl.slice(0, lastSlashIndex);
  const filePart = imageUrl.slice(lastSlashIndex);
  return `${folderPart}/${tier}${filePart}`;
}

/**
 * Returns the `src` and `srcset` a card-face image element renders for a
 * card-face URL on one ladder. A URL with tiers renders the ladder's 1x tier
 * with a density `srcset`; any other string renders unchanged with no `srcset`.
 *
 * @param imageUrl - The card-face URL (may be empty).
 * @param ladder - `small` (`thumb 1x, phone 2x`) or `large` (`phone 1x, large 2x`).
 * @returns The image sources to bind.
 */
export function cardImageSources(
  imageUrl: string,
  ladder: CardImageLadder,
): CardFaceSources {
  let oneTimesTier: CardImageTier = 'phone';
  let twoTimesTier: CardImageTier = 'large';
  if (ladder === 'small') {
    oneTimesTier = 'thumb';
    twoTimesTier = 'phone';
  }
  const oneTimesUrl = cardImageTierUrl(imageUrl, oneTimesTier);
  const twoTimesUrl = cardImageTierUrl(imageUrl, twoTimesTier);
  if (oneTimesUrl === null || twoTimesUrl === null) {
    return { src: imageUrl, srcset: null };
  }
  return { src: oneTimesUrl, srcset: `${oneTimesUrl} 1x, ${twoTimesUrl} 2x` };
}

/**
 * Picks the density ladder for one grid tile from the card-size slider value
 * and whether the tile shows one half of a split-card image.
 *
 * @param cardWidthPx - The card-size slider value (the grid's minimum column width).
 * @param isSplitFace - True when the tile crops one half of a landscape split image.
 * @returns `small` for an ordinary tile at or below the threshold, else `large`.
 */
export function gridImageLadder(
  cardWidthPx: number,
  isSplitFace: boolean,
): CardImageLadder {
  // why: a split face's visible half is drawn from about 1.9× the tile width,
  // so it always takes the `large` rung (D-24849).
  if (isSplitFace) {
    return 'large';
  }
  if (cardWidthPx <= SMALL_LADDER_MAX_CARD_WIDTH_PX) {
    return 'small';
  }
  return 'large';
}

/**
 * Returns the sources a card-face image renders, given whether its tier has
 * already failed to load. After a tier failure the original renders alone.
 *
 * @param imageUrl - The card-face URL (may be empty).
 * @param ladder - The density ladder to use while the tier has not failed.
 * @param hasTierFailed - True once a tier load has failed for this URL.
 * @returns The image sources to bind.
 */
export function resolveCardFaceSources(
  imageUrl: string,
  ladder: CardImageLadder,
  hasTierFailed: boolean,
): CardFaceSources {
  if (hasTierFailed) {
    return { src: imageUrl, srcset: null };
  }
  return cardImageSources(imageUrl, ladder);
}
