#!/usr/bin/env node

/**
 * CLI script to create a match against the running Legendary Arena server.
 *
 * Usage:
 *   node apps/server/scripts/create-match.mjs --players <count> --setup <path-to-setup.json>
 *
 * Reads a MatchSetupConfig JSON file, validates it, then POSTs to the
 * boardgame.io create endpoint. Prints the matchID and player credentials
 * on success.
 *
 * Uses Node v22+ built-in fetch — no external HTTP packages.
 * ESM module.
 */

import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

/**
 * Parses CLI arguments and returns the player count and setup file path.
 *
 * @returns {{ players: number, setupPath: string }}
 */
function parseCli() {
  const { values } = parseArgs({
    options: {
      players: { type: 'string', short: 'p' },
      setup: { type: 'string', short: 's' },
    },
  });

  if (!values.players) {
    console.error('Missing required argument: --players <count>');
    process.exit(1);
  }

  if (!values.setup) {
    console.error('Missing required argument: --setup <path-to-setup.json>');
    process.exit(1);
  }

  const playerCount = Number(values.players);
  if (!Number.isFinite(playerCount) || playerCount < 1 || playerCount > 5) {
    console.error('The --players argument must be an integer between 1 and 5.');
    process.exit(1);
  }

  return { players: playerCount, setupPath: values.setup };
}

/**
 * Reads and parses the setup JSON file.
 *
 * @param {string} filePath - Path to the MatchSetupConfig JSON file.
 * @returns {Promise<object>} The parsed setup configuration.
 */
async function loadSetupConfig(filePath) {
  try {
    const fileContents = await readFile(filePath, 'utf-8');
    return JSON.parse(fileContents);
  } catch (error) {
    console.error(`Failed to read or parse the setup file at "${filePath}": ${error.message}`);
    process.exit(1);
  }
}

/**
 * Creates a match on the running server and joins all players.
 *
 * @param {number} playerCount - Number of players for the match.
 * @param {object} setupData - The MatchSetupConfig payload.
 */
async function createMatch(playerCount, setupData) {
  const serverUrl = 'http://localhost:8000';
  const gameName = 'legendary-arena';

  // Step 1: Create the match
  let createResponse;
  try {
    createResponse = await fetch(`${serverUrl}/games/${gameName}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        numPlayers: playerCount,
        setupData,
      }),
    });
  } catch (error) {
    console.error(`Network error while creating match: ${error.message}`);
    process.exit(1);
  }

  if (!createResponse.ok) {
    const errorBody = await createResponse.text();
    console.error(`Server returned ${createResponse.status} when creating match: ${errorBody}`);
    process.exit(1);
  }

  const createResult = await createResponse.json();
  const matchId = createResult.matchID;
  console.log(`Match created: ${matchId}`);

  // Step 2: Join all players
  const credentials = [];
  for (let playerIndex = 0; playerIndex < playerCount; playerIndex++) {
    let joinResponse;
    try {
      joinResponse = await fetch(`${serverUrl}/games/${gameName}/${matchId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerID: String(playerIndex),
          playerName: `Player ${playerIndex}`,
        }),
      });
    } catch (error) {
      console.error(`Network error while joining player ${playerIndex}: ${error.message}`);
      process.exit(1);
    }

    if (!joinResponse.ok) {
      const errorBody = await joinResponse.text();
      console.error(`Server returned ${joinResponse.status} when joining player ${playerIndex}: ${errorBody}`);
      process.exit(1);
    }

    const joinResult = await joinResponse.json();
    credentials.push({
      playerID: String(playerIndex),
      playerCredentials: joinResult.playerCredentials,
    });
  }

  console.log('\nPlayer credentials:');
  console.log(JSON.stringify(credentials, null, 2));
}

// ── Main ───────────────────────────────────────────────────────────────────

const { players, setupPath } = parseCli();
const setupData = await loadSetupConfig(setupPath);
await createMatch(players, setupData);
