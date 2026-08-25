/**
 * Tests for the feedback HTTP routes (WP-604 / EC-639).
 *
 * Logic-pure: a fake FeedbackRouteDependencies + a fake FeedbackRouteLogic are
 * injected, so no real pg.Pool, no HTTP listener. A mock router captures the four
 * registered handlers; the mock context records header/status/body ordering for the
 * Cache-Control-first assertion. The unit-test context injects request.body directly
 * (no Node stream), so ensureJsonBodyParsed short-circuits.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

import { registerFeedbackRoutes } from './feedback.routes.js';
import type {
  FeedbackRouteDependencies,
  FeedbackRouteLogic,
} from './feedback.routes.js';
import type { AccountId } from '../identity/identity.types.js';
import type { SessionTokenRequest } from '../auth/sessionToken.types.js';
import type {
  FeedbackItemRecord,
  PublicFeedbackItem,
} from './feedback.types.js';

type RegisteredHandler = (koaContext: MockKoaContext) => Promise<void> | void;

interface MockKoaContext {
  readonly req: SessionTokenRequest;
  request: { body?: unknown };
  params: { id?: string };
  status: number;
  body: unknown;
  set(field: string, value: string): void;
  readonly callOrder: string[];
}

interface MockRoutes {
  post: Map<string, RegisteredHandler>;
  get: Map<string, RegisteredHandler>;
  delete: Map<string, RegisteredHandler>;
}

function makeMockRouter(): {
  router: {
    post: (path: string, handler: RegisteredHandler) => void;
    get: (path: string, handler: RegisteredHandler) => void;
    delete: (path: string, handler: RegisteredHandler) => void;
  };
  routes: MockRoutes;
} {
  const routes: MockRoutes = {
    post: new Map(),
    get: new Map(),
    delete: new Map(),
  };
  return {
    router: {
      post(path: string, handler: RegisteredHandler): void {
        routes.post.set(path, handler);
      },
      get(path: string, handler: RegisteredHandler): void {
        routes.get.set(path, handler);
      },
      delete(path: string, handler: RegisteredHandler): void {
        routes.delete.set(path, handler);
      },
    },
    routes,
  };
}

function makeMockContext(
  over: { body?: unknown; id?: string } = {},
): MockKoaContext {
  const callOrder: string[] = [];
  let statusValue = 0;
  let bodyValue: unknown = undefined;
  return {
    req: {} as SessionTokenRequest,
    request: { body: over.body },
    params: over.id === undefined ? {} : { id: over.id },
    get status(): number {
      return statusValue;
    },
    set status(value: number) {
      statusValue = value;
      callOrder.push('status');
    },
    get body(): unknown {
      return bodyValue;
    },
    set body(value: unknown) {
      bodyValue = value;
      callOrder.push('body');
    },
    set(field: string): void {
      callOrder.push(`set:${field}`);
    },
    callOrder,
  };
}

const RECORD: FeedbackItemRecord = {
  id: 42,
  feedbackType: 'enhancement',
  title: 'Add a dark mode',
  description: 'A dark theme would help.',
  authorExtId: 'acct-jeff',
  status: 'under_review',
  resolutionReason: null,
  createdAt: '2026-08-25T00:00:00.000Z',
  updatedAt: '2026-08-25T00:00:00.000Z',
};

const PUBLIC_ITEM: PublicFeedbackItem = {
  id: 42,
  type: 'enhancement',
  title: 'Add a dark mode',
  description: 'A dark theme would help.',
  status: 'planned',
  voteCount: 3,
  viewerHasVoted: false,
  createdAt: '2026-08-25T00:00:00.000Z',
};

function makeDeps(
  over: Partial<FeedbackRouteDependencies> = {},
): FeedbackRouteDependencies {
  return {
    requireAuthenticatedSession: async () => ({
      ok: true,
      value: 'acct-jeff' as AccountId,
    }),
    ...over,
  };
}

function makeLogic(over: Partial<FeedbackRouteLogic> = {}): FeedbackRouteLogic {
  return {
    insertFeedbackItem: async () => RECORD,
    listPublicEnhancements: async () => [PUBLIC_ITEM],
    addVote: async () => 'added',
    removeVote: async () => 'removed',
    countVotesForItem: async () => 4,
    ...over,
  };
}

function register(
  deps: FeedbackRouteDependencies,
  logic: FeedbackRouteLogic,
): MockRoutes {
  const { router, routes } = makeMockRouter();
  registerFeedbackRoutes(router as never, {} as never, deps, logic);
  return routes;
}

describe('registerFeedbackRoutes — registration (WP-604)', () => {
  test('registers all four feedback routes', () => {
    const routes = register(makeDeps(), makeLogic());
    assert.ok(routes.post.has('/api/feedback'));
    assert.ok(routes.get.has('/api/feedback'));
    assert.ok(routes.post.has('/api/feedback/:id/vote'));
    assert.ok(routes.delete.has('/api/feedback/:id/vote'));
  });
});

describe('POST /api/feedback (WP-604)', () => {
  test('201 { id } on success with Cache-Control set first', async () => {
    const routes = register(makeDeps(), makeLogic());
    const handler = routes.post.get('/api/feedback')!;
    const context = makeMockContext({ body: { type: 'bug', title: 'x', description: 'y' } });
    await handler(context);
    assert.equal(context.status, 201);
    assert.deepEqual(context.body, { id: 42 });
    assert.equal(context.callOrder[0], 'set:Cache-Control');
  });

  test('401 on a failed session; the insert logic is never called', async () => {
    let called = false;
    const routes = register(
      makeDeps({
        requireAuthenticatedSession: async () => ({
          ok: false,
          reason: 'no token',
          code: 'missing_token',
        }),
      }),
      makeLogic({
        insertFeedbackItem: async () => {
          called = true;
          return RECORD;
        },
      }),
    );
    const handler = routes.post.get('/api/feedback')!;
    const context = makeMockContext({ body: { type: 'bug', title: 'x', description: 'y' } });
    await handler(context);
    assert.equal(context.status, 401);
    assert.deepEqual(context.body, { error: 'missing_token' });
    assert.equal(called, false);
  });

  test('400 with the field error code on an invalid body', async () => {
    const routes = register(makeDeps(), makeLogic());
    const handler = routes.post.get('/api/feedback')!;
    const context = makeMockContext({ body: { type: 'praise', title: 'x', description: 'y' } });
    await handler(context);
    assert.equal(context.status, 400);
    assert.deepEqual(context.body, { error: 'invalid_type' });
  });

  test('500 with a locked envelope when the insert throws', async () => {
    const routes = register(
      makeDeps(),
      makeLogic({
        insertFeedbackItem: async () => {
          throw new Error('boom');
        },
      }),
    );
    const handler = routes.post.get('/api/feedback')!;
    const context = makeMockContext({ body: { type: 'bug', title: 'x', description: 'y' } });
    await handler(context);
    assert.equal(context.status, 500);
    assert.deepEqual(context.body, { error: 'internal_error' });
  });
});

describe('GET /api/feedback (WP-604)', () => {
  test('200 { items } for a guest (no session), Cache-Control first', async () => {
    let capturedViewer: unknown = 'unset';
    const routes = register(
      makeDeps({
        requireAuthenticatedSession: async () => ({
          ok: false,
          reason: 'no token',
          code: 'missing_token',
        }),
      }),
      makeLogic({
        listPublicEnhancements: async (_database, options) => {
          capturedViewer = options?.viewerExtId;
          return [PUBLIC_ITEM];
        },
      }),
    );
    const handler = routes.get.get('/api/feedback')!;
    const context = makeMockContext();
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { items: [PUBLIC_ITEM] });
    assert.equal(context.callOrder[0], 'set:Cache-Control');
    // why: a guest resolves no viewer, so viewerExtId is never passed.
    assert.equal(capturedViewer, undefined);
  });

  test('resolves the viewer opportunistically when a session is present', async () => {
    let capturedViewer: unknown = 'unset';
    const routes = register(
      makeDeps(),
      makeLogic({
        listPublicEnhancements: async (_database, options) => {
          capturedViewer = options?.viewerExtId;
          return [PUBLIC_ITEM];
        },
      }),
    );
    const handler = routes.get.get('/api/feedback')!;
    await handler(makeMockContext());
    assert.equal(capturedViewer, 'acct-jeff');
  });
});

describe('POST /api/feedback/:id/vote (WP-604)', () => {
  test('200 { voted: true, voteCount } on a cast vote', async () => {
    const routes = register(makeDeps(), makeLogic());
    const handler = routes.post.get('/api/feedback/:id/vote')!;
    const context = makeMockContext({ id: '42' });
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { voted: true, voteCount: 4 });
  });

  test('404 not_found when the item does not exist', async () => {
    const routes = register(makeDeps(), makeLogic({ addVote: async () => 'no_such_item' }));
    const handler = routes.post.get('/api/feedback/:id/vote')!;
    const context = makeMockContext({ id: '999' });
    await handler(context);
    assert.equal(context.status, 404);
    assert.deepEqual(context.body, { error: 'not_found' });
  });

  test('400 invalid_request on a malformed id', async () => {
    const routes = register(makeDeps(), makeLogic());
    const handler = routes.post.get('/api/feedback/:id/vote')!;
    const context = makeMockContext({ id: 'abc' });
    await handler(context);
    assert.equal(context.status, 400);
    assert.deepEqual(context.body, { error: 'invalid_request' });
  });

  test('401 on a failed session', async () => {
    const routes = register(
      makeDeps({
        requireAuthenticatedSession: async () => ({
          ok: false,
          reason: 'no token',
          code: 'missing_token',
        }),
      }),
      makeLogic(),
    );
    const handler = routes.post.get('/api/feedback/:id/vote')!;
    const context = makeMockContext({ id: '42' });
    await handler(context);
    assert.equal(context.status, 401);
    assert.deepEqual(context.body, { error: 'missing_token' });
  });
});

describe('DELETE /api/feedback/:id/vote (WP-604)', () => {
  test('200 { voted: false, voteCount } on a retract', async () => {
    const routes = register(makeDeps(), makeLogic({ countVotesForItem: async () => 2 }));
    const handler = routes.delete.get('/api/feedback/:id/vote')!;
    const context = makeMockContext({ id: '42' });
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { voted: false, voteCount: 2 });
  });

  test('200 { voted: false } even when the caller had not voted (idempotent)', async () => {
    const routes = register(
      makeDeps(),
      makeLogic({ removeVote: async () => 'not_voted', countVotesForItem: async () => 0 }),
    );
    const handler = routes.delete.get('/api/feedback/:id/vote')!;
    const context = makeMockContext({ id: '42' });
    await handler(context);
    assert.equal(context.status, 200);
    assert.deepEqual(context.body, { voted: false, voteCount: 0 });
  });
});
