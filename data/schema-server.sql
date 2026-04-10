-- =============================================================
-- Legendary Arena — Rules-Engine Schema Subset
-- Purpose: DDL for the tables the game server queries at startup.
--          This is NOT the full card schema — see
--          data/legendary_library_schema.sql for the complete schema.
-- Run:     psql $DATABASE_URL -f data/schema-server.sql
-- Safety:  All statements use IF NOT EXISTS — safe to re-run.
-- =============================================================

create schema if not exists legendary;

-- ----------
-- Why this table exists: Audit trail for ingested JSON source files. The rules
-- seed script (data/seed_rules.sql) stores the raw rules JSON here for
-- provenance tracking. Referenced by seed scripts, not by the game server
-- at runtime.
-- ----------
create table if not exists legendary.source_files (
  source_id      bigserial primary key,
  source_name    text not null,
  source_kind    text not null,
  source_sha256  text null,
  ingested_at    timestamptz not null default now(),
  payload        jsonb not null
);

-- Why this index: Seed scripts look up source files by kind to check
-- whether a file has already been ingested.
create index if not exists source_files_kind_idx
  on legendary.source_files (source_kind);

-- ----------
-- Why this table exists: Set lookup used by masterminds, villain groups, and
-- schemes to reference which expansion they belong to. The server uses this
-- at startup to resolve FK relationships in rules data.
-- ----------
create table if not exists legendary.sets (
  set_id        bigserial primary key,
  set_code      text unique not null,
  set_name      text not null,
  release_date  date null,
  set_type      text null,
  raw           jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

-- Why this index: Server looks up sets by set_code when resolving
-- mastermind and villain group relationships at startup.
create index if not exists sets_set_code_idx
  on legendary.sets (set_code);

-- ----------
-- Why this table exists: Stores rules-engine data for masterminds —
-- strike count, victory points, and which villain groups they always lead.
-- Queried at startup to populate match configuration options.
-- ----------
create table if not exists legendary.masterminds (
  mastermind_id    bigserial primary key,
  name             text not null,
  set_id           bigint not null references legendary.sets (set_id) on delete cascade,
  strike_count     int not null default 4,
  victory_points   int not null default 5,
  always_leads     text[] not null default '{}'::text[],
  raw              jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (set_id, name)
);

-- Why this index: Filter masterminds by set when building match config UI.
create index if not exists masterminds_set_id_idx
  on legendary.masterminds (set_id);

-- ----------
-- Why this table exists: Stores rules-engine data for villain groups —
-- which masterminds lead them. Used at startup for match configuration
-- validation (ensuring led_by relationships are correct).
-- ----------
create table if not exists legendary.villain_groups (
  villain_group_id bigserial primary key,
  name             text not null,
  set_id           bigint not null references legendary.sets (set_id) on delete cascade,
  led_by           text[] not null default '{}'::text[],
  raw              jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (set_id, name)
);

-- Why this index: Filter villain groups by set during match setup.
create index if not exists villain_groups_set_id_idx
  on legendary.villain_groups (set_id);

-- ----------
-- Why this table exists: Stores rules-engine data for schemes —
-- twist count and epic twist count determine scheme difficulty.
-- Used at startup for match configuration options.
-- ----------
create table if not exists legendary.schemes (
  scheme_id        bigserial primary key,
  name             text not null,
  set_id           bigint not null references legendary.sets (set_id) on delete cascade,
  twist_count      int not null default 8,
  epic_twist_count int null,
  raw              jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  unique (set_id, name)
);

-- Why this index: Filter schemes by set during match setup.
create index if not exists schemes_set_id_idx
  on legendary.schemes (set_id);

-- ----------
-- Why this table exists: Rules glossary index — loaded at server startup
-- into rulesCache. Each row is a named rule (e.g., "shards", "divided")
-- with the card types it applies to.
-- Columns match data/seed_rules.sql exactly.
-- ----------
create table if not exists legendary.rules (
  rule_id      int primary key,
  code         text unique not null,
  label        text not null,
  card_types   int[] not null default '{}'::int[],
  raw          jsonb not null
);

-- Why this index: The rules loader queries by code for O(1) lookup.
create index if not exists rules_code_idx
  on legendary.rules (code);

-- ----------
-- Why this table exists: Full rule text documents — loaded at server startup
-- into rulesCache alongside rules. Used to resolve [rule:X] markup tokens
-- in ability text. FK to legendary.rules ensures referential integrity.
-- Columns match data/seed_rules.sql exactly.
-- ----------
create table if not exists legendary.rule_docs (
  rule_id      int primary key references legendary.rules (rule_id) on delete cascade,
  definition   jsonb not null,
  summary      text not null,
  raw          jsonb not null
);

-- Why this index: Full-text search on rule documentation for the glossary UI.
alter table legendary.rule_docs
  add column if not exists search_tsv tsvector
  generated always as (
    to_tsvector('english', coalesce(summary, '') || ' ' || coalesce(definition::text, ''))
  ) stored;

create index if not exists rule_docs_search_idx
  on legendary.rule_docs using gin (search_tsv);
