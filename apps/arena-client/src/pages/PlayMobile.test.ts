import '../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { setActivePinia, createPinia } from 'pinia';
import { mount } from '@vue/test-utils';
import type { UIState } from '@legendary-arena/game-engine';
import PlayMobile from './PlayMobile.vue';
import { useUiStateStore } from '../stores/uiState';
import type { SubmitMove } from '../components/play/uiMoveName.types';

const noopSubmitMove: SubmitMove = () => undefined;

function snapshot(): UIState {
  return {
    game: {
      phase: 'play',
      turn: 4,
      activePlayerId: 'alice',
      currentStage: 'main',
      hasActedThisTurn: false,
      hasHealedThisTurn: false,
      villainRevealedThisTurn: false,
      lastPlayEffectsFired: 0,
    },
    players: [
      {
        playerId: 'alice',
        deckCount: 18,
        handCount: 0,
        discardCount: 6,
        inPlayCount: 0,
        victoryCount: 0,
        woundCount: 0,
        handCards: [],
        handDisplay: [],
      },
    ],
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
        cost: 6,
      },
      attachedBystanders: [],
      strikePile: [],
      hypnoThralls: [],
    },
    scheme: {
      id: 'core/capture-five-bystanders',
      twistCount: 0,
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
    progress: { bystandersRescued: 0, escapedVillains: 0 },
    decks: { villainDeckCount: 14, heroDeckCount: 42 },
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

describe('PlayMobile (WP-129)', () => {
  test('renders empty-match placeholder when snapshot is null', () => {
    setActivePinia(createPinia());
    const wrapper = mount(PlayMobile, {
      props: { submitMove: noopSubmitMove },
    });
    assert.equal(wrapper.find('[data-testid="play-empty-match"]').exists(), true);
  });

  test('renders the sticky top + sticky bottom bands during play phase', () => {
    setActivePinia(createPinia());
    const store = useUiStateStore();
    store.setSnapshot(snapshot());
    const wrapper = mount(PlayMobile, {
      props: { submitMove: noopSubmitMove },
    });
    assert.equal(wrapper.find('[data-testid="play-mobile-sticky-top"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-mobile-sticky-bottom"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-top-hud-bar"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-turn-action-bar"]').exists(), true);
  });

  test('renders all eight wireframe zones present in §3.2', () => {
    setActivePinia(createPinia());
    const store = useUiStateStore();
    store.setSnapshot(snapshot());
    const wrapper = mount(PlayMobile, {
      props: { submitMove: noopSubmitMove },
    });
    assert.equal(wrapper.find('[data-testid="play-mastermind-tile"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-scheme-tile"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-city-row"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-hq-row"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-shared-decks"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-ko-pile"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-economy-bar"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-hand-row"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-played-row"]').exists(), true);
    // why: WP-318 — the persistent game log is mounted in the live mobile HUD.
    assert.equal(wrapper.find('[data-testid="play-mobile-log"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="game-log-panel"]').exists(), true);
  });

  test('WP-318: the live mobile HUD game log renders the engine log lines verbatim', () => {
    setActivePinia(createPinia());
    const frame = snapshot();
    frame.log = [
      { text: 'Ambush effect: the highest-cost HQ hero was captured (Amulet of Avalon).', outcome: 'neutral' },
    ];
    const store = useUiStateStore();
    store.setSnapshot(frame);
    const wrapper = mount(PlayMobile, { props: { submitMove: noopSubmitMove } });

    const lines = wrapper
      .findAll('[data-testid="play-mobile-log"] [data-testid="game-log-line"]')
      .map((node) => node.text());
    assert.ok(
      lines.some((line) => line.includes('Ambush effect: the highest-cost HQ hero was captured (Amulet of Avalon)')),
      'the Ambush effect narration is visible in the live mobile HUD log',
    );
  });

  test('WP-243: with both pending choices for the viewer, the KO prompt renders ABOVE the hero prompt, both ABOVE TurnActionBar', () => {
    setActivePinia(createPinia());
    const frame = snapshot();
    frame.game.currentStage = 'cleanup';
    frame.pendingHeroChoice = {
      choiceType: 'discard-or-return',
      cardId: 'rev-card',
      playerID: 'alice',
      display: { extId: 'rev-card', name: 'Revealed Card', imageUrl: '', cost: 2 },
    };
    frame.pendingKoHeroChoice = {
      choiceType: 'ko-hero',
      playerID: 'alice',
      remaining: 1,
      eligible: [
        { zone: 'hand', cardId: 'ko-a', display: { extId: 'ko-a', name: 'KO A', imageUrl: '', cost: 1 } },
        { zone: 'discard', cardId: 'ko-b', display: { extId: 'ko-b', name: 'KO B', imageUrl: '', cost: 2 } },
      ],
    };
    const store = useUiStateStore();
    store.setSnapshot(frame);
    const wrapper = mount(PlayMobile, { props: { submitMove: noopSubmitMove } });

    const html = wrapper.html();
    const koIndex = html.indexOf('pending-ko-hero-choice-prompt');
    const heroIndex = html.indexOf('pending-hero-choice-prompt');
    const barIndex = html.indexOf('play-turn-action-bar');

    assert.ok(koIndex >= 0, 'KO prompt renders for the chooser');
    assert.ok(heroIndex >= 0, 'hero prompt renders for the chooser');
    assert.ok(barIndex >= 0, 'turn-action bar renders');
    assert.ok(koIndex < heroIndex, 'KO prompt is above the hero prompt in DOM order');
    assert.ok(heroIndex < barIndex, 'both prompts are above the TurnActionBar in DOM order');
  });
});

describe('PlayMobile Phase-button wiring (WP-783 / D-24629)', () => {
  // why: the page is where economy.phasingOptions becomes HandRow's phasingCardIds
  // prop. A HandRow unit test with an injected prop cannot catch a page that never
  // passes it, so this mounts the real page from a snapshot.
  /**
   * Builds a play-phase snapshot whose viewer holds one Phasing card and one plain card.
   *
   * @returns The snapshot.
   */
  function phasingSnapshot(): UIState {
    const frame = snapshot();
    frame.players[0]!.handCards = ['cvwr/vision/solar-energy#0', 'plain-card'];
    frame.players[0]!.handCount = 2;
    frame.players[0]!.handDisplay = [
      { extId: 'cvwr/vision/solar-energy#0', name: 'Solar Energy', imageUrl: '', cost: 3 },
      { extId: 'plain-card', name: 'Plain Card', imageUrl: '', cost: 2 },
    ];
    return frame;
  }

  test('a snapshot with economy.phasingOptions renders exactly one Phase button', () => {
    setActivePinia(createPinia());
    const store = useUiStateStore();
    const frame = phasingSnapshot();
    frame.economy.phasingOptions = ['cvwr/vision/solar-energy#0'];
    store.setSnapshot(frame);
    const wrapper = mount(PlayMobile, { props: { submitMove: noopSubmitMove } });
    const phaseButtons = wrapper.findAll('[data-testid="play-hand-phase"]');
    assert.equal(phaseButtons.length, 1);
    assert.equal(phaseButtons[0]!.attributes('data-card-id'), 'cvwr/vision/solar-energy#0');
  });

  test('a snapshot without economy.phasingOptions renders no Phase button', () => {
    setActivePinia(createPinia());
    const store = useUiStateStore();
    store.setSnapshot(phasingSnapshot());
    const wrapper = mount(PlayMobile, { props: { submitMove: noopSubmitMove } });
    assert.equal(wrapper.findAll('[data-testid="play-hand-card"]').length, 2, 'the hand is rendered');
    assert.equal(wrapper.findAll('[data-testid="play-hand-phase"]').length, 0);
  });
});
