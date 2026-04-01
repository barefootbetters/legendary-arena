/**
 * load_legendary_data.mjs
 *
 * Minimal loader to upsert Legendary rules and card data into Supabase Postgres.
 *
 * Usage:
 *   1) npm i pg
 *   2) Set DATABASE_URL (Supabase Postgres connection string)
 *   3) node load_legendary_data.mjs --rules ./rules.json --rulesFull ./rules-full.json
 *   4) Later: node load_legendary_data.mjs --cards ./cards.json --setCode coreset
 *
 * Notes:
 *   - This connects directly to Postgres. It does NOT use Supabase Data API.
 *   - Keep JSON as source of truth in GitHub; re-run this loader after updates.
 */

import fs from 'node:fs';
import crypto from 'node:crypto';
import process from 'node:process';
import { Client } from 'pg';

function arg(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL env var (Supabase Postgres connection string).');
  process.exit(1);
}

const rulesPath = arg('--rules');
const rulesFullPath = arg('--rulesFull');
const cardsPath = arg('--cards');
const setCode = arg('--setCode');

const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

await client.connect();

async function upsertSourceFile(sourceName, sourceKind, payloadObj) {
  const payloadText = JSON.stringify(payloadObj);
  const hash = sha256(Buffer.from(payloadText));
  await client.query(
    `insert into legendary.source_files (source_name, source_kind, source_sha256, payload)
     values ($1, $2, $3, $4::jsonb)`,
    [sourceName, sourceKind, hash, payloadText]
  );
}

async function upsertRulesIndex(rules) {
  for (const r of rules) {
    const cardTypes = r.cardTypes ?? [];
    await client.query(
      `insert into legendary.rules (rule_id, code, label, card_types, raw)
       values ($1, $2, $3, $4::int[], $5::jsonb)
       on conflict (rule_id) do update
         set code=excluded.code,
             label=excluded.label,
             card_types=excluded.card_types,
             raw=excluded.raw`,
      [r.id, r.value, r.label, cardTypes, JSON.stringify(r)]
    );
  }
}

async function upsertRuleDocs(rulesFull) {
  for (const r of rulesFull) {
    await client.query(
      `insert into legendary.rule_docs (rule_id, definition, summary, raw)
       values ($1, $2::jsonb, $3, $4::jsonb)
       on conflict (rule_id) do update
         set definition=excluded.definition,
             summary=excluded.summary,
             raw=excluded.raw`,
      [r.id, JSON.stringify(r.definition ?? []), r.summary ?? '', JSON.stringify(r)]
    );
  }
}

// Placeholder card ingestion: expects a JSON array of cards.
// You can adapt this once you settle on a canonical card JSON shape.
async function upsertCards(cards, setCode) {
  if (!setCode) throw new Error('Missing --setCode for cards load');

  // Ensure set exists
  await client.query(
    `insert into legendary.sets (set_code, set_name)
     values ($1, $1)
     on conflict (set_code) do nothing`,
    [setCode]
  );

  const { rows } = await client.query('select set_id from legendary.sets where set_code=$1', [setCode]);
  const setId = rows[0]?.set_id;
  if (!setId) throw new Error('Unable to resolve set_id');

  for (const c of cards) {
    // Required minimal fields
    const extId = c.ext_id ?? c.id ?? c.uuid;
    const name = c.name;
    const cardTypeCode = c.card_type ?? c.type;
    if (!extId || !name || !cardTypeCode) {
      console.warn('Skipping card missing ext_id/name/card_type:', c);
      continue;
    }

    // Ensure card type exists
    await client.query(
      `insert into legendary.card_types (code, label)
       values ($1, $1)
       on conflict (code) do nothing`,
      [cardTypeCode]
    );

    const ct = await client.query('select card_type_id from legendary.card_types where code=$1', [cardTypeCode]);
    const cardTypeId = ct.rows[0]?.card_type_id;

    await client.query(
      `insert into legendary.cards (ext_id, name, set_id, card_type_id, cost, attack, recruit, victory_points, rules_text, raw)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       on conflict (ext_id) do update
         set name=excluded.name,
             set_id=excluded.set_id,
             card_type_id=excluded.card_type_id,
             cost=excluded.cost,
             attack=excluded.attack,
             recruit=excluded.recruit,
             victory_points=excluded.victory_points,
             rules_text=excluded.rules_text,
             raw=excluded.raw`,
      [
        String(extId),
        String(name),
        setId,
        cardTypeId,
        c.cost ?? null,
        c.attack ?? null,
        c.recruit ?? null,
        c.vp ?? c.victory_points ?? null,
        c.rules_text ?? c.text ?? null,
        JSON.stringify(c),
      ]
    );
  }
}

try {
  if (rulesPath) {
    const buf = fs.readFileSync(rulesPath);
    const obj = JSON.parse(buf.toString('utf-8'));
    await upsertSourceFile('rules.json', 'rules_index', obj);
    await upsertRulesIndex(obj);
    console.log(`Loaded rules index: ${obj.length} rules`);
  }

  if (rulesFullPath) {
    const buf = fs.readFileSync(rulesFullPath);
    const obj = JSON.parse(buf.toString('utf-8'));
    await upsertSourceFile('rules-full.json', 'rules_full', obj);
    await upsertRuleDocs(obj);
    console.log(`Loaded rules docs: ${obj.length} rules`);
  }

  if (cardsPath) {
    const buf = fs.readFileSync(cardsPath);
    const obj = JSON.parse(buf.toString('utf-8'));
    await upsertSourceFile(cardsPath.split('/').pop(), 'cards', obj);
    await upsertCards(obj, setCode);
    console.log(`Loaded cards: ${obj.length} cards for set ${setCode}`);
  }

  console.log('Done.');
} finally {
  await client.end();
}
