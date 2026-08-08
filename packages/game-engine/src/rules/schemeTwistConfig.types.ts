/**
 * Scheme twist resolver framework types.
 *
 * Defines the SchemeTwistConfig interface for data-driven scheme twist
 * dispatch, the SchemeTwistResolverId union for the resolver registry,
 * and the SchemeTwistResolver function signature.
 *
 * No boardgame.io imports. No registry imports.
 */

import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { RevealedCardType } from '../villainDeck/villainDeck.types.js';
import type { RevealContext } from '../villainDeck/villainDeck.reveal.js';
import type { ImplementationMap } from './ruleRuntime.execute.js';

/**
 * Declares a scheme's real "Evil Wins" condition as a resource threshold,
 * so the scheme loses when the condition is met rather than on the
 * twist-count doom-clock proxy (D-24178 / D-24315).
 *
 * A discriminated union on `kind` (data-only object literals, no functions, so
 * `SchemeTwistConfig` stays JSON-serializable):
 *
 * - `'escaped-pile-count'` (D-24315): the scheme loses when the Escaped Villains
 *   pile (`G.escapedPile`) holds at least `threshold` entries whose card type
 *   equals `cardType` (Midtown Bank Robbery, Negative Zone Prison Breakout).
 * - `'pile-depleted'` (D-24318 / D-24320): the scheme loses when a named pile runs
 *   out — the pile's length reaches 0. Super Hero Civil War: `pile: 'heroDeck'`
 *   (`G.heroDeck`); Legacy Virus: `pile: 'wounds'` (`G.piles.wounds`).
 */
export type SchemeResourceLossCondition =
  | {
      /** Count entries of a card type in the Escaped Villains pile. */
      kind: 'escaped-pile-count';
      /** The card type to count in `G.escapedPile`. */
      cardType: RevealedCardType;
      /** The count at which the scheme is lost (evil wins). */
      threshold: number;
    }
  | {
      /** A named pile running out (reaching zero cards) is the loss. */
      kind: 'pile-depleted';
      /** The pile whose emptiness ends the game (`heroDeck` or `wounds`). */
      pile: 'heroDeck' | 'wounds';
    };

/**
 * Identifies a registered scheme twist resolver function.
 */
export type SchemeTwistResolverId =
  | 'reveal-or-punish'
  | 'chained-reveals'
  | 'wound-all'
  | 'ko-from-hq'
  | 'midtown-bank-robbery';

/**
 * Configuration for a single scheme's twist behavior.
 *
 * Keyed by scheme ext_id in the config registry. The dispatcher looks
 * up the config by G.selection.schemeId, then dispatches to the
 * resolver identified by resolverId.
 */
export interface SchemeTwistConfig {
  /** Scheme ext_id (e.g. 'core/legacy-virus-the'). */
  schemeId: string;
  /** Which resolver function handles this scheme's twist. */
  resolverId: SchemeTwistResolverId;
  /** Resolver-specific parameters. */
  params: Record<string, unknown>;
  /**
   * Override MVP_SCHEME_TWIST_THRESHOLD for this scheme — the twist count at
   * which scheme loss triggers. Set to the scheme's printed twist-stack size so
   * the scheme never resolves a twist early (D-24178). A player-count-independent
   * scheme uses this scalar.
   */
  lossThreshold?: number;
  /**
   * Per-player-count loss threshold, for schemes whose printed twist stack varies
   * by player count (e.g. Super Hero Civil War: 8 twists at 2-3 players, 5 at 4-5).
   * Keyed by `String(gameState.lobby.requiredPlayers)`; when a key matches, it wins
   * over `lossThreshold`. Falls back to `lossThreshold`, then the MVP default
   * (D-24178). Data-only (a plain map, no functions).
   */
  lossThresholdByPlayerCount?: Record<string, number>;
  /**
   * The scheme's real Evil-Wins condition, when it is a resource threshold
   * rather than a twist count (D-24315). When present, the twist-count
   * doom-clock proxy (D-24178) is SUPPRESSED for this scheme — the scheme
   * loses only when this condition is met. Absent for true twist-loss schemes
   * (Portals, Cosmic Cube), which keep the twist-threshold loss. Data-only.
   */
  resourceLossCondition?: SchemeResourceLossCondition;
}

/**
 * Resolver function signature for scheme twist handlers.
 *
 * Resolvers mutate G directly. They push messages to gameState.messages.
 * They do NOT return RuleEffect[] — the generic counter-increment +
 * loss-check effects are appended by the dispatcher after the resolver runs.
 *
 * WP-200 / D-20003 (signature widening, 01.5 cascade allowlist extension):
 * `twistCardId` is the 5th positional parameter carrying the zone-instance
 * ext_id of the scheme-twist card that triggered. Each resolver pushes one
 * `schemeTwistResolved` event to `G.notableEvents` at its terminal point,
 * stamping the event with `twistCardId`. Injected by the dispatcher
 * (`schemeHandlers.ts:schemeTwistHandler`) from the trigger payload —
 * resolvers do not source it from `G` (the cardId is in-flight between
 * deck removal and twist-pile routing at resolver-call time, so no G
 * field carries it).
 *
 * The 5th param is optional in the type so legacy direct-resolver test
 * call sites compile unchanged; resolver implementations fall back to a
 * sentinel ext_id on the optional path. The production dispatch path
 * always passes the real cardId.
 */
export type SchemeTwistResolver = (
  gameState: LegendaryGameState,
  context: RevealContext,
  implementationMap: ImplementationMap,
  params: Record<string, unknown>,
  twistCardId?: CardExtId,
) => void;
