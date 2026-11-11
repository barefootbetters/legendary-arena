import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { UIPlayerState } from '@legendary-arena/game-engine';
import HauntedExorciseChooser from './HauntedExorciseChooser.vue';

/**
 * A minimal public seat for the chooser's recipient list.
 *
 * @param playerId - The seat id.
 * @returns A UIPlayerState with zeroed counts.
 */
function seat(playerId: string): UIPlayerState {
  return { playerId, deckCount: 0, handCount: 0, discardCount: 0, inPlayCount: 0, victoryCount: 0, woundCount: 0 };
}

const THREE_SEATS: UIPlayerState[] = [seat('0'), seat('1'), seat('2')];

describe('HauntedExorciseChooser (WP-759 / D-24587)', () => {
  test('heading names the Hero and the printed price', () => {
    const wrapper = mount(HauntedExorciseChooser, {
      props: { hqIndex: 2, heroName: 'Iron Man', cost: 6, players: THREE_SEATS, viewerPlayerId: '0' },
    });
    assert.match(wrapper.text(), /Exorcise Iron Man \(pay 6 Recruit\)/);
  });

  test('with no known cost the heading names no price', () => {
    const wrapper = mount(HauntedExorciseChooser, {
      props: { hqIndex: 2, heroName: 'Iron Man', cost: null, players: THREE_SEATS, viewerPlayerId: '0' },
    });
    assert.match(wrapper.text(), /Exorcise Iron Man/);
    assert.doesNotMatch(wrapper.text(), /pay/);
  });

  test('KO emits the ko outcome with no recipientPlayerId', async () => {
    const wrapper = mount(HauntedExorciseChooser, {
      props: { hqIndex: 3, heroName: 'Storm', cost: 5, players: THREE_SEATS, viewerPlayerId: '0' },
    });
    await wrapper.find('[data-testid="play-exorcise-ko"]').trigger('click');
    const emitted = wrapper.emitted('choose');
    assert.ok(emitted);
    assert.deepEqual(emitted[0], [{ hqIndex: 3, outcome: 'ko' }]);
    assert.equal('recipientPlayerId' in (emitted[0]![0] as object), false);
  });

  test('recipients are the viewer first as "You", then the other seats in order', () => {
    const wrapper = mount(HauntedExorciseChooser, {
      props: { hqIndex: 0, heroName: 'Storm', cost: 5, players: THREE_SEATS, viewerPlayerId: '1' },
    });
    const gives = wrapper.findAll('[data-testid="play-exorcise-give"]');
    assert.deepEqual(
      gives.map((give) => [give.attributes('data-recipient-id'), give.text()]),
      [['1', 'You'], ['0', 'Player 1'], ['2', 'Player 3']],
    );
  });

  test('Give emits the gain outcome with the string seat id', async () => {
    const wrapper = mount(HauntedExorciseChooser, {
      props: { hqIndex: 0, heroName: 'Storm', cost: 5, players: THREE_SEATS, viewerPlayerId: '0' },
    });
    await wrapper.findAll('[data-testid="play-exorcise-give"]')[2]!.trigger('click');
    assert.deepEqual(wrapper.emitted('choose')![0], [{ hqIndex: 0, outcome: 'gain', recipientPlayerId: '2' }]);
  });

  test('opens with focus on KO; Escape and Cancel emit close and nothing else', async () => {
    const wrapper = mount(HauntedExorciseChooser, {
      attachTo: document.body,
      props: { hqIndex: 0, heroName: 'Storm', cost: 5, players: THREE_SEATS, viewerPlayerId: '0' },
    });
    await nextTick();
    assert.equal(document.activeElement, wrapper.find('[data-testid="play-exorcise-ko"]').element);
    await wrapper.find('[data-testid="play-exorcise-chooser"]').trigger('keydown', { key: 'Escape' });
    await wrapper.find('[data-testid="play-exorcise-cancel"]').trigger('click');
    assert.equal(wrapper.emitted('close')!.length, 2);
    assert.equal(wrapper.emitted('choose'), undefined);
    wrapper.unmount();
  });

  test('every control is a button (keyboard-operable)', () => {
    const wrapper = mount(HauntedExorciseChooser, {
      props: { hqIndex: 0, heroName: 'Storm', cost: 5, players: THREE_SEATS, viewerPlayerId: '0' },
    });
    const controls = wrapper.findAll('[data-testid^="play-exorcise-"]').filter((node) => node.attributes('data-testid') !== 'play-exorcise-chooser');
    assert.ok(controls.length >= 5);
    for (const control of controls) {
      assert.equal(control.element.tagName, 'BUTTON');
    }
  });
});
