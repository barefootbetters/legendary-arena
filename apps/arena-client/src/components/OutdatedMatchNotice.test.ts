// why: jsdom globals must be installed before Vue's mount() is called.
import '../testing/jsdom-setup';

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount, enableAutoUnmount } from '@vue/test-utils';

import OutdatedMatchNotice from './OutdatedMatchNotice.vue';

/**
 * Tests for the older-rules notice: it renders only for a match created before
 * the running server booted, names both times when known, sends the player to a
 * new match through the injected action, and is dismissible.
 */

enableAutoUnmount(afterEach);

const MATCH_CREATED = '2026-10-29T13:51:46.000Z';
const SERVER_BOOTED = '2026-10-29T13:57:10.000Z';

test('renders nothing for a match that is not older than the server', () => {
  const wrapper = mount(OutdatedMatchNotice, {
    props: { isMatchOlderThanServer: false, startNewMatch: () => {} },
  });
  assert.equal(wrapper.find('[data-testid="outdated-match-notice"]').exists(), false);
});

test('tells the player the match keeps its starting card rules', () => {
  const wrapper = mount(OutdatedMatchNotice, {
    props: { isMatchOlderThanServer: true, startNewMatch: () => {} },
  });
  const notice = wrapper.find('[data-testid="outdated-match-notice"]');
  assert.equal(notice.exists(), true);
  assert.equal(notice.attributes('role'), 'status', 'a11y: role="status"');
  assert.ok(notice.text().includes('This match started before the latest game update'));
  assert.ok(notice.text().includes('Start a new match to get the latest rules.'));
  assert.equal(
    wrapper.find('[data-testid="outdated-match-notice-detail"]').exists(),
    false,
    'no timing line when the times are unknown',
  );
});

test('names when the match started and when the game updated', () => {
  const wrapper = mount(OutdatedMatchNotice, {
    props: {
      isMatchOlderThanServer: true,
      matchCreatedAtIso: MATCH_CREATED,
      serverBootedAtIso: SERVER_BOOTED,
      startNewMatch: () => {},
      timeZone: 'UTC',
    },
  });
  assert.equal(
    wrapper.find('[data-testid="outdated-match-notice-detail"]').text(),
    'Match started Oct 29, 2026, 1:51 PM UTC; game updated Oct 29, 2026, 1:57 PM UTC.',
  );
});

test('the Start a new match button invokes the injected action', async () => {
  let started = 0;
  const wrapper = mount(OutdatedMatchNotice, {
    props: { isMatchOlderThanServer: true, startNewMatch: () => (started += 1) },
  });
  await wrapper.find('[data-testid="outdated-match-new-match-button"]').trigger('click');
  assert.equal(started, 1);
});

test('the dismiss control hides the notice without leaving the match', async () => {
  let started = 0;
  const wrapper = mount(OutdatedMatchNotice, {
    props: { isMatchOlderThanServer: true, startNewMatch: () => (started += 1) },
  });
  await wrapper.find('[data-testid="outdated-match-dismiss-button"]').trigger('click');
  assert.equal(wrapper.find('[data-testid="outdated-match-notice"]').exists(), false);
  assert.equal(started, 0);
});
