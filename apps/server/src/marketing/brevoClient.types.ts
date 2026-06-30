/**
 * Brevo Client Types — Server Layer (WP-293)
 *
 * Minimal caller-injected client interface for adding a contact to a
 * Brevo marketing list. Mirrors the `AvatarR2Client` structural pattern
 * (WP-106): a narrow interface the production factory implements and
 * tests fake, so no module-level singleton and no global `fetch`
 * stubbing are needed.
 *
 * Authority: WP-293 §A; D-24077 (fire-and-forget / fail-open);
 * D-24078 (existing newsletter list + double-opt-in consent).
 */

/**
 * Narrow client for adding a contact to a Brevo list. The production
 * implementation (`createBrevoClient`) backs this with Node's built-in
 * `fetch`; tests inject a fake. `addContactToList` resolves on success
 * and throws on any non-2xx response or transport failure — the caller
 * (`enqueuePlayerToMarketingList`) is the single fail-open boundary that
 * swallows the throw.
 */
export interface BrevoClient {
  addContactToList(params: {
    email: string;
    listId: number;
  }): Promise<void>;
}
