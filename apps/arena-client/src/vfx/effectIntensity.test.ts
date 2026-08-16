import '../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  useEffectIntensity,
  EFFECT_INTENSITY_STORAGE_KEY,
  __resetEffectIntensityForTests,
} from './effectIntensity';

describe('effectIntensity (WP-556) — persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
  });

  test('defaults to full when nothing is stored', () => {
    const { intensity } = useEffectIntensity();
    assert.equal(intensity.value, 'full');
  });

  test('setIntensity persists to localStorage and rehydrates', () => {
    const { setIntensity } = useEffectIntensity();
    setIntensity('low');
    assert.equal(localStorage.getItem(EFFECT_INTENSITY_STORAGE_KEY), 'low');
    // A fresh reset reads the persisted value back.
    __resetEffectIntensityForTests();
    assert.equal(useEffectIntensity().intensity.value, 'low');
  });

  test('a corrupt stored value falls back to full', () => {
    localStorage.setItem(EFFECT_INTENSITY_STORAGE_KEY, 'bogus');
    __resetEffectIntensityForTests();
    assert.equal(useEffectIntensity().intensity.value, 'full');
  });
});

describe('effectIntensity (WP-556) — shouldRender gate', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetEffectIntensityForTests();
  });

  test('off renders nothing (the master kill-switch)', () => {
    const { setIntensity, shouldRender } = useEffectIntensity();
    setIntensity('off');
    assert.equal(shouldRender('word'), false);
    assert.equal(shouldRender('particles'), false);
    assert.equal(shouldRender('shake'), false);
  });

  test('full renders everything when reduced-motion is off', () => {
    const { setIntensity, prefersReducedMotion, shouldRender } = useEffectIntensity();
    setIntensity('full');
    prefersReducedMotion.value = false;
    assert.equal(shouldRender('word'), true);
    assert.equal(shouldRender('particles'), true);
    assert.equal(shouldRender('shake'), true);
  });

  test('low renders the word + particles but not shake', () => {
    const { setIntensity, prefersReducedMotion, shouldRender } = useEffectIntensity();
    setIntensity('low');
    prefersReducedMotion.value = false;
    assert.equal(shouldRender('word'), true);
    assert.equal(shouldRender('particles'), true);
    assert.equal(shouldRender('shake'), false);
  });

  test('reduced-motion suppresses shake + particles but the WORD survives', () => {
    const { setIntensity, prefersReducedMotion, shouldRender } = useEffectIntensity();
    setIntensity('full');
    prefersReducedMotion.value = true;
    // why: the accessibility contract — a reduced-motion player still gets the
    // legible reward (the call-out word) but none of the motion-heavy effects.
    assert.equal(shouldRender('word'), true);
    assert.equal(shouldRender('particles'), false);
    assert.equal(shouldRender('shake'), false);
  });
});
