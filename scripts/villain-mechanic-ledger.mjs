#!/usr/bin/env node
/**
 * Villain & henchman mechanic ledger generator.
 *
 * The sibling of scripts/hero-mechanic-ledger.mjs, for the villain/henchman
 * half of "mechanic coverage beyond heroes" (WP-271 / EC-303 / D-24048). Emits
 * one row per (villain or henchman card × mechanic) — a card with two effect
 * markers yields two rows — so the corpus reads two ways at a glance: which
 * cards still do nothing in play (the authoring worklist), and, when a card
 * misbehaves, which mechanic owns it and where the code lives (the debugging
 * index). One artifact spans both card types; each row carries a card_type
 * field (villain | henchman) so the two stay distinguishable.
 *
 * Columns per row:
 *   extId      — per-card engine id (villain: the flat-card key
 *                "{setAbbr}-villain-{groupSlug}-{cardSlug}"; henchman:
 *                "henchman-{groupSlug}") — the hook card-instance id minus the
 *                copy index, i.e. the engine's per-card id space
 *   cardName   — display name
 *   set        — set abbreviation
 *   cardType   — villain | henchman
 *   mechanic   — normalized [effect:X] token (or "(unmarked)" — see below)
 *   status     — executable | deferred | unsupported | unmarked
 *   wp         — Work Packet that implemented the mechanic (from provenance map)
 *   decision   — DECISIONS.md id for it (from provenance map)
 *   handler    — where the code is (module#primitive) for executable mechanics
 *
 * Status meanings (the four kinds of state, not just done/not-done):
 *   executable   — the villain ability parser resolved this card's [effect:X]
 *                  marker into a keyword/descriptor (recognition ⇒ executability
 *                  for villains — every recognized effect is executor-handled;
 *                  there is no MVP_KEYWORDS-style subset gate, unlike heroes)
 *   deferred     — carried for symmetry with the hero ledger, but expected EMPTY
 *                  for villains: there is no recognized-but-unexecuted villain
 *                  vocabulary today
 *   unsupported  — the parser saw an [effect:X] marker but produced no executable
 *                  hook for it: either it landed in hook.unresolvedMarkers
 *                  (parse-unrecognized — a runtime hollow), or it sits on a line
 *                  the parser emits no hook for (e.g. a henchman Ambush effect —
 *                  henchman onAmbush hooks are intentionally not emitted in v1,
 *                  D-18507) — in play it does nothing
 *   unmarked     — the card has ability text but no [effect:X] tag (a DATA todo)
 *
 * Sources of truth (no duplicated vocabulary):
 *   - buildVillainAbilityHooks  — the villain ability parser; the ledger reads
 *     its actual resolution (by-hook), never a re-implemented parse
 *   - VILLAIN_EFFECT_KEYWORDS / VILLAIN_EFFECT_PRIMITIVES /
 *     LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR — the effect vocabulary + the
 *     keyword→primitive map (for the handler anchor), imported from the dist
 *   - provenance map — scripts/coverage/mechanic-provenance.json (wp/decision)
 *
 * Modes:
 *   (default)  regenerate docs/ai/coverage/villain-mechanic-ledger.{json,csv}
 *              + print a summary
 *   --check    regenerate in memory and diff against the committed files;
 *              exit 1 if stale
 *
 * Deterministic given the in-repo card data. Run from the repo root after
 * `pnpm -r build` (it imports the engine + registry dist).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRegistryFromLocalFiles } from '../packages/registry/dist/index.js';
// why: D-24048 — the ledger reads the villain ability parser's ACTUAL resolution
// (buildVillainAbilityHooks per the selected groups) and classifies each
// [effect:X] marker by-hook (keywords/effects → resolved; unresolvedMarkers →
// unresolved), never a re-implemented parse (the WP-268 / D-24045 by-hook
// discipline). The vocabulary + the keyword→primitive map are sourced here from
// the engine dist, never duplicated in this script. These are one-way Layer
// Boundary imports of the engine + registry DIST (build/test-time only) — the
// same posture the hero ledger holds: the ledger never imports engine/registry
// source, and no layer on the Registry → Engine → Server chain imports the ledger.
import { buildVillainAbilityHooks } from '../packages/game-engine/dist/setup/villainAbility.setup.js';
import {
  VILLAIN_EFFECT_KEYWORDS,
  VILLAIN_EFFECT_PRIMITIVES,
  LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR,
} from '../packages/game-engine/dist/rules/villainAbility.types.js';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIRECTORY);
const METADATA_DIRECTORY = join(REPO_ROOT, 'data', 'metadata');
const CARDS_DIRECTORY = join(REPO_ROOT, 'data', 'cards');
const PROVENANCE_PATH = join(REPO_ROOT, 'scripts', 'coverage', 'mechanic-provenance.json');
const OUTPUT_DIRECTORY = join(REPO_ROOT, 'docs', 'ai', 'coverage');
const LEDGER_JSON_PATH = join(OUTPUT_DIRECTORY, 'villain-mechanic-ledger.json');
const LEDGER_CSV_PATH = join(OUTPUT_DIRECTORY, 'villain-mechanic-ledger.csv');

const SCHEMA_VERSION = 1;
// why: every executable villain effect is dispatched from this one module
// (VILLAIN_EFFECT_HANDLERS, keyed by the effect PRIMITIVE); the handler column
// points here with the primitive anchor so a broken card is a direct jump to
// the function.
const VILLAIN_HANDLER_MODULE = 'packages/game-engine/src/villain/villainEffects.execute.ts';
const UNMARKED_MECHANIC = '(unmarked)';

// why: the recognized villain effect vocabulary, sourced from the engine dist —
// the keyword name space (legacy [effect:<keyword>] markers) and the primitive
// name space (the parameterized [effect:<primitive>:…] form). A resolved
// mechanic name is a member of one of these; the ledger never hardcodes the
// list (no duplicated source of truth — the hero ledger's discipline).
const KNOWN_EFFECT_KEYWORDS = new Set(VILLAIN_EFFECT_KEYWORDS);
const KNOWN_EFFECT_PRIMITIVES = new Set(VILLAIN_EFFECT_PRIMITIVES);

/** Error type signalling a probe failure (exit code 2). */
class ProbeFailure extends Error {}

/**
 * Normalizes a raw `[effect:X]` token to its mechanic name: the legacy keyword
 * name verbatim (the bare form, no colon), or — for the parameterized
 * `<primitive>:<params>` form — the primitive segment before the first colon.
 * The villain parser (`extractEffects`) matches tokens case-sensitively, so the
 * name is not lowercased (it is exactly the engine's keyword/primitive spelling).
 *
 * @param {string} rawToken - the text between `[effect:` and `]`.
 * @returns {string} the normalized mechanic name (empty string if malformed).
 */
function normalizeEffectToken(rawToken) {
  const segment = rawToken.split(':')[0];
  return segment.trim();
}

/**
 * Returns the raw `[effect:X]` token values across a card's ability lines, in
 * source order (duplicates preserved so per-mechanic classification can inspect
 * every raw token mapping to a mechanic name).
 *
 * @param {string[]} abilities - the card's ability text lines.
 * @returns {string[]} the raw effect-marker token values.
 */
function extractEffectTokens(abilities) {
  const tokens = [];
  for (const ability of abilities) {
    if (typeof ability !== 'string') {
      continue;
    }
    const markupPattern = /\[effect:([^\]]+)\]/g;
    let match;
    while ((match = markupPattern.exec(ability)) !== null) {
      tokens.push(match[1]);
    }
  }
  return tokens;
}

/**
 * Returns true when at least one ability line carries non-empty text. A card
 * with no ability text (a vanilla villain/henchman) contributes no rows, exactly
 * as the hero ledger skips a hero with no ability text.
 *
 * @param {string[]} abilities - the card's ability text lines.
 * @returns {boolean} whether any ability line has non-empty text.
 */
function hasAbilityText(abilities) {
  for (const ability of abilities) {
    if (typeof ability === 'string' && ability.trim() !== '') {
      return true;
    }
  }
  return false;
}

/**
 * One card's by-hook resolution: the recognized effect names the parser resolved
 * (legacy keywords + primitives) and the raw tokens it saw but could not resolve.
 *
 * @typedef {{resolved: Set<string>, unresolved: Set<string>}} CardResolution
 */

/**
 * Strips the copy-index suffix (`-NN`) from a villain/henchman hook's
 * card-instance ext_id, yielding the per-card base id the ledger keys on.
 * The villain instance grammar is `{setAbbr}-villain-{groupSlug}-{cardSlug}-NN`
 * and the henchman grammar is `henchman-{groupSlug}-NN`; both end in the copy
 * index appended by the setup builder.
 *
 * @param {string} cardInstanceId - a hook's card-instance ext_id.
 * @returns {string} the per-card base id (instance id minus the trailing copy index).
 */
function cardBaseIdOf(cardInstanceId) {
  return cardInstanceId.replace(/-\d+$/, '');
}

/**
 * Builds, once, the per-card by-hook resolution index from every villain +
 * henchman ability hook. Aggregates across a card's copies (10 henchman copies,
 * N villain copies all share the same resolution): the resolved set unions each
 * hook's keyword names and effect primitives; the unresolved set unions each
 * hook's raw `unresolvedMarkers` tokens.
 *
 * @param {object} registry - a CardRegistry from createRegistryFromLocalFiles.
 * @param {string[]} villainGroupIds - all set-qualified villain group ids.
 * @param {string[]} henchmanGroupIds - all set-qualified henchman group ids.
 * @returns {Map<string, CardResolution>} card-base id → its resolution.
 */
function buildResolutionIndex(registry, villainGroupIds, henchmanGroupIds) {
  // why: buildVillainAbilityHooks reads only matchConfig.villainGroupIds /
  // henchmanGroupIds; passing every group at once builds the full hook table in
  // one deterministic call (the builder sorts its output). Henchman hooks key by
  // a set-agnostic `henchman-{slug}` id, but isolated-vs-all-at-once resolution
  // is identical for every group (the only two cross-set slug collisions carry
  // no effect markers), so the single call is faithful.
  const hooks = buildVillainAbilityHooks(registry, {
    villainGroupIds,
    henchmanGroupIds,
  });
  const index = new Map();
  for (const hook of hooks) {
    const base = cardBaseIdOf(hook.cardId);
    let resolution = index.get(base);
    if (resolution === undefined) {
      resolution = { resolved: new Set(), unresolved: new Set() };
      index.set(base, resolution);
    }
    for (const keyword of hook.keywords ?? []) {
      resolution.resolved.add(keyword);
    }
    for (const descriptor of hook.effects ?? []) {
      resolution.resolved.add(descriptor.primitive);
    }
    for (const marker of hook.unresolvedMarkers ?? []) {
      resolution.unresolved.add(marker);
    }
  }
  return index;
}

/**
 * Classifies one mechanic on one card, by-hook, faithful to the parser.
 *
 * @param {string} mechanic - the normalized mechanic name.
 * @param {string[]} rawTokensForMechanic - the raw `[effect:X]` tokens on this
 *   card that normalize to this mechanic name.
 * @param {CardResolution|undefined} resolution - the card's by-hook resolution.
 * @returns {'executable'|'unsupported'} the status.
 */
function statusForMechanic(mechanic, rawTokensForMechanic, resolution) {
  // why: D-24048 (mirrors the D-24045 by-hook discipline) — read the parser's
  // ACTUAL resolution, never re-parse the raw token against the vocabulary. A
  // raw token the parser SAW but rejected lands in hook.unresolvedMarkers; check
  // that FIRST so a malformed parameterized marker (e.g. [effect:ko-hero:bogus])
  // is correctly `unsupported`, never falsely `executable` from a naive
  // primitive-segment match against a sibling legacy marker on the same card.
  if (resolution !== undefined) {
    for (const rawToken of rawTokensForMechanic) {
      if (resolution.unresolved.has(rawToken)) {
        return 'unsupported';
      }
    }
    // why: D-24048 — a token the parser resolved into hook.keywords or
    // hook.effects → executable. Recognition implies executability for villains:
    // every recognized effect is executor-handled (there is no MVP_KEYWORDS-style
    // subset gate, unlike the hero ledger). resolution.resolved holds the
    // resolved keyword names AND effect primitives, so a legacy mechanic name
    // (koHeroCurrentPlayer) and a parameterized mechanic name (ko-hero) both match.
    if (resolution.resolved.has(mechanic)) {
      return 'executable';
    }
  }
  // why: the parser produced no executable hook for this marker — it is neither
  // resolved nor in unresolvedMarkers (e.g. a henchman Ambush effect: henchman
  // onAmbush hooks are intentionally not emitted in v1, D-18507). In play it does
  // nothing, so it is `unsupported` (the honest "does nothing" signal), never
  // `executable` from re-checking the raw token against the vocabulary.
  return 'unsupported';
}

/**
 * Returns the handler-column location for a mechanic, or '' for non-executable
 * mechanics. Executable villain mechanics dispatch from the villain executor,
 * keyed by their effect PRIMITIVE: a legacy keyword name resolves to its
 * primitive via the engine's LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR map, and a
 * primitive name is already its own anchor.
 *
 * @param {string} mechanic - the normalized mechanic name.
 * @param {'executable'|'deferred'|'unsupported'|'unmarked'} status - the state.
 * @returns {string} the handler location (module#primitive) or ''.
 */
function handlerForMechanic(mechanic, status) {
  if (status !== 'executable') {
    return '';
  }
  if (KNOWN_EFFECT_PRIMITIVES.has(mechanic)) {
    return `${VILLAIN_HANDLER_MODULE}#${mechanic}`;
  }
  if (KNOWN_EFFECT_KEYWORDS.has(mechanic)) {
    const primitive = LEGACY_VILLAIN_KEYWORD_TO_DESCRIPTOR[mechanic].primitive;
    return `${VILLAIN_HANDLER_MODULE}#${primitive}`;
  }
  return VILLAIN_HANDLER_MODULE;
}

/**
 * Builds one ledger row, joining the provenance map and deriving the handler
 * location for executable mechanics.
 *
 * @param {string} extId - the per-card engine id.
 * @param {string} cardName - the card display name.
 * @param {string} setAbbr - the set abbreviation.
 * @param {'villain'|'henchman'} cardType - the card type for this row.
 * @param {string} mechanic - the mechanic name (or UNMARKED_MECHANIC).
 * @param {'executable'|'deferred'|'unsupported'|'unmarked'} status - the state.
 * @param {Record<string, {wp?: string, decision?: string}>} provenance - the map.
 * @returns {object} the ledger row.
 */
function buildRow(extId, cardName, setAbbr, cardType, mechanic, status, provenance) {
  const entry = provenance[mechanic] ?? {};
  return {
    extId,
    cardName,
    set: setAbbr,
    // why: one artifact spans villain + henchman cards; this field distinguishes
    // them (sourced from how the registry / G.villainDeckCardTypes classifies a
    // card — villain flat-cards vs henchman group data).
    cardType,
    mechanic,
    status,
    wp: entry.wp ?? '',
    decision: entry.decision ?? '',
    handler: handlerForMechanic(mechanic, status),
  };
}

/**
 * Produces the ledger rows for a single card from its raw effect tokens and its
 * by-hook resolution. A card with ability text but no `[effect:X]` token yields
 * a single `unmarked` row; otherwise one row per distinct mechanic name.
 *
 * @param {string} extId - the per-card engine id.
 * @param {string} cardName - the card display name.
 * @param {string} setAbbr - the set abbreviation.
 * @param {'villain'|'henchman'} cardType - the card type.
 * @param {string[]} abilities - the card's ability text lines.
 * @param {CardResolution|undefined} resolution - the card's by-hook resolution.
 * @param {Record<string, object>} provenance - the mechanic provenance map.
 * @returns {object[]} the card's ledger rows.
 */
function buildCardRows(extId, cardName, setAbbr, cardType, abilities, resolution, provenance) {
  const rawTokens = extractEffectTokens(abilities);
  if (rawTokens.length === 0) {
    return [buildRow(extId, cardName, setAbbr, cardType, UNMARKED_MECHANIC, 'unmarked', provenance)];
  }
  const mechanicNames = new Set();
  for (const rawToken of rawTokens) {
    const mechanic = normalizeEffectToken(rawToken);
    if (mechanic !== '') {
      mechanicNames.add(mechanic);
    }
  }
  if (mechanicNames.size === 0) {
    // why: every raw token normalized to an empty name (malformed markup like
    // `[effect:]`); treat the card as unmarked — there is no nameable mechanic.
    return [buildRow(extId, cardName, setAbbr, cardType, UNMARKED_MECHANIC, 'unmarked', provenance)];
  }
  const rows = [];
  for (const mechanic of [...mechanicNames].sort()) {
    const rawTokensForMechanic = rawTokens.filter((token) => normalizeEffectToken(token) === mechanic);
    const status = statusForMechanic(mechanic, rawTokensForMechanic, resolution);
    rows.push(buildRow(extId, cardName, setAbbr, cardType, mechanic, status, provenance));
  }
  return rows;
}

/**
 * Walks the villain + henchman corpus and produces the sorted ledger rows plus
 * a status summary. Villain cards come from `listCards()` (cardType "villain");
 * henchman cards come from each set's `henchmen[]` group data (henchmen have no
 * flat-card cardType — their abilities are group-level).
 *
 * @param {object} registry - a CardRegistry from createRegistryFromLocalFiles.
 * @param {Record<string, object>} provenance - the mechanic provenance map.
 * @returns {{rows: object[], summary: object}} sorted rows + counts.
 */
function buildLedger(registry, provenance) {
  // Enumerate every villain + henchman group id (the matchConfig surface
  // buildVillainAbilityHooks consumes) so the resolution index covers the corpus.
  const villainGroupIds = [];
  const henchmanGroupIds = [];
  const henchmanGroups = [];
  for (const setEntry of registry.listSets()) {
    const setData = registry.getSet(setEntry.abbr);
    if (setData === undefined) {
      continue;
    }
    if (Array.isArray(setData.villains)) {
      for (const group of setData.villains) {
        if (group && typeof group.slug === 'string') {
          villainGroupIds.push(`${setEntry.abbr}/${group.slug}`);
        }
      }
    }
    if (Array.isArray(setData.henchmen)) {
      for (const group of setData.henchmen) {
        if (group && typeof group.slug === 'string') {
          henchmanGroupIds.push(`${setEntry.abbr}/${group.slug}`);
          henchmanGroups.push({
            setAbbr: setEntry.abbr,
            slug: group.slug,
            name: typeof group.name === 'string' ? group.name : group.slug,
            abilities: Array.isArray(group.abilities) ? group.abilities : [],
          });
        }
      }
    }
  }

  const resolutionIndex = buildResolutionIndex(registry, villainGroupIds, henchmanGroupIds);

  const rows = [];
  // Villains: one card per villain flat-card; its base id equals the flat-card key.
  for (const card of registry.listCards()) {
    if (card.cardType !== 'villain') {
      continue;
    }
    if (!hasAbilityText(card.abilities)) {
      continue;
    }
    // why: card.key ("{setAbbr}-villain-{groupSlug}-{cardSlug}") is the per-card
    // engine id — the hook card-instance id minus the copy index — and is unique
    // per villain card. card.extId is the GROUP-level composition id, shared by
    // every card in the group, so it cannot key a per-card row.
    const resolution = resolutionIndex.get(card.key);
    for (const row of buildCardRows(card.key, card.name, card.setAbbr, 'villain', card.abilities, resolution, provenance)) {
      rows.push(row);
    }
  }
  // Henchmen: one card per henchman group (abilities are group-level).
  for (const group of henchmanGroups) {
    if (!hasAbilityText(group.abilities)) {
      continue;
    }
    const baseId = `henchman-${group.slug}`;
    const resolution = resolutionIndex.get(baseId);
    for (const row of buildCardRows(baseId, group.name, group.setAbbr, 'henchman', group.abilities, resolution, provenance)) {
      rows.push(row);
    }
  }

  // why: a stable composite sort key makes the JSON + CSV byte-identical run to
  // run, so the --check freshness gate compares cleanly across machines (the
  // hero ledger's discipline verbatim). Set is first so the two reprints of a
  // cross-set henchman group (which share a set-agnostic extId) stay adjacent
  // and ordered; plain < / > is locale-independent codepoint ordering.
  rows.sort((a, b) => {
    const keyA = `${a.set} ${a.cardName} ${a.extId} ${a.mechanic}`;
    const keyB = `${b.set} ${b.cardName} ${b.extId} ${b.mechanic}`;
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });

  const summary = {
    totalRows: rows.length,
    byStatus: { executable: 0, deferred: 0, unsupported: 0, unmarked: 0 },
    distinctMechanics: 0,
  };
  const distinct = new Set();
  for (const row of rows) {
    summary.byStatus[row.status] += 1;
    if (row.mechanic !== UNMARKED_MECHANIC) {
      distinct.add(row.mechanic);
    }
  }
  summary.distinctMechanics = distinct.size;

  return { rows, summary };
}

/**
 * Escapes one CSV field per RFC 4180 — wraps in double quotes and doubles any
 * embedded quote whenever the value contains a comma, quote, or newline.
 *
 * @param {string} value - the raw field value.
 * @returns {string} the CSV-safe field.
 */
function toCsvField(value) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serializes the ledger rows to CSV with a trailing newline. The header mirrors
 * the hero ledger plus a `card_type` column, because one artifact spans both
 * villain and henchman cards.
 *
 * @param {object[]} rows - the sorted ledger rows.
 * @returns {string} the CSV document.
 */
function serializeCsv(rows) {
  const header = ['ext_id', 'card_name', 'set', 'card_type', 'mechanic', 'status', 'wp', 'decision', 'handler'];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.extId,
        row.cardName,
        row.set,
        row.cardType,
        row.mechanic,
        row.status,
        row.wp,
        row.decision,
        row.handler,
      ]
        .map((field) => toCsvField(String(field)))
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Serializes the ledger to deterministic JSON (fixed key order per row, stable
 * row order from buildLedger) with a trailing newline. `cardType: "villain"`
 * names the ledger family (the artifact spans villain + henchman cards),
 * mirroring the hero ledger's `cardType: "hero"`.
 *
 * @param {object} summary - the status summary.
 * @param {object[]} rows - the sorted ledger rows.
 * @returns {string} the JSON document.
 */
function serializeJson(summary, rows) {
  return `${JSON.stringify({ schemaVersion: SCHEMA_VERSION, cardType: 'villain', summary, rows }, null, 2)}\n`;
}

/**
 * Reads and validates the provenance map. A missing file is a probe failure
 * (the generator cannot fill the wp/decision columns without it).
 *
 * @returns {Record<string, object>} the mechanic → {wp, decision} map.
 */
function readProvenance() {
  let text;
  try {
    text = readFileSync(PROVENANCE_PATH, 'utf8');
  } catch (error) {
    throw new ProbeFailure(
      `Cannot read the mechanic provenance map at ${PROVENANCE_PATH}. It seeds the wp/decision columns. Underlying error: ${error.message}`,
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new ProbeFailure(
      `The mechanic provenance map at ${PROVENANCE_PATH} is not valid JSON. Underlying error: ${error.message}`,
    );
  }
  return parsed.mechanics ?? {};
}

/**
 * Loads the registry and dispatches the requested CLI mode.
 *
 * @returns {Promise<number>} the process exit code.
 */
async function main() {
  const mode = process.argv.slice(2).find((argument) => argument.startsWith('--'));

  const registry = await createRegistryFromLocalFiles({
    metadataDir: METADATA_DIRECTORY,
    cardsDir: CARDS_DIRECTORY,
  });
  const provenance = readProvenance();
  const { rows, summary } = buildLedger(registry, provenance);

  if (rows.length === 0) {
    throw new ProbeFailure(
      'The villain ledger is empty — the registry or built dist did not load. Run "pnpm -r build" and confirm data/cards/ is present.',
    );
  }

  const jsonText = serializeJson(summary, rows);
  const csvText = serializeCsv(rows);

  if (mode === '--check') {
    // why: the committed file may be CRLF in a Windows working tree (git
    // autocrlf) while the generator always writes LF; compare line-ending-
    // normalized so --check tests content, not the platform's newline style.
    const normalizeNewlines = (text) => text.replace(/\r\n/g, '\n');
    const staleFiles = [];
    for (const [path, fresh] of [
      [LEDGER_JSON_PATH, jsonText],
      [LEDGER_CSV_PATH, csvText],
    ]) {
      let committed;
      try {
        committed = readFileSync(path, 'utf8');
      } catch {
        staleFiles.push(`${path} (missing)`);
        continue;
      }
      if (normalizeNewlines(committed) !== normalizeNewlines(fresh)) {
        staleFiles.push(path);
      }
    }
    if (staleFiles.length > 0) {
      console.log(`FAIL: the villain mechanic ledger is stale:\n  ${staleFiles.join('\n  ')}`);
      console.log('Regenerate with "pnpm ledger:villains" and commit the result.');
      return 1;
    }
    console.log(`OK: villain mechanic ledger is current (${summary.totalRows} rows).`);
    return 0;
  }

  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  writeFileSync(LEDGER_JSON_PATH, jsonText, 'utf8');
  writeFileSync(LEDGER_CSV_PATH, csvText, 'utf8');
  console.log(`Villain mechanic ledger written (${summary.totalRows} rows):`);
  console.log(
    `  executable ${summary.byStatus.executable} · deferred ${summary.byStatus.deferred} · ` +
      `unsupported ${summary.byStatus.unsupported} · unmarked ${summary.byStatus.unmarked}`,
  );
  console.log(`  ${summary.distinctMechanics} distinct mechanics`);
  console.log(`  ${LEDGER_JSON_PATH}`);
  console.log(`  ${LEDGER_CSV_PATH}`);
  return 0;
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    if (error instanceof ProbeFailure) {
      console.error(`Probe failure: ${error.message}`);
      process.exitCode = 2;
      return;
    }
    console.error('Probe failure: the villain mechanic ledger generator threw an unexpected error.');
    console.error(error);
    process.exitCode = 2;
  });
