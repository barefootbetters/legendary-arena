/**
 * Scheme twist configuration registry for the Legendary Arena game engine.
 *
 * Maps scheme ext_ids to their SchemeTwistConfig entries. The dispatcher
 * looks up the active scheme's config to route to the correct resolver.
 *
 * Core-set coverage: all 8 core schemes configured. Portals to the Dark Dimension
 * (WP-539 / D-24348) is a TRUE twist-loss scheme (printed "Twist 7: Evil Wins!") —
 * its `portals` resolver bumps DARK_PORTAL_COUNT, which drives the Dark-Portal
 * attack buffs (mastermind +1; Villains +1 in a portal'd city space); before this
 * entry it lost at twist 7 only by coincidence (the MVP fallback equals 7).
 * Killbots (WP-513 / D-24325) and Secret Invasion (WP-514 / D-24327) are the two
 * conversion schemes, configured with their escaped-converted-count losses.
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
 * Beyond core (WP-763 / D-24595): 67 audited non-core schemes — 27 printed twist
 * counts, 15 pure pile-runout conditions, 25 compound "counter or pile runs out"
 * conditions — all on the no-op 'counter-only' resolver. Every other scheme is
 * unconfigured and loses at the last twist in its Villain Deck (the operator's
 * interim rule), which the danger meter labels approximate.
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
      // why: WP-540 / D-24349 — the printed escalation: nothing on twists 1-4,
      // each player gains 1 Wound on twists 5-6, and 3 Wounds on twist 7 (twist 8
      // = Evil Wins, below). Keyed on currentTwist = schemeTwistCount + 1; the
      // resolver takes the MAX matching step (twist 7 matches both → 3 wounds),
      // replacing the flat 1-per-twist that both over-punished early and
      // under-punished the twist-7 spike.
      params: {
        escalation: [
          { atOrAfterTwist: 5, woundCount: 1 },
          { atOrAfterTwist: 7, woundCount: 3 },
        ],
      },
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
      // why: WP-540 / D-24349 — the printed Twist "KO all the Heroes in the HQ"
      // (then refill each), not a fixed 2; koAll drives the KO-all path. The loss
      // stays hero-deck-empty (WP-510), unchanged.
      params: { koAll: true },
      // why: real Evil-Wins is a RESOURCE condition (D-24318) — "If the Hero
      // Deck runs out", modeled as the 'pile-depleted' kind on G.heroDeck.
      // Declaring resourceLossCondition SUPPRESSES the twist-count doom-clock
      // proxy for this scheme; lossThresholdByPlayerCount (the printed 8/5-twist
      // stack) is retained but now INERT for loss (D-24178 / D-24318). The
      // per-player hero-deck SIZING ("4 Heroes at 2 players") is deferred to
      // WP-511; until then 2p full-deck may under-loss (reachable at 3-5p).
      // why: WP-562 / D-24371 §6 — the '1' key. Solo mirrors 2-player in
      // Legendary, and its absence here did not fail loudly: a 1-player game fell
      // through to MVP_SCHEME_TWIST_THRESHOLD (7), the arbitrary
      // unconfigured-scheme fallback, and reported a 3/7 meter in a live match.
      // The missing key was the bug. (D-24595 later replaced the flat-7 fallback
      // itself with the last twist in the Villain Deck, for non-core schemes.)
      lossThresholdByPlayerCount: { '1': 8, '2': 8, '3': 8, '4': 5, '5': 5 },
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
  [
    'core/portals-to-the-dark-dimension',
    {
      schemeId: 'core/portals-to-the-dark-dimension',
      resolverId: 'portals',
      params: {},
      // why: TRUE twist-loss scheme — printed "Twist 7: Evil Wins!" (D-24178 /
      // D-24348). No resourceLossCondition, so the twist-count IS the printed loss.
      // Portals was previously UNCONFIGURED and lost at twist 7 only by coincidence
      // (the MVP fallback threshold equals 7); this entry makes it correct-by-design.
      // The `portals` resolver bumps DARK_PORTAL_COUNT, which drives the Dark-Portal
      // attack buffs (mastermind +1 once >= 1; a Villain +1 in a portal'd city space).
      lossThreshold: 7,
    },
  ],
  // -------------------------------------------------------------------------
  // WP-763 / D-24595 — §Audit A: printed twist count ("Twist N: Evil Wins").
  // why: each scheme loses at exactly its printed N (lossThreshold), with no
  // twist effect yet ('counter-only'). The twist-7 schemes are configured
  // explicitly even though 7 was the old default, so the D-24595 last-twist
  // fallback can never move them. ssw2/god-emperor-of-battleworld-the prints
  // "(If any Mastermind still lives)"; v1 treats it as plain twist 8 (named gap).
  // -------------------------------------------------------------------------
  [
    'anni/sneak-attack-the-heroes-homes',
    {
      schemeId: 'anni/sneak-attack-the-heroes-homes',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 6,
    },
  ],
  [
    'ca75/unbreakable-enigma-code-the',
    {
      schemeId: 'ca75/unbreakable-enigma-code-the',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 6,
    },
  ],
  [
    'vnom/paralyzing-venom',
    {
      schemeId: 'vnom/paralyzing-venom',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 6,
    },
  ],
  [
    'xmen/horror-of-horrors',
    {
      schemeId: 'xmen/horror-of-horrors',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 6,
    },
  ],
  [
    '2099/pull-reality-into-cyberspace',
    {
      schemeId: '2099/pull-reality-into-cyberspace',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 7,
    },
  ],
  [
    'bkwd/corrupt-the-spy-agencies',
    {
      schemeId: 'bkwd/corrupt-the-spy-agencies',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 7,
    },
  ],
  [
    'co2e/portals-to-the-dark-dimension',
    {
      schemeId: 'co2e/portals-to-the-dark-dimension',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 7,
    },
  ],
  [
    'ff04/invincible-force-field',
    {
      schemeId: 'ff04/invincible-force-field',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 7,
    },
  ],
  [
    'ff04/pull-reality-into-the-negative-zone',
    {
      schemeId: 'ff04/pull-reality-into-the-negative-zone',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 7,
    },
  ],
  [
    'msp1/invade-asgard',
    {
      schemeId: 'msp1/invade-asgard',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 7,
    },
  ],
  [
    'pttr/weave-a-web-of-lies',
    {
      schemeId: 'pttr/weave-a-web-of-lies',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 7,
    },
  ],
  [
    'ssw1/dark-alliance',
    {
      schemeId: 'ssw1/dark-alliance',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 7,
    },
  ],
  [
    'wwhk/mutating-gamma-rays',
    {
      schemeId: 'wwhk/mutating-gamma-rays',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 7,
    },
  ],
  [
    'co2e/unleash-the-power-of-the-cosmic-cube',
    {
      schemeId: 'co2e/unleash-the-power-of-the-cosmic-cube',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 8,
    },
  ],
  [
    'msp1/unleash-the-power-of-the-cosmic-cube',
    {
      schemeId: 'msp1/unleash-the-power-of-the-cosmic-cube',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 8,
    },
  ],
  [
    'cvwr/avengers-vs-x-men',
    {
      schemeId: 'cvwr/avengers-vs-x-men',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 8,
    },
  ],
  [
    'mgtg/inescapable-kyln-space-prison',
    {
      schemeId: 'mgtg/inescapable-kyln-space-prison',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 8,
    },
  ],
  [
    'rvlt/korvac-saga-the',
    {
      schemeId: 'rvlt/korvac-saga-the',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 8,
    },
  ],
  [
    'ssw2/god-emperor-of-battleworld-the',
    {
      schemeId: 'ssw2/god-emperor-of-battleworld-the',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 8,
    },
  ],
  [
    'ssw2/secret-wars',
    {
      schemeId: 'ssw2/secret-wars',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 8,
    },
  ],
  [
    'wpnx/condition-logan-into-weapon-x',
    {
      schemeId: 'wpnx/condition-logan-into-weapon-x',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 8,
    },
  ],
  [
    'anni/pulse-waves-from-the-negative-zone',
    {
      schemeId: 'anni/pulse-waves-from-the-negative-zone',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 9,
    },
  ],
  [
    'wwhk/world-war-hulk',
    {
      schemeId: 'wwhk/world-war-hulk',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 9,
    },
  ],
  [
    'msis/the-time-heist',
    {
      schemeId: 'msis/the-time-heist',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 10,
    },
  ],
  [
    'rlmk/tornado-of-terrigen-mists',
    {
      schemeId: 'rlmk/tornado-of-terrigen-mists',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 10,
    },
  ],
  [
    'shld/hail-hydra',
    {
      schemeId: 'shld/hail-hydra',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 10,
    },
  ],
  [
    'vnom/symbiotic-absorption',
    {
      schemeId: 'vnom/symbiotic-absorption',
      resolverId: 'counter-only',
      params: {},
      lossThreshold: 11,
    },
  ],
  // -------------------------------------------------------------------------
  // WP-763 / D-24595 — §Audit D-pure: Evil Wins only on a standard pile running
  // out ("If the Hero Deck runs out" / "If the Wound Stack runs out" / "When the
  // Wound Stack or Villain Deck runs out" / "When the Hero Deck or Villain Deck
  // runs out").
  // why: the declared resourceLossCondition SUPPRESSES the twist proxy (D-24315),
  // so these schemes never lose on twists; a Villain Deck runout is a scheme loss,
  // not the deck-exhaustion tie (D-24319 precedence).
  // -------------------------------------------------------------------------
  [
    'ca75/go-back-in-time-to-slay-heroes-ancestors',
    {
      schemeId: 'ca75/go-back-in-time-to-slay-heroes-ancestors',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'heroDeck' },
    },
  ],
  [
    'co2e/super-hero-civil-war',
    {
      schemeId: 'co2e/super-hero-civil-war',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'heroDeck' },
    },
  ],
  [
    'cvwr/epic-super-hero-civil-war',
    {
      schemeId: 'cvwr/epic-super-hero-civil-war',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'heroDeck' },
    },
  ],
  [
    'dead/deadpool-kills-the-marvel-universe',
    {
      schemeId: 'dead/deadpool-kills-the-marvel-universe',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'heroDeck' },
    },
  ],
  [
    'msp1/super-hero-civil-war',
    {
      schemeId: 'msp1/super-hero-civil-war',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'heroDeck' },
    },
  ],
  [
    'wpnx/go-after-heroes-loved-ones',
    {
      schemeId: 'wpnx/go-after-heroes-loved-ones',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'heroDeck' },
    },
  ],
  [
    'msp1/radioactive-palladium-poisoning',
    {
      schemeId: 'msp1/radioactive-palladium-poisoning',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'wounds' },
    },
  ],
  [
    'ssw1/pan-dimensional-plague',
    {
      schemeId: 'ssw1/pan-dimensional-plague',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'wounds' },
    },
  ],
  [
    'wwhk/fall-of-the-hulks',
    {
      schemeId: 'wwhk/fall-of-the-hulks',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'wounds' },
    },
  ],
  [
    'bkpt/poison-lakes-with-nanite-microbots',
    {
      schemeId: 'bkpt/poison-lakes-with-nanite-microbots',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', piles: ['wounds', 'villainDeck'] },
    },
  ],
  [
    'co2e/the-legacy-virus',
    {
      schemeId: 'co2e/the-legacy-virus',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', piles: ['wounds', 'villainDeck'] },
    },
  ],
  [
    'xmen/anti-mutant-hatred',
    {
      schemeId: 'xmen/anti-mutant-hatred',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', piles: ['wounds', 'villainDeck'] },
    },
  ],
  [
    'xmen/televised-deathtraps-of-mojoworld',
    {
      schemeId: 'xmen/televised-deathtraps-of-mojoworld',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', piles: ['wounds', 'villainDeck'] },
    },
  ],
  [
    'mdns/midnight-massacre',
    {
      schemeId: 'mdns/midnight-massacre',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', piles: ['heroDeck', 'villainDeck'] },
    },
  ],
  [
    'msis/halve-all-life-in-the-universe',
    {
      schemeId: 'msis/halve-all-life-in-the-universe',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', piles: ['heroDeck', 'villainDeck'] },
    },
  ],
  // -------------------------------------------------------------------------
  // WP-763 / D-24595 — §Audit D-compound: "an unmodelled counter reaches N (N
  // Villains escaped per player, N tokens / cards on the scheme), OR the Villain
  // Deck / Hero Deck / Wound Stack runs out".
  // why: the pile half is modelled by the resourceLossCondition; the counter half
  // is not, so twistFallbackWithResourceLoss keeps the last-twist fallback active
  // as its approximate stand-in (the meter reports it as 'twists-fallback').
  // -------------------------------------------------------------------------
  [
    'antm/trap-heroes-in-the-microverse',
    {
      schemeId: 'antm/trap-heroes-in-the-microverse',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'bkwd/train-black-widows-in-the-red-room',
    {
      schemeId: 'bkwd/train-black-widows-in-the-red-room',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'co2e/negative-zone-prison-outbreak',
    {
      schemeId: 'co2e/negative-zone-prison-outbreak',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'dstr/war-for-the-dream-dimension',
    {
      schemeId: 'dstr/war-for-the-dream-dimension',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'rlmk/devolve-with-xerogen-crystals',
    {
      schemeId: 'rlmk/devolve-with-xerogen-crystals',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'rvlt/earthquake-drains-the-ocean',
    {
      schemeId: 'rvlt/earthquake-drains-the-ocean',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'smhc/scavenge-alien-weaponry',
    {
      schemeId: 'smhc/scavenge-alien-weaponry',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'wtif/marvel-zombies',
    {
      schemeId: 'wtif/marvel-zombies',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'wwhk/gladiator-pits-of-sakaar',
    {
      schemeId: 'wwhk/gladiator-pits-of-sakaar',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'pttr/clone-saga-the',
    {
      schemeId: 'pttr/clone-saga-the',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'pttr/splice-humans-with-spider-dna',
    {
      schemeId: 'pttr/splice-humans-with-spider-dna',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'vnom/invasion-of-the-venom-symbiotes',
    {
      schemeId: 'vnom/invasion-of-the-venom-symbiotes',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'bkpt/plunder-wakandas-vibranium',
    {
      schemeId: 'bkpt/plunder-wakandas-vibranium',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'co2e/bank-robbery-hostage-crisis',
    {
      schemeId: 'co2e/bank-robbery-hostage-crisis',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'co2e/enshrouded-identity',
    {
      schemeId: 'co2e/enshrouded-identity',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'cosm/annihilation-conquest',
    {
      schemeId: 'cosm/annihilation-conquest',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'dstr/cursed-pages-of-the-darkhold-tome',
    {
      schemeId: 'dstr/cursed-pages-of-the-darkhold-tome',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'mdns/sire-vampires-at-the-blood-bank',
    {
      schemeId: 'mdns/sire-vampires-at-the-blood-bank',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'msmc/control-the-mutant-messiah',
    {
      schemeId: 'msmc/control-the-mutant-messiah',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'msmc/open-rifts-to-future-timelines',
    {
      schemeId: 'msmc/open-rifts-to-future-timelines',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'villainDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'msmc/reveal-the-heroes-evil-clones',
    {
      schemeId: 'msmc/reveal-the-heroes-evil-clones',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', piles: ['villainDeck', 'heroDeck'] },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'msmc/unleash-an-anti-mutant-bioweapon',
    {
      schemeId: 'msmc/unleash-an-anti-mutant-bioweapon',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', piles: ['villainDeck', 'heroDeck'] },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    '2099/befoul-earth-into-a-polluted-wasteland',
    {
      schemeId: '2099/befoul-earth-into-a-polluted-wasteland',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'heroDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'dkcy/detonate-the-helicarrier',
    {
      schemeId: 'dkcy/detonate-the-helicarrier',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'heroDeck' },
      twistFallbackWithResourceLoss: true,
    },
  ],
  [
    'vnom/maximum-carnage',
    {
      schemeId: 'vnom/maximum-carnage',
      resolverId: 'counter-only',
      params: {},
      resourceLossCondition: { kind: 'pile-depleted', pile: 'wounds' },
      twistFallbackWithResourceLoss: true,
    },
  ],
]);
