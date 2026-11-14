import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { isOfflinePath } from './offlineRoute';

describe('isOfflinePath (WP-894)', () => {
  test('/offline/ and any path below it are the offline page', () => {
    assert.equal(isOfflinePath('/offline/'), true);
    assert.equal(isOfflinePath('/offline/anything'), true);
  });

  test('the root, the bare /offline, a look-alike prefix and a nested path are not', () => {
    assert.equal(isOfflinePath('/'), false);
    assert.equal(isOfflinePath('/offline'), false);
    assert.equal(isOfflinePath('/offlinex/'), false);
    assert.equal(isOfflinePath('/play/offline/'), false);
  });
});
