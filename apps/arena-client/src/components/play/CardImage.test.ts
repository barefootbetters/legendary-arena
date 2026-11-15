import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import CardImage from './CardImage.vue';

/**
 * Tests for the WP-891 / D-24848 card-face image. jsdom fires no image `load`
 * or `error` events on its own, so each fallback case dispatches `error`.
 */

const ORIGINAL_URL = 'https://images.legendary-arena.com/core/core-so-officer.webp';
const THUMB_URL = 'https://images.legendary-arena.com/core/thumb/core-so-officer.webp';
const PHONE_URL = 'https://images.legendary-arena.com/core/phone/core-so-officer.webp';
const EXPECTED_SRCSET = `${THUMB_URL} 1x, ${PHONE_URL} 2x`;
const ROOT_URL = 'https://images.legendary-arena.com/agent.webp';

describe('CardImage (WP-891)', () => {
  test('a set-path URL renders the thumb src and the exact srcset', () => {
    const wrapper = mount(CardImage, { props: { imageUrl: ORIGINAL_URL } });
    const image = wrapper.find('img');
    assert.equal(image.attributes('src'), THUMB_URL);
    assert.equal(image.attributes('srcset'), EXPECTED_SRCSET);
  });

  test('a root URL renders its src unchanged with no srcset attribute', () => {
    const wrapper = mount(CardImage, { props: { imageUrl: ROOT_URL } });
    const image = wrapper.find('img');
    assert.equal(image.attributes('src'), ROOT_URL);
    assert.equal(image.attributes('srcset'), undefined);
  });

  test('a first error switches to the original with no srcset and emits nothing', async () => {
    const wrapper = mount(CardImage, { props: { imageUrl: ORIGINAL_URL } });
    const image = wrapper.find('img');
    await image.trigger('error');
    await nextTick();
    assert.equal(wrapper.find('img').attributes('src'), ORIGINAL_URL);
    assert.equal(wrapper.find('img').attributes('srcset'), undefined);
    assert.equal(wrapper.emitted('error'), undefined);
  });

  test('a second error emits error exactly once', async () => {
    const wrapper = mount(CardImage, { props: { imageUrl: ORIGINAL_URL } });
    await wrapper.find('img').trigger('error');
    await nextTick();
    await wrapper.find('img').trigger('error');
    await nextTick();
    assert.equal(wrapper.emitted('error')?.length, 1);
  });

  test('an error on a URL with no tiers emits error at once', async () => {
    const wrapper = mount(CardImage, { props: { imageUrl: ROOT_URL } });
    await wrapper.find('img').trigger('error');
    await nextTick();
    assert.equal(wrapper.emitted('error')?.length, 1);
    assert.equal(wrapper.find('img').attributes('src'), ROOT_URL);
  });

  test('class, alt, loading, data-testid and title fall through to the img', () => {
    const wrapper = mount(CardImage, {
      props: { imageUrl: ORIGINAL_URL },
      attrs: {
        class: 'prompt-card__image',
        alt: 'S.H.I.E.L.D. Officer',
        loading: 'lazy',
        'data-testid': 'card-image-under-test',
        title: 'Officer',
      },
    });
    const image = wrapper.find('img');
    assert.equal(image.classes().includes('prompt-card__image'), true);
    assert.equal(image.attributes('alt'), 'S.H.I.E.L.D. Officer');
    assert.equal(image.attributes('loading'), 'lazy');
    assert.equal(image.attributes('data-testid'), 'card-image-under-test');
    assert.equal(image.attributes('title'), 'Officer');
  });

  test('a new imageUrl restores the tier sources after a fallback', async () => {
    const wrapper = mount(CardImage, { props: { imageUrl: ORIGINAL_URL } });
    await wrapper.find('img').trigger('error');
    await nextTick();
    assert.equal(wrapper.find('img').attributes('src'), ORIGINAL_URL);

    await wrapper.setProps({ imageUrl: 'https://images.legendary-arena.com/core/core-hr-x.webp' });
    await nextTick();
    const image = wrapper.find('img');
    assert.equal(image.attributes('src'), 'https://images.legendary-arena.com/core/thumb/core-hr-x.webp');
    assert.equal(
      image.attributes('srcset'),
      'https://images.legendary-arena.com/core/thumb/core-hr-x.webp 1x, '
        + 'https://images.legendary-arena.com/core/phone/core-hr-x.webp 2x',
    );
  });
});
