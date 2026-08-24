import '../../testing/jsdom-setup';

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';

import EndgameCoachPanel from './EndgameCoachPanel.vue';
import { useAuthStore } from '../../stores/auth';

const PASS_ENTITLEMENTS = {
  entitlements: [
    { entitlementKey: 'legendary_pass_2026', source: 'stripe', grantedAt: '2026-08-01T00:00:00.000Z' },
  ],
};
const NO_PASS_ENTITLEMENTS = { entitlements: [] };
const COACH_BODY = {
  report: {
    report: { headline: 'Sharp win', heroFit: 'Good fit.', purchases: 'Buy bigger.', suggestions: ['Tip one'] },
    model: 'claude-sonnet-5',
    generatedAt: '2026-08-23T00:00:00.000Z',
  },
  wasCached: false,
};

// A fetch stub routing by URL: /entitlements → entitlements, /coach → coach body.
function installRoutedFetch(entitlementsBody: unknown, coachStatus = 200, coachBody: unknown = COACH_BODY): () => void {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL) => {
    const href = String(url);
    if (href.includes('/entitlements')) {
      return { status: 200, json: async () => entitlementsBody } as Response;
    }
    if (href.includes('/coach')) {
      return { status: coachStatus, json: async () => coachBody } as Response;
    }
    throw new Error('unexpected url: ' + href);
  }) as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

let restoreFetch: (() => void) | null = null;

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  if (restoreFetch) {
    restoreFetch();
    restoreFetch = null;
  }
});

describe('EndgameCoachPanel (WP-595)', () => {
  test('Pass holder: shows the coaching button, then the report on click', async () => {
    restoreFetch = installRoutedFetch(PASS_ENTITLEMENTS);
    useAuthStore().setSession('token-abc', null);
    const wrapper = mount(EndgameCoachPanel, { props: { replayHash: 'replay-1' } });
    await flushPromises(); // initialize() → passStatus 'has'

    const button = wrapper.find('[data-testid="arena-hud-coach-button"]');
    assert.ok(button.exists(), 'the coaching button renders for a Pass holder');
    assert.ok(!wrapper.find('[data-testid="arena-hud-coach-locked"]').exists());

    await button.trigger('click');
    await flushPromises(); // requestCoaching() → report

    const report = wrapper.find('[data-testid="arena-hud-coach-report"]');
    assert.ok(report.exists(), 'the report renders after the fetch');
    assert.equal(wrapper.find('[aria-label="coachHeadline"]').text(), 'Sharp win');
  });

  test('non-Pass holder: shows the locked-teaser upsell, no coaching button', async () => {
    restoreFetch = installRoutedFetch(NO_PASS_ENTITLEMENTS);
    useAuthStore().setSession('token-abc', null);
    const wrapper = mount(EndgameCoachPanel, { props: { replayHash: 'replay-1' } });
    await flushPromises();

    assert.ok(wrapper.find('[data-testid="arena-hud-coach-locked"]').exists(), 'locked teaser renders');
    assert.ok(wrapper.find('[data-testid="arena-hud-coach-upsell"]').exists(), 'upsell CTA renders');
    assert.ok(!wrapper.find('[data-testid="arena-hud-coach-button"]').exists());
  });

  test('guest: shows the locked-teaser upsell', async () => {
    restoreFetch = installRoutedFetch(NO_PASS_ENTITLEMENTS);
    // no setSession → token stays null → guest
    const wrapper = mount(EndgameCoachPanel, { props: { replayHash: 'replay-1' } });
    await flushPromises();
    assert.ok(wrapper.find('[data-testid="arena-hud-coach-locked"]').exists());
  });

  test('Pass holder + a 503: shows the retriable unavailable state', async () => {
    restoreFetch = installRoutedFetch(PASS_ENTITLEMENTS, 503, { error: 'coach_unavailable' });
    useAuthStore().setSession('token-abc', null);
    const wrapper = mount(EndgameCoachPanel, { props: { replayHash: 'replay-1' } });
    await flushPromises();
    await wrapper.find('[data-testid="arena-hud-coach-button"]').trigger('click');
    await flushPromises();
    assert.ok(wrapper.text().includes('temporarily unavailable'), wrapper.text());
    assert.ok(!wrapper.find('[data-testid="arena-hud-coach-report"]').exists());
  });
});
