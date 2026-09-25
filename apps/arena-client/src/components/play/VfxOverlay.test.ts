// why: jsdom-setup stubs HTMLCanvasElement.getContext → null (jsdom never
// implemented it), so VfxOverlay's fail-soft path skips particles cleanly and
// these DOM tests assert the word / canvas / impact without real particles.
import '../../testing/jsdom-setup';

import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { effectScope, nextTick, ref, type EffectScope } from 'vue';
import { mount } from '@vue/test-utils';
import VfxOverlay, {
  buildBladeTrailPath,
  buildBurstOptions,
  buildSliceSprayOptions,
  buildSwordBurstOptions,
} from './VfxOverlay.vue';
import { EXCESSIVE_VIOLENCE_VFX } from '../../vfx/excessiveViolenceVfxManifest';
import { useComboVfxSignal, type ComboVfxEvent } from '../../composables/useComboVfx';
import {
  useStrikeBlockedVfxSignal,
  type StrikeBlockedVfxEvent,
} from '../../composables/useStrikeBlockedVfx';
import { useWoundVfxSignal } from '../../composables/useWoundVfx';
import { useTransformVfxSignal } from '../../composables/useTransformVfx';
import { useExcessiveViolenceVfxSignal } from '../../composables/useExcessiveViolenceVfx';
import { useMastermindHitVfxSignal } from '../../composables/useMastermindHitVfx';
import { useVictoryFinaleVfxSignal } from '../../composables/useVictoryFinaleVfx';
import { useVillainSlashVfxSignal } from '../../composables/useVillainSlashVfx';
import { VILLAIN_SLASH_VFX, villainSlashAngleForSeq } from '../../vfx/villainSlashVfxManifest';
import type { UICityState } from '@legendary-arena/game-engine';
import {
  useBladeTrailSignal,
  useSlashGesture,
  useSliceAngleHints,
  __resetSlashGestureSignalsForTests,
} from '../../composables/useSlashGesture';
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

/** Pushes an Excessive Violence fire event onto the shared EV signal. */
function emitExcessiveViolence(): void {
  seq += 1;
  useExcessiveViolenceVfxSignal().value = { seq };
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

describe('VfxOverlay — Excessive Violence beat (WP-746)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
    useComboVfxSignal().value = null;
    useStrikeBlockedVfxSignal().value = null;
    useWoundVfxSignal().value = null;
    useTransformVfxSignal().value = null;
    useExcessiveViolenceVfxSignal().value = null;
    useEffectIntensity().setIntensity('full');
    useEffectIntensity().prefersReducedMotion.value = false;
  });

  test('an Excessive Violence signal flashes the crimson slash + the "EXCESSIVE VIOLENCE!" word at full intensity', async () => {
    const wrapper = mount(VfxOverlay);
    emitExcessiveViolence();
    await nextTick();

    assert.ok(
      wrapper.find('[data-testid="play-vfx-slash"]').exists(),
      'the crimson slash bloom shows',
    );
    const callout = wrapper.find('[data-testid="play-vfx-callout"]');
    assert.ok(callout.exists(), 'the call-out word shows');
    assert.equal(callout.text(), 'EXCESSIVE VIOLENCE!');
    wrapper.unmount();
  });

  test('intensity off renders nothing (the master kill-switch)', async () => {
    useEffectIntensity().setIntensity('off');
    const wrapper = mount(VfxOverlay);
    emitExcessiveViolence();
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-slash"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').exists(), false);
    wrapper.unmount();
  });

  test('low intensity keeps the word but suppresses the slash (gated on shake — full only)', async () => {
    useEffectIntensity().setIntensity('low');
    const wrapper = mount(VfxOverlay);
    emitExcessiveViolence();
    await nextTick();
    assert.ok(
      wrapper.find('[data-testid="play-vfx-callout"]').exists(),
      'the word survives at low intensity',
    );
    assert.equal(
      wrapper.find('[data-testid="play-vfx-slash"]').exists(),
      false,
      'the full-screen slash is full-intensity only',
    );
    wrapper.unmount();
  });

  test('reduced-motion keeps the word but suppresses the full-screen slash (photosensitivity)', async () => {
    useEffectIntensity().prefersReducedMotion.value = true;
    const wrapper = mount(VfxOverlay);
    emitExcessiveViolence();
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-callout"]').exists());
    assert.equal(wrapper.find('[data-testid="play-vfx-slash"]').exists(), false);
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

describe('VfxOverlay — buildSwordBurstOptions (Excessive Violence blade burst, WP-746 fix-forward)', () => {
  test('carries the manifest count/colours/scalar and sharper-than-round motion', () => {
    const options = buildSwordBurstOptions(EXCESSIVE_VIOLENCE_VFX);
    assert.equal(options.particleCount, EXCESSIVE_VIOLENCE_VFX.particleCount);
    assert.deepEqual(options.colors, [...EXCESSIVE_VIOLENCE_VFX.colors]);
    assert.equal(options.scalar, EXCESSIVE_VIOLENCE_VFX.scalar);
    // why: the blade burst is sharper than the shared round burst (spread 78,
    // startVelocity 42, gravity 0.9) so it reads as a violent slash, not a puff.
    assert.ok((options.startVelocity as number) > 42, 'faster than the round burst');
    assert.ok((options.gravity as number) > 0.9, 'heavier gravity than the round burst');
    assert.equal(options.disableForReducedMotion, true);
  });

  test('OMITS shapes when the library has no shapeFromPath (round fallback), threads them when present', () => {
    const noShapes = buildSwordBurstOptions(EXCESSIVE_VIOLENCE_VFX);
    assert.equal(
      Object.prototype.hasOwnProperty.call(noShapes, 'shapes'),
      false,
      'no shapes key when none supplied — canvas-confetti keeps round particles (graceful degrade)',
    );
    const sword = { __swordShape: true };
    const withShapes = buildSwordBurstOptions(EXCESSIVE_VIOLENCE_VFX, [sword]);
    assert.deepEqual(withShapes.shapes, [sword]);
  });
});

/** A DOMRect stand-in for a stubbed getBoundingClientRect. */
function fakeRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

/**
 * Appends a fake City to document.body: a live villain (with a reference
 * card-tile) at index 0 and an empty placeholder at index 2 — the space a
 * defeated villain usually re-renders as. Returns the row for afterEach removal.
 */
function installFakeCity(): HTMLElement {
  const row = document.createElement('div');
  row.setAttribute('data-testid', 'play-city-row');
  const villain = document.createElement('button');
  villain.setAttribute('data-testid', 'play-city-villain');
  villain.setAttribute('data-city-index', '0');
  villain.getBoundingClientRect = () => fakeRect(100, 200, 90, 130);
  const tile = document.createElement('div');
  tile.setAttribute('data-testid', 'card-tile');
  tile.getBoundingClientRect = () => fakeRect(105, 205, 80, 112);
  villain.appendChild(tile);
  const empty = document.createElement('div');
  empty.setAttribute('data-testid', 'play-city-empty');
  empty.setAttribute('data-city-index', '2');
  empty.getBoundingClientRect = () => fakeRect(300, 200, 90, 40);
  row.appendChild(villain);
  row.appendChild(empty);
  document.body.appendChild(row);
  return row;
}

let sliceClockMs = 1000;
/** Pushes a villain-slash event onto the shared signal at the given overlay time. */
function emitSlice(citySpace: number, playerId: string, atMs: number): void {
  seq += 1;
  sliceClockMs = atMs;
  useVillainSlashVfxSignal().value = {
    seq,
    citySpace,
    playerId,
    imageUrl: 'https://images.example/villain.webp',
  };
}

describe('VfxOverlay — villain slash beat (WP-755)', () => {
  let fakeCity: HTMLElement | null = null;

  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
    useComboVfxSignal().value = null;
    useExcessiveViolenceVfxSignal().value = null;
    useMastermindHitVfxSignal().value = null;
    useVillainSlashVfxSignal().value = null;
    useEffectIntensity().setIntensity('full');
    useEffectIntensity().prefersReducedMotion.value = false;
    // why: mock ONLY setTimeout — setImmediate stays real so the Vue test-utils
    // flush still works; performance.now is stubbed so the streak window is exact.
    mock.timers.enable({ apis: ['setTimeout'] });
    mock.method(performance, 'now', () => sliceClockMs);
    fakeCity = installFakeCity();
  });

  afterEach(() => {
    mock.timers.reset();
    mock.restoreAll();
    if (fakeCity !== null) fakeCity.remove();
    fakeCity = null;
  });

  test('the slice layer is mounted', () => {
    const wrapper = mount(VfxOverlay);
    assert.ok(wrapper.find('[data-testid="play-vfx-slice-layer"]').exists());
    wrapper.unmount();
  });

  test('at full, one signal renders two halves, one streak and five stains', async () => {
    const wrapper = mount(VfxOverlay);
    emitSlice(2, '0', 1000);
    await nextTick();
    assert.equal(wrapper.findAll('[data-testid="play-vfx-slice-half"]').length, 2);
    assert.equal(wrapper.findAll('[data-testid="play-vfx-slice-streak"]').length, 1);
    assert.equal(wrapper.findAll('[data-testid="play-vfx-slice-stain"]').length, 5);
    // A single defeat has no takedown word.
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').exists(), false);
    wrapper.unmount();
  });

  test('the halves are card-shaped (reference tile size) and centred on the empty space', async () => {
    const wrapper = mount(VfxOverlay);
    emitSlice(2, '0', 1000);
    await nextTick();
    const half = wrapper.find('[data-testid="play-vfx-slice-half"]').element as HTMLElement;
    // Space centre (345, 220); reference tile 80×112 → left 305, top 164.
    assert.equal(half.style.width, '80px');
    assert.equal(half.style.height, '112px');
    assert.equal(half.style.left, '305px');
    assert.equal(half.style.top, '164px');
    assert.ok(half.querySelector('img'), 'the half shows the card art');
    wrapper.unmount();
  });

  test('a null imageUrl renders a silhouette half (no img)', async () => {
    const wrapper = mount(VfxOverlay);
    seq += 1;
    useVillainSlashVfxSignal().value = { seq, citySpace: 0, playerId: '0', imageUrl: null };
    await nextTick();
    const halves = wrapper.findAll('[data-testid="play-vfx-slice-half"]');
    assert.equal(halves.length, 2);
    assert.equal(halves[0]?.element.querySelector('img'), null);
    wrapper.unmount();
  });

  test('at low: halves and a streak, but no stains and no impact', async () => {
    useEffectIntensity().setIntensity('low');
    const wrapper = mount(VfxOverlay);
    emitSlice(2, '0', 1000);
    await nextTick();
    assert.equal(wrapper.findAll('[data-testid="play-vfx-slice-half"]').length, 2);
    assert.equal(wrapper.findAll('[data-testid="play-vfx-slice-streak"]').length, 1);
    emitSlice(2, '0', 1200);
    await nextTick();
    emitSlice(2, '0', 1400);
    await nextTick();
    assert.equal(wrapper.findAll('[data-testid="play-vfx-slice-stain"]').length, 0);
    assert.equal(wrapper.find('[data-testid="play-vfx-impact"]').exists(), false);
    wrapper.unmount();
  });

  test('under reduced motion: zero slice nodes, but the word still shows on a double', async () => {
    useEffectIntensity().prefersReducedMotion.value = true;
    const wrapper = mount(VfxOverlay);
    emitSlice(2, '0', 1000);
    await nextTick();
    emitSlice(2, '0', 1500);
    await nextTick();
    const layer = wrapper.find('[data-testid="play-vfx-slice-layer"]').element;
    assert.equal(layer.children.length, 0);
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').text(), 'DOUBLE TAKEDOWN!');
    wrapper.unmount();
  });

  test('at off: nothing', async () => {
    useEffectIntensity().setIntensity('off');
    const wrapper = mount(VfxOverlay);
    emitSlice(2, '0', 1000);
    await nextTick();
    emitSlice(2, '0', 1500);
    await nextTick();
    const layer = wrapper.find('[data-testid="play-vfx-slice-layer"]').element;
    assert.equal(layer.children.length, 0);
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').exists(), false);
    wrapper.unmount();
  });

  test('DOUBLE then TRIPLE inside the word hold (the beat escalates its own word)', async () => {
    const wrapper = mount(VfxOverlay);
    emitSlice(2, '0', 1000);
    await nextTick();
    emitSlice(2, '0', 2000);
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').text(), 'DOUBLE TAKEDOWN!');
    mock.timers.tick(600);
    emitSlice(2, '0', 2600);
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').text(), 'TRIPLE TAKEDOWN!');
    wrapper.unmount();
  });

  test('a different player, or a defeat past the window, does not extend the streak', async () => {
    const wrapper = mount(VfxOverlay);
    emitSlice(2, '0', 1000);
    await nextTick();
    emitSlice(2, '1', 1500);
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').exists(), false);
    emitSlice(2, '1', 6000);
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').exists(), false);
    wrapper.unmount();
  });

  test('at full, a streak of 3 pulses the impact', async () => {
    const wrapper = mount(VfxOverlay);
    emitSlice(2, '0', 1000);
    await nextTick();
    emitSlice(2, '0', 1500);
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-impact"]').exists(), false);
    emitSlice(2, '0', 2000);
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-impact"]').exists());
    wrapper.unmount();
  });

  test('another beat word in the slot is not overwritten', async () => {
    const wrapper = mount(VfxOverlay);
    emitSlice(2, '0', 1000);
    await nextTick();
    emitExcessiveViolence();
    await nextTick();
    emitSlice(2, '0', 1500);
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').text(), 'EXCESSIVE VIOLENCE!');
    wrapper.unmount();
  });

  test('a missing City element skips the pieces without error, and the word still shows', async () => {
    const wrapper = mount(VfxOverlay);
    emitSlice(4, '0', 1000);
    await nextTick();
    emitSlice(4, '0', 1500);
    await nextTick();
    assert.equal(wrapper.findAll('[data-testid="play-vfx-slice-half"]').length, 0);
    assert.equal(wrapper.find('[data-testid="play-vfx-callout"]').text(), 'DOUBLE TAKEDOWN!');
    wrapper.unmount();
  });

  test('six rapid signals leave at most 10 live halves', async () => {
    const wrapper = mount(VfxOverlay);
    for (let index = 0; index < 6; index += 1) {
      emitSlice(2, '0', 1000 + index * 100);
      await nextTick();
    }
    const halves = wrapper.findAll('[data-testid="play-vfx-slice-half"]').length;
    assert.ok(halves <= VILLAIN_SLASH_VFX.maxLiveHalves, `${halves} halves live`);
    assert.equal(halves, VILLAIN_SLASH_VFX.maxLiveHalves);
    wrapper.unmount();
  });

  test('every slice node is removed after its duration (all gone by stainMs)', async () => {
    const wrapper = mount(VfxOverlay);
    emitSlice(2, '0', 1000);
    await nextTick();
    const layer = wrapper.find('[data-testid="play-vfx-slice-layer"]').element;
    assert.ok(layer.children.length > 0);
    mock.timers.tick(VILLAIN_SLASH_VFX.halfFlightMs);
    assert.equal(wrapper.findAll('[data-testid="play-vfx-slice-half"]').length, 0);
    assert.equal(wrapper.findAll('[data-testid="play-vfx-slice-streak"]').length, 0);
    assert.equal(wrapper.findAll('[data-testid="play-vfx-slice-stain"]').length, 5);
    mock.timers.tick(VILLAIN_SLASH_VFX.stainMs);
    assert.equal(layer.children.length, 0);
    wrapper.unmount();
  });

  test('unmount removes every live slice node', async () => {
    const wrapper = mount(VfxOverlay);
    emitSlice(2, '0', 1000);
    await nextTick();
    const layer = wrapper.find('[data-testid="play-vfx-slice-layer"]').element;
    assert.ok(layer.children.length > 0);
    wrapper.unmount();
    assert.equal(layer.children.length, 0);
  });
});

describe('VfxOverlay — buildSliceSprayOptions (WP-755)', () => {
  test('carries the palette, count, origin, the NEGATED angle and the reduced-motion guard', () => {
    const options = buildSliceSprayOptions(VILLAIN_SLASH_VFX.colors, 28, 0.25, 0.4, -28);
    assert.equal(options.particleCount, 28);
    assert.deepEqual(options.colors, [...VILLAIN_SLASH_VFX.colors]);
    assert.deepEqual(options.origin, { x: 0.25, y: 0.4 });
    assert.equal(options.angle, 28);
    assert.equal(buildSliceSprayOptions(VILLAIN_SLASH_VFX.colors, 10, 0.5, 0.5, 34).angle, -34);
    assert.equal(options.disableForReducedMotion, true);
  });
});

// ---------------------------------------------------------------------------
// WP-756 — the slash gesture's blade trail and angle hint.
// ---------------------------------------------------------------------------

const gestureScopes: EffectScope[] = [];

/**
 * Pushes a REAL angle hint by driving a slash-gesture controller: a one-tile row
 * at `citySpace`, a stroke across it at the given direction. The controller's
 * chain submits the fight and queues the hint exactly as production does. Its
 * scope stays alive (the hint is held in flight) until afterEach stops it.
 */
function pushHintViaGesture(citySpace: number, direction: 'vertical' | 'horizontal'): void {
  const row = document.createElement('ol');
  const button = document.createElement('button');
  button.setAttribute('data-testid', 'play-city-villain');
  button.setAttribute('data-city-index', String(citySpace));
  button.getBoundingClientRect = () => fakeRect(100, 100, 80, 110);
  row.appendChild(button);
  const spaces: UICityState['spaces'] = [null, null, null, null, null];
  spaces[citySpace] = {
    extId: `gesture-target-${citySpace}`,
    type: 'villain',
    keywords: [],
    display: { extId: 'x', name: 'x', imageUrl: '', cost: 1 },
    attachedHeroes: [],
    attachedHeroDisplay: [],
    attachedBystanderCount: 0,
    fightCost: 0,
  };
  const city: UICityState = { spaces, escapedPile: [] };
  const scope = effectScope();
  gestureScopes.push(scope);
  const controller = scope.run(() =>
    useSlashGesture({
      rowElement: ref(row),
      city: () => city,
      gateForCityIndex: () => true,
      submitFight: () => {},
      isEnabled: ref(true),
      capturePointer: () => {},
    }),
  );
  if (controller === undefined) throw new Error('The slash-gesture controller did not start.');
  const from = direction === 'vertical' ? { x: 140, y: 60 } : { x: 60, y: 150 };
  const to = direction === 'vertical' ? { x: 140, y: 260 } : { x: 220, y: 150 };
  controller.handlePointerDown({ ...from, pointerType: 'mouse', button: 0, pointerId: 1 });
  controller.handlePointerMove({ ...to, pointerType: 'mouse', button: 0, pointerId: 1 });
  controller.handlePointerUp({ ...to, pointerType: 'mouse', button: 0, pointerId: 1 });
}

/** The rotate(...) angle on the newest slice streak. */
function newestStreakAngle(wrapper: ReturnType<typeof mount>): number | null {
  const streaks = wrapper.findAll('[data-testid="play-vfx-slice-streak"]');
  const newest = streaks[streaks.length - 1];
  if (newest === undefined) return null;
  const match = /rotate\((-?[\d.]+)deg\)/.exec((newest.element as HTMLElement).style.transform);
  return match === null ? null : Number(match[1]);
}

let bladeClockMs = 1000;

describe('VfxOverlay — slash-gesture blade trail + angle hint (WP-756)', () => {
  let fakeCity: HTMLElement | null = null;

  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
    __resetSlashGestureSignalsForTests();
    useVillainSlashVfxSignal().value = null;
    useEffectIntensity().setIntensity('full');
    useEffectIntensity().prefersReducedMotion.value = false;
    mock.timers.enable({ apis: ['setTimeout'] });
    bladeClockMs = 1000;
    sliceClockMs = 1000;
    mock.method(performance, 'now', () => Math.max(bladeClockMs, sliceClockMs));
    fakeCity = installFakeCity();
  });

  afterEach(() => {
    while (gestureScopes.length > 0) gestureScopes.pop()?.stop();
    mock.timers.reset();
    mock.restoreAll();
    if (fakeCity !== null) fakeCity.remove();
    fakeCity = null;
  });

  test('two published samples render the blade trail with a non-empty path', async () => {
    const wrapper = mount(VfxOverlay);
    useBladeTrailSignal().value = { seq: 1, x: 100, y: 150, isStrokeEnd: false };
    bladeClockMs = 1016;
    useBladeTrailSignal().value = { seq: 2, x: 160, y: 150, isStrokeEnd: false };
    await nextTick();
    const trail = wrapper.find('[data-testid="play-vfx-blade-trail"]');
    assert.ok(trail.exists());
    assert.ok((trail.attributes('d') ?? '').startsWith('M '));
    assert.equal(trail.attributes('fill'), VILLAIN_SLASH_VFX.streakCoreColor);
    wrapper.unmount();
  });

  test('the trail is gone one life (170 ms) after the last sample, even with no animation frames', async () => {
    const wrapper = mount(VfxOverlay);
    useBladeTrailSignal().value = { seq: 1, x: 100, y: 150, isStrokeEnd: false };
    bladeClockMs = 1016;
    useBladeTrailSignal().value = { seq: 2, x: 160, y: 150, isStrokeEnd: true };
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-blade-trail"]').exists());
    bladeClockMs = 1016 + 169;
    mock.timers.tick(169);
    await nextTick();
    assert.ok(wrapper.find('[data-testid="play-vfx-blade-trail"]').exists());
    bladeClockMs = 1016 + 170;
    mock.timers.tick(1);
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-blade-trail"]').exists(), false);
    wrapper.unmount();
  });

  test('at off intensity no trail renders', async () => {
    useEffectIntensity().setIntensity('off');
    const wrapper = mount(VfxOverlay);
    useBladeTrailSignal().value = { seq: 1, x: 100, y: 150, isStrokeEnd: false };
    useBladeTrailSignal().value = { seq: 2, x: 160, y: 150, isStrokeEnd: false };
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-vfx-blade-trail"]').exists(), false);
    wrapper.unmount();
  });

  test('a matching hint overrides the seq angle exactly once', async () => {
    const wrapper = mount(VfxOverlay);
    pushHintViaGesture(2, 'vertical');
    emitSlice(2, '0', 1000);
    await nextTick();
    assert.equal(newestStreakAngle(wrapper), 90);
    emitSlice(2, '1', 1100);
    await nextTick();
    assert.equal(newestStreakAngle(wrapper), villainSlashAngleForSeq(seq));
    wrapper.unmount();
  });

  test('a vertical (90°) hint renders two halves without NaN', async () => {
    const wrapper = mount(VfxOverlay);
    pushHintViaGesture(2, 'vertical');
    emitSlice(2, '0', 1000);
    await nextTick();
    const halves = wrapper.findAll('[data-testid="play-vfx-slice-half"]');
    assert.equal(halves.length, 2);
    for (const half of halves) {
      const style = (half.element as HTMLElement).style;
      assert.equal(style.getPropertyValue('clip-path').includes('NaN'), false);
      assert.equal(style.transformOrigin.includes('NaN'), false);
    }
    wrapper.unmount();
  });

  test('at off, a hint is still consumed, so the next matching event uses the seq angle', async () => {
    useEffectIntensity().setIntensity('off');
    const wrapper = mount(VfxOverlay);
    pushHintViaGesture(2, 'vertical');
    emitSlice(2, '0', 1000);
    await nextTick();
    useEffectIntensity().setIntensity('full');
    emitSlice(2, '1', 1100);
    await nextTick();
    assert.equal(newestStreakAngle(wrapper), villainSlashAngleForSeq(seq));
    wrapper.unmount();
  });

  test('a hint for another City space is ignored (and stays queued for its own space)', async () => {
    const wrapper = mount(VfxOverlay);
    pushHintViaGesture(0, 'vertical');
    emitSlice(2, '0', 1000);
    await nextTick();
    assert.equal(newestStreakAngle(wrapper), villainSlashAngleForSeq(seq));
    assert.equal(useSliceAngleHints().take(0), 90);
    wrapper.unmount();
  });
});

describe('VfxOverlay — buildBladeTrailPath (WP-756)', () => {
  test('returns an empty path for fewer than 2 live points', () => {
    assert.equal(buildBladeTrailPath([], 1000, 170, 14), '');
    assert.equal(buildBladeTrailPath([{ x: 0, y: 0, atMs: 1000 }], 1000, 170, 14), '');
    // Two points, but one has expired.
    assert.equal(
      buildBladeTrailPath(
        [
          { x: 0, y: 0, atMs: 700 },
          { x: 10, y: 0, atMs: 1000 },
        ],
        1000,
        170,
        14,
      ),
      '',
    );
  });

  test('tapers from a full-width head to a pinched tail', () => {
    const path = buildBladeTrailPath(
      [
        { x: 0, y: 0, atMs: 1000 },
        { x: 10, y: 0, atMs: 1000 },
        { x: 20, y: 0, atMs: 1000 },
      ],
      1000,
      170,
      14,
    );
    // Left edge tail→head, then right edge head→tail: the head (x=20) is 7 px
    // either side of the line (half of 14), the tail (x=0) pinches to the line.
    assert.equal(path, 'M 0 0 L 10 3.5 L 20 7 L 20 -7 L 10 -3.5 L 0 0 Z');
  });
});
