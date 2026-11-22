/**
 * Setup-time opt-in flags for the captured-Hero cost Attack term (WP-905 / D-24862).
 *
 * A dynamic villain's `+` / `*` Attack glyph marks "variable Attack"; it does NOT by
 * itself mean "+Attack equal to each captured Hero's cost". The specific rule differs
 * per card: Dark Memories (per Hero Class in the discard pile), Blood Frenzy (per
 * distinct Victory Point value), a variable-Attack passive (Sunlight, per HQ class),
 * or a per-card capture clause. Only the villains whose printed text actually says
 * "gets +Attack equal to that Hero's cost" add the captured-Hero cost.
 *
 * This builder records exactly those villains, keyed on the villain's REAL Hero-capture
 * ability marker (the printed clause that attaches a Hero), NOT on the Attack glyph.
 * resolveBaseFightCost then gates the captured-Hero cost sum on an explicit opt-in
 * instead of inferring it from the display marker, closing the latent trap that any
 * future `N+`-keyword villain given a capture line would silently add the Hero's cost.
 *
 * Mirrors the buildVillainBloodFrenzy own-file precedent (a new setup scan in its own
 * file), reading the selected villains through the shared listSelectedVillainCards
 * enumerator (WP-898 / D-24855) and excluding the villains whose own printed rule is a
 * DIFFERENT variable-Attack term (attack-per-captured / variable-attack), detected with
 * the same structured parsers resolveFightCost checks first (not a raw substring test).
 *
 * No boardgame.io import. No randomness. No .reduce(). Setup-time only.
 */

import type { CardExtId } from '../state/zones.types.js';
import type { MatchSetupConfig } from '../matchSetup.types.js';
import {
  listSelectedVillainCards,
  parseAttackPerCapturedLine,
  parseVariableAttackLine,
} from './villainDefeatRequirement.setup.js';

// why: WP-905 / D-24862 — the hand-maintained allow-list of the `[effect:…]` marker
// tokens that attach a Hero to G.villainAttachedHeroes (the printed capture clauses),
// so a villain opts into the captured-Hero cost term by its REAL capture ability, not by
// the `+` / `*` display glyph. The camelCase tokens are the HQ-capture data markers
// (captureHeroFromHq's rightmost / highestCost / lowestCost selectors); `capture-hq-hero`
// is the kebab dispatch primitive the same handler reads, kept for a future card that
// authors it directly; `capture-pile-hero` / `capture-hq-heroes-cost-lte` are Venom's
// pile and cheap-HQ captures; `capture-hero-deck-top-by-icon-guess` is WP-903 Bullseye's
// icon-guess capture (added here because Bullseye is dynamic `4+` and must keep adding its
// captured Hero's cost — a hardening, not a behaviour change). The builder test (§E drift
// assertion) pins this set ⊇ every data-marker token so a future hero-capture primitive
// cannot silently drop a villain's cost term.
export const HERO_CAPTURE_EFFECT_MARKERS: ReadonlySet<string> = new Set([
  'captureHqHeroRightmost',
  'captureHqHeroHighestCost',
  'captureHqHeroLowestCost',
  'capture-hq-hero',
  'capture-pile-hero',
  'capture-hq-heroes-cost-lte',
  'capture-hero-deck-top-by-icon-guess',
]);

/** Regex for any `[effect:<content>]` marker on an ability line. */
const EFFECT_MARKER_PATTERN = /\[effect:([^\]]+)\]/g;

/**
 * Whether an ability line carries a Hero-capture `[effect:…]` marker.
 *
 * The effect name is the content before the first `:` (so `capture-pile-hero:sidekick`
 * and `capture-hq-heroes-cost-lte:2` match on their name), checked against
 * HERO_CAPTURE_EFFECT_MARKERS. A later marker on the line is still scanned.
 *
 * @param abilityLine - One villain ability text line.
 * @returns true when the line carries a hero-capture effect marker.
 */
function lineHasHeroCaptureMarker(abilityLine: string): boolean {
  const regex = new RegExp(EFFECT_MARKER_PATTERN.source, 'g');
  let match: RegExpExecArray | null = regex.exec(abilityLine);
  while (match !== null) {
    const effectName = match[1]!.split(':')[0]!;
    if (HERO_CAPTURE_EFFECT_MARKERS.has(effectName)) {
      return true;
    }
    match = regex.exec(abilityLine);
  }
  return false;
}

/**
 * Whether an ability line prints its own variable-Attack term (WP-838 / WP-841).
 *
 * A villain with an `[attack-per-captured:…]` or `[variable-attack:…]` clause (co2e
 * Venom, Paibok, Super-Skrull) prints its own Attack rule, which resolveFightCost
 * resolves BEFORE the captured-Hero cost term; such a villain never adds the cost even
 * when it also captures a Hero, so it is excluded from the opt-in set. Detected with the
 * same structured parsers resolveFightCost's carve-outs use, not a raw substring test.
 *
 * @param abilityLine - One villain ability text line.
 * @returns true when the line parses as an attack-per-captured or variable-attack term.
 */
function lineHasOwnVariableAttackTerm(abilityLine: string): boolean {
  return (
    parseAttackPerCapturedLine(abilityLine) !== null ||
    parseVariableAttackLine(abilityLine) !== null
  );
}

/**
 * Builds the captured-Hero cost opt-in map for the villain groups selected for this match.
 *
 * A villain qualifies when any of its ability lines carries a HERO_CAPTURE_EFFECT_MARKERS
 * marker AND no line prints its own variable-Attack term (attack-per-captured /
 * variable-attack). Each qualifying villain fans one `true` entry per copy-indexed
 * instance ext_id via the shared listSelectedVillainCards enumerator. The caller spreads
 * the result onto G only when non-empty, so a match with no cost-capturing villain keeps a
 * byte-identical G (hash oracles). After setup, G.villainCapturedHeroCost is immutable.
 *
 * @param registry - Setup-time registry reader; unknown so narrow mocks work (a reader
 *   without getSet yields an empty map).
 * @param matchConfig - The validated match setup; its villainGroupIds are scanned.
 * @returns A map from each cost-capturing villain copy's instance ext_id to true.
 */
export function buildVillainCapturedHeroCost(
  registry: unknown,
  matchConfig: MatchSetupConfig,
): Record<CardExtId, true> {
  const capturedHeroCost: Record<CardExtId, true> = {};
  for (const villainCard of listSelectedVillainCards(registry, matchConfig)) {
    let hasCaptureMarker = false;
    let hasOwnVariableAttackTerm = false;
    for (const abilityLine of villainCard.abilityLines) {
      if (lineHasHeroCaptureMarker(abilityLine)) {
        hasCaptureMarker = true;
      }
      if (lineHasOwnVariableAttackTerm(abilityLine)) {
        hasOwnVariableAttackTerm = true;
      }
    }
    // why: the own variable-Attack term (Venom, Paibok) wins and is resolved first, so a
    // villain that prints one never adds the captured-Hero cost even if it also captures.
    if (!hasCaptureMarker || hasOwnVariableAttackTerm) {
      continue;
    }
    for (const cardId of villainCard.instanceExtIds) {
      capturedHeroCost[cardId] = true;
    }
  }
  return capturedHeroCost;
}
