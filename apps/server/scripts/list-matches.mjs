#!/usr/bin/env node

/**
 * CLI script to list available matches on the running Legendary Arena server.
 *
 * Usage:
 *   node apps/server/scripts/list-matches.mjs [--server <url>]
 *
 * Fetches the match list from the boardgame.io lobby API and prints a JSON
 * summary to stdout. Each entry shows matchID, player slot count, setupData
 * presence, and gameover status.
 *
 * Uses Node v22+ built-in fetch — no external HTTP packages.
 * ESM module.
 */

import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const DEFAULT_SERVER_URL = 'http://localhost:8000';

/**
 * Parses CLI arguments for the list-matches script.
 *
 * @param {string[]} [args] - Argument array; defaults to process.argv.slice(2).
 * @returns {{ serverUrl: string }}
 */
export function parseListMatchesArguments(args = process.argv.slice(2)) {
  const { values } = parseArgs({
    options: {
      server: { type: 'string' },
    },
    args,
  });

  return { serverUrl: values.server || DEFAULT_SERVER_URL };
}

/**
 * Fetches the list of matches from the boardgame.io lobby API and returns
 * a summary array.
 *
 * @param {string} serverUrl - Base URL of the boardgame.io server.
 * @returns {Promise<Array<{ matchID: string, players: number, hasSetupData: boolean, gameover: unknown }>>}
 */
export async function fetchMatchList(serverUrl) {
  // why: boardgame.io exposes match listing at GET /games/<gameName> by default
  const response = await fetch(`${serverUrl}/games/legendary-arena`);

  if (!response.ok) {
    throw new Error(
      `Server returned HTTP ${response.status} when listing matches.`
    );
  }

  const body = await response.json();

  // why: boardgame.io returns { matches: [...] } from the lobby list endpoint
  const matches = body.matches || body;

  const summary = [];
  for (const match of matches) {
    summary.push({
      matchID: match.matchID,
      players: match.players?.length ?? 0,
      hasSetupData: match.setupData != null,
      gameover: match.gameover ?? null,
    });
  }

  return summary;
}

// ── Main ───────────────────────────────────────────────────────────────────

const isMainModule =
  process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const { serverUrl } = parseListMatchesArguments();

  try {
    const matches = await fetchMatchList(serverUrl);
    console.log(JSON.stringify(matches, null, 2));
  } catch (error) {
    console.error(
      `Failed to list matches from ${serverUrl}: ${error.message}`
    );
    process.exit(1);
  }
}
