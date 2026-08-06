import '../testing/jsdom-setup';

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  persistMatchSetup,
  readMatchSetup,
  persistBotAllySetup,
  readBotAllySetup,
} from './matchSetupSession';

const SAMPLE_SETUP = {
  schemeId: 'core/midtown-bank-robbery',
  mastermindId: 'core/magneto',
  villainGroupIds: ['core/skrulls'],
  henchmanGroupIds: ['core/sentinel'],
  heroDeckIds: ['core/spider-man'],
  bystandersCount: 30,
  woundsCount: 30,
  officersCount: 30,
  sidekicksCount: 12,
};

describe('matchSetupSession', () => {
  beforeEach(() => {
    // why: jsdom provides a real sessionStorage; clear it between cases so
    // round-trip and absent-key assertions never see a prior case's entry.
    sessionStorage.clear();
  });

  test('round-trips the persisted setup for a matchId', () => {
    persistMatchSetup('room-7', SAMPLE_SETUP);
    assert.deepEqual(readMatchSetup('room-7'), SAMPLE_SETUP);
  });

  test('returns null for a matchId that was never persisted', () => {
    persistMatchSetup('room-7', SAMPLE_SETUP);
    assert.equal(readMatchSetup('room-other'), null);
  });

  test('returns null when matchId is null or empty', () => {
    assert.equal(readMatchSetup(null), null);
    assert.equal(readMatchSetup(''), null);
  });

  test('does not persist under an empty matchId', () => {
    persistMatchSetup('', SAMPLE_SETUP);
    assert.equal(sessionStorage.length, 0);
  });

  test('returns null for a corrupt stored entry rather than throwing', () => {
    // why: a hand-corrupted entry (or a future format change) must resolve to
    // null in the export path, never throw and break the diagnostics download.
    sessionStorage.setItem('legendary-arena:match-setup:room-7', '{not valid json');
    assert.equal(readMatchSetup('room-7'), null);
  });

  test('keys are isolated per matchId (no cross-contamination)', () => {
    persistMatchSetup('room-a', { ...SAMPLE_SETUP, bystandersCount: 1 });
    persistMatchSetup('room-b', { ...SAMPLE_SETUP, bystandersCount: 30 });
    assert.deepEqual(readMatchSetup('room-a'), { ...SAMPLE_SETUP, bystandersCount: 1 });
    assert.deepEqual(readMatchSetup('room-b'), { ...SAMPLE_SETUP, bystandersCount: 30 });
  });

  // WP-502 Play Again fix — the bot-ally parameter stash.

  test('round-trips the bot-ally setup for a matchId', () => {
    persistBotAllySetup('room-7', { botCount: 1, policy: 'competent' });
    assert.deepEqual(readBotAllySetup('room-7'), { botCount: 1, policy: 'competent' });
  });

  test('bot-ally read returns null for a plain match (never persisted)', () => {
    persistMatchSetup('room-7', SAMPLE_SETUP);
    assert.equal(readBotAllySetup('room-7'), null);
  });

  test('bot-ally read returns null for null / empty matchId and does not persist under empty', () => {
    assert.equal(readBotAllySetup(null), null);
    assert.equal(readBotAllySetup(''), null);
    persistBotAllySetup('', { botCount: 1, policy: 'competent' });
    assert.equal(sessionStorage.length, 0);
  });

  test('bot-ally read rejects a malformed or partial entry (falls back to plain relaunch)', () => {
    // why: a corrupt or partial stash must NOT drive a bad create-with-bot call —
    // only a well-formed { botCount>=1, policy in {competent,random} } switches
    // Play Again to the bot path; anything else resolves to null.
    sessionStorage.setItem('legendary-arena:bot-ally-setup:room-a', '{not valid json');
    assert.equal(readBotAllySetup('room-a'), null);
    sessionStorage.setItem(
      'legendary-arena:bot-ally-setup:room-b',
      JSON.stringify({ botCount: 0, policy: 'competent' }),
    );
    assert.equal(readBotAllySetup('room-b'), null);
    sessionStorage.setItem(
      'legendary-arena:bot-ally-setup:room-c',
      JSON.stringify({ botCount: 2, policy: 'reckless' }),
    );
    assert.equal(readBotAllySetup('room-c'), null);
  });

  test('bot-ally read accepts the random policy', () => {
    persistBotAllySetup('room-r', { botCount: 2, policy: 'random' });
    assert.deepEqual(readBotAllySetup('room-r'), { botCount: 2, policy: 'random' });
  });
});
