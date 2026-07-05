/**
 * Tests for the route auth policy (WP-160 guarded routes + the PR #547 lobby
 * session-hydration fix).
 *
 * These lock the exact classification that regressed: the lobby MUST hydrate
 * the cached broker session (`shouldHydrateSession('lobby') === true`) but MUST
 * NOT be treated as guarded (`isGuardedRoute('lobby') === false`), so it renders
 * immediately and never redirects to login on load. Before PR #547 the lobby
 * was excluded from hydration and signed-in users were bounced to
 * `?route=login` on every create/join.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { isGuardedRoute, shouldHydrateSession } from './routeAuthPolicy';

// why: the full closed set of routes that never consume the bearer token, so a
// future route addition that forgets to classify itself is caught here.
const NON_AUTH_ROUTES = [
  'login',
  'profile',
  'shared-loadout',
  'fixture',
  'play-fixture',
  'live',
];

describe('routeAuthPolicy', () => {
  describe('isGuardedRoute', () => {
    test('the guarded routes require a session (block render + redirect)', () => {
      assert.equal(isGuardedRoute('me'), true);
      assert.equal(isGuardedRoute('admin-billing'), true);
    });

    test('the lobby is NOT guarded — it renders immediately and never redirects on load', () => {
      assert.equal(isGuardedRoute('lobby'), false);
    });

    test('public / non-auth routes are not guarded', () => {
      for (const route of NON_AUTH_ROUTES) {
        assert.equal(isGuardedRoute(route), false, `${route} must not be guarded`);
      }
    });
  });

  describe('shouldHydrateSession', () => {
    test('the lobby hydrates the cached session (PR #547 regression guard)', () => {
      // why: this is the exact line that regressed. Before PR #547 the lobby
      // was absent here, so a signed-in user's token was never read from the
      // broker cookie on the lobby and create/join bounced them to login.
      assert.equal(shouldHydrateSession('lobby'), true);
    });

    test('the guarded routes hydrate', () => {
      assert.equal(shouldHydrateSession('me'), true);
      assert.equal(shouldHydrateSession('admin-billing'), true);
    });

    test('routes that never consume the bearer token do not hydrate', () => {
      for (const route of NON_AUTH_ROUTES) {
        assert.equal(
          shouldHydrateSession(route),
          false,
          `${route} must not hydrate the session`,
        );
      }
    });

    test('every guarded route also hydrates (hydrate is a superset of guarded)', () => {
      for (const route of ['me', 'admin-billing', 'lobby']) {
        if (isGuardedRoute(route)) {
          assert.equal(
            shouldHydrateSession(route),
            true,
            `guarded route ${route} must also hydrate`,
          );
        }
      }
    });
  });
});
