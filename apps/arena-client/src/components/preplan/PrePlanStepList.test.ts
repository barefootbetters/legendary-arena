import '../../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import type { PrePlan } from '@legendary-arena/preplan';
import PrePlanStepList from './PrePlanStepList.vue';
import { usePreplanStore } from '../../stores/preplan';
import {
  activePrePlanFixture,
  consumedPrePlanFixture,
  invalidatedPrePlanFixture,
} from '../../fixtures/preplan/index';

describe('PrePlanStepList', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('renders the empty-state literal when current is null', () => {
    const wrapper = mount(PrePlanStepList);
    const empty = wrapper.find('.preplan-step-list__empty');
    assert.equal(empty.exists(), true);
    assert.equal(empty.text(), 'No plan is active.');
  });

  test('renders one <li> per planSteps entry, in insertion order, with intent and description', () => {
    const store = usePreplanStore();
    store.startPlan(activePrePlanFixture);
    const wrapper = mount(PrePlanStepList);
    const items = wrapper.findAll('.preplan-step-list__steps li');
    assert.equal(items.length, activePrePlanFixture.planSteps.length);
    assert.equal(items.length, 2);
    for (let index = 0; index < activePrePlanFixture.planSteps.length; index += 1) {
      const step = activePrePlanFixture.planSteps[index];
      const item = items[index];
      assert.notEqual(step, undefined);
      assert.notEqual(item, undefined);
      if (step === undefined || item === undefined) continue;
      assert.equal(item.text().includes(step.intent), true);
      assert.equal(item.text().includes(step.description), true);
    }
  });

  test('renders no status paragraph when the plan status is active (explicit negative)', () => {
    const store = usePreplanStore();
    store.startPlan(activePrePlanFixture);
    const wrapper = mount(PrePlanStepList);
    assert.equal(
      wrapper.find('.preplan-step-list__status').exists(),
      false,
    );
  });

  test('renders the status paragraph with "consumed" when the plan is consumed', () => {
    const store = usePreplanStore();
    store.startPlan(consumedPrePlanFixture);
    const wrapper = mount(PrePlanStepList);
    const status = wrapper.find('.preplan-step-list__status');
    assert.equal(status.exists(), true);
    assert.equal(status.text().includes('consumed'), true);
  });

  test('renders the status paragraph with "invalidated" when the plan is invalidated', () => {
    const store = usePreplanStore();
    store.startPlan(invalidatedPrePlanFixture);
    const wrapper = mount(PrePlanStepList);
    const status = wrapper.find('.preplan-step-list__status');
    assert.equal(status.exists(), true);
    assert.equal(status.text().includes('invalidated'), true);
  });

  test('preserves planSteps insertion order over alphabetical with reversed-alphabet descriptions', () => {
    // why: inline three-step fixture exercises insertion-order preservation
    // explicitly. The reversed-alphabet `description` ('zebra' < 'mango' <
    // 'apple' alphabetically descending) would render in alphabetical order
    // if the template sorted; the §G template renders in insertion order.
    const insertionOrderedPlan: PrePlan = {
      prePlanId: 'wp059-step-order-fixture',
      revision: 1,
      playerId: 'player-0',
      appliesToTurn: 4,
      status: 'active',
      baseStateFingerprint: 'wp059-step-order-fingerprint',
      sandboxState: {
        hand: [],
        deck: [],
        discard: [],
        inPlay: [],
        counters: { attack: 0, recruit: 0 },
      },
      revealLedger: [],
      planSteps: [
        {
          intent: 'playCard',
          targetCardExtId: 'hero:Z_CARD',
          description: 'zebra',
          isValid: true,
        },
        {
          intent: 'playCard',
          targetCardExtId: 'hero:M_CARD',
          description: 'mango',
          isValid: true,
        },
        {
          intent: 'playCard',
          targetCardExtId: 'hero:A_CARD',
          description: 'apple',
          isValid: true,
        },
      ],
    };
    const store = usePreplanStore();
    store.startPlan(insertionOrderedPlan);
    const wrapper = mount(PrePlanStepList);
    const items = wrapper.findAll('.preplan-step-list__steps li');
    assert.equal(items.length, 3);
    const firstItem = items[0];
    const secondItem = items[1];
    const thirdItem = items[2];
    assert.notEqual(firstItem, undefined);
    assert.notEqual(secondItem, undefined);
    assert.notEqual(thirdItem, undefined);
    if (firstItem === undefined || secondItem === undefined || thirdItem === undefined) return;
    assert.equal(firstItem.text().includes('zebra'), true);
    assert.equal(secondItem.text().includes('mango'), true);
    assert.equal(thirdItem.text().includes('apple'), true);
  });
});
