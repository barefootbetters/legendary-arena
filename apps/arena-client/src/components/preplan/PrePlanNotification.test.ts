import '../../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import PrePlanNotification from './PrePlanNotification.vue';
import { usePreplanStore } from '../../stores/preplan';
import {
  sampleDisruptionResultFixture,
  sampleDisruptionResultWithCardFixture,
} from '../../fixtures/preplan/index';

describe('PrePlanNotification', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('renders no alert region when lastNotification is null', () => {
    const wrapper = mount(PrePlanNotification);
    assert.equal(wrapper.find('[role="alert"]').exists(), false);
  });

  test('renders message and source attribution but no card paragraph when affectedCardExtId is absent', () => {
    const store = usePreplanStore();
    store.recordDisruption(sampleDisruptionResultFixture);
    const wrapper = mount(PrePlanNotification);
    const message = wrapper.find('.preplan-notification__message');
    const source = wrapper.find('.preplan-notification__source');
    assert.equal(message.exists(), true);
    assert.equal(
      message.text(),
      sampleDisruptionResultFixture.notification.message,
    );
    assert.equal(source.exists(), true);
    assert.equal(
      source.text().includes(
        sampleDisruptionResultFixture.notification.sourcePlayerId,
      ),
      true,
    );
    assert.equal(wrapper.find('.preplan-notification__card').exists(), false);
  });

  test('renders the card paragraph with the literal CardExtId when affectedCardExtId is present', () => {
    const store = usePreplanStore();
    store.recordDisruption(sampleDisruptionResultWithCardFixture);
    const wrapper = mount(PrePlanNotification);
    const card = wrapper.find('.preplan-notification__card');
    assert.equal(card.exists(), true);
    assert.equal(
      card.text(),
      sampleDisruptionResultWithCardFixture.notification.affectedCardExtId,
    );
  });

  test('clicking dismiss clears the notification and re-renders to empty', async () => {
    const store = usePreplanStore();
    store.recordDisruption(sampleDisruptionResultFixture);
    const wrapper = mount(PrePlanNotification);
    const dismiss = wrapper.find('.preplan-notification__dismiss');
    assert.equal(dismiss.exists(), true);
    await dismiss.trigger('click');
    assert.equal(store.lastNotification, null);
    assert.equal(wrapper.find('[role="alert"]').exists(), false);
  });

  test('root alert element carries role="alert" and aria-live="assertive"', () => {
    const store = usePreplanStore();
    store.recordDisruption(sampleDisruptionResultFixture);
    const wrapper = mount(PrePlanNotification);
    const alert = wrapper.find('[role="alert"]');
    assert.equal(alert.exists(), true);
    assert.equal(alert.attributes('aria-live'), 'assertive');
  });
});
