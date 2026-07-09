/**
 * Canonical keyword and timing taxonomies for hero ability hooks.
 *
 * Both HeroKeyword and HeroAbilityTiming are closed unions with canonical
 * arrays for drift-detection. Adding a new entry to either requires a
 * DECISIONS.md entry and updating both the union type and its canonical
 * array.
 *
 * No boardgame.io imports. No registry imports. Contracts only.
 */

// ---------------------------------------------------------------------------
// HeroKeyword
// ---------------------------------------------------------------------------

// why: keywords are semantic labels only; adding a keyword requires a
// DECISIONS.md entry and updating both the union type and the canonical
// array. This prevents ad-hoc keyword proliferation.

/**
 * Closed canonical union of hero ability keyword labels.
 *
 * Keywords are semantic labels only — they do not imply magnitude,
 * effect resolution, or execution semantics.
 */
export type HeroKeyword =
  | 'draw'
  | 'attack'
  | 'recruit'
  | 'ko'
  | 'rescue'
  | 'wound'
  | 'reveal'
  | 'reveal-ko'
  | 'reveal-min'
  | 'reveal-ko-or-draw' // why: D-21802
  | 'reveal-cost-attack' // why: D-21901
  | 'reveal-odd-draw' // why: D-21902
  | 'reveal-attack-choose' // why: D-22003
  | 'reveal-ko-attack' // why: D-22301 — compound executor; magnitude encodes fixed attack grant (not a cost ceiling)
  | 'attack-per-count' // why: D-24016 — count-scaled attack; magnitude is the per-unit rate, countSource resolves the count
  | 'optional-ko-reward' // why: D-24019 — "you may KO a card from hand/discard; if you do, <reward>"; rewardType carries the reward
  | 'wall-crawl' // why: D-24049 — printed "Wall-Crawl" ("when you recruit this Hero, you may put it on top of your deck"); executable via the recruitHero deck-top placement, not an onPlay HERO_EFFECT_HANDLERS entry
  | 'dodge' // why: D-24051 — printed "Dodge" ("during your turn, you may discard this card from your hand to draw another card"); executable via the dodgeCard hand-discard-to-draw move, not an onPlay HERO_EFFECT_HANDLERS entry
  | 'conditional'
  | 'undercover' // why: D-24060 / WP-282 — "send a card face-down, play it later from face-down state"; executable via sendUndercover + playFromUndercover moves on onPlay trigger
  | 'victory-villain-attack' // why: D-24068 / WP-285 — "gain +attack equal to the printed attack of a villain in your victory pile"; parks a pending pick resolved by resolveVictoryPileCardPick
  | 'draw-or-empowered' // why: D-24069 / WP-286 — "Choose one: Draw a card, or you get Empowered by [class]"; parks a PendingDrawOrEmpowered resolved by resolveDrawOrEmpowered
  | 'size-changing' // why: D-24074 / WP-290 — printed "Size-Changing: [Class]" ("when you play this card, it has the [Class] class"); a class-grant realized at class-read time, no onPlay handler (the wall-crawl class)
  | 'optional-put-bottom-hq' // why: "You may put a card from the HQ on the bottom of the Hero Deck"; parks a PendingOptionalPutBottomHQ resolved by resolveOptionalPutBottomHQ
  | 'put-any-number-bottom-hq' // why: D-24132 — "Choose any number of cards/Heroes from the HQ. Put them on the bottom of the Hero Deck" (multi-select variant); parks a PendingPutAnyNumberBottomHQ resolved by resolvePutAnyNumberBottomHQ, then applies any trailing "Empowered by [classes]"
  | 'put-bottom-hq-icon-reward'; // why: D-24133 — mandatory "Put a card from the HQ on the bottom of the Hero Deck. If that card had a recruit/attack icon, you get +N" (Absorb Ambient Power); parks a mandatory PendingOptionalPutBottomHQ with iconRewardMagnitude, resolved by resolveOptionalPutBottomHQ

// why: canonical array for drift-detection. Must match HeroKeyword
// union exactly. Drift-detection test in heroAbility.setup.test.ts
// asserts array/union parity.

/**
 * All hero keywords in canonical order. Single source of truth.
 */
export const HERO_KEYWORDS: readonly HeroKeyword[] = [
  'draw',
  'attack',
  'recruit',
  'ko',
  'rescue',
  'wound',
  'reveal',
  'reveal-ko',
  'reveal-min',
  'reveal-ko-or-draw', // why: D-21802
  'reveal-cost-attack', // why: D-21901
  'reveal-odd-draw', // why: D-21902
  'reveal-attack-choose', // why: D-22003
  'reveal-ko-attack', // why: D-22301 — compound executor; magnitude encodes fixed attack grant (not a cost ceiling)
  'attack-per-count', // why: D-24016 — count-scaled attack; magnitude is the per-unit rate, countSource resolves the count
  'optional-ko-reward', // why: D-24019 — "you may KO a card from hand/discard; if you do, <reward>"; rewardType carries the reward
  'wall-crawl', // why: D-24049 — printed "Wall-Crawl"; executable via the recruitHero deck-top placement, not an onPlay HERO_EFFECT_HANDLERS entry
  'dodge', // why: D-24051 — printed "Dodge"; executable via the dodgeCard hand-discard-to-draw move, not an onPlay HERO_EFFECT_HANDLERS entry
  'undercover', // why: D-24060 / WP-282 — "send a card face-down, play it later"; executable via sendUndercover + playFromUndercover moves on onPlay trigger
  'conditional',
  'victory-villain-attack', // why: D-24068 / WP-285 — "gain +attack equal to the printed attack of a villain in your victory pile"; parks a pending pick resolved by resolveVictoryPileCardPick
  'draw-or-empowered', // why: D-24069 / WP-286 — "Choose one: Draw a card, or you get Empowered by [class]"; parks a PendingDrawOrEmpowered resolved by resolveDrawOrEmpowered
  'size-changing', // why: D-24074 / WP-290 — printed "Size-Changing: [Class]"; a class-grant realized at class-read time, no onPlay handler (the wall-crawl class)
  'optional-put-bottom-hq', // why: "You may put a card from the HQ on the bottom of the Hero Deck"; parks a pending choice resolved by resolveOptionalPutBottomHQ
  'put-any-number-bottom-hq', // why: D-24132 — "Choose any number of cards/Heroes from the HQ. Put them on the bottom of the Hero Deck" (multi-select); parks a pending choice resolved by resolvePutAnyNumberBottomHQ
  'put-bottom-hq-icon-reward', // why: D-24133 — mandatory single-card "Put a card from the HQ on the bottom of the Hero Deck. If that card had a recruit/attack icon, +N" (Absorb Ambient Power); parks a mandatory PendingOptionalPutBottomHQ resolved by resolveOptionalPutBottomHQ
] as const;

// ---------------------------------------------------------------------------
// HeroAbilityTiming
// ---------------------------------------------------------------------------

// why: timing labels are declarative only — no execution semantics.
// Defaults to 'onPlay' when markup does not encode timing explicitly.
// Same closed-union pattern as HeroKeyword.

/**
 * Closed canonical union of hero ability timing labels.
 *
 * Adding a new timing requires a DECISIONS.md entry and updating both
 * the type and the HERO_ABILITY_TIMINGS array.
 */
export type HeroAbilityTiming =
  | 'onPlay'
  | 'onFight'
  | 'onRecruit'
  | 'onKO'
  | 'onReveal';

// why: canonical array for drift-detection. Must match HeroAbilityTiming
// union exactly. Same pattern as HERO_KEYWORDS.

/**
 * All hero ability timings in canonical order. Single source of truth.
 */
export const HERO_ABILITY_TIMINGS: readonly HeroAbilityTiming[] = [
  'onPlay',
  'onFight',
  'onRecruit',
  'onKO',
  'onReveal',
] as const;
