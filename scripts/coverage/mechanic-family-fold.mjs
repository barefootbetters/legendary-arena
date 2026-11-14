/**
 * mechanic-family-fold.mjs — the ONE fold from a normalized `[keyword:X]` mechanic
 * slug to its coverage-worklist key.
 *
 * why: shared by `scripts/hero-mechanic-ledger.mjs` (which folds every card marker
 * into a ledger row's `mechanic`) and `apps/dashboard/scripts/build-coverage-ledger.mjs`
 * (which folds every runtime-observed / in-play-baseline key so the /coverage in-play
 * gauge joins those keys to the ledger's status). The runtime harness records the
 * PRE-fold slug (`patrol-the-bridge`, `"when-recruited"-abilities`), while the ledger
 * is keyed by the folded one (`patrol`, `when-recruited-abilities`). With two copies
 * of these rules a folded family could never read resolved on the gauge; one module,
 * one fold, so they cannot drift.
 */

// why: printed-keyword FAMILIES appear on cards as one distinct English phrase per
// parameter value — "Patrol the Rooftops" / "Patrol the Sewers" / "Patrol your Victory
// Pile", "Bridge Conqueror 2" / "Sewers Conqueror", "Cross-Dimensional Hulk Rampage" /
// "…Wolverine Rampage", "Burn 2 Shards" / "Burn 4 Shards" — so `normalizeMechanicToken`
// slugifies each phrase into a SEPARATE unsupported mechanic (25 distinct across these four
// families). That inflates the worklist: the engine implements the FAMILY once (one Patrol
// executor clears every location variant), not one mechanic per printed phrase. These rules
// fold each family to a single canonical slug for the coverage worklist ONLY — the card data
// keeps the faithful printed phrase (`[keyword:Patrol the Rooftops]` is rendered verbatim to
// players via useRules.parseAbilityText, so it must NOT be rewritten). The families fold to
// UNRECOGNIZED heads (there is no `patrol` HeroKeyword), so they correctly stay `unsupported`
// — just as one row per family instead of one per phrase. Ordered, first-match-wins.
//
// why (out-of-time): "Man Out of Time" / "Woman Out of Time" / "Man/Woman Out of Time" /
// "Man or Woman Out of Time" are the SAME keyword printed with the character-appropriate
// gender — one mechanic, so they fold to `out-of-time`. Contrast the Artifact family
// (`artifact` / `ritual-artifact` / `thrown-artifact` / `triggered-artifact`), which is
// DELIBERATELY NOT folded: the printed text shows four genuinely distinct mechanics
// (base once-per-turn passive vs reactive discard-for-effect vs a throw action vs a
// triggered ability), so implementing one does NOT clear the others — they are four
// separate worklist targets, not a parameterized family (verified 2026-07-13).
//
// why (cyber-mod, soulbind — verified 2026-07-13): both are ONE keyword parameterized by
// an axis. Cyber-Mod is an adaptive tiered ability — `[keyword:Cyber-Mod] [hc:X]: effect`,
// `Cyber-Mod Wound: +1 attack per Wound`, `Cyber-Mod 4 Wounds: instead +2 attack` — the
// parameter is the scaling source (classes / wounds / threshold). Soulbind is `Soulbind
// <target>: <effect>` (a Bystander / a Villain / six Villains / another Villain / Arnim
// Zola…), the parameter is the bound target — the same shape as Patrol, NOT the Artifact
// case. Implementing each keyword once clears every variant, so they fold by prefix.
export const MECHANIC_FAMILY_RULES = [
  { pattern: /^patrol(-|$)/, canonical: 'patrol' },
  { pattern: /(^|-)conqueror$/, canonical: 'conqueror' },
  { pattern: /cross-dimensional.*rampage/, canonical: 'cross-dimensional-rampage' },
  { pattern: /^burn-.+-shards$/, canonical: 'burn-shards' },
  { pattern: /out-of-time$/, canonical: 'out-of-time' },
  { pattern: /^cyber-mod(-|$)/, canonical: 'cyber-mod' },
  { pattern: /^soulbind(-|$)/, canonical: 'soulbind' },
];

/**
 * Canonicalizes a normalized mechanic slug: strips leading/trailing punctuation artifacts
 * (a stray `:`, trailing `.`, `artifact--`), then folds a printed-keyword family to its single
 * canonical slug (see MECHANIC_FAMILY_RULES).
 *
 * why: complements the source-side typo fix (ssw1/ssw2/wwhk, 2026-07-13) — the punctuation
 * strip de-dupes any residual artifact twin on the coverage surface even before a re-convert,
 * and the family fold right-sizes the worklist so "implement Patrol once" reads as one row, not
 * twelve. Applied only in the ledger; the card data and its player-facing display are untouched.
 *
 * why (quote strip): a marker that QUOTES a referenced term — `[keyword:"When Recruited"
 * Abilities]`, `[keyword:Revenge for Deadpool's "Friends"]` — leaves stray delimiter quotes
 * MID-slug that the leading/trailing punctuation strip cannot reach (`when-recruited"-abilities`).
 * Strip double-quote characters (straight and curly) anywhere in the slug. Apostrophes are
 * DELIBERATELY spared — they are part of the word (`don't-speak`, `killmonger's-wounds`), and
 * stripping them would read as a typo.
 *
 * @param {string} name - a normalized, keyword-reduced mechanic name.
 * @returns {string} the canonical family slug, or the cleaned name when no family matches.
 */
export function foldMechanicFamily(name) {
  const stripped = name
    .replace(/["“”]/g, '')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/[^a-z0-9]+$/, '');
  for (const rule of MECHANIC_FAMILY_RULES) {
    if (rule.pattern.test(stripped)) {
      return rule.canonical;
    }
  }
  return stripped;
}
