# PostgreSQL Deployment Verification Checklist (§B)

**Purpose:** Verify that the PostgreSQL database for a target
environment (`dev`, `test`, `staging`, or `prod`) is provisioned,
migrated, and structurally sound before promotion onto the release
path. Each item below is **binary pass/fail**. A single fail blocks
promotion until the underlying defect is repaired.

This checklist is the canonical schema-structure verification
procedure referenced by
[`docs/ops/RELEASE_CHECKLIST.md`](../../ops/RELEASE_CHECKLIST.md)
§Relationship to runtime invariant checks.

---

## Deferred sections — per D-4201

This checklist ships **scope-reduced from eight sections to four**
per D-4201 (WP-042 pre-flight, 2026-04-19). The four surviving
sections are:

- **§B.1** — Pre-conditions
- **§B.2** — Migration execution
- **§B.6** — Rules data seeding verification
- **§B.7** — Schema-structure verification

The four **deferred** sections are:

- **§B.3** — Lookup table seeding verification
- **§B.4** — Group and entity seeding verification
- **§B.5** — Card record seeding verification
- **§B.8** — Re-seeding procedure

All four deferred sections depend on data-seeding infrastructure
that has never existed in the repo: the seed runner that would read
registry JSON from R2 and populate `legendary.*` lookup, group, and
card tables was specified by Foundation Prompt 03 but that prompt
was never executed. Lookup-table row-count verification
(`legendary.sets == 40`, `legendary.card_types == 37`, and similar)
is deferred alongside, because a checklist that asserts row counts
without a runnable seed step would always fail in every environment
that has not been hand-populated.

The deferred sections will be produced by a future work packet —
provisionally **WP-042.1** — that first revives Foundation Prompt
03 (creates the seed runner, adds the corresponding npm script to
`package.json`, authors any additional `legendary.*` lookup-table
migrations the seed runner requires) and then ships the companion
seeding-verification sections. This checklist does **not** reference
the deferred infrastructure by name anywhere in the verification
steps below — doing so would make the checklist self-contradictory
(the verification would reference paths that do not exist).

See [D-4201](../DECISIONS.md#d-4201--wp-042-scope-reduction-postgresql-seeding-sections-deferred-until-foundation-prompt-03-is-revived)
for the full scope-reduction rationale and the archaeology that
confirmed the deferred infrastructure has never existed.

---

## Scope

**In scope:**
- PostgreSQL instance reachability and identity.
- Execution of the three migration SQL files currently shipped in
  `data/migrations/` via `pnpm migrate`.
- Verification of the rules glossary data seeded by migration
  `002_seed_rules.sql` (this is the one data-seeding path that is
  shipped and therefore verifiable today).
- Structural verification of the `legendary.*` schema and the
  `public.game_sessions` table created by the three migrations:
  tables exist, columns exist with the expected types, foreign-key
  constraints exist, and indexes exist.

**Explicitly out of scope:**
- The four deferred sections listed above.
- Row-count verification for any table that is populated by the
  deferred seeding infrastructure.
- Render.com-specific provisioning runbooks — this checklist
  documents what must be true of the database, not how to change
  Render settings.
- UI rendering surfaces — per D-4202, UI-layer concerns belong in a
  separate checklist.

---

## §B.1 — Pre-conditions

Before running migrations or schema verification, every item below
must be true of the target environment.

**Runtime:**

- [ ] Node v22 or newer is the active runtime. Confirm with:

      ```pwsh
      node --version
      ```

      An earlier major version will fail the `node --env-file=.env`
      invocation that `pnpm migrate` depends on and will reject the
      monorepo's ESM-only module discipline.

- [ ] The `pg` package resolves in the `apps/server` workspace. The
      migration runner resolves `pg` via `createRequire` pointed at
      `apps/server/package.json`; a missing dependency fails the
      runner's first `createDatabasePool()` call with a clear
      error.

**Connection string:**

- [ ] `DATABASE_URL` is set and points at the target environment's
      PostgreSQL instance. Confirm the value is **not** the value
      from a different environment — a common misconfiguration is
      promoting a release that accidentally still carries the
      staging connection string forward into prod.

- [ ] An operator-level "expected database name" check is performed:
      the connection string's database component matches the
      documented name for the target environment. Confirm by eye or
      by the parse snippet below:

      ```pwsh
      $uri = [System.Uri]$env:DATABASE_URL
      $uri.AbsolutePath.TrimStart('/')
      ```

      The printed value must match the environment's documented
      database name. A mismatch is a release-blocking defect.

**Connection health:**

- [ ] A health query succeeds against the configured
      `DATABASE_URL`. The canonical probe:

      ```pwsh
      psql "$env:DATABASE_URL" -c "select 1;"
      ```

      Exit code `0` and a result row containing `1` indicate a
      healthy connection. A non-zero exit is a release-blocking
      defect; resolve network, credential, or certificate issues
      before proceeding to §B.2.

- [ ] The target server is a PostgreSQL instance at a supported
      major version. Confirm:

      ```pwsh
      psql "$env:DATABASE_URL" -c "show server_version;"
      ```

      The reported version is recorded in the release notes
      alongside the deploy. Major-version drift across environments
      is a release-blocking anomaly.

---

## §B.2 — Migration execution

The migration runner at
[`scripts/migrate.mjs`](../../../scripts/migrate.mjs) applies plain
SQL files from `data/migrations/` in filename-sorted order. Each
file runs inside its own transaction; a partial failure rolls back
cleanly. Applied filenames are recorded in
`public.schema_migrations`, which makes the runner idempotent: a
re-run against a fully-migrated database skips every file and exits
`0` with zero rows applied.

**Migration files shipped today** — filename-sorted execution order:

| Step | Filename | Purpose |
|---|---|---|
| 1 | `001_server_schema.sql` | Creates the `legendary` schema and its rules-engine tables (`source_files`, `sets`, `masterminds`, `villain_groups`, `schemes`, `rules`, `rule_docs`) plus their indexes. Resolves `\i data/schema-server.sql`. |
| 2 | `002_seed_rules.sql` | Seeds `legendary.rules`, `legendary.rule_docs`, and `legendary.source_files` from `data/seed_rules.sql` via `\i`. Uses `ON CONFLICT DO UPDATE` for `rules` and `rule_docs`, so re-running seed content would be safe — but the migration runner also tracks applied filenames and skips the file on re-run. |
| 3 | `003_game_sessions.sql` | Creates `public.game_sessions` with its `updated_at` trigger function (`set_updated_at()`), trigger (`game_sessions_set_updated_at`), and status index (`game_sessions_status_idx`). |

**Invocation:**

```pwsh
pnpm migrate
```

`pnpm migrate` resolves to
`node --env-file=.env scripts/migrate.mjs` at the monorepo root, so
`DATABASE_URL` is read from `.env` unless the environment already
provides one.

**Expected output — first run against a fresh database:**

```
[migrate] applied 001_server_schema.sql
[migrate] applied 002_seed_rules.sql
[migrate] applied 003_game_sessions.sql
[migrate] 3 migrations applied, 0 skipped.
```

**Expected output — subsequent run against a migrated database:**

```
[migrate] skipped 001_server_schema.sql (already applied)
[migrate] skipped 002_seed_rules.sql (already applied)
[migrate] skipped 003_game_sessions.sql (already applied)
[migrate] 0 migrations applied, 3 skipped.
```

- [ ] `pnpm migrate` exits `0` against the target environment.
- [ ] Every shipped migration appears in one of the two output
      forms above — either `applied` (first run) or `skipped`
      (subsequent run).
- [ ] `public.schema_migrations` exists after the run and contains
      one row per applied filename. Confirm:

      ```sql
      select filename from public.schema_migrations order by filename;
      ```

      The result is exactly:

      ```
      001_server_schema.sql
      002_seed_rules.sql
      003_game_sessions.sql
      ```

- [ ] If the runner exits `1`, the error line in the output names
      which migration file failed and why. Do not attempt to repair
      the schema by hand — resolve the failure in the SQL file,
      roll the database back to pre-migration state (a fresh
      environment should simply be recreated), and re-run
      `pnpm migrate`.

**Migration order is locked by filename sort.** Reordering migration
filenames retroactively is a release-blocking change that requires a
DECISIONS.md entry and coordination with every environment's
`public.schema_migrations` history. Never rename an already-applied
migration file in place.

---

## §B.6 — Rules data seeding verification

Migration `002_seed_rules.sql` populates the rules glossary used by
the game-state-root object's rules cache at startup. Unlike the
deferred lookup and card seeding paths (see §Deferred sections
above), the rules seed ships with the migration set and is therefore
verifiable as part of this checklist.

**Rules rows present:**

- [ ] `legendary.rules` contains at least one row after migrations
      complete:

      ```sql
      select count(*) from legendary.rules;
      ```

      The count must be greater than zero. A zero count means
      `002_seed_rules.sql` was either skipped or applied against an
      empty `data/seed_rules.sql` — both are release-blocking.

- [ ] `legendary.rule_docs` contains at least one row for every
      `legendary.rules` row:

      ```sql
      select count(*) from legendary.rule_docs;
      select r.rule_id
      from legendary.rules r
      left join legendary.rule_docs d using (rule_id)
      where d.rule_id is null;
      ```

      The second query must return zero rows — every rule has its
      corresponding documentation record.

- [ ] Key rules codes resolve by `code`. The loader uses the
      `rules_code_idx` btree index for O(1) lookups. Confirm at
      least one well-known code resolves:

      ```sql
      select rule_id, label from legendary.rules where code = 'shards';
      ```

      A zero-row result means the seed did not include the expected
      rule. Cross-check `data/seed_rules.sql` against the rule
      catalog and re-seed if necessary.

**Full-text search vector:**

The `legendary.rule_docs.search_tsv` column is a `tsvector`
generated column derived from `summary` and `definition`. The GIN
index `rule_docs_search_idx` is built over it.

- [ ] The generated column and its GIN index exist and the
      full-text search path is usable. A representative query:

      ```sql
      select rule_id
      from legendary.rule_docs
      where search_tsv @@ to_tsquery('english', 'wound')
      limit 5;
      ```

      The query runs without error (the presence of zero result
      rows is acceptable if no rule document mentions "wound"; an
      error indicates the generated column or the GIN index is
      missing and that §B.7's structural checks must be re-run).

**Source-file provenance:**

- [ ] `legendary.source_files` contains at least one row with
      `source_kind = 'rules'` recording the seed ingestion. The
      `source_sha256` column may be null (the seed script does not
      always stamp it) but the row must exist as the provenance
      anchor for the rules seed.

---

## §B.7 — Schema-structure verification

Every structural object created by the three shipped migrations must
exist in the target database with the expected shape. This section
covers **structure only** — table/column/foreign-key/index existence
and types. **Row-count verification for lookup tables and card
tables is not performed here** (see §Deferred sections above) — the
tables the deferred seed populates are not created by the shipped
migrations and are out of scope for WP-042's checklist.

### B.7.1 — Tables exist

Run the probe below and confirm every listed table is present with
the expected schema membership.

```sql
select schemaname, tablename
from pg_tables
where (schemaname = 'legendary' and tablename in
        ('source_files','sets','masterminds','villain_groups',
         'schemes','rules','rule_docs'))
   or (schemaname = 'public'    and tablename in
        ('game_sessions','schema_migrations'))
order by schemaname, tablename;
```

- [ ] The result contains exactly these nine rows:

      ```
      legendary | masterminds
      legendary | rule_docs
      legendary | rules
      legendary | schemes
      legendary | sets
      legendary | source_files
      legendary | villain_groups
      public    | game_sessions
      public    | schema_migrations
      ```

      Missing entries indicate a migration did not apply cleanly.
      Extra entries are acceptable only if they are introduced by a
      later migration (e.g., a future `004_*.sql` or `005_*.sql`
      landed by a successor work packet) and documented in release
      notes.

### B.7.2 — Columns and types

Spot-check the highest-risk columns — columns that the server reads
at startup and columns that participate in foreign keys or unique
constraints.

**`legendary.rules`:**

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'legendary' and table_name = 'rules'
order by ordinal_position;
```

- [ ] The result includes rows with at least:

      ```
      rule_id    | integer | NO
      code       | text    | NO
      label      | text    | NO
      card_types | ARRAY   | NO
      raw        | jsonb   | NO
      ```

**`legendary.rule_docs`:**

- [ ] `rule_id` is `integer NOT NULL`, `definition` is `jsonb NOT
      NULL`, `summary` is `text NOT NULL`, `raw` is `jsonb NOT
      NULL`, and a generated `search_tsv` column of type `tsvector`
      is present. The generated-column status is visible via:

      ```sql
      select column_name, generation_expression
      from information_schema.columns
      where table_schema = 'legendary' and table_name = 'rule_docs'
        and generation_expression is not null;
      ```

      The query returns `search_tsv` with a non-null
      `generation_expression`.

**`public.game_sessions`:**

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'game_sessions'
order by ordinal_position;
```

- [ ] The result contains at minimum:

      ```
      game_session_id   | bigint                   | NO
      match_id          | text                     | NO
      created_at        | timestamp with time zone | NO
      updated_at        | timestamp with time zone | NO
      status            | text                     | NO
      player_count      | integer                  | NO
      mastermind_ext_id | text                     | NO
      scheme_ext_id     | text                     | NO
      ```

      `mastermind_ext_id` and `scheme_ext_id` must be `text` (stable
      across re-seeds). Per D-1201 / D-1202, cross-service card
      references use `ext_id text`, not `bigint` FKs.

### B.7.3 — Foreign-key constraints

The three shipped migrations establish four foreign-key
constraints. Confirm with:

```sql
select conname,
       conrelid::regclass  as from_table,
       confrelid::regclass as to_table,
       confdeltype         as on_delete
from pg_constraint
where contype = 'f'
  and (conrelid::regclass::text like 'legendary.%'
    or conrelid::regclass::text like 'public.%')
order by conrelid::regclass::text, conname;
```

- [ ] The result includes at least these four foreign keys, each
      with `on_delete = 'c'` (`CASCADE`):

      ```
      masterminds      → legendary.sets
      villain_groups   → legendary.sets
      schemes          → legendary.sets
      rule_docs        → legendary.rules
      ```

      `CASCADE` semantics are load-bearing: dropping a set cleans
      up every mastermind, villain group, and scheme record tied
      to it, and dropping a rule cleans up its documentation row.
      If any of these appear with a different `on_delete` action,
      the migration did not apply faithfully and must be
      investigated.

### B.7.4 — Unique constraints

Every table that the server resolves by a natural key carries a
`UNIQUE` constraint.

```sql
select conname,
       conrelid::regclass as tbl,
       pg_get_constraintdef(oid) as definition
from pg_constraint
where contype = 'u'
  and (conrelid::regclass::text like 'legendary.%'
    or conrelid::regclass::text like 'public.%')
order by conrelid::regclass::text, conname;
```

- [ ] The result includes, at minimum:

      ```
      legendary.sets            UNIQUE (set_code)
      legendary.masterminds     UNIQUE (set_id, name)
      legendary.villain_groups  UNIQUE (set_id, name)
      legendary.schemes         UNIQUE (set_id, name)
      legendary.rules           UNIQUE (code)
      public.game_sessions      UNIQUE (match_id)
      public.schema_migrations  UNIQUE (filename)
      ```

      Every listed constraint creates an implicit btree index, so
      the B.7.5 index checks do not need to restate these.

### B.7.5 — Indexes

The three shipped migrations explicitly create these indexes beyond
the implicit unique-constraint indexes covered in B.7.4.

```sql
select schemaname, tablename, indexname, indexdef
from pg_indexes
where (schemaname = 'legendary' or schemaname = 'public')
  and indexname in (
    'source_files_kind_idx',
    'sets_set_code_idx',
    'masterminds_set_id_idx',
    'villain_groups_set_id_idx',
    'schemes_set_id_idx',
    'rules_code_idx',
    'rule_docs_search_idx',
    'game_sessions_status_idx'
  )
order by schemaname, indexname;
```

- [ ] The result contains exactly these eight indexes. One is
      notable: `rule_docs_search_idx` is a **GIN** index over the
      generated `search_tsv` column — its `indexdef` will contain
      `USING gin (search_tsv)`. A missing GIN index degrades the
      rules glossary full-text search path to a sequential scan;
      its absence is a release-blocking defect even though queries
      would still return correct results.

> The session prompt's WP-042 §Locked Values mentioned "indexes
> exist on `slug` columns where upsert is used" as a §B.7
> expectation, inherited from the pre-amendment five-migration
> draft. In reality the three shipped migrations do not create any
> `slug`-based columns or indexes — the `slug` surface is a
> registry-layer field that would only reach the database via the
> deferred seed infrastructure. Once WP-042.1 lands the additional
> `legendary.*` lookup-table migrations alongside the seed runner,
> the slug-index expectations become checkable and should be folded
> into this section at that time.

### B.7.6 — Triggers and functions

Migration `003_game_sessions.sql` creates one trigger function and
one trigger so that `public.game_sessions.updated_at` reflects the
last-modified timestamp on every `UPDATE`.

- [ ] The function `public.set_updated_at()` exists:

      ```sql
      select proname, prorettype::regtype
      from pg_proc
      where proname = 'set_updated_at'
        and pronamespace = 'public'::regnamespace;
      ```

      The result contains exactly one row with
      `prorettype = 'trigger'`.

- [ ] The trigger `game_sessions_set_updated_at` exists on
      `public.game_sessions`:

      ```sql
      select tgname, tgrelid::regclass, tgtype
      from pg_trigger
      where tgname = 'game_sessions_set_updated_at'
        and not tgisinternal;
      ```

      The result contains exactly one row with
      `tgrelid = 'public.game_sessions'`.

A missing trigger leaves `updated_at` silently equal to
`created_at` forever, breaking audit and debugging use cases. Its
absence is a release-blocking defect.

---

## Completion criteria

A PostgreSQL deployment verification pass is complete when every
checkbox in §B.1 + §B.2 + §B.6 + §B.7 is checked **for the specific
environment being promoted**. Carrying forward checks from a prior
environment is not acceptable — database state can diverge across
environments even when the migration set has not changed, and the
whole point of this gate is to catch that drift before promotion.

When a successor work packet (WP-042.1) ships the deferred seeding
checklist sections, this checklist's top-of-file "deferred sections"
pointer will be retired and those sections will be authored as
§B.3 / §B.4 / §B.5 / §B.8 without disturbing §B.1 / §B.2 / §B.6 /
§B.7 as shipped here.
