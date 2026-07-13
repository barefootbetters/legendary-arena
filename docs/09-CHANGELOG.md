# 09 — Changelog

> High-level, human-readable record of significant changes to Legendary Arena.
> Not a git log — focuses on architectural impact and milestone completions.
>
> **Last updated:** 2026-07-13
> **Format:** Newest first. Each entry tied to commits and Work Packets.
>
> **Note:** the 2026-04-15 → 2026-07-13 window (WP-027 → WP-366, ~130 Work
> Packets) was reconstructed after the fact from `WORK_INDEX.md` + `git log` —
> the per-WP throughput had outrun this file. It is grouped by **milestone arc**
> (dated at the arc's completion) rather than per-WP; `WORK_INDEX.md`,
> `DECISIONS.md`, and `git log` remain the exhaustive per-packet record.
> **Authoritative sources:** This file, `docs/ai/work-packets/WORK_INDEX.md`,
> and `git log`.

---

## Unreleased

Active work and the forward roadmap are tracked in
[`docs/ai/work-packets/WORK_INDEX.md`](ai/work-packets/WORK_INDEX.md) and
[`docs/05-ROADMAP-MINDMAP.md`](05-ROADMAP-MINDMAP.md) — this changelog records
milestones as they ship. Recent deferred follow-ons include retro-rescoring
historical competitive scores and gauntlet progress on player profiles.

---

## 2026-07-13 — Open a Live Game's Loadout in the Registry Viewer

**Work Packets:** WP-361 / WP-362 / WP-363 · **Decisions:** D-24153 / D-24154 / D-24155 · **Verified live end-to-end.**

From an in-progress match on play.legendary-arena.com, a player can open that game's exact loadout in the Registry Viewer's Loadout tab — to inspect, tweak, or re-export it — with **LAGN** (Legendary Arena Game Notation) as the interchange format the whole way.

### WP-361 — Server: current-match loadout as LAGN (`48ac707f`)

- New `GET /api/match/:matchId/lagn` returns a read-only **Tier-1 LAGN** of a match's setup; `authenticated-session-required` + participant-gated (`readSeatAccounts`).
- Projected from the persisted match state (`initialState.G.matchConfiguration`); **extends the D-24095/D-24119 blob-read carve-out** (ARCHITECTURE.md §Persistence Boundary) with a read-only Tier-1-LAGN projection — never written back, never a save-game.

### WP-362 — Registry Viewer: open a LAGN from the URL (`6f9a3475`)

- New `?lagn=<base64url>` deep-link decodes → the existing `parseLagnLoadout` → auto-switches to the Loadout tab, pre-filled.
- Self-contained payload: **no server call, no auth, no CORS**; a bad link fails visibly (the tab opens with a decode-error banner rather than blank).

### WP-363 — Arena Client: in-match "View loadout in Registry Viewer" link (`b1d5c0d9`)

- Fixed-position in-match control fetches the LAGN and opens the viewer deep-link in a new tab; the `lagn` is opaque (the client never inspects it) and the bearer never leaves the `Authorization` header.
- Pop-up-blocker fix (`e38f0314`): the tab is opened synchronously on click (before the fetch) so the pop-up blocker allows it, then navigated once the LAGN arrives.

---

## 2026-07-12 — Friends & Ranked Trust

**Work Packets:** WP-350..360, WP-366 · `7ee51bef` (#672) → `d6508652` (#709)

A social trust layer for competitive integrity. Players can add friends by
`@handle`, and ranked scoring now trusts only games played among friends.

- Friendships data model + status machine + mutual-clique helper; friend-request API under `/api/me/friends*` (WP-350, WP-351)
- Friends tab on the owner profile; match-invite flow — invite a friend into your game, accept, and join from the invite (WP-352, WP-358, WP-360, WP-366)
- **Ranked-eligibility gate:** the friendship-clique is checked at competitive-score submission, so ranked results reflect trusted lobbies (WP-354)
- Abuse controls: block list, friend-request rate limit, re-request cooldown (WP-355)
- Fail-open friend-request emails via Brevo, with an opt-out preference + profile toggle (WP-353, WP-357, WP-359)

## 2026-07-12 — Card-Mechanic Implementation Grind: Hero & Villain Keywords

**Work Packets:** WP-214..223, WP-247..256, WP-267..290, WP-310, WP-356, WP-364 (interleaved) · `e9dc6ab2` (#311) → `f04e0ae0` (#711)

A sustained campaign — driven by the coverage dashboard (below) — turning
"hollow" printed card abilities into real, deterministic engine behavior. New
effect-authoring *levers* mean most new mechanics are now data rows, not engine
edits.

- Effect-authoring substrate: parameterized villain effect primitives, hero Reveal-\* collapse, a hero Effect ImplementationMap, and composable primitives (Berserk / Empowered / class-count) (WP-251..256, WP-267)
- Player-choice frameworks: count-scaled attack, optional-KO-then-reward, reveal-attack-choose / reveal-cost-attack / reveal-KO-attack executors + client prompts (WP-219..223, WP-247..249)
- Named keywords shipped off the coverage worklist: Spectrum, Wall-Crawl, Dodge, Undercover, Empowered (oracle/dynamic/multi-class), Size-Changing, gain-a-Wound, shuffle-discard-empty-reward, and more (WP-273..290, WP-310, WP-356, WP-364)
- Villain defeat-requirement gates ("can't defeat X without a \<class\> hero") and victory-pile villain-pick / choose-one abilities (WP-285..287, WP-292)

## 2026-07-09 — Competitive Scoring, PAR & Faithful-Replay Verification

**Work Packets:** WP-048..054, WP-115, WP-149, WP-150, WP-332..341 · `38e76eb7` (#603) → `437782b6` (#623)

The competitive backbone: a scored, verifiable, publicly-visible result for
every finished match.

- **PAR (Par-Adjusted Result)** simulation engine, scenario scoring, artifact storage + publication + a server-side publish gate (WP-048..051, WP-067)
- Replay ownership + access control; competitive submission `POST /api/competition/scores` (submit-by-`matchId`) and `GET /api/me/scores` (WP-052, WP-053, WP-332, WP-338)
- **Server-layer faithful reducer-replay:** a finished match is re-executed through boardgame.io's own reducer to reproduce and hash-verify its exact final state before scoring (WP-334, WP-336, WP-340)
- Turns-native scoring (retiring the `moveCount`-as-rounds proxy); public read-only leaderboards + global aggregation endpoints + a marketing leaderboard page; arena-client submit-after-match + "My Scores" (WP-054, WP-115, WP-149, WP-337, WP-339, WP-341)

## 2026-07-09 — Gauntlet Leaderboards

**Work Packets:** WP-342, WP-343, WP-344 · `15e6572b` (#628) → `ef1de184` (#643)

Set-gauntlet and player-count leaderboards, published to the public Legends
board.

- Mastermind set-gauntlet outcome persistence + read layer + Legends publisher (WP-342)
- Legends-board gauntlet index + board panel (WP-343)
- Player-count boards: roster-keyed standings + per-count publisher (WP-344)

## 2026-07-09 — Auth, Identity, Profiles & Avatars

**Work Packets:** WP-099..109, WP-126..192, WP-296..305, WP-347, WP-348 · `e35dd00` (WP-126) → `e6d1cf2d` (#659)

Real player accounts, via Hanko external auth, with public profiles.

- Hanko session verifier + production-wired authenticated routes + JWKS refresh guard; client sign-in UI, auth-aware nav, API base-URL surfacing (WP-126, WP-131, WP-160, WP-175, WP-192)
- First-sign-in auto-provisioning; handle claim + global uniqueness; public + owner profile pages; player badges, team affiliation, and an anti-cheat suspend/audit surface (WP-101, WP-102, WP-104..107, WP-109, WP-174, WP-305)
- Avatar upload pipeline (R2 + MIME/size validation) + owner UI; Open Graph / Twitter link previews (WP-106, WP-296, WP-298..300)
- Admin session gate; dashboard operator Bearer auth; cross-subdomain (`.legendary-arena.com`) session cookie + sign-out clear (WP-159, WP-241, WP-347, WP-348)

## 2026-07-08 — Match Lifecycle & boardgame.io Postgres Persistence

**Work Packets:** WP-307..312, WP-326, WP-327, WP-333, WP-335 · `031a91b9` (#539) → `a39a9930` (#556)

Multiplayer matches now survive deploys and hostile lobbies.

- Authentication gate on multiplayer play + a hard gate closing the native-lobby bypass (WP-307, WP-308)
- **Durable boardgame.io match storage** — a Postgres store so in-flight matches survive server deploy/restart (WP-309)
- Client reconnect + desync auto-resync + move-acknowledgment watchdog (WP-311, WP-312)
- Lobby hygiene: join-list shows only joinable matches; a server-side reaper clears stale matches (WP-326, WP-327)
- Seat→account identity persisted at join + a live-match capture harvester (WP-333, WP-335)

## 2026-07-08 — Diagnostics & In-HUD Game Log

**Work Packets:** WP-228, WP-246, WP-295, WP-314..331 · `f1385ab8` (#252) → `d8576c79` (#591)

From "the game froze and I don't know why" to a readable, shareable record of
everything that happened.

- Shareable diagnostic capture + export (freeze log), a richer UIState snapshot, and card-effect provenance / "awaiting input" reasons (WP-228, WP-246, WP-314)
- A live-HUD **game-log panel**: compact, auto-scrolling, chronological, with copy / save / full-screen (WP-318, WP-321, WP-322)
- Log enrichment: card plays, mastermind tactics, villain-deck narration, per-target hero names in fight/ambush overlays, and Turn.Step.Action numbering aligned to the HUD (WP-316, WP-319, WP-323..325, WP-328, WP-329, WP-331)

## 2026-07-05 — Play Surface & Board UI

**Work Packets:** WP-100, WP-128..135, WP-171, WP-178, WP-313 · `5f9cdd4` (WP-100) → `0d05ae78` (#565)

The interactive gameplay board itself.

- Click-to-play surface scaffold + UIState board-layout projections (WP-100, WP-128)
- Desktop-landscape / mobile-portrait layouts + a re-skin / playmat selector (WP-129, WP-130)
- HQ + hero-deck reservoir, a click-to-view pile-browse modal, and card-image rendering on the mat (WP-135, WP-171, WP-178)
- Victory-pile villain-pick UX closing "The Ebony Blade" hard-freeze (WP-313)

## 2026-07-01 — LAGN Spec, Tooling & Loadout Library

**Work Packets:** WP-244, WP-245, WP-291, WP-301, WP-302 · `0147730` (WP-244) → `d9a71d3c` (#465)

**LAGN** (Legendary Arena Game Notation) published as an open interchange format,
plus save/share for loadouts. (The 2026-07-13 entry above completes the arc: a
live game's loadout opens in the Registry Viewer over LAGN.)

- LAGN spec published as an NPM package + hosted JSON Schema + CLI; LAGN export/import round-trip in the Registry Viewer Loadout tab (WP-244, WP-245, WP-291)
- Profile Loadout Library: data model + endpoints, owner UI, and a public share view (WP-301, WP-302)

## 2026-06-25 — Registry Viewer Upgrades

**Work Packets:** WP-086, WP-091, WP-114, WP-121..127, WP-170, WP-270, WP-276..288 · `ccc6d0e` (WP-086) → `74637d41` (#463)

The card browser at cards.barefootbetters.com grew a loadout builder and much
sharper filtering.

- Card-type taxonomy upgrade + the **Loadout builder**; grid data view, zoom sliders, effect-tag filter (WP-086, WP-091, WP-121..127)
- URL-parameterized setup preview ("Game of the Week") + card-count display (WP-114, WP-170)
- Hero-mechanic searchable multi-select + a unified filter search-header redesign (WP-270, WP-276..278)
- Cards-tab "Add to Loadout" (shared draft + tray) and a "View Loadout as Cards" gallery (WP-279, WP-288)

## 2026-06-23 — Hero-Effect Coverage Dashboard & Mechanic Ledger

**Work Packets:** WP-250, WP-268, WP-269, WP-271, WP-274, WP-281 · `6bbf6ede` (#321) → `174c7ca8` (#433)

The control surface that drives the mechanic-implementation grind: a measurable,
CI-gated view of which card abilities are real vs. hollow.

- Hero-effect coverage gate (`pnpm sim:coverage` + CI) and a by-hook composition ledger with honest per-card resolution (WP-250, WP-268)
- Hero / villain / henchman mechanic-metadata feeds with CI freshness gates (WP-269, WP-271)
- `/coverage` "% of in-play hollow observations resolved" metric + condition-gate status display (WP-274, WP-281)

## 2026-06-19 — Hollow-Effect Detection Loop

**Work Packets:** WP-257..260, WP-263..266 · `7bb811d2` (#362) → `bdb1f976` (#402)

A detect→surface→author loop so unimplemented card abilities can't hide.

- A hollow-effect detector as an engine runtime invariant, surfaced on the arena-client diagnostics and Dashboard `/coverage` (WP-257, WP-258, WP-259, WP-263)
- Architect-lane intake: runtime-confirmed gaps become draft-WP candidates (WP-260)
- Real-signal sweeps via a competent, hero-diverse per-PR run with a parameterized turn cap (WP-264, WP-265, WP-266)

## 2026-06-18 — Autoplay / "Watch Bot Play"

**Work Packets:** WP-163..165, WP-177, WP-261, WP-262 · `39c06c2e` (#99) → `0ab4d35d` (#393)

Watch the AI play a full match, with VCR-style controls.

- Autoplay playback controls + status endpoint (server + client) and rewind audience-scoping (WP-163..165, WP-177)
- Bot-loop crash surfacing + a "Bot Match Stopped" banner with stall detection (WP-261, WP-262)

## 2026-06-12 — Operator Dashboard & Autonomous Sweep / Agent Pipeline

**Work Packets:** WP-157, WP-162, WP-193..240, WP-289, WP-304 (SPEC WP-345/349) · `bef03a82` (#56) → `507fbf50` (#294)

A morning command center at `dashboard.legendary-arena.com`, backed by a nightly
simulation sweep that feeds an agent pipeline.

- Dashboard SPA: daily-driver STATUS feed, governance-throughput KPIs, cadence horizons, vision card, and command-center surfaces (revenue/monetization, acquisition/retention, public-surface health, cost watchdog) behind Cloudflare Access + operator auth (WP-157, WP-162, WP-196..206, WP-226, WP-241)
- Simulation sweep chain: setup-matrix runner, anomaly oracle, `sweep_runs` server + nightly workflow + a health-trend widget, expanded to the full corpus (WP-193..195, WP-209, WP-210, WP-234, WP-235, WP-238)
- Agent pipeline (Architect→Builder→Inspector→Evaluator) consuming sweep findings, plus a headless engine-runner host/CLI; hashed-user-id analytics plumbing (WP-229..233, WP-239, WP-240, WP-304, WP-205, WP-211)

## 2026-06-12 — Villain Vocabulary, Scheme-Twist & Board Content

**Work Packets:** WP-153..156, WP-179..214, WP-242, WP-243, WP-306 · `793da6ef` (#156) → `c32a8e28` (#299)

The villain/scheme half of the engine caught up to the hero half.

- Destination piles (Strike/Twist/Escaped), mastermind attached bystanders, horrors pile, turn-economy piercing/wounds-drawn (WP-153..156)
- Scheme-twist resolver framework + pattern taxonomies + card-trait/superpower condition evaluation (WP-179, WP-182..184)
- Villain/henchman fight/ambush/escape/overrun effects, magnitude-N and each-player hero-KO vocabulary, once-per-turn reveal guard (WP-185..190, WP-202, WP-212)
- Villain fight **"KO-a-hero" player choice** (park→resolve, bot auto-resolve) with UX projection + client prompt (WP-214, WP-242, WP-243)

## 2026-05-17 — Platform Foundations: Replay Harness, Client Bootstrap & Governance

**Work Packets:** WP-027..042, WP-055, WP-060..119, WP-136..166 (foundational) · `5c453c47` (#80), `a570ae8b` (#109)

The Phase 6/7 opening — the scaffolding everything above is built on.

- Determinism & replay verification harness, step-level replay API, replay snapshot producer + inspector, server-side replay storage, and a complete-game seed-faithful regression harness (WP-027, WP-063, WP-064, WP-079, WP-080, WP-103, WP-158)
- Gameplay client bootstrap + Arena HUD/scoreboard, a Vue SFC test-transform pipeline, and engine PlayerView / live-match client wiring (WP-061, WP-062, WP-065, WP-089, WP-090, WP-111, WP-113)
- Registry build-pipeline cleanup, keyword & rule glossary with rulebook deep-links, theme data model, and an engineering wiki viewer (Hugo) (WP-055, WP-060, WP-081..085, WP-139)
- Architecture governance docs (disconnect/reconnect, routing, HTTP API catalog, hardening, network sync, growth/change budget) + a vue-tsc CI typecheck gate + build-time version stamping (WP-031..042, WP-116..119, WP-166, WP-227)

## 2026-05-15 — Legends Public Scoreboard

**Work Packets:** WP-142, WP-143 · `e15ba0d` (WP-142) → `85440f10` (#51)

A zero-auth public scoreboard at `legends.legendary-arena.com`.

- A background publisher writing public JSON snapshots to R2 (`legends/v1/*`) on a 5-minute cadence (WP-142)
- A Vue 3 attract-board SPA reading those snapshots directly, with a kiosk mode for big-screen / Twitch (WP-143)

## 2026-05-15 — Physical Card Abstraction

**Work Packets:** WP-138..151 · `763f84b` (WP-138) → `2e495763` (#46)

A model for split-side / multi-face physical cards.

- A `PhysicalCard` abstraction with side ordering + `companionSlug` (WP-138..147)
- Image resolution moved from `HeroCardSchema.imageUrl` to `physicalCards[].sideToImageUrl`, with all 40 set JSONs regenerated + an R2 rename mapping (WP-151)

## 2026-05-15 — Billing, Stripe & Entitlements

**Work Packets:** WP-108, WP-110, WP-132..134, WP-176 · `b281744` (WP-134) → `42603cb7` (#49)

Payments and supporter entitlements.

- Entitlements data model + `/me/entitlements` read API (WP-132)
- Stripe checkout-session creation, webhook ingestion, and webhook→entitlement fulfillment (WP-133, WP-134)
- Profile billing / funding-history UI + a read-only admin billing backoffice (WP-108, WP-110, WP-176)

## 2026-05-15 — Pre-Planning System

**Work Packets:** WP-056..059, WP-070 · `eade2d0` (WP-056) → `ec7abf4d` (#45)

Speculative turn-planning for waiting players, non-authoritative by design.

- Pre-planning state model + lifecycle + sandbox execution + a disruption pipeline (WP-056..058)
- Pre-plan UI (store, notification, step display) and live-mutation middleware wiring pre-plan ↔ engine disruption (WP-059, WP-070)

---

## 2026-04-14 — Phase 5 Complete: Card Mechanics & Abilities

**Tag:** `phase-5-complete` | **Tests:** 314 passing (engine)

### WP-026 — Scheme Setup Instructions & City Modifiers (`d14d65b`)

- `SchemeSetupInstruction` data-only contract with 4 MVP instruction types
- Deterministic executor (`executeSchemeSetup`) — `for...of`, unknown types warn + skip
- `buildSchemeSetupInstructions` returns `[]` at MVP (safe-skip, D-2504)
- `modifyCitySize` is warn + no-op while `CityZone` is fixed tuple (D-2602)
- `G.schemeSetupInstructions` stored for replay observability
- D-2601 (Representation Before Execution) formalized as named decision
- Phase 5 complete — 9 new tests, 314 total

### WP-025 — Board Keywords: Patrol, Ambush, Guard (`5963b90`)

- `BoardKeyword` closed union + `BOARD_KEYWORDS` canonical array
- `G.cardKeywords` built at setup from registry ability text
- Patrol: +1 fight cost. Guard: blocks lower-index targets. Ambush: wound on City entry
- Board keywords are structural City rules, separate from hero hooks (D-2501)
- 14 new tests, 305 total

### WP-024 — Scheme & Mastermind Ability Execution (`various`)

- `schemeTwistHandler` + `mastermindStrikeHandler` via rule execution pipeline
- Scheme-loss at threshold (7 twists). Mastermind strike: counter + message MVP
- WP-009B stubs replaced with real handlers. 10 new tests, 291 total

### WP-023 — Conditional Hero Effects (`various`)

- `evaluateCondition` with 4 condition types (AND logic)
- `requiresKeyword` and `playedThisTurn` functional; `heroClassMatch` and `requiresTeam` safe-skip
- 15 new tests, 281 total

### WP-022 — Execute Hero Keywords (`various`)

- `executeHeroEffects` fires draw/attack/recruit/ko on `playCard`
- `ctx: unknown` avoids boardgame.io import in hero code
- 11 new tests, 266 total

### WP-021 — Hero Card Text & Keywords (Hooks Only) (`various`)

- `HeroAbilityHook[]` data-only declarations, `HeroKeyword` closed union
- Built at setup, immutable during gameplay. Execution deferred to WP-022
- 5 new tests, 260 total

---

## 2026-04-13 — Phase 4 Complete: Core Gameplay Loop

**Tag:** `phase-4-complete` | **Tests:** 247 passing (engine)

WP-014A/B through WP-020. Full MVP combat loop: villain deck composition
and reveal pipeline, City and HQ zones, fight/recruit moves with resource
gating, KO/wounds/bystander mechanics, mastermind tactics, VP scoring.
133+ DECISIONS.md entries. 8 moves operational.

---

## 2026-04-11 — Phase 3 Complete: MVP Multiplayer Infrastructure

**Tag:** `phase-3-complete` | **Tests:** 132 passing (engine)

WP-009A/B through WP-013. Rule hooks and execution pipeline (5 triggers,
4 effect types), endgame evaluation (loss before victory), lobby flow,
match list/join CLI scripts, persistence boundaries (3 classes, snapshots).
Phase 3 exit gate closed (D-1320).

---

## 2026-04-10 — Phases 0-2 Complete: Foundation through Turn Engine

FP-01/02 (Render.com backend, PostgreSQL, migrations), WP-001 through
WP-008B. Coordination system, game skeleton, card registry fixes, server
bootstrap, match setup contracts, deterministic init, player zones,
turn structure, core moves (drawCards, playCard, endTurn).

---

## 2026-04-09 — Governance System & Foundation Prompts

### EC-Driven Execution Activated

The Execution Checklist (EC) system is now the authoritative execution
contract for all Work Packets. EC-mode is formally declared in
ARCHITECTURE.md.

- 51 Execution Checklists generated, tightened, and indexed (`760f5da`)
- EC-TEMPLATE, EC_INDEX, and 3 workflow reference docs created
- EC-010 (endgame) and EC-018 (economy) established as reference ECs
- R-EC series created for registry hygiene (R-EC-01 through R-EC-03)

### Commit Hygiene Hooks

Git hooks enforce commit message format on every commit (`c522269`):
- Prefixes: `EC-###:`, `SPEC:`, `INFRA:` (all others rejected)
- Pre-commit: blocks secrets, `.test.mjs`, `node_modules`, `dist/`
- Commit-msg: validates format, forbidden words, EC file existence
- GitHub Actions CI mirror runs same checks on PRs (`6ad9070`)
- `ec-commit.ps1` helper with `-Check` dry-run mode

### Foundation Prompt 00.4 — Environment Health Check (`220a166`)

- `scripts/check-connections.mjs` — 12 named check functions for all
  external services (PostgreSQL, R2, Pages, GitHub, rclone)
- `scripts/Check-Env.ps1` — PowerShell tooling check (runs without
  Node.js or network)
- `.env.example` — definitive 9-variable reference
- `pnpm check` and `pnpm check:env` registered

### Foundation Prompt 00.5 — R2 Data Validation (`d1784ca`)

- `scripts/validate-r2.mjs` — 4-phase validation (registry, metadata,
  images, cross-set duplicates) against live R2
- Validated all 40 sets: 0 errors, 48 warnings (all known/expected)
- Added henchmen structural validation (`adc0933`)
- Fixed mastermind/villain image spot-checks to use stored `imageUrl`

### Spec Corrections

- Replaced `registry-config.json` with `metadata/sets.json` across all
  active docs — the file never existed in R2 (`d582d16`)
- Reverted mgtg mastermind VP to `null` — correct per physical cards,
  not a data defect (`ebbc807`)

### Registry Hygiene (R-EC Series)

- R-EC-01: `[object Object]` abilities fixed on R2 (msmc, bkpt, msis)
- R-EC-02: mgtg VP confirmed as null-by-design
- R-EC-03: Missing images resolved (hero images uploaded, tactic-only
  masterminds handled correctly in spot-check)

### Documentation

All human-facing docs rewritten to reflect actual project state:
- `01-REPO-FOLDER-STRUCTURE.md` — accurate directory tree (`abfc594`)
- `03-DATA-PIPELINE.md` — 40-set migration complete (`4ddeb44`)
- `04-DEVELOPMENT-SETUP.md` — real scripts only (`23021bb`)
- `05-ROADMAP.md` + mindmap — full WP roadmap (`14d493f`)
- `06-TESTING.md` — `node:test` conventions, not Vitest (`d13045f`)
- `07-CLI-REFERENCE.md` — working commands only (`a6748e0`)
- `08-DEPLOYMENT.md` — live infrastructure vs planned (`b781c1a`)

### Governance Artifacts Created

| Artifact | Count | Purpose |
|---|---|---|
| `.claude/rules/*.md` | 7 | Per-layer enforcement rules |
| Execution Checklists | 51 | Binary execution contracts |
| Work Packets | 47 | Design authority documents |
| DECISIONS.md entries | 24 | Immutable architectural decisions |
| REFERENCE docs | 12 | Authoritative project memory |

---

## 2026-04-02 — Registry Viewer Enhancements

- Added rules tooltips to card detail views (`8fc228d`)
- Fixed tooltip implementation to use native title attribute (`43648b3`)

---

## 2026-03-31 — Schema Fixes

- Fixed Zod schema for shld and other sets with missing fields (`e24847f`)
- Made hero card `name` field optional in schema to accommodate
  transform card back-faces (`56a8c75`)

---

## 2026-03-23 — Project Initialization

- Initial commit: Registry Viewer SPA with 7 card sets (`d5ea067`)
- Monorepo structure: `packages/registry/`, `apps/registry-viewer/`
- Cloudflare R2 bucket configured at `images.barefootbetters.com`
- Cloudflare Pages deployment for registry viewer
- Fixed build errors for Pages deployment (`507b562`)
- Added BKWD (Black Widow) set (`5cb0e13`)
- Expanded to all 40 sets in eagerLoad (`09f9c97`)

---

## Changelog Conventions

- Work Packets referenced as `WP-NNN`, Foundation Prompts as `FP-NN`
- Commit hashes included for traceability
- Breaking changes marked with `⚠️`
- Entries grouped by: features, technical, documentation, governance

**See also:**
- [05-ROADMAP.md](05-ROADMAP.md) — current Work Packet status
- [ai/work-packets/WORK_INDEX.md](ai/work-packets/WORK_INDEX.md) — execution order
- [ai/STATUS.md](ai/STATUS.md) — latest project state
