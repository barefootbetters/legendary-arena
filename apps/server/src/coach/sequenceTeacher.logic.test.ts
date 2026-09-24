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

import { computeSequenceTips } from './sequenceTeacher.logic.js';
import type { CapturedHeroPlay } from '../replay/matchReplay.logic.js';
import type { LegendaryGameState } from '@legendary-arena/game-engine';
import type { HeroAbilityHook } from '@legendary-arena/game-engine';

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
