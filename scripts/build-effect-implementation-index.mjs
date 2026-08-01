#!/usr/bin/env node
/**
 * Effect implementation index builder (WP-484 / D-24289).
 *
 * Joins the TWO committed mechanic ledgers
 * (docs/ai/coverage/hero-mechanic-ledger.json +
 * docs/ai/coverage/villain-mechanic-ledger.json) into one published, dual-scope
 * effect-implementation index at data/metadata/effect-implementation-index.json.
 * The index is the data backbone the future /debug/effects viewer reads: for
 * every card x mechanic it surfaces the ledger's status + handler + wp + decision
 * so "did card X's printed effect fire, and which handler ran?" has a single
 * answer surface. It mirrors the WP-269 / D-24046 card-mechanics.json feed
 * pattern but reads both ledgers and carries the ledger tokens VERBATIM.
 *
 * What it does, in order:
 *   1. Read the hero ledger and the villain ledger (the two derivation sources).
 *   2. Normalize every ledger row into a scope-tagged entry (hero row heroName OR
 *      villain row cardName -> name; scope = "hero" | "villain"), passing
 *      status/handler/wp/decision through verbatim.
 *   3. Sort entries by (extId, mechanic); build the per-card cards{} join
 *      (single scope + sorted, de-duplicated mechanics); compute the summary
 *      (counts by scope + status).
 *   4. Validate the assembled index against EffectImplementationIndexSchema (the
 *      same registry schema a future consumer parses with), so the artifact and
 *      the contract can never drift apart.
 *   5. Default mode: write the file. --check mode: regenerate in memory and exit
 *      non-zero if the committed file drifts (the CI freshness gate).
 *
 * Deterministic: identical ledger inputs always yield byte-identical output. No
 * wall-clock reads — see resolveGeneratedAt below. This transform is a pure
 * ledger->artifact re-projection; it fabricates nothing.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// why: the transform self-validates its output against the very schema a future
// consumer parses with (imported from the registry dist), so a published index can
// never diverge from EffectImplementationIndexSchema — producer and contract stay
// locked. This is the ONLY packages/** module the transform imports.
// why: unlike build-card-mechanics-metadata.mjs, this transform reads NO
// engine dist. The two committed ledgers already carry status + handler +
// wp + decision for every row, so this join needs no source classification and
// no engine vocabulary — reading committed JSON is sufficient and keeps the
// engine out of this build step entirely.
import { EffectImplementationIndexSchema } from '../packages/registry/dist/schema.js';

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = dirname(SCRIPT_DIRECTORY);
const HERO_LEDGER_PATH = join(REPO_ROOT, 'docs', 'ai', 'coverage', 'hero-mechanic-ledger.json');
const VILLAIN_LEDGER_PATH = join(REPO_ROOT, 'docs', 'ai', 'coverage', 'villain-mechanic-ledger.json');
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

// why: the byStatus summary emits these five keys in this fixed order, a zero-count
// status included as 0, so the published shape is stable across card-data changes
// (a status appearing or vanishing never adds or drops a summary key). This matches
// the EffectIndexStatus closed union in packages/registry/src/schema.ts.
const STATUS_ORDER = ['executable', 'deferred', 'condition', 'unsupported', 'unmarked'];

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
 * the index pins a dual-scope contract, so a mis-scoped or shapeless ledger must
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
        `The effect index pins a dual-scope join; reconcile the ledger scope before regenerating.`,
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
  return {
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
}

/**
 * Collects normalized entries from both ledgers (one entry per ledger row — a pure
 * verbatim join) and sorts them ascending by (extId, mechanic). Ties on that key
 * (the same henchman reprinted across sets shares extId + mechanic but differs by
 * set) preserve ledger order via the stable sort, so the output stays byte-stable.
 *
 * @param {object} heroLedger - the parsed hero ledger.
 * @param {object} villainLedger - the parsed villain ledger.
 * @returns {object[]} the sorted entry list.
 */
function collectEntries(heroLedger, villainLedger) {
  const entries = [];
  for (const row of heroLedger.rows) {
    entries.push(normalizeRow(row, 'hero', row.heroName));
  }
  for (const row of villainLedger.rows) {
    entries.push(normalizeRow(row, 'villain', row.cardName));
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
 * Throws if one extId ever carries two different scopes (the ledgers use disjoint
 * id-spaces, so this would signal a corrupted source rather than valid data).
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
          `Hero and villain ledgers use disjoint id-spaces; a shared extId signals a corrupted ledger.`,
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
function buildSummary(entries) {
  const byScope = { hero: 0, villain: 0 };
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
 * @returns {object} the validated effect-implementation index.
 */
function buildIndex(heroLedger, villainLedger) {
  const entries = collectEntries(heroLedger, villainLedger);
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
  const index = buildIndex(heroLedger, villainLedger);
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
  console.log(`  scope ${index.scope} · ${index.summary.byScope.hero} hero + ${index.summary.byScope.villain} villain · ${Object.keys(index.cards).length} cards`);
  console.log(`  ${OUTPUT_PATH}`);
  return 0;
}

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
