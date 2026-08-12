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
last-reviewed: 2026-08-11
---

# AI Second Brain

> **Proposed architecture — not yet built.** This page records a *design
> intent*: a self-hosted knowledge platform where organizational knowledge is
> owned locally and durable, while the AI models and agent frameworks that read
> it stay swappable. No component described here is running yet. There is **no
> `DECISIONS.md` entry and no Work Packet** for it at this revision — so the page
> is `status: draft`, cites only artifacts that exist today, and marks every
> unbuilt claim as a plan, not a fact. When the platform is committed to, the
> governing decision and any executable runbook land in the appropriate repo
> first, and this page is flipped to cite them.
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

This page is the design record for that platform. It is a companion to
[Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md) — that page covers *how
the box is built and hardened*; this page covers *what knowledge-management
services would run on a box* and why they are shaped the way they are. Keeping
the two separate is intentional: infrastructure provisioning and knowledge
architecture drift at different rates and answer to different concerns.

## Mechanics

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

### Proposed stack

A single Ubuntu host running an owned knowledge store, a model-routing gateway,
a chat surface, and a set of MCP servers that give the agent structured access
to the corpus. Every layer is open-source or an open protocol, so no piece is a
lock-in point:

```
Ubuntu 24.04 LTS  (dedicated host — NOT the production api. box)
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

> **Runs on its own host — not co-located with production.** Putting a chat
> surface, a model gateway, and a vector DB next to the live game server
> (`api.legendary-arena.com`, [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md))
> is a resource-contention and attack-surface concern. The recommendation is a
> **dedicated, separately hardened host**; this is no longer weighed as an open
> question.

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
> Contracts, and runbooks are retrieved exactly, never chunk-embedded. This is
> the same instinct as the rest of the corpus: deterministic, auditable,
> grepable, binary. Chunk → embed → retrieve is the wrong tool for a record whose
> value is its exact, whole-context wording.

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

> **The executable pieces are not on this page.** The ingestion script, the
> Postgres schema DDL, a `docker-compose` for the stack, and the
> provision-and-deploy runbook are *execution instruction* — which the wiki
> [SCHEMA](SCHEMA.md) keeps off entity pages. When this platform is committed to,
> those land in a Work Packet / operator runbook that this page then cites; the
> page stays the descriptive design record.

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

### Hosting and security posture

- **Host.** A dedicated **unmanaged Ubuntu 24.04 VPS** with full root. As of
  2026-08, a NameHero unmanaged Cloud VPS is a candidate; the point is the
  *class* of host, not the vendor. A roughly **8 GB RAM / 2 vCPU** box
  comfortably runs Postgres + LiteLLM + Open WebUI + CPU embeddings; step up if a
  small local model is kept resident.
- **Local vs hosted models.** Standard VPS lines have no GPU, so treat **local
  LLMs as optional and CPU-only (small models)** and lean on **hosted models via
  LiteLLM** for reasoning quality. Embeddings run fine on CPU.
- **Exposure.** A Caddy or Nginx reverse proxy with automatic HTTPS; Open WebUI's
  own auth, or Cloudflare Access / Authelia in front of it. The same host
  hardening the lab already documents — UFW, Fail2Ban, SSH-key-only
  ([Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md)) — applies here.
- **Secrets stay on the owned host.** Model API keys, Postgres credentials, and
  MCP tokens live only on this box — the ownership the whole design is for.

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
the AI proposes and executes within them. Five operating principles govern the
loop — companions to the ten architecture principles above, aimed at *how work is
conducted* rather than *how knowledge is stored*:

- **Plan Before Delegation.** No substantial AI task begins without a written
  goal, context, constraints, and acceptance criteria.
- **Verification Is Required.** AI work is complete only when it passes
  deterministic checks or produces a reviewable verification report.
- **Context Must Be Routed, Not Dumped.** The system tells the AI where to look
  (routing + per-domain indexes); it does not blindly load everything — the
  [retrieval strategy](#retrieval-strategy-navigation-first-vector-where-it-earns-its-keep)
  stated as a rule.
- **Every Failure Upgrades the System.** Bugs and bad outputs become improvements
  to rules, skills, templates, or checks — the repo's scaffold-then-spec instinct
  applied to the brain itself.
- **Permissions Beat Prompts (hard rule).** Do not rely on an instruction like
  "never delete the database." Enforce boundaries with scoped credentials,
  blocked commands, hooks, and read-only access. A real boundary holds when a
  prompt is ignored or a model is swapped; an instruction does not.

**Context limits are respected with handoff documents.** No single AI session
carries a migration *and* a wiki rewrite *and* DR planning *and* code changes at
once — long context degrades. Work moves between focused sessions through written
handoffs (plan → implementation report → verification report → upgrade notes),
each session owning one stage.

**The AI layers are added conservatively, simplest first** — reusable skills,
then deterministic verification checks, then hooks (starting with
dangerous-action blockers and session logging only), then subagents, with
multi-agent orchestration last, once the base is proven. Subagents are used for
**research and adversarial review** (fan-out search, edge-case hunting,
challenging assumptions), never as authorities that edit source-of-truth docs,
make governance decisions, or touch secrets, databases, or production. The
concrete templates, hook scripts, and skill definitions are build detail — they
live in the future Work Packet, not on this descriptive page.

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

### Scope boundaries (what this deliberately is not)

The organizing discipline is *build the simplest thing that answers the actual
question* — organized Markdown plus routing plus a small vector layer gets most
of the value at a fraction of the complexity. Two capabilities are deliberately
out of scope until a real pain point justifies them:

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

## Interactions

- **[Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md)** — the sibling infra
  page. It builds and hardens the host; this page describes knowledge services
  that would run on a host. The split follows the same instinct the rest of the
  repo uses: *how the box is built* and *what runs on the box* are separate
  documents.
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

## Edge Cases

- **Co-hosting with production is a footgun.** Running a model gateway, a chat
  surface, and a vector DB on the live game-server box adds attack surface and
  resource contention to a host whose job is serving matches. Prefer a separate
  host or hard isolation; do not fold it onto `api.` casually.
- **Publishing knowledge-domain detail on a gated-but-hosted surface.** This
  page names real consulting and product domains. The ewiki is behind
  Cloudflare Access, not fully public, but it is still hosted off-box. Keep
  domain listings at the representative level shown here; the actual corpus
  (client data, formulations) stays on the owned host, never in the wiki.
- **Vector search is non-deterministic — and that is fine here.** Unlike the
  game engine, this platform has no determinism invariant. Approximate-nearest-
  neighbour recall varying between runs is acceptable for a knowledge assistant;
  do not import the engine's determinism rules onto it.
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

## Open Questions

- **Ingestion: framework or pure-custom?** The design is settled (deterministic,
  structure-aware, incremental, provenance-rich); the implementation is not.
  LlamaIndex vs a no-framework script is a convenience-vs-minimalism call, weighed
  in [Ingestion and retrieval](#ingestion-and-retrieval) but not made.
- **Which models, and local vs hosted mix?** The replaceable-agent principle
  says "any." The recommended posture is hosted models via LiteLLM for reasoning
  quality with CPU embeddings local; a resident small local model is optional and
  host-size-dependent. The specific default roster is not chosen.
- **Host sizing and vendor.** A dedicated separate host is decided; the exact VPS
  (an ~8 GB / 2 vCPU class box is the starting recommendation; NameHero unmanaged
  Ubuntu is a 2026-08 candidate) and the cost ceiling are not.
- **A governance-chain graph — later, if ever.** The Work Packet → Execution
  Contract → Decision → Change → Release chain is the one relationship graph with
  real payoff. Whether it is worth building on top of the Markdown + index layer,
  and when, is open; a general knowledge graph is ruled out (see
  [Scope boundaries](#scope-boundaries-what-this-deliberately-is-not)).
- **Governance transcription is pending.** There is no `DECISIONS.md` entry and
  no Work Packet for this platform. Until one exists, this page is a design
  record only and governs nothing — read it as intent, not as a built system.
  The buildable artifacts (ingestion script, schema, `docker-compose`, the
  provision-and-deploy runbook) belong in that Work Packet, not on this page.

## References

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
