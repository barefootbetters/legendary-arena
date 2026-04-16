WP-033 is complete (commit 1c9c12d EC-033, local on main as of
2026-04-16 — **not yet pushed to origin/main**). Key context for
WP-034:

- 376 engine tests passing, 96 suites, 0 fail
- 10 moves unchanged: drawCards, playCard, revealVillainCard,
  fightVillain, fightMastermind, recruitHero, advanceStage, endTurn,
  setPlayerReady, startMatchIfReady
- LegendaryGameState UNCHANGED by WP-033 — no new fields, no shape
  change. Content validation is a pre-engine gate; it observes content
  before Game.setup() ever sees it. G is not extended.
- Phase 6 (Verification, UI & Production) continues
- WP-034 is the next unblocked WP (depends on WP-033, which is complete)
- WP-034: Versioning & Save Migration Strategy — three independent
  version axes (EngineVersion semver, DataVersion integer,
  ContentVersion integer); VersionedArtifact<T> embeds all stamps at
  save time; checkCompatibility returns structured result
  (compatible / migratable / incompatible); migrations forward-only,
  pure, deterministic; incompatible + unmigratable = fail loud
  (D-0802); engine never guesses old data meaning; implements D-0003,
  D-0801, D-0802

WP-033 artifacts (engine-category, content validation layer):
- `packages/game-engine/src/content/` — new engine subdirectory
  classified as engine code category (D-3301)
- `content.schemas.ts` — declarative schema descriptors
  (`ContentSchemaDescriptor` shape) for six content types: HERO_CARD_SCHEMA,
  VILLAIN_CARD_SCHEMA, HENCHMAN_CARD_SCHEMA (mirrors VillainCard per
  D-3302), MASTERMIND_CARD_SCHEMA, SCHEME_CARD_SCHEMA, SCENARIO_SCHEMA;
  plus local constants ACCEPTED_CONTENT_TYPES (6-member accept list,
  internal to validator) and HERO_CLASSES (locally re-declared per RS-9 /
  D-3301 to avoid registry import). Pure data — no runtime code, no
  functions, no closures.
- `content.validate.ts` — `validateContent(content, contentType,
  context?)` and `validateContentBatch(items, context?)` pure functions.
  Five-stage pipeline: accept-list → structural → enum → cross-reference
  (silently skipped when `context` absent) → hook consistency. Returns
  `ContentValidationResult` (discriminated union: `{ valid: true }` or
  `{ valid: false; errors: ContentValidationError[] }`). Never throws,
  never mutates inputs, no `reduce`, no registry import, no boardgame.io
  import. Unknown `contentType` produces a locked full-sentence error
  shape (copilot RISK #10/#21 resolution).
- `content.validate.test.ts` — 9 tests in 1 `describe` block covering
  valid hero, missing-field, invalid-keyword, mastermind-with-tactics,
  mastermind-without-tactics, scheme invalid setup type, cross-reference
  with/without context (RS-3 lock, both halves in one test), batch
  aggregation, all-full-sentence + unknown-contentType (Parts A/B/C).
- `types.ts` — additive re-exports: ContentValidationResult,
  ContentValidationError, ContentValidationContext
- `index.ts` — additive exports: validateContent, validateContentBatch +
  all 3 types
- `ContentValidationContext` is a caller-injected local structural
  interface with four optional `ReadonlySet<string>` fields
  (`validVillainGroupSlugs`, `validMastermindSlugs`, `validSchemeSlugs`,
  `validHeroSlugs`). Runtime call-site parameter ONLY — MUST NOT be
  stored in G, persisted, or serialized (D-1232 forbids Set in G). At
  any serialization boundary, convert to `readonly string[]`.

WP-033 does not directly block WP-034. WP-034 depends on WP-033
(which is complete) because WP-034's versioning applies to persisted
artifacts — content definitions (Class 2) are now validated via
WP-033's `validateContent`, which gives WP-034 a stable pre-persistence
gate for the `ContentVersion` axis.

Key pre-flight discoveries from WP-033 that may apply to WP-034:
- P6-22: Verification grep gates match docstring literal mentions of
  forbidden tokens, not just `boardgame.io`. If WP-034 introduces
  strict binary "no output" grep gates (e.g., for forbidden imports in
  a new `versioning/` or `migration/` directory), avoid writing the
  forbidden tokens as literal substrings anywhere in the new files —
  including in docstrings and rationale comments. Use paraphrased
  wording ("array reduce" instead of `.reduce()`; "the game framework"
  instead of `boardgame.io`). Established Patterns in 01.4 now
  reflects this broader scope.
- P6-23: Validators with string-discriminated dispatch must not
  silent-pass unknown inputs. If WP-034's `checkCompatibility` accepts
  a version-kind discriminator (e.g., `axis: 'engine' | 'data' |
  'content'`) or any other string discriminator, pre-flight must
  specify a Stage-0 accept-list check and a locked error shape for
  unrecognized values. Silent pass is forbidden. The Established
  Patterns entry in 01.4 now documents this as a canonical pattern.
- P6-24: Author-facing validation schemas are separate from, and
  deliberately stricter than, permissive data-loader schemas. If
  WP-034 introduces any new validation for versioned artifact envelopes,
  check whether it validates *persisted shipped data* (should be
  permissive to accept prior version formats) or *newly-authored
  versioned artifacts* (should be strict). Do NOT merge these two
  layers.
- P6-25: Fourth consecutive Contract-Only WP confirms the pre-flight
  pipeline is steady-state for well-scoped WPs. The code-category
  PS-# pattern is now locked through four precedents (D-3001
  campaign/, D-3101 invariants/, D-3201 network/, D-3301 content/).
  If WP-034 introduces a new engine subdirectory (e.g.,
  `packages/game-engine/src/versioning/` or `src/migration/`),
  pre-flight MUST produce a `D-34NN` "Directory Classified as Engine
  Code Category" entry — no exceptions. Missing classification is an
  automatic PS-# blocking finding.
- P6-21 still applies: WP-034 depends on no `G`-mutation and no
  lifecycle wiring, so a zero-deviation Contract-Only run is the
  expected shape if pre-flight resolves every risk pre-session.

Key architectural patterns still in effect:
- D-0001 (Correctness Over Convenience)
- D-0002 (Determinism Is Non-Negotiable)
- D-0003 (Data Outlives Code) — **WP-034 implements**
- D-0101 (Engine Is the Sole Authority)
- D-0102 (Fail Fast on Invariant Violations)
- D-0401 (Clients Submit Intents Only) — WP-032
- D-0402 (Engine-Authoritative Resync) — WP-032
- D-0601 (Content Is Data, Not Code) — WP-033
- D-0602 (Invalid Content Cannot Reach Runtime) — WP-033
- D-0603 (Representation Before Execution) — governs data-only contracts
- D-0801 (Explicit Version Axes) — **WP-034 implements**
- D-0802 (Incompatible Data Fails Loudly) — **WP-034 implements**
- D-1002 (Immutable Surfaces Are Protected) — replay semantics,
  rules, RNG behavior, scoring cannot change without major engine
  version — directly relevant to WP-034
- D-1232 (No `Set` in G) — applies to any versioning runtime data
- D-1234 (Graceful degradation for unknown types — warn via
  G.messages, continue) — may or may not apply to WP-034 given
  D-0802 "fail loud" mandate; pre-flight should resolve
- D-3201 (Network directory as engine code category) — WP-032
- D-3301 (Content directory as engine code category) — WP-033
- D-3302 (Henchman schema mirrors VillainCard shape) — WP-033
- D-3303 (Content validation is author-facing and separate from
  registry Zod schemas) — WP-033

Files WP-034 will likely need to read or depend on:
- `packages/game-engine/src/replay/replay.types.ts` — `ReplayInput`,
  `ReplayMove`, `ReplayResult` (WP-027). Replay is a primary
  persistence target for the engine-version axis.
- `packages/game-engine/src/campaign/campaign.types.ts` — `CampaignState`,
  `ScenarioDefinition`, `CampaignDefinition` (WP-030). CampaignState is
  Class 2 (Configuration) and requires version stamps.
- `packages/game-engine/src/persistence/persistence.types.ts` —
  `MatchSnapshot`, `MatchSnapshotOutcome`, `PersistableMatchConfig`
  (WP-013). MatchSnapshot is Class 3 and needs version stamps.
- `packages/game-engine/src/content/content.validate.ts` —
  `validateContent`, `ContentValidationResult`,
  `ContentValidationContext` (WP-033). Content definitions are a
  natural target for the ContentVersion axis.
- `packages/game-engine/src/types.ts` — all re-exported types,
  including `LegendaryGameState` (Class 1 — not versioned directly
  since it is never persisted).
- `packages/game-engine/src/test/mockCtx.ts` — `makeMockCtx` if
  WP-034 tests need engine state fixtures.
- `packages/game-engine/package.json` — current engine semver. The
  EngineVersion stamp needs a single source of truth.
- `docs/ai/ARCHITECTURE.md §Section 3` — "The Three Data Classes"
  (Class 1 Runtime / Class 2 Configuration / Class 3 Snapshot). Only
  Class 2 and Class 3 are persisted and therefore versioned.
- `docs/ai/ARCHITECTURE.md — Layer Boundary (Authoritative)` —
  versioning and migration live in the engine category (by analogy
  to invariants, network, content) unless pre-flight resolves
  otherwise.
- `docs/ai/DECISIONS.md` — D-0003, D-0801, D-0802, D-1002, D-1232;
  pre-flight should also scan D-27NN (replay), D-30NN (campaign),
  D-13NN (persistence) families for prior version-related decisions.

EC and WP files for WP-034:
- `docs/ai/work-packets/WP-034-versioning-save-migration-strategy.md`
  — exists in repo at commit 1c9c12d
- EC-034 checklist file: verify existence during pre-flight. If
  missing, pre-flight must flag as a blocking finding (same rule as
  every prior EC-mode WP).

Test baseline for WP-034:
- Current: 376 tests, 96 suites, 0 fail
- Expected after WP-034: 376 + N (depends on WP-034 test count)
- Existing 376 tests must continue to pass **unchanged**
- If WP-034 introduces test-count-locked expectations, use one
  `describe('... (WP-034)')` block per WP-031 P6-19 / WP-033 RS-2
  precedent. Bare top-level `test()` calls do not register as
  suites in `node:test`.

Governance state (as of 2026-04-16):
- 01.4 Precedent Log extended through P6-25 (WP-033 lessons
  propagated). **The 01.4 update is UNCOMMITTED in the working tree
  — it is NOT part of commit 1c9c12d.** A `SPEC:` commit is needed
  before or during WP-034 to land the 01.4 changes. Pre-flight for
  WP-034 should either (a) commit 01.4 first with `SPEC: propagate
  WP-033 lessons into 01.4 Precedent Log` under D-3303 / P6-22..25
  rationale, or (b) include the 01.4 update in the WP-034 SPEC
  commit alongside any WP-034-specific governance back-syncs.
- 01.4 Established Patterns now includes two new canonical
  patterns from WP-033: (1) "Author-facing validation schemas are
  separate from, and deliberately stricter than, permissive
  data-loader schemas" (P6-24 / D-3303); (2) "Validators with
  string-discriminated dispatch must not silent-pass unknown inputs"
  (P6-23). The existing "Audit grep patterns must escape regex
  specials" entry was broadened with a WP-033 confirmation that the
  pattern applies to ALL forbidden-token grep gates (P6-22).
- Standardization Completeness Pass: still valid (last
  re-confirmation 2026-04-15 at WP-032)
- Full 9-step workflow demonstrated by WP-030 (Contract-Only,
  two-commit split + one nit), WP-031 (Runtime Wiring,
  mid-execution amendment + post-mortem fix), WP-032 (Contract-Only,
  clean execution), WP-033 (Contract-Only, clean execution — two
  scope-neutral mid-execution refinements inside allowlist, no
  01.5 invocation). Three consecutive clean Contract-Only runs
  (WP-030, WP-032, WP-033) confirm pipeline steady-state.
- Commit `1c9c12d` is local-only. If your workflow requires
  origin-pushed base before executing WP-034, push main before
  starting WP-034 pre-flight.
- Untracked working-tree files NOT part of WP-033 commit and still
  present at session start:
  - `.claude/settings.local.json` (modified, pre-existing)
  - `docs/ai/session-context/session-context-wp029.md` (untracked
    WP-029 artifact; does not affect WP-034)
  - `docs/legendary-arena-license-letter.{md,docx}`,
    `docs/legendary-arena-one-pager.{md,docx}`,
    `docs/upper-deck-licensing-contacts.md` (marketing/licensing,
    unrelated to engine WPs)
  - These were intentionally excluded from the EC-033 commit per
    pre-commit review scope. WP-034 should exclude them again
    unless the user explicitly requests otherwise.

Steps completed for WP-033:
0: session-context-wp033.md (loaded)
1: pre-flight (2026-04-16, READY — PS-1 D-3301 resolved, PS-2 WP
   back-sync to three-parameter `validateContent` signature
   resolved, RS-6 D-0601/0602/0603 existence confirmed, RS-7
   D-3302 created for henchman schema precedent)
1b: copilot check (2026-04-16, RISK #10/#21 accept-list lock
    retrofitted into pre-flight §Pre-Flight Locked Decisions #10
    pre-session; #13 code-category directory list already updated
    by PS-1; #14 signature already back-synced by PS-2; other
    findings resolved or marked out-of-scope)
2: session-wp033-content-toolkit.md (generated, §01.5 NOT INVOKED
   declaration included explicitly per P6-10)
3: execution (2026-04-16, same session as pre-flight per user
   authorization; 376 tests, 0 fail; zero deviations from spec;
   two scope-neutral in-allowlist refinements — docstring
   `.reduce()` → "array reduce" to satisfy binary grep gate
   (P6-22), and `noUncheckedIndexedAccess` guard in enum stage)
4: post-mortem (2026-04-16, WP COMPLETE — zero applied fixes;
   formal 01.6 artifact at
   docs/ai/invocations/postmortem-wp033-content-toolkit.md;
   aliasing, purity, and context-absent audits per session prompt
   §After Execution all clean)
5: pre-commit review (2026-04-16, Safe to commit as-is — scope
   limited to WP-033 files only, 7 unrelated working-tree items
   explicitly excluded; zero blocking issues; two non-blocking
   stylistic nits recorded)
6: commit (1c9c12d EC-033: add content authoring toolkit
   (validateContent + schemas) — single commit containing code
   + 4 invocation docs (preflight, copilot, session, postmortem)
   + STATUS + DECISIONS (D-3303) + WORK_INDEX + DECISIONS_INDEX +
   02-CODE-CATEGORIES + EC-033 + WP-033; 16 files, +3930/-14;
   hooks passed without --no-verify; local-only, not yet pushed)
7: lessons learned (2026-04-16 — 4 new Precedent Log entries
   (P6-22, P6-23, P6-24, P6-25), 2 new Established Patterns
   (author-facing vs loader schema separation; no-silent-pass
   on string-discriminated dispatch), 1 existing Established
   Pattern broadened (audit grep patterns now confirmed to apply
   beyond `boardgame.io`). **01.4 update is uncommitted in
   working tree — must be committed before or alongside WP-034
   governance changes.**)
8: this file

Run pre-flight for WP-034 next.
