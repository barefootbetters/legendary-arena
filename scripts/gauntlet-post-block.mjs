/**
 * gauntlet-post-block.mjs — emit the generated composition block for a
 * per-gauntlet blog post (the "Gauntlet Guides" series, D-24191).
 *
 * The composition of a gauntlet is 100% derived: the catalog builds it from
 * the registry at server startup, and the per-player-count setup numbers come
 * from the registry's own table. Hand-typing any of it into a post starts it
 * rotting on the next set change — the same failure that left three different
 * gauntlet counts in wiki/leaderboard.md. This script is the antidote: it
 * prints the block, and the post pastes it.
 *
 * It publishes ONLY what a GauntletDefinition actually carries. Villain
 * groups are explicitly unconstrained ("any villain groups qualify"), and
 * henchmen, officers, and sidekicks are not gauntlet properties — emitting
 * them as gauntlet facts would be fabrication.
 *
 * Usage:
 *   node scripts/gauntlet-post-block.mjs <setAbbr> <mastermindSlug>
 *   node scripts/gauntlet-post-block.mjs core magneto
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PLAYER_COUNT_SETUP } from '../packages/registry/dist/playerCountSetup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

// why: mirrors formatCardDisplayName() in the legends-board display helpers.
// A second copy is deliberate per the duplicate-first rule — if a third
// consumer appears, that is the signal to extract a shared module.
const SORT_ORDER_ARTICLE_SUFFIXES = [', An', ', The', ', A'];

/**
 * Restores a sort-order card name to natural reading order, matching what
 * the leaderboard renders. Display only — never feed the result into an id,
 * slug, or link.
 *
 * @param cardName The published card name, in whatever form the set stores.
 * @returns The name in natural order, or the input if it carries no article.
 */
function formatCardDisplayName(cardName) {
  for (const articleSuffix of SORT_ORDER_ARTICLE_SUFFIXES) {
    if (!cardName.endsWith(articleSuffix)) {
      continue;
    }
    const significantPart = cardName.slice(
      0,
      cardName.length - articleSuffix.length,
    );
    if (significantPart.length === 0) {
      return cardName;
    }
    return `${articleSuffix.slice(2)} ${significantPart}`;
  }
  return cardName;
}

/**
 * Reads a set's card file and its display name from the sets metadata.
 *
 * @param setAbbr The set's registry abbreviation, e.g. `core`.
 * @returns The parsed card data plus the set's display name.
 */
function loadSet(setAbbr) {
  const cardsPath = join(REPO_ROOT, 'data', 'cards', `${setAbbr}.json`);
  let cards;
  try {
    cards = JSON.parse(readFileSync(cardsPath, 'utf8'));
  } catch (readError) {
    throw new Error(
      `Could not read card data for set "${setAbbr}" at ${cardsPath}. ` +
        `Check the set abbreviation against data/cards/. (${readError.message})`,
    );
  }
  const setsPath = join(REPO_ROOT, 'data', 'metadata', 'sets.json');
  const setsRaw = JSON.parse(readFileSync(setsPath, 'utf8'));
  const setsList = Array.isArray(setsRaw) ? setsRaw : setsRaw.sets;
  const setEntry = setsList.find((candidate) => candidate.abbr === setAbbr);
  if (setEntry === undefined) {
    throw new Error(
      `Set "${setAbbr}" is missing from data/metadata/sets.json. ` +
        `A set must be registered there before it publishes gauntlets.`,
    );
  }
  return { cards, setName: setEntry.name };
}

/**
 * Renders the identity table and the numbered leg list.
 *
 * @param setAbbr The set abbreviation.
 * @param setName The set's display name.
 * @param mastermind The mastermind card record.
 * @param schemes The set's scheme records, in catalog order.
 * @returns The markdown block.
 */
function renderIdentityBlock(setAbbr, setName, mastermind, schemes) {
  const boardName = `gauntlet-${setAbbr}-${mastermind.slug}`;
  const lines = [
    '| | |',
    '|---|---|',
    `| **Mastermind** | ${formatCardDisplayName(mastermind.name)} |`,
    `| **Set** | ${setName} — \`${setAbbr}\` |`,
    `| **Legs** | ${schemes.length} schemes |`,
    `| **Board** | \`${boardName}\` (solo), \`…-p2\` … \`…-p5\` |`,
    '| **Divisions** | Open, Fixed-Pool |',
    '',
    `**The ${schemes.length === 4 ? 'four' : schemes.length === 8 ? 'eight' : 'nine'} legs:**`,
    '',
  ];
  let legNumber = 1;
  for (const scheme of schemes) {
    lines.push(`${legNumber}. ${formatCardDisplayName(scheme.name)}`);
    legNumber += 1;
  }
  return lines.join('\n');
}

/**
 * Renders the per-player-count setup table from the registry's own values.
 *
 * @returns The markdown table.
 */
function renderSetupTable() {
  const lines = [
    '| Players | Villain groups | Henchmen groups | Bystanders in villain deck | Heroes |',
    '|---|---|---|---|---|',
  ];
  for (const playerCount of [1, 2, 3, 4, 5]) {
    const setup = PLAYER_COUNT_SETUP[playerCount];
    lines.push(
      `| ${playerCount} | ${setup.villainGroupCount} | ${setup.henchmenGroupCount} | ` +
        `${setup.villainDeckBystanderCount} | ${setup.heroCount} |`,
    );
  }
  return lines.join('\n');
}

/**
 * Renders the Fixed-Pool budget table. The budget is `heroCount + 2`
 * (D-24187 §5), collapsed to the distinct rows a reader cares about.
 *
 * @returns The markdown table.
 */
function renderBudgetTable() {
  const lines = [
    '| Players | Heroes per match | Fixed-Pool budget |',
    '|---|---|---|',
  ];
  const soloHeroCount = PLAYER_COUNT_SETUP[1].heroCount;
  const midHeroCount = PLAYER_COUNT_SETUP[2].heroCount;
  const fiveHeroCount = PLAYER_COUNT_SETUP[5].heroCount;
  lines.push(`| 1 | ${soloHeroCount} | ${soloHeroCount + 2} |`);
  lines.push(`| 2–4 | ${midHeroCount} | ${midHeroCount + 2} |`);
  lines.push(`| 5 | ${fiveHeroCount} | ${fiveHeroCount + 2} |`);
  return lines.join('\n');
}

const [, , setAbbrArgument, mastermindSlugArgument] = process.argv;
if (setAbbrArgument === undefined || mastermindSlugArgument === undefined) {
  console.error(
    'Usage: node scripts/gauntlet-post-block.mjs <setAbbr> <mastermindSlug>\n' +
      'Example: node scripts/gauntlet-post-block.mjs core magneto',
  );
  process.exit(1);
}

// why: loadSet throws a fully-worded diagnostic for a bad set abbreviation or
// an unregistered set; a CLI should print that sentence, not a stack trace.
let cards;
let setName;
try {
  ({ cards, setName } = loadSet(setAbbrArgument));
} catch (loadError) {
  console.error(loadError.message);
  process.exit(1);
}
const schemes = cards.schemes ?? [];
if (schemes.length === 0) {
  console.error(
    `Set "${setAbbrArgument}" packages no schemes, so it publishes no ` +
      `gauntlets. Pick a set that has at least one scheme.`,
  );
  process.exit(1);
}
const mastermind = (cards.masterminds ?? []).find(
  (candidate) => candidate.slug === mastermindSlugArgument,
);
if (mastermind === undefined) {
  const available = (cards.masterminds ?? [])
    .map((candidate) => candidate.slug)
    .join(', ');
  console.error(
    `Mastermind "${mastermindSlugArgument}" is not in set "${setAbbrArgument}". ` +
      `Available: ${available}`,
  );
  process.exit(1);
}

console.log(
  renderIdentityBlock(setAbbrArgument, setName, mastermind, schemes),
);
console.log('');
console.log(renderSetupTable());
console.log('');
console.log(renderBudgetTable());
