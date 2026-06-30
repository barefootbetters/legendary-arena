/**
 * Brevo Marketing Enqueue — Server Layer (WP-293)
 *
 * `enqueuePlayerToMarketingList` is the SINGLE fail-open boundary for
 * adding a newly provisioned player's verified email to the existing
 * Brevo newsletter list. It NEVER throws and NEVER rejects: a Brevo
 * outage, an HTTP error, or an unconfigured client degrades to a
 * `console.warn`, and account provisioning is unaffected (D-24077).
 * `createBrevoClient` is the thin production adapter over Node's
 * built-in `fetch` — `fetch` is an injectable parameter so the adapter
 * is testable without global stubbing (the caller-injected-provider
 * pattern, D-5306).
 *
 * Layer-boundary contract: imports nothing from boardgame.io, the
 * engine / registry / pre-planning / UI packages. The only runtime
 * dependency is the global `fetch`.
 *
 * Authority: WP-293 §B; D-24077 (fail-open); D-24078 (list + consent);
 * D-24080 (unconfigured → no-op, never fatal).
 */

import type { BrevoClient } from './brevoClient.types.js';
import type { ProvisionedAccount } from '../auth/accountProvisioning.logic.js';

/**
 * Best-effort, fail-open add of a provisioned player's email to the
 * Brevo marketing list. If `brevoClient` is `undefined` (marketing not
 * configured), returns immediately. Otherwise it adds the contact and
 * swallows any failure with a full-sentence warning. This function is
 * the only place the fail-open guarantee lives, so callers do not need
 * their own try/catch.
 *
 * @param account The newly provisioned account (supplies the email).
 * @param brevoClient The injected client, or `undefined` when marketing
 *   is unconfigured.
 * @param listId The Brevo newsletter list id to add the contact to.
 * @returns A promise that always resolves (never rejects).
 */
export async function enqueuePlayerToMarketingList(
  account: ProvisionedAccount,
  brevoClient: BrevoClient | undefined,
  listId: number,
): Promise<void> {
  if (brevoClient === undefined) {
    // why: D-24080 — marketing unconfigured is a clean no-op, not an error
    return;
  }
  try {
    await brevoClient.addContactToList({ email: account.email, listId });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    // why: D-24077 — marketing enqueue is fail-open; a failure here must
    // never propagate into the account-provisioning result
    console.warn(
      'Adding the new account email to the Brevo marketing list failed; account provisioning is unaffected. Underlying error: ' +
        errorMessage,
    );
  }
}

/**
 * Build the production `BrevoClient` backed by `fetch`. Adds a contact
 * to a list via `POST https://api.brevo.com/v3/contacts` with
 * `updateEnabled: true`; double-opt-in is configured at the Brevo list
 * level (marketing-repo authority), not in this request. Throws a
 * full-sentence error on any non-2xx response so the caller's fail-open
 * boundary can swallow it.
 *
 * @param apiKey The Brevo API key (server env `BREVO_API_KEY`).
 * @param fetchImpl Injectable fetch (defaults to the global `fetch`);
 *   tests pass a fake to avoid network access.
 * @returns A `BrevoClient` implementation.
 */
export function createBrevoClient(
  apiKey: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): BrevoClient {
  return {
    /**
     * Add one contact to the given Brevo list. Throws on non-2xx.
     *
     * @param params The contact email and target list id.
     * @returns A promise resolving on a 2xx response.
     */
    async addContactToList(params: {
      email: string;
      listId: number;
    }): Promise<void> {
      const response = await fetchImpl('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          email: params.email,
          listIds: [params.listId],
          updateEnabled: true,
        }),
      });
      if (response.ok === false) {
        const responseBody = await response.text().catch(() => '');
        throw new Error(
          'Brevo contact creation returned HTTP ' +
            String(response.status) +
            ' when adding an email to the marketing list; check BREVO_API_KEY and BREVO_LIST_ID. Response body: ' +
            responseBody.slice(0, 200),
        );
      }
    },
  };
}
