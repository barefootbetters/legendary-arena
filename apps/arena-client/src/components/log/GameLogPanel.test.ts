import '../../testing/jsdom-setup';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '@vue/test-utils';
import GameLogPanel from './GameLogPanel.vue';

test('GameLogPanel renders the role="status" empty-state region when log is []', () => {
  const wrapper = mount(GameLogPanel, { props: { log: [] } });

  const empty = wrapper.find('[role="status"]');
  assert.equal(empty.exists(), true);
  assert.equal(empty.text(), 'Game log is empty.');
  assert.equal(wrapper.find('[data-testid="game-log-line"]').exists(), false);
});

test('GameLogPanel renders one <li> per entry in source order with stable data-index', () => {
  const log = ['first entry', 'second entry', 'third entry'];

  const wrapper = mount(GameLogPanel, { props: { log } });

  const lines = wrapper.findAll('[data-testid="game-log-line"]');
  assert.equal(lines.length, 3);
  assert.equal(lines[0]?.text(), 'first entry');
  assert.equal(lines[1]?.text(), 'second entry');
  assert.equal(lines[2]?.text(), 'third entry');
  assert.equal(lines[0]?.attributes('data-index'), '0');
  assert.equal(lines[1]?.attributes('data-index'), '1');
  assert.equal(lines[2]?.attributes('data-index'), '2');
});

test('GameLogPanel list element carries aria-live="polite"', () => {
  const wrapper = mount(GameLogPanel, {
    props: { log: ['only entry'] },
  });

  const list = wrapper.find('ol');
  assert.equal(list.exists(), true);
  assert.equal(list.attributes('aria-live'), 'polite');
});

test('GameLogPanel does not mutate the supplied log array through render', () => {
  const log = ['alpha', 'bravo', 'charlie'];
  const before = JSON.stringify(log);

  mount(GameLogPanel, { props: { log } });

  assert.strictEqual(JSON.stringify(log), before);
  assert.equal(log.length, 3);
});
