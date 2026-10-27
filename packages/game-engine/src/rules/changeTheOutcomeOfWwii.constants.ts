/**
 * Change the Outcome of WWII (WP-832 / D-24765) — the `G.counters` keys and the loss threshold.
 *
 * // why: a separate leaf module so the static scheme config table (schemeTwistConfigs.ts) can
 * name the loss counter without importing the scheme's logic, which imports the loss evaluator,
 * which imports the config table (a load-time cycle).
 */

/** Counter: how many countries the Axis has invaded (0 = still the normal City). */
export const WWII_COUNTRIES_INVADED = 'wwiiCountriesInvaded';

/** Counter: conquered capitals (the scheme's loss counts these). */
export const WWII_CONQUERED_CAPITALS = 'wwiiConqueredCapitals';

/** Counter: the escaped Villains already in the pile when the current country was invaded. */
export const WWII_ESCAPES_AT_INVASION = 'wwiiEscapesAtInvasion';

/** Counter: 1 once the current country has been conquered (a country is conquered once). */
export const WWII_COUNTRY_CONQUERED = 'wwiiCountryConquered';

/** The conquered capitals at which Evil wins ("When 3 capitals are conquered"). */
export const WWII_CAPITALS_TO_WIN = 3;
