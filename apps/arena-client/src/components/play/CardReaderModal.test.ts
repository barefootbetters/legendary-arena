import '../../testing/jsdom-setup';

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import CardReaderModal from './CardReaderModal.vue';
import type { UICardDisplay } from '@legendary-arena/game-engine';

function display(name: string): UICardDisplay {
  return {
    extId: 'mastermind-doom',
    name,
    imageUrl: `https://images.legendary-arena.com/${name}.png`,
    cost: 6,
  };
}

// why: the modal teleports to document.body; clear it between tests so
// assertions do not see a previous test's teleported panel.
afterEach(() => {
  document.body.innerHTML = '';
});

describe('CardReaderModal', () => {
  test('renders nothing when closed', () => {
    mount(CardReaderModal, {
      props: { isOpen: false, title: 'Doctor Doom', display: display('Doctor Doom'), gameText: ['x'] },
    });
    assert.equal(document.querySelector('[data-testid="play-card-reader-modal"]'), null);
  });

  test('renders the title, card, and each rules-text line when open', () => {
    mount(CardReaderModal, {
      props: {
        isOpen: true,
        title: 'Doctor Doom',
        display: display('Doctor Doom'),
        gameText: [
          'Master Strike: each player reveals the top card of their deck.',
          'This Mastermind always wins ties.',
        ],
      },
      attachTo: document.body,
    });
    assert.equal(
      document.querySelector('[data-testid="play-card-reader-title"]')!.textContent!.trim(),
      'Doctor Doom',
    );
    assert.ok(document.querySelector('[data-testid="card-tile"]'));
    const text = document.querySelector('[data-testid="play-card-reader-text"]')!.textContent!;
    assert.match(text, /Master Strike/);
    assert.match(text, /always wins ties/);
  });

  test('renders ability markers as glyphs / labels, not raw brackets', () => {
    mount(CardReaderModal, {
      props: {
        isOpen: true,
        title: 'Magneto',
        display: display('Magneto'),
        gameText: [
          'Master Strike: Each player reveals a [hc:strength] Hero or gains a Wound.',
          'Each Villain gets +1[icon:attack].',
        ],
      },
      attachTo: document.body,
    });
    const text = document.querySelector('[data-testid="play-card-reader-text"]')!.textContent!;
    // markers are resolved to readable output ...
    assert.match(text, /reveals a Strength Hero/);
    assert.match(text, /\+1⚔/);
    // ... and the raw markup never reaches the player.
    assert.doesNotMatch(text, /\[hc:strength\]/);
    assert.doesNotMatch(text, /\[icon:attack\]/);
  });

  test('shows the no-rules placeholder when gameText is empty', () => {
    mount(CardReaderModal, {
      props: { isOpen: true, title: 'Some Scheme', display: display('Some Scheme'), gameText: [] },
      attachTo: document.body,
    });
    assert.ok(document.querySelector('[data-testid="play-card-reader-empty"]'));
  });

  test('emits close on the close button and on backdrop click', () => {
    const wrapper = mount(CardReaderModal, {
      props: { isOpen: true, title: 'Doctor Doom', display: display('Doctor Doom'), gameText: ['x'] },
      attachTo: document.body,
    });
    (document.querySelector('[data-testid="play-card-reader-close"]') as HTMLElement).click();
    (document.querySelector('[data-testid="play-card-reader-modal"]') as HTMLElement).click();
    const emitted = wrapper.emitted('close');
    assert.ok(emitted, 'expected close events');
    assert.equal(emitted!.length, 2);
  });
});
