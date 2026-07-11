/**
 * Brevo Transactional Sender — Server Layer (WP-353)
 *
 * The transactional-email adapter the marketing layer previously lacked.
 * `enqueuePlayerToMarketingList` (WP-293) only adds a contact to a
 * marketing list (`POST /v3/contacts`); there was no path to send a
 * template-driven transactional email. This module adds a SEPARATE
 * injectable adapter over `POST /v3/smtp/email` — it does NOT modify the
 * WP-293 `BrevoClient` contract.
 *
 * `createBrevoTransactionalSender` is the thin production adapter over
 * Node's built-in `fetch` (an injectable parameter so the adapter is
 * testable without global stubbing — the caller-injected-provider
 * pattern, D-5306). It throws on any non-2xx response; the caller (the
 * `friendshipNotifications` boundary) is the single fail-open point that
 * swallows the throw.
 *
 * Layer-boundary contract: imports nothing from the game engine, the
 * registry, the pre-planning package, the boardgame framework, or any UI
 * package. The only runtime dependency is the global `fetch`.
 *
 * Authority: WP-353 §Scope (In) §A; EC-383 §Locked Values; D-24145;
 * D-24077 (fail-open lives in the caller); D-5306 (injectable fetch).
 */

/**
 * Narrow sender for one template-driven transactional email. The
 * production implementation (`createBrevoTransactionalSender`) backs this
 * with `fetch`; tests inject a fake. `sendTemplateEmail` resolves on a
 * 2xx response and throws on any non-2xx or transport failure — the
 * caller (`notifyFriendRequest*`) is the single fail-open boundary that
 * swallows the throw.
 *
 * Declared here (NOT in `brevoClient.types.ts`) so the WP-293 contact-
 * client contract stays byte-identical.
 */
export interface BrevoTransactionalSender {
  sendTemplateEmail(params: {
    to: string;
    templateId: number;
    params: Record<string, string>;
  }): Promise<void>;
}

/**
 * Build the production `BrevoTransactionalSender` backed by `fetch`.
 * Sends a template email via `POST https://api.brevo.com/v3/smtp/email`
 * with `{ to: [{ email }], templateId, params }`; the copy and design
 * live in the Brevo dashboard template (marketing-repo authority), not
 * in this request. Throws a full-sentence error on any non-2xx response
 * so the caller's fail-open boundary can swallow it.
 *
 * @param apiKey The Brevo API key (server env `BREVO_API_KEY`).
 * @param fetchImpl Injectable fetch (defaults to the global `fetch`);
 *   tests pass a fake to avoid network access.
 * @returns A `BrevoTransactionalSender` implementation.
 */
export function createBrevoTransactionalSender(
  apiKey: string,
  fetchImpl: typeof fetch = globalThis.fetch,
): BrevoTransactionalSender {
  return {
    /**
     * Send one template email to a single recipient. Throws on non-2xx.
     *
     * @param params The recipient email, Brevo template id, and template
     *   params.
     * @returns A promise resolving on a 2xx response.
     */
    async sendTemplateEmail(params: {
      to: string;
      templateId: number;
      params: Record<string, string>;
    }): Promise<void> {
      const response = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          to: [{ email: params.to }],
          templateId: params.templateId,
          params: params.params,
        }),
      });
      if (response.ok === false) {
        const responseBody = await response.text().catch(() => '');
        throw new Error(
          'Brevo transactional send returned HTTP ' +
            String(response.status) +
            ' when sending a template email; check BREVO_API_KEY and the friend-notification template id envs (BREVO_FRIEND_REQUEST_TEMPLATE_ID / BREVO_FRIEND_ACCEPTED_TEMPLATE_ID). Response body: ' +
            responseBody.slice(0, 200),
        );
      }
    },
  };
}
