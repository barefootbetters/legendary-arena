/**
 * Scheme twist configuration registry for the Legendary Arena game engine.
 *
 * Maps scheme ext_ids to their SchemeTwistConfig entries. The dispatcher
 * looks up the active scheme's config to route to the correct resolver.
 *
 * Core-set coverage (v1): 7 of 8 schemes configured. The one remaining is:
 * - core/portals-to-the-dark-dimension (dark dimension pile) — a TRUE twist-loss
 *   scheme whose printed loss-twist is 7, which equals the unconfigured MVP
 *   fallback, so it loses at the right count today even without a config entry.
 * Killbots (WP-513 / D-24325) and Secret Invasion (WP-514 / D-24327) are the two
 * conversion schemes, now configured with their escaped-converted-count losses.
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
      // why: real Evil-Wins is a RESOURCE condition (D-24320) — "If the Wound
      // stack runs out", modeled as the 'pile-depleted' kind on G.piles.wounds.
      // Declaring resourceLossCondition SUPPRESSES the twist-count doom-clock
      // proxy for this scheme; lossThreshold (the printed 8-twist stack size) is
      // retained but now INERT for loss (D-24178 / D-24320). The Wound stack is
      // sized 6×players at setup (D-24321), so the stack is small enough to run
      // out as the card intends.
      lossThreshold: 8,
      resourceLossCondition: {
        kind: 'pile-depleted',
        pile: 'wounds',
      },
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
  [
    'core/replace-earths-leaders-with-killbots',
    {
      schemeId: 'core/replace-earths-leaders-with-killbots',
      resolverId: 'killbots',
      params: {},
      // why: real Evil-Wins is a RESOURCE condition (D-24325) — "If 5 Killbots
      // escape", counted as 'killbot'-origin entries in G.escapedPile (the 18
      // villain-deck Bystanders convert to Killbot Villains — D-24324 — counted by
      // converted origin, distinct from real villains). Declaring
      // resourceLossCondition SUPPRESSES the twist-count doom-clock proxy;
      // lossThreshold (the printed 5-twist stack) is retained but now INERT for
      // loss (D-24178 / D-24325). The 'killbots' twist raises the per-scheme twist
      // counter that drives Killbot attack.
      lossThreshold: 5,
      resourceLossCondition: {
        kind: 'escaped-converted-count',
        origin: 'killbot',
        threshold: 5,
      },
    },
  ],
  [
    'core/secret-invasion-of-the-skrull-shapeshifters',
    {
      schemeId: 'core/secret-invasion-of-the-skrull-shapeshifters',
      resolverId: 'secret-invasion',
      params: {},
      // why: real Evil-Wins is a RESOURCE condition (D-24326) — "If 6 Heroes get
      // into the Escaped Villains pile", counted as 'skrull'-origin entries in
      // G.escapedPile (12 Heroes shuffled into the Villain Deck at setup convert to
      // Skrull Villains — D-24326 — counted by converted origin, distinct from real
      // villains). Declaring resourceLossCondition SUPPRESSES the twist-count
      // doom-clock proxy; lossThreshold (the printed 8-twist stack) is retained but
      // now INERT for loss (D-24178 / D-24327). The 'secret-invasion' twist drags the
      // highest-cost HQ Hero into the Sewers as a Skrull (cost + 2 attack, D-24327).
      lossThreshold: 8,
      resourceLossCondition: {
        kind: 'escaped-converted-count',
        origin: 'skrull',
        threshold: 6,
      },
    },
  ],
]);
