// why: jsdom-setup stubs HTMLCanvasElement.getContext → null (jsdom never
// implemented it), so VfxOverlay's fail-soft path skips particles cleanly and
// these DOM tests assert the word / canvas / impact without real particles.
import '../../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import VfxOverlay, { buildBurstOptions } from './VfxOverlay.vue';
import { useComboVfxSignal, type ComboVfxEvent } from '../../composables/useComboVfx';
import {
  useStrikeBlockedVfxSignal,
  type StrikeBlockedVfxEvent,
} from '../../composables/useStrikeBlockedVfx';
import { useWoundVfxSignal } from '../../composables/useWoundVfx';
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

/** Pushes a shield-block event onto the shared strikeBlocked signal. */
function emitShield(threatKind: StrikeBlockedVfxEvent['threatKind']): void {
  seq += 1;
  useStrikeBlockedVfxSignal().value = { threatKind, seq };
}

/** Pushes a wound-gained event onto the shared wound signal. */
function emitWound(): void {
  seq += 1;
  useWoundVfxSignal().value = { seq };
}

describe('VfxOverlay (WP-556)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
    // why: clear the shared signal so a prior test's event never bleeds into
    // this mount (the watch is not immediate, but the ref is a module singleton).
    useComboVfxSignal().value = null;
    useStrikeBlockedVfxSignal().value = null;
    useWoundVfxSignal().value = null;
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

describe('VfxOverlay — shield-block beat (WP-647)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
    useComboVfxSignal().value = null;
    useStrikeBlockedVfxSignal().value = null;
    useWoundVfxSignal().value = null;
    useEffectIntensity().setIntensity('full');
    useEffectIntensity().prefersReducedMotion.value = false;
  });

  test('a strikeBlocked signal renders the shield glyph, the "BLOCKED!" word, and (full) the spin', async () => {
    const wrapper = mount(VfxOverlay);
    emitShield('masterStrike');
    await nextTick();

    assert.ok(
      wrapper.find('[data-testid="play-vfx-shield"]').exists(),
      'the shield glyph shows',
    );
    const callout = wrapper.find('[data-testid="play-vfx-callout"]');
    assert.ok(callout.exists());
    assert.equal(callout.text(), 'BLOCKED!');
    // At full intensity the shield spins (the motion entrance is active).
    assert.ok(
      wrapper.find('.vfx-overlay__shield-spin--active').exists(),
      'the shield spins at full intensity',
    );
    wrapper.unmount();
  });

  test('intensity off renders neither shield nor word (the master kill-switch)', async () => {
    useEffectIntensity().setIntensity('off');
    const wrapper = mount(VfxOverlay);
    emitShield('ambush');
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-shield"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').exists(), false);
    wrapper.unmount();
  });

  test('reduced-motion keeps the static shield + word but drops the spin (RS-1)', async () => {
    useEffectIntensity().prefersReducedMotion.value = true;
    const wrapper = mount(VfxOverlay);
    emitShield('schemeTwist');
    await nextTick();

    // The shield identity + the reward survive without motion …
    assert.ok(
      wrapper.find('[data-testid="play-vfx-shield"]').exists(),
      'the static shield still shows under reduced-motion',
    );
    assert.ok(wrapper.find('[data-testid="play-vfx-callout"]').exists());
    // … but the spin is suppressed (the shield renders static, not spinning).
    assert.equal(
      wrapper.find('.vfx-overlay__shield-spin--active').exists(),
      false,
      'no spin under reduced-motion',
    );
    wrapper.unmount();
  });

  test('low intensity keeps the static shield + word (spin suppressed, burst still allowed)', async () => {
    useEffectIntensity().setIntensity('low');
    const wrapper = mount(VfxOverlay);
    emitShield('masterStrike');
    await nextTick();

    assert.ok(wrapper.find('[data-testid="play-vfx-shield"]').exists());
    assert.ok(wrapper.find('[data-testid="play-vfx-callout"]').exists());
    assert.equal(
      wrapper.find('.vfx-overlay__shield-spin--active').exists(),
      false,
      'the spin is full-intensity only',
    );
    wrapper.unmount();
  });
});

describe('VfxOverlay — wound-gained vignette (WP-650)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
    useComboVfxSignal().value = null;
    useStrikeBlockedVfxSignal().value = null;
    useWoundVfxSignal().value = null;
    useEffectIntensity().setIntensity('full');
    useEffectIntensity().prefersReducedMotion.value = false;
  });

  test('a wound signal flashes the red damage vignette at full intensity', async () => {
    const wrapper = mount(VfxOverlay);
    emitWound();
    await nextTick();
    assert.ok(
      wrapper.find('[data-testid="play-vfx-wound"]').exists(),
      'the damage vignette shows',
    );
    wrapper.unmount();
  });

  test('intensity off renders no vignette (the master kill-switch)', async () => {
    useEffectIntensity().setIntensity('off');
    const wrapper = mount(VfxOverlay);
    emitWound();
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-wound"]').exists(), false);
    wrapper.unmount();
  });

  test('reduced-motion suppresses the full-screen red flash (photosensitivity)', async () => {
    useEffectIntensity().prefersReducedMotion.value = true;
    const wrapper = mount(VfxOverlay);
    emitWound();
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-wound"]').exists(), false);
    wrapper.unmount();
  });

  test('low intensity suppresses the vignette (gated on shake — full only)', async () => {
    useEffectIntensity().setIntensity('low');
    const wrapper = mount(VfxOverlay);
    emitWound();
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-wound"]').exists(), false);
    wrapper.unmount();
  });
});

describe('VfxOverlay — buildBurstOptions (combo path unchanged, WP-647)', () => {
  test('OMITS the colors key when no palette is given (the combo default multicolor palette)', () => {
    const options = buildBurstOptions(90);
    assert.equal(
      Object.prototype.hasOwnProperty.call(options, 'colors'),
      false,
      'the combo burst must pass NO colors key — canvas-confetti keeps its default palette (NOT gold)',
    );
    assert.equal(options.particleCount, 90);
  });

  test('includes the colors key when a palette is given (the shield path)', () => {
    const palette = ['#e23046', '#ff6b6b', '#ffffff'];
    const options = buildBurstOptions(120, palette);
    assert.deepEqual(options.colors, palette);
    assert.equal(options.particleCount, 120);
  });
});
