/**
 * Route auth policy — which routes hydrate the broker session, and which
 * block render on it (WP-160 guarded routes + the WP-307/PR #547 lobby fix).
 *
 * App.vue's setup consumes these two predicates to decide, at mount time, how
 * to treat the cached broker session for the current route. They are extracted
 * here as pure functions so the load-bearing classification is unit-testable
 * without mounting the whole app or mocking the broker SDK.
 *
 * Background: WP-307 gated the lobby's create/join on a signed-in bearer token
 * (`requireAuthTokenOrRedirectToLogin`), but App.vue only ever hydrated the
 * token from the broker cookie on the guarded routes (`me`, `admin-billing`).
 * On the lobby the auth store stayed empty, so a signed-in user's token read
 * as null and every create/join bounced them to `?route=login` — an endless
 * loop, since the LoginPage full-reload lands back on the lobby. PR #547 fixed
 * this by hydrating the token on the lobby too, WITHOUT blocking render (the
 * lobby is public) and WITHOUT redirecting when no session exists. That split
 * is exactly the difference between {@link isGuardedRoute} and
 * {@link shouldHydrateSession}.
 */

/**
 * Whether a route is *guarded*: it requires an authenticated session to view,
 * so App.vue blocks render on the auth-bootstrap and redirects to `?route=login`
 * when no cached session exists.
 *
 * @param route The resolved app route.
 * @returns `true` for the guarded routes (`me`, `admin-billing`), else `false`.
 */
export function isGuardedRoute(route: string): boolean {
  return route === 'me' || route === 'admin-billing';
}

/**
 * Whether App.vue should hydrate the cached broker session for a route. This is
 * a superset of {@link isGuardedRoute}: the guarded routes hydrate (and block +
 * redirect), and the public `lobby` route ALSO hydrates — in the background, so
 * a signed-in user's bearer token is present when they create/join, without
 * blocking the lobby render or redirecting when signed out.
 *
 * The `lobby` entry is the PR #547 fix: before it, the lobby was excluded here
 * and signed-in users were bounced to login on every create/join.
 *
 * @param route The resolved app route.
 * @returns `true` when the cached session should be hydrated for this route.
 */
export function shouldHydrateSession(route: string): boolean {
  return isGuardedRoute(route) || route === 'lobby';
}
