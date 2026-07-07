import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCardName,
  abilityTextToPlainText,
  formatCardRef,
  formatPlayedCardLabel,
} from './logDisplay';
import type { UICardDisplay } from '../ui/uiState.types';

/**
 * A minimal cardDisplayData snapshot for the helper tests. Only the fields the
 * helpers read (`name`, `abilityText`) are load-bearing; the rest satisfy the
 * `UICardDisplay` shape.
 */
function display(
  extId: string,
  name: string,
  abilityText?: string,
): UICardDisplay {
  return {
    extId,
    name,
    imageUrl: `https://images.legendary-arena.com/${extId}.webp`,
    cost: null,
    ...(abilityText === undefined ? {} : { abilityText }),
  };
}

test('resolveCardName returns the display name when the entry exists', () => {
  const data = { 'core/x': display('core/x', 'Interstellar Adventures') };
  assert.equal(resolveCardName(data, 'core/x'), 'Interstellar Adventures');
});

test('resolveCardName falls back to the raw ext-id when the entry is absent', () => {
  assert.equal(resolveCardName({}, 'core/missing'), 'core/missing');
  assert.equal(resolveCardName(undefined, 'core/missing'), 'core/missing');
});

test('abilityTextToPlainText converts icon markup and keeps a space before the word', () => {
  assert.equal(
    abilityTextToPlainText('[keyword:What If...?]: You get +3[icon:recruit].'),
    'What If...?: You get +3 recruit.',
  );
});

test('abilityTextToPlainText title-cases hero-class tokens and spaces hyphens', () => {
  assert.equal(
    abilityTextToPlainText('[hc:strength]: Draw a card.'),
    'Strength: Draw a card.',
  );
  assert.equal(
    abilityTextToPlainText('[keyword:victory-villain-attack] You get attack.'),
    'victory villain attack You get attack.',
  );
});

test('abilityTextToPlainText collapses newlines so the ability stays one line', () => {
  assert.equal(
    abilityTextToPlainText('Choose one: A.\n[hc:strength][hc:covert]: Draw a card.'),
    'Choose one: A. Strength Covert: Draw a card.',
  );
});

test('abilityTextToPlainText returns an empty string for empty or undefined input', () => {
  assert.equal(abilityTextToPlainText(undefined), '');
  assert.equal(abilityTextToPlainText(''), '');
});

test('formatPlayedCardLabel omits the effect clause for a card with no ability text', () => {
  const data = { 'starting-shield-agent': display('starting-shield-agent', 'S.H.I.E.L.D. Agent') };
  assert.equal(
    formatPlayedCardLabel(data, 'starting-shield-agent'),
    'S.H.I.E.L.D. Agent (starting-shield-agent)',
  );
});

test('formatPlayedCardLabel appends the plain-text effect for a card with ability text', () => {
  const extId = 'wtif/star-lord-tchalla/interstellar-adventures#0';
  const data = {
    [extId]: display(extId, 'Interstellar Adventures', '[keyword:What If...?]: You get +3[icon:recruit].'),
  };
  assert.equal(
    formatPlayedCardLabel(data, extId),
    'Interstellar Adventures (wtif/star-lord-tchalla/interstellar-adventures#0) — What If...?: You get +3 recruit.',
  );
});

test('formatPlayedCardLabel falls back to the ext-id (no effect) when the entry is absent', () => {
  assert.equal(
    formatPlayedCardLabel({}, 'core/missing#0'),
    'core/missing#0 (core/missing#0)',
  );
});

test('formatCardRef renders {Name} ({ext-id}) with no effect clause', () => {
  const extId = 'core-villain-skrulls-super-skrull-00';
  const data = { [extId]: display(extId, 'Super-Skrull') };
  assert.equal(formatCardRef(data, extId), 'Super-Skrull (core-villain-skrulls-super-skrull-00)');
});

test('formatCardRef omits the effect even when the card has ability text (non-play line)', () => {
  const extId = 'wtif/star-lord-tchalla/interstellar-adventures#0';
  const data = {
    [extId]: display(extId, 'Interstellar Adventures', '[keyword:What If...?]: You get +3[icon:recruit].'),
  };
  assert.equal(formatCardRef(data, extId), 'Interstellar Adventures (wtif/star-lord-tchalla/interstellar-adventures#0)');
});

test('formatCardRef falls back to the raw ext-id when the entry is absent', () => {
  assert.equal(formatCardRef({}, 'henchman-sentinel-06'), 'henchman-sentinel-06 (henchman-sentinel-06)');
});
