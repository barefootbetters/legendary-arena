-- =============================================================
-- Legendary Library Schema (PostgreSQL / Supabase)
-- Purpose: Store Legendary Marvel card & rules data for analytics.
-- Workflow:
--   1) Keep JSON files as source of truth (GitHub repo).
--   2) Mirror raw JSON in legendary.source_files for audit/version.
--   3) Normalize queryable fields into relational tables.
-- Notes:
--   - Uses a dedicated schema 'legendary' to avoid exposing tables via Data API.
--   - This schema assumes you connect from a trusted server (e.g., boardgame.io).
-- =============================================================

create schema if not exists legendary;

-- ----------
-- Source files (optional but recommended)
-- ----------
create table if not exists legendary.source_files (
  source_id      bigserial primary key,
  source_name    text not null,                    -- e.g., 'rules.json', 'coreset.json'
  source_kind    text not null,                    -- e.g., 'rules_index', 'rules_full', 'cards'
  source_sha256  text null,                        -- optional: content hash
  ingested_at    timestamptz not null default now(),
  payload        jsonb not null
);

create index if not exists source_files_kind_idx on legendary.source_files(source_kind);
create index if not exists source_files_name_idx on legendary.source_files(source_name);
create index if not exists source_files_payload_gin on legendary.source_files using gin (payload);

-- ----------
-- Lookups
-- ----------
create table if not exists legendary.sets (
  set_id        bigserial primary key,
  set_code      text unique not null,
  set_name      text not null,
  release_date  date null,
  set_type      text null,                         -- core/expansion/deluxe/etc
  raw           jsonb not null default '{}'::jsonb
);

create table if not exists legendary.card_types (
  card_type_id  bigserial primary key,
  code          text unique not null,              -- hero, villain, scheme, mastermind, etc.
  label         text not null,
  raw           jsonb not null default '{}'::jsonb
);

create table if not exists legendary.teams (
  team_id       bigserial primary key,
  code          text unique not null,
  label         text not null,
  raw           jsonb not null default '{}'::jsonb
);

create table if not exists legendary.hero_classes (
  hero_class_id bigserial primary key,
  code          text unique not null,
  label         text not null,
  raw           jsonb not null default '{}'::jsonb
);

create table if not exists legendary.keywords (
  keyword_id    bigserial primary key,
  code          text unique not null,
  label         text not null,
  raw           jsonb not null default '{}'::jsonb
);

create table if not exists legendary.icons (
  icon_id       bigserial primary key,
  code          text unique not null,
  label         text not null,
  raw           jsonb not null default '{}'::jsonb
);

create table if not exists legendary.rarities (
  rarity_id     bigserial primary key,
  code          text unique not null,
  label         text not null,
  raw           jsonb not null default '{}'::jsonb
);

-- ----------
-- Rules: index + full text docs
-- ----------
create table if not exists legendary.rules (
  rule_id      int primary key,                   -- from rules.json / rules-full.json id
  code         text unique not null,              -- from value
  label        text not null,
  card_types   int[] not null default '{}'::int[],
  raw          jsonb not null
);

create table if not exists legendary.rule_docs (
  rule_id      int primary key references legendary.rules(rule_id) on delete cascade,
  definition   jsonb not null,                    -- paragraphs/bullets/headers array
  summary      text not null,
  raw          jsonb not null
);

-- Full-text search for rules
alter table legendary.rule_docs
  add column if not exists search_tsv tsvector
  generated always as (
    to_tsvector('english', coalesce(summary,'') || ' ' || coalesce(definition::text,''))
  ) stored;

create index if not exists rule_docs_search_idx on legendary.rule_docs using gin (search_tsv);

-- ----------
-- Groups / decks
-- ----------
create table if not exists legendary.hero_decks (
  hero_deck_id    bigserial primary key,
  name            text not null,
  set_id          bigint not null references legendary.sets(set_id),
  team_id         bigint null references legendary.teams(team_id),
  hero_class_id   bigint null references legendary.hero_classes(hero_class_id),
  raw             jsonb not null default '{}'::jsonb,
  unique (set_id, name)
);

create table if not exists legendary.villain_groups (
  villain_group_id bigserial primary key,
  name             text not null,
  set_id           bigint not null references legendary.sets(set_id),
  raw              jsonb not null default '{}'::jsonb,
  unique (set_id, name)
);

create table if not exists legendary.henchman_groups (
  henchman_group_id bigserial primary key,
  name              text not null,
  set_id            bigint not null references legendary.sets(set_id),
  raw               jsonb not null default '{}'::jsonb,
  unique (set_id, name)
);

create table if not exists legendary.masterminds (
  mastermind_id    bigserial primary key,
  name             text not null,
  set_id           bigint not null references legendary.sets(set_id),
  raw              jsonb not null default '{}'::jsonb,
  unique (set_id, name)
);

-- ----------
-- Cards (single table)
-- ----------
create table if not exists legendary.cards (
  card_id           bigserial primary key,
  ext_id            text unique not null,          -- stable external id from source
  name              text not null,
  set_id            bigint not null references legendary.sets(set_id),
  card_type_id      bigint not null references legendary.card_types(card_type_id),

  hero_deck_id      bigint null references legendary.hero_decks(hero_deck_id),
  villain_group_id  bigint null references legendary.villain_groups(villain_group_id),
  henchman_group_id bigint null references legendary.henchman_groups(henchman_group_id),
  mastermind_id     bigint null references legendary.masterminds(mastermind_id),

  rarity_id         bigint null references legendary.rarities(rarity_id),

  cost              int null,
  attack            int null,
  recruit           int null,
  victory_points    int null,

  rules_text        text null,
  image_path        text null,

  raw               jsonb not null default '{}'::jsonb
);

create index if not exists cards_set_type_idx on legendary.cards(set_id, card_type_id);
create index if not exists cards_name_trgm_idx on legendary.cards using gin (name gin_trgm_ops);
create index if not exists cards_raw_gin_idx on legendary.cards using gin (raw);

-- Card <-> Keyword (many-to-many)
create table if not exists legendary.card_keywords (
  card_id     bigint not null references legendary.cards(card_id) on delete cascade,
  keyword_id  bigint not null references legendary.keywords(keyword_id),
  value_num   numeric null,
  value_text  text null,
  primary key (card_id, keyword_id)
);

-- Card <-> Icon (many-to-many)
create table if not exists legendary.card_icons (
  card_id     bigint not null references legendary.cards(card_id) on delete cascade,
  icon_id     bigint not null references legendary.icons(icon_id),
  primary key (card_id, icon_id)
);

-- Card <-> Rule references (optional but powerful)
create table if not exists legendary.card_rules (
  card_id     bigint not null references legendary.cards(card_id) on delete cascade,
  rule_id     int not null references legendary.rules(rule_id) on delete restrict,
  primary key (card_id, rule_id)
);

