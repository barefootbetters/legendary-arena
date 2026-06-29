/**
 * apply-defeat-requirement-markers.mjs
 *
 * Sibling overlay to apply-effect-markers.mjs (WP-185 lineage), for WP-292 /
 * D-24076. Reads the curated map inputs/villain-defeat-requirements.json and
 * appends a structured `[require-to-defeat:<kind>:<value>]` marker to the single
 * villain ability line that carries the inline `[<kind>:<value>]` token on each
 * named card. WP-292's engine setup parser (villainDefeatRequirement.setup.ts)
 * reads those markers into G.villainDefeatRequirements, which the fightVillain
 * gate consults to enforce "You can't defeat X unless you have a [class/team]
 * Hero." Without the marker the restriction is cosmetic card text.
 *
 * A defeat requirement is a fight PRECONDITION, distinct from the Fight/Ambush/
 * Escape effect markers apply-effect-markers.mjs authors — so it has its own
 * overlay, its own map, and its own marker namespace. The locator is the
 * card's existing inline `[<kind>:<value>]` token (e.g. `[team:x-men]`,
 * `[hc:covert]`), NOT a timing prefix (these lines carry none).
 *
 * This is offline, deterministic, pure-IO data tooling — upstream of the
 * Registry layer. It adds no engine/registry/server code and modifies no
 * existing converter.
 *
 * Modes:
 *   (default, apply)  — for each curated entry, locate the single ability line
 *                       carrying the inline `[<kind>:<value>]` token and append
 *                       `[require-to-defeat:<kind>:<value>]`. Writes the set
 *                       files back as a surgical text replacement so on-disk
 *                       formatting of unrelated sections is preserved and diffs
 *                       stay clean. Idempotent: a re-run produces a zero-line diff.
 *   --propose         — read-only dry-run. Prints one row per curated entry
 *                       showing the matched line + the marker that would be
 *                       appended, and writes nothing.
 *
 * Loud-fail (non-zero exit, full-sentence message) on:
 *   - a `kind` outside the two locked tokens (`team`, `hc`);
 *   - a named set / villain-group / villain-card that does not exist;
 *   - a card whose abilities carry zero, or more than one, line with the
 *     inline `[<kind>:<value>]` token (cannot disambiguate which line owns it).
 *
 * Usage:
 *   node scripts/convert-cards/apply-defeat-requirement-markers.mjs
 *   node scripts/convert-cards/apply-defeat-requirement-markers.mjs --propose
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const INPUTS_DIR = join(__dirname, 'inputs');
const OUTPUT_DIR = join(__dirname, '..', '..', 'data', 'cards');
const REQUIREMENT_MAP_PATH = join(INPUTS_DIR, 'villain-defeat-requirements.json');

// why: WP-292 / D-24076 — the two locked marker `kind` tokens. The engine
// parser (markerKindToRequirementKind in villainDefeatRequirement.setup.ts)
// maps `team` → 'team' and `hc` → 'hero-class'. Kept hand-synced with the
// engine, never imported from packages/ (the .mjs ops-script discipline);
// drift here loud-fails on an unknown `kind` until manually updated.
const LOCKED_REQUIREMENT_KINDS = ['team', 'hc'];

/**
 * Builds the absolute path to a set's card-data JSON file.
 *
 * @param {string} setAbbr - The set abbreviation (e.g. "core").
 * @returns {string} The absolute path to data/cards/{setAbbr}.json.
 */
function setFilePath(setAbbr) {
  return join(OUTPUT_DIR, `${setAbbr}.json`);
}

/**
 * Reads and parses a set's card-data JSON, loud-failing with a full sentence
 * if the file is missing or not valid JSON.
 *
 * @param {string} setAbbr - The set abbreviation being processed.
 * @returns {object} The parsed set object.
 * @throws If the set file cannot be read or parsed.
 */
function readSetData(setAbbr) {
  const path = setFilePath(setAbbr);
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(
      `villain-defeat-requirements.json names set "${setAbbr}", but its card-data file at ` +
        `${path} could not be read or parsed (${error.message}). Either the set abbreviation in ` +
        `the requirement map is wrong, or the source data is missing/corrupt.`,
    );
  }
}

/**
 * Validates one curated entry's shape + `kind`, loud-failing on anything wrong.
 *
 * @param {object} entry - One requirement-map entry.
 * @throws If a required field is missing/blank or `kind` is not locked.
 */
function validateEntry(entry) {
  for (const field of ['set', 'group', 'card', 'kind', 'value']) {
    if (typeof entry[field] !== 'string' || entry[field].length === 0) {
      throw new Error(
        `villain-defeat-requirements.json has an entry missing the required string field ` +
          `"${field}" (entry: ${JSON.stringify(entry)}). Every entry needs set, group, card, ` +
          `kind, and value.`,
      );
    }
  }
  if (!LOCKED_REQUIREMENT_KINDS.includes(entry.kind)) {
    throw new Error(
      `villain-defeat-requirements.json uses kind "${entry.kind}" on card ` +
        `"${entry.set}/${entry.group}/${entry.card}", but the locked kinds are ` +
        `[${LOCKED_REQUIREMENT_KINDS.map((value) => `"${value}"`).join(', ')}]. Fix the kind in the map.`,
    );
  }
}

/**
 * Finds the villain card named by an entry, loud-failing on a missing group or
 * card so a typo'd entry is caught before any file write.
 *
 * @param {object} setData - The parsed set object (read-only).
 * @param {object} entry - One requirement-map entry.
 * @returns {object} The matched villain card object.
 * @throws If the group or card does not exist in the set data.
 */
function findVillainCard(setData, entry) {
  const villainGroups = Array.isArray(setData.villains) ? setData.villains : [];
  const group = villainGroups.find((candidate) => candidate.slug === entry.group);
  if (!group) {
    throw new Error(
      `villain-defeat-requirements.json names villain group "${entry.group}" in set "${entry.set}", ` +
        `which does not match any villain group in ${entry.set}.json. Fix the group slug in the map.`,
    );
  }
  const cards = Array.isArray(group.cards) ? group.cards : [];
  const card = cards.find((candidate) => candidate.slug === entry.card);
  if (!card) {
    throw new Error(
      `villain-defeat-requirements.json names villain card "${entry.card}" in set "${entry.set}" ` +
        `group "${entry.group}", which does not match any card in that group. Group "${entry.group}" ` +
        `has cards: [${cards.map((candidate) => `"${candidate.slug}"`).join(', ')}]. Fix the card slug.`,
    );
  }
  return card;
}

/**
 * Finds the single ability-line index carrying the inline `[<kind>:<value>]`
 * locator token. Loud-fails on zero (the entry is wrong or the card text lacks
 * the token) or more than one (cannot say which line owns the requirement).
 *
 * @param {string[]} abilities - The card's ability lines.
 * @param {string} locatorToken - The inline token to find (e.g. "[team:x-men]").
 * @param {string} entityLabel - A human label for the failing card.
 * @returns {number} The index of the single matching ability line.
 * @throws If zero or more than one ability line carries the token.
 */
function findSingleLocatorLineIndex(abilities, locatorToken, entityLabel) {
  const matchingIndexes = [];
  for (let index = 0; index < abilities.length; index++) {
    if (typeof abilities[index] === 'string' && abilities[index].includes(locatorToken)) {
      matchingIndexes.push(index);
    }
  }
  if (matchingIndexes.length === 0) {
    throw new Error(
      `villain-defeat-requirements.json maps a requirement onto ${entityLabel}, but that card has ` +
        `no ability line containing the inline locator token "${locatorToken}". Fix the kind/value ` +
        `in the map, or correct the source ability text.`,
    );
  }
  if (matchingIndexes.length > 1) {
    throw new Error(
      `villain-defeat-requirements.json maps a requirement onto ${entityLabel}, but ${matchingIndexes.length} ` +
        `ability lines contain the inline locator token "${locatorToken}" — the overlay cannot say which ` +
        `line owns the requirement. Disambiguate the source text before marking this card.`,
    );
  }
  return matchingIndexes[0];
}

/**
 * Appends the `[require-to-defeat:<kind>:<value>]` marker at the END of an
 * ability line, idempotent: a re-run over already-marked data appends nothing.
 *
 * @param {string} line - The matched ability line.
 * @param {string} marker - The full marker token to append.
 * @returns {string} The line with the marker appended (or unchanged if present).
 */
function appendRequirementMarker(line, marker) {
  // why: presence guard — the marker appears at most once per line, so the
  // second-run git diff is empty (idempotency).
  if (line.includes(marker)) {
    return line;
  }
  return `${line} ${marker}`;
}

/**
 * Collects the surgical edit descriptor for one curated entry (read-only over
 * the set data). Returns null when the marker is already present (idempotent).
 *
 * @param {object} setData - The parsed set object (read-only).
 * @param {object} entry - One validated requirement-map entry.
 * @returns {{ groupSlug: string, cardSlug: string, oldLine: string, newLine: string } | null}
 */
function collectEdit(setData, entry) {
  const card = findVillainCard(setData, entry);
  const abilities = Array.isArray(card.abilities) ? card.abilities : [];
  const locatorToken = `[${entry.kind}:${entry.value}]`;
  const marker = `[require-to-defeat:${entry.kind}:${entry.value}]`;
  const entityLabel = `villain card "${entry.set}/${entry.group}/${entry.card}"`;
  const lineIndex = findSingleLocatorLineIndex(abilities, locatorToken, entityLabel);
  const oldLine = abilities[lineIndex];
  const newLine = appendRequirementMarker(oldLine, marker);
  if (newLine === oldLine) {
    return null;
  }
  return { groupSlug: entry.group, cardSlug: entry.card, oldLine, newLine };
}

/**
 * Applies one edit to the raw set-file text via an anchored, surgical
 * replacement (the same technique as apply-effect-markers.mjs): scope the
 * search to the "villains" section, then the group slug, then the card slug,
 * then the JSON-encoded ability line — so an identical line on another card is
 * never touched and unrelated formatting is preserved.
 *
 * @param {string} text - The raw set-file text.
 * @param {object} edit - { groupSlug, cardSlug, oldLine, newLine }.
 * @returns {string} The updated text.
 * @throws If the section, group/card anchor, or ability line is not found.
 */
function applyEditToText(text, edit) {
  const sectionPosition = text.indexOf('"villains"');
  if (sectionPosition < 0) {
    throw new Error(
      `Could not find the "villains" section in the set-file text while marking group ` +
        `"${edit.groupSlug}". The card-data file shape is not what the overlay expects.`,
    );
  }
  let searchPosition = text.indexOf(`"slug": "${edit.groupSlug}"`, sectionPosition);
  if (searchPosition < 0) {
    throw new Error(
      `Could not anchor villain group "${edit.groupSlug}" in the "villains" section text. The ` +
        `card-data file shape is not what the overlay expects.`,
    );
  }
  searchPosition = text.indexOf(`"slug": "${edit.cardSlug}"`, searchPosition);
  if (searchPosition < 0) {
    throw new Error(
      `Could not anchor villain card "${edit.cardSlug}" after group "${edit.groupSlug}" in the ` +
        `set-file text. The card-data file shape is not what the overlay expects.`,
    );
  }
  const oldJson = JSON.stringify(edit.oldLine);
  const newJson = JSON.stringify(edit.newLine);
  const linePosition = text.indexOf(oldJson, searchPosition);
  if (linePosition < 0) {
    throw new Error(
      `Could not locate ability line ${oldJson} after the anchor for group "${edit.groupSlug}" ` +
        `card "${edit.cardSlug}" in the set-file text. The card-data file shape is not what the ` +
        `overlay expects.`,
    );
  }
  return text.slice(0, linePosition) + newJson + text.slice(linePosition + oldJson.length);
}

/**
 * Reads and validates the curated requirement map.
 *
 * @returns {object[]} The validated entries.
 * @throws If the map is missing, malformed, or any entry is invalid.
 */
function readRequirementMap() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(REQUIREMENT_MAP_PATH, 'utf8'));
  } catch (error) {
    throw new Error(
      `Could not read or parse the requirement map at ${REQUIREMENT_MAP_PATH} (${error.message}).`,
    );
  }
  if (!Array.isArray(parsed.requirements)) {
    throw new Error(
      `villain-defeat-requirements.json must have a "requirements" array. None was found.`,
    );
  }
  for (const entry of parsed.requirements) {
    validateEntry(entry);
  }
  return parsed.requirements;
}

/**
 * Groups validated entries by set abbreviation for one-read-one-write-per-set
 * processing.
 *
 * @param {object[]} entries - The validated requirement entries.
 * @returns {Map<string, object[]>} Entries keyed by set abbreviation.
 */
function groupEntriesBySet(entries) {
  const bySet = new Map();
  for (const entry of entries) {
    const existing = bySet.get(entry.set) ?? [];
    existing.push(entry);
    bySet.set(entry.set, existing);
  }
  return bySet;
}

/**
 * Apply mode (default): reads the curated map, collects each entry's edit
 * (validating against the parsed data), then applies each as a surgical text
 * replacement and writes the file back. One read + one write per set.
 */
function runApply() {
  const entries = readRequirementMap();
  const entriesBySet = groupEntriesBySet(entries);
  const sortedSetAbbrs = [...entriesBySet.keys()].sort();

  console.log('🏷  Overlaying [require-to-defeat:] markers onto curated villain restriction lines...\n');

  let totalMarkers = 0;
  for (const setAbbr of sortedSetAbbrs) {
    const setData = readSetData(setAbbr);
    const edits = [];
    for (const entry of entriesBySet.get(setAbbr)) {
      const edit = collectEdit(setData, entry);
      if (edit !== null) {
        edits.push(edit);
      }
    }

    let text = readFileSync(setFilePath(setAbbr), 'utf8');
    for (const edit of edits) {
      text = applyEditToText(text, edit);
    }
    writeFileSync(setFilePath(setAbbr), text, 'utf8');
    totalMarkers += edits.length;
    console.log(`  ✅ ${setAbbr}.json — ${edits.length} new marker(s) this run`);
  }

  console.log(
    `\nDone. ${sortedSetAbbrs.length} set(s) processed, ${totalMarkers} new [require-to-defeat:] marker(s) appended.`,
  );
}

/**
 * --propose mode: prints one row per curated entry showing the matched line and
 * the marker that would be appended, and writes nothing. Validates the same way
 * apply does, so a bad entry still loud-fails.
 */
function runPropose() {
  const entries = readRequirementMap();
  console.log('set | group | card | marker | matchedLine');
  for (const entry of entries) {
    const setData = readSetData(entry.set);
    const card = findVillainCard(setData, entry);
    const abilities = Array.isArray(card.abilities) ? card.abilities : [];
    const locatorToken = `[${entry.kind}:${entry.value}]`;
    const marker = `[require-to-defeat:${entry.kind}:${entry.value}]`;
    const entityLabel = `villain card "${entry.set}/${entry.group}/${entry.card}"`;
    const lineIndex = findSingleLocatorLineIndex(abilities, locatorToken, entityLabel);
    console.log(
      `${entry.set} | ${entry.group} | ${entry.card} | ${marker} | ${abilities[lineIndex]}`,
    );
  }
  console.error(`\n(${entries.length} entry(ies); --propose is read-only and wrote nothing.)`);
}

/**
 * Entry point: routes to --propose or apply based on argv.
 */
function main() {
  if (process.argv.includes('--propose')) {
    runPropose();
  } else {
    runApply();
  }
}

main();
