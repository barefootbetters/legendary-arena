// why: jsdom globals must be installed before Vue's mount() is called.
import '../testing/jsdom-setup';

import { test, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { defineComponent } from 'vue';
import { setActivePinia, createPinia } from 'pinia';
import { mount, flushPromises, enableAutoUnmount } from '@vue/test-utils';
import type { UIState } from '@legendary-arena/game-engine';

import { useBattlePlan, BATTLE_PLAN_POLL_INTERVAL_MS } from './useBattlePlan';
import { useUiStateStore } from '../stores/uiState';

/**
 * Tests for the Battle Plan poll + gating composable (WP-637 / EC-672). It reads
 * `GET /api/match/:id/battle-plan`, so a `globalThis.fetch` stub drives it, and it
 * reads the `useUiStateStore` snapshot for the D-24450 lifecycle gating. The
 * composable uses onMounted/onUnmounted, so it runs inside a mounted harness.
 */

enableAutoUnmount(afterEach);

const originalFetch = globalThis.fetch;

/** A minimal UIState with the given phase/turn (+ optional gameOver) for gating. */
function snapshotFor(
  phase: string,
  turn: number,
  isOver: boolean = false,
): UIState {
  const base = {
    game: {
      phase,
      turn,
      activePlayerId: '0',
      currentStage: 'main',
      hasActedThisTurn: false,
      hasHealedThisTurn: false,
      lastPlayEffectsFired: 0,
    },
  } as unknown as UIState;
  if (isOver) {
    // why: gameOver presence is the "match over" signal (WP-502 precedent).
    (base as { gameOver?: unknown }).gameOver = { winners: [] };
  }
  return base;
}

/** Stub fetch to return a canned battle-plan GET/PUT body. */
function stubPlan(body: unknown): void {
  globalThis.fetch = (async () =>
    ({ status: 200, json: async () => body }) as Response) as typeof globalThis.fetch;
}

/** Stub fetch to throw (transport failure). */
function stubThrow(): void {
  globalThis.fetch = (async () => {
    throw new Error('Simulated battle-plan fetch failure.');
  }) as typeof globalThis.fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.timers.reset();
});

// why: @vue/test-utils' `wrapper.vm` proxy UNWRAPS the refs returned from setup,
// so on the vm each ref is its plain value (not a `Ref`); functions pass through.
interface HarnessVm {
  preBattle: string;
  battleAdjustments: string;
  postBattle: string;
  isLoaded: boolean;
  canEditPreBattle: boolean;
  canEditBattleAdjustments: boolean;
  canEditPostBattle: boolean;
  activePhase: string;
  savePhase: (phase: string, text: string) => Promise<{ ok: boolean; code: string | null }>;
}

/** Mount a harness exposing the composable's refs on `vm`, with a fresh Pinia. */
function mountBattlePlan(matchId: string, snapshot: UIState | null) {
  setActivePinia(createPinia());
  useUiStateStore().setSnapshot(snapshot);
  const Harness = defineComponent({
    setup() {
      return useBattlePlan(matchId);
    },
    render() {
      return null;
    },
  });
  return mount(Harness);
}

test('loads the three phases from the first poll', async () => {
  stubPlan({
    battlePlan: {
      matchId: 'm1',
      preBattle: 'Focus the mastermind.',
      battleAdjustments: null,
      postBattle: null,
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
  });
  const wrapper = mountBattlePlan('m1', snapshotFor('setup', 0));
  await flushPromises();
  const vm = wrapper.vm as unknown as HarnessVm;
  assert.equal(vm.preBattle, 'Focus the mastermind.');
  assert.equal(vm.battleAdjustments, '');
  assert.equal(vm.isLoaded, true);
});

test('an empty matchId disables polling (no fetch)', async () => {
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return { status: 200, json: async () => ({ battlePlan: null }) } as Response;
  }) as typeof globalThis.fetch;
  const wrapper = mountBattlePlan('', snapshotFor('play', 1));
  await flushPromises();
  const vm = wrapper.vm as unknown as HarnessVm;
  assert.equal(fetchCalls, 0);
  assert.equal(vm.isLoaded, false);
});

test('battle_adjustments is LOCKED while the match is not in the play phase', async () => {
  stubPlan({ battlePlan: null });
  const wrapper = mountBattlePlan('m1', snapshotFor('setup', 0));
  await flushPromises();
  const vm = wrapper.vm as unknown as HarnessVm;
  // pre_battle is always editable; battle_adjustments / post_battle are not yet.
  assert.equal(vm.canEditPreBattle, true);
  assert.equal(vm.canEditBattleAdjustments, false);
  assert.equal(vm.canEditPostBattle, false);
  assert.equal(vm.activePhase, 'pre_battle');
});

test('battle_adjustments opens once the match enters the play phase', async () => {
  stubPlan({ battlePlan: null });
  const wrapper = mountBattlePlan('m1', snapshotFor('play', 1));
  await flushPromises();
  const vm = wrapper.vm as unknown as HarnessVm;
  assert.equal(vm.canEditBattleAdjustments, true);
  assert.equal(vm.canEditPostBattle, false);
  assert.equal(vm.activePhase, 'battle_adjustments');
});

test('a reached phase never re-locks when the snapshot moves on', async () => {
  stubPlan({ battlePlan: null });
  const wrapper = mountBattlePlan('m1', snapshotFor('play', 3));
  await flushPromises();
  const vm = wrapper.vm as unknown as HarnessVm;
  assert.equal(vm.canEditBattleAdjustments, true);
  // the match ends: phase 'end' would drop game.phase !== 'play', but the editor
  // must stay open (the latch). gameOver also opens post_battle.
  useUiStateStore().setSnapshot(snapshotFor('end', 3, true));
  await flushPromises();
  assert.equal(vm.canEditBattleAdjustments, true, 'battle_adjustments stays editable');
  assert.equal(vm.canEditPostBattle, true);
  assert.equal(vm.activePhase, 'post_battle');
});

test('a failed poll preserves the last snapshot', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  stubPlan({
    battlePlan: {
      matchId: 'm1',
      preBattle: 'Keep this.',
      battleAdjustments: null,
      postBattle: null,
      updatedAt: '2026-09-02T00:00:00.000Z',
    },
  });
  const wrapper = mountBattlePlan('m1', snapshotFor('play', 1));
  await flushPromises();
  const vm = wrapper.vm as unknown as HarnessVm;
  assert.equal(vm.preBattle, 'Keep this.', 'first poll loaded the text');

  // the next poll fails — the loaded text must not blank
  stubThrow();
  mock.timers.tick(BATTLE_PLAN_POLL_INTERVAL_MS);
  await flushPromises();
  assert.equal(vm.preBattle, 'Keep this.', 'a failed poll preserves the last snapshot');
});

test('unmount clears the poll interval (no fetch after unmount)', async () => {
  mock.timers.enable({ apis: ['setInterval'] });
  let fetchCalls = 0;
  globalThis.fetch = (async () => {
    fetchCalls += 1;
    return { status: 200, json: async () => ({ battlePlan: null }) } as Response;
  }) as typeof globalThis.fetch;
  const wrapper = mountBattlePlan('m1', snapshotFor('play', 1));
  await flushPromises();
  const afterMount = fetchCalls;
  wrapper.unmount();
  mock.timers.tick(BATTLE_PLAN_POLL_INTERVAL_MS * 2);
  await flushPromises();
  assert.equal(fetchCalls, afterMount, 'no further polls fire after unmount');
});

test('savePhase PUTs the phase and refreshes the loaded text', async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return {
      status: 200,
      json: async () => ({
        battlePlan: {
          matchId: 'm1',
          preBattle: null,
          battleAdjustments: 'Shift to villains.',
          postBattle: null,
          updatedAt: '2026-09-02T00:00:00.000Z',
        },
      }),
    } as Response;
  }) as typeof globalThis.fetch;
  const wrapper = mountBattlePlan('m1', snapshotFor('play', 1));
  await flushPromises();
  const vm = wrapper.vm as unknown as HarnessVm;
  const outcome = await vm.savePhase('battle_adjustments', 'Shift to villains.');
  assert.equal(outcome.ok, true);
  assert.equal(vm.battleAdjustments, 'Shift to villains.');
  const putCall = calls.find((call) => call.init.method === 'PUT');
  assert.ok(putCall);
  assert.deepEqual(JSON.parse(String(putCall.init.body)), {
    phase: 'battle_adjustments',
    text: 'Shift to villains.',
  });
});
