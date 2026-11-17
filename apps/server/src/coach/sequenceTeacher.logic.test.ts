/**
 * Tests for the play-order sequence teacher (WP-710 / D-24533).
 *
 * `computeSequenceTips` is a pure function over hand-built `CapturedHeroPlay[]` +
 * a hand-built reduced final state (card-data slice). No DB, no reducer, no
 * boardgame.io — the capture step's real-reducer fidelity is proven separately in
 * `matchReplay.logic.test.ts`; here we prove the teacher's decision logic:
 *
 * - Net-gain: an UNCONDITIONAL later same-class enabler → one forward tip.
 * - Never net-zero: a mutually-enabling conditional pair → NO tip.
 * - No enabler / clause held / cross-turn enabler → NO tip.
 * - Size-changing / copy-powers in the captured inPlay → predicate unsupported → NO tip.
 * - At most one tip per seat; opportunity voice (copy-lint).
 *
 * Authority: WP-710 §Contract; EC-747; D-24533.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeSequenceTips } from './sequenceTeacher.logic.js';
import type { CapturedHeroPlay } from '../replay/matchReplay.logic.js';
import type { LegendaryGameState, MatchConfiguration } from '@legendary-arena/game-engine';
import type { HeroAbilityHook } from '@legendary-arena/game-engine';
import { buildHeroAbilityHooks } from '@legendary-arena/game-engine';

// why: the copy-lint — the player/coach voice never uses these words (two-vocabulary rule).
const FORBIDDEN_WORDS = ['whiff', 'failed', 'error', 'missed', 'wasted'];

/**
 * Builds a reduced-final-state slice carrying only the maps the teacher reads:
 * `cardTraits`, `cardSizeChangingClasses`, `cardCopiedTeams`, `heroAbilityHooks`.
 *
 * @param overrides - The card-data maps to install.
 * @returns A `LegendaryGameState` (only the four read maps are meaningful).
 */
function makeFinalState(overrides: {
  cardTraits?: Record<string, { heroClass: string | null; team: string | null }>;
  cardSizeChangingClasses?: Record<string, string[]>;
  cardCopiedTeams?: Record<string, string[]>;
  heroAbilityHooks?: HeroAbilityHook[];
}): LegendaryGameState {
  return {
    cardTraits: overrides.cardTraits ?? {},
    cardSizeChangingClasses: overrides.cardSizeChangingClasses ?? {},
    cardCopiedTeams: overrides.cardCopiedTeams ?? {},
    heroAbilityHooks: overrides.heroAbilityHooks ?? [],
  } as unknown as LegendaryGameState;
}

/** why: an identity resolver keeps the tip assertions readable (name === id). */
const identityName = (cardId: string): string => cardId;

/** Builds an onPlay hook (conditions/keywords/sizeChanging all optional). */
function hook(over: Partial<HeroAbilityHook> & { cardId: string }): HeroAbilityHook {
  return { timing: 'onPlay', keywords: [], ...over } as HeroAbilityHook;
}

describe('computeSequenceTips (WP-710 / D-24533)', () => {
  test('net-gain: an unconditional later same-class enabler yields one forward tip', () => {
    const finalState = makeFinalState({
      cardTraits: {
        'arc-reactor': { heroClass: 'tech', team: null },
        'iron-man': { heroClass: 'tech', team: null },
      },
      heroAbilityHooks: [
        hook({ cardId: 'arc-reactor', conditions: [{ type: 'heroClassMatch', value: 'tech' }] }),
        // iron-man: unconditional (no snapshot-gate hook) → a valid enabler.
      ],
    });
    const heroPlays: CapturedHeroPlay[] = [
      // arc-reactor played first: only itself in play → its tech gate whiffs.
      { seat: '0', turn: 1, cardId: 'arc-reactor', inPlay: ['arc-reactor'] },
      // iron-man (tech, unconditional) played later the same turn.
      { seat: '0', turn: 1, cardId: 'iron-man', inPlay: ['arc-reactor', 'iron-man'] },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.equal(tips.length, 1, 'a net-gain reorder must produce exactly one tip');
    assert.equal(
      tips[0],
      "Next time, play iron-man before arc-reactor — you'd have landed its tech synergy bonus.",
    );
  });

  test('never net-zero: a mutually-enabling conditional pair yields NO tip', () => {
    const finalState = makeFinalState({
      cardTraits: {
        'card-a': { heroClass: 'tech', team: null },
        'card-b': { heroClass: 'tech', team: null },
      },
      heroAbilityHooks: [
        // card-a gates on a tech class-mate.
        hook({ cardId: 'card-a', conditions: [{ type: 'heroClassMatch', value: 'tech' }] }),
        // card-b is ALSO conditional (its own class gate) → NOT an unconditional enabler.
        hook({ cardId: 'card-b', conditions: [{ type: 'heroClassMatch', value: 'covert' }] }),
      ],
    });
    const heroPlays: CapturedHeroPlay[] = [
      { seat: '0', turn: 1, cardId: 'card-a', inPlay: ['card-a'] },
      { seat: '0', turn: 1, cardId: 'card-b', inPlay: ['card-a', 'card-b'] },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.equal(tips.length, 0, 'moving one half of a mutually-enabling pair is net-zero — no tip');
  });

  test('no enabler: a whiff with no later unconditional same-class hero yields NO tip', () => {
    const finalState = makeFinalState({
      cardTraits: {
        'arc-reactor': { heroClass: 'tech', team: null },
        'wolverine': { heroClass: 'ranged', team: null },
      },
      heroAbilityHooks: [
        hook({ cardId: 'arc-reactor', conditions: [{ type: 'heroClassMatch', value: 'tech' }] }),
        // wolverine is unconditional but the WRONG class → does not satisfy the tech gate.
      ],
    });
    const heroPlays: CapturedHeroPlay[] = [
      { seat: '0', turn: 1, cardId: 'arc-reactor', inPlay: ['arc-reactor'] },
      { seat: '0', turn: 1, cardId: 'wolverine', inPlay: ['arc-reactor', 'wolverine'] },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.equal(tips.length, 0, 'no same-class unconditional enabler → no reorder to teach');
  });

  test('clause held: a satisfied gate is not a whiff (no tip even with a later enabler)', () => {
    const finalState = makeFinalState({
      cardTraits: {
        'tech-early': { heroClass: 'tech', team: null },
        'arc-reactor': { heroClass: 'tech', team: null },
        'iron-man': { heroClass: 'tech', team: null },
      },
      heroAbilityHooks: [
        hook({ cardId: 'arc-reactor', conditions: [{ type: 'heroClassMatch', value: 'tech' }] }),
      ],
    });
    const heroPlays: CapturedHeroPlay[] = [
      { seat: '0', turn: 1, cardId: 'tech-early', inPlay: ['tech-early'] },
      // arc-reactor's gate HOLDS (tech-early already in play) → not a whiff.
      { seat: '0', turn: 1, cardId: 'arc-reactor', inPlay: ['tech-early', 'arc-reactor'] },
      { seat: '0', turn: 1, cardId: 'iron-man', inPlay: ['tech-early', 'arc-reactor', 'iron-man'] },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.equal(tips.length, 0, 'a gate that already held is not teachable');
  });

  test('cross-turn: an enabler played on a later turn does not fix an earlier whiff', () => {
    const finalState = makeFinalState({
      cardTraits: {
        'arc-reactor': { heroClass: 'tech', team: null },
        'iron-man': { heroClass: 'tech', team: null },
      },
      heroAbilityHooks: [
        hook({ cardId: 'arc-reactor', conditions: [{ type: 'heroClassMatch', value: 'tech' }] }),
      ],
    });
    const heroPlays: CapturedHeroPlay[] = [
      { seat: '0', turn: 1, cardId: 'arc-reactor', inPlay: ['arc-reactor'] },
      // iron-man is played on turn 2 — a reorder cannot cross turns.
      { seat: '0', turn: 2, cardId: 'iron-man', inPlay: ['iron-man'] },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.equal(tips.length, 0, 'an enabler on a different turn is not a same-turn reorder');
  });

  test('scope-out: a size-changing card in the captured inPlay yields NO tip', () => {
    const finalState = makeFinalState({
      cardTraits: {
        'arc-reactor': { heroClass: 'tech', team: null },
        'ant-man': { heroClass: 'tech', team: null },
        'iron-man': { heroClass: 'tech', team: null },
      },
      heroAbilityHooks: [
        hook({ cardId: 'arc-reactor', conditions: [{ type: 'heroClassMatch', value: 'tech' }] }),
        // ant-man is size-changing → its class could depend on an uncaptured grant, so the
        // predicate returns unsupported for any inPlay set that contains it → whiff skipped.
        hook({ cardId: 'ant-man', sizeChangingClasses: ['tech'] }),
      ],
    });
    const heroPlays: CapturedHeroPlay[] = [
      { seat: '0', turn: 1, cardId: 'arc-reactor', inPlay: ['arc-reactor', 'ant-man'] },
      { seat: '0', turn: 1, cardId: 'iron-man', inPlay: ['arc-reactor', 'ant-man', 'iron-man'] },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.equal(tips.length, 0, 'a size-changing card in inPlay scopes the whiff out (never a wrong tip)');
  });

  test('scope-out: a copy-powers enabler candidate yields NO tip', () => {
    const finalState = makeFinalState({
      cardTraits: {
        'arc-reactor': { heroClass: 'tech', team: null },
        'rogue': { heroClass: 'covert', team: null },
      },
      heroAbilityHooks: [
        hook({ cardId: 'arc-reactor', conditions: [{ type: 'heroClassMatch', value: 'tech' }] }),
        // rogue copies powers — an uncaptured copied class could satisfy the gate → unsupported.
        hook({ cardId: 'rogue', keywords: ['copy-powers'] }),
      ],
    });
    const heroPlays: CapturedHeroPlay[] = [
      { seat: '0', turn: 1, cardId: 'arc-reactor', inPlay: ['arc-reactor'] },
      { seat: '0', turn: 1, cardId: 'rogue', inPlay: ['arc-reactor', 'rogue'] },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.equal(tips.length, 0, 'a copy-powers candidate is scoped out of the enabler check');
  });

  test('at most one tip per seat even with two teachable whiffs', () => {
    const finalState = makeFinalState({
      cardTraits: {
        'arc-reactor': { heroClass: 'tech', team: null },
        'iron-man': { heroClass: 'tech', team: null },
        'psi-blade': { heroClass: 'covert', team: null },
        'nick-fury': { heroClass: 'covert', team: null },
      },
      heroAbilityHooks: [
        hook({ cardId: 'arc-reactor', conditions: [{ type: 'heroClassMatch', value: 'tech' }] }),
        hook({ cardId: 'psi-blade', conditions: [{ type: 'heroClassMatch', value: 'covert' }] }),
      ],
    });
    const heroPlays: CapturedHeroPlay[] = [
      { seat: '0', turn: 1, cardId: 'arc-reactor', inPlay: ['arc-reactor'] },
      { seat: '0', turn: 1, cardId: 'iron-man', inPlay: ['arc-reactor', 'iron-man'] },
      { seat: '0', turn: 1, cardId: 'psi-blade', inPlay: ['arc-reactor', 'iron-man', 'psi-blade'] },
      { seat: '0', turn: 1, cardId: 'nick-fury', inPlay: ['arc-reactor', 'iron-man', 'psi-blade', 'nick-fury'] },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.equal(tips.length, 1, 'the one-tip-per-seat cap holds even with multiple teachable whiffs');
  });

  test('one tip per seat across two seats (both teachable)', () => {
    const finalState = makeFinalState({
      cardTraits: {
        'arc-reactor': { heroClass: 'tech', team: null },
        'iron-man': { heroClass: 'tech', team: null },
      },
      heroAbilityHooks: [
        hook({ cardId: 'arc-reactor', conditions: [{ type: 'heroClassMatch', value: 'tech' }] }),
      ],
    });
    const heroPlays: CapturedHeroPlay[] = [
      { seat: '0', turn: 1, cardId: 'arc-reactor', inPlay: ['arc-reactor'] },
      { seat: '0', turn: 1, cardId: 'iron-man', inPlay: ['arc-reactor', 'iron-man'] },
      { seat: '1', turn: 2, cardId: 'arc-reactor', inPlay: ['arc-reactor'] },
      { seat: '1', turn: 2, cardId: 'iron-man', inPlay: ['arc-reactor', 'iron-man'] },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.equal(tips.length, 2, 'each teachable seat contributes one tip');
  });

  test('an empty play list yields no tips', () => {
    const tips = computeSequenceTips([], makeFinalState({}), identityName);
    assert.equal(tips.length, 0);
  });

  test('copy-lint: emitted tips use opportunity voice only', () => {
    const finalState = makeFinalState({
      cardTraits: {
        'arc-reactor': { heroClass: 'tech', team: null },
        'iron-man': { heroClass: 'tech', team: null },
      },
      heroAbilityHooks: [
        hook({ cardId: 'arc-reactor', conditions: [{ type: 'heroClassMatch', value: 'tech' }] }),
      ],
    });
    const heroPlays: CapturedHeroPlay[] = [
      { seat: '0', turn: 1, cardId: 'arc-reactor', inPlay: ['arc-reactor'] },
      { seat: '0', turn: 1, cardId: 'iron-man', inPlay: ['arc-reactor', 'iron-man'] },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.equal(tips.length, 1);
    for (const forbidden of FORBIDDEN_WORDS) {
      assert.equal(
        tips[0]!.toLowerCase().includes(forbidden),
        false,
        `tip must not contain the forbidden word "${forbidden}": ${tips[0]}`,
      );
    }
  });

  test('a requiresTeam gate is also teachable', () => {
    const finalState = makeFinalState({
      cardTraits: {
        'team-card': { heroClass: 'covert', team: 'avengers' },
        'avenger-enabler': { heroClass: 'tech', team: 'avengers' },
      },
      heroAbilityHooks: [
        hook({ cardId: 'team-card', conditions: [{ type: 'requiresTeam', value: 'avengers' }] }),
      ],
    });
    const heroPlays: CapturedHeroPlay[] = [
      { seat: '0', turn: 1, cardId: 'team-card', inPlay: ['team-card'] },
      { seat: '0', turn: 1, cardId: 'avenger-enabler', inPlay: ['team-card', 'avenger-enabler'] },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.equal(tips.length, 1, 'a requiresTeam gate with a same-team unconditional enabler is teachable');
    assert.equal(
      tips[0],
      "Next time, play avenger-enabler before team-card — you'd have landed its avengers synergy bonus.",
    );
  });

  // why: D-24579 — production card ids are per-copy (`set/hero/card#N`) and the
  // registry resolver does not map them, so tip text must come from the match's
  // own cardDisplayData, or players would read raw ids.
  test('tip text names cards from the match cardDisplayData, not raw per-copy ids', () => {
    const finalState = {
      ...makeFinalState({
        cardTraits: {
          'core/iron-man/arc-reactor#0': { heroClass: 'tech', team: null },
          'core/iron-man/repulsor-rays#1': { heroClass: 'tech', team: null },
        },
        heroAbilityHooks: [
          hook({ cardId: 'core/iron-man/arc-reactor#0', conditions: [{ type: 'heroClassMatch', value: 'tech' }] }),
        ],
      }),
      cardDisplayData: {
        'core/iron-man/arc-reactor#0': { name: 'Arc Reactor' },
        'core/iron-man/repulsor-rays#1': { name: 'Repulsor Rays' },
      },
    } as unknown as LegendaryGameState;
    const heroPlays: CapturedHeroPlay[] = [
      { seat: '0', turn: 1, cardId: 'core/iron-man/arc-reactor#0', inPlay: ['core/iron-man/arc-reactor#0'] },
      {
        seat: '0',
        turn: 1,
        cardId: 'core/iron-man/repulsor-rays#1',
        inPlay: ['core/iron-man/arc-reactor#0', 'core/iron-man/repulsor-rays#1'],
      },
    ];

    const tips = computeSequenceTips(heroPlays, finalState, identityName);

    assert.deepEqual(tips, [
      "Next time, play Repulsor Rays before Arc Reactor — you'd have landed its tech synergy bonus.",
    ]);
  });
});

// ---------------------------------------------------------------------------
// WP-900 / D-24857 — order-safe enablers, over the committed card data
// ---------------------------------------------------------------------------

/** One real card under test, and what its hooks must carry. */
interface RealEnablerCard {
  setAbbr: string;
  heroSlug: string;
  cardSlug: string;
  /** Asserts the parsed hooks carry the order-dependent structure under test. */
  assertStructure: (hooks: readonly HeroAbilityHook[]) => void;
}

/** The parsed first copy of a real card, plus its printed class, team and name. */
interface ParsedRealCard {
  cardId: string;
  heroClass: string;
  team: string | null;
  displayName: string;
  hooks: HeroAbilityHook[];
}

// why: WP-900 / D-24857 — hooks are parsed from the COMMITTED data/cards JSON (the
// hero/firstCardPlayed.test.ts reader), so these cases prove the shipped parse, not a
// hand-typed literal. Resolved from this test's own location to the repo root.
const CARD_DATA_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

/** The hand-built card whose class gate whiffs when played first. */
const GATED_TEST_CARD = 'test/gated/class-gated#0';

/**
 * Parses one real card's first copy from the committed set file.
 *
 * @param card - The card under test.
 * @returns Its id, printed class / team / name, and parsed hooks.
 */
function parseRealCard(card: RealEnablerCard): ParsedRealCard {
  const setData = JSON.parse(readFileSync(join(CARD_DATA_DIRECTORY, `${card.setAbbr}.json`), 'utf8'));
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === card.setAbbr ? setData : undefined) };
  const config = { heroDeckIds: [`${card.setAbbr}/${card.heroSlug}`] } as unknown as MatchConfiguration;
  const cardId = `${card.setAbbr}/${card.heroSlug}/${card.cardSlug}#0`;
  const hooks = buildHeroAbilityHooks(registry, config).filter((cardHook) => cardHook.cardId === cardId);
  const hero = setData.heroes.find((entry: { slug: string }) => entry.slug === card.heroSlug);
  const printed = hero.cards.find((entry: { slug: string }) => entry.slug === card.cardSlug);
  assert.ok(hooks.length > 0, `${cardId} must parse to at least one hook`);
  return { cardId, heroClass: printed.hc, team: hero.team ?? null, displayName: printed.displayName, hooks };
}

/**
 * Builds the reduced final state for "the gated test card whiffs, then the real card is played".
 *
 * @param realCard - The parsed real card.
 * @param isRealCardHooksKept - False drops the real card's hooks (the in-file control).
 * @returns The final-state slice the teacher reads.
 */
function makeRealCardFinalState(realCard: ParsedRealCard, isRealCardHooksKept: boolean): LegendaryGameState {
  const gatedHook = hook({ cardId: GATED_TEST_CARD, conditions: [{ type: 'heroClassMatch', value: realCard.heroClass }] });
  const heroAbilityHooks = isRealCardHooksKept ? [gatedHook, ...realCard.hooks] : [gatedHook];
  return {
    ...makeFinalState({
      cardTraits: {
        [GATED_TEST_CARD]: { heroClass: 'grey', team: null },
        [realCard.cardId]: { heroClass: realCard.heroClass, team: realCard.team },
      },
      heroAbilityHooks,
    }),
    cardDisplayData: {
      [GATED_TEST_CARD]: { name: 'Gated Test Card' },
      [realCard.cardId]: { name: realCard.displayName },
    },
  } as unknown as LegendaryGameState;
}

/**
 * The two plays: the gated card first (alone, so its class gate whiffs), the real card later.
 *
 * @param realCard - The parsed real card.
 * @returns The captured plays.
 */
function makeRealCardPlays(realCard: ParsedRealCard): CapturedHeroPlay[] {
  return [
    { seat: '0', turn: 1, cardId: GATED_TEST_CARD, inPlay: [GATED_TEST_CARD] },
    { seat: '0', turn: 1, cardId: realCard.cardId, inPlay: [GATED_TEST_CARD, realCard.cardId] },
  ];
}

/**
 * Builds a structure assertion: some hook carries a condition of the given type.
 *
 * @param conditionType - The expected condition type.
 * @returns The structure assertion.
 */
function hasConditionType(conditionType: string): (hooks: readonly HeroAbilityHook[]) => void {
  return (hooks) => {
    const isPresent = hooks.some((cardHook) =>
      (cardHook.conditions ?? []).some((condition) => condition.type === conditionType),
    );
    assert.ok(isPresent, `expected a ${conditionType} condition`);
  };
}

/**
 * Builds a structure assertion: some hook carries an effect matching the predicate.
 *
 * @param description - What the effect must carry (for the failure message).
 * @param isMatch - The effect predicate.
 * @returns The structure assertion.
 */
function hasEffect(
  description: string,
  isMatch: (effect: NonNullable<HeroAbilityHook['effects']>[number]) => boolean,
): (hooks: readonly HeroAbilityHook[]) => void {
  return (hooks) => {
    assert.ok(hooks.some((cardHook) => (cardHook.effects ?? []).some(isMatch)), `expected ${description}`);
  };
}

const ORDER_DEPENDENT_CARDS: readonly RealEnablerCard[] = [
  { setAbbr: 'ca75', heroSlug: 'winter-soldier', cardSlug: 'kgb-training', assertStructure: hasConditionType('playedThisTurn') },
  { setAbbr: 'vill', heroSlug: 'dr-octopus', cardSlug: 'eighth-times-a-charm', assertStructure: hasConditionType('cardPlayOrdinalEquals') },
  { setAbbr: 'ff04', heroSlug: 'invisible-woman', cardSlug: 'four-of-a-kind', assertStructure: hasConditionType('otherCardOfCostPlayedThisTurn') },
  { setAbbr: 'mdns', heroSlug: 'blade-daywalker', cardSlug: 'hunt-high-and-low', assertStructure: hasConditionType('patrolSpaceEmpty') },
  {
    setAbbr: 'ca75',
    heroSlug: 'captain-america-falcon',
    cardSlug: 'winged-salvation',
    assertStructure: hasConditionType('bystandersInVictoryAtLeast'),
  },
  {
    setAbbr: 'core',
    heroSlug: 'deadpool',
    cardSlug: 'oddball',
    assertStructure: hasEffect('a count-scaled effect', (effect) => effect.countSource !== undefined),
  },
  {
    setAbbr: 'xmen',
    heroSlug: 'legion',
    cardSlug: 'bend-steel',
    assertStructure: (hooks) => {
      assert.ok(hooks.some((cardHook) => (cardHook.primitiveEffects ?? []).length > 0), 'expected a composition primitive');
    },
  },
  {
    setAbbr: 'vnom',
    heroSlug: 'venom',
    cardSlug: 'devouring-drool',
    assertStructure: hasEffect(
      'a digest effect with a bothCondition',
      (effect) => effect.bothCondition !== undefined && effect.digestThreshold !== undefined,
    ),
  },
  {
    setAbbr: 'vnom',
    heroSlug: 'venompool',
    cardSlug: 'shenanigans',
    assertStructure: hasEffect('a no-more-draws effect', (effect) => effect.type === 'no-more-draws'),
  },
];

const ORDER_SAFE_CARDS: readonly RealEnablerCard[] = [
  { setAbbr: 'core', heroSlug: 'thor', cardSlug: 'surge-of-power', assertStructure: hasConditionType('recruitMadeThisTurnAtLeast') },
  { setAbbr: 'dkcy', heroSlug: 'elektra', cardSlug: 'first-strike', assertStructure: hasConditionType('firstHeroPlayedThisTurn') },
];

describe('computeSequenceTips — order-safe enablers over real card data (WP-900 / D-24857)', () => {
  for (const card of ORDER_DEPENDENT_CARDS) {
    test(`no tip names ${card.cardSlug}, whose own bonus depends on play order`, () => {
      const realCard = parseRealCard(card);
      card.assertStructure(realCard.hooks);

      const tips = computeSequenceTips(makeRealCardPlays(realCard), makeRealCardFinalState(realCard, true), identityName);
      assert.deepEqual(tips, [], `${realCard.displayName} must not be named as an enabler`);

      // why: WP-900 / D-24857 — the in-file control. With its hooks removed the real card is an
      // unconditional same-class enabler, so the same plays must tip; the no-tip above therefore
      // comes from order safety, not from a drifted fixture.
      const controlTips = computeSequenceTips(makeRealCardPlays(realCard), makeRealCardFinalState(realCard, false), identityName);
      assert.equal(controlTips.length, 1, `the hookless control for ${realCard.displayName} must tip`);
    });
  }

  for (const card of ORDER_SAFE_CARDS) {
    test(`an order-safe ${card.cardSlug} is still named as the enabler`, () => {
      const realCard = parseRealCard(card);
      card.assertStructure(realCard.hooks);

      const tips = computeSequenceTips(makeRealCardPlays(realCard), makeRealCardFinalState(realCard, true), identityName);
      assert.deepEqual(tips, [
        `Next time, play ${realCard.displayName} before Gated Test Card — you'd have landed its ${realCard.heroClass} synergy bonus.`,
      ]);
    });
  }
});
