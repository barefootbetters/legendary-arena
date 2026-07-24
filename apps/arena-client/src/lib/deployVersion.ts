/**
 * deployVersion.ts — arena-client deploy-freshness helpers (WP-418 / EC-453 / D-24238).
 *
 * When a deploy lands mid-match, Cloudflare Pages swaps the hashed asset chunks
 * an already-open tab references. The open tab keeps running its now-stale JS
 * bundle: any lazy-loaded chunk 404s and the board can freeze or paint blank
 * tiles. The reconnect / resync stack in `client/bgioClient.ts` re-anchors MATCH
 * STATE, but it cannot fix a stale JS BUNDLE — only a page reload does. This
 * module is the missing detection layer: it compares the build baked into the
 * running tab (`__GIT_SHA__`) against the sha the server is currently serving in
 * `version.json`, so the play surface can offer a reload.
 *
 * The comparison ({@link isNewerBuildAvailable}) is a pure, dependency-free
 * function so it can be unit-tested in isolation. The fetch ({@link
 * fetchDeployedSha}) is fail-soft by contract: any error, a missing file, or an
 * unparseable body resolves to `null` (no update signal) — a network blip must
 * NEVER produce a false "update available".
 *
 * Authority: WP-418 §Scope (In) §A; EC-453; D-24238; mirrors the read-only
 * status-surface posture of `components/ConnectionStatusBanner.vue` (WP-311).
 */

/**
 * The client's own build-stamped static asset, emitted into the build output by
 * the `emitVersionJsonPlugin` in `vite.config.ts`. Fetched from the page origin
 * (Cloudflare Pages), NOT from the API server — the client (Pages) and the
 * server (Render) deploy independently, so only the client's own asset reports
 * the client bundle's sha.
 */
export const DEPLOY_VERSION_URL = '/version.json';

/** The shape of the emitted `version.json`. */
export interface DeployVersion {
  /** The short git sha of the build, matching the baked `__GIT_SHA__`. */
  readonly gitSha: string;
}

/**
 * Pure comparison: is the deployed build newer than (different from) the one
 * baked into the running tab?
 *
 * Returns `true` ONLY when both shas are non-empty strings and they differ. Any
 * empty / missing sha (either side) returns `false` — the fail-soft guarantee,
 * so a build with an `'unknown'`-less but empty stamp, or a failed fetch that
 * surfaced an empty string, can never flash a spurious banner.
 *
 * @param bakedSha The sha compiled into the running tab (`__GIT_SHA__`).
 * @param fetchedSha The sha the server is currently serving (from `version.json`).
 * @returns `true` iff a genuinely different, non-empty build is deployed.
 */
export function isNewerBuildAvailable(
  bakedSha: string | null | undefined,
  fetchedSha: string | null | undefined,
): boolean {
  // why: fail-soft — treat any empty / missing sha on EITHER side as "no signal".
  // An update prompt is only justified when we can positively compare two real,
  // non-empty builds; anything less could reload a tab for no reason.
  if (typeof bakedSha !== 'string' || bakedSha === '') {
    return false;
  }
  if (typeof fetchedSha !== 'string' || fetchedSha === '') {
    return false;
  }
  return bakedSha !== fetchedSha;
}

/**
 * Fetch the currently-deployed build sha from `version.json`, or `null` if it
 * cannot be read.
 *
 * Fail-soft by contract: a network error, a non-200 response, a missing file, or
 * an unparseable / sha-less body all resolve to `null` (never a throw, never a
 * spurious sha). The caller treats `null` as "no update signal".
 *
 * @returns The deployed short git sha, or `null` when it cannot be determined.
 */
export async function fetchDeployedSha(): Promise<string | null> {
  let response: Response;
  try {
    // why: `cache: 'no-store'` is the cache-bust — it bypasses the browser HTTP
    // cache so a tab left open across a deploy reads the freshly-served file, not
    // a stale cached copy. version.json is a few bytes, so re-fetching it is cheap.
    response = await fetch(DEPLOY_VERSION_URL, { cache: 'no-store' });
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
    return null;
  }
  if (typeof body?.gitSha !== 'string' || body.gitSha === '') {
    return null;
  }
  return body.gitSha;
}
