/**
 * Fetches a card-data / metadata / theme file from R2, always revalidating any
 * browser-cached copy first.
 *
 * Until D-24674 the R2 objects carried no `Cache-Control`, so a browser kept them
 * under heuristic freshness — for days after a data fix. After WP-797 (#2639)
 * corrected Dr. Doom's Always Leads, a returning visitor's loadout builder still
 * locked Masters of Evil to Dr. Doom, and Ctrl+Shift+R did not help because
 * these requests are made by script after the page loads (D-24675).
 *
 * `cache: "no-cache"` makes the browser revalidate every cached copy with R2
 * (a 304 when unchanged, against the object's ETag / Last-Modified), so a fix
 * shows up on the next page load no matter what headers an older copy carried.
 *
 * @param url - The R2 URL to fetch.
 * @returns The fetch response.
 */
export function fetchMetadata(url: string): Promise<Response> {
  // why: resolve `fetch` at call time (not captured at import) so tests that stub
  // globalThis.fetch per test keep working.
  return globalThis.fetch(url, { cache: "no-cache" });
}
