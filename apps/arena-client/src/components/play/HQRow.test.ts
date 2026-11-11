import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, type DOMWrapper } from '@vue/test-utils';
import { nextTick } from 'vue';
import HQRow from './HQRow.vue';
import type {
  UIDecksState,
  UIHQCard,
  UIHQHaunter,
  UIHQState,
  UIPlayerState,
  UITurnEconomyState,
} from '@legendary-arena/game-engine';
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

function hero(extId: string, name: string, cost: number): UIHQCard {
  return {
    extId,
    display: {
      extId,
      name,
      imageUrl: `https://images.legendary-arena.com/${extId}.png`,
      cost,
    },
  };
}

function fullHq(): UIHQState {
  return {
    slots: ['cap-rogers', null, 'iron-man-stark', 'spider-man-parker', null],
    slotDisplay: [
      hero('cap-rogers', 'Captain America', 4),
      null,
      hero('iron-man-stark', 'Iron Man', 6),
      hero('spider-man-parker', 'Spider-Man', 3),
      null,
    ],
  };
}

const DECKS: UIDecksState = { villainDeckCount: 0, heroDeckCount: 42 };

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

describe('HQRow (WP-129 — extends WP-100)', () => {
  test('renders 6-cell row: 5 hero slots + hero deck', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    const empties = wrapper.findAll('[data-testid="play-hq-empty"]');
    assert.equal(heroes.length, 3);
    assert.equal(empties.length, 2);
    assert.equal(wrapper.find('[data-testid="play-hq-hero-deck"]').exists(), true);
  });

  test('hero buttons map hqIndex to engine slot 0..4', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    const indices = heroes.map((b) => b.attributes('data-hq-index'));
    assert.deepEqual(indices, ['0', '2', '3']);
  });

  test('clicking a hero emits recruitHero with hqIndex', () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    void heroes[2]!.trigger('click');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.name, 'recruitHero');
    assert.deepEqual(calls[0]!.args, { hqIndex: 3 });
  });

  test('disables heroes with stage tooltip when currentStage is not main', () => {
    const { submitMove } = recorder();
    for (const stage of ['start', 'cleanup'] as const) {
      const wrapper = mount(HQRow, {
        props: {
          hq: fullHq(),
          decks: DECKS,
          currentStage: stage,
          economy: economy({ recruit: 9, availableRecruit: 9 }),
          submitMove,
        },
      });
      const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
      for (const button of heroes) {
        assert.equal(button.attributes('disabled'), '');
        assert.match(button.attributes('title')!, /Only available during the Main/);
      }
    }
  });

  test('disables heroes with cost tooltip when economy is short (precedence: stage met first)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ recruit: 4, availableRecruit: 4 }),
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    // iron-man costs 6; available=4 → disabled with cost reason
    const ironMan = heroes.find((b) => b.attributes('data-card-id') === 'iron-man-stark');
    assert.notEqual(ironMan, undefined);
    assert.equal(ironMan!.attributes('disabled'), '');
    assert.match(ironMan!.attributes('title')!, /Needs 6 recruit, you have 4/);

    // cap-rogers costs 4; available=4 → enabled
    const cap = heroes.find((b) => b.attributes('data-card-id') === 'cap-rogers');
    assert.equal(cap!.attributes('disabled'), undefined);
  });

  test('hero deck cell reflects decks.heroDeckCount', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: { villainDeckCount: 0, heroDeckCount: 42 },
        currentStage: 'main',
        economy: economy({ availableRecruit: 9 }),
        submitMove,
      },
    });
    assert.match(wrapper.find('[data-testid="play-hq-hero-deck"]').text(), /\[42\]/);
  });
});

describe('HQRow — heal lock (D-24180 / D-24614)', () => {
  test('after a heal every hero is disabled with the heal-lock tooltip and a click submits nothing', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        hasHealedThisTurn: true,
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    assert.equal(heroes.length, 3);
    for (const button of heroes) {
      assert.equal(button.attributes('disabled'), '');
      assert.match(button.attributes('title')!, /cannot recruit or fight after healing this turn/);
      assert.match(button.find('[data-testid="card-tile"]').attributes('title')!, /cannot recruit or fight after healing this turn/);
    }
    await heroes[0]!.trigger('click');
    assert.equal(calls.length, 0);
  });

  test('the heal lock outranks the cost tooltip (turn, stage, heal lock, then resource)', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        hasHealedThisTurn: true,
        economy: economy({ recruit: 0, availableRecruit: 0 }),
        submitMove,
      },
    });
    for (const button of wrapper.findAll('[data-testid="play-hq-hero"]')) {
      assert.match(button.attributes('title')!, /cannot recruit or fight after healing this turn/);
    }
  });

  test('without a heal the affordable heroes stay enabled', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        hasHealedThisTurn: false,
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
      },
    });
    for (const button of wrapper.findAll('[data-testid="play-hq-hero"]')) {
      assert.equal(button.attributes('disabled'), undefined);
    }
    // An enabled tile keeps the card name as its hover text.
    const enabledTiles = wrapper.findAll('[data-testid="play-hq-hero"] [data-testid="card-tile"]');
    assert.deepEqual(
      enabledTiles.map((tile) => tile.attributes('title')),
      ['Captain America', 'Iron Man', 'Spider-Man'],
    );
  });
});

describe('HQRow — a City larger than five spaces (WP-831 / D-24764)', () => {
  test('each extra City space adds a blank leading cell when column-aligned, none otherwise', () => {
    const { submitMove } = recorder();
    const aligned = mount(HQRow, {
      props: { hq: fullHq(), decks: DECKS, currentStage: 'main', economy: economy(), submitMove, isColumnAligned: true, extraCitySpaces: 1 },
    });
    assert.equal(aligned.findAll('[data-testid="play-hq-extra-spacer"]').length, 1);
    assert.equal(aligned.findAll('[data-testid="play-hq-hero"]').length + aligned.findAll('[data-testid="play-hq-empty"]').length, 5, 'the HQ is still five');
    const normal = mount(HQRow, {
      props: { hq: fullHq(), decks: DECKS, currentStage: 'main', economy: economy(), submitMove, isColumnAligned: true },
    });
    assert.equal(normal.findAll('[data-testid="play-hq-extra-spacer"]').length, 0);
  });
});

describe('HQRow — table-perspective hover lift (WP-852 / D-24788)', () => {
  /** Mounts the HQ with the given lift flag (omitted when undefined). */
  function mountLift(isTiltLiftEnabled: boolean | undefined) {
    const { submitMove } = recorder();
    const liftProp = isTiltLiftEnabled === undefined ? {} : { isTiltLiftEnabled };
    return mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ availableRecruit: 9 }),
        submitMove,
        ...liftProp,
      },
    });
  }

  /** Stubs the slot list's scroll metrics and re-measures the fit via a window resize. */
  async function setSlotsFit(slots: Element, isFitting: boolean): Promise<void> {
    const scrollWidth = isFitting ? 300 : 900;
    Object.defineProperty(slots, 'scrollWidth', { value: scrollWidth, configurable: true });
    Object.defineProperty(slots, 'clientWidth', { value: 300, configurable: true });
    window.dispatchEvent(new window.Event('resize'));
    await nextTick();
  }

  test('without isTiltLiftEnabled there is no lift class, and every hero button carries hq-slot__hero', async () => {
    const wrapper = mountLift(undefined);
    await setSlotsFit(wrapper.find('ol.hq-slots').element, true);
    assert.equal(wrapper.find('[data-testid="play-hq-row"]').classes().includes('hq-row--tilt-lift'), false);
    const heroButtons = wrapper.findAll('[data-testid="play-hq-hero"]');
    assert.ok(heroButtons.length > 0, 'the HQ renders hero buttons');
    for (const heroButton of heroButtons) {
      assert.equal(heroButton.classes().includes('hq-slot__hero'), true);
    }
    wrapper.unmount();
  });

  test('with isTiltLiftEnabled and slots that fit, the root gains hq-row--tilt-lift', async () => {
    const wrapper = mountLift(true);
    await setSlotsFit(wrapper.find('ol.hq-slots').element, true);
    assert.equal(wrapper.find('[data-testid="play-hq-row"]').classes().includes('hq-row--tilt-lift'), true);
    wrapper.unmount();
  });

  test('with isTiltLiftEnabled and slots that scroll sideways, the lift class is absent', async () => {
    const wrapper = mountLift(true);
    await setSlotsFit(wrapper.find('ol.hq-slots').element, false);
    assert.equal(wrapper.find('[data-testid="play-hq-row"]').classes().includes('hq-row--tilt-lift'), false);
    wrapper.unmount();
  });
});

describe('HQRow — Size-Changing recruit prices (D-24801)', () => {
  test('a slot whose engine price is lower than its printed cost is enabled and labelled', () => {
    const { submitMove } = recorder();
    const hq: UIHQState = { ...fullHq(), recruitCosts: [4, null, 4, 3, null] };
    const wrapper = mount(HQRow, {
      props: { hq, decks: DECKS, currentStage: 'main', economy: economy({ recruit: 4, availableRecruit: 4 }), submitMove },
    });
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    const ironMan = heroes.find((b) => b.attributes('data-card-id') === 'iron-man-stark');
    assert.equal(ironMan!.attributes('disabled'), undefined, 'printed 6, price 4, 4 available');
    assert.equal(ironMan!.find('[data-testid="play-hq-size-changing-cost"]').text(), 'Costs 4 now');
    const cap = heroes.find((b) => b.attributes('data-card-id') === 'cap-rogers');
    assert.equal(cap!.find('[data-testid="play-hq-size-changing-cost"]').exists(), false, 'no label at the printed price');
  });

  test('a Microscopic price below 0 says it gives Recruit', () => {
    const { submitMove } = recorder();
    const hq: UIHQState = { ...fullHq(), recruitCosts: [4, null, 6, -2, null] };
    const wrapper = mount(HQRow, {
      props: { hq, decks: DECKS, currentStage: 'main', economy: economy(), submitMove },
    });
    const spiderMan = wrapper.findAll('[data-testid="play-hq-hero"]').find((b) => b.attributes('data-card-id') === 'spider-man-parker');
    assert.equal(spiderMan!.attributes('disabled'), undefined, 'a price below 0 needs no recruit');
    assert.equal(spiderMan!.find('[data-testid="play-hq-size-changing-cost"]').text(), 'Costs 0 now, +2 recruit');
  });
});

describe('HQRow — Haunt (WP-759 / D-24587)', () => {
  const HAUNTED_REASON = 'Haunted — exorcise it first';
  const EXORCISE_HEAL_REASON = "You healed this turn — you can't exorcise";
  const PLAYERS: UIPlayerState[] = [
    { playerId: '0', deckCount: 0, handCount: 0, discardCount: 0, inPlayCount: 0, victoryCount: 0, woundCount: 0 },
    { playerId: '1', deckCount: 0, handCount: 0, discardCount: 0, inPlayCount: 0, victoryCount: 0, woundCount: 0 },
  ];

  function metarchus(): UIHQHaunter {
    return {
      kind: 'villain',
      extId: 'mdns-fallen-metarchus',
      display: {
        extId: 'mdns-fallen-metarchus',
        name: 'Metarchus',
        imageUrl: 'https://images.legendary-arena.com/mdns/mdns-vi-fallen-metarchus.webp',
        cost: null,
      },
    };
  }

  // why: slot 0 (cost 4) haunted by a Villain, slot 2 (cost 6) by the Mastermind,
  // slot 4 empty but haunted (the Hero Deck ran dry).
  function hauntedHq(): UIHQState {
    return {
      ...fullHq(),
      slots: ['cap-rogers', null, 'iron-man-stark', 'spider-man-parker', null],
      haunters: [metarchus(), null, { kind: 'mastermind' }, null, { kind: 'mastermind' }],
    };
  }

  function mountHaunted(over: Record<string, unknown> = {}): {
    wrapper: ReturnType<typeof mount>;
    calls: RecordedCall[];
  } {
    const { calls, submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: hauntedHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
        players: PLAYERS,
        viewerPlayerId: '0',
        mastermindName: 'Zarathos',
        ...over,
      },
    });
    return { wrapper, calls };
  }

  function exorciseButton(wrapper: ReturnType<typeof mount>, hqIndex: number): DOMWrapper<Element> {
    return wrapper.find(`[data-testid="play-hq-exorcise"][data-hq-index="${String(hqIndex)}"]`);
  }

  test('with no hq.haunters nothing haunt-related renders and Recruit is unchanged', () => {
    const { submitMove } = recorder();
    const wrapper = mount(HQRow, {
      props: {
        hq: fullHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
        players: PLAYERS,
        viewerPlayerId: '0',
        mastermindName: 'Zarathos',
      },
    });
    assert.equal(wrapper.findAll('[data-testid="play-hq-haunter"]').length, 0);
    assert.equal(wrapper.findAll('[data-testid="play-hq-exorcise"]').length, 0);
    assert.equal(wrapper.find('[data-testid="play-exorcise-chooser"]').exists(), false);
    assert.equal(wrapper.findAll('.hq-slot--haunted').length, 0);
    for (const heroButton of wrapper.findAll('[data-testid="play-hq-hero"]')) {
      assert.equal(heroButton.attributes('disabled'), undefined);
    }
  });

  test('a Villain-haunted slot shows the Villain name and art, never its id', () => {
    const { wrapper } = mountHaunted();
    const strip = wrapper.findAll('[data-testid="play-hq-haunter"]')[0]!;
    assert.equal(strip.attributes('data-haunter-kind'), 'villain');
    assert.equal(strip.attributes('data-haunter-ext-id'), 'mdns-fallen-metarchus');
    assert.match(strip.text(), /Haunted by Metarchus/);
    assert.equal(
      strip.find('img').attributes('src'),
      'https://images.legendary-arena.com/mdns/mdns-vi-fallen-metarchus.webp',
    );
  });

  test('a Mastermind-haunted slot is labelled with mastermindName and carries no ext id', () => {
    const { wrapper } = mountHaunted();
    const strip = wrapper.findAll('[data-testid="play-hq-haunter"]')[1]!;
    assert.equal(strip.attributes('data-haunter-kind'), 'mastermind');
    assert.equal(strip.attributes('data-haunter-ext-id'), undefined);
    assert.match(strip.text(), /Haunted by Zarathos/);
    assert.equal(strip.find('img').exists(), false);
  });

  test('Recruit on a Haunted slot is disabled with the Haunted reason even when affordable', async () => {
    const { wrapper, calls } = mountHaunted();
    const heroes = wrapper.findAll('[data-testid="play-hq-hero"]');
    const haunted = heroes[0]!;
    assert.equal(haunted.attributes('disabled'), '');
    assert.equal(haunted.attributes('title'), HAUNTED_REASON);
    await haunted.trigger('click');
    assert.equal(calls.length, 0);
    // why: the unhaunted Spider-Man (slot 3) stays recruitable.
    assert.equal(heroes[2]!.attributes('disabled'), undefined);
  });

  test('Recruit precedence: turn and stage, then the heal lock, outrank Haunted', () => {
    const offTurn = mountHaunted({ isViewerTurn: false }).wrapper;
    assert.equal(offTurn.findAll('[data-testid="play-hq-hero"]')[0]!.attributes('title'), 'It is not your turn.');
    const healed = mountHaunted({ hasHealedThisTurn: true }).wrapper;
    assert.equal(
      healed.findAll('[data-testid="play-hq-hero"]')[0]!.attributes('title'),
      'You cannot recruit or fight after healing this turn.',
    );
  });

  test('Haunted outranks the resource reason, and holds when no display is projected', () => {
    const poor = mountHaunted({ economy: economy({ recruit: 0, availableRecruit: 0 }) }).wrapper;
    assert.equal(poor.findAll('[data-testid="play-hq-hero"]')[0]!.attributes('title'), HAUNTED_REASON);
    const hq: UIHQState = { slots: ['cap-rogers', null, null, null, null], haunters: [metarchus(), null, null, null, null] };
    const noDisplay = mountHaunted({ hq }).wrapper;
    const heroButton = noDisplay.find('[data-testid="play-hq-hero"]');
    assert.equal(heroButton.attributes('disabled'), '');
    assert.equal(heroButton.attributes('title'), HAUNTED_REASON);
    assert.equal(exorciseButton(noDisplay, 0).text(), 'Exorcise');
    assert.equal(exorciseButton(noDisplay, 0).attributes('disabled'), undefined);
  });

  test('Exorcise shows the Hero cost and is enabled on the viewer\'s main step with enough recruit', () => {
    const { wrapper } = mountHaunted();
    const button = exorciseButton(wrapper, 0);
    assert.equal(button.text(), 'Exorcise (4)');
    assert.equal(button.attributes('disabled'), undefined);
    assert.equal(exorciseButton(wrapper, 2).text(), 'Exorcise (6)');
  });

  test('Exorcise is disabled with the turn, stage, heal-lock and resource reasons, in that order', () => {
    const offTurn = exorciseButton(mountHaunted({ isViewerTurn: false }).wrapper, 0);
    assert.equal(offTurn.attributes('disabled'), '');
    assert.equal(offTurn.attributes('title'), 'It is not your turn.');
    const atStart = exorciseButton(mountHaunted({ currentStage: 'start' }).wrapper, 0);
    assert.equal(atStart.attributes('disabled'), '');
    assert.match(atStart.attributes('title')!, /Only available during the Main/);
    const healed = exorciseButton(
      mountHaunted({ hasHealedThisTurn: true, economy: economy({ recruit: 0, availableRecruit: 0 }) }).wrapper,
      0,
    );
    assert.equal(healed.attributes('disabled'), '');
    assert.equal(healed.attributes('title'), EXORCISE_HEAL_REASON);
    const poor = exorciseButton(mountHaunted({ economy: economy({ recruit: 5, availableRecruit: 5 }) }).wrapper, 2);
    assert.equal(poor.attributes('disabled'), '');
    assert.equal(poor.attributes('title'), 'Needs 6 recruit, you have 5.');
  });

  test('Exorcise gates on the printed cost, not a lower Size-Changing recruit price', () => {
    const hq: UIHQState = { ...hauntedHq(), recruitCosts: [4, null, 2, 3, null] };
    const { wrapper } = mountHaunted({ hq, economy: economy({ recruit: 3, availableRecruit: 3 }) });
    const button = exorciseButton(wrapper, 2);
    assert.equal(button.text(), 'Exorcise (6)');
    assert.equal(button.attributes('disabled'), '');
    assert.equal(button.attributes('title'), 'Needs 6 recruit, you have 3.');
  });

  test('no Exorcise renders for a spectator or on a haunted empty slot', () => {
    const spectator = mountHaunted({ viewerPlayerId: null }).wrapper;
    assert.equal(spectator.findAll('[data-testid="play-hq-exorcise"]').length, 0);
    assert.equal(spectator.findAll('[data-testid="play-hq-haunter"]').length, 3);
    const { wrapper } = mountHaunted();
    assert.equal(exorciseButton(wrapper, 4).exists(), false);
    const emptyHaunted = wrapper.find('[data-testid="play-hq-empty"][data-hq-index="4"]').element.parentElement!;
    assert.ok(emptyHaunted.querySelector('[data-testid="play-hq-haunter"]'), 'the empty slot still shows its haunter');
  });

  test('Exorcise is a sibling of the card button, and the chooser renders below the slot list', async () => {
    const { wrapper } = mountHaunted();
    const button = exorciseButton(wrapper, 0);
    assert.equal(button.element.closest('[data-testid="play-hq-hero"]'), null);
    await button.trigger('click');
    const chooser = wrapper.find('[data-testid="play-exorcise-chooser"]');
    assert.equal(chooser.exists(), true);
    assert.equal(chooser.element.closest('ol'), null);
    assert.equal(chooser.element.previousElementSibling?.tagName, 'OL');
    assert.equal(button.attributes('aria-expanded'), 'true');
  });

  test('KO submits exorciseHauntedHero with no recipient, and the chooser closes', async () => {
    const { wrapper, calls } = mountHaunted();
    await exorciseButton(wrapper, 0).trigger('click');
    await wrapper.find('[data-testid="play-exorcise-ko"]').trigger('click');
    assert.deepEqual(calls, [{ name: 'exorciseHauntedHero', args: { hqIndex: 0, outcome: 'ko' } }]);
    assert.equal(wrapper.find('[data-testid="play-exorcise-chooser"]').exists(), false);
  });

  test('Give lists the viewer first as "You", then the other seats, and submits the recipient', async () => {
    const { wrapper, calls } = mountHaunted({ viewerPlayerId: '1' });
    await exorciseButton(wrapper, 0).trigger('click');
    const gives = wrapper.findAll('[data-testid="play-exorcise-give"]');
    assert.deepEqual(
      gives.map((give) => [give.attributes('data-recipient-id'), give.text()]),
      [['1', 'You'], ['0', 'Player 1']],
    );
    await gives[1]!.trigger('click');
    assert.deepEqual(calls, [
      { name: 'exorciseHauntedHero', args: { hqIndex: 0, outcome: 'gain', recipientPlayerId: '0' } },
    ]);
  });

  test('Escape closes the chooser and returns focus to the Exorcise button', async () => {
    const { calls, submitMove } = recorder();
    const wrapper = mount(HQRow, {
      attachTo: document.body,
      props: {
        hq: hauntedHq(),
        decks: DECKS,
        currentStage: 'main',
        economy: economy({ recruit: 9, availableRecruit: 9 }),
        submitMove,
        players: PLAYERS,
        viewerPlayerId: '0',
        mastermindName: 'Zarathos',
      },
    });
    await exorciseButton(wrapper, 0).trigger('click');
    await nextTick();
    assert.equal(document.activeElement, wrapper.find('[data-testid="play-exorcise-ko"]').element);
    await wrapper.find('[data-testid="play-exorcise-ko"]').trigger('keydown', { key: 'Escape' });
    await nextTick();
    await nextTick();
    assert.equal(wrapper.find('[data-testid="play-exorcise-chooser"]').exists(), false);
    assert.equal(document.activeElement, exorciseButton(wrapper, 0).element);
    assert.equal(calls.length, 0);
    wrapper.unmount();
  });

  test('a new HQ snapshot closes an open chooser', async () => {
    const { wrapper } = mountHaunted();
    await exorciseButton(wrapper, 0).trigger('click');
    assert.equal(wrapper.find('[data-testid="play-exorcise-chooser"]').exists(), true);
    await wrapper.setProps({ hq: hauntedHq() });
    assert.equal(wrapper.find('[data-testid="play-exorcise-chooser"]').exists(), false);
  });
});
