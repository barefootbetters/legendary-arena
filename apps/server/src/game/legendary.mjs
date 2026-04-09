/**
 * Legendary Game Definition — Minimal Wiring
 *
 * This file provides a structurally correct boardgame.io Game() definition
 * that wires the rules cache into the game setup. It is intentionally minimal.
 *
 * Architecture notes:
 * - G (game state) never touches the database. boardgame.io manages G entirely
 *   in memory. PostgreSQL stores rules-engine configuration data, not live
 *   turn state.
 * - Data that belongs in G: deck contents, player hands, city zone, scores,
 *   and any mutable state that changes during gameplay.
 * - Data looked up from rulesCache: rule definitions, glossary text, card type
 *   mappings. These are immutable after server startup.
 * - All randomness uses ctx.random.* instead of Math.random() because
 *   boardgame.io requires deterministic replay. ctx.random.* is seeded and
 *   reproducible; Math.random() would break replays and cause state divergence
 *   between server and client.
 *
 * Full game logic (moves, phases, rule hooks) will be implemented in
 * packages/game-engine/ (WP-002+). This file exists to show the seam between
 * rules data and game state, not to implement gameplay.
 */

import { getRules } from '../rules/loader.mjs';

/**
 * Minimal boardgame.io Game() definition for Legendary Arena.
 * Wires the rules cache into setup and provides a placeholder move.
 */
export const LegendaryGame = {
  name: 'legendary-arena',

  /**
   * Initialises game state with the rules cache available.
   * This is the only place where rules data enters the game.
   *
   * @param {object} ctx - boardgame.io context.
   * @param {object} setupData - Match configuration from the lobby.
   * @returns {object} Initial game state (G).
   */
  setup(ctx, setupData) {
    const rules = getRules();
    const rulesCount = Object.keys(rules.rules).length;

    return {
      rulesCount,
      players: {},
      turnCount: 0,
    };
  },

  moves: {
    /**
     * Placeholder move — will be replaced by real moves in WP-002+.
     * Demonstrates the move contract: validate, gate, mutate, return void.
     *
     * @param {object} context - boardgame.io move context.
     * @param {object} context.G - Current game state.
     * @param {string} cardExtId - External ID of the card to play.
     */
    playCard({ G }, cardExtId) {
      if (!cardExtId || typeof cardExtId !== 'string') {
        return;
      }
      G.turnCount += 1;
    },
  },

  /**
   * Checks if the game should end. Placeholder — real endgame logic
   * will be implemented in WP-002+.
   *
   * @param {object} context - boardgame.io context.
   * @param {object} context.G - Current game state.
   * @returns {undefined | object} Undefined to continue; object to end.
   */
  endIf({ G }) {
    // why: 999 is an arbitrary high number. Real endgame conditions
    // (scheme success, mastermind defeat, deck exhaustion) will replace this.
    if (G.turnCount >= 999) {
      return { winner: null };
    }
  },
};
