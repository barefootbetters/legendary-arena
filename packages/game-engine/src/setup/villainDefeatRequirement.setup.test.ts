/**
 * Tests for buildVillainDefeatRequirements (WP-292 / D-24076).
 *
 * Verifies the [require-to-defeat:<kind>:<value>] parser: each kind, per-copy
 * fan-out, marker robustness (unknown kind, empty value, no marker), and that a
 * Size-Changing line's inline [hc:...] is NOT parsed as a requirement.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildVillainDefeatRequirements } from './villainDefeatRequirement.setup.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';

interface MockVillainCard {
  slug: string;
  abilities: string[];
  copies?: number;
}
interface MockVillainGroup {
  slug: string;
  cards: MockVillainCard[];
}

/** Builds a registry mock exposing getSet for the given villain groups. */
function makeRegistry(setAbbr: string, villains: MockVillainGroup[]) {
  const setData = {
    abbr: setAbbr,
    villains,
    henchmen: [],
    schemes: [],
    masterminds: [],
    heroes: [],
    bystanders: [],
    wounds: [],
    other: [],
  };
  return {
    getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined),
  };
}

/** Minimal MatchSetupConfig selecting the given villain groups. */
function makeConfig(villainGroupIds: string[]): MatchSetupConfig {
  return {
    schemeId: 'core/midtown-bank-robbery',
    mastermindId: 'core/magneto',
    villainGroupIds,
    henchmanGroupIds: [],
    heroDeckIds: [],
    bystandersCount: 5,
    woundsCount: 5,
    officersCount: 5,
    sidekicksCount: 5,
  };
}

describe('buildVillainDefeatRequirements — marker parsing', () => {
  it('parses a team requirement and fans it out across every copy', () => {
    const registry = makeRegistry('core', [
      {
        slug: 'brotherhood',
        cards: [
          {
            slug: 'blob',
            copies: 2,
            abilities: [
              "You can't defeat Blob unless you have an [team:x-men] Hero. [require-to-defeat:team:x-men]",
            ],
          },
        ],
      },
    ]);
    const requirements = buildVillainDefeatRequirements(
      registry,
      makeConfig(['core/brotherhood']),
    );

    // why: copies:2 → both copy-indexed instances carry the requirement.
    assert.deepStrictEqual(requirements['core-villain-brotherhood-blob-00'], {
      kind: 'team',
      value: 'x-men',
    });
    assert.deepStrictEqual(requirements['core-villain-brotherhood-blob-01'], {
      kind: 'team',
      value: 'x-men',
    });
    assert.equal(Object.keys(requirements).length, 2);
  });

  it("maps the marker's `hc` token to the 'hero-class' kind", () => {
    const registry = makeRegistry('core', [
      {
        slug: 'spider-foes',
        cards: [
          {
            slug: 'venom',
            copies: 1,
            abilities: [
              "You can't defeat Venom unless you have a [hc:covert] Hero. [require-to-defeat:hc:covert]",
              'Escape: Each player gains a Wound. [effect:gainWoundEachPlayer]',
            ],
          },
        ],
      },
    ]);
    const requirements = buildVillainDefeatRequirements(
      registry,
      makeConfig(['core/spider-foes']),
    );

    assert.deepStrictEqual(requirements['core-villain-spider-foes-venom-00'], {
      kind: 'hero-class',
      value: 'covert',
    });
    assert.equal(Object.keys(requirements).length, 1);
  });

  it('ignores an unknown kind, an empty value, and a card with no marker', () => {
    const registry = makeRegistry('core', [
      {
        slug: 'oddities',
        cards: [
          { slug: 'unknown-kind', abilities: ['[require-to-defeat:color:red]'] },
          { slug: 'empty-value', abilities: ['[require-to-defeat:team:]'] },
          { slug: 'no-marker', abilities: ['Just some passive flavor text.'] },
        ],
      },
    ]);
    const requirements = buildVillainDefeatRequirements(
      registry,
      makeConfig(['core/oddities']),
    );
    assert.deepStrictEqual(requirements, {});
  });

  it('does NOT treat a Size-Changing line\'s inline [hc:...] as a requirement', () => {
    // why: the cvwr "Venom" carries `[keyword:Size-Changing]: [hc:covert]` — an
    // inline class token, not a defeat requirement. Only [require-to-defeat:...]
    // produces a requirement, so this card stays unmarked (the cvwr-unmarked guard).
    const registry = makeRegistry('cvwr', [
      {
        slug: 'symbiotes',
        cards: [
          {
            slug: 'venom',
            copies: 1,
            abilities: ['[keyword:Size-Changing]: [hc:covert]'],
          },
        ],
      },
    ]);
    const requirements = buildVillainDefeatRequirements(
      registry,
      makeConfig(['cvwr/symbiotes']),
    );
    assert.deepStrictEqual(requirements, {});
  });

  it('returns an empty record for a non-reader registry', () => {
    assert.deepStrictEqual(
      buildVillainDefeatRequirements(null, makeConfig(['core/brotherhood'])),
      {},
    );
    assert.deepStrictEqual(
      buildVillainDefeatRequirements({}, makeConfig(['core/brotherhood'])),
      {},
    );
  });
});
