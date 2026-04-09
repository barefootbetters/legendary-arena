-- =============================================================
-- Legendary Arena — Rules-Engine Seed Data
-- Purpose: Seed the rules-engine tables with one complete mastermind
--          example (Galactus from Core Set), demonstrating FK
--          relationships between sets, masterminds, villain_groups,
--          and schemes.
-- Run:     psql $DATABASE_URL -f data/seed-server.sql
-- Note:    For rules/rule_docs seeding, use data/seed_rules.sql.
-- =============================================================

begin;

-- ----------
-- Core Set (the base set that contains Galactus)
-- ----------
insert into legendary.sets (set_code, set_name, release_date, set_type, raw)
values (
  'core',
  'Core Set',
  '2012-11-01',
  '1st Core Set',
  '{"id": 1, "abbr": "core"}'::jsonb
)
on conflict (set_code) do update
  set set_name     = excluded.set_name,
      release_date = excluded.release_date,
      set_type     = excluded.set_type,
      raw          = excluded.raw;

-- ----------
-- Galactus — Devourer of Worlds
-- Strike count: 5 (most masterminds have 4, Galactus has 5)
-- Victory points: 6
-- Always leads: Heralds of Galactus
-- ----------
insert into legendary.masterminds (name, set_id, strike_count, victory_points, always_leads, raw)
values (
  'Galactus',
  (select set_id from legendary.sets where set_code = 'core'),
  5,
  6,
  ARRAY['heralds-of-galactus']::text[],
  '{"slug": "galactus", "alwaysLeads": ["heralds-of-galactus"]}'::jsonb
)
on conflict (set_id, name) do update
  set strike_count   = excluded.strike_count,
      victory_points = excluded.victory_points,
      always_leads   = excluded.always_leads,
      raw            = excluded.raw;

-- ----------
-- Heralds of Galactus — villain group led by Galactus
-- ----------
insert into legendary.villain_groups (name, set_id, led_by, raw)
values (
  'Heralds of Galactus',
  (select set_id from legendary.sets where set_code = 'core'),
  ARRAY['galactus']::text[],
  '{"slug": "heralds-of-galactus", "ledBy": ["galactus"]}'::jsonb
)
on conflict (set_id, name) do update
  set led_by = excluded.led_by,
      raw    = excluded.raw;

-- ----------
-- Brotherhood — another Core Set villain group (demonstrates multiple groups)
-- ----------
insert into legendary.villain_groups (name, set_id, led_by, raw)
values (
  'Brotherhood',
  (select set_id from legendary.sets where set_code = 'core'),
  ARRAY['magneto']::text[],
  '{"slug": "brotherhood", "ledBy": ["magneto"]}'::jsonb
)
on conflict (set_id, name) do update
  set led_by = excluded.led_by,
      raw    = excluded.raw;

-- ----------
-- The Legacy Virus — a Core Set scheme that pairs well with Galactus
-- Twist count: 8 (standard)
-- ----------
insert into legendary.schemes (name, set_id, twist_count, raw)
values (
  'The Legacy Virus',
  (select set_id from legendary.sets where set_code = 'core'),
  8,
  '{"slug": "the-legacy-virus"}'::jsonb
)
on conflict (set_id, name) do update
  set twist_count = excluded.twist_count,
      raw         = excluded.raw;

-- ----------
-- Secret Invasion of the Skrull Shapeshifters — Core Set scheme
-- Twist count: 8
-- ----------
insert into legendary.schemes (name, set_id, twist_count, raw)
values (
  'Secret Invasion of the Skrull Shapeshifters',
  (select set_id from legendary.sets where set_code = 'core'),
  8,
  '{"slug": "secret-invasion-of-the-skrull-shapeshifters"}'::jsonb
)
on conflict (set_id, name) do update
  set twist_count = excluded.twist_count,
      raw         = excluded.raw;

commit;
