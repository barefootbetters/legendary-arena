/**
 * The server's boardgame.io game object, with a high-entropy match seed
 * (WP-809 / D-24715).
 *
 * boardgame.io 0.50.2 seeds a match from `game.seed`, or, when that is
 * undefined, from `Date.now().toString(36)`. The lobby API returns the match
 * metadata, whose `createdAt` is stamped by `Date.now()` a fraction of a
 * millisecond earlier, so the default seed was recoverable from public data.
 * This module gives the processed `LegendaryGame` a `seed` getter that returns
 * fresh random bytes on every read, so every match boardgame.io creates gets
 * its own unguessable seed.
 *
 * The seed is still persisted in the match's initial state
 * (`plugins.random.data.seed`), so replay from the stored initial state is
 * unchanged (D-24119). The socket `sync` answer no longer carries that initial
 * state (`syncRedaction.mjs`), so the seed never reaches a client.
 */

import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

import { LegendaryGame } from '@legendary-arena/game-engine';

// why: boardgame.io v0.50 ships /internal as CJS only; createRequire bridges
// ESM → CJS (the same bridge autoplay.mjs and botAllyRoutes.mjs used).
const require = createRequire(import.meta.url);
const { ProcessGameConfig } = require('boardgame.io/internal');

// why: 16 bytes = 128 bits, far beyond any brute-force search; hex keeps the
// seed a plain ASCII string for boardgame.io's PRNG and any later export.
const MATCH_SEED_BYTE_LENGTH = 16;

/**
 * Mints a new high-entropy match seed.
 *
 * @returns {string} 32 lowercase hex characters.
 */
export function mintMatchSeed() {
  return randomBytes(MATCH_SEED_BYTE_LENGTH).toString('hex');
}

/**
 * The processed `LegendaryGame` every server path that creates or drives a
 * match hands to boardgame.io (`Server`, `Master`). Both re-run boardgame.io's
 * game processing, which returns an already-processed game unchanged, so the
 * getter below survives.
 */
export const serverLegendaryGame = ProcessGameConfig(LegendaryGame);

// why: D-24715. boardgame.io 0.50 has no per-match seed hook; its random plugin
// reads `game.seed` exactly once per InitializeGame, so a getter is the only
// seam that yields a fresh seed for each match without patching the framework.
// The getter must sit on the PROCESSED object: game processing copies an
// unprocessed game, which would read the getter once and freeze one value.
// Enumerable, so a copy keeps a random (not a clock) seed; a caller that needs
// a specific seed (replay, a future seed challenge) overrides `seed` in a copy,
// and a bare copy freezes one seed (D-24715). The object is processed by the
// `boardgame.io/internal` bundle but driven by `boardgame.io/server`'s own
// bundled reducer and Master; they interoperate by duck typing (`flow`,
// `processMove`), which the production-wiring socket test locks.
Object.defineProperty(serverLegendaryGame, 'seed', {
  get: mintMatchSeed,
  enumerable: true,
});
