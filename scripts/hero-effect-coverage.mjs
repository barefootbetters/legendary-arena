#!/usr/bin/env node
/**
 * Hero effect coverage probe (prototype — read-only, no engine edits).
 *
 * Drives the REAL setup-time parser (`buildHeroAbilityHooks`) over every hero
 * card in every in-repo set (`data/cards/*.json`) and buckets each parsed
 * ability line by whether it yields an executable effect today. This is the
 * "scenario / coverage" instrument: it tells us, deterministically and for the
 * whole corpus, which hero abilities silently do nothing in a real game.
 *
 * Buckets (per ability-line hook produced by the engine parser):
 *   EXECUTABLE          — every effect's keyword is in the executed set below
 *   PARSED_NOT_EXECUTED — parser produced an effect, but a keyword is deferred
 *                         (e.g. 'wound', 'conditional')
 *   NO_EFFECT           — the card HAS printed ability text but the parser
 *                         produced no effect descriptor at all (the bug class:
 *                         vanilla cards with no ability text never reach here,
 *                         they are skipped by buildHeroAbilityHooks)
 *
 * Run from the repo root AFTER `pnpm -r build`:
 *   node scripts/hero-effect-coverage.mjs
 *
 * No randomness, no wall-clock reads, no network. Deterministic given the
 * in-repo card data.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRegistryFromLocalFiles } from '../packages/registry/dist/index.js';
import { buildHeroAbilityHooks } from '../packages/game-engine/dist/setup/heroAbility.setup.js';

// why: __dirname is unavailable in ESM; anchor data dirs to the repo root
// (one level above scripts/) regardless of the cwd the probe is invoked from.
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIRECTORY);
const METADATA_DIRECTORY = join(REPO_ROOT, 'data', 'metadata');
const CARDS_DIRECTORY = join(REPO_ROOT, 'data', 'cards');

// why: mirrors MVP_KEYWORDS in heroEffects.execute.ts:38 (the keywords whose
// executor branch actually mutates G). 'wound' and 'conditional' are declared
// in the union but deferred. This set is duplicated here on purpose — the
// probe is a read-only prototype and must not import an engine-internal const;
// if MVP_KEYWORDS drifts, update this list. (As of main 2026-06-14.)
const EXECUTED_KEYWORDS = new Set([
  'draw', 'attack', 'recruit', 'ko', 'rescue', 'reveal', 'reveal-ko',
  'reveal-min', 'reveal-ko-or-draw', 'reveal-cost-attack', 'reveal-odd-draw',
  'reveal-attack-choose', 'reveal-ko-attack', 'attack-per-count',
]);

// why: the markup tokens the parser recognizes as effect keywords (HERO_KEYWORDS
// in heroKeywords.ts). A `[keyword:X]` whose normalized X is NOT in this set is
// an unsupported named mechanic — it parses to nothing and the card no-ops.
// Mirrors HERO_KEYWORDS on main 2026-06-14 (kept local — read-only prototype).
const KNOWN_MARKUP_KEYWORDS = new Set([
  'draw', 'attack', 'recruit', 'ko', 'rescue', 'wound', 'reveal', 'reveal-ko',
  'reveal-min', 'reveal-ko-or-draw', 'reveal-cost-attack', 'reveal-odd-draw',
  'reveal-attack-choose', 'reveal-ko-attack', 'attack-per-count', 'conditional',
]);

/**
 * Buckets one HeroAbilityHook by its executability.
 *
 * @param {{effects?: Array<{type: string}>}} hook - a parsed hook.
 * @returns {'EXECUTABLE'|'PARSED_NOT_EXECUTED'|'NO_EFFECT'} the bucket.
 */
function classifyHook(hook) {
  const effects = hook.effects ?? [];
  if (effects.length === 0) {
    return 'NO_EFFECT';
  }
  for (const effect of effects) {
    if (!EXECUTED_KEYWORDS.has(effect.type)) {
      return 'PARSED_NOT_EXECUTED';
    }
  }
  return 'EXECUTABLE';
}

/**
 * Removes hooks that are byte-identical after JSON serialization.
 *
 * buildHeroAbilityHooks emits one hook per (card instance x ability line);
 * a hero with N identical copies of a card-side would otherwise inflate the
 * line counts. Coverage cares about distinct (card-side, ability) shapes.
 *
 * @param {object[]} hooks - hooks for a single hero.
 * @returns {object[]} the de-duplicated hooks.
 */
function deduplicateHooks(hooks) {
  const seen = new Set();
  const result = [];
  for (const hook of hooks) {
    const signature = JSON.stringify(hook);
    if (!seen.has(signature)) {
      seen.add(signature);
      result.push(hook);
    }
  }
  return result;
}

/**
 * Loads the registry, runs the parser per hero, and prints a coverage report.
 */
async function main() {
  const registry = await createRegistryFromLocalFiles({
    metadataDir: METADATA_DIRECTORY,
    cardsDir: CARDS_DIRECTORY,
  });

  // Group hero card-sides by their set-qualified hero extId, collecting the
  // printed ability text for context in the NO_EFFECT sample.
  const heroesByExtId = new Map();
  for (const card of registry.listCards()) {
    if (card.cardType !== 'hero') {
      continue;
    }
    const existing = heroesByExtId.get(card.extId) ?? {
      setAbbr: card.setAbbr,
      heroName: card.heroName ?? card.name,
      abilities: [],
    };
    for (const ability of card.abilities) {
      if (typeof ability === 'string' && ability.trim() !== '') {
        existing.abilities.push(ability.trim());
      }
    }
    heroesByExtId.set(card.extId, existing);
  }

  const perSet = new Map();
  const keywordHistogram = new Map();
  const darkHeroes = []; // heroes with >=1 ability hook but 0 executable hooks
  const deferredSamples = [];

  let totalHooks = 0;
  let totalExecutable = 0;
  let totalParsedNotExecuted = 0;
  let totalNoEffect = 0;

  for (const [extId, info] of heroesByExtId) {
    const hooks = deduplicateHooks(
      buildHeroAbilityHooks(registry, { heroDeckIds: [extId] }),
    );
    if (hooks.length === 0) {
      continue; // hero has no parseable ability lines (vanilla / icon-only)
    }

    const setRow = perSet.get(info.setAbbr) ?? {
      heroes: 0, hooks: 0, executable: 0, parsedNotExecuted: 0, noEffect: 0,
    };
    setRow.heroes += 1;

    let executableForThisHero = 0;
    for (const hook of hooks) {
      totalHooks += 1;
      setRow.hooks += 1;
      const bucket = classifyHook(hook);
      if (bucket === 'EXECUTABLE') {
        totalExecutable += 1;
        setRow.executable += 1;
        executableForThisHero += 1;
        for (const effect of hook.effects ?? []) {
          keywordHistogram.set(effect.type, (keywordHistogram.get(effect.type) ?? 0) + 1);
        }
      } else if (bucket === 'PARSED_NOT_EXECUTED') {
        totalParsedNotExecuted += 1;
        setRow.parsedNotExecuted += 1;
        if (deferredSamples.length < 20) {
          deferredSamples.push({ extId, keywords: hook.keywords, effects: hook.effects });
        }
      } else {
        totalNoEffect += 1;
        setRow.noEffect += 1;
      }
    }

    perSet.set(info.setAbbr, setRow);

    if (executableForThisHero === 0) {
      darkHeroes.push({ extId, heroName: info.heroName, abilities: info.abilities });
    }
  }

  const percent = (numerator) =>
    totalHooks === 0 ? '0.0' : ((numerator / totalHooks) * 100).toFixed(1);

  console.log('\n=== Hero effect coverage probe (all in-repo sets) ===\n');
  console.log(`Distinct heroes with >=1 parsed ability line: ${perSet.size === 0 ? 0 : [...perSet.values()].reduce((a, r) => a + r.heroes, 0)}`);
  console.log(`Total parsed ability-line hooks:               ${totalHooks}`);
  console.log(`  EXECUTABLE            ${totalExecutable}  (${percent(totalExecutable)}%)`);
  console.log(`  PARSED_NOT_EXECUTED   ${totalParsedNotExecuted}  (${percent(totalParsedNotExecuted)}%)`);
  console.log(`  NO_EFFECT             ${totalNoEffect}  (${percent(totalNoEffect)}%)`);
  console.log(`Fully-dark heroes (text, but 0 executable effects): ${darkHeroes.length}\n`);

  console.log('--- Per-set breakdown (set | heroes | hooks | exec | deferred | no-effect) ---');
  const sortedSets = [...perSet.entries()].sort((a, b) => b[1].noEffect - a[1].noEffect);
  for (const [setAbbr, row] of sortedSets) {
    console.log(
      `${setAbbr.padEnd(6)} ${String(row.heroes).padStart(4)} ${String(row.hooks).padStart(6)} ` +
      `${String(row.executable).padStart(6)} ${String(row.parsedNotExecuted).padStart(9)} ` +
      `${String(row.noEffect).padStart(10)}`,
    );
  }

  console.log('\n--- Executable keyword histogram (effect type | count) ---');
  const sortedKeywords = [...keywordHistogram.entries()].sort((a, b) => b[1] - a[1]);
  for (const [keyword, count] of sortedKeywords) {
    console.log(`${keyword.padEnd(24)} ${count}`);
  }

  console.log('\n--- Sample NO_EFFECT heroes (printed ability text the parser cannot execute) ---');
  for (const hero of darkHeroes.slice(0, 25)) {
    console.log(`\n[${hero.extId}] ${hero.heroName}`);
    for (const ability of hero.abilities.slice(0, 3)) {
      console.log(`   "${ability}"`);
    }
  }

  console.log('\n--- Sample PARSED_NOT_EXECUTED (deferred keywords, e.g. wound/conditional) ---');
  for (const sample of deferredSamples) {
    console.log(`[${sample.extId}] keywords=${JSON.stringify(sample.keywords)} effects=${JSON.stringify(sample.effects)}`);
  }

  // Enumerate unsupported named mechanics: [keyword:X] tokens the parser does
  // not recognize. This is the "missing mechanics" tail of the NO_EFFECT bucket.
  const unknownMarkup = new Map();
  const markupPattern = /\[keyword:([^\]]+)\]/g;
  for (const info of heroesByExtId.values()) {
    for (const ability of info.abilities) {
      let match;
      while ((match = markupPattern.exec(ability)) !== null) {
        // why: tokens carry trailing magnitudes as ":N" ([keyword:draw:1]) or
        // " N" ([keyword:Smash 3]); case varies. Strip the magnitude in either
        // form and collapse spaces so the bare mechanic name matches the
        // vocabulary (else "draw:1" looks unknown when "draw" is supported).
        const raw = match[1].trim().toLowerCase();
        const name = raw.replace(/:\d+$/, '').replace(/\s+\d+$/, '').replace(/\s+/g, '-');
        if (!KNOWN_MARKUP_KEYWORDS.has(name)) {
          unknownMarkup.set(name, (unknownMarkup.get(name) ?? 0) + 1);
        }
      }
    }
  }
  const sortedUnknown = [...unknownMarkup.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n--- Unsupported named mechanics ([keyword:X] with no engine support): ${sortedUnknown.length} distinct ---`);
  for (const [name, count] of sortedUnknown.slice(0, 45)) {
    console.log(`${name.padEnd(26)} ${count}`);
  }

  console.log('');
}

main().catch((error) => {
  console.error('Coverage probe failed:', error);
  process.exitCode = 1;
});
