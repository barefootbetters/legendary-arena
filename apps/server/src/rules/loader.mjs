/**
 * Rules Cache Loader — Server Layer
 *
 * Loads rules glossary data from PostgreSQL at server startup and caches
 * it in memory. The game engine reads rules via getRules() at runtime
 * without hitting the database.
 *
 * This module belongs to the server layer only. Game engine code must
 * never import it directly.
 */

import pg from 'pg';

const { Pool } = pg;

/**
 * In-memory rules cache populated once at startup by loadRules().
 *
 * Shape after loadRules() resolves:
 * ```
 * {
 *   rules: {
 *     [code]: { ruleId, code, label, cardTypes, raw }
 *     // keyed by code (e.g., 'shards', 'traps') for O(1) lookup by the game engine
 *   },
 *   ruleDocs: {
 *     [ruleId]: { ruleId, definition, summary, raw }
 *     // keyed by ruleId for O(1) lookup when resolving [rule:X] markup tokens
 *   }
 * }
 * ```
 *
 * @type {{ rules: Record<string, object>, ruleDocs: Record<number, object> } | null}
 */
let rulesCache = null;

/**
 * Queries all rows from legendary.rules and returns them as an array.
 *
 * @param {import('pg').Pool} pool - The database connection pool.
 * @returns {Promise<Array<object>>} All rules rows.
 */
async function fetchRulesIndex(pool) {
  const result = await pool.query(
    'SELECT rule_id, code, label, card_types, raw FROM legendary.rules'
  );
  return result.rows;
}

/**
 * Queries all rows from legendary.rule_docs and returns them as an array.
 *
 * @param {import('pg').Pool} pool - The database connection pool.
 * @returns {Promise<Array<object>>} All rule_docs rows.
 */
async function fetchRuleDocs(pool) {
  const result = await pool.query(
    'SELECT rule_id, definition, summary, raw FROM legendary.rule_docs'
  );
  return result.rows;
}

/**
 * Assembles the rules index rows into a map keyed by code.
 *
 * @param {Array<object>} rulesRows - Rows from legendary.rules.
 * @returns {Record<string, object>} Rules keyed by code.
 */
function buildRulesMap(rulesRows) {
  const rulesMap = {};
  for (const row of rulesRows) {
    rulesMap[row.code] = {
      ruleId: row.rule_id,
      code: row.code,
      label: row.label,
      cardTypes: row.card_types,
      raw: row.raw,
    };
  }
  return rulesMap;
}

/**
 * Assembles the rule_docs rows into a map keyed by ruleId.
 *
 * @param {Array<object>} ruleDocsRows - Rows from legendary.rule_docs.
 * @returns {Record<number, object>} Rule docs keyed by ruleId.
 */
function buildRuleDocsMap(ruleDocsRows) {
  const ruleDocsMap = {};
  for (const ruleDoc of ruleDocsRows) {
    ruleDocsMap[ruleDoc.rule_id] = {
      ruleId: ruleDoc.rule_id,
      definition: ruleDoc.definition,
      summary: ruleDoc.summary,
      raw: ruleDoc.raw,
    };
  }
  return ruleDocsMap;
}

/**
 * Loads all rules and rule documentation from PostgreSQL into the in-memory
 * cache. Must be called once at server startup before any game sessions begin.
 *
 * On failure, logs a full-sentence error and exits the process. The server
 * must not start with an empty rules cache.
 *
 * @returns {Promise<void>}
 */
export async function loadRules() {
  // why: Pool config is inline per code style Rule 2 — no factory function
  // for one-time setup.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // why: max=5 is sufficient because the rules loader runs exactly once at
    // startup. Ongoing game sessions do not query the database.
    max: 5,
    idleTimeoutMillis: 30000,
  });

  try {
    const [rulesRows, ruleDocsRows] = await Promise.all([
      fetchRulesIndex(pool),
      fetchRuleDocs(pool),
    ]);

    rulesCache = {
      rules: buildRulesMap(rulesRows),
      ruleDocs: buildRuleDocsMap(ruleDocsRows),
    };

    const rulesCount = Object.keys(rulesCache.rules).length;
    const docsCount = Object.keys(rulesCache.ruleDocs).length;
    console.log(`[server] rules loaded: ${rulesCount} rules, ${docsCount} rule docs`);
  } catch (error) {
    console.error(
      `[server] Failed to load rules from PostgreSQL. ` +
      `Check that DATABASE_URL is set and the legendary.rules table exists. ` +
      `Error: ${error.message}`
    );
    process.exit(1);
  } finally {
    await pool.end();
  }
}

/**
 * Returns the cached rules object. Must be called after loadRules() has
 * resolved successfully.
 *
 * @returns {{ rules: Record<string, object>, ruleDocs: Record<number, object> }}
 *   The rules cache with two maps:
 *   - `rules` — keyed by code (e.g., 'shards') for O(1) lookup
 *   - `ruleDocs` — keyed by ruleId for resolving [rule:X] markup tokens
 * @throws {Error} If called before loadRules() has completed.
 */
export function getRules() {
  if (rulesCache === null) {
    throw new Error(
      'getRules() was called before loadRules() completed. ' +
      'Ensure loadRules() is awaited during server startup before accepting requests.'
    );
  }
  return rulesCache;
}
