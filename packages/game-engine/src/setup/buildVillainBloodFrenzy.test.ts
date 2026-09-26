/**
 * Tests for buildVillainBloodFrenzy (WP-760 / D-24589).
 *
 * Uses node:test only — no boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildVillainBloodFrenzy } from './buildVillainBloodFrenzy.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

/** The Fallen as printed in data/cards/mdns.json (abilities trimmed to the relevant lines). */
const FALLEN_GROUP = {
  slug: 'fallen',
  cards: [
    { slug: 'metarchus', copies: 2, abilities: ['[keyword:Blood Frenzy]', 'Fight: KO one of your Heroes. [effect:koHeroCurrentPlayer]'] },
    { slug: 'atrocity', copies: 2, abilities: ['Fight: Rescue a Bystander. [effect:captureBystander]'] },
    { slug: 'patriarch', copies: 2, abilities: ['Fight: Reveal the top card of your deck.'] },
    { slug: 'salom-sorceress-supreme', copies: 2, abilities: ['[keyword:Blood Frenzy]', 'Fight: KO up to two cards from your discard pile.'] },
  ],
};

/** A registry reader exposing `mdns` (The Fallen) and `core` (HYDRA, no Blood Frenzy). */
const REGISTRY = {
  getSet: (abbr: string) => {
    if (abbr === 'mdns') {
      return { villains: [FALLEN_GROUP] };
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
    mastermindId: 'mdns/zarathos',
    villainGroupIds,
    henchmanGroupIds: ['core/doombot-legion'],
    heroDeckIds: ['core/spider-man'],
    bystandersCount: 1,
    woundsCount: 1,
    officersCount: 1,
    sidekicksCount: 1,
  };
}

describe('buildVillainBloodFrenzy (WP-760 / D-24589)', () => {
  it('flags every copy of each Blood Frenzy villain in a selected group, and nothing else', () => {
    const result = buildVillainBloodFrenzy(REGISTRY, makeConfig(['mdns/fallen', 'core/hydra']));
    assert.deepStrictEqual(result, {
      'mdns-villain-fallen-metarchus-00': true,
      'mdns-villain-fallen-metarchus-01': true,
      'mdns-villain-fallen-salom-sorceress-supreme-00': true,
      'mdns-villain-fallen-salom-sorceress-supreme-01': true,
    });
  });

  it('is empty when no selected group prints Blood Frenzy (so setup omits the G field)', () => {
    assert.deepStrictEqual(buildVillainBloodFrenzy(REGISTRY, makeConfig(['core/hydra'])), {});
  });

  it('matches the keyword label case-insensitively', () => {
    const registry = {
      getSet: () => ({ villains: [{ slug: 'fallen', cards: [{ slug: 'metarchus', copies: 1, abilities: ['[keyword:blood frenzy]'] }] }] }),
    };
    assert.deepStrictEqual(buildVillainBloodFrenzy(registry, makeConfig(['mdns/fallen'])), {
      'mdns-villain-fallen-metarchus-00': true,
    });
  });

  it('returns an empty map for a registry without getSet, an unknown set, or a malformed id', () => {
    assert.deepStrictEqual(buildVillainBloodFrenzy({}, makeConfig(['mdns/fallen'])), {});
    assert.deepStrictEqual(buildVillainBloodFrenzy(REGISTRY, makeConfig(['zzzz/fallen'])), {});
    assert.deepStrictEqual(buildVillainBloodFrenzy(REGISTRY, makeConfig(['fallen'])), {});
  });
});
