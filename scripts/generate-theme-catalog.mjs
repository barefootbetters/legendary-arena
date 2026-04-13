/**
 * generate-theme-catalog.mjs — Generates content/themes/CATALOG.md
 *
 * Reads all card set JSON files and the sets.json index, then emits a
 * human-readable markdown catalog of every group-level identifier that
 * theme authors can reference in setupIntent fields.
 *
 * IDs in this catalog are bare slugs (e.g., "loki", "hydra") matching
 * the MatchSetupConfig contract established by WP-005A. The engine
 * resolves these slugs against registry data at setup time.
 *
 * Usage:
 *   node scripts/generate-theme-catalog.mjs
 *
 * Output:
 *   content/themes/CATALOG.md (deterministic, version-controlled)
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const cardsDirectory = join(projectRoot, 'data', 'cards');
const setsIndexPath = join(projectRoot, 'data', 'metadata', 'sets.json');
const outputPath = join(projectRoot, 'content', 'themes', 'CATALOG.md');

// ── Load set index for display names and canonical ordering ─────────────────

// why: sets.json may be a plain array or wrapped in an object ({ sets: [...] }).
// Guard against both shapes so the script does not break if the format evolves.
const setsIndexRaw = JSON.parse(readFileSync(setsIndexPath, 'utf8'));
const setsIndex = Array.isArray(setsIndexRaw)
  ? setsIndexRaw
  : setsIndexRaw.sets ?? [];

const setNamesByAbbreviation = new Map();
/** @type {Map<string, number>} abbr -> index position in sets.json */
const setOrderByIndex = new Map();
for (let index = 0; index < setsIndex.length; index++) {
  const entry = setsIndex[index];
  setNamesByAbbreviation.set(entry.abbr, entry.name);
  setOrderByIndex.set(entry.abbr, index);
}

// ── Scan all card set files ─────────────────────────────────────────────────

const cardFiles = readdirSync(cardsDirectory)
  .filter((filename) => filename.endsWith('.json'))
  .sort();

/** @typedef {{ slug: string, name: string, setAbbreviation: string, setName: string, team?: string }} CatalogEntry */

/** @type {{ masterminds: CatalogEntry[], schemes: CatalogEntry[], villainGroups: CatalogEntry[], henchmenGroups: CatalogEntry[], heroDecks: CatalogEntry[] }} */
const catalog = {
  masterminds: [],
  schemes: [],
  villainGroups: [],
  henchmenGroups: [],
  heroDecks: [],
};

/** @type {Map<string, Map<string, string[]>>} slug -> category -> [setAbbrs] */
const collisionTracker = new Map();

/**
 * Tracks a slug for collision detection across sets.
 * @param {string} category
 * @param {string} slug
 * @param {string} setAbbreviation
 */
function trackSlug(category, slug, setAbbreviation) {
  if (!collisionTracker.has(slug)) {
    collisionTracker.set(slug, new Map());
  }
  const categoryMap = collisionTracker.get(slug);
  if (!categoryMap.has(category)) {
    categoryMap.set(category, []);
  }
  categoryMap.get(category).push(setAbbreviation);
}

/** @type {string[]} warnings emitted during scanning */
const scanWarnings = [];

for (const filename of cardFiles) {
  const filePath = join(cardsDirectory, filename);
  let setData;
  try {
    setData = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (parseError) {
    scanWarnings.push(`${filename}: failed to parse JSON — ${parseError.message}`);
    continue;
  }

  if (!setData.abbr || typeof setData.abbr !== 'string') {
    scanWarnings.push(`${filename}: missing or invalid "abbr" field, skipping.`);
    continue;
  }

  const setAbbreviation = setData.abbr;
  const setName = setNamesByAbbreviation.get(setAbbreviation) || setAbbreviation;

  for (const mastermind of setData.masterminds || []) {
    if (!mastermind.slug || !mastermind.name) {
      scanWarnings.push(`${filename}: mastermind entry missing slug or name, skipping.`);
      continue;
    }
    catalog.masterminds.push({
      slug: mastermind.slug,
      name: mastermind.name,
      setAbbreviation,
      setName,
    });
    trackSlug('masterminds', mastermind.slug, setAbbreviation);
  }

  for (const scheme of setData.schemes || []) {
    if (!scheme.slug || !scheme.name) {
      scanWarnings.push(`${filename}: scheme entry missing slug or name, skipping.`);
      continue;
    }
    catalog.schemes.push({
      slug: scheme.slug,
      name: scheme.name,
      setAbbreviation,
      setName,
    });
    trackSlug('schemes', scheme.slug, setAbbreviation);
  }

  for (const villainGroup of setData.villains || []) {
    if (!villainGroup.slug || !villainGroup.name) {
      scanWarnings.push(`${filename}: villain group entry missing slug or name, skipping.`);
      continue;
    }
    catalog.villainGroups.push({
      slug: villainGroup.slug,
      name: villainGroup.name,
      setAbbreviation,
      setName,
    });
    trackSlug('villainGroups', villainGroup.slug, setAbbreviation);
  }

  for (const henchmenGroup of setData.henchmen || []) {
    if (!henchmenGroup.slug || !henchmenGroup.name) {
      scanWarnings.push(`${filename}: henchmen group entry missing slug or name, skipping.`);
      continue;
    }
    catalog.henchmenGroups.push({
      slug: henchmenGroup.slug,
      name: henchmenGroup.name,
      setAbbreviation,
      setName,
    });
    trackSlug('henchmenGroups', henchmenGroup.slug, setAbbreviation);
  }

  for (const hero of setData.heroes || []) {
    if (!hero.slug || !hero.name) {
      scanWarnings.push(`${filename}: hero entry missing slug or name, skipping.`);
      continue;
    }
    catalog.heroDecks.push({
      slug: hero.slug,
      name: hero.name,
      setAbbreviation,
      setName,
      team: hero.team || undefined,
    });
    trackSlug('heroDecks', hero.slug, setAbbreviation);
  }
}

// ── Identify collisions (category-aware) ────────────────────────────────────
// why: collisions are only meaningful within a single category. A hero slug
// "loki" and a mastermind slug "loki" are in different MatchSetupConfig fields
// and never conflict. Only same-category duplicates across sets are real
// collisions that theme authors need to be aware of.

/** @type {Map<string, Map<string, string[]>>} category -> slug -> [setAbbrs] */
const collisionsByCategory = new Map();
let totalCollisionCount = 0;

for (const [slug, categoryMap] of collisionTracker) {
  for (const [category, setAbbreviations] of categoryMap) {
    if (setAbbreviations.length > 1) {
      if (!collisionsByCategory.has(category)) {
        collisionsByCategory.set(category, new Map());
      }
      collisionsByCategory.get(category).set(slug, setAbbreviations);
      totalCollisionCount++;
    }
  }
}

/**
 * Checks whether a slug has a collision within the given category.
 * @param {string} categoryName
 * @param {string} slug
 * @returns {boolean}
 */
function hasCollision(categoryName, slug) {
  const categoryCollisions = collisionsByCategory.get(categoryName);
  return categoryCollisions !== undefined && categoryCollisions.has(slug);
}

// ── Generate markdown ───────────────────────────────────────────────────────

const lines = [];
const generatedDate = new Date().toISOString().slice(0, 10);

lines.push('# Theme Authoring Catalog');
lines.push('');
lines.push(`> Generated ${generatedDate} by \`scripts/generate-theme-catalog.mjs\``);
lines.push('> Re-run: `node scripts/generate-theme-catalog.mjs`');
lines.push('');
lines.push('All identifiers below are **bare slugs** matching the `MatchSetupConfig`');
lines.push('contract (WP-005A). Use these values directly in theme `setupIntent` fields.');
lines.push('');
lines.push('```json');
lines.push('"setupIntent": {');
lines.push('  "mastermindId": "loki",');
lines.push('  "schemeId": "midtown-bank-robbery",');
lines.push('  "villainGroupIds": ["brotherhood", "hydra"],');
lines.push('  "henchmanGroupIds": ["hand-ninjas"],');
lines.push('  "heroDeckIds": ["spider-man", "wolverine", "iron-man", "storm", "cyclops"]');
lines.push('}');
lines.push('```');
lines.push('');

if (collisionsByCategory.size > 0) {
  lines.push('## Slug Collisions');
  lines.push('');
  lines.push('The following slugs appear in multiple sets within the same category.');
  lines.push('Until a consumer WP defines collision resolution, theme authors should');
  lines.push('note the intended set variant in theme tags or description.');
  lines.push('');
  const sortedCategories = [...collisionsByCategory.keys()].sort();
  for (const category of sortedCategories) {
    const categoryEntries = [...collisionsByCategory.get(category).entries()]
      .sort((a, b) => a[0].localeCompare(b[0]));
    for (const [slug, setAbbreviations] of categoryEntries) {
      lines.push(`- ${category}:\`${slug}\` — ${setAbbreviations.join(', ')}`);
    }
  }
  lines.push('');
}

/**
 * Writes a catalog section grouped by set, ordered by sets.json index.
 * @param {string} title
 * @param {string} fieldName
 * @param {string} collisionCategory - key used in collisionsByCategory
 * @param {CatalogEntry[]} entries
 * @param {boolean} showTeam
 */
function writeSection(title, fieldName, collisionCategory, entries, showTeam = false) {
  lines.push(`## ${title} (${entries.length} total) — \`setupIntent.${fieldName}\``);
  lines.push('');

  // Group by set
  const bySet = new Map();
  for (const entry of entries) {
    if (!bySet.has(entry.setAbbreviation)) {
      bySet.set(entry.setAbbreviation, []);
    }
    bySet.get(entry.setAbbreviation).push(entry);
  }

  // why: iterate sets in sets.json order for stable, semantically grounded
  // output that does not change when filesystem ordering shifts.
  const orderedSetAbbreviations = [...setOrderByIndex.keys()];
  // Append any sets found in card files but missing from sets.json
  for (const setAbbreviation of bySet.keys()) {
    if (!setOrderByIndex.has(setAbbreviation)) {
      orderedSetAbbreviations.push(setAbbreviation);
    }
  }

  for (const setAbbreviation of orderedSetAbbreviations) {
    const setEntries = bySet.get(setAbbreviation);
    if (!setEntries) continue;

    const setName = setNamesByAbbreviation.get(setAbbreviation) || setAbbreviation;
    lines.push(`### ${setName} (${setAbbreviation})`);
    lines.push('');

    // Sort by slug within each set
    const sorted = [...setEntries].sort((a, b) => a.slug.localeCompare(b.slug));
    for (const entry of sorted) {
      const collision = hasCollision(collisionCategory, entry.slug) ? ' ⚠️' : '';
      const team = showTeam && entry.team ? ` [${entry.team}]` : '';
      lines.push(`- \`${entry.slug}\` — ${entry.name}${team}${collision}`);
    }
    lines.push('');
  }
}

writeSection('Masterminds', 'mastermindId', 'masterminds', catalog.masterminds);
writeSection('Schemes', 'schemeId', 'schemes', catalog.schemes);
writeSection('Villain Groups', 'villainGroupIds', 'villainGroups', catalog.villainGroups);
writeSection('Henchmen Groups', 'henchmanGroupIds', 'henchmenGroups', catalog.henchmenGroups);
writeSection('Hero Decks', 'heroDeckIds', 'heroDecks', catalog.heroDecks, true);

// ── Summary ─────────────────────────────────────────────────────────────────

lines.push('---');
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(`| Category | Count |`);
lines.push(`|---|---|`);
lines.push(`| Masterminds | ${catalog.masterminds.length} |`);
lines.push(`| Schemes | ${catalog.schemes.length} |`);
lines.push(`| Villain Groups | ${catalog.villainGroups.length} |`);
lines.push(`| Henchmen Groups | ${catalog.henchmenGroups.length} |`);
lines.push(`| Hero Decks | ${catalog.heroDecks.length} |`);
lines.push(`| **Total** | **${catalog.masterminds.length + catalog.schemes.length + catalog.villainGroups.length + catalog.henchmenGroups.length + catalog.heroDecks.length}** |`);
lines.push(`| Slug collisions | ${totalCollisionCount} |`);
lines.push('');

if (scanWarnings.length > 0) {
  lines.push('## Scan Warnings');
  lines.push('');
  lines.push('The following issues were encountered during catalog generation.');
  lines.push('Affected entries were skipped.');
  lines.push('');
  for (const warning of scanWarnings) {
    lines.push(`- ${warning}`);
  }
  lines.push('');
}

const output = lines.join('\n');
writeFileSync(outputPath, output, 'utf8');

console.log(`Catalog written to ${outputPath}`);
console.log(`  Masterminds:     ${catalog.masterminds.length}`);
console.log(`  Schemes:         ${catalog.schemes.length}`);
console.log(`  Villain Groups:  ${catalog.villainGroups.length}`);
console.log(`  Henchmen Groups: ${catalog.henchmenGroups.length}`);
console.log(`  Hero Decks:      ${catalog.heroDecks.length}`);
console.log(`  Slug collisions: ${totalCollisionCount}`);
if (scanWarnings.length > 0) {
  console.log(`  Scan warnings:   ${scanWarnings.length}`);
  for (const warning of scanWarnings) {
    console.log(`    ⚠ ${warning}`);
  }
}
