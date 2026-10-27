/**
 * High-entropy match seed (WP-809 / D-24715).
 *
 * Run by the server test runner: `node --import tsx --test src/**\/*.test.ts`.
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { LegendaryGame } from '@legendary-arena/game-engine';
import { mintMatchSeed, serverLegendaryGame } from './matchSeed.mjs';

const require = createRequire(import.meta.url);
const { ProcessGameConfig, InitializeGame, createMatch } = require('boardgame.io/internal');
const { Server } = require('boardgame.io/server');

const SEED_PATTERN = /^[0-9a-f]{32}$/;

// why: the same test ids and empty-registry setup clientActionGuard.test.ts uses.
const SETUP_DATA = {
  schemeId: 'test-scheme-001',
  mastermindId: 'test-mastermind-001',
  villainGroupIds: ['test-villain-group-001'],
  henchmanGroupIds: ['test-henchman-group-001'],
  heroDeckIds: ['test-hero-deck-001', 'test-hero-deck-002'],
  bystandersCount: 10,
  woundsCount: 15,
  officersCount: 20,
  sidekicksCount: 5,
};

describe('boardgame.io default seed (the exposure D-24715 closes)', () => {
  // why: an exposure pin. It documents boardgame.io 0.50.2's clock seed, the
  // reason serverLegendaryGame exists; if an upgrade changes the default, this
  // fails and says so, and D-24715 is re-read against the new behaviour.
  it('an unseeded game mints base36(Date.now()) within ms of the public createdAt', () => {
    const stockGame = ProcessGameConfig({ ...LegendaryGame });
    const match = createMatch({ game: stockGame, numPlayers: 1, setupData: SETUP_DATA });
    const seedMilliseconds = parseInt(match.initialState.plugins.random.data.seed, 36);
    const gap = seedMilliseconds - match.metadata.createdAt;
    assert.ok(gap >= 0 && gap <= 50, `seed is createdAt + ${gap} ms`);
  });
});

describe('mintMatchSeed', () => {
  it('returns 32 lowercase hex characters, different each call', () => {
    const first = mintMatchSeed();
    const second = mintMatchSeed();
    assert.match(first, SEED_PATTERN);
    assert.match(second, SEED_PATTERN);
    assert.notEqual(first, second);
  });
});

describe('serverLegendaryGame', () => {
  it('survives re-processing, as Server() and Master re-run ProcessGameConfig', () => {
    assert.equal(ProcessGameConfig(serverLegendaryGame), serverLegendaryGame);
  });

  it('gives each created match its own random seed, unrelated to createdAt', () => {
    const first = createMatch({ game: serverLegendaryGame, numPlayers: 1, setupData: SETUP_DATA });
    const second = createMatch({ game: serverLegendaryGame, numPlayers: 1, setupData: SETUP_DATA });
    const firstSeed = first.initialState.plugins.random.data.seed;
    const secondSeed = second.initialState.plugins.random.data.seed;
    assert.match(firstSeed, SEED_PATTERN);
    assert.match(secondSeed, SEED_PATTERN);
    assert.notEqual(firstSeed, secondSeed);
  });

  it('still reproduces a board exactly when a caller pins the seed', () => {
    const pinnedGame = { ...serverLegendaryGame, seed: 'pinned-seed-001' };
    const first = InitializeGame({ game: pinnedGame, numPlayers: 1, setupData: SETUP_DATA });
    const second = InitializeGame({ game: pinnedGame, numPlayers: 1, setupData: SETUP_DATA });
    assert.equal(first.plugins.random.data.seed, 'pinned-seed-001');
    assert.deepEqual(first.G, second.G);
  });
});

describe('the native lobby create route', () => {
  const runningServers: Array<{ server: { kill: (handles: unknown) => void }; handles: unknown }> = [];
  after(() => {
    for (const running of runningServers) {
      running.server.kill(running.handles);
    }
  });

  it('stores a random seed for every match POST /games/:name/create makes', async () => {
    const server = Server({ games: [serverLegendaryGame] });
    const handles = await server.run({ port: 0 });
    runningServers.push({ server, handles });
    const port = handles.appServer.address().port;
    const seeds: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`http://localhost:${port}/games/${LegendaryGame.name}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numPlayers: 1, setupData: SETUP_DATA }),
      });
      assert.equal(response.status, 200);
      const { matchID } = await response.json();
      const stored = server.db.fetch(matchID, { initialState: true, metadata: true });
      const seed = stored.initialState.plugins.random.data.seed;
      assert.match(seed, SEED_PATTERN);
      assert.notEqual(seed, stored.metadata.createdAt.toString(36));
      seeds.push(seed);
    }
    assert.notEqual(seeds[0], seeds[1]);
  });
});
