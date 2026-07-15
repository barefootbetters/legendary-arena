/**
 * Pure narrative-composition helpers for `NotableGameEvent` records.
 *
 * Each composer takes plain string / number / array inputs and returns a
 * single-sentence English narrative. Composers have no `G`/`ctx` dependency,
 * import no game framework, and import no registry package — they are pure
 * functions, replay-deterministic by construction, and testable in
 * isolation via golden strings.
 *
 * Format strings are byte-stable: identical inputs produce identical output.
 * No `toLocaleString`, no `Intl.*`, no locale-sensitive formatters. No
 * conditional punctuation, no optional clauses that reorder segments.
 * Any change to a format string is a replay-affecting change and requires
 * re-pinning `PRE_WP080_HASH` + the sentinel `finalStateHash`.
 *
 * No `boardgame.io` import. No `@legendary-arena/registry` import.
 */

import type { VillainEffectKeyword } from '../rules/villainAbility.types.js';
import type { SchemeTwistResolverKey } from './notableEvents.types.js';

// ---------------------------------------------------------------------------
// Effect-keyword → human label
// ---------------------------------------------------------------------------

// why: pure-string mapping from machine keyword to a short human phrase used
// inside the Fight / Ambush narratives. Stable byte-for-byte; replay-locked.
// Adding a new keyword to `VillainEffectKeyword` requires adding a matching
// label here AND re-pinning the replay hashes.
const EFFECT_KEYWORD_LABELS: Readonly<Record<VillainEffectKeyword, string>> = {
  gainWoundEachPlayer: 'every player gained a wound',
  gainWoundCurrentPlayer: 'the active player gained a wound',
  koHeroCurrentPlayer: 'the active player KO’d a hero',
  heroDeckTopToEscape: 'the top of the hero deck escaped',
  captureBystander: 'a bystander was captured',
  koHeroEachPlayer: 'every player KO’d a hero',
  koHeroEachPlayerMag2: 'every player KO’d two heroes',
  captureHqHeroRightmost: "the rightmost HQ hero was captured",
  captureHqHeroHighestCost: "the highest-cost HQ hero was captured",
  captureHqHeroLowestCost: "the lowest-cost HQ hero was captured",
};

/**
 * Returns the human label for a single effect keyword.
 *
 * Falls back to the raw keyword string on out-of-vocabulary input (defensive
 * — `VillainEffectKeyword` is a closed union, but a future widening must not
 * cause emissions to throw).
 *
 * @param effect - The effect keyword to label.
 * @returns Human-readable phrase for narratives.
 */
function labelForEffect(effect: VillainEffectKeyword): string {
  const label = EFFECT_KEYWORD_LABELS[effect];
  if (typeof label === 'string' && label.length > 0) return label;
  return effect;
}

// ---------------------------------------------------------------------------
// Effect-result log line (WP-316)
// ---------------------------------------------------------------------------

/**
 * A villain-effect result with its target ext_ids already resolved to display
 * names (WP-316).
 *
 * The fire site (which owns `G.cardDisplayData`) resolves each result's targets
 * to names and hands this pure DTO to `composeEffectResultLogLine`, so the
 * composer keeps its no-`G` purity. `pending` marks a parked interactive KO for
 * which no target has been chosen yet.
 */
export interface ResolvedEffectResult {
  keyword: VillainEffectKeyword;
  targetNames: string[];
  pending?: boolean;
}

/**
 * Composes the clause for a `Fight effect:` / `Ambush effect:` / `Escape effect:`
 * log line from the resolved per-effect results.
 *
 * Pure + byte-stable. Each result renders as its generic keyword label with the
 * resolved target names appended in parentheses when present, or the fixed
 * "the active player must KO a hero" phrase when the KO is still pending. Clauses
 * join with "; " in dispatch order. The caller supplies the leading
 * `<timing> effect: ` label and the trailing period.
 *
 * @param results - The resolved effect results in dispatch order (>= 1).
 * @returns The joined clause string (no leading label, no trailing period).
 */
export function composeEffectResultLogLine(results: ResolvedEffectResult[]): string {
  const clauses: string[] = [];
  for (const result of results) {
    clauses.push(composeEffectResultClause(result));
  }
  return clauses.join('; ');
}

/**
 * Composes one effect-result clause: the pending phrase, or the keyword label
 * with resolved target names appended when any were affected.
 *
 * @param result - One resolved effect result.
 * @returns The clause for this single effect.
 */
function composeEffectResultClause(result: ResolvedEffectResult): string {
  if (result.pending === true) {
    // why: WP-316 — no hero is KO'd yet for a parked interactive KO; the player
    // picks via resolveKoHeroChoice later, so name no target here. The resolved
    // hero IS named at resolve time — resolveKoHeroChoice pushes a "Player N KO'd
    // <name>" log line (the WP-316 §Scope Out resolve-time-naming follow-up).
    return 'the active player must KO a hero';
  }
  const label = labelForEffect(result.keyword);
  if (result.targetNames.length > 0) {
    return `${label} (${result.targetNames.join(', ')})`;
  }
  return label;
}

// ---------------------------------------------------------------------------
// Fight narrative
// ---------------------------------------------------------------------------

/**
 * Composes the single-sentence narrative for a `fightResolved` event.
 *
 * Inputs are pure values; no `G`/`ctx` access. `cardName` is the resolved
 * display name (or the raw `cardId` if `cardDisplayData` had no entry).
 *
 * @param cardName - Human-facing name of the defeated card.
 * @param bystandersRescued - Bystanders rescued into the victory pile (>= 0).
 * @param effectResults - Fight: effect results the executor applied, with target
 *   ext_ids already resolved to display names (WP-319).
 * @returns Single English sentence describing the resolved fight.
 */
export function composeFightNarrative(
  cardName: string,
  bystandersRescued: number,
  effectResults: ResolvedEffectResult[],
): string {
  const bystanderClause =
    bystandersRescued > 0
      ? ` and rescued ${String(bystandersRescued)} bystander(s)`
      : '';
  if (effectResults.length === 0) {
    return `Fought "${cardName}"${bystanderClause}.`;
  }
  // why: WP-319 / D-24105 — the fightResolved narrative (shown by the
  // center-screen NotableEventOverlay) now NAMES the specific effect target(s)
  // via the shared composeEffectResultLogLine, matching the durable-log
  // `Fight effect:` line. Supersedes the WP-316 choice to keep this narrative
  // keyword-granular for byte-identity: the sentinel replay fires no fight
  // event, so `finalStateHash` is unchanged (verified). The `appliedEffects`
  // keyword field on the event is unchanged; only this narrative string is enriched.
  const effectClause = composeEffectResultLogLine(effectResults);
  return `Fought "${cardName}"${bystanderClause}; Fight effect: ${effectClause}.`;
}

// ---------------------------------------------------------------------------
// Ambush narrative
// ---------------------------------------------------------------------------

/**
 * Composes the single-sentence narrative for an `ambushResolved` event.
 *
 * The unconditional city-entry bystander attach is NOT an Ambush effect
 * and is never described here — only `appliedEffects` returned by
 * `executeVillainAbilities(...,'onAmbush')` are referenced.
 *
 * @param cardName - Human-facing name of the revealed villain.
 * @param effectResults - Ambush: effect results the executor applied, with target
 *   ext_ids already resolved to display names (WP-319).
 * @returns Single English sentence describing the resolved ambush.
 */
export function composeAmbushNarrative(
  cardName: string,
  effectResults: ResolvedEffectResult[],
): string {
  if (effectResults.length === 0) {
    return `"${cardName}" entered the city with no Ambush effect.`;
  }
  // why: WP-319 / D-24105 — names the specific effect target(s) in the
  // ambushResolved narrative (overlay + log) via the shared
  // composeEffectResultLogLine; supersedes the WP-316 keyword-granular narrative.
  const effectClause = composeEffectResultLogLine(effectResults);
  return `"${cardName}" ambushed: ${effectClause}.`;
}

// ---------------------------------------------------------------------------
// Scheme twist narrative
// ---------------------------------------------------------------------------

// why: pure-string mapping from camelCase resolver key to a stable English
// phrase. Locked byte-for-byte (replay-affecting) — adding a sixth resolver
// key requires expanding both the `SchemeTwistResolverKey` union AND this
// map, then re-pinning the replay hashes.
const RESOLVER_KEY_PHRASES: Readonly<Record<SchemeTwistResolverKey, string>> = {
  revealOrPunish: 'players were forced to reveal a matching hero or suffer a penalty',
  chainedReveals: 'extra villain-deck cards were revealed',
  woundAll: 'every player gained wounds',
  koFromHq: 'heroes were KO’d from the HQ',
  midtownBankRobbery: 'the Bank villain captured bystanders and another card was revealed',
};

/**
 * Composes the single-sentence narrative for a `schemeTwistResolved` event.
 *
 * @param cardName - Human-facing name of the scheme-twist card.
 * @param resolverKey - Which of the five locked resolvers handled the twist.
 * @returns Single English sentence describing the resolved scheme twist.
 */
export function composeSchemeTwistNarrative(
  cardName: string,
  resolverKey: SchemeTwistResolverKey,
): string {
  const phrase = RESOLVER_KEY_PHRASES[resolverKey] ?? resolverKey;
  return `Scheme Twist "${cardName}": ${phrase}.`;
}

// ---------------------------------------------------------------------------
// Mastermind strike narrative
// ---------------------------------------------------------------------------

/**
 * Composes the single-sentence narrative for a `mastermindStrikeResolved` event.
 *
 * @param cardName - Human-facing name of the strike card.
 * @returns Single English sentence describing the resolved mastermind strike.
 */
export function composeMastermindStrikeNarrative(cardName: string): string {
  return `Master Strike: "${cardName}" resolved.`;
}

// ---------------------------------------------------------------------------
// Mastermind defeat narrative
// ---------------------------------------------------------------------------

/**
 * Composes the single-sentence narrative for a `mastermindDefeated` event.
 *
 * Inputs are pure values; no `G`/`ctx` access. `mastermindName` is the
 * resolved display name (or the raw mastermind id when `cardDisplayData`
 * had no entry). The bystander clause mirrors `composeFightNarrative` so
 * both rescue messages read identically.
 *
 * @param mastermindName - Human-facing name of the defeated mastermind.
 * @param bystandersRescued - Bystanders rescued into the victory pile (>= 0).
 * @returns Single English sentence describing the mastermind's defeat.
 */
export function composeMastermindDefeatedNarrative(
  mastermindName: string,
  bystandersRescued: number,
): string {
  const bystanderClause =
    bystandersRescued > 0
      ? ` and rescued ${String(bystandersRescued)} bystander(s)`
      : '';
  return `Defeated the Mastermind "${mastermindName}"${bystanderClause}.`;
}
