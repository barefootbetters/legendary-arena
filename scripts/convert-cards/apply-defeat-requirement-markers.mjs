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
 * WP-817 / D-24750 adds a second, optional list, `fightDiscardCosts`: a fight
 * discard COST ("To fight Primus, you must also discard a card that costs 2, 3,
 * 5, or 7"). Each entry appends `[discard-to-fight:cost:<c>[+<c>…]]` to the
 * single ability line that begins with "To fight " (the line has no inline
 * trait token to anchor on). The engine reads it into G.villainFightDiscardCosts.
 *
 * Loud-fail (non-zero exit, full-sentence message) on:
 *   - a `kind` outside the two locked tokens (`team`, `hc`);
 *   - a named set / villain-group / villain-card that does not exist;
 *   - a card whose abilities carry zero, or more than one, line with the
 *     inline `[<kind>:<value>]` token (cannot disambiguate which line owns it);
 *   - a `fightDiscardCosts` entry whose `costs` is not a non-empty, strictly
 *     ascending list of non-negative integers, or whose card carries zero, or
 *     more than one, line beginning with "To fight ".
 *
 * Usage:
 *   node scripts/convert-cards/apply-defeat-requirement-markers.mjs
 *   node scripts/convert-cards/apply-defeat-requirement-markers.mjs --propose
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARD_OUTPUT_DIR } from './card-output-dir.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const INPUTS_DIR = join(__dirname, 'inputs');
// why: read + write the corpus through the shared CARD_OUTPUT_DIR so a
// cards:check regen overlays the scratch-dir copy, never the committed data/cards.
const OUTPUT_DIR = CARD_OUTPUT_DIR;
const REQUIREMENT_MAP_PATH = join(INPUTS_DIR, 'villain-defeat-requirements.json');

// why: WP-292 / D-24076 — the two locked marker `kind` tokens. The engine
// parser (markerKindToRequirementKind in villainDefeatRequirement.setup.ts)
// maps `team` → 'team' and `hc` → 'hero-class'. Kept hand-synced with the
// engine, never imported from packages/ (the .mjs ops-script discipline);
// drift here loud-fails on an unknown `kind` until manually updated.
const LOCKED_REQUIREMENT_KINDS = ['team', 'hc'];

// why: WP-817 / D-24750 — the fight-discard-cost line is located by its printed
// opening ("To fight Primus, …"), compared on the trimmed, lower-cased line. It
// carries no timing prefix and no inline trait token, so this is the only stable
// anchor; a card with zero or several such lines loud-fails.
const FIGHT_DISCARD_LINE_PREFIX = 'to fight ';

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
 * Validates one `fightDiscardCosts` entry, loud-failing on anything wrong.
 *
 * @param {object} entry - One fight-discard-cost map entry.
 * @throws If set / group / card is missing or blank, or `costs` is not a
 *   non-empty, strictly ascending list of non-negative integers.
 */
function validateFightDiscardCostEntry(entry) {
  for (const field of ['set', 'group', 'card']) {
    if (typeof entry[field] !== 'string' || entry[field].length === 0) {
      throw new Error(
        `villain-defeat-requirements.json has a fightDiscardCosts entry missing the required ` +
          `string field "${field}" (entry: ${JSON.stringify(entry)}). Every entry needs set, ` +
          `group, card, and costs.`,
      );
    }
  }
  const costs = entry.costs;
  const label = `"${entry.set}/${entry.group}/${entry.card}"`;
  if (!Array.isArray(costs) || costs.length === 0) {
    throw new Error(
      `villain-defeat-requirements.json gives fightDiscardCosts entry ${label} a "costs" value ` +
        `of ${JSON.stringify(costs)}, but it must be a non-empty array of costs such as [2, 3, 5, 7].`,
    );
  }
  let previousCost = -1;
  for (const cost of costs) {
    if (!Number.isInteger(cost) || cost < 0) {
      throw new Error(
        `villain-defeat-requirements.json gives fightDiscardCosts entry ${label} the cost ` +
          `${JSON.stringify(cost)}, but every cost must be a non-negative integer. Fix the costs list.`,
      );
    }
    if (cost <= previousCost) {
      throw new Error(
        `villain-defeat-requirements.json gives fightDiscardCosts entry ${label} the costs ` +
          `${JSON.stringify(costs)}, but the list must be strictly ascending with no duplicates. ` +
          `Sort the costs and remove repeats.`,
      );
    }
    previousCost = cost;
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
 * Finds the single ability-line index that begins with "To fight " (compared on
 * the trimmed, lower-cased line). Loud-fails on zero or more than one match.
 *
 * @param {string[]} abilities - The card's ability lines.
 * @param {string} entityLabel - A human label for the failing card.
 * @returns {number} The index of the single matching ability line.
 * @throws If zero or more than one ability line begins with "To fight ".
 */
function findSingleFightDiscardLineIndex(abilities, entityLabel) {
  const matchingIndexes = [];
  for (let index = 0; index < abilities.length; index++) {
    const line = abilities[index];
    if (typeof line === 'string' && line.trimStart().toLowerCase().startsWith(FIGHT_DISCARD_LINE_PREFIX)) {
      matchingIndexes.push(index);
    }
  }
  if (matchingIndexes.length === 0) {
    throw new Error(
      `villain-defeat-requirements.json maps a fight discard cost onto ${entityLabel}, but that card ` +
        `has no ability line beginning with "To fight ". Fix the card in the map, or correct the ` +
        `source ability text.`,
    );
  }
  if (matchingIndexes.length > 1) {
    throw new Error(
      `villain-defeat-requirements.json maps a fight discard cost onto ${entityLabel}, but ` +
        `${matchingIndexes.length} ability lines begin with "To fight " — the overlay cannot say which ` +
        `line owns the cost. Disambiguate the source text before marking this card.`,
    );
  }
  return matchingIndexes[0];
}

/**
 * Builds the `[discard-to-fight:cost:<c>[+<c>…]]` marker for a validated entry.
 *
 * @param {object} entry - One validated fight-discard-cost entry.
 * @returns {string} The marker token.
 */
function fightDiscardCostMarker(entry) {
  return `[discard-to-fight:cost:${entry.costs.join('+')}]`;
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
 * Collects the surgical edit descriptor for one fight-discard-cost entry
 * (read-only over the set data). Returns null when the marker is already
 * present (idempotent).
 *
 * @param {object} setData - The parsed set object (read-only).
 * @param {object} entry - One validated fight-discard-cost entry.
 * @returns {{ groupSlug: string, cardSlug: string, oldLine: string, newLine: string } | null}
 */
function collectFightDiscardEdit(setData, entry) {
  const card = findVillainCard(setData, entry);
  const abilities = Array.isArray(card.abilities) ? card.abilities : [];
  const entityLabel = `villain card "${entry.set}/${entry.group}/${entry.card}"`;
  const lineIndex = findSingleFightDiscardLineIndex(abilities, entityLabel);
  const oldLine = abilities[lineIndex];
  const newLine = appendRequirementMarker(oldLine, fightDiscardCostMarker(entry));
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
 * @returns {{ requirements: object[], fightDiscardCosts: object[] }} The validated
 *   defeat-requirement entries and fight-discard-cost entries (absent list = empty).
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
  // why: WP-817 / D-24750 — `fightDiscardCosts` is optional; an absent list is
  // empty, so a map without it behaves exactly as before.
  const fightDiscardCosts = parsed.fightDiscardCosts ?? [];
  if (!Array.isArray(fightDiscardCosts)) {
    throw new Error(
      `villain-defeat-requirements.json has a "fightDiscardCosts" value that is not an array. ` +
        `Make it an array of { set, group, card, costs } entries, or remove it.`,
    );
  }
  for (const entry of fightDiscardCosts) {
    validateFightDiscardCostEntry(entry);
  }
  return { requirements: parsed.requirements, fightDiscardCosts };
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
  const map = readRequirementMap();
  const requirementsBySet = groupEntriesBySet(map.requirements);
  const fightDiscardCostsBySet = groupEntriesBySet(map.fightDiscardCosts);
  const sortedSetAbbrs = [
    ...new Set([...requirementsBySet.keys(), ...fightDiscardCostsBySet.keys()]),
  ].sort();

  console.log('🏷  Overlaying [require-to-defeat:] and [discard-to-fight:] markers onto curated villain restriction lines...\n');

  let totalRequirementMarkers = 0;
  let totalFightDiscardMarkers = 0;
  for (const setAbbr of sortedSetAbbrs) {
    const setData = readSetData(setAbbr);
    const edits = [];
    let fightDiscardEditCount = 0;
    for (const entry of requirementsBySet.get(setAbbr) ?? []) {
      const edit = collectEdit(setData, entry);
      if (edit !== null) {
        edits.push(edit);
      }
    }
    for (const entry of fightDiscardCostsBySet.get(setAbbr) ?? []) {
      const edit = collectFightDiscardEdit(setData, entry);
      if (edit !== null) {
        edits.push(edit);
        fightDiscardEditCount += 1;
      }
    }

    let text = readFileSync(setFilePath(setAbbr), 'utf8');
    for (const edit of edits) {
      text = applyEditToText(text, edit);
    }
    writeFileSync(setFilePath(setAbbr), text, 'utf8');
    totalRequirementMarkers += edits.length - fightDiscardEditCount;
    totalFightDiscardMarkers += fightDiscardEditCount;
    console.log(`  ✅ ${setAbbr}.json — ${edits.length} new marker(s) this run`);
  }

  console.log(
    `\nDone. ${sortedSetAbbrs.length} set(s) processed, ${totalRequirementMarkers} new [require-to-defeat:] marker(s) and ${totalFightDiscardMarkers} new [discard-to-fight:] marker(s) appended.`,
  );
}

/**
 * --propose mode: prints one row per curated entry showing the matched line and
 * the marker that would be appended, and writes nothing. Validates the same way
 * apply does, so a bad entry still loud-fails.
 */
function runPropose() {
  const map = readRequirementMap();
  const entries = map.requirements;
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
  for (const entry of map.fightDiscardCosts) {
    const setData = readSetData(entry.set);
    const card = findVillainCard(setData, entry);
    const abilities = Array.isArray(card.abilities) ? card.abilities : [];
    const entityLabel = `villain card "${entry.set}/${entry.group}/${entry.card}"`;
    const lineIndex = findSingleFightDiscardLineIndex(abilities, entityLabel);
    console.log(
      `${entry.set} | ${entry.group} | ${entry.card} | ${fightDiscardCostMarker(entry)} | ${abilities[lineIndex]}`,
    );
  }
  const entryCount = entries.length + map.fightDiscardCosts.length;
  console.error(`\n(${entryCount} entry(ies); --propose is read-only and wrote nothing.)`);
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
