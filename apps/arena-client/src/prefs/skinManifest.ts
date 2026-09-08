/**
 * skinManifest.ts
 *
 * Canonical source of truth for the bundled-with-client skin set. The
 * `SkinName` type is derived from the keys of `skinManifest`; the
 * schema-validation narrower in `playmatSchema.ts` MUST derive its
 * closed set from the same keys via `Object.keys(skinManifest)` rather
 * than re-declaring the union by hand (the drift test in
 * `playmatSchema.test.ts` enforces this).
 *
 * WP-666 (D-24477..D-24479) activates the previously-inert skin visuals:
 * - D-24477 activates the D-13002 board-background element — `useSkinApplier`
 *   now sets `--skin-board-image` from each entry's `boardBackgroundUrl`, which
 *   the fixed `PlaymatBackground` layer paints behind the play board.
 * - D-24478 supersedes the D-13003 three-skin lock with a curated named-mat set
 *   (five entries). First-party / abstract art ships now; a licensed mat is a
 *   gated per-mat drop-in via the `licensed` / `attribution` seam (unused here).
 * - D-24479 supersedes the D-13001 bundled-only discovery: `boardBackgroundUrl`
 *   may be a bundled URL, a CDN URL (`images.legendary-arena.com`), or `null`
 *   for a palette-only ground (`classic` / `minimal`).
 *
 * The bundled board art is authored as first-party abstract **SVG** (a real
 * committed image asset resolved to a URL, not a CSS gradient painted on the
 * element). SVG was chosen over a raster (`.png` / `.webp`) so the art is
 * project-authorable without a binary image pipeline while remaining a genuine
 * `url()`-loaded image; it is project-owned, never a Marvel / Upper Deck scan.
 *
 * To add a new bundled skin: drop a folder under
 * `apps/arena-client/src/assets/skins/<name>/` with a `theme.css` (and a
 * `board-background.svg` if it carries an image), then add the matching entry
 * to the `skinManifest` literal below. `SkinName` and the schema closed set
 * update automatically.
 *
 * @see WP-130 §A "Pinia preferences store" — canonical-source rule
 * @see WP-666 / EC-703 — board-background activation + named-mat set
 * @see DECISIONS.md D-13001..D-13005, D-24477..D-24479
 */

// why: the `new URL(relative, import.meta.url).href` pattern is the
// cross-environment idiom for runtime-resolvable static asset URLs —
// Vite rewrites the call site at build time to the final hashed bundle
// URL; Node resolves it to a `file://` URL with no disk access.
// CRITICAL: `import.meta.url` MUST appear LITERALLY as the second
// argument. Aliasing it through an intermediate variable
// (`const moduleUrl = import.meta.url; new URL(path, moduleUrl)`)
// defeats Vite's static analysis: it does NOT rewrite the call, so in
// production the URL resolves relative to the hashed JS chunk and 404s
// (e.g. `/assets/skins/comic/board-background.svg`, which is never
// emitted). WP-130 shipped the aliased form; it was invisible until
// WP-666 consumed the URLs, then every mat image + theme 404'd live.
// See DECISIONS.md D-24482. The `?url` suffix import is still avoided
// because the `node --import tsx` test runner does not strip query
// suffixes from import specifiers.

// Board-background art — first-party abstract SVG. Only skins whose
// `boardBackgroundUrl` is non-null carry an image; `classic` / `minimal`
// are palette-only grounds (their `boardBackgroundUrl` is `null`).
const comicBoardBackgroundUrl = new URL('../assets/skins/comic/board-background.svg', import.meta.url).href;
const midtownBoardBackgroundUrl = new URL('../assets/skins/midtown/board-background.svg', import.meta.url).href;
const cosmicBoardBackgroundUrl = new URL('../assets/skins/cosmic/board-background.svg', import.meta.url).href;

// Per-skin theme stylesheets (palette + `--skin-board-scrim`).
const classicThemeCssUrl = new URL('../assets/skins/classic/theme.css', import.meta.url).href;
const comicThemeCssUrl = new URL('../assets/skins/comic/theme.css', import.meta.url).href;
const minimalThemeCssUrl = new URL('../assets/skins/minimal/theme.css', import.meta.url).href;
const midtownThemeCssUrl = new URL('../assets/skins/midtown/theme.css', import.meta.url).href;
const cosmicThemeCssUrl = new URL('../assets/skins/cosmic/theme.css', import.meta.url).href;
// The nine licensed Marvel / Upper Deck mat skins share one theme (strong scrim).
const matsThemeCssUrl = new URL('../assets/skins/mats/theme.css', import.meta.url).href;

// why (D-24479): the licensed mat images are NOT bundled — they are copyrighted
// Marvel / Upper Deck scans, kept out of git (like all card art) and served from
// the R2-backed images CDN, the same host the game already loads card art from.
// `boardBackgroundUrl` carries the absolute CDN URL directly (no `new URL` — it
// is already fully-qualified). Files live at r2:legendary-images/play-mats/.
const MAT_CDN = 'https://images.legendary-arena.com/play-mats';

// Legacy card-frame stubs (WP-130). `cardFrameUrl` is not consumed yet
// (card-frame rendering is a future WP); it stays optional so a new skin
// need not fabricate an unused asset.
const classicCardFrameUrl = new URL('../assets/skins/classic/card-frame.png', import.meta.url).href;
const comicCardFrameUrl = new URL('../assets/skins/comic/card-frame.png', import.meta.url).href;
const minimalCardFrameUrl = new URL('../assets/skins/minimal/card-frame.png', import.meta.url).href;

/**
 * One bundled skin's resolved asset URLs, its human-readable selector
 * label, and the CSS class name that `useSkinApplier` toggles on the
 * `<PlayViewport>` root element.
 *
 * The CSS class name (`skin-<name>`) must match the selector in the
 * companion `theme.css` file under
 * `apps/arena-client/src/assets/skins/<name>/`.
 */
export interface SkinManifestEntry {
  /** Human-readable name shown in the selector (never the raw key). */
  readonly displayLabel: string;
  /**
   * The mat image URL painted behind the board (bundled or CDN), or
   * `null` for a palette-only ground with no image. `useSkinApplier`
   * maps this to the `--skin-board-image` CSS variable.
   */
  readonly boardBackgroundUrl: string | null;
  /** Legacy, currently unconsumed card-frame stub (WP-130). Optional. */
  readonly cardFrameUrl?: string;
  readonly themeCssUrl: string;
  readonly cssClassName: string;
  /**
   * Marks an entry whose art is licensed (an official Marvel / Upper Deck
   * mat scan). The nine `play-mats` skins set this `true` with an
   * `attribution`; the first-party skins (classic/comic/minimal/midtown/
   * cosmic) leave it unset.
   */
  readonly licensed?: boolean;
  /** Attribution string for a licensed mat (shown/recorded as credit). */
  readonly attribution?: string;
}

/**
 * The bundled skin manifest. Keys are the canonical `SkinName` values;
 * insertion order is preserved by `Object.keys()` and becomes the
 * selector display order.
 *
 * The curated named-mat set (D-24478, superseding the D-13003 three-skin
 * lock): the five first-party skins — `classic` (default, palette ground) +
 * `comic` + `minimal` (a11y ground) + `midtown` + `cosmic` — followed by the
 * nine licensed Marvel / Upper Deck mats from the ewiki play-mats catalogue
 * (images served from the CDN, see `MAT_CDN`).
 */
export const skinManifest = {
  classic: {
    displayLabel: 'Classic',
    boardBackgroundUrl: null,
    cardFrameUrl: classicCardFrameUrl,
    themeCssUrl: classicThemeCssUrl,
    cssClassName: 'skin-classic',
  },
  comic: {
    displayLabel: 'Comic',
    boardBackgroundUrl: comicBoardBackgroundUrl,
    cardFrameUrl: comicCardFrameUrl,
    themeCssUrl: comicThemeCssUrl,
    cssClassName: 'skin-comic',
  },
  minimal: {
    displayLabel: 'Minimal',
    boardBackgroundUrl: null,
    cardFrameUrl: minimalCardFrameUrl,
    themeCssUrl: minimalThemeCssUrl,
    cssClassName: 'skin-minimal',
  },
  midtown: {
    displayLabel: 'Midtown Skyline',
    boardBackgroundUrl: midtownBoardBackgroundUrl,
    themeCssUrl: midtownThemeCssUrl,
    cssClassName: 'skin-midtown',
  },
  cosmic: {
    displayLabel: 'Cosmic Arena',
    boardBackgroundUrl: cosmicBoardBackgroundUrl,
    themeCssUrl: cosmicThemeCssUrl,
    cssClassName: 'skin-cosmic',
  },
  darkphoenix: {
    displayLabel: 'Dark Phoenix',
    boardBackgroundUrl: `${MAT_CDN}/dark-phoenix-vs-xmen-playmat.jpg`,
    themeCssUrl: matsThemeCssUrl,
    cssClassName: 'skin-darkphoenix',
    licensed: true,
    attribution: 'Upper Deck Legendary Playmat: Dark Phoenix vs. The X-Men',
  },
  thanos: {
    displayLabel: 'Thanos vs. Avengers',
    boardBackgroundUrl: `${MAT_CDN}/thanos-infinity-saga-playmat.jpg`,
    themeCssUrl: matsThemeCssUrl,
    cssClassName: 'skin-thanos',
    licensed: true,
    attribution: 'Upper Deck Legendary Playmat: Thanos vs. The Avengers',
  },
  villains: {
    displayLabel: 'Villains',
    boardBackgroundUrl: `${MAT_CDN}/villains-playmat.jpg`,
    themeCssUrl: matsThemeCssUrl,
    cssClassName: 'skin-villains',
    licensed: true,
    attribution: 'Upper Deck Legendary Villains in-box mat',
  },
  loki: {
    displayLabel: 'Loki vs. Avengers',
    boardBackgroundUrl: `${MAT_CDN}/avengers-core-playmat.jpg`,
    themeCssUrl: matsThemeCssUrl,
    cssClassName: 'skin-loki',
    licensed: true,
    attribution: 'Upper Deck Loki vs. The Avengers layout mat (OPK1)',
  },
  darkcity: {
    displayLabel: 'Dark City',
    boardBackgroundUrl: `${MAT_CDN}/dark-city-playmat.jpg`,
    themeCssUrl: matsThemeCssUrl,
    cssClassName: 'skin-darkcity',
    licensed: true,
    attribution: 'Upper Deck Daredevil vs. The Hand / Dark City mat (OPK2)',
  },
  painttown: {
    displayLabel: 'Paint the Town Red',
    boardBackgroundUrl: `${MAT_CDN}/paint-the-town-red-playmat.jpg`,
    themeCssUrl: matsThemeCssUrl,
    cssClassName: 'skin-painttown',
    licensed: true,
    attribution: 'Upper Deck Spider-Man vs. the Sinister Six layout scan',
  },
  thanosart: {
    displayLabel: 'Thanos (Art)',
    boardBackgroundUrl: `${MAT_CDN}/thanos-art-mat.jpg`,
    themeCssUrl: matsThemeCssUrl,
    cssClassName: 'skin-thanosart',
    licensed: true,
    attribution: 'Upper Deck Marvel Thanos art playmat (SKU 93486)',
  },
  wolverine: {
    displayLabel: 'Wolverine',
    boardBackgroundUrl: `${MAT_CDN}/wolverine-art-mat.jpg`,
    themeCssUrl: matsThemeCssUrl,
    cssClassName: 'skin-wolverine',
    licensed: true,
    attribution: 'Upper Deck Marvel Wolverine art playmat (SKU 93490)',
  },
  spidermanart: {
    displayLabel: 'Spider-Man',
    boardBackgroundUrl: `${MAT_CDN}/spider-man-art-mat.jpg`,
    themeCssUrl: matsThemeCssUrl,
    cssClassName: 'skin-spidermanart',
    licensed: true,
    attribution: 'Upper Deck Marvel Spider-Man art playmat (SKU 93488)',
  },
} as const satisfies Record<string, SkinManifestEntry>;

/**
 * The closed set of bundled skin names. Derived from the manifest keys
 * via `keyof typeof skinManifest` so `playmatSchema.ts` and the
 * selector UI never drift from the manifest.
 */
export type SkinName = keyof typeof skinManifest;
