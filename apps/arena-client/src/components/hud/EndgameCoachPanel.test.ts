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

// why: WP-713 — realistic play-order tip prose (the real WP-710 shape), so the
// copy-lint scan below is not vacuously green (mirrors the EndgameSummary precedent).
const SEQUENCE_TIPS = [
  "Next time, play Perfect Teamwork before Marvelous Strength — you'd have landed its strength synergy bonus.",
  "Next time, play Nick Fury before Legendary Commander — you'd have landed its shield synergy bonus.",
];
function coachBodyWithSequenceTips(sequenceTips: readonly string[]): unknown {
  return {
    report: {
      report: { headline: 'Sharp win', heroFit: 'Good fit.', purchases: 'Buy bigger.', suggestions: ['Tip one'], sequenceTips },
      model: 'claude-sonnet-5',
      generatedAt: '2026-08-23T00:00:00.000Z',
    },
    wasCached: false,
  };
}

// why: WP-718 — realistic co-op Table Cooperation prose (the real WP-717 shape).
const TABLE_COOPERATION = [
  'Your table stopped Red Skull together — a shared victory.',
  'Player 2 carried the combat — 8 enemies defeated.',
  'Together your table defeated 14 enemies and rescued 17 Bystanders.',
];
function coachBodyWithTableCooperation(tableCooperation: readonly string[]): unknown {
  return {
    report: {
      report: { headline: 'Sharp win', heroFit: 'Good fit.', purchases: 'Buy bigger.', suggestions: ['Tip one'], tableCooperation },
      model: 'claude-sonnet-5',
      generatedAt: '2026-08-23T00:00:00.000Z',
    },
    wasCached: false,
  };
}

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

  // WP-713 / D-24536 — the play-order "Opportunities" block (renders sequenceTips).

  test('renders the Opportunities block, one line per sequence tip, when present', async () => {
    restoreFetch = installRoutedFetch(PASS_ENTITLEMENTS, 200, coachBodyWithSequenceTips(SEQUENCE_TIPS));
    useAuthStore().setSession('token-abc', null);
    const wrapper = mount(EndgameCoachPanel, { props: { replayHash: 'replay-1' } });
    await flushPromises();
    await wrapper.find('[data-testid="arena-hud-coach-button"]').trigger('click');
    await flushPromises();

    const block = wrapper.find('[data-testid="arena-hud-coach-opportunities"]');
    assert.ok(block.exists(), 'the Opportunities block renders when sequenceTips is non-empty');
    const items = block.findAll('li');
    assert.equal(items.length, SEQUENCE_TIPS.length, 'one <li> per sequence tip');
    assert.equal(items[0]!.text(), SEQUENCE_TIPS[0], 'the first tip renders verbatim');
    assert.equal(items[1]!.text(), SEQUENCE_TIPS[1], 'the second tip renders verbatim');
  });

  test('hides the Opportunities block when sequenceTips is an empty array', async () => {
    restoreFetch = installRoutedFetch(PASS_ENTITLEMENTS, 200, coachBodyWithSequenceTips([]));
    useAuthStore().setSession('token-abc', null);
    const wrapper = mount(EndgameCoachPanel, { props: { replayHash: 'replay-1' } });
    await flushPromises();
    await wrapper.find('[data-testid="arena-hud-coach-button"]').trigger('click');
    await flushPromises();

    assert.ok(wrapper.find('[data-testid="arena-hud-coach-report"]').exists(), 'the report still renders');
    assert.ok(
      !wrapper.find('[data-testid="arena-hud-coach-opportunities"]').exists(),
      'the Opportunities block is absent for an empty sequenceTips array',
    );
  });

  test('hides the Opportunities block when sequenceTips is omitted (pre-WP-710 report)', async () => {
    // why: COACH_BODY carries no sequenceTips — the shape of a report cached before WP-710.
    restoreFetch = installRoutedFetch(PASS_ENTITLEMENTS, 200, COACH_BODY);
    useAuthStore().setSession('token-abc', null);
    const wrapper = mount(EndgameCoachPanel, { props: { replayHash: 'replay-1' } });
    await flushPromises();
    await wrapper.find('[data-testid="arena-hud-coach-button"]').trigger('click');
    await flushPromises();

    assert.ok(wrapper.find('[data-testid="arena-hud-coach-report"]').exists(), 'the report still renders');
    assert.ok(
      !wrapper.find('[data-testid="arena-hud-coach-opportunities"]').exists(),
      'the Opportunities block is absent when the field is undefined',
    );
  });

  test('copy-lint: the Opportunities block uses opportunity voice only', async () => {
    restoreFetch = installRoutedFetch(PASS_ENTITLEMENTS, 200, coachBodyWithSequenceTips(SEQUENCE_TIPS));
    useAuthStore().setSession('token-abc', null);
    const wrapper = mount(EndgameCoachPanel, { props: { replayHash: 'replay-1' } });
    await flushPromises();
    await wrapper.find('[data-testid="arena-hud-coach-button"]').trigger('click');
    await flushPromises();

    // why: two-vocabulary invariant — the coach opportunities surface never uses the
    // defeatist words (mirrors the EndgameSummary per-player copy-lint; no coach-panel
    // copy-lint existed before this WP).
    const block = wrapper.find('[data-testid="arena-hud-coach-opportunities"]').text().toLowerCase();
    for (const banned of ['whiff', 'failed', 'error', 'missed', 'wasted']) {
      assert.ok(!block.includes(banned), `coach opportunity copy must not say "${banned}"`);
    }
  });

  // WP-718 / D-24540 — the co-op Table Cooperation recognition block (renders tableCooperation).

  test('renders the Table Cooperation block, one line per recognition, when present', async () => {
    restoreFetch = installRoutedFetch(PASS_ENTITLEMENTS, 200, coachBodyWithTableCooperation(TABLE_COOPERATION));
    useAuthStore().setSession('token-abc', null);
    const wrapper = mount(EndgameCoachPanel, { props: { replayHash: 'replay-1' } });
    await flushPromises();
    await wrapper.find('[data-testid="arena-hud-coach-button"]').trigger('click');
    await flushPromises();

    const block = wrapper.find('[data-testid="arena-hud-coach-table-cooperation"]');
    assert.ok(block.exists(), 'the Table Cooperation block renders when tableCooperation is non-empty');
    const items = block.findAll('li');
    assert.equal(items.length, TABLE_COOPERATION.length, 'one <li> per recognition line');
    assert.equal(items[0]!.text(), TABLE_COOPERATION[0], 'the first line renders verbatim');
  });

  test('hides the Table Cooperation block when tableCooperation is empty', async () => {
    restoreFetch = installRoutedFetch(PASS_ENTITLEMENTS, 200, coachBodyWithTableCooperation([]));
    useAuthStore().setSession('token-abc', null);
    const wrapper = mount(EndgameCoachPanel, { props: { replayHash: 'replay-1' } });
    await flushPromises();
    await wrapper.find('[data-testid="arena-hud-coach-button"]').trigger('click');
    await flushPromises();

    assert.ok(wrapper.find('[data-testid="arena-hud-coach-report"]').exists(), 'the report still renders');
    assert.ok(
      !wrapper.find('[data-testid="arena-hud-coach-table-cooperation"]').exists(),
      'the Table Cooperation block is absent for an empty array',
    );
  });

  test('hides the Table Cooperation block when tableCooperation is omitted (pre-WP-717 report)', async () => {
    // why: COACH_BODY carries no tableCooperation — the shape of a report cached before WP-717.
    restoreFetch = installRoutedFetch(PASS_ENTITLEMENTS, 200, COACH_BODY);
    useAuthStore().setSession('token-abc', null);
    const wrapper = mount(EndgameCoachPanel, { props: { replayHash: 'replay-1' } });
    await flushPromises();
    await wrapper.find('[data-testid="arena-hud-coach-button"]').trigger('click');
    await flushPromises();

    assert.ok(
      !wrapper.find('[data-testid="arena-hud-coach-table-cooperation"]').exists(),
      'the Table Cooperation block is absent when the field is undefined',
    );
  });
});
