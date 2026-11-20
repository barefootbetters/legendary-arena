/**
 * The bkwd Elite Assassins do what they print (WP-902 / D-24859).
 *
 * Parse coverage builds the REAL villain hooks from the committed `data/cards/bkwd.json`; the
 * behavioural tests fire the executor handlers and drive the exported owed-choice builders /
 * applies and the fight-pick seam directly. No boardgame.io imports — node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { executeVillainAbilitiesWithNarrative } from './villainEffects.execute.js';
import { resolveFightCost } from '../economy/economy.resolve.js';
import {
  buildVillainEffectAnyCardDiscardChoice,
  buildNonGreyHeroDiscardThenDrawChoice,
  applyVillainEffectNonGreyDiscardThenDraw,
  buildNonGreyHeroUndercoverChoice,
  applyVillainEffectUndercoverEachPlayer,
} from '../villainDeck/villainEscapeProcedure.js';
import {
  returnUndercoverHeroToHand,
  isYourHeroUndercoverCandidate,
} from '../hero/heroEffects.execute.js';
import {
  queueVillainFightPick,
  openVillainFightPickSeatChoiceIfNeeded,
  applyVillainFightPickResolvedSeatChoice,
} from '../moves/villainFightPick.logic.js';
import { WOUND_EXT_ID, BYSTANDER_EXT_ID } from '../setup/pilesInit.js';
import { makeMockMoveContext } from '../test/mockMoveContext.js';
import { makePlayerZones, makeGlobalPiles, makeTurnEconomy, makeMastermindState } from '../test/fixtureBuilders.js';
import type { LegendaryGameState, MatchConfiguration, PendingSeatChoice } from '../types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { ShuffleProvider } from '../setup/shuffle.js';

const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const BLUE_TALON = 'bkwd-villain-elite-assassins-blue-talon-00' as CardExtId;
const IRON_MAIDEN = 'bkwd-villain-elite-assassins-iron-maiden-00' as CardExtId;
const SNAPDRAGON = 'bkwd-villain-elite-assassins-snapdragon-00' as CardExtId;
const BLACK_LOTUS = 'bkwd-villain-elite-assassins-black-lotus-00' as CardExtId;

/** Builds the real Elite Assassins hooks from the committed bkwd.json. */
function buildEliteAssassinsHooks(): LegendaryGameState['villainAbilityHooks'] {
  const bkwd = JSON.parse(readFileSync(join(CARDS_DIRECTORY, 'bkwd.json'), 'utf8')) as unknown;
  const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'bkwd' ? bkwd : undefined) };
  const config = { villainGroupIds: ['bkwd/elite-assassins'], henchmanGroupIds: [] } as unknown as MatchConfiguration;
  return buildVillainAbilityHooks(registry, config);
}

const ELITE_ASSASSINS_HOOKS = buildEliteAssassinsHooks();

/** The effects of a card's hook at a timing (from the real parse). */
function effectsAt(cardSlug: string, timing: 'onAmbush' | 'onFight'): { primitive: string; magnitude?: number }[] {
  const cardId = `bkwd-villain-elite-assassins-${cardSlug}-00`;
  for (const hook of ELITE_ASSASSINS_HOOKS) {
    if (hook.cardId === cardId && hook.timing === timing) {
      return hook.effects.map((effect) => ({ primitive: effect.primitive, ...(effect.magnitude !== undefined ? { magnitude: effect.magnitude } : {}) }));
    }
  }
  return [];
}

/** The unresolved markers of a card's hook at a timing. */
function unresolvedAt(cardSlug: string, timing: 'onAmbush' | 'onFight'): string[] {
  const cardId = `bkwd-villain-elite-assassins-${cardSlug}-00`;
  const markers: string[] = [];
  for (const hook of ELITE_ASSASSINS_HOOKS) {
    if (hook.cardId === cardId && hook.timing === timing) {
      markers.push(...(hook.unresolvedMarkers ?? []));
    }
  }
  return markers;
}

/** A two-seat state carrying the Elite Assassins hooks and a display-name table. */
function makeState(): LegendaryGameState {
  const displayData: Record<string, { name: string; imageUrl: string; cost: number }> = {
    [BLUE_TALON]: { name: 'Blue Talon', imageUrl: '', cost: 0 },
    [IRON_MAIDEN]: { name: 'Iron Maiden', imageUrl: '', cost: 0 },
    [SNAPDRAGON]: { name: 'Snapdragon', imageUrl: '', cost: 0 },
    [BLACK_LOTUS]: { name: 'Black Lotus', imageUrl: '', cost: 0 },
  };
  return {
    currentStage: 'main',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones() }, '1': { ...makePlayerZones() } },
    piles: makeGlobalPiles(),
    mastermind: makeMastermindState(),
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    villainAttachedHeroes: {},
    scheme: { twistPile: [] },
    selection: { schemeId: 'test/scheme', mastermindId: 'test/mastermind', villainGroupIds: ['bkwd/elite-assassins'], henchmanGroupIds: [], heroDeckIds: [] },
    heroAbilityHooks: [],
    villainAbilityHooks: [...ELITE_ASSASSINS_HOOKS],
    cardStats: {},
    cardTraits: {},
    cardKeywords: {},
    cardDisplayData: displayData,
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/** Registers a Hero's cost, class, team and display name. */
function registerHero(
  G: LegendaryGameState,
  cardId: CardExtId,
  name: string,
  cost: number,
  heroClass: string | null,
  heroClass2: string | null = null,
): void {
  (G.cardStats as Record<string, unknown>)[cardId] = { attack: 0, recruit: 0, cost, fightCost: 0 };
  (G.cardTraits as Record<string, unknown>)[cardId] = { heroClass, heroClass2, team: null };
  (G.cardDisplayData as Record<string, unknown>)[cardId] = { name, imageUrl: '', cost };
}

/** A deterministic shuffle context for a draw. */
function shuffleContext(G: LegendaryGameState): ShuffleProvider {
  return { random: { Shuffle: makeMockMoveContext(G).random.Shuffle } } as unknown as ShuffleProvider;
}

/** The log lines (outcome: text). */
function logLines(G: LegendaryGameState): string[] {
  return G.messages.map((message) => `${message.outcome}: ${message.text}`);
}

/** Submits an option for a seat on an open seat choice. */
function submit(choice: PendingSeatChoice, seat: string, optionIndex: number): void {
  choice.submissions[seat] = { optionIndex };
}

describe('Elite Assassins parse (WP-902 / D-24859) — AC 1', () => {
  it('Blue Talon: Ambush reveal-or-wound (unchanged) + Fight undercover-from-discard, no unresolved', () => {
    assert.deepEqual(effectsAt('blue-talon', 'onAmbush'), [{ primitive: 'reveal-or-wound' }]);
    assert.deepEqual(effectsAt('blue-talon', 'onFight'), [{ primitive: 'undercover-hero-from-discard-current' }]);
    assert.deepEqual(unresolvedAt('blue-talon', 'onAmbush'), []);
    assert.deepEqual(unresolvedAt('blue-talon', 'onFight'), []);
  });

  it('Iron Maiden: Ambush undercover-non-grey + Fight unleash, no unresolved', () => {
    assert.deepEqual(effectsAt('iron-maiden', 'onAmbush'), [{ primitive: 'undercover-non-grey-hero-each-player' }]);
    assert.deepEqual(effectsAt('iron-maiden', 'onFight'), [{ primitive: 'unleash-undercover-hero-each-player' }]);
    assert.deepEqual(unresolvedAt('iron-maiden', 'onAmbush'), []);
    assert.deepEqual(unresolvedAt('iron-maiden', 'onFight'), []);
  });

  it('Snapdragon: Ambush non-grey-discard-then-draw + Fight undercover-your-hero, no unresolved', () => {
    assert.deepEqual(effectsAt('snapdragon', 'onAmbush'), [{ primitive: 'discard-non-grey-hero-then-draw-each-player' }]);
    assert.deepEqual(effectsAt('snapdragon', 'onFight'), [{ primitive: 'undercover-your-hero-current' }]);
    assert.deepEqual(unresolvedAt('snapdragon', 'onAmbush'), []);
    assert.deepEqual(unresolvedAt('snapdragon', 'onFight'), []);
  });

  it('Black Lotus: Ambush discard-zero-cost + Fight gain-recruit-current magnitude 3, no unresolved', () => {
    assert.deepEqual(effectsAt('black-lotus', 'onAmbush'), [{ primitive: 'discard-zero-cost-card-each-player' }]);
    assert.deepEqual(effectsAt('black-lotus', 'onFight'), [{ primitive: 'gain-recruit-current', magnitude: 3 }]);
    assert.deepEqual(unresolvedAt('black-lotus', 'onAmbush'), []);
    assert.deepEqual(unresolvedAt('black-lotus', 'onFight'), []);
  });
});

describe('Elite Assassins Ambush handlers self-narrate (WP-902 / D-24859) — AC 1a', () => {
  it("Black Lotus Ambush records the owed zero-cost discard and its narrative equals its log line", () => {
    const G = makeState();
    const execution = executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, BLACK_LOTUS, 'onAmbush');
    assert.deepEqual(execution.narrativeClauses, ['each player must discard a card that costs 0']);
    assert.deepEqual(logLines(G), ['applied: Ambush effect: each player must discard a card that costs 0.']);
    assert.equal(G.pendingEscapeEffectDiscards?.length, 1);
    assert.deepEqual(G.pendingEscapeEffectDiscards?.[0]?.anyHandCard, { effectLabel: 'Ambush', zeroCostOnly: true });
  });

  it('Snapdragon Ambush records the owed non-grey discard + draw and its narrative equals its log line', () => {
    const G = makeState();
    const execution = executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, SNAPDRAGON, 'onAmbush');
    assert.deepEqual(execution.narrativeClauses, ['each player must discard a non-grey Hero, then each player draws a card']);
    assert.deepEqual(logLines(G), ['applied: Ambush effect: each player must discard a non-grey Hero, then each player draws a card.']);
    assert.deepEqual(G.pendingEscapeEffectDiscards?.[0]?.nonGreyHeroDiscardThenDraw, { effectLabel: 'Ambush' });
  });

  it('Iron Maiden Ambush records the owed Undercover send and its narrative equals its log line', () => {
    const G = makeState();
    const execution = executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, IRON_MAIDEN, 'onAmbush');
    assert.deepEqual(execution.narrativeClauses, ['each player must send one of their non-grey Heroes Undercover']);
    assert.deepEqual(logLines(G), ['applied: Ambush effect: each player must send one of their non-grey Heroes Undercover.']);
    assert.deepEqual(G.pendingEscapeEffectDiscards?.[0]?.nonGreyHeroUndercover, { effectLabel: 'Ambush' });
  });
});

describe('Black Lotus Fight / Ambush (WP-902 / D-24859) — AC 2', () => {
  it('Fight adds exactly 3 Recruit', () => {
    const G = makeState();
    G.turnEconomy.recruit = 1;
    executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, BLACK_LOTUS, 'onFight');
    assert.equal(G.turnEconomy.recruit, 4);
  });

  it('Ambush addresses only seats holding a cost-0 card (a Wound counts, a Bystander does not)', () => {
    const G = makeState();
    registerHero(G, 'hero/zero#0' as CardExtId, 'Zero Coster', 0, 'tech');
    registerHero(G, 'hero/one#0' as CardExtId, 'One Coster', 1, 'tech');
    G.playerZones['0']!.hand = ['hero/zero#0' as CardExtId, 'hero/one#0' as CardExtId, WOUND_EXT_ID];
    G.playerZones['1']!.hand = ['hero/one#0' as CardExtId, BYSTANDER_EXT_ID];
    const choice = buildVillainEffectAnyCardDiscardChoice(G, { escapedCardId: BLACK_LOTUS, eligibleCosts: [], anyHandCard: { effectLabel: 'Ambush', zeroCostOnly: true } })!;
    assert.deepEqual(choice.addressedSeats, ['0']);
    assert.equal(choice.seatPrompts['0']?.options.length, 2); // the 0-cost Hero and the Wound
    assert.ok(logLines(G).includes('blocked: Ambush effect: Player 1 has no card that costs 0 to discard.'));
  });
});

describe('Snapdragon Ambush discard + draw (WP-902 / D-24859) — AC 3', () => {
  it('holders discard cheapest-first, then every seat draws one, current player first (cardsDrawn)', () => {
    const G = makeState();
    registerHero(G, 'hero/dear#0' as CardExtId, 'Dear Hero', 5, 'tech');
    registerHero(G, 'hero/cheap#0' as CardExtId, 'Cheap Hero', 1, 'tech');
    registerHero(G, 'hero/draw-a#0' as CardExtId, 'Draw A', 2, 'tech');
    registerHero(G, 'hero/draw-b#0' as CardExtId, 'Draw B', 2, 'tech');
    G.playerZones['0']!.hand = ['hero/dear#0' as CardExtId, 'hero/cheap#0' as CardExtId];
    G.playerZones['0']!.deck = ['hero/draw-a#0' as CardExtId];
    G.playerZones['1']!.deck = ['hero/draw-b#0' as CardExtId];
    const choice = buildNonGreyHeroDiscardThenDrawChoice(G, '0')!;
    // cheapest first: option 0 is the 1-cost Cheap Hero.
    assert.equal(choice.seatPrompts['0']?.options[0]?.label, 'Discard Cheap Hero');
    submit(choice, '0', 0);
    applyVillainEffectNonGreyDiscardThenDraw(G, choice, shuffleContext(G), '0');
    assert.ok(G.playerZones['0']!.discard.includes('hero/cheap#0' as CardExtId));
    assert.ok(G.playerZones['0']!.hand.includes('hero/draw-a#0' as CardExtId));
    assert.ok(G.playerZones['1']!.hand.includes('hero/draw-b#0' as CardExtId));
    assert.equal(G.turnEconomy.cardsDrawn, 1);
  });

  it('no holder → the one-option fallback still draws everyone a card', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [WOUND_EXT_ID]; // not a non-grey Hero
    registerHero(G, 'hero/draw#0' as CardExtId, 'Draw', 2, 'tech');
    G.playerZones['0']!.deck = ['hero/draw#0' as CardExtId];
    const choice = buildNonGreyHeroDiscardThenDrawChoice(G, '0')!;
    assert.deepEqual(choice.addressedSeats, ['0']);
    assert.equal(choice.seatPrompts['0']?.options[0]?.label, 'No player has a non-grey Hero to discard — each player draws a card');
    submit(choice, '0', 0);
    applyVillainEffectNonGreyDiscardThenDraw(G, choice, shuffleContext(G), '0');
    assert.ok(G.playerZones['0']!.hand.includes('hero/draw#0' as CardExtId));
    assert.equal(G.turnEconomy.cardsDrawn, 1);
  });

  it('a draw lock skips only the current player’s draw', () => {
    const G = makeState();
    G.turnEconomy.drawsLocked = true;
    registerHero(G, 'hero/a#0' as CardExtId, 'A', 2, 'tech');
    registerHero(G, 'hero/b#0' as CardExtId, 'B', 2, 'tech');
    G.playerZones['0']!.deck = ['hero/a#0' as CardExtId];
    G.playerZones['1']!.deck = ['hero/b#0' as CardExtId];
    const choice = buildNonGreyHeroDiscardThenDrawChoice(G, '0')!; // no holder → fallback
    submit(choice, choice.addressedSeats[0]!, 0);
    applyVillainEffectNonGreyDiscardThenDraw(G, choice, shuffleContext(G), '0');
    assert.equal(G.playerZones['0']!.hand.length, 0); // current player skipped
    assert.ok(G.playerZones['1']!.hand.includes('hero/b#0' as CardExtId)); // other seat drew
    assert.equal(G.turnEconomy.cardsDrawn, 0);
  });
});

describe('Iron Maiden Ambush Undercover (WP-902 / D-24859) — AC 4', () => {
  it('every seat sends its cheapest non-grey Hero Undercover; an in-play send is recorded', () => {
    const G = makeState();
    registerHero(G, 'hero/dear#0' as CardExtId, 'Dear', 5, 'tech');
    registerHero(G, 'hero/cheap#0' as CardExtId, 'Cheap', 1, 'tech');
    registerHero(G, 'hero/played#0' as CardExtId, 'Played', 3, 'covert');
    G.playerZones['0']!.hand = ['hero/dear#0' as CardExtId];
    G.playerZones['0']!.inPlay = ['hero/played#0' as CardExtId];
    G.playerZones['1']!.hand = ['hero/cheap#0' as CardExtId];
    const choice = buildNonGreyHeroUndercoverChoice(G)!;
    assert.deepEqual(choice.addressedSeats, ['0', '1']);
    // seat 0 cheapest is the 3-cost in-play Played (hand Dear is 5); no decline option.
    assert.equal(choice.seatPrompts['0']?.options[0]?.label, 'Send Played Undercover (played this turn)');
    submit(choice, '0', 0);
    submit(choice, '1', 0);
    applyVillainEffectUndercoverEachPlayer(G, choice);
    assert.ok(G.playerZones['0']!.victory.includes('hero/played#0' as CardExtId));
    assert.ok(G.playerZones['0']!.undercover.includes('hero/played#0' as CardExtId));
    assert.ok(!G.playerZones['0']!.inPlay.includes('hero/played#0' as CardExtId));
    assert.ok(G.turnEconomy.leftPlayPlayedCardIds?.includes('hero/played#0' as CardExtId));
    assert.ok(G.playerZones['1']!.undercover.includes('hero/cheap#0' as CardExtId));
  });

  it('a seat with only a grey Hero is logged and not addressed (no decline)', () => {
    const G = makeState();
    registerHero(G, 'hero/grey#0' as CardExtId, 'Grey', 2, null); // no class = grey
    G.playerZones['0']!.hand = ['hero/grey#0' as CardExtId];
    G.playerZones['1']!.hand = [];
    assert.equal(buildNonGreyHeroUndercoverChoice(G), undefined);
    assert.ok(logLines(G).includes('blocked: Ambush effect: Player 0 has no non-grey Hero to send Undercover.'));
  });
});

describe('Iron Maiden Fight Unleash (WP-902 / D-24859) — AC 5', () => {
  it('every seat with an Undercover Hero may Unleash; a decline changes nothing', () => {
    const G = makeState();
    registerHero(G, 'hero/u0#0' as CardExtId, 'U0', 2, 'tech');
    registerHero(G, 'hero/u1#0' as CardExtId, 'U1', 2, 'tech');
    G.playerZones['0']!.victory = ['hero/u0#0' as CardExtId];
    G.playerZones['0']!.undercover = ['hero/u0#0' as CardExtId];
    G.playerZones['1']!.victory = ['hero/u1#0' as CardExtId];
    G.playerZones['1']!.undercover = ['hero/u1#0' as CardExtId];
    queueVillainFightPick(G, { primitive: 'unleash-undercover-hero-each-player', playerID: '0', sourceCardId: IRON_MAIDEN });
    openVillainFightPickSeatChoiceIfNeeded(G, undefined, '0');
    const choice = G.pendingSeatChoice!;
    assert.equal(choice.kind, 'villain-fight-unleash');
    assert.deepEqual(choice.addressedSeats, ['0', '1']);
    submit(choice, '0', 1); // Unleash U0
    submit(choice, '1', 0); // Don't Unleash
    applyVillainFightPickResolvedSeatChoice(G, choice, undefined);
    assert.ok(G.playerZones['0']!.hand.includes('hero/u0#0' as CardExtId));
    assert.ok(!G.playerZones['0']!.victory.includes('hero/u0#0' as CardExtId));
    assert.ok(!G.playerZones['0']!.undercover.includes('hero/u0#0' as CardExtId));
    assert.deepEqual(G.playerZones['1']!.undercover, ['hero/u1#0' as CardExtId]); // decline: unchanged
  });

  it('no Undercover Hero anywhere → a logged no-op, no choice', () => {
    const G = makeState();
    queueVillainFightPick(G, { primitive: 'unleash-undercover-hero-each-player', playerID: '0', sourceCardId: IRON_MAIDEN });
    openVillainFightPickSeatChoiceIfNeeded(G, undefined, '0');
    assert.equal(G.pendingSeatChoice, undefined);
    assert.ok(logLines(G).some((line) => line.includes('No player has a Hero Undercover to Unleash')));
  });
});

describe('Blue Talon Fight send-from-discard (WP-902 / D-24859) — AC 6', () => {
  it('one option per distinct discard Hero id (+ Don\'t send); a send moves one copy Undercover', () => {
    const G = makeState();
    registerHero(G, 'hero/agent#0' as CardExtId, 'Agent', 0, null);
    G.playerZones['0']!.discard = ['hero/agent#0' as CardExtId, 'hero/agent#0' as CardExtId, WOUND_EXT_ID];
    queueVillainFightPick(G, { primitive: 'undercover-hero-from-discard-current', playerID: '0', sourceCardId: BLUE_TALON });
    openVillainFightPickSeatChoiceIfNeeded(G, undefined, '0');
    const choice = G.pendingSeatChoice!;
    assert.equal(choice.kind, 'villain-fight-undercover-from-discard');
    // Don't send + one distinct Agent (the Wound is not a Hero, two Agents are one option).
    assert.equal(choice.seatPrompts['0']?.options.length, 2);
    assert.equal(choice.seatPrompts['0']?.options[0]?.label, "Don't send a Hero Undercover");
    submit(choice, '0', 1);
    applyVillainFightPickResolvedSeatChoice(G, choice, undefined);
    assert.ok(G.playerZones['0']!.victory.includes('hero/agent#0' as CardExtId));
    assert.ok(G.playerZones['0']!.undercover.includes('hero/agent#0' as CardExtId));
    assert.equal(G.playerZones['0']!.discard.filter((id) => id === ('hero/agent#0' as CardExtId)).length, 1); // one copy moved
  });

  it('no Hero in the discard pile → a logged no-op, no choice', () => {
    const G = makeState();
    G.playerZones['0']!.discard = [WOUND_EXT_ID];
    queueVillainFightPick(G, { primitive: 'undercover-hero-from-discard-current', playerID: '0', sourceCardId: BLUE_TALON });
    openVillainFightPickSeatChoiceIfNeeded(G, undefined, '0');
    assert.equal(G.pendingSeatChoice, undefined);
    assert.ok(logLines(G).some((line) => line.includes('has no Hero in their discard pile to send Undercover')));
  });
});

describe('Snapdragon Fight parks the your-hero Undercover entry (WP-902 / D-24859) — AC 7', () => {
  it('parks a declinable your-hero entry over hand + played Heroes, attributed to the Snapdragon copy', () => {
    const G = makeState();
    registerHero(G, 'hero/hand#0' as CardExtId, 'Hand Hero', 2, 'tech');
    registerHero(G, 'hero/play#0' as CardExtId, 'Play Hero', 3, 'covert');
    G.playerZones['0']!.hand = ['hero/hand#0' as CardExtId, WOUND_EXT_ID];
    G.playerZones['0']!.inPlay = ['hero/play#0' as CardExtId];
    executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, SNAPDRAGON, 'onFight');
    const pending = G.pendingUndercoverChoice?.[0];
    assert.equal(pending?.source, 'your-hero');
    assert.equal(pending?.canDecline, true);
    assert.equal(pending?.cardId, SNAPDRAGON);
    assert.deepEqual(pending?.eligibleTargets, ['hero/hand#0']); // the Wound is not a Hero
    assert.deepEqual(pending?.eligibleInPlayTargets, ['hero/play#0']);
  });

  it('no Hero to send → a log and no park', () => {
    const G = makeState();
    G.playerZones['0']!.hand = [WOUND_EXT_ID];
    executeVillainAbilitiesWithNarrative(G, { currentPlayer: '0' }, SNAPDRAGON, 'onFight');
    assert.equal(G.pendingUndercoverChoice, undefined);
    assert.ok(logLines(G).some((line) => line.includes('had no Hero to send Undercover')));
  });
});

describe('returnUndercoverHeroToHand (WP-902 / D-24859)', () => {
  it('Unleashes a Hero from victory + undercover to hand, dropping one tracker instance', () => {
    const G = makeState();
    G.playerZones['0']!.victory = ['hero/u#0' as CardExtId, 'hero/u#0' as CardExtId];
    G.playerZones['0']!.undercover = ['hero/u#0' as CardExtId, 'hero/u#0' as CardExtId];
    assert.equal(returnUndercoverHeroToHand(G, '0', 'hero/u#0' as CardExtId), true);
    assert.equal(G.playerZones['0']!.hand.filter((id) => id === ('hero/u#0' as CardExtId)).length, 1);
    assert.equal(G.playerZones['0']!.victory.filter((id) => id === ('hero/u#0' as CardExtId)).length, 1);
    assert.equal(G.playerZones['0']!.undercover.filter((id) => id === ('hero/u#0' as CardExtId)).length, 1);
  });

  it('refuses (no write) when the card is not in both zones', () => {
    const G = makeState();
    G.playerZones['0']!.undercover = ['hero/u#0' as CardExtId]; // in tracker but not in victory
    assert.equal(returnUndercoverHeroToHand(G, '0', 'hero/u#0' as CardExtId), false);
    assert.deepEqual(G.playerZones['0']!.hand, []);
    assert.deepEqual(G.playerZones['0']!.undercover, ['hero/u#0']);
  });

  it('isYourHeroUndercoverCandidate excludes Wounds and Bystanders only', () => {
    assert.equal(isYourHeroUndercoverCandidate(WOUND_EXT_ID), false);
    assert.equal(isYourHeroUndercoverCandidate(BYSTANDER_EXT_ID), false);
    assert.equal(isYourHeroUndercoverCandidate('hero/x#0' as CardExtId), true);
  });
});

describe('villain Dark Memories fight-cost term (WP-902 / D-24859) — AC 8', () => {
  /** A static-cost villain with the given base fightCost. */
  function withVillain(G: LegendaryGameState, base: number): void {
    (G.cardStats as Record<string, unknown>)[BLUE_TALON] = { attack: 0, recruit: 0, cost: 0, fightCost: base, fightCostMode: 'static', fightCostBase: 0 };
  }

  it('adds +1 per distinct Hero Class in the fighter’s discard; grey / Wound / Bystander add none', () => {
    const G = makeState();
    withVillain(G, 3);
    G.villainDarkMemories = { [BLUE_TALON]: true };
    registerHero(G, 'hero/tech#0' as CardExtId, 'Tech', 2, 'tech');
    registerHero(G, 'hero/tech2#0' as CardExtId, 'Tech2', 2, 'tech'); // same class, counts once
    registerHero(G, 'hero/covert#0' as CardExtId, 'Covert', 2, 'covert');
    registerHero(G, 'hero/grey#0' as CardExtId, 'Grey', 2, null);
    G.playerZones['0']!.discard = ['hero/tech#0' as CardExtId, 'hero/tech2#0' as CardExtId, 'hero/covert#0' as CardExtId, 'hero/grey#0' as CardExtId, WOUND_EXT_ID, BYSTANDER_EXT_ID];
    assert.equal(resolveFightCost(G, BLUE_TALON, '0'), 5); // 3 + {tech, covert}
  });

  it('a dual-class card counts both classes', () => {
    const G = makeState();
    withVillain(G, 3);
    G.villainDarkMemories = { [BLUE_TALON]: true };
    registerHero(G, 'hero/dual#0' as CardExtId, 'Dual', 2, 'tech', 'instinct');
    G.playerZones['0']!.discard = ['hero/dual#0' as CardExtId];
    assert.equal(resolveFightCost(G, BLUE_TALON, '0'), 5); // 3 + {tech, instinct}
  });

  it('is 0 without a fighter, and absent for an unflagged villain', () => {
    const G = makeState();
    withVillain(G, 3);
    registerHero(G, 'hero/tech#0' as CardExtId, 'Tech', 2, 'tech');
    G.playerZones['0']!.discard = ['hero/tech#0' as CardExtId];
    G.villainDarkMemories = { [BLUE_TALON]: true };
    assert.equal(resolveFightCost(G, BLUE_TALON), 3); // no fighter → no term
    G.villainDarkMemories = {};
    assert.equal(resolveFightCost(G, BLUE_TALON, '0'), 3); // unflagged → no term
  });
});
