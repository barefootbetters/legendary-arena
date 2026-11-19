import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { UIDisplayEntry } from '@legendary-arena/game-engine';
import AssassinShuffleChooser from './AssassinShuffleChooser.vue';

/**
 * One projected Elite Assassin, as `shuffleFight.eligibleAssassins` carries it.
 *
 * @param slug - The card slug and copy suffix.
 * @param name - The card name.
 * @returns A display entry with art.
 */
function assassin(slug: string, name: string): UIDisplayEntry {
  const extId = `bkwd-villain-elite-assassins-${slug}`;
  return {
    extId,
    display: { extId, name, imageUrl: `https://images.legendary-arena.com/${slug}.webp`, cost: null },
  };
}

const THREE_ASSASSINS: UIDisplayEntry[] = [
  assassin('snapdragon-01', 'Snapdragon'),
  assassin('black-lotus-00', 'Black Lotus'),
  assassin('snapdragon-02', 'Snapdragon'),
];

/**
 * Mounts the chooser with three Assassins and a required count of 2.
 *
 * @returns The wrapper.
 */
function mountChooser(): ReturnType<typeof mount> {
  return mount(AssassinShuffleChooser, { props: { assassins: THREE_ASSASSINS, requiredCount: 2 } });
}

describe('AssassinShuffleChooser (WP-770 / D-24601)', () => {
  test('lists every projected Assassin in order, each with its art and name, as a dialog', () => {
    const wrapper = mountChooser();
    const dialog = wrapper.find('[data-testid="play-assassin-chooser"]');
    assert.equal(dialog.attributes('role'), 'dialog');
    assert.equal(dialog.attributes('aria-modal'), 'true');
    assert.equal(dialog.attributes('aria-label'), 'Choose Elite Assassins to shuffle');
    assert.match(wrapper.text(), /Choose 2 Elite Assassins/);
    const options = wrapper.findAll('[data-testid="play-assassin-option"]');
    assert.deepEqual(
      options.map((option) => option.attributes('data-ext-id')),
      THREE_ASSASSINS.map((entry) => entry.extId),
    );
    assert.match(options[1]!.text(), /Black Lotus/);
    assert.ok(options[1]!.find('img').exists(), 'the card art renders');
    for (const option of options) {
      assert.equal(option.element.tagName, 'BUTTON');
    }
  });

  test('a click toggles an Assassin and its aria-pressed', async () => {
    const wrapper = mountChooser();
    const first = wrapper.findAll('[data-testid="play-assassin-option"]')[0]!;
    assert.equal(first.attributes('aria-pressed'), 'false');
    await first.trigger('click');
    assert.equal(first.attributes('aria-pressed'), 'true');
    await first.trigger('click');
    assert.equal(first.attributes('aria-pressed'), 'false');
  });

  test('Confirm is enabled only at exactly the required count (toggles are unrestricted)', async () => {
    const wrapper = mountChooser();
    const options = wrapper.findAll('[data-testid="play-assassin-option"]');
    const confirm = (): ReturnType<typeof wrapper.find> => wrapper.find('[data-testid="play-assassin-confirm"]');
    assert.equal(confirm().attributes('disabled'), '', '0 chosen');
    await options[0]!.trigger('click');
    assert.equal(confirm().attributes('disabled'), '', '1 chosen');
    await options[1]!.trigger('click');
    assert.equal(confirm().attributes('disabled'), undefined, '2 chosen');
    await options[2]!.trigger('click');
    assert.equal(options[2]!.attributes('aria-pressed'), 'true', 'a third pick is allowed');
    assert.equal(confirm().attributes('disabled'), '', '3 chosen');
    await confirm().trigger('click');
    assert.equal(wrapper.emitted('choose'), undefined, 'a disabled Confirm emits nothing');
  });

  test('Confirm emits the chosen ext_ids in projected order, whatever the click order', async () => {
    const wrapper = mountChooser();
    const options = wrapper.findAll('[data-testid="play-assassin-option"]');
    await options[2]!.trigger('click');
    await options[0]!.trigger('click');
    await wrapper.find('[data-testid="play-assassin-confirm"]').trigger('click');
    assert.deepEqual(wrapper.emitted('choose'), [[[THREE_ASSASSINS[0]!.extId, THREE_ASSASSINS[2]!.extId]]]);
    assert.equal(wrapper.emitted('close'), undefined);
  });

  test('Escape, Cancel and a backdrop click emit close; a click inside the panel does not', async () => {
    const wrapper = mountChooser();
    await wrapper.find('[data-testid="play-assassin-chooser"]').trigger('click');
    assert.equal(wrapper.emitted('close'), undefined, 'a click inside the panel keeps it open');
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.find('[data-testid="play-assassin-cancel"]').trigger('click');
    await wrapper.find('[data-testid="play-assassin-backdrop"]').trigger('click');
    const closeEvents = wrapper.emitted('close')!;
    assert.equal(closeEvents.length, 3);
    assert.equal(wrapper.emitted('choose'), undefined);
    wrapper.unmount();
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
    assert.equal(closeEvents.length, 3, 'the Escape listener is removed on unmount');
  });

  test('opens with focus on the first Assassin', async () => {
    const wrapper = mount(AssassinShuffleChooser, {
      attachTo: document.body,
      props: { assassins: THREE_ASSASSINS, requiredCount: 2 },
    });
    await nextTick();
    await nextTick();
    assert.equal(document.activeElement, wrapper.findAll('[data-testid="play-assassin-option"]')[0]!.element);
    wrapper.unmount();
  });
});
