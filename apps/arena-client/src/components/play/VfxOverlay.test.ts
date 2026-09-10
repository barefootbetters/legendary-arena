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
import { useTransformVfxSignal } from '../../composables/useTransformVfx';
import { useMastermindHitVfxSignal } from '../../composables/useMastermindHitVfx';
import { useVictoryFinaleVfxSignal } from '../../composables/useVictoryFinaleVfx';
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

/** Pushes a transform event onto the shared transform signal. */
function emitTransform(): void {
  seq += 1;
  useTransformVfxSignal().value = { seq };
}

/** Pushes a mastermind-hit event (the running defeated-tactic count) onto its signal. */
function emitMastermindHit(tacticsDefeated: number): void {
  seq += 1;
  useMastermindHitVfxSignal().value = { tacticsDefeated, seq };
}

/** Pushes a victory-finale event onto the shared victory signal. */
function emitVictory(): void {
  seq += 1;
  useVictoryFinaleVfxSignal().value = { seq };
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

describe('VfxOverlay — transform beat (WP-672)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
    useComboVfxSignal().value = null;
    useStrikeBlockedVfxSignal().value = null;
    useWoundVfxSignal().value = null;
    useTransformVfxSignal().value = null;
    useEffectIntensity().setIntensity('full');
    useEffectIntensity().prefersReducedMotion.value = false;
  });

  test('a transform signal flashes the gamma-green surge + the "TRANSFORMED!" word at full intensity', async () => {
    const wrapper = mount(VfxOverlay);
    emitTransform();
    await nextTick();

    assert.ok(
      wrapper.find('[data-testid="play-vfx-surge"]').exists(),
      'the power-surge bloom shows',
    );
    const callout = wrapper.find('[data-testid="play-vfx-callout"]');
    assert.ok(callout.exists(), 'the call-out word shows');
    assert.equal(callout.text(), 'TRANSFORMED!');
    wrapper.unmount();
  });

  test('intensity off renders nothing (the master kill-switch)', async () => {
    useEffectIntensity().setIntensity('off');
    const wrapper = mount(VfxOverlay);
    emitTransform();
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-surge"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').exists(), false);
    wrapper.unmount();
  });

  test('low intensity keeps the word but suppresses the surge (gated on shake — full only)', async () => {
    useEffectIntensity().setIntensity('low');
    const wrapper = mount(VfxOverlay);
    emitTransform();
    await nextTick();
    assert.ok(
      wrapper.find('[data-testid="play-vfx-callout"]').exists(),
      'the word survives at low intensity',
    );
    assert.equal(
      wrapper.find('[data-testid="play-vfx-surge"]').exists(),
      false,
      'the full-screen surge is full-intensity only',
    );
    wrapper.unmount();
  });

  test('reduced-motion keeps the word but suppresses the full-screen surge (photosensitivity)', async () => {
    useEffectIntensity().prefersReducedMotion.value = true;
    const wrapper = mount(VfxOverlay);
    emitTransform();
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-callout"]').exists());
    assert.equal(wrapper.find('[data-testid="play-vfx-surge"]').exists(), false);
    wrapper.unmount();
  });
});

describe('VfxOverlay — mastermind-hit beat', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
    useComboVfxSignal().value = null;
    useStrikeBlockedVfxSignal().value = null;
    useWoundVfxSignal().value = null;
    useTransformVfxSignal().value = null;
    useMastermindHitVfxSignal().value = null;
    useEffectIntensity().setIntensity('full');
    useEffectIntensity().prefersReducedMotion.value = false;
  });

  test('a middle hit (hit2) shows its "STAGGERED!" word, no shake', async () => {
    const wrapper = mount(VfxOverlay);
    emitMastermindHit(2);
    await nextTick();
    const callout = wrapper.find('[data-testid="play-vfx-callout"]');
    assert.ok(callout.exists());
    assert.equal(callout.text(), 'STAGGERED!');
    // hit2 does not shake (shake is reserved for hit3/hit4).
    assert.equal(wrapper.find('[data-testid="play-vfx-impact"]').exists(), false);
    wrapper.unmount();
  });

  test('hit1 is a wordless spark (no call-out)', async () => {
    const wrapper = mount(VfxOverlay);
    emitMastermindHit(1);
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').exists(), false);
    wrapper.unmount();
  });

  test('a heavy hit (hit3) fires the impact shake at full intensity', async () => {
    const wrapper = mount(VfxOverlay);
    emitMastermindHit(3);
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-impact"]').exists());
    const callout = wrapper.find('[data-testid="play-vfx-callout"]');
    assert.ok(callout.exists());
    assert.equal(callout.text(), 'RECKONING!');
    wrapper.unmount();
  });

  test('the top hit (hit4) is a wordless screen-shaking impact (finale owns the word)', async () => {
    const wrapper = mount(VfxOverlay);
    emitMastermindHit(4);
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-impact"]').exists());
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').exists(), false);
    wrapper.unmount();
  });

  test('intensity off renders nothing (the master kill-switch)', async () => {
    useEffectIntensity().setIntensity('off');
    const wrapper = mount(VfxOverlay);
    emitMastermindHit(3);
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="play-vfx-impact"]').exists(), false);
    wrapper.unmount();
  });

  test('reduced-motion keeps the word but suppresses the impact shake', async () => {
    useEffectIntensity().prefersReducedMotion.value = true;
    const wrapper = mount(VfxOverlay);
    emitMastermindHit(3);
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-callout"]').exists());
    assert.equal(wrapper.find('[data-testid="play-vfx-impact"]').exists(), false);
    wrapper.unmount();
  });
});

describe('VfxOverlay — heroes-win victory finale', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
    useComboVfxSignal().value = null;
    useStrikeBlockedVfxSignal().value = null;
    useWoundVfxSignal().value = null;
    useTransformVfxSignal().value = null;
    useMastermindHitVfxSignal().value = null;
    useVictoryFinaleVfxSignal().value = null;
    useEffectIntensity().setIntensity('full');
    useEffectIntensity().prefersReducedMotion.value = false;
  });

  test('a victory signal shows the "VICTORY!" banner + the gold bloom at full intensity', async () => {
    const wrapper = mount(VfxOverlay);
    emitVictory();
    await nextTick();
    const banner = wrapper.find('[data-testid="play-vfx-victory"]');
    assert.ok(banner.exists(), 'the victory banner shows');
    assert.equal(banner.text(), 'VICTORY!');
    assert.ok(
      wrapper.find('[data-testid="play-vfx-celebrate"]').exists(),
      'the gold power bloom shows at full intensity',
    );
    wrapper.unmount();
  });

  test('the victory banner uses its OWN slot (not the transient combo call-out word)', async () => {
    // why: a coincident mastermind hit-4 (normal-rules vanquish) must not fight the
    // banner for the combo word slot — they render in separate elements.
    const wrapper = mount(VfxOverlay);
    emitVictory();
    emitMastermindHit(4); // hit4 is wordless, so the combo word slot stays empty
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-victory"]').exists());
    assert.equal(
      wrapper.find('[data-testid="play-vfx-callout"]').exists(),
      false,
      'the finale banner does not occupy the combo word slot',
    );
    wrapper.unmount();
  });

  test('intensity off renders nothing (the master kill-switch)', async () => {
    useEffectIntensity().setIntensity('off');
    const wrapper = mount(VfxOverlay);
    emitVictory();
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-victory"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="play-vfx-celebrate"]').exists(), false);
    wrapper.unmount();
  });

  test('reduced-motion keeps the banner but suppresses the full-screen bloom', async () => {
    useEffectIntensity().prefersReducedMotion.value = true;
    const wrapper = mount(VfxOverlay);
    emitVictory();
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-victory"]').exists());
    assert.equal(wrapper.find('[data-testid="play-vfx-celebrate"]').exists(), false);
    wrapper.unmount();
  });

  test('low intensity keeps the banner but suppresses the bloom (gated on shake — full only)', async () => {
    useEffectIntensity().setIntensity('low');
    const wrapper = mount(VfxOverlay);
    emitVictory();
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-victory"]').exists());
    assert.equal(wrapper.find('[data-testid="play-vfx-celebrate"]').exists(), false);
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
