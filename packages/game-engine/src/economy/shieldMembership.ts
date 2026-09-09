/**
 * S.H.I.E.L.D. Level membership predicate (WP-677 / D-24493).
 *
 * A card counts toward a player's S.H.I.E.L.D. Level — the setup-derived
 * `CardStatEntry.isShieldOrHydra` flag — iff (universal-rules-v23 §S.H.I.E.L.D.
 * Level): its TEAM icon is S.H.I.E.L.D. or HYDRA, OR the substring "S.H.I.E.L.D."
 * or "HYDRA" appears in its card name, its Villain Group name, or its Mastermind
 * name. This single predicate keeps every cardStats build site consistent.
 *
 * Pure: no I/O, no mutation. Team is a single normalized slug (a card carries
 * exactly one team); names are compared case-insensitively against the literal
 * "S.H.I.E.L.D." (dotted) / "HYDRA" forms the card data uses.
 */

// why: the rulebook's literal names — "S.H.I.E.L.D." (dotted) and "HYDRA". The team
// icon is checked separately (a shield/hydra-team card need not spell it in its name);
// this pattern catches teamless cards whose NAME/group/mastermind carries the label
// (e.g. "HYDRA Kidnappers", "S.H.I.E.L.D. Assault Squad").
const SHIELD_OR_HYDRA_NAME_PATTERN = /s\.h\.i\.e\.l\.d\.|hydra/i;

/**
 * Whether a card counts toward S.H.I.E.L.D. Level.
 *
 * @param team - The card's team slug (heroes only; villains/masterminds/tokens have none).
 * @param names - Names to test for the "S.H.I.E.L.D."/"HYDRA" substring (card name,
 *   villain-group name, mastermind name — pass whichever apply; undefined entries skipped).
 * @returns Whether the card is a S.H.I.E.L.D./HYDRA card.
 */
export function matchesShieldOrHydra(
  team: string | undefined | null,
  names: readonly (string | undefined | null)[],
): boolean {
  // why: a card carries exactly one team; compare lowercased so a non-normalized
  // raw registry value ("SHIELD"/"Shield") still matches the shield/hydra icon.
  const teamSlug = typeof team === 'string' ? team.toLowerCase() : undefined;
  if (teamSlug === 'shield' || teamSlug === 'hydra') {
    return true;
  }
  for (const name of names) {
    if (typeof name === 'string' && SHIELD_OR_HYDRA_NAME_PATTERN.test(name)) {
      return true;
    }
  }
  return false;
}
