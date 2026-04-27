import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import TurnActionBar from './TurnActionBar.vue';
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

describe('TurnActionBar (WP-100)', () => {

test('TurnActionBar Draw click emits drawCards with count 6', () => {
  const { calls, submitMove } = recorder();
  const wrapper = mount(TurnActionBar, {
    props: {
      currentStage: 'main',
      submitMove,
    },
  });

  void wrapper.find('[data-testid="play-action-draw"]').trigger('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'drawCards');
  assert.deepEqual(calls[0]!.args, { count: 6 });
});

test('TurnActionBar End Turn click emits endTurn with an empty-object payload', () => {
  const { calls, submitMove } = recorder();
  const wrapper = mount(TurnActionBar, {
    props: {
      currentStage: 'cleanup',
      submitMove,
    },
  });

  void wrapper.find('[data-testid="play-action-end-turn"]').trigger('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'endTurn');
  assert.deepEqual(calls[0]!.args, {});
});

test('TurnActionBar Draw is enabled in start and main, disabled in cleanup', () => {
  const { submitMove } = recorder();
  const enabledStages: ReadonlyArray<'start' | 'main'> = ['start', 'main'];
  for (const stage of enabledStages) {
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: stage, submitMove },
    });
    const draw = wrapper.find('[data-testid="play-action-draw"]');
    assert.equal(
      draw.attributes('disabled'),
      undefined,
      `Draw should be enabled in stage '${stage}'`,
    );
  }

  const cleanupWrapper = mount(TurnActionBar, {
    props: { currentStage: 'cleanup', submitMove },
  });
  assert.equal(
    cleanupWrapper.find('[data-testid="play-action-draw"]').attributes('disabled'),
    '',
  );
});

test('TurnActionBar End Turn is enabled only in cleanup', () => {
  const { submitMove } = recorder();
  const blockedStages: ReadonlyArray<'start' | 'main'> = ['start', 'main'];
  for (const stage of blockedStages) {
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: stage, submitMove },
    });
    assert.equal(
      wrapper.find('[data-testid="play-action-end-turn"]').attributes('disabled'),
      '',
      `End Turn should be disabled in stage '${stage}'`,
    );
  }

  const cleanupWrapper = mount(TurnActionBar, {
    props: { currentStage: 'cleanup', submitMove },
  });
  assert.equal(
    cleanupWrapper
      .find('[data-testid="play-action-end-turn"]')
      .attributes('disabled'),
    undefined,
  );
});

test('TurnActionBar Advance click emits advanceStage with empty-object payload (D-10011)', () => {
  const { calls, submitMove } = recorder();
  const wrapper = mount(TurnActionBar, {
    props: { currentStage: 'start', submitMove },
  });

  void wrapper.find('[data-testid="play-action-advance"]').trigger('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'advanceStage');
  assert.deepEqual(calls[0]!.args, {});
});

test('TurnActionBar Reveal click emits revealVillainCard with empty-object payload (D-10012)', () => {
  const { calls, submitMove } = recorder();
  const wrapper = mount(TurnActionBar, {
    props: { currentStage: 'start', submitMove },
  });

  void wrapper.find('[data-testid="play-action-reveal"]').trigger('click');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.name, 'revealVillainCard');
  assert.deepEqual(calls[0]!.args, {});
});

test('TurnActionBar Reveal is enabled only in start (D-10012)', () => {
  const { submitMove } = recorder();
  const startWrapper = mount(TurnActionBar, {
    props: { currentStage: 'start', submitMove },
  });
  assert.equal(
    startWrapper.find('[data-testid="play-action-reveal"]').attributes('disabled'),
    undefined,
    'Reveal should be enabled in start',
  );

  const blockedStages: ReadonlyArray<'main' | 'cleanup'> = ['main', 'cleanup'];
  for (const stage of blockedStages) {
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: stage, submitMove },
    });
    assert.equal(
      wrapper.find('[data-testid="play-action-reveal"]').attributes('disabled'),
      '',
      `Reveal should be disabled in stage '${stage}'`,
    );
  }
});

test('TurnActionBar Advance is enabled in start and main, disabled in cleanup (D-10011)', () => {
  const { submitMove } = recorder();
  const enabledStages: ReadonlyArray<'start' | 'main'> = ['start', 'main'];
  for (const stage of enabledStages) {
    const wrapper = mount(TurnActionBar, {
      props: { currentStage: stage, submitMove },
    });
    const advance = wrapper.find('[data-testid="play-action-advance"]');
    assert.equal(
      advance.attributes('disabled'),
      undefined,
      `Advance should be enabled in stage '${stage}'`,
    );
  }

  const cleanupWrapper = mount(TurnActionBar, {
    props: { currentStage: 'cleanup', submitMove },
  });
  assert.equal(
    cleanupWrapper.find('[data-testid="play-action-advance"]').attributes('disabled'),
    '',
    'Advance should be disabled in cleanup (End Turn is the proper exit there)',
  );
});

});
