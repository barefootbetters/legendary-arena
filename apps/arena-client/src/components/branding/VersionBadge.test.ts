// why: jsdom globals (and the Vite build-time constants) must be installed
// before Vue's mount() is called.
import '../../testing/jsdom-setup';

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount, enableAutoUnmount } from '@vue/test-utils';

import VersionBadge from './VersionBadge.vue';

/**
 * The footer build stamp shows the version and when the build went out; the
 * short git sha is kept off the visible text and in the tooltip only.
 * jsdom-setup stamps `__APP_VERSION__ = '0.0.0-test'` and `__GIT_SHA__ = 'test'`.
 */

enableAutoUnmount(afterEach);

test('shows the version and an "Updated" date and time', () => {
  const wrapper = mount(VersionBadge);
  const badge = wrapper.find('[data-testid="version-badge"]');
  assert.ok(badge.text().includes('v0.0.0-test'));
  assert.ok(badge.text().includes('Updated'));
  assert.equal(badge.find('time').attributes('datetime'), new Date(__BUILD_TIMESTAMP__).toISOString());
});

test('keeps the git sha in the tooltip, not the visible text', () => {
  const wrapper = mount(VersionBadge);
  const badge = wrapper.find('[data-testid="version-badge"]');
  assert.ok(badge.attributes('title')?.startsWith('Build test'));
  assert.equal(badge.text().includes('· test'), false);
});
