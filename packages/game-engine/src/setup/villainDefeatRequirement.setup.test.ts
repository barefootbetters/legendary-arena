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
import {
  buildVillainDefeatRequirements,
  buildVillainFightDiscardCosts,
  buildVillainVariableAttack,
  parseVariableAttackLine,
} from './villainDefeatRequirement.setup.js';
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

describe('WP-817 buildVillainFightDiscardCosts (D-24750)', () => {
  it('T6: fans the Primus cost out to both copies as fresh objects; a plain villain is absent', () => {
    // why: the Primus line is copied verbatim from the regenerated data/cards/ca75.json.
    const registry = makeRegistry('ca75', [
      {
        slug: 'zolas-creations',
        cards: [
          {
            slug: 'primus',
            copies: 2,
            abilities: [
              'To fight Primus, you must also discard a card that costs 2, 3, 5, or 7. [discard-to-fight:cost:2+3+5+7]',
              'Escape: each player discards a Hero that costs 2, 3, 5, or 7. [effect:discard-hero-each-player-by-cost:2+3+5+7]',
            ],
          },
          {
            slug: 'doughboy',
            copies: 2,
            abilities: ['[keyword:Abomination]', 'Fight: KO one of your Heroes. [effect:koHeroCurrentPlayer]'],
          },
        ],
      },
    ]);
    const discardCosts = buildVillainFightDiscardCosts(registry, makeConfig(['ca75/zolas-creations']));
    assert.deepStrictEqual(Object.keys(discardCosts).sort(), [
      'ca75-villain-zolas-creations-primus-00',
      'ca75-villain-zolas-creations-primus-01',
    ]);
    const first = discardCosts['ca75-villain-zolas-creations-primus-00']!;
    const second = discardCosts['ca75-villain-zolas-creations-primus-01']!;
    assert.deepStrictEqual(first, { eligibleCosts: [2, 3, 5, 7] });
    assert.deepStrictEqual(second, { eligibleCosts: [2, 3, 5, 7] });
    assert.notEqual(first, second, 'copies must not alias one object');
    assert.notEqual(first.eligibleCosts, second.eligibleCosts, 'copies must not alias one costs array');
  });

  it('T7: every malformed marker is inert and never throws', () => {
    const malformedLines = [
      'To fight X. [discard-to-fight:cost:]',
      'To fight X. [discard-to-fight:cost:3+2]',
      'To fight X. [discard-to-fight:2+3]',
      'To fight X. [discard-to-fight:cost:2+x]',
    ];
    for (const line of malformedLines) {
      const registry = makeRegistry('core', [
        { slug: 'malformed', cards: [{ slug: 'villain', abilities: [line] }] },
      ]);
      const discardCosts = buildVillainFightDiscardCosts(registry, makeConfig(['core/malformed']));
      assert.deepStrictEqual(discardCosts, {}, `${line} must produce no entry`);
    }
  });

  it('returns an empty record for a registry that is not a reader', () => {
    assert.deepStrictEqual(buildVillainFightDiscardCosts({}, makeConfig(['ca75/zolas-creations'])), {});
  });
});

// ---------------------------------------------------------------------------
// WP-841 — parseVariableAttackLine / buildVillainVariableAttack (D-24774)
// ---------------------------------------------------------------------------

// why: the four passive lines, and the negatives' lines, copied verbatim from the
// regenerated data/cards/co2e.json (the overlay's output).
const STRUCKER_LINE =
  'Baron Strucker gets +1[icon:attack] for each other HYDRA Villain in the city and/or Escape Pile. [variable-attack:per-other-hydra-villain:1]';
const PAIBOK_LINE =
  'Paibok gets +1[icon:attack] for each Hero Class among Heroes in the HQ. [variable-attack:per-hq-hero-class:1]';
const SUPER_SKRULL_LINE =
  'Super-Skrull gets +1[icon:attack] for each Hero Class among Heroes in the HQ. [variable-attack:per-hq-hero-class:1]';
const HYDRO_MAN_LINE =
  'Hydro-Man gets +2[icon:attack] in the Sewers and Bridge. [variable-attack:flat:2@sewers+bridge]';

describe('WP-841 parseVariableAttackLine (D-24774)', () => {
  it('T12: the four regenerated lines and a gated per-count marker parse; ungated entries have no requireCitySpaces key', () => {
    const strucker = parseVariableAttackLine(STRUCKER_LINE);
    const paibok = parseVariableAttackLine(PAIBOK_LINE);
    const superSkrull = parseVariableAttackLine(SUPER_SKRULL_LINE);
    assert.deepStrictEqual(strucker, { source: 'per-other-hydra-villain', attackPerUnit: 1 });
    assert.deepStrictEqual(paibok, { source: 'per-hq-hero-class', attackPerUnit: 1 });
    assert.deepStrictEqual(superSkrull, { source: 'per-hq-hero-class', attackPerUnit: 1 });
    for (const entry of [strucker, paibok, superSkrull]) {
      assert.equal(Object.prototype.hasOwnProperty.call(entry, 'requireCitySpaces'), false);
    }
    assert.deepStrictEqual(parseVariableAttackLine(HYDRO_MAN_LINE), {
      source: 'flat',
      attackPerUnit: 2,
      requireCitySpaces: ['sewers', 'bridge'],
    });
    assert.deepStrictEqual(parseVariableAttackLine('X gets +1. [variable-attack:per-hq-hero-class:1@rooftops]'), {
      source: 'per-hq-hero-class',
      attackPerUnit: 1,
      requireCitySpaces: ['rooftops'],
    });
  });

  it('T13: every malformed marker, and a line with no marker, is inert and never throws', () => {
    const malformedLines = [
      'X gets +2. [variable-attack:flat:2]',
      'X gets +0. [variable-attack:per-hq-hero-class:0]',
      'X gets +1. [variable-attack:wound:1]',
      'X gets +1. [variable-attack:per-hq-hero-class:1:2]',
      'X gets +1. [variable-attack:per-hq-hero-class:x]',
      'X gets +2. [variable-attack:flat:2@sewers+lagoon]',
      'X gets +2. [variable-attack:flat:2@]',
      'X gets +2. [variable-attack:flat:2@sewers@bridge]',
      'X gets +2. [variable-attack:flat:2@sewers+sewers]',
      'Fight: KO one of your Heroes.',
    ];
    for (const line of malformedLines) {
      assert.doesNotThrow(() => parseVariableAttackLine(line));
      assert.equal(parseVariableAttackLine(line), null, `${line} must produce no entry`);
    }
  });
});

describe('WP-841 buildVillainVariableAttack (D-24774)', () => {
  it('T14: the co2e groups yield exactly the four cards x two copies, unaliased; negatives unflagged', () => {
    const registry = makeRegistry('co2e', [
      {
        slug: 'hydra',
        cards: [
          {
            slug: 'baron-strucker-supreme-hydra',
            copies: 2,
            abilities: [
              STRUCKER_LINE,
              'Fight: Shuffle four cards from the Bystander Deck into the Villain Deck. Then play two cards from the Villain Deck.',
            ],
          },
          {
            slug: 'viper',
            copies: 2,
            abilities: [
              'Fight: Each player without another HYDRA Villain in their Victory Pile gains a Wound.',
              'Escape: Same effect.',
            ],
          },
        ],
      },
      {
        slug: 'skulls',
        cards: [
          {
            slug: 'paibok-the-power-skrull',
            copies: 2,
            abilities: [
              PAIBOK_LINE,
              'Fight: Choose a Hero from the HQ for each player. Each player gains that Hero. [effect:give-hq-hero-each-player]',
            ],
          },
          {
            slug: 'skrull-queen-veranke',
            copies: 2,
            abilities: [
              'Ambush: Skrull Queen Veranke captures the highest-cost Hero from the HQ. She gets +[icon:attack] equal to its cost.',
              'Fight: Either KO that Hero or choose a player to gain it.',
            ],
          },
          {
            slug: 'skrull-shapeshifter',
            copies: 2,
            abilities: [
              "Ambush: Skrull Shapeshifter captures the rightmost Hero from the HQ. It gets +[icon:attack] equal to that Hero's cost.",
              'Fight: Either KO that Hero or choose a player to gain it.',
            ],
          },
          {
            slug: 'super-skrull',
            copies: 2,
            abilities: [SUPER_SKRULL_LINE, 'Fight: KO one of your Heroes.'],
          },
        ],
      },
      {
        slug: 'sinister-syndicate',
        cards: [
          {
            slug: 'beetle',
            copies: 2,
            abilities: [
              'Fight: Count your [hc:covert] Heroes, then draw that many cards.',
              'Escape: Each player reveals a [hc:covert] Hero or gains a Wound.',
            ],
          },
          {
            slug: 'hydro-man',
            copies: 2,
            abilities: [
              HYDRO_MAN_LINE,
              'Fight: If you fight Hydro-Man in the Sewers or Bridge, KO one of your Heroes.',
            ],
          },
        ],
      },
    ]);
    const variableAttack = buildVillainVariableAttack(
      registry,
      makeConfig(['co2e/hydra', 'co2e/skulls', 'co2e/sinister-syndicate']),
    );
    const perHqHeroClass = { source: 'per-hq-hero-class', attackPerUnit: 1 };
    const hydroMan = { source: 'flat', attackPerUnit: 2, requireCitySpaces: ['sewers', 'bridge'] };
    assert.deepStrictEqual(variableAttack, {
      'co2e-villain-hydra-baron-strucker-supreme-hydra-00': { source: 'per-other-hydra-villain', attackPerUnit: 1 },
      'co2e-villain-hydra-baron-strucker-supreme-hydra-01': { source: 'per-other-hydra-villain', attackPerUnit: 1 },
      'co2e-villain-skulls-paibok-the-power-skrull-00': perHqHeroClass,
      'co2e-villain-skulls-paibok-the-power-skrull-01': perHqHeroClass,
      'co2e-villain-skulls-super-skrull-00': perHqHeroClass,
      'co2e-villain-skulls-super-skrull-01': perHqHeroClass,
      'co2e-villain-sinister-syndicate-hydro-man-00': hydroMan,
      'co2e-villain-sinister-syndicate-hydro-man-01': hydroMan,
    });
    for (const entry of Object.values(variableAttack)) {
      if (entry.source !== 'flat') {
        assert.equal(Object.prototype.hasOwnProperty.call(entry, 'requireCitySpaces'), false);
      }
    }
    const first = variableAttack['co2e-villain-sinister-syndicate-hydro-man-00']!;
    const second = variableAttack['co2e-villain-sinister-syndicate-hydro-man-01']!;
    assert.notEqual(first, second, 'copies must not alias one object');
    assert.notEqual(first.requireCitySpaces, second.requireCitySpaces, 'copies must not alias one spaces array');
  });

  it('returns an empty record for a registry that is not a reader', () => {
    assert.deepStrictEqual(buildVillainVariableAttack({}, makeConfig(['co2e/hydra'])), {});
  });
});
