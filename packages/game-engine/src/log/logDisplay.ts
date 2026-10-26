import type { CardExtId } from '../state/zones.types.js';
import type { UICardDisplay } from '../ui/uiState.types.js';

/**
 * Pure display-formatting helpers for engine game-log messages (WP-323).
 *
 * `G.messages` is authored as human-readable text, but `G` stores only
 * `CardExtId` values. `G.cardDisplayData` (built at setup, keyed by `CardExtId`)
 * carries each card's display `name` and optional printed `abilityText`, so these
 * helpers turn a raw ext-id into a named, effect-annotated log label without any
 * registry access at move time. WP-324 reuses them at the remaining log sites.
 *
 * Pure: no `boardgame.io` import, no I/O, and no `G` reach-through — callers pass
 * `G.cardDisplayData` in.
 */

/** The card-display snapshot shape as stored on `G.cardDisplayData`. */
type CardDisplayData = Readonly<Record<CardExtId, UICardDisplay>>;

/**
 * Resolves a card's display name from the display-data snapshot, falling back to
 * the raw ext-id when the entry is absent.
 *
 * @param cardDisplayData The `G.cardDisplayData` snapshot, or undefined when a
 *   legacy fixture omits it.
 * @param extId The card ext-id to name.
 * @returns The display name, or `extId` when no entry exists.
 */
export function resolveCardName(
  cardDisplayData: CardDisplayData | undefined,
  extId: CardExtId,
): string {
  // why: an absent cardDisplayData entry (legacy test fixtures omit the sibling
  // snapshot) degrades to the raw ext-id — never throw, never print undefined.
  // Mirrors the fightVillain.ts defensive access pattern.
  return cardDisplayData?.[extId]?.name ?? extId;
}

// why: WP-417 / D-24237 — the registry `abilities` lines carry BOTH printed card
// text and the machine-readable effect markers the pipeline's apply-effect-markers
// pass appends (`[keyword:draw:1]`, `[keyword:ko-wound-reward:attack:2]`). The
// markers are engine plumbing, not printed text; humanizing them leaked
// "Draw a card. draw:1." into the player-facing game log. The two are told apart
// by SHAPE, not by a keyword allowlist: every printed keyword in the corpus is
// Title Case with spaces / punctuation ("Undercover", "What If...?", "Danger
// Sense 2"), and every machine marker is all-lowercase kebab-case with optional
// `:`-delimited payload segments. A shape test also covers markers for mechanics
// that are not yet HeroKeyword members (`demolish`, `reveal-multi-take`), which an
// allowlist would silently keep leaking.
// why: D-24582 — a payload segment may join several kebab words with `+` (the
// parameterized reveal rule's multi-action list, `reveal:cost-zero:discard+attack-fixed-2`).
// Without the `+` arm that marker failed the shape test and leaked into the play line as
// "reveal:cost zero:discard+attack fixed 2" (observed live, See Future Timelines).
const ENGINE_EFFECT_MARKER_SHAPE =
  /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\+[a-z0-9]+(?:-[a-z0-9]+)*)*(?::[a-z0-9]+(?:-[a-z0-9]+)*(?:\+[a-z0-9]+(?:-[a-z0-9]+)*)*)*$/;

/**
 * Returns whether a `[keyword:...]` token value is an engine effect marker
 * (machine plumbing) rather than a printed card keyword.
 *
 * @param tokenValue The token value (`draw:1`, `Undercover`, `What If...?`, ...).
 * @returns Whether the value has the all-lowercase kebab/colon marker shape.
 */
export function isEngineEffectMarker(tokenValue: string): boolean {
  return ENGINE_EFFECT_MARKER_SHAPE.test(tokenValue);
}

// why: team names whose printed form is not plain title case of the slug. Every other
// team slug in the corpus title-cases word by word ("spider-friends" → "Spider Friends").
const TEAM_DISPLAY_NAME_EXCEPTIONS: Readonly<Record<string, string>> = {
  shield: 'S.H.I.E.L.D.',
  hydra: 'HYDRA',
  'x-men': 'X-Men',
  'x-force': 'X-Force',
  'x-factor-investigations': 'X-Factor Investigations',
};

// why: the small words a printed team name keeps lower-case ("Guardians of the Galaxy",
// "Mercs for Money"); the first word is always capitalized.
const TEAM_NAME_LOWER_CASE_WORDS: readonly string[] = ['of', 'for', 'the'];

/**
 * Returns the printed name of a Hero team from its slug, for log lines.
 *
 * @param teamSlug The team slug (`avengers`, `shield`, `guardians-of-the-galaxy`, ...).
 * @returns The printed team name (`Avengers`, `S.H.I.E.L.D.`, `Guardians of the Galaxy`).
 */
export function teamDisplayName(teamSlug: string): string {
  const exception = TEAM_DISPLAY_NAME_EXCEPTIONS[teamSlug];
  if (exception !== undefined) {
    return exception;
  }
  const words: string[] = [];
  for (const word of teamSlug.split('-')) {
    let isLowerCaseWord = false;
    for (const lowerCaseWord of TEAM_NAME_LOWER_CASE_WORDS) {
      if (lowerCaseWord === word) {
        isLowerCaseWord = true;
      }
    }
    if (isLowerCaseWord && words.length > 0) {
      words.push(word);
    } else {
      words.push(word.charAt(0).toUpperCase() + word.slice(1));
    }
  }
  return words.join(' ');
}

/**
 * Returns the printed name of a Hero Class from its slug, for log lines.
 *
 * @param classSlug The class slug (`strength`, `instinct`, ...).
 * @returns The title-cased class name (`Strength`, `Instinct`, ...).
 */
export function heroClassDisplayName(classSlug: string): string {
  const spacedValue = classSlug.replace(/-/g, ' ');
  return spacedValue.charAt(0).toUpperCase() + spacedValue.slice(1);
}

/**
 * Humanizes a single `[type:value]` ability-markup token into readable text.
 * Hero-class tokens are title-cased and team tokens take their printed team name;
 * every other token keeps its text with hyphens rendered as spaces.
 *
 * @param tokenType The token type (`icon`, `keyword`, `hc`, `team`, ...).
 * @param tokenValue The token value (`recruit`, `What If...?`, `strength`, ...).
 * @returns The humanized word.
 */
function humanizeAbilityToken(tokenType: string, tokenValue: string): string {
  // why: hero-class tokens ([hc:strength]) read best title-cased ("Strength"), and team
  // tokens ([team:avengers]) as the printed team name ("Avengers", "S.H.I.E.L.D."), so a
  // team-gated line reads like a class-gated one; icon/keyword values keep their given
  // casing ("recruit", "What If...?").
  if (tokenType === 'hc') {
    return heroClassDisplayName(tokenValue);
  }
  if (tokenType === 'team') {
    return teamDisplayName(tokenValue);
  }
  return tokenValue.replace(/-/g, ' ');
}

/**
 * Converts card ability markup to a single line of plain text for the game log.
 * `[icon:X]` / `[keyword:X]` / `[hc:X]` (and any `[type:value]`) tokens become
 * readable words, and all whitespace and newlines collapse to single spaces.
 *
 * @param abilityText The printed ability markup, or undefined.
 * @returns The plain-text ability, or an empty string when there is none.
 */
export function abilityTextToPlainText(abilityText: string | undefined): string {
  if (abilityText === undefined || abilityText.length === 0) {
    return '';
  }
  // why: replace each [type:value] token with a SPACE-PADDED word so an adjacent
  // number or token ("+3[icon:recruit]") does not fuse into "+3recruit". WP-417 —
  // an engine effect marker becomes a bare space instead (dropped, not humanized).
  const withWords = abilityText.replace(
    /\[(\w+):([^\]]+)\]/g,
    (_match: string, tokenType: string, tokenValue: string): string => {
      if (tokenType === 'keyword' && isEngineEffectMarker(tokenValue)) {
        return ' ';
      }
      return ` ${humanizeAbilityToken(tokenType, tokenValue)} `;
    },
  );
  // why: a log line is a single entry — collapse every run of whitespace
  // (including the ability's own newlines) to one space, then trim.
  const singleLine = withWords.replace(/\s+/g, ' ').trim();
  // why: the space-padding can leave a gap before terminal punctuation
  // ("+3 recruit ." -> "+3 recruit."); tidy those.
  return singleLine.replace(/\s+([.,;:!?])/g, '$1');
}

/**
 * Builds the played-card label for a game-log line: `{Name} ({extId})`, plus
 * ` — {plain effect}` when the card has printed ability text. Starter cards have
 * no ability text, so their label stays terse (`{Name} ({extId})`).
 *
 * @param cardDisplayData The `G.cardDisplayData` snapshot, or undefined.
 * @param extId The played card's ext-id.
 * @returns The formatted label.
 */
export function formatCardRef(
  cardDisplayData: CardDisplayData | undefined,
  extId: CardExtId,
): string {
  // why: WP-324 — the `{Name} ({ext-id})` reference used across the non-play log
  // lines (fought, recruited, dodged, escaped, captured, claimed, grant). The name
  // is for readability; the ext-id is retained for diagnostics / instance
  // disambiguation (the same choice as the WP-323 play label).
  return `${resolveCardName(cardDisplayData, extId)} (${extId})`;
}

/**
 * Builds the printed-icon economy clause for a played card: `+2 attack, +1 recruit`.
 *
 * WP-417 — a starter (S.H.I.E.L.D. Agent / Trooper) has no printed ability, so
 * before this its log line said only that it was played and never what it did.
 * The printed icons ARE its whole effect, so they belong on the play line.
 *
 * @param attack The card's printed attack (base card stats).
 * @param recruit The card's printed recruit (base card stats).
 * @returns The clause, or an empty string when the card grants neither.
 */
export function formatBaseEconomyClause(attack: number, recruit: number): string {
  const parts: string[] = [];
  if (attack > 0) {
    parts.push(`+${attack} attack`);
  }
  if (recruit > 0) {
    parts.push(`+${recruit} recruit`);
  }
  return parts.join(', ');
}

/**
 * Builds the played-card label for a game-log line: `{Name} ({extId})`, plus
 * ` ({printed icons})` when the card grants base attack / recruit, plus
 * ` — {plain effect}` when the card has printed ability text.
 *
 * @param cardDisplayData The `G.cardDisplayData` snapshot, or undefined.
 * @param extId The played card's ext-id.
 * @param economyClause The printed-icon clause from `formatBaseEconomyClause`
 *   (empty string when the card grants no base attack or recruit).
 * @returns The formatted label.
 */
export function formatPlayedCardLabel(
  cardDisplayData: CardDisplayData | undefined,
  extId: CardExtId,
  economyClause: string,
): string {
  let label = formatCardRef(cardDisplayData, extId);
  if (economyClause.length > 0) {
    label = `${label} (${economyClause})`;
  }
  const plainEffect = abilityTextToPlainText(cardDisplayData?.[extId]?.abilityText);
  // why: only append the effect clause when the card has printed ability text —
  // starters (S.H.I.E.L.D. Agent / Trooper) have none and stay at the ref + icons.
  if (plainEffect.length === 0) {
    return label;
  }
  // why: WP-417 — the effect clause is embedded in a sentence the caller finishes
  // (the play line ends `... .`; the reject line continues `... — it requires …`),
  // so a trailing period on the printed text either doubles (`Draw a card..`) or
  // sits mid-sentence. Drop exactly one trailing period. Before WP-417 the appended
  // effect marker sat after the period, hiding the doubling; dropping the marker
  // exposed it.
  const trimmedEffect = plainEffect.endsWith('.') ? plainEffect.slice(0, -1) : plainEffect;
  return `${label} — ${trimmedEffect}`;
}

/**
 * Names the zone a KO'd card came from, for log lines (D-24693).
 *
 * // why: "KO one of your Heroes" may take only from hand or play (D-24687), but every
 * KO line said only "KO'd S.H.I.E.L.D. Agent", so a log could not show which zone a card
 * left. This is the third site to need the wording (after optionalKoReward and the KO-hero
 * resolve), so the mapping lives here once.
 *
 * @param zone - The player zone the card was KO'd from.
 * @returns "their hand", "their discard pile" or "the cards they played this turn".
 */
export function describeKoSourceZone(zone: 'hand' | 'discard' | 'inPlay'): string {
  if (zone === 'hand') {
    return 'their hand';
  }
  if (zone === 'discard') {
    return 'their discard pile';
  }
  return 'the cards they played this turn';
}
