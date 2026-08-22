# AI Second Brain — Build & Operate Runbook — Legendary Arena

> **Last updated:** 2026-08-11
>
> The **executable** companion to the descriptive ewiki page
> [AI Second Brain](../../wiki/ai-second-brain.md). That page and
> [`DECISIONS.md` D-24341](../ai/DECISIONS.md#d-24341) own the *design* — the
> architecture, principles, and boundaries. **This file owns the *build*:** the
> provisioning, `docker-compose`, schema, ingestion, first skills, and the
> backup/restore drill. Where the two ever disagree, the ewiki page + D-24341 win
> on design; this runbook is prescriptive only about *how* to realize that design.
>
> **This is a plan, not a rehearsed procedure.** Nothing here has been run yet.
> Treat every step as a first draft to be corrected on first execution, and fold
> observed corrections back into this file (the *Every Failure Upgrades the
> System* principle applies to the runbook itself).
>
> **Companion docs:** [`SERVER_REBUILD_RUNBOOK.md`](SERVER_REBUILD_RUNBOOK.md) and
> [Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md) own **host
> provisioning + hardening** — this runbook reuses that discipline rather than
> restating it. [`DISASTER_RECOVERY.md`](DISASTER_RECOVERY.md) owns the recovery
> philosophy this runbook's §9 mirrors.

---

## 0. What this is (read first)

- **Goal.** Stand up the self-hosted AI Second Brain — a mostly-Markdown
  knowledge store with a minority vector layer and a replaceable agent layer in
  front — and prove the pilot slice works. A dedicated host is the end-state; the
  bootstrap build may co-locate on the existing box (see the hosting note below).
- **Design source of truth.** [AI Second Brain](../../wiki/ai-second-brain.md)
  (descriptive) + [D-24341](../ai/DECISIONS.md#d-24341) (locked decision). Read
  those first; this runbook assumes them.
- **Scope of this runbook = the pilot** (ewiki *Pilot scope*): navigation-only
  over the Legendary Arena governance corpus, plus **one** reference corpus in the
  first vector layer. Expanding domains or corpora is a later, explicit decision —
  not part of this build.
- **Hosting: dedicated host is the end-state; bootstrap co-location is allowed.**
  A separate host from `api.legendary-arena.com` is the target (D-24341). During
  bootstrap the brain **may run on the existing box**, provided it stays
  *logically* separate — its own OS user + process isolation, its own DB role and
  credentials, independent backups, and resource limits so it cannot starve the
  game server. Split it onto its own host once contention, load, or a resident
  local model justifies it (ewiki *Hosting and security posture*).

> **Safety guardrails (non-negotiable — from the design record).**
> - **Read-only connectors first.** Every MCP server gets its own least-privilege
>   credential; write actions (send email, publish, delete, change prod) are not
>   wired in the pilot. *Permissions beat prompts.*
> - **Do not vectorize governance.** `DECISIONS.md`, Work Packets, Execution
>   Contracts, and runbooks are navigated/grepped, **never** chunk-embedded. Only
>   the single high-volume reference corpus is ingested (§5).
> - **Secrets stay on this host.** Model API keys, DB creds, and MCP tokens live
>   only on this box, scoped per server (§3, §7).
> - **The vector index is derived, not a source.** Never treat it as a backup
>   target; it always rebuilds from the source Markdown (§9).

---

## 1. Prerequisites

- [ ] **A host with full root** — an unmanaged Ubuntu 24.04 VPS (~8 GB RAM /
  2 vCPU class to start; NameHero unmanaged is a 2026-08 candidate). A dedicated
  box is the end-state; the bootstrap build may use the existing box **if** the
  brain is fenced off with its own OS user, DB role, backups, and resource limits
  (§0 hosting note).
- [ ] **Host hardened** per [Ubuntu Lab Provisioning](../../wiki/ubuntu-lab-provisioning.md)
  §1 — non-root user, SSH-key-only, UFW, Fail2Ban, unattended-upgrades. Do that
  first; this runbook starts from a hardened host.
- [ ] **Docker + Compose v2** installed (`apt install docker.io docker-compose-v2`,
  or Docker's official repo).
- [ ] **A corpus census (prerequisite zero)** — the inventory of *what knowledge
  exists and where*, before anything is ingested or routed. Use
  [`KNOWLEDGE_INVENTORY.template.md`](./KNOWLEDGE_INVENTORY.template.md) as the
  schema; fill the populated `KNOWLEDGE_INVENTORY.md` **on the owned host, not in
  this repo** — it carries real client-project and formulation paths that stay off
  any published or committed surface (same boundary as the ewiki page and `.env`
  secrets). Nothing below can be classified without it.
- [ ] **The knowledge corpus reachable on the host** — the Git repos to be
  navigated (this engine repo for the Legendary Arena governance corpus; others as
  they are organized) cloned read-only under `/data/knowledge/<domain>/`.
- [ ] **Hosted-model API key(s)** for reasoning quality via LiteLLM (e.g. an
  Anthropic key). Embeddings run locally, so no embedding key is needed.
- [ ] **A domain name** for the host if it will be exposed (e.g.
  `brain.<your-domain>`), or keep it Tailscale/VPN-only for the pilot.

---

## 2. Host layout

Everything the brain owns lives under two roots, so backup (§9) is two tar/dump
targets plus the DB:

```
/opt/second-brain/          # the stack: compose file, configs, skills
  ├── docker-compose.yml
  ├── .env                  # secrets — chmod 600, never committed
  ├── litellm.config.yaml
  ├── mcp/                  # MCP server configs (scoped per server)
  ├── ingest/              # the ingestion script + its config
  └── skills/               # the first core skills (§8)

/data/knowledge/            # the corpus (source of truth — mostly Markdown/Git)
  ├── legendary-arena/      # governed corpus — NAVIGATED, never embedded
  ├── research/             # the ONE pilot reference corpus — embedded (§5)
  └── <domain>/INDEX.md     # per-domain index (navigation discipline)
```

`/data/knowledge/` is read-only to the agent layer; only the operator-run
ingestion job and the operator writing notes ever change it.

---

## 3. The stack (`docker-compose.yml`)

One Compose project runs Postgres+pgvector, Ollama (local embeddings), LiteLLM
(model gateway), Open WebUI (chat surface), and Caddy (auto-HTTPS reverse proxy).
MCP servers are added in §6–§7. This is the design's *Proposed stack* made
concrete; adapt image tags and pin them.

```yaml
# /opt/second-brain/docker-compose.yml
services:
  db:
    image: pgvector/pgvector:pg16          # pin a digest in production
    environment:
      POSTGRES_USER: brain
      POSTGRES_PASSWORD: ${PG_PASSWORD}
      POSTGRES_DB: brain
    volumes:
      - db_data:/var/lib/postgresql/data
    restart: unless-stopped

  ollama:                                   # local, CPU embeddings (nomic-embed-text)
    image: ollama/ollama:latest
    volumes:
      - ollama_models:/root/.ollama
    restart: unless-stopped

  litellm:                                  # one API, many models
    image: ghcr.io/berriai/litellm:main-latest
    command: ["--config", "/app/config.yaml"]
    volumes:
      - ./litellm.config.yaml:/app/config.yaml:ro
    environment:
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    depends_on: [ollama]
    restart: unless-stopped

  openwebui:                                # chat / query surface
    image: ghcr.io/open-webui/open-webui:main
    environment:
      OPENAI_API_BASE_URL: http://litellm:4000   # route all model calls via the gateway
      OPENAI_API_KEY: ${LITELLM_MASTER_KEY}
      WEBUI_AUTH: "true"                          # built-in auth on
    volumes:
      - openwebui_data:/app/backend/data
    depends_on: [litellm]
    restart: unless-stopped

  caddy:                                    # auto-HTTPS in front of Open WebUI
    image: caddy:2
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
    depends_on: [openwebui]
    restart: unless-stopped

volumes:
  db_data:
  ollama_models:
  openwebui_data:
  caddy_data:
```

`Caddyfile` (one line does TLS + reverse proxy; or front the whole thing with
Cloudflare Access / Authelia and keep Caddy internal):

```
brain.<your-domain> {
    reverse_proxy openwebui:8080
}
```

Bring it up, then pull the embedding model into Ollama:

```bash
cd /opt/second-brain && docker compose up -d
docker compose exec ollama ollama pull nomic-embed-text   # 768-dim, CPU-friendly
```

`litellm.config.yaml` routes reasoning to a hosted model and embeddings to local
Ollama — the *hosted models carry quality, embeddings run local* posture:

```yaml
model_list:
  - model_name: reasoning                 # what agents call for reasoning
    litellm_params:
      model: anthropic/claude-opus-4-8    # swap freely — Model Independence
  - model_name: embed                     # local, CPU
    litellm_params:
      model: ollama/nomic-embed-text
      api_base: http://ollama:11434
general_settings:
  master_key: ${LITELLM_MASTER_KEY}
```

---

## 4. Vector-layer schema

Realizes the ewiki *Vector-layer data model* invariant. One table (split per
domain later only if growth demands). Governance docs are **never** rows here.

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE knowledge_chunk (
    id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    embedding    vector(768)   NOT NULL,          -- nomic-embed-text
    content      text          NOT NULL,          -- the chunk text
    source_path  text          NOT NULL,          -- repo-relative path to the source
    domain       text          NOT NULL,          -- 'research' in the pilot
    header_path  text          NOT NULL DEFAULT '',-- "# A > ## B > ..."
    content_hash char(64)      NOT NULL,          -- sha256 of the source chunk
    git_commit   text,                            -- commit that produced it (nullable)
    ingested_at  timestamptz   NOT NULL DEFAULT now(),
    tsv          tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

CREATE INDEX knowledge_chunk_embedding_hnsw
    ON knowledge_chunk USING hnsw (embedding vector_cosine_ops);
CREATE INDEX knowledge_chunk_domain      ON knowledge_chunk (domain);
CREATE INDEX knowledge_chunk_source_path ON knowledge_chunk (source_path);
CREATE INDEX knowledge_chunk_tsv         ON knowledge_chunk USING gin (tsv);

-- Least-privilege role the knowledge-query + Postgres MCP servers use (read-only):
CREATE ROLE brain_ro LOGIN PASSWORD :'ro_password';
GRANT CONNECT ON DATABASE brain TO brain_ro;
GRANT USAGE ON SCHEMA public TO brain_ro;
GRANT SELECT ON knowledge_chunk TO brain_ro;
```

`content_hash` drives incremental ingestion; the HNSW + GIN indexes serve the two
halves of hybrid retrieval; `brain_ro` is the *Permissions Beat Prompts*
credential the read servers get (§7).

---

## 5. Ingestion (the ONE pilot reference corpus)

Ingestion is a **deterministic, operator-run** job that feeds the vector layer
**only**, from the single pilot reference corpus (`/data/knowledge/research/`).
The governed corpus is *not* ingested.

**Framework vs custom is the open question (ewiki Open Questions §1).** Start
with whichever you prefer; the contract below is the same either way. A minimal
custom pipeline keeps it fully operator-controlled:

1. Walk `*.md` under the corpus root.
2. **Structure-aware chunk** — split on Markdown headers, carrying the header
   trail as `header_path`; apply a soft size cap (~800–1200 tokens) inside a
   heading. Never a size-only split.
3. **Skip unchanged** — compute `sha256(chunk)`; if a row with that `content_hash`
   exists, skip (incremental).
4. **Embed** each new/changed chunk via LiteLLM's `embed` model.
5. **Upsert** with full provenance (§4 columns).

Run it by hand (or on a cron / git webhook once trusted):

```bash
docker compose run --rm ingest --corpus /data/knowledge/research --domain research
```

> **Invariant:** the source Markdown is authoritative; the table is derived. A
> full rebuild (`--full`, drop + re-ingest) must always reproduce the index from
> source alone (§9).

If you adopt **LlamaIndex** instead: `MarkdownNodeParser` + `PGVectorStore`
(`hybrid_search=True`, `embed_dim=768`) + a `PostgresDocumentStore` for the hash
tracking gives the same four properties off the shelf. Record the choice here and
in the ewiki Open Questions when made.

---

## 6. Navigation layer (the 90%)

The governed corpus is reached by **navigation + exact retrieval**, not the vector
table. This is most of the value and needs no ingestion — only two MCP servers and
index discipline.

- **Filesystem MCP**, confined to `/data/knowledge/` (read-only mount). This is
  how an agent reads `DECISIONS.md`, WPs, ECs, and per-domain `INDEX.md` files.
- **Git MCP**, read-only, for repo history / blame on the governed repos.
- **`INDEX.md` discipline** (ewiki *INDEX.md convention*): every domain root and
  significant project folder carries an `INDEX.md` that lists its authoritative
  docs with one-line descriptions + relative links, groups by role when large,
  points-only (never duplicates), and is reviewed like the docs it indexes. Author
  these for the pilot corpus before first use — navigation-first fails without
  them.

Example MCP wiring (Claude Code / any MCP client), each server scoped:

```json
{
  "mcpServers": {
    "fs-knowledge":  { "command": "mcp-server-filesystem", "args": ["/data/knowledge"], "env": { "READONLY": "1" } },
    "git-knowledge": { "command": "mcp-server-git", "args": ["--repository", "/data/knowledge/legendary-arena", "--read-only"] }
  }
}
```

---

## 7. Knowledge-query MCP server (the shared retrieval surface)

Every agent reaches the vector layer through **one** MCP server, never Postgres
directly — the stable, model-agnostic interface that makes the agent replaceable.
Implement it to the ewiki *Knowledge-query MCP surface* contract:

- **Tool `knowledge_query`.** Inputs: `query` (string), `domain?` (filter),
  `source_prefix?` (path filter), `top_k?` (default 8), `mode?` (`hybrid` |
  `dense`).
- **Behaviour.** Embed the query via LiteLLM `embed`; run hybrid retrieval — dense
  cosine (`embedding <=> $q`) blended with full-text (`tsv @@ plainto_tsquery`) —
  with `domain` / `source_path` filters as SQL `WHERE`.
- **Returns.** For each hit: `content` excerpt + `source_path`, `header_path`,
  `domain`, `content_hash`. So the agent can cite and the operator can verify.
- **Guarantees.** Connects as `brain_ro` (read-only). Never writes. **Never
  returns governance docs** — the table only ever contained the reference corpus,
  so this holds by construction; assert it in a test anyway.

Give it its own least-privilege DB credential (`brain_ro`) and mount it read-only.
It is the only component that needs the embedding model at query time.

---

## 8. First core skills

Start with **a few** skills, not a template pack (ewiki *Skills Over Monoliths*).
Each skill is a folder: `skill.md` (instructions), `templates/`, `examples/`,
`checks/`. The five that cover most of the value:

| Skill | Purpose |
|---|---|
| `ingest-research-note` | Turn a source / transcript / PDF / notes dump into a structured Markdown research note (front-matter + header structure) under the right domain. |
| `summarize-source` | Extract facts, limitations, open questions, and citations from a long input — grounded, with provenance. |
| `audit-index` | Check an `INDEX.md` against its folder: every authoritative doc listed, links resolve, points-only, grouped when large. |
| `create-decision-record` | Draft a `D-####`-style decision record from a decided choice (mirrors this repo's DECISIONS discipline). |
| `retrieve-and-cite` | Answer a question by routing (which domain), navigating the relevant `INDEX.md`, then calling `knowledge_query` only if navigation cannot answer — always returning citations. |

Each `skill.md` names the **voice profile** for its domain (ewiki *voice split by
domain*) and its verification `checks/`. Skills reference small deterministic CLI
checks (link-checkers, front-matter validators) rather than improvising — the
*skills + CLI over monolithic MCP* posture.

---

## 9. Backup & restore drill

Owning the knowledge means owning its durability — the
[`DISASTER_RECOVERY.md`](DISASTER_RECOVERY.md) discipline, applied here.

**Backup targets (the source-of-truth set only):**

- [ ] **The corpus** — `/data/knowledge/` (Git repos push to their remotes; any
  non-Git notes tar'd offsite).
- [ ] **The knowledge DB** — `pg_dump` of `brain` (for convenience/speed of
  restore), **excluding** the derived vector index from the "must-survive" set.
- [ ] **The stack config** — `/opt/second-brain/` minus `.env` secrets (secrets
  live in the operator's vault, restored separately).

**The vector index is NOT a backup target.** On restore, **rebuild it from the
source Markdown** (`ingest --full`) rather than trusting a possibly-stale dumped
index — it is a derived artifact (ewiki *vector-recovery invariant*).

**Restore drill (rehearse on a throwaway host until boring):**

```bash
# 1. Fresh host, hardened, Docker up (§1–§3).
# 2. Restore corpus (git clone the repos; untar any notes) to /data/knowledge.
# 3. Restore stack config to /opt/second-brain; recreate .env from the vault.
# 4. docker compose up -d ; ollama pull nomic-embed-text ; apply §4 schema.
# 5. REBUILD the vector layer from source — do not restore the old index:
docker compose run --rm ingest --corpus /data/knowledge/research --domain research --full
# 6. Verify (§10). A backup is proven only after this has actually been run.
```

---

## 10. Verification (pilot done-check)

Binary — the pilot is working when all pass:

- [ ] Open WebUI reachable over HTTPS behind its auth gate; a reasoning query round-trips through LiteLLM to the hosted model.
- [ ] `docker compose exec ollama ollama list` shows `nomic-embed-text`.
- [ ] Ingestion of the reference corpus completes; `SELECT count(*) FROM knowledge_chunk` > 0; re-running skips unchanged chunks (incremental holds).
- [ ] `knowledge_query` returns hits **with** `source_path` + `header_path`, connecting as `brain_ro`; a write attempt as `brain_ro` is refused.
- [ ] Filesystem/Git MCP can read a governed doc (e.g. `DECISIONS.md`) but that doc is **absent** from `knowledge_chunk` (governance not vectorized).
- [ ] Each pilot-corpus folder has an `INDEX.md` that lists its docs and whose links resolve.
- [ ] A full restore on a throwaway host reproduces the vector index from source and passes every box above.

---

## 11. Explicitly deferred (do NOT build in the pilot)

From the ewiki *Scope boundaries* — these are out of scope until the pilot has
been used for real work, failures captured, and restore rehearsed:

- Additional domains or additional vector corpora beyond the one pilot corpus.
- Always-on / autonomous ingestion (ingestion stays operator-run).
- Any write-capable connector (email send, publish, DNS, prod DB).
- Multi-agent orchestration harnesses.
- A governance-chain graph (WP → EC → Decision → Change → Release).
- Multi-user / multi-tenant / public-sharing features (single-operator by design).

Expanding past the pilot is a fresh, explicit decision — record it against
[D-24341](../ai/DECISIONS.md#d-24341) (or a successor) before building.
