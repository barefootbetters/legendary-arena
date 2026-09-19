import '../testing/jsdom-setup';

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises } from '@vue/test-utils';
import GameLogCopyButton from './GameLogCopyButton.vue';
import { useUiStateStore } from '../stores/uiState';
import { loadUiStateFixture } from '../fixtures/uiState/index';
import { buildGameLogText } from './log/gameLogExport';

/**
 * Installs a `navigator.clipboard.writeText` stub for one test and returns a
 * teardown. `behavior` = 'resolve' captures the written text; 'reject' drives
 * the fallback path; 'absent' removes the API entirely.
 */
function stubClipboard(behavior: 'resolve' | 'reject' | 'absent'): {
  captured: () => string | null;
  restore: () => void;
} {
  let capturedText: string | null = null;
  if (behavior === 'absent') {
    Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'clipboard');
    return { captured: () => capturedText, restore: () => {} };
  }
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      writeText: (text: string): Promise<void> => {
        capturedText = text;
        return behavior === 'resolve'
          ? Promise.resolve()
          : Promise.reject(new Error('NotAllowedError'));
      },
    },
    configurable: true,
  });
  return {
    captured: () => capturedText,
    restore: () => Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'clipboard'),
  };
}

// why: jsdom does not implement document.execCommand — install a stub returning
// the desired fallback outcome so the fallback path is exercised deterministically.
function stubExecCommand(result: boolean): () => void {
  const original = document.execCommand;
  (document as unknown as { execCommand: (c: string) => boolean }).execCommand = () => result;
  return () => {
    (document as unknown as { execCommand: typeof document.execCommand }).execCommand = original;
  };
}

// Jeff feedback — the endgame outcome screen collapses the board (and the
// GameLogPanel Copy button) behind the "View final board" toggle, so the game
// log had no reachable copy-to-clipboard affordance there. This button fills
// that gap: it shows at game over (non-empty log) and stays hidden during play.
describe('GameLogCopyButton (endgame game-log copy)', () => {
  beforeEach(() => setActivePinia(createPinia()));
  afterEach(() => {
    Reflect.deleteProperty(navigator as unknown as Record<string, unknown>, 'clipboard');
  });

  test('renders at game over when a non-empty log exists', () => {
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const wrapper = mount(GameLogCopyButton);
    assert.equal(
      wrapper.find('[data-testid="game-log-copy-button"]').exists(),
      true,
      'the copy button is shown on the endgame outcome screen',
    );
  });

  test('is hidden during play (GameLogPanel Copy covers that)', () => {
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
    useUiStateStore().setSnapshot(null);
    const wrapper = mount(GameLogCopyButton);
    assert.equal(wrapper.find('[data-testid="game-log-copy-button"]').exists(), false);
  });

  test('clicking writes the built transcript and confirms with "Copied!"', async () => {
    const snapshot = loadUiStateFixture('endgame-win');
    useUiStateStore().setSnapshot(snapshot);
    const clipboard = stubClipboard('resolve');
    try {
      const wrapper = mount(GameLogCopyButton);
      await wrapper.find('[data-testid="game-log-copy-button"]').trigger('click');
      await flushPromises();
      // byte-identical to what the download button writes to the .txt
      const expectedTranscript = buildGameLogText(snapshot.log);
      assert.equal(clipboard.captured(), expectedTranscript);
      assert.ok(expectedTranscript.length > 0, 'the copied transcript is non-empty');
      assert.equal(wrapper.get('[data-testid="game-log-copy-button"]').text(), 'Copied!');
      wrapper.unmount();
    } finally {
      clipboard.restore();
    }
  });

  test('falls back to execCommand and still confirms "Copied!" when writeText rejects', async () => {
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const clipboard = stubClipboard('reject');
    const restoreExec = stubExecCommand(true);
    try {
      const wrapper = mount(GameLogCopyButton);
      await wrapper.find('[data-testid="game-log-copy-button"]').trigger('click');
      await flushPromises();
      assert.equal(wrapper.get('[data-testid="game-log-copy-button"]').text(), 'Copied!');
      wrapper.unmount();
    } finally {
      restoreExec();
      clipboard.restore();
    }
  });

  test('shows "Copy failed" when both the API and the fallback fail — without throwing', async () => {
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const clipboard = stubClipboard('reject');
    const restoreExec = stubExecCommand(false);
    try {
      const wrapper = mount(GameLogCopyButton);
      await assert.doesNotReject(async () => {
        await wrapper.find('[data-testid="game-log-copy-button"]').trigger('click');
        await flushPromises();
      });
      assert.equal(wrapper.get('[data-testid="game-log-copy-button"]').text(), 'Copy failed');
      wrapper.unmount();
    } finally {
      restoreExec();
      clipboard.restore();
    }
  });

  test('uses the execCommand fallback when the Clipboard API is absent', async () => {
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const clipboard = stubClipboard('absent');
    const restoreExec = stubExecCommand(true);
    try {
      const wrapper = mount(GameLogCopyButton);
      await wrapper.find('[data-testid="game-log-copy-button"]').trigger('click');
      await flushPromises();
      assert.equal(wrapper.get('[data-testid="game-log-copy-button"]').text(), 'Copied!');
      wrapper.unmount();
    } finally {
      restoreExec();
      clipboard.restore();
    }
  });
});
