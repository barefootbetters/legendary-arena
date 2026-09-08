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
// cross-environment idiom recommended by Vite for runtime-resolvable
// static asset URLs. Vite rewrites the call site at build time to a
// final bundle URL string; Node resolves it to a `file://` URL with no
// disk access. The test runner (`node --import tsx`) does not strip
// query suffixes from import specifiers, so the static `?url` suffix
// import is avoided in favour of this pattern.
const moduleUrl = import.meta.url;

// Board-background art — first-party abstract SVG. Only skins whose
// `boardBackgroundUrl` is non-null carry an image; `classic` / `minimal`
// are palette-only grounds (their `boardBackgroundUrl` is `null`).
const comicBoardBackgroundUrl = new URL('../assets/skins/comic/board-background.svg', moduleUrl).href;
const midtownBoardBackgroundUrl = new URL('../assets/skins/midtown/board-background.svg', moduleUrl).href;
const cosmicBoardBackgroundUrl = new URL('../assets/skins/cosmic/board-background.svg', moduleUrl).href;

// Per-skin theme stylesheets (palette + `--skin-board-scrim`).
const classicThemeCssUrl = new URL('../assets/skins/classic/theme.css', moduleUrl).href;
const comicThemeCssUrl = new URL('../assets/skins/comic/theme.css', moduleUrl).href;
const minimalThemeCssUrl = new URL('../assets/skins/minimal/theme.css', moduleUrl).href;
const midtownThemeCssUrl = new URL('../assets/skins/midtown/theme.css', moduleUrl).href;
const cosmicThemeCssUrl = new URL('../assets/skins/cosmic/theme.css', moduleUrl).href;

// Legacy card-frame stubs (WP-130). `cardFrameUrl` is not consumed yet
// (card-frame rendering is a future WP); it stays optional so a new skin
// need not fabricate an unused asset.
const classicCardFrameUrl = new URL('../assets/skins/classic/card-frame.png', moduleUrl).href;
const comicCardFrameUrl = new URL('../assets/skins/comic/card-frame.png', moduleUrl).href;
const minimalCardFrameUrl = new URL('../assets/skins/minimal/card-frame.png', moduleUrl).href;

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
   * Forward seam (WP-666): marks an entry whose art is licensed
   * (e.g. an official Marvel / Upper Deck mat). No entry ships with
   * this set in WP-666; a licensed mat is a gated per-mat drop-in.
   */
  readonly licensed?: boolean;
  /** Optional attribution string for a licensed or credited mat. */
  readonly attribution?: string;
}

/**
 * The bundled skin manifest. Keys are the canonical `SkinName` values;
 * insertion order is preserved by `Object.keys()` and becomes the
 * selector display order.
 *
 * The curated named-mat set (D-24478, superseding the D-13003 three-skin
 * lock): `classic` (default, palette ground) + `comic` + `minimal`
 * (a11y ground) + the two named first-party mats `midtown` + `cosmic`.
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
} as const satisfies Record<string, SkinManifestEntry>;

/**
 * The closed set of bundled skin names. Derived from the manifest keys
 * via `keyof typeof skinManifest` so `playmatSchema.ts` and the
 * selector UI never drift from the manifest.
 */
export type SkinName = keyof typeof skinManifest;
