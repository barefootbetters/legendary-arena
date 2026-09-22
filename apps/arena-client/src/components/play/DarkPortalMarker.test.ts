import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import DarkPortalMarker from './DarkPortalMarker.vue';

const MARKER = '[data-testid="dark-portal-marker"]';

describe('DarkPortalMarker (WP-727 / D-24548)', () => {
  test('renders the passed attack bonus, not a hardcoded 1', () => {
    // why: the +N must be prop-driven so a future multi-stack Dark-Portal buff
    // renders faithfully — a hardcoded "1" would silently misreport it.
    const wrapper = mount(DarkPortalMarker, { props: { attackBonus: 2 } });
    const marker = wrapper.find(MARKER);
    assert.ok(marker.exists(), 'the marker element renders');
    assert.match(marker.text(), /\+2/, 'shows +2 for a bonus of 2');
    assert.match(marker.text().toLowerCase(), /attack/, 'labels the bonus as attack');
  });

  test('renders +1 for the standard single Dark Portal', () => {
    const wrapper = mount(DarkPortalMarker, { props: { attackBonus: 1 } });
    assert.match(wrapper.find(MARKER).text(), /\+1/, 'shows +1 for a bonus of 1');
  });

  test('exposes the bonus on an accessible label', () => {
    const wrapper = mount(DarkPortalMarker, { props: { attackBonus: 1 } });
    assert.equal(
      wrapper.find(MARKER).attributes('aria-label'),
      'Dark Portal: +1 attack',
      'the aria-label names the portal and its bonus',
    );
  });
});
