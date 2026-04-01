# Prompt 03 — Game Seed Data (R2 → PostgreSQL)

> **FULL CONTENTS MODE** — Output: (1) files changed, (2) full contents of every
> changed file, (3) commands to run with expected output, (4) acceptance checklist.
> Never output diffs. ESM only. Node v22+. Upserts only — never DELETE rows.
> PostgreSQL stores rules data only, never turn state or display data.

## Assumes

- Prompts 01 and 02 complete: schema exists, migration runner is in place
- R2 card JSON is accessible at `https://images.barefootbetters.com/metadata/{abbr}.json`
- `registry-config.json` at the R2 root lists all set abbreviations (40+ sets)
- The R2 JSON structure per set:
  - Heroes have multiple cards per slot (cards array per hero)
  - Masterminds have tactic and epic variant cards
  - Each card has a `slug` field used for cross-referencing

---

## Role

You are writing a one-time (re-runnable) data pipeline that reads card metadata
from Cloudflare R2 and populates PostgreSQL with game-mechanical rules data only.
You understand the difference between display data (names, images, flavor text)
and rules data (strike counts, twist counts, setup constraints) — and you only
write the latter to PostgreSQL.

---

## Project Context

The R2 JSON contains rich card data for display purposes. PostgreSQL only needs
the game-mechanical subset. The seeder must be:

- Safe to re-run (upsert, not insert — R2 data may be updated)
- Selective — extract only fields that matter to the rules engine
- Logged — report what was inserted/updated/skipped per set

**Fields to extract to PostgreSQL:**

| R2 field | PostgreSQL table | Column |
|---|---|---|
| mastermind.slug | masterminds | slug |
| mastermind.strikeCount (or equivalent) | masterminds | strike_count |
| mastermind.alwaysLeads[] | masterminds → villain_groups | (relationship) |
| scheme.slug | schemes | slug |
| scheme.twistCount | schemes | twist_count |
| scheme.epicCount | schemes | epic_count |
| scheme.setupInstructions (rules text) | schemes | setup_notes |
| expansion abbr + name | expansions | abbr, display_name |

**Do not extract:** card names, flavor text, image URLs, artist credits.
Those stay in R2 and are fetched by the SPA at runtime.

---

## Deliverables

### 1. Seeder script (`scripts/seed-from-r2.mjs`)

Write a Node.js ESM script that:

1. Fetches `registry-config.json` from R2 to get set abbreviations
2. For each abbreviation, fetches `https://images.barefootbetters.com/metadata/{abbr}.json`
3. Extracts only the rules-relevant fields listed above
4. Upserts into PostgreSQL using `ON CONFLICT (slug) DO UPDATE`
5. Processes sets sequentially (not parallel) to avoid R2 rate limits
6. Logs progress per set: `[seed] mdns: 2 masterminds, 8 villain groups, 6 schemes`
7. Logs a final summary: total records upserted across all tables

### 2. Null-safety strategy

R2 JSON structure varies across 40+ sets — some fields are missing in older sets.
Show how the seeder handles missing fields gracefully (defaults, skip logic)
without crashing. Define the defaults table:

| Field | Default if missing | Reason |
|---|---|---|
| strikeCount | 4 | Most base masterminds have 4 |
| twistCount | 8 | Safe default for standard scheme |
| epicCount | 0 | Epics are optional |
| alwaysLeads | [] | No required villain groups |

### 3. Migration file (`db/migrations/004_upsert_indexes.sql`)

Add any `UNIQUE` constraints on `slug` columns that `ON CONFLICT (slug)` requires,
if not already present in migration 001. Do not include seed data — that is
fetched from R2 dynamically.

### 4. `package.json` script

```json
{ "seed": "node --env-file=.env scripts/seed-from-r2.mjs" }
```

---

## Operational Notes (answer directly)

1. **Re-seeding**: When a new expansion is added to R2, what is the exact command
   sequence a developer runs to update PostgreSQL?

2. **Slug stability**: The seeder uses `slug` as the upsert key. What breaks if
   a slug changes between R2 uploads, and how should it be handled?

3. **Field mapping gaps**: Document where defaults are defined so they can be
   updated in one place when new set formats introduce new field names.

---

## Hard Constraints

- ESM only
- `pg` and Node.js built-in `fetch` only (no axios, got, node-fetch)
- No local file caching of R2 data — always fetch fresh
- Upserts only — never `DELETE` existing rows during re-seed
- Enforce a per-fetch timeout of 10 seconds
- Script must complete within 60 seconds for 40 sets
