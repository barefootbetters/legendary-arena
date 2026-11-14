// why: jsdom globals must be installed before Vue's mount() is called.
import '../../testing/jsdom-setup';

import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';

import Footer from './Footer.vue';
import { resetBrowserOnline, setBrowserOnline } from '../../testing/browserOnline';

describe('BrandFooter with no network (D-24851 follow-up)', () => {
  afterEach(() => {
    resetBrowserOnline();
  });

  test('online: the name links to the www site', () => {
    const wrapper = mount(Footer, { global: { stubs: { VersionBadge: true } } });
    assert.equal(wrapper.find('[data-testid="brand-footer-link"]').attributes('href'), 'https://www.legendary-arena.com');
    assert.equal(wrapper.find('[data-testid="brand-footer-name"]').exists(), false);
    wrapper.unmount();
  });

  test('offline: the name is plain text with no link', async () => {
    const wrapper = mount(Footer, { global: { stubs: { VersionBadge: true } } });
    setBrowserOnline(false);
    await nextTick();
    assert.equal(wrapper.find('[data-testid="brand-footer-link"]').exists(), false);
    assert.equal(wrapper.find('[data-testid="brand-footer-name"]').text(), 'Legendary Arena');
    assert.equal(wrapper.findAll('a').length, 0);
    wrapper.unmount();
  });
});
