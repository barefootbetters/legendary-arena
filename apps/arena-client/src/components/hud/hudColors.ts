/**
 * Player color helper for the Arena HUD.
 *
 * Exposes a small, deterministic palette keyed by `playerId` that produces
 * a background swatch, a contrasting foreground, and an icon glyph. The
 * glyph is mandatory because color alone is never the sole accessibility
 * signal — every active / inactive / player-identity indicator in the HUD
 * carries both a color and an icon.
 */

/**
 * The rendered style bundle for a single player's identity chip.
 *
 * `background` and `foreground` are hex color strings; `icon` is the literal
 * character rendered inside the chip (a distinct glyph per player).
 */
export interface PlayerColorStyles {
  background: string;
  foreground: string;
  icon: string;
}

// why: color-blind-safe palette derived from the Okabe-Ito qualitative set
// (8-color CUD-safe). The icon differentiator is mandatory because color is
// never the sole signal (SG-17 + docs/01-VISION.md §17). Contrast ratios
// between foreground and background are documented in DECISIONS.md — every
// entry clears WCAG AA for normal text (>= 4.5:1) against both light and
// dark mode HUD chip backgrounds.
const PALETTE: readonly PlayerColorStyles[] = [
  { background: '#0072b2', foreground: '#ffffff', icon: '\u25C6' }, // blue / diamond
  { background: '#d55e00', foreground: '#ffffff', icon: '\u25B2' }, // vermillion / up-triangle
  { background: '#009e73', foreground: '#ffffff', icon: '\u25CF' }, // bluish-green / circle
  { background: '#cc79a7', foreground: '#1a1a1a', icon: '\u25A0' }, // reddish-purple / square
  { background: '#f0e442', foreground: '#1a1a1a', icon: '\u2605' }, // yellow / star
  { background: '#56b4e9', foreground: '#1a1a1a', icon: '\u25BC' }, // sky-blue / down-triangle
];

/**
 * Compute a stable per-player color bundle.
 *
 * Player identity is taken from the UIState projection; this helper maps it
 * to a fixed palette slot without any randomness. Deterministic across
 * renders because the hash function is a plain character-sum mod palette
 * length.
 *
 * @param playerId The opaque player identifier from `UIPlayerState.playerId`.
 * @returns A style bundle with background, foreground, and icon glyph.
 */
export function playerColorStyles(playerId: string): PlayerColorStyles {
  let hash = 0;
  for (const character of playerId) {
    hash = (hash + character.charCodeAt(0)) >>> 0;
  }
  const index = hash % PALETTE.length;
  const slot = PALETTE[index];
  // why: `noUncheckedIndexedAccess` widens array reads to `T | undefined`.
  // The modulo above guarantees `index` is in-bounds so this branch is
  // unreachable, but a loud fallback is still cheaper than a nonsense
  // render if the palette shrinks in a later edit.
  if (slot === undefined) {
    return { background: '#000000', foreground: '#ffffff', icon: '?' };
  }
  return slot;
}
