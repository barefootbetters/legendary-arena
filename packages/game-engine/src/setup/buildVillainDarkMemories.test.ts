/**
 * Tests for buildVillainDarkMemories (WP-902 / D-24859).
 *
 * The whole-line bare `[keyword:Dark Memories]` scan over the match's selected villain groups,
 * the D-24589 Blood Frenzy pattern. Uses node:test only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildVillainDarkMemories } from './buildVillainDarkMemories.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

/**
 * The bkwd Elite Assassins group as printed (abilities trimmed to the relevant lines). Blue Talon
 * and Iron Maiden print the bare Dark Memories line; Snapdragon and Black Lotus do not.
 */
const ELITE_ASSASSINS_GROUP = {
  slug: 'elite-assassins',
  cards: [
    { slug: 'blue-talon', copies: 2, abilities: ['[keyword:Dark Memories]', 'Ambush: Each player reveals a Ranged Hero or gains a Wound.'] },
    { slug: 'iron-maiden', copies: 2, abilities: ['[keyword:Dark Memories]', 'Fight: Each player may Unleash one of their Heroes from Undercover.'] },
    { slug: 'snapdragon', copies: 2, abilities: ['Ambush: Each player discards a non-grey Hero. Then each player draws a card.'] },
    { slug: 'black-lotus', copies: 2, abilities: ['Ambush: Each player discards a card that costs 0.', 'Fight: You get +3 Recruit.'] },
  ],
};

/** A villain whose Dark Memories mention is inside a larger line — never flagged (whole-line anchor). */
const GRANTED_GROUP = {
  slug: 'granted',
  cards: [
    { slug: 'the-grantor', copies: 1, abilities: ['Villains here get [keyword:Dark Memories]. They are mean.'] },
  ],
};

/** A registry reader exposing `bkwd` (Elite Assassins), `rvlt` (two Dark Memories villains), and `core`. */
const REGISTRY = {
  getSet: (abbr: string) => {
    if (abbr === 'bkwd') {
      return { villains: [ELITE_ASSASSINS_GROUP, GRANTED_GROUP] };
    }
    if (abbr === 'rvlt') {
      return {
        villains: [{
          slug: 'hoods-gang',
          cards: [
            { slug: 'cancer', copies: 2, abilities: ['[keyword:Dark Memories]'] },
            { slug: 'chemistro', copies: 2, abilities: ['[keyword:Dark Memories].'] },
            { slug: 'madam-masque', copies: 2, abilities: ['[keyword:Dark Memories]'] },
          ],
        }],
      };
    }
    if (abbr === 'core') {
      return { villains: [{ slug: 'hydra', cards: [{ slug: 'viper', copies: 1, abilities: ['Fight: Each player without another HYDRA Villain gains a Wound.'] }] }] };
    }
    return undefined;
  },
};

/** A setup config selecting the given villain groups. */
function makeConfig(villainGroupIds: string[]): MatchSetupConfig {
  return {
    schemeId: 'core/midtown-bank-robbery',
    mastermindId: 'bkwd/indestructible-man',
    villainGroupIds,
    henchmanGroupIds: ['core/doombot-legion'],
    heroDeckIds: ['core/spider-man'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };
}

describe('buildVillainDarkMemories (WP-902 / D-24859)', () => {
  it('flags every copy of each bkwd Dark Memories villain, and nothing else in the group', () => {
    const result = buildVillainDarkMemories(REGISTRY, makeConfig(['bkwd/elite-assassins']));
    assert.deepStrictEqual(result, {
      'bkwd-villain-elite-assassins-blue-talon-00': true,
      'bkwd-villain-elite-assassins-blue-talon-01': true,
      'bkwd-villain-elite-assassins-iron-maiden-00': true,
      'bkwd-villain-elite-assassins-iron-maiden-01': true,
    });
  });

  it('flags the three rvlt Hoods Gang Dark Memories villains (both copies each)', () => {
    const result = buildVillainDarkMemories(REGISTRY, makeConfig(['rvlt/hoods-gang']));
    assert.deepStrictEqual(result, {
      'rvlt-villain-hoods-gang-cancer-00': true,
      'rvlt-villain-hoods-gang-cancer-01': true,
      'rvlt-villain-hoods-gang-chemistro-00': true,
      'rvlt-villain-hoods-gang-chemistro-01': true,
      'rvlt-villain-hoods-gang-madam-masque-00': true,
      'rvlt-villain-hoods-gang-madam-masque-01': true,
    });
  });

  it('never flags a villain whose Dark Memories mention is inside a larger line (whole-line anchor)', () => {
    assert.deepStrictEqual(buildVillainDarkMemories(REGISTRY, makeConfig(['bkwd/granted'])), {});
  });

  it('is empty when no selected group prints Dark Memories (so setup omits the G field)', () => {
    assert.deepStrictEqual(buildVillainDarkMemories(REGISTRY, makeConfig(['core/hydra'])), {});
  });

  it('matches the keyword label case-insensitively and tolerates a trailing period', () => {
    const registry = {
      getSet: () => ({ villains: [{ slug: 'elite-assassins', cards: [{ slug: 'blue-talon', copies: 1, abilities: ['  [keyword:  dark memories  ] .'] }] }] }),
    };
    assert.deepStrictEqual(buildVillainDarkMemories(registry, makeConfig(['bkwd/elite-assassins'])), {
      'bkwd-villain-elite-assassins-blue-talon-00': true,
    });
  });

  it('returns an empty map for a narrow mock registry without getSet', () => {
    assert.deepStrictEqual(buildVillainDarkMemories({}, makeConfig(['bkwd/elite-assassins'])), {});
  });
});
