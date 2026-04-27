import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import LobbyControls from './LobbyControls.vue';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

interface RecordedCall {
  name: UiMoveName;
  args: unknown;
}

function recorder(): { calls: RecordedCall[]; submitMove: SubmitMove } {
  const calls: RecordedCall[] = [];
  const submitMove: SubmitMove = (name, args) => {
    calls.push({ name, args });
  };
  return { calls, submitMove };
}

describe('LobbyControls (WP-100 revised 2026-04-27)', () => {

test('LobbyControls renders three buttons: Mark Ready, Mark Not Ready, Start Match', () => {
  const { submitMove } = recorder();
  const wrapper = mount(LobbyControls, { props: { submitMove } });

  assert.equal(
    wrapper.find('[data-testid="play-lobby-mark-ready"]').exists(),
    true,
  );
  assert.equal(
    wrapper.find('[data-testid="play-lobby-mark-not-ready"]').exists(),
    true,
  );
  assert.equal(
    wrapper.find('[data-testid="play-lobby-start-match"]').exists(),
    true,
  );
});

test('Mark Ready click emits setPlayerReady with ready: true', () => {
  const { calls, submitMove } = recorder();
  const wrapper = mount(LobbyControls, { props: { submitMove } });

  void wrapper.find('[data-testid="play-lobby-mark-ready"]').trigger('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'setPlayerReady');
  assert.deepEqual(calls[0]!.args, { ready: true });
});

test('Mark Not Ready click emits setPlayerReady with ready: false', () => {
  const { calls, submitMove } = recorder();
  const wrapper = mount(LobbyControls, { props: { submitMove } });

  void wrapper
    .find('[data-testid="play-lobby-mark-not-ready"]')
    .trigger('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'setPlayerReady');
  assert.deepEqual(calls[0]!.args, { ready: false });
});

test('Start Match click emits startMatchIfReady with an empty-object payload', () => {
  const { calls, submitMove } = recorder();
  const wrapper = mount(LobbyControls, { props: { submitMove } });

  void wrapper.find('[data-testid="play-lobby-start-match"]').trigger('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'startMatchIfReady');
  assert.deepEqual(calls[0]!.args, {});
});

test('All three buttons are unconditionally enabled (engine validates on receipt)', () => {
  const { submitMove } = recorder();
  const wrapper = mount(LobbyControls, { props: { submitMove } });

  for (const testId of [
    'play-lobby-mark-ready',
    'play-lobby-mark-not-ready',
    'play-lobby-start-match',
  ]) {
    const button = wrapper.find(`[data-testid="${testId}"]`);
    assert.equal(
      button.attributes('disabled'),
      undefined,
      `${testId} should be unconditionally enabled`,
    );
  }
});

});
