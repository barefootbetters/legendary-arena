import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { dayNightAriaText, dayNightLabel, dayNightTooltip } from './dayNightDisplay';

describe('dayNightDisplay (WP-766 / D-24598)', () => {
  test('labels each state with its word', () => {
    assert.equal(dayNightLabel('sunlight'), 'Sunlight');
    assert.equal(dayNightLabel('moonlight'), 'Moonlight');
    assert.equal(dayNightLabel('neither'), 'Neither');
  });

  test('tooltips state the locked rule text', () => {
    assert.equal(dayNightTooltip('sunlight'), 'Sunlight: most HQ Heroes have even printed costs.');
    assert.equal(dayNightTooltip('moonlight'), 'Moonlight: most HQ Heroes have odd printed costs.');
    assert.equal(
      dayNightTooltip('neither'),
      'Sunlight and Moonlight are both off: the HQ has as many odd-cost as even-cost Heroes.',
    );
  });

  test('aria text is the tooltip, with the word prefixed only for Neither', () => {
    assert.equal(dayNightAriaText('sunlight'), 'Sunlight: most HQ Heroes have even printed costs.');
    assert.equal(dayNightAriaText('moonlight'), 'Moonlight: most HQ Heroes have odd printed costs.');
    assert.equal(
      dayNightAriaText('neither'),
      'Neither. Sunlight and Moonlight are both off: the HQ has as many odd-cost as even-cost Heroes.',
    );
  });
});
