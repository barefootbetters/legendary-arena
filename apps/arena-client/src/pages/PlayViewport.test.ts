import '../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import PlayViewport, { computeCasualCoachMatchId } from './PlayViewport.vue';
import { useUiStateStore } from '../stores/uiState';
import { loadUiStateFixture } from '../fixtures/uiState/index';
import type { SubmitMove } from '../components/play/uiMoveName.types';
import type { SubmissionStatus } from '../composables/useCompetitiveSubmitOnGameover';

function installMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    value: () => ({
      matches,
      media: '(max-width: 767px)',
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
    writable: true,
    configurable: true,
  });
}

const noopSubmitMove: SubmitMove = () => undefined;

describe('PlayViewport (WP-129)', () => {
  test('renders <PlayDesktop> when viewport is desktop-sized', () => {
    setActivePinia(createPinia());
    installMatchMedia(false);
    const wrapper = mount(PlayViewport, {
      props: { submitMove: noopSubmitMove },
    });
    assert.equal(wrapper.find('[data-testid="play-desktop"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-mobile"]').exists(), false);
  });

  test('renders <PlayMobile> when viewport is mobile portrait', () => {
    setActivePinia(createPinia());
    installMatchMedia(true);
    const wrapper = mount(PlayViewport, {
      props: { submitMove: noopSubmitMove },
    });
    assert.equal(wrapper.find('[data-testid="play-mobile"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-desktop"]').exists(), false);
  });

  test('mounts the final-turn banner on the live surface when the snapshot carries finalTurn (WP-654)', () => {
    setActivePinia(createPinia());
    installMatchMedia(false);
    const store = useUiStateStore();
    store.setSnapshot(loadUiStateFixture('final-turn'));
    const wrapper = mount(PlayViewport, {
      props: { submitMove: noopSubmitMove },
    });
    const banner = wrapper.find('[data-testid="arena-hud-final-turn"]');
    assert.equal(banner.exists(), true);
    assert.match(banner.text(), /Villain deck: 0/);
  });

  test('omits the final-turn banner on the live surface when the snapshot has no finalTurn (WP-654)', () => {
    setActivePinia(createPinia());
    installMatchMedia(false);
    const store = useUiStateStore();
    // The mid-turn fixture omits finalTurn, so the banner must not render.
    store.setSnapshot(loadUiStateFixture('mid-turn'));
    const wrapper = mount(PlayViewport, {
      props: { submitMove: noopSubmitMove },
    });
    assert.equal(
      wrapper.find('[data-testid="arena-hud-final-turn"]').exists(),
      false,
    );
  });
});

describe('computeCasualCoachMatchId (WP-752 / D-24576)', () => {
  // why: a Record over the union makes vue-tsc fail if a SubmissionStatus is added
  // without a row here, so the truth table always covers every status.
  const EXPECTED_BY_STATUS: Record<SubmissionStatus, string | null> = {
    idle: null,
    submitting: null,
    submitted: null,
    already: null,
    failed: null,
    guest: null,
    ineligible: 'match-1',
    'ended-early': null,
  };

  test('only ineligible yields the match id, for every SubmissionStatus', () => {
    for (const status of Object.keys(EXPECTED_BY_STATUS) as SubmissionStatus[]) {
      assert.equal(
        computeCasualCoachMatchId('match-1', status),
        EXPECTED_BY_STATUS[status],
        status,
      );
    }
    assert.equal(Object.keys(EXPECTED_BY_STATUS).length, 8);
  });

  test('an empty match id yields null even when ineligible', () => {
    assert.equal(computeCasualCoachMatchId('', 'ineligible'), null);
  });
});
