/**
 * co2e Crazed Rampage reveal-or-gain-a-Wound (WP-843 / D-24777).
 *
 * `co2e/hulk/crazed-rampage` prints "Each player reveals another [hc:strength] Hero or gains a
 * Wound." The mid-sentence `[hc:strength]` used to be mis-parsed as a `heroClassMatch` play-gate
 * (the card blocked "needs another Strength Hero played this turn"), and the line had no effect
 * marker, so it did nothing. These tests pin the fix: the parser reads the token as the reveal
 * criterion (no gate), and the handler wounds each player who cannot reveal another Strength Hero.
 *
 * Handler tests dispatch through executeSingleEffect so the magnitude pre-gate is exercised (the
 * NO_MAGNITUDE_KEYWORDS control run). Fixtures use per-copy `#N` ids.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { executeSingleEffect } from './heroEffects.execute.js';
import { formatCardRef } from '../log/logDisplay.js';
import { composeWoundOutcomeClause } from '../events/notableEvents.compose.js';
import { openRevealOrWoundSeatChoiceIfNeeded } from '../moves/revealOrWoundChoice.logic.js';
import { resolveSeatChoice } from '../moves/seatChoice.resolve.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import type { LegendaryGameState } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { HeroEffectDescriptor } from '../rules/heroAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import {
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

const mockCtx = {
  ctx: { turn: 1 },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

const CRAZED_RAMPAGE_LINE =
  'Each player reveals another [hc:strength] Hero or gains a Wound. [keyword:reveal-or-gain-wound-each]';

// why: AC-4 — per-copy ids; a bare id shared by two copies would make the "another" exclusion
// skip both copies and hide the second-copy case.
const RESOLVING_RAMPAGE = 'co2e/hulk/crazed-rampage#0' as CardExtId;
const OTHER_RAMPAGE = 'co2e/hulk/crazed-rampage#1' as CardExtId;
const STRENGTH_CARD = 'test/strong/smash#0' as CardExtId;
const RANGED_CARD = 'test/zapper/zap#0' as CardExtId;
const DIVING_BLOCK = 'core/captain-america/diving-block#0' as CardExtId;

const RAMPAGE_EFFECT: HeroEffectDescriptor = {
  type: 'reveal-or-gain-wound-each',
  revealCriterion: { kind: 'hero-class', heroClass: 'strength' },
};

/** Minimal 1-copy registry exposing getSet, mirroring the Psychic Link parser harness. */
function makeHulkRegistry(abilityLine: string) {
  const setData = {
    abbr: 'co2e',
    heroes: [
      {
        slug: 'hulk',
        cards: [{ slug: 'crazed-rampage', rarityLabel: 'Common', abilities: [abilityLine] }],
        physicalCards: [{ id: 'p0', count: 1, sides: ['crazed-rampage'] }],
      },
    ],
    villains: [], henchmen: [], schemes: [], masterminds: [], bystanders: [], wounds: [], other: [],
  };
  return {
    listCards: () => [],
    listSets: () => [{ abbr: 'co2e' }],
    getSet: (abbr: string) => (abbr === 'co2e' ? setData : undefined),
  };
}

/** A match config naming only the co2e Hulk hero deck. */
function makeConfig(): MatchSetupConfig {
  return {
    schemeId: 'test/scheme', mastermindId: 'test/mm',
    villainGroupIds: ['test/vg'], henchmanGroupIds: ['test/hg'],
    heroDeckIds: ['co2e/hulk'],
    bystandersCount: 10, woundsCount: 15, officersCount: 20, sidekicksCount: 5,
  };
}

/** A game state with the given hands, play areas and Wound supply, for handler tests. */
function makeRampageState(
  hands: Record<string, CardExtId[]>,
  inPlay: Record<string, CardExtId[]>,
  wounds: CardExtId[],
): LegendaryGameState {
  const playerZones: Record<string, unknown> = {};
  for (const playerId of Object.keys(hands)) {
    playerZones[playerId] = {
      ...makePlayerZones(),
      hand: hands[playerId],
      inPlay: inPlay[playerId] ?? [],
    };
  }
  return {
    messages: [],
    turnEconomy: makeTurnEconomy(),
    playerZones,
    piles: makeGlobalPiles({ wounds }),
    mastermind: makeMastermindState(),
    heroAbilityHooks: [],
    // why: both Crazed Rampage copies are Strength Heroes, so the "another" exclusion of the
    // resolving copy is load-bearing; the ranged card never matches the criterion.
    cardTraits: {
      [RESOLVING_RAMPAGE]: { team: 'avengers', heroClass: 'strength' },
      [OTHER_RAMPAGE]: { team: 'avengers', heroClass: 'strength' },
      [STRENGTH_CARD]: { team: 'avengers', heroClass: 'strength' },
      [RANGED_CARD]: { team: 'avengers', heroClass: 'ranged' },
      [DIVING_BLOCK]: { team: 'avengers', heroClass: 'instinct' },
    },
    cardStats: {},
    cardDisplayData: {},
  } as unknown as LegendaryGameState;
}

/** Plays the resolving Crazed Rampage for player 0 through the real dispatch path. */
function resolveRampage(G: LegendaryGameState): void {
  executeSingleEffect(G, mockCtx, '0', RESOLVING_RAMPAGE, RAMPAGE_EFFECT);
}

const RAMPAGE_REF = formatCardRef({}, RESOLVING_RAMPAGE);

/**
 * The seats queued to choose reveal-or-gain-a-Wound (WP-845 / D-24779), or [] when none.
 *
 * @param G - The game state after the effect.
 * @returns The front entry's revealing seats.
 */
function queuedSeats(G: LegendaryGameState): string[] {
  return G.pendingRevealOrWoundChoices?.[0]?.revealingSeats ?? [];
}

describe('Crazed Rampage parser (WP-843 / D-24777)', () => {
  it('AC-1: emits the reveal-or-gain-wound-each effect with the strength criterion and no gate', () => {
    const hooks = buildHeroAbilityHooks(makeHulkRegistry(CRAZED_RAMPAGE_LINE), makeConfig());
    const rampageHooks = hooks.filter((hook) => hook.cardId.includes('crazed-rampage'));
    assert.equal(rampageHooks.length, 1, 'a 1-copy registry yields one Crazed Rampage hook');
    const rampageHook = rampageHooks[0]!;

    assert.deepStrictEqual(rampageHook.effects, [
      { type: 'reveal-or-gain-wound-each', revealCriterion: { kind: 'hero-class', heroClass: 'strength' } },
    ]);
    const conditions = rampageHook.conditions ?? [];
    assert.equal(conditions.some((condition) => condition.type === 'heroClassMatch'), false, 'no heroClassMatch gate');
    assert.equal(conditions.some((condition) => condition.type === 'requiresTeam'), false, 'no requiresTeam gate');
    assert.equal(rampageHook.keywords.includes('conditional'), false, 'no conditional keyword');
    assert.equal((rampageHook.unresolvedMarkers ?? []).includes('gate-only'), false, 'no gate-only marker');
    assert.equal(
      (rampageHook.effects ?? []).some((effect) => effect.type === 'reveal-from-hand'),
      false,
      'the reveal-from-hand draw never fires on a reveal-or-wound line',
    );
  });

  it('AC-2: the marker with no [hc:X] / [team:X] token is an honest hollow', () => {
    const tokenlessLine = 'Each player reveals another Hero or gains a Wound. [keyword:reveal-or-gain-wound-each]';
    const hooks = buildHeroAbilityHooks(makeHulkRegistry(tokenlessLine), makeConfig());
    const rampageHook = hooks.find((hook) => hook.cardId.includes('crazed-rampage'));
    assert.ok(rampageHook !== undefined, 'a crazed-rampage hook must exist');

    assert.equal(
      (rampageHook!.effects ?? []).some((effect) => effect.type === 'reveal-or-gain-wound-each'),
      false,
      'no criterion → no effect',
    );
    assert.ok(
      (rampageHook!.unresolvedMarkers ?? []).includes('reveal-or-gain-wound-each'),
      'the keyword is recorded as an unresolved marker',
    );
  });
});

describe('Crazed Rampage handler (WP-843 / D-24777)', () => {
  it('AC-3: only the playing player without another Strength Hero gains a Wound', () => {
    const G = makeRampageState(
      { '0': [RANGED_CARD], '1': [STRENGTH_CARD] },
      { '0': [RESOLVING_RAMPAGE] },
      ['wound-a', 'wound-b'] as CardExtId[],
    );
    resolveRampage(G);

    assert.deepStrictEqual(G.piles.wounds, ['wound-b'], 'the Wound supply lost its top card');
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['wound-a'], 'player 0 gained the Wound');
    assert.equal(G.turnEconomy.woundsDrawn, 1, 'the playing player woundsDrawn bumped');
    assert.deepStrictEqual(G.playerZones['1']!.hand, [STRENGTH_CARD], 'player 1 hand unchanged');
    assert.deepStrictEqual(G.playerZones['1']!.discard, [], 'player 1 gained nothing');
    // why: WP-845 / D-24779 — player 1 can reveal, so they are queued to choose after the move;
    // the cannot-reveal line comes first, then the enqueue line (was: exactly one log line).
    assert.equal(G.messages.length, 2, 'the cannot-reveal line, then the enqueue line');
    assert.equal(
      G.messages[0]!.text,
      `Each player without another Strength Hero gained a Wound (${RAMPAGE_REF}): Player 0.`,
    );
    assert.equal(G.messages[0]!.outcome, 'applied');
    assert.equal(G.messages[0]!.card, RESOLVING_RAMPAGE, 'attributed to the resolving card');
    assert.equal(
      G.messages[1]!.text,
      `Player 1 can reveal another Strength Hero and will choose whether to reveal it or gain a Wound (${RAMPAGE_REF}).`,
    );
    assert.equal(G.messages[1]!.outcome, 'neutral');
    assert.equal(G.messages[1]!.card, RESOLVING_RAMPAGE);
    assert.deepStrictEqual(G.pendingRevealOrWoundChoices?.map((entry) => entry.revealingSeats), [['1']]);
  });

  it('every player without a match is wounded, listed in sorted seat order', () => {
    const G = makeRampageState(
      { '2': [RANGED_CARD], '0': [RANGED_CARD], '1': [] },
      { '0': [RESOLVING_RAMPAGE] },
      ['wound-a', 'wound-b', 'wound-c'] as CardExtId[],
    );
    resolveRampage(G);

    assert.deepStrictEqual(G.playerZones['0']!.discard, ['wound-a']);
    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-b']);
    assert.deepStrictEqual(G.playerZones['2']!.discard, ['wound-c']);
    assert.equal(
      G.messages[0]!.text,
      `Each player without another Strength Hero gained a Wound (${RAMPAGE_REF}): Player 0, Player 1, Player 2.`,
    );
  });
});

describe('Crazed Rampage "another" scope (WP-843 / D-24731)', () => {
  it('AC-4: a Strength Hero played earlier this turn lets the playing player avoid the Wound', () => {
    const G = makeRampageState(
      { '0': [RANGED_CARD], '1': [STRENGTH_CARD] },
      { '0': [STRENGTH_CARD, RESOLVING_RAMPAGE] },
      ['wound-a'] as CardExtId[],
    );
    resolveRampage(G);

    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'player 0 revealed the played Strength Hero');
    assert.deepStrictEqual(G.playerZones['0']!.inPlay, [STRENGTH_CARD, RESOLVING_RAMPAGE], 'the reveal moves nothing');
    assert.equal(G.turnEconomy.woundsDrawn, 0);
    // why: WP-845 / D-24779 — "can reveal" now queues the player's choice instead of revealing.
    assert.deepStrictEqual(queuedSeats(G), ['0', '1'], 'the played Strength Hero lets player 0 choose');
  });

  it('AC-4: the resolving Crazed Rampage alone in play does not count as another', () => {
    const G = makeRampageState(
      { '0': [], '1': [STRENGTH_CARD] },
      { '0': [RESOLVING_RAMPAGE] },
      ['wound-a'] as CardExtId[],
    );
    resolveRampage(G);

    assert.deepStrictEqual(G.playerZones['0']!.discard, ['wound-a'], 'the card cannot reveal itself');
    assert.deepStrictEqual(queuedSeats(G), ['1'], 'only player 1 is queued');
  });

  it('AC-4: a Strength Hero in a non-playing player play area does not count for them', () => {
    const G = makeRampageState(
      { '0': [STRENGTH_CARD], '1': [RANGED_CARD] },
      { '0': [RESOLVING_RAMPAGE], '1': [STRENGTH_CARD] },
      ['wound-a'] as CardExtId[],
    );
    resolveRampage(G);

    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'player 0 revealed from hand');
    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-a'], 'player 1 reveals from hand only');
    assert.deepStrictEqual(queuedSeats(G), ['0'], 'player 0 can reveal from hand and is queued');
  });

  it('AC-4: a second Crazed Rampage copy in hand counts as another Strength Hero', () => {
    const G = makeRampageState(
      { '0': [OTHER_RAMPAGE], '1': [STRENGTH_CARD] },
      { '0': [RESOLVING_RAMPAGE] },
      ['wound-a'] as CardExtId[],
    );
    resolveRampage(G);

    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'the second copy in hand is revealed');
    assert.deepStrictEqual(queuedSeats(G), ['0', '1'], 'the second copy in hand lets player 0 choose');
  });

  it('AC-4: a second Crazed Rampage copy played earlier this turn counts as another Strength Hero', () => {
    const G = makeRampageState(
      { '0': [RANGED_CARD], '1': [STRENGTH_CARD] },
      { '0': [OTHER_RAMPAGE, RESOLVING_RAMPAGE] },
      ['wound-a'] as CardExtId[],
    );
    resolveRampage(G);

    assert.deepStrictEqual(G.playerZones['0']!.discard, [], 'the earlier-played copy is revealed');
    assert.deepStrictEqual(queuedSeats(G), ['0', '1'], 'the earlier-played copy lets player 0 choose');
  });
});

describe('Crazed Rampage no-Wound outcomes (WP-843 / D-24686)', () => {
  // why: WP-845 / D-24779 — was "one blocked 'Every player revealed …' line" at effect time. Every
  // player can reveal, so both are queued (one neutral enqueue line), and the blocked outcome
  // comes from the apply once both choose Reveal.
  it('AC-5: every player reveals → no Wound and one blocked line', () => {
    const G = makeRampageState(
      { '0': [STRENGTH_CARD], '1': [STRENGTH_CARD] },
      { '0': [RESOLVING_RAMPAGE] },
      ['wound-a'] as CardExtId[],
    );
    resolveRampage(G);

    assert.deepStrictEqual(G.piles.wounds, ['wound-a'], 'no Wound left the supply');
    assert.equal(G.messages.length, 1);
    assert.equal(
      G.messages[0]!.text,
      `Player 0, Player 1 can reveal another Strength Hero and will choose whether to reveal it or gain a Wound (${RAMPAGE_REF}).`,
    );
    assert.equal(G.messages[0]!.outcome, 'neutral');
    assert.equal(G.messages[0]!.card, RESOLVING_RAMPAGE);

    G.counters = {};
    openRevealOrWoundSeatChoiceIfNeeded(G, undefined, '0');
    for (const seat of ['0', '1']) {
      resolveSeatChoice(makeMockMoveContext(G, { playerID: seat, numPlayers: 2 }), { optionIndex: 0 });
    }
    assert.deepStrictEqual(G.piles.wounds, ['wound-a'], 'no Wound left the supply');
    const applyLine = G.messages.at(-1)!;
    assert.equal(applyLine.text, `Reveal or gain a Wound (${RAMPAGE_REF}): Player 0, Player 1 revealed.`);
    assert.equal(applyLine.outcome, 'blocked');
    assert.equal(applyLine.card, RESOLVING_RAMPAGE);
  });

  it('AC-5: an empty Wound supply logs the empty-supply line and never says every player revealed', () => {
    const G = makeRampageState(
      { '0': [RANGED_CARD], '1': [STRENGTH_CARD] },
      { '0': [RESOLVING_RAMPAGE] },
      [],
    );
    assert.doesNotThrow(() => resolveRampage(G));

    assert.deepStrictEqual(G.playerZones['0']!.discard, []);
    assert.equal(G.turnEconomy.woundsDrawn, 0, 'no woundsDrawn bump for a Wound that never landed');
    const texts = G.messages.map((entry) => entry.text);
    // why: WP-845 / D-24779 — player 1 can reveal and is queued, so the enqueue line follows the
    // empty-supply line (was: the empty-supply line alone).
    assert.deepStrictEqual(texts, [
      'Player 0 could not gain a Wound — the Wound supply is empty.',
      `Player 1 can reveal another Strength Hero and will choose whether to reveal it or gain a Wound (${RAMPAGE_REF}).`,
    ]);
    assert.equal(G.messages[0]!.outcome, 'blocked');
    assert.ok(!texts.some((text) => text.startsWith('Every player revealed')), 'the D-24686 bug class stays fixed');
  });
});

describe('Crazed Rampage woundsDrawn and Diving Block (WP-843 / D-24777)', () => {
  it('AC-6: a non-playing player who gains the Wound does not move woundsDrawn', () => {
    const G = makeRampageState(
      { '0': [STRENGTH_CARD], '1': [RANGED_CARD] },
      { '0': [RESOLVING_RAMPAGE] },
      ['wound-a'] as CardExtId[],
    );
    resolveRampage(G);

    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-a'], 'player 1 gained the Wound');
    assert.equal(G.turnEconomy.woundsDrawn, 0, 'the playing player woundsDrawn is untouched');
    assert.equal(
      G.messages[0]!.text,
      `Each player without another Strength Hero gained a Wound (${RAMPAGE_REF}): Player 1.`,
    );
  });

  it('AC-10: a wounded non-playing player holding Diving Block gets the Wound first, then the undo offer', () => {
    const G = makeRampageState(
      { '0': [STRENGTH_CARD], '1': [DIVING_BLOCK] },
      { '0': [RESOLVING_RAMPAGE] },
      ['wound-a', 'wound-b'] as CardExtId[],
    );
    G.heroAbilityHooks = [
      { cardId: DIVING_BLOCK, timing: 'onPlay', keywords: ['diving-block'] },
    ] as unknown as LegendaryGameState['heroAbilityHooks'];
    resolveRampage(G);

    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-a'], 'the Wound lands before the undo');
    assert.deepStrictEqual(G.pendingDivingBlockWounds, [{ playerID: '1', woundCardId: 'wound-a' }]);
    // why: WP-845 / D-24779 — player 0 can reveal, so the enqueue line now follows the summary
    // line; the summary is the one before it (was: the last message).
    const lastMessage = G.messages[G.messages.length - 2]!;
    assert.equal(G.messages.length, 2);
    assert.match(G.messages[1]!.text, /^Player 0 can reveal another Strength Hero/);
    assert.equal(
      lastMessage.text,
      `Each player without another Strength Hero gains a Wound (${RAMPAGE_REF}): ${composeWoundOutcomeClause([], ['1'])}.`,
    );
    assert.equal(
      lastMessage.text,
      `Each player without another Strength Hero gains a Wound (${RAMPAGE_REF}): Player 1 would gain a Wound — Diving Block can prevent it.`,
    );
    assert.equal(lastMessage.outcome, 'applied');
    assert.equal(lastMessage.card, RESOLVING_RAMPAGE);
  });
});

describe('Crazed Rampage each-player order (WP-846 / D-24780)', () => {
  it('AC-8 H7: on seat 1\'s turn the cannot-reveal seats gain Wounds in order 1, 2, 0', () => {
    const G = makeRampageState(
      { '0': [RANGED_CARD], '1': [RANGED_CARD], '2': [RANGED_CARD] },
      { '1': [RESOLVING_RAMPAGE] },
      ['wound-a', 'wound-b', 'wound-c'] as CardExtId[],
    );
    executeSingleEffect(G, mockCtx, '1', RESOLVING_RAMPAGE, RAMPAGE_EFFECT);

    assert.deepStrictEqual(G.playerZones['1']!.discard, ['wound-a'], 'the current player takes the top Wound');
    assert.deepStrictEqual(G.playerZones['2']!.discard, ['wound-b']);
    assert.deepStrictEqual(G.playerZones['0']!.discard, ['wound-c']);
    assert.equal(
      G.messages[0]!.text,
      `Each player without another Strength Hero gained a Wound (${RAMPAGE_REF}): Player 1, Player 2, Player 0.`,
    );
  });

  it('AC-8 H7: the queued revealers stay ascending (WP-845 apply order) while the log follows turn order', () => {
    const G = makeRampageState(
      { '0': [STRENGTH_CARD], '1': [RANGED_CARD], '2': [STRENGTH_CARD] },
      { '1': [RESOLVING_RAMPAGE] },
      ['wound-a', 'wound-b'] as CardExtId[],
    );
    executeSingleEffect(G, mockCtx, '1', RESOLVING_RAMPAGE, RAMPAGE_EFFECT);

    assert.deepStrictEqual(queuedSeats(G), ['0', '2'], 'enqueueRevealOrWoundChoice sorts the revealers ascending');
    assert.match(G.messages[1]!.text, /^Player 2, Player 0 can reveal another Strength Hero/);
  });
});
