/**
 * Scheme twist configuration registry for the Legendary Arena game engine.
 *
 * Maps scheme ext_ids to their SchemeTwistConfig entries. The dispatcher
 * looks up the active scheme's config to route to the correct resolver.
 *
 * Core-set coverage (v1): 5 of 8 schemes. The remaining 3 require new
 * resolvers in future WPs:
 * - core/portals-to-the-dark-dimension (dark dimension pile) — its printed
 *   loss-twist is 7, which happens to equal the unconfigured MVP fallback, so it
 *   loses at the right count today even without a config.
 * - core/replace-earths-leaders-with-killbots (leader replacement) — 5-twist
 *   villain-deck stack; unconfigured, so it uses the wrong fallback of 7.
 * - core/secret-invasion-of-the-skrull-shapeshifters (HQ-to-City hero
 *   conversion — verified twist text does not match reveal-or-punish) — 8-twist
 *   resource-loss stack; unconfigured, so it uses the wrong fallback of 7.
 * Those 3 need both a resolver AND a lossThreshold in a future scheme-fidelity
 * packet (D-24178).
 *
 * why (D-24178): each config's lossThreshold is the scheme's PRINTED twist-stack
 * size, so no scheme resolves a twist early. Only twist-loss schemes (printed
 * "Twist N: Evil Wins!" — Portals 7, Cosmic Cube 8) truly lose when the counter
 * reaches that number; the others lose on RESOURCE conditions (bystanders/
 * heroes/villains escaped, wound/hero deck empty) the engine does not yet model,
 * so their threshold is a doom-clock proxy at the full stack length. Super Hero
 * Civil War's stack varies by seat count (8 at 2-3p, 5 at 4-5p) — modeled via
 * lossThresholdByPlayerCount.
 *
 * No boardgame.io imports. No registry imports.
 */

import type { SchemeTwistConfig } from './schemeTwistConfig.types.js';

/**
 * Scheme twist config entries keyed by scheme ext_id.
 */
export const SCHEME_TWIST_CONFIGS: Map<string, SchemeTwistConfig> = new Map([
  [
    'core/midtown-bank-robbery',
    {
      schemeId: 'core/midtown-bank-robbery',
      resolverId: 'midtown-bank-robbery',
      params: {},
      // why: real Evil-Wins is a RESOURCE condition (D-24315) — 8 Bystanders
      // carried away by escaping villains, counted in G.escapedPile. Declaring
      // resourceLossCondition SUPPRESSES the twist-count doom-clock proxy for
      // this scheme; lossThreshold (the printed 8-twist stack size) is retained
      // but is now INERT for loss (kept for any path still reading it, per D-24178).
      lossThreshold: 8,
      resourceLossCondition: {
        kind: 'escaped-pile-count',
        cardType: 'bystander',
        threshold: 8,
      },
    },
  ],
  [
    'core/legacy-virus-the',
    {
      schemeId: 'core/legacy-virus-the',
      resolverId: 'reveal-or-punish',
      params: {
        condition: { field: 'heroClass', value: 'tech' },
        penalty: 'gainWound',
      },
      // why: 8-twist stack (resource loss — wound stack empties); doom-clock proxy (D-24178).
      lossThreshold: 8,
    },
  ],
  [
    'core/negative-zone-prison-breakout',
    {
      schemeId: 'core/negative-zone-prison-breakout',
      resolverId: 'chained-reveals',
      params: { revealCount: 2 },
      // why: real Evil-Wins is a RESOURCE condition (D-24316) — "If 12 Villains
      // escape", counted as 'villain'-typed entries in G.escapedPile. Villains
      // only, per Universal Rules v23 §"Schemes that Count Escaped Villains"
      // (henchmen — typed 'henchman' — are excluded, so counting the pile by
      // 'villain' type is faithful; the ESCAPED_VILLAINS counter would wrongly
      // include them). Declaring resourceLossCondition SUPPRESSES the twist-count
      // doom-clock proxy for this scheme; lossThreshold (the printed 8-twist
      // stack size) is retained but now INERT for loss (D-24178 / D-24317).
      lossThreshold: 8,
      resourceLossCondition: {
        kind: 'escaped-pile-count',
        cardType: 'villain',
        threshold: 12,
      },
    },
  ],
  [
    'core/unleash-the-power-of-the-cosmic-cube',
    {
      schemeId: 'core/unleash-the-power-of-the-cosmic-cube',
      resolverId: 'wound-all',
      params: { woundCount: 1 },
      // why: TRUE twist-loss scheme — printed "Twist 8: Evil Wins!" (D-24178).
      // This was losing a twist early at the fallback 7; the reported bug.
      lossThreshold: 8,
    },
  ],
  [
    'core/super-hero-civil-war',
    {
      schemeId: 'core/super-hero-civil-war',
      resolverId: 'ko-from-hq',
      params: { koCount: 2 },
      // why: real Evil-Wins is a RESOURCE condition (D-24318) — "If the Hero
      // Deck runs out", modeled as the 'pile-depleted' kind on G.heroDeck.
      // Declaring resourceLossCondition SUPPRESSES the twist-count doom-clock
      // proxy for this scheme; lossThresholdByPlayerCount (the printed 8/5-twist
      // stack) is retained but now INERT for loss (D-24178 / D-24318). The
      // per-player hero-deck SIZING ("4 Heroes at 2 players") is deferred to
      // WP-511; until then 2p full-deck may under-loss (reachable at 3-5p).
      lossThresholdByPlayerCount: { '2': 8, '3': 8, '4': 5, '5': 5 },
      resourceLossCondition: {
        kind: 'pile-depleted',
        pile: 'heroDeck',
      },
    },
  ],
]);
