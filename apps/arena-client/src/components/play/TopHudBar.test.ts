import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import type { UIState } from '@legendary-arena/game-engine';
import TopHudBar from './TopHudBar.vue';

function fixture(overrides: Partial<UIState['game']> = {}): UIState {
  return {
    game: {
      phase: 'play',
      turn: 4,
      activePlayerId: 'alice',
      currentStage: 'main',
      hasActedThisTurn: false,
      hasHealedThisTurn: false,
      lastPlayEffectsFired: 0,
      ...overrides,
    },
    players: [],
    city: { spaces: [null, null, null, null, null], escapedPile: [] },
    hq: { slots: [null, null, null, null, null] },
    mastermind: {
      id: 'core/loki',
      tacticsRemaining: 3,
      tacticsDefeated: 1,
      display: {
        extId: 'mastermind-loki',
        name: 'Loki',
        imageUrl: 'https://images.legendary-arena.com/loki.png',
        cost: null,
      },
      attachedBystanders: [],
      strikePile: [],
    },
    scheme: {
      id: 'core/capture-five-bystanders',
      twistCount: 2,
      twistPile: [],
    },
    economy: {
      attack: 0,
      recruit: 0,
      availableAttack: 0,
      availableRecruit: 0,
      piercing: 0,
      woundsDrawn: 0,
    },
    log: [],
    progress: { bystandersRescued: 1, escapedVillains: 3 },
    decks: { villainDeckCount: 14, heroDeckCount: 0 },
    piles: {
      bystandersCount: 12,
      woundsCount: 24,
      horrorsCount: 0,
      officersCount: 22,
      sidekicksCount: 13,
    },
    koPile: { count: 0, topCard: null, cards: [] },
    notableEvents: [],
    villainAttachedHeroes: {},
  };
}

describe('TopHudBar (WP-129)', () => {
  test('renders phase / turn / active / stage', () => {
    setActivePinia(createPinia());
    const wrapper = mount(TopHudBar, {
      props: {
        snapshot: fixture(),
        mastermindTacticsTotal: 4,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-hud-turn"]').text(), 'Turn 4');
    assert.equal(wrapper.find('[data-testid="play-hud-active"]').text(), 'Active: alice');
    assert.equal(wrapper.find('[data-testid="play-hud-stage"]').text(), 'main');
  });

  test('renders twist + mastermind + bystanders + escaped counters', () => {
    setActivePinia(createPinia());
    const wrapper = mount(TopHudBar, {
      props: {
        snapshot: fixture(),
        mastermindTacticsTotal: 4,
      },
    });
    // why: WP-562 — this fixture projects no `schemeTwistThreshold`, so the
    // readout degrades to the bare count rather than inventing a denominator.
    // The threshold-present case is asserted in the WP-562 block below.
    assert.equal(wrapper.find('[data-testid="play-hud-twists"]').text(), 'Twists: 2');
    assert.equal(wrapper.find('[data-testid="play-hud-strikes"]').text(), 'Strikes: 1/4');
    assert.match(wrapper.find('[data-testid="play-hud-bystanders"]').text(), /Rescued: 1/);
    assert.equal(wrapper.find('[data-testid="play-hud-escaped"]').text(), 'Escaped: 3');
  });

  test('falls back to "pending" when activePlayerId is empty', () => {
    setActivePinia(createPinia());
    const wrapper = mount(TopHudBar, {
      props: {
        snapshot: fixture({ activePlayerId: '' }),
        mastermindTacticsTotal: 4,
      },
    });
    assert.equal(wrapper.find('[data-testid="play-hud-active"]').text(), 'Active: pending');
  });

  test('mounts WP-130 <SkinSelector> in the D-12907 reserved slot when no slot content provided', () => {
    setActivePinia(createPinia());
    const wrapper = mount(TopHudBar, {
      props: {
        snapshot: fixture(),
        mastermindTacticsTotal: 4,
      },
    });
    const selectorButton = wrapper.find('[data-testid="play-hud-skin-selector-button"]');
    assert.equal(selectorButton.exists(), true);
    assert.match(selectorButton.text(), /Skin: classic/);
  });
});

describe('TopHudBar (WP-562) — the twist readout regains its denominator', () => {
  /**
   * Builds a snapshot whose progress block carries a projected twist threshold.
   *
   * @param progressOverrides - Progress fields to layer onto the base fixture.
   * @returns A UIState with the merged progress block.
   */
  function fixtureWithProgress(
    progressOverrides: Partial<UIState['progress']>,
  ): UIState {
    const snapshot = fixture();
    snapshot.progress = { ...snapshot.progress, ...progressOverrides };
    return snapshot;
  }

  test('AC-6: renders Twists: N/M from the projected twist threshold', () => {
    setActivePinia(createPinia());
    const wrapper = mount(TopHudBar, {
      props: {
        snapshot: fixtureWithProgress({ schemeTwistThreshold: 8 }),
        mastermindTacticsTotal: 4,
      },
    });

    assert.equal(wrapper.find('[data-testid="play-hud-twists"]').text(), 'Twists: 2/8');
  });

  test('AC-6: uses the TWIST threshold, never the resource loss threshold', () => {
    // why: D-24371 §5 and the whole reason the field is projected separately.
    // Negative Zone's loss threshold is 12 ESCAPED VILLAINS; reading it here
    // renders `Twists: 2/12` — a new wrong number in place of the old one.
    setActivePinia(createPinia());
    const wrapper = mount(TopHudBar, {
      props: {
        snapshot: fixtureWithProgress({
          schemeLossThreshold: 12,
          schemeTwistThreshold: 8,
        }),
        mastermindTacticsTotal: 4,
      },
    });

    const text = wrapper.find('[data-testid="play-hud-twists"]').text();
    assert.equal(text, 'Twists: 2/8');
    assert.equal(text.includes('12'), false);
  });

  test('AC-7: a solo Civil War state reads 8, the value the engine projected', () => {
    setActivePinia(createPinia());
    const wrapper = mount(TopHudBar, {
      props: {
        snapshot: fixtureWithProgress({
          schemeTwistThreshold: 8,
          schemeLossKind: 'hero-deck',
          schemeLossProgress: 31,
          schemeLossThreshold: 42,
        }),
        mastermindTacticsTotal: 4,
      },
    });

    assert.equal(wrapper.find('[data-testid="play-hud-twists"]').text(), 'Twists: 2/8');
  });

  test('never substitutes a default denominator when none is projected', () => {
    // why: the hardcoded `/8` WP-558 removed. A `?? 8` or `?? 7` in this path
    // would reintroduce it by the back door, and it would look right in exactly
    // the matches where it happens to be correct.
    setActivePinia(createPinia());
    const wrapper = mount(TopHudBar, {
      props: { snapshot: fixture(), mastermindTacticsTotal: 4 },
    });

    const text = wrapper.find('[data-testid="play-hud-twists"]').text();
    assert.equal(text.includes('/'), false);
  });
});
