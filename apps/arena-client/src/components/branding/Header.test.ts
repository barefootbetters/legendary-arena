// why: jsdom globals must be installed before Vue's mount() is called.
import '../../testing/jsdom-setup';

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { nextTick, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Header from './Header.vue';
import { useAuthStore } from '../../stores/auth';

/**
 * Mount Header.vue with the specified auth context.
 */
function mountHeader(options?: {
  isBootstrapping?: boolean;
  isHydrating?: boolean;
  token?: string | null;
}) {
  const pinia = createPinia();
  setActivePinia(pinia);

  if (options?.token !== undefined && options.token !== null) {
    useAuthStore().setSession(options.token, null);
  }

  return mount(Header, {
    global: {
      plugins: [pinia],
      provide: {
        isAuthBootstrapping: ref(options?.isBootstrapping ?? false),
        isSessionHydrating: ref(options?.isHydrating ?? false),
      },
    },
  });
}

describe('BrandHeader auth nav (WP-175)', () => {
  describe('site navigation', () => {
    test('renders a "Play" link targeting the app root (the lobby entry)', () => {
      const wrapper = mountHeader({ isBootstrapping: false });
      const play = wrapper.find('[data-testid="brand-nav-play"]');
      assert.equal(play.exists(), true);
      assert.equal(play.text(), 'Play');
      assert.equal(play.attributes('href'), '/');
    });

    test('the "Play" link is present whether signed in or out', () => {
      const signedOut = mountHeader({ isBootstrapping: false });
      const signedIn = mountHeader({ token: 'tok-abc' });
      assert.equal(
        signedOut.find('[data-testid="brand-nav-play"]').exists(),
        true,
      );
      assert.equal(
        signedIn.find('[data-testid="brand-nav-play"]').exists(),
        true,
      );
    });
  });

  describe('bootstrapping state', () => {
    test('renders the "..." placeholder with data-testid auth-nav-bootstrapping', () => {
      const wrapper = mountHeader({ isBootstrapping: true });
      const placeholder = wrapper.find('[data-testid="auth-nav-bootstrapping"]');
      assert.equal(placeholder.exists(), true);
      assert.equal(placeholder.text(), '...');
    });

    test('does not render sign-in or signed-in elements during bootstrap', () => {
      const wrapper = mountHeader({ isBootstrapping: true, token: 'tok-1' });
      assert.equal(
        wrapper.find('[data-testid="auth-nav-sign-in"]').exists(),
        false,
      );
      assert.equal(
        wrapper.find('[data-testid="auth-nav-display"]').exists(),
        false,
      );
      assert.equal(
        wrapper.find('[data-testid="auth-nav-sign-out"]').exists(),
        false,
      );
    });
  });

  // why: D-24641 — on the lobby / live routes isAuthBootstrapping is false
  // while the session hydrates in the background; the nav must not show a
  // signed-in player "Sign in" during that window.
  describe('background session hydration (D-24641)', () => {
    test('while the session hydrates, the placeholder shows and "Sign in" does not', () => {
      const wrapper = mountHeader({ isBootstrapping: false, isHydrating: true });
      assert.equal(wrapper.find('[data-testid="auth-nav-bootstrapping"]').exists(), true);
      assert.equal(wrapper.find('[data-testid="auth-nav-sign-in"]').exists(), false);
    });

    test('when hydration settles with a token, the signed-in nav replaces the placeholder', async () => {
      const isSessionHydrating = ref(true);
      const pinia = createPinia();
      setActivePinia(pinia);
      const wrapper = mount(Header, {
        global: {
          plugins: [pinia],
          provide: { isAuthBootstrapping: ref(false), isSessionHydrating },
        },
      });
      useAuthStore().bootstrapFromCachedToken('tok-1');
      isSessionHydrating.value = false;
      await nextTick();
      assert.equal(wrapper.find('[data-testid="auth-nav-bootstrapping"]').exists(), false);
      assert.equal(wrapper.find('[data-testid="auth-nav-sign-in"]').exists(), false);
      assert.equal(wrapper.find('[data-testid="auth-nav-sign-out"]').exists(), true);
    });

    test('when hydration settles with no session, "Sign in" appears', async () => {
      const isSessionHydrating = ref(true);
      const pinia = createPinia();
      setActivePinia(pinia);
      const wrapper = mount(Header, {
        global: {
          plugins: [pinia],
          provide: { isAuthBootstrapping: ref(false), isSessionHydrating },
        },
      });
      isSessionHydrating.value = false;
      await nextTick();
      assert.equal(wrapper.find('[data-testid="auth-nav-sign-in"]').exists(), true);
    });
  });

  describe('signed-out state', () => {
    test('renders a "Sign in" link targeting ?route=login', () => {
      const wrapper = mountHeader({ isBootstrapping: false });
      const signIn = wrapper.find('[data-testid="auth-nav-sign-in"]');
      assert.equal(signIn.exists(), true);
      assert.equal(signIn.text(), 'Sign in');
      assert.equal(signIn.attributes('href'), '?route=login');
    });

    test('does not render signed-in or bootstrapping elements', () => {
      const wrapper = mountHeader({ isBootstrapping: false });
      assert.equal(
        wrapper.find('[data-testid="auth-nav-bootstrapping"]').exists(),
        false,
      );
      assert.equal(
        wrapper.find('[data-testid="auth-nav-display"]').exists(),
        false,
      );
      assert.equal(
        wrapper.find('[data-testid="auth-nav-sign-out"]').exists(),
        false,
      );
    });
  });

  describe('signed-in state', () => {
    test('renders the display label with data-testid auth-nav-display', () => {
      const wrapper = mountHeader({ token: 'tok-abc' });
      const display = wrapper.find('[data-testid="auth-nav-display"]');
      assert.equal(display.exists(), true);
      assert.equal(display.text(), 'My account');
    });

    test('the display label itself links to ?route=me, with no separate "My profile" link', () => {
      const wrapper = mountHeader({ token: 'tok-abc' });
      const display = wrapper.find('[data-testid="auth-nav-display"]');
      // why: WP-346 — the username is the profile link; the standalone
      // "My profile" link was removed as redundant (both went to ?route=me).
      assert.equal(display.element.tagName, 'A');
      assert.equal(display.attributes('href'), '?route=me');
      assert.equal(
        wrapper.find('[data-testid="auth-nav-profile-link"]').exists(),
        false,
      );
    });

    test('renders a "Sign out" button', () => {
      const wrapper = mountHeader({ token: 'tok-abc' });
      const signOutButton = wrapper.find('[data-testid="auth-nav-sign-out"]');
      assert.equal(signOutButton.exists(), true);
      assert.equal(signOutButton.text(), 'Sign out');
    });

    test('does not render sign-in or bootstrapping elements when signed in', () => {
      const wrapper = mountHeader({ token: 'tok-abc' });
      assert.equal(
        wrapper.find('[data-testid="auth-nav-sign-in"]').exists(),
        false,
      );
      assert.equal(
        wrapper.find('[data-testid="auth-nav-bootstrapping"]').exists(),
        false,
      );
    });

    test('sign-out button is a clickable element', () => {
      const wrapper = mountHeader({ token: 'tok-abc' });
      const signOutButton = wrapper.find('[data-testid="auth-nav-sign-out"]');
      assert.equal(signOutButton.element.tagName, 'BUTTON');
      assert.equal(signOutButton.attributes('type'), 'button');
    });
  });
});
