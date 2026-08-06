/**
 * Player-identifier discriminator — Arena Client (WP-504)
 *
 * The add-friend input accepts either an `@handle` or a pasted Account
 * ID (a UUID). `parsePlayerIdentifier` decides which the raw string is so
 * the caller can send the matching request body field. It is the
 * client-side twin of the server's `isWellFormedAccountId` shape guard —
 * a well-formed UUID is treated as an Account ID; anything else is a
 * handle. The server remains the sole authority on whether either
 * actually resolves to a player.
 *
 * Layer-boundary contract: pure. No I/O, and it imports nothing from any
 * server package — the UUID shape is duplicated here by intent, not
 * shared across the client/server boundary.
 *
 * Authority: WP-504 §Scope (In); EC-539 §Locked Values; D-24308.
 */

// why: general UUID shape (`8-4-4-4-12` hex, any version / variant
// nibble), matched case-insensitively — identical to the server's
// `isWellFormedAccountId`. A well-formed UUID is routed as an Account ID;
// existence is the server's call, never this parser's.
const ACCOUNT_ID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Discriminate a raw add-friend input into a handle or an Account ID.
 * Trims surrounding whitespace; strips a single leading `@`; an empty
 * result yields `null` (nothing to send). A well-formed UUID becomes
 * `{ kind: 'accountId' }`; anything else becomes `{ kind: 'handle' }`.
 */
export function parsePlayerIdentifier(
  raw: string,
):
  | { kind: 'handle'; value: string }
  | { kind: 'accountId'; value: string }
  | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return null;
  }
  // Strip exactly one leading `@` so both `nova` and `@nova` resolve to
  // the same handle; an Account ID is never `@`-prefixed.
  const withoutLeadingAt = trimmed.startsWith('@')
    ? trimmed.slice(1)
    : trimmed;
  if (withoutLeadingAt.length === 0) {
    return null;
  }
  if (ACCOUNT_ID_SHAPE.test(withoutLeadingAt)) {
    return { kind: 'accountId', value: withoutLeadingAt };
  }
  return { kind: 'handle', value: withoutLeadingAt };
}
