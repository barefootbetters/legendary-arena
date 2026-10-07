/**
 * Build provenance for the diagnostics and game-log exports.
 *
 * The client (Cloudflare Pages) and the game server (Render) deploy
 * independently, and a match keeps the card rules built at its setup for its
 * whole life. So the client's own `__GIT_SHA__` alone cannot say which rules a
 * match is running: a tab can pick up a new client mid-match while the match
 * still runs rules from an older server build. This module records the three
 * facts that answer it — the client build, the server build currently running
 * (`GET /api/version`, whose `buildTimestamp` is the server's boot time,
 * D-18001), and when the match was created (`GET /games/legendary-arena/:id`
 * `createdAt`, the public boardgame.io lobby read) — and flags a match created
 * before the running server booted.
 *
 * The builders are pure. The fetch is fail-soft by contract: any network error,
 * non-OK status or unparseable body becomes `null` for that fact, never a throw,
 * so an export never fails because a version probe did.
 */

/** The client build baked into the running tab. */
export interface ClientBuild {
  /** The short git sha baked in at build time (`__GIT_SHA__`). */
  readonly gitSha: string;
  /** The ISO build time baked in at build time (`__BUILD_TIMESTAMP__`). */
  readonly buildTimestamp: string;
}

/** The server build reported by `GET /api/version`. */
export interface ServerBuild {
  /** The short git sha the server process is running. */
  readonly gitSha: string;
  /** The ISO time the server process booted (the server's `buildTimestamp`, D-18001). */
  readonly bootedAtIso: string;
}

/** The build facts attached to an export. */
export interface BuildProvenance {
  readonly clientGitSha: string;
  readonly clientBuildTimestamp: string;
  /** The running server's sha, or null when the version probe failed. */
  readonly serverGitSha: string | null;
  /** The running server's boot time, or null when the version probe failed. */
  readonly serverBootedAtIso: string | null;
  /** The match id the facts were collected for, or null outside a match. */
  readonly matchId: string | null;
  /** When the match was created, or null when unknown. */
  readonly matchCreatedAtIso: string | null;
  /**
   * True when the match was created before the running server booted, so it may
   * be running card rules from an earlier build. Null when either time is unknown.
   */
  readonly isMatchOlderThanServer: boolean | null;
}

/** Minimal `fetch` signature, injectable for tests. */
export type FetchLike = (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/**
 * Combines the collected facts into a provenance record.
 *
 * @param clientBuild The client build baked into the tab.
 * @param serverBuild The running server build, or null when unknown.
 * @param matchId The match id, or null outside a match.
 * @param matchCreatedAtMs The match creation time in epoch ms, or null when unknown.
 * @returns The provenance record.
 */
export function buildProvenanceRecord(
  clientBuild: ClientBuild,
  serverBuild: ServerBuild | null,
  matchId: string | null,
  matchCreatedAtMs: number | null,
): BuildProvenance {
  let matchCreatedAtIso: string | null = null;
  if (matchCreatedAtMs !== null) {
    matchCreatedAtIso = new Date(matchCreatedAtMs).toISOString();
  }
  let isMatchOlderThanServer: boolean | null = null;
  if (matchCreatedAtMs !== null && serverBuild !== null) {
    const bootedAtMs = Date.parse(serverBuild.bootedAtIso);
    if (!Number.isNaN(bootedAtMs)) {
      isMatchOlderThanServer = matchCreatedAtMs < bootedAtMs;
    }
  }
  return {
    clientGitSha: clientBuild.gitSha,
    clientBuildTimestamp: clientBuild.buildTimestamp,
    serverGitSha: serverBuild === null ? null : serverBuild.gitSha,
    serverBootedAtIso: serverBuild === null ? null : serverBuild.bootedAtIso,
    matchId,
    matchCreatedAtIso,
    isMatchOlderThanServer,
  };
}

/**
 * Formats the provenance as `#`-prefixed header lines for the plain-text game log.
 * Returns no lines when no provenance was collected, so the transcript is unchanged.
 *
 * @param provenance The collected provenance, or null when none was collected.
 * @returns The header lines (without trailing newlines).
 */
export function formatProvenanceHeaderLines(provenance: BuildProvenance | null): string[] {
  if (provenance === null) {
    return [];
  }
  const lines: string[] = [];
  lines.push(`# Legendary Arena game log — match ${provenance.matchId ?? 'unknown'}`);
  lines.push(`# Client build: ${provenance.clientGitSha} (built ${provenance.clientBuildTimestamp})`);
  if (provenance.serverGitSha !== null && provenance.serverBootedAtIso !== null) {
    lines.push(`# Server build: ${provenance.serverGitSha} (running since ${provenance.serverBootedAtIso})`);
  } else {
    lines.push('# Server build: unknown (the version check did not answer)');
  }
  lines.push(`# Match created: ${provenance.matchCreatedAtIso ?? 'unknown'}`);
  if (provenance.isMatchOlderThanServer === true) {
    lines.push(
      '# Note: this match was created before the running server started, so it may be using card rules from an earlier build.',
    );
  }
  return lines;
}

/**
 * Reads the running server's build from `GET /api/version`.
 *
 * @param serverBaseUrl The game server origin.
 * @param fetchImpl The fetch implementation.
 * @returns The server build, or null on any failure.
 */
async function fetchServerBuild(serverBaseUrl: string, fetchImpl: FetchLike): Promise<ServerBuild | null> {
  try {
    const response = await fetchImpl(`${serverBaseUrl}/api/version`);
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { gitSha?: unknown; buildTimestamp?: unknown };
    if (typeof body.gitSha !== 'string' || typeof body.buildTimestamp !== 'string') {
      return null;
    }
    return { gitSha: body.gitSha, bootedAtIso: body.buildTimestamp };
  } catch (versionError) {
    // why: fail-soft — a version probe failure must never break an export; the
    // header then says the server build is unknown.
    return null;
  }
}

/**
 * Reads the match creation time from the public lobby read
 * `GET /games/legendary-arena/:id`.
 *
 * @param serverBaseUrl The game server origin.
 * @param matchId The match id.
 * @param fetchImpl The fetch implementation.
 * @returns The creation time in epoch ms, or null on any failure.
 */
async function fetchMatchCreatedAtMs(
  serverBaseUrl: string,
  matchId: string,
  fetchImpl: FetchLike,
): Promise<number | null> {
  try {
    const response = await fetchImpl(`${serverBaseUrl}/games/legendary-arena/${encodeURIComponent(matchId)}`);
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { createdAt?: unknown };
    if (typeof body.createdAt !== 'number' || !Number.isFinite(body.createdAt)) {
      return null;
    }
    return body.createdAt;
  } catch (matchError) {
    // why: fail-soft — an unknown creation time only drops the "older than the
    // server" note; the rest of the header still renders.
    return null;
  }
}

/**
 * Collects the build provenance for a match. Never throws.
 *
 * @param serverBaseUrl The game server origin.
 * @param matchId The match id, or null outside a match.
 * @param clientBuild The client build baked into the tab.
 * @param fetchImpl The fetch implementation.
 * @returns The provenance record.
 */
export async function collectBuildProvenance(
  serverBaseUrl: string,
  matchId: string | null,
  clientBuild: ClientBuild,
  fetchImpl: FetchLike,
): Promise<BuildProvenance> {
  const serverBuild = await fetchServerBuild(serverBaseUrl, fetchImpl);
  let matchCreatedAtMs: number | null = null;
  if (matchId !== null && matchId !== '') {
    matchCreatedAtMs = await fetchMatchCreatedAtMs(serverBaseUrl, matchId, fetchImpl);
  }
  return buildProvenanceRecord(clientBuild, serverBuild, matchId, matchCreatedAtMs);
}
