/**
 * buildStamp.ts — the player-readable build stamp shown in the brand footer.
 *
 * The footer used to print `v0.1.0 · <short git sha> · <date>`: the sha means
 * nothing to a player, and the date alone could not tell two deploys on the same
 * day apart. This module turns the build-time constants into a label a player can
 * read ("v0.1.0 · Updated Oct 29, 2026, 1:57 PM MDT") and keeps the sha as
 * secondary detail in the tooltip, where support can still ask for it.
 *
 * Pure: no I/O, no clock reads. The time zone is a parameter so tests can pin it;
 * in the browser it is left undefined, which formats in the viewer's local zone.
 */

/** The display pieces of the build stamp. */
export interface BuildStamp {
  /** The version label, e.g. `v0.1.0`. */
  readonly versionLabel: string;
  /** The formatted build time, e.g. `Oct 29, 2026, 1:57 PM MDT`; `''` when the timestamp is unreadable. */
  readonly updatedLabel: string;
  /** The ISO build time, for a `<time datetime>` attribute; `''` when unreadable. */
  readonly updatedIso: string;
  /** The hover detail naming the exact build (short sha and ISO build time). */
  readonly tooltip: string;
}

/**
 * Formats an ISO timestamp as a short, readable date and time with the zone name,
 * e.g. `Oct 29, 2026, 1:57 PM MDT`.
 *
 * @param isoTimestamp The ISO timestamp to format.
 * @param timeZone The IANA zone to format in; undefined means the viewer's local zone.
 * @returns The formatted time, or `''` when the timestamp cannot be parsed.
 */
export function formatReadableTimestamp(isoTimestamp: string, timeZone?: string): string {
  const epochMs = Date.parse(isoTimestamp);
  if (Number.isNaN(epochMs)) {
    return '';
  }
  // why: en-US matches the rest of the client's date copy; the zone name is
  // included because a player comparing "updated 1:57 PM" against a match start
  // time needs to know both are in the same zone.
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    timeZone,
  });
  return formatter.format(new Date(epochMs));
}

/**
 * Builds the footer's build stamp from the build-time constants.
 *
 * @param appVersion The package version (`__APP_VERSION__`).
 * @param buildTimestampIso The ISO build time (`__BUILD_TIMESTAMP__`).
 * @param gitSha The short git sha (`__GIT_SHA__`).
 * @param timeZone The IANA zone to format in; undefined means the viewer's local zone.
 * @returns The stamp's display pieces.
 */
export function formatBuildStamp(
  appVersion: string,
  buildTimestampIso: string,
  gitSha: string,
  timeZone?: string,
): BuildStamp {
  const updatedLabel = formatReadableTimestamp(buildTimestampIso, timeZone);
  let updatedIso = '';
  if (updatedLabel !== '') {
    updatedIso = new Date(Date.parse(buildTimestampIso)).toISOString();
  }
  let tooltip = `Build ${gitSha}`;
  if (updatedIso !== '') {
    tooltip = `Build ${gitSha}, built ${updatedIso}`;
  }
  return {
    versionLabel: `v${appVersion}`,
    updatedLabel,
    updatedIso,
    tooltip,
  };
}
