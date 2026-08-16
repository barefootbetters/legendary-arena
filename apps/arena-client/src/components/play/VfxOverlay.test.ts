// why: jsdom-setup stubs HTMLCanvasElement.getContext → null (jsdom never
// implemented it), so VfxOverlay's fail-soft path skips particles cleanly and
// these DOM tests assert the word / canvas / impact without real particles.
import '../../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import VfxOverlay from './VfxOverlay.vue';
import { useComboVfxSignal, type ComboVfxEvent } from '../../composables/useComboVfx';
import {
  useEffectIntensity,
  __resetEffectIntensityForTests,
} from '../../vfx/effectIntensity';

let seq = 0;
/** Pushes a combo-flash event onto the shared module signal the overlay watches. */
function emit(tier: ComboVfxEvent['tier'], word: string | null): void {
  seq += 1;
  useComboVfxSignal().value = { tier, word, seq };
}

describe('VfxOverlay (WP-556)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
    // why: clear the shared signal so a prior test's event never bleeds into
    // this mount (the watch is not immediate, but the ref is a module singleton).
    useComboVfxSignal().value = null;
    useEffectIntensity().setIntensity('full');
    useEffectIntensity().prefersReducedMotion.value = false;
  });

  test('mounts with exactly one overlay canvas (the performance budget)', () => {
    const wrapper = mount(VfxOverlay);
    assert.ok(wrapper.find('[data-testid="play-vfx-overlay"]').exists());
    assert.equal(wrapper.findAll('canvas').length, 1);
    assert.ok(wrapper.find('[data-testid="play-vfx-canvas"]').exists());
    wrapper.unmount();
  });

  test('shows the call-out word at medium and above, but NOT at small', async () => {
    const wrapper = mount(VfxOverlay);

    emit('small', null);
    await nextTick();
    assert.equal(
      wrapper.find('[data-testid="play-vfx-callout"]').exists(),
      false,
      'small is flash-only — no word',
    );

    emit('medium', 'Team-Up!');
    await nextTick();
    const callout = wrapper.find('[data-testid="play-vfx-callout"]');
    assert.ok(callout.exists());
    assert.equal(callout.text(), 'Team-Up!');
    wrapper.unmount();
  });

  test('intensity off renders no word (the master kill-switch)', async () => {
    useEffectIntensity().setIntensity('off');
    const wrapper = mount(VfxOverlay);

    emit('legendary', 'LEGENDARY!');
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="play-vfx-impact"]').exists(), false);
    wrapper.unmount();
  });

  test('reduced-motion keeps the word but suppresses the impact shake', async () => {
    useEffectIntensity().prefersReducedMotion.value = true;
    const wrapper = mount(VfxOverlay);

    emit('big', 'Unstoppable!');
    await nextTick();
    // The word survives (legible reward) …
    assert.ok(wrapper.find('[data-testid="play-vfx-callout"]').exists());
    // … but the shake/impact is suppressed under reduced-motion.
    assert.equal(wrapper.find('[data-testid="play-vfx-impact"]').exists(), false);
    wrapper.unmount();
  });

  test('a full-intensity peak tier fires the impact', async () => {
    const wrapper = mount(VfxOverlay);
    emit('legendary', 'LEGENDARY!');
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-impact"]').exists());
    wrapper.unmount();
  });
});
