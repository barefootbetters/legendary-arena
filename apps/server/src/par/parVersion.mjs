/**
 * PAR version resolution for the server's PAR gate (D-5102).
 *
 * The server builds its PAR gate once at startup from `data/par/<source>/<version>/index.json`.
 * The version comes from the `PAR_VERSION` environment variable, defaulting to `v1`.
 *
 * Belongs to the server layer only. Pure: reads no environment itself, so the
 * caller passes `process.env.PAR_VERSION` in and tests pass literals.
 */

/** The PAR version the server uses when `PAR_VERSION` is unset or blank. */
export const DEFAULT_PAR_VERSION = 'v1';

/**
 * Resolves the PAR version from the raw `PAR_VERSION` environment value.
 *
 * @param {string | undefined} rawValue - The raw environment value (`process.env.PAR_VERSION`).
 * @returns {string} The trimmed value, or `DEFAULT_PAR_VERSION` when the value is unset or blank.
 */
export function resolveParVersion(rawValue) {
  // why: a blank `PAR_VERSION=` line in an env file sets the variable to the empty string, and
  // `?? 'v1'` keeps an empty string. The gate then looked for `data/par/seed//index.json`, found
  // nothing, and disabled every competitive submission (`par_not_published`). The production env
  // template ships the key blank, so blank must mean "use the default", exactly like unset.
  if (typeof rawValue !== 'string') {
    return DEFAULT_PAR_VERSION;
  }
  const trimmedValue = rawValue.trim();
  if (trimmedValue === '') {
    return DEFAULT_PAR_VERSION;
  }
  return trimmedValue;
}
