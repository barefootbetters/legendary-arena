// why: jsdom globals must be installed before Vue's mount() is called.
import '../testing/jsdom-setup';

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount, enableAutoUnmount } from '@vue/test-utils';

import UpdateAvailableBanner from './UpdateAvailableBanner.vue';

/**
 * Tests for the WP-418 update-available banner. It renders only when
 * `updateAvailable`, invokes the injected `refresh` (page reload) from its
 * button, and is dismissible. Mirrors the ConnectionStatusBanner / BotAllyStallBanner
 * prop-drilled-action pattern (the reload site is owned by the play-root host).
 */

enableAutoUnmount(afterEach);

test('renders nothing until an update is available', () => {
  const wrapper = mount(UpdateAvailableBanner, {
    props: { updateAvailable: false, refresh: () => {} },
  });
  assert.equal(wrapper.find('[data-testid="update-available-banner"]').exists(), false);
});

test('renders the notice + a Refresh action when an update is available', () => {
  const wrapper = mount(UpdateAvailableBanner, {
    props: { updateAvailable: true, refresh: () => {} },
  });
  const banner = wrapper.find('[data-testid="update-available-banner"]');
  assert.equal(banner.exists(), true, 'the banner is shown');
  assert.equal(banner.attributes('role'), 'status', 'a11y: role="status"');
  assert.ok(banner.text().includes('A new version is available.'), 'carries text (not colour-only)');
  assert.equal(wrapper.find('[data-testid="update-refresh-button"]').exists(), true);
});

test('the Refresh button invokes the injected reload action', async () => {
  let refreshed = 0;
  const wrapper = mount(UpdateAvailableBanner, {
    props: { updateAvailable: true, refresh: () => (refreshed += 1) },
  });
  await wrapper.find('[data-testid="update-refresh-button"]').trigger('click');
  assert.equal(refreshed, 1, 'clicking Refresh calls refresh() exactly once');
});

test('the dismiss control hides the banner without reloading', async () => {
  let refreshed = 0;
  const wrapper = mount(UpdateAvailableBanner, {
    props: { updateAvailable: true, refresh: () => (refreshed += 1) },
  });
  assert.equal(wrapper.find('[data-testid="update-available-banner"]').exists(), true);

  await wrapper.find('[data-testid="update-dismiss-button"]').trigger('click');
  assert.equal(wrapper.find('[data-testid="update-available-banner"]').exists(), false, 'dismissed');
  assert.equal(refreshed, 0, 'dismiss never reloads');
});
