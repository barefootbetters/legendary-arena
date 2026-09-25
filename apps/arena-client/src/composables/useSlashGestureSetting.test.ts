import '../testing/jsdom-setup';

import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLASH_GESTURE_SETTING_STORAGE_KEY,
  useSlashGestureSetting,
  __resetSlashGestureSettingForTests,
} from './useSlashGestureSetting';

describe('useSlashGestureSetting (WP-756 §C)', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetSlashGestureSettingForTests();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  test('the storage key is arenaClientSlashGesture', () => {
    assert.equal(SLASH_GESTURE_SETTING_STORAGE_KEY, 'arenaClientSlashGesture');
  });

  test('defaults to on', () => {
    assert.equal(useSlashGestureSetting().isEnabled.value, true);
  });

  test("'off' persists and survives a reload", () => {
    useSlashGestureSetting().setEnabled(false);
    assert.equal(localStorage.getItem('arenaClientSlashGesture'), 'off');
    __resetSlashGestureSettingForTests();
    assert.equal(useSlashGestureSetting().isEnabled.value, false);
    useSlashGestureSetting().setEnabled(true);
    assert.equal(localStorage.getItem('arenaClientSlashGesture'), 'on');
  });

  test('a corrupt stored value reads as on', () => {
    localStorage.setItem('arenaClientSlashGesture', 'banana');
    __resetSlashGestureSettingForTests();
    assert.equal(useSlashGestureSetting().isEnabled.value, true);
  });

  test('a throwing setItem still updates the ref', () => {
    // why: patch the Storage PROTOTYPE — jsdom's Storage instance treats own
    // property writes as stored items, so a method mock on the instance would
    // write a key instead of replacing setItem.
    mock.method(Object.getPrototypeOf(localStorage) as Storage, 'setItem', () => {
      throw new Error('QuotaExceededError');
    });
    useSlashGestureSetting().setEnabled(false);
    assert.equal(useSlashGestureSetting().isEnabled.value, false);
  });
});
