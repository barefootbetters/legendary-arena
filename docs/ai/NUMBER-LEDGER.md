# Number Ledger — WP / EC / D allocation lock

The append-only reservation ledger that stops two concurrent sessions from
allocating the **same** WP / EC / D number (the failure that renumbered WP-419 →
WP-421). See **D-24245** (this mechanism; renumbered from D-24242 — see the D
section below) and the allocation protocol in
[`01.0a-wp-drafting-phase.md`](REFERENCE/01.0a-wp-drafting-phase.md).

## How it works

Each space (`WP` / `EC` / `D`) has a **`high-water`** — the highest number that
was already allocated when this ledger was adopted (2026-07-25). Numbers at or
below the high-water are grandfathered (they live in WORK_INDEX / EC_INDEX /
DECISIONS and are stable). **Every new allocation above the high-water gets one
reservation line here**, newest last:

```
- WP-422 — <kebab-slug or short title> (YYYY-MM-DD, <branch-or-PR>)
```

**The protocol (reserve first):**

1. `node scripts/check-number-ledger.mjs --next wp` (or `ec` / `d`) → the next free number.
2. Append its reservation line under the matching `## ` section **in your SPEC
   commit**, and get that tiny append merged **first** — claim the number before
   the bulky work.
3. `node scripts/check-number-ledger.mjs --check` must pass (CI runs it too).

**Why this holds under concurrency:**

- `.gitattributes` marks this file `merge=union`, so two sessions reserving
  *different* numbers auto-merge with **no conflict** on local rebase/merge (the
  big prose indices do not — that is why reservations live in this minimal file).
- If two sessions reserve the **same** number, union-merge keeps both identical
  lines and `--check` **fails loudly** (`DUPLICATE reservation`) — the collision
  surfaces early in CI, not silently at merge time. One session renumbers.
- `--check` also fails on **drift**: a number used in an index above the
  high-water with no reservation here (`UNRESERVED`).

Union-merge is a *local* git driver (it does not run on GitHub's server-side
squash) — that is fine: the duplicate check is the real safety net and catches a
same-number race however the merge happened.

---

## WP

high-water: 422

<!-- reservations (WP-423 and up), newest last -->

- WP-423 — hugo-version-upgrade (2026-07-24, spec/wp-423-hugo-version-upgrade)
- WP-424 — bot-ally stop-drivers-on-sigterm (2026-07-25, fix/bot-ally-stop-drivers-on-sigterm)
- WP-425 — apex-legendary-combo-tier (2026-07-25, spec/wp-425-apex-combo-tier)
- WP-426 — bot-ally survive-db-blip (2026-07-25, fix/bot-ally-survive-db-blip)
- WP-428 — diagnostic-transport-block (2026-07-25, spec/wp-428-transport-diagnostics)
- WP-427 — bot-resolve-putbottomhq (2026-07-25, fix/bot-resolve-putbottomhq)
- WP-429 — transport-reconnect-resync-counters (2026-07-25, spec/wp-429-transport-counters)

## EC

high-water: 457

<!-- reservations (EC-458 and up), newest last -->

- EC-458 — hugo-version-upgrade (2026-07-24, spec/wp-423-hugo-version-upgrade)
- EC-459 — bot-ally stop-drivers-on-sigterm (2026-07-25, fix/bot-ally-stop-drivers-on-sigterm)
- EC-460 — apex-legendary-combo-tier (2026-07-25, spec/wp-425-apex-combo-tier)
- EC-461 — bot-ally survive-db-blip (2026-07-25, fix/bot-ally-survive-db-blip)
- EC-463 — diagnostic-transport-block (2026-07-25, spec/wp-428-transport-diagnostics)
- EC-462 — bot-resolve-putbottomhq (2026-07-25, fix/bot-resolve-putbottomhq)
- EC-464 — transport-reconnect-resync-counters (2026-07-25, spec/wp-429-transport-counters)

## D

high-water: 24241

- D-24242 — seed-par-publication (WP-422; claimed in #993 before this ledger existed — reconciled 2026-07-25, infra/dedup-d24242)
- D-24243 — hugo-version-upgrade (2026-07-24, spec/wp-423-hugo-version-upgrade)
- D-24244 — bot-ally stop-drivers-on-sigterm (2026-07-25, fix/bot-ally-stop-drivers-on-sigterm)
- D-24245 — number-allocation-ledger mechanism (renumbered from D-24242 for the seed-PAR collision; 2026-07-25, infra/dedup-d24242)
- D-24246 — apex-legendary-combo-tier (4th shared comboTierForCount boundary; 2026-07-25, spec/wp-425-apex-combo-tier)
- D-24247 — bot-ally survive-db-blip (tolerate transient empty fetch; 2026-07-25, fix/bot-ally-survive-db-blip)
- D-24249 — diagnostic-transport-block (transport block in the play-surface diagnostic report; 2026-07-25, spec/wp-428-transport-diagnostics)
- D-24248 — bot-resolve-putbottomhq (getLegalMoves short-circuit for the 2 put-bottom-HQ choices; 2026-07-25, fix/bot-resolve-putbottomhq)
- D-24250 — transport-reconnect-resync-counters (reconnect/resync/watchdog counters in the transport diagnostics block; 2026-07-25, spec/wp-429-transport-counters)
