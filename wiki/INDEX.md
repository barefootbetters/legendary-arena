# Wiki Index

> **44 / 50** entity pages.
> Last regenerated: 2026-07-20.
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

## System

Coordinated subsystems spanning multiple files / phases.

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
- [Profile Login](profile-login.md) — Player sign-in and profile
  surface (Hanko broker); the whole auth stack ships into arena-client
  (`play.legendary-arena.com`); the marketing site (`www.`) has no
  sign-in surface of its own.

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
- [Legendary Arena — Tribe and Trust](legendary-arena-tribe-and-trust.md) —
  *(draft, research)* the "filtering is the product" growth thesis: the
  four-layer trust fence (gate → quarantine → community flag →
  behavioural backstop), the tribe-fit filters, and the player survey —
  plus a first-pass **threat model** (named threat-actor categories,
  STRIDE/LINDDUN, a prioritized threat→mitigation table mapped to the four
  layers, the missing account-security controls, and the business-lens
  residual risk that an over-strict gate churns real players). Also covers
  the "birds of a feather, verified" risk-tiered tribe-fit filters, the
  refined AARRR+tribe growth buckets and subscription pitch, the proposed
  vetting process, six STRIDE attack trees, a control-implementation playbook
  (dating-app/social-platform vetting incl. the Tinder/Hinge/Bumble liveness
  stack, bot detection, risk-triggered CAPTCHA), the operator-side controls
  (segregation of duties, least privilege, Zero Trust, regulated-finance
  KYC/sanctions parallels), and a proposed staff/moderator training outline.
  Descriptive of a draft strategy; defines no controls.
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
  `play.legendary-arena.com`. Defines the **shared trigger spine** — the
  one canonical table of engine events (`notableEvents`,
  `lastPlayEffectsFired`, endgame outcomes) that the visual, audio,
  dopamine, and narrative frameworks all react to — so the framework pages
  cross-link through the engine's own event names instead of siloing.
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
- [Dopamine Trigger Framework](dopamine-triggers.md) — *(draft, research)*
  the reward-psychology layer under the sensory frameworks: classifies each
  shared-trigger-spine event as reward / threat / relief, and specs the
  pacing discipline (variable reward, escalating combo reward, loss
  aversion, peak-end) that times the visual + audio cues. Engagement craft
  inside the Vision bright lines, never spend-pressure.
- [Narrative Psychology Framework](narrative-psychology.md) — *(draft,
  research)* the meaning-and-resonance layer: maps each spine event to a
  good-versus-evil story beat via Marvel archetype, nostalgia, and agency
  hooks. Houses the **Playstyle Modes** builder-versus-destroyer lens — a
  preference toggle that re-frames the same engine events as heroic rescue
  or villain conquest without building two games.

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
