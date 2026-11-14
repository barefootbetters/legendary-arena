/**
 * Card image size tiers — Arena Client (WP-891 / D-24848)
 *
 * WP-888 (D-24840) publishes three resized WebP copies of every card face to R2,
 * one folder per tier, next to the original:
 *
 *   original  https://images.legendary-arena.com/core/core-hr-x.webp
 *   thumb     https://images.legendary-arena.com/core/thumb/core-hr-x.webp
 *   phone     https://images.legendary-arena.com/core/phone/core-hr-x.webp
 *
 * This module rewrites a projected card-face `imageUrl` into its tier URLs. It
 * never builds a URL from anything else: no manifest, no set list, no registry.
 * The rule mirrors `tierUrlFor` in `scripts/build-card-image-sizes.mjs`, which an
 * app cannot import, so the client carries its own copy pinned by the same
 * examples in `cardImageTiers.test.ts`.
 */

/** The R2 card-image host every projected card-face URL starts with. */
export const CARD_IMAGE_BASE_URL = 'https://images.legendary-arena.com';

/** The D-24840 size tier names. */
export type CardImageTier = 'thumb' | 'phone' | 'large';

/** The `src` / `srcset` pair a card-face image element renders. */
export interface CardImageSources {
  src: string;
  srcset: string | null;
}

// why: mirrors D-24840's path rule. Only a card face stored directly in a set
// folder (`{set}/{file}.webp`) has published tiers; a root-level file, an
// already-tiered path, another host or another format does not. Avatars also
// match this shape, which is harmless: only card-face sites call this module.
const TIERED_CARD_IMAGE_PATTERN =
  /^https:\/\/images\.legendary-arena\.com\/[a-z0-9]+\/[^/]+\.webp$/;

/**
 * Returns the URL of one size tier of a card-face image, or null when the URL
 * has no published tiers.
 *
 * @param imageUrl - The projected card-face URL, e.g. `.../core/core-hr-x.webp`.
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
 * projected `imageUrl`. A URL with tiers renders the thumb tier with a density
 * `srcset`; any other string renders unchanged with no `srcset`.
 *
 * @param imageUrl - The projected card-face URL (may be empty).
 * @returns The image sources to bind.
 */
export function cardImageSources(imageUrl: string): CardImageSources {
  const thumbUrl = cardImageTierUrl(imageUrl, 'thumb');
  const phoneUrl = cardImageTierUrl(imageUrl, 'phone');
  if (thumbUrl === null || phoneUrl === null) {
    return { src: imageUrl, srcset: null };
  }
  // why: card surfaces are at most about 150 CSS px wide, so the 280 px thumb
  // covers a 1x screen and the 840 px phone tier covers 2x and denser. Density
  // descriptors select by devicePixelRatio only; `srcset` ignores the desktop
  // fit-scale transform, a small accepted upscale (D-24848).
  return { src: thumbUrl, srcset: `${thumbUrl} 1x, ${phoneUrl} 2x` };
}
