# WP-451 — Exclude `G.diagnostics` from the State-Hash Surfaces

**User-Visible Surface:** none — infrastructure (determinism/observability boundary).
Makes observability writes (the D-24266 hollow-effect breadcrumb + every villain/hero
effect-marking WP) **hash-neutral**, so they no longer perturb the fixture-golden hash
or the competitive replay hash.

**Closes the footgun surfaced while drafting WP-447/WP-450:** `G.diagnostics` — an
explicitly runtime-only observation channel (WP-257: "never gameplay input") — is
currently serialized into BOTH state-hash surfaces, so an observability-only change
(marking a villain, or the breadcrumb firing) silently shifts `finalStateHash`.

> ## 🔒 SCOPE LOCKED (operator, 2026-07-29): `hashGameState`-only
>
> The operator selected the **`hashGameState`-only** scope — the load-bearing,
> zero-competitive-risk fix. **This WP executes surface (1) `hashGameState` ONLY.**
> The surface (2) `computeStateHash` exclusion (the competitive-oracle half, with its
> one-time transition-window risk) is **DEFERRED to its own future WP + a dedicated
> low-competitive-activity deploy** — it is NOT executed here.
>
> Everything below that describes the `computeStateHash` half (`replay/replay.hash.ts`,
> `replay.hash.test.ts`, the `game.ts` "full G" caveat, the §Risk competitive analysis,
> AC-2/AC-6-server) documents that **deferred** half for the record and the follow-on
> WP. The executor implements only: `hashGameState` exclusion + its test + the
> `buildInitialGameState.ts` comment caveat. Under this scope `computeStateHash` still
> hashes `diagnostics`, so the competitive replay hash is UNCHANGED (zero competitive
> risk) and the `buildInitialGameState` absent-on-fresh literal remains required (now
> justified by `computeStateHash` rather than `hashGameState` — update the comment to
> say so). See D-24271.

---

## Goal

After this session, `G.diagnostics` is excluded from the game-state hash — the same
treatment already given to `messages` / `logMeta` / `lastPlayEffectsFired`, and for
the same reason: it is runtime-only observation that never gates gameplay
(`types.ts` — `diagnostics?: GameDiagnostics` is documented "runtime-only … never
gameplay input"). Two surfaces are updated: (1) `hashGameState` (the test-fixture
golden / `finalStateHash` oracle) — the **load-bearing** fix that stops golden-fixture
churn on every breadcrumb/marking WP; and (2) `computeStateHash` (the production
whole-G determinism/competitive oracle) — which decouples the competitive `replayHash`
+ anti-tamper compare from observability drift. The now-false hash rationale is
corrected in `buildInitialGameState.ts` (its "hashGameState serializes the whole G"
note — the real stale comment), plus a "full G except the excluded observation
channels" caveat on `game.ts` §onBegin and a new `diagnostics` why-comment in
`hashGameState.ts` (neither of those two files currently makes a diagnostics claim —
see §Scope In). Because
no current fixture materializes a hollow record (D-24266 shipped in #1065 with no
re-pin), excluding an absent field is expected to leave every pinned hash
byte-unchanged — the re-pin is conditional, confirmed empirically.

---

## Assumes

- **WP-257 / D-24033-34 ✅ (hollow-effect diagnostics).** `G.diagnostics:
  GameDiagnostics` is a runtime-only observation channel — "never persisted, never a
  save-game, and NEVER read as gameplay input" (`hollowEffect.types.ts`). It is kept
  **absent on a fresh match** in `buildInitialGameState.ts` *specifically* because it
  is currently hashed and an empty literal would churn the golden. Source: those files.
- **D-24081 / D-24114 / D-24221 ✅ (the existing hash-exclusion precedent).**
  `hashGameState` (`packages/game-engine/src/test/fixtures/hashGameState.ts`) already
  rest-destructures out `messages` + `logMeta` + `lastPlayEffectsFired` before hashing,
  for exactly the "observability that must not gate the golden" reason. This WP appends
  `diagnostics` to that same set. Source: `hashGameState.ts` lines ~90-95.
- **D-24266 ✅ (the breadcrumb that made this bite).** The unmarked-timing-line
  breadcrumb writes a hollow record to `G.diagnostics` on defeat of an un-implemented
  villain/henchman effect. That write is now hash-affecting; this WP makes it neutral.
- **The competitive path (WP-334/335/336, D-24119/D-24122).** `matchCapture.logic.ts`
  stores `replayHash = computeStateHash(reducedFinalG)` as the `bgio.replay_artifacts`
  natural key; `competition.logic.ts` step 9 gates a submission on
  `reduced.stateHash === replayHash` (both full-G `computeStateHash`). The **score
  itself** is re-derived from terminal state (`deriveScoringInputs` / `evaluateEndgame`)
  and never reads `diagnostics`; accepted scores are immutable and never re-verified.
  So `computeStateHash` including `diagnostics` matters only for the anti-tamper
  compare — see §Risk. Source: those files (verified at draft).
- **Baseline:** `origin/main` @ `f6d03070` (`git rev-parse origin/main` at draft time).
  Ledger `--next` returns WP-451 / EC-486 / D-24271.

---

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` — §Determinism; §Persistence Boundaries (`G`/`ctx`
  runtime-only; snapshots are derived counts).
- `.claude/skills/legendary-persistence/SKILL.md` — what may be persisted / hashed.
- `packages/game-engine/src/replay/replay.hash.ts` — `computeStateHash` (whole-G).
- `packages/game-engine/src/test/fixtures/hashGameState.ts` — the golden oracle.
- `packages/game-engine/src/game.ts` §onBegin comment (~528-534) — the two-hash split,
  which this WP updates.
- **Why now:** WP-447 and WP-450 each had to reason carefully about "does marking a
  villain shift the hash?" — the answer was yes (via `diagnostics`), and each was
  re-pin-free only by fixture-content accident. Diagnostics is pure observation; it has
  no business in either hash. Fixing it once removes the recurring hazard and stops a
  latent competitive-verification footgun.

---

## Scope (In)

- **`hashGameState`** (`test/fixtures/hashGameState.ts`) — add `diagnostics` to the
  rest-destructure exclusion (now four fields: `messages`, `logMeta`,
  `lastPlayEffectsFired`, `diagnostics`) with a `diagnostics` why-comment; and update
  the header's "STAYS in computeStateHash" line (which is about `lastPlayEffectsFired`)
  since that claim no longer holds for `diagnostics`. (See the three-site comment-
  correction bullet in §Scope In below for the precise edits.)
- **`computeStateHash`** (`replay/replay.hash.ts`) — exclude `diagnostics` from the
  whole-G serialization (the same rest-destructure approach, or a shared exclusion
  helper). This is the production determinism/competitive oracle; excluding an
  observation channel makes the competitive `replayHash` + step-9 compare
  observability-neutral.
- **Tests:** `hashGameState.test.ts` gains an assertion that two states differing only
  in `diagnostics` hash identically; a `replay.hash.test.ts` (or equivalent) gains the
  same for `computeStateHash`.
- **Comment corrections (three sites — the codebase must stop asserting diagnostics
  is hashed):**
  - `buildInitialGameState.ts` (~566-568) — the **real** stale rationale: its
    "an always-present empty literal would change the canonical-JSON finalStateHash
    (hashGameState serializes the whole G)" note becomes false once diagnostics is
    unhashed. Add a caveat (comment-only; the seed-literal cleanup itself stays Out).
  - `game.ts` §onBegin (~528-534) — its "computeStateHash INTENTIONALLY hashes the
    full G" phrasing needs an "…except the excluded observation channels (messages,
    logMeta, lastPlayEffectsFired, diagnostics)" caveat. (Its `logMeta` claim is
    otherwise unchanged — logMeta stays hashed by computeStateHash.)
  - `hashGameState.ts` header + the destructure — add the new `diagnostics` why-comment
    (there is no pre-existing "diagnostics" claim to remove there; the existing
    "STAYS in computeStateHash" line is about `lastPlayEffectsFired`, and that becomes
    partially stale too since diagnostics no longer STAYS in computeStateHash).
- **(Conditional, 01.5):** if the full engine suite shows any pinned hash shift
  (`PRE_WP080_HASH` in `replay.execute.test.ts`, the sentinel `finalStateHash` in
  `sentinel-core-doom-2p.replay.json`), regenerate + re-pin **with a note**. Expected:
  NONE — no current fixture materializes a hollow record, so `diagnostics` is absent in
  every fixture's final G and stripping an absent field is a no-op. Confirm empirically.

## Scope (Out)

- **Seeding `G.diagnostics` as an empty literal in `buildInitialGameState`** (retiring
  the WP-257 "absent-on-fresh" workaround). Now *safe* once diagnostics is unhashed, but
  a separate cosmetic cleanup — not required for the hash fix, and it would touch a
  setup contract. Deferred (noted for a future tidy-up). **Note:** the WP DOES caveat
  the stale *comment* at that site (§Scope In) — the code (the absent-on-fresh literal)
  is untouched; only the now-false rationale comment is corrected.
- **Any change to the competitive score math, the DB schema, or server code.** The
  server inherits `computeStateHash` from the engine; no migration, no
  `apps/server` edit. `state_hash` / `replay_hash` columns are unchanged in shape.
- **Excluding `notableEvents` or any other field.** `notableEvents` is deliberately
  hashed (it has no other guard, per the `hashGameState` comment); only `diagnostics`
  is added here.
- **Back-filling / re-hashing historical `replay_artifacts` rows.** Old rows keep their
  old (diagnostics-inclusive) hashes; they are content-addressed natural keys, immutable,
  and never re-compared for accepted scores (see §Risk).

---

## Files Expected to Change

- `packages/game-engine/src/test/fixtures/hashGameState.ts` — **modified** — add
  `diagnostics` to the exclusion rest-destructure + update the header comment.
- `packages/game-engine/src/test/fixtures/hashGameState.test.ts` — **modified** —
  assert diagnostics-only difference hashes identically.
- `packages/game-engine/src/replay/replay.hash.ts` — **modified** — exclude
  `diagnostics` from `computeStateHash`.
- `packages/game-engine/src/replay/replay.hash.test.ts` — **new/modified** — same
  diagnostics-invariance assertion for `computeStateHash`.
- `packages/game-engine/src/game.ts` — **modified (comment-only)** — caveat the
  §onBegin "computeStateHash hashes the full G" phrasing (diagnostics now excluded).
- `packages/game-engine/src/setup/buildInitialGameState.ts` — **modified
  (comment-only)** — caveat the ~566-568 note whose "hashGameState serializes the whole
  G" rationale for keeping diagnostics absent-on-fresh becomes false once it is
  unhashed. The seed-literal change itself stays Out (§Scope Out); this is the
  comment tweak only, and MUST NOT touch the unrelated `cardSizeChangingClasses`/VP
  comments in the same file.
- **(Conditional):** `packages/game-engine/src/replay/replay.execute.test.ts`
  (`PRE_WP080_HASH`) and/or `test/fixtures/games/sentinel-core-doom-2p.replay.json`
  (`finalStateHash`) — re-pin **only if** the suite shows a shift (expected none).

---

## Contract

- **Excluded from `hashGameState`:** `messages`, `logMeta`, `lastPlayEffectsFired`,
  **`diagnostics`** (append-only to the existing set).
- **Excluded from `computeStateHash`:** `diagnostics` (the first exclusion on this
  whole-G oracle; the invariant is "runtime-only observation channels are not hashed").
- **Invariant (D-24271):** `G.diagnostics` is runtime-only observation and is excluded
  from ALL state-hash surfaces. Two `LegendaryGameState`s differing only in `diagnostics`
  produce identical `hashGameState` AND identical `computeStateHash`.
- **No new `G` field, no gameplay change, no DB/schema/server change.**

---

## Acceptance Criteria

1. `hashGameState(a) === hashGameState(b)` when `a`/`b` differ only in `diagnostics`
   (one absent, one with a populated `hollowEffects` list).
2. `computeStateHash(a) === computeStateHash(b)` under the same diagnostics-only diff.
3. `hashGameState`'s exclusion set is exactly `{messages, logMeta, lastPlayEffectsFired,
   diagnostics}`; a test pins it (mirrors the existing exclusion tests).
4. No in-tree comment asserts `diagnostics` is hashed: the `buildInitialGameState.ts`
   ~566-568 "hashGameState serializes the whole G" rationale is caveated, the `game.ts`
   §onBegin "full G" phrasing is caveated, and `hashGameState.ts` carries the new
   `diagnostics` exclusion why-comment. (grep for a surviving "diagnostics … hash"
   claim returns none.)
5. `pnpm --filter @legendary-arena/game-engine build` + `test` green; **no** pinned-hash
   re-pin needed (or, if the suite shows a shift, re-pin with a documented note).
6. `pnpm --filter @legendary-arena/server test` green (the server inherits the engine
   hash; no server code changes) — confirms the competitive/replay path still builds
   and its within-version self-consistency holds.

---

## Verification Steps

1. `pnpm -r build` then `pnpm --filter @legendary-arena/game-engine test`.
2. Confirm the two diagnostics-invariance tests pass and the exclusion-set pin holds.
3. Confirm `PRE_WP080_HASH` + the sentinel `finalStateHash` are UNCHANGED (grep the
   test output / `git diff` the fixture) — expected, since no fixture materializes a
   hollow record. If either moved, regenerate via the canonical recorder + re-pin with
   a note explaining the (one-time) shift.
4. `pnpm --filter @legendary-arena/server test` — competitive/replay suites green.
5. Re-run WP-447/WP-450's determinism reasoning mentally: after this WP, marking a
   villain is genuinely hash-neutral (their §Determinism fixture-content caveats become
   moot). Note this in the govern-close.

---

## Risk (competitive verification — operator sign-off at SPEC review)

Changing `computeStateHash` changes the algorithm behind the competitive `replayHash`
(the `bgio.replay_artifacts` natural key) and the step-9 anti-tamper compare
(`competition.logic.ts`: `reduced.stateHash === replayHash`). Assessment:

- **Accepted scores are immune.** They are immutable (D-5302); a resubmit takes the
  idempotency fast-path (`findExistingByAccountAndHash`) and returns the stored row
  **without re-reducing** — so no already-scored replay can be retroactively broken.
- **The score math never reads `diagnostics`** — it is re-derived from terminal state
  (`deriveScoringInputs`, `evaluateEndgame`). Only the anti-tamper hash compare is
  diagnostics-sensitive.
- **The one real exposure is a one-time transition window:** a match **captured** under
  old (diagnostics-inclusive) engine code but **submitted after** this deploy would
  re-reduce to a diagnostics-excluded hash `≠` its stored `replayHash` → step-9
  `replay_verification_failed`. This affects only replays pre-captured by the harvester
  and not yet scored across the deploy boundary; the submit-time capture-on-demand path
  is self-consistent and unaffected. Note this window is LIVE in production (real matches
  DO materialize hollow records via D-24266, unlike the fixtures). **Mitigation:** deploy
  during low competitive activity; the affected (rare) submissions recover on a
  re-capture/resubmit. No data is corrupted — a false-negative on a narrow set of
  in-flight replays, one-time.
- **Two other `computeStateHash` consumers, both benign:** `network/desync.detect.ts`
  and `network/intent.validate` (client↔server state-hash agreement). These are
  within-version-symmetric and self-healing (engine-authoritative resync, D-0402), so
  steady-state is neutral; the only transient is a harmless false-desync-then-resync
  during a rolling deploy. No competitive or data impact.

**Operator decision — RECOMMENDED DEFAULT: `hashGameState`-only now; defer
`computeStateHash` to its own WP.** The concrete, recurring pain (golden-fixture churn
on every breadcrumb/effect-marking WP) is **fully fixed by the `hashGameState` half
alone**, at **zero competitive risk**. The `computeStateHash` exclusion is the
principled end-state (a runtime-only observation channel should never gate competitive
equality — the same argument already accepted for `messages`), but it has **no forcing
function today** (no live in-version bug) and it puts a one-time transition-window risk
on the competitive/ranking surface. Lower-regret sequencing: ship `hashGameState`-only,
then schedule the `computeStateHash` exclusion as a dedicated deploy during low
competitive activity with the transition window monitored. **This recommendation is the
independent copilot-check verdict + this analysis; `both surfaces` remains available and
defensible if the operator wants the unified end-state in one shot.** The fork is
recorded in D-24271; **operator confirms the scope at SPEC review before execution.**

---

## Definition of Done

- [ ] All 6 Acceptance Criteria pass.
- [ ] `diagnostics` excluded from `hashGameState` (+ `computeStateHash` unless the
      operator narrows scope at review); comments corrected.
- [ ] Diagnostics-invariance tests + exclusion-set pin present and green.
- [ ] Pinned hashes unchanged (or re-pinned-with-note); server suite green.
- [ ] `D-24271` landed (Active) recording the invariant + the competitive risk decision.
- [ ] `WORK_INDEX.md` `[x]`; `EC_INDEX.md` → Done; `docs/05-ROADMAP-MINDMAP.md` node
      `✅` + `roadmap:counts:check` green.

---

## Lint Gate Self-Review (`00.3`)

All 21 sections resolved at draft (full verdict in the SPEC commit body). Load-bearing:

- **§ Layer boundary:** single layer (Game Engine); server inherits with no edit. PASS.
- **§ Determinism / persistence:** this IS a determinism-boundary change — narrows the
  hash to authoritative gameplay state by removing an observation channel; competitive
  risk assessed in §Risk with operator sign-off. PASS (with §Risk documented).
- **§ Contract / drift:** the exclusion set is the "contract"; a test pins it. No
  canonical-array/union drift. PASS.
- **§ Scope closed:** In/Out enumerated; the buildInitialGameState seed cleanup,
  server/DB changes, and other-field exclusions are explicitly Out. PASS.
- **§21 API catalog:** N/A — no `apps/server` endpoint or catalogued library-only fn
  changes (the server inherits the engine hash; no signature change).
- Remaining sections: PASS / N/A as recorded in the commit body.
