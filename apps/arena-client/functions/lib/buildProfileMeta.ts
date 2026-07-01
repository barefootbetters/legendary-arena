/**
 * Profile Link-Preview Meta Composition — Client App edge subsurface (WP-300)
 *
 * Pure, framework-free, I/O-free composition of the Open Graph / Twitter
 * Card `<meta>` tag set injected into the served HTML `<head>` by the
 * Cloudflare Pages middleware (`apps/arena-client/functions/_middleware.ts`)
 * so a shared `?profile=<handle>` link unfurls into a rich preview card in
 * crawlers (Discord, X, iMessage, Slack) that do not run the SPA.
 *
 * Layer-boundary contract (D-24085): this module belongs to the `client-app`
 * category as an edge subsurface. It imports no game framework, no engine
 * runtime, no registry package, no pre-plan package, and no database client,
 * and computes no game outcomes. The
 * profile read-shape is re-declared locally (`PublicProfileMetaInput`)
 * rather than imported from the server layer — the same engine/server
 * isolation pattern as `apps/arena-client/src/lib/api/profileApi.ts`.
 *
 * Determinism: the function is fully deterministic given its inputs — no
 * time, randomness, or ambient state — so it is unit-tested in isolation.
 *
 * Authority: WP-300 §Scope (In) §A; EC-331 §Locked Values; D-24085.
 */

// why: the site origin that serves the SPA shell and the static brand OG
// image. og:url and og:image MUST be absolute URLs — most crawlers reject
// a relative og:image — so both are composed against this origin rather
// than emitted as bare paths. Locked to play.legendary-arena.com per
// WP-300 §Locked contract values (canonical profile URL).
const SITE_ORIGIN = 'https://play.legendary-arena.com';

// why: the locked static brand card path (1200×630) served from the
// arena-client origin. v1 uses one brand image for every profile — no
// per-player/avatar card until avatarUrl is added to the public contract
// (WP-052 / D-5201; deferred follow-up). WP-300 §Locked contract values.
const OG_IMAGE_PATH = '/og/profile-card.png';

/**
 * The subset of `PublicProfileView` (server:
 * `apps/server/src/profile/profile.types.ts`) this helper reads, declared
 * locally by structural compatibility. Only counts and the two display
 * fields are needed; the array element shapes are irrelevant here, so they
 * are typed as opaque `unknown[]` — the helper reads `.length` only.
 */
export interface PublicProfileMetaInput {
  readonly displayName: string;
  readonly displayHandle: string;
  readonly badges: readonly unknown[];
  readonly teamAffiliations: readonly unknown[];
  readonly publicReplays: readonly unknown[];
}

/**
 * A single `<meta>` tag descriptor. `attribute` selects the identifying
 * attribute — `property` for Open Graph (`og:*`), `name` for Twitter Card
 * (`twitter:*`). `content` is already HTML-attribute-escaped and safe to
 * splice into a double-quoted attribute value.
 */
export interface MetaTag {
  readonly attribute: 'property' | 'name';
  readonly key: string;
  readonly content: string;
}

/**
 * The composed, ordered, fully-escaped tag set the middleware appends to
 * `<head>`. Ordered for a stable, reviewable injection sequence.
 */
export interface ProfileMetaTags {
  readonly tags: readonly MetaTag[];
}

// why: display fields (displayName / displayHandle) are user-controlled and
// flow into double-quoted HTML attribute values; without escaping, a value
// like `"><script>` would break out of the attribute and inject markup into
// the served head. Escaping every emitted value is the load-bearing safety
// property of this packet (WP-300 §Non-Negotiable Constraints). `&` is
// escaped first so the entity ampersands introduced by the later
// replacements are not double-escaped.
/**
 * HTML-attribute-escape a string for safe inclusion inside a double-quoted
 * attribute value. Escapes `&`, `<`, `>`, `"`, and `'`.
 *
 * @param value The raw string to escape.
 * @returns The escaped string.
 */
export function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Append `count` to `singular`, pluralizing the noun with a trailing `s`
 * when the count is not exactly one. Used to build the §23-compliant
 * description sentence (e.g. `3 badges`, `1 team affiliation`).
 *
 * @param count The count to render.
 * @param singular The singular noun.
 * @returns A `<count> <noun[s]>` phrase.
 */
function pluralize(count: number, singular: string): string {
  const noun = count === 1 ? singular : `${singular}s`;
  return `${count} ${noun}`;
}

/**
 * Compose the §23-compliant description sentence from the profile's public
 * counts. Names only what the profile shows — badges earned, team
 * affiliations, public replays — and never win/loss, rank, opponent, or
 * challenge (player-vs-player combat) framing (Vision §23; a test guard in
 * `buildProfileMeta.test.ts` asserts the absence of those terms).
 *
 * @param title The already-resolved display title (name or handle).
 * @param profile The profile counts source.
 * @returns The raw (unescaped) description sentence.
 */
function composeDescription(
  title: string,
  profile: PublicProfileMetaInput,
): string {
  const badgePhrase = pluralize(profile.badges.length, 'badge');
  const teamPhrase = pluralize(profile.teamAffiliations.length, 'team affiliation');
  const replayPhrase = pluralize(profile.publicReplays.length, 'public replay');
  return `${title} on Legendary Arena — ${badgePhrase}, ${teamPhrase}, ${replayPhrase}.`;
}

/**
 * Build the Open Graph + Twitter Card meta tag set for a public profile.
 * Every returned `content` value is HTML-attribute-escaped. The tag set is
 * fixed and locked (WP-300 §Locked contract values): `og:type`, `og:title`,
 * `og:description`, `og:image`, `og:url`, `twitter:card`, `twitter:title`,
 * `twitter:description`, `twitter:image`.
 *
 * @param profile The public profile read-shape (counts + display fields).
 * @param handle The validated handle (matches `^[a-z][a-z0-9_]{2,23}$`),
 *   used to compose the canonical `og:url`.
 * @returns The composed, ordered, escaped tag set.
 */
export function buildProfileMeta(
  profile: PublicProfileMetaInput,
  handle: string,
): ProfileMetaTags {
  const title =
    profile.displayName.trim().length > 0
      ? profile.displayName
      : profile.displayHandle;
  const description = composeDescription(title, profile);
  const profileUrl = `${SITE_ORIGIN}/?profile=${handle}`;
  const imageUrl = `${SITE_ORIGIN}${OG_IMAGE_PATH}`;

  const escapedTitle = escapeHtmlAttribute(title);
  const escapedDescription = escapeHtmlAttribute(description);
  const escapedImage = escapeHtmlAttribute(imageUrl);
  const escapedUrl = escapeHtmlAttribute(profileUrl);

  const tags: MetaTag[] = [
    { attribute: 'property', key: 'og:type', content: escapeHtmlAttribute('profile') },
    { attribute: 'property', key: 'og:title', content: escapedTitle },
    { attribute: 'property', key: 'og:description', content: escapedDescription },
    { attribute: 'property', key: 'og:image', content: escapedImage },
    { attribute: 'property', key: 'og:url', content: escapedUrl },
    {
      attribute: 'name',
      key: 'twitter:card',
      content: escapeHtmlAttribute('summary_large_image'),
    },
    { attribute: 'name', key: 'twitter:title', content: escapedTitle },
    { attribute: 'name', key: 'twitter:description', content: escapedDescription },
    { attribute: 'name', key: 'twitter:image', content: escapedImage },
  ];

  return { tags };
}
