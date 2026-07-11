/**
 * Tests — Friendship Notifications (WP-353 / EC-383)
 *
 * The fail-open boundary is exercised with a fake `pg` pool (canned
 * identity rows) and a fake `BrevoTransactionalSender`. All branches are
 * covered without a real database or network: the happy path (correct
 * recipient + template + params, no `accountId`), and the four fail-open
 * cases (sender throws / undefined sender / missing template id /
 * unresolvable recipient) — each of which must resolve, never reject.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  notifyFriendRequestReceived,
  notifyFriendRequestAccepted,
  type FriendshipNotificationConfig,
} from './friendshipNotifications.logic.js';
import type { BrevoTransactionalSender } from '../marketing/brevoTransactional.logic.js';
import type { AccountId, DatabaseClient } from '../identity/identity.types.js';

interface PlayerRow {
  ext_id: string;
  email: string;
  display_handle: string | null;
  display_name: string;
}

/**
 * A fake `DatabaseClient` whose `query` returns the given rows regardless
 * of the SQL — enough to drive `resolveIdentities`.
 */
function makeFakePool(rows: PlayerRow[]): DatabaseClient {
  return {
    query: async () => ({ rows }),
  } as unknown as DatabaseClient;
}

interface CapturedSend {
  to: string;
  templateId: number;
  params: Record<string, string>;
}

/**
 * A fake sender that records the send, or throws if `shouldThrow`.
 */
function makeFakeSender(shouldThrow = false): {
  sender: BrevoTransactionalSender;
  sends: CapturedSend[];
} {
  const sends: CapturedSend[] = [];
  const sender: BrevoTransactionalSender = {
    async sendTemplateEmail(params) {
      if (shouldThrow === true) {
        throw new Error('Brevo transactional send is down');
      }
      sends.push(params);
    },
  };
  return { sender, sends };
}

const ACTOR = 'acc-actor' as AccountId;
const RECIPIENT = 'acc-recipient' as AccountId;

const IDENTITY_ROWS: PlayerRow[] = [
  {
    ext_id: 'acc-recipient',
    email: 'recipient@example.com',
    display_handle: 'recip',
    display_name: 'Recip',
  },
  {
    ext_id: 'acc-actor',
    email: 'actor@example.com',
    display_handle: 'nova',
    display_name: 'Nova',
  },
];

/**
 * Run a function with `console.warn` swallowed, returning the warn count.
 */
async function withWarnCount(run: () => Promise<void>): Promise<number> {
  const originalWarn = console.warn;
  let warnCount = 0;
  console.warn = () => {
    warnCount += 1;
  };
  try {
    await run();
  } finally {
    console.warn = originalWarn;
  }
  return warnCount;
}

test('notifyFriendRequestReceived sends to the recipient with the actor handle params (no accountId)', async () => {
  const { sender, sends } = makeFakeSender();
  const config: FriendshipNotificationConfig = {
    sender,
    requestTemplateId: 42,
    acceptedTemplateId: 99,
  };
  await notifyFriendRequestReceived(makeFakePool(IDENTITY_ROWS), config, {
    actorAccountId: ACTOR,
    recipientAccountId: RECIPIENT,
  });
  assert.equal(sends.length, 1);
  const [send] = sends;
  assert.ok(send);
  assert.equal(send.to, 'recipient@example.com');
  assert.equal(send.templateId, 42);
  assert.deepEqual(send.params, { actorHandle: 'nova', actorDisplayName: 'Nova' });
  // No accountId / ext_id ever appears in the email params (FR-2).
  assert.deepEqual(Object.keys(send.params).sort(), ['actorDisplayName', 'actorHandle']);
});

test('notifyFriendRequestAccepted uses the accepted template id', async () => {
  const { sender, sends } = makeFakeSender();
  const config: FriendshipNotificationConfig = {
    sender,
    requestTemplateId: 42,
    acceptedTemplateId: 99,
  };
  await notifyFriendRequestAccepted(makeFakePool(IDENTITY_ROWS), config, {
    actorAccountId: ACTOR,
    recipientAccountId: RECIPIENT,
  });
  assert.equal(sends.length, 1);
  assert.equal(sends[0]?.templateId, 99);
});

test('fail-open: a throwing sender resolves (warns) and never rejects', async () => {
  const { sender, sends } = makeFakeSender(true);
  const config: FriendshipNotificationConfig = {
    sender,
    requestTemplateId: 42,
    acceptedTemplateId: 99,
  };
  const warnCount = await withWarnCount(() =>
    notifyFriendRequestReceived(makeFakePool(IDENTITY_ROWS), config, {
      actorAccountId: ACTOR,
      recipientAccountId: RECIPIENT,
    }),
  );
  assert.equal(sends.length, 0);
  assert.equal(warnCount, 1);
});

test('no-op: an undefined sender sends nothing and does not throw', async () => {
  const config: FriendshipNotificationConfig = {
    sender: undefined,
    requestTemplateId: 42,
    acceptedTemplateId: 99,
  };
  // Pool query would throw if reached — proves the early no-op return.
  const throwingPool = {
    query: async () => {
      throw new Error('pool must not be queried when sender is undefined');
    },
  } as unknown as DatabaseClient;
  await notifyFriendRequestReceived(throwingPool, config, {
    actorAccountId: ACTOR,
    recipientAccountId: RECIPIENT,
  });
});

test('no-op: a missing template id sends nothing and does not throw', async () => {
  const { sender, sends } = makeFakeSender();
  const config: FriendshipNotificationConfig = {
    sender,
    requestTemplateId: undefined,
    acceptedTemplateId: 99,
  };
  const throwingPool = {
    query: async () => {
      throw new Error('pool must not be queried when the template id is unset');
    },
  } as unknown as DatabaseClient;
  await notifyFriendRequestReceived(throwingPool, config, {
    actorAccountId: ACTOR,
    recipientAccountId: RECIPIENT,
  });
  assert.equal(sends.length, 0);
});

test('fail-open: an unresolvable recipient warns and resolves without sending', async () => {
  const { sender, sends } = makeFakeSender();
  const config: FriendshipNotificationConfig = {
    sender,
    requestTemplateId: 42,
    acceptedTemplateId: 99,
  };
  // Only the actor resolves; the recipient row is absent.
  const actorOnly: PlayerRow[] = [
    {
      ext_id: 'acc-actor',
      email: 'actor@example.com',
      display_handle: 'nova',
      display_name: 'Nova',
    },
  ];
  const warnCount = await withWarnCount(() =>
    notifyFriendRequestReceived(makeFakePool(actorOnly), config, {
      actorAccountId: ACTOR,
      recipientAccountId: RECIPIENT,
    }),
  );
  assert.equal(sends.length, 0);
  assert.equal(warnCount, 1);
});
