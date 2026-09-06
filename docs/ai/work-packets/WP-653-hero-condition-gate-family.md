# WP-653 — Hero Condition-Gate Family (Outwit / Worthy / Savior / Antics)

**Status:** Ready
**Primary Layer:** Game Engine (`packages/game-engine`) + card-data + coverage
tooling (`scripts/hero-mechanic-ledger.mjs`) + Dashboard (`apps/dashboard`
in-play-coverage gauge)
**Dependencies:** WP-280 (D-24055 Spectrum `HeroCondition` marker→condition seam),
WP-545 (D-24354 `recruitMadeThisTurnAtLeast` — the second marker→condition
precedent), WP-564 (D-24373 investigate — the freshest hero-keyword lockstep +
card-data-marking pattern), WP-266 (the honest runtime-observed sweep this WP is
prioritized off)
**User-Visible Surface:** play.legendary-arena.com

> **Effect-authoring grind, Bucket A of the hollow-keyword backlog.** Four
> printed hero abilities gate their onPlay effect on a game-state predicate
> ("Outwit: Draw a card" fires only if you reveal three different-cost Heroes).
> The parser does not recognize the keyword, so the gate — and the effect it
> guards — silently does nothing. Observable on the deployed client, so D-24026
> applies.

---

## Goal

Recognize four hero **condition-gate** keywords — **Outwit**, **Worthy**,
**Savior**, **Antics** — as `HeroCondition` gates (the WP-280 Spectrum
marker→condition pattern), and mark the **simple** gated effects (draw / ±attack
/ ±recruit) on the in-scope cards, so that each printed ability fires exactly
when its game-state predicate holds instead of silently doing nothing. This
clears the joint-second-largest cluster of runtime-observed hero hollows —
`outwit` 156 + `worthy` 61 + `savior` 23 + `antics` 16 = **~256 in-play
`parse-unrecognized` observations** across four sets (wwhk / asrd / ca75 / amwp)
— the live-sweep floor; the frozen in-play-hollow baseline seed reads a slightly
higher `outwit` 157 (live-vs-floor, reconciled by `max(baseline, live)`).
Each keyword is modeled as a new open `HeroCondition` type (not a new
`HeroKeyword`), so it adds a `case` to `evaluateCondition` + a parser recognition
arm. In the hero-mechanic ledger the four rows flip **`unsupported` →
`condition`** (the Spectrum precedent — verified: `spectrum` carries
`"status": "condition"`), which requires extending the ledger's
`KNOWN_CONDITIONS` map (`scripts/hero-mechanic-ledger.mjs`); and because a
`condition`-status mechanic is not `executable`, the `/coverage`
in-play-coverage gauge (`apps/dashboard`) is taught to credit a recognized
condition as **resolved** so the four sets' baseline obs are not left a
permanent unresolved drag.

## User-Visible Impact

A player on **play.legendary-arena.com** playing a wwhk / asrd / ca75 / amwp Hero
now sees these abilities actually resolve: Amadeus Cho's "Outwit: Draw a card"
draws when three different-cost Heroes are in play; Beta Ray Bill's "if you are
Worthy, draw a card" draws when a Hero costing 5+ is in hand or in play; Captain
America (1941)'s "Savior: Draw a Card" draws with three Bystanders in the Victory
Pile; Ant-Man's "Antics: +2 Recruit" grants when three cheap / Size-Changing
cards are present. Before this WP every one of these lines was a silent no-op —
the hollow-effect sweep flagged them, but a player just saw nothing happen.

## Assumes

- **WP-280 shipped (D-24055):** `packages/game-engine/src/hero/heroConditions.evaluate.ts`
  is the sole hero-condition evaluator — a `switch (condition.type)` over the
  open `HeroCondition = { type: string; value: string }` union — and
  `setup/heroAbility.setup.ts` recognizes a `[keyword:X]` marker by pushing a
  `HeroCondition` onto the hook's `conditions[]` before the unresolved-marker
  fallback (the `spectrum` / `recruit-threshold` else-if arms). Verified on
  `origin/main` at baseline (below): `distinctHeroClassesAtLeast` +
  `recruitMadeThisTurnAtLeast` are both live cases.
- **The gated effect must carry a machine-readable marker.** A recognized
  condition on a line whose printed effect is bare English ("Draw a card.")
  parses the gate but has **no effect to fire** — a silent no-op, worse than a
  flagged hollow. So each in-scope simple effect is marked in `data/cards`
  (`[keyword:draw:1]` / `[icon:attack]` / `[icon:recruit]`), the same
  card-data-marking step WP-280 (D-24056) and WP-564 performed.
- **`HeroCondition.type` is an OPEN union** (a bare `{ type: string; value: string }`,
  no closed drift array — D-24055) — so a new condition type is a `case`
  addition, **not** a `HERO_KEYWORDS` / canonical-array lockstep change (unlike a
  new `HeroKeyword`).
- **Baseline (Step 2):** `origin/main` @ `git rev-parse origin/main` at draft time
  = `337029c8` (post-WP-564 investigate). The engine suite is green at 3028/0
  (scaffold-observed, below).
- The runtime-observed sweep (`docs/ai/coverage/runtime-observed-hollows.json`,
  WP-265/266) is the honest, competent-play evidence source; the four keyword
  counts above are read from it directly.

If any of the above is false, this packet is **BLOCKED** and must not proceed.

## Context (Read First)

Before writing a single line:

- `.claude/rules/architecture.md` §Layer Boundary + the Game Engine skill
  (`.claude/skills/legendary-game-engine/SKILL.md`) — this is an engine +
  card-data + coverage-tooling + dashboard-gauge change (per §Scope-In E/F/G);
  no server / registry change.
- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — read entirely;
  `evaluateCondition` (the switch to extend) + `describeFailedCondition` (the
  parallel switch — each new condition adds a player-facing arm) + the
  self-inclusive `distinctHeroClassesAtLeast` case (the closest template).
- `packages/game-engine/src/setup/heroAbility.setup.ts` — the `spectrum` /
  `recruit-threshold` else-if arms (~L713–798 on baseline); the new arms go
  before the `RECOGNIZED_NON_KEYWORD_MARKERS` unresolved fallback so the
  `parse-unrecognized` hollow never records.
- `data/cards/{wwhk,asrd,ca75,amwp}.json` — the in-scope hero cards and their
  exact printed ability lines (enumerated in §Scope In). **Card markers are
  faithful printed text** — never rewrite a marker to change display; only ADD
  the effect markers the gated simple effects need. Durability target is the
  per-set source patch `scripts/convert-cards/inputs/patches/{setAbbr}.patch.json`
  (the pipeline reads the dotted file — verified), NOT `bbcode/modern-master-strike`
  (a frozen output mirror per CLAUDE.md §Card Data — nothing reads it; must not
  edit). amwp is a hand-authored outlier (see §Scope-In C). Do not regenerate
  `data/cards` (WP-565: the pipeline is lossy — targeted edit).
- `docs/ai/DECISIONS.md` — **D-24055** (Spectrum condition precedent), **D-24354**
  (recruit-threshold condition), **D-20703** (opaque anomaly-key posture — this
  WP names no anomaly key), and the reserved **D-24464** below.
- `docs/ai/REFERENCE/00.6-code-style.md` — Rule 4 (no abbreviations), Rule 6
  (`// why:`), Rule 8 (no `.reduce()` with branching — explicit `for...of`),
  Rule 13 (ESM), Rule 14 (field names match `00.2`).
- `docs/ai/REFERENCE/00.2-data-requirements.md` — the canonical field names the
  card edits and the evaluator read (`cost`, `ext_id`); markers are ADDED, never
  renamed.
- `reference_coverage_dashboard_as_tool` + `project_effect_authoring_scale` in
  user memory — the coverage regen chain (five artifacts) and the
  `useInPlayCoverage.test.ts` cross-layer trap.

## Non-Negotiable Constraints

**Always apply (do not remove):**
- Full file contents for every new or modified file in the executor's output —
  no diffs, no snippets, no "show only the changed section", no "unchanged"
  elisions.
- ESM only, Node v22+ — `import`/`export`, `node:` prefix on built-ins in tests.
- Test files `.test.ts`; `node:test` + `node:assert/strict` only.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — explicit
  `for...of`, no `.reduce()` with branching, descriptive names, `// why:` on
  every non-obvious decision.
- Pure helper discipline: `heroConditions.evaluate.ts` imports **no boardgame.io**
  and mutates nothing (conditions read `G`, return `boolean`).

**Packet-specific (locked):**
- Model each keyword as a **`HeroCondition`**, NOT a `HeroKeyword`. Do **not**
  touch `HERO_KEYWORDS` / `MVP_KEYWORDS` / `HANDLED_KEYWORDS` or their parity
  drift tests — a condition is not a keyword (the D-24055 posture; a condition
  flips its ledger row `unsupported`→`condition` via `KNOWN_CONDITIONS`, never
  to `executable`).
- The four condition types and thresholds are LOCKED (see §Locked contract
  values). No evaluator **signature** change — every condition reads `G` alone
  (numPlayers is not needed for these four; scaffold-confirmed).
- **Honest-Partial invariant (load-bearing).** Recognize the condition; mark
  **only** the simple gated effects (draw / fixed ±attack / fixed ±recruit). A
  line whose gated effect is a still-unimplemented mechanic — scry / look-N /
  `[keyword:Transform]` / `[keyword:Smash N]` / `[keyword:Man Out of Time]` /
  each-player / `for each … ` count-scaling / KO-from-hand-or-discard — keeps
  that inner marker as an **honest inner hollow**; do NOT stretch a new primitive
  in to silence it. Recognizing the outer condition without a real effect is the
  "silence the hollow without implementing it" anti-pattern and is FORBIDDEN.
- `finalStateHash` / `PRE_WP080_HASH` are expected **byte-unchanged** — the
  sentinel replay board is core-only and these four keywords appear only on
  non-core sets (scaffold-confirmed: engine 3028/0 with the four conditions +
  parser arms, no fixture re-pin). A re-pin is the smell — investigate, do not
  re-baseline to green.
- No pending choice / no new zone / no new timing. These are onPlay-gate
  conditions only; anything needing a player choice or a new zone is out of scope
  (the `project_pending_choice_no_ux_freeze` safety boundary).

**Session protocol:** if any field name, taxonomy key, threshold, or card line is
unclear, STOP and ask — never guess a key name, a threshold, or a card marker.

**Locked contract values (verbatim — do not re-derive):**
- `distinctHeroCostsAtLeast` — Outwit — value `'3'`: ≥ 3 **distinct non-zero**
  costs among `inPlay` **Heroes** (self-inclusive; read cost safely as
  `G.cardStats[id]?.cost ?? 0` — a card with no stats row, e.g. a token, has no
  entry). Only true Heroes contribute a distinct cost (mirror the
  `distinctHeroClassesAtLeast` heroClass guard so non-hero tokens are excluded).
- `heroCostAtLeastInHandOrPlay` — Worthy — value `'5'`: a Hero costing ≥ 5 in
  **hand OR inPlay** (`G.cardStats[id]?.cost ?? 0`).
- `bystandersInVictoryAtLeast` — Savior — value `'3'`: ≥ 3 Bystanders in the
  Victory Pile. **Re-implement the two-arm bystander predicate INLINE** — the
  `hero/heroCountSource.resolve.ts` shape (`extId === BYSTANDER_EXT_ID ||
  extId.startsWith('bystander-villain-deck-')`), but `isBystanderExtId` and its
  prefix const there are NON-exported and OUT of scope, so do NOT import from or
  add an export to that file; import only `BYSTANDER_EXT_ID` and inline the
  prefix (confirm the exact prefix literal against the source at execution). The
  villain-deck arm makes a rescued named bystander count too, not only supply
  bystanders — the faithful reading of "3 Bystanders in your Victory Pile."
- `cheapOrSizeChangingAtLeast` — Antics — value `'3'`: ≥ 3 cards in hand+inPlay
  costing 1 or 2 **and/or** Size-Changing — count each qualifying card **once**
  (a card that is both cheap and Size-Changing counts one). Size-Changing test:
  `getGrantedClasses(...).length > 0` (the scaffold approximation); confirm the
  exact predicate against the Size-Changing helper at execution.

## Vision Alignment

- **Vision clauses touched:** §1/§2 (content fidelity — printed card text is
  faithfully modeled; markers are not rewritten, only completed). §22
  (determinism — conditions are pure functions of `G`).
- **Conflict assertion:** `No conflict: this WP preserves all touched clauses.`
  It implements printed abilities faithfully; no scoring / PAR / leaderboard
  surface, no monetization, no player-vs-player interaction.
- **Non-Goal proximity:** none of NG-1..7 crossed.
- **Determinism preservation:** `evaluateCondition` remains a pure, deterministic
  read of `G` — no wall-clock, no RNG, no I/O; the marked effects run through the
  existing deterministic executor.

## Funding Surface Gate

§20 **N/A** — no funding affordance, tournament channel, or donate/support copy;
an engine + card-data gameplay-fidelity change.

## API Catalog (§21)

§21 **N/A** — no HTTP endpoint added / modified / removed / re-statused and no
`apps/server/src/**` library function changes. Entirely engine + card-data.

## Reserves

- **D-24464** — the four hero condition-gate keywords Outwit / Worthy / Savior /
  Antics are modeled as `HeroCondition`s (the D-24055 Spectrum precedent — a
  `[keyword:X]` that pushes a CONDITION, not a keyword), each a `case` in
  `evaluateCondition` + `describeFailedCondition` over the open `{type,value}`
  union; the gated simple effects are marked in `data/cards`; complex gated
  effects stay honest inner hollows (Honest-Partial). The ledger rows flip
  `unsupported`→`condition` (via `KNOWN_CONDITIONS`) and the `/coverage` gauge is
  taught to credit `condition`-status as resolved. **Endgame is deferred** (see §Scope Out). Entry lands at
  execution.

## Scope (In)

### A) `packages/game-engine/src/hero/heroConditions.evaluate.ts` — modified
- Add four `case`s to `evaluateCondition` per §Locked contract values (import
  `BYSTANDER_EXT_ID` from `../setup/pilesInit.js`).
- Add four parallel arms to `describeFailedCondition` (player-facing English:
  Outwit "it needs three Heroes of different costs in play — you have N",
  Worthy "it needs a Hero costing 5 or more in hand or play", Savior "it needs 3
  Bystanders in your Victory Pile — you have N", Antics "it needs 3 cards costing
  1-2 or Size-Changing — you have N"), each mirroring the gate's own count so the
  message quotes the number it compared.

### B) `packages/game-engine/src/setup/heroAbility.setup.ts` — modified
- Add four `else if (normalizedKeyword === 'outwit' | 'worthy' | 'savior' |
  'antics')` arms pushing the matching `HeroCondition`, before the
  `RECOGNIZED_NON_KEYWORD_MARKERS` unresolved fallback.

### C) Card data — modified (`data/cards/{wwhk,asrd,ca75,amwp}.json` + the source
patches `scripts/convert-cards/inputs/patches/{wwhk,asrd,ca75}.patch.json`)
- Edit the consumed `data/cards/*.json` directly (targeted — regeneration is
  forbidden per WP-565, the pipeline is lossy). For the three convertible sets
  (wwhk/asrd/ca75), **also** add the same markers to the per-set source patch
  `scripts/convert-cards/inputs/patches/{setAbbr}.patch.json` (the pipeline reads
  the dotted file — verified) so a future fixed re-convert stays correct. The
  durability target is the **patch JSON**, NOT `bbcode/modern-master-strike`
  (per CLAUDE.md §Card Data that path is a frozen output mirror that nothing
  reads and must not be edited). **amwp is a hand-authored outlier set** (CLAUDE.md
  §Card Data — produced only by `apply-card-counts.mjs`, which reads its patch for
  hero imageUrls, not ability text): `data/cards/amwp.json` is its source of
  record and is edited directly; the executor confirms against
  `docs/03-DATA-PIPELINE.md` §1 whether any amwp patch carries ability text before
  treating it as a durability target.
- Mark the **simple** gated effects so they fire once the condition passes.
  The in-scope simple lines (from card text at draft):
  - **Outwit (wwhk):** amadeus-cho/extrapolate, amadeus-cho/renegade-genius,
    caiera/shadow-queen, korg/move-mountains, she-hulk/window-of-opportunity
    (`Draw a card.` → `[keyword:draw:1]`); amadeus-cho/like-totally-smart-hulk
    (`+2[icon:attack]` — already marked, gate-only).
  - **Worthy (asrd):** beta-ray-bill/hope-of-the-korbinites (`draw a card` →
    `[keyword:draw:1]`); thor/test-of-virtue (`+2[icon:attack]` — gate-only).
  - **Savior (ca75):** captain-america-1941/liberate-the-prisoners (`Draw a
    Card.` → `[keyword:draw:1]`); captain-america-falcon/winged-salvation +
    steve-rogers/save-the-world (`+2/+3[icon:attack]` — gate-only).
  - **Antics (amwp):** ant-man/hitch-a-ride (`+2[icon:recruit]`), ant-army/
    anticipate (`Draw a card.` → `[keyword:draw:1]`), ant-army/antagonize +
    revolutionary-anthem (`+2[icon:attack]`), ant-army/antiproton-experiments
    (`+2[icon:recruit] and +2[icon:attack]`) — mark any bare-English effect;
    icon-marked effects are gate-only.
- **Honest-Partial (do NOT mark, leave as inner hollows):** Outwit lines gating
  scry/look-N (gamma-ray-experiment, visualize-the-variables), `[keyword:Transform]`
  (gamma-bomb-disaster), `[keyword:Smash 2]` (attune-techtonic-transducer),
  end-of-turn deferred draw (solve-the-impossible), KO-from-hand/discard
  (focus-the-old-power); Worthy throw-gates (stormbreaker, mjolnir), count-scaling
  (divine-lightning), each-player (royal-decree); Savior class-count scaling
  (star-spangled-hero, international-strike-force), KO-count scaling
  (mobilize-for-war), `[keyword:Man Out of Time]` (punch-evil, shadow-of-wars-past);
  Antics KO-from-hand/discard (bug-swarm).

### D) Tests — new/modified (engine)
- `hero/heroConditions.evaluate.test.ts` — four new condition cases: pass/fail at
  the threshold boundary, malformed value → false, empty-state → false; plus the
  `describeFailedCondition` arms.
- `setup/heroAbility.setup.test.ts` — the four keywords parse to their condition
  (not an `unresolvedMarker`); a HERO_KEYWORDS parity **non-**change assertion
  (the four are NOT added to the keyword union).
- A gate-integration test: a marked line with a passing vs failing condition
  fires vs no-ops its simple effect.

### E) Coverage tooling — `scripts/hero-mechanic-ledger.mjs` modified
- Extend the ledger's `KNOWN_CONDITIONS` map with the four keyword→condition
  mappings (`outwit → distinctHeroCostsAtLeast`, `worthy →
  heroCostAtLeastInHandOrPlay`, `savior → bystandersInVictoryAtLeast`, `antics →
  cheapOrSizeChangingAtLeast`) so the four rows flip `unsupported → condition`
  (the `spectrum` precedent — the ledger classifies via its OWN map, not the
  engine parser, so a plain regen leaves them `unsupported`).

### F) Coverage / derived artifacts — regenerated (the effect-marker ripple)
- `pnpm -r build` then `pnpm ledger:heroes` (hero-mechanic-ledger.{json,csv} —
  the four rows now read `status: condition`), `pnpm mechanics:metadata`
  (`data/metadata/card-mechanics.json` — reads the ledger in lockstep),
  `pnpm sim:runtime-observed` (`docs/ai/coverage/runtime-observed-hollows.json` —
  the four outer hollows clear; net obs falls, complex inner hollows may appear),
  and confirm `pnpm sim:coverage --check`.

### G) In-play-coverage gauge — `apps/dashboard` modified (credit condition-status)
- Extend `computeInPlayCoverage` (`apps/dashboard/src/composables/useInPlayCoverage.ts`)
  to credit a mechanic as **resolved** when its ledger status is `condition`
  (a recognized condition IS implemented), alongside the existing `executable`
  check — so the four sets' baseline obs (`outwit` 157 + `worthy` 61 + `savior`
  23 + `antics` 16 = 257 in `in-play-hollow-baseline.json`) credit the gauge
  instead of becoming a permanent unresolved drag. This is the honest D-24050
  fix and also credits `spectrum` + all future conditions; the frozen baseline
  seed is UNCHANGED (denominator model preserved). In `useInPlayCoverage.test.ts`:
  (a) re-pin the ONE forced value — the no-arg real-seed case, whose fixed-seed
  sweep trajectories shift because the newly-firing draw/±attack/±recruit effects
  change play (the WP-564 investigate re-pin precedent) — and (b) ADD a dedicated
  assertion that a `condition`-status mechanic carrying a baseline peak is credited
  as resolved. Do NOT edit the existing injected-baseline case (dodge-only, frozen,
  no condition row — it does not move; changing its injected ledger just to move a
  pinned number is a reward-integrity smell).
  `pnpm --filter @legendary-arena/dashboard typecheck` + `test:coverage` gate.

## Scope (Out)

- **Endgame is DEFERRED** — its gated effects ARE mostly simple `[keyword:Endgame]:
  +N[icon:attack]` grants (the same markable shape as the four in scope), so the
  blocker is NOT the effect shapes. The blocker is that Endgame is a turn-**state**
  with TWO ways to be true: the natural `Villain Deck ≤ 8 × players` (a pure `G`
  read) **OR** granted mid-turn by a card ("For the rest of this turn, it is the
  Endgame for your Hero cards"). A gate reading only the natural arm would be
  wrong when a player forces Endgame via the grant, and the grant needs a
  turn-state flag that does not exist. Endgame therefore needs its own WP that
  adds the grant-Endgame-this-turn state (set + read) first; a natural-only gate
  would ship a correctness gap, not honest-partial. (A few Captain Marvel lines
  also gate a recruit→attack mode-switch — a separate unimplemented effect that
  would stay an honest inner hollow.)
- **cyber-mod (tiered two-param class-count) and heist (condition + reveal-and-
  compare)** — distinct shapes, their own follow-up WPs.
- No new `HeroKeyword`, no `HERO_KEYWORDS`/`MVP_KEYWORDS`/`HANDLED_KEYWORDS`
  change, no canonical-array lockstep.
- No new primitive, no new zone, no new timing, no pending choice, no client /
  server / registry change. (The dashboard IS in scope — the in-play-coverage
  gauge credit, §Scope-In G — but only that one composable + its test.)
- No regeneration of `data/cards` via the converter (WP-565: the pipeline is
  non-idempotent and lossy — the card edits are targeted, not a regen).

## Files Expected to Change

- `packages/game-engine/src/hero/heroConditions.evaluate.ts` — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.ts` — **modified**
- `packages/game-engine/src/hero/heroConditions.evaluate.test.ts` — **modified**
- `packages/game-engine/src/setup/heroAbility.setup.test.ts` — **modified**
- `data/cards/wwhk.json`, `data/cards/asrd.json`, `data/cards/ca75.json`,
  `data/cards/amwp.json` — **modified** (mark simple gated effects)
- `scripts/convert-cards/inputs/patches/{wwhk,asrd,ca75}.patch.json` —
  **modified** (source-patch durability — the pipeline reads these dotted files).
  amwp is a hand-authored outlier: `data/cards/amwp.json` is edited directly (its
  committed data is the source of record); the executor confirms whether the amwp
  patch overlays ability text — `apply-card-counts.mjs` reads it for hero
  imageUrls — before treating any patch as its durability target.
- `scripts/hero-mechanic-ledger.mjs` — **modified** (extend `KNOWN_CONDITIONS`)
- `apps/dashboard/src/composables/useInPlayCoverage.ts` — **modified** (credit
  `condition` status as resolved)
- `apps/dashboard/src/composables/useInPlayCoverage.test.ts` — **modified**
  (re-pin the ONE forced value — no-arg real-seed case — + ADD a condition-credit
  assertion; the injected-baseline case is unchanged)
- `docs/ai/coverage/hero-mechanic-ledger.{json,csv}` — **regenerated**
- `data/metadata/card-mechanics.json` — **regenerated**
- `docs/ai/coverage/runtime-observed-hollows.json` — **regenerated**
- `docs/ai/STATUS.md` / `docs/ai/DECISIONS.md` (D-24464) /
  `docs/ai/work-packets/WORK_INDEX.md` / `docs/ai/execution-checklists/EC_INDEX.md`
  / `docs/05-ROADMAP-MINDMAP.md` — **modified** — governance.

No other files may be modified.

## Acceptance Criteria

- [ ] `evaluateCondition` handles the four new `HeroCondition` types per the
      locked thresholds; `describeFailedCondition` has a matching arm for each.
- [ ] `setup/heroAbility.setup.ts` recognizes `[keyword:Outwit|Worthy|Savior|Antics]`
      as a condition push (not an `unresolvedMarker`); confirmed by test.
- [ ] The four keywords are NOT in `HERO_KEYWORDS` / `MVP_KEYWORDS` /
      `HANDLED_KEYWORDS` (a condition is not a keyword); parity drift tests
      unchanged.
- [ ] `scripts/hero-mechanic-ledger.mjs` `KNOWN_CONDITIONS` extended so the four
      ledger rows read `status: condition` (was `unsupported`).
- [ ] `computeInPlayCoverage` credits a `condition`-status mechanic as resolved;
      the four sets' baseline obs move into the resolved numerator (the ONE forced
      `useInPlayCoverage.test.ts` value — no-arg real-seed case — re-pinned + a
      condition-credit assertion added; the injected-baseline case unchanged); the
      frozen baseline seed is unchanged.
- [ ] Each in-scope simple gated effect is marked in `data/cards` and fires when
      its condition passes, no-ops when it fails (gate-integration test).
- [ ] Honest-Partial: every complex gated line retains its inner marker as an
      honest hollow; no complex effect was stretched in.
- [ ] `pnpm --filter @legendary-arena/game-engine build` + `test` exit 0.
- [ ] `finalStateHash` / `PRE_WP080_HASH` byte-unchanged (no fixture re-pin).
- [ ] The regen chain is current: `ledger:heroes:check`,
      `mechanics:metadata:check`, `sim:runtime-observed:check`, `sim:coverage --check`
      all exit 0; the four keywords read `status: condition` in the ledger and
      no longer appear as runtime-observed outer hollows.
- [ ] `pnpm --filter @legendary-arena/dashboard typecheck` + `test:coverage`
      exit 0.
- [ ] `git diff --name-only` = exactly the §Files Expected to Change set.

## Verification Steps

```pwsh
pnpm -r build                                   # exits 0
pnpm --filter @legendary-arena/game-engine test # node:test — all pass, 0 fail
pnpm ledger:heroes; pnpm mechanics:metadata; pnpm sim:runtime-observed
pnpm ledger:heroes:check; pnpm mechanics:metadata:check
pnpm sim:runtime-observed:check; pnpm sim:coverage --check   # each exits 0
# the four keywords cleared as runtime-observed outer hollows (ledger rows now read status: condition):
Select-String -Path docs/ai/coverage/runtime-observed-hollows.json -Pattern '"outwit"|"worthy"|"savior"|"antics"'  # no output
git diff --name-only                            # exactly the allowlist
```

## Definition of Done

- [ ] **User-visible verification (D-24026):** after deploy, on
      play.legendary-arena.com, a wwhk / asrd / ca75 / amwp Hero's condition-gated
      ability visibly resolves (e.g. an Outwit draw with three different-cost
      Heroes in play) — evidence captured against a deploy-confirmed SHA. Green
      tests alone do NOT satisfy this.
- [ ] All acceptance criteria pass.
- [ ] `pnpm -r build` + engine `test` exit 0; the five `:check` gates exit 0.
- [ ] No files outside §Files Expected to Change modified.
- [ ] `docs/ai/STATUS.md` updated — what a player now sees; the Honest-Partial
      note (complex gated effects remain inner hollows).
- [ ] `docs/ai/DECISIONS.md` — **D-24464** Active.
- [ ] `WORK_INDEX.md` + `EC_INDEX.md` flipped with date; mindmap `📝`→`✅` +
      `roadmap:counts:write`; `roadmap:counts:check` exits 0.

## Lane note (D-24028)

Standard two-session lane — a cross-layer change (engine + card-data + coverage
tooling + dashboard gauge) spanning >4 files with a D-entry and a coverage regen;
not lightweight.

## Gate Record (Phase 1 — 2026-09-06)

- **Scaffold (01.0a Step 3):** prototyped the 4 conditions + parser arms in an
  isolated worktree; game-engine suite **3028/0** (strictly additive),
  `finalStateHash` byte-unchanged (non-core sets), no evaluator signature change.
  Prototype torn down; the engine code lands at execution.
- **Pre-flight (01.4):** **READY TO EXECUTE.** All four dependency contracts
  verified in source (the WP-280 condition seam, WP-545 recruit-threshold,
  `BYSTANDER_EXT_ID` export, `KNOWN_CONDITIONS` gating); every `G` field the four
  conditions read is reachable with no signature change; scope lock closed. The
  re-run raised doc-consistency blockers (a stale bbcode edit instruction, the
  old Endgame rationale, the "reuse the classifier" wording) — all corrected and
  confirmed clean by the copilot final PASS below.
- **Copilot (01.7):** **PASS** (final confirmation). Two prior SUSPEND rounds
  caught real defects — a forbidden bbcode edit target, a false "rows drop from
  the ledger" claim, the condition-status coverage-gauge gap, a non-exported
  bystander classifier, the amwp imageUrls-only patch, and an overstated re-pin
  claim — every one addressed and propagated across WP + EC + D-24464 + the index
  rows + mindmap. Final pass: no stale duplicate, no new contradiction.

## Lint Gate Self-Review (00.3 — 21 sections)

All 21 sections PASS or justified N/A. Highlights: §1 structure (all required
sections present); §2 non-negotiable constraints (full-file-contents +
`00.6` cited); §3 Assumes (deps + baseline SHA `337029c8`); §8 architecture
(cross-layer, respected — engine/card-data/tooling/dashboard, no server/registry);
§14 AC (11 binary/observable); §15 DoD (D-24026 live-verify + governance); §17
Vision Alignment (§1/§2/§22, no conflict, determinism line); §18 prose-vs-grep
(the one grep targets a JSON data file, not prose); §20 Funding N/A (no funding
surface); §21 API Catalog N/A (no endpoint / `apps/server` library change). The
§2 full-file-contents constraint and the §4 `00.2` Context reference were the two
gate-caught additions.
