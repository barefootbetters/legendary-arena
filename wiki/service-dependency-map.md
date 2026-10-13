---
title: Service Dependency Map
type: Guide
tags:
  - operations
  - incident-response
  - disaster-recovery
  - cloudflare
  - digitalocean
  - github
related:
  - system-backup.md
  - disaster-recovery.md
  - operational-health-checks.md
  - architecture-inventory.md
  - private-site-hosting.md
  - ubuntu-lab-provisioning.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\service-dependency-map.md (this page — https://ewiki.legendary-arena.com/service-dependency-map/)
  - ../docs/ops/service-dependencies.json
  - ../docs/ops/domains.json
  - ../docs/ops/DOMAINS.md
  - ../docs/ops/DISASTER_RECOVERY.md
  - ../docs/ai/DECISIONS.md
last-reviewed: 2026-10-12
---

## Summary

Which products depend on which services, as a lookup in both directions:
**a service is down — what breaks?** and **a product is down — what do I
check?** Both tables are rendered at build time from one data file,
[`docs/ops/service-dependencies.json`](../docs/ops/service-dependencies.json),
so they can't disagree with each other or drift from it (D-24710).

## Mechanics

### Reading the tables

Every edge has one of five impacts:

| Impact | Meaning |
|---|---|
| **Stops working** | The product is unusable. |
| **Partly broken** | One feature fails; the rest works. |
| **Goes stale** | It keeps serving, but its data stops updating. |
| **Can't deploy** | It keeps serving; changes can't ship until the service is back. |
| **Unwatched** | It keeps running, but nobody is alerted if it fails. |

The split between *stops working* and *can't deploy* is the point of the
map. GitHub going down takes no site offline: every site keeps serving what
was last deployed. Cloudflare going down takes nearly everything offline,
because every hostname is proxied through it.

In the product table, the services are listed in the order to check them:
the outermost layer (DNS and the edge) first, the product's own host next,
then what it calls.

### If a service is down — what breaks

{{< service-impact view="by-service" >}}

### If a product is down — what to check

{{< service-impact view="by-product" >}}

### Updating the map

Edit [`docs/ops/service-dependencies.json`](../docs/ops/service-dependencies.json),
not this page. A product is either a site (`domainUrl`, copied exactly from
[`docs/ops/domains.json`](../docs/ops/domains.json), which supplies its URL and
host) or a job (`url` and `host` given directly). Each dependency names a
service id, an impact, and the effect a reader would see.

The build checks the file and fails, naming the problem, when:

- a dependency names a service that isn't in the services list;
- an impact isn't one of the five above;
- a dependency has no effect text, or a product has no dependencies;
- a product's `domainUrl` isn't in `domains.json`;
- a live, serving entry in `domains.json` has no product here. Adding a
  subdomain therefore means recording what it depends on in the same PR.

## Interactions

- [System Backup](system-backup.md) — every backup and recovery fact on one
  page; this map is its outage-lookup companion.
- [Disaster Recovery](disaster-recovery.md) — the DR-01…DR-05 scenarios. This
  map says what a provider loss takes down; the scenarios say how to recover.
- [Operational Health Checks](operational-health-checks.md) —
  `pnpm check:domains` probes every hostname in `domains.json`, the fastest
  way to see which products are actually down.
- [Architecture Inventory](architecture-inventory.md) — the generated list of
  hostnames, hosts, and vendor accounts. It answers "what runs where"; this map
  answers "what breaks when".
- [Private Site Hosting](private-site-hosting.md) — why the ewiki and dashboard
  sit behind Cloudflare Access on assets-only Workers.

## Edge Cases

- **The map is only as complete as its edges.** The build guarantees every
  live hostname has an entry, not that every entry lists every dependency. A
  new outbound call (a new vendor API in `apps/server`, a new CDN in a
  front-end) needs its edge added by hand.
- **Rollback window.** Until Render is deleted (~2026-10-20), a D-24707
  rollback would move `api.` back to Render; this map describes the droplet.
- **The raw Markdown shows shortcode lines, not the tables.** Read the JSON
  file directly on GitHub or as an agent; it is the source.

## References

- [`docs/ops/service-dependencies.json`](../docs/ops/service-dependencies.json)
  — the dependency edges (source of both tables).
- [`docs/ops/domains.json`](../docs/ops/domains.json) and
  [`docs/ops/DOMAINS.md`](../docs/ops/DOMAINS.md) — the hostnames.
- [DECISIONS.md D-24710](../docs/ai/DECISIONS.md) — this map's data-file
  convention; D-24707 (the droplet), D-24690 (the Workers).
- [`service-impact.html`](../apps/wiki-viewer/layouts/shortcodes/service-impact.html)
  and [`service-dependencies-data.html`](../apps/wiki-viewer/layouts/partials/service-dependencies-data.html)
  — the renderer and its checks.
