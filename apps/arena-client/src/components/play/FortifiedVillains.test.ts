import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import FortifiedVillains from './FortifiedVillains.vue';
import type { UIFortifier, UITurnEconomyState } from '@legendary-arena/game-engine';
import type { SubmitMove, UiMoveName } from './uiMoveName.types';

interface RecordedCall {
  name: UiMoveName;
  args: unknown;
}

/**
 * Records every submitted move.
 *
 * @returns The recorded calls and the submitMove spy.
 */
function recorder(): { calls: RecordedCall[]; submitMove: SubmitMove } {
  const calls: RecordedCall[] = [];
  const submitMove: SubmitMove = (name, args) => {
    calls.push({ name, args });
  };
  return { calls, submitMove };
}

/**
 * Builds a turn economy with the given overrides.
 *
 * @param over - Fields to override.
 * @returns The economy projection.
 */
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

/**
 * Builds Squirrel Girl fortifying the Sidekick Stack.
 *
 * @param over - Fields to override.
 * @returns The fortifier tile projection.
 */
function squirrelGirl(over: Partial<UIFortifier> = {}): UIFortifier {
  return {
    place: 'sidekick-stack',
    placeLabel: 'the Sidekick Stack',
    extId: 'cvwr-villain-great-lakes-avengers-squirrel-girl-00',
    display: { extId: 'cvwr-villain-great-lakes-avengers-squirrel-girl-00', name: 'Squirrel Girl', imageUrl: '', cost: 3 },
    fightCost: 3,
    lockText: "Sidekicks can't be recruited or gained",
    ...over,
  };
}

/**
 * Mounts the strip with one fortifier.
 *
 * @param options - The fortifier, the turn flag and the attack available.
 * @returns The wrapper and the recorded calls.
 */
function mountStrip(options: { fortifier?: UIFortifier; isViewerTurn?: boolean; attack?: number }) {
  const { calls, submitMove } = recorder();
  const attack = options.attack ?? 3;
  const wrapper = mount(FortifiedVillains, {
    props: {
      fortifiers: [options.fortifier ?? squirrelGirl()],
      place: 'sidekick-stack',
      currentStage: 'main',
      isViewerTurn: options.isViewerTurn ?? true,
      economy: economy({ attack, availableAttack: attack }),
      submitMove,
    },
  });
  return { calls, wrapper };
}

describe('FortifiedVillains (WP-873 / D-24818)', () => {
  test('T27: an affordable fortifier on the viewer Main stage submits fightVillain with its place', async () => {
    const { calls, wrapper } = mountStrip({});
    const tile = wrapper.find('[data-testid="play-fortifier"]');
    assert.match(tile.text(), /Squirrel Girl/);
    assert.match(tile.text(), /Fortifying the Sidekick Stack/);
    assert.match(tile.text(), /Sidekicks can't be recruited or gained/);
    const button = wrapper.find('[data-testid="play-fortifier-fight"]');
    assert.equal(button.attributes('disabled'), undefined);
    assert.match(button.text(), /Fight 3/);
    await button.trigger('click');
    assert.deepStrictEqual(calls, [{ name: 'fightVillain', args: { fortifiedPlace: 'sidekick-stack' } }]);
  });

  test('T28: stage, then cost, then restriction disable the button with that reason', async () => {
    const restriction = 'You played more than one card this turn';
    const cases: { label: string; options: Parameters<typeof mountStrip>[0]; reason: string | RegExp }[] = [
      {
        label: 'not your turn (beats cost and restriction)',
        options: { isViewerTurn: false, attack: 0, fortifier: squirrelGirl({ fightRestrictionReason: restriction }) },
        reason: 'It is not your turn.',
      },
      {
        label: 'unaffordable (beats restriction)',
        options: { attack: 2, fortifier: squirrelGirl({ fightRestrictionReason: restriction }) },
        reason: /3/,
      },
      { label: 'restricted', options: { fortifier: squirrelGirl({ fightRestrictionReason: restriction }) }, reason: restriction },
    ];
    for (const testCase of cases) {
      const { calls, wrapper } = mountStrip(testCase.options);
      const button = wrapper.find('[data-testid="play-fortifier-fight"]');
      assert.equal(button.attributes('disabled'), '', `${testCase.label}: disabled`);
      const title = button.attributes('title')!;
      if (typeof testCase.reason === 'string') {
        assert.equal(title, testCase.reason, `${testCase.label}: reason`);
      } else {
        assert.match(title, testCase.reason, `${testCase.label}: reason`);
        assert.notEqual(title, restriction, `${testCase.label}: the cost reason, not the restriction`);
      }
      await button.trigger('click');
      assert.equal(calls.length, 0, `${testCase.label}: a click submits nothing`);
    }
  });

  test('D-24819: only the host place renders, titled with its place and lock; none renders nothing', () => {
    const { submitMove } = recorder();
    const colleenWing: UIFortifier = {
      place: 'mastermind',
      placeLabel: 'the Mastermind',
      extId: 'cvwr-villain-heroes-for-hire-colleen-wing-00',
      display: { extId: 'cvwr-villain-heroes-for-hire-colleen-wing-00', name: 'Colleen Wing', imageUrl: '', cost: 9 },
      fightCost: 9,
      lockText: "the Mastermind can't be fought",
    };
    const atMastermind = mount(FortifiedVillains, {
      props: {
        fortifiers: [squirrelGirl(), colleenWing],
        place: 'mastermind',
        currentStage: 'main',
        economy: economy(),
        submitMove,
      },
    });
    const chips = atMastermind.findAll('[data-testid="play-fortifier"]');
    assert.equal(chips.length, 1, 'only the Mastermind fortifier renders on the Mastermind');
    assert.match(chips[0]!.text(), /Colleen Wing/);
    assert.equal(chips[0]!.attributes('data-place'), 'mastermind');
    assert.equal(
      chips[0]!.attributes('title'),
      "Colleen Wing fortifies the Mastermind: the Mastermind can't be fought. Fight Colleen Wing to end it.",
    );
    const atStackWithNone = mount(FortifiedVillains, {
      props: { fortifiers: [colleenWing], place: 'sidekick-stack', currentStage: 'main', economy: economy(), submitMove },
    });
    assert.equal(atStackWithNone.find('ul').exists(), false, 'no list renders when nothing fortifies the host place');
  });
});
