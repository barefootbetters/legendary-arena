import '../testing/jsdom-setup';

import { describe, test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import type { UIState } from '@legendary-arena/game-engine';

import BattlePlanPanel from './BattlePlanPanel.vue';
import { useAuthStore } from '../stores/auth';
import { useUiStateStore } from '../stores/uiState';

/**
 * Tests for the in-match Battle Plan panel (WP-637 / EC-672). jsdom +
 * @vue/test-utils mount; `globalThis.fetch` (the plan poll + the save PUT) is
 * stubbed and the `useUiStateStore` snapshot drives the D-24450 lifecycle gating.
 * Covers the render-gate (no `?match=`), the collapsed toggle, the three phase
 * editors, the active-phase highlight, the save PUT, and the phase gating.
 */

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;

interface StubResponse {
  status: number;
  body: unknown;
}
let routeHandler: (url: string, init: RequestInit) => StubResponse;

/** A minimal UIState with the given phase (+ optional gameOver) for gating. */
function snapshotFor(phase: string, isOver: boolean = false): UIState {
  const base = {
    game: {
      phase,
      turn: phase === 'play' ? 1 : 0,
      activePlayerId: '0',
      currentStage: 'main',
      hasActedThisTurn: false,
      hasHealedThisTurn: false,
      lastPlayEffectsFired: 0,
    },
  } as unknown as UIState;
  if (isOver) {
    (base as { gameOver?: unknown }).gameOver = { winners: [] };
  }
  return base;
}

function planBody(overrides: Record<string, unknown> = {}): unknown {
  return {
    battlePlan: {
      matchId: 'm1',
      preBattle: null,
      battleAdjustments: null,
      postBattle: null,
      updatedAt: '2026-09-02T00:00:00.000Z',
      ...overrides,
    },
  };
}

function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

function installStubs(): void {
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const { status, body } = routeHandler(String(url), init ?? {});
    return {
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    } as Response;
  }) as typeof globalThis.fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Mount with a fresh Pinia + the given lifecycle snapshot; optionally sign in. */
function mountPanel(token: string | null, snapshot: UIState | null) {
  setActivePinia(createPinia());
  if (token !== null) {
    useAuthStore().token = token;
  }
  useUiStateStore().setSnapshot(snapshot);
  return mount(BattlePlanPanel);
}

describe('BattlePlanPanel', () => {
  test('is not rendered outside a live match (no ?match=)', async () => {
    setSearch('');
    routeHandler = () => ({ status: 200, body: planBody() });
    installStubs();
    const wrapper = mountPanel('tok', snapshotFor('play'));
    await flushPromises();
    assert.equal(wrapper.find('[data-testid="battle-plan"]').exists(), false);
  });

  test('renders collapsed to a toggle by default; opening shows the three phases', async () => {
    setSearch('?match=m1');
    routeHandler = () => ({ status: 200, body: planBody() });
    installStubs();
    const wrapper = mountPanel('tok', snapshotFor('play'));
    await flushPromises();
    assert.ok(wrapper.find('[data-testid="battle-plan-toggle"]').exists());
    assert.equal(wrapper.find('[data-testid="battle-plan-body"]').exists(), false);
    await wrapper.find('[data-testid="battle-plan-toggle"]').trigger('click');
    await flushPromises();
    assert.ok(wrapper.find('[data-testid="battle-plan-phase-pre_battle"]').exists());
    assert.ok(wrapper.find('[data-testid="battle-plan-phase-battle_adjustments"]').exists());
    assert.ok(wrapper.find('[data-testid="battle-plan-phase-post_battle"]').exists());
  });

  test('seeds the pre-battle textarea from the polled document', async () => {
    setSearch('?match=m1');
    routeHandler = () => ({ status: 200, body: planBody({ preBattle: 'Focus the mastermind.' }) });
    installStubs();
    const wrapper = mountPanel('tok', snapshotFor('play'));
    await flushPromises();
    await wrapper.find('[data-testid="battle-plan-toggle"]').trigger('click');
    await flushPromises();
    const textarea = wrapper.find('[data-testid="battle-plan-textarea-pre_battle"]')
      .element as HTMLTextAreaElement;
    assert.equal(textarea.value, 'Focus the mastermind.');
  });

  test('battle_adjustments is disabled (locked) while the match is not in play', async () => {
    setSearch('?match=m1');
    routeHandler = () => ({ status: 200, body: planBody() });
    installStubs();
    const wrapper = mountPanel('tok', snapshotFor('setup'));
    await flushPromises();
    await wrapper.find('[data-testid="battle-plan-toggle"]').trigger('click');
    await flushPromises();
    const preTextarea = wrapper.find('[data-testid="battle-plan-textarea-pre_battle"]')
      .element as HTMLTextAreaElement;
    const adjTextarea = wrapper.find('[data-testid="battle-plan-textarea-battle_adjustments"]')
      .element as HTMLTextAreaElement;
    assert.equal(preTextarea.disabled, false, 'pre_battle is editable when shown');
    assert.equal(adjTextarea.disabled, true, 'battle_adjustments is locked before play');
  });

  test('highlights the active phase (battle_adjustments in play)', async () => {
    setSearch('?match=m1');
    routeHandler = () => ({ status: 200, body: planBody() });
    installStubs();
    const wrapper = mountPanel('tok', snapshotFor('play'));
    await flushPromises();
    await wrapper.find('[data-testid="battle-plan-toggle"]').trigger('click');
    await flushPromises();
    const active = wrapper.find('[data-testid="battle-plan-phase-battle_adjustments"]');
    assert.ok(active.classes().includes('battle-plan-phase--active'));
  });

  test('Save PUTs the edited phase with the bearer and confirms', async () => {
    setSearch('?match=m1');
    const puts: { url: string; init: RequestInit }[] = [];
    routeHandler = (url, init) => {
      if (url.endsWith('/api/match/m1/battle-plan') && init.method === 'PUT') {
        puts.push({ url, init });
        return { status: 200, body: planBody({ preBattle: 'Focus the mastermind.' }) };
      }
      return { status: 200, body: planBody() };
    };
    installStubs();
    const wrapper = mountPanel('tok', snapshotFor('play'));
    await flushPromises();
    await wrapper.find('[data-testid="battle-plan-toggle"]').trigger('click');
    await flushPromises();
    await wrapper
      .find('[data-testid="battle-plan-textarea-pre_battle"]')
      .setValue('Focus the mastermind.');
    await wrapper.find('[data-testid="battle-plan-save-pre_battle"]').trigger('click');
    await flushPromises();
    assert.equal(puts.length, 1);
    assert.equal(
      (puts[0]!.init.headers as Record<string, string>).Authorization,
      'Bearer tok',
    );
    assert.deepEqual(JSON.parse(String(puts[0]!.init.body)), {
      phase: 'pre_battle',
      text: 'Focus the mastermind.',
    });
    assert.ok(wrapper.find('[data-testid="battle-plan-confirm"]').exists());
  });

  test('a 403 not_a_participant save shows the participant-only line', async () => {
    setSearch('?match=m1');
    routeHandler = (url, init) => {
      if (url.endsWith('/api/match/m1/battle-plan') && init.method === 'PUT') {
        return { status: 403, body: { error: 'not_a_participant' } };
      }
      return { status: 200, body: planBody() };
    };
    installStubs();
    const wrapper = mountPanel('tok', snapshotFor('play'));
    await flushPromises();
    await wrapper.find('[data-testid="battle-plan-toggle"]').trigger('click');
    await flushPromises();
    await wrapper
      .find('[data-testid="battle-plan-textarea-pre_battle"]')
      .setValue('Anything.');
    await wrapper.find('[data-testid="battle-plan-save-pre_battle"]').trigger('click');
    await flushPromises();
    const error = wrapper.find('[data-testid="battle-plan-error"]');
    assert.ok(error.exists());
    assert.match(error.text(), /seated in this match/i);
  });
});
