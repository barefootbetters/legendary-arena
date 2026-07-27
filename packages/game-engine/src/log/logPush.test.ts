import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pushLog } from './logPush';
import { hashGameState } from '../test/fixtures/hashGameState';
import type { LegendaryGameState } from '../types';
import type { TurnStage } from '../turn/turnPhases.types';

/** A minimal `G` for the pushLog tests — only the fields the helper reads. */
function stateWith(overrides: Partial<LegendaryGameState>): LegendaryGameState {
  return { messages: [], currentStage: 'main', ...overrides } as unknown as LegendaryGameState;
}

test('pushLog prefixes {turn}.{step}.{action} and increments the per-step counter', () => {
  const G = stateWith({ currentStage: 'main', logMeta: { turn: 10, actionInStep: 0 } });
  pushLog(G, 'Player 0 played X.');
  pushLog(G, 'Player 0 recruited Y.');
  assert.deepEqual(G.messages, [
    { text: '10.2.1 Player 0 played X.', outcome: 'neutral' },
    { text: '10.2.2 Player 0 recruited Y.', outcome: 'neutral' },
  ]);
  assert.equal(G.logMeta!.actionInStep, 2);
});

test('pushLog maps start/main/cleanup to steps 1/2/3', () => {
  const cases: Array<[TurnStage, number]> = [
    ['start', 1],
    ['main', 2],
    ['cleanup', 3],
  ];
  for (const [stage, step] of cases) {
    const G = stateWith({ currentStage: stage, logMeta: { turn: 7, actionInStep: 0 } });
    pushLog(G, 'm');
    assert.equal(G.messages[0]!.text, `7.${step}.1 m`);
  }
});

test('pushLog pushes the bare message when logMeta is absent (fallback)', () => {
  const G = stateWith({ currentStage: 'main' });
  pushLog(G, 'bare line');
  assert.deepEqual(G.messages, [{ text: 'bare line', outcome: 'neutral' }]);
});

test('pushLog attaches an optional card ext-id, and omits the key when not supplied (WP-438)', () => {
  const G = { messages: [], currentStage: 'main' } as unknown as LegendaryGameState;
  pushLog(G, 'Player 0 played X.', 'neutral', 'core/hawkeye/quick-draw#2');
  pushLog(G, 'Turn 1 started.'); // no card → key omitted, not `card: undefined`
  assert.deepEqual(G.messages, [
    { text: 'Player 0 played X.', outcome: 'neutral', card: 'core/hawkeye/quick-draw#2' },
    { text: 'Turn 1 started.', outcome: 'neutral' },
  ]);
});

test('pushLog does not throw when messages is not an array', () => {
  const G = { currentStage: 'main', logMeta: { turn: 1, actionInStep: 0 } } as unknown as LegendaryGameState;
  assert.doesNotThrow(() => pushLog(G, 'x'));
});

test('logMeta is excluded from finalStateHash (numbering never enters the hash)', () => {
  const base = { foo: 1, messages: [], currentStage: 'main' } as unknown as LegendaryGameState;
  const a = { ...base, logMeta: { turn: 1, actionInStep: 5 } } as unknown as LegendaryGameState;
  const b = { ...base, logMeta: { turn: 99, actionInStep: 0 } } as unknown as LegendaryGameState;
  assert.equal(hashGameState(a), hashGameState(b));
});
