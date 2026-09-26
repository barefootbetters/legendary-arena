import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import DayNightBadge from './DayNightBadge.vue';
import { dayNightAriaText, dayNightTooltip, type DayNightState } from '../../vfx/dayNightDisplay';

describe('DayNightBadge (WP-766 / D-24598)', () => {
  const STATES: DayNightState[] = ['sunlight', 'moonlight', 'neither'];
  const LABELS: Record<DayNightState, string> = {
    sunlight: 'Sunlight',
    moonlight: 'Moonlight',
    neither: 'Neither',
  };

  test('renders the locked label, title, aria-label, data-state and role for each state', () => {
    for (const state of STATES) {
      const wrapper = mount(DayNightBadge, { props: { state } });
      const badge = wrapper.find('[data-testid="play-day-night-badge"]');
      assert.ok(badge.exists(), `${state}: the badge renders`);
      assert.equal(badge.attributes('data-state'), state);
      assert.equal(badge.attributes('role'), 'status');
      assert.equal(badge.attributes('title'), dayNightTooltip(state));
      assert.equal(badge.attributes('aria-label'), dayNightAriaText(state));
      assert.equal(wrapper.find('[data-testid="play-day-night-label"]').text(), LABELS[state],
        `${state}: the word is always shown, never colour alone`);
    }
  });

  test('Sunlight and Moonlight render their inline SVG icon; Neither renders none', () => {
    const sun = mount(DayNightBadge, { props: { state: 'sunlight' } });
    const sunIcon = sun.find('[data-testid="play-day-night-icon-sun"]');
    assert.ok(sunIcon.exists());
    assert.equal(sunIcon.element.tagName.toLowerCase(), 'svg');
    assert.equal(sunIcon.attributes('stroke'), 'currentColor');
    assert.equal(sunIcon.attributes('aria-hidden'), 'true');
    assert.equal(sunIcon.attributes('focusable'), 'false');
    assert.equal(sun.find('[data-testid="play-day-night-icon-moon"]').exists(), false);

    const moon = mount(DayNightBadge, { props: { state: 'moonlight' } });
    const moonIcon = moon.find('[data-testid="play-day-night-icon-moon"]');
    assert.ok(moonIcon.exists());
    assert.equal(moonIcon.element.tagName.toLowerCase(), 'svg');
    assert.equal(moonIcon.attributes('aria-hidden'), 'true');
    assert.equal(moonIcon.attributes('focusable'), 'false');

    const neither = mount(DayNightBadge, { props: { state: 'neither' } });
    assert.equal(neither.find('svg').exists(), false, 'Neither shows no icon');
  });

  test('uses no Unicode sun / moon glyphs', () => {
    for (const state of STATES) {
      // why: a glyph icon would be rendered text; the badge's only text is its word.
      const text = mount(DayNightBadge, { props: { state } }).text();
      assert.equal(text, LABELS[state], `${state}: the only text is the word`);
      assert.ok(!/[☀-➿]|\uD83C[\uDF00-\uDFFF]/u.test(text), `${state}: no dingbat or emoji codepoint`);
    }
  });
});
