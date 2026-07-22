// why: jsdom globals must be installed before Vue's mount() is called.
import '../testing/jsdom-setup';

import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount, enableAutoUnmount } from '@vue/test-utils';

import BotAllyStallBanner, { BOT_ALLY_STALL_FALLBACK_MESSAGE } from './BotAllyStallBanner.vue';

/**
 * Tests for the bot-ally stall banner (WP-415 / EC-450). Renders only on an
 * abnormal stop; shows the server message verbatim (else the fixed co-op
 * fallback); the Return-to-lobby action invokes the injected navigation.
 */

enableAutoUnmount(afterEach);

const BANNER = '[data-testid="bot-ally-stall-banner"]';
const RETURN_BUTTON = '[data-testid="bot-ally-stall-return-button"]';

test('renders nothing when the bot ally has not stopped', () => {
  const wrapper = mount(BotAllyStallBanner, {
    props: { hasStopped: false, message: null, returnToLobby: () => {} },
  });
  assert.equal(wrapper.find(BANNER).exists(), false, 'a healthy match shows no banner');
});

test('shows the server message verbatim when present', () => {
  const serverMessage = 'The bot ally could not finish its turn, so the match was stopped.';
  const wrapper = mount(BotAllyStallBanner, {
    props: { hasStopped: true, message: serverMessage, returnToLobby: () => {} },
  });
  const banner = wrapper.find(BANNER);
  assert.equal(banner.exists(), true, 'an abnormal stop shows the banner');
  assert.ok(banner.text().includes(serverMessage), 'the server message is rendered verbatim');
});

test('shows the fixed co-op fallback when the message is null', () => {
  const wrapper = mount(BotAllyStallBanner, {
    props: { hasStopped: true, message: null, returnToLobby: () => {} },
  });
  const banner = wrapper.find(BANNER);
  assert.ok(
    banner.text().includes(BOT_ALLY_STALL_FALLBACK_MESSAGE),
    'a null message falls back to the fixed co-op sentence',
  );
});

test('the Return-to-lobby action invokes the injected navigation', async () => {
  let navigations = 0;
  const wrapper = mount(BotAllyStallBanner, {
    props: {
      hasStopped: true,
      message: null,
      returnToLobby: () => {
        navigations += 1;
      },
    },
  });

  await wrapper.find(RETURN_BUTTON).trigger('click');

  assert.equal(navigations, 1, 'clicking Return to lobby calls the injected navigation exactly once');
});

test('the fallback copy uses no PvP / versus framing (§23(b))', () => {
  assert.doesNotMatch(
    BOT_ALLY_STALL_FALLBACK_MESSAGE,
    /opponent|versus|\bvs\b/i,
    'the co-op banner copy never uses opponent/versus language',
  );
});
