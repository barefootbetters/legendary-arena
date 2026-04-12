#!/usr/bin/env node

/**
 * CLI script to join an existing match on the running Legendary Arena server.
 *
 * Usage:
 *   node apps/server/scripts/join-match.mjs --match <matchID> --name <playerName> [--server <url>]
 *
 * POSTs to the boardgame.io lobby join endpoint. On success, prints a JSON
 * object with matchID, playerID, and credentials to stdout. The caller is
 * responsible for storing credentials — this script never writes them to disk.
 *
 * Uses Node v22+ built-in fetch — no external HTTP packages.
 * ESM module.
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const DEFAULT_SERVER_URL = 'http://localhost:8000';

/**
 * Parses CLI arguments for the join-match script.
 *
 * @param {string[]} [args] - Argument array; defaults to process.argv.slice(2).
 * @returns {{ serverUrl: string, matchIdentifier: string, playerName: string }}
 * @throws {Error} If required arguments are missing.
 */
export function parseJoinMatchArguments(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    options: {
      match: { type: 'string' },
      name: { type: 'string' },
      server: { type: 'string' },
    },
    args,
  });

  if (!values.match) {
    throw new Error(
      'Missing required argument: --match <matchID>. Provide the ID of the match to join.'
    );
  }

  if (!values.name) {
    throw new Error(
      'Missing required argument: --name <playerName>. Provide the display name for this player.'
    );
  }

  return {
    serverUrl: values.server || DEFAULT_SERVER_URL,
    matchIdentifier: values.match,
    playerName: values.name,
  };
}

/**
 * Joins a match by POSTing to the boardgame.io lobby join endpoint.
 *
 * @param {string} serverUrl - Base URL of the boardgame.io server.
 * @param {string} matchIdentifier - The matchID to join.
 * @param {string} playerName - Display name for the joining player.
 * @returns {Promise<{ matchID: string, playerID: string, credentials: string }>}
 */
export async function joinMatch(serverUrl, matchIdentifier, playerName) {
  // why: boardgame.io exposes match joining at POST /games/<gameName>/<matchID>/join by default
  const joinUrl = `${serverUrl}/games/legendary-arena/${matchIdentifier}/join`;

  const response = await fetch(joinUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName }),
  });

  if (!response.ok) {
    const errorBody = await response.text();

    if (response.status === 409) {
      throw new Error(
        `Match ${matchIdentifier} is full or has already started (HTTP 409): ${errorBody}`
      );
    }

    throw new Error(
      `Server returned HTTP ${response.status} when joining match ${matchIdentifier}: ${errorBody}`
    );
  }

  const result = await response.json();

  const output = {
    matchID: matchIdentifier,
    playerID: result.playerID,
    credentials: result.credentials,
  };

  // why: some boardgame.io versions include matchID in the join response — preserve it if present
  if (result.matchID) {
    output.matchID = result.matchID;
  }

  return output;
}

// ── Main ───────────────────────────────────────────────────────────────────

const isMainModule =
  process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  let parsed;
  try {
    parsed = parseJoinMatchArguments();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const { serverUrl, matchIdentifier, playerName } = parsed;

  try {
    const result = await joinMatch(serverUrl, matchIdentifier, playerName);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      `Failed to join match ${matchIdentifier}: ${error.message}`
    );
    process.exit(1);
  }
}
