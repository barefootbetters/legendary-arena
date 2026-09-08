import '../../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';

import ThemeToggle from './ThemeToggle.vue';
import { __resetThemeForTests } from '../../composables/useTheme';

describe('components/branding/ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    __resetThemeForTests('light');
  });

  test('renders the moon + "switch to night" label in light mode', () => {
    const wrapper = mount(ThemeToggle);
    const button = wrapper.find('[data-testid="theme-toggle"]');
    assert.equal(button.exists(), true);
    assert.equal(button.attributes('aria-label'), 'Switch to night theme');
    assert.equal(button.attributes('aria-pressed'), 'false');
    assert.match(button.text(), /🌙/);
    wrapper.unmount();
  });

  test('clicking toggles to night: data-theme set, sun shown, aria-pressed true', async () => {
    const wrapper = mount(ThemeToggle);
    await wrapper.find('[data-testid="theme-toggle"]').trigger('click');
    assert.equal(document.documentElement.getAttribute('data-theme'), 'dark');
    const button = wrapper.find('[data-testid="theme-toggle"]');
    assert.equal(button.attributes('aria-pressed'), 'true');
    assert.equal(button.attributes('aria-label'), 'Switch to day theme');
    assert.match(button.text(), /☀️/);
    wrapper.unmount();
  });

  test('clicking twice returns to day (attribute removed)', async () => {
    const wrapper = mount(ThemeToggle);
    const button = wrapper.find('[data-testid="theme-toggle"]');
    await button.trigger('click');
    await button.trigger('click');
    assert.equal(document.documentElement.getAttribute('data-theme'), null);
    assert.equal(button.attributes('aria-pressed'), 'false');
    wrapper.unmount();
  });
});
