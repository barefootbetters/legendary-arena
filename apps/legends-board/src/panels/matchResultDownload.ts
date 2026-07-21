/**
 * Portable match-LAGN download (WP-408 / D-24218).
 *
 * Fetches a completed match's result LAGN from the WP-406 producer and hands the
 * bytes to the user as a `.lagn.json` download — the self-describing-artifact half
 * of the Hall of Legends arc.
 *
 * why: EXPORT-ONLY (D-24218 / D-5301). The downloaded file is a portable COPY of
 * the server-produced record; **nothing on the platform re-ingests it** to score,
 * credit, or rank — competitive outcomes stay `matchId -> blob -> re-execute ->
 * AccountId`, server-side. A user could edit the file, but it is never read back as
 * authority, exactly as `players[]` / `scoring_profile` are descriptive
 * (D-24214 / D-24215). Offering the export adds no ingest path and no trust surface.
 *
 * why: fetch functions are not unit-tested (they depend on `import.meta.env` +
 * DOM, which `node:test` cannot supply — see `snapshotClient.test.ts`); the pure
 * `buildLagnFilename` / `serializeLagnDocument` helpers below are tested in
 * `matchResultDownload.test.ts`, and the Blob/anchor trigger is verified in the
 * dev-server smoke.
 */

import { buildResultLagnUrl } from "./matchResultDisplay";

// why: 10-second timeout, matching snapshotClient / matchResultClient — a stalled
// edge must not hang the download indefinitely.
const FETCH_TIMEOUT_MS = 10_000;

/** Build the download filename for a match's portable LAGN: `match-<id>.lagn.json`. */
export function buildLagnFilename(matchId: string): string {
  return `match-${matchId}.lagn.json`;
}

/** Serialize a result-LAGN document for download (pretty-printed JSON). */
export function serializeLagnDocument(lagn: unknown): string {
  return JSON.stringify(lagn, null, 2);
}

/** Returns the server API base URL from the build-time env var. */
function getApiBaseUrl(): string {
  const baseUrl = import.meta.env.VITE_LEGENDS_API_BASE_URL;
  if (!baseUrl) {
    throw new Error(
      "VITE_LEGENDS_API_BASE_URL is not set. Configure this environment variable " +
        "to point at the server API origin (e.g. https://play.legendary-arena.com).",
    );
  }
  return baseUrl;
}

/**
 * Fetch the raw result-LAGN document — the endpoint's `lagn` payload, byte-for-byte
 * as WP-406 already `validate()`d it. Throws on any non-OK response; the download
 * control only appears on a match that already returned a result, so a failure here
 * is transient and surfaces as the panel's visible error state.
 */
async function fetchResultLagnDocument(matchId: string): Promise<unknown> {
  const url = buildResultLagnUrl(getApiBaseUrl(), matchId);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(
        `Match result fetch failed for ${url}: HTTP ${response.status} ${response.statusText}`,
      );
    }
    const body = (await response.json()) as { lagn?: unknown };
    return body.lagn;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch a completed match's result LAGN and trigger a browser download of it as
 * `match-<id>.lagn.json` (MIME `application/json`).
 *
 * why: a client Blob + object URL, NOT a new server endpoint — it reuses WP-406's
 * existing read and hands the already-validated bytes to the user, so the export
 * adds no server surface.
 *
 * Throws on fetch failure so the caller shows a visible full-sentence error — the
 * control is never a silent no-op.
 *
 * @param matchId The completed match's id.
 */
export async function downloadMatchLagn(matchId: string): Promise<void> {
  const lagn = await fetchResultLagnDocument(matchId);
  const blob = new Blob([serializeLagnDocument(lagn)], {
    type: "application/json",
  });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = buildLagnFilename(matchId);
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // why: revoke the object URL after the click so the Blob is not leaked for the
    // page's lifetime.
    URL.revokeObjectURL(objectUrl);
  }
}
