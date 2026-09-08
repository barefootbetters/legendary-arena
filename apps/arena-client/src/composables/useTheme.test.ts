import '../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { useTheme, __resetThemeForTests } from './useTheme';

describe('composables/useTheme (day/night)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    __resetThemeForTests('light');
  });

  test('setTheme("dark") applies data-theme="dark" and persists', () => {
    const { setTheme, activeTheme } = useTheme();
    setTheme('dark');
    assert.equal(activeTheme.value, 'dark');
    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
    assert.equal(localStorage.getItem('arenaClientTheme'), 'dark');
  });

  test('setTheme("light") removes the attribute and persists light', () => {
    const { setTheme, activeTheme } = useTheme();
    setTheme('dark');
    setTheme('light');
    assert.equal(activeTheme.value, 'light');
    assert.equal(document.documentElement.getAttribute('data-theme'), null);
    assert.equal(localStorage.getItem('arenaClientTheme'), 'light');
  });

  test('toggleTheme flips day <-> night', () => {
    const { toggleTheme, activeTheme } = useTheme();
    assert.equal(activeTheme.value, 'light');
    toggleTheme();
    assert.equal(activeTheme.value, 'dark');
    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
    toggleTheme();
    assert.equal(activeTheme.value, 'light');
    assert.equal(document.documentElement.getAttribute('data-theme'), null);
  });

  test('the shared ref is the same across separate useTheme() calls', () => {
    const first = useTheme();
    const second = useTheme();
    first.setTheme('dark');
    assert.equal(second.activeTheme.value, 'dark');
  });

  test('a persist failure does not throw or break the applied theme', () => {
    const original = localStorage.setItem.bind(localStorage);
    const originalWarn = console.warn;
    console.warn = () => {};
    // Force setItem to throw (private-mode / disabled site data).
    localStorage.setItem = () => {
      throw new Error('storage disabled');
    };
    try {
      const { setTheme, activeTheme } = useTheme();
      assert.doesNotThrow(() => setTheme('dark'));
      assert.equal(activeTheme.value, 'dark');
      assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
    } finally {
      localStorage.setItem = original;
      console.warn = originalWarn;
    }
  });
});
