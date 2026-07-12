/**
 * Friendship Notifications — Server Layer (WP-353)
 *
 * The single fail-open boundary for friend-request emails (packet #4 of
 * the Friends & Ranked Trust subsystem). `notifyFriendRequestReceived`
 * and `notifyFriendRequestAccepted` resolve the recipient's email plus
 * the actor's `@handle` / display name, build the Brevo template params,
 * and send a transactional email — swallowing EVERY failure so the
 * friend-request response is never delayed or failed (fail-open, D-24077;
 * mirrors the WP-293 `enqueuePlayerToMarketingList` boundary).
 *
 * Both functions ALWAYS resolve `Promise<void>` and NEVER reject: an
 * unconfigured sender, an unset template id, an unresolvable recipient, a
 * Brevo outage, or an HTTP error all degrade to a `console.warn`. Callers
 * fire them fire-and-forget (`void notify(...)`) with no try/catch of
 * their own.
 *
 * Layer-boundary contract: imports only the same-layer transactional
 * sender + `pg` types (via the identity `DatabaseClient` alias). Nothing
 * from the game engine, the registry, or the boardgame framework. No
 * `accountId` ever appears in an email param (FR-2).
 *
 * Authority: WP-353 §Scope (In) §B; EC-383 §Locked Values; D-24145;
 * D-24077 (fail-open); D-24080 (unconfigured → no-op).
 */

import type { AccountId, DatabaseClient } from '../identity/identity.types.js';
import type { BrevoTransactionalSender } from '../marketing/brevoTransactional.logic.js';

/**
 * The friend-notification config injected into the route handlers. Any
 * `undefined` field disables the corresponding notification: no
 * `sender` (Brevo unconfigured) disables both; an unset per-event
 * `templateId` disables just that event.
 */
export interface FriendshipNotificationConfig {
  readonly sender: BrevoTransactionalSender | undefined;
  readonly requestTemplateId: number | undefined;
  readonly acceptedTemplateId: number | undefined;
}

/**
 * The two accounts a notification spans: the `actor` (who sent or
 * accepted) and the `recipient` (who is emailed).
 */
interface NotificationParties {
  readonly actorAccountId: AccountId;
  readonly recipientAccountId: AccountId;
}

/**
 * The identity fields resolved from `legendary.players` for one account.
 */
interface ResolvedIdentity {
  readonly email: string;
  readonly displayHandle: string | null;
  readonly displayName: string;
  // why: WP-357 / D-24149 — the recipient's friend-request email opt-out.
  // Resolved via LEFT JOIN legendary.player_profiles + COALESCE(..., true)
  // so a never-edited account (no profiles row) defaults to TRUE (emails
  // on). When FALSE, sendFriendNotification skips the send as a clean no-op.
  readonly friendRequestEmails: boolean;
}

/**
 * Resolve the recipient's + actor's identity fields in ONE round-trip.
 * Returns a map keyed by `ext_id` (`AccountId`); an account with no row
 * is simply absent from the map (the caller treats that as
 * unresolvable → no-op).
 */
async function resolveIdentities(
  pool: DatabaseClient,
  accountIds: readonly AccountId[],
): Promise<Map<string, ResolvedIdentity>> {
  // why: WP-357 / D-24149 — the friend-request email opt-out is folded into
  // this existing round-trip via LEFT JOIN legendary.player_profiles (a
  // never-edited account has no profiles row) + COALESCE(..., true) so an
  // absent row/value defaults to TRUE (emails on; never accidentally
  // silences everyone). No second query, no N+1.
  const result = await pool.query(
    'SELECT p.ext_id, p.email, p.display_handle, p.display_name, ' +
      'COALESCE(pp.friend_request_emails, true) AS friend_request_emails ' +
      'FROM legendary.players p ' +
      'LEFT JOIN legendary.player_profiles pp ON pp.player_id = p.player_id ' +
      'WHERE p.ext_id = ANY($1::text[])',
    [[...accountIds]],
  );
  const byAccountId = new Map<string, ResolvedIdentity>();
  for (const row of result.rows) {
    byAccountId.set(row.ext_id, {
      email: row.email,
      displayHandle: row.display_handle,
      displayName: row.display_name,
      friendRequestEmails: row.friend_request_emails,
    });
  }
  return byAccountId;
}

/**
 * Build the Brevo template params for a friend notification. References
 * the actor's `@handle` + display name only — NEVER an `accountId`
 * (FR-2). `actorHandle` falls back to the display name when the actor
 * has no claimed handle (defensive; the send/accept routes require the
 * actor to have one).
 */
function buildParams(actor: ResolvedIdentity): Record<string, string> {
  return {
    actorHandle: actor.displayHandle ?? actor.displayName,
    actorDisplayName: actor.displayName,
  };
}

/**
 * Shared fail-open send: resolve both parties, and if the sender +
 * template id + recipient email are all present, send the template
 * email. EVERY failure (unconfigured sender, unset template id,
 * unresolvable recipient, Brevo/HTTP error) resolves to a `console.warn`
 * no-op. Always resolves; never rejects.
 */
async function sendFriendNotification(
  pool: DatabaseClient,
  sender: BrevoTransactionalSender | undefined,
  templateId: number | undefined,
  parties: NotificationParties,
  eventLabel: string,
): Promise<void> {
  // why: D-24080 — an unconfigured sender or an unset template id is a
  // clean no-op, not an error. Local/dev with no Brevo config sends
  // nothing and logs nothing alarming.
  if (sender === undefined || templateId === undefined) {
    return;
  }
  try {
    const identities = await resolveIdentities(pool, [
      parties.recipientAccountId,
      parties.actorAccountId,
    ]);
    const recipient = identities.get(parties.recipientAccountId);
    const actor = identities.get(parties.actorAccountId);
    if (recipient === undefined || actor === undefined) {
      // why: D-24077 — an unresolvable recipient/actor (race against
      // deletion) is fail-open: warn and send nothing.
      console.warn(
        'A friend-request email (' +
          eventLabel +
          ') was skipped because the recipient or actor account could not be resolved; the friend request itself is unaffected.',
      );
      return;
    }
    if (recipient.friendRequestEmails === false) {
      // why: WP-357 / D-24149 — the recipient opted out of friend-request
      // emails. This is a normal outcome, NOT a failure, so it is a clean
      // no-op with NO console.warn (distinct from the D-24077 fail-open
      // warns above/below, which surface real send failures). The friend
      // request itself is unaffected.
      return;
    }
    await sender.sendTemplateEmail({
      to: recipient.email,
      templateId,
      params: buildParams(actor),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // why: D-24077 — friend-request email is fail-open; a Brevo outage or
    // HTTP error must never propagate into the friend-request response.
    console.warn(
      'Sending a friend-request email (' +
        eventLabel +
        ') failed; the friend request itself is unaffected. Underlying error: ' +
        errorMessage,
    );
  }
}

/**
 * Notify the ADDRESSEE that they received a friend request from the
 * actor. Fail-open: always resolves, never rejects. Fired
 * fire-and-forget from the `POST /api/me/friends/requests` handler after
 * a successful `sendFriendRequest`.
 */
export async function notifyFriendRequestReceived(
  pool: DatabaseClient,
  config: FriendshipNotificationConfig,
  parties: NotificationParties,
): Promise<void> {
  await sendFriendNotification(
    pool,
    config.sender,
    config.requestTemplateId,
    parties,
    'request received',
  );
}

/**
 * Notify the ORIGINAL REQUESTER that the addressee accepted their friend
 * request. Fail-open: always resolves, never rejects. Fired
 * fire-and-forget from the `POST …/requests/:handle/accept` handler after
 * a successful `acceptFriendRequest`.
 */
export async function notifyFriendRequestAccepted(
  pool: DatabaseClient,
  config: FriendshipNotificationConfig,
  parties: NotificationParties,
): Promise<void> {
  await sendFriendNotification(
    pool,
    config.sender,
    config.acceptedTemplateId,
    parties,
    'request accepted',
  );
}
