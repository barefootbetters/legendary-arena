/**
 * Parse a user-entered "match reference" into a boardgame.io match ID.
 *
 * The lobby's "Join by match ID or link" input accepts two shapes: a raw
 * match ID (e.g. `KdHnMXaOPin`), or a full copy-join-link produced by the
 * waiting-room panel (`${origin}/?route=lobby&match=<id>`, WP-369). This
 * helper reduces either shape to the bare match ID so the join path can
 * fetch that match and seat the player.
 *
 * Pure: no I/O, no boardgame.io import, no DOM access. Returns `null` for
 * anything it cannot confidently reduce to a match ID (empty input, a URL
 * with no `match` param, or a token with characters outside the
 * boardgame.io `nanoid` alphabet), so the caller can render inline "enter a
 * match ID or invite link" copy instead of firing a doomed fetch.
 */

// why: boardgame.io mints match IDs with `nanoid(11)`, whose default
// alphabet is exactly URL-safe base64 without padding — letters, digits,
// underscore, and hyphen. A bare token is only treated as an ID when it
// matches this alphabet; anything else (spaces, slashes, punctuation) is
// rejected as malformed rather than sent to the server as a guaranteed 404.
const RAW_MATCH_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/**
 * Extract a match ID from a raw ID or an invite-link URL. Returns the match
 * ID string, or `null` when the input is empty or cannot be parsed.
 */
export function parseMatchReference(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }

  const questionMarkIndex = trimmed.indexOf('?');
  if (questionMarkIndex !== -1) {
    // why: read the query from just after the first `?` up to any `#`
    // fragment — `URLSearchParams` does not strip a trailing fragment, so
    // without this a link like `...&match=ID#section` would yield
    // `ID#section` and 404. The copy-join-link never appends a fragment,
    // but a hand-edited or browser-copied URL might.
    const hashIndex = trimmed.indexOf('#', questionMarkIndex);
    const query =
      hashIndex === -1
        ? trimmed.slice(questionMarkIndex + 1)
        : trimmed.slice(questionMarkIndex + 1, hashIndex);
    const matchId = new URLSearchParams(query).get('match');
    if (matchId === null || matchId.trim() === '') {
      return null;
    }
    return matchId.trim();
  }

  if (RAW_MATCH_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  return null;
}
