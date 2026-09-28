import type { HollowEffectRecord } from '@legendary-arena/game-engine';

/**
 * One row of the grouped Hollow effects table: every record that shares a card,
 * mechanic, timing, and reason, collapsed into a count plus the turns it fired on.
 */
export interface HollowEffectGroup {
  /** The card's extId without its `#n` copy suffix (all copies group together). */
  cardKey: string;
  /** A readable card name derived from the extId (formatting only). */
  cardName: string;
  cardType: HollowEffectRecord['cardType'];
  mechanic: string;
  timing: string;
  reason: HollowEffectRecord['reason'];
  /** How many records collapsed into this row. */
  count: number;
  /** The distinct turns the records fired on, ascending. */
  turns: number[];
}

/**
 * Turns a card extId into a readable name: the last path segment with the `#n`
 * copy suffix dropped, hyphens as spaces, each word capitalized
 * (`xmen/cannonball/kinetic-blast-field#1` → `Kinetic Blast Field`).
 *
 * // why: HollowEffectRecord carries only the extId, and card names reach the
 * client through per-zone display projections, not a global lookup. This is the
 * same formatting-only fallback PlayedCardsRow / HandRow use when a display
 * lookup misses; the full extId stays in the row tooltip.
 *
 * @param cardKey - A card extId without its copy suffix.
 * @returns The humanized card name.
 */
export function humanizeCardKey(cardKey: string): string {
  const segments = cardKey.split('/');
  const slug = segments[segments.length - 1] ?? cardKey;
  const words = slug.split('-').filter((word) => word !== '');
  const capitalized: string[] = [];
  for (const word of words) {
    capitalized.push(word.charAt(0).toUpperCase() + word.slice(1));
  }
  return capitalized.join(' ');
}

/**
 * Collapses hollow-effect records into one row per (card, mechanic, timing,
 * reason), in first-seen order.
 *
 * // why: the engine records one hollow per play, so a hollow card played every
 * turn fills the panel with identical rows (65 rows in one Cannonball match, most
 * of them the same three cards). Grouping keeps each distinct gap on one line;
 * the count and turn list keep the frequency visible.
 *
 * @param records - The UIState hollowEffects projection, in engine append order.
 * @returns The grouped rows.
 */
export function groupHollowEffects(records: readonly HollowEffectRecord[]): HollowEffectGroup[] {
  const groups: HollowEffectGroup[] = [];
  const groupByKey = new Map<string, HollowEffectGroup>();
  for (const record of records) {
    const cardKey = record.cardId.split('#')[0] ?? record.cardId;
    const groupKey = [cardKey, record.mechanic, record.timing, record.reason].join('|');
    let group = groupByKey.get(groupKey);
    if (group === undefined) {
      group = {
        cardKey,
        cardName: humanizeCardKey(cardKey),
        cardType: record.cardType,
        mechanic: record.mechanic,
        timing: record.timing,
        reason: record.reason,
        count: 0,
        turns: [],
      };
      groupByKey.set(groupKey, group);
      groups.push(group);
    }
    group.count += 1;
    if (!group.turns.includes(record.turn)) {
      group.turns.push(record.turn);
    }
  }
  for (const group of groups) {
    group.turns.sort((left, right) => left - right);
  }
  return groups;
}
