import '../../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import DangerMeter from './DangerMeter.vue';
import type { UIProgressCounters } from '@legendary-arena/game-engine';
import {
  EFFECT_INTENSITY_STORAGE_KEY,
  __resetEffectIntensityForTests,
} from '../../vfx/effectIntensity';

/**
 * Builds a progress projection for the meter.
 *
 * @param overrides - Menace fields to set on top of the required counters.
 * @returns A UIProgressCounters fixture.
 */
function makeProgress(
  overrides: Partial<UIProgressCounters> = {},
): UIProgressCounters {
  return {
    bystandersRescued: 0,
    escapedVillains: 0,
    ...overrides,
  };
}

const METER = '[data-testid="play-hud-danger-meter"]';
const RATIO = '[data-testid="play-hud-danger-ratio"]';
const LABEL = '[data-testid="play-hud-danger-label"]';

describe('DangerMeter (WP-558) — rendering the projected signal', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
  });

  test('renders the bar, the tier, and the ratio from the projection', () => {
    const wrapper = mount(DangerMeter, {
      props: {
        progress: makeProgress({
          menace: 0.5,
          menaceTier: 'rising',
          schemeLossProgress: 4,
          schemeLossThreshold: 8,
        }),
      },
    });

    const meter = wrapper.find(METER);
    assert.ok(meter.exists());
    assert.equal(meter.attributes('data-tier'), 'rising');
    assert.equal(meter.attributes('aria-valuenow'), '50');
    assert.equal(wrapper.find(RATIO).text(), '4/8');
  });

  test('AC-2: the denominator is the projected one, not a hardcoded 8', () => {
    // why: the defect WP-558 removes. A 4-5 player Super Hero Civil War stack
    // is 5, and the HUD must say so.
    const wrapper = mount(DangerMeter, {
      props: {
        progress: makeProgress({
          menace: 0.8,
          menaceTier: 'critical',
          schemeLossProgress: 4,
          schemeLossThreshold: 5,
        }),
      },
    });

    assert.equal(wrapper.find(RATIO).text(), '4/5');
    assert.equal(wrapper.find(RATIO).text().includes('8'), false);
  });

  test('AC-3: a scheme with no denominator shows the bare count, no ratio', () => {
    // why: D-24366 §5 — a pile-depleted scheme has no fixed denominator.
    const wrapper = mount(DangerMeter, {
      props: {
        progress: makeProgress({
          menace: 0.25,
          menaceTier: 'calm',
          schemeLossProgress: 2,
        }),
      },
    });

    const text = wrapper.find(RATIO).text();
    assert.equal(text, '2');
    assert.equal(text.includes('/'), false);
  });

  test('AC-4: an absent signal renders nothing at all', () => {
    // why: D-24367 §5 — absent is not "calm". A zero-width bar would assert
    // safety the engine never claimed.
    const wrapper = mount(DangerMeter, {
      props: { progress: makeProgress() },
    });

    assert.equal(wrapper.find(METER).exists(), false);
  });

  test('a zero menace with a tier still renders — zero danger is a measurement', () => {
    const wrapper = mount(DangerMeter, {
      props: {
        progress: makeProgress({
          menace: 0,
          menaceTier: 'calm',
          schemeLossProgress: 0,
          schemeLossThreshold: 8,
        }),
      },
    });

    assert.ok(wrapper.find(METER).exists());
    assert.equal(wrapper.find(METER).attributes('aria-valuenow'), '0');
  });
});

describe('DangerMeter (WP-558) — information, not decoration (D-24367 §1)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
  });

  const criticalProgress = makeProgress({
    menace: 0.9,
    menaceTier: 'critical',
    schemeLossProgress: 7,
    schemeLossThreshold: 8,
  });

  test('AC-5: renders at Effect-Intensity `off` — the readout is never gated', () => {
    // why: THE load-bearing assertion of this packet. A player who turns
    // effects off (often for motion sensitivity) must still see how close the
    // villains are to winning. If this ever fails because the meter was routed
    // through shouldRender(), that is a regression of D-24367 §1, not a test
    // that needs relaxing.
    localStorage.setItem(EFFECT_INTENSITY_STORAGE_KEY, 'off');
    __resetEffectIntensityForTests();

    const wrapper = mount(DangerMeter, { props: { progress: criticalProgress } });

    const meter = wrapper.find(METER);
    assert.ok(meter.exists(), 'the meter must render at intensity off');
    assert.equal(wrapper.find(RATIO).text(), '7/8');
    assert.equal(
      meter.classes().includes('danger-meter--pulsing'),
      false,
      'but its pulse animation must be suppressed',
    );
  });

  test('AC-5: renders at Effect-Intensity `full`, with the pulse', () => {
    localStorage.setItem(EFFECT_INTENSITY_STORAGE_KEY, 'full');
    __resetEffectIntensityForTests();

    const wrapper = mount(DangerMeter, { props: { progress: criticalProgress } });

    const meter = wrapper.find(METER);
    assert.ok(meter.exists());
    assert.equal(meter.classes().includes('danger-meter--pulsing'), true);
  });

  test('the pulse is reserved for the critical tier', () => {
    localStorage.setItem(EFFECT_INTENSITY_STORAGE_KEY, 'full');
    __resetEffectIntensityForTests();

    const wrapper = mount(DangerMeter, {
      props: {
        progress: makeProgress({
          menace: 0.4,
          menaceTier: 'rising',
          schemeLossProgress: 3,
          schemeLossThreshold: 8,
        }),
      },
    });

    assert.equal(
      wrapper.find(METER).classes().includes('danger-meter--pulsing'),
      false,
    );
  });
});

describe('DangerMeter (WP-558) — no client-side re-derivation (D-24367 §2)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
  });

  test('AC-6: the tier comes from the projection, even when it disagrees with menace', () => {
    // why: a deliberately INCONSISTENT pair. A menace of 0.9 would be
    // `critical` under the engine's own bands, but the projection says `calm`.
    // The component must render CALM — proving it consumes `menaceTier` rather
    // than re-banding the scalar itself. If the meter ever re-derives, the
    // future adaptive-music channel and this meter can disagree about what
    // "critical" means, which is exactly what the shared contract prevents.
    const wrapper = mount(DangerMeter, {
      props: {
        progress: makeProgress({
          menace: 0.9,
          menaceTier: 'calm',
          schemeLossProgress: 7,
          schemeLossThreshold: 8,
        }),
      },
    });

    const meter = wrapper.find(METER);
    assert.equal(meter.attributes('data-tier'), 'calm');
    assert.equal(meter.classes().includes('danger-meter--calm'), true);
    assert.equal(meter.classes().includes('danger-meter--critical'), false);
    // and the bar still reflects the scalar it was given
    assert.equal(meter.attributes('aria-valuenow'), '90');
  });
});

describe('DangerMeter (WP-562) — the kind-driven label (D-24371 §3)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
  });

  test('AC-2: a Civil War state renders "Heroes 31/42", not a twist count', () => {
    // why: the reported defect end-to-end at the component. The live match
    // projected 42 built / 11 left and the meter read `3` twists; it must now
    // name the hero deck and show its real depletion.
    const wrapper = mount(DangerMeter, {
      props: {
        progress: makeProgress({
          menace: 31 / 42,
          menaceTier: 'critical',
          schemeLossProgress: 31,
          schemeLossThreshold: 42,
          schemeLossKind: 'hero-deck',
        }),
      },
    });

    assert.equal(wrapper.find(LABEL).text(), 'Heroes');
    assert.equal(wrapper.find(RATIO).text(), '31/42');
  });

  test('an escaped-pile state renders "Escaped 4/12"', () => {
    const wrapper = mount(DangerMeter, {
      props: {
        progress: makeProgress({
          menace: 4 / 12,
          menaceTier: 'calm',
          schemeLossProgress: 4,
          schemeLossThreshold: 12,
          schemeLossKind: 'escaped-pile',
        }),
      },
    });

    assert.equal(wrapper.find(LABEL).text(), 'Escaped');
    assert.equal(wrapper.find(RATIO).text(), '4/12');
  });

  test('a kindless projection keeps the generic label rather than guessing', () => {
    // why: an older fixture or a recorded replay. The meter still renders
    // (D-24367 §1); only the noun degrades to the generic one.
    const wrapper = mount(DangerMeter, {
      props: {
        progress: makeProgress({
          menace: 0.5,
          menaceTier: 'rising',
          schemeLossProgress: 4,
          schemeLossThreshold: 8,
        }),
      },
    });

    assert.equal(wrapper.find(LABEL).text(), 'Scheme');
  });

  test('AC-10: the tier still comes from the projection, even beside a hero-deck kind', () => {
    // why: re-proves D-24367 §2 against the NEW input. A 31/42 hero-deck state
    // is `critical` under the engine's own bands, and the projection here
    // deliberately says `calm`. If the component ever re-derived a tier from the
    // kind and the ratio — the obvious shortcut once it has both — this is the
    // test that catches it.
    const wrapper = mount(DangerMeter, {
      props: {
        progress: makeProgress({
          menace: 31 / 42,
          menaceTier: 'calm',
          schemeLossProgress: 31,
          schemeLossThreshold: 42,
          schemeLossKind: 'hero-deck',
        }),
      },
    });

    const meter = wrapper.find(METER);
    assert.equal(meter.attributes('data-tier'), 'calm');
    assert.equal(meter.classes().includes('danger-meter--calm'), true);
    assert.equal(meter.classes().includes('danger-meter--critical'), false);
    // the label and ratio still describe the state it was given
    assert.equal(wrapper.find(LABEL).text(), 'Heroes');
    assert.equal(wrapper.find(RATIO).text(), '31/42');
  });

  test('the accessible text names the same quantity as the visible label', () => {
    const wrapper = mount(DangerMeter, {
      props: {
        progress: makeProgress({
          menace: 0.25,
          menaceTier: 'calm',
          schemeLossProgress: 3,
          schemeLossThreshold: 12,
          schemeLossKind: 'wound-stack',
        }),
      },
    });

    assert.equal(wrapper.find(LABEL).text(), 'Wounds');
    assert.equal(
      wrapper.find(METER).attributes('aria-label')?.includes('3 of 12 wounds'),
      true,
    );
  });
});
