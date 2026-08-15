/**
 * deployVersion.ts — registry-viewer deploy-freshness helpers (WP-552 / EC-587 / D-24361).
 *
 * An operator whose browser is holding a cached bundle sees old UI with no
 * signal at all — a shipped-and-deployed change simply is not there, and reads
 * as a broken feature. That cost a full verification round-trip on 2026-08-15:
 * WP-549 was live at the origin (`index.html` served the fixed bundle with
 * `Cache-Control: max-age=0, must-revalidate` and `cf-cache-status: DYNAMIC`, so
 * NOT the CDN edge-poisoning pattern), but the browser served a pre-fix bundle
 * and the new control was absent. Two exchanges plus a `curl` of the deployed
 * bundle were spent before the staleness was traced browser-side. This module is
 * the missing detection layer: it compares the build baked into the running tab
 * (`__GIT_SHA__`) against the sha the origin currently serves in `version.json`.
 *
 * The comparison ({@link isNewerBuildAvailable}) is pure and dependency-free so
 * it can be unit-tested in isolation. The fetch ({@link fetchDeployedSha}) is
 * fail-soft by contract: any error, a missing file, or an unparseable body
 * resolves to `null` (no update signal) — a network blip must NEVER produce a
 * false "update available". A banner that cries wolf is worse than no banner.
 *
 * why: DUPLICATED from `apps/arena-client/src/lib/deployVersion.ts` (WP-418 /
 * D-24238) rather than extracted into a shared package. registry-viewer is only
 * the SECOND consumer, and `.claude/rules/code-style.md` §Abstraction is
 * duplicate-first / abstract-on-third — extract when a THIRD app needs it.
 *
 * Authority: WP-552 §7; EC-587; D-24361; ports WP-418 / EC-453 / D-24238.
 */

/**
 * This app's own build-stamped static asset, emitted into the build output by
 * the `emitVersionJsonPlugin` in `vite.config.ts`. Fetched from the page origin
 * (Cloudflare Pages), never from the API server — the viewer deploys
 * independently, so only its own asset reports its bundle's sha.
 */
export const DEPLOY_VERSION_URL = "/version.json";

/** The shape of the emitted `version.json`. */
export interface DeployVersion {
  /** The short git sha of the build, matching the baked `__GIT_SHA__`. */
  readonly gitSha: string;
}

/**
 * Pure comparison: is the deployed build different from the one baked into the
 * running tab?
 *
 * Returns `true` ONLY when both shas are non-empty strings and they differ. Any
 * empty or missing sha on EITHER side returns `false`.
 *
 * why: `bakedSha` is a REQUIRED parameter with no `__GIT_SHA__` default. Vite's
 * `define` does not apply under `node --import tsx --test`, so a default would
 * throw `ReferenceError: __GIT_SHA__ is not defined` the moment a plain `.ts`
 * test imported this module. The caller (the composable) supplies it.
 *
 * @param bakedSha - The sha compiled into the running tab (`__GIT_SHA__`).
 * @param fetchedSha - The sha the origin is currently serving.
 * @returns True iff a genuinely different, non-empty build is deployed.
 */
export function isNewerBuildAvailable(
  bakedSha: string | null | undefined,
  fetchedSha: string | null | undefined,
): boolean {
  // why: fail-soft — treat any empty / missing sha on EITHER side as "no signal".
  // An update prompt is only justified when two real, non-empty builds can be
  // positively compared; anything less could reload a tab for no reason.
  if (typeof bakedSha !== "string" || bakedSha === "") {
    return false;
  }
  if (typeof fetchedSha !== "string" || fetchedSha === "") {
    return false;
  }
  return bakedSha !== fetchedSha;
}

/**
 * Fetch the currently-deployed build sha from `version.json`, or `null` if it
 * cannot be read.
 *
 * Fail-soft by contract: a network rejection, a non-200 response, a missing
 * file, or an unparseable / sha-less body all resolve to `null` — never a throw,
 * never a spurious sha. The caller treats `null` as "no update signal".
 *
 * @returns The deployed short git sha, or null when it cannot be determined.
 */
export async function fetchDeployedSha(): Promise<string | null> {
  let response: Response;
  try {
    // why: `cache: 'no-store'` is the cache-bust — it bypasses the browser HTTP
    // cache so a tab left open across a deploy reads the freshly-served file
    // rather than a stale copy. version.json is a few bytes; re-fetching is cheap.
    response = await fetch(DEPLOY_VERSION_URL, { cache: "no-store" });
  } catch {
    // why: fail-soft — a transient fetch rejection (offline, DNS blip) is not a
    // deploy; swallow it and let the next trigger retry. Never a false positive.
    return null;
  }
  if (response.status !== 200) {
    return null;
  }
  let body: DeployVersion;
  try {
    body = (await response.json()) as DeployVersion;
  } catch {
    // why: a non-JSON body is the EXACT pre-fix symptom this WP exists to detect
    // — before the emit plugin, `/version.json` returned the SPA fallback HTML.
    // Treat it as no-signal rather than letting a parse error escape.
    return null;
  }
  if (typeof body?.gitSha !== "string" || body.gitSha === "") {
    return null;
  }
  return body.gitSha;
}
