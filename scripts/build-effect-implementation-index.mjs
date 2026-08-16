#!/usr/bin/env node
/**
 * Effect implementation index builder (WP-484 / D-24289; WP-507 / D-24313 tactic feed).
 *
 * Joins the two committed mechanic ledgers
 * (docs/ai/coverage/hero-mechanic-ledger.json +
 * docs/ai/coverage/villain-mechanic-ledger.json) AND a mastermind-tactic feed read
 * from the card data into one published, three-scope effect-implementation index at
 * data/metadata/effect-implementation-index.json. The index is the data backbone the
 * /debug/effects viewer reads: for every card x mechanic it surfaces status + handler
 * + wp + decision so "did card X's printed effect fire, and which handler ran?" has a
 * single answer surface. It mirrors the WP-269 / D-24046 card-mechanics.json feed
 * pattern but reads both ledgers (verbatim) plus the tactic feed.
 *
 * What it does, in order:
 *   1. Read the hero ledger and the villain ledger (the two verbatim derivation sources).
 *   2. Read the mastermind-tactic provenance overlay + enumerate every mastermind
 *      tactic from the card data (WP-507): tactic IDENTITY (extId/name/set/mechanic)
 *      comes from data/cards/*.json, its status/handler/wp/decision from the overlay
 *      or the 'unmarked' default (never fabricated).
 *   3. Normalize every ledger row + tactic into a scope-tagged entry (hero row
 *      heroName OR villain row cardName -> name; scope = "hero" | "villain" |
 *      "mastermind"), passing status/handler/wp/decision through verbatim.
 *   4. Sort entries by (extId, mechanic); build the per-card cards{} join
 *      (single scope + sorted, de-duplicated mechanics); compute the summary
 *      (counts by scope + status).
 *   5. Validate the assembled index against EffectImplementationIndexSchema (the
 *      same registry schema a future consumer parses with), so the artifact and
 *      the contract can never drift apart.
 *   6. Default mode: write the file. --check mode: regenerate in memory and exit
 *      non-zero if the committed file drifts (the CI freshness gate).
 *
 * Deterministic: identical inputs always yield byte-identical output. No wall-clock
 * reads — see resolveGeneratedAt below. This transform is a pure re-projection; it
 * fabricates nothing.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// why: the transform self-validates its output against the very schema a future
// consumer parses with (imported from the registry dist), so a published index can
// never diverge from EffectImplementationIndexSchema — producer and contract stay
// locked. This is the ONLY packages/** module the transform imports.
// why: unlike build-card-mechanics-metadata.mjs, this transform reads NO engine dist.
// The two committed ledgers already carry status + handler + wp + decision for every
// row, and the mastermind-tactic feed (WP-507) reads only the card data + the committed
// tactic-provenance overlay — so this join needs no source classification and no engine
// vocabulary. Reading committed JSON + card data is sufficient and keeps the engine out
// of this build step entirely.
import { EffectImplementationIndexSchema } from '../packages/registry/dist/schema.js';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIRECTORY);
const HERO_LEDGER_PATH = join(REPO_ROOT, 'docs', 'ai', 'coverage', 'hero-mechanic-ledger.json');
const VILLAIN_LEDGER_PATH = join(REPO_ROOT, 'docs', 'ai', 'coverage', 'villain-mechanic-ledger.json');
// why: WP-507 — the mastermind-tactic feed's two inputs: the card-data directory
// (tactic identity) and the committed provenance overlay (curated status/handler/wp/decision).
const CARD_DATA_DIRECTORY = join(REPO_ROOT, 'data', 'cards');
const TACTIC_PROVENANCE_PATH = join(REPO_ROOT, 'scripts', 'coverage', 'tactic-provenance.json');
const OUTPUT_DIRECTORY = join(REPO_ROOT, 'data', 'metadata');
const OUTPUT_PATH = join(OUTPUT_DIRECTORY, 'effect-implementation-index.json');

const INDEX_VERSION = 1;
const INDEX_SCOPE = 'all';
// why: generatedAt MUST be input-derived and byte-stable so the --check freshness
// gate compares cleanly run-to-run. Neither committed ledger exposes a timestamp
// field, so the transform falls back to this fixed sentinel rather than calling
// Date.now()/new Date(). It is NOT a real generation time — it only keeps the
// published contract shape stable. See resolveGeneratedAt for the resolution chain.
const GENERATED_AT_SENTINEL = '1970-01-01T00:00:00.000Z';

// why: the byStatus summary emits these six keys in this fixed order, a zero-count
// status included as 0, so the published shape is stable across card-data changes
// (a status appearing or vanishing never adds or drops a key). This matches
// the EffectIndexStatus closed union in packages/registry/src/schema.ts. `subsystem`
// (WP-548 / D-24357) is the villain ledger's "covered by a non-[effect:X] subsystem"
// status, joined through verbatim like every other status.
const STATUS_ORDER = ['executable', 'deferred', 'condition', 'unsupported', 'unmarked', 'subsystem'];

// why: WP-507 — a tactic with no implemented resolver is honestly 'unmarked' with
// blank handler/wp/decision (the "no handler ran" signal), never a fabricated
// attribution. This is the default overlay for a tactic absent from tactic-provenance.json.
const UNMARKED_TACTIC_STATUS = 'unmarked';

/** Error type signalling a probe/transform failure (exit code 2). */
class TransformFailure extends Error {}

/**
 * Returns true when the value is an ISO-8601 UTC timestamp string the index may
 * carry verbatim (e.g. `2026-06-20T12:00:00.000Z`).
 *
 * @param {unknown} value - a candidate timestamp.
 * @returns {boolean} whether it is a valid ISO-8601 UTC string.
 */
function isIsoUtcTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value);
}

/**
 * Resolves the index's `generatedAt` from the ledgers without any wall-clock read:
 * prefer the hero ledger's `generatedAt`, then the villain ledger's, else the fixed
 * sentinel. Neither committed ledger currently exposes the field, so the sentinel is
 * the live outcome; the chain exists so the index picks up a real timestamp for free
 * if a ledger ever starts emitting one.
 *
 * @param {object} heroLedger - the parsed hero ledger.
 * @param {object} villainLedger - the parsed villain ledger.
 * @returns {string} the resolved ISO-8601 UTC timestamp.
 */
function resolveGeneratedAt(heroLedger, villainLedger) {
  if (isIsoUtcTimestamp(heroLedger.generatedAt)) {
    return heroLedger.generatedAt;
  }
  if (isIsoUtcTimestamp(villainLedger.generatedAt)) {
    return villainLedger.generatedAt;
  }
  return GENERATED_AT_SENTINEL;
}

/**
 * Reads and shape-checks one mechanic ledger. A wrong shape is a transform failure:
 * the index pins a three-scope contract, so a mis-scoped or shapeless ledger must
 * STOP rather than silently publish a mislabeled index.
 *
 * @param {string} ledgerPath - absolute path to the ledger JSON file.
 * @param {string} expectedCardType - the required `cardType` ("hero" | "villain").
 * @returns {object} the parsed ledger (`{ cardType, summary, rows }`).
 */
function readLedger(ledgerPath, expectedCardType) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  } catch (error) {
    throw new TransformFailure(
      `Cannot read the mechanic ledger at ${ledgerPath}. It is a derivation source for the effect index. ` +
        `Run "pnpm ledger:heroes" and "pnpm ledger:villains" first. Underlying error: ${error.message}`,
    );
  }
  if (parsed.cardType !== expectedCardType) {
    throw new TransformFailure(
      `The ledger at ${ledgerPath} has cardType "${parsed.cardType}", expected "${expectedCardType}". ` +
        `The effect index pins a three-scope join; reconcile the ledger scope before regenerating.`,
    );
  }
  if (!Array.isArray(parsed.rows)) {
    throw new TransformFailure(
      `The ledger at ${ledgerPath} has no rows[] array. The ledger shape changed; ` +
        `re-check the ledger generator before regenerating the effect index.`,
    );
  }
  return parsed;
}

/**
 * Reads the mastermind-tactic provenance overlay (WP-507): a curated map of tactic
 * ext_id -> { status, handler, wp, decision } for the tactics whose onFight resolver
 * is implemented. Tactic IDENTITY is enumerated from the card data, so this file
 * carries ONLY status/handler/wp/decision (the WP-493 generated-identity /
 * curated-provenance split); a malformed overlay is a transform failure.
 *
 * @returns {Record<string, object>} the `tactics` map (ext_id -> overlay).
 */
function readTacticProvenance() {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(TACTIC_PROVENANCE_PATH, 'utf8'));
  } catch (error) {
    throw new TransformFailure(
      `Cannot read the tactic provenance overlay at ${TACTIC_PROVENANCE_PATH}. It supplies status/handler/wp/decision ` +
        `for implemented mastermind tactics. Restore the committed file. Underlying error: ${error.message}`,
    );
  }
  if (parsed === null || typeof parsed !== 'object' || typeof parsed.tactics !== 'object' || parsed.tactics === null) {
    throw new TransformFailure(
      `The tactic provenance overlay at ${TACTIC_PROVENANCE_PATH} has no "tactics" object. ` +
        `Expected { schemaVersion, _comment, tactics: { "<ext_id>": { status, handler, wp, decision } } }.`,
    );
  }
  return parsed.tactics;
}

/**
 * Normalizes one mastermind tactic into a mastermind-scoped effect-index entry in the
 * locked property order. Identity (extId/name/set/mechanic) comes from the card data;
 * status/handler/wp/decision come from the provenance overlay VERBATIM, or the
 * 'unmarked'/blank default when the tactic has no implemented resolver.
 *
 * @param {string} extId - the tactic ext_id (`${setAbbr}-mastermind-${slug}-${tacticSlug}`).
 * @param {string} name - the tactic card's display name.
 * @param {string} setAbbr - the file-level set abbreviation.
 * @param {string} tacticSlug - the tactic card's slug (also the entry's `mechanic`).
 * @param {object|undefined} overlay - the provenance overlay for this tactic, if any.
 * @returns {object} the normalized mastermind entry.
 */
export function normalizeTactic(extId, name, setAbbr, tacticSlug, overlay) {
  // why: verbatim honesty (WP-493 / AC-5) — a tactic absent from the provenance overlay
  // is 'unmarked' with blank handler/wp/decision; the transform never synthesizes a
  // handler path, WP, or decision a tactic does not have. "" is a meaningful
  // "no handler ran" signal, never null.
  const hasOverlay = overlay !== null && typeof overlay === 'object';
  const status =
    hasOverlay && typeof overlay.status === 'string' && overlay.status.length > 0
      ? overlay.status
      : UNMARKED_TACTIC_STATUS;
  const handler = hasOverlay && typeof overlay.handler === 'string' ? overlay.handler : '';
  const wp = hasOverlay && typeof overlay.wp === 'string' ? overlay.wp : '';
  const decision = hasOverlay && typeof overlay.decision === 'string' ? overlay.decision : '';
  // why: mechanic = the tactic SLUG — each tactic is its own card × mechanic row (a
  // mastermind contributes one row per tactic), matching how the grid reads elsewhere.
  return {
    extId,
    name,
    set: setAbbr,
    scope: 'mastermind',
    mechanic: tacticSlug,
    status,
    handler,
    wp,
    decision,
  };
}

/**
 * Enumerates every mastermind tactic across all card-data sets into mastermind-scoped
 * entries (WP-507). Stays engine-free: reads data/cards/*.json (tactic identity) + the
 * committed provenance overlay only. Files are read in a sorted order for a stable
 * intermediate (the terminal (extId, mechanic) sort normalizes final order anyway). A
 * missing/malformed card file, or a masterminds-bearing set with no file-level `abbr`,
 * is a transform failure — the ext_id grammar depends on both.
 *
 * @param {Record<string, object>} provenance - the tactic provenance overlay map.
 * @returns {object[]} the mastermind-scoped tactic entries (unsorted).
 */
export function readMastermindTactics(provenance) {
  let fileNames;
  try {
    fileNames = readdirSync(CARD_DATA_DIRECTORY)
      .filter((name) => name.endsWith('.json'))
      .sort();
  } catch (error) {
    throw new TransformFailure(
      `Cannot read the card-data directory at ${CARD_DATA_DIRECTORY}. It supplies mastermind-tactic identity ` +
        `for the effect index. Underlying error: ${error.message}`,
    );
  }

  const entries = [];
  for (const fileName of fileNames) {
    const filePath = join(CARD_DATA_DIRECTORY, fileName);
    let setData;
    try {
      setData = JSON.parse(readFileSync(filePath, 'utf8'));
    } catch (error) {
      throw new TransformFailure(
        `Cannot read or parse the card-data set at ${filePath}. Re-check the card data before regenerating ` +
          `the effect index. Underlying error: ${error.message}`,
      );
    }

    // why: a set with no masterminds contributes no tactics — skip it, not a failure.
    if (!Array.isArray(setData.masterminds) || setData.masterminds.length === 0) {
      continue;
    }
    const setAbbr = setData.abbr;
    if (typeof setAbbr !== 'string' || setAbbr.length === 0) {
      throw new TransformFailure(
        `The card-data set at ${filePath} carries masterminds but no file-level "abbr" string. ` +
          `The tactic ext_id grammar "\${setAbbr}-mastermind-\${slug}-\${tacticSlug}" needs it; add the "abbr" field.`,
      );
    }

    for (const mastermind of setData.masterminds) {
      const mastermindSlug = mastermind.slug;
      if (typeof mastermindSlug !== 'string' || mastermindSlug.length === 0) {
        continue;
      }
      if (!Array.isArray(mastermind.cards)) {
        continue;
      }
      for (const card of mastermind.cards) {
        // why: only tactic cards (tactic === true) carry a Fight ability; the base
        // mastermind card is skipped.
        if (card.tactic !== true) {
          continue;
        }
        const tacticSlug = card.slug;
        const tacticName = card.name;
        if (
          typeof tacticSlug !== 'string' ||
          tacticSlug.length === 0 ||
          typeof tacticName !== 'string' ||
          tacticName.length === 0
        ) {
          throw new TransformFailure(
            `A tactic card under mastermind "${mastermindSlug}" in ${filePath} is missing its slug or name. ` +
              `Every tactic card needs both to build its ext_id and index row.`,
          );
        }
        const extId = `${setAbbr}-mastermind-${mastermindSlug}-${tacticSlug}`;
        entries.push(normalizeTactic(extId, tacticName, setAbbr, tacticSlug, provenance[extId]));
      }
    }
  }
  return entries;
}

/**
 * Normalizes one ledger row into a scope-tagged effect-index entry in the locked
 * property order. The name is read from the scope's ledger field (hero rows carry
 * `heroName`, villain rows carry `cardName`) — the only cross-ledger field-name
 * divergence. status/handler/wp/decision are passed through VERBATIM.
 *
 * @param {object} row - a ledger row.
 * @param {'hero'|'villain'} scope - the scope this ledger supplies.
 * @param {string} name - the resolved card name (`heroName` or `cardName`).
 * @returns {object} the normalized entry.
 */
function normalizeRow(row, scope, name) {
  if (typeof name !== 'string' || name.length === 0) {
    throw new TransformFailure(
      `A ${scope} ledger row for extId "${row.extId}" is missing its card name. ` +
        `Every row must carry ${scope === 'hero' ? 'heroName' : 'cardName'}; re-check the ledger generator.`,
    );
  }
  for (const field of ['extId', 'set', 'mechanic', 'status']) {
    if (typeof row[field] !== 'string' || row[field].length === 0) {
      throw new TransformFailure(
        `A ${scope} ledger row is missing the required field "${field}" (extId "${row.extId}"). ` +
          `Re-check the ledger generator before regenerating the effect index.`,
      );
    }
  }
  for (const field of ['handler', 'wp', 'decision']) {
    if (typeof row[field] !== 'string') {
      throw new TransformFailure(
        `A ${scope} ledger row's "${field}" is not a string (extId "${row.extId}"). ` +
          `handler/wp/decision must be strings ("" when blank); re-check the ledger generator.`,
      );
    }
  }
  // why: handler/wp/decision are passed through VERBATIM — the exact ledger value,
  // or "" where the ledger row is blank (an unsupported/unmarked row where no
  // handler ran). Both ledgers already derive handler = <file>#<primitive> + wp +
  // decision for resolved rows; this transform never synthesizes, infers, or
  // fabricates a handler path or decision id the ledger does not carry (the
  // load-bearing honesty rule, AC-5). "" is a meaningful "no handler ran" signal,
  // never null.
  const entry = {
    extId: row.extId,
    name,
    set: row.set,
    scope,
    mechanic: row.mechanic,
    status: row.status,
    handler: row.handler,
    wp: row.wp,
    decision: row.decision,
  };
  // why: WP-491 / D-24297 — carry the hero ledger's per-mechanic `designs` (which of
  // the hero's card designs print this mechanic) through VERBATIM. Only the hero ledger
  // carries `designs`, and only marked rows have a non-empty list — an `(unmarked)` row
  // carries `[]`, so the key is OMITTED there (the schema is `.min(1).optional()`).
  // Villain rows have no `designs` field at all, so villain entries never carry it.
  if (scope === 'hero' && Array.isArray(row.designs) && row.designs.length > 0) {
    entry.designs = row.designs;
  }
  return entry;
}

/**
 * Collects normalized entries from both ledgers plus the mastermind-tactic feed (one
 * entry per ledger row / tactic — a pure verbatim join) and sorts them ascending by
 * (extId, mechanic). Ties on that key (the same henchman reprinted across sets shares
 * extId + mechanic but differs by set) preserve input order via the stable sort, so
 * the output stays byte-stable.
 *
 * @param {object} heroLedger - the parsed hero ledger.
 * @param {object} villainLedger - the parsed villain ledger.
 * @param {object[]} tacticEntries - the mastermind-scoped tactic entries.
 * @returns {object[]} the sorted entry list.
 */
function collectEntries(heroLedger, villainLedger, tacticEntries) {
  const entries = [];
  for (const row of heroLedger.rows) {
    entries.push(normalizeRow(row, 'hero', row.heroName));
  }
  for (const row of villainLedger.rows) {
    entries.push(normalizeRow(row, 'villain', row.cardName));
  }
  for (const tacticEntry of tacticEntries) {
    entries.push(tacticEntry);
  }
  entries.sort((left, right) => {
    if (left.extId !== right.extId) {
      return left.extId < right.extId ? -1 : 1;
    }
    if (left.mechanic !== right.mechanic) {
      return left.mechanic < right.mechanic ? -1 : 1;
    }
    return 0;
  });
  return entries;
}

/**
 * Builds the per-card cards{} join from the entries: keys sorted ascending, each
 * card carrying its single scope and a sorted, de-duplicated mechanics[] list.
 * Throws if one extId ever carries two different scopes (the hero, villain, and
 * mastermind-tactic feeds use disjoint id-spaces, so this would signal a corrupted
 * source rather than valid data).
 *
 * @param {object[]} entries - the sorted entry list.
 * @returns {object} the cards{} join object with sorted keys.
 */
function buildCards(entries) {
  const scopeByCard = new Map();
  const mechanicsByCard = new Map();
  for (const entry of entries) {
    const existingScope = scopeByCard.get(entry.extId);
    if (existingScope !== undefined && existingScope !== entry.scope) {
      throw new TransformFailure(
        `Card "${entry.extId}" appears with both scope "${existingScope}" and "${entry.scope}". ` +
          `The hero, villain, and mastermind-tactic feeds use disjoint id-spaces; a shared extId signals a corrupted source.`,
      );
    }
    scopeByCard.set(entry.extId, entry.scope);
    if (!mechanicsByCard.has(entry.extId)) {
      mechanicsByCard.set(entry.extId, new Set());
    }
    mechanicsByCard.get(entry.extId).add(entry.mechanic);
  }

  const cards = {};
  for (const extId of [...scopeByCard.keys()].sort()) {
    cards[extId] = {
      scope: scopeByCard.get(extId),
      mechanics: [...mechanicsByCard.get(extId)].sort(),
    };
  }
  return cards;
}

/**
 * Computes the summary (total + counts by scope + counts by status) over the final
 * entries. byStatus emits all five status keys in the fixed STATUS_ORDER.
 *
 * @param {object[]} entries - the sorted entry list.
 * @returns {object} the summary object in locked property order.
 */
export function buildSummary(entries) {
  // why: WP-507 — byScope seeds all three scopes at 0 (a zero-count scope stays 0
  // in the published shape); the mastermind seed matches the schema's byScope object
  // and its superRefine tally, so a scope with no entries never drops the key.
  const byScope = { hero: 0, villain: 0, mastermind: 0 };
  const byStatus = {};
  for (const statusName of STATUS_ORDER) {
    byStatus[statusName] = 0;
  }
  for (const entry of entries) {
    byScope[entry.scope] += 1;
    byStatus[entry.status] += 1;
  }
  return {
    totalEntries: entries.length,
    byScope,
    byStatus,
  };
}

/**
 * Assembles the published index in the locked property/array order and validates it
 * against EffectImplementationIndexSchema before returning. A validation failure is
 * a transform failure — the transform must not publish an invalid index.
 *
 * @param {object} heroLedger - the parsed hero ledger.
 * @param {object} villainLedger - the parsed villain ledger.
 * @param {object[]} tacticEntries - the mastermind-scoped tactic entries.
 * @returns {object} the validated effect-implementation index.
 */
function buildIndex(heroLedger, villainLedger, tacticEntries) {
  const entries = collectEntries(heroLedger, villainLedger, tacticEntries);
  const cards = buildCards(entries);
  const summary = buildSummary(entries);

  const index = {
    version: INDEX_VERSION,
    scope: INDEX_SCOPE,
    generatedAt: resolveGeneratedAt(heroLedger, villainLedger),
    summary,
    entries,
    cards,
  };

  const validation = EffectImplementationIndexSchema.safeParse(index);
  if (!validation.success) {
    const firstIssue = validation.error.issues[0];
    throw new TransformFailure(
      `The generated effect-implementation index failed EffectImplementationIndexSchema validation: ` +
        `${firstIssue.path.join('.')} — ${firstIssue.message}. The transform must not publish an invalid index.`,
    );
  }
  return index;
}

/**
 * Serializes the index to deterministic pretty JSON (locked property order from
 * buildIndex, two-space indent) with a trailing newline.
 *
 * @param {object} index - the validated effect-implementation index.
 * @returns {string} the JSON document.
 */
function serializeJson(index) {
  return `${JSON.stringify(index, null, 2)}\n`;
}

/**
 * Builds the index and dispatches the requested CLI mode.
 *
 * @returns {number} the process exit code.
 */
function main() {
  const mode = process.argv.slice(2).find((argument) => argument.startsWith('--'));

  const heroLedger = readLedger(HERO_LEDGER_PATH, 'hero');
  const villainLedger = readLedger(VILLAIN_LEDGER_PATH, 'villain');
  const tacticProvenance = readTacticProvenance();
  const tacticEntries = readMastermindTactics(tacticProvenance);
  const index = buildIndex(heroLedger, villainLedger, tacticEntries);
  const freshText = serializeJson(index);

  if (mode === '--check') {
    // why: the committed file may be CRLF in a Windows working tree (git autocrlf)
    // while the generator always writes LF; compare line-ending-normalized so
    // --check tests content, not the platform's newline style (mirrors ledger:heroes:check).
    const normalizeNewlines = (text) => text.replace(/\r\n/g, '\n');
    let committed;
    try {
      committed = readFileSync(OUTPUT_PATH, 'utf8');
    } catch {
      console.log(`FAIL: the effect-implementation index is missing at ${OUTPUT_PATH}.`);
      console.log('Regenerate with "pnpm effect-index" and commit the result.');
      return 1;
    }
    if (normalizeNewlines(committed) !== normalizeNewlines(freshText)) {
      console.log(`FAIL: the effect-implementation index at ${OUTPUT_PATH} is stale.`);
      console.log('Regenerate with "pnpm effect-index" and commit the result.');
      return 1;
    }
    console.log(`OK: effect-implementation index is current (${index.entries.length} entries).`);
    return 0;
  }

  mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  writeFileSync(OUTPUT_PATH, freshText, 'utf8');
  console.log(`Effect-implementation index written (${index.entries.length} entries):`);
  console.log(
    `  scope ${index.scope} · ${index.summary.byScope.hero} hero + ${index.summary.byScope.villain} villain + ` +
      `${index.summary.byScope.mastermind} mastermind · ${Object.keys(index.cards).length} cards`,
  );
  console.log(`  ${OUTPUT_PATH}`);
  return 0;
}

/**
 * Whether this module was invoked directly as a CLI (vs imported by the test).
 * Guarding the CLI behind a direct-run check keeps importing the pure helpers
 * side-effect free (mirrors roadmap-counts.mjs `isRunDirectly`).
 *
 * @returns {boolean} true when run as `node scripts/build-effect-implementation-index.mjs`.
 */
function isRunDirectly() {
  const invokedPath = process.argv[1];
  if (invokedPath === undefined) {
    return false;
  }
  return resolve(invokedPath) === fileURLToPath(import.meta.url);
}

if (isRunDirectly()) {
  try {
    process.exitCode = main();
  } catch (error) {
    if (error instanceof TransformFailure) {
      console.error(`Transform failure: ${error.message}`);
      process.exitCode = 2;
    } else {
      console.error('Transform failure: the effect-implementation index builder threw an unexpected error.');
      console.error(error);
      process.exitCode = 2;
    }
  }
}
