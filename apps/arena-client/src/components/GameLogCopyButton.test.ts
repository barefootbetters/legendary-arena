import '../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import GameLogCopyButton from './GameLogCopyButton.vue';
import { useUiStateStore } from '../stores/uiState';
import { loadUiStateFixture } from '../fixtures/uiState/index';
import { buildGameLogText } from './log/gameLogExport';

// Jeff feedback — the endgame outcome screen collapses the board (and the
// GameLogPanel Copy button) behind the "View final board" toggle, so the game
// log had no reachable copy-to-clipboard affordance there. This button fills
// that gap: it shows at game over (non-empty log) and stays hidden during play.
describe('GameLogCopyButton (endgame game-log copy)', () => {
  test('renders at game over when a non-empty log exists', () => {
    setActivePinia(createPinia());
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const wrapper = mount(GameLogCopyButton);
    assert.equal(
      wrapper.find('[data-testid="game-log-copy-button"]').exists(),
      true,
      'the copy button is shown on the endgame outcome screen',
    );
  });

  test('is hidden during play (GameLogPanel Copy covers that)', () => {
    setActivePinia(createPinia());
    // mid-turn fixture is in the play phase (no gameOver)
    useUiStateStore().setSnapshot(loadUiStateFixture('mid-turn'));
    const wrapper = mount(GameLogCopyButton);
    assert.equal(
      wrapper.find('[data-testid="game-log-copy-button"]').exists(),
      false,
      'no endgame copy button while the match is still in progress',
    );
  });

  test('is hidden when there is no snapshot at all', () => {
    setActivePinia(createPinia());
    useUiStateStore().setSnapshot(null);
    const wrapper = mount(GameLogCopyButton);
    assert.equal(
      wrapper.find('[data-testid="game-log-copy-button"]').exists(),
      false,
    );
  });

  test('clicking writes the built log transcript to the clipboard', async () => {
    setActivePinia(createPinia());
    const snapshot = loadUiStateFixture('endgame-win');
    useUiStateStore().setSnapshot(snapshot);

    let capturedText: string | null = null;
    // why: jsdom's navigator has no Clipboard API — install a configurable stub
    // that captures the written text, then remove it so it does not leak to other
    // tests. The component guards on `writeText` being a function, so this drives
    // the real copy path (mirrors the GameLogPanel Copy test).
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string): Promise<void> => {
          capturedText = text;
          return Promise.resolve();
        },
      },
      configurable: true,
    });
    try {
      const wrapper = mount(GameLogCopyButton);
      await wrapper.find('[data-testid="game-log-copy-button"]').trigger('click');
      await flushPromises();
      // the transcript the clipboard receives is the engine-authored log,
      // unchanged — byte-identical to what the download button writes to .txt
      const expectedTranscript = buildGameLogText(snapshot.log);
      assert.equal(capturedText, expectedTranscript);
      assert.ok(expectedTranscript.length > 0, 'the copied transcript is non-empty');
      wrapper.unmount();
    } finally {
      Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'clipboard');
    }
  });

  test('clicking does not throw when the Clipboard API is absent', async () => {
    setActivePinia(createPinia());
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    // why: jsdom has no navigator.clipboard by default; the best-effort guard
    // must swallow that so the click never throws into the UI.
    const wrapper = mount(GameLogCopyButton);
    await assert.doesNotReject(async () => {
      await wrapper.find('[data-testid="game-log-copy-button"]').trigger('click');
      await flushPromises();
    });
    wrapper.unmount();
  });
});
