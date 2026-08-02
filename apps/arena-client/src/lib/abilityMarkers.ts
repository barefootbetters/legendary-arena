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
 * Parses one ability-text line into an ordered list of typed tokens.
 *
 * Splits on `[type:value]` markup, yielding interleaved `text` and marker
 * segments. Text with no markers returns a single `text` token. Mirrors
 * registry-viewer's `parseAbilityText`.
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
