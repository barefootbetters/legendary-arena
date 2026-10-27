---
title: AI Second Brain
type: Guide
tags:
  - infrastructure
  - ai
  - knowledge-management
  - operator-reference
  - governance
  - draft
related:
  - ubuntu-lab-provisioning.md
  - render-migration-analysis.md
  - system-backup.md
  - workspace-map.md
  - development-workflow.md
status: draft
source:
  - C:\dev\legendary-arena\wiki\ai-second-brain.md (this page — https://ewiki.legendary-arena.com/ai-second-brain/)
  - ../docs/ai/DECISIONS.md#d-24341
  - ../docs/ai/DECISIONS.md#d-24712
  - ../docs/ai/DECISIONS.md#d-24403
  - ../docs/ai/DECISIONS.md#d-24559
  - ../apps/server/src/coach/coachModelConfig.ts
  - C:\www\jefferyjjensen-corporate-memory\docs\second-brain\design.md (the design record — private repo barefootbetters/jefferyjjensen-corporate-memory)
  - C:\www\jefferyjjensen-corporate-memory\mcp\README.md (the brain's Claude connector — same private repo)
  - C:\www\jefferyjjensen-corporate-memory\scripts\brain-sources.psd1 (which other repos the connector serves — same private repo)
last-reviewed: 2026-10-19
---

# AI Second Brain

> **The design record moved on 2026-10-12.** The full AI Second Brain design
> (architecture, principles, build status, positioning, backups, open
> questions), its build runbook, and its voice addendum now live in the
> operator's private ship repo, beside the brain they describe:
> [`docs/second-brain/design.md`](https://github.com/barefootbetters/jefferyjjensen-corporate-memory/blob/main/docs/second-brain/design.md),
> readable at
> [brain.barefootbetters.com](https://brain.barefootbetters.com/docs/second-brain/design/)
> (signed in). This page keeps only what Legendary Arena needs.
> [D-24712](../docs/ai/DECISIONS.md#d-24712) records the move;
> [D-24341](../docs/ai/DECISIONS.md#d-24341) stays as the original architecture
> lock.

## Summary

The AI Second Brain is the operator's self-hosted knowledge platform: an owned
store of knowledge that is the system of record, with replaceable AI agents in
front of it (*knowledge is permanent; agents are replaceable*). It spans more
than Legendary Arena, so its design lives in the operator's own repo, not here.
For Legendary Arena it means four things: the engine corpus is one of the
domains it reads, this wiki is readable from Claude on the operator's phone
through the brain's connector, the brain runs on its own host rather than the
game server, and the endgame coach is the first proof that the game's AI model
can be swapped by configuration.

## Mechanics

### Where the brain's documents live

| Document | Home since 2026-10-12 |
|---|---|
| Design record (was this page) | [`docs/second-brain/design.md`](https://github.com/barefootbetters/jefferyjjensen-corporate-memory/blob/main/docs/second-brain/design.md) |
| Build runbook (was `docs/ops/AI_SECOND_BRAIN_RUNBOOK.md`) | [`docs/second-brain/runbook.md`](https://github.com/barefootbetters/jefferyjjensen-corporate-memory/blob/main/docs/second-brain/runbook.md) |
| Voice addendum (was `docs/ops/AI_SECOND_BRAIN_VOICE_MOBILE.md`) | [`docs/second-brain/voice-mobile.md`](https://github.com/barefootbetters/jefferyjjensen-corporate-memory/blob/main/docs/second-brain/voice-mobile.md) |
| Knowledge-inventory template (was `docs/ops/KNOWLEDGE_INVENTORY.template.md`) | [`docs/second-brain/knowledge-inventory.template.md`](https://github.com/barefootbetters/jefferyjjensen-corporate-memory/blob/main/docs/second-brain/knowledge-inventory.template.md) |
| Working habits for the brain's agents (a section here 2026-10-17 to 2026-10-19) | [`design.md` § Asking the brain's agents for work](https://github.com/barefootbetters/jefferyjjensen-corporate-memory/blob/main/docs/second-brain/design.md#asking-the-brains-agents-for-work) |
| Decisions about the brain | The ship's [`decisions/log.md`](https://github.com/barefootbetters/jefferyjjensen-corporate-memory/blob/main/decisions/log.md); D-24341 here is history |

The ship repo is private, so these links work while signed in to GitHub. The
same pages render at [brain.barefootbetters.com](https://brain.barefootbetters.com/)
behind the ewiki's Cloudflare Access sign-in. The operator publishes them
from the ship's `main`, so the site can trail the repo by a merge or two.

### What Legendary Arena contributes

- **The engine corpus is one domain.** `DECISIONS.md`, Work Packets, Execution
  Checklists, the architecture docs, and this wiki are read by the brain from
  GitHub `main`, read-only. They are navigated exactly and never chunk-embedded
  (a Locked row of D-24341): their value is the exact, whole-context wording.
- **Nothing flows back.** The brain never writes to this repo. Personal,
  consulting, and client material stays in the ship and never appears here,
  because this repo is public.

### Reading this wiki from Claude (the brain's connector)

Since 2026-10-14 the brain's read-only MCP server, added to claude.ai as a
custom connector, serves every page in `wiki/` to Claude on the web, the
desktop, and the operator's phone. The pages appear as one folder, `ewiki`,
beside the ship's own notes.

| What | How it works |
|---|---|
| Source | `wiki/*.md` on GitHub `main`, read with a shallow clone when the operator deploys the brain. It never reads a local checkout. |
| Citations | Every answer names the engine commit it read and links the page on `ewiki.legendary-arena.com`. |
| Freshness | It's a snapshot. An edit here reaches the phone only after the next brain deploy, not when this site rebuilds. |
| What ships | All pages, because this repo is public and so already readable by anyone, including any hosted model. Each deploy checks the repo is still public; if it ever goes private, the deploy leaves the wiki out of the connector. |
| Writes | None to this repo. The connector's one write is a phone-to-desk idea inbox in the ship (below). |

**Ideas from the phone.** In a phone chat, an idea can be sent to the
operator's desk with the connector's `send_to_desk` tool, in a folder such as
`legendary-arena`. On the desk it's filed as a draft in the ship's
`inbox/<folder>/`. It becomes a Work Packet here only after it's checked
against this repo's rules (`DECISIONS.md`, `WORK_INDEX.md`, this wiki) and the
operator approves it. A phone brief is a draft, never a decision.

### Asking the brain's agents for work

**Moved to the design record on 2026-10-19.** The habits that make an agent's
output checkable (write down what you care about where the agent reads it,
show examples rather than a description, tag claims Seen / Inferred / Unknown,
and the six-step brief for an outside idea sent with `send_to_desk`) apply to
every domain the brain serves, so they live in the ship:
[Asking the brain's agents for work](https://github.com/barefootbetters/jefferyjjensen-corporate-memory/blob/main/docs/second-brain/design.md#asking-the-brains-agents-for-work).

What they mean for this repo:

- **Where the agent reads what you care about:** `.claude/CLAUDE.md` and
  `.claude/rules/` for standing rules, an Execution Checklist's locked values
  for one Work Packet, `DECISIONS.md` for the reasons, and
  [`docs/10-GLOSSARY.md`](../docs/10-GLOSSARY.md) for shared terms. When an
  agent drifts the same way twice, fix the document it read.
- **Examples to point an agent at:** three to five shipped Work Packets and
  their Execution Checklists, `DECISIONS.md` entries, or finished ewiki pages.
  The coach's `coach:eval` fixtures work the same way (see
  [Gateway routing for the endgame coach](#gateway-routing-for-the-endgame-coach-decision-sketch)).
- **A `legendary-arena` brief from the phone** is checked on the desk by the
  Work Packet drafting preflight
  ([`01.0a`](../docs/ai/REFERENCE/01.0a-wp-drafting-phase.md)) and the lint
  gate ([`00.3`](../docs/ai/REFERENCE/00.3-prompt-lint-checklist.md)) before
  it becomes a Work Packet candidate. Phone answers come from a snapshot (see
  [Edge Cases](#edge-cases)).

### Hosting

The brain gets its own host. Production moved to a 4 GB DigitalOcean droplet
on 2026-10-12 ([D-24707](../docs/ai/DECISIONS.md#d-24707)), which is sized for
the arena alone and below the brain's 8 GB floor. Sizing, vendors, and costs
are in [Render Migration Analysis](render-migration-analysis.md) and
[Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md). D-24341's "co-location
OK to bootstrap" still permits sharing a box, but it no longer saves money.

### Backup and recovery

The brain's backups are its own: three copies, on two kinds of media, one of
them off-site, with pCloud as the off-site copy. Material marked owner-only
goes off-site only after it is encrypted on the operator's machine. The plan
lives in the design record's Backup and recovery section, readable at
[brain.barefootbetters.com](https://brain.barefootbetters.com/docs/second-brain/design/)
(signed in, behind Cloudflare Access) and in the private ship repo's
[`design.md`](https://github.com/barefootbetters/jefferyjjensen-corporate-memory/blob/main/docs/second-brain/design.md#backup-and-recovery). Nothing about the brain is in this repo's database backups, and a
brain restore never touches the game server.

### Gateway routing for the endgame coach (decision sketch)

The endgame coach is named as the first proof point of the
replaceable-agent claim — but "route it through LiteLLM" is not a single option,
it is a small decision, because the coach runs on the **game server**
(`apps/server`, `api.legendary-arena.com` — the DigitalOcean droplet since
2026-10-12, Render before), *not* on the brain host. Two facts
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
| **D1. Self-hosted LiteLLM on the API droplet**, beside `apps/server` | one small service, co-located (the 4 GB droplet is sized for the arena alone; check memory headroom or resize first) | ✅ | ✅ | a second LLM surface appears and you want ownership + cost control near the server |
| **D2. Self-hosted LiteLLM on the brain host** (vendor open) | one service, cross-host | ✅ | ✅ | the AI Second Brain platform is built and already runs the gateway |

**Recommendation.** Take **B now.** It is the model-independence *principle*
(model as config; quirks off the feature client) at the cost of a small, testable
Node module and no new infrastructure — the right size for a single LLM surface.
Promote to a **real gateway (C or D)** only when a *second* LLM surface appears,
or the brain platform is built and already runs one; that is when a shared
gateway earns its operating cost. If self-hosting LiteLLM for the coach, prefer
**D1 (co-located on the API droplet)** over **D2 (the brain host)**: even fail-soft,
pointing the live game server at the brain host couples two things the
architecture deliberately keeps separate (see
[Co-hosting during bootstrap](#edge-cases)), for no benefit the coach needs.
LiteLLM on the brain host is for the *brain's* agents, not for a game-server
feature reaching across the network.

> **This does not change the Locked architecture.** The platform's gateway choice
> (LiteLLM) stays a **Preferred** row; this sketch is about *one app surface's*
> routing, shipped as an `INFRA:` code change (Option B, PR #1619). The proof-point
> claim holds under every option B–D — the coach's model becomes swappable without
> an engine edit.

> **Shipped — Option B is live (2026-08-24, PR #1619, `INFRA:`).** The in-server
> shim landed with no behaviour change at defaults. The routing layer is
> `apps/server/src/coach/coachModelConfig.ts`; the coach's model and its per-model
> quirks are now config, not hardcoded in the feature client. Operating notes for
> the `COACH_MODEL` knob:
>
> - **It is optional, and unset is the intended state.** With `COACH_MODEL` unset
>   the coach runs the default `claude-sonnet-5` with its disabled-thinking quirk —
>   identical to before the shim. That is the *finished* state, **not a stopgap
>   "until LiteLLM."** The shim *is* the model-independence mechanism; a real
>   gateway (C/D) stays deferred until a second LLM surface or the brain platform
>   (above), so the coach is not waiting on anything.
> - **Setting it to the default is a no-op.** `COACH_MODEL=claude-sonnet-5` resolves
>   to exactly what unset does — do not set it merely to "pin" the current model.
> - **Swapping = set `COACH_MODEL` in the API droplet's `/etc/la/.env`** to the
>   exact Anthropic model id (e.g. `claude-opus-5`), then restart the server
>   (`sudo systemctl restart la-server`); before the 2026-10-12 cutover this was
>   the Render dashboard, which redeployed on save. The value is
>   the API id, never a friendly name like "Sonnet 5". Since WP-737 (D-24559) the
>   registry is an allowlist: an id with no quirk row (a typo, a friendly name, an
>   unvetted model) is **not** sent — the coach keeps running on the default
>   `claude-sonnet-5` and the server logs one startup warning naming the refused
>   id. Check the startup log after a swap.
> - **Pre-seeded swap targets are env-only; any other model needs a quirk row
>   first.** The registry ships rows for `claude-sonnet-5` (disabled
>   thinking), `claude-opus-5` (thinking on at `effort: low` — Opus 5 discourages
>   disabling thinking), and `claude-sonnet-4-6` (thinking off by default) — those
>   three are safe to select with `COACH_MODEL` alone. Any *other* Claude 4.6+/5
>   model runs adaptive extended thinking by default, which drains the bounded
>   output budget and re-triggers the empty-response failure (the EC-629 bug — see
>   [Edge Cases](#edge-cases)); before pointing `COACH_MODEL` at one, add its row
>   to `COACH_MODEL_QUIRKS_BY_MODEL` in the shim (disabled thinking where the model
>   allows it, or `effort: low` where it does not). A non-thinking model still needs
>   a row (a one-liner) — without one it is refused and the default runs instead.
> - **Pre-swap check (shipped, WP-737 / D-24559).** Two changes make a swap safe
>   before it reaches paying players. First, the quirk registry is an allowlist: an
>   unregistered `COACH_MODEL` (even a prototype key like `constructor`) falls back
>   to the default model with a startup warning instead of reaching the API with no
>   thinking directive. Second, before flipping `COACH_MODEL`, run
>   `pnpm --filter @legendary-arena/server coach:eval --model <id>` with
>   `ANTHROPIC_API_KEY` exported in the shell. It sends 10 fixture match summaries
>   (one per scenario category) through the real client — one paid call each — and
>   scores every report against a deterministic whole-term rubric (structure, luck
>   language on lucky/unlucky games, per-seat naming in a two-seat game, buying
>   language when a seat bought nothing, and a hallucination guard naming heroes
>   absent from the match). It refuses an unregistered model outright (the eval is
>   strict where production is forgiving), exits non-zero on any failure, and
>   `--out <path>` saves the raw reports. It is the *Verification Is Required*
>   principle applied to the coach — an adversarial "mystery-shop" pass over the
>   product's own LLM surface. It is never a required CI check: it costs money per
>   run and model output is nondeterministic. A failing scenario is a prompt or
>   model finding to record, never a rubric to loosen. First run (2026-09-22,
>   `claude-sonnet-5`): 9/10, the one failure a malformed-JSON response (a raw
>   control character inside a string), not a rubric miss.

## Interactions

- **[Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md)** — the droplet that
  runs production. The brain does not share it.
- **[Render Migration Analysis](render-migration-analysis.md)** — host sizing,
  vendors, and the cost baseline the brain host is planned against.
- **[System Backup](system-backup.md)** — includes this page's
  [Backup and recovery](#backup-and-recovery) section, which points to the
  brain's own plan.
- **[Workspace Map](workspace-map.md)** — where the ship repo is checked out
  (`C:\www\jefferyjjensen-corporate-memory`, off pCloud).
- **[Development Workflow](development-workflow.md)** — the AIS-OS kit that is
  the brain's "map" is also in the tooling list there.
- **Endgame coach** — `apps/server/src/coach/coachModelConfig.ts` (the routing
  shim), [D-24403](../docs/ai/DECISIONS.md#d-24403) (the coach),
  [D-24559](../docs/ai/DECISIONS.md#d-24559) (the allowlist and `coach:eval`).

## Edge Cases

- **Swapping the coach model to a thinking-by-default model without its quirk row
  reintroduces the empty-response bug.** The shipped coach shim (see
  [Gateway routing for the endgame coach](#gateway-routing-for-the-endgame-coach-decision-sketch))
  makes `COACH_MODEL` a config swap, but the safety is *per model*. Every Claude
  4.6+/5 model runs adaptive extended thinking by default, and those thinking
  tokens draw from the bounded `max_tokens`; on a full match-analysis prompt the
  thinking exhausts the budget before any answer text, so the response caps
  mid-thinking with an empty text block and every real call fails
  `coach_unavailable` (the EC-629 production bug). Before WP-737 a model absent
  from the shim's quirk registry was sent with **no** disabled-thinking directive,
  silently reintroducing exactly that failure. Since D-24559 the registry is an
  allowlist: such a model is refused, the coach stays on the default model, and
  the startup log warns — so the failure mode is now "the swap did not take", not
  "the paid panel went dark". Adding a model is one quirk row plus a green
  `coach:eval` run. The registry ships
  safe rows for `claude-sonnet-5`, `claude-opus-5`, and `claude-sonnet-4-6`, so
  those three are env-only swaps; note the fix is not always "disable thinking" —
  **Opus 5 discourages disabling thinking** (it can leak reasoning into the visible
  text and 400s at high effort levels), so its row keeps thinking on at `effort:
  low` instead. (The value must also be the exact API id — a friendly name like
  "Sonnet 5" has no row, so it is refused and the default runs.)
- **Co-hosting during bootstrap needs real isolation.** Running a model gateway,
  a chat surface, and a vector DB on the live game-server box adds attack surface
  and resource contention to a host whose job is serving matches. It is an
  accepted *bootstrap* configuration (D-24341), but only with genuine logical
  isolation — process/user isolation, separate credentials, independent backups,
  resource limits — never a casual co-tenant. A dedicated host remains the
  end-state; co-location is the temporary, deliberately-fenced start.
- **The phone reads a snapshot, not the live wiki.** The brain's connector bundles
  `wiki/` when the operator deploys the brain, so a merged edit here (even one
  this site already shows) is invisible to Claude on the phone until the next
  brain deploy. When the phone and the site disagree, the site is newer. Each
  connector answer names the engine commit it read, so you can check how old
  it is.
- **This repo is public.** The ewiki is behind Cloudflare Access, but its
  Markdown source is in a public GitHub repo. Brain content that belongs to the
  operator, a client, or another business goes in the ship, never on this page.
- **Old links into the moved sections land here.** Links to anchors that no
  longer exist on this page (for example `#voice-interface-speech-in-speech-out`)
  open the top of the page; follow the table under
  [Where the brain's documents live](#where-the-brains-documents-live).

## History

- **2026-08-11** — The architecture and its governance vehicle were locked as
  [D-24341](../docs/ai/DECISIONS.md#d-24341): a standalone `DECISIONS.md`
  record plus this ewiki page as the design record, not an engine Work Packet.
- **2026-08-24** — The coach's routing shim shipped (PR #1619), the first proof
  of *Model Independence* on live traffic.
- **2026-08-11 to 2026-10-12** — This page grew into the full design record
  (about 2,700 lines): the ship / map / captain repo plan, positioning and the
  notes-migration offer, host sizing, and 3-2-1 backups. That history now
  travels with the design record in the ship.
- **2026-10-12** — The design record, runbook, voice addendum, and
  knowledge-inventory template moved to the ship's `docs/second-brain/`
  ([D-24712](../docs/ai/DECISIONS.md#d-24712)). This page now keeps only the
  Legendary Arena side and the coach's gateway routing.
- **2026-10-13** — The brain's connector went live on claude.ai and the
  operator's phone, serving the ship's own notes, with the phone-to-desk idea
  inbox as its only write. The decisions are in the ship's `decisions/log.md`.
- **2026-10-14** — The connector started serving this wiki (93 pages, folder
  `ewiki`), read from GitHub `main` at each brain deploy.
- **2026-10-17** — Added [Asking the brain's agents for work](#asking-the-brains-agents-for-work):
  write down what you care about where the agent reads it, example-driven
  requests, Seen / Inferred / Unknown tags, and a six-step brief (with an
  interview step) for outside ideas sent from the phone. Taken from two
  outside reviews of this page; the parts that would change hosting, the
  connector, or the coach were left out.
- **2026-10-19** — The full text of that section moved to the ship's design
  record, because the habits apply to every domain the brain serves, not only
  Legendary Arena. This page keeps a pointer and what the habits mean for this
  repo.

## References

- [DECISIONS.md D-24341](../docs/ai/DECISIONS.md#d-24341) — the architecture
  lock (history; the charter now lives in the ship).
- [DECISIONS.md D-24712](../docs/ai/DECISIONS.md#d-24712) — the move of the
  design record to the ship.
- [DECISIONS.md D-24403](../docs/ai/DECISIONS.md#d-24403) and
  [D-24559](../docs/ai/DECISIONS.md#d-24559) — the endgame coach and its
  model allowlist + `coach:eval`.
- [DECISIONS.md D-24707](../docs/ai/DECISIONS.md#d-24707) — production on the
  DigitalOcean droplet.
- `apps/server/src/coach/coachModelConfig.ts` — the coach's routing shim.
- [`docs/second-brain/design.md`](https://github.com/barefootbetters/jefferyjjensen-corporate-memory/blob/main/docs/second-brain/design.md)
  in the private ship repo — the full design record.
- [`mcp/README.md`](https://github.com/barefootbetters/jefferyjjensen-corporate-memory/blob/main/mcp/README.md)
  in the private ship repo — the brain's Claude connector: what it serves,
  sign-in, the idea inbox, and how to redeploy it.
