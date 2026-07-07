import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPinnedToBottom, GAME_LOG_STICK_THRESHOLD_PX } from './gameLogScroll';

test('isPinnedToBottom: true at the exact bottom (gap 0)', () => {
  // scrollHeight 200, scrollTop 120, clientHeight 80 -> gap 0
  assert.equal(isPinnedToBottom(200, 120, 80), true);
});

test('isPinnedToBottom: true within the threshold slack', () => {
  // gap = 200 - 100 - 80 = 20, which is <= the 24px threshold
  assert.equal(isPinnedToBottom(200, 100, 80), true);
});

test('isPinnedToBottom: false when scrolled up beyond the threshold', () => {
  // gap = 200 - 40 - 80 = 80 > 24 -> the viewer is reading history
  assert.equal(isPinnedToBottom(200, 40, 80), false);
});

test('isPinnedToBottom: false just past the threshold boundary', () => {
  // gap = 200 - 95 - 80 = 25 > 24
  assert.equal(isPinnedToBottom(200, 95, 80), false);
});

test('isPinnedToBottom: true when the content fits without scrolling', () => {
  // scrollHeight <= clientHeight -> non-positive gap -> pinned
  assert.equal(isPinnedToBottom(50, 0, 80), true);
});

test('isPinnedToBottom: honours an explicit threshold argument', () => {
  // gap = 200 - 100 - 80 = 20; > 0 threshold -> not pinned
  assert.equal(isPinnedToBottom(200, 100, 80, 0), false);
  // same gap, generous threshold -> pinned
  assert.equal(isPinnedToBottom(200, 100, 80, 50), true);
});

test('GAME_LOG_STICK_THRESHOLD_PX is a small positive slack', () => {
  assert.ok(GAME_LOG_STICK_THRESHOLD_PX > 0 && GAME_LOG_STICK_THRESHOLD_PX < 100);
});
