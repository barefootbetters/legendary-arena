import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { registerOfflineServiceWorker } from './registerOfflineServiceWorker';

/** One captured `register` call. */
interface RegisterCall {
  scriptUrl: string;
  options: RegistrationOptions | undefined;
}

/**
 * Builds a fake service-worker container that records `register` calls.
 *
 * @param shouldReject - Whether `register` rejects.
 * @returns The container and its call list.
 */
function makeFakeContainer(shouldReject: boolean): {
  container: ServiceWorkerContainer;
  calls: RegisterCall[];
  registration: ServiceWorkerRegistration;
} {
  const calls: RegisterCall[] = [];
  const registration = { scope: 'https://example.test/offline/' } as unknown as ServiceWorkerRegistration;
  const container = {
    register(scriptUrl: string, options?: RegistrationOptions): Promise<ServiceWorkerRegistration> {
      calls.push({ scriptUrl, options });
      if (shouldReject) {
        return Promise.reject(new Error('The fake registration was refused.'));
      }
      return Promise.resolve(registration);
    },
  } as unknown as ServiceWorkerContainer;
  return { container, calls, registration };
}

describe('registerOfflineServiceWorker (WP-894)', () => {
  test('a non-production build is skipped and never registers', async () => {
    const fake = makeFakeContainer(false);
    const result = await registerOfflineServiceWorker({
      isProductionBuild: false,
      buildId: 'abc1234',
      serviceWorkerContainer: fake.container,
    });
    assert.equal(result.outcome, 'skipped-dev');
    assert.equal(result.registration, null);
    assert.equal(fake.calls.length, 0);
  });

  test('a browser with no service worker container is unsupported', async () => {
    const result = await registerOfflineServiceWorker({
      isProductionBuild: true,
      buildId: 'abc1234',
      serviceWorkerContainer: undefined,
    });
    assert.equal(result.outcome, 'unsupported');
    assert.equal(result.registration, null);
  });

  test('registers /offline/sw.js with the encoded build id and the /offline/ scope', async () => {
    const fake = makeFakeContainer(false);
    const result = await registerOfflineServiceWorker({
      isProductionBuild: true,
      buildId: 'a b&c',
      serviceWorkerContainer: fake.container,
    });
    assert.equal(result.outcome, 'registered');
    assert.equal(result.registration, fake.registration);
    assert.deepEqual(fake.calls, [
      { scriptUrl: '/offline/sw.js?build=a%20b%26c', options: { scope: '/offline/' } },
    ]);
  });

  test('a rejected registration is failed, not thrown', async () => {
    const fake = makeFakeContainer(true);
    const result = await registerOfflineServiceWorker({
      isProductionBuild: true,
      buildId: 'abc1234',
      serviceWorkerContainer: fake.container,
    });
    assert.equal(result.outcome, 'failed');
    assert.equal(result.registration, null);
  });
});
