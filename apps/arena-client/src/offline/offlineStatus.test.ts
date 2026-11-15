import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { describeOfflineStatus, type OfflineStatusInput } from './offlineStatus';

/** A Ready input; each case overrides the fields it is about. */
const READY_INPUT: OfflineStatusInput = {
  registrationOutcome: 'registered',
  isWorkerActive: true,
  hasInstallFailed: false,
  warm: { total: 62, cached: 62, failed: 0 },
};

describe('describeOfflineStatus (WP-894)', () => {
  test('every output string', () => {
    assert.equal(
      describeOfflineStatus({ ...READY_INPUT, registrationOutcome: 'skipped-dev' }),
      'Offline copy is built only in production builds',
    );
    assert.equal(
      describeOfflineStatus({ ...READY_INPUT, registrationOutcome: 'unsupported' }),
      'Offline copy unavailable: this browser has no service worker support',
    );
    assert.equal(
      describeOfflineStatus({ ...READY_INPUT, registrationOutcome: 'failed' }),
      'Offline copy unavailable: the service worker could not be registered',
    );
    assert.equal(
      describeOfflineStatus({ ...READY_INPUT, hasInstallFailed: true }),
      'Offline copy unavailable: the service worker failed to install',
    );
    assert.equal(
      describeOfflineStatus({ ...READY_INPUT, warm: { total: 62, cached: 59, failed: 3 } }),
      'Offline copy unavailable: 3 card images could not be cached',
    );
    assert.equal(describeOfflineStatus(READY_INPUT), 'Ready offline');
    assert.equal(
      describeOfflineStatus({ ...READY_INPUT, registrationOutcome: 'pending' }),
      'Preparing offline copy…',
    );
  });

  test('the order: each failure beats the ones after it and beats Ready', () => {
    assert.equal(
      describeOfflineStatus({
        registrationOutcome: 'skipped-dev',
        isWorkerActive: true,
        hasInstallFailed: true,
        warm: { total: 62, cached: 0, failed: 62 },
      }),
      'Offline copy is built only in production builds',
    );
    assert.equal(
      describeOfflineStatus({
        ...READY_INPUT,
        hasInstallFailed: true,
        warm: { total: 62, cached: 0, failed: 62 },
      }),
      'Offline copy unavailable: the service worker failed to install',
    );
    assert.equal(
      describeOfflineStatus({ ...READY_INPUT, warm: { total: 62, cached: 62, failed: 1 } }),
      'Offline copy unavailable: 1 card images could not be cached',
    );
  });

  test('an empty warm is not Ready', () => {
    assert.equal(
      describeOfflineStatus({ ...READY_INPUT, warm: { total: 0, cached: 0, failed: 0 } }),
      'Preparing offline copy…',
    );
    assert.equal(describeOfflineStatus({ ...READY_INPUT, warm: null }), 'Preparing offline copy…');
  });

  test('Ready needs an active worker and a complete warm', () => {
    assert.equal(
      describeOfflineStatus({ ...READY_INPUT, isWorkerActive: false }),
      'Preparing offline copy…',
    );
    assert.equal(
      describeOfflineStatus({ ...READY_INPUT, warm: { total: 62, cached: 61, failed: 0 } }),
      'Preparing offline copy…',
    );
  });
});
