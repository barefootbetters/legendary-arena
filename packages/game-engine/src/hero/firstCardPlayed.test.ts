/**
 * "If this is the first card you played this turn, ..." (WP-861 / D-24798).
 *
 * No-Name's Surprise Attack (wwhk) never drew, and Elektra's First Strike (dkcy) and Wasp's
 * Follow My Lead line 1 (amwp) granted their +1 Attack on every play. Curated markers now gate
 * each line on the shipped firstHeroPlayedThisTurn condition, and Surprise Attack also carries
 * [keyword:draw:1]. These tests parse the committed data and drive the real play path.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

// why: the gate is the shipped first-Hero condition (WP-681 / D-24498) because it counts every
// card played this turn, and every card a player plays is a Hero card, so "first card" and
// "first Hero" select the same plays. Hooks are parsed from the committed data/cards JSON rather
// than hand-typed literals, so the tests prove the marker tokens that ship (D-24798).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildHeroAbilityHooks } from '../setup/heroAbility.setup.js';
import { applyCardPlay } from '../moves/coreMoves.impl.js';
import type { LegendaryGameState, MatchConfiguration } from '../types.js';
import type { HeroAbilityHook } from '../rules/heroAbility.types.js';
import type { CardExtId } from '../state/zones.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

/** One printed card under test: where it lives and what its gated line grants. */
interface FirstCardLine {
  setAbbr: string;
  heroDeckId: string;
  cardPrefix: string;
  effectType: 'draw' | 'attack';
}

const SURPRISE_ATTACK: FirstCardLine = {
  setAbbr: 'wwhk',
  heroDeckId: 'wwhk/no-name-brood-queen',
  cardPrefix: 'wwhk/no-name-brood-queen/surprise-attack#',
  effectType: 'draw',
};

const FIRST_STRIKE: FirstCardLine = {
  setAbbr: 'dkcy',
  heroDeckId: 'dkcy/elektra',
  cardPrefix: 'dkcy/elektra/first-strike#',
  effectType: 'attack',
};

const FOLLOW_MY_LEAD: FirstCardLine = {
  setAbbr: 'amwp',
  heroDeckId: 'amwp/wasp',
  cardPrefix: 'amwp/wasp/follow-my-lead#',
  effectType: 'attack',
};

const FIRST_CARD_LINES: readonly FirstCardLine[] = [SURPRISE_ATTACK, FIRST_STRIKE, FOLLOW_MY_LEAD];

const ATTACK_LINES: readonly FirstCardLine[] = [FIRST_STRIKE, FOLLOW_MY_LEAD];

const FIRST_CARD_CONDITION = 'firstHeroPlayedThisTurn';

// why: the unmet-gate wording shared with Deadpool's Do-Over (describeFailedCondition).
const BLOCKED_WORDING = 'first Hero you played this turn';

// why: the filler card stands in for any card played earlier in the turn; the gate only asks
// whether some other id is already in play, not what that card was.
const EARLIER_PLAY = 'test/filler/earlier-play#0' as CardExtId;

const DECK_TOP = 'test/filler/deck-top#0' as CardExtId;

const playContext = {
  ctx: { turn: 1, currentPlayer: '0' },
  random: { Shuffle: <T>(items: T[]): T[] => [...items].reverse() },
};

/**
 * Builds a one-set registry reader from the COMMITTED data/cards JSON, so the test parses the
 * shipped ability line rather than a hand-typed literal.
 *
 * @param setAbbr - Set abbreviation (the data/cards/<abbr>.json file).
 * @returns A structural registry reader for buildHeroAbilityHooks.
 */
function registryForSet(setAbbr: string): unknown {
  // why: resolve the repo-root data file from this test's own location (the
  // playedOtherCardsThreshold.test.ts precedent), so the test reads what ships.
  const here = dirname(fileURLToPath(import.meta.url));
  const setData = JSON.parse(readFileSync(join(here, '..', '..', '..', '..', 'data', 'cards', `${setAbbr}.json`), 'utf8'));
  return { listCards: () => [], getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined) };
}

/**
 * Parses one hero deck and returns every hook for the card's first copy.
 *
 * @param line - The card under test.
 * @returns The hooks built for that card copy (one per ability line).
 */
function buildCardHooks(line: FirstCardLine): HeroAbilityHook[] {
  const config = { heroDeckIds: [line.heroDeckId] } as unknown as MatchConfiguration;
  const hooks = buildHeroAbilityHooks(registryForSet(line.setAbbr), config);
  const firstCopyId = hooks.find((hook) => hook.cardId.startsWith(line.cardPrefix))?.cardId;
  assert.ok(firstCopyId !== undefined, `${line.cardPrefix} must build at least one hook`);
  return hooks.filter((hook) => hook.cardId === firstCopyId);
}

/**
 * Returns the hook gated on the first-card condition, picked by condition type (Follow My Lead's
 * hooks[0] is its ungated Size-Changing line).
 *
 * @param hooks - The card's hooks.
 * @param cardPrefix - Card id prefix, for the failure message.
 * @returns The first-card-gated hook.
 */
function findFirstCardHook(hooks: HeroAbilityHook[], cardPrefix: string): HeroAbilityHook {
  const gatedHook = hooks.find((hook) =>
    (hook.conditions ?? []).some((condition) => condition.type === FIRST_CARD_CONDITION),
  );
  assert.ok(gatedHook !== undefined, `${cardPrefix} must carry a ${FIRST_CARD_CONDITION} gate`);
  return gatedHook;
}

/**
 * Minimal state for applyCardPlay: the card's hooks, an optional earlier play, and a one-card
 * deck so a draw has something to move.
 *
 * @param hooks - The card's hooks.
 * @param hasEarlierPlay - Whether another card is already in play this turn.
 * @returns A LegendaryGameState sufficient for one play.
 */
function makeState(hooks: HeroAbilityHook[], hasEarlierPlay: boolean): LegendaryGameState {
  const alreadyPlayed: CardExtId[] = [];
  if (hasEarlierPlay) {
    alreadyPlayed.push(EARLIER_PLAY);
  }
  return {
    messages: [],
    notableEvents: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), inPlay: alreadyPlayed, hand: [], deck: [DECK_TOP] } },
    piles: makeGlobalPiles(),
    mastermind: { ...makeMastermindState(), baseCardId: 'test-mastermind-base' as CardExtId },
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    cardKeywords: {},
    cardStats: {},
    cardTraits: {},
    cardDisplayData: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    ko: [],
    attachedBystanders: {},
    heroAbilityHooks: hooks,
    villainAbilityHooks: [],
  } as unknown as LegendaryGameState;
}

/**
 * Plays the card through applyCardPlay and returns the resulting state (cardStats is empty, so
 * the printed base attack contributes nothing).
 *
 * @param line - The card under test.
 * @param hasEarlierPlay - Whether another card was played first this turn.
 * @returns The state after the play.
 */
function playCard(line: FirstCardLine, hasEarlierPlay: boolean): LegendaryGameState {
  const hooks = buildCardHooks(line);
  const G = makeState(hooks, hasEarlierPlay);
  const cardId = hooks[0]!.cardId;
  applyCardPlay(G, playContext as unknown as Parameters<typeof applyCardPlay>[1], '0', cardId);
  assert.ok(G.playerZones['0']!.inPlay.includes(cardId), 'the played card is in play');
  return G;
}

/**
 * Whether any log line names the unmet first-Hero gate.
 *
 * @param G - The state after the play.
 * @returns True when some message contains the blocked wording.
 */
function hasBlockedFirstCardMessage(G: LegendaryGameState): boolean {
  return G.messages.some((message) => message.text.includes(BLOCKED_WORDING));
}

describe('D-24798 parse: "first card you played this turn" gates on firstHeroPlayedThisTurn', () => {
  for (const line of FIRST_CARD_LINES) {
    it(`${line.cardPrefix} parses to the first-card gate + ${line.effectType} 1`, () => {
      const gatedHook = findFirstCardHook(buildCardHooks(line), line.cardPrefix);
      assert.deepEqual(gatedHook.conditions, [{ type: FIRST_CARD_CONDITION, value: '1' }]);
      assert.deepEqual(gatedHook.effects, [{ type: line.effectType, magnitude: 1 }]);
      assert.ok(gatedHook.keywords.includes('conditional'), 'the gated hook is marked conditional');
      assert.equal(gatedHook.unresolvedMarkers, undefined, 'the gated line has no unresolved marker');
    });
  }

  it('amwp/wasp/follow-my-lead line 0 (Size-Changing) is unchanged', () => {
    const hooks = buildCardHooks(FOLLOW_MY_LEAD);
    const gatedHook = findFirstCardHook(hooks, FOLLOW_MY_LEAD.cardPrefix);
    const lineZero = hooks.find((hook) => hook !== gatedHook);
    assert.ok(lineZero !== undefined, 'Follow My Lead keeps its line 0 hook');
    assert.deepEqual(lineZero.conditions, [{ type: 'heroClassMatch', value: 'ranged' }]);
    assert.deepEqual(lineZero.unresolvedMarkers, ['gate-only']);
    assert.ok(
      !(lineZero.conditions ?? []).some((condition) => condition.type === FIRST_CARD_CONDITION),
      'line 0 carries no first-card gate',
    );
  });
});

describe('D-24798 play: the line resolves only as the first card of the turn', () => {
  it(`${SURPRISE_ATTACK.cardPrefix} played first draws the deck top`, () => {
    const G = playCard(SURPRISE_ATTACK, false);
    assert.deepEqual(G.playerZones['0']!.hand, [DECK_TOP]);
    assert.deepEqual(G.playerZones['0']!.deck, []);
  });

  for (const line of ATTACK_LINES) {
    it(`${line.cardPrefix} played first adds +1 Attack`, () => {
      assert.equal(playCard(line, false).turnEconomy.attack, 1);
    });
  }

  it(`${SURPRISE_ATTACK.cardPrefix} played after another card: no draw, blocked line logged`, () => {
    const G = playCard(SURPRISE_ATTACK, true);
    assert.deepEqual(G.playerZones['0']!.hand, []);
    assert.deepEqual(G.playerZones['0']!.deck, [DECK_TOP]);
    assert.ok(hasBlockedFirstCardMessage(G), 'the log names the unmet first-Hero gate');
  });

  for (const line of ATTACK_LINES) {
    it(`${line.cardPrefix} played after another card: no bonus, blocked line logged`, () => {
      const G = playCard(line, true);
      assert.equal(G.turnEconomy.attack, 0);
      assert.ok(hasBlockedFirstCardMessage(G), 'the log names the unmet first-Hero gate');
    });
  }
});
