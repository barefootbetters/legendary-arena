import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCardName,
  abilityTextToPlainText,
  isEngineEffectMarker,
  formatBaseEconomyClause,
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
});

// why: WP-417 / D-24237 — the pipeline's apply-effect-markers pass appends a
// machine-readable marker to the printed line; before this it was humanized into
// the player-facing log ("Draw a card. draw:1."). These pin the drop.
test('abilityTextToPlainText drops engine effect markers from the printed text', () => {
  assert.equal(
    abilityTextToPlainText('Draw a card. [keyword:draw:1]'),
    'Draw a card.',
  );
  assert.equal(
    abilityTextToPlainText('[hc:instinct]: Draw a card. [keyword:draw:1]'),
    'Instinct: Draw a card.',
  );
  assert.equal(
    abilityTextToPlainText(
      'You get +1[icon:attack] for each Bystander in your Victory Pile. [keyword:attack-per-count:victory-bystanders:1]',
    ),
    'You get +1 attack for each Bystander in your Victory Pile.',
  );
  assert.equal(
    abilityTextToPlainText('[keyword:victory-villain-attack] You get attack.'),
    'You get attack.',
  );
});

test('abilityTextToPlainText keeps printed Title-Case keywords', () => {
  assert.equal(
    abilityTextToPlainText('[keyword:Undercover]: Send a card face-down. [keyword:undercover]'),
    'Undercover: Send a card face-down.',
  );
  assert.equal(
    abilityTextToPlainText('[keyword:Danger Sense 2]: Draw a card.'),
    'Danger Sense 2: Draw a card.',
  );
});

test('isEngineEffectMarker splits machine markers from printed keywords', () => {
  assert.equal(isEngineEffectMarker('draw:1'), true);
  assert.equal(isEngineEffectMarker('ko-wound-reward:attack:2'), true);
  assert.equal(isEngineEffectMarker('reveal'), true);
  // why: markers for mechanics that are not HeroKeyword members yet must also drop —
  // the shape test covers them where a keyword allowlist would not.
  assert.equal(isEngineEffectMarker('reveal-multi-take'), true);
  assert.equal(isEngineEffectMarker('Undercover'), false);
  assert.equal(isEngineEffectMarker('What If...?'), false);
  assert.equal(isEngineEffectMarker('Danger Sense 2'), false);
  assert.equal(isEngineEffectMarker('Artifact -'), false);
});

test('formatBaseEconomyClause renders only the icons the card actually prints', () => {
  assert.equal(formatBaseEconomyClause(0, 1), '+1 recruit');
  assert.equal(formatBaseEconomyClause(1, 0), '+1 attack');
  assert.equal(formatBaseEconomyClause(2, 3), '+2 attack, +3 recruit');
  assert.equal(formatBaseEconomyClause(0, 0), '');
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
    formatPlayedCardLabel(data, 'starting-shield-agent', ''),
    'S.H.I.E.L.D. Agent (starting-shield-agent)',
  );
});

// why: WP-417 / D-24237 — a starter's printed icons ARE its whole effect, so the
// play line must carry them; without this a S.H.I.E.L.D. Agent play said nothing
// about the +1 recruit it just added.
test('formatPlayedCardLabel carries the printed-icon clause for a starter', () => {
  const data = { 'starting-shield-agent': display('starting-shield-agent', 'S.H.I.E.L.D. Agent') };
  assert.equal(
    formatPlayedCardLabel(data, 'starting-shield-agent', '+1 recruit'),
    'S.H.I.E.L.D. Agent (starting-shield-agent) (+1 recruit)',
  );
});

test('formatPlayedCardLabel appends the plain-text effect for a card with ability text', () => {
  const extId = 'wtif/star-lord-tchalla/interstellar-adventures#0';
  const data = {
    [extId]: display(extId, 'Interstellar Adventures', '[keyword:What If...?]: You get +3[icon:recruit].'),
  };
  assert.equal(
    formatPlayedCardLabel(data, extId, ''),
    // why: WP-417 — the trailing period is dropped; the play-line caller supplies it.
    'Interstellar Adventures (wtif/star-lord-tchalla/interstellar-adventures#0) — What If...?: You get +3 recruit',
  );
});

test('formatPlayedCardLabel places the icon clause before the effect clause', () => {
  const extId = 'core/hawkeye/quick-draw#3';
  const data = { [extId]: display(extId, 'Quick Draw', 'Draw a card. [keyword:draw:1]') };
  assert.equal(
    formatPlayedCardLabel(data, extId, '+2 attack'),
    'Quick Draw (core/hawkeye/quick-draw#3) (+2 attack) — Draw a card',
  );
});

test('formatPlayedCardLabel falls back to the ext-id (no effect) when the entry is absent', () => {
  assert.equal(
    formatPlayedCardLabel({}, 'core/missing#0', ''),
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
