import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAbilityMarkers,
  isEngineOnlyKeyword,
  abilityTokenDisplay,
  abilityTokenLabel,
  abilityTokenIconUrl,
  heroClassIconUrl,
  resourceIconUrl,
  teamIconSlug,
  teamIconUrl,
} from './abilityMarkers';

describe('parseAbilityMarkers', () => {
  test('plain text with no markers yields a single text token', () => {
    const tokens = parseAbilityMarkers('Always Leads: Enemies of Asgard');
    assert.deepEqual(tokens, [
      { type: 'text', value: 'Always Leads: Enemies of Asgard' },
    ]);
  });

  test('splits a hero-class marker out of surrounding text', () => {
    const tokens = parseAbilityMarkers(
      'Each player reveals a [hc:strength] Hero or gains a Wound.',
    );
    assert.deepEqual(tokens, [
      { type: 'text', value: 'Each player reveals a ' },
      { type: 'hc', value: 'strength' },
      { type: 'text', value: ' Hero or gains a Wound.' },
    ]);
  });

  test('parses an icon marker adjacent to a number (no whitespace)', () => {
    const tokens = parseAbilityMarkers('Each Villain gets +1[icon:attack].');
    assert.deepEqual(tokens, [
      { type: 'text', value: 'Each Villain gets +1' },
      { type: 'icon', value: 'attack' },
      { type: 'text', value: '.' },
    ]);
  });

  test('parses multiple mixed markers in one line', () => {
    const tokens = parseAbilityMarkers(
      '[keyword:Patrol]: get +1[icon:recruit] per [team:X-Men].',
    );
    assert.deepEqual(tokens, [
      { type: 'keyword', value: 'Patrol' },
      { type: 'text', value: ': get +1' },
      { type: 'icon', value: 'recruit' },
      { type: 'text', value: ' per ' },
      { type: 'team', value: 'X-Men' },
      { type: 'text', value: '.' },
    ]);
  });

  // D-24496 — engine-only appended keyword markers must never reach the player.
  test('drops an appended [keyword:smash:N] engine token, keeping the display keyword', () => {
    // Hurl Trucks ships each Smash line as "[keyword:Smash 2] [keyword:smash:2]".
    const tokens = parseAbilityMarkers('[keyword:Smash 2] [keyword:smash:2]');
    assert.deepEqual(tokens, [{ type: 'keyword', value: 'Smash 2' }]);
  });

  test('drops an appended [keyword:draw:N] engine token, keeping the sentence', () => {
    const tokens = parseAbilityMarkers('[keyword:Outwit]: Draw a card. [keyword:draw:1]');
    assert.deepEqual(tokens, [
      { type: 'keyword', value: 'Outwit' },
      { type: 'text', value: ': Draw a card.' },
    ]);
  });

  test('drops hyphenated-slug engine tokens (recruit-threshold, optional-ko-hand-discard)', () => {
    const tokens = parseAbilityMarkers(
      'Once this turn, if you made at least 6[icon:recruit]this turn, you may KO a card from your hand or discard pile. [keyword:recruit-threshold:6] [keyword:optional-ko-hand-discard]',
    );
    assert.deepEqual(tokens, [
      { type: 'text', value: 'Once this turn, if you made at least 6' },
      { type: 'icon', value: 'recruit' },
      { type: 'text', value: 'this turn, you may KO a card from your hand or discard pile.' },
    ]);
  });

  test('keeps lowercase DISPLAY verbs (charges / feasts / demolish) — not engine tokens', () => {
    const tokens = parseAbilityMarkers('This Villain [keyword:charges] and [keyword:feasts].');
    assert.deepEqual(tokens, [
      { type: 'text', value: 'This Villain ' },
      { type: 'keyword', value: 'charges' },
      { type: 'text', value: ' and ' },
      { type: 'keyword', value: 'feasts' },
      { type: 'text', value: '.' },
    ]);
  });
});

describe('isEngineOnlyKeyword (D-24496)', () => {
  test('colon-segment tokens are engine-only', () => {
    for (const value of ['smash:2', 'draw:1', 'recruit-threshold:6', 'attack-per-count:worthy-cards-played-this-turn:1', 'optional-ko-reward:rescue:1']) {
      assert.equal(isEngineOnlyKeyword(value), true, value);
    }
  });

  test('lowercase hyphenated slugs and bare "reveal" are engine-only', () => {
    for (const value of ['copy-powers', 'gain-wound-each', 'optional-ko-hand-discard', 'defeat-with-bystander', 'reveal']) {
      assert.equal(isEngineOnlyKeyword(value), true, value);
    }
  });

  test('Title-Case display keywords and lowercase display verbs are kept', () => {
    for (const value of ['Smash 2', 'Outwit', 'Worthy', 'Transform', 'Wall-Crawl', 'charges', 'feasts', 'fortifies', 'demolish']) {
      assert.equal(isEngineOnlyKeyword(value), false, value);
    }
  });
});

describe('abilityTokenDisplay', () => {
  test('icon markers render as their glyph', () => {
    assert.equal(abilityTokenDisplay({ type: 'icon', value: 'attack' }), '⚔');
    assert.equal(abilityTokenDisplay({ type: 'icon', value: 'recruit' }), '★');
  });

  test('hero-class markers render as their label word', () => {
    assert.equal(abilityTokenDisplay({ type: 'hc', value: 'strength' }), 'Strength');
    assert.equal(abilityTokenDisplay({ type: 'hc', value: 'tech' }), 'Tech');
  });

  test('unknown icon / hc values fall back to the raw value (no data loss)', () => {
    assert.equal(abilityTokenDisplay({ type: 'icon', value: 'mystery' }), 'mystery');
    assert.equal(abilityTokenDisplay({ type: 'hc', value: 'psionic' }), 'psionic');
  });

  test('text / keyword / rule / team render verbatim', () => {
    assert.equal(abilityTokenDisplay({ type: 'text', value: 'reveal a' }), 'reveal a');
    assert.equal(abilityTokenDisplay({ type: 'keyword', value: 'Patrol' }), 'Patrol');
    assert.equal(abilityTokenDisplay({ type: 'team', value: 'X-Men' }), 'X-Men');
  });
});

describe('abilityTokenLabel', () => {
  test('hero-class label is the word, never a glyph', () => {
    assert.equal(abilityTokenLabel({ type: 'hc', value: 'strength' }), 'Strength');
  });

  test('icon label is the name, not the glyph (used as img alt text)', () => {
    assert.equal(abilityTokenLabel({ type: 'icon', value: 'attack' }), 'attack');
  });
});

describe('icon URL builders', () => {
  test('hero-class icon URL', () => {
    assert.equal(
      heroClassIconUrl('strength'),
      'https://images.legendary-arena.com/icons/hero-classes/class-strength.svg',
    );
  });

  test('resource icon URL', () => {
    assert.equal(
      resourceIconUrl('attack'),
      'https://images.legendary-arena.com/icons/card-info/info-attack.svg',
    );
  });

  test('team slug lower-cases and collapses whitespace to hyphens', () => {
    assert.equal(teamIconSlug('X-Men'), 'x-men');
    assert.equal(teamIconSlug('Guardians of the Galaxy'), 'guardians-of-the-galaxy');
  });

  test('team icon URL uses the slug', () => {
    assert.equal(
      teamIconUrl('X-Men'),
      'https://images.legendary-arena.com/icons/hero-teams/team-x-men.svg',
    );
  });
});

describe('abilityTokenIconUrl', () => {
  test('known hero-class and resource markers resolve to their SVG', () => {
    assert.equal(
      abilityTokenIconUrl({ type: 'hc', value: 'strength' }),
      'https://images.legendary-arena.com/icons/hero-classes/class-strength.svg',
    );
    assert.equal(
      abilityTokenIconUrl({ type: 'icon', value: 'attack' }),
      'https://images.legendary-arena.com/icons/card-info/info-attack.svg',
    );
  });

  test('team markers always attempt the icon (open set)', () => {
    assert.equal(
      abilityTokenIconUrl({ type: 'team', value: 'Avengers' }),
      'https://images.legendary-arena.com/icons/hero-teams/team-avengers.svg',
    );
  });

  test('unknown hc / icon values and non-icon tokens resolve to null (text fallback)', () => {
    assert.equal(abilityTokenIconUrl({ type: 'hc', value: 'psionic' }), null);
    assert.equal(abilityTokenIconUrl({ type: 'icon', value: 'mystery' }), null);
    assert.equal(abilityTokenIconUrl({ type: 'keyword', value: 'Patrol' }), null);
    assert.equal(abilityTokenIconUrl({ type: 'text', value: 'reveal a' }), null);
  });
});
