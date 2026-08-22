# Knowledge Inventory — Corpus Census (TEMPLATE)

> **This file is the schema, not the census.** The *populated* inventory —
> `KNOWLEDGE_INVENTORY.md` — lists real client-project and formulation paths and
> therefore lives **on the owned host, never committed to this repo and never
> published to the ewiki**. That is the same publishing boundary the AI Second
> Brain page states in its Edge Cases ("the actual corpus — client data,
> formulations — stays on the owned host, never in the wiki") and the same
> discipline that keeps real `.env` values out of the repo. Keep this template in
> the repo; keep the filled copy on the host.

## Why this exists

The [AI Second Brain](../../wiki/ai-second-brain.md) architecture is complete, but
it *assumes the corpus exists*. The first real build deliverable is discovering
it: **where every source actually lives, and how each is classified.** Without
this census, embeddings, routing, and ingestion are all guessing. It is the
gating prerequisite in the [runbook](./AI_SECOND_BRAIN_RUNBOOK.md) §1.

The Legendary Arena slice is already mapped (and safely public) in the ewiki's
[Data & File Locations](../../wiki/data-file-locations.md); it is filled in below
as a worked example. The census extends the same discipline to the Engineering,
Barefoot Betters, Governance, and Research domains — which is the part that stays
on the owned host.

## Classification scheme

Each source is classified on three axes. The first two mirror the ewiki's
*Corpus classes* and *Retrieval strategy* exactly, so a census row and a
retrieval decision never disagree.

- **Authority class** — `Authoritative` | `Reference` | `Transient`.
  Authoritative = decisions, WPs, ECs, runbooks, indexes. Reference = research
  PDFs, transcripts, long-form notes. Transient = inbox captures, scratch,
  session outputs.
- **Ingestion disposition** — `Navigated` (exact/grep/INDEX, **never embedded**)
  | `Vectorized` (the minority semantic layer) | `Not ingested` (binaries,
  transient). Rule of thumb: Authoritative → Navigated; Reference → Vectorized;
  Transient → Not ingested. Governance is **never** Vectorized.
- **Backup class** — `Source-of-truth` (a true backup target) | `Derived`
  (rebuildable from source; **not** a backup target — e.g. the vector index).

A row is **governed** only if it also satisfies the ewiki *Quality gates*: source
identified, last-updated present, domain assigned, reachable from an `INDEX.md`,
links resolve, ownership known. Rows failing a gate are `unmanaged` — findable,
but not citable as governed knowledge.

## Inventory

Columns: **Source** · **Domain** · **Location** (surface + path) · **Authority** ·
**Ingestion** · **Backup** · **Owner** · **Notes**.

### Legendary Arena — worked example (already public; safe to keep in the repo)

| Source | Domain | Location | Authority | Ingestion | Backup | Owner | Notes |
|---|---|---|---|---|---|---|---|
| Governance docs (`DECISIONS.md`, `ARCHITECTURE.md`, WPs, ECs, REFERENCE) | Legendary Arena | Git · `docs/ai/` | Authoritative | Navigated | Source-of-truth | Jeff | Never vectorized (Locked decision). |
| Engineering wiki | Legendary Arena | Git → ewiki (CF Access) · `wiki/` | Authoritative | Navigated | Source-of-truth | Jeff | Published behind Cloudflare Access. |
| Card data + metadata | Legendary Arena | Git · `data/cards/`, `data/metadata/` | Authoritative | Navigated | Source-of-truth | Jeff | Generated + hand-authored (`co2e.json`). |
| Card images / audio / legends snapshots | Legendary Arena | Cloudflare R2 | Reference | Not ingested | Source-of-truth (R2) | Jeff | Binaries; metadata lives in Postgres. |
| `legendary.*` schema (replays, scores, ownership) | Legendary Arena | PostgreSQL | Authoritative | Not ingested | Source-of-truth (DB dumps) | Jeff | Operational data, not a document corpus. |
| Generated coverage / ledgers | Legendary Arena | Git · `docs/ai/coverage/` | Reference | Not ingested | Derived | Jeff | Rebuilt from source; not a backup target. |

### Engineering — fill on the owned host

| Source | Domain | Location | Authority | Ingestion | Backup | Owner | Notes |
|---|---|---|---|---|---|---|---|
| `<project — e.g. cost estimate, codes, survey, risk register>` | Engineering | `<pCloud / owned-host path>` | `<Authoritative\|Reference>` | `<Navigated\|Vectorized>` | `<Source-of-truth\|Derived>` | Jeff | `<client-confidential? retention?>` |
| `<project INDEX.md>` | Engineering | `<path>/INDEX.md` | Authoritative | Navigated | Source-of-truth | Jeff | One per project folder. |

### Barefoot Betters — fill on the owned host

| Source | Domain | Location | Authority | Ingestion | Backup | Owner | Notes |
|---|---|---|---|---|---|---|---|
| `<formulation research / ingredient study>` | Barefoot Betters | `<path>` | Reference | Vectorized | Source-of-truth | Jeff | `<proprietary formulation — owned host only>` |
| `<blog drafts / published posts>` | Barefoot Betters | `<Git repo / CMS export>` | Reference | Vectorized | Source-of-truth | Jeff | |

### Governance — fill on the owned host

| Source | Domain | Location | Authority | Ingestion | Backup | Owner | Notes |
|---|---|---|---|---|---|---|---|
| `<cross-project rules / lint checklists / playbooks>` | Governance | `<path>` | Authoritative | Navigated | Source-of-truth | Jeff | The shared operator discipline. |

### Research — fill on the owned host

| Source | Domain | Location | Authority | Ingestion | Backup | Owner | Notes |
|---|---|---|---|---|---|---|---|
| `<standards PDFs / books>` | Research | `<owned-host archive>` | Reference | Vectorized | Source-of-truth | Jeff | Bulk reference; the pilot's first vector corpus candidate. |
| `<meeting / video transcripts>` | Research | `<path>` | Reference | Vectorized | Source-of-truth | Jeff | Produced by the `ingest-research-note` skill. |

## How to use this

1. Copy this template to `KNOWLEDGE_INVENTORY.md` **on the owned host**.
2. Walk each domain root; for every source, fill one row. A source with no clear
   home is a signal to create an `INDEX.md`, not to skip it.
3. Classify honestly on all three axes. If a row would be `Vectorized` **and**
   Authoritative, stop — that is the "do not vectorize governance" line; it should
   be `Navigated`.
4. Anything you cannot classify or locate is itself a finding — it is `unmanaged`
   until an owner and a home are assigned.
5. The census is done when every domain's authoritative documents are listed,
   located, and classified, and each domain root has an `INDEX.md`. Only then does
   [runbook](./AI_SECOND_BRAIN_RUNBOOK.md) §5 (ingestion) have a defined input.

> **Promotion still requires a human.** Adding a row here records that a source
> *exists* and how it is retrieved; it never promotes anything to Authoritative.
> Promotion (`Raw Capture → Research Note → Referenced Artifact → Authoritative
> Record`) stays a deliberate operator act, per the ewiki *Promotion* rule.
