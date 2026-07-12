/**
 * Match Invite Notifications — Server Layer (WP-358)
 *
 * The single fail-open boundary for the match-invite email. `notifyMatchInvite`
 * resolves the invitee's email + the inviter's `@handle` / display name,
 * builds the Brevo template params, and sends a transactional email —
 * swallowing EVERY failure so the invite response is never delayed or failed
 * (fail-open, D-24077; mirrors the WP-353 `sendFriendNotification` boundary).
 *
 * Always resolves `Promise<void>`; NEVER rejects: an unconfigured sender, an
 * unset template id, an unresolvable recipient, a Brevo outage, or an HTTP
 * error all degrade to a `console.warn`. Callers fire it fire-and-forget
 * (`void notifyMatchInvite(...)`).
 *
 * Layer-boundary contract: imports the same-layer transactional sender + `pg`
 * types only. No `accountId` ever appears in an email param (FR-2).
 *
 * Authority: WP-358 §Scope (In) §D; EC-388; D-24150; D-24077 (fail-open);
 * D-24080 (unconfigured -> no-op).
 */

import type { AccountId, DatabaseClient } from '../identity/identity.types.js';
import type { BrevoTransactionalSender } from '../marketing/brevoTransactional.logic.js';

/**
 * Injected config for the match-invite email. An `undefined` `sender`
 * (Brevo unconfigured) or an unset `templateId` disables the email (no-op).
 */
export interface MatchInviteNotificationConfig {
  readonly sender: BrevoTransactionalSender | undefined;
  readonly templateId: number | undefined;
}

/**
 * The parties an invite notification spans: the `inviter` (whose `@handle`
 * appears in the email) and the `invitee` (who is emailed).
 */
interface InviteNotificationParties {
  readonly inviterAccountId: AccountId;
  readonly inviteeAccountId: AccountId;
  readonly matchId: string;
}

/**
 * One account's resolved identity fields.
 */
interface ResolvedInviteIdentity {
  readonly email: string;
  readonly displayHandle: string | null;
  readonly displayName: string;
}

/**
 * Resolve the invitee + inviter identity fields in ONE round-trip. An account
 * with no row is absent from the map (the caller treats that as unresolvable
 * -> no-op).
 */
async function resolveInviteIdentities(
  pool: DatabaseClient,
  accountIds: readonly AccountId[],
): Promise<Map<string, ResolvedInviteIdentity>> {
  const result = await pool.query(
    'SELECT ext_id, email, display_handle, display_name FROM legendary.players ' +
      'WHERE ext_id = ANY($1::text[])',
    [[...accountIds]],
  );
  const byAccountId = new Map<string, ResolvedInviteIdentity>();
  for (const row of result.rows) {
    byAccountId.set(row.ext_id, {
      email: row.email,
      displayHandle: row.display_handle,
      displayName: row.display_name,
    });
  }
  return byAccountId;
}

/**
 * Notify the invitee that the inviter invited them to a game. Fail-open:
 * always resolves, never rejects. Fired fire-and-forget from the
 * `POST /api/match/invites` handler after a successful `createMatchInvite`.
 * The email params reference the inviter's `@handle` + display name only —
 * NEVER an `accountId` (FR-2).
 */
export async function notifyMatchInvite(
  pool: DatabaseClient,
  config: MatchInviteNotificationConfig,
  parties: InviteNotificationParties,
): Promise<void> {
  // why: D-24080 — an unconfigured sender or an unset template id is a clean
  // no-op, not an error.
  if (config.sender === undefined || config.templateId === undefined) {
    return;
  }
  try {
    const identities = await resolveInviteIdentities(pool, [
      parties.inviteeAccountId,
      parties.inviterAccountId,
    ]);
    const invitee = identities.get(parties.inviteeAccountId);
    const inviter = identities.get(parties.inviterAccountId);
    if (invitee === undefined || inviter === undefined) {
      // why: D-24077 — an unresolvable party (race against deletion) is
      // fail-open: warn and send nothing.
      console.warn(
        'A match-invite email was skipped because the invitee or inviter account could not be resolved; the invite itself is unaffected.',
      );
      return;
    }
    await config.sender.sendTemplateEmail({
      to: invitee.email,
      templateId: config.templateId,
      params: {
        inviterHandle: inviter.displayHandle ?? inviter.displayName,
        inviterDisplayName: inviter.displayName,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // why: D-24077 — the match-invite email is fail-open; a Brevo outage or
    // HTTP error must never propagate into the invite response.
    console.warn(
      'Sending a match-invite email failed; the invite itself is unaffected. Underlying error: ' +
        errorMessage,
    );
  }
}
