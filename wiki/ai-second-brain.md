---
title: AI Second Brain
type: Guide
tags:
  - infrastructure
  - ai
  - knowledge-management
  - postgres
  - mcp
  - operator-reference
  - governance
  - draft
related:
  - ubuntu-lab-provisioning.md
  - disaster-recovery.md
  - data-file-locations.md
  - workspace-map.md
  - development-workflow.md
status: draft
source:
  - C:\pcloud\BB\DEV\legendary-arena\wiki\ai-second-brain.md (this page — https://ewiki.legendary-arena.com/ai-second-brain/)
  - ../docs/ai/DECISIONS.md#d-24341
  - ../docs/ops/AI_SECOND_BRAIN_RUNBOOK.md
last-reviewed: 2026-08-24
---

# AI Second Brain

> **Proposed architecture — not yet built.** This page records a *design
> intent*: a self-hosted knowledge platform where organizational knowledge is
> owned locally and durable, while the AI models and agent frameworks that read
> it stay swappable. No component described here is running yet. The architecture
> is locked by [DECISIONS.md D-24341](../docs/ai/DECISIONS.md#d-24341) — a
> standalone architecture record, **not** an engine Work Packet (the platform
> crosses no engine layer), mirroring the Ubuntu Lab Provisioning governance
> pattern. The executable build runbook lives at
> [`docs/ops/AI_SECOND_BRAIN_RUNBOOK.md`](../docs/ops/AI_SECOND_BRAIN_RUNBOOK.md)
> — an operator runbook, not an engine Work Packet — but nothing there has been
> run yet. The page stays `status: draft` — cite this record, but treat every
> unbuilt claim as a plan, not a fact, until the platform is built.
>
> **Scope note.** The knowledge this platform indexes spans more than Legendary
> Arena — engineering consulting work, Barefoot Betters, and cross-project
> research all sit under the same roof. The *platform* is shared operator
> infrastructure; only some of the *knowledge* is Legendary Arena's. That
> breadth is deliberate (one brain, many domains) but is worth naming, because
> it is wider than the rest of this wiki's remit.

> **Architecture motto.** *Knowledge is permanent. Agents are replaceable.*
> Store facts in open systems; treat AI models as interchangeable tools. The
> system of record is the knowledge base, not the AI that accesses it.

## Summary

An "AI second brain" is a self-hosted platform that keeps a durable, locally
owned store of organizational knowledge and puts a *replaceable* agent layer in
front of it. The load-bearing idea is a separation: **knowledge is permanent;
agents are replaceable.** The knowledge base — mostly navigable structured
Markdown in Git, with a small PostgreSQL vector layer over high-volume reference
material — is the system of record. Whatever model or agent framework happens to
be best this quarter (Claude Code today, something else later) connects to that
store and is expected to be swapped without migrating a single row.

Its purpose is to help the operator **research, ideate, organize, retrieve, and
verify** — structured thinking, project memory, and decision traceability. It is
explicitly *not* built to automate everything, replace judgment, auto-ingest all
data, auto-publish content, or auto-edit governance files.

This page is the design record for that platform. It is a companion to
[Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md) — that page covers *how
the box is built and hardened*; this page covers *what knowledge-management
services would run on a box* and why they are shaped the way they are. Keeping
the two separate is intentional: infrastructure provisioning and knowledge
architecture drift at different rates and answer to different concerns.

## Mechanics

### Non-goals

Naming the boundaries first, so scope is clear before the design detail. This
platform is **not** a CRM, a project manager, a social-media scheduler, an
autonomous agent swarm, a replacement for Git, a replacement for the source
systems it reads, or an automatic knowledge vacuum. Its job is **durable
knowledge retrieval and decision support** — nothing more. The reasoning behind
each boundary is in
[Scope boundaries](#scope-boundaries-what-this-deliberately-is-not).

### Design principles

Ten principles shape the platform. They are deliberately short, durable, and
vendor-neutral — they should hold whether the agent in front of the knowledge is
Claude, an open-weights model, or something that does not exist yet. Several of
them are the same instincts that already govern this repo, applied one level up
to the knowledge layer.

1. **Knowledge Ownership.** All organizational knowledge stays under operator
   control. The AI platform is never the system of record — source artifacts
   remain in Git, PostgreSQL, the ewiki, and document archives; AI consumes and
   organizes them but does not own them. *Rule: knowledge belongs to the
   operator, not the model vendor.*
2. **Model Independence.** The platform functions regardless of which model is
   in use; Claude, Grok, GPT, Gemini, and local models are interchangeable
   workers. *Rule: replace the model without migrating the knowledge.*
3. **Open Standards First.** Prefer documented, portable interfaces —
   PostgreSQL over proprietary databases, Markdown over proprietary document
   formats, Git over vendor workspaces, MCP and APIs over closed integrations.
   *Rule: data must remain portable.*
4. **Knowledge is Permanent, Agents are Disposable.** The knowledge base is a
   long-lived asset; agents, prompts, workflows, and models are temporary
   implementation details. *Rule: the brain survives replacement of every agent.*
5. **Retrieval Before Generation.** Answer from authoritative knowledge before
   generating new content — authoritative sources → retrieved context → AI
   reasoning → generated output. *Rule: ground answers in facts before
   synthesis.*
6. **Single Source of Truth.** Every fact has one authoritative home (decisions
   → `DECISIONS.md`, execution → Work Packets, recovery → DR runbooks,
   architecture → the [Architecture Inventory](architecture-inventory.md)); AI
   references sources rather than duplicating them. This is the repo's existing
   authority hierarchy, extended to the knowledge layer. *Rule: no competing
   truth stores.*
7. **Deterministic Recovery.** A catastrophic AI failure must never endanger the
   knowledge — it rebuilds from Git, PostgreSQL backups, wiki exports, and config
   archives alone. *Rule: rebuild the brain from backups alone.*
8. **Auditability.** Every important artifact traces to its source — where it
   came from, which document supports it, which decision authorized it, and when
   it was written. *Rule: facts require provenance.*
9. **Incremental Automation.** Automation proves value before becoming critical
   infrastructure: prototype, demonstrate usefulness, establish baseline
   behaviour, document governance, then automate. This mirrors the repo's
   existing scaffold-then-spec approach. *Rule: prototype before
   institutionalizing.*
10. **Human Authority.** AI may recommend; humans decide. AI-generated output
    stays reviewable, replaceable, and overridable. *Rule: the operator remains
    accountable.*

**The knowledge base is long-term memory; the agent is the current reasoning
surface.** That is Principle 4 read from the agent's side — the store holds the
facts, and the agent in front of it (Claude Code today, another framework
tomorrow) navigates, cites, and improves them under operator authority. Swapping
that surface must never move a single fact.

### Locked architecture decisions

The page interleaves settled architecture with still-open implementation choices;
this table separates them. **Locked** decisions are fixed by
[D-24341](../docs/ai/DECISIONS.md#d-24341) or the navigation-first retrieval
decision, and change only through a new `DECISIONS.md` entry. **Preferred** are
recommended defaults, swappable without re-deciding the architecture. **Open**
are genuine choices deferred to the build (see [Open Questions](#open-questions)).

| Decision | Status |
|---|---|
| Knowledge stays operator-owned; AI is never the system of record | **Locked** |
| Governance docs navigated exactly, never vectorized | **Locked** |
| Navigation-first retrieval (~90% Markdown / 10% vector) | **Locked** |
| Human review is the authority boundary over AI output | **Locked** |
| Recovery rebuilds from source repos, never from an AI system | **Locked** |
| Dedicated host is the end-state (co-location OK to bootstrap) | **Locked** |
| PostgreSQL + `pgvector` (HNSW) as the single store | **Preferred** |
| LiteLLM gateway + Open WebUI chat surface | **Preferred** |
| `nomic-embed-text` embeddings (BGE-M3 the alternative) | **Preferred** |
| Ingestion: retrieval framework vs pure-custom | **Open** |
| Model roster and local/hosted mix | **Open** |

Everything marked **Preferred** or **Open** is an agent-side or implementation
detail — replaceable without touching the **Locked** rows, which *are* the
architecture.

### Proposed stack

A single Ubuntu host running an owned knowledge store, a model-routing gateway,
a chat surface, and a set of MCP servers that give the agent structured access
to the corpus. Every layer is open-source or an open protocol, so no piece is a
lock-in point:

```
Ubuntu 24.04 LTS  (dedicated host is the end-state; co-located w/ prod OK to bootstrap)
│
├── PostgreSQL + pgvector        # system of record — knowledge + embeddings (HNSW)
│
├── Ingestion pipeline           # deterministic, agent-independent; vector layer only
│     reference corpora → structure-aware chunk → embed → upsert (+ provenance)
│
├── Embeddings                   # nomic-embed-text (768-dim, CPU-friendly)
│                                #   via Ollama or routed through LiteLLM
│
├── LiteLLM                      # model-routing gateway (one API, many models)
│
├── Open WebUI                   # chat / query surface over the gateway
│
├── MCP servers                  # structured tool access for the agent layer
│   ├── Filesystem               #   read the local corpus
│   ├── Git / GitHub             #   read governed repos (WPs, ECs, DECISIONS)
│   ├── PostgreSQL               #   query the knowledge base + game data
│   ├── Browser                  #   fetch external references
│   └── Knowledge-query          #   hybrid (vector + full-text) retrieval,
│                                #     the shared retrieval surface every agent uses
│
├── Reverse proxy + auth gate    # Caddy/Nginx auto-HTTPS; Open WebUI auth or
│                                #   Cloudflare Access / Authelia in front
│
└── Knowledge repositories
    ├── Engineering              # consulting: wells, bridges, Caltrans, GIS, cost data
    ├── Legendary Arena          # WPs, ECs, DECISIONS, ARCHITECTURE, wiki
    ├── Barefoot Betters         # formulation research, ingredient studies, blog
    ├── Governance               # cross-project rules, checklists, playbooks
    └── Research                 # reference material, notes, sources
```

> **Preferred deployment: its own host — but co-location is fine to bootstrap.**
> A **dedicated host is the end-state target**: a chat surface, model gateway, and
> vector DB next to the live game server (`api.legendary-arena.com`,
> [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md)) is a resource-contention
> and attack-surface concern. But **co-location on the same host is acceptable
> during the bootstrap phase**, while infrastructure is small and operator-managed,
> as long as the brain stays *logically* separate — process isolation, its own
> credentials, independent backups, clear service boundaries. Physical separation
> is a scaling/risk decision (v1 = one host; v2 = split), not a prerequisite for
> first deployment. Locked by [D-24341](../docs/ai/DECISIONS.md#d-24341).

> **The endgame AI coach is the first real LLM surface — and the migration
> proof point.** The post-game analysis on the endgame report card (the
> "coach" that grades hero selection, purchases, and luck-of-the-draw) shipped
> 2026-08-23/24 as WP-594 (server, [D-24403](../docs/ai/DECISIONS.md#d-24403))
> + WP-595 (client, [D-24404](../docs/ai/DECISIONS.md#d-24404)) — the platform's
> first production LLM-powered feature. It is exactly the kind of surface this
> gateway exists for, but today it **bypasses the gateway**: the server calls the
> Anthropic Messages API directly over `fetch`, with the model id (`claude-sonnet-5`)
> hardcoded at the wiring and a per-model workaround (`thinking: { type: 'disabled' }`
> plus a fixed output budget) baked into `apps/server/src/coach/coachClient.ts`.
> That coupling runs against **Model Independence** (*replace the model without
> migrating the knowledge*): swapping the coach's model today means editing engine
> code, not routing config. Routing the coach through **LiteLLM** fixes both halves
> — the model becomes a gateway config change, and per-model quirks (disable
> extended thinking / cap the output for a bounded structured-JSON response) live
> at the routing layer that owns model-specific behaviour, not hardcoded in a
> feature's client. The concrete quirk is instructive: Sonnet 5 runs adaptive
> extended thinking by default and those thinking tokens drew down `max_tokens`,
> so every real coach call returned `coach_unavailable` until the EC-629 hotfix
> (PR #1599, 2026-08-24) disabled thinking — precisely the kind of model-specific
> config the gateway should absorb, so a future model swap does not re-inherit
> the last model's workaround. Migrating this call behind a model-routing layer
> is the first end-to-end demonstration of the replaceable-agent claim on live
> traffic. A code Work Packet carries the actual move; the options and tradeoffs
> — an in-server routing shim now vs. a hosted or self-hosted LiteLLM gateway
> later — are laid out in
> [Gateway routing for the endgame coach](#gateway-routing-for-the-endgame-coach-decision-sketch).
> This page records the intent, not the mechanism.

### Retrieval strategy: navigation first, vector where it earns its keep

The single most important scoping decision: **this is a mostly-Markdown system
with a small vector layer, not a vector-first one.** Roughly **90% navigable
structured Markdown / 10% semantic vector search.** The discipline is to build
the simplest retrieval that answers the actual questions — most of which
("what did we decide for X?", "which Work Packet governs Y?", "what was the
Caltrans code?") are *document-lookup* problems, not semantic-similarity
problems.

Two tiers, chosen per corpus:

- **Exact / navigational retrieval — the default.** Governed, structured,
  context-sensitive documents (`DECISIONS.md`, Work Packets, Execution Contracts,
  design docs, Disaster Recovery runbooks, the Architecture Inventory, this wiki)
  are reached by **direct reference, grep, and per-domain index navigation** via
  the Filesystem / Git / PostgreSQL MCP servers — **not** chunked and embedded.
  These docs are exactly the ones where losing surrounding context corrupts the
  answer, and the corpus already carries its own cross-references. Vectorizing
  them trades away the determinism and auditability the governance corpus exists
  to provide.
- **Semantic / vector retrieval — the minority layer.** Reserve embeddings for
  **high-volume, unstructured reference** where exact lookup does not scale:
  meeting transcripts, large research archives (studies, standards PDFs,
  long-form notes), and email/reference material. Here semantic recall genuinely
  earns its keep; these are *reference*, never governance or decision records.

> **Do not vectorize governance.** `DECISIONS.md`, Work Packets, Execution
> Contracts, and runbooks are retrieved exactly, never chunk-embedded — their
> value is the exact, whole-context wording (a **Locked** decision, above).

**Query resolution flow — simplest method that answers, first.** A query walks
the tiers in ascending cost/uncertainty and stops at the first that answers:

```
Question
   │
   ▼
Known document?  ──yes──►  open it directly       (1. direct reference)
   │ no
   ▼
In an INDEX.md?  ──yes──►  follow its links        (2. index navigation)
   │ no
   ▼
Full-text hit?   ──yes──►  return sources          (3. grep / Postgres FTS)
   │ no
   ▼
Vector hit?      ──yes──►  return sources          (4. semantic recall)
   │ no
   ▼
Web search                                         (5. last resort)
```

Escalating past a tier is a signal the earlier tier is thin (a missing index
entry, an unrecorded decision) — worth fixing, not just routing around.

### Ingestion and retrieval

The ingestion pipeline is a **deterministic, agent-independent** stage that feeds
the **vector layer only** (the minority tier above): it walks the designated
reference corpora, splits them structure-first, embeds each chunk, and upserts
into Postgres with provenance. Governed Markdown is *not* run through it — it is
navigated in place. Keeping ingestion outside any particular agent is what
preserves *Single Source of Truth* — the vector index is fed by a tool the
operator runs, not by whichever model happens to be answering questions today.

Design characteristics:

- **Structure-aware chunking.** Split on Markdown headers so a chunk keeps its
  header path (`# Study` → `## Method` → …) as metadata, with an optional size
  cap to bound chunk length. A size-only splitter would shred that structure.
- **Incremental by content hash.** A chunk whose source is unchanged is skipped,
  so day-to-day re-ingestion is cheap; a full rebuild of the vector index from
  the source corpus is always possible and is the recovery path
  (*Deterministic Recovery*).
- **Provenance columns on every chunk** — `source_path`, `domain`,
  `content_hash`, `git_commit`, `header_path`, `ingested_at`. This is what makes
  *Auditability* real: a citation resolves to the exact file and heading it came
  from.
- **Hybrid retrieval.** Within the vector layer, dense similarity plus Postgres
  full-text search, with metadata filters (restrict to a domain or a source set)
  running as SQL.

**Framework vs custom is a deliberate tradeoff.** A retrieval framework
(LlamaIndex is the natural fit — it has structure-aware Markdown parsing, a
mature `pgvector` store with hybrid search, and built-in incremental tracking)
buys those pieces off the shelf at the cost of framework weight and version
churn. A pure-custom pipeline (a Postgres client, an embedding client, a header
splitter) is lighter and fully under operator control. Either satisfies the
principles; the choice is convenience vs minimalism, and it is recorded in
[Open Questions](#open-questions).

> **The executable pieces live in the runbook, not here.** Ingestion script,
> schema DDL, `docker-compose`, and provisioning are execution instruction the
> wiki [SCHEMA](SCHEMA.md) keeps off entity pages; they live in
> [`AI_SECOND_BRAIN_RUNBOOK.md`](../docs/ops/AI_SECOND_BRAIN_RUNBOOK.md). This
> page stays the design record.

### Knowledge extraction (operator-triggered)

Alongside the deterministic vector-ingestion pipeline sits an explicit,
**operator-triggered** extraction loop — the practical mechanism for turning raw
source material into structured knowledge, and the thing usually meant by "have
the AI read this and file it." Where the ingestion pipeline feeds the vector
layer in bulk, this loop produces *authored* notes one source at a time:

1. The operator supplies source material — a transcript, meeting notes, a
   research PDF, a video summary.
2. A purpose-specific skill produces clean, cited, linked Markdown that preserves
   provenance (source, date, domain), in the domain's own voice profile.
3. The output is written as **Transient or Reference** class only — never
   Authoritative.
4. Optionally, the relevant domain `INDEX.md` gains a link and a one-line
   description, so the note is reachable by navigation.
5. **No automatic promotion to Authoritative ever occurs** — promotion stays a
   deliberate human act (see
   [Promotion](#knowledge-governance-how-knowledge-enters-moves-and-earns-authority)).

It is never an always-on daemon: it runs only when invoked, and its output is
subject to the same quality gates and promotion rules as any other artifact. This
is the sanctioned *manual* way knowledge enters — the mirror image of
[No always-on autonomous ingestion](#scope-boundaries-what-this-deliberately-is-not),
which rules out the *automatic* way for exactly the same reason: the operator,
not a background process, decides what earns a place in the corpus.

### Knowledge-query MCP surface

Every agent reaches the vector layer through **one shared MCP server**, not by
talking to Postgres directly. Keeping the interface stable and model-agnostic is
what makes the replaceable-agent claim real: swapping Claude Code for another
model, or adding Open WebUI beside it, does not change how knowledge is
retrieved. The contract is deliberately narrow:

- **Inputs.** A natural-language query, an optional domain filter, an optional
  source-path prefix, a top-*k*, and a hybrid-vs-dense-only flag.
- **Behaviour.** Hybrid retrieval (dense similarity + Postgres full-text) with
  metadata filters applied as SQL; returns matching chunks with their full
  provenance.
- **Citation shape.** Every result carries `source_path`, `header_path`,
  `domain`, `content_hash`, and a short excerpt — so the calling agent can ground
  its answer and the operator can verify it.
- **Guarantees.** Read-only; never mutates the store; and **never returns the
  governance documents that were deliberately kept out of the vector layer** —
  those are reached by exact/navigational retrieval, not this surface.

Open WebUI retrieves from the *same* knowledge store — either by calling this
knowledge-query server or via its own RAG features against the identical Postgres
table. Either way the data and provenance are the same; the chat surface stays a
replaceable front-end, not a second source of truth.

### Vector and embedding strategy

For the minority vector layer only (governed docs are navigated, not embedded —
see [Retrieval strategy](#retrieval-strategy-navigation-first-vector-where-it-earns-its-keep)):

- **`pgvector` with HNSW indexes** is the recommended default. It keeps the
  embeddings inside the same Postgres instance as the knowledge — one store, one
  backup, one restore — rather than adding a separate vector database to own.
- **`nomic-embed-text`** (768-dimension, Apache-2.0, strong CPU performance,
  long context) is a sound default embedding model for a CPU-only host.
  **BGE-M3** is the alternative when higher-quality or multilingual retrieval is
  wanted.
- **Open formats only in the store.** Never persist a proprietary,
  single-vendor-readable embedding format into the knowledge base — that would
  quietly break *Model Independence* (see Edge Cases).
- **Multimodal is a later addition, not a v1 concern.** High-volume reference that
  is *visual* — diagrams, scanned standards PDFs, figure-heavy studies — can later
  be served by a vision-capable model (efficient 2026 multimodal models such as
  Nemotron Nano Omni run on the same unified-memory host class) and/or multimodal
  embeddings, all against the *same* single Postgres store. It changes neither the
  navigation-first core nor the one-store rule, so it stays out of the pilot until
  a real visual-reference corpus justifies it.

The vector store is a single Postgres table (or one per domain if growth later
demands it). The columns below are the **design invariant** the eventual DDL must
satisfy — they are what make *Auditability* and *Deterministic Recovery* real;
the actual DDL lives in the future runbook, not here:

| Column | Purpose |
|---|---|
| `id` | Stable node identifier |
| `embedding` | `vector(768)` (nomic-embed-text) |
| `content` | Chunk text |
| `source_path` | Repo-relative (or absolute) path to the source |
| `domain` | Engineering / Legendary Arena / … |
| `header_path` | Markdown header trail (`# A → ## B → …`) |
| `content_hash` | SHA-256 of the source chunk at ingest time |
| `git_commit` | Commit that produced the source (when Git-backed) |
| `ingested_at` | Timestamp of the upsert |

An HNSW index rides the `embedding` column; `domain` and `source_path` carry
plain indexes for fast metadata filtering; full-text search uses Postgres's
existing `tsvector` facilities.

### Hosting and security posture

- **Host.** An **unmanaged Ubuntu 24.04 VPS** with full root — a dedicated one is
  the end-state, though the bootstrap build may co-locate on the existing box with
  isolation (see the deployment callout above). The architecture locks **ownership
  and open formats, never a provider** — so the vendor is a shopping decision, not
  an architectural one. As of 2026-08, candidates in this class include **NameHero**
  (US-centric, ~$7/mo for the 8 GB tier, familiar support), **Hetzner Cloud**
  (often the best price/performance for a self-hosted Postgres + Docker stack, US
  and EU regions), and **DigitalOcean / Vultr / Linode** (pricier but strong
  snapshot/networking ecosystems and low friction when leaving a PaaS like
  Render). Compare current plans before committing rather than treating any one as
  the default; and because a durable knowledge store inherits the Disaster
  Recovery posture, weight **reliability and your own rehearsed backups over the
  cheapest promo price** — several budget VPS lines bundle no backups and show
  clusters of short outages, so the recovery story stays the operator's to own
  (which this architecture already requires). A roughly **8 GB RAM / 2 vCPU** box
  comfortably runs Postgres + LiteLLM + Open WebUI + CPU embeddings; step up to
  the 16 GB class if a small local model is kept resident or more agents run
  concurrently.
- **Local vs hosted models — two host classes.** A plain VPS line has no GPU, so
  on that class treat **local LLMs as optional and CPU-only (small models)** and
  lean on **hosted models via LiteLLM** for reasoning quality. But the dedicated
  end-state need not be a plain VPS: a **unified-memory accelerated box** — the
  2026 NVIDIA DGX Spark / GB10 class, ~128–256 GB of LPDDR5 shared between CPU and
  GPU over a fast interconnect — now runs large quantized mixture-of-experts models
  (DeepSeek-class) *locally* at usable speed (order tens of tokens/second, still
  usable at 100k-plus context) for a fraction of a discrete multi-GPU cluster's
  cost. That is what makes the "route sensitive queries to a local model"
  guidance (Edge Cases) a real quality option, not just CPU-scale fallback.
  **NVFP4** (and similar high-quality 4-bit schemes) is the practical
  quantization sweet spot — it holds model coherence far better than lower-bit
  quants. Either way, embeddings stay `nomic-embed-text` / BGE-M3 on CPU; the
  *inference* model is the variable, and swapping it stays a LiteLLM config
  change, not a data migration (*Model Independence*). External confirmation of
  this price/quality shift is in [References](#references) (Level1Techs, 2026-08).
- **Exposure.** A Caddy or Nginx reverse proxy with automatic HTTPS; Open WebUI's
  own auth, or Cloudflare Access / Authelia in front of it. The same host
  hardening the lab already documents — UFW, Fail2Ban, SSH-key-only
  ([Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md)) — applies here.
- **Secrets stay on the owned host, scoped per server.** Model API keys,
  Postgres credentials, and MCP tokens live only on this box. Each MCP server
  gets its **own least-privilege credential** — the knowledge-query and Postgres
  read servers hold a read-only DB role, the filesystem server is confined to the
  allowed corpus paths — so a compromised or misbehaving connector cannot exceed
  its brief. This is *Permissions Beat Prompts* at the credential layer.

### Knowledge repositories

The corpus is organized by domain. Each domain is a set of Markdown/Git sources
that the MCP layer can read and the vector store can index:

| Domain | Representative sources |
|---|---|
| Engineering | Well and bridge projects, Caltrans research, cost databases, GIS workflows |
| Legendary Arena | Work Packets, Execution Checklists, `DECISIONS.md`, architecture docs, this wiki |
| Barefoot Betters | Formulation research, ingredient studies, blog references |
| Governance | Cross-project rules, lint checklists, operator playbooks |
| Research | Reference material, notes, cited external sources |

The Legendary Arena governance corpus is the best-defined domain today: the
Work Packets, Execution Checklists, `DECISIONS.md`, and this wiki are already
structured, cross-referenced Markdown — exactly the shape a knowledge base
wants. The other domains would be organized into the same form as their material
is brought in.

**Navigation is by per-domain index, not search.** Each domain (and each project
within it) carries an `INDEX.md` that links its constituent documents — e.g. an
`Engineering/Usona/INDEX.md` pointing at the cost estimate, the applicable codes,
survey, environmental, and risk register. An agent navigates these indexes the
same way it navigates this wiki's own [INDEX.md](INDEX.md) — following links
through structured Markdown, which models do extremely well. Routing (which
domain a question belongs to) plus index navigation covers the large majority of
retrieval; the vector layer only catches what index navigation cannot.

Navigation-first only works if the index discipline is consistent. Every domain
root and every significant project folder carries an `INDEX.md` that: **lists**
its authoritative documents with one-line descriptions and relative links;
**groups** entries by role (decisions, execution, reference, risk, …) once the
set is large; **never duplicates** content — it only points; and is **kept under
the same review discipline** as the documents it indexes. An agent begins most
lookups by reading the relevant `INDEX.md` and following links, exactly as a
human operator navigates this wiki.

**Local Markdown is the first-class format.** The corpus is portable Markdown in
operator-controlled repositories. A local viewer/editor (e.g. Obsidian) may be
used as a convenience layer over those files, but it is **never the system of
record** — Git, the wikis, and PostgreSQL remain the durable sources. The point
is local Markdown, not any one app's workflow.

**Voice is split by domain, not universal.** Each domain carries its own tone
profile — engineering-professional, Legendary Arena product, Barefoot Betters
wellness, governance-audit-grade — so a skill drafting in one domain does not
bleed marketing tone into a technical or governance document. The profiles live
as small, version-controlled Markdown files inside each domain (or a shared
`voices/` folder at the knowledge root); a skill loads the one for the domain it
is writing in by name and never invents tone — voice stays under the same
ownership and review discipline as the rest of the corpus.

### Knowledge governance (how knowledge enters, moves, and earns authority)

Storage, retrieval, and backup are covered above; this is the missing axis —
*how knowledge enters the system, is promoted, and leaves.* Without it the corpus
drifts into `research-old/ research-final/ research-revised/` five years on.

**Corpus classes.** Every item is one of three classes, and the class decides how
it is retrieved — this is the same navigation-vs-vector split, stated as a
property of the *content* rather than the query:

| Class | Examples | Retrieval |
|---|---|---|
| **Authoritative** | Decisions, Work Packets, ECs, runbooks, indexes | Navigation / exact only — **never vectorized** |
| **Reference** | Research PDFs, transcripts, long-form notes | Vectorized (the minority layer) |
| **Transient** | Inbox captures, scratch files, session outputs | Not ingested at all |

**Lifecycle.** `Capture → Normalize → Store → Reference → Review → Archive`. The
rules that keep it honest: a **raw capture is not authoritative**; a normalized
note **cites its source artifacts**; **archived material stays searchable** (it is
demoted, not deleted); and **deletion is exceptional and documented** — the
default is archive, not remove.

**Promotion.** Authority is earned by stage, never assumed:
`Raw Capture → Research Note → Referenced Artifact → Authoritative Record`. **Only
the final stage** may become a Decision, Work Packet, EC, runbook, or index entry.
This is the guard against the AI blurring a temporary finding with policy — a
transcript summary is Reference, not a decision, until it is promoted deliberately.

**Quality gates.** A knowledge artifact is **governed** only if all hold: its
**source** is identified, a **last-updated** date is present, a **domain** is
assigned, it is **reachable from an `INDEX.md`**, its **links resolve**, and its
**ownership** is known. Anything failing a gate is `unmanaged` — findable, but not
citable as governed knowledge. These gates are what make *Auditability* a check
rather than an aspiration, and they are exactly the kind of binary rule a
`checks/`-bearing skill (below) can enforce.

### The agent layer is replaceable

The architectural payoff is that every agent-side component is disposable while
the knowledge base is not:

| Component | Role | Replaceable? |
|---|---|---|
| Claude Code | Primary coding / reasoning agent | ✅ Yes |
| Open-weights model (local) | Offline / private inference | ✅ Yes |
| Hosted model (GPT / Gemini / Grok) | Alternate reasoning provider | ✅ Yes |
| LiteLLM gateway | Model routing | ✅ Yes |
| Open WebUI | Chat surface | ✅ Yes |
| **PostgreSQL knowledge base** | **System of record** | ❌ **No — this is the permanent layer** |

Because the models reach the knowledge only through MCP and the gateway, a model
swap is a configuration change, not a data migration. The corpus never moves.

### Gateway routing for the endgame coach (decision sketch)

The [endgame coach](#proposed-stack) is named as the first proof point of the
replaceable-agent claim — but "route it through LiteLLM" is not a single option,
it is a small decision, because the coach runs on the **Render game server**
(`apps/server`, `api.legendary-arena.com`), *not* on the brain host. Two facts
set the shape of the choice:

- **The call is fail-soft and post-game.** Any error returns `coach_unavailable`
  and the endgame card renders without the coaching ([D-24403](../docs/ai/DECISIONS.md#d-24403));
  it fires after the match, never inside it. So the reliability/latency bar is
  **low** — a slow or down gateway degrades one optional panel, it never breaks a
  match. That *widens* the option set rather than narrowing it.
- **The server is Node/TypeScript; LiteLLM's in-process library is Python.** The
  Node server can therefore consume LiteLLM only as a **proxy** (an HTTP
  endpoint) or lean on a **hosted** gateway — never the library in-process. An
  in-server "shim" is hand-written Node, *not* LiteLLM.

The options, cheapest first:

| Option | New infra to run | Model swap w/o code change? | Per-model quirks out of `coachClient.ts`? | Best when |
|---|---|---|---|---|
| **A. Status quo** — direct Anthropic, model hardcoded | none | ❌ | ❌ | never the end-state; it is the thing being replaced |
| **B. In-server routing shim** — a small Node module owns the model id + per-model config (thinking / output budget), read from env | none | ✅ (env / config) | ✅ | *now* — one LLM surface; lowest cost; delivers the principle with no infra |
| **C. Hosted gateway** (e.g. OpenRouter) | none (external dependency) | ✅ | ✅ | you want a real gateway with zero ops and accept a third party in the path |
| **D1. Self-hosted LiteLLM on Render**, beside `apps/server` | one small service, co-located | ✅ | ✅ | a second LLM surface appears and you want ownership + cost control near the server |
| **D2. Self-hosted LiteLLM on the brain host** (NameHero) | one service, cross-host | ✅ | ✅ | the AI Second Brain platform is built and already runs the gateway |

**Recommendation.** Take **B now.** It is the model-independence *principle*
(model as config; quirks off the feature client) at the cost of a small, testable
Node module and no new infrastructure — the right size for a single LLM surface.
Promote to a **real gateway (C or D)** only when a *second* LLM surface appears,
or the brain platform is built and already runs one; that is when a shared
gateway earns its operating cost. If self-hosting LiteLLM for the coach, prefer
**D1 (co-located on Render)** over **D2 (the brain host)**: even fail-soft,
pointing the live game server at the brain host couples two things the
architecture deliberately keeps separate (see
[Co-hosting during bootstrap](#edge-cases)), for no benefit the coach needs.
LiteLLM on the brain host is for the *brain's* agents, not for a game-server
feature reaching across the network.

> **This does not change the Locked architecture.** The platform's gateway choice
> (LiteLLM) stays a **Preferred** row; this sketch is about *one app surface's*
> routing, deferred to a code Work Packet. The proof-point claim holds under every
> option B–D — the coach's model becomes swappable without an engine edit.

### Operating discipline

The knowledge base is only half the platform; the other half is *how work runs
against it*. The operating model is a repeatable loop rather than one-shot
prompting — **Plan → Build → Verify → Improve** — which maps onto the repo's
existing Work Packet / Execution Contract / gate / acceptance-criteria discipline:

1. **Plan** with routed context (goal, authoritative sources, non-goals, risks,
   acceptance criteria) before a substantial task begins.
2. **Build** — the AI drafts or executes within those constraints.
3. **Verify** against deterministic checks or a reviewable verification report;
   work is not "done" until it passes.
4. **Improve** — every failure (a hallucination, a missed file, a dropped
   caveat) becomes a durable upgrade to a rule, check, template, or skill.

The operator's role in that loop is **product manager, not typist**: the operator
defines intent, boundaries, authoritative sources, and what success looks like;
the AI proposes and executes within them. Seven operating principles govern the
loop — companions to the ten architecture principles above, aimed at *how work is
conducted* rather than *how knowledge is stored*:

- **Plan Before Delegation.** No substantial AI task begins without a written
  goal, context, constraints, and acceptance criteria.
- **Verification Is Required.** AI work is complete only when it passes
  deterministic checks or produces a reviewable verification report.
- **Context Must Be Routed, Not Dumped (progressive disclosure).** The system
  tells the AI where to look (routing + per-domain indexes) and loads detailed
  procedures only when needed; it does not blindly front-load all history,
  decisions, tool schemas, and preferences — the
  [retrieval strategy](#retrieval-strategy-navigation-first-vector-where-it-earns-its-keep)
  stated as a rule.
- **Every Failure Upgrades the System.** Bugs and bad outputs become improvements
  to rules, skills, templates, or checks — the repo's scaffold-then-spec instinct
  applied to the brain itself.
- **Permissions Beat Prompts (hard rule).** Do not rely on an instruction like
  "never delete the database." Enforce boundaries with scoped credentials,
  blocked commands, hooks, and read-only access. A real boundary holds when a
  prompt is ignored or a model is swapped; an instruction does not.
- **Skills Over Monoliths.** Reusable capabilities are small, purpose-specific
  skills (each carrying only its own instructions, templates, examples, and
  verification checks), loaded on demand — not one giant prompt or an always-on
  agent. Each skill is independently inspectable and upgradable. A complete skill
  states its **purpose, inputs, outputs, examples, verification, and failure
  modes** — *a skill without verification is incomplete.* Prefer small
  deterministic CLI checks wrapped by a skill over a monolithic MCP server loaded
  wholesale — determinism and auditability over improvisation. Start with a few
  core skills, not a large template pack; a skill folder is itself a dependency.
  The declared v1 skill set lives in the
  [operator runbook](../docs/ops/AI_SECOND_BRAIN_RUNBOOK.md) (§8), not on this
  page, so the list has one home.
- **Read-Only Connectors First.** External services connect through read-only or
  narrowly-scoped interfaces by default. Write actions — sending email,
  publishing content, modifying DNS, deleting files, changing production data —
  require explicit operator review and a *separate* permission boundary. AI
  prepares, summarizes, compares, and recommends; it must not silently publish,
  send, approve, or govern. AI output is draft material until the operator
  reviews it.

**Context limits are respected with handoff documents.** No single AI session
carries a migration *and* a wiki rewrite *and* DR planning *and* code changes at
once — long context degrades. Work moves between focused sessions through written
handoffs (plan → implementation report → verification report → upgrade notes)
that live alongside the work they describe (a `handoffs/` folder or the relevant
project directory), each session owning one stage. Those handoffs are **Transient**
class (see [Knowledge governance](#knowledge-governance-how-knowledge-enters-moves-and-earns-authority)) —
retrieval targets while active, promoted only if a lasting record is warranted.

**The AI layers are added conservatively, simplest first** — reusable skills,
then deterministic verification checks, then hooks (starting with
dangerous-action blockers and session logging only), then subagents, with
multi-agent orchestration last, once the base is proven. Subagents are used for
**research and adversarial review** (fan-out search, edge-case hunting,
challenging assumptions), never as authorities that edit source-of-truth docs,
make governance decisions, or touch secrets, databases, or production. The
concrete templates, hook scripts, and skill definitions are build detail — they
live in the [operator runbook](../docs/ops/AI_SECOND_BRAIN_RUNBOOK.md), not on
this descriptive page.

**A local-first orchestration harness is a principle-compatible agent surface.**
Where a single skill is one capability, a self-hosted, MCP-native harness (the
open Turnstone project is a 2026 example) is the *supervisor* surface: it turns a
long structured specification into planned subtasks, runs them under a supervisor
model with tool use, and gates each result through risk/judge checks before
accepting it. That shape maps directly onto *Plan → Build → Verify → Improve*,
*Skills Over Monoliths*, and *Context Must Be Routed* — and because it is
self-hosted, speaks MCP (already in the [proposed stack](#proposed-stack)), and
enforces its gates in code rather than in a prompt, it satisfies *Permissions
Beat Prompts* while staying a fully replaceable front-end over the permanent
knowledge base. It does not relax the conservative stance above: the harness
still runs under *Human Authority* and *Verification Is Required*, and its
subagents stay limited to research and adversarial review, never authorities over
source-of-truth docs. This is the same replaceable-surface story the endgame
coach migration tells (see [Proposed stack](#proposed-stack)) — one level up,
at the orchestration layer.

**A minimal feedback surface makes the improvement loop real.** *Every Failure
Upgrades the System* only works if failures are captured somewhere durable. The
design intends a lightweight, reviewable record — query logs, citation failures
(a cited chunk that turned out wrong or missing), and verification-report
outcomes — that the operator periodically reads to spot missing rules, checks, or
templates. It is an operator-reviewed log, not an auto-applied learning loop; the
capture format is build detail for the Work Packet.

### Persistent context files

Every substantial agent session loads a small, version-controlled set of
high-signal Markdown files that give the agent its *operating context* — identity
and non-negotiable rules, current priorities, routing guidance, and how knowledge
earns authority. They are the working analogue of the per-domain `INDEX.md` files
one level up: where an index routes to *documents*, these route the *agent's own
posture*. Typical contents:

- Root identity and non-negotiable operating rules
- Current active Work Packets / priorities
- Domain routing guidance (which domain owns a question)
- The promotion discipline — how knowledge moves Transient → Reference →
  Authoritative (see
  [Knowledge governance](#knowledge-governance-how-knowledge-enters-moves-and-earns-authority))

They are emphatically **not the system of record for facts** — they are operating
context, not knowledge, and never a competing truth store (*Single Source of
Truth*). Because they are ordinary Markdown under operator control, they inherit
the same ownership, auditability, and recovery properties as the rest of the
corpus, and the agent may update them only under the same review discipline that
governs any other change. This repo already runs this layer: `.claude/CLAUDE.md`,
the `.claude/rules/*.md` enforcement files, and the memory index are exactly
these files — high-signal, version-controlled, loaded every session, and edited
under review like any other governed artifact.

### Backup and recovery

Owning the knowledge base means owning its durability. The discipline mirrors
the engine's data-recovery posture in [Disaster Recovery](disaster-recovery.md):

- A backup captures the PostgreSQL knowledge base, the Markdown/Git corpus, and
  the MCP + gateway configuration.
- Recovery target is a fresh Ubuntu host: restore the knowledge base, re-point
  the agent layer at it, done.
- **Agent replacement must not require knowledge migration** — the same property
  that makes models swappable makes recovery a restore-and-reconnect, not a
  rebuild.
- A backup is proven only after a restore has actually been rehearsed on a
  throwaway host, exactly as the Ubuntu lab rehearses the game DB restore
  ([Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md), Restore drill).
- **The vector index is a derived artifact, not a source of truth.** A full
  rebuild of the index from the source Markdown corpus is always preferred over
  restoring a potentially stale index — the same "snapshots are derived records"
  instinct the engine applies to `G`. Only the source corpus and the knowledge
  DB's non-derived tables are true backup targets.

### Scope boundaries (what this deliberately is not)

The organizing discipline is *build the simplest thing that answers the actual
question* — organized Markdown plus routing plus a small vector layer gets most
of the value at a fraction of the complexity. Several capabilities are
deliberately out of scope until a real pain point justifies them:

- **No always-on autonomous ingestion.** The platform is not a daemon that
  perpetually vacuums Teams chats, email, and scratch notes into the knowledge
  base. Continuous unsupervised ingestion is the opposite of *deterministic,
  auditable, grepable* — it invites drift and pollutes the governed corpus with
  noise. Ingestion is an operator-run, reviewable step.
- **No general knowledge graph.** A sprawling entity graph
  (`Usona → culvert → survey monument → …`) is complexity without matching
  payoff. The one graph shape worth considering later is the **governance chain**
  the repo already implies — Work Packet → Execution Contract → Decision → Change
  → Release — because those links are real and queryable. Even that is a possible
  future, not a v1 goal (see [Open Questions](#open-questions)).
- **No full multi-agent orchestration yet.** Autonomous harnesses (self-driving
  agent loops, agent teams that act without review) come *after* the base — the
  Markdown/wiki store, skills, verification checks, and conservative hooks — is
  proven reliable, searchable, and recoverable. Building the orchestrator first
  adds risk and complexity before the foundation earns it.
- **Single-operator by design.** This is one operator's brain — not a
  multi-tenant service, a shared team knowledge base, or a public-facing product.
  Multi-user collaboration, tenancy isolation, and public sharing are out of
  scope; naming that here keeps them from creeping in as implicit requirements.

**It is also not a category of product it will be mistaken for.** The platform is
**not** a CRM, a project-management tool, a chat archive, a social-media
scheduler, a permanent email archive, a replacement for the source systems it
reads, or a replacement for Git. It indexes and reasons over knowledge that lives
authoritatively elsewhere; it never becomes the operational system of record for
any of those. Naming the anti-goals explicitly is what stops "could it also just…"
requirement creep.

### Pilot scope (recommended first vertical)

Start narrow — this names *what* to build first, not *how* (the build steps live
in the [operator runbook](../docs/ops/AI_SECOND_BRAIN_RUNBOOK.md)).

> **The gating prerequisite is a corpus census.** The architecture assumes the
> corpus exists; the first real deliverable is *discovering* it. Before any
> ingestion, the build needs to know **where every source actually lives** and
> how each is classified — domain, authority class (Authoritative / Reference /
> Transient), ingestion disposition (navigated / vectorized / not ingested), and
> backup class. Without that census, embeddings, routing, and ingestion are all
> guessing. **This inventory lives on the owned host, not this page** — it lists
> real client-project and formulation paths that the publishing rule in
> [Edge Cases](#edge-cases) keeps off any hosted surface. The Legendary Arena
> slice already exists as [Data & File Locations](data-file-locations.md); the
> census (a `KNOWLEDGE_INVENTORY` on the owned host) extends that same discipline
> to the Engineering, Barefoot Betters, and Research domains.

The first useful slice:

- **Navigation only** over the Legendary Arena governance corpus — `DECISIONS.md`,
  a small working set of Work Packets and Execution Contracts, and this wiki —
  reached exclusively via the Filesystem / Git MCP servers and per-domain
  `INDEX.md` files. It is the best-defined domain today and needs no vector layer.
- **One reference corpus** for the first vector layer — a single high-volume,
  unstructured archive (a research-PDF collection or a meeting-transcript set).
  That is the *only* material chunked and embedded in the pilot.
- **One agentic task with teeth** — a coding or **security / code / firmware
  review** task (config review, log-anomaly flagging, dependency audit) that must
  produce *citable* output grounded in the navigated corpus and a *verification
  report*. It is the first end-to-end exercise of the agent layer, and security
  review in particular is a high-value, low-risk fit: it reasons over material
  that must stay on owned hardware, which is exactly why such queries route to a
  local model (see [Hosting and security posture](#hosting-and-security-posture)).

Everything else waits until the pilot has been used for real work, failures have
been captured (the feedback surface above), and the recovery path has been
rehearsed. Expanding domains or adding vector corpora is an explicit later
decision, not an automatic next step — the same *build the simplest thing that
answers the question* discipline as the scope boundaries.

### Success criteria

Design goals, not Work Packet acceptance — the marks that say the platform is
doing its job. The platform is successful when the operator can:

- **Locate any governed decision in under a minute** — via routing + `INDEX.md`,
  without semantic search.
- **Restore the entire corpus on a fresh host** from backups alone (the §9
  runbook drill), vector index rebuilt from source.
- **Swap the model or agent framework without migrating data** — a config change,
  not a data migration.
- **Answer a project-specific question with citations** that resolve to the exact
  source file and heading.
- **Onboard a new domain without an architecture change** — a new folder, its
  `INDEX.md`, and (if it has a reference corpus) an ingestion run; nothing else.

Each is observable, so "is the brain working?" is a check, not an opinion.

## Interactions

- **[Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md)** — the sibling infra
  page. It builds and hardens the host; this page describes knowledge services
  that would run on a host. The split follows the same instinct the rest of the
  repo uses: *how the box is built* and *what runs on the box* are separate
  documents.
- **[`docs/ops/AI_SECOND_BRAIN_RUNBOOK.md`](../docs/ops/AI_SECOND_BRAIN_RUNBOOK.md)**
  — the executable operator runbook this page is the design record for: provision,
  `docker-compose`, schema, ingestion, first skills, and the restore drill. This
  page defines *what and why*; the runbook is *how*.
- **[Disaster Recovery](disaster-recovery.md)** — the recovery discipline this
  platform inherits: two backup layers, rehearsed restores, honest
  recoverability verdicts. The knowledge base is another crown-jewel store that
  needs the same backup-and-drill treatment.
- **[Data & File Locations](data-file-locations.md)** — the locator map for
  where the Legendary Arena corpus already lives (card JSON, the `legendary.*`
  tables, R2 prefixes, docs). The knowledge base ingests from these locations
  rather than duplicating their ownership.
- **[Workspace Map](workspace-map.md)** — the three-surface rule (git / pCloud /
  hosted). A second brain adds a consumer that reads across all three, which
  sharpens the "which surface owns this?" question the map answers.
- **[Development Workflow](development-workflow.md)** — Claude Code as the
  develop-from-anywhere agent is the concrete, shipping instance of the
  "replaceable agent" layer described here.
- **The endgame AI coach (post-game analysis)** — the platform's first *product*
  LLM surface (WP-594/WP-595, shipped 2026-08-23/24), and the first test of
  **Model Independence** against live traffic. It ships wired direct to the
  Anthropic Messages API with the model hardcoded; routing it through the
  LiteLLM gateway (see the [Proposed stack](#proposed-stack) callout) is the
  model-independence proof point, deferred to a code Work Packet.

## Edge Cases

- **Co-hosting during bootstrap needs real isolation.** Running a model gateway,
  a chat surface, and a vector DB on the live game-server box adds attack surface
  and resource contention to a host whose job is serving matches. It is an
  accepted *bootstrap* configuration (D-24341), but only with genuine logical
  isolation — process/user isolation, separate credentials, independent backups,
  resource limits — never a casual co-tenant. A dedicated host remains the
  end-state; co-location is the temporary, deliberately-fenced start.
- **Publishing knowledge-domain detail on a gated-but-hosted surface.** This
  page names real consulting and product domains. The ewiki is behind
  Cloudflare Access, not fully public, but it is still hosted off-box. Keep
  domain listings at the representative level shown here; the actual corpus
  (client data, formulations) stays on the owned host, never in the wiki.
- **Vector search is non-deterministic — and that is fine here.** Unlike the
  game engine, this platform has no determinism invariant. Approximate-nearest-
  neighbour recall varying between runs is acceptable for a knowledge assistant;
  do not import the engine's determinism rules onto it.
- **Hardware and math-kernel differences cause small numerical variance — and
  cross-checks turn that into a feature.** The same model on different accelerators
  (differing GPU architectures/kernels, or CPU vs GPU) can produce subtly
  different token-level output. This platform has no determinism invariant, so
  that is acceptable; where an answer must be trusted, the mitigation is the one
  *Verification Is Required* already implies — run it through more than one model
  (or the same model on more than one backend) via the LiteLLM gateway and
  compare. That makes multi-model cross-checking a gateway-native verification
  technique, not a reason to chase bit-exactness.
- **Secrets management is the operator's now.** Model API keys, the Postgres
  credentials, and MCP tokens all live on the owned host. That is the point of
  ownership, but it means key rotation and least-privilege scoping become
  operator responsibilities, same as the self-hosted DB in the lab.
- **"Replaceable" only holds if nothing writes lock-in into the store.** If an
  agent were allowed to persist model-specific artifacts (proprietary embeddings
  that only one provider can read, a vendor's native memory format) into the
  knowledge base, the swap-freely property quietly breaks. The store must stay
  in open formats.
- **Over-vectorizing governance loses the context it exists to preserve.** It is
  tempting to embed everything for one uniform search surface. Chunk-and-embed on
  `DECISIONS.md`, Work Packets, or runbooks returns fragments stripped of their
  surrounding clauses — precisely the context a governance record depends on. Keep
  those on exact/navigational retrieval; the vector layer is for high-volume
  reference only (see [Retrieval strategy](#retrieval-strategy-navigation-first-vector-where-it-earns-its-keep)).
- **Hosted-model inference leaves the box, even though the store does not.**
  Leaning on hosted models via LiteLLM for quality means each query sends its
  retrieved context to a third-party provider — the *storage* is owned and local,
  but the *inference* is not. For sensitive domains (client engineering data,
  formulations) that tension is real; route those through a local CPU model, or
  scope what the knowledge-query MCP server will return to a hosted model.

## History

- **2026-08-11 — [D-24341](../docs/ai/DECISIONS.md#d-24341)** locks the AI Second
  Brain architecture and its governance vehicle (a standalone DECISIONS record +
  this ewiki page, not an engine Work Packet — the Ubuntu Lab Provisioning
  precedent). This page is its descriptive companion and stays `draft` until the
  platform is built.
- **2026-08-11 — navigation-first / do-not-vectorize-governance** established as
  the load-bearing retrieval decision: ~90% structured-Markdown navigation, a
  minority vector layer over high-volume reference only, and governance records
  reached exactly, never chunk-embedded. This is *why* the architecture looks the
  way it does — it protects the determinism and auditability of the governed
  corpus (see [Retrieval strategy](#retrieval-strategy-navigation-first-vector-where-it-earns-its-keep)).
- **2026-08-11 — build runbook drafted** at
  [`docs/ops/AI_SECOND_BRAIN_RUNBOOK.md`](../docs/ops/AI_SECOND_BRAIN_RUNBOOK.md),
  realizing the D-24341 deferral of the executable steps into an operator runbook
  (not an engine Work Packet). Drafted, not yet run.
- **2026-08-23/24 — first real LLM surface shipped: the endgame AI coach**
  (WP-594 server / [D-24403](../docs/ai/DECISIONS.md#d-24403), WP-595 client /
  [D-24404](../docs/ai/DECISIONS.md#d-24404)). It calls the Anthropic Messages
  API directly with `claude-sonnet-5` hardcoded and a Sonnet-5 `thinking:disabled`
  workaround (EC-629 hotfix, PR #1599, 2026-08-24) baked into `coachClient.ts` —
  so it does not yet honour **Model Independence**. Migrating it behind the
  LiteLLM gateway (model as config, per-model quirks owned by the routing layer)
  is named as the first live proof point of the replaceable-agent architecture
  (see the [Proposed stack](#proposed-stack) callout and Open Questions).
- **2026-08-24 — video review (confirmatory, no re-lock).** Reviewed Level1Techs'
  *"Getting the Same Results with Smaller 'Cheaper' Dual Sparks AI as the More
  Expensive Clusters"* (uploaded 2026-08-21; see [References](#references)). It
  demonstrates a dual DGX Spark / GB10-class unified-memory box (~$8–10k, ~256 GB
  unified LPDDR5) running a DeepSeek-class model in NVFP4 quantization producing
  results *largely comparable* to a ~7× more expensive quad RTX Pro 6000 cluster
  on agentic coding and specification tasks — the pricier cluster was ~7× faster
  but the cheaper box was sometimes preferred for documentation quality. This is
  confirmatory evidence for the core bet (*knowledge is permanent, agents are
  replaceable*) and for **Model Independence** (same model, different hardware,
  comparable outcomes), and it makes owned-hardware local reasoning economically
  attractive. It prompted design-record refinements only, all **Preferred** /
  **Open**: the accelerated unified-memory host option + NVFP4 note (Hosting;
  Open Questions 2–3), a local-first orchestration-harness example (agent layer),
  a security / firmware review use-case (Pilot scope), a multimodal-later note
  (vector layer), and a hardware-variance / multi-model cross-check note (Edge
  Cases). No **Locked** decision changed.
- **2026-08-24 — host-vendor survey (Preferred, vendor stays unlocked).** Made
  the VPS vendor an explicit shopping decision rather than an implied NameHero
  default: added Hetzner Cloud and DigitalOcean / Vultr / Linode as equal-class
  candidates, and the guidance to compare current plans and weight reliability +
  self-owned rehearsed backups over the cheapest promo price (Hosting; Open
  Questions 3). The architecture locks ownership and open formats, never a
  provider — so this is a **Preferred**-level refinement, not an architecture
  change.
- **2026-08-24 — coach gateway-routing decision sketched.** The options for
  giving the coach model-independence (status quo / in-server shim / hosted
  gateway / self-hosted LiteLLM, Render-co-located or on the brain host) and their
  tradeoffs are recorded in
  [Gateway routing for the endgame coach](#gateway-routing-for-the-endgame-coach-decision-sketch).
  Provisional path: the in-server shim now, a real gateway when a second LLM
  surface or the brain platform justifies one. Still deferred to a code Work
  Packet — no code changed.

## Open Questions

The architecture and governance vehicle are locked by
[DECISIONS.md D-24341](../docs/ai/DECISIONS.md#d-24341); what remains are
implementation choices, ordered below by decision urgency. The executable build
runbook now exists as
[`docs/ops/AI_SECOND_BRAIN_RUNBOOK.md`](../docs/ops/AI_SECOND_BRAIN_RUNBOOK.md)
(provision, `docker-compose`, schema, ingestion, first skills, restore drill), but
nothing there has been run yet — the page stays `status: draft` until the platform
is built.

1. **Ingestion: framework or pure-custom?** The design is settled (deterministic,
   structure-aware, incremental, provenance-rich); the implementation is not.
   *Decision criteria:* operator preference for minimal dependencies vs. speed to
   a first working pipeline, and tolerance for pinning and periodically reviewing
   a framework. LlamaIndex buys Markdown-aware parsing + hybrid `pgvector` +
   incremental tracking at the cost of framework weight and version churn; a
   pure-custom script (Postgres client + embedding client + header splitter) is
   lighter and fully operator-controlled. Record the choice in the Work Packet.
2. **Default model roster and local/hosted mix.** *Provisional default:* hosted
   models via LiteLLM for reasoning quality, `nomic-embed-text` local for
   embeddings, an optional small CPU-resident model for sensitive domains. *Now
   also open:* whether the dedicated host is a unified-memory accelerated box
   (Spark / GB10 class — see [Hosting and security posture](#hosting-and-security-posture))
   running a large quantized model (NVFP4-class 4-bit) locally at reasoning
   quality, which would keep sensitive-domain queries on the box without a quality
   penalty at the cost of a pricier host. The exact roster (which hosted models,
   whether a local model is kept warm, CPU-only vs accelerated) is open and
   host-size-dependent; LiteLLM stays the single routing surface so any of these
   is a config change, not a migration.
3. **Host sizing, vendor, and when to split off production.** A dedicated host is
   the end-state; v1 co-locates on the existing box (D-24341). The lower tier for
   the eventual dedicated box is an ~8 GB / 2 vCPU class unmanaged Ubuntu 24.04
   (NameHero, Hetzner, or DigitalOcean / Vultr / Linode are 2026-08 candidates —
   vendor is unlocked; compare current plans and weight reliability + owned
   backups, see [Hosting and security posture](#hosting-and-security-posture)) for
   a navigation-plus-vector brain that leans on hosted inference; the upper tier,
   if local reasoning quality on sensitive domains is wanted, is a unified-memory
   accelerated box (Spark / GB10 class — order $8–10k as of 2026-08 for a
   dual-unit setup) that keeps inference on the box. *Still open:* the vendor and
   cost ceiling, which tier to buy, and the **trigger to move off the shared host
   to its own** — resource contention with the game server, a resident local
   model, concurrent load, or a larger vector corpus.
4. **A governance-chain graph — later, if ever.** The Work Packet → Execution
   Contract → Decision → Change → Release chain is the one relationship graph with
   real payoff; a general knowledge graph is ruled out (see
   [Scope boundaries](#scope-boundaries-what-this-deliberately-is-not)). *Gate:*
   do not consider it until the navigation + vector base has been used for real
   work and the recovery path has been rehearsed.
5. **Give the endgame coach model-independence (first proof point) — by which
   route?** The coach ships wired direct to the Anthropic Messages API with
   `claude-sonnet-5` hardcoded and a Sonnet-5 `thinking:disabled` workaround baked
   into `coachClient.ts` (see [Proposed stack](#proposed-stack) and History). The
   options and tradeoffs — status quo / in-server shim / hosted gateway /
   self-hosted LiteLLM (Render-co-located or on the brain host) — are laid out in
   [Gateway routing for the endgame coach](#gateway-routing-for-the-endgame-coach-decision-sketch).
   *Provisional path:* a code Work Packet takes the **in-server routing shim**
   first (model + per-model quirks become config, no new infra), promoting to a
   real gateway (hosted, or self-hosted LiteLLM co-located on Render) only when a
   second LLM surface or the built brain platform justifies one. Deferred, not
   gated; blocks nothing earlier.

## References

- [DECISIONS.md D-24341](../docs/ai/DECISIONS.md#d-24341) — the architecture +
  governance-vehicle lock this page is the descriptive companion to.
- [`docs/ops/AI_SECOND_BRAIN_RUNBOOK.md`](../docs/ops/AI_SECOND_BRAIN_RUNBOOK.md)
  — the executable operator runbook (provision, `docker-compose`, schema,
  ingestion, first skills, restore drill) this page is the design record for.
- [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md) — the host-build sibling
  page (droplet hardening, Node/Postgres/Nginx stack, restore and DR drills).
- [Disaster Recovery](disaster-recovery.md) — the backup-and-restore discipline
  this platform inherits.
- [Data & File Locations](data-file-locations.md) — where the Legendary Arena
  corpus already lives (card JSON, `legendary.*` tables, R2, docs).
- [Workspace Map](workspace-map.md) — the three-surface storage rule the
  knowledge base reads across.
- [Development Workflow](development-workflow.md) — Claude Code as the shipping
  instance of the replaceable agent layer.
- [Level1Techs — *Getting the Same Results with Smaller "Cheaper" Dual Sparks AI
  as the More Expensive Clusters*](https://www.youtube.com/watch?v=tmcn1-jFLWY)
  (2026-08-21) — external confirmatory evidence that owned, unified-memory
  hardware (DGX Spark / GB10 class) can run large NVFP4-quantized models at
  reasoning quality, comparable to a ~7× costlier GPU cluster — making the
  *knowledge-permanent / agents-replaceable* bet cheaper to realize on owned
  hardware in 2026.
