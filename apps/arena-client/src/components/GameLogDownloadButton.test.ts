import '../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import GameLogDownloadButton from './GameLogDownloadButton.vue';
import { useUiStateStore } from '../stores/uiState';
import { loadUiStateFixture } from '../fixtures/uiState/index';
import { buildGameLogText } from './log/gameLogExport';

// Jeff feedback — the endgame outcome screen collapses the board (and the
// GameLogPanel Save button) behind the "View final board" toggle, so the game
// log had no reachable download there. This button fills that gap: it shows at
// game over (non-empty log) and stays hidden during play.
describe('GameLogDownloadButton (endgame game-log download)', () => {
  test('renders at game over when a non-empty log exists', () => {
    setActivePinia(createPinia());
    useUiStateStore().setSnapshot(loadUiStateFixture('endgame-win'));
    const wrapper = mount(GameLogDownloadButton);
    assert.equal(
      wrapper.find('[data-testid="game-log-download-button"]').exists(),
      true,
      'the download button is shown on the endgame outcome screen',
    );
  });

  test('is hidden during play (GameLogPanel Save covers that)', () => {
    setActivePinia(createPinia());
    // mid-turn fixture is in the play phase (no gameOver)
    useUiStateStore().setSnapshot(loadUiStateFixture('mid-turn'));
    const wrapper = mount(GameLogDownloadButton);
    assert.equal(
      wrapper.find('[data-testid="game-log-download-button"]').exists(),
      false,
      'no endgame download button while the match is still in progress',
    );
  });

  test('is hidden when there is no snapshot at all', () => {
    setActivePinia(createPinia());
    useUiStateStore().setSnapshot(null);
    const wrapper = mount(GameLogDownloadButton);
    assert.equal(
      wrapper.find('[data-testid="game-log-download-button"]').exists(),
      false,
    );
  });

  test('clicking downloads the match-scoped game-log .txt without throwing', () => {
    setActivePinia(createPinia());
    const snapshot = loadUiStateFixture('endgame-win');
    useUiStateStore().setSnapshot(snapshot);

    // jsdom exposes no URL.createObjectURL, so stub it (to pass the helper's guard)
    // and intercept the anchor's click via a document.createElement spy — observing
    // the download file name instead of performing a real browser save.
    const urlApi = URL as unknown as {
      createObjectURL: ((b: Blob) => string) | undefined;
      revokeObjectURL: ((u: string) => void) | undefined;
    };
    const originalCreateObjectUrl = urlApi.createObjectURL;
    const originalRevokeObjectUrl = urlApi.revokeObjectURL;
    let blobsCreated = 0;
    urlApi.createObjectURL = () => {
      blobsCreated += 1;
      return 'blob:stub';
    };
    urlApi.revokeObjectURL = () => {};

    const realCreateElement = document.createElement.bind(document);
    let downloadedName = '';
    (document as unknown as { createElement: typeof document.createElement }).createElement = ((
      tagName: string,
    ) => {
      const element = realCreateElement(tagName);
      if (tagName === 'a') {
        // why: override the instance click so the "download" is observed, not performed.
        (element as HTMLAnchorElement).click = function click(this: HTMLAnchorElement): void {
          downloadedName = this.download;
        };
      }
      return element;
    }) as typeof document.createElement;

    try {
      const wrapper = mount(GameLogDownloadButton);
      void wrapper.find('[data-testid="game-log-download-button"]').trigger('click');
    } finally {
      urlApi.createObjectURL = originalCreateObjectUrl;
      urlApi.revokeObjectURL = originalRevokeObjectUrl;
      (document as unknown as { createElement: typeof document.createElement }).createElement =
        realCreateElement as typeof document.createElement;
    }

    assert.equal(blobsCreated, 1, 'exactly one blob was created for the download');
    assert.match(
      downloadedName,
      /^legendary-arena-game-log-.*\.txt$/,
      'the download uses the match-scoped game-log .txt file name',
    );
    // the transcript the export receives is the engine-authored log, unchanged
    assert.ok(buildGameLogText(snapshot.log).length > 0, 'the transcript is non-empty');
  });
});
