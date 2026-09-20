/**
 * check-hero-count-markers.mjs
 *
 * Drift gate for the per-hero-class-played count-scaled family (WP-711 / D-24534).
 *
 * Every hero ability line that scales a resource "for each other [hc:X]
 * Hero/Ally/card you (have) played this turn" MUST carry the matching per-class
 * count marker in the SAME line:
 *   [keyword:attack-per-count:<X>-heroes-played-this-turn:<N>]  (attack), or
 *   [keyword:recruit-per-count:<X>-heroes-played-this-turn:<N>] (recruit).
 *
 * Without the marker the engine falls back to a flat "[hc:X]: +N" gate and
 * grants a flat +N whenever ANY one other same-class Hero was played — ignoring
 * the count. That is exactly how Arc Reactor (core/iron-man) undercounted in
 * live play until it was backfilled: WP-711 shipped the four per-class sources
 * but marked only six lines and missed the rest.
 *
 * The apply pass's --validate only checks map -> data (every map entry is
 * present). Nothing checked data -> marker: a count-phrase line that was never
 * added to inputs/hero-ability-markers.json is invisible to --validate. This
 * gate closes that direction. It scans the COMMITTED data/cards corpus (text
 * only — no build, no registry import).
 *
 * Modes:
 *   --check   exit non-zero if any non-deferred gap (or a stale DEFERRED entry)
 *             is found. This is the CI gate.
 *   (default) print every gap and the deferred list, then exit 0.
 *
 * DEFERRED carries lines that are intentionally unmarked, each with a reason.
 * A DEFERRED entry that no longer matches an unmarked count-phrase line (the
 * card was marked, renamed, or removed) is STALE and fails --check, so the
 * allowlist cannot rot into a silent suppression.
 *
 * The pure helpers (parseCountClauseClass, markerPresentFor, evaluateLine,
 * findGaps, findStaleDeferred, DEFERRED) are exported and data-injected so the
 * unit test needs no file I/O; main() is guarded behind isRunDirectly().
 */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CARDS_DIR = join(SCRIPT_DIRECTORY, '..', 'data', 'cards');

// why: the per-class-played count clause, noun-agnostic. Matches Arc Reactor's
// "other[hc:tech] Hero" (no space), Overloaded Unibeam's "other [hc:tech] Hero",
// the ff04 "other [hc:strength]card" (no space, "card"), Beast's "other
// [hc:tech] card", and the vill "other [hc:tech] Ally" flavor. Captures the
// hero-class slug. It deliberately does NOT match the team/color/icon count
// families (no "[hc:X] ... played this turn" shape), so those are out of scope.
export const COUNT_CLAUSE =
  /for each other\s*\[hc:([a-z-]+)\]\s*(?:hero|ally|card)s?\s+you\s+(?:have\s+)?played this turn/i;

/**
 * Returns the hero-class slug of a per-class count clause, or null when the line
 * carries no such clause.
 * @param {string} line
 * @returns {string|null}
 */
export function parseCountClauseClass(line) {
  if (typeof line !== 'string') {
    return null;
  }
  const match = COUNT_CLAUSE.exec(line);
  return match === null ? null : match[1];
}

/**
 * True when the line already carries the attack- or recruit-per-count marker for
 * the given hero class. The count source slug is exactly
 * "<heroClass>-heroes-played-this-turn" (heroCountSource.ts).
 * @param {string} line
 * @param {string} heroClass
 * @returns {boolean}
 */
export function markerPresentFor(line, heroClass) {
  const source = `${heroClass}-heroes-played-this-turn`;
  return (
    line.includes(`[keyword:attack-per-count:${source}:`) ||
    line.includes(`[keyword:recruit-per-count:${source}:`) ||
    // why: WP-714 / D-24537 — the count-scaled bystander-capture marker satisfies a
    // per-class count clause exactly as the attack/recruit-per-count markers do.
    line.includes(`[keyword:kidnap-per-count:${source}:`)
  );
}

/**
 * Pure classification of a single ability line.
 * @param {string} line
 * @returns {{isCountLine:boolean, heroClass:string|null, marked:boolean}}
 */
export function evaluateLine(line) {
  const heroClass = parseCountClauseClass(line);
  if (heroClass === null) {
    return { isCountLine: false, heroClass: null, marked: false };
  }
  return { isCountLine: true, heroClass, marked: markerPresentFor(line, heroClass) };
}

// why: lines that legitimately have no per-class marker yet. Each names the
// exact (set, hero, card, abilityIndex) plus the reason it is deferred, so the
// allowlist reads as a tracked backlog, never a silent mute.
// why: WP-714 / D-24537 — Ultron's Genetic Experimentation (the sole prior deferral) is
// now marked with [keyword:kidnap-per-count:tech-heroes-played-this-turn:1], so its
// entry is removed. A stale deferral (a card that IS now marked) fails --check, so the
// allowlist must shrink in lockstep with the marker landing.
export const DEFERRED = [];

/** True when a scanned entry matches a DEFERRED allowlist entry (by identity). */
export function isDeferred(entry) {
  return DEFERRED.some(
    (deferred) =>
      deferred.set === entry.set &&
      deferred.hero === entry.hero &&
      deferred.card === entry.card &&
      deferred.abilityIndex === entry.abilityIndex,
  );
}

/**
 * Reads the committed corpus and returns every hero ability line that carries
 * the per-class count clause, tagged with whether its marker is present.
 * @param {string} [cardsDir]
 * @returns {{set:string,hero:string,card:string,abilityIndex:number,heroClass:string,marked:boolean,line:string}[]}
 */
export function scanCorpus(cardsDir = DEFAULT_CARDS_DIR) {
  const found = [];
  const files = readdirSync(cardsDir).filter((name) => name.endsWith('.json'));
  for (const fileName of files) {
    const setKey = fileName.replace(/\.json$/, '');
    const parsed = JSON.parse(readFileSync(join(cardsDir, fileName), 'utf8'));
    const heroes = Array.isArray(parsed.heroes) ? parsed.heroes : [];
    for (const hero of heroes) {
      const cards = Array.isArray(hero.cards) ? hero.cards : [];
      for (const card of cards) {
        const abilities = Array.isArray(card.abilities) ? card.abilities : [];
        for (let abilityIndex = 0; abilityIndex < abilities.length; abilityIndex += 1) {
          const line = abilities[abilityIndex];
          const evaluated = evaluateLine(line);
          if (!evaluated.isCountLine) {
            continue;
          }
          found.push({
            set: setKey,
            hero: hero.slug,
            card: card.slug,
            abilityIndex,
            heroClass: evaluated.heroClass,
            marked: evaluated.marked,
            line,
          });
        }
      }
    }
  }
  return found;
}

/** Unmarked scanned entries that are NOT on the deferred allowlist. */
export function findGaps(scanned) {
  return scanned.filter((entry) => !entry.marked && !isDeferred(entry));
}

/**
 * DEFERRED entries that no longer match an unmarked scanned line — the card was
 * marked, renamed, or removed. Returned so --check can fail on a stale mute.
 */
export function findStaleDeferred(scanned) {
  const unmarked = scanned.filter((entry) => !entry.marked);
  return DEFERRED.filter(
    (deferred) =>
      !unmarked.some(
        (entry) =>
          entry.set === deferred.set &&
          entry.hero === deferred.hero &&
          entry.card === deferred.card &&
          entry.abilityIndex === deferred.abilityIndex,
      ),
  );
}

/**
 * Runs the scan against the committed corpus and prints a report. Returns the
 * process exit code (0 OK; 1 when --check and there is a gap or stale entry).
 * @returns {number}
 */
export function runCheck() {
  const isCheck = process.argv.includes('--check');
  const scanned = scanCorpus();
  const unmarked = scanned.filter((entry) => !entry.marked);
  const gaps = findGaps(scanned);
  const deferredHit = unmarked.filter((entry) => isDeferred(entry));
  const staleDeferred = findStaleDeferred(scanned);

  console.log(
    `Hero count-marker gap scan: ${scanned.length} per-class count line(s) across the committed corpus.`,
  );
  console.log(
    `  marked: ${scanned.length - unmarked.length}  deferred: ${deferredHit.length}  unmarked gaps: ${gaps.length}`,
  );

  if (deferredHit.length > 0) {
    console.log('\nDeferred (tracked, not marked):');
    for (const entry of deferredHit) {
      const match = DEFERRED.find(
        (deferred) =>
          deferred.set === entry.set &&
          deferred.hero === entry.hero &&
          deferred.card === entry.card &&
          deferred.abilityIndex === entry.abilityIndex,
      );
      console.log(`  - ${entry.set}/${entry.hero}/${entry.card}[${entry.abilityIndex}] (${entry.heroClass}): ${match.reason}`);
    }
  }

  if (gaps.length > 0) {
    console.log('\nUNMARKED count-phrase lines (missing per-class marker):');
    for (const entry of gaps) {
      console.log(
        `  - ${entry.set}/${entry.hero}/${entry.card}[${entry.abilityIndex}] (${entry.heroClass}) needs ` +
          `[keyword:attack-per-count:${entry.heroClass}-heroes-played-this-turn:N] (or recruit-per-count)`,
      );
      console.log(`      line: ${entry.line}`);
    }
    console.log(
      '\nAdd the entry to scripts/convert-cards/inputs/hero-ability-markers.json and regenerate ' +
        '(node scripts/convert-cards/apply-hero-ability-markers.mjs), or defer it with a reason in this script.',
    );
  }

  if (staleDeferred.length > 0) {
    console.log('\nSTALE deferred entries (no longer match an unmarked line — remove them):');
    for (const deferred of staleDeferred) {
      console.log(`  - ${deferred.set}/${deferred.hero}/${deferred.card}[${deferred.abilityIndex}]`);
    }
  }

  if (isCheck && (gaps.length > 0 || staleDeferred.length > 0)) {
    console.error(
      `\nFAIL: ${gaps.length} unmarked per-class count line(s) and ${staleDeferred.length} stale deferred entry(ies).`,
    );
    return 1;
  }

  if (isCheck) {
    console.log('\nOK: no unmarked per-class count lines outside the deferred allowlist.');
  }
  return 0;
}

/** True when this module is the entry point (not imported by the unit test). */
function isRunDirectly() {
  const invokedPath = process.argv[1];
  if (invokedPath === undefined) {
    return false;
  }
  return resolve(invokedPath) === fileURLToPath(import.meta.url);
}

// why: guard the CLI so importing this module (from the unit test) neither runs
// the check nor reads any file — the test exercises the pure helpers with
// injected strings and asserts the live corpus has no gaps.
if (isRunDirectly()) {
  process.exitCode = runCheck();
}
