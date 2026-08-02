import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAbilityMarkers, abilityTokenDisplay } from './abilityMarkers';

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
