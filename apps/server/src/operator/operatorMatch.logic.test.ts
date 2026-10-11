/**
 * Tests for the operator-match create-path helper and the in-memory bot
 * decision record (WP-802 / EC-839 / D-24689 §2, §5).
 *
 * Pure unit tests: no network, no DB, no boardgame.io.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  OPERATOR_FLAG_REFUSAL_MESSAGE,
  setupDataCarriesOperatorFlag,
} from './operatorMatch.logic.js';
import {
  OPERATOR_BOT_DECISION_CAP,
  OPERATOR_BOT_DECISION_MATCH_CAP,
  readOperatorBotDecisions,
  recordOperatorBotDecision,
  type OperatorBotDecision,
} from './operatorBotDecisions.js';

/**
 * Builds a recognisable bot decision for a turn.
 */
function decisionForTurn(turn: number): OperatorBotDecision {
  return {
    turn,
    seat: '1',
    isForced: false,
    move: { name: 'endTurn', args: { turn } },
    decisionLog: [`[Bot] Chose: endTurn (score ${turn})`],
    legalMoveCount: 2,
  };
}

describe('setupDataCarriesOperatorFlag (WP-802 / D-24689 §2)', () => {
  test('is true for an own isDebugMatch key, whatever its value', () => {
    assert.equal(setupDataCarriesOperatorFlag({ schemeId: 's', isDebugMatch: true }), true);
    assert.equal(setupDataCarriesOperatorFlag({ schemeId: 's', isDebugMatch: false }), true);
    assert.equal(setupDataCarriesOperatorFlag({ schemeId: 's', isDebugMatch: 'x' }), true);
  });

  test('is false for an absent key, null and a non-object', () => {
    assert.equal(setupDataCarriesOperatorFlag({ schemeId: 's' }), false);
    assert.equal(setupDataCarriesOperatorFlag(null), false);
    assert.equal(setupDataCarriesOperatorFlag(undefined), false);
    assert.equal(setupDataCarriesOperatorFlag('isDebugMatch'), false);
    assert.equal(setupDataCarriesOperatorFlag(42), false);
  });

  test('ignores an inherited isDebugMatch (own property only)', () => {
    const inherited = Object.create({ isDebugMatch: true }) as object;
    assert.equal(setupDataCarriesOperatorFlag(inherited), false);
  });

  test('the refusal message is the locked full sentence', () => {
    assert.equal(
      OPERATOR_FLAG_REFUSAL_MESSAGE,
      'This match setup carries isDebugMatch, which only the operator create route may set. ' +
        'Remove the field and create the match again.',
    );
  });
});

describe('operator bot decision record (WP-802 / D-24689 §5)', () => {
  test('the caps are 50 decisions per match and 20 matches', () => {
    assert.equal(OPERATOR_BOT_DECISION_CAP, 50);
    assert.equal(OPERATOR_BOT_DECISION_MATCH_CAP, 20);
  });

  test('keeps the most recent 50 decisions per match: the 51st drops the first', () => {
    const matchId = 'logic-test-cap-match';
    for (let turn = 1; turn <= 51; turn++) {
      recordOperatorBotDecision(matchId, decisionForTurn(turn));
    }
    const decisions = readOperatorBotDecisions(matchId);
    assert.equal(decisions.length, 50);
    assert.equal(decisions[0]!.turn, 2, 'the oldest decision (turn 1) was dropped');
    assert.equal(decisions[49]!.turn, 51, 'the newest decision is kept last');
  });

  test('evicts the oldest-inserted match past 20 matches', () => {
    const matchIds: string[] = [];
    for (let index = 0; index < 21; index++) {
      matchIds.push(`logic-test-eviction-${index}`);
    }
    for (const matchId of matchIds) {
      recordOperatorBotDecision(matchId, decisionForTurn(1));
    }
    assert.deepEqual(readOperatorBotDecisions(matchIds[0]!), [], 'the first match was evicted');
    assert.equal(readOperatorBotDecisions(matchIds[1]!).length, 1);
    assert.equal(readOperatorBotDecisions(matchIds[20]!).length, 1);
  });

  test('a read returns a copy, and an absent match reads as []', () => {
    const matchId = 'logic-test-copy-match';
    recordOperatorBotDecision(matchId, decisionForTurn(7));
    const firstRead = readOperatorBotDecisions(matchId);
    (firstRead[0]!.decisionLog as string[]).push('mutated');
    firstRead.push(decisionForTurn(8));
    const secondRead = readOperatorBotDecisions(matchId);
    assert.equal(secondRead.length, 1);
    assert.deepEqual(secondRead[0], decisionForTurn(7));
    assert.deepEqual(readOperatorBotDecisions('logic-test-never-recorded'), []);
  });
});
