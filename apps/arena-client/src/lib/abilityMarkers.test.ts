import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAbilityMarkers,
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
