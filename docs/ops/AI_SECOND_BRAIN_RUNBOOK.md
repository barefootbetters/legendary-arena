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
- **Calendar view + gates.** The command sections below (§1–§10) are the *how*;
  [§12. Execution schedule & checklist](#12-execution-schedule--checklist-phased)
  is the *when* — the phased plan (pilot → thin platform → surfaces → voice), the
  per-phase gates, and the non-goals, all in one place. Honest estimate: **~3 days
  to a usable navigation brain, ~2 weeks to the thin owned platform, ~a month
  before LiteLLM / Open WebUI / voice earn their operating cost.**
- **Repo layout (settled going in).** Design docs (this runbook, the ewiki page,
  D-24341) stay in the **engine repo**. The **platform code** (docker-compose,
  ingestion, the knowledge-query MCP server, schema, skills) gets its **own
  `second-brain` repo at the thin-platform stage (§12 Phase 3), not the engine
  repo** — the engine repo's WP/EC + reward-integrity CI would wrongly gate infra
  commits, and it is cross-domain, not Legendary Arena. The **corpus is per-domain
  and owned**: each domain keeps its own home, sensitive domains (client
  engineering, formulations) live in **neither the engine repo nor any hosted
  surface**. See ewiki *Open Questions* #6.

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

---

## 12. Execution schedule & checklist (phased)

The *when* to §1–§10's *how*. Assumes one operator, the existing Ubuntu lab box,
the Legendary Arena corpus already in Git, and Claude Code already working. Slip a
phase if the census is incomplete or co-location isolation is sloppy.

**Honest estimate**

| Target | Calendar time | "Done" means |
|---|---|---|
| **Pilot you can use** | **3–5 days** | Census + `INDEX.md` + Filesystem/Git MCP + one cited task + one restore drill |
| **Thin platform** | **10–14 days** | Above + Postgres/pgvector on one reference corpus + knowledge-query MCP + isolated co-located services + rehearsed backup |
| **Preferred stack** | **4–6 weeks** | Thin platform + LiteLLM + Open WebUI + first skills pack + voice over Tailscale + this runbook *executed*, not just drafted |
| **End-state** | **2–3 months** | Dedicated host, local/hosted roster settled, second domain onboarded, restore proven on a fresh box, coach optionally on a real gateway |

Three days buys the **navigation-first brain**, not the stack diagram. The
Legendary Arena slice makes 3 days realistic *because it is already structured,
cross-referenced Markdown* — the other domains stay **stubbed** ("exists, not in
pilot") in the census, or 3 days evaporates.

### Phase 0 — Preconditions (before the clock starts)

- [ ] Architecture stays locked: knowledge owned locally, AI is not the system of
      record, governance never vectorized, human review is the authority boundary.
- [ ] Read this runbook (§1–§10) for commands; the ewiki page stays the *why*.
- [ ] Read [`AI_SECOND_BRAIN_VOICE_MOBILE.md`](AI_SECOND_BRAIN_VOICE_MOBILE.md) —
      but **do not implement voice yet** (Phase 6).
- [ ] Lab box access (Ubuntu 24.04, root, SSH keys; UFW / Fail2Ban already in the
      lab posture).
- [ ] Local clones of `DECISIONS.md`, the working WP/EC set, the wiki Markdown, the
      Architecture Inventory; [Data & File Locations](../../wiki/data-file-locations.md)
      open for the Legendary Arena slice.
- [ ] **Repo decision (see §0):** design docs stay in the engine repo; platform
      code gets its own `second-brain` repo **at Phase 3**, not before and not in
      the engine repo; corpus is per-domain and owned; nothing sensitive in the
      engine repo or on ewiki.
- [ ] Decision: **co-locate to bootstrap**, dedicated host later.
- [ ] Decision: **no LiteLLM / Open WebUI / voice in the 3-day window.**
- [ ] Decision: ingestion = skip or pure-custom this week; do **not** pin
      LlamaIndex yet (ewiki *Open Questions* #1).
- [ ] Secrets stay on the box (`.env` in an owned vault, **never** in any repo);
      each MCP server gets its own least-privilege credential.

### Phase 1 — Day 1: Census + navigation substrate (no Docker, no models)

- [ ] Create `KNOWLEDGE_INVENTORY.md` **on the box** (not on ewiki). Every source
      carries: path, domain, class (Authoritative / Reference / Transient),
      retrieval (navigate / vector / skip), backup class, owner.
- [ ] Legendary Arena filled completely; Engineering / Barefoot Betters / Research
      **stubbed** as "exists, not in pilot." No client paths or formulations copied
      onto the hosted wiki.
- [ ] `knowledge/legendary-arena/INDEX.md` written; stub `INDEX.md` for the other
      domains. Each index only links + one-line descriptions — no duplicated policy.
      Every Authoritative doc is reachable from an index.
- [ ] Agent context files (operating context, not facts): identity +
      non-negotiables, current priorities / active WPs, domain routing rules, the
      promotion rule (Transient → Reference → Authoritative is a human act).
- [ ] **Gate:** find `D-24341` and `WP-594` from `INDEX.md` in under a minute, by
      hand, no AI.

### Phase 2 — Day 2: Agent can navigate and cite

- [ ] Filesystem MCP jailed to corpus paths only; Git MCP read-only on governed
      repos. **No** Postgres / Browser / knowledge-query MCP yet.
- [ ] The coding agent loads the context files + those two MCPs, opens the relevant
      `INDEX.md` first, then follows links; answers cite `source_path` + heading;
      it does not treat Transient notes as decisions.
- [ ] **Gate:** "What is locked by D-24341?" is answered *cited from Markdown*, not
      from model memory.

### Phase 3 — Day 3: One task with teeth + recoverability

- [ ] Pick one bounded review (config / inventory / dependency audit / co-host
      isolation vs D-24341). Read-only connectors only; retrieval before
      generation; every finding cites a file + heading; the output is written as a
      **Transient** verification report, never promoted.
- [ ] Backup list = Git corpus + inventory + MCP/agent config. The vector index is
      **not** a backup target. Restore onto a throwaway directory/container and
      re-ask the Phase 2 question.
- [ ] **Gate:** pilot verdict written (what answered, what failed, which
      index/rule you will add). **Scope frozen — no new services until the brain
      has been used for real work.** *(No optional vector in Phase 3: the vector
      layer starts in Phase 5, after real use — ewiki Locked sequencing.)*

### Phase 4 — Days 4–5: Use it before expanding

- [ ] Run 5–10 real operator questions through **navigation only**. Log misses
      (missing index entry, unrecorded decision, bad citation); fix indexes and
      context files.
- [ ] Confirm no governance file was embedded; confirm co-located processes have a
      separate user, credentials, and backups.

### Phase 5 — Days 6–14: Thin vector layer + honest co-location

*(Only after Phase 4 real use.)*

- [ ] Postgres + `pgvector` on the brain's **own** DB (separate role from the
      game). HNSW on the embedding column; plain indexes on `domain`,
      `source_path`. `nomic-embed-text` (768-d) via Ollama.
- [ ] Ingest **Reference class only**; provenance on every chunk (`source_path`,
      `domain`, `header_path`, `content_hash`, `git_commit`, `ingested_at`);
      incremental skip by content hash.
- [ ] One knowledge-query MCP: read-only, hybrid retrieval, **never returns
      governance docs**. Open WebUI not required yet; if added it hits the same
      table.
- [ ] Make co-location honest: process/user isolation from the game stack,
      least-privilege credential per MCP, resource limits so embeddings cannot
      starve matches, secret-rotation notes.
- [ ] Restore drill on a **fresh** host/VM (not just a new folder); the vector
      index is **rebuilt from source**, never restored as truth.
- [ ] **Gate:** a reference question returns chunks *with provenance*; a governance
      question still routes through `INDEX.md`, not the vector API.

### Phase 6 — Weeks 3–6: Preferred surfaces, then voice + host cutover

- [ ] LiteLLM on the brain host for **brain traffic only**; do **not** point the
      `api.legendary-arena.com` coach at the brain host — the coach stays on the
      shipped in-server shim until a second LLM surface exists.
- [ ] Open WebUI in front of LiteLLM over the same store, behind an auth gate; first
      skills from §8, each with purpose / inputs / outputs / verification. No
      always-on ingest; extraction skill writes Transient or Reference only.
- [ ] Voice (only once the navigation slice already answers): Tailscale Serve HTTPS
      (mic needs a secure context), Open WebUI conversation mode, local Whisper +
      Piper first (hosted STT **never** for Engineering / Barefoot Betters). Voice
      prompt = 2–3-sentence spoken answer + verbal pointer; full citations stay in
      the pane; voice captures land Transient. Measure CPU Whisper on 5–15 s vs long
      utterances.
- [ ] Decide the dedicated-host trigger (contention, a resident local model, or
      corpus growth); an accelerated unified-memory box **only** if a
      sensitive-domain workload has already proven the need.

### Done-when (platform, not just pilot)

- [ ] Any governed decision found in under a minute via routing + `INDEX.md`.
- [ ] Fresh-host restore from backups alone; vector rebuilt from source.
- [ ] Model / agent swap is config, not a data migration.
- [ ] A project question answers with file + heading citations.
- [ ] A new domain = a new folder + `INDEX.md` (+ ingest if it has reference
      material) — no architecture change.

### Non-goals until the above is green

No always-on ingestion; no vectorizing DECISIONS / WPs / ECs / runbooks; no
CRM / PM / mail-archive / Git replacement; no multi-agent orchestration as an
authority; no knowledge graph; no residential-ISP system of record; no publishing
formulation or client detail onto ewiki. (These mirror §11 and the ewiki *Scope
boundaries*; expanding past any of them is a fresh decision against D-24341.)
