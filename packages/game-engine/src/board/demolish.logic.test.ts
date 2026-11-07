/**
 * Demolish (WP-864 / D-24807): the shared `demolishEachPlayer` resolver, Fin Fang Foom's Master
 * Strike, and the `demolish-each-player` villain primitive on Trull the Unhuman's Ambush and
 * Zzutak's and Piledriver's Escape.
 *
 * Fin Fang Foom's strike logged only "strike count incremented" (operator match vZXSkk4xJNC,
 * log 9.1.1 / 14.1.1) and Trull's Ambush logged a hollow. These tests build the REAL villain
 * hooks from the committed data/cards/chmp.json, fire them through the real executor, and run
 * the strike through the real mastermindStrikeHandler.
 *
 * No boardgame.io imports. node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demolishEachPlayer } from './demolish.logic.js';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { executeVillainAbilities } from '../villain/villainEffects.execute.js';
import { mastermindStrikeHandler } from '../rules/mastermindHandlers.js';
import { descriptorToLegacyKeyword } from '../rules/villainAbility.types.js';
import { resolveCardName } from '../log/logDisplay.js';
import type { LegendaryGameState } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainAbilityHook, VillainAbilityTiming } from '../rules/villainAbility.types.js';
import {
  makeCardStatEntry,
  makeGlobalPiles,
  makeMastermindState,
  makePlayerZones,
  makeTurnEconomy,
} from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the
// hqCostChange.logic.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const FIN_FANG_FOOM = 'chmp/fin-fang-foom';
const STRIKE_PREFIX = '[Fin Fang Foom Master Strike]';

// Synthetic Heroes: copy-unique ids, as buildHeroDeck makes them.
const DECK_COST_3 = 'test/hero/deck-cost-3#0' as CardExtId;
const DECK_COST_5 = 'test/hero/deck-cost-5#0' as CardExtId;
const DECK_COST_2 = 'test/hero/deck-cost-2#0' as CardExtId;
const DECK_COST_4 = 'test/hero/deck-cost-4#0' as CardExtId;
const DECK_COST_6 = 'test/hero/deck-cost-6#0' as CardExtId;
const DECK_COST_0 = 'test/hero/deck-cost-0#0' as CardExtId;
const DECK_NO_STATS = 'test/hero/deck-no-stats#0' as CardExtId;
const HAND_COST_3_FIRST = 'test/hero/hand-cost-3-first#0' as CardExtId;
const HAND_COST_3_SECOND = 'test/hero/hand-cost-3-second#0' as CardExtId;
const HAND_COST_3_OTHER = 'test/hero/hand-cost-3-other#0' as CardExtId;
const HAND_COST_5 = 'test/hero/hand-cost-5#0' as CardExtId;
const HAND_COST_4 = 'test/hero/hand-cost-4#0' as CardExtId;
const HAND_COST_2 = 'test/hero/hand-cost-2#0' as CardExtId;
const HAND_COST_0 = 'test/hero/hand-cost-0#0' as CardExtId;
const BYSTANDER = 'test/bystander#0' as CardExtId;

/**
 * Builds a registry stub over the given committed sets.
 *
 * @param setAbbrs - The sets to expose.
 * @returns A registry exposing getSet / listCards.
 */
function makeSetRegistry(setAbbrs: string[]): { listCards: () => never[]; getSet: (abbr: string) => unknown } {
  const sets: Record<string, unknown> = {};
  for (const setAbbr of setAbbrs) {
    sets[setAbbr] = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
  }
  return { listCards: () => [], getSet: (abbr: string) => sets[abbr] };
}

/**
 * Builds the real villain hooks for Fin Fang Foom's two Always-Leads-adjacent groups.
 *
 * @returns The chmp Monsters Unleashed + Wrecking Crew villain hooks.
 */
function buildChmpVillainHooks(): VillainAbilityHook[] {
  const config = {
    villainGroupIds: ['chmp/monsters-unleashed', 'chmp/wrecking-crew'],
    henchmanGroupIds: [],
  } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(makeSetRegistry(['chmp']), config);
}

/**
 * Finds the first copy id of a villain card in the built hooks.
 *
 * @param hooks - The villain hooks.
 * @param cardPrefix - The `${set}-villain-${group}-${card}` prefix.
 * @returns The copy-indexed villain id.
 */
function villainCopyId(hooks: VillainAbilityHook[], cardPrefix: string): CardExtId {
  const hook = hooks.find((candidate) => candidate.cardId.startsWith(`${cardPrefix}-`));
  assert.ok(hook !== undefined, `a hook exists for ${cardPrefix}`);
  return hook.cardId;
}

/**
 * Finds a card's hook at one timing.
 *
 * @param hooks - The villain hooks.
 * @param cardId - The villain copy id.
 * @param timing - The timing.
 * @returns The hook.
 */
function hookAt(hooks: VillainAbilityHook[], cardId: CardExtId, timing: VillainAbilityTiming): VillainAbilityHook {
  const hook = hooks.find((candidate) => candidate.cardId === cardId && candidate.timing === timing);
  assert.ok(hook !== undefined, `${cardId} has an ${timing} hook`);
  return hook;
}

const HOOKS = buildChmpVillainHooks();
const TRULL = villainCopyId(HOOKS, 'chmp-villain-monsters-unleashed-trull-the-unhuman');
const ZZUTAK = villainCopyId(HOOKS, 'chmp-villain-monsters-unleashed-zzutak');
const GOOM = villainCopyId(HOOKS, 'chmp-villain-monsters-unleashed-goom');
const PILEDRIVER = villainCopyId(HOOKS, 'chmp-villain-wrecking-crew-piledriver');
const BULLDOZER = villainCopyId(HOOKS, 'chmp-villain-wrecking-crew-bulldozer');

/**
 * A three-seat state wide enough for the resolver, the strike handler and the villain executor.
 *
 * @param hands - Each seat's hand.
 * @param heroDeck - The Hero Deck, top first.
 * @param mastermindId - The selected Mastermind (Fin Fang Foom unless a test says otherwise).
 * @returns A LegendaryGameState sufficient for these tests.
 */
function makeState(
  hands: Record<string, CardExtId[]>,
  heroDeck: CardExtId[],
  mastermindId: string = FIN_FANG_FOOM,
): LegendaryGameState {
  const stat = (cost: number) => makeCardStatEntry({ cost });
  const playerZones: LegendaryGameState['playerZones'] = {};
  for (const [playerId, hand] of Object.entries(hands)) {
    playerZones[playerId] = { ...makePlayerZones(), hand: [...hand] };
  }
  return {
    currentStage: 'start',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones,
    piles: makeGlobalPiles({ bystanders: [BYSTANDER] }),
    mastermind: makeMastermindState(),
    selection: {
      schemeId: 'test-scheme',
      mastermindId,
      villainGroupIds: [],
      henchmanGroupIds: [],
      heroDeckIds: [],
    },
    villainDeck: { deck: [], discard: [] },
    villainDeckCardTypes: {},
    city: [null, null, null, null, null],
    hq: [null, null, null, null, null],
    heroDeck: [...heroDeck],
    escapedPile: [],
    ko: [],
    attachedBystanders: {},
    heroAbilityHooks: [],
    villainAbilityHooks: HOOKS,
    notableEvents: [],
    cardStats: {
      [DECK_COST_3]: stat(3), [DECK_COST_5]: stat(5), [DECK_COST_2]: stat(2), [DECK_COST_4]: stat(4),
      [DECK_COST_6]: stat(6), [DECK_COST_0]: stat(0),
      [HAND_COST_3_FIRST]: stat(3), [HAND_COST_3_SECOND]: stat(3), [HAND_COST_3_OTHER]: stat(3),
      [HAND_COST_5]: stat(5), [HAND_COST_4]: stat(4), [HAND_COST_2]: stat(2), [HAND_COST_0]: stat(0),
    },
  } as unknown as LegendaryGameState;
}

/** The log lines, without outcomes. */
function logLines(gameState: LegendaryGameState): string[] {
  return gameState.messages.map((entry) => entry.text);
}

/** The log entries whose text starts with the prefix. */
function linesWithPrefix(gameState: LegendaryGameState, prefix: string): string[] {
  return logLines(gameState).filter((text) => text.startsWith(prefix));
}

/** The reveal line for a card and cost. */
function revealLine(gameState: LegendaryGameState, prefix: string, cardId: CardExtId, cost: number): string {
  return `${prefix} Demolish revealed ${resolveCardName(gameState.cardDisplayData, cardId)} (cost ${cost}) and put it on the bottom of the Hero Deck.`;
}

/** The discard line for a player, card and cost. */
function discardLine(gameState: LegendaryGameState, prefix: string, playerId: string, cardId: CardExtId, cost: number): string {
  return `${prefix} Player ${playerId} discarded ${resolveCardName(gameState.cardDisplayData, cardId)} (cost ${cost}).`;
}

describe('WP-864 demolishEachPlayer (RS-1, D-24807)', () => {
  it('reveals one card, bottoms it, and each player discards their earliest card of that cost', () => {
    const gameState = makeState(
      {
        '0': [HAND_COST_5, HAND_COST_3_FIRST, HAND_COST_3_SECOND],
        '1': [HAND_COST_3_OTHER],
        '2': [HAND_COST_4],
      },
      [DECK_COST_3, DECK_COST_5, DECK_COST_2],
    );

    const result = demolishEachPlayer(gameState, '0', 'Test:');

    assert.deepEqual(gameState.heroDeck, [DECK_COST_5, DECK_COST_2, DECK_COST_3], 'the revealed card is on the bottom');
    assert.equal(gameState.heroDeck.length, 3, 'the Hero Deck length is unchanged');
    assert.deepEqual(gameState.playerZones['0']!.hand, [HAND_COST_5, HAND_COST_3_SECOND]);
    assert.deepEqual(gameState.playerZones['0']!.discard, [HAND_COST_3_FIRST], 'the earliest cost-3 card goes');
    assert.deepEqual(gameState.playerZones['1']!.hand, []);
    assert.deepEqual(gameState.playerZones['1']!.discard, [HAND_COST_3_OTHER]);
    assert.deepEqual(gameState.playerZones['2']!.hand, [HAND_COST_4], 'a player with no cost-3 card keeps their hand');
    assert.deepEqual(gameState.playerZones['2']!.discard, []);
    assert.deepEqual(result, {
      revealedCardId: DECK_COST_3,
      cost: 3,
      discards: [
        { playerId: '0', cardId: HAND_COST_3_FIRST },
        { playerId: '1', cardId: HAND_COST_3_OTHER },
      ],
    });
    assert.deepEqual(gameState.messages, [
      { text: revealLine(gameState, 'Test:', DECK_COST_3, 3), outcome: 'applied' },
      { text: discardLine(gameState, 'Test:', '0', HAND_COST_3_FIRST, 3), outcome: 'applied' },
      { text: discardLine(gameState, 'Test:', '1', HAND_COST_3_OTHER, 3), outcome: 'applied' },
      { text: 'Test: Player 2 has no card that costs 3 to discard.', outcome: 'blocked' },
    ]);
  });

  it('reveals exactly one card per call, even when several players discard', () => {
    const gameState = makeState(
      { '0': [HAND_COST_3_FIRST], '1': [HAND_COST_3_OTHER], '2': [HAND_COST_3_SECOND] },
      [DECK_COST_3, DECK_COST_5, DECK_COST_2],
    );

    demolishEachPlayer(gameState, '0', 'Test:');

    const revealLines = logLines(gameState).filter((text) => text.includes('Demolish revealed'));
    assert.equal(revealLines.length, 1, 'one reveal for the whole Demolish, not one per player');
    assert.deepEqual(gameState.heroDeck, [DECK_COST_5, DECK_COST_2, DECK_COST_3]);
  });

  it('discards start with the current player, then clockwise (D-24780)', () => {
    const gameState = makeState(
      { '0': [HAND_COST_3_FIRST], '1': [HAND_COST_3_OTHER], '2': [HAND_COST_3_SECOND] },
      [DECK_COST_3],
    );

    const result = demolishEachPlayer(gameState, '1', 'Test:');

    assert.deepEqual(result.discards.map((discard) => discard.playerId), ['1', '2', '0']);
    assert.deepEqual(linesWithPrefix(gameState, 'Test: Player'), [
      discardLine(gameState, 'Test:', '1', HAND_COST_3_OTHER, 3),
      discardLine(gameState, 'Test:', '2', HAND_COST_3_SECOND, 3),
      discardLine(gameState, 'Test:', '0', HAND_COST_3_FIRST, 3),
    ]);
  });

  it('an empty Hero Deck logs blocked and changes nothing', () => {
    const gameState = makeState({ '0': [HAND_COST_3_FIRST], '1': [HAND_COST_0] }, []);

    const result = demolishEachPlayer(gameState, '0', 'Test:');

    assert.deepEqual(result, { revealedCardId: null, cost: null, discards: [] });
    assert.deepEqual(gameState.heroDeck, []);
    assert.deepEqual(gameState.playerZones['0']!.hand, [HAND_COST_3_FIRST]);
    assert.deepEqual(gameState.playerZones['1']!.hand, [HAND_COST_0]);
    assert.deepEqual(gameState.messages, [
      { text: 'Test: the Hero Deck is empty, so nothing is Demolished.', outcome: 'blocked' },
    ]);
  });

  it('a revealed card with no cost still goes to the bottom, and no one discards', () => {
    const gameState = makeState({ '0': [HAND_COST_0], '1': [HAND_COST_3_FIRST] }, [DECK_NO_STATS, DECK_COST_5]);

    const result = demolishEachPlayer(gameState, '0', 'Test:');

    assert.deepEqual(gameState.heroDeck, [DECK_COST_5, DECK_NO_STATS]);
    assert.deepEqual(result, { revealedCardId: DECK_NO_STATS, cost: null, discards: [] });
    assert.deepEqual(gameState.playerZones['0']!.hand, [HAND_COST_0]);
    assert.deepEqual(gameState.playerZones['1']!.hand, [HAND_COST_3_FIRST]);
    assert.deepEqual(gameState.messages, [
      {
        text: `Test: Demolish revealed ${resolveCardName(gameState.cardDisplayData, DECK_NO_STATS)} and put it on the bottom of the Hero Deck, but it has no cost, so no one discards.`,
        outcome: 'blocked',
      },
    ]);
  });

  it('a 0-cost reveal makes a 0-cost hand card the discard', () => {
    const gameState = makeState({ '0': [HAND_COST_2, HAND_COST_0], '1': [HAND_COST_3_FIRST] }, [DECK_COST_0]);

    const result = demolishEachPlayer(gameState, '0', 'Test:');

    assert.deepEqual(result.discards, [{ playerId: '0', cardId: HAND_COST_0 }]);
    assert.deepEqual(gameState.playerZones['0']!.hand, [HAND_COST_2]);
    assert.deepEqual(gameState.playerZones['0']!.discard, [HAND_COST_0]);
    assert.deepEqual(gameState.playerZones['1']!.hand, [HAND_COST_3_FIRST]);
  });
});

describe('WP-864 Fin Fang Foom Master Strike (RS-2, D-24807)', () => {
  it('with no Monsters Unleashed Villain out, Demolishes each player exactly once', () => {
    const gameState = makeState(
      { '0': [HAND_COST_3_FIRST], '1': [HAND_COST_5] },
      [DECK_COST_3, DECK_COST_5, DECK_COST_2],
    );

    mastermindStrikeHandler(gameState, { ctx: { currentPlayer: '0' } }, { cardId: 'strike' }, {});

    assert.deepEqual(linesWithPrefix(gameState, STRIKE_PREFIX), [
      `${STRIKE_PREFIX} Demolish each player 1 time(s): once, plus once for each of the 0 Monsters Unleashed Villain(s) in the city and Escape Pile.`,
      revealLine(gameState, STRIKE_PREFIX, DECK_COST_3, 3),
      discardLine(gameState, STRIKE_PREFIX, '0', HAND_COST_3_FIRST, 3),
      `${STRIKE_PREFIX} Player 1 has no card that costs 3 to discard.`,
    ]);
    assert.deepEqual(gameState.heroDeck, [DECK_COST_5, DECK_COST_2, DECK_COST_3]);
  });

  it('two in the City and one in the Escape Pile make four Demolishes, each revealing the then-top card', () => {
    const gameState = makeState(
      { '0': [HAND_COST_3_FIRST, HAND_COST_5, HAND_COST_2, HAND_COST_4], '1': [HAND_COST_5] },
      [DECK_COST_3, DECK_COST_5, DECK_COST_2, DECK_COST_4, DECK_COST_6],
    );
    // why: Goom and Zzutak are Monsters Unleashed in the City; Bulldozer is Wrecking Crew (not
    // counted); Trull is Monsters Unleashed in the Escape Pile; a Bystander there never counts.
    gameState.city = [GOOM, BULLDOZER, null, ZZUTAK, null];
    gameState.escapedPile = [BYSTANDER, TRULL];

    mastermindStrikeHandler(gameState, { ctx: { currentPlayer: '1' } }, { cardId: 'strike' }, {});

    const strikeLines = linesWithPrefix(gameState, STRIKE_PREFIX);
    assert.equal(
      strikeLines[0],
      `${STRIKE_PREFIX} Demolish each player 4 time(s): once, plus once for each of the 3 Monsters Unleashed Villain(s) in the city and Escape Pile.`,
    );
    assert.deepEqual(
      strikeLines.filter((text) => text.includes('Demolish revealed')),
      [
        revealLine(gameState, STRIKE_PREFIX, DECK_COST_3, 3),
        revealLine(gameState, STRIKE_PREFIX, DECK_COST_5, 5),
        revealLine(gameState, STRIKE_PREFIX, DECK_COST_2, 2),
        revealLine(gameState, STRIKE_PREFIX, DECK_COST_4, 4),
      ],
      'four distinct top cards, in deck order',
    );
    assert.deepEqual(gameState.heroDeck, [DECK_COST_6, DECK_COST_3, DECK_COST_5, DECK_COST_2, DECK_COST_4]);
    assert.deepEqual(gameState.playerZones['0']!.hand, [], 'player 0 discarded one card per Demolish');
    assert.deepEqual(gameState.playerZones['0']!.discard, [HAND_COST_3_FIRST, HAND_COST_5, HAND_COST_2, HAND_COST_4]);
    assert.deepEqual(gameState.playerZones['1']!.discard, [HAND_COST_5]);
    // why: D-24780 — the second Demolish (cost 5) discards for the current player 1 before player 0.
    const costFiveDiscards = strikeLines.filter((text) => text.includes('(cost 5).'));
    assert.deepEqual(costFiveDiscards, [
      discardLine(gameState, STRIKE_PREFIX, '1', HAND_COST_5, 5),
      discardLine(gameState, STRIKE_PREFIX, '0', HAND_COST_5, 5),
    ]);
  });

  it('still emits the mastermindStrikeResolved notable event', () => {
    const gameState = makeState({ '0': [] }, [DECK_COST_3]);

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    assert.equal(gameState.notableEvents.length, 1);
    assert.equal(gameState.notableEvents[0]!.type, 'mastermindStrikeResolved');
  });

  it('another Mastermind leaves the Hero Deck and hands alone', () => {
    const gameState = makeState({ '0': [HAND_COST_3_FIRST] }, [DECK_COST_3, DECK_COST_5], 'chmp/pagliacci');

    mastermindStrikeHandler(gameState, {}, { cardId: 'strike' }, {});

    assert.deepEqual(gameState.heroDeck, [DECK_COST_3, DECK_COST_5]);
    assert.deepEqual(gameState.playerZones['0']!.hand, [HAND_COST_3_FIRST]);
    assert.deepEqual(linesWithPrefix(gameState, STRIKE_PREFIX), []);
  });
});

describe('WP-864 demolish-each-player villain primitive (RS-4, D-24807)', () => {
  it("Trull the Unhuman's Ambush parses to a Bystander capture, then the Demolish", () => {
    const effects = hookAt(HOOKS, TRULL, 'onAmbush').effects;
    assert.equal(effects.length, 2);
    assert.equal(descriptorToLegacyKeyword(effects[0]!), 'captureBystander');
    assert.deepStrictEqual(effects[1], { primitive: 'demolish-each-player' });
  });

  it("Zzutak's and Piledriver's Escape parse to the primitive; Piledriver's Fight is unchanged", () => {
    assert.deepStrictEqual(hookAt(HOOKS, ZZUTAK, 'onEscape').effects, [{ primitive: 'demolish-each-player' }]);
    assert.deepStrictEqual(hookAt(HOOKS, PILEDRIVER, 'onEscape').effects, [{ primitive: 'demolish-each-player' }]);
    const fightEffects = hookAt(HOOKS, PILEDRIVER, 'onFight').effects;
    assert.equal(fightEffects.length, 1);
    assert.equal(descriptorToLegacyKeyword(fightEffects[0]!), 'koHeroCurrentPlayer');
  });

  it('the primitive is keyword-less, so it self-narrates', () => {
    assert.equal(descriptorToLegacyKeyword({ primitive: 'demolish-each-player' }), undefined);
  });

  it('a demolish-each-player marker with a param lands in unresolvedMarkers', () => {
    const syntheticSet = {
      villains: [
        {
          slug: 'synthetic',
          cards: [{ slug: 'bad-demolish', abilities: ['Escape: Demolish twice. [effect:demolish-each-player:2]'] }],
        },
      ],
      henchmen: [],
    };
    const registry = { listCards: () => [], getSet: (abbr: string) => (abbr === 'test' ? syntheticSet : undefined) };
    const config = { villainGroupIds: ['test/synthetic'], henchmanGroupIds: [] } as unknown as MatchSetupConfig;
    const hooks = buildVillainAbilityHooks(registry, config);
    const hook = hooks.find((candidate) => candidate.cardId.startsWith('test-villain-synthetic-bad-demolish-'));
    assert.ok(hook !== undefined, 'the synthetic card has a hook');
    assert.deepStrictEqual(hook.effects, []);
    assert.deepStrictEqual(hook.unresolvedMarkers, ['demolish-each-player:2']);
  });

  it("executing Trull's Ambush attaches a Bystander to Trull, then Demolishes", () => {
    const gameState = makeState(
      { '0': [HAND_COST_3_FIRST], '1': [HAND_COST_3_OTHER] },
      [DECK_COST_3, DECK_COST_5],
    );
    gameState.city = [TRULL, null, null, null, null];

    executeVillainAbilities(gameState, { currentPlayer: '1', turn: 1 }, TRULL, 'onAmbush');

    assert.deepEqual(gameState.attachedBystanders[TRULL], [BYSTANDER], 'Trull captured the Bystander');
    assert.deepEqual(gameState.piles.bystanders, []);
    assert.deepEqual(gameState.heroDeck, [DECK_COST_5, DECK_COST_3], 'the Demolish bottomed the revealed card');
    assert.deepEqual(gameState.playerZones['0']!.discard, [HAND_COST_3_FIRST]);
    assert.deepEqual(gameState.playerZones['1']!.discard, [HAND_COST_3_OTHER]);
    assert.ok(logLines(gameState).includes(revealLine(gameState, 'Ambush effect:', DECK_COST_3, 3)));
  });

  for (const [label, escapingVillain] of [['Zzutak', ZZUTAK], ['Piledriver', PILEDRIVER]] as const) {
    it(`executing ${label}'s Escape Demolishes each player`, () => {
      const gameState = makeState({ '0': [HAND_COST_5], '1': [HAND_COST_4, HAND_COST_5] }, [DECK_COST_5, DECK_COST_2]);
      gameState.escapedPile = [escapingVillain];

      executeVillainAbilities(gameState, { currentPlayer: '0', turn: 1 }, escapingVillain, 'onEscape');

      assert.deepEqual(gameState.heroDeck, [DECK_COST_2, DECK_COST_5]);
      assert.deepEqual(gameState.playerZones['0']!.discard, [HAND_COST_5]);
      assert.deepEqual(gameState.playerZones['1']!.hand, [HAND_COST_4]);
      assert.deepEqual(linesWithPrefix(gameState, 'Escape effect:'), [
        revealLine(gameState, 'Escape effect:', DECK_COST_5, 5),
        discardLine(gameState, 'Escape effect:', '0', HAND_COST_5, 5),
        discardLine(gameState, 'Escape effect:', '1', HAND_COST_5, 5),
      ]);
    });
  }
});
