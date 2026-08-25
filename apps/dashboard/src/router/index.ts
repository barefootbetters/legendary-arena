import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/auth/LoginPage.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: () => import('../layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/overview',
        },
        {
          path: 'overview',
          name: 'overview',
          component: () => import('../pages/dashboard/OverviewPage.vue'),
        },
        {
          path: 'vision',
          name: 'vision',
          component: () => import('../pages/vision/VisionRoadmapPage.vue'),
        },
        {
          path: 'coverage',
          name: 'coverage',
          component: () => import('../pages/coverage/CoveragePage.vue'),
        },
        {
          path: 'players',
          name: 'players',
          component: () => import('../pages/players/PlayerAnalyticsPage.vue'),
        },
        {
          path: 'monetization',
          name: 'monetization',
          component: () => import('../pages/monetization/MonetizationPage.vue'),
        },
        {
          path: 'feedback',
          name: 'feedback',
          component: () => import('../pages/feedback/FeedbackTriagePage.vue'),
        },
        {
          path: 'gameplay',
          name: 'gameplay',
          component: () => import('../pages/gameplay/GameplayPage.vue'),
        },
        {
          path: 'system',
          name: 'system',
          component: () => import('../pages/system/SystemHealthPage.vue'),
        },
        {
          path: 'debug',
          name: 'debug',
          component: () => import('../pages/debug/DebugPage.vue'),
        },
        {
          path: 'debug/effects',
          name: 'debug-effects',
          component: () => import('../pages/debug/EffectsPage.vue'),
        },
        {
          path: 'pipeline',
          name: 'pipeline',
          component: () => import('../pages/pipeline/PipelinePage.vue'),
        },
      ],
    },
  ],
});

router.beforeEach((to: RouteLocationNormalized) => {
  const authStore = useAuthStore();

  if (to.meta.requiresAuth === false) {
    if (authStore.isAuthenticated) {
      return { name: 'overview' };
    }
    return true;
  }

  if (!authStore.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  // why: WP-241 / D-24004 — routing gates PURELY on `isAuthenticated`
  // (token !== null). Role-based routing is retired (no `roles` meta, no
  // per-route role check); admin role-scoping is a server-side concern deferred
  // to a follow-up WP. The Cloudflare Access gate (WP-197) remains the
  // operator-reachability boundary in front of the deploy.
  return true;
});

// why: every route component is code-split via dynamic `import()`, and Vite
// content-hashes each chunk's filename. After a redeploy the hashes change, so a
// browser still holding the previous `index.html` requests a chunk URL that no
// longer exists on Cloudflare Pages. The dynamic import rejects, the navigation
// aborts, and — because the aborted navigation leaves the current page in place
// — every <RouterLink> silently "does nothing" while native <a> links (full page
// loads) keep working. This is the standard stale-chunk-after-deploy failure.
const STALE_CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

// why: keyed one-shot guard (survives the reload via sessionStorage) so a
// genuinely-missing chunk — a broken deploy rather than a merely-stale one —
// fails visibly instead of reloading forever. Cleared on the next successful
// navigation so a later stale-chunk episode can still recover.
const CHUNK_RELOAD_GUARD_KEY = 'la-dashboard-stale-chunk-reload-target';

/**
 * Recover from a stale lazy-loaded route chunk by reloading the whole document
 * at the intended path. A full-document load fetches the current `index.html`,
 * which references the up-to-date chunk hashes, so the route that just failed to
 * load resolves on the fresh page. Non-chunk navigation errors are left alone.
 *
 * @param error The error the router surfaced for the failed navigation.
 * @param to The route the operator was trying to reach when the chunk failed.
 */
router.onError((error: unknown, to) => {
  const message = error instanceof Error ? error.message : String(error);
  if (!STALE_CHUNK_ERROR_PATTERN.test(message)) {
    return;
  }
  const targetPath = to.fullPath;
  if (sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY) === targetPath) {
    return;
  }
  sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, targetPath);
  window.location.assign(targetPath);
});

router.afterEach(() => {
  // why: a completed navigation proves chunks are loading again; drop the
  // one-shot guard so a future stale-chunk episode is allowed one recovery too.
  sessionStorage.removeItem(CHUNK_RELOAD_GUARD_KEY);
});
