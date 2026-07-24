# Operator Runbook — Reclaim `bgio.matches` Storage (`VACUUM FULL`)

**Purpose:** The boardgame.io match store (`bgio.matches` on the managed Postgres
`legendary-arena-db`) holds each live match's `state` / `initial_state` / `log`
jsonb blobs. Finished and abandoned matches are deleted automatically by the
**match-reaper** (WP-327), but PostgreSQL does **not** return a table's disk space
to the OS on `DELETE` — the deleted rows become dead tuples that autovacuum keeps
*reusable*, so the on-disk file stays large (mostly in the **TOAST** relation where
the big jsonb blobs live). This runbook reclaims that bloat back to disk with a
one-shot `VACUUM FULL`, and explains when it's worth doing.

This document is **operational, not architectural**. It is subordinate to
`docs/ai/ARCHITECTURE.md` and `.claude/rules/`. It requires **no repository code or
contract change** — it runs a maintenance command against the production database.
Related: [`DISASTER_RECOVERY.md`](./DISASTER_RECOVERY.md),
[`INCIDENT_RESPONSE.md`](./INCIDENT_RESPONSE.md),
[`OUT-OF-BAND-SETTINGS.md`](./OUT-OF-BAND-SETTINGS.md),
[Architecture & Library Adoption Inventory](../../wiki/architecture-inventory.md)
(§ *Managed database — sizing history & operational notes*).

---

## Why this is a runbook, not a Work Packet

WPs govern **repository code and contract changes**. This change edits **no `.ts`,
no schema, no contract** — it runs `VACUUM FULL` against the managed database. That
is an out-of-band operator action, the same class as the other `RUNBOOK-*.md` files
in this directory.

---

## Background — two separate things

1. **Row retention is automatic (no action needed).** The **match-reaper**
   (`apps/server/src/db/matchReaper.js`, WP-327) runs in-process every 15 min and
   deletes:
   - **finished** matches (metadata carries `gameover`) **1 h** after their last
     write — but only once `captured_at` is set, so the **capture-harvester**
     (`captureHarvester.js`, WP-335, every 5 min) has preserved the durable replay /
     competitive artifact first (the D-24119 carve-out);
   - **abandoned** matches (never reached `gameover`) **24 h** after their last write.

   So a healthy store settles to a handful of in-flight + recently-ended matches.
   You should NOT delete rows by hand — the reaper does it, and doing it manually
   risks losing a match before the harvester captures it.

2. **The table FILE does not shrink on delete (this is what `VACUUM FULL` fixes).**
   PostgreSQL marks deleted rows as dead tuples; autovacuum makes that space
   **reusable** by future inserts (so the file will not grow unbounded), but it
   does **not** return the space to the OS. After a long run of reaped matches,
   `pg_total_relation_size('bgio.matches')` can be hundreds of MB while only a few
   rows are live — nearly all of it dead TOAST space. `VACUUM FULL` rewrites the
   table into a fresh, compact file and returns the freed space to disk.

---

## When to run it

Run it when **both** are true:

- `pg_total_relation_size('bgio.matches')` is much larger than the live footprint
  (rule of thumb: a match blob is ~5 MB, so `> ~10 × live_match_count × 5 MB` is
  bloat worth reclaiming), **and**
- it is **off-peak / quiet** — `VACUUM FULL` takes a brief **ACCESS EXCLUSIVE** lock
  on `bgio.matches` and rewrites it, blocking reads *and* writes to that table for
  the duration (fast when few rows are live, but it WILL stall any live match's
  moves for those seconds).

It is **not** a scheduled chore. On the current `pro-4gb` (4 GB) instance with
storage autoscaling, the reusable bloat self-limits and the disk has years of
runway — reclaim only when you want the space back or before a storage review.

---

## Procedure

> Run these on the **Render service shell** (`legendary-arena-server` → Shell),
> where `$DATABASE_URL` is the internal production connection string. A **local**
> `psql` against your workstation `.env` points at your dev DB, not prod.

### 1. Check the current size (baseline)

```bash
psql "$DATABASE_URL" -c "SELECT count(*) AS matches, pg_size_pretty(pg_total_relation_size('bgio.matches')) AS matches_size, pg_size_pretty(pg_database_size(current_database())) AS db_size FROM bgio.matches;"
```

If `matches_size` is large while `matches` is small, the difference is bloat.
Optionally confirm nothing is stuck (there should be no old `finished AND
captured_at IS NULL` pile — that would be a harvester failure, a different problem):

```bash
psql "$DATABASE_URL" -c "SELECT (metadata->'gameover') IS NOT NULL AS finished, captured_at IS NOT NULL AS captured, count(*), (now()-min(updated_at)) AS oldest_age FROM bgio.matches GROUP BY 1,2 ORDER BY 1,2;"
```

### 2. Reclaim the space (the exclusive-lock window)

Confirm no game is actively being played, then:

```bash
psql "$DATABASE_URL" -c "VACUUM (FULL, VERBOSE) bgio.matches;"
```

`VERBOSE` prints the rewrite progress, e.g.
`"bgio.matches": found N removable, M nonremovable row versions in P pages`.

### 3. Verify the reclaim

```bash
psql "$DATABASE_URL" -c "SELECT count(*) AS matches, pg_size_pretty(pg_total_relation_size('bgio.matches')) AS matches_size, pg_size_pretty(pg_database_size(current_database())) AS db_size FROM bgio.matches;"
```

`matches_size` should drop to roughly the real size of the live matches.

---

## Worked example (2026-07-24)

After the DB-stability incident (see the inventory's *Managed database* notes and
`STATUS.md`), the store had accumulated bloat from months of reaped matches:

| | Before | After `VACUUM FULL` |
|---|---|---|
| `bgio.matches` size | 346 MB | **41 MB** |
| DB total | 357 MB | **52 MB** |
| Live rows | 8 | 8 |

The `VACUUM FULL` reported only ~10 pages in the main table — the ~305 MB reclaimed
was almost entirely **TOAST** (the jsonb blobs of the reaped matches). It completed
in under a second because only 8 rows were live to copy.

---

## Caveats & related

- **Lock:** `VACUUM FULL` holds `ACCESS EXCLUSIVE`; do not run it during a live
  match. A plain `VACUUM bgio.matches` (no `FULL`) reclaims dead space for *reuse*
  without a table rewrite or an exclusive lock, but does **not** shrink the file —
  use `FULL` only when you want disk back.
- **Do not hand-`DELETE` matches** — the reaper (WP-327) owns row retention and
  waits for the harvester (WP-335) so a competitive match is never lost.
- **Sizing / storage posture:** see
  [Architecture & Library Adoption Inventory](../../wiki/architecture-inventory.md)
  § *Managed database — sizing history & operational notes* (plan history:
  `basic-256mb` → `basic-1gb` (#932) → `pro-4gb` (#958); `storageAutoscalingEnabled`).
