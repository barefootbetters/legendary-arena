/**
 * Public profile URL for a claimed handle (WP-579 / D-24388).
 *
 * Shared by the leaderboard panels so a claimed-handle row links to the
 * player's profile. `handleCanonical` is percent-encoded (defends against a
 * handle that contains URL-significant characters).
 *
 * @param handleCanonical The canonicalized claimed handle (the URL key).
 * @returns The absolute profile URL on the play surface.
 */
export function profileHref(handleCanonical: string): string {
  return `https://play.legendary-arena.com/?profile=${encodeURIComponent(handleCanonical)}`;
}
