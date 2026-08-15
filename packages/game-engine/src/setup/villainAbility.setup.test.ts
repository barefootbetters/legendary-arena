/**
 * Setup-parser tests for buildVillainAbilityHooks.
 *
 * Covers Ambush/Fight prefix detection (case + whitespace variants),
 * henchman group-level onFight fan-out, henchman onAmbush deferral (D-18507),
 * [effect:] marker extraction + validation, keywords/effects parity,
 * deterministic emission order, and gate-consistency with buildCardKeywords.
 *
 * Uses node:test and node:assert only. No boardgame.io imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildVillainAbilityHooks } from './villainAbility.setup.js';
import { buildCardKeywords } from './buildCardKeywords.js';
import { hasAmbush } from '../board/boardKeywords.logic.js';
import { VILLAIN_ABILITY_TIMINGS, LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR } from '../rules/villainAbility.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import type { CardExtId } from '../state/zones.types.js';

// ---------------------------------------------------------------------------
// Mock registry builder
// ---------------------------------------------------------------------------

interface MockVillainCard {
  slug: string;
  abilities: string[];
}
interface MockVillainGroup {
  slug: string;
  cards: MockVillainCard[];
}
interface MockHenchmanGroup {
  slug: string;
  abilities: string[];
}

/**
 * Builds a registry mock exposing getSet (for buildVillainAbilityHooks) and
 * listSets / listCards / getSet (for buildCardKeywords). Villain flat cards
 * are derived from the villain groups so buildCardKeywords can match them.
 */
function makeRegistry(
  setAbbr: string,
  villains: MockVillainGroup[],
  henchmen: MockHenchmanGroup[],
) {
  const setData = {
    abbr: setAbbr,
    villains,
    henchmen,
    schemes: [],
    masterminds: [],
    heroes: [],
    bystanders: [],
    wounds: [],
    other: [],
  };

  const flatCards: Array<{
    key: string;
    cardType: string;
    slug: string;
    setAbbr: string;
    abilities: string[];
  }> = [];
  for (const group of villains) {
    for (const card of group.cards) {
      flatCards.push({
        key: `${setAbbr}-villain-${group.slug}-${card.slug}`,
        cardType: 'villain',
        slug: card.slug,
        setAbbr,
        abilities: card.abilities,
      });
    }
  }

  return {
    listCards: () => flatCards,
    listSets: () => [{ abbr: setAbbr }],
    getSet: (abbr: string) => (abbr === setAbbr ? setData : undefined),
  };
}

/**
 * Builds a minimal MatchSetupConfig selecting the given villain/henchman groups.
 */
function makeConfig(
  villainGroupIds: string[],
  henchmanGroupIds: string[],
): MatchSetupConfig {
  return {
    schemeId: 'core/midtown-bank-robbery',
    mastermindId: 'core/dr-doom',
    villainGroupIds,
    henchmanGroupIds,
    heroDeckIds: [],
    bystandersCount: 5,
    woundsCount: 5,
    officersCount: 5,
    sidekicksCount: 5,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildVillainAbilityHooks — timing prefix detection', () => {
  it('detects Ambush: and Fight: case-insensitively with leading whitespace trimmed', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'variants',
          cards: [
            { slug: 'caps', abilities: ['AMBUSH: foo [effect:captureBystander]'] },
            { slug: 'spaced', abilities: ['   Fight: bar [effect:koHeroCurrentPlayer]'] },
            { slug: 'emdash', abilities: ['Ambush — no colon here'] },
            { slug: 'spacedcolon', abilities: ['Ambush : spaced colon'] },
            { slug: 'passive', abilities: ['This is passive text with no timing.'] },
          ],
        },
      ],
      [],
    );
    const config = makeConfig(['core/variants'], []);
    const hooks = buildVillainAbilityHooks(registry, config);

    // why: WP-191 — villain hooks now key by the copy-indexed instance ext_id.
    // The fixture cards declare no `copies`, so each yields a single -00 instance.
    const byCard = (slug: string) =>
      hooks.filter((h) => h.cardId === `core-villain-variants-${slug}-00`);

    assert.equal(byCard('caps').length, 1, 'AMBUSH: matches case-insensitively');
    assert.equal(byCard('caps')[0]!.timing, 'onAmbush');
    assert.equal(byCard('spaced').length, 1, 'leading whitespace is trimmed');
    assert.equal(byCard('spaced')[0]!.timing, 'onFight');
    assert.equal(byCard('emdash').length, 0, 'em-dash variant is not matched');
    assert.equal(byCard('spacedcolon').length, 0, 'spaced-colon variant is not matched');
    assert.equal(byCard('passive').length, 0, 'lines with no timing prefix yield no hook');
  });
});

describe('buildVillainAbilityHooks — [effect:] marker extraction', () => {
  const registry = makeRegistry(
    'core',
    [
      {
        slug: 'mix',
        cards: [
          {
            slug: 'real',
            abilities: ['Fight: KO one of your Heroes. [effect:koHeroCurrentPlayer]'],
          },
          {
            slug: 'bogus',
            abilities: [
              'Fight: do a thing [effect:notARealKeyword] [keyword:Dominates] [icon:attack]',
            ],
          },
          {
            slug: 'freetext',
            abilities: ['Fight: Each player gains a Wound.'],
          },
        ],
      },
    ],
    [],
  );
  const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/mix'], []));
  // why: WP-191 — villain hooks key by the -00 copy instance (no `copies` field).
  const keywordsFor = (slug: string) =>
    hooks.find((h) => h.cardId === `core-villain-mix-${slug}-00`)!.keywords;
  const effectsFor = (slug: string) =>
    hooks.find((h) => h.cardId === `core-villain-mix-${slug}-00`)!.effects;

  it('extracts a valid [effect:] marker', () => {
    assert.deepStrictEqual(keywordsFor('real'), ['koHeroCurrentPlayer']);
    // why: WP-252 — the legacy keyword also translates to its descriptor.
    assert.deepStrictEqual(effectsFor('real'), [
      { primitive: 'ko-hero', target: 'current' },
    ]);
  });

  it('ignores unknown [effect:] values and never reads [keyword:]/[icon:]', () => {
    assert.deepStrictEqual(keywordsFor('bogus'), []);
    assert.deepStrictEqual(effectsFor('bogus'), []);
  });

  it('never parses free-text English into effects', () => {
    assert.deepStrictEqual(keywordsFor('freetext'), []);
    assert.deepStrictEqual(effectsFor('freetext'), []);
  });

  it('still emits a hook (timing preserved) for a matched line with no recognized marker', () => {
    const freetextHook = hooks.find((h) => h.cardId === 'core-villain-mix-freetext-00');
    assert.ok(freetextHook, 'a matched Fight: line yields a hook even with empty effects');
    assert.equal(freetextHook!.timing, 'onFight');
  });
});

describe('buildVillainAbilityHooks — Tier-B @space gate + grammars (WP-489 / D-24295)', () => {
  const registry = makeRegistry(
    'core',
    [
      {
        slug: 'tierb',
        cards: [
          { slug: 'abomination', abilities: ['Fight: rescue three. [effect:capture-bystander:3@streets+bridge]'] },
          { slug: 'the-lizard', abilities: ['Fight: each other. [effect:gain-wound:each-other@sewers]'] },
          { slug: 'ungated-eachother', abilities: ['Fight: bare. [effect:gain-wound:each-other]'] },
          { slug: 'counted-nogate', abilities: ['Fight: two. [effect:capture-bystander:2]'] },
          { slug: 'badspace', abilities: ['Fight: nope. [effect:capture-bystander:1@moon]'] },
          { slug: 'emptyspace', abilities: ['Fight: nope. [effect:capture-bystander:1@streets+]'] },
        ],
      },
    ],
    [],
  );
  const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/tierb'], []));
  const hookFor = (slug: string) =>
    hooks.find((h) => h.cardId === `core-villain-tierb-${slug}-00`)!;

  it('lifts a multi-space @gate onto the counted capture-bystander descriptor', () => {
    assert.deepStrictEqual(hookFor('abomination').effects, [
      { primitive: 'capture-bystander', magnitude: 3, requireCitySpaces: ['streets', 'bridge'] },
    ]);
    // why: keyword-less — the counted+gated capture-bystander must NOT reverse-map.
    assert.deepStrictEqual(hookFor('abomination').keywords, []);
  });

  it('parses gain-wound:each-other with a single-space @gate (default magnitude 1)', () => {
    assert.deepStrictEqual(hookFor('the-lizard').effects, [
      { primitive: 'gain-wound', target: 'each-other', magnitude: 1, requireCitySpaces: ['sewers'] },
    ]);
    assert.deepStrictEqual(hookFor('the-lizard').keywords, []);
  });

  it('parses an ungated each-other and an ungated counted capture-bystander', () => {
    assert.deepStrictEqual(hookFor('ungated-eachother').effects, [
      { primitive: 'gain-wound', target: 'each-other', magnitude: 1 },
    ]);
    assert.deepStrictEqual(hookFor('counted-nogate').effects, [
      { primitive: 'capture-bystander', magnitude: 2 },
    ]);
  });

  it('rejects an unknown or empty @space to unresolvedMarkers (never a silent accept)', () => {
    assert.deepStrictEqual(hookFor('badspace').effects, []);
    assert.deepStrictEqual(hookFor('badspace').unresolvedMarkers, ['capture-bystander:1@moon']);
    assert.deepStrictEqual(hookFor('emptyspace').effects, []);
    assert.deepStrictEqual(hookFor('emptyspace').unresolvedMarkers, ['capture-bystander:1@streets+']);
  });
});

describe('buildVillainAbilityHooks — ko-hero:current:N grammar (WP-492 / D-24298)', () => {
  const registry = makeRegistry(
    'core',
    [
      {
        slug: 'tierd',
        cards: [
          { slug: 'whirlwind', abilities: ['Fight: KO two. [effect:ko-hero:current:2@rooftops+bridge]'] },
          { slug: 'mag2-nogate', abilities: ['Fight: KO two. [effect:ko-hero:current:2]'] },
          { slug: 'bare-current', abilities: ['Fight: KO one. [effect:ko-hero:current]'] },
          { slug: 'mag1-reject', abilities: ['Fight: nope. [effect:ko-hero:current:1]'] },
        ],
      },
    ],
    [],
  );
  const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/tierd'], []));
  const hookFor = (slug: string) => hooks.find((h) => h.cardId === `core-villain-tierd-${slug}-00`)!;

  it('parses ko-hero:current:2 with the @space gate (Whirlwind)', () => {
    assert.deepStrictEqual(hookFor('whirlwind').effects, [
      { primitive: 'ko-hero', target: 'current', magnitude: 2, requireCitySpaces: ['rooftops', 'bridge'] },
    ]);
    // why: keyword-less (magnitude in the descriptorKey) — must NOT reverse-map.
    assert.deepStrictEqual(hookFor('whirlwind').keywords, []);
  });

  it('parses an ungated ko-hero:current:2 and keeps bare ko-hero:current magnitude-less', () => {
    assert.deepStrictEqual(hookFor('mag2-nogate').effects, [
      { primitive: 'ko-hero', target: 'current', magnitude: 2 },
    ]);
    // why: bare `ko-hero:current` parses to the MAGNITUDE-LESS descriptor, which
    // reverse-maps to `koHeroCurrentPlayer` at execution (descriptorToLegacyKeyword)
    // — the parameterized marker itself carries no parse-time legacy keyword.
    assert.deepStrictEqual(hookFor('bare-current').effects, [
      { primitive: 'ko-hero', target: 'current' },
    ]);
    assert.deepStrictEqual(hookFor('bare-current').keywords, []);
  });

  it('rejects ko-hero:current:1 to unresolvedMarkers (magnitude 1 is the bare form)', () => {
    assert.deepStrictEqual(hookFor('mag1-reject').effects, []);
    assert.deepStrictEqual(hookFor('mag1-reject').unresolvedMarkers, ['ko-hero:current:1']);
  });
});

describe('buildVillainAbilityHooks — gain-wound-unless-victory-villain-group grammar (WP-494 / D-24299)', () => {
  const registry = makeRegistry(
    'core',
    [
      {
        slug: 'hydra',
        cards: [
          { slug: 'viper', abilities: [
            'Fight: each player wounds. [effect:gain-wound-unless-victory-villain-group:hydra]',
            'Escape: same. [effect:gain-wound-unless-victory-villain-group:hydra]',
          ] },
          { slug: 'empty-group', abilities: ['Fight: nope. [effect:gain-wound-unless-victory-villain-group:]'] },
          { slug: 'extra-tokens', abilities: ['Fight: nope. [effect:gain-wound-unless-victory-villain-group:hydra:extra]'] },
        ],
      },
    ],
    [],
  );
  const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/hydra'], []));
  const hookFor = (slug: string, timing: string) =>
    hooks.find((h) => h.cardId === `core-villain-hydra-${slug}-00` && h.timing === timing)!;

  it('parses the group slug on BOTH the fight and escape timings', () => {
    assert.deepStrictEqual(hookFor('viper', 'onFight').effects, [
      { primitive: 'gain-wound-unless-victory-villain-group', victoryVillainGroup: 'hydra' },
    ]);
    assert.deepStrictEqual(hookFor('viper', 'onEscape').effects, [
      { primitive: 'gain-wound-unless-victory-villain-group', victoryVillainGroup: 'hydra' },
    ]);
    // why: keyword-less — must NOT reverse-map.
    assert.deepStrictEqual(hookFor('viper', 'onFight').keywords, []);
  });

  it('rejects an empty group slug or extra tokens to unresolvedMarkers', () => {
    assert.deepStrictEqual(hookFor('empty-group', 'onFight').effects, []);
    assert.deepStrictEqual(hookFor('empty-group', 'onFight').unresolvedMarkers, ['gain-wound-unless-victory-villain-group:']);
    assert.deepStrictEqual(hookFor('extra-tokens', 'onFight').effects, []);
  });
});

describe('buildVillainAbilityHooks — ko-wounds-current-hand-and-discard grammar (WP-516 / D-24329)', () => {
  const registry = makeRegistry(
    'core',
    [
      {
        slug: 'enemies-of-asgard',
        cards: [
          {
            slug: 'ymir-frost-giant-king',
            abilities: [
              'Ambush: reveal or wound. [effect:reveal-or-wound:hc:ranged]',
              'Fight: KO your Wounds. [effect:ko-wounds-current-hand-and-discard]',
            ],
          },
          // why: a no-param primitive rejects any trailing colon token (guards a
          // malformed marker from collapsing to the param-less descriptor).
          { slug: 'extra-tokens', abilities: ['Fight: nope. [effect:ko-wounds-current-hand-and-discard:1]'] },
        ],
      },
    ],
    [],
  );
  const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/enemies-of-asgard'], []));
  const hookFor = (slug: string, timing: string) =>
    hooks.find((h) => h.cardId === `core-villain-enemies-of-asgard-${slug}-00` && h.timing === timing)!;

  it('parses the no-param Fight marker to a bare descriptor via the generic branch', () => {
    assert.deepStrictEqual(hookFor('ymir-frost-giant-king', 'onFight').effects, [
      { primitive: 'ko-wounds-current-hand-and-discard' },
    ]);
    // why: keyword-less — must NOT reverse-map to a legacy keyword.
    assert.deepStrictEqual(hookFor('ymir-frost-giant-king', 'onFight').keywords, []);
  });

  it('rejects a trailing param token to unresolvedMarkers', () => {
    assert.deepStrictEqual(hookFor('extra-tokens', 'onFight').effects, []);
    assert.deepStrictEqual(hookFor('extra-tokens', 'onFight').unresolvedMarkers, [
      'ko-wounds-current-hand-and-discard:1',
    ]);
  });
});

describe('buildVillainAbilityHooks — ko-cullable-each-deck-top grammar (WP-519 / D-24332)', () => {
  const registry = makeRegistry(
    'core',
    [
      {
        slug: 'masters-of-evil',
        cards: [
          {
            slug: 'melter',
            abilities: [
              'Fight: Each player reveals the top card of their deck. For each card, you choose to KO it or put it back. [effect:ko-cullable-each-deck-top]',
            ],
          },
          // why: a no-param primitive rejects any trailing colon token (guards a
          // malformed marker from collapsing to the param-less descriptor).
          { slug: 'extra-tokens', abilities: ['Fight: nope. [effect:ko-cullable-each-deck-top:1]'] },
        ],
      },
    ],
    [],
  );
  const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/masters-of-evil'], []));
  const hookFor = (slug: string, timing: string) =>
    hooks.find((h) => h.cardId === `core-villain-masters-of-evil-${slug}-00` && h.timing === timing)!;

  it('parses the no-param Fight marker to a bare descriptor via the generic branch', () => {
    assert.deepStrictEqual(hookFor('melter', 'onFight').effects, [
      { primitive: 'ko-cullable-each-deck-top' },
    ]);
    // why: keyword-less — must NOT reverse-map to a legacy keyword.
    assert.deepStrictEqual(hookFor('melter', 'onFight').keywords, []);
  });

  it('rejects a trailing param token to unresolvedMarkers', () => {
    assert.deepStrictEqual(hookFor('extra-tokens', 'onFight').effects, []);
    assert.deepStrictEqual(hookFor('extra-tokens', 'onFight').unresolvedMarkers, [
      'ko-cullable-each-deck-top:1',
    ]);
  });
});

describe('buildVillainAbilityHooks — swap-two-city-villains grammar (WP-523 / D-24336)', () => {
  const registry = makeRegistry(
    'co2e',
    [
      {
        slug: 'masters-of-evil',
        cards: [
          {
            slug: 'whirlwind',
            abilities: ['Ambush: Two Villains in the city swap spaces. [effect:swap-two-city-villains]'],
          },
          // why: a no-param primitive rejects any trailing colon token (guards a malformed
          // marker from collapsing to the param-less descriptor).
          { slug: 'extra-tokens', abilities: ['Ambush: nope. [effect:swap-two-city-villains:1]'] },
        ],
      },
    ],
    [],
  );
  const hooks = buildVillainAbilityHooks(registry, makeConfig(['co2e/masters-of-evil'], []));
  const hookFor = (slug: string, timing: string) =>
    hooks.find((h) => h.cardId === `co2e-villain-masters-of-evil-${slug}-00` && h.timing === timing)!;

  it('parses the no-param Ambush marker to a bare descriptor via the generic branch', () => {
    assert.deepStrictEqual(hookFor('whirlwind', 'onAmbush').effects, [
      { primitive: 'swap-two-city-villains' },
    ]);
    // why: keyword-less — must NOT reverse-map to a legacy keyword.
    assert.deepStrictEqual(hookFor('whirlwind', 'onAmbush').keywords, []);
  });

  it('rejects a trailing param token to unresolvedMarkers', () => {
    assert.deepStrictEqual(hookFor('extra-tokens', 'onAmbush').effects, []);
    assert.deepStrictEqual(hookFor('extra-tokens', 'onAmbush').unresolvedMarkers, [
      'swap-two-city-villains:1',
    ]);
  });
});

describe('buildVillainAbilityHooks — give-hq-hero-each-player grammar (WP-532 / D-24343)', () => {
  const registry = makeRegistry(
    'core',
    [
      {
        slug: 'skrulls',
        cards: [
          {
            slug: 'paibok-the-power-skrull',
            abilities: [
              'Fight: Choose a Hero in the HQ for each player. Each player gains that Hero. [effect:give-hq-hero-each-player]',
            ],
          },
          // why: a no-param primitive rejects any trailing colon token (guards a malformed
          // marker from collapsing to the param-less descriptor).
          { slug: 'extra-tokens', abilities: ['Fight: nope. [effect:give-hq-hero-each-player:1]'] },
        ],
      },
    ],
    [],
  );
  const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/skrulls'], []));
  const hookFor = (slug: string, timing: string) =>
    hooks.find((h) => h.cardId === `core-villain-skrulls-${slug}-00` && h.timing === timing)!;

  it('parses the no-param Fight marker to a bare descriptor via the generic branch', () => {
    assert.deepStrictEqual(hookFor('paibok-the-power-skrull', 'onFight').effects, [
      { primitive: 'give-hq-hero-each-player' },
    ]);
    // why: keyword-less — must NOT reverse-map to a legacy keyword.
    assert.deepStrictEqual(hookFor('paibok-the-power-skrull', 'onFight').keywords, []);
  });

  it('rejects a trailing param token to unresolvedMarkers', () => {
    assert.deepStrictEqual(hookFor('extra-tokens', 'onFight').effects, []);
    assert.deepStrictEqual(hookFor('extra-tokens', 'onFight').unresolvedMarkers, [
      'give-hq-hero-each-player:1',
    ]);
  });
});

describe('buildVillainAbilityHooks — gain-recruit-current + gain-officer-current grammar (WP-541 / D-24350)', () => {
  const registry = makeRegistry(
    'core',
    [
      {
        slug: 'hydra',
        cards: [
          {
            slug: 'hydra-kidnappers',
            abilities: ['Fight: You may gain a S.H.I.E.L.D. Officer. [effect:gain-officer-current]'],
          },
          // why: a no-param primitive rejects any trailing colon token.
          { slug: 'officer-extra', abilities: ['Fight: nope. [effect:gain-officer-current:1]'] },
        ],
      },
    ],
    [
      { slug: 'hand-ninjas', abilities: ['Fight: You get +1[icon:recruit]. [effect:gain-recruit-current:1]'] },
      // why: the bare token (no :N) defaults to magnitude 1 in the parser.
      { slug: 'hand-ninjas-bare', abilities: ['Fight: You get +1 recruit. [effect:gain-recruit-current]'] },
      // why: a non-positive-integer count is rejected to unresolvedMarkers.
      { slug: 'hand-ninjas-bad', abilities: ['Fight: nope. [effect:gain-recruit-current:x]'] },
      // why: WP-543 — Savage Land Mutates is now marked ADDITIVELY as add-next-hand-size:1
      // ("draw an extra card"), NOT the absolute override-next-hand-size:7 it carried under
      // WP-541 — so two defeats in one turn stack to +2. The marker value is the whole point.
      {
        slug: 'savage-land-mutates',
        abilities: [
          'Fight: When you draw a new hand of cards at the end of this turn, draw an extra card. [effect:add-next-hand-size:1]',
        ],
      },
      // why: a non-positive-integer add-next-hand-size count is rejected to unresolvedMarkers.
      { slug: 'savage-bad', abilities: ['Fight: nope. [effect:add-next-hand-size:x]'] },
    ],
  );
  const hooks = buildVillainAbilityHooks(
    registry,
    makeConfig(
      ['core/hydra'],
      ['core/hand-ninjas', 'core/hand-ninjas-bare', 'core/hand-ninjas-bad', 'core/savage-land-mutates', 'core/savage-bad'],
    ),
  );
  const villainHook = (slug: string) =>
    hooks.find((h) => h.cardId === `core-villain-hydra-${slug}-00` && h.timing === 'onFight')!;
  const henchHook = (slug: string) =>
    hooks.find((h) => h.cardId === `henchman-${slug}-00` && h.timing === 'onFight')!;

  it('parses gain-officer-current (no-param) to a bare descriptor via the generic branch', () => {
    assert.deepStrictEqual(villainHook('hydra-kidnappers').effects, [{ primitive: 'gain-officer-current' }]);
    // why: keyword-less — must NOT reverse-map to a legacy keyword.
    assert.deepStrictEqual(villainHook('hydra-kidnappers').keywords, []);
  });

  it('rejects a trailing param on gain-officer-current to unresolvedMarkers', () => {
    assert.deepStrictEqual(villainHook('officer-extra').effects, []);
    assert.deepStrictEqual(villainHook('officer-extra').unresolvedMarkers, ['gain-officer-current:1']);
  });

  it('parses gain-recruit-current:1 to a magnitude-1 descriptor', () => {
    assert.deepStrictEqual(henchHook('hand-ninjas').effects, [
      { primitive: 'gain-recruit-current', magnitude: 1 },
    ]);
    assert.deepStrictEqual(henchHook('hand-ninjas').keywords, []);
  });

  it('parses the bare gain-recruit-current to the default magnitude 1', () => {
    assert.deepStrictEqual(henchHook('hand-ninjas-bare').effects, [
      { primitive: 'gain-recruit-current', magnitude: 1 },
    ]);
  });

  it('rejects a non-positive-integer gain-recruit-current count to unresolvedMarkers', () => {
    assert.deepStrictEqual(henchHook('hand-ninjas-bad').effects, []);
    assert.deepStrictEqual(henchHook('hand-ninjas-bad').unresolvedMarkers, ['gain-recruit-current:x']);
  });

  it('Savage Land Mutates parses add-next-hand-size:1 (additive +1, WP-543), not the absolute override', () => {
    assert.deepStrictEqual(henchHook('savage-land-mutates').effects, [
      { primitive: 'add-next-hand-size', magnitude: 1 },
    ]);
    assert.deepStrictEqual(henchHook('savage-land-mutates').keywords, []);
  });

  it('rejects a non-positive-integer add-next-hand-size count to unresolvedMarkers', () => {
    assert.deepStrictEqual(henchHook('savage-bad').effects, []);
    assert.deepStrictEqual(henchHook('savage-bad').unresolvedMarkers, ['add-next-hand-size:x']);
  });
});

describe('buildVillainAbilityHooks — play-villain-deck-cards grammar (WP-542 / D-24351)', () => {
  const registry = makeRegistry(
    'core',
    [
      {
        slug: 'hydra',
        cards: [
          // why: Endless Armies of HYDRA — "Fight: Play the top two cards of the Villain Deck."
          {
            slug: 'endless-armies-of-hydra',
            abilities: ['Fight: Play the top two cards of the Villain Deck. [effect:play-villain-deck-cards:2]'],
          },
        ],
      },
      {
        slug: 'radiation',
        cards: [
          // why: The Leader — "Ambush: Play the top card of the Villain Deck."
          {
            slug: 'the-leader',
            abilities: ['Ambush: Play the top card of the Villain Deck. [effect:play-villain-deck-cards:1]'],
          },
          // why: the count is required — a no-param play-villain-deck-cards is malformed.
          { slug: 'leader-noparam', abilities: ['Ambush: nope. [effect:play-villain-deck-cards]'] },
          // why: a non-positive-integer count is rejected to unresolvedMarkers.
          { slug: 'leader-bad', abilities: ['Ambush: nope. [effect:play-villain-deck-cards:x]'] },
        ],
      },
    ],
    [],
  );
  const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/hydra', 'core/radiation'], []));
  const villainHook = (slug: string, timing: 'onAmbush' | 'onFight') =>
    hooks.find((h) => h.cardId === `core-villain-radiation-${slug}-00` && h.timing === timing)!;

  it('parses Endless Armies of HYDRA Fight to play-villain-deck-cards:2', () => {
    const hook = hooks.find(
      (h) => h.cardId === 'core-villain-hydra-endless-armies-of-hydra-00' && h.timing === 'onFight',
    )!;
    assert.deepStrictEqual(hook.effects, [{ primitive: 'play-villain-deck-cards', magnitude: 2 }]);
    // why: keyword-less — must NOT reverse-map to a legacy keyword.
    assert.deepStrictEqual(hook.keywords, []);
  });

  it('parses The Leader Ambush to play-villain-deck-cards:1', () => {
    assert.deepStrictEqual(villainHook('the-leader', 'onAmbush').effects, [
      { primitive: 'play-villain-deck-cards', magnitude: 1 },
    ]);
    assert.deepStrictEqual(villainHook('the-leader', 'onAmbush').keywords, []);
  });

  it('rejects a no-param play-villain-deck-cards to unresolvedMarkers (count required)', () => {
    assert.deepStrictEqual(villainHook('leader-noparam', 'onAmbush').effects, []);
    assert.deepStrictEqual(villainHook('leader-noparam', 'onAmbush').unresolvedMarkers, [
      'play-villain-deck-cards',
    ]);
  });

  it('rejects a non-positive-integer play-villain-deck-cards count to unresolvedMarkers', () => {
    assert.deepStrictEqual(villainHook('leader-bad', 'onAmbush').effects, []);
    assert.deepStrictEqual(villainHook('leader-bad', 'onAmbush').unresolvedMarkers, [
      'play-villain-deck-cards:x',
    ]);
  });
});

describe('buildVillainAbilityHooks — keywords/effects parity', () => {
  it('keywords and effects are distinct but parallel arrays (WP-252)', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'skrulls',
          cards: [
            {
              slug: 'super-skrull',
              abilities: ['Ambush: This captures a Bystander. [effect:captureBystander]'],
            },
          ],
        },
      ],
      [{ slug: 'doombot-legion', abilities: ['Fight: Reveal the top card.'] }],
    );
    const hooks = buildVillainAbilityHooks(
      registry,
      makeConfig(['core/skrulls'], ['core/doombot-legion']),
    );
    assert.ok(hooks.length > 0);
    for (const hook of hooks) {
      // why: WP-252 retyped effects to descriptors — keywords (legacy strings)
      // and effects (descriptors) are now DISTINCT array references, but
      // parallel: each effect is the descriptor translation of its keyword.
      assert.notEqual(hook.keywords, hook.effects, 'distinct array references');
      assert.equal(hook.keywords.length, hook.effects.length, 'parallel length');
      for (let keywordIndex = 0; keywordIndex < hook.keywords.length; keywordIndex++) {
        assert.deepStrictEqual(
          hook.effects[keywordIndex],
          LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR[hook.keywords[keywordIndex]!],
          'each effect is the descriptor translation of its keyword',
        );
      }
    }
  });
});

describe('buildVillainAbilityHooks — henchman group-level fan-out', () => {
  const registry = makeRegistry(
    'core',
    [],
    [{ slug: 'doombot-legion', abilities: ['Fight: KO one of your Heroes. [effect:koHeroCurrentPlayer]'] }],
  );
  const hooks = buildVillainAbilityHooks(registry, makeConfig([], ['core/doombot-legion']));

  it('emits one onFight hook per virtual copy ext_id (00-09)', () => {
    const henchHooks = hooks.filter((h) => h.cardId.startsWith('henchman-doombot-legion-'));
    assert.equal(henchHooks.length, 10, '10 henchman copies → 10 hooks');
    for (let copyIndex = 0; copyIndex < 10; copyIndex++) {
      const paddedIndex = String(copyIndex).padStart(2, '0');
      const match = henchHooks.find(
        (h) => h.cardId === `henchman-doombot-legion-${paddedIndex}`,
      );
      assert.ok(match, `hook for henchman-doombot-legion-${paddedIndex} must exist`);
      assert.equal(match!.timing, 'onFight');
      assert.deepStrictEqual(match!.keywords, ['koHeroCurrentPlayer']);
    }
  });

  it('does not alias the effects array across copies (D-13502)', () => {
    const henchHooks = hooks.filter((h) => h.cardId.startsWith('henchman-doombot-legion-'));
    assert.notEqual(
      henchHooks[0]!.effects,
      henchHooks[1]!.effects,
      'each copy must own a freshly-constructed effects array',
    );
  });
});

describe('buildVillainAbilityHooks — henchman onAmbush deferral (D-18507)', () => {
  it('emits no hook for a henchman Ambush: line', () => {
    // why: spider-infected (ssw2) is a real henchman whose Ambush line carries
    // [effect:captureBystander], but buildCardKeywords never tags henchmen, so a
    // henchman onAmbush hook would be unreachable — it must not be emitted.
    const registry = makeRegistry(
      'core',
      [],
      [
        {
          slug: 'spider-infected',
          abilities: ['Ambush: This captures a Bystander. [effect:captureBystander]'],
        },
      ],
    );
    const hooks = buildVillainAbilityHooks(
      registry,
      makeConfig([], ['core/spider-infected']),
    );
    const henchHooks = hooks.filter((h) => h.cardId.startsWith('henchman-spider-infected-'));
    assert.equal(henchHooks.length, 0, 'henchman Ambush lines yield zero hooks in v1');
  });
});

describe('buildVillainAbilityHooks — deterministic emission order', () => {
  const registry = makeRegistry(
    'core',
    [
      {
        slug: 'hood',
        cards: [
          {
            slug: 'the-hood',
            abilities: [
              'Ambush: Put the top Hero Deck card into the Escape Pile. [effect:heroDeckTopToEscape]',
              'Fight: Each player gains a Wound.',
            ],
          },
        ],
      },
      {
        slug: 'skrulls',
        cards: [
          {
            slug: 'super-skrull',
            abilities: ['Fight: KO one of your Heroes. [effect:koHeroCurrentPlayer]'],
          },
        ],
      },
    ],
    [{ slug: 'doombot-legion', abilities: ['Fight: Reveal the top card.'] }],
  );
  const config = makeConfig(['core/hood', 'core/skrulls'], ['core/doombot-legion']);

  it('produces JSON-identical output across two builds', () => {
    const first = buildVillainAbilityHooks(registry, config);
    const second = buildVillainAbilityHooks(registry, config);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
  });

  it('orders hooks by cardId lexical, then timing, then ability-line index', () => {
    const hooks = buildVillainAbilityHooks(registry, config);
    for (let i = 1; i < hooks.length; i++) {
      const prev = hooks[i - 1]!;
      const cur = hooks[i]!;
      if (prev.cardId !== cur.cardId) {
        assert.ok(prev.cardId < cur.cardId, `cardId order violated at index ${i}`);
        continue;
      }
      const prevRank = VILLAIN_ABILITY_TIMINGS.indexOf(prev.timing);
      const curRank = VILLAIN_ABILITY_TIMINGS.indexOf(cur.timing);
      assert.ok(prevRank <= curRank, `timing order violated at index ${i}`);
    }
  });
});

describe('buildVillainAbilityHooks — gate-consistency with buildCardKeywords', () => {
  it('every onAmbush hook satisfies hasAmbush(cardId, cardKeywords)', () => {
    // why: standard-cased "Ambush:" villains only — both detectors (the parser's
    // case-insensitive prefix and buildCardKeywords' case-sensitive
    // startsWith('Ambush')) agree on real data, so the gate cannot drop a
    // compiled onAmbush hook (reachability / gate-drift guard).
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'skrulls',
          cards: [
            {
              slug: 'super-skrull',
              abilities: ['Ambush: This captures a Bystander. [effect:captureBystander]'],
            },
            {
              slug: 'skrull-soldier',
              abilities: ['Fight: KO one of your Heroes. [effect:koHeroCurrentPlayer]'],
            },
          ],
        },
        {
          slug: 'hood',
          cards: [
            {
              slug: 'the-hood',
              abilities: [
                'Ambush: Put the top Hero Deck card into the Escape Pile. [effect:heroDeckTopToEscape]',
              ],
            },
          ],
        },
      ],
      [{ slug: 'doombot-legion', abilities: ['Fight: KO one of your Heroes. [effect:koHeroCurrentPlayer]'] }],
    );
    const config = makeConfig(['core/skrulls', 'core/hood'], ['core/doombot-legion']);

    const hooks = buildVillainAbilityHooks(registry, config);
    const cardKeywords = buildCardKeywords(registry, config);

    const ambushHooks = hooks.filter((h) => h.timing === 'onAmbush');
    assert.ok(ambushHooks.length >= 2, 'fixture must produce onAmbush hooks to exercise the guard');
    for (const hook of ambushHooks) {
      assert.equal(
        hasAmbush(hook.cardId as CardExtId, cardKeywords),
        true,
        `onAmbush hook for ${hook.cardId} must satisfy hasAmbush (gate-consistency)`,
      );
    }
  });
});

describe('buildVillainAbilityHooks — Escape: / Overrun: prefix detection (WP-186)', () => {
  it('detects Escape: case-insensitively with leading whitespace trimmed (villain per-card)', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'variants',
          cards: [
            {
              slug: 'caps',
              abilities: ['ESCAPE: each player loses a wound [effect:gainWoundEachPlayer]'],
            },
            {
              slug: 'spaced',
              abilities: ['   Escape: bar [effect:gainWoundCurrentPlayer]'],
            },
            {
              slug: 'emdash',
              abilities: ['Escape — no colon here'],
            },
            {
              slug: 'spacedcolon',
              abilities: ['Escape : spaced colon'],
            },
          ],
        },
      ],
      [],
    );
    const config = makeConfig(['core/variants'], []);
    const hooks = buildVillainAbilityHooks(registry, config);

    // why: WP-191 — villain hooks key by the -00 copy instance (no `copies` field).
    const byCard = (slug: string) =>
      hooks.filter((h) => h.cardId === `core-villain-variants-${slug}-00`);

    assert.equal(byCard('caps').length, 1, 'ESCAPE: matches case-insensitively');
    assert.equal(byCard('caps')[0]!.timing, 'onEscape');
    assert.deepStrictEqual(byCard('caps')[0]!.keywords, ['gainWoundEachPlayer']);
    assert.equal(byCard('spaced').length, 1, 'leading whitespace is trimmed');
    assert.equal(byCard('spaced')[0]!.timing, 'onEscape');
    assert.deepStrictEqual(byCard('spaced')[0]!.keywords, ['gainWoundCurrentPlayer']);
    assert.equal(byCard('emdash').length, 0, 'em-dash variant is not matched');
    assert.equal(byCard('spacedcolon').length, 0, 'spaced-colon variant is not matched');
  });

  it('detects Overrun: as a v1 synonym of Escape: (D-18602 — both emit onEscape)', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'siege',
          cards: [
            {
              slug: 'overrun-card',
              abilities: ['Overrun: Each player gains a Wound. [effect:gainWoundEachPlayer]'],
            },
            {
              slug: 'overrun-caps',
              abilities: ['OVERRUN: bar [effect:gainWoundCurrentPlayer]'],
            },
          ],
        },
      ],
      [],
    );
    const config = makeConfig(['core/siege'], []);
    const hooks = buildVillainAbilityHooks(registry, config);

    const overrunHook = hooks.find(
      (h) => h.cardId === 'core-villain-siege-overrun-card-00',
    );
    assert.ok(overrunHook, 'Overrun: line yields a hook');
    assert.equal(
      overrunHook!.timing,
      'onEscape',
      "Overrun: emits onEscape — 'onOverrun' is not a timing in v1 (D-18602)",
    );
    assert.deepStrictEqual(overrunHook!.keywords, ['gainWoundEachPlayer']);

    const overrunCapsHook = hooks.find(
      (h) => h.cardId === 'core-villain-siege-overrun-caps-00',
    );
    assert.ok(overrunCapsHook, 'OVERRUN: matches case-insensitively');
    assert.equal(overrunCapsHook!.timing, 'onEscape');
  });

  it('emits an onEscape hook with empty effects when the matched line carries no [effect:] marker (safe-skip)', () => {
    // why: real escape lines outside the MVP vocabulary (e.g. the each-player-KO
    // pattern; D-18802) are left marker-free by WP-188 and must still produce
    // a hook with effects:[] — the executor then no-ops. This proves the
    // prefix-detection-only contract: timing is set from the prefix, effects
    // come only from [effect:] markers.
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'mix',
          cards: [
            {
              slug: 'unmarked',
              abilities: ['Escape: Each player KOs a Hero from their hand.'],
            },
            {
              slug: 'unmarked-overrun',
              abilities: ['Overrun: Each player KOs a Hero from their hand.'],
            },
          ],
        },
      ],
      [],
    );
    const config = makeConfig(['core/mix'], []);
    const hooks = buildVillainAbilityHooks(registry, config);

    const unmarked = hooks.find(
      (h) => h.cardId === 'core-villain-mix-unmarked-00',
    );
    assert.ok(unmarked, 'a matched Escape: line yields a hook even with no marker');
    assert.equal(unmarked!.timing, 'onEscape');
    assert.deepStrictEqual(unmarked!.effects, [], 'effects:[] when marker absent');

    const unmarkedOverrun = hooks.find(
      (h) => h.cardId === 'core-villain-mix-unmarked-overrun-00',
    );
    assert.ok(unmarkedOverrun, 'a matched Overrun: line yields a hook even with no marker');
    assert.equal(unmarkedOverrun!.timing, 'onEscape');
    assert.deepStrictEqual(unmarkedOverrun!.effects, []);
  });

  it("does not emit a hook with timing 'onOverrun' (synonym lock — D-18602)", () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'siege',
          cards: [
            {
              slug: 'overrun-card',
              abilities: ['Overrun: Each player gains a Wound. [effect:gainWoundEachPlayer]'],
            },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(
      registry,
      makeConfig(['core/siege'], []),
    );
    for (const hook of hooks) {
      assert.notEqual(
        hook.timing as string,
        'onOverrun',
        "'onOverrun' must never appear as a hook timing (Overrun: collapses to onEscape at parse time)",
      );
    }
  });

  it('does not emit henchman onEscape hooks in v1 (D-18507-class filter mirror)', () => {
    // why: the henchman filter excludes every timing except onFight (the
    // executor-side rationale is identical to the D-18507 onAmbush deferral —
    // no real henchman in v1 data carries an [effect:]-marked Escape: line,
    // and the keyword-detection asymmetry would make emission unreachable).
    // The reveal-site fire still calls executeVillainAbilities on a henchman
    // escape; it safely no-ops via per-card hook lookup. This test pins the
    // emission boundary so a future WP that adds henchman onEscape coverage
    // updates both the parser AND this test together.
    const registry = makeRegistry(
      'core',
      [],
      [
        {
          slug: 'hand-ninjas',
          abilities: ['Escape: Each player gains a Wound. [effect:gainWoundEachPlayer]'],
        },
        {
          slug: 'doombot-legion',
          abilities: ['Overrun: KO one of your Heroes. [effect:koHeroCurrentPlayer]'],
        },
      ],
    );
    const hooks = buildVillainAbilityHooks(
      registry,
      makeConfig([], ['core/hand-ninjas', 'core/doombot-legion']),
    );
    const henchHooks = hooks.filter((h) =>
      h.cardId.startsWith('henchman-'),
    );
    assert.equal(
      henchHooks.length,
      0,
      'henchman Escape:/Overrun: lines yield zero hooks in v1',
    );
  });
});

describe('buildVillainAbilityHooks — villain per-copy fan-out (WP-191)', () => {
  it('emits one hook per (copy instance × matched ability line) keyed by the copy-indexed id', () => {
    // why: WP-191 / D-18704 — a villain card with copies:2 must produce hooks
    // under both -00 and -01 instance ids (matching the zone-instance grammar
    // the Fight fire site passes), exactly as henchmen already fan out. Before
    // this WP villains keyed the single definition id and never resolved.
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'brotherhood',
          cards: [
            {
              slug: 'magneto',
              copies: 2,
              abilities: ['Fight: KO one of your Heroes. [effect:koHeroCurrentPlayer]'],
            },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/brotherhood'], []));

    const magnetoHooks = hooks.filter((h) =>
      h.cardId.startsWith('core-villain-brotherhood-magneto-'),
    );
    assert.equal(magnetoHooks.length, 2, 'copies:2 must yield 2 villain hook instances');
    for (let copyIndex = 0; copyIndex < 2; copyIndex++) {
      const paddedIndex = String(copyIndex).padStart(2, '0');
      const match = magnetoHooks.find(
        (h) => h.cardId === `core-villain-brotherhood-magneto-${paddedIndex}`,
      );
      assert.ok(match, `hook for core-villain-brotherhood-magneto-${paddedIndex} must exist`);
      assert.equal(match!.timing, 'onFight');
      assert.deepStrictEqual(match!.keywords, ['koHeroCurrentPlayer']);
    }

    // why: copies must not alias a shared effects array (D-13502).
    assert.notEqual(
      magnetoHooks[0]!.effects,
      magnetoHooks[1]!.effects,
      'each copy must own a freshly-constructed effects array',
    );
  });
});

describe('buildVillainAbilityHooks — dual-grammar equivalence (WP-252 / D-24023)', () => {
  // why: the parser accepts BOTH the legacy keyword marker and the equivalent
  // parameterized marker; they must yield the SAME descriptor so a future
  // magnitude (e.g. ko-hero:each:3) is purely data-only — no new keyword, no
  // code change. No real card uses the parameterized grammar yet; this proves
  // the seam, not a card-data change.
  it('[effect:koHeroEachPlayerMag2] and [effect:ko-hero:each:2] yield the same descriptor', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'grammar',
          cards: [
            { slug: 'legacy', abilities: ['Fight: KO two Heroes. [effect:koHeroEachPlayerMag2]'] },
            { slug: 'param', abilities: ['Fight: KO two Heroes. [effect:ko-hero:each:2]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/grammar'], []));
    const effectsFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-grammar-${slug}-00`)!.effects;
    const expected = [{ primitive: 'ko-hero', target: 'each', magnitude: 2 }];
    assert.deepStrictEqual(effectsFor('legacy'), expected, 'legacy keyword → descriptor');
    assert.deepStrictEqual(effectsFor('param'), expected, 'parameterized token → same descriptor');
    assert.deepStrictEqual(
      effectsFor('legacy'),
      effectsFor('param'),
      'both grammars must produce byte-identical descriptors',
    );
  });

  it('a parameterized-only token carries no legacy keyword', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'grammar2',
          cards: [{ slug: 'param', abilities: ['Fight: x [effect:ko-hero:each:2]'] }],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/grammar2'], []));
    const paramHook = hooks.find((h) => h.cardId === 'core-villain-grammar2-param-00');
    assert.ok(paramHook, 'parameterized marker still yields a hook');
    // why: a parameterized token has no legacy keyword — keywords[] is empty
    // while effects[] carries the descriptor (the executor's reverse-map then
    // yields undefined for it, so it is not recorded in appliedEffects; WP-253
    // adds descriptor-keyed narrative labels).
    assert.deepStrictEqual(paramHook!.keywords, [], 'no legacy keyword for a parameterized token');
    assert.deepStrictEqual(paramHook!.effects, [
      { primitive: 'ko-hero', target: 'each', magnitude: 2 },
    ]);
  });

  it('[effect:scry-ko-own-deck] parses as a no-param descriptor; a trailing token is rejected (WP-447 / D-24267)', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'scry',
          cards: [
            { slug: 'ok', abilities: ['Fight: Look at the top two. [effect:scry-ko-own-deck]'] },
            { slug: 'bad', abilities: ['Fight: Look at the top two. [effect:scry-ko-own-deck:2]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/scry'], []));
    const okHook = hooks.find((h) => h.cardId === 'core-villain-scry-ok-00');
    const badHook = hooks.find((h) => h.cardId === 'core-villain-scry-bad-00');
    // why: AC-2 — the no-param token yields { primitive: 'scry-ko-own-deck' } via
    // the parser's generic no-param branch (no legacy keyword, no unresolved marker).
    assert.deepStrictEqual(okHook!.effects, [{ primitive: 'scry-ko-own-deck' }]);
    assert.deepStrictEqual(okHook!.keywords, [], 'scry-ko-own-deck is not a legacy keyword');
    assert.equal(okHook!.unresolvedMarkers, undefined, 'a valid no-param descriptor is not unresolved');
    // why: AC-2 — a trailing colon token is rejected (parts.length > 1 for a
    // no-param primitive → null), so it surfaces as an unresolved marker, not a
    // silently-collapsed descriptor.
    assert.deepStrictEqual(badHook!.effects, [], 'the malformed token yields no descriptor');
    assert.deepStrictEqual(badHook!.unresolvedMarkers, ['scry-ko-own-deck:2']);
  });

  it('[effect:gain-attached-hero] parses as a no-param descriptor; a trailing token is rejected (WP-450 / D-24270)', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'gah',
          cards: [
            { slug: 'ok', abilities: ['Fight: Gain that Hero. [effect:gain-attached-hero]'] },
            { slug: 'bad', abilities: ['Fight: Gain that Hero. [effect:gain-attached-hero:x]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/gah'], []));
    const okHook = hooks.find((h) => h.cardId === 'core-villain-gah-ok-00');
    const badHook = hooks.find((h) => h.cardId === 'core-villain-gah-bad-00');
    // why: AC-2 — the no-param token yields { primitive: 'gain-attached-hero' }.
    assert.deepStrictEqual(okHook!.effects, [{ primitive: 'gain-attached-hero' }]);
    assert.deepStrictEqual(okHook!.keywords, [], 'gain-attached-hero is not a legacy keyword');
    assert.equal(okHook!.unresolvedMarkers, undefined, 'a valid no-param descriptor is not unresolved');
    // why: AC-2 — a trailing colon token is rejected → surfaces as an unresolved
    // marker, not a silently-collapsed descriptor.
    assert.deepStrictEqual(badHook!.effects, [], 'the malformed token yields no descriptor');
    assert.deepStrictEqual(badHook!.unresolvedMarkers, ['gain-attached-hero:x']);
  });

  it('[effect:ko-hero:each:N:zone] parses a zone-restricted each KO; bad zone / 5-token rejected (WP-463 / D-24280)', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'zk',
          cards: [
            { slug: 'disc', abilities: ['Ambush: Each player KOs two Heroes from their discard pile. [effect:ko-hero:each:2:discard]'] },
            { slug: 'hand', abilities: ['Escape: Each player KOs two Heroes from their hand. [effect:ko-hero:each:2:hand]'] },
            { slug: 'badzone', abilities: ['Ambush: x [effect:ko-hero:each:2:inPlay]'] },
            { slug: 'toolong', abilities: ['Ambush: x [effect:ko-hero:each:2:discard:x]'] },
            { slug: 'plain', abilities: ['Ambush: x [effect:ko-hero:each:2]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/zk'], []));
    const effectsFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-zk-${slug}-00`)!.effects;
    const unresolvedFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-zk-${slug}-00`)!.unresolvedMarkers;
    // why: AC-1 — the 4-token form yields a zone-bearing descriptor.
    assert.deepStrictEqual(effectsFor('disc'), [
      { primitive: 'ko-hero', target: 'each', magnitude: 2, zone: 'discard' },
    ]);
    assert.deepStrictEqual(effectsFor('hand'), [
      { primitive: 'ko-hero', target: 'each', magnitude: 2, zone: 'hand' },
    ]);
    // why: AC-1 — 'inPlay' is not an admissible zone, and a 5th token is rejected;
    // both fall through to unresolved (not a silently-collapsed descriptor).
    assert.deepStrictEqual(effectsFor('badzone'), []);
    assert.deepStrictEqual(unresolvedFor('badzone'), ['ko-hero:each:2:inPlay']);
    assert.deepStrictEqual(effectsFor('toolong'), []);
    assert.deepStrictEqual(unresolvedFor('toolong'), ['ko-hero:each:2:discard:x']);
    // why: AC-1 — the 3-token zone-less form is unchanged (no zone field).
    assert.deepStrictEqual(effectsFor('plain'), [
      { primitive: 'ko-hero', target: 'each', magnitude: 2 },
    ]);
  });

  it('[effect:reveal-or-wound:<kind>:<value>] parses + normalizes; bad kind / wrong-token-count / empty value rejected (WP-469 / D-24281)', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'row',
          cards: [
            { slug: 'team', abilities: ['Fight: Each player reveals an X-Men Hero or gains a Wound. [effect:reveal-or-wound:team:x-men]'] },
            { slug: 'hc', abilities: ['Fight: Each player reveals a Ranged Hero or gains a Wound. [effect:reveal-or-wound:hc:ranged]'] },
            { slug: 'norm', abilities: ['Fight: x [effect:reveal-or-wound:team:X-Men]'] },
            { slug: 'badkind', abilities: ['Fight: x [effect:reveal-or-wound:bogus:x]'] },
            { slug: 'twotoken', abilities: ['Fight: x [effect:reveal-or-wound:team]'] },
            { slug: 'emptyval', abilities: ['Fight: x [effect:reveal-or-wound:hc:]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/row'], []));
    const effectsFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-row-${slug}-00`)!.effects;
    const unresolvedFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-row-${slug}-00`)!.unresolvedMarkers;
    // why: AC-2 — the 3-token form yields the predicate descriptor; `hc` maps to
    // the engine kind `hero-class`; `team` stays `team`.
    assert.deepStrictEqual(effectsFor('team'), [
      { primitive: 'reveal-or-wound', requireKind: 'team', requireValue: 'x-men' },
    ]);
    assert.deepStrictEqual(effectsFor('hc'), [
      { primitive: 'reveal-or-wound', requireKind: 'hero-class', requireValue: 'ranged' },
    ]);
    // why: AC-2 — requireValue is normalized to the cardTraits slug space
    // (normalizeTraitSlug lowercases), so 'X-Men' → 'x-men'.
    assert.deepStrictEqual(effectsFor('norm'), [
      { primitive: 'reveal-or-wound', requireKind: 'team', requireValue: 'x-men' },
    ]);
    // why: AC-2 — a parameterized token carries no legacy keyword.
    assert.deepStrictEqual(
      hooks.find((h) => h.cardId === 'core-villain-row-team-00')!.keywords,
      [],
    );
    // why: AC-2 — a bad kind, a 2-token form, and an empty value all fall through
    // to null → surfaced as unresolved markers, never a silently-collapsed descriptor.
    assert.deepStrictEqual(effectsFor('badkind'), []);
    assert.deepStrictEqual(unresolvedFor('badkind'), ['reveal-or-wound:bogus:x']);
    assert.deepStrictEqual(effectsFor('twotoken'), []);
    assert.deepStrictEqual(unresolvedFor('twotoken'), ['reveal-or-wound:team']);
    assert.deepStrictEqual(effectsFor('emptyval'), []);
    assert.deepStrictEqual(unresolvedFor('emptyval'), ['reveal-or-wound:hc:']);
  });
});

describe('buildVillainAbilityHooks — override-next-hand-size grammar (WP-503 / D-24307)', () => {
  it('[effect:override-next-hand-size:<N>] parses a positive integer into magnitude; non-positive / wrong-token-count rejected', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'ohs',
          cards: [
            { slug: 'eight', abilities: ['Fight: draw eight instead of six. [effect:override-next-hand-size:8]'] },
            { slug: 'zero', abilities: ['Fight: x [effect:override-next-hand-size:0]'] },
            { slug: 'noarg', abilities: ['Fight: x [effect:override-next-hand-size]'] },
            { slug: 'nan', abilities: ['Fight: x [effect:override-next-hand-size:eight]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/ohs'], []));
    const effectsFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-ohs-${slug}-00`)!.effects;
    const unresolvedFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-ohs-${slug}-00`)!.unresolvedMarkers;
    assert.deepStrictEqual(effectsFor('eight'), [
      { primitive: 'override-next-hand-size', magnitude: 8 },
    ]);
    // why: the token carries no legacy keyword (keyword-less, self-narrates).
    assert.deepStrictEqual(
      hooks.find((h) => h.cardId === 'core-villain-ohs-eight-00')!.keywords,
      [],
    );
    // why: 0 is not a positive integer; a param-less form and a non-numeric form
    // both fall through to null → surfaced as unresolved, never a silent descriptor.
    assert.deepStrictEqual(effectsFor('zero'), []);
    assert.deepStrictEqual(unresolvedFor('zero'), ['override-next-hand-size:0']);
    assert.deepStrictEqual(effectsFor('noarg'), []);
    assert.deepStrictEqual(unresolvedFor('noarg'), ['override-next-hand-size']);
    assert.deepStrictEqual(effectsFor('nan'), []);
    assert.deepStrictEqual(unresolvedFor('nan'), ['override-next-hand-size:eight']);
  });
});

describe('buildVillainAbilityHooks — Tier-A auto-resolve grammars (WP-485 / D-24290)', () => {
  it('[effect:draw-cards-current:<N>] parses a positive integer; non-positive / wrong-token-count rejected', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'draw',
          cards: [
            { slug: 'three', abilities: ['Fight: Draw three cards. [effect:draw-cards-current:3]'] },
            { slug: 'zero', abilities: ['Fight: x [effect:draw-cards-current:0]'] },
            { slug: 'noarg', abilities: ['Fight: x [effect:draw-cards-current]'] },
            { slug: 'nan', abilities: ['Fight: x [effect:draw-cards-current:two]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/draw'], []));
    const effectsFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-draw-${slug}-00`)!.effects;
    const unresolvedFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-draw-${slug}-00`)!.unresolvedMarkers;
    assert.deepStrictEqual(effectsFor('three'), [
      { primitive: 'draw-cards-current', drawCount: 3 },
    ]);
    // why: the token carries no legacy keyword.
    assert.deepStrictEqual(
      hooks.find((h) => h.cardId === 'core-villain-draw-three-00')!.keywords,
      [],
    );
    // why: 0 is not a positive integer; a param-less form and a non-numeric form
    // both fall through to null → surfaced as unresolved, never a silent descriptor.
    assert.deepStrictEqual(effectsFor('zero'), []);
    assert.deepStrictEqual(unresolvedFor('zero'), ['draw-cards-current:0']);
    assert.deepStrictEqual(effectsFor('noarg'), []);
    assert.deepStrictEqual(unresolvedFor('noarg'), ['draw-cards-current']);
    assert.deepStrictEqual(effectsFor('nan'), []);
    assert.deepStrictEqual(unresolvedFor('nan'), ['draw-cards-current:two']);
  });

  it('[effect:ko-heroes-current-by-trait:<kind>:<value>] parses + normalizes; bad kind / empty value rejected', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'kot',
          cards: [
            { slug: 'team', abilities: ['Fight: KO all your [team:shield] Heroes. [effect:ko-heroes-current-by-trait:team:shield]'] },
            { slug: 'hc', abilities: ['Fight: x [effect:ko-heroes-current-by-trait:hc:Tech]'] },
            { slug: 'badkind', abilities: ['Fight: x [effect:ko-heroes-current-by-trait:bogus:x]'] },
            { slug: 'emptyval', abilities: ['Fight: x [effect:ko-heroes-current-by-trait:team:]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/kot'], []));
    const effectsFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-kot-${slug}-00`)!.effects;
    const unresolvedFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-kot-${slug}-00`)!.unresolvedMarkers;
    assert.deepStrictEqual(effectsFor('team'), [
      { primitive: 'ko-heroes-current-by-trait', requireKind: 'team', requireValue: 'shield' },
    ]);
    // why: `hc` maps to hero-class; the value normalizes ('Tech' → 'tech').
    assert.deepStrictEqual(effectsFor('hc'), [
      { primitive: 'ko-heroes-current-by-trait', requireKind: 'hero-class', requireValue: 'tech' },
    ]);
    assert.deepStrictEqual(effectsFor('badkind'), []);
    assert.deepStrictEqual(unresolvedFor('badkind'), ['ko-heroes-current-by-trait:bogus:x']);
    assert.deepStrictEqual(effectsFor('emptyval'), []);
    assert.deepStrictEqual(unresolvedFor('emptyval'), ['ko-heroes-current-by-trait:team:']);
  });

  it('[effect:ko-heroes-current-count-by-trait:<kind>:<value>] parses + normalizes; malformed rejected', () => {
    // why: D-24353 — core radiation Maestro. Same shared trait-predicate grammar as its
    // `ko-heroes-current-by-trait` sibling, but the predicate sizes the COUNT, not the KO
    // filter — the two primitives must stay separately parsed (a drift trap by name).
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'maestro',
          cards: [
            { slug: 'strength', abilities: ['Fight: For each of your [hc:strength] Heroes, KO one of your Heroes. [effect:ko-heroes-current-count-by-trait:hc:strength]'] },
            { slug: 'team', abilities: ['Fight: x [effect:ko-heroes-current-count-by-trait:team:Avengers]'] },
            { slug: 'badkind', abilities: ['Fight: x [effect:ko-heroes-current-count-by-trait:bogus:x]'] },
            { slug: 'emptyval', abilities: ['Fight: x [effect:ko-heroes-current-count-by-trait:hc:]'] },
            { slug: 'twotoken', abilities: ['Fight: x [effect:ko-heroes-current-count-by-trait:hc]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/maestro'], []));
    const effectsFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-maestro-${slug}-00`)!.effects;
    const unresolvedFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-maestro-${slug}-00`)!.unresolvedMarkers;
    assert.deepStrictEqual(effectsFor('strength'), [
      { primitive: 'ko-heroes-current-count-by-trait', requireKind: 'hero-class', requireValue: 'strength' },
    ]);
    // why: `team` is equally valid grammar; the value normalizes ('Avengers' → 'avengers').
    assert.deepStrictEqual(effectsFor('team'), [
      { primitive: 'ko-heroes-current-count-by-trait', requireKind: 'team', requireValue: 'avengers' },
    ]);
    assert.deepStrictEqual(effectsFor('badkind'), []);
    assert.deepStrictEqual(unresolvedFor('badkind'), ['ko-heroes-current-count-by-trait:bogus:x']);
    assert.deepStrictEqual(effectsFor('emptyval'), []);
    assert.deepStrictEqual(unresolvedFor('emptyval'), ['ko-heroes-current-count-by-trait:hc:']);
    assert.deepStrictEqual(effectsFor('twotoken'), []);
    assert.deepStrictEqual(unresolvedFor('twotoken'), ['ko-heroes-current-count-by-trait:hc']);
  });

  it('[effect:rescue-bystanders-current-by-trait-count:<kind>:<value>] parses + normalizes; malformed rejected', () => {
    const registry = makeRegistry(
      'core',
      [
        {
          slug: 'zemo',
          cards: [
            { slug: 'avengers', abilities: ['Fight: For each of your [team:avengers] Heroes, rescue a Bystander. [effect:rescue-bystanders-current-by-trait-count:team:avengers]'] },
            { slug: 'twotoken', abilities: ['Fight: x [effect:rescue-bystanders-current-by-trait-count:team]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/zemo'], []));
    const effectsFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-zemo-${slug}-00`)!.effects;
    const unresolvedFor = (slug: string) =>
      hooks.find((h) => h.cardId === `core-villain-zemo-${slug}-00`)!.unresolvedMarkers;
    assert.deepStrictEqual(effectsFor('avengers'), [
      {
        primitive: 'rescue-bystanders-current-by-trait-count',
        requireKind: 'team',
        requireValue: 'avengers',
      },
    ]);
    assert.deepStrictEqual(effectsFor('twotoken'), []);
    assert.deepStrictEqual(unresolvedFor('twotoken'), [
      'rescue-bystanders-current-by-trait-count:team',
    ]);
  });

  it('[effect:capture-bystanders-plus-per-hq-hero-by-trait:<kind>:<value>] parses + normalizes; malformed rejected (WP-521 / D-24334)', () => {
    const registry = makeRegistry(
      'co2e',
      [
        {
          slug: 'masters-of-evil',
          cards: [
            { slug: 'baron-zemo', abilities: ['Ambush: Baron Zemo captures a Bystander. Then he captures another Bystander for each [team:avengers] Hero in the HQ. [effect:capture-bystanders-plus-per-hq-hero-by-trait:team:avengers]'] },
            { slug: 'twotoken', abilities: ['Ambush: x [effect:capture-bystanders-plus-per-hq-hero-by-trait:team]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['co2e/masters-of-evil'], []));
    const effectsFor = (slug: string) =>
      hooks.find((h) => h.cardId === `co2e-villain-masters-of-evil-${slug}-00` && h.timing === 'onAmbush')!.effects;
    const unresolvedFor = (slug: string) =>
      hooks.find((h) => h.cardId === `co2e-villain-masters-of-evil-${slug}-00` && h.timing === 'onAmbush')!.unresolvedMarkers;
    assert.deepStrictEqual(effectsFor('baron-zemo'), [
      {
        primitive: 'capture-bystanders-plus-per-hq-hero-by-trait',
        requireKind: 'team',
        requireValue: 'avengers',
      },
    ]);
    // why: keyword-less — must NOT reverse-map to a legacy keyword.
    assert.deepStrictEqual(
      hooks.find((h) => h.cardId === 'co2e-villain-masters-of-evil-baron-zemo-00' && h.timing === 'onAmbush')!.keywords,
      [],
    );
    assert.deepStrictEqual(effectsFor('twotoken'), []);
    assert.deepStrictEqual(unresolvedFor('twotoken'), [
      'capture-bystanders-plus-per-hq-hero-by-trait:team',
    ]);
  });

  it('[effect:give-hq-hero-by-trait-to-current:<kind>:<value>] parses + normalizes; malformed rejected (WP-522 / D-24335)', () => {
    const registry = makeRegistry(
      'co2e',
      [
        {
          slug: 'masters-of-evil',
          cards: [
            { slug: 'ultron', abilities: ['Fight: Choose a [hc:tech] Hero from the HQ. Either KO that Hero or choose a player to gain it. [effect:give-hq-hero-by-trait-to-current:hc:tech]'] },
            { slug: 'twotoken', abilities: ['Fight: x [effect:give-hq-hero-by-trait-to-current:hc]'] },
          ],
        },
      ],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['co2e/masters-of-evil'], []));
    const effectsFor = (slug: string) =>
      hooks.find((h) => h.cardId === `co2e-villain-masters-of-evil-${slug}-00` && h.timing === 'onFight')!.effects;
    const unresolvedFor = (slug: string) =>
      hooks.find((h) => h.cardId === `co2e-villain-masters-of-evil-${slug}-00` && h.timing === 'onFight')!.unresolvedMarkers;
    // why: `hc` maps to the engine kind `hero-class`; the value normalizes to the
    // cardTraits slug space (already lowercase here).
    assert.deepStrictEqual(effectsFor('ultron'), [
      {
        primitive: 'give-hq-hero-by-trait-to-current',
        requireKind: 'hero-class',
        requireValue: 'tech',
      },
    ]);
    // why: keyword-less — must NOT reverse-map to a legacy keyword.
    assert.deepStrictEqual(
      hooks.find((h) => h.cardId === 'co2e-villain-masters-of-evil-ultron-00' && h.timing === 'onFight')!.keywords,
      [],
    );
    // why: a 2-token tail (missing the value) is malformed → surfaced as an unresolved marker.
    assert.deepStrictEqual(effectsFor('twotoken'), []);
    assert.deepStrictEqual(unresolvedFor('twotoken'), [
      'give-hq-hero-by-trait-to-current:hc',
    ]);
  });
});

// ---------------------------------------------------------------------------
// WP-257 — unresolved-marker surfacing (D-24034)
//
// An `[effect:X]` token that resolves to neither a legacy keyword nor a valid
// parameterized descriptor is surfaced on hook.unresolvedMarkers so the runtime
// hollow detector can flag `parse-unrecognized`. A line whose markers all
// resolve surfaces an absent field.
// ---------------------------------------------------------------------------

describe('buildVillainAbilityHooks — unresolved markers (WP-257)', () => {
  /** Builds a single villain group with one card carrying one ability line. */
  function buildSingleAbility(abilityText: string) {
    const registry = makeRegistry(
      'core',
      [{ slug: 'grammar3', cards: [{ slug: 'v', abilities: [abilityText] }] }],
      [],
    );
    const hooks = buildVillainAbilityHooks(registry, makeConfig(['core/grammar3'], []));
    return hooks.find((h) => h.cardId === 'core-villain-grammar3-v-00');
  }

  it('surfaces an unresolved [effect:X] token on hook.unresolvedMarkers', () => {
    const hook = buildSingleAbility('Ambush: [effect:made-up-ability]');
    assert.ok(hook, 'a hook is still emitted for the timing line');
    assert.deepStrictEqual(hook!.unresolvedMarkers, ['made-up-ability']);
    assert.deepStrictEqual(hook!.effects, [], 'no descriptor for an unresolved marker');
  });

  it('a recognized legacy effect marker surfaces NO unresolvedMarkers', () => {
    const hook = buildSingleAbility('Fight: [effect:gainWoundCurrentPlayer]');
    assert.ok(hook);
    assert.equal(hook!.unresolvedMarkers, undefined, 'a recognized marker is not unresolved');
  });

  it('a recognized parameterized marker surfaces NO unresolvedMarkers', () => {
    const hook = buildSingleAbility('Fight: [effect:ko-hero:each:2]');
    assert.ok(hook);
    assert.equal(hook!.unresolvedMarkers, undefined, 'a valid descriptor is not unresolved');
  });

  it('a flavor-text line with no [effect:] marker surfaces NO unresolvedMarkers', () => {
    const hook = buildSingleAbility('Ambush: The villain glares menacingly.');
    assert.ok(hook);
    assert.equal(hook!.unresolvedMarkers, undefined, 'flavor text carries no marker token');
  });
});
