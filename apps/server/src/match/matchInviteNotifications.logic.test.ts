/**
 * Tests — Match Invite Notifications (WP-358 / EC-388).
 *
 * The fail-open boundary is exercised with a fake `pg` pool (canned identity
 * rows) and a fake `BrevoTransactionalSender` — no DB or network. Covers the
 * happy path (correct recipient + template + params, no `accountId`) and the
 * fail-open cases (sender throws / undefined sender / missing template id /
 * unresolvable recipient), each of which must resolve, never reject.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  notifyMatchInvite,
  type MatchInviteNotificationConfig,
} from './matchInviteNotifications.logic.js';
import type { BrevoTransactionalSender } from '../marketing/brevoTransactional.logic.js';
import type { AccountId, DatabaseClient } from '../identity/identity.types.js';

interface PlayerRow {
  ext_id: string;
  email: string;
  display_handle: string | null;
  display_name: string;
}

function makeFakePool(rows: PlayerRow[]): DatabaseClient {
  return { query: async () => ({ rows }) } as unknown as DatabaseClient;
}

interface CapturedSend {
  to: string;
  templateId: number;
  params: Record<string, string>;
}

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

const INVITER = 'acc-inviter' as AccountId;
const INVITEE = 'acc-invitee' as AccountId;

const IDENTITY_ROWS: PlayerRow[] = [
  {
    ext_id: 'acc-invitee',
    email: 'invitee@example.com',
    display_handle: 'recip',
    display_name: 'Recip',
  },
  {
    ext_id: 'acc-inviter',
    email: 'inviter@example.com',
    display_handle: 'nova',
    display_name: 'Nova',
  },
];

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

test('notifyMatchInvite emails the invitee with the inviter handle params (no accountId)', async () => {
  const { sender, sends } = makeFakeSender();
  const config: MatchInviteNotificationConfig = { sender, templateId: 77 };
  await notifyMatchInvite(makeFakePool(IDENTITY_ROWS), config, {
    inviterAccountId: INVITER,
    inviteeAccountId: INVITEE,
    matchId: 'match-1',
  });
  assert.equal(sends.length, 1);
  const [send] = sends;
  assert.ok(send);
  assert.equal(send.to, 'invitee@example.com');
  assert.equal(send.templateId, 77);
  assert.deepEqual(send.params, { inviterHandle: 'nova', inviterDisplayName: 'Nova' });
  // No accountId / ext_id ever appears in the email params (FR-2).
  assert.deepEqual(Object.keys(send.params).sort(), ['inviterDisplayName', 'inviterHandle']);
});

test('fail-open: a throwing sender resolves (warns) and never rejects', async () => {
  const { sender, sends } = makeFakeSender(true);
  const config: MatchInviteNotificationConfig = { sender, templateId: 77 };
  const warnCount = await withWarnCount(() =>
    notifyMatchInvite(makeFakePool(IDENTITY_ROWS), config, {
      inviterAccountId: INVITER,
      inviteeAccountId: INVITEE,
      matchId: 'match-1',
    }),
  );
  assert.equal(sends.length, 0);
  assert.equal(warnCount, 1);
});

test('no-op: an undefined sender sends nothing and does not query the pool', async () => {
  const config: MatchInviteNotificationConfig = { sender: undefined, templateId: 77 };
  const throwingPool = {
    query: async () => {
      throw new Error('pool must not be queried when sender is undefined');
    },
  } as unknown as DatabaseClient;
  await notifyMatchInvite(throwingPool, config, {
    inviterAccountId: INVITER,
    inviteeAccountId: INVITEE,
    matchId: 'match-1',
  });
});

test('no-op: a missing template id sends nothing', async () => {
  const { sender, sends } = makeFakeSender();
  const config: MatchInviteNotificationConfig = { sender, templateId: undefined };
  const throwingPool = {
    query: async () => {
      throw new Error('pool must not be queried when the template id is unset');
    },
  } as unknown as DatabaseClient;
  await notifyMatchInvite(throwingPool, config, {
    inviterAccountId: INVITER,
    inviteeAccountId: INVITEE,
    matchId: 'match-1',
  });
  assert.equal(sends.length, 0);
});

test('fail-open: an unresolvable invitee warns and resolves without sending', async () => {
  const { sender, sends } = makeFakeSender();
  const config: MatchInviteNotificationConfig = { sender, templateId: 77 };
  // Only the inviter resolves; the invitee row is absent.
  const inviterOnly: PlayerRow[] = [
    {
      ext_id: 'acc-inviter',
      email: 'inviter@example.com',
      display_handle: 'nova',
      display_name: 'Nova',
    },
  ];
  const warnCount = await withWarnCount(() =>
    notifyMatchInvite(makeFakePool(inviterOnly), config, {
      inviterAccountId: INVITER,
      inviteeAccountId: INVITEE,
      matchId: 'match-1',
    }),
  );
  assert.equal(sends.length, 0);
  assert.equal(warnCount, 1);
});
