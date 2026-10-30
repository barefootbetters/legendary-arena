import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import SharedDecks from './SharedDecks.vue';
import type { UISharedPilesState, UITurnEconomyState } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

interface RecordedCall {
  name: UiMoveName;
  args: unknown;
}

function recorder(): { calls: RecordedCall[]; submitMove: SubmitMove } {
  const calls: RecordedCall[] = [];
  const submitMove: SubmitMove = (name, args) => {
    calls.push({ name, args });
  };
  return { calls, submitMove };
}

function piles(over: Partial<UISharedPilesState> = {}): UISharedPilesState {
  return {
    bystandersCount: 27,
    woundsCount: 2,
    horrorsCount: 0,
    officersCount: 30,
    sidekicksCount: 0,
    ...over,
  };
}

function economy(over: Partial<UITurnEconomyState> = {}): UITurnEconomyState {
  return {
    attack: 0,
    recruit: 0,
    availableAttack: 0,
    availableRecruit: 0,
    piercing: 0,
    woundsDrawn: 0,
    ...over,
  };
}

describe('SharedDecks (WP-648 — recruitable S.H.I.E.L.D. Officer supply)', () => {
  test('renders the officers cell as a recruit button with the supply count', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        economy: economy({ recruit: 5, availableRecruit: 5 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    assert.equal(button.exists(), true);
    assert.match(button.text(), /\[30\]/);
  });

  test('clicking the officers cell emits recruitOfficer with an empty payload', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        economy: economy({ recruit: 3, availableRecruit: 3 }),
        submitMove,
      },
    });
    void wrapper.find('[data-testid="play-recruit-officer"]').trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'recruitOfficer');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('disables the officer buy with a stage tooltip when currentStage is not main', () => {
    const { submitMove } = recorder();
    for (const stage of ['start', 'cleanup'] as const) {
      const wrapper = mount(SharedDecks, {
        props: {
          piles: piles(),
          currentStage: stage,
          economy: economy({ recruit: 5, availableRecruit: 5 }),
          submitMove,
        },
      });
      const button = wrapper.find('[data-testid="play-recruit-officer"]');
      assert.equal(button.attributes('disabled'), '');
      assert.match(button.attributes('title')!, /Only available during the Main/);
    }
  });

  test('disables the officer buy with a cost tooltip when recruit is short of 3', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        economy: economy({ recruit: 2, availableRecruit: 2 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /Needs 3 recruit, you have 2/);
  });

  test('disables the officer buy with an empty-supply tooltip when officersCount is 0', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles({ officersCount: 0 }),
        currentStage: 'main',
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /No S\.H\.I\.E\.L\.D\. Officers remain/);
  });

  test('disables the officer buy when it is not the viewer turn', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        isViewerTurn: false,
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /not your turn/i);
  });

  test('renders the projected Officer card face image inside the recruit button', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles({
          officerDisplay: {
            extId: 'pile-shield-officer',
            name: 'S.H.I.E.L.D. Officer',
            imageUrl: 'https://images.legendary-arena.com/core/core-so-officer.webp',
            cost: null,
          },
        }),
        currentStage: 'main',
        economy: economy({ recruit: 5, availableRecruit: 5 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    const image = button.find('[data-testid="card-tile-image"]');
    assert.equal(image.exists(), true, 'the Officer card face image must render');
    assert.equal(
      image.attributes('src'),
      'https://images.legendary-arena.com/core/core-so-officer.webp',
    );
    // the count + buy cost still read alongside the card face
    assert.match(button.text(), /\[30\]/);
    assert.match(button.text(), /Recruit: 3/);
  });

  test('falls back to a text card face when officerDisplay is absent (older snapshots)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        economy: economy({ recruit: 5, availableRecruit: 5 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    // no imageUrl → CardTile renders its text fallback, never a broken <img>
    assert.equal(button.find('[data-testid="card-tile-image"]').exists(), false);
    assert.equal(button.find('[data-testid="card-tile-fallback"]').exists(), true);
  });

  // why: WP-842 / D-24776 — intended behavior change. This case pinned "exactly one
  // recruit button (Officers only)"; the Sidekicks cell is now the second recruit
  // button, so it pins two buttons (Officers, Sidekicks) and three static cells.
  test('the other three supply cells stay static counts (Officers and Sidekicks are buttons)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        economy: economy({ recruit: 5, availableRecruit: 5 }),
        submitMove,
      },
    });
    assert.equal(wrapper.findAll('button').length, 2, 'exactly two recruit buttons (Officers, Sidekicks)');
    assert.equal(wrapper.find('[data-testid="play-recruit-officer"]').exists(), true);
    assert.equal(wrapper.find('[data-testid="play-recruit-sidekick"]').exists(), true);
    for (const staticCell of ['wounds', 'horrors', 'bystanders']) {
      assert.equal(
        wrapper.find(`[data-testid="play-shared-deck-${staticCell}"]`).find('button').exists(),
        false,
        `${staticCell} stays a static count`,
      );
    }
    assert.match(wrapper.find('[data-testid="play-shared-deck-wounds"]').text(), /\[2\]/);
    assert.match(wrapper.find('[data-testid="play-shared-deck-bystanders"]').text(), /\[27\]/);
  });
});

describe('SharedDecks — heal lock (D-24180 / D-24614)', () => {
  test('after a heal the officer buy is disabled with the heal-lock tooltip and a click submits nothing', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles(),
        currentStage: 'main',
        hasHealedThisTurn: true,
        economy: economy({ recruit: 5, availableRecruit: 5 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-officer"]');
    assert.equal(button.attributes('disabled'), '');
    assert.match(button.attributes('title')!, /cannot recruit or fight after healing this turn/);
    assert.match(button.find('[data-testid="card-tile"]').attributes('title')!, /cannot recruit or fight after healing this turn/);
    await button.trigger('click');
    assert.equal(calls.length, 0);
  });
});

describe('SharedDecks — recruitable Sidekick Stack (WP-842 / D-24776)', () => {
  const SIDEKICK_FACE = {
    extId: 'pile-sidekick',
    name: 'Sidekick',
    imageUrl: 'https://images.legendary-arena.com/ssw1/ssw1-sk-sidekick.webp',
    cost: null,
  };

  /** Mounts SharedDecks with a 12-card Sidekick Stack and the given overrides. */
  function mountSidekicks(options: {
    economyOver?: Partial<UITurnEconomyState>;
    pilesOver?: Partial<UISharedPilesState>;
    isViewerTurn?: boolean;
  }) {
    const { calls, submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles({ sidekicksCount: 12, sidekickDisplay: { ...SIDEKICK_FACE }, ...options.pilesOver }),
        currentStage: 'main',
        isViewerTurn: options.isViewerTurn ?? true,
        economy: economy({ recruit: 5, availableRecruit: 5, ...options.economyOver }),
        submitMove,
      },
    });
    return { calls, wrapper };
  }

  test('T21: allowed — the Sidekicks button is enabled, shows the card face, and clicking emits recruitSidekick', async () => {
    const { calls, wrapper } = mountSidekicks({});
    const button = wrapper.find('[data-testid="play-recruit-sidekick"]');
    assert.equal(button.attributes('disabled'), undefined);
    assert.equal(button.attributes('title'), 'Recruit a Sidekick for 2 recruit (once per turn)');
    assert.match(button.text(), /\[12\]/);
    assert.match(button.text(), /Recruit: 2/);
    assert.equal(button.find('[data-testid="card-tile-image"]').exists(), true);
    await button.trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'recruitSidekick');
    assert.deepEqual(calls[0]!.args, {});
  });

  test('T21: each block disables the button with its locked reason, and the Officers button is unaffected', async () => {
    const cases: { label: string; options: Parameters<typeof mountSidekicks>[0]; reason: string }[] = [
      { label: 'already recruited', options: { economyOver: { hasRecruitedSidekickThisTurn: true } }, reason: 'You already recruited a Sidekick this turn.' },
      { label: 'empty Stack', options: { pilesOver: { sidekicksCount: 0 } }, reason: 'No Sidekicks remain in the Sidekick Stack.' },
      { label: '1 recruit', options: { economyOver: { recruit: 1, availableRecruit: 1 } }, reason: 'Needs 2 recruit, you have 1.' },
      { label: 'not your turn', options: { isViewerTurn: false }, reason: 'It is not your turn.' },
    ];
    for (const testCase of cases) {
      const { calls, wrapper } = mountSidekicks(testCase.options);
      const button = wrapper.find('[data-testid="play-recruit-sidekick"]');
      assert.equal(button.attributes('disabled'), '', `${testCase.label}: disabled`);
      assert.equal(button.attributes('title'), testCase.reason, `${testCase.label}: locked reason`);
      await button.trigger('click');
      assert.equal(calls.length, 0, `${testCase.label}: a click submits nothing`);
    }
    const { wrapper } = mountSidekicks({ economyOver: { hasRecruitedSidekickThisTurn: true } });
    assert.equal(
      wrapper.find('[data-testid="play-recruit-officer"]').attributes('disabled'),
      undefined,
      'a Sidekick recruit this turn never disables the Officers button',
    );
  });

  test('T22: falls back to the Sidekick name when sidekickDisplay is absent (older snapshots)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: {
        piles: piles({ sidekicksCount: 12 }),
        currentStage: 'main',
        economy: economy({ recruit: 5, availableRecruit: 5 }),
        submitMove,
      },
    });
    const button = wrapper.find('[data-testid="play-recruit-sidekick"]');
    assert.equal(button.find('[data-testid="card-tile-image"]').exists(), false);
    assert.equal(button.find('[data-testid="card-tile-fallback"]').exists(), true);
    assert.match(button.text(), /Sidekick/);
  });
});

describe('SharedDecks — band stand-up (WP-854 / D-24790)', () => {
  test('without isTiltLiftEnabled the root has no shared-decks--tilt-lift class', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: { piles: piles(), currentStage: 'main', economy: economy(), submitMove },
    });
    assert.equal(wrapper.find('[data-testid="play-shared-decks"]').classes('shared-decks--tilt-lift'), false);
  });

  test('with isTiltLiftEnabled the root has the shared-decks--tilt-lift class', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: { piles: piles(), currentStage: 'main', economy: economy(), submitMove, isTiltLiftEnabled: true },
    });
    assert.equal(wrapper.find('[data-testid="play-shared-decks"]').classes('shared-decks--tilt-lift'), true);
  });
});

describe('SharedDecks — card-face-only recruit piles (desktop)', () => {
  /** Mounts the decks with isCardFaceOnly set and the given economy. */
  function mountCardFace(economyOver: Partial<UITurnEconomyState>) {
    const { submitMove } = recorder();
    return mount(SharedDecks, {
      props: {
        piles: piles({ officersCount: 28, sidekicksCount: 12 }),
        currentStage: 'main',
        economy: economy(economyOver),
        submitMove,
        isCardFaceOnly: true,
      },
    });
  }

  test('without isCardFaceOnly the label stays visible and the card is small', () => {
    const { submitMove } = recorder();
    const wrapper = mount(SharedDecks, {
      props: { piles: piles(), currentStage: 'main', economy: economy({ recruit: 5, availableRecruit: 5 }), submitMove },
    });
    assert.equal(wrapper.find('[data-testid="play-shared-decks"]').classes('shared-decks--card-face'), false);
    const officer = wrapper.find('[data-testid="play-recruit-officer"]');
    assert.equal(officer.find('.shared-decks__name').classes('sr-only'), false);
    assert.equal(officer.find('[data-testid="card-tile"]').classes('card-tile--sm'), true);
  });

  test('card-face-only shows a large card and keeps the label only as screen-reader text', () => {
    const wrapper = mountCardFace({ recruit: 5, availableRecruit: 5 });
    assert.equal(wrapper.find('[data-testid="play-shared-decks"]').classes('shared-decks--card-face'), true);
    for (const testId of ['play-recruit-officer', 'play-recruit-sidekick']) {
      const button = wrapper.find(`[data-testid="${testId}"]`);
      assert.equal(button.find('[data-testid="card-tile"]').classes('card-tile--lg'), true, `${testId}: large card`);
      for (const selector of ['.shared-decks__name', '.shared-decks__count', '.shared-decks__cost']) {
        assert.equal(button.find(selector).classes('sr-only'), true, `${testId} ${selector}: screen-reader only`);
      }
    }
  });

  test('card-face-only puts the name, count and Recruit cost in the card hover text', () => {
    const wrapper = mountCardFace({ recruit: 5, availableRecruit: 5 });
    assert.equal(
      wrapper.find('[data-testid="play-recruit-officer"] [data-testid="card-tile"]').attributes('title'),
      'S.H.I.E.L.D. Officers [28] — Recruit: 3',
    );
    assert.equal(
      wrapper.find('[data-testid="play-recruit-sidekick"] [data-testid="card-tile"]').attributes('title'),
      'Sidekicks [12] — Recruit: 2',
    );
  });

  test('card-face-only adds the disabled reason on its own line of the hover text', () => {
    const wrapper = mountCardFace({ recruit: 1, availableRecruit: 1 });
    assert.equal(
      wrapper.find('[data-testid="play-recruit-officer"] [data-testid="card-tile"]').attributes('title'),
      'S.H.I.E.L.D. Officers [28] — Recruit: 3\nNeeds 3 recruit, you have 1.',
    );
  });
});
