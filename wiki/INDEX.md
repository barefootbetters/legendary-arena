# Wiki Index

> **61 / 76** entity pages.
> Last regenerated: 2026-08-22.
> See [SCHEMA.md](SCHEMA.md) for the entity-page contract and
> [README.md](README.md) for purpose, conventions, and authority —
> including [§ Tradeoffs](README.md#tradeoffs) on what the LLM-wiki
> pattern buys and costs.

---

## Mechanic

Discrete in-game mechanics with specific triggers and effects.

- [Master Strike](master-strike.md) — Trigger fired on
  `mastermind-strike` reveal from the villain deck. MVP handler
  increments `masterStrikeCount`; full per-mastermind tactic
  resolution pending a future WP.
- [Scheme Twist](scheme-twist.md) — Trigger fired on `scheme-twist`
  reveal. Drives the `ENDGAME_CONDITIONS.SCHEME_LOSS` counter via the
  predict-post-effect handler pattern.
- [Wounds](wounds.md) — Unplayable filler cards; the Healing ability KOs
  all Wounds from hand if the player doesn't recruit or fight, an
  acted/healed mutual exclusion enforced both ways (D-24179 / D-24180).

## System

Coordinated subsystems spanning multiple files / phases.

- [Card Effect System](card-effect-system.md) — How printed card
  text becomes executable, deterministic state changes: inline data
  markers → setup-time descriptors on `G` → a small closed set of
  executors. Covers the three effect subsystems (hero / villain /
  scheme-mastermind), the composable-primitive AST, the marker-authoring
  overlay scripts, the coverage tooling behind `/coverage`, and the
  scaling directions + known gaps for the next ~500 effects (incl. the
  hand-coded Master Strike path).
- [Villain Deck](villain-deck.md) — Reveal pipeline for the
  antagonist stack; classifies drawn cards into one of five
  `RevealedCardType` values and routes the appropriate trigger.
- [Turn System](turn-system.md) — Two-level temporal state machine:
  four match phases (`MATCH_PHASES`) × three turn stages
  (`TURN_STAGES`); transition discipline via `// why:` comments.
- [Rule Execution Pipeline](rule-execution-pipeline.md) — Two-
  registry (data in `G`, functions outside), two-phase
  (`executeRuleHooks` → `applyRuleEffects`) mechanism for
  translating triggers into deterministic state changes.
- [Scoring](scoring.md) — Two-layer measurement: scenario `ParBaseline`
  (Layer A) + per-match `FinalScore` (Layer B); version-pinned,
  replay-verified, JSON-serializable.
- [Leaderboard](leaderboard.md) — The public Legends Attract Board
  ("Hall of Legends", `apps/legends-board` → `legends.legendary-arena.com`,
  domain not yet live); R2-snapshot-driven, zero-auth; keyed on the
  engine's `ScenarioKey`. Includes the proposed annual-championship tier
  structure (overall / per-mastermind set-gauntlet / skill tiers) as open
  questions.
- [PAR Simulation Calibration](par-simulation-calibration.md) — The
  Monte-Carlo pipeline that *devises* a scenario's PAR: the T2 competent
  heuristic plays 500+ complete games, each scored with the live Raw Score
  formula, and PAR is the 55th percentile of the distribution; hashed,
  immutable `seed`/`simulation` artifacts gate leaderboard submission.
- [Seed Challenges](seed-challenges.md) — *Proposed.* Shared-seed
  competitive boards: every entrant plays the *identical* seeded game, so
  ranking reflects decisions rather than luck of the draw. Adds
  daily/weekly/all-time views and a pre-publication seed-vetting step
  (reusing the PAR simulation harness). Not yet built — design in
  `docs/ai/DESIGN-SEED-CHALLENGES.md`.
- [Profile Login](profile-login.md) — Player sign-in and profile
  surface (Hanko broker); the whole auth stack ships into arena-client
  (`play.legendary-arena.com`); the marketing site (`www.`) has no
  sign-in surface of its own.
- [Play Board](play-board.md) — The rendered game mat on
  `play.legendary-arena.com`: which board zone reads which `UIState`
  field, and the two-stage projection→render contract (`buildUIState` →
  the `filterUIStateForAudience` audience whitelist). Documents the
  whitelist drop hazard and the ability-text marker vocabulary
  (`[icon:…]` / `[hc:…]`) the Card Reader renders.

## Concept

Abstract data shapes, contracts, and design concepts.

- [CardExtId](cardextid.md) — Named `string` alias for card
  identifiers; format `<setAbbr>/<slug>`; the zone-storage
  invariant — every zone in `G` stores `CardExtId` strings only.
- [Card Type Taxonomy](card-type-taxonomy.md) — Registry-side
  closed-set classification (13 entries: 10 top-level + 3 SHIELD
  sub-chips); consumed by the Registry Viewer ribbon, **not** by
  the engine or registry loaders.
- [Board Keywords](board-keywords.md) — `patrol` · `ambush` · `guard`
  closed three-value union; structural City rules (not hero
  abilities); Ambush wound-flow uses an inline pattern (D-2403)
  pending future migration to a `gainWound` `RuleEffect`.
- [R2 Image Naming Convention](r2-image-naming-convention.md) —
  deterministic `{set}/{set}-{prefix}-{slug}.webp` rule mapping card data to
  Cloudflare R2 image URLs; the full 37-entry card-type prefix registry
  (`sc` · `mm` · `vi` · `hr` · `sa` · `tr` · …) lives in the upstream
  `card-types.json`, with the imaged subset auto-composed by the convert pipeline.

## Card-Type

High-level card categorizations recognised by the engine.

- [Scheme](scheme.md) — Macro-villain plot; the three-layer scheme
  machinery (configuration field via `MatchSetupConfig.schemeId`,
  setup-time mutator via `SchemeSetupInstruction`, runtime
  participant via Scheme Twist).

## Guide

Cross-cutting governance, methodology, and readiness assessments.

- [Card Image Acquisition](card-image-acquisition.md) — *(draft)* the
  card-image staging chain (scrape → convert → rename): per-set
  PowerShell scrapers pull card face JPEGs from the
  `legendarycardgame.com` at-a-glance pages, ImageMagick converters
  re-encode to WebP, and a hand-authored renamer maps each to the
  deterministic R2 name, ahead of R2 upload. Backup copies live in
  `scripts/card-image-{downloaders,converters,renamers}/`.
- [Vision](vision.md) — Reader's map of `docs/01-VISION.md`: the five
  non-negotiable primary goals, the secondary goals and their identity
  / profile boundaries (§7a, §19a/b), the PAR skill-measurement
  framework (§20–26), the NG-1…NG-8 monetization bright lines and the
  open commercial space beside them, and the "no margin, no mission"
  funding model. Cites VISION; defines nothing.
- [Soul of Legendary Arena](soul-of-legendary-arena.md) — *(draft)* the
  thematic-soul essay: the game as *stewardship, not reinvention*. Names
  the modern "tear down the mentor / retcon the classic hero" pattern and
  the self-made-hero lie, draws the honoring-vs-flattening line (addition
  vs overwrite), and shows the three mechanisms that carry a
  lineage-honoring authorial voice to players — faithful reproduction
  (Content Authenticity), the deck-builder as a humility engine, and the
  character-history content loop. Interprets VISION and the Soul / Authorial
  Voice principle; defines nothing.
- [Legendary Arena — Tribe and Trust](legendary-arena-tribe-and-trust.md) —
  *(draft, research)* the "filtering is the product" growth thesis: the
  four-layer trust fence (gate → quarantine → community flag →
  behavioural backstop), the "birds of a feather, verified" risk-tiered
  tribe-fit filters, the refined AARRR+tribe growth buckets and subscription
  pitch, the proposed vetting process, and the player survey — plus a
  **threat model** (named threat-actor categories, STRIDE/LINDDUN, six attack
  trees, a threat→mitigation table mapped to the four layers, operator-side
  controls (segregation of duties, least privilege, Zero Trust,
  regulated-finance KYC/sanctions parallels), the business-lens residual
  risk, and a proposed staff/moderator training outline). The concrete
  control-implementation techniques live in its companion
  [Trust Controls Playbook](trust-controls-playbook.md). Descriptive of a
  draft strategy; defines no controls.
- [Trust Controls Playbook](trust-controls-playbook.md) — *(draft, research)*
  the implementation companion to Tribe and Trust: the concrete techniques
  that would build each layer's controls — mature-platform vetting (liveness
  photo verification, multi-signal identity binding, progressive trust,
  reporter-reputation weighting, age assurance), the external-account-linking
  reliability ranking (corroboration only; BoardGameGeek/Steam lead), bot
  detection, and risk-triggered CAPTCHA — each mapped back onto the parent's
  four layers and threat numbers (T1–T10). Descriptive; defines no controls.
- [Changelog](changelog.md) — Milestone history of significant changes,
  newest first (projected from `docs/09-CHANGELOG.md`; the exhaustive
  per-packet record lives in WORK_INDEX + git log).
- [Data & File Locations](data-file-locations.md) — Locator map for
  where data and files live: card JSON + the convert pipeline,
  metadata, the Postgres `legendary.*` tables, R2 key prefixes,
  replays / LAGN, env / config, and the docs / coverage dirs. Links
  out to the deep pages rather than restating them.
- [Workspace Map](workspace-map.md) — *(draft)* The locator map one
  level above the repo: which of the three storage surfaces (git,
  pCloud, hosted) owns which kind of work, the top-level buckets on
  each, and where video, vendor attachments, and work-in-progress
  stage. Defers to [Data & File Locations](data-file-locations.md) at
  the repo boundary.
- [Development Workflow](development-workflow.md) — The
  develop-from-anywhere loop: laptop / workstation / phone drive
  Claude Code sessions on WP/EC contracts → GitHub → auto-deploy via
  Render + Cloudflare on merge to `main`; a nightly CI triage agent
  turns sweep results into new work packets.
- [GitHub Parallel-Session Workflow](github-parallel-session-workflow.md) —
  *(draft)* best practices and pain points for running two or more Claude
  Code sessions against GitHub at once. Separates the **working-tree race**
  (shared HEAD/index — solved completely by worktrees) from the
  **shared-file merge collision** (`WORK_INDEX.md`, `EC_INDEX.md`,
  `DECISIONS.md`, the roadmap mindmap — *not* solved by worktrees; needs
  reserve-first, `merge=union`, and table regeneration). Answers the
  worktree question directly and catalogs the pCloud silent-revert /
  `[conflicted N]` / squash-merge-audit gotchas.
- [Disaster Recovery](disaster-recovery.md) — Operator playbook (mirror
  of `docs/ops/DISASTER_RECOVERY.md`) for restoring **service** after
  infrastructure loss: the two backup layers (Render managed + the WP-416
  `pg_dump` → R2 external copy), the five recovery scenarios (DR-01…DR-05)
  with honest recoverability verdicts, and the capability-graded validation
  checklist. The remaining gap is operational — provision the backup
  secrets and drill a restore.
- [AI Second Brain](ai-second-brain.md) — *(draft, planning)* proposed
  self-hosted knowledge platform where the corpus is owned and durable while
  the agent layer stays swappable — *knowledge is permanent, agents are
  replaceable.* Ten vendor-neutral design principles, a PostgreSQL + pgvector /
  LiteLLM / Open WebUI / MCP stack, the per-domain knowledge repositories, and
  the backup-and-restore discipline it inherits from Disaster Recovery. The
  knowledge-architecture companion to the host-build page
  [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md); no `D-`/`WP-` yet.
- [Homepage Marketing Scorecard](homepage-marketing-scorecard.md) —
  SB7 + Player Needs Pyramid graded assessment of the homepage;
  tracks readiness across three questions (Problem / Product / Results).
- [Homepage Spec](homepage-spec.md) — Build document for the homepage:
  hero copy, Problem → Product → Result sections, Final Homepage
  Output, readiness checklist, severity-tiered GO / NO-GO.
- [Homepage Appendix](homepage-appendix.md) — Strategy reference:
  Player Needs Pyramid, 28-problem catalog, badge architecture,
  L2→L4 dependency, content framework (Sales / Narrative / Authority).
- [Homepage Review Template](homepage-review-template.md) —
  Original unified SB7 review: full 28-problem catalog, Player Needs
  Pyramid, badge architecture, and readiness checklist in one document.
- [Brevo Email Pipeline](brevo-email-pipeline.md) — Brevo email
  engagement pipeline: signup, double opt-in, welcome sequence,
  nurture drip, and re-engagement flows.
- [Hugo Web System](hugo-web-system.md) — Marketing site Hugo
  architecture: PaperMod theme overrides, template hierarchy,
  partials pipeline, brand tokens, Pagefind search integration.
- [Ewiki Authoring](ewiki-authoring.md) — Style and formatting
  reference for writing ewiki content: blockquotes, tables, code
  blocks, emoji, CSS variables, and two-repo editing procedures.
- [Legendary Forge — Diorama Platform](legendary-forge.md) — Overview of
  the plug-and-play diorama venture: architecture, Smart Hub, connector
  strategy, business model, and status; canonical deep docs stay in its
  own private repo for sellability.
- [Video Production Workflow](video-production-workflow.md) — Ten-step
  pipeline from idea to published video, producing three artifacts per
  video: the video, 3-7 Shorts clips, and a companion blog post on
  `legendary-arena.com`.
- [YouTube Channel Plan](youtube-channel-plan.md) — StoryBrand-driven
  plan for the "Legendary Arena" channel: four series across the SB7
  content modes and Player Needs Pyramid; the transitional CTA the
  homepage needs.
- [Design System Overview](design-system-overview.md) — *(draft,
  research)* the north-star hub for the sensory-and-feel layer of
  `play.legendary-arena.com`, and the **shared contract** the two sensory
  frameworks implement. Defines the **shared trigger spine** — the one
  canonical table of engine events (`notableEvents`, `lastPlayEffectsFired`,
  endgame outcomes) the visual and audio layers react to — plus the reward
  classification, pacing invariants, and the visual–audio pairing table. Now
  also houses the **reward-psychology** (the seven reward drivers, the
  variable-ratio schedule, card-counting / anticipation, the flow channel,
  peak-end) and **narrative-meaning** (archetype / good-versus-evil /
  nostalgia / agency hooks, the builder-versus-destroyer Playstyle lens)
  references that were formerly the standalone Dopamine Trigger and Narrative
  Psychology pages.
- [Responsive Viewport Targets](responsive-viewport-targets.md) — *(draft)*
  the desktop-first responsive posture of `play.legendary-arena.com`: the
  one locked breakpoint (D-12909, `max-width: 767px`) splitting
  `<PlayDesktop>` from `<PlayMobile>`, the two layouts' design ranges
  (1280×800–1920×1080 / 375×667–414×896), the reference desktop
  resolutions to test against, and the still-open question of fluid
  desktop scaling and an ultra-wide max-width cap.
- [Visual Effects Framework](visual-effects.md) — *(draft, research)* the
  in-game "juice" layer: escalating chain-reaction combo flashes off
  `UIState.game.lastPlayEffectsFired` (buildable today, mirroring the
  shipped audio combo cue), particle bursts, screen-shake, card motion,
  and full-screen finales. The visual twin of Sound Effects; wired to the
  Design System Overview's shared trigger spine. Includes the MIT-first
  library posture, GPU-cheap performance budget, and the mandatory
  `prefers-reduced-motion` accessibility gate.
- [Sound Effects](sound-effects.md) — *(draft, research)* design
  reference for adding audio to `play.legendary-arena.com`: maps the
  client-visible signals (notable events, `appliedEffects` for
  wound/KO/bystander-capture, player moves) to candidate sounds, and
  specifies an adaptive background score driven by a danger meter
  (`escapedVillains` + `scheme.twistCount`). Includes a CC0-first
  library survey (Kenney, OpenGameArt, Freesound, Incompetech, Zapsplat)
  and the horizontal-re-sequencing + howler.js implementation shape.
- [Music Authoring](music-authoring.md) — *(draft)* the Suno pipeline
  for per-theme and per-hero music: one seed → eight derivatives (four
  `MT` tracks + four `ES` event stings), WAV masters local, MP3s to R2,
  wired through `themeSchemaVersion: 2` theme JSON (`musicAssets`).
  Covers the crop scripts, file-naming lock, and working-vs-tracked
  layout; companion to Sound Effects.
- [Gameplay Strategy](gameplay-strategy.md) — *(draft, research)* the
  **skill model**: where skill actually lives in a Legendary Arena match,
  ranked by leverage — Rank 0 Hero Deck construction, Rank 1 play order and
  class synergy, Rank 2 Mastermind timing, then recruiting / City combat /
  KO, plus deck thinning as the second-highest lever. The companion the
  rest of the wiki assumes: [Scoring](scoring.md) measures this skill, the
  [PAR simulation](par-simulation-calibration.md) performs it, and the
  dopamine / narrative frameworks promise to reward it. Verified against the
  v23 rules; the synergy math is illustrative, not calibrated.

## Tutorial

Step-by-step walkthroughs for completing specific tasks.

- [Wiki Viewer](wiki-viewer.md) — How to create, edit, preview,
  and publish ewiki pages: page template, commit prefixes, build
  pipeline, markdown syntax, and local dev server.
- [Hugo Onboarding](hugo-onboarding.md) — Day-one ramp for the
  `www.legendary-arena.com` marketing site: WordPress→Hugo mental
  model, from-scratch local setup, project tour, and step-by-step
  recipes for common tasks (menus, products, posts, hotfixes).
- [Figma Logo Design](figma-logo-design.md) — Deterministic
  pipeline for building production-grade SVG logo systems in Figma.
- [Blog Post Authoring](blog-post-authoring.md) — Writing and
  styling blog posts on `www.legendary-arena.com`: Mode C content
  framework, 28-problem catalog mapping, brand tokens, CTA system,
  image conventions, and annotated template.
- [Newsletter Authoring](newsletter-authoring.md) — Writing and
  sending weekly email newsletters via Brevo: Mode B content
  framework, 10-section email structure, CTA rotation, UTM tracking,
  pre-send QA checklist, and annotated template.
- [Complete-Game Fixtures](complete-game-fixtures.md) — Authoring
  complete-game regression tests: fixture file format, the three
  oracle layers, recorder CLI walkthrough, re-recording workflow
  after intentional engine changes, and constraints. Pairs with
  the operator reference at `docs/ai/REFERENCE/complete-game-tests.md`.
- [After Effects Stop-Motion Hero Loop](after-effects-stop-motion-hero-loop.md)
  — Producing a 5-7 second seamlessly-looping stop-motion hero
  video for muted-autoplay marketing slots: PNG-sequence workflow
  for per-frame control, Posterize Time fast fallback, loop-boundary
  technique, Media Encoder handoff, and the UI-overlay layer that
  makes a generic clip read as a digital card game.
- [Ubuntu Lab Provisioning](ubuntu-lab-provisioning.md) — *(draft,
  non-production)* walkthrough for a personal DigitalOcean Ubuntu 24.04
  droplet used as an operator **learning lab, staging host, and future
  migration target** — never a production cutover. Droplet hardening
  (UFW / Fail2Ban / unattended-upgrades), the Node/PM2/Nginx/Certbot
  stack, deploying `apps/server` against a **copy** of the DB, the
  app↔DB latency probe that would gate any stateless-server move, and a
  Postgres restore drill. Shadows the live Render topology in the
  [Architecture Inventory](architecture-inventory.md); records no
  decision to leave Render.

## Tool

Software tools and services used in development or operations.

- [Dashboard](dashboard.md) — Internal admin / operations SPA
  (`@legendary-arena/dashboard`, Vue 3 + PrimeVue 4 + Vite) at
  `dashboard.legendary-arena.com`; a mock-mode-first "morning operating
  system" (Audience → Revenue Engine → Retention) behind a Hanko login +
  Cloudflare Access gate. Self-contained (no `@legendary-arena/*` runtime
  imports); its **Dashboard Gates** CI job runs lint / typecheck /
  coverage-tested / format-check / build as blocking gates.
- [LAGN Specification](lagn-v1.md) — Legendary Arena Game
  Notation: the published npm spec (`@legendary-arena/lagn`) with Zod
  validator, a JSON Schema derived from it, TypeScript types, and a `lagn`
  CLI; three optional tiers (setup / card catalog / replay log).
- [Operational Health Checks](operational-health-checks.md) — Two
  operator probes: `pnpm check` walks the environment, toolchain,
  and external-service connectivity (PostgreSQL, R2, Pages, Hanko
  JWKS / CORS, API server CORS, arena-client bundle env inlining,
  GitHub, rclone); `pnpm check:domains` walks the canonical
  subdomain manifest and classifies each entry against its declared
  `live` / `planned` state.
- [Play Diagnostics](play-diagnostics.md) — The client-side
  capture-and-export tool on `play.legendary-arena.com`: an always-on
  bounded buffer records `console.*` + uncaught errors, and the
  "Download diagnostics" button bundles that buffer with the live
  UIState snapshot, the input match setup, and derived effect
  provenance into one credential-redacted JSON report for diagnosing a
  frozen match. Sibling to Operational Health Checks (client-side vs
  perimeter). Notes the current transport/perf-data gap.
- [Debug Effects](debug-effects.md) — *(draft)* the per-card
  effect-debugging entry point — *"card X's ability didn't fire, why?"* —
  mapping the shipped surfaces (the generated `card-mechanics.json` index, the
  mechanic ledgers, the hollow-effect detector, `unresolvedMarkers`, and Play
  Diagnostics provenance) and recording the **proposed** unification: a
  generated effect-implementation index with descriptor → handler mapping plus
  runtime effect traces behind a `/debug/effects` viewer. Derived, never a
  hand-maintained card → effect lookup.
- [Windows Engine Exe](windows-engine-exe.md) — *(draft, planning)*
  proposed standalone Windows `.exe` that packages the engine's
  headless `simulation/` harness (bot-vs-bot play, fixture replay,
  determinism proof) into a single Node-free binary. Descriptive
  companion to `docs/ai/WINDOWS-EXE-PACKAGING-STRATEGY.md`.

## Brand

Brand governance and commercial-positioning references.

- [Monetization Model](monetization-model.md) — How Legendary Arena
  makes money: four fairness-safe revenue streams (canonical:
  VISION §Financial Sustainability), the locked profile-page
  free/paid boundary, and the Legendary Forge
  physical→digital cosmetic-unlock bridge. Cites VISION; defines
  nothing.
- [IP Licensing](ip-licensing.md) — The two *separate* rights Legendary
  Arena needs but does not yet license (Upper Deck's *Legendary* system +
  Marvel's **digital** character rights, which UD never held — the reason
  *Legendary DXP* is a fantasy reskin, not Marvel), why Upper Deck is the
  warm entry point toward a joint/tri-party Marvel deal, the realistic
  economics (15–30% per licensor + non-refundable minimum guarantee, not
  the assumed $10k/10%), and the market-gap opportunity (no official
  digital Marvel Legendary exists). Cites the marketing-repo acquisition
  plan + VISION; defines nothing.

## Keyword

*No v1 entries.* Hero keywords (Recruit, Attack, Draw, etc.) and
additional structural keywords are candidates for future entries
once the v2 anchor list is locked.

---

## By tag (selected)

Wiki pages carry open-vocabulary `tags` in front-matter. The
following are useful entry points:

- **`drift-detection`** — Closed sets backed by canonical readonly
  arrays + drift-detection tests:
  [Card Effect System](card-effect-system.md),
  [Villain Deck](villain-deck.md),
  [Rule Execution Pipeline](rule-execution-pipeline.md),
  [Turn System](turn-system.md),
  [Card Type Taxonomy](card-type-taxonomy.md),
  [Board Keywords](board-keywords.md),
  [Scoring](scoring.md),
  [PAR Simulation Calibration](par-simulation-calibration.md),
  [Complete-Game Fixtures](complete-game-fixtures.md)
- **`determinism`** — Pages where the engine's determinism invariant
  is the load-bearing concern:
  [Rule Execution Pipeline](rule-execution-pipeline.md),
  [Turn System](turn-system.md),
  [CardExtId](cardextid.md),
  [Scoring](scoring.md),
  [PAR Simulation Calibration](par-simulation-calibration.md),
  [Complete-Game Fixtures](complete-game-fixtures.md)
- **`trigger`** — Pages that emit or consume rule triggers:
  [Villain Deck](villain-deck.md),
  [Master Strike](master-strike.md),
  [Scheme Twist](scheme-twist.md),
  [Rule Execution Pipeline](rule-execution-pipeline.md),
  [Turn System](turn-system.md)
- **`layer-engine`** — Pages anchored in the engine layer (most
  pages — see individual front-matter for the full set).
- **`hugo`** — Pages covering Hugo site infrastructure:
  [Wiki Viewer](wiki-viewer.md),
  [Hugo Web System](hugo-web-system.md),
  [Hugo Onboarding](hugo-onboarding.md),
  [Ewiki Authoring](ewiki-authoring.md)
- **`layer-marketing`** — Pages anchored in the marketing layer:
  [Homepage Marketing Scorecard](homepage-marketing-scorecard.md),
  [Homepage Spec](homepage-spec.md),
  [Homepage Appendix](homepage-appendix.md),
  [Homepage Review Template](homepage-review-template.md)
- **`layer-registry`** — Pages anchored in the registry layer:
  [Card Type Taxonomy](card-type-taxonomy.md),
  [CardExtId](cardextid.md) (cross-cuts engine + registry),
  [R2 Image Naming Convention](r2-image-naming-convention.md).
- **`auth`** — Player sign-in and identity:
  [Profile Login](profile-login.md),
  [Dashboard](dashboard.md) (Hanko login + Cloudflare Access gate),
  [Operational Health Checks](operational-health-checks.md)
  (Hanko JWKS / CORS probes).
- **`data-pipeline` / storage** — Where data and files live:
  [Data & File Locations](data-file-locations.md),
  [R2 Image Naming Convention](r2-image-naming-convention.md),
  [LAGN Specification](lagn-v1.md),
  [Card Type Taxonomy](card-type-taxonomy.md).

---

*To regenerate this index after page changes, see
[README.md § Updating an existing page](README.md).*
