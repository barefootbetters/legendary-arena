import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, flushPromises } from '@vue/test-utils';
import ReplayFileLoader from './ReplayFileLoader.vue';

// why: jsdom's HTMLInputElement.files is a read-only FileList getter.
// Object.defineProperty installs a writable replacement on the specific
// element instance so the @change handler reads the same File the test
// constructs. Standard File-API usage in tests; no production code path
// uses this pattern.
function attachFile(inputElement: HTMLInputElement, file: File): void {
  Object.defineProperty(inputElement, 'files', {
    configurable: true,
    value: [file],
  });
}

function buildValidReplayBlob(): string {
  return JSON.stringify({
    version: 1,
    snapshots: [
      {
        game: {
          phase: 'play',
          turn: 1,
          activePlayerId: '0',
          currentStage: 'start',
        },
        players: [],
        city: { spaces: [null, null, null, null, null] },
        hq: { slots: [null, null, null, null, null] },
        mastermind: { id: 'm', tacticsRemaining: 0, tacticsDefeated: 0 },
        scheme: { id: 's', twistCount: 0 },
        economy: {
          attack: 0,
          recruit: 0,
          availableAttack: 0,
          availableRecruit: 0,
        },
        log: [],
        progress: { bystandersRescued: 0, escapedVillains: 0 },
      },
    ],
  });
}

test('ReplayFileLoader emits "loaded" with a typed sequence on a valid JSON file', async () => {
  const wrapper = mount(ReplayFileLoader);
  const input = wrapper.find('[data-testid="replay-file-input"]')
    .element as HTMLInputElement;
  const file = new File([buildValidReplayBlob()], 'good.json', {
    type: 'application/json',
  });

  attachFile(input, file);
  await wrapper.find('[data-testid="replay-file-input"]').trigger('change');
  await flushPromises();

  const events = wrapper.emitted('loaded');
  assert.ok(events, 'expected a loaded event');
  assert.equal(events.length, 1);
  const [sequence] = events[0] as [{ version: number; snapshots: unknown[] }];
  assert.equal(sequence.version, 1);
  assert.equal(sequence.snapshots.length, 1);
  assert.equal(
    wrapper.find('[data-testid="replay-file-error"]').exists(),
    false,
  );
});

test('ReplayFileLoader renders a role="alert" region and does not emit on invalid JSON', async () => {
  const wrapper = mount(ReplayFileLoader);
  const input = wrapper.find('[data-testid="replay-file-input"]')
    .element as HTMLInputElement;
  const file = new File(['{not json'], 'broken.json', {
    type: 'application/json',
  });

  attachFile(input, file);
  await wrapper.find('[data-testid="replay-file-input"]').trigger('change');
  await flushPromises();

  assert.equal(wrapper.emitted('loaded'), undefined);
  const alert = wrapper.find('[role="alert"]');
  assert.equal(alert.exists(), true);
  assert.match(alert.text(), /JSON|Unexpected/);
});

test('ReplayFileLoader renders the locked version-mismatch template on version !== 1', async () => {
  const wrapper = mount(ReplayFileLoader);
  const input = wrapper.find('[data-testid="replay-file-input"]')
    .element as HTMLInputElement;
  const file = new File(
    [JSON.stringify({ version: 2, snapshots: [{}] })],
    'wrong-version.json',
    { type: 'application/json' },
  );

  attachFile(input, file);
  await wrapper.find('[data-testid="replay-file-input"]').trigger('change');
  await flushPromises();

  assert.equal(wrapper.emitted('loaded'), undefined);
  const alert = wrapper.find('[role="alert"]');
  assert.equal(alert.exists(), true);
  assert.equal(
    alert.text(),
    'Replay file wrong-version.json field "version" must be the literal 1; received 2.',
  );
});

test('ReplayFileLoader carries an aria-label on the file input', () => {
  const wrapper = mount(ReplayFileLoader);
  const input = wrapper.find('[data-testid="replay-file-input"]');

  assert.equal(
    input.attributes('aria-label'),
    'Select a replay JSON file to load',
  );
});

test('ReplayFileLoader clears a previous error on the next successful load', async () => {
  const wrapper = mount(ReplayFileLoader);
  const inputElement = wrapper.find('[data-testid="replay-file-input"]')
    .element as HTMLInputElement;

  // First load fails.
  const badFile = new File(['{not json'], 'broken.json', {
    type: 'application/json',
  });
  attachFile(inputElement, badFile);
  await wrapper.find('[data-testid="replay-file-input"]').trigger('change');
  await flushPromises();
  assert.equal(wrapper.find('[role="alert"]').exists(), true);

  // Second load succeeds — alert region clears.
  const goodFile = new File([buildValidReplayBlob()], 'good.json', {
    type: 'application/json',
  });
  attachFile(inputElement, goodFile);
  await wrapper.find('[data-testid="replay-file-input"]').trigger('change');
  await flushPromises();

  assert.equal(wrapper.find('[role="alert"]').exists(), false);
  const events = wrapper.emitted('loaded');
  assert.ok(events);
  assert.equal(events.length, 1);
});
