# WP-518 — Secret Invasion Skrull Gain: Announce the Gain in the Fight Overlay

**User-Visible Surface:** `play.legendary-arena.com` — defeating a **Secret
Invasion Skrull** (a Hero acting as a Villain) now announces the gain in the
center-screen fight overlay (*"…and gained the Hero into the active player's
discard pile"*), instead of reading identically to an ordinary villain kill.
**D-24026 live-verification applies** (operator-pending: fight a Skrull, confirm
the overlay names the gain).

## User-Visible Impact

Reported 2026-08-10 from a 2p core Magneto + **Secret Invasion of the Skrull
Shapeshifters** co-op match (`TYSkhUJwNsZ`): the operator believed the scheme's
special rule *"If you defeat that Hero, you gain it"* was **not firing**. It is —
the diagnostics and durable log show the gain succeeding six times across both
players, and the gained Hero (`core/wolverine/berserker-rage#0`, a Sewers Skrull
defeated turn 22) is verifiably in the defeating player's zones afterward. The
engine mechanic (WP-514 / D-24327, `defeatCityVillainCore`) is correct.

What is missing is **feedback**: the `fightResolved` notable-event narrative —
the sentence the center-screen `NotableEventOverlay` shows on a defeat — reads
`Fought "Optic Blast".` for a Skrull, byte-identical to an ordinary villain kill.
No VP-bearing card lands in the victory pile (the Hero routes to the discard), and
nothing on screen names the gain, so the player reads the (correct) engine outcome
as "the gain isn't happening." This WP adds the missing overlay clause.

## Goal

Announce the Secret Invasion Skrull gain in the fight overlay. `composeFightNarrative`
gains a fourth `skrullGained` parameter; when true it appends
`" and gained the Hero into the active player's discard pile"` after the bystander
clause and before the `; Fight effect:` clause. `defeatCityVillainCore`
(`moves/fightVillain.ts`) captures the flag from
`G.convertedVillainOrigins[cardId] === 'skrull'` **before** it deletes the origin
overlay, and threads it into the narrative composition. Game engine only, one WP.
Locks **D-24331**.

## Assumes

- Baseline: `origin/main` @ the WP-518 reserve (`cd98261e` or later). Working tree
  clean.
- **WP-514 / D-24327** — the Secret Invasion defeat-to-gain path:
  `defeatCityVillainCore` routes a `G.convertedVillainOrigins[cardId] === 'skrull'`
  card to the defeating player's discard, deletes the origin entry, and pushes the
  durable `"…gained the Hero into their discard pile"` log line. This WP reads the
  same origin flag one statement earlier; it changes **no** routing, deletion, or
  log behavior.
- **WP-319 / D-24105** — the `composeFightNarrative` overlay contract: a pure,
  byte-stable composer whose string feeds the `fightResolved` notable event and the
  center-screen `NotableEventOverlay`. The narrative is the only cross-audience
  surface that announces mid-fight outcomes.
- **WP-200 / D-24081 hashing posture** — `notableEvents` (including each event's
  `narrative` string) **is hashed** by both oracles (`computeStateHash` and the
  fixture `hashGameState`); unlike `messages`/`logMeta`/`diagnostics` it has no
  dedicated observation-channel exclusion (`replay.hash.ts`,
  `test/fixtures/hashGameState.ts`). So a narrative-string change is
  replay-relevant wherever a committed fixture fires the affected event.
- **Existing behavior reused, not re-declared:** the `skrull` origin marker
  (`convertedVillainOrigins`), `pushLog`, the durable gain log line — all unchanged.

## Context (Read First)

- `docs/ai/ARCHITECTURE.md` §Rule Execution Pipeline, §Persistence Boundary (`G`
  runtime-only, hashed), §UIState Projection Integrity (the overlay is a shared,
  all-audience projection — not owner-scoped).
- `.claude/rules/*.md` + `.claude/skills/legendary-game-engine/SKILL.md`.
- `docs/ai/DECISIONS.md` — D-24327 (Secret Invasion defeat-to-gain), D-24105
  (overlay-per-target narration), D-24081 (message/hash split).
- **The template WP** — `docs/ai/work-packets/WP-319-overlay-per-target-narration.md`
  + `EC-349` (the precedent that last enriched `composeFightNarrative`; same file,
  same hash posture — the sentinel replay fires no fight event, so `finalStateHash`
  was unchanged).
- Source: `packages/game-engine/src/events/notableEvents.compose.ts:137`
  (`composeFightNarrative`); `packages/game-engine/src/moves/fightVillain.ts:229`
  (the Skrull branch) and `:337` (the `composeFightNarrative` call site).

**Split-vs-single decision:** one WP, single layer, single package
(`game-engine`). Four files (composer + fight core + their two tests). No card
data, no marker pipeline, no registry, no client change (the arena-client already
renders `event.narrative` verbatim; enriching the string needs no client edit).

**Audience/voice decision:** the clause uses third-person *"the active player's
discard pile"* to match the effect clauses (`"the active player KO'd a hero"`),
because the `NotableEventOverlay` narrative is a shared projection shown to every
audience, not the owner-scoped second-person voice.

## Scope (In)

- `composeFightNarrative` gains a fourth parameter `skrullGained: boolean = false`
  (`events/notableEvents.compose.ts`). When true, append
  `" and gained the Hero into the active player's discard pile"` after the
  bystander clause and before the `; Fight effect:` clause. The function is
  refactored to a single segment-composed `return` so the default-`false` output
  is **byte-identical** to the prior two-branch form for every existing input.
- `defeatCityVillainCore` (`moves/fightVillain.ts`) captures
  `let skrullGained = false`, sets it `true` inside the existing
  `convertedVillainOrigins[cardId] === 'skrull'` branch (**before** the origin
  `delete`), and passes it as the fourth `composeFightNarrative` argument at the
  `fightResolved` emission.
- Test updates: `events/notableEvents.compose.test.ts` (golden strings for the new
  clause + a byte-identity assertion that explicit-`false` equals the 3-arg form),
  `moves/fightVillain.test.ts` (the emitted `fightResolved` narrative names the
  gain on a Skrull defeat, and carries no gain clause on an ordinary defeat).

## Out of Scope

- **The engine mechanic itself** — routing, discard placement, origin deletion,
  and the durable log line are all correct (WP-514 / D-24327) and unchanged.
- **Any card data, marker pipeline, registry, or ewiki change** — this is a pure
  narrative-string enrichment.
- **Any client / arena-client change** — the overlay already renders
  `event.narrative`; no new UIState field, no new event type.
- **The `appliedEffects` keyword array** on the event — unchanged (only the
  `narrative` string is enriched).
- No scoring/PAR change; no new contract file; no new G field; no `ctx.random`.

## Files Expected to Change

**Engine (`packages/game-engine`):**
- `src/events/notableEvents.compose.ts` — `composeFightNarrative` 4th param + clause
- `src/moves/fightVillain.ts` — capture `skrullGained`, thread it into the call
- Tests: `src/events/notableEvents.compose.test.ts`,
  `src/moves/fightVillain.test.ts`

**Governance:** `docs/ai/DECISIONS.md` (D-24331), `docs/ai/NUMBER-LEDGER.md`,
`WORK_INDEX.md`, `EC_INDEX.md`, `docs/05-ROADMAP-MINDMAP.md`.

## Contract

- **The clause (D-24331).** `composeFightNarrative(cardName, bystandersRescued,
  effectResults, skrullGained = false)`. With `skrullGained === true` the returned
  sentence contains, in order: `Fought "<name>"`, the optional bystander clause,
  `" and gained the Hero into the active player's discard pile"`, the optional
  `"; Fight effect: …"` clause, and the terminal period. With
  `skrullGained === false` (or omitted) the output is byte-identical to the
  pre-WP-518 composer for every input — the default preserves all existing golden
  strings and every non-Skrull caller.
- **The flag source.** `defeatCityVillainCore` sets `skrullGained = true` iff
  `G.convertedVillainOrigins?.[cardId] === 'skrull'`, captured before the origin
  `delete`. The Silent-Sniper free-defeat path routes through the same core, so it
  is covered without special handling.
- **Determinism / hashing.** `notableEvents.narrative` is hashed (no
  observation-channel exclusion). The new clause fires **only** on a Skrull defeat;
  every non-Skrull `fightResolved` narrative is byte-identical, so no existing
  fixture's hash can move. **No committed fixture defeats a Skrull** (grep-verified
  at draft: no fixture or `*.replay.json` references `skrull`/`secret-invasion`;
  the `sentinel-core-doom-2p` replay fires no fight event, and `PRE_WP080_HASH`
  uses a synthetic group). So `finalStateHash` / `PRE_WP080_HASH` are expected
  **unchanged**. Verify at execution by running the engine suite (it includes
  `replay.hash.test.ts`, `hashGameState.test.ts`, and the sentinel replay); if
  either hash shifts, a fixture defeats a Skrull — STOP and re-record via
  `record-game-fixture.mjs`, never hand-edit.

## Vision Alignment

- **Vision clauses touched** — §1, §2 (faithful presentation of a shipped card
  mechanic; the engine already decides truth, this surfaces it to the player).
- **Conflict assertion** — `No conflict: this WP preserves all touched clauses.`
- **Non-Goal proximity check** — none of NG-1..7 crossed (no monetization, no
  pay-to-win; a presentation-only fix).
- **Determinism preservation** — deterministic and replay-faithful: no
  `ctx.random`; hash posture stated in §Contract (expected: no re-pin).

## Acceptance Criteria

1. Defeating a card with `convertedVillainOrigins[cardId] === 'skrull'` (via
   `defeatCityVillainCore`) emits a `fightResolved` event whose `narrative`
   contains `"gained the Hero into the active player's discard pile"`.
2. Defeating an ordinary (non-Skrull) villain emits a `fightResolved` narrative
   with **no** gain clause — byte-identical to the pre-WP-518 output.
3. `composeFightNarrative(name, n, effects)` (3-arg) and
   `composeFightNarrative(name, n, effects, false)` return **identical** strings
   for representative inputs (the golden tests still pin the exact pre-WP-518
   strings).
4. With `skrullGained === true`, the gain clause sits **after** the bystander
   clause and **before** the `"; Fight effect:"` clause (ordering pinned by a
   golden string).
5. `pnpm --filter @legendary-arena/game-engine build` 0; engine test green.
6. Sentinel / replay hashes **unchanged** (`finalStateHash`, `PRE_WP080_HASH`) —
   no committed fixture defeats a Skrull; verified by the passing suite.

## Verification Steps

1. `pnpm --filter @legendary-arena/game-engine build` → 0.
2. `pnpm --filter @legendary-arena/game-engine test` → pass (incl. the new compose
   golden strings, the byte-identity assertion, and the `fightResolved` narrative
   assertions in `fightVillain.test.ts`, and the unchanged replay/hash tests).
3. `pnpm roadmap:counts:check` → 0 (mindmap node present, counts current).
4. Live-verify (D-24026, operator, post-deploy): fight a Secret Invasion Skrull,
   confirm the center-screen overlay names the gain.

## Definition of Done

- All Acceptance Criteria pass; all Verification Steps green.
- Two-commit topology (`EC-553:` impl + `SPEC:` govern-close): D-24331 landed
  Active; `WORK_INDEX.md` `[x]`; `EC_INDEX.md` Done; mindmap `📝`→`✅` +
  `pnpm roadmap:counts:write`.
- `git diff --name-only` matches the allowlist (+ governance).
- `User-Visible Surface = play.legendary-arena.com` — D-24026 live-verify
  operator-pending on deploy.

## Non-Negotiable Constraints

**Engine-wide (always apply):**
- Full file contents for every modified file — no diffs, no snippets.
- ESM only; Node v22+; `node:`-prefixed built-ins.
- Human-style code per `docs/ai/REFERENCE/00.6-code-style.md` — full-word names,
  functions ≤ 30 lines with JSDoc, `if/else` over nested ternaries, `// why:` on
  non-obvious decisions.
- Determinism: no `Math.random()` / `Date.now()` / wall-clock / I/O in engine
  code; randomness only via `ctx.random.*` (none needed here).

**Packet-specific:**
- The `composeFightNarrative` default-`false` output MUST stay byte-identical to
  `main` for every existing input (the notableEvents narrative is hashed).
- The gain clause fires only on a genuine `skrull` origin, captured before the
  origin `delete`; it changes no routing, deletion, or durable-log behavior.
- Third-person voice (`"the active player's discard pile"`) — the overlay is a
  shared projection, not owner-scoped.
- No new npm dependency; no `pg`/server/registry import in engine files.

**Session protocol:** if any locked value here conflicts with the code on `main`
at execution time, STOP and reconcile against ARCHITECTURE.md before proceeding —
do not guess.

**Locked contract values:** see `## Contract` and `EC-553` Locked Values.

## Lint Gate Self-Review (00.3)

All 21 sections resolved (drafting session):

- **§1 Structure / §2 Constraints** — PASS (all sections present; constraints
  reference `00.6`; forbid partial output).
- **§3 Assumes** — PASS (WP-514/D-24327 gain path, WP-319/D-24105 composer
  contract, WP-200/D-24081 hash posture, reused behavior enumerated).
- **§4 Context (Read First)** — PASS (ARCHITECTURE sections, DECISIONS scan,
  WP-319 template, source files with line anchors).
- **§5 Files** — PASS (each marked; bounded, single package: 2 source + 2 test +
  governance).
- **§6 Naming** — PASS (`skrullGained`, `convertedVillainOrigins`, canonical
  field names; no renamed fields).
- **§7 Dependencies** — PASS (no new dep).
- **§8 Architecture** — PASS (engine only; no server/registry/pg/client reach; no
  boundary crossing).
- **§9 Windows / §10 Env** — N/A (no shell scripts; no env var).
- **§11 Auth** — N/A (no auth surface).
- **§12 Test Quality** — PASS (`node:test`; golden strings + byte-identity +
  emitted-narrative assertions; no `boardgame.io/testing`).
- **§13 Verification** — PASS (exact `pnpm` commands + expected exits).
- **§14 Acceptance** — PASS (6 binary, observable, function-specific items).
- **§15 / §15.1 Definition of Done** — PASS (`**User-Visible Surface:**` +
  `## User-Visible Impact`; DECISIONS/WORK_INDEX/EC_INDEX/mindmap + scope
  boundary; D-24026 live-verify item present).
- **§16 Code Style** — PASS (segment-composed return over the two-branch form is
  a simplification, not premature abstraction; optional param default; `// why:`
  on the flag capture, the clause, and the hash rationale; named imports only).
- **§17 Vision Alignment** — PASS (present; §1/§2; no conflict; NG clear;
  determinism line).
- **§18 Prose-vs-Grep** — PASS (no literal-string-scoped forbidden-token grep in
  Verification Steps).
- **§19 Bridge staleness** — N/A.
- **§20 Funding Surface** — N/A: no funding UI — a presentation fix for a gameplay
  mechanic.
- **§21 API Catalog** — N/A: no HTTP endpoint; no `apps/server/src/**` library
  function touched.
- Reserves **D-24331** (the Skrull-gain overlay-narration contract).
