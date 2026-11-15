/**
 * Tests for buildFightSizeChanging / readFightSizeChanging (D-24802).
 *
 * Reads the committed card data (amwp, antm, chmp, cvwr), so the builder is tested against
 * the printed lines: every bare Size-Changing / Microscopic Size-Changing villain line is
 * keyed, a timing line that merely mentions the keyword is not, Fin Fang Foom's base face is
 * keyed by the face id setup chooses, and a match without Size-Changing gets no G field.
 *
 * Uses node:test only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFightSizeChanging, readFightSizeChanging } from './buildFightSizeChanging.js';
import { buildInitialGameState } from './buildInitialGameState.js';
import { makeMockCtx } from '../test/mockCtx.js';
import { makeCardRegistryReader } from '../test/fixtureBuilders.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';

// why: resolve the repo-root data directory from this test's own location (the
// amwpWaspSizeChanging.test.ts precedent), so the tests read the card data that ships.
const CARDS_DIRECTORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'data', 'cards');

const SET_DATA: Record<string, unknown> = {};
for (const setAbbr of ['amwp', 'antm', 'chmp', 'cvwr', 'core']) {
  SET_DATA[setAbbr] = JSON.parse(readFileSync(join(CARDS_DIRECTORY, `${setAbbr}.json`), 'utf8'));
}

/** A registry reader exposing the committed sets above. */
const REGISTRY = {
  getSet: (abbr: string) => SET_DATA[abbr],
};

/**
 * A setup config selecting the given villain groups and mastermind.
 *
 * @param villainGroupIds - The `<setAbbr>/<groupSlug>` villain groups.
 * @param mastermindId - The `<setAbbr>/<mastermindSlug>` mastermind.
 * @returns The config.
 */
function makeConfig(villainGroupIds: string[], mastermindId: string): MatchSetupConfig {
  return {
    schemeId: 'core/midtown-bank-robbery',
    mastermindId,
    villainGroupIds,
    henchmanGroupIds: ['core/doombot-legion'],
    heroDeckIds: ['core/spider-man'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };
}

describe('readFightSizeChanging (D-24802)', () => {
  it('reads the comma-separated chmp form and the space-separated amwp form', () => {
    assert.deepStrictEqual(readFightSizeChanging(['[keyword:Size-Changing]: [hc:strength], [hc:covert]']), {
      classes: ['strength', 'covert'],
      microscopicIcons: [],
    });
    assert.deepStrictEqual(readFightSizeChanging(['[keyword:Size-Changing] [hc:tech]']), {
      classes: ['tech'],
      microscopicIcons: [],
    });
  });

  it('keeps every Microscopic icon (repeats are separate 2-less steps)', () => {
    assert.deepStrictEqual(readFightSizeChanging(['[keyword:Microscopic Size-Changing] [hc:tech][hc:tech][hc:tech]']), {
      classes: [],
      microscopicIcons: ['tech', 'tech', 'tech'],
    });
  });

  it('ignores a timing line that only mentions the keyword', () => {
    assert.equal(readFightSizeChanging(['Fight: A Hero in the HQ gains [keyword:Size-Changing] [hc:tech] this turn.']), null);
    assert.equal(
      readFightSizeChanging(['Master Strike: Each player discards a [hc:instinct] Hero or [keyword:Size-Changing] Hero or gains a Wound.']),
      null,
    );
    assert.equal(readFightSizeChanging(['Fight: KO one of your Heroes.']), null);
    assert.equal(readFightSizeChanging(undefined), null);
  });
});

describe('buildFightSizeChanging (D-24802)', () => {
  it('keys every copy of the cvwr Size-Changing villains with their one class', () => {
    const result = buildFightSizeChanging(
      REGISTRY,
      makeConfig(['cvwr/great-lakes-avengers', 'cvwr/superhuman-registration-act'], 'core/dr-doom'),
      'core/dr-doom',
      ['core-mastermind-dr-doom-dr-doom' as CardExtId],
    );
    assert.deepStrictEqual(result, {
      'cvwr-villain-great-lakes-avengers-big-bertha-00': { classes: ['strength'], microscopicIcons: [] },
      'cvwr-villain-great-lakes-avengers-big-bertha-01': { classes: ['strength'], microscopicIcons: [] },
      'cvwr-villain-great-lakes-avengers-flatman-00': { classes: ['covert'], microscopicIcons: [] },
      'cvwr-villain-great-lakes-avengers-flatman-01': { classes: ['covert'], microscopicIcons: [] },
      'cvwr-villain-superhuman-registration-act-she-hulk-00': { classes: ['strength'], microscopicIcons: [] },
      'cvwr-villain-superhuman-registration-act-she-hulk-01': { classes: ['strength'], microscopicIcons: [] },
      'cvwr-villain-superhuman-registration-act-yellowjacket-00': { classes: ['tech'], microscopicIcons: [] },
      'cvwr-villain-superhuman-registration-act-yellowjacket-01': { classes: ['tech'], microscopicIcons: [] },
    });
  });

  it('reads Sporr\'s bare line only, not its Fight line that grants an HQ Hero Size-Changing', () => {
    const result = buildFightSizeChanging(
      REGISTRY,
      makeConfig(['chmp/monsters-unleashed'], 'core/dr-doom'),
      'core/dr-doom',
      ['core-mastermind-dr-doom-dr-doom' as CardExtId],
    );
    const sporrIds = Object.keys(result).filter((cardId) => cardId.includes('-sporr-'));
    assert.equal(sporrIds.length, 1);
    assert.deepStrictEqual(result[sporrIds[0]!], { classes: ['tech', 'ranged'], microscopicIcons: [] });
    const timBooBaId = Object.keys(result).find((cardId) => cardId.includes('-tim-boo-ba-'));
    assert.ok(timBooBaId !== undefined);
    assert.deepStrictEqual(result[timBooBaId]!.classes, ['strength', 'instinct', 'covert', 'tech', 'ranged']);
    assert.equal(Object.keys(result).length, 6, 'six of the eight Monsters Unleashed villains print Size-Changing');
  });

  it('keys the amwp and antm Microscopic villains with one icon per printed icon', () => {
    const result = buildFightSizeChanging(
      REGISTRY,
      makeConfig(['amwp/quantum-realm', 'antm/queens-vengeance'], 'core/dr-doom'),
      'core/dr-doom',
      ['core-mastermind-dr-doom-dr-doom' as CardExtId],
    );
    const gigantusId = Object.keys(result).find((cardId) => cardId.includes('-gigantus-'));
    assert.ok(gigantusId !== undefined);
    assert.deepStrictEqual(result[gigantusId]!, { classes: [], microscopicIcons: Array(6).fill('strength') });
    const appetizerId = Object.keys(result).find((cardId) => cardId.includes('-lord-krylars-appetizer-'));
    assert.ok(appetizerId !== undefined);
    assert.deepStrictEqual(result[appetizerId]!.microscopicIcons, Array(4).fill('covert'));
  });

  it('keys Fin Fang Foom\'s fightable base face, never the Epic face', () => {
    const result = buildFightSizeChanging(
      REGISTRY,
      makeConfig([], 'chmp/fin-fang-foom'),
      'chmp/fin-fang-foom',
      ['chmp-mastermind-fin-fang-foom-fin-fang-foom' as CardExtId],
    );
    assert.deepStrictEqual(result, {
      'chmp-mastermind-fin-fang-foom-fin-fang-foom': {
        classes: ['strength', 'instinct', 'covert', 'tech', 'ranged'],
        microscopicIcons: [],
      },
    });
  });

  it('keys a transform face only when setup passes it as fightable (Yellowjacket is not allowlisted)', () => {
    const baseOnly = buildFightSizeChanging(
      REGISTRY,
      makeConfig([], 'amwp/darren-cross'),
      'amwp/darren-cross',
      ['amwp-mastermind-darren-cross-darren-cross' as CardExtId],
    );
    assert.deepStrictEqual(baseOnly, {}, 'Darren Cross\'s base face prints no Size-Changing');
    const withAlternate = buildFightSizeChanging(
      REGISTRY,
      makeConfig([], 'amwp/darren-cross'),
      'amwp/darren-cross',
      ['amwp-mastermind-darren-cross-darren-cross' as CardExtId, 'amwp-mastermind-darren-cross-yellowjacket' as CardExtId],
    );
    assert.deepStrictEqual(withAlternate, {
      'amwp-mastermind-darren-cross-yellowjacket': { classes: [], microscopicIcons: ['tech', 'tech'] },
    });
  });

  it('a core match and a registry without getSet yield an empty map', () => {
    assert.deepStrictEqual(
      buildFightSizeChanging(REGISTRY, makeConfig(['core/brotherhood'], 'core/dr-doom'), 'core/dr-doom', [
        'core-mastermind-dr-doom-dr-doom' as CardExtId,
      ]),
      {},
    );
    assert.deepStrictEqual(
      buildFightSizeChanging({}, makeConfig(['cvwr/great-lakes-avengers'], 'core/dr-doom'), 'core/dr-doom', []),
      {},
    );
  });

  it('setup omits G.fightSizeChanging in a match without Size-Changing', () => {
    const gameState = buildInitialGameState(
      makeConfig(['core/brotherhood'], 'core/dr-doom'),
      makeCardRegistryReader(),
      makeMockCtx({ numPlayers: 2 }),
    );
    assert.equal(Object.prototype.hasOwnProperty.call(gameState, 'fightSizeChanging'), false);
  });

  // why: the builder makes the mastermind key from its own id template while setup passes
  // buildMastermindState's baseCardId; running the real setup path catches drift between them.
  it('setup keys G.mastermind.baseCardId for Fin Fang Foom', () => {
    const gameState = buildInitialGameState(
      makeConfig(['chmp/monsters-unleashed'], 'chmp/fin-fang-foom'),
      makeCardRegistryReader({ listSets: () => [{ abbr: 'chmp' }], getSet: REGISTRY.getSet }),
      makeMockCtx({ numPlayers: 2 }),
    );
    assert.ok(gameState.fightSizeChanging !== undefined, 'G.fightSizeChanging is present');
    assert.deepStrictEqual(gameState.fightSizeChanging[gameState.mastermind.baseCardId], {
      classes: ['strength', 'instinct', 'covert', 'tech', 'ranged'],
      microscopicIcons: [],
    });
  });
});
