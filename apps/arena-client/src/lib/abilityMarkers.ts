/**
 * Ability-text marker parsing for the play surface.
 *
 * Card ability / scheme / mastermind text arrives from the engine projection
 * with inline markup: `[icon:attack]`, `[hc:strength]`, `[keyword:Patrol]`,
 * `[rule:Shards]`, `[team:X-Men]`. The CardReaderModal renders these lines, so
 * the markup must be turned into readable glyphs / labels instead of showing
 * the raw `[hc:strength]` brackets to the player.
 *
 * This mirrors the canonical tokenizer in the registry-viewer
 * (`apps/registry-viewer/src/composables/useRules.ts` — `parseAbilityText`,
 * `HERO_CLASS_LABELS`, and the `CardDetail.vue` icon glyph map). The two apps
 * are separate surfaces and may not import each other, so the small parser and
 * label maps are duplicated here verbatim. If the registry-viewer parser or its
 * glyph / label maps change, update this file to match.
 */

/** The marker kinds the engine emits inside ability text. */
export type AbilityTokenType =
  | 'text'
  | 'keyword'
  | 'rule'
  | 'icon'
  | 'hc'
  | 'team';

/** One parsed segment of an ability line: either plain text or a marker. */
export interface AbilityToken {
  /** The kind of segment. `text` is literal copy; the rest are markers. */
  type: AbilityTokenType;
  /** The X in `[type:X]`, or the literal copy when `type` is `text`. */
  value: string;
}

// why: display glyphs for the resource icons. Mirrors the ICON_LABEL map in
// registry-viewer's CardDetail.vue so both surfaces read identically. Unicode
// glyphs (not image assets) are the established representation — the play
// client has no standalone icon art wired (EconomyBar renders "Attack:" /
// "Recruit:" as plain text).
const ICON_GLYPH: Record<string, string> = {
  attack: '⚔',
  recruit: '★',
  cost: '◆',
  vp: '🏆',
  focus: '◎',
  piercing: '↯',
  token: '🃏',
};

// why: hero-class display labels. Mirrors HERO_CLASS_LABELS in
// registry-viewer's useRules.ts (the 5 canonical classes). A `[hc:strength]`
// marker renders as the word "Strength", not an icon — the physical cards show
// the class as coloured text, and the registry-viewer does the same.
const HERO_CLASS_LABEL: Record<string, string> = {
  covert: 'Covert',
  instinct: 'Instinct',
  ranged: 'Ranged',
  strength: 'Strength',
  tech: 'Tech',
};

/**
 * Whether a `[keyword:VALUE]` marker is an ENGINE-ONLY token that must never be
 * shown to a player (D-24496).
 *
 * why: the card-data pipeline (`apply-hero-ability-markers.mjs` and the other
 * marker passes) APPENDS engine-only marker tokens to a card's printed text so
 * the engine parser can execute the ability — `[keyword:draw:1]`,
 * `[keyword:smash:2]`, `[keyword:recruit-threshold:6]`,
 * `[keyword:optional-ko-hand-discard]`, `[keyword:copy-powers]`,
 * `[keyword:reveal]`, and so on. The strict engine parser ignores everything but
 * these; this DISPLAY parser, whose value capture is deliberately loose
 * (`[^\]]+`), would otherwise render each one verbatim as an italic chip
 * ("smash:2", "draw:1") — the exact raw-marker leak the architecture forbids
 * (`raw marker syntax is never shown to a player`).
 *
 * The discriminator is the appended-token SHAPE, never the presence of a handler
 * (which this layer cannot know): an engine token is a lowercase slug carrying a
 * `:` magnitude / sub-type segment, OR a lowercase hyphenated slug, OR the single
 * bare word `reveal`. That set is disjoint from every player-facing keyword — the
 * Title-Case rules keywords the player must read (`Smash 2`, `Outwit`, `Worthy`,
 * `Transform`, `Wall-Crawl`) all start uppercase, and the handful of lowercase
 * display verbs (`charges`, `feasts`, `fortifies`, `demolish`) are bare single
 * words with no `:` and no hyphen, so they are kept.
 *
 * @param value - The captured `[keyword:VALUE]` value.
 * @returns true when the token is engine-only and must be dropped from display.
 */
export function isEngineOnlyKeyword(value: string): boolean {
  // why: any `:` segment is a magnitude / sub-type engine token (draw:1, smash:2,
  // recruit-threshold:6, attack-per-count:worthy-cards-played-this-turn:1); no
  // player-facing keyword ever carries a colon.
  if (value.includes(':')) {
    return true;
  }
  // why: a lowercase hyphenated slug is an engine keyword (copy-powers,
  // gain-wound-each, optional-ko-hand-discard, defeat-with-bystander); Title-Case
  // display keywords (Wall-Crawl, Cross-Dimensional …) start uppercase, and the
  // lowercase display verbs are single words with no hyphen.
  if (/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(value)) {
    return true;
  }
  // why: the one bare single-word engine token (the appended `[keyword:reveal]`);
  // the lowercase display verbs (charges / feasts / fortifies / demolish) are not
  // engine keywords and stay visible.
  if (value === 'reveal') {
    return true;
  }
  return false;
}

/**
 * Parses one ability-text line into an ordered list of typed tokens.
 *
 * Splits on `[type:value]` markup, yielding interleaved `text` and marker
 * segments. Text with no markers returns a single `text` token. Mirrors
 * registry-viewer's `parseAbilityText`.
 *
 * Engine-only appended keyword markers (see {@link isEngineOnlyKeyword}) are
 * DROPPED — they exist for the engine parser, never for the player — so a card
 * tooltip never shows raw "smash:2" / "draw:1" chips (D-24496).
 *
 * @param text - A single ability / rules-text line from the engine projection.
 * @returns The line broken into ordered text and marker tokens.
 */
export function parseAbilityMarkers(text: string): AbilityToken[] {
  const tokens: AbilityToken[] = [];
  // why: matches [keyword:X], [icon:X], [hc:X], [team:X], [rule:X] — the closed
  // marker set the engine emits. The value captures everything up to the first
  // closing bracket. Byte-identical to the registry-viewer pattern.
  const markerPattern = /\[(keyword|icon|hc|team|rule):([^\]]+)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = markerPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const tokenType = match[1] as AbilityTokenType;
    const tokenValue = match[2] ?? '';
    // why: D-24496 — drop engine-only appended keyword markers so the player never
    // sees a raw "smash:2" / "draw:1" chip. Trim a single trailing space from the
    // preceding text (the separator before the appended token) so the drop leaves no
    // dangling gap; if that empties the text token, remove it.
    if (tokenType === 'keyword' && isEngineOnlyKeyword(tokenValue)) {
      const previousToken = tokens[tokens.length - 1];
      if (previousToken !== undefined && previousToken.type === 'text') {
        previousToken.value = previousToken.value.replace(/\s+$/, '');
        if (previousToken.value === '') {
          tokens.pop();
        }
      }
      lastIndex = match.index + match[0].length;
      continue;
    }
    tokens.push({ type: tokenType, value: tokenValue });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

/**
 * Resolves the display string for a single parsed token.
 *
 * - `icon` -> the resource glyph (e.g. `attack` -> "⚔"); unknown icons fall
 *   back to the raw value so no information is lost.
 * - `hc` -> the hero-class label (e.g. `strength` -> "Strength"); unknown
 *   classes fall back to the raw value.
 * - everything else (`text`, `keyword`, `rule`, `team`) -> the value verbatim.
 *
 * @param token - A token from {@link parseAbilityMarkers}.
 * @returns The human-readable string to render for that token.
 */
export function abilityTokenDisplay(token: AbilityToken): string {
  if (token.type === 'icon') {
    return ICON_GLYPH[token.value] ?? token.value;
  }
  if (token.type === 'hc') {
    return HERO_CLASS_LABEL[token.value] ?? token.value;
  }
  return token.value;
}

/**
 * The human-readable word for a token — used as the `alt` / `title` on an
 * icon image and as the text fallback when the image cannot load.
 *
 * Unlike {@link abilityTokenDisplay}, this never returns a glyph: `icon`
 * tokens return their name ("attack"), not "⚔".
 */
export function abilityTokenLabel(token: AbilityToken): string {
  if (token.type === 'hc') {
    return HERO_CLASS_LABEL[token.value] ?? token.value;
  }
  return token.value;
}

// why: the marker icons are real SVG assets on the card-image domain (same
// origin as card art, so no new CSP img-src entry). Three sibling folders:
// hero-classes/class-{X}.svg, hero-teams/team-{slug}.svg, and
// card-info/info-{X}.svg. Kept as a single base so a domain move is one edit.
const ICON_ASSET_BASE = 'https://images.legendary-arena.com/icons';

// why: closed sets that actually have an SVG asset. An unknown `hc` / `icon`
// value (e.g. a future class the art hasn't shipped) renders as its text
// label / glyph instead of a broken image. `team` is intentionally open —
// the team art set is large and slugged, so any `[team:X]` attempts the image
// and falls back to text via the <img> error handler when the slug misses.
const HERO_CLASSES_WITH_ICON: ReadonlySet<string> = new Set([
  'covert',
  'instinct',
  'ranged',
  'strength',
  'tech',
]);
const RESOURCE_ICONS_WITH_ASSET: ReadonlySet<string> = new Set([
  'attack',
  'recruit',
  'cost',
  'vp',
  'focus',
  'piercing',
  'token',
]);

/**
 * Builds the hero-class icon URL for a `[hc:X]` value (e.g. `strength`).
 */
export function heroClassIconUrl(heroClass: string): string {
  return `${ICON_ASSET_BASE}/hero-classes/class-${heroClass}.svg`;
}

/**
 * Builds the resource icon URL for an `[icon:X]` value (e.g. `attack`).
 */
export function resourceIconUrl(iconName: string): string {
  return `${ICON_ASSET_BASE}/card-info/info-${iconName}.svg`;
}

/**
 * Slugs a `[team:X]` value to its asset slug: lower-cased, trimmed, and
 * whitespace collapsed to single hyphens (e.g. "Guardians of the Galaxy" ->
 * "guardians-of-the-galaxy", "X-Men" -> "x-men").
 */
export function teamIconSlug(team: string): string {
  return team.toLowerCase().trim().replace(/\s+/g, '-');
}

/**
 * Builds the team icon URL for a `[team:X]` value.
 */
export function teamIconUrl(team: string): string {
  return `${ICON_ASSET_BASE}/hero-teams/team-${teamIconSlug(team)}.svg`;
}

/**
 * Resolves the SVG icon URL a token should render as, or `null` when the
 * token renders as text (plain text, keyword/rule, or an `hc` / `icon` value
 * with no shipped asset).
 *
 * @param token - A token from {@link parseAbilityMarkers}.
 * @returns The icon URL, or `null` to render the token as text.
 */
export function abilityTokenIconUrl(token: AbilityToken): string | null {
  if (token.type === 'hc' && HERO_CLASSES_WITH_ICON.has(token.value)) {
    return heroClassIconUrl(token.value);
  }
  if (token.type === 'icon' && RESOURCE_ICONS_WITH_ASSET.has(token.value)) {
    return resourceIconUrl(token.value);
  }
  if (token.type === 'team') {
    return teamIconUrl(token.value);
  }
  return null;
}
