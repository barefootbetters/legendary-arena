import '../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import type { UIState } from '@legendary-arena/game-engine';
import PlayViewport, { computeCasualCoachMatchId } from './PlayViewport.vue';
import { useVillainSlashVfxSignal } from '../composables/useVillainSlashVfx';
import { useUiStateStore } from '../stores/uiState';
import { loadUiStateFixture } from '../fixtures/uiState/index';
import type { SubmitMove } from '../components/play/uiMoveName.types';
import type { SubmissionStatus } from '../composables/useCompetitiveSubmitOnGameover';
import { flushPromises } from '@vue/test-utils';
import { useAuthStore } from '../stores/auth';
import { after } from 'node:test';
import { STATUS_RETRY_DELAY_MS } from '../services/autoplayPlayback';

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

  // why: D-24650 — the bottom-left utilities share one dock (a row on desktop) so
  // they no longer stack up over the turn bar's Reveal button.
  test('D-24650: the bottom-left utilities render inside the single utility dock', () => {
    setActivePinia(createPinia());
    installMatchMedia(false);
    const wrapper = mount(PlayViewport, {
      props: { submitMove: noopSubmitMove },
    });
    const dock = wrapper.find('[data-testid="play-utility-dock"]');
    assert.equal(dock.exists(), true);
    assert.equal(dock.find('[data-testid="diagnostic-export-button"]').exists(), true);
    assert.equal(wrapper.findAll('[data-testid="diagnostic-export-button"]').length, 1, 'mounted once, inside the dock');
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

  test('mounts the villain-slash producer: a new fightResolved reaches the overlay signal (WP-755)', async () => {
    // why: pins the REQUIRED mount — an injected-renderer unit test cannot catch
    // a producer that was never mounted (the WP-746 lesson).
    useVillainSlashVfxSignal().value = null;
    setActivePinia(createPinia());
    installMatchMedia(false);
    const store = useUiStateStore();
    const first = loadUiStateFixture('mid-turn');
    store.setSnapshot({ ...first, notableEvents: [...(first.notableEvents ?? [])] });
    const wrapper = mount(PlayViewport, {
      props: { submitMove: noopSubmitMove },
    });
    const defeat = {
      type: 'fightResolved',
      playerId: '0',
      cardId: 'villain-mount-test',
      citySpace: 3,
      bystandersRescued: 0,
      appliedEffects: [],
      narrative: 'Player 0 defeats a villain.',
    } as unknown as NonNullable<UIState['notableEvents']>[number];
    store.setSnapshot({ ...first, notableEvents: [...(first.notableEvents ?? []), defeat] });
    await nextTick();
    assert.equal(useVillainSlashVfxSignal().value?.citySpace, 3);
    wrapper.unmount();
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
    // why: D-24630 — an expired session is still headed for scoring after re-login,
    // so it never gets the casual (unscored) coach panel.
    'session-expired': null,
    ineligible: 'match-1',
    'ended-early': null,
    'operator-match': null,
  };

  test('only ineligible yields the match id, for every SubmissionStatus', () => {
    for (const status of Object.keys(EXPECTED_BY_STATUS) as SubmissionStatus[]) {
      assert.equal(
        computeCasualCoachMatchId('match-1', status),
        EXPECTED_BY_STATUS[status],
        status,
      );
    }
    assert.equal(Object.keys(EXPECTED_BY_STATUS).length, 10);
  });

  test('an empty match id yields null even when ineligible', () => {
    assert.equal(computeCasualCoachMatchId('', 'ineligible'), null);
  });
});

describe('PlayViewport operator match (WP-804)', () => {
  const originalFetch = globalThis.fetch;

  // why: PlayDesktop's autoplay-status probe retries a 404 once after
  // STATUS_RETRY_DELAY_MS, past a test's end. The stub stays installed for the
  // whole block and is restored only after that window, so no retry ever
  // reaches the real network.
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, STATUS_RETRY_DELAY_MS + 200));
    globalThis.fetch = originalFetch;
  });

  /**
   * Stub fetch: the eligibility probe answers `eligibilityStatus`; every other
   * request (bot-ally status, build provenance, the panel's board poll) gets a
   * quiet 404. Records every request URL.
   */
  function stubOperatorFetch(eligibilityStatus: number): string[] {
    const urls: string[] = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes('/api/admin/operator-match/eligibility')) {
        return {
          ok: eligibilityStatus === 200,
          status: eligibilityStatus,
          json: async () => ({ isOperator: eligibilityStatus === 200 }),
        } as unknown as Response;
      }
      return { ok: false, status: 404, json: async () => ({}) } as unknown as Response;
    }) as typeof globalThis.fetch;
    return urls;
  }

  /** Put a snapshot in the store, flagged as an operator match when asked. */
  function setSnapshot(isOperatorMatch: boolean): void {
    const snapshot = structuredClone(loadUiStateFixture('mid-turn'));
    if (isOperatorMatch) {
      snapshot.isDebugMatch = true;
    }
    useUiStateStore().setSnapshot(snapshot);
  }

  /** Let the eligibility probe and the lazy panel chunk settle. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i += 1) {
      await flushPromises();
    }
  }

  /** Count the eligibility requests among the recorded URLs. */
  function countEligibilityRequests(urls: string[]): number {
    return urls.filter((url) => url.includes('/api/admin/operator-match/eligibility')).length;
  }

  test('the badge renders in an operator match and not in a normal one', async () => {
    setActivePinia(createPinia());
    installMatchMedia(false);
    stubOperatorFetch(403);
    setSnapshot(true);
    const operatorWrapper = mount(PlayViewport, { props: { submitMove: noopSubmitMove, matchId: 'op-1' } });
    await settle();
    const badge = operatorWrapper.find('[data-testid="operator-match-badge"]');
    assert.equal(badge.exists(), true);
    assert.equal(badge.text(), 'Operator match — not scored');
    operatorWrapper.unmount();

    setActivePinia(createPinia());
    setSnapshot(false);
    const normalWrapper = mount(PlayViewport, { props: { submitMove: noopSubmitMove, matchId: 'm-1' } });
    await settle();
    assert.equal(normalWrapper.find('[data-testid="operator-match-badge"]').exists(), false);
    normalWrapper.unmount();
  });

  test('positive: token + operator match + eligibility 200 + a match id mounts the panel', async () => {
    setActivePinia(createPinia());
    installMatchMedia(false);
    useAuthStore().setSession('admin-token', null);
    const urls = stubOperatorFetch(200);
    setSnapshot(true);
    const wrapper = mount(PlayViewport, { props: { submitMove: noopSubmitMove, matchId: 'op-1' } });
    await settle();
    assert.equal(countEligibilityRequests(urls), 1);
    assert.equal(wrapper.find('[data-testid="operator-board-panel"]').exists(), true);
    wrapper.unmount();
  });

  test('the panel is absent in a normal match, even for an admin', async () => {
    setActivePinia(createPinia());
    installMatchMedia(false);
    useAuthStore().setSession('admin-token', null);
    stubOperatorFetch(200);
    setSnapshot(false);
    const wrapper = mount(PlayViewport, { props: { submitMove: noopSubmitMove, matchId: 'm-1' } });
    await settle();
    assert.equal(wrapper.find('[data-testid="operator-board-panel"]').exists(), false);
    wrapper.unmount();
  });

  test('a non-admin seat (eligibility 403) sees the badge but not the panel', async () => {
    setActivePinia(createPinia());
    installMatchMedia(false);
    useAuthStore().setSession('player-token', null);
    const urls = stubOperatorFetch(403);
    setSnapshot(true);
    const wrapper = mount(PlayViewport, { props: { submitMove: noopSubmitMove, matchId: 'op-1' } });
    await settle();
    assert.equal(countEligibilityRequests(urls), 1, 'the probe ran and answered 403');
    assert.equal(wrapper.find('[data-testid="operator-match-badge"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="operator-board-panel"]').exists(), false);
    wrapper.unmount();
  });

  test('the panel is absent without a match id (the fixture route), even for an eligible admin', async () => {
    setActivePinia(createPinia());
    installMatchMedia(false);
    useAuthStore().setSession('admin-token', null);
    const urls = stubOperatorFetch(200);
    setSnapshot(true);
    const wrapper = mount(PlayViewport, { props: { submitMove: noopSubmitMove } });
    await settle();
    assert.equal(countEligibilityRequests(urls), 1, 'eligible: only the match id is missing');
    assert.equal(wrapper.find('[data-testid="operator-board-panel"]').exists(), false);
    wrapper.unmount();
  });

  test('a normal match with a token makes no eligibility request', async () => {
    setActivePinia(createPinia());
    installMatchMedia(false);
    useAuthStore().setSession('player-token', null);
    const urls = stubOperatorFetch(200);
    setSnapshot(false);
    const wrapper = mount(PlayViewport, { props: { submitMove: noopSubmitMove, matchId: 'm-1' } });
    await settle();
    assert.equal(countEligibilityRequests(urls), 0);
    wrapper.unmount();
  });
});
