/**
 * Player-facing labels for hero count sources (D-24673).
 *
 * The count-scaled log lines ("Count-scaled recruit: +3 (…)") used to print the raw
 * internal `HeroCountSource` slug. Those slugs are stable ids, not descriptions —
 * `distinct-hero-classes-played-this-turn` actually counts the Hero colors in your
 * hand AND play area (D-24529), so the slug misdescribed what was counted. These
 * labels say what each source counts, in the singular ("1 per <label>").
 *
 * Pure: no boardgame.io import, no I/O, no `G` access.
 */

/**
 * Describes what a hero count source counts, for a game-log line.
 *
 * @param countSource - The effect's count source slug.
 * @returns A short singular noun phrase, e.g. `"Hero color you have (hand + played)"`.
 *   An unrecognized slug is returned with its hyphens turned into spaces.
 */
export function describeCountSource(countSource: string): string {
  switch (countSource) {
    case 'victory-bystanders':
      return 'Bystander in your Victory Pile';
    case 'worthy-cards-played-this-turn':
      return 'other Worthy card played this turn';
    case 'cost-four-plus-played-this-turn':
      return 'other card costing 4 or more played this turn';
    case 'attack-icon-played-this-turn':
      return 'other card with an Attack icon played this turn';
    case 'recruit-icon-played-this-turn':
      return 'other card with a Recruit icon played this turn';
    case 'shield-levels':
      return 'S.H.I.E.L.D. Level';
    case 'distinct-hero-classes-played-this-turn':
      return 'Hero color you have (hand + played)';
    case 'avengers-played-this-turn':
      return 'other Avengers Hero played this turn';
    case 'shield-heroes-played-this-turn':
      return 'other S.H.I.E.L.D. Hero played this turn';
    case 'odd-cost-heroes-played-this-turn':
      return 'other odd-cost Hero played this turn';
    case 'strength-heroes-played-this-turn':
      return 'other Strength Hero played this turn';
    case 'ranged-heroes-played-this-turn':
      return 'other Ranged Hero played this turn';
    case 'tech-heroes-played-this-turn':
      return 'other Tech Hero played this turn';
    case 'covert-heroes-played-this-turn':
      return 'other Covert Hero played this turn';
    case 'x-men-played-this-turn':
      return 'other X-Men Hero played this turn';
    default:
      return countSource.replace(/-/g, ' ');
  }
}

/**
 * Formats the rate clause of a count-scaled log line.
 *
 * @param magnitude - The per-unit grant.
 * @param perEach - The "for each N" divisor (1 when the card has none).
 * @param countSource - The effect's count source slug.
 * @param count - The resolved count.
 * @returns e.g. `"1 per Hero color you have (hand + played); count 3"` or
 *   `"1 per 2 × S.H.I.E.L.D. Level; count 5"`.
 */
export function formatCountScaledRate(
  magnitude: number,
  perEach: number,
  countSource: string,
  count: number,
): string {
  const label = describeCountSource(countSource);
  if (perEach === 1) {
    return `${magnitude} per ${label}; count ${count}`;
  }
  return `${magnitude} per ${perEach} × ${label}; count ${count}`;
}
