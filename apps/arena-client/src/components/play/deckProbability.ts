// why: WP-606 / D-24417 exposes the villain deck (public) and the viewer's own
// draw deck (owner-only) as order-stripped CardExtId multisets on UIState. This
// pure helper — the Deck Probability Panel's math — categorizes each villain
// card by its synthetic ext_id prefix and computes the simple draw odds the
// panel renders. It is CLIENT-SIDE ADVISORY ONLY: engine TYPES only (no runtime
// import), no ctx.random, no game-state write. The ext_id-grammar source of
// truth is packages/game-engine/src/villainDeck/villainDeck.setup.ts.
import type {
  RevealedCardType,
  UICardDisplay,
  UIDisplayEntry,
  UIPlayerState,
} from '@legendary-arena/game-engine';

/**
 * The five villain-deck RevealedCardType buckets, in the order the panel
 * displays them (most-threatening first).
 */
export const VILLAIN_DECK_TYPE_ORDER: readonly RevealedCardType[] = [
  'mastermind-strike',
  'scheme-twist',
  'bystander',
  'henchman',
  'villain',
];

/**
 * Human-readable labels for each RevealedCardType, for the panel rows.
 */
export const VILLAIN_DECK_TYPE_LABELS: Record<RevealedCardType, string> = {
  'mastermind-strike': 'Master Strike',
  'scheme-twist': 'Scheme Twist',
  bystander: 'Bystander',
  henchman: 'Henchman',
  villain: 'Villain',
};

/**
 * Categorizes a villain-deck CardExtId into its RevealedCardType by matching the
 * synthetic ext_id prefix emitted by villainDeck.setup.ts.
 *
 * // why: the checks are ordered so `villain` is the LAST (fallback) branch —
 * villain ext_ids are `{setAbbr}-villain-...` and no set abbreviation equals a
 * reserved prefix below, so a villain can only reach the fallback. KNOWN LIMIT
 * (Phase-1): the Killbots scheme rewrites some `bystander-villain-deck-*` cards
 * to engine type `villain` via G.convertedOrigins, which is NOT projected — so
 * this prefix reader miscounts those as Bystander. Correcting it needs an engine
 * type-projection (a follow-on WP). The grammar's source of truth is
 * villainDeck.setup.ts.
 */
export function categorizeVillainCard(extId: string): RevealedCardType {
  if (extId.startsWith('master-strike-')) {
    return 'mastermind-strike';
  }
  if (extId.startsWith('scheme-twist-')) {
    return 'scheme-twist';
  }
  if (extId.startsWith('bystander-villain-deck-')) {
    return 'bystander';
  }
  if (extId.startsWith('henchman-')) {
    return 'henchman';
  }
  return 'villain';
}

/**
 * A per-type count of a villain-deck composition plus its total size.
 */
export interface VillainDeckSummary {
  counts: Record<RevealedCardType, number>;
  total: number;
}

/**
 * Counts a villain-deck composition (an order-stripped CardExtId multiset) by
 * RevealedCardType.
 */
export function summarizeVillainDeck(
  composition: readonly string[],
): VillainDeckSummary {
  const counts: Record<RevealedCardType, number> = {
    'mastermind-strike': 0,
    'scheme-twist': 0,
    bystander: 0,
    henchman: 0,
    villain: 0,
  };
  // why: explicit for...of (not a branching reduce) per 00.6 — one increment per
  // card, keyed by its categorized type.
  for (const extId of composition) {
    counts[categorizeVillainCard(extId)] += 1;
  }
  return { counts, total: composition.length };
}

/**
 * The probability the NEXT card drawn from a deck of `deckSize` cards is one of
 * `count` matching cards. Returns 0 for an empty deck.
 */
export function nextDrawOdds(count: number, deckSize: number): number {
  // why: guard the empty-deck case so the panel shows 0%, never NaN / Infinity.
  if (deckSize <= 0) {
    return 0;
  }
  return count / deckSize;
}

/**
 * The probability of drawing AT LEAST ONE of `count` matching cards within the
 * next `n` draws from a deck of `deckSize` — the hypergeometric complement
 * `1 − P(no match in n draws)`, computed as a running product to avoid large
 * binomial coefficients.
 */
export function atLeastOneInNextN(
  count: number,
  deckSize: number,
  n: number,
): number {
  // why: guards — no matching cards (or no deck / no draws) can never hit; a
  // draw window that covers the whole deck, or exceeds the non-matching cards,
  // hits with certainty. Each guard also keeps the running product below off a
  // divide-by-zero / negative-numerator path.
  if (count <= 0 || deckSize <= 0 || n <= 0) {
    return 0;
  }
  if (n >= deckSize) {
    return 1;
  }
  const missCount = deckSize - count;
  if (n > missCount) {
    return 1;
  }
  let probabilityOfNoMatch = 1;
  for (let drawIndex = 0; drawIndex < n; drawIndex += 1) {
    probabilityOfNoMatch *= (missCount - drawIndex) / (deckSize - drawIndex);
  }
  return 1 - probabilityOfNoMatch;
}

/**
 * Builds a best-effort `CardExtId → display name` map from the display data
 * already present in the viewing player's own snapshot.
 *
 * // why: names reach the client only as per-zone display arrays; there is no
 * complete client-side extId→display resolver, so the own-deck tally harvests
 * what the viewer's OWN snapshot carries — hand / in-play / discard are
 * `UICardDisplay[]` (name at `.name`); victory is `UIDisplayEntry[]` (name at
 * `.display.name`). `deckComposition` ext_ids with no harvested name render as
 * "Unknown" — a documented Phase-1 limit.
 */
export function harvestCardNames(player: UIPlayerState): Map<string, string> {
  const names = new Map<string, string>();
  const flatArrays: ReadonlyArray<UICardDisplay>[] = [
    player.handDisplay ?? [],
    player.inPlayDisplay ?? [],
    player.discardDisplay ?? [],
  ];
  for (const displayArray of flatArrays) {
    for (const display of displayArray) {
      names.set(display.extId, display.name);
    }
  }
  const victoryEntries: ReadonlyArray<UIDisplayEntry> = player.victoryCards ?? [];
  for (const entry of victoryEntries) {
    names.set(entry.extId, entry.display.name);
  }
  return names;
}

/**
 * A name and its count in the viewer's own draw pool.
 */
export interface OwnDeckTallyEntry {
  name: string;
  count: number;
}

/**
 * Tallies the viewer's own `deckComposition` (an order-stripped CardExtId
 * multiset) by display name, resolving names via `harvestCardNames` and
 * grouping un-resolvable ext_ids under "Unknown". Sorted by descending count,
 * then name, for a stable render order.
 */
export function tallyOwnDeck(
  composition: readonly string[],
  names: Map<string, string>,
): OwnDeckTallyEntry[] {
  const countsByName = new Map<string, number>();
  for (const extId of composition) {
    const name = names.get(extId) ?? 'Unknown';
    countsByName.set(name, (countsByName.get(name) ?? 0) + 1);
  }
  const entries: OwnDeckTallyEntry[] = [];
  for (const [name, count] of countsByName) {
    entries.push({ name, count });
  }
  // why: descending count, then name — a deterministic order so the render (and
  // its test) is stable regardless of Map insertion order.
  entries.sort((first, second) => {
    if (second.count !== first.count) {
      return second.count - first.count;
    }
    return first.name.localeCompare(second.name);
  });
  return entries;
}
