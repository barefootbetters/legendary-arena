/**
 * The mandatory "KO a card from your discard pile" (WP-868 / D-24811).
 *
 * cvwr Flatman and six siblings print "Fight: KO a card from your discard pile." The line logged an
 * `unmarked-ability` hollow and did nothing. `ko-from-discard-current:<N>` now KOs directly when the
 * pick cannot matter and otherwise parks the D-24510 KO-from-discard choice with a `minCount`, which
 * the resolve move and the bot enforce. Four "You may KO a card from your discard pile." lines take
 * the shipped `ko-up-to-from-discard-current:1` and stay optional. The malformed-token cases for all
 * three WP-868 primitives live here too (RS-4).
 *
 * Builds the real hooks from the committed card data. No boardgame.io imports.
 * node:test + node:assert only.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVillainAbilityHooks } from '../setup/villainAbility.setup.js';
import { executeVillainAbilities } from './villainEffects.execute.js';
import { resolveKoDiscardChoice, hasPendingKoDiscardChoice } from '../moves/koDiscardChoice.resolve.js';
import { selectDefaultKoDiscardCardIds } from '../simulation/ai.legalMoves.js';
import { OWNED_CARD_KOED_CONDITION_TYPE } from '../hero/heroConditions.evaluate.js';
import { SHIELD_OFFICER_EXT_ID, WOUND_EXT_ID } from '../setup/pilesInit.js';
import type { LegendaryGameState, PendingKoDiscardChoice } from '../types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';
import type { VillainAbilityHook } from '../rules/villainAbility.types.js';
import { makeGlobalPiles, makeMastermindState, makePlayerZones, makeTurnEconomy } from '../test/fixtureBuilders.js';

// why: resolve the repo-root data directory from this test's own location (the
// cvwrBigBerthaRevealOrWound.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const HERO_A = 'test/hero/hero-a#0' as CardExtId;
const HERO_B = 'test/hero/hero-b#0' as CardExtId;
const VILLAIN_CTX = { currentPlayer: '0', turn: 1 };

interface MarkedLine {
  setAbbr: string;
  groupId: string;
  cardPrefix: string;
  kind: 'villain' | 'henchman';
}

const MANDATORY_LINES: readonly MarkedLine[] = [
  { setAbbr: 'antm', groupId: 'antm/ultrons-legacy', cardPrefix: 'antm-villain-ultrons-legacy-alkhema', kind: 'villain' },
  { setAbbr: 'antm', groupId: 'antm/queens-vengeance', cardPrefix: 'antm-villain-queens-vengeance-star-knight', kind: 'villain' },
  { setAbbr: 'cvwr', groupId: 'cvwr/great-lakes-avengers', cardPrefix: 'cvwr-villain-great-lakes-avengers-flatman', kind: 'villain' },
  { setAbbr: 'msmc', groupId: 'msmc/clan-yashida', cardPrefix: 'msmc-villain-clan-yashida-silver-samurai', kind: 'villain' },
  { setAbbr: 'ssw2', groupId: 'ssw2/monster-metropolis', cardPrefix: 'ssw2-villain-monster-metropolis-bug-shiklahs-dragon', kind: 'villain' },
  { setAbbr: 'xmen', groupId: 'xmen/shiar-imperial-guard', cardPrefix: 'xmen-villain-shiar-imperial-guard-smasher', kind: 'villain' },
  { setAbbr: 'cvwr', groupId: 'cvwr/cape-killers', cardPrefix: 'henchman-cape-killers', kind: 'henchman' },
];

const OPTIONAL_LINES: readonly MarkedLine[] = [
  { setAbbr: 'cosm', groupId: 'cosm/black-order-of-thanos', cardPrefix: 'cosm-villain-black-order-of-thanos-supergiant', kind: 'villain' },
  { setAbbr: 'mdns', groupId: 'mdns/lilin', cardPrefix: 'mdns-villain-lilin-meatmarket', kind: 'villain' },
  { setAbbr: 'msis', groupId: 'msis/children-of-thanos', cardPrefix: 'msis-villain-children-of-thanos-outriders', kind: 'villain' },
  { setAbbr: 'rvlt', groupId: 'rvlt/hoods-gang', cardPrefix: 'rvlt-villain-hoods-gang-the-brothers-grimm', kind: 'villain' },
];

/**
 * Builds the real villain or henchman hooks for one group from the committed card data.
 *
 * @param line - The marked line whose group to build.
 * @returns Every hook the group produces.
 */
function buildGroupHooks(line: MarkedLine): VillainAbilityHook[] {
  const setData = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${line.setAbbr}.json`), 'utf8'));
  const registry = { getSet: (abbr: string) => (abbr === line.setAbbr ? setData : undefined) };
  const config = {
    villainGroupIds: line.kind === 'villain' ? [line.groupId] : [],
    henchmanGroupIds: line.kind === 'henchman' ? [line.groupId] : [],
  } as unknown as MatchSetupConfig;
  return buildVillainAbilityHooks(registry, config);
}

const FLATMAN_HOOKS = buildGroupHooks(MANDATORY_LINES[2]!);
const FLATMAN = FLATMAN_HOOKS.find((hook) => hook.cardId.startsWith('cvwr-villain-great-lakes-avengers-flatman-'))!.cardId;

/**
 * A two-seat state with Flatman's real hooks and the given discard for player 0.
 *
 * @param discard - Player 0's discard pile.
 * @returns A LegendaryGameState sufficient for the executor, the resolve move and the bot.
 */
function makeState(discard: CardExtId[]): LegendaryGameState {
  return {
    currentStage: 'main',
    messages: [],
    counters: {},
    hookRegistry: [],
    turnEconomy: { ...makeTurnEconomy() },
    playerZones: { '0': { ...makePlayerZones(), discard: [...discard] }, '1': { ...makePlayerZones() } },
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
    heroAbilityHooks: [],
    villainAbilityHooks: FLATMAN_HOOKS,
    cardStats: {},
    cardTraits: {},
    cardKeywords: {},
    cardDisplayData: {
      [FLATMAN]: { name: 'Flatman', imageUrl: '', cost: 0 },
      [HERO_A]: { name: 'Hero A', imageUrl: '', cost: 3 },
      [HERO_B]: { name: 'Hero B', imageUrl: '', cost: 4 },
      [WOUND_EXT_ID]: { name: 'Wound', imageUrl: '', cost: 0 },
    },
    notableEvents: [],
  } as unknown as LegendaryGameState;
}

/**
 * Returns the last log entry.
 *
 * @param G - The game state.
 * @returns The last message's text and outcome.
 */
function lastLog(G: LegendaryGameState): { text: string; outcome: string | undefined } {
  const entry = G.messages[G.messages.length - 1];
  return { text: entry?.text ?? '', outcome: entry?.outcome };
}

/**
 * Fires Flatman's Fight through the real executor.
 *
 * @param G - The game state.
 */
function fightFlatman(G: LegendaryGameState): void {
  executeVillainAbilities(G, VILLAIN_CTX, FLATMAN, 'onFight');
}

/**
 * A move context carrying only what resolveKoDiscardChoice reads.
 *
 * @param G - The game state.
 * @returns The move context.
 */
function moveContext(G: LegendaryGameState): never {
  return { G, playerID: '0' } as never;
}

describe('WP-868 RS-4 parse: the KO-from-discard lines', () => {
  for (const line of MANDATORY_LINES) {
    it(`${line.cardPrefix} Fight parses to the mandatory ko-from-discard-current:1`, () => {
      const fightHooks = buildGroupHooks(line).filter(
        (hook) => hook.cardId.startsWith(`${line.cardPrefix}-`) && hook.timing === 'onFight',
      );
      assert.ok(fightHooks.length > 0, `${line.cardPrefix} has an onFight hook`);
      for (const fightHook of fightHooks) {
        assert.deepStrictEqual(fightHook.effects, [{ primitive: 'ko-from-discard-current', magnitude: 1 }]);
        assert.deepStrictEqual(fightHook.unresolvedMarkers ?? [], []);
      }
    });
  }

  for (const line of OPTIONAL_LINES) {
    it(`${line.cardPrefix} "You may" Fight parses to the shipped ko-up-to-from-discard-current:1`, () => {
      const fightHooks = buildGroupHooks(line).filter(
        (hook) => hook.cardId.startsWith(`${line.cardPrefix}-`) && hook.timing === 'onFight',
      );
      assert.ok(fightHooks.length > 0, `${line.cardPrefix} has an onFight hook`);
      for (const fightHook of fightHooks) {
        assert.deepStrictEqual(fightHook.effects, [{ primitive: 'ko-up-to-from-discard-current', magnitude: 1 }]);
        assert.deepStrictEqual(fightHook.unresolvedMarkers ?? [], []);
      }
    });
  }

  it('malformed WP-868 tokens land in unresolvedMarkers, never a partial descriptor', () => {
    const malformedTokens = [
      'hq-heroes-cost-change:less',
      'hq-heroes-cost-change:fewer:1',
      'hq-heroes-cost-change:less:0',
      'hq-heroes-cost-change:less:1:psychic',
      'ko-from-discard-current:0',
      'ko-from-discard-current',
      'reenter-sewers-if-villain-deck-top:twist',
      'reenter-sewers-if-villain-deck-top',
    ];
    const abilities: string[] = [];
    for (const token of malformedTokens) {
      abilities.push(`Fight: Malformed. [effect:${token}]`);
    }
    const setData = { villains: [{ slug: 'malformed-group', cards: [{ slug: 'malformed-card', abilities }] }] };
    const registry = { getSet: (abbr: string) => (abbr === 'test' ? setData : undefined) };
    const config = { villainGroupIds: ['test/malformed-group'], henchmanGroupIds: [] } as unknown as MatchSetupConfig;
    const hooks = buildVillainAbilityHooks(registry, config);
    const firstCopyId = hooks[0]?.cardId;
    assert.ok(firstCopyId !== undefined, 'the malformed card builds hooks');
    const copyHooks = hooks.filter((hook) => hook.cardId === firstCopyId);
    assert.equal(copyHooks.length, malformedTokens.length, 'one hook per malformed line');
    for (let lineIndex = 0; lineIndex < copyHooks.length; lineIndex++) {
      const copyHook = copyHooks[lineIndex]!;
      assert.deepStrictEqual(copyHook.effects, [], `${malformedTokens[lineIndex]} yields no descriptor`);
      assert.equal(copyHook.unresolvedMarkers?.length, 1, `${malformedTokens[lineIndex]} is unresolved`);
    }
  });
});

describe('WP-868 RS-2 mandatory KO from your discard pile (D-24811)', () => {
  it('an empty discard logs a blocked no-op and parks nothing', () => {
    const G = makeState([]);
    fightFlatman(G);
    assert.equal(G.pendingKoDiscardChoices, undefined);
    assert.deepStrictEqual(lastLog(G), {
      text: 'Fight effect: your discard pile is empty (Flatman); nothing to KO.',
      outcome: 'blocked',
    });
  });

  it('one card is KO\'d at once: no prompt, G.ko gains it', () => {
    const G = makeState([HERO_A]);
    fightFlatman(G);
    assert.equal(G.pendingKoDiscardChoices, undefined, 'nothing parks');
    assert.deepStrictEqual(G.playerZones['0']!.discard, []);
    assert.deepStrictEqual(G.ko, [HERO_A]);
    assert.deepStrictEqual(lastLog(G), {
      text: "Fight effect: KO'd Hero A from your discard pile (Flatman).",
      outcome: 'applied',
    });
  });

  it('a discard of one shared id (three Wounds) KOs one copy at once', () => {
    const G = makeState([WOUND_EXT_ID, WOUND_EXT_ID, WOUND_EXT_ID]);
    fightFlatman(G);
    assert.equal(G.pendingKoDiscardChoices, undefined);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [WOUND_EXT_ID, WOUND_EXT_ID]);
    assert.deepStrictEqual(G.ko, [WOUND_EXT_ID]);
  });

  it('the direct KO writes the owned-card-KO record a waiting grant reads', () => {
    const G = makeState([HERO_A]);
    // why: a waiting grant whose hook reads the owned-KO condition (Absorb Energies, D-24789);
    // only then does recordOwnedCardKoed write the count.
    G.heroAbilityHooks = [
      { cardId: 'test/hero/absorb#0', timing: 'onPlay', keywords: [], effects: [], conditions: [{ type: OWNED_CARD_KOED_CONDITION_TYPE, value: '1' }] },
    ] as unknown as LegendaryGameState['heroAbilityHooks'];
    G.deferredConditionalGrants = [{ playerId: '0', cardId: 'test/hero/absorb#0', hookIndex: 0 }];
    fightFlatman(G);
    assert.deepStrictEqual(G.ownedCardsKoedSinceResolve, { '0': 1 });
  });

  it('two distinct cards park the choice with minCount 1', () => {
    const G = makeState([HERO_A, HERO_B]);
    fightFlatman(G);
    assert.deepStrictEqual(G.pendingKoDiscardChoices, [
      { choiceType: 'ko-from-discard', playerID: '0', maxCount: 1, minCount: 1, sourceCardId: FLATMAN },
    ]);
    assert.deepStrictEqual(lastLog(G), {
      text: 'Fight effect: KO 1 card(s) from your discard pile (Flatman).',
      outcome: 'neutral',
    });
  });

  it('the resolve move rejects an empty selection (queue intact) and accepts one card', () => {
    const G = makeState([HERO_A, HERO_B]);
    fightFlatman(G);
    resolveKoDiscardChoice(moveContext(G), { cardIds: [] });
    assert.equal(hasPendingKoDiscardChoice(G), true, 'zero cards is not a legal answer to a mandatory KO');
    assert.deepStrictEqual(G.ko, []);
    resolveKoDiscardChoice(moveContext(G), { cardIds: [HERO_B] });
    assert.equal(hasPendingKoDiscardChoice(G), false);
    assert.deepStrictEqual(G.ko, [HERO_B]);
    assert.deepStrictEqual(G.playerZones['0']!.discard, [HERO_A]);
  });

  it('the bot answer is never empty for a mandatory entry, even with nothing cullable', () => {
    const G = makeState([HERO_A, HERO_B]);
    fightFlatman(G);
    assert.deepStrictEqual(selectDefaultKoDiscardCardIds(G), [HERO_A], 'the top-up takes the first card in discard order');
  });

  it('the bot prefers a Wound in a discard of two Wounds plus a Hero', () => {
    const G = makeState([HERO_A, WOUND_EXT_ID, WOUND_EXT_ID]);
    fightFlatman(G);
    assert.ok(hasPendingKoDiscardChoice(G), 'two distinct ids: the choice parks');
    const pick = selectDefaultKoDiscardCardIds(G);
    assert.deepStrictEqual(pick, [WOUND_EXT_ID]);
    resolveKoDiscardChoice(moveContext(G), { cardIds: pick });
    assert.equal(hasPendingKoDiscardChoice(G), false, 'the resolve accepts the bot answer');
  });

  it('the bot top-up tracks discard positions, so a repeated id is not taken twice', () => {
    const G = makeState([WOUND_EXT_ID, WOUND_EXT_ID, HERO_A, HERO_B]);
    const entry: PendingKoDiscardChoice = { choiceType: 'ko-from-discard', playerID: '0', maxCount: 3, minCount: 3 };
    G.pendingKoDiscardChoices = [entry];
    const pick = selectDefaultKoDiscardCardIds(G);
    assert.deepStrictEqual(pick, [WOUND_EXT_ID, WOUND_EXT_ID, HERO_A]);
    resolveKoDiscardChoice(moveContext(G), { cardIds: pick });
    assert.equal(hasPendingKoDiscardChoice(G), false, 'the resolve accepts the three-card answer');
  });

  it('the bot top-up takes repeated non-cullable copies by position, not by id', () => {
    // why: Inspector P2 — two S.H.I.E.L.D. Officers share one id and neither pass takes them (an
    // Officer is never culled), so the top-up must take BOTH copies. An id-based "already chosen"
    // skip would stop at one card, the resolve would reject it, and the block-all guard would stall.
    const G = makeState([SHIELD_OFFICER_EXT_ID, SHIELD_OFFICER_EXT_ID]);
    G.pendingKoDiscardChoices = [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 2, minCount: 2 }];
    const pick = selectDefaultKoDiscardCardIds(G);
    assert.deepStrictEqual(pick, [SHIELD_OFFICER_EXT_ID, SHIELD_OFFICER_EXT_ID]);
    resolveKoDiscardChoice(moveContext(G), { cardIds: pick });
    assert.equal(hasPendingKoDiscardChoice(G), false, 'the resolve accepts both copies');
  });

  it('the required count is clamped by the discard size', () => {
    const G = makeState([HERO_A]);
    G.pendingKoDiscardChoices = [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 2, minCount: 2 }];
    resolveKoDiscardChoice(moveContext(G), { cardIds: [HERO_A] });
    assert.equal(hasPendingKoDiscardChoice(G), false, 'one card satisfies min(2, 1)');
  });

  it('a Salomé "up to" entry still accepts an empty selection, and its bot answer is unchanged', () => {
    const G = makeState([HERO_A, HERO_B]);
    G.pendingKoDiscardChoices = [{ choiceType: 'ko-from-discard', playerID: '0', maxCount: 2, sourceCardId: FLATMAN }];
    assert.deepStrictEqual(selectDefaultKoDiscardCardIds(G), [], 'nothing cullable: the optional bot KOs nothing');
    resolveKoDiscardChoice(moveContext(G), { cardIds: [] });
    assert.equal(hasPendingKoDiscardChoice(G), false);
    assert.deepStrictEqual(G.ko, []);
  });
});
