/**
 * Hash router — the SPA's first (and only) navigation surface (WP-343).
 *
 * Two routes exist, locked by EC-373 §Locked Values:
 *   ''  or '#/'                  → the attract view
 *   '#/gauntlet/<boardName>'     → one gauntlet board view
 *
 * Navigation is plain `<a href="#/...">` — no History API, no server
 * rewrite rules, so deep links work on the static Cloudflare Pages host
 * without touching `_redirects`.
 */

import { ref, type Ref } from "vue";

/** The attract (default) view — the pre-WP-343 single-page experience. */
export interface AttractRoute {
  readonly view: "attract";
}

/** One gauntlet board view, keyed by its snapshot board name. */
export interface GauntletRoute {
  readonly view: "gauntlet";
  readonly boardName: string;
}

export type HashRoute = AttractRoute | GauntletRoute;

// why: gauntlet board names come from the WP-342 publisher grammar
// `gauntlet-<setAbbr>-<mastermindSlug>` — lowercase slugs and hyphens
// only. Anything outside this shape is not a board we could fetch.
const GAUNTLET_BOARD_PATTERN = /^gauntlet-[a-z0-9-]+$/;

/**
 * Parses a `location.hash` value into a route.
 *
 * @param hash The raw hash including the leading `#` (or an empty string).
 * @returns The matched route; malformed values fall back to the attract
 *   route — a public display must never render a broken-route state, so
 *   every unrecognized hash degrades to the default view.
 */
export function parseHashRoute(hash: string): HashRoute {
  if (hash === "" || hash === "#" || hash === "#/") {
    return { view: "attract" };
  }

  const gauntletPrefix = "#/gauntlet/";
  if (hash.startsWith(gauntletPrefix)) {
    const boardName = hash.slice(gauntletPrefix.length);
    if (GAUNTLET_BOARD_PATTERN.test(boardName)) {
      return { view: "gauntlet", boardName };
    }
  }

  // why: fallback — see the JSDoc above; unrecognized hashes (including a
  // bare '#/gauntlet/' or mixed-case garbage) render the attract view.
  return { view: "attract" };
}

/**
 * Creates a reactive route ref bound to the window's hash, updating on
 * every `hashchange`. Reads the initial hash synchronously so a deep link
 * renders its target view on first paint (no attract flash).
 *
 * @param targetWindow The window to bind (injectable for future tests).
 * @returns A ref holding the current route.
 */
export function createHashRouteRef(targetWindow: Window): Ref<HashRoute> {
  const currentRoute = ref<HashRoute>(
    parseHashRoute(targetWindow.location.hash),
  );
  targetWindow.addEventListener("hashchange", () => {
    currentRoute.value = parseHashRoute(targetWindow.location.hash);
  });
  return currentRoute;
}
