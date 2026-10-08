/**
 * Count-aware labels for the player-count setup requirement copy in the loadout builder
 * and the loadout preview ("1 villain group", "2 villain groups", "1 henchman group",
 * "2 henchmen groups", "3 heroes", "1 villain-deck bystander").
 *
 * No Vue import, no I/O.
 */

/** The setup quantities the requirement copy names. */
export type SetupCountNoun = 'villainGroup' | 'henchmanGroup' | 'hero' | 'villainDeckBystander';

// why: the plural is irregular for two nouns ("henchmen groups", "heroes"), so each noun
// carries its own singular and plural instead of appending an "s".
const SETUP_COUNT_LABELS: Readonly<Record<SetupCountNoun, { singular: string; plural: string }>> = {
  villainGroup: { singular: 'villain group', plural: 'villain groups' },
  henchmanGroup: { singular: 'henchman group', plural: 'henchmen groups' },
  hero: { singular: 'hero', plural: 'heroes' },
  villainDeckBystander: { singular: 'villain-deck bystander', plural: 'villain-deck bystanders' },
};

/**
 * Formats a count with the singular or plural form of its noun.
 *
 * @param count - The number of items.
 * @param noun - Which setup quantity is being counted.
 * @returns For example "1 villain group" or "2 henchmen groups".
 */
export function formatSetupCount(count: number, noun: SetupCountNoun): string {
  const labels = SETUP_COUNT_LABELS[noun];
  if (count === 1) {
    return `${count} ${labels.singular}`;
  }
  return `${count} ${labels.plural}`;
}

/**
 * Maps a composition-mismatch field (from the registry's checkPlayerCountComposition) to
 * the noun its count names.
 *
 * @param field - The mismatch's MatchSetupConfig field.
 * @returns The noun for formatSetupCount.
 */
export function setupCountNounForField(
  field: 'villainGroupIds' | 'henchmanGroupIds' | 'heroDeckIds',
): SetupCountNoun {
  if (field === 'villainGroupIds') {
    return 'villainGroup';
  }
  if (field === 'henchmanGroupIds') {
    return 'henchmanGroup';
  }
  return 'hero';
}
